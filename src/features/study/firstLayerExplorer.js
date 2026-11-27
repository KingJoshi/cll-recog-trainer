// Dedicated interactive visualizers, explorers, guides & quizzes for 2x2 1st Face and 1st Layer (Bottom-Piece Case Groups)

import { FIRST_LAYER_BAR_CASES, FIRST_LAYER_BAR_STATS, FIRST_LAYER_TWO_LOOK } from '../../data/firstLayerBarData.js';
import {
  FIRST_LAYER_ONE_BOTTOM_CASES,
  FIRST_LAYER_DIAG_CASES,
  FIRST_LAYER_THREE_BOTTOM_CASES,
  FIRST_LAYER_BAR_PURE_CASES
} from '../../data/firstLayerBottomData.js';
import { renderFirstLayer3dSvg } from '../../cube/firstLayer3dSvg.js';
import { applyColorsTo3DCube } from '../../caseVisualizer.js';
import { SIM_SPEED_OPTIONS } from '../../state/appStore.js';
import { escapeHtml } from '../../services/htmlUtils.js';
import { cleanAlg, parseScrambleInput } from '../../algParser.js';
import {
  ICON_SKIP_START,
  ICON_STEP_BACK,
  ICON_PLAY,
  ICON_PAUSE,
  ICON_REPLAY,
  ICON_STEP_FORWARD,
  ICON_SKIP_END,
  ICON_RESET_ANGLE,
  ICON_POPUP_SIM,
  ICON_DIAGRAM,
  ICON_LEGEND,
  renderIconLegendHtml
} from '../../ui/transportIcons.js';

let FlbScrambleDisplayClass = null;
async function getFlbScrambleDisplay() {
  if (!FlbScrambleDisplayClass && typeof window !== 'undefined') {
    const mod = await import('scramble-display');
    FlbScrambleDisplayClass = mod.ScrambleDisplay;
  }
  return FlbScrambleDisplayClass;
}

const TOTAL_LAYER_CASES =
  FIRST_LAYER_ONE_BOTTOM_CASES.length +
  FIRST_LAYER_BAR_PURE_CASES.length +
  FIRST_LAYER_DIAG_CASES.length +
  FIRST_LAYER_THREE_BOTTOM_CASES.length;

function normalizeGroupId(groupId) {
  if (groupId === 'one-bottom' || groupId === 'two-bar' || groupId === 'two-diag' || groupId === 'three-bottom') {
    return groupId;
  }
  return 'two-bar';
}

const EXPLORER_GROUP_TABS = [
  { id: 'one-bottom', label: `1 in Bottom (${FIRST_LAYER_ONE_BOTTOM_CASES.length})`, count: FIRST_LAYER_ONE_BOTTOM_CASES.length },
  { id: 'two-bar', label: `2 Bottom: Bar (${FIRST_LAYER_BAR_PURE_CASES.length})`, count: FIRST_LAYER_BAR_PURE_CASES.length },
  { id: 'two-diag', label: `2 Bottom: Diagonal (${FIRST_LAYER_DIAG_CASES.length})`, count: FIRST_LAYER_DIAG_CASES.length },
  { id: 'three-bottom', label: `3 in Bottom (${FIRST_LAYER_THREE_BOTTOM_CASES.length})`, count: FIRST_LAYER_THREE_BOTTOM_CASES.length }
];

const QUIZ_GROUP_TABS = [
  { id: 'one-bottom', label: `1 in Bottom (${FIRST_LAYER_ONE_BOTTOM_CASES.length})` },
  { id: 'two-bar', label: `2 Bottom: Bar (${FIRST_LAYER_BAR_PURE_CASES.length})` },
  { id: 'two-diag', label: `2 Bottom: Diagonal (${FIRST_LAYER_DIAG_CASES.length})` },
  { id: 'three-bottom', label: `3 in Bottom (${FIRST_LAYER_THREE_BOTTOM_CASES.length})` }
];

function getCasesForGroup(groupId) {
  const norm = normalizeGroupId(groupId);
  if (norm === 'one-bottom') return FIRST_LAYER_ONE_BOTTOM_CASES;
  if (norm === 'two-diag') return FIRST_LAYER_DIAG_CASES;
  if (norm === 'three-bottom') return FIRST_LAYER_THREE_BOTTOM_CASES;
  return FIRST_LAYER_BAR_PURE_CASES;
}

function getGroupBanner(groupId) {
  const norm = normalizeGroupId(groupId);
  if (norm === 'one-bottom') {
    return 'Strictly 1 white face on bottom (DBL anchor — no bar, no second white sticker on D). Every case solves the complete 1st Layer in 2 steps: build the Left Bar (DFL + DBL), then finish DFR + DBR.';
  }
  if (norm === 'two-diag') {
    return '2 corners solved Diagonally (DBL + DFR solved). Resolve the remaining DFL + DBR pair cleanly in 3–6 <R, U, F> moves (no cube rotation needed).';
  }
  if (norm === 'three-bottom') {
    return '3 corners solved in Bottom (DFL + DBL + DBR). Only DFR remains — and when all 4 corners are solved, you are straight into CLL!';
  }
  return '2 corners solved Adjacent on the Left (DFL + DBL Bar; excludes the 5 cases where DBR is already solved in 3 in Bottom).';
}

function getCaseCodeBadge(c) {
  if (c.group === 'one-bottom') return `1B-${c.index}`;
  if (c.group === 'two-diag') return `D-${c.index}`;
  if (c.group === 'three-bottom') return `3B-${c.threeIndex || c.index} (#${c.index})`;
  return `#${c.index}`;
}

function getCasePrimaryMoves(c) {
  return c.fullRuAlg || c.fullAlg || '';
}

function getCaseMoveCount(c) {
  return c.ruMoves ?? c.moveCount ?? 0;
}

function getCaseCornerOverlay(c) {
  if (c.group === 'one-bottom') {
    return {
      solvedBottomSlots: ['DBL'],
      pieceA: { slot: c.partnerSlot, white: c.partnerWhite, label: 'A', tagText: `DFL: ${c.partnerSlot} (${c.partnerWhite})` },
      pieceB: null,
      footerU: 'Front (F) · DBL Fixed',
      footerD: 'A = Partner for DFL'
    };
  }
  if (c.group === 'two-diag') {
    return {
      solvedBottomSlots: ['DBL', 'DFR'],
      pieceA: { slot: c.flSlot, white: c.flWhite, label: 'A', tagText: `DFL: ${c.flSlot} (${c.flWhite})` },
      pieceB: { slot: c.brSlot, white: c.brWhite, label: 'B', tagText: `DBR: ${c.brSlot} (${c.brWhite})` },
      footerU: 'Front (F) · Diag Fixed',
      footerD: 'A = DFL · B = DBR'
    };
  }
  return {
    solvedBottomSlots: c.group === 'three-bottom' ? ['DBL', 'DFL', 'DBR'] : ['DBL', 'DFL'],
    pieceA: { slot: c.fpSlot, white: c.fpWhite, label: 'A', tagText: `FP: ${c.fpSlot} (${c.fpWhite})` },
    pieceB: { slot: c.bpSlot, white: c.bpWhite, label: 'B', tagText: `BP: ${c.bpSlot} (${c.bpWhite})` },
    footerU: 'Front (F) · Left Bar Fixed',
    footerD: 'A = FP (DFR) · B = BP (DBR)'
  };
}

export const FIRST_FACE_EXAMPLES = [
  {
    id: 'ff-1',
    label: '1-Move Finish → Solved Layer',
    face: 'white',
    moveCount: 1,
    inspection: 'none',
    bottomPerm: 'Layer Solved',
    caseId: 'CLL / LBL',
    moves: 'R',
    scramble: cleanAlg("z2 R'"),
    note: 'Look for 2 adjacent white corners already solved on D + the right pair ready on the R face — 1 quarter turn builds a full CLL layer!'
  },
  {
    id: 'ff-2',
    label: '1-Move Adj Bar → Ortega / EG-1',
    face: 'white',
    moveCount: 1,
    inspection: 'none',
    bottomPerm: 'Adj Bar',
    caseId: 'EG-1 / PBL',
    moves: 'R',
    scramble: cleanAlg("z2 L2 U' F2 U2 L2 U' L2 R'"),
    note: 'DBL + DFL/DBR align so 1 quarter turn R drops the last piece into an Adjacent-Bar 1st face (Bar in Back on DBL+DBR, ready for Ortega PBL or EG-1).'
  },
  {
    id: 'ff-3',
    label: '2-Move Back Bar → Ortega / EG-1',
    face: 'white',
    moveCount: 2,
    inspection: 'none',
    bottomPerm: 'Adj Bar',
    caseId: 'EG-1 / PBL',
    moves: "U R'",
    scramble: cleanAlg("z2 L2 U' F2 U2 L2 U' L2 R U'"),
    note: '2-move Ortega face! Align with U and drop the back-right corner in with R\' — hold the resulting Back Bar on DBL+DBR.'
  },
  {
    id: 'ff-4',
    label: '2-Move Diag Swap → Ortega / EG-2',
    face: 'white',
    moveCount: 2,
    inspection: 'none',
    bottomPerm: 'Opp (No Bar)',
    caseId: 'EG-2 / PBL',
    moves: "U' R",
    scramble: cleanAlg("z2 R2 F2 R U"),
    note: 'Opposite side colors on the bottom face (no matching bars) = Diagonal Swap bottom state → triggers super-fast R2 F2 R2 PBL or EG-2!'
  },
  {
    id: 'ff-5',
    label: '3-Move Direct Insert → Solved Layer',
    face: 'white',
    moveCount: 3,
    inspection: 'none',
    bottomPerm: 'Layer Solved',
    caseId: 'CLL / LBL',
    moves: "R U R'",
    scramble: cleanAlg("z2 R U' R'"),
    note: 'Standard 3-move R U R\' corner insert when 3 bottom corners are already in place.'
  },
  {
    id: 'ff-6',
    label: '4-Move Hedge Face → Back Bar',
    face: 'white',
    moveCount: 4,
    inspection: 'none',
    bottomPerm: 'Adj Bar',
    caseId: 'EG-1 / PBL',
    moves: "F R' F' R",
    scramble: cleanAlg("z2 L2 U' F2 U2 L2 U' L2 R' F R F'"),
    note: 'When a bottom-layer sticker needs reorienting while building a face, Hedge (F R\' F\' R) flips it cleanly into a Back Bar on DBL+DBR.'
  }
];

const RIM_ORDER = { front: 0, top: 1, back: 2 };
const RIM_BAR_CASES = FIRST_LAYER_BAR_CASES
  .filter(c => c.isRimBar)
  .sort((a, b) => (RIM_ORDER[a.rimBarType] ?? 9) - (RIM_ORDER[b.rimBarType] ?? 9));

function whiteDirLabel(dir) {
  const names = { U: 'Up (U)', D: 'Down (D)', F: 'Front (F)', R: 'Right (R)', B: 'Back (B)', L: 'Left (L)' };
  return names[dir] || dir;
}

/**
 * Dual SVG #1 (PDF #1): Top Layer (U) + Bottom Layer (D with Solved Left Bar DFL+DBL),
 * plotting FP (A) & BP (B) slots and White-sticker side tabs / inner tiles.
 */
export function renderTopBottomMapSvg(c) {
  const S = 44;
  const uX = 28;
  const dX = 188;
  const Y = 28;
  const overlay = getCaseCornerOverlay(c);
  const solvedSet = new Set(overlay.solvedBottomSlots);

  const slotRect = {
    UBL: { x: uX, y: Y, col: 0, row: 0, layer: 'U' },
    UBR: { x: uX + S, y: Y, col: 1, row: 0, layer: 'U' },
    UFL: { x: uX, y: Y + S, col: 0, row: 1, layer: 'U' },
    UFR: { x: uX + S, y: Y + S, col: 1, row: 1, layer: 'U' },
    DBL: { x: dX, y: Y, col: 0, row: 0, layer: 'D' },
    DBR: { x: dX + S, y: Y, col: 1, row: 0, layer: 'D' },
    DFL: { x: dX, y: Y + S, col: 0, row: 1, layer: 'D' },
    DFR: { x: dX + S, y: Y + S, col: 1, row: 1, layer: 'D' }
  };

  function stickerMarker(slotName, whiteDir, badgeLetter, color) {
    const r = slotRect[slotName];
    if (!r) return '';
    const cx = r.x + S / 2;
    const cy = r.y + S / 2;
    let tab = '';

    if (whiteDir === 'U' || whiteDir === 'D') {
      tab = `<rect x="${r.x + 5}" y="${r.y + 5}" width="${S - 10}" height="${S - 10}" rx="5" fill="#ffffff" stroke="${color}" stroke-width="2.4"/>`;
    } else if (whiteDir === 'F') {
      tab = `<rect x="${r.x + 4}" y="${r.y + S + 3}" width="${S - 8}" height="9" rx="2.5" fill="#ffffff" stroke="#0f172a" stroke-width="1.3"/>`;
    } else if (whiteDir === 'B') {
      tab = `<rect x="${r.x + 4}" y="${r.y - 12}" width="${S - 8}" height="9" rx="2.5" fill="#ffffff" stroke="#0f172a" stroke-width="1.3"/>`;
    } else if (whiteDir === 'R') {
      tab = `<rect x="${r.x + S + 3}" y="${r.y + 4}" width="9" height="${S - 8}" rx="2.5" fill="#ffffff" stroke="#0f172a" stroke-width="1.3"/>`;
    } else if (whiteDir === 'L') {
      tab = `<rect x="${r.x - 12}" y="${r.y + 4}" width="9" height="${S - 8}" rx="2.5" fill="#ffffff" stroke="#0f172a" stroke-width="1.3"/>`;
    }

    const badge = `
      <circle cx="${cx}" cy="${cy}" r="12" fill="${color}" stroke="#0f172a" stroke-width="1.5"/>
      <text x="${cx}" y="${cy + 4}" text-anchor="middle" font-size="11.5" font-weight="800" fill="#ffffff" font-family="system-ui, sans-serif">${badgeLetter}</text>
    `;
    return `${tab}${badge}`;
  }

  function renderDSlot(slotName) {
    const r = slotRect[slotName];
    if (solvedSet.has(slotName)) {
      return `
        <rect x="${r.x}" y="${r.y}" width="${S}" height="${S}" fill="#15803d" stroke="#1e293b" stroke-width="1.4" rx="2"/>
        <rect x="${r.x + 5}" y="${r.y + 5}" width="${S - 10}" height="${S - 10}" rx="4" fill="#ffffff" opacity="0.92"/>
        <text x="${r.x + S / 2}" y="${r.y + S / 2 + 3}" text-anchor="middle" font-size="8" font-weight="800" fill="#166534" font-family="system-ui, sans-serif">${slotName} ✓</text>
      `;
    }
    return `
      <rect x="${r.x}" y="${r.y}" width="${S}" height="${S}" fill="#334155" stroke="#1e293b" stroke-width="1.4" rx="2"/>
      <text x="${r.x + 6}" y="${r.y + 12}" font-size="7.5" font-weight="700" fill="#94a3b8" font-family="system-ui, sans-serif">${slotName}</text>
    `;
  }

  return `
    <svg viewBox="0 0 304 150" class="flb-svg flb-topbottom-svg" role="img" aria-label="Top and Bottom Layer diagram">
      <text x="${uX + S}" y="12" text-anchor="middle" font-size="10.5" font-weight="800" fill="currentColor" font-family="system-ui, sans-serif">TOP LAYER (U)</text>
      <text x="${dX + S}" y="12" text-anchor="middle" font-size="10.5" font-weight="800" fill="currentColor" font-family="system-ui, sans-serif">BOTTOM LAYER (D · White)</text>

      <rect x="${uX}" y="${Y}" width="${S}" height="${S}" fill="#334155" stroke="#1e293b" stroke-width="1.4" rx="2"/>
      <rect x="${uX + S}" y="${Y}" width="${S}" height="${S}" fill="#334155" stroke="#1e293b" stroke-width="1.4" rx="2"/>
      <rect x="${uX}" y="${Y + S}" width="${S}" height="${S}" fill="#334155" stroke="#1e293b" stroke-width="1.4" rx="2"/>
      <rect x="${uX + S}" y="${Y + S}" width="${S}" height="${S}" fill="#334155" stroke="#1e293b" stroke-width="1.4" rx="2"/>

      <text x="${uX + 6}" y="${Y + 12}" font-size="7.5" font-weight="700" fill="#94a3b8" font-family="system-ui, sans-serif">UBL</text>
      <text x="${uX + S + 6}" y="${Y + 12}" font-size="7.5" font-weight="700" fill="#94a3b8" font-family="system-ui, sans-serif">UBR</text>
      <text x="${uX + 6}" y="${Y + S + 12}" font-size="7.5" font-weight="700" fill="#94a3b8" font-family="system-ui, sans-serif">UFL</text>
      <text x="${uX + S + 6}" y="${Y + S + 12}" font-size="7.5" font-weight="700" fill="#94a3b8" font-family="system-ui, sans-serif">UFR</text>

      ${renderDSlot('DBL')}
      ${renderDSlot('DBR')}
      ${renderDSlot('DFL')}
      ${renderDSlot('DFR')}

      ${overlay.pieceA ? stickerMarker(overlay.pieceA.slot, overlay.pieceA.white, 'A', '#2563eb') : ''}
      ${overlay.pieceB && !solvedSet.has(overlay.pieceB.slot) ? stickerMarker(overlay.pieceB.slot, overlay.pieceB.white, 'B', '#d97706') : ''}

      <text x="${uX + S}" y="138" text-anchor="middle" font-size="8.5" font-weight="700" fill="#94a3b8" font-family="system-ui, sans-serif">${escapeHtml(overlay.footerU)}</text>
      <text x="${dX + S}" y="138" text-anchor="middle" font-size="8.5" font-weight="700" fill="#94a3b8" font-family="system-ui, sans-serif">${escapeHtml(overlay.footerD)}</text>
    </svg>
  `;
}

