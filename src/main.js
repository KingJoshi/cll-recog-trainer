import { ScrambleDisplay } from 'scramble-display';
import { puzzles } from 'cubing/puzzles';
import { randomScrambleForEvent } from 'cubing/scramble';
import { findLayerSolutions } from './layerSolver.js';
import { findCrossSolutions } from './crossSolver.js';
import { Alg } from 'cubing/alg';
import { cllCases } from './casesData.js';
import { pblCases, pblCaseById } from './pblData.js';
import { PUZZLES, getTrack, getPreferredAlg, setPreferredAlg } from './data/algRegistry.js';
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
  applyColorsTo3DCube,
  ensure3x3FoundationOpaque
} from './caseVisualizer.js';
import { MOVE_TOKEN_REGEX, cleanAlg, normalizeAlgForCompare, parseScrambleInput } from './algParser.js';
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
const savedSettings = readJSON(SETTINGS_KEY) || {};

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
let statsCollapsed = savedSettings.statsCollapsed ?? false;
if (savedSettings.customColors) {
  setCustomCubeColors(savedSettings.customColors);
  applyCubeColorsToCss(savedSettings.customColors);
} else {
  applyCubeColorsToCss(DEFAULT_CUBE_COLORS);
}
let layerTargetFaces = Array.isArray(savedSettings.layerTargetFaces) && savedSettings.layerTargetFaces.length
  ? savedSettings.layerTargetFaces
  : ["white"];
let statsType = (savedSettings.statsType === "recog" || savedSettings.statsType === "cll")
  ? savedSettings.statsType
  : "log";
let solveStatsSort = { col: "case", dir: "asc" };

// Modes: solve, study, practice, simulate (Timed Sprint is inside Practice)
const MODES = ["solve", "study", "practice", "simulate"];
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

let solves = getActiveSession().solves;

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
  return caseTags[caseId] || "learning";
}

function setCaseTag(caseId, tag) {
  if (!["learning", "review", "mastered"].includes(tag)) return;
  caseTags[caseId] = tag;
  saveCaseTags();
  if (typeof updateCasePickerTags === "function") updateCasePickerTags();
  if (mode === "study" && currentCaseId === caseId) {
    updateCaseInfoDisplay();
  }
}

