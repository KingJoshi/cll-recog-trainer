// Composition Root — wires centralized state, controllers, views, and keyboard routing
import './styles/index.css';

import { PUZZLES, getTrack, getSolveTargetInfo, onPreferredAlgChange } from './data/algRegistry.js';
import { StudyView } from './studyView.js';
import { PracticeView } from './practiceView.js';
import { solveReplayViewer } from './replayView.js';
import { clearSvgCache, applyColorsTo3DCube } from './caseVisualizer.js';
import { smartCube } from './smartCube.js';
import { appStore, isTimerViewMode, ALL_BUILTIN_EVENT_IDS } from './state/appStore.js';
import { modalManager } from './ui/modalManager.js';
import { showToast } from './ui/toastService.js';
import { initSyncTracking } from './services/syncStorage.js';
import { GoogleDriveSyncService } from './services/googleDriveSync.js';
import { createCloudSyncController, formatMergeSummary } from './features/sync/cloudSyncController.js';
import { createPwaInstallController } from './features/pwa/pwaInstallController.js';
import { createKeyboardRouter } from './ui/keyboardRouter.js';
import {
  eventToKeyCombo,
  findActionForCombo,
  formatKeyCombo
} from './services/keyboardShortcuts.js';
import { createTooltipController } from './ui/tooltipController.js';
import { createCubeStageController } from './ui/cubeStageController.js';
import { createFreeMovesController } from './ui/freeMovesController.js';
import { createCasePickerController } from './ui/casePickerController.js';
import { createNavController } from './ui/navController.js';
import { createSolverWidgetsView } from './features/solve/solverWidgetsView.js';
import { createSolvePanelView } from './features/solve/solvePanelView.js';
import { createTimerController } from './features/solve/timerController.js';
import { createDisconnectAlertView } from './features/bluetooth/disconnectAlertView.js';
import { createSmartCubeController } from './features/bluetooth/smartCubeController.js';
import { createGanTimerController } from './features/bluetooth/ganTimerController.js';
import { createStatsPanelController } from './features/stats/statsPanelController.js';
import { createSimulatorController } from './features/simulator/simulatorController.js';
import { createCustomLabelModal } from './features/modals/customLabelModal.js';
import { createSessionModalController } from './features/modals/sessionModal.js';
import { createSolveDetailModal } from './features/modals/solveDetailModal.js';
import { createQuickSimModal } from './features/modals/quickSimModal.js';
import { createSettingsModalController } from './features/modals/settingsModal.js';
import { createShortcutsModalController } from './features/modals/shortcutsModal.js';
import { createOnboardingWizard } from './features/onboarding/onboardingWizard.js';

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(err => {
    console.warn('Service worker registration failed:', err);
  });
}

let studyView;
let practiceView;
let freeMovesCtrl;
let casePickerCtrl;
let navCtrl;
let solverWidgets;
let solvePanelView;
let timerCtrl;
let disconnectAlertView;
let smartCubeCtrl;
let ganTimerCtrl;
let statsCtrl;
let simulatorCtrl;
let customLabelModal;
let sessionModal;
let solveDetailModal;
let quickSimModal;
let settingsModal;
let shortcutsModal;
let cloudSyncCtrl;
let onboardingWizard;
let tooltipCtrl;
let flashTimer = 0;

function flashCube(result) {
  const cubeCard = document.querySelector(".cube-card");
  if (!cubeCard) return;
  cubeCard.classList.remove("flash-correct", "flash-partial", "flash-incorrect");
  void cubeCard.offsetWidth;
  const cls = result === "correct" ? "flash-correct" : result === "partial" ? "flash-partial" : "flash-incorrect";
  cubeCard.classList.add(cls);
  clearTimeout(flashTimer);
  flashTimer = setTimeout(() => {
    cubeCard.classList.remove("flash-correct", "flash-partial", "flash-incorrect");
  }, 700);
}

function getAlgCustomLabel(caseObj, algObj) {
  if (!caseObj || !algObj) return "";
  const cleanId = String(caseObj.id || "").replace(/^ortega-pbl-/, "");
  const pblCustom = appStore.state.pblSettings?.[caseObj.id]?.customLabels?.[algObj.id]
    || appStore.state.pblSettings?.[cleanId]?.customLabels?.[algObj.id];
  if (pblCustom) return pblCustom;
  const key = `${caseObj.id}:${algObj.id}`;
  if (appStore.state.customCllLabels?.[key]) return appStore.state.customCllLabels[key];
  if (caseObj.algs?.[0]?.id === algObj.id && appStore.state.customCllLabels?.[caseObj.id]) {
    return appStore.state.customCllLabels[caseObj.id];
  }
  return "";
}

