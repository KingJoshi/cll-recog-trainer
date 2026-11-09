import test from 'node:test';
import assert from 'node:assert';
import { SolveReplayViewer } from '../src/replayView.js';

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
