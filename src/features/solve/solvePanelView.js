// Solve Panel View: compact rolling-stats strip (Ao5/Ao12/Ao100/Best/Mean), last solve breakdown, timer drill banner, and custom scramble

import { Alg } from 'cubing/alg';
import { initCfopAnalyzer, ensureSolveCfop, computeCfopAverages, isCfopAnalyzerReady, computeMedian, computeTrimmedMean } from '../../cfopAnalyzer.js';
import { initTwoByTwoAnalyzer, ensureSolveTwoByTwo, computeTwoByTwoAverages, isTwoByTwoAnalyzerReady } from '../../twoByTwoAnalyzer.js';
import { averagePhase, medianPhase, trimMeanPhase, ganTimer } from '../../ganTimer.js';
import { smartCube } from '../../smartCube.js';
import { getSolveTargetLabel } from '../../data/algRegistry.js';
import { getSolveTime, computeAverageOfN, getBestAverageOfN } from '../../services/solveStats.js';
import { caseById, isTimerViewMode } from '../../state/appStore.js';
import { escapeHtml, formatSolveTime, formatSolveDisplay, formatCfopSplitMs } from '../../services/htmlUtils.js';
import { showToast } from '../../ui/toastService.js';
import { TIMER_DRILL_PRESETS, resolveTimerDrillPreset } from '../../ui/navController.js';
import { renderLastSolveCfopInline, renderSolvePhaseInline } from './cfopBreakdownRenderer.js';

