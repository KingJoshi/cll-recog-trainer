import test from 'node:test';
import assert from 'node:assert/strict';
import { AppStore } from '../src/state/appStore.js';
import { clearPreferredAlgsCache, onPreferredAlgChange } from '../src/data/algRegistry.js';
import {
  initSyncTracking,
  loadActiveSyncProvider,
  saveActiveSyncProvider,
  loadOneDriveSessionToken,
  saveOneDriveSessionToken,
  clearOneDriveSessionToken
} from '../src/services/syncStorage.js';
import {
  OneDriveSyncService,
  MICROSOFT_AUTHORIZE_URL,
  MICROSOFT_TOKEN_URL,
  GRAPH_ME_URL,
  GRAPH_APPROOT_CONTENT_URL,
  getOneDriveRedirectUri,
  generatePkcePair,
  buildMicrosoftAuthorizeUrl
} from '../src/services/oneDriveSync.js';

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

function installStorageGlobals() {
  const prevLocal = globalThis.localStorage;
  const prevSession = globalThis.sessionStorage;
  const prevDoc = globalThis.document;
  const local = createMemoryStorage();
  const session = createMemoryStorage();
  globalThis.localStorage = local;
  globalThis.sessionStorage = session;
  if (!globalThis.document) {
    globalThis.document = { cookie: "", documentElement: { style: { setProperty() {} } } };
  }
  clearPreferredAlgsCache();
  return {
    local,
    session,
    restore() {
      if (prevLocal === undefined) delete globalThis.localStorage;
      else globalThis.localStorage = prevLocal;
      if (prevSession === undefined) delete globalThis.sessionStorage;
      else globalThis.sessionStorage = prevSession;
      if (prevDoc === undefined) delete globalThis.document;
      else globalThis.document = prevDoc;
      clearPreferredAlgsCache();
    }
  };
}

function createFakeMicrosoftFetch(appRootFiles = new Map(), { rejectNextGraphWith401 = false, rejectRefresh = false } = {}) {
  const calls = [];
  let force401 = rejectNextGraphWith401;
  let tokenCounter = 0;

  const fetchImpl = async (url, options = {}) => {
    const method = (options.method || "GET").toUpperCase();
    calls.push({ url, method, headers: options.headers, body: options.body });

    if (url === MICROSOFT_TOKEN_URL && method === "POST") {
      const params = new URLSearchParams(String(options.body || ""));
      const grantType = params.get("grant_type");
      if (grantType === "refresh_token" && rejectRefresh) {
        return {
          ok: false,
          status: 400,
          async json() {
            return { error: "invalid_grant", error_description: "Refresh token expired." };
          }
        };
      }
      tokenCounter += 1;
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            access_token: `ms-access-${tokenCounter}`,
            refresh_token: `ms-refresh-${tokenCounter}`,
            expires_in: 3600,
            scope: "openid profile email offline_access User.Read Files.ReadWrite.AppFolder"
          };
        }
      };
    }

    if (force401 && url === GRAPH_APPROOT_CONTENT_URL) {
      force401 = false;
      return { ok: false, status: 401, async text() { return "Unauthorized"; } };
    }

    if (url === GRAPH_ME_URL && method === "GET") {
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            id: "ms-user-42",
            displayName: "Speed Cuber",
            mail: "cuber@outlook.com"
          };
        }
      };
    }

    if (url === GRAPH_APPROOT_CONTENT_URL && method === "GET") {
      const content = appRootFiles.get("speedcube-trainer-sync.json");
      if (content === undefined) {
        return { ok: false, status: 404, async text() { return "Item not found"; } };
      }
      return { ok: true, status: 200, async text() { return content; } };
    }

    if (url === GRAPH_APPROOT_CONTENT_URL && method === "PUT") {
      const content = String(options.body || "");
      appRootFiles.set("speedcube-trainer-sync.json", content);
      return {
        ok: true,
        status: 200,
        async json() {
          return { id: "od-item-1", name: "speedcube-trainer-sync.json" };
        }
      };
    }

    throw new Error(`Unexpected fetch URL: ${method} ${url}`);
  };

  return { fetchImpl, calls };
}

test('PKCE helpers and buildMicrosoftAuthorizeUrl generate valid S256 parameters', async () => {
  const { verifier, challenge } = await generatePkcePair();
  assert.ok(verifier.length >= 43 && !/[+/=]/.test(verifier), 'PKCE verifier must be unpadded base64url');
  assert.ok(challenge.length >= 43 && !/[+/=]/.test(challenge), 'PKCE challenge must be unpadded base64url');
  assert.notStrictEqual(verifier, challenge);

  assert.strictEqual(
    getOneDriveRedirectUri({ location: { origin: 'https://cubing.cc' } }),
    'https://cubing.cc/auth/microsoft/'
  );

  const url = new URL(
    buildMicrosoftAuthorizeUrl({
      clientId: '11111111-2222-3333-4444-555555555555',
      redirectUri: 'https://cubing.cc/auth/microsoft/',
      state: 'st-xyz',
      codeChallenge: challenge
    })
  );
  assert.strictEqual(`${url.origin}${url.pathname}`, MICROSOFT_AUTHORIZE_URL);
  assert.strictEqual(url.searchParams.get('client_id'), '11111111-2222-3333-4444-555555555555');
  assert.strictEqual(url.searchParams.get('code_challenge'), challenge);
  assert.strictEqual(url.searchParams.get('code_challenge_method'), 'S256');
  assert.strictEqual(url.searchParams.get('response_type'), 'code');
  assert.match(url.searchParams.get('scope'), /Files\.ReadWrite\.AppFolder/);
});