/**
 * Dual SVG #2 (PDF #2): Side-View looking directly at the R-face (Front on left, Back on right),
 * highlighting Rim Bars & clockwise R turn arrow.
 */
export function renderRFaceSideSvg(c) {
  const S = 44;
  const X = 42;
  const Y = 30;
  const slots = {
    UFR: { x: X, y: Y },
    UBR: { x: X + S, y: Y },
    DFR: { x: X, y: Y + S },
    DBR: { x: X + S, y: Y + S }
  };
  const overlay = getCaseCornerOverlay(c);
  const solvedSet = new Set(overlay.solvedBottomSlots);

  function drawPieceOnR(slotName, whiteDir, letter, color) {
    const pos = slots[slotName];
    if (!pos) return '';
    const cx = pos.x + S / 2;
    const cy = pos.y + S / 2;
    let tab = '';
    if (whiteDir === 'R') {
      tab = `<rect x="${pos.x + 5}" y="${pos.y + 5}" width="${S - 10}" height="${S - 10}" rx="5" fill="#ffffff" stroke="${color}" stroke-width="2.4"/>`;
    } else if (whiteDir === 'U') {
      tab = `<rect x="${pos.x + 4}" y="${pos.y - 11}" width="${S - 8}" height="8" rx="2.5" fill="#ffffff" stroke="#0f172a" stroke-width="1.3"/>`;
    } else if (whiteDir === 'D') {
      tab = `<rect x="${pos.x + 4}" y="${pos.y + S + 3}" width="${S - 8}" height="8" rx="2.5" fill="#ffffff" stroke="#0f172a" stroke-width="1.3"/>`;
    } else if (whiteDir === 'F') {
      tab = `<rect x="${pos.x - 11}" y="${pos.y + 4}" width="8" height="${S - 8}" rx="2.5" fill="#ffffff" stroke="#0f172a" stroke-width="1.3"/>`;
    } else if (whiteDir === 'B') {
      tab = `<rect x="${pos.x + S + 3}" y="${pos.y + 4}" width="8" height="${S - 8}" rx="2.5" fill="#ffffff" stroke="#0f172a" stroke-width="1.3"/>`;
    }
    return `
      ${tab}
      <circle cx="${cx}" cy="${cy}" r="11.5" fill="${color}" stroke="#0f172a" stroke-width="1.5"/>
      <text x="${cx}" y="${cy + 4}" text-anchor="middle" font-size="11" font-weight="800" fill="#ffffff" font-family="system-ui, sans-serif">${letter}</text>
    `;
  }

  let rimOverlay = '';
  if (c.rimBarType === 'front') {
    rimOverlay = `<rect x="${X - 14}" y="${Y + 2}" width="14" height="${2 * S - 4}" rx="4" fill="none" stroke="#22c55e" stroke-width="2.6"/>`;
  } else if (c.rimBarType === 'top') {
    rimOverlay = `<rect x="${X + 2}" y="${Y - 14}" width="${2 * S - 4}" height="14" rx="4" fill="none" stroke="#22c55e" stroke-width="2.6"/>`;
  } else if (c.rimBarType === 'back') {
    rimOverlay = `<rect x="${X + 2 * S}" y="${Y + 2}" width="14" height="${2 * S - 4}" rx="4" fill="none" stroke="#22c55e" stroke-width="2.6"/>`;
  }

  const offSliceNotes = [];
  if (overlay.pieceA && !slots[overlay.pieceA.slot]) offSliceNotes.push(`A (${overlay.pieceA.slot}:${overlay.pieceA.white})`);
  if (overlay.pieceB && !slots[overlay.pieceB.slot]) offSliceNotes.push(`B (${overlay.pieceB.slot}:${overlay.pieceB.white})`);
  const algText = c.ruAlg || c.alg || getCasePrimaryMoves(c);
  const mvCount = getCaseMoveCount(c);

  return `
    <svg viewBox="0 0 184 150" class="flb-svg flb-rface-svg" role="img" aria-label="R-Face side view">
      <text x="${X + S}" y="12" text-anchor="middle" font-size="10.5" font-weight="800" fill="currentColor" font-family="system-ui, sans-serif">R-FACE VIEW (Front ← → Back)</text>
      <rect x="${X}" y="${Y}" width="${S}" height="${S}" fill="#b91c1c" opacity="0.22" stroke="#1e293b" stroke-width="1.4" rx="2"/>
      <rect x="${X + S}" y="${Y}" width="${S}" height="${S}" fill="#b91c1c" opacity="0.22" stroke="#1e293b" stroke-width="1.4" rx="2"/>
      <rect x="${X}" y="${Y + S}" width="${S}" height="${S}" fill="${solvedSet.has('DFR') ? '#15803d' : '#b91c1c'}" opacity="${solvedSet.has('DFR') ? '0.45' : '0.22'}" stroke="#1e293b" stroke-width="1.4" rx="2"/>
      <rect x="${X + S}" y="${Y + S}" width="${S}" height="${S}" fill="${solvedSet.has('DBR') ? '#15803d' : '#b91c1c'}" opacity="${solvedSet.has('DBR') ? '0.45' : '0.22'}" stroke="#1e293b" stroke-width="1.4" rx="2"/>

      <text x="${X - 4}" y="${Y + S}" text-anchor="end" font-size="8" font-weight="700" fill="#94a3b8" font-family="system-ui, sans-serif">F</text>
      <text x="${X + 2 * S + 6}" y="${Y + S}" text-anchor="start" font-size="8" font-weight="700" fill="#94a3b8" font-family="system-ui, sans-serif">B</text>

      ${overlay.pieceA ? drawPieceOnR(overlay.pieceA.slot, overlay.pieceA.white, 'A', '#2563eb') : ''}
      ${overlay.pieceB && !solvedSet.has(overlay.pieceB.slot) ? drawPieceOnR(overlay.pieceB.slot, overlay.pieceB.white, 'B', '#d97706') : ''}
      ${solvedSet.has('DFR') ? `<text x="${X + S / 2}" y="${Y + S + S / 2 + 4}" text-anchor="middle" font-size="11" font-weight="800" fill="#22c55e" font-family="system-ui, sans-serif">✓</text>` : ''}
      ${solvedSet.has('DBR') ? `<text x="${X + S + S / 2}" y="${Y + S + S / 2 + 4}" text-anchor="middle" font-size="11" font-weight="800" fill="#22c55e" font-family="system-ui, sans-serif">✓</text>` : ''}
      ${rimOverlay}

      <text x="${X + S}" y="135" text-anchor="middle" font-size="8.5" font-weight="700" fill="${c.isRimBar ? '#22c55e' : '#94a3b8'}" font-family="system-ui, sans-serif">
        ${c.isRimBar
          ? `Rim Bar (${c.rimBarType}) → 1 move: ${algText}`
          : (offSliceNotes.length ? `On L side: ${offSliceNotes.join(' · ')}` : `${escapeHtml(algText)} (${mvCount}m)`)}
      </text>
    </svg>
  `;
}

/**
 * Render bottom-face comparison SVGs for 1st Face Study view.
 */
function renderBottomOutcomeSvg(kind) {
  const S = 30;
  const P = 14;
  const barTop = kind === 'bar' ? '#22c55e' : kind === 'solved' ? '#22c55e' : '#f59e0b';
  const colors = kind === 'solved'
    ? ['#16a34a', '#16a34a', '#2563eb', '#2563eb', '#ef4444', '#ef4444', '#f97316', '#f97316']
    : kind === 'bar'
      ? ['#16a34a', '#16a34a', '#2563eb', '#ef4444', '#f97316', '#f97316', '#ef4444', '#2563eb']
      : ['#16a34a', '#2563eb', '#ef4444', '#16a34a', '#f97316', '#2563eb', '#ef4444', '#f97316'];

  // 2x2 white center with top/bottom/left/right side perimeter bars
  return `
    <svg viewBox="0 0 88 88" class="ff-outcome-svg" aria-hidden="true">
      <rect x="${P}" y="${P}" width="${S}" height="${S}" fill="#ffffff" stroke="#1e293b" stroke-width="1.3" rx="2"/>
      <rect x="${P + S}" y="${P}" width="${S}" height="${S}" fill="#ffffff" stroke="#1e293b" stroke-width="1.3" rx="2"/>
      <rect x="${P}" y="${P + S}" width="${S}" height="${S}" fill="#ffffff" stroke="#1e293b" stroke-width="1.3" rx="2"/>
      <rect x="${P + S}" y="${P + S}" width="${S}" height="${S}" fill="#ffffff" stroke="#1e293b" stroke-width="1.3" rx="2"/>

      <!-- Back edge bar (top in diagram) -->
      <rect x="${P}" y="4" width="${S}" height="7" fill="${colors[0]}" stroke="#1e293b" stroke-width="1" rx="1"/>
      <rect x="${P + S}" y="4" width="${S}" height="7" fill="${colors[1]}" stroke="#1e293b" stroke-width="1" rx="1"/>
      <!-- Front edge -->
      <rect x="${P}" y="${P + 2 * S + 3}" width="${S}" height="7" fill="${colors[2]}" stroke="#1e293b" stroke-width="1" rx="1"/>
      <rect x="${P + S}" y="${P + 2 * S + 3}" width="${S}" height="7" fill="${colors[3]}" stroke="#1e293b" stroke-width="1" rx="1"/>
      <!-- Left edge -->
      <rect x="4" y="${P}" width="7" height="${S}" fill="${colors[4]}" stroke="#1e293b" stroke-width="1" rx="1"/>
      <rect x="4" y="${P + S}" width="7" height="${S}" fill="${colors[5]}" stroke="#1e293b" stroke-width="1" rx="1"/>
      <!-- Right edge -->
      <rect x="${P + 2 * S + 3}" y="${P}" width="7" height="${S}" fill="${colors[6]}" stroke="#1e293b" stroke-width="1" rx="1"/>
      <rect x="${P + 2 * S + 3}" y="${P + S}" width="7" height="${S}" fill="${colors[7]}" stroke="#1e293b" stroke-width="1" rx="1"/>
      ${kind === 'diag'
        ? `<line x1="22" y1="22" x2="66" y2="66" stroke="${barTop}" stroke-width="2.5" stroke-dasharray="4 3"/>
           <line x1="66" y1="22" x2="22" y2="66" stroke="${barTop}" stroke-width="2.5" stroke-dasharray="4 3"/>`
        : ''}
    </svg>
  `;
}

