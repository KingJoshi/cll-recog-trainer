// Browser persistence bridge for Google Drive cloud sync metadata, timestamps, tombstones, and state export/hydration.

import {
  readStorageJSON,
  writeStorageJSON,
  removeStorageKey,
  readSessionStorageJSON,
  writeSessionStorageJSON,
  hasSessionStorage,
  hasLocalStorage,
  writeStorageRaw
} from '../state/storage.js';
import { STORAGE_KEYS } from '../state/appStore.js';
import { getAllPreferredAlgs, replaceAllPreferredAlgs } from '../data/algRegistry.js';
import { SYNC_SCHEMA_VERSION, canonicalStringify, mergeSyncPayloads } from './syncMerge.js';

export const SYNC_META_KEY = "cll_gdrive_meta";
export const SYNC_CLIENT_ID_KEY = "cll_gdrive_client_id";
export const SYNC_TOKEN_SESSION_KEY = "cll_gdrive_token";
export const SYNC_TIMESTAMPS_KEY = "cll_sync_timestamps";
export const SYNC_TOMBSTONES_KEY = "cll_sync_tombstones";
export const SYNC_BASE_SNAPSHOT_KEY = "cll_sync_base_snapshot";

const SAVED_CUBES_KEY = "cll_saved_smart_cubes";
const DELETED_CUBES_KEY = "cll_deleted_smart_cubes";

function clone(v) {
  return v === undefined ? undefined : JSON.parse(JSON.stringify(v));
}

function emptyTimestamps() {
  return {
    settings: {},
    selectedByTrack: {},
    caseTags: {},
    customCllLabels: {},
    pblSettings: {},
    preferredAlgs: {},
    sessions: {}
  };
}

function emptyTombstones() {
  return {
    sessions: {},
    solves: {},
    caseTags: {},
    customCllLabels: {},
    preferredAlgs: {},
    pblSettings: {},
    deletedSmartCubes: {}
  };
}

export function loadSyncTimestamps() {
  const raw = readStorageJSON(SYNC_TIMESTAMPS_KEY, null);
  const base = emptyTimestamps();
  if (!raw || typeof raw !== "object") return base;
  return {
    settings: raw.settings && typeof raw.settings === "object" ? { ...raw.settings } : {},
    selectedByTrack: raw.selectedByTrack && typeof raw.selectedByTrack === "object" ? { ...raw.selectedByTrack } : {},
    caseTags: raw.caseTags && typeof raw.caseTags === "object" ? { ...raw.caseTags } : {},
    customCllLabels: raw.customCllLabels && typeof raw.customCllLabels === "object" ? { ...raw.customCllLabels } : {},
    pblSettings: raw.pblSettings && typeof raw.pblSettings === "object" ? { ...raw.pblSettings } : {},
    preferredAlgs: raw.preferredAlgs && typeof raw.preferredAlgs === "object" ? { ...raw.preferredAlgs } : {},
    sessions: raw.sessions && typeof raw.sessions === "object" ? { ...raw.sessions } : {}
  };
}

export function saveSyncTimestamps(ts) {
  writeStorageJSON(SYNC_TIMESTAMPS_KEY, ts || emptyTimestamps());
}

export function loadSyncTombstones() {
  const raw = readStorageJSON(SYNC_TOMBSTONES_KEY, null);
  const base = emptyTombstones();
  if (!raw || typeof raw !== "object") return base;
  return {
    sessions: raw.sessions && typeof raw.sessions === "object" ? { ...raw.sessions } : {},
    solves: raw.solves && typeof raw.solves === "object" ? { ...raw.solves } : {},
    caseTags: raw.caseTags && typeof raw.caseTags === "object" ? { ...raw.caseTags } : {},
    customCllLabels: raw.customCllLabels && typeof raw.customCllLabels === "object" ? { ...raw.customCllLabels } : {},
    preferredAlgs: raw.preferredAlgs && typeof raw.preferredAlgs === "object" ? { ...raw.preferredAlgs } : {},
    pblSettings: raw.pblSettings && typeof raw.pblSettings === "object" ? { ...raw.pblSettings } : {},
    deletedSmartCubes: raw.deletedSmartCubes && typeof raw.deletedSmartCubes === "object" ? { ...raw.deletedSmartCubes } : {}
  };
}

export function saveSyncTombstones(tomb) {
  writeStorageJSON(SYNC_TOMBSTONES_KEY, tomb || emptyTombstones());
}

