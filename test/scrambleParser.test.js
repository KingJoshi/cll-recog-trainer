import test from 'node:test';
import assert from 'node:assert';
import { MOVE_TOKEN_REGEX, cleanAlg, normalizeAlgForCompare, parseScrambleInput, countAlgMoves } from '../src/algParser.js';

test('MOVE_TOKEN_REGEX matches all valid big cube and 3x3 moves', () => {
  const validMoves = [
    // Standard face turns
    'R', 'R2', "R'", "R2'", 'U', 'U2', "U'", 'F', 'F2', "F'", 'B', 'B2', "B'", 'L', 'L2', "L'", 'D', 'D2', "D'",
    // Standard wide turns
    'Rw', 'Rw2', "Rw'", 'Uw', 'Uw2', "Uw'", 'Fw', 'Fw2', "Fw'", 'Bw', 'Bw2', "Bw'", 'Lw', 'Lw2', "Lw'", 'Dw', 'Dw2', "Dw'",
    'r', 'r2', "r'", 'u', 'u2', "u'", 'f', 'f2', "f'", 'b', 'b2', "b'", 'l', 'l2', "l'", 'd', 'd2', "d'",
    // Slices and rotations
    'x', 'x2', "x'", 'y', 'y2', "y'", 'z', 'z2', "z'",
    'M', 'M2', "M'", 'E', 'E2', "E'", 'S', 'S2', "S'",
    // Big cube inner slice turns (4x4, 5x5, 6x6, 7x7)
    '2R', '2R2', "2R'", "2R2'", '3R', '3R2', "3R'", '2U', '2U2', "2U'", '3U', '3U2', "3U'",
    '2F', '2F2', "2F'", '2B', '2B2', "2B'", '2L', '2L2', "2L'", '2D', '2D2', "2D'",
    // Big cube wide turns with layer prefixes
    '2Rw', '2Rw2', "2Rw'", '3Rw', '3Rw2', "3Rw'", '2Lw', '2Lw2', "2Lw'", '2Uw', '2Uw2', "2Uw'",
    '2-3Rw', '2-3Rw2', "2-3Rw'", '2-3Lw', '2-3Uw', '2-3Fw', '2-3Bw', '2-3Dw',
    '2r', '2r2', "2r'", '3r', '3r2', "3r'"
  ];

  for (const m of validMoves) {
    assert.match(m, MOVE_TOKEN_REGEX, `Move "${m}" must match MOVE_TOKEN_REGEX`);
  }

  const invalidTokens = [
    '2Q2', 'Rww', 'FOO', '2x', '3y', '123', '', ' ', '2RR', 'R2x'
  ];

  for (const inv of invalidTokens) {
    assert.doesNotMatch(inv, MOVE_TOKEN_REGEX, `Invalid token "${inv}" must not match MOVE_TOKEN_REGEX`);
  }
});

test('parseScrambleInput successfully parses big cube algorithms and parity sequences', () => {
  // 4x4 PLL Parity Opposite
  const p444Opp = parseScrambleInput("2R2 U2 2R2 Uw2 2R2 Uw2");
  assert.strictEqual(p444Opp.ok, true);
  assert.deepStrictEqual(p444Opp.moves, ['2R2', 'U2', '2R2', 'Uw2', '2R2', 'Uw2']);
  assert.strictEqual(p444Opp.orientation, "");

  // 4x4 PLL Parity with orientation prefix
  const p444WithOrient = parseScrambleInput("z2 2R2 U2 2R2 Uw2 2R2 Uw2");
  assert.strictEqual(p444WithOrient.ok, true);
  assert.strictEqual(p444WithOrient.orientation, "z2");
  assert.deepStrictEqual(p444WithOrient.moves, ['z2', '2R2', 'U2', '2R2', 'Uw2', '2R2', 'Uw2']);

  // 4x4 PLL Parity Adjacent
  const p444Adj = parseScrambleInput("R U R' U' 2R2 U2 2R2 Uw2 2R2 Uw2 U R U' R'");
  assert.strictEqual(p444Adj.ok, true);
  assert.strictEqual(p444Adj.moves.length, 14);

  // 5x5 Lucas Parity Middle Edge Flip (includes 3Rw' slice)
  const p555Flip = parseScrambleInput("Rw U2 x Rw U2 Rw U2 Rw' U2 Lw U2 3Rw' U2 Rw U2 Rw' U2 Rw'");
  assert.strictEqual(p555Flip.ok, true);
  assert.ok(p555Flip.moves.includes("3Rw'"));
  assert.ok(p555Flip.moves.includes("Rw"));
  assert.ok(p555Flip.moves.includes("Lw"));

  // Layer range notation
  const rangeSeq = parseScrambleInput("2-3Rw2 U2 2-3Rw2 Uw2");
  assert.strictEqual(rangeSeq.ok, true);
  assert.deepStrictEqual(rangeSeq.moves, ['2-3Rw2', 'U2', '2-3Rw2', 'Uw2']);
});

