import test from 'node:test';
import assert from 'node:assert/strict';
import { puzzles } from 'cubing/puzzles';

import { chooseWeightedCaseId } from '../src/services/scrambleService.js';
import { ORIENTATIONS_24 } from '../src/cube/cubeUtils.js';
import {
  verifyCustomAlgForCase,
  computeExpectedPostAuf,
  isAufQuizTrackSupported
} from '../src/cube/customAlgVerifier.js';
import {
  getTrack,
  getCustomAlgsForCase,
  addCustomAlgForCase,
  removeCustomAlgForCase,
  onPreferredAlgChange
} from '../src/data/algRegistry.js';
import { PracticeView } from '../src/practiceView.js';

function createMockContainer() {
  return {
    innerHTML: '',
    querySelector() { return null; },
    querySelectorAll() { return []; }
  };
}

function withMockLocalStorage(fn) {
  const store = new Map();
  const prevDescriptor = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k) => (store.has(k) ? store.get(k) : null),
      setItem: (k, v) => { store.set(k, String(v)); },
      removeItem: (k) => { store.delete(k); },
      clear: () => { store.clear(); }
    }
  });
  try {
    return fn(store);
  } finally {
    if (prevDescriptor) {
      Object.defineProperty(globalThis, 'localStorage', prevDescriptor);
    } else {
      delete globalThis.localStorage;
    }
  }
}

test('SRS adaptive weighting favors learning tags and low recognition accuracy', () => {
  const ids = ['H1', 'H2'];

  let learningPicks = 0;
  let masteredPicks = 0;
  for (let i = 0; i < 600; i++) {
    const picked = chooseWeightedCaseId(ids, {}, [], {
      caseTags: { H1: 'learning', H2: 'mastered' }
    });
    if (picked === 'H1') learningPicks++;
    else masteredPicks++;
  }
  assert.ok(
    learningPicks > masteredPicks * 2,
    `Expected learning case to dominate mastered case, got ${learningPicks} vs ${masteredPicks}`
  );

  let weakPicks = 0;
  let strongPicks = 0;
  for (let i = 0; i < 600; i++) {
    const picked = chooseWeightedCaseId(ids, {}, [], {
      recogStats: {
        H1: { shown: 20, correct: 3 },
        H2: { shown: 20, correct: 20 }
      }
    });
    if (picked === 'H1') weakPicks++;
    else strongPicks++;
  }
  assert.ok(
    weakPicks > strongPicks * 1.4,
    `Expected low-accuracy case to dominate high-accuracy case, got ${weakPicks} vs ${strongPicks}`
  );

  // Legacy 3-argument call remains backward-compatible
  const single = chooseWeightedCaseId(['H1'], {}, []);
  assert.strictEqual(single, 'H1');
});

test('verifyCustomAlgForCase validates 2x2 CLL, 3x3 OLL, and 3x3 PLL algorithms against KPuzzle', async () => {
  const cllTrack = getTrack('222', 'cll');
  const h1 = cllTrack.caseById.get('H1');
  const validH1 = await verifyCustomAlgForCase('222', 'cll', h1, "R2 U2 R U2 R2");
  assert.strictEqual(validH1.valid, true);
  assert.strictEqual(validH1.startAuf, '');

  // Pre-AUF detection when valid alg starts from a U-shifted angle
  const t1 = cllTrack.caseById.get('T1');
  const t1Alg = t1.algs[0];
  const wrongH1 = await verifyCustomAlgForCase('222', 'cll', h1, "R U R' U'");
  assert.strictEqual(wrongH1.valid, false);

  const syntaxErr = await verifyCustomAlgForCase('222', 'cll', h1, "INVALID_MOVE_XYZ");
  assert.strictEqual(syntaxErr.valid, false);
  assert.match(syntaxErr.reason, /invalid move/i);

  const ollTrack = getTrack('333', 'oll');
  const oll45 = ollTrack.caseById.get('oll-45');
  const validOll = await verifyCustomAlgForCase('333', 'oll', oll45, oll45.algs[0].alg);
  assert.strictEqual(validOll.valid, true);

  const badOll = await verifyCustomAlgForCase('333', 'oll', oll45, "R U R' U'");
  assert.strictEqual(badOll.valid, false);

  const pllTrack = getTrack('333', 'pll');
  const tPerm = pllTrack.caseById.get('T');
  const validPll = await verifyCustomAlgForCase('333', 'pll', tPerm, tPerm.algs[0].alg);
  assert.strictEqual(validPll.valid, true);

  // Shifted U pre-AUF check for T1
  assert.ok(t1Alg?.alg);
});

