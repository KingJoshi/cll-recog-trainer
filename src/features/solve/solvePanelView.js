// Solve Panel View: compact rolling-stats strip (Ao5/Ao12/Ao100/Best/Mean), last solve breakdown, timer drill banner, and custom scramble

import { Alg } from 'cubing/alg';
import { initCfopAnalyzer, ensureSolveCfop, isCfopAnalyzerReady, computeMedian, computeTrimmedMean } from '../../cfopAnalyzer.js';
import { averagePhase, medianPhase, trimMeanPhase, ganTimer } from '../../ganTimer.js';
import { smartCube } from '../../smartCube.js';
import { getSolveTargetLabel } from '../../data/algRegistry.js';
import { getSolveTime, computeAverageOfN, getBestAverageOfN } from '../../services/solveStats.js';
import { caseById } from '../../state/appStore.js';
import { escapeHtml, formatSolveTime, formatSolveDisplay, formatCfopSplitMs } from '../../services/htmlUtils.js';
import { showToast } from '../../ui/toastService.js';
import { TIMER_DRILL_PRESETS } from '../../ui/navController.js';
import { renderLastSolveCfopInline, renderSolvePhaseInline } from './cfopBreakdownRenderer.js';

export function renderSolveStatsBar(container, solvesList) {
  if (!container) return;
  if (!solvesList || !solvesList.length) {
    container.innerHTML = "";
    return;
  }
  const chronological = [...solvesList].reverse(); // computeAverageOfN expects newest-first
  const valid = solvesList.map(s => getSolveTime(s)).filter(t => t != null && Number.isFinite(t));
  const bestSingle = valid.length ? Math.min(...valid) : null;
  const mean = valid.length ? Math.round(valid.reduce((a, b) => a + b, 0) / valid.length) : null;
  const median = valid.length ? computeMedian(valid) : null;
  const trimMean = valid.length ? computeTrimmedMean(valid, 0.10) : null;

  const curAo5 = computeAverageOfN(chronological, 5);
  const bestAo5 = getBestAverageOfN(chronological, 5);
  const curAo12 = computeAverageOfN(chronological, 12);
  const bestAo12 = getBestAverageOfN(chronological, 12);
  const curAo100 = solvesList.length >= 100 ? computeAverageOfN(chronological, 100) : null;
  const bestAo100 = solvesList.length >= 100 ? getBestAverageOfN(chronological, 100) : null;

  const fmt = (v) => {
    if (v === null || v === undefined) return "-";
    if (v === -1 || v === "DNF") return "DNF";
    return formatSolveTime(v);
  };

  container.innerHTML = `
    <div class="solve-stat-item">
      <span class="solve-stat-val">${fmt(bestSingle)}</span>
      <span class="solve-stat-lbl">Best</span>
    </div>
    <div class="solve-stat-item">
      <span class="solve-stat-val">${fmt(median)}</span>
      <span class="solve-stat-lbl">Median</span>
    </div>
    <div class="solve-stat-item" title="Trimmed Mean (excludes fastest 10% and slowest 10%)">
      <span class="solve-stat-val">${fmt(trimMean)}</span>
      <span class="solve-stat-lbl">Trim 10%</span>
    </div>
    <div class="solve-stat-item">
      <span class="solve-stat-val">${fmt(mean)}</span>
      <span class="solve-stat-lbl">Mean (${solvesList.length})</span>
    </div>
    <div class="solve-stat-item">
      <span class="solve-stat-val">${fmt(curAo5)}</span>
      <span class="solve-stat-lbl">Cur Ao5</span>
    </div>
    <div class="solve-stat-item">
      <span class="solve-stat-val">${fmt(bestAo5)}</span>
      <span class="solve-stat-lbl">Best Ao5</span>
    </div>
    <div class="solve-stat-item">
      <span class="solve-stat-val">${fmt(curAo12)}</span>
      <span class="solve-stat-lbl">Cur Ao12</span>
    </div>
    <div class="solve-stat-item">
      <span class="solve-stat-val">${fmt(bestAo12)}</span>
      <span class="solve-stat-lbl">Best Ao12</span>
    </div>
    ${solvesList.length >= 100 ? `
    <div class="solve-stat-item">
      <span class="solve-stat-val">${fmt(curAo100)}</span>
      <span class="solve-stat-lbl">Cur Ao100</span>
    </div>
    <div class="solve-stat-item">
      <span class="solve-stat-val">${fmt(bestAo100)}</span>
      <span class="solve-stat-lbl">Best Ao100</span>
    </div>
    ` : ""}
  `;
}

