// Generator & verifier for all non-bar 1st-layer bottom-piece cases + 3-in-bottom partition:
//   - 1 in Bottom (9 canonical cases: strictly 1 white face on bottom at DBL; solve Bar partner DFL into DFL in <R, U, F>)
//   - 2 Bottom: Diagonal (39 canonical cases: anchor DBL+DFR, solve DFL+DBR in <R, U, F>)
//   - 3 in Bottom (5 canonical cases partitioned from FIRST_LAYER_BAR_CASES where DFL+DBL+DBR solved)
//   - 2 Bottom: Bar (70 remaining cases of FIRST_LAYER_BAR_CASES)
// Run with: node scripts/generators/generate-first-layer-bottom.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { puzzles } from 'cubing/puzzles';
import { Alg } from 'cubing/alg';
import { CORNER_FACES_333 } from '../../src/cube/cubeUtils.js';
import { checkFirstLayerSolved } from '../../src/cube/firstLayerVerifier.js';
import { cleanAlg } from '../../src/algParser.js';
import { FIRST_LAYER_BAR_CASES } from '../../src/data/firstLayerBarData.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.resolve(__dirname, '../../src/data/firstLayerBottomData.js');

const SLOT_NAMES = ['UFR', 'UBR', 'UBL', 'UFL', 'DFR', 'DFL', 'DBL', 'DBR'];
const RUF_MOVES = ['R', "R'", 'R2', 'U', "U'", 'U2', 'F', "F'", 'F2'];

function whiteDirAt(slot, ori) {
  return CORNER_FACES_333[slot][ori];
}

function sameFace(m1, m2) {
  return Boolean(m1 && m2 && m1[0] === m2[0]);
}

function invertMove(m) {
  if (m.endsWith('2')) return m;
  return m.endsWith("'") ? m[0] : `${m}'`;
}

function scoreAlg(moves) {
  const fCount = moves.filter(m => m[0] === 'F').length;
  const r2Count = moves.filter(m => m === 'R2' || m === 'F2').length;
  const startsWithU = moves[0]?.[0] === 'U' ? 1 : 0;
  return [moves.length, fCount, r2Count, startsWithU];
}

function compareScores(a, b) {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) - (b[i] ?? 0);
  }
  return 0;
}

function build1BottomSubLabel(slotIdx) {
  if (slotIdx === 3) return 'Top Layer (UFL)';
  if (slotIdx === 5) return 'Twisted in DFL';
  if (slotIdx === 4) return 'Side of DFR';
  return 'Side of DBR';
}

function build1BottomSubShape(slotIdx) {
  if (slotIdx === 3) return 'top-u';
  if (slotIdx === 5) return 'dfl-twisted';
  if (slotIdx === 4) return 'in-dfr';
  return 'in-dbr';
}

function buildDiagSubInfo(flIdx, brIdx) {
  const flTop = flIdx < 4;
  const brTop = brIdx < 4;
  if (flTop && brTop) {
    const isDiag = Math.abs(flIdx - brIdx) === 2;
    return isDiag
      ? { subShape: 'diag-top', subLabel: `Both Top Diag (${SLOT_NAMES[flIdx]} + ${SLOT_NAMES[brIdx]})` }
      : { subShape: 'adj-top', subLabel: `Both Top Adj (${SLOT_NAMES[flIdx]} + ${SLOT_NAMES[brIdx]})` };
  }
  if (!flTop && !brTop) {
    const swapped = flIdx === 7 || brIdx === 5;
    return swapped
      ? { subShape: 'bottom-swap', subLabel: `Bottom Swap (${SLOT_NAMES[flIdx]} + ${SLOT_NAMES[brIdx]})` }
      : { subShape: 'in-place-twist', subLabel: `In-Place Twist (${SLOT_NAMES[flIdx]} + ${SLOT_NAMES[brIdx]})` };
  }
  const bottomIdx = flTop ? brIdx : flIdx;
  const expectedBottomIdx = flTop ? 7 : 5;
  return bottomIdx === expectedBottomIdx
    ? { subShape: 'one-twisted', subLabel: `1 Top + 1 Twisted (${SLOT_NAMES[flIdx]} + ${SLOT_NAMES[brIdx]})` }
    : { subShape: 'one-wrong', subLabel: `1 Top + 1 Wrong Slot (${SLOT_NAMES[flIdx]} + ${SLOT_NAMES[brIdx]})` };
}

