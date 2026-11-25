import test from 'node:test';
import assert from 'node:assert/strict';
import { AppStore } from '../src/state/appStore.js';
import { clearPreferredAlgsCache } from '../src/data/algRegistry.js';
import {
  SYNC_SCHEMA_VERSION,
  MAX_MERGED_SOLVES,
  getSolveFingerprint,
  isSnapshotEmpty,
  mergeSyncPayloads
} from '../src/services/syncMerge.js';
import {
  exportLocalSyncPayload,
  parseBackupJson,
  importAndMergeBackup
} from '../src/services/syncStorage.js';

function makeSnapshot(overrides = {}) {
  return {
    schemaVersion: SYNC_SCHEMA_VERSION,
    updatedAt: 1000,
    hasLocalSettings: true,
    settings: {
      currentPuzzle: "222",
      currentTrackId: "cll",
      mode: "solve",
      darkMode: false,
      alwaysWhiteBottom: true,
      allowAUF: true,
      showReflection: true,
      selectedByTrack: { "222:cll": ["H1", "H2"] },
      activeSessionId: "default",
      customColors: { white: "#ffffff", yellow: "#ffd500" }
    },
    sessions: [
      { id: "default", name: "Session 1 (Full Solve)", target: "full", showCube: true, inspection: true, solves: [] },
      { id: "layer", name: "1st Layer Practice", target: "layer", showCube: true, inspection: true, solves: [] }
    ],
    stats: {},
    caseTags: {},
    customCllLabels: {},
    pblSettings: {},
    preferredAlgs: {},
    savedSmartCubes: [],
    deletedSmartCubes: [],
    tombstones: {
      sessions: {},
      solves: {},
      caseTags: {},
      customCllLabels: {},
      preferredAlgs: {},
      pblSettings: {},
      deletedSmartCubes: {}
    },
    timestamps: {
      settings: {},
      selectedByTrack: {},
      caseTags: {},
      customCllLabels: {},
      pblSettings: {},
      preferredAlgs: {},
      sessions: {}
    },
    ...overrides
  };
}

test('fresh machine (even after dismissing onboarding) adopts non-empty remote without overwriting remote settings', () => {
  const localFresh = makeSnapshot({
    updatedAt: 5000,
    hasLocalSettings: true,
    settings: {
      currentPuzzle: "222",
      darkMode: false,
      onboardingCompleted: true,
      selectedByTrack: {}
    },
    timestamps: {
      settings: { onboardingCompleted: 5000 },
      selectedByTrack: {}
    }
  });
  assert.strictEqual(isSnapshotEmpty(localFresh), true);

  const remote = makeSnapshot({
    updatedAt: 2000,
    settings: {
      currentPuzzle: "333",
      currentTrackId: "pll",
      darkMode: true,
      onboardingCompleted: true,
      selectedByTrack: { "333:pll": ["T", "Y"] },
      activeSessionId: "sess-333"
    },
    sessions: [
      {
        id: "sess-333",
        puzzle: "333",
        name: "3x3 Main",
        target: "full",
        solves: [{ uid: "s-1", ms: 11200, at: 1500, scramble: "R U R'" }]
      }
    ],
    timestamps: {
      settings: { darkMode: 2000, currentPuzzle: 2000 }
    }
  });
  assert.strictEqual(isSnapshotEmpty(remote), false);

  const res = mergeSyncPayloads(localFresh, remote, null, 6000);
  assert.strictEqual(res.localChanged, true);
  assert.strictEqual(res.remoteChanged, false);
  assert.strictEqual(res.merged.settings.darkMode, true);
  assert.strictEqual(res.merged.settings.currentPuzzle, "333");
  assert.strictEqual(res.merged.sessions[0].solves.length, 1);
  assert.strictEqual(res.summary.addedSolves, 1);
});

