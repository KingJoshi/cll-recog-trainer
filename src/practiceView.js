// Practice View: Multi-Mode Recognition & Inspection Planning Drills
// Supports both Casual Practice and Timed Sprints (consolidated)

import { getTrack } from './data/algRegistry.js';
import { findLayerSolutions } from './layerSolver.js';
import { findCrossSolutions } from './crossSolver.js';

export class PracticeView {
  constructor(options) {
    this.container = options.container;
    this.onGenerateScramble = options.onGenerateScramble; // () => Promise<{ scramble, caseObj }>
    this.onApplyScrambleToDisplay = options.onApplyScrambleToDisplay; // (scramble) => void
    this.onRecordRecognition = options.onRecordRecognition; // (caseId, isCorrect) => void
    this.onFlashCube = options.onFlashCube; // (result) => void

    this.currentPuzzle = "222";
    this.currentTrackId = "cll";
    this.practiceMode = "casual"; // "casual" | "timed"
    this.twoSidedMode = false;

    // Inspection drill state (for 1st Layer / White Cross)
    this.inspectionRunning = false;
    this.inspectionSeconds = 15;
    this.inspectionTimerId = null;
    this.inspectionScramble = "";
    this.inspectionSolutions = [];
    this.solutionRevealed = false;

    // Casual Recognition quiz state
    this.currentCase = null;
    this.guessGroup = null;
    this.guessCase = null;
    this.score = 0;
    this.streak = 0;
    this.answered = false;
    this.lastResult = null;

    // Timed sprint state
    this.sprintMinutes = 3;
    this.sprintRunning = false;
    this.sprintSession = null;
    this.sprintSummary = null;
    this.sprintTimerId = null;
  }

  async setTrack(puzzleId, trackId) {
    this.currentPuzzle = puzzleId;
    this.currentTrackId = trackId;
    this.stopInspectionTimer();
    if (this.sprintRunning) {
      this.finishSprint();
    }
    this.solutionRevealed = false;
    this.answered = false;
    this.guessGroup = null;
    this.guessCase = null;
    this.lastResult = null;

    if (this.onGenerateScramble) {
      const res = await this.onGenerateScramble(this.currentTrackId);
      if (typeof res === 'object' && res?.caseObj) {
        this.currentCase = res.caseObj;
      } else if (typeof res === 'string') {
        this.inspectionScramble = res;
      }
    }
    this.render();
  }

  setPracticeMode(mode) {
    if (this.practiceMode === mode) return;
    this.practiceMode = mode;
    this.stopInspectionTimer();
    if (this.sprintRunning) {
      this.finishSprint();
    }
    this.answered = false;
    this.guessGroup = null;
    this.guessCase = null;
    this.lastResult = null;
    this.render();
  }

  render() {
    if (!this.container) return;
    const isInspectionDrill = (this.currentPuzzle === "222" && this.currentTrackId === "layer") ||
                             (this.currentPuzzle === "333" && this.currentTrackId === "cross");

    this.container.innerHTML = `
      <div class="practice-header">
        <div class="practice-title-group">
          <h2 class="practice-title">${isInspectionDrill ? 'Inspection Planning Drill' : 'Case Recognition Drill'}</h2>
          <span class="practice-subtext">
            ${isInspectionDrill
              ? 'Plan your solution under 15s WCA inspection, then verify with the optimal solver'
              : 'Identify the case from the 3D cube and test your recognition speed'}
          </span>
        </div>

        <div class="practice-subnav" role="group" aria-label="Practice Mode">
          <button type="button" class="practice-subnav-btn ${this.practiceMode === 'casual' ? 'active' : ''}" data-mode="casual">Casual Practice</button>
          <button type="button" class="practice-subnav-btn ${this.practiceMode === 'timed' ? 'active' : ''}" data-mode="timed">Timed Sprint</button>
        </div>
      </div>

      <div class="practice-body">
        ${isInspectionDrill
          ? (this.practiceMode === 'timed' ? this.renderTimedInspectionDrill() : this.renderInspectionDrill())
          : (this.practiceMode === 'timed' ? this.renderTimedRecognitionDrill() : this.renderCasualRecognitionDrill())}
      </div>
    `;

    this.bindEvents(isInspectionDrill);
  }