test('parseScrambleInput reports clear errors for invalid tokens and empty inputs', () => {
  const emptyRes = parseScrambleInput("");
  assert.strictEqual(emptyRes.ok, false);
  assert.strictEqual(emptyRes.error, "Please enter a scramble string.");

  const whitespaceRes = parseScrambleInput("   ");
  assert.strictEqual(whitespaceRes.ok, false);
  assert.strictEqual(whitespaceRes.error, "Scramble cannot be empty.");

  const nullRes = parseScrambleInput(null);
  assert.strictEqual(nullRes.ok, false);
  assert.strictEqual(nullRes.error, "Please enter a scramble string.");

  const badRes = parseScrambleInput("2R2 INVALID U2");
  assert.strictEqual(badRes.ok, false);
  assert.ok(badRes.error.includes('Invalid move token "INVALID"'));
  assert.ok(badRes.error.includes('slice moves (e.g. 2R, 3R)'));
  assert.ok(badRes.error.includes('wide moves (e.g. Rw, 2Rw, 3Rw)'));
});

test('cleanAlg preserves and simplifies big cube moves correctly', () => {
  // Cancellation on same inner slice
  assert.strictEqual(cleanAlg("2R 2R"), "2R2");
  assert.strictEqual(cleanAlg("2R 2R'"), "");
  assert.strictEqual(cleanAlg("2R2 2R"), "2R'");
  assert.strictEqual(cleanAlg("2R2 2R2"), "");

  // Different slices/faces do not cancel each other
  assert.strictEqual(cleanAlg("2R R"), "2R R");
  assert.strictEqual(cleanAlg("3Rw Rw"), "3Rw Rw");

  // Wide moves with layer prefixes combine
  assert.strictEqual(cleanAlg("3Rw 3Rw"), "3Rw2");
  assert.strictEqual(cleanAlg("3Rw 3Rw'"), "");

  // Parentheses, brackets, and curly braces are stripped cleanly
  assert.strictEqual(
    cleanAlg("(2R2 U2) [2R2 Uw2] {2R2 Uw2}"),
    "2R2 U2 2R2 Uw2 2R2 Uw2"
  );

  // Normalization for comparison
  assert.strictEqual(
    normalizeAlgForCompare("2R2' U2' 2R2' Uw2'"),
    "2R2 U2 2R2 Uw2"
  );
});

test('countAlgMoves ignores leading/trailing U & y rotations and mid-alg y while counting x/z rotations', () => {
  // Ja-Perm left-handed Jb mirror (both cleaned and legacy restoring y2 U form) === 13 moves, matching Jb-1
  assert.strictEqual(countAlgMoves("y2 L' U' L F L' U' L U L F' L2' U L"), 13);
  assert.strictEqual(countAlgMoves("y2 L' U' L F L' U' L U L F' L2' U L y2 U"), 13);
  assert.strictEqual(countAlgMoves("R U R' F' R U R' U' R' F R2 U' R' U'"), 13);

  // x and x' rotations MUST be counted
  assert.strictEqual(countAlgMoves("x R2 F R F' R U2 r' U r U2 x'"), 12);

  // Leading U' alignment is ignored (Ja-2 == Ja-5 == 10 moves)
  assert.strictEqual(countAlgMoves("U' R' U L' U2 R U' R' U2 R L"), 10);
  assert.strictEqual(countAlgMoves("R' U L' U2 R U' R' U2 R L"), 10);

  // Mid-alg y / y' rotations and trailing y / U are ignored (Gd-2 == 12 moves)
  assert.strictEqual(countAlgMoves("R U R' y' R2 u' R U' R' U R' u R2"), 12);
  assert.strictEqual(countAlgMoves("R U R' y' R2 u' R U' R' U R' u R2 y U'"), 12);

  // Repeat expansion works cleanly with AUF stripping
  assert.strictEqual(countAlgMoves("U (R U R' F')2 U2"), 8);
  assert.strictEqual(countAlgMoves("U (R U R' U')2 U2"), 7);
  assert.strictEqual(countAlgMoves(""), 0);
});