function openAlgCustomLabelEditor(caseObj, algObj) {
  if (!caseObj || !algObj || !customLabelModal) return;
  const isPbl = String(caseObj.id || "").startsWith("ortega-pbl-");
  const cleanId = String(caseObj.id || "").replace(/^ortega-pbl-/, "");
  const key = `${caseObj.id}:${algObj.id}`;
  const isFirst = caseObj.algs?.[0]?.id === algObj.id;

  customLabelModal.open({
    id: caseObj.id,
    defaultLabel: algObj.note || algObj.label || "",
    rawAlg: algObj.alg || "",
    currentLabel: getAlgCustomLabel(caseObj, algObj) || algObj.note || "",
    onSave: (val) => {
      if (isPbl) {
        const entry = appStore.state.pblSettings[caseObj.id] || (appStore.state.pblSettings[caseObj.id] = {});
        if (!entry.customLabels) entry.customLabels = {};
        if (val) entry.customLabels[algObj.id] = val;
        else delete entry.customLabels[algObj.id];
        appStore.savePblSettings();
      } else {
        if (val) {
          appStore.state.customCllLabels[key] = val;
          if (isFirst) appStore.state.customCllLabels[caseObj.id] = val;
        } else {
          delete appStore.state.customCllLabels[key];
          if (isFirst) delete appStore.state.customCllLabels[caseObj.id];
        }
        appStore.saveCustomCllLabels();
      }
      studyView?.render();
    },
    onReset: () => {
      if (isPbl) {
        if (appStore.state.pblSettings?.[caseObj.id]?.customLabels) {
          delete appStore.state.pblSettings[caseObj.id].customLabels[algObj.id];
        }
        if (appStore.state.pblSettings?.[cleanId]?.customLabels) {
          delete appStore.state.pblSettings[cleanId].customLabels[algObj.id];
        }
        appStore.savePblSettings();
      } else {
        delete appStore.state.customCllLabels[key];
        if (isFirst) delete appStore.state.customCllLabels[caseObj.id];
        appStore.saveCustomCllLabels();
      }
      studyView?.render();
    }
  });
}

const cubeStage = createCubeStageController({
  appStore,
  displayContainer: document.getElementById("display-container"),
  resetOrientationBtn: document.getElementById("resetOrientationBtn"),
  themeToggleBtn: document.getElementById("themeToggleBtn"),
  onScrambleApplied: (scr) => {
    freeMovesCtrl?.setBaseScramble(scr);
    if (appStore.state.mode === "simulate") simulatorCtrl?.updateSimulateSolutions?.();
  },
  getStudyView: () => studyView
});

freeMovesCtrl = createFreeMovesController({
  appStore,
  cubeStage,
  panelEl: document.getElementById("freeMovesPanel"),
  onSimulateFreeTurn: (count) => simulatorCtrl?.notifyFreeTurnStatus?.(count),
  onResetSimulate: (kind) => simulatorCtrl?.handleFreeReset?.(kind),
  onUpdateSimulateSolutions: () => simulatorCtrl?.updateSimulateSolutions?.()
});

const openQuickSim = (payload) => quickSimModal?.open?.({
  ...payload,
  onOpenFullSim: payload?.onOpenFullSim === undefined
    ? ((seqPayload) => simulatorCtrl?.loadSolverSequence?.(seqPayload))
    : payload.onOpenFullSim
});

solverWidgets = createSolverWidgetsView({
  appStore,
  freeMovesCtrl,
  getPracticeView: () => practiceView,
  onSimulateSequence: (payload) => simulatorCtrl?.loadSolverSequence?.(payload),
  onQuickSimSolutions: openQuickSim
});

