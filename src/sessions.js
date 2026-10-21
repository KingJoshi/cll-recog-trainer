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

export function getSolveTime(solve) {
  if (!solve) return null;
  const isDNF = solve.penalty === -1 || solve.penalty === "DNF";
  if (isDNF) return Infinity;
  const baseMs = solve.ms != null ? solve.ms : (solve.time != null ? solve.time : 0);
  const isPlus2 = solve.penalty === 2 || solve.penalty === "+2";
  return isPlus2 ? baseMs + 2000 : baseMs;
}

export function filterSolves(solves = [], criteria = {}) {
  return solves.filter(s => {
    if (criteria.puzzle && s.puzzle && s.puzzle !== criteria.puzzle) return false;
    if (criteria.track && s.track && s.track !== criteria.track) return false;
    if (criteria.target && s.target !== criteria.target) return false;
    if (criteria.caseId && s.id !== criteria.caseId) return false;
    return true;
  });
}

export function groupSolvesByCase(solves = [], caseIds = []) {
  const caseIdSet = new Set(caseIds);
  const map = new Map();
  for (const s of solves) {
    if (s.id && (caseIds.length === 0 || caseIdSet.has(s.id))) {
      if (!map.has(s.id)) map.set(s.id, []);
      const t = getSolveTime(s);
      if (Number.isFinite(t)) {
        map.get(s.id).push(t);
      }
    }
  }
  return map;
}

export function computeCaseStats(times = []) {
  if (!times || times.length === 0) {
    return { attempts: 0, best: null, worst: null, mean: null, median: null };
  }
  const attempts = times.length;
  const best = Math.min(...times);
  const worst = Math.max(...times);
  const sum = times.reduce((acc, t) => acc + t, 0);
  const mean = Math.round(sum / attempts);
  const sorted = [...times].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 !== 0 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  return { attempts, best, worst, mean, median };
}

export function computeStats(solves = []) {
  const validTimes = solves
    .map(s => getSolveTime(s))
    .filter(t => t != null && Number.isFinite(t));

  if (validTimes.length === 0) {
    return { count: solves.length, validCount: 0, best: null, worst: null, ao5: null, ao12: null, ao100: null, mean: null, median: null };
  }

  const best = Math.min(...validTimes);
  const worst = Math.max(...validTimes);
  const sum = validTimes.reduce((acc, t) => acc + t, 0);
  const mean = Math.round(sum / validTimes.length);
  const sorted = [...validTimes].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 !== 0 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);

  const ao5 = computeAverageOfN(solves, 5);
  const ao12 = computeAverageOfN(solves, 12);
  const ao100 = computeAverageOfN(solves, 100);

  return {
    count: solves.length,
    validCount: validTimes.length,
    best,
    worst,
    mean,
    median,
    ao5,
    ao12,
    ao100
  };
}

export function computeAverageOfN(solves, n) {
  if (solves.length < n) return null;
  const recent = solves.slice(0, n);
  const times = recent.map(s => getSolveTime(s));

  const dnfCount = times.filter(t => t === Infinity).length;
  if (dnfCount > 1) return -1; // DNF

  // Sort ascending, drop 1 fastest and 1 slowest
  times.sort((a, b) => a - b);
  const trimmed = times.slice(1, n - 1);
  const sum = trimmed.reduce((acc, t) => acc + t, 0);
  return Math.round(sum / trimmed.length);
}

// ---------------------------------------------------------------------------
// CSV Export for Solve Logs
// ---------------------------------------------------------------------------

export function exportSolvesToCSV(solves = [], sessionName = "Session") {
  const headers = [
    "No",
    "Time(s)",
    "Penalty",
    "Raw Time(ms)",
    "Puzzle",
    "Track",
    "Case",
    "Target",
    "Scramble",
    "Date"
  ];

  const rows = solves.map((s, idx) => {
    const rawMs = s.ms != null ? s.ms : (s.time != null ? s.time : 0);
    const penalty = s.penalty === -1 ? "DNF" : (s.penalty === 2 ? "+2" : "OK");
    const finalSec = s.penalty === -1 ? "DNF" : ((rawMs + (s.penalty === 2 ? 2000 : 0)) / 1000).toFixed(2);
    const dateStr = s.at ? new Date(s.at).toISOString().replace("T", " ").substring(0, 19) : "";
    const cleanScramble = (s.scramble || "").replace(/"/g, '""');

    return [
      idx + 1,
      finalSec,
      penalty,
      rawMs,
      s.puzzle || "",
      s.track || "",
      s.id || s.caseTag || "",
      s.target || "",
      `"${cleanScramble}"`,
      `"${dateStr}"`
    ].join(",");
  });

  return [headers.join(","), ...rows].join("\r\n");
}

export function downloadCSV(content, filename = "speedcube-solves.csv") {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
