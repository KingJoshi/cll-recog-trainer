// Multi-session store & legacy localStorage migration (preserving `cllTrainerSessions` user data)

import { readStorageRaw, writeStorageRaw, readStorageJSON, writeStorageJSON } from './storage.js';

export const SESSIONS_STORAGE_KEY = "cllTrainerSessions";
export const LEGACY_V2_SESSIONS_KEY = "cll_speedcube_sessions_v2";
export const LEGACY_V1_SESSIONS_KEY = "cll_solve_sessions_v1";
export const LEGACY_SOLVES_KEY = "cllTrainerSolves";
export const LEGACY_LAYER_SOLVES_KEY = "cllTrainerLayerSolves";
export const ACTIVE_SESSION_STORAGE_KEY = "cll_active_session_id_v2";

export function createDefaultSession(puzzle = "222", name = "Session 1") {
  return {
    id: "session-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
    puzzle,
    name: name || (puzzle === "333" ? "3x3 Session" : "2x2 Session"),
    target: "full",
    size: "medium",
    showCube: true,
    inspection: true,
    solves: []
  };
}

function normalizeSession(s) {
  return {
    ...s,
    id: s.id || "session-" + Math.random().toString(36).slice(2, 7),
    name: s.name || "Session",
    puzzle: s.puzzle || undefined,
    target: s.target || "full",
    size: s.widgetSize || s.size || "medium",
    showCube: s.showCube !== false,
    inspection: s.inspection !== false,
    solves: Array.isArray(s.solves) ? s.solves : []
  };
}

function getValidLegacySolves(key) {
  const arr = readStorageJSON(key);
  if (!Array.isArray(arr)) return [];
  return arr.filter(x => x && Number.isFinite(x.ms));
}

function createInitialMainSessions() {
  const legacySolves = getValidLegacySolves(LEGACY_SOLVES_KEY);
  const legacyLayerSolves = getValidLegacySolves(LEGACY_LAYER_SOLVES_KEY);
  if (!legacySolves.length && !legacyLayerSolves.length) {
    return [
      { id: "default", puzzle: "333", name: "3x3 Main", target: "full", inspection: true, showCube: true, solves: [] }
    ];
  }
  const initial = [
    { id: "default", name: "Session 1 (Full Solve)", target: "full", inspection: true, showCube: true, solves: [] },
    { id: "layer", name: "1st Layer Practice", target: "layer", inspection: true, showCube: true, solves: [] }
  ];
  if (legacySolves.length) {
    initial[0].solves = [...legacySolves];
  }
  if (legacyLayerSolves.length) {
    initial[1].solves = [...legacyLayerSolves];
  }
  return initial;
}

export function loadSessions() {
  try {
    const primary = readStorageJSON(SESSIONS_STORAGE_KEY);
    if (Array.isArray(primary) && primary.length > 0) {
      const normalized = primary.map(normalizeSession);
      // Preserve legacy layer solve backfill if "layer" session exists empty
      const layerSess = normalized.find(s => s.id === "layer");
      if (layerSess && layerSess.solves.length === 0) {
        const legacyLayer = getValidLegacySolves(LEGACY_LAYER_SOLVES_KEY);
        if (legacyLayer.length) {
          layerSess.solves = [...legacyLayer];
          saveSessions(normalized);
        }
      }
      // Also merge any orphan v2 sessions that were stored separately
      const v2 = readStorageJSON(LEGACY_V2_SESSIONS_KEY);
      if (Array.isArray(v2) && v2.length > 0) {
        const existingIds = new Set(normalized.map(s => s.id));
        const extra = v2
          .filter(s => s && !existingIds.has(s.id) && Array.isArray(s.solves) && s.solves.length > 0)
          .map(normalizeSession);
        if (extra.length > 0) {
          normalized.push(...extra);
          saveSessions(normalized);
        }
      }
      return normalized;
    }

    const v2 = readStorageJSON(LEGACY_V2_SESSIONS_KEY);
    if (Array.isArray(v2) && v2.length > 0) {
      const migrated = v2.map(normalizeSession);
      saveSessions(migrated);
      return migrated;
    }

    const v1 = readStorageJSON(LEGACY_V1_SESSIONS_KEY);
    if (Array.isArray(v1) && v1.length > 0) {
      const migrated = v1.map(s => normalizeSession({ ...s, puzzle: s.puzzle || "222" }));
      saveSessions(migrated);
      return migrated;
    }

    const initial = createInitialMainSessions();
    saveSessions(initial);
    if (!getActiveSessionId()) {
      setActiveSessionId(initial[0].id);
    }
    return initial;
  } catch (e) {
    console.error("Failed to load sessions:", e);
    return createInitialMainSessions();
  }
}

export const KEEP_RAW_MOVES_COUNT = 1000;

