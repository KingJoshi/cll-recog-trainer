// Beginner 2x2 Tutorial + Interactive NxN Notation & Triggers Guide
// Low-memorization introduction placed before 1st Face, with direct 3D Quick Sim & Simulator links.

import { escapeHtml } from '../../services/htmlUtils.js';
import { ICON_PLAY, ICON_POPUP_SIM } from '../../ui/transportIcons.js';

export const TUTORIAL_BEGINNER_STEPS = [
  {
    id: 'step-1-white',
    stepNum: 1,
    title: 'Solve the White Layer (Bottom)',
    badge: 'Repeats Righty',
    goal: 'Place all 4 White corners on the bottom so their side colors also match.',
    alg: "R U R' U'",
    algLabel: 'Righty',
    setup: "z2 U R U' R'",
    instructions: [
      'Hold 1 solved White corner in the Back-Left bottom spot.',
      'Find another White corner on top and turn the top layer (U) until it sits directly above the spot it belongs in (Front-Right).',
      "Repeat <strong>Righty</strong> (<code>R U R' U'</code>) 1, 3, or 5 times until the White corner drops into the bottom with matching side colors."
    ],
    tip: 'If the White sticker starts on the bottom in the wrong spot or twisted, do one Righty to pop it back up to the top layer.'
  },
  {
    id: 'step-2-yellow',
    stepNum: 2,
    title: 'Twist All 4 Yellow Corners',
    badge: 'Same Righty Move',
    goal: 'Flip the cube upside-down (Yellow on bottom) and repeat Righty until all 4 Yellow stickers face down.',
    alg: "R U R' U' R U R' U' D R U R' U' R U R' U' R U R' U' R U R' U' D'",
    algLabel: 'Righty ×2 + D + Righty ×4',
    setup: "D U R U' R' U R U' R' U R U' R' U R U' R' D' U R U' R' U R U' R'",
    instructions: [
      'Turn the whole cube upside-down so the solved White layer is on <strong>Top</strong> and Yellow is on <strong>Bottom</strong>.',
      "Look at the Front-Right bottom corner: if Yellow is not facing down, repeat <strong>Righty</strong> (<code>R U R' U'</code>) 2 or 4 times until Yellow points down (always finish the 4th move <code>U'</code>).",
      'Turn <strong>ONLY the bottom layer</strong> (<code>D</code>) to bring the next unsolved Yellow corner to Front-Right, and repeat — never rotate the whole cube mid-step.'
    ],
    tip: 'Even though the White top looks scrambled while twisting Yellow corners, it automatically restores once the final corner faces Yellow down.'
  },
  {
    id: 'step-3-pll',
    stepNum: 3,
    title: 'Match Top Side Colors (1 Algorithm)',
    badge: 'Only 1 Alg to Learn',
    goal: 'Swap the final misplaced top corners so every side matches.',
    alg: "R U R' U' R' F R2 U' R' U' R U R' F'",
    algLabel: 'Corner Swap (T-Perm)',
    setup: "z2 R U R' U' R' F R2 U' R' U' R U R' F'",
    instructions: [
      'Turn the cube back right-side up (White on Bottom, Yellow on Top).',
      'Look around the top sides for a matching pair of side stickers (a <strong>Bar</strong>). Put that matching Bar on the <strong>Left</strong>.',
      'Perform the single <strong>Corner Swap</strong> algorithm below. If no Bar existed at first, run it once to create a Bar, place the Bar on the Left, and run it once more.'
    ],
    tip: 'Once you are comfortable solving 2x2 reliably with these 3 steps, explore <strong>Ortega (1st Face + PBL)</strong> or <strong>LBL</strong> to halve your move count!'
  }
];

export const NOTATION_FACE_MOVES = [
  { letter: 'R', face: 'Right', desc: 'Clockwise if looking directly at the Right face (away from you).', demoAlg: 'R', demoSetup: "R'" },
  { letter: 'L', face: 'Left', desc: 'Clockwise if looking directly at the Left face (toward you).', demoAlg: 'L', demoSetup: "L'" },
  { letter: 'U', face: 'Up (Top)', desc: 'Clockwise if looking down at the Top face (push right-to-left).', demoAlg: 'U', demoSetup: "U'" },
  { letter: 'D', face: 'Down (Bottom)', desc: 'Clockwise if looking up at the Bottom face (push left-to-right).', demoAlg: 'D', demoSetup: "D'" },
  { letter: 'F', face: 'Front', desc: 'Clockwise like turning a steering wheel to the right.', demoAlg: 'F', demoSetup: "F'" },
  { letter: 'B', face: 'Back', desc: 'Clockwise if looking at the Back face (left when viewed from front).', demoAlg: 'B', demoSetup: "B'" }
];