casePickerCtrl = createCasePickerController({
  appStore,
  casePickerEl: document.getElementById("casePicker"),
  selectionCountEl: document.getElementById("selectionCount"),
  casesPanelTitleEl: document.getElementById("casesPanelTitle"),
  settingsPanelEl: document.getElementById("settingsPanel"),
  settingsToggleEl: document.getElementById("settingsToggle"),
  caseTagModeBtn: document.getElementById("caseTagModeBtn"),
  addAllBtn: document.getElementById("addAllBtn"),
  clearAllBtn: document.getElementById("clearAllBtn"),
  cubeCardEl: document.querySelector(".cube-card"),
  emptyStateEl: document.getElementById("empty-state"),
  resetOrientationBtn: document.getElementById("resetOrientationBtn"),
  getStudyView: () => studyView,
  onSelectionApplied: () => {
    const s = appStore.state;
    if (s.mode === "practice" && !isTimerViewMode(s)) practiceView?.setTrack(s.currentPuzzle, s.currentTrackId);
    else if (isTimerViewMode(s)) navCtrl?.regenerateScramble();
  },
  onTagChanged: () => statsCtrl?.updateStatsTable()
});

navCtrl = createNavController({
  appStore,
  cubeStage,
  freeMovesCtrl,
  casePickerCtrl,
  getStudyView: () => studyView,
  getPracticeView: () => practiceView,
  getSolvePanelView: () => solvePanelView,
  getTimerCtrl: () => timerCtrl,
  getSolverWidgets: () => solverWidgets,
  getStatsCtrl: () => statsCtrl,
  getSmartCubeCtrl: () => smartCubeCtrl,
  getSimulatorCtrl: () => simulatorCtrl,
  getSessionModal: () => sessionModal
});

solvePanelView = createSolvePanelView({
  appStore,
  cubeStage,
  solverWidgets,
  solveReplayViewer,
  getSmartCubeUi: () => smartCubeCtrl,
  getNavCtrl: () => navCtrl,
  getTimerCtrl: () => timerCtrl,
  getSessionModal: () => sessionModal,
  getSolveDetailModal: () => solveDetailModal
});

disconnectAlertView = createDisconnectAlertView({
  appStore,
  getSmartCubeCtrl: () => smartCubeCtrl,
  getGanTimerCtrl: () => ganTimerCtrl
});

timerCtrl = createTimerController({
  appStore,
  solveReplayViewer,
  getSolvePanel: () => solvePanelView,
  getStatsCtrl: () => statsCtrl,
  getNavCtrl: () => navCtrl,
  getSmartCubeUi: () => smartCubeCtrl,
  getDisconnectAlertView: () => disconnectAlertView
});

smartCubeCtrl = createSmartCubeController({
  appStore,
  modalManager,
  cubeStage,
  freeMovesCtrl,
  solveReplayViewer,
  getTimerCtrl: () => timerCtrl,
  getGanTimerCtrl: () => ganTimerCtrl,
  getDisconnectAlertView: () => disconnectAlertView,
  getNavCtrl: () => navCtrl
});

ganTimerCtrl = createGanTimerController({
  appStore,
  modalManager,
  getTimerCtrl: () => timerCtrl,
  getSmartCubeCtrl: () => smartCubeCtrl,
  getSolvePanel: () => solvePanelView,
  getDisconnectAlertView: () => disconnectAlertView
});

statsCtrl = createStatsPanelController({
  appStore,
  modalManager,
  solveReplayViewer,
  getSolveDetailModal: () => solveDetailModal,
  getSolvePanel: () => solvePanelView,
  getSessionModal: () => sessionModal
});

simulatorCtrl = createSimulatorController({
  appStore,
  cubeStage,
  freeMovesCtrl,
  solverWidgets,
  getNavCtrl: () => navCtrl
});

quickSimModal = createQuickSimModal({ modalManager, appStore });
customLabelModal = createCustomLabelModal({ modalManager });
sessionModal = createSessionModalController({
  appStore,
  modalManager,
  getNavCtrl: () => navCtrl,
  getSolvePanel: () => solvePanelView,
  getStatsCtrl: () => statsCtrl
});
solveDetailModal = createSolveDetailModal({
  appStore,
  modalManager,
  solveReplayViewer,
  getSolvePanel: () => solvePanelView,
  getNavCtrl: () => navCtrl,
  getSimulatorCtrl: () => simulatorCtrl,
  getStatsCtrl: () => statsCtrl,
  getSessionModal: () => sessionModal
});
shortcutsModal = createShortcutsModalController({
  appStore,
  modalManager
});
settingsModal = createSettingsModalController({
  appStore,
  modalManager,
  cubeStage,
  solverWidgets,
  getStudyView: () => studyView,
  getPracticeView: () => practiceView,
  getNavCtrl: () => navCtrl,
  getSmartCubeCtrl: () => smartCubeCtrl,
  getCloudSyncCtrl: () => cloudSyncCtrl,
  onOpenWizard: () => onboardingWizard?.open?.(),
  onOpenShortcuts: () => shortcutsModal?.open?.(),
  onTooltipsChange: (enabled) => {
    if (!enabled) tooltipCtrl?.hide?.();
  }
});

