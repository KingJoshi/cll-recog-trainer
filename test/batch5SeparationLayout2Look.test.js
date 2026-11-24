import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

import { ollCases } from '../src/data/ollData.js';
import { pllCases } from '../src/data/pllData.js';
import {
  mapOllCaseTo2Look,
  mapPllCaseTo2Look,
  computeOllPllCaseStats
} from '../src/cfopAnalyzer.js';
import { prewarmOllPllSvgs } from '../src/caseVisualizer.js';
import { renderOllPllCasesBreakdownHtml } from '../src/features/solve/cfopBreakdownRenderer.js';
import { AppStore, STORAGE_KEYS, isTimerViewMode } from '../src/state/appStore.js';
import { mergeSyncPayloads } from '../src/services/syncMerge.js';

function createMockCfopSolve({ id = 1, ms = 12000, ollCase = null, pllCase = null } = {}) {
  return {
    id,
    ms,
    at: 1700000000000 + id * 1000,
    moves: [],
    cfop: {
      analyzedVersion: 2,
      crossMs: 1400,
      f2lMs: 5600,
      f2lPairs: [
        { slot: '1', ms: 1400, pauses: [] },
        { slot: '2', ms: 1400, pauses: [] },
        { slot: '3', ms: 1400, pauses: [] },
        { slot: '4', ms: 1400, pauses: [] }
      ],
      ollMs: ollCase?.ms || 2200,
      pllMs: pllCase?.ms || 2800,
      ollCase,
      pllCase,
      totalPauses: 1,
      totalPauseMs: 500
    }
  };
}

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
    return fn(storeMap);
  } finally {
    if (prevStorage === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = prevStorage;
  }
}

test('mapOllCaseTo2Look partitions all 57 OLL cases into OCLL (7) + Dot (8) + Line (15) + L-Shape (27)', () => {
  assert.equal(ollCases.length, 57);
  const buckets = new Map();
  for (const c of ollCases) {
    const mapped = mapOllCaseTo2Look(c);
    assert.ok(mapped.id, `Expected mapped id for ${c.id}`);
    assert.ok(mapped.svgCaseId, `Expected svgCaseId for ${c.id}`);
    buckets.set(mapped.id, (buckets.get(mapped.id) || 0) + 1);
  }

  // Individual 7 OCLL cases
  for (let i = 21; i <= 27; i++) {
    assert.equal(buckets.get(`oll-${i}`), 1, `Expected oll-${i} to stay individual in 2-Look OLL`);
  }
  // 3 EO groups
  assert.equal(buckets.get('2look-oll-dot'), 8);
  assert.equal(buckets.get('2look-oll-line'), 15);
  assert.equal(buckets.get('2look-oll-lshape'), 27);
  assert.equal(buckets.size, 10);
});

test('mapPllCaseTo2Look partitions all 21 PLL cases into 4 EPLLs + Adj Corners (12) + Diag Corners (5)', () => {
  assert.equal(pllCases.length, 21);
  const buckets = new Map();
  for (const c of pllCases) {
    const mapped = mapPllCaseTo2Look(c);
    assert.ok(mapped.id, `Expected mapped id for ${c.id}`);
    assert.ok(mapped.svgCaseId, `Expected svgCaseId for ${c.id}`);
    buckets.set(mapped.id, (buckets.get(mapped.id) || 0) + 1);
  }

  for (const epll of ['Ua', 'Ub', 'H', 'Z']) {
    assert.equal(buckets.get(epll), 1, `Expected EPLL ${epll} to remain individual`);
  }
  assert.equal(buckets.get('2look-pll-adj'), 12);
  assert.equal(buckets.get('2look-pll-diag'), 5);
  assert.equal(buckets.size, 6);
});

