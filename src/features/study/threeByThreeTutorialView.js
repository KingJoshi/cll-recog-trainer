// Beginner 3x3 Step-by-Step Visual 3D Tutorial
// Dynamically solves any 3x3 scramble using minimal memorization:
//   1. Daisy (4 White petals around Yellow center) -> drop to White Cross
//   2. Simple White Corners (Righty / Inverse Righty or Shortest alternate)
//   3. Middle Layer Edges one at a time (U + Righty + y + Lefty / mirror)
//   4. Yellow Cross (F (Righty) F') + Yellow Corners (Sune & reverse Antisune)
//   5. PLL Corners (T-Perm) + PLL Edges (M-move Ua & Ub)

import { escapeHtml } from '../../services/htmlUtils.js';
import { generateWcaScrambleForPuzzle } from '../../services/scrambleService.js';
import { solveThreeByThreeBeginner } from '../../cube/threeByThreeBeginnerSolver.js';
import {
  render333DaisyCrossGuideCardHtml,
  render333WhiteCornersGuideCardHtml,
  render333F2lEdgesGuideCardHtml,
  render333OllVisualGuideCardHtml,
  render333PllVisualGuideCardHtml
} from './tutorialVisualGuides.js';
import {
  createInlineCubeManager,
  renderTutorialStepSectionsHtml,
  bindTutorialStepSimButtons
} from './inlineCubePlayer.js';
import {
  ICON_PLAY,
  ICON_SKIP_START,
  ICON_STEP_BACK,
  ICON_STEP_FORWARD,
  ICON_SKIP_END,
  ICON_RESET_ANGLE
} from '../../ui/transportIcons.js';

export const DEFAULT_333_TUTORIAL_SCRAMBLE = "R U2 F' L2 D R' B U2 F2 D' L2 U R2";

const cubeManager333 = createInlineCubeManager({ maxLive: 10 });

export function createThreeByThreeTutorialState() {
  return {
    activeTab: 'guide',
    scramble: DEFAULT_333_TUTORIAL_SCRAMBLE,
    stepChoices: {},
    plan: null,
    planKey: '',
    loading: false,
    error: ''
  };
}

function buildPlanKey(state) {
  const choices = state.stepChoices && typeof state.stepChoices === 'object' ? state.stepChoices : {};
  const choicesStr = Object.keys(choices)
    .sort()
    .map(k => `${k}:${choices[k]}`)
    .join(',');
  return `${state.scramble}|${choicesStr}`;
}

export async function ensureThreeByThreeTutorialPlan(state) {
  const key = buildPlanKey(state);
  if (state.plan && state.planKey === key) return state.plan;
  state.loading = true;
  state.error = '';
  try {
    const plan = await solveThreeByThreeBeginner(state.scramble, {
      stepChoices: state.stepChoices || {}
    });
    state.plan = plan;
    state.planKey = key;
    return plan;
  } catch (err) {
    state.error = err?.message || 'Could not compute 3x3 beginner steps for this scramble.';
    state.plan = null;
    state.planKey = key;
    return null;
  } finally {
    state.loading = false;
  }
}

