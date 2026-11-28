import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import { StudyView } from '../src/studyView.js';
import { getTrack, setPreferredAlg, getPreferredAlg } from '../src/data/algRegistry.js';
import { render444ParitySvg } from '../src/cube/caseSvgRenderer.js';
import { OLL_TWO_SIDED_GUIDE, PLL_TWO_SIDED_GUIDE } from '../src/data/twoSidedRecogData.js';
import { SPEFFZ_CORNERS, SPEFFZ_EDGES, renderSpeffzNetSvg } from '../src/features/study/bldGuideRenderer.js';

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

  // 0. 2x2 & 3x3 Beginner Tutorials (Guide + Walkthrough tabs)
  sv.setTrack('222', 'tutorial');
  assert.ok(container.innerHTML.includes('Beginner 2x2 Guide'));
  assert.ok(container.innerHTML.includes('data-tut-tab="guide"') && container.innerHTML.includes('data-tut-tab="walkthrough"'));
  assert.ok(container.innerHTML.includes('Righty'));
  assert.ok(container.innerHTML.includes('T-Perm'));
  assert.ok(!/Ortega|1st Face|\bsexy\b/i.test(container.innerHTML));
  sv.tutorialState.activeTab = 'walkthrough';
  sv.render();
  assert.ok(container.innerHTML.includes('tut222ScrambleInput'));
  assert.ok(container.innerHTML.includes('data-tut-anchor="wgr"'));

  sv.setTrack('333', 'tutorial');
  assert.ok(container.innerHTML.includes('Beginner 3x3 Guide'));
  assert.ok(container.innerHTML.includes('data-tut-tab="guide"') && container.innerHTML.includes('data-tut-tab="walkthrough"'));
  assert.ok(container.innerHTML.includes('Daisy'));
  assert.ok(container.innerHTML.includes('Ua / Ub (M-moves)'));
  assert.ok(!/\bsexy\b/i.test(container.innerHTML));
  sv.threeByThreeTutorialState.activeTab = 'walkthrough';
  sv.render();
  assert.ok(container.innerHTML.includes('tut333ScrambleInput'));

  // 1. 2x2 1st Face dedicated study view (simplified hero without 99.8% in hero lead)
  sv.setTrack('222', 'face');
  assert.ok(container.innerHTML.includes('1st Face vs. 1st Layer'));
  assert.ok(container.innerHTML.includes('ff-sim-btn'));
  const heroLeadStart = container.innerHTML.indexOf('class="flb-hero-lead"');
  const heroLeadEnd = container.innerHTML.indexOf('</p>', heroLeadStart);
  const heroLead = container.innerHTML.slice(heroLeadStart, heroLeadEnd);
  assert.ok(!heroLead.includes('99.8%'));
  assert.ok(container.innerHTML.includes('Color Neutrality Benchmarks'));

  // 2. 2x2 1st Layer: default All (114) across 2 & 3 bottom-piece groups with Option A mini-chapters & 3 perspectives
  sv.setTrack('222', 'layer');
  assert.ok(container.innerHTML.includes('1st Layer (2 &amp; 3 Bottom-Piece Cases)') || container.innerHTML.includes('1st Layer (2 & 3 Bottom-Piece Cases)'));
  assert.ok(container.innerHTML.includes('Cases Grid (114)'));
  assert.ok(container.innerHTML.includes('Case Explorer (3D + 2D)'));
  assert.ok(container.innerHTML.includes('Recognition &amp; 2-Look Guide'));
  assert.ok(!container.innerHTML.includes('All Bar System (75)'));
  assert.ok(!container.innerHTML.includes('Bar-on-Left Explorer (75)'));
  assert.ok(!container.innerHTML.includes('1 in Bottom (9)'), 'Misleading 1 in Bottom group must be removed');
  assert.ok(!container.innerHTML.includes('data-quiz-section="one-bottom"'));

  assert.ok(container.innerHTML.includes('All (114)'));
  assert.ok(container.innerHTML.includes('2 Bottom: Bar (70)'));
  assert.ok(container.innerHTML.includes('2 Bottom: Diagonal (39)'));
  assert.ok(container.innerHTML.includes('3 in Bottom (5)'));
  assert.ok(container.innerHTML.includes('data-quiz-perspective="shape"'));
  assert.ok(container.innerHTML.includes('data-quiz-perspective="roadmap"'));
  assert.ok(container.innerHTML.includes('data-quiz-perspective="technique"'));
  assert.ok(container.innerHTML.includes('data-quiz-chapter-section="two-bar:right-edge"'));
  assert.ok(container.innerHTML.includes('data-quiz-chapter-section="three-bottom:bp-solved"'));
  assert.ok(container.innerHTML.includes('data-quiz-section="two-bar"'));
  assert.ok(container.innerHTML.includes('data-quiz-section="two-diag"'));
  assert.ok(container.innerHTML.includes('data-quiz-section="three-bottom"'));
  assert.ok(container.innerHTML.includes('ui-filter-chip'));
  assert.ok(container.innerHTML.includes('flb-case-grid'));
  assert.ok(container.innerHTML.includes('flb-card-3d-live'));
  assert.ok(container.innerHTML.includes('data-card-id="flb-01"'));
  assert.ok(container.innerHTML.includes('data-quiz-case-id="flb-68"'));
  assert.ok(container.innerHTML.includes('flb-swap-warn'));
  assert.ok(!container.innerHTML.includes('data-card-3d-id'));
  assert.ok(container.innerHTML.includes('flb-card-alg-opt'));
  assert.ok(container.innerHTML.includes('data-alg-mode="trigger"'));
  assert.ok(container.innerHTML.includes('flb-card-reset-3d-btn'));
  assert.ok(container.innerHTML.includes('flb-card-play-btn'));
  assert.ok(container.innerHTML.includes('flb-card-next-btn'));
  assert.ok(container.innerHTML.includes('flb-icon-legend'));
  assert.ok(!container.innerHTML.includes('Explore 3D'));
  assert.ok(!container.innerHTML.includes('Quiz Mode (Hide Algs)'));
  assert.ok(!container.innerHTML.includes('data-quiz-layout'));
  assert.ok(!container.innerHTML.includes('flbIconLegendBtn'));
  assert.ok(!container.innerHTML.includes('flb-quiz-actions'));

  // Multi-select subset (2 Bottom: Diagonal + 3 in Bottom = 44)
  sv.firstLayerExplorerState.quizGroups = new Set(['two-diag', 'three-bottom']);
  sv.render();
  assert.ok(container.innerHTML.includes('All (44)'));
  assert.ok(container.innerHTML.includes('D-1'));
  assert.ok(container.innerHTML.includes('3B-1'));
  assert.ok(!container.innerHTML.includes('data-quiz-section="two-bar"'));

  // Single group selection
  sv.firstLayerExplorerState.quizGroups = new Set(['two-diag']);
  sv.render();
  assert.ok(container.innerHTML.includes('All (39)'));
  assert.ok(container.innerHTML.includes('D-1'));
  assert.ok(container.innerHTML.includes('2 Bottom: Diagonal (39)'));

  // Beginner -> Master roadmap perspective
  sv.firstLayerExplorerState.quizPerspective = 'roadmap';
  sv.render();
  assert.ok(container.innerHTML.includes('data-quiz-roadmap="level-1"'));
  assert.ok(container.innerHTML.includes('data-quiz-roadmap="level-2"'));
  assert.ok(container.innerHTML.includes('data-quiz-roadmap="level-3"'));
  assert.ok(container.innerHTML.includes('data-quiz-roadmap="level-4"'));

  // Bar Building & Technique perspective
  sv.firstLayerExplorerState.quizPerspective = 'technique';
  sv.render();
  assert.ok(container.innerHTML.includes('Bar-Building Perspectives'));
  assert.ok(container.innerHTML.includes('data-quiz-technique="rim-bar"'));
  assert.ok(container.innerHTML.includes('data-quiz-technique="pair-drop"'));
  assert.ok(container.innerHTML.includes('data-quiz-technique="bottom-swaps"'));

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
  assert.ok(container.innerHTML.includes('1st Layer Case Breakdown (114 Two- &amp; Three-Piece Cases)'));

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
    if (tid === 'f2l') {
      assert.ok(gridHtml.includes('study-f2l-3d-controls'), 'F2L 3D grid cards should expose inline play controls');
      assert.ok(gridHtml.includes('btn-f2l-play-3d') && gridHtml.includes('btn-f2l-start-3d') && gridHtml.includes('btn-f2l-next-3d'));
      assert.ok(gridHtml.includes('btn-twosided-reset-3d'));
      assert.ok(!gridHtml.includes('btn-study-sim'), 'F2L 3D grid cards omit redundant Sim popup button');
    } else {
      assert.ok(gridHtml.includes('btn-study-sim') && gridHtml.includes('<span>Sim</span>'));
    }
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

