// Pure SVG diagram generators for all supported cubing cases (2x2 CLL/Ortega, 3x3 CFOP, 4x4/5x5 parity)

import { Alg } from 'cubing/alg';
import {
  CORNER_FACES_333,
  EDGE_FACES_333,
  CENTER_FACE_LETTERS,
  getKpuzzle
} from './cubeUtils.js';
import { CUBE_COLORS, FACE_COLORS, onCubeColorsChange } from './cubeColors.js';

function getKp2() {
  return getKpuzzle('2x2x2');
}

function getKp3() {
  return getKpuzzle('3x3x3');
}

function normalizeCachePuzzle(puzzleId) {
  return puzzleId === "333oh" ? "333" : puzzleId;
}

function getCaseSvgCacheKey(puzzleId, trackId, caseObj) {
  const normPuz = normalizeCachePuzzle(puzzleId);
  const setupPart = caseObj?.setup || caseObj?.scramble || "";
  return setupPart
    ? `${normPuz}-${trackId}-${caseObj.id}::${setupPart}`
    : `${normPuz}-${trackId}-${caseObj.id}`;
}

function buildArrowSegmentSvg(x1, y1, x2, y2, color, bidirectional = false) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (len < 1) return "";
  const ux = dx / len;
  const uy = dy / len;
  const headLen = 6.5;
  const headHalfW = 3.6;

  const endTipX = x2 - ux * 2;
  const endTipY = y2 - uy * 2;
  const endBaseX = endTipX - ux * headLen;
  const endBaseY = endTipY - uy * headLen;

  const startTipX = x1 + ux * 2;
  const startTipY = y1 + uy * 2;
  const startBaseX = startTipX + ux * headLen;
  const startBaseY = startTipY + uy * headLen;

  const lineStartX = bidirectional ? startBaseX : x1;
  const lineStartY = bidirectional ? startBaseY : y1;
  const lineEndX = endBaseX;
  const lineEndY = endBaseY;

  const px = -uy * headHalfW;
  const py = ux * headHalfW;

  const endHead = `<polygon points="${endTipX.toFixed(1)},${endTipY.toFixed(1)} ${(endBaseX + px).toFixed(1)},${(endBaseY + py).toFixed(1)} ${(endBaseX - px).toFixed(1)},${(endBaseY - py).toFixed(1)}" fill="${color}"/>`;
  const startHead = bidirectional
    ? `<polygon points="${startTipX.toFixed(1)},${startTipY.toFixed(1)} ${(startBaseX + px).toFixed(1)},${(startBaseY + py).toFixed(1)} ${(startBaseX - px).toFixed(1)},${(startBaseY - py).toFixed(1)}" fill="${color}"/>`
    : "";

  return `<line x1="${lineStartX.toFixed(1)}" y1="${lineStartY.toFixed(1)}" x2="${lineEndX.toFixed(1)}" y2="${lineEndY.toFixed(1)}" stroke="${color}" stroke-width="2.6" stroke-linecap="round"/>${endHead}${startHead}`;
}

function derivePllArrows(cPieces, ePieces, cornerCenters, edgeCenters) {
  let best = null;

  const extractCycles = (arr, aufK) => {
    const seen = new Set();
    const cycles = [];
    let moved = 0;
    let maxLen = 0;
    for (let i = 0; i < 4; i++) {
      const next = (arr[i] + aufK) % 4;
      if (next !== i) moved++;
      if (seen.has(i) || next === i) continue;
      const chain = [];
      let cur = i;
      while (!seen.has(cur)) {
        seen.add(cur);
        chain.push(cur);
        cur = (arr[cur] + aufK) % 4;
      }
      if (chain.length > 1) {
        cycles.push(chain);
        if (chain.length > maxLen) maxLen = chain.length;
      }
    }
    return { cycles, moved, maxLen };
  };

  for (let k = 0; k < 4; k++) {
    const cRes = extractCycles(cPieces, k);
    const eRes = extractCycles(ePieces, k);
    const totalMoved = cRes.moved + eRes.moved;
    const maxLen = Math.max(cRes.maxLen, eRes.maxLen);
    const score = totalMoved * 100 + maxLen * 10 + (k === 0 ? 0 : k);
    if (!best || score < best.score) {
      best = { score, cornerCycles: cRes.cycles, edgeCycles: eRes.cycles };
    }
  }

  if (!best) return "";
  let svg = "";
  const cornerColor = CUBE_COLORS.red;
  const edgeColor = CUBE_COLORS.blue;

  const renderCycles = (cycles, centers, color) => {
    for (const cyc of cycles) {
      if (cyc.length === 2) {
        const [a, b] = cyc;
        svg += buildArrowSegmentSvg(centers[a][0], centers[a][1], centers[b][0], centers[b][1], color, true);
      } else if (cyc.length >= 3) {
        for (let i = 0; i < cyc.length; i++) {
          const from = centers[cyc[i]];
          const to = centers[cyc[(i + 1) % cyc.length]];
          svg += buildArrowSegmentSvg(from[0], from[1], to[0], to[1], color, false);
        }
      }
    }
  };

  renderCycles(best.cornerCycles, cornerCenters, cornerColor);
  renderCycles(best.edgeCycles, edgeCenters, edgeColor);
  return svg;
}