test('non-empty local uploads cleanly to empty remote', () => {
  const local = makeSnapshot({
    sessions: [
      {
        id: "default",
        name: "Session 1",
        solves: [{ uid: "s-1", ms: 4200, at: 1000, scramble: "R U2 R'" }]
      }
    ]
  });
  const remoteEmpty = makeSnapshot({ hasLocalSettings: false, settings: {}, updatedAt: 0 });
  const res = mergeSyncPayloads(local, remoteEmpty, null, 3000);
  assert.strictEqual(res.localChanged, false);
  assert.strictEqual(res.remoteChanged, true);
  assert.strictEqual(res.merged.sessions[0].solves.length, 1);
});

test('merges solves across machines, deduplicates identical solves, orders chronologically, and preserves >500 solves', () => {
  const sharedSolve = { ms: 5000, rawMs: 5000, at: 1000, scramble: "R U R'", puzzle: "222", target: "full" };
  const localSolves = [sharedSolve, { uid: "s-local", ms: 4100, at: 3000, scramble: "F R U" }];
  const remoteSolves = [{ ...sharedSolve }, { uid: "s-remote", ms: 3900, at: 2000, scramble: "U2 R2" }];

  const local = makeSnapshot({
    sessions: [{ id: "default", name: "Main", solves: localSolves }]
  });
  const remote = makeSnapshot({
    sessions: [{ id: "default", name: "Main", solves: remoteSolves }]
  });

  const res = mergeSyncPayloads(local, remote, null, 4000);
  const mergedSolves = res.merged.sessions[0].solves;
  assert.strictEqual(mergedSolves.length, 3);
  assert.deepStrictEqual(mergedSolves.map(s => s.at), [1000, 2000, 3000]);
  assert.strictEqual(res.summary.addedSolves, 1);
  assert.strictEqual(res.summary.uploadedSolves, 1);

  // Verify unlimited MAX_MERGED_SOLVES preserves all 600 merged solves chronologically
  assert.strictEqual(MAX_MERGED_SOLVES, Infinity);
  const manyLocal = Array.from({ length: 300 }, (_, i) => ({ uid: `l-${i}`, ms: 4000 + i, at: 1000 + i * 2 }));
  const manyRemote = Array.from({ length: 300 }, (_, i) => ({ uid: `r-${i}`, ms: 5000 + i, at: 1001 + i * 2 }));
  const capRes = mergeSyncPayloads(
    makeSnapshot({ sessions: [{ id: "default", solves: manyLocal }] }),
    makeSnapshot({ sessions: [{ id: "default", solves: manyRemote }] }),
    null,
    999999
  );
  assert.strictEqual(capRes.merged.sessions[0].solves.length, 600);
  assert.strictEqual(capRes.merged.sessions[0].solves[0].at, 1000);
  assert.strictEqual(capRes.merged.sessions[0].solves[599].at, 1599);
});

test('solve deletion tombstones remove solves deleted on the other machine and penalty LWW picks newer update', () => {
  const solveA = { uid: "s-a", ms: 4000, rawMs: 4000, penalty: null, at: 1000, scramble: "R U" };
  const solveB = { uid: "s-b", ms: 3500, rawMs: 3500, penalty: null, at: 2000, scramble: "F U" };
  const fpA = getSolveFingerprint(solveA);

  const local = makeSnapshot({
    sessions: [{ id: "default", solves: [{ ...solveB, penalty: "+2", ms: 5500, updatedAt: 4000 }] }],
    tombstones: { solves: { [fpA]: 3500 } }
  });
  const remote = makeSnapshot({
    sessions: [{
      id: "default",
      solves: [
        solveA,
        { ...solveB, cfop: { crossColor: "white" }, moves: [{ move: "R", t: 100, split: 100 }] }
      ]
    }]
  });

  const res = mergeSyncPayloads(local, remote, null, 5000);
  const solves = res.merged.sessions[0].solves;
  assert.strictEqual(solves.length, 1);
  assert.strictEqual(solves[0].uid, "s-b");
  assert.strictEqual(solves[0].penalty, "+2");
  assert.strictEqual(solves[0].ms, 5500);
  // Richer CFOP & moves preserved from remote even though local won penalty LWW
  assert.strictEqual(solves[0].cfop.crossColor, "white");
  assert.strictEqual(solves[0].moves.length, 1);
});

