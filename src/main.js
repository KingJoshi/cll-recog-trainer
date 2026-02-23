import { ScrambleDisplay } from 'scramble-display';
import './style.css';

// Register service worker for offline support
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(err => {
    console.log('Service worker registration failed:', err);
  });
}

// CLL cases with scrambles
const cllCases = {
  "cases": [
    { "id": "H2", "group": "H", "scramble": "F R U R' U' R U R' U' R U R' U' F'" },
    { "id": "H1", "group": "H", "scramble": "R2 U2 R U2 R2" },
    { "id": "P4", "group": "P", "scramble": "U R' F R F' R U' R' U2 R' F R F'" },
    { "id": "P3", "group": "P", "scramble": "U' R U R' U R U R' F R' F' R" },
    { "id": "H4", "group": "H", "scramble": "U F R' F' R U2 R U R' F R' F' R" },
    { "id": "H3", "group": "H", "scramble": "U2 R' F R F' R U' R' U' R U' R'" },
    { "id": "P1", "group": "P", "scramble": "F R U R' U' R U R' U' F'" },
    { "id": "P5", "group": "P", "scramble": "U2 R' F2 R U R' F' R U2 R U' R' F" },
    { "id": "P6", "group": "P", "scramble": "R U2 R' U' R U R' U2 R' F R F'" },
    { "id": "P2", "group": "P", "scramble": "R U' R' U2 R' F R F' U2 R U R'" },
    { "id": "U3", "group": "U", "scramble": "F R U' R2 F R F' R U2 R' F'" },
    { "id": "U1", "group": "U", "scramble": "F R U R' U' F'" },
    { "id": "T4", "group": "T", "scramble": "R' F R F' R' F R F' R U R' U' R U R'" },
    { "id": "U2", "group": "U", "scramble": "R U R' U R U2 R' U2 R' U' R U' R' U2 R" },
    { "id": "T5", "group": "T", "scramble": "F R' F' R U' R U' R' U2 R U' R'" },
    { "id": "U4", "group": "U", "scramble": "U2 R U R' U2 R U R' U R' F R F'" },
    { "id": "T6", "group": "T", "scramble": "U' R U' R' U' F R' F' R2 U' R'" },
    { "id": "T3", "group": "T", "scramble": "R2 U2 R' U2 R' F R F' U' R'" },
    { "id": "A1", "group": "A", "scramble": "R U R' U R U2 R'" },
    { "id": "S1", "group": "S", "scramble": "R' U' R U' R' U2 R" },
    { "id": "A4", "group": "A", "scramble": "R U' R' F R' F' R" },
    { "id": "S4", "group": "S", "scramble": "U2 R' F R F' R U R'" },
    { "id": "T1", "group": "T", "scramble": "F R' F' R U R U' R'" },
    { "id": "T2", "group": "T", "scramble": "F R U' R' U' R U R' F'" },
    { "id": "L2", "group": "L", "scramble": "R U R' U' R' F R F'" },
    { "id": "L1", "group": "L", "scramble": "U2 R' F' R U R U' R' F" },
    { "id": "L6", "group": "L", "scramble": "U R' U R' F R F' R U2 R' U R" },
    { "id": "L5", "group": "L", "scramble": "U R U' R2 F R F' R U R' U' R U R'" },
    { "id": "A3", "group": "A", "scramble": "F R' F' R U R U2' R' F R' F' R" },
    { "id": "A6", "group": "A", "scramble": "F R' F' R U2 R U2 R'" },
    { "id": "A5", "group": "A", "scramble": "R U R' U' R' F R F' R U R' U R U2 R'" },
    { "id": "A2", "group": "A", "scramble": "R U R' U' R' F R F' R U' R' F R' F' R" },
    { "id": "S5", "group": "S", "scramble": "R U2 R' U' R U' R' F R' F' R U R U' R'" },
    { "id": "S6", "group": "S", "scramble": "U R' F R F' R U2' R' U' R' F R F'" },
    { "id": "S3", "group": "S", "scramble": "U2 R U2 R' U2 R' F R F'" },
    { "id": "S2", "group": "S", "scramble": "R' F R F' R U R' F R' F' R U R U' R'" },
    { "id": "L4", "group": "L", "scramble": "R U' R U' R U2 R' U R' U R'" },
    { "id": "U5", "group": "U", "scramble": "U' R U' R' U R U' R' F R' F' R2 U R'" },
    { "id": "U6", "group": "U", "scramble": "R' U' R U2 R' F R' F' R U' R" },
    { "id": "L3", "group": "L", "scramble": "U R' F2 R2 U' R' F R' F2 R" }
  ]
};

