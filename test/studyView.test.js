import test from 'node:test';
import assert from 'node:assert';
import { StudyView } from '../src/studyView.js';
import { getTrack, setPreferredAlg, getPreferredAlg } from '../src/data/algRegistry.js';

function createMockContainer() {
  return {
    innerHTML: '',
    querySelectorAll() { return []; },
    querySelector() { return null; }
  };
}

test('StudyView isolates 333 and 333oh preferred algorithms and escapes custom labels', () => {
  const store = {};
  const prevStorage = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; }
  };

  try {
    const track333 = getTrack('333', 'pll');
    const tCase = track333.caseById.get('T');
    assert.ok(tCase && tCase.algs.length >= 2);
    const alg0 = tCase.algs[0].id;
    const alg1 = tCase.algs[1].id;

    setPreferredAlg('T', alg0, '333');
    setPreferredAlg('T', alg1, '333oh');

    assert.strictEqual(getPreferredAlg('T', alg0, '333'), alg0);
    assert.strictEqual(getPreferredAlg('T', alg0, '333oh'), alg1);

    const sv = new StudyView({
      container: createMockContainer(),
      getAlgCustomLabel: (_c, a) => (a.id === alg1 ? '<script>alert(1)</script> (OH)' : ''),
      onEditLabel: () => {}
    });
    sv.currentPuzzle = '333oh';
    sv.currentTrackId = 'pll';
    sv.selectedCaseId = 'T';

    const detailHtml = sv.renderDetailView(track333);
    assert.ok(detailHtml.includes('&lt;script&gt;alert(1)&lt;/script&gt; (OH)'));
    assert.ok(!detailHtml.includes('<script>alert(1)</script>'));
    assert.ok(detailHtml.includes('btn-alg-label'));
  } finally {
    globalThis.localStorage = prevStorage;
  }
});

test('StudyView folds all 5 guide cards into 222 Reference Guide and supports 333oh cross guide', () => {
  const sv = new StudyView({ container: createMockContainer() });
  const expectedGuideHeadings = [
    'Move Count Benchmarks',
    'Full Color Neutrality',
    '15-Second WCA Inspection Routine',
    'Bar Preservation vs. Direct Insertion',
    'Face vs. Layer (The Ortega Transition)'
  ];

  for (const trackId of ['cll', 'ortega', 'layer']) {
    sv.currentPuzzle = '222';
    sv.currentTrackId = trackId;
    const html = sv.renderGuideView(getTrack('222', trackId));
    for (const heading of expectedGuideHeadings) {
      assert.ok(html.includes(heading), `Expected "${heading}" in 222/${trackId} guide`);
    }
  }

  sv.currentPuzzle = '333oh';
  sv.currentTrackId = 'cross';
  const ohCrossHtml = sv.renderGuideView(getTrack('333oh', 'cross'));
  assert.ok(ohCrossHtml.includes('WCA 15-Second Inspection for Cross'));
});

test('StudyView.deactivate tears down 3D display and invalidates _renderToken', () => {
  const sv = new StudyView({ container: createMockContainer() });
  let removed = false;
  sv.activeDisplay3d = { remove() { removed = true; } };
  const beforeToken = sv._renderToken;

  sv.deactivate();

  assert.strictEqual(removed, true);
  assert.strictEqual(sv.activeDisplay3d, null);
  assert.strictEqual(sv._renderToken, beforeToken + 1);
});

