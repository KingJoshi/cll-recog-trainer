// Smart Cube Alg Execution Drill View
// Supports multi-case drill pools, live smart-cube move teleprompter, mistake/undo hints,
// Setup+Alg or Alg-Only flow, automatic execution timing, and Spacebar manual fallback.

import { Alg } from 'cubing/alg';
import { cleanAlg, parseScrambleInput } from '../../algParser.js';
import { getTrack, getPreferredAlg, setPreferredAlg, getCustomAlgsForCase } from '../../data/algRegistry.js';
import { getEffectiveAlgsForCase } from '../../cube/algMirror.js';
import { getCachedCaseSvg, renderCaseSvg } from '../../caseVisualizer.js';
import { ScrambleTracker, formatMove } from '../../scrambleTracker.js';
import { normalize2x2ScrambleToURF, applyTrainingBottomOrientation } from '../../services/scrambleService.js';
import { getWeakestCasesForTrack } from '../../services/weakCasesService.js';
import { escapeHtml, formatCfopSplitMs } from '../../services/htmlUtils.js';
import { computeAverageOfN } from '../../services/solveStats.js';
import { renderBottomLayerPickerHtml, bindBottomLayerPickerEvents } from '../../ui/bottomLayerPicker.js';

export class AlgDrillView {
  constructor({
    container,
    appStore,
    onApplyScrambleToDisplay = null,
    onOpenCasePicker = null,
    onOpenBluetoothModal = null,
    onSelectionChange = null,
    onQuickSimSolutions = null,
    isCubeConnected = () => false
  } = {}) {
    this.container = container || null;
    this.appStore = appStore;
    this.onApplyScrambleToDisplay = onApplyScrambleToDisplay;
    this.onOpenCasePicker = onOpenCasePicker;
    this.onOpenBluetoothModal = onOpenBluetoothModal;
    this.onSelectionChange = onSelectionChange;
    this.onQuickSimSolutions = onQuickSimSolutions;
    this.isCubeConnected = isCubeConnected;

    this.currentPuzzle = appStore?.state?.currentPuzzle || "333";
    this.currentTrackId = appStore?.state?.currentTrackId || "pll";

    // Drill settings
    this.orderMode = "sequential"; // "sequential" | "random" | "weakest"
    this.targetRepsPerCase = 3; // 1 | 3 | 5 | 0 (0 = infinite)
    this.execMode = "alg-only"; // "alg-only" | "setup-alg"
    this.showAlg = true;

    // Queue state
    this.poolIds = [];
    this.weakReasonsById = {};
    this.queueIdx = 0;
    this.repOnCurrent = 0;
    this.currentCase = null;
    this.currentAlg = "";
    this.currentSetup = "";

    // Move tracking & execution timing state
    this.phase = "idle"; // "setup" | "alg" | "idle" | "done"
    this.tracker = new ScrambleTracker("");
    this.execStartedAt = null;
    this.mistakesInRep = 0;
    this.lastRepResult = null;
    this.repHistory = []; // [{ caseId, shortName, ms, tps, moves, mistakes, at }]
    this.algsDrawerOpen = false;
    this._advanceTimer = null;
    this._timerInterval = null;
    this._timerUiStartedAt = null;
    this._svgLoadToken = 0;
  }

  _startLiveTimer() {
    this._stopLiveTimer();
    this._timerUiStartedAt = typeof performance !== "undefined" ? performance.now() : Date.now();
    const updateTick = () => {
      const el = this.container?.querySelector?.("#algDrillTimerDisplay");
      if (!el || this._timerUiStartedAt == null) return;
      const now = typeof performance !== "undefined" ? performance.now() : Date.now();
      const elapsedSec = Math.max(0, (now - this._timerUiStartedAt) / 1000);
      el.textContent = `${elapsedSec.toFixed(2)}s`;
    };
    updateTick();
    if (typeof setInterval === "function") {
      this._timerInterval = setInterval(updateTick, 33);
    }
  }

  _stopLiveTimer() {
    if (this._timerInterval) {
      clearInterval(this._timerInterval);
      this._timerInterval = null;
    }
    this._timerUiStartedAt = null;
  }

  deactivate() {
    this._stopLiveTimer();
    if (this._advanceTimer) {
      clearTimeout(this._advanceTimer);
      this._advanceTimer = null;
    }
    this.execStartedAt = null;
  }

  setTrack(puzzleId, trackId) {
    this.deactivate();
    this.currentPuzzle = puzzleId || this.currentPuzzle;
    this.currentTrackId = trackId || this.currentTrackId;
    this.queueIdx = 0;
    this.repOnCurrent = 0;
    this.repHistory = [];
    this.lastRepResult = null;
    this._syncPoolFromStore();
    this._loadCurrentCase({ resetDisplay: true });
    this.render();
  }