// App state
let alwaysWhiteBottom = true; // Default to checked
let scramble = "";
let allowAUF = true; // Default to checked
let selectedGroups = ["A", "H", "L", "P", "S", "T", "U"];
let selectedCases = [];
let availableCases = [];
let currentCaseId = null;
let currentCaseScramble = null;
let guessedGroup = null;
let guessedCase = null;
const displayContainer = document.getElementById("display-container");
const caseInfoContainer = document.getElementById("case-info-container");
const guessingContainer = document.getElementById("guessing-container");
const verifyMessage = document.getElementById("verify-message");

// Stats tracking
let stats = {};

// Load stats from localStorage if available
function loadStats() {
  const saved = localStorage.getItem('cllTrainerStats');
  if (saved) {
    try {
      stats = JSON.parse(saved);
    } catch (e) {
      stats = {};
    }
  }
}

// Save stats to localStorage
function saveStats() {
  localStorage.setItem('cllTrainerStats', JSON.stringify(stats));
}

loadStats();

// Create scramble display element
const el = new ScrambleDisplay();
el.event = "222";
el.visualization = "3D";
displayContainer.appendChild(el);

// Function to get available cases based on selected groups
function updateAvailableCases() {
  selectedGroups = Array.from(document.getElementById("groupSelect").selectedOptions).map(o => o.value);
  availableCases = cllCases.cases
    .filter(c => selectedGroups.includes(c.group))
    .sort((a, b) => {
      // Sort by group first (alphabetically), then by case number
      if (a.group !== b.group) {
        const groupOrder = ["A", "H", "L", "P", "S", "T", "U"];
        return groupOrder.indexOf(a.group) - groupOrder.indexOf(b.group);
      }
      const aNum = parseInt(a.id.slice(-1));
      const bNum = parseInt(b.id.slice(-1));
      return aNum - bNum;
    });
  updateCaseSelect();
}

// Function to populate case select based on available cases
// Add all / Clear all button handlers
document.getElementById('addAllBtn').addEventListener('click', () => {
  // Select all groups
  const groupSelect = document.getElementById('groupSelect');
  for (const option of groupSelect.options) {
    option.selected = true;
  }
  updateAvailableCases();
  // Select all cases
  const caseSelect = document.getElementById('caseSelect');
  for (const option of caseSelect.options) {
    option.selected = true;
  }
  updateSelectedCases();
  regenerateScramble();
});

document.getElementById('clearAllBtn').addEventListener('click', () => {
  // Deselect all groups
  const groupSelect = document.getElementById('groupSelect');
  for (const option of groupSelect.options) {
    option.selected = false;
  }
  updateAvailableCases();
  // Deselect all cases
  const caseSelect = document.getElementById('caseSelect');
  for (const option of caseSelect.options) {
    option.selected = false;
  }
  updateSelectedCases();
  regenerateScramble();
});
function updateCaseSelect() {
  const caseSelect = document.getElementById("caseSelect");
  const currentValues = Array.from(caseSelect.selectedOptions).map(o => o.value);
  caseSelect.innerHTML = "";
  availableCases.forEach(caseObj => {
    const option = document.createElement("option");
    option.value = caseObj.id;
    option.textContent = caseObj.id;
    option.selected = currentValues.includes(caseObj.id) || currentValues.length === 0;
    caseSelect.appendChild(option);
  });
  updateSelectedCases();
}

// Function to update selected cases
function updateSelectedCases() {
  selectedCases = Array.from(document.getElementById("caseSelect").selectedOptions).map(o => o.value);
}

