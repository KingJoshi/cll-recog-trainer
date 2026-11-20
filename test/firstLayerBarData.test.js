import test from 'node:test';
import assert from 'node:assert';
import { Alg } from 'cubing/alg';
import { puzzles } from 'cubing/puzzles';
import {
  FIRST_LAYER_BAR_CASES,
  FIRST_LAYER_BAR_STATS,
  FIRST_LAYER_TWO_LOOK
} from '../src/data/firstLayerBarData.js';
import {
  FIRST_LAYER_ONE_BOTTOM_CASES,
  FIRST_LAYER_DIAG_CASES,
  FIRST_LAYER_THREE_BOTTOM_CASES,
  FIRST_LAYER_BAR_PURE_CASES,
  FIRST_LAYER_BOTTOM_STATS
} from '../src/data/firstLayerBottomData.js';
import { renderFirstLayer3dSvg, resolveFirstLayerCornerState } from '../src/cube/firstLayer3dSvg.js';
import { CORNER_FACES_333 } from '../src/cube/cubeUtils.js';
import {
  checkBottomFaceAllWhite,
  checkBottomRowSolved,
  checkFirstLayerSolved,
  auditAllFirstLayerAlgs
} from '../src/cube/firstLayerVerifier.js';
import { FIRST_FACE_EXAMPLES } from '../src/features/study/firstLayerExplorer.js';

test('FIRST_LAYER_BAR_CASES has exact 75 canonical cases and expected distribution', () => {
  assert.strictEqual(FIRST_LAYER_BAR_CASES.length, 75);
  assert.strictEqual(FIRST_LAYER_BAR_STATS.total, 75);
  assert.strictEqual(FIRST_LAYER_BAR_STATS.averageRuMoves, 4.65);
  assert.deepStrictEqual(FIRST_LAYER_BAR_STATS.buckets, {
    'both-top': 27,
    mixed: 33,
    'both-bottom': 15
  });
  assert.deepStrictEqual(FIRST_LAYER_BAR_STATS.moveCounts, {
    '1': 3,
    '3': 18,
    '5': 43,
    '7': 11
  });

  const rimBars = FIRST_LAYER_BAR_CASES.filter(c => c.isRimBar);
  assert.strictEqual(rimBars.length, 3);
  assert.deepStrictEqual(rimBars.map(c => c.rimBarType).sort(), ['back', 'front', 'top']);
});

test('All 75 Bar-on-Left 1st-layer <R, U> and trigger solutions solve DFR+DBR while preserving DFL+DBL', async () => {
  const kp2 = await puzzles['2x2x2'].kpuzzle();
  const def2 = kp2.defaultPattern();

  for (const c of FIRST_LAYER_BAR_CASES) {
    assert.doesNotThrow(() => new Alg(c.setup), `Setup for ${c.id} must parse`);
    assert.doesNotThrow(() => new Alg(c.fullRuAlg), `RU alg for ${c.id} must parse`);

    const setupPat = def2.applyAlg(new Alg(c.setup));
    const sp = setupPat.patternData.CORNERS.pieces;
    const so = setupPat.patternData.CORNERS.orientation;
    assert.strictEqual(sp[5], 5, `${c.id} setup must keep DFL solved`);
    assert.strictEqual(so[5], 0, `${c.id} setup must keep DFL oriented`);
    assert.strictEqual(sp[6], 6, `${c.id} setup must keep DBL solved`);
    assert.strictEqual(so[6], 0, `${c.id} setup must keep DBL oriented`);

    const patRu = def2.applyAlg(new Alg(`${c.setup} ${c.fullRuAlg}`));
    const piecesRu = patRu.patternData.CORNERS.pieces;
    const oriRu = patRu.patternData.CORNERS.orientation;
    assert.deepStrictEqual(piecesRu.slice(4), [4, 5, 6, 7], `${c.id} RU alg must solve all 4 D corners`);
    assert.deepStrictEqual(oriRu.slice(4), [0, 0, 0, 0], `${c.id} RU alg must orient all 4 D corners`);

    if (c.fullTriggerAlg) {
      assert.ok(
        !/\b([RUFLBD])[2']?\s+\1[2']?\b/.test(c.triggerAlg || ''),
        `${c.id} triggerAlg must be simplified without adjacent same-face moves: ${c.triggerAlg}`
      );
      const patTrig = def2.applyAlg(new Alg(`${c.setup} ${c.fullTriggerAlg}`));
      assert.deepStrictEqual(patTrig.patternData.CORNERS.pieces.slice(4), [4, 5, 6, 7], `${c.id} trigger alg must solve D corners`);
      assert.deepStrictEqual(patTrig.patternData.CORNERS.orientation.slice(4), [0, 0, 0, 0], `${c.id} trigger alg must orient D corners`);
    }
  }
});