export function renderSolveStatsBar(container, solvesList, { sessionName = "", compact = false, stepBreakdownHtml = "", onSelectSolve = null } = {}) {
  if (!container) return;
  if (!solvesList || !solvesList.length) {
    container.innerHTML = "";
    return;
  }
  const totalCount = solvesList.length;
  const chronological = [...solvesList].reverse(); // computeAverageOfN expects newest-first
  const valid = solvesList.map(s => getSolveTime(s)).filter(t => t != null && Number.isFinite(t));
  const bestSingle = valid.length ? Math.min(...valid) : null;
  const latestSolve = solvesList[totalCount - 1];

  const curAo5 = computeAverageOfN(chronological, 5);
  const bestAo5 = getBestAverageOfN(chronological, 5);
  const curAo12 = computeAverageOfN(chronological, 12);
  const bestAo12 = getBestAverageOfN(chronological, 12);
  const curAo100 = totalCount >= 100 ? computeAverageOfN(chronological, 100) : null;
  const bestAo100 = totalCount >= 100 ? getBestAverageOfN(chronological, 100) : null;

  const fmt = (v) => {
    if (v === null || v === undefined) return "-";
    if (v === -1 || v === "DNF") return "DNF";
    return formatSolveTime(v);
  };

  const recentCount = Math.min(12, totalCount);
  const recentEntries = [];
  for (let offset = 0; offset < recentCount; offset++) {
    const origIdx = totalCount - 1 - offset;
    recentEntries.push({
      sv: solvesList[origIdx],
      num: origIdx + 1,
      origIdx,
      rank: offset + 1
    });
  }

  const scopeText = sessionName
    ? `${escapeHtml(sessionName)} &middot; ${totalCount.toLocaleString()} solve${totalCount === 1 ? "" : "s"}`
    : `${totalCount.toLocaleString()} solve${totalCount === 1 ? "" : "s"}`;

  const recentChipsHtml = recentEntries.map(({ sv, num, origIdx, rank }) => {
    const cls = rank > 5 ? "recent-solve-chip is-desktop-extra" : "recent-solve-chip";
    return `<button type="button" class="${cls}" data-recent-idx="${origIdx}" data-recent-num="${num}" title="Click to inspect solve #${num}"><strong>${escapeHtml(formatSolveDisplay(sv))}</strong></button>`;
  }).join("");

  if (compact) {
    container.innerHTML = `
      <div class="solve-basic-grid ${stepBreakdownHtml ? "" : "is-two-col"}">
        ${stepBreakdownHtml ? `
          <div class="solve-basic-col solve-basic-col-steps">
            <div class="solve-basic-col-head">
              <span class="recent-stats-title">Last Solve</span>
            </div>
            ${stepBreakdownHtml}
          </div>
        ` : ""}
        <div class="solve-basic-col solve-basic-col-recent">
          <div class="solve-basic-col-head">
            <span class="recent-stats-title">Recent (${recentEntries.length})</span>
          </div>
          <div class="recent-solves-col-list" aria-label="Recent solves">${recentChipsHtml}</div>
        </div>
        <div class="solve-basic-col solve-basic-col-stats">
          <div class="solve-basic-col-head">
            <span class="recent-stats-title">Recent Stats</span>
            <span class="recent-stats-scope">${scopeText}</span>
          </div>
          <table class="recent-stats-vtable" aria-label="Current and best WCA averages">
            <thead>
              <tr>
                <th scope="col">Metric</th>
                <th scope="col">Current</th>
                <th scope="col">Best</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row">Single</th>
                <td>${latestSolve ? escapeHtml(formatSolveDisplay(latestSolve)) : "-"}</td>
                <td class="is-best-val">${fmt(bestSingle)}</td>
              </tr>
              <tr>
                <th scope="row">Ao5</th>
                <td>${fmt(curAo5)}</td>
                <td class="is-best-val">${fmt(bestAo5)}</td>
              </tr>
              <tr>
                <th scope="row">Ao12</th>
                <td>${fmt(curAo12)}</td>
                <td class="is-best-val">${fmt(bestAo12)}</td>
              </tr>
              <tr>
                <th scope="row">Ao100</th>
                <td>${fmt(curAo100)}</td>
                <td class="is-best-val">${fmt(bestAo100)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    `;
  } else {
    container.innerHTML = `
      <div class="recent-stats-panel">
        <div class="recent-stats-head">
          <div class="recent-stats-title-wrap">
            <span class="recent-stats-title">Recent Stats</span>
            <span class="recent-stats-scope">${scopeText}</span>
          </div>
        </div>
        <div class="recent-solves-strip" aria-label="Recent solves">${recentChipsHtml}</div>
        <div class="recent-stats-matrix" role="table" aria-label="Current and best WCA averages">
          <div class="recent-matrix-row recent-matrix-head" role="row">
            <span class="recent-matrix-label" role="columnheader">Metric</span>
            <span role="columnheader">Single</span>
            <span role="columnheader">Ao5</span>
            <span role="columnheader">Ao12</span>
            <span role="columnheader">Ao100</span>
          </div>
          <div class="recent-matrix-row" role="row">
            <span class="recent-matrix-label" role="rowheader">Current</span>
            <strong role="cell">${latestSolve ? escapeHtml(formatSolveDisplay(latestSolve)) : "-"}</strong>
            <strong role="cell">${fmt(curAo5)}</strong>
            <strong role="cell">${fmt(curAo12)}</strong>
            <strong role="cell">${fmt(curAo100)}</strong>
          </div>
          <div class="recent-matrix-row is-best-row" role="row">
            <span class="recent-matrix-label" role="rowheader">Best</span>
            <strong role="cell">${fmt(bestSingle)}</strong>
            <strong role="cell">${fmt(bestAo5)}</strong>
            <strong role="cell">${fmt(bestAo12)}</strong>
            <strong role="cell">${fmt(bestAo100)}</strong>
          </div>
        </div>
      </div>
    `;
  }

  if (typeof onSelectSolve === "function" && typeof container.querySelectorAll === "function") {
    container.querySelectorAll(".recent-solve-chip").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const idx = Number(btn.dataset.recentIdx);
        const num = Number(btn.dataset.recentNum);
        const solve = solvesList[idx];
        if (solve) onSelectSolve(solve, num);
      });
    });
  }
}

