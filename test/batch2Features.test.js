import test from 'node:test';
import assert from 'node:assert';
import { GyroOrientationTracker, quatMultiply, quatNormalize } from '../src/cube/gyroTracker.js';
import { analyzeCfopSolve } from '../src/cfopAnalyzer.js';
import { computeCfopGoalAnalysis, renderCfopGoalCoachHtml, CFOP_SPLIT_RATIOS } from '../src/features/stats/cfopGoalCoach.js';
import { PUZZLES, getSolveTargetsForPuzzle } from '../src/data/algRegistry.js';
import { generateWcaScrambleForPuzzle } from '../src/services/scrambleService.js';
import { AppStore, VALID_PUZZLES } from '../src/state/appStore.js';
import { mergeSyncPayloads } from '../src/services/syncMerge.js';
import { startMetronome, stopMetronome, isMetronomeRunning } from '../src/services/audioService.js';

test('GyroOrientationTracker builds 24 SO(3) orientations, suppresses wobble, and tracks rotations from any calibrated home pose', () => {
  assert.strictEqual(GyroOrientationTracker.getOrientationCount(), 24);

  const tracker = new GyroOrientationTracker();
  // Arbitrary tilted home orientation (~30deg around X and Z)
  const q0 = quatNormalize({ x: 0.25, y: 0.1, z: 0.15, w: 0.95 });

  // First packet auto-calibrates with no emitted rotation
  const first = tracker.update(q0);
  assert.strictEqual(first.changed, false);
  assert.deepStrictEqual(first.rotations, []);

  // Small wobble (~8 deg) must not emit rotation
  const wobble = quatNormalize(quatMultiply(q0, { x: 0, y: 0, z: 0.07, w: 0.9975 }));
  const wobbleRes = tracker.update(wobble);
  assert.strictEqual(wobbleRes.changed, false);

  // Full 90-deg y rotation relative to q0
  const qAfterY = quatNormalize(quatMultiply(q0, GyroOrientationTracker.getRotationQuaternion('y')));
  const yRes = tracker.update(qAfterY);
  assert.strictEqual(yRes.changed, true);
  assert.deepStrictEqual(yRes.rotations, ['y']);

  // Followed by 180-deg x2 rotation in the rotated grip frame
  const qAfterYx2 = quatNormalize(quatMultiply(qAfterY, GyroOrientationTracker.getRotationQuaternion('x2')));
  const x2Res = tracker.update(qAfterYx2);
  assert.strictEqual(x2Res.changed, true);
  assert.deepStrictEqual(x2Res.rotations, ['x2']);

  // Followed by z' rotation
  const qAfterZPrime = quatNormalize(quatMultiply(qAfterYx2, GyroOrientationTracker.getRotationQuaternion("z'")));
  const zRes = tracker.update(qAfterZPrime);
  assert.strictEqual(zRes.changed, true);
  assert.deepStrictEqual(zRes.rotations, ["z'"]);

  // Reset clears calibration
  tracker.reset();
  assert.strictEqual(tracker.isCalibrated(), false);
});

