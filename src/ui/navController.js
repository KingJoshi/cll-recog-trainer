// Top-level navigation controller: Puzzle switcher, Mode tabs, Track/Focus bar, Stage visibility, and Scramble coordination

import { PUZZLES, getTrack, getDefaultTrack, getSolveTargetsForPuzzle, getSolveTargetInfo, getSolveTargetLabel } from '../data/algRegistry.js';
import { MODES, VALID_PUZZLES, caseById, isTimerViewMode } from '../state/appStore.js';
import { escapeHtml } from '../services/htmlUtils.js';
import { showToast } from './toastService.js';
import {
  generateWcaScrambleForPuzzle,
  chooseWeightedCaseId,
  buildCaseScramble
} from '../services/scrambleService.js';

export const TIMER_DRILL_PRESETS = {
  "righty": {
    id: "righty",
    name: "Righty (Sexy Move)",
    scramble: "U R U' R'",
    solution: "R U R' U'",
    display: "U R U' R'",
    moves: "U R U' R' R U R' U'",
    expectedMoves: 4
  },
  "lefty": {
    id: "lefty",
    name: "Lefty (Left Sexy)",
    scramble: "U' L' U L",
    solution: "L' U' L U",
    display: "U' L' U L",
    moves: "U' L' U L L' U' L U",
    expectedMoves: 4
  },
  "inv-righty": {
    id: "inv-righty",
    name: "Inverse Righty",
    scramble: "R U R' U'",
    solution: "U R U' R'",
    display: "R U R' U'",
    moves: "R U R' U' U R U' R'",
    expectedMoves: 4
  },
  "sledge": {
    id: "sledge",
    name: "Sledgehammer",
    scramble: "F R' F' R",
    solution: "R' F R F'",
    display: "F R' F' R",
    moves: "F R' F' R R' F R F'",
    expectedMoves: 4
  },
  "hedge": {
    id: "hedge",
    name: "Hedgeslammer",
    scramble: "R' F R F'",
    solution: "F R' F' R",
    display: "R' F R F'",
    moves: "R' F R F' F R' F' R",
    expectedMoves: 4
  }
};

export function resolveTimerDrillPreset(key) {
  if (key && TIMER_DRILL_PRESETS[key]) return TIMER_DRILL_PRESETS[key];
  if (key === "lefty-inv") return TIMER_DRILL_PRESETS["lefty"];
  return TIMER_DRILL_PRESETS["righty"];
}

