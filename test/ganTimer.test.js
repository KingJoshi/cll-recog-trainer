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
      pickupMs: 450,
      cubeMs: 7750,
      putdownMs: 420,
      timer: 'GAN Smart Timer'
    }
  ];
  const csv = exportSolvesToCSV(solves, 'TimerTest');
  assert.ok(csv.includes('Pickup(s),Cube Time(s),Putdown(s),Timer'));
  assert.ok(csv.includes('0.45,7.75,0.42,"GAN Smart Timer"'));
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
