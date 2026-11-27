// Lazy-mounted inline 3D <scramble-display> card controller for Tutorials & Notation views
// Manages IntersectionObserver + LRU cap so multiple interactive 3D widgets run smoothly on mobile & desktop.

import { applyColorsTo3DCube } from '../../caseVisualizer.js';
import { cleanAlg, parseScrambleInput } from '../../algParser.js';
import { escapeHtml } from '../../services/htmlUtils.js';
import {
  ICON_PLAY,
  ICON_PAUSE,
  ICON_REPLAY,
  ICON_SKIP_START,
  ICON_STEP_BACK,
  ICON_STEP_FORWARD,
  ICON_RESET_ANGLE,
  ICON_POPUP_SIM
} from '../../ui/transportIcons.js';

let CachedScrambleDisplay = null;
async function getScrambleDisplay() {
  if (!CachedScrambleDisplay && typeof window !== 'undefined') {
    const mod = await import('scramble-display');
    CachedScrambleDisplay = mod.ScrambleDisplay;
  }
  return CachedScrambleDisplay;
}

function parseCombinedMoves(setupStr, algStr) {
  const cleanSetup = cleanAlg(setupStr || '');
  const parsedSetup = cleanSetup ? parseScrambleInput(cleanSetup) : { ok: false };
  const setupMoves = parsedSetup.ok
    ? parsedSetup.moves
    : (cleanSetup ? cleanSetup.split(/\s+/).filter(Boolean) : []);

  const cleanSol = cleanAlg(algStr || '');
  const parsedSol = cleanSol ? parseScrambleInput(cleanSol) : { ok: false };
  const algMoves = parsedSol.ok
    ? parsedSol.moves
    : (cleanSol ? cleanSol.split(/\s+/).filter(Boolean) : []);

  return {
    setupMoves,
    algMoves,
    combinedMoves: [...setupMoves, ...algMoves]
  };
}

export async function resetCubeCamera(el, puzzle = '333') {
  if (!el?.player) return;
  try {
    const p = await el.player.experimentalCurrentThreeJSPuzzleObject?.();
    if (p) {
      p.quaternion.set(0, 0, 0, 1);
      p.rotation.set(0, 0, 0);
      p.scheduleRenderCallback?.();
    }
  } catch {}
  try {
    el.player.cameraLatitude = 25;
    el.player.cameraLongitude = 30;
    el.player.cameraDistance = puzzle === '444' || puzzle === '555' ? 6.6 : 6;
  } catch {}
  try {
    el.player.experimentalModel?.twistySceneModel?.orbitCoordinatesRequest?.set?.('auto');
  } catch {}
}

function seekPlayerToMoveCount(el, idx, setupCount, totalCount, targetCount) {
  const clamped = Math.max(setupCount, Math.min(totalCount, targetCount));
  if (clamped <= 0) {
    el.player.controller?.jumpToStart?.({ flash: false });
    return 0;
  }
  if (clamped >= totalCount) {
    el.player.controller?.jumpToEnd?.({ flash: false });
    return totalCount;
  }
  const targetIdx = clamped - 1;
  const endTs = idx.indexToMoveStartTimestamp(targetIdx) + idx.moveDuration(targetIdx);
  el.player.experimentalModel.timestampRequest.set(endTs);
  return clamped;
}

