// csTimer.net Session & Solve Log Importer
// Supports:
//   1. csTimer full export JSON (.txt / .json from csTimer -> Export -> Export to file)
//   2. csTimer session CSV export (.csv from csTimer -> Session -> Export CSV)
// Preserves penalties (+2 / DNF), comments, timestamps, scrambles, and Bluetooth smart-cube move logs.

import { getSolveFingerprint } from './syncMerge.js';

const CSTIMER_SCRTYPE_MAP = {
  // 2x2x2
  "222so": { puzzle: "222", target: "full" },
  "222o": { puzzle: "222", target: "full" },
  "2223": { puzzle: "222", target: "full" },
  "222nb": { puzzle: "222", target: "full" },
  "222eg": { puzzle: "222", target: "cll" },
  "222eg0": { puzzle: "222", target: "cll" },
  "222cll": { puzzle: "222", target: "cll" },
  "222eg1": { puzzle: "222", target: "eg1" },
  "222eg2": { puzzle: "222", target: "eg2" },
  "222tc": { puzzle: "222", target: "full" },

  // 3x3x3
  "333": { puzzle: "333", target: "full" },
  "333ni": { puzzle: "333", target: "full" },
  "333fm": { puzzle: "333", target: "full" },
  "333ft": { puzzle: "333", target: "full" },
  "333custom": { puzzle: "333", target: "full" },
  "333mbf": { puzzle: "333", target: "full" },
  "333oh": { puzzle: "333oh", target: "full" },
  "333bf": { puzzle: "333bf", target: "full" },
  "333bld": { puzzle: "333bf", target: "full" },
  "edges": { puzzle: "333bf", target: "full" },
  "corners": { puzzle: "333bf", target: "full" },

  // 3x3 sub-steps
  "pll": { puzzle: "333", target: "pll" },
  "oll": { puzzle: "333", target: "oll" },
  "f2l": { puzzle: "333", target: "f2l" },
  "lsll2": { puzzle: "333", target: "f2l" },
  "coll": { puzzle: "333", target: "coll" },
  "cmll": { puzzle: "333", target: "cmll" },
  "wv": { puzzle: "333", target: "wv" },
  "zbll": { puzzle: "333", target: "full" },
  "2gll": { puzzle: "333", target: "full" },
  "cll": { puzzle: "222", target: "cll" },

  // Big cubes
  "444wca": { puzzle: "444", target: "full" },
  "444m": { puzzle: "444", target: "full" },
  "444yj": { puzzle: "444", target: "full" },
  "444bld": { puzzle: "444", target: "full" },
  "444edo": { puzzle: "444", target: "full" },
  "444si": { puzzle: "444", target: "full" },
  "4edge": { puzzle: "444", target: "full" },
  "555wca": { puzzle: "555", target: "full" },
  "555si": { puzzle: "555", target: "full" },
  "555bld": { puzzle: "555", target: "full" },
  "5edge": { puzzle: "555", target: "full" },
  "666wca": { puzzle: "666", target: "full" },
  "666si": { puzzle: "666", target: "full" },
  "666p": { puzzle: "666", target: "full" },
  "6edge": { puzzle: "666", target: "full" },
  "777wca": { puzzle: "777", target: "full" },
  "777si": { puzzle: "777", target: "full" },
  "777p": { puzzle: "777", target: "full" },
  "7edge": { puzzle: "777", target: "full" },

  // Side events
  "pyrso": { puzzle: "pyram", target: "full" },
  "pyro": { puzzle: "pyram", target: "full" },
  "pyrm": { puzzle: "pyram", target: "full" },
  "pyrl4e": { puzzle: "pyram", target: "full" },
  "skbso": { puzzle: "skewb", target: "full" },
  "skbo": { puzzle: "skewb", target: "full" },
  "skbnb": { puzzle: "skewb", target: "full" },
  "mgmp": { puzzle: "minx", target: "full" },
  "mgmc": { puzzle: "minx", target: "full" },
  "mgmo": { puzzle: "minx", target: "full" },
  "sqrs": { puzzle: "sq1", target: "full" },
  "sqrcsp": { puzzle: "sq1", target: "full" },
  "sq1h": { puzzle: "sq1", target: "full" },
  "sq1t": { puzzle: "sq1", target: "full" },
  "clkwca": { puzzle: "clock", target: "full" },
  "clko": { puzzle: "clock", target: "full" },
  "clk": { puzzle: "clock", target: "full" },
  "clknf": { puzzle: "clock", target: "full" },
  "ftoso": { puzzle: "fto", target: "full" },
  "fto": { puzzle: "fto", target: "full" }
};

