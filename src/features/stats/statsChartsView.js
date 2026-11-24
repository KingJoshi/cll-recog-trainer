// Lightweight Inline SVG Performance Charts (Progress Trend, Time Distribution, CFOP Phase Split Bar)

import { getSolveTime, computeAverageOfN } from '../../services/solveStats.js';
import { escapeHtml, formatSolveTime, formatCfopSplitMs } from '../../services/htmlUtils.js';

function buildPolylineSegments(points) {
  const paths = [];
  let cur = [];
  for (const pt of points) {
    if (pt == null) {
      if (cur.length >= 2) paths.push(cur);
      cur = [];
    } else {
      cur.push(pt);
    }
  }
  if (cur.length >= 2) paths.push(cur);
  return paths
    .map(seg => `M ${seg.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" L ")}`)
    .join(" ");
}

function renderTrendChartCard(displaySolves) {
  const slice = displaySolves.slice(-200);
  const singleVals = slice.map(sv => getSolveTime(sv));
  const ao5Vals = slice.map((_, idx) => {
    if (idx < 4) return null;
    const val = computeAverageOfN(slice.slice(idx - 4, idx + 1).reverse(), 5);
    return (typeof val === "number" && Number.isFinite(val) && val > 0) ? val : null;
  });
  const ao12Vals = slice.map((_, idx) => {
    if (idx < 11) return null;
    const val = computeAverageOfN(slice.slice(idx - 11, idx + 1).reverse(), 12);
    return (typeof val === "number" && Number.isFinite(val) && val > 0) ? val : null;
  });

  const allNumeric = [...singleVals, ...ao5Vals, ...ao12Vals].filter(v => typeof v === "number" && Number.isFinite(v));
  if (allNumeric.length < 2) {
    return `
      <div class="stats-chart-card">
        <div class="stats-chart-head">
          <span class="stats-chart-title">Progress Trend</span>
          <span class="stats-chart-sub">Need 2+ valid solves</span>
        </div>
        <div class="stats-chart-empty">Complete at least 2 non-DNF solves to plot progress.</div>
      </div>
    `;
  }

  const rawMin = Math.min(...allNumeric);
  const rawMax = Math.max(...allNumeric);
  const pad = Math.max(100, Math.round((rawMax - rawMin) * 0.1));
  const minMs = Math.max(0, rawMin - Math.round(pad * 0.5));
  const maxMs = Math.max(minMs + 200, rawMax + Math.round(pad * 0.5));
  const midMs = Math.round((minMs + maxMs) / 2);

  const w = 420;
  const h = 160;
  const padL = 44;
  const padR = 10;
  const padT = 12;
  const padB = 20;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;
  const n = slice.length;
  const xFor = (i) => (n <= 1 ? padL + plotW / 2 : padL + (i / (n - 1)) * plotW);
  const yFor = (ms) => {
    if (typeof ms !== "number" || !Number.isFinite(ms)) return null;
    const ratio = (ms - minMs) / (maxMs - minMs);
    return padT + (1 - Math.max(0, Math.min(1, ratio))) * plotH;
  };

  const singlePts = singleVals.map((v, i) => {
    const y = yFor(v);
    return y == null ? null : [xFor(i), y];
  });
  const ao5Pts = ao5Vals.map((v, i) => {
    const y = yFor(v);
    return y == null ? null : [xFor(i), y];
  });
  const ao12Pts = ao12Vals.map((v, i) => {
    const y = yFor(v);
    return y == null ? null : [xFor(i), y];
  });

  const singlePath = buildPolylineSegments(singlePts);
  const ao5Path = buildPolylineSegments(ao5Pts);
  const ao12Path = buildPolylineSegments(ao12Pts);
  const dotsHtml = n <= 80
    ? singlePts
        .map((pt, i) => pt ? `<circle cx="${pt[0].toFixed(1)}" cy="${pt[1].toFixed(1)}" r="2.2" class="chart-dot-single"><title>${escapeHtml(formatSolveTime(singleVals[i]))}</title></circle>` : "")
        .join("")
    : "";

  const yMaxPos = yFor(maxMs).toFixed(1);
  const yMidPos = yFor(midMs).toFixed(1);
  const yMinPos = yFor(minMs).toFixed(1);

  return `
    <div class="stats-chart-card">
      <div class="stats-chart-head">
        <span class="stats-chart-title">Progress Trend</span>
        <span class="stats-chart-legend">
          <span class="chart-leg-item"><i class="chart-swatch swatch-single"></i>Single</span>
          ${ao5Path ? `<span class="chart-leg-item"><i class="chart-swatch swatch-ao5"></i>Ao5</span>` : ""}
          ${ao12Path ? `<span class="chart-leg-item"><i class="chart-swatch swatch-ao12"></i>Ao12</span>` : ""}
        </span>
      </div>
      <svg class="stats-chart-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="Solve time progress trend chart">
        <line x1="${padL}" y1="${yMaxPos}" x2="${w - padR}" y2="${yMaxPos}" class="chart-grid-line" />
        <line x1="${padL}" y1="${yMidPos}" x2="${w - padR}" y2="${yMidPos}" class="chart-grid-line" />
        <line x1="${padL}" y1="${yMinPos}" x2="${w - padR}" y2="${yMinPos}" class="chart-grid-line" />
        <text x="${padL - 5}" y="${Number(yMaxPos) + 3}" class="chart-axis-text" text-anchor="end">${escapeHtml(formatSolveTime(maxMs))}</text>
        <text x="${padL - 5}" y="${Number(yMidPos) + 3}" class="chart-axis-text" text-anchor="end">${escapeHtml(formatSolveTime(midMs))}</text>
        <text x="${padL - 5}" y="${Number(yMinPos) + 3}" class="chart-axis-text" text-anchor="end">${escapeHtml(formatSolveTime(minMs))}</text>
        ${singlePath ? `<path d="${singlePath}" class="chart-line-single" fill="none" />` : ""}
        ${dotsHtml}
        ${ao5Path ? `<path d="${ao5Path}" class="chart-line-ao5" fill="none" />` : ""}
        ${ao12Path ? `<path d="${ao12Path}" class="chart-line-ao12" fill="none" />` : ""}
        <text x="${padL}" y="${h - 4}" class="chart-axis-text" text-anchor="start">Oldest (${slice.length})</text>
        <text x="${w - padR}" y="${h - 4}" class="chart-axis-text" text-anchor="end">Latest</text>
      </svg>
    </div>
  `;
}

