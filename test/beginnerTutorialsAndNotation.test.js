import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { cube2x2x2, cube3x3x3 } from 'cubing/puzzles';
import { Alg } from 'cubing/alg';
import {
  TWO_BY_TWO_ANCHORS,
  solveTwoByTwoBeginner
} from '../src/cube/twoByTwoBeginnerSolver.js';
import { solveThreeByThreeBeginner } from '../src/cube/threeByThreeBeginnerSolver.js';
import {
  createTwoByTwoTutorialState,
  ensureTwoByTwoTutorialPlan,
  renderTwoByTwoTutorialHtml
} from '../src/features/study/twoByTwoTutorialView.js';
import {
  createThreeByThreeTutorialState,
  ensureThreeByThreeTutorialPlan,
  renderThreeByThreeTutorialHtml
} from '../src/features/study/threeByThreeTutorialView.js';
import {
  createNotationTutorialView,
  NOTATION_FACE_MOVES,
  NOTATION_MODIFIERS,
  NOTATION_SLICE_MOVES,
  NOTATION_INNER_SLICE_MOVES,
  NOTATION_WIDE_MOVES,
  NOTATION_WIDE_3_MOVES,
  NOTATION_TRIGGERS
} from '../src/features/study/notationTutorialView.js';
import { PUZZLES } from '../src/data/algRegistry.js';
import {
  AppStore,
  EXPERIMENTAL_FEATURE_IDS,
  MODES,
  getTrackExperimentalFeature,
  isTrackEnabled,
  isExperimentalEnabled
} from '../src/state/appStore.js';

const SAMPLE_222_SCRAMBLES = [
  "",
  "R U R' U'",
  "R U' F2 U2 R' F U R2",
  "F R2 U' R2 U F' R2 U R'",
  "U2 F2 R U' R2 F U' R",
  "R2 F2 U2 R U R' F U2 R'",
  "F' U R' U2 F R2 U' F'",
  "U R' F' R U2 F' U F2 R2",
  "R F' U2 R2 F U' R2 F2",
  "F R U' R' F2 U R' U2"
];

const SAMPLE_333_SCRAMBLES = [
  "",
  "R U R' U'",
  "R U2 F' L2 D R' B U2 F2 D' L2 U R2",
  "F2 L2 U' R2 D B2 L2 U' F2 D R' B L' U2 R' D F L' B2",
  "U B2 R2 D' R2 U L2 D' F2 U2 L' B U F D2 R' B' F2 L",
  "D2 R' U2 F2 L2 F2 R' B2 L' F2 U L B D' F R2 D2 B F",
  "L2 D' B2 D' L2 U F2 D2 U' R2 B2 F' U' L B' F' D2 B U2 R",
  "R2 F2 R2 U' L2 U R2 U' F2 U' B' L D U B' R' B2 R' D'",
  "B2 R2 U' F2 D' B2 F2 U' B2 L2 R D' L' R2 U' F2 L B D'",
  "U' L2 D F2 D' R2 D2 B2 L2 R B R' U' L2 B D2 F' L' R"
];

function build24OrientationGoals(kp) {
  const solved = kp.defaultPattern();
  const baseRots = ["", "x", "x'", "x2", "z", "z'"];
  const yRots = ["", "y", "y'", "y2"];
  const goals = [];
  for (const b of baseRots) {
    for (const y of yRots) {
      const algStr = [b, y].filter(Boolean).join(" ");
      goals.push(algStr ? solved.applyAlg(new Alg(algStr)) : solved);
    }
  }
  return goals;
}

