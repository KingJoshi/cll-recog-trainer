import test from 'node:test';
import assert from 'node:assert';
import { Alg } from 'cubing/alg';
import { getSolveTargetLabel } from '../src/data/algRegistry.js';
import { resolveSessionForTarget } from '../src/state/sessionStore.js';
import { formatSolveDisplay } from '../src/services/htmlUtils.js';
import { smartCube, getSolvedPatterns, evaluatePatternFinishState } from '../src/smartCube.js';
import { AppStore } from '../src/state/appStore.js';
import { createTimerController } from '../src/features/solve/timerController.js';

test('getSolveTargetLabel returns clean target labels across puzzles', () => {
  assert.strictEqual(getSolveTargetLabel('333', 'timer-drill'), 'Timer Drill');
  assert.strictEqual(getSolveTargetLabel('222', 'timer-drill'), 'Timer Drill');
  assert.strictEqual(getSolveTargetLabel('333', 'full'), 'Full Solve');
  assert.strictEqual(getSolveTargetLabel('222', 'layer'), '1st Layer');
  assert.strictEqual(getSolveTargetLabel('222', 'face'), '1st Face');
  assert.strictEqual(getSolveTargetLabel('333', 'pll'), 'PLL (21)');
  assert.strictEqual(getSolveTargetLabel('333', 'cross'), 'White Cross');
  assert.strictEqual(getSolveTargetLabel('444', 'parity'), 'Parity');
});

test('resolveSessionForTarget switches, retargets empty, and creates dedicated sessions cleanly', () => {
  const s1 = { id: 's1', puzzle: '333', name: '3x3 Main', target: 'full', solves: [{ ms: 12000, at: 1000 }] };
  const s2 = { id: 's2', puzzle: '333', name: '3x3 Timer Drill', target: 'timer-drill', solves: [{ ms: 1500, at: 2000 }] };
  const sEmpty = { id: 's3', puzzle: '333', name: '3x3 Scratch', target: 'full', solves: [] };

  // 1. Unchanged when active already matches puzzle & target
  const resSame = resolveSessionForTarget([s1, s2], 's1', '333', 'full', { puzzleShortName: '3x3', targetLabel: 'Full Solve' });
  assert.strictEqual(resSame.action, 'unchanged');
  assert.strictEqual(resSame.session.id, 's1');

  // 2. Switches to existing session for target without mutating previous session
  const resSwitch = resolveSessionForTarget([s1, s2], 's1', '333', 'timer-drill', { puzzleShortName: '3x3', targetLabel: 'Timer Drill' });
  assert.strictEqual(resSwitch.action, 'switched');
  assert.strictEqual(resSwitch.session.id, 's2');
  assert.strictEqual(s1.target, 'full');

  // 3. Creates a new dedicated session when active has solves for a different target
  const resCreate = resolveSessionForTarget([s1], 's1', '333', 'timer-drill', { puzzleShortName: '3x3', targetLabel: 'Timer Drill' });
  assert.strictEqual(resCreate.action, 'created');
  assert.strictEqual(resCreate.session.puzzle, '333');
  assert.strictEqual(resCreate.session.target, 'timer-drill');
  assert.strictEqual(resCreate.session.name, '3x3 Timer Drill');
  assert.deepStrictEqual(resCreate.session.solves, []);

  // 4. Deduplicates created session name if same name already exists
  const existingSameName = { id: 's4', puzzle: '222', name: '3x3 PLL (21)', target: 'full', solves: [] };
  const resCreateDup = resolveSessionForTarget([s1, existingSameName], 's1', '333', 'pll', { puzzleShortName: '3x3', targetLabel: 'PLL (21)' });
  assert.strictEqual(resCreateDup.action, 'created');
  assert.strictEqual(resCreateDup.session.name, '3x3 PLL (21) 2');

  // 5. Retargets empty current session instead of creating another empty session
  const resRetarget = resolveSessionForTarget([sEmpty], 's3', '333', 'oll', { puzzleShortName: '3x3', targetLabel: 'OLL (57)' });
  assert.strictEqual(resRetarget.action, 'retargeted');
  assert.strictEqual(resRetarget.session.id, 's3');
  assert.strictEqual(resRetarget.session.target, 'oll');
});

