// Case Solves Breakdown Modal: inspect individual solves for a CLL, EG, OLL, PLL, or track case
// with Recog, Exec, Total time, Moves (TPS), Pauses, and move reconstruction.

import { ensureSolveCfop, mapOllCaseTo2Look, mapPllCaseTo2Look, computeMedian } from '../../cfopAnalyzer.js';
import { ensureSolveTwoByTwo } from '../../twoByTwoAnalyzer.js';
import { getCachedCaseSvg } from '../../caseVisualizer.js';
import { getSolveTime } from '../../services/solveStats.js';
import { resolveDrillableCaseId } from '../../services/weakCasesService.js';
import { escapeHtml, formatCfopSplitMs, formatSolveDate, formatSolveTime } from '../../services/htmlUtils.js';

function isNonDnfSolve(solve) {
  return Boolean(solve && solve.penalty !== "DNF" && solve.penalty !== -1);
}

function buildEntry({
  solve,
  solveNum,
  ms,
  recogMs = null,
  execMs = null,
  moveCount = null,
  tps = null,
  pauseCount = 0,
  pauseMs = 0,
  moves = "",
  layerColor = ""
}) {
  const validMs = typeof ms === "number" && Number.isFinite(ms) ? ms : null;
  const validRecog = typeof recogMs === "number" && Number.isFinite(recogMs) ? recogMs : null;
  const resolvedExec = (typeof execMs === "number" && Number.isFinite(execMs))
    ? execMs
    : (validMs != null && validRecog != null ? Math.max(0, validMs - validRecog) : null);
  const fullMsRaw = getSolveTime(solve);
  const fullMs = Number.isFinite(fullMsRaw) ? fullMsRaw : validMs;
  return {
    solve,
    solveNum,
    at: solve?.at ?? null,
    fullMs,
    ms: validMs ?? fullMs,
    recogMs: validRecog,
    execMs: resolvedExec,
    moveCount: typeof moveCount === "number" && Number.isFinite(moveCount) ? moveCount : null,
    tps: typeof tps === "number" && Number.isFinite(tps) && tps > 0 ? tps : null,
    pauseCount: typeof pauseCount === "number" && Number.isFinite(pauseCount) ? pauseCount : 0,
    pauseMs: typeof pauseMs === "number" && Number.isFinite(pauseMs) ? pauseMs : 0,
    moves: String(moves || "").trim(),
    layerColor: String(layerColor || "").trim()
  };
}

/**
 * Collect every non-DNF solve matching a specific case ID across 2x2 CLL/EG, 3x3 OLL/PLL, or manual track solves.
 */