export function recordFieldTimestamps(section, keys, tsMs = Date.now()) {
  if (!section || !Array.isArray(keys) || keys.length === 0) return;
  const timestamps = loadSyncTimestamps();
  if (!timestamps[section]) timestamps[section] = {};
  for (const k of keys) {
    if (k) timestamps[section][k] = tsMs;
  }
  saveSyncTimestamps(timestamps);
}

export function recordTombstones(kind, keys, tsMs = Date.now()) {
  if (!kind || !Array.isArray(keys) || keys.length === 0) return;
  const tomb = loadSyncTombstones();
  if (!tomb[kind]) tomb[kind] = {};
  let changed = false;
  for (const key of keys) {
    if (key) {
      tomb[kind][key] = tsMs;
      changed = true;
    }
  }
  if (changed) saveSyncTombstones(tomb);

  if (["caseTags", "customCllLabels", "preferredAlgs", "pblSettings"].includes(kind)) {
    const timestamps = loadSyncTimestamps();
    let tsChanged = false;
    for (const key of keys) {
      if (timestamps[kind] && timestamps[kind][key] !== undefined) {
        delete timestamps[kind][key];
        tsChanged = true;
      }
    }
    if (tsChanged) saveSyncTimestamps(timestamps);
  }
}

export function recordTombstone(kind, key, tsMs = Date.now()) {
  if (!key) return;
  recordTombstones(kind, [key], tsMs);
}

export function loadSyncBaseSnapshot(accountSub = "") {
  const stored = readStorageJSON(SYNC_BASE_SNAPSHOT_KEY, null);
  if (!stored || typeof stored !== "object") return null;
  if (accountSub && stored.accountSub && stored.accountSub !== accountSub) return null;
  return stored.snapshot || null;
}

export function saveSyncBaseSnapshot(snapshot, accountSub = "") {
  if (!snapshot || typeof snapshot !== "object") return;
  // Store only compact recognition stats for 3-way delta merging so localStorage quota is never exceeded
  writeStorageJSON(SYNC_BASE_SNAPSHOT_KEY, {
    accountSub: accountSub || "",
    savedAt: Date.now(),
    snapshot: {
      stats: clone(snapshot.stats || {})
    }
  });
}

export function loadSyncMeta() {
  const raw = readStorageJSON(SYNC_META_KEY, null);
  if (!raw || typeof raw !== "object") {
    return {
      email: "",
      name: "",
      picture: "",
      sub: "",
      fileId: "",
      lastSyncedAt: 0,
      autoSync: true
    };
  }
  return {
    email: raw.email || "",
    name: raw.name || "",
    picture: raw.picture || "",
    sub: raw.sub || "",
    fileId: raw.fileId || "",
    lastSyncedAt: Number(raw.lastSyncedAt || 0),
    autoSync: raw.autoSync !== false
  };
}

export function saveSyncMeta(meta) {
  writeStorageJSON(SYNC_META_KEY, meta);
}

export function clearSyncMeta() {
  removeStorageKey(SYNC_META_KEY);
}

export function loadSessionToken() {
  return readSessionStorageJSON(SYNC_TOKEN_SESSION_KEY, null)
    || readStorageJSON(SYNC_TOKEN_SESSION_KEY, null);
}

export function saveSessionToken(tokenObj) {
  if (!tokenObj) {
    clearSessionToken();
    return;
  }
  writeSessionStorageJSON(SYNC_TOKEN_SESSION_KEY, tokenObj);
  writeStorageJSON(SYNC_TOKEN_SESSION_KEY, tokenObj);
}

export function clearSessionToken() {
  if (hasSessionStorage()) {
    try {
      sessionStorage.removeItem(SYNC_TOKEN_SESSION_KEY);
    } catch {}
  }
  removeStorageKey(SYNC_TOKEN_SESSION_KEY);
}

export function loadStoredClientId() {
  const raw = readStorageJSON(SYNC_CLIENT_ID_KEY, null);
  if (typeof raw === "string") return raw.trim();
  if (hasLocalStorage()) {
    try {
      const str = localStorage.getItem(SYNC_CLIENT_ID_KEY);
      if (str && !str.startsWith('"')) return str.trim();
    } catch {}
  }
  return "";
}

export function saveStoredClientId(clientId) {
  const clean = String(clientId || "").trim();
  if (!clean) {
    removeStorageKey(SYNC_CLIENT_ID_KEY);
    return;
  }
  writeStorageJSON(SYNC_CLIENT_ID_KEY, clean);
}

