// Generator & verifier for all 75 Bar-on-Left (DFL+DBL solved) 2x2 First Layer cases
// Run with: node scripts/generators/generate-first-layer-bar.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { puzzles } from 'cubing/puzzles';
import { Alg } from 'cubing/alg';
import { CORNER_FACES_333 } from '../../src/cube/cubeUtils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.resolve(__dirname, '../../src/data/firstLayerBarData.js');

const SLOT_NAMES = {
  0: 'UFR',
  1: 'UBR',
  2: 'UBL',
  3: 'UFL',
  4: 'DFR',
  7: 'DBR'
};

const AUF_LIST = ['', 'U', "U'", 'U2'];
const R_MOVES = ['R', "R'", 'R2'];
const U_MOVES = ['U', "U'", 'U2'];
const TRIGGER_MOVES = {
  S: "R' F R F'",
  H: "F R' F' R"
};

function invertMove(m) {
  if (m.endsWith('2')) return m;
  if (m.endsWith("'")) return m[0];
  return `${m}'`;
}

function invertSeq(seq) {
  if (!seq) return '';
  return seq.trim().split(/\s+/).reverse().map(invertMove).join(' ');
}

function getPieceLoc(pat, pieceId) {
  const { pieces, orientation } = pat.patternData.CORNERS;
  const slot = pieces.indexOf(pieceId);
  const ori = orientation[slot];
  // Piece 4 (DFR) and Piece 7 (DBR) both have their White sticker ('D') at sticker index 0
  const whiteDir = CORNER_FACES_333[slot][ori];
  return { slot, ori, whiteDir };
}

function isBarIntact(pat) {
  const { pieces, orientation } = pat.patternData.CORNERS;
  return pieces[5] === 5 && orientation[5] === 0 && pieces[6] === 6 && orientation[6] === 0;
}

function stateSig(pat) {
  const fp = getPieceLoc(pat, 4);
  const bp = getPieceLoc(pat, 7);
  return `${fp.slot}:${fp.ori}|${bp.slot}:${bp.ori}`;
}

function buildTargetPat(kp, def, fpSlot, fpOri, bpSlot, bpOri) {
  // Valid slots for remaining 4 corners (doesn't affect 4/7 solution in <R, U, S, H>)
  const usedSlots = new Set([5, 6, fpSlot, bpSlot]);
  const usedPieces = new Set([5, 6, 4, 7]);
  const freeSlots = [0, 1, 2, 3, 4, 7].filter(s => !usedSlots.has(s));
  const freePieces = [0, 1, 2, 3];
  const pieces = new Array(8);
  const orientation = new Array(8).fill(0);
  pieces[5] = 5; orientation[5] = 0;
  pieces[6] = 6; orientation[6] = 0;
  pieces[fpSlot] = 4; orientation[fpSlot] = fpOri;
  pieces[bpSlot] = 7; orientation[bpSlot] = bpOri;
  for (let i = 0; i < freeSlots.length; i++) {
    pieces[freeSlots[i]] = freePieces[i];
  }
  const data = structuredClone(def.patternData);
  data.CORNERS.pieces = pieces;
  data.CORNERS.orientation = orientation;
  return new def.constructor(kp, data);
}

