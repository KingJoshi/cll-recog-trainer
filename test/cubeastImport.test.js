import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  AppStore,
  EXPERIMENTAL_FEATURE_IDS,
  isExperimentalEnabled
} from '../src/state/appStore.js';
import {
  isCubeastExport,
  parseCubeastSolution,
  parseCubeastExport,
  importCubeastSessions
} from '../src/services/cubeastImport.js';
import { analyzeCfopSolve } from '../src/cfopAnalyzer.js';
import { createCloudSyncController } from '../src/features/sync/cloudSyncController.js';

const SAMPLE_HEADER = [
  'id', 'date', 'dnf', 'time', 'solving_method', 'device_name', 'device_model',
  'device_color_scheme', 'user', 'one_turn_away_two_second_penalty',
  'inspection_two_second_penalty', 'inspection_time', 'timer_time', 'missing_turn',
  'solution', 'timer', 'description', 'session_name', 'session_ruleset', 'scramble',
  'scramble_provider', 'ruleset', 'pickup_time', 'putdown_time', 'solving_time',
  'face_turns', 'turns_per_second', 'step_5_case', 'step_6_case'
].join(',');

function makeSampleRow(overrides = {}) {
  const row = {
    id: '7a6fe2a8-efcb-483c-a511-c35dd7f8cb79',
    date: '2024-05-22 09:31:16 UTC',
    dnf: 'false',
    time: '14028',
    solving_method: 'CFOP',
    device_name: 'Gan12ui',
    device_model: 'Gan 12 UI FreePlay',
    device_color_scheme: 'Gan 356i',
    user: 'Kiran',
    one_turn_away_two_second_penalty: 'false',
    inspection_two_second_penalty: 'false',
    inspection_time: '4094',
    timer_time: '14028',
    missing_turn: '',
    solution:
      "D'[0] B'[251] L[369] R'[638] F[1054] F[1121] U[1621] R[2396] D'[2466] R'[2573] F[3465] D[3568] F'[3728] D[4369] B[4577] D'[4642] D'[4862] B'[4993] D'[5125] B[5328] D[5382] B'[5447] D'[7145] D'[7364] L[7512] D[7569] L'[7641] D[8426] B'[8652] D'[8729] B[8787] D'[9008] B'[9074] D[9181] B[9265] B'[10152] D'[10204] B[10291] D'[10487] B'[10584] D[10654] B[10775] D[10893] B[11008] R'[11072] B'[11161] R[11381] D'[12036] F'[12260] B[12263] F'[12335] B[12338] U[12626] F[12781] B'[12799] R[13028] R[13072] F'[13331] B[13335] U[13714] B[13942] F'[13957] B[14017] F'[14028]",
    timer: 'cube',
    description: '',
    session_name: 'WhiteYellow',
    session_ruleset: 'custom_rules',
    scramble: "B2 R U2 D' R U2 D' F R B D2 L2 D L2 F2 L2 U' L2 F2 D L2 F2",
    scramble_provider: 'random_state',
    ruleset: 'custom_rules',
    pickup_time: '0',
    putdown_time: '0',
    solving_time: '14028',
    face_turns: '56',
    turns_per_second: '3.64',
    step_5_case: '36',
    step_6_case: 'Ua',
    ...overrides
  };
  return Object.values(row).map(v => {
    const s = String(v ?? '');
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }).join(',');
}

test('isCubeastExport detects Cubeast CSV (with/without BOM) and rejects csTimer & Cubing.cc backups', () => {
  const csv = `${SAMPLE_HEADER}\n${makeSampleRow()}`;
  assert.strictEqual(isCubeastExport(csv), true);
  assert.strictEqual(isCubeastExport(`\uFEFF${csv}`), true);
  assert.strictEqual(isCubeastExport('No.;Time;Comment;Scramble;Date\n1;12.34;"";"R U R\'";2024-05-01 12:00:00'), false);
  assert.strictEqual(isCubeastExport('{"session1":[[[0,10000],"R U R\'","",1700000000]]}'), false);
  assert.strictEqual(isCubeastExport('{"schemaVersion":1,"sessions":[]}'), false);
});