  setCasePool(caseIds = []) {
    const track = getTrack(this.currentPuzzle, this.currentTrackId);
    if (!track || !track.cases?.length) return;
    const valid = caseIds.filter(id => track.caseById?.has(id));
    if (valid.length === 0) return;

    this.deactivate();
    this.appStore.setSelection(new Set(valid), { persist: true });
    this.onSelectionChange?.();

    this.poolIds = [...valid];
    this.queueIdx = 0;
    this.repOnCurrent = 0;
    this._loadCurrentCase({ resetDisplay: true });
    this.render();
  }

  syncPoolFromSelection() {
    this._syncPoolFromStore();
    if (!this.poolIds.includes(this.currentCase?.id)) {
      this.queueIdx = 0;
      this.repOnCurrent = 0;
    }
    this._loadCurrentCase({ resetDisplay: true });
    this.render();
  }

  _syncPoolFromStore() {
    const track = getTrack(this.currentPuzzle, this.currentTrackId);
    if (!track || !Array.isArray(track.cases) || track.cases.length === 0) {
      this.poolIds = [];
      return;
    }
    const sel = this.appStore?.state?.selectedCases;
    let ids = track.cases.filter(c => sel?.has(c.id)).map(c => c.id);
    if (ids.length === 0) {
      ids = track.cases.slice(0, Math.min(3, track.cases.length)).map(c => c.id);
    }
    if (this.orderMode === "weakest") {
      const s = this.appStore?.state || {};
      const activeSess = this.appStore?.getActiveSession?.();
      const weak = getWeakestCasesForTrack({
        puzzleId: this.currentPuzzle,
        trackId: this.currentTrackId,
        solves: activeSess?.solves || [],
        recogStats: s.stats,
        caseTags: s.caseTags,
        limit: ids.length,
        twoByTwoMethod: s.twoByTwoMethod || "cll"
      });
      this.weakReasonsById = weak.reasonsById || {};
      const orderMap = new Map(weak.caseIds.map((id, i) => [id, i]));
      ids = [...ids].sort((a, b) => (orderMap.get(a) ?? 9999) - (orderMap.get(b) ?? 9999));
    }
    this.poolIds = ids;
  }

  _getAllAlgsForCase(caseObj) {
    if (!caseObj) return { algs: [], activeAlgId: "" };
    const s = this.appStore?.state || {};
    const track = getTrack(this.currentPuzzle, this.currentTrackId);
    const ohHand = s.ohHand || "left";
    const ohTableAbuse = s.ohTableAbuse !== false;
    const effAlgs = getEffectiveAlgsForCase(this.currentPuzzle, this.currentTrackId, caseObj, {
      ohHand,
      ohTableAbuse,
      trackCases: track?.cases || []
    });
    const customAlgs = getCustomAlgsForCase(this.currentPuzzle, caseObj.id);
    const merged = [...customAlgs, ...effAlgs];
    const seenAlg = new Set();
    const algs = [];
    for (const a of merged) {
      if (!a?.alg) continue;
      const key = `${a.id}:${a.alg}`;
      if (seenAlg.has(key)) continue;
      seenAlg.add(key);
      algs.push(a);
    }
    const prefId = getPreferredAlg(this.currentPuzzle, caseObj.id);
    const active = (prefId && algs.find(a => a.id === prefId)) || algs.find(a => a.isDefault) || algs[0];
    return { algs, activeAlgId: active?.id || "" };
  }

  _resolvePreferredAlg(caseObj) {
    const { algs, activeAlgId } = this._getAllAlgsForCase(caseObj);
    const match = algs.find(a => a.id === activeAlgId) || algs[0];
    return match?.alg || caseObj?.algs?.[0]?.alg || "";
  }

  selectAlgForCurrentCase(algId) {
    if (!this.currentCase || !algId) return;
    setPreferredAlg(this.currentPuzzle, this.currentCase.id, algId);
    this._loadCurrentCase({ resetDisplay: true });
    this.render();
  }

