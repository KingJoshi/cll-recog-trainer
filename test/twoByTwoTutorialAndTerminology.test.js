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

test('2x2 Beginner Tutorial precedes 1st Face and both are beta experimental features', () => {
  const trackIds = PUZZLES['222'].tracks.map(t => t.id);
  const tutIdx = trackIds.indexOf('tutorial');
  const faceIdx = trackIds.indexOf('face');
  assert.ok(tutIdx >= 0 && faceIdx > tutIdx, 'tutorial track must precede face track');

  assert.strictEqual(getTrackExperimentalFeature('222', 'tutorial'), 'twoByTwoTutorial');
  assert.strictEqual(getTrackExperimentalFeature('222', 'face'), 'twoByTwoFirstFace');
  assert.strictEqual(getTrackExperimentalFeature('222', 'layer'), 'twoByTwoFirstLayer');

  const store = new AppStore();
  assert.strictEqual(isTrackEnabled(store.state, '222', 'tutorial'), false);
  assert.strictEqual(isTrackEnabled(store.state, '222', 'face'), false);
  assert.strictEqual(isTrackEnabled(store.state, '222', 'layer'), false);
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