test('parseCubeastSolution parses Cubeast MOVE[MS] tokens into native move objects with splits', () => {
  const moves = parseCubeastSolution("D'[0] B'[251] x[300] Rw2'[550] U2[700]");
  assert.strictEqual(moves.length, 5);
  assert.deepStrictEqual(moves[0], { move: "D'", t: 0, split: 0, isRotation: false });
  assert.deepStrictEqual(moves[1], { move: "B'", t: 251, split: 251, isRotation: false });
  assert.deepStrictEqual(moves[2], { move: "x", t: 300, split: 49, isRotation: true });
  assert.deepStrictEqual(moves[3], { move: "Rw2'", t: 550, split: 250, isRotation: false });
  assert.deepStrictEqual(moves[4], { move: "U2", t: 700, split: 150, isRotation: false });
});

test('parseCubeastExport handles multi-session grouping, penalties, inspection/pickup splits, and CFOP compatibility', async () => {
  const csv = [
    SAMPLE_HEADER,
    makeSampleRow({
      id: 'solve-1',
      date: '2024-05-22 09:31:16 UTC',
      description: 'clean lookahead, slight pause',
      inspection_time: '4094',
      pickup_time: '240',
      putdown_time: '180',
      solving_time: '13608'
    }),
    makeSampleRow({
      id: 'solve-2',
      date: '2024-05-22 09:32:00 UTC',
      time: '12500',
      timer_time: '10500',
      solving_time: '10500',
      one_turn_away_two_second_penalty: 'true',
      session_name: 'WhiteYellow'
    }),
    makeSampleRow({
      id: 'solve-3',
      date: '2024-05-22 09:33:00 UTC',
      dnf: 'true',
      time: '15000',
      timer_time: '15000',
      session_name: 'OH Main'
    })
  ].join('\n');

  const parsed = parseCubeastExport(csv);
  assert.strictEqual(parsed.format, 'cubeast-csv');
  assert.strictEqual(parsed.totalSolves, 3);
  assert.strictEqual(parsed.sessions.length, 2);

  const wy = parsed.sessions.find(s => s.name === 'WhiteYellow');
  assert.ok(wy);
  assert.strictEqual(wy.puzzle, '333');
  assert.strictEqual(wy.solves.length, 2);

  const s0 = wy.solves[0];
  assert.strictEqual(s0.uid, 'cubeast-solve-1');
  assert.strictEqual(s0.ms, 14028);
  assert.strictEqual(s0.rawMs, 14028);
  assert.strictEqual(s0.penalty, null);
  assert.strictEqual(s0.at, Date.parse('2024-05-22T09:31:16Z'));
  assert.strictEqual(s0.note, 'clean lookahead, slight pause');
  assert.strictEqual(s0.smartCube, 'Gan 12 UI FreePlay');
  assert.strictEqual(s0.inspectionMs, 4094);
  assert.strictEqual(s0.pickupMs, 240);
  assert.strictEqual(s0.putdownMs, 180);
  assert.strictEqual(s0.cubeMs, 13608);
  assert.strictEqual(s0.moveCount, 64);

  const cfop = await analyzeCfopSolve(s0);
  assert.strictEqual(cfop.isFullCfop, true);
  assert.strictEqual(cfop.crossColor, 'White');
  assert.strictEqual(cfop.ollCase?.id, 'oll-36');
  assert.strictEqual(cfop.pllCase?.id, 'Ua');

  const s1 = wy.solves[1];
  assert.strictEqual(s1.penalty, '+2');
  assert.strictEqual(s1.finishState, '+2');
  assert.strictEqual(s1.rawMs, 10500);
  assert.strictEqual(s1.ms, 12500);

  const oh = parsed.sessions.find(s => s.name === 'OH Main');
  assert.ok(oh);
  assert.strictEqual(oh.puzzle, '333oh');
  assert.strictEqual(oh.solves[0].penalty, 'DNF');
});

test('importCubeastSessions merges idempotently into AppStore', () => {
  const store = new AppStore();
  store.state.currentPuzzle = '333';

  const csv1 = `${SAMPLE_HEADER}\n${makeSampleRow({ id: 'a1' })}\n${makeSampleRow({ id: 'a2', date: '2024-05-22 09:32:00 UTC', time: '11111', timer_time: '11111' })}`;
  const r1 = importCubeastSessions(store, parseCubeastExport(csv1), { now: 5000 });
  assert.strictEqual(r1.changed, true);
  assert.strictEqual(r1.sessionsAdded, 1);
  assert.strictEqual(r1.solvesAdded, 2);

  // Re-importing same CSV skips duplicates
  const r2 = importCubeastSessions(store, parseCubeastExport(csv1), { now: 6000 });
  assert.strictEqual(r2.changed, false);
  assert.strictEqual(r2.solvesAdded, 0);
  assert.strictEqual(r2.solvesSkipped, 2);

  // Adding one new row merges only the new solve
  const csv2 = `${csv1}\n${makeSampleRow({ id: 'a3', date: '2024-05-22 09:33:00 UTC', time: '9999', timer_time: '9999' })}`;
  const r3 = importCubeastSessions(store, parseCubeastExport(csv2), { now: 7000 });
  assert.strictEqual(r3.changed, true);
  assert.strictEqual(r3.solvesAdded, 1);
  assert.strictEqual(r3.solvesSkipped, 2);
});