export function createNavController({
  appStore,
  cubeStage,
  freeMovesCtrl,
  casePickerCtrl,
  getStudyView = () => null,
  getPracticeView = () => null,
  getSolvePanelView = () => null,
  getTimerCtrl = () => null,
  getSolverWidgets = () => null,
  getStatsCtrl = () => null,
  getSmartCubeCtrl = () => null,
  getSimulatorCtrl = () => null,
  getSessionModal = () => null
} = {}) {
  const trackBar = typeof document !== "undefined" ? document.getElementById("trackBar") : null;
  const trainSubmodeBar = typeof document !== "undefined" ? document.getElementById("trainSubmodeBar") : null;
  const settingsPanel = typeof document !== "undefined" ? document.getElementById("settingsPanel") : null;
  const stage = typeof document !== "undefined" ? document.querySelector(".stage") : null;
  const cubeCard = typeof document !== "undefined" ? document.querySelector(".cube-card") : null;
  const emptyState = typeof document !== "undefined" ? document.getElementById("empty-state") : null;
  const displayContainer = typeof document !== "undefined" ? document.getElementById("display-container") : null;
  const resetOrientationBtn = typeof document !== "undefined" ? document.getElementById("resetOrientationBtn") : null;
  const regenerateBtn = typeof document !== "undefined" ? document.getElementById("regenerateBtn") : null;
  const studyViewContainer = typeof document !== "undefined" ? document.getElementById("studyViewContainer") : null;
  const practiceViewContainer = typeof document !== "undefined" ? document.getElementById("practiceViewContainer") : null;
  const simulatePanel = typeof document !== "undefined" ? document.getElementById("simulatePanel") : null;
  const solveScramble = typeof document !== "undefined" ? document.getElementById("solveScramble") : null;
  const solveScrambleSubtext = typeof document !== "undefined" ? document.getElementById("solveScrambleSubtext") : null;
  const solveScrambleOrient = typeof document !== "undefined" ? document.getElementById("solveScrambleOrient") : null;
  const solveSurface = typeof document !== "undefined" ? document.getElementById("solveSurface") : null;
  const solveTimes = typeof document !== "undefined" ? document.getElementById("solveTimes") : null;
  const layerSolutionsWidget = typeof document !== "undefined" ? document.getElementById("layerSolutionsWidget") : null;
  const crossSolutionsWidget = typeof document !== "undefined" ? document.getElementById("crossSolutionsWidget") : null;
  const statsPanel = typeof document !== "undefined" ? document.getElementById("statsPanel") : null;
  const freeMovesWrap = typeof document !== "undefined" ? document.querySelector(".free-moves-wrap") : null;
  const puzzleSwitcher = typeof document !== "undefined" ? document.getElementById("puzzleSwitcher") : null;
  const modeButtons = typeof document !== "undefined" ? Array.from(document.querySelectorAll(".mode-btn")) : [];
  const puzzleButtons = typeof document !== "undefined" ? Array.from(document.querySelectorAll(".puzzle-btn")) : [];

  let scrambleGenToken = 0;

  function getAllPuzzleButtons() {
    return puzzleSwitcher ? Array.from(puzzleSwitcher.querySelectorAll(".puzzle-btn")) : puzzleButtons;
  }

  function renderPuzzleButtons() {
    const s = appStore.state;
    const showExtra = Boolean(s.showExtraWcaEvents);
    if (puzzleSwitcher && typeof document !== "undefined") {
      puzzleSwitcher.querySelectorAll(".puzzle-btn-custom").forEach(btn => btn.remove());
      for (const ev of (s.customEvents || [])) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "puzzle-btn puzzle-btn-custom";
        btn.dataset.puzzle = ev.id;
        btn.textContent = ev.shortName || ev.name;
        btn.setAttribute("data-tooltip", `Custom event: ${ev.name}`);
        puzzleSwitcher.appendChild(btn);
      }
    }
    getAllPuzzleButtons().forEach(btn => {
      const pid = btn.dataset.puzzle;
      if (btn.classList.contains("puzzle-btn-extra")) {
        btn.hidden = !showExtra && pid !== s.currentPuzzle;
      }
      const active = pid === s.currentPuzzle;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-pressed", String(active));
    });
  }

  function updateSolveOrientationLabel(label = null) {
    if (!solveScrambleOrient) return;
    if (label) {
      solveScrambleOrient.textContent = label;
      return;
    }
    solveScrambleOrient.textContent = appStore.state.currentPuzzle === "222"
      ? "(white on bottom)"
      : "(white on top, green on front)";
  }

  function ensureTimedDrillTargetAndSession() {
    const s = appStore.state;
    const drills = getSolveTargetsForPuzzle(s.currentPuzzle).filter(item => item.id !== "full");
    if (!drills.length) return false;
    let nextTarget = s.solveTarget;
    if (!nextTarget || nextTarget === "full" || !drills.some(item => item.id === nextTarget)) {
      nextTarget = drills.find(i => i.id !== "timer-drill")?.id || drills[0].id;
    }
    const activeSess = appStore.getActiveSession?.();
    if (s.solveTarget !== nextTarget || (activeSess && (activeSess.target || "full") !== nextTarget)) {
      appStore.selectOrCreateSessionForTarget(nextTarget);
      if (PUZZLES[s.currentPuzzle]?.tracks?.some(t => t.id === nextTarget)) {
        s.currentTrackId = nextTarget;
        appStore.loadTrackSelection(s.currentPuzzle, nextTarget);
        casePickerCtrl?.buildCasePicker?.();
        casePickerCtrl?.renderSelection?.();
      }
      if (s.currentPuzzle === "222" && (nextTarget === "face" || nextTarget === "layer")) {
        getSolverWidgets()?.setLayerSolutionMode?.(nextTarget);
      }
      getSessionModal()?.populateSessionSelect?.();
      return true;
    }
    return false;
  }

  function renderTrackBar() {
    const s = appStore.state;
    const isSolveOnly = Boolean(PUZZLES[s.currentPuzzle]?.solveOnly);
    if (trainSubmodeBar) {
      trainSubmodeBar.hidden = Boolean(isSolveOnly || s.mode !== "practice");
      trainSubmodeBar.querySelectorAll("[data-train-submode]").forEach(btn => {
        const active = btn.dataset.trainSubmode === s.trainSubMode;
        btn.classList.toggle("active", active);
        btn.setAttribute("aria-pressed", String(active));
      });
    }

    if (!trackBar) return;
    if (s.mode === "simulate" || s.mode === "solve") {
      if (s.mode === "solve" && s.solveTarget !== "full") {
        s.solveTarget = "full";
      }
      trackBar.hidden = true;
      return;
    }
    trackBar.hidden = false;
    const pData = PUZZLES[s.currentPuzzle];
    if (!pData || !pData.tracks) {
      trackBar.innerHTML = "";
      return;
    }

    if (s.mode === "practice" && s.trainSubMode === "timed-drill") {
      const items = getSolveTargetsForPuzzle(s.currentPuzzle).filter(item => item.id !== "full");
      if (!items.length) {
        trackBar.hidden = true;
        return;
      }
      if (!items.some(item => item.id === s.solveTarget)) {
        ensureTimedDrillTargetAndSession();
      }

      trackBar.classList.toggle("is-dense", items.length >= 6);
      trackBar.innerHTML = items.map(item => {
        const active = item.id === s.solveTarget;
        const tipAttr = item.description ? `data-tooltip="${escapeHtml(item.description)}"` : "";
        return `<button type="button" class="track-btn ${active ? "active" : ""}" data-solve-target="${item.id}" aria-pressed="${active}" ${tipAttr}>
          <span class="track-btn-full">${escapeHtml(item.name)}</span>
          <span class="track-btn-short">${escapeHtml(item.shortName || item.name)}</span>
        </button>`;
      }).join("");

      trackBar.querySelectorAll(".track-btn").forEach(btn => {
        btn.addEventListener("click", () => {
          const tgt = btn.dataset.solveTarget;
          if (tgt) setSolveTarget(tgt);
        });
      });
      return;
    }

    trackBar.classList.toggle("is-dense", pData.tracks.length >= 6);
    trackBar.innerHTML = pData.tracks.map(t => {
      const active = t.id === s.currentTrackId;
      const tipAttr = t.description ? `data-tooltip="${escapeHtml(t.description)}"` : "";
      return `<button type="button" class="track-btn ${active ? "active" : ""}" data-track="${t.id}" aria-pressed="${active}" ${tipAttr}>
        <span class="track-btn-full">${escapeHtml(t.name)}</span>
        <span class="track-btn-short">${escapeHtml(t.shortName || t.name)}</span>
      </button>`;
    }).join("");

    trackBar.querySelectorAll(".track-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        setTrack(btn.dataset.track);
      });
    });
  }

  function renderStage() {
    const s = appStore.state;
    const isSolveOnly = Boolean(PUZZLES[s.currentPuzzle]?.solveOnly);
    if (isSolveOnly && s.mode !== "solve") {
      s.mode = "solve";
      s.solveTarget = "full";
    }
    const hasCases = s.selectedCases.size > 0;

    modeButtons.forEach(btn => {
      const m = btn.dataset.mode;
      btn.hidden = Boolean(isSolveOnly && m !== "solve");
      btn.setAttribute("aria-pressed", String(m === s.mode));
    });

    const simulating = s.mode === "simulate";
    const studying = s.mode === "study";
    const solving = isTimerViewMode(s);
    const practicing = s.mode === "practice" && !solving;

    if (studyViewContainer) studyViewContainer.hidden = !studying;
    if (practiceViewContainer) practiceViewContainer.hidden = !practicing;

    if (simulatePanel) simulatePanel.hidden = !simulating;
    if (simulating) {
      if (emptyState) emptyState.hidden = true;
      if (displayContainer) displayContainer.hidden = false;
    }

    if (studying) getStudyView()?.render?.();
    if (practicing) getPracticeView()?.render?.();

    if (regenerateBtn) regenerateBtn.hidden = true;

    const hasTrackCases = Boolean(getTrack(s.currentPuzzle, s.currentTrackId)?.cases?.length);
    const solveUsesCases = Boolean(getSolveTargetInfo(s.currentPuzzle, s.solveTarget)?.usesCases);
    if (settingsPanel) {
      settingsPanel.hidden = simulating || (solving ? !solveUsesCases : !hasTrackCases);
    }
    const activePDef = PUZZLES[s.currentPuzzle];
    const customNoScramble = Boolean(activePDef?.isCustomEvent && (!activePDef.wcaEvent || activePDef.wcaEvent === "none"));
    const hideCubeInSolve = solving && (!s.solveShowCube || customNoScramble);
    if (cubeCard) {
      cubeCard.hidden = studying || hideCubeInSolve || (!hasCases && hasTrackCases && practicing);
    }
    if (emptyState && practicing) {
      emptyState.hidden = !hasTrackCases || hasCases;
    } else if (emptyState && !practicing) {
      emptyState.hidden = true;
    }
    if (resetOrientationBtn && cubeCard) {
      resetOrientationBtn.hidden = cubeCard.hidden;
    }

    const statsMode = s.statsDisplayMode || (s.showStatsPanel === false ? "none" : (s.advancedMode ? "advanced" : "basic"));
    if (solveScramble) solveScramble.hidden = !solving;
    if (solveSurface) solveSurface.hidden = !solving;
    if (solveTimes) {
      solveTimes.hidden = !solving || statsMode !== "advanced" || (appStore.getSolves?.().length || 0) === 0;
    }
    if (layerSolutionsWidget) {
      layerSolutionsWidget.hidden = (s.showLayerSolutionsWidget === false) || !(solving || simulating) || s.currentPuzzle !== "222" || (solving && s.solveTarget === "timer-drill");
    }
    if (crossSolutionsWidget) {
      crossSolutionsWidget.hidden = (s.showCrossSolutionsWidget === false) || !(solving || simulating) || (s.currentPuzzle !== "333" && s.currentPuzzle !== "333oh") || (solving && s.solveTarget === "timer-drill");
    }
    if (statsPanel) {
      statsPanel.hidden = statsMode === "none" || s.showStatsPanel === false;
    }
    if (freeMovesWrap) {
      freeMovesWrap.hidden = s.showFreeFaceTurns !== true;
    }

    const sidebarEmpty = Boolean((!cubeCard || cubeCard.hidden) && (!solveTimes || solveTimes.hidden));
    if (stage) {
      stage.classList.toggle("mode-solve", solving);
      stage.classList.toggle("mode-study", studying);
      stage.classList.toggle("mode-practice", practicing);
      stage.classList.toggle("mode-simulate", simulating);
      stage.classList.toggle("mode-timed", false);
      stage.dataset.mode = s.mode;
      stage.dataset.trainSubmode = s.trainSubMode || "recog";
      stage.dataset.puzzle = s.currentPuzzle;
      stage.classList.toggle("solve-cube-hidden", hideCubeInSolve);
      stage.classList.toggle("solve-sidebar-empty", solving && sidebarEmpty);
    }
    if (typeof document !== "undefined" && document.body) {
      document.body.dataset.puzzle = s.currentPuzzle;
      document.body.dataset.mode = s.mode;
      document.body.classList.toggle("is-focus-mode", Boolean(s.focusMode && solving));
      document.body.classList.toggle("is-desktop-multipane", s.desktopMultiPane !== false);
    }
  }

  function restoreOrRegenerateTimerScramble() {
    const s = appStore.state;
    const solvePanel = getSolvePanelView();
    const widgets = getSolverWidgets();
    if (!s.currentSolveScramble) {
      regenerateScramble();
      return;
    }
    solvePanel?.updateSolveScrambleDisplay?.(s.currentSolveScramble);
    const is333Case = (s.currentPuzzle === "333" || s.currentPuzzle === "333oh") && ["f2l", "oll", "pll"].includes(s.solveTarget);
    const displayScr = (s.alwaysWhiteBottom && is333Case) ? `z2 ${s.currentSolveScramble}` : s.currentSolveScramble;
    cubeStage?.applyScrambleToDisplay?.(displayScr);
    cubeStage?.applyReflection?.();
    if (s.currentPuzzle === "333" || s.currentPuzzle === "333oh") {
      widgets?.updateCrossSolutions?.(s.currentSolveScramble);
    } else if (s.currentPuzzle === "222") {
      widgets?.updateLayerSolutions?.(s.currentSolveScramble);
    }
  }

  function setTrainSubMode(subMode) {
    const s = appStore.state;
    if (PUZZLES[s.currentPuzzle]?.solveOnly) return false;
    const next = subMode === "timed-drill" ? "timed-drill" : "recog";
    if (s.mode === "practice" && s.trainSubMode === next) return false;
    ++scrambleGenToken;

    const timerCtrl = getTimerCtrl();
    if (timerCtrl?.getSolveState?.() !== "idle") {
      timerCtrl?.cancelSolve?.();
    }
    cubeStage?.setTwoSidedCameraLock?.(false);

    if (next === "timed-drill") {
      getPracticeView()?.deactivate?.();
    }

    s.trainSubMode = next;
    appStore.resetCaseAppearances();

    if (s.mode === "practice") {
      if (next === "timed-drill") {
        s.statsType = "log";
        ensureTimedDrillTargetAndSession();
      } else {
        s.statsType = "recog";
      }
    }

    appStore.saveSettings();
    appStore.notify("trainSubMode", { trainSubMode: next });
    renderTrackBar();
    renderStage();
    getStatsCtrl()?.renderStatsToggle?.();
    getStatsCtrl()?.updateStatsTable?.();
    getSolvePanelView()?.renderSolvePanel?.();
    getSmartCubeCtrl()?.updateBluetoothUI?.();

    if (s.mode === "practice") {
      if (next === "timed-drill") {
        regenerateScramble();
      } else {
        getPracticeView()?.setTrack?.(s.currentPuzzle, s.currentTrackId);
      }
    }
    return true;
  }

  function setSolveTarget(tgt) {
    const s = appStore.state;
    const pData = PUZZLES[s.currentPuzzle];
    if (!tgt || !getSolveTargetInfo(s.currentPuzzle, tgt)) return false;
    if (pData?.solveOnly && tgt !== "full") return false;

    const timerCtrl = getTimerCtrl();
    if (timerCtrl?.getSolveState?.() !== "idle") {
      timerCtrl?.cancelSolve?.();
    }

    const wantMode = tgt === "full" ? "solve" : "practice";
    const wantSubMode = tgt === "full" ? s.trainSubMode : "timed-drill";
    if (s.mode !== wantMode || s.trainSubMode !== wantSubMode) {
      ++scrambleGenToken;
      if (s.mode === "study") getStudyView()?.deactivate?.();
      if (s.mode === "practice" && !isTimerViewMode(s)) getPracticeView()?.deactivate?.();
      if (s.mode === "simulate") getSimulatorCtrl()?.simTeardown?.();
      cubeStage?.setTwoSidedCameraLock?.(false);
      s.mode = wantMode;
      s.trainSubMode = wantSubMode;
      s.statsType = "log";
    }

    const res = appStore.selectOrCreateSessionForTarget(tgt);
    if (res?.action === "switched") {
      showToast(`Switched to session "${res.session.name}"`, "info", 2200);
    } else if (res?.action === "created") {
      showToast(`Created session "${res.session.name}" for ${getSolveTargetLabel(s.currentPuzzle, tgt)}`, "info", 2600);
    }
    if (pData?.tracks?.some(t => t.id === tgt)) {
      s.currentTrackId = tgt;
      appStore.loadTrackSelection(s.currentPuzzle, tgt);
      casePickerCtrl?.buildCasePicker?.();
      casePickerCtrl?.renderSelection?.();
    }
    if (s.currentPuzzle === "222" && (tgt === "face" || tgt === "layer")) {
      getSolverWidgets()?.setLayerSolutionMode?.(tgt);
    }
    appStore.saveSettings();
    getSessionModal()?.populateSessionSelect?.();
    renderTrackBar();
    renderStage();
    getStatsCtrl()?.renderStatsToggle?.();
    getSolvePanelView()?.renderSolvePanel?.();
    getStatsCtrl()?.updateStatsTable?.();
    getSmartCubeCtrl()?.updateBluetoothUI?.();
    regenerateScramble();
    return true;
  }

  function setTrack(trackId) {
    const s = appStore.state;
    const track = getTrack(s.currentPuzzle, trackId);
    if (!track) return;
    s.currentTrackId = trackId;

    appStore.loadTrackSelection(s.currentPuzzle, trackId);
    casePickerCtrl?.buildCasePicker?.();
    casePickerCtrl?.renderSelection?.();

    if (s.mode === "study") {
      getStudyView()?.setTrack?.(s.currentPuzzle, s.currentTrackId);
    } else if (s.mode === "practice" && !isTimerViewMode(s)) {
      getPracticeView()?.setTrack?.(s.currentPuzzle, s.currentTrackId);
    }

    appStore.saveSettings();
    if (isTimerViewMode(s)) {
      if (["cross", "face", "layer", "lbl", "pll", "oll", "f2l", "cll", "eg1", "eg2", "parity"].includes(trackId)) {
        s.solveTarget = trackId;
      }
      if (s.currentPuzzle === "222" && (trackId === "face" || trackId === "layer")) {
        getSolverWidgets()?.setLayerSolutionMode?.(trackId);
      }
      regenerateScramble();
    }
    renderTrackBar();
    renderStage();
    getStatsCtrl()?.updateStatsTable?.();
  }

  function setMode(next, { skipSimInit = false } = {}) {
    const s = appStore.state;
    if (PUZZLES[s.currentPuzzle]?.solveOnly && next !== "solve") {
      next = "solve";
    }
    if (next === "timed") {
      next = "practice";
      getPracticeView()?.setPracticeMode?.("timed");
    }
    if (!MODES.includes(next) || next === s.mode) return;
    ++scrambleGenToken;

    const timerCtrl = getTimerCtrl();
    if (timerCtrl?.getSolveState?.() !== "idle") {
      timerCtrl?.cancelSolve?.();
    }

    const prevMode = s.mode;
    if (prevMode === "study" && next !== "study") {
      getStudyView()?.deactivate?.();
    }
    if (prevMode === "practice" && (next !== "practice" || s.trainSubMode === "timed-drill")) {
      getPracticeView()?.deactivate?.();
      cubeStage?.setTwoSidedCameraLock?.(false);
    }
    if (prevMode === "simulate" && next !== "simulate") {
      getSimulatorCtrl()?.simTeardown?.();
    }

    s.mode = next;
    appStore.resetCaseAppearances();

    if (s.mode === "solve") {
      s.statsType = "log";
      s.solveTarget = "full";
      const activeSess = appStore.getActiveSession?.();
      if (activeSess && (activeSess.target || "full") !== "full") {
        appStore.selectOrCreateSessionForTarget("full");
      }
      getSessionModal()?.populateSessionSelect?.();
    } else if (s.mode === "practice") {
      if (s.trainSubMode === "timed-drill") {
        s.statsType = "log";
        ensureTimedDrillTargetAndSession();
      } else {
        s.statsType = "recog";
      }
    }

    appStore.saveSettings();
    renderTrackBar();
    renderStage();
    getStatsCtrl()?.renderStatsToggle?.();
    getStatsCtrl()?.updateStatsTable?.();
    getSolvePanelView()?.renderSolvePanel?.();
    getSmartCubeCtrl()?.updateBluetoothUI?.();

    if (s.mode === "simulate") {
      if (!skipSimInit) {
        getSimulatorCtrl()?.simInit?.();
      } else {
        getSimulatorCtrl()?.populateSimCaseSelect?.();
        getSimulatorCtrl()?.attachSimPlayerListeners?.();
      }
    } else if (isTimerViewMode(s)) {
      if (s.mode === "practice" && s.trainSubMode === "timed-drill") {
        regenerateScramble();
      } else {
        restoreOrRegenerateTimerScramble();
      }
    } else if (s.mode === "study") {
      cubeStage?.resetCubeOrientation?.();
      getStudyView()?.setTrack?.(s.currentPuzzle, s.currentTrackId);
    } else if (s.mode === "practice") {
      getPracticeView()?.setTrack?.(s.currentPuzzle, s.currentTrackId);
    }
  }

  function setPuzzle(puzzleId) {
    if (!VALID_PUZZLES.includes(puzzleId) && !PUZZLES[puzzleId]) return;
    ++scrambleGenToken;
    const s = appStore.state;
    const timerCtrl = getTimerCtrl();
    if (timerCtrl?.getSolveState?.() !== "idle") {
      timerCtrl?.cancelSolve?.();
    }
    cubeStage?.setTwoSidedCameraLock?.(false);

    s.currentPuzzle = puzzleId;
    s.currentCaseId = null;
    s.currentCaseScramble = null;
    s.scrambleMoves = "";
    s.scramble = "";
    s.currentSolveScramble = "";
    cubeStage?.mountScrambleDisplay?.(s.currentPuzzle);

    renderPuzzleButtons();

    const pDef = PUZZLES[s.currentPuzzle];
    s.currentTrackId = pDef?.defaultTrack || getDefaultTrack(s.currentPuzzle)?.id || "cll";
    if (pDef?.solveOnly) {
      s.mode = "solve";
    }

    let matchingSessions = s.sessions.filter(sess => (sess.puzzle || "222") === s.currentPuzzle);
    if (matchingSessions.length === 0) {
      const defaultName = pDef?.shortName ? `${pDef.shortName} Main` : `${s.currentPuzzle} Main`;
      const newSess = {
        id: `session-${s.currentPuzzle}-${Date.now()}`,
        puzzle: s.currentPuzzle,
        name: defaultName,
        target: "full",
        inspection: true,
        showCube: true,
        solves: []
      };
      s.sessions.push(newSess);
      matchingSessions = [newSess];
      appStore.saveSessions();
    }
    if (s.mode === "solve") {
      const fullSess = matchingSessions.find(sess => (sess.target || "full") === "full");
      if (fullSess) {
        s.activeSessionId = fullSess.id;
      } else {
        appStore.selectOrCreateSessionForTarget("full");
      }
    } else {
      s.activeSessionId = matchingSessions[0].id;
    }
    const activeSess = appStore.getActiveSession();
    s.lastSolve = activeSess.solves?.length ? activeSess.solves[activeSess.solves.length - 1] : null;
    s.solveTarget = activeSess.target || "full";
    s.solveShowCube = activeSess.showCube ?? true;
    s.solveInspection = activeSess.inspection ?? true;

    if (s.mode === "practice" && s.trainSubMode === "timed-drill") {
      ensureTimedDrillTargetAndSession();
    }

    appStore.loadTrackSelection(s.currentPuzzle, s.currentTrackId);
    renderTrackBar();
    updateSolveOrientationLabel();
    getSessionModal()?.populateSessionSelect?.();
    casePickerCtrl?.buildCasePicker?.();
    casePickerCtrl?.renderSelection?.();
    getSimulatorCtrl()?.populateSimCaseSelect?.();

    freeMovesCtrl?.updateUI?.();
    appStore.saveSettings();
    renderStage();
    getSolvePanelView()?.renderSolvePanel?.();
    getSmartCubeCtrl()?.updateBluetoothUI?.();
    getStatsCtrl()?.updateStatsTable?.();

    if (s.mode === "study") {
      getStudyView()?.setTrack?.(s.currentPuzzle, s.currentTrackId);
    } else if (isTimerViewMode(s)) {
      regenerateScramble();
    } else if (s.mode === "practice") {
      getPracticeView()?.setTrack?.(s.currentPuzzle, s.currentTrackId);
    } else if (s.mode === "simulate") {
      getSimulatorCtrl()?.simInit?.();
    } else {
      regenerateScramble();
    }
  }

  function applyCaseSelectionScramble(caseObj, scr, subtext = null, orientText = null) {
    const s = appStore.state;
    const solvePanel = getSolvePanelView();
    const is333 = s.currentPuzzle === "333" || s.currentPuzzle === "333oh";
    const displayScr = (s.alwaysWhiteBottom && is333) ? `z2 ${scr}` : scr;
    s.currentCaseId = caseObj.id;
    s.currentCaseScramble = scr;
    s.scrambleMoves = scr;
    s.scramble = displayScr;
    cubeStage?.applyScrambleToDisplay?.(displayScr);
    if (isTimerViewMode(s)) {
      solvePanel?.updateSolveScrambleDisplay?.(scr);
      if (solveScrambleSubtext && subtext) {
        solveScrambleSubtext.hidden = false;
        solveScrambleSubtext.textContent = subtext;
      }
      if (orientText) updateSolveOrientationLabel(orientText);
      if (is333) getSolverWidgets()?.updateCrossSolutions?.(scr);
    }
  }

  /** Fetch an async WCA scramble and ignore stale resolutions after rapid puzzle/mode switches. */
  function requestAsyncWcaScramble(token, expectedPuzzle, expectedTimerActive, onExtraUpdate = null) {
    const s = appStore.state;
    const expectedMode = s.mode;
    const expectedSubMode = s.trainSubMode;
    const solvePanel = getSolvePanelView();
    const scrTextEl = typeof document !== "undefined" ? document.getElementById("solveScrambleText") : null;
    if (expectedTimerActive && scrTextEl) {
      scrTextEl.textContent = "Generating scramble...";
    }
    generateWcaScrambleForPuzzle(expectedPuzzle).then(wcaScr => {
      if (
        token !== scrambleGenToken ||
        appStore.state.currentPuzzle !== expectedPuzzle ||
        appStore.state.mode !== expectedMode ||
        appStore.state.trainSubMode !== expectedSubMode
      ) return;
      cubeStage?.applyScrambleToDisplay?.(wcaScr);
      if (expectedTimerActive) {
        solvePanel?.updateSolveScrambleDisplay?.(wcaScr);
        onExtraUpdate?.(wcaScr);
      } else {
        s.scramble = wcaScr;
        s.scrambleMoves = wcaScr;
        s.currentSolveScramble = wcaScr;
        s.currentCaseId = null;
      }
    });
  }

  function regenerateScramble() {
    const token = ++scrambleGenToken;
    const s = appStore.state;
    const expectedPuzzle = s.currentPuzzle;
    const timerActive = isTimerViewMode(s);
    const solvePanel = getSolvePanelView();
    const widgets = getSolverWidgets();
    const hasCases = s.selectedCases.size > 0;

    if (solveScrambleSubtext) {
      solveScrambleSubtext.hidden = true;
      solveScrambleSubtext.textContent = "";
    }
    updateSolveOrientationLabel();
    solvePanel?.renderTimerDrillBanner?.();

    if (timerActive && s.solveTarget === "timer-drill") {
      const preset = resolveTimerDrillPreset(s.timerDrillPreset);
      s.timerDrillPreset = preset.id;
      s.currentCaseId = null;
      s.currentCaseScramble = preset.solution;
      cubeStage?.applyScrambleToDisplay?.(preset.scramble);
      solvePanel?.updateSolveScrambleDisplay?.(preset.scramble);
      updateSolveOrientationLabel("(4-move scramble → reverse to solve)");
      if (solveScrambleSubtext) {
        solveScrambleSubtext.hidden = false;
        solveScrambleSubtext.textContent = `Timer Drill (${preset.name}): Scramble ${preset.scramble} → Reverse to solve: ${preset.solution}`;
      }
      getStatsCtrl()?.updateStatsTable?.();
      return;
    }

    if (s.currentPuzzle === "333" || s.currentPuzzle === "333oh") {
      if (timerActive && ["pll", "oll", "f2l"].includes(s.solveTarget)) {
        const track = getTrack(s.currentPuzzle, s.solveTarget);
        const active = track.cases.filter(c => s.selectedCases.has(c.id));
        const pool = active.length > 0 ? active : track.cases;
        const c = pool[Math.floor(Math.random() * pool.length)];
        const labelPrefix = s.solveTarget === "pll" ? "PLL Case" : s.solveTarget === "oll" ? "OLL Case" : "F2L Case";
        const labelName = s.solveTarget === "pll" ? c.name : c.id;
        applyCaseSelectionScramble(c, c.setup, `${labelPrefix}: ${labelName} (${c.group})`, "(white on bottom)");
        getStatsCtrl()?.updateStatsTable?.();
        return;
      }

      if (!timerActive) {
        const track = getTrack(s.currentPuzzle, s.currentTrackId);
        if (track && track.cases.length > 0) {
          const active = track.cases.filter(c => s.selectedCases.has(c.id));
          const pool = active.length > 0 ? active : track.cases;
          const c = pool[Math.floor(Math.random() * pool.length)];
          applyCaseSelectionScramble(c, c.setup || c.scramble);
          getStatsCtrl()?.updateStatsTable?.();
          return;
        }
      }

      requestAsyncWcaScramble(token, expectedPuzzle, timerActive, (wcaScr) => {
        widgets?.updateCrossSolutions?.(wcaScr);
      });
      getStatsCtrl()?.updateStatsTable?.();
      return;
    }

    if (s.currentPuzzle === "444" || s.currentPuzzle === "555") {
      const pLabel = s.currentPuzzle === "444" ? "4x4" : "5x5";
      if ((timerActive && s.solveTarget === "parity") || (!timerActive && hasCases)) {
        const track = getTrack(s.currentPuzzle, "parity");
        const active = track.cases.filter(c => s.selectedCases.has(c.id));
        const pool = active.length > 0 ? active : track.cases;
        const c = pool[Math.floor(Math.random() * pool.length)];
        const scr = (c.scrambles && c.scrambles.length > 0)
          ? c.scrambles[Math.floor(Math.random() * c.scrambles.length)]
          : (c.setup || c.scramble);
        applyCaseSelectionScramble(c, scr, timerActive ? `${pLabel} Parity Case: ${c.name} (${c.group})` : null);
      } else {
        requestAsyncWcaScramble(token, expectedPuzzle, timerActive);
      }
      getStatsCtrl()?.updateStatsTable?.();
      return;
    }

    const activePDef = PUZZLES[expectedPuzzle];
    if (activePDef?.solveOnly) {
      if (activePDef.isCustomEvent && (!activePDef.wcaEvent || activePDef.wcaEvent === "none")) {
        s.scramble = "";
        s.scrambleMoves = "";
        s.currentSolveScramble = "";
        s.currentCaseId = null;
        cubeStage?.applyScrambleToDisplay?.("");
        solvePanel?.updateSolveScrambleDisplay?.("No scramble (Timer only)");
        updateSolveOrientationLabel("");
      } else {
        updateSolveOrientationLabel("(WCA orientation)");
        requestAsyncWcaScramble(token, expectedPuzzle, timerActive);
      }
      getStatsCtrl()?.updateStatsTable?.();
      return;
    }

    // 2x2x2
    const is222CaseTarget = timerActive && ["lbl", "cll", "eg1", "eg2"].includes(s.solveTarget);
    if (timerActive && !is222CaseTarget) {
      if (s.solveTarget === "face") widgets?.setLayerSolutionMode?.("face");
      else if (s.solveTarget === "layer") widgets?.setLayerSolutionMode?.("layer");
      requestAsyncWcaScramble(token, "222", true, (wcaScr) => {
        widgets?.updateLayerSolutions?.(wcaScr);
      });
      getStatsCtrl()?.updateStatsTable?.();
      return;
    }

    function getSrsWeightOpts(trackId) {
      const puzzleStats = s.stats?.[s.currentPuzzle]?.[trackId];
      const recogStats = puzzleStats || (s.currentPuzzle === "222" && trackId === "cll" ? s.stats : null);
      return {
        caseTags: s.caseTags || null,
        recogStats: recogStats || null
      };
    }

    if (timerActive && is222CaseTarget) {
      const targetTrack = getTrack("222", s.solveTarget);
      if (s.currentTrackId !== s.solveTarget && targetTrack) {
        s.currentTrackId = s.solveTarget;
        appStore.loadTrackSelection("222", s.solveTarget);
        casePickerCtrl?.buildCasePicker?.();
        casePickerCtrl?.renderSelection?.();
      }
      const activeCases = targetTrack?.cases?.filter(c => s.selectedCases.has(c.id)) || [];
      const pool = activeCases.length > 0 ? activeCases : (targetTrack?.cases || []);
      if (pool.length > 0) {
        const chosenId = chooseWeightedCaseId(pool.map(c => c.id), s.caseAppearances, appStore.getSolves(), getSrsWeightOpts(s.solveTarget));
        appStore.saveCaseAppearances();
        const caseObj = (chosenId && targetTrack.caseById.get(chosenId)) || pool[0];
        const res = buildCaseScramble({
          caseObj,
          alwaysWhiteBottom: s.alwaysWhiteBottom,
          allowAUF: s.allowAUF,
          isStudy: false
        });
        s.currentCaseId = caseObj.id;
        s.currentCaseScramble = res.selectedScramble;
        s.scrambleMoves = res.scrambleMoves;
        s.scramble = res.scramble;
        cubeStage?.applyScrambleToDisplay?.(s.scramble);
        solvePanel?.updateSolveScrambleDisplay?.(s.scrambleMoves);
        if (solveScrambleSubtext) {
          solveScrambleSubtext.hidden = false;
          solveScrambleSubtext.textContent = `${targetTrack.shortName || s.solveTarget}: ${caseObj.shortName || caseObj.name} (${caseObj.group})`;
        }
        widgets?.updateLayerSolutions?.(s.scrambleMoves);
      }
      getStatsCtrl()?.updateStatsTable?.();
      return;
    }

    if (hasCases) {
      const ids = [...s.selectedCases];
      const chosenId = chooseWeightedCaseId(ids, s.caseAppearances, appStore.getSolves(), getSrsWeightOpts(s.currentTrackId));
      appStore.saveCaseAppearances();
      const track = getTrack(s.currentPuzzle, s.currentTrackId);
      const caseObj = chosenId ? (track?.caseById?.get(chosenId) || caseById.get(chosenId)) : null;
      const res = buildCaseScramble({
        caseObj,
        alwaysWhiteBottom: s.alwaysWhiteBottom,
        allowAUF: s.allowAUF,
        isStudy: s.mode === "study"
      });
      s.currentCaseId = caseObj?.id || null;
      s.currentCaseScramble = res.selectedScramble;
      s.scrambleMoves = res.scrambleMoves;
      s.scramble = res.scramble;
      cubeStage?.applyScrambleToDisplay?.(s.scramble);
      if (timerActive) {
        solvePanel?.updateSolveScrambleDisplay?.(s.scrambleMoves);
        widgets?.updateLayerSolutions?.(s.scrambleMoves);
      }
    } else {
      s.currentCaseId = null;
      s.currentCaseScramble = null;
      s.scramble = "";
      s.scrambleMoves = "";
      s.currentSolveScramble = "";
      cubeStage?.applyScrambleToDisplay?.("");
      solvePanel?.updateSolveScrambleDisplay?.("");
    }

    if (s.mode === "study") {
      cubeStage?.resetCubeOrientation?.();
    }
    getStatsCtrl()?.updateStatsTable?.();
  }

  async function generatePracticeScramble(trackId = appStore.state.currentTrackId) {
    const token = ++scrambleGenToken;
    const s = appStore.state;
    const track = getTrack(s.currentPuzzle, trackId);

    const getSrsWeightOpts = (tid) => {
      const puzzleStats = s.stats?.[s.currentPuzzle]?.[tid];
      const recogStats = puzzleStats || (s.currentPuzzle === "222" && tid === "cll" ? s.stats : null);
      return {
        caseTags: s.caseTags || null,
        recogStats: recogStats || null
      };
    };

    if (track && track.cases && track.cases.length > 0) {
      const active = track.cases.filter(c => s.selectedCases.has(c.id));
      const pool = active.length > 0 ? active : track.cases;
      let caseObj = null;

      if (s.currentPuzzle === "222" && ["lbl", "cll", "eg1", "eg2"].includes(track.id)) {
        const chosenId = chooseWeightedCaseId(pool.map(c => c.id), s.caseAppearances, appStore.getSolves(), getSrsWeightOpts(track.id));
        appStore.saveCaseAppearances();
        caseObj = (chosenId && (track.caseById.get(chosenId) || caseById.get(chosenId))) || pool[0];
        const res = buildCaseScramble({
          caseObj,
          alwaysWhiteBottom: s.alwaysWhiteBottom,
          allowAUF: s.allowAUF,
          isStudy: false
        });
        s.currentCaseId = caseObj?.id || null;
        s.currentCaseScramble = res.selectedScramble;
        s.scrambleMoves = res.scrambleMoves;
        s.scramble = res.scramble;
        cubeStage?.applyScrambleToDisplay?.(s.scramble);
        return { scramble: res.scrambleMoves || res.scramble, fullScramble: res.scramble, caseObj };
      }

      const chosenId = chooseWeightedCaseId(pool.map(c => c.id), s.caseAppearances, appStore.getSolves(), getSrsWeightOpts(track.id));
      appStore.saveCaseAppearances();
      caseObj = (chosenId && (track.caseById?.get(chosenId) || caseById.get(chosenId))) || pool[Math.floor(Math.random() * pool.length)];
      const scr = (caseObj.scrambles && caseObj.scrambles.length > 0)
        ? caseObj.scrambles[Math.floor(Math.random() * caseObj.scrambles.length)]
        : (caseObj.setup || caseObj.scramble || "");
      const is333 = s.currentPuzzle === "333" || s.currentPuzzle === "333oh";
      const displayScr = (s.alwaysWhiteBottom && is333) ? `z2 ${scr}` : scr;
      s.currentCaseId = caseObj.id;
      s.currentCaseScramble = scr;
      s.scrambleMoves = scr;
      s.scramble = displayScr;
      cubeStage?.applyScrambleToDisplay?.(displayScr);
      return { scramble: scr, fullScramble: displayScr, caseObj };
    }

    const wcaScr = await generateWcaScrambleForPuzzle(s.currentPuzzle);
    if (token !== scrambleGenToken) return { scramble: "", caseObj: null };
    s.scramble = wcaScr;
    s.scrambleMoves = wcaScr;
    s.currentSolveScramble = wcaScr;
    s.currentCaseId = null;
    cubeStage?.applyScrambleToDisplay?.(wcaScr);
    return { scramble: wcaScr, caseObj: null };
  }

  if (puzzleSwitcher) {
    puzzleSwitcher.addEventListener("click", (e) => {
      const btn = e.target.closest(".puzzle-btn");
      const puzzle = btn?.dataset.puzzle;
      if (puzzle && puzzle !== appStore.state.currentPuzzle) {
        setPuzzle(puzzle);
      }
    });
  } else {
    puzzleButtons.forEach(btn => {
      btn.addEventListener("click", () => {
        const puzzle = btn.dataset.puzzle;
        if (puzzle && puzzle !== appStore.state.currentPuzzle) {
          setPuzzle(puzzle);
        }
      });
    });
  }

  modeButtons.forEach(btn => {
    btn.addEventListener("click", () => setMode(btn.dataset.mode));
  });

  trainSubmodeBar?.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-train-submode]");
    const sub = btn?.dataset.trainSubmode;
    if (sub) setTrainSubMode(sub);
  });

  if (regenerateBtn) {
    regenerateBtn.addEventListener("click", () => {
      const s = appStore.state;
      if (s.mode === "practice" && !isTimerViewMode(s)) {
        const pv = getPracticeView();
        if (pv) {
          if (pv.sprintRunning) void pv.advanceSprintScramble();
          else if (["cross", "layer", "face"].includes(s.currentTrackId)) void pv.advanceInspectionScramble();
          else void pv.advanceCasualScramble();
          return;
        }
      }
      regenerateScramble();
    });
  }

  return {
    renderPuzzleButtons,
    renderTrackBar,
    renderStage,
    setSolveTarget,
    setTrack,
    setMode,
    setTrainSubMode,
    setPuzzle,
    regenerateScramble,
    generatePracticeScramble,
    updateSolveOrientationLabel
  };
}
