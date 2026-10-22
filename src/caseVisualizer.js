// Case Visualizer: Generates crisp, lightweight vector SVG diagrams for all cubing cases
// Supports 2x2 (CLL, Ortega OLL/PBL) and 3x3 (CFOP: PLL, OLL, F2L, Cross)

import { puzzles } from 'cubing/puzzles';
import { Alg } from 'cubing/alg';

// Canonical High-Contrast Speedcube Color Palette
// Defaults matched to the bright, vibrant 3D cube
export const DEFAULT_CUBE_COLORS = {
  white:  "#ffffff", // pure crisp white
  yellow: "#ffff00", // pure vibrant yellow (matching 3D cube)
  green:  "#32cd32", // bright lime green (matching 3D cube)
  blue:   "#2266ff", // vibrant royal blue (matching 3D cube)
  red:    "#ff0000", // vivid red (matching 3D cube)
  orange: "#ff8000", // warm bright orange (matching 3D cube)
  slate:  "#374151"  // neutral slate grey for unoriented/base facelets
};

export const CUBE_COLORS = { ...DEFAULT_CUBE_COLORS };

export const FACE_COLORS = {
  U: CUBE_COLORS.yellow,
  D: CUBE_COLORS.white,
  F: CUBE_COLORS.green,
  B: CUBE_COLORS.blue,
  L: CUBE_COLORS.orange,
  R: CUBE_COLORS.red
};

export function clearSvgCache() {
  svgCache.clear();
}

export function setCustomCubeColors(custom) {
  if (!custom) return;
  Object.assign(CUBE_COLORS, custom);
  FACE_COLORS.U = CUBE_COLORS.yellow;
  FACE_COLORS.D = CUBE_COLORS.white;
  FACE_COLORS.F = CUBE_COLORS.green;
  FACE_COLORS.B = CUBE_COLORS.blue;
  FACE_COLORS.L = CUBE_COLORS.orange;
  FACE_COLORS.R = CUBE_COLORS.red;
  clearSvgCache();
}

export function applyCubeColorsToCss(colors = CUBE_COLORS) {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.style.setProperty('--cube-white', colors.white);
  root.style.setProperty('--cube-yellow', colors.yellow);
  root.style.setProperty('--cube-green', colors.green);
  root.style.setProperty('--cube-blue', colors.blue);
  root.style.setProperty('--cube-red', colors.red);
  root.style.setProperty('--cube-orange', colors.orange);
  root.style.setProperty('--cube-slate', colors.slate);
}

