import test from 'node:test';
import assert from 'node:assert';
import { Alg } from 'cubing/alg';
import { puzzles } from 'cubing/puzzles';
import { collCases } from '../src/data/collData.js';
import { cmllCases } from '../src/data/cmllData.js';
import { wvCases } from '../src/data/wvData.js';
import { formatCaseDisplayId, getTrack } from '../src/data/algRegistry.js';
import { renderCaseSvg } from '../src/cube/caseSvgRenderer.js';
import { resolveDrillableCaseId, getWeakestCasesForTrack } from '../src/services/weakCasesService.js';
import { AlgDrillView } from '../src/features/practice/algDrillView.js';
import { AppStore, sanitizeTrainSubMode, sanitizeStoredStats } from '../src/state/appStore.js';
import { renderOllPllCasesBreakdownHtml, renderCllCasesBreakdownHtml } from '../src/features/solve/cfopBreakdownRenderer.js';
import { initCfopAnalyzer } from '../src/cfopAnalyzer.js';
import { initTwoByTwoAnalyzer } from '../src/twoByTwoAnalyzer.js';

function canonicalCornerCaseKey(pat) {
  let best = null;
  for (let pre = 0; pre < 4; pre++) {
    const p = pre ? pat.applyAlg(pre === 1 ? "U" : pre === 2 ? "U2" : "U'") : pat;
    const cp = p.patternData.CORNERS.pieces.slice(0, 4);
    const co = p.patternData.CORNERS.orientation.slice(0, 4);
    for (let post = 0; post < 4; post++) {
      const shifted = cp.map(c => (c + post) % 4);
      const key = shifted.join("") + "|" + co.join("");
      if (best === null || key < best) best = key;
    }
  }
  return best;
}

test('COLL (40 cases), CMLL (42 cases), and WV (27 cases) verify mathematically on 3x3 KPuzzle', async () => {
  assert.strictEqual(collCases.length, 40);
  assert.strictEqual(cmllCases.length, 42);
  assert.strictEqual(wvCases.length, 27);

  const kp = await puzzles['3x3x3'].kpuzzle();
  const def = kp.defaultPattern();

  // COLL: F2L preserved + all 4 U edges oriented + 40 distinct corner cases + setup + alg = solved
  const collKeys = new Set();
  for (const c of collCases) {
    const pat = def.applyAlg(new Alg(c.setup));
    const cp = pat.patternData.CORNERS.pieces, co = pat.patternData.CORNERS.orientation;
    const ep = pat.patternData.EDGES.pieces, eo = pat.patternData.EDGES.orientation;
    assert.ok([4, 5, 6, 7].every(i => cp[i] === i && co[i] === 0), `${c.id} must preserve F2L corners`);
    assert.ok([4, 5, 6, 7, 8, 9, 10, 11].every(i => ep[i] === i && eo[i] === 0), `${c.id} must preserve F2L edges`);
    assert.ok([0, 1, 2, 3].every(i => eo[i] === 0), `${c.id} must keep all U edges oriented`);
    const key = canonicalCornerCaseKey(pat);
    assert.strictEqual(collKeys.has(key), false, `Duplicate COLL canonical key on ${c.id}`);
    collKeys.add(key);

    const solvedAfter = pat.applyAlg(new Alg(c.algs[0].alg));
    assert.strictEqual(solvedAfter.isIdentical(def), true, `${c.id} default alg must solve its setup`);
  }
  assert.strictEqual(collKeys.size, 40);

  // CMLL: Roux L/R 1x2x3 blocks preserved + 42 distinct corner cases + setup + alg = solved
  const cmllKeys = new Set();
  for (const c of cmllCases) {
    const pat = def.applyAlg(new Alg(c.setup));
    const cp = pat.patternData.CORNERS.pieces, co = pat.patternData.CORNERS.orientation;
    const ep = pat.patternData.EDGES.pieces, eo = pat.patternData.EDGES.orientation;
    assert.ok([4, 5, 6, 7].every(i => cp[i] === i && co[i] === 0), `${c.id} must preserve L/R block corners`);
    assert.ok([5, 7, 8, 9, 10, 11].every(i => ep[i] === i && eo[i] === 0), `${c.id} must preserve L/R block edges`);
    const key = canonicalCornerCaseKey(pat);
    assert.strictEqual(cmllKeys.has(key), false, `Duplicate CMLL canonical key on ${c.id}`);
    cmllKeys.add(key);

    const solvedAfter = pat.applyAlg(new Alg(c.algs[0].alg));
    assert.strictEqual(solvedAfter.isIdentical(def), true, `${c.id} default alg must solve its setup`);
  }
  assert.strictEqual(cmllKeys.size, 42);

  // WV: 3 F2L slots preserved + all 12 edges oriented + 27 distinct U-corner orientation triples
  const wvSigs = new Set();
  for (const c of wvCases) {
    const base = def.applyAlg(new Alg(c.setup));
    let matchedSig = null;
    for (let u = 0; u < 4; u++) {
      const pat = u ? base.applyAlg(u === 1 ? "U" : u === 2 ? "U2" : "U'") : base;
      const cp = pat.patternData.CORNERS.pieces, co = pat.patternData.CORNERS.orientation;
      const ep = pat.patternData.EDGES.pieces, eo = pat.patternData.EDGES.orientation;
      const f2l3Ok = [5, 6, 7].every(i => cp[i] === i && co[i] === 0)
        && [4, 5, 6, 7, 9, 10, 11].every(i => ep[i] === i && eo[i] === 0);
      if (f2l3Ok && eo.every(o => o === 0) && cp[3] === 4 && co[3] === 2 && ep[0] === 8) {
        matchedSig = co.slice(0, 3).join("");
        break;
      }
    }
    assert.ok(matchedSig, `${c.id} must preserve 3 F2L slots, EO, and FR pair in U`);
    assert.strictEqual(wvSigs.has(matchedSig), false, `Duplicate WV orientation signature on ${c.id}`);
    wvSigs.add(matchedSig);

    const solvedAfter = base.applyAlg(new Alg(c.algs[0].alg));
    assert.strictEqual(solvedAfter.isIdentical(def), true, `${c.id} default alg must solve its setup`);
  }
  assert.strictEqual(wvSigs.size, 27);
});

