import test from 'node:test';
import assert from 'node:assert';
import { AppStore } from '../src/state/appStore.js';
import { SHORTCUT_ACTION_IDS } from '../src/services/keyboardShortcuts.js';
import { mergeSyncPayloads } from '../src/services/syncMerge.js';
import { renderCfopStepTable, renderLastSolveCfopInline } from '../src/features/solve/cfopBreakdownRenderer.js';
import { renderSolveStatsBar } from '../src/features/solve/solvePanelView.js';
import { createSessionLogView } from '../src/features/stats/sessionLogView.js';

function makeMockContainer() {
  const listenersByAttr = new Map();
  return {
    innerHTML: '',
    hidden: false,
    querySelector() {
      return null;
    },
    querySelectorAll(selector) {
      if (selector === '[data-cfop-metric]') {
        return [...this.innerHTML.matchAll(/data-cfop-metric="([^"]+)"/g)].map(m => ({
          dataset: { cfopMetric: m[1] },
          addEventListener(_ev, fn) {
            listenersByAttr.set(`cfopMetric:${m[1]}`, fn);
          }
        }));
      }
      if (selector === '.recent-solve-chip') {
        return [...this.innerHTML.matchAll(/data-recent-idx="(\d+)" data-recent-num="(\d+)"/g)].map(m => ({
          dataset: { recentIdx: m[1], recentNum: m[2] },
          addEventListener(_ev, fn) {
            listenersByAttr.set(`chip:${m[1]}`, fn);
          }
        }));
      }
      return [];
    },
    triggerMetricClick(metric) {
      const fn = listenersByAttr.get(`cfopMetric:${metric}`);
      if (fn) fn({ stopPropagation() {} });
    },
    triggerRecentChipClick(idx) {
      const fn = listenersByAttr.get(`chip:${idx}`);
      if (fn) fn({ stopPropagation() {} });
    }
  };
}

function makeCfopSolve(idx, totalMs = 11000 + idx * 50) {
  const cross = 1500;
  const f2l1 = 1600;
  const f2l2 = 1700;
  const f2l3 = 1800;
  const f2l4 = 1500;
  const f2lTotal = f2l1 + f2l2 + f2l3 + f2l4;
  const oll = 1300;
  const pll = Math.max(800, totalMs - cross - f2lTotal - oll);
  return {
    ms: totalMs,
    cubeMs: totalMs - 500,
    inspectionMs: 6500,
    pickupMs: 280,
    putdownMs: 220,
    penalty: 0,
    puzzle: '333',
    target: 'full',
    scramble: "R U R' U'",
    at: 1700000000000 + idx * 1000,
    cfop: {
      crossColor: 'White',
      splits: { cross, f2l1, f2l2, f2l3, f2l4, f2lTotal, oll, pll },
      ollCase: { shortName: 'OLL 43', name: 'OLL 43' },
      pllCase: { shortName: 'Ua', name: 'Ua-Perm' },
      pauses: { totalCount: 1, totalMs: 600 },
      steps: [
        { phase: 'cross', label: 'Cross', caseId: 'White', ms: cross, accumMs: cross, moveCount: 6, recogMs: null, setupMoves: '', execMs: cross, pauseCount: 0, pauseMs: 0, execMoves: "R U' F'" },
        { phase: 'f2l1', label: 'F2L 1', caseId: 'BL', ms: f2l1, accumMs: cross + f2l1, moveCount: 7, recogMs: 400, setupMoves: 'D', execMs: 1200, pauseCount: 0, pauseMs: 0, execMoves: "L' U' L" },
        { phase: 'oll', label: 'OLL', caseId: 'OLL 43', ms: oll, accumMs: cross + f2lTotal + oll, moveCount: 8, recogMs: 500, setupMoves: 'D2', execMs: 800, pauseCount: 0, pauseMs: 0, execMoves: "R U R' U'" },
        { phase: 'pll', label: 'PLL', caseId: 'Ua', ms: pll, accumMs: cross + f2lTotal + oll + pll, moveCount: 11, recogMs: 450, setupMoves: '', execMs: pll - 450, pauseCount: 1, pauseMs: 600, execMoves: "R U' R U R U" }
      ]
    }
  };
}

