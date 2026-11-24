import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  PWA_DISMISS_STORAGE_KEY,
  isStandaloneMode,
  isIosSafari,
  createPwaInstallController
} from '../src/features/pwa/pwaInstallController.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function makeMockDom(ids) {
  const els = new Map();
  for (const id of ids) {
    const listeners = new Map();
    els.set(id, {
      id,
      hidden: true,
      textContent: '',
      listeners,
      addEventListener(type, fn) {
        if (!listeners.has(type)) listeners.set(type, []);
        listeners.get(type).push(fn);
      },
      click() {
        for (const fn of listeners.get('click') || []) fn({ type: 'click' });
      }
    });
  }
  return {
    els,
    doc: {
      getElementById: (id) => els.get(id) || null
    }
  };
}

function makeMockWindow({ standalone = false } = {}) {
  const listeners = new Map();
  let isStandalone = standalone;
  const mqlListeners = [];
  return {
    listeners,
    setStandalone(val) {
      isStandalone = Boolean(val);
      for (const fn of mqlListeners) fn({ matches: isStandalone });
    },
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(fn);
    },
    dispatch(type, event) {
      for (const fn of listeners.get(type) || []) fn(event);
    },
    matchMedia(query) {
      if (query === '(display-mode: standalone)') {
        return {
          get matches() {
            return isStandalone;
          },
          addEventListener(type, fn) {
            if (type === 'change') mqlListeners.push(fn);
          }
        };
      }
      return { matches: false };
    }
  };
}

function makeMockStorage() {
  const map = new Map();
  return {
    map,
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v))
  };
}

test('isStandaloneMode and isIosSafari detect platforms accurately', () => {
  assert.strictEqual(isStandaloneMode({ matchMedia: () => ({ matches: true }) }, {}), true);
  assert.strictEqual(isStandaloneMode({ matchMedia: () => ({ matches: false }) }, { standalone: true }), true);
  assert.strictEqual(isStandaloneMode({ matchMedia: () => ({ matches: false }) }, { standalone: false }), false);

  assert.strictEqual(
    isIosSafari({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'
    }),
    true
  );
  assert.strictEqual(
    isIosSafari({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
      maxTouchPoints: 5
    }),
    true
  );
  assert.strictEqual(
    isIosSafari({
      userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15',
      maxTouchPoints: 0
    }),
    false
  );
  assert.strictEqual(
    isIosSafari({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/130.0.0.0 Mobile/15E148 Safari/604.1'
    }),
    false
  );
  assert.strictEqual(
    isIosSafari({
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/130.0.0.0 Safari/537.36'
    }),
    false
  );
});

test('createPwaInstallController captures beforeinstallprompt, handles dismissal, and installs cleanly', async () => {
  const { els, doc } = makeMockDom([
    'pwaInstallBanner',
    'pwaInstallPillBtn',
    'pwaInstallDismissBtn',
    'settingsPwaStatus',
    'settingsPwaInstallBtn'
  ]);
  const win = makeMockWindow();
  const storage = makeMockStorage();
  const toasts = [];

  const ctrl = createPwaInstallController({
    win,
    doc,
    nav: { userAgent: 'Mozilla/5.0 Chrome/130.0.0.0 Safari/537.36' },
    storage,
    onToast: (msg, type) => toasts.push({ msg, type })
  });

  ctrl.init();
  assert.strictEqual(ctrl.getState(), 'browser-cache');
  assert.strictEqual(els.get('pwaInstallBanner').hidden, true);
  assert.strictEqual(els.get('settingsPwaInstallBtn').hidden, true);
  assert.match(els.get('settingsPwaStatus').textContent, /Offline caching is active/);

  // Browser fires beforeinstallprompt
  let prevented = false;
  let prompted = 0;
  win.dispatch('beforeinstallprompt', {
    preventDefault() {
      prevented = true;
    },
    async prompt() {
      prompted++;
    },
    userChoice: Promise.resolve({ outcome: 'accepted' })
  });

  assert.strictEqual(prevented, true);
  assert.strictEqual(ctrl.getState(), 'prompt-ready');
  assert.strictEqual(els.get('pwaInstallBanner').hidden, false);
  assert.strictEqual(els.get('settingsPwaInstallBtn').hidden, false);

  // User dismisses footer pill -> hides pill & persists, keeps Settings install button available
  els.get('pwaInstallDismissBtn').click();
  assert.strictEqual(storage.getItem(PWA_DISMISS_STORAGE_KEY), '1');
  assert.strictEqual(els.get('pwaInstallBanner').hidden, true);
  assert.strictEqual(els.get('settingsPwaInstallBtn').hidden, false);

  // User triggers install from Settings
  const outcome = await ctrl.triggerInstall();
  assert.strictEqual(outcome, 'accepted');
  assert.strictEqual(prompted, 1);
  assert.strictEqual(ctrl.getState(), 'installed');
  assert.strictEqual(els.get('settingsPwaInstallBtn').hidden, true);
  assert.match(els.get('settingsPwaStatus').textContent, /Installed/);
  assert.strictEqual(toasts[0].type, 'success');
});

