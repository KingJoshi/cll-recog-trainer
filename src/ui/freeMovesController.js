// Free Face Turns panel controller & cube turn state

import { escapeHtml } from '../services/htmlUtils.js';
import { applyColorsTo3DCube } from '../caseVisualizer.js';
import { isTimerViewMode, isSimulateViewMode } from '../state/appStore.js';

export function invertMove(m) {
  if (!m) return "";
  const s = m.trim();
  if (s.endsWith("2")) return s;
  if (s.endsWith("'")) return s.slice(0, -1);
  return s + "'";
}

export function invertMoves(movesArr = []) {
  return movesArr.slice().reverse().map(invertMove);
}

export function createFreeMovesController({
  appStore,
  cubeStage,
  panelEl = null,
  onSimulateFreeTurn = null,
  onResetSimulate = null,
  onUpdateSimulateSolutions = null
} = {}) {
  let userFreeMoves = [];
  let freeMoveBaseScramble = "";

  function updateUI() {
    if (typeof document === "undefined") return;
    const countBadge = document.getElementById("freeMovesCountBadge");
    const undoBtn = document.getElementById("freeMoveUndoBtn");
    const reverseBtn = document.getElementById("freeMoveReverseBtn");
    const listEl = document.getElementById("freeMovesList");
    const wrapEl = document.getElementById("freeMovesHistoryWrap");
    const wideWrap = document.getElementById("freeMovesWideWrap") || document.getElementById("freeMovesWideRow");

    if (countBadge) {
      countBadge.textContent = `${userFreeMoves.length} turn${userFreeMoves.length === 1 ? "" : "s"}`;
    }
    if (undoBtn) undoBtn.disabled = userFreeMoves.length === 0;
    if (reverseBtn) reverseBtn.disabled = userFreeMoves.length === 0;

    if (wideWrap) {
      const puz = appStore.state.currentPuzzle;
      wideWrap.hidden = !(puz === "444" || puz === "555");
    }

    if (wrapEl && listEl) {
      wrapEl.hidden = false;
      if (userFreeMoves.length === 0) {
        listEl.innerHTML = '<span class="free-moves-empty">None</span>';
      } else {
        listEl.innerHTML = userFreeMoves.map((m, idx) =>
          `<span class="free-move-chip" data-idx="${idx}">${escapeHtml(m)}</span>`
        ).join(" ");
      }
    }
  }

  function applyCurrentSequenceToCube() {
    const el = cubeStage?.getDisplay?.();
    if (!el) return;
    const fullSeq = [freeMoveBaseScramble, ...userFreeMoves].filter(Boolean).join(" ");
    el.scramble = fullSeq;
    try {
      el.player?.controller?.jumpToEnd?.({ flash: false }) || el.player?.jumpToEnd?.();
    } catch {}
    applyColorsTo3DCube(el);
  }

  function setBaseScramble(baseStr) {
    freeMoveBaseScramble = baseStr || "";
    userFreeMoves = [];
    updateUI();
  }

  async function applyFreeMove(move) {
    const el = cubeStage?.getDisplay?.();
    if (!move || !el) return;
    userFreeMoves.push(move);
    updateUI();
    applyCurrentSequenceToCube();

    if (isSimulateViewMode(appStore.state)) {
      onSimulateFreeTurn?.(userFreeMoves.length);
      onUpdateSimulateSolutions?.(getSequence());
    }
  }

  function undoLastFreeMove() {
    if (!userFreeMoves.length) return;
    userFreeMoves.pop();
    if (userFreeMoves.length === 0) {
      resetFreeMovesToScramble();
      return;
    }
    applyCurrentSequenceToCube();
    updateUI();

    if (isSimulateViewMode(appStore.state)) {
      onSimulateFreeTurn?.(userFreeMoves.length);
      onUpdateSimulateSolutions?.(getSequence());
    }
  }

  function reverseAllFreeMoves() {
    if (!userFreeMoves.length) return;
    resetFreeMovesToScramble();
  }

  function resetFreeMovesToScramble() {
    userFreeMoves = [];
    updateUI();
    if (isSimulateViewMode(appStore.state) && onResetSimulate?.("scramble")) {
      onUpdateSimulateSolutions?.(getSequence());
      return;
    }
    const el = cubeStage?.getDisplay?.();
    if (el) {
      el.scramble = freeMoveBaseScramble;
      try {
        el.player?.controller?.jumpToEnd?.({ flash: false }) || el.player?.jumpToEnd?.();
      } catch {}
      applyColorsTo3DCube(el);
    }
    onUpdateSimulateSolutions?.(getSequence());
  }

  function resetFreeMovesToSolved() {
    userFreeMoves = [];
    freeMoveBaseScramble = "";
    cubeStage?.setBaseDisplayScramble?.("");
    updateUI();
    const el = cubeStage?.getDisplay?.();
    if (el) {
      el.scramble = "";
      try {
        el.player?.controller?.jumpToEnd?.({ flash: false }) || el.player?.jumpToEnd?.();
      } catch {}
      applyColorsTo3DCube(el);
    }

    if (isSimulateViewMode(appStore.state)) {
      onResetSimulate?.("solved");
      onUpdateSimulateSolutions?.("");
    }
  }

  function getSequence() {
    return [freeMoveBaseScramble, ...userFreeMoves].filter(Boolean).join(" ").trim();
  }

  function handleKeyDown(e) {
    if (appStore.state.mode === "study" || (appStore.state.mode === "practice" && !isTimerViewMode(appStore.state) && !isSimulateViewMode(appStore.state))) return false;
    const key = String(e.key || "").toUpperCase();
    if (["U", "D", "L", "R", "F", "B"].includes(key) && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const move = e.shiftKey ? `${key}'` : key;
      void applyFreeMove(move);
      return true;
    }
    if (e.key === "Backspace" && userFreeMoves.length > 0 && !e.ctrlKey && !e.metaKey) {
      e.preventDefault();
      undoLastFreeMove();
      return true;
    }
    return false;
  }

  if (typeof document !== "undefined") {
    document.querySelectorAll(".btn-face-turn").forEach(btn => {
      btn.addEventListener("click", () => {
        const move = btn.dataset.move;
        if (move) void applyFreeMove(move);
        btn.blur();
      });
    });

    const wireBtn = (id, fn) => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.addEventListener("click", (e) => {
          e.stopPropagation();
          e.preventDefault();
          fn();
        });
      }
    };
    wireBtn("freeMoveUndoBtn", undoLastFreeMove);
    wireBtn("freeMoveReverseBtn", reverseAllFreeMoves);
    wireBtn("freeMoveResetScrambleBtn", resetFreeMovesToScramble);
    wireBtn("freeMoveResetSolvedBtn", resetFreeMovesToSolved);

    if (panelEl) {
      panelEl.open = Boolean(appStore.state.freeMovesOpen);
      panelEl.addEventListener("toggle", () => {
        appStore.state.freeMovesOpen = panelEl.open;
        appStore.saveSettings();
      });
    }
  }

  return {
    getUserMoves: () => userFreeMoves,
    getBaseScramble: () => freeMoveBaseScramble,
    getSequence,
    setBaseScramble,
    updateUI,
    applyFreeMove,
    undoLastFreeMove,
    reverseAllFreeMoves,
    resetFreeMovesToScramble,
    resetFreeMovesToSolved,
    handleKeyDown
  };
}
