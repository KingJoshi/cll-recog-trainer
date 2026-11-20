// Stats Panel Controller: tab switching, collapsible drawer, single CSV export, and reset confirmation

import { PUZZLES, getTrack, getSolveTargetInfo } from '../../data/algRegistry.js';
import { exportSolvesToCSV, downloadCSV } from '../../services/solveStats.js';
import { showToast } from '../../ui/toastService.js';
import { createRecogStatsView } from './recogStatsView.js';
import { createCaseSolveStatsView } from './caseSolveStatsView.js';
import { createSessionLogView } from './sessionLogView.js';

export function createStatsPanelController({
  appStore,
  modalManager,
  solveReplayViewer,
  getSolveDetailModal = () => null,
  getSolvePanel = () => null,
  getSessionModal = () => null
} = {}) {
  const statsPanel = typeof document !== "undefined" ? document.getElementById("statsPanel") : null;
  const statsToggle = typeof document !== "undefined" ? document.getElementById("statsToggle") : null;
  const statsTableContainer = typeof document !== "undefined" ? document.getElementById("stats-table-container") : null;
  const statsExportCsvBtn = typeof document !== "undefined" ? document.getElementById("statsExportCsvBtn") : null;
  const resetStatsBtn = typeof document !== "undefined" ? document.getElementById("resetStatsBtn") : null;

  const recogView = createRecogStatsView({ appStore });
  const caseSolveView = createCaseSolveStatsView({ appStore });
  const sessionLogView = createSessionLogView({
    appStore,
    modalManager,
    solveReplayViewer,
    getSolveDetailModal,
    getSolvePanel,
    getSessionModal
  });

  function renderStatsToggle() {
    const s = appStore.state;
    const track = getTrack(s.currentPuzzle, s.currentTrackId);
    const pName = PUZZLES[s.currentPuzzle]?.shortName || s.currentPuzzle;
    const targetInfo = s.mode === "solve" ? getSolveTargetInfo(s.currentPuzzle, s.solveTarget) : null;
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

    if (s.statsType === "log" || s.statsType === "solve") {
      const ok = await modalManager.confirmDialog({
        title: "Clear Session Solves",
        message: `Clear all ${sess.solves?.length || 0} recorded solves in session "${sess.name}"?`,
        confirmLabel: "Clear Solves",
        danger: true
      });
      if (!ok) return;
      s.lastSolve = null;
      appStore.setSolves([]);
      getSessionModal()?.populateSessionSelect?.();
      getSolvePanel()?.renderSolvePanel?.();
      updateStatsTable();
    } else if (s.statsType === "cll") {
      const trackCaseIds = track?.cases ? track.cases.map(c => c.id) : [];
      const ok = await modalManager.confirmDialog({
        title: `Clear ${tName} Solves`,
        message: `Clear all ${tName} solve times in session "${sess.name}"?`,
        confirmLabel: "Clear Times",
        danger: true
      });
      if (!ok) return;
      const filtered = (sess.solves || []).filter(sv => {
        if (sv.track && sv.track === s.currentTrackId) return false;
        if (sv.id && trackCaseIds.includes(sv.id)) return false;
        return true;
      });
      s.lastSolve = filtered.length ? filtered[filtered.length - 1] : null;
      appStore.setSolves(filtered);
      getSessionModal()?.populateSessionSelect?.();
      getSolvePanel()?.renderSolvePanel?.();
      updateStatsTable();
    } else {
      const ok = await modalManager.confirmDialog({
        title: "Reset Recognition Stats",
        message: `Reset recognition statistics for ${pName} ${tName}?`,
        confirmLabel: "Reset",
        danger: true
      });
      if (!ok) return;
      appStore.resetRecognitionStats(s.currentPuzzle, s.currentTrackId);
      updateStatsTable();
    }
  });

  return {
    renderStatsToggle,
    setStatsType,
    syncStatsPanel,
    updateStatsTable,
    handleExportCSV
  };
}
