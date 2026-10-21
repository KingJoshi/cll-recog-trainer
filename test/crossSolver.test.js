import test from 'node:test';
import assert from 'node:assert';
import { findCrossSolutions } from '../src/crossSolver.js';
import { Alg } from 'cubing/alg';
import { puzzles } from 'cubing/puzzles';

test('3x3 Cross Solver finds valid optimal white cross solutions', async () => {
  const kp = await puzzles['3x3x3'].kpuzzle();
  const scramble = "R U R' U' D2 F2 L2 B2 U' R2 F2 D' B2 L2 D2 L' F' R2 B2";

  const solutions = await findCrossSolutions(scramble, 4);
  assert.ok(solutions.length > 0, 'Must find at least one solution');

  for (const sol of solutions) {
    assert.ok(sol.moves, 'Solution must have moves string');
    assert.ok(sol.moveCount > 0, 'Move count must be positive');
    assert.ok(sol.eoSummary, 'Must include EO summary');

    // Test that the solution actually solves the 4 cross edges on D:
    let combined = scramble;
    if (sol.insp && sol.insp !== 'none') {
      combined += ' ' + sol.insp;
    }
    combined += ' ' + sol.moves;

    const pat = kp.defaultPattern().applyAlg(new Alg(combined));
    const crossPieces = pat.patternData.EDGES.pieces.slice(4, 8);
    const crossOri = pat.patternData.EDGES.orientation.slice(4, 8);

    assert.deepStrictEqual(crossPieces, [4, 5, 6, 7], `Cross pieces must be [4,5,6,7] for ${sol.moves}`);
    assert.deepStrictEqual(crossOri, [0, 0, 0, 0], `Cross orientation must be [0,0,0,0] for ${sol.moves}`);
  }
});

test('3x3 Cross Solver reports EO and Cross+1 information', async () => {
  const scramble = "D2 R' U2 B2 L D2 R2 B2 U2 F2 R' B2 D' F' L2 D2 L' U' B F'";
  const solutions = await findCrossSolutions(scramble, 3);
  assert.ok(solutions.length > 0);

  const top = solutions[0];
  assert.strictEqual(typeof top.eoSummary.goodEdges, 'number');
  assert.strictEqual(typeof top.eoSummary.badEdges, 'number');
  assert.strictEqual(top.eoSummary.goodEdges + top.eoSummary.badEdges, 12);
  assert.strictEqual(typeof top.crossPlus1.hasPair, 'boolean');
});
