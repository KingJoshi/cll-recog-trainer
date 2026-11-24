import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  DEFAULT_THEME_COLORS,
  THEME_COLOR_FIELDS,
  THEME_COLOR_PRESETS,
  sanitizeThemeHex,
  sanitizeThemeColors,
  applyThemeColorsToCss
} from '../src/services/themeColors.js';
import { AppStore } from '../src/state/appStore.js';
import { mergeSyncPayloads } from '../src/services/syncMerge.js';

test('sanitizeThemeHex normalizes 3-char and 6-char hex codes and rejects invalid inputs', () => {
  assert.equal(sanitizeThemeHex('#abc'), '#aabbcc');
  assert.equal(sanitizeThemeHex(' #F0A '), '#ff00aa');
  assert.equal(sanitizeThemeHex('#1E293B'), '#1e293b');
  assert.equal(sanitizeThemeHex('123456'), null);
  assert.equal(sanitizeThemeHex('#12345'), null);
  assert.equal(sanitizeThemeHex('#zzzzzz'), null);
  assert.equal(sanitizeThemeHex(null), null);
});

test('sanitizeThemeColors preserves valid partial overrides, falls back invalid keys, and does not mutate defaults', () => {
  const beforeDefaults = JSON.stringify(DEFAULT_THEME_COLORS);
  const cleaned = sanitizeThemeColors({
    light: { bg: '#fff', primary: 'bad-color' },
    dark: { primary: '#06B6D4' },
    bld: { buffer: '#d946ef', parity: '#000' }
  });

  assert.equal(cleaned.light.bg, '#ffffff');
  assert.equal(cleaned.light.primary, DEFAULT_THEME_COLORS.light.primary);
  assert.equal(cleaned.light.surface, DEFAULT_THEME_COLORS.light.surface);
  assert.equal(cleaned.dark.primary, '#06b6d4');
  assert.equal(cleaned.dark.bg, DEFAULT_THEME_COLORS.dark.bg);
  assert.equal(cleaned.bld.buffer, '#d946ef');
  assert.equal(cleaned.bld.parity, '#000000');
  assert.equal(cleaned.bld.target, DEFAULT_THEME_COLORS.bld.target);

  assert.equal(JSON.stringify(DEFAULT_THEME_COLORS), beforeDefaults);
  assert.ok(THEME_COLOR_FIELDS.light.length >= 6);
  assert.ok(THEME_COLOR_FIELDS.dark.length >= 6);
  assert.ok(THEME_COLOR_FIELDS.bld.length >= 4);
  assert.ok(THEME_COLOR_PRESETS.light.classic);
  assert.ok(THEME_COLOR_PRESETS.dark.oled);
  assert.ok(THEME_COLOR_PRESETS.bld['high-contrast']);
});

test('applyThemeColorsToCss applies active light or dark CSS tokens, 3BLD tokens, and meta theme-color', () => {
  const prevDocument = globalThis.document;
  const props = new Map();
  let metaContent = '';
  globalThis.document = {
    documentElement: {
      style: {
        setProperty: (k, v) => props.set(k, v)
      }
    },
    querySelector: (sel) => (sel === 'meta[name="theme-color"]' ? { setAttribute: (_k, v) => { metaContent = v; } } : null)
  };

  try {
    const custom = {
      light: { ...DEFAULT_THEME_COLORS.light, bg: '#f6f3eb', primary: '#4f46e5' },
      dark: { ...DEFAULT_THEME_COLORS.dark, bg: '#090d16', surface: '#111827', primary: '#06b6d4' },
      bld: { buffer: '#d946ef', target: '#16a34a', pair: '#0284c7', parity: '#ea580c' }
    };

    applyThemeColorsToCss(custom, false);
    assert.equal(props.get('--bg'), '#f6f3eb');
    assert.equal(props.get('--primary'), '#4f46e5');
    assert.equal(props.get('--primary-soft'), 'rgba(79, 70, 229, 0.12)');
    assert.ok(String(props.get('--surface-2')).includes('color-mix'));
    assert.ok(String(props.get('--primary-dark')).includes('#4f46e5'));
    assert.equal(props.get('--bld-buffer'), '#d946ef');
    assert.equal(props.get('--bld-target'), '#16a34a');
    assert.equal(props.get('--bld-pair'), '#0284c7');
    assert.equal(props.get('--bld-parity'), '#ea580c');
    assert.equal(metaContent, '#4f46e5');

    props.clear();
    applyThemeColorsToCss(custom, true);
    assert.equal(props.get('--bg'), '#090d16');
    assert.equal(props.get('--surface'), '#111827');
    assert.equal(props.get('--primary'), '#06b6d4');
    assert.equal(props.get('--primary-soft'), 'rgba(6, 182, 212, 0.2)');
    assert.equal(props.get('--bld-buffer'), '#d946ef');
    assert.equal(metaContent, '#090d16');
  } finally {
    if (prevDocument === undefined) delete globalThis.document;
    else globalThis.document = prevDocument;
  }
});

