// Pure 2D Top-View Visual Guides for OLL (Sune vs. Antisune) & PLL (T-Perm)
// Shared cleanly between the 2x2 and 3x3 Beginner Tutorials (zero 3D cube players).

import { escapeHtml } from '../../services/htmlUtils.js';
import { CUBE_COLORS } from '../../cube/cubeColors.js';

export const TWO_BY_TWO_OLL_VISUAL_GUIDE = {
  direct: [
    {
      id: 'sune',
      title: 'Sune',
      badge: '1 Yellow → Solved',
      alg: "R U R' U R U2 R'",
      top: ['UFL'],
      sides: ['FR', 'RB', 'BL'],
      rule: '<strong>Hold the 1 Yellow at Front-Left.</strong> If Yellow faces <strong>Front</strong> on the Front-Right corner, do <strong>Sune</strong>.'
    },
    {
      id: 'antisune',
      title: 'Antisune',
      badge: '1 Yellow → Solved',
      alg: "R U2 R' U' R U' R'",
      top: ['UBR'],
      sides: ['FL', 'LB', 'RF'],
      rule: '<strong>Hold the 1 Yellow at Back-Right.</strong> If Yellow faces <strong>Front</strong> on the Front-Left corner, do <strong>Antisune</strong>.'
    }
  ],
  setup: [
    {
      id: 'h',
      title: 'H (Double Headlights)',
      badge: 'Sune → Sune',
      alg: "R U R' U R U2 R'",
      top: [],
      sides: ['LB', 'LF', 'RB', 'RF'],
      rule: 'Hold headlights on <strong>Left &amp; Right</strong> → <strong>Sune</strong> gives <strong>Sune</strong> <em>(or Front &amp; Back → Antisune gives Antisune)</em>.'
    },
    {
      id: 'pi',
      title: 'Pi (One Headlights)',
      badge: 'Sune → Sune',
      alg: "R U R' U R U2 R'",
      top: [],
      sides: ['LB', 'LF', 'BR', 'FR'],
      rule: 'Hold headlights on <strong>Left</strong> → <strong>Sune</strong> gives <strong>Sune</strong> <em>(or Antisune gives Antisune)</em>.'
    },
    {
      id: 'u',
      title: 'U (Headlights Front)',
      badge: 'Sune → Antisune',
      alg: "R U R' U R U2 R'",
      top: ['UBL', 'UBR'],
      sides: ['FL', 'FR'],
      rule: 'Put 2 Yellows in <strong>Back</strong> (headlights facing Front) → <strong>Sune</strong> gives <strong>Antisune</strong>.'
    },
    {
      id: 't',
      title: 'T (Chameleon)',
      badge: 'Sune → Antisune',
      alg: "R U R' U R U2 R'",
      top: ['UBR', 'UFR'],
      sides: ['BL', 'FL'],
      rule: 'Put 2 Yellows on <strong>Right</strong> (left stickers facing Front &amp; Back) → <strong>Sune</strong> gives <strong>Antisune</strong>.'
    },
    {
      id: 'l',
      title: 'L (Diagonal Bowtie)',
      badge: 'Sune → Antisune',
      alg: "R U R' U R U2 R'",
      top: ['UBL', 'UFR'],
      sides: ['FL', 'RB'],
      rule: 'Put Yellows at <strong>Back-Left &amp; Front-Right</strong> (Front-Left facing Front) → <strong>Sune</strong> gives <strong>Antisune</strong> <em>(or Antisune → Sune)</em>.'
    }
  ]
};

export const T_PERM_PLL_VISUAL_GUIDE = [
  {
    id: 'adj-bar',
    title: 'Matching Bar on One Side (1 Step)',
    badge: 'Bar on Left → Solved',
    alg: "R U R' U' R' F R2 U' R' U' R U R' F'",
    swapType: 'adj-right',
    sides: {
      LB: 'orange',
      LF: 'orange',
      BL: 'blue',
      BR: 'red',
      FL: 'green',
      FR: 'red',
      RB: 'green',
      RF: 'blue'
    },
    rule222: '<strong>Look around the top layer for two matching side stickers (a &ldquo;bar&rdquo;).</strong> Turn the top layer until that matching bar sits on the <strong>Left</strong>, then do <strong>T-Perm</strong> once to solve all four corners!',
    rule333: '<strong>Look around the top layer for two matching corner stickers on the same side (&ldquo;headlights&rdquo;).</strong> Turn the top layer until those matching corners sit on the <strong>Left</strong>, then do <strong>T-Perm</strong> once to solve all four top corners!'
  },
  {
    id: 'diag-y',
    title: 'No Matching Bar Anywhere (2 Steps)',
    badge: 'Any Angle → Makes a Bar',
    alg: "R U R' U' R' F R2 U' R' U' R U R' F'",
    swapType: 'diag',
    sides: {
      LB: 'red',
      LF: 'orange',
      BL: 'green',
      BR: 'blue',
      FL: 'green',
      FR: 'blue',
      RB: 'red',
      RF: 'orange'
    },
    rule222: '<strong>Don&rsquo;t see a matching bar on any side?</strong> That means two diagonal corners need to swap (the Y-Perm case). Hold the cube at <strong>any angle</strong> and do <strong>T-Perm</strong> once &mdash; it will create a matching bar. Then put that bar on the <strong>Left</strong> and do <strong>T-Perm</strong> again to finish!',
    rule333: '<strong>Don&rsquo;t see matching corner headlights on any side?</strong> That means two diagonal corners need to swap (the Y-Perm case). Hold the top layer at <strong>any angle</strong> and do <strong>T-Perm</strong> once &mdash; it will create matching corner headlights. Then put them on the <strong>Left</strong> and do <strong>T-Perm</strong> again to solve all four corners!'
  }
];

