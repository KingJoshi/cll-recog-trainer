import test from 'node:test';
import assert from 'node:assert';
import {
  GanTimerManager,
  ganTimerStateName,
  computeSolvePhaseSplits,
  averagePhase,
  shouldIgnorePrematureTimerStop
} from '../src/ganTimer.js';
import { exportSolvesToCSV } from '../src/sessions.js';
import { AppStore } from '../src/state/appStore.js';
import { smartCube } from '../src/smartCube.js';
import { createTimerController } from '../src/features/solve/timerController.js';
import { computeCfopAverages } from '../src/cfopAnalyzer.js';
import { renderCfopStepTable } from '../src/features/solve/cfopBreakdownRenderer.js';

test('ganTimerStateName translates numeric and string timer states', () => {
  assert.strictEqual(ganTimerStateName(0), 'DISCONNECT');
  assert.strictEqual(ganTimerStateName(1), 'GET_SET');
  assert.strictEqual(ganTimerStateName(2), 'HANDS_OFF');
  assert.strictEqual(ganTimerStateName(3), 'RUNNING');
  assert.strictEqual(ganTimerStateName(4), 'STOPPED');
  assert.strictEqual(ganTimerStateName(5), 'IDLE');
  assert.strictEqual(ganTimerStateName(6), 'HANDS_ON');
  assert.strictEqual(ganTimerStateName(7), 'FINISHED');
  assert.strictEqual(ganTimerStateName(99), 'UNKNOWN');
  assert.strictEqual(ganTimerStateName('RUNNING'), 'RUNNING');
});

test('computeSolvePhaseSplits calculates pick-up, cube solve, and put-down times', () => {
  // Smart cube + GAN timer solve
  const splits = computeSolvePhaseSplits({
    timerStartTs: 1000,
    firstMoveTs: 1450,
    solvedTs: 9200,
    timerStopTs: 9620
  });
  assert.strictEqual(splits.pickupMs, 450);
  assert.strictEqual(splits.cubeMs, 7750);
  assert.strictEqual(splits.putdownMs, 420);

  // Normal cube + GAN timer (no smart cube moves/solved timestamps)
  const normalCube = computeSolvePhaseSplits({
    timerStartTs: 1000,
    firstMoveTs: 0,
    solvedTs: 0,
    timerStopTs: 8500
  });
  assert.strictEqual(normalCube.pickupMs, null);
  assert.strictEqual(normalCube.cubeMs, null);
  assert.strictEqual(normalCube.putdownMs, null);

  // Pre-turn before timer started -> negative pickup is rejected as null
  const preTurn = computeSolvePhaseSplits({
    timerStartTs: 1500,
    firstMoveTs: 1200,
    solvedTs: 8000,
    timerStopTs: 8400
  });
  assert.strictEqual(preTurn.pickupMs, null);
  assert.strictEqual(preTurn.cubeMs, 6800);
  assert.strictEqual(preTurn.putdownMs, 400);
});

test('averagePhase computes mean of pickupMs / putdownMs ignoring DNFs and missing values', () => {
  const solves = [
    { ms: 9000, pickupMs: 400, putdownMs: 300 },
    { ms: 10000, pickupMs: 600, putdownMs: 500 },
    { ms: 11000, penalty: 'DNF', pickupMs: 2000, putdownMs: 2000 },
    { ms: 8500 } // normal solve without timer phases
  ];
  assert.strictEqual(averagePhase(solves, 'pickupMs'), 500);
  assert.strictEqual(averagePhase(solves, 'putdownMs'), 400);
  assert.strictEqual(averagePhase([], 'pickupMs'), null);
});