// ============================================================================
// 1. 1st Face (Ortega / EG) Dedicated Study View
// ============================================================================
export function renderFirstFaceStudyHtml() {
  return `
    <div class="flb-wrap">
      <div class="guide-card-stack">
        <section class="guide-card guide-card-full flb-hero-card">
          <h3 class="guide-card-title">&#x1F9E9; 1st Face vs. 1st Layer &mdash; Why They Are Separate</h3>
          <p class="flb-hero-lead">
            A <strong>1st Face</strong> only matches the 4 stickers of your bottom color (avg <strong>3.1 moves</strong>, 99.8% &le; 4 moves), ignoring whether side colors line up. That tiny shortcut unlocks <strong>Ortega PBL</strong> and <strong>EG-1 / EG-2</strong>! A <strong>1st Layer</strong> matches both bottom and side colors (for <strong>LBL</strong> &amp; <strong>CLL</strong>).
          </p>

          <div class="ff-outcomes-grid">
            <div class="ff-outcome-card">
              ${renderBottomOutcomeSvg('solved')}
              <div class="ff-outcome-body">
                <strong>Solved Layer (All 4 Match)</strong>
                <span class="badge badge-solved">Skip PBL / Use CLL</span>
                <p>Opposite colors sit across sides &amp; every adjacent pair matches. Go straight to <strong>LBL</strong> or <strong>1-Look CLL</strong>!</p>
              </div>
            </div>
            <div class="ff-outcome-card">
              ${renderBottomOutcomeSvg('bar')}
              <div class="ff-outcome-body">
                <strong>Adjacent Swap (1 Back Bar)</strong>
                <span class="badge badge-case">Ortega PBL / EG-1</span>
                <p>One pair of matching side colors forms a <strong>Bar</strong> (hold it in Back <code>DBL+DBR</code>). Leads into <strong>Adj PBL</strong> or <strong>EG-1</strong>.</p>
              </div>
            </div>
            <div class="ff-outcome-card">
              ${renderBottomOutcomeSvg('diag')}
              <div class="ff-outcome-body">
                <strong>Diagonal Swap (No Bar)</strong>
                <span class="badge badge-warning">Ortega PBL / EG-2</span>
                <p>Zero side bars on bottom (every pair has opposite/mismatched colors). Triggers fast <code>R2 F2 R2</code> PBL or <strong>EG-2 / Anti-CLL</strong>.</p>
              </div>
            </div>
          </div>
        </section>

        <section class="guide-card guide-card-full">
          <h3 class="guide-card-title">&#x1F3AC; 6 Essential 1st Face Patterns</h3>
          <p class="hint" style="margin-bottom: 10px;">Play or step each pattern directly on its 3D cube, or click <strong>Sim</strong> for an expanded interactive view.</p>
          <div class="ff-examples-grid">
            ${FIRST_FACE_EXAMPLES.map((ex, idx) => `
              <div class="ff-example-card" data-ff-card-id="${escapeHtml(ex.id)}">
                <div class="ff-example-head">
                  <span class="ff-example-title">${escapeHtml(ex.label)}</span>
                  <div class="ff-example-badges">
                    <span class="badge layer-sol-moves-badge">${ex.moveCount}m</span>
                    <span class="badge ${ex.bottomPerm === 'Layer Solved' ? 'badge-solved' : 'badge-warning'}">${escapeHtml(ex.bottomPerm)}</span>
                  </div>
                </div>
                <div class="ff-example-3d-wrap" data-ff-card-id="${escapeHtml(ex.id)}" data-ff-idx="${idx}" data-ff-scramble="${escapeHtml(ex.scramble)}" data-ff-moves="${escapeHtml(ex.moves)}" aria-label="${escapeHtml(ex.label)} 3D preview"></div>
                <div class="ff-example-moves-row">
                  <span class="ff-alg-code">${escapeHtml(ex.moves)}</span>
                  <div class="ff-example-controls">
                    <button type="button" class="btn btn-xs ff-card-reset-3d-btn" data-ff-card-id="${escapeHtml(ex.id)}" title="Reset 3D viewing angle" aria-label="Reset 3D viewing angle for ${escapeHtml(ex.label)}">${ICON_RESET_ANGLE}</button>
                    <button type="button" class="btn btn-xs ff-card-start-btn" data-ff-card-id="${escapeHtml(ex.id)}" title="Reset to scramble start" aria-label="Reset to start for ${escapeHtml(ex.label)}" disabled>${ICON_SKIP_START}</button>
                    <button type="button" class="btn btn-xs btn-primary ff-card-play-btn" data-ff-card-id="${escapeHtml(ex.id)}" title="Play or pause solution" aria-label="Play solution for ${escapeHtml(ex.label)}">${ICON_PLAY}</button>
                    <button type="button" class="btn btn-xs ff-card-next-btn" data-ff-card-id="${escapeHtml(ex.id)}" title="Step forward 1 move" aria-label="Step forward for ${escapeHtml(ex.label)}">${ICON_STEP_FORWARD}</button>
                    <button type="button" class="btn btn-xs ff-sim-btn" data-ff-idx="${idx}" data-tooltip="Simulate this pattern in an interactive 3D popup" aria-label="Simulate ${escapeHtml(ex.label)} in 3D popup">${ICON_POPUP_SIM}<span>Sim</span></button>
                  </div>
                </div>
                <p class="ff-example-note">${escapeHtml(ex.note)}</p>
              </div>
            `).join('')}
          </div>
        </section>

        <div class="guide-grid">
          <section class="guide-card">
            <h3 class="guide-card-title">&#x1F50D; Spotting 0&ndash;3 Move Faces in Inspection</h3>
            <ul class="guide-list">
              <li><strong>Scan for 2 or 3 matching color stickers first:</strong> With 6-color neutrality, nearly every scramble starts with a 2-piece bar on one face.</li>
              <li><strong>Never build a bad bar blindly:</strong> Watch whether placing the 4th corner keeps the existing bar (<code>Adj Bar → EG-1</code>) or creates a full solved layer (<code>CLL</code>).</li>
              <li><strong>Track your bottom state BEFORE OLL:</strong> Spot whether D is <code>Solved</code>, <code>Bar</code>, or <code>Diag</code> during the last move of 1st face so there is zero pause before PBL or EG!</li>
            </ul>
          </section>
          <section class="guide-card">
            <h3 class="guide-card-title">&#x1F308; Color Neutrality Benchmarks (Ortega &amp; EG)</h3>
            <ul class="guide-list">
              <li><strong>99.8% of scrambles</strong> have a 1st Face in <strong>&le; 4 moves</strong> (average <strong>3.1 moves</strong>) across 6 colors.</li>
              <li>Enable <strong>All 6 (CN)</strong> in Settings / Solve Widget, then drill <strong>Practice → 1st Face</strong> under 15s WCA inspection!</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  `;
}

const ffCards3d = {
  cards: new Map(),
  gen: 0
};

function teardownFirstFace3d() {
  ffCards3d.gen++;
  for (const entry of ffCards3d.cards.values()) {
    entry.loadGen++;
    entry.pendingSeek = false;
    if (entry.displayEl) {
      try {
        entry.displayEl.player?.pause?.();
        entry.displayEl.remove?.();
      } catch {}
      entry.displayEl = null;
    }
    entry.indexer = null;
  }
  ffCards3d.cards.clear();
}

function updateFirstFaceCardUi(entry, playing) {
  entry.playing = Boolean(playing);
  const cardEl = entry.cardEl;
  if (!cardEl) return;
  const startBtn = cardEl.querySelector('.ff-card-start-btn');
  const playBtn = cardEl.querySelector('.ff-card-play-btn');
  const nextBtn = cardEl.querySelector('.ff-card-next-btn');
  const total = entry.combinedMoves.length;
  const algTotal = entry.algMoves.length;

  if (startBtn) startBtn.disabled = entry.moveCount <= entry.setupCount || algTotal === 0;
  if (nextBtn) nextBtn.disabled = entry.moveCount >= total || algTotal === 0;
  if (playBtn) {
    playBtn.disabled = algTotal === 0;
    playBtn.classList.toggle('is-playing', entry.playing);
    if (entry.playing) {
      playBtn.innerHTML = ICON_PAUSE;
      playBtn.setAttribute('aria-label', 'Pause solution');
    } else if (algTotal > 0 && entry.moveCount >= total) {
      playBtn.innerHTML = ICON_REPLAY;
      playBtn.setAttribute('aria-label', 'Replay solution');
    } else {
      playBtn.innerHTML = ICON_PLAY;
      playBtn.setAttribute('aria-label', 'Play solution');
    }
  }
}

async function seekFirstFaceEntry(entry, targetCount) {
  const el = entry.displayEl;
  if (!el?.player) return;
  const lGen = entry.loadGen;
  entry.pendingSeek = true;
  try {
    el.player.pause();
    if (!entry.indexer) {
      entry.indexer = await el.player.experimentalModel.indexer.get();
    }
    if (lGen !== entry.loadGen || entry.gen !== ffCards3d.gen || entry.displayEl !== el) return;
    entry.moveCount = seekPlayerWithIndexer(el, entry.indexer, entry.setupCount, entry.combinedMoves.length, targetCount);
    updateFirstFaceCardUi(entry, false);
  } catch {} finally {
    if (lGen === entry.loadGen) entry.pendingSeek = false;
  }
}

async function mountFirstFaceCards3d(container, { getSimSpeed = () => 1, getShowReflection = () => true } = {}) {
  if (!container || typeof window === 'undefined') return;
  const wraps = container.querySelectorAll('.ff-example-3d-wrap');
  if (!wraps.length) return;

  teardownFirstFace3d();
  const curGen = ffCards3d.gen;
  const SD = await getFlbScrambleDisplay();
  if (!SD || curGen !== ffCards3d.gen) return;

  const spd = Number(getSimSpeed ? getSimSpeed() : 1) || 1;
  const showRefl = getShowReflection ? getShowReflection() : true;

  for (const wrapEl of wraps) {
    if (!wrapEl.isConnected || curGen !== ffCards3d.gen) continue;
    const id = wrapEl.dataset.ffCardId;
    const rawScramble = wrapEl.dataset.ffScramble || '';
    const rawMoves = wrapEl.dataset.ffMoves || '';
    if (!id) continue;

    const parsedSetup = parseScrambleInput(rawScramble);
    const setupMoves = parsedSetup.ok ? parsedSetup.moves : cleanAlg(rawScramble).split(/\s+/).filter(Boolean);
    const parsedAlg = parseScrambleInput(rawMoves);
    const algMoves = parsedAlg.ok ? parsedAlg.moves : cleanAlg(rawMoves).split(/\s+/).filter(Boolean);
    const combinedMoves = [...setupMoves, ...algMoves];

    const entry = {
      id,
      wrapEl,
      cardEl: wrapEl.closest('.ff-example-card'),
      displayEl: null,
      indexer: null,
      setupCount: setupMoves.length,
      algMoves,
      combinedMoves,
      moveCount: setupMoves.length,
      pendingSeek: false,
      playing: false,
      loadGen: 0,
      gen: curGen
    };
    ffCards3d.cards.set(id, entry);

    try {
      const el = new SD();
      el.event = '222';
      el.visualization = '3D';
      el.scramble = combinedMoves.join(' ');
      if (el.player) {
        el.player.hintFacelets = showRefl ? 'floating' : 'none';
        el.player.tempoScale = spd;
      }
      wrapEl.innerHTML = '';
      wrapEl.appendChild(el);
      if (el.player) {
        el.player.hintFacelets = showRefl ? 'floating' : 'none';
        el.player.tempoScale = spd;
      }
      wrapEl.dataset.ffMounted = 'true';
      entry.displayEl = el;
      void applyColorsTo3DCube(el);

      if (el.player?.experimentalModel) {
        el.player.experimentalModel.indexer.addFreshListener((idx) => {
          if (entry.displayEl === el) entry.indexer = idx;
        });
        el.player.experimentalModel.detailedTimelineInfo.addFreshListener((info) => {
          if (entry.displayEl !== el || entry.pendingSeek || !entry.indexer || entry.gen !== ffCards3d.gen) return;
          try {
            if (info.atStart || info.timestamp <= 0) {
              if (entry.setupCount > 0) void seekFirstFaceEntry(entry, entry.setupCount);
              else {
                entry.moveCount = 0;
                updateFirstFaceCardUi(entry, entry.playing);
              }
              return;
            }
            if (info.atEnd) {
              entry.moveCount = entry.combinedMoves.length;
              updateFirstFaceCardUi(entry, entry.playing);
              return;
            }
            const mIdx = entry.indexer.timestampToIndex(info.timestamp);
            const nextCount = mIdx + 1;
            if (nextCount < entry.setupCount) {
              void seekFirstFaceEntry(entry, entry.setupCount);
              return;
            }
            entry.moveCount = nextCount;
            updateFirstFaceCardUi(entry, entry.playing);
          } catch {}
        });
        el.player.experimentalModel.coarseTimelineInfo.addFreshListener((info) => {
          if (entry.displayEl !== el || entry.gen !== ffCards3d.gen) return;
          updateFirstFaceCardUi(entry, Boolean(info.playing));
        });

        void el.player.experimentalModel.indexer.get().then((idx) => {
          if (entry.displayEl === el && entry.gen === ffCards3d.gen) {
            entry.indexer = idx;
            entry.moveCount = seekPlayerWithIndexer(el, idx, entry.setupCount, entry.combinedMoves.length, entry.setupCount);
            updateFirstFaceCardUi(entry, false);
          }
        }).catch(() => {});
      }
    } catch {}
  }
}

export function bindFirstFaceStudyEvents(container, { onQuickSimSolutions, getSimSpeed, getShowReflection } = {}) {
  void mountFirstFaceCards3d(container, { getSimSpeed, getShowReflection });

  container.querySelectorAll('.ff-card-reset-3d-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const entry = ffCards3d.cards.get(btn.dataset.ffCardId);
      if (entry?.displayEl) void resetDisplayCamera(entry.displayEl);
    });
  });

  container.querySelectorAll('.ff-card-start-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const entry = ffCards3d.cards.get(btn.dataset.ffCardId);
      if (entry) void seekFirstFaceEntry(entry, entry.setupCount);
    });
  });

  container.querySelectorAll('.ff-card-play-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const entry = ffCards3d.cards.get(btn.dataset.ffCardId);
      if (!entry?.displayEl?.player?.controller || entry.algMoves.length === 0) return;
      for (const [id, other] of ffCards3d.cards.entries()) {
        if (id !== entry.id && other.playing && other.displayEl?.player) {
          try { other.displayEl.player.pause(); } catch {}
        }
      }
      if (entry.moveCount >= entry.combinedMoves.length || entry.moveCount < entry.setupCount) {
        void seekFirstFaceEntry(entry, entry.setupCount).then(() => {
          setTimeout(() => { try { entry.displayEl?.player?.play?.(); } catch {} }, 40);
        });
        return;
      }
      try { entry.displayEl.player.controller.togglePlay(); } catch {}
    });
  });

  container.querySelectorAll('.ff-card-next-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const entry = ffCards3d.cards.get(btn.dataset.ffCardId);
      if (!entry?.displayEl?.player?.controller || entry.moveCount >= entry.combinedMoves.length) return;
      try {
        entry.displayEl.player.pause();
        entry.displayEl.player.controller.animationController.play({ direction: 1, untilBoundary: 'move' });
      } catch {}
    });
  });

  container.querySelectorAll('.ff-sim-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.ffIdx) || 0;
      onQuickSimSolutions?.({
        puzzle: '222',
        scramble: FIRST_FACE_EXAMPLES[idx]?.scramble || '',
        solutions: FIRST_FACE_EXAMPLES.map(ex => ({
          label: ex.label,
          shortLabel: `${ex.moveCount}m ${ex.bottomPerm === 'Layer Solved' ? 'Solved' : ex.bottomPerm}`,
          face: ex.face,
          moves: ex.moves,
          moveCount: ex.moveCount,
          inspection: ex.inspection,
          bottomPerm: ex.bottomPerm,
          caseId: ex.caseId,
          scramble: ex.scramble,
          note: ex.note
        })),
        activeIndex: idx,
        title: '2x2 1st Face Examples (Ortega / EG)'
      });
    });
  });
}

// ============================================================================
// 2. 1st Layer (Cases Grid & Quiz, 3D + 2D Explorer, Recognition & 2-Look Guide)
// ============================================================================
export function createFirstLayerExplorerState() {
  return {
    subTab: 'quiz', // 'quiz' | 'explorer' | 'guide'
    explorerGroup: 'two-bar', // 'one-bottom' | 'two-bar' | 'two-diag' | 'three-bottom'
    activeShape: 'right-edge',
    activeCaseId: 'flb-01',
    explorerAlgMode: 'primary', // 'primary' | 'trigger'
    quizGroup: 'two-bar', // 'one-bottom' | 'two-bar' | 'two-diag' | 'three-bottom'
    quizBucket: 'all',
    quizMoves: 'all',
    quizLayout: 'grid', // 'grid' | 'list'
    quizHideAlgs: false,
    quizShowLegend: null, // null = auto (desktop only), true/false = explicit toggle
    revealedQuizIds: new Set()
  };
}

const EXPLORER_SHAPES_BY_GROUP = {
  'one-bottom': [
    {
      bucketLabel: 'Partner in Top (3)',
      shapes: [{ id: 'top-u', label: 'Top Layer (UFL)' }]
    },
    {
      bucketLabel: 'Partner on Bottom Side (6)',
      shapes: [
        { id: 'dfl-twisted', label: 'Twisted in DFL (2)' },
        { id: 'in-dfr', label: 'Side of DFR (2)' },
        { id: 'in-dbr', label: 'Side of DBR (2)' }
      ]
    }
  ],
  'two-bar': [
    {
      bucketLabel: 'Both on Top (27)',
      shapes: [
        { id: 'right-edge', label: 'Right Edge (UBR)', count: 9 },
        { id: 'diagonal', label: 'Diagonal (UBL)', count: 9 },
        { id: 'front-edge', label: 'Front Edge (UFL)', count: 9 }
      ]
    },
    {
      bucketLabel: '1 Top + 1 Bottom (30)',
      shapes: [
        { id: 'bp-twisted', label: 'BP Twisted (6)', count: 6 },
        { id: 'fp-twisted', label: 'FP Twisted (6)', count: 6 },
        { id: 'fp-in-back', label: 'FP in Back (9)', count: 9 },
        { id: 'bp-in-front', label: 'BP in Front (9)', count: 9 }
      ]
    },
    {
      bucketLabel: 'Both on Bottom (13)',
      shapes: [
        { id: 'in-place-twist', label: 'In-Place Twist (4)', count: 4 },
        { id: 'bottom-swap', label: 'Bottom Swap (9)', count: 9 }
      ]
    }
  ],
  'two-diag': [
    {
      bucketLabel: 'Both on Top (15)',
      shapes: [
        { id: 'adj-top', label: 'Adjacent Top' },
        { id: 'diag-top', label: 'Diagonal Top' }
      ]
    },
    {
      bucketLabel: '1 Top + 1 Bottom (15)',
      shapes: [
        { id: 'one-twisted', label: '1 Top + 1 Twisted' },
        { id: 'one-wrong', label: '1 Top + 1 Wrong Slot' }
      ]
    },
    {
      bucketLabel: 'Both on Bottom (9)',
      shapes: [
        { id: 'in-place-twist', label: 'In-Place Twist' },
        { id: 'bottom-swap', label: 'Bottom Swap' }
      ]
    }
  ],
  'three-bottom': [
    {
      bucketLabel: '3 Solved Bottom · Only DFR Unsolved (5)',
      shapes: [
        { id: 'bp-solved', label: 'DFR in Top UFR (3)' },
        { id: 'in-place-twist', label: 'DFR Twisted (2)' }
      ]
    }
  ]
};

