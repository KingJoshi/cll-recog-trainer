// Smart Cube Scramble Assistant & Move Tracker
// Guides physical smart cube users through scrambles with move verification and correction,
// preventing premature timer triggers before the scramble is completed.

export function parseMoveToken(token) {
  if (!token || typeof token !== "string") return null;
  const cleaned = token.trim();
  // Match standard 3x3 and 2x2 face moves: U, D, L, R, F, B with optional 2, ', or 2'
  const match = /^([UDFBLR])([2']|2')?$/i.exec(cleaned);
  if (!match) return null;
  const face = match[1].toUpperCase();
  const suffix = match[2] || '';
  const amount = suffix.includes('2') ? 2 : (suffix.includes("'") ? 3 : 1);
  return { face, amount, raw: cleaned };
}

export function formatMove(face, amount) {
  const norm = (amount % 4 + 4) % 4;
  if (norm === 0) return '';
  return face + (norm === 2 ? '2' : (norm === 3 ? "'" : ''));
}

export function invertMove(moveObj) {
  if (!moveObj) return null;
  const invAmount = (4 - (moveObj.amount % 4)) % 4;
  return {
    face: moveObj.face,
    amount: invAmount,
    text: formatMove(moveObj.face, invAmount)
  };
}

export class ScrambleTracker {
  constructor(scrambleStr = '') {
    this.reset(scrambleStr);
  }

  reset(scrambleStr = '') {
    this.rawScramble = scrambleStr || '';
    this.originalTokens = this._extractTokens(this.rawScramble);
    this.moves = this.originalTokens.map(t => {
      const p = parseMoveToken(t);
      return p ? { face: p.face, amount: p.amount, text: t } : null;
    }).filter(Boolean);

    this.currentIndex = 0;
    this.currentSubAmount = 0; // Tracks partial progress for double turns (e.g. turned R of R2)
    this.deviations = []; // Stack of off-track turns: { face, amount }
    this.forceCompleted = false;
  }

  _extractTokens(str) {
    if (!str) return [];
    return str.trim().split(/\s+/).filter(Boolean);
  }

  applyMove(moveStr) {
    if (this.isComplete()) {
      return this.getStatus();
    }

    const parsed = parseMoveToken(moveStr);
    // Whole-cube rotations (x, y, z) or unparsed moves don't count as face turns
    if (!parsed) {
      return this.getStatus();
    }

    // 1. If there are previous off-track deviations, user must undo them first
    if (this.deviations.length > 0) {
      const top = this.deviations[this.deviations.length - 1];
      if (top.face === parsed.face) {
        const combined = (top.amount + parsed.amount) % 4;
        if (combined === 0) {
          this.deviations.pop();
        } else {
          top.amount = combined;
        }
      } else {
        this.deviations.push({ face: parsed.face, amount: parsed.amount });
      }
      return this.getStatus();
    }

    // 2. On-track: test against the current expected scramble move
    if (this.currentIndex < this.moves.length) {
      const target = this.moves[this.currentIndex];
      const neededAmount = (target.amount - this.currentSubAmount + 4) % 4;

      if (parsed.face === target.face) {
        if (parsed.amount === neededAmount) {
          // Exactly satisfied the remaining amount for this step
          this.currentIndex++;
          this.currentSubAmount = 0;
        } else if (neededAmount === 2 && (parsed.amount === 1 || parsed.amount === 3)) {
          // Double turn (e.g. R2) satisfied by 90-degree turn -> needs another 90-degree turn
          this.currentSubAmount = (this.currentSubAmount + parsed.amount) % 4;
        } else {
          // Over-turn or mismatch on the same face
          const over = (parsed.amount - neededAmount + 4) % 4;
          this.currentIndex++;
          this.currentSubAmount = 0;
          if (over > 0) {
            this.deviations.push({ face: parsed.face, amount: over });
          }
        }
      } else {
        // Turned the wrong face
        this.deviations.push({ face: parsed.face, amount: parsed.amount });
      }
    }

    return this.getStatus();
  }

  markComplete() {
    this.forceCompleted = true;
    this.deviations = [];
    this.currentIndex = this.moves.length;
    this.currentSubAmount = 0;
    return this.getStatus();
  }

  isComplete() {
    if (this.forceCompleted) return true;
    return this.moves.length > 0 && this.currentIndex >= this.moves.length && this.deviations.length === 0;
  }

  getStatus() {
    const isDone = this.isComplete();
    const hasError = this.deviations.length > 0;

    let nextRequired = null;
    if (!isDone && !hasError && this.currentIndex < this.moves.length) {
      const cur = this.moves[this.currentIndex];
      const remAmount = (cur.amount - this.currentSubAmount + 4) % 4;
      nextRequired = formatMove(cur.face, remAmount);
    }

    // Corrections are the reverse inverse of deviations
    const corrections = [...this.deviations].reverse().map(d => {
      const inv = (4 - (d.amount % 4)) % 4;
      return formatMove(d.face, inv);
    }).filter(Boolean);

    return {
      isComplete: isDone,
      currentIndex: this.currentIndex,
      totalMoves: this.moves.length,
      nextRequired,
      corrections,
      hasError,
      isPartiallyScrambled: this.currentIndex > 0 || this.currentSubAmount > 0 || hasError
    };
  }

  getHtml() {
    const status = this.getStatus();
    if (this.moves.length === 0) {
      return '<span class="scramble-empty">No scramble loaded</span>';
    }

    if (status.isComplete) {
      return `<span class="scramble-complete-badge">✓ Scramble Verified Complete!</span>`;
    }

    const parts = [];

    // Done moves
    for (let i = 0; i < this.currentIndex; i++) {
      parts.push(`<span class="scramble-token token-done">${this.moves[i].text}</span>`);
    }

    // Current move
    if (this.currentIndex < this.moves.length) {
      const cur = this.moves[this.currentIndex];
      const remAmount = (cur.amount - this.currentSubAmount + 4) % 4;
      const displayNext = formatMove(cur.face, remAmount);
      const subLabel = this.currentSubAmount > 0 ? ` <small class="token-sub">(${displayNext} needed)</small>` : '';
      parts.push(`<span class="scramble-token token-current" title="Next move to perform">${cur.text}${subLabel}</span>`);
    }

    // Pending moves
    for (let i = this.currentIndex + 1; i < this.moves.length; i++) {
      parts.push(`<span class="scramble-token token-pending">${this.moves[i].text}</span>`);
    }

    let correctionHtml = '';
    if (status.hasError && status.corrections.length > 0) {
      const undoText = status.corrections.join(' ');
      correctionHtml = `
        <div class="scramble-correction-box">
          <span class="correction-icon">⚠️</span>
          <span class="correction-label">Incorrect turn! Please do:</span>
          <strong class="correction-moves">${undoText}</strong>
          <span class="correction-hint">to get back on track</span>
        </div>
      `;
    }

    return `
      <div class="scramble-assistant-wrap">
        <div class="scramble-tokens-stream">${parts.join(' ')}</div>
        ${correctionHtml}
      </div>
    `;
  }
}
