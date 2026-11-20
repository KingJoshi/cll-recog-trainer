// Pure synchronous isometric 3D 2x2x2 cube SVG renderer for 1st Layer study & quiz cards
// Renders U, F, R primary 3D faces plus non-overlapping floating D, L, B reflection facelets
// so every White first-layer corner orientation & bar/diagonal pattern is readable at a glance.

import { CORNER_FACES_333 } from './cubeUtils.js';
import { CUBE_COLORS, FACE_COLORS } from './cubeColors.js';

const CORNER_NAMES = ['UFR', 'UBR', 'UBL', 'UFL', 'DFR', 'DFL', 'DBL', 'DBR'];
const WHITE_PIECES = new Set([4, 5, 6, 7]);

function faceColor(face) {
  // Match <scramble-display> in z2 orientation (D=white, U=yellow, F=green, B=blue, L=red, R=orange)
  if (face === 'L') return CUBE_COLORS.red;
  if (face === 'R') return CUBE_COLORS.orange;
  return FACE_COLORS[face] || CUBE_COLORS[face] || CUBE_COLORS.slate;
}

/**
 * Derive exact 8-slot (piece, ori) map for any 1st-layer bar/bottom case.
 * Unlisted slots contain non-White U-layer corners and render in neutral slate.
 */
export function resolveFirstLayerCornerState(caseObj) {
  const slots = new Array(8).fill(null);
  if (!caseObj) {
    slots[4] = { piece: 4, ori: 0 };
    slots[5] = { piece: 5, ori: 0 };
    slots[6] = { piece: 6, ori: 0 };
    slots[7] = { piece: 7, ori: 0 };
    return slots;
  }

  const grp = caseObj.group;
  if (grp === 'one-bottom') {
    slots[6] = { piece: 6, ori: 0 }; // DBL anchor
    const pSlot = Number.isInteger(caseObj.partnerSlotIdx)
      ? caseObj.partnerSlotIdx
      : CORNER_NAMES.indexOf(caseObj.partnerSlot);
    if (pSlot >= 0) {
      slots[pSlot] = { piece: 5, ori: caseObj.partnerOri ?? 0 };
    }
    if (Number.isInteger(caseObj.other1SlotIdx) && caseObj.other1SlotIdx >= 0) {
      slots[caseObj.other1SlotIdx] = { piece: 4, ori: caseObj.other1Ori ?? 0 };
    }
    if (Number.isInteger(caseObj.other2SlotIdx) && caseObj.other2SlotIdx >= 0) {
      slots[caseObj.other2SlotIdx] = { piece: 7, ori: caseObj.other2Ori ?? 0 };
    }
    return slots;
  }

  if (grp === 'two-diag') {
    slots[6] = { piece: 6, ori: 0 }; // DBL diagonal anchor
    slots[4] = { piece: 4, ori: 0 }; // DFR diagonal anchor
    const flIdx = Number.isInteger(caseObj.flSlotIdx)
      ? caseObj.flSlotIdx
      : CORNER_NAMES.indexOf(caseObj.flSlot);
    const brIdx = Number.isInteger(caseObj.brSlotIdx)
      ? caseObj.brSlotIdx
      : CORNER_NAMES.indexOf(caseObj.brSlot);
    if (flIdx >= 0) slots[flIdx] = { piece: 5, ori: caseObj.flOri ?? 0 };
    if (brIdx >= 0) slots[brIdx] = { piece: 7, ori: caseObj.brOri ?? 0 };
    return slots;
  }

  // Default: Bar-on-Left ('two-bar', 'three-bottom', or bar-75)
  slots[5] = { piece: 5, ori: 0 }; // DFL anchor
  slots[6] = { piece: 6, ori: 0 }; // DBL anchor
  const fpIdx = Number.isInteger(caseObj.fpSlotIdx)
    ? caseObj.fpSlotIdx
    : CORNER_NAMES.indexOf(caseObj.fpSlot);
  const bpIdx = Number.isInteger(caseObj.bpSlotIdx)
    ? caseObj.bpSlotIdx
    : CORNER_NAMES.indexOf(caseObj.bpSlot);
  if (fpIdx >= 0) slots[fpIdx] = { piece: 4, ori: caseObj.fpOri ?? 0 };
  if (bpIdx >= 0) slots[bpIdx] = { piece: 7, ori: caseObj.bpOri ?? 0 };
  return slots;
}