function getExplorerPool(state) {
  const allInGroup = getCasesForGroup(state.explorerGroup || 'two-bar');
  const byShape = allInGroup.filter(c => c.subShape === state.activeShape);
  return byShape.length ? byShape : allInGroup;
}

function getMovePillClass(mv) {
  if (mv <= 2) return 'm1';
  if (mv <= 4) return 'm3';
  if (mv <= 6) return 'm5';
  return 'm7';
}

function getMoveBadgeClass(mv) {
  if (mv <= 3) return 'badge-solved';
  if (mv >= 7) return 'badge-warning';
  return 'badge-case';
}

function getVariantButtonLabel(c) {
  if (c.group === 'one-bottom') {
    return `<span class="flb-tag-a">A:${escapeHtml(c.partnerWhite)}</span><span class="flb-tag-b">${escapeHtml(c.partnerSlot)}</span>`;
  }
  if (c.group === 'two-diag') {
    return `<span class="flb-tag-a">FL:${escapeHtml(c.flSlot)}(${escapeHtml(c.flWhite)})</span><span class="flb-tag-b">BR:${escapeHtml(c.brSlot)}(${escapeHtml(c.brWhite)})</span>`;
  }
  return `<span class="flb-tag-a">A:${escapeHtml(c.fpWhite)}</span><span class="flb-tag-b">B:${escapeHtml(c.bpWhite)}</span>`;
}

function getExplorerTitleHtml(c) {
  if (c.group === 'one-bottom') {
    return `Anchor <code>DBL</code> &middot; Bar Partner <code>DFL</code> at <code>${escapeHtml(c.partnerSlot)}</code> (White: <strong>${escapeHtml(whiteDirLabel(c.partnerWhite))}</strong>)`;
  }
  if (c.group === 'two-diag') {
    return `Diagonal Anchor <code>DBL+DFR</code> &middot; <code>DFL</code> at <code>${escapeHtml(c.flSlot)}</code> (<strong>${escapeHtml(c.flWhite)}</strong>) &middot; <code>DBR</code> at <code>${escapeHtml(c.brSlot)}</code> (<strong>${escapeHtml(c.brWhite)}</strong>)`;
  }
  return `FP (A) at <code>${escapeHtml(c.fpSlot)}</code> (White: <strong>${escapeHtml(whiteDirLabel(c.fpWhite))}</strong>) &middot; BP (B) at <code>${escapeHtml(c.bpSlot)}</code> (White: <strong>${escapeHtml(whiteDirLabel(c.bpWhite))}</strong>)`;
}

export function renderFirstLayerStudyHtml(state, currentSpeed = 1) {
  const activeTab = state.subTab || 'quiz';
  return `
    <div class="flb-wrap">
      <div class="flb-subtabs" role="tablist" aria-label="1st Layer Study Tools">
        <button type="button" class="flb-subtab-btn ${activeTab === 'quiz' ? 'active' : ''}" data-flb-tab="quiz" role="tab" aria-selected="${activeTab === 'quiz'}" data-tooltip="Browse interactive 3D cards or compact list grouped by bottom pieces, plus Hide-Alg quiz mode">&#x1F4CB; Cases Grid &amp; Quiz (${TOTAL_LAYER_CASES})</button>
        <button type="button" class="flb-subtab-btn ${activeTab === 'explorer' ? 'active' : ''}" data-flb-tab="explorer" role="tab" aria-selected="${activeTab === 'explorer'}" data-tooltip="Inspect 3D model alongside Top/Bottom and R-Face 2D recognition diagrams">&#x1F9ED; Case Explorer (3D + 2D)</button>
        <button type="button" class="flb-subtab-btn ${activeTab === 'guide' ? 'active' : ''}" data-flb-tab="guide" role="tab" aria-selected="${activeTab === 'guide'}" data-tooltip="Rim Bar recognition cues, group breakdown chart, and 2-Look fallback triggers">&#x1F4D6; Recognition &amp; 2-Look Guide</button>
      </div>

      <div class="flb-tab-panel">
        ${activeTab === 'quiz' ? renderQuizTab(state) : ''}
        ${activeTab === 'explorer' ? renderExplorerTab(state, currentSpeed) : ''}
        ${activeTab === 'guide' ? renderGuideTab() : ''}
      </div>
    </div>
  `;
}