test('COLL, CMLL, and WV register properly on 333/333oh, format IDs, and generate distinct SVGs', async () => {
  assert.strictEqual(formatCaseDisplayId('coll-H1'), 'COLL-H1');
  assert.strictEqual(formatCaseDisplayId('cmll-O1'), 'CMLL-O1');
  assert.strictEqual(formatCaseDisplayId('wv-1'), 'WV-1');

  assert.strictEqual(getTrack('333', 'coll')?.cases?.length, 40);
  assert.strictEqual(getTrack('333', 'cmll')?.cases?.length, 42);
  assert.strictEqual(getTrack('333', 'wv')?.cases?.length, 27);
  assert.strictEqual(getTrack('333oh', 'coll')?.cases?.length, 40);

  const collSvg = await renderCaseSvg('333', 'coll', collCases[0]);
  const cmllSvg = await renderCaseSvg('333', 'cmll', cmllCases[0]);
  const wvSvg = await renderCaseSvg('333', 'wv', wvCases[1]);
  assert.ok(collSvg.includes('case-svg-coll'));
  assert.ok(cmllSvg.includes('case-svg-cmll'));
  assert.ok(wvSvg.includes('case-svg-wv'));
});

test('weakCasesService resolves 2-look IDs and ranks slowest / low-accuracy / tagged cases', async () => {
  await initCfopAnalyzer();
  await initTwoByTwoAnalyzer();

  assert.strictEqual(resolveDrillableCaseId('333', 'oll', '2look-oll-line'), 'oll-45');
  assert.strictEqual(resolveDrillableCaseId('333', 'pll', '2look-pll-diag'), 'Y');
  assert.strictEqual(resolveDrillableCaseId('222', 'cll', 'pll-adj'), 'T1');
  assert.strictEqual(resolveDrillableCaseId('333', 'oll', 'OLL Skip'), null);

  const weakestOll = getWeakestCasesForTrack({
    puzzleId: '333',
    trackId: 'oll',
    solves: [
      { puzzle: '333', target: 'oll', id: 'oll-01', ms: 3200, rawMs: 3200 },
      { puzzle: '333', target: 'oll', id: 'oll-27', ms: 1100, rawMs: 1100 },
    ],
    recogStats: {
      '333:oll': {
        'oll-21': { shown: 10, correct: 4 },
        'oll-45': { shown: 5, correct: 5 }
      }
    },
    caseTags: { 'coll-H1': 'learning', 'oll-55': 'learning' },
    limit: 4
  });

  assert.strictEqual(weakestOll.caseIds[0], 'oll-01');
  assert.ok(weakestOll.caseIds.includes('oll-27'));
  assert.ok(weakestOll.caseIds.includes('oll-21'));
  assert.ok(weakestOll.caseIds.includes('oll-55'));
});

