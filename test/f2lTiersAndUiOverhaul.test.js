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

test('index.html has Learn|Train|Solve tabs, Simulate inside Train, unified Devices tabs, Help modal, About modal & footer', () => {
  const html = readText('index.html');

  // Top-level modes: Learn, Train, Solve only (no simulate button inside .mode-seg)
  const modeSegMatch = html.match(/<div class="seg mode-seg"[\s\S]*?<\/div>/);
  assert.ok(modeSegMatch, 'Expected .mode-seg');
  assert.ok(modeSegMatch[0].includes('data-mode="study"'));
  assert.ok(modeSegMatch[0].includes('data-mode="practice"'));
  assert.ok(modeSegMatch[0].includes('data-mode="solve"'));
  assert.ok(!modeSegMatch[0].includes('data-mode="simulate"'), 'Simulate should live inside Train subtabs, not top-level .mode-seg');

  // Simulate lives inside #trainSubmodeBar
  const trainBarMatch = html.match(/<div id="trainSubmodeBar"[\s\S]*?<\/div>/);
  assert.ok(trainBarMatch, 'Expected #trainSubmodeBar');
  assert.ok(trainBarMatch[0].includes('data-train-submode="simulate"'));

  // Compact header controls & unified Devices button
  const headerActionsMatch = html.match(/<div class="header-actions">[\s\S]*?<\/div>/);
  assert.ok(headerActionsMatch, 'Expected .header-actions');
  assert.ok(headerActionsMatch[0].includes('id="bluetoothBtn"'));
  assert.ok(headerActionsMatch[0].includes('Devices'));
  assert.ok(!headerActionsMatch[0].includes('id="ganTimerBtn"'), 'GAN Timer button moves inside Devices modal Timers tab');
  assert.ok(headerActionsMatch[0].includes('id="onboardingBtn"'));
  assert.match(headerActionsMatch[0], /id="onboardingBtn"[^>]*>\?<\/button>/);
  assert.match(headerActionsMatch[0], /id="themeToggleBtn"[^>]*>🌙<\/button>/);

  // Unified Devices modal has Smart Cubes & Timers tabs plus #ganTimerBtn
  const btModalStart = html.indexOf('id="bluetoothModal"');
  const btModalEnd = html.indexOf('id="solveReplayModal"');
  const btSlice = html.slice(btModalStart, btModalEnd);
  assert.ok(btSlice.includes('id="devicesTabCubes"'));
  assert.ok(btSlice.includes('id="devicesTabTimers"'));
  assert.ok(btSlice.includes('id="devicesPanelCubes"'));
  assert.ok(btSlice.includes('id="devicesPanelTimers"'));
  assert.ok(btSlice.includes('id="ganTimerBtn"'));

  // Footer About, Privacy, Terms, GitHub GPL-3.0, copyright
  const footerMatch = html.match(/<footer class="app-legal-footer"[\s\S]*?<\/footer>/);
  assert.ok(footerMatch);
  assert.ok(footerMatch[0].includes('id="aboutModalBtn"'));
  assert.ok(footerMatch[0].includes('https://github.com/KingJoshi/cll-recog-trainer'));
  assert.ok(footerMatch[0].includes('GPL-3.0'));
  assert.ok(footerMatch[0].includes('&copy; 2026 Cubing.cc'));

  // Help & About modals
  assert.ok(html.includes('id="helpModal"'));
  assert.ok(html.includes('id="helpLaunchWizardBtn"'));
  assert.ok(html.includes('id="aboutModal"'));
  assert.ok(html.includes('jperm.net'));
  assert.ok(html.includes('csTimer'));
  assert.ok(html.includes('GNU General Public License v3.0'));
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

test('Extended F2L curriculum cases are complete and mathematically preserve Cross & solve F2L', async () => {
  assert.strictEqual(ESSENTIAL_F2L_IDS.size, 21);
  for (const id of ESSENTIAL_F2L_IDS) {
    assert.ok(f2lCases.some(c => c.id === id), `Missing essential F2L id ${id}`);
  }
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

test('StudyView renders 4 F2L tiers, 3D F2L cards with slot camera angles, and hides flat 2D on F2L detail', () => {
  let f2lMode = 'essential';
  const container = createMockContainer();
  const sv = new StudyView({
    container,
    getAlwaysWhiteBottom: () => true,
    getF2lMode: () => f2lMode,
    onSetF2lMode: (next) => { f2lMode = next; }
  });

  // Essential (21)
  sv.setTrack('333', 'f2l');
  sv.setView('grid');
  assert.ok(container.innerHTML.includes('Essential (21)'));
  assert.ok(container.innerHTML.includes('Basic (41)'));
  assert.ok(container.innerHTML.includes('Intermediate (16)'));
  assert.ok(container.innerHTML.includes('Advanced (14)'));
  assert.ok(container.innerHTML.includes('Clipboard') || container.innerHTML.includes('Case Grid (21)'));
  assert.strictEqual((container.innerHTML.match(/study-f2l-card-3d/g) || []).length, 21);
  assert.ok(container.innerHTML.includes('left/right mirrors'), 'Essential should explain the remaining 20 are mirrors');
  assert.ok(!container.innerHTML.includes('id="studyCardVisual_'), 'F2L cards use 3D wraps rather than flat 2D SVG placeholders');

  // Basic (41)
  f2lMode = 'basic';
  sv.render();
  assert.ok(container.innerHTML.includes('Case Grid (41)'));
  assert.strictEqual((container.innerHTML.match(/study-f2l-card-3d/g) || []).length, 41);

  // Intermediate (16) with back-slot cameraLongitude (135 / -135)
  f2lMode = 'intermediate';
  sv.render();
  assert.ok(container.innerHTML.includes('Case Grid (16)'));
  assert.strictEqual((container.innerHTML.match(/study-f2l-card-3d/g) || []).length, 16);
  assert.ok(container.innerHTML.includes('data-camera-longitude="135"'));
  assert.ok(container.innerHTML.includes('data-camera-longitude="-135"'));
  assert.ok(container.innerHTML.includes('Back-Right (BR) Inserts'));

  // Advanced (14)
  f2lMode = 'advanced';
  sv.render();
  assert.ok(container.innerHTML.includes('Case Grid (14)'));
  assert.strictEqual((container.innerHTML.match(/study-f2l-card-3d/g) || []).length, 14);
  assert.ok(container.innerHTML.includes('Force Yellow Cross (Partial Edge Control)'));

  // Detail/Hybrid view omits flat top-down #studyDetailDiagram for F2L, preserves it for PLL
  sv.setView('hybrid');
  assert.ok(!container.innerHTML.includes('id="studyDetailDiagram"'), 'F2L detail omits flat 2D diagram in favor of 3D cube');
  assert.ok(container.innerHTML.includes('id="studyDetail3dWrap"'));

  sv.setTrack('333', 'pll');
  sv.setView('hybrid');
  assert.ok(container.innerHTML.includes('id="studyDetailDiagram"'), 'PLL detail preserves 2D recognition diagram');
});