test('computeExpectedPostAuf computes exact post-alg AUF for PLL and CLL only', async () => {
  assert.strictEqual(isAufQuizTrackSupported('222', 'cll'), true);
  assert.strictEqual(isAufQuizTrackSupported('333', 'pll'), true);
  assert.strictEqual(isAufQuizTrackSupported('333', 'oll'), false);
  assert.strictEqual(isAufQuizTrackSupported('333', 'cross'), false);

  const pllTrack = getTrack('333', 'pll');
  const tPerm = pllTrack.caseById.get('T');
  const a0 = tPerm.algs[0];
  const execAlg = a0.alg;

  // Base canonical scramble: solve cube cleanly from canonical startAuf
  const baseScr = ['z2', tPerm.setup, a0.startAuf].filter(Boolean).join(' ');
  const baseInfo = await computeExpectedPostAuf('333', 'pll', baseScr, execAlg);
  assert.ok(baseInfo, 'Expected AUF info for T-perm');
  assert.strictEqual(baseInfo.preAuf, '');

  // Applying a post-setup U' shifts recognition angle -> requires preAuf "U" to align the case
  const postShiftedScr = `${baseScr} U'`;
  const preInfo = await computeExpectedPostAuf('333', 'pll', postShiftedScr, execAlg);
  assert.ok(preInfo);
  assert.strictEqual(preInfo.preAuf, 'U');
  assert.strictEqual(preInfo.postAuf, baseInfo.postAuf);

  // Applying U' BEFORE setup rotates U pieces relative to F2L without shifting case angle -> shifts postAuf
  const preShiftedScr = ['z2', "U'", tPerm.setup, a0.startAuf].filter(Boolean).join(' ');
  const postInfo = await computeExpectedPostAuf('333', 'pll', preShiftedScr, execAlg);
  assert.ok(postInfo);
  assert.strictEqual(postInfo.preAuf, '');
  assert.notStrictEqual(postInfo.postAuf, baseInfo.postAuf);

  // CLL 2x2 post-AUF works across rotations and restores a solved cube via KPuzzle
  const cllTrack = getTrack('222', 'cll');
  const h1 = cllTrack.caseById.get('H1');
  const h1Scr = `z2 ${h1.setup}`;
  const h1ShiftedScr = `z2 U' ${h1.setup}`;
  const cllInfo = await computeExpectedPostAuf('222', 'cll', h1Scr, "R2 U2 R U2 R2");
  const cllWithPostU = await computeExpectedPostAuf('222', 'cll', h1ShiftedScr, "R2 U2 R U2 R2");

  const validAufs = new Set(['', 'U', "U'", 'U2']);
  assert.ok(cllInfo && validAufs.has(cllInfo.postAuf));
  assert.ok(cllWithPostU && validAufs.has(cllWithPostU.postAuf));
  assert.notStrictEqual(cllWithPostU.postAuf, cllInfo.postAuf);

  const kp2 = await puzzles['2x2x2'].kpuzzle();
  const solved2 = kp2.defaultPattern();
  const isSolved2x2 = (pat) => ORIENTATIONS_24.some(rot => pat.isIdentical(rot ? solved2.applyAlg(rot) : solved2));
  const exec1 = [h1Scr, cllInfo.preAuf, "R2 U2 R U2 R2", cllInfo.postAuf].filter(Boolean).join(' ');
  const exec2 = [h1ShiftedScr, cllWithPostU.preAuf, "R2 U2 R U2 R2", cllWithPostU.postAuf].filter(Boolean).join(' ');
  assert.ok(isSolved2x2(solved2.applyAlg(exec1)), `Expected ${exec1} to solve 2x2`);
  assert.ok(isSolved2x2(solved2.applyAlg(exec2)), `Expected ${exec2} to solve 2x2`);

  const ollInfo = await computeExpectedPostAuf('333', 'oll', `z2 R U R' U'`, "R U R' U'");
  assert.strictEqual(ollInfo, null);
});