function createInteractiveMockContainer() {
  let html = '';
  const elementsById = new Map();
  const buttonsBySelector = new Map();
  let lastParsedHtml = null;

  function makeAttrButtons(attrName) {
    const out = [];
    const re = new RegExp(`data-${attrName}="([^"]+)"`, 'g');
    let m;
    while ((m = re.exec(html)) !== null) {
      const val = m[1];
      const camel = attrName.replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
      const listeners = {};
      out.push({
        dataset: { [camel]: val },
        listeners,
        addEventListener(evt, fn) { (listeners[evt] ||= []).push(fn); },
        click() { (listeners.click || []).forEach(fn => fn()); }
      });
    }
    return out;
  }

  function parseButtonsAndIds() {
    if (lastParsedHtml === html) return;
    lastParsedHtml = html;
    elementsById.clear();
    buttonsBySelector.clear();
    const idRe = /id="([^"]+)"([^>]*)/g;
    let m;
    while ((m = idRe.exec(html)) !== null) {
      const id = m[1];
      const attrs = m[2] || '';
      const listeners = {};
      elementsById.set(id, {
        id,
        hidden: /\bhidden\b/.test(attrs),
        disabled: /\bdisabled\b/.test(attrs),
        textContent: '',
        innerHTML: '',
        listeners,
        addEventListener(evt, fn) { (listeners[evt] ||= []).push(fn); },
        click() { (listeners.click || []).forEach(fn => fn()); }
      });
    }
    buttonsBySelector.set('[data-not-puzzle]', makeAttrButtons('not-puzzle'));
    buttonsBySelector.set('.not-turn-btn', makeAttrButtons('not-move'));
    buttonsBySelector.set('.not-try-big-btn', makeAttrButtons('not-seq'));
    const trigButtons = makeAttrButtons('not-trig');
    buttonsBySelector.set('.tut-trig-quicksim-btn', trigButtons);
    buttonsBySelector.set('.tut-trig-opensim-btn', trigButtons);
  }

  return {
    get innerHTML() { return html; },
    set innerHTML(v) { html = String(v || ''); parseButtonsAndIds(); },
    querySelector(sel) {
      parseButtonsAndIds();
      if (sel.startsWith('#')) return elementsById.get(sel.slice(1)) || null;
      return null;
    },
    querySelectorAll(sel) {
      parseButtonsAndIds();
      return buttonsBySelector.get(sel) || [];
    }
  };
}

test('solveTwoByTwoBeginner dynamically solves any 2x2 scramble from every White anchor corner', async () => {
  const kp = await cube2x2x2.kpuzzle();
  const goals = build24OrientationGoals(kp);

  assert.strictEqual(TWO_BY_TWO_ANCHORS[0].id, 'wgr');
  assert.strictEqual(TWO_BY_TWO_ANCHORS.length, 4);

  for (const scr of SAMPLE_222_SCRAMBLES) {
    for (const anchor of TWO_BY_TWO_ANCHORS) {
      const plan = await solveTwoByTwoBeginner(scr, { anchorId: anchor.id });
      assert.strictEqual(plan.solved, true, `2x2 solver failed on "${scr}" anchor=${anchor.id}`);
      assert.ok(plan.steps.length > 0, 'Plan should produce explicit visual steps');

      let cur = scr ? kp.defaultPattern().applyAlg(new Alg(scr)) : kp.defaultPattern();
      for (const st of plan.steps) {
        if (st.moves) cur = cur.applyAlg(new Alg(st.moves));
        assert.ok(typeof st.setupBefore === 'string', 'Every step must expose a setupBefore string for 3D playback');
        assert.ok(typeof st.cumulativeAfter === 'string', 'Every step must expose a cumulativeAfter string');
        assert.ok(typeof st.title === 'string' && st.title.length > 0);
        assert.ok(!/ortega|1st\s*face|\bsexy\b/i.test(`${st.title} ${st.description || ''}`), `Forbidden text in 2x2 step: ${st.title}`);
      }
      const whiteSteps = plan.steps.filter(st => st.stage === 'white-layer');
      assert.strictEqual(whiteSteps.length, 4, 'White layer must have 4 step widgets');
      whiteSteps.forEach((st, idx) => {
        assert.match(st.stickeringMask || '', /^CORNERS:[DI-]{8}$/, 'White step must carry valid CORNERS stickeringMask');
        const body = st.stickeringMask.slice('CORNERS:'.length);
        assert.strictEqual((body.match(/-/g) || []).length, 1, 'Exactly one target piece must be highlighted');
        assert.strictEqual((body.match(/D/g) || []).length, idx, `Step ${idx + 1} must dim ${idx} previously placed corners`);
        assert.ok(st.highlightPiece && Array.isArray(st.highlightPiece.colors) && st.highlightPiece.colors.length === 3);
      });
      for (const st of plan.steps.filter(s => s.stage !== 'white-layer')) {
        assert.strictEqual(st.stickeringMask, undefined, 'OLL/PLL steps must render full unmasked colors');
      }
      assert.ok(goals.some(g => cur.isIdentical(g)), `Final state after 2x2 steps not solved for "${scr}" (${anchor.id})`);
    }
  }
});