function quickHash(str) {
  let h = 2166136261;
  const s = String(str || "");
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

function inferPuzzleFromText(name = "", sampleScrambles = [], fallbackPuzzle = "333") {
  const lower = String(name || "").toLowerCase();
  if (/\b2x2\b|\b222\b|\bcll\b|\bortega\b|\beg-?[12]\b/.test(lower)) {
    const target = /\beg-?1\b/.test(lower) ? "eg1" : /\beg-?2\b/.test(lower) ? "eg2" : /\bcll\b/.test(lower) ? "cll" : "full";
    return { puzzle: "222", target };
  }
  if (/\b3x3\s*oh\b|\b333oh\b|\bone[- ]?handed\b|\boh\b/.test(lower)) return { puzzle: "333oh", target: "full" };
  if (/\b3bld\b|\b333bf\b|\bblind\b/.test(lower)) return { puzzle: "333bf", target: "full" };
  if (/\b4x4\b|\b444\b/.test(lower)) return { puzzle: "444", target: "full" };
  if (/\b5x5\b|\b555\b/.test(lower)) return { puzzle: "555", target: "full" };
  if (/\b6x6\b|\b666\b/.test(lower)) return { puzzle: "666", target: "full" };
  if (/\b7x7\b|\b777\b/.test(lower)) return { puzzle: "777", target: "full" };
  if (/\bpyra/.test(lower)) return { puzzle: "pyram", target: "full" };
  if (/\bskewb/.test(lower)) return { puzzle: "skewb", target: "full" };
  if (/\bmega|\bminx/.test(lower)) return { puzzle: "minx", target: "full" };
  if (/\bsq-?1|\bsquare-?1/.test(lower)) return { puzzle: "sq1", target: "full" };
  if (/\bclock\b/.test(lower)) return { puzzle: "clock", target: "full" };
  if (/\bfto\b/.test(lower)) return { puzzle: "fto", target: "full" };

  const joined = sampleScrambles.slice(0, 5).join(" ");
  if (/\+\+|--/.test(joined)) return { puzzle: "minx", target: "full" };
  if (/\(\s*-?\d+\s*,\s*-?\d+\s*\)/.test(joined)) return { puzzle: "sq1", target: "full" };
  if (/\bUR\d[+-]|\bALL\d[+-]/.test(joined)) return { puzzle: "clock", target: "full" };
  if (/\b3[RUFLBD]w/.test(joined)) return { puzzle: "666", target: "full" };
  if (/\b[RUFLBD]w/.test(joined)) {
    const avgLen = sampleScrambles.slice(0, 5).reduce((a, s) => a + s.trim().split(/\s+/).filter(Boolean).length, 0) / Math.max(1, Math.min(5, sampleScrambles.length));
    return { puzzle: avgLen >= 50 ? "555" : "444", target: "full" };
  }
  if (sampleScrambles.length > 0) {
    const firstTokens = sampleScrambles[0].trim().split(/\s+/).filter(Boolean);
    if (firstTokens.length >= 4 && firstTokens.length <= 13 && firstTokens.every(t => /^[URF][2']?$/.test(t))) {
      return { puzzle: "222", target: "full" };
    }
  }
  return { puzzle: fallbackPuzzle || "333", target: "full" };
}

export function mapCsTimerScrType(scrType, sessionName = "", sampleScrambles = [], fallbackPuzzle = "333") {
  const key = String(scrType || "").trim().toLowerCase();
  if (key && CSTIMER_SCRTYPE_MAP[key]) {
    return { ...CSTIMER_SCRTYPE_MAP[key] };
  }
  return inferPuzzleFromText(sessionName, sampleScrambles, fallbackPuzzle);
}

/**
 * Parse csTimer smart-cube move log string (e.g. "R@0 U@120 R'@245 ...") into native moves array.
 */
function parseCsTimerSmartMoves(rawMovesField) {
  let moveStr = "";
  if (Array.isArray(rawMovesField) && typeof rawMovesField[0] === "string") {
    moveStr = rawMovesField[0];
  } else if (typeof rawMovesField === "string") {
    moveStr = rawMovesField;
  }
  if (!moveStr || !moveStr.includes("@")) return null;

  const moves = [];
  for (const tok of moveStr.trim().split(/\s+/)) {
    const m = /^([RUFLBDMSEruflbdxyz][w]?[2']?)@(\d+)$/.exec(tok);
    if (!m) continue;
    moves.push({ move: m[1], t: Number(m[2]) });
  }
  return moves.length > 0 ? moves : null;
}

/**
 * Parse a csTimer CSV time string (e.g. "12.34", "1:02.45", "14.56+", "DNF(15.20)", "DNF").
 */
export function parseCsTimerTimeString(raw) {
  const s = String(raw || "").trim();
  if (!s) return null;

  let penalty = null;
  let inner = s;

  if (/^DNF/i.test(inner)) {
    penalty = "DNF";
    const m = /^DNF\s*\(([^)]+)\)/i.exec(inner);
    inner = m ? m[1].trim() : "";
    if (!inner) {
      return { rawMs: 0, ms: 0, penalty: "DNF" };
    }
  }
  if (inner.endsWith("+")) {
    if (!penalty) penalty = "+2";
    inner = inner.slice(0, -1).trim();
  }

  let totalSec = 0;
  const parts = inner.split(":");
  if (parts.length === 1) {
    const val = Number(parts[0]);
    if (!Number.isFinite(val) || val < 0) return null;
    totalSec = val;
  } else if (parts.length === 2) {
    const mins = Number(parts[0]);
    const secs = Number(parts[1]);
    if (!Number.isFinite(mins) || !Number.isFinite(secs) || mins < 0 || secs < 0) return null;
    totalSec = mins * 60 + secs;
  } else if (parts.length === 3) {
    const hrs = Number(parts[0]);
    const mins = Number(parts[1]);
    const secs = Number(parts[2]);
    if (!Number.isFinite(hrs) || !Number.isFinite(mins) || !Number.isFinite(secs)) return null;
    totalSec = hrs * 3600 + mins * 60 + secs;
  } else {
    return null;
  }

  const parsedMs = Math.round(totalSec * 1000);
  if (penalty === "+2") {
    // csTimer CSV exports "14.56+" as the already-penalized total time (raw + 2s)
    const rawMs = Math.max(0, parsedMs - 2000);
    return { rawMs, ms: parsedMs, penalty: "+2" };
  }
  return { rawMs: parsedMs, ms: parsedMs, penalty };
}

function parseCsvLine(line, delimiter) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

/**
 * Quick check whether a text payload looks like a csTimer JSON or CSV export.
 */
export function isCsTimerExport(text) {
  const raw = String(text || "").trim();
  if (!raw) return false;
  if (raw.startsWith("{")) {
    try {
      const obj = JSON.parse(raw);
      if (!obj || typeof obj !== "object" || Array.isArray(obj)) return false;
      const keys = Object.keys(obj);
      const hasSessionKey = keys.some(k => /^session\d+$/.test(k) && Array.isArray(obj[k]));
      const hasSessionData = Boolean(obj.properties && obj.properties.sessionData !== undefined);
      return hasSessionKey || hasSessionData;
    } catch {
      return false;
    }
  }
  const firstLine = raw.split(/\r?\n/, 1)[0] || "";
  return /^No\.?\s*[;,]\s*Time\s*[;,]/i.test(firstLine);
}

function parseCsTimerJson(obj, { defaultPuzzle = "333", includeEmpty = false } = {}) {
  let sessionMeta = {};
  const rawMeta = obj?.properties?.sessionData;
  if (typeof rawMeta === "string" && rawMeta.trim()) {
    try {
      const parsedMeta = JSON.parse(rawMeta);
      if (parsedMeta && typeof parsedMeta === "object") sessionMeta = parsedMeta;
    } catch {}
  } else if (rawMeta && typeof rawMeta === "object") {
    sessionMeta = rawMeta;
  }

  const sessionKeys = Object.keys(obj)
    .filter(k => /^session\d+$/.test(k) && Array.isArray(obj[k]))
    .sort((a, b) => {
      const numA = a.slice(7);
      const numB = b.slice(7);
      const rankA = Number(sessionMeta[numA]?.rank ?? Number(numA));
      const rankB = Number(sessionMeta[numB]?.rank ?? Number(numB));
      return rankA - rankB;
    });

  if (sessionKeys.length === 0) {
    throw new Error("No csTimer sessions found in file.");
  }

  const sessions = [];
  let totalSolves = 0;

  for (const sKey of sessionKeys) {
    const numStr = sKey.slice(7);
    const rawList = obj[sKey];
    if (!Array.isArray(rawList)) continue;
    if (rawList.length === 0 && !includeEmpty) continue;

    const meta = sessionMeta[numStr] || {};
    const rawName = meta.name !== undefined && meta.name !== null ? String(meta.name).trim() : "";
    const sessionName = rawName && !/^\d+$/.test(rawName)
      ? rawName
      : `csTimer Session ${rawName || numStr}`;

    const sampleScrambles = rawList
      .slice(0, 8)
      .map(item => (Array.isArray(item) && typeof item[1] === "string" ? item[1] : ""))
      .filter(Boolean);

    const { puzzle, target } = mapCsTimerScrType(
      meta?.opt?.scrType,
      sessionName,
      sampleScrambles,
      defaultPuzzle
    );

    const solves = [];
    const baseFallbackAt = Date.now() - rawList.length * 1000;

    for (let i = 0; i < rawList.length; i++) {
      const entry = rawList[i];
      if (!Array.isArray(entry) || !Array.isArray(entry[0])) continue;

      const timeInfo = entry[0];
      const penaltyCode = Number(timeInfo[0] ?? 0);
      const rawMs = Math.round(Number(timeInfo[1]));
      if (!Number.isFinite(rawMs) || rawMs < 0) continue;

      let penalty = null;
      let ms = rawMs;
      if (penaltyCode === -1) {
        penalty = "DNF";
      } else if (penaltyCode === 2000) {
        penalty = "+2";
        ms = rawMs + 2000;
      }

      const scramble = typeof entry[1] === "string" ? entry[1].trim() : "";
      const comment = typeof entry[2] === "string" ? entry[2].trim() : "";
      const rawTs = Number(entry[3]);
      const at = Number.isFinite(rawTs) && rawTs > 0
        ? (rawTs < 1e12 ? Math.round(rawTs * 1000) : Math.round(rawTs))
        : baseFallbackAt + i * 1000;

      const moves = parseCsTimerSmartMoves(entry[4]);
      const moveCount = moves ? moves.length : 0;
      const tps = moves && rawMs > 0 ? Number((moveCount / (rawMs / 1000)).toFixed(2)) : null;

      const uid = `cst-${sKey}-${at}-${rawMs}-${quickHash(scramble || String(i))}`;
      const solve = {
        uid,
        puzzle,
        track: target === "full" ? undefined : target,
        target,
        id: null,
        ms,
        rawMs,
        penalty,
        at,
        scramble,
        moves: moves || null,
        moveCount,
        tps,
        smartCube: moves ? "csTimer Smart Cube" : null
      };
      if (comment) solve.note = comment;
      solves.push(solve);
    }

    if (solves.length === 0 && !includeEmpty) continue;
    solves.sort((a, b) => (a.at || 0) - (b.at || 0));

    totalSolves += solves.length;
    sessions.push({
      id: `cstimer-${sKey}`,
      puzzle,
      name: sessionName,
      target,
      size: "medium",
      showCube: true,
      inspection: true,
      updatedAt: solves.length ? solves[solves.length - 1].at : Date.now(),
      solves
    });
  }

  if (sessions.length === 0) {
    throw new Error("This csTimer export contains no solves to import.");
  }

  return {
    format: "cstimer-json",
    sessions,
    totalSolves
  };
}

function parseCsTimerCsv(text, { defaultPuzzle = "333", filename = "" } = {}) {
  const lines = String(text || "")
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);
  if (lines.length < 2) {
    throw new Error("CSV file has no solve rows to import.");
  }

  const headerLine = lines[0];
  const delimiter = headerLine.includes(";") ? ";" : ",";
  const headers = parseCsvLine(headerLine, delimiter).map(h => h.trim().toLowerCase());

  const timeIdx = headers.findIndex(h => h === "time" || h.startsWith("time"));
  if (timeIdx < 0) {
    throw new Error("CSV header is missing a 'Time' column.");
  }
  const commentIdx = headers.findIndex(h => h === "comment" || h === "note");
  const scrambleIdx = headers.findIndex(h => h === "scramble");
  const dateIdx = headers.findIndex(h => h === "date" || h === "timestamp");

  const baseName = String(filename || "")
    .replace(/\.[^.]+$/, "")
    .replace(/^cstimer[-_]?/i, "")
    .trim();
  const sessionName = baseName ? `csTimer: ${baseName}` : "csTimer CSV Import";

  const rawRows = [];
  const sampleScrambles = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i], delimiter);
    const parsedTime = parseCsTimerTimeString(cols[timeIdx]);
    if (!parsedTime) continue;
    const scramble = scrambleIdx >= 0 ? String(cols[scrambleIdx] || "").trim() : "";
    const comment = commentIdx >= 0 ? String(cols[commentIdx] || "").trim() : "";
    const dateRaw = dateIdx >= 0 ? String(cols[dateIdx] || "").trim() : "";
    if (scramble && sampleScrambles.length < 8) sampleScrambles.push(scramble);
    rawRows.push({ parsedTime, scramble, comment, dateRaw, idx: i });
  }

  if (rawRows.length === 0) {
    throw new Error("No valid solve times found in csTimer CSV.");
  }

  const { puzzle, target } = inferPuzzleFromText(sessionName, sampleScrambles, defaultPuzzle);
  const baseFallbackAt = Date.now() - rawRows.length * 1000;

  const solves = rawRows.map(({ parsedTime, scramble, comment, dateRaw, idx }) => {
    let at = baseFallbackAt + idx * 1000;
    if (dateRaw) {
      const parsedDate = Date.parse(dateRaw.replace(" ", "T"));
      if (Number.isFinite(parsedDate) && parsedDate > 0) at = parsedDate;
    }
    const uid = `cst-csv-${at}-${parsedTime.rawMs}-${quickHash(scramble || String(idx))}`;
    const solve = {
      uid,
      puzzle,
      track: target === "full" ? undefined : target,
      target,
      id: null,
      ms: parsedTime.ms,
      rawMs: parsedTime.rawMs,
      penalty: parsedTime.penalty,
      at,
      scramble,
      moves: null,
      moveCount: 0,
      tps: null,
      smartCube: null
    };
    if (comment) solve.note = comment;
    return solve;
  });

  solves.sort((a, b) => (a.at || 0) - (b.at || 0));

  const session = {
    id: `cstimer-csv-${quickHash(sessionName)}`,
    puzzle,
    name: sessionName,
    target,
    size: "medium",
    showCube: true,
    inspection: true,
    updatedAt: solves[solves.length - 1].at,
    solves
  };

  return {
    format: "cstimer-csv",
    sessions: [session],
    totalSolves: solves.length
  };
}

