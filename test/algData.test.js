import test from 'node:test';
import assert from 'node:assert';
import { PUZZLES, getTrack } from '../src/data/algRegistry.js';
import { pllCases } from '../src/data/pllData.js';
import { ollCases } from '../src/data/ollData.js';
import { f2lCases } from '../src/data/f2lData.js';
import { ortegaCases } from '../src/data/ortegaData.js';
import { cllCases } from '../src/data/cllData.js';
import { Alg } from 'cubing/alg';

test('PUZZLES registry structure', () => {
  assert.ok(PUZZLES['222'], 'Must have 222');
  assert.ok(PUZZLES['333'], 'Must have 333');
  assert.strictEqual(PUZZLES['222'].tracks.length, 3);
  assert.strictEqual(PUZZLES['333'].tracks.length, 4);

  const pllTrack = getTrack('333', 'pll');
  assert.ok(pllTrack);
  assert.strictEqual(pllTrack.cases.length, 21);
});

test('PLL 21 cases integrity', () => {
  assert.strictEqual(pllCases.length, 21, 'Must have exactly 21 PLL cases');
  for (const c of pllCases) {
    assert.ok(c.id, 'Case must have id');
    assert.ok(c.name, 'Case must have name');
    assert.ok(c.setup, 'Case must have setup');
    assert.ok(c.algs.length > 0, 'Case must have algorithms');
    // Ensure all algs parse with cubing.js
    for (const a of c.algs) {
      assert.doesNotThrow(() => new Alg(a.alg), `Alg ${a.alg} must parse`);
    }
    assert.doesNotThrow(() => new Alg(c.setup), `Setup ${c.setup} must parse`);
  }
});

test('OLL 57 cases integrity', () => {
  assert.strictEqual(ollCases.length, 57, 'Must have exactly 57 OLL cases');
  const numbers = ollCases.map(c => c.number).sort((a,b)=>a-b);
  for (let i = 1; i <= 57; i++) {
    assert.strictEqual(numbers[i - 1], i, `OLL ${i} must exist`);
  }
  for (const c of ollCases) {
    for (const a of c.algs) {
      assert.doesNotThrow(() => new Alg(a.alg), `Alg ${a.alg} in OLL ${c.number} must parse`);
    }
  }
});

test('F2L 41 cases integrity', () => {
  assert.strictEqual(f2lCases.length, 41, 'Must have exactly 41 F2L cases');
  const numbers = f2lCases.map(c => c.number).sort((a,b)=>a-b);
  for (let i = 1; i <= 41; i++) {
    assert.strictEqual(numbers[i - 1], i, `F2L ${i} must exist`);
  }
  for (const c of f2lCases) {
    for (const a of c.algs) {
      assert.doesNotThrow(() => new Alg(a.alg), `Alg ${a.alg} in F2L ${c.number} must parse`);
    }
  }
});

test('Ortega and CLL 2x2 cases integrity', () => {
  assert.strictEqual(ortegaCases.length, 12, 'Ortega must have 7 OLL + 5 PBL = 12 cases');
  assert.strictEqual(cllCases.length, 40, 'CLL must have 40 cases');

  for (const c of ortegaCases) {
    for (const a of c.algs) {
      assert.doesNotThrow(() => new Alg(a.alg), `Alg ${a.alg} in ${c.id} must parse`);
    }
  }

  for (const c of cllCases) {
    for (const a of c.algs) {
      assert.doesNotThrow(() => new Alg(a.alg), `Alg ${a.alg} in ${c.id} must parse`);
    }
  }
});

test('3x3 CFOP cases default to White on bottom with z2', async () => {
  const { puzzles } = await import('cubing/puzzles');
  const kp = await puzzles['3x3x3'].kpuzzle();
  const def = kp.defaultPattern();
  const z2Solved = def.applyAlg(new Alg('z2'));

  // Sample PLL case (e.g. Ua)
  const ua = pllCases.find(c => c.id === 'Ua');
  assert.ok(ua);
  const uaSol = def.applyAlg(new Alg(`z2 ${ua.setup} ${ua.algs[0].alg}`));
  assert.strictEqual(
    JSON.stringify(uaSol.patternData),
    JSON.stringify(z2Solved.patternData),
    'Applying z2 + setup + alg must result in solved cube with White on bottom'
  );

  // Sample OLL case (e.g. OLL 1)
  const oll1 = ollCases.find(c => c.number === 1);
  assert.ok(oll1);
  const ollSol = def.applyAlg(new Alg(`z2 ${oll1.setup} ${oll1.algs[0].alg}`));
  assert.strictEqual(
    ollSol.patternData.CENTERS.pieces[5],
    0,
    'Bottom center must remain White (index 0) after OLL execution'
  );

  // Sample F2L case (e.g. F2L 1)
  const f2l1 = f2lCases.find(c => c.number === 1);
  assert.ok(f2l1);
  const f2lSol = def.applyAlg(new Alg(`z2 ${f2l1.setup} ${f2l1.algs[0].alg}`));
  assert.strictEqual(
    f2lSol.patternData.CENTERS.pieces[5],
    0,
    'Bottom center must remain White (index 0) after F2L execution'
  );
});
