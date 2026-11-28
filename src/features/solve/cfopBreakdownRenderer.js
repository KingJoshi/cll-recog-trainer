// Pure HTML renderers for CFOP split breakdown tables, OLL/PLL per-case stats, and GAN phase inline summaries

import { ensureSolveCfop, computeOllPllCaseStats } from '../../cfopAnalyzer.js';
import { ensureSolveTwoByTwo, computeCllCaseStats } from '../../twoByTwoAnalyzer.js';
import { getCachedCaseSvg } from '../../caseVisualizer.js';
import { escapeHtml, formatCfopSplitMs } from '../../services/htmlUtils.js';
import { resolveDrillableCaseId } from '../../services/weakCasesService.js';

const TAG_LABELS = {
  none: "+ Tag",
  learning: "Learning",
  review: "Review",
  mastered: "Mastered"
};

function sortBreakdownItems(items, sortState) {
  const col = sortState?.col || "medianMs";
  const dir = sortState?.dir === "asc" ? "asc" : "desc";
  return [...items].sort((a, b) => {
    let vA = a[col];
    let vB = b[col];
    if (col === "shortName" || col === "group") {
      vA = String(vA || "").toLowerCase();
      vB = String(vB || "").toLowerCase();
    } else {
      vA = Number.isFinite(vA) ? vA : -1;
      vB = Number.isFinite(vB) ? vB : -1;
    }
    if (vA < vB) return dir === "asc" ? -1 : 1;
    if (vA > vB) return dir === "asc" ? 1 : -1;
    return 0;
  });
}

function renderColorDotHtml(colorName) {
  const slug = String(colorName || "").trim().toLowerCase();
  if (!["white", "yellow", "green", "blue", "red", "orange"].includes(slug)) return "";
  return `<span class="face-chip-dot face-dot-${slug}" aria-hidden="true"></span>`;
}

export function renderSolvePhaseInline(solve) {
  if (!solve || (solve.inspectionMs == null && solve.pickupMs == null && solve.putdownMs == null)) return "";
  const parts = [];
  if (solve.inspectionMs != null) parts.push(`insp <strong>${formatCfopSplitMs(solve.inspectionMs)}</strong>`);
  if (solve.pickupMs != null) parts.push(`pick-up <strong>${formatCfopSplitMs(solve.pickupMs)}</strong>`);
  if (solve.putdownMs != null) parts.push(`put-down <strong>${formatCfopSplitMs(solve.putdownMs)}</strong>`);
  return `<span class="solve-phase-inline" title="Measured across inspection, timer, and smart cube events">⏱ ${parts.join(" · ")}</span>`;
}

