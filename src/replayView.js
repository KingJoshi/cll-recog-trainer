// Solve Replay Viewer - Interactive 3D replay, scrubber timeline, move tape, and reconstruction
import { parseScrambleInput } from './algParser.js';
import { ensureSolveCfop, DEFAULT_PAUSE_THRESHOLD_MS } from './cfopAnalyzer.js';
import { applyColorsTo3DCube } from './caseVisualizer.js';
import { getSolveTime } from './services/solveStats.js';
import { ICON_PLAY, ICON_PAUSE, ICON_REPLAY } from './ui/transportIcons.js';

let ScrambleDisplayClass = null;
async function getScrambleDisplay() {
  if (!ScrambleDisplayClass && typeof window !== "undefined") {
    const mod = await import('scramble-display');
    ScrambleDisplayClass = mod.ScrambleDisplay;
  }
  return ScrambleDisplayClass;
}

export class SolveReplayViewer {
  constructor() {
    this.modal = null;
    this.cubeContainer = null;
    this.display = null;
    this.activeSolve = null;
    this.scramble = "";
    this.moves = []; // [{ move, t, split }]
    this.currentMoveIndex = 0;
    this.isPlaying = false;
    this.playbackSpeed = 1.0;
    this.playbackTimer = null;
    this.totalDurationMs = 0;
    this.scrambleMoveCount = 0;
    this.onReattemptCallback = null;
    this.getSimSpeed = null;
    this.onSetSimSpeed = null;
    this.getShowReflection = null;
    this.modalManager = null;
    this._mountGen = 0;
    this._mountPromise = null;
    this._copyTimerId = null;
    this._copyOrigText = null;

    // Bound handlers
    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  init(elements = {}, onReattempt = null, modalManager = null, speedOpts = {}) {
    const doc = typeof document !== "undefined" ? document : null;
    this.modal = elements.modal || doc?.getElementById("solveReplayModal") || null;
    this.cubeContainer = elements.cubeContainer || doc?.getElementById("replayCubeContainer") || null;
    this.titleEl = elements.titleEl || doc?.getElementById("replayModalTitle") || null;
    this.timeEl = elements.timeEl || doc?.getElementById("replayModalTime") || null;
    this.metaEl = elements.metaEl || doc?.getElementById("replayModalMeta") || null;
    this.scrubber = elements.scrubber || doc?.getElementById("replayScrubber") || null;
    this.timeDisplay = elements.timeDisplay || doc?.getElementById("replayTimeDisplay") || null;
    this.moveCounter = elements.moveCounter || doc?.getElementById("replayMoveCounter") || null;
    this.liveTps = elements.liveTps || doc?.getElementById("replayLiveTps") || null;
    this.moveTape = elements.moveTape || doc?.getElementById("replayMoveTape") || null;
    this.btnPlay = elements.btnPlay || doc?.getElementById("replayBtnPlay") || null;
    this.btnPrev = elements.btnPrev || doc?.getElementById("replayBtnPrev") || null;
    this.btnNext = elements.btnNext || doc?.getElementById("replayBtnNext") || null;
    this.btnStart = elements.btnStart || doc?.getElementById("replayBtnStart") || null;
    this.btnEnd = elements.btnEnd || doc?.getElementById("replayBtnEnd") || null;
    this.btnCopy = elements.btnCopy || doc?.getElementById("replayCopyBtn") || null;
    this.btnReattempt = elements.btnReattempt || doc?.getElementById("replayModalReattemptBtn") || null;
    this.btnClose = elements.btnClose || doc?.getElementById("replayModalCloseBtn") || null;
    this.btnDismiss = elements.btnDismiss || doc?.getElementById("replayModalDismissBtn") || null;
    this.speedButtons = doc ? Array.from(doc.querySelectorAll(".replay-speed-btn")) : [];
    this.onReattemptCallback = onReattempt;
    this.getSimSpeed = typeof speedOpts.getSimSpeed === "function" ? speedOpts.getSimSpeed : null;
    this.onSetSimSpeed = typeof speedOpts.onSetSimSpeed === "function" ? speedOpts.onSetSimSpeed : null;
    this.getShowReflection = typeof speedOpts.getShowReflection === "function" ? speedOpts.getShowReflection : (() => true);
    this.modalManager = modalManager || elements.modalManager || null;

    if (this.getSimSpeed) {
      this.syncPlaybackSpeed(this.getSimSpeed());
    }
    this._bindControls();
  }

  syncPlaybackSpeed(spd) {
    const next = Number(spd);
    if (!Number.isFinite(next) || next <= 0) return;
    this.playbackSpeed = next;
    this.speedButtons.forEach(b => {
      const match = parseFloat(b.dataset.speed) === this.playbackSpeed;
      b.classList.toggle("active", match);
      b.setAttribute("aria-pressed", String(match));
    });
  }

  isOpen() {
    if (!this.modal) return false;
    if (this.modalManager) return this.modalManager.isOpen(this.modal);
    return !this.modal.hidden;
  }

  _bindControls() {
    if (this.btnPlay) {
      this.btnPlay.addEventListener("click", () => this.togglePlay());
    }
    if (this.btnPrev) {
      this.btnPrev.addEventListener("click", () => {
        this.pause();
        this.jumpToMove(this.currentMoveIndex - 1);
      });
    }
    if (this.btnNext) {
      this.btnNext.addEventListener("click", () => {
        this.pause();
        this.jumpToMove(this.currentMoveIndex + 1);
      });
    }
    if (this.btnStart) {
      this.btnStart.addEventListener("click", () => {
        this.pause();
        this.jumpToMove(0);
      });
    }
    if (this.btnEnd) {
      this.btnEnd.addEventListener("click", () => {
        this.pause();
        this.jumpToMove(this.moves.length);
      });
    }

    if (this.scrubber) {
      this.scrubber.addEventListener("input", (e) => {
        this.pause();
        const idx = parseInt(e.target.value, 10);
        if (!isNaN(idx)) {
          this.jumpToMove(idx);
        }
      });
    }

    this.speedButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        const spd = parseFloat(btn.dataset.speed);
        if (!isNaN(spd) && spd > 0) {
          this.syncPlaybackSpeed(spd);
          this.onSetSimSpeed?.(spd);
        }
      });
    });

    if (this.btnCopy) {
      this.btnCopy.addEventListener("click", () => this.copyReconstruction());
    }

    if (this.btnReattempt) {
      this.btnReattempt.addEventListener("click", () => {
        if (this.activeSolve && this.onReattemptCallback) {
          const scr = this.activeSolve.scramble || this.scramble;
          this.close();
          this.onReattemptCallback(scr);
        }
      });
    }

    if (this.btnClose) {
      this.btnClose.addEventListener("click", () => this.close());
    }
    if (this.btnDismiss) {
      this.btnDismiss.addEventListener("click", () => this.close());
    }

    if (this.modal && !this.modalManager) {
      this.modal.addEventListener("click", (e) => {
        if (e.target === this.modal) this.close();
      });
    }
  }

  open(solve, title = "Solve Replay") {
    if (!solve || !this.modal) return;
    const gen = ++this._mountGen;
    this.activeSolve = solve;
    this.scramble = solve.scramble || "";
    this.moves = Array.isArray(solve.moves) ? [...solve.moves] : [];
    this.currentMoveIndex = 0;
    this.isPlaying = false;
    this.syncPlaybackSpeed(this.getSimSpeed ? this.getSimSpeed() : this.playbackSpeed);
    this.totalDurationMs = solve.cubeMs || solve.rawMs || solve.ms || (this.moves.length > 0 ? this.moves[this.moves.length - 1].t : 0);

    // Update Header (effective penalty time for display, physical duration for TPS/scrubber)
    if (this.titleEl) this.titleEl.textContent = title;
    if (this.timeEl) {
      if (solve.penalty === "DNF") {
        this.timeEl.textContent = "DNF";
      } else {
        const effectiveMs = getSolveTime(solve);
        const displayMs = effectiveMs != null && Number.isFinite(effectiveMs) ? effectiveMs : this.totalDurationMs;
        const finalSec = (displayMs / 1000).toFixed(2);
        this.timeEl.textContent = solve.penalty === "+2" ? `${finalSec}s+` : `${finalSec}s`;
      }
    }
    const moveCount = this.moves.length;
    const tps = solve.tps || (moveCount > 0 && this.totalDurationMs > 0 ? (moveCount / (this.totalDurationMs / 1000)).toFixed(2) : "0.00");
    const smartTag = solve.smartCube ? ` · ᛒ ${solve.smartCube}` : "";
    if (this.metaEl) {
      this.metaEl.textContent = `${moveCount} moves (ETM) · ${tps} TPS${smartTag}`;
    }

    // Mount 3D cube
    const mountPromise = this._mountCube(solve.puzzle || "333", gen);
    this._mountPromise = mountPromise;

    // Build timeline tape
    this._renderMoveTape();

    // Reset scrubber
    if (this.scrubber) {
      this.scrubber.min = "0";
      this.scrubber.max = String(this.moves.length);
      this.scrubber.value = "0";
    }

    // Set play button state
    this._updatePlayButton();

    // Show modal via unified modalManager when available
    if (this.modalManager) {
      this.modalManager.open(this.modal, {
        initialFocus: this.btnPlay || this.btnClose,
        onClose: () => this._teardown()
      });
    } else {
      this.modal.hidden = false;
      if (typeof document !== "undefined" && document.body?.style) {
        document.body.style.overflow = "hidden";
      }
      if (typeof window !== "undefined") {
        window.addEventListener("keydown", this.handleKeyDown);
      }
    }

    // Sync UI counters immediately, then position mounted cube at start once ready
    this.jumpToMove(0);
    mountPromise.then(() => {
      if (this._mountPromise === mountPromise) this._mountPromise = null;
      if (gen === this._mountGen && this.activeSolve) {
        this.jumpToMove(this.currentMoveIndex);
      }
    }).catch(() => {});
  }

  _teardown() {
    this._mountGen++;
    this._mountPromise = null;
    this.pause();
    if (this._copyTimerId) {
      clearTimeout(this._copyTimerId);
      this._copyTimerId = null;
    }
    if (this.btnCopy && this._copyOrigText != null) {
      this.btnCopy.textContent = this._copyOrigText;
      this._copyOrigText = null;
    }
    if (!this.modalManager) {
      if (this.modal) this.modal.hidden = true;
      if (typeof document !== "undefined" && document.body?.style) {
        document.body.style.overflow = "";
      }
      if (typeof window !== "undefined") {
        window.removeEventListener("keydown", this.handleKeyDown);
      }
    }
    if (this.cubeContainer) {
      this.cubeContainer.innerHTML = "";
    }
    this.display = null;
    this.activeSolve = null;
  }

  close() {
    if (this.modalManager && this.modal && this.modalManager.isOpen(this.modal)) {
      this.modalManager.close(this.modal);
      return;
    }
    this._teardown();
  }

  async _mountCube(puzzle = "333", gen = this._mountGen) {
    if (!this.cubeContainer) return;
    this.cubeContainer.innerHTML = "";

    try {
      const SD = await getScrambleDisplay();
      if (!SD || gen !== this._mountGen || !this.activeSolve) return;
      const disp = new SD();
      disp.event = puzzle === "333oh" ? "333" : (puzzle || "333");
      disp.visualization = "3D";
      if (disp.player) {
        const showRefl = this.getShowReflection ? this.getShowReflection() : true;
        disp.player.hintFacelets = showRefl ? "floating" : "none";
      }

      // Combine scramble and solve moves into sequence
      const parsedScr = parseScrambleInput(this.scramble);
      const scrMoves = parsedScr.ok ? parsedScr.moves : [];
      this.scrambleMoveCount = scrMoves.length;

      const solveMoveTokens = this.moves.map(m => m.move);
      const fullSequence = [...scrMoves, ...solveMoveTokens].join(" ");
      disp.scramble = fullSequence;

      if (gen !== this._mountGen || !this.cubeContainer) return;
      this.display = disp;
      this.cubeContainer.appendChild(disp);
      applyColorsTo3DCube(disp);
    } catch (e) {
      console.warn("Could not mount Replay ScrambleDisplay:", e);
    }
  }

  _renderMoveTape() {
    if (!this.moveTape) return;
    this.moveTape.innerHTML = "";

    if (this.moves.length === 0) {
      this.moveTape.innerHTML = `<span class="replay-empty-hint">No move-by-move data tracked for this solve.</span>`;
      return;
    }

    const cfop = this.activeSolve ? ensureSolveCfop(this.activeSolve) : null;
    const movePhaseMap = new Map();
    if (cfop && Array.isArray(cfop.steps)) {
      for (const st of cfop.steps) {
        for (let i = st.startMoveIdx; i < st.endMoveIdx; i++) {
          movePhaseMap.set(i, st);
        }
      }
    }

    // Scramble chip / start chip
    const startChip = document.createElement("button");
    startChip.type = "button";
    startChip.className = "replay-move-chip active";
    startChip.dataset.index = "0";
    startChip.innerHTML = `<span class="chip-num">0</span><span class="chip-move">Start</span><span class="chip-split">0.00s</span>`;
    startChip.title = "Scramble setup · 0.00s";
    startChip.addEventListener("click", () => {
      this.pause();
      this.jumpToMove(0);
    });
    this.moveTape.appendChild(startChip);

    // Moves chips
    this.moves.forEach((m, idx) => {
      const chip = document.createElement("button");
      chip.type = "button";
      const isPause = (m.split || 0) >= DEFAULT_PAUSE_THRESHOLD_MS;
      const stepObj = movePhaseMap.get(idx);
      const phaseClass = stepObj ? ` phase-${stepObj.phase}` : "";
      chip.className = `replay-move-chip${isPause ? " is-pause-move" : ""}${phaseClass}`;
      chip.dataset.index = String(idx + 1);
      const tSec = (m.t / 1000).toFixed(2);
      const splitSec = (m.split / 1000).toFixed(2);
      const phaseBadge = stepObj && idx === stepObj.startMoveIdx
        ? `<span class="chip-phase-tag">${stepObj.label}</span>`
        : "";
      chip.innerHTML = `
        ${phaseBadge}
        <span class="chip-num">${idx + 1}</span>
        <span class="chip-move">${m.move}</span>
        <span class="chip-split">${isPause ? "⏸ " : ""}+${splitSec}s</span>
      `;
      const phaseNote = stepObj ? ` [${stepObj.label}]` : "";
      const pauseNote = isPause ? " (PAUSE)" : "";
      chip.title = `Move ${idx + 1}${phaseNote}: ${m.move} at ${tSec}s (+${splitSec}s)${pauseNote}`;
      chip.addEventListener("click", () => {
        this.pause();
        this.jumpToMove(idx + 1);
      });
      this.moveTape.appendChild(chip);
    });
  }

  async jumpToMove(targetIndex) {
    targetIndex = Math.max(0, Math.min(this.moves.length, targetIndex));
    this.currentMoveIndex = targetIndex;

    // Update scrubber value
    if (this.scrubber) {
      this.scrubber.value = String(targetIndex);
    }

    if (this._mountPromise) {
      const pendingMount = this._mountPromise;
      const mountGen = this._mountGen;
      try {
        await pendingMount;
      } catch {}
      if (mountGen !== this._mountGen || !this.activeSolve) return;
      targetIndex = this.currentMoveIndex;
    }

    // Update 3D cube player position
    if (this.display && this.display.player) {
      try {
        this.display.player.pause();
        const totalIndex = this.scrambleMoveCount + targetIndex;
        const targetScrambleIdx = totalIndex - 1;

        if (targetScrambleIdx < 0) {
          this.display.player.controller?.jumpToStart?.({ flash: false }) || this.display.player.jumpToStart?.();
        } else {
          const indexer = await this.display.player.experimentalModel.indexer.get();
          if (indexer && this.activeSolve) {
            const endTimestamp = indexer.indexToMoveStartTimestamp(targetScrambleIdx) + indexer.moveDuration(targetScrambleIdx);
            this.display.player.experimentalModel.timestampRequest.set(endTimestamp);
          }
        }
      } catch (err) {
        console.warn("Could not scrub replay player:", err);
      }
    }

    // Update info displays
    const currentMs = targetIndex === 0 ? 0 : (this.moves[targetIndex - 1]?.t || 0);
    const curSec = (currentMs / 1000).toFixed(2);
    const totalSec = (this.totalDurationMs / 1000).toFixed(2);

    if (this.timeDisplay) {
      this.timeDisplay.textContent = `${curSec}s / ${totalSec}s`;
    }
    if (this.moveCounter) {
      this.moveCounter.textContent = `Move ${targetIndex} / ${this.moves.length}`;
    }
    if (this.liveTps) {
      const tps = targetIndex > 0 && currentMs > 0 ? (targetIndex / (currentMs / 1000)).toFixed(2) : "0.00";
      this.liveTps.textContent = `${tps} TPS`;
    }

    // Highlight active chip in move tape
    if (this.moveTape) {
      const chips = this.moveTape.querySelectorAll(".replay-move-chip");
      chips.forEach((c) => {
        const isActive = c.dataset.index === String(targetIndex);
        c.classList.toggle("active", isActive);
        if (isActive && typeof c.scrollIntoView === "function") {
          c.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
        }
      });
    }

    // If at end, pause
    if (targetIndex >= this.moves.length && this.isPlaying) {
      this.pause();
    }
  }

  togglePlay() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  play() {
    if (this.moves.length === 0) return;
    if (this._mountPromise) {
      const pendingMount = this._mountPromise;
      const mountGen = this._mountGen;
      pendingMount.then(() => {
        if (mountGen === this._mountGen && this.activeSolve) {
          this._startPlayback();
        }
      }).catch(() => {});
      return;
    }
    this._startPlayback();
  }

  _startPlayback() {
    if (this.moves.length === 0) return;
    if (this.currentMoveIndex >= this.moves.length) {
      this.jumpToMove(0);
    }

    this.isPlaying = true;
    this._updatePlayButton();
    this._scheduleNextStep();
  }

  _scheduleNextStep() {
    if (!this.isPlaying) return;
    if (this.currentMoveIndex >= this.moves.length) {
      this.pause();
      return;
    }

    const nextMove = this.moves[this.currentMoveIndex];
    const rawSplit = nextMove?.split || 250;
    // Scale real split time by playback speed, clamped to a reasonable min/max
    const delay = Math.max(20, Math.min(2500, Math.round(rawSplit / this.playbackSpeed)));

    clearTimeout(this.playbackTimer);
    this.playbackTimer = setTimeout(() => {
      if (!this.isPlaying) return;
      this.jumpToMove(this.currentMoveIndex + 1);
      if (this.currentMoveIndex < this.moves.length) {
        this._scheduleNextStep();
      } else {
        this.pause();
      }
    }, delay);
  }

  pause() {
    this.isPlaying = false;
    clearTimeout(this.playbackTimer);
    this._updatePlayButton();
  }

  _updatePlayButton() {
    if (typeof document === "undefined") return;
    const playIcon = document.getElementById("replayPlayIcon");
    const playText = document.getElementById("replayPlayText");
    const atEnd = this.moves.length > 0 && this.currentMoveIndex >= this.moves.length && !this.isPlaying;
    if (playIcon) playIcon.innerHTML = this.isPlaying ? ICON_PAUSE : (atEnd ? ICON_REPLAY : ICON_PLAY);
    if (playText) playText.textContent = this.isPlaying ? "Pause" : (atEnd ? "Replay" : "Play");
  }

  handleKeyDown(e) {
    if (!this.modal || this.modal.hidden) return;
    const tag = String(e.target?.tagName || "").toUpperCase();
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;

    if (e.code === "Space") {
      e.preventDefault();
      this.togglePlay();
    } else if (e.code === "ArrowLeft") {
      e.preventDefault();
      this.pause();
      this.jumpToMove(this.currentMoveIndex - 1);
    } else if (e.code === "ArrowRight") {
      e.preventDefault();
      this.pause();
      this.jumpToMove(this.currentMoveIndex + 1);
    } else if (e.code === "Home") {
      e.preventDefault();
      this.pause();
      this.jumpToMove(0);
    } else if (e.code === "End") {
      e.preventDefault();
      this.pause();
      this.jumpToMove(this.moves.length);
    } else if (e.key === "Escape") {
      e.preventDefault();
      this.close();
    }
  }

  copyReconstruction() {
    if (!this.activeSolve) return;
    const effectiveMs = getSolveTime(this.activeSolve);
    const displayTime = this.activeSolve.penalty === "DNF"
      ? "DNF"
      : `${(((effectiveMs != null && Number.isFinite(effectiveMs) ? effectiveMs : this.totalDurationMs)) / 1000).toFixed(2)}s${this.activeSolve.penalty === "+2" ? "+" : ""}`;
    const moveCount = this.moves.length;
    const tps = moveCount > 0 && this.totalDurationMs > 0 ? (moveCount / (this.totalDurationMs / 1000)).toFixed(2) : "0.00";

    let text = `Solve Time: ${displayTime}\n`;
    text += `Moves (ETM): ${moveCount} | TPS: ${tps}\n`;
    if (this.scramble) {
      text += `Scramble: ${this.scramble}\n`;
    }
    text += `\nReconstruction:\n`;
    this.moves.forEach((m, idx) => {
      const tSec = (m.t / 1000).toFixed(2);
      const splitSec = (m.split / 1000).toFixed(2);
      text += `${idx + 1}. ${m.move.padEnd(4)}  ${tSec}s (+${splitSec}s)\n`;
    });

    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        if (this.btnCopy) {
          if (this._copyTimerId) {
            clearTimeout(this._copyTimerId);
          }
          if (this._copyOrigText == null) {
            this._copyOrigText = this.btnCopy.textContent;
          }
          this.btnCopy.textContent = "✓ Copied!";
          this._copyTimerId = setTimeout(() => {
            if (this.btnCopy && this._copyOrigText != null) {
              this.btnCopy.textContent = this._copyOrigText;
            }
            this._copyOrigText = null;
            this._copyTimerId = null;
          }, 1800);
        }
      }).catch(() => {});
    }
  }
}

// Global singleton instance
export const solveReplayViewer = new SolveReplayViewer();
