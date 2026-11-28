// Stats Panel Controller: tab switching, collapsible drawer, single CSV export, and reset confirmation

import { PUZZLES, getTrack, getSolveTargetInfo } from '../../data/algRegistry.js';
import { ensureSolveCfop } from '../../cfopAnalyzer.js';
import { ensureSolveTwoByTwo } from '../../twoByTwoAnalyzer.js';
import { isTimerViewMode } from '../../state/appStore.js';
import { exportSolvesToCSV, downloadCSV } from '../../services/solveStats.js';
import { getSolveFingerprint } from '../../services/syncMerge.js';
import { recordTombstones } from '../../services/syncStorage.js';
import { showToast } from '../../ui/toastService.js';
import { createRecogStatsView } from './recogStatsView.js';
import { createCaseSolveStatsView } from './caseSolveStatsView.js';
import { createSessionLogView } from './sessionLogView.js';
import { createCaseSolvesModal } from '../modals/caseSolvesModal.js';

export function createStatsPanelController({
  appStore,
  modalManager,
  solveReplayViewer,
  getSolveDetailModal = () => null,
  getSolvePanel = () => null,
  getSessionModal = () => null,
  onStartAlgDrill = null
} = {}) {
  const statsPanel = typeof document !== "undefined" ? document.getElementById("statsPanel") : null;
  const statsToggle = typeof document !== "undefined" ? document.getElementById("statsToggle") : null;
  const statsTableContainer = typeof document !== "undefined" ? document.getElementById("stats-table-container") : null;
  const statsExportCsvBtn = typeof document !== "undefined" ? document.getElementById("statsExportCsvBtn") : null;
  const resetStatsBtn = typeof document !== "undefined" ? document.getElementById("resetStatsBtn") : null;

  const caseSolvesModal = createCaseSolvesModal({
    appStore,
    modalManager,
    getSolveDetailModal,
    onStartAlgDrill
  });
  const onOpenCaseSolves = (opts) => caseSolvesModal.open(opts);

  const recogView = createRecogStatsView({ appStore, onStartAlgDrill });
  const caseSolveView = createCaseSolveStatsView({ appStore, onStartAlgDrill, onOpenCaseSolves });
  const sessionLogView = createSessionLogView({
    appStore,
    modalManager,
    solveReplayViewer,
    getSolveDetailModal,
    getSolvePanel,
    getSessionModal,
    onStartAlgDrill,
    onOpenCaseSolves
  });

  function renderStatsToggle() {
    const s = appStore.state;
    const track = getTrack(s.currentPuzzle, s.currentTrackId);
    const pName = PUZZLES[s.currentPuzzle]?.shortName || s.currentPuzzle;
    const targetInfo = isTimerViewMode(s) ? getSolveTargetInfo(s.currentPuzzle, s.solveTarget) : null;
    const scopeLabel = targetInfo ? targetInfo.shortName : (track?.shortName || s.currentTrackId);
    const caseTrackName = track?.cases?.length ? track.shortName : null;

    const badge = typeof document !== "undefined" ? document.getElementById("statsScopeBadge") : null;
    if (badge) badge.textContent = `${pName} • ${scopeLabel}`;
    const statsTabCll = typeof document !== "undefined" ? document.getElementById("statsTabCll") : null;
    if (statsTabCll) statsTabCll.textContent = caseTrackName ? `🧩 ${caseTrackName} Times` : "🧩 Case Times";

    if (typeof document !== "undefined") {
      document.querySelectorAll(".stats-tab-btn").forEach(btn => {
        const isCurrent = btn.dataset.stats === s.statsType;
        btn.setAttribute("aria-pressed", String(isCurrent));
        btn.classList.toggle("active", isCurrent);
      });
    }
  }

  function updateStatsTable() {
    renderStatsToggle();
    const t = appStore.state.statsType;
    if (t === "solve" || t === "log") {
      sessionLogView.render(statsTableContainer);
    } else if (t === "cll") {
      caseSolveView.render(statsTableContainer);
    } else {
      recogView.render(statsTableContainer);
    }
  }

  function setStatsType(next) {
    if (!next || appStore.state.statsType === next) return;
    appStore.state.statsType = next;
    appStore.saveSettings();
    renderStatsToggle();
    updateStatsTable();
  }

  function syncStatsPanel() {
    if (!statsPanel || !statsToggle) return;
    const collapsed = Boolean(appStore.state.statsCollapsed);
    statsPanel.classList.toggle("collapsed", collapsed);
    statsToggle.setAttribute("aria-expanded", String(!collapsed));
  }

  function handleExportCSV() {
    const sess = appStore.getActiveSession();
    const solves = sess?.solves || [];
    if (solves.length === 0) {
      showToast("No recorded solves in this session yet to export.", "warning");
      return;
    }
    const twoByTwoOpts = {
      twoByTwoMethod: appStore.state.twoByTwoMethod || "cll",
      layerTargetFaces: appStore.state.layerTargetFaces
    };
    for (const sv of solves) {
      const puz = sv?.puzzle || sess?.puzzle || appStore.state.currentPuzzle;
      if (puz === "222") ensureSolveTwoByTwo(sv, twoByTwoOpts);
      else if (puz === "333" || puz === "333oh") ensureSolveCfop(sv);
    }
    const csvData = exportSolvesToCSV(solves, sess?.name || "Session");
    const filename = `${(sess?.name || "solves").toLowerCase().replace(/[^a-z0-9]/g, "-")}-${Date.now()}.csv`;
    downloadCSV(csvData, filename);
    showToast(`Exported ${solves.length} solve${solves.length === 1 ? "" : "s"} to CSV.`, "success", 2400);
  }

  if (typeof document !== "undefined") {
    document.querySelectorAll(".stats-tab-btn").forEach(btn => {
      btn.addEventListener("click", () => setStatsType(btn.dataset.stats));
    });

    // Outside click dismisses open clock date popovers
    document.addEventListener("pointerdown", (e) => {
      if (!e.target.closest(".solve-date-clock-wrap")) {
        document.querySelectorAll(".solve-date-clock-wrap.is-open").forEach(w => w.classList.remove("is-open"));
      }
    });
  }

  statsToggle?.addEventListener("click", () => {
    appStore.state.statsCollapsed = !appStore.state.statsCollapsed;
    appStore.saveSettings();
    syncStatsPanel();
  });

  statsExportCsvBtn?.addEventListener("click", handleExportCSV);

  resetStatsBtn?.addEventListener("click", async () => {
    const s = appStore.state;
    const sess = appStore.getActiveSession();
    const track = getTrack(s.currentPuzzle, s.currentTrackId);
    const pName = PUZZLES[s.currentPuzzle]?.shortName || s.currentPuzzle;
    const tName = track?.shortName || s.currentTrackId;

    const modalEl = typeof document !== "undefined" ? document.getElementById("resetStatsModal") : null;
    if (!modalEl || !modalManager?.open) {
      if (s.statsType === "recog") appStore.resetRecognitionStats(s.currentPuzzle, s.currentTrackId);
      updateStatsTable();
      return;
    }

    const cbRecogTrack = modalEl.querySelector("#resetScopeRecogTrack");
    const cbRecogAll = modalEl.querySelector("#resetScopeRecogAll");
    const cbCaseTimes = modalEl.querySelector("#resetScopeCaseTimes");
    const cbSession = modalEl.querySelector("#resetScopeSession");

    const titleRecogTrack = modalEl.querySelector("#resetScopeRecogTrackTitle");
    const descRecogTrack = modalEl.querySelector("#resetScopeRecogTrackDesc");
    const titleRecogAll = modalEl.querySelector("#resetScopeRecogAllTitle");
    const titleCaseTimes = modalEl.querySelector("#resetScopeCaseTimesTitle");
    const descCaseTimes = modalEl.querySelector("#resetScopeCaseTimesDesc");
    const titleSession = modalEl.querySelector("#resetScopeSessionTitle");

    const trackStatBucket = s.stats?.[s.currentPuzzle]?.[s.currentTrackId] || {};
    const trackStatCount = Object.keys(trackStatBucket).filter(id => (trackStatBucket[id]?.shown || 0) > 0).length;
    const allSolves = sess.solves || [];
    const trackCaseIds = track?.cases ? track.cases.map(c => c.id) : [];
    const matchingTrackSolves = allSolves.filter(sv => (sv.track && sv.track === s.currentTrackId) || (sv.id && trackCaseIds.includes(sv.id)));

    if (titleRecogTrack) titleRecogTrack.textContent = `Recognition Stats (${pName} ${tName})`;
    if (descRecogTrack) descRecogTrack.textContent = trackStatCount > 0 ? `Clears recognition accuracy for ${trackStatCount} practiced case${trackStatCount === 1 ? "" : "s"} in ${pName} ${tName}.` : `No recognition stats recorded yet for ${pName} ${tName}.`;
    if (titleRecogAll) titleRecogAll.textContent = `Recognition Stats (All Puzzles & Tracks)`;
    if (titleCaseTimes) titleCaseTimes.textContent = `Case Solve Times (${tName} in "${sess.name}")`;
    if (descCaseTimes) descCaseTimes.textContent = `Removes ${matchingTrackSolves.length} targeted ${tName} solve${matchingTrackSolves.length === 1 ? "" : "s"} from "${sess.name}".`;
    if (titleSession) titleSession.textContent = `All Solves in "${sess.name}" (${allSolves.length} solve${allSolves.length === 1 ? "" : "s"})`;

    if (cbRecogTrack) cbRecogTrack.checked = s.statsType === "recog";
    if (cbRecogAll) cbRecogAll.checked = false;
    if (cbCaseTimes) cbCaseTimes.checked = s.statsType === "cll";
    if (cbSession) cbSession.checked = s.statsType === "log" || s.statsType === "solve";

    const closeBtn = modalEl.querySelector("#resetStatsCloseBtn");
    const cancelBtn = modalEl.querySelector("#resetStatsCancelBtn");
    const confirmBtn = modalEl.querySelector("#resetStatsConfirmBtn");

    const onCloseClick = () => modalManager.close(modalEl);
    const onConfirmClick = () => {
      const doRecogAll = Boolean(cbRecogAll?.checked);
      const doRecogTrack = Boolean(cbRecogTrack?.checked) && !doRecogAll;
      const doSession = Boolean(cbSession?.checked);
      const doCaseTimes = Boolean(cbCaseTimes?.checked) && !doSession;

      if (!doRecogAll && !doRecogTrack && !doSession && !doCaseTimes) {
        showToast("Select at least one item to reset.", "warning", 2000);
        return;
      }

      const doneLabels = [];
      if (doRecogAll) {
        appStore.resetAllRecognitionStats();
        doneLabels.push("All Recognition Stats");
      } else if (doRecogTrack) {
        appStore.resetRecognitionStats(s.currentPuzzle, s.currentTrackId);
        doneLabels.push(`${pName} ${tName} Recognition`);
      }

      if (doSession) {
        const deletedFps = (sess.solves || []).map(getSolveFingerprint).filter(Boolean);
        if (deletedFps.length > 0) recordTombstones("solves", deletedFps);
        s.lastSolve = null;
        appStore.setSolves([]);
        doneLabels.push(`All Solves in "${sess.name}"`);
      } else if (doCaseTimes) {
        const removed = [];
        const filtered = (sess.solves || []).filter(sv => {
          const shouldRemove = (sv.track && sv.track === s.currentTrackId) || (sv.id && trackCaseIds.includes(sv.id));
          if (shouldRemove) removed.push(sv);
          return !shouldRemove;
        });
        const deletedFps = removed.map(getSolveFingerprint).filter(Boolean);
        if (deletedFps.length > 0) recordTombstones("solves", deletedFps);
        s.lastSolve = filtered.length ? filtered[filtered.length - 1] : null;
        appStore.setSolves(filtered);
        doneLabels.push(`${tName} Times in "${sess.name}"`);
      }

      modalManager.close(modalEl);
      getSessionModal()?.populateSessionSelect?.();
      getSolvePanel()?.renderSolvePanel?.();
      updateStatsTable();
      showToast(`Reset: ${doneLabels.join(", ")}.`, "success", 2600);
    };

    const cleanup = () => {
      closeBtn?.removeEventListener("click", onCloseClick);
      cancelBtn?.removeEventListener("click", onCloseClick);
      confirmBtn?.removeEventListener("click", onConfirmClick);
    };

    closeBtn?.addEventListener("click", onCloseClick);
    cancelBtn?.addEventListener("click", onCloseClick);
    confirmBtn?.addEventListener("click", onConfirmClick);

    modalManager.open(modalEl, {
      initialFocus: confirmBtn,
      onClose: cleanup
    });
  });

  return {
    renderStatsToggle,
    setStatsType,
    syncStatsPanel,
    updateStatsTable,
    handleExportCSV
  };
}