test('StudyView shows (Opp Xn) next to CLL cases in Case Grid always, and in Grid+3D when single group is selected', () => {
  const sv = new StudyView({ container: createMockContainer() });
  sv.currentPuzzle = '222';
  sv.currentTrackId = 'cll';
  const cllTrack = getTrack('222', 'cll');

  // All groups shown -> Case Grid shows (Opp ...), Grid+3D compact cards omit it
  sv.activeGroupFilters = new Set();
  const allGridHtml = sv.renderGridView(cllTrack);
  const allHybridHtml = sv.renderHybridView(cllTrack);
  assert.ok(allGridHtml.includes('(Opp S1)'));
  assert.ok(allGridHtml.includes('(Opp T2)'));
  const [allGridPane] = allHybridHtml.split('study-hybrid-detail-pane');
  assert.ok(!allGridPane.includes('(Opp '));

  // Multiple groups selected -> Grid+3D compact cards still omit (Opp ...), Case Grid keeps it
  sv.activeGroupFilters = new Set(['L-Group', 'H-Group']);
  const multiGridHtml = sv.renderGridView(cllTrack);
  const multiHybridHtml = sv.renderHybridView(cllTrack);
  const [multiGridPane] = multiHybridHtml.split('study-hybrid-detail-pane');
  assert.ok(multiGridHtml.includes('(Opp T2)'));
  assert.ok(!multiGridPane.includes('(Opp '));

  // Single group selected -> grid cards in both Case Grid and Grid+3D show (Opp ...)
  sv.activeGroupFilters = new Set(['L-Group']);
  const singleGridHtml = sv.renderGridView(cllTrack);
  const singleHybridHtml = sv.renderHybridView(cllTrack);
  const [singleGridPane, detailPane] = singleHybridHtml.split('study-hybrid-detail-pane');
  assert.ok(singleGridHtml.includes('(Opp T2)'));
  assert.ok(singleGridHtml.includes('(Opp U5)'));
  assert.ok(singleGridPane.includes('(Opp T2)'));
  assert.ok(detailPane.includes('(Opp '));
});