export function createInlineCubeManager({ maxLive = 10 } = {}) {
  const state = {
    container: null,
    observer: null,
    cards: new Map(),
    lru: [],
    activePlayingId: null,
    gen: 0,
    getSimSpeed: () => 1,
    getShowReflection: () => true
  };

  function updateCardUi(entry, playing) {
    entry.playing = Boolean(playing);
    const cardEl = entry.cardEl;
    if (!cardEl) return;

    const playBtn = cardEl.querySelector('.tut-3d-play-btn');
    const startBtn = cardEl.querySelector('.tut-3d-start-btn');
    const prevBtn = cardEl.querySelector('.tut-3d-prev-btn');
    const nextBtn = cardEl.querySelector('.tut-3d-next-btn');
    const endBtn = cardEl.querySelector('.tut-3d-end-btn');
    const statusEl = cardEl.querySelector('.tut-3d-status');

    const total = entry.combinedMoves.length;
    const algTotal = entry.algMoves.length;
    const doneSteps = Math.max(0, entry.moveCount - entry.setupCount);

    if (startBtn) startBtn.disabled = entry.moveCount <= entry.setupCount || algTotal === 0;
    if (prevBtn) prevBtn.disabled = entry.moveCount <= entry.setupCount || algTotal === 0;
    if (nextBtn) nextBtn.disabled = entry.moveCount >= total || algTotal === 0;
    if (endBtn) endBtn.disabled = entry.moveCount >= total || algTotal === 0;

    if (statusEl) {
      statusEl.textContent = algTotal > 0 ? `${doneSteps}/${algTotal}` : 'Solved';
    }

    if (playBtn) {
      playBtn.disabled = algTotal === 0;
      playBtn.classList.toggle('is-playing', entry.playing);
      if (entry.playing) {
        playBtn.innerHTML = ICON_PAUSE;
        playBtn.setAttribute('aria-label', 'Pause step animation');
      } else if (algTotal > 0 && entry.moveCount >= total) {
        playBtn.innerHTML = ICON_REPLAY;
        playBtn.setAttribute('aria-label', 'Replay step animation');
      } else {
        playBtn.innerHTML = ICON_PLAY;
        playBtn.setAttribute('aria-label', 'Play step animation');
      }
    }
  }

  function pauseOthers(exceptId) {
    for (const [id, entry] of state.cards.entries()) {
      if (id !== exceptId && entry.playing && entry.displayEl?.player) {
        try { entry.displayEl.player.pause(); } catch {}
      }
    }
    state.activePlayingId = exceptId;
  }

  function touchLru(id) {
    const idx = state.lru.indexOf(id);
    if (idx >= 0) state.lru.splice(idx, 1);
    state.lru.push(id);
    while (state.lru.length > maxLive) {
      const victimIdx = state.lru.findIndex(candId => {
        const c = state.cards.get(candId);
        return c && !c.intersecting && !c.playing && candId !== state.activePlayingId;
      });
      if (victimIdx < 0) break;
      const [victimId] = state.lru.splice(victimIdx, 1);
      const victim = state.cards.get(victimId);
      if (victim?.displayEl) {
        victim.loadGen++;
        victim.pendingSeek = false;
        try {
          victim.displayEl.player?.pause?.();
          victim.displayEl.remove?.();
        } catch {}
        victim.displayEl = null;
        victim.indexer = null;
        victim.mountPromise = null;
        if (victim.wrapEl?.isConnected) {
          victim.wrapEl.innerHTML = '<span class="study-visual-loading">3D Cube</span>';
        }
      }
    }
  }

  async function seekEntry(entry, targetCount) {
    const el = entry.displayEl;
    if (!el?.player) return;
    const lGen = entry.loadGen;
    entry.pendingSeek = true;
    try {
      el.player.pause();
      if (!entry.indexer) {
        entry.indexer = await el.player.experimentalModel.indexer.get();
      }
      if (lGen !== entry.loadGen || entry.gen !== state.gen || entry.displayEl !== el) return;
      entry.moveCount = seekPlayerToMoveCount(
        el,
        entry.indexer,
        entry.setupCount,
        entry.combinedMoves.length,
        targetCount
      );
      updateCardUi(entry, false);
    } catch {} finally {
      if (lGen === entry.loadGen) entry.pendingSeek = false;
    }
  }

  async function ensureMounted(entry) {
    if (!entry || entry.gen !== state.gen || !entry.wrapEl?.isConnected) return null;
    if (entry.displayEl && entry.wrapEl.contains(entry.displayEl)) {
      touchLru(entry.id);
      return entry.displayEl;
    }
    if (entry.mountPromise) return entry.mountPromise;

    const lGen = ++entry.loadGen;
    const gGen = entry.gen;

    entry.mountPromise = (async () => {
      try {
        const SD = await getScrambleDisplay();
        if (!SD || lGen !== entry.loadGen || gGen !== state.gen || !entry.wrapEl?.isConnected) return null;

        const spd = Number(state.getSimSpeed?.() || 1) || 1;
        const showRefl = state.getShowReflection ? state.getShowReflection() : true;

        const el = new SD();
        el.event = entry.puzzle;
        el.visualization = '3D';
        el.scramble = entry.combinedMoves.join(' ');
        if (el.player) {
          el.player.hintFacelets = showRefl ? 'floating' : 'none';
          el.player.tempoScale = spd;
          if (entry.stickeringMask) {
            try { el.player.experimentalStickeringMaskOrbits = entry.stickeringMask; } catch {}
          }
        }

        entry.wrapEl.innerHTML = '';
        entry.wrapEl.appendChild(el);
        entry.displayEl = el;
        touchLru(entry.id);
        if (!entry.stickeringMask) {
          applyColorsTo3DCube(el);
        }

        if (el.player?.experimentalModel) {
          el.player.experimentalModel.indexer.addFreshListener(idx => {
            if (entry.displayEl === el) entry.indexer = idx;
          });
          el.player.experimentalModel.detailedTimelineInfo.addFreshListener(info => {
            if (entry.displayEl !== el || entry.pendingSeek || !entry.indexer || entry.combinedMoves.length === 0) return;
            try {
              if (info.atStart || info.timestamp <= 0) {
                if (entry.setupCount > 0) void seekEntry(entry, entry.setupCount);
                else {
                  entry.moveCount = 0;
                  updateCardUi(entry, entry.playing);
                }
                return;
              }
              if (info.atEnd) {
                entry.moveCount = entry.combinedMoves.length;
                updateCardUi(entry, false);
                return;
              }
              const mIdx = entry.indexer.timestampToIndex(info.timestamp);
              const nextCount = mIdx + 1;
              if (nextCount < entry.setupCount) {
                void seekEntry(entry, entry.setupCount);
                return;
              }
              entry.moveCount = nextCount;
              updateCardUi(entry, entry.playing);
            } catch {}
          });
          el.player.experimentalModel.coarseTimelineInfo.addFreshListener(info => {
            if (entry.displayEl !== el) return;
            const playing = Boolean(info.playing);
            if (playing) pauseOthers(entry.id);
            updateCardUi(entry, playing);
          });
        }

        await seekEntry(entry, entry.setupCount);
        void resetCubeCamera(el, entry.puzzle);
        return el;
      } catch {
        return null;
      } finally {
        entry.mountPromise = null;
      }
    })();

    return entry.mountPromise;
  }

  function bindCardControls(entry) {
    const cardEl = entry.cardEl;
    if (!cardEl) return;

    const playBtn = cardEl.querySelector('.tut-3d-play-btn');
    const startBtn = cardEl.querySelector('.tut-3d-start-btn');
    const prevBtn = cardEl.querySelector('.tut-3d-prev-btn');
    const nextBtn = cardEl.querySelector('.tut-3d-next-btn');
    const endBtn = cardEl.querySelector('.tut-3d-end-btn');
    const resetBtn = cardEl.querySelector('.tut-3d-reset-btn');

    if (playBtn) {
      playBtn.onclick = async () => {
        const el = await ensureMounted(entry);
        if (!el?.player || entry.algMoves.length === 0) return;
        if (entry.playing) {
          el.player.pause();
          return;
        }
        pauseOthers(entry.id);
        if (entry.moveCount >= entry.combinedMoves.length || entry.moveCount < entry.setupCount) {
          await seekEntry(entry, entry.setupCount);
          setTimeout(() => { try { entry.displayEl?.player?.play?.(); } catch {} }, 35);
          return;
        }
        try { el.player.play(); } catch {}
      };
    }

    if (startBtn) {
      startBtn.onclick = async () => {
        const el = await ensureMounted(entry);
        if (el) await seekEntry(entry, entry.setupCount);
      };
    }

    if (prevBtn) {
      prevBtn.onclick = async () => {
        const el = await ensureMounted(entry);
        if (!el?.player?.controller || entry.moveCount <= entry.setupCount) return;
        if (entry.moveCount <= entry.setupCount + 1) {
          await seekEntry(entry, entry.setupCount);
          return;
        }
        try {
          el.player.pause();
          el.player.controller.animationController.play({ direction: -1, untilBoundary: 'move' });
        } catch {}
      };
    }

    if (nextBtn) {
      nextBtn.onclick = async () => {
        const el = await ensureMounted(entry);
        if (!el?.player?.controller || entry.algMoves.length === 0) return;
        if (entry.moveCount >= entry.combinedMoves.length) return;
        pauseOthers(entry.id);
        try {
          el.player.pause();
          el.player.controller.animationController.play({ direction: 1, untilBoundary: 'move' });
        } catch {}
      };
    }

    if (endBtn) {
      endBtn.onclick = async () => {
        const el = await ensureMounted(entry);
        if (!el?.player || entry.algMoves.length === 0) return;
        pauseOthers(entry.id);
        await seekEntry(entry, entry.combinedMoves.length);
      };
    }

    if (resetBtn) {
      resetBtn.onclick = async () => {
        const el = await ensureMounted(entry);
        if (el) await resetCubeCamera(el, entry.puzzle);
      };
    }
  }

  function teardown() {
    state.gen++;
    state.activePlayingId = null;
    if (state.observer) {
      try { state.observer.disconnect(); } catch {}
      state.observer = null;
    }
    for (const entry of state.cards.values()) {
      entry.loadGen++;
      entry.pendingSeek = false;
      if (entry.displayEl) {
        try {
          entry.displayEl.player?.pause?.();
          entry.displayEl.remove?.();
        } catch {}
        entry.displayEl = null;
      }
      entry.indexer = null;
      entry.mountPromise = null;
    }
    state.cards.clear();
    state.lru = [];
    state.container = null;
  }

  async function mountAll(container, { getSimSpeed = () => 1, getShowReflection = () => true } = {}) {
    teardown();
    if (!container || typeof window === 'undefined') return;
    const wraps = container.querySelectorAll('.tut-3d-wrap[data-cube-id]');
    if (!wraps.length) return;

    state.container = container;
    state.getSimSpeed = getSimSpeed;
    state.getShowReflection = getShowReflection;
    const curGen = state.gen;

    for (const wrapEl of wraps) {
      const id = wrapEl.dataset.cubeId;
      const puzzle = wrapEl.dataset.cubePuzzle || '222';
      const setup = wrapEl.dataset.cubeSetup || '';
      const moves = wrapEl.dataset.cubeMoves || '';
      const stickeringMask = wrapEl.dataset.cubeMask || '';
      const cardEl = wrapEl.closest('.tut-3d-card');
      const { setupMoves, algMoves, combinedMoves } = parseCombinedMoves(setup, moves);

      const entry = {
        id,
        puzzle,
        wrapEl,
        cardEl,
        displayEl: null,
        indexer: null,
        mountPromise: null,
        setupCount: setupMoves.length,
        algMoves,
        combinedMoves,
        stickeringMask,
        moveCount: setupMoves.length,
        playing: false,
        pendingSeek: false,
        intersecting: false,
        loadGen: 0,
        gen: curGen
      };
      state.cards.set(id, entry);
      updateCardUi(entry, false);
      bindCardControls(entry);
    }

    if (typeof IntersectionObserver !== 'undefined') {
      state.observer = new IntersectionObserver(entries => {
        if (state.gen !== curGen) return;
        for (const ioEntry of entries) {
          const id = ioEntry.target?.dataset?.cubeId;
          const entry = id ? state.cards.get(id) : null;
          if (!entry) continue;
          entry.intersecting = ioEntry.isIntersecting;
          if (ioEntry.isIntersecting) void ensureMounted(entry);
        }
      }, { rootMargin: '220px 0px', threshold: 0.01 });

      for (const entry of state.cards.values()) {
        state.observer.observe(entry.wrapEl);
      }
    }

    const firstEntries = Array.from(state.cards.values()).slice(0, Math.min(6, maxLive));
    for (const entry of firstEntries) {
      void ensureMounted(entry);
    }
  }

  function syncSpeed(spd) {
    const next = Number(spd);
    if (!Number.isFinite(next) || next <= 0) return;
    for (const entry of state.cards.values()) {
      if (entry.displayEl?.player) {
        try { entry.displayEl.player.tempoScale = next; } catch {}
      }
    }
  }

  return {
    mountAll,
    syncSpeed,
    teardown
  };
}

