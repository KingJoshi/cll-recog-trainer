// Google Account OAuth (GIS) & Google Drive appDataFolder Cloud Sync Service

import {
  SYNC_SCHEMA_VERSION,
  mergeSyncPayloads
} from './syncMerge.js';
import {
  loadSyncMeta,
  saveSyncMeta,
  clearSyncMeta,
  loadSessionToken,
  saveSessionToken,
  clearSessionToken,
  loadStoredClientId,
  saveStoredClientId,
  loadSyncBaseSnapshot,
  saveSyncBaseSnapshot,
  exportLocalSyncPayload,
  applyMergedSyncPayload
} from './syncStorage.js';

export const DRIVE_SYNC_FILENAME = "speedcube-trainer-sync.json";
export const GOOGLE_SCOPES = "https://www.googleapis.com/auth/drive.appdata openid email profile";
export const GIS_SCRIPT_SRC = "https://accounts.google.com/gsi/client";
export const DRIVE_FILES_URL = "https://www.googleapis.com/drive/v3/files";
export const DRIVE_UPLOAD_URL = "https://www.googleapis.com/upload/drive/v3/files";
export const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";
export const GOOGLE_REVOKE_URL = "https://oauth2.googleapis.com/revoke";
export const AUTO_SYNC_DEBOUNCE_MS = 3000;
export const VISIBILITY_PULL_COOLDOWN_MS = 60000;

let gisLoadPromise = null;

export function getEnvGoogleClientId() {
  try {
    if (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_GOOGLE_CLIENT_ID) {
      return String(import.meta.env.VITE_GOOGLE_CLIENT_ID).trim();
    }
  } catch {}
  return "";
}

export function defaultLoadGisScript() {
  if (typeof window === "undefined" || typeof document === "undefined") {
    return Promise.reject(new Error("Google Sign-In is only available in a browser environment."));
  }
  if (window.google?.accounts?.oauth2?.initTokenClient) {
    return Promise.resolve(window.google);
  }
  if (gisLoadPromise) return gisLoadPromise;

  gisLoadPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-gis-client="true"]');
    if (existing) {
      if (window.google?.accounts?.oauth2?.initTokenClient) {
        resolve(window.google);
        return;
      }
      existing.addEventListener("load", () => {
        if (window.google?.accounts?.oauth2?.initTokenClient) resolve(window.google);
        else {
          gisLoadPromise = null;
          reject(new Error("Google Sign-In script loaded without OAuth2 client."));
        }
      }, { once: true });
      existing.addEventListener("error", () => {
        gisLoadPromise = null;
        reject(new Error("Failed to load Google Sign-In script. Check your network connection."));
      }, { once: true });
      return;
    }

    const script = document.createElement("script");
    script.src = GIS_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.dataset.gisClient = "true";

    const timeout = setTimeout(() => {
      gisLoadPromise = null;
      reject(new Error("Timed out loading Google Sign-In. Check your internet connection."));
    }, 15000);

    script.onload = () => {
      clearTimeout(timeout);
      if (window.google?.accounts?.oauth2?.initTokenClient) {
        resolve(window.google);
      } else {
        gisLoadPromise = null;
        reject(new Error("Google Identity Services did not initialize properly."));
      }
    };
    script.onerror = () => {
      clearTimeout(timeout);
      gisLoadPromise = null;
      reject(new Error("Could not load Google Sign-In (you may be offline or blocked by a content blocker)."));
    };

    document.head.appendChild(script);
  });

  return gisLoadPromise;
}

class HttpStatusError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function buildMultipartBody(metadata, dataObj) {
  const boundary = `sync_${Math.random().toString(36).slice(2)}_${Date.now()}`;
  const metadataJson = JSON.stringify(metadata);
  const dataJson = JSON.stringify(dataObj);
  const body =
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${metadataJson}\r\n` +
    `--${boundary}\r\n` +
    `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
    `${dataJson}\r\n` +
    `--${boundary}--`;
  return {
    contentType: `multipart/related; boundary=${boundary}`,
    body
  };
}

function countTotalSolves(payload) {
  let count = 0;
  for (const sess of (payload?.sessions || [])) {
    count += Array.isArray(sess?.solves) ? sess.solves.length : 0;
  }
  return count;
}

