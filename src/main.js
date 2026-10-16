import { ScrambleDisplay } from 'scramble-display';
import { puzzles } from 'cubing/puzzles';
import { randomScrambleForEvent } from 'cubing/scramble';
import { findLayerSolutions } from './layerSolver.js';
import { Alg } from 'cubing/alg';
import { cllCases } from './casesData.js';
import { pblCases, pblCaseById } from './pblData.js';
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

const savedSettings = readJSON(SETTINGS_KEY) || {};

let selectedCases = new Set(
  Array.isArray(savedSettings.selected)
    ? savedSettings.selected.filter(id => caseById.has(id))
    : CASE_IDS
);
let alwaysWhiteBottom = savedSettings.alwaysWhiteBottom ?? true;
let allowAUF = savedSettings.allowAUF ?? true;
let showReflection = savedSettings.showReflection ?? true;
let statsCollapsed = savedSettings.statsCollapsed ?? false;
let layerUseInspection = savedSettings.layerUseInspection ?? true;
let layerTargetFaces = Array.isArray(savedSettings.layerTargetFaces) && savedSettings.layerTargetFaces.length
  ? savedSettings.layerTargetFaces
  : ["white"];
let statsType = (savedSettings.mode === "layer" || savedSettings.statsType === "layer")
  ? "layer"
  : ((savedSettings.mode === "solve" || savedSettings.statsType === "solve")
    ? "solve"
    : (savedSettings.statsType || "layer"));
let solveStatsSort = { col: "case", dir: "asc" };

// Modes: layer, study, practice, timed, solve, simulate
const MODES = ["layer", "study", "practice", "timed", "solve", "simulate"];
let mode = MODES.includes(savedSettings.mode)
  ? savedSettings.mode
  : "layer";
let timedMinutes = clampMinutes(savedSettings.timedMinutes ?? 3);

let session = null;        // running timed session
let sessionSummary = null; // last finished session, shown until dismissed
let practiceAnswered = false;
let flashTimer = 0;

// Solve mode (stackmat-style timer): idle -> armed (key/finger held) -> running
let solveState = "idle";
let solveStart = 0;
let solveRaf = 0;
let overlayHideOnPointerUp = false;
let swallowNextClick = false;
let lastSolve = null;

