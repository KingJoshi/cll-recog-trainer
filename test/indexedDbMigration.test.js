import test from 'node:test';
import assert from 'node:assert/strict';
import { AppStore } from '../src/state/appStore.js';
import { resetIndexedDbCache, idbGet, idbSet } from '../src/state/indexedDbStore.js';
import {
  SESSIONS_STORAGE_KEY,
  LEGACY_SOLVES_KEY,
  LEGACY_LAYER_SOLVES_KEY,
  LEGACY_SESSION_STORAGE_KEYS,
  loadAndMigrateSessionsFromIdb,
  mergeSessionLists
} from '../src/state/sessionStore.js';

function createMockLocalStorage(initial = {}) {
  const store = { ...initial };
  return {
    _data: store,
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; },
    key: i => Object.keys(store)[i] ?? null,
    get length() { return Object.keys(store).length; }
  };
}

function createMockIndexedDb({ failPut = false } = {}) {
  const kv = new Map();
  let storeExists = false;

  const fireAsync = (fn) => {
    if (typeof fn === 'function') queueMicrotask(fn);
  };

  return {
    _kv: kv,
    open() {
      const req = {
        result: null,
        error: null,
        onupgradeneeded: null,
        onsuccess: null,
        onerror: null,
        onblocked: null
      };
      const db = {
        objectStoreNames: {
          contains: (name) => name === 'kv' && storeExists
        },
        createObjectStore: (name) => {
          if (name === 'kv') storeExists = true;
          return {};
        },
        close: () => {},
        transaction: () => {
          const tx = {
            oncomplete: null,
            onerror: null,
            onabort: null,
            objectStore: () => ({
              get: (k) => {
                const gReq = { result: undefined, onsuccess: null, onerror: null };
                queueMicrotask(() => {
                  gReq.result = kv.has(k) ? JSON.parse(JSON.stringify(kv.get(k))) : undefined;
                  gReq.onsuccess?.();
                  tx.oncomplete?.();
                });
                return gReq;
              },
              put: (val, k) => {
                const pReq = { onsuccess: null, onerror: null };
                queueMicrotask(() => {
                  if (failPut) {
                    pReq.onerror?.();
                    tx.onerror?.();
                    return;
                  }
                  kv.set(k, JSON.parse(JSON.stringify(val)));
                  pReq.onsuccess?.();
                  tx.oncomplete?.();
                });
                return pReq;
              },
              delete: (k) => {
                const dReq = { onsuccess: null, onerror: null };
                queueMicrotask(() => {
                  kv.delete(k);
                  dReq.onsuccess?.();
                  tx.oncomplete?.();
                });
                return dReq;
              }
            })
          };
          return tx;
        }
      };
      req.result = db;
      fireAsync(() => {
        if (!storeExists) req.onupgradeneeded?.();
        req.onsuccess?.();
      });
      return req;
    }
  };
}

test('loadAndMigrateSessionsFromIdb moves localStorage sessions into IndexedDB and cleans legacy keys', async () => {
  const prevLs = globalThis.localStorage;
  const prevIdb = globalThis.indexedDB;
  const sampleSessions = [
    {
      id: 'sess-1',
      puzzle: '333',
      name: '3x3 Main',
      target: 'full',
      solves: [{ uid: 's1', ms: 12340, at: 1000, scramble: "R U R'" }]
    }
  ];
  const mockLs = createMockLocalStorage({
    [SESSIONS_STORAGE_KEY]: JSON.stringify(sampleSessions),
    [LEGACY_SOLVES_KEY]: JSON.stringify([{ ms: 12340, at: 1000 }]),
    [LEGACY_LAYER_SOLVES_KEY]: JSON.stringify([])
  });
  const mockIdb = createMockIndexedDb();

  globalThis.localStorage = mockLs;
  globalThis.indexedDB = mockIdb;
  resetIndexedDbCache();

  try {
    const res = await loadAndMigrateSessionsFromIdb();
    assert.strictEqual(res.migrated, true);
    assert.strictEqual(res.backend, 'indexeddb');
    assert.strictEqual(res.sessions.length, 1);
    assert.strictEqual(res.sessions[0].solves[0].ms, 12340);

    const storedInIdb = await idbGet(SESSIONS_STORAGE_KEY);
    assert.strictEqual(storedInIdb.length, 1);
    assert.strictEqual(storedInIdb[0].solves[0].uid, 's1');

    for (const k of LEGACY_SESSION_STORAGE_KEYS) {
      assert.strictEqual(mockLs.getItem(k), null, `Legacy key ${k} should be removed after IDB write succeeds`);
    }
  } finally {
    resetIndexedDbCache();
    globalThis.localStorage = prevLs;
    globalThis.indexedDB = prevIdb;
  }
});

