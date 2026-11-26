import test from 'node:test';
import assert from 'node:assert';
import { puzzles } from 'cubing/puzzles';
import { Alg } from 'cubing/alg';
import { ScrambleTracker, parseMoveToken, formatMove, invertMove, conjugateTokensToHardwareMoves } from '../src/scrambleTracker.js';
import { normalize2x2ScrambleToURF, generateWca2x2Scramble, describeTrainingBottomOrientation, buildCaseScramble } from '../src/services/scrambleService.js';

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

test('ScrambleTracker supports suppressError and suppressSubAmount in getHtml() for double-flick anti-flicker delay', () => {
  const tracker = new ScrambleTracker("R2 U2");
  // First 90-deg turn of R2
  tracker.applyMove('R');
  assert.strictEqual(tracker.getStatus().currentSubAmount, 1);
  assert.strictEqual(tracker.getStatus().hasError, false);

  // With suppressSubAmount: true, "(R needed)" does not flicker immediately
  const suppressedHtml = tracker.getHtml({ suppressSubAmount: true });
  assert.strictEqual(suppressedHtml.includes('needed)'), false);

  // Without suppression, "(R needed)" is shown
  const unsuppressedHtml = tracker.getHtml({ suppressSubAmount: false });
  assert.strictEqual(unsuppressedHtml.includes('(R needed)'), true);

  // Complete R2 with second R flick
  tracker.applyMove('R');
  assert.strictEqual(tracker.getStatus().currentIndex, 1);
  assert.strictEqual(tracker.getStatus().currentSubAmount, 0);

  // Now simulate a temporary off-track turn before a second flick or correction delay expires
  tracker.applyMove('F');
  assert.strictEqual(tracker.getStatus().hasError, true);

  const errSuppressedHtml = tracker.getHtml({ suppressError: true });
  assert.strictEqual(errSuppressedHtml.includes('scramble-correction-box'), false);
  assert.strictEqual(errSuppressedHtml.includes('token-error-target'), false);

  const errShownHtml = tracker.getHtml({ suppressError: false });
  assert.strictEqual(errShownHtml.includes('scramble-correction-box'), true);
});

test('ScrambleTracker includes remaining double-turn half in corrections if user moves to next face prematurely', () => {
  const tracker = new ScrambleTracker("R2 F U'");
  // User only registers R (90 deg of R2) and then turns F
  tracker.applyMove('R');
  tracker.applyMove('F');
  const status1 = tracker.getStatus();
  assert.strictEqual(status1.hasError, true);
  // Must tell user both F' (undo premature F) AND R (finish R2)
  assert.deepStrictEqual(status1.corrections, ["F'", "R"]);

  // User follows instructions: F' then R
  tracker.applyMove("F'");
  tracker.applyMove('R');
  const status2 = tracker.getStatus();
  assert.strictEqual(status2.hasError, false);
  assert.strictEqual(status2.currentIndex, 1);
  assert.strictEqual(status2.nextRequired, 'F');

  // Now F and U' complete the scramble cleanly
  tracker.applyMove('F');
  tracker.applyMove("U'");
  assert.strictEqual(tracker.isComplete(), true);
});

test('parseMoveToken preserves wide-move case sensitivity and renderScrambleTrackerHtml renders markup', async () => {
  const { parseMoveToken, renderScrambleTrackerHtml } = await import('../src/scrambleTracker.js');

  const upperR = parseMoveToken('R');
  const lowerR = parseMoveToken('r');
  const wideU2 = parseMoveToken('u2');
  const wideFPrime = parseMoveToken("f'");

  assert.strictEqual(upperR.face, 'R');
  assert.strictEqual(lowerR.face, 'r');
  assert.strictEqual(wideU2.face, 'u');
  assert.strictEqual(wideU2.amount, 2);
  assert.strictEqual(wideFPrime.face, 'f');
  assert.strictEqual(wideFPrime.amount, 3);

  const tracker = new ScrambleTracker("r U'");
  tracker.applyMove('r');
  const html = renderScrambleTrackerHtml(tracker);
  assert.ok(html.includes('token-done'));
  assert.ok(html.includes("U'"));
});