test('GanTimerManager processes timer events and emits timerstate / disconnected', () => {
  const mgr = new GanTimerManager();
  assert.strictEqual(mgr.isConnected(), false);

  const received = [];
  let disconnectedFired = false;
  mgr.addEventListener('timerstate', (e) => received.push(e.detail));
  mgr.addEventListener('disconnected', () => { disconnectedFired = true; });

  mgr._setStatus('connected');
  assert.strictEqual(mgr.isConnected(), true);

  mgr._onEvent({ state: 6 }); // HANDS_ON
  mgr._onEvent({ state: 1 }); // GET_SET
  mgr._onEvent({ state: 3 }); // RUNNING
  mgr._onEvent({ state: 4, recordedTime: { asTimestamp: 8432 } }); // STOPPED

  assert.strictEqual(received.length, 4);
  assert.strictEqual(received[0].state, 'HANDS_ON');
  assert.strictEqual(received[1].state, 'GET_SET');
  assert.strictEqual(received[2].state, 'RUNNING');
  assert.strictEqual(received[3].state, 'STOPPED');
  assert.strictEqual(received[3].recordedMs, 8432);

  // DISCONNECT event transitions manager to disconnected with reason: 'unexpected'
  let disconnectDetail = null;
  mgr.addEventListener('disconnected', (e) => { disconnectDetail = e.detail; });
  mgr._onEvent({ state: 0 });
  assert.strictEqual(mgr.isConnected(), false);
  assert.strictEqual(disconnectedFired, true);
  assert.strictEqual(disconnectDetail?.reason, 'unexpected');

  // Manual disconnect emits reason: 'manual'
  mgr._setStatus('connected');
  mgr.disconnect();
  assert.strictEqual(mgr.isConnected(), false);
  assert.strictEqual(disconnectDetail?.reason, 'manual');
});

test('exportSolvesToCSV includes Pickup, Cube Time, Putdown, and Timer columns', () => {
  const solves = [
    {
      ms: 8620,
      rawMs: 8620,
      penalty: 0,
      puzzle: '333',
      track: 'cfop',
      target: 'full',
      scramble: "R U R' U'",
      at: 1700000000000,
      inspectionMs: 4250,
      pickupMs: 450,
      cubeMs: 7750,
      putdownMs: 420,
      timer: 'GAN Smart Timer'
    }
  ];
  const csv = exportSolvesToCSV(solves, 'TimerTest');
  assert.ok(csv.includes('Inspection(s),Pickup(s),Cube Time(s),Putdown(s),Timer'));
  assert.ok(csv.includes('4.25,0.45,7.75,0.42,"GAN Smart Timer"'));
});

test('shouldIgnorePrematureTimerStop ignores false timer stops when smart cube is unsolved', () => {
  // Exact scenario from WCU_MY32_E00B + GAN Timer diagnostic log:
  // Timer stopped at 339ms before the first smart cube move (at 587ms)
  assert.strictEqual(
    shouldIgnorePrematureTimerStop({
      smartCubeConnected: true,
      smartCubeStage: 'solving',
      cubeSolved: false,
      moveCount: 0,
      firstMoveTs: 0,
      elapsedMs: 339
    }),
    true
  );

  // Early accidental pad brush at 1200ms after 2 turns while cube is still unsolved
  assert.strictEqual(
    shouldIgnorePrematureTimerStop({
      smartCubeConnected: true,
      smartCubeStage: 'solving',
      cubeSolved: false,
      moveCount: 2,
      firstMoveTs: 550,
      elapsedMs: 1200
    }),
    true
  );

  // Normal smart cube + GAN timer stop after cube is solved
  assert.strictEqual(
    shouldIgnorePrematureTimerStop({
      smartCubeConnected: true,
      smartCubeStage: 'solving',
      cubeSolved: true,
      moveCount: 58,
      firstMoveTs: 587,
      elapsedMs: 11100
    }),
    false
  );

  // Normal non-Bluetooth cube + GAN timer stop
  assert.strictEqual(
    shouldIgnorePrematureTimerStop({
      smartCubeConnected: false,
      smartCubeStage: 'idle',
      cubeSolved: false,
      moveCount: 0,
      firstMoveTs: 0,
      elapsedMs: 339
    }),
    false
  );

  // Recovery phase splits when auto-stopped by smart cube after a false timer stop:
  // pickupMs and cubeMs are preserved while putdownMs is null
  const recoveredSplits = computeSolvePhaseSplits({
    timerStartTs: 567273,
    firstMoveTs: 567860,
    solvedTs: 577967,
    timerStopTs: 0
  });
  assert.strictEqual(recoveredSplits.pickupMs, 587);
  assert.strictEqual(recoveredSplits.cubeMs, 10107);
  assert.strictEqual(recoveredSplits.putdownMs, null);
});

