import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { cube2x2x2 } from 'cubing/puzzles';
import { Alg } from 'cubing/alg';
import {
  NOTATION_TRIGGERS,
  NOTATION_FACE_MOVES,
  NOTATION_MODIFIERS
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
    if (tr.id === 'mod-slice' || tr.id === 'mod-wide' || tr.id === 'mod-rot') continue;
    const out = solved.applyAlg(new Alg(`${tr.setup} ${tr.alg}`));
    assert.ok(out.isIdentical(solved), `Trigger/move ${tr.id} setup+alg should return to solved`);
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