const svgCache = new Map();
let prewarmPromise = null;
let ollPllPrewarmed = false;

export function clearSvgCache() {
  svgCache.clear();
  prewarmPromise = null;
  ollPllPrewarmed = false;
}

onCubeColorsChange(clearSvgCache);

export function isOllPllSvgsPrewarmed() {
  return ollPllPrewarmed;
}

export function getCachedCaseSvg(puzzleId, trackId, caseId) {
  if (!caseId) return "";
  const normPuz = normalizeCachePuzzle(puzzleId);
  return svgCache.get(`${normPuz}-${trackId}-${caseId}`) || "";
}

export async function prewarmOllPllSvgs(ollList = [], pllList = []) {
  if (ollPllPrewarmed) return;
  if (prewarmPromise) return prewarmPromise;
  const ollArr = Array.isArray(ollList) ? ollList : (ollList?.cases || []);
  const pllArr = Array.isArray(pllList) ? pllList : (pllList?.cases || []);
  prewarmPromise = (async () => {
    try {
      for (const c of ollArr) {
        const svg = await renderCaseSvg("333", "oll", c);
        svgCache.set(`333-oll-${c.id}`, svg);
        if (c.number != null) {
          svgCache.set(`333-oll-OLL ${c.number}`, svg);
        }
      }
      const ollSkipSvg = await renderCaseSvg("333", "oll", { id: "OLL Skip", setup: "" });
      svgCache.set("333-oll-OLL Skip", ollSkipSvg);
      for (const c of pllArr) {
        const svg = await renderCaseSvg("333", "pll", c);
        svgCache.set(`333-pll-${c.id}`, svg);
      }
      const pllSkipSvg = await renderCaseSvg("333", "pll", { id: "PLL Skip", setup: "" });
      svgCache.set("333-pll-PLL Skip", pllSkipSvg);
    } catch (e) {
      console.warn("Could not prewarm OLL/PLL SVGs:", e);
    } finally {
      ollPllPrewarmed = true;
    }
  })();
  return prewarmPromise;
}

export async function renderCaseSvg(puzzleId, trackId, caseObj) {
  if (!caseObj) return "";
  const cacheKey = getCaseSvgCacheKey(puzzleId, trackId, caseObj);
  if (svgCache.has(cacheKey)) return svgCache.get(cacheKey);

  let svg = "";
  let failed = false;
  try {
    if (puzzleId === "222") {
      if (trackId === "ortega") {
        svg = await renderOrtegaSvg(caseObj);
      } else if (trackId === "lbl") {
        svg = caseObj.group?.startsWith("OLL")
          ? await renderOrtegaSvg(caseObj)
          : await renderCllSvg(caseObj);
      } else if (trackId === "eg1") {
        svg = await renderCllSvg(caseObj, { bottomBadge: "back-bar" });
      } else if (trackId === "eg2") {
        svg = await renderCllSvg(caseObj, { bottomBadge: "diag" });
      } else {
        svg = await renderCllSvg(caseObj);
      }
    } else if (puzzleId === "444") {
      svg = render444ParitySvg(caseObj);
    } else if (puzzleId === "555") {
      svg = render555ParitySvg(caseObj);
    } else {
      // 333 and 333oh
      if (trackId === "pll") {
        svg = await renderPllSvg(caseObj);
      } else if (trackId === "oll") {
        svg = await renderOllSvg(caseObj);
      } else if (trackId === "f2l") {
        svg = await renderF2lSvg(caseObj);
      } else {
        svg = renderCrossSvg(caseObj);
      }
    }
  } catch (err) {
    console.error("Failed to render case SVG:", err);
    svg = renderFallbackSvg(caseObj.id || "?");
    failed = true;
  }

  if (!failed) {
    svgCache.set(cacheKey, svg);
    const bareKey = `${normalizeCachePuzzle(puzzleId)}-${trackId}-${caseObj.id}`;
    if (!svgCache.has(bareKey)) svgCache.set(bareKey, svg);
  }
  return svg;
}