async function main() {
  const kp = await puzzles['2x2x2'].kpuzzle();
  const def = kp.defaultPattern();
  const moveTrans = RUF_MOVES.map(m => ({ m, t: kp.algToTransformation(m) }));

  const uPieces = Array.from(def.applyAlg('U').patternData.CORNERS.pieces);
  const uSlotOf = {};
  for (let s = 0; s < 8; s++) uSlotOf[uPieces[s]] = s;

  const y2Pieces = Array.from(def.applyAlg('y2').patternData.CORNERS.pieces);
  const y2SlotOf = {};
  for (let s = 0; s < 8; s++) y2SlotOf[y2Pieces[s]] = s;

  // Precompute all 24 3D cube rotations to enforce strict rotational/U disjointness
  const rotGens = ['x', 'y', 'z'].map(m => kp.algToTransformation(m));
  const rotMap = new Map();
  const qRot = [kp.identityTransformation()];
  rotMap.set(JSON.stringify(kp.identityTransformation().transformationData.CORNERS), kp.identityTransformation());
  while (qRot.length) {
    const t = qRot.shift();
    for (const g of rotGens) {
      const nt = t.applyTransformation(g);
      const k = JSON.stringify(nt.transformationData.CORNERS);
      if (!rotMap.has(k)) {
        rotMap.set(k, nt);
        qRot.push(nt);
      }
    }
  }
  const all24Rots = Array.from(rotMap.values());

  function maxRelativeSolvedWhitePairs(pat) {
    const { pieces, orientation } = pat.patternData.CORNERS;
    let best = 0;
    for (const r of all24Rots) {
      const rp = def.applyTransformation(r).patternData.CORNERS;
      let match = 0;
      for (const w of [4, 5, 6, 7]) {
        const sPat = pieces.indexOf(w);
        const sRot = rp.pieces.indexOf(w);
        if (sPat === sRot && orientation[sPat] === rp.orientation[sRot]) match++;
      }
      if (match > best) best = match;
    }
    return best;
  }

  function whiteFaceCounts(pat) {
    const { pieces, orientation } = pat.patternData.CORNERS;
    const cnt = { U: 0, D: 0, F: 0, B: 0, L: 0, R: 0 };
    for (const w of [4, 5, 6, 7]) {
      const s = pieces.indexOf(w);
      cnt[CORNER_FACES_333[s][orientation[s]]]++;
    }
    return cnt;
  }

  // Collect reachable <R, U> DFR/DBR states (preserving DFL + DBL solved) so 1-in-Bottom setups have strictly 1 white face on D
  const ruMoves = ['R', "R'", 'R2', 'U', "U'", 'U2'].map(m => ({ m, t: kp.algToTransformation(m) }));
  const seenRU = new Map();
  const qRU = [{ pat: def, seq: [] }];
  const ruStates = [];
  while (qRU.length) {
    const cur = qRU.shift();
    const { pieces, orientation } = cur.pat.patternData.CORNERS;
    const p4 = pieces.indexOf(4);
    const p7 = pieces.indexOf(7);
    const key = `${p4}:${orientation[p4]},${p7}:${orientation[p7]}`;
    if (!seenRU.has(key)) {
      seenRU.set(key, cur);
      ruStates.push(cur);
      if (cur.seq.length < 7) {
        const last = cur.seq[cur.seq.length - 1] || '';
        for (const { m, t } of ruMoves) {
          if (sameFace(last, m)) continue;
          qRU.push({ pat: cur.pat.applyTransformation(t), seq: [...cur.seq, m] });
        }
      }
    }
  }

  // =========================================================================
  // 1. Generate 9 canonical "1 in Bottom (strictly 1 white face on D at DBL -> Build Left Bar)"
  // =========================================================================
  const oneAllByTarget = new Map();
  const q1All = [{ pat: def, seq: [] }];
  const oneVisited = new Map([['5:0|', 0]]);

  while (q1All.length) {
    const cur = q1All.shift();
    const { pieces, orientation } = cur.pat.patternData.CORNERS;
    const s5 = pieces.indexOf(5);
    const sig = `${s5}:${orientation[s5]}`;
    const sol = cur.seq.slice().reverse().map(invertMove);
    if (cur.seq.length > 0) {
      if (!oneAllByTarget.has(sig)) oneAllByTarget.set(sig, []);
      oneAllByTarget.get(sig).push(sol);
    }
    if (cur.seq.length >= 4) continue;
    const lastMove = cur.seq[cur.seq.length - 1] || '';
    for (const { m, t } of moveTrans) {
      if (sameFace(lastMove, m)) continue;
      const nxt = cur.pat.applyTransformation(t);
      const np = nxt.patternData.CORNERS.pieces;
      const no = nxt.patternData.CORNERS.orientation;
      if (np[6] !== 6 || no[6] !== 0) continue; // Keep DBL solved!
      const ns = np.indexOf(5);
      const vKey = `${ns}:${no[ns]}|${m[0]}`;
      const nextDepth = cur.seq.length + 1;
      const bestLen = oneVisited.get(vKey);
      if (bestLen !== undefined && bestLen < nextDepth) continue;
      oneVisited.set(vKey, nextDepth);
      q1All.push({ pat: nxt, seq: [...cur.seq, m] });
    }
  }

  // Strictly 1 white sticker on Bottom (exclude [4,0] and [7,0], which place a second white sticker on D)
  const oneCanonicalTargets = [
    [3, 0], [3, 1], [3, 2],
    [5, 1], [5, 2],
    [4, 1], [4, 2],
    [7, 1], [7, 2]
  ];

  function solveRU(patAfterBar) {
    const q = [{ pat: patAfterBar, seq: [] }];
    const seen = new Set();
    while (q.length) {
      const cur = q.shift();
      const { pieces, orientation } = cur.pat.patternData.CORNERS;
      if ([4, 5, 6, 7].every(s => pieces[s] === s && orientation[s] === 0)) {
        return cleanAlg(cur.seq.join(' ')).replace(/2'/g, '2');
      }
      if (cur.seq.length >= 7) continue;
      const p4 = pieces.indexOf(4);
      const p7 = pieces.indexOf(7);
      const key = `${p4}:${orientation[p4]},${p7}:${orientation[p7]}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const last = cur.seq[cur.seq.length - 1] || '';
      for (const { m, t } of ruMoves) {
        if (sameFace(last, m)) continue;
        q.push({ pat: cur.pat.applyTransformation(t), seq: [...cur.seq, m] });
      }
    }
    return null;
  }

  const oneBottomCases = oneCanonicalTargets.map(([slotIdx, ori], i) => {
    const sig = `${slotIdx}:${ori}`;
    const candidates = (oneAllByTarget.get(sig) || []).slice().sort((a, b) => compareScores(scoreAlg(a), scoreAlg(b)));
    if (!candidates.length) throw new Error(`Missing 1-bottom solution for ${sig}`);

    const bestMoves = candidates[0];
    const barAlg = cleanAlg(bestMoves.join(' ')).replace(/2'/g, '2');
    const invFull = cleanAlg(new Alg(barAlg).invert().toString()).replace(/2'/g, '2');

    let bestSetup = null;
    for (const st of ruStates) {
      const patSetup = st.pat.applyAlg(invFull);
      const sp = patSetup.patternData.CORNERS.pieces;
      const so = patSetup.patternData.CORNERS.orientation;
      if (sp[6] !== 6 || so[6] !== 0 || sp[slotIdx] !== 5 || so[slotIdx] !== ori) continue;

      const fc = whiteFaceCounts(patSetup);
      if (fc.D !== 1 || Math.max(...Object.values(fc)) !== 1) continue;
      if (maxRelativeSolvedWhitePairs(patSetup) !== 1) continue;

      let badU = false;
      for (const um of ['U', "U'", 'U2']) {
        const pu = patSetup.applyAlg(um);
        if (whiteFaceCounts(pu).D !== 1 || maxRelativeSolvedWhitePairs(pu) !== 1) {
          badU = true;
          break;
        }
      }
      if (badU) continue;

      const patAfter = patSetup.applyAlg(barAlg);
      const ap = patAfter.patternData.CORNERS.pieces;
      const ao = patAfter.patternData.CORNERS.orientation;
      if (ap[5] !== 5 || ao[5] !== 0 || ap[6] !== 6 || ao[6] !== 0) continue;
      if (whiteFaceCounts(patAfter).D !== 2 || maxRelativeSolvedWhitePairs(patAfter) !== 2) continue;

      const rawSetup = [...st.seq, ...invFull.split(' ').filter(Boolean)].join(' ');
      const simplified = cleanAlg(
        new Alg(rawSetup).experimentalSimplify({ cancel: true, puzzleLoader: puzzles['2x2x2'] }).toString()
      ).replace(/2'/g, '2');
      const setupLen = simplified.split(' ').filter(Boolean).length;
      if (!bestSetup || setupLen < bestSetup.len) {
        bestSetup = { setup: simplified, len: setupLen, patSetup };
      }
    }

    if (!bestSetup) {
      throw new Error(`No strictly-1-white-on-bottom setup found for ${sig}`);
    }

    const setup = bestSetup.setup;
    const patSetup = def.applyAlg(setup);
    const sp = patSetup.patternData.CORNERS.pieces;
    const so = patSetup.patternData.CORNERS.orientation;
    if (
      sp[6] !== 6 || so[6] !== 0 ||
      sp[slotIdx] !== 5 || so[slotIdx] !== ori ||
      whiteFaceCounts(patSetup).D !== 1 ||
      maxRelativeSolvedWhitePairs(patSetup) !== 1
    ) {
      throw new Error(`1-bottom strict verification failed for ${sig}`);
    }

    const patAfterBar = def.applyAlg(`${setup} ${barAlg}`);
    if (
      patAfterBar.patternData.CORNERS.pieces[5] !== 5 ||
      patAfterBar.patternData.CORNERS.orientation[5] !== 0 ||
      patAfterBar.patternData.CORNERS.pieces[6] !== 6 ||
      patAfterBar.patternData.CORNERS.orientation[6] !== 0
    ) {
      throw new Error(`1-bottom bar step failed for ${sig}`);
    }

    const finishAlg = solveRU(patAfterBar);
    if (!finishAlg) {
      throw new Error(`No <R, U> finish found after barAlg for ${sig}`);
    }
    const fullAlg = cleanAlg(
      new Alg(`${barAlg} ${finishAlg}`).experimentalSimplify({ cancel: true, puzzleLoader: puzzles['2x2x2'] }).toString()
    ).replace(/2'/g, '2');
    const fullTokens = fullAlg.split(' ').filter(Boolean);
    const startAuf = fullTokens[0]?.[0] === 'U' ? fullTokens[0] : '';
    const alg = cleanAlg((startAuf ? fullTokens.slice(1) : fullTokens).join(' ')).replace(/2'/g, '2');

    if (
      !checkFirstLayerSolved(def.applyAlg(`z2 ${setup} ${fullAlg}`), { isZ2: true, requireExactAlignment: true }).ok ||
      !checkFirstLayerSolved(def.applyAlg(`${setup} ${fullAlg}`), { isZ2: false, requireExactAlignment: true }).ok
    ) {
      throw new Error(`1-bottom complete 1st-layer sticker verification failed for ${sig}: setup="${setup}" fullAlg="${fullAlg}"`);
    }

    const other1SlotIdx = sp.indexOf(4);
    const other1Ori = so[other1SlotIdx];
    const other2SlotIdx = sp.indexOf(7);
    const other2Ori = so[other2SlotIdx];

    const whiteDir = whiteDirAt(slotIdx, ori);
    const inTop = slotIdx < 4;
    const mvCount = fullTokens.length;
    const idxNum = i + 1;
    const cue = `Step 1 (${barAlg}): build Left Bar (DFL+DBL) → Step 2 (${finishAlg}): finish 1st Layer.`;

    return {
      id: `fl1-${String(idxNum).padStart(2, '0')}`,
      index: idxNum,
      group: 'one-bottom',
      bucket: inTop ? 'in-top' : 'in-bottom',
      bucketLabel: inTop ? 'Partner in Top (U)' : 'Partner on Bottom Side',
      subShape: build1BottomSubShape(slotIdx),
      subLabel: build1BottomSubLabel(slotIdx),
      partnerSlot: SLOT_NAMES[slotIdx],
      partnerSlotIdx: slotIdx,
      partnerOri: ori,
      partnerWhite: whiteDir,
      other1Slot: SLOT_NAMES[other1SlotIdx],
      other1SlotIdx,
      other1Ori,
      other1White: whiteDirAt(other1SlotIdx, other1Ori),
      other2Slot: SLOT_NAMES[other2SlotIdx],
      other2SlotIdx,
      other2Ori,
      other2White: whiteDirAt(other2SlotIdx, other2Ori),
      barAlg,
      finishAlg,
      moveCount: mvCount,
      coreMoves: alg.split(' ').filter(Boolean).length,
      startAuf,
      alg,
      fullAlg,
      setup,
      cue
    };
  });

  // =========================================================================
  // 2. Generate all 39 canonical "2 Bottom: Diagonal (DBL + DFR Solved)" cases
  // =========================================================================
  function diagSig(pat) {
    const { pieces, orientation } = pat.patternData.CORNERS;
    if (pieces[4] !== 4 || orientation[4] !== 0 || pieces[6] !== 6 || orientation[6] !== 0) return null;
    const s5 = pieces.indexOf(5);
    const s7 = pieces.indexOf(7);
    return `${s5}:${orientation[s5]},${s7}:${orientation[s7]}`;
  }

  const diagMap = new Map(); // sig -> { minLen, candidates: string[][] }
  diagMap.set('5:0,7:0', { minLen: 0, candidates: [[]] });
  const seenFullDiag = new Map([['4:0|5:0|6:0|7:0|', 0]]);
  const qDiag = [{ pat: def, seq: [] }];

  while (qDiag.length) {
    const cur = qDiag.shift();
    if (cur.seq.length >= 6) continue;
    const lastMove = cur.seq[cur.seq.length - 1] || '';

    for (const { m, t } of moveTrans) {
      if (sameFace(lastMove, m)) continue;
      const nxt = cur.pat.applyTransformation(t);
      const { pieces, orientation } = nxt.patternData.CORNERS;
      const nxtSeq = [...cur.seq, m];

      const sig = diagSig(nxt);
      if (sig) {
        const invSol = nxtSeq.slice().reverse().map(invertMove);
        const existing = diagMap.get(sig);
        if (!existing) {
          diagMap.set(sig, { minLen: nxtSeq.length, candidates: [invSol] });
        } else if (nxtSeq.length === existing.minLen && existing.candidates.length < 8) {
          existing.candidates.push(invSol);
        }
      }

      const p4 = pieces.indexOf(4);
      const p5 = pieces.indexOf(5);
      const p6 = pieces.indexOf(6);
      const p7 = pieces.indexOf(7);
      const fullKey = `${p4}:${orientation[p4]}|${p5}:${orientation[p5]}|${p6}:${orientation[p6]}|${p7}:${orientation[p7]}|${m[0]}`;
      const prevLen = seenFullDiag.get(fullKey);
      if (prevLen !== undefined && prevLen < nxtSeq.length) continue;
      // Keep BFS bounded on ties for speed
      if (prevLen === nxtSeq.length && nxtSeq.length >= 5) continue;
      seenFullDiag.set(fullKey, nxtSeq.length);
      qDiag.push({ pat: nxt, seq: nxtSeq });
    }
  }

  const slots = [0, 1, 2, 3, 5, 7];
  const seenDiagOrbits = new Set();
  const diagRaw = [];

  for (const s5 of slots) {
    for (const o5 of [0, 1, 2]) {
      for (const s7 of slots) {
        if (s7 === s5) continue;
        for (const o7 of [0, 1, 2]) {
          // Exclude 3-in-bottom & 4-solved
          if ((s5 === 5 && o5 === 0) || (s7 === 7 && o7 === 0)) continue;

          // Build U + y2 symmetry orbit
          const orbitStates = [];
          let a = s5;
          let b = s7;
          for (let k = 0; k < 4; k++) {
            orbitStates.push([a, o5, b, o7]);
            a = uSlotOf[a];
            b = uSlotOf[b];
          }
          a = y2SlotOf[s7];
          b = y2SlotOf[s5];
          for (let k = 0; k < 4; k++) {
            orbitStates.push([a, o7, b, o5]);
            a = uSlotOf[a];
            b = uSlotOf[b];
          }

          const orbitKey = orbitStates.map(([x, ox, y, oy]) => `${x}:${ox},${y}:${oy}`).sort()[0];
          if (seenDiagOrbits.has(orbitKey)) continue;
          seenDiagOrbits.add(orbitKey);

          // Among all members of this U + y2 orbit, pick the one with the most ergonomic <R, U, F> solution!
          let bestChoice = null;
          for (const [m5, mo5, m7, mo7] of orbitStates) {
            const sig = `${m5}:${mo5},${m7}:${mo7}`;
            const entry = diagMap.get(sig);
            if (!entry) continue;
            for (const cand of entry.candidates) {
              const sc = scoreAlg(cand);
              // Gentle tie-breaker preferring UFL/DFR/DFL visibility on equal move scores
              const visTie = (m5 === 3 ? 0 : 1) + (m5 === 5 ? 0 : 1);
              const fullScore = [...sc, visTie, m5, mo5, m7, mo7];
              if (!bestChoice || compareScores(fullScore, bestChoice.score) < 0) {
                bestChoice = { m5, mo5, m7, mo7, cand, score: fullScore };
              }
            }
          }

          if (!bestChoice) {
            throw new Error(`No <R, U, F> solution found for 2-diag orbit ${orbitKey}`);
          }

          const { m5, mo5, m7, mo7, cand } = bestChoice;
          const startAuf = cand[0]?.[0] === 'U' ? cand[0] : '';
          const algMoves = startAuf ? cand.slice(1) : cand;
          const alg = cleanAlg(algMoves.join(' ')).replace(/2'/g, '2');
          const fullAlg = cleanAlg(cand.join(' ')).replace(/2'/g, '2');
          const setup = cleanAlg(new Alg(fullAlg).invert().toString()).replace(/2'/g, '2');

          // Verify setup & solve mathematically on 2x2x2 KPuzzle
          const patSetup = def.applyAlg(setup);
          const sp = patSetup.patternData.CORNERS.pieces;
          const so = patSetup.patternData.CORNERS.orientation;
          if (
            sp[4] !== 4 || so[4] !== 0 ||
            sp[6] !== 6 || so[6] !== 0 ||
            sp[m5] !== 5 || so[m5] !== mo5 ||
            sp[m7] !== 7 || so[m7] !== mo7
          ) {
            throw new Error(`2-diag setup verification failed for ${orbitKey}`);
          }
          const patSolved = def.applyAlg(`${setup} ${fullAlg}`);
          const fp = patSolved.patternData.CORNERS.pieces;
          const fo = patSolved.patternData.CORNERS.orientation;
          if (
            [4, 5, 6, 7].some(s => fp[s] !== s || fo[s] !== 0) ||
            !checkFirstLayerSolved(patSolved, { isZ2: false, requireExactAlignment: true }).ok ||
            !checkFirstLayerSolved(def.applyAlg(`z2 ${setup} ${fullAlg}`), { isZ2: true, requireExactAlignment: true }).ok
          ) {
            throw new Error(`2-diag solve verification failed for ${orbitKey}`);
          }

          const inDCount = (m5 >= 4 ? 1 : 0) + (m7 >= 4 ? 1 : 0);
          const bucket = inDCount === 0 ? 'both-top' : inDCount === 1 ? 'mixed' : 'both-bottom';
          const bucketLabel = inDCount === 0 ? 'Both on Top' : inDCount === 1 ? '1 Top + 1 Bottom' : 'Both on Bottom';
          const subInfo = buildDiagSubInfo(m5, m7);
          const flWhite = whiteDirAt(m5, mo5);
          const brWhite = whiteDirAt(m7, mo7);
          const mvCount = fullAlg.split(' ').filter(Boolean).length;

          diagRaw.push({
            bucket,
            bucketOrder: inDCount,
            bucketLabel,
            subShape: subInfo.subShape,
            subLabel: subInfo.subLabel,
            flSlot: SLOT_NAMES[m5],
            flSlotIdx: m5,
            flOri: mo5,
            flWhite,
            brSlot: SLOT_NAMES[m7],
            brSlotIdx: m7,
            brOri: mo7,
            brWhite,
            moveCount: mvCount,
            coreMoves: alg.split(' ').filter(Boolean).length,
            startAuf,
            alg,
            fullAlg,
            setup,
            cue: `Anchor diagonal DBL + DFR solved; resolve DFL (${SLOT_NAMES[m5]}/${flWhite}) & DBR (${SLOT_NAMES[m7]}/${brWhite}) in ${mvCount} <R,U,F> moves.`
          });
        }
      }
    }
  }

  diagRaw.sort((a, b) =>
    a.bucketOrder - b.bucketOrder ||
    a.moveCount - b.moveCount ||
    a.flSlotIdx - b.flSlotIdx ||
    a.flOri - b.flOri ||
    a.brSlotIdx - b.brSlotIdx ||
    a.brOri - b.brOri
  );

  const diagCases = diagRaw.map((item, idx) => {
    const { bucketOrder: _bo, ...rest } = item;
    return {
      id: `fld-${String(idx + 1).padStart(2, '0')}`,
      index: idx + 1,
      group: 'two-diag',
      ...rest
    };
  });

  // =========================================================================
  // 3. Partition existing 75 Bar-on-Left into 70 Pure-Bar (2 in bottom) + 5 Three-in-Bottom
  // =========================================================================
  const threeBottomIds = FIRST_LAYER_BAR_CASES
    .filter(c => c.bpSlot === 'DBR' && c.bpOri === 0)
    .map(c => c.id);
  const barPureIds = FIRST_LAYER_BAR_CASES
    .filter(c => !(c.bpSlot === 'DBR' && c.bpOri === 0))
    .map(c => c.id);

  if (oneBottomCases.length !== 9 || diagCases.length !== 39 || threeBottomIds.length !== 5 || barPureIds.length !== 70) {
    throw new Error(`Count mismatch: 1B=${oneBottomCases.length}, diag=${diagCases.length}, 3B=${threeBottomIds.length}, 2Bar=${barPureIds.length}`);
  }

  const stats = {
    oneBottom: {
      total: oneBottomCases.length,
      buckets: {
        'in-top': oneBottomCases.filter(c => c.bucket === 'in-top').length,
        'in-bottom': oneBottomCases.filter(c => c.bucket === 'in-bottom').length
      }
    },
    twoBar: { total: barPureIds.length },
    twoDiag: {
      total: diagCases.length,
      buckets: {
        'both-top': diagCases.filter(c => c.bucket === 'both-top').length,
        mixed: diagCases.filter(c => c.bucket === 'mixed').length,
        'both-bottom': diagCases.filter(c => c.bucket === 'both-bottom').length
      },
      moveCounts: Object.fromEntries(
        [3, 4, 5, 6].map(n => [String(n), diagCases.filter(c => c.moveCount === n).length])
      )
    },
    threeBottom: { total: threeBottomIds.length }
  };

  const fileContent = `// Complete 1st-Layer Bottom-Piece Cases (1-in-Bottom, 2-Bottom Bar, 2-Bottom Diagonal, 3-in-Bottom)
// Generated and mathematically verified against cubing.js 2x2x2 KPuzzle
// (All 4 bottom corners solved = CLL — see the CLL track!)

import { FIRST_LAYER_BAR_CASES } from './firstLayerBarData.js';

export const FIRST_LAYER_BOTTOM_STATS = ${JSON.stringify(stats, null, 2)};

export const FIRST_LAYER_ONE_BOTTOM_CASES = ${JSON.stringify(oneBottomCases, null, 2)};

export const FIRST_LAYER_DIAG_CASES = ${JSON.stringify(diagCases, null, 2)};

const THREE_BOTTOM_ID_SET = new Set(${JSON.stringify(threeBottomIds)});

export const FIRST_LAYER_THREE_BOTTOM_CASES = FIRST_LAYER_BAR_CASES
  .filter(c => THREE_BOTTOM_ID_SET.has(c.id))
  .map((c, idx) => ({
    ...c,
    group: 'three-bottom',
    threeIndex: idx + 1
  }));

export const FIRST_LAYER_BAR_PURE_CASES = FIRST_LAYER_BAR_CASES
  .filter(c => !THREE_BOTTOM_ID_SET.has(c.id))
  .map(c => ({
    ...c,
    group: 'two-bar'
  }));
`;

  fs.writeFileSync(OUT_PATH, fileContent, 'utf8');
  console.log('Generated:', OUT_PATH);
  console.log('Stats:', JSON.stringify(stats, null, 2));
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