onboardingWizard = createOnboardingWizard({
  appStore,
  modalManager,
  navCtrl,
  casePickerCtrl,
  getStudyView: () => studyView,
  getPracticeView: () => practiceView,
  getSolvePanelView: () => solvePanelView,
  getStatsCtrl: () => statsCtrl
});

tooltipCtrl = createTooltipController({
  isEnabled: () => Boolean(appStore.state.showTooltips)
});

document.getElementById("onboardingBtn")?.addEventListener("click", () => {
  onboardingWizard.open();
});

studyView = new StudyView({
  container: document.getElementById("studyViewContainer"),
  getSelectedCaseIds: () => appStore.state.selectedCases,
  getAlwaysWhiteBottom: () => appStore.state.alwaysWhiteBottom,
  getShowReflection: () => appStore.state.showReflection,
  getOhHand: () => appStore.state.ohHand || "left",
  onSetOhHand: (hand) => appStore.setOhHand(hand),
  getOhTableAbuse: () => appStore.state.ohTableAbuse !== false,
  onSetOhTableAbuse: (enabled) => appStore.setOhTableAbuse(enabled),
  getOllMode: () => appStore.state.ollMode || appStore.state.llAnalyticsMode || "full",
  onSetOllMode: (mode) => appStore.setOllMode(mode),
  getPllMode: () => appStore.state.pllMode || appStore.state.llAnalyticsMode || "full",
  onSetPllMode: (mode) => appStore.setPllMode(mode),
  getSimSpeed: () => appStore.state.simSpeed ?? 1,
  onSetSimSpeed: (spd) => appStore.setSimSpeed(spd),
  getAlgCustomLabel,
  onEditLabel: openAlgCustomLabelEditor,
  onQuickSimSolutions: openQuickSim,
  onSimulateCase: (caseObj, algObj) => simulatorCtrl.loadStudyCase(caseObj, algObj),
  onPracticeCase: (caseObj) => {
    const next = new Set(appStore.state.selectedCases);
    next.add(caseObj.id);
    casePickerCtrl.applySelection(next);
    navCtrl.setMode("practice");
  }
});

practiceView = new PracticeView({
  container: document.getElementById("practiceViewContainer"),
  onGenerateScramble: (trackId) => navCtrl.generatePracticeScramble(trackId),
  onApplyScrambleToDisplay: (scramble) => {
    appStore.state.scrambleMoves = scramble || "";
    appStore.state.scramble = scramble || "";
    cubeStage.applyScrambleToDisplay(scramble || "");
  },
  onRecordRecognition: (caseId, isCorrect) => {
    const s = appStore.state;
    appStore.recordCaseStat(s.currentPuzzle, s.currentTrackId, caseId, isCorrect);
    statsCtrl.updateStatsTable();
  },
  onFlashCube: flashCube,
  onTwoSidedModeChange: (enabled) => cubeStage.setTwoSidedCameraLock(enabled),
  onQuickSimSolutions: openQuickSim,
  getCrossTargetFaces: () => appStore.state.crossTargetFaces,
  getLayerTargetFaces: () => appStore.state.layerTargetFaces,
  getOhHand: () => appStore.state.ohHand || "left",
  onSetOhHand: (hand) => appStore.setOhHand(hand),
  getOhTableAbuse: () => appStore.state.ohTableAbuse !== false,
  onSetOhTableAbuse: (enabled) => appStore.setOhTableAbuse(enabled)
});

