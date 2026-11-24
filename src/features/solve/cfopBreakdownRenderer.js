// Pure HTML renderers for CFOP split breakdown tables, OLL/PLL per-case stats, and GAN phase inline summaries

import { ensureSolveCfop, computeOllPllCaseStats } from '../../cfopAnalyzer.js';
import { getCachedCaseSvg } from '../../caseVisualizer.js';
import { escapeHtml, formatCfopSplitMs } from '../../services/htmlUtils.js';

export function renderSolvePhaseInline(solve) {
  if (!solve || (solve.inspectionMs == null && solve.pickupMs == null && solve.putdownMs == null)) return "";
  const parts = [];
  if (solve.inspectionMs != null) parts.push(`insp <strong>${formatCfopSplitMs(solve.inspectionMs)}</strong>`);
  if (solve.pickupMs != null) parts.push(`pick-up <strong>${formatCfopSplitMs(solve.pickupMs)}</strong>`);
  if (solve.putdownMs != null) parts.push(`put-down <strong>${formatCfopSplitMs(solve.putdownMs)}</strong>`);
  return `<span class="solve-phase-inline" title="Measured across inspection, timer, and smart cube events">⏱ ${parts.join(" · ")}</span>`;
}

export function renderCfopStepTable(solve, { detailed = false, basic = false, refMedians = null } = {}) {
  const cfop = ensureSolveCfop(solve);
  if (!cfop || (!cfop.steps?.length && !cfop.splits)) return "";

  const realSteps = (cfop.steps || []);
  if (realSteps.length === 0) return "";

  const hasPickup = typeof solve.pickupMs === "number" && Number.isFinite(solve.pickupMs);
  const hasPutdown = typeof solve.putdownMs === "number" && Number.isFinite(solve.putdownMs);
  const pickupOffset = hasPickup ? solve.pickupMs : 0;

  const totalRecogMs = realSteps.reduce((acc, s) => acc + (s.phase === "cross" ? 0 : (s.recogMs || 0)), 0);
  const totalExecMs = realSteps.reduce((acc, s) => acc + (s.execMs || 0), 0);
  const stepsTotalMs = realSteps.reduce((acc, s) => acc + (s.ms || 0), 0);
  const cubeSolveMs = typeof solve.cubeMs === "number" && Number.isFinite(solve.cubeMs) ? solve.cubeMs : stepsTotalMs;
  const solveMs = solve.rawMs ?? solve.ms ?? (pickupOffset + cubeSolveMs + (hasPutdown ? solve.putdownMs : 0));
  const totalMoves = solve.moveCount ?? realSteps.reduce((acc, s) => acc + (s.moveCount || 0), 0);
  const pCnt = cfop.pauses?.totalCount || 0;
  const pMs = cfop.pauses?.totalMs || 0;

  const phaseRefKeyMap = {
    pickup: "pickupMs",
    cross: "cross",
    f2l1: "f2l1",
    f2l2: "f2l2",
    f2l3: "f2l3",
    f2l4: "f2l4",
    f2lTotal: "f2lTotal",
    oll: "oll",
    pll: "pll",
    auf: "auf",
    cubeTotal: "cubeMs",
    putdown: "putdownMs",
    solveTotal: "totalMs"
  };
  const getSplitCompareMeta = (phaseKey, valMs) => {
    if (!refMedians || typeof valMs !== "number" || !Number.isFinite(valMs)) {
      return { cls: "", titleAttr: "" };
    }
    const refKey = phaseRefKeyMap[phaseKey];
    const refVal = refKey ? refMedians[refKey] : null;
    if (typeof refVal !== "number" || !Number.isFinite(refVal)) {
      return { cls: "", titleAttr: "" };
    }
    if (valMs < refVal) {
      return {
        cls: "cfop-split-faster",
        titleAttr: ` title="${escapeHtml(`Faster than median (${formatCfopSplitMs(refVal)})`)}"`
      };
    }
    if (valMs > refVal) {
      return {
        cls: "cfop-split-slower",
        titleAttr: ` title="${escapeHtml(`Slower than median (${formatCfopSplitMs(refVal)})`)}"`
      };
    }
    return { cls: "", titleAttr: "" };
  };

  const displayRows = [];
  if (hasPickup) {
    displayRows.push({
      phase: "pickup",
      label: "Pick-up",
      caseId: solve.timer || "Timer",
      recogMs: null,
      setupMoves: "",
      execMs: null,
      ms: solve.pickupMs,
      accumMs: solve.pickupMs,
      moveCount: null,
      pauseCount: 0,
      pauseMs: 0,
      execMoves: ""
    });
  }
  for (const st of realSteps) {
    displayRows.push({
      ...st,
      accumMs: st.accumMs != null ? st.accumMs + pickupOffset : null
    });
    if (st.phase === "f2l4" && cfop.f2lSummary) {
      displayRows.push({
        ...cfop.f2lSummary,
        accumMs: cfop.f2lSummary.accumMs != null ? cfop.f2lSummary.accumMs + pickupOffset : null
      });
    }
    if (st.phase === "pll" && cfop.aufSummary) {
      displayRows.push({
        ...cfop.aufSummary,
        accumMs: cfop.aufSummary.accumMs != null ? cfop.aufSummary.accumMs + pickupOffset : null
      });
    }
  }
  if (hasPickup || hasPutdown) {
    displayRows.push({
      phase: "cubeTotal",
      label: "Cube Solve",
      caseId: solve.smartCube || "Smart Cube",
      recogMs: totalRecogMs,
      setupMoves: "",
      execMs: totalExecMs,
      ms: cubeSolveMs,
      accumMs: pickupOffset + cubeSolveMs,
      moveCount: totalMoves,
      tps: solve.tps,
      pauseCount: pCnt,
      pauseMs: pMs,
      execMoves: ""
    });
  }
  if (hasPutdown) {
    displayRows.push({
      phase: "putdown",
      label: "Put-down",
      caseId: solve.timer || "Timer",
      recogMs: null,
      setupMoves: "",
      execMs: null,
      ms: solve.putdownMs,
      accumMs: solveMs,
      moveCount: null,
      pauseCount: 0,
      pauseMs: 0,
      execMoves: ""
    });
  }

  const rowsHtml = displayRows.map(row => {
    const isSummaryRow = row.phase === "f2lTotal" || row.phase === "cubeTotal" || row.phase === "auf";
    const isHandlingRow = row.phase === "pickup" || row.phase === "putdown";
    let stepBadgeClass = "cfop-step-badge-default";
    if (row.phase === "f2lTotal" || row.phase === "cubeTotal") stepBadgeClass = "cfop-step-badge-f2lsum";
    else if (row.phase === "auf") stepBadgeClass = "cfop-step-badge-auf";
    else if (row.phase === "oll") stepBadgeClass = "cfop-step-badge-oll";
    else if (row.phase === "pll") stepBadgeClass = "cfop-step-badge-pll";
    else if (row.phase === "cross") stepBadgeClass = "cfop-step-badge-cross";

    const splitCmp = getSplitCompareMeta(row.phase, row.ms);
    const totalTxt = `<strong>${formatCfopSplitMs(row.ms)}</strong>`;
    const accumTxt = formatCfopSplitMs(row.accumMs);

    if (basic) {
      return `
        <tr class="cfop-step-row cfop-row-${row.phase} ${isSummaryRow ? "cfop-row-f2l-summary" : ""}">
          <td class="cfop-col-step"><span class="cfop-step-badge ${stepBadgeClass}">${escapeHtml(row.label)}</span></td>
          <td class="cfop-col-total ${splitCmp.cls}"${splitCmp.titleAttr}>${totalTxt}</td>
          <td class="cfop-col-accum">${accumTxt}</td>
        </tr>
      `;
    }

    let caseDisplay = escapeHtml(row.caseId || "-");
    if (row.phase === "oll" && row.caseId && row.caseId !== "-") {
      const fullTitle = cfop.ollCase?.name ? ` title="${escapeHtml(cfop.ollCase.name)}"` : "";
      caseDisplay = `<span class="badge badge-oll-case"${fullTitle}>${escapeHtml(row.caseId)}</span>`;
    } else if (row.phase === "pll" && row.caseId && row.caseId !== "-") {
      const fullTitle = cfop.pllCase?.name ? ` title="${escapeHtml(cfop.pllCase.name)}"` : "";
      caseDisplay = `<span class="badge badge-pll-case"${fullTitle}>${escapeHtml(row.caseId)}</span>`;
    } else if (row.phase.startsWith("f2l") && row.phase !== "f2lTotal") {
      caseDisplay = `<span class="cfop-slot-tag">${escapeHtml(row.caseId || "-")}</span>`;
    } else if (row.phase === "auf") {
      caseDisplay = row.caseId && row.caseId !== "None"
        ? `<code class="cfop-setup-code">${escapeHtml(row.caseId)}</code>`
        : `<span class="cfop-slot-tag">None</span>`;
    } else if (isHandlingRow || row.phase === "cubeTotal") {
      caseDisplay = `<span class="cfop-slot-tag">${escapeHtml(row.caseId || "-")}</span>`;
    }

    const recogTxt = (row.phase === "cross" || row.phase === "auf" || isHandlingRow)
      ? `<span class="cfop-muted-dash">-</span>`
      : formatCfopSplitMs(row.recogMs);

    const setupTxt = row.setupMoves
      ? `<code class="cfop-setup-code">${escapeHtml(row.setupMoves)}</code>`
      : `<span class="cfop-muted-dash">-</span>`;

    const execTxt = isHandlingRow
      ? `<span class="cfop-muted-dash">-</span>`
      : formatCfopSplitMs(row.execMs);

    const movesTxt = row.moveCount != null
      ? `${row.moveCount}${detailed && row.tps ? ` <small class="cfop-sub-meta">(${row.tps} TPS)</small>` : ""}`
      : "-";

    const pauseTxt = isHandlingRow
      ? `<span class="cfop-muted-dash">-</span>`
      : (row.pauseCount > 0
          ? `<span class="pause-cell-warn">${row.pauseCount} <small>(${formatCfopSplitMs(row.pauseMs)})</small></span>`
          : `<span class="pause-cell-clean">0</span>`);

    const reconStr = row.execMoves || row.moves || "";
    const reconTxt = (isSummaryRow || isHandlingRow)
      ? `<span class="cfop-muted-dash">-</span>`
      : (reconStr ? `<code class="cfop-recon-code">${escapeHtml(reconStr)}</code>` : `<span class="cfop-muted-dash">-</span>`);

    return `
      <tr class="cfop-step-row cfop-row-${row.phase} ${isSummaryRow ? "cfop-row-f2l-summary" : ""}">
        <td class="cfop-col-step"><span class="cfop-step-badge ${stepBadgeClass}">${escapeHtml(row.label)}</span></td>
        <td class="cfop-col-case">${caseDisplay}</td>
        <td class="cfop-col-recog">${recogTxt}</td>
        <td class="cfop-col-setup">${setupTxt}</td>
        <td class="cfop-col-exec">${execTxt}</td>
        <td class="cfop-col-total ${splitCmp.cls}"${splitCmp.titleAttr}>${totalTxt}</td>
        <td class="cfop-col-accum">${accumTxt}</td>
        <td class="cfop-col-moves">${movesTxt}</td>
        <td class="cfop-col-pauses">${pauseTxt}</td>
        <td class="cfop-col-recon">${reconTxt}</td>
      </tr>
    `;
  }).join("");

  const totalSolveCmp = getSplitCompareMeta("solveTotal", solveMs);

  if (basic) {
    return `
      <div class="cfop-step-table-wrap cfop-step-table-basic">
        <table class="cfop-step-breakdown-table">
          <thead>
            <tr>
              <th scope="col">Step</th>
              <th scope="col" title="Time for this step">Total</th>
              <th scope="col" title="Accumulated solve time after this step">Accum</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
          <tfoot>
            <tr class="cfop-step-tfoot-row">
              <th scope="row">Solve Total</th>
              <td class="${totalSolveCmp.cls}"${totalSolveCmp.titleAttr}><strong>${formatCfopSplitMs(solveMs)}</strong></td>
              <td><strong>${formatCfopSplitMs(solveMs)}</strong></td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;
  }

  return `
    <div class="cfop-step-table-wrap ${detailed ? "cfop-step-table-detailed" : "cfop-step-table-base"}">
      <table class="cfop-step-breakdown-table">
        <thead>
          <tr>
            <th scope="col">Step</th>
            <th scope="col">Case</th>
            <th scope="col" title="Recognition + pre-AUF time">Recog</th>
            <th scope="col" title="Pre-AUF / rotation setup moves (e.g. U, U', U2)">Setup</th>
            <th scope="col" title="Execution time after recognition">Exec</th>
            <th scope="col" title="Total time for this step (Recog + Exec)">Total</th>
            <th scope="col" title="Total accumulated solve time after this step">Accum</th>
            <th scope="col">Moves</th>
            <th scope="col" title="Pauses ≥0.40s during this step">Pauses</th>
            <th scope="col" class="cfop-th-recon">Recon</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
        <tfoot>
          <tr class="cfop-step-tfoot-row">
            <th scope="row" colspan="2">Solve Total</th>
            <td>${formatCfopSplitMs(totalRecogMs)}</td>
            <td><span class="cfop-muted-dash">-</span></td>
            <td>${formatCfopSplitMs(totalExecMs)}</td>
            <td class="${totalSolveCmp.cls}"${totalSolveCmp.titleAttr}><strong>${formatCfopSplitMs(solveMs)}</strong></td>
            <td><strong>${formatCfopSplitMs(solveMs)}</strong></td>
            <td><strong>${totalMoves}</strong>${solve.tps ? ` <small class="cfop-sub-meta">(${solve.tps} TPS)</small>` : ""}</td>
            <td>
              <span class="cfop-step-badge ${pCnt > 0 ? "cfop-step-badge-pause" : "cfop-step-badge-default"}">
                ${pCnt} (${formatCfopSplitMs(pMs)})
              </span>
            </td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>
  `;
}

export function renderLastSolveCfopInline(solve, { basic = false, refMedians = null } = {}) {
  return renderCfopStepTable(solve, { detailed: false, basic, refMedians });
}

export function renderOllPllCasesBreakdownHtml(solvesList, { ollOpen = true, pllOpen = true, sortStateByTrack = {} } = {}) {
  const { ollCases: ollStats, pllCases: pllStats } = computeOllPllCaseStats(solvesList);

  const renderCaseSubTable = (title, subtitle, items, badgeClass, trackId, isOpen) => {
    const collapseKey = trackId === "oll" ? "ollCases" : "pllCases";
    if (!items || items.length === 0) {
      return `
        <div class="cfop-case-breakdown-card stats-subwidget ${isOpen ? "" : "is-collapsed"}" data-stats-widget="${collapseKey}">
          <div class="cfop-case-breakdown-head stats-subwidget-head">
            <button type="button" class="stats-subwidget-toggle" data-stats-collapse="${collapseKey}" aria-expanded="${isOpen ? "true" : "false"}">
              <span class="chevron" aria-hidden="true"></span>
              <span class="stats-subwidget-title">${escapeHtml(title)}</span>
              <span class="cfop-case-breakdown-sub">${escapeHtml(subtitle)}</span>
            </button>
          </div>
          <div class="stats-subwidget-body">
            <p class="cfop-case-empty">No ${escapeHtml(title)} tracked yet in this session. Solve with your Smart Cube to automatically identify cases, times, and pauses.</p>
          </div>
        </div>
      `;
    }

    const showGroupCol = trackId === "oll";
    const maxPauseMs = Math.max(...items.map(i => i.avgPauseMs));
    const maxMedianMs = Math.max(...items.map(i => i.medianMs || 0));
    const sortState = sortStateByTrack[trackId] || { col: "medianMs", dir: "desc" };
    const sortedItems = [...items].sort((a, b) => {
      const col = sortState.col;
      let vA = a[col];
      let vB = b[col];
      if (col === "shortName" || col === "group") {
        vA = String(vA || "").toLowerCase();
        vB = String(vB || "").toLowerCase();
      } else {
        vA = Number.isFinite(vA) ? vA : -1;
        vB = Number.isFinite(vB) ? vB : -1;
      }
      if (vA < vB) return sortState.dir === "asc" ? -1 : 1;
      if (vA > vB) return sortState.dir === "asc" ? 1 : -1;
      return 0;
    });
    const sortArrow = (col) => sortState.col === col ? (sortState.dir === "asc" ? " ▲" : " ▼") : "";

    const rowsHtml = sortedItems.map((item) => {
      const needsWork = items.length > 1 && (
        (item.medianMs != null && item.medianMs >= maxMedianMs) ||
        (item.avgPauseMs > 400 && item.avgPauseMs >= maxPauseMs * 0.85)
      );
      const priorityBadge = needsWork
        ? `<span class="badge badge-priority-improve" title="Slowest median time or longest pauses — focus practice here">Needs Work</span>`
        : "";
      const svgDiagram = getCachedCaseSvg("333", trackId, item.id);
      return `
        <tr>
          <td class="cfop-case-id-cell">
            <span class="badge ${badgeClass}"><strong>${escapeHtml(item.shortName)}</strong></span>
            ${priorityBadge}
          </td>
          <td class="case-svg-cell"><div class="case-table-svg">${svgDiagram}</div></td>
          ${showGroupCol ? `<td class="cfop-case-group-cell">${escapeHtml(item.group)}</td>` : ""}
          <td>${item.attempts}</td>
          <td><strong>${formatCfopSplitMs(item.medianMs)}</strong></td>
          <td><strong>${formatCfopSplitMs(item.trimMeanMs)}</strong></td>
          <td>${formatCfopSplitMs(item.avgMs)}</td>
          <td>${formatCfopSplitMs(item.bestMs)}</td>
          <td>${formatCfopSplitMs(item.worstMs)}</td>
          <td class="${item.avgPauseCount > 0 ? "pause-cell-warn" : ""}">
            ${item.avgPauseCount} <small>(${formatCfopSplitMs(item.avgPauseMs)})</small>
          </td>
          <td>${formatCfopSplitMs(item.avgRecogMs)}</td>
        </tr>
      `;
    }).join("");

    return `
      <div class="cfop-case-breakdown-card stats-subwidget ${isOpen ? "" : "is-collapsed"}" data-stats-widget="${collapseKey}">
        <div class="cfop-case-breakdown-head stats-subwidget-head">
          <button type="button" class="stats-subwidget-toggle" data-stats-collapse="${collapseKey}" aria-expanded="${isOpen ? "true" : "false"}">
            <span class="chevron" aria-hidden="true"></span>
            <span class="stats-subwidget-title">${escapeHtml(title)} (${items.length} case${items.length === 1 ? "" : "s"} solved)</span>
            <span class="cfop-case-breakdown-sub">${escapeHtml(subtitle)}</span>
          </button>
        </div>
        <div class="stats-subwidget-body">
          <div class="cfop-table-scroll">
            <table class="layer-log-table cfop-cases-table" data-breakdown-track="${trackId}">
              <thead>
                <tr>
                  <th scope="col" class="sortable" data-breakdown-track="${trackId}" data-breakdown-sort="shortName">Case<span class="sort-icon">${sortArrow("shortName")}</span></th>
                  <th scope="col">Cube</th>
                  ${showGroupCol ? `<th scope="col" class="sortable" data-breakdown-track="${trackId}" data-breakdown-sort="group">Group<span class="sort-icon">${sortArrow("group")}</span></th>` : ""}
                  <th scope="col" class="sortable" data-breakdown-track="${trackId}" data-breakdown-sort="attempts">Solves<span class="sort-icon">${sortArrow("attempts")}</span></th>
                  <th scope="col" class="sortable" data-breakdown-track="${trackId}" data-breakdown-sort="medianMs" title="Median time (1st priority)">Median<span class="sort-icon">${sortArrow("medianMs")}</span></th>
                  <th scope="col" class="sortable" data-breakdown-track="${trackId}" data-breakdown-sort="trimMeanMs" title="Trimmed mean (excludes top & bottom 10%)">Trim10%<span class="sort-icon">${sortArrow("trimMeanMs")}</span></th>
                  <th scope="col" class="sortable" data-breakdown-track="${trackId}" data-breakdown-sort="avgMs" title="Arithmetic mean time">Mean<span class="sort-icon">${sortArrow("avgMs")}</span></th>
                  <th scope="col" class="sortable" data-breakdown-track="${trackId}" data-breakdown-sort="bestMs">Best<span class="sort-icon">${sortArrow("bestMs")}</span></th>
                  <th scope="col" class="sortable" data-breakdown-track="${trackId}" data-breakdown-sort="worstMs">Worst<span class="sort-icon">${sortArrow("worstMs")}</span></th>
                  <th scope="col" class="sortable" data-breakdown-track="${trackId}" data-breakdown-sort="avgPauseMs" title="Average pauses (≥0.40s) and pause time per case">Avg Pauses<span class="sort-icon">${sortArrow("avgPauseMs")}</span></th>
                  <th scope="col" class="sortable" data-breakdown-track="${trackId}" data-breakdown-sort="avgRecogMs" title="Average pre-algorithm recognition / AUF time">Avg Recog<span class="sort-icon">${sortArrow("avgRecogMs")}</span></th>
                </tr>
              </thead>
              <tbody>${rowsHtml}</tbody>
            </table>
          </div>
        </div>
      </div>
    `;
  };

  return `
    <div class="cfop-cases-improvement-section">
      <div class="layer-log-header" style="margin-top: 20px;">
        <div class="layer-log-title-wrap">
          <h3 class="layer-log-title">3x3 OLL &amp; PLL Case Performance &amp; Pauses (Where to Improve)</h3>
          <span class="layer-log-hint">Sorted by slowest Median first · Click any column header to sort</span>
        </div>
      </div>
      <div class="cfop-cases-grid">
        ${renderCaseSubTable("OLL Cases", "Orientation of the Last Layer — Median, TrimMean, Mean & Pauses per Case", ollStats, "badge-oll-case", "oll", ollOpen)}
        ${renderCaseSubTable("PLL Cases", "Permutation of the Last Layer — Median, TrimMean, Mean & Pauses per Case", pllStats, "badge-pll-case", "pll", pllOpen)}
      </div>
    </div>
  `;
}