export function createSolvePanelView({
  appStore,
  cubeStage,
  solverWidgets,
  solveReplayViewer,
  getSmartCubeUi = () => null,
  getNavCtrl = () => null,
  getTimerCtrl = () => null,
  getSessionModal = () => null,
  getSolveDetailModal = () => null
} = {}) {
  const solveScrambleText = typeof document !== "undefined" ? document.getElementById("solveScrambleText") : null;
  const solveScrambleSubtext = typeof document !== "undefined" ? document.getElementById("solveScrambleSubtext") : null;
  const solveScrambleOrient = typeof document !== "undefined" ? document.getElementById("solveScrambleOrient") : null;
  const solveSurface = typeof document !== "undefined" ? document.getElementById("solveSurface") : null;
  const solveTimeEl = typeof document !== "undefined" ? document.getElementById("solveTime") : null;
  const solveCaseEl = typeof document !== "undefined" ? document.getElementById("solveCase") : null;
  const solvePostSummary = typeof document !== "undefined" ? document.getElementById("solvePostSummary") : null;
  const solvePostReplayBtn = typeof document !== "undefined" ? document.getElementById("solvePostReplayBtn") : null;
  const solveStatsBar = typeof document !== "undefined" ? document.getElementById("solveStatsBar") : null;
  const solveStepBreakdown = typeof document !== "undefined" ? document.getElementById("solveStepBreakdown") : null;
  const solveInlineRecentStats = typeof document !== "undefined" ? document.getElementById("solveInlineRecentStats") : null;
  const solveTimesEl = typeof document !== "undefined" ? document.getElementById("solveTimes") : null;
  const solveNewScrambleBtn = typeof document !== "undefined" ? document.getElementById("solveNewScrambleBtn") : null;
  const solveCustomScrambleBtn = typeof document !== "undefined" ? document.getElementById("solveCustomScrambleBtn") : null;
  const solveFocusToggleBtn = typeof document !== "undefined" ? document.getElementById("solveFocusToggleBtn") : null;
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
    const isDrill = isTimerViewMode(appStore.state) && appStore.state.solveTarget === "timer-drill";
    banner.hidden = !isDrill;
    if (!isDrill) return;

    const preset = resolveTimerDrillPreset(appStore.state.timerDrillPreset);
    if (presetSelect) presetSelect.value = preset.id;
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

    if (solveFocusToggleBtn) {
      const focused = Boolean(s.focusMode);
      solveFocusToggleBtn.classList.toggle("active", focused);
      solveFocusToggleBtn.setAttribute("aria-pressed", String(focused));
      solveFocusToggleBtn.textContent = focused ? "Exit Zen" : "Zen";
    }

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
      const isLast222 = (lastSolve.puzzle || s.currentPuzzle) === "222";
      const twoByTwoOpts = { twoByTwoMethod: s.twoByTwoMethod || "cll", layerTargetFaces: s.layerTargetFaces };
      const refWindow = solves.slice(-100);
      let refMedians = null;
      if (isLast222) {
        if (!isTwoByTwoAnalyzerReady()) {
          initTwoByTwoAnalyzer().then(() => {
            if (appStore.state.lastSolve) renderSolvePanel();
          });
        }
        ensureSolveTwoByTwo(lastSolve, twoByTwoOpts);
        if ((isTwoByTwoAnalyzerReady() || refWindow.some(sv => sv?.twoByTwo?.splits)) && refWindow.length >= 2) {
          refMedians = computeTwoByTwoAverages(refWindow, twoByTwoOpts).median;
        }
      } else {
        if (!isCfopAnalyzerReady()) {
          initCfopAnalyzer().then(() => {
            if (appStore.state.lastSolve) renderSolvePanel();
          });
        }
        ensureSolveCfop(lastSolve);
        if ((isCfopAnalyzerReady() || refWindow.some(sv => sv?.cfop?.splits)) && refWindow.length >= 2) {
          refMedians = computeCfopAverages(refWindow).median;
        }
      }
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
      const statsMode = s.statsDisplayMode || (s.showStatsPanel === false ? "none" : (s.advancedMode ? "advanced" : "basic"));
      if (solveCaseEl) {
        solveCaseEl.innerHTML = `<div class="solve-case-meta">${metaLine}</div>`;
      }
      if (solveStepBreakdown) {
        const advTableHtml = (statsMode === "advanced" && lastSolve.moves && lastSolve.moves.length > 0)
          ? renderLastSolveCfopInline(lastSolve, { basic: false, refMedians, twoByTwoMethod: s.twoByTwoMethod || "cll" })
          : "";
        solveStepBreakdown.innerHTML = advTableHtml;
        solveStepBreakdown.hidden = !advTableHtml;
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
      if (solveStepBreakdown) {
        solveStepBreakdown.hidden = true;
        solveStepBreakdown.innerHTML = "";
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

    const statsMode = s.statsDisplayMode || (s.showStatsPanel === false ? "none" : (s.advancedMode ? "advanced" : "basic"));
    const activeSess = appStore.getActiveSession?.();
    const openDetail = (sv, num) => getSolveDetailModal()?.open?.(sv, num);
    if (statsMode === "advanced") {
      if (solveInlineRecentStats) {
        solveInlineRecentStats.hidden = true;
        solveInlineRecentStats.innerHTML = "";
      }
      if (solveStatsBar) {
        renderSolveStatsBar(solveStatsBar, solves, {
          sessionName: activeSess?.name || "",
          compact: false,
          onSelectSolve: openDetail
        });
      }
      if (solveTimesEl) {
        solveTimesEl.hidden = !isTimerViewMode(s) || solves.length === 0;
      }
    } else if (statsMode === "basic") {
      if (solveTimesEl) solveTimesEl.hidden = true;
      if (solveInlineRecentStats) {
        const showInline = isTimerViewMode(s) && solves.length > 0;
        solveInlineRecentStats.hidden = !showInline;
        if (showInline) {
          const refWindow = solves.slice(-100);
          const isBasic222 = ((lastSolve?.puzzle || s.currentPuzzle) === "222");
          const twoByTwoOpts = { twoByTwoMethod: s.twoByTwoMethod || "cll", layerTargetFaces: s.layerTargetFaces };
          const basicRefMedians = (lastSolve && refWindow.length >= 2)
            ? (isBasic222
                ? computeTwoByTwoAverages(refWindow, twoByTwoOpts).median
                : computeCfopAverages(refWindow).median)
            : null;
          const basicStepHtml = (lastSolve && lastSolve.moves && lastSolve.moves.length > 0)
            ? renderLastSolveCfopInline(lastSolve, { basic: true, refMedians: basicRefMedians, twoByTwoMethod: s.twoByTwoMethod || "cll" })
            : "";
          renderSolveStatsBar(solveInlineRecentStats, solves, {
            sessionName: activeSess?.name || "",
            compact: true,
            stepBreakdownHtml: basicStepHtml,
            onSelectSolve: openDetail
          });
        } else {
          solveInlineRecentStats.innerHTML = "";
        }
      }
    } else {
      if (solveTimesEl) solveTimesEl.hidden = true;
      if (solveInlineRecentStats) {
        solveInlineRecentStats.hidden = true;
        solveInlineRecentStats.innerHTML = "";
      }
    }
    const hasInlineContent = Boolean(
      (solveInlineRecentStats && !solveInlineRecentStats.hidden) ||
      (!s.focusMode && solveStepBreakdown && !solveStepBreakdown.hidden)
    );
    solveSurface?.classList.toggle("has-inline-stats", hasInlineContent);
    if (typeof document !== "undefined") {
      const stageEl = document.querySelector(".stage");
      const cubeCardEl = document.querySelector(".cube-card");
      if (stageEl) {
        stageEl.classList.toggle(
          "solve-sidebar-empty",
          isTimerViewMode(s) && Boolean((!cubeCardEl || cubeCardEl.hidden) && (!solveTimesEl || solveTimesEl.hidden))
        );
      }
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
      const preset = resolveTimerDrillPreset(timerDrillPresetSelectEl.value);
      appStore.state.timerDrillPreset = preset.id;
      appStore.saveSettings();
      if (isTimerViewMode(appStore.state) && appStore.state.solveTarget === "timer-drill") {
        getNavCtrl()?.regenerateScramble?.();
      }
    });
  }

  solveNewScrambleBtn?.addEventListener("click", () => {
    solveScrambleSource = "";
    getNavCtrl()?.regenerateScramble?.();
  });
  solveFocusToggleBtn?.addEventListener("click", () => {
    appStore.setFocusMode(!appStore.state.focusMode);
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
