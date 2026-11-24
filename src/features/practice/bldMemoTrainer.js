// Interactive 3BLD Letter-Pair Memo Trainer (Edges Only, Corners Only, or Full 3BLD)

import { escapeHtml } from '../../services/htmlUtils.js';
import { renderSpeffzNetSvg } from '../study/bldGuideRenderer.js';
import {
  EDGE_BUFFER_LETTERS,
  CORNER_BUFFER_LETTERS,
  parseLetterPairsInput,
  formatLetterPairs,
  generateBldScramble,
  computeCanonicalBldMemo,
  verifyBldMemoAnswer,
  buildBldSimulationPayload
} from '../../cube/bldMemoEngine.js';

const MODE_OPTIONS = [
  { id: 'edges', label: 'Edges Only', desc: 'Standard WCA 3x3 scramble — memorize and verify edge letter pairs from UR (B).' },
  { id: 'corners', label: 'Corners Only', desc: 'Standard WCA 3x3 scramble — memorize and verify corner letter pairs from UBL (E).' },
  { id: 'both', label: 'Both (Full 3BLD)', desc: 'Standard WCA 3x3 scramble — Edges (UR / B), Ra-Perm parity if odd, Corners (UBL / E).' }
];

function renderPairChipsHtml(rawValue, { kind, mode }) {
  const { letters, invalidChars } = parseLetterPairsInput(rawValue);
  const bufferSet = kind === 'edges' ? EDGE_BUFFER_LETTERS : CORNER_BUFFER_LETTERS;
  const badBuffers = [...new Set(letters.filter(ch => bufferSet.has(ch)))];

  if (letters.length === 0 && invalidChars.length === 0) {
    return `<span class="bld-preview-placeholder">Type Speffz letters A&ndash;X (e.g. <code>AQ FJ PT</code> or <code>aqfjpt</code>)</span>`;
  }

  const pairs = [];
  for (let i = 0; i < letters.length; i += 2) {
    const chunk = letters.slice(i, i + 2).join('');
    pairs.push(`<span class="bld-pair-chip">${escapeHtml(chunk)}</span>`);
  }

  const countBadge = `<span class="bld-count-badge">${letters.length} letter${letters.length === 1 ? '' : 's'}</span>`;
  const parityBadge = kind === 'edges' && mode === 'both' && letters.length > 0 && letters.length % 2 === 1
    ? `<span class="bld-parity-chip" title="Odd edge count triggers Ra-Perm between Edges and Corners">Parity (Ra-Perm)</span>`
    : '';

  const warnings = [];
  if (invalidChars.length > 0) {
    warnings.push(`<span class="bld-inline-warn">Invalid: ${escapeHtml(invalidChars.join(', '))} (use A&ndash;X)</span>`);
  }
  if (badBuffers.length > 0) {
    warnings.push(`<span class="bld-inline-warn">Buffer sticker (${escapeHtml(badBuffers.join(', '))}) cannot be targeted</span>`);
  }

  return `${pairs.join('')}${countBadge}${parityBadge}${warnings.join('')}`;
}

export class BldMemoTrainer {
  constructor({ container, onApplyScrambleToDisplay = null, onFlashCube = null, onQuickSimSolutions = null } = {}) {
    this.container = container;
    this.onApplyScrambleToDisplay = onApplyScrambleToDisplay;
    this.onFlashCube = onFlashCube;
    this.onQuickSimSolutions = onQuickSimSolutions;

    this.mode = 'both';
    this.scramble = '';
    this.edgeInput = '';
    this.cornerInput = '';
    this.score = 0;
    this.attempts = 0;
    this.streak = 0;
    this.loadingScramble = false;
    this.checking = false;
    this.emptyNotice = '';
    this.lastResult = null;
    this.solutionRevealed = false;
    this.revealedCanonical = null;
    this.showSpeffzSheet = false;
    this.active = false;
    this._gen = 0;
  }

  async init() {
    this.active = true;
    if (!this.scramble) {
      await this.nextScramble({ focusInput: false });
      return;
    }
    this.onApplyScrambleToDisplay?.(this.scramble);
    this.render();
  }

  deactivate() {
    this.active = false;
    this._gen++;
  }

