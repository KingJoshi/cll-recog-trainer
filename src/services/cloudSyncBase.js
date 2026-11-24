// Shared HTTP error, browser lifecycle hooks, and merge-reconciliation helpers for cloud sync services

import { SYNC_SCHEMA_VERSION, mergeSyncPayloads } from './syncMerge.js';
import {
  loadSyncBaseSnapshot,
  saveSyncBaseSnapshot,
  exportLocalSyncPayload,
  applyMergedSyncPayload
} from './syncStorage.js';

export class HttpStatusError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function countTotalSolves(payload) {
  let count = 0;
  for (const sess of (payload?.sessions || [])) {
    count += Array.isArray(sess?.solves) ? sess.solves.length : 0;
  }
  return count;
}

/**
 * Attach online, foreground pull (focus/visibility), and background flush listeners
 * to a cloud sync service instance, returning a cleanup function for `destroy()`.
 */
export function attachCloudSyncLifecycle(service, { visibilityPullCooldownMs = 5000 } = {}) {
  if (typeof window === "undefined") {
    return () => {};
  }

  const triggerForegroundPull = (reason = "visibility") => {
    if (!service.isSignedIn() || service.meta?.autoSync === false) return;
    const now = service.nowFn();
    if (now - service.lastVisibilityPullAt < visibilityPullCooldownMs) return;
    service.lastVisibilityPullAt = now;
    void service.syncNow({ reason, interactive: false });
  };

  const flushPendingSync = () => {
    if (!service.isSignedIn() || service.meta?.autoSync === false) return;
    if (!service.pendingChanges && !service.autoSyncTimer) return;
    clearTimeout(service.autoSyncTimer);
    service.autoSyncTimer = 0;
    void service.syncNow({ reason: "hide", interactive: false });
  };

  const onOnline = () => {
    if (!service.isSignedIn()) return;
    if (service.pendingChanges || service.meta?.autoSync !== false) {
      void service.syncNow({ reason: "online", interactive: false });
    }
  };

  const onVisibilityChange = () => {
    if (typeof document === "undefined") return;
    if (document.visibilityState === "hidden") {
      flushPendingSync();
      return;
    }
    if (document.visibilityState === "visible") {
      triggerForegroundPull("visibility");
    }
  };

  const onFocus = () => {
    triggerForegroundPull("focus");
  };

  const onPageHide = () => {
    flushPendingSync();
  };

  window.addEventListener("online", onOnline);
  window.addEventListener("focus", onFocus);
  window.addEventListener("pagehide", onPageHide);
  if (typeof document !== "undefined") {
    document.addEventListener("visibilitychange", onVisibilityChange);
  }

  return () => {
    clearTimeout(service.autoSyncTimer);
    if (typeof window !== "undefined") {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("pagehide", onPageHide);
    }
    if (typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", onVisibilityChange);
    }
  };
}

/**
 * Reconcile local trainer state with an optional downloaded remote payload using 3-way merge,
 * applying remote updates locally, pushing merged data remotely, and persisting the base snapshot.
 */
export async function reconcileRemoteSyncPayload({
  appStore,
  accountKey,
  remotePayload,
  now,
  reason = "manual",
  onDataHydrated = null,
  onUpdateRemote,
  onCreateRemote
}) {
  const localPayload = exportLocalSyncPayload(appStore);
  const baseSnapshot = loadSyncBaseSnapshot(accountKey);

  let merged;
  let summary;
  let localChanged = false;
  let remoteChanged = false;
  let remoteMeta = null;

  if (remotePayload && typeof remotePayload === "object") {
    const mergeResult = mergeSyncPayloads(localPayload, remotePayload, baseSnapshot, now);
    merged = mergeResult.merged;
    summary = mergeResult.summary;
    localChanged = mergeResult.localChanged;
    remoteChanged = mergeResult.remoteChanged;

    if (localChanged) {
      applyMergedSyncPayload(appStore, merged);
      onDataHydrated?.(summary, merged, reason);
    }
    if (remoteChanged) {
      remoteMeta = await onUpdateRemote(merged);
    }
  } else {
    merged = {
      ...localPayload,
      schemaVersion: SYNC_SCHEMA_VERSION,
      hasLocalSettings: true
    };
    remoteMeta = await onCreateRemote(merged);
    localChanged = false;
    remoteChanged = true;
    summary = {
      addedSolves: 0,
      uploadedSolves: countTotalSolves(merged),
      addedSessions: 0,
      updatedSettings: 0,
      mergedStatsCases: 0,
      mergedTags: 0,
      mergedLabels: 0,
      mergedPreferredAlgs: 0
    };
  }

  saveSyncBaseSnapshot(merged, accountKey);

  return {
    ok: true,
    localChanged,
    remoteChanged,
    summary,
    remoteMeta,
    lastSyncedAt: now
  };
}