  openAlgQuickSim(targetAlgId = null) {
    if (!this.currentCase || !this.onQuickSimSolutions) return;
    const { algs: caseAlgs, activeAlgId } = this._getAllAlgsForCase(this.currentCase);
    if (!caseAlgs.length) return;

    const s = this.appStore?.state || {};
    const whiteBottom = s.alwaysWhiteBottom !== false;
    const needsZ2 = whiteBottom && ["lbl", "cll", "ortega", "eg1", "eg2", "f2l", "oll", "pll", "coll", "cmll", "wv", "parity"].includes(this.currentTrackId);
    const title = this.currentCase.name || this.currentCase.shortName || this.currentCase.id;

    const solutions = caseAlgs.map((a, idx) => {
      let baseSetup = a.mirroredSetup || this.currentCase.setup || this.currentCase.scramble || "";
      if (!baseSetup && a.alg) {
        try {
          baseSetup = new Alg(a.alg).invert().toString();
        } catch {
          baseSetup = "";
        }
      }
      const rawSetupWithAuf = `${baseSetup}${a.startAuf ? ` ${a.startAuf}` : ""}`.trim();
      const scramble = `${needsZ2 && rawSetupWithAuf && !/^z2\b/i.test(rawSetupWithAuf) ? "z2 " : ""}${rawSetupWithAuf}`.trim();
      const cleanMoves = cleanAlg(a.alg || "");
      const parsed = cleanMoves ? parseScrambleInput(cleanMoves) : { ok: false };
      const moveCount = parsed.ok
        ? parsed.moves.length
        : (cleanMoves ? cleanMoves.split(/\s+/).filter(Boolean).length : 0);
      const isPref = a.id === activeAlgId;
      const shortName = a.ohBadge || (idx === 0 ? "Primary" : `Alg ${idx + 1}`);
      const pillLabel = `${isPref ? "★ " : ""}${shortName}${moveCount ? ` · ${moveCount}m` : ""}`;

      return {
        label: title,
        shortLabel: shortName,
        pillLabel,
        moves: cleanMoves,
        moveCount,
        inspection: "none",
        scramble,
        note: a.note || "",
        group: this.currentCase.group || null,
        ohBadge: a.ohBadge || null,
        startAuf: a.startAuf || null
      };
    });

    const wantedId = targetAlgId || activeAlgId;
    let activeIndex = wantedId ? caseAlgs.findIndex(a => a.id === wantedId) : 0;
    if (activeIndex < 0) activeIndex = 0;

    this.onQuickSimSolutions({
      puzzle: this.currentPuzzle,
      scramble: solutions[activeIndex]?.scramble || "",
      solutions,
      activeIndex,
      title
    });
  }

  deleteRep(repIndex) {
    if (!Number.isInteger(repIndex) || repIndex < 0 || repIndex >= this.repHistory.length) return;
    this.repHistory.splice(repIndex, 1);
    this.lastRepResult = this.repHistory.length ? this.repHistory[this.repHistory.length - 1] : null;
    this.render();
  }

  clearReps() {
    if (this.repHistory.length === 0) return;
    this.repHistory = [];
    this.lastRepResult = null;
    this.render();
  }

  _formatForSmartTracker(seq) {
    if (!seq) return "";
    if (this.currentPuzzle === "222" && /[LDB]/i.test(seq)) {
      return normalize2x2ScrambleToURF(seq);
    }
    return seq;
  }