export class GoogleDriveSyncService {
  constructor({
    appStore,
    fetchImpl = (...args) => fetch(...args),
    loadGis = defaultLoadGisScript,
    getClientId = null,
    onDataHydrated = null,
    nowFn = () => Date.now(),
    autoAttachBrowserListeners = true
  } = {}) {
    this.appStore = appStore;
    this.fetchImpl = fetchImpl;
    this.loadGis = loadGis;
    this.customGetClientId = getClientId;
    this.onDataHydrated = onDataHydrated;
    this.nowFn = nowFn;

    this.listeners = new Set();
    this.meta = loadSyncMeta();
    this.token = loadSessionToken();
    this.lastSummary = null;
    this.lastError = "";
    this.pendingChanges = false;
    this.syncing = false;
    this.pendingSyncAfterCurrent = false;
    this.autoSyncTimer = 0;
    this.lastVisibilityPullAt = 0;
    this.tokenClient = null;
    this.tokenClientId = "";

    this.status = this._computeInitialStatus();

    if (autoAttachBrowserListeners && typeof window !== "undefined") {
      this._onOnline = () => {
        if (!this.isSignedIn()) return;
        if (this.pendingChanges || this.meta.autoSync !== false) {
          void this.syncNow({ reason: "online", interactive: false });
        }
      };
      this._onVisibilityChange = () => {
        if (typeof document === "undefined" || document.visibilityState !== "visible") return;
        if (!this.isSignedIn() || this.meta.autoSync === false) return;
        const now = this.nowFn();
        if (now - this.lastVisibilityPullAt < VISIBILITY_PULL_COOLDOWN_MS) return;
        this.lastVisibilityPullAt = now;
        void this.syncNow({ reason: "visibility", interactive: false });
      };
      window.addEventListener("online", this._onOnline);
      if (typeof document !== "undefined") {
        document.addEventListener("visibilitychange", this._onVisibilityChange);
      }
    }
  }

  _computeInitialStatus() {
    if (!this.meta?.email) return "signed_out";
    if (this._hasValidToken()) {
      return this.meta.lastSyncedAt > 0 ? "synced" : "idle";
    }
    return "needs_reauth";
  }

  _hasValidToken() {
    return Boolean(
      this.token?.accessToken &&
      Number(this.token?.expiresAt || 0) > this.nowFn() + 60000
    );
  }

  getEffectiveClientId() {
    if (typeof this.customGetClientId === "function") {
      return String(this.customGetClientId() || "").trim();
    }
    return loadStoredClientId() || getEnvGoogleClientId();
  }

  setCustomClientId(clientId) {
    saveStoredClientId(clientId);
    this.tokenClient = null;
    this.tokenClientId = "";
    this.emit();
  }

  isSignedIn() {
    return Boolean(this.meta?.email);
  }

  getState() {
    const storedClientId = loadStoredClientId();
    const envClientId = getEnvGoogleClientId();
    return {
      status: this.status,
      signedIn: this.isSignedIn(),
      hasToken: this._hasValidToken(),
      account: this.meta?.email
        ? {
            email: this.meta.email,
            name: this.meta.name || this.meta.email,
            picture: this.meta.picture || "",
            sub: this.meta.sub || ""
          }
        : null,
      fileId: this.meta?.fileId || "",
      lastSyncedAt: Number(this.meta?.lastSyncedAt || 0),
      autoSync: this.meta?.autoSync !== false,
      pendingChanges: this.pendingChanges,
      clientId: this.getEffectiveClientId(),
      storedClientId,
      hasEnvClientId: Boolean(envClientId),
      lastSummary: this.lastSummary,
      lastError: this.lastError
    };
  }