test('analyzeCfopSolve preserves gyro rotation tokens without inflating face-turn count or breaking CFOP milestones', async () => {
  const scramble = "U F R U' R' U R U R2' F' R U R U' R' U' R U2' R' U' R U' R' U' R U' R' U L' U L U2' R' U' R U' L U L' U' D F R' D'";
  const moves = [
    { move: "D",  t: 180,  split: 180 },
    { move: "R",  t: 360,  split: 180 },
    { move: "F'", t: 540,  split: 180 },
    { move: "D'", t: 720,  split: 180 },
    { move: "y",  t: 850,  split: 0, isRotation: true },
    { move: "U",  t: 1240, split: 520 },
    { move: "L",  t: 1420, split: 180 },
    { move: "U'", t: 1600, split: 180 },
    { move: "L'", t: 1780, split: 180 },
    { move: "U",  t: 2240, split: 460 },
    { move: "R'", t: 2420, split: 180 },
    { move: "U",  t: 2600, split: 180 },
    { move: "R",  t: 2780, split: 180 },
    { move: "U2", t: 3100, split: 320 },
    { move: "L'", t: 3280, split: 180 },
    { move: "U'", t: 3460, split: 180 },
    { move: "L",  t: 3640, split: 180 },
    { move: "U'", t: 3920, split: 280 },
    { move: "R",  t: 4100, split: 180 },
    { move: "U",  t: 4280, split: 180 },
    { move: "R'", t: 4460, split: 180 },
    { move: "U",  t: 5010, split: 550 },
    { move: "R",  t: 5210, split: 200 },
    { move: "U",  t: 5390, split: 180 },
    { move: "R'", t: 5570, split: 180 },
    { move: "U",  t: 5750, split: 180 },
    { move: "R",  t: 5930, split: 180 },
    { move: "U2", t: 6150, split: 220 },
    { move: "R'", t: 6330, split: 180 },
    { move: "U",  t: 6960, split: 630 },
    { move: "R",  t: 7160, split: 200 },
    { move: "U",  t: 7360, split: 200 },
    { move: "R'", t: 7560, split: 200 },
    { move: "U'", t: 7760, split: 200 },
    { move: "R'", t: 7960, split: 200 },
    { move: "F",  t: 8160, split: 200 },
    { move: "R2", t: 8360, split: 200 },
    { move: "U'", t: 8560, split: 200 },
    { move: "R'", t: 8760, split: 200 },
    { move: "U'", t: 8960, split: 200 },
    { move: "R",  t: 9160, split: 200 },
    { move: "U",  t: 9360, split: 200 },
    { move: "R'", t: 9560, split: 200 },
    { move: "F'", t: 9760, split: 200 },
    { move: "U'", t: 9960, split: 200 }
  ];
  const cfop = await analyzeCfopSolve({ puzzle: '333', target: 'full', ms: 9960, rawMs: 9960, scramble, moves });
  assert.strictEqual(cfop.isFullCfop, true);
  const f2l1 = cfop.steps.find(s => s.phase === 'f2l1');
  assert.ok(f2l1);
  assert.strictEqual(f2l1.moveCount, 4); // y rotation excluded from face moveCount
  assert.ok(f2l1.moves.includes('y'));
});

test('computeCfopGoalAnalysis & renderCfopGoalCoachHtml detect bottlenecks and slow cases cleanly', () => {
  const solves = Array.from({ length: 6 }, (_, i) => ({
    ms: 14500,
    puzzle: '333',
    target: 'full',
    at: 1700000000000 + i * 1000,
    cfop: {
      splits: { cross: 1200, f2lTotal: 7800, oll: 1800, pll: 3700 },
      ollCase: { id: '27', shortName: 'OLL 27', name: 'Sune', ms: 1800 },
      pllCase: { id: 'Gb', shortName: 'Gb', name: 'Gb-Perm', ms: 3700 },
      pauses: { totalCount: 3, totalMs: 1400 },
      steps: [
        { phase: 'oll', ms: 1800, moveCount: 7, pauseCount: 0, pauseMs: 0 },
        { phase: 'pll', ms: 3700, moveCount: 15, pauseCount: 1, pauseMs: 650 }
      ]
    }
  }));

  const res = computeCfopGoalAnalysis(solves, 12);
  assert.ok(res);
  assert.strictEqual(res.goalSec, 12);
  const f2l = res.phases.find(p => p.key === 'f2lTotal');
  assert.strictEqual(f2l.targetMs, Math.round(12000 * CFOP_SPLIT_RATIOS.f2lTotal));
  assert.strictEqual(f2l.deltaMs, 7800 - 6000);
  assert.strictEqual(res.topBottleneck.key, 'f2lTotal');
  assert.strictEqual(res.slowCases[0].shortName, 'Gb');

  const html = renderCfopGoalCoachHtml(solves, { goalSec: 12, isOpen: true });
  assert.ok(html.includes('CFOP Goal Coach'));
  assert.ok(html.includes('Sub-12'));
  assert.ok(html.includes('cfop-goal-delta-warn'));
  assert.ok(html.includes('cfop-goal-delta-good'));
  assert.ok(html.includes('Top bottleneck'));
  assert.ok(html.includes('Gb'));
});