test('session create, metadata LWW edit, and session delete tombstone with activeSessionId fallback', () => {
  const local = makeSnapshot({
    settings: { currentPuzzle: "333", activeSessionId: "sess-del", selectedByTrack: {} },
    sessions: [
      { id: "default", name: "Default", puzzle: "333", updatedAt: 1000, solves: [] },
      { id: "sess-local", name: "Local OH", puzzle: "333oh", updatedAt: 2500, solves: [{ uid: "s1", ms: 9000, at: 2500 }] }
    ],
    tombstones: { sessions: { "sess-del": 3000 } }
  });
  const remote = makeSnapshot({
    settings: { currentPuzzle: "333", activeSessionId: "sess-del", selectedByTrack: {} },
    sessions: [
      { id: "default", name: "Renamed 3x3", puzzle: "333", updatedAt: 4000, solves: [] },
      { id: "sess-del", name: "Old Session", puzzle: "333", updatedAt: 1500, solves: [{ uid: "s2", ms: 8000, at: 1500 }] },
      { id: "sess-remote", name: "Remote 4x4", puzzle: "444", updatedAt: 2200, solves: [] }
    ]
  });

  const res = mergeSyncPayloads(local, remote, null, 5000);
  const ids = res.merged.sessions.map(s => s.id);
  assert.ok(ids.includes("default"));
  assert.ok(ids.includes("sess-local"));
  assert.ok(ids.includes("sess-remote"));
  assert.ok(!ids.includes("sess-del"));
  assert.strictEqual(res.merged.sessions.find(s => s.id === "default").name, "Renamed 3x3");
  assert.strictEqual(res.merged.settings.activeSessionId, "default");
});

test('per-field settings LWW and independent per-track selectedByTrack merging', () => {
  const local = makeSnapshot({
    settings: {
      darkMode: true,
      simSpeed: 1,
      selectedByTrack: { "222:cll": ["H1"], "333:pll": ["T", "Y"] }
    },
    timestamps: {
      settings: { darkMode: 5000, simSpeed: 1000 },
      selectedByTrack: { "222:cll": 5000, "333:pll": 1000 }
    }
  });
  const remote = makeSnapshot({
    settings: {
      darkMode: false,
      simSpeed: 2,
      selectedByTrack: { "222:cll": ["H1", "H2", "H3"], "333:pll": ["T"], "333:oll": ["OLL-27"] }
    },
    timestamps: {
      settings: { darkMode: 2000, simSpeed: 4000 },
      selectedByTrack: { "222:cll": 2000, "333:pll": 6000, "333:oll": 3000 }
    }
  });

  const res = mergeSyncPayloads(local, remote, null, 7000);
  assert.strictEqual(res.merged.settings.darkMode, true);
  assert.strictEqual(res.merged.settings.simSpeed, 2);
  assert.deepStrictEqual(res.merged.settings.selectedByTrack["222:cll"], ["H1"]);
  assert.deepStrictEqual(res.merged.settings.selectedByTrack["333:pll"], ["T"]);
  assert.deepStrictEqual(res.merged.settings.selectedByTrack["333:oll"], ["OLL-27"]);
});