test('StudyView renders dedicated 2x2 1st Face, 1st Layer Bottom-Piece Case Groups, and Right-Hand 3x3 OH options', () => {
  const container = createMockContainer();
  const sv = new StudyView({
    container,
    getOhHand: () => 'right'
  });

  // 1. 2x2 1st Face dedicated study view
  sv.setTrack('222', 'face');
  assert.ok(container.innerHTML.includes('1st Face vs. 1st Layer'));
  assert.ok(container.innerHTML.includes('ff-sim-btn'));

  // 2. 2x2 1st Layer: default Cases Grid & Quiz (123) across the 4 disjoint bottom-piece groups
  sv.setTrack('222', 'layer');
  assert.ok(container.innerHTML.includes('1st Layer (123 Cases by Bottom Pieces)'));
  assert.ok(container.innerHTML.includes('Cases Grid &amp; Quiz (123)'));
  assert.ok(container.innerHTML.includes('Case Explorer (3D + 2D)'));
  assert.ok(container.innerHTML.includes('Recognition &amp; 2-Look Guide'));
  assert.ok(!container.innerHTML.includes('All Bar System (75)'));
  assert.ok(!container.innerHTML.includes('Bar-on-Left Explorer (75)'));

  assert.ok(container.innerHTML.includes('1 in Bottom (9)'));
  assert.ok(container.innerHTML.includes('2 Bottom: Bar (70)'));
  assert.ok(container.innerHTML.includes('2 Bottom: Diagonal (39)'));
  assert.ok(container.innerHTML.includes('3 in Bottom (5)'));
  assert.ok(container.innerHTML.includes('All (70)'));
  assert.ok(container.innerHTML.includes('flb-case-grid'));
  assert.ok(container.innerHTML.includes('flb-card-3d-live'));
  assert.ok(container.innerHTML.includes('data-card-id="flb-01"'));
  assert.ok(!container.innerHTML.includes('data-card-3d-id'));
  assert.ok(container.innerHTML.includes('flb-card-alg-opt'));
  assert.ok(container.innerHTML.includes('data-alg-mode="trigger"'));
  assert.ok(container.innerHTML.includes('flb-card-reset-3d-btn'));
  assert.ok(container.innerHTML.includes('flb-card-play-btn'));
  assert.ok(container.innerHTML.includes('flb-card-next-btn'));
  assert.ok(container.innerHTML.includes('flb-icon-legend'));
  assert.ok(!container.innerHTML.includes('Explore 3D'));
  assert.ok(container.innerHTML.includes('Quiz Mode (Hide Algs)'));

  sv.firstLayerExplorerState.quizLayout = 'list';
  sv.render();
  assert.ok(container.innerHTML.includes('flb-list-alt-btn'));
  assert.ok(container.innerHTML.includes('data-sim-mode="trigger"'));
  sv.firstLayerExplorerState.quizLayout = 'grid';

  sv.firstLayerExplorerState.quizGroup = 'one-bottom';
  sv.render();
  assert.ok(container.innerHTML.includes('9 cases'));
  assert.ok(container.innerHTML.includes('1B-1'));
  assert.ok(container.innerHTML.includes('flb-step-hint-mini'));

  sv.firstLayerExplorerState.quizGroup = 'two-diag';
  sv.render();
  assert.ok(container.innerHTML.includes('39 cases'));
  assert.ok(container.innerHTML.includes('D-1'));
  assert.ok(container.innerHTML.includes('All 4 solved &rarr; CLL'));

  sv.firstLayerExplorerState.subTab = 'explorer';
  sv.render();
  assert.ok(container.innerHTML.includes('flbDetail3dWrap'));
  assert.ok(container.innerHTML.includes('TOP LAYER (U)'));
  assert.ok(container.innerHTML.includes('R-FACE VIEW'));

  sv.firstLayerExplorerState.subTab = 'guide';
  sv.render();
  assert.ok(container.innerHTML.includes('FRONT RIM BAR'));
  assert.ok(container.innerHTML.includes('TOP RIM BAR'));
  assert.ok(container.innerHTML.includes('BACK RIM BAR'));
  assert.ok(container.innerHTML.includes('1st Layer Case Breakdown (123 Cases)'));

  // 3. 3x3 OH Right-Hand switcher + synthesized RH Mirror / z' algs on Ua
  sv.setTrack('333oh', 'pll');
  sv.selectedCaseId = 'Ua';
  const track333oh = getTrack('333oh', 'pll');
  const htmlDetail = sv.renderDetailView(track333oh);
  assert.ok(htmlDetail.includes('RH Mirror'));
  assert.ok(htmlDetail.includes('RH z&#039;') || htmlDetail.includes("RH z'"));
  assert.ok(container.innerHTML.includes('Right Hand (Mirror'));
});