function computeMaxUpdatedAt(timestamps, sessions) {
  let maxTs = 0;
  for (const map of Object.values(timestamps || {})) {
    if (!map || typeof map !== "object") continue;
    for (const v of Object.values(map)) {
      const n = Number(v || 0);
      if (n > maxTs) maxTs = n;
    }
  }
  for (const sess of (Array.isArray(sessions) ? sessions : [])) {
    if (Number(sess?.updatedAt || 0) > maxTs) maxTs = Number(sess.updatedAt);
    for (const sv of (Array.isArray(sess?.solves) ? sess.solves : [])) {
      const t = Number(sv?.updatedAt || sv?.at || 0);
      if (t > maxTs) maxTs = t;
    }
  }
  return maxTs;
}

export function exportLocalSyncPayload(appStore) {
  const rawSettings = readStorageJSON(STORAGE_KEYS.SETTINGS, null);
  const hasLocalSettings = Boolean(rawSettings && typeof rawSettings === "object" && Object.keys(rawSettings).length > 0);
  const settings = appStore?.getSettingsPayload ? appStore.getSettingsPayload() : (rawSettings || {});
  const sessions = clone(appStore?.state?.sessions || []);
  const stats = clone(appStore?.state?.stats || {});
  const caseTags = clone(appStore?.state?.caseTags || {});
  const customCllLabels = clone(appStore?.state?.customCllLabels || {});
  const pblSettings = clone(appStore?.state?.pblSettings || {});
  const preferredAlgs = getAllPreferredAlgs();
  const savedSmartCubes = readStorageJSON(SAVED_CUBES_KEY, []) || [];
  const deletedSmartCubes = readStorageJSON(DELETED_CUBES_KEY, []) || [];
  const timestamps = loadSyncTimestamps();
  const tombstones = loadSyncTombstones();

  return {
    schemaVersion: SYNC_SCHEMA_VERSION,
    updatedAt: computeMaxUpdatedAt(timestamps, sessions),
    hasLocalSettings,
    settings,
    sessions,
    stats,
    caseTags,
    customCllLabels,
    pblSettings,
    preferredAlgs,
    savedSmartCubes: Array.isArray(savedSmartCubes) ? savedSmartCubes : [],
    deletedSmartCubes: Array.isArray(deletedSmartCubes) ? deletedSmartCubes : [],
    tombstones,
    timestamps
  };
}

export function applyMergedSyncPayload(appStore, mergedPayload) {
  if (!mergedPayload || typeof mergedPayload !== "object") return;

  if (mergedPayload.timestamps) {
    saveSyncTimestamps(mergedPayload.timestamps);
  }
  if (mergedPayload.tombstones) {
    saveSyncTombstones(mergedPayload.tombstones);
  }
  if (mergedPayload.preferredAlgs && typeof mergedPayload.preferredAlgs === "object") {
    replaceAllPreferredAlgs(mergedPayload.preferredAlgs);
  }

  if (Array.isArray(mergedPayload.savedSmartCubes)) {
    writeStorageJSON(SAVED_CUBES_KEY, mergedPayload.savedSmartCubes);
    for (const c of mergedPayload.savedSmartCubes) {
      if (c?.name && c?.mac) {
        writeStorageRaw(`cll_cube_mac_${c.name}`, c.mac);
      }
    }
  }
  if (Array.isArray(mergedPayload.deletedSmartCubes)) {
    writeStorageJSON(DELETED_CUBES_KEY, mergedPayload.deletedSmartCubes);
    for (const name of mergedPayload.deletedSmartCubes) {
      if (name) removeStorageKey(`cll_cube_mac_${name}`);
    }
  }

  appStore?.hydrateFromSync?.(mergedPayload);
}

const BACKUP_RECOGNIZED_KEYS = [
  "sessions",
  "settings",
  "stats",
  "caseTags",
  "customCllLabels",
  "pblSettings",
  "preferredAlgs",
  "savedSmartCubes"
];

export function parseBackupJson(text) {
  let parsed;
  try {
    parsed = JSON.parse(String(text || ""));
  } catch {
    throw new Error("Invalid JSON file: could not parse backup.");
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Selected file is not a valid Cubing.cc backup.");
  }
  const hasKnownKey = BACKUP_RECOGNIZED_KEYS.some(k => parsed[k] !== undefined);
  if (!hasKnownKey) {
    throw new Error("Selected file does not contain Cubing.cc backup data.");
  }
  return parsed;
}

export function importAndMergeBackup(appStore, backupPayload, { now = Date.now() } = {}) {
  const local = exportLocalSyncPayload(appStore);
  const { merged, summary, localChanged } = mergeSyncPayloads(local, backupPayload, null, now, {
    statsMergeMode: "max"
  });
  if (localChanged) {
    applyMergedSyncPayload(appStore, merged);
  }
  return { merged, summary, localChanged };
}