test('3-way recognition stats merge handles additive deltas, initial merge, and explicit reset', () => {
  const base = makeSnapshot({
    stats: {
      "222": { cll: { H1: { shown: 10, correct: 8 }, H2: { shown: 5, correct: 4 } } },
      H1: { shown: 10, correct: 8 },
      H2: { shown: 5, correct: 4 }
    }
  });
  const local = makeSnapshot({
    stats: {
      "222": { cll: { H1: { shown: 13, correct: 10 } } }, // H1 +3/+2, H2 explicitly reset!
      H1: { shown: 13, correct: 10 }
    }
  });
  const remote = makeSnapshot({
    stats: {
      "222": { cll: { H1: { shown: 12, correct: 10 }, H2: { shown: 7, correct: 5 } } }, // H1 +2/+2, H2 +2/+1
      H1: { shown: 12, correct: 10 },
      H2: { shown: 7, correct: 5 }
    }
  });

  const res = mergeSyncPayloads(local, remote, base, 5000);
  assert.deepStrictEqual(res.merged.stats["222"].cll.H1, { shown: 15, correct: 12 });
  assert.deepStrictEqual(res.merged.stats.H1, { shown: 15, correct: 12 });
  // H2 reset on local, remote added +2/+1 since base
  assert.deepStrictEqual(res.merged.stats["222"].cll.H2, { shown: 2, correct: 1 });

  // Without base: distinct counts still add across independent machines
  const noBaseRes = mergeSyncPayloads(
    makeSnapshot({ stats: { "333": { pll: { T: { shown: 4, correct: 3 } } } } }),
    makeSnapshot({ stats: { "333": { pll: { T: { shown: 6, correct: 5 } } } } }),
    null,
    5000
  );
  assert.deepStrictEqual(noBaseRes.merged.stats["333"].pll.T, { shown: 10, correct: 8 });

  // Without base: identical counts must NOT exponentially double across repeated syncs
  const identicalNoBase = mergeSyncPayloads(
    makeSnapshot({ stats: { "222": { cll: { H1: { shown: 12, correct: 9 } } }, H1: { shown: 12, correct: 9 } } }),
    makeSnapshot({ stats: { "222": { cll: { H1: { shown: 12, correct: 9 } } }, H1: { shown: 12, correct: 9 } } }),
    null,
    5000
  );
  assert.deepStrictEqual(identicalNoBase.merged.stats["222"].cll.H1, { shown: 12, correct: 9 });

  // Corrupted e+295 scientific floats from legacy sync doubling are discarded cleanly
  const corruptedClean = mergeSyncPayloads(
    makeSnapshot({ stats: { "222": { cll: { H1: { shown: 8.4e295, correct: 8.4e295 }, H2: { shown: 7, correct: 5 } } } } }),
    makeSnapshot({ stats: { "222": { cll: { H2: { shown: 7, correct: 5 } } } } }),
    null,
    5000
  );
  assert.strictEqual(corruptedClean.merged.stats["222"].cll.H1, undefined);
  assert.deepStrictEqual(corruptedClean.merged.stats["222"].cll.H2, { shown: 7, correct: 5 });
});