appStore.subscribe((evt) => {
  if (evt === "ohHand" || evt === "ohTableAbuse") {
    simulatorCtrl?.populateSimCaseSelect?.();
    if (appStore.state.mode === "study") studyView?.render?.();
    else if (appStore.state.mode === "practice" && !isTimerViewMode(appStore.state)) practiceView?.render?.();
  } else if (evt === "simSpeed") {
    const spd = appStore.state.simSpeed ?? 1;
    simulatorCtrl?.syncPlaybackSpeed?.(spd);
    quickSimModal?.syncPlaybackSpeed?.(spd);
    solveReplayViewer?.syncPlaybackSpeed?.(spd);
    studyView?.syncPlaybackSpeed?.(spd);
  } else if (evt === "advancedMode") {
    settingsModal?.renderToggles?.();
    solvePanelView?.renderSolvePanel?.();
    navCtrl?.renderStage?.();
    statsCtrl?.updateStatsTable?.();
  } else if (evt === "llAnalyticsMode") {
    settingsModal?.renderToggles?.();
    statsCtrl?.updateStatsTable?.();
    if (appStore.state.mode === "study") studyView?.render?.();
  } else if (evt === "twoByTwoMethod") {
    settingsModal?.renderToggles?.();
    solvePanelView?.renderSolvePanel?.();
    statsCtrl?.updateStatsTable?.();
  } else if (evt === "desktopMultiPane") {
    settingsModal?.renderToggles?.();
    navCtrl?.renderStage?.();
  } else if (evt === "trainSubMode") {
    navCtrl?.renderTrackBar?.();
    navCtrl?.renderStage?.();
  } else if (evt === "focusMode") {
    settingsModal?.renderToggles?.();
    solvePanelView?.renderSolvePanel?.();
    navCtrl?.renderStage?.();
  } else if (evt === "widgetVisibility" || evt === "solveOptions") {
    settingsModal?.renderToggles?.();
    navCtrl?.renderStage?.();
    solvePanelView?.renderSolvePanel?.();
  } else if (evt === "customEvents") {
    navCtrl?.renderPuzzleButtons?.();
    navCtrl?.renderStage?.();
    settingsModal?.renderCustomEvents?.();
  } else if (evt === "visibleEvents") {
    const s = appStore.state;
    const isBuiltIn = ALL_BUILTIN_EVENT_IDS.includes(s.currentPuzzle);
    if (isBuiltIn && Array.isArray(s.visibleEvents) && s.visibleEvents.length && !s.visibleEvents.includes(s.currentPuzzle)) {
      navCtrl?.setPuzzle?.(s.visibleEvents[0]);
    } else {
      navCtrl?.renderPuzzleButtons?.();
    }
    settingsModal?.renderToggles?.();
  }
});

solveReplayViewer.init({}, (scr) => solvePanelView.reattemptScramble(scr), modalManager, {
  getSimSpeed: () => appStore.state.simSpeed ?? 1,
  onSetSimSpeed: (spd) => appStore.setSimSpeed(spd),
  getShowReflection: () => Boolean(appStore.state.showReflection)
});