function renderDistributionCard(validTimes) {
  if (validTimes.length < 2) {
    return `
      <div class="stats-chart-card">
        <div class="stats-chart-head">
          <span class="stats-chart-title">Time Distribution</span>
          <span class="stats-chart-sub">Need 2+ valid solves</span>
        </div>
        <div class="stats-chart-empty">Complete at least 2 non-DNF solves to view distribution.</div>
      </div>
    `;
  }

  const minMs = Math.min(...validTimes);
  const maxMs = Math.max(...validTimes);
  const span = Math.max(100, maxMs - minMs);
  const binCount = Math.min(10, Math.max(4, Math.ceil(Math.sqrt(validTimes.length))));
  const binSize = Math.max(100, Math.ceil(span / binCount / 50) * 50);
  const startEdge = Math.floor(minMs / binSize) * binSize;

  const bins = Array.from({ length: binCount }, (_, idx) => ({
    lo: startEdge + idx * binSize,
    hi: startEdge + (idx + 1) * binSize,
    count: 0
  }));
  for (const t of validTimes) {
    const idx = Math.min(binCount - 1, Math.max(0, Math.floor((t - startEdge) / binSize)));
    bins[idx].count++;
  }
  const peak = Math.max(1, ...bins.map(b => b.count));

  const w = 420;
  const h = 160;
  const padL = 14;
  const padR = 14;
  const padT = 18;
  const padB = 24;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;
  const slotW = plotW / binCount;
  const barW = Math.max(8, slotW * 0.72);

  const barsHtml = bins.map((b, i) => {
    const barH = (b.count / peak) * plotH;
    const x = padL + i * slotW + (slotW - barW) / 2;
    const y = padT + plotH - barH;
    const showLabel = binCount <= 7 || i % 2 === 0 || i === binCount - 1;
    const labelStr = (b.lo / 1000).toFixed(b.lo % 1000 === 0 ? 0 : 1);
    return `
      <rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${barW.toFixed(1)}" height="${Math.max(0, barH).toFixed(1)}" rx="3" class="chart-hist-bar">
        <title>${escapeHtml(formatSolveTime(b.lo))}–${escapeHtml(formatSolveTime(b.hi))}: ${b.count} solve${b.count === 1 ? "" : "s"}</title>
      </rect>
      ${b.count > 0 ? `<text x="${(x + barW / 2).toFixed(1)}" y="${(y - 4).toFixed(1)}" class="chart-hist-count" text-anchor="middle">${b.count}</text>` : ""}
      ${showLabel ? `<text x="${(x + barW / 2).toFixed(1)}" y="${h - 6}" class="chart-axis-text" text-anchor="middle">${escapeHtml(labelStr)}s</text>` : ""}
    `;
  }).join("");

  return `
    <div class="stats-chart-card">
      <div class="stats-chart-head">
        <span class="stats-chart-title">Time Distribution</span>
        <span class="stats-chart-sub">${validTimes.length.toLocaleString()} valid solves</span>
      </div>
      <svg class="stats-chart-svg" viewBox="0 0 ${w} ${h}" role="img" aria-label="Solve time distribution histogram">
        <line x1="${padL}" y1="${padT + plotH}" x2="${w - padR}" y2="${padT + plotH}" class="chart-grid-line" />
        ${barsHtml}
      </svg>
    </div>
  `;
}

