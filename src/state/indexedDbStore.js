// Lightweight IndexedDB key-value persistence & StorageManager helpers.
// Guards non-browser / Node / SSR / restricted environments gracefully.

import { hasLocalStorage, listStorageKeys, readStorageRaw } from './storage.js';

export const IDB_NAME = "cubing_cc_db";
export const IDB_VERSION = 1;
export const IDB_STORE_NAME = "kv";

let dbPromise = null;

export function isIndexedDbAvailable() {
  return typeof indexedDB !== "undefined" && indexedDB !== null;
}

export function resetIndexedDbCache() {
  dbPromise = null;
}

export function openDb() {
  if (!isIndexedDbAvailable()) {
    return Promise.reject(new Error("IndexedDB is not available"));
  }
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    try {
      const req = indexedDB.open(IDB_NAME, IDB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(IDB_STORE_NAME)) {
          db.createObjectStore(IDB_STORE_NAME);
        }
      };
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => {
          try { db.close(); } catch {}
          dbPromise = null;
        };
        db.onclose = () => {
          dbPromise = null;
        };
        resolve(db);
      };
      req.onerror = () => {
        dbPromise = null;
        reject(req.error || new Error("Failed to open IndexedDB"));
      };
      req.onblocked = () => {
        dbPromise = null;
        reject(new Error("IndexedDB open blocked"));
      };
    } catch (err) {
      dbPromise = null;
      reject(err);
    }
  });

  return dbPromise;
}

export async function idbGet(key) {
  if (!isIndexedDbAvailable()) return undefined;
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      try {
        const tx = db.transaction(IDB_STORE_NAME, "readonly");
        const store = tx.objectStore(IDB_STORE_NAME);
        const req = store.get(key);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(undefined);
        tx.onabort = () => resolve(undefined);
      } catch {
        resolve(undefined);
      }
    });
  } catch {
    return undefined;
  }
}

export async function idbSet(key, value) {
  if (!isIndexedDbAvailable()) return false;
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      let settled = false;
      const done = (ok) => {
        if (!settled) {
          settled = true;
          resolve(ok);
        }
      };
      try {
        const tx = db.transaction(IDB_STORE_NAME, "readwrite");
        tx.oncomplete = () => done(true);
        tx.onerror = () => done(false);
        tx.onabort = () => done(false);
        const store = tx.objectStore(IDB_STORE_NAME);
        const req = store.put(value, key);
        req.onerror = () => done(false);
      } catch {
        done(false);
      }
    });
  } catch {
    return false;
  }
}

export async function idbDelete(key) {
  if (!isIndexedDbAvailable()) return false;
  try {
    const db = await openDb();
    return await new Promise((resolve) => {
      let settled = false;
      const done = (ok) => {
        if (!settled) {
          settled = true;
          resolve(ok);
        }
      };
      try {
        const tx = db.transaction(IDB_STORE_NAME, "readwrite");
        tx.oncomplete = () => done(true);
        tx.onerror = () => done(false);
        tx.onabort = () => done(false);
        const store = tx.objectStore(IDB_STORE_NAME);
        const req = store.delete(key);
        req.onerror = () => done(false);
      } catch {
        done(false);
      }
    });
  } catch {
    return false;
  }
}

export async function requestPersistentStorage() {
  if (typeof navigator === "undefined" || !navigator.storage?.persist) {
    return false;
  }
  try {
    return Boolean(await navigator.storage.persist());
  } catch {
    return false;
  }
}

export function estimateLocalStorageBytes() {
  if (!hasLocalStorage()) return 0;
  let total = 0;
  for (const key of listStorageKeys()) {
    const val = readStorageRaw(key);
    total += (key.length + (val ? val.length : 0)) * 2;
  }
  return total;
}

export async function getStorageEstimate() {
  const localStorageBytes = estimateLocalStorageBytes();
  const hasStorageApi = typeof navigator !== "undefined" && Boolean(navigator.storage);
  let usage = 0;
  let quota = 0;
  let persisted = false;
  let supported = false;

  if (hasStorageApi && typeof navigator.storage.estimate === "function") {
    try {
      const est = await navigator.storage.estimate();
      if (est && typeof est === "object") {
        usage = Number.isFinite(est.usage) ? est.usage : 0;
        quota = Number.isFinite(est.quota) ? est.quota : 0;
        supported = true;
      }
    } catch {}
  }

  if (hasStorageApi && typeof navigator.storage.persisted === "function") {
    try {
      persisted = Boolean(await navigator.storage.persisted());
    } catch {}
  }

  return {
    supported,
    usage,
    quota,
    persisted,
    localStorageBytes
  };
}

export function formatBytes(bytes) {
  const n = Number(bytes);
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let val = n;
  let idx = 0;
  while (val >= 1024 && idx < units.length - 1) {
    val /= 1024;
    idx++;
  }
  return idx === 0 ? `${Math.round(val)} B` : `${val.toFixed(val >= 100 ? 0 : 1)} ${units[idx]}`;
}
