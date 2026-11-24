// Paginated Full Session Solve Log, CFOP Averages, and OLL/PLL Case Performance View

import { getTrack, getSolveTargetLabel, PUZZLES } from '../../data/algRegistry.js';
import { ollCases } from '../../data/ollData.js';
import { pllCases } from '../../data/pllData.js';
import {
  initCfopAnalyzer,
  ensureSolveCfop,
  computeCfopAverages,
  isCfopAnalyzerReady
} from '../../cfopAnalyzer.js';
import { prewarmOllPllSvgs, isOllPllSvgsPrewarmed } from '../../caseVisualizer.js';
import { getSolveTime } from '../../services/solveStats.js';
import { getSolveFingerprint } from '../../services/syncMerge.js';
import { recordTombstone } from '../../services/syncStorage.js';
import { LOG_PAGE_SIZE_OPTIONS, MAX_DISPLAY_SOLVES } from '../../state/appStore.js';
import { planSessionSplitByTarget } from '../../state/sessionStore.js';
import { showToast } from '../../ui/toastService.js';
import {
  escapeHtml,
  renderSolveDateClockHtml,
  formatSolveTime,
  formatSolveDisplay,
  formatCfopSplitMs
} from '../../services/htmlUtils.js';
import { renderOllPllCasesBreakdownHtml } from '../solve/cfopBreakdownRenderer.js';
import { renderStatsChartsHtml } from './statsChartsView.js';
import { renderCfopGoalCoachHtml } from './cfopGoalCoach.js';
import { ICON_PLAY, ICON_RESET_ANGLE } from '../../ui/transportIcons.js';

