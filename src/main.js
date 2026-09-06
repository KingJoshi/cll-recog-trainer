import { ScrambleDisplay } from 'scramble-display';
import { puzzles } from 'cubing/puzzles';
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
const cllCases = {
  "cases": [
    { "id": "A1", "group": "A", "opposite": "S1", "scramble": "R U R' U R U2 R' U'", "solution": "(R' U' R U' R' U2 R)" },
    { "id": "A2", "group": "A", "opposite": "S2", "scramble": "R U R' U' R' F R F' R U' R' F R' F' R U", "solution": "(Sledge) (R U R') (Hedge) (*Righty)" },
    { "id": "A3", "group": "A", "opposite": "S6", "scramble": "F R' F' R U R U2' R' F R' F' R U'", "solution": "^(U) (Sledge) R U2' R' U' (Sledge)" },
    { "id": "A4", "group": "A", "opposite": "S4", "scramble": "R U' R' F R' F' R U2", "solution": "^(U2) (Sledge) (R U R')" },
    { "id": "A5", "group": "A", "opposite": "S5", "scramble": "R U R' U' R' F R F' R U R' U R U2 R' U", "solution": "(Anti-sune1a) (Hedge) (*Righty)" },
    { "id": "A6", "group": "A", "opposite": "S3", "scramble": "F R' F' R U2 R U2 R' U2", "solution": "^(U2) (R U2 R') U2 (Sledge)" },
    { "id": "H1", "group": "H", "opposite": "H1", "scramble": "R2 U2 R U2 R2", "solution": "R2 U2 R U2 R2" },
    { "id": "H2", "group": "H", "opposite": "H2", "scramble": "F R U R' U' R U R' U' R U R' U' F'", "solution": "F (Righty)3 F'" },
    { "id": "H3", "group": "H", "opposite": "P3", "scramble": "R' F R F' R U' R' U' R U' R' U", "solution": "^(U') R U R' U R U R' (Hedge)" },
    { "id": "H4", "group": "H", "opposite": "P4", "scramble": "F R' F' R U2 R U R' F R' F' R U'", "solution": "^(U) (Sledge) (R U' R') U2 (Sledge)" },
    { "id": "L1", "group": "L", "opposite": "T2", "scramble": "R' F' R U R U' R' F U'", "solution": "F R U' R' U' R U R' F'" },
    { "id": "L2", "group": "L", "opposite": "T1", "scramble": "R U R' U' R' F R F'", "solution": "(Hedge) (*Righty)" },
    { "id": "L3", "group": "L", "opposite": "L3", "scramble": "R' F2 R2 U' R' F R' F2 R U2", "solution": "^(U) R' F2 R2 U' R' F R' F2 R" },
    { "id": "L4", "group": "L", "opposite": "L4", "scramble": "R U' R U' R U2 R' U R' U R'", "solution": "R U' R U' R U2 R' U R' U R'" },
    { "id": "L5", "group": "L", "opposite": "U5", "scramble": "R U' R2 F R F' R U R' U' R U R' U", "solution": "^(U') R U' R' U R U' R' F R' F' R2 U R'" },
    { "id": "L6", "group": "L", "opposite": "U6", "scramble": "R' U R' F R F' R U2 R' U R", "solution": "R' U' R U2 R' F R' F' R U' R" },
    { "id": "P1", "group": "P", "opposite": "P1", "scramble": "F R U R' U' R U R' U' F' U2", "solution": "F (Righty)2 F'" },
    { "id": "P2", "group": "P", "opposite": "P2", "scramble": "R U' R' U2 R' F R F' U2 R U R' U2", "solution": "R U' R' U2 (Sledge) U2 R U R'" },
    { "id": "P3", "group": "P", "opposite": "H3", "scramble": "R U R' U R U R' F R' F' R U2", "solution": "^(U2) (Sledge) R U' R' U' R U' R'" },
    { "id": "P4", "group": "P", "opposite": "H4", "scramble": "R' F R F' R U' R' U2 R' F R F' U'", "solution": "^(U) (Hedge) U2 R U R' (Hedge)" },
    { "id": "P5", "group": "P", "opposite": "P6", "scramble": "R' F2 R U R' F' R U2 R U' R' F U'", "solution": "(R U2 R' U') (R U R') U2 (Sledge)" },
    { "id": "P6", "group": "P", "opposite": "P5", "scramble": "R U2 R' U' R U R' U2 R' F R F' U'", "solution": "^(U) (Hedge) U2 (R U' R') (U R U2 R')" },
    { "id": "S1", "group": "S", "opposite": "A1", "scramble": "R' U' R U' R' U2 R U", "solution": "(R U R' U R U2 R')" },
    { "id": "S2", "group": "S", "opposite": "A2", "scramble": "R' F R F' R U R' F R' F' R U R U' R'", "solution": "(Righty) (Sledge) (R U' R') (Hedge)" },
    { "id": "S3", "group": "S", "opposite": "A6", "scramble": "R U2 R' U2 R' F R F'", "solution": "(Hedge) U2 (R U2 R')" },
    { "id": "S4", "group": "S", "opposite": "A4", "scramble": "R' F R F' R U R'", "solution": "R U' R' (Hedge)" },
    { "id": "S5", "group": "S", "opposite": "A5", "scramble": "R U2 R' U' R U' R' F R' F' R U R U' R'", "solution": "(Righty) (Sledge) (Sune1a)" },
    { "id": "S6", "group": "S", "opposite": "A3", "scramble": "R' F R F' R U2' R' U' R' F R F'", "solution": "(Hedge) U R U2' R' (Hedge)" },
    { "id": "T1", "group": "T", "opposite": "L2", "scramble": "F R' F' R U R U' R'", "solution": "(Righty) (Sledge)" },
    { "id": "T2", "group": "T", "opposite": "L1", "scramble": "F R U' R' U' R U R' F'", "solution": "^(U2) R' F' R (*Righty) F" },
    { "id": "T3", "group": "T", "opposite": "T3", "scramble": "R2 U2 R' U2 R' F R F' U' R' U", "solution": "R2 U2 R' U2 (Sledge) U' R'" },
    { "id": "T4", "group": "T", "opposite": "U2", "scramble": "R' F R F' R' F R F' R U R' U' R U R' U'", "solution": "^(U) (R U' R') (*Righty) (Hedge)2" },
    { "id": "T5", "group": "T", "opposite": "U4", "scramble": "F R' F' R U' R U' R' U2 R U' R' U2", "solution": "^(U2) (R U R') U2 (R U R') U (Sledge)" },
    { "id": "T6", "group": "T", "opposite": "T6", "scramble": "R U' R' U' F R' F' R2 U' R' U'", "solution": "^(U') R U' R' U' (Hedge) (R U' R')" },
    { "id": "U1", "group": "U", "opposite": "U1", "scramble": "F R U R' U' F' U2", "solution": "F (Righty) F'" },
    { "id": "U2", "group": "U", "opposite": "T4", "scramble": "R U R' U R U2 R' U2 R' U' R U' R' U2 R U2", "solution": "(Sledge) (Sledge) (Righty) (R U R')" },
    { "id": "U3", "group": "U", "opposite": "U3", "scramble": "F R U' R2 F R F' R U2 R' F' U2", "solution": "F R U' R' (Sledge) R U2 R' F'" },
    { "id": "U4", "group": "U", "opposite": "T5", "scramble": "R U R' U2 R U R' U R' F R F'", "solution": "(Hedge) U' R U' R' U2 R U' R'" },
    { "id": "U5", "group": "U", "opposite": "L5", "scramble": "R U' R' U R U' R' F R' F' R2 U R' U'", "solution": "(*Righty) (Sledge) (Righty) (R U R')" },
    { "id": "U6", "group": "U", "opposite": "L6", "scramble": "R' U' R U2 R' F R' F' R U' R U'", "solution": "^(U) R' U (Sledge) R U2 R' U R" }
  ]
};

