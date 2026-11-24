// CFOP Goal Coach & Bottleneck Detector: compares recent medians against a target solve goal

import { computeCfopAverages, computeOllPllCaseStats } from '../../cfopAnalyzer.js';
import { escapeHtml, formatSolveTime, formatCfopSplitMs } from '../../services/htmlUtils.js';

export const CFOP_GOAL_TARGETS = [20, 15, 12, 10, 8];

export const CFOP_SPLIT_RATIOS = {
  cross: 0.12,
  f2lTotal: 0.50,
  oll: 0.165,
  pll: 0.215
};

const PHASE_LABELS = {
  cross: "Cross",
  f2lTotal: "F2L Σ",
  oll: "OLL",
  pll: "PLL"
};

export function computeCfopGoalAnalysis(solves = [], goalOrOpts = 12) {
  const opts = (typeof goalOrOpts === "object" && goalOrOpts !== null)
    ? goalOrOpts
    : { goalSec: goalOrOpts };
  const goalSec = opts.goalSec ?? 12;
  const llAnalyticsMode = opts.llAnalyticsMode === "2look" ? "2look" : "full";
  const cleanGoal = Number(goalSec) > 0 ? Number(goalSec) : 12;
  const validSolves = (solves || []).filter(s => s && s.penalty !== "DNF" && s.penalty !== -1);
  if (validSolves.length === 0) return null;

  const recentWindow = validSolves.slice(-12);
  const avg = computeCfopAverages(recentWindow);
  const med = avg.median || {};

  const phaseRows = ["cross", "f2lTotal", "oll", "pll"].map(key => {
    const targetMs = Math.round(cleanGoal * 1000 * CFOP_SPLIT_RATIOS[key]);
    const actualMs = (typeof med[key] === "number" && Number.isFinite(med[key])) ? med[key] : null;
    const deltaMs = actualMs != null ? (actualMs - targetMs) : null;
    return {
      key,
      label: PHASE_LABELS[key],
      actualMs,
      targetMs,
      deltaMs,
      onTrack: deltaMs != null ? deltaMs <= 0 : null
    };
  });

  const scoredPhases = phaseRows
    .filter(p => p.deltaMs != null)
    .sort((a, b) => b.deltaMs - a.deltaMs);
  const topBottleneck = scoredPhases[0] || null;

  const caseStats = computeOllPllCaseStats(validSolves, { llAnalyticsMode });
  const slowCases = [];
  const collectSlow = (items, trackLabel, phaseTargetMs) => {
    for (const item of (items || [])) {
      if (!item || item.medianMs == null || item.count < 1) continue;
      const lossPerSolveMs = item.medianMs - phaseTargetMs;
      if (lossPerSolveMs > 0) {
        slowCases.push({
          track: trackLabel,
          shortName: item.shortName || item.id,
          name: item.name || item.shortName || item.id,
          count: item.count,
          medianMs: item.medianMs,
          targetMs: phaseTargetMs,
          lossPerSolveMs,
          impactScore: item.count * lossPerSolveMs
        });
      }
    }
  };
  collectSlow(caseStats.ollCases, "OLL", Math.round(cleanGoal * 1000 * CFOP_SPLIT_RATIOS.oll));
  collectSlow(caseStats.pllCases, "PLL", Math.round(cleanGoal * 1000 * CFOP_SPLIT_RATIOS.pll));
  slowCases.sort((a, b) => b.impactScore - a.impactScore);

  return {
    goalSec: cleanGoal,
    sampleCount: recentWindow.length,
    medianTotalMs: med.totalMs ?? null,
    medianPauseMs: med.pauseMs ?? null,
    medianPauseCount: med.pauseCount ?? null,
    phases: phaseRows,
    topBottleneck,
    slowCases: slowCases.slice(0, 3)
  };
}