// Multi-session management & storage
const DEFAULT_SESSIONS = [
  { id: "default", name: "Session 1 (Full Solve)", target: "full", inspection: true, showCube: false, solves: [] },
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

let solveTarget = savedSettings.solveTarget || getActiveSession().target || "full";
let solveShowCube = savedSettings.solveShowCube ?? getActiveSession().showCube ?? false;
let solveInspection = savedSettings.solveInspection ?? getActiveSession().inspection ?? true;

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
let guessedGroup = null;
let guessedCase = null;
let settingsCollapsed = true; // narrow screens only; the sidebar is always open

// stats[caseId] = { shown, correct }: attempts at a case and how often it was
// identified correctly (group and number). Group rows are summed from these.
let stats = readJSON(STATS_KEY) || {};
GROUPS.forEach(group => delete stats[group]); // older versions kept separate group counters

function saveStats() {
  writeJSON(STATS_KEY, stats);
}

function saveSettings() {
  writeJSON(SETTINGS_KEY, {
    selected: [...selectedCases],
    alwaysWhiteBottom,
    allowAUF,
    showReflection,
    mode,
    timedMinutes,
    statsCollapsed,
    statsType,
    layerUseInspection,
    layerTargetFaces,
    activeSessionId,
    solveTarget,
    solveShowCube,
    solveInspection
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
const statsTabRecog = document.getElementById("statsTabRecog");
const statsTabSolve = document.getElementById("statsTabSolve");
const overview = document.getElementById("overview");
const overviewBtn = document.getElementById("overviewBtn");
const overviewClose = document.getElementById("overviewClose");
const overviewBody = document.getElementById("overviewBody");
const groupButtons = Array.from(document.querySelectorAll(".group-btn"));
const caseButtons = Array.from(document.querySelectorAll(".case-btn"));
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

// 1st Layer practice elements
const layerScrambleEl = document.getElementById("layerScramble");
const layerScrambleTextEl = document.getElementById("layerScrambleText");
const layerNewScrambleBtn = document.getElementById("layerNewScrambleBtn");
const layerCustomScrambleBtn = document.getElementById("layerCustomScrambleBtn");
const layerCustomScrambleRow = document.getElementById("layerCustomScrambleRow");
const layerCustomInput = document.getElementById("layerCustomInput");
const layerCustomClearBtn = document.getElementById("layerCustomClearBtn");
const layerCustomApplyBtn = document.getElementById("layerCustomApplyBtn");
const layerCustomCancelBtn = document.getElementById("layerCustomCancelBtn");
const layerSurfaceEl = document.getElementById("layerSurface");
const layerInspectionToggle = document.getElementById("layerInspectionToggle");
const layerStatusBadge = document.getElementById("layerStatusBadge");
const layerTimeEl = document.getElementById("layerTime");
const layerSubtextEl = document.getElementById("layerSubtext");
const layerTimesEl = document.getElementById("layerTimes");
const layerSummaryEl = document.getElementById("layerSummary");
const layerListEl = document.getElementById("layerList");
const clearLayerSolvesBtn = document.getElementById("clearLayerSolvesBtn");
const statsTabLayer = document.getElementById("statsTabLayer");
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
const sessionModalSaveBtn = document.getElementById("sessionModalSaveBtn");
const sessionModalCancelBtn = document.getElementById("sessionModalCancelBtn");

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
const el = new ScrambleDisplay();
el.player.hintFacelets = showReflection ? "floating" : "none";
el.event = "222";
el.visualization = "3D";
applyReflection();
displayContainer.appendChild(el);

let currentBaseDisplayScramble = "";
let userViewRotations = [];

function addViewRotation(move) {
  const axis = move[0];
  const isPrime = move.includes("'");
  const delta = isPrime ? 3 : 1;
  if (userViewRotations.length > 0) {
    const last = userViewRotations[userViewRotations.length - 1];
    if (last[0] === axis) {
      let cur = 1;
      if (last.includes("2")) cur = 2;
      else if (last.includes("'")) cur = 3;
      const next = (cur + delta) % 4;
      userViewRotations.pop();
      if (next === 1) userViewRotations.push(axis);
      else if (next === 2) userViewRotations.push(axis + "2");
      else if (next === 3) userViewRotations.push(axis + "'");
      refreshCurrentDisplayScramble();
      return;
    }
  }
  userViewRotations.push(move);
  refreshCurrentDisplayScramble();
}

function clearViewRotations() {
  userViewRotations = [];
}

function refreshCurrentDisplayScramble() {
  if (!el || !currentBaseDisplayScramble) return;
  const rotStr = userViewRotations.join(" ");
  const fullScramble = rotStr ? `${currentBaseDisplayScramble} ${rotStr}`.trim() : currentBaseDisplayScramble;
  el.scramble = fullScramble;
  if (el.player) {
    try {
      el.player.pause();
      if (el.player.experimentalModel?.catchUpMove) {
        el.player.experimentalModel.catchUpMove.set({ move: null, amount: 0 });
      }
      el.player.jumpToEnd();
    } catch (e) {}
  }
}

function applyScrambleToDisplay(scrambleString) {
  currentBaseDisplayScramble = scrambleString || "";
  refreshCurrentDisplayScramble();
}

function resetCubeOrientation() {
  clearViewRotations();
  if (!el || !el.player) return;
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
  refreshCurrentDisplayScramble();
}

if (resetOrientationBtn) {
  resetOrientationBtn.addEventListener("click", resetCubeOrientation);
}

// ---------------------------------------------------------------------------
// Case picker: one row per group, a group button plus one chip per case
// ---------------------------------------------------------------------------

function buildCasePicker() {
  casePicker.innerHTML = "";
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
  casePicker.querySelectorAll(".case-chip").forEach(chip => {
    chip.setAttribute("aria-pressed", String(selectedCases.has(chip.dataset.case)));
  });

  casePicker.querySelectorAll(".group-toggle").forEach(btn => {
    const ids = casesByGroup[btn.dataset.group].map(c => c.id);
    const selected = ids.filter(id => selectedCases.has(id)).length;
    const state = selected === 0 ? "none" : selected === ids.length ? "all" : "some";
    btn.dataset.state = state;
    btn.setAttribute("aria-pressed", state === "all" ? "true" : state === "none" ? "false" : "mixed");
  });

  selectionCount.textContent = `${selectedCases.size} / ${CASE_IDS.length} cases`;
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
  const ids = casesByGroup[group].map(c => c.id);
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
  if (currentTagFilter === "all") {
    setSelection(new Set(CASE_IDS));
  } else {
    const matching = CASE_IDS.filter(id => getCaseTag(id) === currentTagFilter);
    const next = new Set(selectedCases);
    matching.forEach(id => next.add(id));
    setSelection(next);
  }
});

document.getElementById("clearAllBtn").addEventListener("click", () => {
  if (currentTagFilter === "all") {
    setSelection(new Set());
  } else {
    const matching = CASE_IDS.filter(id => getCaseTag(id) === currentTagFilter);
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

function renderToggles() {
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
    }).catch(() => {});
  } catch (err) {
    console.warn("Could not update reflection facelets:", err);
  }
}

document.querySelectorAll(".switch").forEach(btn => {
  btn.addEventListener("click", () => {
    const key = btn.dataset.toggle;
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

function cleanAlg(algStr) {
  if (!algStr) return "";
  const cleaned = algStr.replace(/[‘’ʻʼ`]/g, "'").replace(/[()[\]{}]/g, " ").replace(/,/g, " ");
  const tokens = cleaned.trim().split(/\s+/).filter(Boolean);
  const result = [];

  for (const token of tokens) {
    const match = token.match(/^([RUFBLDxyz])(2'|'2|3'|'3|''|2"|[23'])?$/i);
    if (!match) {
      result.push(token);
      continue;
    }
    const face = ['x', 'y', 'z'].includes(match[1].toLowerCase()) ? match[1].toLowerCase() : match[1].toUpperCase();
    let mod = match[2] || "";
    if (mod === "'2" || mod === '2"' || mod === "''") mod = "2'";

    let amount = 1;
    if (mod === "'" || mod === "3") amount = 3;
    else if (mod === "2" || mod === "2'") amount = 2;
    else if (mod === "3'" || mod === "'3") amount = 1;

    if (result.length > 0) {
      const prev = result[result.length - 1];
      const prevMatch = prev.match(/^([RUFBLDxyz])(2'|'2|3'|'3|''|2"|[23'])?$/i);
      if (prevMatch && prevMatch[1].toUpperCase() === face.toUpperCase()) {
        const prevFace = ['x', 'y', 'z'].includes(prevMatch[1].toLowerCase()) ? prevMatch[1].toLowerCase() : prevMatch[1].toUpperCase();
        let prevMod = prevMatch[2] || "";
        if (prevMod === "'2" || prevMod === '2"' || prevMod === "''") prevMod = "2'";
        let prevAmount = 1;
        if (prevMod === "'" || prevMod === "3") prevAmount = 3;
        else if (prevMod === "2" || prevMod === "2'") prevAmount = 2;
        else if (prevMod === "3'" || prevMod === "'3") prevAmount = 1;

        const total = (prevAmount + amount) % 4;
        result.pop();
        if (total === 1) result.push(prevFace);
        else if (total === 2) result.push(prevFace + "2");
        else if (total === 3) result.push(prevFace + "'");
        continue;
      }
    }
    if (amount === 1) result.push(face);
    else if (amount === 2) {
      result.push(mod === "2'" ? face + "2'" : face + "2");
    }
    else if (amount === 3) result.push(face + "'");
  }
  return result.join(" ");
}

function normalizeAlgForCompare(algStr) {
  if (!algStr) return "";
  return cleanAlg(algStr).replace(/2'/g, "2");
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
  const caseObj = randomCase ? caseById.get(randomCase) : null;
  if (caseObj) {
    currentCaseId = caseObj.id;
    const caseScrambles = caseObj.scrambles && caseObj.scrambles.length ? caseObj.scrambles : [caseObj.scramble];
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
  clearViewRotations();
  const hasCases = selectedCases.size > 0;
  emptyState.hidden = hasCases;

  if (mode === "solve" && solveTarget !== "cll") {
    generateWca2x2Scramble().then(wcaScr => {
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

  if (hasCases) {
    buildScramble();
    applyScrambleToDisplay(scramble);
  } else {
    currentCaseId = null;
    currentCaseScramble = null;
    scramble = "";
    scrambleMoves = "";
    applyScrambleToDisplay("");
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

function setMode(next) {
  if (!MODES.includes(next) || next === mode) return;
  if (session) finishSession(); // leaving Timed ends a running session
  if (solveState !== "idle") cancelSolve(); // leaving Solve drops an unfinished attempt
  if (typeof cancelLayerSolve === "function" && layerState !== "idle") cancelLayerSolve();

  const leavingSimulate = mode === "simulate" && next !== "simulate";
  if (leavingSimulate) {
    simTeardown();
  }

  const leavingLayer = mode === "layer" && next !== "layer";
  if (leavingLayer) {
    if (scramble) {
      applyScrambleToDisplay(scramble);
      applyReflection();
    }
  }

  mode = next;
  resetCaseAppearances();
  if (mode === "solve") {
    statsType = "solve";
  } else if (mode === "layer") {
    statsType = "layer";
  } else {
    statsType = "recog";
  }
  saveSettings();
  renderStage();
  renderStatsToggle();
  updateStatsTable();

  if (mode === "simulate") {
    simInit();
  } else if (mode === "layer") {
    if (!layerScramble) {
      generateNewLayerScramble();
    } else {
      applyScrambleToDisplay(layerScramble);
      applyReflection();
      if (!currentLayerSolutionsScramble || currentLayerSolutionsScramble !== layerScramble) {
        updateLayerSolutions(layerScramble);
      }
    }
  } else if (mode === "study") {
    resetCubeOrientation();
    regenerateScramble();
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
  const isLayer = mode === "layer";

  simulatePanel.hidden = !simulating;
  if (simulating || isLayer) {
    emptyState.hidden = true;
    displayContainer.hidden = false;
  }

  guessingContainer.hidden = !hasCases || !(mode === "practice" || (mode === "timed" && running));
  guessLabel.hidden = mode !== "practice";
  verifyBtn.hidden = mode !== "practice" || practiceAnswered;
  verifyMessage.hidden = !(mode === "practice" && practiceAnswered);
  timedFeedback.hidden = !(running && session.lastResult);

  timedBar.hidden = !running;
  timedSetup.hidden = !(mode === "timed" && !running && !sessionSummary);
  startSessionBtn.disabled = !hasCases;
  timedSummary.hidden = !(mode === "timed" && !running && sessionSummary);

  regenerateBtn.hidden = mode === "timed" || simulating || isLayer;

  // Solve mode: show or hide cube based on solveShowCube
  const hideCubeInSolve = solving && !solveShowCube;
  cubeCard.hidden = hideCubeInSolve || (!hasCases && ["practice", "study", "timed"].includes(mode));
  if (resetOrientationBtn) {
    resetOrientationBtn.hidden = cubeCard.hidden;
  }
  solveScramble.hidden = !solving;
  solveSurface.hidden = !solving;
  solveTimes.hidden = !solving;
  if (solving) renderSolvePanel();

  // 1st layer mode
  layerScrambleEl.hidden = !isLayer;
  layerSurfaceEl.hidden = !isLayer;
  layerTimesEl.hidden = !isLayer;
  if (layerSolutionsWidget) {
    layerSolutionsWidget.hidden = !isLayer;
  }
  if (isLayer) renderLayerPanel();
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
      <div class="case-solution-row" style="display: flex; align-items: baseline; justify-content: space-between; gap: 8px;">
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
  const entry = stats[currentCaseId] ?? (stats[currentCaseId] = { shown: 0, correct: 0 });
  entry.shown++;
  if (groupCorrect && caseCorrect) entry.correct++;
  saveStats();
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
  return casesByGroup[group].reduce((totals, caseObj) => {
    const entry = stats[caseObj.id];
    if (entry) {
      totals.shown += entry.shown;
      totals.correct += entry.correct;
    }
    return totals;
  }, { shown: 0, correct: 0 });
}

function buildStatsDisplay() {
  const parts = [];
  const entry = stats[currentCaseId];
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
  if (["x", "y", "z"].includes(keyLower) && !cubeCard.hidden && solveState === "idle" && layerState === "idle") {
    const isShift = e.shiftKey;
    const move = isShift ? `${keyLower}'` : keyLower;
    addViewRotation(move);
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
      setMode("simulate");
      const activeAlg = getPblCaseSelectedAlg(caseObj);
      const baseScramble = caseObj.scramble;
      const sol = activeAlg.alg;
      const combined = `${baseScramble} ${sol}`.trim();
      simScrambleInput.value = combined;
      simOriginalScramble = baseScramble;
      simHasSolutionAppended = true;
      simAppendSolutionBtn.textContent = "Remove Solution";
      simAppendSolutionBtn.classList.add("active");
      simLoadScramble(combined, {
        expectedCase: { id: `PBL: ${caseObj.shortName || caseObj.name}`, solution: activeAlg.label || activeAlg.alg, solutionAlg: activeAlg.alg },
        isAppended: true,
        startAtSolution: true,
        originalScramble: baseScramble
      });
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
let sessionModalMode = "create"; // "create" | "rename"

function openSessionModal(mode = "create") {
  if (!sessionModal) return;
  sessionModalMode = mode;
  const current = getActiveSession();
  if (mode === "rename") {
    sessionModalTitle.textContent = "Rename Session";
    sessionNameInput.value = current.name;
    const targetField = document.getElementById("sessionTargetField");
    if (targetField) targetField.hidden = true;
  } else {
    sessionModalTitle.textContent = "New Session";
    sessionNameInput.value = `Session ${sessions.length + 1}`;
    const targetField = document.getElementById("sessionTargetField");
    if (targetField) targetField.hidden = false;
    sessionDefaultTarget.value = "full";
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
    if (sessionModalMode === "rename") {
      const sess = getActiveSession();
      sess.name = name;
      saveSessions();
    } else {
      const target = sessionDefaultTarget.value || "full";
      const newId = `session-${Date.now()}`;
      const newSession = {
        id: newId,
        name,
        target,
        inspection: true,
        showCube: target === "layer",
        solves: []
      };
      sessions.push(newSession);
      activeSessionId = newId;
      solveTarget = target;
      saveSessions();
      saveSettings();
    }
    closeSessionModal();
    populateSessionSelect();
    renderSolvePanel();
    regenerateScramble();
  });
}

function populateSessionSelect() {
  if (!solveSessionSelect) return;
  solveSessionSelect.innerHTML = sessions.map(s => {
    return `<option value="${s.id}" ${s.id === activeSessionId ? "selected" : ""}>${escapeHtml(s.name)} (${s.solves.length})</option>`;
  }).join("");
  if (solveSessionBadge) {
    solveSessionBadge.textContent = `${getActiveSession().name} (${getActiveSession().solves.length})`;
  }
}

function switchSession(sessId) {
  if (!sessions.some(s => s.id === sessId)) return;
  activeSessionId = sessId;
  const sess = getActiveSession();
  solveTarget = sess.target || "full";
  solveShowCube = sess.showCube ?? false;
  solveInspection = sess.inspection ?? true;
  solves = sess.solves || [];
  lastSolve = solves.length ? solves[solves.length - 1] : null;

  if (solveTargetSelect) solveTargetSelect.value = solveTarget;
  if (solveShowCubeToggle) solveShowCubeToggle.checked = solveShowCube;
  if (solveInspectionToggle) solveInspectionToggle.checked = solveInspection;

  saveSettings();
  populateSessionSelect();
  renderSolvePanel();
  regenerateScramble();
}

function deleteCurrentSession() {
  if (sessions.length <= 1) {
    alert("You must have at least one session.");
    return;
  }
  const current = getActiveSession();
  if (!confirm(`Are you sure you want to delete session "${current.name}" and all its ${current.solves.length} solves?`)) {
    return;
  }
  sessions = sessions.filter(s => s.id !== current.id);
  activeSessionId = sessions[0].id;
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
  renameSessionBtn.addEventListener("click", () => openSessionModal("rename"));
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
  });
}

// ---------------------------------------------------------------------------
// Solve Mode: Scramble, Timer, Sessions, and Stats
// ---------------------------------------------------------------------------

function renderSolvePanel() {
  populateSessionSelect();
  const currentSess = getActiveSession();
  solves = currentSess.solves || [];

  if (solveTargetSelect) solveTargetSelect.value = solveTarget;
  if (solveShowCubeToggle) solveShowCubeToggle.checked = solveShowCube;
  if (solveInspectionToggle) solveInspectionToggle.checked = solveInspection;

  solveScrambleText.textContent = scrambleMoves || currentSolveScramble || scramble;
  if (solveScrambleOrient) {
    solveScrambleOrient.textContent = solveTarget === "cll" ? "(white on bottom)" : "(WCA orientation)";
  }

  if (lastSolve) {
    solveTimeEl.textContent = formatSolveTime(lastSolve.ms);
    if (lastSolve.id && caseById.has(lastSolve.id)) {
      const caseObj = caseById.get(lastSolve.id);
      solveCaseEl.innerHTML = `<strong>${lastSolve.id}</strong> · ${getCllCaseSolutionDisplay(caseObj)} · opposite ${caseObj.opposite}`;
    } else {
      const targetLabel = lastSolve.target === "layer" ? "1st Layer" : (lastSolve.target === "face" ? "1st Face" : "Full Solve");
      solveCaseEl.innerHTML = `<strong>${targetLabel}</strong> · ${formatSolveTime(lastSolve.ms)}`;
    }
  } else {
    solveTimeEl.textContent = "0.00";
    solveCaseEl.textContent = "Scramble your cube, then time the solve.";
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
      <button type="button" class="solve-chip" data-index="${index}" title="Solve #${index + 1}: ${formatSolveTime(solve.ms)} ${solve.id ? `(${solve.id})` : ''} (Click to view details, × to delete)">
        <span class="solve-chip-time">${formatSolveTime(solve.ms)}</span>
        ${solve.id ? `<span class="solve-chip-id">${solve.id}</span>` : ''}
        <span class="solve-chip-del" aria-label="Delete solve">&times;</span>
      </button>
    `.trim())
    .join("");
}

function armSolve() {
  if (mode !== "solve" || solveState !== "idle") return;
  if (solveTarget === "cll" && !currentCaseId) return;
  solveState = "armed";
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  solveOverlayTime.textContent = "0.00";
  solveOverlayHint.textContent = "Release to start";
  solveOverlay.classList.add("armed");
  solveOverlay.hidden = false;
}

function startSolve() {
  if (solveState !== "armed") return;
  solveState = "running";
  solveOverlay.classList.remove("armed");
  solveOverlayHint.textContent = "Any key or tap to stop";
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
  const ms = performance.now() - solveStart;
  solveState = "idle";
  cancelAnimationFrame(solveRaf);

  const scr = scrambleMoves || currentSolveScramble || scramble;
  lastSolve = {
    id: solveTarget === "cll" ? currentCaseId : null,
    target: solveTarget,
    ms: Math.round(ms),
    at: Date.now(),
    scramble: scr
  };
  solves.push(lastSolve);
  if (solves.length > MAX_SOLVES) solves.splice(0, solves.length - MAX_SOLVES);
  saveSolves();

  solveOverlayTime.textContent = formatSolveTime(ms);
  if (byPointer) {
    overlayHideOnPointerUp = true;
    setTimeout(() => { if (overlayHideOnPointerUp) hideSolveOverlay(); }, 700);
  } else {
    hideSolveOverlay();
  }

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
  hideSolveOverlay();
}

// ---------------------------------------------------------------------------
// 1st Layer Practice: WCA 2x2 Scrambles, Inspection, Timer, and Solves Log
// ---------------------------------------------------------------------------

let layerScramble = "";
let layerState = "idle"; // "idle" | "inspecting" | "armed" | "running"
let layerSolveStart = 0;
let layerSolveRaf = 0;
let layerInspectionStart = 0;
let layerInspectionInterval = 0;
let layerArmTimeout = 0;
let layerPenalty = null; // null | "+2" | "DNF"
let layerWarning8Played = false;
let layerWarning12Played = false;
let nextLayerScramblePromise = null;

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

function prefetchNextLayerScramble() {
  nextLayerScramblePromise = generateWca2x2Scramble();
}

async function getNextLayerScramble() {
  if (nextLayerScramblePromise) {
    const p = nextLayerScramblePromise;
    nextLayerScramblePromise = null;
    const s = await p;
    prefetchNextLayerScramble();
    return s;
  }
  const s = await generateWca2x2Scramble();
  prefetchNextLayerScramble();
  return s;
}

const ALL_LAYER_FACES = ["white", "yellow", "green", "blue", "red", "orange"];

function capitalize(str) {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function setLayerScramble(scr) {
  layerScramble = scr;
  if (layerScrambleTextEl) {
    layerScrambleTextEl.textContent = scr;
  }
  if (mode === "layer") {
    applyScrambleToDisplay(scr);
    applyReflection();
  }
  updateLayerSolutions(scr);
}

let layerScrambleSource = null;

async function generateNewLayerScramble() {
  layerScrambleSource = null;
  const scr = await getNextLayerScramble();
  setLayerScramble(scr);
  renderLayerPanel();
}

function reattemptScramble(scrambleStr, label = "") {
  if (!scrambleStr) return;
  setMode("layer");
  layerScrambleSource = `Loaded scramble from <strong>${escapeHtml(label || 'previous solve')}</strong> · Ready to inspect &amp; start`;
  setLayerScramble(scrambleStr);
  resetCubeOrientation();
  if (layerState !== "idle") {
    cancelLayerSolve();
  }
  renderLayerPanel();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function toggleLayerCustomScramble(show) {
  if (!layerCustomScrambleRow) return;
  const willShow = show !== undefined ? show : layerCustomScrambleRow.hidden;
  layerCustomScrambleRow.hidden = !willShow;
  if (willShow) {
    layerCustomScrambleBtn?.classList.add("active");
    if (layerCustomInput) {
      layerCustomInput.value = layerScramble || "";
      layerCustomInput.focus();
      layerCustomInput.select();
    }
  } else {
    layerCustomScrambleBtn?.classList.remove("active");
  }
}

function applyCustomLayerScramble() {
  if (!layerCustomInput) return;
  const raw = layerCustomInput.value.trim();
  if (!raw) {
    alert("Please enter a scramble sequence.");
    layerCustomInput.focus();
    return;
  }
  try {
    const parsed = new Alg(raw);
    const normalized = parsed.toString().trim();
    if (!normalized) {
      alert("Please enter a valid scramble.");
      return;
    }
    layerScrambleSource = `Custom scramble loaded · Ready to inspect &amp; start`;
    setLayerScramble(normalized);
    resetCubeOrientation();
    if (layerState !== "idle") {
      cancelLayerSolve();
    }
    toggleLayerCustomScramble(false);
    renderLayerPanel();
  } catch (err) {
    alert(`Invalid scramble syntax: ${err.message || 'Check for invalid moves'}`);
    layerCustomInput.focus();
  }
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

  if (layerSolutionsTitle) {
    if (layerTargetFaces.length === 6) {
      layerSolutionsTitle.textContent = "1st layer solutions (All 6 / CN)";
    } else if (layerTargetFaces.length === 1) {
      layerSolutionsTitle.textContent = `1st layer solutions (${capitalize(layerTargetFaces[0])})`;
    } else if (layerTargetFaces.length === 2 && layerTargetFaces.includes('white') && layerTargetFaces.includes('yellow')) {
      layerSolutionsTitle.textContent = "1st layer solutions (W / Y)";
    } else {
      layerSolutionsTitle.textContent = `1st layer solutions (${layerTargetFaces.map(f => capitalize(f)).join(', ')})`;
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
  if (layerScramble) {
    updateLayerSolutions(layerScramble);
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

function formatLayerTime(s) {
  if (!s) return "-";
  if (s.penalty === "DNF") return "DNF";
  const formatted = formatSolveTime(s.ms);
  if (s.penalty === "+2") return `${formatted} (+2)`;
  return formatted;
}

function renderLayerPanel() {
  if (layerScramble) {
    layerScrambleTextEl.textContent = layerScramble;
    if (!currentLayerSolutionsScramble || currentLayerSolutionsScramble !== layerScramble) {
      updateLayerSolutions(layerScramble);
    }
  }
  if (layerScrambleSource) {
    layerTimeEl.textContent = "0.00";
    layerSubtextEl.innerHTML = layerScrambleSource;
  } else if (lastLayerSolve) {
    layerTimeEl.textContent = formatLayerTime(lastLayerSolve);
    layerSubtextEl.innerHTML = `Last: <strong>${formatLayerTime(lastLayerSolve)}</strong> · Scramble: <span style="font-family: monospace;">${escapeHtml(lastLayerSolve.scramble || '')}</span>`;
  } else {
    layerTimeEl.textContent = "0.00";
    layerSubtextEl.textContent = "Scramble cube, then inspect & start timer";
  }

  if (layerSolves.length) {
    const valid = layerSolves.filter(s => s.penalty !== "DNF").map(s => s.ms);
    const best = valid.length ? Math.min(...valid) : null;
    const mean = valid.length ? valid.reduce((a, b) => a + b, 0) / valid.length : null;
    layerSummaryEl.textContent = `${layerSolves.length} solve${layerSolves.length === 1 ? "" : "s"} · best ${best != null ? formatSolveTime(best) : "-"} · mean ${mean != null ? formatSolveTime(mean) : "-"}`;
  } else {
    layerSummaryEl.textContent = "No times yet";
  }
  clearLayerSolvesBtn.hidden = layerSolves.length === 0;
  renderSolveStatsBar(layerStatsBar, layerSolves);

  const recent = layerSolves.slice(-12).reverse();
  layerListEl.innerHTML = recent.map((solve) => {
    const origIdx = layerSolves.findIndex(s => String(s.id) === String(solve.id));
    const num = origIdx !== -1 ? origIdx + 1 : "";
    return `
      <button type="button" class="solve-chip" data-id="${solve.id}" data-num="${num}" title="Solve #${num}: ${formatLayerTime(solve)} (click to view details, × to delete)">
        <span class="solve-chip-time">${formatLayerTime(solve)}</span>
        <span class="solve-chip-del" aria-label="Delete solve">&times;</span>
      </button>
    `;
  }).join("");

  if (layerInspectionToggle) {
    layerInspectionToggle.checked = layerUseInspection;
  }

  updateFaceChipsUI();

  if (layerStatusBadge) {
    layerStatusBadge.className = "layer-badge";
    if (layerState === "inspecting") {
      layerStatusBadge.classList.add("inspecting");
      layerStatusBadge.textContent = "Inspecting";
    } else if (layerState === "armed") {
      layerStatusBadge.classList.add("armed");
      layerStatusBadge.textContent = "Armed";
    } else if (layerState === "running") {
      layerStatusBadge.textContent = "Running";
    } else {
      layerStatusBadge.textContent = "Ready";
    }
  }
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
    layerSolutionsList.innerHTML = `<p class="layer-solutions-empty">Searching for ${escapeHtml(facesDesc)} 1st layer solutions...</p>`;
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
  if (!sols || sols.length === 0) {
    const facesDesc = layerTargetFaces.length === 6 ? 'selected faces' : layerTargetFaces.map(f => capitalize(f)).join(', ');
    layerSolutionsList.innerHTML = `<p class="layer-solutions-empty">No 1st layer solutions found for ${escapeHtml(facesDesc)} within 6 moves.</p>`;
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
    const inspText = sol.inspection && sol.inspection !== 'none' ? sol.inspection : 'none';
    const movesText = sol.moves || '(already solved)';
    const cObj = caseById.get(sol.caseId);
    const alg = cObj?.alg || cObj?.solutionAlg || '';
    const caseTitle = alg ? `CLL solution for ${sol.caseId}: ${alg}` : '';
    const faceName = sol.face || 'white';

    return `
      <div class="layer-sol-row">
        <div class="layer-sol-info">
          <div class="layer-sol-badges">
            <span class="face-badge face-badge-${faceName}">${capitalize(faceName)}</span>
            <span class="badge layer-sol-moves-badge">${sol.moveCount} move${sol.moveCount === 1 ? '' : 's'}</span>
            <span class="layer-sol-insp-chip">Inspection: <strong>${escapeHtml(inspText)}</strong></span>
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
      const base = layerScramble;
      const solMoves = (sol.inspection && sol.inspection !== 'none' ? sol.inspection + ' ' : '') + (sol.moves || '');
      const fullSeq = `${base} ${solMoves}`.trim();
      setMode("simulate");
      simScrambleInput.value = fullSeq;
      simOriginalScramble = base;
      simHasSolutionAppended = true;
      simAppendSolutionBtn.textContent = "Remove Solution";
      simAppendSolutionBtn.classList.add("active");
      simLoadScramble(fullSeq, {
        expectedCase: { id: `Layer: ${capitalize(sol.face)} (${sol.moveCount}m)`, solution: solMoves, solutionAlg: solMoves },
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
      const cObj = caseById.get(sol.caseId);
      const alg = cObj?.alg || cObj?.solutionAlg || '';
      const text = [
        `Scramble: ${layerScramble}`,
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

function startLayerInspection() {
  if (mode !== "layer" || layerState !== "idle") return;
  layerState = "inspecting";
  layerPenalty = null;
  layerWarning8Played = false;
  layerWarning12Played = false;
  layerInspectionStart = performance.now();

  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();

  solveOverlay.className = "solve-overlay inspecting";
  solveOverlay.hidden = false;
  if (solveOverlayCancelBtn) solveOverlayCancelBtn.hidden = false;
  solveOverlayTime.textContent = "15";
  solveOverlayHint.textContent = "Hold Space when ready · Esc to cancel";

  clearInterval(layerInspectionInterval);
  layerInspectionInterval = setInterval(() => {
    if (layerState !== "inspecting" && layerState !== "armed") return;
    const elapsedSec = Math.floor((performance.now() - layerInspectionStart) / 1000);
    const remaining = 15 - elapsedSec;

    if (remaining > 0) {
      if (layerState === "inspecting") {
        solveOverlayTime.textContent = String(remaining);
      }
      if (remaining <= 7 && remaining > 3 && !layerWarning8Played) {
        layerWarning8Played = true;
        playInspectionBeep(440, 0.08);
        solveOverlay.classList.add("warning-8");
      }
      if (remaining <= 3 && !layerWarning12Played) {
        layerWarning12Played = true;
        playInspectionBeep(880, 0.1);
        solveOverlay.classList.remove("warning-8");
        solveOverlay.classList.add("warning-12");
      }
    } else if (remaining <= 0 && remaining >= -2) {
      layerPenalty = "+2";
      solveOverlay.classList.remove("warning-8", "warning-12");
      solveOverlay.classList.add("penalty-plus2");
      if (layerState === "inspecting") {
        solveOverlayTime.textContent = "+2";
      }
      solveOverlayHint.textContent = "+2 penalty · Hold Space when ready";
    } else {
      layerPenalty = "DNF";
      solveOverlay.classList.remove("warning-8", "warning-12", "penalty-plus2");
      solveOverlay.classList.add("penalty-dnf");
      if (layerState === "inspecting") {
        solveOverlayTime.textContent = "DNF";
      }
      solveOverlayHint.textContent = "Inspection exceeded 17s (DNF)";
    }
  }, 100);

  renderLayerPanel();
}

function armLayerSolve() {
  if (mode !== "layer" || (layerState !== "idle" && layerState !== "inspecting")) return;
  layerState = "armed";
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();

  solveOverlay.hidden = false;
  solveOverlay.classList.add("armed");
  if (solveOverlayCancelBtn) solveOverlayCancelBtn.hidden = false;
  if (layerPenalty === "+2") {
    solveOverlayTime.textContent = "+2";
  } else if (layerPenalty === "DNF") {
    solveOverlayTime.textContent = "DNF";
  } else {
    solveOverlayTime.textContent = "0.00";
  }
  solveOverlayHint.textContent = "Release to start";
  renderLayerPanel();
}

function startLayerSolve() {
  if (layerState !== "armed") return;
  layerState = "running";
  clearInterval(layerInspectionInterval);

  solveOverlay.className = "solve-overlay";
  if (solveOverlayCancelBtn) solveOverlayCancelBtn.hidden = true;
  solveOverlayHint.textContent = layerPenalty === "+2"
    ? "Running (+2 penalty) · Any key or tap to stop"
    : (layerPenalty === "DNF" ? "Running (DNF) · Any key or tap to stop" : "Any key or tap to stop");

  layerSolveStart = performance.now();
  const tick = () => {
    if (layerState !== "running") return;
    solveOverlayTime.textContent = formatSolveTime(performance.now() - layerSolveStart);
    layerSolveRaf = requestAnimationFrame(tick);
  };
  tick();
  renderLayerPanel();
}

function stopLayerSolve(byPointer) {
  if (layerState !== "running") return;
  const rawMs = performance.now() - layerSolveStart;
  layerState = "idle";
  cancelAnimationFrame(layerSolveRaf);
  clearInterval(layerInspectionInterval);

  let finalMs = Math.round(rawMs);
  if (layerPenalty === "+2") {
    finalMs += 2000;
  }

  lastLayerSolve = {
    id: Date.now() + "_" + Math.random().toString(36).substr(2, 5),
    ms: finalMs,
    rawMs: Math.round(rawMs),
    scramble: layerScramble,
    penalty: layerPenalty,
    at: Date.now()
  };
  layerSolves.push(lastLayerSolve);
  if (layerSolves.length > MAX_SOLVES) {
    layerSolves.splice(0, layerSolves.length - MAX_SOLVES);
  }
  saveLayerSolves();

  solveOverlayTime.textContent = formatLayerTime(lastLayerSolve);

  if (byPointer) {
    overlayHideOnPointerUp = true;
    setTimeout(() => { if (overlayHideOnPointerUp) hideSolveOverlay(); }, 500);
  } else {
    hideSolveOverlay();
  }

  renderLayerPanel();
  updateStatsTable();
  generateNewLayerScramble();
}

function cancelLayerSolve() {
  layerState = "idle";
  cancelAnimationFrame(layerSolveRaf);
  clearInterval(layerInspectionInterval);
  clearTimeout(layerArmTimeout);
  hideSolveOverlay();
  renderLayerPanel();
}

function handleLayerKeydown(e) {
  if (layerState === "running") {
    e.preventDefault();
    stopLayerSolve(false);
    return;
  }
  if (e.key === "Escape") {
    if (layerState === "inspecting" || layerState === "armed") {
      e.preventDefault();
      cancelLayerSolve();
      return;
    }
  }
  if (e.code === "Space") {
    e.preventDefault();
    if (e.repeat) return;
    if (layerState === "idle") {
      if (layerUseInspection) {
        startLayerInspection();
      } else {
        armLayerSolve();
      }
      return;
    }
    if (layerState === "inspecting") {
      clearTimeout(layerArmTimeout);
      layerArmTimeout = setTimeout(() => {
        if (layerState === "inspecting") {
          armLayerSolve();
        }
      }, 200);
    }
  }
}

function handleLayerKeyup(e) {
  if (e.code === "Space") {
    e.preventDefault();
    clearTimeout(layerArmTimeout);
    if (layerState === "armed") {
      startLayerSolve();
    }
  }
}

function handleLayerOverlayPointerDown(e) {
  if (e.target.closest("#solveOverlayCancelBtn")) {
    cancelLayerSolve();
    return;
  }
  if (layerState === "running") {
    stopLayerSolve(true);
    return;
  }
  if (layerState === "inspecting") {
    clearTimeout(layerArmTimeout);
    layerArmTimeout = setTimeout(() => {
      if (layerState === "inspecting") {
        armLayerSolve();
      }
    }, 200);
  }
}

function handleLayerPointerUp() {
  clearTimeout(layerArmTimeout);
  if (layerState === "armed") {
    startLayerSolve();
  } else if (overlayHideOnPointerUp) {
    hideSolveOverlay();
    swallowNextClick = true;
    setTimeout(() => { swallowNextClick = false; }, 300);
  }
}

// Keyboard: Space arms on keydown (ignoring auto-repeat), starts on keyup;
// any key stops a running timer; Escape cancels an armed one.
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
    if (e.code === "Space") {
      e.preventDefault();
      if (!e.repeat && solveState === "idle") armSolve();
      return;
    }
    if (e.key === "Escape" && solveState === "armed") cancelSolve();
    return;
  }

  if (mode === "layer") {
    handleLayerKeydown(e);
    return;
  }
});

document.addEventListener("keyup", e => {
  if (!overview.hidden) return;
  if (mode === "solve") {
    if (e.code === "Space") {
      e.preventDefault();
      if (solveState === "armed") startSolve();
    }
    return;
  }
  if (mode === "layer") {
    handleLayerKeyup(e);
    return;
  }
});

// Touch / mouse: hold on the timer area, release anywhere to start; tap the
// full-screen overlay to stop.
solveSurface.addEventListener("pointerdown", e => {
  if (e.target.closest("button") || solveState !== "idle") return;
  e.preventDefault();
  armSolve();
});

layerSurfaceEl.addEventListener("pointerdown", e => {
  if (e.target.closest("button") || e.target.closest("input") || e.target.closest("label")) return;
  if (mode !== "layer" || layerState !== "idle") return;
  e.preventDefault();
  if (layerUseInspection) {
    startLayerInspection();
  } else {
    armLayerSolve();
  }
});

solveOverlay.addEventListener("pointerdown", e => {
  e.preventDefault();
  if (mode === "solve") {
    if (solveState === "running") stopSolve(true);
  } else if (mode === "layer") {
    handleLayerOverlayPointerDown(e);
  }
});

document.addEventListener("pointerup", () => {
  if (mode === "solve") {
    if (solveState === "armed") {
      startSolve();
    } else if (overlayHideOnPointerUp) {
      hideSolveOverlay();
      swallowNextClick = true;
      setTimeout(() => { swallowNextClick = false; }, 300);
    }
  } else if (mode === "layer") {
    handleLayerPointerUp();
  }
});

document.addEventListener("pointercancel", () => {
  if (mode === "solve" && solveState === "armed") cancelSolve();
  if (mode === "layer" && (layerState === "armed" || layerState === "inspecting")) cancelLayerSolve();
});

document.addEventListener("click", e => {
  if (swallowNextClick) {
    swallowNextClick = false;
    e.stopPropagation();
    e.preventDefault();
  }
}, true);

clearSolvesBtn.addEventListener("click", () => {
  if (confirm("Clear all recorded solve times?")) {
    solves = [];
    lastSolve = null;
    resetCaseAppearances();
    saveSolves();
    renderSolvePanel();
    updateStatsTable();
  }
});

solveList.addEventListener("click", e => {
  const chip = e.target.closest(".solve-chip");
  if (!chip) return;
  const index = Number(chip.dataset.index);
  if (!Number.isInteger(index) || index < 0 || index >= solves.length) return;
  const s = solves[index];
  if (!s) return;

  const isDel = e.target.closest(".solve-chip-del");
  if (isDel) {
    if (confirm(`Delete solve ${formatSolveTime(s.ms)}?`)) {
      solves.splice(index, 1);
      if (lastSolve === s || (lastSolve && lastSolve.at === s.at && lastSolve.id === s.id && lastSolve.ms === s.ms)) {
        lastSolve = solves.length ? solves[solves.length - 1] : null;
      }
      saveSolves();
      renderSolvePanel();
      updateStatsTable();
    }
    return;
  }

  openSolveDetailModal(s, index + 1);
});

layerNewScrambleBtn.addEventListener("click", () => generateNewLayerScramble());
layerInspectionToggle.addEventListener("change", () => {
  layerUseInspection = layerInspectionToggle.checked;
  saveSettings();
});

if (layerCustomScrambleBtn) {
  layerCustomScrambleBtn.addEventListener("click", () => {
    toggleLayerCustomScramble();
  });
}
if (layerCustomCancelBtn) {
  layerCustomCancelBtn.addEventListener("click", () => {
    toggleLayerCustomScramble(false);
  });
}
if (layerCustomClearBtn) {
  layerCustomClearBtn.addEventListener("click", () => {
    if (layerCustomInput) {
      layerCustomInput.value = "";
      layerCustomInput.focus();
    }
  });
}
if (layerCustomApplyBtn) {
  layerCustomApplyBtn.addEventListener("click", applyCustomLayerScramble);
}
if (layerCustomInput) {
  layerCustomInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      applyCustomLayerScramble();
    } else if (e.key === "Escape") {
      e.preventDefault();
      toggleLayerCustomScramble(false);
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

clearLayerSolvesBtn.addEventListener("click", () => {
  if (confirm("Clear all recorded 1st layer times?")) {
    layerSolves = [];
    lastLayerSolve = null;
    saveLayerSolves();
    renderLayerPanel();
    updateStatsTable();
  }
});

layerListEl.addEventListener("click", e => {
  const chip = e.target.closest(".solve-chip");
  if (!chip) return;
  const id = chip.dataset.id;
  const index = layerSolves.findIndex(s => String(s.id) === String(id));
  if (index === -1) return;
  const s = layerSolves[index];

  // If clicking the delete cross on the chip:
  if (e.target.closest(".solve-chip-del")) {
    if (confirm(`Delete 1st layer solve ${formatLayerTime(s)}?`)) {
      layerSolves.splice(index, 1);
      if (lastLayerSolve && String(lastLayerSolve.id) === String(id)) {
        lastLayerSolve = layerSolves.length ? layerSolves[layerSolves.length - 1] : null;
      }
      saveLayerSolves();
      renderLayerPanel();
      updateStatsTable();
    }
    return;
  }

  // Clicking chip opens solve details popup
  openSolveDetailModal(s, index + 1);
});
if (solveOverlayCancelBtn) {
  solveOverlayCancelBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    if (mode === "layer") cancelLayerSolve();
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
      diagram.innerHTML = caseDiagramSVG(solved.applyAlg(`z2 ${caseObj.scramble}`), caseObj.id);

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
  }
});

// ---------------------------------------------------------------------------
// Stats table
// ---------------------------------------------------------------------------

function renderStatsToggle() {
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
  const caseNumbers = [1, 2, 3, 4, 5, 6];

  let html = '<table><thead><tr><th scope="col">Group</th>';
  caseNumbers.forEach(c => {
    html += `<th scope="col">${c}</th>`;
  });
  html += '<th scope="col">Total</th></tr></thead><tbody>';

  GROUP_DISPLAY_ORDER.forEach(group => {
    html += `<tr><th scope="row">${group}</th>`;

    caseNumbers.forEach(caseNum => {
      const caseId = `${group}${caseNum}`;
      if (!caseById.has(caseId)) {
        html += '<td></td>';
        return;
      }
      const stat = stats[caseId];
      const correct = stat ? stat.correct : 0;
      const shown = stat ? stat.shown : 0;
      html += `<td>${correct}/${shown}</td>`;
    });

    const totals = groupTotals(group);
    html += `<td class="total">${totals.correct}/${totals.shown}</td></tr>`;
  });

  html += '</tbody></table>';
  document.getElementById("stats-table-container").innerHTML = html;
}

function renderSolveStatsTable() {
  const caseSolves = new Map();
  for (const s of solves) {
    if (selectedCases.has(s.id)) {
      if (!caseSolves.has(s.id)) {
        caseSolves.set(s.id, []);
      }
      caseSolves.get(s.id).push(s.ms);
    }
  }

  const casesWithTimes = CASE_IDS.filter(id => caseSolves.has(id));

  const sortCols = [
    { key: "case", label: "Case" },
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

  const container = document.getElementById("stats-table-container");

  if (casesWithTimes.length === 0) {
    html += '<tr><td colspan="6" class="empty-stats">No solve times for selected cases</td></tr></tbody></table>';
    container.innerHTML = html;
    attachSortListeners(container);
    return;
  }

  const caseStatsList = casesWithTimes.map(id => {
    const times = caseSolves.get(id);
    const attempts = times.length;
    const best = Math.min(...times);
    const worst = Math.max(...times);
    const mean = times.reduce((sum, t) => sum + t, 0) / attempts;
    const sorted = [...times].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    return { id, attempts, best, worst, mean, median };
  });

  caseStatsList.sort((a, b) => {
    let valA = a[solveStatsSort.col];
    let valB = b[solveStatsSort.col];
    if (solveStatsSort.col === "case") {
      valA = CASE_IDS.indexOf(a.id);
      valB = CASE_IDS.indexOf(b.id);
    }
    if (valA < valB) return solveStatsSort.dir === "asc" ? -1 : 1;
    if (valA > valB) return solveStatsSort.dir === "asc" ? 1 : -1;
    return 0;
  });

  caseStatsList.forEach(stat => {
    html += `<tr>
      <th scope="row">${stat.id}</th>
      <td>${stat.attempts}</td>
      <td>${formatSolveTime(stat.best)}</td>
      <td>${formatSolveTime(stat.mean)}</td>
      <td>${formatSolveTime(stat.median)}</td>
      <td>${formatSolveTime(stat.worst)}</td>
    </tr>`;
  });

  html += '</tbody>';

  if (caseStatsList.length > 1) {
    const allTimes = solves.filter(s => selectedCases.has(s.id)).map(s => s.ms);
    const totalAttempts = allTimes.length;
    const overallBest = Math.min(...allTimes);
    const overallWorst = Math.max(...allTimes);
    const overallMean = allTimes.reduce((sum, t) => sum + t, 0) / totalAttempts;
    const sortedAll = [...allTimes].sort((a, b) => a - b);
    const midAll = Math.floor(sortedAll.length / 2);
    const overallMedian = sortedAll.length % 2 !== 0 ? sortedAll[midAll] : (sortedAll[midAll - 1] + sortedAll[midAll]) / 2;

    html += `<tfoot><tr>
      <th scope="row">Total</th>
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
        solveStatsSort.dir = (col === "case" || col === "best" || col === "mean" || col === "median" || col === "worst") ? "asc" : "desc";
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
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function computeTrimmedAverage(solvesSlice) {
  const n = solvesSlice.length;
  if (n < 3) return null;
  let dnfCount = 0;
  const values = [];
  for (const s of solvesSlice) {
    if (s.penalty === "DNF") {
      dnfCount++;
      values.push(Infinity);
    } else {
      values.push(s.ms);
    }
  }
  if (dnfCount > 1) return "DNF";
  values.sort((a, b) => a - b);
  const trimmed = values.slice(1, n - 1);
  const sum = trimmed.reduce((acc, v) => acc + v, 0);
  return Math.round(sum / trimmed.length);
}

function computeCurrentAo(solvesList, size) {
  if (solvesList.length < size) return null;
  const slice = solvesList.slice(-size);
  return computeTrimmedAverage(slice);
}

function computeBestAo(solvesList, size) {
  if (solvesList.length < size) return null;
  let best = Infinity;
  for (let i = 0; i <= solvesList.length - size; i++) {
    const avg = computeTrimmedAverage(solvesList.slice(i, i + size));
    if (typeof avg === "number" && avg < best) {
      best = avg;
    }
  }
  return Number.isFinite(best) ? best : null;
}

function renderLayerStatsTable() {
  const container = document.getElementById("stats-table-container");
  if (!container) return;

  if (layerSolves.length === 0) {
    container.innerHTML = `
      <div class="empty-stats" style="text-align: center; padding: 24px;">
        <p>No 1st layer times recorded yet.</p>
        <p style="color: var(--muted); font-size: 0.9rem;">Switch to <strong>1st Layer</strong> mode to practice WCA 2x2 scrambles and time your 1st layer solves.</p>
      </div>
    `;
    return;
  }

  const validTimes = layerSolves.filter(s => s.penalty !== "DNF").map(s => s.ms);
  const count = layerSolves.length;
  const best = validTimes.length ? Math.min(...validTimes) : null;
  const mean = validTimes.length ? validTimes.reduce((a, b) => a + b, 0) / validTimes.length : null;
  const median = validTimes.length ? calculateMedian(validTimes) : null;
  const worst = validTimes.length ? Math.max(...validTimes) : null;
  const curAo5 = computeCurrentAo(layerSolves, 5);
  const bestAo5 = computeBestAo(layerSolves, 5);
  const curAo12 = computeCurrentAo(layerSolves, 12);
  const bestAo12 = computeBestAo(layerSolves, 12);

  const formatAo = (val) => val === "DNF" ? "DNF" : (val != null ? formatSolveTime(val) : "-");

  let html = `
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

  html += `</div>`;

  // Solve Log Header and Table
  html += `
    <div class="layer-log-header">
      <div class="layer-log-title-wrap">
        <h3 class="layer-log-title">Solve Log</h3>
        <span class="layer-log-hint">Tap any row for scramble &amp; date</span>
      </div>
      <span class="layer-log-count">${count} solve${count === 1 ? '' : 's'} recorded</span>
    </div>
    <table class="layer-log-table">
      <thead>
        <tr>
          <th scope="col" style="width: 44px;">#</th>
          <th scope="col">Time</th>
          <th scope="col" style="width: 76px;">Actions</th>
        </tr>
      </thead>
      <tbody>
  `;

  // Reverse chronological (newest at top)
  const rows = [...layerSolves].map((s, idx) => ({ s, num: idx + 1 })).reverse();
  rows.forEach(({ s, num }) => {
    html += `
      <tr class="layer-log-row" data-id="${s.id}" data-num="${num}" title="Click to view scramble &amp; date">
        <td>${num}</td>
        <td class="layer-time-cell">${formatLayerTime(s)}</td>
        <td>
          <div class="layer-log-actions">
            <button type="button" class="btn-reattempt-solve" data-id="${s.id}" data-num="${num}" title="Reattempt solve #${num} scramble">&#x21bb;</button>
            <button type="button" class="btn-del-solve" data-id="${s.id}" title="Delete solve #${num} (${formatLayerTime(s)})">&times;</button>
          </div>
        </td>
      </tr>
    `;
  });

  html += `</tbody></table>`;
  container.innerHTML = html;

  // Attach row click listeners to show details popup
  container.querySelectorAll(".layer-log-row").forEach(row => {
    row.addEventListener("click", (e) => {
      if (e.target.closest(".btn-del-solve") || e.target.closest(".btn-reattempt-solve")) return;
      const id = row.dataset.id;
      const num = row.dataset.num;
      const solve = layerSolves.find(s => String(s.id) === String(id));
      if (solve) {
        openSolveDetailModal(solve, num);
      }
    });
  });

  // Attach reattempt button listeners
  container.querySelectorAll(".btn-reattempt-solve").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const num = btn.dataset.num;
      const solve = layerSolves.find(s => String(s.id) === String(id));
      if (solve && solve.scramble) {
        reattemptScramble(solve.scramble, `solve #${num}`);
      }
    });
  });

  // Attach delete button listeners
  container.querySelectorAll(".btn-del-solve").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const id = btn.dataset.id;
      const index = layerSolves.findIndex(s => String(s.id) === String(id));
      if (index === -1) return;
      const s = layerSolves[index];
      if (confirm(`Delete 1st layer solve #${index + 1} (${formatLayerTime(s)})?`)) {
        layerSolves.splice(index, 1);
        if (lastLayerSolve && String(lastLayerSolve.id) === String(id)) {
          lastLayerSolve = layerSolves.length ? layerSolves[layerSolves.length - 1] : null;
        }
        saveLayerSolves();
        renderLayerPanel();
        renderLayerStatsTable();
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
  if (solveModalTitle) solveModalTitle.textContent = `Solve #${solveNum}`;
  if (solveModalTime) solveModalTime.textContent = formatLayerTime(solve);
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
  if (statsType === "solve") {
    renderSolveStatsTable();
  } else if (statsType === "layer") {
    renderLayerStatsTable();
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
  if (statsType === "solve") {
    if (confirm("Are you sure you want to clear all recorded solve times?")) {
      solves = [];
      lastSolve = null;
      resetCaseAppearances();
      saveSolves();
      renderSolvePanel();
      updateStatsTable();
    }
  } else if (statsType === "layer") {
    if (confirm("Are you sure you want to clear all recorded 1st layer times?")) {
      layerSolves = [];
      lastLayerSolve = null;
      saveLayerSolves();
      renderLayerPanel();
      updateStatsTable();
    }
  } else {
    if (confirm("Are you sure you want to reset all recognition statistics?")) {
      for (const key in stats) {
        delete stats[key];
      }
      resetCaseAppearances();
      saveStats();
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

function simInit() {
  populateSimCaseSelect();
  attachSimPlayerListeners();

  // If we already have moves loaded for a case with solution, maintain state
  if (simMoves.length > 0 && simExpectedCaseObj && simHasSolutionAppended) {
    return;
  }

  if (currentCaseId) {
    const c = caseById.get(currentCaseId);
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
  if (scramble) {
    applyScrambleToDisplay(scramble);
    applyReflection();
  }
}

function populateSimCaseSelect() {
  if (simCaseSelect.options.length > 1) return;
  simCaseSelect.innerHTML = `<option value="">Load a CLL case...</option>`;
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
}

function parseScrambleInput(raw) {
  if (!raw || typeof raw !== "string") {
    return { ok: false, error: "Please enter a scramble string." };
  }
  let cleaned = raw.replace(/[‘’ʻʼ`]/g, "'").replace(/[()[\]{}]/g, " ").replace(/,/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) {
    return { ok: false, error: "Scramble cannot be empty." };
  }

  // Detect orientation for metadata tag
  let orientation = "";
  const orientMatch = cleaned.match(/^((?:[xyz](?:2'|'2|3'|''|2"|[23'])?\s*)+)/i);
  if (orientMatch) {
    orientation = cleanAlg(orientMatch[1]);
  }

  const tokens = cleaned.split(/\s+/).filter(Boolean);
  const moves = [];
  for (const token of tokens) {
    const match = token.match(/^([RUFBLDxyz])(2'|'2|3'|'3|''|2"|[23'])?$/i);
    if (!match) {
      return { ok: false, error: `Invalid move token "${token}". Allowed moves: R, U, F, B, L, D, x, y, z with optional 2, ', or 2'.` };
    }
    const face = ['x', 'y', 'z'].includes(match[1].toLowerCase()) ? match[1].toLowerCase() : match[1].toUpperCase();
    let mod = match[2] || "";
    if (mod === "3") mod = "'";
    else if (mod === "3'" || mod === "'3") mod = "";
    else if (mod === "'2" || mod === '2"' || mod === "''") mod = "2'";
    moves.push(face + mod);
  }

  return {
    ok: true,
    orientation,
    moves,
    error: null
  };
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

  for (const caseObj of caseById.values()) {
    const list = caseObj.scrambles && caseObj.scrambles.length ? caseObj.scrambles : [caseObj.scramble];
    for (const sc of list) {
      const normSc = normalizeAlgForCompare(sc);
      if (normSc === normCaseMoves || normSc === normAllMoves || sc.trim() === caseMovesOnly || sc.trim() === allMoves) {
        return caseObj;
      }
    }
  }
  return null;
}

function renderSimPresetButtons(caseObj, activeIndex = null) {
  if (!simPresetButtons) return;
  simPresetButtons.innerHTML = "";

  const scrambles = caseObj.scrambles && caseObj.scrambles.length ? caseObj.scrambles : [caseObj.scramble];

  let matchedIdx = activeIndex;
  if (matchedIdx === null) {
    const origCount = getSimOriginalCount();
    const strippedMoves = simMoves.slice(0, origCount).filter(m => !/^[xyz]/i.test(m)).join(" ");
    const normStripped = normalizeAlgForCompare(strippedMoves);
    matchedIdx = scrambles.findIndex(s => normalizeAlgForCompare(s) === normStripped || s.trim() === strippedMoves);
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

  simMoves = parsed.moves;
  simOrientation = parsed.orientation;
  simExpectedCaseObj = expectedCase || findCaseByScrambleMoves(simMoves);

  if (simExpectedCaseObj) {
    simCaseTag.textContent = `Case: ${simExpectedCaseObj.id}`;
    simSolutionTag.innerHTML = `<strong>Solution:</strong> ${simExpectedCaseObj.solution || 'None'}`;
    simOrientTag.textContent = simOrientation ? `Orientation: ${simOrientation}` : "Standard Orientation";
    simCaseDetails.hidden = false;
    simAppendSolutionBtn.disabled = !(simExpectedCaseObj.solutionAlg || simExpectedCaseObj.solution);
    if (simCaseSelect.value !== simExpectedCaseObj.id) {
      simCaseSelect.value = simExpectedCaseObj.id;
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
      updateSimPlayingState(info.playing, info.atStart, info.atEnd);
    });
  } catch (err) {
    console.warn("Could not attach simulator timeline listeners:", err);
  }
}

function simStepForward() {
  if (!el || !el.player || !el.player.controller) return;
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
    const c = caseById.get(currentCaseId);
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
  const caseObj = caseById.get(caseId);
  if (!caseObj) return;
  simLoadCaseWithSolution(caseObj, 0);
});

if (simScrambleSelect) {
  simScrambleSelect.addEventListener("change", () => {
    if (!simExpectedCaseObj) return;
    const idx = parseInt(simScrambleSelect.value, 10);
    simLoadCaseWithSolution(simExpectedCaseObj, idx);
  });
}

simAppendSolutionBtn.addEventListener("click", () => {
  const sol = simExpectedCaseObj ? (simExpectedCaseObj.solutionAlg || simExpectedCaseObj.solution) : null;
  if (!simExpectedCaseObj || !sol) {
    alert("Please select or load a CLL case first to append its solution.");
    return;
  }
  if (simHasSolutionAppended) {
    simHasSolutionAppended = false;
    simAppendSolutionBtn.textContent = "Append Solution";
    simAppendSolutionBtn.classList.remove("active");
    simLoadScramble(simOriginalScramble, { expectedCase: simExpectedCaseObj });
  } else {
    simHasSolutionAppended = true;
    simAppendSolutionBtn.textContent = "Remove Solution";
    simAppendSolutionBtn.classList.add("active");
    const solClean = cleanAlg(sol);
    const base = simOriginalScramble || simScrambleText;
    const combined = base + " " + solClean;
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

buildCasePicker();
renderToggles();
renderMinutes();
syncSettingsPanel();
syncStatsPanel();
renderStatsToggle();
populateSimCaseSelect();
updateFaceChipsUI();
regenerateScramble();
prefetchNextLayerScramble();
if (mode === "simulate") {
  simInit();
} else if (mode === "layer") {
  generateNewLayerScramble();
}