export const NOTATION_MODIFIERS = [
  { token: 'No Symbol (e.g. R)', meaning: '90° Clockwise', demoAlg: 'R', demoSetup: "R'", desc: 'Quarter turn clockwise when staring straight at that face.' },
  { token: "Prime ' (e.g. R')", meaning: '90° Counter-Clockwise', demoAlg: "R'", demoSetup: 'R', desc: "Quarter turn in the opposite direction — called \"R prime\"." },
  { token: 'Double 2 (e.g. R2)', meaning: '180° Half-Turn', demoAlg: 'R2', demoSetup: 'R2', desc: 'Half turn (two quarter turns in either direction).' },
  { token: 'Wide Rw / Uw (4x4+)', meaning: '2 Layers Together', demoAlg: 'R U', demoSetup: "U' R'", desc: 'On 3x3+ big cubes, Rw (or lowercase r) turns both the outer layer and inner slice together.' },
  { token: 'Rotations x, y, z', meaning: 'Whole-Cube Tilt', demoAlg: 'y', demoSetup: "y'", desc: 'Rotate the whole cube without turning layers: x follows R, y follows U, z follows F.' }
];

export const NOTATION_TRIGGERS = [
  {
    id: 'trig-righty',
    name: 'Righty',
    alg: "R U R' U'",
    setup: "U R U' R'",
    hand: 'Right Hand',
    desc: 'The most essential 4-move building block in cubing: right up, top left, right down, top back.'
  },
  {
    id: 'trig-inv-righty',
    name: 'Inverse Righty',
    alg: "U R U' R'",
    setup: "R U R' U'",
    hand: 'Right Hand',
    desc: 'Exact reverse of Righty — pulls a top corner cleanly down into Front-Right.'
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
    desc: 'Exact reverse of Lefty — inserts a top corner cleanly into Front-Left.'
  },
  {
    id: 'trig-sledge',
    name: 'Sledgehammer',
    alg: "R' F R F'",
    setup: "F R' F' R",
    hand: 'Right + Front',
    desc: 'Fast 4-move front trigger used across 2x2 layers, OLL, and 3x3 F2L edge control.'
  },
  {
    id: 'trig-hedge',
    name: 'Hedgeslammer',
    alg: "F R' F' R",
    setup: "R' F R F'",
    hand: 'Inverse Sledge',
    desc: 'Exact reverse of Sledgehammer; frequently builds bars or solves last-layer corners smoothly.'
  }
];

export function createTwoByTwoTutorialState() {
  return {
    subTab: 'beginner' // 'beginner' | 'notation'
  };
}

export function renderTwoByTwoTutorialHtml(state) {
  const activeTab = state?.subTab === 'notation' ? 'notation' : 'beginner';
  return `
    <div class="flb-wrap">
      <div class="flb-subtabs" role="tablist" aria-label="2x2 Tutorial Sections">
        <button type="button" class="flb-subtab-btn ${activeTab === 'beginner' ? 'active' : ''}" data-tut-tab="beginner" role="tab" aria-selected="${activeTab === 'beginner'}">&#x1F393; How to Solve 2x2 (Beginner)</button>
        <button type="button" class="flb-subtab-btn ${activeTab === 'notation' ? 'active' : ''}" data-tut-tab="notation" role="tab" aria-selected="${activeTab === 'notation'}">&#x1F524; NxN Notation &amp; Triggers</button>
      </div>

      ${activeTab === 'beginner' ? renderBeginnerTab() : renderNotationTab()}
    </div>
  `;
}

