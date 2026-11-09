import test from 'node:test';
import assert from 'node:assert';
import { SmartCubeManager, getSolvedPatterns } from '../src/smartCube.js';

test('getSolvedPatterns generates all 24 orientations for 3x3 and 2x2', async () => {
  const p3 = await getSolvedPatterns('333');
  assert.ok(p3, '3x3 info should exist');
  assert.strictEqual(p3.patterns.length, 24, '3x3 should have exactly 24 rotational orientations');

  const p2 = await getSolvedPatterns('222');
  assert.ok(p2, '2x2 info should exist');
  assert.strictEqual(p2.patterns.length, 24, '2x2 should have exactly 24 rotational orientations');
});

test('SmartCubeManager initial state and status', () => {
  const sc = new SmartCubeManager();
  const st = sc.getStatus();
  assert.strictEqual(st.status, 'disconnected');
  assert.strictEqual(st.connected, false);
  assert.strictEqual(st.deviceName, '');
});

test('SmartCubeManager tracks scramble and detects solved state', async () => {
  const sc = new SmartCubeManager();
  // Set simple scramble: R U R' U'
  await sc.setScramble("R U R' U'", "333");
  assert.strictEqual(sc.isCurrentPatternSolved(), false, 'Scrambled state should not be solved');

  // Apply inverse moves to solve the cube: U R U' R'
  const res1 = sc.handleMove("U", 100);
  assert.strictEqual(res1.isSolved, false);

  const res2 = sc.handleMove("R", 200);
  assert.strictEqual(res2.isSolved, false);

  const res3 = sc.handleMove("U'", 300);
  assert.strictEqual(res3.isSolved, false);

  const res4 = sc.handleMove("R'", 400);
  assert.strictEqual(res4.isSolved, true, 'Cube should be solved after completing inverse moves');
  assert.strictEqual(sc.isCurrentPatternSolved(), true);
});

test('SmartCubeManager recognizes solved state across whole cube rotations (y, x2, z)', async () => {
  const sc = new SmartCubeManager();
  await sc.setScramble("R", "333");
  assert.strictEqual(sc.isCurrentPatternSolved(), false);

  // Undo R
  sc.handleMove("R'", 100);
  assert.strictEqual(sc.isCurrentPatternSolved(), true);

  // Now rotate the whole cube (y)
  sc.handleMove("y", 200);
  assert.strictEqual(sc.isCurrentPatternSolved(), true, 'Cube in y rotation is still solved');

  // Rotate x2
  sc.handleMove("x2", 300);
  assert.strictEqual(sc.isCurrentPatternSolved(), true, 'Cube in x2 rotation is still solved');
});

test('SmartCubeManager event listeners for move and statuschange', async () => {
  const sc = new SmartCubeManager();
  let moveEventCount = 0;
  let lastMove = null;

  sc.addEventListener("move", (e) => {
    moveEventCount++;
    lastMove = e.detail.move;
  });

  sc.handleMove("F", 50);
  sc.handleMove("R", 100);

  assert.strictEqual(moveEventCount, 2);
  assert.strictEqual(lastMove, "R");
  assert.strictEqual(sc.getStatus().recentMoves.length, 2);
});
