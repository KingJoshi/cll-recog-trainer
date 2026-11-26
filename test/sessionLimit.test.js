import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import {
  SESSION_LIMIT_PRESETS,
  clampSessionLimitMinutes,
  formatCountdownMs,
  formatMinutesLabel,
  evaluateCountdownMilestones,
  createSessionLimitController
} from '../src/features/solve/sessionLimitController.js';
import { AppStore } from '../src/state/appStore.js';
import { mergeSyncPayloads } from '../src/services/syncMerge.js';

function withMockStorage(initial = {}, fn) {
  const storeMap = new Map(Object.entries(initial).map(([k, v]) => [k, JSON.stringify(v)]));
  const prevStorage = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: (k) => (storeMap.has(k) ? storeMap.get(k) : null),
    setItem: (k, v) => { storeMap.set(k, String(v)); },
    removeItem: (k) => { storeMap.delete(k); },
    clear: () => { storeMap.clear(); }
  };
  try {
    return fn();
  } finally {
    globalThis.localStorage = prevStorage;
  }
}

test('Session limit helpers clamp durations and format countdowns cleanly', () => {
  assert.deepEqual(SESSION_LIMIT_PRESETS, [5, 10, 15, 20, 30, 45, 60]);
  assert.equal(clampSessionLimitMinutes(15), 15);
  assert.equal(clampSessionLimitMinutes(0, 15), 15);
  assert.equal(clampSessionLimitMinutes(-5, 15), 15);
  assert.equal(clampSessionLimitMinutes('abc', 20), 20);
  assert.equal(clampSessionLimitMinutes(500), 240);
  assert.equal(clampSessionLimitMinutes(29.6), 30);

  assert.equal(formatCountdownMs(0), '00:00');
  assert.equal(formatCountdownMs(-100), '00:00');
  assert.equal(formatCountdownMs(5000), '00:05');
  assert.equal(formatCountdownMs(4100), '00:05');
  assert.equal(formatCountdownMs(60_000), '01:00');
  assert.equal(formatCountdownMs(15 * 60_000), '15:00');
  assert.equal(formatCountdownMs(65 * 60_000), '1:05:00');

  assert.equal(formatMinutesLabel(1), '1 minute');
  assert.equal(formatMinutesLabel(15), '15 minutes');
});

test('evaluateCountdownMilestones fires 5m, 1m, 5..1s, and expired without duplicates', () => {
  const fired15 = new Set();
  const total15 = 15 * 60_000;

  assert.deepEqual(evaluateCountdownMilestones({ totalMs: total15, remainingMs: 10 * 60_000, firedSet: fired15 }), []);
  assert.deepEqual(evaluateCountdownMilestones({ totalMs: total15, remainingMs: 300_000, firedSet: fired15 }), [
    { type: '5m', key: '5m' }
  ]);
  assert.deepEqual(evaluateCountdownMilestones({ totalMs: total15, remainingMs: 299_000, firedSet: fired15 }), []);

  assert.deepEqual(evaluateCountdownMilestones({ totalMs: total15, remainingMs: 60_000, firedSet: fired15 }), [
    { type: '1m', key: '1m' }
  ]);
  assert.deepEqual(evaluateCountdownMilestones({ totalMs: total15, remainingMs: 59_000, firedSet: fired15 }), []);

  for (const sec of [5, 4, 3, 2, 1]) {
    assert.deepEqual(
      evaluateCountdownMilestones({ totalMs: total15, remainingMs: sec * 1000 - 200, firedSet: fired15 }),
      [{ type: 'second', seconds: sec, key: `${sec}s` }]
    );
    assert.deepEqual(
      evaluateCountdownMilestones({ totalMs: total15, remainingMs: sec * 1000 - 400, firedSet: fired15 }),
      []
    );
  }

  assert.deepEqual(evaluateCountdownMilestones({ totalMs: total15, remainingMs: 0, firedSet: fired15 }), [
    { type: 'expired', key: '0s' }
  ]);
  assert.deepEqual(evaluateCountdownMilestones({ totalMs: total15, remainingMs: 0, firedSet: fired15 }), []);

  // Shorter 3-minute countdown skips 5m but fires 1m and 5..1s
  const fired3 = new Set();
  const total3 = 3 * 60_000;
  assert.deepEqual(evaluateCountdownMilestones({ totalMs: total3, remainingMs: 180_000, firedSet: fired3 }), []);
  assert.deepEqual(evaluateCountdownMilestones({ totalMs: total3, remainingMs: 60_000, firedSet: fired3 }), [
    { type: '1m', key: '1m' }
  ]);
  assert.ok(!fired3.has('5m'));

  // 1-minute countdown skips 5m and 1m, fires 5..1s and expired
  const fired1 = new Set();
  const total1 = 60_000;
  assert.deepEqual(evaluateCountdownMilestones({ totalMs: total1, remainingMs: 60_000, firedSet: fired1 }), []);
  assert.deepEqual(evaluateCountdownMilestones({ totalMs: total1, remainingMs: 4900, firedSet: fired1 }), [
    { type: 'second', seconds: 5, key: '5s' }
  ]);
});