  async setMode(nextMode) {
    if (!['edges', 'corners', 'both'].includes(nextMode)) return;
    if (this.mode === nextMode && this.scramble) return;
    this.mode = nextMode;
    await this.nextScramble({ focusInput: true });
  }

  async nextScramble({ focusInput = true } = {}) {
    const gen = ++this._gen;
    this.edgeInput = '';
    this.cornerInput = '';
    this.lastResult = null;
    this.emptyNotice = '';
    this.solutionRevealed = false;
    this.revealedCanonical = null;
    this.loadingScramble = true;
    this.render();

    try {
      const scr = await generateBldScramble(this.mode);
      if (gen !== this._gen || !this.active) return;
      this.scramble = scr;
      this.loadingScramble = false;
      this.onApplyScrambleToDisplay?.(scr);
      this.render();
      if (focusInput) {
        this.focusPrimaryInput();
      }
    } catch {
      if (gen !== this._gen || !this.active) return;
      this.loadingScramble = false;
      this.render();
    }
  }

  focusPrimaryInput() {
    if (!this.container) return;
    const selector = this.mode === 'corners' ? '#bldCornerInput' : '#bldEdgeInput';
    this.container.querySelector(selector)?.focus?.();
  }

  async checkAnswer() {
    if (this.checking || this.loadingScramble || !this.scramble) return;

    const showEdges = this.mode === 'edges' || this.mode === 'both';
    const showCorners = this.mode === 'corners' || this.mode === 'both';
    const hasEdgeChars = Boolean(String(this.edgeInput || '').trim());
    const hasCornerChars = Boolean(String(this.cornerInput || '').trim());

    if ((showEdges && !showCorners && !hasEdgeChars) ||
        (showCorners && !showEdges && !hasCornerChars) ||
        (showEdges && showCorners && !hasEdgeChars && !hasCornerChars)) {
      this.emptyNotice = 'Enter your Speffz letter pairs first, then press Check Answer.';
      this.render();
      return;
    }

    const gen = this._gen;
    this.emptyNotice = '';
    this.checking = true;
    this.render();

    try {
      const res = await verifyBldMemoAnswer({
        scramble: this.scramble,
        mode: this.mode,
        edgeInput: this.edgeInput,
        cornerInput: this.cornerInput
      });
      if (gen !== this._gen || !this.active) return;
      this.checking = false;
      this.attempts++;
      if (res.isCorrect) {
        this.score++;
        this.streak++;
        this.onFlashCube?.('correct');
      } else {
        this.streak = 0;
        this.onFlashCube?.('wrong');
      }
      this.lastResult = res;
      this.render();
    } catch {
      if (gen !== this._gen || !this.active) return;
      this.checking = false;
      this.render();
    }
  }

  async toggleSolutionReveal() {
    if (this.solutionRevealed) {
      this.solutionRevealed = false;
      this.render();
      return;
    }
    const gen = this._gen;
    if (!this.revealedCanonical && this.scramble) {
      const canonical = this.lastResult?.canonical || await computeCanonicalBldMemo(this.scramble);
      if (gen !== this._gen || !this.active) return;
      this.revealedCanonical = canonical;
    }
    this.solutionRevealed = true;
    this.render();
  }

  openSimulation({ edgeLetters = [], cornerLetters = [], sourceLabel = 'Example' } = {}) {
    if (!this.scramble || typeof this.onQuickSimSolutions !== 'function') return null;
    const modeName = this.mode === 'edges' ? 'Edges' : this.mode === 'corners' ? 'Corners' : 'Full 3BLD';
    const payload = buildBldSimulationPayload({
      scramble: this.scramble,
      mode: this.mode,
      edgeLetters,
      cornerLetters,
      title: `3BLD ${modeName} · ${sourceLabel} (3D)`
    });
    if (payload) {
      this.onQuickSimSolutions(payload);
    }
    return payload;
  }

  simulateExampleMemo() {
    const canon = this.revealedCanonical || this.lastResult?.canonical;
    if (!canon) return null;
    return this.openSimulation({
      edgeLetters: canon.edgeLetters,
      cornerLetters: canon.cornerLetters,
      sourceLabel: 'Example Memo'
    });
  }

