// Case Visualizer: Generates crisp, lightweight vector SVG diagrams for all cubing cases
// Supports 2x2 (CLL, Ortega OLL/PBL) and 3x3 (CFOP: PLL, OLL, F2L, Cross)

import { puzzles } from 'cubing/puzzles';
import { Alg } from 'cubing/alg';

export const FACE_COLORS = {
  U: "#ffd500", // yellow
  D: "#ffffff", // white
  F: "#009b48", // green
  B: "#0046ad", // blue
  L: "#ff5800", // orange
  R: "#b71234"  // red
};

const CORNER_FACES_222 = [
  ["U", "R", "F"], ["U", "B", "R"], ["U", "L", "B"], ["U", "F", "L"],
  ["D", "F", "R"], ["D", "L", "F"], ["D", "B", "L"], ["D", "R", "B"]
];

const CORNER_FACES_333 = [
  ["U", "R", "F"], ["U", "B", "R"], ["U", "L", "B"], ["U", "F", "L"],
  ["D", "F", "R"], ["D", "L", "F"], ["D", "B", "L"], ["D", "R", "B"]
];

const EDGE_FACES_333 = [
  ["U", "F"], ["U", "R"], ["U", "B"], ["U", "L"],
  ["F", "R"], ["B", "R"], ["B", "L"], ["F", "L"],
  ["D", "F"], ["D", "R"], ["D", "B"], ["D", "L"]
];

let kp2Promise = null;
let kp3Promise = null;

function getKp2() {
  if (!kp2Promise) kp2Promise = puzzles['2x2x2'].kpuzzle();
  return kp2Promise;
}

function getKp3() {
  if (!kp3Promise) kp3Promise = puzzles['3x3x3'].kpuzzle();
  return kp3Promise;
}

// Arrow definitions for PLL cases (coordinates on 3x3 grid: center of cells)
// Cell coordinates: (0,0) is UBL, (2,0) is UFL, (0,2) is UBR, (2,2) is UFR
// Cell centers in 100x100 viewBox:
// Row 0 (Back): col 0 (UBL)=26,18; col 1 (UB)=50,18; col 2 (UBR)=74,18
// Row 1 (Mid):  col 0 (UL)=26,50;  col 1 (U)=50,50;   col 2 (UR)=74,50
// Row 2 (Front):col 0 (UFL)=26,82; col 1 (UF)=50,82;  col 2 (UFR)=74,82

