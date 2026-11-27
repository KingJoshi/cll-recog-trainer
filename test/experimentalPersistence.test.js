import test from 'node:test';
import assert from 'node:assert/strict';
import { AppStore, STORAGE_KEYS } from '../src/state/appStore.js';

test('experimental features persist via dedicated key even when the large settings blob cannot be written', () => {
  const store = {};
  const prev = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => {
      if (k === STORAGE_KEYS.SETTINGS) throw new Error('QuotaExceededError');
      store[k] = String(v);
    },
    removeItem: k => { delete store[k]; },
    key: i => Object.keys(store)[i] ?? null,
    get length() { return Object.keys(store).length; }
  };
  try {
    const a = new AppStore();
    const errors = [];
    a.subscribe(evt => { if (evt === 'storageError') errors.push(evt); });
    a.setExperimentalFeature('coll', true);
    a.setExperimentalFeature('cmll', true);
    assert.ok(errors.length >= 1, 'storage failure must be surfaced');

    const b = new AppStore();
    assert.strictEqual(b.isExperimentalEnabled('coll'), true);
    assert.strictEqual(b.isExperimentalEnabled('cmll'), true);
    assert.strictEqual(b.isExperimentalEnabled('wv'), false);
  } finally {
    globalThis.localStorage = prev;
  }
});