  subscribe(listener) {
    if (typeof listener === "function") this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  emit() {
    const snapshot = this.getState();
    for (const cb of this.listeners) {
      try { cb(snapshot); } catch {}
    }
  }

  async _requestAccessToken({ interactive = false, loginHint = "", promptOverride = null } = {}) {
    const clientId = this.getEffectiveClientId();
    if (!clientId) {
      const err = new Error("Google OAuth Client ID is not configured.");
      err.code = "NO_CLIENT_ID";
      throw err;
    }

    const google = await this.loadGis();
    const oauth2 = google?.accounts?.oauth2;
    if (!oauth2?.initTokenClient) {
      throw new Error("Google OAuth2 token client is unavailable.");
    }

    return new Promise((resolve, reject) => {
      let settled = false;
      const finishResolve = (tok) => {
        if (settled) return;
        settled = true;
        resolve(tok);
      };
      const finishReject = (err) => {
        if (settled) return;
        settled = true;
        reject(err);
      };

      const handleCallback = (response) => {
        if (!response || response.error) {
          const code = response?.error || "oauth_error";
          const msg = response?.error_description || `Google authentication failed (${code}).`;
          const err = new Error(msg);
          err.code = code;
          if (["login_required", "consent_required", "interaction_required"].includes(code)) {
            err.needsReauth = true;
          }
          finishReject(err);
          return;
        }
        const expiresInSec = Number(response.expires_in || 3600);
        const tokenObj = {
          accessToken: response.access_token,
          expiresAt: this.nowFn() + expiresInSec * 1000,
          scope: response.scope || GOOGLE_SCOPES
        };
        this.token = tokenObj;
        saveSessionToken(tokenObj);
        finishResolve(tokenObj);
      };

      const handleErrorCallback = (errObj) => {
        const type = errObj?.type || "popup_error";
        const err = new Error(
          type === "popup_closed"
            ? "Google sign-in popup was closed before completing."
            : type === "popup_failed_to_open"
              ? "Popup was blocked by your browser. Please allow popups for this site."
              : `Google sign-in error (${type}).`
        );
        err.code = type;
        if (!interactive) err.needsReauth = true;
        finishReject(err);
      };

      // Re-create or reconfigure token client with fresh callbacks
      if (!this.tokenClient || this.tokenClientId !== clientId) {
        this.tokenClient = oauth2.initTokenClient({
          client_id: clientId,
          scope: GOOGLE_SCOPES,
          callback: handleCallback,
          error_callback: handleErrorCallback
        });
        this.tokenClientId = clientId;
      } else {
        this.tokenClient.callback = handleCallback;
        this.tokenClient.error_callback = handleErrorCallback;
      }

      const prompt = promptOverride !== null
        ? promptOverride
        : (interactive ? (loginHint ? "" : "select_account") : "none");

      const reqOpts = { prompt };
      if (loginHint) reqOpts.login_hint = loginHint;

      try {
        this.tokenClient.requestAccessToken(reqOpts);
      } catch (e) {
        finishReject(e);
      }
    });
  }

  async _fetchUserProfile(accessToken) {
    const res = await this.fetchImpl(GOOGLE_USERINFO_URL, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!res.ok) {
      throw new HttpStatusError(res.status, `Failed to load Google profile (HTTP ${res.status}).`);
    }
    const data = await res.json();
    return {
      email: data.email || "",
      name: data.name || data.email || "",
      picture: data.picture || "",
      sub: data.sub || ""
    };
  }

  async signIn({ interactive = true } = {}) {
    this.lastError = "";
    const prevMeta = { ...this.meta };
    let profile;
    try {
      const tokenObj = await this._requestAccessToken({
        interactive,
        loginHint: prevMeta.email || "",
        promptOverride: interactive ? "select_account" : "none"
      });
      profile = await this._fetchUserProfile(tokenObj.accessToken);
    } catch (err) {
      this.lastError = err?.message || "Google sign-in failed.";
      this.status = this.isSignedIn() ? "needs_reauth" : "signed_out";
      this.emit();
      throw err;
    }

    const sameAccount = Boolean(
      (prevMeta.sub && profile.sub && prevMeta.sub === profile.sub) ||
      (prevMeta.email && profile.email && prevMeta.email === profile.email)
    );

    this.meta = {
      email: profile.email,
      name: profile.name,
      picture: profile.picture,
      sub: profile.sub,
      fileId: sameAccount ? (prevMeta.fileId || "") : "",
      lastSyncedAt: sameAccount ? Number(prevMeta.lastSyncedAt || 0) : 0,
      autoSync: prevMeta.autoSync !== false
    };
    saveSyncMeta(this.meta);
    this.status = "idle";
    this.emit();

    const syncResult = await this.syncNow({ reason: "signin", interactive: false });
    return {
      account: this.getState().account,
      syncResult
    };
  }

  async signOut() {
    clearTimeout(this.autoSyncTimer);
    this.autoSyncTimer = 0;
    const activeToken = this.token?.accessToken;
    this.token = null;
    clearSessionToken();
    clearSyncMeta();
    this.meta = loadSyncMeta();
    this.status = "signed_out";
    this.lastError = "";
    this.lastSummary = null;
    this.pendingChanges = false;
    this.emit();

    if (activeToken) {
      try {
        await this.fetchImpl(`${GOOGLE_REVOKE_URL}?token=${encodeURIComponent(activeToken)}`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" }
        });
      } catch {
        // Non-fatal if offline during sign-out
      }
    }
  }

