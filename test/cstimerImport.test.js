import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  AppStore,
  EXPERIMENTAL_FEATURE_IDS,
  isExperimentalEnabled
} from '../src/state/appStore.js';
import {
  isCsTimerExport,
  parseCsTimerExport,
  parseCsTimerTimeString,
  mapCsTimerScrType,
  importCsTimerSessions
} from '../src/services/cstimerImport.js';
import { createCloudSyncController } from '../src/features/sync/cloudSyncController.js';

test('isCsTimerExport detects csTimer JSON and CSV exports while rejecting Cubing.cc backups', () => {
  assert.strictEqual(isCsTimerExport('{"session1":[[[0,10000],"R U R\'","",1700000000]],"properties":{"sessionData":"{}"}}'), true);
  assert.strictEqual(isCsTimerExport('No.;Time;Comment;Scramble;Date\n1;12.34;"";"R U R\'";2024-05-01 12:00:00'), true);
  assert.strictEqual(isCsTimerExport('{"schemaVersion":1,"sessions":[],"settings":{}}'), false);
  assert.strictEqual(isCsTimerExport('not valid'), false);
});

test('parseCsTimerTimeString parses seconds, minutes, +2, and DNF formats accurately', () => {
  assert.deepStrictEqual(parseCsTimerTimeString('12.34'), { rawMs: 12340, ms: 12340, penalty: null });
  assert.deepStrictEqual(parseCsTimerTimeString('1:02.45'), { rawMs: 62450, ms: 62450, penalty: null });
  assert.deepStrictEqual(parseCsTimerTimeString('14.56+'), { rawMs: 12560, ms: 14560, penalty: '+2' });
  assert.deepStrictEqual(parseCsTimerTimeString('DNF(15.20)'), { rawMs: 15200, ms: 15200, penalty: 'DNF' });
  assert.deepStrictEqual(parseCsTimerTimeString('DNF'), { rawMs: 0, ms: 0, penalty: 'DNF' });
});

test('mapCsTimerScrType maps WCA events, sub-steps, and infers puzzle from session name/scrambles', () => {
  assert.deepStrictEqual(mapCsTimerScrType('222so'), { puzzle: '222', target: 'full' });
  assert.deepStrictEqual(mapCsTimerScrType('333oh'), { puzzle: '333oh', target: 'full' });
  assert.deepStrictEqual(mapCsTimerScrType('444wca'), { puzzle: '444', target: 'full' });
  assert.deepStrictEqual(mapCsTimerScrType('pll'), { puzzle: '333', target: 'pll' });
  assert.deepStrictEqual(mapCsTimerScrType('222eg1'), { puzzle: '222', target: 'eg1' });
  assert.deepStrictEqual(mapCsTimerScrType('', 'My 2x2 CLL Practice', []), { puzzle: '222', target: 'cll' });
  assert.deepStrictEqual(mapCsTimerScrType('', 'Session 1', ["R U' F2 R' U2 F R2 U'"]), { puzzle: '222', target: 'full' });
  assert.deepStrictEqual(mapCsTimerScrType('', 'Session 1', ['UR3+ DR2- y2 U1+ ALL2-']), { puzzle: 'clock', target: 'full' });
});