test('loadAndMigrateSessionsFromIdb keeps localStorage intact if IndexedDB write fails', async () => {
  const prevLs = globalThis.localStorage;
  const prevIdb = globalThis.indexedDB;
  const sampleSessions = [
    {
      id: 'sess-safe',
      puzzle: '222',
      name: '2x2 Main',
      target: 'full',
      solves: [{ uid: 's2', ms: 4320, at: 2000, scramble: 'R U2' }]
    }
  ];
  const mockLs = createMockLocalStorage({
    [SESSIONS_STORAGE_KEY]: JSON.stringify(sampleSessions)
  });
  const failingIdb = createMockIndexedDb({ failPut: true });

  globalThis.localStorage = mockLs;
  globalThis.indexedDB = failingIdb;
  resetIndexedDbCache();

  try {
    const res = await loadAndMigrateSessionsFromIdb();
    assert.strictEqual(res.migrated, false);
    assert.ok(mockLs.getItem(SESSIONS_STORAGE_KEY) !== null, 'localStorage must not be deleted when IDB write fails');
  } finally {
    resetIndexedDbCache();
    globalThis.localStorage = prevLs;
    globalThis.indexedDB = prevIdb;
  }
});

test('mergeSessionLists merges sessions and deduplicates solves without loss', () => {
  const primary = [
    {
      id: 's-main',
      name: 'Main',
      puzzle: '333',
      updatedAt: 100,
      solves: [{ uid: 'a', ms: 10000, at: 1000 }, { uid: 'b', ms: 11000, at: 2000 }]
    }
  ];
  const secondary = [
    {
      id: 's-main',
      name: 'Main Renamed',
      puzzle: '333',
      updatedAt: 200,
      solves: [{ uid: 'b', ms: 11000, at: 2000 }, { uid: 'c', ms: 9500, at: 3000 }]
    },
    {
      id: 's-222',
      name: '2x2 Extra',
      puzzle: '222',
      updatedAt: 150,
      solves: [{ uid: 'd', ms: 3200, at: 1500 }]
    }
  ];

  const merged = mergeSessionLists(primary, secondary);
  assert.strictEqual(merged.length, 2);
  const main = merged.find(s => s.id === 's-main');
  assert.strictEqual(main.name, 'Main Renamed');
  assert.deepStrictEqual(main.solves.map(s => s.uid), ['a', 'b', 'c']);
  const extra = merged.find(s => s.id === 's-222');
  assert.strictEqual(extra.solves.length, 1);
});

test('AppStore hydrates sessions from IndexedDB and writes subsequent solves to IndexedDB only', async () => {
  const prevLs = globalThis.localStorage;
  const prevIdb = globalThis.indexedDB;
  const mockLs = createMockLocalStorage({});
  const mockIdb = createMockIndexedDb();

  globalThis.localStorage = mockLs;
  globalThis.indexedDB = mockIdb;
  resetIndexedDbCache();

  try {
    await idbSet(SESSIONS_STORAGE_KEY, [
      {
        id: 'default',
        puzzle: '333',
        name: '3x3 IDB Session',
        target: 'full',
        solves: [{ uid: 'idb-1', ms: 14500, at: 5000, scramble: "R U F'" }]
      }
    ]);

    const store = new AppStore();
    assert.strictEqual(mockLs.getItem(SESSIONS_STORAGE_KEY), null, 'constructor should not write dummy sessions to localStorage when IDB is active');

    const hydRes = await store.hydrateFromIndexedDb();
    assert.strictEqual(hydRes.hydrated, true);
    assert.strictEqual(store.state.sessions[0].name, '3x3 IDB Session');
    assert.strictEqual(store.state.sessions[0].solves.length, 1);

    store.setSolves([
      ...store.getSolves(),
      { uid: 'idb-2', ms: 13200, at: 6000, scramble: "U R2 F" }
    ]);

    // Allow microtask IDB write queue to flush
    await new Promise(r => setTimeout(r, 20));
    assert.strictEqual(mockLs.getItem(SESSIONS_STORAGE_KEY), null);
    assert.strictEqual(mockLs.getItem(LEGACY_SOLVES_KEY), null);
    const savedIdb = await idbGet(SESSIONS_STORAGE_KEY);
    assert.strictEqual(savedIdb[0].solves.length, 2);
    assert.strictEqual(savedIdb[0].solves[1].uid, 'idb-2');
  } finally {
    resetIndexedDbCache();
    globalThis.localStorage = prevLs;
    globalThis.indexedDB = prevIdb;
  }
});