export function createSessionLogView({
  appStore,
  modalManager,
  solveReplayViewer,
  getSolveDetailModal = () => null,
  getSolvePanel = () => null,
  getSessionModal = () => null
} = {}) {
  let sessionLogFilter = "all"; // "all" | "target:<targetId>"
  let showAllHistory = false;
  let cfopAvgMetric = "median"; // "median" | "trim" | "mean" | "all"
  const sessionLogSort = { col: "num", dir: "desc" };
  const ollPllBreakdownSort = {
    oll: { col: "medianMs", dir: "desc" },
    pll: { col: "medianMs", dir: "desc" }
  };

  function render(container) {
    if (!container) return;
    const s = appStore.state;
    const is3x3Puzzle = s.currentPuzzle === "333" || s.currentPuzzle === "333oh";
    const isAdvanced = Boolean(s.advancedMode);

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
    const allSessSolves = sess.solves || [];

    if (allSessSolves.length === 0) {
      container.innerHTML = `
        <div class="empty-stats" style="text-align: center; padding: 24px;">
          <p>No solves recorded in <strong>${escapeHtml(sess.name)}</strong> yet.</p>
          <p style="color: var(--muted); font-size: 0.9rem;">Time your solves in the <strong>Solve</strong> tab to build your session history${is3x3Puzzle ? ", CFOP step splits, and OLL/PLL case analytics" : ""}.</p>
        </div>
      `;
      return;
    }

    const isCapped = allSessSolves.length > MAX_DISPLAY_SOLVES && !showAllHistory;
    const windowOffset = isCapped ? (allSessSolves.length - MAX_DISPLAY_SOLVES) : 0;
    const sessSolves = isCapped ? allSessSolves.slice(windowOffset) : allSessSolves;

    const sessPuzzle = sess.puzzle || s.currentPuzzle;
    const targetCounts = new Map();
    for (const sv of sessSolves) {
      const tgt = sv?.target || "full";
      targetCounts.set(tgt, (targetCounts.get(tgt) || 0) + 1);
    }
    const targetBuckets = [...targetCounts.entries()]
      .map(([targetId, tCount]) => ({
        targetId,
        label: getSolveTargetLabel(sessPuzzle, targetId),
        count: tCount
      }))
      .sort((a, b) => b.count - a.count);

    let filterTarget = null;
    if (sessionLogFilter.startsWith("target:")) {
      const requested = sessionLogFilter.slice("target:".length);
      if (targetCounts.has(requested)) filterTarget = requested;
      else sessionLogFilter = "all";
    } else if (sessionLogFilter !== "all") {
      sessionLogFilter = "all";
    }

    const indexedWindow = sessSolves.map((sv, i) => ({
      sv,
      windowNum: windowOffset + i + 1,
      origIdx: windowOffset + i
    }));
    const filteredEntries = filterTarget
      ? indexedWindow.filter(e => (e.sv?.target || "full") === filterTarget)
      : indexedWindow;
    const displaySolves = filteredEntries.map(e => e.sv);

    if (is3x3Puzzle) {
      displaySolves.forEach(sv => ensureSolveCfop(sv));
    }

    const count = displaySolves.length;



    const allIndexed = filteredEntries.map((e, idx) => ({
      s: e.sv,
      num: filterTarget ? (idx + 1) : e.windowNum,
      origIdx: e.origIdx
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
    const newestFirstSolves = [...allIndexed].reverse().map(r => r.s);
    const last5Avg = displaySolves.length >= 5 ? computeCfopAverages(newestFirstSolves.slice(0, 5)) : null;
    const last12Avg = displaySolves.length >= 12 ? computeCfopAverages(newestFirstSolves.slice(0, 12)) : null;
    const last100Avg = displaySolves.length >= 100 ? computeCfopAverages(newestFirstSolves.slice(0, 100)) : null;
    const pageAvg = computeCfopAverages(pageSolves);
    const sessionAvg = computeCfopAverages(displaySolves);
    const fmtPauseSummary = (countVal, msVal) => countVal == null ? "-" : `${countVal} (${formatCfopSplitMs(msVal || 0)})`;

    const activeFilterLabel = filterTarget ? getSolveTargetLabel(sessPuzzle, filterTarget) : "All Solves";
    const hasMultipleTargets = targetBuckets.length >= 2;
    const capControlHtml = allSessSolves.length > MAX_DISPLAY_SOLVES
      ? `<button type="button" id="toggleHistoryCapBtn" class="stats-subfilter-action-btn" title="Show up to ${MAX_DISPLAY_SOLVES.toLocaleString()} most recent solves for speed, or expand all ${allSessSolves.length.toLocaleString()} stored solves">${isCapped ? `Latest ${MAX_DISPLAY_SOLVES.toLocaleString()} of ${allSessSolves.length.toLocaleString()} &middot; Show All` : `Showing all ${allSessSolves.length.toLocaleString()} &middot; Cap at ${MAX_DISPLAY_SOLVES.toLocaleString()}`}</button>`
      : "";
    const splitBtnHtml = hasMultipleTargets
      ? `<button type="button" id="splitSessionByTargetBtn" class="stats-subfilter-action-btn stats-split-session-btn" title="Move solves with different targets out of this mixed session into their own dedicated sessions">✂️ Split by Target</button>`
      : "";

    let html = `
      <div class="stats-subfilter-bar">
        <span class="stats-subfilter-label">Filter:</span>
        <button type="button" class="stats-subfilter-btn ${sessionLogFilter === "all" ? "active" : ""}" data-log-filter="all">All (${sessSolves.length.toLocaleString()})</button>
        ${targetBuckets.map(b => {
          const filterKey = `target:${b.targetId}`;
          return `<button type="button" class="stats-subfilter-btn ${sessionLogFilter === filterKey ? "active" : ""}" data-log-filter="${escapeHtml(filterKey)}">${escapeHtml(b.label)} (${b.count.toLocaleString()})</button>`;
        }).join("")}
        ${(capControlHtml || splitBtnHtml) ? `<span class="stats-subfilter-actions">${capControlHtml}${splitBtnHtml}</span>` : ""}
      </div>
    `;

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

    let cfopScopes = [];
    if (is3x3Puzzle && isAdvanced) {
      if (last5Avg) cfopScopes.push({ id: "last5", title: "Last 5", meta: "(5 solves)", avg: last5Avg, rowClass: "" });
      if (last12Avg) cfopScopes.push({ id: "last12", title: "Last 12", meta: "(12 solves)", avg: last12Avg, rowClass: "" });
      if (last100Avg) cfopScopes.push({ id: "last100", title: "Last 100", meta: "(100 solves)", avg: last100Avg, rowClass: "" });
      cfopScopes.push({
        id: "session",
        title: "Session",
        meta: `(${count.toLocaleString()} ${count === 1 ? "solve" : "solves"})`,
        avg: sessionAvg,
        rowClass: "cfop-session-avg-row"
      });
    }

    if (isAdvanced && displaySolves.length >= 2) {
      html += renderStatsChartsHtml(displaySolves, {
        is3x3: is3x3Puzzle,
        isOpen: s.chartsStatsOpen,
        cfopScopes
      });
    }

    if (is3x3Puzzle && isAdvanced && displaySolves.length >= 3) {
      html += renderCfopGoalCoachHtml(displaySolves, {
        goalSec: s.cfopGoalSec || 12,
        isOpen: s.goalCoachOpen
      });
    }

    if (is3x3Puzzle && isAdvanced) {

      const metricLabels = {
        median: "Median",
        trim: "TrimMean 10%",
        mean: "Mean",
        all: "Median, TrimMean 10%, Mean"
      };
      const metricHeading = metricLabels[cfopAvgMetric] || "Median";

      const cfopRowsHtml = cfopScopes.map(scope => {
        const rows = [];
        if (cfopAvgMetric === "median" || cfopAvgMetric === "all") {
          const label = cfopAvgMetric === "all" ? `${scope.title} &middot; Median` : scope.title;
          rows.push(renderCfopStatRowHtml(label, scope.meta, scope.avg.median, scope.avg.median?.pauseCount, scope.avg.median?.pauseMs, cfopAvgMetric === "all" ? "cfop-trim-highlight-row" : scope.rowClass));
        }
        if (cfopAvgMetric === "trim" || cfopAvgMetric === "all") {
          const label = cfopAvgMetric === "all" ? `${scope.title} &middot; Trim10%` : scope.title;
          const meta = cfopAvgMetric === "all" ? "(-top/bot 10%)" : scope.meta;
          rows.push(renderCfopStatRowHtml(label, meta, scope.avg.trimMean, scope.avg.trimMean?.pauseCount, scope.avg.trimMean?.pauseMs, cfopAvgMetric === "trim" ? scope.rowClass : ""));
        }
        if (cfopAvgMetric === "mean" || cfopAvgMetric === "all") {
          const label = cfopAvgMetric === "all" ? `${scope.title} &middot; Mean` : scope.title;
          rows.push(renderCfopStatRowHtml(label, scope.meta, scope.avg, scope.avg.avgPauseCount, scope.avg.avgPauseMs, scope.rowClass));
        }
        return rows.join("");
      }).join("");

      html += `
        <div class="cfop-averages-summary-card stats-subwidget ${s.cfopSummaryOpen ? "" : "is-collapsed"}" data-stats-widget="cfopSummary">
          <div class="cfop-averages-head stats-subwidget-head">
            <button type="button" class="stats-subwidget-toggle" data-stats-collapse="cfopSummary" aria-expanded="${s.cfopSummaryOpen ? "true" : "false"}">
              <span class="chevron" aria-hidden="true"></span>
              <span class="cfop-averages-title">CFOP Phase &amp; Pause Stats &mdash; ${metricHeading} (${escapeHtml(sess.name)} &middot; ${escapeHtml(activeFilterLabel)} &middot; ${count.toLocaleString()})</span>
              <span class="cfop-averages-hint">Last 5 &middot; Last 12 &middot; Last 100 &middot; Session &middot; Pauses &ge;0.40s</span>
            </button>
            <div class="cfop-metric-pills" role="group" aria-label="CFOP summary metric">
              ${[
                { id: "median", label: "Median" },
                { id: "trim", label: "Trim 10%" },
                { id: "mean", label: "Mean" },
                { id: "all", label: "All" }
              ].map(opt => `<button type="button" class="cfop-metric-pill ${cfopAvgMetric === opt.id ? "active" : ""}" data-cfop-metric="${opt.id}" aria-pressed="${cfopAvgMetric === opt.id ? "true" : "false"}">${opt.label}</button>`).join("")}
            </div>
          </div>
          <div class="stats-subwidget-body">
            <div class="cfop-table-scroll">
              <table class="layer-log-table cfop-avg-comparison-table">
                <thead>
                  <tr>
                    <th scope="col" class="cfop-avg-scope-cell">${cfopAvgMetric === "all" ? "Scope / Metric" : "Scope"}</th>
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
                  ${cfopRowsHtml}
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
              <span class="layer-log-title">Solve Log &mdash; ${escapeHtml(sess.name)} (${allReversed.length.toLocaleString()}${isCapped ? ` of ${allSessSolves.length.toLocaleString()} total` : ""})</span>
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

    if (is3x3Puzzle && !isAdvanced) {
      html += `
        <div class="cfop-table-scroll">
          <table class="layer-log-table cfop-solve-log-table is-basic-log">
            <thead>
              <tr>
                <th scope="col" class="sortable" data-log-sort="num" style="width: 42px;">#<span class="sort-icon">${logSortArrow("num")}</span></th>
                <th scope="col" class="sortable" data-log-sort="ms">Time<span class="sort-icon">${logSortArrow("ms")}</span></th>
                <th scope="col" class="sortable" data-log-sort="cross">Cross<span class="sort-icon">${logSortArrow("cross")}</span></th>
                <th scope="col" class="sortable" data-log-sort="f2lTotal">F2L<span class="sort-icon">${logSortArrow("f2lTotal")}</span></th>
                <th scope="col" class="sortable" data-log-sort="oll">OLL<span class="sort-icon">${logSortArrow("oll")}</span></th>
                <th scope="col" class="sortable" data-log-sort="pll">PLL<span class="sort-icon">${logSortArrow("pll")}</span></th>
                <th scope="col" style="width: 78px;">Actions</th>
              </tr>
            </thead>
            <tbody>
      `;

      if (pageRows.length === 0) {
        html += `<tr><td colspan="7" class="empty-stats" style="text-align: center; padding: 20px;">No solves match filter "${escapeHtml(sessionLogFilter)}".</td></tr>`;
      } else {
        pageRows.forEach(({ s: sv, num, origIdx }) => {
          const cfop = ensureSolveCfop(sv);
          const sp = cfop?.splits || {};
          const ollText = sp.oll != null
            ? formatCfopSplitMs(sp.oll)
            : (sv.target === "oll" && sv.id ? escapeHtml(sv.id) : "-");
          const pllText = sp.pll != null
            ? formatCfopSplitMs(sp.pll)
            : (sv.target === "pll" && sv.id ? escapeHtml(sv.id) : "-");
          const hasReplay = Array.isArray(sv.moves) && sv.moves.length > 0;
          html += `
            <tr class="layer-log-row" data-index="${origIdx}" data-num="${num}" title="Click for solve breakdown">
              <td>${num}</td>
              <td class="layer-time-cell"><strong>${formatSolveDisplay(sv)}</strong></td>
              <td>${formatCfopSplitMs(sp.cross)}</td>
              <td><strong>${formatCfopSplitMs(sp.f2lTotal)}</strong></td>
              <td>${ollText}</td>
              <td>${pllText}</td>
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
                <td><strong>${pageAvg.median?.totalMs != null ? formatSolveTime(pageAvg.median.totalMs) : "-"}</strong></td>
                <td>${formatCfopSplitMs(pageAvg.median?.cross)}</td>
                <td><strong>${formatCfopSplitMs(pageAvg.median?.f2lTotal)}</strong></td>
                <td>${formatCfopSplitMs(pageAvg.median?.oll)}</td>
                <td>${formatCfopSplitMs(pageAvg.median?.pll)}</td>
                <td><small class="cfop-sub-meta">Page (${pageSolves.length})</small></td>
              </tr>
              <tr class="cfop-tfoot-session-avg">
                <th scope="row">All</th>
                <td colspan="6">
                  <strong>Median:</strong> ${sessionAvg.median?.totalMs != null ? formatSolveTime(sessionAvg.median.totalMs) : "-"} &bull;
                  <strong>Mean:</strong> ${sessionAvg.totalMs != null ? formatSolveTime(sessionAvg.totalMs) : "-"}
                  <small class="cfop-sub-meta">(${count.toLocaleString()} solves in session)</small>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        </div>
      </div>
      `;
    } else if (is3x3Puzzle) {
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
      if (isAdvanced) {
        html += renderOllPllCasesBreakdownHtml(displaySolves, {
          ollOpen: s.ollCasesStatsOpen,
          pllOpen: s.pllCasesStatsOpen,
          sortStateByTrack: ollPllBreakdownSort,
          caseTags: s.caseTags || {}
        });
      }
    } else if (!isAdvanced) {
      html += `
        <div class="cfop-table-scroll">
          <table class="layer-log-table standard-solve-log-table is-basic-log">
            <thead>
              <tr>
                <th scope="col" class="sortable" data-log-sort="num" style="width: 44px;">#<span class="sort-icon">${logSortArrow("num")}</span></th>
                <th scope="col" class="sortable" data-log-sort="ms" style="width: 110px;">Time<span class="sort-icon">${logSortArrow("ms")}</span></th>
                <th scope="col" class="sortable" data-log-sort="id" style="width: 140px;">Case / Target<span class="sort-icon">${logSortArrow("id")}</span></th>
                <th scope="col">Scramble</th>
                <th scope="col" style="width: 84px;">Actions</th>
              </tr>
            </thead>
            <tbody>
      `;

      if (pageRows.length === 0) {
        html += `<tr><td colspan="5" class="empty-stats" style="text-align: center; padding: 20px;">No solves match filter "${escapeHtml(sessionLogFilter)}".</td></tr>`;
      } else {
        pageRows.forEach(({ s: sv, num, origIdx }) => {
          const targetBadge = sv.id
            ? `<span class="badge">${escapeHtml(sv.id)}</span>`
            : `<span class="badge badge-subtle">${escapeHtml(getSolveTargetLabel(sv.puzzle || s.currentPuzzle, sv.target))}</span>`;
          const hasReplay = Array.isArray(sv.moves) && sv.moves.length > 0;
          html += `
            <tr class="layer-log-row" data-index="${origIdx}" data-num="${num}" title="Click to view solve details">
              <td>${num}</td>
              <td class="layer-time-cell"><strong>${formatSolveDisplay(sv)}</strong></td>
              <td>${targetBadge}</td>
              <td class="standard-log-scramble-cell"><code>${escapeHtml(sv.scramble || "-")}</code></td>
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
                <td colspan="4">
                  <strong>Median:</strong> ${pageAvg.median?.totalMs != null ? formatSolveTime(pageAvg.median.totalMs) : "-"} &bull;
                  <strong>Mean:</strong> ${pageAvg.totalMs != null ? formatSolveTime(pageAvg.totalMs) : "-"}
                  <small class="cfop-sub-meta">(${pageSolves.length} solves on page)</small>
                </td>
              </tr>
              <tr class="cfop-tfoot-session-avg">
                <th scope="row">All</th>
                <td colspan="4">
                  <strong>Median:</strong> ${sessionAvg.median?.totalMs != null ? formatSolveTime(sessionAvg.median.totalMs) : "-"} &bull;
                  <strong>Mean:</strong> ${sessionAvg.totalMs != null ? formatSolveTime(sessionAvg.totalMs) : "-"}
                  <small class="cfop-sub-meta">(${count.toLocaleString()} solves in session)</small>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        </div>
      </div>
      `;
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

    container.querySelectorAll("[data-cfop-metric]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const nextMetric = btn.dataset.cfopMetric;
        if (!nextMetric || nextMetric === cfopAvgMetric) return;
        cfopAvgMetric = nextMetric;
        render(container);
      });
    });

    container.querySelectorAll("[data-cfop-goal]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const nextGoal = Number(btn.dataset.cfopGoal);
        if (!nextGoal || nextGoal === Number(s.cfopGoalSec)) return;
        s.cfopGoalSec = nextGoal;
        appStore.saveSettings();
        render(container);
      });
    });

    container.querySelectorAll("[data-stats-collapse]").forEach(btn => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.statsCollapse;
        const card = btn.closest(".stats-subwidget");
        if (!key || !card) return;
        let nextOpen = true;
        if (key === "solveLog") nextOpen = s.solveLogOpen = !s.solveLogOpen;
        else if (key === "charts") nextOpen = s.chartsStatsOpen = !s.chartsStatsOpen;
        else if (key === "goalCoach") nextOpen = s.goalCoachOpen = !s.goalCoachOpen;
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

    container.querySelectorAll(".cfop-case-tag-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const caseId = btn.dataset.caseTagId;
        if (!caseId) return;
        appStore.cycleCaseTag(caseId);
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

    container.querySelector("#toggleHistoryCapBtn")?.addEventListener("click", () => {
      showAllHistory = !showAllHistory;
      s.sessionLogPage = 1;
      render(container);
    });

    container.querySelector("#splitSessionByTargetBtn")?.addEventListener("click", async () => {
      const puzzle = sess.puzzle || s.currentPuzzle || "222";
      const puzzleShortName = PUZZLES[puzzle]?.shortName || puzzle;
      const plan = planSessionSplitByTarget(s.sessions, sess.id, {
        puzzleShortName,
        getTargetLabel: (t) => getSolveTargetLabel(puzzle, t)
      });
      if (!plan.canSplit) return;
      const destLines = plan.destinations
        .map(d => `- Move ${d.count} "${d.targetLabel}" solve${d.count === 1 ? "" : "s"} -> ${d.action === "merge" ? "existing session" : "new session"} "${d.sessionName}"`)
        .join("\n");
      const ok = await modalManager.confirmDialog({
        title: "Split Mixed Session by Target",
        message: `"${sess.name}" mixes multiple solve targets.\n\nKeep ${plan.keepCount} "${plan.keepTargetLabel}" solve${plan.keepCount === 1 ? "" : "s"} in "${sess.name}":\n${destLines}`,
        confirmLabel: `Split ${plan.movedCount} Solve${plan.movedCount === 1 ? "" : "s"}`
      });
      if (!ok) return;
      const res = appStore.splitSessionByTarget(sess.id);
      if (!res?.canSplit) return;
      sessionLogFilter = "all";
      s.sessionLogPage = 1;
      getSessionModal()?.populateSessionSelect?.();
      getSolvePanel()?.renderSolvePanel?.();
      render(container);
      showToast(`Split ${res.movedCount} solve${res.movedCount === 1 ? "" : "s"} into ${res.destinations.length} target session${res.destinations.length === 1 ? "" : "s"}.`, "success", 3200);
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
        const solve = allSessSolves[Number(row.dataset.index)];
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
        const solve = allSessSolves[Number(btn.dataset.index)];
        if (solve) solveReplayViewer.open(solve, `Solve #${btn.dataset.num} (${sess.name})`);
      });
    });

    container.querySelectorAll(".btn-reattempt-solve").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const solve = allSessSolves[Number(btn.dataset.index)];
        if (solve?.scramble) getSolvePanel()?.reattemptScramble?.(solve.scramble, `solve #${btn.dataset.num}`);
      });
    });

    container.querySelectorAll(".btn-del-solve").forEach(btn => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const idx = Number(btn.dataset.index);
        const solve = allSessSolves[idx];
        if (!solve) return;
        const ok = await modalManager.confirmDialog({
          title: "Delete Solve",
          message: `Delete solve #${btn.dataset.num} (${formatSolveDisplay(solve)})?`,
          confirmLabel: "Delete",
          danger: true
        });
        if (!ok) return;
        const [removed] = allSessSolves.splice(idx, 1);
        const fp = getSolveFingerprint(removed);
        if (fp) recordTombstone("solves", fp);
        if (s.lastSolve === solve || (s.lastSolve && s.lastSolve.at === solve.at)) {
          s.lastSolve = allSessSolves.length ? allSessSolves[allSessSolves.length - 1] : null;
        }
        appStore.setSolves(allSessSolves);
        getSessionModal()?.populateSessionSelect?.();
        getSolvePanel()?.renderSolvePanel?.();
        render(container);
      });
    });
  }

  return { render };
}
