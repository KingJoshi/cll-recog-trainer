import test from 'node:test';
import assert from 'node:assert/strict';

import {
  PUZZLES,
  getSolveTargetsForPuzzle,
  syncCustomEventsToRegistry
} from '../src/data/algRegistry.js';
import { generateWcaScrambleForPuzzle } from '../src/services/scrambleService.js';
import { AppStore, VALID_PUZZLES } from '../src/state/appStore.js';
import { mergeSyncPayloads } from '../src/services/syncMerge.js';
import {
  DEFAULT_SHORTCUTS,
  SHORTCUT_ACTION_IDS
} from '../src/services/keyboardShortcuts.js';

test('6x6, 7x7, and FTO expose solve-only puzzle metadata and generate valid scrambles', async () => {
  const addedIds = ['666', '777', 'fto'];
  for (const id of addedIds) {
    assert.ok(VALID_PUZZLES.includes(id), `${id} should be in VALID_PUZZLES`);
    assert.ok(PUZZLES[id], `${id} should exist in PUZZLES`);
    assert.strictEqual(PUZZLES[id].solveOnly, true);
    assert.deepStrictEqual(PUZZLES[id].tracks, []);
    const targets = getSolveTargetsForPuzzle(id);
    assert.strictEqual(targets.length, 1);
    assert.strictEqual(targets[0].id, 'full');
    const scr = await generateWcaScrambleForPuzzle(id);
    assert.ok(typeof scr === 'string' && scr.trim().length > 5, `Expected scramble for ${id}`);
  }
});

test('Custom events can be added, generate configured scrambles, sync cleanly, and be removed', async () => {
  const store = new AppStore();
  try {
    const evRelay = store.addCustomEvent({ name: '2-4 Relay', shortName: '2-4', scrambleType: 'none' });
    const evFtoBld = store.addCustomEvent({ name: 'FTO Blind', shortName: 'FTO-B', scrambleType: 'fto' });
    const evDup = store.addCustomEvent({ name: '2-4 Relay', shortName: '2-4b', scrambleType: '333' });

    assert.ok(evRelay && evRelay.id.startsWith('custom-'));
    assert.ok(evFtoBld && PUZZLES[evFtoBld.id]?.isCustomEvent);
    assert.notStrictEqual(evDup.id, evRelay.id, 'Duplicate custom event names get unique ids');

    const emptyScr = await generateWcaScrambleForPuzzle(evRelay.id);
    assert.strictEqual(emptyScr, '');

    const ftoScr = await generateWcaScrambleForPuzzle(evFtoBld.id);
    assert.ok(typeof ftoScr === 'string' && ftoScr.trim().length > 5);

    const payload = store.getSettingsPayload();
    assert.strictEqual(payload.customEvents.length, 3);

    const remote = {
      schemaVersion: 1,
      hasLocalSettings: true,
      settings: { customEvents: [], activeSessionId: 's1' },
      timestamps: { settings: { customEvents: 1000 } },
      sessions: [{ id: 's1', name: 'Main', puzzle: '333', solves: [{ ms: 10000, at: 1000 }], updatedAt: 1000 }]
    };
    const local = {
      schemaVersion: 1,
      hasLocalSettings: true,
      settings: { customEvents: payload.customEvents, activeSessionId: 's1' },
      timestamps: { settings: { customEvents: 2000 } },
      sessions: [{ id: 's1', name: 'Main', puzzle: '333', solves: [{ ms: 10000, at: 1000 }], updatedAt: 1000 }]
    };
    const merged = mergeSyncPayloads(local, remote);
    assert.strictEqual(merged.merged.settings.customEvents.length, 3);

    const removed = store.removeCustomEvent(evRelay.id);
    assert.strictEqual(removed, true);
    assert.strictEqual(PUZZLES[evRelay.id], undefined);
  } finally {
    syncCustomEventsToRegistry([]);
  }
});

test('Widget visibility settings default true, notify subscribers, and LWW-sync across devices', () => {
  const store = new AppStore();
  assert.strictEqual(store.state.showLayerSolutionsWidget, true);
  assert.strictEqual(store.state.showCrossSolutionsWidget, true);
  assert.strictEqual(store.state.showStatsPanel, true);

  const events = [];
  const unsub = store.subscribe((evt, detail) => {
    if (evt === 'widgetVisibility') events.push({ evt, detail });
  });
  try {
    store.setWidgetVisibility('showLayerSolutionsWidget', false);
    store.setWidgetVisibility('showCrossSolutionsWidget', false);
    store.setWidgetVisibility('showStatsPanel', false);
  } finally {
    unsub();
  }

  assert.strictEqual(events.length, 3);
  const payload = store.getSettingsPayload();
  assert.strictEqual(payload.showLayerSolutionsWidget, false);
  assert.strictEqual(payload.showCrossSolutionsWidget, false);
  assert.strictEqual(payload.showStatsPanel, false);

  const local = {
    schemaVersion: 1,
    hasLocalSettings: true,
    settings: {
      showLayerSolutionsWidget: true,
      showCrossSolutionsWidget: true,
      showStatsPanel: true,
      activeSessionId: 's1'
    },
    timestamps: {
      settings: {
        showLayerSolutionsWidget: 1000,
        showCrossSolutionsWidget: 1000,
        showStatsPanel: 1000
      }
    },
    sessions: [{ id: 's1', name: 'Main', puzzle: '333', solves: [{ ms: 10000, at: 1000 }], updatedAt: 1000 }]
  };
  const remote = {
    schemaVersion: 1,
    hasLocalSettings: true,
    settings: {
      showLayerSolutionsWidget: false,
      showCrossSolutionsWidget: true,
      showStatsPanel: false,
      activeSessionId: 's1'
    },
    timestamps: {
      settings: {
        showLayerSolutionsWidget: 2000,
        showCrossSolutionsWidget: 2000,
        showStatsPanel: 2000
      }
    },
    sessions: [{ id: 's1', name: 'Main', puzzle: '333', solves: [{ ms: 10000, at: 1000 }], updatedAt: 1000 }]
  };
  const merged = mergeSyncPayloads(local, remote);
  assert.strictEqual(merged.merged.settings.showLayerSolutionsWidget, false);
  assert.strictEqual(merged.merged.settings.showCrossSolutionsWidget, true);
  assert.strictEqual(merged.merged.settings.showStatsPanel, false);
});

test('Zen mode shortcut defaults to Shift+Z and new puzzle shortcuts are registered', () => {
  assert.strictEqual(DEFAULT_SHORTCUTS['action:toggleFocusMode'], 'Shift+KeyZ');
  assert.ok(SHORTCUT_ACTION_IDS.has('action:toggleFocusMode'));
  assert.ok(SHORTCUT_ACTION_IDS.has('puzzle:666'));
  assert.ok(SHORTCUT_ACTION_IDS.has('puzzle:777'));
  assert.ok(SHORTCUT_ACTION_IDS.has('puzzle:fto'));
});
