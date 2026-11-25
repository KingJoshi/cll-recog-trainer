// Weakest-Cases Ranking & Drillable Case ID Resolution
import { getTrack } from '../data/algRegistry.js';
import { computeOllPllCaseStats } from '../cfopAnalyzer.js';
import { computeCllCaseStats } from '../twoByTwoAnalyzer.js';

const SYNTHETIC_CASE_FALLBACK = {
  "2look-oll-line": "oll-45",
  "2look-oll-l": "oll-44",
  "2look-oll-dot": "oll-02",
  "2look-pll-adj": "T",
  "2look-pll-diag": "Y",
  "pll-adj": "T1",
  "pll-diag": "H1"
};

/**
 * Resolve a case ID (including 2-look/synthetic IDs like "2look-oll-line", "pll-adj")
 * into a concrete drillable case ID belonging to `trackId`.
 */
export function resolveDrillableCaseId(puzzleId, trackId, rawId) {
  if (!rawId) return null;
  const track = getTrack(puzzleId, trackId);
  const caseById = track?.caseById;
  if (!track || !caseById || caseById.size === 0) return null;

  const trimmed = String(rawId).trim();
  const lower = trimmed.toLowerCase();
  if (lower.includes("skip") || lower === "none" || lower === "-") return null;

  if (caseById.has(trimmed)) return trimmed;

  const mapped = SYNTHETIC_CASE_FALLBACK[lower];
  if (mapped && caseById.has(mapped)) return mapped;

  if (puzzleId === "222" && trackId === "lbl") {
    if (lower === "pll-adj" && caseById.has("lbl-pll-adj")) return "lbl-pll-adj";
    if (lower === "pll-diag" && caseById.has("lbl-pll-diag")) return "lbl-pll-diag";
  }

  return null;
}

/**
 * Rank weakest drillable cases for `(puzzleId, trackId)` combining solve median times,
 * recognition accuracy, and "learning" / "review" study tags.
 */
export function getWeakestCasesForTrack({
  puzzleId = "333",
  trackId = "oll",
  solves = [],
  recogStats = {},
  caseTags = {},
  limit = 5,
  twoByTwoMethod = "cll"
} = {}) {
  const track = getTrack(puzzleId, trackId);
  if (!track || !Array.isArray(track.cases) || track.cases.length === 0) {
    return { caseIds: [], reasonsById: {} };
  }

  const maxLimit = Math.max(1, Number(limit) || 5);
  const picked = [];
  const pickedSet = new Set();
  const reasonsById = {};

  const addCase = (rawId, reason) => {
    if (picked.length >= maxLimit) return;
    const resolved = resolveDrillableCaseId(puzzleId, trackId, rawId);
    if (!resolved || pickedSet.has(resolved)) return;
    pickedSet.add(resolved);
    picked.push(resolved);
    reasonsById[resolved] = reason;
  };

  // 1. Slowest median case solve times from current session solves
  if (Array.isArray(solves) && solves.length > 0) {
    if ((puzzleId === "333" || puzzleId === "333oh") && (trackId === "oll" || trackId === "pll")) {
      const stats = computeOllPllCaseStats(solves, { ollMode: "full", pllMode: "full" });
      const list = trackId === "oll" ? stats.ollCases : stats.pllCases;
      const sorted = [...list].sort((a, b) => (b.medianMs || 0) - (a.medianMs || 0));
      for (const item of sorted) {
        if (item.isSkip) continue;
        addCase(item.id, `Slowest median (${(item.medianMs / 1000).toFixed(2)}s)`);
      }
    } else if (puzzleId === "222" && trackId === "cll") {
      const list = computeCllCaseStats(solves, { twoByTwoMethod });
      const sorted = [...list].sort((a, b) => (b.medianMs || 0) - (a.medianMs || 0));
      for (const item of sorted) {
        if (item.isSkip) continue;
        addCase(item.id, `Slowest median (${(item.medianMs / 1000).toFixed(2)}s)`);
      }
    }

    // Direct targeted drill solves matching this track
    const directMap = new Map();
    for (const sv of solves) {
      if (!sv || sv.penalty === "DNF" || sv.penalty === -1) continue;
      if (sv.track && sv.track !== trackId) continue;
      if (!sv.id || !track.caseById?.has(sv.id)) continue;
      const ms = typeof sv.cubeMs === "number" ? sv.cubeMs : sv.rawMs ?? sv.ms;
      if (!Number.isFinite(ms) || ms <= 0) continue;
      if (!directMap.has(sv.id)) directMap.set(sv.id, []);
      directMap.get(sv.id).push(ms);
    }
    if (directMap.size > 0) {
      const rankedDirect = [...directMap.entries()]
        .map(([id, times]) => {
          const sortedT = [...times].sort((a, b) => a - b);
          const med = sortedT[Math.floor(sortedT.length / 2)];
          return { id, med };
        })
        .sort((a, b) => b.med - a.med);
      for (const item of rankedDirect) {
        addCase(item.id, `Slowest median (${(item.med / 1000).toFixed(2)}s)`);
      }
    }
  }

  // 2. Recognition stats: lowest accuracy
  const bucketKey = `${puzzleId}:${trackId}`;
  const bucket = (recogStats && (recogStats[bucketKey] || (puzzleId === "222" && trackId === "cll" ? recogStats : null))) || {};
  const recogRanked = [];
  for (const c of track.cases) {
    const st = bucket[c.id];
    if (st && st.shown > 0) {
      const acc = (st.correct || 0) / st.shown;
      if (acc < 0.999) {
        recogRanked.push({ id: c.id, acc, shown: st.shown });
      }
    }
  }
  recogRanked.sort((a, b) => a.acc - b.acc || b.shown - a.shown);
  for (const item of recogRanked) {
    addCase(item.id, `Low recog accuracy (${Math.round(item.acc * 100)}%)`);
  }

  // 3. Learning / Review case tags
  for (const tagPriority of ["learning", "review"]) {
    for (const c of track.cases) {
      if (caseTags?.[c.id] === tagPriority) {
        addCase(c.id, `Tagged ${tagPriority}`);
      }
    }
  }

  // 4. Fallback to first cases of track if still empty
  if (picked.length === 0) {
    for (const c of track.cases.slice(0, maxLimit)) {
      addCase(c.id, "Track starter case");
    }
  }

  return { caseIds: picked, reasonsById };
}