function renderExplorerTab(state, currentSpeed = 1) {
  const explorerGroup = normalizeGroupId(state.explorerGroup || 'two-bar');
  state.explorerGroup = explorerGroup;
  const groupCases = getCasesForGroup(explorerGroup);
  const pool = getExplorerPool(state);
  const activeCase = pool.find(c => c.id === state.activeCaseId) || pool[0];
  state.activeCaseId = activeCase.id;
  state.activeShape = activeCase.subShape;
  const activeIdx = pool.indexOf(activeCase);
  const shapeGroups = EXPLORER_SHAPES_BY_GROUP[explorerGroup] || EXPLORER_SHAPES_BY_GROUP['two-bar'];
  const hasTrig = Boolean(activeCase.fullTriggerAlg);
  const activeMode = hasTrig && state.explorerAlgMode === 'trigger' ? 'trigger' : 'primary';
  state.explorerAlgMode = activeMode;
  const primaryAlg = getCasePrimaryMoves(activeCase);
  const mvCount = getCaseMoveCount(activeCase);
  const speedNum = Number(currentSpeed) || 1;

  return `
    <div class="flb-explorer-layout">
      <!-- Left / Top Picker Panel -->
      <div class="flb-picker-panel">
        <div class="flb-explorer-group-bar" role="group" aria-label="Bottom-piece group">
          ${EXPLORER_GROUP_TABS.map(t => `
            <button type="button" class="flb-exp-group-btn ${explorerGroup === t.id ? 'active' : ''}" data-flb-exp-group="${t.id}" aria-pressed="${explorerGroup === t.id}">
              ${escapeHtml(t.label)}
            </button>
          `).join('')}
        </div>

        <div class="flb-picker-intro">
          ${escapeHtml(getGroupBanner(explorerGroup))}
        </div>

        <div class="flb-shape-groups">
          ${shapeGroups.map(grp => `
            <div class="flb-shape-group">
              <div class="flb-shape-group-label">${escapeHtml(grp.bucketLabel)}</div>
              <div class="flb-shape-pills">
                ${grp.shapes.map(sh => `
                  <button type="button" class="flb-shape-pill ${state.activeShape === sh.id ? 'active' : ''}" data-flb-shape="${sh.id}">
                    ${escapeHtml(sh.label)}
                  </button>
                `).join('')}
              </div>
            </div>
          `).join('')}
        </div>

        <div class="flb-variant-picker">
          <div class="flb-variant-head">
            <span>Select Case in <strong>${escapeHtml(activeCase.subLabel)}</strong> (${pool.length} of ${groupCases.length}):</span>
          </div>
          <div class="flb-variant-grid">
            ${pool.map(c => {
              const mv = getCaseMoveCount(c);
              return `
                <button type="button" class="flb-variant-btn ${c.id === activeCase.id ? 'active' : ''} ${c.isRimBar ? 'is-rim' : ''}" data-flb-case="${c.id}">
                  <span class="flb-var-stickers">${getVariantButtonLabel(c)}</span>
                  <span class="flb-var-moves ${getMovePillClass(mv)}">${mv}m</span>
                </button>
              `;
            }).join('')}
          </div>
        </div>
      </div>

      <!-- Right Live 3D + 2D Diagrams + Solution Panel -->
      <div class="flb-detail-panel">
        <div class="flb-detail-head">
          <div>
            <div class="flb-detail-kicker">${escapeHtml(activeCase.bucketLabel)} &bull; Case ${escapeHtml(getCaseCodeBadge(activeCase))} (${activeCase.index} of ${groupCases.length})</div>
            <h3 class="flb-detail-title">${getExplorerTitleHtml(activeCase)}</h3>
          </div>
          <div class="flb-detail-nav">
            <button type="button" class="btn btn-xs" id="flbPrevVariantBtn" ${activeIdx <= 0 ? 'disabled' : ''}>&larr; Prev</button>
            <span class="flb-nav-pos">${activeIdx + 1} / ${pool.length}</span>
            <button type="button" class="btn btn-xs" id="flbNextVariantBtn" ${activeIdx >= pool.length - 1 ? 'disabled' : ''}>Next &rarr;</button>
          </div>
        </div>

        <div class="flb-explorer-visuals-grid">
          <div class="flb-explorer-3d-card">
            <div class="flb-explorer-3d-head">
              <span class="flb-3d-card-label">Live 3D Model</span>
              <button type="button" class="btn btn-xs" id="flbReset3dBtn" data-tooltip="Reset 3D camera orientation" aria-label="Reset 3D camera orientation">${ICON_RESET_ANGLE}<span>Reset 3D</span></button>
            </div>
            <div class="flb-explorer-3d-wrap" id="flbDetail3dWrap">
              <span class="study-visual-loading">Loading 3D...</span>
            </div>
            ${hasTrig ? `
              <div class="flb-alg-mode-switcher" role="group" aria-label="Choose algorithm to preview">
                <button type="button" class="flb-alg-mode-btn ${activeMode === 'primary' ? 'active' : ''}" data-flb-alg-mode="primary">&lt;R, U&gt; (${mvCount}m)</button>
                <button type="button" class="flb-alg-mode-btn ${activeMode === 'trigger' ? 'active' : ''}" data-flb-alg-mode="trigger">Trigger (${escapeHtml(activeCase.triggerDisplay)})</button>
              </div>
            ` : ''}
            <div class="study-mini-sim-bar" role="group" aria-label="Inline 3D 1st layer playback">
              <button type="button" class="btn btn-xs btn-icon-only study-mini-btn" id="flbMiniStartBtn" data-tooltip="Jump to case start" aria-label="Jump to case start">${ICON_SKIP_START}</button>
              <button type="button" class="btn btn-xs btn-icon-only study-mini-btn" id="flbMiniPrevBtn" data-tooltip="Step back 1 move" aria-label="Step back 1 move">${ICON_STEP_BACK}</button>
              <button type="button" class="btn btn-xs btn-icon-only btn-primary study-mini-play-btn" id="flbMiniPlayBtn" data-play-state="play" data-tooltip="Play / Pause solution" aria-label="Play solution">${ICON_PLAY}</button>
              <button type="button" class="btn btn-xs btn-icon-only study-mini-btn" id="flbMiniNextBtn" data-tooltip="Step forward 1 move" aria-label="Step forward 1 move">${ICON_STEP_FORWARD}</button>
              <button type="button" class="btn btn-xs btn-icon-only study-mini-btn" id="flbMiniEndBtn" data-tooltip="Jump to solved end" aria-label="Jump to solved end">${ICON_SKIP_END}</button>
              <button type="button" class="btn btn-xs study-mini-speed-btn" id="flbMiniSpeedBtn" data-tooltip="Cycle 3D playback pace (site-wide)" aria-label="Playback pace ${speedNum}x">${speedNum}x</button>
            </div>
            <div class="study-mini-step-status" id="flbMiniStepStatus" aria-live="polite">Ready</div>
          </div>

          <div class="flb-dual-svg-stack">
            <div class="flb-svg-card">
              ${renderTopBottomMapSvg(activeCase)}
            </div>
            <div class="flb-svg-card">
              ${renderRFaceSideSvg(activeCase)}
            </div>
          </div>
        </div>

        <div class="flb-sol-card">
          <div class="flb-sol-main">
            <div class="flb-sol-row ${activeMode === 'primary' ? 'is-selected' : ''}">
              <span class="flb-sol-label">${activeCase.ruMoves != null ? 'Optimal <R, U>:' : 'Optimal <R, U, F>:'}</span>
              <span class="flb-sol-alg">${escapeHtml(primaryAlg)}</span>
              <span class="badge ${getMoveBadgeClass(mvCount)}">${mvCount} move${mvCount === 1 ? '' : 's'}${activeCase.ruStartAuf || activeCase.startAuf ? ` (+${escapeHtml(activeCase.ruStartAuf || activeCase.startAuf)} AUF)` : ''}</span>
              ${hasTrig ? `<button type="button" class="btn btn-xs ${activeMode === 'primary' ? 'btn-primary' : ''}" data-flb-alg-mode="primary" aria-pressed="${activeMode === 'primary'}">${activeMode === 'primary' ? 'Previewing' : 'Sim &lt;R, U&gt;'}</button>` : ''}
              ${activeCase.isRimBar ? `<span class="badge badge-solved">&#x2B50; ${escapeHtml(activeCase.rimBarType.toUpperCase())} RIM BAR</span>` : ''}
            </div>
            ${activeCase.triggerDisplay ? `
              <div class="flb-sol-row flb-sol-trig ${activeMode === 'trigger' ? 'is-selected' : ''}">
                <span class="flb-sol-label">Trigger Alt:</span>
                <span class="flb-trig-mnemonic">${escapeHtml(activeCase.triggerDisplay)}</span>
                <span class="flb-trig-expanded">(${escapeHtml(activeCase.fullTriggerAlg)})</span>
                <button type="button" class="btn btn-xs ${activeMode === 'trigger' ? 'btn-primary' : ''}" data-flb-alg-mode="trigger" aria-pressed="${activeMode === 'trigger'}">${activeMode === 'trigger' ? 'Previewing Alt' : 'Sim Alt'}</button>
                <span class="flb-trig-legend">S = R' F R F' &middot; H = F R' F' R</span>
              </div>
            ` : ''}
            <p class="flb-sol-cue">${escapeHtml(activeCase.cue)}</p>
          </div>
          <div class="flb-sol-actions">
            <button type="button" class="btn btn-primary btn-small" id="flbSimActiveBtn" data-case-id="${activeCase.id}" data-tooltip="Open interactive 3D popup simulator for all ${pool.length} matching cases">
              ${ICON_POPUP_SIM}<span>Popup Sim (${pool.length})</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

function renderGuideTab() {
  const { total, averageRuMoves, moveCounts } = FIRST_LAYER_BAR_STATS;
  const maxBar = Math.max(...Object.values(moveCounts));
  const distRows = [
    { moves: '1 move (Rim Bars)', count: moveCounts['1'], cls: 'm1', desc: "Front → R', Top → R2, Back → R" },
    { moves: '3 moves (Joins)', count: moveCounts['3'], cls: 'm3', desc: '1 R turn aligns into a Rim Bar after U-AUF' },
    { moves: '5 moves (Setup + Join)', count: moveCounts['5'], cls: 'm5', desc: 'Setup corner or break swap, then 3-move Join' },
    { moves: '7 moves (Mem / Triggers)', count: moveCounts['7'], cls: 'm7', desc: 'Often faster with Sledge/Hedge or Park-Left 2-Look' }
  ];

  return `
    <div class="guide-card-stack">
      <section class="guide-card guide-card-full">
        <h3 class="guide-card-title">&#x2B50; Core Visual Cue: The 3 One-Move Rim Bars</h3>
        <p>Hold the solved 2-corner bar on the Left (<code>DFL + DBL</code>). Looking straight at the <strong>R face</strong> (Front on left, Back on right), whenever <code>FP (A)</code> and <code>BP (B)</code> share the same outer rim edge in matching order, <strong>a single R move solves both!</strong></p>
        <div class="flb-rimbar-grid">
          ${RIM_BAR_CASES.map(c => `
            <div class="flb-rimbar-card">
              <div class="flb-rimbar-head">
                <strong>${escapeHtml((c.rimBarType || 'rim').toUpperCase())} RIM BAR → <code>${escapeHtml(c.ruAlg)}</code></strong>
                <button type="button" class="btn btn-xs flb-guide-sim-btn" data-guide-case="${c.id}" data-tooltip="Preview in 3D popup" aria-label="Simulate ${escapeHtml(c.rimBarType || 'rim')} rim bar in 3D popup">${ICON_POPUP_SIM}<span>Sim</span></button>
              </div>
              ${renderRFaceSideSvg(c)}
              <div class="flb-rimbar-sub">A@${c.fpSlot}/${c.fpWhite} + B@${c.bpSlot}/${c.bpWhite} &rarr; <code>${escapeHtml(c.fullRuAlg)}</code></div>
            </div>
          `).join('')}
        </div>
      </section>

      <div class="guide-grid">
        <section class="guide-card">
          <h3 class="guide-card-title">&#x1F4CA; 1st Layer Case Breakdown (${TOTAL_LAYER_CASES} Cases) &amp; Bar &lt;R, U&gt; Distribution</h3>
          <div class="flb-guide-group-pills">
            <span class="flb-guide-group-pill">1 in Bottom: ${FIRST_LAYER_ONE_BOTTOM_CASES.length}</span>
            <span class="flb-guide-group-pill">2 Bottom Bar: ${FIRST_LAYER_BAR_PURE_CASES.length}</span>
            <span class="flb-guide-group-pill">2 Bottom Diagonal: ${FIRST_LAYER_DIAG_CASES.length}</span>
            <span class="flb-guide-group-pill">3 in Bottom: ${FIRST_LAYER_THREE_BOTTOM_CASES.length}</span>
            <span class="flb-guide-group-pill is-cll">4 Solved &rarr; CLL</span>
          </div>
          <p class="hint" style="margin-bottom: 10px;">For Bar-on-Left finishes (Avg ${averageRuMoves} moves across 75 Bar + 3-in-Bottom setups), every optimal &lt;R, U&gt; alternates R &amp; U turns:</p>
          <div class="flb-chart">
            ${distRows.map(r => {
              const pct = Math.round((r.count / maxBar) * 100);
              return `
                <div class="flb-chart-row">
                  <div class="flb-chart-label">
                    <strong>${escapeHtml(r.moves)}</strong>
                    <span>${r.count} / ${total}</span>
                  </div>
                  <div class="flb-chart-track">
                    <div class="flb-chart-fill ${r.cls}" style="width: ${pct}%"></div>
                  </div>
                  <div class="flb-chart-desc">${escapeHtml(r.desc)}</div>
                </div>
              `;
            }).join('')}
          </div>
        </section>

        <section class="guide-card">
          <h3 class="guide-card-title">&#x1F500; Level 1 Fallback: 2-Look Reduction (Option A &amp; B)</h3>
          <p><strong>${escapeHtml(FIRST_LAYER_TWO_LOOK.optionB.title)}</strong></p>
          <ul class="guide-list">
            ${FIRST_LAYER_TWO_LOOK.optionB.rules.map(r => `<li><strong>${escapeHtml(r.state)}:</strong> ${escapeHtml(r.rule)}</li>`).join('')}
          </ul>
          <p style="margin-top: 10px;"><strong>High-Yield Trigger Pairs to Recognize Together:</strong></p>
          <ul class="guide-list">
            <li><strong>Lone Twist at DFR (BP solved):</strong> White Front → <code>S S</code> (Double Sledge) · White Right → <code>H H</code> (Double Hedge).</li>
            <li><strong>Bottom Swap Sides Matter:</strong> Both whites down (Case #67 swap): only side colors distinguish swapped vs solved!</li>
            <li><strong>Sledge / Hedge Pairs:</strong> Try <code>S R2 H</code> vs <code>H R2 S</code> and contrast pairs <code>R U H</code> vs <code>R U S</code>.</li>
          </ul>
        </section>
      </div>

      <section class="guide-card guide-card-full">
        <h3 class="guide-card-title">&#x1F3AF; ${escapeHtml(FIRST_LAYER_TWO_LOOK.optionA.title)}</h3>
        <p>${escapeHtml(FIRST_LAYER_TWO_LOOK.optionA.desc)}</p>
        <div class="flb-2look-cols">
          <div>
            <h4 class="flb-2look-subhead">Step 1: Solve BP into DBR (8 Mini-Cases)</h4>
            <div class="flb-2look-list">
              ${FIRST_LAYER_TWO_LOOK.optionA.bpCases.map((b, i) => `
                <div class="flb-2look-row">
                  <span class="flb-2look-desc">${escapeHtml(b.label)}</span>
                  <span class="flb-2look-alg">${escapeHtml(b.alg)}</span>
                  <button type="button" class="btn btn-xs flb-2look-bp-sim" data-bp-idx="${i}" data-tooltip="Preview in 3D popup" aria-label="Simulate BP case ${i + 1} in 3D popup">${ICON_POPUP_SIM}<span>Sim</span></button>
                </div>
              `).join('')}
            </div>
          </div>
          <div>
            <h4 class="flb-2look-subhead">Step 2: Finish Last Corner FP into DFR (5 Triggers)</h4>
            <div class="flb-2look-list">
              ${FIRST_LAYER_TWO_LOOK.optionA.fpFinishes.map((f, i) => `
                <div class="flb-2look-row">
                  <div>
                    <div class="flb-2look-desc">${escapeHtml(f.label)}</div>
                    <div class="hint">${escapeHtml(f.note)}</div>
                  </div>
                  <span class="flb-2look-alg">${escapeHtml(f.alg)}</span>
                  <button type="button" class="btn btn-xs flb-2look-fp-sim" data-fp-idx="${i}" data-tooltip="Preview in 3D popup" aria-label="Simulate FP finish ${i + 1} in 3D popup">${ICON_POPUP_SIM}<span>Sim</span></button>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
      </section>
    </div>
  `;
}

function getGroupBuckets(groupId, baseList) {
  const norm = normalizeGroupId(groupId);
  if (norm === 'one-bottom') {
    return [
      { id: 'all', label: `All (${baseList.length})` },
      { id: 'in-top', label: `Partner in Top (${baseList.filter(c => c.bucket === 'in-top').length})` },
      { id: 'in-bottom', label: `Partner on Bottom Side (${baseList.filter(c => c.bucket === 'in-bottom').length})` }
    ];
  }
  if (norm === 'three-bottom') {
    return [
      { id: 'all', label: `All (${baseList.length})` },
      { id: 'mixed', label: `Last Corner Top (${baseList.filter(c => c.bucket === 'mixed').length})` },
      { id: 'both-bottom', label: `Last Corner Twisted (${baseList.filter(c => c.bucket === 'both-bottom').length})` }
    ];
  }
  return [
    { id: 'all', label: `All (${baseList.length})` },
    { id: 'both-top', label: `Both Top (${baseList.filter(c => c.bucket === 'both-top').length})` },
    { id: 'mixed', label: `1 Top + 1 Bottom (${baseList.filter(c => c.bucket === 'mixed').length})` },
    { id: 'both-bottom', label: `Both Bottom (${baseList.filter(c => c.bucket === 'both-bottom').length})` }
  ];
}

function getFilteredQuizCases(state) {
  const baseList = getCasesForGroup(state.quizGroup || 'two-bar');
  return baseList.filter(c => {
    if (state.quizBucket !== 'all' && c.bucket !== state.quizBucket) return false;
    if (state.quizMoves !== 'all' && String(getCaseMoveCount(c)) !== String(state.quizMoves)) return false;
    return true;
  });
}

function renderQuizTab(state) {
  const activeGroup = normalizeGroupId(state.quizGroup || 'two-bar');
  state.quizGroup = activeGroup;
  const baseList = getCasesForGroup(activeGroup);
  const filtered = getFilteredQuizCases(state);
  const buckets = getGroupBuckets(activeGroup, baseList);
  const moveValues = Array.from(new Set(baseList.map(getCaseMoveCount))).sort((a, b) => a - b);
  const layout = state.quizLayout === 'list' ? 'list' : 'grid';
  const legendMode = state.quizShowLegend; // null = auto (desktop), true = shown, false = hidden
  const legendVisibleClass = legendMode === true ? 'is-shown' : legendMode === false ? 'is-hidden' : 'is-auto';

  return `
    <div class="flb-quiz-wrap">
      <div class="flb-bottom-group-bar" role="group" aria-label="Group cases by pieces in bottom">
        <span class="study-filter-label">Bottom Pieces:</span>
        ${QUIZ_GROUP_TABS.map(tab => `
          <button type="button" class="flb-bottom-group-btn ${activeGroup === tab.id ? 'active' : ''}" data-quiz-group="${tab.id}" aria-pressed="${activeGroup === tab.id}">
            ${escapeHtml(tab.label)}
          </button>
        `).join('')}
      </div>

      <div class="flb-group-banner">
        <span>${escapeHtml(getGroupBanner(activeGroup))}</span>
        <span class="flb-cll-note">All 4 solved &rarr; CLL</span>
      </div>

      <div class="flb-quiz-toolbar">
        <div class="flb-filter-group">
          <span class="study-filter-label">Bucket:</span>
          <div class="ui-seg-group" role="radiogroup" aria-label="Filter by corner bucket (single-select)">
            ${buckets.map(b => `
              <button type="button" class="ui-seg-btn ${state.quizBucket === b.id ? 'active' : ''}" role="radio" aria-checked="${state.quizBucket === b.id}" data-quiz-bucket="${b.id}">${escapeHtml(b.label)}</button>
            `).join('')}
          </div>
        </div>

        <div class="flb-filter-group">
          <span class="study-filter-label">Moves:</span>
          <div class="ui-seg-group" role="radiogroup" aria-label="Filter by move count (single-select)">
            <button type="button" class="ui-seg-btn ${state.quizMoves === 'all' ? 'active' : ''}" role="radio" aria-checked="${state.quizMoves === 'all'}" data-quiz-moves="all">All</button>
            ${moveValues.map(m => {
              const cnt = baseList.filter(c => getCaseMoveCount(c) === m).length;
              const isActiveMove = String(state.quizMoves) === String(m);
              return `<button type="button" class="ui-seg-btn ${isActiveMove ? 'active' : ''}" role="radio" aria-checked="${isActiveMove}" data-quiz-moves="${m}">${m}m (${cnt})</button>`;
            }).join('')}
          </div>
        </div>

        <div class="flb-quiz-actions">
          <div class="flb-layout-toggle" role="group" aria-label="Layout mode">
            <button type="button" class="btn btn-xs ${layout === 'grid' ? 'btn-primary' : ''}" data-quiz-layout="grid" aria-pressed="${layout === 'grid'}">&#x229E; Grid</button>
            <button type="button" class="btn btn-xs ${layout === 'list' ? 'btn-primary' : ''}" data-quiz-layout="list" aria-pressed="${layout === 'list'}">&#x2630; List</button>
          </div>
          <button type="button" id="flbIconLegendBtn" class="btn btn-xs ${legendMode === true ? 'btn-primary' : ''}" aria-pressed="${legendMode !== false}" data-tooltip="Toggle control icon legend">
            ${ICON_LEGEND}<span>Legend</span>
          </button>
          <button type="button" id="flbQuizHideToggleBtn" class="btn btn-xs ${state.quizHideAlgs ? 'btn-primary' : ''}" aria-pressed="${state.quizHideAlgs}">
            &#x1F648; Quiz Mode (Hide Algs): ${state.quizHideAlgs ? 'ON' : 'OFF'}
          </button>
          <span class="flb-quiz-count">${filtered.length} cases</span>
        </div>
      </div>

      ${layout === 'grid' ? `
        <div class="flb-icon-legend-wrap ${legendVisibleClass}">
          ${renderIconLegendHtml({ includeStepBack: false, includeEnd: false })}
        </div>

        <div class="flb-case-grid">
          ${filtered.map((c, idx) => {
            const hiddenAlg = state.quizHideAlgs && !state.revealedQuizIds.has(c.id);
            const mv = getCaseMoveCount(c);
            const primaryAlg = getCasePrimaryMoves(c);
            const overlay = getCaseCornerOverlay(c);
            const canStep = mv > 0;
            return `
              <article class="flb-case-card ${c.isRimBar ? 'is-rim' : ''}" data-quiz-case-id="${c.id}">
                <div class="flb-card-head">
                  <span class="flb-quiz-num">${escapeHtml(getCaseCodeBadge(c))}</span>
                  <span class="badge ${getMoveBadgeClass(mv)}">${mv}m</span>
                  <span class="flb-card-shape">${escapeHtml(c.subShape)}</span>
                  <button type="button" class="btn btn-xs btn-icon-only flb-card-diag-btn flb-open-in-exp-btn" data-exp-case="${c.id}" data-exp-group="${c.group || 'two-bar'}" data-tooltip="Open 2D diagrams in Explorer" aria-label="Open 2D diagrams in Explorer">${ICON_DIAGRAM}</button>
                </div>
                <div class="flb-card-3d-wrap flb-card-3d-live" data-card-id="${c.id}" data-card-setup="${escapeHtml(c.setup)}" data-card-alg="${escapeHtml(primaryAlg)}">
                  ${renderFirstLayer3dSvg(c)}
                </div>
                <div class="flb-card-corners">
                  ${overlay.pieceA ? `<span class="flb-tag-a">${escapeHtml(overlay.pieceA.tagText)}</span>` : ''}
                  ${overlay.pieceB ? `<span class="flb-tag-b">${escapeHtml(overlay.pieceB.tagText)}</span>` : ''}
                </div>
                <div class="flb-card-alg-box">
                  ${hiddenAlg
                    ? `<button type="button" class="btn btn-xs flb-reveal-alg-btn" data-reveal-id="${c.id}">Tap to Reveal Solution</button>`
                    : c.triggerDisplay && c.fullTriggerAlg
                      ? `<button type="button" class="flb-card-alg-opt is-active" data-card-id="${c.id}" data-alg-mode="primary" aria-pressed="true" data-tooltip="Simulate optimal &lt;R, U&gt; solution"><span class="flb-sol-alg">${escapeHtml(primaryAlg)}</span></button>
                         <button type="button" class="flb-card-alg-opt is-alt" data-card-id="${c.id}" data-alg-mode="trigger" aria-pressed="false" data-tooltip="Simulate Alt (${escapeHtml(c.triggerDisplay)}): ${escapeHtml(c.fullTriggerAlg)}"><span class="flb-trig-mini">Alt: ${escapeHtml(c.triggerDisplay)}</span><span class="flb-trig-expanded-mini">${escapeHtml(c.fullTriggerAlg)}</span></button>`
                      : `<span class="flb-sol-alg">${escapeHtml(primaryAlg)}</span>
                         ${c.barAlg && c.finishAlg ? `<span class="flb-step-hint-mini">Bar: ${escapeHtml(c.barAlg)} &rarr; + ${escapeHtml(c.finishAlg)}</span>` : ''}`
                  }
                </div>
                <div class="flb-card-actions" role="group" aria-label="3D controls for ${escapeHtml(getCaseCodeBadge(c))}">
                  <button type="button" class="btn btn-xs btn-icon-only flb-card-icon-btn flb-card-reset-3d-btn" data-card-id="${c.id}" data-tooltip="Reset 3D orientation" aria-label="Reset 3D orientation">${ICON_RESET_ANGLE}</button>
                  <button type="button" class="btn btn-xs btn-icon-only flb-card-icon-btn flb-card-start-btn" data-card-id="${c.id}" data-tooltip="Reset to case start" aria-label="Reset to case start" disabled>${ICON_SKIP_START}</button>
                  <button type="button" class="btn btn-xs btn-icon-only btn-primary flb-card-icon-btn flb-card-play-btn" data-card-id="${c.id}" data-play-state="play" data-tooltip="Play / Pause solution" aria-label="Play solution" ${canStep ? '' : 'disabled'}>${ICON_PLAY}</button>
                  <button type="button" class="btn btn-xs btn-icon-only flb-card-icon-btn flb-card-next-btn" data-card-id="${c.id}" data-tooltip="Step forward 1 move" aria-label="Step forward 1 move" ${canStep ? '' : 'disabled'}>${ICON_STEP_FORWARD}</button>
                  <button type="button" class="btn btn-xs btn-icon-only flb-card-icon-btn flb-quiz-sim-btn" data-quiz-idx="${idx}" data-tooltip="Open popup simulator" aria-label="Open popup simulator">${ICON_POPUP_SIM}</button>
                </div>
              </article>
            `;
          }).join('')}
        </div>
      ` : `
        <div class="flb-quiz-table-wrap">
          <div class="flb-quiz-list">
            ${filtered.map((c, idx) => {
              const hiddenAlg = state.quizHideAlgs && !state.revealedQuizIds.has(c.id);
              const mv = getCaseMoveCount(c);
              const primaryAlg = getCasePrimaryMoves(c);
              const overlay = getCaseCornerOverlay(c);
              return `
                <div class="flb-quiz-row ${c.isRimBar ? 'is-rim' : ''}" data-quiz-case-id="${c.id}">
                  <div class="flb-quiz-thumb">
                    ${renderFirstLayer3dSvg(c, { compact: true })}
                  </div>
                  <div class="flb-quiz-meta">
                    <span class="flb-quiz-num">${escapeHtml(getCaseCodeBadge(c))}</span>
                    <span class="badge ${getMoveBadgeClass(mv)}">${mv}m</span>
                    <span class="flb-quiz-shape">${escapeHtml(c.subShape)}</span>
                  </div>
                  <div class="flb-quiz-corners">
                    ${overlay.pieceA ? `<span class="flb-tag-a">${escapeHtml(overlay.pieceA.tagText)}</span>` : ''}
                    ${overlay.pieceB ? `<span class="flb-tag-b">${escapeHtml(overlay.pieceB.tagText)}</span>` : ''}
                  </div>
                  <div class="flb-quiz-alg-col">
                    ${hiddenAlg
                      ? `<button type="button" class="btn btn-xs flb-reveal-alg-btn" data-reveal-id="${c.id}">Tap to Reveal Solution</button>`
                      : `<span class="flb-sol-alg">${escapeHtml(primaryAlg)}</span>
                         ${c.barAlg && c.finishAlg ? `<span class="flb-step-hint-mini">Bar: ${escapeHtml(c.barAlg)} &rarr; + ${escapeHtml(c.finishAlg)}</span>` : ''}
                         ${c.triggerDisplay && c.fullTriggerAlg
                           ? `<button type="button" class="flb-list-alt-btn flb-quiz-sim-btn" data-quiz-idx="${idx}" data-sim-mode="trigger" data-tooltip="Simulate Alt (${escapeHtml(c.triggerDisplay)}): ${escapeHtml(c.fullTriggerAlg)}">${ICON_POPUP_SIM}<span>Alt: ${escapeHtml(c.triggerDisplay)}</span></button>`
                           : (c.triggerDisplay ? `<span class="flb-trig-mini">Alt: ${escapeHtml(c.triggerDisplay)}</span>` : '')}`
                    }
                  </div>
                  <div class="flb-quiz-btns">
                    <button type="button" class="btn btn-xs flb-open-in-exp-btn" data-exp-case="${c.id}" data-exp-group="${c.group || 'two-bar'}" data-tooltip="Open 2D diagrams in Explorer" aria-label="Open 2D diagrams in Explorer">${ICON_DIAGRAM}<span>2D</span></button>
                    <button type="button" class="btn btn-xs btn-primary flb-quiz-sim-btn" data-quiz-idx="${idx}" data-tooltip="Preview in 3D popup" aria-label="Open popup simulator">${ICON_POPUP_SIM}<span>Sim</span></button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `}
    </div>
  `;
}

function toQuickSimSolution(c, mode = 'primary') {
  const isAlt = mode === 'trigger' && Boolean(c.fullTriggerAlg);
  const moves = isAlt ? c.fullTriggerAlg : getCasePrimaryMoves(c);
  const mv = isAlt ? c.fullTriggerAlg.split(' ').filter(Boolean).length : getCaseMoveCount(c);
  const overlay = getCaseCornerOverlay(c);
  const code = getCaseCodeBadge(c);
  const cornerTag = `${overlay.pieceA?.tagText || ''}${overlay.pieceB ? `, ${overlay.pieceB.tagText}` : ''}`;
  return {
    _caseId: c.id,
    _algMode: isAlt ? 'trigger' : 'primary',
    label: isAlt
      ? `${code} ${c.subShape} · Alt ${c.triggerDisplay} (${cornerTag})`
      : `${code} ${c.subShape} (${cornerTag})`,
    shortLabel: isAlt ? `${code} Alt` : `${code} (${mv}m)`,
    pillLabel: isAlt ? `${code} · Alt (${c.triggerDisplay})` : `${code} · ${mv}m`,
    face: 'white',
    moves,
    moveCount: mv,
    inspection: 'none',
    scramble: `z2 ${c.setup}`,
    note: isAlt
      ? `Trigger Alt: ${c.triggerDisplay} (${c.fullTriggerAlg}) — S = R' F R F' · H = F R' F' R. ${c.cue}`
      : `${c.cue}${c.triggerDisplay ? ` Trigger alt: ${c.triggerDisplay} (${c.fullTriggerAlg})` : ''}`
  };
}

function buildQuickSimSolutionsList(cases) {
  const out = [];
  for (const c of cases || []) {
    out.push(toQuickSimSolution(c, 'primary'));
    if (c.triggerDisplay && c.fullTriggerAlg) {
      out.push(toQuickSimSolution(c, 'trigger'));
    }
  }
  return out;
}

function findQuickSimIndex(solutions, caseId, mode = 'primary') {
  const normMode = mode === 'trigger' ? 'trigger' : 'primary';
  const exact = solutions.findIndex(s => s._caseId === caseId && s._algMode === normMode);
  if (exact >= 0) return exact;
  const fallback = solutions.findIndex(s => s._caseId === caseId);
  return fallback >= 0 ? fallback : 0;
}

const MAX_MOUNTED_GRID_3D = 28;

function parseSetupAndAlg(setupStr, algStr) {
  const rawSetup = `z2 ${setupStr || ''}`.trim();
  const parsedSetup = parseScrambleInput(rawSetup);
  const setupMoves = parsedSetup.ok ? parsedSetup.moves : cleanAlg(rawSetup).split(/\s+/).filter(Boolean);
  const cleanSol = cleanAlg(algStr || '');
  const parsedSol = cleanSol ? parseScrambleInput(cleanSol) : { ok: false };
  const algMoves = parsedSol.ok ? parsedSol.moves : (cleanSol ? cleanSol.split(/\s+/).filter(Boolean) : []);
  return {
    setupMoves,
    algMoves,
    combinedMoves: [...setupMoves, ...algMoves]
  };
}

async function resetDisplayCamera(el) {
  if (!el?.player) return;
  try {
    const p = await el.player.experimentalCurrentThreeJSPuzzleObject?.();
    if (p) {
      p.quaternion.set(0, 0, 0, 1);
      p.rotation.set(0, 0, 0);
      p.scheduleRenderCallback?.();
    }
  } catch {}
  try {
    el.player.cameraLatitude = 25;
    el.player.cameraLongitude = 30;
    el.player.cameraDistance = 6;
  } catch {}
  try {
    el.player.experimentalModel?.twistySceneModel?.orbitCoordinatesRequest?.set?.('auto');
  } catch {}
}

function seekPlayerWithIndexer(el, idx, setupCount, totalCount, targetCount) {
  const clamped = Math.max(setupCount, Math.min(totalCount, targetCount));
  if (clamped <= 0) {
    el.player.controller?.jumpToStart?.({ flash: false });
    return 0;
  }
  if (clamped >= totalCount) {
    el.player.controller?.jumpToEnd?.({ flash: false });
    return totalCount;
  }
  const targetIdx = clamped - 1;
  const endTs = idx.indexToMoveStartTimestamp(targetIdx) + idx.moveDuration(targetIdx);
  el.player.experimentalModel.timestampRequest.set(endTs);
  return clamped;
}

// ============================================================================
// Live 3D Player Controllers inside 1st Layer (Explorer & Grid Cards)
// ============================================================================
const flbMini = {
  container: null,
  displayEl: null,
  indexer: null,
  setupCount: 0,
  algMoves: [],
  combinedMoves: [],
  moveCount: 0,
  pendingSeek: false,
  loadGen: 0,
  listenersEl: null,
  getSimSpeed: () => 1,
  onSetSimSpeed: null,
  getShowReflection: () => true
};

const flbGrid3d = {
  container: null,
  observer: null,
  cards: new Map(), // id -> entry
  lru: [],
  activePlayingId: null,
  gen: 0,
  getSimSpeed: () => 1,
  getShowReflection: () => true
};

function teardownGrid3d() {
  flbGrid3d.gen++;
  flbGrid3d.activePlayingId = null;
  if (flbGrid3d.observer) {
    try { flbGrid3d.observer.disconnect(); } catch {}
    flbGrid3d.observer = null;
  }
  for (const entry of flbGrid3d.cards.values()) {
    entry.loadGen++;
    entry.pendingSeek = false;
    entry.wrapEl?.removeAttribute?.('data-card-mounted');
    if (entry.displayEl) {
      try {
        entry.displayEl.player?.pause?.();
        entry.displayEl.remove?.();
      } catch {}
      entry.displayEl = null;
    }
  }
  flbGrid3d.cards.clear();
  flbGrid3d.lru = [];
  flbGrid3d.container = null;
}

export function teardownFirstLayerExplorer3d() {
  teardownFirstFace3d();
  teardownGrid3d();
  flbMini.loadGen++;
  flbMini.pendingSeek = false;
  flbMini.indexer = null;
  flbMini.listenersEl = null;
  flbMini.setupCount = 0;
  flbMini.algMoves = [];
  flbMini.combinedMoves = [];
  flbMini.moveCount = 0;
  if (flbMini.displayEl) {
    try {
      flbMini.displayEl.player?.pause?.();
      flbMini.displayEl.remove?.();
    } catch {}
    flbMini.displayEl = null;
  }
  flbMini.container = null;
}

export function syncFirstLayerExplorerSpeed(spd) {
  const next = Number(spd);
  if (!Number.isFinite(next) || next <= 0) return;
  if (flbMini.displayEl?.player) {
    try {
      flbMini.displayEl.player.tempoScale = next;
    } catch {}
  }
  const speedBtn = flbMini.container?.querySelector?.('#flbMiniSpeedBtn');
  if (speedBtn) {
    speedBtn.textContent = `${next}x`;
    speedBtn.setAttribute('aria-label', `Playback pace ${next}x`);
  }
  for (const entry of flbGrid3d.cards.values()) {
    if (entry.displayEl?.player) {
      try {
        entry.displayEl.player.tempoScale = next;
      } catch {}
    }
  }
  for (const entry of ffCards3d.cards.values()) {
    if (entry.displayEl?.player) {
      try {
        entry.displayEl.player.tempoScale = next;
      } catch {}
    }
  }
}

function updateFlbMiniPlayingUi(playing) {
  const playBtn = flbMini.container?.querySelector?.('#flbMiniPlayBtn');
  if (!playBtn) return;
  const algTotal = flbMini.algMoves.length;
  playBtn.disabled = algTotal === 0;
  playBtn.classList.toggle('is-playing', Boolean(playing));
  if (playing) {
    playBtn.innerHTML = ICON_PAUSE;
    if (playBtn.dataset) playBtn.dataset.playState = 'pause';
    playBtn.setAttribute('aria-label', 'Pause solution');
  } else if (algTotal > 0 && flbMini.moveCount >= flbMini.combinedMoves.length) {
    playBtn.innerHTML = ICON_REPLAY;
    if (playBtn.dataset) playBtn.dataset.playState = 'replay';
    playBtn.setAttribute('aria-label', 'Replay solution');
  } else {
    playBtn.innerHTML = ICON_PLAY;
    if (playBtn.dataset) playBtn.dataset.playState = 'play';
    playBtn.setAttribute('aria-label', 'Play solution');
  }
}

function updateFlbMiniProgress(moveCount) {
  const setupCount = flbMini.setupCount;
  const total = flbMini.combinedMoves.length;
  const algTotal = flbMini.algMoves.length;
  const clamped = Math.max(setupCount, Math.min(total, Number(moveCount) || 0));
  flbMini.moveCount = clamped;

  const statusEl = flbMini.container?.querySelector?.('#flbMiniStepStatus');
  const startBtn = flbMini.container?.querySelector?.('#flbMiniStartBtn');
  const prevBtn = flbMini.container?.querySelector?.('#flbMiniPrevBtn');
  const nextBtn = flbMini.container?.querySelector?.('#flbMiniNextBtn');
  const endBtn = flbMini.container?.querySelector?.('#flbMiniEndBtn');

  if (startBtn) startBtn.disabled = clamped <= setupCount || algTotal === 0;
  if (prevBtn) prevBtn.disabled = clamped <= setupCount || algTotal === 0;
  if (nextBtn) nextBtn.disabled = clamped >= total || algTotal === 0;
  if (endBtn) endBtn.disabled = clamped >= total || algTotal === 0;

  if (statusEl) {
    if (algTotal === 0) {
      statusEl.textContent = 'No moves';
    } else if (clamped >= total) {
      statusEl.textContent = `Solved! · ${algTotal} / ${algTotal} moves`;
    } else if (clamped <= setupCount) {
      statusEl.textContent = `Ready · ${algTotal} move${algTotal === 1 ? '' : 's'}`;
    } else {
      const algStep = clamped - setupCount;
      const mv = flbMini.algMoves[algStep - 1] || '';
      statusEl.textContent = `Move ${algStep} / ${algTotal}${mv ? `: ${mv}` : ''}`;
    }
  }

  const playBtn = flbMini.container?.querySelector?.('#flbMiniPlayBtn');
  if (playBtn && !playBtn.classList.contains('is-playing')) {
    updateFlbMiniPlayingUi(false);
  }
}

function seekFlbWithIndexer(el, idx, targetCount) {
  const next = seekPlayerWithIndexer(el, idx, flbMini.setupCount, flbMini.combinedMoves.length, targetCount);
  updateFlbMiniProgress(next);
}

async function jumpFlbMiniToMoveCount(targetCount) {
  const el = flbMini.displayEl;
  if (!el?.player) return;
  const lGen = flbMini.loadGen;
  flbMini.pendingSeek = true;
  try {
    el.player.pause();
    if (!flbMini.indexer) {
      flbMini.indexer = await el.player.experimentalModel.indexer.get();
    }
    if (lGen !== flbMini.loadGen || flbMini.displayEl !== el) return;
    seekFlbWithIndexer(el, flbMini.indexer, targetCount);
  } catch {} finally {
    if (lGen === flbMini.loadGen) flbMini.pendingSeek = false;
  }
}

function attachFlbMiniListeners(el) {
  if (!el?.player?.experimentalModel || flbMini.listenersEl === el) return;
  flbMini.listenersEl = el;
  try {
    el.player.experimentalModel.indexer.addFreshListener((idx) => {
      if (flbMini.displayEl === el) flbMini.indexer = idx;
    });
    el.player.experimentalModel.detailedTimelineInfo.addFreshListener((info) => {
      if (flbMini.displayEl !== el || flbMini.pendingSeek || !flbMini.indexer || flbMini.combinedMoves.length === 0) return;
      try {
        if (info.atStart || info.timestamp <= 0) {
          if (flbMini.setupCount > 0) void jumpFlbMiniToMoveCount(flbMini.setupCount);
          else updateFlbMiniProgress(0);
          return;
        }
        if (info.atEnd) {
          updateFlbMiniProgress(flbMini.combinedMoves.length);
          return;
        }
        const mIdx = flbMini.indexer.timestampToIndex(info.timestamp);
        const nextCount = mIdx + 1;
        if (nextCount < flbMini.setupCount) {
          void jumpFlbMiniToMoveCount(flbMini.setupCount);
          return;
        }
        updateFlbMiniProgress(nextCount);
      } catch {}
    });
    el.player.experimentalModel.coarseTimelineInfo.addFreshListener((info) => {
      if (flbMini.displayEl !== el) return;
      updateFlbMiniPlayingUi(Boolean(info.playing));
    });
  } catch {}
}

function bindFlbMiniControls(container) {
  const startBtn = container?.querySelector?.('#flbMiniStartBtn');
  const prevBtn = container?.querySelector?.('#flbMiniPrevBtn');
  const playBtn = container?.querySelector?.('#flbMiniPlayBtn');
  const nextBtn = container?.querySelector?.('#flbMiniNextBtn');
  const endBtn = container?.querySelector?.('#flbMiniEndBtn');
  const speedBtn = container?.querySelector?.('#flbMiniSpeedBtn');
  const resetBtn = container?.querySelector?.('#flbReset3dBtn');

  if (startBtn) startBtn.onclick = () => void jumpFlbMiniToMoveCount(flbMini.setupCount);
  if (prevBtn) {
    prevBtn.onclick = () => {
      const el = flbMini.displayEl;
      if (!el?.player?.controller || flbMini.moveCount <= flbMini.setupCount) return;
      if (flbMini.moveCount <= flbMini.setupCount + 1) {
        void jumpFlbMiniToMoveCount(flbMini.setupCount);
        return;
      }
      try {
        el.player.pause();
        el.player.controller.animationController.play({ direction: -1, untilBoundary: 'move' });
      } catch {}
    };
  }
  if (playBtn) {
    playBtn.onclick = () => {
      const el = flbMini.displayEl;
      if (!el?.player?.controller || flbMini.algMoves.length === 0) return;
      if (flbMini.moveCount >= flbMini.combinedMoves.length || flbMini.moveCount < flbMini.setupCount) {
        void jumpFlbMiniToMoveCount(flbMini.setupCount).then(() => {
          setTimeout(() => { try { flbMini.displayEl?.player?.play?.(); } catch {} }, 40);
        });
        return;
      }
      try { el.player.controller.togglePlay(); } catch {}
    };
  }
  if (nextBtn) {
    nextBtn.onclick = () => {
      const el = flbMini.displayEl;
      if (!el?.player?.controller || flbMini.moveCount >= flbMini.combinedMoves.length) return;
      try {
        el.player.pause();
        el.player.controller.animationController.play({ direction: 1, untilBoundary: 'move' });
      } catch {}
    };
  }
  if (endBtn) endBtn.onclick = () => void jumpFlbMiniToMoveCount(flbMini.combinedMoves.length);
  if (speedBtn) {
    speedBtn.onclick = () => {
      const current = Number(flbMini.getSimSpeed ? flbMini.getSimSpeed() : 1) || 1;
      const idx = SIM_SPEED_OPTIONS.indexOf(current);
      const next = SIM_SPEED_OPTIONS[(idx + 1) % SIM_SPEED_OPTIONS.length];
      syncFirstLayerExplorerSpeed(next);
      flbMini.onSetSimSpeed?.(next);
    };
  }
  if (resetBtn) {
    resetBtn.onclick = () => void resetDisplayCamera(flbMini.displayEl);
  }
}

function touchGridLru(id) {
  const idx = flbGrid3d.lru.indexOf(id);
  if (idx >= 0) flbGrid3d.lru.splice(idx, 1);
  flbGrid3d.lru.push(id);
  while (flbGrid3d.lru.length > MAX_MOUNTED_GRID_3D) {
    const victimIdx = flbGrid3d.lru.findIndex(candId => {
      const c = flbGrid3d.cards.get(candId);
      return c && !c.intersecting && !c.playing && candId !== flbGrid3d.activePlayingId;
    });
    if (victimIdx < 0) break;
    const [victimId] = flbGrid3d.lru.splice(victimIdx, 1);
    const victim = flbGrid3d.cards.get(victimId);
    if (victim?.displayEl) {
      victim.loadGen++;
      victim.pendingSeek = false;
      try {
        victim.displayEl.player?.pause?.();
        victim.displayEl.remove?.();
      } catch {}
      victim.displayEl = null;
      victim.indexer = null;
      victim.mountPromise = null;
      if (victim.wrapEl?.isConnected) {
        victim.wrapEl.removeAttribute('data-card-mounted');
        victim.wrapEl.innerHTML = renderFirstLayer3dSvg(victim.caseObj);
      }
    }
  }
}

function updateGridCardUi(entry, playing) {
  entry.playing = Boolean(playing);
  const cardEl = entry.cardEl;
  if (!cardEl) return;
  const playBtn = cardEl.querySelector('.flb-card-play-btn');
  const startBtn = cardEl.querySelector('.flb-card-start-btn');
  const nextBtn = cardEl.querySelector('.flb-card-next-btn');
  const total = entry.combinedMoves.length;
  const algTotal = entry.algMoves.length;

  if (startBtn) startBtn.disabled = entry.moveCount <= entry.setupCount || algTotal === 0;
  if (nextBtn) nextBtn.disabled = entry.moveCount >= total || algTotal === 0;

  if (playBtn) {
    playBtn.disabled = algTotal === 0;
    playBtn.classList.toggle('is-playing', entry.playing);
    if (entry.playing) {
      playBtn.innerHTML = ICON_PAUSE;
      if (playBtn.dataset) playBtn.dataset.playState = 'pause';
      playBtn.setAttribute('aria-label', 'Pause solution');
    } else if (algTotal > 0 && entry.moveCount >= total) {
      playBtn.innerHTML = ICON_REPLAY;
      if (playBtn.dataset) playBtn.dataset.playState = 'replay';
      playBtn.setAttribute('aria-label', 'Replay solution');
    } else {
      playBtn.innerHTML = ICON_PLAY;
      if (playBtn.dataset) playBtn.dataset.playState = 'play';
      playBtn.setAttribute('aria-label', 'Play solution');
    }
  }
}

function pauseOtherGridCards(exceptId) {
  for (const [id, entry] of flbGrid3d.cards.entries()) {
    if (id !== exceptId && entry.playing && entry.displayEl?.player) {
      try { entry.displayEl.player.pause(); } catch {}
    }
  }
  flbGrid3d.activePlayingId = exceptId;
}

async function seekGridEntry(entry, targetCount) {
  const el = entry.displayEl;
  if (!el?.player) return;
  const lGen = entry.loadGen;
  entry.pendingSeek = true;
  try {
    el.player.pause();
    if (!entry.indexer) {
      entry.indexer = await el.player.experimentalModel.indexer.get();
    }
    if (lGen !== entry.loadGen || entry.gridGen !== flbGrid3d.gen || entry.displayEl !== el) return;
    entry.moveCount = seekPlayerWithIndexer(el, entry.indexer, entry.setupCount, entry.combinedMoves.length, targetCount);
    updateGridCardUi(entry, false);
  } catch {} finally {
    if (lGen === entry.loadGen) entry.pendingSeek = false;
  }
}

async function ensureGridCardMounted(entry) {
  if (!entry || entry.gridGen !== flbGrid3d.gen || !entry.wrapEl?.isConnected) return null;
  if (entry.displayEl && entry.wrapEl.contains(entry.displayEl)) {
    touchGridLru(entry.id);
    return entry.displayEl;
  }
  if (entry.mountPromise) return entry.mountPromise;

  const lGen = ++entry.loadGen;
  const gGen = entry.gridGen;
  entry.mountPromise = (async () => {
    try {
      const SD = await getFlbScrambleDisplay();
      if (!SD || lGen !== entry.loadGen || gGen !== flbGrid3d.gen || !entry.wrapEl?.isConnected) return null;
      const spd = Number(flbGrid3d.getSimSpeed ? flbGrid3d.getSimSpeed() : 1) || 1;
      const showRefl = flbGrid3d.getShowReflection ? flbGrid3d.getShowReflection() : true;

      const scrambleStr = entry.combinedMoves.join(' ');
      const el = new SD();
      el.event = '222';
      el.visualization = '3D';
      el.scramble = scrambleStr;
      if (el.player) {
        el.player.hintFacelets = showRefl ? 'floating' : 'none';
        el.player.tempoScale = spd;
      }

      entry.wrapEl.innerHTML = '';
      entry.wrapEl.appendChild(el);
      if (el.player) {
        el.player.hintFacelets = showRefl ? 'floating' : 'none';
        el.player.tempoScale = spd;
      }
      entry.wrapEl.dataset.cardMounted = 'true';
      entry.displayEl = el;
      entry.appliedScrambleStr = scrambleStr;
      entry.indexer = null;
      touchGridLru(entry.id);
      void applyColorsTo3DCube(el);

      if (el.player?.experimentalModel) {
        el.player.experimentalModel.indexer.addFreshListener((idx) => {
          if (entry.displayEl === el) entry.indexer = idx;
        });
        el.player.experimentalModel.detailedTimelineInfo.addFreshListener((info) => {
          if (entry.displayEl !== el || entry.pendingSeek || !entry.indexer || entry.gridGen !== flbGrid3d.gen) return;
          try {
            if (info.atStart || info.timestamp <= 0) {
              if (entry.setupCount > 0) void seekGridEntry(entry, entry.setupCount);
              else {
                entry.moveCount = 0;
                updateGridCardUi(entry, entry.playing);
              }
              return;
            }
            if (info.atEnd) {
              entry.moveCount = entry.combinedMoves.length;
              updateGridCardUi(entry, entry.playing);
              return;
            }
            const mIdx = entry.indexer.timestampToIndex(info.timestamp);
            const nextCount = mIdx + 1;
            if (nextCount < entry.setupCount) {
              void seekGridEntry(entry, entry.setupCount);
              return;
            }
            entry.moveCount = nextCount;
            updateGridCardUi(entry, entry.playing);
          } catch {}
        });
        el.player.experimentalModel.coarseTimelineInfo.addFreshListener((info) => {
          if (entry.displayEl !== el || entry.gridGen !== flbGrid3d.gen) return;
          if (!info.playing && flbGrid3d.activePlayingId === entry.id) {
            flbGrid3d.activePlayingId = null;
          }
          updateGridCardUi(entry, Boolean(info.playing));
        });

        entry.pendingSeek = true;
        try {
          const idx = await el.player.experimentalModel.indexer.get();
          if (lGen === entry.loadGen && gGen === flbGrid3d.gen && entry.displayEl === el) {
            entry.indexer = idx;
            entry.moveCount = seekPlayerWithIndexer(el, idx, entry.setupCount, entry.combinedMoves.length, entry.setupCount);
            updateGridCardUi(entry, false);
          }
        } catch {} finally {
          if (lGen === entry.loadGen) entry.pendingSeek = false;
        }
      }
      return el;
    } catch {
      return null;
    } finally {
      entry.mountPromise = null;
    }
  })();

  return entry.mountPromise;
}

async function switchGridCardAlgMode(entry, nextMode) {
  if (!entry || entry.gridGen !== flbGrid3d.gen) return;
  const mode = nextMode === 'trigger' && entry.caseObj.fullTriggerAlg ? 'trigger' : 'primary';
  if (entry.algMode === mode) return;

  const nextAlg = mode === 'trigger' ? entry.caseObj.fullTriggerAlg : getCasePrimaryMoves(entry.caseObj);
  const { setupMoves, algMoves, combinedMoves } = parseSetupAndAlg(entry.caseObj.setup, nextAlg);

  entry.algMode = mode;
  entry.setupCount = setupMoves.length;
  entry.algMoves = algMoves;
  entry.combinedMoves = combinedMoves;
  entry.moveCount = setupMoves.length;
  if (entry.wrapEl?.dataset) {
    entry.wrapEl.dataset.cardAlg = nextAlg;
    entry.wrapEl.dataset.cardAlgMode = mode;
  }

  if (entry.cardEl) {
    entry.cardEl.querySelectorAll('.flb-card-alg-opt').forEach(optBtn => {
      const isAct = optBtn.dataset.algMode === mode;
      optBtn.classList.toggle('is-active', isAct);
      optBtn.setAttribute('aria-pressed', String(isAct));
    });
  }
  updateGridCardUi(entry, false);

  if (entry.displayEl?.player) {
    try { entry.displayEl.player.pause(); } catch {}
  }

  const el = await ensureGridCardMounted(entry);
  if (!el || entry.gridGen !== flbGrid3d.gen || entry.algMode !== mode) return;

  const targetScramble = entry.combinedMoves.join(' ');
  if (entry.appliedScrambleStr !== targetScramble) {
    const lGen = ++entry.loadGen;
    entry.indexer = null;
    entry.pendingSeek = true;
    try {
      el.player?.pause?.();
      el.scramble = targetScramble;
      entry.appliedScrambleStr = targetScramble;
      void applyColorsTo3DCube(el);
      if (el.player) {
        const spd = Number(flbGrid3d.getSimSpeed ? flbGrid3d.getSimSpeed() : 1) || 1;
        el.player.tempoScale = spd;
        if (el.player.experimentalModel?.indexer) {
          const idx = await el.player.experimentalModel.indexer.get();
          if (lGen === entry.loadGen && entry.gridGen === flbGrid3d.gen && entry.displayEl === el && entry.algMode === mode) {
            entry.indexer = idx;
            entry.moveCount = seekPlayerWithIndexer(el, idx, entry.setupCount, entry.combinedMoves.length, entry.setupCount);
            updateGridCardUi(entry, false);
          }
        }
      }
    } catch {} finally {
      if (lGen === entry.loadGen) entry.pendingSeek = false;
    }
  }
}

function mountFirstLayerGrid3d(container, filteredCases, { getSimSpeed = () => 1, getShowReflection = () => true } = {}) {
  if (!container || typeof window === 'undefined') return;
  const wraps = container.querySelectorAll('.flb-card-3d-live');
  if (!wraps.length) return;

  teardownGrid3d();
  const gGen = flbGrid3d.gen;
  flbGrid3d.container = container;
  flbGrid3d.getSimSpeed = getSimSpeed;
  flbGrid3d.getShowReflection = getShowReflection;

  const caseById = new Map((filteredCases || []).map(c => [c.id, c]));

  wraps.forEach(wrapEl => {
    const id = wrapEl.getAttribute('data-card-id') || wrapEl.dataset?.cardId;
    const caseObj = caseById.get(id);
    if (!id || !caseObj) return;
    const { setupMoves, algMoves, combinedMoves } = parseSetupAndAlg(
      wrapEl.dataset.cardSetup,
      wrapEl.dataset.cardAlg
    );
    const entry = {
      id,
      caseObj,
      wrapEl,
      cardEl: wrapEl.closest('.flb-case-card'),
      displayEl: null,
      appliedScrambleStr: '',
      algMode: 'primary',
      mountPromise: null,
      indexer: null,
      setupCount: setupMoves.length,
      algMoves,
      combinedMoves,
      moveCount: setupMoves.length,
      pendingSeek: false,
      loadGen: 0,
      gridGen: gGen,
      intersecting: false,
      playing: false
    };
    flbGrid3d.cards.set(id, entry);
  });

  if (typeof IntersectionObserver !== 'undefined') {
    const obs = new IntersectionObserver((entries) => {
      if (gGen !== flbGrid3d.gen) return;
      for (const io of entries) {
        const id = io.target?.getAttribute?.('data-card-id') || io.target?.dataset?.cardId;
        const entry = id ? flbGrid3d.cards.get(id) : null;
        if (!entry) continue;
        entry.intersecting = Boolean(io.isIntersecting);
        if (io.isIntersecting) {
          void ensureGridCardMounted(entry);
        }
      }
    }, { rootMargin: '220px 0px' });
    flbGrid3d.observer = obs;
    wraps.forEach(w => obs.observe(w));
    const vh = window.innerHeight || 900;
    for (const entry of flbGrid3d.cards.values()) {
      const rect = entry.wrapEl.getBoundingClientRect?.();
      if (rect && rect.width > 0 && rect.height > 0 && rect.bottom >= -220 && rect.top <= vh + 220) {
        entry.intersecting = true;
        void ensureGridCardMounted(entry);
      }
    }
  } else {
    for (const entry of flbGrid3d.cards.values()) {
      entry.intersecting = true;
      void ensureGridCardMounted(entry);
    }
  }

  container.querySelectorAll('.flb-card-alg-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      const entry = flbGrid3d.cards.get(btn.dataset.cardId);
      if (!entry) return;
      void switchGridCardAlgMode(entry, btn.dataset.algMode);
    });
  });

  container.querySelectorAll('.flb-card-reset-3d-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const entry = flbGrid3d.cards.get(btn.dataset.cardId);
      if (!entry) return;
      void ensureGridCardMounted(entry).then(el => resetDisplayCamera(el));
    });
  });

  container.querySelectorAll('.flb-card-start-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const entry = flbGrid3d.cards.get(btn.dataset.cardId);
      if (!entry) return;
      void ensureGridCardMounted(entry).then(() => seekGridEntry(entry, entry.setupCount));
    });
  });

  container.querySelectorAll('.flb-card-play-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const entry = flbGrid3d.cards.get(btn.dataset.cardId);
      if (!entry || entry.algMoves.length === 0) return;
      pauseOtherGridCards(entry.id);
      void ensureGridCardMounted(entry).then(el => {
        if (!el?.player?.controller) return;
        if (entry.moveCount >= entry.combinedMoves.length || entry.moveCount < entry.setupCount) {
          void seekGridEntry(entry, entry.setupCount).then(() => {
            setTimeout(() => { try { entry.displayEl?.player?.play?.(); } catch {} }, 40);
          });
          return;
        }
        try { el.player.controller.togglePlay(); } catch {}
      });
    });
  });

  container.querySelectorAll('.flb-card-next-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const entry = flbGrid3d.cards.get(btn.dataset.cardId);
      if (!entry || entry.algMoves.length === 0) return;
      pauseOtherGridCards(entry.id);
      void ensureGridCardMounted(entry).then(el => {
        if (!el?.player?.controller || entry.moveCount >= entry.combinedMoves.length) return;
        try {
          el.player.pause();
          el.player.controller.animationController.play({ direction: 1, untilBoundary: 'move' });
        } catch {}
      });
    });
  });
}