const PLL_ARROWS = {
  "T": [
    // Corner swap UBR <-> UFR (right vertical)
    { type: "double", x1: 76, y1: 22, x2: 76, y2: 78, color: "#e11d48" },
    // Edge swap UR <-> UF
    { type: "double", x1: 72, y1: 52, x2: 54, y2: 78, color: "#2563eb" }
  ],
  "H": [
    // Opposite edges UF <-> UB
    { type: "double", x1: 50, y1: 24, x2: 50, y2: 76, color: "#2563eb" },
    // Opposite edges UL <-> UR
    { type: "double", x1: 24, y1: 50, x2: 76, y2: 50, color: "#2563eb" }
  ],
  "Z": [
    // Adjacent edges UF <-> UR
    { type: "double", x1: 54, y1: 78, x2: 74, y2: 54, color: "#2563eb" },
    // Adjacent edges UB <-> UL
    { type: "double", x1: 46, y1: 22, x2: 26, y2: 46, color: "#2563eb" }
  ],
  "Ua": [
    // 3-edge cycle UB -> UL -> UF
    { type: "cycle3", p1: [50, 22], p2: [24, 50], p3: [50, 78], color: "#2563eb" }
  ],
  "Ub": [
    // 3-edge cycle UB -> UF -> UL
    { type: "cycle3", p1: [50, 22], p2: [50, 78], p3: [24, 50], color: "#2563eb" }
  ],
  "Aa": [
    // 3-corner cycle UBL -> UBR -> UFR
    { type: "cycle3", p1: [24, 22], p2: [76, 22], p3: [76, 78], color: "#e11d48" }
  ],
  "Ab": [
    // 3-corner cycle UFR -> UBR -> UBL
    { type: "cycle3", p1: [76, 78], p2: [76, 22], p3: [24, 22], color: "#e11d48" }
  ],
  "E": [
    // Diagonal corner swaps
    { type: "double", x1: 26, y1: 24, x2: 74, y2: 76, color: "#e11d48" },
    { type: "double", x1: 74, y1: 24, x2: 26, y2: 76, color: "#e11d48" }
  ],
  "F": [
    // Adjacent corner swap UFR <-> UBR
    { type: "double", x1: 76, y1: 22, x2: 76, y2: 78, color: "#e11d48" },
    // Opposite edge swap UL <-> UR
    { type: "double", x1: 24, y1: 50, x2: 76, y2: 50, color: "#2563eb" }
  ],
  "Ja": [
    { type: "double", x1: 24, y1: 24, x2: 24, y2: 76, color: "#e11d48" },
    { type: "double", x1: 24, y1: 50, x2: 48, y2: 78, color: "#2563eb" }
  ],
  "Jb": [
    { type: "double", x1: 76, y1: 24, x2: 76, y2: 76, color: "#e11d48" },
    { type: "double", x1: 76, y1: 50, x2: 52, y2: 78, color: "#2563eb" }
  ],
  "Ra": [
    { type: "double", x1: 76, y1: 24, x2: 76, y2: 76, color: "#e11d48" },
    { type: "double", x1: 26, y1: 50, x2: 50, y2: 78, color: "#2563eb" }
  ],
  "Rb": [
    { type: "double", x1: 76, y1: 24, x2: 76, y2: 76, color: "#e11d48" },
    { type: "double", x1: 74, y1: 50, x2: 50, y2: 78, color: "#2563eb" }
  ],
  "V": [
    { type: "double", x1: 24, y1: 76, x2: 76, y2: 24, color: "#e11d48" },
    { type: "double", x1: 50, y1: 78, x2: 74, y2: 50, color: "#2563eb" }
  ],
  "Y": [
    { type: "double", x1: 24, y1: 24, x2: 76, y2: 76, color: "#e11d48" },
    { type: "double", x1: 50, y1: 78, x2: 74, y2: 50, color: "#2563eb" }
  ],
  "Na": [
    { type: "double", x1: 76, y1: 24, x2: 24, y2: 76, color: "#e11d48" },
    { type: "double", x1: 50, y1: 24, x2: 50, y2: 76, color: "#2563eb" }
  ],
  "Nb": [
    { type: "double", x1: 24, y1: 24, x2: 76, y2: 76, color: "#e11d48" },
    { type: "double", x1: 50, y1: 24, x2: 50, y2: 76, color: "#2563eb" }
  ],
  "Ga": [
    { type: "cycle3", p1: [24, 76], p2: [76, 76], p3: [76, 24], color: "#e11d48" },
    { type: "cycle3", p1: [50, 78], p2: [76, 50], p3: [50, 22], color: "#2563eb" }
  ],
  "Gb": [
    { type: "cycle3", p1: [76, 76], p2: [24, 76], p3: [24, 24], color: "#e11d48" },
    { type: "cycle3", p1: [50, 78], p2: [50, 22], p3: [76, 50], color: "#2563eb" }
  ],
  "Gc": [
    { type: "cycle3", p1: [76, 24], p2: [24, 24], p3: [24, 76], color: "#e11d48" },
    { type: "cycle3", p1: [50, 22], p2: [24, 50], p3: [50, 78], color: "#2563eb" }
  ],
  "Gd": [
    { type: "cycle3", p1: [24, 24], p2: [76, 24], p3: [76, 76], color: "#e11d48" },
    { type: "cycle3", p1: [50, 22], p2: [50, 78], p3: [24, 50], color: "#2563eb" }
  ]
};

const svgCache = new Map();