// ---------------------------------------------------------------------------
// 2x2 CLL SVG Generator (Cross-shaped top view with 4 side bars)
// ---------------------------------------------------------------------------
export async function renderCllSvg(caseObj, { bottomBadge = null } = {}) {
  const kp = await getKp2();
  const def = kp.defaultPattern();
  const scr = caseObj.setup || caseObj.scramble || caseObj.scrambles?.[0] || "";
  const pat = scr ? def.applyAlg(new Alg(scr)) : def;

  const { pieces, orientation } = pat.patternData.CORNERS;
  const color = (loc, o) =>
    FACE_COLORS[CORNER_FACES_333[pieces[loc]][(o - orientation[loc] + 3) % 3]] || CUBE_COLORS.yellow;

  const S = 32;
  const D = 9;
  const G = 3;
  const M = 3;
  const T = M + D + G;
  const W = T * 2 + 2 * S;
  const H = bottomBadge ? W + 15 : W;

  const rect = (x, y, w, h, fill) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.5" fill="${fill}" stroke="#1e293b" stroke-width="1.15"/>`;

  let badgeMarkup = "";
  if (bottomBadge === "back-bar") {
    badgeMarkup = `
      <g class="eg-bottom-badge" aria-label="Bottom: Back Bar">
        <rect x="${T}" y="${W + 1}" width="${2 * S}" height="12" rx="3" fill="#0f172a" stroke="#334155" stroke-width="0.9"/>
        <rect x="${T + 5}" y="${W + 4.5}" width="16" height="5" rx="1.5" fill="#22c55e"/>
        <text x="${T + 26}" y="${W + 9.5}" font-size="7.2" font-weight="700" fill="#e2e8f0" font-family="system-ui, sans-serif">D: BAR</text>
      </g>`;
  } else if (bottomBadge === "diag") {
    badgeMarkup = `
      <g class="eg-bottom-badge" aria-label="Bottom: Diagonal Swap">
        <rect x="${T}" y="${W + 1}" width="${2 * S}" height="12" rx="3" fill="#0f172a" stroke="#334155" stroke-width="0.9"/>
        <line x1="${T + 7}" y1="${W + 4}" x2="${T + 15}" y2="${W + 10}" stroke="#f59e0b" stroke-width="1.6" stroke-linecap="round"/>
        <line x1="${T + 15}" y1="${W + 4}" x2="${T + 7}" y2="${W + 10}" stroke="#f59e0b" stroke-width="1.6" stroke-linecap="round"/>
        <text x="${T + 22}" y="${W + 9.5}" font-size="7.2" font-weight="700" fill="#e2e8f0" font-family="system-ui, sans-serif">D: DIAG</text>
      </g>`;
  }

  return `<svg viewBox="0 0 ${W} ${H}" class="case-svg case-svg-222" xmlns="http://www.w3.org/2000/svg">
    <!-- Top face (UBL, UBR, UFL, UFR) -->
    ${rect(T, T, S, S, color(2, 0))}
    ${rect(T + S, T, S, S, color(1, 0))}
    ${rect(T, T + S, S, S, color(3, 0))}
    ${rect(T + S, T + S, S, S, color(0, 0))}

    <!-- Back side (top bar) -->
    ${rect(T, M, S, D, color(2, 2))}
    ${rect(T + S, M, S, D, color(1, 1))}

    <!-- Front side (bottom bar) -->
    ${rect(T, T + 2 * S + G, S, D, color(3, 1))}
    ${rect(T + S, T + 2 * S + G, S, D, color(0, 2))}

    <!-- Left side (left bar) -->
    ${rect(M, T, D, S, color(2, 1))}
    ${rect(M, T + S, D, S, color(3, 2))}

    <!-- Right side (right bar) -->
    ${rect(T + 2 * S + G, T, D, S, color(1, 2))}
    ${rect(T + 2 * S + G, T + S, D, S, color(0, 1))}
    ${badgeMarkup}
  </svg>`;
}