export function renderThreeByThreeTutorialHtml(state) {
  const activeTab = state.activeTab === 'walkthrough' ? 'walkthrough' : 'guide';
  const key = buildPlanKey(state);
  const hasReadyPlan = Boolean(state.plan && state.planKey === key);
  const scrMoveCount = String(state.scramble || '').trim().split(/\s+/).filter(Boolean).length;

  const tabsHtml = `
    <div class="flb-subtabs" role="tablist" aria-label="3x3 Beginner Tutorial views">
      <button type="button" class="flb-subtab-btn ${activeTab === 'guide' ? 'active' : ''}" data-tut-tab="guide" role="tab" aria-selected="${activeTab === 'guide'}">&#x1F4D6; Guide</button>
      <button type="button" class="flb-subtab-btn ${activeTab === 'walkthrough' ? 'active' : ''}" data-tut-tab="walkthrough" role="tab" aria-selected="${activeTab === 'walkthrough'}">&#x1F9ED; Walkthrough</button>
    </div>
  `;

  const guidePanelHtml = `
    <section class="guide-card guide-card-full flb-hero-card">
      <h3 class="guide-card-title">&#x1F393; Beginner 3x3 Guide &mdash; Daisy, Layer-by-Layer &amp; Minimal Algorithms</h3>
      <p class="flb-hero-lead">
        Solve any 3x3 scramble in small visual steps using just <strong>4 core patterns</strong>: <strong>Righty / Lefty</strong>, <strong>Sune &amp; Antisune</strong> (Sune in reverse), <strong>T-Perm</strong>, and the <strong>Ua / Ub M-move</strong> edge cycle (identical except for <code>U</code> vs <code>U'</code>).
      </p>

      <div class="tut-cheat-grid">
        <div class="tut-cheat-card">
          <div class="tut-cheat-head"><strong>1. Cross, Corners &amp; Edges</strong><span class="badge">Righty / Lefty</span></div>
          <code>R U R' U' &middot; L' U' L U</code>
          <span>Daisy &rarr; drop cross; Righty inserts White corners &amp; middle edges (and <code>F (Righty) F'</code> makes Yellow Cross).</span>
        </div>
        <div class="tut-cheat-card">
          <div class="tut-cheat-head"><strong>2. Yellow Corners (OLL)</strong><span class="badge">Sune / Reverse</span></div>
          <code>R U R' U R U2 R'</code>
          <span>Antisune is just Sune in reverse: <code>R U2 R' U' R U' R'</code>. Repeat up to 2&times;.</span>
        </div>
        <div class="tut-cheat-card">
          <div class="tut-cheat-head"><strong>3. Top Corners (PLL)</strong><span class="badge">T-Perm</span></div>
          <code>R U R' U' R' F R2 U' R' U' R U R' F'</code>
          <span>Headlights on Left (run twice if diagonal swap).</span>
        </div>
        <div class="tut-cheat-card">
          <div class="tut-cheat-head"><strong>4. Last 3 Edges (PLL)</strong><span class="badge">Ua / Ub (M-moves)</span></div>
          <code>M2 U M U2 M' U M2</code>
          <span>Solved bar in Back: Ua uses <code>U</code>, Ub simply swaps <code>U &rarr; U'</code> (<code>M2 U' M U2 M' U' M2</code>).</span>
        </div>
      </div>
    </section>

    ${render333DaisyCrossGuideCardHtml()}

    ${render333WhiteCornersGuideCardHtml()}

    ${render333F2lEdgesGuideCardHtml()}

    ${render333OllVisualGuideCardHtml()}

    ${render333PllVisualGuideCardHtml()}

    <div class="tut-guide-cta-bar">
      <button type="button" class="btn btn-primary btn-small" data-tut-tab="walkthrough">&#x1F9ED; Open Interactive 3D Walkthrough &rarr;</button>
    </div>
  `;

  const walkthroughPanelHtml = `
    <section class="guide-card guide-card-full tut-controls-card">
      <div class="tut-scramble-card-layout">
        <div class="tut-scramble-3d-box tut-3d-card">
          <div class="tut-scramble-3d-head">
            <strong>Scramble Preview</strong>
            <span class="badge">White Top · Green Front</span>
          </div>
          <div class="tut-3d-wrap tut-scramble-3d-wrap" data-cube-id="tut333-scramble-preview" data-cube-puzzle="333" data-cube-setup="" data-cube-moves="${escapeHtml(state.scramble)}">
            <span class="study-visual-loading">3D Cube</span>
          </div>
          <div class="tut-3d-controls" role="group" aria-label="3x3 scramble preview controls">
            <button type="button" class="btn btn-xs btn-icon-only tut-3d-reset-btn" data-cube-id="tut333-scramble-preview" title="Reset 3D angle" aria-label="Reset 3D angle">${ICON_RESET_ANGLE}</button>
            <button type="button" class="btn btn-xs btn-icon-only tut-3d-start-btn" data-cube-id="tut333-scramble-preview" title="Jump to solved state" aria-label="Jump to solved state" disabled>${ICON_SKIP_START}</button>
            <button type="button" class="btn btn-xs btn-icon-only tut-3d-prev-btn" data-cube-id="tut333-scramble-preview" title="Step back 1 scramble move" aria-label="Step back 1 scramble move" disabled>${ICON_STEP_BACK}</button>
            <button type="button" class="btn btn-xs btn-icon-only btn-primary tut-3d-play-btn" data-cube-id="tut333-scramble-preview" title="Play / Pause scramble" aria-label="Play / Pause scramble" ${scrMoveCount === 0 ? 'disabled' : ''}>${ICON_PLAY}</button>
            <button type="button" class="btn btn-xs btn-icon-only tut-3d-next-btn" data-cube-id="tut333-scramble-preview" title="Step forward 1 scramble move" aria-label="Step forward 1 scramble move" ${scrMoveCount === 0 ? 'disabled' : ''}>${ICON_STEP_FORWARD}</button>
            <button type="button" class="btn btn-xs btn-icon-only tut-3d-end-btn" data-cube-id="tut333-scramble-preview" title="Fast-forward to final scramble state" aria-label="Fast-forward to final scramble state" ${scrMoveCount === 0 ? 'disabled' : ''}>${ICON_SKIP_END}</button>
            <span class="tut-3d-status">${scrMoveCount > 0 ? `0/${scrMoveCount}` : 'Solved'}</span>
          </div>
        </div>

        <div class="tut-scramble-controls-col">
          <div class="tut-scramble-row">
            <label for="tut333ScrambleInput" class="tut-control-label">3x3 Scramble:</label>
            <input type="text" id="tut333ScrambleInput" class="sim-input tut-scramble-input" value="${escapeHtml(state.scramble)}" spellcheck="false" autocomplete="off" aria-label="3x3 scramble sequence">
            <button type="button" class="btn btn-small btn-primary" id="tut333SolveBtn">Solve Steps</button>
            <button type="button" class="btn btn-small" id="tut333NewScrambleBtn">&#x1F3B2; New Scramble</button>
          </div>

          ${hasReadyPlan ? `
            <div class="tut-plan-summary">
              <span class="badge badge-solved">${state.plan.steps.length} steps</span>
              <span class="badge">${state.plan.totalMoves} total moves</span>
              <span class="hint">Daisy &rarr; Cross &rarr; Corners &rarr; Middle Edges &rarr; Yellow Cross &rarr; OLL &rarr; PLL.</span>
            </div>
          ` : ''}
        </div>
      </div>
    </section>

    ${state.error ? `<div class="guide-card guide-card-full tut-error-card">${escapeHtml(state.error)}</div>` : ''}

    ${hasReadyPlan
      ? renderTutorialStepSectionsHtml(state.plan.steps, '333')
      : `<div class="guide-card guide-card-full"><span class="study-visual-loading">Computing visual 3D solve steps…</span></div>`
    }
  `;

  return `
    <div class="flb-wrap">
      ${tabsHtml}
      <div class="flb-tab-panel">
        ${activeTab === 'guide' ? guidePanelHtml : walkthroughPanelHtml}
      </div>
    </div>
  `;
}

