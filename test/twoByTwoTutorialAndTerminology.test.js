import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { cube2x2x2, cube3x3x3, puzzles } from 'cubing/puzzles';
import { Alg } from 'cubing/alg';
import {
  NOTATION_TRIGGERS,
  NOTATION_FACE_MOVES,
  NOTATION_MODIFIERS,
  NOTATION_SLICE_MOVES,
  NOTATION_INNER_SLICE_MOVES,
  NOTATION_WIDE_MOVES,
  NOTATION_WIDE_3_MOVES
} from '../src/features/study/notationTutorialView.js';
import { solveTwoByTwoBeginner } from '../src/cube/twoByTwoBeginnerSolver.js';
import { PUZZLES } from '../src/data/algRegistry.js';
import { FIRST_LAYER_BAR_CASES } from '../src/data/firstLayerBarData.js';
import { getTrackExperimentalFeature, isTrackEnabled, AppStore } from '../src/state/appStore.js';
import { solveThreeByThreeBeginner } from '../src/cube/threeByThreeBeginnerSolver.js';
import {
  createTwoByTwoTutorialState,
  renderTwoByTwoTutorialHtml,
  TWO_BY_TWO_OLL_VISUAL_GUIDE,
  T_PERM_PLL_VISUAL_GUIDE
} from '../src/features/study/twoByTwoTutorialView.js';
import {
  createThreeByThreeTutorialState,
  renderThreeByThreeTutorialHtml
} from '../src/features/study/threeByThreeTutorialView.js';

function walkJsFiles(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walkJsFiles(full, out);
    else if (/\.(js|html|css)$/i.test(entry.name)) out.push(full);
  }
  return out;
}

test('zero occurrences of deprecated trigger term remain across src/ and index.html', () => {
  const srcRoot = new URL('../src/', import.meta.url).pathname;
  const indexFile = new URL('../index.html', import.meta.url).pathname;
  const files = [...walkJsFiles(srcRoot), indexFile];

  const offenders = [];
  for (const f of files) {
    const content = fs.readFileSync(f, 'utf8');
    if (/\bsexy\b/i.test(content)) {
      offenders.push(path.relative(path.dirname(indexFile), f));
    }
  }
  assert.deepStrictEqual(offenders, [], `Found deprecated term in: ${offenders.join(', ')}`);
});

test('2x2 Beginner Tutorial, 1st Face, and 1st Layer are no longer beta experimental features', () => {
  const trackIds = PUZZLES['222'].tracks.map(t => t.id);
  const tutIdx = trackIds.indexOf('tutorial');
  const faceIdx = trackIds.indexOf('face');
  assert.ok(tutIdx >= 0 && faceIdx > tutIdx, 'tutorial track must precede face track');

  assert.strictEqual(getTrackExperimentalFeature('222', 'tutorial'), null);
  assert.strictEqual(getTrackExperimentalFeature('222', 'face'), null);
  assert.strictEqual(getTrackExperimentalFeature('222', 'layer'), null);

  const store = new AppStore();
  assert.strictEqual(isTrackEnabled(store.state, '222', 'tutorial'), true);
  assert.strictEqual(isTrackEnabled(store.state, '222', 'face'), true);
  assert.strictEqual(isTrackEnabled(store.state, '222', 'layer'), true);
});

