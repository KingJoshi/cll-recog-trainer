// Microsoft Account OAuth 2.0 (PKCE) & OneDrive AppFolder Cloud Sync Service

import {
  loadOneDriveSyncMeta,
  saveOneDriveSyncMeta,
  clearOneDriveSyncMeta,
  loadOneDriveSessionToken,
  saveOneDriveSessionToken,
  clearOneDriveSessionToken,
  loadStoredOneDriveClientId,
  saveStoredOneDriveClientId
} from './syncStorage.js';
import {
  HttpStatusError,
  attachCloudSyncLifecycle,
  reconcileRemoteSyncPayload
} from './cloudSyncBase.js';

export const ONEDRIVE_SYNC_FILENAME = "speedcube-trainer-sync.json";
export const MICROSOFT_SCOPES = "openid profile email offline_access User.Read Files.ReadWrite.AppFolder";
export const MICROSOFT_AUTHORIZE_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
export const MICROSOFT_TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/v2.0/token";
export const GRAPH_ME_URL = "https://graph.microsoft.com/v1.0/me?$select=id,displayName,mail,userPrincipalName";
export const GRAPH_APPROOT_CONTENT_URL =
  `https://graph.microsoft.com/v1.0/me/drive/special/approot:/${ONEDRIVE_SYNC_FILENAME}:/content`;
export const MS_OAUTH_CALLBACK_TYPE = "cubing-ms-oauth-callback";
export const AUTO_SYNC_DEBOUNCE_MS = 1200;
export const VISIBILITY_PULL_COOLDOWN_MS = 5000;

export function getEnvMicrosoftClientId() {
  try {
    if (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_MICROSOFT_CLIENT_ID) {
      return String(import.meta.env.VITE_MICROSOFT_CLIENT_ID).trim();
    }
  } catch {}
  return "";
}

export function getOneDriveRedirectUri(win = globalThis.window) {
  const origin = win?.location?.origin || "http://localhost:5173";
  return `${String(origin).replace(/\/+$/, "")}/auth/microsoft/`;
}

export function base64UrlEncode(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  let base64;
  if (typeof btoa === "function") {
    let bin = "";
    for (let i = 0; i < bytes.length; i++) {
      bin += String.fromCharCode(bytes[i]);
    }
    base64 = btoa(bin);
  } else {
    base64 = Buffer.from(bytes).toString("base64");
  }
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function getCryptoApi() {
  const cryptoObj = globalThis.crypto;
  if (!cryptoObj?.getRandomValues || !cryptoObj?.subtle?.digest) {
    throw new Error("Web Crypto API is required for Microsoft OAuth PKCE sign-in.");
  }
  return cryptoObj;
}

export async function generatePkcePair() {
  const cryptoObj = getCryptoApi();
  const randomBytes = new Uint8Array(32);
  cryptoObj.getRandomValues(randomBytes);
  const verifier = base64UrlEncode(randomBytes);
  const digest = await cryptoObj.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  const challenge = base64UrlEncode(digest);
  return { verifier, challenge };
}

export function generateRandomState() {
  const cryptoObj = globalThis.crypto;
  if (cryptoObj?.getRandomValues) {
    const bytes = new Uint8Array(16);
    cryptoObj.getRandomValues(bytes);
    return base64UrlEncode(bytes);
  }
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
}

export function buildMicrosoftAuthorizeUrl({
  clientId,
  redirectUri,
  state,
  codeChallenge,
  loginHint = ""
}) {
  const url = new URL(MICROSOFT_AUTHORIZE_URL);
  url.searchParams.set("client_id", String(clientId || "").trim());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_mode", "query");
  url.searchParams.set("scope", MICROSOFT_SCOPES);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  if (loginHint) {
    url.searchParams.set("login_hint", loginHint);
  } else {
    url.searchParams.set("prompt", "select_account");
  }
  return url.toString();
}

export function defaultOpenMicrosoftPopup({ url, state }) {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Microsoft Sign-In is only available in a browser environment."));
  }
  const popup = window.open(
    url,
    "cubing_microsoft_oauth",
    "width=520,height=660,menubar=no,toolbar=no,location=yes,status=no"
  );
  if (!popup) {
    const err = new Error("Popup was blocked by your browser. Please allow popups for this site.");
    err.code = "popup_failed_to_open";
    return Promise.reject(err);
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    let pollTimer = 0;
    let closeGraceTimer = 0;
    let timeoutTimer = 0;

    const cleanup = () => {
      window.removeEventListener("message", onMessage);
      clearInterval(pollTimer);
      clearTimeout(closeGraceTimer);
      clearTimeout(timeoutTimer);
    };

    const finishResolve = (val) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(val);
    };

    const finishReject = (err) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(err);
    };

    const onMessage = (event) => {
      if (event.origin !== window.location.origin) return;
      const data = event.data;
      if (!data || data.type !== MS_OAUTH_CALLBACK_TYPE) return;
      if (data.state !== state) return;
      if (data.error) {
        const msg = data.errorDescription || `Microsoft authentication failed (${data.error}).`;
        const err = new Error(msg);
        err.code = data.error;
        finishReject(err);
        return;
      }
      if (!data.code) {
        finishReject(new Error("Microsoft sign-in completed without an authorization code."));
        return;
      }
      finishResolve({ code: data.code, state: data.state });
    };

    window.addEventListener("message", onMessage);

    pollTimer = setInterval(() => {
      if (popup.closed && !closeGraceTimer) {
        // Give postMessage a brief tick before assuming manual close
        closeGraceTimer = setTimeout(() => {
          const err = new Error("Microsoft sign-in popup was closed before completing.");
          err.code = "popup_closed";
          finishReject(err);
        }, 350);
      }
    }, 350);

    timeoutTimer = setTimeout(() => {
      try { popup.close(); } catch {}
      finishReject(new Error("Microsoft sign-in timed out."));
    }, 180000);
  });
}

