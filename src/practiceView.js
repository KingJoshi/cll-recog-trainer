// Practice View: Multi-Mode Recognition & Inspection Planning Drills
// Supports both Casual Practice and Timed Sprints (consolidated)

import { getTrack, getPreferredAlg, getCustomAlgsForCase } from './data/algRegistry.js';
import { getEffectiveAlgsForCase } from './cube/algMirror.js';
import { computeExpectedPostAuf, isAufQuizTrackSupported } from './cube/customAlgVerifier.js';
import { findLayerSolutions, findFaceSolutions } from './layerSolver.js';
import { findCrossSolutions } from './crossSolver.js';
import { ICON_POPUP_SIM } from './ui/transportIcons.js';
import { BldMemoTrainer } from './features/practice/bldMemoTrainer.js';
import { renderBottomLayerPickerHtml, bindBottomLayerPickerEvents } from './ui/bottomLayerPicker.js';

function escapeHtmlAttr(val) {
  return String(val ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export class PracticeView {
  constructor(options) {
    this.container = options.container;
    this.onGenerateScramble = options.onGenerateScramble; // () => Promise<{ scramble, caseObj }>
    this.onApplyScrambleToDisplay = options.onApplyScrambleToDisplay; // (scramble) => void
    this.onRecordRecognition = options.onRecordRecognition; // (caseId, isCorrect) => void
    this.onFlashCube = options.onFlashCube; // (result) => void
    this.onTwoSidedModeChange = options.onTwoSidedModeChange || null; // (enabled) => void
    this.onQuickSimSolutions = options.onQuickSimSolutions || null; // (payload) => void
    this.getCrossTargetFaces = options.getCrossTargetFaces || (() => ['white']);
    this.getLayerTargetFaces = options.getLayerTargetFaces || (() => ['white']);
    this.onSetLayerTargetFaces = options.onSetLayerTargetFaces || null;
    this.getTrainingBottomFaces = options.getTrainingBottomFaces || (() => ['white']);
    this.onSetTrainingBottomFaces = options.onSetTrainingBottomFaces || null;
    this.getOhHand = options.getOhHand || (() => 'left');
    this.onSetOhHand = options.onSetOhHand || null;
    this.getOhTableAbuse = options.getOhTableAbuse || (() => true);
    this.onSetOhTableAbuse = options.onSetOhTableAbuse || null;
    this.getOhSettingsEnabled = options.getOhSettingsEnabled || (() => true);

    this.currentPuzzle = "222";
    this.currentTrackId = "cll";
    this.practiceMode = "casual"; // "casual" | "timed"
    this.twoSidedMode = false;
    this._gen = 0;
    this._submittingSprint = false;

    // Inspection drill state (for 1st Layer / White Cross)
    this.inspectionRunning = false;
    this.inspectionSeconds = 15;
    this.inspectionTimerId = null;
    this.inspectionScramble = "";
    this.inspectionSolutions = [];
    this.solutionRevealed = false;

    // Casual Recognition quiz state
    this.currentCase = null;
    this.currentScramble = "";
    this.guessGroup = null;
    this.guessCase = null;
    this.score = 0;
    this.streak = 0;
    this.answered = false;
    this.lastResult = null;
    this.selectWarning = false;
    this.selectWarningMsg = "";
    this.caseShownAt = null;
    this.lastLatencyMs = null;
    this.sessionLatencies = [];
    this.aufQuizMode = false;
    this.guessAuf = null;
    this.expectedAufInfo = null;
    this._aufComputeToken = 0;

    // Timed sprint state
    this.sprintMinutes = 3;
    this.sprintRunning = false;
    this.sprintSession = null;
    this.sprintSummary = null;
    this.sprintTimerId = null;

    // 3BLD memo trainer delegate
    this.bldMemoTrainer = null;
  }

  isBldMemoTrack() {
    return this.currentPuzzle === "333bf" && this.currentTrackId === "bld-memo";
  }

  /**
   * Stop active drill/sprint timers, invalidate async scramble fetches, and release 2-sided lock.
   */
  deactivate() {
    this._gen++;
    this._submittingSprint = false;
    this.stopInspectionTimer();
    if (this.sprintTimerId) {
      clearInterval(this.sprintTimerId);
      this.sprintTimerId = null;
    }
    this.sprintRunning = false;
    this.bldMemoTrainer?.deactivate?.();
    this.onTwoSidedModeChange?.(false);
  }

  isInspectionTrack() {
    return (this.currentPuzzle === "222" && ["face", "layer"].includes(this.currentTrackId)) ||
      ((this.currentPuzzle === "333" || this.currentPuzzle === "333oh") && this.currentTrackId === "cross");
  }

  isGroupNumberTrack(trackId = this.currentTrackId) {
    return ["cll", "eg1", "eg2"].includes(trackId);
  }

  getCaseIdPrefix(trackId = this.currentTrackId) {
    if (trackId === "eg1") return "EG1-";
    if (trackId === "eg2") return "EG2-";
    return "";
  }

  nowMs() {
    return (typeof performance !== "undefined" && typeof performance.now === "function")
      ? performance.now()
      : Date.now();
  }

  isTwoSidedActive() {
    const is3x3Recog = (this.currentPuzzle === "333" || this.currentPuzzle === "333oh") && ["pll", "oll"].includes(this.currentTrackId);
    return Boolean(!this.isInspectionTrack() && is3x3Recog && this.twoSidedMode);
  }

  isAufQuizSupported() {
    return isAufQuizTrackSupported(this.currentPuzzle, this.currentTrackId);
  }

  isAufQuizActive() {
    return Boolean(
      this.aufQuizMode &&
      !this.isInspectionTrack() &&
      this.practiceMode === "casual" &&
      this.isAufQuizSupported()
    );
  }

  getPreferredAlgTextForCase(c) {
    if (!c) return "";
    const track = getTrack(this.currentPuzzle, this.currentTrackId);
    const effective = getEffectiveAlgsForCase(this.currentPuzzle, this.currentTrackId, c, {
      ohHand: this.getOhHand(),
      ohTableAbuse: this.getOhTableAbuse(),
      trackCases: track?.cases || []
    });
    const custom = getCustomAlgsForCase(this.currentPuzzle, c.id);
    const algs = [...effective, ...custom];
    const defaultAlg = algs.find(a => a.isDefault) || algs[0];
    const subScope = this.currentPuzzle === "333oh"
      ? (this.getOhTableAbuse() ? this.getOhHand() : `${this.getOhHand()}:no-table`)
      : null;
    const prefId = getPreferredAlg(c.id, defaultAlg?.id, this.currentPuzzle, subScope);
    const preferred = algs.find(a => a.id === prefId) || defaultAlg;
    return preferred?.alg || "";
  }

  async refreshExpectedAuf() {
    const tok = ++this._aufComputeToken;
    if (!this.aufQuizMode || this.isInspectionTrack() || !this.currentCase || !this.currentScramble || !this.isAufQuizSupported()) {
      this.expectedAufInfo = null;
      return null;
    }
    const algText = this.getPreferredAlgTextForCase(this.currentCase);
    const info = await computeExpectedPostAuf(
      this.currentPuzzle,
      this.currentTrackId,
      this.currentScramble,
      algText
    );
    if (tok !== this._aufComputeToken) return null;
    this.expectedAufInfo = info;
    return info;
  }

  formatAufLabel(auf) {
    return auf ? auf : "No AUF";
  }

  async setTrack(puzzleId, trackId) {
    const gen = ++this._gen;
    const prevKey = `${this.currentPuzzle}:${this.currentTrackId}`;
    const nextKey = `${puzzleId}:${trackId}`;
    this.currentPuzzle = puzzleId;
    this.currentTrackId = trackId;
    this._submittingSprint = false;
    this.stopInspectionTimer();
    if (this.sprintRunning) {
      this.finishSprint();
    }
    this.bldMemoTrainer?.deactivate?.();
    this.onTwoSidedModeChange?.(this.isTwoSidedActive());

    if (this.isBldMemoTrack()) {
      if (!this.bldMemoTrainer) {
        this.bldMemoTrainer = new BldMemoTrainer({
          container: this.container,
          onApplyScrambleToDisplay: this.onApplyScrambleToDisplay,
          onFlashCube: this.onFlashCube,
          onQuickSimSolutions: this.onQuickSimSolutions
        });
      }
      await this.bldMemoTrainer.init();
      return;
    }
    this.solutionRevealed = false;
    this.answered = false;
    this.guessGroup = null;
    this.guessCase = null;
    this.guessAuf = null;
    this.expectedAufInfo = null;
    this.currentScramble = "";
    this.caseShownAt = null;
    this.lastResult = null;
    this.selectWarning = false;
    this.selectWarningMsg = "";
    if (prevKey !== nextKey) {
      this.sessionLatencies = [];
      this.lastLatencyMs = null;
    }
    this.onTwoSidedModeChange?.(this.isTwoSidedActive());

    if (this.onGenerateScramble) {
      const res = await this.onGenerateScramble(this.currentTrackId);
      if (gen !== this._gen) return;
      if (typeof res === 'object' && res?.caseObj) {
        this.currentCase = res.caseObj;
        this.currentScramble = res.fullScramble || res.scramble || "";
        if (this.aufQuizMode && this.isAufQuizSupported()) {
          await this.refreshExpectedAuf();
          if (gen !== this._gen) return;
        }
        this.caseShownAt = this.nowMs();
      } else {
        this.currentCase = null;
        this.inspectionScramble = typeof res === 'string' ? res : (res?.scramble || '');
      }
    }
    this.render();
  }

  setPracticeMode(mode) {
    if (this.practiceMode === mode) return;
    this.practiceMode = mode;
    this._submittingSprint = false;
    this.stopInspectionTimer();
    if (this.sprintRunning) {
      this.finishSprint();
    }
    this.answered = false;
    this.guessGroup = null;
    this.guessCase = null;
    this.guessAuf = null;
    this.lastResult = null;
    this.selectWarning = false;
    this.selectWarningMsg = "";
    this.caseShownAt = (mode === "casual" && this.currentCase && !this.isInspectionTrack())
      ? this.nowMs()
      : null;
    this.onTwoSidedModeChange?.(this.isTwoSidedActive());
    this.render();
  }

  render() {
    if (!this.container) return;
    if (this.isBldMemoTrack()) {
      if (!this.bldMemoTrainer) {
        this.bldMemoTrainer = new BldMemoTrainer({
          container: this.container,
          onApplyScrambleToDisplay: this.onApplyScrambleToDisplay,
          onFlashCube: this.onFlashCube,
          onQuickSimSolutions: this.onQuickSimSolutions
        });
      }
      this.bldMemoTrainer.render();
      return;
    }
    const isInspectionDrill = this.isInspectionTrack();
    const isOh = this.currentPuzzle === "333oh";
    const showOhControls = isOh && Boolean(this.getOhSettingsEnabled?.());
    const show222InspectionBottomPicker = isInspectionDrill && this.currentPuzzle === "222";
    const ohHand = this.getOhHand();
    const ohTableAbuse = this.getOhTableAbuse();

    this.container.innerHTML = `
      <div class="practice-header">
        <div class="practice-title-group">
          <h2 class="practice-title">${isInspectionDrill ? 'Inspection Planning Drill' : 'Case Recognition Drill'}</h2>
          <span class="practice-subtext">
            ${isInspectionDrill
              ? `Plan your ${this.currentTrackId === "face" ? "1st Face (Ortega/EG)" : this.currentTrackId === "layer" ? "1st Layer" : "White Cross"} under 15s WCA inspection, then verify with the optimal solver`
              : 'Identify the case from the 3D cube and test your recognition speed'}
          </span>
        </div>

        <div class="practice-header-controls">
          ${!isInspectionDrill
            ? renderBottomLayerPickerHtml(this.getTrainingBottomFaces(), { label: "Bottom:" })
            : (show222InspectionBottomPicker
                ? renderBottomLayerPickerHtml(this.getLayerTargetFaces(), { label: "Bottom:" })
                : '')}
          ${showOhControls ? `
            <div class="oh-hand-switcher oh-hand-switcher-compact" role="group" aria-label="One-Handed Solving Hand">
              <button type="button" class="oh-hand-btn ${ohHand === 'left' ? 'active' : ''}" data-oh-hand="left" aria-pressed="${ohHand === 'left'}" data-tooltip="Left-Handed OH (standard <R, U>)">🤚 Left OH<sup class="beta-sup" aria-label="Experimental">β</sup></button>
              <button type="button" class="oh-hand-btn ${ohHand === 'right' ? 'active' : ''}" data-oh-hand="right" aria-pressed="${ohHand === 'right'}" data-tooltip="Right-Handed OH (mirror <L, U> / z')">✋ Right OH<sup class="beta-sup" aria-label="Experimental">β</sup></button>
            </div>
            <div class="oh-hand-switcher oh-hand-switcher-compact" role="group" aria-label="One-Handed Table Abuse Style">
              <button type="button" class="oh-table-btn ${ohTableAbuse ? 'active' : ''}" data-oh-table="table" aria-pressed="${ohTableAbuse}" data-tooltip="Allow table-assisted M/S/E slice moves">Table Abuse<sup class="beta-sup" aria-label="Experimental">β</sup></button>
              <button type="button" class="oh-table-btn ${!ohTableAbuse ? 'active' : ''}" data-oh-table="no-table" aria-pressed="${!ohTableAbuse}" data-tooltip="In-air OH: L, R, U with occasional F/D, no M moves, B via x' + U">No Table<sup class="beta-sup" aria-label="Experimental">β</sup></button>
            </div>
          ` : ''}
          <div class="practice-subnav" role="group" aria-label="Practice Mode">
            <button type="button" class="practice-subnav-btn ${this.practiceMode === 'casual' ? 'active' : ''}" data-mode="casual" data-tooltip="Untimed practice: pick the case or inspect at your own pace">Casual Practice</button>
            <button type="button" class="practice-subnav-btn ${this.practiceMode === 'timed' ? 'active' : ''}" data-mode="timed" data-tooltip="Timed sprint: recognize as many cases accurately as possible before time runs out">Timed Sprint</button>
          </div>
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

  renderInspectionScrambleBox() {
    if (!this.inspectionScramble) return '';
    return `
      <div class="inspection-scramble-box">
        <span class="inspection-scramble-lbl">Scramble:</span>
        <code class="inspection-scramble-code">${escapeHtmlAttr(this.inspectionScramble)}</code>
      </div>
    `;
  }

  // ---------------------------------------------------------------------------
  // Casual Inspection Drill (White Cross / 1st Layer)
  // ---------------------------------------------------------------------------
  renderInspectionDrill() {
    const is3x3 = this.currentPuzzle === "333" || this.currentPuzzle === "333oh";
    return `
      <div class="inspection-drill-card">
        <div class="inspection-timer-box">
          <div class="inspection-clock ${this.inspectionSeconds <= 3 ? 'danger' : this.inspectionSeconds <= 7 ? 'warning' : ''}">
            ${this.inspectionSeconds}s
          </div>
          <span class="inspection-clock-label">${this.inspectionRunning ? 'Inspection time remaining' : 'Ready'}</span>
        </div>

        ${this.renderInspectionScrambleBox()}

        <div class="inspection-actions-row">
          <button type="button" id="startInspectionBtn" class="btn btn-primary" ${this.inspectionRunning ? 'disabled' : ''}>
            ${this.inspectionRunning ? 'Inspecting...' : 'Start 15s Inspection'}
          </button>
          <button type="button" id="newDrillScrambleBtn" class="btn btn-small">New Scramble</button>
          <button type="button" id="revealSolutionsBtn" class="btn btn-small ${this.solutionRevealed ? 'active' : ''}" aria-pressed="${Boolean(this.solutionRevealed)}">
            ${this.solutionRevealed ? 'Hide Solutions' : 'Reveal Optimal Solutions'}
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
    const is3x3 = this.currentPuzzle === "333" || this.currentPuzzle === "333oh";
    return `
      <div class="inspection-drill-card">
        <div class="inspection-timer-box">
          <div class="inspection-clock ${this.inspectionSeconds <= 3 ? 'danger' : this.inspectionSeconds <= 7 ? 'warning' : ''}">
            ${this.inspectionSeconds}s
          </div>
          <span class="inspection-clock-label">${this.inspectionRunning ? 'WCA Inspection in progress' : 'Ready for next inspection'}</span>
        </div>

        ${this.renderInspectionScrambleBox()}

        <div class="inspection-actions-row">
          <button type="button" id="startInspectionBtn" class="btn btn-primary" ${this.inspectionRunning ? 'disabled' : ''}>
            ${this.inspectionRunning ? 'Inspecting...' : 'Start 15s Timer'}
          </button>
          <button type="button" id="newDrillScrambleBtn" class="btn btn-small">Next Scramble</button>
          <button type="button" id="revealSolutionsBtn" class="btn btn-small ${this.solutionRevealed ? 'active' : ''}" aria-pressed="${Boolean(this.solutionRevealed)}">
            ${this.solutionRevealed ? 'Hide Solutions' : 'Done & Reveal Solutions'}
          </button>
        </div>

        ${this.solutionRevealed ? this.renderInspectionSolutionsList(is3x3) : ''}
      </div>
    `;
  }

  renderInspectionSolutionsList(is3x3) {
    const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : 'White';
    const heading = is3x3
      ? 'Optimal Cross Solutions:'
      : (this.currentTrackId === 'face' ? 'Optimal 1st Face (Ortega / EG) Solutions:' : 'Optimal 1st Layer Solutions:');
    return `
      <div class="inspection-solutions-reveal">
        <h4 class="inspection-reveal-title">
          ${heading}
        </h4>
        <div class="inspection-solutions-list">
          ${this.inspectionSolutions.length === 0
            ? `<p class="hint" style="margin: 6px 0 0;">No optimal solutions found within search depth for the selected target color(s).</p>`
            : this.inspectionSolutions.map((sol, idx) => `
            <div class="inspection-sol-item">
              <div class="inspection-sol-head">
                <span class="face-badge face-badge-${sol.face || 'white'}">${cap(sol.face || 'white')}</span>
                <span class="sol-badge">#${idx + 1} (${sol.moveCount} moves)</span>
                <span class="sol-insp">Inspection: <strong>${sol.insp || 'none'}</strong></span>
                ${sol.bottomPerm ? `<span class="sol-chip chip-perm">D: ${sol.bottomPerm}</span>` : ''}
                ${sol.crossPlus1?.hasPair ? `<span class="sol-chip chip-cross1">${sol.crossPlus1.description}</span>` : ''}
                ${sol.eoSummary ? `<span class="sol-chip chip-eo">${sol.eoSummary.note}</span>` : ''}
                ${this.onQuickSimSolutions ? `<button type="button" class="btn btn-xs inspection-sol-sim-btn" data-idx="${idx}" data-tooltip="Simulate this solution in an interactive 3D popup" aria-label="Simulate solution ${idx + 1} in 3D popup">${ICON_POPUP_SIM}<span>Sim</span></button>` : ''}
              </div>
              <div class="inspection-sol-moves">${sol.moves || '(already solved)'}</div>
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
    const supportsAufQuiz = this.isAufQuizSupported();
    const aufActive = this.isAufQuizActive();
    if (this.currentCase && !this.answered && this.caseShownAt == null) {
      this.caseShownAt = this.nowMs();
    }
    const avgLatencyMs = this.sessionLatencies.length
      ? Math.round(this.sessionLatencies.reduce((a, b) => a + b, 0) / this.sessionLatencies.length)
      : null;

    let feedbackHtml = '';
    if (this.lastResult) {
      const latencyBadge = this.lastResult.latencyMs != null
        ? ` <span class="recog-feedback-latency">(${this.lastResult.latencyMs} ms)</span>`
        : '';
      if (this.lastResult.aufUsed) {
        const expLabel = this.formatAufLabel(this.lastResult.expectedAuf);
        const algHint = this.lastResult.algUsed
          ? `<div class="recog-auf-alg-hint">Ref alg: <code>${escapeHtmlAttr(this.lastResult.algUsed)}</code>${this.lastResult.preAuf ? ` (pre-AUF <b>${escapeHtmlAttr(this.lastResult.preAuf)}</b>)` : ''}</div>`
          : '';
        if (this.lastResult.isCorrect) {
          feedbackHtml = `🎉 <strong>Correct!</strong> ${escapeHtmlAttr(this.lastResult.name)} · Post-AUF: <strong>${expLabel}</strong>.${latencyBadge}${algHint}`;
        } else if (this.lastResult.caseMatch && !this.lastResult.aufMatch) {
          const guessedLabel = this.formatAufLabel(this.lastResult.guessedAuf);
          feedbackHtml = `❌ <strong>Case right (${escapeHtmlAttr(this.lastResult.name)}), wrong AUF.</strong> Expected <strong>${expLabel}</strong> (you picked ${guessedLabel}).${latencyBadge}${algHint}`;
        } else {
          feedbackHtml = `❌ <strong>Incorrect.</strong> Case was <strong>${escapeHtmlAttr(this.lastResult.name)}</strong> · Post-AUF: <strong>${expLabel}</strong>.${latencyBadge}${algHint}`;
        }
      } else {
        feedbackHtml = this.lastResult.isCorrect
          ? `🎉 <strong>Correct!</strong> That is ${escapeHtmlAttr(this.lastResult.name)}.${latencyBadge}`
          : `❌ <strong>Incorrect.</strong> The case was <strong>${escapeHtmlAttr(this.lastResult.name)}</strong>.${latencyBadge}`;
      }
    } else if (this.selectWarning) {
      feedbackHtml = `⚠️ <strong>${escapeHtmlAttr(this.selectWarningMsg || 'Please select a case above')}</strong> before clicking Verify.`;
    }

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
          <div class="recognition-score-item">
            <span class="score-label">Latency:</span>
            <span class="score-value" id="practiceLatencyVal">${this.lastLatencyMs != null ? `${this.lastLatencyMs} ms` : '—'}${avgLatencyMs != null ? ` <small class="recog-latency-avg">(avg ${avgLatencyMs} ms)</small>` : ''}</span>
          </div>
          ${(is3x3Recog || supportsAufQuiz) ? `
            <div class="recognition-mode-toggle-wrap" style="margin-left: auto;">
              ${supportsAufQuiz ? `
                <button type="button" class="btn btn-xs btn-auf-quiz-toggle ${this.aufQuizMode ? 'active' : ''}" id="toggleAufQuizModeBtn" data-tooltip="Also predict the final post-alg U-layer AUF (No AUF, U, U', U2) for your preferred algorithm">
                  🎯 AUF Quiz: <strong>${this.aufQuizMode ? 'ON' : 'OFF'}</strong>
                </button>
              ` : ''}
              ${is3x3Recog ? `
                <button type="button" class="btn btn-xs btn-twosided-toggle ${this.twoSidedMode ? 'active' : ''}" id="toggleTwoSidedModeBtn" data-tooltip="Lock the 3D cube camera to Front + Right faces to train fast 2-sided recognition without cube rotations">
                  👀 2-Sided Recog: <strong>${this.twoSidedMode ? 'ON' : 'OFF'}</strong>
                </button>
              ` : ''}
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
          ${aufActive ? `
            <div class="recognition-auf-picker" role="group" aria-label="Expected Post-Alg AUF">
              <span class="auf-picker-label">Post-Alg AUF:</span>
              <div class="auf-picker-buttons">
                ${[
                  { val: "", label: "No AUF" },
                  { val: "U", label: "U" },
                  { val: "U'", label: "U'" },
                  { val: "U2", label: "U2" }
                ].map(opt => `
                  <button type="button" class="btn-recog-auf ${this.guessAuf === opt.val ? 'active' : ''}" data-auf="${escapeHtmlAttr(opt.val)}">${opt.label}</button>
                `).join('')}
              </div>
            </div>
          ` : ''}
        </div>

        <div id="recognitionFeedback" class="recognition-feedback ${this.lastResult ? (this.lastResult.isCorrect ? 'correct' : 'incorrect') : (this.selectWarning ? 'warning' : '')}" ${this.lastResult || this.selectWarning ? '' : 'hidden'}>
          ${feedbackHtml}
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
    const is3x3Recog = (this.currentPuzzle === "333" || this.currentPuzzle === "333oh") && ["pll", "oll"].includes(this.currentTrackId);
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
            ${is3x3Recog ? `
              <button type="button" class="btn btn-xs btn-twosided-toggle ${this.twoSidedMode ? 'active' : ''}" id="toggleTwoSidedModeBtn">
                👀 2-Sided: <strong>${this.twoSidedMode ? 'ON' : 'OFF'}</strong>
              </button>
            ` : ''}
            <button type="button" id="endSprintBtn" class="btn btn-small">End</button>
          </div>
          <div class="timed-progress">
            <div id="sprintProgress" class="timed-progress-fill" style="width: ${pct}%"></div>
          </div>
        </div>

        ${is3x3Recog && this.twoSidedMode ? `
          <div class="twosided-banner">
            <span class="twosided-banner-icon">👀</span>
            <span><strong>2-Sided Recognition Drill Active:</strong> Identify the ${this.currentTrackId.toUpperCase()} case looking only at the <strong>Front and Right</strong> faces without rotating the cube!</span>
          </div>
        ` : ''}

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

  getCllKeypadMeta(track) {
    const cases = track?.cases || [];
    const groupCasesMap = new Map();
    const allNums = new Set();
    for (const c of cases) {
      const m = String(c.id || "").match(/^(?:EG[12]-)?([A-Z]+)(\d+)$/i);
      const grp = m ? m[1].toUpperCase() : String(c.group || c.id || "").charAt(0).toUpperCase();
      const num = m ? m[2] : "";
      if (!grp) continue;
      if (!groupCasesMap.has(grp)) groupCasesMap.set(grp, new Set());
      if (num) {
        groupCasesMap.get(grp).add(num);
        allNums.add(num);
      }
    }
    const preferredOrder = ["H", "P", "U", "T", "L", "S", "A"];
    const groups = [
      ...preferredOrder.filter(g => groupCasesMap.has(g)),
      ...[...groupCasesMap.keys()].filter(g => !preferredOrder.includes(g))
    ];
    const numbers = [...allNums].sort((a, b) => Number(a) - Number(b));
    return { groups, numbers, groupCasesMap };
  }

  renderKeypadForTrack(track) {
    if (!track) return '';

    if (track.id === "parity") {
      const parityCases = track.cases || [];
      return `
        <p class="guess-label">Which ${this.currentPuzzle === "444" ? "4x4" : "5x5"} Parity is it?</p>
        <div class="ortega-pill-row" style="flex-wrap: wrap; gap: 8px;">
          ${parityCases.map(c => `
            <button type="button" class="btn-recog-key ${this.guessCase === c.id ? 'active' : ''}" data-case="${c.id}">${c.shortName || c.name}</button>
          `).join('')}
        </div>
      `;
    }

    if (track.id === "pll") {
      const pllCases = track.cases || [];
      return `
        <p class="guess-label">Which PLL is it?</p>
        <div class="pll-keypad-grid">
          ${pllCases.map(c => `
            <button type="button" class="btn-recog-key pll-key ${this.guessCase === c.id ? 'active' : ''}" data-case="${c.id}">${c.id}</button>
          `).join('')}
        </div>
      `;
    }

    if (track.id === "ortega" || track.id === "lbl") {
      const groups = track.groups || [];
      const cases = track.cases || [];
      const title = track.id === "lbl" ? "Select the LBL case:" : "Select the Ortega case:";
      return `
        <p class="guess-label">${title}</p>
        <div class="ortega-keypad-sections">
          ${groups.map((g, idx) => {
            const sectionLabel = g.split(" ")[0] || g;
            const groupCases = cases.filter(c => c.group === g);
            return `
              <div class="ortega-keypad-group" ${idx > 0 ? 'style="margin-top: 8px;"' : ''}>
                <span class="ortega-group-label">${sectionLabel}:</span>
                <div class="ortega-pill-row">
                  ${groupCases.map(c => {
                    const label = (c.shortName || String(c.name || c.id).replace(/^(Ortega|LBL) (OLL|PBL|PLL):\s*/i, "").replace(/\s*\([^)]*\)$/, "") || c.id).replace(/^(OLL|PLL):\s*/i, "");
                    return `<button type="button" class="btn-recog-key ${this.guessCase === c.id ? 'active' : ''}" data-case="${c.id}">${label}</button>`;
                  }).join('')}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `;
    }

    if (track.id === "oll") {
      const allOlls = (track.cases || []).slice().sort((a, b) => (a.number || 0) - (b.number || 0));
      return `
        <p class="guess-label">Which OLL case is it?</p>
        <div class="pll-keypad-grid">
          ${allOlls.map(c => {
            const lbl = c.drillLabel || String(c.number || c.id.replace(/^oll-/, "")).padStart(2, "0");
            return `<button type="button" class="btn-recog-key pll-key ${this.guessCase === c.id ? 'active' : ''}" data-case="${c.id}">${lbl}</button>`;
          }).join('')}
        </div>
      `;
    }

    if (track.id === "f2l") {
      const allF2l = (track.cases || []).slice().sort((a, b) => (a.number || 0) - (b.number || 0));
      return `
        <p class="guess-label">Which F2L case is it?</p>
        <div class="pll-keypad-grid">
          ${allF2l.map(c => {
            const lbl = String(c.number || c.id.replace(/^f2l-/, "")).padStart(2, "0");
            return `<button type="button" class="btn-recog-key pll-key ${this.guessCase === c.id ? 'active' : ''}" data-case="${c.id}">${lbl}</button>`;
          }).join('')}
        </div>
      `;
    }

    // Default CLL: Group buttons + dynamic valid case number buttons
    const { groups, numbers, groupCasesMap } = this.getCllKeypadMeta(track);
    const validForSelectedGroup = this.guessGroup ? groupCasesMap.get(this.guessGroup) : null;
    return `
      <p class="guess-label">Which case is it?</p>
      <div class="seg seg-group" role="group" aria-label="Guess the group">
        ${groups.map(g => `
          <button type="button" class="group-btn ${this.guessGroup === g ? 'active' : ''}" data-group="${g}">${g}</button>
        `).join('')}
      </div>
      <div class="seg seg-case" role="group" aria-label="Guess the case number">
        ${numbers.map(n => {
          const disabled = validForSelectedGroup ? !validForSelectedGroup.has(n) : false;
          return `<button type="button" class="case-btn ${this.guessCase === String(n) ? 'active' : ''}" data-case="${n}" ${disabled ? 'disabled aria-disabled="true"' : ''}>${n}</button>`;
        }).join('')}
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

    this.container.querySelectorAll('.oh-hand-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.dataset.ohHand && this.onSetOhHand) {
          this.onSetOhHand(btn.dataset.ohHand);
        }
      });
    });

    this.container.querySelectorAll('.oh-table-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.dataset.ohTable && this.onSetOhTableAbuse) {
          this.onSetOhTableAbuse(btn.dataset.ohTable === 'table');
        }
      });
    });

    if (isInspectionDrill && this.currentPuzzle === "222") {
      bindBottomLayerPickerEvents(
        this.container,
        () => this.getLayerTargetFaces(),
        (nextFaces) => {
          this.onSetLayerTargetFaces?.(nextFaces);
          if (this.solutionRevealed) {
            void this.revealInspectionSolutions();
          } else {
            this.render();
          }
        }
      );
    } else {
      bindBottomLayerPickerEvents(
        this.container,
        () => this.getTrainingBottomFaces(),
        (nextFaces) => {
          this.onSetTrainingBottomFaces?.(nextFaces);
        }
      );
    }

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
            this.solutionRevealed = false;
            this.render();
          }
        });
      }

      const newBtn = this.container.querySelector('#newDrillScrambleBtn');
      if (newBtn) {
        newBtn.addEventListener('click', () => this.advanceInspectionScramble());
      }

      this.container.querySelectorAll('.inspection-sol-sim-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const idx = Number(btn.dataset.idx);
          const is3x3 = this.currentPuzzle === "333" || this.currentPuzzle === "333oh";
          const title = is3x3
            ? "3x3 White Cross Solution Simulator"
            : (this.currentTrackId === "face" ? "2x2 1st Face (Ortega / EG) Simulator" : "2x2 1st Layer Simulator");
          this.onQuickSimSolutions?.({
            puzzle: this.currentPuzzle,
            scramble: this.inspectionScramble,
            solutions: this.inspectionSolutions.map(s => ({
              ...s,
              inspection: s.insp || s.inspection || "none"
            })),
            activeIndex: Number.isNaN(idx) ? 0 : idx,
            title
          });
        });
      });
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

        const twoSidedToggle = this.container.querySelector('#toggleTwoSidedModeBtn');
        if (twoSidedToggle) {
          twoSidedToggle.addEventListener('click', () => {
            this.twoSidedMode = !this.twoSidedMode;
            this.onTwoSidedModeChange?.(this.isTwoSidedActive());
            this.render();
          });
        }

        // Instant answer submission buttons
        this.container.querySelectorAll('.btn-recog-key').forEach(btn => {
          btn.addEventListener('click', () => {
            this.submitSprintAnswer(btn.dataset.case);
          });
        });

        this.container.querySelectorAll('.group-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            this.guessGroup = btn.dataset.group;
            const { groupCasesMap } = this.getCllKeypadMeta(getTrack(this.currentPuzzle, this.currentTrackId));
            const validCases = groupCasesMap.get(this.guessGroup);
            if (this.guessCase && validCases && !validCases.has(this.guessCase)) {
              this.guessCase = null;
            }
            if (this.guessCase) {
              this.submitSprintAnswer(`${this.getCaseIdPrefix()}${this.guessGroup}${this.guessCase}`);
            } else {
              this.render();
            }
          });
        });

        this.container.querySelectorAll('.case-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            this.guessCase = btn.dataset.case;
            if (this.guessGroup) {
              this.submitSprintAnswer(`${this.getCaseIdPrefix()}${this.guessGroup}${this.guessCase}`);
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
    const aufToggle = this.container.querySelector('#toggleAufQuizModeBtn');
    if (aufToggle) {
      aufToggle.addEventListener('click', async () => {
        this.aufQuizMode = !this.aufQuizMode;
        this.guessAuf = null;
        this.selectWarning = false;
        this.selectWarningMsg = "";
        await this.refreshExpectedAuf();
        this.render();
      });
    }

    const twoSidedToggle = this.container.querySelector('#toggleTwoSidedModeBtn');
    if (twoSidedToggle) {
      twoSidedToggle.addEventListener('click', () => {
        this.twoSidedMode = !this.twoSidedMode;
        this.onTwoSidedModeChange?.(this.isTwoSidedActive());
        this.render();
      });
    }

    this.container.querySelectorAll('.btn-recog-auf').forEach(btn => {
      btn.addEventListener('click', () => {
        this.guessAuf = btn.dataset.auf ?? "";
        this.selectWarning = false;
        this.selectWarningMsg = "";
        this.render();
      });
    });

    this.container.querySelectorAll('.btn-recog-key').forEach(btn => {
      btn.addEventListener('click', () => {
        this.guessCase = btn.dataset.case;
        this.selectWarning = false;
        this.render();
      });
    });

    this.container.querySelectorAll('.group-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.guessGroup = btn.dataset.group;
        const { groupCasesMap } = this.getCllKeypadMeta(getTrack(this.currentPuzzle, this.currentTrackId));
        const validCases = groupCasesMap.get(this.guessGroup);
        if (this.guessCase && validCases && !validCases.has(this.guessCase)) {
          this.guessCase = null;
        }
        this.selectWarning = false;
        this.render();
      });
    });

    this.container.querySelectorAll('.case-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.guessCase = btn.dataset.case;
        this.selectWarning = false;
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

  onKeyDown(e) {
    if (this.isInspectionTrack() || this.practiceMode !== "casual") return false;

    if (e.key === "Enter") {
      e.preventDefault?.();
      if (!this.answered) {
        this.verifyCasualGuess();
      } else {
        this.advanceCasualScramble();
      }
      return true;
    }

    if (e.code === "Space" && this.answered) {
      e.preventDefault?.();
      this.advanceCasualScramble();
      return true;
    }

    return false;
  }

  // ---------------------------------------------------------------------------
  // Sprint Management
  // ---------------------------------------------------------------------------
  startSprint() {
    this._submittingSprint = false;
    this.sprintRunning = true;
    this.sprintSummary = null;
    this.onTwoSidedModeChange?.(this.isTwoSidedActive());
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
    const gen = ++this._gen;
    this.guessGroup = null;
    this.guessCase = null;
    if (this.onGenerateScramble) {
      const res = await this.onGenerateScramble(this.currentTrackId);
      if (gen !== this._gen) return;
      this.currentCase = typeof res === 'object' ? res?.caseObj : null;
    }
    this.render();
  }

  async submitSprintAnswer(guess) {
    if (this._submittingSprint || !this.sprintRunning || !this.sprintSession || !this.currentCase) return;
    this._submittingSprint = true;
    try {
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

      await this.advanceSprintScramble();
    } finally {
      this._submittingSprint = false;
    }
  }

  finishSprint() {
    if (this.sprintTimerId) {
      clearInterval(this.sprintTimerId);
      this.sprintTimerId = null;
    }
    this.sprintRunning = false;
    this._submittingSprint = false;
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
    let hasCaseSelection = Boolean(guess);
    if (this.isGroupNumberTrack()) {
      hasCaseSelection = Boolean(this.guessGroup && this.guessCase);
      if (hasCaseSelection) {
        guess = `${this.getCaseIdPrefix()}${this.guessGroup}${this.guessCase}`;
      }
    }

    const aufRequired = this.isAufQuizActive() && this.expectedAufInfo != null;
    const missingAuf = aufRequired && this.guessAuf === null;
    if (!hasCaseSelection || missingAuf) {
      this.selectWarning = true;
      if (!hasCaseSelection && missingAuf) {
        this.selectWarningMsg = "Please select both the case and Post-Alg AUF";
      } else if (missingAuf) {
        this.selectWarningMsg = "Please select the expected Post-Alg AUF";
      } else {
        this.selectWarningMsg = "Please select a case above";
      }
      this.render();
      return;
    }
    this.selectWarning = false;
    this.selectWarningMsg = "";

    const latencyMs = this.caseShownAt != null
      ? Math.max(0, Math.round(this.nowMs() - this.caseShownAt))
      : null;
    if (latencyMs != null && Number.isFinite(latencyMs)) {
      this.lastLatencyMs = latencyMs;
      this.sessionLatencies.push(latencyMs);
    }

    this.answered = true;
    const caseMatch = this.checkAnswerMatch(guess);
    const expectedAuf = aufRequired ? this.expectedAufInfo.postAuf : null;
    const aufMatch = !aufRequired || this.guessAuf === expectedAuf;
    const isCorrect = caseMatch && aufMatch;

    if (isCorrect) {
      this.score++;
      this.streak++;
    } else {
      this.streak = 0;
    }

    this.lastResult = {
      isCorrect,
      caseMatch,
      aufMatch,
      name: this.currentCase?.name || this.currentCase?.id || guess,
      latencyMs,
      aufUsed: aufRequired,
      expectedAuf,
      guessedAuf: this.guessAuf,
      algUsed: this.expectedAufInfo?.alg || "",
      preAuf: this.expectedAufInfo?.preAuf || ""
    };

    if (this.onRecordRecognition && this.currentCase) {
      this.onRecordRecognition(this.currentCase.id, isCorrect);
    }
    if (this.onFlashCube) {
      this.onFlashCube(isCorrect ? "correct" : "incorrect");
    }

    this.render();
  }

  refreshBottomOrientation() {
    if (this.isInspectionTrack()) {
      this.render();
      return;
    }
    if (this.practiceMode === "timed") {
      if (this.sprintRunning) {
        void this.advanceSprintScramble();
      } else {
        this.render();
      }
      return;
    }
    void this.advanceCasualScramble();
  }

  async advanceCasualScramble() {
    const gen = ++this._gen;
    this.answered = false;
    this.guessGroup = null;
    this.guessCase = null;
    this.guessAuf = null;
    this.expectedAufInfo = null;
    this.currentScramble = "";
    this.lastResult = null;
    this.selectWarning = false;
    this.selectWarningMsg = "";
    this.caseShownAt = null;
    if (this.onGenerateScramble) {
      const res = await this.onGenerateScramble(this.currentTrackId);
      if (gen !== this._gen) return;
      this.currentCase = typeof res === 'object' ? res?.caseObj : null;
      this.currentScramble = typeof res === 'object' ? (res?.fullScramble || res?.scramble || "") : "";
      if (this.aufQuizMode && this.isAufQuizSupported() && this.currentCase) {
        await this.refreshExpectedAuf();
        if (gen !== this._gen) return;
      }
      if (this.currentCase) {
        this.caseShownAt = this.nowMs();
      }
    }
    this.render();
  }

  checkAnswerMatch(guess) {
    if (!this.currentCase || !guess) return false;
    const c = this.currentCase;
    if (guess === c.id || guess === c.name) return true;
    if (c.group && c.id && guess === `${c.group}${c.id.replace(c.group, '')}`) return true;
    if (c.name && guess.toLowerCase() === c.name.toLowerCase()) return true;
    const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
    const ng = norm(guess);
    const nid = norm(c.id);
    if (ng && nid && (ng === nid || nid === `ortega-oll-${ng}` || nid === `ortega-pbl-${ng}`)) return true;
    return false;
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
    const gen = ++this._gen;
    this.stopInspectionTimer();
    this.solutionRevealed = false;
    this.inspectionSeconds = 15;
    if (this.onGenerateScramble) {
      const res = await this.onGenerateScramble(this.currentTrackId);
      if (gen !== this._gen) return;
      this.inspectionScramble = typeof res === 'string' ? res : (res?.scramble || '');
    }
    this.render();
  }

  async revealInspectionSolutions() {
    const gen = ++this._gen;
    this.stopInspectionTimer();
    this.solutionRevealed = true;

    if (!this.inspectionScramble && this.onGenerateScramble) {
      const res = await this.onGenerateScramble(this.currentTrackId);
      if (gen !== this._gen) return;
      this.inspectionScramble = typeof res === 'string' ? res : (res?.scramble || '');
    }

    if (this.currentPuzzle === "333" || this.currentPuzzle === "333oh") {
      try {
        const faces = this.getCrossTargetFaces();
        const res = await findCrossSolutions(this.inspectionScramble, faces, 6);
        if (gen !== this._gen) return;
        const list = Array.isArray(res) ? res : (res?.solutions || []);
        this.inspectionSolutions = list.map(s => ({
          face: s.face || 'white',
          moves: s.moves,
          moveCount: s.moveCount || s.length,
          insp: s.insp && s.insp !== "none" ? s.insp : (s.inspectionRot && s.inspectionRot !== "none" ? s.inspectionRot : "none"),
          crossPlus1: s.crossPlus1?.hasPair ? s.crossPlus1 : (s.crossPlusOne?.[0] ? { hasPair: true, description: `Cross+1: ${s.crossPlusOne[0].slot} (${s.crossPlusOne[0].description})` } : null),
          eoSummary: s.eoSummary || (res.eo ? { note: res.eo.badCrossEdgesCount === 0 ? 'EO: All 4 edges oriented' : `EO: ${res.eo.goodCrossEdgesCount}/4 cross edges oriented` } : null)
        }));
      } catch (e) {
        if (gen !== this._gen) return;
        this.inspectionSolutions = [];
      }
    } else {
      try {
        const faces = this.getLayerTargetFaces();
        const isFaceMode = this.currentTrackId === "face";
        const sols = isFaceMode
          ? await findFaceSolutions(this.inspectionScramble, faces, 4)
          : await findLayerSolutions(this.inspectionScramble, faces, 5);
        if (gen !== this._gen) return;
        this.inspectionSolutions = (sols || []).map(s => ({
          face: s.face || 'white',
          moves: s.moves,
          moveCount: s.moveCount,
          insp: s.inspection && s.inspection !== "none" ? s.inspection : "none",
          bottomPerm: s.bottomPerm || null,
          caseId: s.caseId || null,
          crossPlus1: null,
          eoSummary: null
        }));
      } catch (e) {
        if (gen !== this._gen) return;
        this.inspectionSolutions = [];
      }
    }

    this.render();
  }
}