// Function to build and update stats table
function updateStatsTable() {
  const groups = ["A", "H", "L", "P", "S", "T", "U"];
  const cases = [1, 2, 3, 4, 5, 6];

  let html = '<table><thead><tr><th>Group</th>';
  cases.forEach(c => {
    html += `<th>${c}</th>`;
  });
  html += '<th>T</th></tr></thead><tbody>';

  groups.forEach(group => {
    html += `<tr><th style="font-weight: bold; background-color: #f1f1f1;">${group}</th>`;

    cases.forEach(caseNum => {
      const caseId = `${group}${caseNum}`;
      const stat = stats[caseId];
      const correct = stat ? stat.correct : 0;
      const shown = stat ? stat.shown : 0;
      html += `<td>${correct}/${shown}</td>`;
    });

    // Show group total from stats
    const groupStat = stats[group];
    const groupCorrect = groupStat ? groupStat.correct : 0;
    const groupShown = groupStat ? groupStat.shown : 0;
    html += `<td style="font-weight: bold; background-color: #f1f1f1;">${groupCorrect}/${groupShown}</td>`;
    html += '</tr>';
  });

  html += '</tbody></table>';
  document.getElementById("stats-table-container").innerHTML = html;
}

// Initialize
updateAvailableCases();
toggleGuessingUI();

// Get random case from selected cases
function getRandomCase() {
  if (selectedCases.length === 0) return null;
  return selectedCases[Math.floor(Math.random() * selectedCases.length)];
}

// Build scramble string
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

  const randomCase = getRandomCase();
  if (randomCase) {
    const caseObj = cllCases.cases.find(c => c.id === randomCase);
    if (caseObj) {
      currentCaseId = caseObj.id;
      currentCaseScramble = caseObj.scramble;
      scramble += " " + caseObj.scramble;

      // Initialize stats for group and case, but do not increment 'shown' here
      const group = caseObj.group;
      if (!stats[group]) stats[group] = { shown: 0, correct: 0 };
      if (!stats[currentCaseId]) stats[currentCaseId] = { shown: 0, correct: 0 };
    }
  }

  if (allowAUF) {
    const aufRandRotations = Math.floor(Math.random() * 4);
    if (aufRandRotations > 0) {
      scramble += " U" + (aufRandRotations > 1 ? aufRandRotations : "");
    }
  }

  updateCaseInfoDisplay();
  return scramble;
}
// Initial scramble
buildScramble();
el.scramble = scramble;
updateStatsTable();

// Regenerate scramble
function regenerateScramble() {
  buildScramble();
  el.scramble = scramble;
  resetGuessingUI();
  updateStatsTable();
}

// Update case info display
function updateCaseInfoDisplay() {
  const showCaseInfo = document.getElementById("toggleShowCaseInfo").classList.contains("active");

  if (showCaseInfo && currentCaseId && currentCaseScramble) {
    caseInfoContainer.innerHTML = `
      <div class="case-id">${currentCaseId}</div>
      <div class="case-scramble">${currentCaseScramble}</div>
    `;
    caseInfoContainer.style.display = 'block';
  } else {
    caseInfoContainer.style.display = 'none';
  }
}

// Event listeners
document.getElementById("groupSelect").addEventListener("change", () => {
  updateAvailableCases();
  regenerateScramble();
});

document.getElementById("caseSelect").addEventListener("change", () => {
  updateSelectedCases();
  regenerateScramble();
});
document.getElementById("regenerateBtn").addEventListener("click", regenerateScramble);

// Toggle button listeners
document.querySelectorAll(".toggle-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    const toggleId = btn.dataset.toggle;

    if (toggleId === "alwaysWhiteBottom") {
      alwaysWhiteBottom = !alwaysWhiteBottom;
    } else if (toggleId === "allowAUF") {
      allowAUF = !allowAUF;
    } else if (toggleId === "showCaseInfo") {
      // Handle show case info toggle
      btn.classList.toggle("active");
      updateCaseInfoDisplay();
      toggleGuessingUI();
      return;
    }

    btn.classList.toggle("active");
    regenerateScramble();
  });
});