function seedLegacyTimestampsIfNeeded(appStore) {
  const existing = readStorageJSON(SYNC_TIMESTAMPS_KEY, null);
  if (existing && typeof existing === "object") return;

  const rawSettings = readStorageJSON(STORAGE_KEYS.SETTINGS, null);
  const caseTags = appStore?.state?.caseTags || {};
  const customLabels = appStore?.state?.customCllLabels || {};
  const pblSettings = appStore?.state?.pblSettings || {};
  const preferredAlgs = getAllPreferredAlgs();

  const hasLegacy =
    (rawSettings && typeof rawSettings === "object" && Object.keys(rawSettings).length > 0) ||
    Object.keys(caseTags).length > 0 ||
    Object.keys(customLabels).length > 0 ||
    Object.keys(pblSettings).length > 0 ||
    Object.keys(preferredAlgs).length > 0;

  if (!hasLegacy) return;

  const now = Date.now();
  const seeded = emptyTimestamps();

  if (rawSettings && typeof rawSettings === "object") {
    for (const k of Object.keys(rawSettings)) {
      if (k === "selected" || k === "selectedByTrack") continue;
      seeded.settings[k] = now;
    }
    if (rawSettings.selectedByTrack && typeof rawSettings.selectedByTrack === "object") {
      for (const tk of Object.keys(rawSettings.selectedByTrack)) {
        seeded.selectedByTrack[tk] = now;
      }
    }
  }
  for (const k of Object.keys(caseTags)) seeded.caseTags[k] = now;
  for (const k of Object.keys(customLabels)) seeded.customCllLabels[k] = now;
  for (const k of Object.keys(preferredAlgs)) seeded.preferredAlgs[k] = now;
  for (const [caseId, entry] of Object.entries(pblSettings)) {
    if (!entry || typeof entry !== "object") continue;
    if (entry.selectedAlgId) seeded.pblSettings[`${caseId}.selectedAlgId`] = now;
    if (entry.customLabels && typeof entry.customLabels === "object") {
      for (const algId of Object.keys(entry.customLabels)) {
        seeded.pblSettings[`${caseId}.customLabels.${algId}`] = now;
      }
    }
  }

  saveSyncTimestamps(seeded);
}

