// Session Manager supporting both 2x2x2 and 3x3x3 speedcubing sessions

const SESSIONS_STORAGE_KEY = "cll_speedcube_sessions_v2";
const ACTIVE_SESSION_STORAGE_KEY = "cll_active_session_id_v2";

export function createDefaultSession(puzzle = "222", name = "Session 1") {
  return {
    id: "session-" + Date.now() + "-" + Math.random().toString(36).substr(2, 5),
    puzzle,
    name: name || (puzzle === "333" ? "3x3 Session" : "2x2 Session"),
    target: puzzle === "333" ? "full" : "full",
    size: "medium",
    showCube: true,
    inspection: true,
    solves: [] // { id, time, penalty: 0|2|-1, timestamp, scramble, target, caseTag }
  };
}

export function loadSessions() {
  try {
    const raw = localStorage.getItem(SESSIONS_STORAGE_KEY);
    if (!raw) {
      // Migrate v1 sessions if present:
      const v1Raw = localStorage.getItem("cll_solve_sessions_v1");
      if (v1Raw) {
        const v1 = JSON.parse(v1Raw);
        if (Array.isArray(v1) && v1.length > 0) {
          const migrated = v1.map(s => ({
            ...s,
            puzzle: s.puzzle || "222",
            target: s.target || "full",
            size: s.widgetSize || s.size || "medium",
            showCube: s.showCube !== false,
            inspection: s.inspection !== false
          }));
          saveSessions(migrated);
          return migrated;
        }
      }
      const def2 = createDefaultSession("222", "2x2 Main");
      const def3 = createDefaultSession("333", "3x3 Main");
      const initial = [def2, def3];
      saveSessions(initial);
      setActiveSessionId(def2.id);
      return initial;
    }
    const list = JSON.parse(raw);
    return Array.isArray(list) && list.length > 0 ? list : [createDefaultSession("222")];
  } catch (e) {
    console.error("Failed to load sessions:", e);
    return [createDefaultSession("222")];
  }
}

export function saveSessions(sessions) {
  try {
    localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
  } catch (e) {
    console.error("Failed to save sessions:", e);
  }
}

export function getActiveSessionId() {
  return localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY) || "";
}

export function setActiveSessionId(id) {
  localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, id);
}

export function getSessionsForPuzzle(sessions, puzzle) {
  return sessions.filter(s => s.puzzle === puzzle);
}

export function computeStats(solves = []) {
  const validTimes = solves
    .filter(s => s.penalty !== -1)
    .map(s => (s.penalty === 2 ? s.time + 2000 : s.time));

  if (validTimes.length === 0) {
    return { count: solves.length, best: null, ao5: null, ao12: null, mean: null };
  }

  const best = Math.min(...validTimes);
  const sum = validTimes.reduce((acc, t) => acc + t, 0);
  const mean = Math.round(sum / validTimes.length);

  const ao5 = computeAverageOfN(solves, 5);
  const ao12 = computeAverageOfN(solves, 12);

  return {
    count: solves.length,
    validCount: validTimes.length,
    best,
    mean,
    ao5,
    ao12
  };
}

export function computeAverageOfN(solves, n) {
  if (solves.length < n) return null;
  const recent = solves.slice(0, n);
  const times = recent.map(s => {
    if (s.penalty === -1) return Infinity;
    return s.penalty === 2 ? s.time + 2000 : s.time;
  });

  const dnfCount = times.filter(t => t === Infinity).length;
  if (dnfCount > 1) return -1; // DNF

  // Sort ascending, drop 1 fastest and 1 slowest
  times.sort((a, b) => a - b);
  const trimmed = times.slice(1, n - 1);
  const sum = trimmed.reduce((acc, t) => acc + t, 0);
  return Math.round(sum / trimmed.length);
}
