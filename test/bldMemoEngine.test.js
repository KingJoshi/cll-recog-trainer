import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getKpuzzle } from '../src/cube/cubeUtils.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
import {
  OP_T_PERM,
  OP_PARITY_RA_PERM,
  getOpEdgeAlg,
  getOpCornerAlg,
  parseLetterPairsInput,
  formatLetterPairs,
  generateBldScramble,
  computeCanonicalBldMemo,
  verifyBldMemoAnswer,
  buildBldSimulationPayload
} from '../src/cube/bldMemoEngine.js';
import { parseScrambleInput } from '../src/algParser.js';
import { BldMemoTrainer } from '../src/features/practice/bldMemoTrainer.js';

test('parseLetterPairsInput and formatLetterPairs handle separators, case, and invalid chars cleanly', () => {
  const clean = parseLetterPairsInput('aq fj-pt, k');
  assert.deepStrictEqual(clean.letters, ['A', 'Q', 'F', 'J', 'P', 'T', 'K']);
  assert.deepStrictEqual(clean.invalidChars, []);
  assert.strictEqual(formatLetterPairs(clean.letters), 'AQ FJ PT K');

  const bad = parseLetterPairsInput('AB YZ 1!');
  assert.deepStrictEqual(bad.letters, ['A', 'B']);
  assert.deepStrictEqual(bad.invalidChars, ['Y', 'Z', '1', '!']);
});

test('All 22 OP edge algs, 21 OP corner algs, and Ra-Perm are valid involutions on 3x3x3 KPuzzle', async () => {
  const kp = await getKpuzzle('3x3x3');
  const solved = kp.defaultPattern();

  for (let code = 65; code <= 88; code++) {
    const ch = String.fromCharCode(code);
    const edgeAlg = getOpEdgeAlg(ch);
    if (ch === 'B' || ch === 'M') {
      assert.strictEqual(edgeAlg, null, `Edge buffer ${ch} must return null`);
    } else {
      assert.ok(edgeAlg, `Expected OP edge alg for ${ch}`);
      assert.ok(
        solved.applyAlg(edgeAlg).applyAlg(edgeAlg).isIdentical(solved),
        `OP edge alg ${ch} must be an involution`
      );
    }

    const cornerAlg = getOpCornerAlg(ch);
    if (ch === 'A' || ch === 'E' || ch === 'R') {
      assert.strictEqual(cornerAlg, null, `Corner buffer ${ch} must return null`);
    } else {
      assert.ok(cornerAlg, `Expected OP corner alg for ${ch}`);
      assert.ok(
        solved.applyAlg(cornerAlg).applyAlg(cornerAlg).isIdentical(solved),
        `OP corner alg ${ch} must be an involution`
      );
    }
  }

  assert.ok(
    solved.applyAlg(OP_PARITY_RA_PERM).applyAlg(OP_PARITY_RA_PERM).isIdentical(solved),
    'OP_PARITY_RA_PERM must be an involution'
  );
});