export function renderCfopStepTable(solve, { detailed = false, basic = false, refMedians = null, twoByTwoMethod = "cll" } = {}) {
  const is2x2 = solve?.puzzle === "222";
  const analysis = is2x2
    ? ensureSolveTwoByTwo(solve, { twoByTwoMethod })
    : ensureSolveCfop(solve);
  if (!analysis || (!analysis.steps?.length && !analysis.splits)) return "";

  const realSteps = (analysis.steps || []);
  if (realSteps.length === 0) return "";

  const hasPickup = typeof solve.pickupMs === "number" && Number.isFinite(solve.pickupMs);
  const hasPutdown = typeof solve.putdownMs === "number" && Number.isFinite(solve.putdownMs);
  const pickupOffset = hasPickup ? solve.pickupMs : 0;

  const isNoRecogPhase = (phase) => phase === "cross" || phase === "layer" || phase === "face";
  const hasSeparateAuf = Boolean(analysis.aufSummary && !realSteps.some(st => st.phase === "auf"));
  const aufMsExtra = hasSeparateAuf ? (analysis.aufSummary.ms || 0) : 0;
  const aufExecExtra = hasSeparateAuf ? (analysis.aufSummary.execMs ?? analysis.aufSummary.ms ?? 0) : 0;
  const aufMoveExtra = hasSeparateAuf ? (analysis.aufSummary.moveCount || 0) : 0;
  const totalRecogMs = realSteps.reduce((acc, s) => acc + (isNoRecogPhase(s.phase) ? 0 : (s.recogMs || 0)), 0);
  const totalExecMs = realSteps.reduce((acc, s) => acc + (s.execMs || 0), 0) + aufExecExtra;
  const stepsTotalMs = realSteps.reduce((acc, s) => acc + (s.ms || 0), 0) + aufMsExtra;
  const cubeSolveMs = typeof solve.cubeMs === "number" && Number.isFinite(solve.cubeMs) ? solve.cubeMs : stepsTotalMs;
  const solveMs = solve.rawMs ?? solve.ms ?? (pickupOffset + cubeSolveMs + (hasPutdown ? solve.putdownMs : 0));
  const totalMoves = solve.moveCount ?? (realSteps.reduce((acc, s) => acc + (s.moveCount || 0), 0) + aufMoveExtra);
  const pCnt = analysis.pauses?.totalCount || 0;
  const pMs = analysis.pauses?.totalMs || 0;

  const phaseRefKeyMap = {
    pickup: "pickupMs",
    cross: "cross",
    layer: "layer",
    face: "face",
    f2l1: "f2l1",
    f2l2: "f2l2",
    f2l3: "f2l3",
    f2l4: "f2l4",
    f2lTotal: "f2lTotal",
    oll: "oll",
    pll: "pll",
    cll: "cll",
    pbl: "pbl",
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
    if (st.phase === "f2l4" && analysis.f2lSummary) {
      displayRows.push({
        ...analysis.f2lSummary,
        accumMs: analysis.f2lSummary.accumMs != null ? analysis.f2lSummary.accumMs + pickupOffset : null
      });
    }
    if ((st.phase === "pll" || st.phase === "cll") && analysis.aufSummary) {
      displayRows.push({
        ...analysis.aufSummary,
        accumMs: analysis.aufSummary.accumMs != null ? analysis.aufSummary.accumMs + pickupOffset : null
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
    const isSummaryRow = row.phase === "f2lTotal" || row.phase === "cubeTotal";
    const isHandlingRow = row.phase === "pickup" || row.phase === "putdown";
    let stepBadgeClass = "cfop-step-badge-default";
    if (row.phase === "f2lTotal" || row.phase === "cubeTotal") stepBadgeClass = "cfop-step-badge-f2lsum";
    else if (row.phase === "auf") stepBadgeClass = "cfop-step-badge-auf";
    else if (row.phase === "oll") stepBadgeClass = "cfop-step-badge-oll";
    else if (row.phase === "pll" || row.phase === "cll" || row.phase === "pbl") stepBadgeClass = "cfop-step-badge-pll";
    else if (row.phase === "cross" || row.phase === "layer" || row.phase === "face") stepBadgeClass = "cfop-step-badge-cross";

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
      const fullTitle = analysis.ollCase?.name ? ` title="${escapeHtml(analysis.ollCase.name)}"` : "";
      caseDisplay = `<span class="badge badge-oll-case"${fullTitle}>${escapeHtml(row.caseId)}</span>`;
    } else if (row.phase === "pll" && row.caseId && row.caseId !== "-") {
      const fullTitle = analysis.pllCase?.name ? ` title="${escapeHtml(analysis.pllCase.name)}"` : "";
      caseDisplay = `<span class="badge badge-pll-case"${fullTitle}>${escapeHtml(row.caseId)}</span>`;
    } else if (row.phase === "cll" && row.caseId && row.caseId !== "-") {
      const fullTitle = analysis.cllCase?.name ? ` title="${escapeHtml(analysis.cllCase.name)}"` : "";
      caseDisplay = `<span class="badge badge-pll-case"${fullTitle}>${escapeHtml(row.caseId)}</span>`;
    } else if ((row.phase === "layer" || row.phase === "face") && row.caseId && row.caseId !== "-") {
      caseDisplay = `<span class="cfop-slot-tag">${renderColorDotHtml(row.caseId)} ${escapeHtml(row.caseId)}</span>`;
    } else if (row.phase.startsWith("f2l") && row.phase !== "f2lTotal") {
      caseDisplay = `<span class="cfop-slot-tag">${escapeHtml(row.caseId || "-")}</span>`;
    } else if (row.phase === "auf") {
      caseDisplay = row.caseId && row.caseId !== "None"
        ? `<code class="cfop-setup-code">${escapeHtml(row.caseId)}</code>`
        : `<span class="cfop-slot-tag">None</span>`;
    } else if (isHandlingRow || row.phase === "cubeTotal") {
      caseDisplay = `<span class="cfop-slot-tag">${escapeHtml(row.caseId || "-")}</span>`;
    }

    const recogTxt = (isNoRecogPhase(row.phase) || row.phase === "auf" || isHandlingRow)
      ? `<span class="cfop-muted-dash">-</span>`
      : formatCfopSplitMs(row.recogMs);

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

    const reconStr = row.moves || row.execMoves || "";
    const reconTxt = (isSummaryRow || isHandlingRow)
      ? `<span class="cfop-muted-dash">-</span>`
      : (reconStr ? `<code class="cfop-recon-code">${escapeHtml(reconStr)}</code>` : `<span class="cfop-muted-dash">-</span>`);

    return `
      <tr class="cfop-step-row cfop-row-${row.phase} ${isSummaryRow ? "cfop-row-f2l-summary" : ""}">
        <td class="cfop-col-step"><span class="cfop-step-badge ${stepBadgeClass}">${escapeHtml(row.label)}</span></td>
        <td class="cfop-col-case">${caseDisplay}</td>
        <td class="cfop-col-recog">${recogTxt}</td>
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
            <th scope="col" title="Recognition time until first non-U execution move">Recog</th>
            <th scope="col" title="Algorithm execution time">Exec</th>
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

export function renderLastSolveCfopInline(solve, { basic = false, refMedians = null, twoByTwoMethod = "cll" } = {}) {
  return renderCfopStepTable(solve, { detailed: false, basic, refMedians, twoByTwoMethod });
}

function renderBreakdownCaseTable({
  puzzleId = "333",
  title,
  subtitle,
  items,
  badgeClass,
  trackId,
  collapseKey,
  isOpen = true,
  modeToggleHtml = "",
  sortStateByTrack = {},
  caseTags = {},
  showGroupCol = false,
  showAvgMovesCol = false
}) {
  if (!items || items.length === 0) {
    return `
      <div class="cfop-case-breakdown-card stats-subwidget ${isOpen ? "" : "is-collapsed"}" data-stats-widget="${collapseKey}">
        <div class="cfop-case-breakdown-head stats-subwidget-head">
          <button type="button" class="stats-subwidget-toggle" data-stats-collapse="${collapseKey}" aria-expanded="${isOpen ? "true" : "false"}">
            <span class="chevron" aria-hidden="true"></span>
            <span class="stats-subwidget-title">${escapeHtml(title)}</span>
            <span class="cfop-case-breakdown-sub">${escapeHtml(subtitle)}</span>
          </button>
          ${modeToggleHtml}
        </div>
        <div class="stats-subwidget-body">
          <p class="cfop-case-empty">No ${escapeHtml(title)} tracked yet in this session. Solve with your Smart Cube to automatically identify cases, times, and pauses.</p>
        </div>
      </div>
    `;
  }

  const sortState = sortStateByTrack[trackId] || { col: "medianMs", dir: "desc" };
  const sortedItems = sortBreakdownItems(items, sortState);
  const sortArrow = (col) => sortState.col === col ? (sortState.dir === "asc" ? " ▲" : " ▼") : "";

  // Collect top slowest non-skip drillable case IDs for the one-click "Drill Weakest" button
  const weakestByMedian = [...items]
    .filter(item => !item.isSkip)
    .sort((a, b) => (b.medianMs || 0) - (a.medianMs || 0));
  const weakestIds = [];
  const weakestSeen = new Set();
  for (const item of weakestByMedian) {
    const drillId = resolveDrillableCaseId(puzzleId, trackId, item.id);
    if (drillId && !weakestSeen.has(drillId)) {
      weakestSeen.add(drillId);
      weakestIds.push(drillId);
      if (weakestIds.length >= 5) break;
    }
  }
  const drillWeakestBtnHtml = weakestIds.length > 0
    ? `<button type="button" class="cfop-drill-weakest-btn" data-drill-weakest-puzzle="${escapeHtml(puzzleId)}" data-drill-weakest-track="${escapeHtml(trackId)}" data-drill-weakest-ids="${escapeHtml(weakestIds.join(","))}" title="Start Smart Cube Alg Drill on your ${weakestIds.length} slowest ${escapeHtml(title)}">⚡ Drill Weakest (${weakestIds.length})</button>`
    : "";

  const rowsHtml = sortedItems.map((item) => {
    const rawTag = ["learning", "review", "mastered"].includes(caseTags?.[item.id]) ? caseTags[item.id] : "none";
    const tagLabel = TAG_LABELS[rawTag] || "+ Tag";
    const tagBtnHtml = `<button type="button" class="cfop-case-tag-btn tag-${rawTag}" data-case-tag-id="${escapeHtml(item.id)}" data-tooltip="Click to cycle study tag (Pending → Learning → Review → Mastered)" aria-label="Study tag for ${escapeHtml(item.shortName)}: ${escapeHtml(tagLabel)}">${escapeHtml(tagLabel)}</button>`;
    const drillCaseId = item.isSkip ? null : resolveDrillableCaseId(puzzleId, trackId, item.id);
    const caseBadgeHtml = drillCaseId
      ? `<button type="button" class="cfop-drill-case-btn badge ${badgeClass}" data-drill-puzzle="${escapeHtml(puzzleId)}" data-drill-track="${escapeHtml(trackId)}" data-drill-case-id="${escapeHtml(drillCaseId)}" title="Click to start drilling ${escapeHtml(item.shortName)}"><strong>${escapeHtml(item.shortName)}</strong></button>`
      : `<span class="badge ${badgeClass}"><strong>${escapeHtml(item.shortName)}</strong></span>`;
    const svgDiagram = item.isSkip
      ? `<span class="cfop-slot-tag">Solved</span>`
      : getCachedCaseSvg(puzzleId, trackId, item.svgCaseId || item.id);
    return `
      <tr>
        <td class="cfop-case-id-cell">
          ${caseBadgeHtml}
          ${tagBtnHtml}
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
        ${showAvgMovesCol ? `<td>${item.avgMoves != null ? item.avgMoves : "-"}</td>` : ""}
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
        <div class="cfop-card-head-actions">
          ${drillWeakestBtnHtml}
          ${modeToggleHtml}
        </div>
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
                ${showAvgMovesCol ? `<th scope="col" class="sortable" data-breakdown-track="${trackId}" data-breakdown-sort="avgMoves" title="Average move count">Avg Moves<span class="sort-icon">${sortArrow("avgMoves")}</span></th>` : ""}
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

export function renderOllPllCasesBreakdownHtml(solvesList, { ollOpen = true, pllOpen = true, sortStateByTrack = {}, caseTags = {}, llAnalyticsMode = "full", ollMode = null, pllMode = null } = {}) {
  const legacyMode = llAnalyticsMode === "2look" ? "2look" : "full";
  const resolvedOllMode = ollMode ? (ollMode === "2look" ? "2look" : "full") : legacyMode;
  const resolvedPllMode = pllMode ? (pllMode === "2look" ? "2look" : "full") : legacyMode;
  const { ollCases: ollStats, pllCases: pllStats } = computeOllPllCaseStats(solvesList, {
    ollMode: resolvedOllMode,
    pllMode: resolvedPllMode
  });

  const ollTitle = resolvedOllMode === "2look" ? "OLL Cases (2-Look)" : "OLL Cases";
  const ollSub = resolvedOllMode === "2look"
    ? "Merged 2-Look Edge Orientation (Dot/Line/L) + 7 OCLL Corners"
    : "Orientation of the Last Layer — Median, TrimMean, Mean & Pauses per Case";
  const pllTitle = resolvedPllMode === "2look" ? "PLL Cases (2-Look)" : "PLL Cases";
  const pllSub = resolvedPllMode === "2look"
    ? "Merged 2-Look Corner Swap (Adj/Diag) + 4 Edge EPLLs"
    : "Permutation of the Last Layer — Median, TrimMean, Mean & Pauses per Case";

  const ollModeHtml = `
    <div class="cfop-metric-pills ll-analytics-mode-group" role="group" aria-label="OLL case grouping">
      <button type="button" class="cfop-metric-pill ${resolvedOllMode === "full" ? "active" : ""}" data-oll-mode="full" aria-pressed="${resolvedOllMode === "full" ? "true" : "false"}" title="Track all 57 OLL cases individually">Full (57)</button>
      <button type="button" class="cfop-metric-pill ${resolvedOllMode === "2look" ? "active" : ""}" data-oll-mode="2look" aria-pressed="${resolvedOllMode === "2look" ? "true" : "false"}" title="Merge non-OCLL OLLs into EO shapes (Dot/Line/L)">2-Look</button>
    </div>
  `;
  const pllModeHtml = `
    <div class="cfop-metric-pills ll-analytics-mode-group" role="group" aria-label="PLL case grouping">
      <button type="button" class="cfop-metric-pill ${resolvedPllMode === "full" ? "active" : ""}" data-pll-mode="full" aria-pressed="${resolvedPllMode === "full" ? "true" : "false"}" title="Track all 21 PLL cases individually">Full (21)</button>
      <button type="button" class="cfop-metric-pill ${resolvedPllMode === "2look" ? "active" : ""}" data-pll-mode="2look" aria-pressed="${resolvedPllMode === "2look" ? "true" : "false"}" title="Merge corner PLLs into Adj/Diag and track 4 EPLLs individually">2-Look</button>
    </div>
  `;

  return `
    <div class="cfop-cases-improvement-section">
      <div class="layer-log-header" style="margin-top: 20px;">
        <div class="layer-log-title-wrap">
          <h3 class="layer-log-title">3x3 OLL &amp; PLL Case Performance &amp; Pauses (Where to Improve)</h3>
          <span class="layer-log-hint">Sorted by slowest Median first · Click any case to drill it · Click headers to sort</span>
        </div>
      </div>
      <div class="cfop-cases-grid">
        ${renderBreakdownCaseTable({
          puzzleId: "333",
          title: ollTitle,
          subtitle: ollSub,
          items: ollStats,
          badgeClass: "badge-oll-case",
          trackId: "oll",
          collapseKey: "ollCases",
          isOpen: ollOpen,
          modeToggleHtml: ollModeHtml,
          sortStateByTrack,
          caseTags,
          showGroupCol: true
        })}
        ${renderBreakdownCaseTable({
          puzzleId: "333",
          title: pllTitle,
          subtitle: pllSub,
          items: pllStats,
          badgeClass: "badge-pll-case",
          trackId: "pll",
          collapseKey: "pllCases",
          isOpen: pllOpen,
          modeToggleHtml: pllModeHtml,
          sortStateByTrack,
          caseTags,
          showGroupCol: false
        })}
      </div>
    </div>
  `;
}

export function renderCllCasesBreakdownHtml(solvesList, { cllOpen = true, sortStateByTrack = {}, caseTags = {}, twoByTwoMethod = "cll" } = {}) {
  const cllStats = computeCllCaseStats(solvesList, { twoByTwoMethod });
  const methodToggleHtml = `
    <div class="cfop-metric-pills ll-analytics-mode-group" role="group" aria-label="2x2 alg set method">
      <button type="button" class="cfop-metric-pill ${twoByTwoMethod === "cll" ? "active" : ""}" data-two-method="cll" aria-pressed="${twoByTwoMethod === "cll" ? "true" : "false"}" title="Analyze 2x2 solves as 1st Layer + CLL">CLL</button>
      <button type="button" class="cfop-metric-pill ${twoByTwoMethod === "auto" ? "active" : ""}" data-two-method="auto" aria-pressed="${twoByTwoMethod === "auto" ? "true" : "false"}" title="Auto-detect CLL vs Ortega per solve">Auto</button>
      <button type="button" class="cfop-metric-pill ${twoByTwoMethod === "ortega" ? "active" : ""}" data-two-method="ortega" aria-pressed="${twoByTwoMethod === "ortega" ? "true" : "false"}" title="Analyze 2x2 solves as 1st Face + OLL + PBL">Ortega</button>
    </div>
  `;

  return `
    <div class="cfop-cases-improvement-section">
      <div class="layer-log-header" style="margin-top: 20px;">
        <div class="layer-log-title-wrap">
          <h3 class="layer-log-title">2x2 CLL Case Performance &amp; Pauses (Where to Improve)</h3>
          <span class="layer-log-hint">Color-neutral 1st Layer + CLL detection · Sorted by slowest Median first · Click any case to drill it</span>
        </div>
      </div>
      <div class="cfop-cases-grid">
        ${renderBreakdownCaseTable({
          puzzleId: "222",
          title: "CLL Cases",
          subtitle: "Corners of the Last Layer — Median, TrimMean, Mean, Recog & Moves per Case",
          items: cllStats,
          badgeClass: "badge-pll-case",
          trackId: "cll",
          collapseKey: "ollCases",
          isOpen: cllOpen,
          modeToggleHtml: methodToggleHtml,
          sortStateByTrack,
          caseTags,
          showGroupCol: true,
          showAvgMovesCol: true
        })}
      </div>
    </div>
  `;
}