test('render444ParitySvg distinguishes 4-Piece vs Pure OLL Parity, and StudyView renders 444 Methods & Guides', () => {
  const parityTrack = getTrack('444', 'parity');
  assert.strictEqual(parityTrack.cases.length, 4);
  const oll4Piece = parityTrack.caseById.get('444-oll-parity');
  const ollPure = parityTrack.caseById.get('444-oll-parity-pure');
  assert.ok(oll4Piece && ollPure);

  const svg4Piece = render444ParitySvg(oll4Piece);
  const svgPure = render444ParitySvg(ollPure);
  assert.notStrictEqual(svg4Piece, svgPure);
  // 4-piece parity darkens all 4 front stickers (width="68" yellow front bar: 4 * 17) vs pure (width="34" bar: 2 * 17)
  assert.ok(svg4Piece.includes('width="68"'));
  assert.ok(svgPure.includes('width="34"'));

  const container = createMockContainer();
  const sv = new StudyView({ container });
  sv.setTrack('444', 'methods');
  assert.ok(container.innerHTML.includes('Reduction (Redux) vs. Yau Method'));
  assert.ok(container.innerHTML.includes('Center Pairing'));
  assert.ok(container.innerHTML.includes('BOY Color Scheme'));
  assert.ok(container.innerHTML.includes('Edge Pairing'));
  assert.ok(container.innerHTML.includes('3-2-3 Edge Pairing'));
});

