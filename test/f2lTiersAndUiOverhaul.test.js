import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { puzzles } from 'cubing/puzzles';

import { StudyView } from '../src/studyView.js';
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

  // Header actions are all consistent compact icon buttons without text labels
  const headerActionsMatch = html.match(/<div class="header-actions">[\s\S]*?<\/div>/);
  assert.ok(headerActionsMatch, 'Expected .header-actions');
  assert.ok(headerActionsMatch[0].includes('id="bluetoothBtn"'));
  assert.ok(!headerActionsMatch[0].includes('id="bluetoothHeaderLabel"'));
  assert.ok(!headerActionsMatch[0].includes('id="cloudSyncHeaderLabel"'));
  assert.ok(!headerActionsMatch[0].includes('id="ganTimerBtn"'));
  assert.match(headerActionsMatch[0], /id="onboardingBtn"[^>]*>\?<\/button>/);
  assert.match(headerActionsMatch[0], /id="themeToggleBtn"[^>]*>🌙<\/button>/);
  assert.match(headerActionsMatch[0], /id="settingsBtn"[^>]*>⚙️<\/button>/);

  // Unified Devices modal has Smart Cubes, Timers & Keyboard tabs with Virtual Cube in Keyboard
  const btModalStart = html.indexOf('id="bluetoothModal"');
  const btModalEnd = html.indexOf('id="solveReplayModal"');
  const btSlice = html.slice(btModalStart, btModalEnd);
  assert.ok(btSlice.includes('id="devicesTabCubes"'));
  assert.ok(btSlice.includes('id="devicesTabTimers"'));
  assert.ok(btSlice.includes('id="devicesTabKeyboard"'));
  assert.ok(btSlice.includes('id="devicesPanelKeyboard"'));
  const kbPanelIdx = btSlice.indexOf('id="devicesPanelKeyboard"');
  assert.ok(btSlice.indexOf('id="btVirtualBtn"') > kbPanelIdx, 'Virtual Keyboard Cube sits inside Keyboard tab');
  assert.ok(btSlice.indexOf('id="btVirtualKeypad"') > kbPanelIdx, 'Virtual Keypad sits inside Keyboard tab');
  assert.ok(btSlice.includes('id="ganTimerBtn"'));

  // Settings has separate Devices and Sync tabs (no combined Hardware & Sync)
  assert.ok(html.includes('data-settings-tab="devices"'));
  assert.ok(html.includes('data-settings-tab="sync"'));
  assert.ok(!html.includes('data-settings-tab="hardware"'));
  const devPanelStart = html.indexOf('data-settings-panel="devices"');
  const syncPanelStart = html.indexOf('data-settings-panel="sync"');
  assert.ok(devPanelStart > 0 && syncPanelStart > devPanelStart);
  assert.ok(html.indexOf('id="settingsResetBtBtn"') > devPanelStart && html.indexOf('id="settingsResetBtBtn"') < syncPanelStart);

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

  // Help modal
  assert.ok(html.includes('id="helpModal"'));
  assert.ok(html.includes('id="helpLaunchWizardBtn"'));
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
