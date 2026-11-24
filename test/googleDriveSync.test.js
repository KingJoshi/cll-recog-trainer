import test from 'node:test';
import assert from 'node:assert/strict';
import { AppStore } from '../src/state/appStore.js';
import { clearPreferredAlgsCache, getAllPreferredAlgs, onPreferredAlgChange, setPreferredAlg } from '../src/data/algRegistry.js';
import {
  initSyncTracking,
  loadSessionToken,
  saveSessionToken,
  clearSessionToken
} from '../src/services/syncStorage.js';
import {
  GoogleDriveSyncService,
  AUTO_SYNC_DEBOUNCE_MS,
  VISIBILITY_PULL_COOLDOWN_MS
} from '../src/services/googleDriveSync.js';

function createMemoryStorage() {
  const store = new Map();
  return {
    get length() { return store.size; },
    key(i) { return [...store.keys()][i] ?? null; },
    getItem(k) { return store.has(k) ? store.get(k) : null; },
    setItem(k, v) { store.set(k, String(v)); },
    removeItem(k) { store.delete(k); },
    clear() { store.clear(); }
  };
}

function createFakeDriveFetch(driveFiles = new Map(), { rejectNextWith401 = false } = {}) {
  const calls = [];
  let force401 = rejectNextWith401;

  const fetchImpl = async (url, options = {}) => {
    const method = (options.method || "GET").toUpperCase();
    calls.push({ url, method, headers: options.headers, body: options.body });

    if (url.startsWith("https://www.googleapis.com/oauth2/v3/userinfo")) {
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            sub: "user-123",
            email: "cuber@example.com",
            name: "Speed Cuber",
            picture: "https://example.com/avatar.png"
          };
        }
      };
    }

    if (url.startsWith("https://oauth2.googleapis.com/revoke")) {
      return { ok: true, status: 200, async text() { return ""; } };
    }

    if (force401) {
      force401 = false;
      return { ok: false, status: 401, async text() { return "Unauthorized"; } };
    }

    // List files in appDataFolder
    if (url.startsWith("https://www.googleapis.com/drive/v3/files?")) {
      const files = [...driveFiles.values()].map(f => ({
        id: f.id,
        name: f.name,
        modifiedTime: f.modifiedTime
      }));
      return {
        ok: true,
        status: 200,
        async json() { return { files }; }
      };
    }

    // Download file media
    const dlMatch = url.match(/^https:\/\/www\.googleapis\.com\/drive\/v3\/files\/([^?]+)\?alt=media/);
    if (dlMatch && method === "GET") {
      const file = driveFiles.get(decodeURIComponent(dlMatch[1]));
      if (!file) return { ok: false, status: 404, async text() { return "Not Found"; } };
      return {
        ok: true,
        status: 200,
        async text() { return file.content; }
      };
    }

    // Create multipart file
    if (url.startsWith("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart") && method === "POST") {
      const rawBody = String(options.body || "");
      const parts = rawBody.split(/\r?\n\r?\n/);
      const content = parts[parts.length - 1].replace(/\r?\n--[^-]+--\s*$/, "");
      const id = "drive-file-1";
      driveFiles.set(id, {
        id,
        name: "speedcube-trainer-sync.json",
        modifiedTime: new Date().toISOString(),
        content
      });
      return {
        ok: true,
        status: 200,
        async json() { return { id, modifiedTime: new Date().toISOString() }; }
      };
    }

    // Update media
    const patchMatch = url.match(/^https:\/\/www\.googleapis\.com\/upload\/drive\/v3\/files\/([^?]+)\?uploadType=media/);
    if (patchMatch && method === "PATCH") {
      const id = decodeURIComponent(patchMatch[1]);
      const existing = driveFiles.get(id);
      if (!existing) return { ok: false, status: 404, async text() { return "Not Found"; } };
      existing.content = String(options.body || "");
      existing.modifiedTime = new Date().toISOString();
      return {
        ok: true,
        status: 200,
        async json() { return { id, modifiedTime: existing.modifiedTime }; }
      };
    }

    return { ok: false, status: 500, async text() { return "Unhandled mock URL: " + url; } };
  };

  return { fetchImpl, calls, setForce401: (v) => { force401 = v; } };
}

function createFakeGisLoader({ tokenPrefix = "tok", failNonInteractive = false } = {}) {
  let seq = 0;
  const requests = [];
  const loadGis = async () => ({
    accounts: {
      oauth2: {
        initTokenClient(cfg) {
          return {
            callback: cfg.callback,
            error_callback: cfg.error_callback,
            requestAccessToken(reqOpts) {
              requests.push(reqOpts);
              if (failNonInteractive && reqOpts?.prompt === "none") {
                this.callback({ error: "login_required", error_description: "Session expired" });
                return;
              }
              seq += 1;
              this.callback({
                access_token: `${tokenPrefix}-${seq}`,
                expires_in: 3600,
                scope: cfg.scope
              });
            }
          };
        }
      }
    }
  });
  return { loadGis, requests };
}