test('StudyView renders inline mini 3D playback controls and syncs playback pace pill', () => {
  const speedBtnMock = { textContent: '1x', attrs: {}, setAttribute(k, v) { this.attrs[k] = v; } };
  const playBtnMock = {
    innerHTML: '',
    dataset: {},
    disabled: false,
    attrs: {},
    classes: new Set(),
    classList: {
      toggle(c, force) { if (force) playBtnMock.classes.add(c); else playBtnMock.classes.delete(c); },
      contains(c) { return playBtnMock.classes.has(c); }
    },
    setAttribute(k, v) { this.attrs[k] = v; }
  };
  const statusMock = { textContent: '' };
  const bySel = {
    '#studyMiniSpeedBtn': speedBtnMock,
    '#studyMiniPlayBtn': playBtnMock,
    '#studyMiniStepStatus': statusMock
  };
  const container = {
    innerHTML: '',
    querySelectorAll() { return []; },
    querySelector(sel) { return bySel[sel] || null; }
  };
  let savedSpeed = 1;
  const sv = new StudyView({
    container,
    getSimSpeed: () => savedSpeed,
    onSetSimSpeed: spd => { savedSpeed = spd; }
  });
  sv.currentPuzzle = '222';
  sv.currentTrackId = 'cll';
  sv.selectedCaseId = 'T1';
  const html = sv.renderDetailView(getTrack('222', 'cll'));

  for (const id of [
    'studyMiniStartBtn',
    'studyMiniPrevBtn',
    'studyMiniPlayBtn',
    'studyMiniNextBtn',
    'studyMiniEndBtn',
    'studyMiniSpeedBtn',
    'studyMiniStepStatus'
  ]) {
    assert.ok(html.includes(id), `Expected inline playback element #${id} in detail view`);
  }
  assert.ok(html.includes('study-mini-sim-bar'));

  sv.activeDisplay3d = { player: { tempoScale: 1 } };
  sv.syncPlaybackSpeed(0.5);
  assert.strictEqual(sv.activeDisplay3d.player.tempoScale, 0.5);
  assert.strictEqual(speedBtnMock.textContent, '0.5x');
  assert.strictEqual(speedBtnMock.attrs['aria-label'], 'Playback pace 0.5x');

  // Verify play button stays in sync with distinct icons/states when jumping to end and back to start
  sv._miniSetupCount = 2;
  sv._miniAlgMoves = ['R', 'U'];
  sv._miniCombinedMoves = ['z2', 'F', 'R', 'U'];
  sv._updateMiniProgress(4);
  assert.strictEqual(playBtnMock.dataset.playState, 'replay');
  assert.strictEqual(playBtnMock.attrs['aria-label'], 'Replay algorithm');
  assert.strictEqual(statusMock.textContent, 'Solved! · 2 / 2 moves');
  sv._updateMiniProgress(2);
  assert.strictEqual(playBtnMock.dataset.playState, 'play');
  assert.strictEqual(playBtnMock.attrs['aria-label'], 'Play algorithm');
  assert.strictEqual(statusMock.textContent, 'Ready · 2 moves');
});

