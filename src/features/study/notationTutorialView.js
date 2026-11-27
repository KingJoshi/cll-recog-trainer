// Standalone NxN Notation & Triggers View (Beta Experimental Mode)
// Features a large interactive 3D sandbox cube with Free Face Turns always visible,
// puzzle size switcher (2x2 / 3x3 / 4x4), and inline playable 3D cubes on every notation/trigger card.

import { escapeHtml } from '../../services/htmlUtils.js';
import { applyColorsTo3DCube } from '../../caseVisualizer.js';
import { createInlineCubeManager, resetCubeCamera } from './inlineCubePlayer.js';
import { ICON_PLAY, ICON_SKIP_START, ICON_STEP_BACK, ICON_STEP_FORWARD, ICON_RESET_ANGLE, ICON_POPUP_SIM } from '../../ui/transportIcons.js';

export const NOTATION_FACE_MOVES = [
  { letter: 'R', face: 'Right', desc: 'Clockwise if looking directly at the Right face (away from you).', demoAlg: 'R', demoSetup: "R'" },
  { letter: 'L', face: 'Left', desc: 'Clockwise if looking directly at the Left face (toward you).', demoAlg: 'L', demoSetup: "L'" },
  { letter: 'U', face: 'Up (Top)', desc: 'Clockwise if looking down at the Top face (push right-to-left).', demoAlg: 'U', demoSetup: "U'" },
  { letter: 'D', face: 'Down (Bottom)', desc: 'Clockwise if looking up at the Bottom face (push left-to-right).', demoAlg: 'D', demoSetup: "D'" },
  { letter: 'F', face: 'Front', desc: 'Clockwise like turning a steering wheel to the right.', demoAlg: 'F', demoSetup: "F'" },
  { letter: 'B', face: 'Back', desc: 'Clockwise if looking directly at the Back face (left from front).', demoAlg: 'B', demoSetup: "B'" }
];

export const NOTATION_MODIFIERS = [
  { id: 'mod-cw', token: 'R (No Symbol)', meaning: '90° Clockwise', demoAlg: 'R', demoSetup: "R'", desc: 'Quarter turn clockwise when looking straight at that face.' },
  { id: 'mod-ccw', token: "R' (Prime)", meaning: '90° Counter-Clockwise', demoAlg: "R'", demoSetup: 'R', desc: 'Quarter turn in the opposite direction — read as "R prime".' },
  { id: 'mod-2', token: 'R2 (Double)', meaning: '180° Half-Turn', demoAlg: 'R2', demoSetup: 'R2', desc: 'Half turn (two quarter turns in either direction).' },
  { id: 'mod-slice', token: 'M / M\' (3x3+)', meaning: 'Middle Slice', demoAlg: 'M', demoSetup: "M'", puzzle: '333', desc: 'Middle slice between L & R, following the L direction (used in Ua/Ub edges!).' },
  { id: 'mod-wide', token: 'Rw / Uw (4x4+)', meaning: '2 Layers Together', demoAlg: 'Rw', demoSetup: "Rw'", puzzle: '444', desc: 'Turns both the outer layer and its inner neighbor layer together.' },
  { id: 'mod-rot', token: 'x, y, z', meaning: 'Whole-Cube Tilt', demoAlg: 'y', demoSetup: "y'", desc: 'Re-grip without turning a layer: x follows R, y follows U, z follows F.' }
];

export const NOTATION_TRIGGERS = [
  {
    id: 'trig-righty',
    name: 'Righty',
    alg: "R U R' U'",
    setup: "U R U' R'",
    hand: 'Right Hand',
    desc: 'The #1 4-move building block: right up, top left, right down, top back.'
  },
  {
    id: 'trig-inv-righty',
    name: 'Inverse Righty',
    alg: "U R U' R'",
    setup: "R U R' U'",
    hand: 'Right Hand',
    desc: 'Exact reverse of Righty — drops a corner down from top-front-right.'
  },
  {
    id: 'trig-lefty',
    name: 'Lefty',
    alg: "L' U' L U",
    setup: "U' L' U L",
    hand: 'Left Hand',
    desc: 'Exact left-hand mirror of Righty: left up, top right, left down, top back.'
  },
  {
    id: 'trig-inv-lefty',
    name: 'Inverse Lefty',
    alg: "U' L' U L",
    setup: "L' U' L U",
    hand: 'Left Hand',
    desc: 'Exact reverse of Lefty — inserts a top corner cleanly on the Left.'
  },
  {
    id: 'trig-sledge',
    name: 'Sledgehammer',
    alg: "R' F R F'",
    setup: "F R' F' R",
    hand: 'Right + Front',
    desc: 'Fast 4-move front trigger used in T-Perm, 2x2 layers, and 3x3 OLL.'
  },
  {
    id: 'trig-hedge',
    name: 'Hedgeslammer',
    alg: "F R' F' R",
    setup: "R' F R F'",
    hand: 'Inverse Sledge',
    desc: 'Exact reverse of Sledgehammer.'
  }
];