  simulateUserMemo() {
    const r = this.lastResult;
    if (!r || r.errors.length > 0) return null;
    return this.openSimulation({
      edgeLetters: r.edgeLetters,
      cornerLetters: r.cornerLetters,
      sourceLabel: 'Your Memo'
    });
  }

  updatePreview(kind) {
    if (!this.container) return;
    const previewEl = this.container.querySelector(kind === 'edges' ? '#bldEdgesPreview' : '#bldCornersPreview');
    if (previewEl) {
      const val = kind === 'edges' ? this.edgeInput : this.cornerInput;
      previewEl.innerHTML = renderPairChipsHtml(val, { kind, mode: this.mode });
    }
  }

  renderFeedbackHtml() {
    if (this.emptyNotice) {
      return `<div class="bld-feedback is-warning" role="status">${escapeHtml(this.emptyNotice)}</div>`;
    }
    if (!this.lastResult) return '';

    const r = this.lastResult;
    const cls = r.isCorrect ? 'is-correct' : 'is-wrong';
    const title = r.isCorrect
      ? '✓ Correct! Those letter pairs solve the cube.'
      : '✗ Not quite solved yet — check the breakdown below.';

    const errorHtml = r.errors.length > 0
      ? `<ul class="bld-feedback-list">${r.errors.map(e => `<li>${escapeHtml(e)}</li>`).join('')}</ul>`
      : '';

    const parts = [];
    if (r.edgesChecked && r.errors.length === 0) {
      const entered = formatLetterPairs(r.edgeLetters) || '(empty)';
      if (r.edgesCorrect) {
        const parityNote = r.appliedParity ? ' · Parity (Ra-Perm) applied' : '';
        parts.push(`<div class="bld-part-status is-ok"><strong>Edges:</strong> ✓ Solved (<code>${escapeHtml(entered)}</code>${escapeHtml(parityNote)})</div>`);
      } else {
        const issues = r.remainingEdges.slice(0, 4).join('; ');
        parts.push(`<div class="bld-part-status is-err"><strong>Edges:</strong> ✗ Still unsolved (<code>${escapeHtml(entered)}</code>)${issues ? ` &mdash; ${escapeHtml(issues)}` : ''}</div>`);
      }
    }
    if (r.cornersChecked && r.errors.length === 0) {
      const entered = formatLetterPairs(r.cornerLetters) || '(empty)';
      if (r.cornersCorrect) {
        parts.push(`<div class="bld-part-status is-ok"><strong>Corners:</strong> ✓ Solved (<code>${escapeHtml(entered)}</code>)</div>`);
      } else {
        const issues = r.remainingCorners.slice(0, 4).join('; ');
        parts.push(`<div class="bld-part-status is-err"><strong>Corners:</strong> ✗ Still unsolved (<code>${escapeHtml(entered)}</code>)${issues ? ` &mdash; ${escapeHtml(issues)}` : ''}</div>`);
      }
    }

    const canSimUser = r.errors.length === 0 && (r.edgeLetters.length + r.cornerLetters.length) > 0;
    const simUserBtnHtml = canSimUser
      ? `<div class="bld-sim-action-row"><button type="button" id="bldSimUserBtn" class="btn btn-xs btn-outline">&#x25B6; Simulate Your Memo (3D)</button></div>`
      : '';

    return `
      <div class="bld-feedback ${cls}" role="status">
        <div class="bld-feedback-title">${escapeHtml(title)}</div>
        ${errorHtml}
        ${parts.join('')}
        ${simUserBtnHtml}
      </div>
    `;
  }