function renderCfopSplitsBarCard(cfopScopes = []) {
  const rows = cfopScopes
    .map(scope => {
      const m = scope?.avg?.median;
      if (!m) return null;
      const cross = m.cross || 0;
      const f2l = m.f2lTotal || 0;
      const oll = m.oll || 0;
      const pll = m.pll || 0;
      const sum = cross + f2l + oll + pll;
      if (sum <= 0) return null;
      return { title: scope.title, cross, f2l, oll, pll, sum };
    })
    .filter(Boolean);

  if (!rows.length) return "";

  const pct = (v, sum) => ((v / sum) * 100).toFixed(1);

  return `
    <div class="stats-chart-card stats-chart-card-wide">
      <div class="stats-chart-head">
        <span class="stats-chart-title">CFOP Phase Proportions (Median)</span>
        <span class="stats-chart-legend">
          <span class="chart-leg-item"><i class="chart-swatch swatch-cross"></i>Cross</span>
          <span class="chart-leg-item"><i class="chart-swatch swatch-f2l"></i>F2L</span>
          <span class="chart-leg-item"><i class="chart-swatch swatch-oll"></i>OLL</span>
          <span class="chart-leg-item"><i class="chart-swatch swatch-pll"></i>PLL</span>
        </span>
      </div>
      <div class="cfop-stacked-bars">
        ${rows.map(r => `
          <div class="cfop-stacked-row">
            <span class="cfop-stacked-label">${escapeHtml(r.title)} <small>(${escapeHtml(formatCfopSplitMs(r.sum))})</small></span>
            <div class="cfop-stacked-track" role="img" aria-label="${escapeHtml(r.title)} phase shares">
              ${r.cross > 0 ? `<span class="cfop-seg cfop-seg-cross" style="width:${pct(r.cross, r.sum)}%" title="Cross: ${escapeHtml(formatCfopSplitMs(r.cross))} (${pct(r.cross, r.sum)}%)">${Number(pct(r.cross, r.sum)) >= 11 ? `${Math.round((r.cross / r.sum) * 100)}%` : ""}</span>` : ""}
              ${r.f2l > 0 ? `<span class="cfop-seg cfop-seg-f2l" style="width:${pct(r.f2l, r.sum)}%" title="F2L: ${escapeHtml(formatCfopSplitMs(r.f2l))} (${pct(r.f2l, r.sum)}%)">${Number(pct(r.f2l, r.sum)) >= 14 ? `${Math.round((r.f2l / r.sum) * 100)}%` : ""}</span>` : ""}
              ${r.oll > 0 ? `<span class="cfop-seg cfop-seg-oll" style="width:${pct(r.oll, r.sum)}%" title="OLL: ${escapeHtml(formatCfopSplitMs(r.oll))} (${pct(r.oll, r.sum)}%)">${Number(pct(r.oll, r.sum)) >= 11 ? `${Math.round((r.oll / r.sum) * 100)}%` : ""}</span>` : ""}
              ${r.pll > 0 ? `<span class="cfop-seg cfop-seg-pll" style="width:${pct(r.pll, r.sum)}%" title="PLL: ${escapeHtml(formatCfopSplitMs(r.pll))} (${pct(r.pll, r.sum)}%)">${Number(pct(r.pll, r.sum)) >= 11 ? `${Math.round((r.pll / r.sum) * 100)}%` : ""}</span>` : ""}
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

export function renderStatsChartsHtml(displaySolves = [], { is3x3 = false, isOpen = true, cfopScopes = [] } = {}) {
  if (!Array.isArray(displaySolves) || displaySolves.length < 2) return "";
  const validTimes = displaySolves.map(sv => getSolveTime(sv)).filter(t => t != null && Number.isFinite(t));
  if (validTimes.length < 2) return "";

  const trendHtml = renderTrendChartCard(displaySolves);
  const distHtml = renderDistributionCard(validTimes);
  const cfopHtml = is3x3 ? renderCfopSplitsBarCard(cfopScopes) : "";

  return `
    <div class="stats-charts-card stats-subwidget ${isOpen ? "" : "is-collapsed"}" data-stats-widget="charts">
      <div class="stats-subwidget-head">
        <button type="button" class="stats-subwidget-toggle" data-stats-collapse="charts" aria-expanded="${isOpen ? "true" : "false"}">
          <span class="chevron" aria-hidden="true"></span>
          <span class="stats-subwidget-title">Performance Charts</span>
          <span class="cfop-averages-hint">Trend (Ao5 / Ao12) &middot; Distribution${is3x3 ? " &middot; CFOP Splits" : ""}</span>
        </button>
      </div>
      <div class="stats-subwidget-body">
        <div class="stats-charts-grid">
          ${trendHtml}
          ${distHtml}
          ${cfopHtml}
        </div>
      </div>
    </div>
  `;
}