test('AppStore persists trainSubMode alg-drill cleanly and AlgDrillView tracks live smart-cube moves + undo + timing', () => {
  assert.strictEqual(sanitizeTrainSubMode('alg-drill'), 'alg-drill');
  assert.strictEqual(sanitizeTrainSubMode('timed-drill'), 'timed-drill');
  assert.strictEqual(sanitizeTrainSubMode('invalid'), 'recog');

  const store = new AppStore();
  store.setTrainSubMode('alg-drill');
  assert.strictEqual(store.state.trainSubMode, 'alg-drill');
  assert.strictEqual(store.getSettingsPayload().trainSubMode, 'alg-drill');

  // Test multi-case pool drilling with Coll-H1 (default alg: R U R' U R U' R' U R U2 R')
  store.state.currentPuzzle = '333';
  store.state.currentTrackId = 'coll';
  store.state.selectedCases = new Set(['coll-H1', 'coll-T3']);

  let lastDisplayedScramble = '';
  const container = { innerHTML: '', querySelector: () => null, querySelectorAll: () => [] };
  const view = new AlgDrillView({
    container,
    appStore: store,
    onApplyScrambleToDisplay: (scr) => { lastDisplayedScramble = scr; },
    isCubeConnected: () => true
  });
  view.setTrack('333', 'coll');
  assert.deepStrictEqual(view.poolIds, ['coll-H1', 'coll-T3']);
  assert.strictEqual(view.currentCase?.id, 'coll-H1');
  assert.ok(lastDisplayedScramble.includes(view.currentSetup));

  // Execute T3 directly via setCasePool: r U R' U' r' F R F'
  // Use pure outer-face case coll-S1 (R U R' U R U2 R') for clean turn-by-turn test with an off-track mistake + undo
  view.setCasePool(['coll-S1', 'coll-S5']);
  assert.strictEqual(view.currentCase?.id, 'coll-S1');
  assert.strictEqual(view.currentAlg, "R U R' U R U2 R'");

  let ts = 1000;
  view.handleSmartMove('R', ts); ts += 120;
  assert.strictEqual(view.tracker.currentIndex, 1);

  // Off-track mistake D, then undo D'
  view.handleSmartMove('D', ts); ts += 100;
  assert.strictEqual(view.mistakesInRep, 1);
  assert.strictEqual(view.tracker.getStatus().hasError, true);
  view.handleSmartMove("D'", ts); ts += 100;
  assert.strictEqual(view.tracker.getStatus().hasError, false);

  // Finish remaining moves including U2 split into U + U
  view.handleSmartMove('U', ts); ts += 100;
  view.handleSmartMove("R'", ts); ts += 100;
  view.handleSmartMove('U', ts); ts += 100;
  view.handleSmartMove('R', ts); ts += 100;
  view.handleSmartMove('U', ts); ts += 80;
  view.handleSmartMove('U', ts); ts += 100;
  view.handleSmartMove("R'", ts);

  assert.strictEqual(view.phase, 'done');
  assert.strictEqual(view.repHistory.length, 1);
  assert.strictEqual(view.repHistory[0].caseId, 'coll-S1');
  assert.strictEqual(view.repHistory[0].ms, ts - 1000);
  assert.strictEqual(view.repHistory[0].mistakes, 1);

  // Verify single-source-of-truth sync with selectedByTrack and case deletion / clearing / alg switching
  assert.deepStrictEqual(store.state.selectedByTrack['333:coll'], ['coll-S1', 'coll-S5']);
  view.selectAlgForCurrentCase('coll-S1-default');
  assert.strictEqual(view.currentAlg, "R U R' U R U2 R'");
  view.deleteRep(0);
  assert.strictEqual(view.repHistory.length, 0);

  // Verify openAlgQuickSim passes puzzle, z2-prefixed scramble when alwaysWhiteBottom is true, solutions, and activeIndex
  let capturedSimPayload = null;
  store.state.alwaysWhiteBottom = true;
  const simView = new AlgDrillView({
    container,
    appStore: store,
    onQuickSimSolutions: (payload) => { capturedSimPayload = payload; }
  });
  simView.setTrack('333', 'coll');
  simView.setCasePool(['coll-H1']);
  const { algs: h1Algs } = simView._getAllAlgsForCase(simView.currentCase);
  const targetAlg = h1Algs[h1Algs.length - 1];
  simView.openAlgQuickSim(targetAlg.id);
  assert.ok(capturedSimPayload);
  assert.strictEqual(capturedSimPayload.puzzle, '333');
  assert.strictEqual(capturedSimPayload.solutions.length, h1Algs.length);
  assert.strictEqual(capturedSimPayload.activeIndex, h1Algs.length - 1);
  assert.ok(capturedSimPayload.scramble.startsWith('z2 '));
  simView.deactivate();

  // Verify AppStore sanitizes corrupted e+295 stats and supports resetAllRecognitionStats
  const cleaned = sanitizeStoredStats({
    '222': { cll: { H1: { shown: 8.4e295, correct: 8.4e295 }, H2: { shown: 10, correct: 8 } } },
    H1: { shown: 8.4e295, correct: 8.4e295 },
    H2: { shown: 10, correct: 8 }
  });
  assert.strictEqual(cleaned['222'].cll.H1, undefined);
  assert.deepStrictEqual(cleaned['222'].cll.H2, { shown: 10, correct: 8 });
  store.state.stats = cleaned;
  store.resetAllRecognitionStats();
  assert.deepStrictEqual(store.state.stats, {});

  view.deactivate();
});