export function bindThreeByThreeTutorialEvents(
  container,
  state,
  { onRerender, onQuickSimSolutions, onSimulateCase, getSimSpeed, getShowReflection } = {}
) {
  if (!container) return;

  container.querySelectorAll('[data-tut-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      const nextTab = btn.dataset.tutTab === 'walkthrough' ? 'walkthrough' : 'guide';
      const curTab = state.activeTab === 'walkthrough' ? 'walkthrough' : 'guide';
      if (nextTab === curTab) return;
      if (curTab === 'walkthrough') {
        cubeManager333.teardown();
      }
      state.activeTab = nextTab;
      onRerender?.();
    });
  });

  if (state.activeTab !== 'walkthrough') return;

  const key = buildPlanKey(state);
  if ((!state.plan || state.planKey !== key) && !state.error) {
    void ensureThreeByThreeTutorialPlan(state).then(() => onRerender?.());
    return;
  }

  const inputEl = container.querySelector('#tut333ScrambleInput');
  const applyNewScramble = (nextScr) => {
    state.scramble = String(nextScr || '').trim();
    state.stepChoices = {};
    state.plan = null;
    state.planKey = '';
    state.error = '';
    void ensureThreeByThreeTutorialPlan(state).then(() => onRerender?.());
  };

  container.querySelector('#tut333SolveBtn')?.addEventListener('click', () => {
    applyNewScramble(inputEl?.value || '');
  });

  inputEl?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      applyNewScramble(inputEl.value);
    }
  });

  container.querySelector('#tut333NewScrambleBtn')?.addEventListener('click', async () => {
    const scr = await generateWcaScrambleForPuzzle('333');
    applyNewScramble(scr);
  });

  container.querySelectorAll('[data-tut-alt-step][data-tut-alt-opt]').forEach(btn => {
    btn.addEventListener('click', () => {
      const stepId = btn.dataset.tutAltStep;
      const optId = btn.dataset.tutAltOpt;
      if (!stepId || !optId) return;
      state.stepChoices = { ...(state.stepChoices || {}), [stepId]: optId };
      state.plan = null;
      state.planKey = '';
      state.error = '';
      void ensureThreeByThreeTutorialPlan(state).then(() => onRerender?.());
    });
  });

  if (state.plan?.steps) {
    bindTutorialStepSimButtons(container, state.plan.steps, '333', {
      titlePrefix: '3x3 Beginner Tutorial',
      onQuickSimSolutions,
      onSimulateCase
    });
    void cubeManager333.mountAll(container, { getSimSpeed, getShowReflection });
  }
}

export function syncThreeByThreeTutorialSpeed(spd) {
  cubeManager333.syncSpeed(spd);
}

export function teardownThreeByThreeTutorial3d() {
  cubeManager333.teardown();
}
