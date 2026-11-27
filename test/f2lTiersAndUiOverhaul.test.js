import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { puzzles } from 'cubing/puzzles';

import { StudyView } from '../src/studyView.js';
import { PracticeView } from '../src/practiceView.js';
import { renderFirstFaceStudyHtml } from '../src/features/study/firstLayerExplorer.js';
import { f2lCases } from '../src/data/f2lData.js';
import {
  ESSENTIAL_F2L_IDS,
  ESSENTIAL_F2L_MIRROR_MAP,
  getEssentialMirrorPartnerId,
  F2L_INTERMEDIATE_GROUPS,
  F2L_ADVANCED_GROUPS,
  f2lIntermediateCases,
  f2lAdvancedCases
} from '../src/data/f2lExtendedData.js';
import {
  appStore,
  sanitizeF2lMode,
  sanitizeTrainSubMode,
  isSimulateViewMode,
  isBetaTrack,
  isBetaPuzzle,
  isExperimentalEnabled,
  isTrackEnabled,
  isPuzzleEnabled,
  getTrackExperimentalFeature,
  getFallbackTrackForPuzzle,
  sanitizeExperimentalFeatures,
  EXPERIMENTAL_FEATURE_IDS,
  VALID_TRAIN_SUBMODES,
  VALID_F2L_MODES
} from '../src/state/appStore.js';
import { mergeSyncPayloads } from '../src/services/syncMerge.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

function readText(relPath) {
  return fs.readFileSync(path.join(ROOT, relPath), 'utf8');
}

function createMockContainer() {
  return {
    innerHTML: '',
    querySelectorAll() { return []; },
    querySelector() { return null; }
  };
}

test('GPL-3.0 LICENSE, README, and Vite PWA manifest branding are properly configured', () => {
  const licenseText = readText('LICENSE');
  assert.match(licenseText, /GNU GENERAL PUBLIC LICENSE/);
  assert.match(licenseText, /Version 3,\s*29 June 2007/);

  const readmeText = readText('README.md');
  assert.match(readmeText, /GNU General Public License v3\.0|GPL-3\.0/);
  assert.match(readmeText, /Cubing\.cc/);

  const viteText = readText('vite.config.js');
  assert.match(viteText, /Ad-free, offline-ready speedcube timer/i);
  assert.doesNotMatch(viteText, /unpkg\.com/);
});