  _loadCurrentCase({ resetDisplay = false } = {}) {
    this._stopLiveTimer();
    if (this._advanceTimer) {
      clearTimeout(this._advanceTimer);
      this._advanceTimer = null;
    }
    const track = getTrack(this.currentPuzzle, this.currentTrackId);
    if (!track || this.poolIds.length === 0) {
      this.currentCase = null;
      this.currentAlg = "";
      this.currentSetup = "";
      this.phase = "idle";
      this.tracker.reset("");
      return;
    }
    const idx = Math.max(0, Math.min(this.poolIds.length - 1, this.queueIdx));
    const caseObj = track.caseById.get(this.poolIds[idx]) || track.cases[0];
    this.currentCase = caseObj;
    const rawAlg = this._resolvePreferredAlg(caseObj);
    // Strip whole-cube rotations for physical smart cube turn matching if only rotations
    this.currentAlg = rawAlg.replace(/\b[xyz][2']?\b/gi, "").replace(/\s+/g, " ").trim();
    if (caseObj.setup) {
      this.currentSetup = caseObj.setup;
    } else if (this.currentAlg) {
      try {
        this.currentSetup = new Alg(this.currentAlg).invert().toString();
      } catch {
        this.currentSetup = "";
      }
    } else {
      this.currentSetup = "";
    }

    this.execStartedAt = null;
    this.mistakesInRep = 0;

    if (this.execMode === "setup-alg" && this.currentSetup) {
      this.phase = "setup";
      this.tracker.reset(this._formatForSmartTracker(this.currentSetup));
    } else {
      this.phase = "alg";
      this.tracker.reset(this._formatForSmartTracker(this.currentAlg));
    }

    if (resetDisplay && this.onApplyScrambleToDisplay) {
      const s = this.appStore?.state || {};
      const scr = this.currentSetup || "";
      const displayScr = scr
        ? applyTrainingBottomOrientation(scr, s.trainingBottomFaces, { randomY: s.allowAUF !== false })
        : "";
      this.onApplyScrambleToDisplay(displayScr);
    }
  }

  refreshOrientation() {
    this._loadCurrentCase({ resetDisplay: true });
    this.render();
  }

  _advanceToNextRep() {
    if (this.poolIds.length === 0) return;
    if (this.targetRepsPerCase === 0) {
      // Infinite on current unless random
      if (this.orderMode === "random" && this.poolIds.length > 1) {
        this.queueIdx = Math.floor(Math.random() * this.poolIds.length);
      }
      this._loadCurrentCase({ resetDisplay: true });
      this.render();
      return;
    }

    this.repOnCurrent++;
    if (this.repOnCurrent >= this.targetRepsPerCase) {
      this.repOnCurrent = 0;
      if (this.orderMode === "random" && this.poolIds.length > 1) {
        let next = this.queueIdx;
        while (next === this.queueIdx) {
          next = Math.floor(Math.random() * this.poolIds.length);
        }
        this.queueIdx = next;
      } else {
        this.queueIdx = (this.queueIdx + 1) % this.poolIds.length;
      }
    }
    this._loadCurrentCase({ resetDisplay: true });
    this.render();
  }

  handleSmartMove(moveStr, timestamp = null) {
    if (!moveStr || !this.currentCase) return false;
    const tok = String(moveStr).trim();
    if (!tok || /^[xyz][2']?$/i.test(tok)) return false;

    if (this.phase === "done") {
      // Starting immediately with a move on next rep accelerates drilling
      return false;
    }

    const now = typeof timestamp === "number" && Number.isFinite(timestamp)
      ? timestamp
      : (typeof performance !== "undefined" ? performance.now() : Date.now());

    if (this.phase === "setup") {
      this.tracker.applyMove(tok);
      const st = this.tracker.getStatus();
      if (st.hasError) this.mistakesInRep++;
      if (this.tracker.isComplete()) {
        this.phase = "alg";
        this.tracker.reset(this._formatForSmartTracker(this.currentAlg));
        this.execStartedAt = null;
      }
      this.render();
      return true;
    }

    if (this.phase === "alg") {
      const wasAtStart = this.tracker.currentIndex === 0 && this.tracker.currentSubAmount === 0 && !this.tracker.getStatus().hasError;
      if (wasAtStart && this.execStartedAt == null) {
        this.execStartedAt = now;
        this._startLiveTimer();
      }
      this.tracker.applyMove(tok);
      const st = this.tracker.getStatus();
      if (st.hasError) {
        this.mistakesInRep++;
      }
      if (this.tracker.isComplete()) {
        const endT = now;
        const durationMs = this.execStartedAt != null
          ? Math.max(80, Math.round(endT - this.execStartedAt))
          : Math.max(80, this.tracker.moves.length * 120);
        const moveCount = Math.max(1, this.tracker.moves.length);
        const tps = Number((moveCount / (durationMs / 1000)).toFixed(2));
        this._recordCompletedRep({ ms: durationMs, moves: moveCount, tps, mistakes: this.mistakesInRep });
      } else {
        this.render();
        if (this.execStartedAt != null) this._startLiveTimer();
      }
      return true;
    }

    return false;
  }

  completeManualRep(manualMs = null) {
    if (!this.currentCase) return;
    if (this.phase === "idle" || (this.phase === "alg" && this.execStartedAt == null)) {
      this.execStartedAt = typeof performance !== "undefined" ? performance.now() : Date.now();
      this.phase = "alg";
      this.render();
      this._startLiveTimer();
      return;
    }
    const now = typeof performance !== "undefined" ? performance.now() : Date.now();
    const ms = typeof manualMs === "number" && manualMs > 0
      ? Math.round(manualMs)
      : Math.max(100, Math.round(now - (this.execStartedAt || now)));
    const moveCount = Math.max(1, this.currentAlg.split(/\s+/).filter(Boolean).length);
    const tps = Number((moveCount / (ms / 1000)).toFixed(2));
    this._recordCompletedRep({ ms, moves: moveCount, tps, mistakes: this.mistakesInRep });
  }

  _recordCompletedRep({ ms, moves, tps, mistakes = 0 }) {
    this._stopLiveTimer();
    const rep = {
      caseId: this.currentCase.id,
      shortName: this.currentCase.shortName || this.currentCase.id,
      ms,
      tps,
      moves,
      mistakes,
      at: Date.now()
    };
    this.lastRepResult = rep;
    this.repHistory.push(rep);
    this.phase = "done";
    this.render();
    this._advanceTimer = setTimeout(() => {
      this._advanceTimer = null;
      this._advanceToNextRep();
    }, 480);
  }

  loadWeakestCases() {
    const s = this.appStore?.state || {};
    const activeSess = this.appStore?.getActiveSession?.();
    const res = getWeakestCasesForTrack({
      puzzleId: this.currentPuzzle,
      trackId: this.currentTrackId,
      solves: activeSess?.solves || [],
      recogStats: s.stats,
      caseTags: s.caseTags,
      limit: 5,
      twoByTwoMethod: s.twoByTwoMethod || "cll"
    });
    this.weakReasonsById = res.reasonsById || {};
    if (res.caseIds.length > 0) {
      this.orderMode = "weakest";
      this.setCasePool(res.caseIds);
    }
  }

  _renderTeleprompterTokens() {
    if (!this.showAlg) {
      return `<div class="alg-drill-hidden-alg">Alg hidden (Blind muscle-memory mode — execute from memory!)</div>`;
    }
    const status = this.tracker.getStatus();
    if (!this.tracker.moves.length) {
      return `<div class="alg-drill-hidden-alg">No moves parsed for this algorithm.</div>`;
    }
    if (status.isComplete) {
      return `<div class="alg-drill-complete-banner">✓ ${this.phase === "setup" ? "Setup Complete!" : "Executed Cleanly!"}</div>`;
    }
    const parts = [];
    for (let i = 0; i < this.tracker.currentIndex; i++) {
      parts.push(`<span class="drill-tok is-done">${escapeHtml(this.tracker.moves[i].text)}</span>`);
    }
    if (this.tracker.currentIndex < this.tracker.moves.length) {
      const cur = this.tracker.moves[this.tracker.currentIndex];
      const rem = (cur.amount - this.tracker.currentSubAmount + 4) % 4;
      const nextText = this.tracker.currentSubAmount > 0 ? formatMove(cur.face, rem) : cur.text;
      const cls = status.hasError ? "drill-tok is-error" : "drill-tok is-current";
      parts.push(`<span class="${cls}">${escapeHtml(nextText)}</span>`);
    }
    for (let i = this.tracker.currentIndex + 1; i < this.tracker.moves.length; i++) {
      parts.push(`<span class="drill-tok is-pending">${escapeHtml(this.tracker.moves[i].text)}</span>`);
    }

    const undoHint = status.hasError && status.corrections?.length
      ? `<div class="alg-drill-undo-hint">⚠️ Off track — undo with <strong>${escapeHtml(status.corrections.join(" "))}</strong></div>`
      : "";

    return `<div class="alg-drill-tokens-wrap">${parts.join("")}</div>${undoHint}`;
  }

  _computeSessionMetrics() {
    const n = this.repHistory.length;
    if (n === 0) return { n: 0, cleanPct: "-", bestMs: null, meanMs: null, ao5Ms: null, avgTps: "-" };
    const cleanCount = this.repHistory.filter(r => r.mistakes === 0).length;
    const times = this.repHistory.map(r => r.ms);
    const bestMs = Math.min(...times);
    const meanMs = Math.round(times.reduce((a, b) => a + b, 0) / n);
    const ao5 = computeAverageOfN([...this.repHistory].reverse().map(r => ({ ms: r.ms, rawMs: r.ms, penalty: null })), 5);
    const avgTps = (this.repHistory.reduce((a, r) => a + r.tps, 0) / n).toFixed(2);
    return {
      n,
      cleanPct: `${Math.round((cleanCount / n) * 100)}%`,
      bestMs,
      meanMs,
      ao5Ms: Number.isFinite(ao5) && ao5 > 0 ? ao5 : null,
      avgTps
    };
  }

  render() {
    if (!this.container) return;
    const track = getTrack(this.currentPuzzle, this.currentTrackId);
    if (!track || !track.cases?.length) {
      this.container.innerHTML = `<div class="alg-drill-card"><p class="alg-drill-empty">Select a case-based track (CLL, OLL, PLL, COLL, CMLL, WV, F2L) to drill algorithms.</p></div>`;
      return;
    }

    const connected = Boolean(this.isCubeConnected());
    const metrics = this._computeSessionMetrics();
    const caseId = this.currentCase?.id || "";
    const caseLabel = this.currentCase?.name || this.currentCase?.shortName || caseId;
    const weakNote = this.weakReasonsById[caseId] || "";
    const svgPuzzle = this.currentPuzzle === "333oh" ? "333" : this.currentPuzzle;
    let svgHtml = caseId ? getCachedCaseSvg(svgPuzzle, this.currentTrackId, caseId) : "";
    if (!svgHtml && this.currentCase) {
      const tok = ++this._svgLoadToken;
      renderCaseSvg(svgPuzzle, this.currentTrackId, this.currentCase).then(svg => {
        if (tok !== this._svgLoadToken) return;
        const slot = this.container?.querySelector(".alg-drill-case-svg");
        if (slot && svg) slot.innerHTML = svg;
      });
    }

    const poolChipsHtml = this.poolIds.map((id, i) => {
      const cObj = track.caseById.get(id);
      const lbl = cObj?.shortName || id.replace(/^(oll|pll|f2l|coll|cmll|wv)-/, "");
      const isCur = i === this.queueIdx;
      return `<span class="alg-drill-pool-chip ${isCur ? "is-active" : ""}" data-pool-idx="${i}">
        <button type="button" class="alg-drill-pool-jump" data-pool-jump="${i}">${escapeHtml(lbl)}</button>
        ${this.poolIds.length > 1 ? `<button type="button" class="alg-drill-pool-remove" data-pool-remove="${escapeHtml(id)}" aria-label="Remove ${escapeHtml(lbl)}">×</button>` : ""}
      </span>`;
    }).join("");

    const recentSlice = this.repHistory.map((r, idx) => ({ ...r, origIdx: idx })).slice(-8).reverse();
    const recentHtml = recentSlice.map(r => {
      const cls = r.mistakes === 0 ? "is-clean" : "is-dirty";
      return `<span class="alg-drill-rep-pill ${cls}" title="${escapeHtml(r.caseId)}: ${r.tps} TPS (${r.mistakes} mistake${r.mistakes === 1 ? "" : "s"})">
        <span>${escapeHtml(r.shortName)} ${(r.ms / 1000).toFixed(2)}s</span>
        <button type="button" class="alg-drill-rep-del" data-rep-delete="${r.origIdx}" aria-label="Delete rep ${escapeHtml(r.shortName)} ${(r.ms / 1000).toFixed(2)}s">&times;</button>
      </span>`;
    }).join("");

    const manualRunning = this.phase === "alg" && this.execStartedAt != null;
    const isDone = this.phase === "done" && this.lastRepResult;
    const liveElapsedSec = manualRunning && this._timerUiStartedAt != null
      ? Math.max(0, ((typeof performance !== "undefined" ? performance.now() : Date.now()) - this._timerUiStartedAt) / 1000)
      : (isDone ? (this.lastRepResult.ms / 1000) : 0);
    const timerCls = manualRunning ? "is-running" : (isDone ? "is-done" : "");
    const timerSub = manualRunning
      ? "Running"
      : (isDone ? `${this.lastRepResult.tps} TPS` : "Ready");

    const { algs: caseAlgs, activeAlgId } = this._getAllAlgsForCase(this.currentCase);
    const algsDrawerHtml = caseAlgs.length > 0
      ? `
        <details class="alg-drill-algs-drawer" ${this.algsDrawerOpen ? "open" : ""}>
          <summary>Algorithms for ${escapeHtml(this.currentCase?.shortName || caseId)} (${caseAlgs.length} option${caseAlgs.length === 1 ? "" : "s"} — click to switch)</summary>
          <div class="alg-drill-algs-list">
            ${caseAlgs.map(a => `
              <div class="alg-drill-alg-row ${a.id === activeAlgId ? "active" : ""}">
                <button type="button" class="alg-drill-alg-option" data-drill-select-alg="${escapeHtml(a.id)}">
                  <code>${escapeHtml(a.alg)}</code>
                  <span class="alg-drill-alg-note">${escapeHtml(a.note || (a.isDefault ? "Default" : "Alt"))}</span>
                </button>
                <button type="button" class="btn btn-xs alg-drill-alg-sim-btn" data-drill-sim-alg="${escapeHtml(a.id)}" title="Simulate this solution in 3D popup">Sim</button>
              </div>
            `).join("")}
          </div>
        </details>
      `
      : "";

    this.container.innerHTML = `
      <div class="alg-drill-card">
        <div class="alg-drill-top-bar">
          <div class="alg-drill-pool-head">
            <strong>Drill Pool (${this.poolIds.length} case${this.poolIds.length === 1 ? "" : "s"})</strong>
            <div class="alg-drill-pool-actions">
              <button type="button" id="algDrillChooseCasesBtn" class="btn btn-small" title="Open Active Cases picker above to add or remove cases">⚙️ Choose Cases</button>
              <button type="button" id="algDrillLoadWeakestBtn" class="btn btn-small btn-weakest">⚡ Load Weakest</button>
            </div>
          </div>
          <div class="alg-drill-pool-chips">${poolChipsHtml}</div>
        </div>

        <div class="alg-drill-controls-row">
          <div class="alg-drill-ctrl-group">
            <span class="ctrl-lbl">Order:</span>
            ${["sequential", "random", "weakest"].map(m => `<button type="button" class="drill-opt-btn ${this.orderMode === m ? "active" : ""}" data-drill-order="${m}">${m === "sequential" ? "Sequential" : (m === "random" ? "Random" : "Weakest")}</button>`).join("")}
          </div>
          <div class="alg-drill-ctrl-group">
            <span class="ctrl-lbl">Reps/Case:</span>
            ${[1, 3, 5, 0].map(r => `<button type="button" class="drill-opt-btn ${this.targetRepsPerCase === r ? "active" : ""}" data-drill-reps="${r}">${r === 0 ? "∞" : `${r}×`}</button>`).join("")}
          </div>
          <div class="alg-drill-ctrl-group">
            <span class="ctrl-lbl">Flow:</span>
            <button type="button" class="drill-opt-btn ${this.execMode === "alg-only" ? "active" : ""}" data-drill-flow="alg-only">Alg Only</button>
            <button type="button" class="drill-opt-btn ${this.execMode === "setup-alg" ? "active" : ""}" data-drill-flow="setup-alg">Setup + Alg</button>
          </div>
          ${renderBottomLayerPickerHtml(this.appStore?.state?.trainingBottomFaces || ["white"], { label: "Bottom:" })}
          <button type="button" id="algDrillToggleShowBtn" class="drill-opt-btn ${this.showAlg ? "active" : ""}">${this.showAlg ? "👁 Alg Shown" : "🙈 Alg Hidden"}</button>
        </div>

        <div class="alg-drill-stage">
          <div class="alg-drill-stage-header">
            <div class="alg-drill-case-banner">
              <div class="alg-drill-case-svg">${svgHtml}</div>
              <div class="alg-drill-case-info">
                <div class="alg-drill-case-title-row">
                  <h3>${escapeHtml(caseLabel)}</h3>
                  <span class="badge badge-pll-case">${this.targetRepsPerCase > 0 ? `Rep ${this.repOnCurrent + 1} / ${this.targetRepsPerCase}` : `Rep ${this.repOnCurrent + 1}`}</span>
                  <span class="alg-drill-ble-badge ${connected ? "is-connected" : ""}">${connected ? "ᛒ Smart Cube Live" : "No Smart Cube"}</span>
                </div>
                <div class="alg-drill-phase-sub">
                  ${this.phase === "setup"
                    ? `Step 1/2 — Apply setup on cube: <strong>${escapeHtml(this.currentSetup)}</strong>`
                    : (this.phase === "done"
                      ? `✓ Done in <strong>${(this.lastRepResult.ms / 1000).toFixed(2)}s</strong> (${this.lastRepResult.tps} TPS)`
                      : (connected
                        ? "Execute the highlighted moves on your Smart Cube — timer starts automatically on Move 1"
                        : "Press Space (or Start) before &amp; after executing the alg, or connect a Smart Cube"))}
                  ${weakNote ? `<span class="alg-drill-weak-note">· ${escapeHtml(weakNote)}</span>` : ""}
                </div>
              </div>
            </div>
            <div class="alg-drill-timer-box" aria-live="off">
              <div id="algDrillTimerDisplay" class="alg-drill-timer ${timerCls}">${liveElapsedSec.toFixed(2)}s</div>
              <span class="alg-drill-timer-sub">${escapeHtml(timerSub)}</span>
            </div>
          </div>

          <div class="alg-drill-teleprompter">
            ${this._renderTeleprompterTokens()}
          </div>

          ${algsDrawerHtml}

          <div class="alg-drill-action-row">
            ${!connected ? `<button type="button" id="algDrillConnectCubeBtn" class="btn btn-small">ᛒ Connect Smart Cube</button>` : ""}
            <button type="button" id="algDrillManualBtn" class="btn btn-primary btn-small">${manualRunning ? "⏹ Finish Rep (Space)" : "▶ Start / Complete (Space)"}</button>
            <button type="button" id="algDrillResetRepBtn" class="btn btn-small">↺ Retry Rep</button>
            <button type="button" id="algDrillNextCaseBtn" class="btn btn-small">⏭ Next Case</button>
          </div>
        </div>

        <div class="alg-drill-stats-row">
          <div class="drill-stat-box"><span>Reps</span><strong>${metrics.n}</strong></div>
          <div class="drill-stat-box"><span>Clean%</span><strong>${metrics.cleanPct}</strong></div>
          <div class="drill-stat-box"><span>Best</span><strong>${metrics.bestMs != null ? formatCfopSplitMs(metrics.bestMs) : "-"}</strong></div>
          <div class="drill-stat-box"><span>Mean</span><strong>${metrics.meanMs != null ? formatCfopSplitMs(metrics.meanMs) : "-"}</strong></div>
          <div class="drill-stat-box"><span>Ao5</span><strong>${metrics.ao5Ms != null ? formatCfopSplitMs(metrics.ao5Ms) : "-"}</strong></div>
          <div class="drill-stat-box"><span>Avg TPS</span><strong>${metrics.avgTps}</strong></div>
        </div>

        ${recentHtml ? `
          <div class="alg-drill-recent-wrap">
            <div class="alg-drill-recent-head">
              <span>Recent Reps (${this.repHistory.length})</span>
              <button type="button" id="algDrillClearRepsBtn" class="btn btn-xs">Clear Reps</button>
            </div>
            <div class="alg-drill-recent-strip">${recentHtml}</div>
          </div>
        ` : ""}
      </div>
    `;

    this._bindEvents();
  }

  _bindEvents() {
    if (!this.container || typeof this.container.querySelector !== "function") return;
    this.container.querySelector("#algDrillChooseCasesBtn")?.addEventListener("click", () => {
      this.onOpenCasePicker?.();
    });
    this.container.querySelector("#algDrillLoadWeakestBtn")?.addEventListener("click", () => {
      this.loadWeakestCases();
    });
    this.container.querySelectorAll("[data-pool-jump]").forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.poolJump);
        if (Number.isFinite(idx) && idx >= 0 && idx < this.poolIds.length) {
          this.queueIdx = idx;
          this.repOnCurrent = 0;
          this._loadCurrentCase({ resetDisplay: true });
          this.render();
        }
      });
    });
    this.container.querySelectorAll("[data-pool-remove]").forEach(btn => {
      btn.addEventListener("click", () => {
        const rmId = btn.dataset.poolRemove;
        const nextIds = this.poolIds.filter(id => id !== rmId);
        if (nextIds.length > 0) this.setCasePool(nextIds);
      });
    });
    this.container.querySelectorAll("[data-drill-order]").forEach(btn => {
      btn.addEventListener("click", () => {
        this.orderMode = btn.dataset.drillOrder;
        this._syncPoolFromStore();
        this.queueIdx = 0;
        this.repOnCurrent = 0;
        this._loadCurrentCase({ resetDisplay: true });
        this.render();
      });
    });
    this.container.querySelectorAll("[data-drill-reps]").forEach(btn => {
      btn.addEventListener("click", () => {
        this.targetRepsPerCase = Number(btn.dataset.drillReps) || 0;
        this.repOnCurrent = 0;
        this.render();
      });
    });
    this.container.querySelectorAll("[data-drill-flow]").forEach(btn => {
      btn.addEventListener("click", () => {
        this.execMode = btn.dataset.drillFlow;
        this._loadCurrentCase({ resetDisplay: true });
        this.render();
      });
    });
    this.container.querySelector("#algDrillToggleShowBtn")?.addEventListener("click", () => {
      this.showAlg = !this.showAlg;
      this.render();
    });
    bindBottomLayerPickerEvents(
      this.container,
      () => this.appStore?.state?.trainingBottomFaces || ["white"],
      (nextFaces) => {
        if (this.appStore?.setTrainingBottomFaces) {
          this.appStore.setTrainingBottomFaces(nextFaces);
        } else if (this.appStore?.state) {
          this.appStore.state.trainingBottomFaces = nextFaces;
          this.refreshOrientation();
        }
      }
    );
    this.container.querySelector("#algDrillConnectCubeBtn")?.addEventListener("click", () => {
      this.onOpenBluetoothModal?.();
    });
    this.container.querySelector("#algDrillManualBtn")?.addEventListener("click", () => {
      this.completeManualRep();
    });
    this.container.querySelector("#algDrillResetRepBtn")?.addEventListener("click", () => {
      this._loadCurrentCase({ resetDisplay: true });
      this.render();
    });
    this.container.querySelector("#algDrillNextCaseBtn")?.addEventListener("click", () => {
      this.repOnCurrent = 0;
      this.queueIdx = this.poolIds.length > 0 ? (this.queueIdx + 1) % this.poolIds.length : 0;
      this._loadCurrentCase({ resetDisplay: true });
      this.render();
    });
    this.container.querySelector(".alg-drill-algs-drawer")?.addEventListener("toggle", (e) => {
      this.algsDrawerOpen = Boolean(e.currentTarget?.open);
    });
    this.container.querySelectorAll("[data-drill-select-alg]").forEach(btn => {
      btn.addEventListener("click", () => {
        const algId = btn.dataset.drillSelectAlg;
        if (algId) this.selectAlgForCurrentCase(algId);
      });
    });
    this.container.querySelectorAll("[data-drill-sim-alg]").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const algId = btn.dataset.drillSimAlg;
        if (algId) this.openAlgQuickSim(algId);
      });
    });
    this.container.querySelectorAll("[data-rep-delete]").forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.repDelete);
        if (Number.isInteger(idx)) this.deleteRep(idx);
      });
    });
    this.container.querySelector("#algDrillClearRepsBtn")?.addEventListener("click", () => {
      this.clearReps();
    });
  }
}