test('merges caseTags, customCllLabels, pblSettings, preferredAlgs, and savedSmartCubes with tombstones', () => {
  const local = makeSnapshot({
    caseTags: { H1: "learning", H2: "review", H3: "mastered" },
    customCllLabels: { "H1:a1": "Sune", "H2:a1": "Local note" },
    pblSettings: {
      "adj-adj": { selectedAlgId: "pbl-1", customLabels: { "pbl-1": "J perm" } }
    },
    preferredAlgs: { "333:T": "alg-1", "333oh:left:T": "alg-oh-1" },
    savedSmartCubes: [
      { name: "GAN12", mac: "AA:BB:CC:DD:EE:FF", protocol: "GAN", lastConnected: 2000 }
    ],
    deletedSmartCubes: ["MoYuOld"],
    timestamps: {
      caseTags: { H1: 1000, H2: 2000, H3: 2000 },
      customCllLabels: { "H1:a1": 3000, "H2:a1": 1000 },
      pblSettings: { "adj-adj.selectedAlgId": 1000, "adj-adj.customLabels.pbl-1": 4000 },
      preferredAlgs: { "333:T": 5000, "333oh:left:T": 1000 }
    },
    tombstones: {
      caseTags: { H4: 3000 },
      customCllLabels: { "H3:a1": 3000 },
      deletedSmartCubes: { MoYuOld: 3000 }
    }
  });

  const remote = makeSnapshot({
    caseTags: { H1: "mastered", H2: "learning", H4: "learning" },
    customCllLabels: { "H2:a1": "Remote newer note", "H3:a1": "Cleared locally" },
    pblSettings: {
      "adj-adj": { selectedAlgId: "pbl-2", customLabels: { "pbl-1": "Old label", "pbl-2": "T perm" } }
    },
    preferredAlgs: { "333:T": "alg-2", "333oh:left:T": "alg-oh-2" },
    savedSmartCubes: [
      { name: "GAN12", mac: "", protocol: "GAN", lastConnected: 3000 },
      { name: "MoYuOld", mac: "11:22:33:44:55:66", protocol: "MoYu AI", lastConnected: 1500 },
      { name: "QiYiSmart", mac: "66:55:44:33:22:11", protocol: "QiYi", lastConnected: 4000 }
    ],
    timestamps: {
      caseTags: { H1: 1000, H2: 5000, H4: 2000 }, // H1 ties at 1000 -> progression tiebreaker picks mastered
      customCllLabels: { "H2:a1": 4000, "H3:a1": 1000 },
      pblSettings: { "adj-adj.selectedAlgId": 3000, "adj-adj.customLabels.pbl-1": 1000, "adj-adj.customLabels.pbl-2": 2000 },
      preferredAlgs: { "333:T": 2000, "333oh:left:T": 4000 }
    }
  });

  const res = mergeSyncPayloads(local, remote, null, 6000);
  assert.strictEqual(res.merged.caseTags.H1, "mastered");
  assert.strictEqual(res.merged.caseTags.H2, "learning");
  assert.strictEqual(res.merged.caseTags.H3, "mastered");
  assert.strictEqual(res.merged.caseTags.H4, undefined);

  assert.strictEqual(res.merged.customCllLabels["H1:a1"], "Sune");
  assert.strictEqual(res.merged.customCllLabels["H2:a1"], "Remote newer note");
  assert.strictEqual(res.merged.customCllLabels["H3:a1"], undefined);

  assert.strictEqual(res.merged.pblSettings["adj-adj"].selectedAlgId, "pbl-2");
  assert.strictEqual(res.merged.pblSettings["adj-adj"].customLabels["pbl-1"], "J perm");
  assert.strictEqual(res.merged.pblSettings["adj-adj"].customLabels["pbl-2"], "T perm");

  assert.strictEqual(res.merged.preferredAlgs["333:T"], "alg-1");
  assert.strictEqual(res.merged.preferredAlgs["333oh:left:T"], "alg-oh-2");

  const cubeNames = res.merged.savedSmartCubes.map(c => c.name);
  assert.deepStrictEqual(cubeNames, ["QiYiSmart", "GAN12"]);
  assert.strictEqual(res.merged.savedSmartCubes.find(c => c.name === "GAN12").mac, "AA:BB:CC:DD:EE:FF");

  // Idempotency check
  const idem = mergeSyncPayloads(res.merged, res.merged, res.merged, 7000);
  assert.strictEqual(idem.localChanged, false);
  assert.strictEqual(idem.remoteChanged, false);
});