test('OneDriveSyncService: PKCE sign-in, initial upload on 404, second-device hydrate, refresh_token renewal, and sign-out', async () => {
  const env = installStorageGlobals();
  let clock = 50000;
  let unsubTrack;
  try {
    const appRootFiles = new Map();

    // Machine A
    const storeA = new AppStore();
    unsubTrack = initSyncTracking(storeA, { onPreferredAlgChange });
    storeA.state.darkMode = true;
    storeA.saveSettings();
    const solvesA = storeA.getSolves();
    solvesA.push({ uid: 'solve-ms-1', puzzle: '333', ms: 4321, rawMs: 4321, at: 1000, scramble: "R U R'" });
    storeA.setSolves(solvesA);

    const mockFetchA = createFakeMicrosoftFetch(appRootFiles);
    const popupPayloads = [];
    const syncA = new OneDriveSyncService({
      appStore: storeA,
      fetchImpl: mockFetchA.fetchImpl,
      openAuthPopupImpl: async ({ url, state }) => {
        popupPayloads.push({ url, state });
        return { code: 'auth-code-1', state };
      },
      getClientId: () => 'ms-client-id-123',
      nowFn: () => clock,
      autoAttachBrowserListeners: false
    });

    const signRes = await syncA.signIn({ interactive: true });
    assert.strictEqual(popupPayloads.length, 1);
    assert.strictEqual(signRes.account.email, 'cuber@outlook.com');
    assert.strictEqual(signRes.syncResult.ok, true);
    assert.strictEqual(signRes.syncResult.summary.uploadedSolves, 1);
    assert.strictEqual(syncA.getState().status, 'synced');

    // Stored token + active provider persistence
    saveActiveSyncProvider('onedrive');
    assert.strictEqual(loadActiveSyncProvider(), 'onedrive');
    const savedTok = loadOneDriveSessionToken();
    assert.strictEqual(savedTok.accessToken, 'ms-access-1');
    assert.strictEqual(savedTok.refreshToken, 'ms-refresh-1');

    // Switch to clean Machine B & connect to same OneDrive AppFolder
    unsubTrack();
    env.local.clear();
    env.session.clear();

    const storeB = new AppStore();
    unsubTrack = initSyncTracking(storeB, { onPreferredAlgChange });
    const hydrated = [];
    const mockFetchB = createFakeMicrosoftFetch(appRootFiles, { rejectNextGraphWith401: true });
    const syncB = new OneDriveSyncService({
      appStore: storeB,
      fetchImpl: mockFetchB.fetchImpl,
      openAuthPopupImpl: async ({ state }) => ({ code: 'auth-code-2', state }),
      getClientId: () => 'ms-client-id-123',
      onDataHydrated: (summary) => hydrated.push(summary),
      nowFn: () => clock,
      autoAttachBrowserListeners: false
    });

    await syncB.signIn({ interactive: true });
    assert.strictEqual(storeB.state.darkMode, true);
    assert.strictEqual(storeB.getSolves().length, 1);
    assert.strictEqual(hydrated.length, 1);
    // 401 on first Graph download must bypass cached access token and refresh immediately
    assert.strictEqual(loadOneDriveSessionToken().accessToken, 'ms-access-2');

    // Expire access token past 1h -> verify silent refresh_token exchange without opening popup again
    clock += 4000 * 1000;
    let popupOpenedDuringRefresh = false;
    syncB.openAuthPopupImpl = async () => {
      popupOpenedDuringRefresh = true;
      return { code: 'unexpected' };
    };
    storeB.state.simSpeed = 1.5;
    storeB.saveSettings();
    const resB = await syncB.syncNow({ reason: 'auto', interactive: false });
    assert.strictEqual(resB.ok, true);
    assert.strictEqual(popupOpenedDuringRefresh, false);
    assert.strictEqual(loadOneDriveSessionToken().accessToken, 'ms-access-3');

    // Sign out clears tokens & meta
    await syncB.signOut();
    assert.strictEqual(syncB.isSignedIn(), false);
    assert.strictEqual(syncB.getState().status, 'signed_out');
    assert.strictEqual(loadOneDriveSessionToken(), null);
  } finally {
    unsubTrack?.();
    env.restore();
  }
});

test('OneDriveSyncService transitions to needs_reauth when non-interactive refresh fails with invalid_grant', async () => {
  const env = installStorageGlobals();
  try {
    const store = new AppStore();
    const { fetchImpl } = createFakeMicrosoftFetch(new Map(), { rejectRefresh: true });
    saveOneDriveSessionToken({
      accessToken: 'expired-tok',
      refreshToken: 'bad-refresh',
      expiresAt: 100
    });

    const sync = new OneDriveSyncService({
      appStore: store,
      fetchImpl,
      getClientId: () => 'ms-client-id-123',
      nowFn: () => 10000,
      autoAttachBrowserListeners: false
    });
    sync.meta = {
      email: 'cuber@outlook.com',
      name: 'Cuber',
      picture: '',
      sub: 'ms-user-42',
      fileId: '',
      lastSyncedAt: 5000,
      autoSync: true
    };

    const res = await sync.syncNow({ reason: 'startup', interactive: false });
    assert.strictEqual(res.ok, false);
    assert.strictEqual(res.needsReauth, true);
    assert.strictEqual(sync.getState().status, 'needs_reauth');
    assert.strictEqual(clearOneDriveSessionToken() ?? loadOneDriveSessionToken(), null);
  } finally {
    env.restore();
  }
});