export async function renderCaseSvg(puzzleId, trackId, caseObj) {
  if (!caseObj) return "";
  const cacheKey = `${puzzleId}-${trackId}-${caseObj.id}`;
  if (svgCache.has(cacheKey)) return svgCache.get(cacheKey);

  let svg = "";
  try {
    if (puzzleId === "222") {
      if (trackId === "ortega") {
        svg = await renderOrtegaSvg(caseObj);
      } else {
        svg = await renderCllSvg(caseObj);
      }
    } else {
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
  }

  svgCache.set(cacheKey, svg);
  return svg;
}

// ---------------------------------------------------------------------------
// 2x2 CLL SVG Generator (Cross-shaped top view with 4 side bars)
// ---------------------------------------------------------------------------
export async function renderCllSvg(caseObj) {
  const kp = await getKp2();
  const def = kp.defaultPattern();
  const scr = caseObj.setup || caseObj.scramble || caseObj.scrambles?.[0] || "";
  const pat = scr ? def.applyAlg(new Alg(scr)) : def;

  const { pieces, orientation } = pat.patternData.CORNERS;
  const color = (loc, o) =>
    FACE_COLORS[CORNER_FACES_222[pieces[loc]][(o - orientation[loc] + 3) % 3]] || "#ffd500";

  const S = 32;   // top sticker size
  const D = 9;    // side sticker depth
  const G = 3;    // gap
  const M = 3;    // margin
  const T = M + D + G;
  const W = T * 2 + 2 * S;

  const rect = (x, y, w, h, fill) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="${fill}" stroke="#18181b" stroke-width="1.8"/>`;

  return `<svg viewBox="0 0 ${W} ${W}" class="case-svg case-svg-222" xmlns="http://www.w3.org/2000/svg">
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
  </svg>`;
}

// ---------------------------------------------------------------------------
// 2x2 Ortega SVG (OLL & PBL)
// ---------------------------------------------------------------------------
export async function renderOrtegaSvg(caseObj) {
  if (caseObj.group && caseObj.group.startsWith("PBL")) {
    // PBL Diagram: Top bar & Bottom bar swap representation
    return renderPblSvg(caseObj);
  }

  // Ortega OLL: Top yellow/grey face + yellow perimeter indicator bars
  const kp = await getKp2();
  const def = kp.defaultPattern();
  const scr = caseObj.setup || caseObj.scramble || "";
  const pat = scr ? def.applyAlg(new Alg(scr)) : def;

  const { pieces, orientation } = pat.patternData.CORNERS;
  const isYellow = (loc, o) => {
    const face = CORNER_FACES_222[pieces[loc]][(o - orientation[loc] + 3) % 3];
    return face === "U";
  };

  const S = 32;
  const D = 9;
  const G = 3;
  const M = 3;
  const T = M + D + G;
  const W = T * 2 + 2 * S;

  const rect = (x, y, w, h, fill) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="${fill}" stroke="#18181b" stroke-width="1.8"/>`;

  const topColor = (loc) => isYellow(loc, 0) ? "#ffd500" : "#2f3542";
  const barColor = (hasYellow) => hasYellow ? "#ffd500" : "transparent";

  return `<svg viewBox="0 0 ${W} ${W}" class="case-svg case-svg-ortega-oll" xmlns="http://www.w3.org/2000/svg">
    <!-- Top Face (UBL, UBR, UFL, UFR) -->
    ${rect(T, T, S, S, topColor(2))}
    ${rect(T + S, T, S, S, topColor(1))}
    ${rect(T, T + S, S, S, topColor(3))}
    ${rect(T + S, T + S, S, S, topColor(0))}

    <!-- Perimeter Yellow Indicators -->
    ${isYellow(2, 2) ? rect(T, M, S, D, "#ffd500") : ''}
    ${isYellow(1, 1) ? rect(T + S, M, S, D, "#ffd500") : ''}
    ${isYellow(3, 1) ? rect(T, T + 2 * S + G, S, D, "#ffd500") : ''}
    ${isYellow(0, 2) ? rect(T + S, T + 2 * S + G, S, D, "#ffd500") : ''}
    ${isYellow(2, 1) ? rect(M, T, D, S, "#ffd500") : ''}
    ${isYellow(3, 2) ? rect(M, T + S, D, S, "#ffd500") : ''}
    ${isYellow(1, 2) ? rect(T + 2 * S + G, T, D, S, "#ffd500") : ''}
    ${isYellow(0, 1) ? rect(T + 2 * S + G, T + S, D, S, "#ffd500") : ''}
  </svg>`;
}

function renderPblSvg(caseObj) {
  const name = caseObj.name || caseObj.id;
  const isAdjAdj = name.includes("Adj/Adj");
  const isOppOpp = name.includes("Opp/Opp");
  const isAdjOpp = name.includes("Adj/Opp");
  const isAdjSolved = name.includes("Adj/Solved");
  const isOppSolved = name.includes("Opp/Solved");

  return `<svg viewBox="0 0 100 100" class="case-svg case-svg-pbl" xmlns="http://www.w3.org/2000/svg">
    <!-- Background Frame -->
    <rect x="8" y="8" width="84" height="84" rx="8" fill="#1e2430" stroke="#333d4d" stroke-width="2"/>
    
    <!-- Top Layer (Layer 1) -->
    <rect x="18" y="18" width="64" height="26" rx="4" fill="#ffd500" stroke="#111" stroke-width="1.8"/>
    <text x="50" y="35" text-anchor="middle" font-size="11" font-weight="700" fill="#111">
      ${isOppOpp || isOppSolved ? 'OPP SWAP' : 'ADJ BAR'}
    </text>

    <!-- Divider Line -->
    <line x1="14" y1="50" x2="86" y2="50" stroke="#4a5568" stroke-width="2" stroke-dasharray="3,3"/>

    <!-- Bottom Layer (Layer 2) -->
    <rect x="18" y="56" width="64" height="26" rx="4" fill="#ffffff" stroke="#111" stroke-width="1.8"/>
    <text x="50" y="73" text-anchor="middle" font-size="11" font-weight="700" fill="#111">
      ${isAdjSolved || isOppSolved ? 'SOLVED' : (isOppOpp || isAdjOpp ? 'OPP SWAP' : 'ADJ BAR')}
    </text>
  </svg>`;
}

// ---------------------------------------------------------------------------
// 3x3 OLL SVG (Orientation of the Last Layer - 57 Cases)
// Top face 3x3 (Yellow/Grey) + Yellow side indicator bars around perimeter
// ---------------------------------------------------------------------------
export async function renderOllSvg(caseObj) {
  const kp = await getKp3();
  const def = kp.defaultPattern();
  const scr = caseObj.setup || "";
  const pat = scr ? def.applyAlg(new Alg(scr)) : def;

  const { pieces: cPieces, orientation: cOrient } = pat.patternData.CORNERS;
  const { pieces: ePieces, orientation: eOrient } = pat.patternData.EDGES;

  // For a piece, check if yellow is facing a given direction
  const isCornerYellow = (loc, faceIdx) => {
    const face = CORNER_FACES_333[cPieces[loc]][(faceIdx - cOrient[loc] + 3) % 3];
    return face === "U";
  };

  const isEdgeYellow = (loc, faceIdx) => {
    const face = EDGE_FACES_333[ePieces[loc]][(faceIdx - eOrient[loc] + 2) % 2];
    return face === "U";
  };

  const S = 22; // sticker size
  const D = 7;  // side bar depth
  const G = 2.5;// gap
  const M = 2.5;// margin
  const T = M + D + G;
  const W = T * 2 + 3 * S;

  const rect = (x, y, w, h, fill) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="${fill}" stroke="#18181b" stroke-width="1.6"/>`;

  const topColor = (isY) => isY ? "#ffd500" : "#2f3542";

  return `<svg viewBox="0 0 ${W} ${W}" class="case-svg case-svg-oll" xmlns="http://www.w3.org/2000/svg">
    <!-- Top Face (3x3 grid) -->
    <!-- Row 0 (Back): UBL (corner 2), UB (edge 2), UBR (corner 1) -->
    ${rect(T, T, S, S, topColor(isCornerYellow(2, 0)))}
    ${rect(T + S, T, S, S, topColor(isEdgeYellow(2, 0)))}
    ${rect(T + 2 * S, T, S, S, topColor(isCornerYellow(1, 0)))}

    <!-- Row 1 (Mid): UL (edge 3), Center (always yellow), UR (edge 1) -->
    ${rect(T, T + S, S, S, topColor(isEdgeYellow(3, 0)))}
    ${rect(T + S, T + S, S, S, "#ffd500")}
    ${rect(T + 2 * S, T + S, S, S, topColor(isEdgeYellow(1, 0)))}

    <!-- Row 2 (Front): UFL (corner 3), UF (edge 0), UFR (corner 0) -->
    ${rect(T, T + 2 * S, S, S, topColor(isCornerYellow(3, 0)))}
    ${rect(T + S, T + 2 * S, S, S, topColor(isEdgeYellow(0, 0)))}
    ${rect(T + 2 * S, T + 2 * S, S, S, topColor(isCornerYellow(0, 0)))}

    <!-- Back side (top) yellow indicators -->
    ${isCornerYellow(2, 2) ? rect(T, M, S, D, "#ffd500") : ''}
    ${isEdgeYellow(2, 1) ? rect(T + S, M, S, D, "#ffd500") : ''}
    ${isCornerYellow(1, 1) ? rect(T + 2 * S, M, S, D, "#ffd500") : ''}

    <!-- Front side (bottom) yellow indicators -->
    ${isCornerYellow(3, 1) ? rect(T, T + 3 * S + G, S, D, "#ffd500") : ''}
    ${isEdgeYellow(0, 1) ? rect(T + S, T + 3 * S + G, S, D, "#ffd500") : ''}
    ${isCornerYellow(0, 2) ? rect(T + 2 * S, T + 3 * S + G, S, D, "#ffd500") : ''}

    <!-- Left side (left) yellow indicators -->
    ${isCornerYellow(2, 1) ? rect(M, T, D, S, "#ffd500") : ''}
    ${isEdgeYellow(3, 1) ? rect(M, T + S, D, S, "#ffd500") : ''}
    ${isCornerYellow(3, 2) ? rect(M, T + 2 * S, D, S, "#ffd500") : ''}

    <!-- Right side (right) yellow indicators -->
    ${isCornerYellow(1, 2) ? rect(T + 3 * S + G, T, D, S, "#ffd500") : ''}
    ${isEdgeYellow(1, 1) ? rect(T + 3 * S + G, T + S, D, S, "#ffd500") : ''}
    ${isCornerYellow(0, 1) ? rect(T + 3 * S + G, T + 2 * S, D, S, "#ffd500") : ''}
  </svg>`;
}

// ---------------------------------------------------------------------------
// 3x3 PLL SVG (Permutation of the Last Layer - 21 Cases)
// All 9 top stickers yellow + colored side sticker blocks + directional arrows
// ---------------------------------------------------------------------------
export async function renderPllSvg(caseObj) {
  const kp = await getKp3();
  const def = kp.defaultPattern();
  const scr = caseObj.setup || "";
  const pat = scr ? def.applyAlg(new Alg(scr)) : def;

  const { pieces: cPieces, orientation: cOrient } = pat.patternData.CORNERS;
  const { pieces: ePieces, orientation: eOrient } = pat.patternData.EDGES;

  const cornerColor = (loc, o) =>
    FACE_COLORS[CORNER_FACES_333[cPieces[loc]][(o - cOrient[loc] + 3) % 3]] || "#ffd500";

  const edgeColor = (loc, o) =>
    FACE_COLORS[EDGE_FACES_333[ePieces[loc]][(o - eOrient[loc] + 2) % 2]] || "#ffd500";

  const S = 22; // top sticker size
  const D = 8;  // side sticker depth
  const G = 2.5;// gap
  const M = 2.5;// margin
  const T = M + D + G;
  const W = T * 2 + 3 * S;

  const rect = (x, y, w, h, fill) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="${fill}" stroke="#18181b" stroke-width="1.6"/>`;

  // Arrows overlay
  const arrows = PLL_ARROWS[caseObj.id] || [];
  let arrowSvg = "";
  arrows.forEach(a => {
    if (a.type === "double") {
      arrowSvg += `
        <line x1="${a.x1}" y1="${a.y1}" x2="${a.x2}" y2="${a.y2}" stroke="${a.color}" stroke-width="3.5" stroke-linecap="round"/>
        <circle cx="${a.x1}" cy="${a.y1}" r="3.5" fill="${a.color}"/>
        <circle cx="${a.x2}" cy="${a.y2}" r="3.5" fill="${a.color}"/>
      `;
    } else if (a.type === "cycle3") {
      arrowSvg += `
        <path d="M ${a.p1[0]} ${a.p1[1]} Q 50 50 ${a.p2[0]} ${a.p2[1]} Q 50 50 ${a.p3[0]} ${a.p3[1]} Z" fill="none" stroke="${a.color}" stroke-width="3" stroke-dasharray="4,2"/>
        <circle cx="${a.p1[0]}" cy="${a.p1[1]}" r="3.5" fill="${a.color}"/>
        <circle cx="${a.p2[0]}" cy="${a.p2[1]}" r="3.5" fill="${a.color}"/>
        <circle cx="${a.p3[0]}" cy="${a.p3[1]}" r="3.5" fill="${a.color}"/>
      `;
    }
  });

  return `<svg viewBox="0 0 ${W} ${W}" class="case-svg case-svg-pll" xmlns="http://www.w3.org/2000/svg">
    <!-- Top Face (All 9 yellow) -->
    ${rect(T, T, S, S, "#ffd500")}
    ${rect(T + S, T, S, S, "#ffd500")}
    ${rect(T + 2 * S, T, S, S, "#ffd500")}
    ${rect(T, T + S, S, S, "#ffd500")}
    ${rect(T + S, T + S, S, S, "#ffd500")}
    ${rect(T + 2 * S, T + S, S, S, "#ffd500")}
    ${rect(T, T + 2 * S, S, S, "#ffd500")}
    ${rect(T + S, T + 2 * S, S, S, "#ffd500")}
    ${rect(T + 2 * S, T + 2 * S, S, S, "#ffd500")}

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
// Isometric / Top view highlighting the active pair and Front-Right slot
// ---------------------------------------------------------------------------
export async function renderF2lSvg(caseObj) {
  const kp = await getKp3();
  const def = kp.defaultPattern();
  const scr = caseObj.setup || "";
  const pat = scr ? def.applyAlg(new Alg(scr)) : def;

  // Highlighting FR slot and target pieces
  const S = 24;
  const T = 14;
  const W = 100;

  const rect = (x, y, w, h, fill, stroke = "#18181b", strokeW = 1.6) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2" fill="${fill}" stroke="${stroke}" stroke-width="${strokeW}"/>`;

  return `<svg viewBox="0 0 ${W} ${W}" class="case-svg case-svg-f2l" xmlns="http://www.w3.org/2000/svg">
    <!-- Base 3x3 Top Layer (White on bottom, so U face is yellow/grey) -->
    <!-- Solved back/left pieces in dark neutral tone -->
    ${rect(T, T, S, S, "#2d3748")}
    ${rect(T + S, T, S, S, "#2d3748")}
    ${rect(T + 2 * S, T, S, S, "#2d3748")}
    ${rect(T, T + S, S, S, "#2d3748")}
    ${rect(T + S, T + S, S, S, "#ffd500")}
    ${rect(T + 2 * S, T + S, S, S, "#3182ce")}
    ${rect(T, T + 2 * S, S, S, "#2d3748")}
    ${rect(T + S, T + 2 * S, S, S, "#38a169")}

    <!-- Front-Right Active Target Slot (UFR / FR slot highlighted in vibrant colors) -->
    ${rect(T + 2 * S, T + 2 * S, S, S, "#e53e3e", "#e53e3e", 2.2)}

    <!-- Target Slot Outline indicator (Green & Red target arrows) -->
    <circle cx="${T + 2 * S + S / 2}" cy="${T + 2 * S + S / 2}" r="7" fill="#ffffff" stroke="#111" stroke-width="1.5"/>
    <text x="${T + 2 * S + S / 2}" y="${T + 2 * S + S / 2 + 3.5}" text-anchor="middle" font-size="9" font-weight="900" fill="#e53e3e">FR</text>
  </svg>`;
}

// ---------------------------------------------------------------------------
// White Cross / Fallback SVG
// ---------------------------------------------------------------------------
export function renderCrossSvg(caseObj) {
  return `<svg viewBox="0 0 100 100" class="case-svg case-svg-cross" xmlns="http://www.w3.org/2000/svg">
    <rect x="6" y="6" width="88" height="88" rx="8" fill="#18181b" stroke="#333" stroke-width="2"/>
    <!-- Cross pieces in White -->
    <rect x="36" y="12" width="28" height="24" rx="2" fill="#ffffff" stroke="#111" stroke-width="1.5"/>
    <rect x="36" y="64" width="28" height="24" rx="2" fill="#ffffff" stroke="#111" stroke-width="1.5"/>
    <rect x="12" y="36" width="24" height="28" rx="2" fill="#ffffff" stroke="#111" stroke-width="1.5"/>
    <rect x="64" y="36" width="24" height="28" rx="2" fill="#ffffff" stroke="#111" stroke-width="1.5"/>
    <rect x="36" y="36" width="28" height="28" rx="2" fill="#ffffff" stroke="#111" stroke-width="1.5"/>
    <text x="50" y="55" text-anchor="middle" font-size="16" font-weight="900" fill="#009b48">&#x271A;</text>
  </svg>`;
}

function renderFallbackSvg(label) {
  return `<svg viewBox="0 0 100 100" class="case-svg" xmlns="http://www.w3.org/2000/svg">
    <rect x="10" y="10" width="80" height="80" rx="6" fill="#2d3748" stroke="#4a5568" stroke-width="2"/>
    <text x="50" y="56" text-anchor="middle" font-size="20" font-weight="700" fill="#ffd500">${label}</text>
  </svg>`;
}