test('solveThreeByThreeBeginner dynamically solves any 3x3 scramble using Daisy, Righty/Lefty, Sune/Antisune, T-Perm, Ua/Ub', async () => {
  const kp = await cube3x3x3.kpuzzle();
  const goals = build24OrientationGoals(kp);

  for (const scr of SAMPLE_333_SCRAMBLES) {
    const plan = await solveThreeByThreeBeginner(scr);
    assert.strictEqual(plan.solved, true, `3x3 solver failed on "${scr}"`);
    assert.ok(plan.steps.length > 0, '3x3 plan must contain step widgets');

    let cur = scr ? kp.defaultPattern().applyAlg(new Alg(scr)) : kp.defaultPattern();
    for (const st of plan.steps) {
      if (st.moves) cur = cur.applyAlg(new Alg(st.moves));
      assert.ok(typeof st.setupBefore === 'string', 'Every 3x3 step must expose a setupBefore string for 3D playback');
      assert.ok(typeof st.cumulativeAfter === 'string', 'Every 3x3 step must expose a cumulativeAfter string');
      assert.ok(!/\bsexy\b/i.test(`${st.title} ${st.description || ''}`), `Deprecated term in step: ${st.title}`);
    }
    assert.ok(goals.some(g => cur.isIdentical(g)), `Final 3x3 state not solved for "${scr}"`);
  }
});

test('Tutorial views render dynamic 3D step widgets, scramble controls, and 2x2 anchor selector', async () => {
  const s222 = createTwoByTwoTutorialState();
  assert.strictEqual(s222.anchorId, 'wgr');
  await ensureTwoByTwoTutorialPlan(s222);
  const html222Wgr = renderTwoByTwoTutorialHtml(s222);
  assert.ok(html222Wgr.includes('tut-3d-wrap'), '2x2 tutorial must render 3D widgets for steps');
  assert.ok(html222Wgr.includes('data-tut-anchor="wgr"'));
  assert.ok(html222Wgr.includes('data-cube-id="tut222-scramble-preview"'), 'Must render 2x2 scramble preview 3D cube');
  assert.ok(html222Wgr.includes('White Top · Green Front'));
  assert.ok(html222Wgr.includes('data-cube-id="tut222-scramble-preview" data-cube-puzzle="222" data-cube-setup=""'), 'Scramble preview must animate scramble from solved White Top · Green Front');
  assert.ok(html222Wgr.includes('data-cube-mask="CORNERS:'), 'White-layer step cards must expose data-cube-mask');
  assert.ok(html222Wgr.includes('tut-highlight-piece-pill'), 'White-layer step cards must show target piece badge');
  assert.ok(!/Ortega|1st Face|\bsexy\b/i.test(html222Wgr));

  s222.anchorId = 'wbo';
  await ensureTwoByTwoTutorialPlan(s222);
  const html222Wbo = renderTwoByTwoTutorialHtml(s222);
  assert.ok(html222Wbo.includes('White · Blue · Orange'));

  const s333 = createThreeByThreeTutorialState();
  await ensureThreeByThreeTutorialPlan(s333);
  const html333 = renderThreeByThreeTutorialHtml(s333);
  assert.ok(html333.includes('tut-3d-wrap'), '3x3 tutorial must render 3D widgets for steps');
  assert.ok(html333.includes('Daisy'));
  assert.ok(html333.includes("M2 U' M U2 M' U' M2") || html333.includes('Ua / Ub'));
  assert.ok(!/\bsexy\b/i.test(html333));
});

