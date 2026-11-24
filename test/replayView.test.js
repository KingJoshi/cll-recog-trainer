import test from 'node:test';
import assert from 'node:assert';
import { SolveReplayViewer, buildReplayDisplaySequence, normalizeReplayMoves } from '../src/replayView.js';
import { createModalManager } from '../src/ui/modalManager.js';

test('SolveReplayViewer instantiation and initialization', () => {
  const viewer = new SolveReplayViewer();
  assert.strictEqual(viewer.isPlaying, false);
  assert.strictEqual(viewer.currentMoveIndex, 0);
  assert.strictEqual(viewer.playbackSpeed, 1.0);
});

test('SolveReplayViewer handles solve data and move bounds', () => {
  const viewer = new SolveReplayViewer();
  const dummySolve = {
    puzzle: "333",
    scramble: "R U R' U'",
    rawMs: 3500,
    moves: [
      { move: "U", t: 500, split: 500 },
      { move: "R", t: 1200, split: 700 },
      { move: "U'", t: 2000, split: 800 },
      { move: "R'", t: 3500, split: 1500 }
    ],
    moveCount: 4,
    tps: 1.14
  };

  viewer.activeSolve = dummySolve;
  viewer.scramble = dummySolve.scramble;
  viewer.moves = dummySolve.moves;
  viewer.totalDurationMs = dummySolve.rawMs;

  viewer.jumpToMove(2);
  assert.strictEqual(viewer.currentMoveIndex, 2);

  // Jump beyond bounds
  viewer.jumpToMove(999);
  assert.strictEqual(viewer.currentMoveIndex, 4);

  viewer.jumpToMove(-10);
  assert.strictEqual(viewer.currentMoveIndex, 0);
});

test('SolveReplayViewer play and pause state management', () => {
  const viewer = new SolveReplayViewer();
  viewer.moves = [
    { move: "R", t: 300, split: 300 },
    { move: "U", t: 600, split: 300 }
  ];

  viewer.play();
  assert.strictEqual(viewer.isPlaying, true);

  viewer.pause();
  assert.strictEqual(viewer.isPlaying, false);
});

test('SolveReplayViewer formats +2 / DNF headers with getSolveTime and integrates with modalManager', () => {
  const modal = { hidden: true, addEventListener() {}, removeEventListener() {}, querySelectorAll: () => [], querySelector: () => null };
  const body = { style: {} };
  const mgr = createModalManager({ doc: { activeElement: null }, body });
  const timeEl = { textContent: '' };
  const metaEl = { textContent: '' };

  const viewer = new SolveReplayViewer();
  viewer.init({ modal, timeEl, metaEl }, null, mgr);

  viewer.open({
    puzzle: '333',
    rawMs: 5250,
    penalty: '+2',
    scramble: "R U R' U'",
    moves: [{ move: 'R', t: 1000, split: 1000 }]
  });
  assert.strictEqual(viewer.isOpen(), true);
  assert.strictEqual(timeEl.textContent, '7.25s+');
  assert.strictEqual(body.style.overflow, 'hidden');

  viewer.close();
  assert.strictEqual(viewer.isOpen(), false);
  assert.strictEqual(body.style.overflow, '');

  viewer.open({ puzzle: '333', rawMs: 4100, penalty: 'DNF', scramble: "R U", moves: [] });
  assert.strictEqual(timeEl.textContent, 'DNF');
  viewer.close();
});

test('buildReplayDisplaySequence strips x/y/z gyro rotations and prepends viewRotations while preserving move-tape scrubbing alignment', () => {
  const seq = buildReplayDisplaySequence("F R", [
    { move: "R'", t: 100 },
    { move: "x'", t: 150 },
    { move: "y2", t: 200 },
    { move: "F'", t: 350 }
  ]);
  assert.deepStrictEqual(seq.scrMoves, ["F", "R"]);
  assert.deepStrictEqual(seq.faceMoveTokens, ["R'", "F'"]);
  assert.strictEqual(seq.fullSequence, "F R R' F'");
  assert.deepStrictEqual(seq.moveIndexToDisplayIndex, [2, 3, 3, 3, 4]);

  const oriented = buildReplayDisplaySequence("F R", [
    { move: "R'", t: 100 },
    { move: "F'", t: 350 }
  ], ["z2", "y'"]);
  assert.deepStrictEqual(oriented.viewRotTokens, ["z2", "y'"]);
  assert.strictEqual(oriented.fullSequence, "z2 y' F R R' F'");
  assert.deepStrictEqual(oriented.moveIndexToDisplayIndex, [4, 5, 6]);
});