test('Extra WCA solve-only and learn+solve puzzles expose registry metadata and generate valid scrambles', async () => {
  const solveOnlyIds = ['pyram', 'skewb', 'minx', 'sq1', 'clock'];
  for (const id of solveOnlyIds) {
    assert.ok(VALID_PUZZLES.includes(id), `${id} should be in VALID_PUZZLES`);
    assert.ok(PUZZLES[id], `${id} should exist in PUZZLES`);
    assert.strictEqual(PUZZLES[id].solveOnly, true);
    assert.deepStrictEqual(PUZZLES[id].tracks, []);
    const targets = getSolveTargetsForPuzzle(id);
    assert.strictEqual(targets.length, 1);
    assert.strictEqual(targets[0].id, 'full');
    const scr = await generateWcaScrambleForPuzzle(id);
    assert.ok(typeof scr === 'string' && scr.trim().length > 3, `Expected scramble for ${id}`);
  }

  assert.ok(VALID_PUZZLES.includes('333bf'));
  assert.strictEqual(PUZZLES['333bf'].hideSimulate, true);
  assert.strictEqual(PUZZLES['333bf'].defaultTrack, 'bld-guide');
  assert.strictEqual(PUZZLES['333bf'].tracks.length, 2);
  assert.strictEqual(PUZZLES['333bf'].tracks[1].id, 'bld-memo');
  assert.strictEqual(PUZZLES['333bf'].tracks[1].practiceOnly, true);
  assert.strictEqual(getSolveTargetsForPuzzle('333bf')[0].id, 'full');
  const bfScr = await generateWcaScrambleForPuzzle('333bf');
  assert.ok(typeof bfScr === 'string' && bfScr.trim().length > 3);
});

test('AppStore, audioService metronome, and syncMerge handle Batch 2 settings cleanly', () => {
  const store = new AppStore();
  assert.strictEqual(store.state.metronomeEnabled, false);
  assert.strictEqual(store.state.metronomeBpm, 180);
  assert.strictEqual(store.state.pauseAlertEnabled, false);
  assert.strictEqual(store.state.cfopGoalSec, 12);
  assert.strictEqual(store.state.goalCoachOpen, true);
  assert.strictEqual(store.state.showExtraWcaEvents, false);

  store.state.metronomeEnabled = true;
  store.state.metronomeBpm = 240;
  store.state.pauseAlertEnabled = true;
  store.state.cfopGoalSec = 10;
  store.state.goalCoachOpen = false;
  store.state.showExtraWcaEvents = true;

  const payload = store.getSettingsPayload();
  assert.strictEqual(payload.metronomeEnabled, true);
  assert.strictEqual(payload.metronomeBpm, 240);
  assert.strictEqual(payload.pauseAlertEnabled, true);
  assert.strictEqual(payload.cfopGoalSec, 10);
  assert.strictEqual(payload.goalCoachOpen, false);
  assert.strictEqual(payload.showExtraWcaEvents, true);

  const merged = mergeSyncPayloads(
    {
      schemaVersion: 1,
      hasLocalSettings: true,
      settings: { metronomeBpm: 180, pauseAlertEnabled: false, showExtraWcaEvents: false, activeSessionId: 's1' },
      timestamps: { settings: { metronomeBpm: 1000, pauseAlertEnabled: 1000, showExtraWcaEvents: 1000 } },
      sessions: [{ id: 's1', name: 'Main', puzzle: '333', solves: [{ ms: 10000, at: 1000 }], updatedAt: 1000 }]
    },
    {
      schemaVersion: 1,
      hasLocalSettings: true,
      settings: { metronomeBpm: 210, pauseAlertEnabled: true, showExtraWcaEvents: true, activeSessionId: 's1' },
      timestamps: { settings: { metronomeBpm: 2000, pauseAlertEnabled: 2000, showExtraWcaEvents: 2000 } },
      sessions: [{ id: 's1', name: 'Main', puzzle: '333', solves: [{ ms: 10000, at: 1000 }], updatedAt: 1000 }]
    }
  );
  assert.strictEqual(merged.merged.settings.metronomeBpm, 210);
  assert.strictEqual(merged.merged.settings.pauseAlertEnabled, true);
  assert.strictEqual(merged.merged.settings.showExtraWcaEvents, true);

  startMetronome(180);
  assert.strictEqual(isMetronomeRunning(), true);
  stopMetronome();
  assert.strictEqual(isMetronomeRunning(), false);
});