export function hexToRgb(hex) {
  if (!hex) return [255, 255, 255];
  const clean = hex.replace('#', '');
  const num = parseInt(clean.length === 3 ? clean.split('').map(c => c + c).join('') : clean, 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function classifyBaseVertex(r, g, b, targets = null) {
  if (r < 40 && g < 40 && b < 40) return 'black';
  if (targets) {
    for (const [name, rgb] of Object.entries(targets)) {
      if (Math.abs(r - rgb[0]) <= 2 && Math.abs(g - rgb[1]) <= 2 && Math.abs(b - rgb[2]) <= 2) {
        return name;
      }
    }
  }
  if (r > 200 && g > 200 && b > 200) return 'white';
  if (r > 180 && g > 180 && b < 70) return 'yellow';
  if (r < 110 && g > 150 && b < 100) return 'green';
  if (r < 80 && g < 150 && b > 180) return 'blue';
  if (r > 180 && g < 60 && b < 60) return 'red';
  if (r > 180 && g >= 60 && g <= 180 && b < 60) return 'orange';
  return null;
}

export function applyColorsToThreeJSPuzzle(p, colors = CUBE_COLORS) {
  if (!p || typeof p.traverse !== 'function') return false;

  const targetRgb = {
    white: hexToRgb(colors.white || '#ffffff'),
    yellow: hexToRgb(colors.yellow || '#ffff00'),
    green: hexToRgb(colors.green || '#32cd32'),
    blue: hexToRgb(colors.blue || '#2266ff'),
    red: hexToRgb(colors.red || '#ff0000'),
    orange: hexToRgb(colors.orange || '#ff8000')
  };

  const hexTargets = {
    white: (targetRgb.white[0] << 16) | (targetRgb.white[1] << 8) | targetRgb.white[2],
    yellow: (targetRgb.yellow[0] << 16) | (targetRgb.yellow[1] << 8) | targetRgb.yellow[2],
    green: (targetRgb.green[0] << 16) | (targetRgb.green[1] << 8) | targetRgb.green[2],
    blue: (targetRgb.blue[0] << 16) | (targetRgb.blue[1] << 8) | targetRgb.blue[2],
    red: (targetRgb.red[0] << 16) | (targetRgb.red[1] << 8) | targetRgb.red[2],
    orange: (targetRgb.orange[0] << 16) | (targetRgb.orange[1] << 8) | targetRgb.orange[2]
  };

  let needsRender = false;

  // 1. Force 100% black opacity on 3x3 Cube3D foundation meshes
  if (p.experimentalFoundationMeshes && p.experimentalFoundationMeshes.length > 0) {
    try {
      p.experimentalSetFoundationOpacity?.(1.0);
    } catch {}
    for (const mesh of p.experimentalFoundationMeshes) {
      if (mesh.material) {
        mesh.material.opacity = 1.0;
        mesh.material.transparent = false;
        mesh.material.depthWrite = true;
        mesh.material.needsUpdate = true;
      }
    }
    needsRender = true;
  }

  // 2. Force 100% solid opacity on 3x3 / 3x3 OH reflection (hint) facelets
  if (p.experimentalHintStickerMeshes && p.experimentalHintStickerMeshes.length > 0) {
    for (const mesh of p.experimentalHintStickerMeshes) {
      if (mesh.material) {
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const m of mats) {
          m.opacity = 1.0;
          m.transparent = false;
          m.depthWrite = true;
          m.needsUpdate = true;
        }
      }
    }
    needsRender = true;
  }

  if (p.kpuzzleFaceletInfo) {
    try {
      for (const orbit of Object.values(p.kpuzzleFaceletInfo)) {
        for (const piece of Object.values(orbit)) {
          const pieceArr = Array.isArray(piece) ? piece : [piece];
          for (const faceletInfo of pieceArr) {
            if (faceletInfo && faceletInfo.hintFacelet && faceletInfo.hintFacelet.material) {
              const mats = Array.isArray(faceletInfo.hintFacelet.material) ? faceletInfo.hintFacelet.material : [faceletInfo.hintFacelet.material];
              for (const m of mats) {
                m.opacity = 1.0;
                m.transparent = false;
                m.depthWrite = true;
                m.needsUpdate = true;
              }
            }
          }
        }
      }
    } catch {}
  }

  // 3. For PG3D puzzles (2x2, 4x4, 5x5): patch filler.colors palette buffers (active + source)
  if (p.filler && p.filler.colors) {
    const colorsBuf = p.filler.colors;
    let fillerModified = false;
    for (let i = 0; i < colorsBuf.length; i += 3) {
      const type = classifyBaseVertex(colorsBuf[i], colorsBuf[i + 1], colorsBuf[i + 2], targetRgb);
      if (type && targetRgb[type]) {
        const tr = targetRgb[type][0];
        const tg = targetRgb[type][1];
        const tb = targetRgb[type][2];
        if (colorsBuf[i] !== tr || colorsBuf[i + 1] !== tg || colorsBuf[i + 2] !== tb) {
          colorsBuf[i] = tr;
          colorsBuf[i + 1] = tg;
          colorsBuf[i + 2] = tb;
          fillerModified = true;
        }
      }
    }
    if (fillerModified) {
      needsRender = true;
    }
  }

  // 4. For PG3D puzzles: synchronize sticker definitions with target hex colors
  if (p.stickers) {
    try {
      for (const orbit of Object.values(p.stickers)) {
        if (!Array.isArray(orbit)) continue;
        for (const ori of orbit) {
          if (!Array.isArray(ori)) continue;
          for (const sd of ori) {
            if (!sd) continue;
            if (typeof sd.origColor === 'number') {
              const r = (sd.origColor >> 16) & 255;
              const g = (sd.origColor >> 8) & 255;
              const b = sd.origColor & 255;
              const type = classifyBaseVertex(r, g, b, targetRgb);
              if (type && hexTargets[type] !== undefined) {
                const targetHex = hexTargets[type];
                if (sd.origColorStickeringMask === sd.origColor) {
                  sd.origColorStickeringMask = targetHex;
                }
                sd.origColor = targetHex;
              }
            }
            if (typeof sd.faceColor === 'number') {
              const r = (sd.faceColor >> 16) & 255;
              const g = (sd.faceColor >> 8) & 255;
              const b = sd.faceColor & 255;
              const type = classifyBaseVertex(r, g, b, targetRgb);
              if (type && hexTargets[type] !== undefined) {
                sd.faceColor = hexTargets[type];
              }
            }
          }
        }
      }
    } catch {}
  }

  // 5. Traverse all nodes to enforce full black opacity, update 3x3 materials, and sync geometry colors
  p.traverse(node => {
    if (node.material) {
      const mats = Array.isArray(node.material) ? node.material : [node.material];
      mats.forEach(m => {
        const isBlack = m.color && (m.color.r < 0.05 && m.color.g < 0.05 && m.color.b < 0.05);
        const isHint = m.side === 1 /* BackSide */ || (p.experimentalHintStickerMeshes && p.experimentalHintStickerMeshes.includes(node));
        if (isBlack || !m.color || isHint) {
          m.transparent = false;
          m.opacity = 1.0;
          m.depthWrite = true;
          m.needsUpdate = true;
          needsRender = true;
        }

        // Apply custom colors to 3x3 Cube3D materials if applicable
        if (m.color && !isBlack) {
          const r = Math.round(m.color.r * 255);
          const g = Math.round(m.color.g * 255);
          const b = Math.round(m.color.b * 255);
          const type = classifyBaseVertex(r, g, b, targetRgb);
          if (type && targetRgb[type]) {
            const tr = targetRgb[type][0] / 255;
            const tg = targetRgb[type][1] / 255;
            const tb = targetRgb[type][2] / 255;
            if (Math.abs(m.color.r - tr) > 0.005 || Math.abs(m.color.g - tg) > 0.005 || Math.abs(m.color.b - tb) > 0.005) {
              m.color.setRGB(tr, tg, tb);
              m.needsUpdate = true;
              needsRender = true;
            }
          }
        }
      });
    }

    if (node.geometry && node.geometry.attributes && node.geometry.attributes.color) {
      if (node.geometry.userData && node.geometry.userData.origColors) {
        delete node.geometry.userData.origColors;
      }
      const attr = node.geometry.attributes.color;
      const cur = attr.array;
      let modified = false;
      for (let i = 0; i < cur.length; i += 3) {
        const type = classifyBaseVertex(cur[i], cur[i + 1], cur[i + 2], targetRgb);
        if (type && targetRgb[type]) {
          const tr = targetRgb[type][0];
          const tg = targetRgb[type][1];
          const tb = targetRgb[type][2];
          if (cur[i] !== tr || cur[i + 1] !== tg || cur[i + 2] !== tb) {
            cur[i] = tr;
            cur[i + 1] = tg;
            cur[i + 2] = tb;
            modified = true;
          }
        }
      }
      if (modified) {
        attr.needsUpdate = true;
        needsRender = true;
      }
    }
  });

  if (p.fixedGeo && p.fixedGeo.attributes && p.fixedGeo.attributes.color) {
    p.fixedGeo.attributes.color.needsUpdate = true;
  }

  if (needsRender) {
    p.scheduleRenderCallback?.();
  }
  return needsRender;
}

let _foundationOpaquePromise = null;
export async function ensure3x3FoundationOpaque() {
  if (typeof window === 'undefined') return;
  if (_foundationOpaquePromise) return _foundationOpaquePromise;

  _foundationOpaquePromise = (async () => {
    try {
      const sdClass = customElements.get('scramble-display');
      if (sdClass) {
        const temp = new sdClass();
        temp.event = '333';
        temp.visualization = '3D';
        temp.hintFacelets = 'floating';
        temp.style.position = 'fixed';
        temp.style.opacity = '0';
        temp.style.pointerEvents = 'none';
        temp.style.top = '-9999px';
        temp.style.left = '-9999px';
        document.body.appendChild(temp);
        const p = await temp.player.experimentalCurrentThreeJSPuzzleObject();
        if (p) {
          applyColorsToThreeJSPuzzle(p);
        }
        temp.remove();
      }
    } catch (err) {
      // Non-critical background patch
    }
  })();
  return _foundationOpaquePromise;
}

export async function applyColorsTo3DCube(scrambleDisplayEl, colors = CUBE_COLORS) {
  if (typeof window === 'undefined' || !scrambleDisplayEl) return;
  void ensure3x3FoundationOpaque();

  for (let attempt = 0; attempt < 20; attempt++) {
    try {
      if (scrambleDisplayEl.player) {
        const p = await scrambleDisplayEl.player.experimentalCurrentThreeJSPuzzleObject?.();
        if (p) {
          applyColorsToThreeJSPuzzle(p, colors);
          return p;
        }
      }
    } catch (e) {}
    await new Promise(r => setTimeout(r, 80));
  }
}

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

const ARROW_CORNER = CUBE_COLORS.red;
const ARROW_EDGE = CUBE_COLORS.blue;

const PLL_ARROWS = {
  "T": [
    // Corner swap UBR <-> UFR (right vertical)
    { type: "double", x1: 76, y1: 22, x2: 76, y2: 78, color: ARROW_CORNER },
    // Edge swap UR <-> UF
    { type: "double", x1: 72, y1: 52, x2: 54, y2: 78, color: ARROW_EDGE }
  ],
  "H": [
    // Opposite edges UF <-> UB
    { type: "double", x1: 50, y1: 24, x2: 50, y2: 76, color: ARROW_EDGE },
    // Opposite edges UL <-> UR
    { type: "double", x1: 24, y1: 50, x2: 76, y2: 50, color: ARROW_EDGE }
  ],
  "Z": [
    // Adjacent edges UF <-> UR
    { type: "double", x1: 54, y1: 78, x2: 74, y2: 54, color: ARROW_EDGE },
    // Adjacent edges UB <-> UL
    { type: "double", x1: 46, y1: 22, x2: 26, y2: 46, color: ARROW_EDGE }
  ],
  "Ua": [
    // 3-edge cycle UB -> UL -> UF
    { type: "cycle3", p1: [50, 22], p2: [24, 50], p3: [50, 78], color: ARROW_EDGE }
  ],
  "Ub": [
    // 3-edge cycle UB -> UF -> UL
    { type: "cycle3", p1: [50, 22], p2: [50, 78], p3: [24, 50], color: ARROW_EDGE }
  ],
  "Aa": [
    // 3-corner cycle UBL -> UBR -> UFR
    { type: "cycle3", p1: [24, 22], p2: [76, 22], p3: [76, 78], color: ARROW_CORNER }
  ],
  "Ab": [
    // 3-corner cycle UFR -> UBR -> UBL
    { type: "cycle3", p1: [76, 78], p2: [76, 22], p3: [24, 22], color: ARROW_CORNER }
  ],
  "E": [
    // Diagonal corner swaps
    { type: "double", x1: 26, y1: 24, x2: 74, y2: 76, color: ARROW_CORNER },
    { type: "double", x1: 74, y1: 24, x2: 26, y2: 76, color: ARROW_CORNER }
  ],
  "F": [
    // Adjacent corner swap UFR <-> UBR
    { type: "double", x1: 76, y1: 22, x2: 76, y2: 78, color: ARROW_CORNER },
    // Opposite edge swap UL <-> UR
    { type: "double", x1: 24, y1: 50, x2: 76, y2: 50, color: ARROW_EDGE }
  ],
  "Ja": [
    { type: "double", x1: 24, y1: 24, x2: 24, y2: 76, color: ARROW_CORNER },
    { type: "double", x1: 24, y1: 50, x2: 48, y2: 78, color: ARROW_EDGE }
  ],
  "Jb": [
    { type: "double", x1: 76, y1: 24, x2: 76, y2: 76, color: ARROW_CORNER },
    { type: "double", x1: 76, y1: 50, x2: 52, y2: 78, color: ARROW_EDGE }
  ],
  "Ra": [
    { type: "double", x1: 76, y1: 24, x2: 76, y2: 76, color: ARROW_CORNER },
    { type: "double", x1: 26, y1: 50, x2: 50, y2: 78, color: ARROW_EDGE }
  ],
  "Rb": [
    { type: "double", x1: 76, y1: 24, x2: 76, y2: 76, color: ARROW_CORNER },
    { type: "double", x1: 74, y1: 50, x2: 50, y2: 78, color: ARROW_EDGE }
  ],
  "V": [
    { type: "double", x1: 24, y1: 76, x2: 76, y2: 24, color: ARROW_CORNER },
    { type: "double", x1: 50, y1: 78, x2: 74, y2: 50, color: ARROW_EDGE }
  ],
  "Y": [
    { type: "double", x1: 24, y1: 24, x2: 76, y2: 76, color: ARROW_CORNER },
    { type: "double", x1: 50, y1: 78, x2: 74, y2: 50, color: ARROW_EDGE }
  ],
  "Na": [
    { type: "double", x1: 76, y1: 24, x2: 24, y2: 76, color: ARROW_CORNER },
    { type: "double", x1: 50, y1: 24, x2: 50, y2: 76, color: ARROW_EDGE }
  ],
  "Nb": [
    { type: "double", x1: 24, y1: 24, x2: 76, y2: 76, color: ARROW_CORNER },
    { type: "double", x1: 50, y1: 24, x2: 50, y2: 76, color: ARROW_EDGE }
  ],
  "Ga": [
    { type: "cycle3", p1: [24, 76], p2: [76, 76], p3: [76, 24], color: ARROW_CORNER },
    { type: "cycle3", p1: [50, 78], p2: [76, 50], p3: [50, 22], color: ARROW_EDGE }
  ],
  "Gb": [
    { type: "cycle3", p1: [76, 76], p2: [24, 76], p3: [24, 24], color: ARROW_CORNER },
    { type: "cycle3", p1: [50, 78], p2: [50, 22], p3: [76, 50], color: ARROW_EDGE }
  ],
  "Gc": [
    { type: "cycle3", p1: [76, 24], p2: [24, 24], p3: [24, 76], color: ARROW_CORNER },
    { type: "cycle3", p1: [50, 22], p2: [24, 50], p3: [50, 78], color: ARROW_EDGE }
  ],
  "Gd": [
    { type: "cycle3", p1: [24, 24], p2: [76, 24], p3: [76, 76], color: ARROW_CORNER },
    { type: "cycle3", p1: [50, 22], p2: [50, 78], p3: [24, 50], color: ARROW_EDGE }
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
    FACE_COLORS[CORNER_FACES_222[pieces[loc]][(o - orientation[loc] + 3) % 3]] || CUBE_COLORS.yellow;

  const S = 32;   // top sticker size
  const D = 9;    // side sticker depth
  const G = 3;    // gap
  const M = 3;    // margin
  const T = M + D + G;
  const W = T * 2 + 2 * S;

  const rect = (x, y, w, h, fill) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.5" fill="${fill}" stroke="#1e293b" stroke-width="1.15"/>`;

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

  // Ortega OLL: Top yellow/slate face + yellow perimeter indicator bars
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
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.5" fill="${fill}" stroke="#1e293b" stroke-width="1.15"/>`;

  const topColor = (loc) => isYellow(loc, 0) ? CUBE_COLORS.yellow : CUBE_COLORS.slate;

  return `<svg viewBox="0 0 ${W} ${W}" class="case-svg case-svg-ortega-oll" xmlns="http://www.w3.org/2000/svg">
    <!-- Top Face (UBL, UBR, UFL, UFR) -->
    ${rect(T, T, S, S, topColor(2))}
    ${rect(T + S, T, S, S, topColor(1))}
    ${rect(T, T + S, S, S, topColor(3))}
    ${rect(T + S, T + S, S, S, topColor(0))}

    <!-- Perimeter Yellow Indicators -->
    ${isYellow(2, 2) ? rect(T, M, S, D, CUBE_COLORS.yellow) : ''}
    ${isYellow(1, 1) ? rect(T + S, M, S, D, CUBE_COLORS.yellow) : ''}
    ${isYellow(3, 1) ? rect(T, T + 2 * S + G, S, D, CUBE_COLORS.yellow) : ''}
    ${isYellow(0, 2) ? rect(T + S, T + 2 * S + G, S, D, CUBE_COLORS.yellow) : ''}
    ${isYellow(2, 1) ? rect(M, T, D, S, CUBE_COLORS.yellow) : ''}
    ${isYellow(3, 2) ? rect(M, T + S, D, S, CUBE_COLORS.yellow) : ''}
    ${isYellow(1, 2) ? rect(T + 2 * S + G, T, D, S, CUBE_COLORS.yellow) : ''}
    ${isYellow(0, 1) ? rect(T + 2 * S + G, T + S, D, S, CUBE_COLORS.yellow) : ''}
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
    <rect x="18" y="18" width="64" height="26" rx="3" fill="${CUBE_COLORS.yellow}" stroke="#1e293b" stroke-width="1.2"/>
    <text x="50" y="35" text-anchor="middle" font-size="11" font-weight="700" fill="#111827">
      ${isOppOpp || isOppSolved ? 'OPP SWAP' : 'ADJ BAR'}
    </text>

    <!-- Divider Line -->
    <line x1="14" y1="50" x2="86" y2="50" stroke="#4a5568" stroke-width="2" stroke-dasharray="3,3"/>

    <!-- Bottom Layer (Layer 2) -->
    <rect x="18" y="56" width="64" height="26" rx="3" fill="${CUBE_COLORS.white}" stroke="#1e293b" stroke-width="1.2"/>
    <text x="50" y="73" text-anchor="middle" font-size="11" font-weight="700" fill="#111827">
      ${isAdjSolved || isOppSolved ? 'SOLVED' : (isOppOpp || isAdjOpp ? 'OPP SWAP' : 'ADJ BAR')}
    </text>
  </svg>`;
}

// ---------------------------------------------------------------------------
// 3x3 OLL SVG (Orientation of the Last Layer - 57 Cases)
// Top face 3x3 (Yellow/Slate) + Yellow side indicator bars around perimeter
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
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.5" fill="${fill}" stroke="#1e293b" stroke-width="1.1"/>`;

  const topColor = (isY) => isY ? CUBE_COLORS.yellow : CUBE_COLORS.slate;

  return `<svg viewBox="0 0 ${W} ${W}" class="case-svg case-svg-oll" xmlns="http://www.w3.org/2000/svg">
    <!-- Top Face (3x3 grid) -->
    <!-- Row 0 (Back): UBL (corner 2), UB (edge 2), UBR (corner 1) -->
    ${rect(T, T, S, S, topColor(isCornerYellow(2, 0)))}
    ${rect(T + S, T, S, S, topColor(isEdgeYellow(2, 0)))}
    ${rect(T + 2 * S, T, S, S, topColor(isCornerYellow(1, 0)))}

    <!-- Row 1 (Mid): UL (edge 3), Center (always yellow), UR (edge 1) -->
    ${rect(T, T + S, S, S, topColor(isEdgeYellow(3, 0)))}
    ${rect(T + S, T + S, S, S, CUBE_COLORS.yellow)}
    ${rect(T + 2 * S, T + S, S, S, topColor(isEdgeYellow(1, 0)))}

    <!-- Row 2 (Front): UFL (corner 3), UF (edge 0), UFR (corner 0) -->
    ${rect(T, T + 2 * S, S, S, topColor(isCornerYellow(3, 0)))}
    ${rect(T + S, T + 2 * S, S, S, topColor(isEdgeYellow(0, 0)))}
    ${rect(T + 2 * S, T + 2 * S, S, S, topColor(isCornerYellow(0, 0)))}

    <!-- Back side (top) yellow indicators -->
    ${isCornerYellow(2, 2) ? rect(T, M, S, D, CUBE_COLORS.yellow) : ''}
    ${isEdgeYellow(2, 1) ? rect(T + S, M, S, D, CUBE_COLORS.yellow) : ''}
    ${isCornerYellow(1, 1) ? rect(T + 2 * S, M, S, D, CUBE_COLORS.yellow) : ''}

    <!-- Front side (bottom) yellow indicators -->
    ${isCornerYellow(3, 1) ? rect(T, T + 3 * S + G, S, D, CUBE_COLORS.yellow) : ''}
    ${isEdgeYellow(0, 1) ? rect(T + S, T + 3 * S + G, S, D, CUBE_COLORS.yellow) : ''}
    ${isCornerYellow(0, 2) ? rect(T + 2 * S, T + 3 * S + G, S, D, CUBE_COLORS.yellow) : ''}

    <!-- Left side (left) yellow indicators -->
    ${isCornerYellow(2, 1) ? rect(M, T, D, S, CUBE_COLORS.yellow) : ''}
    ${isEdgeYellow(3, 1) ? rect(M, T + S, D, S, CUBE_COLORS.yellow) : ''}
    ${isCornerYellow(3, 2) ? rect(M, T + 2 * S, D, S, CUBE_COLORS.yellow) : ''}

    <!-- Right side (right) yellow indicators -->
    ${isCornerYellow(1, 2) ? rect(T + 3 * S + G, T, D, S, CUBE_COLORS.yellow) : ''}
    ${isEdgeYellow(1, 1) ? rect(T + 3 * S + G, T + S, D, S, CUBE_COLORS.yellow) : ''}
    ${isCornerYellow(0, 1) ? rect(T + 3 * S + G, T + 2 * S, D, S, CUBE_COLORS.yellow) : ''}
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
    FACE_COLORS[CORNER_FACES_333[cPieces[loc]][(o - cOrient[loc] + 3) % 3]] || CUBE_COLORS.yellow;

  const edgeColor = (loc, o) =>
    FACE_COLORS[EDGE_FACES_333[ePieces[loc]][(o - eOrient[loc] + 2) % 2]] || CUBE_COLORS.yellow;

  const S = 22; // top sticker size
  const D = 8;  // side sticker depth
  const G = 2.5;// gap
  const M = 2.5;// margin
  const T = M + D + G;
  const W = T * 2 + 3 * S;

  const rect = (x, y, w, h, fill) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.5" fill="${fill}" stroke="#1e293b" stroke-width="1.1"/>`;

  // Arrows overlay
  const arrows = PLL_ARROWS[caseObj.id] || [];
  let arrowSvg = "";
  arrows.forEach(a => {
    const arrowColor = (a.arrowType === "corner" || a.color === ARROW_CORNER) ? CUBE_COLORS.red : CUBE_COLORS.blue;
    if (a.type === "double") {
      arrowSvg += `
        <line x1="${a.x1}" y1="${a.y1}" x2="${a.x2}" y2="${a.y2}" stroke="${arrowColor}" stroke-width="3.5" stroke-linecap="round"/>
        <circle cx="${a.x1}" cy="${a.y1}" r="3.5" fill="${arrowColor}"/>
        <circle cx="${a.x2}" cy="${a.y2}" r="3.5" fill="${arrowColor}"/>
      `;
    } else if (a.type === "cycle3") {
      arrowSvg += `
        <path d="M ${a.p1[0]} ${a.p1[1]} Q 50 50 ${a.p2[0]} ${a.p2[1]} Q 50 50 ${a.p3[0]} ${a.p3[1]} Z" fill="none" stroke="${arrowColor}" stroke-width="3" stroke-dasharray="4,2"/>
        <circle cx="${a.p1[0]}" cy="${a.p1[1]}" r="3.5" fill="${arrowColor}"/>
        <circle cx="${a.p2[0]}" cy="${a.p2[1]}" r="3.5" fill="${arrowColor}"/>
        <circle cx="${a.p3[0]}" cy="${a.p3[1]}" r="3.5" fill="${arrowColor}"/>
      `;
    }
  });

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

  const rect = (x, y, w, h, fill, stroke = "#1e293b", strokeW = 1.1) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="1.5" fill="${fill}" stroke="${stroke}" stroke-width="${strokeW}"/>`;

  return `<svg viewBox="0 0 ${W} ${W}" class="case-svg case-svg-f2l" xmlns="http://www.w3.org/2000/svg">
    <!-- Base 3x3 Top Layer in neutral slate grey -->
    ${rect(T, T, S, S, CUBE_COLORS.slate)}
    ${rect(T + S, T, S, S, CUBE_COLORS.slate)}
    ${rect(T + 2 * S, T, S, S, CUBE_COLORS.slate)}
    ${rect(T, T + S, S, S, CUBE_COLORS.slate)}
    ${rect(T + S, T + S, S, S, CUBE_COLORS.yellow)}
    ${rect(T + 2 * S, T + S, S, S, CUBE_COLORS.blue)}
    ${rect(T, T + 2 * S, S, S, CUBE_COLORS.slate)}
    ${rect(T + S, T + 2 * S, S, S, CUBE_COLORS.green)}

    <!-- Front-Right Active Target Slot (UFR / FR slot highlighted in vibrant speedcube red) -->
    ${rect(T + 2 * S, T + 2 * S, S, S, CUBE_COLORS.red, CUBE_COLORS.red, 2.2)}

    <!-- Target Slot Outline indicator (White badge with Red text) -->
    <circle cx="${T + 2 * S + S / 2}" cy="${T + 2 * S + S / 2}" r="7" fill="${CUBE_COLORS.white}" stroke="#111827" stroke-width="1.5"/>
    <text x="${T + 2 * S + S / 2}" y="${T + 2 * S + S / 2 + 3.5}" text-anchor="middle" font-size="9" font-weight="900" fill="${CUBE_COLORS.red}">FR</text>
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
    <!-- Cross pieces in White -->
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