test('computeOllPllCaseStats and renderOllPllCasesBreakdownHtml merge 2-Look cases cleanly and preserve SVGs', async () => {
  const solves = [
    createMockCfopSolve({
      id: 1,
      ollCase: { id: 'oll-01', name: 'OLL 01', ms: 2000, pauseCount: 0, recogMs: 500, execMs: 1500, moves: 11 },
      pllCase: { id: 'T', name: 'T-Perm', ms: 2400, pauseCount: 0, recogMs: 400, execMs: 2000, moves: 14 }
    }),
    createMockCfopSolve({
      id: 2,
      ollCase: { id: 'oll-02', name: 'OLL 02', ms: 3000, pauseCount: 1, recogMs: 700, execMs: 2300, moves: 12 },
      pllCase: { id: 'Ja', name: 'Ja-Perm', ms: 2600, pauseCount: 0, recogMs: 500, execMs: 2100, moves: 13 }
    }),
    createMockCfopSolve({
      id: 3,
      ollCase: { id: 'oll-21', name: 'OLL 21 (H)', ms: 1600, pauseCount: 0, recogMs: 300, execMs: 1300, moves: 11 },
      pllCase: { id: 'Y', name: 'Y-Perm', ms: 3100, pauseCount: 1, recogMs: 600, execMs: 2500, moves: 17 }
    }),
    createMockCfopSolve({
      id: 4,
      ollCase: { id: 'oll-45', name: 'OLL 45', ms: 1800, pauseCount: 0, recogMs: 350, execMs: 1450, moves: 6 },
      pllCase: { id: 'Ua', name: 'Ua-Perm', ms: 1900, pauseCount: 0, recogMs: 300, execMs: 1600, moves: 11 }
    })
  ];

  const fullStats = computeOllPllCaseStats(solves, { llAnalyticsMode: 'full' });
  assert.equal(fullStats.ollCases.length, 4);
  assert.equal(fullStats.pllCases.length, 4);

  const twoLookStats = computeOllPllCaseStats(solves, { llAnalyticsMode: '2look' });
  assert.equal(twoLookStats.ollCases.length, 3);
  assert.equal(twoLookStats.pllCases.length, 3);

  const dotEntry = twoLookStats.ollCases.find(c => c.id === '2look-oll-dot');
  assert.ok(dotEntry);
  assert.equal(dotEntry.count, 2);
  assert.equal(dotEntry.avgMs, 2500);
  assert.equal(dotEntry.svgCaseId, 'oll-01');

  const adjEntry = twoLookStats.pllCases.find(c => c.id === '2look-pll-adj');
  assert.ok(adjEntry);
  assert.equal(adjEntry.count, 2);
  assert.equal(adjEntry.avgMs, 2500);
  assert.equal(adjEntry.svgCaseId, 'T');

  await prewarmOllPllSvgs(ollCases, pllCases);
  const html = renderOllPllCasesBreakdownHtml(solves, { llAnalyticsMode: '2look' });
  assert.ok(html.includes('data-ll-analytics-mode="full"'));
  assert.ok(html.includes('data-ll-analytics-mode="2look"'));
  assert.ok(html.includes('OLL Cases (2-Look)'));
  assert.ok(html.includes('PLL Cases (2-Look)'));
  assert.ok(html.includes('EO: Dot'));
  assert.ok(html.includes('Adj Corners'));
  assert.ok(html.includes('<svg'));
});

test('isTimerViewMode separates Solve and Train -> Timed Drills from Learn, Recognition Training, and Simulate', () => {
  assert.equal(isTimerViewMode({ mode: 'solve', trainSubMode: 'recog' }), true);
  assert.equal(isTimerViewMode({ mode: 'solve', trainSubMode: 'timed-drill' }), true);
  assert.equal(isTimerViewMode({ mode: 'practice', trainSubMode: 'timed-drill' }), true);
  assert.equal(isTimerViewMode({ mode: 'practice', trainSubMode: 'recog' }), false);
  assert.equal(isTimerViewMode({ mode: 'study', trainSubMode: 'timed-drill' }), false);
  assert.equal(isTimerViewMode({ mode: 'simulate', trainSubMode: 'timed-drill' }), false);
  assert.equal(isTimerViewMode(null), false);
});

