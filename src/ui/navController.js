// Top-level navigation controller: Puzzle switcher, Mode tabs, Track/Focus bar, Stage visibility, and Scramble coordination

import { PUZZLES, getTrack, getDefaultTrack, getSolveTargetsForPuzzle, getSolveTargetInfo, getSolveTargetLabel } from '../data/algRegistry.js';
import { MODES, VALID_PUZZLES, caseById, isTimerViewMode, isSimulateViewMode, DEFAULT_VISIBLE_EVENTS, isBetaTrack, isBetaPuzzle, isExperimentalEnabled, isTrackEnabled, isPuzzleEnabled } from '../state/appStore.js';
import { escapeHtml } from '../services/htmlUtils.js';
import { showToast } from './toastService.js';
import {
  generateWcaScrambleForPuzzle,
  chooseWeightedCaseId,
  buildCaseScramble,
  applyTrainingBottomOrientation,
  describeTrainingBottomOrientation,
  hasSolveCubeRotation,
  stripSolveCubeRotations
} from '../services/scrambleService.js';

export const TIMER_DRILL_PRESETS = {
  "righty": {
    id: "righty",
    name: "Righty",
    scramble: "U R U' R'",
    solution: "R U R' U'",
    display: "U R U' R'",
    moves: "U R U' R' R U R' U'",
    expectedMoves: 4
  },
  "lefty": {
    id: "lefty",
    name: "Lefty",
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
  getNotationView = () => null,
  getPracticeView = () => null,
  getAlgDrillView = () => null,
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
  const notationViewContainer = typeof document !== "undefined" ? document.getElementById("notationViewContainer") : null;
  const practiceViewContainer = typeof document !== "undefined" ? document.getElementById("practiceViewContainer") : null;
  const algDrillContainer = typeof document !== "undefined" ? document.getElementById("algDrillContainer") : null;
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
  const onboardingBtn = typeof document !== "undefined" ? document.getElementById("onboardingBtn") : null;
  const modeButtons = typeof document !== "undefined" ? Array.from(document.querySelectorAll(".mode-btn")) : [];
  const puzzleButtons = typeof document !== "undefined" ? Array.from(document.querySelectorAll(".puzzle-btn")) : [];

  let scrambleGenToken = 0;

  function getAllPuzzleButtons() {
    return puzzleSwitcher ? Array.from(puzzleSwitcher.querySelectorAll(".puzzle-btn")) : puzzleButtons;
  }

  function renderPuzzleButtons() {
    const s = appStore.state;
    const allowExtraPuzzles = isExperimentalEnabled(s, "extraPuzzles");
    const allowCustomEvents = isExperimentalEnabled(s, "customEvents");
    const rawVisible = Array.isArray(s.visibleEvents) && s.visibleEvents.length
      ? s.visibleEvents
      : (s.showExtraWcaEvents ? VALID_PUZZLES : DEFAULT_VISIBLE_EVENTS);
    const visibleSet = new Set(
      allowExtraPuzzles ? rawVisible : rawVisible.filter(id => DEFAULT_VISIBLE_EVENTS.includes(id))
    );
    if (visibleSet.size === 0) DEFAULT_VISIBLE_EVENTS.forEach(id => visibleSet.add(id));
    if (puzzleSwitcher && typeof document !== "undefined") {
      puzzleSwitcher.querySelectorAll(".puzzle-btn-custom").forEach(btn => btn.remove());
      if (allowCustomEvents) {
        for (const ev of (s.customEvents || [])) {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "puzzle-btn puzzle-btn-custom";
          btn.dataset.puzzle = ev.id;
          btn.innerHTML = `${escapeHtml(ev.shortName || ev.name)}<sup class="beta-sup" aria-label="Experimental">β</sup>`;
          btn.setAttribute("data-tooltip", `Custom event (Experimental): ${ev.name}`);
          puzzleSwitcher.appendChild(btn);
        }
      }
    }
    getAllPuzzleButtons().forEach(btn => {
      const pid = btn.dataset.puzzle;
      if (!btn.classList.contains("puzzle-btn-custom")) {
        btn.hidden = (!allowExtraPuzzles && isBetaPuzzle(pid)) || (!visibleSet.has(pid) && pid !== s.currentPuzzle);
      }
      const active = pid === s.currentPuzzle;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-pressed", String(active));
    });
  }

  function updateSolveOrientationLabel(label = null) {
    if (!solveScrambleOrient) return;
    if (appStore.state.mode === "solve") {
      solveScrambleOrient.textContent = "";
      solveScrambleOrient.hidden = true;
      return;
    }
    const text = String(label || "").trim();
    solveScrambleOrient.textContent = text;
    solveScrambleOrient.hidden = !text;
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
    const isHideSimulate = Boolean(PUZZLES[s.currentPuzzle]?.hideSimulate);
    if (trainSubmodeBar) {
      trainSubmodeBar.hidden = Boolean(isSolveOnly || isHideSimulate || s.mode !== "practice");
      trainSubmodeBar.querySelectorAll("[data-train-submode]").forEach(btn => {
        const active = btn.dataset.trainSubmode === s.trainSubMode;
        btn.classList.toggle("active", active);
        btn.setAttribute("aria-pressed", String(active));
      });
    }

    if (!trackBar) return;
    if (isSimulateViewMode(s) || s.mode === "solve" || s.mode === "notation") {
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
      const items = getSolveTargetsForPuzzle(s.currentPuzzle).filter(item =>
        item.id !== "full" && isTrackEnabled(s, s.currentPuzzle, item.id)
      );
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
        const betaSup = isBetaTrack(s.currentPuzzle, item.id)
          ? '<sup class="beta-sup" aria-label="Experimental">β</sup>'
          : "";
        return `<button type="button" class="track-btn ${active ? "active" : ""}" data-solve-target="${item.id}" aria-pressed="${active}" ${tipAttr}>
          <span class="track-btn-full">${escapeHtml(item.name)}${betaSup}</span>
          <span class="track-btn-short">${escapeHtml(item.shortName || item.name)}${betaSup}</span>
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

    const isAlgDrill = s.mode === "practice" && s.trainSubMode === "alg-drill";
    const visibleTracks = (s.mode === "practice"
      ? pData.tracks.filter(t => !t.studyOnly && (!isAlgDrill || (t.cases && t.cases.length > 0)))
      : s.mode === "study"
        ? pData.tracks.filter(t => !t.practiceOnly)
        : pData.tracks
    ).filter(t => isTrackEnabled(s, s.currentPuzzle, t.id));
    if (!visibleTracks.some(t => t.id === s.currentTrackId) && visibleTracks.length > 0) {
      const preferred = visibleTracks.find(t => t.id === PUZZLES[s.currentPuzzle]?.defaultTrack) || visibleTracks[0];
      s.currentTrackId = preferred.id;
      appStore.loadTrackSelection(s.currentPuzzle, s.currentTrackId);
    }

    trackBar.classList.toggle("is-dense", visibleTracks.length >= 6);
    trackBar.innerHTML = visibleTracks.map(t => {
      const active = t.id === s.currentTrackId;
      const tipAttr = t.description ? `data-tooltip="${escapeHtml(t.description)}"` : "";
      const betaSup = isBetaTrack(s.currentPuzzle, t.id)
        ? '<sup class="beta-sup" aria-label="Experimental">β</sup>'
        : "";
      return `<button type="button" class="track-btn ${active ? "active" : ""}" data-track="${t.id}" aria-pressed="${active}" ${tipAttr}>
        <span class="track-btn-full">${escapeHtml(t.name)}${betaSup}</span>
        <span class="track-btn-short">${escapeHtml(t.shortName || t.name)}${betaSup}</span>
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
    const isHideSimulate = Boolean(PUZZLES[s.currentPuzzle]?.hideSimulate);
    if (isSolveOnly && s.mode !== "solve" && s.mode !== "notation") {
      s.mode = "solve";
      s.solveTarget = "full";
    } else if (isHideSimulate && isSimulateViewMode(s)) {
      s.mode = "solve";
      if (s.trainSubMode === "simulate") s.trainSubMode = "recog";
      s.solveTarget = "full";
    }
    const hasCases = s.selectedCases.size > 0;

    const notationEnabled = isExperimentalEnabled(s, "notationTutorial");

    modeButtons.forEach(btn => {
      const m = btn.dataset.mode;
      btn.hidden = Boolean(
        (isSolveOnly && m !== "solve") ||
        (isHideSimulate && m === "simulate") ||
        (m === "notation" && !notationEnabled)
      );
      btn.setAttribute("aria-pressed", String(m === s.mode));
    });

    const notationMode = s.mode === "notation";
    const simulating = isSimulateViewMode(s);
    const studying = s.mode === "study";
    const solving = isTimerViewMode(s);
    const algDrilling = s.mode === "practice" && s.trainSubMode === "alg-drill";
    const practicing = s.mode === "practice" && !solving && !algDrilling && !simulating && !notationMode;

    if (studyViewContainer) studyViewContainer.hidden = !studying;
    if (notationViewContainer) notationViewContainer.hidden = !notationMode;
    if (practiceViewContainer) practiceViewContainer.hidden = !practicing;
    if (algDrillContainer) algDrillContainer.hidden = !algDrilling;

    if (simulatePanel) simulatePanel.hidden = !simulating;
    if (simulating) {
      if (emptyState) emptyState.hidden = true;
      if (displayContainer) displayContainer.hidden = false;
    }

    if (studying) getStudyView()?.render?.();
    if (notationMode) getNotationView()?.render?.();
    if (practicing) getPracticeView()?.render?.();
    if (algDrilling) getAlgDrillView()?.render?.();

    if (regenerateBtn) regenerateBtn.hidden = true;

    const hasTrackCases = Boolean(getTrack(s.currentPuzzle, s.currentTrackId)?.cases?.length);
    const solveUsesCases = Boolean(getSolveTargetInfo(s.currentPuzzle, s.solveTarget)?.usesCases);
    if (settingsPanel) {
      settingsPanel.hidden = notationMode || simulating || (solving ? !solveUsesCases : !hasTrackCases);
    }
    const activePDef = PUZZLES[s.currentPuzzle];
    const customNoScramble = Boolean(activePDef?.isCustomEvent && (!activePDef.wcaEvent || activePDef.wcaEvent === "none"));
    const hideCubeInSolve = solving && (!s.solveShowCube || customNoScramble);
    if (cubeCard) {
      cubeCard.hidden = notationMode || studying || hideCubeInSolve || (!hasCases && hasTrackCases && practicing);
    }
    if (emptyState && practicing) {
      emptyState.hidden = !hasTrackCases || hasCases;
    } else if (emptyState) {
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
    const panelVis = s.statsPanelVisibility || (s.showStatsPanel === false ? "hidden" : "always");
    if (statsPanel) {
      statsPanel.hidden =
        statsMode === "none" ||
        s.showStatsPanel === false ||
        panelVis === "hidden" ||
        (panelVis === "solve-only" && !solving);
    }
    if (freeMovesWrap) {
      freeMovesWrap.hidden = s.showFreeFaceTurns !== true;
    }

    const sidebarEmpty = Boolean((!cubeCard || cubeCard.hidden) && (!solveTimes || solveTimes.hidden));
    if (onboardingBtn) {
      onboardingBtn.classList.toggle("active", notationMode);
      onboardingBtn.setAttribute("aria-pressed", String(notationMode));
    }
    if (stage) {
      stage.classList.toggle("mode-solve", solving);
      stage.classList.toggle("mode-study", studying);
      stage.classList.toggle("mode-notation", notationMode);
      stage.classList.toggle("mode-practice", practicing || algDrilling);
      stage.classList.toggle("mode-alg-drill", algDrilling);
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
    if (s.mode === "solve") {
      s.solveTarget = "full";
      if (!s.currentSolveScramble || s.currentCaseId != null || hasSolveCubeRotation(s.currentSolveScramble, s.currentPuzzle)) {
        regenerateScramble();
        return;
      }
      const displayScr = stripSolveCubeRotations(s.currentSolveScramble, s.currentPuzzle);
      s.currentSolveScramble = displayScr;
      solvePanel?.updateSolveScrambleDisplay?.(displayScr);
      updateSolveOrientationLabel();
      cubeStage?.applyScrambleToDisplay?.(displayScr);
      cubeStage?.applyReflection?.();
      if (s.currentPuzzle === "333" || s.currentPuzzle === "333oh") {
        widgets?.updateCrossSolutions?.(s.scrambleMoves || displayScr);
      } else if (s.currentPuzzle === "222") {
        widgets?.updateLayerSolutions?.(s.scrambleMoves || displayScr);
      }
      return;
    }
    if (!s.currentSolveScramble) {
      regenerateScramble();
      return;
    }
    const is333Case = (s.currentPuzzle === "333" || s.currentPuzzle === "333oh") && ["f2l", "oll", "pll", "coll", "cmll", "wv"].includes(s.solveTarget);
    const hasLeadingRot = /^\s*[xyz][2']?\b/i.test(s.currentSolveScramble);
    const displayScr = (is333Case && !hasLeadingRot)
      ? applyTrainingBottomOrientation(s.currentSolveScramble, s.trainingBottomFaces)
      : s.currentSolveScramble;
    solvePanel?.updateSolveScrambleDisplay?.(displayScr);
    cubeStage?.applyScrambleToDisplay?.(displayScr);
    cubeStage?.applyReflection?.();
    if (s.currentPuzzle === "333" || s.currentPuzzle === "333oh") {
      widgets?.updateCrossSolutions?.(s.scrambleMoves || displayScr);
    } else if (s.currentPuzzle === "222") {
      widgets?.updateLayerSolutions?.(s.scrambleMoves || displayScr);
    }
  }

  function setTrainSubMode(subMode, { skipSimInit = false } = {}) {
    const s = appStore.state;
    if (PUZZLES[s.currentPuzzle]?.solveOnly || PUZZLES[s.currentPuzzle]?.hideSimulate) return false;
    const next = ["timed-drill", "alg-drill", "simulate"].includes(subMode) ? subMode : "recog";
    if (s.mode === "practice" && s.trainSubMode === next) return false;
    ++scrambleGenToken;

    const timerCtrl = getTimerCtrl();
    if (timerCtrl?.getSolveState?.() !== "idle") {
      timerCtrl?.cancelSolve?.();
    }
    cubeStage?.setTwoSidedCameraLock?.(false);

    if (s.trainSubMode === "simulate" && next !== "simulate") {
      getSimulatorCtrl()?.simTeardown?.();
    }
    if (next !== "recog") {
      getPracticeView()?.deactivate?.();
    }
    if (next !== "alg-drill") {
      getAlgDrillView()?.deactivate?.();
    }

    s.trainSubMode = next;
    appStore.resetCaseAppearances();

    if (s.mode === "practice") {
      if (next === "timed-drill") {
        s.statsType = "log";
        ensureTimedDrillTargetAndSession();
      } else {
        s.statsType = "recog";
        if (next === "alg-drill") {
          const curTrack = getTrack(s.currentPuzzle, s.currentTrackId);
          if (!curTrack || !curTrack.cases?.length) {
            const firstCaseTrack = (PUZZLES[s.currentPuzzle]?.tracks || []).find(t => !t.studyOnly && t.cases?.length > 0);
            if (firstCaseTrack) {
              s.currentTrackId = firstCaseTrack.id;
              appStore.loadTrackSelection(s.currentPuzzle, s.currentTrackId);
              casePickerCtrl?.buildCasePicker?.();
              casePickerCtrl?.renderSelection?.();
            }
          }
        }
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
      if (next === "simulate") {
        if (!skipSimInit) {
          getSimulatorCtrl()?.simInit?.();
        } else {
          getSimulatorCtrl()?.populateSimCaseSelect?.();
          getSimulatorCtrl()?.attachSimPlayerListeners?.();
        }
      } else if (next === "timed-drill") {
        regenerateScramble();
      } else if (next === "alg-drill") {
        getAlgDrillView()?.setTrack?.(s.currentPuzzle, s.currentTrackId);
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
    if (!isTrackEnabled(s, s.currentPuzzle, tgt)) {
      showToast("Enable this track in Settings → Experimental to access it.", "warning", 2600);
      return false;
    }
    if ((pData?.solveOnly || pData?.hideSimulate) && tgt !== "full") return false;

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
      if (isSimulateViewMode(s)) getSimulatorCtrl()?.simTeardown?.();
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
    if (!isTrackEnabled(s, s.currentPuzzle, trackId)) {
      showToast("Enable this track in Settings → Experimental to access it.", "warning", 2600);
      return;
    }
    s.currentTrackId = trackId;

    appStore.loadTrackSelection(s.currentPuzzle, trackId);
    casePickerCtrl?.buildCasePicker?.();
    casePickerCtrl?.renderSelection?.();

    if (s.mode === "study") {
      getStudyView()?.setTrack?.(s.currentPuzzle, s.currentTrackId);
    } else if (s.mode === "practice" && s.trainSubMode === "alg-drill") {
      getAlgDrillView()?.setTrack?.(s.currentPuzzle, s.currentTrackId);
    } else if (s.mode === "practice" && !isTimerViewMode(s)) {
      getPracticeView()?.setTrack?.(s.currentPuzzle, s.currentTrackId);
    }

    appStore.saveSettings();
    if (isTimerViewMode(s)) {
      if (["cross", "face", "layer", "lbl", "pll", "oll", "f2l", "coll", "cmll", "wv", "cll", "eg1", "eg2", "parity"].includes(trackId)) {
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
    if (PUZZLES[s.currentPuzzle]?.hideSimulate && next === "simulate") {
      return;
    }
    if (next === "simulate") {
      if (s.mode === "practice") {
        setTrainSubMode("simulate", { skipSimInit });
        return;
      }
      s.trainSubMode = "simulate";
      next = "practice";
    } else if (next === "timed") {
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
    const prevSimulating = isSimulateViewMode(s);
    if (prevMode === "study" && next !== "study") {
      getStudyView()?.deactivate?.();
    }
    if (prevMode === "notation" && next !== "notation") {
      getNotationView()?.teardown?.();
    }
    if (prevMode === "practice" && (next !== "practice" || s.trainSubMode !== "recog")) {
      getPracticeView()?.deactivate?.();
      cubeStage?.setTwoSidedCameraLock?.(false);
    }
    if (prevMode === "practice" && next !== "practice" && s.trainSubMode === "alg-drill") {
      getAlgDrillView()?.deactivate?.();
    }
    if (prevSimulating && (next !== "practice" || s.trainSubMode !== "simulate")) {
      getSimulatorCtrl()?.simTeardown?.();
    }

    const prevTarget = s.solveTarget;
    s.mode = next;
    appStore.resetCaseAppearances();

    if (s.mode === "solve") {
      s.statsType = "log";
      s.solveTarget = "full";
      if (prevTarget !== "full" || s.currentCaseId != null || hasSolveCubeRotation(s.currentSolveScramble, s.currentPuzzle)) {
        s.currentSolveScramble = "";
        s.scramble = "";
        s.scrambleMoves = "";
        s.currentCaseId = null;
        s.currentCaseScramble = null;
      }
      const activeSess = appStore.getActiveSession?.();
      if (activeSess && (activeSess.target || "full") !== "full") {
        appStore.selectOrCreateSessionForTarget("full");
      }
      getSessionModal()?.populateSessionSelect?.();
    } else if (s.mode === "practice") {
      if (PUZZLES[s.currentPuzzle]?.hideSimulate) {
        s.trainSubMode = "recog";
      }
      if (s.trainSubMode === "timed-drill") {
        s.statsType = "log";
        ensureTimedDrillTargetAndSession();
      } else {
        s.statsType = "recog";
        if (s.trainSubMode !== "simulate") {
          const curTrack = getTrack(s.currentPuzzle, s.currentTrackId);
          if (!curTrack || curTrack.studyOnly) {
            const practiceTracks = (PUZZLES[s.currentPuzzle]?.tracks || []).filter(t => !t.studyOnly);
            const defTrack = practiceTracks.find(t => t.id === PUZZLES[s.currentPuzzle]?.defaultTrack);
            s.currentTrackId = defTrack?.id || practiceTracks[0]?.id || getDefaultTrack(s.currentPuzzle)?.id || s.currentTrackId;
            appStore.loadTrackSelection(s.currentPuzzle, s.currentTrackId);
          }
        }
      }
    } else if (s.mode === "study") {
      const curTrack = getTrack(s.currentPuzzle, s.currentTrackId);
      if (!curTrack || curTrack.practiceOnly) {
        const studyTracks = (PUZZLES[s.currentPuzzle]?.tracks || []).filter(t => !t.practiceOnly);
        const defTrack = studyTracks.find(t => t.id === PUZZLES[s.currentPuzzle]?.defaultTrack);
        s.currentTrackId = defTrack?.id || studyTracks[0]?.id || getDefaultTrack(s.currentPuzzle)?.id || s.currentTrackId;
        appStore.loadTrackSelection(s.currentPuzzle, s.currentTrackId);
      }
    }

    appStore.saveSettings();
    renderTrackBar();
    renderStage();
    getStatsCtrl()?.renderStatsToggle?.();
    getStatsCtrl()?.updateStatsTable?.();
    getSolvePanelView()?.renderSolvePanel?.();
    getSmartCubeCtrl()?.updateBluetoothUI?.();

    if (isSimulateViewMode(s)) {
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
    } else if (s.mode === "practice" && s.trainSubMode === "alg-drill") {
      getAlgDrillView()?.setTrack?.(s.currentPuzzle, s.currentTrackId);
    } else if (s.mode === "practice") {
      getPracticeView()?.setTrack?.(s.currentPuzzle, s.currentTrackId);
    }
  }

  function setPuzzle(puzzleId) {
    if (!VALID_PUZZLES.includes(puzzleId) && !PUZZLES[puzzleId]) return;
    if (!isPuzzleEnabled(appStore.state, puzzleId)) {
      const featureName = VALID_PUZZLES.includes(puzzleId) ? "Additional WCA & Side Puzzles" : "Custom Events";
      showToast(`Enable ${featureName} in Settings → Experimental to use this puzzle.`, "warning", 2600);
      return;
    }
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
    } else if (pDef?.hideSimulate) {
      if (isSimulateViewMode(s)) {
        s.mode = "solve";
        if (s.trainSubMode === "simulate") s.trainSubMode = "recog";
      }
      if (s.mode === "practice") {
        s.trainSubMode = "recog";
        const practiceTrack = pDef.tracks?.find(t => !t.studyOnly);
        if (practiceTrack) s.currentTrackId = practiceTrack.id;
      }
    }

    let matchingSessions = s.sessions.filter(sess => (sess.puzzle || "222") === s.currentPuzzle);
    if (matchingSessions.length === 0) {
      const defaultName = pDef?.shortName ? `${pDef.shortName} Main` : `${s.currentPuzzle} Main`;
      const newSess = {
        id: `session-${s.currentPuzzle}-${Date.now()}`,
        puzzle: s.currentPuzzle,
        name: defaultName,
        target: "full",
        inspection: Boolean(s.globalSolveInspection ?? true),
        showCube: Boolean(s.globalSolveShowCube ?? true),
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
    appStore.syncEffectiveSolveOptions?.();

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
    } else if (isSimulateViewMode(s)) {
      getSimulatorCtrl()?.simInit?.();
    } else if (s.mode === "practice" && s.trainSubMode === "alg-drill") {
      getAlgDrillView()?.setTrack?.(s.currentPuzzle, s.currentTrackId);
    } else if (s.mode === "practice") {
      getPracticeView()?.setTrack?.(s.currentPuzzle, s.currentTrackId);
    } else {
      regenerateScramble();
    }
  }

  function applyCaseSelectionScramble(caseObj, scr, subtext = null, orientText = null) {
    const s = appStore.state;
    const solvePanel = getSolvePanelView();
    const is333 = s.currentPuzzle === "333" || s.currentPuzzle === "333oh";
    const is222Case = s.currentPuzzle === "222" && ["lbl", "cll", "eg1", "eg2", "ortega"].includes(s.currentTrackId);
    const displayScr = (is333 || is222Case)
      ? applyTrainingBottomOrientation(scr, s.trainingBottomFaces)
      : scr;
    s.currentCaseId = caseObj.id;
    s.currentCaseScramble = scr;
    s.scramble = displayScr;
    cubeStage?.applyScrambleToDisplay?.(displayScr);
    if (isTimerViewMode(s)) {
      solvePanel?.updateSolveScrambleDisplay?.(displayScr);
      s.scrambleMoves = scr;
      if (solveScrambleSubtext && subtext) {
        solveScrambleSubtext.hidden = false;
        solveScrambleSubtext.textContent = subtext;
      }
      updateSolveOrientationLabel(orientText || describeTrainingBottomOrientation(displayScr, s.solveTarget));
      if (is333) getSolverWidgets()?.updateCrossSolutions?.(scr);
    } else {
      s.scrambleMoves = scr;
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
      const finalScr = expectedMode === "solve" ? stripSolveCubeRotations(wcaScr, expectedPuzzle) : wcaScr;
      cubeStage?.applyScrambleToDisplay?.(finalScr);
      if (expectedTimerActive) {
        solvePanel?.updateSolveScrambleDisplay?.(finalScr);
        updateSolveOrientationLabel();
        onExtraUpdate?.(finalScr);
      } else {
        s.scramble = finalScr;
        s.scrambleMoves = finalScr;
        s.currentSolveScramble = finalScr;
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

    if (s.mode === "solve") {
      s.solveTarget = "full";
      s.currentCaseId = null;
      s.currentCaseScramble = null;
    }

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
      if (timerActive && ["pll", "oll", "f2l", "coll", "cmll", "wv"].includes(s.solveTarget)) {
        const track = getTrack(s.currentPuzzle, s.solveTarget);
        const active = track.cases.filter(c => s.selectedCases.has(c.id));
        const pool = active.length > 0 ? active : track.cases;
        const c = pool[Math.floor(Math.random() * pool.length)];
        const labelPrefixMap = { pll: "PLL Case", oll: "OLL Case", f2l: "F2L Case", coll: "COLL Case", cmll: "CMLL Case", wv: "WV Case" };
        const labelPrefix = labelPrefixMap[s.solveTarget] || "Case";
        const labelName = s.solveTarget === "pll" ? c.name : c.id;
        applyCaseSelectionScramble(c, c.setup, `${labelPrefix}: ${labelName} (${c.group})`);
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
    if (activePDef?.solveOnly || activePDef?.hideSimulate) {
      if (activePDef.isCustomEvent && (!activePDef.wcaEvent || activePDef.wcaEvent === "none")) {
        s.scramble = "";
        s.scrambleMoves = "";
        s.currentSolveScramble = "";
        s.currentCaseId = null;
        cubeStage?.applyScrambleToDisplay?.("");
        solvePanel?.updateSolveScrambleDisplay?.("No scramble (Timer only)");
        updateSolveOrientationLabel("");
      } else {
        updateSolveOrientationLabel(s.mode === "solve" ? "" : "(WCA orientation)");
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
          trainingBottomFaces: s.trainingBottomFaces,
          allowAUF: s.allowAUF,
          isStudy: false
        });
        s.currentCaseId = caseObj.id;
        s.currentCaseScramble = res.selectedScramble;
        s.scramble = res.scramble;
        cubeStage?.applyScrambleToDisplay?.(s.scramble);
        solvePanel?.updateSolveScrambleDisplay?.(s.scramble);
        s.scrambleMoves = res.scrambleMoves;
        updateSolveOrientationLabel(describeTrainingBottomOrientation(s.scramble, s.solveTarget));
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
        trainingBottomFaces: s.trainingBottomFaces,
        allowAUF: s.allowAUF,
        isStudy: s.mode === "study"
      });
      s.currentCaseId = caseObj?.id || null;
      s.currentCaseScramble = res.selectedScramble;
      s.scramble = res.scramble;
      cubeStage?.applyScrambleToDisplay?.(s.scramble);
      if (timerActive) {
        solvePanel?.updateSolveScrambleDisplay?.(s.scramble);
        s.scrambleMoves = res.scrambleMoves;
        updateSolveOrientationLabel(describeTrainingBottomOrientation(s.scramble, s.solveTarget));
        widgets?.updateLayerSolutions?.(s.scrambleMoves);
      } else {
        s.scrambleMoves = res.scrambleMoves;
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
          trainingBottomFaces: s.trainingBottomFaces,
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
      const displayScr = is333
        ? applyTrainingBottomOrientation(scr, s.trainingBottomFaces)
        : scr;
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

  function startAlgDrill({ puzzleId = null, trackId = null, caseIds = [] } = {}) {
    const s = appStore.state;
    if (puzzleId && puzzleId !== s.currentPuzzle) {
      setPuzzle(puzzleId);
    }
    if (s.mode !== "practice") {
      s.trainSubMode = "alg-drill";
      setMode("practice");
    } else if (s.trainSubMode !== "alg-drill") {
      setTrainSubMode("alg-drill");
    }
    if (trackId && trackId !== s.currentTrackId && getTrack(s.currentPuzzle, trackId)) {
      setTrack(trackId);
    }
    const drillView = getAlgDrillView();
    if (Array.isArray(caseIds) && caseIds.length > 0) {
      if (drillView) {
        drillView.setCasePool(caseIds);
        casePickerCtrl?.buildCasePicker?.();
        casePickerCtrl?.renderSelection?.();
      } else {
        appStore.setSelection(new Set(caseIds), { persist: true });
        casePickerCtrl?.buildCasePicker?.();
        casePickerCtrl?.renderSelection?.();
      }
    } else {
      drillView?.setTrack?.(s.currentPuzzle, s.currentTrackId);
    }
    renderStage();
    if (algDrillContainer && typeof algDrillContainer.scrollIntoView === "function") {
      algDrillContainer.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
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
    startAlgDrill,
    regenerateScramble,
    generatePracticeScramble,
    updateSolveOrientationLabel
  };
}