const SANDBOX_PUZZLES = [
  { id: '222', label: '2x2' },
  { id: '333', label: '3x3' },
  { id: '444', label: '4x4' }
];

let SandboxSD = null;
async function getSandboxScrambleDisplay() {
  if (!SandboxSD && typeof window !== 'undefined') {
    const mod = await import('scramble-display');
    SandboxSD = mod.ScrambleDisplay;
  }
  return SandboxSD;
}

export function createNotationTutorialView({
  container,
  getSimSpeed = () => 1,
  getShowReflection = () => true,
  onQuickSimSolutions = null,
  onSimulateCase = null
} = {}) {
  let sandboxPuzzle = '333';
  let sandboxMoves = [];
  let sandboxDisplay = null;
  let sandboxIndexer = null;
  let sandboxMountGen = 0;

  const inlineCubes = createInlineCubeManager({ maxLive: 12 });

  function renderTurnCardControls(id) {
    return `
      <div class="tut-3d-controls" role="group" aria-label="3D animation controls">
        <button type="button" class="btn btn-xs btn-icon-only tut-3d-reset-btn" data-cube-id="${id}" title="Reset 3D angle" aria-label="Reset 3D angle">${ICON_RESET_ANGLE}</button>
        <button type="button" class="btn btn-xs btn-icon-only tut-3d-start-btn" data-cube-id="${id}" title="Reset move" aria-label="Reset move" disabled>${ICON_SKIP_START}</button>
        <button type="button" class="btn btn-xs btn-icon-only tut-3d-prev-btn" data-cube-id="${id}" title="Step back" aria-label="Step back" disabled>${ICON_STEP_BACK}</button>
        <button type="button" class="btn btn-xs btn-icon-only btn-primary tut-3d-play-btn" data-cube-id="${id}" title="Play / Pause" aria-label="Play / Pause">${ICON_PLAY}</button>
        <button type="button" class="btn btn-xs btn-icon-only tut-3d-next-btn" data-cube-id="${id}" title="Step forward" aria-label="Step forward">${ICON_STEP_FORWARD}</button>
        <span class="tut-3d-status">0/1</span>
      </div>
    `;
  }

  function updateSandboxHistoryUi() {
    if (!container) return;
    const badge = container.querySelector('#notSandboxCountBadge');
    const list = container.querySelector('#notSandboxHistoryList');
    const undoBtn = container.querySelector('#notSandboxUndoBtn');
    const resetBtn = container.querySelector('#notSandboxResetBtn');
    const wideSliceRow = container.querySelector('#notSandboxSliceWideRow');

    if (badge) badge.textContent = `${sandboxMoves.length} turn${sandboxMoves.length === 1 ? '' : 's'}`;
    if (undoBtn) undoBtn.disabled = sandboxMoves.length === 0;
    if (resetBtn) resetBtn.disabled = sandboxMoves.length === 0;
    if (wideSliceRow) wideSliceRow.hidden = sandboxPuzzle === '222';

    if (list) {
      list.innerHTML = sandboxMoves.length === 0
        ? '<span class="free-moves-empty">Tap any move button above to watch how it turns the cube</span>'
        : sandboxMoves.map(m => `<span class="free-move-chip">${escapeHtml(m)}</span>`).join(' ');
    }
  }

  async function syncSandboxDisplay({ animateLast = false } = {}) {
    if (typeof window === 'undefined' || !sandboxDisplay?.player) return;
    const seq = sandboxMoves.join(' ');
    sandboxDisplay.event = sandboxPuzzle;
    sandboxDisplay.scramble = seq;
    sandboxDisplay.player.tempoScale = Number(getSimSpeed?.() || 1) || 1;
    applyColorsTo3DCube(sandboxDisplay);

    if (!seq) {
      sandboxIndexer = null;
      try {
        sandboxDisplay.player.pause();
        sandboxDisplay.player.controller?.jumpToStart?.({ flash: false });
      } catch {}
      return;
    }

    try {
      sandboxDisplay.player.pause();
      const idx = await sandboxDisplay.player.experimentalModel.indexer.get();
      sandboxIndexer = idx;
      if (animateLast && sandboxMoves.length >= 1) {
        const prevIdx = sandboxMoves.length - 2;
        if (prevIdx >= 0) {
          const ts = idx.indexToMoveStartTimestamp(prevIdx) + idx.moveDuration(prevIdx);
          sandboxDisplay.player.experimentalModel.timestampRequest.set(ts);
        } else {
          sandboxDisplay.player.controller?.jumpToStart?.({ flash: false });
        }
        setTimeout(() => { try { sandboxDisplay?.player?.play?.(); } catch {} }, 25);
      } else {
        sandboxDisplay.player.controller?.jumpToEnd?.({ flash: false });
      }
    } catch {}
  }

  async function mountSandboxCube() {
    if (!container || typeof window === 'undefined') return;
    const host = container.querySelector('#notSandboxCubeHost');
    if (!host) return;
    const gen = ++sandboxMountGen;
    const SD = await getSandboxScrambleDisplay();
    if (!SD || gen !== sandboxMountGen || !host.isConnected) return;

    const el = new SD();
    el.event = sandboxPuzzle;
    el.visualization = '3D';
    el.scramble = sandboxMoves.join(' ');
    if (el.player) {
      el.player.hintFacelets = getShowReflection?.() ? 'floating' : 'none';
      el.player.tempoScale = Number(getSimSpeed?.() || 1) || 1;
    }
    host.innerHTML = '';
    host.appendChild(el);
    sandboxDisplay = el;
    applyColorsTo3DCube(el);
    void resetCubeCamera(el, sandboxPuzzle);
    if (sandboxMoves.length > 0) void syncSandboxDisplay({ animateLast: false });
  }

  function appendSandboxMoves(movesStr) {
    const tokens = String(movesStr || '').trim().split(/\s+/).filter(Boolean);
    if (!tokens.length) return;
    const animateSingle = tokens.length === 1;
    sandboxMoves.push(...tokens);
    updateSandboxHistoryUi();
    if (animateSingle) {
      void syncSandboxDisplay({ animateLast: true });
    } else if (sandboxDisplay?.player) {
      const startAt = Math.max(0, sandboxMoves.length - tokens.length);
      sandboxDisplay.event = sandboxPuzzle;
      sandboxDisplay.scramble = sandboxMoves.join(' ');
      applyColorsTo3DCube(sandboxDisplay);
      sandboxDisplay.player.experimentalModel.indexer.get().then(idx => {
        sandboxIndexer = idx;
        if (startAt > 0) {
          const prev = startAt - 1;
          const ts = idx.indexToMoveStartTimestamp(prev) + idx.moveDuration(prev);
          sandboxDisplay.player.experimentalModel.timestampRequest.set(ts);
        } else {
          sandboxDisplay.player.controller?.jumpToStart?.({ flash: false });
        }
        setTimeout(() => { try { sandboxDisplay?.player?.play?.(); } catch {} }, 25);
      }).catch(() => {});
    }
  }

  function render() {
    if (!container) return;
    const isBig = sandboxPuzzle !== '222';
    container.innerHTML = `
      <div class="flb-wrap">
        <div class="study-header">
          <div class="study-track-title-wrap">
            <h2 class="study-track-title">NxN Notation &amp; Triggers<sup class="beta-sup" aria-label="Experimental">β</sup></h2>
            <span class="study-track-desc">Explore how cube letters, primes, doubles, slices, and 4-move triggers work on any puzzle size.</span>
          </div>
          <div class="oh-hand-switcher" role="group" aria-label="Choose sandbox puzzle size">
            <span class="oh-hand-label">Cube Size:</span>
            ${SANDBOX_PUZZLES.map(p => `
              <button type="button" class="study-ll-mode-btn ${sandboxPuzzle === p.id ? 'active' : ''}" data-not-puzzle="${p.id}" aria-pressed="${sandboxPuzzle === p.id}">${p.label}</button>
            `).join('')}
          </div>
        </div>

        <section class="guide-card guide-card-full not-sandbox-card">
          <div class="not-sandbox-layout">
            <div class="not-sandbox-stage">
              <div id="notSandboxCubeHost" class="not-sandbox-cube-host" aria-label="Interactive ${sandboxPuzzle} 3D notation cube">
                <span class="study-visual-loading">Loading 3D cube…</span>
              </div>
              <div class="not-sandbox-bar">
                <button type="button" class="btn btn-xs" id="notSandboxAngleBtn">${ICON_RESET_ANGLE}<span>Reset Angle</span></button>
                <button type="button" class="btn btn-xs" id="notSandboxUndoBtn" disabled>↶ Undo</button>
                <button type="button" class="btn btn-xs" id="notSandboxResetBtn" disabled>Reset Solved</button>
              </div>
            </div>

            <div class="not-sandbox-keypad-col">
              <div class="not-sandbox-keypad-head">
                <h3 class="guide-card-title" style="margin:0;">Free Face Turns</h3>
                <span id="notSandboxCountBadge" class="badge">0 turns</span>
              </div>
              <p class="hint" style="margin:4px 0 8px;">Always visible here — tap any turn to animate it immediately on the 3D cube.</p>
              <div class="free-moves-keypad not-always-open-keypad">
                <div class="free-moves-row free-moves-rot">
                  <span class="free-moves-row-label">Rotate:</span>
                  ${['x', "x'", 'y', "y'", 'z', "z'"].map(m => `<button type="button" class="btn-face-turn not-turn-btn" data-not-move="${m}">${m.toUpperCase()}</button>`).join('')}
                </div>
                <div class="free-moves-row free-moves-cw">
                  <span class="free-moves-row-label">CW:</span>
                  ${['U', 'D', 'L', 'R', 'F', 'B'].map(m => `<button type="button" class="btn-face-turn not-turn-btn" data-not-move="${m}">${m}</button>`).join('')}
                </div>
                <div class="free-moves-row free-moves-ccw">
                  <span class="free-moves-row-label">CCW:</span>
                  ${["U'", "D'", "L'", "R'", "F'", "B'"].map(m => `<button type="button" class="btn-face-turn not-turn-btn" data-not-move="${m}">${m}</button>`).join('')}
                </div>
                <div class="free-moves-row">
                  <span class="free-moves-row-label">180°:</span>
                  ${['U2', 'D2', 'L2', 'R2', 'F2', 'B2'].map(m => `<button type="button" class="btn-face-turn not-turn-btn" data-not-move="${m}">${m}</button>`).join('')}
                </div>
                <div id="notSandboxSliceWideRow" class="free-moves-row" ${isBig ? '' : 'hidden'}>
                  <span class="free-moves-row-label">Slice/Wide:</span>
                  ${['M', "M'", 'M2', 'Rw', "Rw'", 'Uw', "Uw'"].map(m => `<button type="button" class="btn-face-turn not-turn-btn" data-not-move="${m}">${m}</button>`).join('')}
                </div>
              </div>
              <div class="free-moves-history" style="margin-top:8px;">
                <span class="free-moves-history-label">Moves:</span>
                <div id="notSandboxHistoryList" class="free-moves-list"></div>
              </div>
            </div>
          </div>
        </section>

        <section class="guide-card guide-card-full">
          <h3 class="guide-card-title">&#x1F524; Face Letters (Look Straight at That Face for Clockwise)</h3>
          <div class="tut-notation-grid">
            ${NOTATION_FACE_MOVES.map((m, idx) => {
              const cid = `not-face-${m.letter}`;
              return `
                <article class="tut-notation-card tut-3d-card">
                  <div class="tut-notation-top">
                    <div class="tut-notation-title-pair">
                      <code class="tut-letter">${escapeHtml(m.letter)}</code>
                      <strong>${escapeHtml(m.face)}</strong>
                    </div>
                    <button type="button" class="btn btn-xs not-try-big-btn" data-not-seq="${escapeHtml(m.demoAlg)}" title="Play on the big cube above">Try Above</button>
                  </div>
                  <div class="tut-3d-wrap" data-cube-id="${cid}" data-cube-puzzle="${sandboxPuzzle}" data-cube-setup="${escapeHtml(m.demoSetup)}" data-cube-moves="${escapeHtml(m.demoAlg)}">
                    <span class="study-visual-loading">3D Cube</span>
                  </div>
                  ${renderTurnCardControls(cid)}
                  <p>${escapeHtml(m.desc)}</p>
                </article>
              `;
            }).join('')}
          </div>
        </section>

        <section class="guide-card guide-card-full">
          <h3 class="guide-card-title">&#x1F504; Turn Modifiers, Slices &amp; Rotations</h3>
          <div class="tut-notation-grid">
            ${NOTATION_MODIFIERS.map(mod => {
              const puz = mod.puzzle || sandboxPuzzle;
              return `
                <article class="tut-notation-card tut-3d-card">
                  <div class="tut-notation-top">
                    <strong>${escapeHtml(mod.token)}</strong>
                    <span class="badge">${escapeHtml(mod.meaning)}</span>
                  </div>
                  <div class="tut-3d-wrap" data-cube-id="${mod.id}" data-cube-puzzle="${puz}" data-cube-setup="${escapeHtml(mod.demoSetup)}" data-cube-moves="${escapeHtml(mod.demoAlg)}">
                    <span class="study-visual-loading">3D Cube</span>
                  </div>
                  ${renderTurnCardControls(mod.id)}
                  <p>${escapeHtml(mod.desc)}</p>
                </article>
              `;
            }).join('')}
          </div>
        </section>

        <section class="guide-card guide-card-full">
          <h3 class="guide-card-title">&#x26A1; Essential 4-Move Triggers (Play Directly in 3D)</h3>
          <p class="hint" style="margin-bottom: 10px;">Algorithms combine these short 4-move triggers. Play any card directly in 3D or test it on the big cube above.</p>
          <div class="tut-trigger-grid">
            ${NOTATION_TRIGGERS.map((tr, idx) => `
              <article class="tut-trigger-card tut-3d-card">
                <div class="tut-trigger-head">
                  <strong>${escapeHtml(tr.name)}</strong>
                  <span class="badge">${escapeHtml(tr.hand)}</span>
                </div>
                <div class="tut-3d-wrap" data-cube-id="${tr.id}" data-cube-puzzle="${sandboxPuzzle}" data-cube-setup="${escapeHtml(tr.setup)}" data-cube-moves="${escapeHtml(tr.alg)}">
                  <span class="study-visual-loading">3D Cube</span>
                </div>
                ${renderTurnCardControls(tr.id)}
                <code class="tut-alg-code">${escapeHtml(tr.alg)}</code>
                <p>${escapeHtml(tr.desc)}</p>
                <div class="tut-alg-actions">
                  <button type="button" class="btn btn-xs not-try-big-btn" data-not-seq="${escapeHtml(tr.alg)}">Try Above</button>
                  <button type="button" class="btn btn-xs tut-trig-quicksim-btn" data-not-trig="${idx}">${ICON_POPUP_SIM}<span>Popup</span></button>
                  <button type="button" class="btn btn-xs tut-trig-opensim-btn" data-not-trig="${idx}">${ICON_PLAY}<span>Simulator</span></button>
                </div>
              </article>
            `).join('')}
          </div>
        </section>

        <section class="guide-card guide-card-full">
          <h3 class="guide-card-title">&#x1F4D6; Plain-English Speedcubing Glossary</h3>
          <div class="tut-glossary-grid">
            <div class="tut-glossary-item">
              <strong>Face vs. Layer</strong>
              <p>A <strong>Face</strong> only matches stickers on one side. A <strong>Layer</strong> matches both that face and all side colors around it.</p>
            </div>
            <div class="tut-glossary-item">
              <strong>Bar / Headlights</strong>
              <p>Two matching stickers on the side of a corner pair (touching = Bar; corner headlights = two corners on a face showing the same side color).</p>
            </div>
            <div class="tut-glossary-item">
              <strong>Sune &amp; Antisune</strong>
              <p><strong>Sune</strong> (<code>R U R' U R U2 R'</code>) and <strong>Antisune</strong> (its exact reverse: <code>R U2 R' U' R U' R'</code>) twist top corners without memorizing dozens of cases.</p>
            </div>
            <div class="tut-glossary-item">
              <strong>AUF (Adjust U Face)</strong>
              <p>Turning the top layer (<code>U</code>, <code>U'</code>, or <code>U2</code>) before or after an algorithm so colors line up.</p>
            </div>
          </div>
        </section>
      </div>
    `;

    updateSandboxHistoryUi();
    bindEvents();
    void mountSandboxCube();
    void inlineCubes.mountAll(container, { getSimSpeed, getShowReflection });
  }

  function bindEvents() {
    if (!container) return;

    container.querySelectorAll('[data-not-puzzle]').forEach(btn => {
      btn.addEventListener('click', () => {
        const nextP = btn.dataset.notPuzzle;
        if (nextP && nextP !== sandboxPuzzle) {
          sandboxPuzzle = nextP;
          sandboxMoves = [];
          render();
        }
      });
    });

    container.querySelectorAll('.not-turn-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const mv = btn.dataset.notMove;
        if (mv) appendSandboxMoves(mv);
      });
    });

    container.querySelectorAll('.not-try-big-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const seq = btn.dataset.notSeq;
        if (seq) appendSandboxMoves(seq);
      });
    });

    container.querySelector('#notSandboxUndoBtn')?.addEventListener('click', () => {
      if (!sandboxMoves.length) return;
      sandboxMoves.pop();
      updateSandboxHistoryUi();
      void syncSandboxDisplay({ animateLast: false });
    });

    container.querySelector('#notSandboxResetBtn')?.addEventListener('click', () => {
      sandboxMoves = [];
      updateSandboxHistoryUi();
      void syncSandboxDisplay({ animateLast: false });
    });

    container.querySelector('#notSandboxAngleBtn')?.addEventListener('click', () => {
      void resetCubeCamera(sandboxDisplay, sandboxPuzzle);
    });

    const trigSolutions = NOTATION_TRIGGERS.map(tr => ({
      label: `${tr.name} (${tr.alg})`,
      shortLabel: tr.name,
      face: 'white',
      moves: tr.alg,
      moveCount: tr.alg.split(' ').filter(Boolean).length,
      inspection: 'none',
      scramble: tr.setup,
      note: tr.desc
    }));

    container.querySelectorAll('.tut-trig-quicksim-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.notTrig) || 0;
        const item = trigSolutions[idx] || trigSolutions[0];
        onQuickSimSolutions?.({
          puzzle: sandboxPuzzle,
          scramble: item.scramble,
          solutions: trigSolutions,
          activeIndex: idx,
          title: 'Essential 4-Move Triggers'
        });
      });
    });

    container.querySelectorAll('.tut-trig-opensim-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = Number(btn.dataset.notTrig) || 0;
        const tr = NOTATION_TRIGGERS[idx] || NOTATION_TRIGGERS[0];
        onSimulateCase?.(
          { id: tr.id, name: `Trigger: ${tr.name}`, setup: tr.setup },
          { id: `${tr.id}-alg`, alg: tr.alg, note: tr.desc }
        );
      });
    });
  }

  function syncSpeed(spd) {
    if (sandboxDisplay?.player) {
      try { sandboxDisplay.player.tempoScale = Number(spd) || 1; } catch {}
    }
    inlineCubes.syncSpeed(spd);
  }

  function teardown() {
    sandboxMountGen++;
    if (sandboxDisplay) {
      try {
        sandboxDisplay.player?.pause?.();
        sandboxDisplay.remove?.();
      } catch {}
      sandboxDisplay = null;
    }
    sandboxIndexer = null;
    inlineCubes.teardown();
  }

  return {
    render,
    teardown,
    syncSpeed,
    getSandboxPuzzle: () => sandboxPuzzle,
    getSandboxMoves: () => [...sandboxMoves]
  };
}