test('Standalone Help / NxN Notation view renders top Quick Setup Wizard, 2x2-5x5 switcher, 2R2 inner 180s, and separated Sune/Antisune', () => {
  const container = createInteractiveMockContainer();
  let wizardCalls = 0;
  const view = createNotationTutorialView({
    container,
    onOpenWizard: () => { wizardCalls++; }
  });
  view.render();

  assert.ok(container.innerHTML.includes('<h2 class="study-track-title">Help</h2>'));
  assert.ok(container.innerHTML.includes('id="notQuickSetupSection"'));
  assert.ok(container.querySelector('#notLaunchWizardBtn'));
  assert.strictEqual(container.querySelector('#notOpenHelpBtn'), null, 'Redundant How to Use modal trigger must be removed');
  assert.ok(
    container.innerHTML.indexOf('id="notQuickSetupSection"') < container.innerHTML.indexOf('id="notSandboxCubeHost"'),
    'Quick Setup Wizard section must appear above the sandbox cube'
  );
  container.querySelector('#notLaunchWizardBtn').click();
  assert.strictEqual(wizardCalls, 1);

  // Idempotent render(): repeated call without puzzle change must preserve DOM without tearing down
  const htmlSnapshot = container.innerHTML;
  view.render();
  assert.strictEqual(container.innerHTML, htmlSnapshot);

  const countCards = () => (container.innerHTML.match(/class="[^"]*\btut-3d-card\b/g) || []).length;

  assert.ok(container.innerHTML.includes('id="notSandboxCubeHost"'), 'Big 3D sandbox cube must be rendered');
  assert.ok(container.innerHTML.includes('not-always-open-keypad'), 'Free Face Turns keypad must be always visible');
  assert.ok(!/<details[\s>]/i.test(container.innerHTML), 'Free Face Turns must NOT be collapsed inside <details>');
  assert.strictEqual(container.querySelectorAll('[data-not-puzzle]').length, 4, '2x2 / 3x3 / 4x4 / 5x5 switcher must render');
  assert.ok(!container.innerHTML.includes('R (No Symbol)'), 'Redundant R (No Symbol) modifier card must be removed');

  assert.strictEqual(NOTATION_TRIGGERS.length, 8, 'Triggers must include Lefty Sledgehammer & Lefty Hedgeslammer');
  assert.ok(container.innerHTML.includes('Lefty Sledgehammer'));
  assert.ok(container.innerHTML.includes('Lefty Hedgeslammer'));

  // Visual Glossary: Face vs Layer, separate Bar, separate Headlights (2x2 & 3x3), separate Sune & Antisune cards, AUF 3D
  assert.ok(container.innerHTML.includes('id="notGlossaryFaceVsLayer"'));
  assert.ok(container.innerHTML.includes('id="notGlossaryBar"'));
  assert.ok(container.innerHTML.includes('id="notGlossaryHeadlights"'));
  assert.ok(container.innerHTML.includes('2x2 Headlights'));
  assert.ok(container.innerHTML.includes('3x3 Headlights'));
  assert.ok(container.innerHTML.includes('class="not-glossary-svg"'));
  assert.ok(container.innerHTML.includes('id="notGlossarySune"'));
  assert.ok(container.innerHTML.includes('id="notGlossaryAntisune"'));
  assert.ok(container.innerHTML.includes('id="notGlossaryAuf"'));
  assert.ok(container.innerHTML.includes('data-cube-id="not-gloss-sune"'));
  assert.ok(container.innerHTML.includes('data-cube-id="not-gloss-antisune"'));
  assert.ok(container.innerHTML.includes('data-cube-id="not-gloss-auf"'));
  const gloss3dCards = 3;

  // Default 3x3: Slice (M/E/S) & Wide (Rw/r) sections & rows, NO Inner slices / Inner 180° rows
  assert.strictEqual(view.getSandboxPuzzle(), '333');
  assert.ok(container.querySelector('#notSandboxSliceRow'));
  assert.ok(container.querySelector('#notSandboxWideRow'));
  assert.strictEqual(container.querySelector('#notSandboxInnerSliceRow'), null);
  assert.strictEqual(container.querySelector('#notSandboxInner180Row'), null);
  assert.strictEqual(container.querySelector('#notSandboxWide3Row'), null);
  assert.ok(container.innerHTML.includes('id="notSliceSection"'));
  assert.ok(container.innerHTML.includes('id="notWideSection"'));
  assert.ok(container.innerHTML.includes('Rw / r'));
  assert.ok(container.innerHTML.includes('lowercase letters'));
  assert.strictEqual(
    countCards(),
    NOTATION_FACE_MOVES.length + NOTATION_MODIFIERS.length + NOTATION_SLICE_MOVES.length + NOTATION_WIDE_MOVES.length + NOTATION_TRIGGERS.length + gloss3dCards
  );
  assert.ok(!/\bsexy\b/i.test(container.innerHTML));

  // Click S on 3x3 Free Face Turns
  const btnS = container.querySelectorAll('.not-turn-btn').find(b => b.dataset.notMove === 'S');
  assert.ok(btnS, 'S slice turn button must be rendered on 3x3');
  btnS.click();
  assert.deepStrictEqual(view.getSandboxMoves(), ['S']);
  assert.ok(container.querySelector('#notSandboxHistoryList').innerHTML.includes('S'));

  // 2x2: hides Slice, Inner, Wide keypad rows and sections
  container.querySelectorAll('[data-not-puzzle]').find(b => b.dataset.notPuzzle === '222').click();
  assert.strictEqual(view.getSandboxPuzzle(), '222');
  assert.strictEqual(container.querySelector('#notSandboxSliceRow'), null);
  assert.strictEqual(container.querySelector('#notSandboxInnerSliceRow'), null);
  assert.strictEqual(container.querySelector('#notSandboxInner180Row'), null);
  assert.strictEqual(container.querySelector('#notSandboxWideRow'), null);
  assert.strictEqual(container.querySelector('#notSliceSection'), null);
  assert.strictEqual(container.querySelector('#notWideSection'), null);
  assert.strictEqual(
    countCards(),
    NOTATION_FACE_MOVES.length + NOTATION_MODIFIERS.length + NOTATION_TRIGGERS.length + gloss3dCards
  );

  // 4x4: Inner slices (2R-2B + 2R2 inner 180s) + Wide moves, no M/E/S row
  container.querySelectorAll('[data-not-puzzle]').find(b => b.dataset.notPuzzle === '444').click();
  assert.strictEqual(view.getSandboxPuzzle(), '444');
  assert.strictEqual(container.querySelector('#notSandboxSliceRow'), null);
  assert.ok(container.querySelector('#notSandboxInnerSliceRow'));
  assert.ok(container.querySelector('#notSandboxInner180Row'));
  assert.ok(container.querySelector('#notSandboxWideRow'));
  assert.ok(container.innerHTML.includes('id="notSliceSection"'));
  assert.ok(container.innerHTML.includes('id="notWideSection"'));
  assert.strictEqual(
    countCards(),
    NOTATION_FACE_MOVES.length + NOTATION_MODIFIERS.length + NOTATION_INNER_SLICE_MOVES.length + NOTATION_WIDE_MOVES.length + NOTATION_TRIGGERS.length + gloss3dCards
  );
  const btn2R2 = container.querySelectorAll('.not-turn-btn').find(b => b.dataset.notMove === '2R2');
  assert.ok(btn2R2, '2R2 inner 180° button must be rendered on 4x4 for PLL parity');
  btn2R2.click();
  assert.deepStrictEqual(view.getSandboxMoves(), ['2R2']);

  // 5x5: Middle Slices + Inner Slices + Inner 180° + Wide + 3-Wide
  container.querySelectorAll('[data-not-puzzle]').find(b => b.dataset.notPuzzle === '555').click();
  assert.strictEqual(view.getSandboxPuzzle(), '555');
  assert.ok(container.querySelector('#notSandboxSliceRow'));
  assert.ok(container.querySelector('#notSandboxInnerSliceRow'));
  assert.ok(container.querySelector('#notSandboxInner180Row'));
  assert.ok(container.querySelector('#notSandboxWideRow'));
  assert.ok(container.querySelector('#notSandboxWide3Row'));
  assert.strictEqual(
    countCards(),
    NOTATION_FACE_MOVES.length + NOTATION_MODIFIERS.length + NOTATION_SLICE_MOVES.length + NOTATION_INNER_SLICE_MOVES.length + NOTATION_WIDE_MOVES.length + NOTATION_WIDE_3_MOVES.length + NOTATION_TRIGGERS.length + gloss3dCards
  );

  assert.ok(!container.innerHTML.includes('beta-sup'), 'Help / Notations view must not show a Beta badge');
  view.teardown();
});