test('StudyView replaces Detail (3D) and raw triangle glyphs with consistent Algs + Sim SVG popup triggers across all puzzles', () => {
  const container = createMockContainer();
  const sv = new StudyView({
    container,
    getOhHand: () => 'right',
    onEditLabel: () => {}
  });

  const tracksToCheck = [
    ['222', 'cll'],
    ['333', 'f2l'],
    ['333oh', 'oll'],
    ['333oh', 'pll'],
    ['444', 'parity'],
    ['555', 'parity']
  ];

  for (const [puz, tid] of tracksToCheck) {
    sv.currentPuzzle = puz;
    sv.currentTrackId = tid;
    const tr = getTrack(puz, tid);
    const gridHtml = sv.renderGridView(tr);
    assert.ok(!gridHtml.includes('Detail (3D)'), `Stale Detail (3D) found in ${puz}/${tid} grid`);
    assert.ok(!gridHtml.includes('&#x25B6;'), `Raw &#x25B6; found in ${puz}/${tid} grid`);
    assert.ok(gridHtml.includes('btn-study-view') && gridHtml.includes('<span>Algs</span>'));
    assert.ok(gridHtml.includes('btn-study-sim') && gridHtml.includes('<span>Sim</span>'));
    assert.ok(gridHtml.includes('ui-icon'));
    assert.ok(gridHtml.includes('data-tooltip='));
  }

  sv.currentPuzzle = '333oh';
  sv.currentTrackId = 'pll';
  const ohPllTrack = getTrack('333oh', 'pll');
  const twoSidedHtml = sv.renderTwoSidedView(ohPllTrack);
  assert.ok(!twoSidedHtml.includes('Detail (3D)'));
  assert.ok(twoSidedHtml.includes('btn-study-view') && twoSidedHtml.includes('<span>Algs</span>'));
  assert.ok(twoSidedHtml.includes('btn-study-sim') && twoSidedHtml.includes('<span>Sim</span>'));

  sv.selectedCaseId = 'Ua';
  const detailHtml = sv.renderDetailView(ohPllTrack);
  assert.ok(!detailHtml.includes('Full Simulator'));
  assert.ok(!detailHtml.includes('&#x25B6;'));
  assert.ok(detailHtml.includes('id="studySimulateThisBtn"') && detailHtml.includes('<span>Popup Sim</span>'));
  assert.ok(detailHtml.includes('btn-alg-sim') && detailHtml.includes('<span>Sim</span>'));
});

test('StudyView.openCaseQuickSim opens in-place popup payload with OH variants, 4x4 z2 setup, and Open in Full Simulator hook', () => {
  const quickPayloads = [];
  const fullSimCalls = [];
  const sv = new StudyView({
    container: createMockContainer(),
    getOhHand: () => 'right',
    getAlwaysWhiteBottom: () => true,
    onQuickSimSolutions: (p) => quickPayloads.push(p),
    onSimulateCase: (c, a) => fullSimCalls.push({ c, a })
  });

  sv.currentPuzzle = '333oh';
  sv.currentTrackId = 'pll';
  const ohPll = getTrack('333oh', 'pll');
  const uaCase = ohPll.caseById.get('Ua');
  sv.openCaseQuickSim(ohPll, uaCase);

  assert.strictEqual(quickPayloads.length, 1);
  assert.strictEqual(fullSimCalls.length, 0);
  const pl = quickPayloads[0];
  assert.strictEqual(pl.puzzle, '333oh');
  assert.ok(pl.title.includes('Ua') && pl.title.includes('Right OH'));
  assert.ok(pl.solutions.some(s => s.ohBadge === 'RH Mirror'));
  assert.ok(pl.solutions.some(s => s.ohBadge === "RH z'"));
  assert.ok(pl.solutions[0].scramble.startsWith('z2 '));
  assert.strictEqual(typeof pl.onOpenFullSim, 'function');

  // Calling "Open in Full Simulator" forwards the active variant cleanly
  pl.onOpenFullSim({}, pl.solutions[1], 1);
  assert.strictEqual(fullSimCalls.length, 1);
  assert.strictEqual(fullSimCalls[0].a.id, pl.solutions[1]._algObj.id);

  // 4x4 Parity also preserves z2 when alwaysWhiteBottom=true and selects requested variant index
  sv.currentPuzzle = '444';
  sv.currentTrackId = 'parity';
  const p444 = getTrack('444', 'parity');
  const ollP = p444.caseById.get('444-oll-parity');
  sv.openCaseQuickSim(p444, ollP, '444-oll-alt');
  assert.strictEqual(quickPayloads.length, 2);
  assert.strictEqual(quickPayloads[1].activeIndex, 1);
  assert.ok(quickPayloads[1].solutions[1].scramble.startsWith('z2 '));
});

