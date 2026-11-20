import test from 'node:test';
import assert from 'node:assert';
import { findLayerSolutions, findFaceSolutions } from '../src/layerSolver.js';

test('findLayerSolutions finds optimal 1st layer solution on White for simple scramble', async () => {
  const sols = await findLayerSolutions("R U R' F'", ['white'], 5);
  assert.ok(Array.isArray(sols) && sols.length > 0, 'Should return at least one solution');
  for (const s of sols) {
    assert.strictEqual(s.face, 'white');
    assert.ok(typeof s.moveCount === 'number' && s.moveCount <= 5);
    assert.ok(typeof s.moves === 'string');
    assert.ok(typeof s.caseId === 'string');
  }
});

test('findLayerSolutions supports multi-face Color Neutrality search', async () => {
  const sols = await findLayerSolutions("R U2 R' U' R U' R' F2", ['white', 'yellow', 'green'], 5);
  assert.ok(sols.length > 0);
  const faces = new Set(sols.map(s => s.face));
  assert.ok([...faces].every(f => ['white', 'yellow', 'green'].includes(f)));
  for (let i = 1; i < sols.length; i++) {
    assert.ok(sols[i].moveCount >= sols[i - 1].moveCount, 'Solutions should be ordered shortest first');
  }
});

test('findFaceSolutions finds 1st face solutions for Ortega transition', async () => {
  const sols = await findFaceSolutions("R U' R2 F R F'", ['white', 'yellow'], 5);
  assert.ok(Array.isArray(sols) && sols.length > 0);
  for (const s of sols) {
    assert.ok(['white', 'yellow'].includes(s.face));
    assert.ok(typeof s.moveCount === 'number' && s.moveCount <= 5);
  }
});
