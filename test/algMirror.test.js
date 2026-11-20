import test from 'node:test';
import assert from 'node:assert';
import { Alg } from 'cubing/alg';
import { puzzles } from 'cubing/puzzles';
import { mirrorAlgLR, conjugateZPrime, getEffectiveAlgsForCase } from '../src/cube/algMirror.js';
import { cleanAlg } from '../src/algParser.js';
import { pllCases } from '../src/data/pllData.js';
import { ollCases } from '../src/data/ollData.js';
import { f2lCases } from '../src/data/f2lData.js';

test('mirrorAlgLR is an involution on standard 3x3 moves and conjugateZPrime preserves exact KPuzzle action', async () => {
  const kp3 = await puzzles['3x3x3'].kpuzzle();
  const def3 = kp3.defaultPattern();

  assert.strictEqual(mirrorAlgLR("R U R' U'"), "L' U' L U");
  assert.strictEqual(mirrorAlgLR("M2' U M U2 M' U M2'"), "M2' U' M U2 M' U' M2'");
  assert.strictEqual(mirrorAlgLR(mirrorAlgLR("r U R' U' r' F R F'")), "r U R' U' r' F R F'");

  assert.strictEqual(conjugateZPrime("R U R' U'"), "z' U L U' L' z");

  for (const list of [pllCases, ollCases, f2lCases]) {
    for (const c of list) {
      const algStr = c.algs?.[0]?.alg;
      if (!algStr) continue;
      const cleaned = cleanAlg(algStr);
      assert.strictEqual(mirrorAlgLR(mirrorAlgLR(cleaned)), cleaned, `Involution failed for ${c.id}`);

      const direct = def3.applyAlg(new Alg(cleaned));
      const zConj = def3.applyAlg(new Alg(conjugateZPrime(cleaned, { wrap: true })));
      assert.ok(direct.isIdentical(zConj), `z' conjugation failed KPuzzle equivalence for ${c.id}`);
    }
  }
});

test('Right-Hand OH getEffectiveAlgsForCase solves every PLL (21), OLL (57), and F2L (41) case mathematically', async () => {
  const kp3 = await puzzles['3x3x3'].kpuzzle();
  const def3 = kp3.defaultPattern();
  const orientRots = [
    '', 'y', 'y2', "y'",
    'x', 'x y', 'x y2', "x y'",
    'x2', 'x2 y', 'x2 y2', "x2 y'",
    "x'", "x' y", "x' y2", "x' y'",
    'z', 'z y', 'z y2', "z y'",
    "z'", "z' y", "z' y2", "z' y'"
  ];
  const solved3 = orientRots.map(r => (r ? def3.applyAlg(new Alg(r)) : def3));

  // 1. PLL 21 cases
  for (const c of pllCases) {
    const algs = getEffectiveAlgsForCase('333oh', 'pll', c, { ohHand: 'right', trackCases: pllCases });
    const mirrorOpt = algs.find(a => a.id === `${c.id}-rh-mirror`);
    assert.ok(mirrorOpt, `PLL ${c.id} must include Right-Hand mirror alg`);
    let solved = false;
    for (const endAuf of ['', 'U', "U'", 'U2']) {
      const pat = def3.applyAlg(new Alg(`${c.setup} ${mirrorOpt.startAuf || ''} ${mirrorOpt.alg} ${endAuf}`));
      if (solved3.some(sp => pat.isIdentical(sp))) {
        solved = true;
        break;
      }
    }
    assert.ok(solved, `Right-Hand OH mirror for PLL ${c.id} (${mirrorOpt.alg}) must solve case`);
  }

  // 2. OLL 57 cases
  for (const c of ollCases) {
    const algs = getEffectiveAlgsForCase('333oh', 'oll', c, { ohHand: 'right', trackCases: ollCases });
    const mirrorOpt = algs.find(a => a.id === `${c.id}-rh-mirror`);
    assert.ok(mirrorOpt, `OLL ${c.id} must include Right-Hand mirror alg`);
    const baseAfter = def3.applyAlg(new Alg(`${c.setup} ${mirrorOpt.startAuf || ''} ${mirrorOpt.alg}`));
    let oriented = false;
    for (const rot of ['', 'y', 'y2', "y'"]) {
      const p = rot ? baseAfter.applyAlg(new Alg(rot)) : baseAfter;
      const cOri = p.patternData.CORNERS.orientation;
      const eOri = p.patternData.EDGES.orientation;
      if (cOri.slice(0, 4).every(o => o === 0) &&
          eOri.slice(0, 4).every(o => o === 0) &&
          p.patternData.CORNERS.pieces.slice(4).every((v, i) => v === i + 4 && cOri[i + 4] === 0)) {
        oriented = true;
        break;
      }
    }
    assert.ok(oriented, `Right-Hand OH mirror for OLL ${c.id} (${mirrorOpt.alg}) must orient U and keep F2L`);
  }

  // 3. F2L 41 cases (z' FR-slot AND FL-slot mirror)
  for (const c of f2lCases) {
    const algs = getEffectiveAlgsForCase('333oh', 'f2l', c, { ohHand: 'right', trackCases: f2lCases });
    const zpOpt = algs.find(a => a.id === `${c.id}-rh-zprime`);
    const flOpt = algs.find(a => a.id === `${c.id}-rh-fl-mirror`);
    assert.ok(zpOpt && flOpt, `F2L ${c.id} must include both RH z' and FL Mirror options`);
    const patZp = def3.applyAlg(new Alg(`${c.setup} ${zpOpt.alg}`));
    assert.ok(patZp.patternData.CORNERS.pieces[4] === 4 && patZp.patternData.CORNERS.orientation[4] === 0 &&
              patZp.patternData.EDGES.pieces[8] === 8 && patZp.patternData.EDGES.orientation[8] === 0,
      `F2L ${c.id} z' option must solve FR slot`);

    const patFl = def3.applyAlg(new Alg(`${flOpt.mirroredSetup} ${flOpt.alg}`));
    assert.ok(patFl.patternData.CORNERS.pieces[5] === 5 && patFl.patternData.CORNERS.orientation[5] === 0 &&
              patFl.patternData.EDGES.pieces[9] === 9 && patFl.patternData.EDGES.orientation[9] === 0,
      `F2L ${c.id} FL-mirror option must solve FL slot`);
  }
});