// ---------------------------------------------------------------------------
// 2x2 Ortega SVG (OLL & PBL)
// ---------------------------------------------------------------------------
export async function renderOrtegaSvg(caseObj) {
  if (caseObj.group && caseObj.group.startsWith("PBL")) {
    return renderPblSvg(caseObj);
  }

  const kp = await getKp2();
  const def = kp.defaultPattern();
  const scr = caseObj.setup || caseObj.scramble || "";
  const pat = scr ? def.applyAlg(new Alg(scr)) : def;

  const { pieces, orientation } = pat.patternData.CORNERS;
  const isYellow = (loc, o) => {
    const face = CORNER_FACES_333[pieces[loc]][(o - orientation[loc] + 3) % 3];
    return face === "U";
  };

  const S = 32;
  const D = 9;
  const G = 3;
  const M = 3;
  const T = M + D + G;
  const W = T * 2 + 2 * S;

  const rect = (x, y, w, h, fill) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.5" fill="${fill}" stroke="#1e293b" stroke-width="1.15"/>`;

  const topColor = (loc) => isYellow(loc, 0) ? CUBE_COLORS.yellow : CUBE_COLORS.slate;

  return `<svg viewBox="0 0 ${W} ${W}" class="case-svg case-svg-ortega-oll" xmlns="http://www.w3.org/2000/svg">
    <!-- Top Face (UBL, UBR, UFL, UFR) -->
    ${rect(T, T, S, S, topColor(2))}
    ${rect(T + S, T, S, S, topColor(1))}
    ${rect(T, T + S, S, S, topColor(3))}
    ${rect(T + S, T + S, S, S, topColor(0))}

    <!-- Perimeter Yellow Indicators -->
    ${isYellow(2, 2) ? rect(T, M, S, D, CUBE_COLORS.yellow) : ""}
    ${isYellow(1, 1) ? rect(T + S, M, S, D, CUBE_COLORS.yellow) : ""}
    ${isYellow(3, 1) ? rect(T, T + 2 * S + G, S, D, CUBE_COLORS.yellow) : ""}
    ${isYellow(0, 2) ? rect(T + S, T + 2 * S + G, S, D, CUBE_COLORS.yellow) : ""}
    ${isYellow(2, 1) ? rect(M, T, D, S, CUBE_COLORS.yellow) : ""}
    ${isYellow(3, 2) ? rect(M, T + S, D, S, CUBE_COLORS.yellow) : ""}
    ${isYellow(1, 2) ? rect(T + 2 * S + G, T, D, S, CUBE_COLORS.yellow) : ""}
    ${isYellow(0, 1) ? rect(T + 2 * S + G, T + S, D, S, CUBE_COLORS.yellow) : ""}
  </svg>`;
}

function renderPblSvg(caseObj) {
  const key = `${caseObj.id || ""} ${caseObj.name || ""}`.toLowerCase();
  const isOppOpp = /opp[\s/_-]*opp|both opposite/.test(key);
  const isAdjOpp = /adj[\s/_-]*opp|top adj.*bottom opp/.test(key);
  const isAdjSolved = /adj[\s/_-]*solved|top adj.*bottom solved/.test(key);
  const isOppSolved = /opp[\s/_-]*solved|top opp.*bottom solved/.test(key);

  const topText = (isOppOpp || isOppSolved) ? "OPP SWAP" : "ADJ BAR";
  const bottomText = (isAdjSolved || isOppSolved)
    ? "SOLVED"
    : ((isOppOpp || isAdjOpp) ? "OPP SWAP" : "ADJ BAR");

  return `<svg viewBox="0 0 100 100" class="case-svg case-svg-pbl" xmlns="http://www.w3.org/2000/svg">
    <rect x="8" y="8" width="84" height="84" rx="8" fill="#1e2430" stroke="#333d4d" stroke-width="2"/>
    <rect x="18" y="18" width="64" height="26" rx="3" fill="${CUBE_COLORS.yellow}" stroke="#1e293b" stroke-width="1.2"/>
    <text x="50" y="35" text-anchor="middle" font-size="11" font-weight="700" fill="#111827">${topText}</text>
    <line x1="14" y1="50" x2="86" y2="50" stroke="#4a5568" stroke-width="2" stroke-dasharray="3,3"/>
    <rect x="18" y="56" width="64" height="26" rx="3" fill="${CUBE_COLORS.white}" stroke="#1e293b" stroke-width="1.2"/>
    <text x="50" y="73" text-anchor="middle" font-size="11" font-weight="700" fill="#111827">${bottomText}</text>
  </svg>`;
}

