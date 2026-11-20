// Sessions & Solve Stats barrel (preserves backwards-compatible exports)

export {
  SESSIONS_STORAGE_KEY,
  ACTIVE_SESSION_STORAGE_KEY,
  createDefaultSession,
  loadSessions,
  saveSessions,
  getActiveSessionId,
  setActiveSessionId,
  getSessionsForPuzzle
} from './state/sessionStore.js';

export {
  getSolveTime,
  filterSolves,
  groupSolvesByCase,
  computeCaseStats,
  computeStats,
  computeAverageOfN,
  getBestAverageOfN,
  exportSolvesToCSV,
  downloadCSV
} from './services/solveStats.js';