test('renderCfopStepTable supports simplified Basic (Step/Total/Accum) vs full Advanced tables', () => {
  const solve = makeCfopSolve(1, 10800);

  const basicHtml = renderCfopStepTable(solve, { basic: true });
  assert.ok(basicHtml.includes('cfop-step-table-basic'));
  assert.ok(basicHtml.includes('>Step<'));
  assert.ok(basicHtml.includes('>Total<'));
  assert.ok(basicHtml.includes('>Accum<'));
  assert.ok(!basicHtml.includes('>Recog<'));
  assert.ok(!basicHtml.includes('>Setup<'));
  assert.ok(!basicHtml.includes('>Exec<'));
  assert.ok(!basicHtml.includes('>Pauses<'));
  assert.ok(!basicHtml.includes('>Recon<'));

  const inlineBasicHtml = renderLastSolveCfopInline(solve, { basic: true });
  assert.ok(inlineBasicHtml.includes('cfop-step-table-basic'));

  const advHtml = renderCfopStepTable(solve, { detailed: false, basic: false });
  assert.ok(!advHtml.includes('cfop-step-table-basic'));
  assert.ok(advHtml.includes('>Recog<'));
  assert.ok(advHtml.includes('>Setup<'));
  assert.ok(advHtml.includes('>Exec<'));
  assert.ok(advHtml.includes('>Pauses<'));
  assert.ok(advHtml.includes('>Recon<'));
});

test('renderSolveStatsBar renders time-only chips (no #N prefix) and side-by-side Basic vs horizontal Advanced layouts', () => {
  const solves = Array.from({ length: 14 }, (_, i) => makeCfopSolve(i, 10000 + i * 100));
  const container = makeMockContainer();
  let selectedSolve = null;

  // Advanced horizontal bar
  renderSolveStatsBar(container, solves, {
    sessionName: '3x3 Main',
    compact: false,
    onSelectSolve: (sv) => { selectedSolve = sv; }
  });

  assert.ok(container.innerHTML.includes('recent-stats-panel'));
  assert.ok(container.innerHTML.includes('Recent Stats'));
  assert.ok(container.innerHTML.includes('3x3 Main'));
  assert.ok(!container.innerHTML.includes('#14 &middot;'));
  assert.ok(container.innerHTML.includes('><strong>11.30</strong></button>'));

  const advChips = [...container.innerHTML.matchAll(/class="recent-solve-chip([^"]*)"/g)];
  assert.strictEqual(advChips.length, 12);
  assert.strictEqual(advChips.filter(m => m[1].includes('is-desktop-extra')).length, 7);

  assert.ok(container.innerHTML.includes('Single'));
  assert.ok(container.innerHTML.includes('Ao5'));
  assert.ok(container.innerHTML.includes('Ao12'));
  assert.ok(container.innerHTML.includes('Ao100'));
  assert.ok(container.innerHTML.includes('>Current<'));
  assert.ok(container.innerHTML.includes('>Best<'));

  container.triggerRecentChipClick('13');
  assert.strictEqual(selectedSolve, solves[13]);

  // Basic side-by-side without step table -> 2-column grid + vertical solve list + 3-col Metric/Current/Best table
  renderSolveStatsBar(container, solves, {
    sessionName: '3x3 Main',
    compact: true,
    onSelectSolve: (sv) => { selectedSolve = sv; }
  });
  assert.ok(container.innerHTML.includes('solve-basic-grid is-two-col'));
  assert.ok(container.innerHTML.includes('recent-solves-col-list'));
  assert.ok(container.innerHTML.includes('recent-stats-vtable'));
  assert.ok(container.innerHTML.includes('>Metric<'));
  assert.ok(container.innerHTML.includes('>Current<'));
  assert.ok(container.innerHTML.includes('>Best<'));
  assert.ok(!container.innerHTML.includes('solve-basic-col-steps'));
  assert.ok(!container.innerHTML.includes('#14 &middot;'));

  selectedSolve = null;
  container.triggerRecentChipClick('13');
  assert.strictEqual(selectedSolve, solves[13]);

  // Basic side-by-side WITH step breakdown -> 3-column grid
  const stepHtml = renderLastSolveCfopInline(solves[13], { basic: true });
  renderSolveStatsBar(container, solves, {
    sessionName: '3x3 Main',
    compact: true,
    stepBreakdownHtml: stepHtml
  });
  assert.ok(container.innerHTML.includes('solve-basic-grid '));
  assert.ok(!container.innerHTML.includes('is-two-col'));
  assert.ok(container.innerHTML.includes('solve-basic-col-steps'));
  assert.ok(container.innerHTML.includes('Last Solve'));
  assert.ok(container.innerHTML.includes('cfop-step-table-basic'));

  // Empty list clears container markup
  renderSolveStatsBar(container, [], { sessionName: '3x3 Main' });
  assert.strictEqual(container.innerHTML, '');
});