// ---------------------------------------------------------------------------
// 3x3 OLL SVG (Orientation of the Last Layer - 57 Cases)
// ---------------------------------------------------------------------------
export async function renderOllSvg(caseObj) {
  const kp = await getKp3();
  const def = kp.defaultPattern();
  const scr = caseObj.setup || "";
  const pat = scr ? def.applyAlg(new Alg(scr)) : def;

  const { pieces: cPieces, orientation: cOrient } = pat.patternData.CORNERS;
  const { pieces: ePieces, orientation: eOrient } = pat.patternData.EDGES;

  const isCornerYellow = (loc, faceIdx) =>
    CORNER_FACES_333[cPieces[loc]][(faceIdx - cOrient[loc] + 3) % 3] === "U";

  const isEdgeYellow = (loc, faceIdx) =>
    EDGE_FACES_333[ePieces[loc]][(faceIdx - eOrient[loc] + 2) % 2] === "U";

  const S = 22;
  const D = 7;
  const G = 2.5;
  const M = 2.5;
  const T = M + D + G;
  const W = T * 2 + 3 * S;

  const rect = (x, y, w, h, fill) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.5" fill="${fill}" stroke="#1e293b" stroke-width="1.1"/>`;

  const topColor = (isY) => isY ? CUBE_COLORS.yellow : CUBE_COLORS.slate;

  return `<svg viewBox="0 0 ${W} ${W}" class="case-svg case-svg-oll" xmlns="http://www.w3.org/2000/svg">
    <!-- Top Face (3x3 grid) -->
    ${rect(T, T, S, S, topColor(isCornerYellow(2, 0)))}
    ${rect(T + S, T, S, S, topColor(isEdgeYellow(2, 0)))}
    ${rect(T + 2 * S, T, S, S, topColor(isCornerYellow(1, 0)))}

    ${rect(T, T + S, S, S, topColor(isEdgeYellow(3, 0)))}
    ${rect(T + S, T + S, S, S, CUBE_COLORS.yellow)}
    ${rect(T + 2 * S, T + S, S, S, topColor(isEdgeYellow(1, 0)))}

    ${rect(T, T + 2 * S, S, S, topColor(isCornerYellow(3, 0)))}
    ${rect(T + S, T + 2 * S, S, S, topColor(isEdgeYellow(0, 0)))}
    ${rect(T + 2 * S, T + 2 * S, S, S, topColor(isCornerYellow(0, 0)))}

    <!-- Back side (top) yellow indicators -->
    ${isCornerYellow(2, 2) ? rect(T, M, S, D, CUBE_COLORS.yellow) : ""}
    ${isEdgeYellow(2, 1) ? rect(T + S, M, S, D, CUBE_COLORS.yellow) : ""}
    ${isCornerYellow(1, 1) ? rect(T + 2 * S, M, S, D, CUBE_COLORS.yellow) : ""}

    <!-- Front side (bottom) yellow indicators -->
    ${isCornerYellow(3, 1) ? rect(T, T + 3 * S + G, S, D, CUBE_COLORS.yellow) : ""}
    ${isEdgeYellow(0, 1) ? rect(T + S, T + 3 * S + G, S, D, CUBE_COLORS.yellow) : ""}
    ${isCornerYellow(0, 2) ? rect(T + 2 * S, T + 3 * S + G, S, D, CUBE_COLORS.yellow) : ""}

    <!-- Left side (left) yellow indicators -->
    ${isCornerYellow(2, 1) ? rect(M, T, D, S, CUBE_COLORS.yellow) : ""}
    ${isEdgeYellow(3, 1) ? rect(M, T + S, D, S, CUBE_COLORS.yellow) : ""}
    ${isCornerYellow(3, 2) ? rect(M, T + 2 * S, D, S, CUBE_COLORS.yellow) : ""}

    <!-- Right side (right) yellow indicators -->
    ${isCornerYellow(1, 2) ? rect(T + 3 * S + G, T, D, S, CUBE_COLORS.yellow) : ""}
    ${isEdgeYellow(1, 1) ? rect(T + 3 * S + G, T + S, D, S, CUBE_COLORS.yellow) : ""}
    ${isCornerYellow(0, 1) ? rect(T + 3 * S + G, T + 2 * S, D, S, CUBE_COLORS.yellow) : ""}
  </svg>`;
}