export function renderCfopGoalCoachHtml(displaySolves = [], { goalSec = 12, isOpen = true, llAnalyticsMode = "full" } = {}) {
  const analysis = computeCfopGoalAnalysis(displaySolves, { goalSec, llAnalyticsMode });
  if (!analysis || !analysis.phases.some(p => p.actualMs != null)) return "";

  const fmtDelta = (deltaMs) => {
    if (deltaMs == null) return "-";
    const sign = deltaMs > 0 ? "+" : (deltaMs < 0 ? "-" : "");
    return `${sign}${formatCfopSplitMs(Math.abs(deltaMs))}`;
  };

  const phasesHtml = analysis.phases.map(p => {
    const statusCls = p.deltaMs == null ? "" : (p.deltaMs <= 0 ? "cfop-goal-delta-good" : "cfop-goal-delta-warn");
    return `
      <div class="cfop-goal-phase-card ${statusCls}">
        <span class="cfop-goal-phase-name">${escapeHtml(p.label)}</span>
        <strong class="cfop-goal-phase-actual">${p.actualMs != null ? escapeHtml(formatCfopSplitMs(p.actualMs)) : "-"}</strong>
        <span class="cfop-goal-phase-target">Goal ${escapeHtml(formatCfopSplitMs(p.targetMs))}</span>
        <span class="cfop-goal-phase-delta">${escapeHtml(fmtDelta(p.deltaMs))}</span>
      </div>
    `;
  }).join("");

  const bn = analysis.topBottleneck;
  const bottleneckText = bn
    ? (bn.deltaMs > 0
      ? `Top bottleneck: <strong>${escapeHtml(bn.label)}</strong> (+${escapeHtml(formatCfopSplitMs(bn.deltaMs))} slower than Sub-${analysis.goalSec} pace)`
      : `All phases are on Sub-${analysis.goalSec} pace (tightest: <strong>${escapeHtml(bn.label)}</strong>, ${escapeHtml(fmtDelta(bn.deltaMs))})`)
    : "";

  const slowCasesText = analysis.slowCases.length > 0
    ? analysis.slowCases.map(c =>
        `<span class="cfop-goal-case-chip" title="Solved ${c.count}× · Target ${escapeHtml(formatCfopSplitMs(c.targetMs))}"><strong>${escapeHtml(c.shortName)}</strong> (${escapeHtml(formatCfopSplitMs(c.medianMs))} &middot; ${c.count}&times;)</span>`
      ).join("")
    : `<span class="cfop-averages-hint">All tracked OLL/PLL medians are at or under Sub-${analysis.goalSec} pace.</span>`;

  return `
    <div class="cfop-goal-coach-card stats-subwidget ${isOpen ? "" : "is-collapsed"}" data-stats-widget="goalCoach">
      <div class="stats-subwidget-head">
        <button type="button" class="stats-subwidget-toggle" data-stats-collapse="goalCoach" aria-expanded="${isOpen ? "true" : "false"}">
          <span class="chevron" aria-hidden="true"></span>
          <span class="stats-subwidget-title">CFOP Goal Coach &mdash; Sub-${analysis.goalSec}</span>
          <span class="cfop-averages-hint">Last ${analysis.sampleCount} median${analysis.medianTotalMs != null ? ` (${escapeHtml(formatSolveTime(analysis.medianTotalMs))})` : ""}${analysis.medianPauseMs != null ? ` &middot; Pauses ${escapeHtml(formatCfopSplitMs(analysis.medianPauseMs))}` : ""}</span>
        </button>
        <div class="cfop-goal-pills" role="group" aria-label="Target solve goal">
          ${CFOP_GOAL_TARGETS.map(sec =>
            `<button type="button" class="cfop-metric-pill ${analysis.goalSec === sec ? "active" : ""}" data-cfop-goal="${sec}" aria-pressed="${analysis.goalSec === sec ? "true" : "false"}">Sub-${sec}</button>`
          ).join("")}
        </div>
      </div>
      <div class="stats-subwidget-body">
        <div class="cfop-goal-phases-grid">${phasesHtml}</div>
        <div class="cfop-goal-insights">
          ${bottleneckText ? `<div class="cfop-goal-insight-line">${bottleneckText}</div>` : ""}
          <div class="cfop-goal-insight-cases">
            <span class="cfop-goal-cases-lbl">Highest-impact cases:</span>
            ${slowCasesText}
          </div>
        </div>
      </div>
    </div>
  `;
}