function installStorageGlobals() {
  const prevLocal = globalThis.localStorage;
  const prevSession = globalThis.sessionStorage;
  const local = createMemoryStorage();
  const session = createMemoryStorage();
  globalThis.localStorage = local;
  globalThis.sessionStorage = session;
  clearPreferredAlgsCache();
  return {
    local,
    session,
    restore() {
      clearPreferredAlgsCache();
      if (prevLocal === undefined) delete globalThis.localStorage;
      else globalThis.localStorage = prevLocal;
      if (prevSession === undefined) delete globalThis.sessionStorage;
      else globalThis.sessionStorage = prevSession;
    }
  };
}

test('GoogleDriveSyncService: initial upload, second-machine reload, concurrent merge, 401 refresh, and sign-out', async () => {
  const driveFiles = new Map();
  let clock = 10000;

  // --- Machine A ---
  const envA = installStorageGlobals();
  let unsubTrackA;
  let syncA;
  try {
    const storeA = new AppStore();
    unsubTrackA = initSyncTracking(storeA, { onPreferredAlgChange });

    storeA.state.darkMode = true;
    storeA.state.currentPuzzle = "333";
    storeA.state.currentTrackId = "pll";
    storeA.state.onboardingCompleted = true;
    storeA.saveSettings();
    storeA.setCaseTag("T", "mastered");
    storeA.setCllCaseSolutionDisplay("T:pll-t-1", "My T Perm");
    storeA.recordCaseStat("333", "pll", "T", true);
    setPreferredAlg("T", "pll-t-2", "333");

    const solvesA = storeA.getSolves();
    solvesA.push({ uid: "solve-A1", puzzle: "333", ms: 10500, rawMs: 10500, at: 5000, scramble: "R U R' F'" });
    storeA.setSolves(solvesA);

    const mockFetchA = createFakeDriveFetch(driveFiles);
    const gisA = createFakeGisLoader({ tokenPrefix: "tokA" });
    syncA = new GoogleDriveSyncService({
      appStore: storeA,
      fetchImpl: mockFetchA.fetchImpl,
      loadGis: gisA.loadGis,
      getClientId: () => "test-client-id.apps.googleusercontent.com",
      nowFn: () => ++clock,
      autoAttachBrowserListeners: false
    });

    const signInRes = await syncA.signIn({ interactive: true });
    assert.strictEqual(signInRes.account.email, "cuber@example.com");
    assert.strictEqual(signInRes.syncResult.ok, true);
    assert.strictEqual(signInRes.syncResult.remoteChanged, true);
    assert.strictEqual(driveFiles.size, 1);

    const uploadedJson = JSON.parse(driveFiles.get("drive-file-1").content);
    assert.strictEqual(uploadedJson.settings.darkMode, true);
    assert.strictEqual(uploadedJson.sessions[0].solves.length, 1);
    assert.strictEqual(uploadedJson.preferredAlgs["333:T"], "pll-t-2");

    unsubTrackA();
    syncA.destroy();
  } finally {
    unsubTrackA?.();
    syncA?.destroy();
    envA.restore();
  }

  // --- Machine B (fresh machine) ---
  const envB = installStorageGlobals();
  let unsubTrackB;
  let syncB;
  try {
    const storeB = new AppStore();
    unsubTrackB = initSyncTracking(storeB, { onPreferredAlgChange });

    let hydratedCount = 0;
    const mockFetchB = createFakeDriveFetch(driveFiles);
    const gisB = createFakeGisLoader({ tokenPrefix: "tokB" });
    syncB = new GoogleDriveSyncService({
      appStore: storeB,
      fetchImpl: mockFetchB.fetchImpl,
      loadGis: gisB.loadGis,
      getClientId: () => "test-client-id.apps.googleusercontent.com",
      onDataHydrated: () => { hydratedCount++; },
      nowFn: () => ++clock,
      autoAttachBrowserListeners: false
    });

    const signInResB = await syncB.signIn({ interactive: true });
    assert.strictEqual(signInResB.syncResult.ok, true);
    assert.strictEqual(signInResB.syncResult.localChanged, true);
    assert.strictEqual(signInResB.syncResult.remoteChanged, false);
    assert.strictEqual(hydratedCount, 1);

    // Machine B received all settings, solves, tags, labels, stats, and preferred algs
    assert.strictEqual(storeB.state.darkMode, true);
    assert.strictEqual(storeB.state.currentPuzzle, "333");
    assert.strictEqual(storeB.getSolves().length, 1);
    assert.strictEqual(storeB.getSolves()[0].uid, "solve-A1");
    assert.strictEqual(storeB.getCaseTag("T"), "mastered");
    assert.strictEqual(storeB.state.customCllLabels["T:pll-t-1"], "My T Perm");
    assert.deepStrictEqual(storeB.getCaseStat("333", "pll", "T"), { shown: 1, correct: 1 });
    assert.strictEqual(getAllPreferredAlgs()["333:T"], "pll-t-2");

    // --- Concurrent edits: simulate remote edit in Drive + local edit on Machine B ---
    const remoteDoc = JSON.parse(driveFiles.get("drive-file-1").content);
    remoteDoc.sessions[0].solves.push({
      uid: "solve-A2",
      puzzle: "333",
      ms: 9800,
      rawMs: 9800,
      at: ++clock,
      scramble: "U2 R2 F2"
    });
    remoteDoc.settings.simSpeed = 1.5;
    remoteDoc.timestamps.settings.simSpeed = clock;
    driveFiles.get("drive-file-1").content = JSON.stringify(remoteDoc);

    // Local edit on Machine B (later timestamp for darkMode + new solve B1)
    clock += 100;
    storeB.state.darkMode = false;
    storeB.saveSettings();
    const solvesB = storeB.getSolves();
    solvesB.push({ uid: "solve-B1", puzzle: "333", ms: 10100, rawMs: 10100, at: clock + 1, scramble: "L D L'" });
    storeB.setSolves(solvesB);

    // Test 401 silent refresh + retry + merge
    mockFetchB.setForce401(true);
    clock += 500;
    const mergeSyncRes = await syncB.syncNow({ reason: "manual", interactive: false });
    assert.strictEqual(mergeSyncRes.ok, true);
    assert.strictEqual(mergeSyncRes.localChanged, true);
    assert.strictEqual(mergeSyncRes.remoteChanged, true);
    assert.strictEqual(storeB.state.darkMode, false);
    assert.strictEqual(storeB.state.simSpeed, 1.5);
    assert.strictEqual(storeB.getSolves().length, 3);
    assert.deepStrictEqual(
      storeB.getSolves().map(s => s.uid),
      ["solve-A1", "solve-A2", "solve-B1"]
    );

    const driveMerged = JSON.parse(driveFiles.get("drive-file-1").content);
    assert.strictEqual(driveMerged.sessions[0].solves.length, 3);
    assert.strictEqual(driveMerged.settings.darkMode, false);
    assert.strictEqual(driveMerged.settings.simSpeed, 1.5);

    // Sign out preserves local data
    await syncB.signOut();
    assert.strictEqual(syncB.getState().status, "signed_out");
    assert.strictEqual(storeB.getSolves().length, 3);
    assert.strictEqual(storeB.state.simSpeed, 1.5);
  } finally {
    unsubTrackB?.();
    syncB?.destroy();
    envB.restore();
  }
});