export function createSolvePanelView({
  appStore,
  cubeStage,
  solverWidgets,
  solveReplayViewer,
  getSmartCubeUi = () => null,
  getNavCtrl = () => null,
  getTimerCtrl = () => null,
  getSessionModal = () => null
} = {}) {
  const solveScrambleText = typeof document !== "undefined" ? document.getElementById("solveScrambleText") : null;
  const solveScrambleSubtext = typeof document !== "undefined" ? document.getElementById("solveScrambleSubtext") : null;
  const solveScrambleOrient = typeof document !== "undefined" ? document.getElementById("solveScrambleOrient") : null;
  const solveShowCubeToggle = typeof document !== "undefined" ? document.getElementById("solveShowCubeToggle") : null;
  const solveInspectionToggle = typeof document !== "undefined" ? document.getElementById("solveInspectionToggle") : null;
  const solveSurface = typeof document !== "undefined" ? document.getElementById("solveSurface") : null;
  const solveTimeEl = typeof document !== "undefined" ? document.getElementById("solveTime") : null;
  const solveCaseEl = typeof document !== "undefined" ? document.getElementById("solveCase") : null;
  const solvePostSummary = typeof document !== "undefined" ? document.getElementById("solvePostSummary") : null;
  const solvePostReplayBtn = typeof document !== "undefined" ? document.getElementById("solvePostReplayBtn") : null;
  const solveStatsBar = typeof document !== "undefined" ? document.getElementById("solveStatsBar") : null;
  const solveTimesEl = typeof document !== "undefined" ? document.getElementById("solveTimes") : null;
  const solveNewScrambleBtn = typeof document !== "undefined" ? document.getElementById("solveNewScrambleBtn") : null;
  const solveCustomScrambleBtn = typeof document !== "undefined" ? document.getElementById("solveCustomScrambleBtn") : null;
  const solveCustomScrambleRow = typeof document !== "undefined" ? document.getElementById("solveCustomScrambleRow") : null;
  const solveCustomInput = typeof document !== "undefined" ? document.getElementById("solveCustomInput") : null;
  const solveCustomClearBtn = typeof document !== "undefined" ? document.getElementById("solveCustomClearBtn") : null;
  const solveCustomApplyBtn = typeof document !== "undefined" ? document.getElementById("solveCustomApplyBtn") : null;
  const solveCustomCancelBtn = typeof document !== "undefined" ? document.getElementById("solveCustomCancelBtn") : null;
  const timerDrillPresetSelectEl = typeof document !== "undefined" ? document.getElementById("timerDrillPresetSelect") : null;
  const solvePenaltyPlus2Btn = typeof document !== "undefined" ? document.getElementById("solvePenaltyPlus2Btn") : null;
  const solvePenaltyDnfBtn = typeof document !== "undefined" ? document.getElementById("solvePenaltyDnfBtn") : null;
  const solveDeleteLastBtn = typeof document !== "undefined" ? document.getElementById("solveDeleteLastBtn") : null;

  let solveScrambleSource = "";

  function setScrambleSource(html) {
    solveScrambleSource = html || "";
  }

  function renderTimerDrillBanner() {
    if (typeof document === "undefined") return;
    const banner = document.getElementById("timerDrillBanner");
    const presetSelect = document.getElementById("timerDrillPresetSelect");
    const metricsBar = document.getElementById("timerDrillMetricsBar");
    if (!banner) return;
    const isDrill = appStore.state.mode === "solve" && appStore.state.solveTarget === "timer-drill";
    banner.hidden = !isDrill;
    if (!isDrill) return;

    if (presetSelect) presetSelect.value = appStore.state.timerDrillPreset;
    if (!metricsBar) return;

    const solves = appStore.getSolves();
    const drillSolves = solves.filter(s => s && s.target === "timer-drill" && s.penalty !== "DNF" && s.penalty !== -1);
    const pool = drillSolves.length ? drillSolves : solves;
    const lastDrill = drillSolves.length ? drillSolves[drillSolves.length - 1] : appStore.state.lastSolve;
    const medPickup = medianPhase(pool, "pickupMs");
    const trimPickup = trimMeanPhase(pool, "pickupMs");
    const avgPickup = averagePhase(pool, "pickupMs");
    const medCube = medianPhase(pool, "cubeMs");
    const trimCube = trimMeanPhase(pool, "cubeMs");
    const avgCube = averagePhase(pool, "cubeMs");
    const medPutdown = medianPhase(pool, "putdownMs");
    const trimPutdown = trimMeanPhase(pool, "putdownMs");
    const avgPutdown = averagePhase(pool, "putdownMs");
    const lastHandling = (lastDrill && lastDrill.pickupMs != null && lastDrill.putdownMs != null)
      ? (lastDrill.pickupMs + lastDrill.putdownMs)
      : null;
    const medHandling = (medPickup != null && medPutdown != null) ? (medPickup + medPutdown) : null;
    const trimHandling = (trimPickup != null && trimPutdown != null) ? (trimPickup + trimPutdown) : null;
    const avgHandling = (avgPickup != null && avgPutdown != null) ? (avgPickup + avgPutdown) : null;

    const fmtSub = (med, trim, avg) =>
      `Med: ${med != null ? formatCfopSplitMs(med) : "-"} · Trim: ${trim != null ? formatCfopSplitMs(trim) : "-"} · Mean: ${avg != null ? formatCfopSplitMs(avg) : "-"}`;

    metricsBar.innerHTML = `
      <div class="timer-drill-kpi">
        <span class="timer-drill-kpi-lbl">Pick-up (Timer → 1st Turn)</span>
        <strong class="timer-drill-kpi-val">${lastDrill?.pickupMs != null ? formatCfopSplitMs(lastDrill.pickupMs) : "-"}</strong>
        <small class="timer-drill-kpi-sub">${fmtSub(medPickup, trimPickup, avgPickup)}</small>
      </div>
      <div class="timer-drill-kpi">
        <span class="timer-drill-kpi-lbl">Trigger Exec</span>
        <strong class="timer-drill-kpi-val">${lastDrill?.cubeMs != null ? formatCfopSplitMs(lastDrill.cubeMs) : (lastDrill?.ms != null ? formatCfopSplitMs(lastDrill.ms) : "-")}</strong>
        <small class="timer-drill-kpi-sub">${fmtSub(medCube, trimCube, avgCube)}</small>
      </div>
      <div class="timer-drill-kpi">
        <span class="timer-drill-kpi-lbl">Put-down (Solved → Stop)</span>
        <strong class="timer-drill-kpi-val">${lastDrill?.putdownMs != null ? formatCfopSplitMs(lastDrill.putdownMs) : "-"}</strong>
        <small class="timer-drill-kpi-sub">${fmtSub(medPutdown, trimPutdown, avgPutdown)}</small>
      </div>
      <div class="timer-drill-kpi timer-drill-kpi-accent">
        <span class="timer-drill-kpi-lbl">Total Handling (Pick-up + Put-down)</span>
        <strong class="timer-drill-kpi-val">${lastHandling != null ? formatCfopSplitMs(lastHandling) : "-"}</strong>
        <small class="timer-drill-kpi-sub">${fmtSub(medHandling, trimHandling, avgHandling)}</small>
      </div>
    `;
  }

  function updateSolveScrambleDisplay(scrambleStr) {
    const s = appStore.state;
    s.currentSolveScramble = scrambleStr || "";
    s.scrambleMoves = s.currentSolveScramble;
    s.scramble = s.currentSolveScramble;
    const scUi = getSmartCubeUi();
    scUi?.clearScrambleCorrectionDelay?.();

    const st = smartCube.getStatus();
    if (s.solveTarget === "timer-drill") {
      const preset = TIMER_DRILL_PRESETS[s.timerDrillPreset] || TIMER_DRILL_PRESETS["righty-inv"];
      if (st.connected) {
        smartCube.setScramble("", s.currentPuzzle);
        scUi?.resetScrambleTracker?.("", true);
        scUi?.setSmartCubeStage?.(s.solveInspection ? "inspecting" : "ready");
        if (solveScrambleText) {
          solveScrambleText.innerHTML = `<span class="scramble-completed-badge">✓ Solved Cube Ready</span> <span class="timer-drill-seq">${escapeHtml(preset.display)}</span>`;
        }
        scUi?.updateSmartCubeIndicator?.();
      } else if (solveScrambleText) {
        solveScrambleText.textContent = preset.display;
      }
      renderTimerDrillBanner();
      return;
    }

    if (st.connected) {
      scUi?.setSmartCubeStage?.("scrambling");
      smartCube.setScramble("", s.currentPuzzle);
      scUi?.resetScrambleTracker?.(s.currentSolveScramble, false);
      smartCube.logDiag("SCRAMBLE_INIT", { scramble: s.currentSolveScramble });
      if (solveScrambleText) {
        solveScrambleText.innerHTML = scUi?.getScrambleTrackerHtml?.() || escapeHtml(s.currentSolveScramble);
      }
      scUi?.updateSmartCubeIndicator?.();
    } else if (solveScrambleText) {
      solveScrambleText.textContent = s.currentSolveScramble;
    }
    renderTimerDrillBanner();
  }

  function renderSolvePanel() {
    getSessionModal()?.populateSessionSelect?.();
    const s = appStore.state;
    const solves = appStore.getSolves();
    const lastSolve = s.lastSolve;

    if (solveShowCubeToggle) solveShowCubeToggle.checked = s.solveShowCube;
    if (solveInspectionToggle) solveInspectionToggle.checked = s.solveInspection;

    const currentScr = s.scrambleMoves || s.currentSolveScramble || s.scramble;
    const st = smartCube.getStatus();
    const scUi = getSmartCubeUi();
    if (st.connected && scUi?.getSmartCubeStage?.() === "needs_reset") {
      if (solveScrambleText) {
        solveScrambleText.innerHTML = `<span class="scramble-reset-badge">⚠️ Solve &amp; reset your cube for the next scramble</span>`;
      }
    } else if (st.connected && scUi?.getSmartCubeStage?.() === "scrambling" && !scUi?.isScrambleComplete?.()) {
      scUi?.renderSmartScrambleAssistant?.();
    } else if (solveScrambleText) {
      solveScrambleText.textContent = currentScr;
    }
    scUi?.updateSmartCubeIndicator?.();

    if (solveScrambleOrient) {
      const isWhiteBottom = s.solveTarget === "cll" || ((s.currentPuzzle === "333" || s.currentPuzzle === "333oh") && ["f2l", "oll", "pll"].includes(s.solveTarget));
      solveScrambleOrient.textContent = isWhiteBottom ? "(white on bottom)" : "(WCA orientation)";
    }

    if (solveScrambleSubtext) {
      if (solveScrambleSource) {
        solveScrambleSubtext.innerHTML = solveScrambleSource;
        solveScrambleSubtext.hidden = false;
      } else {
        solveScrambleSubtext.hidden = true;
        solveScrambleSubtext.textContent = "";
      }
    }

    if (lastSolve) {
      if (!isCfopAnalyzerReady()) {
        initCfopAnalyzer().then(() => {
          if (appStore.state.lastSolve) renderSolvePanel();
        });
      }
      ensureSolveCfop(lastSolve);
      if (solveTimeEl) solveTimeEl.textContent = formatSolveDisplay(lastSolve);
      let metaLine = "";
      if (lastSolve.id && caseById.has(lastSolve.id)) {
        const caseObj = caseById.get(lastSolve.id);
        metaLine = `<strong>${escapeHtml(lastSolve.id)}</strong> · ${escapeHtml(appStore.getCllCaseSolutionDisplay(caseObj))} · opposite ${escapeHtml(caseObj.opposite)}`;
      } else {
        const targetLabel = getSolveTargetLabel(lastSolve.puzzle || s.currentPuzzle, lastSolve.target);
        metaLine = `<span class="solve-case-target">${escapeHtml(targetLabel)}</span>`;
      }
      if (lastSolve.moves && lastSolve.moves.length > 0) {
        metaLine += ` · <strong>${lastSolve.moveCount} moves</strong> · <strong>${lastSolve.tps} TPS</strong>`;
      }
      const phaseMeta = renderSolvePhaseInline(lastSolve);
      if (phaseMeta) metaLine += ` · ${phaseMeta}`;
      if (solveCaseEl) {
        solveCaseEl.innerHTML = `<div class="solve-case-meta">${metaLine}</div>` +
          (lastSolve.moves && lastSolve.moves.length > 0 ? renderLastSolveCfopInline(lastSolve) : "");
      }
      if (solvePostSummary && solvePostReplayBtn) {
        const hasMoves = Boolean(lastSolve.moves && lastSolve.moves.length > 0);
        solvePostSummary.hidden = !hasMoves;
        if (hasMoves) {
          solvePostReplayBtn.onclick = () => solveReplayViewer.open(lastSolve, "Latest Solve Replay");
        }
      }
    } else {
      if (solveTimeEl) solveTimeEl.textContent = "0.00";
      if (solveCaseEl) {
        solveCaseEl.textContent = s.solveInspection
          ? "Scramble cube, then inspect & start timer."
          : "Scramble cube, then hold to arm & start timer.";
      }
      if (solvePostSummary) solvePostSummary.hidden = true;
    }

    if (solveSurface) {
      const keyHint = solveSurface.querySelector(".solve-hint-key");
      const touchHint = solveSurface.querySelector(".solve-hint-touch");
      const timerConnected = ganTimer.isConnected();
      if (keyHint) {
        keyHint.innerHTML = timerConnected
          ? (s.solveInspection ? "Space to inspect &bull; Use the GAN timer to start &amp; stop" : "GAN timer connected &bull; Hands on timer, release to start")
          : s.solveInspection
            ? "Space to inspect &bull; Hold Space to arm &bull; Release to start"
            : "Hold Space to arm &bull; Release to start &bull; any key to stop";
      }
      if (touchHint) {
        touchHint.innerHTML = timerConnected
          ? (s.solveInspection ? "Tap to inspect &bull; Use the GAN timer to start &amp; stop" : "GAN timer connected &bull; Hands on timer, release to start")
          : s.solveInspection
            ? "Tap to inspect &bull; Hold to arm &bull; Release to start"
            : "Tap and hold to arm &bull; Release to start";
      }
    }

    if (solveStatsBar) {
      renderSolveStatsBar(solveStatsBar, solves);
    }
    if (solveTimesEl) {
      // Phase 2 compatibility before Phase 3 strips legacy #solveTimes wrapper; full Solve Log lives in #statsPanel
      solveTimesEl.hidden = s.mode !== "solve" || solves.length === 0;
    }

    if (solvePenaltyPlus2Btn) {
      const isP2 = lastSolve && (lastSolve.penalty === "+2" || lastSolve.penalty === 2);
      solvePenaltyPlus2Btn.hidden = !lastSolve;
      solvePenaltyPlus2Btn.classList.toggle("active", Boolean(isP2));
    }
    if (solvePenaltyDnfBtn) {
      const isDnf = lastSolve && (lastSolve.penalty === "DNF" || lastSolve.penalty === -1);
      solvePenaltyDnfBtn.hidden = !lastSolve;
      solvePenaltyDnfBtn.classList.toggle("active", Boolean(isDnf));
    }
    if (solveDeleteLastBtn) {
      solveDeleteLastBtn.hidden = !lastSolve;
    }

    solverWidgets?.updateFaceChipsUI?.();
    solverWidgets?.updateCrossFacesUI?.();
    renderTimerDrillBanner();
  }

  function reattemptScramble(scrambleStr, label = "") {
    if (!scrambleStr) return;
    getNavCtrl()?.setMode?.("solve");
    appStore.state.currentCaseId = null;
    solveScrambleSource = `Loaded scramble from <strong>${escapeHtml(label || "previous solve")}</strong> · Ready to inspect &amp; start`;
    updateSolveScrambleDisplay(scrambleStr);
    if (solveScrambleSubtext) {
      solveScrambleSubtext.innerHTML = solveScrambleSource;
      solveScrambleSubtext.hidden = false;
    }
    cubeStage?.applyScrambleToDisplay?.(scrambleStr);
    cubeStage?.applyReflection?.();
    cubeStage?.resetCubeOrientation?.();
    if (appStore.state.currentPuzzle === "222") {
      solverWidgets?.updateLayerSolutions?.(scrambleStr);
    } else if (appStore.state.currentPuzzle === "333" || appStore.state.currentPuzzle === "333oh") {
      solverWidgets?.updateCrossSolutions?.(scrambleStr);
    }
    const timerCtrl = getTimerCtrl();
    if (timerCtrl?.getSolveState?.() !== "idle") {
      timerCtrl?.cancelSolve?.();
    }
    renderSolvePanel();
    if (typeof window !== "undefined") {
      window.scrollTo({ top: 0, behavior: "smooth" });
    }
  }

  function toggleSolveCustomScramble(show) {
    if (!solveCustomScrambleRow) return;
    const willShow = show !== undefined ? show : solveCustomScrambleRow.hidden;
    solveCustomScrambleRow.hidden = !willShow;
    if (willShow) {
      solveCustomScrambleBtn?.classList.add("active");
      if (solveCustomInput) {
        solveCustomInput.value = appStore.state.currentSolveScramble || appStore.state.scrambleMoves || appStore.state.scramble || "";
        solveCustomInput.focus();
        solveCustomInput.select();
      }
    } else {
      solveCustomScrambleBtn?.classList.remove("active");
    }
  }

  function applyCustomSolveScramble() {
    if (!solveCustomInput) return;
    const raw = solveCustomInput.value.trim();
    if (!raw) {
      showToast("Please enter a scramble sequence.", "warning");
      solveCustomInput.focus();
      return;
    }
    try {
      const normalized = new Alg(raw).toString().trim();
      if (!normalized) {
        showToast("Please enter a valid scramble.", "warning");
        return;
      }
      solveScrambleSource = `Custom scramble loaded · Ready to inspect &amp; start`;
      const s = appStore.state;
      s.currentSolveScramble = normalized;
      s.scrambleMoves = normalized;
      s.scramble = normalized;
      s.currentCaseId = null;
      cubeStage?.applyScrambleToDisplay?.(normalized);
      cubeStage?.applyReflection?.();
      cubeStage?.resetCubeOrientation?.();
      if (s.currentPuzzle === "222") solverWidgets?.updateLayerSolutions?.(normalized);
      else if (s.currentPuzzle === "333" || s.currentPuzzle === "333oh") solverWidgets?.updateCrossSolutions?.(normalized);
      const timerCtrl = getTimerCtrl();
      if (timerCtrl?.getSolveState?.() !== "idle") timerCtrl?.cancelSolve?.();
      toggleSolveCustomScramble(false);
      renderSolvePanel();
      showToast("Custom scramble applied.", "success", 1800);
    } catch (err) {
      showToast(`Invalid scramble syntax: ${err.message || "Check for invalid moves"}`, "error");
      solveCustomInput.focus();
    }
  }

  if (timerDrillPresetSelectEl) {
    timerDrillPresetSelectEl.addEventListener("change", () => {
      const val = timerDrillPresetSelectEl.value;
      if (TIMER_DRILL_PRESETS[val]) {
        appStore.state.timerDrillPreset = val;
        appStore.saveSettings();
        if (appStore.state.mode === "solve" && appStore.state.solveTarget === "timer-drill") {
          getNavCtrl()?.regenerateScramble?.();
        }
      }
    });
  }

  if (solveShowCubeToggle) {
    solveShowCubeToggle.addEventListener("change", () => {
      appStore.state.solveShowCube = solveShowCubeToggle.checked;
      appStore.getActiveSession().showCube = appStore.state.solveShowCube;
      appStore.saveSessions();
      appStore.saveSettings();
      getNavCtrl()?.renderStage?.();
    });
  }

  if (solveInspectionToggle) {
    solveInspectionToggle.addEventListener("change", () => {
      appStore.state.solveInspection = solveInspectionToggle.checked;
      appStore.getActiveSession().inspection = appStore.state.solveInspection;
      appStore.saveSessions();
      appStore.saveSettings();
      renderSolvePanel();
    });
  }

  solveNewScrambleBtn?.addEventListener("click", () => {
    solveScrambleSource = "";
    getNavCtrl()?.regenerateScramble?.();
  });
  solveCustomScrambleBtn?.addEventListener("click", () => toggleSolveCustomScramble());
  solveCustomCancelBtn?.addEventListener("click", () => toggleSolveCustomScramble(false));
  solveCustomClearBtn?.addEventListener("click", () => {
    if (solveCustomInput) {
      solveCustomInput.value = "";
      solveCustomInput.focus();
    }
  });
  solveCustomApplyBtn?.addEventListener("click", applyCustomSolveScramble);
  solveCustomInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      applyCustomSolveScramble();
    } else if (e.key === "Escape") {
      e.preventDefault();
      toggleSolveCustomScramble(false);
    }
  });

  return {
    setScrambleSource,
    renderTimerDrillBanner,
    updateSolveScrambleDisplay,
    renderSolvePanel,
    reattemptScramble,
    toggleSolveCustomScramble,
    applyCustomSolveScramble
  };
}