test('parseCsTimerExport parses csTimer JSON backup with penalties, comments, rank ordering, and smart-cube moves', () => {
  const sampleJson = JSON.stringify({
    session2: [
      [[0, 3210], "R U' F2 R' U2 F R2 U'", "pb!", 1700001000]
    ],
    session1: [
      [[0, 12345], "R U R' U' F2 D2", "smooth cross", 1700000000, ["R@0 U@120 R'@250 U'@380", "333"]],
      [[2000, 14000], "F R U' R' U' R U R' F'", "", 1700000100],
      [[-1, 15500], "U2 R' F2 L2", "popped", 1700000200]
    ],
    session3: [],
    properties: {
      sessionData: JSON.stringify({
        "1": { name: "3x3 Main", opt: { scrType: "333" }, rank: 1 },
        "2": { name: "2x2 Speed", opt: { scrType: "222so" }, rank: 2 },
        "3": { name: "Empty", opt: { scrType: "333" }, rank: 3 }
      })
    }
  });

  const parsed = parseCsTimerExport(sampleJson);
  assert.strictEqual(parsed.format, 'cstimer-json');
  assert.strictEqual(parsed.sessions.length, 2); // Empty session skipped
  assert.strictEqual(parsed.totalSolves, 4);

  // Ordered by rank
  assert.strictEqual(parsed.sessions[0].name, '3x3 Main');
  assert.strictEqual(parsed.sessions[0].puzzle, '333');
  assert.strictEqual(parsed.sessions[0].solves.length, 3);

  const [s0, s1, s2] = parsed.sessions[0].solves;
  assert.strictEqual(s0.ms, 12345);
  assert.strictEqual(s0.rawMs, 12345);
  assert.strictEqual(s0.penalty, null);
  assert.strictEqual(s0.note, 'smooth cross');
  assert.strictEqual(s0.at, 1700000000000);
  assert.strictEqual(s0.smartCube, 'csTimer Smart Cube');
  assert.strictEqual(s0.moveCount, 4);
  assert.deepStrictEqual(s0.moves[0], { move: 'R', t: 0 });

  assert.strictEqual(s1.penalty, '+2');
  assert.strictEqual(s1.rawMs, 14000);
  assert.strictEqual(s1.ms, 16000);

  assert.strictEqual(s2.penalty, 'DNF');
  assert.strictEqual(s2.note, 'popped');

  assert.strictEqual(parsed.sessions[1].name, '2x2 Speed');
  assert.strictEqual(parsed.sessions[1].puzzle, '222');
  assert.strictEqual(parsed.sessions[1].solves[0].ms, 3210);
});

test('parseCsTimerExport parses csTimer semicolon CSV export cleanly', () => {
  const csv = [
    'No.;Time;Comment;Scramble;Date',
    '1;11.25;"great lookahead";"R U R\' U\' L\' U2 B2";2025-02-10 09:15:00',
    '2;13.40+;"";"F2 D\' R2 U B2 L2";2025-02-10 09:16:30',
    '3;DNF(16.80);"corner twist";"D2 L2 F2 U2 R2";2025-02-10 09:18:00'
  ].join('\n');

  const parsed = parseCsTimerExport(csv, { filename: 'cstimer_3x3_main.csv' });
  assert.strictEqual(parsed.format, 'cstimer-csv');
  assert.strictEqual(parsed.sessions.length, 1);
  assert.strictEqual(parsed.sessions[0].puzzle, '333');
  assert.strictEqual(parsed.sessions[0].solves.length, 3);
  assert.strictEqual(parsed.sessions[0].solves[0].ms, 11250);
  assert.strictEqual(parsed.sessions[0].solves[0].note, 'great lookahead');
  assert.strictEqual(parsed.sessions[0].solves[1].penalty, '+2');
  assert.strictEqual(parsed.sessions[0].solves[1].rawMs, 11400);
  assert.strictEqual(parsed.sessions[0].solves[1].ms, 13400);
  assert.strictEqual(parsed.sessions[0].solves[2].penalty, 'DNF');
});