export function collectCaseSolves({
  solves = [],
  solveEntries = null,
  puzzleId = "222",
  trackId = "cll",
  caseId = "",
  twoByTwoMethod = "cll",
  layerTargetFaces = null,
  ollMode = "full",
  pllMode = "full"
} = {}) {
  if (!caseId) return [];
  const normalized = Array.isArray(solveEntries)
    ? solveEntries
    : (Array.isArray(solves) ? solves.map((solve, idx) => ({ solve, solveNum: idx + 1 })) : []);

  const is222 = puzzleId === "222";
  const twoOpts = { twoByTwoMethod, layerTargetFaces };
  const matches = [];

  for (const item of normalized) {
    const sv = item?.solve;
    if (!isNonDnfSolve(sv)) continue;
    const solveNum = item.solveNum;

    if (is222) {
      const two = ensureSolveTwoByTwo(sv, twoOpts);
      if (trackId === "cll" && two?.cllCase?.id === caseId) {
        const st = two.steps?.find(s => s.phase === "cll");
        if (two.cllCase.ms != null) {
          matches.push(buildEntry({
            solve: sv,
            solveNum,
            ms: two.cllCase.ms,
            recogMs: two.cllCase.recogMs ?? st?.recogMs,
            execMs: two.cllCase.execMs ?? st?.execMs,
            moveCount: two.cllCase.moveCount ?? st?.moveCount,
            tps: st?.tps,
            pauseCount: two.cllCase.pauseCount ?? st?.pauseCount ?? 0,
            pauseMs: two.cllCase.pauseMs ?? st?.pauseMs ?? 0,
            moves: st?.moves || st?.execMoves || "",
            layerColor: two.layerColor || ""
          }));
          continue;
        }
      } else if ((trackId === "eg1" || trackId === "eg2") && two?.egCase?.id === caseId) {
        const st = two.steps?.find(s => s.phase === "eg1" || s.phase === "eg2");
        if (two.egCase.ms != null) {
          matches.push(buildEntry({
            solve: sv,
            solveNum,
            ms: two.egCase.ms,
            recogMs: two.egCase.recogMs ?? st?.recogMs,
            execMs: two.egCase.execMs ?? st?.execMs,
            moveCount: two.egCase.moveCount ?? st?.moveCount,
            tps: st?.tps,
            pauseCount: two.egCase.pauseCount ?? st?.pauseCount ?? 0,
            pauseMs: two.egCase.pauseMs ?? st?.pauseMs ?? 0,
            moves: st?.moves || st?.execMoves || "",
            layerColor: two.layerColor || ""
          }));
          continue;
        }
      }
      if (sv.id === caseId && (!sv.track || sv.track === trackId)) {
        matches.push(buildEntry({
          solve: sv,
          solveNum,
          ms: getSolveTime(sv),
          moveCount: sv.moveCount ?? (Array.isArray(sv.moves) && sv.moves.length ? sv.moves.length : null),
          tps: sv.tps,
          pauseCount: two?.pauses?.totalCount || 0,
          pauseMs: two?.pauses?.totalMs || 0,
          moves: Array.isArray(sv.moves) ? sv.moves.map(m => m.move).join(" ") : ""
        }));
      }
      continue;
    }

    const cfop = ensureSolveCfop(sv);
    if (trackId === "oll" && cfop?.ollCase?.id) {
      const effective = (ollMode === "2look" || caseId.startsWith("2look-oll-"))
        ? mapOllCaseTo2Look(cfop.ollCase)
        : cfop.ollCase;
      if (effective?.id === caseId && typeof cfop.ollCase.ms === "number" && cfop.ollCase.ms > 0) {
        const st = cfop.steps?.find(s => s.phase === "oll");
        matches.push(buildEntry({
          solve: sv,
          solveNum,
          ms: cfop.ollCase.ms,
          recogMs: cfop.ollCase.recogMs ?? st?.recogMs,
          execMs: cfop.ollCase.execMs ?? st?.execMs,
          moveCount: cfop.ollCase.moveCount ?? st?.moveCount,
          tps: st?.tps,
          pauseCount: cfop.ollCase.pauseCount ?? st?.pauseCount ?? 0,
          pauseMs: cfop.ollCase.pauseMs ?? st?.pauseMs ?? 0,
          moves: st?.moves || st?.execMoves || "",
          layerColor: cfop.crossColor || ""
        }));
        continue;
      }
    } else if (trackId === "pll" && cfop?.pllCase?.id) {
      const effective = (pllMode === "2look" || caseId.startsWith("2look-pll-"))
        ? mapPllCaseTo2Look(cfop.pllCase)
        : cfop.pllCase;
      if (effective?.id === caseId && typeof cfop.pllCase.ms === "number" && cfop.pllCase.ms > 0) {
        const st = cfop.steps?.find(s => s.phase === "pll");
        matches.push(buildEntry({
          solve: sv,
          solveNum,
          ms: cfop.pllCase.ms,
          recogMs: cfop.pllCase.recogMs ?? st?.recogMs,
          execMs: cfop.pllCase.execMs ?? st?.execMs,
          moveCount: cfop.pllCase.moveCount ?? st?.moveCount,
          tps: st?.tps,
          pauseCount: cfop.pllCase.pauseCount ?? st?.pauseCount ?? 0,
          pauseMs: cfop.pllCase.pauseMs ?? st?.pauseMs ?? 0,
          moves: st?.moves || st?.execMoves || "",
          layerColor: cfop.crossColor || ""
        }));
        continue;
      }
    }

    if (sv.id === caseId && (!sv.track || sv.track === trackId)) {
      matches.push(buildEntry({
        solve: sv,
        solveNum,
        ms: getSolveTime(sv),
        moveCount: sv.moveCount ?? (Array.isArray(sv.moves) && sv.moves.length ? sv.moves.length : null),
        tps: sv.tps,
        pauseCount: cfop?.pauses?.totalCount || 0,
        pauseMs: cfop?.pauses?.totalMs || 0,
        moves: Array.isArray(sv.moves) ? sv.moves.map(m => m.move).join(" ") : ""
      }));
    }
  }

  matches.sort((a, b) => (b.solveNum ?? 0) - (a.solveNum ?? 0));
  return matches;
}

function meanOf(nums) {
  if (!nums.length) return null;
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}

