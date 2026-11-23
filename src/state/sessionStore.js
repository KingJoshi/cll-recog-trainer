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
  const initial = [
    { id: "default", name: "Session 1 (Full Solve)", target: "full", inspection: true, showCube: true, solves: [] },
    { id: "layer", name: "1st Layer Practice", target: "layer", inspection: true, showCube: true, solves: [] }
  ];
  const legacySolves = getValidLegacySolves(LEGACY_SOLVES_KEY);
  if (legacySolves.length) {
    initial[0].solves = [...legacySolves];
  }
  const legacyLayerSolves = getValidLegacySolves(LEGACY_LAYER_SOLVES_KEY);
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

export function saveSessions(sessions) {
  writeStorageJSON(SESSIONS_STORAGE_KEY, sessions);
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
    const ranked = [...matching].sort((a, b) => {
      const aSolves = Array.isArray(a.solves) ? a.solves : [];
      const bSolves = Array.isArray(b.solves) ? b.solves : [];
      const aLastAt = aSolves.length ? (aSolves[aSolves.length - 1]?.at || 0) : (a.updatedAt || 0);
      const bLastAt = bSolves.length ? (bSolves[bSolves.length - 1]?.at || 0) : (b.updatedAt || 0);
      if (bLastAt !== aLastAt) return bLastAt - aLastAt;
      return bSolves.length - aSolves.length;
    });
    return { action: "switched", session: ranked[0] };
  }

  if (current && (current.puzzle || "222") === puzzle && (!current.solves || current.solves.length === 0)) {
    current.puzzle = puzzle;
    current.target = target;
    current.updatedAt = Date.now();
    return { action: "retargeted", session: current };
  }

  const baseName = `${puzzleShortName || puzzle} ${targetLabel || target}`.trim();
  const existingNames = new Set(list.map(s => (s?.name || "").trim().toLowerCase()));
  let finalName = baseName;
  let suffix = 2;
  while (existingNames.has(finalName.toLowerCase())) {
    finalName = `${baseName} ${suffix}`;
    suffix++;
  }

  const newSession = {
    id: "session-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
    puzzle,
    name: finalName,
    target,
    size: current?.size || "medium",
    showCube: current?.showCube ?? true,
    inspection: current?.inspection ?? true,
    solves: [],
    updatedAt: Date.now()
  };

  return { action: "created", session: newSession };
}