test('Notation mode is non-beta via ? icon while 2x2 and 3x3 tutorials remain beta experimental features', () => {
  assert.ok(MODES.includes('notation'), 'AppStore MODES must include "notation"');
  assert.ok(!EXPERIMENTAL_FEATURE_IDS.includes('notationTutorial'), 'notationTutorial must NOT be an experimental feature');
  assert.strictEqual(PUZZLES['333'].tracks[0].id, 'tutorial');
  assert.strictEqual(getTrackExperimentalFeature('333', 'tutorial'), 'threeByThreeTutorial');
  assert.strictEqual(getTrackExperimentalFeature('222', 'tutorial'), 'twoByTwoTutorial');

  const store = new AppStore();
  assert.strictEqual(isExperimentalEnabled(store.state, 'twoByTwoTutorial'), false);
  assert.strictEqual(isExperimentalEnabled(store.state, 'threeByThreeTutorial'), false);
  assert.strictEqual(isTrackEnabled(store.state, '333', 'tutorial'), false);

  store.setExperimentalFeature('threeByThreeTutorial', true);
  assert.strictEqual(isExperimentalEnabled(store.state, 'threeByThreeTutorial'), true);
  assert.strictEqual(isTrackEnabled(store.state, '333', 'tutorial'), true);

  const html = fs.readFileSync(new URL('../index.html', import.meta.url).pathname, 'utf8');
  assert.ok(!html.includes('id="modeNotationBtn"'), 'Top mode bar stays 3-slot without beta Notation mode button');
  assert.ok(html.includes('id="notationViewContainer"'));
  assert.ok(!html.includes('id="helpModal"'), 'Redundant How to Use modal must be removed');
  assert.ok(!html.includes('id="settingsExp_notationTutorial"'), 'Experimental settings must not list Notations');
  assert.ok(html.includes('id="settingsExp_threeByThreeTutorial"'));

  const mainJs = fs.readFileSync(new URL('../src/main.js', import.meta.url).pathname, 'utf8');
  assert.match(mainJs, /document\.getElementById\("onboardingBtn"\)\?\.addEventListener\("click",\s*\(\)\s*=>\s*\{\s*navCtrl\?\.setMode\?\.\("notation"\)/);
  assert.ok(!mainJs.includes('onboardingWizard?.close'), 'Sync hydration must not auto-close the Quick Setup Wizard');
});