test('StudyView renders 3D cube containers for Full/2-Look 3x3 OLL & PLL and 2x2 tracks (no descriptions on 2x2)', () => {
  const ollTrack = getTrack('333', 'oll');

  // Every OLL_TWO_SIDED_GUIDE rule maps to a valid OLL case
  let ollRuleCount = 0;
  for (const cat of OLL_TWO_SIDED_GUIDE) {
    for (const r of cat.rules) {
      assert.ok(r.caseId && ollTrack.caseById.has(r.caseId), `Missing valid caseId for ${r.caseName}`);
      ollRuleCount++;
    }
  }
  assert.strictEqual(ollRuleCount, 7);

  let ollMode = 'full';
  let pllMode = 'full';
  const container = createMockContainer();
  const sv = new StudyView({
    container,
    getAlwaysWhiteBottom: () => true,
    getOllMode: () => ollMode,
    getPllMode: () => pllMode
  });

  // 3x3 PLL 2-sided view: Full (21) and 2-Look (6)
  sv.setTrack('333', 'pll');
  sv.setView('twosided');
  const pllFullHtml = container.innerHTML;
  assert.strictEqual((pllFullHtml.match(/class="twosided-card-3d-wrap"/g) || []).length, 21);
  assert.ok(pllFullHtml.includes('Full · 21 Cases'));
  assert.ok(pllFullHtml.includes('data-twosided-case-id="T"'));
  assert.ok(pllFullHtml.includes('data-twosided-setup="z2 '));

  pllMode = '2look';
  sv.render();
  assert.strictEqual((container.innerHTML.match(/class="twosided-card-3d-wrap"/g) || []).length, 6);
  assert.ok(container.innerHTML.includes('2-Look · 6 Cases'));

  // 3x3 OLL 2-sided view: Full (57) and 2-Look (10)
  sv.setTrack('333', 'oll');
  sv.setView('twosided');
  const ollFullHtml = container.innerHTML;
  assert.strictEqual((ollFullHtml.match(/class="twosided-card-3d-wrap"/g) || []).length, 57);
  assert.ok(ollFullHtml.includes('Full · 57 Cases'));
  assert.ok(ollFullHtml.includes('data-twosided-case-id="oll-01"'));
  assert.ok(ollFullHtml.includes('data-twosided-case-id="oll-27"'));
  assert.ok(ollFullHtml.includes('OLL-27'));
  assert.ok(ollFullHtml.includes('btn-twosided-reset-3d'));

  ollMode = '2look';
  sv.render();
  const oll2LookHtml = container.innerHTML;
  assert.strictEqual((oll2LookHtml.match(/class="twosided-card-3d-wrap"/g) || []).length, 10);
  assert.ok(oll2LookHtml.includes('2-Look · 10 Cases'));
  assert.ok(oll2LookHtml.includes('data-twosided-case-id="oll-02"'));
  assert.ok(oll2LookHtml.includes('data-twosided-case-id="oll-27"'));
  assert.ok(oll2LookHtml.includes('Line (I-Shape)'));
  assert.ok(oll2LookHtml.includes('L-Shapes'));
  assert.ok(!oll2LookHtml.includes('T-Shapes'));
  assert.ok(!oll2LookHtml.includes('P-Shapes'));

  // 2x2 tracks expose 2-Sided Recognition subnav & render 3D cube cards without descriptions
  for (const [trackId, expectedCount] of [['cll', 40], ['ortega', 12], ['lbl', 9], ['eg1', 40], ['eg2', 40]]) {
    sv.setTrack('222', trackId);
    sv.setView('twosided');
    const html222 = container.innerHTML;
    assert.ok(html222.includes('data-view="twosided"'), `Expected 2-Sided subnav on 222 ${trackId}`);
    assert.strictEqual((html222.match(/class="twosided-card-3d-wrap"/g) || []).length, expectedCount);
    assert.ok(!html222.includes('twosided-cue-text'), `222 ${trackId} omits descriptions`);
    assert.ok(!html222.includes('twosided-sight-boxes'), `222 ${trackId} omits sight boxes`);
    assert.ok(html222.includes('btn-twosided-reset-3d'));
  }

  // Deactivate tears down 2-sided state cleanly
  const genBefore = sv._twoSided3d.gen;
  sv._twoSided3d.cards.set('H1', { displayEl: { remove() {}, player: { pause() {} } } });
  sv.deactivate();
  assert.strictEqual(sv._twoSided3d.gen, genBefore + 1);
  assert.strictEqual(sv._twoSided3d.cards.size, 0);
});

test('333bf 3BLD guide covers all 24 Speffz letters for Corners & Edges, dual nets, OP swaps, and Parity', () => {
  assert.strictEqual(SPEFFZ_CORNERS.length, 8);
  assert.strictEqual(SPEFFZ_EDGES.length, 12);

  const expectedLetters = 'ABCDEFGHIJKLMNOPQRSTUVWX';
  const cornerLetters = SPEFFZ_CORNERS.flatMap(c => c.faces.map(f => f.letter)).sort().join('');
  const edgeLetters = SPEFFZ_EDGES.flatMap(e => e.faces.map(f => f.letter)).sort().join('');
  assert.strictEqual(cornerLetters, expectedLetters);
  assert.strictEqual(edgeLetters, expectedLetters);

  assert.ok(renderSpeffzNetSvg('edges').includes('bld-net-svg'));
  assert.ok(renderSpeffzNetSvg('corners').includes('bld-net-svg'));

  const container = createMockContainer();
  const sv = new StudyView({ container });
  sv.setTrack('333bf', 'bld-guide');

  const html = container.innerHTML;
  assert.ok(html.includes('Speffz Letter Scheme'));
  assert.ok(html.includes('Solving Edges'));
  assert.ok(html.includes('Solving Corners'));
  assert.ok(html.includes('Parity'));
  assert.ok(html.includes("R U R' U' R' F R2 U' R' U' R U R' F'"));
  assert.ok(html.includes("R U' R' U' R U R' F' R U R' U' R' F R"));
  assert.ok(html.includes("R U' R' U' R U R D R' U' R D' R' U2 R' U'"));
  assert.ok(html.includes('OP Buffer sticker'));
});

