// Beginner 3x3 Step-by-Step Visual 3D Tutorial
// Dynamically solves any 3x3 scramble using minimal memorization:
//   1. Daisy (4 White petals around Yellow center) -> drop to White Cross
//   2. Simple White Corners (Righty / Inverse Righty)
//   3. Middle Layer Edges one at a time (U + Righty + y + Lefty / mirror)
//   4. Yellow Cross (F (Righty) F') + Yellow Corners (Sune & reverse Antisune)
//   5. PLL Corners (T-Perm) + PLL Edges (M-move Ua & Ub)

import { escapeHtml } from '../../services/htmlUtils.js';
import { generateWcaScrambleForPuzzle } from '../../services/scrambleService.js';
import { solveThreeByThreeBeginner } from '../../cube/threeByThreeBeginnerSolver.js';
import {
  createInlineCubeManager,
  renderTutorialStepSectionsHtml,
  bindTutorialStepSimButtons
} from './inlineCubePlayer.js';

export const DEFAULT_333_TUTORIAL_SCRAMBLE = "R U2 F' L2 D R' B U2 F2 D' L2 U R2";

const cubeManager333 = createInlineCubeManager({ maxLive: 10 });

export function createThreeByThreeTutorialState() {
  return {
    scramble: DEFAULT_333_TUTORIAL_SCRAMBLE,
    plan: null,
    planKey: '',
    loading: false,
    error: ''
  };
}

export async function ensureThreeByThreeTutorialPlan(state) {
  const key = state.scramble;
  if (state.plan && state.planKey === key) return state.plan;
  state.loading = true;
  state.error = '';
  try {
    const plan = await solveThreeByThreeBeginner(state.scramble);
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
  const hasReadyPlan = Boolean(state.plan && state.planKey === state.scramble);

  return `
    <div class="flb-wrap">
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

      <section class="guide-card guide-card-full tut-controls-card">
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
      </section>

      ${state.error ? `<div class="guide-card guide-card-full tut-error-card">${escapeHtml(state.error)}</div>` : ''}

      ${hasReadyPlan
        ? renderTutorialStepSectionsHtml(state.plan.steps, '333')
        : `<div class="guide-card guide-card-full"><span class="study-visual-loading">Computing visual 3D solve steps…</span></div>`
      }
    </div>
  `;
}

export function bindThreeByThreeTutorialEvents(
  container,
  state,
  { onRerender, onQuickSimSolutions, onSimulateCase, getSimSpeed, getShowReflection } = {}
) {
  if (!container) return;

  if ((!state.plan || state.planKey !== state.scramble) && !state.error) {
    void ensureThreeByThreeTutorialPlan(state).then(() => onRerender?.());
    return;
  }

  const inputEl = container.querySelector('#tut333ScrambleInput');
  const applyNewScramble = (nextScr) => {
    state.scramble = String(nextScr || '').trim();
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