  // ---------------------------------------------------------------------------
  // Casual Inspection Drill (White Cross / 1st Layer)
  // ---------------------------------------------------------------------------
  renderInspectionDrill() {
    const is3x3 = this.currentPuzzle === "333";
    return `
      <div class="inspection-drill-card">
        <div class="inspection-timer-box">
          <div class="inspection-clock ${this.inspectionSeconds <= 3 ? 'danger' : this.inspectionSeconds <= 7 ? 'warning' : ''}">
            ${this.inspectionSeconds}s
          </div>
          <span class="inspection-clock-label">${this.inspectionRunning ? 'Inspection time remaining' : 'Ready'}</span>
        </div>

        <div class="inspection-actions-row">
          <button type="button" id="startInspectionBtn" class="btn btn-primary" ${this.inspectionRunning ? 'disabled' : ''}>
            ${this.inspectionRunning ? 'Inspecting...' : 'Start 15s Inspection'}
          </button>
          <button type="button" id="newDrillScrambleBtn" class="btn btn-small">New Scramble</button>
          <button type="button" id="revealSolutionsBtn" class="btn btn-small" ${!this.solutionRevealed ? '' : 'disabled'}>
            ${this.solutionRevealed ? 'Solutions Revealed' : 'Reveal Optimal Solutions'}
          </button>
        </div>

        ${this.solutionRevealed ? this.renderInspectionSolutionsList(is3x3) : ''}
      </div>
    `;
  }

  // ---------------------------------------------------------------------------
  // Timed Inspection Drill (Sprint through scrambles with automatic 15s timer)
  // ---------------------------------------------------------------------------
  renderTimedInspectionDrill() {
    const is3x3 = this.currentPuzzle === "333";
    return `
      <div class="inspection-drill-card">
        <div class="inspection-timer-box">
          <div class="inspection-clock ${this.inspectionSeconds <= 3 ? 'danger' : this.inspectionSeconds <= 7 ? 'warning' : ''}">
            ${this.inspectionSeconds}s
          </div>
          <span class="inspection-clock-label">${this.inspectionRunning ? 'WCA Inspection in progress' : 'Ready for next inspection'}</span>
        </div>

        <div class="inspection-actions-row">
          <button type="button" id="startInspectionBtn" class="btn btn-primary" ${this.inspectionRunning ? 'disabled' : ''}>
            ${this.inspectionRunning ? 'Inspecting...' : 'Start 15s Timer'}
          </button>
          <button type="button" id="revealSolutionsBtn" class="btn btn-small">
            ${this.solutionRevealed ? 'Next Scramble' : 'Done & Reveal Solutions'}
          </button>
        </div>

        ${this.solutionRevealed ? this.renderInspectionSolutionsList(is3x3) : ''}
      </div>
    `;
  }