export class OneDriveSyncService {
  constructor({
    appStore,
    fetchImpl = (...args) => fetch(...args),
    openAuthPopupImpl = defaultOpenMicrosoftPopup,
    pkceImpl = generatePkcePair,
    getClientId = null,
    onDataHydrated = null,
    nowFn = null,
    nowImpl = null,
    autoAttachBrowserListeners = true
  } = {}) {
    this.providerId = "onedrive";
    this.providerLabel = "Microsoft OneDrive";
    this.appStore = appStore;
    this.fetchImpl = fetchImpl;
    this.openAuthPopupImpl = openAuthPopupImpl;
    this.pkceImpl = pkceImpl;
    this.customGetClientId = getClientId;
    this.onDataHydrated = onDataHydrated;
    this.nowFn = nowImpl || nowFn || (() => Date.now());

    this.listeners = new Set();
    this.meta = loadOneDriveSyncMeta();
    this.token = loadOneDriveSessionToken();
    this.lastSummary = null;
    this.lastError = "";
    this.pendingChanges = false;
    this.syncing = false;
    this.pendingSyncAfterCurrent = false;
    this.autoSyncTimer = 0;
    this.lastVisibilityPullAt = 0;

    this.status = this._computeInitialStatus();
    this._detachLifecycle = autoAttachBrowserListeners
      ? attachCloudSyncLifecycle(this, { visibilityPullCooldownMs: VISIBILITY_PULL_COOLDOWN_MS })
      : () => {};
  }

  _computeInitialStatus() {
    if (!this.meta?.email) return "signed_out";
    if (this._hasValidToken() || this._getStoredRefreshToken()) {
      return this.meta.lastSyncedAt > 0 ? "synced" : "idle";
    }
    return "needs_reauth";
  }

  _getStoredRefreshToken() {
    if (this.token?.refreshToken) return this.token.refreshToken;
    const shared = loadOneDriveSessionToken();
    if (shared?.refreshToken) {
      this.token = shared;
      return shared.refreshToken;
    }
    return "";
  }

  _hasValidToken() {
    const minValidUntil = this.nowFn() + 60000;
    if (this.token?.accessToken && Number(this.token?.expiresAt || 0) > minValidUntil) {
      return true;
    }
    const shared = loadOneDriveSessionToken();
    if (shared?.accessToken && Number(shared?.expiresAt || 0) > minValidUntil) {
      this.token = shared;
      return true;
    }
    return false;
  }

  getEffectiveClientId() {
    if (typeof this.customGetClientId === "function") {
      return String(this.customGetClientId() || "").trim();
    }
    return loadStoredOneDriveClientId() || getEnvMicrosoftClientId();
  }