test('FIRST_LAYER_TWO_LOOK mini-cases solve BP into DBR and FP into DFR cleanly', async () => {
  const kp2 = await puzzles['2x2x2'].kpuzzle();
  const def2 = kp2.defaultPattern();

  assert.strictEqual(FIRST_LAYER_TWO_LOOK.optionA.bpCases.length, 8);
  assert.strictEqual(FIRST_LAYER_TWO_LOOK.optionA.fpFinishes.length, 5);

  for (const b of FIRST_LAYER_TWO_LOOK.optionA.bpCases) {
    const p = def2.applyAlg(new Alg(`${b.setup} ${b.alg}`));
    assert.strictEqual(p.patternData.CORNERS.pieces[5], 5);
    assert.strictEqual(p.patternData.CORNERS.pieces[6], 6);
    assert.strictEqual(p.patternData.CORNERS.pieces[7], 7, `${b.id} must solve BP into DBR`);
    assert.strictEqual(p.patternData.CORNERS.orientation[7], 0);
  }

  for (const f of FIRST_LAYER_TWO_LOOK.optionA.fpFinishes) {
    const p = def2.applyAlg(new Alg(`${f.setup} ${f.alg}`));
    assert.deepStrictEqual(p.patternData.CORNERS.pieces.slice(4), [4, 5, 6, 7]);
    assert.deepStrictEqual(p.patternData.CORNERS.orientation.slice(4), [0, 0, 0, 0]);
  }
});

