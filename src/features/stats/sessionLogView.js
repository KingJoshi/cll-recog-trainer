// Paginated Full Session Solve Log, CFOP Averages, and OLL/PLL Case Performance View

import { getTrack, getSolveTargetLabel } from '../../data/algRegistry.js';
import { ollCases } from '../../data/ollData.js';
import { pllCases } from '../../data/pllData.js';
import {
  initCfopAnalyzer,
  ensureSolveCfop,
  computeCfopAverages,
  computeMedian,
  computeTrimmedMean,
  isCfopAnalyzerReady
} from '../../cfopAnalyzer.js';
import { averagePhase } from '../../ganTimer.js';
import { prewarmOllPllSvgs, isOllPllSvgsPrewarmed } from '../../caseVisualizer.js';
import { getSolveTime, computeAverageOfN, getBestAverageOfN } from '../../services/solveStats.js';
import { getSolveFingerprint } from '../../services/syncMerge.js';
import { recordTombstone } from '../../services/syncStorage.js';
import { LOG_PAGE_SIZE_OPTIONS } from '../../state/appStore.js';
import {
  escapeHtml,
  renderSolveDateClockHtml,
  formatSolveTime,
  formatSolveDisplay,
  formatCfopSplitMs
} from '../../services/htmlUtils.js';
import { renderOllPllCasesBreakdownHtml } from '../solve/cfopBreakdownRenderer.js';
import { ICON_PLAY, ICON_RESET_ANGLE } from '../../ui/transportIcons.js';