test('GoogleDriveSyncService transitions to needs_reauth when non-interactive refresh returns login_required', async () => {
  const env = installStorageGlobals();
  let sync;
  try {
    const store = new AppStore();
    const driveFiles = new Map();
    const mockFetch = createFakeDriveFetch(driveFiles);
    const gis = createFakeGisLoader({ failNonInteractive: true });

    // Seed signed-in metadata without valid session token
    env.local.setItem("cll_gdrive_meta", JSON.stringify({
      email: "cuber@example.com",
      name: "Speed Cuber",
      sub: "user-123",
      fileId: "drive-file-1",
      lastSyncedAt: 1000,
      autoSync: true
    }));

    sync = new GoogleDriveSyncService({
      appStore: store,
      fetchImpl: mockFetch.fetchImpl,
      loadGis: gis.loadGis,
      getClientId: () => "test-client-id.apps.googleusercontent.com",
      autoAttachBrowserListeners: false
    });

    assert.strictEqual(sync.getState().status, "needs_reauth");
    const res = await sync.syncNow({ reason: "visibility", interactive: false });
    assert.strictEqual(res.needsReauth, true);
    assert.strictEqual(sync.getState().status, "needs_reauth");
  } finally {
    sync?.destroy();
    env.restore();
  }
});

test('Session token shares across same-origin tabs via localStorage fallback and clears cleanly', () => {
  const env = installStorageGlobals();
  try {
    const tok = { accessToken: "shared-tok", expiresAt: Date.now() + 3600_000, scope: "drive.appdata" };
    saveSessionToken(tok);
    assert.deepStrictEqual(loadSessionToken(), tok);

    // New tab has empty sessionStorage -> falls back to localStorage copy
    env.session.clear();
    assert.deepStrictEqual(loadSessionToken(), tok);

    clearSessionToken();
    assert.strictEqual(loadSessionToken(), null);
  } finally {
    env.restore();
  }
});

