// Per-Case Solve Timing & Pause Statistics Table

import { getTrack } from '../../data/algRegistry.js';
import { ollCases } from '../../data/ollData.js';
import { pllCases } from '../../data/pllData.js';
import {
  initCfopAnalyzer,
  ensureSolveCfop,
  computeMedian,
  computeTrimmedMean,
  isCfopAnalyzerReady
} from '../../cfopAnalyzer.js';
import { getCachedCaseSvg, prewarmOllPllSvgs, isOllPllSvgsPrewarmed } from '../../caseVisualizer.js';
import { getSolveTime } from '../../services/solveStats.js';
import { escapeHtml, formatSolveTime, formatCfopSplitMs } from '../../services/htmlUtils.js';

export function createCaseSolveStatsView({ appStore } = {}) {
  const sortState = { col: "median", dir: "desc" };

  function render(container) {
    if (!container) return;

    if (!isCfopAnalyzerReady()) {
      initCfopAnalyzer().then(() => {
        if (appStore.state.statsType === "cll") render(container);
      });
    }
    if (!isOllPllSvgsPrewarmed()) {
      prewarmOllPllSvgs(ollCases, pllCases).then(() => {
        if (appStore.state.statsType === "cll") render(container);
      });
    }

    const { currentPuzzle, currentTrackId } = appStore.state;
    const track = getTrack(currentPuzzle, currentTrackId);
    const trackCases = track?.cases || [];
    const trackCaseIds = trackCases.map(c => c.id);
    const caseMap = track?.caseById || new Map();

    const currentSess = appStore.getActiveSession();
    const currentSolves = currentSess.solves || [];

    const caseSolves = new Map();
    const addCaseRecord = (caseId, msVal, pauseCount = 0, pauseMs = 0) => {
      if (!caseId || !Number.isFinite(msVal) || msVal <= 0) return;
      if (!caseSolves.has(caseId)) {
        caseSolves.set(caseId, { times: [], pauseCounts: [], pauseMsList: [] });
      }
      const rec = caseSolves.get(caseId);
      rec.times.push(msVal);
      rec.pauseCounts.push(pauseCount);
      rec.pauseMsList.push(pauseMs);
    };

    for (const s of currentSolves) {
      if (s.penalty === "DNF" || s.penalty === -1) continue;
      const cfop = ensureSolveCfop(s);
      const isTrackMatch = s.track ? s.track === currentTrackId : true;

      if (s.id && trackCaseIds.includes(s.id) && isTrackMatch) {
        addCaseRecord(s.id, getSolveTime(s), cfop?.pauses?.totalCount || 0, cfop?.pauses?.totalMs || 0);
      } else if (cfop) {
        if (currentTrackId === "oll" && cfop.ollCase?.id && trackCaseIds.includes(cfop.ollCase.id)) {
          addCaseRecord(cfop.ollCase.id, cfop.ollCase.ms, cfop.ollCase.pauseCount || 0, cfop.ollCase.pauseMs || 0);
        } else if (currentTrackId === "pll" && cfop.pllCase?.id && trackCaseIds.includes(cfop.pllCase.id)) {
          addCaseRecord(cfop.pllCase.id, cfop.pllCase.ms, cfop.pllCase.pauseCount || 0, cfop.pllCase.pauseMs || 0);
        }
      }
    }

    const casesWithTimes = trackCaseIds.filter(id => caseSolves.has(id));
    const isOllTrack = (currentPuzzle === "333" || currentPuzzle === "333oh") && currentTrackId === "oll";
    const isPllTrack = (currentPuzzle === "333" || currentPuzzle === "333oh") && currentTrackId === "pll";
    const showCubeSvgCol = isOllTrack || isPllTrack;
    const showGroupCol = !isPllTrack;

    const sortCols = [
      { key: "case", label: "Case" },
      ...(showCubeSvgCol ? [{ key: "cube", label: "Cube", unsortable: true }] : []),
      ...(showGroupCol ? [{ key: "name", label: isOllTrack ? "Group" : "Name / Group" }] : []),
      { key: "attempts", label: "Attempts" },
      { key: "best", label: "Best", title: "Best time" },
      { key: "median", label: "Median", title: "Median time (1st priority)" },
      { key: "trimMean", label: "TrimMean 10%", title: "Trimmed mean (excludes top & bottom 10%)" },
      { key: "mean", label: "Mean", title: "Arithmetic mean time" },
      { key: "worst", label: "Worst", title: "Worst time" },
      { key: "avgPauseCount", label: "Avg Pauses", title: "Average pauses per solve" },
      { key: "avgPauseMs", label: "Avg Pause Time", title: "Average pause duration per solve" }
    ];

    let html = '<table class="solve-stats-table"><thead><tr>';
    sortCols.forEach(col => {
      if (col.unsortable) {
        html += `<th scope="col">${col.label}</th>`;
        return;
      }
      const isSorted = sortState.col === col.key;
      const arrow = isSorted ? (sortState.dir === "asc" ? " ▲" : " ▼") : "";
      html += `<th scope="col" class="sortable" data-sort="${col.key}" title="${col.title || ("Sort by " + col.label)}">${col.label}<span class="sort-icon">${arrow}</span></th>`;
    });
    html += "</tr></thead><tbody>";

    if (casesWithTimes.length === 0) {
      html += `<tr><td colspan="${sortCols.length}" class="empty-stats" style="padding: 24px 12px; text-align: center;">
        <p style="margin-bottom: 4px; font-weight: 600;">No ${escapeHtml(track?.shortName || "")} case solves recorded in session "${escapeHtml(currentSess.name)}".</p>
        <p style="font-size: 0.85rem; color: var(--muted); margin: 0;">Complete 3x3 CFOP solves with your Smart Cube or time solves with Target set to <strong>${escapeHtml(track?.shortName || "")}</strong> to build per-case statistics.</p>
      </td></tr></tbody></table>`;
      container.innerHTML = html;
      attachSortListeners(container);
      return;
    }

    const caseStatsList = casesWithTimes.map(id => {
      const rec = caseSolves.get(id);
      const times = rec.times;
      const attempts = times.length;
      const best = Math.min(...times);
      const worst = Math.max(...times);
      const mean = Math.round(times.reduce((sum, t) => sum + t, 0) / attempts);
      const median = computeMedian(times);
      const trimMean = computeTrimmedMean(times, 0.10);
      const avgPauseCount = rec.pauseCounts.length
        ? Number((rec.pauseCounts.reduce((a, b) => a + b, 0) / rec.pauseCounts.length).toFixed(1))
        : 0;
      const avgPauseMs = rec.pauseMsList.length
        ? Math.round(rec.pauseMsList.reduce((a, b) => a + b, 0) / rec.pauseMsList.length)
        : 0;
      const caseObj = caseMap.get(id);
      const name = isOllTrack
        ? (caseObj?.group || id)
        : (caseObj ? (caseObj.name || caseObj.group || id) : id);
      return { id, name, attempts, best, worst, mean, median, trimMean, avgPauseCount, avgPauseMs };
    });

    caseStatsList.sort((a, b) => {
      let valA = a[sortState.col];
      let valB = b[sortState.col];
      if (sortState.col === "case") {
        valA = trackCaseIds.indexOf(a.id);
        valB = trackCaseIds.indexOf(b.id);
      }
      if (valA < valB) return sortState.dir === "asc" ? -1 : 1;
      if (valA > valB) return sortState.dir === "asc" ? 1 : -1;
      return 0;
    });

    caseStatsList.forEach(stat => {
      const svgDiagram = showCubeSvgCol
        ? getCachedCaseSvg("333", isOllTrack ? "oll" : "pll", stat.id)
        : "";
      html += `<tr>
        <th scope="row"><strong>${escapeHtml(stat.id)}</strong></th>
        ${showCubeSvgCol ? `<td class="case-svg-cell"><div class="case-table-svg">${svgDiagram}</div></td>` : ""}
        ${showGroupCol ? `<td class="case-stat-name-cell">${escapeHtml(stat.name)}</td>` : ""}
        <td>${stat.attempts}</td>
        <td>${formatSolveTime(stat.best)}</td>
        <td><strong>${formatSolveTime(stat.median)}</strong></td>
        <td><strong>${formatSolveTime(stat.trimMean)}</strong></td>
        <td>${formatSolveTime(stat.mean)}</td>
        <td>${formatSolveTime(stat.worst)}</td>
        <td>${stat.avgPauseCount}</td>
        <td>${formatCfopSplitMs(stat.avgPauseMs)}</td>
      </tr>`;
    });

    html += "</tbody>";

    if (caseStatsList.length > 1) {
      const allTimes = [];
      const allPauseCounts = [];
      const allPauseMs = [];
      casesWithTimes.forEach(id => {
        const rec = caseSolves.get(id);
        if (rec) {
          allTimes.push(...rec.times);
          allPauseCounts.push(...rec.pauseCounts);
          allPauseMs.push(...rec.pauseMsList);
        }
      });
      const totalAttempts = allTimes.length;
      html += `<tfoot><tr>
        <th scope="row">Total</th>
        ${showCubeSvgCol ? "<td></td>" : ""}
        ${showGroupCol ? `<td class="case-stat-name-cell">${caseStatsList.length} cases</td>` : ""}
        <td>${totalAttempts}</td>
        <td>${formatSolveTime(Math.min(...allTimes))}</td>
        <td><strong>${formatSolveTime(computeMedian(allTimes))}</strong></td>
        <td><strong>${formatSolveTime(computeTrimmedMean(allTimes, 0.10))}</strong></td>
        <td>${formatSolveTime(Math.round(allTimes.reduce((s, t) => s + t, 0) / totalAttempts))}</td>
        <td>${formatSolveTime(Math.max(...allTimes))}</td>
        <td>${allPauseCounts.length ? Number((allPauseCounts.reduce((a, b) => a + b, 0) / allPauseCounts.length).toFixed(1)) : 0}</td>
        <td>${formatCfopSplitMs(allPauseMs.length ? Math.round(allPauseMs.reduce((a, b) => a + b, 0) / allPauseMs.length) : 0)}</td>
      </tr></tfoot>`;
    }

    html += "</table>";
    container.innerHTML = html;
    attachSortListeners(container);
  }

  function attachSortListeners(container) {
    container.querySelectorAll("th.sortable").forEach(th => {
      th.addEventListener("click", () => {
        const col = th.dataset.sort;
        if (!col) return;
        if (sortState.col === col) {
          sortState.dir = sortState.dir === "asc" ? "desc" : "asc";
        } else {
          sortState.col = col;
          sortState.dir = ["case", "name", "best", "mean", "median", "trimMean", "worst"].includes(col) ? "asc" : "desc";
        }
        render(container);
      });
    });
  }

  return { render };
}