test('ganTimerStateName returns UNKNOWN for empty string and GanTimerManager handles sync disconnect cleanly', async () => {
  assert.strictEqual(ganTimerStateName(''), 'UNKNOWN');

  let statusHistory = [];
  const mockTimer = {
    deviceName: 'GAN-Timer',
    events$: {
      subscribe(observer) {
        observer.next({ state: 5 }); // IDLE
        observer.next({ state: 0 }); // immediate DISCONNECT during subscribe
        return { unsubscribe() {} };
      }
    },
    disconnect: async () => {}
  };

  const mgr = new GanTimerManager({ connectGanTimerFn: async () => mockTimer });
  mgr.addEventListener('statuschange', (e) => { statusHistory.push(e.detail?.status); });

  await mgr.connect();
  assert.strictEqual(mgr.isConnected(), false);
  assert.strictEqual(mgr.status, 'disconnected');
  assert.strictEqual(statusHistory.at(-1), 'disconnected');
});

test('Spacebar + Smart Cube records inspectionMs, pickupMs, cubeMs, putdownMs, and does not auto-stop on cube solved', () => {
  const prevStatus = smartCube.status;
  const prevName = smartCube.deviceName;
  const prevPerfNow = performance.now;

  let nowMs = 10000;
  performance.now = () => nowMs;
  smartCube.status = 'connected';
  smartCube.deviceName = 'TestGAN';

  let stage = 'inspecting';
  const scUi = {
    getSmartCubeStage: () => stage,
    setSmartCubeStage: (next) => { stage = next; },
    updateSmartCubeIndicator: () => {},
    clearScrambleCorrectionDelay: () => {},
    resetScrambleTracker: () => {},
    renderSmartScrambleAssistant: () => {}
  };

  const store = new AppStore();
  store.state.mode = 'solve';
  store.state.currentPuzzle = '333';
  store.state.solveTarget = 'full';
  store.state.solveInspection = true;
  store.state.currentSolveScramble = "R U R' U'";

  const timerCtrl = createTimerController({
    appStore: store,
    solveReplayViewer: { open: () => {} },
    getSmartCubeUi: () => scUi
  });

  try {
    // 1. Start inspection at t=10000
    timerCtrl.startSolveInspection();
    assert.strictEqual(timerCtrl.getSolveState(), 'inspecting');

    // 2. Arm after 4200ms of inspection and release Spacebar at t=14500 -> inspectionMs = 4500
    nowMs = 14200;
    timerCtrl.armSolve();
    assert.strictEqual(timerCtrl.getSolveState(), 'armed');

    nowMs = 14500;
    const handledUp = timerCtrl.onSolveKeyUp({ code: 'Space', preventDefault: () => {} });
    assert.strictEqual(handledUp, true);
    assert.strictEqual(timerCtrl.getSolveState(), 'running');
    assert.strictEqual(timerCtrl.isTimerDriven(), true);
    assert.strictEqual(timerCtrl.getTimerSource(), 'Spacebar');
    assert.strictEqual(stage, 'solving');

    // 3. First smart cube move at t=14900 -> pickupMs = 400
    nowMs = 14900;
    timerCtrl.recordRunningMove('R', false);

    // 4. Smart cube solved at t=22900 -> cubeMs = 8000, timer stays running waiting for Spacebar stop
    nowMs = 22900;
    timerCtrl.recordRunningMove("R'", false);
    timerCtrl.handleSmartCubeSolved();
    assert.strictEqual(timerCtrl.getSolveState(), 'running');

    // 5. Stop with Spacebar at t=23350 -> putdownMs = 450, rawMs = 8850
    nowMs = 23350;
    const handledStop = timerCtrl.onSolveKeyDown({ code: 'Space', preventDefault: () => {} });
    assert.strictEqual(handledStop, true);
    assert.strictEqual(timerCtrl.getSolveState(), 'idle');

    const last = store.state.lastSolve;
    assert.ok(last);
    assert.strictEqual(last.timer, 'Spacebar');
    assert.strictEqual(last.inspectionMs, 4500);
    assert.strictEqual(last.pickupMs, 400);
    assert.strictEqual(last.cubeMs, 8000);
    assert.strictEqual(last.putdownMs, 450);
    assert.strictEqual(last.rawMs, 8850);
    assert.strictEqual(last.tps, 0.25); // 2 moves / 8.0s

    // Verify computeCfopAverages aggregates inspectionMs and cubeMs too
    const avgs = computeCfopAverages([last]);
    assert.strictEqual(avgs.inspectionMs, 4500);
    assert.strictEqual(avgs.median.inspectionMs, 4500);
    assert.strictEqual(avgs.trimMean.inspectionMs, 4500);
    assert.strictEqual(avgs.cubeMs, 8000);
    assert.strictEqual(avgs.median.cubeMs, 8000);
    assert.strictEqual(avgs.trimMean.cubeMs, 8000);
    assert.strictEqual(avgs.pickupMs, 400);
    assert.strictEqual(avgs.putdownMs, 450);
  } finally {
    timerCtrl.cancelSolve();
    performance.now = prevPerfNow;
    smartCube.status = prevStatus;
    smartCube.deviceName = prevName;
  }
});