test('formatSolveDisplay includes recorded time for DNF solves and (+2) for +2 penalties', () => {
  assert.strictEqual(formatSolveDisplay({ rawMs: 11420, ms: 11420, penalty: 'DNF' }), 'DNF (11.42)');
  assert.strictEqual(formatSolveDisplay({ ms: 9500, penalty: -1 }), 'DNF (9.50)');
  assert.strictEqual(formatSolveDisplay({ rawMs: 0, ms: 0, penalty: 'DNF' }), 'DNF');
  assert.strictEqual(formatSolveDisplay({ penalty: 'DNF' }), 'DNF');
  assert.strictEqual(formatSolveDisplay({ rawMs: 11420, penalty: '+2' }), '13.42 (+2)');
  assert.strictEqual(formatSolveDisplay({ rawMs: 11420, penalty: null }), '11.42');
});

test('evaluatePatternFinishState detects solved, 1-move +2 (quarter/double/rotated), and DNF on 3x3 and 2x2', async () => {
  for (const puzzleId of ['333', '222']) {
    const info = await getSolvedPatterns(puzzleId);
    assert.ok(info && info.patterns.length >= 24, `Expected solved orientations for ${puzzleId}`);

    // Solved orientation
    assert.strictEqual(evaluatePatternFinishState(info.defaultPat, info.patterns), 'solved');
    assert.strictEqual(evaluatePatternFinishState(info.patterns[5], info.patterns), 'solved');

    // 1 quarter turn away -> +2
    assert.strictEqual(evaluatePatternFinishState(info.defaultPat.applyAlg(new Alg('U')), info.patterns), '+2');
    assert.strictEqual(evaluatePatternFinishState(info.defaultPat.applyAlg(new Alg("R'")), info.patterns), '+2');
    assert.strictEqual(evaluatePatternFinishState(info.defaultPat.applyAlg(new Alg('F')), info.patterns), '+2');

    // 1 double turn away -> +2
    assert.strictEqual(evaluatePatternFinishState(info.defaultPat.applyAlg(new Alg('U2')), info.patterns), '+2');
    assert.strictEqual(evaluatePatternFinishState(info.defaultPat.applyAlg(new Alg('R2')), info.patterns), '+2');
    assert.strictEqual(evaluatePatternFinishState(info.defaultPat.applyAlg(new Alg('D2')), info.patterns), '+2');

    // Rotated solved + 1 move away -> +2
    const rotatedOneAway = info.defaultPat.applyAlg(new Alg('y x R2'));
    assert.strictEqual(evaluatePatternFinishState(rotatedOneAway, info.patterns), '+2');

    // 2+ moves away -> DNF
    assert.strictEqual(evaluatePatternFinishState(info.defaultPat.applyAlg(new Alg('R U')), info.patterns), 'DNF');
    assert.strictEqual(evaluatePatternFinishState(info.defaultPat.applyAlg(new Alg("R U R' U'")), info.patterns), 'DNF');
  }
});