  renderSolutionHtml() {
    if (!this.solutionRevealed) return '';
    const canon = this.revealedCanonical || this.lastResult?.canonical;
    if (!canon) return '';

    const showEdges = this.mode === 'edges' || this.mode === 'both';
    const showCorners = this.mode === 'corners' || this.mode === 'both';
    const rows = [];
    if (showEdges) {
      rows.push(`<div class="bld-sol-row"><strong>Edges (OP Buffer B):</strong> <code>${escapeHtml(canon.edgePairs || '(already solved)')}</code> <span class="bld-sol-meta">(${canon.edgeLetters.length} letters${this.mode === 'both' ? (canon.hasParity ? ' · Parity!' : ' · Even') : ''})</span></div>`);
    }
    if (showCorners) {
      rows.push(`<div class="bld-sol-row"><strong>Corners (OP Buffer E):</strong> <code>${escapeHtml(canon.cornerPairs || '(already solved)')}</code> <span class="bld-sol-meta">(${canon.cornerLetters.length} letters)</span></div>`);
    }
    const activeCount = (showEdges ? canon.edgeLetters.length : 0) + (showCorners ? canon.cornerLetters.length : 0);
    const simExampleBtnHtml = activeCount > 0
      ? `<div class="bld-sim-action-row"><button type="button" id="bldSimExampleBtn" class="btn btn-xs btn-primary">&#x25B6; Simulate Example (3D)</button></div>`
      : '';
    rows.push(`<p class="bld-sol-note">Any valid cycle break or flipped/twisted sticker order also passes verification above.</p>`);

    return `<div class="bld-solution-box">${rows.join('')}${simExampleBtnHtml}</div>`;
  }