// Initialize toggle button states
function updateToggleStates() {
  document.getElementById("toggleAlwaysWhiteBottom").classList.toggle("active", alwaysWhiteBottom);
  document.getElementById("toggleAllowAUF").classList.toggle("active", allowAUF);
  document.getElementById("toggleShowCaseInfo").classList.toggle("active", false); // showCaseInfo starts unchecked
}

updateToggleStates();

// Guessing UI event listeners
document.querySelectorAll(".group-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".group-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    guessedGroup = btn.dataset.group;
    verifyMessage.style.display = "none";
  });
});

document.querySelectorAll(".case-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".case-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    guessedCase = btn.dataset.case;
    verifyMessage.style.display = "none";
  });
});

document.getElementById("verifyBtn").addEventListener("click", verifyGuess);

// Function to toggle guessing UI visibility
function toggleGuessingUI() {
  const showCaseInfo = document.getElementById("toggleShowCaseInfo").classList.contains("active");
  guessingContainer.style.display = showCaseInfo ? "none" : "block";
}

// Function to verify guess
function verifyGuess() {
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
  saveStats();

  // Update stats for correct guesses
  let statsChanged = false;
  if (groupCorrect && stats[correctGroup]) {
    stats[correctGroup].correct++;
    statsChanged = true;
  }
  if (caseCorrect && stats[currentCaseId]) {
    stats[currentCaseId].correct++;
    statsChanged = true;
  }
  if (statsChanged) saveStats();
  updateStatsTable();

  verifyMessage.style.display = "block";
  verifyMessage.className = "";
  document.getElementById("verifyBtn").style.display = "none";

  // Disable group and case guess buttons after verifying
  document.querySelectorAll('.group-btn').forEach(btn => btn.disabled = true);
  document.querySelectorAll('.case-btn').forEach(btn => btn.disabled = true);

  let message = "";
  if (groupCorrect && caseCorrect) {
    verifyMessage.className = "correct";
    message = "✓ Correct!";
  } else if (groupCorrect || caseCorrect) {
    verifyMessage.className = "partial";
    message = `Partial! Correct answer: ${currentCaseId}`;
  } else {
    verifyMessage.className = "incorrect";
    message = `Incorrect! Correct answer: ${currentCaseId}`;
  }

  // Build stats display
  const statsDisplay = buildStatsDisplay();
  verifyMessage.innerHTML = `${message}<div style="margin-top: 8px; font-size: 0.9rem; font-weight: normal;">${statsDisplay}</div>`;

  // Update stats table
  updateStatsTable();
}

// Function to build stats display
function buildStatsDisplay() {
  const statsArray = [];

  // Add group and case stats
  if (stats[guessedGroup]) {
    const group = guessedGroup;
    const shown = stats[group].shown;
    const correct = stats[group].correct;
    statsArray.push(`${group}: ${correct}/${shown}`);
  }

  if (stats[currentCaseId]) {
    const shown = stats[currentCaseId].shown;
    const correct = stats[currentCaseId].correct;
    statsArray.push(`${currentCaseId}: ${correct}/${shown}`);
  }

  return statsArray.join(", ");
}

// Function to reset guessing UI
function resetGuessingUI() {
  guessedGroup = null;
  guessedCase = null;
  document.querySelectorAll(".group-btn").forEach(btn => {
    btn.classList.remove("active");
    btn.disabled = false;
  });
  document.querySelectorAll(".case-btn").forEach(btn => {
    btn.classList.remove("active");
    btn.disabled = false;
  });
  verifyMessage.style.display = "none";
  document.getElementById("verifyBtn").style.display = "block";
}

// Collapsible functionality
const groupHeader = document.getElementById("groupHeader");
const caseHeader = document.getElementById("caseHeader");

groupHeader.addEventListener("click", () => {
  groupHeader.classList.toggle("collapsed");
});

caseHeader.addEventListener("click", () => {
  caseHeader.classList.toggle("collapsed");
});
// Reset stats button
document.getElementById("resetStatsBtn").addEventListener("click", () => {
  if (confirm("Are you sure you want to reset all statistics?")) {
    // Clear all stats
    for (const key in stats) {
      delete stats[key];
    }
    saveStats();
    // Update the table
    updateStatsTable();
  }
});