export function render222OllDiagramSvg({ top = [], sides = [], label = '' } = {}) {
  const topSet = new Set(top);
  const sideSet = new Set(sides);
  const yellow = CUBE_COLORS?.yellow || '#facc15';
  const slate = CUBE_COLORS?.slate || '#475569';

  const S = 32;
  const D = 9;
  const G = 3;
  const M = 3;
  const T = M + D + G;
  const W = T * 2 + 2 * S;
  const H = W + 12;

  const rect = (x, y, w, h, fill) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.5" fill="${fill}" stroke="#1e293b" stroke-width="1.15"/>`;

  return `<svg viewBox="0 0 ${W} ${H}" class="tut-oll-guide-svg" role="img" aria-label="${escapeHtml(label || '2x2 OLL top view diagram')}" xmlns="http://www.w3.org/2000/svg">
    ${rect(T, T, S, S, topSet.has('UBL') ? yellow : slate)}
    ${rect(T + S, T, S, S, topSet.has('UBR') ? yellow : slate)}
    ${rect(T, T + S, S, S, topSet.has('UFL') ? yellow : slate)}
    ${rect(T + S, T + S, S, S, topSet.has('UFR') ? yellow : slate)}
    ${sideSet.has('BL') ? rect(T, M, S, D, yellow) : ''}
    ${sideSet.has('BR') ? rect(T + S, M, S, D, yellow) : ''}
    ${sideSet.has('FL') ? rect(T, T + 2 * S + G, S, D, yellow) : ''}
    ${sideSet.has('FR') ? rect(T + S, T + 2 * S + G, S, D, yellow) : ''}
    ${sideSet.has('LB') ? rect(M, T, D, S, yellow) : ''}
    ${sideSet.has('LF') ? rect(M, T + S, D, S, yellow) : ''}
    ${sideSet.has('RB') ? rect(T + 2 * S + G, T, D, S, yellow) : ''}
    ${sideSet.has('RF') ? rect(T + 2 * S + G, T + S, D, S, yellow) : ''}
    <text x="${(W / 2).toFixed(1)}" y="${W + 9}" text-anchor="middle" font-size="7.5" font-weight="700" letter-spacing="0.08em" fill="currentColor" opacity="0.65" font-family="system-ui, sans-serif">FRONT</text>
  </svg>`;
}

function buildBidirectionalArrowSvg(x1, y1, x2, y2, color) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 1) return '';
  const ux = dx / len;
  const uy = dy / len;
  const headLen = 6;
  const headHalfW = 3.4;
  const px = -uy * headHalfW;
  const py = ux * headHalfW;

  const endTipX = x2;
  const endTipY = y2;
  const endBaseX = endTipX - ux * headLen;
  const endBaseY = endTipY - uy * headLen;

  const startTipX = x1;
  const startTipY = y1;
  const startBaseX = startTipX + ux * headLen;
  const startBaseY = startTipY + uy * headLen;

  return `
    <line x1="${startBaseX.toFixed(1)}" y1="${startBaseY.toFixed(1)}" x2="${endBaseX.toFixed(1)}" y2="${endBaseY.toFixed(1)}" stroke="${color}" stroke-width="2.5" stroke-linecap="round"/>
    <polygon points="${endTipX.toFixed(1)},${endTipY.toFixed(1)} ${(endBaseX + px).toFixed(1)},${(endBaseY + py).toFixed(1)} ${(endBaseX - px).toFixed(1)},${(endBaseY - py).toFixed(1)}" fill="${color}"/>
    <polygon points="${startTipX.toFixed(1)},${startTipY.toFixed(1)} ${(startBaseX + px).toFixed(1)},${(startBaseY + py).toFixed(1)} ${(startBaseX - px).toFixed(1)},${(startBaseY - py).toFixed(1)}" fill="${color}"/>
  `;
}

export function renderPllTpermDiagramSvg({ sides = {}, swapType = 'adj-right', label = '' } = {}) {
  const yellow = CUBE_COLORS?.yellow || '#facc15';
  const palette = {
    orange: CUBE_COLORS?.orange || '#f97316',
    red: CUBE_COLORS?.red || '#ef4444',
    green: CUBE_COLORS?.green || '#22c55e',
    blue: CUBE_COLORS?.blue || '#3b82f6'
  };
  const sideFill = (key) => palette[sides[key]] || CUBE_COLORS?.slate || '#475569';

  const S = 32;
  const D = 9;
  const G = 3;
  const M = 3;
  const T = M + D + G;
  const W = T * 2 + 2 * S;
  const H = W + 12;

  const rect = (x, y, w, h, fill, extra = '') =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.5" fill="${fill}" stroke="#1e293b" stroke-width="1.15" ${extra}/>`;

  // Center coordinates of top 4 corners: UBL, UBR, UFL, UFR
  const cxLeft = T + S * 0.5;
  const cxRight = T + S * 1.5;
  const cyBack = T + S * 0.5;
  const cyFront = T + S * 1.5;

  const arrowColor = '#dc2626';
  const arrowSvg = swapType === 'adj-right'
    ? buildBidirectionalArrowSvg(cxRight, cyBack + 4, cxRight, cyFront - 4, arrowColor)
    : buildBidirectionalArrowSvg(cxLeft + 4, cyFront - 4, cxRight - 4, cyBack + 4, arrowColor);

  // Subtle bar bracket on Left side when Left bar matches (adj-right)
  const leftBarHighlight = swapType === 'adj-right'
    ? `<rect x="${M - 1.5}" y="${T - 1.5}" width="${D + 3}" height="${2 * S + 3}" rx="3" fill="none" stroke="#16a34a" stroke-width="1.8"/>`
    : '';

  return `<svg viewBox="0 0 ${W} ${H}" class="tut-oll-guide-svg tut-pll-guide-svg" role="img" aria-label="${escapeHtml(label || 'T-Perm PLL top view diagram')}" xmlns="http://www.w3.org/2000/svg">
    ${rect(T, T, S, S, yellow)}
    ${rect(T + S, T, S, S, yellow)}
    ${rect(T, T + S, S, S, yellow)}
    ${rect(T + S, T + S, S, S, yellow)}
    ${rect(T, M, S, D, sideFill('BL'))}
    ${rect(T + S, M, S, D, sideFill('BR'))}
    ${rect(T, T + 2 * S + G, S, D, sideFill('FL'))}
    ${rect(T + S, T + 2 * S + G, S, D, sideFill('FR'))}
    ${rect(M, T, D, S, sideFill('LB'))}
    ${rect(M, T + S, D, S, sideFill('LF'))}
    ${rect(T + 2 * S + G, T, D, S, sideFill('RB'))}
    ${rect(T + 2 * S + G, T + S, D, S, sideFill('RF'))}
    ${leftBarHighlight}
    ${arrowSvg}
    <text x="${(W / 2).toFixed(1)}" y="${W + 9}" text-anchor="middle" font-size="7.5" font-weight="700" letter-spacing="0.08em" fill="currentColor" opacity="0.65" font-family="system-ui, sans-serif">FRONT</text>
  </svg>`;
}