export function sortCaseSolveEntries(entries = [], sortState = { col: "solveNum", dir: "desc" }) {
  const col = sortState?.col || "solveNum";
  const dir = sortState?.dir === "asc" ? "asc" : "desc";
  return [...entries].sort((a, b) => {
    const vA = Number.isFinite(a[col]) ? a[col] : -1;
    const vB = Number.isFinite(b[col]) ? b[col] : -1;
    if (vA < vB) return dir === "asc" ? -1 : 1;
    if (vA > vB) return dir === "asc" ? 1 : -1;
    return (b.solveNum ?? 0) - (a.solveNum ?? 0);
  });
}

/**
 * Pure renderer for the #caseSolvesModal body (summary strip + per-solve Recog/Exec/Moves/Pauses table).
 */
export function renderCaseSolvesModalBodyHtml({
  entries = [],
  caseLabel = "",
  sortState = { col: "solveNum", dir: "desc" }
} = {}) {
  if (!entries || entries.length === 0) {
    return `<p class="cfop-case-empty">No matching solves recorded for <strong>${escapeHtml(caseLabel || "this case")}</strong> in the current view.</p>`;
  }

  const sorted = sortCaseSolveEntries(entries, sortState);
  const sortArrow = (col) => sortState?.col === col ? (sortState.dir === "asc" ? " ▲" : " ▼") : "";

  const totals = entries.map(e => e.ms).filter(v => Number.isFinite(v));
  const recogs = entries.map(e => e.recogMs).filter(v => Number.isFinite(v));
  const execs = entries.map(e => e.execMs).filter(v => Number.isFinite(v));
  const movesList = entries.map(e => e.moveCount).filter(v => Number.isFinite(v));
  const pauseCounts = entries.map(e => e.pauseCount).filter(v => Number.isFinite(v));
  const pauseMsList = entries.map(e => e.pauseMs).filter(v => Number.isFinite(v));

  const medianMs = computeMedian(totals);
  const meanMs = totals.length ? Math.round(meanOf(totals)) : null;
  const avgRecogMs = recogs.length ? Math.round(meanOf(recogs)) : null;
  const avgExecMs = execs.length ? Math.round(meanOf(execs)) : null;
  const avgMoves = movesList.length ? Number(meanOf(movesList).toFixed(1)) : null;
  const avgPauseCount = pauseCounts.length ? Number(meanOf(pauseCounts).toFixed(1)) : 0;
  const avgPauseMs = pauseMsList.length ? Math.round(meanOf(pauseMsList)) : 0;

  const recogShare = (avgRecogMs != null && meanMs > 0) ? Math.round((avgRecogMs / meanMs) * 100) : null;
  const execShare = (avgExecMs != null && meanMs > 0) ? Math.max(0, 100 - (recogShare ?? 0)) : null;

  const kpi = (label, valHtml, sub = "") => `
    <div class="solve-phase-cell">
      <span class="solve-phase-label">${label}</span>
      <strong class="solve-phase-val">${valHtml}</strong>
      ${sub ? `<small class="cfop-sub-meta">${sub}</small>` : ""}
    </div>`;

  const summaryHtml = `
    <div class="case-solves-summary-grid">
      ${kpi("Solves", String(entries.length), medianMs != null ? `Median ${formatCfopSplitMs(medianMs)}` : "")}
      ${kpi("Mean", formatCfopSplitMs(meanMs), totals.length ? `Best ${formatCfopSplitMs(Math.min(...totals))}` : "")}
      ${kpi("Avg Recog", formatCfopSplitMs(avgRecogMs), recogShare != null ? `${recogShare}% of case` : "")}
      ${kpi("Avg Exec", formatCfopSplitMs(avgExecMs), execShare != null ? `${execShare}% of case` : "")}
      ${kpi("Avg Moves", avgMoves != null ? String(avgMoves) : "-", "")}
      ${kpi("Avg Pauses", `${avgPauseCount}`, avgPauseMs > 0 ? `${formatCfopSplitMs(avgPauseMs)} avg` : "Clean")}
    </div>
  `;

  const rowsHtml = sorted.map((entry, idx) => {
    const shareRecog = (entry.recogMs != null && entry.ms > 0)
      ? Math.round((entry.recogMs / entry.ms) * 100)
      : null;
    const shareExec = (entry.execMs != null && entry.ms > 0)
      ? Math.max(0, 100 - (shareRecog ?? 0))
      : null;
    const recogHtml = entry.recogMs != null
      ? `${formatCfopSplitMs(entry.recogMs)}${shareRecog != null ? ` <small class="case-solves-pct">${shareRecog}%</small>` : ""}`
      : `<span class="cfop-muted-dash">-</span>`;
    const execHtml = entry.execMs != null
      ? `${formatCfopSplitMs(entry.execMs)}${shareExec != null ? ` <small class="case-solves-pct">${shareExec}%</small>` : ""}`
      : `<span class="cfop-muted-dash">-</span>`;
    const showFullSub = entry.fullMs != null && entry.ms != null && Math.abs(entry.fullMs - entry.ms) >= 10;
    const totalHtml = showFullSub
      ? `<div class="cfop-cell-stack"><strong>${formatCfopSplitMs(entry.ms)}</strong><small class="cfop-sub-meta">full ${formatSolveTime(entry.fullMs)}</small></div>`
      : `<strong>${formatCfopSplitMs(entry.ms)}</strong>`;
    const movesHtml = entry.moveCount != null
      ? `${entry.moveCount}${entry.tps ? ` <small class="cfop-sub-meta">(${entry.tps} TPS)</small>` : ""}`
      : `<span class="cfop-muted-dash">-</span>`;
    const pauseHtml = entry.pauseCount > 0
      ? `<span class="pause-cell-warn">${entry.pauseCount} <small>(${formatCfopSplitMs(entry.pauseMs)})</small></span>`
      : `<span class="pause-cell-clean">0</span>`;
    const reconHtml = entry.moves
      ? `<code class="cfop-recon-code">${escapeHtml(entry.moves)}</code>`
      : `<span class="cfop-muted-dash">-</span>`;
    const dateTxt = entry.at ? escapeHtml(formatSolveDate(entry.at)) : "-";
    const numLabel = entry.solveNum != null ? `#${entry.solveNum}` : `#${idx + 1}`;
    const originalIdx = entries.indexOf(entry);

    return `
      <tr>
        <td><button type="button" class="cfop-case-solves-btn" data-case-solve-detail-idx="${originalIdx}" title="Open full Solve Details for ${escapeHtml(numLabel)}">${escapeHtml(numLabel)}</button></td>
        <td class="case-solves-date-cell">${dateTxt}</td>
        <td>${recogHtml}</td>
        <td>${execHtml}</td>
        <td>${totalHtml}</td>
        <td>${movesHtml}</td>
        <td>${pauseHtml}</td>
        <td class="cfop-col-recon">${reconHtml}</td>
        <td><button type="button" class="btn btn-xs" data-case-solve-detail-idx="${originalIdx}">Solve ↗</button></td>
      </tr>
    `;
  }).join("");

  return `
    ${summaryHtml}
    <div class="cfop-table-scroll">
      <table class="cfop-step-breakdown-table case-solves-table">
        <thead>
          <tr>
            <th scope="col" class="sortable" data-case-solves-sort="solveNum">#<span class="sort-icon">${sortArrow("solveNum")}</span></th>
            <th scope="col">Date</th>
            <th scope="col" class="sortable" data-case-solves-sort="recogMs" title="Recognition time before first non-U move">Recog<span class="sort-icon">${sortArrow("recogMs")}</span></th>
            <th scope="col" class="sortable" data-case-solves-sort="execMs" title="Execution time from first non-U move">Exec<span class="sort-icon">${sortArrow("execMs")}</span></th>
            <th scope="col" class="sortable" data-case-solves-sort="ms" title="Total case time (Recog + Exec)">Total<span class="sort-icon">${sortArrow("ms")}</span></th>
            <th scope="col" class="sortable" data-case-solves-sort="moveCount">Moves<span class="sort-icon">${sortArrow("moveCount")}</span></th>
            <th scope="col" class="sortable" data-case-solves-sort="pauseMs" title="Pauses ≥0.40s during this case">Pauses<span class="sort-icon">${sortArrow("pauseMs")}</span></th>
            <th scope="col" class="cfop-th-recon">Recon</th>
            <th scope="col">Inspect</th>
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
      </table>
    </div>
  `;
}