test('Case Grid group filter pills are consistently multi-select on 2-group (LBL) and 3+ group (CLL) tracks with checkbox UI', () => {
  function createGroupFilterContainer() {
    const pillListeners = new Map();
    return {
      innerHTML: '',
      querySelector() { return null; },
      querySelectorAll(sel) {
        if (sel !== '.study-group-pill') return [];
        pillListeners.clear();
        const matches = [...this.innerHTML.matchAll(/class="study-group-pill([^"]*)"([^>]*)>/g)];
        return matches.map((m, idx) => {
          const attrs = m[2];
          const grpMatch = attrs.match(/data-group="([^"]+)"/);
          const onlyMatch = attrs.match(/data-only-selected="([^"]+)"/);
          const key = grpMatch ? grpMatch[1] : `only:${idx}`;
          const btn = {
            dataset: {
              ...(grpMatch ? { group: grpMatch[1] } : {}),
              ...(onlyMatch ? { onlySelected: onlyMatch[1] } : {})
            },
            addEventListener(evt, fn) {
              if (evt === 'click') pillListeners.set(key, fn);
            }
          };
          return btn;
        });
      },
      clickGroup(group) {
        const fn = pillListeners.get(group);
        assert.ok(fn, `Expected group pill listener for ${group}`);
        fn();
      }
    };
  }

  // 2x2 LBL (2 groups: OLL, PLL): multi-select works consistently — both stay selected, individual toggle works, All clears
  const lblContainer = createGroupFilterContainer();
  const svLbl = new StudyView({ container: lblContainer });
  svLbl.setTrack('222', 'lbl');
  svLbl.setView('grid');
  assert.deepStrictEqual([...svLbl.activeGroupFilters], []);
  assert.ok(lblContainer.innerHTML.includes('class="study-group-filter-bar ui-chip-group"'));
  assert.ok(lblContainer.innerHTML.includes('ui-chip-reset active" data-group="all"'));
  assert.ok(lblContainer.innerHTML.includes('data-group="PLL (Permute Last Layer)" aria-pressed="false"><span class="ui-chip-check"'));

  lblContainer.clickGroup('PLL (Permute Last Layer)');
  assert.deepStrictEqual([...svLbl.activeGroupFilters], ['PLL (Permute Last Layer)']);

  lblContainer.clickGroup('OLL (Orient Last Layer)');
  assert.deepStrictEqual([...svLbl.activeGroupFilters], ['PLL (Permute Last Layer)', 'OLL (Orient Last Layer)']);

  lblContainer.clickGroup('PLL (Permute Last Layer)');
  assert.deepStrictEqual([...svLbl.activeGroupFilters], ['OLL (Orient Last Layer)']);

  lblContainer.clickGroup('all');
  assert.deepStrictEqual([...svLbl.activeGroupFilters], []);

  // 2x2 CLL (7 groups): selecting multiple groups preserves multi-select even when all 7 are chosen until All is clicked
  const cllContainer = createGroupFilterContainer();
  const svCll = new StudyView({ container: cllContainer });
  svCll.setTrack('222', 'cll');
  svCll.setView('grid');

  cllContainer.clickGroup('L-Group');
  cllContainer.clickGroup('H-Group');
  assert.deepStrictEqual([...svCll.activeGroupFilters], ['L-Group', 'H-Group']);

  for (const grp of ['P-Group', 'U-Group', 'T-Group', 'S-Group', 'A-Group']) {
    cllContainer.clickGroup(grp);
  }
  assert.strictEqual(svCll.activeGroupFilters.size, 7);

  cllContainer.clickGroup('all');
  assert.strictEqual(svCll.activeGroupFilters.size, 0);

  // Verify style guide and shared selection CSS exist
  assert.ok(fs.existsSync(new URL('../docs/UI_STYLE_GUIDE.md', import.meta.url)));
  assert.ok(fs.existsSync(new URL('../src/styles/components/selection.css', import.meta.url)));
});