export async function mountFirstLayerExplorer3d(container, state, {
  getSimSpeed = () => 1,
  onSetSimSpeed = null,
  getShowReflection = () => true
} = {}) {
  if (!container || typeof window === 'undefined') return;
  const wrapEl = container.querySelector('#flbDetail3dWrap');
  if (!wrapEl) return;

  flbMini.container = container;
  flbMini.getSimSpeed = getSimSpeed;
  flbMini.onSetSimSpeed = onSetSimSpeed;
  flbMini.getShowReflection = getShowReflection;

  const pool = getExplorerPool(state);
  const activeCase = pool.find(c => c.id === state.activeCaseId) || pool[0];
  if (!activeCase) return;

  const activeAlg = state.explorerAlgMode === 'trigger' && activeCase.fullTriggerAlg
    ? activeCase.fullTriggerAlg
    : getCasePrimaryMoves(activeCase);
  const { setupMoves, algMoves, combinedMoves } = parseSetupAndAlg(activeCase.setup, activeAlg);

  const lGen = ++flbMini.loadGen;
  flbMini.setupCount = setupMoves.length;
  flbMini.algMoves = algMoves;
  flbMini.combinedMoves = combinedMoves;
  flbMini.moveCount = setupMoves.length;
  updateFlbMiniProgress(setupMoves.length);
  updateFlbMiniPlayingUi(false);

  const canReuse = Boolean(flbMini.displayEl && wrapEl.contains(flbMini.displayEl));
  const spd = Number(getSimSpeed ? getSimSpeed() : 1) || 1;
  const showRefl = getShowReflection ? getShowReflection() : true;

  try {
    let el = flbMini.displayEl;
    if (!canReuse) {
      wrapEl.innerHTML = '';
      const SD = await getFlbScrambleDisplay();
      if (!SD || lGen !== flbMini.loadGen || !wrapEl.isConnected) return;
      el = new SD();
      el.event = '222';
      el.visualization = '3D';
      el.scramble = combinedMoves.join(' ');
      if (el.player) {
        el.player.hintFacelets = showRefl ? 'floating' : 'none';
        el.player.tempoScale = spd;
      }
      wrapEl.appendChild(el);
      if (el.player) {
        el.player.hintFacelets = showRefl ? 'floating' : 'none';
        el.player.tempoScale = spd;
      }
      flbMini.displayEl = el;
      flbMini.indexer = null;
      flbMini.listenersEl = null;
    } else {
      el.player?.pause?.();
      flbMini.indexer = null;
      el.scramble = combinedMoves.join(' ');
      if (el.player) {
        el.player.hintFacelets = showRefl ? 'floating' : 'none';
        el.player.tempoScale = spd;
      }
    }

    applyColorsTo3DCube(el);
    syncFirstLayerExplorerSpeed(spd);
    attachFlbMiniListeners(el);
    bindFlbMiniControls(container);

    if (el?.player?.experimentalModel?.indexer) {
      flbMini.pendingSeek = true;
      try {
        const idx = await el.player.experimentalModel.indexer.get();
        if (lGen !== flbMini.loadGen || flbMini.displayEl !== el) return;
        flbMini.indexer = idx;
        seekFlbWithIndexer(el, idx, setupMoves.length);
      } catch {} finally {
        if (lGen === flbMini.loadGen) flbMini.pendingSeek = false;
      }
    }
  } catch (err) {
    console.warn('1st Layer Explorer 3D mount unavailable:', err);
    wrapEl.innerHTML = `<span class="study-visual-loading">3D view unavailable</span>`;
  }
}