test('Bottom-piece groups: 1-in-Bottom (9 strict), 2-Bar (70), 2-Diagonal (39), and 3-in-Bottom (5) partition & solve cleanly', async () => {
  const kp2 = await puzzles['2x2x2'].kpuzzle();
  const def2 = kp2.defaultPattern();
  const z2Def2 = def2.applyAlg('z2');

  const rotGens = ['x', 'y', 'z'].map(m => kp2.algToTransformation(m));
  const rotMap = new Map();
  const qRot = [kp2.identityTransformation()];
  rotMap.set(JSON.stringify(kp2.identityTransformation().transformationData.CORNERS), kp2.identityTransformation());
  while (qRot.length) {
    const t = qRot.shift();
    for (const g of rotGens) {
      const nt = t.applyTransformation(g);
      const k = JSON.stringify(nt.transformationData.CORNERS);
      if (!rotMap.has(k)) { rotMap.set(k, nt); qRot.push(nt); }
    }
  }
  const all24Rots = Array.from(rotMap.values());
  const maxRelWhite = (pat) => {
    const { pieces, orientation } = pat.patternData.CORNERS;
    let best = 0;
    for (const r of all24Rots) {
      const rp = def2.applyTransformation(r).patternData.CORNERS;
      let match = 0;
      for (const w of [4, 5, 6, 7]) {
        const sPat = pieces.indexOf(w);
        const sRot = rp.pieces.indexOf(w);
        if (sPat === sRot && orientation[sPat] === rp.orientation[sRot]) match++;
      }
      if (match > best) best = match;
    }
    return best;
  };
  const whiteFaceCounts = (pat) => {
    const { pieces, orientation } = pat.patternData.CORNERS;
    const cnt = { U: 0, D: 0, F: 0, B: 0, L: 0, R: 0 };
    for (const w of [4, 5, 6, 7]) {
      const s = pieces.indexOf(w);
      cnt[CORNER_FACES_333[s][orientation[s]]]++;
    }
    return cnt;
  };

  assert.strictEqual(FIRST_LAYER_ONE_BOTTOM_CASES.length, 9);
  assert.deepStrictEqual(FIRST_LAYER_BOTTOM_STATS.oneBottom.buckets, { 'in-top': 3, 'in-bottom': 6 });
  assert.strictEqual(FIRST_LAYER_BAR_PURE_CASES.length, 70);
  assert.strictEqual(FIRST_LAYER_DIAG_CASES.length, 39);
  assert.strictEqual(FIRST_LAYER_THREE_BOTTOM_CASES.length, 5);
  assert.deepStrictEqual(FIRST_LAYER_BOTTOM_STATS.twoDiag.buckets, { 'both-top': 15, mixed: 15, 'both-bottom': 9 });
  assert.deepStrictEqual(FIRST_LAYER_BOTTOM_STATS.twoDiag.moveCounts, { '3': 4, '4': 11, '5': 20, '6': 4 });

  // Partition of 75 Bar-on-Left into 70 pure bar + 5 three-in-bottom
  const pureIds = new Set(FIRST_LAYER_BAR_PURE_CASES.map(c => c.id));
  const threeIds = new Set(FIRST_LAYER_THREE_BOTTOM_CASES.map(c => c.id));
  assert.strictEqual(pureIds.size + threeIds.size, 75);
  for (const id of threeIds) assert.ok(!pureIds.has(id));

  // Verify 9 strictly 1-in-Bottom cases (zero 2+ white stickers on any face, zero accidental solved pairs under any rotation or U move)
  for (const c of FIRST_LAYER_ONE_BOTTOM_CASES) {
    const st = def2.applyAlg(new Alg(c.setup));
    assert.strictEqual(st.patternData.CORNERS.pieces[6], 6, `${c.id} must keep DBL solved`);
    assert.strictEqual(st.patternData.CORNERS.orientation[6], 0);
    assert.strictEqual(st.patternData.CORNERS.pieces[c.partnerSlotIdx], 5, `${c.id} partner slot mismatch`);
    assert.strictEqual(st.patternData.CORNERS.orientation[c.partnerSlotIdx], c.partnerOri);

    const fc = whiteFaceCounts(st);
    assert.strictEqual(fc.D, 1, `${c.id} must have strictly 1 white sticker on Bottom (D)`);
    assert.strictEqual(Math.max(...Object.values(fc)), 1, `${c.id} must have at most 1 white sticker on every face`);
    for (const um of ['', 'U', "U'", 'U2']) {
      const pu = um ? st.applyAlg(um) : st;
      assert.strictEqual(whiteFaceCounts(pu).D, 1, `${c.id} + "${um}" must keep strictly 1 white on D`);
      assert.strictEqual(maxRelWhite(pu), 1, `${c.id} + "${um}" must have no solved white pairs under any 3D rotation`);
    }

    // Step 1 (barAlg) forms strictly a 2-piece Left Bar (DFL+DBL)
    const afterBar = def2.applyAlg(new Alg(`${c.setup} ${c.barAlg}`));
    assert.strictEqual(afterBar.patternData.CORNERS.pieces[5], 5, `${c.id} bar step failed DFL`);
    assert.strictEqual(afterBar.patternData.CORNERS.orientation[5], 0);
    assert.strictEqual(afterBar.patternData.CORNERS.pieces[6], 6);
    assert.strictEqual(afterBar.patternData.CORNERS.orientation[6], 0);
    assert.strictEqual(whiteFaceCounts(afterBar).D, 2, `${c.id} bar step must yield 2 white on D`);
    assert.strictEqual(maxRelWhite(afterBar), 2, `${c.id} bar step must not solve 3rd corner early`);

    // Complete 1st-layer solution (fullAlg) solves ALL 4 D corners + bottom row!
    const solved = def2.applyAlg(new Alg(`${c.setup} ${c.fullAlg}`));
    assert.deepStrictEqual(solved.patternData.CORNERS.pieces.slice(4), [4, 5, 6, 7], `${c.id} bare full solve failed`);
    assert.deepStrictEqual(solved.patternData.CORNERS.orientation.slice(4), [0, 0, 0, 0]);
    assert.strictEqual(
      checkFirstLayerSolved(solved, { isZ2: false, requireExactAlignment: true }).ok,
      true,
      `${c.id} bare sticker 1st layer failed`
    );

    const solvedZ2 = def2.applyAlg(new Alg(`z2 ${c.setup} ${c.fullAlg}`));
    assert.deepStrictEqual(solvedZ2.patternData.CORNERS.pieces.slice(4), z2Def2.patternData.CORNERS.pieces.slice(4), `${c.id} z2 full solve failed`);
    assert.deepStrictEqual(solvedZ2.patternData.CORNERS.orientation.slice(4), [0, 0, 0, 0]);
    assert.strictEqual(
      checkFirstLayerSolved(solvedZ2, { isZ2: true, requireExactAlignment: true }).ok,
      true,
      `${c.id} z2 sticker 1st layer failed`
    );
  }

  // Verify 39 Two-Diagonal cases
  for (const c of FIRST_LAYER_DIAG_CASES) {
    const st = def2.applyAlg(new Alg(c.setup));
    const cp = st.patternData.CORNERS.pieces;
    const co = st.patternData.CORNERS.orientation;
    assert.strictEqual(cp[4], 4, `${c.id} must keep DFR solved`);
    assert.strictEqual(co[4], 0);
    assert.strictEqual(cp[6], 6, `${c.id} must keep DBL solved`);
    assert.strictEqual(co[6], 0);
    assert.ok(!(cp[5] === 5 && co[5] === 0) && !(cp[7] === 7 && co[7] === 0), `${c.id} must not be 3-solved`);

    const solved = def2.applyAlg(new Alg(`${c.setup} ${c.fullAlg}`));
    assert.deepStrictEqual(solved.patternData.CORNERS.pieces.slice(4), [4, 5, 6, 7], `${c.id} bare diagonal solve failed`);
    assert.deepStrictEqual(solved.patternData.CORNERS.orientation.slice(4), [0, 0, 0, 0]);

    const solvedZ2 = def2.applyAlg(new Alg(`z2 ${c.setup} ${c.fullAlg}`));
    assert.deepStrictEqual(solvedZ2.patternData.CORNERS.pieces.slice(4), z2Def2.patternData.CORNERS.pieces.slice(4), `${c.id} z2 diagonal solve failed`);
    assert.deepStrictEqual(solvedZ2.patternData.CORNERS.orientation.slice(4), [0, 0, 0, 0]);
  }

  // Verify renderFirstLayer3dSvg renders exact 4 White corner stickers & matching corner slots across all 4 groups
  for (const sample of [
    FIRST_LAYER_ONE_BOTTOM_CASES[0],
    FIRST_LAYER_BAR_PURE_CASES[0],
    FIRST_LAYER_DIAG_CASES[0],
    FIRST_LAYER_THREE_BOTTOM_CASES[1]
  ]) {
    const resolved = resolveFirstLayerCornerState(sample);
    const pat = def2.applyAlg(sample.setup);
    const tracked = new Set([4, 5, 6, 7]);
    for (let s = 0; s < 8; s++) {
      const pc = pat.patternData.CORNERS.pieces[s];
      if (tracked.has(pc)) {
        assert.deepStrictEqual(resolved[s], { piece: pc, ori: pat.patternData.CORNERS.orientation[s] });
      } else {
        assert.strictEqual(resolved[s], null);
      }
    }
    const svg = renderFirstLayer3dSvg(sample);
    assert.ok(svg.includes('<svg') && svg.includes('flb-3d-svg'));
    assert.strictEqual((svg.match(/fill="#ffffff"/g) || []).length, 4, `${sample.id} 3D SVG white sticker count`);
  }
});

