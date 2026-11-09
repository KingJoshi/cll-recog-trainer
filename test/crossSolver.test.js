import test from 'node:test';
import assert from 'node:assert';
import { findCrossSolutions, centerToWhiteEdge } from '../src/crossSolver.js';
import { Alg } from 'cubing/alg';
import { puzzles } from 'cubing/puzzles';

test('3x3 Cross Solver finds valid optimal white cross solutions finishing with White on bottom', async () => {
  const kp = await puzzles['3x3x3'].kpuzzle();
  const scramble = "R U R' U' D2 F2 L2 B2 U' R2 F2 D' B2 L2 D2 L' F' R2 B2";

  const solutions = await findCrossSolutions(scramble, 4);
  assert.ok(solutions.length > 0, 'Must find at least one solution');

  for (const sol of solutions) {
    assert.ok(sol.moves, 'Solution must have moves string');
    assert.ok(sol.moveCount > 0, 'Move count must be positive');
    assert.ok(sol.eoSummary, 'Must include EO summary');

    // Test that the solution actually solves the 4 white cross edges on D around the White center:
    let combined = scramble;
    if (sol.insp && sol.insp !== 'none') {
      combined += ' ' + sol.insp;
    }
    combined += ' ' + sol.moves;

    const pat = kp.defaultPattern().applyAlg(new Alg(combined));

    // 1. D center must be White (center 0)
    assert.strictEqual(pat.patternData.CENTERS.pieces[5], 0, `D center must be White (0) for ${sol.insp} ${sol.moves}`);

    // 2. Cross edges in slots 4, 5, 6, 7 must be the White edges matching their adjacent centers:
    const fc = pat.patternData.CENTERS.pieces[2];
    const rc = pat.patternData.CENTERS.pieces[3];
    const bc = pat.patternData.CENTERS.pieces[4];
    const lc = pat.patternData.CENTERS.pieces[1];
    const expectedEdges = [centerToWhiteEdge[fc], centerToWhiteEdge[rc], centerToWhiteEdge[bc], centerToWhiteEdge[lc]];

    const crossPieces = pat.patternData.EDGES.pieces.slice(4, 8);
    const crossOri = pat.patternData.EDGES.orientation.slice(4, 8);

    assert.deepStrictEqual(crossPieces, expectedEdges, `Cross pieces must match expected white edges for ${sol.insp} ${sol.moves}`);
    assert.deepStrictEqual(crossOri, [0, 0, 0, 0], `Cross orientation must be [0,0,0,0] for ${sol.insp} ${sol.moves}`);
  }
});

test('3x3 Cross Solver solves White cross on bottom for user reported WCA scramble', async () => {
  const kp = await puzzles['3x3x3'].kpuzzle();
  const scramble = "R2 D' F' R D' F2 L' R2 U' R2 B2 D F2 D' R2 L2 U' R2 D F L";

  const solutions = await findCrossSolutions(scramble, 6);
  assert.ok(solutions.length > 0);

  for (const sol of solutions) {
    let combined = scramble;
    if (sol.insp && sol.insp !== 'none') {
      combined += ' ' + sol.insp;
    }
    combined += ' ' + sol.moves;

    const pat = kp.defaultPattern().applyAlg(new Alg(combined));

    // Must finish with White center on D
    assert.strictEqual(pat.patternData.CENTERS.pieces[5], 0);

    const fc = pat.patternData.CENTERS.pieces[2];
    const rc = pat.patternData.CENTERS.pieces[3];
    const bc = pat.patternData.CENTERS.pieces[4];
    const lc = pat.patternData.CENTERS.pieces[1];
    const expectedEdges = [centerToWhiteEdge[fc], centerToWhiteEdge[rc], centerToWhiteEdge[bc], centerToWhiteEdge[lc]];

    const crossPieces = pat.patternData.EDGES.pieces.slice(4, 8);
    const crossOri = pat.patternData.EDGES.orientation.slice(4, 8);

    assert.deepStrictEqual(crossPieces, expectedEdges);
    assert.deepStrictEqual(crossOri, [0, 0, 0, 0]);
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
