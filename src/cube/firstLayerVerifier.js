// Exact sticker-level 2x2x2 1st-layer verification helpers
// Verifies both:
//   1. Bottom face is 100% White (all 4 D-face stickers after z2, or expected D color)
//   2. Bottom row is solved (all 4 adjacent side pairs F/R/B/L match with distinct colors in valid cyclic order)

import { Alg } from 'cubing/alg';
import { CORNER_FACES_333 } from './cubeUtils.js';

const SLOT_NAMES = ['UFR', 'UBR', 'UBL', 'UFL', 'DFR', 'DFL', 'DBL', 'DBR'];
const BARE_FACE_COLOR = { U: 'white', D: 'yellow', F: 'green', B: 'blue', R: 'red', L: 'orange' };
const PIECE_BASE_COLORS = CORNER_FACES_333.map(faces => faces.map(f => BARE_FACE_COLOR[f]));

const EXPECTED_CYCLE_Z2 = ['green', 'orange', 'blue', 'red'];
const EXPECTED_CYCLE_BARE = ['green', 'red', 'blue', 'orange'];

function buildExecAlg(...parts) {
  return parts.map(p => String(p || '').trim()).filter(Boolean).join(' ');
}

/**
 * Inspect exact visible sticker colors on all 8 corners of a 2x2x2 KPuzzle pattern.
 */
export function get2x2StickerState(pattern) {
  const { pieces, orientation } = pattern.patternData.CORNERS;
  const out = {};
  for (let s = 0; s < 8; s++) {
    const piece = pieces[s];
    const ori = orientation[s];
    const slotFaces = CORNER_FACES_333[s];
    const map = {};
    for (let k = 0; k < 3; k++) {
      map[slotFaces[k]] = PIECE_BASE_COLORS[piece][(k - ori + 3) % 3];
    }
    out[SLOT_NAMES[s]] = map;
  }
  return out;
}

/**
 * Check whether all 4 stickers on the Bottom face (D) match expectedColor ('white' in z2).
 */
export function checkBottomFaceAllWhite(pattern, { expectedColor = 'white' } = {}) {
  const st = get2x2StickerState(pattern);
  const stickers = {
    DFR: st.DFR.D,
    DFL: st.DFL.D,
    DBL: st.DBL.D,
    DBR: st.DBR.D
  };
  const whiteCount = Object.values(stickers).filter(c => c === expectedColor).length;
  return {
    allWhite: whiteCount === 4,
    whiteCount,
    stickers
  };
}

/**
 * Check whether the bottom row (all 4 side sticker pairs around D) is completely solved.
 */
export function checkBottomRowSolved(pattern, { isZ2 = true } = {}) {
  const st = get2x2StickerState(pattern);
  const sidePairs = {
    F: [st.DFL.F, st.DFR.F],
    R: [st.DFR.R, st.DBR.R],
    B: [st.DBR.B, st.DBL.B],
    L: [st.DBL.L, st.DFL.L]
  };
  const matchingBars = Object.values(sidePairs).filter(([a, b]) => a === b).length;
  const distinctFaceColors = new Set(Object.values(sidePairs).map(([a]) => a)).size;
  const cycle = isZ2 ? EXPECTED_CYCLE_Z2 : EXPECTED_CYCLE_BARE;
  const facesOrder = [sidePairs.F[0], sidePairs.R[0], sidePairs.B[0], sidePairs.L[0]];
  const startIdx = cycle.indexOf(facesOrder[0]);
  const validCycle = startIdx >= 0 && facesOrder.every((c, i) => c === cycle[(startIdx + i) % 4]);
  const rowSolved = matchingBars === 4 && distinctFaceColors === 4 && validCycle;
  const exactAligned = rowSolved && facesOrder[0] === 'green';
  return {
    rowSolved,
    exactAligned,
    matchingBars,
    sidePairs
  };
}

/**
 * Combined check confirming both bottom face is all White and all 4 bottom-row side bars are solved.
 */
export function checkFirstLayerSolved(pattern, { isZ2 = true, requireExactAlignment = true } = {}) {
  const expectedColor = isZ2 ? 'white' : 'yellow';
  const bottomFace = checkBottomFaceAllWhite(pattern, { expectedColor });
  const bottomRow = checkBottomRowSolved(pattern, { isZ2 });
  const ok = bottomFace.allWhite && bottomRow.rowSolved && (!requireExactAlignment || bottomRow.exactAligned);
  return { ok, bottomFace, bottomRow };
}

/**
 * Apply setup + solution to a 2x2x2 KPuzzle and verify the resulting 1st layer state.
 */