export function renderOllVisualGuideCardHtml({ puzzle = '222', headingId = 'tut222OllGuideTitle' } = {}) {
  const renderCard = (item) => `
    <div class="tut-oll-guide-item" data-oll-guide-id="${escapeHtml(item.id)}">
      <div class="tut-oll-guide-diagram">
        ${render222OllDiagramSvg({ top: item.top, sides: item.sides, label: `${item.title} 2D OLL diagram` })}
      </div>
      <div class="tut-oll-guide-body">
        <div class="tut-oll-guide-head">
          <strong>${escapeHtml(item.title)}</strong>
          <span class="badge">${escapeHtml(item.badge)}</span>
        </div>
        <code class="tut-oll-guide-alg">${escapeHtml(item.alg)}</code>
        <p class="tut-oll-guide-desc">${item.rule}</p>
      </div>
    </div>
  `;

  const subtitle = puzzle === '333'
    ? 'Once your Yellow Cross is done, look at the 4 top corners from above with <strong>Front</strong> at the bottom. 1 Yellow corner solves in one move; 0 or 2 Yellow corners take one Sune to set up.'
    : 'Look at the Top (Yellow) face from above with <strong>Front</strong> at the bottom. 1 Yellow solves in one move; 0 or 2 Yellows take one Sune to set up.';

  return `
    <section class="guide-card guide-card-full tut-oll-guide-card" aria-labelledby="${escapeHtml(headingId)}">
      <h3 id="${escapeHtml(headingId)}" class="guide-card-title">&#x1F50D; Yellow ${puzzle === '333' ? 'Corners' : 'Face'} (OLL) Visual Guide &mdash; When to Use Sune vs. Antisune</h3>
      <p class="tut-oll-guide-subtitle">${subtitle}</p>
      <div class="tut-oll-guide-group-title">1. Direct 1-Look (1 Yellow ${puzzle === '333' ? 'Corner ' : ''}on Top &mdash; Solves Yellow)</div>
      <div class="tut-oll-guide-direct-grid">
        ${TWO_BY_TWO_OLL_VISUAL_GUIDE.direct.map(renderCard).join('')}
      </div>
      <div class="tut-oll-guide-group-title">2. 2-Look Setup (0 or 2 Yellow ${puzzle === '333' ? 'Corners ' : 'Stickers '}on Top &rarr; Sets up Sune or Antisune)</div>
      <div class="tut-oll-guide-setup-grid">
        ${TWO_BY_TWO_OLL_VISUAL_GUIDE.setup.map(renderCard).join('')}
      </div>
    </section>
  `;
}

export function renderPllTpermVisualGuideCardHtml({ puzzle = '222', headingId = 'tut222PllGuideTitle' } = {}) {
  const is333 = puzzle === '333';
  const subtitle = is333
    ? 'Now look around the 4 top corners from above with <strong>Front</strong> at the bottom (ignore the middle edges for a moment). There are only two cases &mdash; both solved using <strong>T-Perm</strong>.'
    : 'Once Yellow is solved on top, look around the top side stickers with <strong>Front</strong> at the bottom. Every case is either a Matching Bar or a Diagonal swap &mdash; both solved using <strong>T-Perm</strong>.';

  return `
    <section class="guide-card guide-card-full tut-pll-guide-card" aria-labelledby="${escapeHtml(headingId)}">
      <h3 id="${escapeHtml(headingId)}" class="guide-card-title">&#x1F9E9; ${is333 ? 'Top Corners' : 'Top Side Swap'} (PLL) Visual Guide &mdash; Two T-Perm Situations</h3>
      <p class="tut-oll-guide-subtitle">${subtitle}</p>
      <div class="tut-oll-guide-direct-grid">
        ${T_PERM_PLL_VISUAL_GUIDE.map(item => `
          <div class="tut-oll-guide-item" data-pll-guide-id="${escapeHtml(item.id)}">
            <div class="tut-oll-guide-diagram">
              ${renderPllTpermDiagramSvg({ sides: item.sides, swapType: item.swapType, label: `${item.title} 2D T-Perm diagram` })}
            </div>
            <div class="tut-oll-guide-body">
              <div class="tut-oll-guide-head">
                <strong>${escapeHtml(item.title)}</strong>
                <span class="badge">${escapeHtml(item.badge)}</span>
              </div>
              <code class="tut-oll-guide-alg">${escapeHtml(item.alg)}</code>
              <p class="tut-oll-guide-desc">${is333 ? item.rule333 : item.rule222}</p>
            </div>
          </div>
        `).join('')}
      </div>
    </section>
  `;
}

// ============================================================================
// Pure 2D 3x3 Visual Guides (Daisy/Cross, White Corners, F2L Edges, OLL, PLL)
// ============================================================================

function buildOneWayArrowSvg(x1, y1, x2, y2, color) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 1) return '';
  const ux = dx / len;
  const uy = dy / len;
  const headLen = 5.2;
  const headHalfW = 3.0;
  const px = -uy * headHalfW;
  const py = ux * headHalfW;
  const baseX = x2 - ux * headLen;
  const baseY = y2 - uy * headLen;

  return `
    <line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${baseX.toFixed(1)}" y2="${baseY.toFixed(1)}" stroke="${color}" stroke-width="2.2" stroke-linecap="round"/>
    <polygon points="${x2.toFixed(1)},${y2.toFixed(1)} ${(baseX + px).toFixed(1)},${(baseY + py).toFixed(1)} ${(baseX - px).toFixed(1)},${(baseY - py).toFixed(1)}" fill="${color}"/>
  `;
}

function get333Palette() {
  return {
    yellow: CUBE_COLORS?.yellow || '#facc15',
    white: CUBE_COLORS?.white || '#ffffff',
    green: CUBE_COLORS?.green || '#22c55e',
    blue: CUBE_COLORS?.blue || '#3b82f6',
    red: CUBE_COLORS?.red || '#ef4444',
    orange: CUBE_COLORS?.orange || '#f97316',
    slate: CUBE_COLORS?.slate || '#475569'
  };
}

const GRID3_S = 22;
const GRID3_D = 7;
const GRID3_G = 2.5;
const GRID3_M = 3;
const GRID3_T = GRID3_M + GRID3_D + GRID3_G; // 12.5
const GRID3_W = GRID3_T * 2 + 3 * GRID3_S; // 91
const GRID3_H = GRID3_W + 12; // 103