export function createSessionLogView({
  appStore,
  modalManager,
  solveReplayViewer,
  getSolveDetailModal = () => null,
  getSolvePanel = () => null,
  getSessionModal = () => null
} = {}) {
  let sessionLogFilter = "all"; // "all" | "track" | "full"
  const sessionLogSort = { col: "num", dir: "desc" };
  const ollPllBreakdownSort = {
    oll: { col: "medianMs", dir: "desc" },
    pll: { col: "medianMs", dir: "desc" }
  };

  function render(container) {
    if (!container) return;
    const s = appStore.state;
    const is3x3Puzzle = s.currentPuzzle === "333" || s.currentPuzzle === "333oh";

    if (is3x3Puzzle && !isCfopAnalyzerReady()) {
      initCfopAnalyzer().then(() => {
        if (s.statsType === "log" || s.statsType === "solve") render(container);
      });
    }
    if (is3x3Puzzle && !isOllPllSvgsPrewarmed()) {
      prewarmOllPllSvgs(ollCases, pllCases).then(() => {
        if (s.statsType === "log" || s.statsType === "solve") render(container);
      });
    }

    const sess = appStore.getActiveSession();
    const sessSolves = sess.solves || [];

    if (sessSolves.length === 0) {
      container.innerHTML = `
        <div class="empty-stats" style="text-align: center; padding: 24px;">
          <p>No solves recorded in <strong>${escapeHtml(sess.name)}</strong> yet.</p>
          <p style="color: var(--muted); font-size: 0.9rem;">Time your solves in the <strong>Solve</strong> tab to build your session history${is3x3Puzzle ? ", CFOP step splits, and OLL/PLL case analytics" : ""}.</p>
        </div>
      `;
      return;
    }

    const track = getTrack(s.currentPuzzle, s.currentTrackId);
    const trackCaseIds = (track?.cases || []).map(c => c.id);
    const trackSolves = sessSolves.filter(sv =>
      sv.track === s.currentTrackId || sv.target === s.currentTrackId || (sv.id && trackCaseIds.includes(sv.id))
    );
    const fullSolves = sessSolves.filter(sv => sv.target === "full" || (!sv.target && !sv.id));
    const displaySolves = sessionLogFilter === "track"
      ? trackSolves
      : (sessionLogFilter === "full" ? fullSolves : sessSolves);

    if (is3x3Puzzle) {
      displaySolves.forEach(sv => ensureSolveCfop(sv));
    }

    const validTimes = displaySolves.map(sv => getSolveTime(sv)).filter(t => t != null && Number.isFinite(t));
    const count = displaySolves.length;
    const best = validTimes.length ? Math.min(...validTimes) : null;
    const mean = validTimes.length ? Math.round(validTimes.reduce((a, b) => a + b, 0) / validTimes.length) : null;
    const median = validTimes.length ? computeMedian(validTimes) : null;
    const trimMean = validTimes.length ? computeTrimmedMean(validTimes, 0.10) : null;
    const worst = validTimes.length ? Math.max(...validTimes) : null;

    const chronological = [...displaySolves].reverse();
    const curAo5 = computeAverageOfN(chronological, 5);
    const bestAo5 = getBestAverageOfN(chronological, 5);
    const curAo12 = computeAverageOfN(chronological, 12);
    const bestAo12 = getBestAverageOfN(chronological, 12);
    const curAo100 = computeAverageOfN(chronological, 100);
    const bestAo100 = getBestAverageOfN(chronological, 100);
    const formatAo = (val) => val === -1 || val === "DNF" ? "DNF" : (val != null ? formatSolveTime(val) : "-");

    const allIndexed = displaySolves.map((sv, idx) => ({
      s: sv,
      num: idx + 1,
      origIdx: sessSolves.indexOf(sv)
    }));

    const getSolveCubeMs = (sv) => {
      if (!sv) return null;
      if (typeof sv.cubeMs === "number" && Number.isFinite(sv.cubeMs)) return sv.cubeMs;
      if (Array.isArray(sv.moves) && sv.moves.length > 0) {
        const raw = sv.rawMs != null && Number.isFinite(sv.rawMs) ? sv.rawMs : sv.ms;
        return Number.isFinite(raw) ? raw : null;
      }
      return null;
    };

    const getLogSortValue = (entry, col) => {
      const sv = entry.s;
      if (col === "num" || col === "at") return entry.num;
      if (col === "ms") return getSolveTime(sv);
      if (col === "cubeMs") {
        const cm = getSolveCubeMs(sv);
        return cm != null ? cm : Infinity;
      }
      if (col === "id") return String(sv.id || sv.target || "").toLowerCase();
      if (col === "inspectionMs") return sv.inspectionMs != null ? sv.inspectionMs : Infinity;
      if (col === "pickupMs") return sv.pickupMs != null ? sv.pickupMs : Infinity;
      if (col === "putdownMs") return sv.putdownMs != null ? sv.putdownMs : Infinity;
      const cfop = is3x3Puzzle ? ensureSolveCfop(sv) : null;
      const sp = cfop?.splits || {};
      if (col in sp) return sp[col] != null ? sp[col] : Infinity;
      if (col === "pauseMs") return cfop?.pauses?.totalMs != null ? cfop.pauses.totalMs : Infinity;
      return entry.num;
    };

    const allReversed = [...allIndexed].sort((a, b) => {
      const col = sessionLogSort.col || "num";
      const dir = sessionLogSort.dir || "desc";
      const vA = getLogSortValue(a, col);
      const vB = getLogSortValue(b, col);
      if (vA === Infinity && vB === Infinity) return b.num - a.num;
      if (vA === Infinity) return 1;
      if (vB === Infinity) return -1;
      if (vA < vB) return dir === "asc" ? -1 : 1;
      if (vA > vB) return dir === "asc" ? 1 : -1;
      return b.num - a.num;
    });

    const logSortArrow = (col) => sessionLogSort.col === col ? (sessionLogSort.dir === "asc" ? " ▲" : " ▼") : "";
    const pageSize = LOG_PAGE_SIZE_OPTIONS.includes(Number(s.sessionLogPageSize)) ? Number(s.sessionLogPageSize) : 12;
    const totalPages = Math.max(1, Math.ceil(allReversed.length / pageSize));
    if (s.sessionLogPage > totalPages) s.sessionLogPage = totalPages;
    if (s.sessionLogPage < 1) s.sessionLogPage = 1;

    const startIdx = (s.sessionLogPage - 1) * pageSize;
    const endIdx = Math.min(allReversed.length, startIdx + pageSize);
    const pageRows = allReversed.slice(startIdx, endIdx);
    const pageSolves = pageRows.map(r => r.s);
    const newestXSolves = [...allIndexed].reverse().slice(0, pageSize).map(r => r.s);

    const lastXAvg = computeCfopAverages(newestXSolves);
    const pageAvg = computeCfopAverages(pageSolves);
    const sessionAvg = computeCfopAverages(displaySolves);
    const fmtPauseSummary = (countVal, msVal) => countVal == null ? "-" : `${countVal} (${formatCfopSplitMs(msVal || 0)})`;

    let html = `
      <div class="stats-subfilter-bar">
        <span class="stats-subfilter-label">Filter:</span>
        <button type="button" class="stats-subfilter-btn ${sessionLogFilter === "all" ? "active" : ""}" data-log-filter="all">All (${sessSolves.length})</button>
        <button type="button" class="stats-subfilter-btn ${sessionLogFilter === "track" ? "active" : ""}" data-log-filter="track">${escapeHtml(track?.shortName || "Current Set")} (${trackSolves.length})</button>
        <button type="button" class="stats-subfilter-btn ${sessionLogFilter === "full" ? "active" : ""}" data-log-filter="full">Full Solves (${fullSolves.length})</button>
      </div>
      <div class="layer-stats-grid">
        <div class="layer-stat-card"><span class="layer-stat-val">${count}</span><span class="layer-stat-lbl">Attempts</span></div>
        <div class="layer-stat-card highlight-best"><span class="layer-stat-val">${best != null ? formatSolveTime(best) : "-"}</span><span class="layer-stat-lbl">Best</span></div>
        <div class="layer-stat-card highlight-best"><span class="layer-stat-val">${median != null ? formatSolveTime(median) : "-"}</span><span class="layer-stat-lbl">Median</span></div>
        <div class="layer-stat-card" title="Trimmed Mean (excludes fastest 10% and slowest 10%)"><span class="layer-stat-val">${trimMean != null ? formatSolveTime(trimMean) : "-"}</span><span class="layer-stat-lbl">TrimMean 10%</span></div>
        <div class="layer-stat-card"><span class="layer-stat-val">${mean != null ? formatSolveTime(mean) : "-"}</span><span class="layer-stat-lbl">Mean</span></div>
        <div class="layer-stat-card"><span class="layer-stat-val">${worst != null ? formatSolveTime(worst) : "-"}</span><span class="layer-stat-lbl">Worst</span></div>
    `;

    const logAvgCube = averagePhase(displaySolves, "cubeMs");
    const logAvgInspection = averagePhase(displaySolves, "inspectionMs");
    const logAvgPickup = averagePhase(displaySolves, "pickupMs");
    const logAvgPutdown = averagePhase(displaySolves, "putdownMs");
    if (logAvgCube != null || logAvgInspection != null || logAvgPickup != null || logAvgPutdown != null) {
      html += `
        ${logAvgCube != null ? `<div class="layer-stat-card" title="First smart cube turn → cube solved"><span class="layer-stat-val">${formatCfopSplitMs(logAvgCube)}</span><span class="layer-stat-lbl">Avg Cube</span></div>` : ""}
        ${logAvgInspection != null ? `<div class="layer-stat-card" title="WCA inspection duration before timer start"><span class="layer-stat-val">${formatCfopSplitMs(logAvgInspection)}</span><span class="layer-stat-lbl">Avg Insp</span></div>` : ""}
        ${(logAvgPickup != null || logAvgPutdown != null) ? `
          <div class="layer-stat-card" title="Timer start → first smart cube turn"><span class="layer-stat-val">${formatCfopSplitMs(logAvgPickup)}</span><span class="layer-stat-lbl">Avg Pick-up</span></div>
          <div class="layer-stat-card" title="Smart cube solved → timer stopped"><span class="layer-stat-val">${formatCfopSplitMs(logAvgPutdown)}</span><span class="layer-stat-lbl">Avg Put-down</span></div>
        ` : ""}
      `;
    }
    if (count >= 5) {
      html += `<div class="layer-stat-card"><span class="layer-stat-val">${formatAo(curAo5)}</span><span class="layer-stat-lbl">Ao5</span></div>
        <div class="layer-stat-card"><span class="layer-stat-val">${formatAo(bestAo5)}</span><span class="layer-stat-lbl">Best Ao5</span></div>`;
    }
    if (count >= 12) {
      html += `<div class="layer-stat-card"><span class="layer-stat-val">${formatAo(curAo12)}</span><span class="layer-stat-lbl">Ao12</span></div>
        <div class="layer-stat-card"><span class="layer-stat-val">${formatAo(bestAo12)}</span><span class="layer-stat-lbl">Best Ao12</span></div>`;
    }
    if (count >= 100) {
      html += `<div class="layer-stat-card"><span class="layer-stat-val">${formatAo(curAo100)}</span><span class="layer-stat-lbl">Ao100</span></div>
        <div class="layer-stat-card"><span class="layer-stat-val">${formatAo(bestAo100)}</span><span class="layer-stat-lbl">Best Ao100</span></div>`;
    }
    html += `</div>`;

    const renderCfopStatRowHtml = (scopeTitle, subMeta, statsObj, pauseCnt, pauseMsVal, rowClass = "") => {
      if (!statsObj) return "";
      return `
        <tr class="${rowClass}">
          <td class="cfop-avg-scope-cell"><strong>${scopeTitle}</strong> ${subMeta ? `<small class="cfop-sub-meta">${subMeta}</small>` : ""}</td>
          <td><strong>${statsObj.totalMs != null ? formatSolveTime(statsObj.totalMs) : "-"}</strong></td>
          <td><strong>${formatCfopSplitMs(statsObj.cubeMs)}</strong></td>
          <td>${formatCfopSplitMs(statsObj.inspectionMs)}</td>
          <td>${formatCfopSplitMs(statsObj.pickupMs)}</td>
          <td>${formatCfopSplitMs(statsObj.cross)}</td>
          <td>${formatCfopSplitMs(statsObj.f2l1)}</td>
          <td>${formatCfopSplitMs(statsObj.f2l2)}</td>
          <td>${formatCfopSplitMs(statsObj.f2l3)}</td>
          <td>${formatCfopSplitMs(statsObj.f2l4)}</td>
          <td><strong>${formatCfopSplitMs(statsObj.f2lTotal)}</strong></td>
          <td>${formatCfopSplitMs(statsObj.oll)}</td>
          <td>${formatCfopSplitMs(statsObj.pll)}</td>
          <td>${formatCfopSplitMs(statsObj.putdownMs)}</td>
          <td>${fmtPauseSummary(pauseCnt, pauseMsVal)}</td>
        </tr>
      `;
    };

    if (is3x3Puzzle) {
      html += `
        <div class="cfop-averages-summary-card stats-subwidget ${s.cfopSummaryOpen ? "" : "is-collapsed"}" data-stats-widget="cfopSummary">
          <div class="cfop-averages-head stats-subwidget-head">
            <button type="button" class="stats-subwidget-toggle" data-stats-collapse="cfopSummary" aria-expanded="${s.cfopSummaryOpen ? "true" : "false"}">
              <span class="chevron" aria-hidden="true"></span>
              <span class="cfop-averages-title">CFOP Phase &amp; Pause Stats (Median, TrimMean 10%, Mean) — Last ${newestXSolves.length} vs Session (${count})</span>
              <span class="cfop-averages-hint">Median (1st) · TrimMean 10% (2nd) · Mean (3rd) · Pauses ≥0.40s</span>
            </button>
          </div>
          <div class="stats-subwidget-body">
            <div class="cfop-table-scroll">
              <table class="layer-log-table cfop-avg-comparison-table">
                <thead>
                  <tr>
                    <th scope="col" class="cfop-avg-scope-cell">Scope / Metric</th>
                    <th scope="col">Total</th>
                    <th scope="col" title="Pure smart cube solving time (first turn → solved)">Cube</th>
                    <th scope="col" title="WCA inspection duration before timer start">Insp</th>
                    <th scope="col" title="Time from timer start to first smart cube turn">Pick-up</th>
                    <th scope="col">Cross</th>
                    <th scope="col">F2L 1</th>
                    <th scope="col">F2L 2</th>
                    <th scope="col">F2L 3</th>
                    <th scope="col">F2L 4</th>
                    <th scope="col">F2L &Sigma;</th>
                    <th scope="col">OLL</th>
                    <th scope="col">PLL</th>
                    <th scope="col" title="Time from smart cube solved to timer stop">Put-down</th>
                    <th scope="col">Pauses</th>
                  </tr>
                </thead>
                <tbody>
                  ${renderCfopStatRowHtml(`Last ${newestXSolves.length} · Median`, `(Page ${pageSize})`, lastXAvg.median, lastXAvg.median?.pauseCount, lastXAvg.median?.pauseMs, "cfop-trim-highlight-row")}
                  ${renderCfopStatRowHtml(`Last ${newestXSolves.length} · Trim10%`, `(-top/bot 10%)`, lastXAvg.trimMean, lastXAvg.trimMean?.pauseCount, lastXAvg.trimMean?.pauseMs)}
                  ${renderCfopStatRowHtml(`Last ${newestXSolves.length} · Mean`, ``, lastXAvg, lastXAvg.avgPauseCount, lastXAvg.avgPauseMs)}
                  ${renderCfopStatRowHtml(`Session · Median`, `(${count} solves)`, sessionAvg.median, sessionAvg.median?.pauseCount, sessionAvg.median?.pauseMs, "cfop-trim-highlight-row")}
                  ${renderCfopStatRowHtml(`Session · Trim10%`, `(-top/bot 10%)`, sessionAvg.trimMean, sessionAvg.trimMean?.pauseCount, sessionAvg.trimMean?.pauseMs)}
                  ${renderCfopStatRowHtml(`Session · Mean`, `(${count} solves)`, sessionAvg, sessionAvg.avgPauseCount, sessionAvg.avgPauseMs, "cfop-session-avg-row")}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      `;
    }

    html += `
      <div class="stats-subwidget stats-subwidget-log ${s.solveLogOpen ? "" : "is-collapsed"}" data-stats-widget="solveLog">
        <div class="layer-log-header layer-log-header-bar stats-subwidget-head">
          <button type="button" class="stats-subwidget-toggle" data-stats-collapse="solveLog" aria-expanded="${s.solveLogOpen ? "true" : "false"}">
            <span class="chevron" aria-hidden="true"></span>
            <span class="layer-log-title-wrap">
              <span class="layer-log-title">Solve Log &mdash; ${escapeHtml(sess.name)} (${allReversed.length})</span>
              <span class="layer-log-hint">${is3x3Puzzle ? "Click any column header to sort · Tap any row for full CFOP breakdown &amp; 3D replay" : "Click any column header to sort · Tap any row for solve details"}</span>
            </span>
          </button>
          <div class="layer-log-pagination-controls">
            <label class="pagination-size-group" for="sessionLogPageSizeSelect">
              <span class="pagination-size-label">Show:</span>
              <select id="sessionLogPageSizeSelect" class="pagination-size-select" aria-label="Items per page">
                ${LOG_PAGE_SIZE_OPTIONS.map(sz => `<option value="${sz}" ${pageSize === sz ? "selected" : ""}>${sz}</option>`).join("")}
              </select>
            </label>
            <span class="pagination-status-text">
              <strong>${allReversed.length ? startIdx + 1 : 0}&ndash;${endIdx}</strong> of <strong>${allReversed.length}</strong> (${s.sessionLogPage}/${totalPages})
            </span>
            <div class="pagination-nav-group" role="group" aria-label="Page navigation">
              <button type="button" class="btn btn-xs pagination-nav-btn" id="logPageFirstBtn" ${s.sessionLogPage <= 1 ? "disabled" : ""} title="First page">|&lt;</button>
              <button type="button" class="btn btn-xs pagination-nav-btn" id="logPagePrevBtn" ${s.sessionLogPage <= 1 ? "disabled" : ""} title="Previous page">&lt;</button>
              <button type="button" class="btn btn-xs pagination-nav-btn" id="logPageNextBtn" ${s.sessionLogPage >= totalPages ? "disabled" : ""} title="Next page">&gt;</button>
              <button type="button" class="btn btn-xs pagination-nav-btn" id="logPageLastBtn" ${s.sessionLogPage >= totalPages ? "disabled" : ""} title="Final page">&gt;|</button>
            </div>
          </div>
        </div>
        <div class="stats-subwidget-body">
    `;

    if (is3x3Puzzle) {
      html += `
        <div class="cfop-table-scroll">
          <table class="layer-log-table cfop-solve-log-table">
            <thead>
              <tr>
                <th scope="col" class="sortable" data-log-sort="num" style="width: 42px;">#<span class="sort-icon">${logSortArrow("num")}</span></th>
                <th scope="col" class="sortable" data-log-sort="ms">Time<span class="sort-icon">${logSortArrow("ms")}</span></th>
                <th scope="col" class="sortable" data-log-sort="cubeMs" title="Pure smart cube solving time (first turn → solved)">Cube<span class="sort-icon">${logSortArrow("cubeMs")}</span></th>
                <th scope="col" class="sortable" data-log-sort="inspectionMs" title="Inspection time before timer start">Insp<span class="sort-icon">${logSortArrow("inspectionMs")}</span></th>
                <th scope="col" class="sortable" data-log-sort="pickupMs" title="Timer start → first smart cube turn">Pick-up<span class="sort-icon">${logSortArrow("pickupMs")}</span></th>
                <th scope="col" class="sortable" data-log-sort="cross">Cross<span class="sort-icon">${logSortArrow("cross")}</span></th>
                <th scope="col" class="sortable" data-log-sort="f2l1">F2L 1<span class="sort-icon">${logSortArrow("f2l1")}</span></th>
                <th scope="col" class="sortable" data-log-sort="f2l2">F2L 2<span class="sort-icon">${logSortArrow("f2l2")}</span></th>
                <th scope="col" class="sortable" data-log-sort="f2l3">F2L 3<span class="sort-icon">${logSortArrow("f2l3")}</span></th>
                <th scope="col" class="sortable" data-log-sort="f2l4">F2L 4<span class="sort-icon">${logSortArrow("f2l4")}</span></th>
                <th scope="col" class="sortable" data-log-sort="f2lTotal">F2L &Sigma;<span class="sort-icon">${logSortArrow("f2lTotal")}</span></th>
                <th scope="col" class="sortable" data-log-sort="oll">OLL<span class="sort-icon">${logSortArrow("oll")}</span></th>
                <th scope="col" class="sortable" data-log-sort="pll">PLL<span class="sort-icon">${logSortArrow("pll")}</span></th>
                <th scope="col" class="sortable" data-log-sort="putdownMs" title="Smart cube solved → timer stopped">Put-down<span class="sort-icon">${logSortArrow("putdownMs")}</span></th>
                <th scope="col" class="sortable" data-log-sort="pauseMs" title="Pauses ≥0.40s">Pauses<span class="sort-icon">${logSortArrow("pauseMs")}</span></th>
                <th scope="col" class="sortable" data-log-sort="at" style="width: 52px; text-align: center;">Date<span class="sort-icon">${logSortArrow("at")}</span></th>
                <th scope="col" style="width: 78px;">Actions</th>
              </tr>
            </thead>
            <tbody>
      `;

      if (pageRows.length === 0) {
        html += `<tr><td colspan="17" class="empty-stats" style="text-align: center; padding: 20px;">No solves match filter "${escapeHtml(sessionLogFilter)}".</td></tr>`;
      } else {
        pageRows.forEach(({ s: sv, num, origIdx }) => {
          const cfop = ensureSolveCfop(sv);
          const sp = cfop?.splits || {};
          const ollCase = cfop?.ollCase;
          const pllCase = cfop?.pllCase;
          const pauses = cfop?.pauses;
          const ollCellHtml = sp.oll != null
            ? `<div class="cfop-cell-stack"><span class="cfop-split-val">${formatCfopSplitMs(sp.oll)}</span>${ollCase?.shortName ? `<span class="badge badge-oll-case" title="${escapeHtml(ollCase.name)}">${escapeHtml(ollCase.shortName)}</span>` : ""}</div>`
            : (sv.target === "oll" && sv.id ? `<span class="badge badge-oll-case">${escapeHtml(sv.id)}</span>` : "-");
          const pllCellHtml = sp.pll != null
            ? `<div class="cfop-cell-stack"><span class="cfop-split-val">${formatCfopSplitMs(sp.pll)}</span>${pllCase?.shortName ? `<span class="badge badge-pll-case" title="${escapeHtml(pllCase.name)}">${escapeHtml(pllCase.shortName)}</span>` : ""}</div>`
            : (sv.target === "pll" && sv.id ? `<span class="badge badge-pll-case">${escapeHtml(sv.id)}</span>` : "-");
          const pauseCellHtml = pauses
            ? `<span class="${pauses.totalCount > 0 ? "pause-cell-warn" : "pause-cell-clean"}">${pauses.totalCount} <small>(${formatCfopSplitMs(pauses.totalMs)})</small></span>`
            : "-";
          const hasReplay = Array.isArray(sv.moves) && sv.moves.length > 0;
          const cubeMsVal = getSolveCubeMs(sv);
          html += `
            <tr class="layer-log-row" data-index="${origIdx}" data-num="${num}" title="Click for full CFOP breakdown">
              <td>${num}</td>
              <td class="layer-time-cell"><div class="cfop-cell-stack"><strong>${formatSolveDisplay(sv)}</strong>${sv.tps ? `<small class="cfop-sub-meta">${sv.tps} TPS</small>` : ""}</div></td>
              <td><strong>${formatCfopSplitMs(cubeMsVal)}</strong></td>
              <td>${formatCfopSplitMs(sv.inspectionMs)}</td>
              <td>${formatCfopSplitMs(sv.pickupMs)}</td>
              <td>${formatCfopSplitMs(sp.cross)}</td>
              <td>${formatCfopSplitMs(sp.f2l1)}</td>
              <td>${formatCfopSplitMs(sp.f2l2)}</td>
              <td>${formatCfopSplitMs(sp.f2l3)}</td>
              <td>${formatCfopSplitMs(sp.f2l4)}</td>
              <td><strong>${formatCfopSplitMs(sp.f2lTotal)}</strong></td>
              <td>${ollCellHtml}</td>
              <td>${pllCellHtml}</td>
              <td>${formatCfopSplitMs(sv.putdownMs)}</td>
              <td>${pauseCellHtml}</td>
              <td class="layer-date-cell">${renderSolveDateClockHtml(sv.at)}</td>
              <td>
                <div class="layer-log-actions">
                  ${hasReplay ? `<button type="button" class="btn-replay-solve" data-index="${origIdx}" data-num="${num}" aria-label="Replay solve ${num}" data-tooltip="Replay solve #${num}">${ICON_PLAY}</button>` : ""}
                  <button type="button" class="btn-reattempt-solve" data-index="${origIdx}" data-num="${num}" aria-label="Reattempt solve ${num}" data-tooltip="Reattempt scramble">${ICON_RESET_ANGLE}</button>
                  <button type="button" class="btn-del-solve" data-index="${origIdx}" data-num="${num}" aria-label="Delete solve ${num}" data-tooltip="Delete solve #${num}">&times;</button>
                </div>
              </td>
            </tr>
          `;
        });
      }

      html += `
            </tbody>
            <tfoot>
              <tr class="cfop-tfoot-page-avg cfop-trim-highlight-row">
                <th scope="row">Med</th>
                <td><div class="cfop-cell-stack"><strong>${pageAvg.median?.totalMs != null ? formatSolveTime(pageAvg.median.totalMs) : "-"}</strong><small class="cfop-sub-meta">Page (${pageSolves.length})</small></div></td>
                <td><strong>${formatCfopSplitMs(pageAvg.median?.cubeMs)}</strong></td>
                <td>${formatCfopSplitMs(pageAvg.median?.inspectionMs)}</td>
                <td>${formatCfopSplitMs(pageAvg.median?.pickupMs)}</td>
                <td>${formatCfopSplitMs(pageAvg.median?.cross)}</td>
                <td>${formatCfopSplitMs(pageAvg.median?.f2l1)}</td>
                <td>${formatCfopSplitMs(pageAvg.median?.f2l2)}</td>
                <td>${formatCfopSplitMs(pageAvg.median?.f2l3)}</td>
                <td>${formatCfopSplitMs(pageAvg.median?.f2l4)}</td>
                <td><strong>${formatCfopSplitMs(pageAvg.median?.f2lTotal)}</strong></td>
                <td>${formatCfopSplitMs(pageAvg.median?.oll)}</td>
                <td>${formatCfopSplitMs(pageAvg.median?.pll)}</td>
                <td>${formatCfopSplitMs(pageAvg.median?.putdownMs)}</td>
                <td>${fmtPauseSummary(pageAvg.median?.pauseCount, pageAvg.median?.pauseMs)}</td>
                <td colspan="2"><small class="cfop-sub-meta">Page Median</small></td>
              </tr>
              <tr class="cfop-tfoot-page-avg">
                <th scope="row">Trim</th>
                <td><div class="cfop-cell-stack"><strong>${pageAvg.trimMean?.totalMs != null ? formatSolveTime(pageAvg.trimMean.totalMs) : "-"}</strong><small class="cfop-sub-meta">Trim10%</small></div></td>
                <td><strong>${formatCfopSplitMs(pageAvg.trimMean?.cubeMs)}</strong></td>
                <td>${formatCfopSplitMs(pageAvg.trimMean?.inspectionMs)}</td>
                <td>${formatCfopSplitMs(pageAvg.trimMean?.pickupMs)}</td>
                <td>${formatCfopSplitMs(pageAvg.trimMean?.cross)}</td>
                <td>${formatCfopSplitMs(pageAvg.trimMean?.f2l1)}</td>
                <td>${formatCfopSplitMs(pageAvg.trimMean?.f2l2)}</td>
                <td>${formatCfopSplitMs(pageAvg.trimMean?.f2l3)}</td>
                <td>${formatCfopSplitMs(pageAvg.trimMean?.f2l4)}</td>
                <td><strong>${formatCfopSplitMs(pageAvg.trimMean?.f2lTotal)}</strong></td>
                <td>${formatCfopSplitMs(pageAvg.trimMean?.oll)}</td>
                <td>${formatCfopSplitMs(pageAvg.trimMean?.pll)}</td>
                <td>${formatCfopSplitMs(pageAvg.trimMean?.putdownMs)}</td>
                <td>${fmtPauseSummary(pageAvg.trimMean?.pauseCount, pageAvg.trimMean?.pauseMs)}</td>
                <td colspan="2"><small class="cfop-sub-meta">Page TrimMean 10%</small></td>
              </tr>
              <tr class="cfop-tfoot-page-avg">
                <th scope="row">Mean</th>
                <td><div class="cfop-cell-stack"><strong>${pageAvg.totalMs != null ? formatSolveTime(pageAvg.totalMs) : "-"}</strong><small class="cfop-sub-meta">Page (${pageSolves.length})</small></div></td>
                <td><strong>${formatCfopSplitMs(pageAvg.cubeMs)}</strong></td>
                <td>${formatCfopSplitMs(pageAvg.inspectionMs)}</td>
                <td>${formatCfopSplitMs(pageAvg.pickupMs)}</td>
                <td>${formatCfopSplitMs(pageAvg.cross)}</td>
                <td>${formatCfopSplitMs(pageAvg.f2l1)}</td>
                <td>${formatCfopSplitMs(pageAvg.f2l2)}</td>
                <td>${formatCfopSplitMs(pageAvg.f2l3)}</td>
                <td>${formatCfopSplitMs(pageAvg.f2l4)}</td>
                <td><strong>${formatCfopSplitMs(pageAvg.f2lTotal)}</strong></td>
                <td>${formatCfopSplitMs(pageAvg.oll)}</td>
                <td>${formatCfopSplitMs(pageAvg.pll)}</td>
                <td>${formatCfopSplitMs(pageAvg.putdownMs)}</td>
                <td>${fmtPauseSummary(pageAvg.avgPauseCount, pageAvg.avgPauseMs)}</td>
                <td colspan="2"><small class="cfop-sub-meta">Page Mean</small></td>
              </tr>
              <tr class="cfop-tfoot-session-avg">
                <th scope="row">All</th>
                <td colspan="16">
                  <strong>Median:</strong> ${sessionAvg.median?.totalMs != null ? formatSolveTime(sessionAvg.median.totalMs) : "-"} &bull;
                  <strong>TrimMean (10%):</strong> ${sessionAvg.trimMean?.totalMs != null ? formatSolveTime(sessionAvg.trimMean.totalMs) : "-"} &bull;
                  <strong>Mean:</strong> ${sessionAvg.totalMs != null ? formatSolveTime(sessionAvg.totalMs) : "-"}
                  <small class="cfop-sub-meta">(${count} solves in session)</small>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        </div>
      </div>
      `;
      html += renderOllPllCasesBreakdownHtml(displaySolves, {
        ollOpen: s.ollCasesStatsOpen,
        pllOpen: s.pllCasesStatsOpen,
        sortStateByTrack: ollPllBreakdownSort
      });
    } else {
      html += `
        <div class="cfop-table-scroll">
          <table class="layer-log-table standard-solve-log-table">
            <thead>
              <tr>
                <th scope="col" class="sortable" data-log-sort="num" style="width: 44px;">#<span class="sort-icon">${logSortArrow("num")}</span></th>
                <th scope="col" class="sortable" data-log-sort="ms" style="width: 110px;">Time<span class="sort-icon">${logSortArrow("ms")}</span></th>
                <th scope="col" class="sortable" data-log-sort="cubeMs" style="width: 78px;" title="Pure smart cube solving time (first turn → solved)">Cube<span class="sort-icon">${logSortArrow("cubeMs")}</span></th>
                <th scope="col" class="sortable" data-log-sort="inspectionMs" style="width: 72px;" title="Inspection time before timer start">Insp<span class="sort-icon">${logSortArrow("inspectionMs")}</span></th>
                <th scope="col" class="sortable" data-log-sort="pickupMs" style="width: 78px;" title="Timer start → first smart cube turn">Pick-up<span class="sort-icon">${logSortArrow("pickupMs")}</span></th>
                <th scope="col" class="sortable" data-log-sort="putdownMs" style="width: 78px;" title="Smart cube solved → timer stopped">Put-down<span class="sort-icon">${logSortArrow("putdownMs")}</span></th>
                <th scope="col" class="sortable" data-log-sort="id" style="width: 140px;">Case / Target<span class="sort-icon">${logSortArrow("id")}</span></th>
                <th scope="col">Scramble</th>
                <th scope="col" class="sortable" data-log-sort="at" style="width: 56px; text-align: center;">Date<span class="sort-icon">${logSortArrow("at")}</span></th>
                <th scope="col" style="width: 84px;">Actions</th>
              </tr>
            </thead>
            <tbody>
      `;

      if (pageRows.length === 0) {
        html += `<tr><td colspan="10" class="empty-stats" style="text-align: center; padding: 20px;">No solves match filter "${escapeHtml(sessionLogFilter)}".</td></tr>`;
      } else {
        pageRows.forEach(({ s: sv, num, origIdx }) => {
          const targetBadge = sv.id
            ? `<span class="badge">${escapeHtml(sv.id)}</span>`
            : `<span class="badge badge-subtle">${escapeHtml(getSolveTargetLabel(sv.puzzle || s.currentPuzzle, sv.target))}</span>`;
          const hasReplay = Array.isArray(sv.moves) && sv.moves.length > 0;
          const cubeMsVal = getSolveCubeMs(sv);
          html += `
            <tr class="layer-log-row" data-index="${origIdx}" data-num="${num}" title="Click to view solve details">
              <td>${num}</td>
              <td class="layer-time-cell"><div class="cfop-cell-stack"><strong>${formatSolveDisplay(sv)}</strong>${sv.tps ? `<small class="cfop-sub-meta">${sv.tps} TPS</small>` : ""}</div></td>
              <td><strong>${formatCfopSplitMs(cubeMsVal)}</strong></td>
              <td>${formatCfopSplitMs(sv.inspectionMs)}</td>
              <td>${formatCfopSplitMs(sv.pickupMs)}</td>
              <td>${formatCfopSplitMs(sv.putdownMs)}</td>
              <td>${targetBadge}</td>
              <td class="standard-log-scramble-cell"><code>${escapeHtml(sv.scramble || "-")}</code></td>
              <td class="layer-date-cell">${renderSolveDateClockHtml(sv.at)}</td>
              <td>
                <div class="layer-log-actions">
                  ${hasReplay ? `<button type="button" class="btn-replay-solve" data-index="${origIdx}" data-num="${num}" aria-label="Replay solve ${num}" data-tooltip="Replay solve #${num}">${ICON_PLAY}</button>` : ""}
                  <button type="button" class="btn-reattempt-solve" data-index="${origIdx}" data-num="${num}" aria-label="Reattempt solve ${num}" data-tooltip="Reattempt scramble">${ICON_RESET_ANGLE}</button>
                  <button type="button" class="btn-del-solve" data-index="${origIdx}" data-num="${num}" aria-label="Delete solve ${num}" data-tooltip="Delete solve #${num}">&times;</button>
                </div>
              </td>
            </tr>
          `;
        });
      }

      html += `
            </tbody>
            <tfoot>
              <tr class="cfop-tfoot-page-avg">
                <th scope="row">Page</th>
                <td colspan="9">
                  <strong>Median:</strong> ${pageAvg.median?.totalMs != null ? formatSolveTime(pageAvg.median.totalMs) : "-"} &bull;
                  <strong>TrimMean (10%):</strong> ${pageAvg.trimMean?.totalMs != null ? formatSolveTime(pageAvg.trimMean.totalMs) : "-"} &bull;
                  <strong>Mean:</strong> ${pageAvg.totalMs != null ? formatSolveTime(pageAvg.totalMs) : "-"}
                  <small class="cfop-sub-meta">(${pageSolves.length} solves on page)</small>
                </td>
              </tr>
              <tr class="cfop-tfoot-session-avg">
                <th scope="row">All</th>
                <td colspan="9">
                  <strong>Median:</strong> ${sessionAvg.median?.totalMs != null ? formatSolveTime(sessionAvg.median.totalMs) : "-"} &bull;
                  <strong>TrimMean (10%):</strong> ${sessionAvg.trimMean?.totalMs != null ? formatSolveTime(sessionAvg.trimMean.totalMs) : "-"} &bull;
                  <strong>Mean:</strong> ${sessionAvg.totalMs != null ? formatSolveTime(sessionAvg.totalMs) : "-"}
                  <small class="cfop-sub-meta">(${count} solves in session)</small>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        </div>
      </div>
      `;
    }

    container.innerHTML = html;

    container.querySelectorAll("[data-stats-collapse]").forEach(btn => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.statsCollapse;
        const card = btn.closest(".stats-subwidget");
        if (!key || !card) return;
        let nextOpen = true;
        if (key === "solveLog") nextOpen = s.solveLogOpen = !s.solveLogOpen;
        else if (key === "cfopSummary") nextOpen = s.cfopSummaryOpen = !s.cfopSummaryOpen;
        else if (key === "ollCases") nextOpen = s.ollCasesStatsOpen = !s.ollCasesStatsOpen;
        else if (key === "pllCases") nextOpen = s.pllCasesStatsOpen = !s.pllCasesStatsOpen;
        card.classList.toggle("is-collapsed", !nextOpen);
        btn.setAttribute("aria-expanded", String(nextOpen));
        appStore.saveSettings();
      });
    });

    container.querySelectorAll("th[data-log-sort]").forEach(th => {
      th.addEventListener("click", () => {
        const col = th.dataset.logSort;
        if (!col) return;
        if (sessionLogSort.col === col) sessionLogSort.dir = sessionLogSort.dir === "asc" ? "desc" : "asc";
        else { sessionLogSort.col = col; sessionLogSort.dir = (col === "num" || col === "at") ? "desc" : "asc"; }
        s.sessionLogPage = 1;
        render(container);
      });
    });

    container.querySelectorAll("th[data-breakdown-sort]").forEach(th => {
      th.addEventListener("click", () => {
        const trackId = th.dataset.breakdownTrack || "oll";
        const col = th.dataset.breakdownSort;
        if (!col) return;
        const cur = ollPllBreakdownSort[trackId] || { col: "medianMs", dir: "desc" };
        if (cur.col === col) cur.dir = cur.dir === "asc" ? "desc" : "asc";
        else { cur.col = col; cur.dir = (col === "shortName" || col === "group" || col === "bestMs") ? "asc" : "desc"; }
        ollPllBreakdownSort[trackId] = cur;
        render(container);
      });
    });

    container.querySelectorAll(".stats-subfilter-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        sessionLogFilter = btn.dataset.logFilter || "all";
        s.sessionLogPage = 1;
        render(container);
      });
    });

    const pageSizeSelect = container.querySelector("#sessionLogPageSizeSelect");
    pageSizeSelect?.addEventListener("change", () => {
      const sz = Number(pageSizeSelect.value);
      if (LOG_PAGE_SIZE_OPTIONS.includes(sz)) {
        s.sessionLogPageSize = sz;
        s.sessionLogPage = 1;
        appStore.saveSettings();
        getSolvePanel()?.renderSolvePanel?.();
        render(container);
      }
    });

    container.querySelector("#logPageFirstBtn")?.addEventListener("click", () => { if (s.sessionLogPage > 1) { s.sessionLogPage = 1; render(container); } });
    container.querySelector("#logPagePrevBtn")?.addEventListener("click", () => { if (s.sessionLogPage > 1) { s.sessionLogPage--; render(container); } });
    container.querySelector("#logPageNextBtn")?.addEventListener("click", () => { if (s.sessionLogPage < totalPages) { s.sessionLogPage++; render(container); } });
    container.querySelector("#logPageLastBtn")?.addEventListener("click", () => { if (s.sessionLogPage < totalPages) { s.sessionLogPage = totalPages; render(container); } });

    container.querySelectorAll(".layer-log-row").forEach(row => {
      row.addEventListener("click", (e) => {
        if (e.target.closest(".btn-del-solve, .btn-reattempt-solve, .btn-replay-solve, .solve-date-clock-wrap")) return;
        const solve = sessSolves[Number(row.dataset.index)];
        if (solve) getSolveDetailModal()?.open?.(solve, row.dataset.num);
      });
    });

    container.querySelectorAll(".solve-date-clock-wrap").forEach(wrap => {
      const btn = wrap.querySelector(".btn-solve-date-clock");
      btn?.addEventListener("click", (e) => {
        e.stopPropagation();
        const wasOpen = wrap.classList.contains("is-open");
        container.querySelectorAll(".solve-date-clock-wrap.is-open").forEach(other => {
          if (other !== wrap) other.classList.remove("is-open");
        });
        wrap.classList.toggle("is-open", !wasOpen);
      });
      wrap.addEventListener("mouseleave", () => {
        wrap.classList.remove("is-open");
        if (btn && document.activeElement === btn) btn.blur();
      });
    });

    container.querySelectorAll(".btn-replay-solve").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const solve = sessSolves[Number(btn.dataset.index)];
        if (solve) solveReplayViewer.open(solve, `Solve #${btn.dataset.num} (${sess.name})`);
      });
    });

    container.querySelectorAll(".btn-reattempt-solve").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const solve = sessSolves[Number(btn.dataset.index)];
        if (solve?.scramble) getSolvePanel()?.reattemptScramble?.(solve.scramble, `solve #${btn.dataset.num}`);
      });
    });

    container.querySelectorAll(".btn-del-solve").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const idx = Number(btn.dataset.index);
        const solve = sessSolves[idx];
        if (!solve) return;
        const ok = await modalManager.confirmDialog({
          title: "Delete Solve",
          message: `Delete solve #${btn.dataset.num} (${formatSolveDisplay(solve)})?`,
          confirmLabel: "Delete",
          danger: true
        });
        if (!ok) return;
        const [removed] = sessSolves.splice(idx, 1);
        const fp = getSolveFingerprint(removed);
        if (fp) recordTombstone("solves", fp);
        if (s.lastSolve === solve || (s.lastSolve && s.lastSolve.at === solve.at)) {
          s.lastSolve = sessSolves.length ? sessSolves[sessSolves.length - 1] : null;
        }
        appStore.setSolves(sessSolves);
        getSessionModal()?.populateSessionSelect?.();
        getSolvePanel()?.renderSolvePanel?.();
        render(container);
      });
    });
  }

  return { render };
}