const HIGHLIGHT_DOT_COLORS = {
  W: '#f8fafc',
  Y: '#facc15',
  G: '#22c55e',
  B: '#3b82f6',
  R: '#ef4444',
  O: '#f97316'
};

function renderHighlightPiecePill(highlightPiece) {
  if (!highlightPiece || !Array.isArray(highlightPiece.colors)) return '';
  const dots = highlightPiece.colors
    .map(c => `<span class="tut-piece-dot" style="background:${HIGHLIGHT_DOT_COLORS[c] || '#94a3b8'}" aria-hidden="true"></span>`)
    .join('');
  return `
    <div class="tut-highlight-piece-pill" aria-label="Target corner: ${escapeHtml(highlightPiece.label || '')}">
      <span class="tut-piece-dots">${dots}</span>
      <span>Focus: ${escapeHtml(highlightPiece.label || '')}</span>
    </div>
  `;
}

/**
 * Render stage-grouped tutorial step widgets with inline 3D cubes + transport controls.
 */
export function renderTutorialStepSectionsHtml(steps = [], puzzle = '222') {
  if (!Array.isArray(steps) || steps.length === 0) return '';

  const stageOrder = [];
  const byStage = new Map();
  steps.forEach((st, idx) => {
    const key = st.stage || 'steps';
    if (!byStage.has(key)) {
      byStage.set(key, { label: st.stageLabel || 'Steps', items: [] });
      stageOrder.push(key);
    }
    byStage.get(key).items.push({ step: st, idx });
  });

  return `
    <div class="tut-stage-groups">
      ${stageOrder.map(stKey => {
        const grp = byStage.get(stKey);
        return `
          <section class="tut-stage-group" data-tut-stage="${escapeHtml(stKey)}">
            <h3 class="tut-stage-title">${escapeHtml(grp.label)}</h3>
            <div class="tut-steps-grid">
              ${grp.items.map(({ step, idx }) => {
                const moveCount = step.moves ? step.moves.split(/\s+/).filter(Boolean).length : 0;
                const algTotal = moveCount;
                const maskAttr = step.stickeringMask ? ` data-cube-mask="${escapeHtml(step.stickeringMask)}"` : '';
                return `
                  <article class="guide-card tut-step-card tut-3d-card" data-tut-step-id="${escapeHtml(step.id)}">
                    <div class="tut-step-head">
                      <div>
                        <div class="tut-step-kicker">Step ${idx + 1}</div>
                        <h4 class="tut-step-widget-title">${escapeHtml(step.title)}</h4>
                      </div>
                      <span class="badge ${moveCount === 0 ? 'badge-solved' : 'badge-case'}">${escapeHtml(step.algName || (moveCount ? `${moveCount}m` : 'Done'))}</span>
                    </div>

                    ${renderHighlightPiecePill(step.highlightPiece)}

                    <div class="tut-3d-wrap tut-step-3d-wrap" data-cube-id="${escapeHtml(step.id)}" data-cube-puzzle="${escapeHtml(puzzle)}" data-cube-setup="${escapeHtml(step.setupBefore || '')}" data-cube-moves="${escapeHtml(step.moves || '')}"${maskAttr}>
                      <span class="study-visual-loading">3D Cube</span>
                    </div>

                    <div class="tut-3d-controls" role="group" aria-label="3D animation controls for Step ${idx + 1}">
                      <button type="button" class="btn btn-xs btn-icon-only tut-3d-reset-btn" data-cube-id="${escapeHtml(step.id)}" title="Reset 3D angle" aria-label="Reset 3D angle">${ICON_RESET_ANGLE}</button>
                      <button type="button" class="btn btn-xs btn-icon-only tut-3d-start-btn" data-cube-id="${escapeHtml(step.id)}" title="Jump to step start" aria-label="Jump to step start" disabled>${ICON_SKIP_START}</button>
                      <button type="button" class="btn btn-xs btn-icon-only tut-3d-prev-btn" data-cube-id="${escapeHtml(step.id)}" title="Step back 1 move" aria-label="Step back 1 move" disabled>${ICON_STEP_BACK}</button>
                      <button type="button" class="btn btn-xs btn-icon-only btn-primary tut-3d-play-btn" data-cube-id="${escapeHtml(step.id)}" title="Play / Pause step" aria-label="Play / Pause step" ${algTotal === 0 ? 'disabled' : ''}>${ICON_PLAY}</button>
                      <button type="button" class="btn btn-xs btn-icon-only tut-3d-next-btn" data-cube-id="${escapeHtml(step.id)}" title="Step forward 1 move" aria-label="Step forward 1 move" ${algTotal === 0 ? 'disabled' : ''}>${ICON_STEP_FORWARD}</button>
                      <span class="tut-3d-status">${algTotal > 0 ? `0/${algTotal}` : 'Done'}</span>
                    </div>

                    <p class="tut-step-desc">${escapeHtml(step.description || '')}</p>

                    <div class="tut-alg-bar">
                      <div>
                        <div class="tut-alg-label">${moveCount > 0 ? `Moves (${moveCount})` : 'No Moves Needed'}</div>
                        <code class="tut-alg-code">${moveCount > 0 ? escapeHtml(step.moves) : 'Already aligned'}</code>
                      </div>
                      <div class="tut-alg-actions">
                        <button type="button" class="btn btn-xs tut-step-quicksim-btn" data-tut-step-idx="${idx}">${ICON_POPUP_SIM}<span>Popup</span></button>
                        <button type="button" class="btn btn-xs tut-step-opensim-btn" data-tut-step-idx="${idx}">${ICON_PLAY}<span>Sim</span></button>
                      </div>
                    </div>
                  </article>
                `;
              }).join('')}
            </div>
          </section>
        `;
      }).join('')}
    </div>
  `;
}