test('timerController.stopSolve applies +2 / DNF when smart cube is unsolved and gates next scramble until reset', async () => {
  const prevStatus = smartCube.status;
  const prevName = smartCube.deviceName;
  const prevPattern = smartCube.currentPattern;
  const prevSolvedPatterns = smartCube.solvedPatterns;
  const prevPerfNow = performance.now;

  const info = await getSolvedPatterns('333');
  let nowMs = 1000;
  performance.now = () => nowMs;
  smartCube.status = 'connected';
  smartCube.deviceName = 'TestMoyu';
  smartCube.solvedPatterns = info.patterns;

  let stage = 'ready';
  let resetReason = null;
  let regenerateCalls = 0;
  let completedResetCalls = 0;

  const scUi = {
    getSmartCubeStage: () => stage,
    setSmartCubeStage: (next) => { stage = next; },
    setNeedsCubeReset: (reason) => {
      resetReason = reason;
      stage = 'needs_reset';
    },
    completeCubeReset: () => {
      completedResetCalls++;
      resetReason = null;
      stage = 'scrambling';
    },
    updateSmartCubeIndicator: () => {},
    clearScrambleCorrectionDelay: () => {},
    resetScrambleTracker: () => {},
    renderSmartScrambleAssistant: () => {}
  };

  const store = new AppStore();
  store.state.mode = 'solve';
  store.state.currentPuzzle = '333';
  store.state.solveTarget = 'full';
  store.state.solveInspection = false;
  store.state.currentSolveScramble = "R U";

  const timerCtrl = createTimerController({
    appStore: store,
    solveReplayViewer: { open: () => {} },
    getNavCtrl: () => ({ regenerateScramble: () => { regenerateCalls++; } }),
    getSmartCubeUi: () => scUi
  });

  try {
    // Case A: +2 (1 double turn U2 away from solved when Spacebar stopped)
    timerCtrl.armSolve();
    timerCtrl.onSolveKeyUp({ code: 'Space', preventDefault: () => {} });
    assert.strictEqual(timerCtrl.getSolveState(), 'running');

    nowMs = 1400;
    timerCtrl.recordRunningMove('R', false);
    smartCube.currentPattern = info.defaultPat.applyAlg(new Alg('U2'));

    nowMs = 9400; // rawMs = 8400
    timerCtrl.onSolveKeyDown({ code: 'Space', preventDefault: () => {} });

    const plus2Solve = store.state.lastSolve;
    assert.strictEqual(plus2Solve.penalty, '+2');
    assert.strictEqual(plus2Solve.rawMs, 8400);
    assert.strictEqual(plus2Solve.ms, 10400);
    assert.strictEqual(plus2Solve.finishState, '+2');
    assert.strictEqual(plus2Solve.pickupMs, 400);
    assert.strictEqual(plus2Solve.cubeMs, null);
    assert.strictEqual(stage, 'needs_reset');
    assert.strictEqual(resetReason, '+2');
    assert.strictEqual(regenerateCalls, 0);

    // Solving cube triggers auto-reset
    timerCtrl.handleSmartCubeSolved();
    assert.strictEqual(completedResetCalls, 1);
    assert.strictEqual(stage, 'scrambling');

    // Case B: DNF (2 moves away when Spacebar stopped)
    stage = 'ready';
    nowMs = 20000;
    timerCtrl.armSolve();
    timerCtrl.onSolveKeyUp({ code: 'Space', preventDefault: () => {} });

    nowMs = 20300;
    timerCtrl.recordRunningMove('R', false);
    smartCube.currentPattern = info.defaultPat.applyAlg(new Alg("R U"));

    nowMs = 31420; // rawMs = 11420
    timerCtrl.onSolveKeyDown({ code: 'Space', preventDefault: () => {} });

    const dnfSolve = store.state.lastSolve;
    assert.strictEqual(dnfSolve.penalty, 'DNF');
    assert.strictEqual(dnfSolve.rawMs, 11420);
    assert.strictEqual(dnfSolve.ms, 11420);
    assert.strictEqual(dnfSolve.finishState, 'DNF');
    assert.strictEqual(stage, 'needs_reset');
    assert.strictEqual(resetReason, 'DNF');
    assert.strictEqual(regenerateCalls, 0);
    assert.strictEqual(formatSolveDisplay(dnfSolve), 'DNF (11.42)');
  } finally {
    timerCtrl.cancelSolve();
    performance.now = prevPerfNow;
    smartCube.status = prevStatus;
    smartCube.deviceName = prevName;
    smartCube.currentPattern = prevPattern;
    smartCube.solvedPatterns = prevSolvedPatterns;
  }
});