  setAutoSync(enabled) {
    this.meta = { ...this.meta, autoSync: Boolean(enabled) };
    if (this.isSignedIn()) {
      saveSyncMeta(this.meta);
    }
    this.emit();
    if (this.meta.autoSync && this.pendingChanges && this.isSignedIn()) {
      this.scheduleAutoSync();
    }
  }

  scheduleAutoSync() {
    if (!this.isSignedIn() || this.meta.autoSync === false) return;
    this.pendingChanges = true;
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      this.status = "offline";
      this.emit();
      return;
    }
    clearTimeout(this.autoSyncTimer);
    this.autoSyncTimer = setTimeout(() => {
      this.autoSyncTimer = 0;
      void this.syncNow({ reason: "auto", interactive: false });
    }, AUTO_SYNC_DEBOUNCE_MS);
    this.emit();
  }

  async _driveFetch(url, accessToken, options = {}) {
    const headers = {
      ...(options.headers || {}),
      Authorization: `Bearer ${accessToken}`
    };
    const res = await this.fetchImpl(url, { ...options, headers });
    if (!res.ok) {
      let detail = "";
      try {
        const text = await res.text();
        if (text) detail = text.slice(0, 200);
      } catch {}
      throw new HttpStatusError(res.status, `Google Drive error (${res.status})${detail ? `: ${detail}` : ""}`);
    }
    return res;
  }

  async _findDriveSyncFile(accessToken) {
    const query = `name='${DRIVE_SYNC_FILENAME}' and trashed=false`;
    const url = `${DRIVE_FILES_URL}?spaces=appDataFolder&fields=${encodeURIComponent("files(id,name,modifiedTime)")}&orderBy=${encodeURIComponent("modifiedTime desc")}&q=${encodeURIComponent(query)}`;
    const res = await this._driveFetch(url, accessToken, { method: "GET" });
    const json = await res.json();
    const files = Array.isArray(json?.files) ? json.files : [];
    return files[0] || null;
  }

  async _downloadDriveFile(fileId, accessToken) {
    const url = `${DRIVE_FILES_URL}/${encodeURIComponent(fileId)}?alt=media`;
    const res = await this._driveFetch(url, accessToken, { method: "GET" });
    const text = await res.text();
    if (!text || !text.trim()) return null;
    try {
      return JSON.parse(text);
    } catch {
      throw new Error("Remote Drive sync file contains invalid JSON.");
    }
  }

  async _createDriveFile(payload, accessToken) {
    const { contentType, body } = buildMultipartBody(
      {
        name: DRIVE_SYNC_FILENAME,
        parents: ["appDataFolder"],
        mimeType: "application/json"
      },
      payload
    );
    const url = `${DRIVE_UPLOAD_URL}?uploadType=multipart&fields=${encodeURIComponent("id,modifiedTime")}`;
    const res = await this._driveFetch(url, accessToken, {
      method: "POST",
      headers: { "Content-Type": contentType },
      body
    });
    return res.json();
  }

  async _updateDriveFile(fileId, payload, accessToken) {
    const url = `${DRIVE_UPLOAD_URL}/${encodeURIComponent(fileId)}?uploadType=media&fields=${encodeURIComponent("id,modifiedTime")}`;
    const res = await this._driveFetch(url, accessToken, {
      method: "PATCH",
      headers: { "Content-Type": "application/json; charset=UTF-8" },
      body: JSON.stringify(payload)
    });
    return res.json();
  }

  async _performDriveSync(accessToken, reason = "manual") {
    let remoteFile = await this._findDriveSyncFile(accessToken);
    let remotePayload = null;

    if (remoteFile?.id) {
      try {
        remotePayload = await this._downloadDriveFile(remoteFile.id, accessToken);
      } catch (err) {
        if (err instanceof HttpStatusError && err.status === 404) {
          remoteFile = null;
          remotePayload = null;
        } else {
          throw err;
        }
      }
    }

    const localPayload = exportLocalSyncPayload(this.appStore);
    const accountKey = this.meta?.sub || this.meta?.email || "";
    const baseSnapshot = loadSyncBaseSnapshot(accountKey);

    let merged;
    let summary;
    let localChanged = false;
    let remoteChanged = false;
    let fileId = remoteFile?.id || "";

    if (remotePayload && typeof remotePayload === "object") {
      const mergeResult = mergeSyncPayloads(localPayload, remotePayload, baseSnapshot, this.nowFn());
      merged = mergeResult.merged;
      summary = mergeResult.summary;
      localChanged = mergeResult.localChanged;
      remoteChanged = mergeResult.remoteChanged;

      if (localChanged) {
        applyMergedSyncPayload(this.appStore, merged);
        this.onDataHydrated?.(summary, merged, reason);
      }
      if (remoteChanged) {
        try {
          const updated = await this._updateDriveFile(fileId, merged, accessToken);
          fileId = updated?.id || fileId;
        } catch (err) {
          if (err instanceof HttpStatusError && err.status === 404) {
            const created = await this._createDriveFile(merged, accessToken);
            fileId = created?.id || "";
          } else {
            throw err;
          }
        }
      }
    } else {
      merged = {
        ...localPayload,
        schemaVersion: SYNC_SCHEMA_VERSION,
        hasLocalSettings: true
      };
      const created = await this._createDriveFile(merged, accessToken);
      fileId = created?.id || "";
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
    const syncedAt = this.nowFn();
    this.meta = {
      ...this.meta,
      fileId,
      lastSyncedAt: syncedAt
    };
    saveSyncMeta(this.meta);

    return {
      ok: true,
      localChanged,
      remoteChanged,
      summary,
      fileId,
      lastSyncedAt: syncedAt
    };
  }

  async syncNow({ reason = "manual", interactive = false } = {}) {
    if (!this.isSignedIn()) {
      if (!interactive) {
        this.status = "signed_out";
        this.emit();
        return { signedOut: true };
      }
      return this.signIn({ interactive: true });
    }

    if (this.syncing) {
      this.pendingSyncAfterCurrent = true;
      return { skipped: true, reason: "already_syncing" };
    }

    const clientId = this.getEffectiveClientId();
    if (!clientId) {
      this.status = "error";
      this.lastError = "Google OAuth Client ID is not configured.";
      this.emit();
      return { ok: false, error: this.lastError };
    }

    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      this.status = "offline";
      this.lastError = "Offline — changes saved locally and will sync when back online.";
      this.emit();
      return { ok: false, offline: true };
    }

    clearTimeout(this.autoSyncTimer);
    this.autoSyncTimer = 0;

    this.syncing = true;
    this.pendingSyncAfterCurrent = false;
    this.status = "syncing";
    this.lastError = "";
    this.emit();

    let result;
    try {
      let tokenObj = this._hasValidToken() ? this.token : null;
      if (!tokenObj) {
        try {
          tokenObj = await this._requestAccessToken({
            interactive,
            loginHint: this.meta.email || "",
            promptOverride: interactive ? "" : "none"
          });
        } catch (authErr) {
          if (!interactive && (authErr?.needsReauth || authErr?.code === "popup_closed")) {
            this.status = "needs_reauth";
            this.lastError = "";
            this.emit();
            return { ok: false, needsReauth: true };
          }
          throw authErr;
        }
      }

      try {
        result = await this._performDriveSync(tokenObj.accessToken, reason);
      } catch (err) {
        if (err instanceof HttpStatusError && err.status === 401) {
          this.token = null;
          clearSessionToken();
          try {
            const refreshed = await this._requestAccessToken({
              interactive,
              loginHint: this.meta.email || "",
              promptOverride: interactive ? "" : "none"
            });
            result = await this._performDriveSync(refreshed.accessToken, reason);
          } catch (reauthErr) {
            if (!interactive && reauthErr?.needsReauth) {
              this.status = "needs_reauth";
              this.lastError = "";
              this.emit();
              return { ok: false, needsReauth: true };
            }
            throw reauthErr;
          }
        } else {
          throw err;
        }
      }

      this.pendingChanges = false;
      this.lastSummary = result.summary;
      this.status = "synced";
      this.lastError = "";
      this.emit();
      return result;
    } catch (err) {
      const msg = err?.message || "Sync failed.";
      this.status = "error";
      this.lastError = msg;
      this.emit();
      return { ok: false, error: msg };
    } finally {
      this.syncing = false;
      if (this.pendingSyncAfterCurrent && this.isSignedIn() && this.status === "synced") {
        this.pendingSyncAfterCurrent = false;
        this.scheduleAutoSync();
      } else {
        this.pendingSyncAfterCurrent = false;
      }
    }
  }

  destroy() {
    clearTimeout(this.autoSyncTimer);
    if (typeof window !== "undefined" && this._onOnline) {
      window.removeEventListener("online", this._onOnline);
    }
    if (typeof document !== "undefined" && this._onVisibilityChange) {
      document.removeEventListener("visibilitychange", this._onVisibilityChange);
    }
  }
}
