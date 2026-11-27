// Standalone NxN Notation & Triggers View (Beta Experimental Mode)
// Features a large interactive 3D sandbox cube with Free Face Turns always visible,
// puzzle size switcher (2x2 / 3x3 / 4x4 / 5x5), and inline playable 3D cubes on every notation/trigger card.

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
  { id: 'mod-ccw', token: "R' (Prime)", meaning: '90° Counter-Clockwise', demoAlg: "R'", demoSetup: 'R', desc: 'Quarter turn in the opposite direction — read as "R prime".' },
  { id: 'mod-2', token: 'R2 (Double)', meaning: '180° Half-Turn', demoAlg: 'R2', demoSetup: 'R2', desc: 'Half turn (two quarter turns in either direction).' },
  { id: 'mod-rot-x', token: 'x', meaning: 'Tilt (follows R)', demoAlg: 'x', demoSetup: "x'", desc: 'Re-grip whole cube upward on the R axis (Front moves to Top).' },
  { id: 'mod-rot-y', token: 'y', meaning: 'Spin (follows U)', demoAlg: 'y', demoSetup: "y'", desc: 'Re-grip whole cube horizontally on the U axis (Right moves to Front).' },
  { id: 'mod-rot-z', token: 'z', meaning: 'Roll (follows F)', demoAlg: 'z', demoSetup: "z'", desc: 'Re-grip whole cube sideways clockwise on the F axis (Top moves to Right).' }
];

export const NOTATION_SLICE_MOVES = [
  {
    id: 'slice-m',
    letter: 'M',
    face: 'Middle (follows L)',
    demoAlg: 'M',
    demoSetup: "M'",
    desc: 'Vertical middle slice between L & R moving downward in front (follows L, used in Ua/Ub & Roux).'
  },
  {
    id: 'slice-e',
    letter: 'E',
    face: 'Equatorial (follows D)',
    demoAlg: 'E',
    demoSetup: "E'",
    desc: 'Horizontal equator slice between U & D moving left-to-right in front (follows D).'
  },
  {
    id: 'slice-s',
    letter: 'S',
    face: 'Standing (follows F)',
    demoAlg: 'S',
    demoSetup: "S'",
    desc: 'Vertical standing slice between F & B turning clockwise from the front (follows F — common in modern OLL/F2L algs).'
  }
];

export const NOTATION_INNER_SLICE_MOVES = [
  { id: 'inner-2r', letter: '2R', face: 'Inner Right', demoAlg: '2R', demoSetup: "2R'", desc: 'Single 2nd inner layer from the Right face only (outer R face stays still).' },
  { id: 'inner-2l', letter: '2L', face: 'Inner Left', demoAlg: '2L', demoSetup: "2L'", desc: 'Single 2nd inner layer from the Left face only (outer L face stays still).' },
  { id: 'inner-2u', letter: '2U', face: 'Inner Up', demoAlg: '2U', demoSetup: "2U'", desc: 'Single 2nd inner layer from the Top face only (outer U face stays still).' },
  { id: 'inner-2d', letter: '2D', face: 'Inner Down', demoAlg: '2D', demoSetup: "2D'", desc: 'Single 2nd inner layer from the Bottom face only (outer D face stays still).' },
  { id: 'inner-2f', letter: '2F', face: 'Inner Front', demoAlg: '2F', demoSetup: "2F'", desc: 'Single 2nd inner layer from the Front face only (outer F face stays still).' },
  { id: 'inner-2b', letter: '2B', face: 'Inner Back', demoAlg: '2B', demoSetup: "2B'", desc: 'Single 2nd inner layer from the Back face only (outer B face stays still).' }
];