// ---------------------------------------------------------------------------
// 3x3 PLL SVG (Permutation of the Last Layer - 21 Cases)
// ---------------------------------------------------------------------------
export async function renderPllSvg(caseObj) {
  const kp = await getKp3();
  const def = kp.defaultPattern();
  const scr = caseObj.setup || "";
  const pat = scr ? def.applyAlg(new Alg(scr)) : def;

  const { pieces: cPieces, orientation: cOrient } = pat.patternData.CORNERS;
  const { pieces: ePieces, orientation: eOrient } = pat.patternData.EDGES;

  const cornerColor = (loc, o) =>
    FACE_COLORS[CORNER_FACES_333[cPieces[loc]][(o - cOrient[loc] + 3) % 3]] || CUBE_COLORS.yellow;

  const edgeColor = (loc, o) =>
    FACE_COLORS[EDGE_FACES_333[ePieces[loc]][(o - eOrient[loc] + 2) % 2]] || CUBE_COLORS.yellow;

  const S = 22;
  const D = 8;
  const G = 2.5;
  const M = 2.5;
  const T = M + D + G;
  const W = T * 2 + 3 * S;

  const rect = (x, y, w, h, fill) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.5" fill="${fill}" stroke="#1e293b" stroke-width="1.1"/>`;

  const c0 = T + 0.5 * S;
  const c1 = T + 1.5 * S;
  const c2 = T + 2.5 * S;
  const cornerCenters = [
    [c2, c2], // 0: UFR
    [c2, c0], // 1: UBR
    [c0, c0], // 2: UBL
    [c0, c2]  // 3: UFL
  ];
  const edgeCenters = [
    [c1, c2], // 0: UF
    [c2, c1], // 1: UR
    [c1, c0], // 2: UB
    [c0, c1]  // 3: UL
  ];
  const arrowSvg = derivePllArrows(cPieces.slice(0, 4), ePieces.slice(0, 4), cornerCenters, edgeCenters);

  return `<svg viewBox="0 0 ${W} ${W}" class="case-svg case-svg-pll" xmlns="http://www.w3.org/2000/svg">
    <!-- Top Face (All 9 yellow) -->
    ${rect(T, T, S, S, CUBE_COLORS.yellow)}
    ${rect(T + S, T, S, S, CUBE_COLORS.yellow)}
    ${rect(T + 2 * S, T, S, S, CUBE_COLORS.yellow)}
    ${rect(T, T + S, S, S, CUBE_COLORS.yellow)}
    ${rect(T + S, T + S, S, S, CUBE_COLORS.yellow)}
    ${rect(T + 2 * S, T + S, S, S, CUBE_COLORS.yellow)}
    ${rect(T, T + 2 * S, S, S, CUBE_COLORS.yellow)}
    ${rect(T + S, T + 2 * S, S, S, CUBE_COLORS.yellow)}
    ${rect(T + 2 * S, T + 2 * S, S, S, CUBE_COLORS.yellow)}

    <!-- Back Side (top bar): UBL (2), UB (2), UBR (1) -->
    ${rect(T, M, S, D, cornerColor(2, 2))}
    ${rect(T + S, M, S, D, edgeColor(2, 1))}
    ${rect(T + 2 * S, M, S, D, cornerColor(1, 1))}

    <!-- Front Side (bottom bar): UFL (3), UF (0), UFR (0) -->
    ${rect(T, T + 3 * S + G, S, D, cornerColor(3, 1))}
    ${rect(T + S, T + 3 * S + G, S, D, edgeColor(0, 1))}
    ${rect(T + 2 * S, T + 3 * S + G, S, D, cornerColor(0, 2))}

    <!-- Left Side (left bar): UBL (2), UL (3), UFL (3) -->
    ${rect(M, T, D, S, cornerColor(2, 1))}
    ${rect(M, T + S, D, S, edgeColor(3, 1))}
    ${rect(M, T + 2 * S, D, S, cornerColor(3, 2))}

    <!-- Right Side (right bar): UBR (1), UR (1), UFR (0) -->
    ${rect(T + 3 * S + G, T, D, S, cornerColor(1, 2))}
    ${rect(T + 3 * S + G, T + S, D, S, edgeColor(1, 1))}
    ${rect(T + 3 * S + G, T + 2 * S, D, S, cornerColor(0, 1))}

    <!-- Permutation Swap Arrows Overlay -->
    ${arrowSvg}
  </svg>`;
}