test('SessionLimitController tracks pause/resume/extend and lets mid-solve complete before expiring', () => {
  withMockStorage({}, () => {
    const store = new AppStore();
    let solveState = 'idle';
    const toasts = [];
    const beeps = [];
    const cues = [];

    const ctrl = createSessionLimitController({
      appStore: store,
      getTimerCtrl: () => ({ getSolveState: () => solveState }),
      onToast: (msg, type) => toasts.push({ msg, type }),
      onTickBeep: (sec) => beeps.push(sec),
      onCue: (msg, opts) => cues.push({ msg, opts })
    });

    const t0 = 1_000_000_000;
    ctrl.start(15, t0);
    assert.equal(store.state.solveLimitMinutes, 15);
    assert.equal(ctrl.getState().status, 'running');
    assert.equal(ctrl.getState().remainingMs, 15 * 60_000);

    // Reach 5 minutes remaining
    ctrl.tick(t0 + 10 * 60_000);
    assert.equal(ctrl.getState().activeCallout?.text, '5 mins left');
    assert.ok(toasts.some(t => t.msg.includes('5 minutes left')));
    assert.ok(cues.some(c => c.msg === '5 minutes left'));

    // Reach 1 minute remaining
    ctrl.tick(t0 + 14 * 60_000);
    assert.equal(ctrl.getState().activeCallout?.text, '1 min left');
    assert.ok(toasts.some(t => t.msg.includes('1 minute left')));

    // Pause and resume preserves remaining time
    ctrl.pause(t0 + 14 * 60_000 + 20_000);
    assert.equal(ctrl.getState().status, 'paused');
    assert.equal(ctrl.getState().remainingMs, 40_000);
    ctrl.resume(t0 + 14 * 60_000 + 50_000);
    assert.equal(ctrl.getState().status, 'running');

    // Final 5, 4, 3, 2, 1 seconds
    const expAt = t0 + 14 * 60_000 + 50_000 + 40_000;
    ctrl.tick(expAt - 4800);
    ctrl.tick(expAt - 3800);
    ctrl.tick(expAt - 2800);
    ctrl.tick(expAt - 1800);
    ctrl.tick(expAt - 800);
    assert.deepEqual(beeps, [5, 4, 3, 2, 1]);

    // Time expires WHILE user is mid-solve: must enter "finishing" instead of interrupting
    solveState = 'running';
    const cuesBeforeExp = cues.length;
    ctrl.tick(expAt);
    assert.equal(ctrl.getState().status, 'finishing');
    assert.equal(ctrl.getState().activeCallout?.text, 'Finish solve');
    assert.equal(cues.length, cuesBeforeExp);

    // User finishes the solve -> now trigger final reminder showing elapsed preset & solve count
    solveState = 'idle';
    ctrl.onSolveFinished({ counted: true });
    assert.equal(ctrl.getState().status, 'expired');
    assert.equal(ctrl.getState().solvesCompleted, 1);
    assert.ok(toasts.some(t => t.msg.includes('cubed for 15 minutes')));
    assert.ok(cues.some(c => c.opts?.kind === 'expired' && c.msg.includes('15 minutes')));

    // Extending by +5 min from expired state restarts cleanly at 5 minutes remaining
    ctrl.extend(5, expAt + 10_000);
    assert.equal(ctrl.getState().status, 'running');
    assert.equal(ctrl.getState().durationMinutes, 20);
    assert.equal(ctrl.getState().remainingMs, 5 * 60_000);

    ctrl.stop();
    assert.equal(ctrl.getState().status, 'idle');

    // When idle at expiration, transitions directly to "expired"
    ctrl.start(1, t0);
    solveState = 'idle';
    ctrl.tick(t0 + 60_000);
    assert.equal(ctrl.getState().status, 'expired');
    assert.ok(toasts.some(t => t.msg.includes('cubed for 1 minute')));
    ctrl.stop();
  });
});

test('AppStore and syncMerge persist and sync solveLimitMinutes and solveLimitSound', () => {
  withMockStorage({}, () => {
    const store = new AppStore();
    assert.equal(store.state.solveLimitMinutes, 15);
    assert.equal(store.state.solveLimitSound, true);

    store.setSolveLimitMinutes(30);
    store.setSolveLimitSound(false);
    assert.equal(store.state.solveLimitMinutes, 30);
    assert.equal(store.state.solveLimitSound, false);

    const payload = store.getSettingsPayload();
    assert.equal(payload.solveLimitMinutes, 30);
    assert.equal(payload.solveLimitSound, false);

    // Reload from persisted localStorage
    const store2 = new AppStore();
    assert.equal(store2.state.solveLimitMinutes, 30);
    assert.equal(store2.state.solveLimitSound, false);

    // Verify syncMerge syncs fields cleanly with LWW
    const { merged } = mergeSyncPayloads(
      {
        schemaVersion: 1,
        hasLocalSettings: true,
        settings: { solveLimitMinutes: 15, solveLimitSound: true, activeSessionId: 's1' },
        timestamps: { settings: { solveLimitMinutes: 1000, solveLimitSound: 1000 } },
        sessions: [{ id: 's1', name: 'Default', puzzle: '222', target: 'full', solves: [], updatedAt: 1000 }]
      },
      {
        schemaVersion: 1,
        hasLocalSettings: true,
        settings: { solveLimitMinutes: 45, solveLimitSound: false, activeSessionId: 's1' },
        timestamps: { settings: { solveLimitMinutes: 2000, solveLimitSound: 2000 } },
        sessions: [{ id: 's1', name: 'Default', puzzle: '222', target: 'full', solves: [], updatedAt: 2000 }]
      }
    );
    assert.equal(merged.settings.solveLimitMinutes, 45);
    assert.equal(merged.settings.solveLimitSound, false);
  });
});

test('Solve UI markup exposes session countdown controls, banner, and overlay badge', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(html.includes('id="solveLimitToggleBtn"'));
  assert.ok(html.includes('id="solveLimitConfigRow"'));
  assert.ok(html.includes('id="solveLimitMinutesInput"'));
  assert.ok(html.includes('id="solveLimitSoundToggle"'));
  assert.ok(html.includes('id="solveLimitStartBtn"'));
  assert.ok(html.includes('id="solveLimitBanner"'));
  assert.ok(html.includes('id="solveOverlayCountdownBadge"'));
});