  getStoredClientId() {
    return loadStoredOneDriveClientId();
  }

  setCustomClientId(clientId) {
    saveStoredOneDriveClientId(clientId);
    this.emit();
  }

  isSignedIn() {
    return Boolean(this.meta?.email);
  }

  getState() {
    const storedClientId = loadStoredOneDriveClientId();
    const envClientId = getEnvMicrosoftClientId();
    return {
      providerId: this.providerId,
      providerLabel: this.providerLabel,
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

  async _exchangeToken(formParams) {
    const body = new URLSearchParams(formParams).toString();
    const res = await this.fetchImpl(MICROSOFT_TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    });
    let data = null;
    try {
      data = await res.json();
    } catch {}
    if (!res.ok || !data?.access_token) {
      const code = data?.error || `http_${res.status}`;
      const msg = data?.error_description || `Microsoft token exchange failed (${res.status}).`;
      const err = new HttpStatusError(res.status, msg);
      err.code = code;
      if (res.status === 400 || res.status === 401 || code === "invalid_grant") {
        err.needsReauth = true;
      }
      throw err;
    }
    const expiresInSec = Number(data.expires_in || 3600);
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || formParams.refresh_token || "",
      expiresAt: this.nowFn() + expiresInSec * 1000,
      scope: data.scope || MICROSOFT_SCOPES
    };
  }

  async ensureAccessToken({ interactive = false, forceInteractive = false, forceRefresh = false } = {}) {
    const clientId = this.getEffectiveClientId();
    if (!clientId) {
      const err = new Error("Microsoft Application (client) ID is not configured.");
      err.code = "NO_CLIENT_ID";
      throw err;
    }

    if (!forceInteractive && !forceRefresh && this._hasValidToken()) {
      return this.token;
    }

    const refreshToken = forceInteractive ? "" : this._getStoredRefreshToken();
    if (refreshToken) {
      try {
        const refreshed = await this._exchangeToken({
          client_id: clientId,
          grant_type: "refresh_token",
          refresh_token: refreshToken,
          scope: MICROSOFT_SCOPES
        });
        this.token = refreshed;
        saveOneDriveSessionToken(refreshed);
        return refreshed;
      } catch (err) {
        if (err?.needsReauth) {
          this.token = null;
          clearOneDriveSessionToken();
          if (!interactive) throw err;
        } else {
          throw err;
        }
      }
    }

    if (!interactive) {
      const err = new Error("Microsoft OneDrive session expired. Please reconnect your Microsoft account.");
      err.code = "login_required";
      err.needsReauth = true;
      throw err;
    }

    const { verifier, challenge } = await this.pkceImpl();
    const state = generateRandomState();
    const redirectUri = getOneDriveRedirectUri(typeof window !== "undefined" ? window : undefined);
    const authorizeUrl = buildMicrosoftAuthorizeUrl({
      clientId,
      redirectUri,
      state,
      codeChallenge: challenge,
      loginHint: forceInteractive ? "" : (this.meta?.email || "")
    });

    const authResult = await this.openAuthPopupImpl({
      url: authorizeUrl,
      state,
      redirectUri
    });

    const tokenObj = await this._exchangeToken({
      client_id: clientId,
      grant_type: "authorization_code",
      code: authResult.code,
      redirect_uri: redirectUri,
      code_verifier: verifier,
      scope: MICROSOFT_SCOPES
    });

    this.token = tokenObj;
    saveOneDriveSessionToken(tokenObj);
    return tokenObj;
  }