const GROUPS = ["A", "H", "L", "P", "S", "T", "U"];
// Order for browsing cases (picker and overview): groups whose same-coloured
// stickers sit next to each other are easier to recognise, so they come first.
const GROUP_DISPLAY_ORDER = ["H", "P", "U", "T", "L", "S", "A"];
const GROUP_NAMES = { A: "Anti-Sune", H: "H", L: "L", P: "Pi", S: "Sune", T: "T", U: "U" };
const CASE_IDS = cllCases.cases.map(c => c.id);
const casesByGroup = Object.fromEntries(
  GROUPS.map(g => [g, cllCases.cases.filter(c => c.group === g)])
);
const caseById = new Map(cllCases.cases.map(c => [c.id, c]));

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

const STATS_KEY = 'cllTrainerStats';
const SETTINGS_KEY = 'cllTrainerSettings';
const SOLVES_KEY = 'cllTrainerSolves';
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
let statsCollapsed = savedSettings.statsCollapsed ?? false;

// Modes: study (case info shown, no quiz), practice (untimed quiz with a
// Verify step), timed (countdown; answers are checked instantly and the next
// case appears right away). Older saves used a "showCaseInfo" flag.
const MODES = ["study", "practice", "timed", "solve"];
let mode = MODES.includes(savedSettings.mode)
  ? savedSettings.mode
  : (savedSettings.showCaseInfo ? "study" : "practice");
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
let solves = Array.isArray(readJSON(SOLVES_KEY)) ? readJSON(SOLVES_KEY).filter(x => x && caseById.has(x.id) && Number.isFinite(x.ms)) : [];