function getSlotStickerColor(slots, slotIdx, faceLetter, slateColor) {
  const entry = slots[slotIdx];
  if (!entry || !WHITE_PIECES.has(entry.piece)) {
    return slateColor;
  }
  const faceIdx = CORNER_FACES_333[slotIdx].indexOf(faceLetter);
  if (faceIdx < 0) return slateColor;
  const origFace = CORNER_FACES_333[entry.piece][(faceIdx - entry.ori + 3) % 3];
  return faceColor(origFace);
}

/**
 * Render an isometric 3D 2x2x2 cube SVG with floating D / L / B hint facelets.
 */
export function renderFirstLayer3dSvg(caseObj, { compact = false } = {}) {
  const slots = resolveFirstLayerCornerState(caseObj);
  const slate = CUBE_COLORS.slate || '#374151';
  const sticker = (slotIdx, faceLetter) => getSlotStickerColor(slots, slotIdx, faceLetter, slate);
  const isWhiteHighlight = (slotIdx, faceLetter) => sticker(slotIdx, faceLetter).toLowerCase() === (CUBE_COLORS.white || '#ffffff').toLowerCase();

  // Primary isometric frame: UFR center at (ox, oy)
  const ox = 72;
  const oy = 56;
  const ax = -19;
  const ay = -10;
  const bx = 19;
  const by = -10;
  const zx = 0;
  const zy = 20;

  const pt = (a, b, z) => [
    +(ox + a * ax + b * bx + z * zx).toFixed(1),
    +(oy + a * ay + b * by + z * zy).toFixed(1)
  ];

  const poly = (pts, fill, { strokeWidth = 1.25, opacity = 1, extra = '' } = {}) =>
    `<polygon points="${pts.map(p => p.join(',')).join(' ')}" fill="${fill}" stroke="#0f172a" stroke-width="${strokeWidth}" stroke-linejoin="round"${opacity < 1 ? ` opacity="${opacity}"` : ''}${extra}/>`;

  let svg = '';

  // 1. Floating L & B reflection panels (drawn first behind outer shoulders)
  // Left reflection strip (DBL/UBL outer left, DFL/UFL inner left), x = 14..30
  const lQuad = (col, row) => {
    // col 0 = Back (B), col 1 = Front (F); row 0 = Top (U), row 1 = Bottom (D)
    const xOuter = 14;
    const xInner = 29;
    const midX = (xOuter + xInner) / 2;
    const x0 = col === 0 ? xOuter : midX;
    const x1 = col === 0 ? midX : xInner;
    const ySlope = (x) => 22 + ((x - xOuter) / (xInner - xOuter)) * 10;
    const rowH = 19;
    return [
      [x0, ySlope(x0) + row * rowH],
      [x1, ySlope(x1) + row * rowH],
      [x1, ySlope(x1) + (row + 1) * rowH],
      [x0, ySlope(x0) + (row + 1) * rowH]
    ];
  };
  const lGrid = [
    [sticker(2, 'L'), sticker(3, 'L')],
    [sticker(6, 'L'), sticker(5, 'L')]
  ];
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 2; c++) {
      svg += poly(lQuad(c, r), lGrid[r][c], { strokeWidth: 0.9, opacity: 0.9 });
    }
  }

  // Right-back reflection strip (B face: col 0 = UBR/DBR, col 1 = UBL/DBL), x = 115..130
  const bQuad = (col, row) => {
    const xInner = 115;
    const xOuter = 130;
    const midX = (xInner + xOuter) / 2;
    const x0 = col === 0 ? xInner : midX;
    const x1 = col === 0 ? midX : xOuter;
    const ySlope = (x) => 32 - ((x - xInner) / (xOuter - xInner)) * 10;
    const rowH = 19;
    return [
      [x0, ySlope(x0) + row * rowH],
      [x1, ySlope(x1) + row * rowH],
      [x1, ySlope(x1) + (row + 1) * rowH],
      [x0, ySlope(x0) + (row + 1) * rowH]
    ];
  };
  const bGrid = [
    [sticker(1, 'B'), sticker(2, 'B')],
    [sticker(7, 'B'), sticker(6, 'B')]
  ];
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 2; c++) {
      svg += poly(bQuad(c, r), bGrid[r][c], { strokeWidth: 0.9, opacity: 0.9 });
    }
  }

  // 2. Primary U face (Top: UBL=2, UBR=1, UFL=3, UFR=0)
  const uGrid = [
    [sticker(2, 'U'), sticker(1, 'U')],
    [sticker(3, 'U'), sticker(0, 'U')]
  ];
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 2; c++) {
      const a0 = 2 - c, a1 = 1 - c;
      const b0 = 2 - r, b1 = 1 - r;
      svg += poly([pt(a0, b0, 0), pt(a1, b0, 0), pt(a1, b1, 0), pt(a0, b1, 0)], uGrid[r][c]);
    }
  }

  // 3. Primary F face (Front-Left: row 0 = UFL(3), UFR(0); row 1 = DFL(5), DFR(4))
  const fGrid = [
    [sticker(3, 'F'), sticker(0, 'F')],
    [sticker(5, 'F'), sticker(4, 'F')]
  ];
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 2; c++) {
      const a0 = 2 - c, a1 = 1 - c;
      svg += poly([pt(a0, 0, r), pt(a1, 0, r), pt(a1, 0, r + 1), pt(a0, 0, r + 1)], fGrid[r][c]);
    }
  }

  // 4. Primary R face (Front-Right: row 0 = UFR(0), UBR(1); row 1 = DFR(4), DBR(7))
  const rGrid = [
    [sticker(0, 'R'), sticker(1, 'R')],
    [sticker(4, 'R'), sticker(7, 'R')]
  ];
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 2; c++) {
      const b0 = c, b1 = c + 1;
      svg += poly([pt(0, b0, r), pt(0, b1, r), pt(0, b1, r + 1), pt(0, b0, r + 1)], rGrid[r][c]);
    }
  }

  // 5. Floating Bottom (D) reflection diamond directly beneath DFR/DFL/DBR:
  // Top vertex = DFR (0,0) -> (72, 102), Left = DFL (1,0), Right = DBR (0,1), Bottom = DBL (1,1)
  const dOx = 72;
  const dOy = 102;
  const dax = -15.5;
  const day = 8.2;
  const dbx = 15.5;
  const dby = 8.2;
  const dPt = (a, b) => [+(dOx + a * dax + b * dbx).toFixed(1), +(dOy + a * day + b * dby).toFixed(1)];
  const dMap = [
    { a: 1, b: 1, slot: 6 }, // DBL (back-bottom)
    { a: 1, b: 0, slot: 5 }, // DFL (front-left)
    { a: 0, b: 1, slot: 7 }, // DBR (back-right)
    { a: 0, b: 0, slot: 4 }  // DFR (front-top)
  ];
  for (const cell of dMap) {
    const col = sticker(cell.slot, 'D');
    const isWhite = isWhiteHighlight(cell.slot, 'D');
    svg += poly(
      [dPt(cell.a, cell.b), dPt(cell.a + 1, cell.b), dPt(cell.a + 1, cell.b + 1), dPt(cell.a, cell.b + 1)],
      col,
      { strokeWidth: isWhite ? 1.35 : 0.9, opacity: 0.94 }
    );
  }

  const cls = compact ? 'flb-3d-svg is-compact' : 'flb-3d-svg';
  return `<svg viewBox="0 0 144 142" class="${cls}" role="img" aria-label="2x2 3D Isometric Model">${svg}</svg>`;
}
