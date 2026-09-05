import { ScrambleDisplay } from 'scramble-display';
import { TwistyPlayer } from 'cubing/twisty';
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
let showCaseInfo = savedSettings.showCaseInfo ?? false;
let statsCollapsed = savedSettings.statsCollapsed ?? false;

let scramble = "";
let currentCaseId = null;
let currentCaseScramble = null;
let guessedGroup = null;
let guessedCase = null;
let settingsCollapsed = true; // narrow screens only; the sidebar is always open

let stats = readJSON(STATS_KEY) || {};

function saveStats() {
  writeJSON(STATS_KEY, stats);
}

function saveSettings() {
  writeJSON(SETTINGS_KEY, {
    selected: [...selectedCases],
    alwaysWhiteBottom,
    allowAUF,
    showCaseInfo,
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
  GROUPS.forEach(group => {
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
  document.getElementById("toggleShowCaseInfo").setAttribute("aria-pressed", String(showCaseInfo));
}

document.querySelectorAll(".switch").forEach(btn => {
  btn.addEventListener("click", () => {
    const key = btn.dataset.toggle;
    if (key === "alwaysWhiteBottom") {
      alwaysWhiteBottom = !alwaysWhiteBottom;
    } else if (key === "allowAUF") {
      allowAUF = !allowAUF;
    } else if (key === "showCaseInfo") {
      showCaseInfo = !showCaseInfo;
    }
    renderToggles();
    saveSettings();

    if (key === "showCaseInfo") {
      // Only switches between quiz mode and info mode; keep the current case
      updateCaseInfoDisplay();
      updateGuessingVisibility();
    } else {
      regenerateScramble();
    }
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
  scramble = "";
  if (alwaysWhiteBottom) {
    scramble += "z2";
  } else {
    const xRandRotations = Math.floor(Math.random() * 4);
    const yRandRotations = Math.floor(Math.random() * 4);
    const zRandRotations = Math.floor(Math.random() * 4);
    if (xRandRotations > 0) {
      scramble += " x" + (xRandRotations > 1 ? xRandRotations : "");
    }
    if (yRandRotations > 0) {
      scramble += " y" + (yRandRotations > 1 ? yRandRotations : "");
    }
    if (zRandRotations > 0) {
      scramble += " z" + (zRandRotations > 1 ? zRandRotations : "");
    }
  }

  // Optional U turn before the case (changes which side the case "faces")
  if (allowAUF) {
    scramble += randomU();
  }

  const randomCase = getRandomCase();
  const caseObj = randomCase ? caseById.get(randomCase) : null;
  if (caseObj) {
    currentCaseId = caseObj.id;
    currentCaseScramble = caseObj.scramble;
    scramble += " " + caseObj.scramble;

    // Initialize stats for group and case, but do not increment 'shown' here
    const group = caseObj.group;
    if (!stats[group]) stats[group] = { shown: 0, correct: 0 };
    if (!stats[currentCaseId]) stats[currentCaseId] = { shown: 0, correct: 0 };
  } else {
    currentCaseId = null;
    currentCaseScramble = null;
  }

  // Optional AUF after the case
  if (allowAUF) {
    scramble += randomU();
  }

  scramble = scramble.trim();
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
    el.scramble = "";
  }

  resetGuessingUI();
  updateCaseInfoDisplay();
  updateGuessingVisibility();
  updateStatsTable();
}

regenerateBtn.addEventListener("click", regenerateScramble);

// ---------------------------------------------------------------------------
// Case info / guessing UI
// ---------------------------------------------------------------------------

function updateCaseInfoDisplay() {
  const caseObj = currentCaseId ? caseById.get(currentCaseId) : null;
  if (showCaseInfo && caseObj) {
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

function updateGuessingVisibility() {
  guessingContainer.hidden = showCaseInfo || selectedCases.size === 0;
}

groupButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    groupButtons.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    guessedGroup = btn.dataset.group;
    verifyMessage.hidden = true;
  });
});

caseButtons.forEach(btn => {
  btn.addEventListener("click", () => {
    caseButtons.forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    guessedCase = btn.dataset.case;
    verifyMessage.hidden = true;
  });
});

verifyBtn.addEventListener("click", verifyGuess);

function verifyGuess() {
  if (!currentCaseId) return;
  if (!guessedGroup || !guessedCase) {
    alert("Please select both a group and a case number.");
    return;
  }

  const correctGroup = currentCaseId.slice(0, currentCaseId.length - 1);
  const correctCase = currentCaseId.slice(-1);

  const groupCorrect = guessedGroup === correctGroup;
  const caseCorrect = guessedCase === correctCase;

  // Increment 'shown' for group and case on every guess
  if (stats[correctGroup]) stats[correctGroup].shown++;
  if (stats[currentCaseId]) stats[currentCaseId].shown++;

  if (groupCorrect && stats[correctGroup]) stats[correctGroup].correct++;
  if (caseCorrect && stats[currentCaseId]) stats[currentCaseId].correct++;
  saveStats();
  updateStatsTable();

  // Lock the guess
  verifyBtn.hidden = true;
  groupButtons.forEach(btn => (btn.disabled = true));
  caseButtons.forEach(btn => (btn.disabled = true));
  regenerateBtn.classList.remove("btn-outline");
  regenerateBtn.classList.add("btn-primary");

  let cls = "";
  let message = "";
  if (groupCorrect && caseCorrect) {
    cls = "correct";
    message = "✓ Correct!";
  } else if (groupCorrect || caseCorrect) {
    cls = "partial";
    message = `Partial! Correct answer: ${currentCaseId}`;
  } else {
    cls = "incorrect";
    message = `Incorrect! Correct answer: ${currentCaseId}`;
  }

  verifyMessage.className = `verify-message ${cls}`;
  verifyMessage.innerHTML = statsCollapsed
    ? message
    : `${message}<div class="verify-stats">${buildStatsDisplay()}</div>`;
  verifyMessage.hidden = false;
}

function buildStatsDisplay() {
  const parts = [];
  if (stats[guessedGroup]) {
    parts.push(`${guessedGroup}: ${stats[guessedGroup].correct}/${stats[guessedGroup].shown}`);
  }
  if (stats[currentCaseId]) {
    parts.push(`${currentCaseId}: ${stats[currentCaseId].correct}/${stats[currentCaseId].shown}`);
  }
  return parts.join(", ");
}

function resetGuessingUI() {
  guessedGroup = null;
  guessedCase = null;
  groupButtons.forEach(btn => {
    btn.classList.remove("active");
    btn.disabled = false;
  });
  caseButtons.forEach(btn => {
    btn.classList.remove("active");
    btn.disabled = false;
  });
  verifyMessage.hidden = true;
  verifyBtn.hidden = false;
  regenerateBtn.classList.remove("btn-primary");
  regenerateBtn.classList.add("btn-outline");
}

// ---------------------------------------------------------------------------
// Case overview: every case with a top-view diagram, its opposite and alg
// ---------------------------------------------------------------------------

let overviewBuilt = false;

function createCaseDiagram(caseObj) {
  // Same orientation as the trainer with "Always white bottom": z2 first,
  // then the case scramble; the 2D last-layer view shows the top face plus
  // the side stickers of the top layer.
  return new TwistyPlayer({
    puzzle: "2x2x2",
    alg: `z2 ${caseObj.scramble}`,
    visualization: "experimental-2D-LL",
    controlPanel: "none",
    background: "none",
    viewerLink: "none",
    hintFacelets: "none",
    experimentalDragInput: "none"
  });
}

function buildOverview() {
  overviewBody.innerHTML = "";

  const hint = document.createElement("p");
  hint.className = "overview-hint";
  hint.textContent = "Top view of each case (white on bottom). \"Opposite\" is the case you get by doing the alg on a solved cube.";
  overviewBody.appendChild(hint);

  GROUPS.forEach(group => {
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
      diagram.appendChild(createCaseDiagram(caseObj));

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

function openOverview() {
  if (!overviewBuilt) buildOverview();
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

    const groupStat = stats[group];
    const groupCorrect = groupStat ? groupStat.correct : 0;
    const groupShown = groupStat ? groupStat.shown : 0;
    html += `<td class="total">${groupCorrect}/${groupShown}</td></tr>`;
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
syncSettingsPanel();
syncStatsPanel();
regenerateScramble();