test('statsMergeMode "max" merges recognition stats idempotently for JSON backup imports', () => {
  const local = makeSnapshot({
    stats: { "333": { pll: { T: { shown: 8, correct: 6 }, Y: { shown: 3, correct: 2 } } } }
  });
  const backup = makeSnapshot({
    stats: { "333": { pll: { T: { shown: 10, correct: 7 }, Ja: { shown: 4, correct: 4 } } } }
  });

  const first = mergeSyncPayloads(local, backup, null, 6000, { statsMergeMode: "max" });
  assert.deepStrictEqual(first.merged.stats["333"].pll.T, { shown: 10, correct: 7 });
  assert.deepStrictEqual(first.merged.stats["333"].pll.Y, { shown: 3, correct: 2 });
  assert.deepStrictEqual(first.merged.stats["333"].pll.Ja, { shown: 4, correct: 4 });

  // Re-importing the same backup again must not double-count
  const second = mergeSyncPayloads(first.merged, backup, null, 7000, { statsMergeMode: "max" });
  assert.strictEqual(second.localChanged, false);
  assert.deepStrictEqual(second.merged.stats["333"].pll.T, { shown: 10, correct: 7 });
});

test('parseBackupJson validates input and importAndMergeBackup merges into AppStore idempotently', () => {
  assert.throws(() => parseBackupJson("{not json"), /Invalid JSON/);
  assert.throws(() => parseBackupJson("[]"), /not a valid Cubing\.cc backup/);
  assert.throws(() => parseBackupJson('{"hello":"world"}'), /does not contain Cubing\.cc backup data/);

  const prevLocal = globalThis.localStorage;
  const mem = new Map();
  globalThis.localStorage = {
    get length() { return mem.size; },
    key(i) { return [...mem.keys()][i] ?? null; },
    getItem(k) { return mem.has(k) ? mem.get(k) : null; },
    setItem(k, v) { mem.set(k, String(v)); },
    removeItem(k) { mem.delete(k); },
    clear() { mem.clear(); }
  };
  clearPreferredAlgsCache();

  try {
    const store = new AppStore();
    const solves = store.getSolves();
    solves.push({ uid: "s-local-1", puzzle: "222", ms: 3400, rawMs: 3400, at: 2000, scramble: "R U R'" });
    store.setSolves(solves);
    store.recordCaseStat("222", "cll", "H1", true);

    const exportedJson = JSON.stringify(exportLocalSyncPayload(store));
    const parsedSelf = parseBackupJson(exportedJson);
    assert.ok(Array.isArray(parsedSelf.sessions));

    const externalBackup = makeSnapshot({
      updatedAt: 9000,
      settings: {
        currentPuzzle: "222",
        currentTrackId: "cll",
        darkMode: true,
        selectedByTrack: { "222:cll": ["H1", "H2"] }
      },
      sessions: [
        {
          id: "default",
          name: "Session 1 (Full Solve)",
          target: "full",
          solves: [{ uid: "s-backup-1", puzzle: "222", ms: 2900, rawMs: 2900, at: 3000, scramble: "F U R" }]
        }
      ],
      stats: { "222": { cll: { H1: { shown: 5, correct: 4 }, H2: { shown: 2, correct: 2 } } } },
      timestamps: { settings: { darkMode: 9000 } }
    });

    const res1 = importAndMergeBackup(store, externalBackup, { now: 9500 });
    assert.strictEqual(res1.localChanged, true);
    assert.strictEqual(store.state.darkMode, true);
    assert.deepStrictEqual(store.getSolves().map(s => s.uid), ["s-local-1", "s-backup-1"]);
    assert.deepStrictEqual(store.getCaseStat("222", "cll", "H1"), { shown: 5, correct: 4 });
    assert.deepStrictEqual(store.getCaseStat("222", "cll", "H2"), { shown: 2, correct: 2 });

    // Re-importing same backup is a no-op
    const res2 = importAndMergeBackup(store, externalBackup, { now: 9600 });
    assert.strictEqual(res2.localChanged, false);
    assert.deepStrictEqual(store.getCaseStat("222", "cll", "H1"), { shown: 5, correct: 4 });
  } finally {
    clearPreferredAlgsCache();
    if (prevLocal === undefined) delete globalThis.localStorage;
    else globalThis.localStorage = prevLocal;
  }
});