// ---------------------------------------------------------------------------
// 3x3 F2L SVG (First Two Layers - 41 Cases)
// ---------------------------------------------------------------------------
export async function renderF2lSvg(caseObj) {
  const kp = await getKp3();
  const def = kp.defaultPattern();
  const scr = caseObj.setup || "";
  const pat = scr ? def.applyAlg(new Alg(scr)) : def;

  const centerPieces = pat.patternData.CENTERS.pieces;
  const origToVisualFace = {};
  for (let i = 0; i < 6; i++) {
    origToVisualFace[CENTER_FACE_LETTERS[centerPieces[i]]] = CENTER_FACE_LETTERS[i];
  }

  const { pieces: cPieces, orientation: cOrient } = pat.patternData.CORNERS;
  const { pieces: ePieces, orientation: eOrient } = pat.patternData.EDGES;

  const targetCornerOrig = cPieces.findIndex((_, idx) => {
    const faces = CORNER_FACES_333[idx].map(f => origToVisualFace[f]);
    return faces.includes("D") && faces.includes("F") && faces.includes("R");
  });
  const targetEdgeOrig = ePieces.findIndex((_, idx) => {
    const faces = EDGE_FACES_333[idx].map(f => origToVisualFace[f]);
    return faces.includes("F") && faces.includes("R");
  });

  const visualFaceColor = (vFace) => FACE_COLORS[vFace] || CUBE_COLORS.slate;

  const f2lCornerColor = (loc, faceIdx, isBaseSlot = false) => {
    const piece = cPieces[loc];
    if (piece === targetCornerOrig) {
      const origFace = CORNER_FACES_333[piece][(faceIdx - cOrient[loc] + 3) % 3];
      return visualFaceColor(origToVisualFace[origFace]);
    }
    // Target slot stays empty (slate) unless the target corner is actually inside it
    return CUBE_COLORS.slate;
  };

  const f2lEdgeColor = (loc, faceIdx, isBaseSlot = false) => {
    const piece = ePieces[loc];
    if (piece === targetEdgeOrig) {
      const origFace = EDGE_FACES_333[piece][(faceIdx - eOrient[loc] + 2) % 2];
      return visualFaceColor(origToVisualFace[origFace]);
    }
    // Target slot stays empty (slate) unless the target edge is actually inside it
    return CUBE_COLORS.slate;
  };

  const ox = 50, oy = 48;
  const ax = -13.5, ay = -7.0;
  const bx = 13.5, by = -7.0;
  const zx = 0, zy = 14.5;

  const pt = (a, b, z) => [
    (ox + a * ax + b * bx + z * zx).toFixed(1),
    (oy + a * ay + b * by + z * zy).toFixed(1)
  ];

  const poly = (pts, fill) =>
    `<polygon points="${pts.map(p => p.join(",")).join(" ")}" fill="${fill}" stroke="#1e293b" stroke-width="1.15" stroke-linejoin="round"/>`;

  let stickers = "";

  const uColors = [
    [f2lCornerColor(2, 0), f2lEdgeColor(2, 0), f2lCornerColor(1, 0)],
    [f2lEdgeColor(3, 0),   CUBE_COLORS.yellow, f2lEdgeColor(1, 0)],
    [f2lCornerColor(3, 0), f2lEdgeColor(0, 0), f2lCornerColor(0, 0)]
  ];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      const a0 = 3 - c, a1 = 2 - c;
      const b0 = 3 - r, b1 = 2 - r;
      stickers += poly([pt(a0, b0, 0), pt(a1, b0, 0), pt(a1, b1, 0), pt(a0, b1, 0)], uColors[r][c]);
    }
  }

  const fColors = [
    [f2lCornerColor(3, 1),       f2lEdgeColor(0, 1),       f2lCornerColor(0, 2)],
    [CUBE_COLORS.green,          CUBE_COLORS.green,        f2lEdgeColor(8, 0, true)],
    [CUBE_COLORS.green,          CUBE_COLORS.green,        f2lCornerColor(4, 1, true)]
  ];
  for (let zr = 0; zr < 3; zr++) {
    for (let c = 0; c < 3; c++) {
      const a0 = 3 - c, a1 = 2 - c;
      stickers += poly([pt(a0, 0, zr), pt(a1, 0, zr), pt(a1, 0, zr + 1), pt(a0, 0, zr + 1)], fColors[zr][c]);
    }
  }

  const rColors = [
    [f2lCornerColor(0, 1),       f2lEdgeColor(1, 1),       f2lCornerColor(1, 2)],
    [f2lEdgeColor(8, 1, true),   CUBE_COLORS.red,          CUBE_COLORS.red],
    [f2lCornerColor(4, 2, true), CUBE_COLORS.red,          CUBE_COLORS.red]
  ];
  for (let zr = 0; zr < 3; zr++) {
    for (let c = 0; c < 3; c++) {
      const b0 = c, b1 = c + 1;
      stickers += poly([pt(0, b0, zr), pt(0, b1, zr), pt(0, b1, zr + 1), pt(0, b0, zr + 1)], rColors[zr][c]);
    }
  }

  return `<svg viewBox="0 0 100 100" class="case-svg case-svg-f2l" data-slot="FR" xmlns="http://www.w3.org/2000/svg">
    ${stickers}
  </svg>`;
}

// ---------------------------------------------------------------------------
// 4x4 & 5x5 Parity SVGs
// ---------------------------------------------------------------------------
export function render444ParitySvg(caseObj) {
  const isOll = caseObj.id.includes("oll");
  const isOpp = caseObj.id.includes("opp");
  const isAdj = caseObj.id.includes("adj");

  const S = 17;
  const T = 16;
  const rect = (x, y, fill) =>
    `<rect x="${x}" y="${y}" width="${S}" height="${S}" rx="1.5" fill="${fill}" stroke="#1e293b" stroke-width="1.1"/>`;

  let stickersHtml = "";
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      let fill = CUBE_COLORS.yellow;
      if (isOll && r === 3 && (c === 1 || c === 2)) {
        fill = CUBE_COLORS.slate;
      }
      stickersHtml += rect(T + c * S, T + r * S, fill);
    }
  }

  let overlays = "";
  if (isOll) {
    overlays += `<rect x="${T + S}" y="${T + 4 * S + 3}" width="${2 * S}" height="6" rx="1.5" fill="${CUBE_COLORS.yellow}" stroke="#1e293b" stroke-width="1.1"/>`;
    overlays += `<text x="50" y="${T + 3.5 * S + 4}" text-anchor="middle" font-size="11" font-weight="900" fill="${CUBE_COLORS.orange}">&#x21C5;</text>`;
  } else if (isOpp) {
    overlays += `
      <line x1="50" y1="${T + 12}" x2="50" y2="${T + 4 * S - 12}" stroke="${CUBE_COLORS.red}" stroke-width="3" stroke-linecap="round"/>
      <polygon points="46,${T + 12} 54,${T + 12} 50,${T + 4}" fill="${CUBE_COLORS.red}"/>
      <polygon points="46,${T + 4 * S - 12} 54,${T + 4 * S - 12} 50,${T + 4 * S - 4}" fill="${CUBE_COLORS.red}"/>
    `;
  } else if (isAdj) {
    overlays += `
      <path d="M 50 ${T + 3.5 * S} Q ${T + 3.5 * S} ${T + 3.5 * S} ${T + 3.5 * S} 50" fill="none" stroke="${CUBE_COLORS.red}" stroke-width="3" stroke-linecap="round"/>
      <circle cx="50" cy="${T + 3.5 * S}" r="3.5" fill="${CUBE_COLORS.red}"/>
      <circle cx="${T + 3.5 * S}" cy="50" r="3.5" fill="${CUBE_COLORS.red}"/>
    `;
  }

  return `<svg viewBox="0 0 100 100" class="case-svg case-svg-444" xmlns="http://www.w3.org/2000/svg">
    ${stickersHtml}
    ${overlays}
  </svg>`;
}

