// Practice View: Multi-Mode Recognition & Inspection Planning Drills

import { getTrack } from './data/algRegistry.js';
import { findLayerSolutions } from './layerSolver.js';
import { findCrossSolutions } from './crossSolver.js';

export class PracticeView {
  constructor(options) {
    this.container = options.container;
    this.onGenerateScramble = options.onGenerateScramble; // () => Promise<string>
    this.onApplyScrambleToDisplay = options.onApplyScrambleToDisplay; // (scramble) => void

    this.currentPuzzle = "222";
    this.currentTrackId = "cll";
    this.practiceMode = "casual"; // "casual" | "timed"

    // Inspection drill state (for 1st Layer / White Cross)
    this.inspectionRunning = false;
    this.inspectionSeconds = 15;
    this.inspectionTimerId = null;
    this.inspectionScramble = "";
    this.inspectionSolutions = [];
    this.solutionRevealed = false;

    // Recognition quiz state
    this.currentCase = null;
    this.guessGroup = null;
    this.guessCase = null;
    this.score = 0;
    this.streak = 0;
    this.answered = false;
  }

  setTrack(puzzleId, trackId) {
    this.currentPuzzle = puzzleId;
    this.currentTrackId = trackId;
    this.stopInspectionTimer();
    this.solutionRevealed = false;
    this.answered = false;
    this.render();
  }

  setPracticeMode(mode) {
    this.practiceMode = mode;
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
          <button type="button" class="practice-subnav-btn ${this.practiceMode === 'timed' ? 'active' : ''}" data-mode="timed">Timed Streak</button>
        </div>
      </div>

      <div class="practice-body">
        ${isInspectionDrill ? this.renderInspectionDrill() : this.renderRecognitionDrill()}
      </div>
    `;

    this.bindEvents(isInspectionDrill);
  }

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

        ${this.solutionRevealed ? `
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
        ` : ''}
      </div>
    `;
  }

  renderRecognitionDrill() {
    const track = getTrack(this.currentPuzzle, this.currentTrackId);
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
        </div>

        <div class="recognition-keypad-box" id="recognitionKeypad">
          ${this.renderKeypadForTrack(track)}
        </div>

        <div id="recognitionFeedback" class="recognition-feedback" hidden></div>

        <div class="recognition-actions">
          <button type="button" id="verifyRecognitionBtn" class="btn btn-primary" ${this.answered ? 'disabled' : ''}>Verify</button>
          <button type="button" id="nextRecognitionScrambleBtn" class="btn btn-small">Next Scramble</button>
        </div>
      </div>
    `;
  }

  renderKeypadForTrack(track) {
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
          <div class="ortega-keypad-group">
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
        revealBtn.addEventListener('click', () => this.revealInspectionSolutions());
      }

      const newBtn = this.container.querySelector('#newDrillScrambleBtn');
      if (newBtn) {
        newBtn.addEventListener('click', async () => {
          this.stopInspectionTimer();
          this.solutionRevealed = false;
          this.inspectionSeconds = 15;
          if (this.onGenerateScramble) {
            const scramble = await this.onGenerateScramble();
            this.inspectionScramble = scramble;
            if (this.onApplyScrambleToDisplay) {
              this.onApplyScrambleToDisplay(scramble);
            }
          }
          this.render();
        });
      }
    } else {
      // Recognition keypad buttons
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

      const nextBtn = this.container.querySelector('#nextRecognitionScrambleBtn');
      if (nextBtn) {
        nextBtn.addEventListener('click', async () => {
          this.answered = false;
          this.guessGroup = null;
          this.guessCase = null;
          if (this.onGenerateScramble) {
            await this.onGenerateScramble();
          }
          this.render();
        });
      }
    }
  }

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