/**
 * Parse a csTimer.net export file (JSON backup .txt/.json or session .csv).
 */
export function parseCsTimerExport(text, options = {}) {
  const raw = String(text || "").trim();
  if (!raw) {
    throw new Error("Selected file is empty.");
  }
  if (raw.startsWith("{")) {
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      throw new Error("Invalid csTimer JSON file: could not parse.");
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Selected file is not a valid csTimer export.");
    }
    return parseCsTimerJson(parsed, options);
  }
  if (/^No\.?\s*[;,]\s*Time\s*[;,]/i.test(raw.split(/\r?\n/, 1)[0] || "")) {
    return parseCsTimerCsv(raw, options);
  }
  throw new Error("Unrecognized file format. Please export from csTimer.net (Export to file .txt/.json or Export CSV .csv).");
}

/**
 * Merge parsed csTimer sessions into AppStore idempotently (deduplicating by uid and solve fingerprint).
 */
export function importCsTimerSessions(appStore, parsedExport, { now = Date.now() } = {}) {
  if (!appStore || !parsedExport || !Array.isArray(parsedExport.sessions)) {
    throw new Error("Invalid csTimer import payload.");
  }

  const s = appStore.state;
  if (!Array.isArray(s.sessions)) s.sessions = [];

  let sessionsAdded = 0;
  let sessionsUpdated = 0;
  let solvesAdded = 0;
  let solvesSkipped = 0;
  const importedPuzzles = new Set();

  for (const incoming of parsedExport.sessions) {
    if (!incoming || !Array.isArray(incoming.solves)) continue;
    importedPuzzles.add(incoming.puzzle || "333");

    const existing = s.sessions.find(sess => sess.id === incoming.id);
    if (!existing) {
      s.sessions.push({
        ...incoming,
        solves: [...incoming.solves],
        updatedAt: now
      });
      sessionsAdded++;
      solvesAdded += incoming.solves.length;
    } else {
      const seenUids = new Set();
      const seenFps = new Set();
      for (const sv of existing.solves || []) {
        if (sv?.uid) seenUids.add(sv.uid);
        const fp = getSolveFingerprint(sv);
        if (fp) seenFps.add(fp);
      }

      let addedHere = 0;
      for (const sv of incoming.solves) {
        const fp = getSolveFingerprint(sv);
        if ((sv.uid && seenUids.has(sv.uid)) || (fp && seenFps.has(fp))) {
          solvesSkipped++;
          continue;
        }
        existing.solves.push(sv);
        if (sv.uid) seenUids.add(sv.uid);
        if (fp) seenFps.add(fp);
        addedHere++;
      }

      if (addedHere > 0) {
        existing.solves.sort((a, b) => (a.at || 0) - (b.at || 0));
        existing.updatedAt = now;
        sessionsUpdated++;
        solvesAdded += addedHere;
      }
    }
  }

  const changed = sessionsAdded > 0 || sessionsUpdated > 0;
  if (changed) {
    // If active session is empty and we imported a session for the current puzzle, activate it for immediate visibility
    const active = appStore.getActiveSession?.();
    if (active && (!active.solves || active.solves.length === 0)) {
      const matchForPuzzle = parsedExport.sessions.find(sess => (sess.puzzle || "333") === s.currentPuzzle);
      if (matchForPuzzle) {
        const targetSess = s.sessions.find(sess => sess.id === matchForPuzzle.id);
        if (targetSess) {
          s.activeSessionId = targetSess.id;
          s.solveTarget = targetSess.target || "full";
          s.lastSolve = targetSess.solves.length ? targetSess.solves[targetSess.solves.length - 1] : null;
          appStore.syncEffectiveSolveOptions?.();
        }
      }
    }
    appStore.saveSessions();
    appStore.saveSettings();
  }

  return {
    changed,
    sessionsAdded,
    sessionsUpdated,
    solvesAdded,
    solvesSkipped,
    importedPuzzles: Array.from(importedPuzzles)
  };
}