function handleCustomShortcutKeyDown(e) {
  const combo = eventToKeyCombo(e);
  if (!combo) return false;

  const s = appStore.state;
  const overrides = s.keyboardShortcuts || {};
  const scStatus = smartCube.getStatus();
  const isVirtualActive = Boolean(scStatus.connected && smartCube.isVirtual);
  const timerActive = isTimerViewMode(s);
  const solveRunning = timerActive && timerCtrl?.getSolveState?.() === "running";

  if (isVirtualActive) {
    // When Virtual Smart Cube is active, user-customized shortcuts take priority over KeyboardPuzzle defaults,
    // while uncustomized keys pass cleanly through to KeyboardPuzzle's layout (I/K/J/F/...).
    const customAction = findActionForCombo(overrides, combo);
    if (customAction && customAction.startsWith("move:")) {
      const move = customAction.slice(5);
      e.preventDefault();
      e.stopPropagation();
      smartCube.handleMove(move, performance.now());
      return true;
    }
    if (solveRunning) return false;
  } else if (solveRunning) {
    return false;
  }

  const effectiveMap = isVirtualActive ? overrides : appStore.getKeyboardShortcuts();
  const actionId = findActionForCombo(effectiveMap, combo);
  if (!actionId) return false;

  if (actionId.startsWith("move:")) {
    // Preserve Learn / Recognition Training behavior for uncustomized Free Turn defaults
    if ((s.mode === "study" || (s.mode === "practice" && !timerActive)) && !(actionId in overrides)) {
      return false;
    }
    const move = actionId.slice(5);
    e.preventDefault();
    void freeMovesCtrl.applyFreeMove(move);
    return true;
  }

  if (actionId.startsWith("puzzle:")) {
    e.preventDefault();
    navCtrl.setPuzzle(actionId.slice(7));
    return true;
  }

  if (actionId.startsWith("mode:")) {
    e.preventDefault();
    navCtrl.setMode(actionId.slice(5));
    return true;
  }

  if (actionId.startsWith("target:")) {
    const tgt = actionId.slice(7);
    e.preventDefault();
    const pData = PUZZLES[s.currentPuzzle];
    if (tgt === "full" || tgt === "timer-drill" || timerActive) {
      if (!navCtrl.setSolveTarget(tgt)) {
        showToast(`"${tgt}" target is not available for ${pData?.shortName || s.currentPuzzle}.`, "warning", 2200);
      }
    } else if (pData?.tracks?.some(t => t.id === tgt)) {
      navCtrl.setTrack(tgt);
    } else {
      showToast(`"${tgt}" is not a track on ${pData?.shortName || s.currentPuzzle}.`, "warning", 2200);
    }
    return true;
  }

  switch (actionId) {
    case "action:newScramble":
      e.preventDefault();
      if (s.mode === "practice" && !timerActive && practiceView) {
        if (practiceView.sprintRunning) void practiceView.advanceSprintScramble();
        else if (practiceView.isInspectionTrack?.()) void practiceView.advanceInspectionScramble();
        else void practiceView.advanceCasualScramble();
      } else {
        navCtrl.regenerateScramble();
      }
      return true;
    case "action:toggleCube":
      if (!timerActive) return false;
      e.preventDefault();
      appStore.setSolveShowCube(!s.solveShowCube);
      return true;
    case "action:toggleInspection":
      if (!timerActive) return false;
      e.preventDefault();
      appStore.setSolveInspection(!s.solveInspection);
      return true;
    case "action:toggleAlwaysWhiteBottom":
      e.preventDefault();
      s.alwaysWhiteBottom = !s.alwaysWhiteBottom;
      appStore.saveSettings();
      settingsModal.renderToggles();
      navCtrl.regenerateScramble();
      settingsModal.refreshActiveViews();
      return true;
    case "action:toggleAllowAUF":
      e.preventDefault();
      s.allowAUF = !s.allowAUF;
      appStore.saveSettings();
      settingsModal.renderToggles();
      navCtrl.regenerateScramble();
      return true;
    case "action:toggleShowReflection":
      e.preventDefault();
      s.showReflection = !s.showReflection;
      cubeStage.applyReflection();
      appStore.saveSettings();
      settingsModal.renderToggles();
      return true;
    case "action:toggleOhHand":
      e.preventDefault();
      appStore.setOhHand((s.ohHand || "left") === "left" ? "right" : "left");
      settingsModal.renderToggles();
      settingsModal.refreshActiveViews();
      return true;
    case "action:toggleDark":
      e.preventDefault();
      cubeStage.setDarkMode(!s.darkMode);
      return true;
    case "action:toggleAdvancedMode": {
      e.preventDefault();
      const curMode = s.statsDisplayMode || (s.showStatsPanel === false ? "none" : (s.advancedMode ? "advanced" : "basic"));
      const nextMode = curMode === "none" ? "basic" : curMode === "basic" ? "advanced" : "none";
      appStore.setStatsDisplayMode(nextMode);
      const label = nextMode === "none" ? "None" : nextMode === "basic" ? "Basic" : "Advanced";
      showToast(`Stats mode: ${label}`, "info", 1800);
      return true;
    }
    case "action:toggleFocusMode": {
      e.preventDefault();
      if (!s.focusMode && !timerActive) {
        navCtrl?.setMode?.("solve");
      }
      appStore.setFocusMode(!s.focusMode);
      const zenCombo = appStore.getKeyboardShortcuts()?.["action:toggleFocusMode"] || "";
      const zenKeyText = formatKeyCombo(zenCombo);
      showToast(
        appStore.state.focusMode
          ? (zenKeyText ? `Zen mode: On (${zenKeyText} to exit)` : "Zen mode: On")
          : "Zen mode: Off",
        "info",
        1800
      );
      return true;
    }
    case "action:openSettings":
      e.preventDefault();
      settingsModal.open();
      return true;
    case "action:openShortcuts":
      e.preventDefault();
      shortcutsModal.open();
      return true;
    case "action:resetAngle":
      e.preventDefault();
      cubeStage.resetCubeOrientation();
      return true;
    case "action:penaltyPlus2":
      if (!timerActive) return false;
      e.preventDefault();
      timerCtrl.toggleLastSolvePenalty("+2");
      return true;
    case "action:penaltyDnf":
      if (!timerActive) return false;
      e.preventDefault();
      timerCtrl.toggleLastSolvePenalty("DNF");
      return true;
    case "action:undoFreeMove":
      if ((s.mode === "study" || (s.mode === "practice" && !timerActive)) && !(actionId in overrides)) return false;
      if (freeMovesCtrl.getUserMoves().length === 0) return false;
      e.preventDefault();
      freeMovesCtrl.undoLastFreeMove();
      return true;
    case "action:resetFreeMoves":
      e.preventDefault();
      freeMovesCtrl.resetFreeMovesToScramble();
      return true;
    case "action:resetFreeSolved":
      e.preventDefault();
      freeMovesCtrl.resetFreeMovesToSolved();
      return true;
    default:
      return false;
  }
}