test('2x2 Tutorial steps, notation moves, triggers, and flb-68 verify mathematically on 2x2 KPuzzle', async () => {
  const kp = await cube2x2x2.kpuzzle();
  const solved = kp.defaultPattern();
  const pZ2 = solved.applyAlg(new Alg('z2'));

  for (const tr of [...NOTATION_TRIGGERS, ...NOTATION_MODIFIERS.map(m => ({ id: m.id, alg: m.demoAlg, setup: m.demoSetup })), ...NOTATION_FACE_MOVES.map(m => ({ id: m.letter, alg: m.demoAlg, setup: m.demoSetup }))]) {
    const out = solved.applyAlg(new Alg(`${tr.setup} ${tr.alg}`));
    assert.ok(out.isIdentical(solved), `Trigger/move ${tr.id} setup+alg should return to solved`);
  }
  assert.ok(NOTATION_TRIGGERS.some(t => t.id === 'trig-lefty-sledge' && t.alg === "L F' L' F"));
  assert.ok(NOTATION_TRIGGERS.some(t => t.id === 'trig-lefty-hedge' && t.alg === "F' L F L'"));

  // Verify 3x3 Middle Slices (M, E, S), Triggers (including Lefty Sledge/Hedge), and Wide moves (including r === Rw)
  const kp3 = await cube3x3x3.kpuzzle();
  const s3 = kp3.defaultPattern();
  for (const tr of [...NOTATION_SLICE_MOVES, ...NOTATION_WIDE_MOVES, ...NOTATION_TRIGGERS.map(t => ({ letter: t.name, demoAlg: t.alg, demoSetup: t.setup }))]) {
    const moved = s3.applyAlg(new Alg(tr.demoAlg));
    assert.ok(!moved.isIdentical(s3), `3x3 move ${tr.letter} must change state`);
    assert.ok(moved.applyAlg(new Alg(tr.demoSetup)).isIdentical(s3), `3x3 ${tr.demoSetup} + ${tr.demoAlg} must cancel`);
  }
  for (const w of NOTATION_WIDE_MOVES) {
    assert.ok(s3.applyAlg(new Alg(w.lower)).isIdentical(s3.applyAlg(new Alg(w.demoAlg))), `3x3 lowercase ${w.lower} must match ${w.demoAlg}`);
  }

  // Verify 4x4 & 5x5 Inner Slices (2R..2B) and 5x5 Middle + 3-Layer Wide moves
  const kp4 = await puzzles['4x4x4'].kpuzzle();
  const s4 = kp4.defaultPattern();
  for (const inner of NOTATION_INNER_SLICE_MOVES) {
    const moved = s4.applyAlg(new Alg(inner.demoAlg));
    assert.ok(!moved.isIdentical(s4), `4x4 inner slice ${inner.letter} must change state`);
    assert.ok(moved.applyAlg(new Alg(inner.demoSetup)).isIdentical(s4), `4x4 ${inner.letter} must cancel`);
  }
  const kp5 = await puzzles['5x5x5'].kpuzzle();
  const s5 = kp5.defaultPattern();
  for (const mv of [...NOTATION_SLICE_MOVES, ...NOTATION_INNER_SLICE_MOVES, ...NOTATION_WIDE_MOVES, ...NOTATION_WIDE_3_MOVES]) {
    const moved = s5.applyAlg(new Alg(mv.demoAlg));
    assert.ok(!moved.isIdentical(s5), `5x5 move ${mv.letter} must change state`);
    assert.ok(moved.applyAlg(new Alg(mv.demoSetup)).isIdentical(s5), `5x5 ${mv.letter} must cancel`);
  }

  const tutPlan = await solveTwoByTwoBeginner("R U' F2 U2 R' F U R2");
  assert.strictEqual(tutPlan.solved, true, '2x2 beginner tutorial solver must solve sample scramble');

  // Confirm flb-68 has exactly 2 solved corners (DFL, DBL) and swapped DFR/DBR (3 white stickers down, 2 solved)
  const flb68 = FIRST_LAYER_BAR_CASES.find(c => c.id === 'flb-68');
  const pat68 = solved.applyAlg(new Alg(`z2 ${flb68.setup}`));
  const solvedSlots68 = [4, 5, 6, 7].filter(
    slot => pat68.patternData.CORNERS.pieces[slot] === pZ2.patternData.CORNERS.pieces[slot] &&
      pat68.patternData.CORNERS.orientation[slot] === 0
  );
  assert.strictEqual(solvedSlots68.length, 2);
});

test('2x2 Beginner Tutorial Guide tab renders pure 2D visual OLL Sune vs Antisune + PLL T-Perm guides with zero 3D widgets', () => {
  const tutState = createTwoByTwoTutorialState();
  assert.strictEqual(tutState.activeTab, 'guide');
  const html = renderTwoByTwoTutorialHtml(tutState);
  assert.ok(html.includes('data-tut-tab="guide"') && html.includes('data-tut-tab="walkthrough"'));
  assert.ok(!html.includes('tut-3d-wrap') && !html.includes('<twisty-player'), 'Guide tab must be pure 2D images + words (no 3D)');

  const start = html.indexOf('class="guide-card guide-card-full tut-oll-guide-card"');
  assert.ok(start >= 0, 'OLL visual guide section must be rendered');
  const end = html.indexOf('</section>', start);
  const guideHtml = html.slice(start, end);

  for (const item of [...TWO_BY_TWO_OLL_VISUAL_GUIDE.direct, ...TWO_BY_TWO_OLL_VISUAL_GUIDE.setup]) {
    assert.ok(guideHtml.includes(`data-oll-guide-id="${item.id}"`), `Visual guide must include ${item.id}`);
  }
  const svgMatches = guideHtml.match(/class="tut-oll-guide-svg"/g) || [];
  assert.strictEqual(svgMatches.length, 7, 'Visual guide should render 7 2D SVG diagrams (Sune, Antisune, H, Pi, U, T, L)');

  const pllStart = html.indexOf('class="guide-card guide-card-full tut-pll-guide-card"');
  assert.ok(pllStart >= 0, '2x2 PLL T-Perm visual guide section must be rendered');
  const pllEnd = html.indexOf('</section>', pllStart);
  const pllHtml = html.slice(pllStart, pllEnd);
  for (const item of T_PERM_PLL_VISUAL_GUIDE) {
    assert.ok(pllHtml.includes(`data-pll-guide-id="${item.id}"`), `PLL visual guide must include ${item.id}`);
  }
  const pllSvgs = pllHtml.match(/tut-pll-guide-svg/g) || [];
  assert.strictEqual(pllSvgs.length, 2, 'PLL visual guide should render 2 2D SVG diagrams (Matching Bar & Diagonal Y-Perm)');
});

