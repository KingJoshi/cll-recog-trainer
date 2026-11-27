// Beginner 2x2 Step-by-Step Visual 3D Tutorial
// Dynamically solves any 2x2 scramble using ONLY:
//   - Any chosen White anchor corner (default: White · Green · Red at Bottom-Left)
//   - Clockwise White corners via Righty (R U R' U') / Inverse Righty (U R U' R')
//   - OLL via Sune (R U R' U R U2 R') and Antisune (exact reverse: R U2 R' U' R U' R')
//   - PLL via T-Perm (R U R' U' R' F R2 U' R' U' R U R' F')

import { escapeHtml } from '../../services/htmlUtils.js';
import { generateWcaScrambleForPuzzle } from '../../services/scrambleService.js';
import {
  TWO_BY_TWO_ANCHORS,
  solveTwoByTwoBeginner
} from '../../cube/twoByTwoBeginnerSolver.js';
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

export const DEFAULT_222_TUTORIAL_SCRAMBLE = "R U' F2 U2 R' F U R2";

const cubeManager222 = createInlineCubeManager({ maxLive: 12 });

export function createTwoByTwoTutorialState() {
  return {
    scramble: DEFAULT_222_TUTORIAL_SCRAMBLE,
    anchorId: 'wgr',
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
  return `${state.scramble}|${state.anchorId}|${choicesStr}`;
}

export async function ensureTwoByTwoTutorialPlan(state) {
  const key = buildPlanKey(state);
  if (state.plan && state.planKey === key) return state.plan;
  state.loading = true;
  state.error = '';
  try {
    const plan = await solveTwoByTwoBeginner(state.scramble, {
      anchorId: state.anchorId,
      stepChoices: state.stepChoices || {}
    });
    state.plan = plan;
    state.planKey = key;
    return plan;
  } catch (err) {
    state.error = err?.message || 'Could not compute beginner steps for this scramble.';
    state.plan = null;
    state.planKey = key;
    return null;
  } finally {
    state.loading = false;
  }
}

export function renderTwoByTwoTutorialHtml(state) {
  const key = buildPlanKey(state);
  const hasReadyPlan = Boolean(state.plan && state.planKey === key);
  const scrMoveCount = String(state.scramble || '').trim().split(/\s+/).filter(Boolean).length;

  return `
    <div class="flb-wrap">
      <section class="guide-card guide-card-full flb-hero-card">
        <h3 class="guide-card-title">&#x1F393; Beginner 2x2 Guide &mdash; Minimal Algorithms, Visual Step-by-Step</h3>
        <p class="flb-hero-lead">
          Solve any 2x2 scramble using only <strong>3 easy patterns</strong>: <strong>Righty</strong> for the White layer, <strong>Sune &amp; Antisune</strong> (Sune in reverse) for Yellow on top, and <strong>T-Perm</strong> to match the final side colors.
        </p>

        <div class="tut-cheat-grid">
          <div class="tut-cheat-card">
            <div class="tut-cheat-head"><strong>1. White Corners</strong><span class="badge">Righty</span></div>
            <code>R U R' U'</code>
            <span>And Inverse Righty (<code>U R U' R'</code>). Repeat around Bottom clockwise.</span>
          </div>
          <div class="tut-cheat-card">
            <div class="tut-cheat-head"><strong>2. Yellow Face (OLL)</strong><span class="badge">Sune / Reverse</span></div>
            <code>R U R' U R U2 R'</code>
            <span>Antisune is just Sune in reverse: <code>R U2 R' U' R U' R'</code>.</span>
          </div>
          <div class="tut-cheat-card">
            <div class="tut-cheat-head"><strong>3. Top Side Swap (PLL)</strong><span class="badge">T-Perm</span></div>
            <code>R U R' U' R' F R2 U' R' U' R U R' F'</code>
            <span>Put matching Bar on Left (run twice if no Bar exists yet).</span>
          </div>
        </div>
      </section>

      <section class="guide-card guide-card-full tut-controls-card">
        <div class="tut-scramble-card-layout">
          <div class="tut-scramble-3d-box tut-3d-card">
            <div class="tut-scramble-3d-head">
              <strong>Scramble Preview</strong>
              <span class="badge">White Top · Green Front</span>
            </div>
            <div class="tut-3d-wrap tut-scramble-3d-wrap" data-cube-id="tut222-scramble-preview" data-cube-puzzle="222" data-cube-setup="" data-cube-moves="${escapeHtml(state.scramble)}">
              <span class="study-visual-loading">3D Cube</span>
            </div>
            <div class="tut-3d-controls" role="group" aria-label="2x2 scramble preview controls">
              <button type="button" class="btn btn-xs btn-icon-only tut-3d-reset-btn" data-cube-id="tut222-scramble-preview" title="Reset 3D angle" aria-label="Reset 3D angle">${ICON_RESET_ANGLE}</button>
              <button type="button" class="btn btn-xs btn-icon-only tut-3d-start-btn" data-cube-id="tut222-scramble-preview" title="Jump to solved state" aria-label="Jump to solved state" disabled>${ICON_SKIP_START}</button>
              <button type="button" class="btn btn-xs btn-icon-only tut-3d-prev-btn" data-cube-id="tut222-scramble-preview" title="Step back 1 scramble move" aria-label="Step back 1 scramble move" disabled>${ICON_STEP_BACK}</button>
              <button type="button" class="btn btn-xs btn-icon-only btn-primary tut-3d-play-btn" data-cube-id="tut222-scramble-preview" title="Play / Pause scramble" aria-label="Play / Pause scramble" ${scrMoveCount === 0 ? 'disabled' : ''}>${ICON_PLAY}</button>
              <button type="button" class="btn btn-xs btn-icon-only tut-3d-next-btn" data-cube-id="tut222-scramble-preview" title="Step forward 1 scramble move" aria-label="Step forward 1 scramble move" ${scrMoveCount === 0 ? 'disabled' : ''}>${ICON_STEP_FORWARD}</button>
              <button type="button" class="btn btn-xs btn-icon-only tut-3d-end-btn" data-cube-id="tut222-scramble-preview" title="Fast-forward to final scramble state" aria-label="Fast-forward to final scramble state" ${scrMoveCount === 0 ? 'disabled' : ''}>${ICON_SKIP_END}</button>
              <span class="tut-3d-status">${scrMoveCount > 0 ? `0/${scrMoveCount}` : 'Solved'}</span>
            </div>
          </div>

          <div class="tut-scramble-controls-col">
            <div class="tut-scramble-row">
              <label for="tut222ScrambleInput" class="tut-control-label">2x2 Scramble:</label>
              <input type="text" id="tut222ScrambleInput" class="sim-input tut-scramble-input" value="${escapeHtml(state.scramble)}" spellcheck="false" autocomplete="off" aria-label="2x2 scramble sequence">
              <button type="button" class="btn btn-small btn-primary" id="tut222SolveBtn">Solve Steps</button>
              <button type="button" class="btn btn-small" id="tut222NewScrambleBtn">&#x1F3B2; New Scramble</button>
            </div>

            <div class="tut-anchor-row" role="group" aria-label="Choose starting White bottom-left anchor corner">
              <span class="tut-control-label">Bottom-Left White Anchor:</span>
              <div class="tut-anchor-pills">
                ${TWO_BY_TWO_ANCHORS.map(a => `
                  <button type="button" class="tut-anchor-btn ${state.anchorId === a.id ? 'active' : ''}" data-tut-anchor="${a.id}" aria-pressed="${state.anchorId === a.id}">
                    ${escapeHtml(a.label)}
                  </button>
                `).join('')}
              </div>
            </div>

            ${hasReadyPlan ? `
              <div class="tut-plan-summary">
                <span class="badge badge-solved">${state.plan.steps.length} steps</span>
                <span class="badge">${state.plan.totalMoves} total moves</span>
                <span class="hint">Anchor: <strong>${escapeHtml(state.plan.anchor.label)}</strong> in Bottom-Front-Left &rarr; clockwise around White.</span>
              </div>
            ` : ''}
          </div>
        </div>
      </section>

      ${state.error ? `<div class="guide-card guide-card-full tut-error-card">${escapeHtml(state.error)}</div>` : ''}

      ${hasReadyPlan
        ? renderTutorialStepSectionsHtml(state.plan.steps, '222')
        : `<div class="guide-card guide-card-full"><span class="study-visual-loading">Computing visual 3D solve steps…</span></div>`
      }
    </div>
  `;
}

export function bindTwoByTwoTutorialEvents(
  container,
  state,
  { onRerender, onQuickSimSolutions, onSimulateCase, getSimSpeed, getShowReflection } = {}
) {
  if (!container) return;

  const key = buildPlanKey(state);
  if ((!state.plan || state.planKey !== key) && !state.error) {
    void ensureTwoByTwoTutorialPlan(state).then(() => onRerender?.());
    return;
  }

  const inputEl = container.querySelector('#tut222ScrambleInput');
  const applyNewScramble = (nextScr) => {
    state.scramble = String(nextScr || '').trim();
    state.stepChoices = {};
    state.plan = null;
    state.planKey = '';
    state.error = '';
    void ensureTwoByTwoTutorialPlan(state).then(() => onRerender?.());
  };

  container.querySelector('#tut222SolveBtn')?.addEventListener('click', () => {
    applyNewScramble(inputEl?.value || '');
  });

  inputEl?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      applyNewScramble(inputEl.value);
    }
  });

  container.querySelector('#tut222NewScrambleBtn')?.addEventListener('click', async () => {
    const scr = await generateWcaScrambleForPuzzle('222');
    applyNewScramble(scr);
  });

  container.querySelectorAll('[data-tut-anchor]').forEach(btn => {
    btn.addEventListener('click', () => {
      const aid = btn.dataset.tutAnchor;
      if (aid && aid !== state.anchorId) {
        state.anchorId = aid;
        state.stepChoices = {};
        state.plan = null;
        state.planKey = '';
        state.error = '';
        void ensureTwoByTwoTutorialPlan(state).then(() => onRerender?.());
      }
    });
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
      void ensureTwoByTwoTutorialPlan(state).then(() => onRerender?.());
    });
  });

  if (state.plan?.steps) {
    bindTutorialStepSimButtons(container, state.plan.steps, '222', {
      titlePrefix: '2x2 Beginner Tutorial',
      onQuickSimSolutions,
      onSimulateCase
    });
    void cubeManager222.mountAll(container, { getSimSpeed, getShowReflection });
  }
}

export function syncTwoByTwoTutorialSpeed(spd) {
  cubeManager222.syncSpeed(spd);
}

export function teardownTwoByTwoTutorial3d() {
  cubeManager222.teardown();
}
