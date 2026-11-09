// Solve Replay Viewer - Interactive 3D replay, scrubber timeline, move tape, and reconstruction
import { parseScrambleInput } from './algParser.js';

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

    // Bound handlers
    this.handleKeyDown = this.handleKeyDown.bind(this);
  }

  init(elements = {}, onReattempt = null) {
    this.modal = elements.modal || document.getElementById("solveReplayModal");
    this.cubeContainer = elements.cubeContainer || document.getElementById("replayCubeContainer");
    this.titleEl = elements.titleEl || document.getElementById("replayModalTitle");
    this.timeEl = elements.timeEl || document.getElementById("replayModalTime");
    this.metaEl = elements.metaEl || document.getElementById("replayModalMeta");
    this.scrubber = elements.scrubber || document.getElementById("replayScrubber");
    this.timeDisplay = elements.timeDisplay || document.getElementById("replayTimeDisplay");
    this.moveCounter = elements.moveCounter || document.getElementById("replayMoveCounter");
    this.liveTps = elements.liveTps || document.getElementById("replayLiveTps");
    this.moveTape = elements.moveTape || document.getElementById("replayMoveTape");
    this.btnPlay = elements.btnPlay || document.getElementById("replayBtnPlay");
    this.btnPrev = elements.btnPrev || document.getElementById("replayBtnPrev");
    this.btnNext = elements.btnNext || document.getElementById("replayBtnNext");
    this.btnStart = elements.btnStart || document.getElementById("replayBtnStart");
    this.btnEnd = elements.btnEnd || document.getElementById("replayBtnEnd");
    this.btnCopy = elements.btnCopy || document.getElementById("replayCopyBtn");
    this.btnReattempt = elements.btnReattempt || document.getElementById("replayModalReattemptBtn");
    this.btnClose = elements.btnClose || document.getElementById("replayModalCloseBtn");
    this.btnDismiss = elements.btnDismiss || document.getElementById("replayModalDismissBtn");
    this.speedButtons = typeof document !== "undefined" ? Array.from(document.querySelectorAll(".replay-speed-btn")) : [];
    this.onReattemptCallback = onReattempt;

    this._bindControls();
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
        if (!isNaN(spd)) {
          this.playbackSpeed = spd;
          this.speedButtons.forEach(b => b.classList.toggle("active", b === btn));
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

    if (this.modal) {
      this.modal.addEventListener("click", (e) => {
        if (e.target === this.modal) this.close();
      });
    }
  }

  open(solve, title = "Solve Replay") {
    if (!solve || !this.modal) return;
    this.activeSolve = solve;
    this.scramble = solve.scramble || "";
    this.moves = Array.isArray(solve.moves) ? [...solve.moves] : [];
    this.currentMoveIndex = 0;
    this.isPlaying = false;
    this.totalDurationMs = solve.rawMs || solve.ms || (this.moves.length > 0 ? this.moves[this.moves.length - 1].t : 0);

    // Update Header
    if (this.titleEl) this.titleEl.textContent = title;
    const finalSec = (this.totalDurationMs / 1000).toFixed(2);
    if (this.timeEl) {
      const penaltyStr = solve.penalty === "+2" ? "+2 " : (solve.penalty === "DNF" ? "DNF " : "");
      this.timeEl.textContent = `${penaltyStr}${finalSec}s`;
    }
    const moveCount = this.moves.length;
    const tps = solve.tps || (moveCount > 0 && this.totalDurationMs > 0 ? (moveCount / (this.totalDurationMs / 1000)).toFixed(2) : "0.00");
    const smartTag = solve.smartCube ? ` · ᛒ ${solve.smartCube}` : "";
    if (this.metaEl) {
      this.metaEl.textContent = `${moveCount} moves (ETM) · ${tps} TPS${smartTag}`;
    }

    // Mount 3D cube
    this._mountCube(solve.puzzle || "333");

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

    // Show modal and listen for keyboard events
    this.modal.hidden = false;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", this.handleKeyDown);

    // Position cube at start
    this.jumpToMove(0);
  }

  close() {
    this.pause();
    if (this.modal) {
      this.modal.hidden = true;
    }
    document.body.style.overflow = "";
    window.removeEventListener("keydown", this.handleKeyDown);
    if (this.cubeContainer) {
      this.cubeContainer.innerHTML = "";
    }
    this.display = null;
    this.activeSolve = null;
  }

  async _mountCube(puzzle = "333") {
    if (!this.cubeContainer) return;
    this.cubeContainer.innerHTML = "";

    try {
      const SD = await getScrambleDisplay();
      if (!SD) return;
      this.display = new SD();
      this.display.event = puzzle === "333oh" ? "333" : (puzzle || "333");
      this.display.visualization = "3D";
      this.display.player.hintFacelets = "floating";

      // Combine scramble and solve moves into sequence
      const parsedScr = parseScrambleInput(this.scramble);
      const scrMoves = parsedScr.ok ? parsedScr.moves : [];
      this.scrambleMoveCount = scrMoves.length;

      const solveMoveTokens = this.moves.map(m => m.move);
      const fullSequence = [...scrMoves, ...solveMoveTokens].join(" ");
      this.display.scramble = fullSequence;

      this.cubeContainer.appendChild(this.display);
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
      chip.className = "replay-move-chip";
      chip.dataset.index = String(idx + 1);
      const tSec = (m.t / 1000).toFixed(2);
      const splitSec = (m.split / 1000).toFixed(2);
      chip.innerHTML = `
        <span class="chip-num">${idx + 1}</span>
        <span class="chip-move">${m.move}</span>
        <span class="chip-split">+${splitSec}s</span>
      `;
      chip.title = `Move ${idx + 1}: ${m.move} at ${tSec}s (+${splitSec}s)`;
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
          if (indexer) {
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
        if (isActive) {
          // Scroll active chip into view smoothly
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
    if (playIcon) playIcon.innerHTML = this.isPlaying ? "&#x23F8;" : "&#x25B6;";
    if (playText) playText.textContent = this.isPlaying ? "Pause" : "Play";
  }

  handleKeyDown(e) {
    if (!this.modal || this.modal.hidden) return;
    if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;

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
    const finalSec = (this.totalDurationMs / 1000).toFixed(2);
    const moveCount = this.moves.length;
    const tps = moveCount > 0 && this.totalDurationMs > 0 ? (moveCount / (this.totalDurationMs / 1000)).toFixed(2) : "0.00";
    
    let text = `Solve Time: ${finalSec}s\n`;
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

    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        if (this.btnCopy) {
          const orig = this.btnCopy.textContent;
          this.btnCopy.textContent = "✓ Copied!";
          setTimeout(() => { if (this.btnCopy) this.btnCopy.textContent = orig; }, 1800);
        }
      }).catch(() => {});
    }
  }
}

// Global singleton instance
export const solveReplayViewer = new SolveReplayViewer();