test('generateBldScramble produces concise standard WCA 3x3 scrambles verifiable across edges, corners, and both modes', async () => {
  for (const mode of ['edges', 'corners', 'both']) {
    for (let i = 0; i < 3; i++) {
      const scr = await generateBldScramble(mode);
      assert.ok(typeof scr === 'string' && scr.trim().length > 0);
      const tokens = scr.trim().split(/\s+/);
      assert.ok(tokens.length >= 10 && tokens.length <= 25, `Expected concise WCA scramble (<= 25 moves), got ${tokens.length}: ${scr}`);
      for (const tok of tokens) {
        assert.match(tok, /^[UDLRFB](2|')?$/, `Unexpected token ${tok} in WCA 3BLD scramble`);
      }

      const canon = await computeCanonicalBldMemo(scr);
      const okRes = await verifyBldMemoAnswer({
        scramble: scr,
        mode,
        edgeInput: mode === 'corners' ? '' : canon.edgePairs,
        cornerInput: mode === 'edges' ? '' : canon.cornerPairs
      });
      assert.strictEqual(okRes.isCorrect, true, `Expected canonical memo to solve ${mode} scramble: ${scr}`);
      assert.strictEqual(okRes.errors.length, 0);
      assert.strictEqual(okRes.remainingEdges.length, 0);
      assert.strictEqual(okRes.remainingCorners.length, 0);
    }
  }
});

test('verifyBldMemoAnswer accepts alternate sticker cycle breaks, handles parity, and catches errors/buffers', async () => {
  // Construct a scramble with a flipped UF edge (I/C) and parity (odd T-Perm swap)
  // Using an explicit pure edge flip on UF + UB: ("Lw D' L2 <T> ..." or UF-flipped = shoot C then I)
  const flippedUfScramble = `${getOpEdgeAlg('C')} ${getOpEdgeAlg('I')}`;
  const flippedResBoth = await verifyBldMemoAnswer({
    scramble: flippedUfScramble,
    mode: 'edges',
    edgeInput: 'C I'
  });
  assert.strictEqual(flippedResBoth.isCorrect, true);

  // Shooting the opposite sticker first (I then C) also flips UF in place and must be accepted!
  const flippedAlt = await verifyBldMemoAnswer({
    scramble: flippedUfScramble,
    mode: 'edges',
    edgeInput: 'I C'
  });
  assert.strictEqual(flippedAlt.isCorrect, true);

  // Full 3BLD parity scramble: inverse of (shoot D -> Ra-Perm -> shoot K, W, C -> ...)
  // Simple odd parity case: single T-Perm scramble leaves UL<->UR and UFR<->UBR swapped.
  // Executing edge 'D' swaps UL<->UR (and UFR<->UBR back), parity Ra-Perm swaps UB<->UL & UFR<->UBR,
  // wait: let computeCanonicalBldMemo verify a T-Perm scramble solves cleanly with parity!
  const parityMemo = await computeCanonicalBldMemo(OP_T_PERM);
  assert.strictEqual(parityMemo.hasParity, true);
  assert.strictEqual(parityMemo.edgePairs, 'D');
  const parityCheck = await verifyBldMemoAnswer({
    scramble: OP_T_PERM,
    mode: 'both',
    edgeInput: parityMemo.edgePairs,
    cornerInput: parityMemo.cornerPairs
  });
  assert.strictEqual(parityCheck.isCorrect, true);
  assert.strictEqual(parityCheck.appliedParity, true);

  // Odd-parity WCA scrambles also verify cleanly in standalone edges-only and corners-only modes
  const parityEdgesOnly = await verifyBldMemoAnswer({
    scramble: OP_T_PERM,
    mode: 'edges',
    edgeInput: parityMemo.edgePairs
  });
  assert.strictEqual(parityEdgesOnly.isCorrect, true);

  const parityCornersOnly = await verifyBldMemoAnswer({
    scramble: OP_T_PERM,
    mode: 'corners',
    cornerInput: parityMemo.cornerPairs
  });
  assert.strictEqual(parityCornersOnly.isCorrect, true);

  // Wrong answer fails with piece breakdown
  const wrong = await verifyBldMemoAnswer({
    scramble: flippedUfScramble,
    mode: 'edges',
    edgeInput: 'A Q'
  });
  assert.strictEqual(wrong.isCorrect, false);
  assert.strictEqual(wrong.edgesCorrect, false);
  assert.ok(wrong.remainingEdges.length > 0);

  // Buffer stickers rejected
  const bufEdge = await verifyBldMemoAnswer({
    scramble: flippedUfScramble,
    mode: 'edges',
    edgeInput: 'B C'
  });
  assert.strictEqual(bufEdge.isCorrect, false);
  assert.match(bufEdge.errors[0], /Buffer/i);

  const bufCorner = await verifyBldMemoAnswer({
    scramble: OP_T_PERM,
    mode: 'corners',
    cornerInput: 'E P'
  });
  assert.strictEqual(bufCorner.isCorrect, false);
  assert.match(bufCorner.errors[0], /Buffer/i);
});

test('BldMemoTrainer switches edges/corners/both modes and verifies answers via UI state', async () => {
  const prevDoc = globalThis.document;
  const mockInputs = {};
  const mockListeners = new Map();
  const makeQueryEl = (selector) => ({
    selector,
    disabled: false,
    textContent: '',
    innerHTML: '',
    value: '',
    isConnected: true,
    focus() {},
    addEventListener(type, fn) {
      const k = `${selector}:${type}`;
      mockListeners.set(k, fn);
    }
  });
  const container = {
    _html: '',
    set innerHTML(val) { this._html = val; },
    get innerHTML() { return this._html; },
    querySelectorAll(sel) {
      if (sel === '[data-bld-mode]') {
        return ['edges', 'corners', 'both'].map(m => ({
          dataset: { bldMode: m },
          addEventListener: (type, fn) => mockListeners.set(`mode-${m}:${type}`, fn)
        }));
      }
      return [];
    },
    querySelector(sel) {
      if (!mockInputs[sel]) mockInputs[sel] = makeQueryEl(sel);
      return mockInputs[sel];
    }
  };

  try {
    const applied = [];
    const flashed = [];
    const simPayloads = [];
    const trainer = new BldMemoTrainer({
      container,
      onApplyScrambleToDisplay: (s) => applied.push(s),
      onFlashCube: (res) => flashed.push(res),
      onQuickSimSolutions: (payload) => simPayloads.push(payload)
    });

    await trainer.init();
    assert.strictEqual(trainer.mode, 'both');
    assert.ok(trainer.scramble.length > 0);
    assert.strictEqual(applied.length, 1);

    await trainer.setMode('edges');
    assert.strictEqual(trainer.mode, 'edges');
    assert.match(container.innerHTML, /id="bldEdgeInput"/);
    assert.doesNotMatch(container.innerHTML, /id="bldCornerInput"/);

    // Solve the generated edges-only scramble
    const canonEdges = await computeCanonicalBldMemo(trainer.scramble);
    trainer.edgeInput = canonEdges.edgePairs;
    await trainer.checkAnswer();
    assert.strictEqual(trainer.score, 1);
    assert.strictEqual(trainer.streak, 1);
    assert.deepStrictEqual(flashed, ['correct']);
    assert.match(container.innerHTML, /Correct!/);
    assert.match(container.innerHTML, /id="bldSimUserBtn"/);

    const userSim = trainer.simulateUserMemo();
    assert.ok(userSim && userSim.solutions.length >= 2);
    assert.strictEqual(simPayloads.length, 1);
    assert.strictEqual(userSim.solutions[0].pillLabel, 'Full Solve');

    // Switch to corners only and submit wrong guess
    await trainer.setMode('corners');
    assert.strictEqual(trainer.mode, 'corners');
    assert.match(container.innerHTML, /id="bldCornerInput"/);
    assert.doesNotMatch(container.innerHTML, /id="bldEdgeInput"/);

    trainer.cornerInput = 'V';
    await trainer.checkAnswer();
    assert.strictEqual(trainer.streak, 0);
    assert.deepStrictEqual(flashed, ['correct', 'wrong']);
    assert.match(container.innerHTML, /Not quite solved/);
    assert.match(container.innerHTML, /id="bldSimUserBtn"/);

    await trainer.toggleSolutionReveal();
    assert.strictEqual(trainer.solutionRevealed, true);
    assert.match(container.innerHTML, /Any valid cycle break/);
    assert.match(container.innerHTML, /id="bldSimExampleBtn"/);

    const exSim = trainer.simulateExampleMemo();
    assert.ok(exSim && exSim.solutions.length >= 2);
    assert.strictEqual(simPayloads.length, 2);
  } finally {
    if (prevDoc === undefined) delete globalThis.document;
    else globalThis.document = prevDoc;
  }
});

test('buildBldSimulationPayload builds full and step-by-step QuickSim sequences that solve KPuzzle and parse cleanly', async () => {
  const kp = await getKpuzzle('3x3x3');
  const solved = kp.defaultPattern();

  // Odd-parity full scramble (OP_T_PERM) includes Edge step, Parity Ra-Perm, and Corner steps
  const canon = await computeCanonicalBldMemo(OP_T_PERM);
  const payload = buildBldSimulationPayload({
    scramble: OP_T_PERM,
    mode: 'both',
    edgeLetters: canon.edgeLetters,
    cornerLetters: canon.cornerLetters
  });

  assert.ok(payload);
  assert.strictEqual(payload.puzzle, '333');
  assert.strictEqual(payload.solutions[0].pillLabel, 'Full Solve');
  assert.ok(payload.solutions.some(s => s.pillLabel === 'Parity (Ra)'));
  assert.ok(payload.solutions.some(s => s.pillLabel.startsWith('E1:')));
  assert.ok(payload.solutions.some(s => s.pillLabel.startsWith('C1:')));

  // Every step parses cleanly via parseScrambleInput and cumulatively advances toward solved
  for (const sol of payload.solutions) {
    assert.strictEqual(parseScrambleInput(sol.scramble).ok, true);
    assert.strictEqual(parseScrambleInput(sol.moves).ok, true);
  }

  const fullSol = payload.solutions[0];
  assert.ok(solved.applyAlg(fullSol.scramble).applyAlg(fullSol.moves).isIdentical(solved));

  const lastStep = payload.solutions[payload.solutions.length - 1];
  assert.ok(solved.applyAlg(lastStep.scramble).applyAlg(lastStep.moves).isIdentical(solved));

  // Edges-only mode ignores corners and parity step
  const edgeOnlyPayload = buildBldSimulationPayload({
    scramble: OP_T_PERM,
    mode: 'edges',
    edgeLetters: canon.edgeLetters,
    cornerLetters: canon.cornerLetters
  });
  assert.strictEqual(edgeOnlyPayload.solutions.some(s => s.pillLabel === 'Parity (Ra)'), false);
  assert.strictEqual(edgeOnlyPayload.solutions.some(s => s.pillLabel.startsWith('C1:')), false);
});

test('main.js wires onApplyScrambleToDisplay into PracticeView so 3BLD scrambles update the 3D cube', () => {
  const mainJs = fs.readFileSync(path.join(ROOT, 'src/main.js'), 'utf8');
  const practiceBlockMatch = mainJs.match(/new PracticeView\(\{[\s\S]*?\n\}\)/);
  assert.ok(practiceBlockMatch, 'main.js must construct PracticeView');
  assert.match(practiceBlockMatch[0], /onApplyScrambleToDisplay\s*:/);
  assert.match(practiceBlockMatch[0], /cubeStage\.applyScrambleToDisplay/);
});