test('normalize2x2ScrambleToURF preserves 2x2 KPuzzle state using only {U, R, F} moves', async () => {
  const kp = await puzzles['2x2x2'].kpuzzle();
  const solved = kp.defaultPattern();

  const rots = [];
  for (let x = 0; x < 4; x++) {
    for (let y = 0; y < 4; y++) {
      for (let z = 0; z < 4; z++) {
        const s = [x ? `x${x}` : '', y ? `y${y}` : '', z ? `z${z}` : ''].filter(Boolean).join(' ');
        const pat = solved.applyAlg(new Alg(s));
        if (!rots.some(r => r.pat.isIdentical(pat))) rots.push({ s, pat });
      }
    }
  }
  assert.strictEqual(rots.length, 24);

  const verifyEquivalentURF = (orig) => {
    const urf = normalize2x2ScrambleToURF(orig);
    assert.ok(urf.length > 0, `Expected non-empty URF scramble for "${orig}"`);
    for (const tok of urf.split(/\s+/)) {
      assert.match(tok, /^[URF][2']?$/, `Token "${tok}" must be pure U/R/F`);
    }
    const expected = solved.applyAlg(new Alg(orig));
    const matchesUpToOrientation = rots.some(r =>
      expected.isIdentical(solved.applyAlg(new Alg(`${urf} ${r.s}`.trim())))
    );
    assert.ok(matchesUpToOrientation, `"${orig}" -> "${urf}" must match on 2x2x2 KPuzzle up to whole-cube orientation`);
    return urf;
  };

  // Exact scramble from MoYu WeiPo V5 AI (WCU_MY22) diagnostic log + Ortega B2 scramble
  assert.strictEqual(verifyEquivalentURF("F R U' L2 U F' U2 F' U L' U'"), "F R U' R2 U R' U2 R' F R' U'");
  verifyEquivalentURF("R2' U R2 U2' B2' U R2'");

  // 30 deterministic pseudo-random 6-gen scrambles
  let seed = 1337;
  const nextRand = (n) => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed % n;
  };
  const faces = ['U', 'D', 'F', 'B', 'L', 'R'];
  const mods = ['', "'", '2'];
  for (let i = 0; i < 30; i++) {
    const scr = Array.from({ length: 14 }, () => faces[nextRand(6)] + mods[nextRand(3)]).join(' ');
    verifyEquivalentURF(scr);
  }
});

test('generateWca2x2Scramble emits pure {U, R, F} scrambles with no L, D, or B moves', async () => {
  for (let i = 0; i < 6; i++) {
    const scr = await generateWca2x2Scramble();
    assert.ok(typeof scr === 'string' && scr.trim().length > 0);
    for (const tok of scr.split(/\s+/)) {
      assert.match(tok, /^[URF][2']?$/, `WCA 2x2 scramble token "${tok}" must only use U, R, F`);
    }
  }
});

test('ScrambleTracker completes normalized MoYu WCU_MY22 scramble using single {U, R, F} quarter turns', () => {
  const normalized = normalize2x2ScrambleToURF("F R U' L2 U F' U2 F' U L' U'");
  const tracker = new ScrambleTracker(normalized);

  // Simulate quarter-turn BLE notifications emitted by physical 3-sensor 2x2 smart cubes
  const physicalTurns = ['F', 'R', "U'", 'R', 'R', 'U', "R'", 'U', 'U', "R'", 'F', "R'", "U'"];
  for (const turn of physicalTurns) {
    tracker.applyMove(turn);
  }

  assert.strictEqual(tracker.isComplete(), true);
  assert.strictEqual(tracker.getStatus().hasError, false);
  assert.strictEqual(tracker.getStatus().nextRequired, null);
});

test('ScrambleTracker conjugates leading orientation rotations (e.g. z2, y) for 3x3 and 2x2 smart cubes', async () => {
  // 3x3 with z2 (White bottom): R -> L hardware, U2 -> D2 hardware
  const res333 = conjugateTokensToHardwareMoves(['z2', 'R', 'U2', "R'", "U'"], { is2x2: false });
  assert.deepStrictEqual(res333.leadingRotations, ['z2']);
  assert.deepStrictEqual(
    res333.moves.map(m => formatMove(m.face, m.amount)),
    ['L', 'D2', "L'", "D'"]
  );
  assert.deepStrictEqual(res333.moves.map(m => m.text), ['R', 'U2', "R'", "U'"]);

  const tracker333 = new ScrambleTracker("z2 R U2 R' U'", { is2x2: false });
  const html333 = tracker333.getHtml();
  assert.ok(html333.includes('token-rotation'));
  assert.ok(html333.includes('>z2<'));
  for (const hwMove of ['L', 'D', 'D', "L'", "D'"]) {
    tracker333.applyMove(hwMove);
  }
  assert.strictEqual(tracker333.isComplete(), true);

  // Verify mathematical equivalence on 3x3x3 KPuzzle: (z2 + y + turns) == (hardwareTurns + z2 + y)
  const kp3 = await puzzles['3x3x3'].kpuzzle();
  const solved3 = kp3.defaultPattern();
  const sample3 = "z2 y R U R' U' F'";
  const hw3 = conjugateTokensToHardwareMoves(sample3.split(' '), { is2x2: false });
  const hwAlg3 = hw3.moves.map(m => formatMove(m.face, m.amount)).join(' ');
  assert.ok(
    solved3.applyAlg(new Alg(sample3)).isIdentical(solved3.applyAlg(new Alg(`${hwAlg3} z2 y`))),
    '3x3 rotated hardware moves must match z2 y scramble mathematically'
  );

  // 2x2x2 with z2 / z2 y / x' (all bottom colors): verify pure {U,R,F} hardware moves & 2x2 KPuzzle match
  const kp2 = await puzzles['2x2x2'].kpuzzle();
  const solved2 = kp2.defaultPattern();
  const rots2 = [];
  for (let x = 0; x < 4; x++) {
    for (let y = 0; y < 4; y++) {
      for (let z = 0; z < 4; z++) {
        const s = [x ? `x${x}` : '', y ? `y${y}` : '', z ? `z${z}` : ''].filter(Boolean).join(' ');
        const pat = solved2.applyAlg(new Alg(s));
        if (!rots2.some(r => r.pat.isIdentical(pat))) rots2.push({ s, pat });
      }
    }
  }

  for (const orientedScr of ["z2 R U R' U'", "z2 y2 F R' F' R U2", "x' R2 U' R2 U2 F2"]) {
    const tracker222 = new ScrambleTracker(orientedScr, { is2x2: true });
    for (const m of tracker222.moves) {
      assert.match(m.face, /^[URF]$/, `2x2 hardware face must be U, R, or F, got ${m.face}`);
    }
    const hwSeq = tracker222.moves.map(m => formatMove(m.face, m.amount)).join(' ');
    const expected = solved2.applyAlg(new Alg(orientedScr));
    const equiv = rots2.some(r => expected.isIdentical(solved2.applyAlg(new Alg(`${hwSeq} ${r.s}`.trim()))));
    assert.ok(equiv, `"${orientedScr}" -> "${hwSeq}" must match on 2x2 KPuzzle up to whole-cube rotation`);

    // Simulate physical cube completing all mapped hardware turns
    for (const m of tracker222.moves) {
      tracker222.applyMove(formatMove(m.face, m.amount));
    }
    assert.strictEqual(tracker222.isComplete(), true);
  }

  // Orientation label formatting for Dual Color / multi-color drills
  assert.strictEqual(describeTrainingBottomOrientation("z2 R U R'", "cll"), "(White bottom · z2)");
  assert.strictEqual(describeTrainingBottomOrientation("z2 y' R U R'", "cll"), "(White bottom · z2 y')");
  assert.strictEqual(describeTrainingBottomOrientation("y2 R U R'", "cll"), "(Yellow bottom · y2)");
  assert.strictEqual(describeTrainingBottomOrientation("R U R'", "cll"), "(Yellow bottom · WCA)");
  assert.strictEqual(describeTrainingBottomOrientation("R U R'", "full"), "(WCA orientation)");
});

test('ScrambleTracker reports user-grip nextRequired and undo corrections across rotated 2x2 and 3x3 scrambles', () => {
  // Exact 2x2 scramble from MoYu WCU_MY22 diagnostic log: y' U F R2 F U2 F2 U2 F2 R' U' R U'
  const scr = "y' U F R2 F U2 F2 U2 F2 R' U' R U'";
  const tracker = new ScrambleTracker(scr, { is2x2: true });
  assert.deepStrictEqual(tracker.leadingRotations, ["y'"]);

  // Steps 0..4: U, F (BLE R), R2 (BLE U2), F (BLE R), U2 (BLE U2)
  assert.strictEqual(tracker.getStatus().nextRequired, 'U');
  tracker.applyMove('U');
  assert.strictEqual(tracker.getStatus().nextRequired, 'F');
  tracker.applyMove('R'); // user's F -> BLE R
  assert.strictEqual(tracker.getStatus().nextRequired, 'R2');
  tracker.applyMove('U');
  tracker.applyMove('U');
  assert.strictEqual(tracker.getStatus().nextRequired, 'F');
  tracker.applyMove('R'); // user's F -> BLE R
  assert.strictEqual(tracker.getStatus().nextRequired, 'U2');

  // Off-track move at step 4: BLE F (which is user's R) -> correction must say "R'", NOT "F'"
  tracker.applyMove('F');
  assert.strictEqual(tracker.getStatus().hasError, true);
  assert.deepStrictEqual(tracker.getStatus().corrections, ["R'"]);
  tracker.applyMove("F'"); // undo with user's R' -> clears error cleanly
  assert.strictEqual(tracker.getStatus().hasError, false);
  assert.strictEqual(tracker.getStatus().nextRequired, 'U2');

  // Complete U2 (BLE U2), then verify step 5 (F2 -> BLE R2) says nextRequired === 'F2'
  tracker.applyMove('U');
  tracker.applyMove('U');
  assert.strictEqual(tracker.getStatus().nextRequired, 'F2');
  tracker.applyMove('R');
  assert.strictEqual(tracker.getStatus().nextRequired, 'F'); // half of F2
  assert.ok(tracker.getHtml({ suppressSubAmount: false }).includes('(F needed)'));
  tracker.applyMove('R');
  assert.strictEqual(tracker.getStatus().nextRequired, 'U2');

  // Complete steps 6..7 (U2 -> BLE U2, F2 -> BLE R2), then step 8 (R' -> BLE F')
  tracker.applyMove('U');
  tracker.applyMove('U');
  tracker.applyMove('R');
  tracker.applyMove('R');
  assert.strictEqual(tracker.getStatus().nextRequired, "R'");
  tracker.applyMove("F'");

  // Step 9: U' (BLE U'), step 10: R (BLE F, must say nextRequired 'R'!), step 11: U'
  assert.strictEqual(tracker.getStatus().nextRequired, "U'");
  tracker.applyMove("U'");
  assert.strictEqual(tracker.getStatus().nextRequired, 'R');
  tracker.applyMove('F');
  assert.strictEqual(tracker.getStatus().nextRequired, "U'");
  tracker.applyMove("U'");
  assert.strictEqual(tracker.isComplete(), true);

  // 3x3 with z2: nextRequired and off-track undo corrections stay in user's z2 grip
  const t3 = new ScrambleTracker("z2 R U2 R' U'", { is2x2: false });
  assert.strictEqual(t3.getStatus().nextRequired, 'R');
  t3.applyMove('F'); // wrong front face -> undo F'
  assert.deepStrictEqual(t3.getStatus().corrections, ["F'"]);
  t3.applyMove("F'");
  t3.applyMove('L'); // hardware L = user R
  assert.strictEqual(t3.getStatus().nextRequired, 'U2');
  t3.applyMove('L'); // accidental user R (hardware L) instead of U2 -> correction must say "R'", not "L'"
  assert.deepStrictEqual(t3.getStatus().corrections, ["R'"]);
  t3.applyMove("L'");
  assert.strictEqual(t3.getStatus().hasError, false);
  assert.strictEqual(t3.getStatus().nextRequired, 'U2');

  // Dual color (W/Y) drill scrambles must not emit unnecessary y/y2/y' rotations
  for (let i = 0; i < 25; i++) {
    const res = buildCaseScramble({
      caseObj: { id: 'T1', scrambles: ["R U R' U'"] },
      trainingBottomFaces: ['white', 'yellow'],
      allowAUF: true,
      isStudy: false
    });
    assert.ok(!/\by[2']?\b/.test(res.scramble), `Unexpected y rotation in Dual Color scramble: ${res.scramble}`);
  }
});