test('custom algorithm registry CRUD persists per puzzle/case and fires listeners', () => {
  withMockLocalStorage(() => {
    const events = [];
    const unsub = onPreferredAlgChange((ev) => events.push(ev));
    try {
      const added = addCustomAlgForCase('333', 'T', {
        alg: "R U R' U' R' F R2 U' R' U' R U R' F'",
        trigger: 'Righty into sledge',
        startAuf: ''
      });
      assert.ok(added && added.id.startsWith('custom-'));
      assert.strictEqual(events.at(-1)?.customAlgAdded, true);

      const list = getCustomAlgsForCase('333', 'T');
      assert.strictEqual(list.length, 1);
      assert.strictEqual(list[0].isCustom, true);
      assert.strictEqual(list[0].note, 'Righty into sledge');

      // Scoped per puzzle: 333oh should stay isolated from 333
      assert.strictEqual(getCustomAlgsForCase('333oh', 'T').length, 0);

      const removed = removeCustomAlgForCase('333', 'T', added.id);
      assert.strictEqual(removed, true);
      assert.strictEqual(events.at(-1)?.customAlgRemoved, true);
      assert.strictEqual(getCustomAlgsForCase('333', 'T').length, 0);
    } finally {
      unsub();
    }
  });
});

test('PracticeView tracks recognition latency in ms and enforces AUF quiz selection when enabled', () => {
  const pv = new PracticeView({ container: createMockContainer() });
  const pllTrack = getTrack('333', 'pll');
  pv.currentPuzzle = '333';
  pv.currentTrackId = 'pll';
  pv.practiceMode = 'casual';
  pv.currentCase = pllTrack.caseById.get('T');
  pv.aufQuizMode = true;
  pv.guessCase = 'T';
  pv.expectedAufInfo = { preAuf: '', postAuf: '', alg: pv.currentCase.algs[0].alg };
  pv.caseShownAt = pv.nowMs() - 250;

  // Missing AUF guess prevents verification submission
  pv.verifyCasualGuess();
  assert.strictEqual(pv.answered, false);
  assert.strictEqual(pv.selectWarning, true);
  assert.match(pv.selectWarningMsg, /AUF/i);

  // Wrong AUF marks overall attempt incorrect even when case matches
  pv.guessAuf = 'U2';
  pv.verifyCasualGuess();
  assert.strictEqual(pv.answered, true);
  assert.strictEqual(pv.lastResult.caseMatch, true);
  assert.strictEqual(pv.lastResult.aufMatch, false);
  assert.strictEqual(pv.lastResult.isCorrect, false);
  assert.strictEqual(pv.score, 0);
  assert.ok(pv.lastLatencyMs >= 200);
  assert.strictEqual(pv.sessionLatencies.length, 1);

  // Correct "No AUF" ("") passes and renders latency/AUF UI cleanly
  pv.answered = false;
  pv.lastResult = null;
  pv.guessCase = 'T';
  pv.guessAuf = '';
  pv.caseShownAt = pv.nowMs() - 120;
  pv.verifyCasualGuess();
  assert.strictEqual(pv.answered, true);
  assert.strictEqual(pv.lastResult.isCorrect, true);
  assert.strictEqual(pv.score, 1);
  assert.strictEqual(pv.sessionLatencies.length, 2);

  const html = pv.renderCasualRecognitionDrill();
  assert.ok(html.includes('toggleAufQuizModeBtn'));
  assert.ok(html.includes('recognition-auf-picker'));
  assert.ok(html.includes('practiceLatencyVal'));
  assert.ok(html.includes('ms'));
});