export function bindFirstLayerStudyEvents(container, state, {
  onRerender,
  onQuickSimSolutions,
  getSimSpeed = () => 1,
  onSetSimSpeed = null,
  getShowReflection = () => true
} = {}) {
  container.querySelectorAll('.flb-subtab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.subTab = btn.dataset.flbTab || 'quiz';
      onRerender?.();
    });
  });

  // Explorer bindings
  container.querySelectorAll('[data-flb-exp-group]').forEach(btn => {
    btn.addEventListener('click', () => {
      const nextGrp = normalizeGroupId(btn.dataset.flbExpGroup || 'two-bar');
      state.explorerGroup = nextGrp;
      const list = getCasesForGroup(nextGrp);
      if (list.length) {
        state.activeCaseId = list[0].id;
        state.activeShape = list[0].subShape;
      }
      state.explorerAlgMode = 'primary';
      onRerender?.();
    });
  });

  container.querySelectorAll('.flb-shape-pill').forEach(btn => {
    btn.addEventListener('click', () => {
      state.activeShape = btn.dataset.flbShape;
      const list = getCasesForGroup(state.explorerGroup || 'two-bar').filter(c => c.subShape === state.activeShape);
      if (list.length) state.activeCaseId = list[0].id;
      state.explorerAlgMode = 'primary';
      onRerender?.();
    });
  });

  container.querySelectorAll('.flb-variant-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.activeCaseId = btn.dataset.flbCase;
      state.explorerAlgMode = 'primary';
      onRerender?.();
    });
  });

  container.querySelectorAll('[data-flb-alg-mode]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.explorerAlgMode = btn.dataset.flbAlgMode === 'trigger' ? 'trigger' : 'primary';
      onRerender?.();
    });
  });

  container.querySelector('#flbPrevVariantBtn')?.addEventListener('click', () => {
    const pool = getExplorerPool(state);
    const idx = pool.findIndex(c => c.id === state.activeCaseId);
    if (idx > 0) {
      state.activeCaseId = pool[idx - 1].id;
      state.explorerAlgMode = 'primary';
      onRerender?.();
    }
  });

  container.querySelector('#flbNextVariantBtn')?.addEventListener('click', () => {
    const pool = getExplorerPool(state);
    const idx = pool.findIndex(c => c.id === state.activeCaseId);
    if (idx >= 0 && idx < pool.length - 1) {
      state.activeCaseId = pool[idx + 1].id;
      state.explorerAlgMode = 'primary';
      onRerender?.();
    }
  });

  container.querySelector('#flbSimActiveBtn')?.addEventListener('click', () => {
    const pool = getExplorerPool(state);
    const activeIdx = Math.max(0, pool.findIndex(c => c.id === state.activeCaseId));
    const activeCase = pool[activeIdx] || pool[0];
    if (!activeCase) return;
    const solutions = buildQuickSimSolutionsList(pool);
    const activeIndex = findQuickSimIndex(solutions, activeCase.id, state.explorerAlgMode || 'primary');
    onQuickSimSolutions?.({
      puzzle: '222',
      scramble: `z2 ${activeCase.setup}`,
      solutions,
      activeIndex,
      title: `1st Layer Explorer · ${activeCase.subLabel}`
    });
  });

  const activeSubTab = state.subTab || 'quiz';
  if (activeSubTab === 'explorer') {
    teardownGrid3d();
    void mountFirstLayerExplorer3d(container, state, { getSimSpeed, onSetSimSpeed, getShowReflection });
  } else if (activeSubTab === 'quiz' && state.quizLayout !== 'list') {
    void mountFirstLayerGrid3d(container, getFilteredQuizCases(state), { getSimSpeed, getShowReflection });
  } else {
    teardownGrid3d();
  }

  // Guide bindings
  container.querySelectorAll('.flb-guide-sim-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.guideCase;
      const idx = Math.max(0, RIM_BAR_CASES.findIndex(c => c.id === targetId));
      onQuickSimSolutions?.({
        puzzle: '222',
        scramble: `z2 ${RIM_BAR_CASES[idx].setup}`,
        solutions: RIM_BAR_CASES.map(toQuickSimSolution),
        activeIndex: idx,
        title: '1st Layer · The 3 One-Move Rim Bars'
      });
    });
  });

  container.querySelectorAll('.flb-2look-bp-sim').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.bpIdx) || 0;
      const list = FIRST_LAYER_TWO_LOOK.optionA.bpCases;
      onQuickSimSolutions?.({
        puzzle: '222',
        scramble: `z2 ${list[idx].setup}`,
        solutions: list.map((b, i) => ({
          label: b.label,
          shortLabel: `BP #${i + 1} (${b.bpSlot}/${b.bpWhite})`,
          face: 'white',
          moves: b.alg,
          moveCount: b.alg.split(' ').length,
          inspection: 'none',
          scramble: `z2 ${b.setup}`,
          note: 'Step 1 of 2-Look: Solve BP into DBR while preserving the Left Bar (DFL+DBL).'
        })),
        activeIndex: idx,
        title: '2-Look Step 1: Solve BP First'
      });
    });
  });

  container.querySelectorAll('.flb-2look-fp-sim').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.fpIdx) || 0;
      const list = FIRST_LAYER_TWO_LOOK.optionA.fpFinishes;
      onQuickSimSolutions?.({
        puzzle: '222',
        scramble: `z2 ${list[idx].setup}`,
        solutions: list.map((f, i) => ({
          label: f.label,
          shortLabel: `FP #${i + 1}`,
          face: 'white',
          moves: f.alg,
          moveCount: f.alg.split(' ').length,
          inspection: 'none',
          scramble: `z2 ${f.setup}`,
          note: f.note
        })),
        activeIndex: idx,
        title: '2-Look Step 2: Finish Last Corner FP'
      });
    });
  });

  // Grid & Quiz bindings
  container.querySelectorAll('[data-quiz-group]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.quizGroup = normalizeGroupId(btn.dataset.quizGroup || 'two-bar');
      state.quizBucket = 'all';
      state.quizMoves = 'all';
      state.revealedQuizIds.clear();
      onRerender?.();
    });
  });

  container.querySelectorAll('[data-quiz-bucket]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.quizBucket = btn.dataset.quizBucket || 'all';
      onRerender?.();
    });
  });

  container.querySelectorAll('[data-quiz-moves]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.quizMoves = btn.dataset.quizMoves || 'all';
      onRerender?.();
    });
  });

  container.querySelectorAll('[data-quiz-layout]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.quizLayout = btn.dataset.quizLayout === 'list' ? 'list' : 'grid';
      onRerender?.();
    });
  });

  const legendBtn = container.querySelector('#flbIconLegendBtn');
  legendBtn?.addEventListener('click', () => {
    const isCurrentlyVisible = state.quizShowLegend === true ||
      (state.quizShowLegend === null && typeof window !== 'undefined' && window.innerWidth >= 860);
    const nextVisible = !isCurrentlyVisible;
    state.quizShowLegend = nextVisible;
    const legendWrap = container.querySelector('.flb-icon-legend-wrap');
    if (legendWrap) {
      legendWrap.classList.remove('is-auto', 'is-shown', 'is-hidden');
      legendWrap.classList.add(nextVisible ? 'is-shown' : 'is-hidden');
    } else {
      onRerender?.();
      return;
    }
    legendBtn.classList.toggle('btn-primary', nextVisible);
    legendBtn.setAttribute('aria-pressed', String(nextVisible));
  });

  container.querySelector('#flbQuizHideToggleBtn')?.addEventListener('click', () => {
    state.quizHideAlgs = !state.quizHideAlgs;
    state.revealedQuizIds.clear();
    onRerender?.();
  });

  container.querySelectorAll('.flb-reveal-alg-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      state.revealedQuizIds.add(btn.dataset.revealId);
      onRerender?.();
    });
  });

  container.querySelectorAll('.flb-open-in-exp-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetGrp = normalizeGroupId(btn.dataset.expGroup || 'two-bar');
      const list = getCasesForGroup(targetGrp);
      const found = list.find(c => c.id === btn.dataset.expCase);
      if (found) {
        state.explorerGroup = targetGrp;
        state.activeShape = found.subShape;
        state.activeCaseId = found.id;
        state.explorerAlgMode = 'primary';
        state.subTab = 'explorer';
        onRerender?.();
      }
    });
  });

  container.querySelectorAll('.flb-quiz-sim-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.quizIdx) || 0;
      const filtered = getFilteredQuizCases(state);
      const item = filtered[idx] || filtered[0];
      if (!item) return;
      const reqMode = btn.dataset.simMode || flbGrid3d.cards.get(item.id)?.algMode || 'primary';
      const solutions = buildQuickSimSolutionsList(filtered);
      const activeIndex = findQuickSimIndex(solutions, item.id, reqMode);
      onQuickSimSolutions?.({
        puzzle: '222',
        scramble: `z2 ${item.setup}`,
        solutions,
        activeIndex,
        title: `1st Layer Cases (${filtered.length} cases · ${solutions.length} algs)`
      });
    });
  });
}