function saveSolves() {
  writeJSON(SOLVES_KEY, solves);
}

function clampMinutes(value) {
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.min(60, Math.max(1, n)) : 3;
}

let scramble = "";      // full alg for the 3D view (orientation + moves)
let scrambleMoves = ""; // moves only, for scrambling a physical cube (white on bottom)
let currentCaseId = null;
let currentCaseScramble = null;
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
    mode,
    timedMinutes,
    statsCollapsed
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

// Create scramble display element
const el = new ScrambleDisplay();
el.event = "222";
el.visualization = "3D";
displayContainer.appendChild(el);

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
      chip.textContent = caseObj.id.slice(group.length);
      chip.setAttribute("aria-label", `Case ${caseObj.id}`);
      chip.addEventListener("click", () => toggleCase(caseObj.id));
      row.appendChild(chip);
    });

    casePicker.appendChild(row);
  });
  renderSelection();
}

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
  setSelection(new Set(CASE_IDS));
});

document.getElementById("clearAllBtn").addEventListener("click", () => {
  setSelection(new Set());
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
}

document.querySelectorAll(".switch").forEach(btn => {
  btn.addEventListener("click", () => {
    const key = btn.dataset.toggle;
    if (key === "alwaysWhiteBottom") {
      alwaysWhiteBottom = !alwaysWhiteBottom;
    } else if (key === "allowAUF") {
      allowAUF = !allowAUF;
    }
    renderToggles();
    saveSettings();
    regenerateScramble();
  });
});

// ---------------------------------------------------------------------------
// Scramble generation
// ---------------------------------------------------------------------------

function getRandomCase() {
  if (selectedCases.size === 0) return null;
  const ids = [...selectedCases];
  return ids[Math.floor(Math.random() * ids.length)];
}

function randomU() {
  const turns = Math.floor(Math.random() * 4);
  return turns > 0 ? " U" + (turns > 1 ? turns : "") : "";
}

function buildScramble() {
  let orientation = "";
  if (alwaysWhiteBottom) {
    orientation = "z2";
  } else {
    const xRandRotations = Math.floor(Math.random() * 4);
    const yRandRotations = Math.floor(Math.random() * 4);
    const zRandRotations = Math.floor(Math.random() * 4);
    if (xRandRotations > 0) {
      orientation += " x" + (xRandRotations > 1 ? xRandRotations : "");
    }
    if (yRandRotations > 0) {
      orientation += " y" + (yRandRotations > 1 ? yRandRotations : "");
    }
    if (zRandRotations > 0) {
      orientation += " z" + (zRandRotations > 1 ? zRandRotations : "");
    }
  }

  let moves = "";

  // Optional U turn before the case (changes which side the case "faces")
  if (allowAUF) {
    moves += randomU();
  }

  const randomCase = getRandomCase();
  const caseObj = randomCase ? caseById.get(randomCase) : null;
  if (caseObj) {
    currentCaseId = caseObj.id;
    currentCaseScramble = caseObj.scramble;
    moves += " " + caseObj.scramble;

    // Make sure the case has a stats entry, but do not count it as shown yet
    if (!stats[currentCaseId]) stats[currentCaseId] = { shown: 0, correct: 0 };
  } else {
    currentCaseId = null;
    currentCaseScramble = null;
  }

  // Optional AUF after the case
  if (allowAUF) {
    moves += randomU();
  }

  scrambleMoves = moves.trim();
  scramble = `${orientation.trim()} ${scrambleMoves}`.trim();
  return scramble;
}

function regenerateScramble() {
  const hasCases = selectedCases.size > 0;
  emptyState.hidden = hasCases;

  if (hasCases) {
    buildScramble();
    el.scramble = scramble;
  } else {
    currentCaseId = null;
    currentCaseScramble = null;
    scramble = "";
    scrambleMoves = "";
    el.scramble = "";
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
  mode = next;
  saveSettings();
  renderStage();
}

modeButtons.forEach(btn => btn.addEventListener("click", () => setMode(btn.dataset.mode)));

// Shows/hides everything on the stage according to mode and session state.
function renderStage() {
  const hasCases = selectedCases.size > 0;
  const running = !!session;

  modeButtons.forEach(btn => btn.setAttribute("aria-pressed", String(btn.dataset.mode === mode)));

  updateCaseInfoDisplay();

  guessingContainer.hidden = !hasCases || !(mode === "practice" || (mode === "timed" && running));
  guessLabel.hidden = mode !== "practice";
  verifyBtn.hidden = mode !== "practice" || practiceAnswered;
  verifyMessage.hidden = !(mode === "practice" && practiceAnswered);
  timedFeedback.hidden = !(running && session.lastResult);

  timedBar.hidden = !running;
  timedSetup.hidden = !(mode === "timed" && !running && !sessionSummary);
  startSessionBtn.disabled = !hasCases;
  timedSummary.hidden = !(mode === "timed" && !running && sessionSummary);

  regenerateBtn.hidden = mode === "timed";

  // Solve mode: hide the cube (it would give the case away), show the
  // scramble as text plus the timer and the list of times.
  const solving = mode === "solve";
  cubeCard.hidden = solving && hasCases;
  solveScramble.hidden = !(solving && hasCases);
  solveSurface.hidden = !(solving && hasCases);
  solveTimes.hidden = !solving;
  if (solving) renderSolvePanel();
}

function updateCaseInfoDisplay() {
  const caseObj = currentCaseId ? caseById.get(currentCaseId) : null;
  if (mode === "study" && caseObj) {
    caseInfoContainer.innerHTML = `
      <div class="case-id">${caseObj.id}</div>
      <div class="case-solution"><b>Solution:</b> ${caseObj.solution || ''}</div>
      <div class="case-opposite">Opposite (after the alg): <strong>${caseObj.opposite}</strong></div>
    `;
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
// next scramble.
document.addEventListener("keydown", e => {
  if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
  if (!overview.hidden) return;
  const target = e.target;
  if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;

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

function renderSolvePanel() {
  solveScrambleText.textContent = scrambleMoves;

  if (lastSolve) {
    const caseObj = caseById.get(lastSolve.id);
    solveTimeEl.textContent = formatSolveTime(lastSolve.ms);
    solveCaseEl.innerHTML = `<strong>${lastSolve.id}</strong> · ${caseObj.solution} · opposite ${caseObj.opposite}`;
  } else {
    solveTimeEl.textContent = "0.00";
    solveCaseEl.textContent = "Scramble your cube, then time the solve. The case is revealed afterwards.";
  }

  if (solves.length) {
    const best = Math.min(...solves.map(x => x.ms));
    const mean = solves.reduce((sum, x) => sum + x.ms, 0) / solves.length;
    solveSummaryEl.textContent = `${solves.length} solve${solves.length === 1 ? "" : "s"} · best ${formatSolveTime(best)} · mean ${formatSolveTime(mean)}`;
  } else {
    solveSummaryEl.textContent = "No times yet";
  }
  clearSolvesBtn.hidden = solves.length === 0;
  solveList.innerHTML = solves
    .slice(-12)
    .reverse()
    .map(x => `<span class="solve-chip">${formatSolveTime(x.ms)}<span>${x.id}</span></span>`)
    .join("");
}

function armSolve() {
  if (mode !== "solve" || solveState !== "idle" || !currentCaseId) return;
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

  lastSolve = { id: currentCaseId, ms: Math.round(ms), at: Date.now() };
  solves.push(lastSolve);
  if (solves.length > MAX_SOLVES) solves.splice(0, solves.length - MAX_SOLVES);
  saveSolves();

  solveOverlayTime.textContent = formatSolveTime(ms);
  if (byPointer) {
    // keep covering the page until the finger lifts, so the tap that stopped
    // the timer cannot also press whatever is underneath
    overlayHideOnPointerUp = true;
    setTimeout(() => { if (overlayHideOnPointerUp) hideSolveOverlay(); }, 700);
  } else {
    hideSolveOverlay();
  }

  regenerateScramble(); // next scramble is ready while the case is revealed
}

function hideSolveOverlay() {
  overlayHideOnPointerUp = false;
  solveOverlay.hidden = true;
  solveOverlay.classList.remove("armed");
}

function cancelSolve() {
  solveState = "idle";
  cancelAnimationFrame(solveRaf);
  hideSolveOverlay();
}

// Keyboard: Space arms on keydown (ignoring auto-repeat), starts on keyup;
// any key stops a running timer; Escape cancels an armed one.
document.addEventListener("keydown", e => {
  if (mode !== "solve" || !overview.hidden) return;
  const target = e.target;
  if (target && ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName)) return;

  if (solveState === "running") {
    e.preventDefault();
    stopSolve(false);
    return;
  }
  if (e.code === "Space") {
    e.preventDefault(); // no page scroll, no button activation
    if (!e.repeat && solveState === "idle") armSolve();
    return;
  }
  if (e.key === "Escape" && solveState === "armed") cancelSolve();
});

document.addEventListener("keyup", e => {
  if (mode !== "solve" || !overview.hidden) return;
  if (e.code === "Space") {
    e.preventDefault();
    if (solveState === "armed") startSolve();
  }
});

// Touch / mouse: hold on the timer area, release anywhere to start; tap the
// full-screen overlay to stop.
solveSurface.addEventListener("pointerdown", e => {
  if (e.target.closest("button") || solveState !== "idle") return;
  e.preventDefault();
  armSolve();
});

solveOverlay.addEventListener("pointerdown", e => {
  e.preventDefault();
  if (solveState === "running") stopSolve(true);
});

document.addEventListener("pointerup", () => {
  if (solveState === "armed") {
    startSolve();
  } else if (overlayHideOnPointerUp) {
    hideSolveOverlay();
    // the click that follows this pointerup belongs to the stopping tap
    swallowNextClick = true;
    setTimeout(() => { swallowNextClick = false; }, 300);
  }
});

document.addEventListener("pointercancel", () => {
  if (solveState === "armed") cancelSolve();
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
    saveSolves();
    renderSolvePanel();
  }
});

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

      const diagram = document.createElement("div");
      diagram.className = "ov-diagram";
      diagram.innerHTML = caseDiagramSVG(solved.applyAlg(`z2 ${caseObj.scramble}`), caseObj.id);

      const id = document.createElement("div");
      id.className = "ov-id";
      id.textContent = caseObj.id;

      const opp = document.createElement("div");
      opp.className = "ov-opp";
      opp.textContent = `Opposite: ${caseObj.opposite}`;

      const alg = document.createElement("div");
      alg.className = "ov-alg";
      alg.textContent = caseObj.solution;

      card.append(diagram, id, opp, alg);
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
  if (e.key === "Escape" && !overview.hidden) closeOverview();
});

// ---------------------------------------------------------------------------
// Stats table
// ---------------------------------------------------------------------------

function updateStatsTable() {
  const caseNumbers = [1, 2, 3, 4, 5, 6];

  let html = '<table><thead><tr><th scope="col">Group</th>';
  caseNumbers.forEach(c => {
    html += `<th scope="col">${c}</th>`;
  });
  html += '<th scope="col">Total</th></tr></thead><tbody>';

  GROUPS.forEach(group => {
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
  if (confirm("Are you sure you want to reset all statistics?")) {
    for (const key in stats) {
      delete stats[key];
    }
    saveStats();
    updateStatsTable();
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
regenerateScramble();