/**
 * Bind Popup Sim and Full Simulator buttons inside dynamic tutorial step widgets.
 */
export function bindTutorialStepSimButtons(
  container,
  steps = [],
  puzzle = '222',
  { titlePrefix = 'Tutorial', onQuickSimSolutions, onSimulateCase } = {}
) {
  if (!container || !Array.isArray(steps) || !steps.length) return;

  const simSolutions = steps.map((st, idx) => ({
    label: `Step ${idx + 1}: ${st.title}`,
    shortLabel: `Step ${idx + 1}`,
    face: 'white',
    moves: st.moves || '',
    moveCount: st.moves ? st.moves.split(/\s+/).filter(Boolean).length : 0,
    inspection: 'none',
    scramble: st.setupBefore || '',
    note: st.description || st.algName || ''
  }));

  container.querySelectorAll('.tut-step-quicksim-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.tutStepIdx) || 0;
      const item = simSolutions[idx] || simSolutions[0];
      onQuickSimSolutions?.({
        puzzle,
        scramble: item.scramble,
        solutions: simSolutions,
        activeIndex: idx,
        title: titlePrefix
      });
    });
  });

  container.querySelectorAll('.tut-step-opensim-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const idx = Number(btn.dataset.tutStepIdx) || 0;
      const st = steps[idx] || steps[0];
      onSimulateCase?.(
        { id: st.id, name: `Step ${idx + 1}: ${st.title}`, setup: st.setupBefore || '' },
        { id: `${st.id}-alg`, alg: st.moves || '', note: st.description || '' }
      );
    });
  });
}