function renderBeginnerTab() {
  return `
    <div class="guide-card-stack">
      <section class="guide-card guide-card-full flb-hero-card">
        <h3 class="guide-card-title">&#x1F393; Beginner 2x2 Method &mdash; Minimal Memorization</h3>
        <p class="flb-hero-lead">
          This starter method trades a few extra moves for <strong>minimal memory</strong>: you only need one 4-move pattern (<strong>Righty</strong>: <code>R U R' U'</code>) plus <strong>one</strong> corner-swap algorithm at the end. Play each step below in 3D or open it in the interactive <strong>Simulator</strong>.
        </p>
      </section>

      <div class="tut-steps-grid">
        ${TUTORIAL_BEGINNER_STEPS.map((st, idx) => `
          <article class="guide-card tut-step-card">
            <div class="tut-step-head">
              <div>
                <div class="tut-step-kicker">Step ${st.stepNum} of 3</div>
                <h3 class="guide-card-title" style="margin: 2px 0 0;">${escapeHtml(st.title)}</h3>
              </div>
              <span class="badge badge-case">${escapeHtml(st.badge)}</span>
            </div>
            <p class="tut-step-goal">${escapeHtml(st.goal)}</p>
            <ol class="tut-step-list">
              ${st.instructions.map(line => `<li>${line}</li>`).join('')}
            </ol>
            <div class="tut-alg-bar">
              <div>
                <div class="tut-alg-label">${escapeHtml(st.algLabel)}</div>
                <code class="tut-alg-code">${escapeHtml(st.alg)}</code>
              </div>
              <div class="tut-alg-actions">
                <button type="button" class="btn btn-xs btn-primary tut-step-quicksim-btn" data-tut-step="${idx}">${ICON_POPUP_SIM}<span>3D Sim</span></button>
                <button type="button" class="btn btn-xs tut-step-opensim-btn" data-tut-step="${idx}">${ICON_PLAY}<span>Simulator</span></button>
              </div>
            </div>
            <p class="tut-step-tip"><strong>Tip:</strong> ${escapeHtml(st.tip)}</p>
          </article>
        `).join('')}
      </div>

      <section class="guide-card guide-card-full">
        <h3 class="guide-card-title">&#x1F680; Where to Go Next</h3>
        <ul class="guide-list">
          <li><strong>Beginner LBL:</strong> Learn the 7 top-face patterns so you never have to turn the cube upside-down in Step 2.</li>
          <li><strong>1st Face &amp; Ortega:</strong> Build any bottom face ignoring side colors first, then finish both layers in 1 short look — much faster with only 5 extra algorithms.</li>
        </ul>
      </section>
    </div>
  `;
}

function renderNotationTab() {
  return `
    <div class="guide-card-stack">
      <section class="guide-card guide-card-full">
        <h3 class="guide-card-title">&#x1F524; Face Letters &amp; Turn Modifiers (Works on 2x2, 3x3 &amp; Big Cubes)</h3>
        <p class="hint" style="margin-bottom: 10px;">Every letter names a face as if you are looking straight at it. Click <strong>3D Sim</strong> on any move or trigger to watch it animated step-by-step.</p>
        <div class="tut-notation-grid">
          ${NOTATION_FACE_MOVES.map((m, idx) => `
            <div class="tut-notation-card">
              <div class="tut-notation-top">
                <code class="tut-letter">${escapeHtml(m.letter)}</code>
                <strong>${escapeHtml(m.face)}</strong>
                <button type="button" class="btn btn-xs tut-move-sim-btn" data-tut-move="${idx}" aria-label="Watch ${escapeHtml(m.letter)} turn in 3D">${ICON_POPUP_SIM}<span>Watch</span></button>
              </div>
              <p>${escapeHtml(m.desc)}</p>
            </div>
          `).join('')}
        </div>

        <div class="tut-modifiers-list">
          ${NOTATION_MODIFIERS.map(mod => `
            <div class="tut-mod-row">
              <code>${escapeHtml(mod.token)}</code>
              <strong>${escapeHtml(mod.meaning)}</strong>
              <span>${escapeHtml(mod.desc)}</span>
            </div>
          `).join('')}
        </div>
      </section>

      <section class="guide-card guide-card-full">
        <h3 class="guide-card-title">&#x26A1; Essential 4-Move Triggers (Righty, Lefty &amp; Sledge)</h3>
        <p class="hint" style="margin-bottom: 10px;">Algorithms are built out of short, fast fingertrick chunks called <strong>triggers</strong>. Practice these in the Simulator to learn them by muscle memory.</p>
        <div class="tut-trigger-grid">
          ${NOTATION_TRIGGERS.map((tr, idx) => `
            <div class="tut-trigger-card">
              <div class="tut-trigger-head">
                <strong>${escapeHtml(tr.name)}</strong>
                <span class="badge">${escapeHtml(tr.hand)}</span>
              </div>
              <code class="tut-alg-code">${escapeHtml(tr.alg)}</code>
              <p>${escapeHtml(tr.desc)}</p>
              <div class="tut-alg-actions">
                <button type="button" class="btn btn-xs btn-primary tut-trig-quicksim-btn" data-tut-trig="${idx}">${ICON_POPUP_SIM}<span>3D Sim</span></button>
                <button type="button" class="btn btn-xs tut-trig-opensim-btn" data-tut-trig="${idx}">${ICON_PLAY}<span>Open in Simulator</span></button>
              </div>
            </div>
          `).join('')}
        </div>
      </section>

      <section class="guide-card guide-card-full">
        <h3 class="guide-card-title">&#x1F4D6; Plain-English Speedcubing Terms</h3>
        <div class="tut-glossary-grid">
          <div class="tut-glossary-item">
            <strong>Face vs. Layer</strong>
            <p>A <strong>Face</strong> has 4 matching stickers on one side only (side colors can be mixed). A <strong>Layer</strong> solves both the face and all 4 matching side edges around it.</p>
          </div>
          <div class="tut-glossary-item">
            <strong>Bar / Headlights</strong>
            <p>Two adjacent stickers on the side of a layer that share the same color (forming a solid 2-sticker block).</p>
          </div>
          <div class="tut-glossary-item">
            <strong>Adj vs. Diag Swap</strong>
            <p><strong>Adjacent (Adj)</strong> means two side neighbors need to swap (1 Bar exists). <strong>Diagonal (Diag)</strong> means opposite corners need to swap (no Bar exists).</p>
          </div>
          <div class="tut-glossary-item">
            <strong>AUF (Adjust U Face)</strong>
            <p>Turning the top layer (<code>U</code>, <code>U'</code>, or <code>U2</code>) before or after an algorithm so the colors line up cleanly.</p>
          </div>
        </div>
      </section>
    </div>
  `;
}