test('normalizeReplayMoves removes gyro tokens, aligns split pauses, and SolveReplayViewer navigates steps, pauses, and view rotations', async () => {
  const rawMoves = [
    { move: "U'", t: 0, split: 0 },
    { move: "y", t: 10, split: 10 },
    { move: "R'", t: 180, split: 170 },
    { move: "x'", t: 200, split: 20 },
    { move: "U", t: 1020, split: 820 }, // 840ms since previous face turn (R'@180 -> U@1020)
    { move: "y'", t: 1030, split: 10 },
    { move: "R", t: 1180, split: 150 },
    { move: "F'", t: 1700, split: 520 }
  ];
  const norm = normalizeReplayMoves(rawMoves);
  assert.strictEqual(norm.length, 5);
  assert.deepStrictEqual(norm.map(m => m.move), ["U'", "R'", "U", "R", "F'"]);
  assert.deepStrictEqual(norm.map(m => m.origIdx), [0, 2, 4, 6, 7]);
  assert.strictEqual(norm[2].split, 840);
  assert.strictEqual(norm[4].split, 520);

  const modal = { hidden: true, addEventListener() {}, removeEventListener() {}, querySelectorAll: () => [], querySelector: () => null };
  const body = { style: {} };
  const mgr = createModalManager({ doc: { activeElement: null }, body });
  const timeEl = { textContent: '' };
  const metaEl = { textContent: '' };
  const moveCounter = { textContent: '' };
  const btnNextStep = { disabled: false, addEventListener() {} };
  const btnNextPause = { disabled: false, textContent: '', addEventListener() {} };

  const viewer = new SolveReplayViewer();
  viewer.init({ modal, timeEl, metaEl, moveCounter, btnNextStep, btnNextPause }, null, mgr);

  const fakeDisplay = { scramble: '' };
  viewer.open({
    puzzle: '222',
    rawMs: 1700,
    cubeMs: 1700,
    scramble: "R U'",
    moves: rawMoves,
    twoByTwo: {
      version: 3,
      method: 'cll',
      methodPref: 'cll',
      layerColor: 'White',
      splits: { layer: 180, cll: 1520, auf: 0 },
      steps: [
        { phase: 'layer', label: '1st Layer', caseId: 'White', ms: 180, startMoveIdx: 0, endMoveIdx: 4 },
        { phase: 'cll', label: 'CLL', caseId: 'T1', ms: 1520, startMoveIdx: 4, endMoveIdx: 8 }
      ]
    }
  });

  await viewer._mountPromise;
  await viewer.jumpToMove(0);

  // Header shows only face turns (5 moves, not 8 raw events)
  assert.ok(metaEl.textContent.startsWith('5 moves (ETM)'));
  assert.strictEqual(moveCounter.textContent, 'Move 0 / 5');
  assert.deepStrictEqual(viewer.stepBoundaries, [1, 3]);
  assert.deepStrictEqual(viewer.pauseIndices, [3, 5]);
  assert.strictEqual(btnNextStep.disabled, false);
  assert.strictEqual(btnNextPause.disabled, false);
  assert.strictEqual(btnNextPause.textContent, '⏸ Pause (2)');

  // Jump Next Step cycles cleanly
  viewer.jumpToNextStep();
  assert.strictEqual(viewer.currentMoveIndex, 1);
  viewer.jumpToNextStep();
  assert.strictEqual(viewer.currentMoveIndex, 3);
  viewer.jumpToNextStep();
  assert.strictEqual(viewer.currentMoveIndex, 1);

  // Jump Next Pause cycles cleanly
  await viewer.jumpToMove(0);
  viewer.jumpToNextPause();
  assert.strictEqual(viewer.currentMoveIndex, 3);
  viewer.jumpToNextPause();
  assert.strictEqual(viewer.currentMoveIndex, 5);
  viewer.jumpToNextPause();
  assert.strictEqual(viewer.currentMoveIndex, 3);

  // Display orientation rotates & resets without changing solve moves
  viewer.display = fakeDisplay;
  viewer.rotateView("x'");
  assert.deepStrictEqual(viewer.viewRotations, ["x'"]);
  assert.strictEqual(fakeDisplay.scramble, "x' R U' U' R' U R F'");
  assert.deepStrictEqual(viewer._moveIndexToDisplayIndex, [3, 4, 5, 6, 7, 8]);

  viewer.rotateView("y");
  assert.strictEqual(fakeDisplay.scramble, "x' y R U' U' R' U R F'");

  viewer.resetViewOrientation();
  assert.deepStrictEqual(viewer.viewRotations, []);
  assert.strictEqual(fakeDisplay.scramble, "R U' U' R' U R F'");
  viewer.close();
});