  render() {
    if (!this.container) return;

    const showEdges = this.mode === 'edges' || this.mode === 'both';
    const showCorners = this.mode === 'corners' || this.mode === 'both';
    const activeMeta = MODE_OPTIONS.find(m => m.id === this.mode) || MODE_OPTIONS[2];

    this.container.innerHTML = `
      <div class="practice-header">
        <div class="practice-title-group">
          <h2 class="practice-title">3BLD Letter-Pair Memo Trainer</h2>
          <span class="practice-subtext">
            Hold <strong>White on U</strong>, <strong>Green on F</strong> &middot; Edge Buffer: <code>B (UR)</code> &middot; Corner Buffer: <code>E (UBL)</code>
          </span>
        </div>
        <div class="practice-header-controls">
          <div class="bld-score-pills" aria-label="Session score">
            <span class="bld-stat-pill">Solved: <strong>${this.score}/${this.attempts}</strong></span>
            <span class="bld-stat-pill">Streak: <strong>${this.streak}</strong></span>
          </div>
          <button type="button" id="bldNewScrambleBtn" class="btn btn-primary btn-small" ${this.loadingScramble ? 'disabled' : ''}>
            ${this.loadingScramble ? 'Scrambling…' : '↻ New Scramble'}
          </button>
        </div>
      </div>

      <div class="bld-trainer-card">
        <div class="bld-mode-row">
          <div class="seg bld-mode-seg" role="group" aria-label="3BLD training focus">
            ${MODE_OPTIONS.map(opt => {
              const active = opt.id === this.mode;
              return `<button type="button" class="bld-mode-btn ${active ? 'active' : ''}" data-bld-mode="${opt.id}" aria-pressed="${active}">${escapeHtml(opt.label)}</button>`;
            }).join('')}
          </div>
          <span class="bld-mode-desc">${escapeHtml(activeMeta.desc)}</span>
        </div>

        <div class="bld-scramble-box">
          <div class="bld-scramble-head">
            <span class="bld-scramble-label">Scramble (White U · Green F)</span>
            <button type="button" id="bldCopyScrambleBtn" class="btn btn-xs btn-outline" ${!this.scramble ? 'disabled' : ''}>Copy Scramble</button>
          </div>
          <div class="bld-scramble-text" id="bldScrambleText">
            ${this.loadingScramble ? 'Generating scramble…' : escapeHtml(this.scramble || '')}
          </div>
        </div>

        <form id="bldMemoForm" class="bld-form" novalidate>
          ${showEdges ? `
            <div class="bld-input-group">
              <label for="bldEdgeInput" class="bld-input-label">
                Edge Letter Pairs <span class="bld-buffer-tag">Buffer: B (UR) · Target: D (UL)</span>
              </label>
              <input
                type="text"
                id="bldEdgeInput"
                class="bld-letter-input"
                value="${escapeHtml(this.edgeInput)}"
                placeholder="e.g. AQ FJ PT or aqfjpt"
                autocomplete="off"
                autocapitalize="characters"
                spellcheck="false"
                ${this.loadingScramble ? 'disabled' : ''}
              />
              <div id="bldEdgesPreview" class="bld-pair-preview">${renderPairChipsHtml(this.edgeInput, { kind: 'edges', mode: this.mode })}</div>
            </div>
          ` : ''}

          ${showCorners ? `
            <div class="bld-input-group">
              <label for="bldCornerInput" class="bld-input-label">
                Corner Letter Pairs <span class="bld-buffer-tag">Buffer: E (UBL) · Target: V (DFR)</span>
              </label>
              <input
                type="text"
                id="bldCornerInput"
                class="bld-letter-input"
                value="${escapeHtml(this.cornerInput)}"
                placeholder="e.g. KM WX or kmwx"
                autocomplete="off"
                autocapitalize="characters"
                spellcheck="false"
                ${this.loadingScramble ? 'disabled' : ''}
              />
              <div id="bldCornersPreview" class="bld-pair-preview">${renderPairChipsHtml(this.cornerInput, { kind: 'corners', mode: this.mode })}</div>
            </div>
          ` : ''}

          <div class="bld-actions-row">
            <button type="submit" id="bldCheckBtn" class="btn btn-primary" ${this.loadingScramble || this.checking ? 'disabled' : ''}>
              ${this.checking ? 'Checking…' : '✓ Check Answer'}
            </button>
            <button type="button" id="bldRevealBtn" class="btn btn-outline" ${this.loadingScramble ? 'disabled' : ''}>
              ${this.solutionRevealed ? 'Hide Example Memo' : '👁 Show Example Memo'}
            </button>
            <button type="button" id="bldToggleSpeffzBtn" class="btn btn-outline btn-small" aria-expanded="${String(this.showSpeffzSheet)}">
              ${this.showSpeffzSheet ? 'Hide Speffz Chart' : '🗺 Speffz Chart'}
            </button>
          </div>
        </form>

        ${this.renderFeedbackHtml()}
        ${this.renderSolutionHtml()}

        ${this.showSpeffzSheet ? `
          <div class="bld-ref-drawer" id="bldSpeffzDrawer">
            <div class="bld-ref-grid">
              <div class="bld-net-card">
                <h4 class="bld-net-title">Speffz Edges (Buffer B = UR)</h4>
                ${renderSpeffzNetSvg('edges')}
              </div>
              <div class="bld-net-card">
                <h4 class="bld-net-title">Speffz Corners (Buffer E = UBL)</h4>
                ${renderSpeffzNetSvg('corners')}
              </div>
            </div>
          </div>
        ` : ''}
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    if (!this.container) return;

    this.container.querySelectorAll('[data-bld-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        void this.setMode(btn.dataset.bldMode);
      });
    });

    this.container.querySelector('#bldNewScrambleBtn')?.addEventListener('click', () => {
      void this.nextScramble({ focusInput: true });
    });

    this.container.querySelector('#bldCopyScrambleBtn')?.addEventListener('click', async () => {
      if (!this.scramble) return;
      const copyBtn = this.container?.querySelector('#bldCopyScrambleBtn');
      try {
        await navigator?.clipboard?.writeText?.(this.scramble);
        if (copyBtn) {
          copyBtn.textContent = 'Copied!';
          setTimeout(() => {
            if (copyBtn.isConnected) copyBtn.textContent = 'Copy Scramble';
          }, 1500);
        }
      } catch {}
    });

    this.container.querySelector('#bldEdgeInput')?.addEventListener('input', (e) => {
      this.edgeInput = e.target.value;
      this.emptyNotice = '';
      this.updatePreview('edges');
    });

    this.container.querySelector('#bldCornerInput')?.addEventListener('input', (e) => {
      this.cornerInput = e.target.value;
      this.emptyNotice = '';
      this.updatePreview('corners');
    });

    this.container.querySelector('#bldMemoForm')?.addEventListener('submit', (e) => {
      e.preventDefault();
      void this.checkAnswer();
    });

    this.container.querySelector('#bldRevealBtn')?.addEventListener('click', () => {
      void this.toggleSolutionReveal();
    });

    this.container.querySelector('#bldSimExampleBtn')?.addEventListener('click', () => {
      this.simulateExampleMemo();
    });

    this.container.querySelector('#bldSimUserBtn')?.addEventListener('click', () => {
      this.simulateUserMemo();
    });

    this.container.querySelector('#bldToggleSpeffzBtn')?.addEventListener('click', () => {
      this.showSpeffzSheet = !this.showSpeffzSheet;
      this.render();
    });
  }
}