test('AppStore manages llAnalyticsMode, trainSubMode, desktopMultiPane, legacy drill migration, and syncMerge', () => {
  withMockStorage({}, () => {
    const store = new AppStore();
    assert.equal(store.state.llAnalyticsMode, 'full');
    assert.equal(store.state.trainSubMode, 'recog');
    assert.equal(store.state.desktopMultiPane, true);

    const events = [];
    store.subscribe((evt, data) => events.push([evt, data]));

    store.setLlAnalyticsMode('2look');
    store.setTrainSubMode('timed-drill');
    store.setDesktopMultiPane(false);

    assert.equal(store.state.llAnalyticsMode, '2look');
    assert.equal(store.state.trainSubMode, 'timed-drill');
    assert.equal(store.state.desktopMultiPane, false);

    const payload = store.getSettingsPayload();
    assert.equal(payload.llAnalyticsMode, '2look');
    assert.equal(payload.trainSubMode, 'timed-drill');
    assert.equal(payload.desktopMultiPane, false);

    assert.ok(events.some(([evt]) => evt === 'llAnalyticsMode'));
    assert.ok(events.some(([evt]) => evt === 'trainSubMode'));
    assert.ok(events.some(([evt]) => evt === 'desktopMultiPane'));
  });

  // Pre-Batch-5 legacy drill upgrade: mode === "solve" + solveTarget !== "full" + no saved trainSubMode
  withMockStorage({
    [STORAGE_KEYS.SETTINGS]: {
      currentPuzzle: '222',
      currentTrackId: 'cll',
      mode: 'solve',
      solveTarget: 'cll'
    },
    [STORAGE_KEYS.SESSIONS]: [
      { id: 'sess-cll', puzzle: '222', name: 'CLL Drills', target: 'cll', inspection: true, showCube: true, solves: [] }
    ]
  }, () => {
    const migrated = new AppStore();
    assert.equal(migrated.state.mode, 'practice');
    assert.equal(migrated.state.trainSubMode, 'timed-drill');
    assert.equal(migrated.state.solveTarget, 'cll');
    assert.equal(isTimerViewMode(migrated.state), true);
  });

  // syncMerge propagates Batch 5 scalar settings by LWW timestamp
  const localSnap = {
    schemaVersion: 2,
    settings: { llAnalyticsMode: 'full', trainSubMode: 'recog', desktopMultiPane: true },
    timestamps: { settings: { llAnalyticsMode: 1000, trainSubMode: 3000, desktopMultiPane: 1000 } },
    sessions: []
  };
  const remoteSnap = {
    schemaVersion: 2,
    settings: { llAnalyticsMode: '2look', trainSubMode: 'timed-drill', desktopMultiPane: false },
    timestamps: { settings: { llAnalyticsMode: 2000, trainSubMode: 2000, desktopMultiPane: 2000 } },
    sessions: []
  };
  const merged = mergeSyncPayloads(localSnap, remoteSnap).merged;
  assert.equal(merged.settings.llAnalyticsMode, '2look');
  assert.equal(merged.settings.trainSubMode, 'recog');
  assert.equal(merged.settings.desktopMultiPane, false);
});

test('UI markup & CSS wire Learn/Train/Solve tabs, Train submodes, desktop multi-pane, and high-contrast CFOP chart colors', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(html.includes('📚 Learn'));
  assert.ok(html.includes('🎯 Train'));
  assert.ok(html.includes('⏱️ Solve'));
  assert.ok(html.includes('id="trainSubmodeBar"'));
  assert.ok(html.includes('id="solveLeftPane"'));
  assert.ok(html.includes('id="solveRightPane"'));
  assert.ok(html.includes('id="settingsLlMode2LookBtn"'));
  assert.ok(html.includes('id="settingsDesktopMultiPane"'));

  const statsCss = fs.readFileSync(new URL('../src/styles/features/stats.css', import.meta.url), 'utf8');
  assert.ok(statsCss.includes('.cfop-seg-cross { background: #2563eb;'));
  assert.ok(statsCss.includes('.cfop-seg-f2l { background: #16a34a;'));
  assert.ok(statsCss.includes('.cfop-seg-oll { background: #ea580c;'));
  assert.ok(statsCss.includes('.cfop-seg-pll { background: #7c3aed;'));
});