test('cubeastImport is registered as experimental beta feature and gated across index.html & cloudSyncController', () => {
  assert.ok(EXPERIMENTAL_FEATURE_IDS.includes('cubeastImport'));

  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(html.includes('id="settingsExp_cubeastImport"'));
  assert.ok(html.includes('data-experimental-feature="cubeastImport"'));
  assert.ok(html.includes('id="settingsCubeastImportSection" hidden'));
  assert.ok(html.includes('id="settingsImportCubeastBtn"'));
  assert.match(html, /<button[^>]*id="cloudSyncImportCubeastBtn"[^>]*hidden/);
  assert.match(html, /<button[^>]*id="statsImportCubeastBtn"[^>]*hidden/);
  assert.ok(html.includes('id="cloudSyncImportCubeastInput"'));
  assert.ok(html.includes('Import from Cubeast<sup class="beta-sup"'));

  const store = new AppStore();
  assert.strictEqual(isExperimentalEnabled(store.state, 'cubeastImport'), false);

  const prevDoc = globalThis.document;
  const mockElements = new Map([
    ['settingsCsTimerImportSection', { hidden: false, addEventListener() {} }],
    ['cloudSyncImportCsTimerBtn', { hidden: false, addEventListener() {} }],
    ['statsImportCsTimerBtn', { hidden: false, addEventListener() {} }],
    ['settingsCubeastImportSection', { hidden: false, addEventListener() {} }],
    ['cloudSyncImportCubeastBtn', { hidden: false, addEventListener() {} }],
    ['statsImportCubeastBtn', { hidden: false, addEventListener() {} }],
    ['cloudSyncImportInput', { accept: '.json,application/json', addEventListener() {} }]
  ]);
  globalThis.document = {
    activeElement: null,
    documentElement: { style: { setProperty() {} } },
    querySelector: () => null,
    getElementById: id => mockElements.get(id) || null
  };

  try {
    const mockSync = {
      getState: () => ({ status: 'signed_out', signedIn: false }),
      subscribe: () => () => {}
    };
    const ctrl = createCloudSyncController({
      googleDriveSync: mockSync,
      appStore: store,
      modalManager: { open() {}, close() {} }
    });

    assert.strictEqual(mockElements.get('settingsCubeastImportSection').hidden, true);
    assert.strictEqual(mockElements.get('cloudSyncImportCubeastBtn').hidden, true);
    assert.strictEqual(mockElements.get('statsImportCubeastBtn').hidden, true);
    assert.strictEqual(mockElements.get('cloudSyncImportInput').accept, '.json,application/json');

    store.setExperimentalFeature('cubeastImport', true);
    ctrl.syncBetaVisibility();

    assert.strictEqual(mockElements.get('settingsCubeastImportSection').hidden, false);
    assert.strictEqual(mockElements.get('cloudSyncImportCubeastBtn').hidden, false);
    assert.strictEqual(mockElements.get('statsImportCubeastBtn').hidden, false);
    assert.strictEqual(
      mockElements.get('cloudSyncImportInput').accept,
      '.json,.csv,application/json,text/csv'
    );

    store.setExperimentalFeature('cstimerImport', true);
    ctrl.syncBetaVisibility();
    assert.strictEqual(
      mockElements.get('cloudSyncImportInput').accept,
      '.json,.txt,.csv,application/json,text/plain,text/csv'
    );

    store.setExperimentalFeature('cubeastImport', false);
    ctrl.syncBetaVisibility();
    assert.strictEqual(mockElements.get('settingsCubeastImportSection').hidden, true);
    assert.strictEqual(mockElements.get('cloudSyncImportCubeastBtn').hidden, true);
    assert.strictEqual(mockElements.get('statsImportCubeastBtn').hidden, true);
  } finally {
    if (prevDoc === undefined) delete globalThis.document;
    else globalThis.document = prevDoc;
  }
});