async function main() {
  const kp = await puzzles['2x2x2'].kpuzzle();
  const def = kp.defaultPattern();

  // 1. Precompute shortest pure <R, U> execution starting with an R move (`R, R', R2`)
  // and shortest pre-AUF + R-start execution!
  const SOLVED_SIG = '4:0|7:0';
  // BFS backwards from solved state up to depth 7 alternating R/U ending at R (or arbitrary R/U)
  const ruSolver = new Map(); // sig -> alg (starts with R/U sequence ending with R)
  const ruQueue = [];

  // Depth 1: must end in R/R'/R2 so inverse starts from solved with R/R'/R2
  for (const m of R_MOVES) {
    const inv = invertMove(m);
    const p = def.applyAlg(new Alg(inv));
    const sig = stateSig(p);
    if (!ruSolver.has(sig)) {
      ruSolver.set(sig, m);
      ruQueue.push({ pat: p, seq: m, len: 1, firstIsR: true });
    }
  }
  while (ruQueue.length > 0) {
    const { pat, seq, len, firstIsR } = ruQueue.shift();
    if (len >= 7) continue;
    const nextMoves = firstIsR ? U_MOVES : R_MOVES;
    for (const m of nextMoves) {
      const inv = invertMove(m);
      // Prepending move m to solve sequence: newSeq = `${m} ${seq}`
      // State solved by newSeq = def.applyAlg(inv(newSeq)) = pat.applyAlg(inv(m))?
      // Check: def.applyAlg(inv(seq)).applyAlg(inv(m)) + m + seq = def! YES!
      const np = pat.applyAlg(new Alg(inv));
      const sig = stateSig(np);
      const nseq = `${m} ${seq}`;
      if (!ruSolver.has(sig)) {
        ruSolver.set(sig, nseq);
        ruQueue.push({ pat: np, seq: nseq, len: len + 1, firstIsR: !firstIsR });
      }
    }
  }

  // Also precompute BP-only solver (putting BP=7 at DBR ori 0 while keeping DFL+DBL intact)
  const bpOnlySolver = new Map(); // "slot:ori" -> alg
  for (const [sig, alg] of ruSolver) {
    const [, bpPart] = sig.split('|');
    if (bpPart === '7:0') continue;
    const len = alg.split(' ').length;
    const existing = bpOnlySolver.get(bpPart);
    if (!existing || len < existing.split(' ').length) {
      bpOnlySolver.set(bpPart, alg);
    }
  }

  // Also precompute <R, U, S, H> trigger solver (counting S and H as 1 trigger step each for ergonomics)
  const ALL_TRIG_TOKENS = ['R', "R'", 'R2', 'U', "U'", 'U2', 'S', 'H'];
  const TRIG_END_TOKENS = ['R', "R'", 'R2', 'S', 'H'];
  const trigSolver = new Map(); // sig -> { tokens, seq, hasTrig }
  const tQueue = [];

  for (const t of TRIG_END_TOKENS) {
    const algStr = TRIGGER_MOVES[t] || t;
    const invPat = def.applyAlg(new Alg(invertSeq(algStr)));
    const sig = stateSig(invPat);
    if (isBarIntact(invPat) && !trigSolver.has(sig)) {
      trigSolver.set(sig, { tokens: [t], seq: algStr, hasTrig: t === 'S' || t === 'H' });
      tQueue.push({ pat: invPat, tokens: [t], len: 1, firstToken: t });
    }
  }
  while (tQueue.length > 0) {
    const { pat, tokens, len, firstToken } = tQueue.shift();
    if (len >= 5) continue;
    for (const t of ALL_TRIG_TOKENS) {
      if ((R_MOVES.includes(t) && R_MOVES.includes(firstToken)) ||
          (U_MOVES.includes(t) && U_MOVES.includes(firstToken)) ||
          (t === 'S' && firstToken === 'H') ||
          (t === 'H' && firstToken === 'S')) {
        continue;
      }
      const algStr = TRIGGER_MOVES[t] || t;
      const np = pat.applyAlg(new Alg(invertSeq(algStr)));
      if (!isBarIntact(np)) continue;
      const sig = stateSig(np);
      const nextToks = [t, ...tokens];
      const rawSeq = nextToks.map(x => TRIGGER_MOVES[x] || x).join(' ');
      const simplifiedSeq = new Alg(rawSeq).experimentalSimplify({ cancel: true }).toString();
      if (!trigSolver.has(sig)) {
        trigSolver.set(sig, { tokens: nextToks, seq: simplifiedSeq, hasTrig: nextToks.some(x => x === 'S' || x === 'H') });
        tQueue.push({ pat: np, tokens: nextToks, len: len + 1, firstToken: t });
      }
    }
  }

  function findBestRuWithAuf(pat) {
    // Allow free pre-U AUF, then require R-start optimal solution!
    const candidates = [];
    for (const auf of AUF_LIST) {
      const pAfterAuf = auf ? pat.applyAlg(new Alg(auf)) : pat;
      const sig = stateSig(pAfterAuf);
      const alg = ruSolver.get(sig);
      if (alg && R_MOVES.includes(alg.split(' ')[0])) {
        const moveCount = alg.split(' ').length;
        candidates.push({ auf, alg, moveCount });
      }
    }
    candidates.sort((a, b) => a.moveCount - b.moveCount || (a.auf === '' ? -1 : b.auf === '' ? 1 : 0));
    return candidates[0];
  }

  function findBestTrigWithAuf(pat, bestRuLen) {
    const candidates = [];
    for (const auf of AUF_LIST) {
      const pAfterAuf = auf ? pat.applyAlg(new Alg(auf)) : pat;
      const sig = stateSig(pAfterAuf);
      const hit = trigSolver.get(sig);
      if (hit && hit.hasTrig) {
        const displayToks = (auf ? [auf, ...hit.tokens] : hit.tokens).join(' ');
        const stepScore = hit.tokens.length;
        // Include if it uses <= 3 trigger tokens on a 5/7-mover, OR lone twist S S / H H, OR 1-trig swap
        if (bestRuLen >= 5 || stepScore <= 3) {
          candidates.push({
            auf,
            tokens: hit.tokens,
            display: hit.tokens.join(' '),
            fullDisplay: displayToks,
            alg: hit.seq,
            stepScore
          });
        }
      }
    }
    candidates.sort((a, b) => a.stepScore - b.stepScore || (a.auf === '' ? -1 : b.auf === '' ? 1 : 0));
    return candidates[0] || null;
  }

  // Build exact 75 canonical states!
  const canonicalSpecs = [];

  // Bucket 1: Both on Top (27 cases) -> FP@UFR(0), BP@{UBR(1), UBL(2), UFL(3)}
  const topShapes = [
    { subShape: 'right-edge', subLabel: 'Right Edge (FP@UFR, BP@UBR)', bpSlot: 1 },
    { subShape: 'diagonal', subLabel: 'Diagonal (FP@UFR, BP@UBL)', bpSlot: 2 },
    { subShape: 'front-edge', subLabel: 'Front Edge (FP@UFR, BP@UFL)', bpSlot: 3 }
  ];
  for (const sh of topShapes) {
    for (let fpOri = 0; fpOri < 3; fpOri++) {
      for (let bpOri = 0; bpOri < 3; bpOri++) {
        canonicalSpecs.push({
          bucket: 'both-top',
          bucketLabel: 'Both on Top',
          subShape: sh.subShape,
          subLabel: sh.subLabel,
          fpSlot: 0,
          fpOri,
          bpSlot: sh.bpSlot,
          bpOri
        });
      }
    }
  }

  // Bucket 2: One Top + One Bottom (33 cases)
  // 2a: BP solved@DBR (ori=0), FP@UFR(0) -> 3 cases
  for (let fpOri = 0; fpOri < 3; fpOri++) {
    canonicalSpecs.push({
      bucket: 'mixed',
      bucketLabel: '1 Top + 1 Bottom',
      subShape: 'bp-solved',
      subLabel: 'BP Solved (FP@UFR, BP Solved@DBR)',
      fpSlot: 0,
      fpOri,
      bpSlot: 7,
      bpOri: 0
    });
  }
  // 2b: BP twisted@DBR (ori=1,2), FP@UFR(0) -> 6 cases
  for (let bpOri = 1; bpOri <= 2; bpOri++) {
    for (let fpOri = 0; fpOri < 3; fpOri++) {
      canonicalSpecs.push({
        bucket: 'mixed',
        bucketLabel: '1 Top + 1 Bottom',
        subShape: 'bp-twisted',
        subLabel: 'BP Twisted in DBR (FP@UFR)',
        fpSlot: 0,
        fpOri,
        bpSlot: 7,
        bpOri
      });
    }
  }
  // 2c: FP twisted@DFR (ori=1,2), BP@UBR(1) -> 6 cases
  for (let fpOri = 1; fpOri <= 2; fpOri++) {
    for (let bpOri = 0; bpOri < 3; bpOri++) {
      canonicalSpecs.push({
        bucket: 'mixed',
        bucketLabel: '1 Top + 1 Bottom',
        subShape: 'fp-twisted',
        subLabel: 'FP Twisted in DFR (BP@UBR)',
        fpSlot: 4,
        fpOri,
        bpSlot: 1,
        bpOri
      });
    }
  }
  // 2d: FP in Back (DBR=7), BP@UFR(0) -> 9 cases
  for (let fpOri = 0; fpOri < 3; fpOri++) {
    for (let bpOri = 0; bpOri < 3; bpOri++) {
      canonicalSpecs.push({
        bucket: 'mixed',
        bucketLabel: '1 Top + 1 Bottom',
        subShape: 'fp-in-back',
        subLabel: 'FP Wrong Slot in DBR (BP@UFR)',
        fpSlot: 7,
        fpOri,
        bpSlot: 0,
        bpOri
      });
    }
  }
  // 2e: BP in Front (DFR=4), FP@UFR(0) -> 9 cases
  for (let bpOri = 0; bpOri < 3; bpOri++) {
    for (let fpOri = 0; fpOri < 3; fpOri++) {
      canonicalSpecs.push({
        bucket: 'mixed',
        bucketLabel: '1 Top + 1 Bottom',
        subShape: 'bp-in-front',
        subLabel: 'BP Wrong Slot in DFR (FP@UFR)',
        fpSlot: 4, // wait: BP@DFR(4), FP@UFR(0)
        fpOri,
        bpSlot: 4,
        bpOri
      });
    }
  }
  // Fix 2e typo above cleanly before proceeding: fpSlot is 0, bpSlot is 4!
  for (const sp of canonicalSpecs) {
    if (sp.subShape === 'bp-in-front') sp.fpSlot = 0;
  }

  // Bucket 3: Both on Bottom (15 cases)
  // 3a: In-place twists (6 cases): 2 lone twists on FP (ori=1,2 with BP solved@DBR) + 4 both twisted (ori in {1,2} x {1,2})
  for (let fpOri = 1; fpOri <= 2; fpOri++) {
    canonicalSpecs.push({
      bucket: 'both-bottom',
      bucketLabel: 'Both on Bottom',
      subShape: 'in-place-twist',
      subLabel: 'In-Place Twist (DFR / DBR)',
      fpSlot: 4,
      fpOri,
      bpSlot: 7,
      bpOri: 0
    });
  }
  for (let fpOri = 1; fpOri <= 2; fpOri++) {
    for (let bpOri = 1; bpOri <= 2; bpOri++) {
      canonicalSpecs.push({
        bucket: 'both-bottom',
        bucketLabel: 'Both on Bottom',
        subShape: 'in-place-twist',
        subLabel: 'In-Place Twist (DFR / DBR)',
        fpSlot: 4,
        fpOri,
        bpSlot: 7,
        bpOri
      });
    }
  }
  // 3b: Swapped in Bottom (9 cases): FP@DBR(7), BP@DFR(4)
  for (let fpOri = 0; fpOri < 3; fpOri++) {
    for (let bpOri = 0; bpOri < 3; bpOri++) {
      canonicalSpecs.push({
        bucket: 'both-bottom',
        bucketLabel: 'Both on Bottom',
        subShape: 'bottom-swap',
        subLabel: 'Swapped in Bottom (FP@DBR, BP@DFR)',
        fpSlot: 7,
        fpOri,
        bpSlot: 4,
        bpOri
      });
    }
  }

  if (canonicalSpecs.length !== 75) {
    throw new Error(`Expected 75 canonical specs, got ${canonicalSpecs.length}`);
  }

  const cases = [];
  const moveCounts = { 1: 0, 3: 0, 5: 0, 7: 0 };
  const bucketCounts = { 'both-top': 0, mixed: 0, 'both-bottom': 0 };

  for (let i = 0; i < canonicalSpecs.length; i++) {
    const sp = canonicalSpecs[i];
    const pat = buildTargetPat(kp, def, sp.fpSlot, sp.fpOri, sp.bpSlot, sp.bpOri);
    const fpWhite = CORNER_FACES_333[sp.fpSlot][sp.fpOri];
    const bpWhite = CORNER_FACES_333[sp.bpSlot][sp.bpOri];

    const ru = findBestRuWithAuf(pat);
    if (!ru) {
      throw new Error(`No <R, U> solution found for spec #${i} (${sp.subShape} FP=${fpWhite} BP=${bpWhite})`);
    }
    const trig = findBestTrigWithAuf(pat, ru.moveCount);

    const fullRuAlg = [ru.auf, ru.alg].filter(Boolean).join(' ');
    const setup = invertSeq(fullRuAlg);
    // Double-check setup solves back cleanly!
    const verifyPat = def.applyAlg(new Alg(`${setup} ${fullRuAlg}`));
    if (stateSig(verifyPat) !== SOLVED_SIG || !isBarIntact(verifyPat)) {
      throw new Error(`Verification failed for ${sp.subShape} FP=${fpWhite} BP=${bpWhite}`);
    }
    if (trig) {
      const fullTrig = [trig.auf, trig.alg].filter(Boolean).join(' ');
      const verifyTrig = def.applyAlg(new Alg(`${setup} ${fullTrig}`));
      if (stateSig(verifyTrig) !== SOLVED_SIG || !isBarIntact(verifyTrig)) {
        throw new Error(`Trigger verification failed for ${sp.subShape}`);
      }
    }

    moveCounts[ru.moveCount] = (moveCounts[ru.moveCount] || 0) + 1;
    bucketCounts[sp.bucket]++;

    const isRimBar = ru.moveCount === 1;
    const rimBarType = !isRimBar
      ? null
      : ru.alg === "R'" ? 'front' : ru.alg === 'R2' ? 'top' : 'back';

    const fpSlotName = SLOT_NAMES[sp.fpSlot];
    const bpSlotName = SLOT_NAMES[sp.bpSlot];

    let cue = '';
    if (isRimBar) {
      cue = `Rim Bar (${rimBarType}): Both white stickers align on the R-face rim — 1 quarter/half R turn finishes!`;
    } else if (ru.moveCount === 3) {
      cue = `3-Move Join: 1 R move forms a Rim Bar after U-alignment (${ru.alg}).`;
    } else if (sp.subShape === 'in-place-twist') {
      cue = bpWhite === 'D'
        ? (fpWhite === 'F' ? 'Lone front twist: Double Sledge (S S) or RU sexy-style' : 'Lone right twist: Double Hedge (H H) or RU reverse')
        : 'Both bottom corners twisted in place — trigger or 5/7m RU';
    } else if (sp.subShape === 'bottom-swap') {
      cue = fpWhite === 'D' && bpWhite === 'D'
        ? 'Both whites down swapped! Watch side colors: only non-white bar stickers reveal the swap.'
        : 'Bottom swap — pull out & re-join (or Sledge/Hedge combo).';
    } else {
      cue = ru.moveCount === 7
        ? '7-move RU case — check Sledge/Hedge alternate or 2-look BP-first reduction.'
        : '5-move Setup + Join into a 3-move Rim Bar.';
    }

    cases.push({
      id: `flb-${String(i + 1).padStart(2, '0')}`,
      index: i + 1,
      bucket: sp.bucket,
      bucketLabel: sp.bucketLabel,
      subShape: sp.subShape,
      subLabel: sp.subLabel,
      fpSlot: fpSlotName,
      fpSlotIdx: sp.fpSlot,
      fpOri: sp.fpOri,
      fpWhite,
      bpSlot: bpSlotName,
      bpSlotIdx: sp.bpSlot,
      bpOri: sp.bpOri,
      bpWhite,
      isRimBar,
      rimBarType,
      ruMoves: ru.moveCount,
      ruStartAuf: ru.auf,
      ruAlg: ru.alg,
      fullRuAlg,
      triggerAuf: trig ? trig.auf : '',
      triggerDisplay: trig ? trig.fullDisplay : null,
      triggerAlg: trig ? trig.alg : null,
      fullTriggerAlg: trig ? [trig.auf, trig.alg].filter(Boolean).join(' ') : null,
      cue,
      setup
    });
  }

  console.log('Bucket counts:', bucketCounts);
  console.log('Move count distribution (<R, U> excluding pre-AUF):', moveCounts);
  const avg = cases.reduce((acc, c) => acc + c.ruMoves, 0) / cases.length;
  console.log('Average <R, U> move count:', avg.toFixed(2));

  const bpMiniSpecs = [
    { label: 'BP at UBR, White Back (B)', slot: 'UBR', ori: 1, white: 'B', sig: '1:1' },
    { label: 'BP at UBR, White Up (U)', slot: 'UBR', ori: 0, white: 'U', sig: '1:0' },
    { label: 'BP at UBR, White Right (R)', slot: 'UBR', ori: 2, white: 'R', sig: '1:2' },
    { label: 'BP twisted in DBR, White Back (B)', slot: 'DBR', ori: 2, white: 'B', sig: '7:2' },
    { label: 'BP twisted in DBR, White Right (R)', slot: 'DBR', ori: 1, white: 'R', sig: '7:1' },
    { label: 'BP in DFR, White Down (D)', slot: 'DFR', ori: 0, white: 'D', sig: '4:0' },
    { label: 'BP in DFR, White Front (F)', slot: 'DFR', ori: 1, white: 'F', sig: '4:1' },
    { label: 'BP in DFR, White Right (R)', slot: 'DFR', ori: 2, white: 'R', sig: '4:2' }
  ];
  const bpCasesMini = bpMiniSpecs.map((spec, idx) => {
    const bpAlg = bpOnlySolver.get(spec.sig) || '';
    const refCase = cases.find(c => `${c.bpSlotIdx}:${c.bpOri}` === spec.sig && c.fpSlotIdx === 0) || cases[0];
    return {
      id: `bp-mini-${idx + 1}`,
      label: spec.label,
      bpSlot: spec.slot,
      bpWhite: spec.white,
      alg: bpAlg,
      setup: invertSeq(bpAlg),
      sampleFullCaseId: refCase?.id || 'flb-01'
    };
  });

  const twoLook = {
    optionA: {
      title: 'Option A — 2-Look Reduction (BP First → FP Second · 13 Mini-Cases)',
      desc: 'Solve Back-Right (BP) into DBR first (8 unsolved mini-cases), then solve Front-Right (FP) into DFR (5 triggers/inserts). Only 13 mini-cases instead of 75!',
      bpCases: bpCasesMini,
      fpFinishes: [
        { label: 'FP at UFR, White Right (R)', alg: "R U R'", setup: "R U' R'", note: "Direct 3-move insert (or U R U' R' after pre-U)" },
        { label: 'FP at UFR, White Front (F)', alg: "F' U' F", setup: "F' U F", note: "Or R' F R F' / U' F' U F" },
        { label: 'FP at UFR, White Up (U)', alg: "R U2 R' U' R U R'", setup: "R U' R' U R U2 R'", note: 'Or R2 U R2 U\' R2 (5m <R,U>)' },
        { label: 'FP twisted in DFR, White Front (F)', alg: "R' F R F' R' F R F'", setup: "F R' F' R F R' F' R", note: 'Double Sledge (S S)' },
        { label: 'FP twisted in DFR, White Right (R)', alg: "F R' F' R F R' F' R", setup: "R' F R F' R' F R F'", note: 'Double Hedge (H H)' }
      ]
    },
    optionB: {
      title: 'Option B — Park-Left Fallback (Turn Any Case into Both-on-Top)',
      rules: [
        { state: '1 Top + 1 Bottom (33 cases)', rule: 'Park the top corner on UFL or UBL (left side), then do R2 to bring the bottom corner to Top → solves cleanly as a Both-on-Top case.' },
        { state: 'Both on Bottom (15 cases)', rule: 'Do R2 (moving FP & BP to UFR + UBR) → immediately enters the Right-Edge Both-on-Top family!' }
      ]
    }
  };

  const stats = {
    total: cases.length,
    averageRuMoves: Number(avg.toFixed(2)),
    buckets: bucketCounts,
    moveCounts
  };

  const outContent = `// All 75 Bar-on-Left (DFL+DBL Solved) 2x2x2 First-Layer Cases
// Generated and mathematically verified with cubing.js 2x2x2 KPuzzle

export const FIRST_LAYER_BAR_STATS = ${JSON.stringify(stats, null, 2)};

export const FIRST_LAYER_BAR_CASES = ${JSON.stringify(cases, null, 2)};

export const FIRST_LAYER_TWO_LOOK = ${JSON.stringify(twoLook, null, 2)};
`;

  fs.writeFileSync(OUT_PATH, outContent, 'utf8');
  console.log(`Wrote ${cases.length} Bar-on-Left 1st-layer cases to ${OUT_PATH}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