test('firstLayerVerifier validates bottom face all-White, bottom row bars, and audits all 1st-layer algs', async () => {
  const kp2 = await puzzles['2x2x2'].kpuzzle();
  const def2 = kp2.defaultPattern();

  // Solved z2: all White D + all 4 bottom-row bars matching
  const solvedZ2 = def2.applyAlg('z2');
  assert.deepStrictEqual(checkBottomFaceAllWhite(solvedZ2).whiteCount, 4);
  assert.strictEqual(checkBottomFaceAllWhite(solvedZ2).allWhite, true);
  assert.strictEqual(checkBottomRowSolved(solvedZ2).rowSolved, true);
  assert.strictEqual(checkBottomRowSolved(solvedZ2).exactAligned, true);
  assert.strictEqual(checkFirstLayerSolved(solvedZ2).ok, true);

  // Partial 2-corner Bar only: bottom face NOT all white and row NOT solved
  const partialBar = def2.applyAlg("z2 R U' F2 U U' F2");
  assert.strictEqual(checkBottomFaceAllWhite(partialBar).allWhite, false);
  assert.strictEqual(checkBottomFaceAllWhite(partialBar).whiteCount, 2);
  assert.strictEqual(checkBottomRowSolved(partialBar).rowSolved, false);
  assert.strictEqual(checkFirstLayerSolved(partialBar).ok, false);

  // Ortega Adjacent-Bar face: allWhite = true, matchingBars = 1 (rowSolved = false)
  const adjFaceEx = FIRST_FACE_EXAMPLES[1];
  const adjPat = def2.applyAlg(`${adjFaceEx.scramble} ${adjFaceEx.moves}`);
  assert.strictEqual(checkBottomFaceAllWhite(adjPat).allWhite, true);
  assert.strictEqual(checkBottomRowSolved(adjPat).matchingBars, 1);
  assert.strictEqual(checkBottomRowSolved(adjPat).rowSolved, false);
  assert.strictEqual(checkFirstLayerSolved(adjPat).ok, false);

  // Ortega Diagonal-Swap face: allWhite = true, matchingBars = 0 (rowSolved = false)
  const diagFaceEx = FIRST_FACE_EXAMPLES[3];
  const diagPat = def2.applyAlg(`${diagFaceEx.scramble} ${diagFaceEx.moves}`);
  assert.strictEqual(checkBottomFaceAllWhite(diagPat).allWhite, true);
  assert.strictEqual(checkBottomRowSolved(diagPat).matchingBars, 0);
  assert.strictEqual(checkBottomRowSolved(diagPat).rowSolved, false);
  assert.strictEqual(checkFirstLayerSolved(diagPat).ok, false);

  // Full exhaustive audit across all 123 bottom-piece cases (+ Alts), 2-Look, and First Face
  const audit = auditAllFirstLayerAlgs(kp2, {
    oneBottom: FIRST_LAYER_ONE_BOTTOM_CASES,
    twoBar: FIRST_LAYER_BAR_PURE_CASES,
    twoDiag: FIRST_LAYER_DIAG_CASES,
    threeBottom: FIRST_LAYER_THREE_BOTTOM_CASES,
    barAll: FIRST_LAYER_BAR_CASES,
    twoLook: FIRST_LAYER_TWO_LOOK,
    firstFaceExamples: FIRST_FACE_EXAMPLES
  });
  assert.strictEqual(audit.ok, true, `Verifier audit failed: ${JSON.stringify(audit.failures.slice(0, 3))}`);
  assert.strictEqual(audit.failures.length, 0);
  assert.ok(audit.totalChecked > 400);
});