createKeyboardRouter({
  modalManager,
  getMode: () => appStore.state.mode,
  isTimerActive: () => isTimerViewMode(appStore.state),
  isReplayOpen: () => solveReplayViewer.isOpen(),
  onReplayKey: (e) => solveReplayViewer.handleKeyDown(e),
  isQuickSimOpen: () => quickSimModal.isOpen(),
  onQuickSimKey: (e) => quickSimModal.handleKeyDown(e),
  onSolveKeyDown: (e) => timerCtrl.onSolveKeyDown(e),
  onSolveKeyUp: (e) => timerCtrl.onSolveKeyUp(e),
  onSimulateKeyDown: (e) => simulatorCtrl.onSimulateKeyDown(e),
  onPracticeKeyDown: (e) => practiceView.onKeyDown(e),
  onCustomShortcutKeyDown: handleCustomShortcutKeyDown,
  onFreeMoveKeyDown: () => false
}).mount();

// Bootstrap UI state
cubeStage.applyTheme();
cubeStage.mountScrambleDisplay(appStore.state.currentPuzzle);
navCtrl.renderPuzzleButtons();
settingsModal.renderToggles();
simulatorCtrl.syncPlaybackSpeed(appStore.state.simSpeed ?? 1);
casePickerCtrl.syncSettingsPanel();
statsCtrl.syncStatsPanel();
sessionModal.populateSessionSelect();
casePickerCtrl.buildCasePicker();
freeMovesCtrl.updateUI();
navCtrl.updateSolveOrientationLabel();
navCtrl.renderTrackBar();
navCtrl.renderStage();
smartCubeCtrl.updateBluetoothUI();
ganTimerCtrl.updateGanTimerUI();
solvePanelView.renderSolvePanel();
statsCtrl.updateStatsTable();

if (appStore.state.mode === "study") {
  studyView.setTrack(appStore.state.currentPuzzle, appStore.state.currentTrackId);
} else if (isTimerViewMode(appStore.state)) {
  if (appStore.state.currentPuzzle === "222" && appStore.state.solveTarget === "face") {
    solverWidgets.setLayerSolutionMode("face");
  }
  navCtrl.regenerateScramble();
} else if (appStore.state.mode === "practice") {
  practiceView.setTrack(appStore.state.currentPuzzle, appStore.state.currentTrackId);
} else if (appStore.state.mode === "simulate") {
  simulatorCtrl.simInit();
}