  renderInspectionSolutionsList(is3x3) {
    return `
      <div class="inspection-solutions-reveal">
        <h4 class="inspection-reveal-title">
          Optimal ${is3x3 ? 'White Cross' : '1st Layer'} Solutions:
        </h4>
        <div class="inspection-solutions-list">
          ${this.inspectionSolutions.map((sol, idx) => `
            <div class="inspection-sol-item">
              <div class="inspection-sol-head">
                <span class="sol-badge">#${idx + 1} (${sol.moveCount} moves)</span>
                <span class="sol-insp">Inspection: <strong>${sol.insp || 'none'}</strong></span>
                ${sol.crossPlus1?.hasPair ? `<span class="sol-chip chip-cross1">${sol.crossPlus1.description}</span>` : ''}
                ${sol.eoSummary ? `<span class="sol-chip chip-eo">${sol.eoSummary.note}</span>` : ''}
              </div>
              <div class="inspection-sol-moves">${sol.moves}</div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  // ---------------------------------------------------------------------------
  // Casual Recognition Drill
  // ---------------------------------------------------------------------------
  renderCasualRecognitionDrill() {
    const track = getTrack(this.currentPuzzle, this.currentTrackId);
    const is3x3Recog = (this.currentPuzzle === "333" || this.currentPuzzle === "333oh") && ["pll", "oll"].includes(this.currentTrackId);
    return `
      <div class="recognition-drill-card">
        <div class="recognition-status-bar">
          <div class="recognition-score-item">
            <span class="score-label">Streak:</span>
            <span class="score-value" id="practiceStreakVal">${this.streak}</span>
          </div>
          <div class="recognition-score-item">
            <span class="score-label">Score:</span>
            <span class="score-value" id="practiceScoreVal">${this.score}</span>
          </div>
          ${is3x3Recog ? `
            <div class="recognition-mode-toggle-wrap" style="margin-left: auto;">
              <button type="button" class="btn btn-xs btn-twosided-toggle ${this.twoSidedMode ? 'active' : ''}" id="toggleTwoSidedModeBtn">
                👀 2-Sided Recog: <strong>${this.twoSidedMode ? 'ON' : 'OFF'}</strong>
              </button>
            </div>
          ` : ''}
        </div>

        ${is3x3Recog && this.twoSidedMode ? `
          <div class="twosided-banner">
            <span class="twosided-banner-icon">👀</span>
            <span><strong>2-Sided Recognition Drill Active:</strong> Identify the ${this.currentTrackId.toUpperCase()} case looking only at the <strong>Front and Right</strong> faces without rotating the cube!</span>
          </div>
        ` : ''}

        <div class="recognition-keypad-box" id="recognitionKeypad">
          ${this.renderKeypadForTrack(track)}
        </div>

        <div id="recognitionFeedback" class="recognition-feedback ${this.lastResult ? (this.lastResult.isCorrect ? 'correct' : 'incorrect') : ''}" ${this.lastResult ? '' : 'hidden'}>
          ${this.lastResult ? (this.lastResult.isCorrect
            ? `🎉 <strong>Correct!</strong> That is ${this.lastResult.name}.`
            : `❌ <strong>Incorrect.</strong> The case was <strong>${this.lastResult.name}</strong>.`) : ''}
        </div>

        <div class="recognition-actions">
          <button type="button" id="verifyRecognitionBtn" class="btn btn-primary" ${this.answered ? 'disabled' : ''}>Verify</button>
          <button type="button" id="nextRecognitionScrambleBtn" class="btn btn-small">Next Scramble</button>
        </div>
      </div>
    `;
  }

  // ---------------------------------------------------------------------------
  // Timed Recognition Sprint (Merged from former Timed tab)
  // ---------------------------------------------------------------------------
  renderTimedRecognitionDrill() {
    if (!this.sprintRunning && !this.sprintSummary) {
      return this.renderSprintSetup();
    }
    if (this.sprintRunning) {
      return this.renderActiveSprint();
    }
    return this.renderSprintSummary();
  }

  renderSprintSetup() {
    return `
      <div class="timed-setup">
        <p class="timed-title">Timed Recognition Sprint</p>
        <p class="hint">Answers are checked instantly as you select them, and the next case appears right away.</p>
        <div class="minutes-row">
          <button type="button" id="sprintDecBtn" class="btn" aria-label="One minute less">&minus;</button>
          <label class="minutes-field">
            <input type="number" id="sprintMinInput" min="1" max="60" step="1" inputmode="numeric" value="${this.sprintMinutes}" aria-label="Minutes">
            <span>min</span>
          </label>
          <button type="button" id="sprintIncBtn" class="btn" aria-label="One minute more">+</button>
        </div>
        <button type="button" id="startSprintBtn" class="btn btn-primary btn-block">Start Sprint</button>
      </div>
    `;
  }

  renderActiveSprint() {
    const track = getTrack(this.currentPuzzle, this.currentTrackId);
    const remaining = Math.max(0, this.sprintSession.endTime - Date.now());
    const pct = Math.max(0, Math.min(100, (remaining / this.sprintSession.durationMs) * 100));

    return `
      <div class="recognition-drill-card">
        <div class="timed-bar">
          <div class="timed-bar-row">
            <span id="sprintCountdown" class="countdown ${remaining <= 10000 ? 'urgent' : ''}" role="timer">${this.formatTime(remaining)}</span>
            <span id="sprintLiveTally" class="live-tally">
              ${this.sprintSession.attempts
                ? `${this.sprintSession.correct} / ${this.sprintSession.attempts} correct`
                : 'Select an answer to begin'}
            </span>
            <button type="button" id="endSprintBtn" class="btn btn-small">End</button>
          </div>
          <div class="timed-progress">
            <div id="sprintProgress" class="timed-progress-fill" style="width: ${pct}%"></div>
          </div>
        </div>

        ${this.sprintSession.lastResult ? `
          <div class="recognition-feedback ${this.sprintSession.lastResult.isCorrect ? 'correct' : 'incorrect'}">
            ${this.sprintSession.lastResult.isCorrect
              ? `✓ <strong>Correct!</strong> ${this.sprintSession.lastResult.correctId}`
              : `✗ <strong>Wrong:</strong> It was <strong>${this.sprintSession.lastResult.correctId}</strong> (you said ${this.sprintSession.lastResult.guessedId})`}
          </div>
        ` : ''}

        <div class="recognition-keypad-box" id="recognitionKeypad">
          ${this.renderKeypadForTrack(track)}
        </div>
      </div>
    `;
  }

  renderSprintSummary() {
    const s = this.sprintSummary;
    const accuracy = s.attempts ? Math.round((100 * s.correct) / s.attempts) : 0;
    const pace = s.attempts ? (s.elapsedMs / s.attempts / 1000).toFixed(1) + "s" : "–";
    const timedOut = s.elapsedMs >= s.durationMs;

    const groupKeys = Object.keys(s.perGroup);
    const groupsHtml = groupKeys.length > 0 ? groupKeys.map(g =>
      `<span class="summary-group"><b>${g}</b> ${s.perGroup[g].correct}/${s.perGroup[g].attempts}</span>`
    ).join(' ') : '';

    return `
      <div class="timed-summary" role="status">
        <p class="summary-title">${timedOut ? "Time's up!" : "Sprint ended"} <span class="summary-time">${this.formatTime(s.elapsedMs)}</span></p>
        <div class="summary-stats">
          <div class="stat"><b>${s.attempts}</b><span>answered</span></div>
          <div class="stat stat-correct"><b>${s.correct}</b><span>correct</span></div>
          <div class="stat stat-incorrect"><b>${s.wrong}</b><span>wrong</span></div>
          <div class="stat"><b>${accuracy}%</b><span>accuracy</span></div>
          <div class="stat"><b>${pace}</b><span>per case</span></div>
        </div>
        ${groupsHtml ? `<div class="summary-groups" style="margin-top: 12px; display: flex; flex-wrap: wrap; gap: 6px; justify-content: center;">${groupsHtml}</div>` : ''}
        <div style="margin-top: 14px; display: flex; gap: 8px;">
          <button type="button" id="sprintAgainBtn" class="btn btn-primary" style="flex: 1;">Start Another Sprint</button>
          <button type="button" id="sprintDoneBtn" class="btn" style="flex: 1;">Done</button>
        </div>
      </div>
    `;
  }

  renderKeypadForTrack(track) {
    if (!track) return '';

    if (track.id === "parity") {
      const parityCases = this.currentPuzzle === "444"
        ? [
            { id: "444-oll-parity", label: "OLL Parity (Single Dedge)" },
            { id: "444-pll-opp-parity", label: "PLL Parity (Opposite)" },
            { id: "444-pll-adj-parity", label: "PLL Parity (Adjacent)" }
          ]
        : [
            { id: "555-l2e-flip", label: "Lucas Parity (Middle Flip)" },
            { id: "555-l2e-wings", label: "Wing Swap (Slice-Flip-Slice)" }
          ];
      return `
        <p class="guess-label">Which ${this.currentPuzzle === "444" ? "4x4" : "5x5"} Parity is it?</p>
        <div class="ortega-pill-row" style="flex-wrap: wrap; gap: 8px;">
          ${parityCases.map(c => `
            <button type="button" class="btn-recog-key ${this.guessCase === c.id ? 'active' : ''}" data-case="${c.id}">${c.label}</button>
          `).join('')}
        </div>
      `;
    }

    if (track.id === "pll") {
      const pllNames = ["Ua", "Ub", "H", "Z", "Aa", "Ab", "Ja", "Jb", "Ra", "Rb", "T", "F", "V", "Y", "E", "Na", "Nb", "Ga", "Gb", "Gc", "Gd"];
      return `
        <p class="guess-label">Which PLL is it?</p>
        <div class="pll-keypad-grid">
          ${pllNames.map(name => `
            <button type="button" class="btn-recog-key pll-key ${this.guessCase === name ? 'active' : ''}" data-case="${name}">${name}</button>
          `).join('')}
        </div>
      `;
    }

    if (track.id === "ortega") {
      const ortegaOll = ["H", "Pi", "Antisune", "Sune", "L", "T", "U"];
      const ortegaPbl = ["Adj/Adj", "Opp/Opp", "Adj/Opp", "Adj/Solved", "Opp/Solved"];
      return `
        <p class="guess-label">Select the Ortega case:</p>
        <div class="ortega-keypad-sections">
          <div class="ortega-keypad-group">
            <span class="ortega-group-label">OLL:</span>
            <div class="ortega-pill-row">
              ${ortegaOll.map(c => `
                <button type="button" class="btn-recog-key ${this.guessCase === c ? 'active' : ''}" data-case="${c}">${c}</button>
              `).join('')}
            </div>
          </div>
          <div class="ortega-keypad-group" style="margin-top: 8px;">
            <span class="ortega-group-label">PBL:</span>
            <div class="ortega-pill-row">
              ${ortegaPbl.map(c => `
                <button type="button" class="btn-recog-key ${this.guessCase === c ? 'active' : ''}" data-case="${c}">${c}</button>
              `).join('')}
            </div>
          </div>
        </div>
      `;
    }

    if (track.id === "oll") {
      // Common OLL cases / Cross OLL
      const ollCross = ["H (21)", "Pi (22)", "Antisune (26)", "Sune (27)", "L (24)", "T (25)", "U (23)"];
      return `
        <p class="guess-label">Select OLL Cross case:</p>
        <div class="ortega-pill-row">
          ${ollCross.map(c => `
            <button type="button" class="btn-recog-key ${this.guessCase === c ? 'active' : ''}" data-case="${c}">${c}</button>
          `).join('')}
        </div>
      `;
    }

    // Default CLL: Group buttons + Number buttons
    return `
      <p class="guess-label">Which case is it?</p>
      <div class="seg seg-group" role="group" aria-label="Guess the group">
        ${["H", "P", "U", "T", "L", "S", "A"].map(g => `
          <button type="button" class="group-btn ${this.guessGroup === g ? 'active' : ''}" data-group="${g}">${g}</button>
        `).join('')}
      </div>
      <div class="seg seg-case" role="group" aria-label="Guess the case number">
        ${[1, 2, 3, 4, 5, 6].map(n => `
          <button type="button" class="case-btn ${this.guessCase === String(n) ? 'active' : ''}" data-case="${n}">${n}</button>
        `).join('')}
      </div>
    `;
  }

  // ---------------------------------------------------------------------------
  // Event Binding
  // ---------------------------------------------------------------------------
  bindEvents(isInspectionDrill) {
    this.container.querySelectorAll('.practice-subnav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.setPracticeMode(btn.dataset.mode);
      });
    });

    if (isInspectionDrill) {
      const startBtn = this.container.querySelector('#startInspectionBtn');
      if (startBtn) {
        startBtn.addEventListener('click', () => this.startInspectionTimer());
      }

      const revealBtn = this.container.querySelector('#revealSolutionsBtn');
      if (revealBtn) {
        revealBtn.addEventListener('click', () => {
          if (!this.solutionRevealed) {
            this.revealInspectionSolutions();
          } else {
            // Next scramble
            this.advanceInspectionScramble();
          }
        });
      }

      const newBtn = this.container.querySelector('#newDrillScrambleBtn');
      if (newBtn) {
        newBtn.addEventListener('click', () => this.advanceInspectionScramble());
      }
      return;
    }

    // Timed sprint event bindings
    if (this.practiceMode === "timed") {
      if (!this.sprintRunning && !this.sprintSummary) {
        const decBtn = this.container.querySelector('#sprintDecBtn');
        const incBtn = this.container.querySelector('#sprintIncBtn');
        const minInput = this.container.querySelector('#sprintMinInput');
        const startBtn = this.container.querySelector('#startSprintBtn');

        if (decBtn) decBtn.addEventListener('click', () => {
          this.sprintMinutes = Math.max(1, this.sprintMinutes - 1);
          if (minInput) minInput.value = this.sprintMinutes;
        });
        if (incBtn) incBtn.addEventListener('click', () => {
          this.sprintMinutes = Math.min(60, this.sprintMinutes + 1);
          if (minInput) minInput.value = this.sprintMinutes;
        });
        if (minInput) minInput.addEventListener('change', () => {
          const val = parseInt(minInput.value, 10);
          this.sprintMinutes = isNaN(val) ? 3 : Math.max(1, Math.min(60, val));
          minInput.value = this.sprintMinutes;
        });
        if (startBtn) startBtn.addEventListener('click', () => this.startSprint());
        return;
      }

      if (this.sprintRunning) {
        const endBtn = this.container.querySelector('#endSprintBtn');
        if (endBtn) endBtn.addEventListener('click', () => this.finishSprint());

        // Instant answer submission buttons
        this.container.querySelectorAll('.btn-recog-key').forEach(btn => {
          btn.addEventListener('click', () => {
            this.submitSprintAnswer(btn.dataset.case);
          });
        });

        this.container.querySelectorAll('.group-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            this.guessGroup = btn.dataset.group;
            if (this.guessCase) {
              this.submitSprintAnswer(`${this.guessGroup}${this.guessCase}`);
            } else {
              this.render();
            }
          });
        });

        this.container.querySelectorAll('.case-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            this.guessCase = btn.dataset.case;
            if (this.guessGroup) {
              this.submitSprintAnswer(`${this.guessGroup}${this.guessCase}`);
            } else {
              this.render();
            }
          });
        });
        return;
      }

      if (this.sprintSummary) {
        const againBtn = this.container.querySelector('#sprintAgainBtn');
        const doneBtn = this.container.querySelector('#sprintDoneBtn');
        if (againBtn) againBtn.addEventListener('click', () => this.startSprint());
        if (doneBtn) doneBtn.addEventListener('click', () => {
          this.sprintSummary = null;
          this.render();
        });
        return;
      }
    }

    // Casual recognition drill event bindings
    const twoSidedToggle = this.container.querySelector('#toggleTwoSidedModeBtn');
    if (twoSidedToggle) {
      twoSidedToggle.addEventListener('click', () => {
        this.twoSidedMode = !this.twoSidedMode;
        this.render();
      });
    }

    this.container.querySelectorAll('.btn-recog-key').forEach(btn => {
      btn.addEventListener('click', () => {
        this.guessCase = btn.dataset.case;
        this.render();
      });
    });

    this.container.querySelectorAll('.group-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.guessGroup = btn.dataset.group;
        this.render();
      });
    });

    this.container.querySelectorAll('.case-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.guessCase = btn.dataset.case;
        this.render();
      });
    });

    const verifyBtn = this.container.querySelector('#verifyRecognitionBtn');
    if (verifyBtn) {
      verifyBtn.addEventListener('click', () => this.verifyCasualGuess());
    }

    const nextBtn = this.container.querySelector('#nextRecognitionScrambleBtn');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => this.advanceCasualScramble());
    }
  }

  // ---------------------------------------------------------------------------
  // Sprint Management
  // ---------------------------------------------------------------------------
  startSprint() {
    this.sprintRunning = true;
    this.sprintSummary = null;
    const durationMs = this.sprintMinutes * 60 * 1000;
    const now = Date.now();
    this.sprintSession = {
      durationMs,
      startedAt: now,
      endTime: now + durationMs,
      attempts: 0,
      correct: 0,
      wrong: 0,
      perGroup: {},
      lastResult: null
    };
    if (this.sprintTimerId) clearInterval(this.sprintTimerId);
    this.sprintTimerId = setInterval(() => this.tickSprint(), 200);
    this.advanceSprintScramble();
  }

  tickSprint() {
    if (!this.sprintRunning || !this.sprintSession) return;
    const remaining = Math.max(0, this.sprintSession.endTime - Date.now());
    const clock = this.container?.querySelector('#sprintCountdown');
    const prog = this.container?.querySelector('#sprintProgress');
    if (clock) {
      clock.textContent = this.formatTime(remaining);
      clock.classList.toggle('urgent', remaining <= 10000);
    }
    if (prog) {
      prog.style.width = `${(remaining / this.sprintSession.durationMs) * 100}%`;
    }
    if (remaining === 0) {
      this.finishSprint();
    }
  }

  async advanceSprintScramble() {
    this.guessGroup = null;
    this.guessCase = null;
    if (this.onGenerateScramble) {
      const res = await this.onGenerateScramble(this.currentTrackId);
      this.currentCase = typeof res === 'object' ? res?.caseObj : null;
    }
    this.render();
  }

  submitSprintAnswer(guess) {
    if (!this.sprintRunning || !this.sprintSession || !this.currentCase) return;

    const isCorrect = this.checkAnswerMatch(guess);
    this.sprintSession.attempts++;
    if (isCorrect) {
      this.sprintSession.correct++;
    } else {
      this.sprintSession.wrong++;
    }

    const grp = this.currentCase.group || this.currentCase.id;
    if (grp) {
      const gTally = this.sprintSession.perGroup[grp] || (this.sprintSession.perGroup[grp] = { attempts: 0, correct: 0 });
      gTally.attempts++;
      if (isCorrect) gTally.correct++;
    }

    this.sprintSession.lastResult = {
      isCorrect,
      correctId: this.currentCase.name || this.currentCase.id,
      guessedId: guess
    };

    if (this.onRecordRecognition) {
      this.onRecordRecognition(this.currentCase.id, isCorrect);
    }
    if (this.onFlashCube) {
      this.onFlashCube(isCorrect ? "correct" : "incorrect");
    }

    this.advanceSprintScramble();
  }

  finishSprint() {
    if (this.sprintTimerId) {
      clearInterval(this.sprintTimerId);
      this.sprintTimerId = null;
    }
    this.sprintRunning = false;
    if (!this.sprintSession) return;

    const finished = this.sprintSession;
    this.sprintSession = null;
    this.sprintSummary = {
      ...finished,
      elapsedMs: Math.min(finished.durationMs, Date.now() - finished.startedAt)
    };
    this.render();
  }

  // ---------------------------------------------------------------------------
  // Casual Practice Management
  // ---------------------------------------------------------------------------
  verifyCasualGuess() {
    if (this.answered) return;
    let guess = this.guessCase;
    if (this.currentTrackId === "cll") {
      if (!this.guessGroup || !this.guessCase) return;
      guess = `${this.guessGroup}${this.guessCase}`;
    }
    if (!guess) return;

    this.answered = true;
    const isCorrect = this.checkAnswerMatch(guess);
    if (isCorrect) {
      this.score++;
      this.streak++;
    } else {
      this.streak = 0;
    }

    this.lastResult = {
      isCorrect,
      name: this.currentCase?.name || this.currentCase?.id || guess
    };

    if (this.onRecordRecognition && this.currentCase) {
      this.onRecordRecognition(this.currentCase.id, isCorrect);
    }
    if (this.onFlashCube) {
      this.onFlashCube(isCorrect ? "correct" : "incorrect");
    }

    this.render();
  }

  async advanceCasualScramble() {
    this.answered = false;
    this.guessGroup = null;
    this.guessCase = null;
    this.lastResult = null;
    if (this.onGenerateScramble) {
      const res = await this.onGenerateScramble(this.currentTrackId);
      this.currentCase = typeof res === 'object' ? res?.caseObj : null;
    }
    this.render();
  }

  checkAnswerMatch(guess) {
    if (!this.currentCase || !guess) return false;
    const c = this.currentCase;
    return (
      guess === c.id ||
      guess === c.name ||
      guess === c.group ||
      (c.group && c.id && guess === `${c.group}${c.id.replace(c.group, '')}`) ||
      (c.name && guess.toLowerCase() === c.name.toLowerCase()) ||
      (c.id && c.id.includes(guess)) ||
      (typeof guess === "string" && c.id && guess.includes(c.id))
    );
  }

  formatTime(ms) {
    const totalSeconds = Math.ceil(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${String(seconds).padStart(2, "0")}`;
  }

  // ---------------------------------------------------------------------------
  // Inspection Management
  // ---------------------------------------------------------------------------
  startInspectionTimer() {
    this.inspectionRunning = true;
    this.inspectionSeconds = 15;
    this.render();

    if (this.inspectionTimerId) clearInterval(this.inspectionTimerId);
    this.inspectionTimerId = setInterval(() => {
      this.inspectionSeconds--;
      if (this.inspectionSeconds <= 0) {
        this.stopInspectionTimer();
        this.revealInspectionSolutions();
      } else {
        const clock = this.container?.querySelector('.inspection-clock');
        if (clock) {
          clock.textContent = `${this.inspectionSeconds}s`;
          clock.className = `inspection-clock ${this.inspectionSeconds <= 3 ? 'danger' : this.inspectionSeconds <= 7 ? 'warning' : ''}`;
        }
      }
    }, 1000);
  }

  stopInspectionTimer() {
    this.inspectionRunning = false;
    if (this.inspectionTimerId) {
      clearInterval(this.inspectionTimerId);
      this.inspectionTimerId = null;
    }
  }

  async advanceInspectionScramble() {
    this.stopInspectionTimer();
    this.solutionRevealed = false;
    this.inspectionSeconds = 15;
    if (this.onGenerateScramble) {
      const res = await this.onGenerateScramble(this.currentTrackId);
      this.inspectionScramble = typeof res === 'string' ? res : (res?.scramble || '');
    }
    this.render();
  }

  async revealInspectionSolutions() {
    this.stopInspectionTimer();
    this.solutionRevealed = true;

    if (this.currentPuzzle === "333") {
      const res = findCrossSolutions(this.inspectionScramble, 5);
      this.inspectionSolutions = (res?.solutions || []).map(s => ({
        moves: s.moves,
        moveCount: s.length,
        insp: s.inspectionRot && s.inspectionRot !== "none" ? s.inspectionRot : "none",
        crossPlus1: s.crossPlusOne?.[0] ? { hasPair: true, description: `Cross+1: ${s.crossPlusOne[0].slot} (${s.crossPlusOne[0].description})` } : null,
        eoSummary: res.eo ? { note: res.eo.badCrossEdgesCount === 0 ? 'EO: All 4 edges oriented' : `EO: ${res.eo.goodCrossEdgesCount}/4 cross edges oriented` } : null
      }));
    } else {
      try {
        const sols = await findLayerSolutions(this.inspectionScramble, ['white'], 5);
        this.inspectionSolutions = (sols || []).map(s => ({
          moves: s.moves,
          moveCount: s.moveCount,
          insp: s.inspection && s.inspection !== "none" ? s.inspection : "none",
          crossPlus1: null,
          eoSummary: null
        }));
      } catch (e) {
        this.inspectionSolutions = [];
      }
    }

    this.render();
  }
}