export const NOTATION_WIDE_MOVES = [
  { id: 'wide-rw', letter: 'Rw', lower: 'r', face: 'Right Wide', demoAlg: 'Rw', demoSetup: "Rw'", desc: 'Turns both the Right outer layer and its adjacent inner slice together.' },
  { id: 'wide-lw', letter: 'Lw', lower: 'l', face: 'Left Wide', demoAlg: 'Lw', demoSetup: "Lw'", desc: 'Turns both the Left outer layer and its adjacent inner slice together.' },
  { id: 'wide-uw', letter: 'Uw', lower: 'u', face: 'Up Wide', demoAlg: 'Uw', demoSetup: "Uw'", desc: 'Turns both the Top outer layer and its adjacent inner slice together.' },
  { id: 'wide-dw', letter: 'Dw', lower: 'd', face: 'Down Wide', demoAlg: 'Dw', demoSetup: "Dw'", desc: 'Turns both the Bottom outer layer and its adjacent inner slice together.' },
  { id: 'wide-fw', letter: 'Fw', lower: 'f', face: 'Front Wide', demoAlg: 'Fw', demoSetup: "Fw'", desc: 'Turns both the Front outer layer and its adjacent inner slice together.' },
  { id: 'wide-bw', letter: 'Bw', lower: 'b', face: 'Back Wide', demoAlg: 'Bw', demoSetup: "Bw'", desc: 'Turns both the Back outer layer and its adjacent inner slice together.' }
];