function refreshAllViewsAfterHydrate() {
  const s = appStore.state;
  const prev = appStore.lastHydratePrev || {};
  const puzzleChanged = Boolean(prev.puzzle && prev.puzzle !== s.currentPuzzle);
  const trackChanged = Boolean(prev.trackId && prev.trackId !== s.currentTrackId);
  const modeChanged = Boolean(prev.mode && prev.mode !== s.mode);
  const targetChanged = Boolean(prev.solveTarget && prev.solveTarget !== s.solveTarget);

  clearSvgCache();
  cubeStage.applyTheme();
  if (puzzleChanged || !cubeStage.getDisplay()) {
    cubeStage.mountScrambleDisplay(s.currentPuzzle);
  } else {
    cubeStage.applyReflection();
  }
  applyColorsTo3DCube(cubeStage.getDisplay());
  if (studyView?.activeDisplay3d) applyColorsTo3DCube(studyView.activeDisplay3d);

  navCtrl?.renderPuzzleButtons?.();

  if (s.mode !== "study") studyView?.deactivate?.();
  if (s.mode !== "practice" || isTimerViewMode(s)) {
    practiceView?.deactivate?.();
    cubeStage.setTwoSidedCameraLock(false);
  }
  if (s.mode !== "simulate") simulatorCtrl?.simTeardown?.();

  settingsModal?.renderToggles?.();
  solverWidgets?.updateFaceChipsUI?.();
  solverWidgets?.updateCrossFacesUI?.();
  simulatorCtrl?.syncPlaybackSpeed?.(s.simSpeed ?? 1);
  simulatorCtrl?.populateSimCaseSelect?.();
  casePickerCtrl?.syncSettingsPanel?.();
  statsCtrl?.syncStatsPanel?.();
  sessionModal?.populateSessionSelect?.();
  casePickerCtrl?.buildCasePicker?.();
  casePickerCtrl?.renderSelection?.();
  freeMovesCtrl?.updateUI?.();
  navCtrl?.updateSolveOrientationLabel?.();
  navCtrl?.renderTrackBar?.();
  navCtrl?.renderStage?.();
  smartCubeCtrl?.updateBluetoothUI?.();
  smartCube.dispatchEvent(new CustomEvent("savedcubeschange"));
  ganTimerCtrl?.updateGanTimerUI?.();
  solvePanelView?.renderSolvePanel?.();
  statsCtrl?.updateStatsTable?.();
  if (!s.showTooltips) tooltipCtrl?.hide?.();
  if (s.onboardingCompleted) onboardingWizard?.close?.({ markComplete: false });

  if (s.mode === "study") {
    if (modeChanged || puzzleChanged || trackChanged) {
      studyView?.setTrack?.(s.currentPuzzle, s.currentTrackId);
    } else {
      studyView?.render?.();
    }
  } else if (isTimerViewMode(s)) {
    if (s.currentPuzzle === "222" && s.solveTarget === "face") {
      solverWidgets?.setLayerSolutionMode?.("face");
    }
    if ((!s.currentSolveScramble || modeChanged || puzzleChanged || targetChanged) && timerCtrl?.getSolveState?.() === "idle") {
      navCtrl?.regenerateScramble?.();
    }
  } else if (s.mode === "practice") {
    if (modeChanged || puzzleChanged || trackChanged) {
      practiceView?.setTrack?.(s.currentPuzzle, s.currentTrackId);
    } else {
      practiceView?.render?.();
    }
  } else if (s.mode === "simulate") {
    if (modeChanged || puzzleChanged || trackChanged) {
      simulatorCtrl?.simInit?.();
    }
  }
}

initSyncTracking(appStore, { onPreferredAlgChange });

const googleDriveSync = new GoogleDriveSyncService({
  appStore,
  onDataHydrated: (summary, _merged, reason) => {
    refreshAllViewsAfterHydrate();
    if (reason === "startup" || reason === "visibility" || reason === "focus" || reason === "online") {
      const msg = formatMergeSummary(summary);
      if (msg && msg !== "Up to date") {
        showToast(`Synced from Google Drive · ${msg}`, "info", 3200);
      }
    }
  }
});

cloudSyncCtrl = createCloudSyncController({
  googleDriveSync,
  appStore,
  modalManager,
  onCloseSettingsModal: () => settingsModal?.close?.(),
  onBackupImported: () => {
    refreshAllViewsAfterHydrate();
    googleDriveSync.scheduleAutoSync();
  }
});

appStore.subscribe((evt) => {
  if (evt === "persist") {
    googleDriveSync.scheduleAutoSync();
  }
});

onPreferredAlgChange(() => {
  googleDriveSync.scheduleAutoSync();
});

smartCube.addEventListener("savedcubeschange", (e) => {
  if (e?.detail?.cubes !== undefined) {
    googleDriveSync.scheduleAutoSync();
  }
});

if (onboardingWizard.shouldAutoOpen()) {
  onboardingWizard.open();
}

const pwaInstallCtrl = createPwaInstallController({
  onToast: (msg, type, ms) => showToast(msg, type, ms)
});
pwaInstallCtrl.init();

if (googleDriveSync.isSignedIn() && googleDriveSync.getEffectiveClientId() && googleDriveSync.meta.autoSync !== false) {
  void googleDriveSync.syncNow({ reason: "startup", interactive: false });
}