test('index.html has 3-slot mode bar, icon-only header, 3-tab Devices modal, split Settings tabs, clean Footer & About', () => {
  const html = readText('index.html');
  const stageCss = readText('src/styles/features/stage.css');

  // Top-level .mode-seg has 3 slots in HTML and CSS
  assert.match(stageCss, /\.seg\.mode-seg\s*\{[^}]*grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
  const modeSegMatch = html.match(/<div class="seg mode-seg"[\s\S]*?<\/div>/);
  assert.ok(modeSegMatch, 'Expected .mode-seg');
  assert.ok(modeSegMatch[0].includes('data-mode="study"'));
  assert.ok(modeSegMatch[0].includes('data-mode="practice"'));
  assert.ok(modeSegMatch[0].includes('data-mode="solve"'));
  assert.ok(!modeSegMatch[0].includes('data-mode="simulate"'), 'Simulate lives inside Train subtabs');

  // Simulate lives inside #trainSubmodeBar
  const trainBarMatch = html.match(/<div id="trainSubmodeBar"[\s\S]*?<\/div>/);
  assert.ok(trainBarMatch);
  assert.ok(trainBarMatch[0].includes('data-train-submode="simulate"'));

  // Header actions include compact icon-only Devices button (#bluetoothBtn + LED) that opens Settings -> Devices directly
  const headerActionsMatch = html.match(/<div class="header-actions">[\s\S]*?<\/div>/);
  assert.ok(headerActionsMatch, 'Expected .header-actions');
  assert.ok(headerActionsMatch[0].includes('id="bluetoothBtn"'), 'Devices icon button present in main header');
  assert.ok(headerActionsMatch[0].includes('id="bluetoothHeaderDot"'), 'Devices LED dot present in main header');
  assert.ok(!headerActionsMatch[0].includes('id="bluetoothHeaderLabel"'));
  assert.ok(!headerActionsMatch[0].includes('id="cloudSyncHeaderLabel"'));
  assert.ok(!headerActionsMatch[0].includes('id="ganTimerBtn"'));
  assert.match(headerActionsMatch[0], /id="onboardingBtn"[^>]*>\?<\/button>/);
  assert.match(headerActionsMatch[0], /id="themeToggleBtn"[^>]*>🌙<\/button>/);
  assert.match(headerActionsMatch[0], /id="settingsBtn"[^>]*>⚙️<\/button>/);

  // Devices live inside Settings -> Devices tab with 3 subtabs + popup buttons for Diagnostics & Supported Smart Cubes
  assert.ok(!html.includes('id="bluetoothModal"'), 'Separate #bluetoothModal overlay removed in favor of Settings -> Devices');
  assert.ok(html.includes('data-settings-tab="devices"'));
  assert.ok(html.includes('data-settings-tab="sync"'));
  assert.ok(!html.includes('data-settings-tab="hardware"'));
  const devPanelStart = html.indexOf('data-settings-panel="devices"');
  const syncPanelStart = html.indexOf('data-settings-panel="sync"');
  const devSlice = html.slice(devPanelStart, syncPanelStart);
  assert.ok(devPanelStart > 0 && syncPanelStart > devPanelStart);
  assert.ok(devSlice.includes('id="devicesTabCubes"'));
  assert.ok(devSlice.includes('id="devicesTabTimers"'));
  assert.ok(devSlice.includes('id="devicesTabKeyboard"'));
  assert.ok(devSlice.includes('id="devicesPanelKeyboard"'));
  const kbPanelIdx = devSlice.indexOf('id="devicesPanelKeyboard"');
  assert.ok(devSlice.indexOf('id="btVirtualBtn"') > kbPanelIdx, 'Virtual Keyboard Cube sits inside Keyboard tab');
  assert.ok(devSlice.indexOf('id="btVirtualKeypad"') > kbPanelIdx, 'Virtual Keypad sits inside Keyboard tab');
  assert.ok(devSlice.includes('id="ganTimerBtn"'));
  assert.ok(devSlice.includes('id="btOpenDiagModalBtn"'));
  assert.ok(devSlice.includes('id="btOpenSupportedCubesModalBtn"'));
  assert.ok(!devSlice.includes('bt-diag-section'), 'Diagnostics moves into its own popup modal');
  assert.ok(!devSlice.includes('Supported Smart Cubes</h4>'), 'Supported Smart Cubes moves into its own popup modal');

  // Popups for Diagnostics and Supported Smart Cubes stack after #settingsModal
  const settingsEnd = html.indexOf('id="shortcutsModal"');
  assert.ok(html.indexOf('id="btDiagModal"') > 0 && html.indexOf('id="btDiagModal"') < settingsEnd);
  assert.ok(html.indexOf('id="btSupportedCubesModal"') > 0 && html.indexOf('id="btSupportedCubesModal"') < settingsEnd);

  // Beta Features checkbox moved out of General into its own Experimental tab after Devices & Sync
  const genPanelStart = html.indexOf('data-settings-panel="general"');
  const solvePanelStart = html.indexOf('data-settings-panel="solve"');
  assert.ok(!html.slice(genPanelStart, solvePanelStart).includes('id="settingsBetaFeatures"'));
  const devicesTabIdx = html.indexOf('data-settings-tab="devices"');
  const syncTabIdx = html.indexOf('data-settings-tab="sync"');
  const expTabIdx = html.indexOf('data-settings-tab="experimental"');
  assert.ok(devicesTabIdx > 0 && syncTabIdx > devicesTabIdx && expTabIdx > syncTabIdx);
  const expPanelStart = html.indexOf('data-settings-panel="experimental"');
  const expPanelSlice = html.slice(expPanelStart, settingsEnd);
  assert.ok(expPanelSlice.includes('id="settingsExpCheckAllBtn"'));
  assert.ok(expPanelSlice.includes('Check All'));
  assert.ok(expPanelSlice.includes('id="settingsExpRemoveAllBtn"'));
  assert.ok(expPanelSlice.includes('Remove All'));
  for (const fid of [
    'eg1', 'eg2', 'twoByTwoFirstLayer',
    'coll', 'cmll', 'wv', 'extraPuzzles', 'customEvents', 'stackmatG5',
    'virtualKeyboard', 'quickSetup', 'metronome', 'ohSettings', 'cstimerImport', 'cubeastImport'
  ]) {
    assert.ok(expPanelSlice.includes(`data-experimental-feature="${fid}"`), `Missing experimental checkbox ${fid}`);
  }
  assert.ok(!expPanelSlice.includes('beta-sup'), 'Experimental tab omits β superscript');
  const settingsNavMatches = html.match(/class="settings-nav-btn[\s\S]*?<\/button>/g) || [];
  assert.strictEqual(settingsNavMatches.length, 8);
  for (const btnHtml of settingsNavMatches) {
    assert.ok(btnHtml.includes('class="settings-nav-icon"'));
    assert.ok(btnHtml.includes('class="settings-nav-label"'));
  }
  assert.ok(html.includes('id="settingsMetronomeSection" class="settings-section" hidden'));
  assert.ok(html.includes('id="settingsOhSection" class="settings-section" hidden'));
  assert.ok(html.includes('id="devicesTabKeyboard"') && html.includes('aria-controls="devicesPanelKeyboard" hidden'));
  for (const pid of ['pyram', 'skewb', 'minx', 'sq1', 'clock', '333bf', '666', '777', 'fto']) {
    assert.match(html, new RegExp(`data-puzzle="${pid}"[^>]*>[^<]*<sup class="beta-sup"[^>]*>β</sup>`));
  }

  // Footer omits GitHub link
  const footerMatch = html.match(/<footer class="app-legal-footer"[\s\S]*?<\/footer>/);
  assert.ok(footerMatch);
  assert.ok(footerMatch[0].includes('id="aboutModalBtn"'));
  assert.ok(!footerMatch[0].includes('github.com'), 'Footer omits GitHub link');
  assert.ok(footerMatch[0].includes('&copy; 2026 Cubing.cc'));

  // About modal highlights benefits only, omits jperm/csTimer & privacy/terms buttons, keeps only inline GitHub link
  const aboutStart = html.indexOf('id="aboutModal"');
  const aboutEnd = html.indexOf('id="onboardingModal"');
  const aboutSlice = html.slice(aboutStart, aboutEnd);
  assert.ok(!/jperm/i.test(aboutSlice));
  assert.ok(!/cstimer/i.test(aboutSlice));
  assert.ok(!aboutSlice.includes('/privacy'));
  assert.ok(!aboutSlice.includes('/terms'));
  assert.ok(!aboutSlice.includes('about-links-row'));
  assert.ok(aboutSlice.includes('https://github.com/KingJoshi/cll-recog-trainer'));
  assert.ok(aboutSlice.includes('GNU GPL v3.0'));

  // Help dialog removed in favor of standalone Help/Notation page + Quick Setup Wizard
  assert.ok(!html.includes('id="helpModal"'));
});

test('AppStore & syncMerge handle Train->Simulate and 4-tier F2L modes', () => {
  assert.ok(VALID_TRAIN_SUBMODES.includes('simulate'));
  assert.strictEqual(sanitizeTrainSubMode('simulate'), 'simulate');
  assert.deepStrictEqual(VALID_F2L_MODES, ['essential', 'basic', 'intermediate', 'advanced']);
  assert.strictEqual(sanitizeF2lMode('invalid'), 'basic');
  assert.strictEqual(sanitizeF2lMode('essential'), 'essential');
  assert.strictEqual(sanitizeF2lMode('intermediate'), 'intermediate');
  assert.strictEqual(sanitizeF2lMode('advanced'), 'advanced');

  assert.strictEqual(isSimulateViewMode({ mode: 'practice', trainSubMode: 'simulate' }), true);
  assert.strictEqual(isSimulateViewMode({ mode: 'simulate', trainSubMode: 'recog' }), true);
  assert.strictEqual(isSimulateViewMode({ mode: 'practice', trainSubMode: 'recog' }), false);
  assert.strictEqual(isSimulateViewMode({ mode: 'solve', trainSubMode: 'simulate' }), false);

  assert.match(readText('src/services/syncMerge.js'), /"f2lMode"/);
  appStore.setF2lMode('intermediate');
  assert.strictEqual(appStore.state.f2lMode, 'intermediate');
  const { merged } = mergeSyncPayloads(
    { schemaVersion: 2, settings: { f2lMode: 'basic' }, updatedAt: 1000, sessions: [] },
    { schemaVersion: 2, settings: { f2lMode: 'advanced' }, updatedAt: 2000, sessions: [] }
  );
  assert.strictEqual(merged.settings.f2lMode, 'advanced');
  appStore.setF2lMode('basic');

  // Experimental features individual gating, Check All / Remove All, legacy migration & LWW sync
  assert.strictEqual(isBetaTrack('222', 'eg1'), true);
  assert.strictEqual(isBetaTrack('222', 'eg2'), true);
  assert.strictEqual(isBetaTrack('222', 'cll'), false);
  assert.strictEqual(isBetaPuzzle('333'), false);
  assert.strictEqual(isBetaPuzzle('222'), false);
  assert.strictEqual(isBetaPuzzle('666'), true);
  assert.strictEqual(isBetaPuzzle('pyram'), true);

  assert.strictEqual(appStore.state.betaFeatures, false);
  appStore.setExperimentalFeature('eg1', true);
  assert.strictEqual(isExperimentalEnabled(appStore.state, 'eg1'), true);
  assert.strictEqual(isExperimentalEnabled(appStore.state, 'eg2'), false);
  assert.strictEqual(isTrackEnabled(appStore.state, '222', 'eg1'), true);
  assert.strictEqual(isTrackEnabled(appStore.state, '222', 'eg2'), false);
  assert.strictEqual(isPuzzleEnabled(appStore.state, '666'), false);
  assert.strictEqual(appStore.state.betaFeatures, true);

  appStore.setAllExperimentalFeatures(true);
  for (const id of EXPERIMENTAL_FEATURE_IDS) {
    assert.strictEqual(isExperimentalEnabled(appStore.state, id), true);
  }
  assert.strictEqual(isPuzzleEnabled(appStore.state, '666'), true);
  assert.strictEqual(isPuzzleEnabled(appStore.state, 'custom_relay'), true);

  appStore.setAllExperimentalFeatures(false);
  assert.strictEqual(appStore.state.betaFeatures, false);
  for (const id of EXPERIMENTAL_FEATURE_IDS) {
    assert.strictEqual(isExperimentalEnabled(appStore.state, id), false);
  }

  const migrated = sanitizeExperimentalFeatures(null, true);
  for (const id of EXPERIMENTAL_FEATURE_IDS) {
    assert.strictEqual(migrated[id], true);
  }

  const { merged: betaMerged } = mergeSyncPayloads(
    {
      schemaVersion: 2,
      settings: { betaFeatures: false, experimentalFeatures: { eg1: false, eg2: false } },
      updatedAt: 1000,
      sessions: []
    },
    {
      schemaVersion: 2,
      settings: { betaFeatures: true, experimentalFeatures: { eg1: true, eg2: false, stackmatG5: true } },
      updatedAt: 2000,
      sessions: []
    }
  );
  assert.strictEqual(betaMerged.settings.betaFeatures, true);
  assert.strictEqual(betaMerged.settings.experimentalFeatures.eg1, true);
  assert.strictEqual(betaMerged.settings.experimentalFeatures.stackmatG5, true);
  assert.strictEqual(betaMerged.settings.experimentalFeatures.eg2, false);

  // Per-key merge & Check All persistence: older remote missing recent keys must NOT clear them
  const { merged: olderRemoteMerged } = mergeSyncPayloads(
    {
      schemaVersion: 2,
      settings: {
        betaFeatures: true,
        experimentalAllEnabled: true,
        experimentalFeatures: { eg1: true, eg2: true, futureFeatureA: true, futureFeatureB: true }
      },
      timestamps: { settings: { experimentalFeatures: 1000, experimentalAllEnabled: 1000 } },
      updatedAt: 1000,
      sessions: []
    },
    {
      schemaVersion: 2,
      settings: {
        betaFeatures: true,
        experimentalFeatures: { eg1: true, eg2: true }
      },
      timestamps: { settings: { experimentalFeatures: 5000 } },
      updatedAt: 5000,
      sessions: []
    }
  );
  assert.strictEqual(olderRemoteMerged.settings.experimentalFeatures.futureFeatureA, true);
  assert.strictEqual(olderRemoteMerged.settings.experimentalFeatures.futureFeatureB, true);
  assert.strictEqual(olderRemoteMerged.settings.experimentalAllEnabled, true);

  // Explicit false in both clients still syncs via LWW
  const { merged: explicitDisableMerged } = mergeSyncPayloads(
    {
      schemaVersion: 2,
      settings: { experimentalFeatures: { eg1: true, coll: true } },
      timestamps: { settings: { experimentalFeatures: 1000 } },
      updatedAt: 1000,
      sessions: []
    },
    {
      schemaVersion: 2,
      settings: { experimentalFeatures: { eg1: true, coll: false } },
      timestamps: { settings: { experimentalFeatures: 2000 } },
      updatedAt: 2000,
      sessions: []
    }
  );
  assert.strictEqual(explicitDisableMerged.settings.experimentalFeatures.coll, false);

  // Check All inference & unknown future key preservation in sanitizeExperimentalFeatures
  const preservedFuture = sanitizeExperimentalFeatures({ eg1: true, futureFeatureX: true }, false, false);
  assert.strictEqual(preservedFuture.futureFeatureX, true);
  assert.strictEqual(preservedFuture.coll, false);

  const inferredAll = sanitizeExperimentalFeatures({ eg1: true, eg2: true, stackmatG5: true, coll: true }, true);
  assert.strictEqual(inferredAll.cmll, true);
  assert.strictEqual(inferredAll.wv, true);

  appStore.setAllExperimentalFeatures(true);
  assert.strictEqual(appStore.state.experimentalAllEnabled, true);
  appStore.setExperimentalFeature('coll', false);
  assert.strictEqual(appStore.state.experimentalAllEnabled, false);

  appStore.setBetaFeatures(false);
});

test('Extended F2L curriculum, Sledge/Hedge algs, and Essential mirror pairs verify cleanly on 3x3 KPuzzle', async () => {
  assert.strictEqual(ESSENTIAL_F2L_IDS.size, 21);
  for (const id of ESSENTIAL_F2L_IDS) {
    assert.ok(f2lCases.some(c => c.id === id), `Missing essential F2L id ${id}`);
  }
  assert.strictEqual(Object.keys(ESSENTIAL_F2L_MIRROR_MAP).length, 20);
  const covered = new Set([...Object.keys(ESSENTIAL_F2L_MIRROR_MAP), ...Object.values(ESSENTIAL_F2L_MIRROR_MAP), 'f2l-37']);
  assert.strictEqual(covered.size, 41, '20 mirror pairs + f2l-37 cover all 41 Basic F2L cases');
  assert.strictEqual(getEssentialMirrorPartnerId('f2l-01'), 'f2l-02');
  assert.strictEqual(getEssentialMirrorPartnerId('f2l-02'), 'f2l-01');
  assert.strictEqual(getEssentialMirrorPartnerId('f2l-37'), null);

  // Check Sledge & Hedge are included on F2L basic/essential cases
  assert.ok(f2lCases.find(c => c.id === 'f2l-01').algs.some(a => a.alg === "R' F R F'"));
  assert.ok(f2lCases.find(c => c.id === 'f2l-02').algs.some(a => a.alg === "F R' F' R"));

  assert.strictEqual(f2lIntermediateCases.length, 16);
  assert.strictEqual(f2lAdvancedCases.length, 14);
  assert.strictEqual(F2L_INTERMEDIATE_GROUPS.length, 3);
  assert.strictEqual(F2L_ADVANCED_GROUPS.length, 2);

  const kpuzzle = await puzzles['3x3x3'].kpuzzle();
  const solved = kpuzzle.defaultPattern();

  for (const c of [...f2lIntermediateCases, ...f2lAdvancedCases]) {
    assert.ok(c.setup, `${c.id} missing setup`);
    assert.ok(Array.isArray(c.algs) && c.algs.length >= 1, `${c.id} missing algs`);
    assert.ok(Number.isFinite(c.cameraLongitude), `${c.id} missing cameraLongitude`);
    for (const a of c.algs) {
      const after = solved.applyAlg(c.setup).applyAlg(a.alg);
      for (const ci of [4, 5, 6, 7]) {
        assert.strictEqual(after.patternData.CORNERS.pieces[ci], ci, `${c.id} ${a.id} corner ${ci} unsolved`);
        assert.strictEqual(after.patternData.CORNERS.orientation[ci], 0, `${c.id} ${a.id} corner ${ci} twisted`);
      }
      for (const ei of [4, 5, 6, 7, 8, 9, 10, 11]) {
        assert.strictEqual(after.patternData.EDGES.pieces[ei], ei, `${c.id} ${a.id} edge ${ei} unsolved`);
        assert.strictEqual(after.patternData.EDGES.orientation[ei], 0, `${c.id} ${a.id} edge ${ei} flipped`);
      }
      for (const si of [0, 1, 2, 3, 4, 5]) {
        assert.strictEqual(after.patternData.CENTERS.pieces[si], si, `${c.id} ${a.id} center ${si} moved`);
      }
    }
  }
});

test('StudyView renders 4 F2L tiers, White bottom default in Learn, and Essential mirror flip cards', () => {
  let f2lMode = 'essential';
  const container = createMockContainer();
  const sv = new StudyView({
    container,
    // Even if user uses CN/dual bottom in Solve/Train, Learn always keeps White on bottom
    getAlwaysWhiteBottom: () => false,
    getF2lMode: () => f2lMode,
    onSetF2lMode: (next) => { f2lMode = next; }
  });

  // Essential (21) with Flip buttons & White-on-bottom z2 setup
  sv.setTrack('333', 'f2l');
  sv.setView('grid');
  assert.ok(container.innerHTML.includes('Essential (21)'));
  assert.ok(container.innerHTML.includes('Basic (41)'));
  assert.ok(container.innerHTML.includes('Intermediate (16)'));
  assert.ok(container.innerHTML.includes('Advanced (14)'));
  assert.ok(container.innerHTML.includes('Case Grid (21)'));
  assert.strictEqual((container.innerHTML.match(/study-f2l-card-3d/g) || []).length, 21);
  assert.strictEqual((container.innerHTML.match(/btn-f2l-flip/g) || []).length, 20, '20 paired Essential cards get a Flip button');
  assert.ok(container.innerHTML.includes('data-twosided-setup="z2 '), 'Learn F2L defaults to White on bottom (z2)');

  // Flip f2l-01 -> displays f2l-02 mirror + Hedgeslammer F R' F' R + Mirrored pill
  sv.flippedEssentialIds.add('f2l-01');
  sv.render();
  assert.ok(container.innerHTML.includes('Mirrored'));
  assert.ok(container.innerHTML.includes('data-twosided-case-id="f2l-02"'));
  assert.ok(container.innerHTML.includes('F2L-02'));
  assert.ok(container.innerHTML.includes("y&#039; U&#039; R&#039; U R"));

  // Detail view for flipped mirror shows Flip Mirror button
  sv.selectedCaseId = 'f2l-02';
  sv.setView('hybrid', { keepSelected: true });
  assert.ok(container.innerHTML.includes('id="studyFlipMirrorBtn"'));
  assert.ok(container.innerHTML.includes("F R&#039; F&#039; R"));
  assert.ok(!container.innerHTML.includes('id="studyDetailDiagram"'), 'F2L detail omits flat 2D diagram');

  // Basic (41), Intermediate (16), Advanced (14)
  f2lMode = 'basic';
  sv.setView('grid');
  assert.strictEqual((container.innerHTML.match(/study-f2l-card-3d/g) || []).length, 41);

  f2lMode = 'intermediate';
  sv.render();
  assert.strictEqual((container.innerHTML.match(/study-f2l-card-3d/g) || []).length, 16);
  assert.ok(container.innerHTML.includes('data-camera-longitude="135"'));

  f2lMode = 'advanced';
  sv.render();
  assert.strictEqual((container.innerHTML.match(/study-f2l-card-3d/g) || []).length, 14);
  assert.ok(container.innerHTML.includes('Force Yellow Cross (Partial Edge Control)'));

  // PLL detail preserves 2D diagram
  sv.setTrack('333', 'pll');
  sv.setView('hybrid');
  assert.ok(container.innerHTML.includes('id="studyDetailDiagram"'));
});

test('Newly experimental tracks/sections, 1st Face 3D cards, and 2x2 Inspection bottom picker & reveal toggle work', async () => {
  assert.strictEqual(getTrackExperimentalFeature('222', 'layer'), 'twoByTwoFirstLayer');
  assert.strictEqual(getTrackExperimentalFeature('333', 'coll'), 'coll');
  assert.strictEqual(getTrackExperimentalFeature('333', 'cmll'), 'cmll');
  assert.strictEqual(getTrackExperimentalFeature('333', 'wv'), 'wv');
  assert.strictEqual(getFallbackTrackForPuzzle('222'), 'cll');
  assert.strictEqual(getFallbackTrackForPuzzle('333'), 'pll');
  assert.strictEqual(getFallbackTrackForPuzzle('333oh'), 'pll');

  assert.strictEqual(isTrackEnabled(appStore.state, '333', 'coll'), false);
  appStore.setExperimentalFeature('coll', true);
  assert.strictEqual(isTrackEnabled(appStore.state, '333', 'coll'), true);
  assert.strictEqual(isTrackEnabled(appStore.state, '333', 'cmll'), false);
  appStore.setExperimentalFeature('coll', false);

  const ffHtml = renderFirstFaceStudyHtml();
  assert.strictEqual((ffHtml.match(/class="ff-example-3d-wrap"/g) || []).length, 6);
  assert.strictEqual((ffHtml.match(/class="btn btn-xs btn-primary ff-card-play-btn"/g) || []).length, 6);

  // PracticeView 2x2 1st Face / 1st Layer shows bottom color picker, scramble, and reveal/hide toggle
  const listenersBySelector = new Map();
  const pvContainer = {
    innerHTML: '',
    querySelector(sel) {
      if (!sel.startsWith('#')) return null;
      const id = sel.slice(1);
      if (!this.innerHTML.includes(`id="${id}"`)) return null;
      const btn = listenersBySelector.get(sel) || {
        dataset: {},
        addEventListener(evt, fn) {
          this._handlers = this._handlers || {};
          this._handlers[evt] = fn;
        },
        click() {
          this._handlers?.click?.({ stopPropagation() {}, preventDefault() {} });
        }
      };
      listenersBySelector.set(sel, btn);
      return btn;
    },
    querySelectorAll() {
      return [];
    }
  };

  let layerFaces = ['white'];
  const pv = new PracticeView({
    container: pvContainer,
    onGenerateScramble: async () => "R U' F2",
    getLayerTargetFaces: () => layerFaces,
    onSetLayerTargetFaces: (next) => { layerFaces = next; }
  });

  await pv.setTrack('222', 'face');
  assert.ok(pvContainer.innerHTML.includes('data-bottom-face="white"'));
  assert.ok(pvContainer.innerHTML.includes(`class="inspection-scramble-code">R U' F2</code>`));
  assert.ok(pvContainer.innerHTML.includes('Reveal Optimal Solutions'));

  await pv.revealInspectionSolutions();
  assert.strictEqual(pv.solutionRevealed, true);
  assert.ok(pvContainer.innerHTML.includes('Hide Solutions'));
  assert.ok(!pvContainer.innerHTML.includes('id="revealSolutionsBtn" class="btn btn-small active" disabled'));

  pvContainer.querySelector('#revealSolutionsBtn').click();
  assert.strictEqual(pv.solutionRevealed, false);
  assert.ok(pvContainer.innerHTML.includes('Reveal Optimal Solutions'));
});