test('StudyView renders compact header variant pills, omits redundant CLL names, and exposes proportional group counts & visual strip', () => {
  const sv = new StudyView({ container: createMockContainer() });
  sv.currentPuzzle = '222';
  sv.currentTrackId = 'cll';
  const cllTrack = getTrack('222', 'cll');

  const gridHtml = sv.renderGridView(cllTrack);
  assert.ok(!gridHtml.includes('CLL H1 (H-Group)'));
  assert.ok(!gridHtml.includes('study-card-algs-count'));
  assert.ok(gridHtml.includes('study-card-head-meta'));
  assert.ok(gridHtml.includes('study-card-algs-pill'));
  assert.ok(gridHtml.includes('--group-count: 4'));
  assert.ok(gridHtml.includes('--group-count: 6'));

  sv.selectedCaseId = 'T1';
  const detailHtml = sv.renderDetailView(cllTrack);
  assert.ok(detailHtml.includes('study-visual-top-strip'));
});

test('StudyView renders 3x3 OH Table Abuse / No Table Abuse switcher, updates H-Perm & OLL-36, and isolates preferred algs', () => {
  const store = {};
  const prevStorage = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; }
  };

  try {
    let hand = 'left';
    let useTable = false;
    const quickPayloads = [];
    const container = createMockContainer();
    const sv = new StudyView({
      container,
      getOhHand: () => hand,
      getOhTableAbuse: () => useTable,
      onQuickSimSolutions: (p) => quickPayloads.push(p)
    });

    sv.setTrack('333oh', 'pll');
    assert.ok(container.innerHTML.includes('data-oh-table="table"'));
    assert.ok(container.innerHTML.includes('data-oh-table="no-table"'));

    const pllTrack = getTrack('333oh', 'pll');
    const hCase = pllTrack.caseById.get('H');

    // Left + No Table Abuse -> 2-gen <R, U> H-Perm
    const leftNoTableAlgs = sv.getCaseAlgs(pllTrack, hCase);
    assert.strictEqual(leftNoTableAlgs[0].alg, 'R2 U2 R U2 R2 U2 R2 U2 R U2 R2');
    assert.strictEqual(sv.getPrefSubScope(), 'left:no-table');

    // Right + No Table Abuse -> mirrored <L, U> H-Perm
    hand = 'right';
    const rightNoTableAlgs = sv.getCaseAlgs(pllTrack, hCase);
    assert.strictEqual(rightNoTableAlgs[0].alg, "L2 U2 L' U2 L2 U2 L2 U2 L' U2 L2");
    assert.strictEqual(rightNoTableAlgs[0].ohBadge, 'RH No-Table');
    assert.strictEqual(sv.getPrefSubScope(), 'right:no-table');

    // Quick Sim payload reflects No Table mode
    sv.openCaseQuickSim(pllTrack, hCase);
    assert.strictEqual(quickPayloads.length, 1);
    assert.ok(quickPayloads[0].title.includes('Right OH') && quickPayloads[0].title.includes('No Table'));

    // Preferred algs stay isolated between Table Abuse ("left") and No Table Abuse ("left:no-table")
    hand = 'left';
    setPreferredAlg('H', 'h-oh-ru-2', '333oh', 'left:no-table');
    setPreferredAlg('H', 'h-2', '333oh', 'left');
    useTable = true;
    assert.strictEqual(sv.getPreferredAlgObj(pllTrack, hCase).preferredAlg.id, 'h-2');
    useTable = false;
    assert.strictEqual(sv.getPreferredAlgObj(pllTrack, hCase).preferredAlg.id, 'h-oh-ru-2');

    // OLL 36 No Table includes x'-rotated B rewrite
    sv.setTrack('333oh', 'oll');
    sv.selectedCaseId = 'oll-36';
    const ollDetail = sv.renderDetailView(getTrack('333oh', 'oll'));
    assert.ok(ollDetail.includes("x&#039;") || ollDetail.includes("x'"));
  } finally {
    globalThis.localStorage = prevStorage;
  }
});