test('AppStore persists, resets, hydrates, and LWW-syncs themeColors cleanly', () => {
  const backing = {};
  const prevStorage = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: k => (k in backing ? backing[k] : null),
    setItem: (k, v) => { backing[k] = String(v); },
    removeItem: k => { delete backing[k]; }
  };

  try {
    const store = new AppStore();
    assert.deepEqual(store.state.themeColors, DEFAULT_THEME_COLORS);

    const events = [];
    const unsub = store.subscribe((evt, detail) => {
      if (evt === 'themeColors') events.push(detail);
    });
    try {
      store.setThemeColors('light', { bg: '#f6f3eb', primary: '#4f46e5' });
      store.setThemeColors('dark', { bg: '#090d16', primary: '#06b6d4' });
      store.setThemeColors('bld', { buffer: '#d946ef' });
    } finally {
      unsub();
    }

    assert.equal(events.length, 3);
    assert.equal(store.getSettingsPayload().themeColors.light.bg, '#f6f3eb');
    assert.equal(store.getSettingsPayload().themeColors.dark.bg, '#090d16');
    assert.equal(store.getSettingsPayload().themeColors.bld.buffer, '#d946ef');

    // Reload from persisted localStorage
    const reloaded = new AppStore();
    assert.equal(reloaded.state.themeColors.light.bg, '#f6f3eb');
    assert.equal(reloaded.state.themeColors.dark.primary, '#06b6d4');
    assert.equal(reloaded.state.themeColors.bld.buffer, '#d946ef');

    // Reset single section leaves other sections untouched
    reloaded.resetThemeColors('light');
    assert.deepEqual(reloaded.state.themeColors.light, DEFAULT_THEME_COLORS.light);
    assert.equal(reloaded.state.themeColors.dark.primary, '#06b6d4');
    assert.equal(reloaded.state.themeColors.bld.buffer, '#d946ef');

    // Sync merge LWW across devices
    const merged = mergeSyncPayloads(
      {
        schemaVersion: 1,
        hasLocalSettings: true,
        settings: { themeColors: reloaded.getSettingsPayload().themeColors, activeSessionId: 'default' },
        timestamps: { settings: { themeColors: 1000 } },
        sessions: [{ id: 'default', name: '3x3 Main', puzzle: '333', solves: [{ ms: 10000, at: 1000 }], updatedAt: 1000 }]
      },
      {
        schemaVersion: 1,
        hasLocalSettings: true,
        settings: {
          themeColors: {
            light: DEFAULT_THEME_COLORS.light,
            dark: { ...DEFAULT_THEME_COLORS.dark, primary: '#8b5cf6' },
            bld: { ...DEFAULT_THEME_COLORS.bld, parity: '#ea580c' }
          },
          activeSessionId: 'default'
        },
        timestamps: { settings: { themeColors: 3000 } },
        sessions: [{ id: 'default', name: '3x3 Main', puzzle: '333', solves: [{ ms: 10000, at: 1000 }], updatedAt: 1000 }]
      }
    );

    assert.equal(merged.merged.settings.themeColors.dark.primary, '#8b5cf6');
    assert.equal(merged.merged.settings.themeColors.bld.parity, '#ea580c');

    // Hydrate from sync updates store
    reloaded.hydrateFromSync(merged.merged);
    assert.equal(reloaded.state.themeColors.dark.primary, '#8b5cf6');
    assert.equal(reloaded.state.themeColors.bld.parity, '#ea580c');
  } finally {
    globalThis.localStorage = prevStorage;
  }
});

test('Settings UI exposes Theme & Colors tab with 4 color widgets and CSS variable bindings', () => {
  const html = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const headerCss = fs.readFileSync(new URL('../src/styles/features/header.css', import.meta.url), 'utf8');
  const studyCss = fs.readFileSync(new URL('../src/styles/features/study.css', import.meta.url), 'utf8');
  const practiceCss = fs.readFileSync(new URL('../src/styles/features/practice.css', import.meta.url), 'utf8');

  assert.match(html, /data-settings-tab="colors"[^>]*>.*Theme &amp; Colors/);
  assert.ok(html.includes('id="lightThemeColorGrid"'));
  assert.ok(html.includes('id="darkThemeColorGrid"'));
  assert.ok(html.includes('id="colorPickerGrid"'));
  assert.ok(html.includes('id="bldColorGrid"'));
  assert.ok(html.includes('id="previewLightThemeBtn"'));
  assert.ok(html.includes('id="previewDarkThemeBtn"'));

  assert.match(headerCss, /\[data-theme="dark"\]\s*\.app-header[\s\S]*?background:\s*var\(--surface\)/);
  assert.ok(studyCss.includes('var(--bld-buffer)'));
  assert.ok(studyCss.includes('var(--bld-target)'));
  assert.ok(practiceCss.includes('var(--bld-pair)'));
  assert.ok(practiceCss.includes('var(--bld-parity)'));
});
