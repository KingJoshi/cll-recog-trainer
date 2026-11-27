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

export const DEFAULT_222_TUTORIAL_SCRAMBLE = "R U' F2 U2 R' F U R2";

const cubeManager222 = createInlineCubeManager({ maxLive: 10 });

export function createTwoByTwoTutorialState() {
  return {
    scramble: DEFAULT_222_TUTORIAL_SCRAMBLE,
    anchorId: 'wgr',
    plan: null,
    planKey: '',
    loading: false,
    error: ''
  };
}

export async function ensureTwoByTwoTutorialPlan(state) {
  const key = `${state.scramble}|${state.anchorId}`;
  if (state.plan && state.planKey === key) return state.plan;
  state.loading = true;
  state.error = '';
  try {
    const plan = await solveTwoByTwoBeginner(state.scramble, { anchorId: state.anchorId });
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
  const key = `${state.scramble}|${state.anchorId}`;
  const hasReadyPlan = Boolean(state.plan && state.planKey === key);

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

  const key = `${state.scramble}|${state.anchorId}`;
  if ((!state.plan || state.planKey !== key) && !state.error) {
    void ensureTwoByTwoTutorialPlan(state).then(() => onRerender?.());
    return;
  }

  const inputEl = container.querySelector('#tut222ScrambleInput');
  const applyNewScramble = (nextScr) => {
    state.scramble = String(nextScr || '').trim();
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
        state.plan = null;
        state.planKey = '';
        state.error = '';
        void ensureTwoByTwoTutorialPlan(state).then(() => onRerender?.());
      }
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
