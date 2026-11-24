import test from 'node:test';
import assert from 'node:assert';
import { SolveReplayViewer, buildReplayDisplaySequence } from '../src/replayView.js';
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

test('buildReplayDisplaySequence strips x/y/z gyro rotations while preserving move-tape scrubbing alignment', () => {
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
});