test('3x3 Beginner Tutorial separates Guide tab (pure 2D) and Walkthrough tab (large 3D scramble preview + Focus + Shortest)', async () => {
  const kp3 = await cube3x3x3.kpuzzle();
  const s3 = kp3.defaultPattern();

  const state = createThreeByThreeTutorialState();
  assert.strictEqual(state.activeTab, 'guide');

  const guideHtml = renderThreeByThreeTutorialHtml(state);
  assert.ok(guideHtml.includes('data-tut-tab="guide"') && guideHtml.includes('data-tut-tab="walkthrough"'));
  assert.ok(!guideHtml.includes('tut-3d-wrap') && !guideHtml.includes('<twisty-player'), '3x3 Guide tab must use pure 2D diagrams, not 3D');

  for (const guideKind of ['daisy-cross', 'white-corners', 'f2l-edges', 'oll', 'pll']) {
    const marker = `data-333-guide="${guideKind}"`;
    const gStart = guideHtml.indexOf(marker);
    assert.ok(gStart >= 0, `3x3 tutorial must render ${guideKind} pure 2D visual guide`);
    const gHtml = guideHtml.slice(gStart, guideHtml.indexOf('</section>', gStart));
    assert.ok(!gHtml.includes('case-svg-222'), `3x3 guide ${guideKind} must not use 2x2 diagrams`);
  }

  // OLL has 3 Yellow Cross + 7 Corner OLL (Sune/Antisune/H/Pi/U/T/L) = 10 3x3 OLL SVGs
  const ollStart = guideHtml.indexOf('data-333-guide="oll"');
  const ollHtml = guideHtml.slice(ollStart, guideHtml.indexOf('</section>', ollStart));
  assert.strictEqual((ollHtml.match(/tut-333-oll-svg/g) || []).length, 10, '3x3 OLL guide should render 10 true 3x3 OLL SVGs');

  // PLL has 2 T-Perm corner cases + 3 Ua/Ub/No-Bar edge cases = 5 3x3 PLL SVGs
  const pllStart = guideHtml.indexOf('data-333-guide="pll"');
  const pllHtml = guideHtml.slice(pllStart, guideHtml.indexOf('</section>', pllStart));
  assert.strictEqual((pllHtml.match(/tut-333-pll-svg/g) || []).length, 5, '3x3 PLL guide should render 5 true 3x3 PLL SVGs (T-Perm + Ua/Ub/No-Bar)');
  assert.ok(pllHtml.includes('data-pll-guide-id="333-pll-ua"'));
  assert.ok(pllHtml.includes('data-pll-guide-id="333-pll-ub"'));

  // Walkthrough tab renders 3D Scramble Preview, fast-forward button, and step widgets
  state.activeTab = 'walkthrough';
  state.plan = await solveThreeByThreeBeginner(state.scramble);
  state.planKey = `${state.scramble}|`;
  assert.strictEqual(state.plan.solved, true, '3x3 tutorial default plan should solve scramble');

  const html = renderThreeByThreeTutorialHtml(state);
  assert.ok(html.includes('data-cube-id="tut333-scramble-preview"'), '3x3 walkthrough should include 3D Scramble Preview');
  assert.ok(html.includes('tut-3d-end-btn'), '3x3 Scramble Preview should include fast-forward button');
  assert.ok(html.includes('tut-highlight-piece-pill'), '3x3 corner steps should render Focus piece pill');

  // Verify Shortest alternate option selection cascades cleanly and solves the cube
  const cornerWithAlt = state.plan.steps.find(st => st.stage === 'white-corners' && Array.isArray(st.options) && st.options.some(o => o.id === 'shortest'));
  assert.ok(cornerWithAlt, 'Default 3x3 scramble should expose at least one White Corner step with a Shortest alternate');

  const altPlan = await solveThreeByThreeBeginner(state.scramble, {
    stepChoices: { [cornerWithAlt.id]: 'shortest' }
  });
  assert.strictEqual(altPlan.solved, true, 'Selecting Shortest corner option must still solve full 3x3 cube');
  const chosenStep = altPlan.steps.find(st => st.id === cornerWithAlt.id);
  assert.strictEqual(chosenStep.activeOptionId, 'shortest');

  // Verify every step's setupBefore + moves chain ends at a solved 3x3 orientation
  const last = altPlan.steps[altPlan.steps.length - 1];
  const endPat = s3.applyAlg(new Alg(last.cumulativeAfter));
  const yGoals = ['', 'y', "y'", 'y2', 'x', "x'", 'x2', 'z', "z'", 'z2'].flatMap(b =>
    ['', 'y', "y'", 'y2'].map(y => {
      const alg = [b, y].filter(Boolean).join(' ');
      return alg ? s3.applyAlg(new Alg(alg)) : s3;
    })
  );
  assert.ok(yGoals.some(g => endPat.isIdentical(g)), 'Full cascading 3x3 Shortest plan must reach solved state');
});
