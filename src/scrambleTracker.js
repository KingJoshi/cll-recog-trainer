// Smart Cube Scramble Assistant & Move Tracker
// Guides physical smart cube users through scrambles with move verification and correction,
// preventing premature timer triggers before the scramble is completed.

const ROTATION_STEP_MAPS = {
  x: { U: "F", B: "U", D: "B", F: "D", R: "R", L: "L" },
  y: { F: "R", L: "F", B: "L", R: "B", U: "U", D: "D" },
  z: { R: "U", D: "R", L: "D", U: "L", F: "F", B: "B" }
};

const TWO_BY_TWO_SENSOR_CONJUGATIONS = {
  L: { urf: "R", rot: { U: "B", B: "D", D: "F", F: "U", R: "R", L: "L" } },
  D: { urf: "U", rot: { F: "L", L: "B", B: "R", R: "F", U: "U", D: "D" } },
  B: { urf: "F", rot: { U: "R", R: "D", D: "L", L: "U", F: "F", B: "B" } }
};

function applyWcaRotationStep(faceMap, stepMap, times = 1) {
  let next = { ...faceMap };
  const n = ((times % 4) + 4) % 4;
  for (let i = 0; i < n; i++) {
    const mapped = {};
    for (const [k, stepSrc] of Object.entries(stepMap)) {
      mapped[k] = next[stepSrc];
    }
    next = mapped;
  }
  return next;
}

function applyFaceMapStep(faceMap, stepMap, times = 1) {
  let next = { ...faceMap };
  const n = ((times % 4) + 4) % 4;
  for (let i = 0; i < n; i++) {
    const mapped = {};
    for (const [k, v] of Object.entries(next)) {
      mapped[k] = stepMap[v];
    }
    next = mapped;
  }
  return next;
}

function mapFaceLetter(faceLetter, faceMap) {
  const upper = faceLetter.toUpperCase();
  const mappedUpper = faceMap[upper] || upper;
  return faceLetter === upper ? mappedUpper : mappedUpper.toLowerCase();
}

function buildHwToUserFaceMap(wcaFaceMap, sensor222Map, is2x2) {
  const hwToUser = {};
  if (is2x2) {
    // Check primary {U, R, F} user faces first so every hardware axis maps to the user's grip
    for (const userF of ["U", "R", "F", "D", "L", "B"]) {
      const wcaF = wcaFaceMap[userF] || userF;
      const physF = sensor222Map[wcaF] || wcaF;
      const hwF = TWO_BY_TWO_SENSOR_CONJUGATIONS[physF]?.urf || physF;
      if (!hwToUser[hwF]) {
        hwToUser[hwF] = userF;
      }
    }
    return hwToUser;
  }
  for (const [userF, hwF] of Object.entries(wcaFaceMap)) {
    hwToUser[hwF] = userF;
    hwToUser[hwF.toLowerCase()] = userF.toLowerCase();
  }
  return hwToUser;
}

/**
 * Convert scramble tokens that may include cube rotations (x, y, z) into expected
 * physical smart-cube hardware turns (WCA coordinates for 3x3+, and pure {U, R, F}
 * DLB-anchored coordinates for 2x2) while preserving the original display text.
 */
