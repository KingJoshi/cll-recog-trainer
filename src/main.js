// Composition Root — wires centralized state, controllers, views, and keyboard routing
import './styles/index.css';

import { PUZZLES, getTrack } from './data/algRegistry.js';
import { StudyView } from './studyView.js';
import { PracticeView } from './practiceView.js';
import { solveReplayViewer } from './replayView.js';
import { appStore } from './state/appStore.js';
import { modalManager } from './ui/modalManager.js';
import { createKeyboardRouter } from './ui/keyboardRouter.js';
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
    if (s.mode === "practice") practiceView?.setTrack(s.currentPuzzle, s.currentTrackId);
    else if (s.mode === "solve") navCtrl?.regenerateScramble();
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
  getSessionModal: () => sessionModal
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
  getDisconnectAlertView: () => disconnectAlertView
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
  getSimulatorCtrl: () => simulatorCtrl
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
  onOpenWizard: () => onboardingWizard?.open?.(),
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
  onSetOhHand: (hand) => appStore.setOhHand(hand)
});

appStore.subscribe((evt) => {
  if (evt === "ohHand") {
    simulatorCtrl?.populateSimCaseSelect?.();
    if (appStore.state.mode === "study") studyView?.render?.();
    else if (appStore.state.mode === "practice") practiceView?.render?.();
  } else if (evt === "simSpeed") {
    const spd = appStore.state.simSpeed ?? 1;
    simulatorCtrl?.syncPlaybackSpeed?.(spd);
    quickSimModal?.syncPlaybackSpeed?.(spd);
    solveReplayViewer?.syncPlaybackSpeed?.(spd);
    studyView?.syncPlaybackSpeed?.(spd);
  }
});

solveReplayViewer.init({}, (scr) => solvePanelView.reattemptScramble(scr), modalManager, {
  getSimSpeed: () => appStore.state.simSpeed ?? 1,
  onSetSimSpeed: (spd) => appStore.setSimSpeed(spd),
  getShowReflection: () => Boolean(appStore.state.showReflection)
});

createKeyboardRouter({
  modalManager,
  getMode: () => appStore.state.mode,
  isReplayOpen: () => solveReplayViewer.isOpen(),
  onReplayKey: (e) => solveReplayViewer.handleKeyDown(e),
  isQuickSimOpen: () => quickSimModal.isOpen(),
  onQuickSimKey: (e) => quickSimModal.handleKeyDown(e),
  onSolveKeyDown: (e) => timerCtrl.onSolveKeyDown(e),
  onSolveKeyUp: (e) => timerCtrl.onSolveKeyUp(e),
  onSimulateKeyDown: (e) => simulatorCtrl.onSimulateKeyDown(e),
  onPracticeKeyDown: (e) => practiceView.onKeyDown(e),
  onFreeMoveKeyDown: (e) => freeMovesCtrl.handleKeyDown(e)
}).mount();

// Bootstrap UI state
cubeStage.applyTheme();
cubeStage.mountScrambleDisplay(appStore.state.currentPuzzle);
document.querySelectorAll(".puzzle-btn").forEach(btn => {
  const active = btn.dataset.puzzle === appStore.state.currentPuzzle;
  btn.classList.toggle("active", active);
  btn.setAttribute("aria-pressed", String(active));
});
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
} else if (appStore.state.mode === "practice") {
  practiceView.setTrack(appStore.state.currentPuzzle, appStore.state.currentTrackId);
} else if (appStore.state.mode === "simulate") {
  simulatorCtrl.simInit();
} else {
  if (appStore.state.currentPuzzle === "222" && appStore.state.solveTarget === "face") {
    solverWidgets.setLayerSolutionMode("face");
  }
  navCtrl.regenerateScramble();
}

if (onboardingWizard.shouldAutoOpen()) {
  onboardingWizard.open();
}
