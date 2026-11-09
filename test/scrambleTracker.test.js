import test from 'node:test';
import assert from 'node:assert';
import { ScrambleTracker, parseMoveToken, formatMove, invertMove } from '../src/scrambleTracker.js';

test('parseMoveToken and formatMove integrity', () => {
  assert.deepStrictEqual(parseMoveToken('R'), { face: 'R', amount: 1, raw: 'R' });
  assert.deepStrictEqual(parseMoveToken('U2'), { face: 'U', amount: 2, raw: 'U2' });
  assert.deepStrictEqual(parseMoveToken("F'"), { face: 'F', amount: 3, raw: "F'" });
  assert.strictEqual(parseMoveToken('x'), null);
  assert.strictEqual(parseMoveToken(''), null);

  assert.strictEqual(formatMove('R', 1), 'R');
  assert.strictEqual(formatMove('R', 2), 'R2');
  assert.strictEqual(formatMove('R', 3), "R'");
  assert.strictEqual(formatMove('R', 0), '');

  const inv = invertMove(parseMoveToken("R'"));
  assert.strictEqual(inv.text, 'R');
  const inv2 = invertMove(parseMoveToken("U2"));
  assert.strictEqual(inv2.text, 'U2');
});

test('ScrambleTracker tracks full sequence accurately without deviations', () => {
  const tracker = new ScrambleTracker("R U R' U'");
  assert.strictEqual(tracker.isComplete(), false);
  assert.strictEqual(tracker.getStatus().currentIndex, 0);
  assert.strictEqual(tracker.getStatus().nextRequired, 'R');

  tracker.applyMove('R');
  assert.strictEqual(tracker.getStatus().currentIndex, 1);
  assert.strictEqual(tracker.getStatus().nextRequired, 'U');

  tracker.applyMove('U');
  assert.strictEqual(tracker.getStatus().currentIndex, 2);
  assert.strictEqual(tracker.getStatus().nextRequired, "R'");

  tracker.applyMove("R'");
  assert.strictEqual(tracker.getStatus().currentIndex, 3);
  assert.strictEqual(tracker.getStatus().nextRequired, "U'");

  tracker.applyMove("U'");
  assert.strictEqual(tracker.isComplete(), true);
  assert.strictEqual(tracker.getStatus().nextRequired, null);
  assert.strictEqual(tracker.getStatus().hasError, false);
});

test('ScrambleTracker handles half turns split into two quarter turns', () => {
  const tracker = new ScrambleTracker("R2 D'");
  assert.strictEqual(tracker.getStatus().nextRequired, 'R2');

  // Turn R first (90 deg)
  tracker.applyMove('R');
  assert.strictEqual(tracker.getStatus().currentIndex, 0);
  assert.strictEqual(tracker.getStatus().nextRequired, 'R');

  // Turn R again (another 90 deg)
  tracker.applyMove('R');
  assert.strictEqual(tracker.getStatus().currentIndex, 1);
  assert.strictEqual(tracker.getStatus().nextRequired, "D'");

  tracker.applyMove("D'");
  assert.strictEqual(tracker.isComplete(), true);
});

test('ScrambleTracker detects off-track moves and guides user with correct undo moves', () => {
  const tracker = new ScrambleTracker("R U F");
  tracker.applyMove('R');
  assert.strictEqual(tracker.getStatus().nextRequired, 'U');

  // Accidental turn: B instead of U
  tracker.applyMove('B');
  assert.strictEqual(tracker.getStatus().hasError, true);
  assert.deepStrictEqual(tracker.getStatus().corrections, ["B'"]);
  assert.strictEqual(tracker.isComplete(), false);

  // Undo the mistake with B'
  tracker.applyMove("B'");
  assert.strictEqual(tracker.getStatus().hasError, false);
  assert.strictEqual(tracker.getStatus().nextRequired, 'U');

  // Continue with correct moves
  tracker.applyMove('U');
  tracker.applyMove('F');
  assert.strictEqual(tracker.isComplete(), true);
});

test('ScrambleTracker markComplete() bypasses scramble assistant', () => {
  const tracker = new ScrambleTracker("R2 D' F R D' F2");
  assert.strictEqual(tracker.isComplete(), false);
  tracker.markComplete();
  assert.strictEqual(tracker.isComplete(), true);
});

test('ScrambleTracker generates structured HTML', () => {
  const tracker = new ScrambleTracker("R U R'");
  tracker.applyMove('R');
  const html = tracker.getHtml();
  assert.ok(html.includes('token-done'));
  assert.ok(html.includes('token-current'));
  assert.ok(html.includes('token-pending'));
});

test('ScrambleTracker handles multiple deviations and computes LIFO undo sequence', () => {
  const tracker = new ScrambleTracker("R U F");
  tracker.applyMove('R');
  // Two erroneous turns
  tracker.applyMove('D');
  tracker.applyMove('L2');
  assert.strictEqual(tracker.getStatus().hasError, true);
  // Undo order should be L2, then D'
  assert.deepStrictEqual(tracker.getStatus().corrections, ['L2', "D'"]);

  // Undo L2
  tracker.applyMove('L2');
  assert.deepStrictEqual(tracker.getStatus().corrections, ["D'"]);

  // Undo D with D'
  tracker.applyMove("D'");
  assert.strictEqual(tracker.getStatus().hasError, false);
  assert.strictEqual(tracker.getStatus().nextRequired, 'U');
});

test('ScrambleTracker reset updates sequence and resets all tracking state', () => {
  const tracker = new ScrambleTracker("R U R'");
  tracker.applyMove('R');
  assert.strictEqual(tracker.getStatus().currentIndex, 1);

  tracker.reset("F2 D2 B");
  assert.strictEqual(tracker.getStatus().currentIndex, 0);
  assert.strictEqual(tracker.getStatus().totalMoves, 3);
  assert.strictEqual(tracker.getStatus().nextRequired, "F2");
  assert.strictEqual(tracker.isComplete(), false);
});