test('Case Performance breakdowns render clickable case drill buttons and Drill Weakest button', async () => {
  await initCfopAnalyzer();
  await initTwoByTwoAnalyzer();

  const html333 = renderOllPllCasesBreakdownHtml([
    {
      puzzle: '333',
      target: 'full',
      ms: 2500,
      cfop: {
        version: 4,
        ollCase: { id: 'oll-45', name: 'OLL 45', shortName: 'OLL 45', group: 'T-Shapes', isSkip: false, ms: 950, pauseCount: 0, pauseMs: 0, recogMs: 250 },
        pllCase: { id: 'T', name: 'T-Perm', shortName: 'T', isSkip: false, ms: 1100, pauseCount: 0, pauseMs: 0, recogMs: 300 }
      }
    }
  ]);
  assert.ok(html333.includes('class="cfop-drill-weakest-btn"'));
  assert.ok(html333.includes('data-drill-case-id="oll-45"'));
  assert.ok(html333.includes('data-drill-case-id="T"'));

  const html222 = renderCllCasesBreakdownHtml([
    {
      puzzle: '222',
      target: 'full',
      ms: 2100,
      twoByTwo: {
        version: 4,
        method: 'cll',
        cllCase: { id: 'T1', name: 'CLL T1', shortName: 'T1', group: 'T-Group', isSkip: false, ms: 1150, moveCount: 8, pauseCount: 0, pauseMs: 0, recogMs: 320 }
      }
    }
  ]);
  assert.ok(html222.includes('data-drill-weakest-track="cll"'));
  assert.ok(html222.includes('data-drill-case-id="T1"'));
});