export function saveSessions(sessions) {
  if (writeStorageJSON(SESSIONS_STORAGE_KEY, sessions)) {
    return true;
  }
  // Quota fallback: preserve all solve records, stripping verbose `moves` arrays
  // from solves older than the newest KEEP_RAW_MOVES_COUNT smart-cube solves.
  try {
    const list = Array.isArray(sessions) ? sessions : [];
    const moveEntries = [];
    for (let sIdx = 0; sIdx < list.length; sIdx++) {
      const solves = list[sIdx]?.solves;
      if (!Array.isArray(solves)) continue;
      for (let i = 0; i < solves.length; i++) {
        const sv = solves[i];
        if (sv && Array.isArray(sv.moves) && sv.moves.length > 0) {
          moveEntries.push({ sIdx, i, at: Number(sv.at || 0) });
        }
      }
    }
    moveEntries.sort((a, b) => b.at - a.at);
    const stripSet = new Set();
    for (let k = KEEP_RAW_MOVES_COUNT; k < moveEntries.length; k++) {
      stripSet.add(`${moveEntries[k].sIdx}:${moveEntries[k].i}`);
    }
    const compacted = list.map((sess, sIdx) => {
      if (!sess || !Array.isArray(sess.solves)) return sess;
      return {
        ...sess,
        solves: sess.solves.map((sv, i) => {
          if (!sv || !stripSet.has(`${sIdx}:${i}`)) return sv;
          const { moves, ...rest } = sv;
          return rest;
        })
      };
    });
    return writeStorageJSON(SESSIONS_STORAGE_KEY, compacted);
  } catch {
    return false;
  }
}

export function getActiveSessionId() {
  return readStorageRaw(ACTIVE_SESSION_STORAGE_KEY) || "";
}

export function setActiveSessionId(id) {
  writeStorageRaw(ACTIVE_SESSION_STORAGE_KEY, id || "");
}

export function getSessionsForPuzzle(sessions, puzzle) {
  return (sessions || []).filter(s => !s.puzzle || s.puzzle === puzzle);
}

function makeUniqueSessionName(sessions = [], baseName = "Session") {
  const existingNames = new Set((sessions || []).map(s => (s?.name || "").trim().toLowerCase()));
  let finalName = baseName;
  let suffix = 2;
  while (existingNames.has(finalName.toLowerCase())) {
    finalName = `${baseName} ${suffix}`;
    suffix++;
  }
  return finalName;
}

function rankBestMatchingSession(matching = []) {
  if (matching.length <= 1) return matching[0] || null;
  const ranked = [...matching].sort((a, b) => {
    const aSolves = Array.isArray(a.solves) ? a.solves : [];
    const bSolves = Array.isArray(b.solves) ? b.solves : [];
    const aLastAt = aSolves.length ? (aSolves[aSolves.length - 1]?.at || 0) : (a.updatedAt || 0);
    const bLastAt = bSolves.length ? (bSolves[bSolves.length - 1]?.at || 0) : (b.updatedAt || 0);
    if (bLastAt !== aLastAt) return bLastAt - aLastAt;
    return bSolves.length - aSolves.length;
  });
  return ranked[0];
}

function getSolveDedupeKey(sv) {
  if (!sv) return "";
  if (sv.uid) return `uid:${sv.uid}`;
  const raw = sv.rawMs != null && Number.isFinite(sv.rawMs) ? sv.rawMs : sv.ms;
  return `at:${sv.at || 0}|${raw || 0}|${sv.scramble || ""}`;
}

function mergeSolveLists(existingSolves = [], incomingSolves = []) {
  const byKey = new Map();
  for (const sv of existingSolves) {
    if (!sv) continue;
    byKey.set(getSolveDedupeKey(sv), sv);
  }
  for (const sv of incomingSolves) {
    if (!sv) continue;
    const key = getSolveDedupeKey(sv);
    if (!byKey.has(key)) byKey.set(key, sv);
  }
  const merged = [...byKey.values()];
  merged.sort((a, b) => (a.at || 0) - (b.at || 0));
  return merged;
}

/**
 * Resolve which session should be active when selecting a Solve Target for a puzzle.
 * - Keeps the active session if its puzzle & target already match.
 * - Switches to the most-recently-active existing session for (puzzle, target) if one exists.
 * - Retargets the current session if it belongs to `puzzle` and still has 0 solves.
 * - Otherwise creates a dedicated session for (puzzle, target) so solves never mix across targets.
 */
export function resolveSessionForTarget(
  sessions = [],
  activeSessionId = "",
  puzzleId = "222",
  targetId = "full",
  { puzzleShortName = "", targetLabel = "" } = {}
) {
  const puzzle = puzzleId || "222";
  const target = targetId || "full";
  const list = Array.isArray(sessions) ? sessions : [];
  const current = list.find(s => s && s.id === activeSessionId) || null;

  if (current && (current.puzzle || "222") === puzzle && (current.target || "full") === target) {
    return { action: "unchanged", session: current };
  }

  const matching = list.filter(s => s && (s.puzzle || "222") === puzzle && (s.target || "full") === target);
  if (matching.length > 0) {
    return { action: "switched", session: rankBestMatchingSession(matching) };
  }

  if (current && (current.puzzle || "222") === puzzle && (!current.solves || current.solves.length === 0)) {
    current.puzzle = puzzle;
    current.target = target;
    current.updatedAt = Date.now();
    return { action: "retargeted", session: current };
  }

  const baseName = `${puzzleShortName || puzzle} ${targetLabel || target}`.trim();
  const newSession = {
    id: "session-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
    puzzle,
    name: makeUniqueSessionName(list, baseName),
    target,
    size: current?.size || "medium",
    showCube: current?.showCube ?? true,
    inspection: current?.inspection ?? true,
    solves: [],
    updatedAt: Date.now()
  };

  return { action: "created", session: newSession };
}