export function bindTwoByTwoTutorialEvents(
  container,
  state,
  { onRerender, onQuickSimSolutions, onSimulateCase } = {}
) {
  if (!container) return;

  container.querySelectorAll('[data-tut-tab]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.subTab = btn.dataset.tutTab === 'notation' ? 'notation' : 'beginner';
      onRerender?.();
    });
  });

  const stepSolutions = TUTORIAL_BEGINNER_STEPS.map(st => ({
    label: `Step ${st.stepNum}: ${st.title}`,
    shortLabel: `Step ${st.stepNum}`,
    face: 'white',
    moves: st.alg,
    moveCount: st.alg.split(' ').filter(Boolean).length,
    inspection: 'none',
    scramble: st.setup,
    note: `${st.algLabel} — ${st.goal}`
  }));

  container.querySelectorAll('.tut-step-quicksim-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.tutStep) || 0;
      const item = stepSolutions[idx] || stepSolutions[0];
      onQuickSimSolutions?.({
        puzzle: '222',
        scramble: item.scramble,
        solutions: stepSolutions,
        activeIndex: idx,
        title: 'Beginner 2x2 Tutorial'
      });
    });
  });

  container.querySelectorAll('.tut-step-opensim-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.tutStep) || 0;
      const st = TUTORIAL_BEGINNER_STEPS[idx] || TUTORIAL_BEGINNER_STEPS[0];
      onSimulateCase?.(
        { id: st.id, name: `Step ${st.stepNum}: ${st.title}`, setup: st.setup },
        { id: `${st.id}-alg`, alg: st.alg, note: st.algLabel }
      );
    });
  });

  const moveSolutions = NOTATION_FACE_MOVES.map(m => ({
    label: `${m.letter} — ${m.face} Face Clockwise`,
    shortLabel: m.letter,
    face: 'white',
    moves: m.demoAlg,
    moveCount: 1,
    inspection: 'none',
    scramble: m.demoSetup,
    note: m.desc
  }));

  container.querySelectorAll('.tut-move-sim-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.tutMove) || 0;
      const item = moveSolutions[idx] || moveSolutions[0];
      onQuickSimSolutions?.({
        puzzle: '222',
        scramble: item.scramble,
        solutions: moveSolutions,
        activeIndex: idx,
        title: '2x2 / NxN Face Turn Notation'
      });
    });
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
      const idx = Number(btn.dataset.tutTrig) || 0;
      const item = trigSolutions[idx] || trigSolutions[0];
      onQuickSimSolutions?.({
        puzzle: '222',
        scramble: item.scramble,
        solutions: trigSolutions,
        activeIndex: idx,
        title: 'Essential 4-Move Triggers'
      });
    });
  });

  container.querySelectorAll('.tut-trig-opensim-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.tutTrig) || 0;
      const tr = NOTATION_TRIGGERS[idx] || NOTATION_TRIGGERS[0];
      onSimulateCase?.(
        { id: tr.id, name: `Trigger: ${tr.name}`, setup: tr.setup },
        { id: `${tr.id}-alg`, alg: tr.alg, note: tr.desc }
      );
    });
  });
}