test('GoogleDriveSyncService flushes pending settings on tab hide and pulls on window focus with 5s cooldown', async () => {
  assert.strictEqual(AUTO_SYNC_DEBOUNCE_MS, 1200);
  assert.strictEqual(VISIBILITY_PULL_COOLDOWN_MS, 5000);

  const prevWindow = globalThis.window;
  const prevDoc = globalThis.document;
  const winListeners = new Map();
  const docListeners = new Map();

  globalThis.window = {
    location: { search: "" },
    addEventListener(type, fn) {
      if (!winListeners.has(type)) winListeners.set(type, new Set());
      winListeners.get(type).add(fn);
    },
    removeEventListener(type, fn) {
      winListeners.get(type)?.delete(fn);
    },
    dispatch(type) {
      for (const fn of [...(winListeners.get(type) || [])]) fn();
    }
  };
  globalThis.document = {
    visibilityState: "visible",
    cookie: "",
    documentElement: { style: { setProperty() {} } },
    addEventListener(type, fn) {
      if (!docListeners.has(type)) docListeners.set(type, new Set());
      docListeners.get(type).add(fn);
    },
    removeEventListener(type, fn) {
      docListeners.get(type)?.delete(fn);
    },
    dispatch(type) {
      for (const fn of [...(docListeners.get(type) || [])]) fn();
    }
  };

  const env = installStorageGlobals();
  let clock = 20000;
  let unsubTrack;
  let sync;
  try {
    const driveFiles = new Map();
    const store = new AppStore();
    unsubTrack = initSyncTracking(store, { onPreferredAlgChange });

    const mockFetch = createFakeDriveFetch(driveFiles);
    const gis = createFakeGisLoader({ tokenPrefix: "tokFocus" });
    sync = new GoogleDriveSyncService({
      appStore: store,
      fetchImpl: mockFetch.fetchImpl,
      loadGis: gis.loadGis,
      getClientId: () => "test-client-id.apps.googleusercontent.com",
      nowFn: () => clock,
      autoAttachBrowserListeners: true
    });

    await sync.signIn({ interactive: true });
    assert.strictEqual(sync.pendingChanges, false);

    // Local setting edit schedules debounced push, then hiding the tab flushes it immediately
    clock += 1000;
    store.state.darkMode = true;
    store.saveSettings();
    sync.scheduleAutoSync();
    assert.strictEqual(sync.pendingChanges, true);

    globalThis.document.visibilityState = "hidden";
    globalThis.document.dispatch("visibilitychange");
    await new Promise(r => setTimeout(r, 30));

    assert.strictEqual(sync.pendingChanges, false);
    const afterFlush = JSON.parse(driveFiles.get("drive-file-1").content);
    assert.strictEqual(afterFlush.settings.darkMode, true);

    // Simulate remote edit made on another domain (e.g. cubing.cc), then focus within vs after 5s cooldown
    clock += 2000;
    const remoteDoc = JSON.parse(driveFiles.get("drive-file-1").content);
    remoteDoc.settings.simSpeed = 2;
    remoteDoc.timestamps.settings.simSpeed = clock + 500;
    driveFiles.get("drive-file-1").content = JSON.stringify(remoteDoc);

    // Initial focus pulls immediately (lastVisibilityPullAt starts at 0 -> > 5000)
    clock += 1000;
    globalThis.window.dispatch("focus");
    await new Promise(r => setTimeout(r, 30));
    assert.strictEqual(store.state.simSpeed, 2);

    // Rapid second focus within 5s cooldown is throttled (won't overwrite or spam Drive)
    remoteDoc.settings.simSpeed = 0.5;
    remoteDoc.timestamps.settings.simSpeed = clock + 2000;
    driveFiles.get("drive-file-1").content = JSON.stringify(remoteDoc);

    clock += 2000; // only 2s elapsed < 5s cooldown
    globalThis.window.dispatch("focus");
    await new Promise(r => setTimeout(r, 30));
    assert.strictEqual(store.state.simSpeed, 2);

    // After 5s cooldown expires, focus pulls new remote value
    clock += 4000;
    globalThis.window.dispatch("focus");
    await new Promise(r => setTimeout(r, 30));
    assert.strictEqual(store.state.simSpeed, 0.5);

    sync.destroy();
    assert.strictEqual(winListeners.get("focus")?.size || 0, 0);
    assert.strictEqual(winListeners.get("pagehide")?.size || 0, 0);
    assert.strictEqual(docListeners.get("visibilitychange")?.size || 0, 0);
  } finally {
    unsubTrack?.();
    sync?.destroy();
    env.restore();
    if (prevWindow === undefined) delete globalThis.window;
    else globalThis.window = prevWindow;
    if (prevDoc === undefined) delete globalThis.document;
    else globalThis.document = prevDoc;
  }
});
