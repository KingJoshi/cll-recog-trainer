import { ScrambleDisplay } from 'scramble-display';
import { puzzles } from 'cubing/puzzles';
import { randomScrambleForEvent } from 'cubing/scramble';
import { findLayerSolutions, findFaceSolutions } from './layerSolver.js';
import { findCrossSolutions } from './crossSolver.js';
import { Alg } from 'cubing/alg';
import { cllCases } from './casesData.js';
import { pblCases, pblCaseById } from './pblData.js';
import { PUZZLES, getTrack, getPreferredAlg, setPreferredAlg, formatCaseDisplayId, getDistinctCaseName } from './data/algRegistry.js';
import { StudyView } from './studyView.js';
import { PracticeView } from './practiceView.js';
import { pllCases } from './data/pllData.js';
import { ollCases } from './data/ollData.js';
import { f2lCases } from './data/f2lData.js';
import { ortegaCases } from './data/ortegaData.js';
import { exportSolvesToCSV, downloadCSV } from './sessions.js';
import {
  DEFAULT_CUBE_COLORS,
  CUBE_COLORS,
  setCustomCubeColors,
  applyCubeColorsToCss,
  clearSvgCache,
  renderCaseSvg,
  getCachedCaseSvg,
  prewarmOllPllSvgs,
  isOllPllSvgsPrewarmed,
  applyColorsTo3DCube,
  ensure3x3FoundationOpaque
} from './caseVisualizer.js';
import { MOVE_TOKEN_REGEX, cleanAlg, normalizeAlgForCompare, parseScrambleInput } from './algParser.js';
import { smartCube, preloadSmartCube, formatMacAddress } from './smartCube.js';
import { ganTimer, computeSolvePhaseSplits, averagePhase, shouldIgnorePrematureTimerStop } from './ganTimer.js';
import { ScrambleTracker } from './scrambleTracker.js';
import { solveReplayViewer } from './replayView.js';
import {
  initCfopAnalyzer,
  analyzeCfopSolveSync,
  ensureSolveCfop,
  computeCfopAverages,
  computeOllPllCaseStats,
  computeMedian,
  computeTrimmedMean,
  isCfopAnalyzerReady
} from './cfopAnalyzer.js';
import './style.css';

// Register service worker for offline support (production only; the dev
// server has no sw.js and would log a MIME-type error).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(err => {
    console.log('Service worker registration failed:', err);
  });
}

// CLL cases with scrambles and solutions. "opposite" is the case you get by
// performing the solution on a solved cube (the inverse case), handy for
// chaining practice.

const GROUPS = ["A", "H", "L", "P", "S", "T", "U"];
// Order for browsing cases (picker and overview): groups whose same-coloured
// stickers sit next to each other are easier to recognise, so they come first.
const GROUP_DISPLAY_ORDER = ["H", "P", "U", "T", "L", "S", "A"];
const GROUP_NAMES = { A: "Anti-Sune", H: "H", L: "L", P: "Pi", S: "Sune", T: "T", U: "U" };
const casesByGroup = Object.fromEntries(
  GROUPS.map(g => [g, cllCases.cases.filter(c => c.group === g)])
);
const caseById = new Map(cllCases.cases.map(c => [c.id, c]));
const CASE_IDS = GROUP_DISPLAY_ORDER.flatMap(g => casesByGroup[g].map(c => c.id));
cllCases.cases.forEach(c => {
  if (!c.alg) c.alg = c.solutionAlg;
  if (!c.computerSolution) c.computerSolution = c.solutionAlg;
});

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

const STATS_KEY = 'cllTrainerStats';
const SETTINGS_KEY = 'cllTrainerSettings';
const SOLVES_KEY = 'cllTrainerSolves';
const LAYER_SOLVES_KEY = 'cllTrainerLayerSolves';
const APPEARANCES_KEY = 'cllTrainerAppearances';
const CASE_TAGS_KEY = 'cllTrainerCaseTags';
const CLL_CUSTOM_LABELS_KEY = 'cllTrainerCustomLabels';
const PBL_SETTINGS_KEY = 'cllTrainerPblSettings';
const SESSIONS_KEY = 'cllTrainerSessions';
const MAX_SOLVES = 500;

const UI_COOKIE_KEY = 'cll_ui_prefs';

function readCookieJSON(name) {
  try {
    if (typeof document === "undefined" || !document.cookie) return null;
    const match = document.cookie.split('; ').find(row => row.startsWith(name + '='));
    if (!match) return null;
    return JSON.parse(decodeURIComponent(match.substring(name.length + 1)));
  } catch (e) {
    return null;
  }
}

function writeCookieJSON(name, value) {
  try {
    if (typeof document === "undefined") return;
    const encoded = encodeURIComponent(JSON.stringify(value));
    document.cookie = `${name}=${encoded}; max-age=31536000; path=/; SameSite=Lax`;
  } catch (e) {}
}

function readJSON(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function writeJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    // storage may be unavailable (private mode, quota); the app still works
  }
}

function readSessionJSON(key) {
  try {
    const raw = sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch (e) {
    return null;
  }
}

function writeSessionJSON(key, value) {
  try {
    sessionStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
  }
}

let caseAppearances = readSessionJSON(APPEARANCES_KEY) || {};

function saveCaseAppearances() {
  writeSessionJSON(APPEARANCES_KEY, caseAppearances);
}

function resetCaseAppearances() {
  caseAppearances = {};
  saveCaseAppearances();
}

// ---------------------------------------------------------------------------
// App state
// ---------------------------------------------------------------------------

const VALID_PUZZLES = ["222", "333", "333oh", "444", "555"];
const cookiePrefs = readCookieJSON(UI_COOKIE_KEY) || {};
const savedSettings = { ...cookiePrefs, ...(readJSON(SETTINGS_KEY) || {}) };

let currentPuzzle = VALID_PUZZLES.includes(savedSettings.currentPuzzle) ? savedSettings.currentPuzzle : "222";
let currentTrackId = savedSettings.currentTrackId || (PUZZLES[currentPuzzle]?.defaultTrack || "cll");

let selectedCases = new Set(
  Array.isArray(savedSettings.selected)
    ? savedSettings.selected.filter(id => caseById.has(id))
    : CASE_IDS
);
let alwaysWhiteBottom = savedSettings.alwaysWhiteBottom ?? true;
let allowAUF = savedSettings.allowAUF ?? true;
let showReflection = savedSettings.showReflection ?? true;
let darkMode = savedSettings.darkMode ?? false;
let statsCollapsed = savedSettings.statsCollapsed ?? cookiePrefs.statsCollapsed ?? false;
let freeMovesOpen = savedSettings.freeMovesOpen ?? cookiePrefs.freeMovesOpen ?? false;
let layerSolutionsOpen = savedSettings.layerSolutionsOpen ?? cookiePrefs.layerSolutionsOpen ?? false;
let crossSolutionsOpen = savedSettings.crossSolutionsOpen ?? cookiePrefs.crossSolutionsOpen ?? false;
let solveLogOpen = savedSettings.solveLogOpen ?? cookiePrefs.solveLogOpen ?? true;
let cfopSummaryOpen = savedSettings.cfopSummaryOpen ?? cookiePrefs.cfopSummaryOpen ?? true;
let ollCasesStatsOpen = savedSettings.ollCasesStatsOpen ?? cookiePrefs.ollCasesStatsOpen ?? true;
let pllCasesStatsOpen = savedSettings.pllCasesStatsOpen ?? cookiePrefs.pllCasesStatsOpen ?? true;
let timerDrillPreset = savedSettings.timerDrillPreset || "righty-inv";
let caseTagMode = false;

if (savedSettings.customColors) {
  setCustomCubeColors(savedSettings.customColors);
  applyCubeColorsToCss(savedSettings.customColors);
} else {
  applyCubeColorsToCss(DEFAULT_CUBE_COLORS);
}
let layerTargetFaces = Array.isArray(savedSettings.layerTargetFaces) && savedSettings.layerTargetFaces.length
  ? savedSettings.layerTargetFaces
  : ["white"];
let crossTargetFaces = Array.isArray(savedSettings.crossTargetFaces) && savedSettings.crossTargetFaces.length
  ? savedSettings.crossTargetFaces
  : ["white"];
let statsType = (savedSettings.statsType === "recog" || savedSettings.statsType === "cll")
  ? savedSettings.statsType
  : "log";
let solveStatsSort = { col: "median", dir: "desc" };
let sessionLogSort = { col: "num", dir: "desc" };
let ollPllBreakdownSort = {
  oll: { col: "medianMs", dir: "desc" },
  pll: { col: "medianMs", dir: "desc" }
};
let recogStatsSort = { col: "case", dir: "asc" };

// Modes in progression order: study, practice, solve, simulate
const MODES = ["study", "practice", "solve", "simulate"];
let mode = MODES.includes(savedSettings.mode)
  ? savedSettings.mode
  : (savedSettings.mode === "timed" ? "practice" : "solve");

const urlParams = new URLSearchParams(window.location.search);
if (urlParams.has("puzzle")) {
  const p = urlParams.get("puzzle");
  if (VALID_PUZZLES.includes(p)) currentPuzzle = p;
}
if (urlParams.has("track")) {
  currentTrackId = urlParams.get("track");
}
if (urlParams.has("mode")) {
  const m = urlParams.get("mode");
  if (MODES.includes(m)) mode = m;
  else if (m === "timed") mode = "practice";
}
let timedMinutes = clampMinutes(savedSettings.timedMinutes ?? 3);

let session = null;        // running timed session
let sessionSummary = null; // last finished session, shown until dismissed
let practiceAnswered = false;
let flashTimer = 0;

// Solve mode (stackmat-style timer with WCA inspection)
let solveState = "idle"; // "idle" | "inspecting" | "armed" | "running"
let solveStart = 0;
let solveRaf = 0;
let solveInspectionStart = 0;
let solveInspectionInterval = 0;
let solveArmTimeout = 0;
let solvePenalty = null; // null | "+2" | "DNF"
let solveWarning8Played = false;
let solveWarning12Played = false;
let overlayHideOnPointerUp = false;
let swallowNextClick = false;
let lastSolve = null;

// GAN Smart Timer driven solves (pick-up / put-down tracking with a smart cube)
let solveTimerDriven = false; // current solve was started by the GAN timer
let solveTimerStartTs = 0;    // performance.now() when timer reported RUNNING
let solveFirstMoveTs = 0;     // performance.now() of first smart cube face turn
let solveCubeSolvedTs = 0;    // performance.now() when smart cube reached solved
let solveMoveOrigin = 0;      // timestamp that tracked move `t` values are relative to
// Multi-session management & storage
const DEFAULT_SESSIONS = [
  { id: "default", name: "Session 1 (Full Solve)", target: "full", inspection: true, showCube: true, solves: [] },
  { id: "layer", name: "1st Layer Practice", target: "layer", inspection: true, showCube: true, solves: [] }
];

let sessions = readJSON(SESSIONS_KEY);
if (!Array.isArray(sessions) || sessions.length === 0) {
  sessions = DEFAULT_SESSIONS;
  const legacySolves = Array.isArray(readJSON(SOLVES_KEY)) ? readJSON(SOLVES_KEY).filter(x => x && Number.isFinite(x.ms)) : [];
  if (legacySolves.length) {
    sessions[0].solves = [...legacySolves];
  }
  const legacyLayerSolves = Array.isArray(readJSON(LAYER_SOLVES_KEY)) ? readJSON(LAYER_SOLVES_KEY).filter(x => x && Number.isFinite(x.ms)) : [];
  if (legacyLayerSolves.length) {
    sessions[1].solves = [...legacyLayerSolves];
  }
  writeJSON(SESSIONS_KEY, sessions);
} else {
  // Ensure legacy layer solves are imported if layer session is empty
  const layerSess = sessions.find(s => s.id === "layer");
  if (layerSess && (!layerSess.solves || layerSess.solves.length === 0)) {
    const legacyLayerSolves = Array.isArray(readJSON(LAYER_SOLVES_KEY)) ? readJSON(LAYER_SOLVES_KEY).filter(x => x && Number.isFinite(x.ms)) : [];
    if (legacyLayerSolves.length) {
      layerSess.solves = [...legacyLayerSolves];
      writeJSON(SESSIONS_KEY, sessions);
    }
  }
  // Ensure all existing sessions have showCube and inspection defined
  sessions.forEach(s => {
    if (s.showCube === undefined) s.showCube = true;
    if (s.inspection === undefined) s.inspection = true;
  });
}

let activeSessionId = savedSettings.activeSessionId || sessions[0].id;
if (!sessions.some(s => s.id === activeSessionId)) {
  activeSessionId = sessions[0].id;
}

function saveSessions() {
  writeJSON(SESSIONS_KEY, sessions);
}

function getActiveSession() {
  return sessions.find(s => s.id === activeSessionId) || sessions[0];
}

let solveTarget = urlParams.get("target") || (urlParams.has("track") && ["pll", "oll", "f2l", "cross", "layer", "face", "cll"].includes(urlParams.get("track")) ? urlParams.get("track") : null) || getActiveSession().target || savedSettings.solveTarget || "full";
let solveShowCube = getActiveSession().showCube ?? true;
let solveInspection = getActiveSession().inspection ?? true;
let solveWidgetSize = "large";

let solves = getActiveSession().solves || [];
lastSolve = solves.length ? solves[solves.length - 1] : null;

function saveSolves() {
  const sess = getActiveSession();
  sess.solves = solves;
  saveSessions();
  writeJSON(SOLVES_KEY, solves); // backup for compatibility
}

// 1st Layer practice state & storage
let layerSession = sessions.find(s => s.id === "layer") || sessions[0];
let layerSolves = layerSession.solves || [];
let lastLayerSolve = layerSolves.length ? layerSolves[layerSolves.length - 1] : null;

function saveLayerSolves() {
  const sess = sessions.find(s => s.id === "layer");
  if (sess) {
    sess.solves = layerSolves;
    saveSessions();
  }
  writeJSON(LAYER_SOLVES_KEY, layerSolves);
}

// Case tags: { [caseId]: 'learning' | 'review' | 'mastered' }
let caseTags = readJSON(CASE_TAGS_KEY) || {};
let currentTagFilter = "all";

function saveCaseTags() {
  writeJSON(CASE_TAGS_KEY, caseTags);
}

function getCaseTag(caseId) {
  return caseTags[caseId] || "none";
}

function formatCaseTagLabel(tag) {
  return tag === "none" ? "Pending" : tag;
}

function setCaseTag(caseId, tag) {
  if (!["none", "learning", "review", "mastered"].includes(tag)) return;
  if (tag === "none") {
    delete caseTags[caseId];
  } else {
    caseTags[caseId] = tag;
  }
  saveCaseTags();
  if (typeof updateCasePickerTags === "function") updateCasePickerTags();
  if (mode === "study" && currentCaseId === caseId) {
    updateCaseInfoDisplay();
  }
}

function cycleCaseTag(caseId) {
  const current = getCaseTag(caseId);
  const next = current === "none" ? "learning" : current === "learning" ? "review" : current === "review" ? "mastered" : "none";
  setCaseTag(caseId, next);
}

// Custom Algorithm Labels (CLL & PBL)
let customCllLabels = readJSON(CLL_CUSTOM_LABELS_KEY) || {};

function saveCustomCllLabels() {
  writeJSON(CLL_CUSTOM_LABELS_KEY, customCllLabels);
}

function getCllCaseSolutionDisplay(caseObj) {
  if (!caseObj) return "";
  return customCllLabels[caseObj.id] || caseObj.solution || caseObj.solutionAlg || "";
}

function setCllCaseSolutionDisplay(caseId, customLabel) {
  if (!customLabel || customLabel.trim() === "") {
    delete customCllLabels[caseId];
  } else {
    customCllLabels[caseId] = customLabel.trim();
  }
  saveCustomCllLabels();
  if (mode === "study") updateCaseInfoDisplay();
}

// PBL settings: { [caseId]: { selectedAlgId: "...", customLabels: { [algId]: "..." } } }
let pblSettings = readJSON(PBL_SETTINGS_KEY) || {};

function savePblSettings() {
  writeJSON(PBL_SETTINGS_KEY, pblSettings);
}

function getPblCaseSelectedAlg(caseObj) {
  const caseSetting = pblSettings[caseObj.id];
  if (caseSetting && caseSetting.selectedAlgId) {
    const found = caseObj.algs.find(a => a.id === caseSetting.selectedAlgId);
    if (found) return found;
  }
  return caseObj.algs[0];
}

function getPblAlgDisplayLabel(caseId, algObj) {
  const custom = pblSettings[caseId]?.customLabels?.[algObj.id];
  return custom || algObj.label;
}

function clampMinutes(value) {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.min(60, Math.max(1, n)) : 3;
}

let scramble = "";      // full alg for the 3D view (orientation + moves)
let scrambleMoves = ""; // moves only, for scrambling a physical cube (white on bottom)
let currentCaseId = null;
let currentCaseScramble = null;
let currentSolveTarget = "full";
let currentSolveScramble = "";
let solveScrambleSource = null;
let guessedGroup = null;
let guessedCase = null;
let settingsCollapsed = savedSettings.casesCollapsed ?? savedSettings.settingsCollapsed ?? cookiePrefs.casesCollapsed ?? true;

// stats supporting Puzzle -> Track -> Case hierarchy
// Structure: stats[puzzle][trackId][caseId] = { shown, correct }
// Legacy flat keys (e.g. stats["A1"] = { shown, correct }) are supported and synced.
let stats = readJSON(STATS_KEY) || {};
GROUPS.forEach(group => delete stats[group]); // older versions kept separate group counters

function saveStats() {
  writeJSON(STATS_KEY, stats);
}

function getCaseStat(puzzle = currentPuzzle, trackId = currentTrackId, caseId) {
  if (!caseId || !stats) return { shown: 0, correct: 0 };
  if (stats[puzzle] && stats[puzzle][trackId] && stats[puzzle][trackId][caseId]) {
    return stats[puzzle][trackId][caseId];
  }
  // Check if legacy flat key exists
  if (stats[caseId] && typeof stats[caseId] === "object" && typeof stats[caseId].shown === "number") {
    return stats[caseId];
  }
  return { shown: 0, correct: 0 };
}

function recordCaseStat(puzzle = currentPuzzle, trackId = currentTrackId, caseId, isCorrect) {
  if (!caseId) return;
  if (!stats) stats = {};
  if (!stats[puzzle]) stats[puzzle] = {};
  if (!stats[puzzle][trackId]) stats[puzzle][trackId] = {};
  if (!stats[puzzle][trackId][caseId]) {
    const existing = getCaseStat(puzzle, trackId, caseId);
    stats[puzzle][trackId][caseId] = { shown: existing.shown, correct: existing.correct };
  }
  const entry = stats[puzzle][trackId][caseId];
  entry.shown++;
  if (isCorrect) entry.correct++;

  // Sync legacy flat key for 2x2 CLL backward compatibility
  if (puzzle === "222" && trackId === "cll") {
    stats[caseId] = { shown: entry.shown, correct: entry.correct };
  }
  saveStats();
}

function resetRecognitionStats(puzzle = currentPuzzle, trackId = currentTrackId) {
  if (!stats) return;
  if (stats[puzzle] && stats[puzzle][trackId]) {
    delete stats[puzzle][trackId];
  }
  if (puzzle === "222" && trackId === "cll") {
    CASE_IDS.forEach(id => delete stats[id]);
  }
  resetCaseAppearances();
  saveStats();
}

const LOG_PAGE_SIZE_OPTIONS = [5, 12, 25, 50, 100];
let sessionLogPageSize = LOG_PAGE_SIZE_OPTIONS.includes(Number(savedSettings.sessionLogPageSize))
  ? Number(savedSettings.sessionLogPageSize)
  : 12;
let sessionLogPage = 1;

function saveSettings() {
  const payload = {
    currentPuzzle,
    currentTrackId,
    selected: [...selectedCases],
    alwaysWhiteBottom,
    allowAUF,
    showReflection,
    darkMode,
    mode,
    timedMinutes,
    casesCollapsed: settingsCollapsed,
    settingsCollapsed,
    statsCollapsed,
    freeMovesOpen,
    layerSolutionsOpen,
    crossSolutionsOpen,
    solveLogOpen,
    cfopSummaryOpen,
    ollCasesStatsOpen,
    pllCasesStatsOpen,
    timerDrillPreset,
    statsType,
    layerTargetFaces,
    crossTargetFaces,
    activeSessionId,
    solveTarget,
    solveShowCube,
    solveInspection,
    solveWidgetSize,
    sessionLogPageSize,
    customColors: { ...CUBE_COLORS }
  };
  writeJSON(SETTINGS_KEY, payload);
  writeCookieJSON(UI_COOKIE_KEY, {
    currentPuzzle,
    currentTrackId,
    mode,
    darkMode,
    alwaysWhiteBottom,
    allowAUF,
    showReflection,
    casesCollapsed: settingsCollapsed,
    statsCollapsed,
    freeMovesOpen,
    layerSolutionsOpen,
    crossSolutionsOpen,
    solveLogOpen,
    cfopSummaryOpen,
    ollCasesStatsOpen,
    pllCasesStatsOpen,
    timerDrillPreset,
    layerTargetFaces,
    crossTargetFaces
  });
}

// ---------------------------------------------------------------------------
// DOM references
// ---------------------------------------------------------------------------

const displayContainer = document.getElementById("display-container");
const emptyState = document.getElementById("empty-state");
const caseInfoContainer = document.getElementById("case-info-container");
const guessingContainer = document.getElementById("guessing-container");
const verifyMessage = document.getElementById("verify-message");
const verifyBtn = document.getElementById("verifyBtn");
const regenerateBtn = document.getElementById("regenerateBtn");
const casePicker = document.getElementById("casePicker");
const selectionCount = document.getElementById("selectionCount");
const settingsPanel = document.getElementById("settingsPanel");
const settingsToggle = document.getElementById("settingsToggle");
const statsPanel = document.getElementById("statsPanel");
const statsToggle = document.getElementById("statsToggle");
const statsTabLog = document.getElementById("statsTabLog");
const statsTabCll = document.getElementById("statsTabCll");
const statsTabRecog = document.getElementById("statsTabRecog");
const overview = document.getElementById("overview");
const overviewBtn = document.getElementById("overviewBtn");
const overviewClose = document.getElementById("overviewClose");
const overviewBody = document.getElementById("overviewBody");
const groupButtons = Array.from(document.querySelectorAll(".group-btn"));
const caseButtons = Array.from(document.querySelectorAll(".case-btn"));
const stage = document.querySelector(".stage");
const cubeCard = document.querySelector(".cube-card");
const guessLabel = document.querySelector(".guess-label");
const modeButtons = Array.from(document.querySelectorAll(".mode-btn"));
const timedBar = document.getElementById("timedBar");
const countdownEl = document.getElementById("countdown");
const liveTallyEl = document.getElementById("liveTally");
const timedProgress = document.getElementById("timedProgress");
const endSessionBtn = document.getElementById("endSessionBtn");
const timedSetup = document.getElementById("timedSetup");
const minutesInput = document.getElementById("minutesInput");
const minutesDec = document.getElementById("minutesDec");
const minutesInc = document.getElementById("minutesInc");
const startSessionBtn = document.getElementById("startSessionBtn");
const timedFeedback = document.getElementById("timedFeedback");
const timedSummary = document.getElementById("timedSummary");
const solveScramble = document.getElementById("solveScramble");
const solveScrambleText = document.getElementById("solveScrambleText");
const solveScrambleSubtext = document.getElementById("solveScrambleSubtext");
const solveNewScrambleBtn = document.getElementById("solveNewScrambleBtn");
const solveCustomScrambleBtn = document.getElementById("solveCustomScrambleBtn");
const solveCustomScrambleRow = document.getElementById("solveCustomScrambleRow");
const solveCustomInput = document.getElementById("solveCustomInput");
const solveCustomClearBtn = document.getElementById("solveCustomClearBtn");
const solveCustomApplyBtn = document.getElementById("solveCustomApplyBtn");
const solveCustomCancelBtn = document.getElementById("solveCustomCancelBtn");
const solveSurface = document.getElementById("solveSurface");
const solveTimeEl = document.getElementById("solveTime");
const solveCaseEl = document.getElementById("solveCase");
const solveTimes = document.getElementById("solveTimes");
const solveSummaryEl = document.getElementById("solveSummary");
const solveList = document.getElementById("solveList");
const clearSolvesBtn = document.getElementById("clearSolvesBtn");
const solveOverlay = document.getElementById("solveOverlay");
const solveOverlayTime = document.getElementById("solveOverlayTime");
const solveOverlayHint = document.getElementById("solveOverlayHint");
const solveOverlayCancelBtn = document.getElementById("solveOverlayCancelBtn");
const layerSolutionsWidget = document.getElementById("layerSolutionsWidget");
const layerSolutionsTitle = document.getElementById("layerSolutionsTitle");
const layerSolutionsBadge = document.getElementById("layerSolutionsBadge");
const layerSolutionsList = document.getElementById("layerSolutionsList");
const layerFacesChips = document.getElementById("layerFacesChips");
const layerPresetWhiteBtn = document.getElementById("layerPresetWhiteBtn");
const layerPresetOppositeBtn = document.getElementById("layerPresetOppositeBtn");
const layerPresetAllBtn = document.getElementById("layerPresetAllBtn");
const resetOrientationBtn = document.getElementById("resetOrientationBtn");
const solveDetailModal = document.getElementById("solveDetailModal");
const solveReplayModal = document.getElementById("solveReplayModal");
const solveModalTitle = document.getElementById("solveModalTitle");
const solveModalTime = document.getElementById("solveModalTime");
const solveModalScramble = document.getElementById("solveModalScramble");
const solveModalDate = document.getElementById("solveModalDate");
const solveModalCloseBtn = document.getElementById("solveModalCloseBtn");
const solveModalDismissBtn = document.getElementById("solveModalDismissBtn");
const solveModalCopyScrambleBtn = document.getElementById("solveModalCopyScrambleBtn");
const solveModalReattemptBtn = document.getElementById("solveModalReattemptBtn");
const solveModalSimBtn = document.getElementById("solveModalSimBtn");

// Solve Modal Replay & CFOP Elements
const solveModalCfopField = document.getElementById("solveModalCfopField");
const solveModalCfopContent = document.getElementById("solveModalCfopContent");
const solveModalMovesField = document.getElementById("solveModalMovesField");
const solveModalMovesCount = document.getElementById("solveModalMovesCount");
const solveModalTps = document.getElementById("solveModalTps");
const solveModalDevice = document.getElementById("solveModalDevice");
const solveModalMovesTape = document.getElementById("solveModalMovesTape");
const solveModalReplayBtn = document.getElementById("solveModalReplayBtn");

// Smart Cube & Bluetooth Elements
const bluetoothBtn = document.getElementById("bluetoothBtn");
const bluetoothHeaderDot = document.getElementById("bluetoothHeaderDot");
const ganTimerBtn = document.getElementById("ganTimerBtn");
const ganTimerHeaderDot = document.getElementById("ganTimerHeaderDot");
const ganTimerLabel = document.getElementById("ganTimerLabel");
const solveModalPhasesField = document.getElementById("solveModalPhasesField");
const solveModalPhasesContent = document.getElementById("solveModalPhasesContent");
const bluetoothModal = document.getElementById("bluetoothModal");
const bluetoothModalStatusBadge = document.getElementById("bluetoothModalStatusBadge");
const bluetoothModalCloseBtn = document.getElementById("bluetoothModalCloseBtn");
const btModalDismissBtn = document.getElementById("btModalDismissBtn");
const btStatusCard = document.getElementById("btStatusCard");
const btLargeIcon = document.getElementById("btLargeIcon");
const btDeviceName = document.getElementById("btDeviceName");
const btStatusDesc = document.getElementById("btStatusDesc");
const btBatteryWrap = document.getElementById("btBatteryWrap");
const btBatteryLevel = document.getElementById("btBatteryLevel");
const btConnectBtn = document.getElementById("btConnectBtn");
const btDisconnectBtn = document.getElementById("btDisconnectBtn");
const btVirtualBtn = document.getElementById("btVirtualBtn");
const btDemoSolveBtn = document.getElementById("btDemoSolveBtn");
const btLiveStreamWrap = document.getElementById("btLiveStreamWrap");
const btTurnCounter = document.getElementById("btTurnCounter");
const btMoveChipsList = document.getElementById("btMoveChipsList");
const btVirtualKeypad = document.getElementById("btVirtualKeypad");
const btResetBtn = document.getElementById("btResetBtn");
const btErrorAlert = document.getElementById("btErrorAlert");
const btErrorText = document.getElementById("btErrorText");
const btErrorDismissBtn = document.getElementById("btErrorDismissBtn");
const btCustomMacInput = document.getElementById("btCustomMacInput");
const btSaveMacBtn = document.getElementById("btSaveMacBtn");
const btUnfilteredCheckbox = document.getElementById("btUnfilteredCheckbox");
const settingsResetBtBtn = document.getElementById("settingsResetBtBtn");
const btDiagCountBadge = document.getElementById("btDiagCountBadge");
const btDiagToggleBtn = document.getElementById("btDiagToggleBtn");
const btDiagCopyBtn = document.getElementById("btDiagCopyBtn");
const btDiagDownloadBtn = document.getElementById("btDiagDownloadBtn");
const btDiagClearBtn = document.getElementById("btDiagClearBtn");
const btSavedCubesSection = document.getElementById("btSavedCubesSection");
const btSavedCubesList = document.getElementById("btSavedCubesList");

// Solve Mode Live Smart Cube Elements
const smartCubeSolveIndicator = document.getElementById("smartCubeSolveIndicator");
const smartCubeSolveText = document.getElementById("smartCubeSolveText");
const smartCubeReadyBtn = document.getElementById("smartCubeReadyBtn");
const smartCubeResetSolvedBtn = document.getElementById("smartCubeResetSolvedBtn");
const smartCubeDiagToggleBtn = document.getElementById("smartCubeDiagToggleBtn");
const smartCubeDiagCopyBtn = document.getElementById("smartCubeDiagCopyBtn");
const solveLiveStats = document.getElementById("solveLiveStats");
const solveLiveMovesCount = document.getElementById("solveLiveMovesCount");
const solveLiveTps = document.getElementById("solveLiveTps");
const solvePostSummary = document.getElementById("solvePostSummary");
const solvePostReplayBtn = document.getElementById("solvePostReplayBtn");

// Scramble assistant & smart cube state
const scrambleTracker = new ScrambleTracker("");
let smartCubeStage = "scrambling"; // "scrambling" | "ready" | "inspecting" | "solving"
const SCRAMBLE_CORRECTION_DELAY_MS = 400;
let scrambleCorrectionDelayTimer = null;
let scrambleSuppressTransient = false;
let scrambleErrorVisible = false;

// Tracked moves for active solve
let trackedSolveMoves = [];

// New Modals & Controls
const guideBtn = document.getElementById("guideBtn");
const guideModal = document.getElementById("guideModal");
const guideCloseBtn = document.getElementById("guideCloseBtn");

const pblOverviewBtn = document.getElementById("pblOverviewBtn");
const pblModal = document.getElementById("pblModal");
const pblCloseBtn = document.getElementById("pblCloseBtn");
const pblCardsContainer = document.getElementById("pblCardsContainer");

const customLabelModal = document.getElementById("customLabelModal");
const customLabelTitle = document.getElementById("customLabelTitle");
const customLabelCloseBtn = document.getElementById("customLabelCloseBtn");
const customLabelInput = document.getElementById("customLabelInput");
const customLabelAlgNotation = document.getElementById("customLabelAlgNotation");
const customLabelSaveBtn = document.getElementById("customLabelSaveBtn");
const customLabelResetBtn = document.getElementById("customLabelResetBtn");
const customLabelCancelBtn = document.getElementById("customLabelCancelBtn");

const sessionModal = document.getElementById("sessionModal");
const sessionModalTitle = document.getElementById("sessionModalTitle");
const sessionModalCloseBtn = document.getElementById("sessionModalCloseBtn");
const sessionNameInput = document.getElementById("sessionNameInput");
const sessionDefaultTarget = document.getElementById("sessionDefaultTarget");
const sessionShowCubeCheckbox = document.getElementById("sessionShowCubeCheckbox");
const sessionInspectionCheckbox = document.getElementById("sessionInspectionCheckbox");
const sessionModalSaveBtn = document.getElementById("sessionModalSaveBtn");
const sessionModalCancelBtn = document.getElementById("sessionModalCancelBtn");

const settingsBtn = document.getElementById("settingsBtn");
const settingsModal = document.getElementById("settingsModal");
const settingsModalCloseBtn = document.getElementById("settingsModalCloseBtn");
const settingsDoneBtn = document.getElementById("settingsDoneBtn");
const colorPickerGrid = document.getElementById("colorPickerGrid");
const resetColorsBtn = document.getElementById("resetColorsBtn");
const settingsDarkTheme = document.getElementById("settingsDarkTheme");
const settingsAlwaysWhiteBottom = document.getElementById("settingsAlwaysWhiteBottom");
const settingsAllowAUF = document.getElementById("settingsAllowAUF");
const settingsShowReflection = document.getElementById("settingsShowReflection");

const solveSessionSelect = document.getElementById("solveSessionSelect");
const newSessionBtn = document.getElementById("newSessionBtn");
const renameSessionBtn = document.getElementById("renameSessionBtn");
const deleteSessionBtn = document.getElementById("deleteSessionBtn");
const solveTargetSelect = document.getElementById("solveTargetSelect");
const solveShowCubeToggle = document.getElementById("solveShowCubeToggle");
const solveInspectionToggle = document.getElementById("solveInspectionToggle");
const solveStatsBar = document.getElementById("solveStatsBar");
const solveSessionBadge = document.getElementById("solveSessionBadge");
const solveScrambleOrient = document.getElementById("solveScrambleOrient");
const layerStatsBar = document.getElementById("layerStatsBar");

// Multi-Puzzle & Multi-Track Elements
const puzzleSwitcher = document.getElementById("puzzleSwitcher");
const puzzleButtons = puzzleSwitcher ? Array.from(puzzleSwitcher.querySelectorAll(".puzzle-btn")) : [];
const trackBar = document.getElementById("trackBar");
const studyViewContainer = document.getElementById("studyViewContainer");
const practiceViewContainer = document.getElementById("practiceViewContainer");
const crossSolutionsWidget = document.getElementById("crossSolutionsWidget");
const crossSolutionsTitle = document.getElementById("crossSolutionsTitle");
const crossSolutionsBadge = document.getElementById("crossSolutionsBadge");
const crossSolutionsList = document.getElementById("crossSolutionsList");
const crossEoSummary = document.getElementById("crossEoSummary");

let studyView = null;
let practiceView = null;

// Simulation elements
const simulatePanel = document.getElementById("simulatePanel");
const simScrambleInput = document.getElementById("simScrambleInput");
const simClearBtn = document.getElementById("simClearBtn");
const simLoadBtn = document.getElementById("simLoadBtn");
const simUseCurrentBtn = document.getElementById("simUseCurrentBtn");
const simCaseSelect = document.getElementById("simCaseSelect");
const simScrambleSelectWrap = document.getElementById("simScrambleSelectWrap");
const simScrambleSelect = document.getElementById("simScrambleSelect");
const simAppendSolutionBtn = document.getElementById("simAppendSolutionBtn");
const simCaseDetails = document.getElementById("simCaseDetails");
const simPresetButtons = document.getElementById("simPresetButtons");
const simCaseTag = document.getElementById("simCaseTag");
const simSolutionTag = document.getElementById("simSolutionTag");
const simOrientTag = document.getElementById("simOrientTag");
const simErrorMsg = document.getElementById("simErrorMsg");
const simStatusBadge = document.getElementById("simStatusBadge");
const simBtnStart = document.getElementById("simBtnStart");
const simBtnPrev = document.getElementById("simBtnPrev");
const simBtnPlay = document.getElementById("simBtnPlay");
const simPlayIcon = document.getElementById("simPlayIcon");
const simPlayText = document.getElementById("simPlayText");
const simBtnNext = document.getElementById("simBtnNext");
const simBtnEnd = document.getElementById("simBtnEnd");
const simStepCounter = document.getElementById("simStepCounter");
const simMoveList = document.getElementById("simMoveList");
const simTimelineResetBtn = document.getElementById("simTimelineResetBtn");
const simSpeedButtons = Array.from(document.querySelectorAll(".sim-speed-btn"));

// Create scramble display element
let el = null;

function mountScrambleDisplay(puzzleId = currentPuzzle) {
  displayContainer.innerHTML = "";
  el = new ScrambleDisplay();
  el.player.hintFacelets = showReflection ? "floating" : "none";
  el.event = puzzleId === "333oh" ? "333" : puzzleId;
  el.visualization = "3D";
  applyReflection();
  displayContainer.appendChild(el);
  applyColorsTo3DCube(el);
  return el;
}

mountScrambleDisplay(currentPuzzle);
void ensure3x3FoundationOpaque();

let currentBaseDisplayScramble = "";

function clearViewRotations() {
  resetCubeOrientation();
}

function applyScrambleToDisplay(scrambleString) {
  currentBaseDisplayScramble = scrambleString || "";
  freeMoveBaseScramble = currentBaseDisplayScramble;
  userFreeMoves = [];
  updateFreeMovesUI();
  if (smartCube) {
    smartCube.setScramble(currentBaseDisplayScramble, currentPuzzle);
  }
  if (!el) return;
  el.scramble = currentBaseDisplayScramble;
  if (el.player) {
    try {
      el.player.pause();
      if (el.player.experimentalModel?.catchUpMove) {
        el.player.experimentalModel.catchUpMove.set({ move: null, amount: 0 });
      }
      el.player.jumpToEnd();
    } catch (e) {}
  }
  applyColorsTo3DCube(el);
}

async function resetCubeOrientation() {
  if (!el || !el.player) return;
  try {
    const p = await el.player.experimentalCurrentThreeJSPuzzleObject?.();
    if (p) {
      p.quaternion.set(0, 0, 0, 1);
      p.rotation.set(0, 0, 0);
      p.scheduleRenderCallback?.();
    }
  } catch (e) {}

  try {
    el.player.cameraLatitude = 35;
    el.player.cameraLongitude = 30;
    el.player.cameraDistance = 6;
  } catch (e) {}

  try {
    if (el.player.experimentalModel?.twistySceneModel?.orbitCoordinatesRequest) {
      el.player.experimentalModel.twistySceneModel.orbitCoordinatesRequest.set("auto");
    }
  } catch (e) {}
}

if (resetOrientationBtn) {
  resetOrientationBtn.addEventListener("click", resetCubeOrientation);
}

// ---------------------------------------------------------------------------
// Free Face Rotations & Move Tracking Controller
// ---------------------------------------------------------------------------

let userFreeMoves = [];
let freeMoveBaseScramble = "";

function invertMove(m) {
  if (!m) return "";
  m = m.trim();
  if (m.endsWith("2")) return m;
  if (m.endsWith("'")) return m.slice(0, -1);
  return m + "'";
}

function invertMoves(movesArr) {
  return movesArr.slice().reverse().map(invertMove);
}

function updateFreeMovesUI() {
  const countBadge = document.getElementById("freeMovesCountBadge");
  const undoBtn = document.getElementById("freeMoveUndoBtn");
  const reverseBtn = document.getElementById("freeMoveReverseBtn");
  const listEl = document.getElementById("freeMovesList");
  const wrapEl = document.getElementById("freeMovesHistoryWrap");
  const wideWrap = document.getElementById("freeMovesWideWrap") || document.getElementById("freeMovesWideRow");

  if (countBadge) {
    countBadge.textContent = `${userFreeMoves.length} turn${userFreeMoves.length === 1 ? '' : 's'}`;
  }
  if (undoBtn) undoBtn.disabled = userFreeMoves.length === 0;
  if (reverseBtn) reverseBtn.disabled = userFreeMoves.length === 0;

  if (wideWrap) {
    wideWrap.hidden = !(currentPuzzle === "444" || currentPuzzle === "555");
  }

  if (wrapEl && listEl) {
    wrapEl.hidden = false;
    if (userFreeMoves.length === 0) {
      listEl.innerHTML = '<span class="free-moves-empty">None</span>';
    } else {
      listEl.innerHTML = userFreeMoves.map((m, idx) => `
        <span class="free-move-chip" data-idx="${idx}">${escapeHtml(m)}</span>
      `).join(" ");
    }
  }
}

async function applyFreeMove(move) {
  if (!move || !el) return;
  userFreeMoves.push(move);
  updateFreeMovesUI();

  const fullSeq = [freeMoveBaseScramble, ...userFreeMoves].filter(Boolean).join(" ");
  el.scramble = fullSeq;
  try {
    el.player?.controller?.jumpToEnd?.({ flash: false }) || el.player?.jumpToEnd?.();
  } catch {}

  applyColorsTo3DCube(el);
  updateFreeMovesUI();

  if (mode === "simulate") {
    simStatusBadge.textContent = "Free Turns";
    simStatusBadge.className = "sim-badge badge-warning";
    simStepCounter.textContent = `Free face turns active (${userFreeMoves.length} turn${userFreeMoves.length === 1 ? '' : 's'} · click Reset Scramble to restore case)`;
    updateSimulateSolutions();
  }
}

function undoLastFreeMove() {
  if (!userFreeMoves.length) return;
  userFreeMoves.pop();
  if (userFreeMoves.length === 0) {
    resetFreeMovesToScramble();
    return;
  }
  const fullSeq = [freeMoveBaseScramble, ...userFreeMoves].filter(Boolean).join(" ");
  el.scramble = fullSeq;
  try {
    el.player?.controller?.jumpToEnd?.({ flash: false }) || el.player?.jumpToEnd?.();
  } catch {}
  applyColorsTo3DCube(el);
  updateFreeMovesUI();

  if (mode === "simulate") {
    simStatusBadge.textContent = "Free Turns";
    simStatusBadge.className = "sim-badge badge-warning";
    simStepCounter.textContent = `Free face turns active (${userFreeMoves.length} turn${userFreeMoves.length === 1 ? '' : 's'} · click Reset Scramble to restore case)`;
    updateSimulateSolutions();
  }
}

async function reverseAllFreeMoves() {
  if (!userFreeMoves.length) return;
  resetFreeMovesToScramble();
}

function updateSimulateSolutions() {
  if (mode !== "simulate") return;
  const seq = [freeMoveBaseScramble, ...userFreeMoves].filter(Boolean).join(" ").trim();
  if (currentPuzzle === "222") {
    updateLayerSolutions(seq);
  } else if (currentPuzzle === "333" || currentPuzzle === "333oh") {
    updateCrossSolutions(seq);
  }
}

function resetFreeMovesToScramble() {
  userFreeMoves = [];
  updateFreeMovesUI();
  if (mode === "simulate" && simHasSolutionAppended) {
    if (el && el.player) {
      try {
        el.player.pause();
        el.scramble = simMoves.join(" ");
        applyReflection();
        simJumpToCaseState();
      } catch {}
    }
  } else {
    el.scramble = freeMoveBaseScramble;
    try {
      el.player?.controller?.jumpToEnd?.({ flash: false }) || el.player?.jumpToEnd?.();
    } catch {}
  }
  applyColorsTo3DCube(el);
  updateSimulateSolutions();
}

function resetFreeMovesToSolved() {
  userFreeMoves = [];
  freeMoveBaseScramble = "";
  currentBaseDisplayScramble = "";
  updateFreeMovesUI();
  el.scramble = "";
  try {
    el.player?.controller?.jumpToEnd?.({ flash: false }) || el.player?.jumpToEnd?.();
  } catch {}
  applyColorsTo3DCube(el);

  if (mode === "simulate") {
    if (simScrambleInput) simScrambleInput.value = "";
    if (simCaseSelect) simCaseSelect.value = "";
    if (simScrambleSelectWrap) simScrambleSelectWrap.hidden = true;
    if (simCaseDetails) simCaseDetails.hidden = true;
    if (simErrorMsg) simErrorMsg.hidden = true;
    simOriginalScramble = "";
    simHasSolutionAppended = false;
    simExpectedCaseObj = null;
    simMoves = [];
    simCurrentStep = 0;
    if (simAppendSolutionBtn) {
      simAppendSolutionBtn.textContent = "Append Solution";
      simAppendSolutionBtn.classList.remove("active");
      simAppendSolutionBtn.disabled = true;
    }
    simRenderMoveList();
    if (simStatusBadge) {
      simStatusBadge.textContent = "Solved";
      simStatusBadge.className = "sim-badge";
    }
    if (simStepCounter) {
      simStepCounter.textContent = "Solved cube · ready for Free Turns";
    }
    updateSimulateSolutions();
  }
}

// Wire Free Moves keypad buttons
document.querySelectorAll(".btn-face-turn").forEach(btn => {
  btn.addEventListener("click", () => {
    const move = btn.dataset.move;
    if (move) applyFreeMove(move);
    btn.blur();
  });
});

const freeMoveUndoBtn = document.getElementById("freeMoveUndoBtn");
if (freeMoveUndoBtn) freeMoveUndoBtn.addEventListener("click", (e) => { e.stopPropagation(); e.preventDefault(); undoLastFreeMove(); });

const freeMoveReverseBtn = document.getElementById("freeMoveReverseBtn");
if (freeMoveReverseBtn) freeMoveReverseBtn.addEventListener("click", (e) => { e.stopPropagation(); e.preventDefault(); reverseAllFreeMoves(); });

const freeMoveResetScrambleBtn = document.getElementById("freeMoveResetScrambleBtn");
if (freeMoveResetScrambleBtn) freeMoveResetScrambleBtn.addEventListener("click", (e) => { e.stopPropagation(); e.preventDefault(); resetFreeMovesToScramble(); });

const freeMoveResetSolvedBtn = document.getElementById("freeMoveResetSolvedBtn");
if (freeMoveResetSolvedBtn) freeMoveResetSolvedBtn.addEventListener("click", (e) => { e.stopPropagation(); e.preventDefault(); resetFreeMovesToSolved(); });

// Keyboard shortcuts for face turns (U, D, L, R, F, B) when not typing in an input
window.addEventListener("keydown", e => {
  const activeEl = document.activeElement;
  const isInput = activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA" || activeEl.tagName === "SELECT");
  if (isInput) return;

  const key = e.key.toUpperCase();
  if (["U", "D", "L", "R", "F", "B"].includes(key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
    const move = e.shiftKey ? `${key}'` : key;
    applyFreeMove(move);
  } else if (e.key === "Backspace" && (e.ctrlKey || e.metaKey || userFreeMoves.length > 0)) {
    if (userFreeMoves.length > 0) {
      e.preventDefault();
      undoLastFreeMove();
    }
  }
});


// ---------------------------------------------------------------------------
// Multi-Puzzle & Multi-Track Navigation (2x2 / 3x3)
// ---------------------------------------------------------------------------

function ensureTrackSelection() {
  const track = getTrack(currentPuzzle, currentTrackId);
  if (!track || !track.cases || track.cases.length === 0) return;
  const trackIds = new Set(track.cases.map(c => c.id));
  const hasAny = [...selectedCases].some(id => trackIds.has(id));
  if (!hasAny) {
    selectedCases = new Set(trackIds);
  }
}

function renderTrackBar() {
  if (!trackBar) return;
  if (mode === "simulate") {
    trackBar.hidden = true;
    return;
  }
  trackBar.hidden = false;
  const pData = PUZZLES[currentPuzzle];
  if (!pData || !pData.tracks) {
    trackBar.innerHTML = "";
    return;
  }

  // In Solve mode, the track bar acts as a 1-click quick-selector for Solve Target
  // (including Full Solve, each track/case drill, and Timer & Handling Drill).
  if (mode === "solve") {
    let items = [];
    if (currentPuzzle === "333" || currentPuzzle === "333oh") {
      if (!["full", "timer-drill"].includes(solveTarget)) {
        solveTarget = "full";
      }
      items = [
        { id: "full", name: `Full Solve (${currentPuzzle === "333oh" ? "3x3 OH" : "3x3"})`, shortName: "Full Solve" },
        { id: "timer-drill", name: "⏱️ Timer & Handling Drill", shortName: "⏱️ Timer Drill" }
      ];
    } else if (currentPuzzle === "444" || currentPuzzle === "555") {
      if (!["full", "timer-drill"].includes(solveTarget)) {
        solveTarget = "full";
      }
      const pName = currentPuzzle === "444" ? "4x4" : "5x5";
      items = [
        { id: "full", name: `Full Solve (${pName})`, shortName: "Full Solve" },
        { id: "timer-drill", name: "⏱️ Timer & Handling Drill", shortName: "⏱️ Timer Drill" }
      ];
    } else {
      if (!["full", "cll", "layer", "face", "timer-drill"].includes(solveTarget)) {
        solveTarget = "full";
      }
      items = [
        { id: "full", name: "Full Solve (2x2)", shortName: "Full Solve" },
        { id: "cll", name: "CLL Case (40)", shortName: "CLL (40)" },
        { id: "layer", name: "1st Layer Only", shortName: "1st Layer" },
        { id: "face", name: "1st Face (Ortega)", shortName: "1st Face" },
        { id: "timer-drill", name: "⏱️ Timer & Handling Drill", shortName: "⏱️ Timer Drill" }
      ];
    }
    trackBar.innerHTML = items.map(item => {
      const active = item.id === solveTarget;
      return `<button type="button" class="track-btn ${active ? 'active' : ''}" data-solve-target="${item.id}" aria-pressed="${active}">
        <span class="track-btn-full">${item.name}</span>
        <span class="track-btn-short">${item.shortName || item.name}</span>
      </button>`;
    }).join("");

    trackBar.querySelectorAll(".track-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const tgt = btn.dataset.solveTarget;
        if (!tgt) return;
        solveTarget = tgt;
        if (solveTargetSelect) solveTargetSelect.value = solveTarget;
        getActiveSession().target = solveTarget;
        saveSessions();
        if (pData.tracks.some(t => t.id === tgt)) {
          currentTrackId = tgt;
          ensureTrackSelection();
          buildCasePicker();
          renderSelection();
        }
        saveSettings();
        renderTrackBar();
        renderStage();
        renderSolvePanel();
        updateStatsTable();
        regenerateScramble();
      });
    });
    return;
  }

  trackBar.innerHTML = pData.tracks.map(t => {
    const active = t.id === currentTrackId;
    return `<button type="button" class="track-btn ${active ? 'active' : ''}" data-track="${t.id}" aria-pressed="${active}">
      <span class="track-btn-full">${t.name}</span>
      <span class="track-btn-short">${t.shortName || t.name}</span>
    </button>`;
  }).join("");

  trackBar.querySelectorAll(".track-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      setTrack(btn.dataset.track);
    });
  });
}

function setTrack(trackId) {
  const pData = PUZZLES[currentPuzzle];
  if (!pData || !pData.tracks.some(t => t.id === trackId)) return;
  currentTrackId = trackId;

  ensureTrackSelection();
  buildCasePicker();
  renderSelection();

  if (studyView) studyView.setTrack(currentPuzzle, currentTrackId);
  if (practiceView) practiceView.setTrack(currentPuzzle, currentTrackId);

  saveSettings();
  if (mode === "solve") {
    if (trackId === "cross") solveTarget = "cross";
    else if (trackId === "layer") solveTarget = "layer";
    else if (trackId === "pll") solveTarget = "pll";
    else if (trackId === "oll") solveTarget = "oll";
    else if (trackId === "f2l") solveTarget = "f2l";
    else if (trackId === "cll") solveTarget = "cll";
    if (solveTargetSelect) solveTargetSelect.value = solveTarget;
    regenerateScramble();
  }
  renderTrackBar();
  updateStatsTable();
}

function populateSolveTargetSelect() {
  if (!solveTargetSelect) return;
  if (currentPuzzle === "333" || currentPuzzle === "333oh") {
    const isOh = currentPuzzle === "333oh";
    solveTargetSelect.innerHTML = `
      <option value="full">Full Solve (WCA ${isOh ? "3x3 OH" : "3x3"})</option>
      <option value="timer-drill">⏱️ Timer &amp; Handling Drill</option>
    `;
    if (!["full", "timer-drill"].includes(solveTarget)) {
      solveTarget = "full";
    }
  } else if (currentPuzzle === "444") {
    solveTargetSelect.innerHTML = `
      <option value="full">Full Solve (WCA 4x4)</option>
      <option value="timer-drill">⏱️ Timer &amp; Handling Drill</option>
    `;
    if (!["full", "timer-drill"].includes(solveTarget)) {
      solveTarget = "full";
    }
  } else if (currentPuzzle === "555") {
    solveTargetSelect.innerHTML = `
      <option value="full">Full Solve (WCA 5x5)</option>
      <option value="timer-drill">⏱️ Timer &amp; Handling Drill</option>
    `;
    if (!["full", "timer-drill"].includes(solveTarget)) {
      solveTarget = "full";
    }
  } else {
    solveTargetSelect.innerHTML = `
      <option value="full">Full Solve (WCA 2x2)</option>
      <option value="cll">CLL Case (40)</option>
      <option value="layer">1st Layer Only</option>
      <option value="face">1st Face Only (Ortega)</option>
      <option value="timer-drill">⏱️ Timer &amp; Handling Drill</option>
    `;
    if (!["full", "cll", "layer", "face", "timer-drill"].includes(solveTarget)) {
      solveTarget = "full";
    }
  }
  solveTargetSelect.value = solveTarget;
  if (solveScrambleOrient) {
    solveScrambleOrient.textContent = currentPuzzle === "222" ? "(white on bottom)" : "(white on top, green on front)";
  }
}

function setPuzzle(puzzleId) {
  if (!VALID_PUZZLES.includes(puzzleId)) return;
  currentPuzzle = puzzleId;
  mountScrambleDisplay(currentPuzzle);

  puzzleButtons.forEach(btn => {
    const active = btn.dataset.puzzle === currentPuzzle;
    btn.classList.toggle("active", active);
    btn.setAttribute("aria-pressed", String(active));
  });

  if (pblOverviewBtn) pblOverviewBtn.hidden = currentPuzzle !== "222";
  if (overviewBtn) overviewBtn.hidden = currentPuzzle !== "222";

  const pDef = PUZZLES[currentPuzzle];
  currentTrackId = pDef?.defaultTrack || (currentPuzzle === "222" ? "cll" : (currentPuzzle === "444" || currentPuzzle === "555" ? "parity" : "pll"));

  renderTrackBar();
  populateSolveTargetSelect();

  let matchingSessions = sessions.filter(s => (s.puzzle || "222") === currentPuzzle);
  if (matchingSessions.length === 0) {
    const defaultName = pDef?.shortName ? `${pDef.shortName} Main` : `${currentPuzzle} Main`;
    const newSess = {
      id: `session-${currentPuzzle}-${Date.now()}`,
      puzzle: currentPuzzle,
      name: defaultName,
      target: "full",
      inspection: true,
      showCube: true,
      solves: []
    };
    sessions.push(newSess);
    matchingSessions = [newSess];
    saveSessions();
  }
  activeSessionId = matchingSessions[0].id;
  solves = getActiveSession().solves || [];
  lastSolve = solves.length ? solves[solves.length - 1] : null;
  solveTarget = getActiveSession().target || "full";
  solveShowCube = getActiveSession().showCube ?? true;
  solveInspection = getActiveSession().inspection ?? true;

  populateSessionSelect();
  ensureTrackSelection();
  buildCasePicker();
  renderSelection();
  populateSimCaseSelect();

  if (studyView) studyView.setTrack(currentPuzzle, currentTrackId);
  if (practiceView) practiceView.setTrack(currentPuzzle, currentTrackId);

  updateFreeMovesUI();
  saveSettings();
  renderStage();
  renderSolvePanel();
  updateBluetoothUI();
  regenerateScramble();
}

puzzleButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    const puzzle = btn.dataset.puzzle;
    if (puzzle && puzzle !== currentPuzzle) {
      setPuzzle(puzzle);
    }
  });
});

// ---------------------------------------------------------------------------
// Case picker: one row per group, a group button plus one chip per case
// ---------------------------------------------------------------------------

function getCaseShortLabel(caseObj, track) {
  if (!caseObj) return "";
  if (caseObj.shortName) return caseObj.shortName;

  const id = caseObj.id || "";
  if (id.startsWith("555-edge-parity")) return "Middle Flip";
  if (id.startsWith("555-wing-swap")) return "Wing Swap";
  if (id.startsWith("444-oll-parity")) return "OLL Parity";
  if (id.startsWith("444-pll-parity-opp")) return "Opposite";
  if (id.startsWith("444-pll-parity-adj")) return "Adjacent";

  if (track && track.id === "pll") {
    return id.replace(/^pll-/, "");
  }
  if (track && track.id === "oll") {
    return id.replace(/^oll-/, "");
  }
  if (track && track.id === "f2l") {
    return id.replace(/^f2l-/, "");
  }

  if (caseObj.name && caseObj.name.length <= 14) {
    return caseObj.name;
  }
  return id.replace(/^[0-9]{3}-/, "").replace(/^[a-z0-9]+-/, "");
}

function buildCasePicker() {
  casePicker.innerHTML = "";
  ensureTrackSelection();

  if (currentPuzzle !== "222" || currentTrackId !== "cll") {
    const track = getTrack(currentPuzzle, currentTrackId);
    if (!track || !track.cases || track.cases.length === 0) {
      casePicker.innerHTML = `<p class="hint" style="padding: 10px 0;">This track (${track ? track.name : ''}) focuses on cross planning &amp; EO rather than discrete case recognition.</p>`;
      renderSelection();
      return;
    }
    const groups = track.groups || ["All"];
    groups.forEach(group => {
      const casesInGroup = track.cases.filter(c => c.group === group);
      if (casesInGroup.length === 0) return;

      const row = document.createElement("div");
      row.className = "case-row";

      const groupBtn = document.createElement("button");
      groupBtn.type = "button";
      groupBtn.className = "group-toggle";
      groupBtn.dataset.group = group;
      groupBtn.textContent = group.length > 15 ? group.slice(0, 14) + "…" : group;
      groupBtn.title = `Add or remove all ${group} cases`;
      groupBtn.setAttribute("aria-label", `Group ${group}: add or remove all cases`);
      groupBtn.addEventListener("click", () => toggleGroup(group));
      row.appendChild(groupBtn);

      const show3x3ChipSvg = (currentPuzzle === "333" || currentPuzzle === "333oh") &&
        (track.id === "f2l" || track.id === "oll" || track.id === "pll");

      casesInGroup.forEach(caseObj => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = show3x3ChipSvg ? "case-chip case-chip-with-svg" : "case-chip";
        chip.dataset.case = caseObj.id;
        const tag = getCaseTag(caseObj.id);
        const shortLabel = getCaseShortLabel(caseObj, track);
        if (show3x3ChipSvg) {
          const cachedSvg = getCachedCaseSvg("333", track.id, caseObj.id);
          chip.innerHTML = `<span class="case-chip-svg" aria-hidden="true">${cachedSvg}</span><span class="case-chip-label">${escapeHtml(shortLabel)}</span><span class="case-chip-dot tag-dot-${tag}"></span>`;
          if (!cachedSvg) {
            renderCaseSvg("333", track.id, caseObj).then(svg => {
              const svgWrap = chip.querySelector(".case-chip-svg");
              if (svgWrap && chip.isConnected && svg) {
                svgWrap.innerHTML = svg;
              }
            });
          }
        } else {
          chip.innerHTML = `${shortLabel}<span class="case-chip-dot tag-dot-${tag}"></span>`;
        }
        chip.title = `Case ${caseObj.name || caseObj.id} (${formatCaseTagLabel(tag)}) · Click to toggle practice, Right-click to change tag`;
        chip.setAttribute("aria-label", `Case ${caseObj.id}`);
        chip.addEventListener("click", () => toggleCase(caseObj.id));
        chip.addEventListener("contextmenu", e => {
          e.preventDefault();
          cycleCaseTag(caseObj.id);
        });
        row.appendChild(chip);
      });

      casePicker.appendChild(row);
    });
    renderSelection();
    updateCasePickerFilter();
    return;
  }

  GROUP_DISPLAY_ORDER.forEach(group => {
    const row = document.createElement("div");
    row.className = "case-row";

    const groupBtn = document.createElement("button");
    groupBtn.type = "button";
    groupBtn.className = "group-toggle";
    groupBtn.dataset.group = group;
    groupBtn.textContent = group;
    groupBtn.title = `Add or remove all ${group} cases`;
    groupBtn.setAttribute("aria-label", `Group ${group}: add or remove all cases`);
    groupBtn.addEventListener("click", () => toggleGroup(group));
    row.appendChild(groupBtn);

    casesByGroup[group].forEach(caseObj => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "case-chip";
      chip.dataset.case = caseObj.id;
      const tag = getCaseTag(caseObj.id);
      chip.innerHTML = `${caseObj.id.slice(group.length)}<span class="case-chip-dot tag-dot-${tag}"></span>`;
      chip.title = `Case ${caseObj.id} (${formatCaseTagLabel(tag)}) · Click to toggle practice, Right-click to change tag`;
      chip.setAttribute("aria-label", `Case ${caseObj.id}`);
      chip.addEventListener("click", () => toggleCase(caseObj.id));
      chip.addEventListener("contextmenu", e => {
        e.preventDefault();
        cycleCaseTag(caseObj.id);
      });
      row.appendChild(chip);
    });

    casePicker.appendChild(row);
  });
  renderSelection();
  updateCasePickerFilter();
}

function updateCasePickerTags() {
  casePicker.querySelectorAll(".case-chip").forEach(chip => {
    const id = chip.dataset.case;
    const tag = getCaseTag(id);
    let dot = chip.querySelector(".case-chip-dot");
    if (!dot) {
      dot = document.createElement("span");
      dot.className = "case-chip-dot";
      chip.appendChild(dot);
    }
    dot.className = `case-chip-dot tag-dot-${tag}`;
    chip.title = `Case ${id} (${formatCaseTagLabel(tag)}) · Click to toggle practice, Right-click to change tag`;
  });
  updateCasePickerFilter();
}

function updateCasePickerFilter() {
  casePicker.querySelectorAll(".case-chip").forEach(chip => {
    const id = chip.dataset.case;
    const tag = getCaseTag(id);
    const matches = currentTagFilter === "all" || tag === currentTagFilter;
    chip.style.opacity = matches ? "1" : "0.25";
  });
}

document.querySelectorAll(".tag-filter-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    currentTagFilter = btn.dataset.tagFilter;
    document.querySelectorAll(".tag-filter-btn").forEach(b => b.classList.toggle("active", b === btn));
    updateCasePickerFilter();
    renderSelection();
  });
});

function getCasesInGroup(group) {
  if (currentPuzzle === "222" && currentTrackId === "cll") {
    if (casesByGroup[group]) return casesByGroup[group];
    const track = getTrack("222", "cll");
    return track?.cases?.filter(c => c.group === group || c.group === `${group}-Group` || c.id.startsWith(group)) || [];
  }
  const track = getTrack(currentPuzzle, currentTrackId);
  if (!track || !track.cases) return casesByGroup[group] || [];
  return track.cases.filter(c => c.group === group || c.group === `${group}-Group` || (group && group.length === 1 && c.group && c.group.startsWith(group)));
}

function renderSelection() {
  const track = getTrack(currentPuzzle, currentTrackId);
  const totalCases = track && track.cases.length > 0 ? track.cases.length : CASE_IDS.length;
  const activeCount = track && track.cases.length > 0
    ? track.cases.filter(c => selectedCases.has(c.id)).length
    : selectedCases.size;
  selectionCount.textContent = `${activeCount} / ${totalCases} cases`;
  const casesPanelTitle = document.getElementById("casesPanelTitle");
  if (casesPanelTitle) {
    const tShort = track?.shortName || currentTrackId.toUpperCase();
    casesPanelTitle.textContent = `Active Cases (${tShort})`;
  }

  casePicker.querySelectorAll(".case-chip").forEach(chip => {
    chip.setAttribute("aria-pressed", String(selectedCases.has(chip.dataset.case)));
  });

  casePicker.querySelectorAll(".group-toggle").forEach(btn => {
    const group = btn.dataset.group;
    const casesInGroup = getCasesInGroup(group);
    let ids = casesInGroup.map(c => c.id);
    if (currentTagFilter !== "all") {
      const matching = ids.filter(id => getCaseTag(id) === currentTagFilter);
      if (matching.length > 0) ids = matching;
    }
    const selected = ids.filter(id => selectedCases.has(id)).length;
    const state = selected === 0 ? "none" : selected === ids.length ? "all" : "some";
    btn.dataset.state = state;
    btn.setAttribute("aria-pressed", state === "all" ? "true" : state === "none" ? "false" : "mixed");
  });

  if (typeof cubeCard !== "undefined" && cubeCard && (mode === "practice" || mode === "study")) {
    const hasActiveCases = activeCount > 0;
    const hideCubeInStudy = mode === "study";
    cubeCard.hidden = hideCubeInStudy || !hasActiveCases;
    if (typeof emptyState !== "undefined" && emptyState) {
      emptyState.hidden = hasActiveCases;
    }
    if (typeof resetOrientationBtn !== "undefined" && resetOrientationBtn) {
      resetOrientationBtn.hidden = cubeCard.hidden;
    }
  }

  if (typeof studyView !== "undefined" && studyView && mode === "study") {
    studyView.render();
  }
}

function setSelection(next) {
  selectedCases = next;
  for (const id in caseAppearances) {
    if (!selectedCases.has(id)) {
      delete caseAppearances[id];
    }
  }
  saveCaseAppearances();
  renderSelection();
  saveSettings();
  regenerateScramble();
}

function toggleGroup(group) {
  const casesInGroup = getCasesInGroup(group);
  let ids = casesInGroup.map(c => c.id);
  if (ids.length === 0) return;

  if (currentTagFilter !== "all") {
    const matching = ids.filter(id => getCaseTag(id) === currentTagFilter);
    if (matching.length > 0) ids = matching;
  }

  const allSelected = ids.every(id => selectedCases.has(id));
  const next = new Set(selectedCases);
  ids.forEach(id => (allSelected ? next.delete(id) : next.add(id)));
  setSelection(next);
}

function toggleCase(id) {
  if (caseTagMode) {
    cycleCaseTag(id);
    return;
  }
  const next = new Set(selectedCases);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  setSelection(next);
}

const caseTagModeBtn = document.getElementById("caseTagModeBtn");
if (caseTagModeBtn) {
  caseTagModeBtn.addEventListener("click", () => {
    caseTagMode = !caseTagMode;
    caseTagModeBtn.classList.toggle("active", caseTagMode);
    caseTagModeBtn.setAttribute("aria-pressed", String(caseTagMode));
    caseTagModeBtn.textContent = caseTagMode ? "🏷️ Tag Mode: ON" : "🏷️ Tag Mode: Off";
    settingsPanel?.classList.toggle("tag-mode-active", caseTagMode);
  });
}

document.getElementById("addAllBtn").addEventListener("click", () => {
  const track = getTrack(currentPuzzle, currentTrackId);
  const allIds = track && track.cases.length > 0 ? track.cases.map(c => c.id) : CASE_IDS;
  if (currentTagFilter === "all") {
    setSelection(new Set(allIds));
  } else {
    const matching = allIds.filter(id => getCaseTag(id) === currentTagFilter);
    const next = new Set(selectedCases);
    matching.forEach(id => next.add(id));
    setSelection(next);
  }
});

document.getElementById("clearAllBtn").addEventListener("click", () => {
  const track = getTrack(currentPuzzle, currentTrackId);
  const allIds = track && track.cases.length > 0 ? track.cases.map(c => c.id) : CASE_IDS;
  if (currentTagFilter === "all") {
    setSelection(new Set());
  } else {
    const matching = allIds.filter(id => getCaseTag(id) === currentTagFilter);
    const next = new Set(selectedCases);
    matching.forEach(id => next.delete(id));
    setSelection(next);
  }
});

// ---------------------------------------------------------------------------
// Collapsible settings (all screen sizes)
// ---------------------------------------------------------------------------

function syncSettingsPanel() {
  settingsPanel.classList.toggle("collapsed", settingsCollapsed);
  settingsToggle.setAttribute("aria-expanded", String(!settingsCollapsed));
  settingsToggle.tabIndex = 0;
  document.querySelector(".app")?.classList.toggle("cases-collapsed", settingsCollapsed);
}

settingsToggle.addEventListener("click", () => {
  settingsCollapsed = !settingsCollapsed;
  syncSettingsPanel();
  saveSettings();
});

// ---------------------------------------------------------------------------
// Options
// ---------------------------------------------------------------------------

function applyTheme() {
  if (darkMode) {
    document.documentElement.setAttribute("data-theme", "dark");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
  const themeToggleBtn = document.getElementById("themeToggleBtn");
  if (themeToggleBtn) {
    themeToggleBtn.innerHTML = darkMode ? "☀️ Light" : "🌙 Dark";
    themeToggleBtn.setAttribute("title", darkMode ? "Switch to Light Theme" : "Switch to Dark Theme");
  }
  const toggleDark = document.getElementById("toggleDarkMode");
  if (toggleDark) {
    toggleDark.setAttribute("aria-pressed", String(darkMode));
  }
}

function setDarkMode(enabled) {
  darkMode = !!enabled;
  applyTheme();
  saveSettings();
}

function renderToggles() {
  document.getElementById("toggleDarkMode")?.setAttribute("aria-pressed", String(darkMode));
  document.getElementById("toggleAlwaysWhiteBottom")?.setAttribute("aria-pressed", String(alwaysWhiteBottom));
  document.getElementById("toggleAllowAUF")?.setAttribute("aria-pressed", String(allowAUF));
  document.getElementById("toggleShowReflection")?.setAttribute("aria-pressed", String(showReflection));
  if (settingsDarkTheme) settingsDarkTheme.checked = darkMode;
  if (settingsAlwaysWhiteBottom) settingsAlwaysWhiteBottom.checked = alwaysWhiteBottom;
  if (settingsAllowAUF) settingsAllowAUF.checked = allowAUF;
  if (settingsShowReflection) settingsShowReflection.checked = showReflection;
}

function applyReflection() {
  if (!el || !el.player) return;
  try {
    el.player.hintFacelets = showReflection ? "floating" : "none";
    el.player.experimentalCurrentThreeJSPuzzleObject?.().then(p => {
      if (p && typeof p.updateMaterialArrays === "function") {
        p.updateMaterialArrays();
        p.scheduleRenderCallback?.();
      }
      applyColorsTo3DCube(el);
    }).catch(() => {});
  } catch (err) {
    console.warn("Could not update reflection facelets:", err);
  }
  if (typeof studyView !== "undefined" && studyView) {
    studyView.applyReflection();
  }
}

const themeToggleBtn = document.getElementById("themeToggleBtn");
if (themeToggleBtn) {
  themeToggleBtn.addEventListener("click", () => {
    setDarkMode(!darkMode);
  });
}

document.querySelectorAll(".switch").forEach(btn => {
  btn.addEventListener("click", () => {
    const key = btn.dataset.toggle;
    if (key === "darkMode") {
      setDarkMode(!darkMode);
      return;
    }
    if (key === "alwaysWhiteBottom") {
      alwaysWhiteBottom = !alwaysWhiteBottom;
    } else if (key === "allowAUF") {
      allowAUF = !allowAUF;
    } else if (key === "showReflection") {
      showReflection = !showReflection;
      applyReflection();
    }
    renderToggles();
    saveSettings();
    if (key !== "showReflection") {
      regenerateScramble();
    }
  });
});

// ---------------------------------------------------------------------------
// Scramble generation
// ---------------------------------------------------------------------------

function getPerformanceMultipliers(ids) {
  const caseSolves = new Map();
  for (const s of solves) {
    if (!caseSolves.has(s.id)) caseSolves.set(s.id, []);
    caseSolves.get(s.id).push(s.ms);
  }

  const list = ids.map(id => {
    const times = caseSolves.get(id);
    if (!times || times.length === 0) {
      return { id, median: null, mean: null };
    }
    const attempts = times.length;
    const mean = times.reduce((sum, t) => sum + t, 0) / attempts;
    const sorted = [...times].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    return { id, median, mean };
  });

  function compareCasesByPerformance(a, b) {
    // Cases without recorded times are considered unmastered / top priority
    if (a.median == null && b.median == null) return 0;
    if (a.median == null) return -1;
    if (b.median == null) return 1;

    const medDiff = Math.abs(a.median - b.median);
    const avgMed = (a.median + b.median) / 2;
    // Similar medians: within 50ms or 3%
    const isSimilarMedian = medDiff <= Math.max(50, avgMed * 0.03);

    if (isSimilarMedian) {
      // Between similar medians, worse mean (greater times) is preferred
      if (a.mean !== b.mean) {
        return b.mean - a.mean;
      }
    }
    // Worse median (higher times) is preferred
    return b.median - a.median;
  }

  list.sort(compareCasesByPerformance);

  const n = list.length;
  const multipliers = {};
  if (n <= 1) {
    ids.forEach(id => { multipliers[id] = 1.0; });
    return multipliers;
  }

  // Assign multipliers from 2.0 (worst performance) down to 0.5 (best performance),
  // handling ties with equal rank
  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && compareCasesByPerformance(list[i], list[j + 1]) === 0) {
      j++;
    }
    const avgRank = (i + j) / 2;
    const t = avgRank / (n - 1);
    const mult = 2.0 - 1.5 * t;
    for (let k = i; k <= j; k++) {
      multipliers[list[k].id] = mult;
    }
    i = j + 1;
  }

  return multipliers;
}

function getRandomCase() {
  if (selectedCases.size === 0) return null;
  const ids = [...selectedCases];
  if (ids.length === 1) return ids[0];

  // Find the minimum appearance count among currently selected cases
  let minCount = Infinity;
  for (const id of ids) {
    const count = caseAppearances[id] || 0;
    if (count < minCount) minCount = count;
  }
  if (!Number.isFinite(minCount)) minCount = 0;

  // Normalize so the least-appeared case(s) have count 0
  if (minCount > 0) {
    for (const id of ids) {
      caseAppearances[id] = (caseAppearances[id] || 0) - minCount;
    }
    minCount = 0;
  }

  // Performance multipliers: amongst cases with similar number of attempts,
  // cases with worse median (higher times) are preferred; between similar medians,
  // worse mean (greater times) is preferred.
  const perfMultipliers = getPerformanceMultipliers(ids);

  // Weight each case:
  // 1. Attempts: 5^-delta biases strongly toward under-represented cases so appearances stay mostly even
  // 2. Performance: Amongst similar attempts, worse median and worse mean receive higher multipliers
  const weights = [];
  let totalWeight = 0;
  for (const id of ids) {
    const delta = (caseAppearances[id] || 0) - minCount;
    const attemptWeight = Math.pow(5, -delta);
    const perfMult = perfMultipliers[id] || 1.0;
    const w = attemptWeight * perfMult;
    weights.push(w);
    totalWeight += w;
  }

  let r = Math.random() * totalWeight;
  let chosenId = ids[ids.length - 1];
  for (let i = 0; i < ids.length; i++) {
    r -= weights[i];
    if (r <= 0) {
      chosenId = ids[i];
      break;
    }
  }

  caseAppearances[chosenId] = (caseAppearances[chosenId] || 0) + 1;
  saveCaseAppearances();
  return chosenId;
}

function randomU() {
  const choices = ["", " U", " U2", " U'"];
  return choices[Math.floor(Math.random() * choices.length)];
}

function buildScramble() {
  let orientation = "";
  if (alwaysWhiteBottom || mode === "study") {
    orientation = "z2";
  } else {
    const rot = (axis, turns) => {
      if (turns === 1) return ` ${axis}`;
      if (turns === 2) return ` ${axis}2`;
      if (turns === 3) return ` ${axis}'`;
      return "";
    };
    orientation = `${rot("x", Math.floor(Math.random() * 4))}${rot("y", Math.floor(Math.random() * 4))}${rot("z", Math.floor(Math.random() * 4))}`.trim();
  }

  let moves = "";

  // Optional U turn before the case (changes which side the case "faces")
  // In Study mode, omit AUF so the case always appears in its standard canonical orientation matching the solution alg and diagram
  if (allowAUF && mode !== "study") {
    moves += randomU();
  }

  const randomCase = getRandomCase();
  const track = getTrack(currentPuzzle, currentTrackId);
  const caseObj = randomCase ? (track?.caseById.get(randomCase) || caseById.get(randomCase)) : null;
  if (caseObj) {
    currentCaseId = caseObj.id;
    const caseScrambles = caseObj.scrambles && caseObj.scrambles.length ? caseObj.scrambles : [caseObj.setup || caseObj.scramble];
    currentCaseScramble = caseScrambles[Math.floor(Math.random() * caseScrambles.length)];
    moves += " " + currentCaseScramble;

    // Make sure the case has a stats entry, but do not count it as shown yet
    if (!stats[currentCaseId]) stats[currentCaseId] = { shown: 0, correct: 0 };
  } else {
    currentCaseId = null;
    currentCaseScramble = null;
  }

  // Optional AUF after the case
  if (allowAUF && mode !== "study") {
    moves += randomU();
  }

  scrambleMoves = cleanAlg(moves);
  scramble = `${orientation.trim()} ${scrambleMoves}`.trim();
  return scramble;
}

// ---------------------------------------------------------------------------
// Smart Cube Scramble Assistant & Flow Management
// ---------------------------------------------------------------------------

function clearScrambleCorrectionDelay() {
  if (scrambleCorrectionDelayTimer) {
    clearTimeout(scrambleCorrectionDelayTimer);
    scrambleCorrectionDelayTimer = null;
  }
  scrambleSuppressTransient = false;
  scrambleErrorVisible = false;
}

const TIMER_DRILL_PRESETS = {
  "righty-inv": {
    id: "righty-inv",
    name: "Righty + Inv Righty",
    display: "(R U R' U') (U R U' R')",
    moves: "R U R' U' U R U' R'",
    expectedMoves: 8
  },
  "lefty-inv": {
    id: "lefty-inv",
    name: "Lefty + Inv Lefty",
    display: "(L' U' L U) (U' L' U L)",
    moves: "L' U' L U U' L' U L",
    expectedMoves: 8
  },
  "double-righty-inv": {
    id: "double-righty-inv",
    name: "2× Righty + 2× Inv Righty",
    display: "(R U R' U')2 (U R U' R')2",
    moves: "R U R' U' R U R' U' U R U' R' U R U' R'",
    expectedMoves: 16
  },
  "quick-rr": {
    id: "quick-rr",
    name: "Pure Pickup / Putdown (R R')",
    display: "R R'",
    moves: "R R'",
    expectedMoves: 2
  }
};

function getActiveTimerDrillPreset() {
  return TIMER_DRILL_PRESETS[timerDrillPreset] || TIMER_DRILL_PRESETS["righty-inv"];
}

function renderTimerDrillBanner() {
  const banner = document.getElementById("timerDrillBanner");
  const presetSelect = document.getElementById("timerDrillPresetSelect");
  const metricsBar = document.getElementById("timerDrillMetricsBar");
  if (!banner) return;
  const isDrill = mode === "solve" && solveTarget === "timer-drill";
  banner.hidden = !isDrill;
  if (!isDrill) return;

  if (presetSelect) {
    presetSelect.value = timerDrillPreset;
  }
  if (!metricsBar) return;

  const drillSolves = (solves || []).filter(s => s && s.target === "timer-drill" && s.penalty !== "DNF");
  const pool = drillSolves.length ? drillSolves : solves;
  const lastDrill = drillSolves.length ? drillSolves[drillSolves.length - 1] : lastSolve;
  const medPickup = medianPhase(pool, "pickupMs");
  const trimPickup = trimMeanPhase(pool, "pickupMs");
  const avgPickup = averagePhase(pool, "pickupMs");
  const medCube = medianPhase(pool, "cubeMs");
  const trimCube = trimMeanPhase(pool, "cubeMs");
  const avgCube = averagePhase(pool, "cubeMs");
  const medPutdown = medianPhase(pool, "putdownMs");
  const trimPutdown = trimMeanPhase(pool, "putdownMs");
  const avgPutdown = averagePhase(pool, "putdownMs");
  const lastHandling = (lastDrill && lastDrill.pickupMs != null && lastDrill.putdownMs != null)
    ? (lastDrill.pickupMs + lastDrill.putdownMs)
    : null;
  const medHandling = (medPickup != null && medPutdown != null) ? (medPickup + medPutdown) : null;
  const trimHandling = (trimPickup != null && trimPutdown != null) ? (trimPickup + trimPutdown) : null;
  const avgHandling = (avgPickup != null && avgPutdown != null) ? (avgPickup + avgPutdown) : null;

  const fmtSub = (med, trim, avg) =>
    `Med: ${med != null ? formatCfopSplitMs(med) : '-'} · Trim: ${trim != null ? formatCfopSplitMs(trim) : '-'} · Mean: ${avg != null ? formatCfopSplitMs(avg) : '-'}`;

  metricsBar.innerHTML = `
    <div class="timer-drill-kpi">
      <span class="timer-drill-kpi-lbl">Pick-up (Timer → 1st Turn)</span>
      <strong class="timer-drill-kpi-val">${lastDrill?.pickupMs != null ? formatCfopSplitMs(lastDrill.pickupMs) : '-'}</strong>
      <small class="timer-drill-kpi-sub">${fmtSub(medPickup, trimPickup, avgPickup)}</small>
    </div>
    <div class="timer-drill-kpi">
      <span class="timer-drill-kpi-lbl">Trigger Exec</span>
      <strong class="timer-drill-kpi-val">${lastDrill?.cubeMs != null ? formatCfopSplitMs(lastDrill.cubeMs) : (lastDrill?.ms != null ? formatCfopSplitMs(lastDrill.ms) : '-')}</strong>
      <small class="timer-drill-kpi-sub">${fmtSub(medCube, trimCube, avgCube)}</small>
    </div>
    <div class="timer-drill-kpi">
      <span class="timer-drill-kpi-lbl">Put-down (Solved → Stop)</span>
      <strong class="timer-drill-kpi-val">${lastDrill?.putdownMs != null ? formatCfopSplitMs(lastDrill.putdownMs) : '-'}</strong>
      <small class="timer-drill-kpi-sub">${fmtSub(medPutdown, trimPutdown, avgPutdown)}</small>
    </div>
    <div class="timer-drill-kpi timer-drill-kpi-accent">
      <span class="timer-drill-kpi-lbl">Total Handling (Pick-up + Put-down)</span>
      <strong class="timer-drill-kpi-val">${lastHandling != null ? formatCfopSplitMs(lastHandling) : '-'}</strong>
      <small class="timer-drill-kpi-sub">${fmtSub(medHandling, trimHandling, avgHandling)}</small>
    </div>
  `;
}

const timerDrillPresetSelectEl = document.getElementById("timerDrillPresetSelect");
if (timerDrillPresetSelectEl) {
  timerDrillPresetSelectEl.addEventListener("change", () => {
    const val = timerDrillPresetSelectEl.value;
    if (TIMER_DRILL_PRESETS[val]) {
      timerDrillPreset = val;
      saveSettings();
      if (mode === "solve" && solveTarget === "timer-drill") {
        regenerateScramble();
      }
    }
  });
}

function updateSolveScrambleDisplay(scrambleStr) {
  currentSolveScramble = scrambleStr || "";
  scrambleMoves = currentSolveScramble;
  scramble = currentSolveScramble;
  clearScrambleCorrectionDelay();

  const st = smartCube.getStatus();
  if (solveTarget === "timer-drill") {
    const preset = getActiveTimerDrillPreset();
    if (st.connected) {
      smartCube.setScramble("", currentPuzzle);
      scrambleTracker.reset("");
      scrambleTracker.markComplete();
      smartCubeStage = solveInspection ? "inspecting" : "ready";
      if (solveScrambleText) {
        solveScrambleText.innerHTML = `<span class="scramble-completed-badge">✓ Solved Cube Ready</span> <span class="timer-drill-seq">${escapeHtml(preset.display)}</span>`;
      }
      updateSmartCubeIndicator();
    } else if (solveScrambleText) {
      solveScrambleText.textContent = preset.display;
    }
    renderTimerDrillBanner();
    return;
  }

  if (st.connected) {
    smartCubeStage = "scrambling";
    smartCube.setScramble("", currentPuzzle);
    scrambleTracker.reset(currentSolveScramble);
    smartCube.logDiag("SCRAMBLE_INIT", { scramble: currentSolveScramble });
    if (solveScrambleText) {
      solveScrambleText.innerHTML = scrambleTracker.getHtml();
    }
    updateSmartCubeIndicator();
  } else {
    if (solveScrambleText) {
      solveScrambleText.textContent = currentSolveScramble;
    }
  }
  renderTimerDrillBanner();
}

function renderSmartScrambleAssistant() {
  const st = smartCube.getStatus();
  if (!st.connected) return;

  if (solveScrambleText) {
    solveScrambleText.innerHTML = scrambleTracker.getHtml({
      suppressError: scrambleSuppressTransient,
      suppressSubAmount: scrambleSuppressTransient
    });
  }
  updateSmartCubeIndicator();
}

function onSmartScrambleCompleted() {
  clearScrambleCorrectionDelay();
  resetTimerPhaseTracking();
  trackedSolveMoves = [];
  scrambleTracker.markComplete();
  smartCube.logDiag("SCRAMBLE_COMPLETE", { scramble: currentSolveScramble });
  smartCube.setScramble(currentSolveScramble, currentPuzzle);
  playScrambleCompleteChime();
  renderSmartScrambleAssistant();

  if (solveInspection) {
    smartCubeStage = "inspecting";
    startSolveInspection();
  } else {
    smartCubeStage = "ready";
    solveState = "idle";
    updateSmartCubeIndicator();
  }
}

function updateDiagnosticsUI() {
  const isRec = Boolean(smartCube.diagRecording);
  const count = isRec ? smartCube.diagLogs.length : smartCube.rollingLogs.length;
  if (btDiagCountBadge) {
    btDiagCountBadge.textContent = `${count} event${count === 1 ? '' : 's'}${isRec ? ' (recording)' : ' (rolling)'}`;
  }
  if (btDiagToggleBtn) {
    btDiagToggleBtn.textContent = isRec ? "⏹ Stop Recording" : "⏺ Start Recording";
    btDiagToggleBtn.classList.toggle("btn-danger", isRec);
    btDiagToggleBtn.classList.toggle("btn-primary", !isRec);
  }
  if (smartCubeDiagToggleBtn) {
    smartCubeDiagToggleBtn.textContent = isRec ? `⏹ Stop Log (${count})` : "⏺ Diag Log";
    smartCubeDiagToggleBtn.classList.toggle("diag-recording-active", isRec);
  }
}

function getDiagnosticsExtraContext() {
  return {
    currentPuzzle,
    solveTarget,
    smartCubeStage,
    solveState,
    currentSolveScramble,
    scrambleTrackerStatus: scrambleTracker.getStatus()
  };
}

function copyDiagnosticsToClipboard(triggerBtn) {
  const json = smartCube.exportDiagnosticsReport(getDiagnosticsExtraContext());
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(json).then(() => {
      if (triggerBtn) {
        const orig = triggerBtn.textContent;
        triggerBtn.textContent = "✓ Copied!";
        setTimeout(() => { triggerBtn.textContent = orig; updateDiagnosticsUI(); }, 1800);
      }
    }).catch(() => {
      prompt("Copy Smart Cube Diagnostics JSON:", json);
    });
  } else {
    prompt("Copy Smart Cube Diagnostics JSON:", json);
  }
}

function downloadDiagnosticsJson() {
  const json = smartCube.exportDiagnosticsReport(getDiagnosticsExtraContext());
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `smartcube-diag-${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function updateSmartCubeIndicator() {
  updateDiagnosticsUI();
  if (!smartCubeSolveIndicator) return;
  const st = smartCube.getStatus();
  smartCubeSolveIndicator.hidden = !st.connected || mode !== "solve";
  if (!st.connected) return;

  const trackerStatus = scrambleTracker.getStatus();
  const devName = st.deviceName || "Smart Cube";

  if (smartCubeStage === "scrambling" && !trackerStatus.isComplete) {
    if (trackerStatus.hasError && !scrambleSuppressTransient) {
      smartCubeSolveText.innerHTML = `⚠️ <strong>${devName}</strong> · Scramble off-track! Undo: <span class="indicator-correction">${trackerStatus.corrections.join(" ")}</span>`;
    } else if (!scrambleSuppressTransient && trackerStatus.currentSubAmount > 0 && trackerStatus.nextRequired) {
      smartCubeSolveText.innerHTML = `⚠️ <strong>${devName}</strong> · Incomplete turn! Finish with: <span class="indicator-correction">${trackerStatus.nextRequired}</span>`;
    } else {
      const curMoveObj = scrambleTracker.moves[trackerStatus.currentIndex];
      const nextMoveDisplay = scrambleSuppressTransient
        ? (curMoveObj ? curMoveObj.text : trackerStatus.nextRequired)
        : trackerStatus.nextRequired;
      const nextTxt = nextMoveDisplay ? ` · Next: <strong>${nextMoveDisplay}</strong>` : "";
      smartCubeSolveText.innerHTML = `ᛒ <strong>${devName}</strong> · Scrambling (${trackerStatus.currentIndex}/${trackerStatus.totalMoves})${nextTxt}`;
    }
  } else if (smartCubeStage === "inspecting" || solveState === "inspecting") {
    smartCubeSolveText.innerHTML = ganTimer.isConnected()
      ? `ᛒ <strong>${devName}</strong> · ✓ Scrambled · <strong>Inspecting (15s)</strong> · Start the GAN timer`
      : `ᛒ <strong>${devName}</strong> · ✓ Scrambled · <strong>Inspecting (15s)</strong> · Turn cube to start`;
  } else if (smartCubeStage === "ready") {
    smartCubeSolveText.innerHTML = ganTimer.isConnected()
      ? `ᛒ <strong>${devName}</strong> · ✓ Scramble Verified · <strong>READY</strong> · Start the GAN timer`
      : `ᛒ <strong>${devName}</strong> · ✓ Scramble Verified · <strong>READY</strong> · Turn cube to start`;
  } else if (smartCubeStage === "solving" || solveState === "running") {
    if (solveTimerDriven && solveCubeSolvedTs) {
      smartCubeSolveText.innerHTML = `ᛒ <strong>${devName}</strong> · ✓ Cube solved · Put it down &amp; stop the GAN timer`;
    } else if (solveTimerDriven) {
      smartCubeSolveText.innerHTML = `ᛒ <strong>${devName}</strong> · ⏱ GAN timer running · ${solveFirstMoveTs ? "Solving…" : "Pick up the cube!"}`;
    } else {
      smartCubeSolveText.innerHTML = `ᛒ <strong>${devName}</strong> · Solving in progress… (Solve cube to stop)`;
    }
  } else {
    smartCubeSolveText.innerHTML = `ᛒ <strong>${devName}</strong> Connected`;
  }
}

// Wire Scramble Assistant & Diagnostics Quick Action Buttons
if (smartCubeReadyBtn) {
  smartCubeReadyBtn.addEventListener("click", () => {
    onSmartScrambleCompleted();
  });
}
if (smartCubeResetSolvedBtn) {
  smartCubeResetSolvedBtn.addEventListener("click", () => {
    clearScrambleCorrectionDelay();
    smartCube.logDiag("MANUAL_CALIBRATE_RESET", { scramble: currentSolveScramble });
    smartCube.setScramble("", currentPuzzle);
    scrambleTracker.reset(currentSolveScramble);
    renderSmartScrambleAssistant();
  });
}
if (smartCubeDiagToggleBtn) {
  smartCubeDiagToggleBtn.addEventListener("click", () => {
    if (smartCube.diagRecording) {
      smartCube.stopDiagnostics();
    } else {
      smartCube.startDiagnostics();
    }
    updateDiagnosticsUI();
  });
}
if (smartCubeDiagCopyBtn) {
  smartCubeDiagCopyBtn.addEventListener("click", () => {
    copyDiagnosticsToClipboard(smartCubeDiagCopyBtn);
  });
}
if (btDiagToggleBtn) {
  btDiagToggleBtn.addEventListener("click", () => {
    if (smartCube.diagRecording) {
      smartCube.stopDiagnostics();
    } else {
      smartCube.startDiagnostics();
    }
    updateDiagnosticsUI();
  });
}
if (btDiagCopyBtn) {
  btDiagCopyBtn.addEventListener("click", () => {
    copyDiagnosticsToClipboard(btDiagCopyBtn);
  });
}
if (btDiagDownloadBtn) {
  btDiagDownloadBtn.addEventListener("click", () => {
    downloadDiagnosticsJson();
  });
}
if (btDiagClearBtn) {
  btDiagClearBtn.addEventListener("click", () => {
    smartCube.clearDiagnostics();
    updateDiagnosticsUI();
  });
}
smartCube.addEventListener("diaglog", () => {
  updateDiagnosticsUI();
});

function regenerateScramble() {
  if (mode === "practice" && practiceView) {
    practiceView.advanceCasualScramble();
    return;
  }
  resetCubeOrientation();
  const hasCases = selectedCases.size > 0;
  emptyState.hidden = hasCases;

  solveScrambleSource = null;
  if (solveScrambleSubtext) {
    solveScrambleSubtext.hidden = true;
    solveScrambleSubtext.textContent = "";
  }

  if (mode === "solve" && solveTarget === "timer-drill") {
    const preset = getActiveTimerDrillPreset();
    currentCaseId = `Timer Drill (${preset.name})`;
    currentCaseScramble = preset.moves;
    applyScrambleToDisplay("");
    updateSolveScrambleDisplay(preset.display);
    if (solveScrambleOrient) {
      solveScrambleOrient.textContent = "(starts from solved cube)";
    }
    if (solveScrambleSubtext) {
      solveScrambleSubtext.hidden = false;
      solveScrambleSubtext.textContent = `Timer & Handling Drill: ${preset.name} (${preset.expectedMoves} moves, returns cube to solved)`;
    }
    resetGuessingUI();
    updateStatsTable();
    return;
  }

  if (currentPuzzle === "333" || currentPuzzle === "333oh") {
    const isOh = currentPuzzle === "333oh";
    const gen333 = isOh ? generateWca3x3OhScramble : generateWca3x3Scramble;
    if (mode === "solve") {
      if (solveTarget === "full" || solveTarget === "cross") {
        gen333().then(wcaScr => {
          applyScrambleToDisplay(wcaScr);
          updateSolveScrambleDisplay(wcaScr);
          updateCrossSolutions(wcaScr);
        });
        resetGuessingUI();
        updateStatsTable();
        return;
      } else if (solveTarget === "pll") {
        const track = getTrack(currentPuzzle, "pll");
        const active = track.cases.filter(c => selectedCases.has(c.id));
        const pool = active.length > 0 ? active : track.cases;
        const c = pool[Math.floor(Math.random() * pool.length)];
        const scr = c.setup;
        currentCaseId = c.id;
        const displayScr = alwaysWhiteBottom ? `z2 ${scr}` : scr;
        applyScrambleToDisplay(displayScr);
        updateSolveScrambleDisplay(scr);
        if (solveScrambleSubtext) {
          solveScrambleSubtext.hidden = false;
          solveScrambleSubtext.textContent = `PLL Case: ${c.name} (${c.group})`;
        }
        if (solveScrambleOrient) solveScrambleOrient.textContent = "(white on bottom)";
        updateCrossSolutions(scr);
        resetGuessingUI();
        updateStatsTable();
        return;
      } else if (solveTarget === "oll") {
        const track = getTrack(currentPuzzle, "oll");
        const active = track.cases.filter(c => selectedCases.has(c.id));
        const pool = active.length > 0 ? active : track.cases;
        const c = pool[Math.floor(Math.random() * pool.length)];
        const scr = c.setup;
        currentCaseId = c.id;
        const displayScr = alwaysWhiteBottom ? `z2 ${scr}` : scr;
        applyScrambleToDisplay(displayScr);
        updateSolveScrambleDisplay(scr);
        if (solveScrambleSubtext) {
          solveScrambleSubtext.hidden = false;
          solveScrambleSubtext.textContent = `OLL Case: ${c.id} (${c.group})`;
        }
        if (solveScrambleOrient) solveScrambleOrient.textContent = "(white on bottom)";
        updateCrossSolutions(scr);
        resetGuessingUI();
        updateStatsTable();
        return;
      } else if (solveTarget === "f2l") {
        const track = getTrack(currentPuzzle, "f2l");
        const active = track.cases.filter(c => selectedCases.has(c.id));
        const pool = active.length > 0 ? active : track.cases;
        const c = pool[Math.floor(Math.random() * pool.length)];
        const scr = c.setup;
        currentCaseId = c.id;
        const displayScr = alwaysWhiteBottom ? `z2 ${scr}` : scr;
        applyScrambleToDisplay(displayScr);
        updateSolveScrambleDisplay(scr);
        if (solveScrambleSubtext) {
          solveScrambleSubtext.hidden = false;
          solveScrambleSubtext.textContent = `F2L Case: ${c.id} (${c.group})`;
        }
        if (solveScrambleOrient) solveScrambleOrient.textContent = "(white on bottom)";
        updateCrossSolutions(scr);
        resetGuessingUI();
        updateStatsTable();
        return;
      }
    }

    const track = getTrack(currentPuzzle, currentTrackId);
    if (track && track.cases.length > 0) {
      const active = track.cases.filter(c => selectedCases.has(c.id));
      const pool = active.length > 0 ? active : track.cases;
      const c = pool[Math.floor(Math.random() * pool.length)];
      const scr = c.setup || c.scramble;
      currentCaseId = c.id;
      currentCaseScramble = scr;
      scrambleMoves = scr;
      scramble = scr;
      const is333Case = ["f2l", "oll", "pll"].includes(currentTrackId);
      const displayScr = (alwaysWhiteBottom && is333Case) ? `z2 ${scr}` : scr;
      applyScrambleToDisplay(displayScr);
      if (mode === "solve") {
        updateSolveScrambleDisplay(scr);
        if (solveScrambleOrient) solveScrambleOrient.textContent = is333Case ? "(white on bottom)" : "(WCA orientation)";
        updateCrossSolutions(scr);
      }
    } else {
      gen333().then(wcaScr => {
        applyScrambleToDisplay(wcaScr);
        if (mode === "solve") {
          updateSolveScrambleDisplay(wcaScr);
          updateCrossSolutions(wcaScr);
        } else {
          scramble = wcaScr;
          scrambleMoves = wcaScr;
          currentSolveScramble = wcaScr;
          if (solveScrambleText) solveScrambleText.textContent = wcaScr;
        }
      });
    }
    resetGuessingUI();
    updateStatsTable();
    return;
  }

  if (currentPuzzle === "444") {
    if (mode === "solve" && solveTarget === "parity") {
      const track = getTrack("444", "parity");
      const active = track.cases.filter(c => selectedCases.has(c.id));
      const pool = active.length > 0 ? active : track.cases;
      const c = pool[Math.floor(Math.random() * pool.length)];
      const scr = c.setup || c.scramble;
      currentCaseId = c.id;
      applyScrambleToDisplay(scr);
      updateSolveScrambleDisplay(scr);
      if (solveScrambleSubtext) {
        solveScrambleSubtext.hidden = false;
        solveScrambleSubtext.textContent = `4x4 Parity Case: ${c.name} (${c.group})`;
      }
      resetGuessingUI();
      updateStatsTable();
      return;
    } else if (mode !== "solve" && hasCases) {
      const track = getTrack("444", "parity");
      const active = track.cases.filter(c => selectedCases.has(c.id));
      const pool = active.length > 0 ? active : track.cases;
      const c = pool[Math.floor(Math.random() * pool.length)];
      const scr = (c.scrambles && c.scrambles.length > 0)
        ? c.scrambles[Math.floor(Math.random() * c.scrambles.length)]
        : (c.setup || c.scramble);
      currentCaseId = c.id;
      currentCaseScramble = scr;
      scrambleMoves = scr;
      scramble = scr;
      applyScrambleToDisplay(scr);
      resetGuessingUI();
      updateStatsTable();
      return;
    } else {
      generateWca4x4Scramble().then(wcaScr => {
        applyScrambleToDisplay(wcaScr);
        if (mode === "solve") {
          updateSolveScrambleDisplay(wcaScr);
        } else {
          currentSolveScramble = wcaScr;
          scrambleMoves = wcaScr;
          scramble = wcaScr;
          currentCaseId = null;
          if (solveScrambleText) solveScrambleText.textContent = wcaScr;
        }
      });
      resetGuessingUI();
      updateStatsTable();
      return;
    }
  }

  if (currentPuzzle === "555") {
    if (mode === "solve" && solveTarget === "parity") {
      const track = getTrack("555", "parity");
      const active = track.cases.filter(c => selectedCases.has(c.id));
      const pool = active.length > 0 ? active : track.cases;
      const c = pool[Math.floor(Math.random() * pool.length)];
      const scr = (c.scrambles && c.scrambles.length > 0)
        ? c.scrambles[Math.floor(Math.random() * c.scrambles.length)]
        : (c.setup || c.scramble);
      currentCaseId = c.id;
      applyScrambleToDisplay(scr);
      updateSolveScrambleDisplay(scr);
      if (solveScrambleSubtext) {
        solveScrambleSubtext.hidden = false;
        solveScrambleSubtext.textContent = `5x5 Parity Case: ${c.name} (${c.group})`;
      }
      resetGuessingUI();
      updateStatsTable();
      return;
    } else if (mode !== "solve" && hasCases) {
      const track = getTrack("555", "parity");
      const active = track.cases.filter(c => selectedCases.has(c.id));
      const pool = active.length > 0 ? active : track.cases;
      const c = pool[Math.floor(Math.random() * pool.length)];
      const scr = (c.scrambles && c.scrambles.length > 0)
        ? c.scrambles[Math.floor(Math.random() * c.scrambles.length)]
        : (c.setup || c.scramble);
      currentCaseId = c.id;
      currentCaseScramble = scr;
      scrambleMoves = scr;
      scramble = scr;
      applyScrambleToDisplay(scr);
      resetGuessingUI();
      updateStatsTable();
      return;
    } else {
      generateWca5x5Scramble().then(wcaScr => {
        applyScrambleToDisplay(wcaScr);
        if (mode === "solve") {
          updateSolveScrambleDisplay(wcaScr);
        } else {
          currentSolveScramble = wcaScr;
          scrambleMoves = wcaScr;
          scramble = wcaScr;
          currentCaseId = null;
          if (solveScrambleText) solveScrambleText.textContent = wcaScr;
        }
      });
      resetGuessingUI();
      updateStatsTable();
      return;
    }
  }

  if (mode === "solve" && solveTarget !== "cll") {
    generateWca2x2Scramble().then(wcaScr => {
      applyScrambleToDisplay(wcaScr);
      updateSolveScrambleDisplay(wcaScr);
      updateLayerSolutions(wcaScr);
    });
    resetGuessingUI();
    updateStatsTable();
    return;
  }

  if (hasCases) {
    buildScramble();
    applyScrambleToDisplay(scramble);
    if (mode === "solve") {
      updateSolveScrambleDisplay(scrambleMoves);
      updateLayerSolutions(scrambleMoves);
    }
  } else {
    currentCaseId = null;
    currentCaseScramble = null;
    scramble = "";
    scrambleMoves = "";
    currentSolveScramble = "";
    applyScrambleToDisplay("");
    updateSolveScrambleDisplay("");
  }

  if (mode === "study") {
    resetCubeOrientation();
  }

  resetGuessingUI(); // also re-renders the stage for the current mode
  updateStatsTable();
}

regenerateBtn.addEventListener("click", regenerateScramble);

// ---------------------------------------------------------------------------
// Modes and the stage
// ---------------------------------------------------------------------------

function setMode(next, { skipSimInit = false } = {}) {
  if (next === "timed") {
    next = "practice";
    if (practiceView) practiceView.setPracticeMode("timed");
  }
  if (!MODES.includes(next) || next === mode) return;
  if (session) finishSession(); // leaving Timed ends a running session
  if (solveState !== "idle") cancelSolve(); // leaving Solve drops an unfinished attempt

  const leavingSimulate = mode === "simulate" && next !== "simulate";
  if (leavingSimulate) {
    simTeardown();
  }

  mode = next;
  resetCaseAppearances();
  if (mode === "solve") {
    statsType = "log";
  } else if (mode === "practice") {
    statsType = "recog";
  }
  saveSettings();
  renderTrackBar();
  renderStage();
  renderStatsToggle();
  updateStatsTable();
  updateBluetoothUI();

  if (mode === "simulate") {
    if (!skipSimInit) {
      simInit();
    } else {
      populateSimCaseSelect();
      attachSimPlayerListeners();
    }
  } else if (mode === "solve") {
    if (!currentSolveScramble) {
      regenerateScramble();
    } else {
      updateSolveScrambleDisplay(currentSolveScramble);
      const is333Case = currentPuzzle === "333" && ["f2l", "oll", "pll"].includes(solveTarget);
      const displayScr = (alwaysWhiteBottom && is333Case) ? `z2 ${currentSolveScramble}` : currentSolveScramble;
      applyScrambleToDisplay(displayScr);
      applyReflection();
      if (currentPuzzle === "333" || currentPuzzle === "333oh") {
        updateCrossSolutions(currentSolveScramble);
      } else if (currentPuzzle === "222") {
        if (!currentLayerSolutionsScramble || currentLayerSolutionsScramble !== currentSolveScramble) {
          updateLayerSolutions(currentSolveScramble);
        }
      }
    }
  } else if (mode === "study") {
    resetCubeOrientation();
    if (studyView) studyView.render();
  } else if (mode === "practice") {
    if (practiceView) {
      practiceView.setTrack(currentPuzzle, currentTrackId);
    }
  }
}

modeButtons.forEach(btn => btn.addEventListener("click", () => setMode(btn.dataset.mode)));

// Shows/hides everything on the stage according to mode and session state.
function renderStage() {
  const hasCases = selectedCases.size > 0;
  const running = !!session;

  modeButtons.forEach(btn => btn.setAttribute("aria-pressed", String(btn.dataset.mode === mode)));

  updateCaseInfoDisplay();

  const simulating = mode === "simulate";
  const solving = mode === "solve";
  const studying = mode === "study";
  const practicing = mode === "practice";

  if (studyViewContainer) studyViewContainer.hidden = !studying;
  if (practiceViewContainer) practiceViewContainer.hidden = !practicing;

  simulatePanel.hidden = !simulating;
  if (simulating) {
    emptyState.hidden = true;
    displayContainer.hidden = false;
  }

  if (studying && studyView) {
    studyView.render();
  }
  if (practicing && practiceView) {
    practiceView.render();
  }

  guessingContainer.hidden = !hasCases || !(mode === "practice" || (mode === "timed" && running));
  if (practicing && practiceViewContainer && !practiceViewContainer.hidden) {
    guessingContainer.hidden = true;
  }

  guessLabel.hidden = mode !== "practice";
  verifyBtn.hidden = mode !== "practice" || practiceAnswered;
  verifyMessage.hidden = !(mode === "practice" && practiceAnswered);
  timedFeedback.hidden = !(running && session.lastResult);

  timedBar.hidden = true;
  timedSetup.hidden = true;
  startSessionBtn.disabled = !hasCases;
  timedSummary.hidden = true;

  regenerateBtn.hidden = simulating || solving || studying;

  // Solve mode: show or hide cube based on solveShowCube
  const hideCubeInSolve = solving && !solveShowCube;
  cubeCard.hidden = studying || hideCubeInSolve || (!hasCases && ["practice", "study"].includes(mode));
  if (resetOrientationBtn) {
    resetOrientationBtn.hidden = cubeCard.hidden;
  }
  if (stage) {
    stage.classList.toggle("mode-solve", solving);
    stage.classList.toggle("mode-study", studying);
    stage.classList.toggle("mode-practice", practicing);
    stage.classList.toggle("mode-simulate", simulating);
    stage.classList.toggle("mode-timed", false);
    stage.dataset.mode = mode;
    stage.dataset.puzzle = currentPuzzle;
    stage.classList.toggle("solve-cube-hidden", hideCubeInSolve);
    stage.dataset.solveSize = solveWidgetSize;
  }
  if (document.body) {
    document.body.dataset.puzzle = currentPuzzle;
    document.body.dataset.mode = mode;
  }
  solveScramble.hidden = !solving;
  solveSurface.hidden = !solving;
  solveTimes.hidden = !solving;
  if (layerSolutionsWidget) {
    layerSolutionsWidget.hidden = !(solving || simulating) || currentPuzzle !== "222" || (solving && solveTarget === "timer-drill");
  }
  if (crossSolutionsWidget) {
    crossSolutionsWidget.hidden = !(solving || simulating) || (currentPuzzle !== "333" && currentPuzzle !== "333oh") || (solving && solveTarget === "timer-drill");
  }
  renderTimerDrillBanner();
  if (solving) renderSolvePanel();
}

function updateCaseInfoDisplay() {
  if (mode === "study") {
    caseInfoContainer.hidden = true;
    return;
  }
  const caseObj = currentCaseId ? caseById.get(currentCaseId) : null;
  if (false && caseObj) {
    const scrambles = caseObj.scrambles && caseObj.scrambles.length ? caseObj.scrambles : [caseObj.scramble];
    const strippedCurrent = currentCaseScramble ? cleanAlg(currentCaseScramble) : "";
    let activePresetIdx = scrambles.findIndex(s => cleanAlg(s) === strippedCurrent || s.trim() === strippedCurrent);
    if (activePresetIdx === -1) activePresetIdx = 0;

    const presetBtnsHtml = scrambles.map((sc, i) => {
      return `<button type="button" class="study-preset-chip ${i === activePresetIdx ? 'active' : ''}" data-idx="${i}" title="${sc}">Scramble ${i + 1}</button>`;
    }).join("");

    const tag = getCaseTag(caseObj.id);
    const solutionDisplay = getCllCaseSolutionDisplay(caseObj);

    caseInfoContainer.innerHTML = `
      <div class="case-header-row" style="display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 6px;">
        <div class="case-id" style="margin: 0;">${caseObj.id}</div>
        <select class="case-tag-select" id="studyTagSelect" title="Learning status for this case">
          <option value="learning" ${tag === 'learning' ? 'selected' : ''}>📘 Learning</option>
          <option value="review" ${tag === 'review' ? 'selected' : ''}>📙 Review</option>
          <option value="mastered" ${tag === 'mastered' ? 'selected' : ''}>📗 Mastered</option>
        </select>
      </div>
      <div class="case-solution-row">
        <div class="case-solution"><b>Solution:</b> <span id="studySolutionText">${escapeHtml(solutionDisplay)}</span></div>
        <button type="button" class="btn btn-xs" id="studyEditLabelBtn" title="Customize trigger label">&#x270E; Edit Label</button>
      </div>
      <div class="case-opposite">Opposite (after the alg): <strong>${caseObj.opposite}</strong></div>
      <div class="study-presets-bar">
        <span class="study-presets-label">Preset Scrambles:</span>
        <div class="study-preset-chips">
          ${presetBtnsHtml}
        </div>
      </div>
      <div class="case-sim-action">
        <button type="button" class="btn btn-small btn-study-sim" id="studySimulateBtn">Simulate Solution in 3D &rarr;</button>
      </div>
    `;

    const tagSelect = document.getElementById("studyTagSelect");
    if (tagSelect) {
      tagSelect.addEventListener("change", () => {
        setCaseTag(caseObj.id, tagSelect.value);
      });
    }

    const editLabelBtn = document.getElementById("studyEditLabelBtn");
    if (editLabelBtn) {
      editLabelBtn.addEventListener("click", () => {
        openCustomLabelModal({
          type: "cll",
          id: caseObj.id,
          rawAlg: caseObj.solutionAlg,
          defaultLabel: caseObj.solution,
          currentLabel: getCllCaseSolutionDisplay(caseObj),
          onSave: (newLabel) => {
            setCllCaseSolutionDisplay(caseObj.id, newLabel);
            const textSpan = document.getElementById("studySolutionText");
            if (textSpan) textSpan.textContent = getCllCaseSolutionDisplay(caseObj);
          },
          onReset: () => {
            setCllCaseSolutionDisplay(caseObj.id, null);
            const textSpan = document.getElementById("studySolutionText");
            if (textSpan) textSpan.textContent = caseObj.solution;
          }
        });
      });
    }

    const studyChips = caseInfoContainer.querySelectorAll(".study-preset-chip");
    studyChips.forEach(chip => {
      chip.addEventListener("click", () => {
        const idx = parseInt(chip.dataset.idx, 10);
        if (scrambles[idx]) {
          currentCaseScramble = scrambles[idx];
          const orientation = "z2";
          scrambleMoves = cleanAlg(currentCaseScramble);
          scramble = `${orientation ? orientation + " " : ""}${scrambleMoves}`.trim();
          applyScrambleToDisplay(scramble);
          applyReflection();
          resetCubeOrientation();
          updateCaseInfoDisplay();
        }
      });
    });

    const simBtn = document.getElementById("studySimulateBtn");
    if (simBtn) {
      simBtn.addEventListener("click", () => {
        setMode("simulate");
        simLoadCaseWithSolution(caseObj, activePresetIdx);
      });
    }
    caseInfoContainer.hidden = false;
  } else {
    caseInfoContainer.hidden = true;
  }
}

// ---------------------------------------------------------------------------
// Guessing (shared by Practice and Timed)
// ---------------------------------------------------------------------------

function selectGroup(group) {
  if (practiceAnswered || guessingContainer.hidden) return;
  groupButtons.forEach(b => b.classList.toggle("active", b.dataset.group === group));
  guessedGroup = group;
  maybeSubmitTimedAnswer();
}

function selectCase(caseNum) {
  if (practiceAnswered || guessingContainer.hidden) return;
  caseButtons.forEach(b => b.classList.toggle("active", b.dataset.case === caseNum));
  guessedCase = caseNum;
  maybeSubmitTimedAnswer();
}

groupButtons.forEach(btn => btn.addEventListener("click", () => selectGroup(btn.dataset.group)));
caseButtons.forEach(btn => btn.addEventListener("click", () => selectCase(btn.dataset.case)));

// Scores a guess against the current case and records it in the lifetime stats.
function checkAnswer(group, caseNum) {
  const correctGroup = currentCaseId.slice(0, currentCaseId.length - 1);
  const correctCase = currentCaseId.slice(-1);
  const groupCorrect = group === correctGroup;
  const caseCorrect = caseNum === correctCase;

  // Every answer is an attempt at the shown case; it counts as a correct
  // identification only when both the group and the number are right.
  const isCorrect = groupCorrect && caseCorrect;
  recordCaseStat(currentPuzzle, currentTrackId, currentCaseId, isCorrect);
  updateStatsTable();

  const result = groupCorrect && caseCorrect ? "correct" : (groupCorrect || caseCorrect) ? "partial" : "incorrect";
  return { result, correctId: currentCaseId, correctGroup, guessedId: `${group}${caseNum}` };
}

verifyBtn.addEventListener("click", verifyGuess);

// Practice: explicit Verify step, then "New scramble"
function verifyGuess() {
  if (!currentCaseId || practiceAnswered || mode !== "practice") return;
  if (!guessedGroup || !guessedCase) {
    alert("Please select both a group and a case number.");
    return;
  }

  const { result, correctId } = checkAnswer(guessedGroup, guessedCase);
  practiceAnswered = true;

  groupButtons.forEach(btn => (btn.disabled = true));
  caseButtons.forEach(btn => (btn.disabled = true));
  regenerateBtn.classList.remove("btn-outline");
  regenerateBtn.classList.add("btn-primary");

  const message = result === "correct"
    ? "✓ Correct!"
    : result === "partial"
      ? `Partial! Correct answer: ${correctId}`
      : `Incorrect! Correct answer: ${correctId}`;

  verifyMessage.className = `verify-message ${result}`;
  verifyMessage.innerHTML = statsCollapsed
    ? message
    : `${message}<div class="verify-stats">${buildStatsDisplay()}</div>`;
  renderStage();
}

function groupTotals(group) {
  if (!casesByGroup[group]) return { shown: 0, correct: 0 };
  return casesByGroup[group].reduce((totals, caseObj) => {
    const entry = getCaseStat(currentPuzzle, currentTrackId, caseObj.id);
    if (entry) {
      totals.shown += entry.shown;
      totals.correct += entry.correct;
    }
    return totals;
  }, { shown: 0, correct: 0 });
}

function buildStatsDisplay() {
  const parts = [];
  const entry = getCaseStat(currentPuzzle, currentTrackId, currentCaseId);
  if (entry) {
    parts.push(`${currentCaseId}: ${entry.correct}/${entry.shown}`);
  }
  const group = currentCaseId.slice(0, currentCaseId.length - 1);
  const totals = groupTotals(group);
  parts.push(`${group} total: ${totals.correct}/${totals.shown}`);
  return parts.join(" · ");
}

function resetGuessingUI() {
  guessedGroup = null;
  guessedCase = null;
  practiceAnswered = false;
  groupButtons.forEach(btn => {
    btn.classList.remove("active");
    btn.disabled = false;
  });
  caseButtons.forEach(btn => {
    btn.classList.remove("active");
    btn.disabled = false;
  });
  regenerateBtn.classList.remove("btn-primary");
  regenerateBtn.classList.add("btn-outline");
  renderStage();
}

// Keyboard entry (laptops): letter = group, digit = case, Enter = verify /
// next scramble. Also x, y, z for 3D world rotation.
document.addEventListener("keydown", e => {
  if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
  const isAnyModalOpen = !overview.hidden ||
    (guideModal && !guideModal.hidden) ||
    (pblModal && !pblModal.hidden) ||
    (customLabelModal && !customLabelModal.hidden) ||
    (sessionModal && !sessionModal.hidden) ||
    (bluetoothModal && !bluetoothModal.hidden) ||
    (solveReplayModal && !solveReplayModal.hidden) ||
    (solveDetailModal && !solveDetailModal.hidden);
  if (isAnyModalOpen) return;
  const target = e.target;
  if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;

  const keyLower = e.key.toLowerCase();
  if (["x", "y", "z"].includes(keyLower) && !cubeCard.hidden && solveState === "idle") {
    const isShift = e.shiftKey;
    const move = isShift ? `${keyLower}'` : keyLower;
    applyFreeMove(move);
    e.preventDefault();
    return;
  }

  const key = e.key.toUpperCase();
  if (!guessingContainer.hidden && !practiceAnswered) {
    if (GROUPS.includes(key)) {
      selectGroup(key);
      e.preventDefault();
      return;
    }
    if (/^[1-6]$/.test(key)) {
      selectCase(key);
      e.preventDefault();
      return;
    }
  }

  if (e.key === "Enter") {
    // Buttons keep their native Enter behaviour, except the ones whose focus
    // typically lingers after a mouse click (mode, Verify, New scramble):
    // there Enter follows the guess flow and the duplicate click is suppressed.
    const btn = target && target.tagName === "BUTTON" ? target : null;
    if (btn && !(btn.classList.contains("mode-btn") || btn === verifyBtn || btn === regenerateBtn)) return;

    if (mode === "practice" && !guessingContainer.hidden) {
      if (practiceAnswered) {
        regenerateScramble();
      } else if (guessedGroup && guessedCase) {
        verifyGuess();
      } else {
        return;
      }
      e.preventDefault();
    } else if (mode === "study") {
      regenerateScramble();
      e.preventDefault();
    }
  }
});

// ---------------------------------------------------------------------------
// Timed sessions
// ---------------------------------------------------------------------------

function renderMinutes() {
  minutesInput.value = String(timedMinutes);
}

function setMinutes(value) {
  timedMinutes = clampMinutes(value);
  saveSettings();
  renderMinutes();
}

minutesDec.addEventListener("click", () => setMinutes(timedMinutes - 1));
minutesInc.addEventListener("click", () => setMinutes(timedMinutes + 1));
minutesInput.addEventListener("change", () => setMinutes(minutesInput.value));

startSessionBtn.addEventListener("click", () => {
  setMinutes(minutesInput.value);
  startSession();
});

endSessionBtn.addEventListener("click", finishSession);

timedSummary.addEventListener("click", e => {
  const action = e.target.closest("[data-action]");
  if (!action) return;
  if (action.dataset.action === "again") {
    startSession();
  } else if (action.dataset.action === "done") {
    sessionSummary = null;
    renderStage();
  }
});

function formatTime(ms) {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function startSession() {
  if (selectedCases.size === 0 || session) return;
  resetCaseAppearances();
  const durationMs = timedMinutes * 60 * 1000;
  const now = Date.now();
  session = {
    durationMs,
    startedAt: now,
    endTime: now + durationMs,
    attempts: 0,
    correct: 0,
    partial: 0,
    incorrect: 0,
    perGroup: {},
    lastResult: null,
    timerId: 0
  };
  sessionSummary = null;
  session.timerId = setInterval(tickSession, 200);
  renderLiveTally();
  regenerateScramble(); // fresh case; also renders the stage
  tickSession();
}

function tickSession() {
  if (!session) return;
  const remaining = Math.max(0, session.endTime - Date.now());
  countdownEl.textContent = formatTime(remaining);
  countdownEl.classList.toggle("urgent", remaining <= 10000);
  timedProgress.style.width = `${(remaining / session.durationMs) * 100}%`;
  if (remaining === 0) finishSession();
}

function renderLiveTally() {
  liveTallyEl.textContent = session.attempts
    ? `${session.correct} / ${session.attempts} correct`
    : "Tap a letter and a number";
}

function maybeSubmitTimedAnswer() {
  if (mode !== "timed" || !session || !currentCaseId) return;
  if (!guessedGroup || !guessedCase) return;

  const { result, correctId, correctGroup, guessedId } = checkAnswer(guessedGroup, guessedCase);
  session.attempts++;
  session[result]++;
  const groupTally = session.perGroup[correctGroup] ?? (session.perGroup[correctGroup] = { attempts: 0, correct: 0 });
  groupTally.attempts++;
  if (result === "correct") groupTally.correct++;
  session.lastResult = { result, correctId, guessedId };

  timedFeedback.className = `verify-message ${result}`;
  timedFeedback.textContent = result === "correct"
    ? `✓ ${correctId}`
    : result === "partial"
      ? `Partial: it was ${correctId} (you said ${guessedId})`
      : `✗ It was ${correctId} (you said ${guessedId})`;
  flashCube(result);
  renderLiveTally();

  regenerateScramble(); // straight on to the next case
}

function flashCube(result) {
  cubeCard.classList.remove("flash-correct", "flash-partial", "flash-incorrect");
  void cubeCard.offsetWidth; // restart the transition
  cubeCard.classList.add(`flash-${result}`);
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => cubeCard.classList.remove(`flash-${result}`), 700);
}

function finishSession() {
  if (!session) return;
  clearInterval(session.timerId);
  clearTimeout(flashTimer);
  cubeCard.classList.remove("flash-correct", "flash-partial", "flash-incorrect");
  const finished = session;
  session = null;
  sessionSummary = {
    ...finished,
    elapsedMs: Math.min(finished.durationMs, Date.now() - finished.startedAt)
  };
  renderSummary();
  resetGuessingUI(); // clears any half-entered guess and renders the stage
}

function renderSummary() {
  const s = sessionSummary;
  const accuracy = s.attempts ? Math.round((100 * s.correct) / s.attempts) : 0;
  const pace = s.attempts ? (s.elapsedMs / s.attempts / 1000).toFixed(1) + "s" : "–";
  const timedOut = s.elapsedMs >= s.durationMs;
  const groups = GROUP_DISPLAY_ORDER
    .filter(g => s.perGroup[g])
    .map(g => `<span class="summary-group"><b>${g}</b> ${s.perGroup[g].correct}/${s.perGroup[g].attempts}</span>`)
    .join("");

  timedSummary.innerHTML = `
    <p class="summary-title">${timedOut ? "Time's up!" : "Session ended"} <span class="summary-time">${formatTime(s.elapsedMs)}</span></p>
    <div class="summary-stats">
      <div class="stat"><b>${s.attempts}</b><span>answered</span></div>
      <div class="stat stat-correct"><b>${s.correct}</b><span>correct</span></div>
      <div class="stat stat-partial"><b>${s.partial}</b><span>partial</span></div>
      <div class="stat stat-incorrect"><b>${s.incorrect}</b><span>wrong</span></div>
      <div class="stat"><b>${accuracy}%</b><span>accuracy</span></div>
      <div class="stat"><b>${pace}</b><span>per case</span></div>
    </div>
    ${groups ? `<div class="summary-groups">${groups}</div>` : ""}
    <div class="summary-actions">
      <button type="button" class="btn btn-primary" data-action="again">Start another</button>
      <button type="button" class="btn" data-action="done">Done</button>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Solve mode: scramble a real cube, then time recognition + execution.
// Hold Space (or a finger on the timer area), release to start; any key or a
// tap anywhere stops. The case is revealed after the solve.
// ---------------------------------------------------------------------------

function formatSolveTime(ms) {
  if (ms < 60000) return (ms / 1000).toFixed(2);
  const minutes = Math.floor(ms / 60000);
  const seconds = (ms % 60000) / 1000;
  return `${minutes}:${seconds.toFixed(2).padStart(5, "0")}`;
}

// ---------------------------------------------------------------------------
// Rolling Averages (Ao5, Ao12, Ao100) and Stats Bar Engine
// ---------------------------------------------------------------------------

function calculateAoN(solvesList, n) {
  if (!solvesList || solvesList.length < n) return null;
  const slice = solvesList.slice(-n);
  const numeric = slice.map(t => {
    if (t.penalty === 'DNF' || t.ms === Infinity) return Infinity;
    const base = t.ms || 0;
    return t.penalty === '+2' ? base + 2000 : base;
  });
  const dnfs = numeric.filter(x => !isFinite(x));
  const trim = n < 40 ? 1 : Math.ceil(n * 0.05);
  if (dnfs.length > trim) return 'DNF';
  numeric.sort((a, b) => a - b);
  const trimmed = numeric.slice(trim, numeric.length - trim);
  if (trimmed.some(x => !isFinite(x))) return 'DNF';
  const sum = trimmed.reduce((a, b) => a + b, 0);
  return Math.round(sum / trimmed.length);
}

function getBestAoN(solvesList, n) {
  if (!solvesList || solvesList.length < n) return null;
  let best = null;
  for (let i = n; i <= solvesList.length; i++) {
    const windowSolves = solvesList.slice(0, i);
    const ao = calculateAoN(windowSolves, n);
    if (ao !== null && ao !== 'DNF') {
      if (best === null || ao < best) {
        best = ao;
      }
    }
  }
  return best;
}

function renderSolveStatsBar(container, solvesList) {
  if (!container) return;
  if (!solvesList || !solvesList.length) {
    container.innerHTML = "";
    return;
  }
  const valid = solvesList.filter(s => s.penalty !== "DNF").map(s => (s.penalty === "+2" ? s.ms + 2000 : s.ms));
  const bestSingle = valid.length ? Math.min(...valid) : null;
  const mean = valid.length ? Math.round(valid.reduce((a, b) => a + b, 0) / valid.length) : null;
  const median = valid.length ? computeMedian(valid) : null;
  const trimMean = valid.length ? computeTrimmedMean(valid, 0.10) : null;

  const curAo5 = calculateAoN(solvesList, 5);
  const bestAo5 = getBestAoN(solvesList, 5);

  const curAo12 = calculateAoN(solvesList, 12);
  const bestAo12 = getBestAoN(solvesList, 12);

  const curAo100 = solvesList.length >= 100 ? calculateAoN(solvesList, 100) : null;
  const bestAo100 = solvesList.length >= 100 ? getBestAoN(solvesList, 100) : null;

  const fmt = (v) => {
    if (v === null || v === undefined) return "-";
    if (v === "DNF") return "DNF";
    return formatSolveTime(v);
  };

  container.innerHTML = `
    <div class="solve-stat-item">
      <span class="solve-stat-val">${fmt(bestSingle)}</span>
      <span class="solve-stat-lbl">Single Best</span>
    </div>
    <div class="solve-stat-item">
      <span class="solve-stat-val">${fmt(median)}</span>
      <span class="solve-stat-lbl">Median</span>
    </div>
    <div class="solve-stat-item" title="Trimmed Mean (excludes fastest 10% and slowest 10% of solves)">
      <span class="solve-stat-val">${fmt(trimMean)}</span>
      <span class="solve-stat-lbl">TrimMean 10%</span>
    </div>
    <div class="solve-stat-item">
      <span class="solve-stat-val">${fmt(mean)}</span>
      <span class="solve-stat-lbl">Mean (${solvesList.length})</span>
    </div>
    <div class="solve-stat-item">
      <span class="solve-stat-val">${fmt(curAo5)}</span>
      <span class="solve-stat-lbl">Cur Ao5</span>
    </div>
    <div class="solve-stat-item">
      <span class="solve-stat-val">${fmt(bestAo5)}</span>
      <span class="solve-stat-lbl">Best Ao5</span>
    </div>
    <div class="solve-stat-item">
      <span class="solve-stat-val">${fmt(curAo12)}</span>
      <span class="solve-stat-lbl">Cur Ao12</span>
    </div>
    <div class="solve-stat-item">
      <span class="solve-stat-val">${fmt(bestAo12)}</span>
      <span class="solve-stat-lbl">Best Ao12</span>
    </div>
    ${solvesList.length >= 100 ? `
    <div class="solve-stat-item">
      <span class="solve-stat-val">${fmt(curAo100)}</span>
      <span class="solve-stat-lbl">Cur Ao100</span>
    </div>
    <div class="solve-stat-item">
      <span class="solve-stat-val">${fmt(bestAo100)}</span>
      <span class="solve-stat-lbl">Best Ao100</span>
    </div>
    ` : ''}
  `;
}

// ---------------------------------------------------------------------------
// Modals: Tips & Guide, Ortega PBL, Custom Label, Session Management
// ---------------------------------------------------------------------------

// Tips & Guide Modal
function openGuideModal() {
  if (!guideModal) return;
  guideModal.hidden = false;
  document.documentElement.classList.add("overview-open");
  guideCloseBtn?.focus();
}

function closeGuideModal() {
  if (!guideModal) return;
  guideModal.hidden = true;
  document.documentElement.classList.remove("overview-open");
  guideBtn?.focus();
}

if (guideBtn) guideBtn.addEventListener("click", openGuideModal);
if (guideCloseBtn) guideCloseBtn.addEventListener("click", closeGuideModal);

// Ortega PBL Modal
function openPblModal() {
  if (!pblModal) return;
  buildPblModal();
  pblModal.hidden = false;
  document.documentElement.classList.add("overview-open");
  pblCloseBtn?.focus();
}

function closePblModal() {
  if (!pblModal) return;
  pblModal.hidden = true;
  document.documentElement.classList.remove("overview-open");
  pblOverviewBtn?.focus();
}

if (pblOverviewBtn) pblOverviewBtn.addEventListener("click", openPblModal);
if (pblCloseBtn) pblCloseBtn.addEventListener("click", closePblModal);

function buildPblModal() {
  if (!pblCardsContainer) return;
  pblCardsContainer.innerHTML = "";

  pblCases.forEach(caseObj => {
    const card = document.createElement("article");
    card.className = "pbl-card";

    const head = document.createElement("div");
    head.className = "pbl-card-head";

    const title = document.createElement("h3");
    title.className = "pbl-card-title";
    title.textContent = caseObj.name;

    const badge = document.createElement("span");
    badge.className = "pbl-card-badge";
    badge.textContent = caseObj.shortName;

    head.append(title, badge);

    const desc = document.createElement("p");
    desc.className = "pbl-card-desc";
    desc.textContent = caseObj.description;

    const algPicker = document.createElement("div");
    algPicker.className = "pbl-alg-picker";

    const selectedAlg = getPblCaseSelectedAlg(caseObj);

    caseObj.algs.forEach(algItem => {
      const isSelected = algItem.id === selectedAlg.id;
      const opt = document.createElement("label");
      opt.className = `pbl-alg-option ${isSelected ? "active" : ""}`;

      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = `pbl-alg-${caseObj.id}`;
      radio.value = algItem.id;
      radio.checked = isSelected;
      radio.className = "pbl-alg-radio";

      radio.addEventListener("change", () => {
        if (!pblSettings[caseObj.id]) pblSettings[caseObj.id] = {};
        pblSettings[caseObj.id].selectedAlgId = algItem.id;
        savePblSettings();
        buildPblModal();
      });

      const content = document.createElement("div");
      content.className = "pbl-alg-content";

      const displayLabel = getPblAlgDisplayLabel(caseObj.id, algItem);

      const labelSpan = document.createElement("span");
      labelSpan.className = "pbl-alg-label";
      labelSpan.textContent = displayLabel;

      const noteSpan = document.createElement("span");
      noteSpan.className = "pbl-alg-note";
      noteSpan.textContent = algItem.note || algItem.alg;

      content.append(labelSpan, noteSpan);
      opt.append(radio, content);
      algPicker.appendChild(opt);
    });

    const actions = document.createElement("div");
    actions.className = "pbl-card-actions";

    const editBtn = document.createElement("button");
    editBtn.type = "button";
    editBtn.className = "btn btn-small";
    editBtn.innerHTML = "&#x270E; Customize Label";
    editBtn.addEventListener("click", () => {
      const activeAlg = getPblCaseSelectedAlg(caseObj);
      openCustomLabelModal({
        type: "pbl",
        id: `${caseObj.id} (${activeAlg.id})`,
        rawAlg: activeAlg.alg,
        defaultLabel: activeAlg.label,
        currentLabel: getPblAlgDisplayLabel(caseObj.id, activeAlg),
        onSave: (newLabel) => {
          if (!pblSettings[caseObj.id]) pblSettings[caseObj.id] = {};
          if (!pblSettings[caseObj.id].customLabels) pblSettings[caseObj.id].customLabels = {};
          pblSettings[caseObj.id].customLabels[activeAlg.id] = newLabel;
          savePblSettings();
          buildPblModal();
        },
        onReset: () => {
          if (pblSettings[caseObj.id]?.customLabels?.[activeAlg.id]) {
            delete pblSettings[caseObj.id].customLabels[activeAlg.id];
            savePblSettings();
            buildPblModal();
          }
        }
      });
    });

    const simBtn = document.createElement("button");
    simBtn.type = "button";
    simBtn.className = "btn btn-primary btn-small";
    simBtn.innerHTML = "&#x25B6; Sim in 3D";
    simBtn.addEventListener("click", () => {
      closePblModal();
      simLoadPblCase(caseObj);
    });

    actions.append(editBtn, simBtn);
    card.append(head, desc, algPicker, actions);
    pblCardsContainer.appendChild(card);
  });
}

// Custom Label Modal
let activeCustomLabelCallback = null;
let activeCustomLabelReset = null;

function openCustomLabelModal({ type, id, defaultLabel, rawAlg, currentLabel, onSave, onReset }) {
  if (!customLabelModal) return;
  customLabelTitle.textContent = `Customize Label (${id})`;
  customLabelAlgNotation.textContent = rawAlg || "";
  customLabelInput.value = currentLabel || defaultLabel || "";
  activeCustomLabelCallback = onSave;
  activeCustomLabelReset = onReset;
  customLabelModal.hidden = false;
  customLabelInput.focus();
}

function closeCustomLabelModal() {
  if (!customLabelModal) return;
  customLabelModal.hidden = true;
  activeCustomLabelCallback = null;
  activeCustomLabelReset = null;
}

if (customLabelCloseBtn) customLabelCloseBtn.addEventListener("click", closeCustomLabelModal);
if (customLabelCancelBtn) customLabelCancelBtn.addEventListener("click", closeCustomLabelModal);

if (customLabelSaveBtn) {
  customLabelSaveBtn.addEventListener("click", () => {
    const val = customLabelInput.value.trim();
    if (activeCustomLabelCallback) activeCustomLabelCallback(val);
    closeCustomLabelModal();
  });
}

if (customLabelResetBtn) {
  customLabelResetBtn.addEventListener("click", () => {
    if (activeCustomLabelReset) activeCustomLabelReset();
    closeCustomLabelModal();
  });
}

// Session Modal
let sessionModalMode = "create"; // "create" | "edit" | "rename"

function openSessionModal(mode = "create") {
  if (!sessionModal) return;
  sessionModalMode = mode;
  const current = getActiveSession();
  const targetField = document.getElementById("sessionTargetField");
  if (targetField) targetField.hidden = false;

  if (mode === "edit" || mode === "rename") {
    sessionModalTitle.textContent = "Edit Session Settings";
    sessionNameInput.value = current.name;
    sessionDefaultTarget.value = current.target || "full";
    if (sessionShowCubeCheckbox) sessionShowCubeCheckbox.checked = current.showCube ?? true;
    if (sessionInspectionCheckbox) sessionInspectionCheckbox.checked = current.inspection ?? true;
  } else {
    sessionModalTitle.textContent = `New ${currentPuzzle === "333" ? "3x3" : "2x2"} Session`;
    const matching = sessions.filter(s => (s.puzzle || "222") === currentPuzzle);
    sessionNameInput.value = `${currentPuzzle === "333" ? "3x3 Session" : "Session"} ${matching.length + 1}`;
    sessionDefaultTarget.value = current.target || "full";
    if (sessionShowCubeCheckbox) sessionShowCubeCheckbox.checked = solveShowCube ?? true;
    if (sessionInspectionCheckbox) sessionInspectionCheckbox.checked = solveInspection ?? true;
  }
  sessionModal.hidden = false;
  sessionNameInput.focus();
  sessionNameInput.select();
}

function closeSessionModal() {
  if (!sessionModal) return;
  sessionModal.hidden = true;
}

if (sessionModalCloseBtn) sessionModalCloseBtn.addEventListener("click", closeSessionModal);
if (sessionModalCancelBtn) sessionModalCancelBtn.addEventListener("click", closeSessionModal);

if (sessionModalSaveBtn) {
  sessionModalSaveBtn.addEventListener("click", () => {
    const name = sessionNameInput.value.trim();
    if (!name) {
      alert("Please enter a session name.");
      return;
    }
    const target = sessionDefaultTarget.value || "full";
    const showCube = sessionShowCubeCheckbox ? sessionShowCubeCheckbox.checked : true;
    const inspection = sessionInspectionCheckbox ? sessionInspectionCheckbox.checked : true;

    if (sessionModalMode === "edit" || sessionModalMode === "rename") {
      const sess = getActiveSession();
      sess.name = name;
      sess.target = target;
      sess.showCube = showCube;
      sess.inspection = inspection;
      solveTarget = target;
      solveShowCube = showCube;
      solveInspection = inspection;
      saveSessions();
      saveSettings();
    } else {
      const newId = `session-${Date.now()}`;
      const newSession = {
        id: newId,
        puzzle: currentPuzzle,
        name,
        target,
        inspection,
        showCube,
        solves: []
      };
      sessions.push(newSession);
      activeSessionId = newId;
      solveTarget = target;
      solveShowCube = showCube;
      solveInspection = inspection;
      saveSessions();
      saveSettings();
    }
    closeSessionModal();
    if (solveTargetSelect) solveTargetSelect.value = solveTarget;
    if (solveShowCubeToggle) solveShowCubeToggle.checked = solveShowCube;
    if (solveInspectionToggle) solveInspectionToggle.checked = solveInspection;
    populateSessionSelect();
    renderStage();
    renderSolvePanel();
    regenerateScramble();
  });
}

function populateSessionSelect() {
  const matching = sessions.filter(s => (s.puzzle || "222") === currentPuzzle);
  const options = matching.map(s => {
    return `<option value="${s.id}" ${s.id === activeSessionId ? "selected" : ""}>${escapeHtml(s.name)} (${s.solves ? s.solves.length : 0})</option>`;
  }).join("");

  if (solveSessionSelect) solveSessionSelect.innerHTML = options;

  const current = getActiveSession();
  if (solveSessionBadge) {
    solveSessionBadge.textContent = `${current.name} (${current.solves ? current.solves.length : 0})`;
  }
}

function switchSession(sessId) {
  if (!sessions.some(s => s.id === sessId)) return;
  activeSessionId = sessId;
  const sess = getActiveSession();
  solveTarget = sess.target || "full";
  solveShowCube = sess.showCube ?? true;
  solveInspection = sess.inspection ?? true;
  solves = sess.solves || [];
  lastSolve = solves.length ? solves[solves.length - 1] : null;

  if (solveTargetSelect) solveTargetSelect.value = solveTarget;
  if (solveShowCubeToggle) solveShowCubeToggle.checked = solveShowCube;
  if (solveInspectionToggle) solveInspectionToggle.checked = solveInspection;
  if (solveSessionSelect) solveSessionSelect.value = sessId;

  saveSettings();
  populateSessionSelect();
  renderStage();
  renderSolvePanel();
  updateStatsTable();
  regenerateScramble();
}

function deleteCurrentSession() {
  const matching = sessions.filter(s => (s.puzzle || "222") === currentPuzzle);
  if (matching.length <= 1) {
    alert("You must have at least one session for this puzzle.");
    return;
  }
  const current = getActiveSession();
  if (!confirm(`Are you sure you want to delete session "${current.name}" and all its ${current.solves.length} solves?`)) {
    return;
  }
  sessions = sessions.filter(s => s.id !== current.id);
  const remaining = sessions.filter(s => (s.puzzle || "222") === currentPuzzle);
  activeSessionId = remaining[0].id;
  saveSessions();
  switchSession(activeSessionId);
}

if (solveSessionSelect) {
  solveSessionSelect.addEventListener("change", () => {
    switchSession(solveSessionSelect.value);
  });
}
if (newSessionBtn) {
  newSessionBtn.addEventListener("click", () => openSessionModal("create"));
}
if (renameSessionBtn) {
  renameSessionBtn.addEventListener("click", () => openSessionModal("edit"));
}
if (deleteSessionBtn) {
  deleteSessionBtn.addEventListener("click", deleteCurrentSession);
}
if (solveTargetSelect) {
  solveTargetSelect.addEventListener("change", () => {
    solveTarget = solveTargetSelect.value;
    getActiveSession().target = solveTarget;
    saveSessions();
    const pData = PUZZLES[currentPuzzle];
    if (pData && pData.tracks.some(t => t.id === solveTarget)) {
      currentTrackId = solveTarget;
      ensureTrackSelection();
      buildCasePicker();
      renderSelection();
    }
    saveSettings();
    renderTrackBar();
    renderStage();
    renderSolvePanel();
    regenerateScramble();
  });
}
if (solveShowCubeToggle) {
  solveShowCubeToggle.addEventListener("change", () => {
    solveShowCube = solveShowCubeToggle.checked;
    getActiveSession().showCube = solveShowCube;
    saveSessions();
    saveSettings();
    renderStage();
  });
}
if (solveInspectionToggle) {
  solveInspectionToggle.addEventListener("change", () => {
    solveInspection = solveInspectionToggle.checked;
    getActiveSession().inspection = solveInspection;
    saveSessions();
    saveSettings();
    renderSolvePanel();
  });
}

// ---------------------------------------------------------------------------
// Solve Mode: Scramble, Timer, Sessions, and Stats
// ---------------------------------------------------------------------------

let audioCtx = null;
function playInspectionBeep(freq = 440, duration = 0.08) {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.12, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch {}
}

function playScrambleCompleteChime() {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    const now = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(587.33, now); // D5
    osc.frequency.exponentialRampToValueAtTime(880, now + 0.15); // A5
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start(now);
    osc.stop(now + 0.28);
  } catch {}
}

async function generateWca2x2Scramble() {
  try {
    const scr = await randomScrambleForEvent('222');
    if (scr && typeof scr.toString === 'function') {
      const s = scr.toString().trim();
      if (s) return s;
    }
  } catch (err) {
    console.warn("randomScrambleForEvent failed, using fallback:", err);
  }
  const faces = ["R", "U", "F"];
  const modifiers = ["", "'", "2"];
  const len = 9 + Math.floor(Math.random() * 3);
  let lastFace = "";
  const moves = [];
  for (let i = 0; i < len; i++) {
    const allowed = faces.filter(f => f !== lastFace);
    const face = allowed[Math.floor(Math.random() * allowed.length)];
    lastFace = face;
    const mod = modifiers[Math.floor(Math.random() * modifiers.length)];
    moves.push(face + mod);
  }
  return moves.join(" ");
}

async function generateWca3x3Scramble() {
  try {
    const scrPromise = randomScrambleForEvent('333');
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 800));
    const scr = await Promise.race([scrPromise, timeoutPromise]);
    if (scr && typeof scr.toString === 'function') {
      const s = scr.toString().trim();
      if (s) return s;
    }
  } catch (err) {
    // Fast WCA 3x3 scramble fallback
  }
  const faces = ["R", "L", "U", "D", "F", "B"];
  const modifiers = ["", "'", "2"];
  const moves = [];
  let lastAxis = -1;
  for (let i = 0; i < 21; i++) {
    let axis;
    do {
      axis = Math.floor(Math.random() * 3);
    } while (axis === lastAxis);
    lastAxis = axis;
    const face = faces[axis * 2 + (Math.random() < 0.5 ? 0 : 1)];
    const mod = modifiers[Math.floor(Math.random() * modifiers.length)];
    moves.push(face + mod);
  }
  return moves.join(" ");
}

async function generateWca3x3OhScramble() {
  try {
    const scrPromise = randomScrambleForEvent('333oh');
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1000));
    const scr = await Promise.race([scrPromise, timeoutPromise]);
    if (scr && typeof scr.toString === 'function') {
      const s = scr.toString().trim();
      if (s) return s;
    }
  } catch (err) {}
  return generateWca3x3Scramble();
}

async function generateWca4x4Scramble() {
  try {
    const scrPromise = randomScrambleForEvent('444');
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2500));
    const scr = await Promise.race([scrPromise, timeoutPromise]);
    if (scr && typeof scr.toString === 'function') {
      const s = scr.toString().trim();
      if (s) return s;
    }
  } catch (err) {}
  const faces = ["R", "L", "U", "D", "F", "B", "Rw", "Fw", "Uw"];
  const modifiers = ["", "'", "2"];
  const moves = [];
  let lastFace = "";
  for (let i = 0; i < 40; i++) {
    const allowed = faces.filter(f => f !== lastFace);
    const face = allowed[Math.floor(Math.random() * allowed.length)];
    lastFace = face;
    const mod = modifiers[Math.floor(Math.random() * modifiers.length)];
    moves.push(face + mod);
  }
  return moves.join(" ");
}

async function generateWca5x5Scramble() {
  try {
    const scrPromise = randomScrambleForEvent('555');
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2500));
    const scr = await Promise.race([scrPromise, timeoutPromise]);
    if (scr && typeof scr.toString === 'function') {
      const s = scr.toString().trim();
      if (s) return s;
    }
  } catch (err) {}
  const faces = ["R", "L", "U", "D", "F", "B", "Rw", "Lw", "Fw", "Bw", "Uw", "Dw"];
  const modifiers = ["", "'", "2"];
  const moves = [];
  let lastFace = "";
  for (let i = 0; i < 60; i++) {
    const allowed = faces.filter(f => f !== lastFace);
    const face = allowed[Math.floor(Math.random() * allowed.length)];
    lastFace = face;
    const mod = modifiers[Math.floor(Math.random() * modifiers.length)];
    moves.push(face + mod);
  }
  return moves.join(" ");
}

function formatSolveDisplay(s) {
  if (!s) return "-";
  if (s.penalty === "DNF") return "DNF";
  const formatted = formatSolveTime(s.ms);
  if (s.penalty === "+2") return `${formatted} (+2)`;
  return formatted;
}

function formatCfopSplitMs(ms) {
  if (ms == null || !Number.isFinite(ms)) return "-";
  return `${(ms / 1000).toFixed(2)}s`;
}

// Short "pick-up 0.45s · put-down 0.38s" summary for GAN-timer solves (empty otherwise).
function renderSolvePhaseInline(solve) {
  if (!solve || (solve.pickupMs == null && solve.putdownMs == null)) return "";
  const parts = [];
  if (solve.pickupMs != null) parts.push(`pick-up <strong>${formatCfopSplitMs(solve.pickupMs)}</strong>`);
  if (solve.putdownMs != null) parts.push(`put-down <strong>${formatCfopSplitMs(solve.putdownMs)}</strong>`);
  return `<span class="solve-phase-inline" title="Measured between GAN timer and smart cube events">⏱ ${parts.join(" · ")}</span>`;
}

function renderCfopStepTable(solve, { detailed = false } = {}) {
  const cfop = ensureSolveCfop(solve);
  if (!cfop || (!cfop.steps?.length && !cfop.splits)) return "";

  const displayRows = [];
  for (const st of (cfop.steps || [])) {
    displayRows.push(st);
    if (st.phase === "f2l4" && cfop.f2lSummary) {
      displayRows.push(cfop.f2lSummary);
    }
  }

  if (displayRows.length === 0) return "";

  const rowsHtml = displayRows.map(row => {
    const isSummaryRow = row.phase === "f2lTotal";
    let stepBadgeClass = "cfop-step-badge-default";
    if (row.phase === "f2lTotal") stepBadgeClass = "cfop-step-badge-f2lsum";
    else if (row.phase === "oll") stepBadgeClass = "cfop-step-badge-oll";
    else if (row.phase === "pll") stepBadgeClass = "cfop-step-badge-pll";
    else if (row.phase === "cross") stepBadgeClass = "cfop-step-badge-cross";

    let caseDisplay = escapeHtml(row.caseId || "-");
    if (row.phase === "oll" && row.caseId && row.caseId !== "-") {
      const fullTitle = cfop.ollCase?.name ? ` title="${escapeHtml(cfop.ollCase.name)}"` : "";
      caseDisplay = `<span class="badge badge-oll-case"${fullTitle}>${escapeHtml(row.caseId)}</span>`;
    } else if (row.phase === "pll" && row.caseId && row.caseId !== "-") {
      const fullTitle = cfop.pllCase?.name ? ` title="${escapeHtml(cfop.pllCase.name)}"` : "";
      caseDisplay = `<span class="badge badge-pll-case"${fullTitle}>${escapeHtml(row.caseId)}</span>`;
    } else if (row.phase.startsWith("f2l") && row.phase !== "f2lTotal") {
      caseDisplay = `<span class="cfop-slot-tag">${escapeHtml(row.caseId || "-")}</span>`;
    }

    const recogTxt = row.phase === "cross"
      ? `<span class="cfop-muted-dash">-</span>`
      : formatCfopSplitMs(row.recogMs);

    const setupTxt = row.setupMoves
      ? `<code class="cfop-setup-code">${escapeHtml(row.setupMoves)}</code>`
      : `<span class="cfop-muted-dash">-</span>`;

    const execTxt = formatCfopSplitMs(row.execMs);
    const totalTxt = `<strong>${formatCfopSplitMs(row.ms)}</strong>`;
    const accumTxt = formatCfopSplitMs(row.accumMs);

    const movesTxt = row.moveCount != null
      ? `${row.moveCount}${detailed && row.tps ? ` <small class="cfop-sub-meta">(${row.tps} TPS)</small>` : ''}`
      : "-";

    const pauseTxt = row.pauseCount > 0
      ? `<span class="pause-cell-warn">${row.pauseCount} <small>(${formatCfopSplitMs(row.pauseMs)})</small></span>`
      : `<span class="pause-cell-clean">0</span>`;

    const reconStr = row.execMoves || row.moves || "";
    const reconTxt = isSummaryRow
      ? `<span class="cfop-muted-dash">-</span>`
      : (reconStr ? `<code class="cfop-recon-code">${escapeHtml(reconStr)}</code>` : `<span class="cfop-muted-dash">-</span>`);

    return `
      <tr class="cfop-step-row cfop-row-${row.phase} ${isSummaryRow ? 'cfop-row-f2l-summary' : ''}">
        <td class="cfop-col-step"><span class="cfop-step-badge ${stepBadgeClass}">${escapeHtml(row.label)}</span></td>
        <td class="cfop-col-case">${caseDisplay}</td>
        <td class="cfop-col-recog">${recogTxt}</td>
        <td class="cfop-col-setup">${setupTxt}</td>
        <td class="cfop-col-exec">${execTxt}</td>
        <td class="cfop-col-total">${totalTxt}</td>
        <td class="cfop-col-accum">${accumTxt}</td>
        <td class="cfop-col-moves">${movesTxt}</td>
        <td class="cfop-col-pauses">${pauseTxt}</td>
        <td class="cfop-col-recon">${reconTxt}</td>
      </tr>
    `;
  }).join("");

  const realSteps = (cfop.steps || []);
  const totalRecogMs = realSteps.reduce((acc, s) => acc + (s.phase === "cross" ? 0 : (s.recogMs || 0)), 0);
  const totalExecMs = realSteps.reduce((acc, s) => acc + (s.execMs || 0), 0);
  const solveMs = solve.rawMs ?? solve.ms ?? realSteps.reduce((acc, s) => acc + (s.ms || 0), 0);
  const totalMoves = solve.moveCount ?? realSteps.reduce((acc, s) => acc + (s.moveCount || 0), 0);
  const pCnt = cfop.pauses?.totalCount || 0;
  const pMs = cfop.pauses?.totalMs || 0;

  return `
    <div class="cfop-step-table-wrap ${detailed ? 'cfop-step-table-detailed' : 'cfop-step-table-base'}">
      <table class="cfop-step-breakdown-table">
        <thead>
          <tr>
            <th scope="col">Step</th>
            <th scope="col">Case</th>
            <th scope="col" title="Recognition + pre-AUF time">Recog</th>
            <th scope="col" title="Pre-AUF / rotation setup moves (e.g. U, U', U2)">Setup</th>
            <th scope="col" title="Execution time after recognition">Exec</th>
            <th scope="col" title="Total time for this step (Recog + Exec)">Total</th>
            <th scope="col" title="Total accumulated solve time after this step">Accum</th>
            <th scope="col">Moves</th>
            <th scope="col" title="Pauses ≥0.40s during this step">Pauses</th>
            <th scope="col" class="cfop-th-recon">Recon</th>
          </tr>
        </thead>
        <tbody>
          ${rowsHtml}
        </tbody>
        <tfoot>
          <tr class="cfop-step-tfoot-row">
            <th scope="row" colspan="2">Solve Total</th>
            <td>${formatCfopSplitMs(totalRecogMs)}</td>
            <td><span class="cfop-muted-dash">-</span></td>
            <td>${formatCfopSplitMs(totalExecMs)}</td>
            <td><strong>${formatCfopSplitMs(solveMs)}</strong></td>
            <td><strong>${formatCfopSplitMs(solveMs)}</strong></td>
            <td><strong>${totalMoves}</strong>${solve.tps ? ` <small class="cfop-sub-meta">(${solve.tps} TPS)</small>` : ''}</td>
            <td>
              <span class="cfop-step-badge ${pCnt > 0 ? 'cfop-step-badge-pause' : 'cfop-step-badge-default'}">
                ${pCnt} (${formatCfopSplitMs(pMs)})
              </span>
            </td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>
  `;
}

function renderLastSolveCfopInline(solve) {
  return renderCfopStepTable(solve, { detailed: false });
}

function renderSolvePanel() {
  populateSessionSelect();
  const currentSess = getActiveSession();
  solves = currentSess.solves || [];

  if (solveTargetSelect) solveTargetSelect.value = solveTarget;
  if (solveShowCubeToggle) solveShowCubeToggle.checked = solveShowCube;
  if (solveInspectionToggle) solveInspectionToggle.checked = solveInspection;

  const currentScr = scrambleMoves || currentSolveScramble || scramble;
  const st = smartCube.getStatus();
  if (st.connected && smartCubeStage === "scrambling" && !scrambleTracker.isComplete()) {
    renderSmartScrambleAssistant();
  } else if (solveScrambleText) {
    solveScrambleText.textContent = currentScr;
  }
  updateSmartCubeIndicator();
  if (solveScrambleOrient) {
    const isWhiteBottom = solveTarget === "cll" || (currentPuzzle === "333" && ["f2l", "oll", "pll"].includes(solveTarget));
    solveScrambleOrient.textContent = isWhiteBottom ? "(white on bottom)" : "(WCA orientation)";
  }

  if (solveScrambleSource) {
    solveScrambleSubtext.innerHTML = solveScrambleSource;
    solveScrambleSubtext.hidden = false;
  } else {
    solveScrambleSubtext.hidden = true;
    solveScrambleSubtext.textContent = "";
  }

  if (lastSolve) {
    if (!isCfopAnalyzerReady()) {
      initCfopAnalyzer().then(() => {
        if (lastSolve) renderSolvePanel();
      });
    }
    ensureSolveCfop(lastSolve);
    solveTimeEl.textContent = formatSolveDisplay(lastSolve);
    let metaLine = "";
    if (lastSolve.id && caseById.has(lastSolve.id)) {
      const caseObj = caseById.get(lastSolve.id);
      metaLine = `<strong>${lastSolve.id}</strong> · ${getCllCaseSolutionDisplay(caseObj)} · opposite ${caseObj.opposite}`;
    } else {
      const targetLabel = lastSolve.target === "layer" ? "1st Layer" : (lastSolve.target === "face" ? "1st Face" : "Full Solve");
      metaLine = `<span class="solve-case-target">${targetLabel}</span>`;
    }
    if (lastSolve.moves && lastSolve.moves.length > 0) {
      metaLine += ` · <strong>${lastSolve.moveCount} moves</strong> · <strong>${lastSolve.tps} TPS</strong>`;
    }
    const phaseMeta = renderSolvePhaseInline(lastSolve);
    if (phaseMeta) metaLine += ` · ${phaseMeta}`;
    if (lastSolve.moves && lastSolve.moves.length > 0) {
      solveCaseEl.innerHTML = `<div class="solve-case-meta">${metaLine}</div>` + renderLastSolveCfopInline(lastSolve);
      if (solvePostSummary && solvePostReplayBtn) {
        solvePostSummary.hidden = false;
        solvePostReplayBtn.onclick = () => {
          solveReplayViewer.open(lastSolve, "Latest Solve Replay");
        };
      }
    } else {
      solveCaseEl.innerHTML = `<div class="solve-case-meta">${metaLine}</div>`;
      if (solvePostSummary) solvePostSummary.hidden = true;
    }
  } else {
    solveTimeEl.textContent = "0.00";
    solveCaseEl.textContent = solveInspection
      ? "Scramble cube, then inspect & start timer."
      : "Scramble cube, then hold to arm & start timer.";
    if (solvePostSummary) solvePostSummary.hidden = true;
  }

  const keyHint = solveSurface.querySelector(".solve-hint-key");
  const touchHint = solveSurface.querySelector(".solve-hint-touch");
  const timerConnected = ganTimer.isConnected();
  if (keyHint) {
    keyHint.innerHTML = timerConnected
      ? (solveInspection
        ? "Space to inspect &bull; Use the GAN timer to start &amp; stop"
        : "GAN timer connected &bull; Hands on timer, release to start")
      : solveInspection
      ? "Space to inspect &bull; Hold Space to arm &bull; Release to start"
      : "Hold Space to arm &bull; Release to start &bull; any key to stop";
  }
  if (touchHint) {
    touchHint.innerHTML = timerConnected
      ? (solveInspection
        ? "Tap to inspect &bull; Use the GAN timer to start &amp; stop"
        : "GAN timer connected &bull; Hands on timer, release to start")
      : solveInspection
      ? "Tap to inspect &bull; Hold to arm &bull; Release to start"
      : "Tap and hold to arm &bull; Release to start";
  }

  if (solves.length) {
    const valid = solves.filter(s => s.penalty !== "DNF").map(s => (s.penalty === "+2" ? s.ms + 2000 : s.ms));
    const best = valid.length ? Math.min(...valid) : null;
    const mean = valid.length ? Math.round(valid.reduce((sum, x) => sum + x, 0) / valid.length) : null;
    const median = valid.length ? computeMedian(valid) : null;
    const trimMean = valid.length ? computeTrimmedMean(valid, 0.10) : null;
    const avgPickup = averagePhase(solves, "pickupMs");
    const avgPutdown = averagePhase(solves, "putdownMs");
    const phaseSummary = (avgPickup != null || avgPutdown != null)
      ? ` · avg pick-up ${avgPickup != null ? formatCfopSplitMs(avgPickup) : "-"} · avg put-down ${avgPutdown != null ? formatCfopSplitMs(avgPutdown) : "-"}`
      : "";
    const pageSizeOptions = LOG_PAGE_SIZE_OPTIONS.map(sz =>
      `<option value="${sz}" ${sessionLogPageSize === sz ? 'selected' : ''}>${sz}</option>`
    ).join("");
    solveSummaryEl.innerHTML = `
      <span>${solves.length} solve${solves.length === 1 ? "" : "s"} · best ${best != null ? formatSolveTime(best) : "-"} · median <strong>${median != null ? formatSolveTime(median) : "-"}</strong> · trim10% ${trimMean != null ? formatSolveTime(trimMean) : "-"} · mean ${mean != null ? formatSolveTime(mean) : "-"}${phaseSummary}</span>
      <label class="solve-page-size-inline">Show: <select id="solvePanelPageSizeSelect" class="log-page-size-select" aria-label="Solves shown">${pageSizeOptions}</select></label>
    `;
    const pageSizeSel = document.getElementById("solvePanelPageSizeSelect");
    if (pageSizeSel) {
      pageSizeSel.addEventListener("change", () => {
        const nextSz = Number(pageSizeSel.value);
        if (LOG_PAGE_SIZE_OPTIONS.includes(nextSz)) {
          sessionLogPageSize = nextSz;
          sessionLogPage = 1;
          saveSettings();
          renderSolvePanel();
          renderSessionLogTable();
        }
      });
    }
  } else {
    solveSummaryEl.textContent = "No times in this session yet";
  }
  clearSolvesBtn.hidden = solves.length === 0;

  renderSolveStatsBar(solveStatsBar, solves);

  const recent = solves
    .map((solve, index) => ({ solve, index }))
    .reverse()
    .slice(0, sessionLogPageSize);
  solveList.innerHTML = recent
    .map(({ solve, index }) => {
      const cfop = ensureSolveCfop(solve);
      const caseBadges = [];
      if (solve.id) caseBadges.push(solve.id);
      if (cfop?.ollCase?.shortName && cfop.ollCase.id !== "OLL Skip") caseBadges.push(cfop.ollCase.shortName);
      if (cfop?.pllCase?.shortName && cfop.pllCase.id !== "PLL Skip") caseBadges.push(cfop.pllCase.shortName);
      const badgeLabel = caseBadges.join(" · ");
      return `
      <button type="button" class="solve-chip ${solve.moves ? 'has-replay' : ''}" data-index="${index}" title="Solve #${index + 1}: ${formatSolveDisplay(solve)} ${badgeLabel ? `(${badgeLabel})` : ''} ${solve.moves ? `· ${solve.moveCount} moves (${solve.tps} TPS) · Click to view details` : ''}">
        <span class="solve-chip-time">${formatSolveDisplay(solve)}</span>
        ${badgeLabel ? `<span class="solve-chip-id">${escapeHtml(badgeLabel)}</span>` : ''}
        <span class="solve-chip-actions">
          ${solve.moves ? `<span class="solve-chip-replay-tag" title="Replay 3D Solve">&#x25B6;</span>` : ''}
          <span class="solve-chip-del" title="Delete solve" aria-label="Delete solve">&times;</span>
        </span>
      </button>
    `.trim();
    })
    .join("");

  if (layerSolutionsWidget) {
    layerSolutionsWidget.hidden = mode !== "solve" || currentPuzzle !== "222" || solveTarget === "timer-drill";
    if (!layerSolutionsWidget.hidden) {
      updateFaceChipsUI();
    }
  }
  if (crossSolutionsWidget) {
    crossSolutionsWidget.hidden = mode !== "solve" || (currentPuzzle !== "333" && currentPuzzle !== "333oh") || solveTarget === "timer-drill";
    if (!crossSolutionsWidget.hidden) {
      updateCrossFacesUI();
    }
  }
  renderTimerDrillBanner();
}

function startSolveInspection() {
  if (mode !== "solve" || solveState !== "idle") return;
  solveState = "inspecting";
  solvePenalty = null;
  solveWarning8Played = false;
  solveWarning12Played = false;
  solveInspectionStart = performance.now();

  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();

  solveOverlay.className = "solve-overlay inspecting";
  solveOverlay.hidden = false;
  if (solveOverlayCancelBtn) solveOverlayCancelBtn.hidden = false;
  solveOverlayTime.textContent = "15";
  solveOverlayHint.textContent = ganTimer.isConnected()
    ? "Start the GAN timer when ready · Esc to cancel"
    : "Hold Space when ready · Esc to cancel";

  clearInterval(solveInspectionInterval);
  solveInspectionInterval = setInterval(() => {
    if (solveState !== "inspecting" && solveState !== "armed") return;
    const elapsedSec = Math.floor((performance.now() - solveInspectionStart) / 1000);
    const remaining = 15 - elapsedSec;

    if (remaining > 0) {
      if (solveState === "inspecting") {
        solveOverlayTime.textContent = String(remaining);
      }
      if (remaining <= 7 && remaining > 3 && !solveWarning8Played) {
        solveWarning8Played = true;
        playInspectionBeep(440, 0.08);
        solveOverlay.classList.add("warning-8");
      }
      if (remaining <= 3 && !solveWarning12Played) {
        solveWarning12Played = true;
        playInspectionBeep(880, 0.1);
        solveOverlay.classList.remove("warning-8");
        solveOverlay.classList.add("warning-12");
      }
    } else if (remaining <= 0 && remaining >= -2) {
      solvePenalty = "+2";
      solveOverlay.classList.remove("warning-8", "warning-12");
      solveOverlay.classList.add("penalty-plus2");
      if (solveState === "inspecting") {
        solveOverlayTime.textContent = "+2";
      }
      solveOverlayHint.textContent = ganTimer.isConnected()
        ? "+2 penalty · Start the GAN timer"
        : "+2 penalty · Hold Space when ready";
    } else {
      solvePenalty = "DNF";
      solveOverlay.classList.remove("warning-8", "warning-12", "penalty-plus2");
      solveOverlay.classList.add("penalty-dnf");
      if (solveState === "inspecting") {
        solveOverlayTime.textContent = "DNF";
      }
      solveOverlayHint.textContent = "Inspection exceeded 17s (DNF)";
    }
  }, 100);
}

function armSolve() {
  if (mode !== "solve" || (solveState !== "idle" && solveState !== "inspecting")) return;
  if (solveTarget === "cll" && !currentCaseId) return;
  // With a GAN Smart Timer connected, arming/starting is done on the timer itself.
  if (ganTimer.isConnected()) return;
  solveState = "armed";
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();

  solveOverlay.hidden = false;
  solveOverlay.classList.add("armed");
  if (solveOverlayCancelBtn) solveOverlayCancelBtn.hidden = false;

  if (solvePenalty === "+2") {
    solveOverlayTime.textContent = "+2";
  } else if (solvePenalty === "DNF") {
    solveOverlayTime.textContent = "DNF";
  } else {
    solveOverlayTime.textContent = "0.00";
  }
  solveOverlayHint.textContent = "Release to start";
}

function resetTimerPhaseTracking() {
  solveTimerDriven = false;
  solveTimerStartTs = 0;
  solveFirstMoveTs = 0;
  solveCubeSolvedTs = 0;
  solveMoveOrigin = 0;
}

function getRunningOverlayHint() {
  if (solveTimerDriven) {
    if (solveCubeSolvedTs) return "✓ Cube solved · Put it down & stop the GAN timer";
    const base = "Stop the GAN timer to finish · Esc to cancel";
    if (solvePenalty === "+2") return `Running (+2 penalty) · ${base}`;
    if (solvePenalty === "DNF") return `Running (DNF) · ${base}`;
    return base;
  }
  return solvePenalty === "+2"
    ? "Running (+2 penalty) · Any key, tap, or solve cube to stop"
    : (solvePenalty === "DNF" ? "Running (DNF) · Any key, tap, or solve cube to stop" : "Any key, tap, or solve cube to stop");
}

// fromSmartCube: started by the first smart cube turn.
// options.timerDriven: started by the GAN Smart Timer (startTs = local receipt time of RUNNING).
function startSolve(fromSmartCube = false, { timerDriven = false, startTs = null } = {}) {
  const autoStart = fromSmartCube || timerDriven;
  if (!autoStart && solveState !== "armed") return;
  if (autoStart && solveState !== "inspecting" && solveState !== "idle" && solveState !== "armed") return;
  solveState = "running";
  clearInterval(solveInspectionInterval);
  clearTimeout(solveArmTimeout);

  solveStart = startTs != null ? startTs : performance.now();
  solveTimerDriven = timerDriven;
  solveTimerStartTs = timerDriven ? solveStart : 0;
  solveCubeSolvedTs = 0;

  // With a GAN timer, face turns made before the timer started (pre-turns) are kept so the
  // replay stays consistent; pick-up time is then undefined for this solve.
  const keepPreTimerMoves = timerDriven && solveFirstMoveTs > 0 && trackedSolveMoves.length > 0;
  if (!keepPreTimerMoves) {
    trackedSolveMoves = [];
    solveFirstMoveTs = 0;
    solveMoveOrigin = solveStart;
  }

  solveOverlay.className = "solve-overlay";
  solveOverlay.hidden = false;
  // Timer-driven solves can only be stopped on the timer, so keep a cancel button available.
  if (solveOverlayCancelBtn) solveOverlayCancelBtn.hidden = !timerDriven;
  solveOverlayHint.textContent = getRunningOverlayHint();

  if (solveLiveStats) solveLiveStats.hidden = false;
  if (solveLiveMovesCount) solveLiveMovesCount.textContent = `${trackedSolveMoves.length} moves`;
  if (solveLiveTps) solveLiveTps.textContent = "0.00 TPS";
  if (solvePostSummary) solvePostSummary.hidden = true;

  const tick = () => {
    if (solveState !== "running") return;
    solveOverlayTime.textContent = formatSolveTime(performance.now() - solveStart);
    solveRaf = requestAnimationFrame(tick);
  };
  tick();
}

// Called when the smart cube reports a solved state (during a solve or during scrambling).
function handleSmartCubeSolved() {
  if (mode === "solve" && solveState === "idle" && smartCubeStage === "scrambling") {
    const trackerStatus = scrambleTracker.getStatus();
    if (!trackerStatus.isComplete && (trackerStatus.hasError || trackerStatus.currentIndex > 0 || trackerStatus.currentSubAmount > 0 || trackerStatus.corrections.length > 0)) {
      clearScrambleCorrectionDelay();
      smartCube.setScramble("", currentPuzzle);
      scrambleTracker.reset(currentSolveScramble);
      smartCube.logDiag("SCRAMBLE_AUTO_RESET_ON_SOLVED", { scramble: currentSolveScramble });
      renderSmartScrambleAssistant();
    }
    return;
  }
  if (mode !== "solve" || solveState !== "running") return;
  // Ignore solved events if 0 moves have been made in this solve (e.g., periodic BLE_FACELETS in timer-drill before first turn)
  if (!trackedSolveMoves || trackedSolveMoves.length === 0) return;
  if (solveTimerDriven) {
    // GAN timer is authoritative: just mark the moment the cube was solved (put-down starts).
    if (!solveFirstMoveTs || solveCubeSolvedTs) return;
    solveCubeSolvedTs = performance.now();
    smartCube.logDiag("TIMER_CUBE_SOLVED", { sinceTimerStart: Math.round(solveCubeSolvedTs - solveTimerStartTs) });
    solveOverlay.classList.add("cube-solved");
    solveOverlayHint.textContent = getRunningOverlayHint();
    updateSmartCubeIndicator();
    return;
  }
  if (solveTimerStartTs > 0 && !solveCubeSolvedTs) {
    solveCubeSolvedTs = performance.now();
  }
  stopSolve(false);
  smartCubeStage = solveTarget === "timer-drill" ? (solveInspection ? "inspecting" : "ready") : "scrambling";
  updateSmartCubeIndicator();
}

// options.hardwareMs: time recorded by the GAN timer; options.stopTs: local receipt time of STOPPED.
function stopSolve(byPointer, { hardwareMs = null, stopTs = null } = {}) {
  if (solveState !== "running") return;
  const localStopTs = stopTs != null ? stopTs : performance.now();
  const localMs = localStopTs - solveStart;
  const rawMs = Number.isFinite(hardwareMs) && hardwareMs > 0 ? hardwareMs : localMs;
  solveState = "idle";
  cancelAnimationFrame(solveRaf);
  clearInterval(solveInspectionInterval);

  let finalMs = Math.round(rawMs);
  if (solvePenalty === "+2") {
    finalMs += 2000;
  }

  const scr = scrambleMoves || currentSolveScramble || scramble;
  const isCaseTarget = ["cll", "pll", "oll", "f2l", "ortega", "timer-drill"].includes(solveTarget);

  const hasMoves = trackedSolveMoves && trackedSolveMoves.length > 0;
  const moveCount = hasMoves ? trackedSolveMoves.length : null;
  const smartCubeName = hasMoves ? (smartCube.deviceName || (smartCube.isVirtual ? "Virtual Keyboard Cube" : "Smart Cube")) : null;

  const hadGanTimerStart = solveTimerDriven || solveTimerStartTs > 0;
  let phases = null;
  if (hadGanTimerStart) {
    phases = computeSolvePhaseSplits({
      timerStartTs: solveTimerStartTs,
      firstMoveTs: hasMoves ? solveFirstMoveTs : 0,
      solvedTs: hasMoves ? (solveCubeSolvedTs || (!solveTimerDriven ? localStopTs : 0)) : 0,
      timerStopTs: solveTimerDriven ? localStopTs : 0
    });
  }
  // TPS is based on the actual cube-turning time when known (excludes pick-up / put-down).
  const tpsBaseMs = phases?.cubeMs != null ? phases.cubeMs : rawMs;
  const tps = hasMoves && tpsBaseMs > 0 ? Number((moveCount / (tpsBaseMs / 1000)).toFixed(2)) : null;

  lastSolve = {
    puzzle: currentPuzzle,
    track: currentTrackId,
    target: solveTarget,
    id: isCaseTarget ? (currentCaseId || null) : null,
    ms: finalMs,
    rawMs: Math.round(rawMs),
    penalty: solvePenalty,
    at: Date.now(),
    scramble: scr,
    moves: hasMoves ? [...trackedSolveMoves] : null,
    moveCount,
    tps,
    smartCube: smartCubeName
  };
  if (hadGanTimerStart) {
    lastSolve.timer = "GAN Smart Timer";
    lastSolve.pickupMs = phases.pickupMs;
    lastSolve.cubeMs = phases.cubeMs;
    lastSolve.putdownMs = phases.putdownMs;
    smartCube.logDiag("TIMER_SOLVE_DONE", { rawMs: lastSolve.rawMs, ...phases });
  }
  resetTimerPhaseTracking();
  ensureSolveCfop(lastSolve);
  sessionLogPage = 1;
  solves.push(lastSolve);
  if (solves.length > MAX_SOLVES) solves.splice(0, solves.length - MAX_SOLVES);
  saveSolves();

  solveOverlayTime.textContent = formatSolveDisplay(lastSolve);

  if (solveLiveStats) solveLiveStats.hidden = true;
  if (hasMoves && solvePostSummary && solvePostReplayBtn) {
    solvePostSummary.hidden = false;
    solvePostReplayBtn.onclick = () => {
      solveReplayViewer.open(lastSolve, "Latest Solve Replay");
    };
  }

  if (byPointer) {
    overlayHideOnPointerUp = true;
    setTimeout(() => { if (overlayHideOnPointerUp) hideSolveOverlay(); }, 500);
  } else {
    hideSolveOverlay();
  }

  smartCubeStage = "scrambling";
  renderSolvePanel();
  updateStatsTable();
  regenerateScramble();
}

function hideSolveOverlay() {
  overlayHideOnPointerUp = false;
  solveOverlay.hidden = true;
  solveOverlay.className = "solve-overlay";
  if (solveOverlayCancelBtn) solveOverlayCancelBtn.hidden = true;
}

function cancelSolve() {
  solveState = "idle";
  smartCubeStage = "scrambling";
  clearScrambleCorrectionDelay();
  cancelAnimationFrame(solveRaf);
  clearInterval(solveInspectionInterval);
  clearTimeout(solveArmTimeout);
  solvePenalty = null;
  trackedSolveMoves = [];
  resetTimerPhaseTracking();
  if (solveLiveStats) solveLiveStats.hidden = true;
  hideSolveOverlay();
  if (smartCube.getStatus().connected) {
    scrambleTracker.reset(currentSolveScramble);
    renderSmartScrambleAssistant();
  }
  renderSolvePanel();
}

function reattemptScramble(scrambleStr, label = "") {
  if (!scrambleStr) return;
  setMode("solve");
  currentCaseId = null;
  solveScrambleSource = `Loaded scramble from <strong>${escapeHtml(label || 'previous solve')}</strong> · Ready to inspect &amp; start`;
  updateSolveScrambleDisplay(scrambleStr);
  if (solveScrambleSubtext) {
    solveScrambleSubtext.innerHTML = solveScrambleSource;
    solveScrambleSubtext.hidden = false;
  }
  applyScrambleToDisplay(scrambleStr);
  applyReflection();
  resetCubeOrientation();
  updateLayerSolutions(scrambleStr);
  if (solveState !== "idle") {
    cancelSolve();
  }
  renderSolvePanel();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function toggleSolveCustomScramble(show) {
  if (!solveCustomScrambleRow) return;
  const willShow = show !== undefined ? show : solveCustomScrambleRow.hidden;
  solveCustomScrambleRow.hidden = !willShow;
  if (willShow) {
    solveCustomScrambleBtn?.classList.add("active");
    if (solveCustomInput) {
      solveCustomInput.value = currentSolveScramble || scrambleMoves || scramble || "";
      solveCustomInput.focus();
      solveCustomInput.select();
    }
  } else {
    solveCustomScrambleBtn?.classList.remove("active");
  }
}

function applyCustomSolveScramble() {
  if (!solveCustomInput) return;
  const raw = solveCustomInput.value.trim();
  if (!raw) {
    alert("Please enter a scramble sequence.");
    solveCustomInput.focus();
    return;
  }
  try {
    const parsed = new Alg(raw);
    const normalized = parsed.toString().trim();
    if (!normalized) {
      alert("Please enter a valid scramble.");
      return;
    }
    solveScrambleSource = `Custom scramble loaded · Ready to inspect &amp; start`;
    currentSolveScramble = normalized;
    scrambleMoves = normalized;
    scramble = normalized;
    currentCaseId = null;
    applyScrambleToDisplay(normalized);
    applyReflection();
    resetCubeOrientation();
    updateLayerSolutions(normalized);
    if (solveState !== "idle") {
      cancelSolve();
    }
    toggleSolveCustomScramble(false);
    renderSolvePanel();
  } catch (err) {
    alert(`Invalid scramble syntax: ${err.message || 'Check for invalid moves'}`);
    solveCustomInput.focus();
  }
}

const ALL_LAYER_FACES = ["white", "yellow", "green", "blue", "red", "orange"];

function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function updateFaceChipsUI() {
  if (!layerFacesChips) return;
  const chipButtons = layerFacesChips.querySelectorAll(".face-chip");
  chipButtons.forEach(chip => {
    const face = chip.dataset.face;
    const isActive = layerTargetFaces.includes(face);
    chip.classList.toggle("active", isActive);
    chip.setAttribute("aria-pressed", String(isActive));
  });

  const targetName = solveTarget === "face" ? "1st face" : "1st layer";

  if (layerSolutionsTitle) {
    if (layerTargetFaces.length === 6) {
      layerSolutionsTitle.textContent = `${targetName} solutions (All 6 / CN)`;
    } else if (layerTargetFaces.length === 1) {
      layerSolutionsTitle.textContent = `${targetName} solutions (${capitalize(layerTargetFaces[0])})`;
    } else if (layerTargetFaces.length === 2 && layerTargetFaces.includes('white') && layerTargetFaces.includes('yellow')) {
      layerSolutionsTitle.textContent = `${targetName} solutions (W / Y)`;
    } else {
      layerSolutionsTitle.textContent = `${targetName} solutions (${layerTargetFaces.map(f => capitalize(f)).join(', ')})`;
    }
  }

  if (layerPresetWhiteBtn) {
    layerPresetWhiteBtn.classList.toggle("active", layerTargetFaces.length === 1 && layerTargetFaces[0] === 'white');
  }
  if (layerPresetOppositeBtn) {
    layerPresetOppositeBtn.classList.toggle("active", layerTargetFaces.length === 2 && layerTargetFaces.includes('white') && layerTargetFaces.includes('yellow'));
  }
  if (layerPresetAllBtn) {
    layerPresetAllBtn.classList.toggle("active", layerTargetFaces.length === 6);
  }
}

function setTargetFaces(faces) {
  const filtered = faces.filter(f => ALL_LAYER_FACES.includes(f));
  if (!filtered.length) return;
  layerTargetFaces = filtered;
  saveSettings();
  updateFaceChipsUI();
  const scr = currentSolveScramble || scrambleMoves || scramble;
  if (scr) {
    updateLayerSolutions(scr);
  }
}

function toggleTargetFace(face) {
  if (!ALL_LAYER_FACES.includes(face)) return;
  let next;
  if (layerTargetFaces.includes(face)) {
    if (layerTargetFaces.length <= 1) {
      return; // Keep at least one face selected
    }
    next = layerTargetFaces.filter(f => f !== face);
  } else {
    next = [...layerTargetFaces, face];
  }
  setTargetFaces(next);
}

let currentLayerSolutions = [];
let currentLayerSolutionsScramble = "";
let currentLayerSolutionsFacesKey = "";
let layerSolutionMode = "layer"; // "layer" | "face"

const layerModeLayerBtn = document.getElementById("layerModeLayerBtn");
const layerModeFaceBtn = document.getElementById("layerModeFaceBtn");
const layerSolutionsTitleEl = document.getElementById("layerSolutionsTitle");

function setLayerSolutionMode(nextMode) {
  layerSolutionMode = nextMode === "face" ? "face" : "layer";
  if (layerModeLayerBtn) {
    const isL = layerSolutionMode === "layer";
    layerModeLayerBtn.classList.toggle("active", isL);
    layerModeLayerBtn.setAttribute("aria-pressed", String(isL));
  }
  if (layerModeFaceBtn) {
    const isF = layerSolutionMode === "face";
    layerModeFaceBtn.classList.toggle("active", isF);
    layerModeFaceBtn.setAttribute("aria-pressed", String(isF));
  }
  if (layerSolutionsTitleEl) {
    const facesShort = layerTargetFaces.length === 6 ? "All 6" : layerTargetFaces.map(f => f[0].toUpperCase()).join(" / ");
    layerSolutionsTitleEl.textContent = `${layerSolutionMode === "face" ? "1st face (Ortega)" : "1st layer"} solutions (${facesShort})`;
  }
  const scr = mode === "simulate"
    ? [freeMoveBaseScramble, ...userFreeMoves].filter(Boolean).join(" ").trim()
    : (currentSolveScramble || currentLayerSolutionsScramble);
  updateLayerSolutions(scr);
}

if (layerModeLayerBtn) layerModeLayerBtn.addEventListener("click", () => setLayerSolutionMode("layer"));
if (layerModeFaceBtn) layerModeFaceBtn.addEventListener("click", () => setLayerSolutionMode("face"));

function updateLayerSolutions(scrambleStr) {
  if (!scrambleStr) {
    if (layerSolutionsList) {
      layerSolutionsList.innerHTML = '<p class="layer-solutions-empty">No scramble loaded (or cube is solved). Load a scramble or use Free Face Turns to build a state.</p>';
    }
    if (layerSolutionsBadge) layerSolutionsBadge.textContent = "";
    return;
  }
  const facesKey = `${layerSolutionMode}:${[...layerTargetFaces].sort().join(",")}`;
  currentLayerSolutionsScramble = scrambleStr;
  currentLayerSolutionsFacesKey = facesKey;
  if (layerSolutionsBadge) layerSolutionsBadge.textContent = "searching...";
  if (layerSolutionsList) {
    const facesDesc = layerTargetFaces.length === 6 ? 'all 6 faces' : layerTargetFaces.map(f => capitalize(f)).join('/');
    const targetName = layerSolutionMode === "face" ? "1st face (Ortega)" : "1st layer";
    layerSolutionsList.innerHTML = `<p class="layer-solutions-empty">Searching for ${escapeHtml(facesDesc)} ${targetName} solutions...</p>`;
  }

  setTimeout(async () => {
    if (currentLayerSolutionsScramble !== scrambleStr || currentLayerSolutionsFacesKey !== facesKey) return;
    try {
      const sols = layerSolutionMode === "face"
        ? await findFaceSolutions(scrambleStr, layerTargetFaces, 4)
        : await findLayerSolutions(scrambleStr, layerTargetFaces, 5);
      if (currentLayerSolutionsScramble !== scrambleStr || currentLayerSolutionsFacesKey !== facesKey) return;
      currentLayerSolutions = sols;
      renderLayerSolutions(sols, false);
    } catch (err) {
      console.error('Error finding layer solutions:', err);
      if (currentLayerSolutionsScramble === scrambleStr && currentLayerSolutionsFacesKey === facesKey) {
        renderLayerSolutions([], false);
      }
    }
  }, 10);
}

function renderLayerSolutions(sols, showAll = false) {
  if (!layerSolutionsList) return;
  const targetName = layerSolutionMode === "face" ? "1st face (Ortega)" : "1st layer";
  if (!sols || sols.length === 0) {
    const facesDesc = layerTargetFaces.length === 6 ? 'selected faces' : layerTargetFaces.map(f => capitalize(f)).join(', ');
    layerSolutionsList.innerHTML = `<p class="layer-solutions-empty">No ${targetName} solutions found for ${escapeHtml(facesDesc)} within ${layerSolutionMode === "face" ? 4 : 6} moves.</p>`;
    if (layerSolutionsBadge) layerSolutionsBadge.textContent = "0";
    return;
  }

  const bestDepth = sols[0].moveCount;
  if (layerSolutionsBadge) {
    layerSolutionsBadge.textContent = `${sols.length} found · best ${bestDepth}m`;
  }

  const limit = showAll ? sols.length : Math.min(10, sols.length);
  const displayed = sols.slice(0, limit);

  const html = displayed.map((sol, idx) => {
    const isSolved = sol.caseId === "Solved" || sol.caseId === "Layer Solved";
    const caseBadgeClass = isSolved ? "badge-solved" : "badge-case";
    const caseLabel = isSolved ? `Leaves ${sol.caseId}` : (sol.caseId === "PBL" ? "Leaves PBL" : `Leaves ${sol.caseId}`);
    const faceName = sol.face || 'white';
    const inspText = sol.inspection && sol.inspection !== 'none' ? sol.inspection : 'none';
    const inspTooltip = sol.fixedCount
      ? `${sol.orientedDCount || 1} ${capitalize(faceName)} on bottom (${sol.fixedCount} fixed throughout solution)`
      : '';
    const movesText = sol.moves || '(already solved)';
    const cObj = caseById.get(sol.caseId);
    const alg = cObj?.alg || cObj?.solutionAlg || '';
    const caseTitle = alg ? `CLL solution for ${sol.caseId}: ${alg}` : '';

    return `
      <div class="layer-sol-row">
        <div class="layer-sol-info">
          <div class="layer-sol-badges">
            <span class="face-badge face-badge-${faceName}">${capitalize(faceName)}</span>
            <span class="badge layer-sol-moves-badge">${sol.moveCount} move${sol.moveCount === 1 ? '' : 's'}</span>
            <span class="layer-sol-insp-chip" ${inspTooltip ? `title="${escapeHtml(inspTooltip)}"` : ''}>Inspection: <strong>${escapeHtml(inspText)}</strong></span>
            <span class="badge ${caseBadgeClass}" ${caseTitle ? `title="${escapeHtml(caseTitle)}"` : ''}>${escapeHtml(caseLabel)}</span>
          </div>
          <div class="layer-sol-moves">${escapeHtml(movesText)}</div>
        </div>
        <div class="layer-sol-actions">
          <button type="button" class="btn btn-small layer-sol-sim-btn" data-idx="${idx}" title="Simulate this solution in 3D simulator">
            <span aria-hidden="true">&#x25B6;</span> Sim
          </button>
          <button type="button" class="btn btn-small layer-sol-copy-btn" data-idx="${idx}" title="Copy reconstruction to clipboard">
            Copy
          </button>
        </div>
      </div>
    `;
  }).join("");

  let footerHtml = "";
  if (sols.length > 10 && !showAll) {
    footerHtml = `
      <div class="layer-sol-footer">
        <button type="button" id="layerSolShowAllBtn" class="btn btn-small btn-block">Show all ${sols.length} solutions</button>
      </div>
    `;
  } else if (showAll && sols.length > 10) {
    footerHtml = `
      <div class="layer-sol-footer">
        <button type="button" id="layerSolShowLessBtn" class="btn btn-small btn-block">Show fewer solutions</button>
      </div>
    `;
  }

  layerSolutionsList.innerHTML = html + footerHtml;

  layerSolutionsList.querySelectorAll(".layer-sol-sim-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.idx);
      const sol = displayed[idx];
      if (!sol) return;
      const base = mode === "simulate"
        ? ([freeMoveBaseScramble, ...userFreeMoves].filter(Boolean).join(" ").trim() || currentLayerSolutionsScramble)
        : (currentSolveScramble || scrambleMoves || scramble);
      const solMoves = (sol.inspection && sol.inspection !== 'none' ? sol.inspection + ' ' : '') + (sol.moves || '');
      const fullSeq = `${base} ${solMoves}`.trim();
      setMode("simulate", { skipSimInit: true });
      simScrambleInput.value = fullSeq;
      simOriginalScramble = base;
      simHasSolutionAppended = true;
      simAppendSolutionBtn.textContent = "Remove Solution";
      simAppendSolutionBtn.classList.add("active");
      simLoadScramble(fullSeq, {
        expectedCase: { id: `Layer: ${capitalize(sol.face)} (${sol.moveCount}m)`, solution: solMoves, solutionAlg: solMoves, isLayer: true },
        isAppended: true,
        startAtSolution: true,
        originalScramble: base
      });
    });
  });

  layerSolutionsList.querySelectorAll(".layer-sol-copy-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const idx = Number(btn.dataset.idx);
      const sol = displayed[idx];
      if (!sol) return;
      const base = currentSolveScramble || scrambleMoves || scramble;
      const cObj = caseById.get(sol.caseId);
      const alg = cObj?.alg || cObj?.solutionAlg || '';
      const text = [
        `Scramble: ${base}`,
        `Face: ${capitalize(sol.face || 'white')}`,
        sol.inspection && sol.inspection !== 'none' ? `Inspection: ${sol.inspection}` : '',
        `1st Layer: ${sol.moves || '(already solved)'}`,
        `Leaves: ${sol.caseId}${alg ? ' (CLL: ' + alg + ')' : ''}`
      ].filter(Boolean).join('\n');
      try {
        await navigator.clipboard.writeText(text);
        btn.textContent = "✓ Copied";
        setTimeout(() => { btn.textContent = "Copy"; }, 1500);
      } catch (err) {
        btn.textContent = "Copied";
        setTimeout(() => { btn.textContent = "Copy"; }, 1500);
      }
    });
  });

  const showAllBtn = document.getElementById("layerSolShowAllBtn");
  if (showAllBtn) {
    showAllBtn.addEventListener("click", () => renderLayerSolutions(sols, true));
  }
  const showLessBtn = document.getElementById("layerSolShowLessBtn");
  if (showLessBtn) {
    showLessBtn.addEventListener("click", () => renderLayerSolutions(sols, false));
  }
}

let currentCrossSolutionsScramble = "";
let currentCrossSolutionsFacesKey = "";

function updateCrossFacesUI() {
  const settingsCrossFacesChips = document.getElementById("settingsCrossFacesChips");
  if (settingsCrossFacesChips) {
    settingsCrossFacesChips.querySelectorAll(".face-chip").forEach(chip => {
      const face = chip.dataset.crossFace;
      const isActive = crossTargetFaces.includes(face);
      chip.classList.toggle("active", isActive);
      chip.setAttribute("aria-pressed", String(isActive));
    });
  }

  const crossPresetWhiteBtn = document.getElementById("crossPresetWhiteBtn");
  const crossPresetOppositeBtn = document.getElementById("crossPresetOppositeBtn");
  const crossPresetAllBtn = document.getElementById("crossPresetAllBtn");
  if (crossPresetWhiteBtn) {
    crossPresetWhiteBtn.classList.toggle("active", crossTargetFaces.length === 1 && crossTargetFaces[0] === "white");
  }
  if (crossPresetOppositeBtn) {
    crossPresetOppositeBtn.classList.toggle("active", crossTargetFaces.length === 2 && crossTargetFaces.includes("white") && crossTargetFaces.includes("yellow"));
  }
  if (crossPresetAllBtn) {
    crossPresetAllBtn.classList.toggle("active", crossTargetFaces.length === 6);
  }

  if (crossSolutionsTitle) {
    if (crossTargetFaces.length === 6) {
      crossSolutionsTitle.textContent = "Cross & Cross+1 / EO solutions (All 6 / CN)";
    } else if (crossTargetFaces.length === 1) {
      crossSolutionsTitle.textContent = `Cross & Cross+1 / EO solutions (${capitalize(crossTargetFaces[0])})`;
    } else if (crossTargetFaces.length === 2 && crossTargetFaces.includes("white") && crossTargetFaces.includes("yellow")) {
      crossSolutionsTitle.textContent = "Cross & Cross+1 / EO solutions (W / Y)";
    } else {
      crossSolutionsTitle.textContent = `Cross & Cross+1 / EO solutions (${crossTargetFaces.map(f => capitalize(f)).join(", ")})`;
    }
  }
}

function setCrossTargetFaces(faces) {
  const filtered = faces.filter(f => ALL_LAYER_FACES.includes(f));
  if (!filtered.length) return;
  crossTargetFaces = filtered;
  saveSettings();
  updateCrossFacesUI();
  const scr = currentSolveScramble || scrambleMoves || scramble;
  if (scr && (currentPuzzle === "333" || currentPuzzle === "333oh")) {
    updateCrossSolutions(scr);
  }
  if (mode === "practice" && practiceView && practiceView.solutionRevealed) {
    practiceView.revealInspectionSolutions();
  }
}

function toggleCrossTargetFace(face) {
  if (!ALL_LAYER_FACES.includes(face)) return;
  let next;
  if (crossTargetFaces.includes(face)) {
    if (crossTargetFaces.length <= 1) return;
    next = crossTargetFaces.filter(f => f !== face);
  } else {
    next = [...crossTargetFaces, face];
  }
  setCrossTargetFaces(next);
}

function updateCrossSolutions(scrambleStr) {
  if (!crossSolutionsList) return;
  updateCrossFacesUI();
  if (!scrambleStr) {
    crossSolutionsList.innerHTML = '<p class="layer-solutions-empty">No scramble loaded.</p>';
    if (crossSolutionsBadge) crossSolutionsBadge.textContent = "";
    if (crossEoSummary) crossEoSummary.innerHTML = "";
    return;
  }
  const facesKey = [...crossTargetFaces].sort().join(",");
  currentCrossSolutionsScramble = scrambleStr;
  currentCrossSolutionsFacesKey = facesKey;
  if (crossSolutionsBadge) crossSolutionsBadge.textContent = "analyzing...";
  const facesDesc = crossTargetFaces.length === 6 ? "all 6 colors" : crossTargetFaces.map(f => capitalize(f)).join("/");
  crossSolutionsList.innerHTML = `<p class="layer-solutions-empty">Searching for optimal ${escapeHtml(facesDesc)} cross &amp; Cross+1 / EO solutions...</p>`;

  setTimeout(async () => {
    if (currentCrossSolutionsScramble !== scrambleStr || currentCrossSolutionsFacesKey !== facesKey) return;
    try {
      const result = await findCrossSolutions(scrambleStr, crossTargetFaces, 8);
      if (currentCrossSolutionsScramble !== scrambleStr || currentCrossSolutionsFacesKey !== facesKey) return;
      renderCrossSolutions(result);
    } catch (err) {
      console.error("Error solving cross:", err);
      crossSolutionsList.innerHTML = '<p class="layer-solutions-empty">Error calculating cross solutions.</p>';
      if (crossSolutionsBadge) crossSolutionsBadge.textContent = "error";
    }
  }, 10);
}

function renderCrossSolutions(result) {
  if (!crossSolutionsList) return;
  const sols = Array.isArray(result) ? result : (result?.solutions || []);
  if (!sols || sols.length === 0) {
    crossSolutionsList.innerHTML = '<p class="layer-solutions-empty">No cross solutions found within depth.</p>';
    if (crossSolutionsBadge) crossSolutionsBadge.textContent = "0";
    return;
  }

  const bestDepth = sols[0].moveCount;
  if (crossSolutionsBadge) {
    crossSolutionsBadge.textContent = `${sols.length} found · optimal ${bestDepth}m`;
  }

  if (crossEoSummary && sols[0]?.eoSummary) {
    const eo = sols[0].eoSummary;
    const isClean = eo.crossOriented === 4;
    const eoCrossBadge = isClean
      ? `<span class="badge chip-eo" style="background: rgba(16, 185, 129, 0.15); color: #10b981;">✓ All 4 Cross Edges Oriented</span>`
      : `<span class="badge chip-eo">${eo.crossOriented}/4 Cross Edges Oriented (${4 - eo.crossOriented} bad)</span>`;
    const totalEoBadge = `<span class="badge chip-eo">Overall: ${eo.goodEdges}/12 Good Edges (${eo.badEdges} bad)</span>`;
    crossEoSummary.innerHTML = `
      <div class="cross-eo-bar">
        <span class="cross-eo-label">Edge Orientation (EO):</span>
        ${eoCrossBadge}
        ${totalEoBadge}
      </div>
    `;
  }

  const html = sols.map((sol, idx) => {
    const faceName = sol.face || "white";
    const inspText = sol.insp && sol.insp !== "none" ? sol.insp : "none";
    const cross1Badges = sol.crossPlus1 && sol.crossPlus1.hasPair
      ? `<span class="badge ${sol.crossPlus1.type === 'solved' ? 'badge-solved' : 'chip-cross1'}" title="${escapeHtml(sol.crossPlus1.description)}">Cross+1: ${sol.crossPlus1.slot} (${sol.crossPlus1.type})</span>`
      : "";

    return `
      <div class="layer-sol-row">
        <div class="layer-sol-info">
          <div class="layer-sol-badges">
            <span class="face-badge face-badge-${faceName}">${capitalize(faceName)} Cross</span>
            <span class="badge layer-sol-moves-badge">${sol.moveCount} moves</span>
            <span class="layer-sol-insp-chip">Inspection: <strong>${escapeHtml(inspText)}</strong></span>
            ${cross1Badges}
          </div>
          <div class="layer-sol-moves">${escapeHtml(sol.moves)}</div>
        </div>
        <div class="layer-sol-actions">
          <button type="button" class="btn btn-small cross-sol-sim-btn" data-idx="${idx}" title="Simulate this cross solution in 3D simulator">
            <span aria-hidden="true">&#x25B6;</span> Sim
          </button>
          <button type="button" class="btn btn-small cross-sol-copy-btn" data-idx="${idx}" title="Copy cross reconstruction">
            Copy
          </button>
        </div>
      </div>
    `;
  }).join("");

  crossSolutionsList.innerHTML = html;

  crossSolutionsList.querySelectorAll(".cross-sol-sim-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.idx);
      const sol = sols[idx];
      if (!sol) return;
      const base = currentSolveScramble || scrambleMoves || scramble;
      const solMoves = (sol.insp && sol.insp !== "none" ? sol.insp + " " : "") + sol.moves;
      const fullSeq = `${base} ${solMoves}`.trim();
      setMode("simulate", { skipSimInit: true });
      simScrambleInput.value = fullSeq;
      simOriginalScramble = base;
      simHasSolutionAppended = true;
      simAppendSolutionBtn.textContent = "Remove Solution";
      simAppendSolutionBtn.classList.add("active");
      simLoadScramble(fullSeq, {
        expectedCase: { id: `${capitalize(sol.face || 'white')} Cross (${sol.moveCount}m)`, solution: solMoves, solutionAlg: solMoves, isLayer: true },
        isAppended: true,
        startAtSolution: true,
        originalScramble: base
      });
    });
  });

  crossSolutionsList.querySelectorAll(".cross-sol-copy-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const idx = Number(btn.dataset.idx);
      const sol = sols[idx];
      if (!sol) return;
      const base = currentSolveScramble || scrambleMoves || scramble;
      const lines = [
        `Scramble: ${base}`,
        `${capitalize(sol.face || 'white')} Cross: ${sol.moves} (${sol.moveCount} moves)`,
        sol.insp && sol.insp !== "none" ? `Inspection: ${sol.insp}` : "",
        sol.crossPlus1?.hasPair ? `Cross+1: ${sol.crossPlus1.slot} (${sol.crossPlus1.description})` : ""
      ].filter(Boolean).join("\n");
      try {
        await navigator.clipboard.writeText(lines);
        btn.textContent = "✓ Copied";
        setTimeout(() => { btn.textContent = "Copy"; }, 1500);
      } catch (err) {
        btn.textContent = "Copied";
        setTimeout(() => { btn.textContent = "Copy"; }, 1500);
      }
    });
  });
}

// Keyboard: Space arms on keydown (or starts inspection if enabled), starts on keyup;
// any key stops a running timer; Escape cancels an armed/inspecting one.
document.addEventListener("keydown", e => {
  if (!overview.hidden) return;
  const target = e.target;
  if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;

  if (mode === "solve") {
    if (solveState === "running") {
      e.preventDefault();
      if (solveTimerDriven) {
        // GAN timer is authoritative; only Escape (cancel attempt) is handled here.
        if (e.key === "Escape") cancelSolve();
        return;
      }
      stopSolve(false);
      return;
    }
    if (e.key === "Escape") {
      if (solveState === "inspecting" || solveState === "armed") {
        e.preventDefault();
        cancelSolve();
        return;
      }
    }
    if (e.code === "Space") {
      e.preventDefault();
      if (e.repeat) return;
      if (solveState === "idle") {
        if (solveInspection) {
          startSolveInspection();
        } else {
          armSolve();
        }
        return;
      }
      if (solveState === "inspecting") {
        clearTimeout(solveArmTimeout);
        solveArmTimeout = setTimeout(() => {
          if (solveState === "inspecting") {
            armSolve();
          }
        }, 150);
      }
      return;
    }
  }
});

document.addEventListener("keyup", e => {
  if (!overview.hidden) return;
  if (mode === "solve") {
    if (e.code === "Space") {
      e.preventDefault();
      clearTimeout(solveArmTimeout);
      if (solveState === "armed") {
        startSolve();
      }
    }
  }
});

// Touch / mouse: hold on the timer area, release anywhere to start; tap the
// full-screen overlay to stop.
solveSurface.addEventListener("pointerdown", e => {
  if (e.target.closest("button") || e.target.closest("input") || e.target.closest("label") || e.target.closest("select") || e.target.closest(".bt-disconnect-banner")) return;
  if (mode !== "solve" || solveState !== "idle") return;
  e.preventDefault();
  if (solveInspection) {
    startSolveInspection();
  } else {
    armSolve();
  }
});

solveOverlay.addEventListener("pointerdown", e => {
  if (e.target.closest("#solveOverlayCancelBtn")) {
    cancelSolve();
    return;
  }
  e.preventDefault();
  if (mode === "solve") {
    if (solveState === "running") {
      if (solveTimerDriven) return; // stop on the GAN timer
      stopSolve(true);
      return;
    }
    if (solveState === "inspecting") {
      clearTimeout(solveArmTimeout);
      solveArmTimeout = setTimeout(() => {
        if (solveState === "inspecting") {
          armSolve();
        }
      }, 150);
    }
  }
});

document.addEventListener("pointerup", () => {
  if (mode === "solve") {
    clearTimeout(solveArmTimeout);
    if (solveState === "armed") {
      startSolve();
    } else if (overlayHideOnPointerUp) {
      hideSolveOverlay();
      swallowNextClick = true;
      setTimeout(() => { swallowNextClick = false; }, 300);
    }
  }
});

document.addEventListener("pointercancel", () => {
  if (mode === "solve" && (solveState === "armed" || solveState === "inspecting")) {
    cancelSolve();
  }
});

document.addEventListener("click", e => {
  if (swallowNextClick) {
    swallowNextClick = false;
    e.stopPropagation();
    e.preventDefault();
  }
}, true);

clearSolvesBtn.addEventListener("click", () => {
  const currentSess = getActiveSession();
  if (confirm(`Clear all recorded solves in "${currentSess.name}"?`)) {
    currentSess.solves = [];
    solves = currentSess.solves;
    lastSolve = null;
    resetCaseAppearances();
    saveSolves();
    populateSessionSelect();
    renderSolvePanel();
    updateStatsTable();
  }
});

function handleExportCSV() {
  const currentSess = getActiveSession();
  const currentSolves = currentSess?.solves || [];
  if (currentSolves.length === 0) {
    alert("No recorded solves in this session yet to export.");
    return;
  }
  const csvData = exportSolvesToCSV(currentSolves, currentSess?.name || "Session");
  const filename = `${(currentSess?.name || "solves").toLowerCase().replace(/[^a-z0-9]/g, "-")}-${Date.now()}.csv`;
  downloadCSV(csvData, filename);
}

const exportSolvesCsvBtn = document.getElementById("exportSolvesCsvBtn");
if (exportSolvesCsvBtn) exportSolvesCsvBtn.addEventListener("click", handleExportCSV);

const statsExportCsvBtn = document.getElementById("statsExportCsvBtn");
if (statsExportCsvBtn) statsExportCsvBtn.addEventListener("click", handleExportCSV);

solveList.addEventListener("click", e => {
  const chip = e.target.closest(".solve-chip");
  if (!chip) return;
  const index = Number(chip.dataset.index);
  if (!Number.isInteger(index) || index < 0 || index >= solves.length) return;
  const s = solves[index];
  if (!s) return;

  const isDel = e.target.closest(".solve-chip-del");
  if (isDel) {
    if (confirm(`Delete solve ${formatSolveDisplay(s)}?`)) {
      solves.splice(index, 1);
      if (lastSolve === s || (lastSolve && lastSolve.at === s.at && lastSolve.id === s.id && lastSolve.ms === s.ms)) {
        lastSolve = solves.length ? solves[solves.length - 1] : null;
      }
      saveSolves();
      populateSessionSelect();
      renderSolvePanel();
      updateStatsTable();
    }
    return;
  }

  const isReplay = e.target.closest(".solve-chip-replay-tag");
  if (isReplay && s.moves && s.moves.length > 0) {
    solveReplayViewer.open(s, `Solve #${index + 1} Replay`);
    return;
  }

  openSolveDetailModal(s, index + 1);
});

if (solveNewScrambleBtn) {
  solveNewScrambleBtn.addEventListener("click", () => {
    regenerateScramble();
  });
}
if (solveCustomScrambleBtn) {
  solveCustomScrambleBtn.addEventListener("click", () => {
    toggleSolveCustomScramble();
  });
}
if (solveCustomCancelBtn) {
  solveCustomCancelBtn.addEventListener("click", () => {
    toggleSolveCustomScramble(false);
  });
}
if (solveCustomClearBtn) {
  solveCustomClearBtn.addEventListener("click", () => {
    if (solveCustomInput) {
      solveCustomInput.value = "";
      solveCustomInput.focus();
    }
  });
}
if (solveCustomApplyBtn) {
  solveCustomApplyBtn.addEventListener("click", applyCustomSolveScramble);
}
if (solveCustomInput) {
  solveCustomInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      applyCustomSolveScramble();
    } else if (e.key === "Escape") {
      e.preventDefault();
      toggleSolveCustomScramble(false);
    }
  });
}

if (layerFacesChips) {
  layerFacesChips.addEventListener("click", (e) => {
    const chip = e.target.closest(".face-chip");
    if (!chip) return;
    const face = chip.dataset.face;
    if (face) toggleTargetFace(face);
  });
}
if (layerPresetWhiteBtn) {
  layerPresetWhiteBtn.addEventListener("click", () => setTargetFaces(["white"]));
}
if (layerPresetOppositeBtn) {
  layerPresetOppositeBtn.addEventListener("click", () => setTargetFaces(["white", "yellow"]));
}
if (layerPresetAllBtn) {
  layerPresetAllBtn.addEventListener("click", () => setTargetFaces(ALL_LAYER_FACES));
}

if (solveOverlayCancelBtn) {
  solveOverlayCancelBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (mode === "solve") cancelSolve();
  });
}

// ---------------------------------------------------------------------------
// Case overview: every case with a top-view diagram, its opposite and alg
// ---------------------------------------------------------------------------

let overviewBuilt = false;

// Sticker colours, matching the 3D view
const FACE_COLORS = { U: "#ffffff", D: "#ffff00", F: "#32cd32", B: "#2266ff", R: "#ff0000", L: "#ffa500" };

// Faces of the three stickers (orientation 0, 1, 2) of each corner location in
// cubing.js's 2x2x2 definition: 0 UFR, 1 UBR, 2 UBL, 3 UFL, 4 DFR, 5 DFL,
// 6 DBL, 7 DBR.
const CORNER_FACES = [
  ["U", "R", "F"], ["U", "B", "R"], ["U", "L", "B"], ["U", "F", "L"],
  ["D", "F", "R"], ["D", "L", "F"], ["D", "B", "L"], ["D", "R", "B"]
];

// Cross-shaped top view: big 2x2 top face, thin side-sticker bars on the four
// edges (F at the bottom, B at the top, L left, R right).
function caseDiagramSVG(pattern, label) {
  const { pieces, orientation } = pattern.patternData.CORNERS;
  const color = (loc, o) =>
    FACE_COLORS[CORNER_FACES[pieces[loc]][(o - orientation[loc] + 3) % 3]];

  const S = 30;   // top sticker size
  const D = 8;    // side sticker depth
  const G = 3;    // gap between top face and side bars
  const M = 1.5;  // margin
  const T = M + D + G;      // top-left of the top face
  const W = T * 2 + 2 * S;  // total size
  const rect = (x, y, w, h, fill) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" stroke="#111" stroke-width="1.6" stroke-linejoin="round"/>`;

  return `<svg viewBox="0 0 ${W} ${W}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Top view of case ${label}">` +
    // top face: UBL, UBR, UFL, UFR
    rect(T, T, S, S, color(2, 0)) +
    rect(T + S, T, S, S, color(1, 0)) +
    rect(T, T + S, S, S, color(3, 0)) +
    rect(T + S, T + S, S, S, color(0, 0)) +
    // B side (top bar): UBL's B, UBR's B
    rect(T, M, S, D, color(2, 2)) +
    rect(T + S, M, S, D, color(1, 1)) +
    // F side (bottom bar): UFL's F, UFR's F
    rect(T, T + 2 * S + G, S, D, color(3, 1)) +
    rect(T + S, T + 2 * S + G, S, D, color(0, 2)) +
    // L side (left bar): UBL's L, UFL's L
    rect(M, T, D, S, color(2, 1)) +
    rect(M, T + S, D, S, color(3, 2)) +
    // R side (right bar): UBR's R, UFR's R
    rect(T + 2 * S + G, T, D, S, color(1, 2)) +
    rect(T + 2 * S + G, T + S, D, S, color(0, 1)) +
    `</svg>`;
}

async function buildOverview() {
  // Same orientation as the trainer with "Always white bottom": z2 first,
  // then the case scramble.
  const kpuzzle = await puzzles["2x2x2"].kpuzzle();
  const solved = kpuzzle.defaultPattern();

  overviewBody.innerHTML = "";

  const hint = document.createElement("p");
  hint.className = "overview-hint";
  hint.textContent = "Top view of each case (white on bottom). \"Opposite\" is the case you get by doing the alg on a solved cube.";
  overviewBody.appendChild(hint);

  GROUP_DISPLAY_ORDER.forEach(group => {
    const section = document.createElement("section");
    section.className = "ov-group";

    const heading = document.createElement("h3");
    heading.textContent = GROUP_NAMES[group] === group ? group : `${GROUP_NAMES[group]} (${group})`;
    section.appendChild(heading);

    const cards = document.createElement("div");
    cards.className = "ov-cards";

    casesByGroup[group].forEach(caseObj => {
      const card = document.createElement("article");
      card.className = "ov-card";

      const tagBadge = document.createElement("button");
      tagBadge.type = "button";
      const currentTag = getCaseTag(caseObj.id);
      const currentLabel = formatCaseTagLabel(currentTag);
      tagBadge.className = `ov-tag-badge tag-${currentTag}`;
      tagBadge.textContent = currentLabel;
      tagBadge.title = `Status: ${currentLabel} · Click to cycle`;
      tagBadge.addEventListener("click", () => {
        cycleCaseTag(caseObj.id);
        const newTag = getCaseTag(caseObj.id);
        const newLabel = formatCaseTagLabel(newTag);
        tagBadge.className = `ov-tag-badge tag-${newTag}`;
        tagBadge.textContent = newLabel;
        tagBadge.title = `Status: ${newLabel} · Click to cycle`;
      });

      const diagram = document.createElement("div");
      diagram.className = "ov-diagram";
      renderCaseSvg("222", "cll", caseObj).then(svg => {
        diagram.innerHTML = svg;
      });

      const id = document.createElement("div");
      id.className = "ov-id";
      id.textContent = caseObj.id;

      const opp = document.createElement("div");
      opp.className = "ov-opp";
      opp.textContent = `Opposite: ${caseObj.opposite}`;

      const algRow = document.createElement("div");
      algRow.className = "ov-alg-row";

      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "ov-inline-btn ov-edit-btn";
      editBtn.innerHTML = "&#x270E;";
      editBtn.title = "Edit label";
      editBtn.setAttribute("aria-label", `Edit label for ${caseObj.id}`);

      const algText = document.createElement("span");
      algText.className = "ov-alg-text";
      algText.textContent = getCllCaseSolutionDisplay(caseObj);

      editBtn.addEventListener("click", () => {
        openCustomLabelModal({
          type: "cll",
          id: caseObj.id,
          rawAlg: caseObj.solutionAlg,
          defaultLabel: caseObj.solution,
          currentLabel: getCllCaseSolutionDisplay(caseObj),
          onSave: (newLabel) => {
            setCllCaseSolutionDisplay(caseObj.id, newLabel);
            algText.textContent = getCllCaseSolutionDisplay(caseObj);
          },
          onReset: () => {
            setCllCaseSolutionDisplay(caseObj.id, null);
            algText.textContent = caseObj.solution;
          }
        });
      });

      const simBtn = document.createElement("button");
      simBtn.type = "button";
      simBtn.className = "ov-inline-btn ov-sim-btn";
      simBtn.innerHTML = "&#x25B6;";
      simBtn.title = `Simulate ${caseObj.id} solution in 3D`;
      simBtn.setAttribute("aria-label", `Simulate ${caseObj.id} solution in 3D`);
      simBtn.addEventListener("click", () => {
        closeOverview();
        setMode("simulate");
        simLoadCaseWithSolution(caseObj, 0);
      });

      algRow.append(editBtn, algText, simBtn);
      card.append(tagBadge, diagram, id, opp, algRow);
      cards.appendChild(card);
    });

    section.appendChild(cards);
    overviewBody.appendChild(section);
  });

  overviewBuilt = true;
}

async function openOverview() {
  if (!overviewBuilt) await buildOverview();
  overview.hidden = false;
  document.documentElement.classList.add("overview-open");
  overviewClose.focus();
}

function closeOverview() {
  overview.hidden = true;
  document.documentElement.classList.remove("overview-open");
  overviewBtn.focus();
}

overviewBtn.addEventListener("click", openOverview);
overviewClose.addEventListener("click", closeOverview);
document.addEventListener("keydown", e => {
  if (e.key === "Escape") {
    if (!overview.hidden) closeOverview();
    if (guideModal && !guideModal.hidden) closeGuideModal();
    if (pblModal && !pblModal.hidden) closePblModal();
    if (customLabelModal && !customLabelModal.hidden) closeCustomLabelModal();
    if (sessionModal && !sessionModal.hidden) closeSessionModal();
    if (settingsModal && !settingsModal.hidden) closeSettingsModal();
  }
});

// ---------------------------------------------------------------------------
// Settings Modal & Color Customization
// ---------------------------------------------------------------------------

const COLOR_CONFIG = [
  { key: "white",  label: "White / Bottom (D)" },
  { key: "yellow", label: "Yellow / Top (U)" },
  { key: "green",  label: "Green / Front (F)" },
  { key: "blue",   label: "Blue / Back (B)" },
  { key: "red",    label: "Red / Right (R)" },
  { key: "orange", label: "Orange / Left (L)" },
  { key: "slate",  label: "Slate / Unoriented" }
];

const COLOR_PRESETS = {
  bright: DEFAULT_CUBE_COLORS,
  fluro: {
    white:  "#ffffff",
    yellow: "#ffea00",
    green:  "#00ff66",
    blue:   "#0070f3",
    red:    "#ff1744",
    orange: "#ff6600",
    slate:  "#374151"
  },
  matte: {
    white:  "#ffffff",
    yellow: "#ffd500",
    green:  "#009b48",
    blue:   "#0046ad",
    red:    "#b71234",
    orange: "#ff5800",
    slate:  "#374151"
  }
};

function setPickingColor(isPicking) {
  if (!settingsModal) return;
  if (isPicking) {
    settingsModal.classList.add("picking-color");
  } else {
    settingsModal.classList.remove("picking-color");
  }
}

function renderColorPickers() {
  if (!colorPickerGrid) return;
  colorPickerGrid.innerHTML = COLOR_CONFIG.map(item => {
    const val = (CUBE_COLORS[item.key] || "#ffffff").toLowerCase();
    return `
      <div class="color-picker-row" data-color-key="${item.key}">
        <span class="color-picker-swatch" style="background: ${val};" data-swatch="${item.key}"></span>
        <span class="color-picker-label">${item.label}</span>
        <input type="color" class="color-picker-input-native" value="${val}" data-native-key="${item.key}" aria-label="Pick ${item.label}">
        <input type="text" class="color-picker-input-hex" value="${val.toUpperCase()}" maxlength="7" data-hex-key="${item.key}" aria-label="Hex for ${item.label}">
      </div>
    `;
  }).join("");

  colorPickerGrid.querySelectorAll('.color-picker-row').forEach(row => {
    const key = row.dataset.colorKey;
    const nativeInput = row.querySelector('.color-picker-input-native');
    const hexInput = row.querySelector('.color-picker-input-hex');
    const swatch = row.querySelector('.color-picker-swatch');

    const updateColor = (hex) => {
      if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return;
      CUBE_COLORS[key] = hex.toLowerCase();
      setCustomCubeColors({ [key]: hex.toLowerCase() });
      applyCubeColorsToCss(CUBE_COLORS);
      if (swatch) swatch.style.background = hex;
      if (nativeInput) nativeInput.value = hex;
      if (hexInput) hexInput.value = hex.toUpperCase();
      saveSettings();
      refreshActiveViews();
    };

    if (swatch) {
      swatch.addEventListener("click", () => {
        setPickingColor(true);
        if (typeof nativeInput?.showPicker === "function") {
          try {
            nativeInput.showPicker();
            return;
          } catch (_) {}
        }
        nativeInput?.click();
      });
    }

    if (nativeInput) {
      nativeInput.addEventListener("focus", () => setPickingColor(true));
      nativeInput.addEventListener("click", () => setPickingColor(true));
      nativeInput.addEventListener("input", (e) => {
        setPickingColor(true);
        updateColor(e.target.value);
      });
      nativeInput.addEventListener("change", (e) => {
        updateColor(e.target.value);
        setPickingColor(false);
      });
      nativeInput.addEventListener("cancel", () => setPickingColor(false));
      nativeInput.addEventListener("close", () => setPickingColor(false));
      nativeInput.addEventListener("blur", () => {
        setTimeout(() => {
          const active = document.activeElement;
          if (active !== nativeInput && active !== hexInput) {
            setPickingColor(false);
          }
        }, 120);
      });
    }

    if (hexInput) {
      hexInput.addEventListener("focus", () => {
        setPickingColor(true);
        hexInput.select();
      });
      hexInput.addEventListener("input", (e) => {
        let val = e.target.value.trim();
        if (!val.startsWith("#") && /^[0-9A-Fa-f]{6}$/.test(val)) {
          val = "#" + val;
        }
        if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
          updateColor(val);
        }
      });
      hexInput.addEventListener("change", (e) => {
        let val = e.target.value.trim();
        if (!val.startsWith("#")) val = "#" + val;
        if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
          updateColor(val);
        } else {
          hexInput.value = (CUBE_COLORS[key] || "#ffffff").toUpperCase();
        }
        setPickingColor(false);
      });
      hexInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === "Escape") {
          hexInput.blur();
        }
      });
      hexInput.addEventListener("blur", () => {
        setTimeout(() => {
          const active = document.activeElement;
          if (active !== nativeInput && active !== hexInput) {
            setPickingColor(false);
          }
        }, 120);
      });
    }
  });
}

function refreshActiveViews() {
  clearSvgCache();
  applyColorsTo3DCube(el);
  if (studyView?.activeDisplay3d) {
    applyColorsTo3DCube(studyView.activeDisplay3d);
  }
  if (mode === "study" && studyView) {
    studyView.render();
  } else if (mode === "practice" && practiceView) {
    practiceView.render();
  }
}

function openSettingsModal() {
  if (!settingsModal) return;
  setPickingColor(false);
  renderColorPickers();
  updateCrossFacesUI();

  if (settingsDarkTheme) settingsDarkTheme.checked = darkMode;
  if (settingsAlwaysWhiteBottom) settingsAlwaysWhiteBottom.checked = alwaysWhiteBottom;
  if (settingsAllowAUF) settingsAllowAUF.checked = allowAUF;
  if (settingsShowReflection) settingsShowReflection.checked = showReflection;

  settingsModal.hidden = false;
  document.documentElement.classList.add("overview-open");
  settingsModalCloseBtn?.focus();
}

const settingsCrossFacesChipsEl = document.getElementById("settingsCrossFacesChips");
if (settingsCrossFacesChipsEl) {
  settingsCrossFacesChipsEl.addEventListener("click", (e) => {
    const chip = e.target.closest(".face-chip");
    if (!chip) return;
    const face = chip.dataset.crossFace;
    if (face) toggleCrossTargetFace(face);
  });
}
document.getElementById("crossPresetWhiteBtn")?.addEventListener("click", () => setCrossTargetFaces(["white"]));
document.getElementById("crossPresetOppositeBtn")?.addEventListener("click", () => setCrossTargetFaces(["white", "yellow"]));
document.getElementById("crossPresetAllBtn")?.addEventListener("click", () => setCrossTargetFaces(ALL_LAYER_FACES));

function closeSettingsModal() {
  if (!settingsModal) return;
  setPickingColor(false);
  settingsModal.hidden = true;
  document.documentElement.classList.remove("overview-open");
  settingsBtn?.focus();
  saveSettings();
}

if (settingsBtn) settingsBtn.addEventListener("click", openSettingsModal);
if (settingsModalCloseBtn) settingsModalCloseBtn.addEventListener("click", closeSettingsModal);
if (settingsDoneBtn) settingsDoneBtn.addEventListener("click", closeSettingsModal);
if (settingsModal) {
  settingsModal.addEventListener("click", (e) => {
    if (e.target === settingsModal) closeSettingsModal();
  });
}

document.querySelectorAll('.settings-presets-row .preset-btn').forEach(btn => {
  btn.addEventListener("click", () => {
    setPickingColor(false);
    const preset = COLOR_PRESETS[btn.dataset.preset];
    if (preset) {
      setCustomCubeColors(preset);
      applyCubeColorsToCss(CUBE_COLORS);
      renderColorPickers();
      saveSettings();
      refreshActiveViews();
    }
  });
});

if (resetColorsBtn) {
  resetColorsBtn.addEventListener("click", () => {
    setPickingColor(false);
    setCustomCubeColors(DEFAULT_CUBE_COLORS);
    applyCubeColorsToCss(DEFAULT_CUBE_COLORS);
    renderColorPickers();
    saveSettings();
    refreshActiveViews();
  });
}

if (settingsDarkTheme) {
  settingsDarkTheme.addEventListener("change", (e) => {
    setDarkMode(e.target.checked);
  });
}
if (settingsAlwaysWhiteBottom) {
  settingsAlwaysWhiteBottom.addEventListener("change", (e) => {
    alwaysWhiteBottom = e.target.checked;
    renderToggles();
    saveSettings();
    regenerateScramble();
    refreshActiveViews();
  });
}
if (settingsAllowAUF) {
  settingsAllowAUF.addEventListener("change", (e) => {
    allowAUF = e.target.checked;
    renderToggles();
    saveSettings();
    regenerateScramble();
  });
}
if (settingsShowReflection) {
  settingsShowReflection.addEventListener("change", (e) => {
    showReflection = e.target.checked;
    applyReflection();
    renderToggles();
    saveSettings();
  });
}

// ---------------------------------------------------------------------------
// Stats table
// ---------------------------------------------------------------------------

let sessionLogFilter = "all"; // "all" | "track" | "full"

function renderStatsToggle() {
  const track = getTrack(currentPuzzle, currentTrackId);
  const pData = PUZZLES[currentPuzzle];
  const pName = pData?.shortName || currentPuzzle;
  const tName = track?.shortName || currentTrackId;

  const badge = document.getElementById("statsScopeBadge");
  if (badge) {
    badge.textContent = `${pName} • ${tName}`;
  }
  const title = document.getElementById("statsPanelTitle");
  if (title) {
    title.textContent = "Stats & History";
  }
  const statsTabCll = document.getElementById("statsTabCll");
  if (statsTabCll) {
    statsTabCll.textContent = `🧩 ${tName} Cases`;
  }

  document.querySelectorAll(".stats-tab-btn").forEach(btn => {
    const isCurrent = btn.dataset.stats === statsType;
    btn.setAttribute("aria-pressed", String(isCurrent));
    btn.classList.toggle("active", isCurrent);
  });
}

function setStatsType(next) {
  if (statsType === next) return;
  statsType = next;
  saveSettings();
  renderStatsToggle();
  updateStatsTable();
}

document.querySelectorAll(".stats-tab-btn").forEach(btn => {
  btn.addEventListener("click", () => setStatsType(btn.dataset.stats));
});

function renderRecogStatsTable() {
  const container = document.getElementById("stats-table-container");
  if (!container) return;

  const track = getTrack(currentPuzzle, currentTrackId);
  if (!track) return;

  let html = `
    <div class="recog-track-header" style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 12px; padding: 2px 2px;">
      <div>
        <h3 style="margin: 0; font-size: 1.05rem; font-weight: 700;">${escapeHtml(PUZZLES[currentPuzzle]?.name || currentPuzzle)} &mdash; ${escapeHtml(track.name)}</h3>
        <p style="margin: 2px 0 0; font-size: 0.82rem; color: var(--muted);">${escapeHtml(track.description || '')}</p>
      </div>
    </div>
  `;

  if (currentPuzzle === "222" && currentTrackId === "cll") {
    const caseNumbers = [1, 2, 3, 4, 5, 6];
    const gSort = recogStatsSort.col;
    const gDir = recogStatsSort.dir;
    const gArrow = (col) => gSort === col ? (gDir === "asc" ? " ▲" : " ▼") : "";

    html += `<table><thead><tr>
      <th scope="col" class="sortable" data-recog-sort="case">Group<span class="sort-icon">${gArrow("case")}</span></th>`;
    caseNumbers.forEach(c => {
      html += `<th scope="col">${c}</th>`;
    });
    html += `<th scope="col" class="sortable" data-recog-sort="shown">Total<span class="sort-icon">${gArrow("shown")}</span></th>
      <th scope="col" class="sortable" data-recog-sort="pct">Acc%<span class="sort-icon">${gArrow("pct")}</span></th>
    </tr></thead><tbody>`;

    let overallShown = 0;
    let overallCorrect = 0;

    const groupRows = GROUP_DISPLAY_ORDER.map((group, idx) => {
      let grpShown = 0;
      let grpCorrect = 0;
      const cells = caseNumbers.map(caseNum => {
        const caseId = `${group}${caseNum}`;
        if (!caseById.has(caseId)) return '<td></td>';
        const stat = getCaseStat("222", "cll", caseId);
        const correct = stat ? stat.correct : 0;
        const shown = stat ? stat.shown : 0;
        grpShown += shown;
        grpCorrect += correct;
        return `<td title="${caseId}: ${correct}/${shown}">${correct}/${shown}</td>`;
      }).join("");
      overallShown += grpShown;
      overallCorrect += grpCorrect;
      const pctNum = grpShown > 0 ? Math.round((grpCorrect / grpShown) * 100) : -1;
      const grpPct = grpShown > 0 ? pctNum + '%' : '-';
      return {
        group,
        idx,
        grpShown,
        grpCorrect,
        pctNum,
        rowHtml: `<tr><th scope="row">${group}</th>${cells}<td class="total">${grpCorrect}/${grpShown}</td><td class="total">${grpPct}</td></tr>`
      };
    });

    groupRows.sort((a, b) => {
      let vA = a.idx, vB = b.idx;
      if (gSort === "shown") { vA = a.grpShown; vB = b.grpShown; }
      else if (gSort === "pct") { vA = a.pctNum; vB = b.pctNum; }
      if (vA < vB) return gDir === "asc" ? -1 : 1;
      if (vA > vB) return gDir === "asc" ? 1 : -1;
      return 0;
    });

    html += groupRows.map(r => r.rowHtml).join("");

    const totalPct = overallShown > 0 ? Math.round((overallCorrect / overallShown) * 100) + '%' : '-';
    html += `</tbody><tfoot><tr>
      <th scope="row">Total</th>
      <td colspan="6" style="text-align: right; color: var(--muted); font-size: 0.85rem;">All 40 CLL cases</td>
      <td class="total"><strong>${overallCorrect}/${overallShown}</strong></td>
      <td class="total"><strong>${totalPct}</strong></td>
    </tr></tfoot></table>`;
  } else if (track.cases && track.cases.length > 0) {
    const groups = track.groups || ["Cases"];
    let totalAttempts = 0;
    let totalCorrect = 0;
    let testedCases = 0;

    track.cases.forEach(c => {
      const stat = getCaseStat(currentPuzzle, currentTrackId, c.id);
      if (stat.shown > 0) {
        testedCases++;
        totalAttempts += stat.shown;
        totalCorrect += stat.correct;
      }
    });

    const overallPct = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : null;
    const rSort = recogStatsSort.col;
    const rDir = recogStatsSort.dir;
    const rArrow = (col) => rSort === col ? (rDir === "asc" ? " ▲" : " ▼") : "";

    html += `
      <div class="layer-stats-grid" style="margin-bottom: 16px;">
        <div class="layer-stat-card">
          <span class="layer-stat-val">${testedCases} / ${track.cases.length}</span>
          <span class="layer-stat-lbl">Practiced</span>
        </div>
        <div class="layer-stat-card">
          <span class="layer-stat-val">${totalAttempts}</span>
          <span class="layer-stat-lbl">Attempts</span>
        </div>
        <div class="layer-stat-card highlight-best">
          <span class="layer-stat-val">${totalCorrect}</span>
          <span class="layer-stat-lbl">Correct</span>
        </div>
        <div class="layer-stat-card">
          <span class="layer-stat-val">${overallPct != null ? overallPct + '%' : '-'}</span>
          <span class="layer-stat-lbl">Accuracy</span>
        </div>
      </div>
    `;

    html += '<div class="recog-group-tables">';
    groups.forEach(groupName => {
      const groupCases = track.cases.filter(c => c.group === groupName);
      if (groupCases.length === 0) return;

      let gShown = 0;
      let gCorrect = 0;

      const caseItems = groupCases.map((c, idx) => {
        const stat = getCaseStat(currentPuzzle, currentTrackId, c.id);
        const shown = stat.shown || 0;
        const correct = stat.correct || 0;
        gShown += shown;
        gCorrect += correct;
        const pct = shown > 0 ? Math.round((correct / shown) * 100) : null;
        return { c, idx, shown, correct, pct, pctSort: pct != null ? pct : -1 };
      });

      caseItems.sort((a, b) => {
        let vA = a.idx, vB = b.idx;
        if (rSort === "name") { vA = (a.c.name || a.c.id).toLowerCase(); vB = (b.c.name || b.c.id).toLowerCase(); }
        else if (rSort === "shown") { vA = a.shown; vB = b.shown; }
        else if (rSort === "pct") { vA = a.pctSort; vB = b.pctSort; }
        if (vA < vB) return rDir === "asc" ? -1 : 1;
        if (vA > vB) return rDir === "asc" ? 1 : -1;
        return 0;
      });

      const is3x3Track = (currentPuzzle === "333" || currentPuzzle === "333oh");
      const svgPuzzle = is3x3Track ? "333" : currentPuzzle;
      const showCubeCol = is3x3Track || currentPuzzle === "222" || currentPuzzle === "444" || currentPuzzle === "555";

      const rowsHtml = caseItems.map(({ c, shown, correct, pct }) => {
        const badgeClass = shown === 0 ? 'badge' : (pct >= 90 ? 'badge badge-green' : pct >= 70 ? 'badge badge-yellow' : 'badge badge-red');
        const displayId = formatCaseDisplayId(c.id);
        const displayName = getDistinctCaseName(c) || "—";
        let svgHtml = "";
        if (showCubeCol) {
          svgHtml = getCachedCaseSvg(svgPuzzle, currentTrackId, c.id);
          if (!svgHtml) {
            renderCaseSvg(svgPuzzle, currentTrackId, c).then(svg => {
              const cell = document.querySelector(`[data-recog-svg="${CSS.escape(c.id)}"]`);
              if (cell && svg) cell.innerHTML = svg;
            });
          }
        }
        return `
          <tr>
            <th scope="row"><strong>${escapeHtml(displayId)}</strong></th>
            ${showCubeCol ? `<td class="case-svg-cell"><div class="case-table-svg" data-recog-svg="${escapeHtml(c.id)}">${svgHtml}</div></td>` : ''}
            <td>${escapeHtml(displayName)}</td>
            <td>${correct} / ${shown}</td>
            <td><span class="${badgeClass}">${pct != null ? pct + '%' : 'untested'}</span></td>
          </tr>
        `;
      }).join("");

      const gPct = gShown > 0 ? Math.round((gCorrect / gShown) * 100) + '%' : '-';

      html += `
        <div class="recog-group-box" style="margin-bottom: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 6px;">
            <h4 style="margin: 0; font-size: 0.95rem; font-weight: 600;">${escapeHtml(groupName)} (${groupCases.length})</h4>
            <span style="font-size: 0.85rem; color: var(--muted);">${gCorrect}/${gShown} correct (${gPct})</span>
          </div>
          <table class="recog-table">
            <thead>
              <tr>
                <th scope="col" class="sortable" data-recog-sort="case" style="width: 78px;">Case<span class="sort-icon">${rArrow("case")}</span></th>
                ${showCubeCol ? `<th scope="col" style="width: 48px;">Cube</th>` : ''}
                <th scope="col" class="sortable" data-recog-sort="name">Name<span class="sort-icon">${rArrow("name")}</span></th>
                <th scope="col" class="sortable" data-recog-sort="shown" style="width: 110px;">Recognition<span class="sort-icon">${rArrow("shown")}</span></th>
                <th scope="col" class="sortable" data-recog-sort="pct" style="width: 90px;">Accuracy<span class="sort-icon">${rArrow("pct")}</span></th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>
      `;
    });
    html += '</div>';
  } else {
    html += `
      <div class="empty-stats" style="text-align: center; padding: 24px 16px;">
        <h4 style="margin: 0 0 6px;">Inspection &amp; Solution Planning</h4>
        <p style="color: var(--muted); font-size: 0.9rem; max-width: 480px; margin: 0 auto 16px;">
          ${escapeHtml(track.name)} focuses on cross &amp; 1st layer inspection planning under 15s WCA regulations.
        </p>
        <p style="font-size: 0.9rem; color: var(--text-color);">
          Use <strong>Practice</strong> mode to drill 15s inspection, find optimal solutions, and preserve pairs/EO.
        </p>
      </div>
    `;
  }

  container.innerHTML = html;
  container.querySelectorAll("th[data-recog-sort]").forEach(th => {
    th.addEventListener("click", () => {
      const col = th.dataset.recogSort;
      if (!col) return;
      if (recogStatsSort.col === col) {
        recogStatsSort.dir = recogStatsSort.dir === "asc" ? "desc" : "asc";
      } else {
        recogStatsSort.col = col;
        recogStatsSort.dir = (col === "case" || col === "name") ? "asc" : "desc";
      }
      renderRecogStatsTable();
    });
  });
}

function renderSolveStatsTable() {
  const container = document.getElementById("stats-table-container");
  if (!container) return;

  if (!isCfopAnalyzerReady()) {
    initCfopAnalyzer().then(() => {
      if (statsType === "cll") renderSolveStatsTable();
    });
  }

  if (!isOllPllSvgsPrewarmed()) {
    prewarmOllPllSvgs(ollCases, pllCases).then(() => {
      if (statsType === "cll") renderSolveStatsTable();
    });
  }

  const track = getTrack(currentPuzzle, currentTrackId);
  const trackCases = track?.cases || [];
  const trackCaseIds = trackCases.map(c => c.id);
  const caseMap = track?.caseById || new Map();

  const currentSess = getActiveSession();
  const currentSolves = currentSess.solves || [];

  const caseSolves = new Map();
  const addCaseRecord = (caseId, msVal, pauseCount = 0, pauseMs = 0) => {
    if (!caseId || !Number.isFinite(msVal) || msVal <= 0) return;
    if (!caseSolves.has(caseId)) {
      caseSolves.set(caseId, { times: [], pauseCounts: [], pauseMsList: [] });
    }
    const rec = caseSolves.get(caseId);
    rec.times.push(msVal);
    rec.pauseCounts.push(pauseCount);
    rec.pauseMsList.push(pauseMs);
  };

  for (const s of currentSolves) {
    if (s.penalty === "DNF" || s.penalty === -1) continue;
    const cfop = ensureSolveCfop(s);
    const isTrackMatch = s.track ? (s.track === currentTrackId) : true;

    if (s.id && trackCaseIds.includes(s.id) && isTrackMatch) {
      const timeVal = (s.penalty === "+2" || s.penalty === 2)
        ? ((s.ms ?? s.time) + 2000)
        : (s.ms ?? s.time);
      const pCount = cfop?.pauses?.totalCount || 0;
      const pMs = cfop?.pauses?.totalMs || 0;
      addCaseRecord(s.id, timeVal, pCount, pMs);
    } else if (cfop) {
      // Also include OLL & PLL cases automatically detected from 3x3 CFOP full solves
      if (currentTrackId === "oll" && cfop.ollCase?.id && trackCaseIds.includes(cfop.ollCase.id)) {
        addCaseRecord(cfop.ollCase.id, cfop.ollCase.ms, cfop.ollCase.pauseCount || 0, cfop.ollCase.pauseMs || 0);
      } else if (currentTrackId === "pll" && cfop.pllCase?.id && trackCaseIds.includes(cfop.pllCase.id)) {
        addCaseRecord(cfop.pllCase.id, cfop.pllCase.ms, cfop.pllCase.pauseCount || 0, cfop.pllCase.pauseMs || 0);
      }
    }
  }

  const casesWithTimes = trackCaseIds.filter(id => caseSolves.has(id));
  const isOllTrack = (currentPuzzle === "333" || currentPuzzle === "333oh") && currentTrackId === "oll";
  const isPllTrack = (currentPuzzle === "333" || currentPuzzle === "333oh") && currentTrackId === "pll";
  const showCubeSvgCol = isOllTrack || isPllTrack;
  const showGroupCol = !isPllTrack;

  const sortCols = [
    { key: "case", label: "Case" },
    ...(showCubeSvgCol ? [{ key: "cube", label: "Cube", unsortable: true }] : []),
    ...(showGroupCol ? [{ key: "name", label: isOllTrack ? "Group" : "Name / Group" }] : []),
    { key: "attempts", label: "Attempts" },
    { key: "best", label: "Best", title: "Best time" },
    { key: "median", label: "Median", title: "Median time (1st priority)" },
    { key: "trimMean", label: "TrimMean 10%", title: "Trimmed mean (excludes top & bottom 10%)" },
    { key: "mean", label: "Mean", title: "Arithmetic mean time" },
    { key: "worst", label: "Worst", title: "Worst time" },
    { key: "avgPauseCount", label: "Avg Pauses", title: "Average pauses per solve" },
    { key: "avgPauseMs", label: "Avg Pause Time", title: "Average pause duration per solve" }
  ];

  let html = '<table class="solve-stats-table"><thead><tr>';
  sortCols.forEach(col => {
    if (col.unsortable) {
      html += `<th scope="col">${col.label}</th>`;
      return;
    }
    const isSorted = solveStatsSort.col === col.key;
    const arrow = isSorted ? (solveStatsSort.dir === "asc" ? " ▲" : " ▼") : "";
    html += `<th scope="col" class="sortable" data-sort="${col.key}" title="${col.title || ('Sort by ' + col.label)}">${col.label}<span class="sort-icon">${arrow}</span></th>`;
  });
  html += '</tr></thead><tbody>';

  if (casesWithTimes.length === 0) {
    html += `<tr><td colspan="${sortCols.length}" class="empty-stats" style="padding: 24px 12px; text-align: center;">
      <p style="margin-bottom: 4px; font-weight: 600;">No ${escapeHtml(track?.shortName || '')} case solves recorded in session "${escapeHtml(currentSess.name)}".</p>
      <p style="font-size: 0.85rem; color: var(--muted); margin: 0;">Complete 3x3 CFOP solves with your Smart Cube or time solves with Target set to <strong>${escapeHtml(track?.shortName || '')}</strong> to build per-case statistics.</p>
    </td></tr></tbody></table>`;
    container.innerHTML = html;
    attachSortListeners(container);
    return;
  }

  const caseStatsList = casesWithTimes.map(id => {
    const rec = caseSolves.get(id);
    const times = rec.times;
    const attempts = times.length;
    const best = Math.min(...times);
    const worst = Math.max(...times);
    const mean = Math.round(times.reduce((sum, t) => sum + t, 0) / attempts);
    const median = computeMedian(times);
    const trimMean = computeTrimmedMean(times, 0.10);
    const avgPauseCount = rec.pauseCounts.length
      ? Number((rec.pauseCounts.reduce((a, b) => a + b, 0) / rec.pauseCounts.length).toFixed(1))
      : 0;
    const avgPauseMs = rec.pauseMsList.length
      ? Math.round(rec.pauseMsList.reduce((a, b) => a + b, 0) / rec.pauseMsList.length)
      : 0;
    const caseObj = caseMap.get(id);
    const name = isOllTrack
      ? (caseObj?.group || id)
      : (caseObj ? (caseObj.name || caseObj.group || id) : id);
    return { id, name, attempts, best, worst, mean, median, trimMean, avgPauseCount, avgPauseMs };
  });

  caseStatsList.sort((a, b) => {
    let valA = a[solveStatsSort.col];
    let valB = b[solveStatsSort.col];
    if (solveStatsSort.col === "case") {
      valA = trackCaseIds.indexOf(a.id);
      valB = trackCaseIds.indexOf(b.id);
    }
    if (valA < valB) return solveStatsSort.dir === "asc" ? -1 : 1;
    if (valA > valB) return solveStatsSort.dir === "asc" ? 1 : -1;
    return 0;
  });

  caseStatsList.forEach(stat => {
    const svgDiagram = showCubeSvgCol
      ? getCachedCaseSvg("333", isOllTrack ? "oll" : "pll", stat.id)
      : "";
    html += `<tr>
      <th scope="row"><strong>${escapeHtml(stat.id)}</strong></th>
      ${showCubeSvgCol ? `<td class="case-svg-cell"><div class="case-table-svg">${svgDiagram}</div></td>` : ''}
      ${showGroupCol ? `<td style="color: var(--muted); font-size: 0.85rem;">${escapeHtml(stat.name)}</td>` : ''}
      <td>${stat.attempts}</td>
      <td>${formatSolveTime(stat.best)}</td>
      <td><strong>${formatSolveTime(stat.median)}</strong></td>
      <td><strong>${formatSolveTime(stat.trimMean)}</strong></td>
      <td>${formatSolveTime(stat.mean)}</td>
      <td>${formatSolveTime(stat.worst)}</td>
      <td>${stat.avgPauseCount}</td>
      <td>${formatSolveTime(stat.avgPauseMs)}s</td>
    </tr>`;
  });

  html += '</tbody>';

  if (caseStatsList.length > 1) {
    const allTimes = [];
    const allPauseCounts = [];
    const allPauseMs = [];
    casesWithTimes.forEach(id => {
      const rec = caseSolves.get(id);
      if (rec) {
        allTimes.push(...rec.times);
        allPauseCounts.push(...rec.pauseCounts);
        allPauseMs.push(...rec.pauseMsList);
      }
    });
    const totalAttempts = allTimes.length;
    const overallBest = allTimes.length ? Math.min(...allTimes) : 0;
    const overallWorst = allTimes.length ? Math.max(...allTimes) : 0;
    const overallMean = allTimes.length ? Math.round(allTimes.reduce((sum, t) => sum + t, 0) / totalAttempts) : 0;
    const overallMedian = allTimes.length ? computeMedian(allTimes) : 0;
    const overallTrimMean = allTimes.length ? computeTrimmedMean(allTimes, 0.10) : 0;
    const overallAvgPauses = allPauseCounts.length ? Number((allPauseCounts.reduce((a, b) => a + b, 0) / allPauseCounts.length).toFixed(1)) : 0;
    const overallAvgPauseMs = allPauseMs.length ? Math.round(allPauseMs.reduce((a, b) => a + b, 0) / allPauseMs.length) : 0;

    html += `<tfoot><tr>
      <th scope="row">Total</th>
      ${showCubeSvgCol ? `<td></td>` : ''}
      ${showGroupCol ? `<td style="color: var(--muted); font-size: 0.85rem;">${caseStatsList.length} cases</td>` : ''}
      <td>${totalAttempts}</td>
      <td>${formatSolveTime(overallBest)}</td>
      <td><strong>${formatSolveTime(overallMedian)}</strong></td>
      <td><strong>${formatSolveTime(overallTrimMean)}</strong></td>
      <td>${formatSolveTime(overallMean)}</td>
      <td>${formatSolveTime(overallWorst)}</td>
      <td>${overallAvgPauses}</td>
      <td>${formatSolveTime(overallAvgPauseMs)}s</td>
    </tr></tfoot>`;
  }

  html += '</table>';
  container.innerHTML = html;
  attachSortListeners(container);
}

function attachSortListeners(container) {
  container.querySelectorAll("th.sortable").forEach(th => {
    th.addEventListener("click", () => {
      const col = th.dataset.sort;
      if (!col) return;
      if (solveStatsSort.col === col) {
        solveStatsSort.dir = solveStatsSort.dir === "asc" ? "desc" : "asc";
      } else {
        solveStatsSort.col = col;
        solveStatsSort.dir = (col === "case" || col === "name" || col === "best" || col === "mean" || col === "median" || col === "trimMean" || col === "worst") ? "asc" : "desc";
      }
      renderSolveStatsTable();
    });
  });
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatSolveDate(timestamp) {
  if (!timestamp) return "-";
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) return "-";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function renderSolveDateClockHtml(timestamp) {
  const dateStr = formatSolveDate(timestamp);
  if (dateStr === "-") return "-";
  const safeDate = escapeHtml(dateStr);
  return `
    <div class="solve-date-clock-wrap">
      <button type="button" class="btn-solve-date-clock" title="${safeDate}" aria-label="Solve date: ${safeDate}">&#x1F552;</button>
      <div class="solve-date-popover" role="tooltip">
        <span class="solve-date-popover-icon" aria-hidden="true">&#x1F552;</span>
        <span class="solve-date-popover-text">${safeDate}</span>
      </div>
    </div>
  `;
}

function calculateMedian(arr) {
  if (!arr.length) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function renderOllPllCasesBreakdownHtml(solvesList) {
  const { ollCases: ollStats, pllCases: pllStats } = computeOllPllCaseStats(solvesList);

  const renderCaseSubTable = (title, subtitle, items, badgeClass, trackId) => {
    const isOpen = trackId === "oll" ? ollCasesStatsOpen : pllCasesStatsOpen;
    const collapseKey = trackId === "oll" ? "ollCases" : "pllCases";
    if (!items || items.length === 0) {
      return `
        <div class="cfop-case-breakdown-card stats-subwidget ${isOpen ? '' : 'is-collapsed'}" data-stats-widget="${collapseKey}">
          <div class="cfop-case-breakdown-head stats-subwidget-head">
            <button type="button" class="stats-subwidget-toggle" data-stats-collapse="${collapseKey}" aria-expanded="${isOpen ? 'true' : 'false'}">
              <span class="chevron" aria-hidden="true"></span>
              <span class="stats-subwidget-title">${escapeHtml(title)}</span>
              <span class="cfop-case-breakdown-sub">${escapeHtml(subtitle)}</span>
            </button>
          </div>
          <div class="stats-subwidget-body">
            <p class="cfop-case-empty">No ${escapeHtml(title)} tracked yet in this session. Solve with your Smart Cube to automatically identify cases, times, and pauses.</p>
          </div>
        </div>
      `;
    }

    const showGroupCol = trackId === "oll";
    const maxPauseMs = Math.max(...items.map(i => i.avgPauseMs));
    const maxMedianMs = Math.max(...items.map(i => i.medianMs || 0));
    const sortState = ollPllBreakdownSort[trackId] || { col: "medianMs", dir: "desc" };
    const sortedItems = [...items].sort((a, b) => {
      const col = sortState.col;
      let vA = a[col];
      let vB = b[col];
      if (col === "shortName" || col === "group") {
        vA = String(vA || "").toLowerCase();
        vB = String(vB || "").toLowerCase();
      } else {
        vA = Number.isFinite(vA) ? vA : -1;
        vB = Number.isFinite(vB) ? vB : -1;
      }
      if (vA < vB) return sortState.dir === "asc" ? -1 : 1;
      if (vA > vB) return sortState.dir === "asc" ? 1 : -1;
      return 0;
    });
    const sortArrow = (col) => sortState.col === col ? (sortState.dir === "asc" ? " ▲" : " ▼") : "";

    const rowsHtml = sortedItems.map((item) => {
      const needsWork = items.length > 1 && (
        (item.medianMs != null && item.medianMs >= maxMedianMs) ||
        (item.avgPauseMs > 400 && item.avgPauseMs >= maxPauseMs * 0.85)
      );
      const priorityBadge = needsWork
        ? `<span class="badge badge-priority-improve" title="Slowest median time or longest pauses — focus practice here">Needs Work</span>`
        : "";
      const svgDiagram = getCachedCaseSvg("333", trackId, item.id);
      return `
        <tr>
          <td class="cfop-case-id-cell">
            <span class="badge ${badgeClass}"><strong>${escapeHtml(item.shortName)}</strong></span>
            ${priorityBadge}
          </td>
          <td class="case-svg-cell"><div class="case-table-svg">${svgDiagram}</div></td>
          ${showGroupCol ? `<td class="cfop-case-group-cell">${escapeHtml(item.group)}</td>` : ''}
          <td>${item.attempts}</td>
          <td><strong>${formatCfopSplitMs(item.medianMs)}</strong></td>
          <td><strong>${formatCfopSplitMs(item.trimMeanMs)}</strong></td>
          <td>${formatCfopSplitMs(item.avgMs)}</td>
          <td>${formatCfopSplitMs(item.bestMs)}</td>
          <td>${formatCfopSplitMs(item.worstMs)}</td>
          <td class="${item.avgPauseCount > 0 ? 'pause-cell-warn' : ''}">
            ${item.avgPauseCount} <small>(${formatCfopSplitMs(item.avgPauseMs)})</small>
          </td>
          <td>${formatCfopSplitMs(item.avgRecogMs)}</td>
        </tr>
      `;
    }).join("");

    return `
      <div class="cfop-case-breakdown-card stats-subwidget ${isOpen ? '' : 'is-collapsed'}" data-stats-widget="${collapseKey}">
        <div class="cfop-case-breakdown-head stats-subwidget-head">
          <button type="button" class="stats-subwidget-toggle" data-stats-collapse="${collapseKey}" aria-expanded="${isOpen ? 'true' : 'false'}">
            <span class="chevron" aria-hidden="true"></span>
            <span class="stats-subwidget-title">${escapeHtml(title)} (${items.length} case${items.length === 1 ? '' : 's'} solved)</span>
            <span class="cfop-case-breakdown-sub">${escapeHtml(subtitle)}</span>
          </button>
        </div>
        <div class="stats-subwidget-body">
          <div class="cfop-table-scroll">
            <table class="layer-log-table cfop-cases-table" data-breakdown-track="${trackId}">
              <thead>
                <tr>
                  <th scope="col" class="sortable" data-breakdown-track="${trackId}" data-breakdown-sort="shortName">Case<span class="sort-icon">${sortArrow("shortName")}</span></th>
                  <th scope="col">Cube</th>
                  ${showGroupCol ? `<th scope="col" class="sortable" data-breakdown-track="${trackId}" data-breakdown-sort="group">Group<span class="sort-icon">${sortArrow("group")}</span></th>` : ''}
                  <th scope="col" class="sortable" data-breakdown-track="${trackId}" data-breakdown-sort="attempts">Solves<span class="sort-icon">${sortArrow("attempts")}</span></th>
                  <th scope="col" class="sortable" data-breakdown-track="${trackId}" data-breakdown-sort="medianMs" title="Median time (1st priority)">Median<span class="sort-icon">${sortArrow("medianMs")}</span></th>
                  <th scope="col" class="sortable" data-breakdown-track="${trackId}" data-breakdown-sort="trimMeanMs" title="Trimmed mean (excludes top & bottom 10%)">Trim10%<span class="sort-icon">${sortArrow("trimMeanMs")}</span></th>
                  <th scope="col" class="sortable" data-breakdown-track="${trackId}" data-breakdown-sort="avgMs" title="Arithmetic mean time">Mean<span class="sort-icon">${sortArrow("avgMs")}</span></th>
                  <th scope="col" class="sortable" data-breakdown-track="${trackId}" data-breakdown-sort="bestMs">Best<span class="sort-icon">${sortArrow("bestMs")}</span></th>
                  <th scope="col" class="sortable" data-breakdown-track="${trackId}" data-breakdown-sort="worstMs">Worst<span class="sort-icon">${sortArrow("worstMs")}</span></th>
                  <th scope="col" class="sortable" data-breakdown-track="${trackId}" data-breakdown-sort="avgPauseMs" title="Average number of pauses (≥0.40s) and average total pause time per case">Avg Pauses<span class="sort-icon">${sortArrow("avgPauseMs")}</span></th>
                  <th scope="col" class="sortable" data-breakdown-track="${trackId}" data-breakdown-sort="avgRecogMs" title="Average pre-algorithm recognition / AUF time">Avg Recog<span class="sort-icon">${sortArrow("avgRecogMs")}</span></th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  };

  return `
    <div class="cfop-cases-improvement-section">
      <div class="layer-log-header" style="margin-top: 20px;">
        <div class="layer-log-title-wrap">
          <h3 class="layer-log-title">3x3 OLL &amp; PLL Case Performance &amp; Pauses (Where to Improve)</h3>
          <span class="layer-log-hint">Sorted by slowest Median first · Click any column header to sort</span>
        </div>
      </div>
      <div class="cfop-cases-grid">
        ${renderCaseSubTable("OLL Cases", "Orientation of the Last Layer — Median, TrimMean, Mean & Pauses per Case", ollStats, "badge-oll-case", "oll")}
        ${renderCaseSubTable("PLL Cases", "Permutation of the Last Layer — Median, TrimMean, Mean & Pauses per Case", pllStats, "badge-pll-case", "pll")}
      </div>
    </div>
  `;
}

function renderSessionLogTable() {
  const container = document.getElementById("stats-table-container");
  if (!container) return;

  const is3x3Puzzle = currentPuzzle === "333" || currentPuzzle === "333oh";

  if (is3x3Puzzle && !isCfopAnalyzerReady()) {
    initCfopAnalyzer().then(() => {
      if (statsType === "log" || statsType === "solve") {
        renderSessionLogTable();
      }
    });
  }

  if (is3x3Puzzle && !isOllPllSvgsPrewarmed()) {
    prewarmOllPllSvgs(ollCases, pllCases).then(() => {
      if (statsType === "log" || statsType === "solve") {
        renderSessionLogTable();
      }
    });
  }

  const sess = getActiveSession();
  const sessSolves = sess.solves || [];

  if (sessSolves.length === 0) {
    container.innerHTML = `
      <div class="empty-stats" style="text-align: center; padding: 24px;">
        <p>No solves recorded in <strong>${escapeHtml(sess.name)}</strong> yet.</p>
        <p style="color: var(--muted); font-size: 0.9rem;">Time your solves in the <strong>Solve</strong> tab to build your session history${is3x3Puzzle ? ', CFOP step splits, and OLL/PLL case analytics' : ''}.</p>
      </div>
    `;
    return;
  }

  const track = getTrack(currentPuzzle, currentTrackId);
  const trackCases = track?.cases || [];
  const trackCaseIds = trackCases.map(c => c.id);

  const trackSolves = sessSolves.filter(s => {
    if (s.track === currentTrackId) return true;
    if (s.target === currentTrackId) return true;
    if (s.id && trackCaseIds.includes(s.id)) return true;
    return false;
  });

  const fullSolves = sessSolves.filter(s => s.target === "full" || (!s.target && !s.id));

  let displaySolves = sessSolves;
  if (sessionLogFilter === "track") {
    displaySolves = trackSolves;
  } else if (sessionLogFilter === "full") {
    displaySolves = fullSolves;
  }

  // Ensure CFOP data is computed on 3x3 displaySolves
  if (is3x3Puzzle) {
    displaySolves.forEach(s => ensureSolveCfop(s));
  }

  const validTimes = displaySolves.filter(s => s.penalty !== "DNF" && s.penalty !== -1).map(s => {
    const ms = s.ms ?? s.time ?? 0;
    return (s.penalty === "+2" || s.penalty === 2) ? ms + 2000 : ms;
  });

  const count = displaySolves.length;
  const best = validTimes.length ? Math.min(...validTimes) : null;
  const mean = validTimes.length ? Math.round(validTimes.reduce((a, b) => a + b, 0) / validTimes.length) : null;
  const median = validTimes.length ? computeMedian(validTimes) : null;
  const trimMean = validTimes.length ? computeTrimmedMean(validTimes, 0.10) : null;
  const worst = validTimes.length ? Math.max(...validTimes) : null;
  const curAo5 = calculateAoN(displaySolves, 5);
  const bestAo5 = getBestAoN(displaySolves, 5);
  const curAo12 = calculateAoN(displaySolves, 12);
  const bestAo12 = getBestAoN(displaySolves, 12);
  const curAo100 = calculateAoN(displaySolves, 100);
  const bestAo100 = getBestAoN(displaySolves, 100);

  const formatAo = (val) => val === "DNF" ? "DNF" : (val != null ? formatSolveTime(val) : "-");

  // Pagination & sorting state calculation (default: newest solves first)
  const allIndexed = [...displaySolves].map((s, idx) => ({
    s,
    num: idx + 1,
    origIdx: sessSolves.indexOf(s)
  }));

  const getLogSortValue = (entry, col) => {
    const s = entry.s;
    if (col === "num" || col === "at") return entry.num;
    if (col === "ms") {
      if (s.penalty === "DNF" || s.penalty === -1) return Infinity;
      const base = s.ms ?? s.time ?? 0;
      return (s.penalty === "+2" || s.penalty === 2) ? base + 2000 : base;
    }
    if (col === "id") return String(s.id || s.target || "").toLowerCase();
    if (col === "pickupMs") return s.pickupMs != null ? s.pickupMs : Infinity;
    if (col === "putdownMs") return s.putdownMs != null ? s.putdownMs : Infinity;
    const cfop = is3x3Puzzle ? ensureSolveCfop(s) : null;
    const sp = cfop?.splits || {};
    if (col in sp) return sp[col] != null ? sp[col] : Infinity;
    if (col === "pauseMs") return cfop?.pauses?.totalMs != null ? cfop.pauses.totalMs : Infinity;
    return entry.num;
  };

  const allReversed = [...allIndexed].sort((a, b) => {
    const col = sessionLogSort.col || "num";
    const dir = sessionLogSort.dir || "desc";
    const vA = getLogSortValue(a, col);
    const vB = getLogSortValue(b, col);
    if (vA === Infinity && vB === Infinity) return b.num - a.num;
    if (vA === Infinity) return 1;
    if (vB === Infinity) return -1;
    if (vA < vB) return dir === "asc" ? -1 : 1;
    if (vA > vB) return dir === "asc" ? 1 : -1;
    return b.num - a.num;
  });

  const logSortArrow = (col) => sessionLogSort.col === col ? (sessionLogSort.dir === "asc" ? " ▲" : " ▼") : "";

  const pageSize = LOG_PAGE_SIZE_OPTIONS.includes(Number(sessionLogPageSize))
    ? Number(sessionLogPageSize)
    : 12;
  const totalPages = Math.max(1, Math.ceil(allReversed.length / pageSize));
  if (sessionLogPage > totalPages) sessionLogPage = totalPages;
  if (sessionLogPage < 1) sessionLogPage = 1;

  const startIdx = (sessionLogPage - 1) * pageSize;
  const endIdx = Math.min(allReversed.length, startIdx + pageSize);
  const pageRows = allReversed.slice(startIdx, endIdx);
  const pageSolves = pageRows.map(r => r.s);
  const newestXSolves = [...allIndexed].reverse().slice(0, pageSize).map(r => r.s);

  // Compute CFOP & Pause Averages for the Last X Solves in Pagination, Current Page, and All Session Solves
  const lastXAvg = computeCfopAverages(newestXSolves);
  const pageAvg = computeCfopAverages(pageSolves);
  const sessionAvg = computeCfopAverages(displaySolves);

  const fmtPauseSummary = (countVal, msVal) => {
    if (countVal == null) return "-";
    return `${countVal} (${formatCfopSplitMs(msVal || 0)})`;
  };

  let html = `
    <div class="stats-subfilter-bar">
      <span style="font-size: 0.85rem; color: var(--muted); font-weight: 600;">Filter:</span>
      <button type="button" class="stats-subfilter-btn ${sessionLogFilter === 'all' ? 'active' : ''}" data-log-filter="all">All (${sessSolves.length})</button>
      <button type="button" class="stats-subfilter-btn ${sessionLogFilter === 'track' ? 'active' : ''}" data-log-filter="track">${escapeHtml(track?.shortName || 'Current Set')} (${trackSolves.length})</button>
      <button type="button" class="stats-subfilter-btn ${sessionLogFilter === 'full' ? 'active' : ''}" data-log-filter="full">Full Solves (${fullSolves.length})</button>
      <button type="button" class="btn btn-xs" id="sessionLogExportCsvBtn" style="margin-left: auto;" title="Export current session to CSV">📥 Export CSV</button>
    </div>

    <div class="layer-stats-grid">
      <div class="layer-stat-card">
        <span class="layer-stat-val">${count}</span>
        <span class="layer-stat-lbl">Attempts</span>
      </div>
      <div class="layer-stat-card highlight-best">
        <span class="layer-stat-val">${best != null ? formatSolveTime(best) : "-"}</span>
        <span class="layer-stat-lbl">Best</span>
      </div>
      <div class="layer-stat-card highlight-best">
        <span class="layer-stat-val">${median != null ? formatSolveTime(median) : "-"}</span>
        <span class="layer-stat-lbl">Median</span>
      </div>
      <div class="layer-stat-card" title="Trimmed Mean (excludes fastest 10% and slowest 10% of solves)">
        <span class="layer-stat-val">${trimMean != null ? formatSolveTime(trimMean) : "-"}</span>
        <span class="layer-stat-lbl">TrimMean 10%</span>
      </div>
      <div class="layer-stat-card">
        <span class="layer-stat-val">${mean != null ? formatSolveTime(mean) : "-"}</span>
        <span class="layer-stat-lbl">Mean</span>
      </div>
      <div class="layer-stat-card">
        <span class="layer-stat-val">${worst != null ? formatSolveTime(worst) : "-"}</span>
        <span class="layer-stat-lbl">Worst</span>
      </div>
  `;

  const logAvgPickup = averagePhase(displaySolves, "pickupMs");
  const logAvgPutdown = averagePhase(displaySolves, "putdownMs");
  if (logAvgPickup != null || logAvgPutdown != null) {
    html += `
      <div class="layer-stat-card" title="GAN timer start → first smart cube turn">
        <span class="layer-stat-val">${formatCfopSplitMs(logAvgPickup)}</span>
        <span class="layer-stat-lbl">Avg Pick-up</span>
      </div>
      <div class="layer-stat-card" title="Smart cube solved → GAN timer stopped">
        <span class="layer-stat-val">${formatCfopSplitMs(logAvgPutdown)}</span>
        <span class="layer-stat-lbl">Avg Put-down</span>
      </div>
    `;
  }

  if (count >= 5) {
    html += `
      <div class="layer-stat-card">
        <span class="layer-stat-val">${formatAo(curAo5)}</span>
        <span class="layer-stat-lbl">Ao5</span>
      </div>
      <div class="layer-stat-card">
        <span class="layer-stat-val">${formatAo(bestAo5)}</span>
        <span class="layer-stat-lbl">Best Ao5</span>
      </div>
    `;
  }
  if (count >= 12) {
    html += `
      <div class="layer-stat-card">
        <span class="layer-stat-val">${formatAo(curAo12)}</span>
        <span class="layer-stat-lbl">Ao12</span>
      </div>
      <div class="layer-stat-card">
        <span class="layer-stat-val">${formatAo(bestAo12)}</span>
        <span class="layer-stat-lbl">Best Ao12</span>
      </div>
    `;
  }
  if (count >= 100) {
    html += `
      <div class="layer-stat-card">
        <span class="layer-stat-val">${formatAo(curAo100)}</span>
        <span class="layer-stat-lbl">Ao100</span>
      </div>
      <div class="layer-stat-card">
        <span class="layer-stat-val">${formatAo(bestAo100)}</span>
        <span class="layer-stat-lbl">Best Ao100</span>
      </div>
    `;
  }

  html += `</div>`;

  const renderCfopStatRowHtml = (scopeTitle, subMeta, statsObj, pauseCnt, pauseMsVal, rowClass = "") => {
    if (!statsObj) return "";
    return `
      <tr class="${rowClass}">
        <td class="cfop-avg-scope-cell"><strong>${scopeTitle}</strong> ${subMeta ? `<small class="cfop-sub-meta">${subMeta}</small>` : ''}</td>
        <td><strong>${statsObj.totalMs != null ? formatSolveTime(statsObj.totalMs) + 's' : '-'}</strong></td>
        <td>${formatCfopSplitMs(statsObj.cross)}</td>
        <td>${formatCfopSplitMs(statsObj.f2l1)}</td>
        <td>${formatCfopSplitMs(statsObj.f2l2)}</td>
        <td>${formatCfopSplitMs(statsObj.f2l3)}</td>
        <td>${formatCfopSplitMs(statsObj.f2l4)}</td>
        <td><strong>${formatCfopSplitMs(statsObj.f2lTotal)}</strong></td>
        <td>${formatCfopSplitMs(statsObj.oll)}</td>
        <td>${formatCfopSplitMs(statsObj.pll)}</td>
        <td>${fmtPauseSummary(pauseCnt, pauseMsVal)}</td>
        <td>${formatCfopSplitMs(statsObj.pickupMs)}</td>
        <td>${formatCfopSplitMs(statsObj.putdownMs)}</td>
      </tr>
    `;
  };

  // Only show 3x3 CFOP Phase & Pause Averages Table on 3x3 / 3x3 OH
  if (is3x3Puzzle) {
    html += `
      <div class="cfop-averages-summary-card stats-subwidget ${cfopSummaryOpen ? '' : 'is-collapsed'}" data-stats-widget="cfopSummary">
        <div class="cfop-averages-head stats-subwidget-head">
          <button type="button" class="stats-subwidget-toggle" data-stats-collapse="cfopSummary" aria-expanded="${cfopSummaryOpen ? 'true' : 'false'}">
            <span class="chevron" aria-hidden="true"></span>
            <span class="cfop-averages-title">CFOP Phase &amp; Pause Stats (Median, TrimMean 10%, Mean) — Last ${newestXSolves.length} vs Session (${count})</span>
            <span class="cfop-averages-hint">Median (1st) · TrimMean 10% (2nd) · Mean (3rd) · Pauses ≥0.40s</span>
          </button>
        </div>
        <div class="stats-subwidget-body">
          <div class="cfop-table-scroll">
            <table class="layer-log-table cfop-avg-comparison-table">
              <thead>
                <tr>
                  <th scope="col" class="cfop-avg-scope-cell">Scope / Metric</th>
                  <th scope="col">Total</th>
                  <th scope="col">Cross</th>
                  <th scope="col">F2L 1</th>
                  <th scope="col">F2L 2</th>
                  <th scope="col">F2L 3</th>
                  <th scope="col">F2L 4</th>
                  <th scope="col">F2L &Sigma;</th>
                  <th scope="col">OLL</th>
                  <th scope="col">PLL</th>
                  <th scope="col">Pauses</th>
                  <th scope="col" title="Time from GAN Bluetooth timer start to first smart cube turn">Pick-up</th>
                  <th scope="col" title="Time from smart cube solved to GAN Bluetooth timer stop">Put-down</th>
                </tr>
              </thead>
              <tbody>
                ${renderCfopStatRowHtml(`Last ${newestXSolves.length} · Median`, `(Page ${pageSize})`, lastXAvg.median, lastXAvg.median?.pauseCount, lastXAvg.median?.pauseMs, "cfop-trim-highlight-row")}
                ${renderCfopStatRowHtml(`Last ${newestXSolves.length} · Trim10%`, `(-top/bot 10%)`, lastXAvg.trimMean, lastXAvg.trimMean?.pauseCount, lastXAvg.trimMean?.pauseMs)}
                ${renderCfopStatRowHtml(`Last ${newestXSolves.length} · Mean`, ``, lastXAvg, lastXAvg.avgPauseCount, lastXAvg.avgPauseMs)}
                ${renderCfopStatRowHtml(`Session · Median`, `(${count} solves)`, sessionAvg.median, sessionAvg.median?.pauseCount, sessionAvg.median?.pauseMs, "cfop-trim-highlight-row")}
                ${renderCfopStatRowHtml(`Session · Trim10%`, `(-top/bot 10%)`, sessionAvg.trimMean, sessionAvg.trimMean?.pauseCount, sessionAvg.trimMean?.pauseMs)}
                ${renderCfopStatRowHtml(`Session · Mean`, `(${count} solves)`, sessionAvg, sessionAvg.avgPauseCount, sessionAvg.avgPauseMs, "cfop-session-avg-row")}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  }

  // Pagination & Solve Log Header (Collapsible with leading chevron + pagination on right)
  html += `
    <div class="stats-subwidget stats-subwidget-log ${solveLogOpen ? '' : 'is-collapsed'}" data-stats-widget="solveLog">
      <div class="layer-log-header layer-log-header-bar stats-subwidget-head">
        <button type="button" class="stats-subwidget-toggle" data-stats-collapse="solveLog" aria-expanded="${solveLogOpen ? 'true' : 'false'}">
          <span class="chevron" aria-hidden="true"></span>
          <span class="layer-log-title-wrap">
            <span class="layer-log-title">Solve Log &mdash; ${escapeHtml(sess.name)} (${allReversed.length})</span>
            <span class="layer-log-hint">${is3x3Puzzle ? 'Click any column header to sort · Tap any row for full CFOP breakdown &amp; 3D replay' : 'Click any column header to sort · Tap any row for solve details'}</span>
          </span>
        </button>
        <div class="layer-log-pagination-controls">
          <label class="pagination-size-group" for="sessionLogPageSizeSelect">
            <span class="pagination-size-label">Show:</span>
            <select id="sessionLogPageSizeSelect" class="pagination-size-select" aria-label="Items per page">
              ${LOG_PAGE_SIZE_OPTIONS.map(sz => `<option value="${sz}" ${pageSize === sz ? 'selected' : ''}>${sz}</option>`).join("")}
            </select>
          </label>
          <span class="pagination-status-text">
            <strong>${allReversed.length ? startIdx + 1 : 0}&ndash;${endIdx}</strong> of <strong>${allReversed.length}</strong> (${sessionLogPage}/${totalPages})
          </span>
          <div class="pagination-nav-group" role="group" aria-label="Page navigation">
            <button type="button" class="btn btn-xs pagination-nav-btn" id="logPageFirstBtn" ${sessionLogPage <= 1 ? 'disabled' : ''} title="First page">|&lt;</button>
            <button type="button" class="btn btn-xs pagination-nav-btn" id="logPagePrevBtn" ${sessionLogPage <= 1 ? 'disabled' : ''} title="Previous page">&lt;</button>
            <button type="button" class="btn btn-xs pagination-nav-btn" id="logPageNextBtn" ${sessionLogPage >= totalPages ? 'disabled' : ''} title="Next page">&gt;</button>
            <button type="button" class="btn btn-xs pagination-nav-btn" id="logPageLastBtn" ${sessionLogPage >= totalPages ? 'disabled' : ''} title="Final page">&gt;|</button>
          </div>
        </div>
      </div>
      <div class="stats-subwidget-body">
  `;

  if (is3x3Puzzle) {
    html += `
      <div class="cfop-table-scroll">
        <table class="layer-log-table cfop-solve-log-table">
          <thead>
            <tr>
              <th scope="col" class="sortable" data-log-sort="num" style="width: 42px;">#<span class="sort-icon">${logSortArrow("num")}</span></th>
              <th scope="col" class="sortable" data-log-sort="ms">Time<span class="sort-icon">${logSortArrow("ms")}</span></th>
              <th scope="col" class="sortable" data-log-sort="cross">Cross<span class="sort-icon">${logSortArrow("cross")}</span></th>
              <th scope="col" class="sortable" data-log-sort="f2l1">F2L 1<span class="sort-icon">${logSortArrow("f2l1")}</span></th>
              <th scope="col" class="sortable" data-log-sort="f2l2">F2L 2<span class="sort-icon">${logSortArrow("f2l2")}</span></th>
              <th scope="col" class="sortable" data-log-sort="f2l3">F2L 3<span class="sort-icon">${logSortArrow("f2l3")}</span></th>
              <th scope="col" class="sortable" data-log-sort="f2l4">F2L 4<span class="sort-icon">${logSortArrow("f2l4")}</span></th>
              <th scope="col" class="sortable" data-log-sort="f2lTotal">F2L &Sigma;<span class="sort-icon">${logSortArrow("f2lTotal")}</span></th>
              <th scope="col" class="sortable" data-log-sort="oll">OLL<span class="sort-icon">${logSortArrow("oll")}</span></th>
              <th scope="col" class="sortable" data-log-sort="pll">PLL<span class="sort-icon">${logSortArrow("pll")}</span></th>
              <th scope="col" class="sortable" data-log-sort="pauseMs" title="Number of pauses (≥0.40s) and total pause duration">Pauses<span class="sort-icon">${logSortArrow("pauseMs")}</span></th>
              <th scope="col" class="sortable" data-log-sort="pickupMs" title="Time from GAN Bluetooth timer start to first smart cube turn">Pick-up<span class="sort-icon">${logSortArrow("pickupMs")}</span></th>
              <th scope="col" class="sortable" data-log-sort="putdownMs" title="Time from smart cube solved to GAN Bluetooth timer stop">Put-down<span class="sort-icon">${logSortArrow("putdownMs")}</span></th>
              <th scope="col" class="sortable" data-log-sort="at" style="width: 52px; text-align: center;" title="Date &amp; time (YYYY-MM-DD HH:MM:SS)">Date<span class="sort-icon">${logSortArrow("at")}</span></th>
              <th scope="col" style="width: 78px;">Actions</th>
            </tr>
          </thead>
          <tbody>
    `;

    if (pageRows.length === 0) {
      html += `<tr><td colspan="15" class="empty-stats" style="text-align: center; padding: 20px;">No solves match filter "${escapeHtml(sessionLogFilter)}".</td></tr>`;
    } else {
      pageRows.forEach(({ s, num, origIdx }) => {
        const cfop = ensureSolveCfop(s);
        const sp = cfop?.splits || {};
        const ollCase = cfop?.ollCase;
        const pllCase = cfop?.pllCase;
        const pauses = cfop?.pauses;

        const ollCellHtml = sp.oll != null
          ? `<div class="cfop-cell-stack">
              <span class="cfop-split-val">${formatCfopSplitMs(sp.oll)}</span>
              ${ollCase?.shortName ? `<span class="badge badge-oll-case" title="${escapeHtml(ollCase.name)}">${escapeHtml(ollCase.shortName)}</span>` : ''}
            </div>`
          : (s.target === "oll" && s.id ? `<span class="badge badge-oll-case">${escapeHtml(s.id)}</span>` : "-");

        const pllCellHtml = sp.pll != null
          ? `<div class="cfop-cell-stack">
              <span class="cfop-split-val">${formatCfopSplitMs(sp.pll)}</span>
              ${pllCase?.shortName ? `<span class="badge badge-pll-case" title="${escapeHtml(pllCase.name)}">${escapeHtml(pllCase.shortName)}</span>` : ''}
            </div>`
          : (s.target === "pll" && s.id ? `<span class="badge badge-pll-case">${escapeHtml(s.id)}</span>` : "-");

        const pauseCellHtml = pauses
          ? `<span class="${pauses.totalCount > 0 ? 'pause-cell-warn' : 'pause-cell-clean'}" title="${pauses.totalCount} pause(s) totaling ${formatCfopSplitMs(pauses.totalMs)}">
              ${pauses.totalCount} <small>(${formatCfopSplitMs(pauses.totalMs)})</small>
            </span>`
          : "-";

        const dateClockHtml = renderSolveDateClockHtml(s.at);
        const hasReplay = Array.isArray(s.moves) && s.moves.length > 0;

        html += `
          <tr class="layer-log-row" data-index="${origIdx}" data-num="${num}" title="Click to view full CFOP details &amp; scramble">
            <td>${num}</td>
            <td class="layer-time-cell">
              <div class="cfop-cell-stack">
                <strong>${formatSolveDisplay(s)}</strong>
                ${s.tps ? `<small class="cfop-sub-meta">${s.tps} TPS</small>` : ''}
              </div>
            </td>
            <td>${formatCfopSplitMs(sp.cross)}</td>
            <td>${formatCfopSplitMs(sp.f2l1)}</td>
            <td>${formatCfopSplitMs(sp.f2l2)}</td>
            <td>${formatCfopSplitMs(sp.f2l3)}</td>
            <td>${formatCfopSplitMs(sp.f2l4)}</td>
            <td><strong>${formatCfopSplitMs(sp.f2lTotal)}</strong></td>
            <td>${ollCellHtml}</td>
            <td>${pllCellHtml}</td>
            <td>${pauseCellHtml}</td>
            <td>${formatCfopSplitMs(s.pickupMs)}</td>
            <td>${formatCfopSplitMs(s.putdownMs)}</td>
            <td class="layer-date-cell">${dateClockHtml}</td>
            <td>
              <div class="layer-log-actions">
                ${hasReplay ? `<button type="button" class="btn-replay-solve" data-index="${origIdx}" data-num="${num}" title="Replay solve #${num} in 3D">&#x25B6;</button>` : ''}
                <button type="button" class="btn-reattempt-solve" data-index="${origIdx}" data-num="${num}" title="Reattempt solve #${num} scramble">&#x21bb;</button>
                <button type="button" class="btn-del-solve" data-index="${origIdx}" data-num="${num}" title="Delete solve #${num} (${formatSolveDisplay(s)})">&times;</button>
              </div>
            </td>
          </tr>
        `;
      });
    }

    html += `
          </tbody>
          <tfoot>
            <tr class="cfop-tfoot-page-avg cfop-trim-highlight-row">
              <th scope="row">Med</th>
              <td>
                <div class="cfop-cell-stack">
                  <strong>${pageAvg.median?.totalMs != null ? formatSolveTime(pageAvg.median.totalMs) : '-'}</strong>
                  <small class="cfop-sub-meta">Page (${pageSolves.length})</small>
                </div>
              </td>
              <td>${formatCfopSplitMs(pageAvg.median?.cross)}</td>
              <td>${formatCfopSplitMs(pageAvg.median?.f2l1)}</td>
              <td>${formatCfopSplitMs(pageAvg.median?.f2l2)}</td>
              <td>${formatCfopSplitMs(pageAvg.median?.f2l3)}</td>
              <td>${formatCfopSplitMs(pageAvg.median?.f2l4)}</td>
              <td><strong>${formatCfopSplitMs(pageAvg.median?.f2lTotal)}</strong></td>
              <td>${formatCfopSplitMs(pageAvg.median?.oll)}</td>
              <td>${formatCfopSplitMs(pageAvg.median?.pll)}</td>
              <td>${fmtPauseSummary(pageAvg.median?.pauseCount, pageAvg.median?.pauseMs)}</td>
              <td>${formatCfopSplitMs(pageAvg.median?.pickupMs)}</td>
              <td>${formatCfopSplitMs(pageAvg.median?.putdownMs)}</td>
              <td colspan="2"><small class="cfop-sub-meta">Page Median</small></td>
            </tr>
            <tr class="cfop-tfoot-page-avg">
              <th scope="row">Trim</th>
              <td>
                <div class="cfop-cell-stack">
                  <strong>${pageAvg.trimMean?.totalMs != null ? formatSolveTime(pageAvg.trimMean.totalMs) : '-'}</strong>
                  <small class="cfop-sub-meta">Trim10%</small>
                </div>
              </td>
              <td>${formatCfopSplitMs(pageAvg.trimMean?.cross)}</td>
              <td>${formatCfopSplitMs(pageAvg.trimMean?.f2l1)}</td>
              <td>${formatCfopSplitMs(pageAvg.trimMean?.f2l2)}</td>
              <td>${formatCfopSplitMs(pageAvg.trimMean?.f2l3)}</td>
              <td>${formatCfopSplitMs(pageAvg.trimMean?.f2l4)}</td>
              <td><strong>${formatCfopSplitMs(pageAvg.trimMean?.f2lTotal)}</strong></td>
              <td>${formatCfopSplitMs(pageAvg.trimMean?.oll)}</td>
              <td>${formatCfopSplitMs(pageAvg.trimMean?.pll)}</td>
              <td>${fmtPauseSummary(pageAvg.trimMean?.pauseCount, pageAvg.trimMean?.pauseMs)}</td>
              <td>${formatCfopSplitMs(pageAvg.trimMean?.pickupMs)}</td>
              <td>${formatCfopSplitMs(pageAvg.trimMean?.putdownMs)}</td>
              <td colspan="2"><small class="cfop-sub-meta">Page TrimMean 10%</small></td>
            </tr>
            <tr class="cfop-tfoot-page-avg">
              <th scope="row">Mean</th>
              <td>
                <div class="cfop-cell-stack">
                  <strong>${pageAvg.totalMs != null ? formatSolveTime(pageAvg.totalMs) : '-'}</strong>
                  <small class="cfop-sub-meta">Page (${pageSolves.length})</small>
                </div>
              </td>
              <td>${formatCfopSplitMs(pageAvg.cross)}</td>
              <td>${formatCfopSplitMs(pageAvg.f2l1)}</td>
              <td>${formatCfopSplitMs(pageAvg.f2l2)}</td>
              <td>${formatCfopSplitMs(pageAvg.f2l3)}</td>
              <td>${formatCfopSplitMs(pageAvg.f2l4)}</td>
              <td><strong>${formatCfopSplitMs(pageAvg.f2lTotal)}</strong></td>
              <td>${formatCfopSplitMs(pageAvg.oll)}</td>
              <td>${formatCfopSplitMs(pageAvg.pll)}</td>
              <td>${fmtPauseSummary(pageAvg.avgPauseCount, pageAvg.avgPauseMs)}</td>
              <td>${formatCfopSplitMs(pageAvg.pickupMs)}</td>
              <td>${formatCfopSplitMs(pageAvg.putdownMs)}</td>
              <td colspan="2"><small class="cfop-sub-meta">Page Mean</small></td>
            </tr>
            <tr class="cfop-tfoot-session-avg">
              <th scope="row">All</th>
              <td>
                <div class="cfop-cell-stack">
                  <strong>${sessionAvg.median?.totalMs != null ? formatSolveTime(sessionAvg.median.totalMs) : '-'}</strong>
                  <small class="cfop-sub-meta">Session (${count})</small>
                </div>
              </td>
              <td>${formatCfopSplitMs(sessionAvg.median?.cross)}</td>
              <td>${formatCfopSplitMs(sessionAvg.median?.f2l1)}</td>
              <td>${formatCfopSplitMs(sessionAvg.median?.f2l2)}</td>
              <td>${formatCfopSplitMs(sessionAvg.median?.f2l3)}</td>
              <td>${formatCfopSplitMs(sessionAvg.median?.f2l4)}</td>
              <td><strong>${formatCfopSplitMs(sessionAvg.median?.f2lTotal)}</strong></td>
              <td>${formatCfopSplitMs(sessionAvg.median?.oll)}</td>
              <td>${formatCfopSplitMs(sessionAvg.median?.pll)}</td>
              <td>${fmtPauseSummary(sessionAvg.median?.pauseCount, sessionAvg.median?.pauseMs)}</td>
              <td>${formatCfopSplitMs(sessionAvg.median?.pickupMs)}</td>
              <td>${formatCfopSplitMs(sessionAvg.median?.putdownMs)}</td>
              <td colspan="2"><small class="cfop-sub-meta">Session Median</small></td>
            </tr>
          </tfoot>
        </table>
      </div>
      </div>
    </div>
    `;

    // Append OLL & PLL Per-Case Performance & Pause Tracker on 3x3
    html += renderOllPllCasesBreakdownHtml(displaySolves);
  } else {
    // Non-3x3 Puzzles (2x2, 4x4, 5x5): Clean, focused Solve Log table without 3x3 CFOP columns
    html += `
      <div class="cfop-table-scroll">
        <table class="layer-log-table standard-solve-log-table">
          <thead>
            <tr>
              <th scope="col" class="sortable" data-log-sort="num" style="width: 44px;">#<span class="sort-icon">${logSortArrow("num")}</span></th>
              <th scope="col" class="sortable" data-log-sort="ms" style="width: 110px;">Time<span class="sort-icon">${logSortArrow("ms")}</span></th>
              <th scope="col" class="sortable" data-log-sort="pickupMs" style="width: 78px;" title="Time from GAN Bluetooth timer start to first smart cube turn">Pick-up<span class="sort-icon">${logSortArrow("pickupMs")}</span></th>
              <th scope="col" class="sortable" data-log-sort="putdownMs" style="width: 78px;" title="Time from smart cube solved to GAN Bluetooth timer stop">Put-down<span class="sort-icon">${logSortArrow("putdownMs")}</span></th>
              <th scope="col" class="sortable" data-log-sort="id" style="width: 140px;">Case / Target<span class="sort-icon">${logSortArrow("id")}</span></th>
              <th scope="col">Scramble</th>
              <th scope="col" class="sortable" data-log-sort="at" style="width: 56px; text-align: center;" title="Date &amp; time (YYYY-MM-DD HH:MM:SS)">Date<span class="sort-icon">${logSortArrow("at")}</span></th>
              <th scope="col" style="width: 84px;">Actions</th>
            </tr>
          </thead>
          <tbody>
    `;

    if (pageRows.length === 0) {
      html += `<tr><td colspan="8" class="empty-stats" style="text-align: center; padding: 20px;">No solves match filter "${escapeHtml(sessionLogFilter)}".</td></tr>`;
    } else {
      pageRows.forEach(({ s, num, origIdx }) => {
        const targetBadge = s.id
          ? `<span class="badge">${escapeHtml(s.id)}</span>`
          : `<span class="badge badge-subtle">${escapeHtml(s.target === 'layer' ? '1st Layer' : (s.target === 'face' ? '1st Face' : (s.target === 'parity' ? 'Parity Drill' : 'Full Solve')))}</span>`;
        const dateClockHtml = renderSolveDateClockHtml(s.at);
        const hasReplay = Array.isArray(s.moves) && s.moves.length > 0;

        html += `
          <tr class="layer-log-row" data-index="${origIdx}" data-num="${num}" title="Click to view solve details &amp; scramble">
            <td>${num}</td>
            <td class="layer-time-cell">
              <div class="cfop-cell-stack">
                <strong>${formatSolveDisplay(s)}</strong>
                ${s.tps ? `<small class="cfop-sub-meta">${s.tps} TPS</small>` : ''}
              </div>
            </td>
            <td>${formatCfopSplitMs(s.pickupMs)}</td>
            <td>${formatCfopSplitMs(s.putdownMs)}</td>
            <td>${targetBadge}</td>
            <td class="standard-log-scramble-cell"><code>${escapeHtml(s.scramble || "-")}</code></td>
            <td class="layer-date-cell">${dateClockHtml}</td>
            <td>
              <div class="layer-log-actions">
                ${hasReplay ? `<button type="button" class="btn-replay-solve" data-index="${origIdx}" data-num="${num}" title="Replay solve #${num} in 3D">&#x25B6;</button>` : ''}
                <button type="button" class="btn-reattempt-solve" data-index="${origIdx}" data-num="${num}" title="Reattempt solve #${num} scramble">&#x21bb;</button>
                <button type="button" class="btn-del-solve" data-index="${origIdx}" data-num="${num}" title="Delete solve #${num} (${formatSolveDisplay(s)})">&times;</button>
              </div>
            </td>
          </tr>
        `;
      });
    }

    html += `
          </tbody>
          <tfoot>
            <tr class="cfop-tfoot-page-avg">
              <th scope="row">Page</th>
              <td colspan="7">
                <strong>Median:</strong> ${pageAvg.median?.totalMs != null ? formatSolveTime(pageAvg.median.totalMs) : '-'} &bull;
                <strong>TrimMean (10%):</strong> ${pageAvg.trimMean?.totalMs != null ? formatSolveTime(pageAvg.trimMean.totalMs) : '-'} &bull;
                <strong>Mean:</strong> ${pageAvg.totalMs != null ? formatSolveTime(pageAvg.totalMs) : '-'}
                ${pageAvg.median?.pickupMs != null ? ` &bull; <strong>Pick-up (Med):</strong> ${formatCfopSplitMs(pageAvg.median.pickupMs)}` : ''}
                ${pageAvg.median?.putdownMs != null ? ` &bull; <strong>Put-down (Med):</strong> ${formatCfopSplitMs(pageAvg.median.putdownMs)}` : ''}
                <small class="cfop-sub-meta">(${pageSolves.length} solves on page)</small>
              </td>
            </tr>
            <tr class="cfop-tfoot-session-avg">
              <th scope="row">All</th>
              <td colspan="7">
                <strong>Median:</strong> ${sessionAvg.median?.totalMs != null ? formatSolveTime(sessionAvg.median.totalMs) : '-'} &bull;
                <strong>TrimMean (10%):</strong> ${sessionAvg.trimMean?.totalMs != null ? formatSolveTime(sessionAvg.trimMean.totalMs) : '-'} &bull;
                <strong>Mean:</strong> ${sessionAvg.totalMs != null ? formatSolveTime(sessionAvg.totalMs) : '-'}
                ${sessionAvg.median?.pickupMs != null ? ` &bull; <strong>Pick-up (Med):</strong> ${formatCfopSplitMs(sessionAvg.median.pickupMs)}` : ''}
                ${sessionAvg.median?.putdownMs != null ? ` &bull; <strong>Put-down (Med):</strong> ${formatCfopSplitMs(sessionAvg.median.putdownMs)}` : ''}
                <small class="cfop-sub-meta">(${count} solves in session)</small>
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      </div>
    </div>
    `;
  }

  container.innerHTML = html;

  // Attach collapsible sub-widget listeners (Solve Log, CFOP Summary, OLL Cases, PLL Cases)
  container.querySelectorAll("[data-stats-collapse]").forEach(btn => {
    btn.addEventListener("click", () => {
      const key = btn.dataset.statsCollapse;
      const card = btn.closest(".stats-subwidget");
      if (!key || !card) return;
      let nextOpen = true;
      if (key === "solveLog") {
        solveLogOpen = !solveLogOpen;
        nextOpen = solveLogOpen;
      } else if (key === "cfopSummary") {
        cfopSummaryOpen = !cfopSummaryOpen;
        nextOpen = cfopSummaryOpen;
      } else if (key === "ollCases") {
        ollCasesStatsOpen = !ollCasesStatsOpen;
        nextOpen = ollCasesStatsOpen;
      } else if (key === "pllCases") {
        pllCasesStatsOpen = !pllCasesStatsOpen;
        nextOpen = pllCasesStatsOpen;
      }
      card.classList.toggle("is-collapsed", !nextOpen);
      btn.setAttribute("aria-expanded", nextOpen ? "true" : "false");
      saveSettings();
    });
  });

  // Attach Solve Log column sorting listeners
  container.querySelectorAll("th[data-log-sort]").forEach(th => {
    th.addEventListener("click", () => {
      const col = th.dataset.logSort;
      if (!col) return;
      if (sessionLogSort.col === col) {
        sessionLogSort.dir = sessionLogSort.dir === "asc" ? "desc" : "asc";
      } else {
        sessionLogSort.col = col;
        sessionLogSort.dir = (col === "num" || col === "at") ? "desc" : "asc";
      }
      sessionLogPage = 1;
      renderSessionLogTable();
    });
  });

  // Attach OLL / PLL Case Breakdown column sorting listeners
  container.querySelectorAll("th[data-breakdown-sort]").forEach(th => {
    th.addEventListener("click", () => {
      const trackId = th.dataset.breakdownTrack || "oll";
      const col = th.dataset.breakdownSort;
      if (!col) return;
      const cur = ollPllBreakdownSort[trackId] || { col: "medianMs", dir: "desc" };
      if (cur.col === col) {
        cur.dir = cur.dir === "asc" ? "desc" : "asc";
      } else {
        cur.col = col;
        cur.dir = (col === "shortName" || col === "group" || col === "bestMs") ? "asc" : "desc";
      }
      ollPllBreakdownSort[trackId] = cur;
      renderSessionLogTable();
    });
  });

  // Attach subfilter button listeners
  container.querySelector("#sessionLogExportCsvBtn")?.addEventListener("click", handleExportCSV);
  container.querySelectorAll(".stats-subfilter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      sessionLogFilter = btn.dataset.logFilter || "all";
      sessionLogPage = 1;
      renderSessionLogTable();
    });
  });

  // Attach pagination size dropdown listener
  const pageSizeSelect = container.querySelector("#sessionLogPageSizeSelect");
  if (pageSizeSelect) {
    pageSizeSelect.addEventListener("change", () => {
      const sz = Number(pageSizeSelect.value);
      if (LOG_PAGE_SIZE_OPTIONS.includes(sz)) {
        sessionLogPageSize = sz;
        sessionLogPage = 1;
        saveSettings();
        renderSolvePanel();
        renderSessionLogTable();
      }
    });
  }

  // Attach pagination page navigation listeners
  container.querySelector("#logPageFirstBtn")?.addEventListener("click", () => {
    if (sessionLogPage > 1) {
      sessionLogPage = 1;
      renderSessionLogTable();
    }
  });
  container.querySelector("#logPagePrevBtn")?.addEventListener("click", () => {
    if (sessionLogPage > 1) {
      sessionLogPage--;
      renderSessionLogTable();
    }
  });
  container.querySelector("#logPageNextBtn")?.addEventListener("click", () => {
    if (sessionLogPage < totalPages) {
      sessionLogPage++;
      renderSessionLogTable();
    }
  });
  container.querySelector("#logPageLastBtn")?.addEventListener("click", () => {
    if (sessionLogPage < totalPages) {
      sessionLogPage = totalPages;
      renderSessionLogTable();
    }
  });

  // Attach row click listeners to show details popup
  container.querySelectorAll(".layer-log-row").forEach(row => {
    row.addEventListener("click", (e) => {
      if (
        e.target.closest(".btn-del-solve") ||
        e.target.closest(".btn-reattempt-solve") ||
        e.target.closest(".btn-replay-solve") ||
        e.target.closest(".solve-date-clock-wrap")
      ) {
        return;
      }
      const index = Number(row.dataset.index);
      const num = row.dataset.num;
      const solve = sessSolves[index];
      if (solve) {
        openSolveDetailModal(solve, num);
      }
    });
  });

  // Attach clock icon click & mouseleave listeners for date pop-up
  container.querySelectorAll(".solve-date-clock-wrap").forEach(wrap => {
    const btn = wrap.querySelector(".btn-solve-date-clock");
    if (btn) {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const wasOpen = wrap.classList.contains("is-open");
        container.querySelectorAll(".solve-date-clock-wrap.is-open").forEach(other => {
          if (other !== wrap) other.classList.remove("is-open");
        });
        wrap.classList.toggle("is-open", !wasOpen);
      });
    }
    wrap.addEventListener("mouseleave", () => {
      wrap.classList.remove("is-open");
      if (btn && document.activeElement === btn) {
        btn.blur();
      }
    });
  });

  // Attach replay button listeners
  container.querySelectorAll(".btn-replay-solve").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const index = Number(btn.dataset.index);
      const num = btn.dataset.num;
      const solve = sessSolves[index];
      if (solve) {
        solveReplayViewer.open(solve, `Solve #${num} (${sess.name})`);
      }
    });
  });

  // Attach reattempt button listeners
  container.querySelectorAll(".btn-reattempt-solve").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const index = Number(btn.dataset.index);
      const num = btn.dataset.num;
      const solve = sessSolves[index];
      if (solve && solve.scramble) {
        reattemptScramble(solve.scramble, `solve #${num}`);
      }
    });
  });

  // Attach delete button listeners
  container.querySelectorAll(".btn-del-solve").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const index = Number(btn.dataset.index);
      const num = btn.dataset.num;
      const solve = sessSolves[index];
      if (!solve) return;
      if (confirm(`Delete solve #${num} (${formatSolveDisplay(solve)})?`)) {
        sessSolves.splice(index, 1);
        if (lastSolve === solve || (lastSolve && lastSolve.at === solve.at)) {
          lastSolve = sessSolves.length ? sessSolves[sessSolves.length - 1] : null;
        }
        saveSolves();
        populateSessionSelect();
        renderSolvePanel();
        renderSessionLogTable();
      }
    });
  });
}

// ---------------------------------------------------------------------------
// Solve Details Modal (Popup for Scramble, CFOP Breakdown & Date)
// ---------------------------------------------------------------------------

let activeModalSolve = null;

function formatFullSolveDate(timestamp) {
  return formatSolveDate(timestamp);
}

function openSolveDetailModal(solve, solveNum) {
  if (!solve || !solveDetailModal) return;
  activeModalSolve = solve;
  const sess = getActiveSession();
  if (solveModalTitle) solveModalTitle.textContent = `Solve #${solveNum} (${sess.name})`;
  if (solveModalTime) solveModalTime.textContent = formatSolveDisplay(solve);
  if (solveModalScramble) solveModalScramble.textContent = solve.scramble || "(no scramble recorded)";
  if (solveModalDate) solveModalDate.textContent = formatFullSolveDate(solve.at);
  if (solveModalCopyScrambleBtn) solveModalCopyScrambleBtn.textContent = "Copy";

  if (solveModalPhasesField && solveModalPhasesContent) {
    if (solve.timer) {
      solveModalPhasesField.hidden = false;
      const cell = (label, ms, hint) => `
        <div class="solve-phase-cell" title="${escapeHtml(hint)}">
          <span class="solve-phase-label">${label}</span>
          <strong class="solve-phase-val">${formatCfopSplitMs(ms)}</strong>
        </div>`;
      solveModalPhasesContent.innerHTML = `
        ${cell("Timer", solve.rawMs, "Time recorded by the GAN Smart Timer")}
        ${cell("Pick-up", solve.pickupMs, "Timer start → first smart cube turn")}
        ${cell("Cube solve", solve.cubeMs, "First turn → smart cube solved")}
        ${cell("Put-down", solve.putdownMs, "Smart cube solved → timer stopped")}
      `;
    } else {
      solveModalPhasesField.hidden = true;
      solveModalPhasesContent.innerHTML = "";
    }
  }
  const cfop = ensureSolveCfop(solve);
  if (solveModalCfopField && solveModalCfopContent) {
    if (cfop && (cfop.steps?.length > 0 || cfop.ollCase || cfop.pllCase)) {
      solveModalCfopField.hidden = false;
      const totalPauses = cfop.pauses ? `${cfop.pauses.totalCount} pause(s) (${formatCfopSplitMs(cfop.pauses.totalMs)} total)` : "0";
      const stepTableHtml = renderCfopStepTable(solve, { detailed: true });
      solveModalCfopContent.innerHTML = `
        <div class="solve-modal-cfop-summary-bar">
          <span><strong>Cross Color:</strong> ${escapeHtml(cfop.crossColor || "White")}</span>
          ${cfop.splits?.f2lTotal != null ? `<span><strong>F2L &Sigma;:</strong> ${formatCfopSplitMs(cfop.splits.f2lTotal)}</span>` : ''}
          ${cfop.ollCase ? `<span><strong>OLL:</strong> ${escapeHtml(cfop.ollCase.name)} (${formatCfopSplitMs(cfop.ollCase.ms)})</span>` : ''}
          ${cfop.pllCase ? `<span><strong>PLL:</strong> ${escapeHtml(cfop.pllCase.name)} (${formatCfopSplitMs(cfop.pllCase.ms)})</span>` : ''}
          <span><strong>Total Pauses:</strong> ${totalPauses}</span>
        </div>
        ${stepTableHtml}
      `;
    } else {
      solveModalCfopField.hidden = true;
      solveModalCfopContent.innerHTML = "";
    }
  }

  if (solveModalMovesField) {
    if (solve.moves && solve.moves.length > 0) {
      solveModalMovesField.hidden = false;
      if (solveModalMovesCount) solveModalMovesCount.textContent = `${solve.moveCount || solve.moves.length} moves (ETM)`;
      if (solveModalTps) solveModalTps.textContent = `${solve.tps || 0} TPS`;
      if (solveModalDevice) solveModalDevice.textContent = solve.smartCube || "Smart Cube";
      if (solveModalMovesTape) {
        solveModalMovesTape.innerHTML = solve.moves.map((m, i) => `
          <span class="solve-tape-item" title="Move ${i + 1}: ${m.move} (+${(m.split / 1000).toFixed(2)}s, total ${(m.t / 1000).toFixed(2)}s)">
            ${i + 1}. ${m.move}
          </span>
        `).join("");
      }
    } else {
      solveModalMovesField.hidden = true;
    }
  }

  if (solveModalReplayBtn) {
    if (solve.moves && solve.moves.length > 0) {
      solveModalReplayBtn.hidden = false;
      solveModalReplayBtn.onclick = () => {
        closeSolveDetailModal();
        solveReplayViewer.open(solve, `Solve #${solveNum} (${sess.name})`);
      };
    } else {
      solveModalReplayBtn.hidden = true;
    }
  }

  solveDetailModal.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeSolveDetailModal() {
  if (!solveDetailModal) return;
  solveDetailModal.hidden = true;
  activeModalSolve = null;
  document.body.style.overflow = "";
}

if (solveModalCloseBtn) {
  solveModalCloseBtn.addEventListener("click", closeSolveDetailModal);
}
if (solveModalDismissBtn) {
  solveModalDismissBtn.addEventListener("click", closeSolveDetailModal);
}
if (solveDetailModal) {
  solveDetailModal.addEventListener("click", (e) => {
    if (e.target === solveDetailModal) closeSolveDetailModal();
  });
}
if (solveModalCopyScrambleBtn) {
  solveModalCopyScrambleBtn.addEventListener("click", async () => {
    if (!activeModalSolve || !activeModalSolve.scramble) return;
    try {
      await navigator.clipboard.writeText(activeModalSolve.scramble);
      solveModalCopyScrambleBtn.textContent = "✓ Copied";
      setTimeout(() => { if (solveModalCopyScrambleBtn) solveModalCopyScrambleBtn.textContent = "Copy"; }, 1500);
    } catch (err) {
      solveModalCopyScrambleBtn.textContent = "Copied";
      setTimeout(() => { if (solveModalCopyScrambleBtn) solveModalCopyScrambleBtn.textContent = "Copy"; }, 1500);
    }
  });
}
if (solveModalReattemptBtn) {
  solveModalReattemptBtn.addEventListener("click", () => {
    if (!activeModalSolve || !activeModalSolve.scramble) return;
    const scr = activeModalSolve.scramble;
    const title = solveModalTitle ? solveModalTitle.textContent : "solve";
    closeSolveDetailModal();
    reattemptScramble(scr, title);
  });
}
if (solveModalSimBtn) {
  solveModalSimBtn.addEventListener("click", () => {
    if (!activeModalSolve || !activeModalSolve.scramble) return;
    const scr = activeModalSolve.scramble;
    closeSolveDetailModal();
    setMode("simulate");
    simScrambleInput.value = scr;
    simLoadScramble(scr);
  });
}
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && solveDetailModal && !solveDetailModal.hidden) {
    closeSolveDetailModal();
  }
});

// ---------------------------------------------------------------------------
// Bluetooth Smart Cube & Solve Replay Integration
// ---------------------------------------------------------------------------

function openBluetoothModal() {
  if (!bluetoothModal) return;
  preloadSmartCube().catch(() => {});
  if (btErrorAlert) btErrorAlert.hidden = true;
  if (btCustomMacInput) {
    try {
      btCustomMacInput.value = smartCube.manualMac || localStorage.getItem("cll_smartcube_last_mac") || "";
    } catch {}
  }
  updateBluetoothUI();
  bluetoothModal.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeBluetoothModal() {
  if (!bluetoothModal) return;
  bluetoothModal.hidden = true;
  document.body.style.overflow = "";
}

function showBluetoothError(msg) {
  if (btErrorText) btErrorText.textContent = msg;
  if (btErrorAlert) btErrorAlert.hidden = false;
  if (btStatusDesc) btStatusDesc.textContent = msg;
}

function renderSavedCubesList() {
  if (!btSavedCubesList) return;
  const saved = smartCube.getSavedCubes();
  const st = smartCube.getStatus();

  if (!saved || saved.length === 0) {
    btSavedCubesList.innerHTML = `
      <p class="bt-saved-empty">No saved smart cubes yet. Connect a cube above and it will be saved here for 1-click reconnect.</p>
    `;
    return;
  }

  btSavedCubesList.innerHTML = saved.map(cube => {
    const isCurrent = st.connected && st.deviceName === cube.name;
    const protoBadge = cube.protocol ? `<span class="badge badge-subtle">${escapeHtml(cube.protocol)}</span>` : "";
    const macBadge = cube.mac ? `<code class="bt-saved-mac" title="Saved Bluetooth MAC Address">${escapeHtml(cube.mac)}</code>` : "";
    const statusLabel = isCurrent
      ? `<span class="bt-saved-status connected">● Connected</span>`
      : `<span class="bt-saved-status">Reconnect &rarr;</span>`;

    return `
      <div class="bt-saved-cube-item ${isCurrent ? 'is-connected' : ''}" data-cube-name="${escapeHtml(cube.name)}">
        <button type="button" class="bt-saved-cube-connect-btn" data-cube-name="${escapeHtml(cube.name)}" title="${isCurrent ? 'Currently connected' : `Click to reconnect to ${escapeHtml(cube.name)}`}">
          <span class="bt-saved-cube-icon" aria-hidden="true">ᛒ</span>
          <span class="bt-saved-cube-main">
            <strong class="bt-saved-cube-name">${escapeHtml(cube.name)}</strong>
            <span class="bt-saved-cube-meta">${protoBadge} ${macBadge}</span>
          </span>
          ${statusLabel}
        </button>
        <button type="button" class="bt-saved-cube-del-btn" data-cube-name="${escapeHtml(cube.name)}" title="Remove ${escapeHtml(cube.name)} from saved cubes" aria-label="Remove ${escapeHtml(cube.name)}">&times;</button>
      </div>
    `;
  }).join("");

  btSavedCubesList.querySelectorAll(".bt-saved-cube-connect-btn").forEach(btn => {
    btn.addEventListener("click", async () => {
      const name = btn.dataset.cubeName;
      if (!name) return;
      const entry = saved.find(c => c.name === name) || { name };
      if (btErrorAlert) btErrorAlert.hidden = true;
      if (entry.mac && btCustomMacInput) {
        btCustomMacInput.value = entry.mac;
      }
      if (btStatusDesc) {
        btStatusDesc.textContent = `Reconnecting to ${name}… Select "${name}" in the Bluetooth prompt.`;
      }
      try {
        const deviceSelection = (btUnfilteredCheckbox && btUnfilteredCheckbox.checked) ? "any" : "filtered";
        await smartCube.reconnectSavedCube(entry, { deviceSelection });
        if (btErrorAlert) btErrorAlert.hidden = true;
      } catch (err) {
        if (err && (err.name === "NotFoundError" || err.code === "NotFoundError")) {
          if (btStatusDesc) btStatusDesc.textContent = "Bluetooth device selection cancelled.";
          return;
        }
        console.warn("Saved cube reconnect error:", err);
        showBluetoothError(err?.message || `Failed to reconnect to ${name}.`);
      }
    });
  });

  btSavedCubesList.querySelectorAll(".bt-saved-cube-del-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const name = btn.dataset.cubeName;
      if (!name) return;
      smartCube.removeSavedCube(name);
      renderSavedCubesList();
    });
  });
}

smartCube.addEventListener("savedcubeschange", () => {
  renderSavedCubesList();
});

function updateBluetoothUI() {
  const st = smartCube.getStatus();
  const hasCubeAlert = Boolean(smartCubeDisconnectAlert && !st.connected);
  renderSavedCubesList();
  if (bluetoothHeaderDot) {
    bluetoothHeaderDot.className = `bt-dot ${st.status}`;
  }
  if (bluetoothBtn) {
    bluetoothBtn.classList.toggle("is-disconnected-alert", hasCubeAlert);
  }
  if (bluetoothModalStatusBadge) {
    const badgeClass = st.status === 'connected' ? 'badge-success' : (st.status === 'connecting' ? 'badge-warning' : 'badge-disconnected');
    bluetoothModalStatusBadge.className = `badge ${badgeClass}`;
    bluetoothModalStatusBadge.textContent = st.status === 'connected' ? 'Connected' : (st.status === 'connecting' ? 'Connecting...' : 'Disconnected');
  }
  if (btStatusCard) {
    btStatusCard.className = `bt-status-card ${st.status}`;
  }
  if (btDeviceName) {
    btDeviceName.textContent = st.connected ? (st.deviceName || "Smart Cube") : "No Cube Connected";
  }
  if (btStatusDesc) {
    btStatusDesc.textContent = st.connected
      ? (st.isVirtual ? "Virtual keyboard cube active. You can press move keys (I, K, J, F, etc.) or click virtual buttons below." : "Smart cube connected via Web Bluetooth. Ready to track turns in real time!")
      : "Connect a Bluetooth smart cube to track every turn with millisecond timestamps and replay your solves in 3D.";
  }
  if (btBatteryWrap) {
    btBatteryWrap.hidden = !st.connected || st.battery == null;
    if (btBatteryLevel && st.battery != null) {
      btBatteryLevel.textContent = `${st.battery}%`;
    }
  }
  if (btConnectBtn) btConnectBtn.hidden = st.connected;
  if (btDisconnectBtn) btDisconnectBtn.hidden = !st.connected;
  if (btLiveStreamWrap) btLiveStreamWrap.hidden = !st.connected;
  if (btVirtualKeypad) btVirtualKeypad.hidden = !st.connected || !st.isVirtual;

  // Solve mode indicator & scramble assistant
  if (smartCubeSolveIndicator) {
    smartCubeSolveIndicator.hidden = !st.connected || mode !== "solve";
  }
  updateSmartCubeIndicator();
  if (st.connected && mode === "solve") {
    if (smartCubeStage === "scrambling" && !scrambleTracker.isComplete()) {
      if (!scrambleTracker.rawScramble || scrambleTracker.rawScramble !== currentSolveScramble) {
        scrambleTracker.reset(currentSolveScramble);
        smartCube.logDiag("SCRAMBLE_SYNC_RESET", { scramble: currentSolveScramble });
      }
      renderSmartScrambleAssistant();
    }
  }
}

// Sample demonstration CFOP solve with realistic turns, splits, OLL 27 (Sune), PLL (T-Perm), and pauses
const DEMO_SOLVE = {
  puzzle: "333",
  target: "full",
  ms: 9960,
  rawMs: 9960,
  penalty: null,
  at: Date.now() - 3600000,
  scramble: "U F R U' R' U R U R2' F' R U R U' R' U' R U2' R' U' R U' R' U' R U' R' U L' U L U2' R' U' R U' L U L' U' D F R' D'",
  moves: [
    // Cross (4 moves)
    { move: "D",  t: 180,  split: 180 },
    { move: "R",  t: 360,  split: 180 },
    { move: "F'", t: 540,  split: 180 },
    { move: "D'", t: 720,  split: 180 },
    // F2L 1 (4 moves, starts with 520ms pause)
    { move: "U",  t: 1240, split: 520 },
    { move: "L",  t: 1420, split: 180 },
    { move: "U'", t: 1600, split: 180 },
    { move: "L'", t: 1780, split: 180 },
    // F2L 2 (4 moves, starts with 460ms pause)
    { move: "U",  t: 2240, split: 460 },
    { move: "R'", t: 2420, split: 180 },
    { move: "U",  t: 2600, split: 180 },
    { move: "R",  t: 2780, split: 180 },
    // F2L 3 (4 moves)
    { move: "U2", t: 3100, split: 320 },
    { move: "L'", t: 3280, split: 180 },
    { move: "U'", t: 3460, split: 180 },
    { move: "L",  t: 3640, split: 180 },
    // F2L 4 (4 moves)
    { move: "U'", t: 3920, split: 280 },
    { move: "R",  t: 4100, split: 180 },
    { move: "U",  t: 4280, split: 180 },
    { move: "R'", t: 4460, split: 180 },
    // OLL 27 Sune (8 moves, starts with 550ms recognition pause)
    { move: "U",  t: 5010, split: 550 },
    { move: "R",  t: 5210, split: 200 },
    { move: "U",  t: 5390, split: 180 },
    { move: "R'", t: 5570, split: 180 },
    { move: "U",  t: 5750, split: 180 },
    { move: "R",  t: 5930, split: 180 },
    { move: "U2", t: 6150, split: 220 },
    { move: "R'", t: 6330, split: 180 },
    // PLL T-Perm (16 moves, starts with 630ms recognition pause)
    { move: "U",  t: 6960, split: 630 },
    { move: "R",  t: 7160, split: 200 },
    { move: "U",  t: 7360, split: 200 },
    { move: "R'", t: 7560, split: 200 },
    { move: "U'", t: 7760, split: 200 },
    { move: "R'", t: 7960, split: 200 },
    { move: "F",  t: 8160, split: 200 },
    { move: "R2", t: 8360, split: 200 },
    { move: "U'", t: 8560, split: 200 },
    { move: "R'", t: 8760, split: 200 },
    { move: "U'", t: 8960, split: 200 },
    { move: "R",  t: 9160, split: 200 },
    { move: "U",  t: 9360, split: 200 },
    { move: "R'", t: 9560, split: 200 },
    { move: "F'", t: 9760, split: 200 },
    { move: "U'", t: 9960, split: 200 }
  ],
  moveCount: 44,
  tps: 4.42,
  smartCube: "Smart Cube (Demo)"
};

// Wire Bluetooth Header Button & Modal
if (bluetoothBtn) {
  bluetoothBtn.addEventListener("click", openBluetoothModal);
}
if (bluetoothModalCloseBtn) {
  bluetoothModalCloseBtn.addEventListener("click", closeBluetoothModal);
}
if (btModalDismissBtn) {
  btModalDismissBtn.addEventListener("click", closeBluetoothModal);
}
if (bluetoothModal) {
  bluetoothModal.addEventListener("click", (e) => {
    if (e.target === bluetoothModal) closeBluetoothModal();
  });
}

// Connect Physical Smart Cube via Web Bluetooth
if (btConnectBtn) {
  btConnectBtn.addEventListener("click", async () => {
    if (btErrorAlert) btErrorAlert.hidden = true;
    if (btStatusDesc) btStatusDesc.textContent = "Opening Bluetooth device picker…";
    try {
      const deviceSelection = (btUnfilteredCheckbox && btUnfilteredCheckbox.checked) ? "any" : "filtered";
      const manualMac = btCustomMacInput?.value?.trim() || "";
      await smartCube.connect({ deviceSelection, manualMac });
      if (btErrorAlert) btErrorAlert.hidden = true;
    } catch (err) {
      if (err && (err.name === "NotFoundError" || err.code === "NotFoundError")) {
        if (btStatusDesc) btStatusDesc.textContent = "Bluetooth device selection cancelled.";
        return;
      }
      console.warn("Bluetooth connection error:", err);
      const userMsg = err?.message || "Failed to connect to smart cube.";
      showBluetoothError(userMsg);
    }
  });
}

// Hard Reset Bluetooth & Clear Cache Handlers
function handleBluetoothReset() {
  smartCube.hardReset();
  ganTimer.disconnect();
  if (btCustomMacInput) btCustomMacInput.value = "";
  try { localStorage.removeItem("cll_smartcube_last_mac"); } catch {}
  if (btErrorAlert) btErrorAlert.hidden = true;
  if (btStatusDesc) {
    btStatusDesc.textContent = "Bluetooth state, saved cubes, and MAC cache cleared. Ready to connect fresh.";
  }
  renderSavedCubesList();
  updateBluetoothUI();
  updateGanTimerUI();
}

if (btResetBtn) {
  btResetBtn.addEventListener("click", handleBluetoothReset);
}
if (settingsResetBtBtn) {
  settingsResetBtBtn.addEventListener("click", () => {
    handleBluetoothReset();
    if (btStatusDesc) {
      btStatusDesc.textContent = "Bluetooth state and saved MAC cache cleared.";
    }
  });
}

// Save Custom MAC Button
if (btSaveMacBtn && btCustomMacInput) {
  btSaveMacBtn.addEventListener("click", () => {
    const raw = btCustomMacInput.value.trim();
    if (!raw) {
      smartCube.setManualMac("");
      try { localStorage.removeItem("cll_smartcube_last_mac"); } catch {}
      if (btStatusDesc) btStatusDesc.textContent = "MAC address cleared.";
      return;
    }
    const formatted = formatMacAddress(raw);
    if (!formatted) {
      showBluetoothError("Invalid MAC format. Please enter 12 hex digits (e.g. AA:BB:CC:DD:EE:FF or AABBCCDDEEFF).");
      return;
    }
    btCustomMacInput.value = formatted;
    smartCube.setManualMac(formatted);
    try { localStorage.setItem("cll_smartcube_last_mac", formatted); } catch {}
    if (btErrorAlert) btErrorAlert.hidden = true;
    if (btStatusDesc) btStatusDesc.textContent = `MAC ${formatted} saved for cube connection.`;
  });
}

// Error Banner Dismiss Button
if (btErrorDismissBtn) {
  btErrorDismissBtn.addEventListener("click", () => {
    if (btErrorAlert) btErrorAlert.hidden = true;
  });
}

// Listen for progress messages during connection setup
smartCube.addEventListener("progress", (e) => {
  if (btStatusDesc && e.detail?.message) {
    btStatusDesc.textContent = e.detail.message;
  }
});

// Connect Virtual / Keyboard Cube
if (btVirtualBtn) {
  btVirtualBtn.addEventListener("click", async () => {
    if (btErrorAlert) btErrorAlert.hidden = true;
    try {
      await smartCube.connectVirtual(document.body, currentPuzzle);
    } catch (err) {
      showBluetoothError("Failed to activate virtual smart cube: " + err.message);
    }
  });
}

// Disconnect Cube
if (btDisconnectBtn) {
  btDisconnectBtn.addEventListener("click", () => {
    smartCube.disconnect();
  });
}

// Demo Solve Replay Button
if (btDemoSolveBtn) {
  btDemoSolveBtn.addEventListener("click", () => {
    closeBluetoothModal();
    solveReplayViewer.open(DEMO_SOLVE, "Demo Solve Replay");
  });
}

// Virtual Keypad Turn Buttons
if (btVirtualKeypad) {
  btVirtualKeypad.querySelectorAll(".bt-virtual-turn").forEach(btn => {
    btn.addEventListener("click", () => {
      const move = btn.dataset.move;
      if (move) {
        smartCube.handleMove(move, performance.now());
      }
    });
  });
}

// Listen for Smart Cube Status Changes
smartCube.addEventListener("statuschange", () => {
  updateBluetoothUI();
});

// Batch 3D cube updates during live solve to prevent WebGL blocking on rapid double-flicks
let pendingSolveCubeUpdateRaf = null;
function request3DCubeUpdate() {
  if (!solveShowCube || !el) return;
  if (pendingSolveCubeUpdateRaf) return;
  pendingSolveCubeUpdateRaf = requestAnimationFrame(() => {
    pendingSolveCubeUpdateRaf = null;
    try {
      const moveTokens = trackedSolveMoves.map(m => m.move);
      const fullSeq = [currentBaseDisplayScramble, ...moveTokens].filter(Boolean).join(" ");
      el.scramble = fullSeq;
      el.player?.controller?.jumpToEnd?.({ flash: false }) || el.player?.jumpToEnd?.();
    } catch {}
  });
}

// Listen for Solved State from Smart Cube Hardware / Facelets
smartCube.addEventListener("solved", () => {
  handleSmartCubeSolved();
});

// Listen for Live Turns from Smart Cube
smartCube.addEventListener("move", (e) => {
  const { move, isSolved } = e.detail;
  if (!move) {
    if (isSolved) handleSmartCubeSolved();
    return;
  }

  // Append chip to BT modal live stream
  if (btMoveChipsList) {
    const hint = btMoveChipsList.querySelector(".bt-empty-hint");
    if (hint) hint.remove();
    const chip = document.createElement("span");
    chip.className = "bt-stream-chip";
    chip.textContent = move;
    btMoveChipsList.appendChild(chip);
    if (btMoveChipsList.children.length > 25) {
      btMoveChipsList.removeChild(btMoveChipsList.firstChild);
    }
    chip.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "end" });
  }
  if (btTurnCounter) {
    const total = smartCube.recentMoves.length;
    btTurnCounter.textContent = `${total} turn${total === 1 ? '' : 's'}`;
  }

  // Handle Solve Mode Integration
  if (mode === "solve") {
    const isRotation = /^[xyz]/i.test(move);

    // 1. Scrambling Stage: Verify the scramble before allowing timer to start
    if (smartCubeStage === "scrambling") {
      if (!scrambleTracker.isComplete()) {
        if (!isRotation) {
          scrambleTracker.applyMove(move);
          const trackerStatus = scrambleTracker.getStatus();
          smartCube.logDiag("SCRAMBLE_MOVE", {
            move,
            currentIndex: trackerStatus.currentIndex,
            currentSubAmount: trackerStatus.currentSubAmount,
            hasError: trackerStatus.hasError,
            corrections: trackerStatus.corrections,
            nextRequired: trackerStatus.nextRequired
          });
          if (scrambleTracker.isComplete()) {
            clearScrambleCorrectionDelay();
            onSmartScrambleCompleted();
          } else if (isSolved && (trackerStatus.hasError || trackerStatus.currentIndex > 0 || trackerStatus.currentSubAmount > 0)) {
            handleSmartCubeSolved();
          } else if (trackerStatus.hasError || trackerStatus.currentSubAmount > 0) {
            if (scrambleErrorVisible && trackerStatus.hasError) {
              // Correction box is already visible and user is actively performing correction moves:
              // update the correction sequence immediately so they see each correction move take effect!
              renderSmartScrambleAssistant();
            } else {
              // Delay showing any off-track or incomplete-double-turn warning for SCRAMBLE_CORRECTION_DELAY_MS
              // so proficient double-flicks never flash an error before the 2nd flick lands!
              scrambleSuppressTransient = true;
              renderSmartScrambleAssistant();
              if (scrambleCorrectionDelayTimer) {
                clearTimeout(scrambleCorrectionDelayTimer);
              }
              scrambleCorrectionDelayTimer = setTimeout(() => {
                scrambleCorrectionDelayTimer = null;
                scrambleSuppressTransient = false;
                const stNow = scrambleTracker.getStatus();
                scrambleErrorVisible = Boolean(stNow.hasError || stNow.currentSubAmount > 0);
                renderSmartScrambleAssistant();
              }, SCRAMBLE_CORRECTION_DELAY_MS);
            }
          } else {
            clearScrambleCorrectionDelay();
            renderSmartScrambleAssistant();
          }
        }
        // Under no circumstances do we start the timer while in scrambling stage!
        return;
      } else {
        // Scramble was marked complete or is already complete, transition
        clearScrambleCorrectionDelay();
        if (solveInspection) {
          smartCubeStage = "inspecting";
        } else {
          smartCubeStage = "ready";
        }
      }
    }

    // 1b. GAN Smart Timer connected: the timer (not the first turn) starts the solve.
    if (ganTimer.isConnected() && solveState !== "running" &&
        (solveState === "inspecting" || smartCubeStage === "inspecting" || smartCubeStage === "ready")) {
      if (isRotation) return;
      // Pre-turn before the timer started: keep it so replay/analysis stay consistent.
      const now = performance.now();
      if (!solveFirstMoveTs) {
        solveFirstMoveTs = now;
        solveMoveOrigin = now;
        trackedSolveMoves = [];
      }
      const t = Math.round(now - solveMoveOrigin);
      const prevT = trackedSolveMoves.length > 0 ? trackedSolveMoves[trackedSolveMoves.length - 1].t : 0;
      trackedSolveMoves.push({ move, t, split: trackedSolveMoves.length ? Math.max(10, t - prevT) : 0 });
      smartCube.logDiag("TIMER_PRE_TURN", { move, count: trackedSolveMoves.length });
      request3DCubeUpdate();
      return;
    }

    // 2. Inspection Stage
    if (solveState === "inspecting" || smartCubeStage === "inspecting") {
      // Whole cube rotations (x, y, z) during inspection do NOT start the timer!
      // This complies with WCA regulations and lets the cuber inspect the puzzle.
      if (isRotation) {
        return;
      }
      // First physical face turn ends inspection and starts the solve timer!
      smartCubeStage = "solving";
      startSolve(true);
      solveFirstMoveTs = solveStart;
      trackedSolveMoves = [{ move, t: 0, split: 0 }];
      request3DCubeUpdate();
      if (solveLiveMovesCount) solveLiveMovesCount.textContent = "1 move";
      if (solveLiveTps) solveLiveTps.textContent = "0.00 TPS";
      updateSmartCubeIndicator();
      return;
    }

    // 3. Ready Stage (Inspection is off, scramble is complete)
    if (smartCubeStage === "ready" && solveState === "idle") {
      // Whole cube rotations (x, y, z) do NOT start the timer
      if (isRotation) {
        return;
      }
      // First physical face turn starts the solve timer!
      smartCubeStage = "solving";
      startSolve(true);
      solveFirstMoveTs = solveStart;
      trackedSolveMoves = [{ move, t: 0, split: 0 }];
      request3DCubeUpdate();
      if (solveLiveMovesCount) solveLiveMovesCount.textContent = "1 move";
      if (solveLiveTps) solveLiveTps.textContent = "0.00 TPS";
      updateSmartCubeIndicator();
      return;
    }

    // 4. Solving Stage (Timer is running)
    if (solveState === "running") {
      // Timer-driven solve with a non-verified scramble: don't track turns (timer-only solve).
      if (solveTimerDriven && smartCubeStage !== "solving") return;
      const now = performance.now();
      if (solveTimerDriven || solveTimerStartTs > 0) {
        if (isRotation && !solveFirstMoveTs) return; // rotations don't end pick-up
        if (!solveFirstMoveTs) {
          // First turn after the GAN timer started: pick-up phase ends here.
          solveFirstMoveTs = now;
          solveMoveOrigin = now;
          smartCube.logDiag("TIMER_FIRST_TURN", { pickupMs: Math.round(now - solveTimerStartTs) });
          updateSmartCubeIndicator();
        }
        if (solveCubeSolvedTs) {
          // Cube turned again after being solved: it's no longer solved.
          solveCubeSolvedTs = 0;
          solveOverlay.classList.remove("cube-solved");
          solveOverlayHint.textContent = getRunningOverlayHint();
          updateSmartCubeIndicator();
        }
      }
      const elapsed = Math.round(now - solveMoveOrigin);
      const prevT = trackedSolveMoves.length > 0 ? trackedSolveMoves[trackedSolveMoves.length - 1].t : 0;
      const split = trackedSolveMoves.length > 0 ? Math.max(10, elapsed - prevT) : 0;
      trackedSolveMoves.push({ move, t: elapsed, split });

      request3DCubeUpdate();

      if (solveLiveMovesCount) {
        solveLiveMovesCount.textContent = `${trackedSolveMoves.length} moves`;
      }
      if (solveLiveTps) {
        const liveTpsVal = elapsed > 0 ? (trackedSolveMoves.length / (elapsed / 1000)).toFixed(2) : "0.00";
        solveLiveTps.textContent = `${liveTpsVal} TPS`;
      }

      // Check if cube reached solved state!
      if (isSolved) {
        handleSmartCubeSolved();
      }
      return;
    }
  }

  // Other modes: Free Face Turns / Study / Simulate / Practice
  if (!cubeCard.hidden) {
    applyFreeMove(move);
  }
});

// Initialize Solve Replay Viewer
solveReplayViewer.init({}, reattemptScramble);

// ---------------------------------------------------------------------------
// High-Visibility Bluetooth Disconnect Alert (Smart Cube & GAN Timer)
// ---------------------------------------------------------------------------

const btDisconnectBanner = document.getElementById("btDisconnectBanner");
const btDisconnectBannerTitle = document.getElementById("btDisconnectBannerTitle");
const btDisconnectBannerDesc = document.getElementById("btDisconnectBannerDesc");
const btDisconnectReconnectBtn = document.getElementById("btDisconnectReconnectBtn");
const btDisconnectDismissBtn = document.getElementById("btDisconnectDismissBtn");

const btDisconnectFloatingAlert = document.getElementById("btDisconnectFloatingAlert");
const btDisconnectFloatingTitle = document.getElementById("btDisconnectFloatingTitle");
const btDisconnectFloatingDesc = document.getElementById("btDisconnectFloatingDesc");
const btDisconnectFloatingReconnectBtn = document.getElementById("btDisconnectFloatingReconnectBtn");
const btDisconnectFloatingDismissBtn = document.getElementById("btDisconnectFloatingDismissBtn");

let ganTimerDisconnectAlert = false;
let smartCubeDisconnectAlert = null; // null or { deviceName: string }

function playDisconnectAlertSound() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    // Two descending warning tones (880Hz -> 440Hz)
    [
      { freq: 880, start: 0, dur: 0.14 },
      { freq: 440, start: 0.17, dur: 0.24 }
    ].forEach(({ freq, start, dur }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(freq, now + start);
      gain.gain.setValueAtTime(0.22, now + start);
      gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + start);
      osc.stop(now + start + dur);
    });
    setTimeout(() => { try { ctx.close(); } catch {} }, 600);
  } catch {}
}

function renderBtDisconnectAlerts() {
  const hasTimerAlert = Boolean(ganTimerDisconnectAlert && !ganTimer.isConnected());
  const hasCubeAlert = Boolean(smartCubeDisconnectAlert && !smartCube.getStatus().connected);
  const anyAlert = hasTimerAlert || hasCubeAlert;

  if (ganTimerBtn) {
    ganTimerBtn.classList.toggle("is-disconnected-alert", hasTimerAlert);
  }
  if (bluetoothBtn) {
    bluetoothBtn.classList.toggle("is-disconnected-alert", hasCubeAlert);
  }
  if (solveSurface) {
    solveSurface.classList.toggle("has-bt-disconnect-alert", anyAlert);
  }

  if (!anyAlert) {
    if (btDisconnectBanner) btDisconnectBanner.hidden = true;
    if (btDisconnectFloatingAlert) btDisconnectFloatingAlert.hidden = true;
    return;
  }

  let title = "";
  let desc = "";
  let btnLabel = "🔌 Reconnect Now";

  if (hasTimerAlert && hasCubeAlert) {
    const cName = smartCubeDisconnectAlert?.deviceName || "Smart Cube";
    title = `⚠️ GAN TIMER & SMART CUBE (${cName}) DISCONNECTED!`;
    desc = "Both Bluetooth devices lost connection! Solves on your physical timer and cube turns are NOT being recorded.";
    btnLabel = "🔌 Reconnect Timer & Cube";
  } else if (hasTimerAlert) {
    title = "⚠️ GAN BLUETOOTH TIMER DISCONNECTED!";
    desc = "Your Bluetooth timer lost connection (it may have powered off or gone to sleep). Solves on the physical timer are NOT being recorded!";
    btnLabel = "🔌 Reconnect GAN Timer";
  } else if (hasCubeAlert) {
    const cName = smartCubeDisconnectAlert?.deviceName || "Smart Cube";
    title = `⚠️ SMART CUBE DISCONNECTED (${cName})!`;
    desc = "Your Bluetooth smart cube lost connection. Cube turns and auto-stop are NO LONGER being tracked!";
    btnLabel = `🔌 Reconnect ${cName}`;
  }

  if (btDisconnectBannerTitle) btDisconnectBannerTitle.textContent = title;
  if (btDisconnectBannerDesc) btDisconnectBannerDesc.textContent = desc;
  if (btDisconnectReconnectBtn) btDisconnectReconnectBtn.textContent = btnLabel;
  if (btDisconnectBanner) btDisconnectBanner.hidden = false;

  if (btDisconnectFloatingTitle) btDisconnectFloatingTitle.textContent = title;
  if (btDisconnectFloatingDesc) btDisconnectFloatingDesc.textContent = desc;
  if (btDisconnectFloatingReconnectBtn) btDisconnectFloatingReconnectBtn.textContent = btnLabel;
  // Show floating top-center alert whenever solveOverlay is open or user is not in solve mode
  if (btDisconnectFloatingAlert) {
    const isSolveSurfaceVisible = mode === "solve" && (!solveOverlay || solveOverlay.hidden);
    btDisconnectFloatingAlert.hidden = isSolveSurfaceVisible;
  }
}

async function handleDisconnectAlertReconnect() {
  const hasTimerAlert = Boolean(ganTimerDisconnectAlert && !ganTimer.isConnected());
  const hasCubeAlert = Boolean(smartCubeDisconnectAlert && !smartCube.getStatus().connected);

  if (hasTimerAlert) {
    try {
      await ganTimer.connect();
      ganTimerDisconnectAlert = false;
      renderBtDisconnectAlerts();
    } catch (err) {
      if (err && (err.name === "NotFoundError" || err.code === "NotFoundError")) return;
      alert(`Could not reconnect GAN Smart Timer: ${err?.message || err}`);
    }
    return;
  }

  if (hasCubeAlert) {
    const devName = smartCubeDisconnectAlert?.deviceName || "";
    try {
      if (devName) {
        await smartCube.reconnectSavedCube(devName);
      } else {
        await smartCube.connect();
      }
      smartCubeDisconnectAlert = null;
      renderBtDisconnectAlerts();
    } catch (err) {
      if (err && (err.name === "NotFoundError" || err.code === "NotFoundError")) return;
      openBluetoothModal();
      showBluetoothError(err?.message || `Could not reconnect to ${devName || "Smart Cube"}.`);
    }
  }
}

function dismissBtDisconnectAlerts() {
  ganTimerDisconnectAlert = false;
  smartCubeDisconnectAlert = null;
  renderBtDisconnectAlerts();
  updateGanTimerUI();
  updateBluetoothUI();
}

if (btDisconnectReconnectBtn) {
  btDisconnectReconnectBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    handleDisconnectAlertReconnect();
  });
}
if (btDisconnectFloatingReconnectBtn) {
  btDisconnectFloatingReconnectBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    handleDisconnectAlertReconnect();
  });
}
if (btDisconnectDismissBtn) {
  btDisconnectDismissBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    dismissBtDisconnectAlerts();
  });
}
if (btDisconnectFloatingDismissBtn) {
  btDisconnectFloatingDismissBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    dismissBtDisconnectAlerts();
  });
}

smartCube.addEventListener("connected", () => {
  smartCubeDisconnectAlert = null;
  renderBtDisconnectAlerts();
});

smartCube.addEventListener("disconnected", (e) => {
  const { reason, deviceName, isVirtual } = e.detail || {};
  if (isVirtual) return;
  if (reason !== "manual" || mode === "solve") {
    smartCubeDisconnectAlert = { deviceName: deviceName || "Smart Cube" };
    playDisconnectAlertSound();
    renderBtDisconnectAlerts();
    updateBluetoothUI();
  }
});

// ---------------------------------------------------------------------------
// GAN Smart Timer (Bluetooth)
// ---------------------------------------------------------------------------

function updateGanTimerUI() {
  const st = ganTimer.getStatus();
  const hasTimerAlert = Boolean(ganTimerDisconnectAlert && !st.connected);
  if (ganTimerHeaderDot) ganTimerHeaderDot.className = `bt-dot ${st.status}`;
  if (ganTimerLabel) {
    ganTimerLabel.textContent = st.status === "connected"
      ? "GAN Timer ✓"
      : (st.status === "connecting"
        ? "Connecting…"
        : (hasTimerAlert ? "⚠️ Timer Lost!" : "GAN Timer"));
  }
  if (ganTimerBtn) {
    ganTimerBtn.title = st.status === "connected"
      ? "GAN Smart Timer connected · Click to disconnect"
      : (hasTimerAlert
        ? "GAN Smart Timer disconnected! Click to reconnect"
        : "Connect GAN Smart Timer (Bluetooth)");
    ganTimerBtn.classList.toggle("is-connected", st.connected);
    ganTimerBtn.classList.toggle("is-disconnected-alert", hasTimerAlert);
  }
}

// Visual feedback while hands are on the timer (does not change solveState, so
// keyboard/pointer handlers never start a solve on their own while a timer is used).
function showGanTimerHandsOverlay(state) {
  if (mode !== "solve" || (solveState !== "idle" && solveState !== "inspecting")) return;
  if (solveTarget === "cll" && !currentCaseId) return;
  solveOverlay.hidden = false;
  solveOverlay.classList.remove("gan-hands-on", "armed");
  solveOverlay.classList.add(state === "GET_SET" ? "armed" : "gan-hands-on");
  if (solveState === "idle") {
    solveOverlayTime.textContent = "0.00";
    if (solveOverlayCancelBtn) solveOverlayCancelBtn.hidden = true;
  }
  solveOverlayHint.textContent = state === "GET_SET"
    ? "Ready · Release the timer to start"
    : "Hands on timer · Hold until green…";
}

function clearGanTimerHandsOverlay() {
  solveOverlay.classList.remove("gan-hands-on", "armed");
  if (mode !== "solve") return;
  if (solveState === "idle") {
    hideSolveOverlay();
  } else if (solveState === "inspecting") {
    solveOverlayHint.textContent = "Start the GAN timer when ready · Esc to cancel";
  }
}

function startTimerDrivenSolve(ts) {
  if (mode !== "solve") return;
  if (solveState === "running") return;
  if (solveTarget === "cll" && !currentCaseId) return;
  const cubeTracking = smartCube.getStatus().connected &&
    (smartCubeStage === "inspecting" || smartCubeStage === "ready");
  if (cubeTracking) {
    smartCubeStage = "solving";
  } else {
    // Normal cube (or unverified scramble): timer-only solve, discard any stale pre-turns.
    trackedSolveMoves = [];
    solveFirstMoveTs = 0;
  }
  startSolve(false, { timerDriven: true, startTs: ts });
  if (!cubeTracking && solveLiveStats) solveLiveStats.hidden = true;
  smartCube.logDiag("TIMER_RUNNING", { cubeTracking, preTurns: trackedSolveMoves.length });
  updateSmartCubeIndicator();
}

ganTimer.addEventListener("connected", () => {
  ganTimerDisconnectAlert = false;
  renderBtDisconnectAlerts();
  updateGanTimerUI();
});

ganTimer.addEventListener("statuschange", () => {
  updateGanTimerUI();
  renderBtDisconnectAlerts();
  if (mode === "solve") {
    renderSolvePanel();
    updateSmartCubeIndicator();
  }
});

ganTimer.addEventListener("disconnected", (e) => {
  const reason = e.detail?.reason || "unexpected";
  // Fall back to manual stopping if the timer drops mid-solve.
  if (solveState === "running" && solveTimerDriven) {
    solveTimerDriven = false;
    solveOverlay.classList.remove("cube-solved");
    solveOverlayHint.textContent = "⚠️ GAN TIMER DISCONNECTED! Press any key or tap to stop";
  } else {
    clearGanTimerHandsOverlay();
  }
  if (reason !== "manual" || mode === "solve") {
    ganTimerDisconnectAlert = true;
    playDisconnectAlertSound();
    renderBtDisconnectAlerts();
    updateGanTimerUI();
  }
});

ganTimer.addEventListener("timerstate", (e) => {
  const { state, recordedMs, ts } = e.detail || {};
  smartCube.logDiag("GAN_TIMER_STATE", { state, recordedMs });
  if (mode !== "solve") return;
  switch (state) {
    case "HANDS_ON":
    case "GET_SET":
      showGanTimerHandsOverlay(state);
      break;
    case "HANDS_OFF":
    case "IDLE":
      if (solveState !== "running") clearGanTimerHandsOverlay();
      break;
    case "RUNNING":
      startTimerDrivenSolve(ts);
      break;
    case "STOPPED":
      if (solveState === "running" && solveTimerDriven) {
        const elapsedMs = Number.isFinite(recordedMs) && recordedMs > 0
          ? recordedMs
          : ((ts != null ? ts : performance.now()) - solveStart);
        if (shouldIgnorePrematureTimerStop({
          smartCubeConnected: smartCube.getStatus().connected,
          smartCubeStage,
          cubeSolved: Boolean(solveCubeSolvedTs) || smartCube.isCubeSolved(),
          moveCount: trackedSolveMoves.length,
          firstMoveTs: solveFirstMoveTs,
          elapsedMs
        })) {
          smartCube.logDiag("GAN_TIMER_FALSE_STOP_IGNORED", {
            recordedMs,
            elapsedMs: Math.round(elapsedMs),
            moves: trackedSolveMoves.length
          });
          // Switch to smart-cube auto-stop while keeping solveTimerStartTs intact so pick-up time
          // (solveFirstMoveTs - solveTimerStartTs) and cube solve time are still recorded!
          solveTimerDriven = false;
          if (solveOverlayHint) {
            solveOverlayHint.textContent = "GAN timer stopped early — keep solving! Auto-stops when cube is solved";
          }
          updateSmartCubeIndicator();
          break;
        }
        stopSolve(false, { hardwareMs: recordedMs, stopTs: ts });
        updateSmartCubeIndicator();
      }
      break;
    default:
      break;
  }
});

if (ganTimerBtn) {
  ganTimerBtn.addEventListener("click", async () => {
    if (ganTimer.isConnected()) {
      if (confirm("Disconnect the GAN Smart Timer?")) ganTimer.disconnect();
      return;
    }
    if (ganTimer.status === "connecting") return;
    try {
      await ganTimer.connect();
    } catch (err) {
      if (err && (err.name === "NotFoundError" || err.code === "NotFoundError")) return; // picker cancelled
      console.warn("GAN timer connection error:", err);
      alert(`Could not connect to GAN Smart Timer: ${err?.message || err}`);
    }
  });
}
updateGanTimerUI();

// Wire Escape key for Bluetooth Modal
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && bluetoothModal && !bluetoothModal.hidden) {
    closeBluetoothModal();
  }
});

function updateStatsTable() {
  renderStatsToggle();
  if (statsType === "solve" || statsType === "log") {
    renderSessionLogTable();
  } else if (statsType === "cll") {
    renderSolveStatsTable();
  } else {
    renderRecogStatsTable();
  }
}

// Collapsible stats (hide the table while just practicing)
function syncStatsPanel() {
  statsPanel.classList.toggle("collapsed", statsCollapsed);
  statsToggle.setAttribute("aria-expanded", String(!statsCollapsed));
}

statsToggle.addEventListener("click", () => {
  statsCollapsed = !statsCollapsed;
  saveSettings();
  syncStatsPanel();
});

document.getElementById("resetStatsBtn").addEventListener("click", () => {
  const sess = getActiveSession();
  const track = getTrack(currentPuzzle, currentTrackId);
  const pName = PUZZLES[currentPuzzle]?.shortName || currentPuzzle;
  const tName = track?.shortName || currentTrackId;

  if (statsType === "log" || statsType === "solve") {
    if (confirm(`Are you sure you want to clear all solves in session "${sess.name}"?`)) {
      sess.solves = [];
      solves = sess.solves;
      lastSolve = null;
      saveSolves();
      populateSessionSelect();
      renderSolvePanel();
      updateStatsTable();
    }
  } else if (statsType === "cll") {
    const trackCaseIds = track?.cases ? track.cases.map(c => c.id) : [];
    if (confirm(`Are you sure you want to clear all ${tName} solve times in session "${sess.name}"?`)) {
      sess.solves = sess.solves.filter(s => {
        if (s.track && s.track === currentTrackId) return false;
        if (s.id && trackCaseIds.includes(s.id)) return false;
        return true;
      });
      solves = sess.solves;
      lastSolve = solves.length ? solves[solves.length - 1] : null;
      saveSolves();
      populateSessionSelect();
      renderSolvePanel();
      updateStatsTable();
    }
  } else {
    if (confirm(`Are you sure you want to reset recognition statistics for ${pName} ${tName}?`)) {
      resetRecognitionStats(currentPuzzle, currentTrackId);
      updateStatsTable();
    }
  }
});

// ---------------------------------------------------------------------------
// Simulation Mode & Smartcube Replay
// ---------------------------------------------------------------------------

let simScrambleText = "";
let simOriginalScramble = "";
let simMoves = [];
let simOrientation = "z2";
let simSpeed = 1;
let simActiveIndex = 0;
let simPlaying = false;
let simExpectedCaseObj = null;
let simHasSolutionAppended = false;
let simListenersAttached = false;
let simIndexer = null;
let simPendingStartAtSolution = false;

function getSimOriginalCount() {
  if (!simHasSolutionAppended || !simOriginalScramble) {
    return simMoves.length;
  }
  const parsed = parseScrambleInput(simOriginalScramble);
  return parsed.ok ? parsed.moves.length : simMoves.length;
}

function simLoadCaseWithSolution(caseObj, presetIndex = 0) {
  if (!caseObj) return;
  const scrambles = caseObj.scrambles && caseObj.scrambles.length ? caseObj.scrambles : [caseObj.scramble];
  const chosenScramble = scrambles[presetIndex] || scrambles[0];
  const orientation = alwaysWhiteBottom ? "z2" : "";
  const cleanScramble = cleanAlg(chosenScramble);
  const baseScramble = `${orientation ? orientation + " " : ""}${cleanScramble}`.trim();

  const sol = caseObj.solutionAlg || caseObj.solution || "";
  const cleanSol = sol ? cleanAlg(sol) : "";

  if (cleanSol) {
    const combined = `${baseScramble} ${cleanSol}`.trim();
    simScrambleInput.value = combined;
    simOriginalScramble = baseScramble;
    simHasSolutionAppended = true;
    simAppendSolutionBtn.textContent = "Remove Solution";
    simAppendSolutionBtn.classList.add("active");
    simLoadScramble(combined, {
      expectedCase: caseObj,
      isAppended: true,
      activePresetIndex: presetIndex,
      startAtSolution: true,
      originalScramble: baseScramble
    });
  } else {
    simScrambleInput.value = baseScramble;
    simOriginalScramble = baseScramble;
    simHasSolutionAppended = false;
    simAppendSolutionBtn.textContent = "Append Solution";
    simAppendSolutionBtn.classList.remove("active");
    simLoadScramble(baseScramble, {
      expectedCase: caseObj,
      isAppended: false,
      activePresetIndex: presetIndex,
      startAtSolution: false,
      originalScramble: baseScramble
    });
  }
}

function simLoadPblCase(caseObj, algIndex = null) {
  if (typeof caseObj === "string") {
    const rawId = caseObj.replace(/^PBL:\s*/i, "").trim();
    caseObj = pblCaseById.get(rawId);
  }
  if (!caseObj) return;

  let activeAlg;
  if (algIndex !== null && caseObj.algs && caseObj.algs[algIndex]) {
    activeAlg = caseObj.algs[algIndex];
  } else {
    activeAlg = getPblCaseSelectedAlg(caseObj);
  }
  const resolvedAlgIndex = caseObj.algs ? caseObj.algs.findIndex(a => a.id === activeAlg.id) : 0;
  const activeLabel = getPblAlgDisplayLabel(caseObj.id, activeAlg) || activeAlg.label || activeAlg.alg;

  // Invert the selected algorithm to get the setup scramble:
  let invScramble = "";
  try {
    invScramble = new Alg(cleanAlg(activeAlg.alg)).invert().toString();
  } catch (err) {
    console.warn("Could not invert PBL alg, falling back:", err);
    invScramble = activeAlg.alg;
  }

  const sol = cleanAlg(activeAlg.alg);
  const combined = `${invScramble} ${sol}`.trim();

  if (mode !== "simulate") {
    setMode("simulate", { skipSimInit: true });
  }

  simScrambleInput.value = combined;
  simOriginalScramble = invScramble;
  simHasSolutionAppended = true;
  simAppendSolutionBtn.textContent = "Remove Solution";
  simAppendSolutionBtn.classList.add("active");

  const expectedCase = {
    id: `PBL: ${caseObj.id}`,
    displayName: `PBL: ${caseObj.shortName || caseObj.name}`,
    name: caseObj.name,
    shortName: caseObj.shortName,
    isPbl: true,
    pblCaseId: caseObj.id,
    caseObj: caseObj,
    activeAlgIndex: resolvedAlgIndex >= 0 ? resolvedAlgIndex : 0,
    solution: activeLabel,
    solutionAlg: sol,
    scramble: invScramble,
    scrambles: (caseObj.algs || []).map(a => {
      try {
        return new Alg(cleanAlg(a.alg)).invert().toString();
      } catch {
        return a.alg;
      }
    }),
    algs: caseObj.algs || []
  };

  simLoadScramble(combined, {
    expectedCase,
    isAppended: true,
    activePresetIndex: resolvedAlgIndex >= 0 ? resolvedAlgIndex : 0,
    startAtSolution: true,
    originalScramble: invScramble
  });
}

function simInit() {
  populateSimCaseSelect();
  attachSimPlayerListeners();

  // If we already have moves loaded for a case with solution, maintain state
  if (simMoves.length > 0 && simExpectedCaseObj && simHasSolutionAppended) {
    return;
  }

  if (currentCaseId) {
    const track = getTrack(currentPuzzle, currentTrackId);
    const c = track?.caseById?.get(currentCaseId) || caseById.get(currentCaseId);
    if (c) {
      simLoadCaseWithSolution(c, 0);
      return;
    }
  }

  const candidate = simScrambleInput.value.trim();
  if (candidate) {
    simLoadScramble(candidate);
  } else {
    const defaultCase = caseById.get("T1");
    if (defaultCase) {
      simLoadCaseWithSolution(defaultCase, 0);
    }
  }
}

function simTeardown() {
  if (el && el.player) {
    try {
      el.player.pause();
      el.player.tempoScale = 1;
      el.player.experimentalSetupAlg = "";
      if (el.player.experimentalModel?.catchUpMove) {
        el.player.experimentalModel.catchUpMove.set({ move: null, amount: 0 });
      }
      el.player.jumpToEnd();
    } catch {}
  }
  userFreeMoves = [];
  updateFreeMovesUI();
  if (scramble) {
    applyScrambleToDisplay(scramble);
    applyReflection();
  }
}

function populateSimCaseSelect() {
  simCaseSelect.innerHTML = `<option value="">Load a case to simulate...</option>`;

  if (currentPuzzle === "444") {
    const parityTrack = getTrack("444", "parity");
    if (parityTrack) {
      const g = document.createElement("optgroup");
      g.label = "4x4 Parity";
      parityTrack.cases.forEach(c => {
        const opt = document.createElement("option");
        opt.value = `444:parity:${c.id}`;
        opt.textContent = `${c.name}: ${c.alg}`;
        g.appendChild(opt);
      });
      simCaseSelect.appendChild(g);
    }
    return;
  }

  if (currentPuzzle === "555") {
    const parityTrack = getTrack("555", "parity");
    if (parityTrack) {
      const g = document.createElement("optgroup");
      g.label = "5x5 Parity & L2E";
      parityTrack.cases.forEach(c => {
        const opt = document.createElement("option");
        opt.value = `555:parity:${c.id}`;
        opt.textContent = `${c.name}: ${c.alg}`;
        g.appendChild(opt);
      });
      simCaseSelect.appendChild(g);
    }
    return;
  }

  if (currentPuzzle === "333" || currentPuzzle === "333oh") {
    const pllTrack = getTrack("333", "pll");
    if (pllTrack) {
      const g = document.createElement("optgroup");
      g.label = "PLL (21 cases)";
      pllTrack.cases.forEach(c => {
        const opt = document.createElement("option");
        opt.value = `333:pll:${c.id}`;
        opt.textContent = `${c.id} (${c.name}): ${c.algs[0]?.alg || ''}`;
        g.appendChild(opt);
      });
      simCaseSelect.appendChild(g);
    }

    const ollTrack = getTrack("333", "oll");
    if (ollTrack) {
      const g = document.createElement("optgroup");
      g.label = "OLL (57 cases)";
      ollTrack.cases.forEach(c => {
        const opt = document.createElement("option");
        opt.value = `333:oll:${c.id}`;
        opt.textContent = `${c.id} (${c.group}): ${c.algs[0]?.alg || ''}`;
        g.appendChild(opt);
      });
      simCaseSelect.appendChild(g);
    }

    const f2lTrack = getTrack("333", "f2l");
    if (f2lTrack) {
      const g = document.createElement("optgroup");
      g.label = "F2L (41 cases)";
      f2lTrack.cases.forEach(c => {
        const opt = document.createElement("option");
        opt.value = `333:f2l:${c.id}`;
        opt.textContent = `${c.id} (${c.group}): ${c.algs[0]?.alg || ''}`;
        g.appendChild(opt);
      });
      simCaseSelect.appendChild(g);
    }
    return;
  }

  GROUP_DISPLAY_ORDER.forEach(group => {
    const optgroup = document.createElement("optgroup");
    optgroup.label = `Group ${group}`;
    casesByGroup[group].forEach(caseObj => {
      const opt = document.createElement("option");
      opt.value = caseObj.id;
      opt.textContent = `${caseObj.id}: ${caseObj.solution || ''}`;
      optgroup.appendChild(opt);
    });
    simCaseSelect.appendChild(optgroup);
  });

  const pblGroup = document.createElement("optgroup");
  pblGroup.label = "Ortega PBL";
  pblCases.forEach(pCase => {
    const opt = document.createElement("option");
    opt.value = `PBL: ${pCase.id}`;
    opt.textContent = `PBL: ${pCase.shortName || pCase.name}`;
    pblGroup.appendChild(opt);
  });
  simCaseSelect.appendChild(pblGroup);
}

function findCaseByScrambleMoves(moves) {
  let startIdx = 0;
  while (startIdx < moves.length && /^[xyz]/i.test(moves[startIdx])) {
    startIdx++;
  }
  const caseMovesOnly = moves.slice(startIdx).join(" ");
  const allMoves = moves.join(" ");
  const normCaseMoves = normalizeAlgForCompare(caseMovesOnly);
  const normAllMoves = normalizeAlgForCompare(allMoves);

  // Search current puzzle tracks first (e.g. 4x4 or 5x5 parity, 3x3 CFOP)
  const curTrack = getTrack(currentPuzzle, currentTrackId);
  const tracksToSearch = [];
  if (curTrack) tracksToSearch.push(curTrack);
  if (currentPuzzle === "444") {
    const p4 = getTrack("444", "parity");
    if (p4 && p4 !== curTrack) tracksToSearch.push(p4);
  } else if (currentPuzzle === "555") {
    const p5 = getTrack("555", "parity");
    if (p5 && p5 !== curTrack) tracksToSearch.push(p5);
  }

  for (const tr of tracksToSearch) {
    if (tr && tr.cases) {
      for (const caseObj of tr.cases) {
        const list = caseObj.scrambles && caseObj.scrambles.length ? caseObj.scrambles : [caseObj.setup || caseObj.scramble];
        for (const sc of list) {
          if (!sc) continue;
          const normSc = normalizeAlgForCompare(sc);
          if (normSc === normCaseMoves || normSc === normAllMoves || sc.trim() === caseMovesOnly || sc.trim() === allMoves) {
            return {
              id: caseObj.id,
              displayName: `${tr.shortName || tr.name}: ${caseObj.shortName || caseObj.name}`,
              name: caseObj.name,
              shortName: caseObj.shortName,
              scrambles: caseObj.scrambles || [caseObj.setup || caseObj.scramble],
              scramble: caseObj.setup || caseObj.scramble,
              solution: caseObj.algs ? (caseObj.algs[0]?.label || caseObj.algs[0]?.alg) : (caseObj.alg || ""),
              solutionAlg: caseObj.algs ? (caseObj.algs[0]?.alg || "") : (caseObj.alg || "")
            };
          }
        }
      }
    }
  }

  for (const caseObj of caseById.values()) {
    const list = caseObj.scrambles && caseObj.scrambles.length ? caseObj.scrambles : [caseObj.scramble];
    for (const sc of list) {
      const normSc = normalizeAlgForCompare(sc);
      if (normSc === normCaseMoves || normSc === normAllMoves || sc.trim() === caseMovesOnly || sc.trim() === allMoves) {
        return caseObj;
      }
    }
  }

  for (const pCase of pblCases) {
    for (let i = 0; i < pCase.algs.length; i++) {
      const a = pCase.algs[i];
      let inv = "";
      try {
        inv = new Alg(cleanAlg(a.alg)).invert().toString();
      } catch {}
      const normInv = normalizeAlgForCompare(inv);
      if (normInv && (normInv === normCaseMoves || normInv === normAllMoves)) {
        const activeLabel = getPblAlgDisplayLabel(pCase.id, a) || a.label || a.alg;
        return {
          id: `PBL: ${pCase.id}`,
          displayName: `PBL: ${pCase.shortName || pCase.name}`,
          name: pCase.name,
          shortName: pCase.shortName,
          isPbl: true,
          pblCaseId: pCase.id,
          caseObj: pCase,
          activeAlgIndex: i,
          solution: activeLabel,
          solutionAlg: a.alg,
          scramble: inv,
          algs: pCase.algs
        };
      }
    }
  }

  return null;
}

function renderSimPresetButtons(caseObj, activeIndex = null) {
  if (!simPresetButtons) return;
  simPresetButtons.innerHTML = "";

  if (!caseObj) {
    if (simScrambleSelectWrap) simScrambleSelectWrap.hidden = true;
    return;
  }

  if (caseObj.isPbl) {
    const algs = caseObj.algs || [];
    let matchedIdx = activeIndex !== null ? activeIndex : (caseObj.activeAlgIndex ?? 0);

    algs.forEach((algOption, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `btn btn-small sim-preset-btn ${idx === matchedIdx ? "active" : ""}`;
      btn.textContent = `Alg ${idx + 1}`;
      const algLabel = getPblAlgDisplayLabel(caseObj.pblCaseId || caseObj.id, algOption) || algOption.label || algOption.alg;
      btn.title = `Simulate Alg ${idx + 1}: ${algLabel}`;
      btn.addEventListener("click", () => {
        simLoadPblCase(caseObj.caseObj || caseObj, idx);
      });
      simPresetButtons.appendChild(btn);
    });

    if (simScrambleSelect) {
      simScrambleSelect.innerHTML = "";
      algs.forEach((algOption, idx) => {
        const opt = document.createElement("option");
        opt.value = idx;
        const algLabel = getPblAlgDisplayLabel(caseObj.pblCaseId || caseObj.id, algOption) || algOption.label || algOption.alg;
        opt.textContent = `Alg ${idx + 1}: ${algLabel}`;
        simScrambleSelect.appendChild(opt);
      });
      simScrambleSelect.value = String(matchedIdx);
      if (simScrambleSelectWrap) simScrambleSelectWrap.hidden = false;
    }
    return;
  }

  const scrambles = Array.isArray(caseObj.scrambles) && caseObj.scrambles.length > 0
    ? caseObj.scrambles
    : (caseObj.scramble ? [caseObj.scramble] : []);

  if (scrambles.length === 0) {
    if (simScrambleSelectWrap) simScrambleSelectWrap.hidden = true;
    return;
  }

  let matchedIdx = activeIndex;
  if (matchedIdx === null) {
    const origCount = getSimOriginalCount();
    const strippedMoves = simMoves.slice(0, origCount).filter(m => !/^[xyz]/i.test(m)).join(" ");
    const normStripped = normalizeAlgForCompare(strippedMoves);
    matchedIdx = scrambles.findIndex(s => s && (normalizeAlgForCompare(s) === normStripped || s.trim() === strippedMoves));
    if (matchedIdx === -1) matchedIdx = 0;
  }

  scrambles.forEach((sc, idx) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `btn btn-small sim-preset-btn ${idx === matchedIdx ? "active" : ""}`;
    btn.textContent = `Scramble ${idx + 1}`;
    btn.title = `Load preset scramble ${idx + 1}: ${sc}`;
    btn.addEventListener("click", () => {
      simLoadCaseWithSolution(caseObj, idx);
    });
    simPresetButtons.appendChild(btn);
  });

  if (simScrambleSelect) {
    simScrambleSelect.innerHTML = "";
    scrambles.forEach((sc, idx) => {
      const opt = document.createElement("option");
      opt.value = idx;
      opt.textContent = `Scramble ${idx + 1}: ${sc}`;
      simScrambleSelect.appendChild(opt);
    });
    simScrambleSelect.value = String(matchedIdx);
    if (simScrambleSelectWrap) simScrambleSelectWrap.hidden = false;
  }
}

function simLoadScramble(raw, { expectedCase = null, isAppended = false, activePresetIndex = null, startAtSolution = false, originalScramble = null } = {}) {
  const parsed = parseScrambleInput(raw);
  if (!parsed.ok) {
    simErrorMsg.textContent = parsed.error;
    simErrorMsg.hidden = false;
    simStatusBadge.textContent = "Error";
    simStatusBadge.className = "sim-badge";
    return false;
  }

  simErrorMsg.hidden = true;
  simScrambleText = raw;
  if (!isAppended) {
    simOriginalScramble = raw;
    simHasSolutionAppended = false;
    simAppendSolutionBtn.textContent = "Append Solution";
    simAppendSolutionBtn.classList.remove("active");
  } else {
    simHasSolutionAppended = true;
    if (originalScramble) {
      simOriginalScramble = originalScramble;
    }
    simAppendSolutionBtn.textContent = "Remove Solution";
    simAppendSolutionBtn.classList.add("active");
  }

  const origBase = (isAppended || simHasSolutionAppended) ? (originalScramble || simOriginalScramble) : raw;
  freeMoveBaseScramble = origBase;
  currentBaseDisplayScramble = origBase;
  userFreeMoves = [];
  updateFreeMovesUI();

  simMoves = parsed.moves;
  simOrientation = parsed.orientation;
  simExpectedCaseObj = expectedCase || findCaseByScrambleMoves(simMoves);

  if (simExpectedCaseObj) {
    simCaseTag.textContent = `Case: ${simExpectedCaseObj.displayName || simExpectedCaseObj.id}`;
    simSolutionTag.innerHTML = `<strong>Solution:</strong> ${simExpectedCaseObj.solution || 'None'}`;
    simOrientTag.textContent = simOrientation ? `Orientation: ${simOrientation}` : "Standard Orientation";
    simCaseDetails.hidden = false;
    simAppendSolutionBtn.disabled = !(simExpectedCaseObj.solutionAlg || simExpectedCaseObj.solution);
    if (simCaseSelect.value !== simExpectedCaseObj.id) {
      const opt = Array.from(simCaseSelect.options).find(o => o.value === simExpectedCaseObj.id || o.value.endsWith(`:${simExpectedCaseObj.id}`));
      if (opt) simCaseSelect.value = opt.value;
      else simCaseSelect.value = simExpectedCaseObj.id;
    }
    renderSimPresetButtons(simExpectedCaseObj, activePresetIndex);
  } else {
    simCaseDetails.hidden = true;
    simAppendSolutionBtn.disabled = true;
    if (simScrambleSelectWrap) simScrambleSelectWrap.hidden = true;
  }

  updateSimulateSolutions();

  const origCount = getSimOriginalCount();
  const shouldStartAtSolution = startAtSolution && origCount > 0 && origCount < simMoves.length;

  if (el && el.player) {
    try {
      el.player.pause();
      el.player.experimentalSetupAlg = "";
      el.scramble = simMoves.join(" ");
      applyReflection();
      if (shouldStartAtSolution) {
        simPendingStartAtSolution = true;
        el.player.experimentalModel.indexer.get().then(idx => {
          simIndexer = idx;
          const targetIdx = origCount - 1;
          const endTimestamp = idx.indexToMoveStartTimestamp(targetIdx) + idx.moveDuration(targetIdx);
          el.player.experimentalModel.timestampRequest.set(endTimestamp);
          simPendingStartAtSolution = false;
          updateSimProgress(origCount, false, false);
        }).catch(() => {
          simPendingStartAtSolution = false;
        });
      } else {
        simPendingStartAtSolution = false;
        el.player.controller.jumpToStart({ flash: true });
        el.player.experimentalModel.indexer.get().then(idx => {
          simIndexer = idx;
        }).catch(() => {});
      }
    } catch (err) {
      console.warn("Error setting scramble in simulator:", err);
    }
  }

  simActiveIndex = shouldStartAtSolution ? origCount : 0;
  renderSimTimeline(isAppended);
  if (shouldStartAtSolution) {
    updateSimProgress(origCount, false, false);
  } else {
    updateSimProgress(0, true, false);
  }

  return true;
}

function renderSimTimeline(isAppended = false) {
  simMoveList.innerHTML = "";
  if (simMoves.length === 0) {
    simMoveList.innerHTML = `<span class="sim-timeline-hint">No moves loaded.</span>`;
    return;
  }

  const hasSolution = isAppended || simHasSolutionAppended;
  const originalCount = hasSolution ? getSimOriginalCount() : simMoves.length;
  const total = simMoves.length;
  const solCount = total - originalCount;

  // If we have scramble + solution, add a Scramble divider header
  if (hasSolution && originalCount > 0 && solCount > 0) {
    const scDiv = document.createElement("div");
    scDiv.className = "sim-timeline-divider";
    const scBadge = document.createElement("button");
    scBadge.type = "button";
    scBadge.className = "sim-divider-badge sim-divider-scramble";
    scBadge.title = "Jump to start of scramble (0 / before setup)";
    scBadge.innerHTML = `<span>Scramble (${originalCount} moves)</span>`;
    scBadge.addEventListener("click", () => {
      try {
        el.player.pause();
        el.player.controller.jumpToStart({ flash: true });
        updateSimProgress(0, true, false);
      } catch {}
    });
    scDiv.appendChild(scBadge);
    simMoveList.appendChild(scDiv);
  }

  simMoves.forEach((move, i) => {
    // If this is the start of the solution, insert the Solution divider
    if (hasSolution && i === originalCount && solCount > 0) {
      const solDiv = document.createElement("div");
      solDiv.className = "sim-timeline-divider";
      const solBadge = document.createElement("button");
      solBadge.type = "button";
      solBadge.className = "sim-divider-badge";
      solBadge.title = "Reset cube to CLL Case (ready to play solution)";
      solBadge.innerHTML = `<span>Solution (${solCount} moves)</span>`;
      solBadge.addEventListener("click", () => simJumpToCaseState());
      solDiv.appendChild(solBadge);
      simMoveList.appendChild(solDiv);
    }

    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "sim-move-chip";
    const isSol = hasSolution && i >= originalCount;
    if (isSol) {
      chip.classList.add("is-solution");
      const solIdx = i - originalCount + 1;
      chip.innerHTML = `<span class="chip-num">S${solIdx}.</span> <span>${move}</span>`;
      chip.title = `Jump to solution move ${solIdx} (${move})`;
    } else {
      chip.innerHTML = `<span class="chip-num">${i + 1}.</span> <span>${move}</span>`;
      chip.title = `Jump to scramble move ${i + 1} (${move})`;
    }
    chip.dataset.index = i;
    chip.addEventListener("click", () => simJumpToIndex(i));
    simMoveList.appendChild(chip);
  });
}

function updateSimProgress(currentMoveNumber, atStart, atEnd) {
  simActiveIndex = currentMoveNumber;
  const total = simMoves.length;
  const chips = simMoveList.querySelectorAll(".sim-move-chip");
  const origCount = getSimOriginalCount();
  const hasSolution = simHasSolutionAppended && origCount > 0 && origCount < total;
  const solCount = total - origCount;

  if (atStart || currentMoveNumber === 0) {
    simStepCounter.textContent = hasSolution
      ? `At start of scramble (0 / ${origCount})`
      : `At start (0 / ${total})`;
    chips.forEach(chip => {
      chip.classList.remove("active", "completed");
    });
    simBtnStart.disabled = true;
    simBtnPrev.disabled = true;
    if (simTimelineResetBtn) {
      simTimelineResetBtn.disabled = false;
      simTimelineResetBtn.title = hasSolution ? "Jump to Case State (|<<)" : "Reset to beginning (|<<)";
    }
    simBtnNext.disabled = total === 0;
    simBtnEnd.disabled = total === 0;
    return;
  }

  if (atEnd || (currentMoveNumber >= total && atEnd)) {
    simStepCounter.textContent = hasSolution
      ? `Solved! (All ${solCount} solution moves complete)`
      : `At end (${total} / ${total})`;
    chips.forEach(chip => {
      chip.classList.add("completed");
      chip.classList.remove("active");
    });
    simBtnStart.disabled = false;
    simBtnPrev.disabled = false;
    if (simTimelineResetBtn) {
      simTimelineResetBtn.disabled = false;
      simTimelineResetBtn.title = hasSolution ? "Reset to Case State (|<<)" : "Reset to beginning (|<<)";
    }
    simBtnNext.disabled = true;
    simBtnEnd.disabled = true;
    return;
  }

  // Check if we are exactly at the boundary after scramble, before solution
  if (hasSolution && currentMoveNumber === origCount) {
    simStepCounter.textContent = `Case ready (Scramble complete · Solution next: ${solCount} moves)`;
    chips.forEach((chip, i) => {
      chip.classList.toggle("completed", i < origCount);
      chip.classList.remove("active");
    });
    if (chips[origCount]) {
      chips[origCount].scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
    }
    simBtnStart.disabled = false;
    simBtnPrev.disabled = false;
    if (simTimelineResetBtn) {
      simTimelineResetBtn.disabled = false;
      simTimelineResetBtn.title = "Reset to start of scramble (|<<)";
    }
    simBtnNext.disabled = false;
    simBtnEnd.disabled = false;
    return;
  }

  const activeIndex = currentMoveNumber - 1; // 0-indexed chip for the current move

  if (hasSolution) {
    if (currentMoveNumber > origCount) {
      const sIdx = currentMoveNumber - origCount;
      simStepCounter.textContent = `Solution move ${sIdx} of ${solCount}: ${simMoves[activeIndex] || ''}`;
      if (simTimelineResetBtn) simTimelineResetBtn.title = "Reset to Case State (|<<)";
    } else {
      simStepCounter.textContent = `Scramble move ${currentMoveNumber} of ${origCount}: ${simMoves[activeIndex] || ''}`;
      if (simTimelineResetBtn) simTimelineResetBtn.title = "Reset to Case State (|<<)";
    }
  } else {
    simStepCounter.textContent = `Move ${currentMoveNumber} of ${total}: ${simMoves[activeIndex] || ''}`;
    if (simTimelineResetBtn) simTimelineResetBtn.title = "Reset to beginning (|<<)";
  }

  chips.forEach((chip, i) => {
    chip.classList.toggle("active", i === activeIndex);
    chip.classList.toggle("completed", i < activeIndex);
  });

  if (chips[activeIndex]) {
    chips[activeIndex].scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  }

  simBtnStart.disabled = false;
  simBtnPrev.disabled = false;
  if (simTimelineResetBtn) simTimelineResetBtn.disabled = false;
  simBtnNext.disabled = false;
  simBtnEnd.disabled = false;
}

function updateSimPlayingState(playing, atStart, atEnd) {
  simPlaying = playing;
  const origCount = getSimOriginalCount();
  const hasSolution = simHasSolutionAppended && origCount > 0 && origCount < simMoves.length;
  const solCount = simMoves.length - origCount;

  if (playing) {
    simPlayIcon.textContent = "\u23F8";
    simPlayText.textContent = "Pause";
    simStatusBadge.textContent = hasSolution ? "Playing Solution" : "Playing";
    simStatusBadge.className = "sim-badge playing";
  } else {
    simPlayIcon.textContent = "\u25B6";
    simPlayText.textContent = atEnd ? "Replay" : "Play";
    if (atEnd) {
      simStatusBadge.textContent = hasSolution ? "Solved" : "Complete";
    } else if (hasSolution) {
      if (simActiveIndex === origCount) {
        simStatusBadge.textContent = `Case Ready (${solCount} sol moves)`;
      } else if (simActiveIndex > origCount) {
        simStatusBadge.textContent = `Solution (${simActiveIndex - origCount}/${solCount})`;
      } else {
        simStatusBadge.textContent = `Scramble (${simActiveIndex}/${origCount})`;
      }
    } else {
      simStatusBadge.textContent = `${simMoves.length} moves`;
    }
    simStatusBadge.className = "sim-badge";
  }
}

function attachSimPlayerListeners() {
  if (simListenersAttached || !el || !el.player) return;
  simListenersAttached = true;

  try {
    el.player.experimentalModel.indexer.addFreshListener((indexer) => {
      simIndexer = indexer;
    });

    el.player.experimentalModel.detailedTimelineInfo.addFreshListener((info) => {
      if (mode !== "simulate" || simMoves.length === 0) return;
      if (simPendingStartAtSolution) return;
      if (!simIndexer) return;
      if (userFreeMoves.length > 0) return;
      try {
        if (info.atStart || info.timestamp <= 0) {
          updateSimProgress(0, true, false);
          return;
        }
        if (info.atEnd) {
          updateSimProgress(simMoves.length, false, true);
          return;
        }
        const moveIdx = simIndexer.timestampToIndex(info.timestamp);
        updateSimProgress(moveIdx + 1, false, false);
      } catch (err) {
        console.warn("Timeline update error:", err);
      }
    });

    el.player.experimentalModel.coarseTimelineInfo.addFreshListener((info) => {
      if (mode !== "simulate") return;
      if (userFreeMoves.length > 0) return;
      updateSimPlayingState(info.playing, info.atStart, info.atEnd);
    });
  } catch (err) {
    console.warn("Could not attach simulator timeline listeners:", err);
  }
}

function simEnsureScrambleSynced() {
  if (userFreeMoves.length > 0) {
    userFreeMoves = [];
    updateFreeMovesUI();
    if (el) {
      el.scramble = simMoves.join(" ");
      applyReflection();
      applyColorsTo3DCube(el);
    }
  }
}

function simStepForward() {
  if (!el || !el.player || !el.player.controller) return;
  simEnsureScrambleSynced();
  try {
    el.player.pause();
    el.player.controller.animationController.play({
      direction: 1,
      untilBoundary: "move"
    });
  } catch (err) {
    console.warn("Error stepping forward:", err);
  }
}

function simStepBackward() {
  if (!el || !el.player || !el.player.controller) return;
  simEnsureScrambleSynced();
  try {
    el.player.pause();
    el.player.controller.animationController.play({
      direction: -1,
      untilBoundary: "move"
    });
  } catch (err) {
    console.warn("Error stepping backward:", err);
  }
}

async function simJumpToCaseState() {
  if (!el || !el.player) return;
  simEnsureScrambleSynced();
  try {
    el.player.pause();
    const origCount = getSimOriginalCount();
    if (origCount <= 0) {
      simJumpToStart();
      return;
    }
    if (!simIndexer) {
      simIndexer = await el.player.experimentalModel.indexer.get();
    }
    const targetIdx = origCount - 1;
    const endTimestamp = simIndexer.indexToMoveStartTimestamp(targetIdx) + simIndexer.moveDuration(targetIdx);
    el.player.experimentalModel.timestampRequest.set(endTimestamp);
    updateSimProgress(origCount, false, false);
  } catch (err) {
    console.warn("Error jumping to case state:", err);
  }
}

function simJumpToStart() {
  if (!el || !el.player || !el.player.controller) return;
  simEnsureScrambleSynced();
  const origCount = getSimOriginalCount();
  const hasSolution = simHasSolutionAppended && origCount > 0 && origCount < simMoves.length;

  if (hasSolution) {
    // If we are at or past solution move 1, or at the end: reset to the Case state (start of solution)
    if (simActiveIndex > origCount) {
      simJumpToCaseState();
      return;
    }
    // If we are already at case state, jump to beginning of scramble
    if (simActiveIndex === origCount) {
      try {
        el.player.pause();
        el.player.controller.jumpToStart({ flash: true });
        updateSimProgress(0, true, false);
      } catch (err) {
        console.warn("Error jumping to start:", err);
      }
      return;
    }
    // If at 0, jump to case state
    if (simActiveIndex === 0) {
      simJumpToCaseState();
      return;
    }
  }

  try {
    el.player.pause();
    el.player.controller.jumpToStart({ flash: true });
    updateSimProgress(0, true, false);
  } catch (err) {
    console.warn("Error jumping to start:", err);
  }
}

function simJumpToEnd() {
  if (!el || !el.player || !el.player.controller) return;
  simEnsureScrambleSynced();
  try {
    el.player.pause();
    el.player.controller.jumpToEnd({ flash: true });
    updateSimProgress(simMoves.length, false, true);
  } catch (err) {
    console.warn("Error jumping to end:", err);
  }
}

function simTogglePlay() {
  if (!el || !el.player || !el.player.controller) return;
  simEnsureScrambleSynced();
  const origCount = getSimOriginalCount();
  const hasSolution = simHasSolutionAppended && origCount > 0 && origCount < simMoves.length;

  // If at the end of the solve, and we have a solution appended: replay from the Case state
  if (hasSolution && simActiveIndex >= simMoves.length) {
    simJumpToCaseState().then(() => {
      setTimeout(() => {
        try {
          el.player.play();
        } catch {}
      }, 50);
    });
    return;
  }

  try {
    el.player.controller.togglePlay();
  } catch (err) {
    console.warn("Error toggling play:", err);
  }
}

async function simJumpToIndex(targetIndex) {
  if (!el || !el.player) return;
  simEnsureScrambleSynced();
  try {
    el.player.pause();
    if (!simIndexer) {
      simIndexer = await el.player.experimentalModel.indexer.get();
    }
    if (targetIndex < 0) {
      simJumpToStart();
      return;
    }
    if (targetIndex >= simMoves.length) {
      simJumpToEnd();
      return;
    }

    // Move `targetIndex` should already be completed on the cube:
    const endTimestamp = simIndexer.indexToMoveStartTimestamp(targetIndex) + simIndexer.moveDuration(targetIndex);
    el.player.experimentalModel.timestampRequest.set(endTimestamp);

    // Update UI immediately:
    updateSimProgress(targetIndex + 1, false, targetIndex + 1 >= simMoves.length);
  } catch (err) {
    console.warn("Error jumping to move index:", err);
  }
}

function simAppendMove(moveStr) {
  const clean = cleanAlg(moveStr);
  if (!clean) return false;
  simMoves.push(clean);
  simScrambleText = simMoves.join(" ");
  simScrambleInput.value = simScrambleText;
  if (el && el.player) {
    try {
      el.scramble = simScrambleText;
      el.player.controller.jumpToEnd({ flash: false });
    } catch {}
  }
  renderSimTimeline();
  updateSimProgress(simMoves.length, false, true);
  return true;
}

// Global smartcube hook
window.cllSimulator = {
  loadScramble: (str, opts) => simLoadScramble(str, opts),
  loadCaseWithSolution: (caseObj, idx) => simLoadCaseWithSolution(caseObj, idx),
  loadPblCase: (caseObj, idx) => simLoadPblCase(caseObj, idx),
  jumpToCaseState: () => simJumpToCaseState(),
  stepForward: () => simStepForward(),
  stepBackward: () => simStepBackward(),
  jumpToStart: () => simJumpToStart(),
  jumpToEnd: () => simJumpToEnd(),
  play: () => el.player.play(),
  pause: () => el.player.pause(),
  togglePlay: () => simTogglePlay(),
  appendMove: (m) => simAppendMove(m),
  getMoves: () => [...simMoves],
  getCurrentIndex: () => simActiveIndex
};

// Simulator UI Listeners
simLoadBtn.addEventListener("click", () => {
  simLoadScramble(simScrambleInput.value);
});

simClearBtn.addEventListener("click", () => {
  simScrambleInput.value = "";
  simScrambleInput.focus();
});

simUseCurrentBtn.addEventListener("click", () => {
  if (currentCaseId) {
    const track = getTrack(currentPuzzle, currentTrackId);
    const c = track?.caseById?.get(currentCaseId) || caseById.get(currentCaseId);
    if (c) {
      simLoadCaseWithSolution(c, 0);
      return;
    }
  }
  if (scramble) {
    simScrambleInput.value = scramble;
    simLoadScramble(scramble);
  }
});

simCaseSelect.addEventListener("change", () => {
  const caseId = simCaseSelect.value;
  if (!caseId) {
    if (simScrambleSelectWrap) simScrambleSelectWrap.hidden = true;
    return;
  }
  if (caseId.startsWith("444:") || caseId.startsWith("555:")) {
    const parts = caseId.split(":");
    const puz = parts[0];
    const trackId = parts[1];
    const cId = parts[2];
    const track = getTrack(puz, trackId);
    const c = track?.caseById.get(cId);
    if (c) {
      const caseObj = {
        id: c.id,
        displayName: `${track.shortName || track.name}: ${c.shortName || c.name}`,
        name: c.name,
        shortName: c.shortName,
        scrambles: c.scrambles && c.scrambles.length ? c.scrambles : [c.setup || c.scramble],
        scramble: c.setup || c.scramble,
        solution: c.algs ? (c.algs[0]?.label || c.algs[0]?.alg) : (c.alg || ""),
        solutionAlg: c.algs ? (c.algs[0]?.alg || "") : (c.alg || "")
      };
      simLoadCaseWithSolution(caseObj, 0);
    }
    return;
  }
  if (caseId.startsWith("333:")) {
    const parts = caseId.split(":");
    const trackId = parts[1];
    const cId = parts[2];
    const track = getTrack("333", trackId);
    const c = track?.caseById.get(cId);
    if (c) {
      const caseObj = {
        id: c.id,
        name: c.name,
        scrambles: [c.setup || c.scramble],
        scramble: c.setup || c.scramble,
        solution: c.algs[0]?.label || c.algs[0]?.alg,
        solutionAlg: c.algs[0]?.alg
      };
      simLoadCaseWithSolution(caseObj, 0);
    }
    return;
  }
  if (caseId.startsWith("PBL: ")) {
    const pblId = caseId.replace(/^PBL:\s*/i, "").trim();
    const pblObj = pblCaseById.get(pblId);
    if (pblObj) {
      simLoadPblCase(pblObj);
      return;
    }
  }
  const caseObj = caseById.get(caseId);
  if (!caseObj) return;
  simLoadCaseWithSolution(caseObj, 0);
});

if (simScrambleSelect) {
  simScrambleSelect.addEventListener("change", () => {
    if (!simExpectedCaseObj) return;
    const idx = parseInt(simScrambleSelect.value, 10);
    if (isNaN(idx)) return;
    if (simExpectedCaseObj.isPbl) {
      simLoadPblCase(simExpectedCaseObj.caseObj || simExpectedCaseObj, idx);
      return;
    }
    simLoadCaseWithSolution(simExpectedCaseObj, idx);
  });
}

simAppendSolutionBtn.addEventListener("click", () => {
  const sol = simExpectedCaseObj ? (simExpectedCaseObj.solutionAlg || simExpectedCaseObj.solution) : null;
  if (!simExpectedCaseObj || !sol) {
    alert("Please select or load a CLL or Ortega case first to append its solution.");
    return;
  }
  if (simHasSolutionAppended) {
    simHasSolutionAppended = false;
    simAppendSolutionBtn.textContent = "Append Solution";
    simAppendSolutionBtn.classList.remove("active");
    simScrambleInput.value = simOriginalScramble;
    simLoadScramble(simOriginalScramble, { expectedCase: simExpectedCaseObj });
  } else {
    simHasSolutionAppended = true;
    simAppendSolutionBtn.textContent = "Remove Solution";
    simAppendSolutionBtn.classList.add("active");
    const solClean = cleanAlg(sol);
    const base = simOriginalScramble || simScrambleText;
    const combined = base + " " + solClean;
    simScrambleInput.value = combined;
    simLoadScramble(combined, {
      expectedCase: simExpectedCaseObj,
      isAppended: true,
      startAtSolution: true,
      originalScramble: base
    });
  }
});

simBtnStart.addEventListener("click", simJumpToStart);
if (simTimelineResetBtn) {
  simTimelineResetBtn.addEventListener("click", simJumpToStart);
}
simBtnPrev.addEventListener("click", simStepBackward);
simBtnPlay.addEventListener("click", simTogglePlay);
simBtnNext.addEventListener("click", simStepForward);
simBtnEnd.addEventListener("click", simJumpToEnd);

simSpeedButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    const speed = parseFloat(btn.dataset.speed);
    if (!isNaN(speed) && speed > 0) {
      simSpeed = speed;
      if (el && el.player) {
        el.player.tempoScale = simSpeed;
      }
      simSpeedButtons.forEach(b => b.classList.toggle("active", b === btn));
    }
  });
});

document.addEventListener("keydown", e => {
  if (mode !== "simulate" || !overview.hidden) return;
  const target = e.target;
  if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) {
    if (e.key === "Enter" && target === simScrambleInput) {
      e.preventDefault();
      simLoadScramble(simScrambleInput.value);
    }
    return;
  }

  if (e.code === "Space") {
    e.preventDefault();
    simTogglePlay();
  } else if (e.key === "ArrowRight") {
    e.preventDefault();
    simStepForward();
  } else if (e.key === "ArrowLeft") {
    e.preventDefault();
    simStepBackward();
  } else if (e.key === "Home") {
    e.preventDefault();
    simJumpToStart();
  } else if (e.key === "End") {
    e.preventDefault();
    simJumpToEnd();
  }
});

// ---------------------------------------------------------------------------
// Init
// ---------------------------------------------------------------------------

studyView = new StudyView({
  container: studyViewContainer,
  getSelectedCaseIds: () => selectedCases,
  getAlwaysWhiteBottom: () => alwaysWhiteBottom,
  getShowReflection: () => showReflection,
  onSelectCase: (caseObj) => {},
  onSimulateCase: (caseObj, algObj) => {
    setMode("simulate", { skipSimInit: true });
    const chosenAlg = algObj ? algObj.alg : (caseObj.algs?.[0]?.alg || caseObj.solutionAlg || caseObj.solution || "");
    const scr = caseObj.setup || caseObj.scramble || caseObj.scrambles?.[0] || "";
    if (scr) {
      const mockCase = {
        ...caseObj,
        scrambles: [scr],
        scramble: scr,
        solution: chosenAlg,
        solutionAlg: chosenAlg
      };
      simLoadCaseWithSolution(mockCase, 0);
    } else {
      simScrambleInput.value = chosenAlg;
      simLoadScramble(chosenAlg, {
        expectedCase: caseObj,
        startAtSolution: false
      });
    }
  },
  onPracticeCase: (caseObj) => {
    setMode("practice");
  }
});

practiceView = new PracticeView({
  container: practiceViewContainer,
  getCrossTargetFaces: () => crossTargetFaces,
  getLayerTargetFaces: () => layerTargetFaces,
  onRecordRecognition: (caseId, isCorrect) => {
    recordCaseStat(currentPuzzle, currentTrackId, caseId, isCorrect);
    updateStatsTable();
  },
  onFlashCube: (result) => {
    flashCube(result);
  },
  onGenerateScramble: async (trackId) => {
    const tid = trackId || currentTrackId;
    if (currentPuzzle === "333" || currentPuzzle === "333oh") {
      if (tid === "cross") {
        const wcaScr = currentPuzzle === "333oh" ? await generateWca3x3OhScramble() : await generateWca3x3Scramble();
        applyScrambleToDisplay(wcaScr);
        return { scramble: wcaScr, caseObj: null };
      }
      const track = getTrack(currentPuzzle, tid);
      if (track && track.cases.length > 0) {
        const active = track.cases.filter(c => selectedCases.has(c.id));
        const pool = active.length > 0 ? active : track.cases;
        const c = pool[Math.floor(Math.random() * pool.length)];
        const scr = c.setup || c.scramble;
        const displayScr = alwaysWhiteBottom ? `z2 ${scr}` : scr;
        applyScrambleToDisplay(displayScr);
        return { scramble: scr, caseObj: c };
      }
      const wcaScr = await generateWca3x3Scramble();
      applyScrambleToDisplay(wcaScr);
      return { scramble: wcaScr, caseObj: null };
    } else if (currentPuzzle === "444" || currentPuzzle === "555") {
      const track = getTrack(currentPuzzle, "parity");
      if (track && track.cases.length > 0) {
        const active = track.cases.filter(c => selectedCases.has(c.id));
        const pool = active.length > 0 ? active : track.cases;
        const c = pool[Math.floor(Math.random() * pool.length)];
        const scr = (c.scrambles && c.scrambles.length > 0)
          ? c.scrambles[Math.floor(Math.random() * c.scrambles.length)]
          : (c.setup || c.scramble);
        applyScrambleToDisplay(scr);
        return { scramble: scr, caseObj: c };
      }
      const wcaScr = currentPuzzle === "444" ? await generateWca4x4Scramble() : await generateWca5x5Scramble();
      applyScrambleToDisplay(wcaScr);
      return { scramble: wcaScr, caseObj: null };
    } else {
      if (tid === "layer") {
        const wcaScr = await generateWca2x2Scramble();
        applyScrambleToDisplay(wcaScr);
        return { scramble: wcaScr, caseObj: null };
      }
      const track = getTrack("222", tid);
      if (track && track.cases.length > 0) {
        const active = track.cases.filter(c => selectedCases.has(c.id));
        const pool = active.length > 0 ? active : track.cases;
        const c = pool[Math.floor(Math.random() * pool.length)];
        const scr = c.setup || c.scramble || c.scrambles?.[0];
        const displayScr = alwaysWhiteBottom ? `z2 ${scr}` : scr;
        applyScrambleToDisplay(displayScr);
        return { scramble: scr, caseObj: c };
      }
      const wcaScr = await generateWca2x2Scramble();
      applyScrambleToDisplay(wcaScr);
      return { scramble: wcaScr, caseObj: null };
    }
  },
  onApplyScrambleToDisplay: (scramble) => {
    const is333Case = currentPuzzle === "333" && ["f2l", "oll", "pll"].includes(currentTrackId);
    const displayScr = (alwaysWhiteBottom && is333Case) ? `z2 ${scramble}` : scramble;
    applyScrambleToDisplay(displayScr);
  }
});

studyView.setTrack(currentPuzzle, currentTrackId);
practiceView.setTrack(currentPuzzle, currentTrackId);
renderTrackBar();
populateSolveTargetSelect();

puzzleButtons.forEach(btn => {
  const active = btn.dataset.puzzle === currentPuzzle;
  btn.classList.toggle("active", active);
  btn.setAttribute("aria-pressed", String(active));
});
if (pblOverviewBtn) pblOverviewBtn.hidden = currentPuzzle !== "222";
if (overviewBtn) overviewBtn.hidden = currentPuzzle !== "222";

const freeMovesPanelEl = document.getElementById("freeMovesPanel");
if (freeMovesPanelEl) {
  freeMovesPanelEl.open = Boolean(freeMovesOpen);
  freeMovesPanelEl.addEventListener("toggle", () => {
    freeMovesOpen = freeMovesPanelEl.open;
    saveSettings();
  });
}
if (layerSolutionsWidget) {
  layerSolutionsWidget.open = Boolean(layerSolutionsOpen);
  layerSolutionsWidget.addEventListener("toggle", () => {
    layerSolutionsOpen = layerSolutionsWidget.open;
    saveSettings();
  });
}
if (crossSolutionsWidget) {
  crossSolutionsWidget.open = Boolean(crossSolutionsOpen);
  crossSolutionsWidget.addEventListener("toggle", () => {
    crossSolutionsOpen = crossSolutionsWidget.open;
    saveSettings();
  });
}

// Dismiss open solve date clock popovers on outside touch/click
document.addEventListener("pointerdown", (e) => {
  if (!e.target.closest(".solve-date-clock-wrap")) {
    document.querySelectorAll(".solve-date-clock-wrap.is-open").forEach(elWrap => {
      elWrap.classList.remove("is-open");
    });
  }
});

buildCasePicker();
applyTheme();
renderToggles();
renderMinutes();
syncSettingsPanel();
syncStatsPanel();
renderStatsToggle();
populateSimCaseSelect();
updateFaceChipsUI();
updateCrossFacesUI();
regenerateScramble();
prewarmOllPllSvgs(ollCases, pllCases).then(() => {
  if (!statsPanel.hidden) updateStatsTable();
});
if (mode === "simulate") {
  simInit();
}