test('importCsTimerSessions merges idempotently into AppStore without duplicating solves', () => {
  const store = new AppStore();
  store.state.currentPuzzle = '333';

  const export1 = parseCsTimerExport(JSON.stringify({
    session1: [
      [[0, 10500], "R U R' U'", "", 1700000000],
      [[0, 11200], "F R U' R'", "", 1700000060]
    ],
    properties: {
      sessionData: JSON.stringify({ "1": { name: "csTimer 3x3", opt: { scrType: "333" }, rank: 1 } })
    }
  }));

  const r1 = importCsTimerSessions(store, export1, { now: 5000 });
  assert.strictEqual(r1.changed, true);
  assert.strictEqual(r1.sessionsAdded, 1);
  assert.strictEqual(r1.solvesAdded, 2);
  assert.strictEqual(store.getActiveSession().id, 'cstimer-session1');

  // Re-importing the exact same export adds 0 duplicates
  const r2 = importCsTimerSessions(store, export1, { now: 6000 });
  assert.strictEqual(r2.changed, false);
  assert.strictEqual(r2.solvesAdded, 0);
  assert.strictEqual(r2.solvesSkipped, 2);

  // Importing an updated export with 1 new solve appends only the new solve
  const export2 = parseCsTimerExport(JSON.stringify({
    session1: [
      [[0, 10500], "R U R' U'", "", 1700000000],
      [[0, 11200], "F R U' R'", "", 1700000060],
      [[0, 9800], "U2 R2 F2", "sub-10!", 1700000120]
    ],
    properties: {
      sessionData: JSON.stringify({ "1": { name: "csTimer 3x3", opt: { scrType: "333" }, rank: 1 } })
    }
  }));

  const r3 = importCsTimerSessions(store, export2, { now: 7000 });
  assert.strictEqual(r3.changed, true);
  assert.strictEqual(r3.sessionsAdded, 0);
  assert.strictEqual(r3.sessionsUpdated, 1);
  assert.strictEqual(r3.solvesAdded, 1);
  assert.strictEqual(r3.solvesSkipped, 2);
  const sess = store.state.sessions.find(s => s.id === 'cstimer-session1');
  assert.strictEqual(sess.solves.length, 3);
  assert.strictEqual(sess.solves[2].ms, 9800);
});

test('cstimerImport is registered as an experimental feature and gated in index.html & cloudSyncController', () => {
  assert.ok(EXPERIMENTAL_FEATURE_IDS.includes('cstimerImport'));

  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.ok(html.includes('id="settingsExp_cstimerImport"'));
  assert.ok(html.includes('data-experimental-feature="cstimerImport"'));
  assert.ok(html.includes('id="settingsCsTimerImportSection" hidden'));
  assert.ok(html.includes('id="settingsImportCsTimerBtn"'));
  assert.match(html, /<button[^>]*id="cloudSyncImportCsTimerBtn"[^>]*hidden/);
  assert.match(html, /<button[^>]*id="statsImportCsTimerBtn"[^>]*hidden/);
  assert.ok(html.includes('id="cloudSyncImportCsTimerInput"'));
  assert.ok(html.includes('Import from csTimer.net<sup class="beta-sup"'));

  const store = new AppStore();
  assert.strictEqual(isExperimentalEnabled(store.state, 'cstimerImport'), false);

  const prevDoc = globalThis.document;
  const mockElements = new Map([
    ['settingsCsTimerImportSection', { hidden: false, addEventListener() {} }],
    ['cloudSyncImportCsTimerBtn', { hidden: false, addEventListener() {} }],
    ['statsImportCsTimerBtn', { hidden: false, addEventListener() {} }],
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

    assert.strictEqual(mockElements.get('settingsCsTimerImportSection').hidden, true);
    assert.strictEqual(mockElements.get('cloudSyncImportCsTimerBtn').hidden, true);
    assert.strictEqual(mockElements.get('statsImportCsTimerBtn').hidden, true);
    assert.strictEqual(mockElements.get('cloudSyncImportInput').accept, '.json,application/json');

    store.setExperimentalFeature('cstimerImport', true);
    ctrl.syncBetaVisibility();

    assert.strictEqual(mockElements.get('settingsCsTimerImportSection').hidden, false);
    assert.strictEqual(mockElements.get('cloudSyncImportCsTimerBtn').hidden, false);
    assert.strictEqual(mockElements.get('statsImportCsTimerBtn').hidden, false);
    assert.strictEqual(
      mockElements.get('cloudSyncImportInput').accept,
      '.json,.txt,.csv,application/json,text/plain,text/csv'
    );

    store.setExperimentalFeature('cstimerImport', false);
    ctrl.syncBetaVisibility();
    assert.strictEqual(mockElements.get('settingsCsTimerImportSection').hidden, true);
    assert.strictEqual(mockElements.get('cloudSyncImportCsTimerBtn').hidden, true);
    assert.strictEqual(mockElements.get('statsImportCsTimerBtn').hidden, true);
  } finally {
    if (prevDoc === undefined) delete globalThis.document;
    else globalThis.document = prevDoc;
  }
});