export function createCaseSolvesModal({
  appStore,
  modalManager,
  getSolveDetailModal = () => null,
  onStartAlgDrill = null
} = {}) {
  const modal = typeof document !== "undefined" ? document.getElementById("caseSolvesModal") : null;
  const svgEl = typeof document !== "undefined" ? document.getElementById("caseSolvesModalSvg") : null;
  const titleEl = typeof document !== "undefined" ? document.getElementById("caseSolvesModalTitle") : null;
  const subEl = typeof document !== "undefined" ? document.getElementById("caseSolvesModalSub") : null;
  const bodyEl = typeof document !== "undefined" ? document.getElementById("caseSolvesModalBody") : null;
  const drillBtn = typeof document !== "undefined" ? document.getElementById("caseSolvesModalDrillBtn") : null;
  const closeBtn = typeof document !== "undefined" ? document.getElementById("caseSolvesModalCloseBtn") : null;
  const dismissBtn = typeof document !== "undefined" ? document.getElementById("caseSolvesModalDismissBtn") : null;

  let currentCtx = null;
  let currentEntries = [];
  let sortState = { col: "solveNum", dir: "desc" };

  function renderBody() {
    if (!bodyEl || !currentCtx) return;
    bodyEl.innerHTML = renderCaseSolvesModalBodyHtml({
      entries: currentEntries,
      caseLabel: currentCtx.caseLabel || currentCtx.caseId,
      sortState
    });

    bodyEl.querySelectorAll("th[data-case-solves-sort]").forEach(th => {
      th.addEventListener("click", () => {
        const col = th.dataset.caseSolvesSort;
        if (!col) return;
        if (sortState.col === col) {
          sortState.dir = sortState.dir === "asc" ? "desc" : "asc";
        } else {
          sortState.col = col;
          sortState.dir = col === "solveNum" ? "desc" : "desc";
        }
        renderBody();
      });
    });

    bodyEl.querySelectorAll("[data-case-solve-detail-idx]").forEach(btn => {
      btn.addEventListener("click", () => {
        const entry = currentEntries[Number(btn.dataset.caseSolveDetailIdx)];
        if (!entry?.solve) return;
        modalManager.close(modal);
        getSolveDetailModal()?.open?.(entry.solve, entry.solveNum);
      });
    });
  }

  function open({
    puzzleId = "222",
    trackId = "cll",
    caseId = "",
    caseLabel = "",
    caseName = "",
    svgCaseId = "",
    solves = null,
    solveEntries = null
  } = {}) {
    if (!modal || !caseId) return;
    const s = appStore?.state || {};
    const sessSolves = Array.isArray(solves) ? solves : (appStore?.getActiveSession?.()?.solves || []);
    const legacyLl = s.llAnalyticsMode === "2look" ? "2look" : "full";
    const ollMode = s.ollMode ? (s.ollMode === "2look" ? "2look" : "full") : legacyLl;
    const pllMode = s.pllMode ? (s.pllMode === "2look" ? "2look" : "full") : legacyLl;

    currentEntries = collectCaseSolves({
      solves: sessSolves,
      solveEntries,
      puzzleId,
      trackId,
      caseId,
      twoByTwoMethod: s.twoByTwoMethod || "cll",
      layerTargetFaces: s.layerTargetFaces,
      ollMode,
      pllMode
    });

    sortState = { col: "solveNum", dir: "desc" };
    currentCtx = { puzzleId, trackId, caseId, caseLabel: caseLabel || caseId, caseName };

    if (svgEl) {
      svgEl.innerHTML = caseId === "cll-skip" || caseId === "OLL Skip" || caseId === "PLL Skip"
        ? `<span class="cfop-slot-tag">Solved</span>`
        : getCachedCaseSvg(puzzleId, trackId, svgCaseId || caseId);
    }
    if (titleEl) {
      titleEl.textContent = `${caseLabel || caseId} — Case Solves (${currentEntries.length})`;
    }
    if (subEl) {
      subEl.textContent = caseName && caseName !== (caseLabel || caseId)
        ? caseName
        : `${trackId.toUpperCase()} per-solve Recog, Exec, Moves & Pauses`;
    }

    if (drillBtn) {
      const drillId = resolveDrillableCaseId(puzzleId, trackId, caseId);
      drillBtn.hidden = !(drillId && typeof onStartAlgDrill === "function");
      drillBtn.dataset.drillCaseId = drillId || "";
      drillBtn.dataset.drillPuzzle = puzzleId;
      drillBtn.dataset.drillTrack = trackId;
    }

    renderBody();
    modalManager.open(modal, { initialFocus: closeBtn });
  }

  closeBtn?.addEventListener("click", () => modalManager.close(modal));
  dismissBtn?.addEventListener("click", () => modalManager.close(modal));
  drillBtn?.addEventListener("click", () => {
    const caseId = drillBtn.dataset.drillCaseId;
    const puzzleId = drillBtn.dataset.drillPuzzle || appStore?.state?.currentPuzzle;
    const trackId = drillBtn.dataset.drillTrack || appStore?.state?.currentTrackId;
    if (!caseId || typeof onStartAlgDrill !== "function") return;
    const targetPuzzle = appStore?.state?.currentPuzzle === "333oh" && puzzleId === "333" ? "333oh" : puzzleId;
    modalManager.close(modal);
    onStartAlgDrill({ puzzleId: targetPuzzle, trackId, caseIds: [caseId] });
  });

  return { open };
}