function cycleCaseTag(caseId) {
  const current = getCaseTag(caseId);
  const next = current === "learning" ? "review" : current === "review" ? "mastered" : "learning";
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
let settingsCollapsed = true; // narrow screens only; the sidebar is always open

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

function saveSettings() {
  writeJSON(SETTINGS_KEY, {
    currentPuzzle,
    currentTrackId,
    selected: [...selectedCases],
    alwaysWhiteBottom,
    allowAUF,
    showReflection,
    darkMode,
    mode,
    timedMinutes,
    statsCollapsed,
    statsType,
    layerTargetFaces,
    activeSessionId,
    solveTarget,
    solveShowCube,
    solveInspection,
    solveWidgetSize,
    customColors: { ...CUBE_COLORS }
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
const solveModalTitle = document.getElementById("solveModalTitle");
const solveModalTime = document.getElementById("solveModalTime");
const solveModalScramble = document.getElementById("solveModalScramble");
const solveModalDate = document.getElementById("solveModalDate");
const solveModalCloseBtn = document.getElementById("solveModalCloseBtn");
const solveModalDismissBtn = document.getElementById("solveModalDismissBtn");
const solveModalCopyScrambleBtn = document.getElementById("solveModalCopyScrambleBtn");
const solveModalReattemptBtn = document.getElementById("solveModalReattemptBtn");
const solveModalSimBtn = document.getElementById("solveModalSimBtn");

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
  }
}

async function reverseAllFreeMoves() {
  if (!userFreeMoves.length) return;
  resetFreeMovesToScramble();
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
}

function resetFreeMovesToSolved() {
  userFreeMoves = [];
  updateFreeMovesUI();
  el.scramble = "";
  try {
    el.player?.controller?.jumpToEnd?.({ flash: false }) || el.player?.jumpToEnd?.();
  } catch {}
  applyColorsTo3DCube(el);
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
if (freeMoveUndoBtn) freeMoveUndoBtn.addEventListener("click", undoLastFreeMove);

const freeMoveReverseBtn = document.getElementById("freeMoveReverseBtn");
if (freeMoveReverseBtn) freeMoveReverseBtn.addEventListener("click", reverseAllFreeMoves);

const freeMoveResetScrambleBtn = document.getElementById("freeMoveResetScrambleBtn");
if (freeMoveResetScrambleBtn) freeMoveResetScrambleBtn.addEventListener("click", resetFreeMovesToScramble);

const freeMoveResetSolvedBtn = document.getElementById("freeMoveResetSolvedBtn");
if (freeMoveResetSolvedBtn) freeMoveResetSolvedBtn.addEventListener("click", resetFreeMovesToSolved);

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
  const pData = PUZZLES[currentPuzzle];
  if (!pData || !pData.tracks) {
    trackBar.innerHTML = "";
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

  if (trackBar) {
    trackBar.querySelectorAll(".track-btn").forEach(btn => {
      const active = btn.dataset.track === currentTrackId;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-pressed", String(active));
    });
  }

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
  updateStatsTable();
}

function populateSolveTargetSelect() {
  if (!solveTargetSelect) return;
  if (currentPuzzle === "333" || currentPuzzle === "333oh") {
    const isOh = currentPuzzle === "333oh";
    solveTargetSelect.innerHTML = `
      <option value="full">Full Solve (WCA ${isOh ? "3x3 OH" : "3x3"})</option>
      <option value="cross">White Cross Only</option>
      <option value="f2l">F2L Case</option>
      <option value="oll">OLL Case</option>
      <option value="pll">PLL Case</option>
    `;
    if (!["full", "cross", "f2l", "oll", "pll"].includes(solveTarget)) {
      solveTarget = "full";
    }
  } else if (currentPuzzle === "444") {
    solveTargetSelect.innerHTML = `
      <option value="full">Full Solve (WCA 4x4)</option>
      <option value="parity">4x4 Parity Drill (OLL &amp; PLL)</option>
    `;
    if (!["full", "parity"].includes(solveTarget)) {
      solveTarget = "full";
    }
  } else if (currentPuzzle === "555") {
    solveTargetSelect.innerHTML = `
      <option value="full">Full Solve (WCA 5x5)</option>
      <option value="parity">5x5 Parity &amp; L2E Drill</option>
    `;
    if (!["full", "parity"].includes(solveTarget)) {
      solveTarget = "full";
    }
  } else {
    solveTargetSelect.innerHTML = `
      <option value="full">Full Solve (WCA 2x2)</option>
      <option value="layer">1st Layer Only</option>
      <option value="face">1st Face Only (Ortega)</option>
      <option value="cll">CLL Case</option>
    `;
    if (!["full", "layer", "face", "cll"].includes(solveTarget)) {
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
    return caseObj.name || id.replace(/^pll-/, "");
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

  if (currentPuzzle !== "222") {
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

      casesInGroup.forEach(caseObj => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "case-chip";
        chip.dataset.case = caseObj.id;
        const tag = getCaseTag(caseObj.id);
        const shortLabel = getCaseShortLabel(caseObj, track);
        chip.innerHTML = `${shortLabel}<span class="case-chip-dot tag-dot-${tag}"></span>`;
        chip.title = `Case ${caseObj.name || caseObj.id} (${tag}) · Click to toggle practice, Right-click to change tag`;
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
      chip.title = `Case ${caseObj.id} (${tag}) · Click to toggle practice, Right-click to change tag`;
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
    chip.title = `Case ${id} (${tag}) · Click to toggle practice, Right-click to change tag`;
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
  });
});

function renderSelection() {
  const track = getTrack(currentPuzzle, currentTrackId);
  const totalCases = track && track.cases.length > 0 ? track.cases.length : CASE_IDS.length;
  selectionCount.textContent = `${selectedCases.size} / ${totalCases} cases`;

  casePicker.querySelectorAll(".case-chip").forEach(chip => {
    chip.setAttribute("aria-pressed", String(selectedCases.has(chip.dataset.case)));
  });

  casePicker.querySelectorAll(".group-toggle").forEach(btn => {
    const group = btn.dataset.group;
    const casesInGroup = track && track.cases.length > 0
      ? track.cases.filter(c => c.group === group)
      : (casesByGroup[group] || []);
    const ids = casesInGroup.map(c => c.id);
    const selected = ids.filter(id => selectedCases.has(id)).length;
    const state = selected === 0 ? "none" : selected === ids.length ? "all" : "some";
    btn.dataset.state = state;
    btn.setAttribute("aria-pressed", state === "all" ? "true" : state === "none" ? "false" : "mixed");
  });
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
  const track = getTrack(currentPuzzle, currentTrackId);
  const casesInGroup = track && track.cases.length > 0
    ? track.cases.filter(c => c.group === group)
    : (casesByGroup[group] || []);
  const ids = casesInGroup.map(c => c.id);
  const allSelected = ids.every(id => selectedCases.has(id));
  const next = new Set(selectedCases);
  ids.forEach(id => (allSelected ? next.delete(id) : next.add(id)));
  setSelection(next);
}

function toggleCase(id) {
  const next = new Set(selectedCases);
  if (next.has(id)) {
    next.delete(id);
  } else {
    next.add(id);
  }
  setSelection(next);
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
// Collapsible settings (narrow screens); always open in the wide sidebar
// ---------------------------------------------------------------------------

const wideLayout = window.matchMedia("(min-width: 900px)");

function syncSettingsPanel() {
  const collapsed = settingsCollapsed && !wideLayout.matches;
  settingsPanel.classList.toggle("collapsed", collapsed);
  settingsToggle.setAttribute("aria-expanded", String(!collapsed));
  settingsToggle.tabIndex = wideLayout.matches ? -1 : 0;
}

settingsToggle.addEventListener("click", () => {
  settingsCollapsed = !settingsCollapsed;
  syncSettingsPanel();
});

if (typeof wideLayout.addEventListener === "function") {
  wideLayout.addEventListener("change", syncSettingsPanel);
} else if (typeof wideLayout.addListener === "function") {
  wideLayout.addListener(syncSettingsPanel);
}

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
  const toggleDark = document.getElementById("toggleDarkMode");
  if (toggleDark) {
    toggleDark.setAttribute("aria-pressed", String(darkMode));
  }
  document.getElementById("toggleAlwaysWhiteBottom").setAttribute("aria-pressed", String(alwaysWhiteBottom));
  document.getElementById("toggleAllowAUF").setAttribute("aria-pressed", String(allowAUF));
  const toggleReflect = document.getElementById("toggleShowReflection");
  if (toggleReflect) {
    toggleReflect.setAttribute("aria-pressed", String(showReflection));
  }
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

  if (currentPuzzle === "333" || currentPuzzle === "333oh") {
    const isOh = currentPuzzle === "333oh";
    const gen333 = isOh ? generateWca3x3OhScramble : generateWca3x3Scramble;
    if (mode === "solve") {
      if (solveTarget === "full" || solveTarget === "cross") {
        gen333().then(wcaScr => {
          currentSolveScramble = wcaScr;
          scrambleMoves = wcaScr;
          scramble = wcaScr;
          currentCaseId = null;
          applyScrambleToDisplay(wcaScr);
          if (solveScrambleText) solveScrambleText.textContent = wcaScr;
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
        currentSolveScramble = scr;
        scrambleMoves = scr;
        scramble = scr;
        currentCaseId = c.id;
        const displayScr = alwaysWhiteBottom ? `z2 ${scr}` : scr;
        applyScrambleToDisplay(displayScr);
        if (solveScrambleText) solveScrambleText.textContent = scr;
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
        currentSolveScramble = scr;
        scrambleMoves = scr;
        scramble = scr;
        currentCaseId = c.id;
        const displayScr = alwaysWhiteBottom ? `z2 ${scr}` : scr;
        applyScrambleToDisplay(displayScr);
        if (solveScrambleText) solveScrambleText.textContent = scr;
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
        currentSolveScramble = scr;
        scrambleMoves = scr;
        scramble = scr;
        currentCaseId = c.id;
        const displayScr = alwaysWhiteBottom ? `z2 ${scr}` : scr;
        applyScrambleToDisplay(displayScr);
        if (solveScrambleText) solveScrambleText.textContent = scr;
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
        currentSolveScramble = scr;
        if (solveScrambleText) solveScrambleText.textContent = scr;
        if (solveScrambleOrient) solveScrambleOrient.textContent = is333Case ? "(white on bottom)" : "(WCA orientation)";
        updateCrossSolutions(scr);
      }
    } else {
      gen333().then(wcaScr => {
        scramble = wcaScr;
        scrambleMoves = wcaScr;
        currentSolveScramble = wcaScr;
        applyScrambleToDisplay(wcaScr);
        if (solveScrambleText) solveScrambleText.textContent = wcaScr;
        if (mode === "solve") updateCrossSolutions(wcaScr);
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
      currentSolveScramble = scr;
      scrambleMoves = scr;
      scramble = scr;
      currentCaseId = c.id;
      applyScrambleToDisplay(scr);
      if (solveScrambleText) solveScrambleText.textContent = scr;
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
        currentSolveScramble = wcaScr;
        scrambleMoves = wcaScr;
        scramble = wcaScr;
        currentCaseId = null;
        applyScrambleToDisplay(wcaScr);
        if (solveScrambleText) solveScrambleText.textContent = wcaScr;
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
      currentSolveScramble = scr;
      scrambleMoves = scr;
      scramble = scr;
      currentCaseId = c.id;
      applyScrambleToDisplay(scr);
      if (solveScrambleText) solveScrambleText.textContent = scr;
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
        currentSolveScramble = wcaScr;
        scrambleMoves = wcaScr;
        scramble = wcaScr;
        currentCaseId = null;
        applyScrambleToDisplay(wcaScr);
        if (solveScrambleText) solveScrambleText.textContent = wcaScr;
      });
      resetGuessingUI();
      updateStatsTable();
      return;
    }
  }

  if (mode === "solve" && solveTarget !== "cll") {
    generateWca2x2Scramble().then(wcaScr => {
      currentSolveScramble = wcaScr;
      scrambleMoves = wcaScr;
      scramble = wcaScr;
      currentCaseId = null;
      applyScrambleToDisplay(wcaScr);
      if (solveScrambleText) solveScrambleText.textContent = wcaScr;
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
      currentSolveScramble = scrambleMoves;
      if (solveScrambleText) solveScrambleText.textContent = scrambleMoves;
      updateLayerSolutions(scrambleMoves);
    }
  } else {
    currentCaseId = null;
    currentCaseScramble = null;
    scramble = "";
    scrambleMoves = "";
    currentSolveScramble = "";
    applyScrambleToDisplay("");
    if (solveScrambleText) solveScrambleText.textContent = "";
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
    if (statsType !== "cll" && statsType !== "recog") {
      statsType = "log";
    }
  } else {
    statsType = "recog";
  }
  saveSettings();
  renderStage();
  renderStatsToggle();
  updateStatsTable();

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
    if (practiceView) practiceView.render();
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
    stage.classList.toggle("solve-cube-hidden", hideCubeInSolve);
    stage.dataset.solveSize = solveWidgetSize;
  }
  solveScramble.hidden = !solving;
  solveSurface.hidden = !solving;
  solveTimes.hidden = !solving;
  if (layerSolutionsWidget) {
    layerSolutionsWidget.hidden = !solving || currentPuzzle !== "222";
  }
  if (crossSolutionsWidget) {
    crossSolutionsWidget.hidden = !solving || (currentPuzzle !== "333" && currentPuzzle !== "333oh");
  }
  if (solving) renderSolvePanel();
}

function updateCaseInfoDisplay() {
  const caseObj = currentCaseId ? caseById.get(currentCaseId) : null;
  if (mode === "study" && caseObj) {
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
    <div class="solve-stat-item">
      <span class="solve-stat-val">${fmt(mean)}</span>
      <span class="solve-stat-lbl">Mean (${solvesList.length})</span>
    </div>
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
    saveSettings();
    if (layerSolutionsWidget && (solveTarget === "layer" || solveTarget === "face")) {
      layerSolutionsWidget.open = true;
    }
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

function renderSolvePanel() {
  populateSessionSelect();
  const currentSess = getActiveSession();
  solves = currentSess.solves || [];

  if (solveTargetSelect) solveTargetSelect.value = solveTarget;
  if (solveShowCubeToggle) solveShowCubeToggle.checked = solveShowCube;
  if (solveInspectionToggle) solveInspectionToggle.checked = solveInspection;

  const currentScr = scrambleMoves || currentSolveScramble || scramble;
  solveScrambleText.textContent = currentScr;
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
    solveTimeEl.textContent = formatSolveDisplay(lastSolve);
    if (lastSolve.id && caseById.has(lastSolve.id)) {
      const caseObj = caseById.get(lastSolve.id);
      solveCaseEl.innerHTML = `<strong>${lastSolve.id}</strong> · ${getCllCaseSolutionDisplay(caseObj)} · opposite ${caseObj.opposite}`;
    } else {
      const targetLabel = lastSolve.target === "layer" ? "1st Layer" : (lastSolve.target === "face" ? "1st Face" : "Full Solve");
      solveCaseEl.innerHTML = `<strong>${targetLabel}</strong> · ${formatSolveDisplay(lastSolve)}`;
    }
  } else {
    solveTimeEl.textContent = "0.00";
    solveCaseEl.textContent = solveInspection
      ? "Scramble cube, then inspect & start timer."
      : "Scramble cube, then hold to arm & start timer.";
  }

  const keyHint = solveSurface.querySelector(".solve-hint-key");
  const touchHint = solveSurface.querySelector(".solve-hint-touch");
  if (keyHint) {
    keyHint.innerHTML = solveInspection
      ? "Space to inspect &bull; Hold Space to arm &bull; Release to start"
      : "Hold Space to arm &bull; Release to start &bull; any key to stop";
  }
  if (touchHint) {
    touchHint.innerHTML = solveInspection
      ? "Tap to inspect &bull; Hold to arm &bull; Release to start"
      : "Tap and hold to arm &bull; Release to start";
  }

  if (solves.length) {
    const valid = solves.filter(s => s.penalty !== "DNF").map(s => (s.penalty === "+2" ? s.ms + 2000 : s.ms));
    const best = valid.length ? Math.min(...valid) : null;
    const mean = valid.length ? Math.round(valid.reduce((sum, x) => sum + x, 0) / valid.length) : null;
    solveSummaryEl.textContent = `${solves.length} solve${solves.length === 1 ? "" : "s"} · best ${best != null ? formatSolveTime(best) : "-"} · mean ${mean != null ? formatSolveTime(mean) : "-"}`;
  } else {
    solveSummaryEl.textContent = "No times in this session yet";
  }
  clearSolvesBtn.hidden = solves.length === 0;

  renderSolveStatsBar(solveStatsBar, solves);

  const recent = solves.map((solve, index) => ({ solve, index })).slice(-15).reverse();
  solveList.innerHTML = recent
    .map(({ solve, index }) => `
      <button type="button" class="solve-chip" data-index="${index}" title="Solve #${index + 1}: ${formatSolveDisplay(solve)} ${solve.id ? `(${solve.id})` : ''} (Click to view details, × to delete)">
        <span class="solve-chip-time">${formatSolveDisplay(solve)}</span>
        ${solve.id ? `<span class="solve-chip-id">${solve.id}</span>` : ''}
        <span class="solve-chip-del" aria-label="Delete solve">&times;</span>
      </button>
    `.trim())
    .join("");

  if (layerSolutionsWidget) {
    layerSolutionsWidget.hidden = mode !== "solve" || currentPuzzle !== "222";
    if (!layerSolutionsWidget.hidden) {
      updateFaceChipsUI();
    }
  }
  if (crossSolutionsWidget) {
    crossSolutionsWidget.hidden = mode !== "solve" || currentPuzzle !== "333";
  }
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
  solveOverlayHint.textContent = "Hold Space when ready · Esc to cancel";

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
      solveOverlayHint.textContent = "+2 penalty · Hold Space when ready";
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

function startSolve() {
  if (solveState !== "armed") return;
  solveState = "running";
  clearInterval(solveInspectionInterval);

  solveOverlay.className = "solve-overlay";
  if (solveOverlayCancelBtn) solveOverlayCancelBtn.hidden = true;
  solveOverlayHint.textContent = solvePenalty === "+2"
    ? "Running (+2 penalty) · Any key or tap to stop"
    : (solvePenalty === "DNF" ? "Running (DNF) · Any key or tap to stop" : "Any key or tap to stop");

  solveStart = performance.now();
  const tick = () => {
    if (solveState !== "running") return;
    solveOverlayTime.textContent = formatSolveTime(performance.now() - solveStart);
    solveRaf = requestAnimationFrame(tick);
  };
  tick();
}

function stopSolve(byPointer) {
  if (solveState !== "running") return;
  const rawMs = performance.now() - solveStart;
  solveState = "idle";
  cancelAnimationFrame(solveRaf);
  clearInterval(solveInspectionInterval);

  let finalMs = Math.round(rawMs);
  if (solvePenalty === "+2") {
    finalMs += 2000;
  }

  const scr = scrambleMoves || currentSolveScramble || scramble;
  const isCaseTarget = ["cll", "pll", "oll", "f2l", "ortega"].includes(solveTarget);
  lastSolve = {
    puzzle: currentPuzzle,
    track: currentTrackId,
    target: solveTarget,
    id: isCaseTarget ? (currentCaseId || null) : null,
    ms: finalMs,
    rawMs: Math.round(rawMs),
    penalty: solvePenalty,
    at: Date.now(),
    scramble: scr
  };
  solves.push(lastSolve);
  if (solves.length > MAX_SOLVES) solves.splice(0, solves.length - MAX_SOLVES);
  saveSolves();

  solveOverlayTime.textContent = formatSolveDisplay(lastSolve);

  if (byPointer) {
    overlayHideOnPointerUp = true;
    setTimeout(() => { if (overlayHideOnPointerUp) hideSolveOverlay(); }, 500);
  } else {
    hideSolveOverlay();
  }

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
  cancelAnimationFrame(solveRaf);
  clearInterval(solveInspectionInterval);
  clearTimeout(solveArmTimeout);
  solvePenalty = null;
  hideSolveOverlay();
  renderSolvePanel();
}

function reattemptScramble(scrambleStr, label = "") {
  if (!scrambleStr) return;
  setMode("solve");
  currentSolveScramble = scrambleStr;
  scrambleMoves = scrambleStr;
  scramble = scrambleStr;
  currentCaseId = null;
  solveScrambleSource = `Loaded scramble from <strong>${escapeHtml(label || 'previous solve')}</strong> · Ready to inspect &amp; start`;
  if (solveScrambleText) solveScrambleText.textContent = scrambleStr;
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

function updateLayerSolutions(scrambleStr) {
  if (!scrambleStr) {
    if (layerSolutionsList) {
      layerSolutionsList.innerHTML = '<p class="layer-solutions-empty">No scramble loaded.</p>';
    }
    if (layerSolutionsBadge) layerSolutionsBadge.textContent = "";
    return;
  }
  const facesKey = [...layerTargetFaces].sort().join(",");
  currentLayerSolutionsScramble = scrambleStr;
  currentLayerSolutionsFacesKey = facesKey;
  if (layerSolutionsBadge) layerSolutionsBadge.textContent = "searching...";
  if (layerSolutionsList) {
    const facesDesc = layerTargetFaces.length === 6 ? 'all 6 faces' : layerTargetFaces.map(f => capitalize(f)).join('/');
    const targetName = solveTarget === "face" ? "1st face" : "1st layer";
    layerSolutionsList.innerHTML = `<p class="layer-solutions-empty">Searching for ${escapeHtml(facesDesc)} ${targetName} solutions...</p>`;
  }

  setTimeout(async () => {
    if (currentLayerSolutionsScramble !== scrambleStr || currentLayerSolutionsFacesKey !== facesKey) return;
    try {
      const sols = await findLayerSolutions(scrambleStr, layerTargetFaces, 5);
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
  const targetName = solveTarget === "face" ? "1st face" : "1st layer";
  if (!sols || sols.length === 0) {
    const facesDesc = layerTargetFaces.length === 6 ? 'selected faces' : layerTargetFaces.map(f => capitalize(f)).join(', ');
    layerSolutionsList.innerHTML = `<p class="layer-solutions-empty">No ${targetName} solutions found for ${escapeHtml(facesDesc)} within 6 moves.</p>`;
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
    const isSolved = sol.caseId === "Solved";
    const caseBadgeClass = isSolved ? "badge-solved" : "badge-case";
    const caseLabel = isSolved ? "Leaves Solved" : (sol.caseId === "PBL" ? "Leaves PBL" : `Leaves ${sol.caseId}`);
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
      const base = currentSolveScramble || scrambleMoves || scramble;
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

function updateCrossSolutions(scrambleStr) {
  if (!crossSolutionsList) return;
  if (!scrambleStr) {
    crossSolutionsList.innerHTML = '<p class="layer-solutions-empty">No scramble loaded.</p>';
    if (crossSolutionsBadge) crossSolutionsBadge.textContent = "";
    if (crossEoSummary) crossEoSummary.innerHTML = "";
    return;
  }
  currentCrossSolutionsScramble = scrambleStr;
  if (crossSolutionsBadge) crossSolutionsBadge.textContent = "analyzing...";
  crossSolutionsList.innerHTML = '<p class="layer-solutions-empty">Searching for optimal White cross &amp; Cross+1 / EO solutions...</p>';

  setTimeout(async () => {
    if (currentCrossSolutionsScramble !== scrambleStr) return;
    try {
      const result = await findCrossSolutions(scrambleStr, 8);
      if (currentCrossSolutionsScramble !== scrambleStr) return;
      renderCrossSolutions(result);
    } catch (err) {
      console.error("Error solving white cross:", err);
      crossSolutionsList.innerHTML = '<p class="layer-solutions-empty">Error calculating cross solutions.</p>';
      if (crossSolutionsBadge) crossSolutionsBadge.textContent = "error";
    }
  }, 10);
}

function renderCrossSolutions(result) {
  if (!crossSolutionsList) return;
  const sols = Array.isArray(result) ? result : (result?.solutions || []);
  if (!sols || sols.length === 0) {
    crossSolutionsList.innerHTML = '<p class="layer-solutions-empty">No White cross solutions found within depth.</p>';
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
    const inspText = sol.insp && sol.insp !== "none" ? sol.insp : "none";
    const cross1Badges = sol.crossPlus1 && sol.crossPlus1.hasPair
      ? `<span class="badge ${sol.crossPlus1.type === 'solved' ? 'badge-solved' : 'chip-cross1'}" title="${escapeHtml(sol.crossPlus1.description)}">Cross+1: ${sol.crossPlus1.slot} (${sol.crossPlus1.type})</span>`
      : "";

    return `
      <div class="layer-sol-row">
        <div class="layer-sol-info">
          <div class="layer-sol-badges">
            <span class="face-badge face-badge-white">White Cross</span>
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
        expectedCase: { id: `White Cross (${sol.moveCount}m)`, solution: solMoves, solutionAlg: solMoves, isLayer: true },
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
        `White Cross: ${sol.moves} (${sol.moveCount} moves)`,
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
  if (e.target.closest("button") || e.target.closest("input") || e.target.closest("label") || e.target.closest("select")) return;
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
      tagBadge.className = `ov-tag-badge tag-${currentTag}`;
      tagBadge.textContent = currentTag;
      tagBadge.title = `Status: ${currentTag} · Click to cycle`;
      tagBadge.addEventListener("click", () => {
        cycleCaseTag(caseObj.id);
        const newTag = getCaseTag(caseObj.id);
        tagBadge.className = `ov-tag-badge tag-${newTag}`;
        tagBadge.textContent = newTag;
        tagBadge.title = `Status: ${newTag} · Click to cycle`;
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

  if (settingsDarkTheme) settingsDarkTheme.checked = darkMode;
  if (settingsAlwaysWhiteBottom) settingsAlwaysWhiteBottom.checked = alwaysWhiteBottom;
  if (settingsAllowAUF) settingsAllowAUF.checked = allowAUF;
  if (settingsShowReflection) settingsShowReflection.checked = showReflection;

  settingsModal.hidden = false;
  document.documentElement.classList.add("overview-open");
  settingsModalCloseBtn?.focus();
}

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
    title.textContent = `Stats — ${pName} ${tName}`;
  }
  const statsTabCll = document.getElementById("statsTabCll");
  if (statsTabCll) {
    statsTabCll.textContent = `${tName} Solves`;
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

    html += '<table><thead><tr><th scope="col">Group</th>';
    caseNumbers.forEach(c => {
      html += `<th scope="col">${c}</th>`;
    });
    html += '<th scope="col">Total</th><th scope="col">Acc%</th></tr></thead><tbody>';

    let overallShown = 0;
    let overallCorrect = 0;

    GROUP_DISPLAY_ORDER.forEach(group => {
      html += `<tr><th scope="row">${group}</th>`;

      let grpShown = 0;
      let grpCorrect = 0;

      caseNumbers.forEach(caseNum => {
        const caseId = `${group}${caseNum}`;
        if (!caseById.has(caseId)) {
          html += '<td></td>';
          return;
        }
        const stat = getCaseStat("222", "cll", caseId);
        const correct = stat ? stat.correct : 0;
        const shown = stat ? stat.shown : 0;
        grpShown += shown;
        grpCorrect += correct;
        html += `<td title="${caseId}: ${correct}/${shown}">${correct}/${shown}</td>`;
      });

      overallShown += grpShown;
      overallCorrect += grpCorrect;

      const grpPct = grpShown > 0 ? Math.round((grpCorrect / grpShown) * 100) + '%' : '-';
      html += `<td class="total">${grpCorrect}/${grpShown}</td><td class="total">${grpPct}</td></tr>`;
    });

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
      let rowsHtml = '';

      groupCases.forEach(c => {
        const stat = getCaseStat(currentPuzzle, currentTrackId, c.id);
        const shown = stat.shown || 0;
        const correct = stat.correct || 0;
        gShown += shown;
        gCorrect += correct;
        const pct = shown > 0 ? Math.round((correct / shown) * 100) : null;
        const badgeClass = shown === 0 ? 'badge' : (pct >= 90 ? 'badge badge-green' : pct >= 70 ? 'badge badge-yellow' : 'badge badge-red');

        rowsHtml += `
          <tr>
            <th scope="row"><strong>${escapeHtml(c.id)}</strong></th>
            <td>${escapeHtml(c.name || c.id)}</td>
            <td>${correct} / ${shown}</td>
            <td><span class="${badgeClass}">${pct != null ? pct + '%' : 'untested'}</span></td>
          </tr>
        `;
      });

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
                <th scope="col" style="width: 70px;">Case</th>
                <th scope="col">Name</th>
                <th scope="col" style="width: 100px;">Recognition</th>
                <th scope="col" style="width: 80px;">Accuracy</th>
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
}

function renderSolveStatsTable() {
  const container = document.getElementById("stats-table-container");
  if (!container) return;

  const track = getTrack(currentPuzzle, currentTrackId);
  const trackCases = track?.cases || [];
  const trackCaseIds = trackCases.map(c => c.id);
  const caseMap = track?.caseById || new Map();

  const currentSess = getActiveSession();
  const currentSolves = currentSess.solves || [];

  const caseSolves = new Map();
  for (const s of currentSolves) {
    const isTrackMatch = s.track ? (s.track === currentTrackId) : true;
    if (s.id && trackCaseIds.includes(s.id) && isTrackMatch) {
      if (!caseSolves.has(s.id)) {
        caseSolves.set(s.id, []);
      }
      const timeVal = (s.penalty === "+2" || s.penalty === 2)
        ? ((s.ms ?? s.time) + 2000)
        : ((s.penalty === "DNF" || s.penalty === -1) ? Infinity : (s.ms ?? s.time));
      if (Number.isFinite(timeVal)) {
        caseSolves.get(s.id).push(timeVal);
      }
    }
  }

  const casesWithTimes = trackCaseIds.filter(id => caseSolves.has(id));

  const sortCols = [
    { key: "case", label: "Case" },
    { key: "name", label: "Name / Group" },
    { key: "attempts", label: "Attempts" },
    { key: "best", label: "Best", title: "Best time" },
    { key: "mean", label: "Mean", title: "Mean time" },
    { key: "median", label: "Median", title: "Median time" },
    { key: "worst", label: "Worst", title: "Worst time" }
  ];

  let html = '<table class="solve-stats-table"><thead><tr>';
  sortCols.forEach(col => {
    const isSorted = solveStatsSort.col === col.key;
    const arrow = isSorted ? (solveStatsSort.dir === "asc" ? " ▲" : " ▼") : "";
    html += `<th scope="col" class="sortable" data-sort="${col.key}" title="${col.title || ('Sort by ' + col.label)}">${col.label}<span class="sort-icon">${arrow}</span></th>`;
  });
  html += '</tr></thead><tbody>';

  if (casesWithTimes.length === 0) {
    html += `<tr><td colspan="7" class="empty-stats" style="padding: 24px 12px; text-align: center;">
      <p style="margin-bottom: 4px; font-weight: 600;">No ${escapeHtml(track?.shortName || '')} case solves recorded in session "${escapeHtml(currentSess.name)}".</p>
      <p style="font-size: 0.85rem; color: var(--muted); margin: 0;">Time solves with Target set to <strong>${escapeHtml(track?.shortName || '')}</strong> in the Solve tab to build per-case statistics.</p>
    </td></tr></tbody></table>`;
    container.innerHTML = html;
    attachSortListeners(container);
    return;
  }

  const caseStatsList = casesWithTimes.map(id => {
    const times = caseSolves.get(id);
    const attempts = times.length;
    const best = Math.min(...times);
    const worst = Math.max(...times);
    const mean = Math.round(times.reduce((sum, t) => sum + t, 0) / attempts);
    const sorted = [...times].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 !== 0 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
    const caseObj = caseMap.get(id);
    const name = caseObj ? (caseObj.name || caseObj.group || id) : id;
    return { id, name, attempts, best, worst, mean, median };
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
    html += `<tr>
      <th scope="row"><strong>${escapeHtml(stat.id)}</strong></th>
      <td style="color: var(--muted); font-size: 0.85rem;">${escapeHtml(stat.name)}</td>
      <td>${stat.attempts}</td>
      <td>${formatSolveTime(stat.best)}</td>
      <td>${formatSolveTime(stat.mean)}</td>
      <td>${formatSolveTime(stat.median)}</td>
      <td>${formatSolveTime(stat.worst)}</td>
    </tr>`;
  });

  html += '</tbody>';

  if (caseStatsList.length > 1) {
    const allTimes = [];
    casesWithTimes.forEach(id => {
      const times = caseSolves.get(id);
      if (times) allTimes.push(...times);
    });
    const totalAttempts = allTimes.length;
    const overallBest = allTimes.length ? Math.min(...allTimes) : 0;
    const overallWorst = allTimes.length ? Math.max(...allTimes) : 0;
    const overallMean = allTimes.length ? Math.round(allTimes.reduce((sum, t) => sum + t, 0) / totalAttempts) : 0;
    const sortedAll = [...allTimes].sort((a, b) => a - b);
    const midAll = Math.floor(sortedAll.length / 2);
    const overallMedian = sortedAll.length % 2 !== 0 ? sortedAll[midAll] : Math.round((sortedAll[midAll - 1] + sortedAll[midAll]) / 2);

    html += `<tfoot><tr>
      <th scope="row">Total</th>
      <td style="color: var(--muted); font-size: 0.85rem;">${caseStatsList.length} cases</td>
      <td>${totalAttempts}</td>
      <td>${formatSolveTime(overallBest)}</td>
      <td>${formatSolveTime(overallMean)}</td>
      <td>${formatSolveTime(overallMedian)}</td>
      <td>${formatSolveTime(overallWorst)}</td>
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
        solveStatsSort.dir = (col === "case" || col === "name" || col === "best" || col === "mean" || col === "median" || col === "worst") ? "asc" : "desc";
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
  const month = d.toLocaleDateString(undefined, { month: 'short' });
  const day = d.getDate();
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return `${month} ${day}, ${time}`;
}

function calculateMedian(arr) {
  if (!arr.length) return null;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

function renderSessionLogTable() {
  const container = document.getElementById("stats-table-container");
  if (!container) return;

  const sess = getActiveSession();
  const sessSolves = sess.solves || [];

  if (sessSolves.length === 0) {
    container.innerHTML = `
      <div class="empty-stats" style="text-align: center; padding: 24px;">
        <p>No solves recorded in <strong>${escapeHtml(sess.name)}</strong> yet.</p>
        <p style="color: var(--muted); font-size: 0.9rem;">Time your solves in the <strong>Solve</strong> tab to build your session history and averages.</p>
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

  const validTimes = displaySolves.filter(s => s.penalty !== "DNF" && s.penalty !== -1).map(s => {
    const ms = s.ms ?? s.time ?? 0;
    return (s.penalty === "+2" || s.penalty === 2) ? ms + 2000 : ms;
  });

  const count = displaySolves.length;
  const best = validTimes.length ? Math.min(...validTimes) : null;
  const mean = validTimes.length ? Math.round(validTimes.reduce((a, b) => a + b, 0) / validTimes.length) : null;
  const median = validTimes.length ? calculateMedian(validTimes) : null;
  const worst = validTimes.length ? Math.max(...validTimes) : null;
  const curAo5 = calculateAoN(displaySolves, 5);
  const bestAo5 = getBestAoN(displaySolves, 5);
  const curAo12 = calculateAoN(displaySolves, 12);
  const bestAo12 = getBestAoN(displaySolves, 12);
  const curAo100 = calculateAoN(displaySolves, 100);
  const bestAo100 = getBestAoN(displaySolves, 100);

  const formatAo = (val) => val === "DNF" ? "DNF" : (val != null ? formatSolveTime(val) : "-");

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
      <div class="layer-stat-card">
        <span class="layer-stat-val">${mean != null ? formatSolveTime(mean) : "-"}</span>
        <span class="layer-stat-lbl">Mean</span>
      </div>
      <div class="layer-stat-card">
        <span class="layer-stat-val">${median != null ? formatSolveTime(median) : "-"}</span>
        <span class="layer-stat-lbl">Median</span>
      </div>
      <div class="layer-stat-card">
        <span class="layer-stat-val">${worst != null ? formatSolveTime(worst) : "-"}</span>
        <span class="layer-stat-lbl">Worst</span>
      </div>
  `;

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

  // Solve Log Header and Table
  html += `
    <div class="layer-log-header">
      <div class="layer-log-title-wrap">
        <h3 class="layer-log-title">Solve Log &mdash; ${escapeHtml(sess.name)}</h3>
        <span class="layer-log-hint">Tap any row for details</span>
      </div>
      <span class="layer-log-count">${count} solve${count === 1 ? '' : 's'} recorded</span>
    </div>
    <table class="layer-log-table">
      <thead>
        <tr>
          <th scope="col" style="width: 44px;">#</th>
          <th scope="col">Time</th>
          <th scope="col">Target</th>
          <th scope="col">Date</th>
          <th scope="col" style="width: 76px;">Actions</th>
        </tr>
      </thead>
      <tbody>
  `;

  if (displaySolves.length === 0) {
    html += `<tr><td colspan="5" class="empty-stats" style="text-align: center; padding: 20px;">No solves match filter "${escapeHtml(sessionLogFilter)}".</td></tr>`;
  } else {
    // Reverse chronological (newest at top)
    const rows = [...displaySolves].map((s, idx) => ({ s, num: idx + 1, origIdx: sessSolves.indexOf(s) })).reverse();
    rows.forEach(({ s, num, origIdx }) => {
      let targetLabel = "Full";
      let targetClass = "badge";
      if (s.id) {
        targetLabel = s.id;
        targetClass = "badge badge-case";
      } else if (s.target === "layer") {
        targetLabel = "1st Layer";
      } else if (s.target === "face") {
        targetLabel = "1st Face";
      } else if (s.target === "cross") {
        targetLabel = "White Cross";
      } else if (s.target === "pll") {
        targetLabel = "PLL";
      } else if (s.target === "oll") {
        targetLabel = "OLL";
      } else if (s.target === "f2l") {
        targetLabel = "F2L";
      } else if (s.target === "cll") {
        targetLabel = "CLL";
      } else if (s.target === "full") {
        targetLabel = (s.puzzle === "333" || currentPuzzle === "333") ? "3x3 Full" : "2x2 Full";
      }
      const dateStr = formatSolveDate(s.at);

      html += `
        <tr class="layer-log-row" data-index="${origIdx}" data-num="${num}" title="Click to view details &amp; scramble">
          <td>${num}</td>
          <td class="layer-time-cell">${formatSolveDisplay(s)}</td>
          <td><span class="${targetClass}">${escapeHtml(targetLabel)}</span></td>
          <td class="layer-date-cell">${dateStr}</td>
          <td>
            <div class="layer-log-actions">
              <button type="button" class="btn-reattempt-solve" data-index="${origIdx}" data-num="${num}" title="Reattempt solve #${num} scramble">&#x21bb;</button>
              <button type="button" class="btn-del-solve" data-index="${origIdx}" data-num="${num}" title="Delete solve #${num} (${formatSolveDisplay(s)})">&times;</button>
            </div>
          </td>
        </tr>
      `;
    });
  }

  html += `</tbody></table>`;
  container.innerHTML = html;

  // Attach subfilter button listeners
  container.querySelector("#sessionLogExportCsvBtn")?.addEventListener("click", handleExportCSV);
  container.querySelectorAll(".stats-subfilter-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      sessionLogFilter = btn.dataset.logFilter || "all";
      renderSessionLogTable();
    });
  });

  // Attach row click listeners to show details popup
  container.querySelectorAll(".layer-log-row").forEach(row => {
    row.addEventListener("click", (e) => {
      if (e.target.closest(".btn-del-solve") || e.target.closest(".btn-reattempt-solve")) return;
      const index = Number(row.dataset.index);
      const num = row.dataset.num;
      const solve = sessSolves[index];
      if (solve) {
        openSolveDetailModal(solve, num);
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
// Solve Details Modal (Popup for Scramble & Date)
// ---------------------------------------------------------------------------

let activeModalSolve = null;

function formatFullSolveDate(timestamp) {
  if (!timestamp) return "-";
  const d = new Date(timestamp);
  return d.toLocaleString(undefined, {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
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

buildCasePicker();
applyTheme();
renderToggles();
renderMinutes();
syncSettingsPanel();
syncStatsPanel();
renderStatsToggle();
populateSimCaseSelect();
updateFaceChipsUI();
regenerateScramble();
if (mode === "simulate") {
  simInit();
}