export const NOTATION_WIDE_3_MOVES = [
  { id: 'wide-3rw', letter: '3Rw', face: '3-Layer Right Wide', demoAlg: '3Rw', demoSetup: "3Rw'", desc: 'Turns the Right face plus both inner layers to the center (3 layers on 5x5).' },
  { id: 'wide-3uw', letter: '3Uw', face: '3-Layer Up Wide', demoAlg: '3Uw', demoSetup: "3Uw'", desc: 'Turns the Top face plus both inner layers to the center (3 layers on 5x5).' },
  { id: 'wide-3fw', letter: '3Fw', face: '3-Layer Front Wide', demoAlg: '3Fw', demoSetup: "3Fw'", desc: 'Turns the Front face plus both inner layers to the center (3 layers on 5x5).' }
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

export const SANDBOX_PUZZLES = [
  { id: '222', label: '2x2' },
  { id: '333', label: '3x3' },
  { id: '444', label: '4x4' },
  { id: '555', label: '5x5' }
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

  function renderMoveCard(cid, displayToken, title, setup, alg, desc, puzzle = sandboxPuzzle) {
    return `
      <article class="tut-notation-card tut-3d-card">
        <div class="tut-notation-top">
          <div class="tut-notation-title-pair">
            <code class="tut-letter">${escapeHtml(displayToken)}</code>
            <strong>${escapeHtml(title)}</strong>
          </div>
          <button type="button" class="btn btn-xs not-try-big-btn" data-not-seq="${escapeHtml(alg)}" title="Play on the big cube above">Try Above</button>
        </div>
        <div class="tut-3d-wrap" data-cube-id="${cid}" data-cube-puzzle="${puzzle}" data-cube-setup="${escapeHtml(setup)}" data-cube-moves="${escapeHtml(alg)}">
          <span class="study-visual-loading">3D Cube</span>
        </div>
        ${renderTurnCardControls(cid)}
        <p>${escapeHtml(desc)}</p>
      </article>
    `;
  }

  function updateSandboxHistoryUi() {
    if (!container) return;
    const badge = container.querySelector('#notSandboxCountBadge');
    const list = container.querySelector('#notSandboxHistoryList');
    const undoBtn = container.querySelector('#notSandboxUndoBtn');
    const resetBtn = container.querySelector('#notSandboxResetBtn');

    if (badge) badge.textContent = `${sandboxMoves.length} turn${sandboxMoves.length === 1 ? '' : 's'}`;
    if (undoBtn) undoBtn.disabled = sandboxMoves.length === 0;
    if (resetBtn) resetBtn.disabled = sandboxMoves.length === 0;

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

  function renderKeypadButtons(moves) {
    return moves.map(m => `<button type="button" class="btn-face-turn not-turn-btn" data-not-move="${m}">${m}</button>`).join('');
  }

  function renderSliceSection() {
    const hasMiddleSlices = sandboxPuzzle === '333' || sandboxPuzzle === '555';
    const hasInnerSlices = sandboxPuzzle === '444' || sandboxPuzzle === '555';
    if (!hasMiddleSlices && !hasInnerSlices) return '';

    const middleCards = NOTATION_SLICE_MOVES
      .map(s => renderMoveCard(s.id, s.letter, s.face, s.demoSetup, s.demoAlg, s.desc))
      .join('');
    const innerCards = NOTATION_INNER_SLICE_MOVES
      .map(s => renderMoveCard(s.id, s.letter, s.face, s.demoSetup, s.demoAlg, s.desc))
      .join('');

    if (sandboxPuzzle === '333') {
      return `
        <section id="notSliceSection" class="guide-card guide-card-full">
          <h3 class="guide-card-title">&#x2702;&#xFE0F; Slice Moves (M, E, S)</h3>
          <div class="not-section-callout">
            <strong>3 Middle Slices:</strong> Slice moves turn only the center layer between two outer faces — <code>M</code> follows <code>L</code>, <code>E</code> follows <code>D</code>, and <code>S</code> follows <code>F</code>.
          </div>
          <div class="tut-notation-grid">${middleCards}</div>
        </section>
      `;
    }
    if (sandboxPuzzle === '444') {
      return `
        <section id="notSliceSection" class="guide-card guide-card-full">
          <h3 class="guide-card-title">&#x2702;&#xFE0F; Single Inner Slices (4x4: 2R–2B)</h3>
          <div class="not-section-callout">
            4x4 is an even-layered cube, so it has no single center slice (<code>M</code>/<code>E</code>/<code>S</code>). Instead, turning just one inner slice is written with a layer number like <code>2R</code>, <code>2L</code>, <code>2U</code>, <code>2D</code>, <code>2F</code>, or <code>2B</code>.
          </div>
          <div class="tut-notation-grid">${innerCards}</div>
        </section>
      `;
    }
    return `
      <section id="notSliceSection" class="guide-card guide-card-full">
        <h3 class="guide-card-title">&#x2702;&#xFE0F; Slice Moves (5x5: Center M/E/S &amp; Inner 2R–2B)</h3>
        <h4 class="not-subsection-title">Center Middle Slices (M, E, S)</h4>
        <div class="tut-notation-grid">${middleCards}</div>
        <h4 class="not-subsection-title">Single Inner Slices (2nd Layer Only: 2R–2B)</h4>
        <div class="tut-notation-grid">${innerCards}</div>
      </section>
    `;
  }

  function renderWideSection() {
    if (sandboxPuzzle === '222') return '';
    const is333 = sandboxPuzzle === '333';
    const is555 = sandboxPuzzle === '555';
    const wideCards = NOTATION_WIDE_MOVES
      .map(w => renderMoveCard(w.id, is333 ? `${w.letter} / ${w.lower}` : w.letter, w.face, w.demoSetup, w.demoAlg, w.desc))
      .join('');
    const wide3Cards = is555
      ? NOTATION_WIDE_3_MOVES.map(w => renderMoveCard(w.id, w.letter, w.face, w.demoSetup, w.demoAlg, w.desc)).join('')
      : '';

    return `
      <section id="notWideSection" class="guide-card guide-card-full">
        <h3 class="guide-card-title">&#x21C4; Wide Moves (2+ Layers Together)</h3>
        <div class="not-section-callout">
          ${is333
            ? '<strong>Lowercase shorthand:</strong> On 3x3, lowercase letters (<code>r</code>, <code>l</code>, <code>u</code>, <code>d</code>, <code>f</code>, <code>b</code>) mean the <strong>exact same move</strong> as <code>Rw</code>, <code>Lw</code>, <code>Uw</code>, <code>Dw</code>, <code>Fw</code>, <code>Bw</code> (outer layer + middle slice together). Many OLL &amp; F2L algs use lowercase <code>r</code>.'
            : '<strong>Wide vs. Inner Slice:</strong> <code>Rw</code> (and lowercase <code>r</code> on 3x3 algs) turns the outer face <strong>plus</strong> its inner neighbor together, whereas <code>2R</code> moves only the single inner slice.'}
        </div>
        <div class="tut-notation-grid">${wideCards}</div>
        ${is555 ? `
          <h4 class="not-subsection-title">3-Layer Wide Turns (5x5: 3Rw, 3Uw, 3Fw)</h4>
          <div class="tut-notation-grid">${wide3Cards}</div>
        ` : ''}
      </section>
    `;
  }

  function render() {
    if (!container) return;
    const hasMiddleSlices = sandboxPuzzle === '333' || sandboxPuzzle === '555';
    const hasInnerSlices = sandboxPuzzle === '444' || sandboxPuzzle === '555';
    const hasWideMoves = sandboxPuzzle !== '222';
    const hasWide3Moves = sandboxPuzzle === '555';
    container.innerHTML = `
      <div class="flb-wrap">
        <div class="study-header">
          <div class="study-track-title-wrap">
            <h2 class="study-track-title">NxN Notation &amp; Triggers<sup class="beta-sup" aria-label="Experimental">β</sup></h2>
            <span class="study-track-desc">Explore how face turns, slices, wide moves, rotations, and 4-move triggers work on 2x2 through 5x5.</span>
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
                  ${renderKeypadButtons(['U', 'D', 'L', 'R', 'F', 'B'])}
                </div>
                <div class="free-moves-row free-moves-ccw">
                  <span class="free-moves-row-label">CCW:</span>
                  ${renderKeypadButtons(["U'", "D'", "L'", "R'", "F'", "B'"])}
                </div>
                <div class="free-moves-row">
                  <span class="free-moves-row-label">180°:</span>
                  ${renderKeypadButtons(['U2', 'D2', 'L2', 'R2', 'F2', 'B2'])}
                </div>
                ${hasMiddleSlices ? `
                  <div id="notSandboxSliceRow" class="free-moves-row">
                    <span class="free-moves-row-label">Slice:</span>
                    ${renderKeypadButtons(['M', "M'", 'M2', 'E', "E'", 'E2', 'S', "S'", 'S2'])}
                  </div>
                ` : ''}
                ${hasInnerSlices ? `
                  <div id="notSandboxInnerSliceRow" class="free-moves-row">
                    <span class="free-moves-row-label">Inner:</span>
                    ${renderKeypadButtons(['2U', "2U'", '2D', "2D'", '2L', "2L'", '2R', "2R'", '2F', "2F'", '2B', "2B'"])}
                  </div>
                ` : ''}
                ${hasWideMoves ? `
                  <div id="notSandboxWideRow" class="free-moves-row">
                    <span class="free-moves-row-label">Wide:</span>
                    ${renderKeypadButtons(['Uw', "Uw'", 'Dw', "Dw'", 'Lw', "Lw'", 'Rw', "Rw'", 'Fw', "Fw'", 'Bw', "Bw'"])}
                  </div>
                ` : ''}
                ${hasWide3Moves ? `
                  <div id="notSandboxWide3Row" class="free-moves-row">
                    <span class="free-moves-row-label">3-Wide:</span>
                    ${renderKeypadButtons(['3Uw', "3Uw'", '3Dw', "3Dw'", '3Lw', "3Lw'", '3Rw', "3Rw'", '3Fw', "3Fw'", '3Bw', "3Bw'"])}
                  </div>
                ` : ''}
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
            ${NOTATION_FACE_MOVES.map(m =>
              renderMoveCard(`not-face-${m.letter}`, m.letter, m.face, m.demoSetup, m.demoAlg, m.desc)
            ).join('')}
          </div>
        </section>

        <section class="guide-card guide-card-full">
          <h3 class="guide-card-title">&#x1F504; Turn Modifiers &amp; Cube Rotations</h3>
          <div class="tut-notation-grid">
            ${NOTATION_MODIFIERS.map(mod => `
              <article class="tut-notation-card tut-3d-card">
                <div class="tut-notation-top">
                  <strong>${escapeHtml(mod.token)}</strong>
                  <div class="tut-notation-title-pair">
                    <span class="badge">${escapeHtml(mod.meaning)}</span>
                    <button type="button" class="btn btn-xs not-try-big-btn" data-not-seq="${escapeHtml(mod.demoAlg)}" title="Play on the big cube above">Try Above</button>
                  </div>
                </div>
                <div class="tut-3d-wrap" data-cube-id="${mod.id}" data-cube-puzzle="${sandboxPuzzle}" data-cube-setup="${escapeHtml(mod.demoSetup)}" data-cube-moves="${escapeHtml(mod.demoAlg)}">
                  <span class="study-visual-loading">3D Cube</span>
                </div>
                ${renderTurnCardControls(mod.id)}
                <p>${escapeHtml(mod.desc)}</p>
              </article>
            `).join('')}
          </div>
        </section>

        ${renderSliceSection()}
        ${renderWideSection()}

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