export function initSyncTracking(appStore, { onPreferredAlgChange } = {}) {
  if (!appStore) return () => {};

  seedLegacyTimestampsIfNeeded(appStore);

  let prevSettings = clone(appStore.getSettingsPayload());
  let prevCaseTags = clone(appStore.state.caseTags || {});
  let prevCustomLabels = clone(appStore.state.customCllLabels || {});
  let prevPblSettings = clone(appStore.state.pblSettings || {});

  const refreshBaseline = () => {
    prevSettings = clone(appStore.getSettingsPayload());
    prevCaseTags = clone(appStore.state.caseTags || {});
    prevCustomLabels = clone(appStore.state.customCllLabels || {});
    prevPblSettings = clone(appStore.state.pblSettings || {});
  };

  const unsubStore = appStore.subscribe((event, detail) => {
    if (event === "hydrate") {
      refreshBaseline();
      return;
    }
    if (event !== "persist") return;

    const now = Date.now();
    const section = detail?.section;

    if (section === "settings") {
      const nextSettings = detail?.payload || appStore.getSettingsPayload();
      const timestamps = loadSyncTimestamps();
      let changed = false;

      for (const k of new Set([...Object.keys(prevSettings || {}), ...Object.keys(nextSettings || {})])) {
        if (k === "selected" || k === "selectedByTrack") continue;
        if (canonicalStringify(prevSettings?.[k]) !== canonicalStringify(nextSettings?.[k])) {
          timestamps.settings[k] = now;
          changed = true;
        }
      }

      const prevTracks = prevSettings?.selectedByTrack || {};
      const nextTracks = nextSettings?.selectedByTrack || {};
      for (const tk of new Set([...Object.keys(prevTracks), ...Object.keys(nextTracks)])) {
        if (canonicalStringify(prevTracks[tk]) !== canonicalStringify(nextTracks[tk])) {
          timestamps.selectedByTrack[tk] = now;
          changed = true;
        }
      }

      if (changed) saveSyncTimestamps(timestamps);
      prevSettings = clone(nextSettings);
    } else if (section === "caseTags") {
      const nextTags = appStore.state.caseTags || {};
      const timestamps = loadSyncTimestamps();
      const tombstones = loadSyncTombstones();
      let tsChanged = false;
      let tombChanged = false;

      for (const k of new Set([...Object.keys(prevCaseTags), ...Object.keys(nextTags)])) {
        if (nextTags[k] === undefined && prevCaseTags[k] !== undefined) {
          tombstones.caseTags[k] = now;
          delete timestamps.caseTags[k];
          tsChanged = true;
          tombChanged = true;
        } else if (nextTags[k] !== prevCaseTags[k]) {
          timestamps.caseTags[k] = now;
          if (tombstones.caseTags[k] !== undefined) {
            delete tombstones.caseTags[k];
            tombChanged = true;
          }
          tsChanged = true;
        }
      }

      if (tsChanged) saveSyncTimestamps(timestamps);
      if (tombChanged) saveSyncTombstones(tombstones);
      prevCaseTags = clone(nextTags);
    } else if (section === "customLabels") {
      const nextLabels = appStore.state.customCllLabels || {};
      const timestamps = loadSyncTimestamps();
      const tombstones = loadSyncTombstones();
      let tsChanged = false;
      let tombChanged = false;

      for (const k of new Set([...Object.keys(prevCustomLabels), ...Object.keys(nextLabels)])) {
        if (nextLabels[k] === undefined && prevCustomLabels[k] !== undefined) {
          tombstones.customCllLabels[k] = now;
          delete timestamps.customCllLabels[k];
          tsChanged = true;
          tombChanged = true;
        } else if (nextLabels[k] !== prevCustomLabels[k]) {
          timestamps.customCllLabels[k] = now;
          if (tombstones.customCllLabels[k] !== undefined) {
            delete tombstones.customCllLabels[k];
            tombChanged = true;
          }
          tsChanged = true;
        }
      }

      if (tsChanged) saveSyncTimestamps(timestamps);
      if (tombChanged) saveSyncTombstones(tombstones);
      prevCustomLabels = clone(nextLabels);
    } else if (section === "pblSettings") {
      const nextPbl = appStore.state.pblSettings || {};
      const timestamps = loadSyncTimestamps();
      const tombstones = loadSyncTombstones();
      let tsChanged = false;
      let tombChanged = false;

      for (const caseId of new Set([...Object.keys(prevPblSettings), ...Object.keys(nextPbl)])) {
        const prevEntry = prevPblSettings[caseId] || {};
        const nextEntry = nextPbl[caseId] || {};
        const selKey = `${caseId}.selectedAlgId`;

        if (nextEntry.selectedAlgId === undefined && prevEntry.selectedAlgId !== undefined) {
          tombstones.pblSettings[selKey] = now;
          delete timestamps.pblSettings[selKey];
          tsChanged = true;
          tombChanged = true;
        } else if (nextEntry.selectedAlgId !== prevEntry.selectedAlgId) {
          timestamps.pblSettings[selKey] = now;
          if (tombstones.pblSettings[selKey] !== undefined) {
            delete tombstones.pblSettings[selKey];
            tombChanged = true;
          }
          tsChanged = true;
        }

        const prevLabelsMap = prevEntry.customLabels || {};
        const nextLabelsMap = nextEntry.customLabels || {};
        for (const algId of new Set([...Object.keys(prevLabelsMap), ...Object.keys(nextLabelsMap)])) {
          const lKey = `${caseId}.customLabels.${algId}`;
          if (nextLabelsMap[algId] === undefined && prevLabelsMap[algId] !== undefined) {
            tombstones.pblSettings[lKey] = now;
            delete timestamps.pblSettings[lKey];
            tsChanged = true;
            tombChanged = true;
          } else if (nextLabelsMap[algId] !== prevLabelsMap[algId]) {
            timestamps.pblSettings[lKey] = now;
            if (tombstones.pblSettings[lKey] !== undefined) {
              delete tombstones.pblSettings[lKey];
              tombChanged = true;
            }
            tsChanged = true;
          }
        }
      }

      if (tsChanged) saveSyncTimestamps(timestamps);
      if (tombChanged) saveSyncTombstones(tombstones);
      prevPblSettings = clone(nextPbl);
    }
  });

  const unsubPref = typeof onPreferredAlgChange === "function"
    ? onPreferredAlgChange(({ key }) => {
        if (!key) return;
        const now = Date.now();
        const timestamps = loadSyncTimestamps();
        const tombstones = loadSyncTombstones();
        timestamps.preferredAlgs[key] = now;
        saveSyncTimestamps(timestamps);
        if (tombstones.preferredAlgs[key] !== undefined) {
          delete tombstones.preferredAlgs[key];
          saveSyncTombstones(tombstones);
        }
      })
    : () => {};

  return () => {
    unsubStore?.();
    unsubPref?.();
  };
}