test('createSessionLogView omits redundant Session Summary, supports Last 5/12/100/Session CFOP phases, and honors Basic vs Advanced mode', () => {
  const store = new AppStore();
  store.state.currentPuzzle = '333';
  const sess = store.getActiveSession();
  sess.name = '3x3 Practice';
  sess.puzzle = '333';
  sess.solves = Array.from({ length: 105 }, (_, i) => makeCfopSolve(i, 9500 + (i % 7) * 200));

  const view = createSessionLogView({ appStore: store });
  const container = makeMockContainer();

  // Advanced mode
  store.state.advancedMode = true;
  view.render(container);

  // Redundant Session Summary widget and Ao summary cards removed
  assert.ok(!container.innerHTML.includes('stats-session-scope-head'));
  assert.ok(!container.innerHTML.includes('layer-stats-grid'));
  assert.ok(!container.innerHTML.includes('Session Summary'));
  assert.ok(!container.innerHTML.includes('class="layer-stat-lbl">Ao5<'));
  assert.ok(!container.innerHTML.includes('class="layer-stat-lbl">Ao12<'));
  assert.ok(!container.innerHTML.includes('class="layer-stat-lbl">Ao100<'));
  assert.ok(container.innerHTML.includes('3x3 Practice'));

  // Expanded CFOP scopes: Last 5, Last 12, Last 100, Session
  assert.ok(container.innerHTML.includes('Last 5'));
  assert.ok(container.innerHTML.includes('Last 12'));
  assert.ok(container.innerHTML.includes('Last 100'));
  assert.ok(container.innerHTML.includes('<strong>Session</strong>'));
  assert.ok(container.innerHTML.includes('data-cfop-metric="median"'));
  assert.ok(container.innerHTML.includes('data-cfop-metric="trim"'));
  assert.ok(container.innerHTML.includes('data-cfop-metric="mean"'));
  assert.ok(container.innerHTML.includes('data-cfop-metric="all"'));

  // Full 3x3 Solve Log columns in Advanced
  assert.ok(container.innerHTML.includes('data-log-sort="f2l1"'));
  assert.ok(container.innerHTML.includes('data-log-sort="pauseMs"'));
  assert.ok(container.innerHTML.includes('cfop-case-breakdown-card'));

  // Metric switching via [data-cfop-metric]
  container.triggerMetricClick('all');
  assert.ok(container.innerHTML.includes('Last 5 &middot; Median'));
  assert.ok(container.innerHTML.includes('Last 5 &middot; Trim10%'));
  assert.ok(container.innerHTML.includes('Last 100 &middot; Mean'));

  // Basic mode on 3x3
  store.state.advancedMode = false;
  view.render(container);

  assert.ok(!container.innerHTML.includes('stats-session-scope-head'));
  assert.ok(!container.innerHTML.includes('layer-stats-grid'));
  assert.ok(!container.innerHTML.includes('cfop-avg-comparison-table'));
  assert.ok(!container.innerHTML.includes('cfop-case-breakdown-card'));
  assert.ok(container.innerHTML.includes('cfop-solve-log-table is-basic-log'));
  assert.ok(container.innerHTML.includes('data-log-sort="cross"'));
  assert.ok(!container.innerHTML.includes('data-log-sort="f2l1"'));
  assert.ok(!container.innerHTML.includes('data-log-sort="pauseMs"'));

  // Basic mode on 2x2
  store.state.currentPuzzle = '222';
  sess.puzzle = '222';
  sess.solves = [{ ms: 3200, puzzle: '222', target: 'cll', id: 'H1', scramble: "R U R' U'", at: Date.now() }];
  view.render(container);
  assert.ok(container.innerHTML.includes('standard-solve-log-table is-basic-log'));
  assert.ok(container.innerHTML.includes('data-log-sort="id"'));
  assert.ok(!container.innerHTML.includes('data-log-sort="pickupMs"'));
});

test('AppStore manages advancedMode preference, sync metadata, and keyboard shortcut registration', () => {
  assert.ok(SHORTCUT_ACTION_IDS.has('action:toggleAdvancedMode'));

  const localSnap = {
    schemaVersion: 1,
    hasLocalSettings: true,
    settings: { advancedMode: false, activeSessionId: 's1' },
    timestamps: { settings: { advancedMode: 1000 } },
    sessions: [{ id: 's1', name: 'Main', puzzle: '333', solves: [{ ms: 10000, at: 1000 }], updatedAt: 1000 }]
  };
  const remoteSnap = {
    schemaVersion: 1,
    hasLocalSettings: true,
    settings: { advancedMode: true, activeSessionId: 's1' },
    timestamps: { settings: { advancedMode: 2000 } },
    sessions: [{ id: 's1', name: 'Main', puzzle: '333', solves: [{ ms: 10000, at: 1000 }], updatedAt: 1000 }]
  };
  const syncResult = mergeSyncPayloads(localSnap, remoteSnap);
  assert.strictEqual(syncResult.merged.settings.advancedMode, true);

  const store = new AppStore();
  assert.strictEqual(store.state.advancedMode, false);

  store.setAdvancedMode(true);
  assert.strictEqual(store.state.advancedMode, true);
  assert.strictEqual(store.getSettingsPayload().advancedMode, true);

  store.hydrateFromSync({ settings: { advancedMode: false }, sessions: store.state.sessions });
  assert.strictEqual(store.state.advancedMode, false);
});