export function conjugateTokensToHardwareMoves(tokens = [], { is2x2 = false } = {}) {
  let wcaFaceMap = { U: "U", D: "D", F: "F", B: "B", R: "R", L: "L" };
  let sensor222Map = { U: "U", D: "D", F: "F", B: "B", R: "R", L: "L" };
  const leadingRotations = [];
  const moves = [];

  for (const tok of tokens) {
    const cleaned = String(tok || "").trim();
    if (!cleaned) continue;

    const rotMatch = /^([xyz])([2']|2')?$/i.exec(cleaned);
    if (rotMatch) {
      const axis = rotMatch[1].toLowerCase();
      const suffix = rotMatch[2] || "";
      const amount = suffix.includes("2") ? 2 : (suffix.includes("'") ? 3 : 1);
      wcaFaceMap = applyWcaRotationStep(wcaFaceMap, ROTATION_STEP_MAPS[axis], amount);
      if (moves.length === 0) leadingRotations.push(cleaned);
      continue;
    }

    const parsed = parseMoveToken(cleaned);
    if (!parsed) continue;

    const hwToUserFace = buildHwToUserFaceMap(wcaFaceMap, sensor222Map, is2x2);
    const wcaFace = mapFaceLetter(parsed.face, wcaFaceMap);
    if (is2x2) {
      const upperWca = wcaFace.toUpperCase();
      const physFace = sensor222Map[upperWca] || upperWca;
      const conj = TWO_BY_TWO_SENSOR_CONJUGATIONS[physFace];
      if (conj) {
        moves.push({ face: conj.urf, displayFace: parsed.face, amount: parsed.amount, text: cleaned, hwToUserFace });
        sensor222Map = applyFaceMapStep(sensor222Map, conj.rot, parsed.amount);
      } else {
        moves.push({ face: physFace, displayFace: parsed.face, amount: parsed.amount, text: cleaned, hwToUserFace });
      }
    } else {
      moves.push({ face: wcaFace, displayFace: parsed.face, amount: parsed.amount, text: cleaned, hwToUserFace });
    }
  }

  return {
    leadingRotations,
    moves,
    defaultHwToUserFace: buildHwToUserFaceMap(wcaFaceMap, sensor222Map, is2x2)
  };
}

export function parseMoveToken(token) {
  if (!token || typeof token !== "string") return null;
  const cleaned = token.trim();
  // Match outer (U, D, F, B, L, R) or wide (u, d, f, b, l, r) moves with optional 2, ', or 2' (case-sensitive)
  const match = /^([UDFBLRudfblr])([2']|2')?$/.exec(cleaned);
  if (!match) return null;
  const face = match[1];
  const suffix = match[2] || '';
  const amount = suffix.includes('2') ? 2 : (suffix.includes("'") ? 3 : 1);
  return { face, amount, raw: cleaned };
}

export function renderScrambleTrackerHtml(tracker, options = {}) {
  const status = tracker.getStatus();
  if (tracker.moves.length === 0) {
    return '<span class="scramble-empty">No scramble loaded</span>';
  }

  if (status.isComplete) {
    return `<span class="scramble-complete-badge">✓ Scramble Verified Complete!</span>`;
  }

  const suppressError = Boolean(options.suppressError);
  const suppressSubAmount = Boolean(options.suppressSubAmount);

  const parts = [];

  if (Array.isArray(tracker.leadingRotations) && tracker.leadingRotations.length > 0) {
    for (const rot of tracker.leadingRotations) {
      parts.push(`<span class="scramble-token token-rotation" title="Orient cube from WCA (White top, Green front) before scrambling">${rot}</span>`);
    }
  }

  for (let i = 0; i < tracker.currentIndex; i++) {
    parts.push(`<span class="scramble-token token-done">${tracker.moves[i].text}</span>`);
  }

  let cur = null;
  let displayNext = '';
  if (tracker.currentIndex < tracker.moves.length) {
    cur = tracker.moves[tracker.currentIndex];
    const remAmount = (cur.amount - tracker.currentSubAmount + 4) % 4;
    displayNext = formatMove(cur.displayFace || cur.face, remAmount);
    const subLabel = (!suppressSubAmount && tracker.currentSubAmount > 0)
      ? ` <small class="token-sub">(${displayNext} needed)</small>`
      : '';
    parts.push(`<span class="scramble-token token-current" title="Next move to perform">${cur.text}${subLabel}</span>`);
  }

  for (let i = tracker.currentIndex + 1; i < tracker.moves.length; i++) {
    parts.push(`<span class="scramble-token token-pending">${tracker.moves[i].text}</span>`);
  }

  let correctionHtml = '';
  if (!suppressError && status.hasError && status.corrections.length > 0) {
    const undoText = status.corrections.join(' ');
    correctionHtml = `
        <div class="scramble-correction-box">
          <span class="correction-icon">⚠️</span>
          <span class="correction-label">Incorrect turn! Please do:</span>
          <strong class="correction-moves">${undoText}</strong>
          <span class="correction-hint">to get back on track</span>
        </div>
      `;
  } else if (!suppressError && !suppressSubAmount && tracker.currentSubAmount > 0 && cur) {
    correctionHtml = `
        <div class="scramble-correction-box">
          <span class="correction-icon">⚠️</span>
          <span class="correction-label">Incomplete double turn (${cur.text})! Please do:</span>
          <strong class="correction-moves">${displayNext}</strong>
          <span class="correction-hint">to finish ${cur.text}</span>
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
  constructor(scrambleStr = '', options = {}) {
    this.reset(scrambleStr, options);
  }

  reset(scrambleStr = '', options = {}) {
    this.rawScramble = scrambleStr || '';
    this.scrambleString = this.rawScramble;
    this.trackerOptions = { is2x2: Boolean(options?.is2x2) };
    this.originalTokens = this._extractTokens(this.rawScramble);
    const { leadingRotations, moves, defaultHwToUserFace } = conjugateTokensToHardwareMoves(this.originalTokens, this.trackerOptions);
    this.leadingRotations = leadingRotations;
    this.moves = moves;
    this.defaultHwToUserFace = defaultHwToUserFace || {};

    this.currentIndex = 0;
    this.currentSubAmount = 0; // Tracks partial progress on current move (e.g. turned R of R2)
    this.deviations = []; // Stack of off-track turns on wrong faces: { face, amount }
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

      if (parsed.face === target.face) {
        const newSub = (this.currentSubAmount + parsed.amount) % 4;
        if (newSub === target.amount) {
          // Exactly satisfied the target move
          this.currentIndex++;
          this.currentSubAmount = 0;
        } else {
          // Partial turn (e.g. R of R2) or wrong direction/overshoot on current face:
          // Keep currentIndex on this move until it is actually satisfied!
          this.currentSubAmount = newSub;
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
    return this.moves.length > 0 && this.currentIndex >= this.moves.length && this.deviations.length === 0 && this.currentSubAmount === 0;
  }

  getStatus() {
    const isDone = this.isComplete();
    const cur = (!isDone && this.currentIndex < this.moves.length) ? this.moves[this.currentIndex] : null;
    const activeHwToUser = cur?.hwToUserFace || this.defaultHwToUserFace || {};
    const remAmount = cur ? (cur.amount - this.currentSubAmount + 4) % 4 : 0;
    const remMove = cur ? formatMove(cur.displayFace || cur.face, remAmount) : null;

    // A partial turn on a non-double move (e.g. R' instead of R, or R2 instead of R) is a direction/overshoot error on the current face.
    // A 90° turn on a double move (e.g. R of R2) is a normal mid-double-flick state unless other face deviations also occurred.
    const isSameFaceWrongDir = Boolean(cur && this.currentSubAmount > 0 && cur.amount !== 2);
    const hasError = this.deviations.length > 0 || isSameFaceWrongDir;

    let nextRequired = null;
    if (!isDone && this.deviations.length === 0 && cur) {
      nextRequired = remMove;
    }

    // Corrections are the reverse inverse of deviations, PLUS any remaining turn on the current move if partially turned
    const corrections = [...this.deviations].reverse().map(d => {
      const inv = (4 - (d.amount % 4)) % 4;
      const userFace = activeHwToUser[d.face] || d.face;
      return formatMove(userFace, inv);
    }).filter(Boolean);

    if (this.currentSubAmount > 0 && remMove && (this.deviations.length > 0 || isSameFaceWrongDir)) {
      corrections.push(remMove);
    }

    return {
      isComplete: isDone,
      currentIndex: this.currentIndex,
      currentSubAmount: this.currentSubAmount,
      totalMoves: this.moves.length,
      nextRequired,
      corrections,
      hasError,
      isPartiallyScrambled: this.currentIndex > 0 || this.currentSubAmount > 0 || hasError
    };
  }

  getHtml(options = {}) {
    return renderScrambleTrackerHtml(this, options);
  }
}