function rect3(x, y, w, h, fill) {
  return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="1.4" fill="${fill}" stroke="#1e293b" stroke-width="1.05"/>`;
}

const CELL_CENTERS_333 = {
  UBL: [GRID3_T + GRID3_S * 0.5, GRID3_T + GRID3_S * 0.5],
  UB:  [GRID3_T + GRID3_S * 1.5, GRID3_T + GRID3_S * 0.5],
  UBR: [GRID3_T + GRID3_S * 2.5, GRID3_T + GRID3_S * 0.5],
  UL:  [GRID3_T + GRID3_S * 0.5, GRID3_T + GRID3_S * 1.5],
  UC:  [GRID3_T + GRID3_S * 1.5, GRID3_T + GRID3_S * 1.5],
  UR:  [GRID3_T + GRID3_S * 2.5, GRID3_T + GRID3_S * 1.5],
  UFL: [GRID3_T + GRID3_S * 0.5, GRID3_T + GRID3_S * 2.5],
  UF:  [GRID3_T + GRID3_S * 1.5, GRID3_T + GRID3_S * 2.5],
  UFR: [GRID3_T + GRID3_S * 2.5, GRID3_T + GRID3_S * 2.5]
};

export function render333OllDiagramSvg({ top = [], sides = [], customTop = {}, caption = 'FRONT', label = '' } = {}) {
  const pal = get333Palette();
  const topSet = new Set(top);
  const sideSet = new Set(sides);
  const topColor = (id) => (customTop[id] ? (pal[customTop[id]] || customTop[id]) : (topSet.has(id) ? pal.yellow : pal.slate));

  const S = GRID3_S, D = GRID3_D, G = GRID3_G, M = GRID3_M, T = GRID3_T, W = GRID3_W, H = GRID3_H;
  const ids = [
    ['UBL', 'UB', 'UBR'],
    ['UL', 'UC', 'UR'],
    ['UFL', 'UF', 'UFR']
  ];

  let topCells = '';
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      topCells += rect3(T + c * S, T + r * S, S, S, topColor(ids[r][c]));
    }
  }

  return `<svg viewBox="0 0 ${W} ${H}" class="tut-oll-guide-svg tut-333-oll-svg" role="img" aria-label="${escapeHtml(label || '3x3 OLL top view diagram')}" xmlns="http://www.w3.org/2000/svg">
    ${topCells}
    ${sideSet.has('BL') ? rect3(T, M, S, D, pal.yellow) : ''}
    ${sideSet.has('BM') ? rect3(T + S, M, S, D, pal.yellow) : ''}
    ${sideSet.has('BR') ? rect3(T + 2 * S, M, S, D, pal.yellow) : ''}
    ${sideSet.has('FL') ? rect3(T, T + 3 * S + G, S, D, pal.yellow) : ''}
    ${sideSet.has('FM') ? rect3(T + S, T + 3 * S + G, S, D, pal.yellow) : ''}
    ${sideSet.has('FR') ? rect3(T + 2 * S, T + 3 * S + G, S, D, pal.yellow) : ''}
    ${sideSet.has('LB') ? rect3(M, T, D, S, pal.yellow) : ''}
    ${sideSet.has('LM') ? rect3(M, T + S, D, S, pal.yellow) : ''}
    ${sideSet.has('LF') ? rect3(M, T + 2 * S, D, S, pal.yellow) : ''}
    ${sideSet.has('RB') ? rect3(T + 3 * S + G, T, D, S, pal.yellow) : ''}
    ${sideSet.has('RM') ? rect3(T + 3 * S + G, T + S, D, S, pal.yellow) : ''}
    ${sideSet.has('RF') ? rect3(T + 3 * S + G, T + 2 * S, D, S, pal.yellow) : ''}
    <text x="${(W / 2).toFixed(1)}" y="${W + 9}" text-anchor="middle" font-size="7.5" font-weight="700" letter-spacing="0.08em" fill="currentColor" opacity="0.65" font-family="system-ui, sans-serif">${escapeHtml(caption)}</text>
  </svg>`;
}

export function render333PllDiagramSvg({
  sides = {},
  arrows = [],
  highlightLeftHeadlights = false,
  highlightBackBar = false,
  label = ''
} = {}) {
  const pal = get333Palette();
  const sideFill = (key) => pal[sides[key]] || pal.slate;
  const S = GRID3_S, D = GRID3_D, G = GRID3_G, M = GRID3_M, T = GRID3_T, W = GRID3_W, H = GRID3_H;

  let topCells = '';
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      topCells += rect3(T + c * S, T + r * S, S, S, pal.yellow);
    }
  }

  let highlights = '';
  if (highlightLeftHeadlights) {
    highlights += `<rect x="${(M - 1.5).toFixed(1)}" y="${(T - 1.5).toFixed(1)}" width="${(D + 3).toFixed(1)}" height="${(S + 3).toFixed(1)}" rx="2.5" fill="none" stroke="#16a34a" stroke-width="1.6"/>`;
    highlights += `<rect x="${(M - 1.5).toFixed(1)}" y="${(T + 2 * S - 1.5).toFixed(1)}" width="${(D + 3).toFixed(1)}" height="${(S + 3).toFixed(1)}" rx="2.5" fill="none" stroke="#16a34a" stroke-width="1.6"/>`;
  }
  if (highlightBackBar) {
    highlights += `<rect x="${(T - 1.5).toFixed(1)}" y="${(M - 1.5).toFixed(1)}" width="${(3 * S + 3).toFixed(1)}" height="${(D + 3).toFixed(1)}" rx="2.5" fill="none" stroke="#16a34a" stroke-width="1.8"/>`;
  }

  const arrowsSvg = arrows.map(a => {
    const p1 = CELL_CENTERS_333[a.from];
    const p2 = CELL_CENTERS_333[a.to];
    if (!p1 || !p2) return '';
    const color = a.color || '#dc2626';
    if (a.bidirectional) {
      return buildBidirectionalArrowSvg(p1[0], p1[1], p2[0], p2[1], color);
    }
    return buildOneWayArrowSvg(p1[0], p1[1], p2[0], p2[1], color);
  }).join('');

  return `<svg viewBox="0 0 ${W} ${H}" class="tut-oll-guide-svg tut-333-pll-svg" role="img" aria-label="${escapeHtml(label || '3x3 PLL top view diagram')}" xmlns="http://www.w3.org/2000/svg">
    ${topCells}
    ${rect3(T, M, S, D, sideFill('BL'))}
    ${rect3(T + S, M, S, D, sideFill('BM'))}
    ${rect3(T + 2 * S, M, S, D, sideFill('BR'))}
    ${rect3(T, T + 3 * S + G, S, D, sideFill('FL'))}
    ${rect3(T + S, T + 3 * S + G, S, D, sideFill('FM'))}
    ${rect3(T + 2 * S, T + 3 * S + G, S, D, sideFill('FR'))}
    ${rect3(M, T, D, S, sideFill('LB'))}
    ${rect3(M, T + S, D, S, sideFill('LM'))}
    ${rect3(M, T + 2 * S, D, S, sideFill('LF'))}
    ${rect3(T + 3 * S + G, T, D, S, sideFill('RB'))}
    ${rect3(T + 3 * S + G, T + S, D, S, sideFill('RM'))}
    ${rect3(T + 3 * S + G, T + 2 * S, D, S, sideFill('RF'))}
    ${highlights}
    ${arrowsSvg}
    <text x="${(W / 2).toFixed(1)}" y="${W + 9}" text-anchor="middle" font-size="7.5" font-weight="700" letter-spacing="0.08em" fill="currentColor" opacity="0.65" font-family="system-ui, sans-serif">FRONT</text>
  </svg>`;
}

export function render333FrontFaceDiagramSvg({
  cells = [],
  topBar = [],
  leftBar = [],
  rightBar = [],
  bottomBar = [],
  arrows = [],
  caption = 'FRONT VIEW',
  label = ''
} = {}) {
  const pal = get333Palette();
  const cFill = (val) => pal[val] || pal.slate;
  const S = GRID3_S, D = GRID3_D, G = GRID3_G, M = GRID3_M, T = GRID3_T, W = GRID3_W, H = GRID3_H;

  let grid = '';
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      grid += rect3(T + c * S, T + r * S, S, S, cFill(cells[r * 3 + c]));
    }
  }

  let caps = '';
  for (let i = 0; i < 3; i++) {
    if (topBar[i]) caps += rect3(T + i * S, M, S, D, cFill(topBar[i]));
    if (bottomBar[i]) caps += rect3(T + i * S, T + 3 * S + G, S, D, cFill(bottomBar[i]));
    if (leftBar[i]) caps += rect3(M, T + i * S, D, S, cFill(leftBar[i]));
    if (rightBar[i]) caps += rect3(T + 3 * S + G, T + i * S, D, S, cFill(rightBar[i]));
  }

  const frontCenters = [
    [T + S * 0.5, T + S * 0.5], [T + S * 1.5, T + S * 0.5], [T + S * 2.5, T + S * 0.5],
    [T + S * 0.5, T + S * 1.5], [T + S * 1.5, T + S * 1.5], [T + S * 2.5, T + S * 1.5],
    [T + S * 0.5, T + S * 2.5], [T + S * 1.5, T + S * 2.5], [T + S * 2.5, T + S * 2.5]
  ];
  const arrowSvg = arrows.map(a => {
    const p1 = frontCenters[a.from];
    const p2 = frontCenters[a.to];
    if (!p1 || !p2) return '';
    return buildOneWayArrowSvg(p1[0], p1[1], p2[0], p2[1], a.color || '#0f172a');
  }).join('');

  return `<svg viewBox="0 0 ${W} ${H}" class="tut-oll-guide-svg tut-333-front-svg" role="img" aria-label="${escapeHtml(label || '3x3 front face diagram')}" xmlns="http://www.w3.org/2000/svg">
    ${grid}
    ${caps}
    ${arrowSvg}
    <text x="${(W / 2).toFixed(1)}" y="${W + 9}" text-anchor="middle" font-size="7.5" font-weight="700" letter-spacing="0.08em" fill="currentColor" opacity="0.65" font-family="system-ui, sans-serif">${escapeHtml(caption)}</text>
  </svg>`;
}

export const THREE_BY_THREE_VISUAL_GUIDES = {
  yellowCross: [
    {
      id: '333-yc-dot',
      title: 'Dot (0 Edges)',
      badge: '1st → Makes L',
      alg: "F R U R' U' F'",
      top: ['UC'],
      sides: ['BM', 'FM', 'LM', 'RM'],
      rule: 'No Yellow edges face up yet. Apply <code>F (Righty) F\'</code> from <strong>any angle</strong> to turn it into an L-shape.'
    },
    {
      id: '333-yc-l',
      title: 'L-Shape (9 & 12 o’clock)',
      badge: '2nd → Makes Line',
      alg: "F R U R' U' F'",
      top: ['UC', 'UB', 'UL'],
      sides: ['FM', 'RM'],
      rule: 'Hold the two Yellow edges at <strong>Back &amp; Left (9 &amp; 12 o&rsquo;clock)</strong>, then do <code>F (Righty) F\'</code> to get a Line.'
    },
    {
      id: '333-yc-line',
      title: 'Horizontal Line',
      badge: '3rd → Cross Solved',
      alg: "F R U R' U' F'",
      top: ['UL', 'UC', 'UR'],
      sides: ['BM', 'FM'],
      rule: 'Hold the line <strong>side-to-side (horizontal)</strong> &mdash; never front-to-back &mdash; then do <code>F (Righty) F\'</code> to finish the Yellow Cross!'
    }
  ],
  ollCornersDirect: [
    {
      id: '333-oll-sune',
      title: 'Sune',
      badge: '1 Corner → Solved',
      alg: "R U R' U R U2 R'",
      top: ['UC', 'UB', 'UR', 'UF', 'UL', 'UFL'],
      sides: ['FR', 'RB', 'BL'],
      rule: 'With the Yellow Cross done and <strong>1 Yellow corner at Front-Left</strong>, check Front-Right: if Yellow faces <strong>Front</strong>, do <strong>Sune</strong>.'
    },
    {
      id: '333-oll-antisune',
      title: 'Antisune',
      badge: '1 Corner → Solved',
      alg: "R U2 R' U' R U' R'",
      top: ['UC', 'UB', 'UR', 'UF', 'UL', 'UBR'],
      sides: ['FL', 'LB', 'RF'],
      rule: 'Hold the <strong>1 Yellow corner at Back-Right</strong>. If Yellow faces <strong>Front</strong> on the Front-Left corner, do <strong>Antisune</strong>.'
    }
  ],
  ollCornersSetup: [
    {
      id: '333-oll-h',
      title: 'H (Double Headlights)',
      badge: 'Sune → Sune',
      alg: "R U R' U R U2 R'",
      top: ['UC', 'UB', 'UR', 'UF', 'UL'],
      sides: ['LB', 'LF', 'RB', 'RF'],
      rule: 'Hold corner headlights on <strong>Left &amp; Right</strong> → <strong>Sune</strong> sets up <strong>Sune</strong>.'
    },
    {
      id: '333-oll-pi',
      title: 'Pi (One Headlights)',
      badge: 'Sune → Sune',
      alg: "R U R' U R U2 R'",
      top: ['UC', 'UB', 'UR', 'UF', 'UL'],
      sides: ['LB', 'LF', 'BR', 'FR'],
      rule: 'Hold corner headlights on <strong>Left</strong> → <strong>Sune</strong> sets up <strong>Sune</strong>.'
    },
    {
      id: '333-oll-u',
      title: 'U (Headlights Front)',
      badge: 'Sune → Antisune',
      alg: "R U R' U R U2 R'",
      top: ['UC', 'UB', 'UR', 'UF', 'UL', 'UBL', 'UBR'],
      sides: ['FL', 'FR'],
      rule: 'Put 2 Yellow corners in <strong>Back</strong> (headlights Front) → <strong>Sune</strong> sets up <strong>Antisune</strong>.'
    },
    {
      id: '333-oll-t',
      title: 'T (Chameleon)',
      badge: 'Sune → Antisune',
      alg: "R U R' U R U2 R'",
      top: ['UC', 'UB', 'UR', 'UF', 'UL', 'UBR', 'UFR'],
      sides: ['BL', 'FL'],
      rule: 'Put 2 Yellow corners on <strong>Right</strong> (stickers Front &amp; Back) → <strong>Sune</strong> sets up <strong>Antisune</strong>.'
    },
    {
      id: '333-oll-l',
      title: 'L (Diagonal Bowtie)',
      badge: 'Sune → Antisune',
      alg: "R U R' U R U2 R'",
      top: ['UC', 'UB', 'UR', 'UF', 'UL', 'UBL', 'UFR'],
      sides: ['FL', 'RB'],
      rule: 'Put Yellows at <strong>Back-Left &amp; Front-Right</strong> (Front-Left facing Front) → <strong>Sune</strong> gives <strong>Antisune</strong>.'
    }
  ],
  pllCorners: [
    {
      id: '333-pll-adj',
      title: 'Matching Corner Headlights (1 Step)',
      badge: 'Headlights Left → Solved',
      alg: "R U R' U' R' F R2 U' R' U' R U R' F'",
      sides: {
        LB: 'orange', LM: 'slate', LF: 'orange',
        BL: 'blue',   BM: 'slate', BR: 'red',
        FL: 'green',  FM: 'slate', FR: 'red',
        RB: 'green',  RM: 'slate', RF: 'blue'
      },
      arrows: [{ from: 'UBR', to: 'UFR', bidirectional: true, color: '#dc2626' }],
      highlightLeftHeadlights: true,
      rule: '<strong>Ignore the middle edges for a moment</strong> and look at the 4 corners. If two corner stickers match on the same side (<strong>&ldquo;headlights&rdquo;</strong>), turn Top until they sit on the <strong>Left</strong> and do <strong>T-Perm</strong> once to solve all four corners!'
    },
    {
      id: '333-pll-diag',
      title: 'No Corner Headlights Anywhere (2 Steps)',
      badge: 'Any Angle → Makes Headlights',
      alg: "R U R' U' R' F R2 U' R' U' R U R' F'",
      sides: {
        LB: 'red',   LM: 'slate', LF: 'orange',
        BL: 'green', BM: 'slate', BR: 'blue',
        FL: 'green', FM: 'slate', FR: 'blue',
        RB: 'red',   RM: 'slate', RF: 'orange'
      },
      arrows: [{ from: 'UFL', to: 'UBR', bidirectional: true, color: '#dc2626' }],
      rule: '<strong>Don&rsquo;t see matching corner headlights on any side?</strong> That means two diagonal corners need to swap (the Y-Perm pattern). Hold Top at <strong>any angle</strong> and do <strong>T-Perm</strong> once &mdash; it will create headlights. Then place those headlights on the <strong>Left</strong> and do <strong>T-Perm</strong> once more!'
    }
  ],
  pllEdges: [
    {
      id: '333-pll-ua',
      title: 'Ua Perm (Left ← Front ← Right Cycle)',
      badge: 'Bar in Back · Uses U',
      alg: "M2 U M U2 M' U M2",
      sides: {
        BL: 'blue',   BM: 'blue',   BR: 'blue',
        LB: 'orange', LM: 'green',  LF: 'orange',
        FL: 'green',  FM: 'red',    FR: 'green',
        RB: 'red',    RM: 'orange', RF: 'red'
      },
      arrows: [
        { from: 'UF', to: 'UR', color: '#2563eb' },
        { from: 'UR', to: 'UL', color: '#2563eb' },
        { from: 'UL', to: 'UF', color: '#2563eb' }
      ],
      highlightBackBar: true,
      rule: '<strong>Put the solved 3-sticker side bar in the Back.</strong> Check the Front-Top edge: if it belongs on the <strong>Right</strong> side (moving Front → Right → Left), do <strong>Ua Perm</strong> with regular <code>U</code> moves!'
    },
    {
      id: '333-pll-ub',
      title: 'Ub Perm (Right ← Front ← Left Cycle)',
      badge: 'Bar in Back · Uses U\'',
      alg: "M2 U' M U2 M' U' M2",
      sides: {
        BL: 'blue',   BM: 'blue',   BR: 'blue',
        LB: 'orange', LM: 'red',    LF: 'orange',
        FL: 'green',  FM: 'orange', FR: 'green',
        RB: 'red',    RM: 'green',  RF: 'red'
      },
      arrows: [
        { from: 'UF', to: 'UL', color: '#2563eb' },
        { from: 'UL', to: 'UR', color: '#2563eb' },
        { from: 'UR', to: 'UF', color: '#2563eb' }
      ],
      highlightBackBar: true,
      rule: '<strong>Put the solved bar in the Back.</strong> If the Front-Top edge belongs on the <strong>Left</strong> side (moving Front → Left → Right), do <strong>Ub Perm</strong> &mdash; the exact same moves, just swapping <code>U</code> for <code>U\'</code>!'
    },
    {
      id: '333-pll-no-bar',
      title: 'No Solved Bar Yet (All 4 Edges Unsolved · 2 Steps)',
      badge: 'Any Angle → Makes a Bar',
      alg: "M2 U M U2 M' U M2",
      sides: {
        BL: 'blue',   BM: 'green',  BR: 'blue',
        LB: 'orange', LM: 'red',    LF: 'orange',
        FL: 'green',  FM: 'blue',   FR: 'green',
        RB: 'red',    RM: 'orange', RF: 'red'
      },
      arrows: [
        { from: 'UF', to: 'UB', bidirectional: true, color: '#2563eb' },
        { from: 'UL', to: 'UR', bidirectional: true, color: '#2563eb' }
      ],
      rule: '<strong>All 4 middle edges are in the wrong spot (H or Z case)?</strong> Hold the cube from <strong>any angle</strong> and do <strong>Ua Perm</strong> once &mdash; it solves one full side bar. Put that bar in the <strong>Back</strong> and finish with Ua or Ub!'
    }
  ]
};

export function render333DaisyCrossGuideCardHtml() {
  return `
    <section class="guide-card guide-card-full tut-333-guide-card" data-333-guide="daisy-cross" aria-labelledby="tut333DaisyGuideTitle">
      <h3 id="tut333DaisyGuideTitle" class="guide-card-title">&#x1F33C; Stage 1 &amp; 2 Visual Guide &mdash; Daisy &amp; White Cross</h3>
      <p class="tut-oll-guide-subtitle">Hold the <strong>Yellow center on Top</strong> and <strong>White center on Bottom</strong>. Build a flower first, then drop each petal straight down to solve the White Cross.</p>
      <div class="tut-oll-guide-direct-grid">
        <div class="tut-oll-guide-item" data-333-guide-id="daisy">
          <div class="tut-oll-guide-diagram">
            ${render333OllDiagramSvg({
              top: ['UC'],
              customTop: { UB: 'white', UL: 'white', UR: 'white', UF: 'white' },
              caption: 'TOP VIEW',
              label: '3x3 Daisy around Yellow center diagram'
            })}
          </div>
          <div class="tut-oll-guide-body">
            <div class="tut-oll-guide-head">
              <strong>1. Build the Daisy (4 White Petals)</strong>
              <span class="badge">Around Yellow Center</span>
            </div>
            <p class="tut-oll-guide-desc">Bring the <strong>4 White middle-edge pieces</strong> up onto the Top layer around the Yellow center (corners don&rsquo;t matter yet, and side colors don&rsquo;t need to match yet).</p>
          </div>
        </div>

        <div class="tut-oll-guide-item" data-333-guide-id="cross-drop">
          <div class="tut-oll-guide-diagram">
            ${render333FrontFaceDiagramSvg({
              cells: ['slate', 'green', 'slate', 'slate', 'green', 'slate', 'slate', 'slate', 'slate'],
              topBar: ['', 'white', ''],
              bottomBar: ['', 'white', ''],
              arrows: [{ from: 1, to: 7, color: '#16a34a' }],
              caption: 'FRONT VIEW',
              label: '3x3 Match petal to center and drop F2 diagram'
            })}
          </div>
          <div class="tut-oll-guide-body">
            <div class="tut-oll-guide-head">
              <strong>2. Match Side Color &amp; Drop 180&deg;</strong>
              <span class="badge">U + F2 / R2 / B2 / L2</span>
            </div>
            <code class="tut-oll-guide-alg">Turn U until side matches center &rarr; F2 / R2 / B2 / L2</code>
            <p class="tut-oll-guide-desc">Pick one Daisy petal, spin Top (<code>U</code>) until its <strong>side color matches the middle center below it</strong>, then turn that matching face 180&deg; (<code>F2</code>, <code>R2</code>, <code>B2</code>, or <code>L2</code>) to send it to the White Cross on the bottom!</p>
          </div>
        </div>
      </div>
    </section>
  `;
}

export function render333WhiteCornersGuideCardHtml() {
  const cases = [
    {
      id: 'wc-righty',
      title: 'White Faces Right (1× Righty)',
      badge: 'White on Right',
      alg: "R U R' U'",
      cells: ['slate', 'slate', 'green', 'slate', 'green', 'slate', 'slate', 'green', 'slate'],
      topBar: ['', '', 'red'],
      rightBar: ['white', '', ''],
      bottomBar: ['', 'white', ''],
      arrows: [{ from: 2, to: 8, color: '#2563eb' }],
      rule: 'Place the corner above Front-Right. When White faces <strong>Right</strong>, <strong>Righty</strong> drops it straight in cleanly!'
    },
    {
      id: 'wc-inv-righty',
      title: 'White Faces Front (1× Inverse Righty)',
      badge: 'White on Front',
      alg: "U R U' R'",
      cells: ['slate', 'slate', 'white', 'slate', 'green', 'slate', 'slate', 'green', 'slate'],
      topBar: ['', '', 'green'],
      rightBar: ['red', '', ''],
      bottomBar: ['', 'white', ''],
      arrows: [{ from: 2, to: 8, color: '#2563eb' }],
      rule: 'When White faces <strong>you in Front</strong>, do <strong>Inverse Righty</strong> (or repeat Righty until it locks in).'
    },
    {
      id: 'wc-up',
      title: 'White Faces Up (3× Righty)',
      badge: 'White on Top',
      alg: "(R U R' U') × 3",
      cells: ['slate', 'slate', 'red', 'slate', 'green', 'slate', 'slate', 'green', 'slate'],
      topBar: ['', '', 'white'],
      rightBar: ['green', '', ''],
      bottomBar: ['', 'white', ''],
      arrows: [{ from: 2, to: 8, color: '#2563eb' }],
      rule: 'When White points <strong>Up</strong> on Top, repeat Righty <strong>3 times</strong>. <em>Tip: If a corner is stuck in the bottom wrong, 1&times; Righty pops it back to Top!</em>'
    }
  ];

  return `
    <section class="guide-card guide-card-full tut-333-guide-card" data-333-guide="white-corners" aria-labelledby="tut333CornersGuideTitle">
      <h3 id="tut333CornersGuideTitle" class="guide-card-title">&#x2B1C; Stage 3 Visual Guide &mdash; White Layer Corners (1st Layer)</h3>
      <p class="tut-oll-guide-subtitle">Keep the White Cross on the bottom. Align each White corner in the Top-Front-Right spot above its matching side centers, or use the quick <strong>Shortest</strong> button on each step.</p>
      <div class="tut-oll-guide-setup-grid">
        ${cases.map(c => `
          <div class="tut-oll-guide-item" data-333-guide-id="${c.id}">
            <div class="tut-oll-guide-diagram">
              ${render333FrontFaceDiagramSvg({
                cells: c.cells,
                topBar: c.topBar,
                rightBar: c.rightBar,
                bottomBar: c.bottomBar,
                arrows: c.arrows,
                caption: 'FRONT VIEW',
                label: `${c.title} 3x3 diagram`
              })}
            </div>
            <div class="tut-oll-guide-body">
              <div class="tut-oll-guide-head">
                <strong>${escapeHtml(c.title)}</strong>
                <span class="badge">${escapeHtml(c.badge)}</span>
              </div>
              <code class="tut-oll-guide-alg">${escapeHtml(c.alg)}</code>
              <p class="tut-oll-guide-desc">${c.rule}</p>
            </div>
          </div>
        `).join('')}
      </div>
    </section>
  `;
}

export function render333F2lEdgesGuideCardHtml() {
  const edgeCases = [
    {
      id: 'f2l-right',
      title: 'Insert Edge to the Right',
      badge: 'Top Color = Right Center',
      alg: "U R U R' U' y L' U' L U",
      cells: ['slate', 'green', 'slate', 'slate', 'green', 'slate', 'green', 'green', 'green'],
      topBar: ['', 'red', ''],
      leftBar: ['', 'orange', ''],
      rightBar: ['', 'red', ''],
      arrows: [{ from: 1, to: 5, color: '#dc2626' }],
      rule: '<strong>Match the front sticker to its center</strong> (Green here). Check the sticker on Top: if it matches the <strong>Right center</strong> (Red), push away + Righty, turn <code>y</code> + Lefty! <em>(Move away &rarr; insert &rarr; rotate &rarr; finish pair.)</em>'
    },
    {
      id: 'f2l-left',
      title: 'Insert Edge to the Left',
      badge: 'Top Color = Left Center',
      alg: "U' L' U' L U y' R U R' U'",
      cells: ['slate', 'green', 'slate', 'slate', 'green', 'slate', 'green', 'green', 'green'],
      topBar: ['', 'orange', ''],
      leftBar: ['', 'orange', ''],
      rightBar: ['', 'red', ''],
      arrows: [{ from: 1, to: 3, color: '#2563eb' }],
      rule: 'If the edge&rsquo;s <strong>Top sticker matches the Left center</strong> (Orange), push away with <code>U\'</code> + Lefty, turn <code>y\'</code> + Righty! <em>Tip: If a middle edge is flipped or stuck in a slot, inserting any Yellow edge knocks it up to Top.</em>'
    }
  ];

  return `
    <section class="guide-card guide-card-full tut-333-guide-card" data-333-guide="f2l-edges" aria-labelledby="tut333F2lGuideTitle">
      <h3 id="tut333F2lGuideTitle" class="guide-card-title">&#x1F9F1; Stage 4 Visual Guide &mdash; Middle Layer Edges (F2L)</h3>
      <p class="tut-oll-guide-subtitle">Find a top-layer edge with <strong>no Yellow</strong>, turn <code>U</code> to match its front color to the center below, then send it Left or Right into the middle layer.</p>
      <div class="tut-oll-guide-direct-grid">
        ${edgeCases.map(c => `
          <div class="tut-oll-guide-item" data-333-guide-id="${c.id}">
            <div class="tut-oll-guide-diagram">
              ${render333FrontFaceDiagramSvg({
                cells: c.cells,
                topBar: c.topBar,
                leftBar: c.leftBar,
                rightBar: c.rightBar,
                arrows: c.arrows,
                caption: 'FRONT VIEW',
                label: `${c.title} 3x3 diagram`
              })}
            </div>
            <div class="tut-oll-guide-body">
              <div class="tut-oll-guide-head">
                <strong>${escapeHtml(c.title)}</strong>
                <span class="badge">${escapeHtml(c.badge)}</span>
              </div>
              <code class="tut-oll-guide-alg">${escapeHtml(c.alg)}</code>
              <p class="tut-oll-guide-desc">${c.rule}</p>
            </div>
          </div>
        `).join('')}
      </div>
    </section>
  `;
}

export function render333OllVisualGuideCardHtml() {
  const renderCard = (item) => `
    <div class="tut-oll-guide-item" data-oll-guide-id="${escapeHtml(item.id)}">
      <div class="tut-oll-guide-diagram">
        ${render333OllDiagramSvg({ top: item.top, sides: item.sides, label: `${item.title} 3x3 OLL diagram` })}
      </div>
      <div class="tut-oll-guide-body">
        <div class="tut-oll-guide-head">
          <strong>${escapeHtml(item.title)}</strong>
          <span class="badge">${escapeHtml(item.badge)}</span>
        </div>
        <code class="tut-oll-guide-alg">${escapeHtml(item.alg)}</code>
        <p class="tut-oll-guide-desc">${item.rule}</p>
      </div>
    </div>
  `;

  return `
    <section class="guide-card guide-card-full tut-oll-guide-card" data-333-guide="oll" aria-labelledby="tut333OllGuideTitle">
      <h3 id="tut333OllGuideTitle" class="guide-card-title">&#x1F50D; Stage 5 Visual Guide &mdash; 3&times;3 Yellow Cross &amp; Corners (OLL)</h3>
      <p class="tut-oll-guide-subtitle">All diagrams show the <strong>3&times;3 Top (Yellow) face</strong> from above with <strong>Front</strong> at the bottom. First make the Yellow Cross, then use <strong>Sune &amp; Antisune</strong> for the corners.</p>
      <div class="tut-oll-guide-group-title">1. Build Yellow Cross &mdash; F (Righty) F&apos;</div>
      <div class="tut-oll-guide-setup-grid">
        ${THREE_BY_THREE_VISUAL_GUIDES.yellowCross.map(renderCard).join('')}
      </div>
      <div class="tut-oll-guide-group-title">2. Direct 1-Look Yellow Corners (1 Yellow Corner + Cross &mdash; Solves Yellow!)</div>
      <div class="tut-oll-guide-direct-grid">
        ${THREE_BY_THREE_VISUAL_GUIDES.ollCornersDirect.map(renderCard).join('')}
      </div>
      <div class="tut-oll-guide-group-title">3. 2-Look Setup (0 or 2 Yellow Corners + Cross &rarr; Sets up Sune or Antisune)</div>
      <div class="tut-oll-guide-setup-grid">
        ${THREE_BY_THREE_VISUAL_GUIDES.ollCornersSetup.map(renderCard).join('')}
      </div>
    </section>
  `;
}

export function render333PllVisualGuideCardHtml() {
  const renderPllCard = (item) => `
    <div class="tut-oll-guide-item" data-pll-guide-id="${escapeHtml(item.id)}">
      <div class="tut-oll-guide-diagram">
        ${render333PllDiagramSvg({
          sides: item.sides,
          arrows: item.arrows,
          highlightLeftHeadlights: Boolean(item.highlightLeftHeadlights),
          highlightBackBar: Boolean(item.highlightBackBar),
          label: `${item.title} 3x3 PLL diagram`
        })}
      </div>
      <div class="tut-oll-guide-body">
        <div class="tut-oll-guide-head">
          <strong>${escapeHtml(item.title)}</strong>
          <span class="badge">${escapeHtml(item.badge)}</span>
        </div>
        <code class="tut-oll-guide-alg">${escapeHtml(item.alg)}</code>
        <p class="tut-oll-guide-desc">${item.rule}</p>
      </div>
    </div>
  `;

  return `
    <section class="guide-card guide-card-full tut-pll-guide-card" data-333-guide="pll" aria-labelledby="tut333PllGuideTitle">
      <h3 id="tut333PllGuideTitle" class="guide-card-title">&#x1F9E9; Stage 6 Visual Guide &mdash; 3&times;3 Last Layer (T-Perm Corners + Ua / Ub Edges)</h3>
      <p class="tut-oll-guide-subtitle">Look at the <strong>3&times;3 Top layer</strong> from above with <strong>Front</strong> at the bottom. Solve the 4 corners first using <strong>T-Perm</strong>, then finish the middle edges with <strong>Ua</strong> or <strong>Ub Perm</strong>.</p>
      <div class="tut-oll-guide-group-title">1. Top Corners (T-Perm) &mdash; Ignore Middle Edges Until Corners Match</div>
      <div class="tut-oll-guide-direct-grid">
        ${THREE_BY_THREE_VISUAL_GUIDES.pllCorners.map(renderPllCard).join('')}
      </div>
      <div class="tut-oll-guide-group-title">2. Last 3 Edges (Ua &amp; Ub Perms) &mdash; Solved Bar in Back</div>
      <div class="tut-oll-guide-setup-grid">
        ${THREE_BY_THREE_VISUAL_GUIDES.pllEdges.map(renderPllCard).join('')}
      </div>
    </section>
  `;
}