/**
 * Compute a dry-run plan for splitting a mixed-target session into per-target sessions.
 */
export function planSessionSplitByTarget(
  sessions = [],
  sessionId = "",
  { puzzleShortName = "", getTargetLabel = (t) => t || "Full Solve" } = {}
) {
  const list = Array.isArray(sessions) ? sessions : [];
  const sess = list.find(s => s && s.id === sessionId) || null;
  if (!sess || !Array.isArray(sess.solves) || sess.solves.length === 0) {
    return { canSplit: false, movedCount: 0, destinations: [] };
  }

  const puzzle = sess.puzzle || "222";
  const byTarget = new Map();
  for (const sv of sess.solves) {
    const t = sv?.target || "full";
    if (!byTarget.has(t)) byTarget.set(t, []);
    byTarget.get(t).push(sv);
  }

  if (byTarget.size < 2) {
    return { canSplit: false, movedCount: 0, destinations: [] };
  }

  const sessTarget = sess.target || "full";
  let keepTarget = sessTarget;
  if (!byTarget.has(sessTarget)) {
    let bestTarget = null;
    let bestCount = -1;
    for (const [t, arr] of byTarget.entries()) {
      if (arr.length > bestCount) {
        bestCount = arr.length;
        bestTarget = t;
      }
    }
    keepTarget = bestTarget;
  }

  const reservedNames = [...list];
  const destinations = [];
  let movedCount = 0;

  for (const [target, arr] of byTarget.entries()) {
    if (target === keepTarget) continue;
    movedCount += arr.length;
    const matches = list.filter(s => s && s.id !== sess.id && (s.puzzle || "222") === puzzle && (s.target || "full") === target);
    const existingDest = matches.length > 0 ? rankBestMatchingSession(matches) : null;
    const targetLabel = getTargetLabel(target);
    if (existingDest) {
      destinations.push({
        target,
        targetLabel,
        count: arr.length,
        solves: arr,
        action: "merge",
        sessionId: existingDest.id,
        sessionName: existingDest.name
      });
    } else {
      const baseName = `${puzzleShortName || puzzle} ${targetLabel}`.trim();
      const newName = makeUniqueSessionName(reservedNames, baseName);
      reservedNames.push({ name: newName });
      destinations.push({
        target,
        targetLabel,
        count: arr.length,
        solves: arr,
        action: "create",
        sessionId: null,
        sessionName: newName
      });
    }
  }

  return {
    canSplit: destinations.length > 0,
    sourceSessionId: sess.id,
    sourceSessionName: sess.name,
    puzzle,
    keepTarget,
    keepTargetLabel: getTargetLabel(keepTarget),
    keepSolves: byTarget.get(keepTarget) || [],
    keepCount: (byTarget.get(keepTarget) || []).length,
    movedCount,
    destinations
  };
}

/**
 * Execute a target split on `sessionId`, keeping `keepTarget` in `sess` and moving other targets
 * into existing matching sessions or newly created dedicated sessions.
 */
export function splitSessionByTarget(
  sessions = [],
  sessionId = "",
  opts = {}
) {
  const plan = planSessionSplitByTarget(sessions, sessionId, opts);
  if (!plan.canSplit) {
    return { ...plan, createdSessions: [], modifiedSessions: [] };
  }

  const list = Array.isArray(sessions) ? sessions : [];
  const sess = list.find(s => s && s.id === sessionId);
  const now = Date.now();
  const createdSessions = [];
  const modifiedSessions = [];

  sess.puzzle = plan.puzzle;
  sess.target = plan.keepTarget;
  sess.solves = [...plan.keepSolves];
  sess.updatedAt = now;
  modifiedSessions.push(sess);

  for (const dest of plan.destinations) {
    if (dest.action === "merge") {
      const targetSess = list.find(s => s && s.id === dest.sessionId);
      if (targetSess) {
        targetSess.solves = mergeSolveLists(targetSess.solves || [], dest.solves);
        targetSess.updatedAt = now;
        modifiedSessions.push(targetSess);
      }
    } else {
      const newSession = {
        id: "session-" + now + "-" + Math.random().toString(36).slice(2, 7),
        puzzle: plan.puzzle,
        name: dest.sessionName,
        target: dest.target,
        size: sess.size || "medium",
        showCube: sess.showCube ?? true,
        inspection: sess.inspection ?? true,
        solves: mergeSolveLists([], dest.solves),
        updatedAt: now
      };
      dest.sessionId = newSession.id;
      createdSessions.push(newSession);
    }
  }

  return {
    ...plan,
    createdSessions,
    modifiedSessions
  };
}