test('createPwaInstallController handles dismissed prompt choice, appinstalled, and iOS Safari hints', async () => {
  const { els, doc } = makeMockDom([
    'pwaInstallBanner',
    'pwaInstallPillBtn',
    'pwaInstallDismissBtn',
    'settingsPwaStatus',
    'settingsPwaInstallBtn'
  ]);
  const win = makeMockWindow();
  const storage = makeMockStorage();

  const ctrlChrome = createPwaInstallController({
    win,
    doc,
    nav: { userAgent: 'Mozilla/5.0 Chrome/130.0.0.0 Safari/537.36' },
    storage
  });
  ctrlChrome.init();

  win.dispatch('beforeinstallprompt', {
    preventDefault() {},
    async prompt() {},
    userChoice: Promise.resolve({ outcome: 'dismissed' })
  });
  assert.strictEqual(ctrlChrome.getState(), 'prompt-ready');
  const outcome = await ctrlChrome.triggerInstall();
  assert.strictEqual(outcome, 'dismissed');
  assert.strictEqual(ctrlChrome.getState(), 'browser-cache');

  // External browser menu install triggers appinstalled
  win.dispatch('appinstalled', {});
  assert.strictEqual(ctrlChrome.getState(), 'installed');
  assert.match(els.get('settingsPwaStatus').textContent, /Installed/);

  // iOS Safari mode
  const iosToasts = [];
  const iosDom = makeMockDom([
    'pwaInstallBanner',
    'pwaInstallPillBtn',
    'pwaInstallDismissBtn',
    'settingsPwaStatus',
    'settingsPwaInstallBtn'
  ]);
  const ctrlIos = createPwaInstallController({
    win: makeMockWindow(),
    doc: iosDom.doc,
    nav: {
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1'
    },
    storage: makeMockStorage(),
    onToast: (msg, type) => iosToasts.push({ msg, type })
  });
  ctrlIos.init();
  assert.strictEqual(ctrlIos.getState(), 'ios-safari');
  assert.strictEqual(iosDom.els.get('pwaInstallBanner').hidden, false);
  assert.strictEqual(iosDom.els.get('settingsPwaInstallBtn').hidden, true);
  assert.match(iosDom.els.get('settingsPwaStatus').textContent, /Add to Home Screen/);

  const res = await ctrlIos.triggerInstall();
  assert.strictEqual(res, 'ios-hint');
  assert.strictEqual(iosToasts.length, 1);
  assert.match(iosToasts[0].msg, /Share → Add to Home Screen/);
});

test('index.html contains PWA install footer pill and Settings section elements', () => {
  const indexHtml = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  for (const id of [
    'pwaInstallBanner',
    'pwaInstallPillBtn',
    'pwaInstallDismissBtn',
    'settingsPwaInstallSection',
    'settingsPwaStatus',
    'settingsPwaInstallBtn'
  ]) {
    assert.ok(indexHtml.includes(`id="${id}"`), `index.html must include #${id}`);
  }
});