test('renderCfopStepTable shows Pick-up before Cross, Cube Solve summary, Put-down after PLL, and continuous accumMs', () => {
  const solve = {
    puzzle: '333',
    rawMs: 11740,
    ms: 11740,
    pickupMs: 390,
    cubeMs: 11040,
    putdownMs: 320,
    timer: 'Spacebar',
    smartCube: 'WCU_MY32_E00B',
    moveCount: 67,
    tps: 6.07,
    cfop: {
      steps: [
        { phase: 'cross', label: 'Cross', caseId: 'White', recogMs: 0, execMs: 1410, ms: 1410, accumMs: 1410, moveCount: 8 },
        { phase: 'oll', label: 'OLL', caseId: 'OLL 43', recogMs: 720, execMs: 690, ms: 1410, accumMs: 8880, moveCount: 8 },
        { phase: 'pll', label: 'PLL', caseId: 'Ua', recogMs: 790, execMs: 1370, ms: 2160, accumMs: 11040, moveCount: 17 }
      ],
      pauses: { totalCount: 3, totalMs: 2610 }
    }
  };

  const html = renderCfopStepTable(solve, { detailed: true });
  const pickupIdx = html.indexOf('cfop-row-pickup');
  const crossIdx = html.indexOf('cfop-row-cross');
  const pllIdx = html.indexOf('cfop-row-pll');
  const cubeIdx = html.indexOf('cfop-row-cubeTotal');
  const putdownIdx = html.indexOf('cfop-row-putdown');

  assert.ok(pickupIdx !== -1 && crossIdx !== -1 && pllIdx !== -1 && cubeIdx !== -1 && putdownIdx !== -1);
  assert.ok(pickupIdx < crossIdx, 'Pick-up must appear before Cross');
  assert.ok(crossIdx < pllIdx, 'Cross must appear before PLL');
  assert.ok(pllIdx < cubeIdx, 'Cube Solve summary must appear after PLL');
  assert.ok(cubeIdx < putdownIdx, 'Put-down must appear after Cube Solve');

  // Verify accumMs offset by pickupMs (390ms): Cross 1410 + 390 = 1800ms (1.80s), PLL 11040 + 390 = 11430ms (11.43s)
  assert.ok(html.includes('1.80s'), 'Cross accum should include pickupMs');
  assert.ok(html.includes('11.43s'), 'PLL and Cube Solve accum should include pickupMs');
  assert.ok(html.includes('11.04s'), 'Cube Solve total should show 11.04s');
  assert.ok(html.includes('11.74s'), 'Put-down accum and Solve Total should equal 11.74s');
});