  async _fetchUserProfile(accessToken) {
    const res = await this.fetchImpl(GRAPH_ME_URL, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (!res.ok) {
      throw new HttpStatusError(res.status, `Failed to load Microsoft profile (HTTP ${res.status}).`);
    }
    const data = await res.json();
    const email = data?.mail || data?.userPrincipalName || "";
    return {
      email,
      name: data?.displayName || email || "Microsoft Account",
      picture: "",
      sub: data?.id || ""
    };
  }

  async signIn({ interactive = true } = {}) {
    this.lastError = "";
    const prevMeta = { ...this.meta };
    let profile;
    try {
      const tokenObj = await this.ensureAccessToken({
        interactive,
        forceInteractive: interactive
      });
      profile = await this._fetchUserProfile(tokenObj.accessToken);
    } catch (err) {
      this.lastError = err?.message || "Microsoft sign-in failed.";
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
    saveOneDriveSyncMeta(this.meta);
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
    this.token = null;
    clearOneDriveSessionToken();
    clearOneDriveSyncMeta();
    this.meta = loadOneDriveSyncMeta();
    this.status = "signed_out";
    this.lastError = "";
    this.lastSummary = null;
    this.pendingChanges = false;
    this.emit();
  }

  setAutoSync(enabled) {
    this.meta = { ...this.meta, autoSync: Boolean(enabled) };
    if (this.isSignedIn()) {
      saveOneDriveSyncMeta(this.meta);
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

  async _graphFetch(url, accessToken, options = {}) {
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
      throw new HttpStatusError(res.status, `Microsoft OneDrive error (${res.status})${detail ? `: ${detail}` : ""}`);
    }
    return res;
  }

  async downloadRemoteFile(accessToken) {
    const res = await this.fetchImpl(GRAPH_APPROOT_CONTENT_URL, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    if (res.status === 404) {
      return null;
    }
    if (!res.ok) {
      let detail = "";
      try {
        const text = await res.text();
        if (text) detail = text.slice(0, 200);
      } catch {}
      throw new HttpStatusError(res.status, `Microsoft OneDrive error (${res.status})${detail ? `: ${detail}` : ""}`);
    }
    const text = await res.text();
    if (!text || !text.trim()) return null;
    try {
      return JSON.parse(text);
    } catch {
      throw new Error("Remote OneDrive sync file contains invalid JSON.");
    }
  }

  async uploadRemoteFile(accessToken, payload) {
    const res = await this._graphFetch(GRAPH_APPROOT_CONTENT_URL, accessToken, {
      method: "PUT",
      headers: { "Content-Type": "application/json; charset=UTF-8" },
      body: JSON.stringify(payload)
    });
    try {
      return await res.json();
    } catch {
      return null;
    }
  }

  async _performOneDriveSync(accessToken, reason = "manual") {
    const remotePayload = await this.downloadRemoteFile(accessToken);
    const accountKey = `onedrive:${this.meta?.sub || this.meta?.email || ""}`;
    let uploadedItem = null;

    const result = await reconcileRemoteSyncPayload({
      appStore: this.appStore,
      accountKey,
      remotePayload,
      now: this.nowFn(),
      reason,
      onDataHydrated: this.onDataHydrated,
      onUpdateRemote: async (merged) => {
        uploadedItem = await this.uploadRemoteFile(accessToken, merged);
        return uploadedItem;
      },
      onCreateRemote: async (merged) => {
        uploadedItem = await this.uploadRemoteFile(accessToken, merged);
        return uploadedItem;
      }
    });

    const fileId = uploadedItem?.id || this.meta?.fileId || "";
    this.meta = {
      ...this.meta,
      fileId,
      lastSyncedAt: result.lastSyncedAt
    };
    saveOneDriveSyncMeta(this.meta);

    return {
      ok: true,
      localChanged: result.localChanged,
      remoteChanged: result.remoteChanged,
      summary: result.summary,
      fileId,
      lastSyncedAt: result.lastSyncedAt
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
      this.lastError = "Microsoft Application (client) ID is not configured.";
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
      let tokenObj;
      try {
        tokenObj = await this.ensureAccessToken({ interactive });
      } catch (authErr) {
        if (!interactive && (authErr?.needsReauth || authErr?.code === "popup_closed")) {
          this.status = "needs_reauth";
          this.lastError = "";
          this.emit();
          return { ok: false, needsReauth: true };
        }
        throw authErr;
      }

      try {
        result = await this._performOneDriveSync(tokenObj.accessToken, reason);
      } catch (err) {
        if (err instanceof HttpStatusError && err.status === 401) {
          const rt = this._getStoredRefreshToken();
          this.token = rt ? { refreshToken: rt, accessToken: "", expiresAt: 0 } : null;
          if (rt) saveOneDriveSessionToken(this.token);
          else clearOneDriveSessionToken();
          try {
            const refreshed = await this.ensureAccessToken({ interactive, forceRefresh: true });
            result = await this._performOneDriveSync(refreshed.accessToken, reason);
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
    this._detachLifecycle?.();
  }
}