export function verifyFirstLayerAlg(kp, setupAlg, solutionAlg, { isZ2 = true, requireExactAlignment = true } = {}) {
  const full = buildExecAlg(isZ2 ? 'z2' : '', setupAlg, solutionAlg);
  const pattern = kp.defaultPattern().applyAlg(new Alg(full));
  return checkFirstLayerSolved(pattern, { isZ2, requireExactAlignment });
}

/**
 * Audit every 1st-layer and 1st-face algorithm across all datasets at sticker level.
 */
export function auditAllFirstLayerAlgs(kp, {
  oneBottom = [],
  twoBar = [],
  twoDiag = [],
  threeBottom = [],
  barAll = [],
  twoLook = null,
  firstFaceExamples = []
} = {}) {
  const def = kp.defaultPattern();
  const failures = [];
  let totalChecked = 0;

  const verifyLayerCase = (group, id, variant, setupAlg, solAlg) => {
    for (const isZ2 of [true, false]) {
      totalChecked++;
      try {
        const res = verifyFirstLayerAlg(kp, setupAlg, solAlg, { isZ2, requireExactAlignment: true });
        if (!res.ok) {
          failures.push({ group, id, variant, isZ2, reason: 'Bottom face or bottom row not solved', res });
        }
      } catch (err) {
        failures.push({ group, id, variant, isZ2, reason: err?.message || String(err) });
      }
    }
  };

  for (const c of oneBottom) {
    const algStr = c.fullAlg || c.alg || '';
    if (!algStr) {
      failures.push({ group: 'one-bottom', id: c.id, reason: 'Missing fullAlg' });
      continue;
    }
    verifyLayerCase('one-bottom', c.id, 'full', c.setup, algStr);
  }

  for (const [grpName, list] of [['two-bar', twoBar], ['three-bottom', threeBottom], ['bar-all', barAll]]) {
    for (const c of list) {
      if (!c.fullRuAlg) {
        failures.push({ group: grpName, id: c.id, reason: 'Missing fullRuAlg' });
        continue;
      }
      verifyLayerCase(grpName, c.id, 'RU', c.setup, c.fullRuAlg);
      if (c.fullTriggerAlg) {
        verifyLayerCase(grpName, c.id, 'Alt', c.setup, c.fullTriggerAlg);
      }
    }
  }

  for (const c of twoDiag) {
    if (!c.fullAlg) {
      failures.push({ group: 'two-diag', id: c.id, reason: 'Missing fullAlg' });
      continue;
    }
    verifyLayerCase('two-diag', c.id, 'RUF', c.setup, c.fullAlg);
    if (c.fullTriggerAlg) {
      verifyLayerCase('two-diag', c.id, 'Alt', c.setup, c.fullTriggerAlg);
    }
  }

  if (twoLook?.optionA?.bpCases) {
    for (const b of twoLook.optionA.bpCases) {
      for (const isZ2 of [true, false]) {
        totalChecked++;
        const pat = def.applyAlg(new Alg(buildExecAlg(isZ2 ? 'z2' : '', b.setup, b.alg)));
        const st = get2x2StickerState(pat);
        const expD = isZ2 ? 'white' : 'yellow';
        const expL = isZ2 ? 'red' : 'orange';
        const ok =
          st.DFL.D === expD && st.DBL.D === expD && st.DBR.D === expD &&
          st.DBL.L === expL && st.DFL.L === expL &&
          st.DBR.B === 'blue' && st.DBL.B === 'blue';
        if (!ok) {
          failures.push({ group: 'two-look-bp', id: b.id, isZ2, reason: 'DBL+DFL+DBR 3-corner L/B anchor failed' });
        }
      }
    }
  }

  if (twoLook?.optionA?.fpFinishes) {
    for (const f of twoLook.optionA.fpFinishes) {
      verifyLayerCase('two-look-fp', f.id, 'FP', f.setup, f.alg);
    }
  }

  for (const ex of firstFaceExamples) {
    totalChecked++;
    const pat = def.applyAlg(new Alg(buildExecAlg(ex.scramble, ex.moves)));
    const bf = checkBottomFaceAllWhite(pat, { expectedColor: 'white' });
    const br = checkBottomRowSolved(pat, { isZ2: true });
    const expBars = ex.bottomPerm === 'Layer Solved' ? 4 : ex.bottomPerm === 'Adj Bar' ? 1 : 0;
    if (!bf.allWhite || br.matchingBars !== expBars) {
      failures.push({ group: 'first-face', id: ex.id, bottomPerm: ex.bottomPerm, bf, br });
    }
  }

  return {
    ok: failures.length === 0,
    totalChecked,
    failures
  };
}