export function render555ParitySvg(caseObj) {
  const isFlip = caseObj.id.includes("flip");
  const S = 14;
  const T = 15;
  const rect = (x, y, fill) =>
    `<rect x="${x}" y="${y}" width="${S}" height="${S}" rx="1.5" fill="${fill}" stroke="#1e293b" stroke-width="1.1"/>`;

  let stickersHtml = "";
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      let fill = CUBE_COLORS.yellow;
      if (isFlip && r === 4 && c === 2) {
        fill = CUBE_COLORS.slate;
      }
      stickersHtml += rect(T + c * S, T + r * S, fill);
    }
  }

  let overlays = "";
  if (isFlip) {
    overlays += `<rect x="${T + 2 * S}" y="${T + 5 * S + 3}" width="${S}" height="5" rx="1" fill="${CUBE_COLORS.yellow}" stroke="#1e293b" stroke-width="1.1"/>`;
    overlays += `<text x="${T + 2.5 * S}" y="${T + 4.5 * S + 4}" text-anchor="middle" font-size="10" font-weight="900" fill="${CUBE_COLORS.orange}">&#x21C5;</text>`;
  } else {
    overlays += `
      <path d="M ${T + 1.5 * S} ${T + 4.5 * S} Q 50 ${T + 3.5 * S} ${T + 3.5 * S} ${T + 4.5 * S}" fill="none" stroke="${CUBE_COLORS.red}" stroke-width="2.5" stroke-linecap="round"/>
      <circle cx="${T + 1.5 * S}" cy="${T + 4.5 * S}" r="3" fill="${CUBE_COLORS.red}"/>
      <circle cx="${T + 3.5 * S}" cy="${T + 4.5 * S}" r="3" fill="${CUBE_COLORS.red}"/>
    `;
  }

  return `<svg viewBox="0 0 100 100" class="case-svg case-svg-555" xmlns="http://www.w3.org/2000/svg">
    ${stickersHtml}
    ${overlays}
  </svg>`;
}

// ---------------------------------------------------------------------------
// White Cross / Fallback SVG
// ---------------------------------------------------------------------------
export function renderCrossSvg(caseObj) {
  return `<svg viewBox="0 0 100 100" class="case-svg case-svg-cross" xmlns="http://www.w3.org/2000/svg">
    <rect x="6" y="6" width="88" height="88" rx="8" fill="#18181b" stroke="#333" stroke-width="2"/>
    <rect x="36" y="12" width="28" height="24" rx="2" fill="${CUBE_COLORS.white}" stroke="#1e293b" stroke-width="1.1"/>
    <rect x="36" y="64" width="28" height="24" rx="2" fill="${CUBE_COLORS.white}" stroke="#1e293b" stroke-width="1.1"/>
    <rect x="12" y="36" width="24" height="28" rx="2" fill="${CUBE_COLORS.white}" stroke="#1e293b" stroke-width="1.1"/>
    <rect x="64" y="36" width="24" height="28" rx="2" fill="${CUBE_COLORS.white}" stroke="#1e293b" stroke-width="1.1"/>
    <rect x="36" y="36" width="28" height="28" rx="2" fill="${CUBE_COLORS.white}" stroke="#1e293b" stroke-width="1.1"/>
    <text x="50" y="55" text-anchor="middle" font-size="16" font-weight="900" fill="${CUBE_COLORS.green}">&#x271A;</text>
  </svg>`;
}

function renderFallbackSvg(label) {
  return `<svg viewBox="0 0 100 100" class="case-svg" xmlns="http://www.w3.org/2000/svg">
    <rect x="10" y="10" width="80" height="80" rx="6" fill="${CUBE_COLORS.slate}" stroke="#4a5568" stroke-width="2"/>
    <text x="50" y="56" text-anchor="middle" font-size="20" font-weight="700" fill="${CUBE_COLORS.yellow}">${label}</text>
  </svg>`;
}
