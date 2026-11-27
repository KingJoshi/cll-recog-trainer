// Study View: Handles Case Grid, 3D Flashcard, and Reference Guide for any active track

import {
  PUZZLES,
  getTrack,
  getPreferredAlg,
  setPreferredAlg,
  getCustomAlgsForCase,
  addCustomAlgForCase,
  removeCustomAlgForCase,
  formatCaseDisplayId,
  getDistinctCaseName
} from './data/algRegistry.js';
import { verifyCustomAlgForCase } from './cube/customAlgVerifier.js';
import { renderCaseSvg, applyColorsTo3DCube } from './caseVisualizer.js';
import { PLL_TWO_SIDED_GUIDE, OLL_TWO_SIDED_GUIDE } from './data/twoSidedRecogData.js';
import { escapeHtml } from './services/htmlUtils.js';
import { getEffectiveAlgsForCase } from './cube/algMirror.js';
import { parseScrambleInput, cleanAlg } from './algParser.js';
import { SIM_SPEED_OPTIONS, sanitizeF2lMode } from './state/appStore.js';
import {
  ESSENTIAL_F2L_IDS,
  ESSENTIAL_F2L_MIRROR_MAP,
  getEssentialMirrorPartnerId,
  F2L_INTERMEDIATE_GROUPS,
  F2L_ADVANCED_GROUPS,
  f2lIntermediateCases,
  f2lAdvancedCases,
  f2lExtendedById
} from './data/f2lExtendedData.js';
import {
  ICON_SKIP_START,
  ICON_STEP_BACK,
  ICON_PLAY,
  ICON_PAUSE,
  ICON_REPLAY,
  ICON_STEP_FORWARD,
  ICON_SKIP_END,
  ICON_RESET_ANGLE,
  ICON_POPUP_SIM,
  ICON_DIAGRAM
} from './ui/transportIcons.js';
import {
  renderFirstFaceStudyHtml,
  bindFirstFaceStudyEvents,
  createFirstLayerExplorerState,
  renderFirstLayerStudyHtml,
  bindFirstLayerStudyEvents,
  syncFirstLayerExplorerSpeed,
  teardownFirstLayerExplorer3d
} from './features/study/firstLayerExplorer.js';
import { render3BldGuideHtml } from './features/study/bldGuideRenderer.js';

let ScrambleDisplayClass = null;
async function getScrambleDisplay() {
  if (!ScrambleDisplayClass && typeof window !== "undefined") {
    const mod = await import('scramble-display');
    ScrambleDisplayClass = mod.ScrambleDisplay;
  }
  return ScrambleDisplayClass;
}

export const TWO_LOOK_OLL_STUDY_IDS = new Set([
  "oll-02", "oll-44", "oll-45",
  "oll-21", "oll-22", "oll-23", "oll-24", "oll-25", "oll-26", "oll-27"
]);

const TWO_LOOK_OLL_GROUP_OVERRIDES = {
  "oll-45": "Line (I-Shape)",
  "oll-44": "L-Shapes",
  "oll-02": "Dot Shapes"
};

const TWO_LOOK_OLL_GROUP_ORDER = [
  "All Edges Oriented (Cross)",
  "Line (I-Shape)",
  "L-Shapes",
  "Dot Shapes"
];

export const TWO_LOOK_PLL_STUDY_IDS = new Set([
  "T", "Y", "Ua", "Ub", "H", "Z"
]);

const MAX_TWOSIDED_3D = 12;

export class StudyView {
  constructor(options) {
    this.container = options.container;
    this.onSelectCase = options.onSelectCase; // (caseObj) => void
    this.onSimulateCase = options.onSimulateCase; // (caseObj, algObj) => void
    this.onPracticeCase = options.onPracticeCase; // (caseObj) => void
    this.onEditLabel = options.onEditLabel; // (caseObj, algObj) => void
    this.onQuickSimSolutions = options.onQuickSimSolutions || null; // (payload) => void
    this.getAlgCustomLabel = options.getAlgCustomLabel; // (caseObj, algObj) => string
    this.getSelectedCaseIds = options.getSelectedCaseIds || (() => new Set());
    this.getAlwaysWhiteBottom = options.getAlwaysWhiteBottom || (() => true);
    this.getShowReflection = options.getShowReflection || (() => true);
    this.getOhHand = options.getOhHand || (() => "left");
    this.onSetOhHand = options.onSetOhHand || null;
    this.getOhTableAbuse = options.getOhTableAbuse || (() => true);
    this.onSetOhTableAbuse = options.onSetOhTableAbuse || null;
    this.getOhSettingsEnabled = options.getOhSettingsEnabled || (() => true);
    this.getOllMode = options.getOllMode || (() => "full");
    this.onSetOllMode = options.onSetOllMode || null;
    this.getPllMode = options.getPllMode || (() => "full");
    this.onSetPllMode = options.onSetPllMode || null;
    this.getF2lMode = options.getF2lMode || (() => "basic");
    this.onSetF2lMode = options.onSetF2lMode || null;
    this.getSimSpeed = options.getSimSpeed || (() => 1);
    this.onSetSimSpeed = options.onSetSimSpeed || null;

    this.currentPuzzle = "222";
    this.currentTrackId = "cll";
    this.currentView = "grid"; // "grid" | "hybrid" | "detail" | "twosided" | "guide"
    this.activeGroupFilters = new Set(); // empty = All groups
    this.onlySelectedFilter = false;
    this.flippedEssentialIds = new Set();
    this.selectedCaseId = null;
    this.previewAlgId = null;
    this.activeDisplay3d = null;
    this.firstLayerExplorerState = createFirstLayerExplorerState();
    this._renderToken = 0;

    this._miniSetupCount = 0;
    this._miniAlgMoves = [];
    this._miniCombinedMoves = [];
    this._miniMoveCount = 0;
    this._miniIndexer = null;
    this._miniPendingSeek = false;
    this._miniLoadGen = 0;
    this._miniListenersEl = null;
    this._miniMountedPuzzle = null;
    this._twoSided3d = {
      observer: null,
      cards: new Map(),
      lru: [],
      gen: 0
    };
  }

  getCaseAlgs(track, c) {
    const baseAlgs = getEffectiveAlgsForCase(this.currentPuzzle, this.currentTrackId, c, {
      ohHand: this.getOhHand(),
      ohTableAbuse: this.getOhTableAbuse(),
      trackCases: track?.cases || []
    });
    const customAlgs = getCustomAlgsForCase(this.currentPuzzle, c.id);
    return customAlgs.length ? [...baseAlgs, ...customAlgs] : baseAlgs;
  }

  getPrefSubScope() {
    if (this.currentPuzzle !== "333oh") return null;
    const hand = this.getOhHand();
    return this.getOhTableAbuse() ? hand : `${hand}:no-table`;
  }

  getPreferredAlgObj(track, c) {
    const algs = this.getCaseAlgs(track, c);
    const defaultAlg = algs.find(a => a.isDefault) || algs[0];
    const prefId = getPreferredAlg(c.id, defaultAlg?.id, this.currentPuzzle, this.getPrefSubScope());
    return {
      algs,
      prefAlgId: prefId,
      preferredAlg: algs.find(a => a.id === prefId) || defaultAlg
    };
  }

  buildCaseQuickSimPayload(track, c, activeAlgId = null) {
    const { algs: resolvedAlgs, prefAlgId, preferredAlg } = this.getPreferredAlgObj(track, c);
    const fallbackAlg = c?.alg || c?.solutionAlg || '';
    const algs = resolvedAlgs.length > 0
      ? resolvedAlgs
      : (fallbackAlg ? [{ id: `${c.id}-default`, alg: fallbackAlg, note: '' }] : []);

    const needsZ2 = ["lbl", "cll", "ortega", "eg1", "eg2", "f2l", "oll", "pll", "coll", "cmll", "wv", "parity"].includes(this.currentTrackId);
    const displayId = formatCaseDisplayId(c.id);
    const distinctName = getDistinctCaseName(c);
    const baseTitle = `${displayId}${distinctName ? ` — ${distinctName}` : ''}`;
    const ohSuffix = this.currentPuzzle === '333oh'
      ? ` (${this.getOhHand() === 'right' ? 'Right OH' : 'Left OH'}${this.getOhTableAbuse() ? '' : ' · No Table'})`
      : '';

    const solutions = algs.map((a, idx) => {
      const baseSetup = a.mirroredSetup || c.setup || c.scramble || '';
      const rawSetupWithAuf = `${baseSetup}${a.startAuf ? ' ' + a.startAuf : ''}`.trim();
      const scramble = `${needsZ2 && rawSetupWithAuf && !/^z2\b/i.test(rawSetupWithAuf) ? 'z2 ' : ''}${rawSetupWithAuf}`.trim();
      const cleanMoves = cleanAlg(a.alg || '');
      const parsed = cleanMoves ? parseScrambleInput(cleanMoves) : { ok: false };
      const moveCount = parsed.ok
        ? parsed.moves.length
        : (cleanMoves ? cleanMoves.split(/\s+/).filter(Boolean).length : 0);
      const customLabel = this.getAlgCustomLabel ? this.getAlgCustomLabel(c, a) : '';
      const isPref = a.id === prefAlgId;
      const shortName = a.ohBadge
        || (customLabel ? customLabel.slice(0, 18) : (idx === 0 ? 'Primary' : `Alg ${idx + 1}`));
      const pillLabel = `${isPref ? '★ ' : ''}${shortName}${moveCount ? ` · ${moveCount}m` : ''}`;
      const note = [customLabel, a.note].filter(Boolean).join(' · ');

      return {
        label: `${baseTitle}${ohSuffix}`,
        shortLabel: shortName,
        pillLabel,
        moves: cleanMoves,
        moveCount,
        inspection: 'none',
        scramble,
        note,
        group: c.group || null,
        ohBadge: a.ohBadge || null,
        startAuf: a.startAuf || null,
        _algObj: a,
        _rawSetupWithAuf: rawSetupWithAuf
      };
    });

    const targetAlgId = activeAlgId || prefAlgId;
    let activeIndex = targetAlgId ? algs.findIndex(a => a.id === targetAlgId) : 0;
    if (activeIndex < 0) activeIndex = 0;

    return {
      puzzle: this.currentPuzzle,
      scramble: solutions[activeIndex]?.scramble || '',
      solutions,
      activeIndex,
      title: `${baseTitle}${ohSuffix}`,
      onOpenFullSim: this.onSimulateCase
        ? (_payload, activeSol) => {
            const chosenAlg = activeSol?._algObj || preferredAlg || algs[0];
            const setup = activeSol?._rawSetupWithAuf ?? '';
            this.onSimulateCase({ ...c, setup }, chosenAlg);
          }
        : null
    };
  }

  openCaseQuickSim(track, c, activeAlgId = null) {
    if (!c) return;
    const payload = this.buildCaseQuickSimPayload(track, c, activeAlgId);
    if (this.onQuickSimSolutions && payload.solutions.length > 0) {
      this.onQuickSimSolutions(payload);
      return;
    }
    if (this.onSimulateCase) {
      const targetSol = payload.solutions[payload.activeIndex] || payload.solutions[0];
      const algObj = targetSol?._algObj || this.getPreferredAlgObj(track, c).preferredAlg;
      const setup = targetSol?._rawSetupWithAuf || c.setup || '';
      this.onSimulateCase({ ...c, setup }, algObj);
    }
  }

  _teardownTwoSided3d() {
    if (!this._twoSided3d) return;
    this._twoSided3d.gen++;
    if (this._twoSided3d.observer) {
      try { this._twoSided3d.observer.disconnect(); } catch {}
      this._twoSided3d.observer = null;
    }
    for (const entry of this._twoSided3d.cards.values()) {
      if (entry?.displayEl) {
        try {
          entry.displayEl.player?.pause?.();
          entry.displayEl.remove?.();
        } catch {}
        entry.displayEl = null;
      }
      if (entry) entry.mountPromise = null;
    }
    this._twoSided3d.cards.clear();
    this._twoSided3d.lru = [];
  }

  _teardownMiniPlayer() {
    teardownFirstLayerExplorer3d();
    this._teardownTwoSided3d();
    this._miniLoadGen++;
    this._miniPendingSeek = false;
    this._miniIndexer = null;
    this._miniListenersEl = null;
    this._miniMountedPuzzle = null;
    this._miniSetupCount = 0;
    this._miniAlgMoves = [];
    this._miniCombinedMoves = [];
    this._miniMoveCount = 0;
    if (this.activeDisplay3d) {
      try {
        this.activeDisplay3d.player?.pause?.();
        this.activeDisplay3d.remove?.();
      } catch {}
      this.activeDisplay3d = null;
    }
  }

  /**
   * Tear down active 3D cube instances and cancel pending async renders when leaving Study mode.
   */
  deactivate() {
    this._renderToken++;
    this._teardownMiniPlayer();
  }

  syncPlaybackSpeed(spd) {
    const next = Number(spd);
    if (!Number.isFinite(next) || next <= 0) return;
    if (this.activeDisplay3d?.player) {
      try {
        this.activeDisplay3d.player.tempoScale = next;
      } catch {}
    }
    const speedBtn = this.container?.querySelector?.('#studyMiniSpeedBtn');
    if (speedBtn) {
      speedBtn.textContent = `${next}x`;
      speedBtn.setAttribute('aria-label', `Playback pace ${next}x`);
    }
    syncFirstLayerExplorerSpeed(next);
  }

  supportsTwoSidedView(puzzleId = this.currentPuzzle, track = getTrack(puzzleId, this.currentTrackId)) {
    if (!track) return false;
    if ((puzzleId === "333" || puzzleId === "333oh") && (track.id === "pll" || track.id === "oll")) {
      return true;
    }
    return puzzleId === "222" && track.id !== "face" && track.id !== "layer" && (track.cases || []).length > 0;
  }

  isF2lStudyTrack() {
    return (this.currentPuzzle === "333" || this.currentPuzzle === "333oh") && this.currentTrackId === "f2l";
  }

  getActiveF2lStudyMode() {
    if (!this.isF2lStudyTrack()) return null;
    return sanitizeF2lMode(this.getF2lMode?.());
  }

  getCaseById(track, caseId) {
    if (!caseId) return null;
    return track?.caseById?.get(caseId) || (this.isF2lStudyTrack() ? f2lExtendedById.get(caseId) : null) || null;
  }

  getActiveLlStudyMode() {
    if (this.currentPuzzle !== "333" && this.currentPuzzle !== "333oh") return null;
    if (this.currentTrackId === "oll") {
      return { kind: "oll", mode: this.getOllMode?.() === "2look" ? "2look" : "full" };
    }
    if (this.currentTrackId === "pll") {
      return { kind: "pll", mode: this.getPllMode?.() === "2look" ? "2look" : "full" };
    }
    return null;
  }

  getTrackOrderedGroups(track) {
    const f2lMode = this.getActiveF2lStudyMode();
    if (f2lMode === "intermediate") return F2L_INTERMEDIATE_GROUPS;
    if (f2lMode === "advanced") return F2L_ADVANCED_GROUPS;
    const llStudy = this.getActiveLlStudyMode();
    if (llStudy?.kind === "oll" && llStudy.mode === "2look") {
      return TWO_LOOK_OLL_GROUP_ORDER;
    }
    return track?.groups || [];
  }

  getTrackBaseCases(track) {
    const all = track?.cases || [];
    const f2lMode = this.getActiveF2lStudyMode();
    if (f2lMode === "essential") {
      return all.filter(c => ESSENTIAL_F2L_IDS.has(c.id));
    }
    if (f2lMode === "intermediate") {
      return f2lIntermediateCases;
    }
    if (f2lMode === "advanced") {
      return f2lAdvancedCases;
    }
    const llStudy = this.getActiveLlStudyMode();
    if (llStudy?.kind === "oll" && llStudy.mode === "2look") {
      return all
        .filter(c => TWO_LOOK_OLL_STUDY_IDS.has(c.id))
        .map(c => (TWO_LOOK_OLL_GROUP_OVERRIDES[c.id] ? { ...c, group: TWO_LOOK_OLL_GROUP_OVERRIDES[c.id] } : c));
    }
    if (llStudy?.kind === "pll" && llStudy.mode === "2look") {
      return all.filter(c => TWO_LOOK_PLL_STUDY_IDS.has(c.id));
    }
    return all;
  }

  getTrackSelectedCases(track) {
    const sel = this.getSelectedCaseIds ? this.getSelectedCaseIds() : new Set();
    if (!sel || sel.size === 0) return [];
    return this.getTrackBaseCases(track).filter(c => sel.has(c.id));
  }

  getFilteredCases(track) {
    let list = this.getTrackBaseCases(track);
    if (this.onlySelectedFilter) {
      const sel = this.getSelectedCaseIds ? this.getSelectedCaseIds() : new Set();
      if (sel && sel.size > 0) {
        list = list.filter(c => sel.has(c.id));
      }
    }
    if (this.activeGroupFilters.size > 0) {
      const availableGroups = new Set(list.map(c => c.group));
      const matchingGroups = [...this.activeGroupFilters].filter(g => availableGroups.has(g));
      if (matchingGroups.length > 0) {
        list = list.filter(c => this.activeGroupFilters.has(c.group));
      }
    }
    return list;
  }

  getNavigableCases(track) {
    const filtered = this.getFilteredCases(track);
    if (filtered.length > 0) return filtered;
    const selectedInTrack = this.getTrackSelectedCases(track);
    if (selectedInTrack.length > 0) return selectedInTrack;
    return this.getTrackBaseCases(track);
  }

  setTrack(puzzleId, trackId) {
    this.currentPuzzle = puzzleId;
    this.currentTrackId = trackId;
    this.activeGroupFilters.clear();
    this.flippedEssentialIds.clear();
    this.previewAlgId = null;
    const track = getTrack(puzzleId, trackId);
    if (track && track.cases.length > 0) {
      if (this.currentView === "guide" || (this.currentView === "twosided" && !this.supportsTwoSidedView(puzzleId, track))) {
        this.currentView = "grid";
      }
      const nav = this.getNavigableCases(track);
      this.selectedCaseId = (nav[0] || track.cases[0]).id;
    } else {
      this.selectedCaseId = null;
      this.currentView = "guide";
    }
    this.render();
  }

  setView(view, { keepSelected = false } = {}) {
    this.currentView = view === 'detail' ? 'hybrid' : view;
    if (this.currentView === 'hybrid') {
      const track = getTrack(this.currentPuzzle, this.currentTrackId);
      if (track) {
        const nav = this.getNavigableCases(track);
        const baseIds = new Set(this.getTrackBaseCases(track).map(c => c.id));
        const mirrorOk = this.getActiveF2lStudyMode() === 'essential' && Boolean(this.selectedCaseId && baseIds.has(getEssentialMirrorPartnerId(this.selectedCaseId)));
        const hasValidSelected = Boolean(this.selectedCaseId && (baseIds.has(this.selectedCaseId) || mirrorOk));
        if (!keepSelected && nav.length > 0 && (!hasValidSelected || !nav.some(c => c.id === this.selectedCaseId))) {
          this.selectedCaseId = nav[0].id;
          this.previewAlgId = null;
        } else if (!hasValidSelected && track.cases.length > 0) {
          this.selectedCaseId = (nav[0] || track.cases[0]).id;
          this.previewAlgId = null;
        }
      }
    }
    this.render();
  }

  render() {
    this._renderToken++;
    this._teardownMiniPlayer();
    if (!this.container) return;
    const track = getTrack(this.currentPuzzle, this.currentTrackId);
    if (!track) return;

    const activeView = this.currentView === 'detail' ? 'hybrid' : this.currentView;
    const is222FaceOrLayer = this.currentPuzzle === "222" && (this.currentTrackId === "face" || this.currentTrackId === "layer");
    const isOh = this.currentPuzzle === "333oh";
    const ohHand = this.getOhHand();
    const ohTableAbuse = this.getOhTableAbuse();
    const llStudy = this.getActiveLlStudyMode();
    const f2lMode = this.getActiveF2lStudyMode();
    const showOhControls = isOh && Boolean(this.getOhSettingsEnabled?.());
    const baseCases = this.getTrackBaseCases(track);

    this.container.innerHTML = `
      <div class="study-header">
        <div class="study-track-title-wrap">
          <h2 class="study-track-title">${track.name}</h2>
          <span class="study-track-desc">${track.description}</span>
        </div>
        ${(showOhControls || llStudy || f2lMode) ? `
          <div class="oh-controls-group">
            ${f2lMode ? `
              <div class="oh-hand-switcher study-ll-mode-switcher study-f2l-mode-switcher" role="group" aria-label="F2L Curriculum Level">
                <span class="oh-hand-label">F2L Level:</span>
                <button type="button" class="study-ll-mode-btn ${f2lMode === 'essential' ? 'active' : ''}" data-study-f2l-mode="essential" aria-pressed="${f2lMode === 'essential'}" data-tooltip="Show 21 core F2L shapes (the remaining 20 Basic cases are left/right mirrors)">Essential (21)</button>
                <button type="button" class="study-ll-mode-btn ${f2lMode === 'basic' ? 'active' : ''}" data-study-f2l-mode="basic" aria-pressed="${f2lMode === 'basic'}" data-tooltip="Show all 41 standard front-right &amp; mirror F2L cases">Basic (41)</button>
                <button type="button" class="study-ll-mode-btn ${f2lMode === 'intermediate' ? 'active' : ''}" data-study-f2l-mode="intermediate" aria-pressed="${f2lMode === 'intermediate'}" data-tooltip="Rotationless Back-Right (BR), Back-Left (BL), Left-Front (FL), and Keyhole F2L inserts">Intermediate (16)</button>
                <button type="button" class="study-ll-mode-btn ${f2lMode === 'advanced' ? 'active' : ''}" data-study-f2l-mode="advanced" aria-pressed="${f2lMode === 'advanced'}" data-tooltip="Multi-slot cross-slot swaps (piece in another slot &rarr; target slot) &amp; Force Yellow Cross edge control">Advanced (14)</button>
              </div>
            ` : ''}
            ${llStudy ? `
              <div class="oh-hand-switcher study-ll-mode-switcher" role="group" aria-label="${llStudy.kind === 'oll' ? 'OLL Case Set (Full vs 2-Look)' : 'PLL Case Set (Full vs 2-Look)'}">
                <span class="oh-hand-label">${llStudy.kind === 'oll' ? 'OLL Set:' : 'PLL Set:'}</span>
                <button type="button" class="study-ll-mode-btn ${llStudy.mode === 'full' ? 'active' : ''}" data-study-${llStudy.kind}-mode="full" aria-pressed="${llStudy.mode === 'full'}" data-tooltip="${llStudy.kind === 'oll' ? 'Show all 57 OLL cases (shared with Stats &amp; Settings)' : 'Show all 21 PLL cases (shared with Stats &amp; Settings)'}">${llStudy.kind === 'oll' ? 'Full OLL (57)' : 'Full PLL (21)'}</button>
                <button type="button" class="study-ll-mode-btn ${llStudy.mode === '2look' ? 'active' : ''}" data-study-${llStudy.kind}-mode="2look" aria-pressed="${llStudy.mode === '2look'}" data-tooltip="${llStudy.kind === 'oll' ? 'Show 10 essential 2-Look OLL cases (3 EO + 7 OCLL) — shared with Stats &amp; Settings' : 'Show 6 essential 2-Look PLL cases (2 Corner + 4 Edge) — shared with Stats &amp; Settings'}">${llStudy.kind === 'oll' ? '2-Look OLL (10)' : '2-Look PLL (6)'}</button>
              </div>
            ` : ''}
            ${showOhControls ? `
              <div class="oh-hand-switcher" role="group" aria-label="3x3 OH Solving Hand">
                <span class="oh-hand-label">Solving Hand<sup class="beta-sup" aria-label="Experimental">β</sup>:</span>
                <button type="button" class="oh-hand-btn ${ohHand === 'left' ? 'active' : ''}" data-oh-hand="left" aria-pressed="${ohHand === 'left'}" data-tooltip="Cube held in left hand (standard <R, U> algorithms)">&#x1F91A; Left Hand (RU)</button>
                <button type="button" class="oh-hand-btn ${ohHand === 'right' ? 'active' : ''}" data-oh-hand="right" aria-pressed="${ohHand === 'right'}" data-tooltip="Cube held in right hand (verified <L, U> mirrors & z' <U, L> variants)">&#x270B; Right Hand (Mirror / z')</button>
              </div>
              <div class="oh-hand-switcher" role="group" aria-label="3x3 OH Table Abuse Style">
                <span class="oh-hand-label">Style:</span>
                <button type="button" class="oh-table-btn ${ohTableAbuse ? 'active' : ''}" data-oh-table="table" aria-pressed="${ohTableAbuse}" data-tooltip="Allow table-assisted M/S/E slice moves (e.g. M2' U M2' U2 M2' U M2' H-Perm)">Table Abuse</button>
                <button type="button" class="oh-table-btn ${!ohTableAbuse ? 'active' : ''}" data-oh-table="no-table" aria-pressed="${!ohTableAbuse}" data-tooltip="In-air OH only: L, R, U with occasional F/D; zero M slices and B moves rewritten via x' + U">No Table Abuse</button>
              </div>
            ` : ''}
          </div>
        ` : ''}
        ${!is222FaceOrLayer ? `
          <div class="study-subnav" role="group" aria-label="Study view">
            ${track.cases.length > 0 ? `
              <button type="button" class="study-subnav-btn ${activeView === 'grid' ? 'active' : ''}" data-view="grid" data-tooltip="Browse all cases in a filterable visual card grid">📋 Case Grid (${baseCases.length})</button>
              <button type="button" class="study-subnav-btn ${activeView === 'hybrid' ? 'active' : ''}" data-view="hybrid" data-tooltip="Compact case sidebar alongside an interactive 3D flashcard & alternative algs">🧩 Grid + 3D</button>
            ` : ''}
            ${this.supportsTwoSidedView(this.currentPuzzle, track) ? `
              <button type="button" class="study-subnav-btn ${activeView === 'twosided' ? 'active' : ''}" data-view="twosided" data-tooltip="Inspect cases from a fixed Front + Right 3D angle without rotating">👀 2-Sided Recognition</button>
            ` : ''}
            <button type="button" class="study-subnav-btn ${activeView === 'guide' ? 'active' : ''}" data-view="guide" data-tooltip="Method fundamentals, overview tables, and training tips for this track">📖 Reference Guide</button>
          </div>
        ` : ''}
      </div>

      <div class="study-content">
        ${is222FaceOrLayer
          ? (this.currentTrackId === 'face'
              ? renderFirstFaceStudyHtml()
              : renderFirstLayerStudyHtml(this.firstLayerExplorerState, this.getSimSpeed ? this.getSimSpeed() : 1))
          : `
            ${activeView === 'grid' ? this.renderGridView(track) : ''}
            ${activeView === 'hybrid' ? this.renderHybridView(track) : ''}
            ${activeView === 'twosided' ? this.renderTwoSidedView(track) : ''}
            ${activeView === 'guide' ? this.renderGuideView(track) : ''}
          `}
      </div>
    `;

    this.bindEvents(track, is222FaceOrLayer);
  }

  renderGroupFilterBar(track) {
    const groups = this.getTrackOrderedGroups(track);
    const cases = this.getTrackBaseCases(track);
    const availableGroups = groups.filter(g => cases.some(c => c.group === g));
    const selectedInTrack = this.getTrackSelectedCases(track);
    const activeMatchingCount = [...this.activeGroupFilters].filter(g => availableGroups.includes(g)).length;
    const isAll = activeMatchingCount === 0;
    return `
      <div class="study-group-filter-bar ui-chip-group" role="group" aria-label="Filter cases by group (multi-select)">
        <span class="study-filter-label">Group:</span>
        <button type="button" class="study-group-pill ui-chip-reset ${isAll ? 'active' : ''}" data-group="all" aria-pressed="${isAll}">All (${cases.length})</button>
        <span class="ui-chip-divider" aria-hidden="true"></span>
        ${selectedInTrack.length > 0 && selectedInTrack.length < cases.length ? `
          <button type="button" class="study-group-pill ui-filter-chip study-selected-pill ${this.onlySelectedFilter ? 'active' : ''}" data-only-selected="1" aria-pressed="${this.onlySelectedFilter}" data-tooltip="Show only cases selected in Active Cases"><span class="ui-chip-check" aria-hidden="true"></span><span>★ Selected (${selectedInTrack.length})</span></button>
        ` : ''}
        ${availableGroups.map(g => {
          const count = cases.filter(c => c.group === g).length;
          const active = this.activeGroupFilters.has(g);
          return `<button type="button" class="study-group-pill ui-filter-chip ${active ? 'active' : ''}" data-group="${g}" aria-pressed="${active}"><span class="ui-chip-check" aria-hidden="true"></span><span>${g} (${count})</span></button>`;
        }).join('')}
      </div>
    `;
  }

  getGroupedSections(track) {
    const filtered = this.getFilteredCases(track);
    const orderedGroups = [...this.getTrackOrderedGroups(track)];
    for (const c of filtered) {
      if (c.group && !orderedGroups.includes(c.group)) orderedGroups.push(c.group);
    }
    const sections = [];
    for (const g of orderedGroups) {
      const items = filtered.filter(c => c.group === g);
      if (items.length > 0) sections.push({ group: g, cases: items });
    }
    if (sections.length === 0 && filtered.length > 0) {
      sections.push({ group: "All", cases: filtered });
    }
    return sections;
  }

  renderGridView(track) {
    const sections = this.getGroupedSections(track);
    const showGroupHeaders = sections.length > 1;
    const f2lMode = this.getActiveF2lStudyMode();
    const use3dF2lCards = this.isF2lStudyTrack();
    const whiteBottom = true;

    const f2lBannerHtml = f2lMode === "essential"
      ? `<div class="study-f2l-tier-note" role="note"><strong>Essential 21 F2L:</strong> Master these 21 foundational shapes first &mdash; click <strong>⇄ Flip</strong> on any card to view its mirrored left/right case from <strong>Basic (41)</strong>.</div>`
      : f2lMode === "intermediate"
        ? `<div class="study-f2l-tier-note" role="note"><strong>Intermediate 16 F2L:</strong> Rotationless Back-Right (BR), Back-Left (BL), Left-Front (FL), and Keyhole inserts &mdash; drag any 3D cube or click ↻ to reset its slot angle.</div>`
        : f2lMode === "advanced"
          ? `<div class="study-f2l-tier-note" role="note"><strong>Advanced 14 F2L:</strong> Multi-slot techniques where a piece sits in another slot (BR/FL/BL &rarr; target slot), plus Sledge/Wide inserts to force a Yellow Cross before OLL.</div>`
          : '';

    const renderCard = (baseCase) => {
      const mirrorId = f2lMode === "essential" ? (ESSENTIAL_F2L_MIRROR_MAP[baseCase.id] || null) : null;
      const isFlipped = Boolean(mirrorId && this.flippedEssentialIds.has(baseCase.id));
      const c = (isFlipped ? track.caseById?.get(mirrorId) : null) || baseCase;
      const { algs, preferredAlg: activeAlg } = this.getPreferredAlgObj(track, c);
      const displayId = formatCaseDisplayId(c.id);
      const distinctName = getDistinctCaseName(c);
      const customLabel = activeAlg && this.getAlgCustomLabel ? this.getAlgCustomLabel(c, activeAlg) : "";
      const noteText = customLabel || activeAlg?.note || "";
      const oppBadge = c.opposite
        ? ` <span class="study-card-opp" data-tooltip="Opposite / inverse CLL case: ${escapeHtml(c.opposite)}">(Opp ${escapeHtml(c.opposite)})</span>`
        : '';

      const rawSetup = activeAlg?.mirroredSetup || c.setup || c.scramble || "";
      const setupStr = (whiteBottom && rawSetup && !/^z2\b/i.test(rawSetup) ? `z2 ${rawSetup}` : rawSetup).trim();
      const camLng = Number.isFinite(c.cameraLongitude) ? c.cameraLongitude : 30;
      const visualHtml = use3dF2lCards
        ? `<div class="twosided-card-3d-wrap study-f2l-card-3d" data-twosided-case-id="${escapeHtml(c.id)}" data-twosided-setup="${escapeHtml(setupStr)}" data-camera-longitude="${camLng}"><span class="study-visual-loading">Loading 3D...</span></div>`
        : `<div class="study-card-visual" id="studyCardVisual_${c.id}" data-case-id="${c.id}"><span class="study-visual-loading">Loading diagram...</span></div>`;

      return `
        <div class="study-card ${this.selectedCaseId === c.id ? 'selected' : ''}" data-case-id="${c.id}">
          <div class="study-card-head">
            <span class="study-card-id">${displayId}${oppBadge}</span>
            <div class="study-card-head-meta">
              ${isFlipped ? '<span class="study-card-mirror-pill" data-tooltip="Viewing mirrored left/right counterpart">Mirrored</span>' : ''}
              ${activeAlg?.ohBadge ? `<span class="oh-alg-badge">${escapeHtml(activeAlg.ohBadge)}</span>` : ''}
              ${algs.length > 1 ? `<span class="study-card-algs-pill" data-tooltip="${algs.length} algorithm variants available">${algs.length} algs</span>` : ''}
              ${!activeAlg?.ohBadge && !showGroupHeaders ? `<span class="study-card-group">${escapeHtml(c.group)}</span>` : ''}
            </div>
          </div>
          ${visualHtml}
          ${distinctName ? `<div class="study-card-name" data-tooltip="${escapeHtml(distinctName)}">${escapeHtml(distinctName)}</div>` : ''}
          <div class="study-card-alg-box">
            <div class="study-card-alg-primary">${activeAlg ? escapeHtml(activeAlg.alg) : 'No alg'}</div>
            ${noteText ? `<div class="study-card-alg-note" data-tooltip="${escapeHtml(noteText)}">${escapeHtml(noteText)}</div>` : ''}
          </div>

          <div class="study-card-actions">
            ${use3dF2lCards ? `<button type="button" class="btn btn-xs btn-icon-only btn-twosided-reset-3d" data-twosided-case-id="${escapeHtml(c.id)}" data-tooltip="Reset 3D angle" aria-label="Reset 3D angle for ${escapeHtml(displayId)}">${ICON_RESET_ANGLE}</button>` : ''}
            ${mirrorId ? `<button type="button" class="btn btn-xs btn-f2l-flip ${isFlipped ? 'active' : ''}" data-essential-base-id="${escapeHtml(baseCase.id)}" data-tooltip="Flip between ${escapeHtml(formatCaseDisplayId(baseCase.id))} and its mirror (${escapeHtml(formatCaseDisplayId(mirrorId))})" aria-label="Flip between ${escapeHtml(baseCase.id)} and ${escapeHtml(mirrorId)}" aria-pressed="${isFlipped}">⇄ Flip</button>` : ''}
            <button type="button" class="btn btn-xs btn-study-view" data-case-id="${c.id}" data-tooltip="Open Grid + 3D to compare all algorithms, starting angles &amp; labels" aria-label="View algorithms for ${escapeHtml(displayId)}">${ICON_DIAGRAM}<span>Algs</span></button>
            <button type="button" class="btn btn-xs btn-study-sim" data-case-id="${c.id}" data-tooltip="Simulate in an interactive 3D popup (switch across all ${algs.length} alg variant${algs.length === 1 ? '' : 's'})" aria-label="Simulate ${escapeHtml(displayId)} in 3D popup">${ICON_POPUP_SIM}<span>Sim</span></button>
          </div>
        </div>
      `;
    };

    return `
      <div class="study-grid-wrap">
        ${this.renderGroupFilterBar(track)}
        ${f2lBannerHtml}
        ${sections.length === 0
          ? `<p class="empty-state" style="padding: 20px;">No cases match the active filter.</p>`
          : `<div class="study-groups-flow ${showGroupHeaders ? 'is-grouped' : 'is-flat'}">
              ${sections.map(sec => `
                <div class="study-group-section" style="--group-count: ${sec.cases.length}">
                  ${showGroupHeaders ? `<div class="study-group-section-title">${sec.group} <span class="study-group-section-count">(${sec.cases.length})</span></div>` : ''}
                  <div class="study-case-grid">
                    ${sec.cases.map(renderCard).join('')}
                  </div>
                </div>
              `).join('')}
            </div>`}
      </div>
    `;
  }

  renderHybridView(track) {
    const sections = this.getGroupedSections(track);
    const isSingleGroup = sections.length === 1;
    const showGroupHeaders = sections.length > 1;
    const navCases = this.getNavigableCases(track);
    const navIds = new Set(navCases.map(nc => nc.id));
    const isMirrorInNav = this.getActiveF2lStudyMode() === 'essential' && Boolean(this.selectedCaseId && navIds.has(getEssentialMirrorPartnerId(this.selectedCaseId)));
    if (navCases.length > 0 && !navIds.has(this.selectedCaseId) && !isMirrorInNav) {
      this.selectedCaseId = navCases[0].id;
      this.previewAlgId = null;
    }

    const renderHybridCard = (c) => {
      const displayId = formatCaseDisplayId(c.id);
      const isSelected = this.selectedCaseId === c.id;
      const inPool = this.getTrackSelectedCases(track).some(sc => sc.id === c.id);
      const oppBadge = isSingleGroup && c.opposite
        ? ` <span class="study-card-opp">(Opp ${escapeHtml(c.opposite)})</span>`
        : '';
      return `
        <button type="button" class="study-hybrid-card ${isSelected ? 'selected' : ''} ${inPool ? 'in-pool' : ''}" data-case-id="${c.id}" aria-selected="${isSelected}" data-tooltip="${escapeHtml(c.name || displayId)}${c.opposite ? ` · Opp ${escapeHtml(c.opposite)}` : ''}">
          <span class="study-hybrid-card-id">${displayId}${oppBadge}</span>
          <span class="study-card-visual study-hybrid-visual" data-case-id="${c.id}">
            <span class="study-visual-loading">...</span>
          </span>
        </button>
      `;
    };

    return `
      <div class="study-hybrid-wrap">
        ${this.renderGroupFilterBar(track)}
        <div class="study-hybrid-layout ${isSingleGroup ? 'is-single-group' : ''}">
          <div class="study-hybrid-grid-pane ${isSingleGroup ? 'is-single-group' : 'is-grouped'}" role="listbox" aria-label="Cases">
            ${sections.length === 0
              ? `<p class="empty-state" style="padding: 18px;">No cases match the active filter.</p>`
              : sections.map(sec => `
                  <div class="study-hybrid-group-section">
                    ${showGroupHeaders ? `<div class="study-hybrid-group-label">${sec.group} (${sec.cases.length})</div>` : ''}
                    <div class="study-hybrid-grid ${isSingleGroup ? 'is-single-group' : ''}">
                      ${sec.cases.map(renderHybridCard).join('')}
                    </div>
                  </div>
                `).join('')}
          </div>
          <div class="study-hybrid-detail-pane">
            ${this.renderDetailView(track)}
          </div>
        </div>
      </div>
    `;
  }

  renderDetailView(track) {
    const baseCases = this.getTrackBaseCases(track);
    const navCases = this.getNavigableCases(track);
    const c = (this.selectedCaseId ? baseCases.find(bc => bc.id === this.selectedCaseId) : null)
      || this.getCaseById(track, this.selectedCaseId)
      || navCases[0]
      || baseCases[0]
      || track.cases[0];
    if (!c) return `<p class="empty-state">No case selected</p>`;
    const isF2lTrack = this.isF2lStudyTrack();
    const f2lMode = this.getActiveF2lStudyMode();
    const mirrorPartnerId = f2lMode === "essential" ? getEssentialMirrorPartnerId(c.id) : null;
    const isFlippedMirror = Boolean(mirrorPartnerId && !ESSENTIAL_F2L_IDS.has(c.id));
    const isPracticeableCase = Boolean(track.caseById.has(c.id));

    const navIdx = navCases.findIndex(nc => nc.id === c.id);
    const navCountText = navCases.length > 0
      ? `${navIdx >= 0 ? navIdx + 1 : 1} / ${navCases.length}`
      : '';

    const { algs, prefAlgId, preferredAlg } = this.getPreferredAlgObj(track, c);
    const activePreviewAlg = algs.find(a => a.id === this.previewAlgId) || preferredAlg || algs[0];
    const displayId = formatCaseDisplayId(c.id);
    const distinctName = getDistinctCaseName(c);
    const formatAufBadge = (auf) => {
      if (!auf) return "Start: Standard";
      return `Start: ${auf}`;
    };

    const currentSpeed = Number(this.getSimSpeed ? this.getSimSpeed() : 1) || 1;
    return `
      <div class="study-detail-view">
        <div class="study-detail-card">
          <div class="study-detail-header">
            <div class="study-detail-title-group">
              <span class="study-detail-id">${displayId}</span>
              ${isFlippedMirror ? '<span class="study-card-mirror-pill">Mirrored</span>' : ''}
              ${c.opposite ? `<span class="study-detail-opp" data-tooltip="Opposite / inverse CLL case: ${escapeHtml(c.opposite)}">(Opp ${escapeHtml(c.opposite)})</span>` : ''}
              ${distinctName ? `<h3 class="study-detail-name">${distinctName}</h3>` : ''}
              <span class="study-detail-group">${c.group}</span>
            </div>
            <div class="study-detail-nav-btns">
              ${mirrorPartnerId ? `<button type="button" id="studyFlipMirrorBtn" class="btn btn-xs btn-f2l-flip ${isFlippedMirror ? 'active' : ''}" data-mirror-partner-id="${escapeHtml(mirrorPartnerId)}" data-tooltip="Flip to mirrored counterpart (${escapeHtml(formatCaseDisplayId(mirrorPartnerId))})" aria-pressed="${isFlippedMirror}">⇄ Flip Mirror</button>` : ''}
              <button type="button" id="studyPrevCaseBtn" class="btn btn-xs">&larr; Prev</button>
              ${navCountText ? `<span class="study-nav-count" data-tooltip="Cycling through selected/filtered cases">${navCountText}</span>` : ''}
              <button type="button" id="studyNextCaseBtn" class="btn btn-xs">Next &rarr;</button>
            </div>
          </div>

          <div class="study-detail-grid">
            <div class="study-visual-box">
              <div class="study-visual-top-strip">
                ${isF2lTrack ? '' : `<div class="study-visual-diagram" id="studyDetailDiagram">
                  <span class="study-visual-loading">Loading diagram...</span>
                </div>`}
                <div class="study-start-angle-meta" id="studyStartAngleMeta">
                  <span class="study-auf-pill ${activePreviewAlg?.startAuf ? 'has-auf' : ''}">${formatAufBadge(activePreviewAlg?.startAuf)}</span>
                  <span class="study-auf-alg">${activePreviewAlg ? activePreviewAlg.alg : ''}</span>
                </div>
              </div>
              <div class="study-visual-3d-wrap" id="studyDetail3dWrap">
                <span class="study-visual-loading" style="display:flex;height:100%;align-items:center;justify-content:center;">Loading 3D...</span>
              </div>
              <div class="study-mini-sim-bar" role="group" aria-label="Inline 3D algorithm playback">
                <button type="button" class="btn btn-xs btn-icon-only study-mini-btn" id="studyMiniStartBtn" data-tooltip="Jump to case start" aria-label="Jump to case start">${ICON_SKIP_START}</button>
                <button type="button" class="btn btn-xs btn-icon-only study-mini-btn" id="studyMiniPrevBtn" data-tooltip="Step back 1 move" aria-label="Step back 1 move">${ICON_STEP_BACK}</button>
                <button type="button" class="btn btn-xs btn-icon-only btn-primary study-mini-play-btn" id="studyMiniPlayBtn" data-play-state="play" data-tooltip="Play / Pause algorithm" aria-label="Play algorithm">${ICON_PLAY}</button>
                <button type="button" class="btn btn-xs btn-icon-only study-mini-btn" id="studyMiniNextBtn" data-tooltip="Step forward 1 move" aria-label="Step forward 1 move">${ICON_STEP_FORWARD}</button>
                <button type="button" class="btn btn-xs btn-icon-only study-mini-btn" id="studyMiniEndBtn" data-tooltip="Jump to solved end" aria-label="Jump to solved end">${ICON_SKIP_END}</button>
                <button type="button" class="btn btn-xs study-mini-speed-btn" id="studyMiniSpeedBtn" data-tooltip="Cycle 3D playback pace (site-wide)" aria-label="Playback pace ${currentSpeed}x">${currentSpeed}x</button>
              </div>
              <div class="study-mini-step-status" id="studyMiniStepStatus" aria-live="polite">Ready</div>
              <div class="study-visual-3d-controls">
                <button type="button" class="btn btn-xs" id="studyReset3dBtn" data-tooltip="Reset 3D camera orientation" aria-label="Reset 3D camera orientation">${ICON_RESET_ANGLE}<span>Reset 3D</span></button>
                <button type="button" class="btn btn-xs btn-primary" id="studySimulateThisBtn" data-case-id="${c.id}" data-tooltip="Open interactive 3D popup simulator with clickable move timeline &amp; variant switcher">${ICON_POPUP_SIM}<span>Popup Sim</span></button>
              </div>
            </div>

            <div class="study-detail-body">
              ${c.description ? `<p class="study-detail-desc">${c.description}</p>` : ''}

              <div class="study-algs-section">
                <h4 class="study-section-title">Algorithms &amp; Fingertricks (${algs.length}) <small class="study-alg-hint">Click any option to preview its starting angle</small></h4>
                <div class="study-alg-list">
                  ${algs.map(a => {
                    const isPref = a.id === prefAlgId;
                    const isPreview = activePreviewAlg && a.id === activePreviewAlg.id;
                    const aufText = a.startAuf ? `Start: ${a.startAuf}` : 'Start: Standard';
                    const customLabel = this.getAlgCustomLabel ? this.getAlgCustomLabel(c, a) : "";
                    return `
                      <div class="study-alg-row ${isPref ? 'preferred' : ''} ${isPreview ? 'previewing' : ''}" data-case-id="${c.id}" data-alg-id="${a.id}" role="button" tabindex="0" data-tooltip="Click to preview this algorithm's starting top-layer angle">
                        <button type="button" class="study-star-btn ${isPref ? 'starred' : ''}" data-case-id="${c.id}" data-alg-id="${a.id}" data-tooltip="${isPref ? 'Preferred algorithm' : 'Set as preferred algorithm'}" aria-label="${isPref ? 'Preferred algorithm' : 'Set as preferred algorithm'}">
                          ${isPref ? '★' : '☆'}
                        </button>
                        <div class="study-alg-info">
                          <span class="study-alg-text">${escapeHtml(a.alg)}</span>
                          <div class="study-alg-meta-row">
                            <span class="study-auf-badge ${a.startAuf ? 'has-auf' : ''}">${aufText}</span>
                            ${a.isCustom ? '<span class="study-custom-alg-badge" data-tooltip="Verified against KPuzzle simulation">Custom ✓</span>' : ''}
                            ${a.ohBadge ? `<span class="oh-alg-badge">${escapeHtml(a.ohBadge)}</span>` : ''}
                            ${customLabel ? `<span class="study-alg-custom-label" data-tooltip="Custom label">${escapeHtml(customLabel)}</span>` : ''}
                            ${a.note ? `<span class="study-alg-note">${escapeHtml(a.note)}</span>` : ''}
                          </div>
                        </div>
                        <div class="study-alg-actions">
                          ${this.onEditLabel ? `<button type="button" class="btn btn-xs btn-alg-label" data-case-id="${c.id}" data-alg-id="${a.id}" data-tooltip="Customize trigger or memory label">Label</button>` : ''}
                          <button type="button" class="btn btn-xs btn-alg-sim" data-case-id="${c.id}" data-alg-id="${a.id}" data-alg="${escapeHtml(a.alg)}" data-tooltip="Simulate this algorithm in the 3D popup" aria-label="Simulate algorithm ${escapeHtml(a.alg)} in 3D popup">${ICON_POPUP_SIM}<span>Sim</span></button>
                          ${a.isCustom ? `<button type="button" class="btn btn-xs study-custom-alg-del-btn" data-case-id="${c.id}" data-alg-id="${a.id}" data-tooltip="Remove this custom algorithm" aria-label="Delete custom algorithm">&times;</button>` : ''}
                        </div>
                      </div>
                    `;
                  }).join('')}
                </div>

                <div class="study-custom-alg-form" data-case-id="${c.id}">
                  <div class="study-custom-alg-form-row">
                    <input type="text" id="studyCustomAlgInput" class="study-custom-alg-input" placeholder="Add your own alg (e.g. R U R' U' ...)" aria-label="Custom algorithm moves" />
                    <input type="text" id="studyCustomAlgNoteInput" class="study-custom-alg-note-input" placeholder="Trigger / note (optional)" aria-label="Algorithm trigger or note" />
                    <button type="button" id="studyAddCustomAlgBtn" class="btn btn-xs btn-primary" data-case-id="${c.id}">Verify &amp; Add</button>
                  </div>
                  <div id="studyCustomAlgFeedback" class="study-custom-alg-feedback ${this.customAlgNotice?.caseId === c.id ? (this.customAlgNotice.ok ? 'ok' : 'err') : ''}" ${this.customAlgNotice?.caseId === c.id ? '' : 'hidden'}>${this.customAlgNotice?.caseId === c.id ? escapeHtml(this.customAlgNotice.msg) : ''}</div>
                </div>
              </div>

              ${isPracticeableCase ? `<div class="study-detail-footer">
                <button type="button" id="studyPracticeThisBtn" class="btn btn-primary btn-small" data-case-id="${c.id}">
                  Practice this case &rarr;
                </button>
              </div>` : ''}
            </div>
          </div>
        </div>
      </div>
    `;
  }

  renderGuideView(track) {
    if (this.currentPuzzle === "333bf") {
      return render3BldGuideHtml();
    }

    if ((this.currentPuzzle === "333" || this.currentPuzzle === "333oh") && this.currentTrackId === "cross") {
      return `
        <div class="guide-card-stack">
          <section class="guide-card">
            <h3 class="guide-card-title">⏱️ 1. WCA 15-Second Inspection for Cross</h3>
            <p>World-class 3x3 cubers solve the entire White Cross during inspection without pausing:</p>
            <ol class="guide-list guide-steps">
              <li><strong>0 – 3s (Locate Cross Edges):</strong> Find all 4 white edges (DF, DR, DB, DL). Check their orientations.</li>
              <li><strong>3 – 8s (Plan the Sequence):</strong> Trace your 4-6 moves. Look for opportunities to insert multiple edges with a single move.</li>
              <li><strong>8 – 12s (Cross+1 / First Pair):</strong> Track your first F2L corner-edge pair. Know where it will land after the cross moves.</li>
              <li><strong>12 – 15s (Fingertricks):</strong> Grip the cube and start executing blind with maximum turn speed!</li>
            </ol>
          </section>

          <section class="guide-card">
            <h3 class="guide-card-title">🧭 2. Edge Orientation (EO) Principles</h3>
            <p>An edge is <strong>oriented (good)</strong> if it can be solved into its position using only <code>R, U, L, D</code> moves without requiring <code>F, B</code> turns or cube rotations.</p>
            <ul class="guide-list">
              <li><strong>Top/Bottom edges:</strong> Yellow or White facing U/D = Good.</li>
              <li><strong>Front/Back edges:</strong> Green/Blue facing F/B = Good.</li>
              <li>Solving cross edges while preserving good EO on the remaining edges gives easy, rotationless F2L pairs!</li>
            </ul>
          </section>

          <section class="guide-card">
            <h3 class="guide-card-title">⚡ 3. Cross+1 (First Pair Preservation)</h3>
            <p>Instead of finishing the cross and stopping to search for pairs, plan your first F2L pair during inspection:</p>
            <ul class="guide-list">
              <li><strong>Free Pair in Slot:</strong> Cross moves naturally drop a solved F2L pair into its slot.</li>
              <li><strong>Connected Pair in U:</strong> Cross moves pair a corner and edge in the top layer for an instant 3-move insert.</li>
              <li><strong>Keyhole Technique:</strong> Insert an F2L corner or edge before making your final D-alignment move.</li>
            </ul>
          </section>
        </div>
      `;
    }

    if (this.currentPuzzle === "222") {
      const caseCount = (track.cases || []).length;
      const groupCount = (track.groups || []).length;
      let introCard = '';
      if (this.currentTrackId === "lbl") {
        introCard = `
          <section class="guide-card guide-card-full">
            <h3 class="guide-card-title">&#x1F331; Beginner 2x2 LBL Method (1st Layer + 7 OLL + 2 PLL)</h3>
            <p>The clearest path from beginner 2x2 to sub-6s solves in just <strong>9 intuitive last-layer algorithms</strong>:</p>
            <ol class="guide-list guide-steps">
              <li><strong>1st Layer:</strong> Solve one complete color face <em>with matching side colors</em> (use the <strong>1st Layer</strong> tab to learn fast inserts).</li>
              <li><strong>OLL (7 cases):</strong> Orient all 4 top corners yellow using the 7 Cross-OLLs (Sune, Antisune, H, Pi, U, T, L).</li>
              <li><strong>2-Case PLL (Adj T/J-Perm + Diag Y-Perm):</strong> Look for one matching top-layer bar &rarr; put it on Left and run <strong>T-Perm</strong> or <strong>Jb-Perm</strong>. If no bar exists &rarr; run <strong>Y-Perm</strong> from any angle!</li>
            </ol>
          </section>
        `;
      } else if (this.currentTrackId === "ortega") {
        introCard = `
          <section class="guide-card guide-card-full">
            <h3 class="guide-card-title">&#x26A1; Ortega Method Overview (3 Steps)</h3>
            <p>The <strong>Ortega (Varasano) Method</strong> solves the 2x2 in three fast steps without needing a complete permuted first layer:</p>
            <ol class="guide-list guide-steps">
              <li><strong>1st Face:</strong> Solve any color face (typically in 2&ndash;4 moves) ignoring side permutation.</li>
              <li><strong>OLL:</strong> Orient the opposite face using one of 7 fast OLL cases.</li>
              <li><strong>PBL (Permute Both Layers):</strong> Finish both layers simultaneously using one of the <strong>5 PBL algorithms</strong> (Adj/Adj, Opp/Opp, Adj/Opp, Adj/Solved, Opp/Solved). Use the <strong>Case Grid</strong> or <strong>Grid + 3D</strong> view to star favorite algorithms (★) and customize trigger labels.</li>
            </ol>
          </section>
        `;
      } else if (this.currentTrackId === "eg1") {
        introCard = `
          <section class="guide-card guide-card-full">
            <h3 class="guide-card-title">&#x1F525; EG-1 Overview (${caseCount} Cases &middot; Adjacent Bottom Bar)</h3>
            <p><strong>EG-1</strong> solves the entire rest of the 2x2 in <strong>1 look</strong> after building an adjacent-swapped 1st Face (1 bar on bottom):</p>
            <ul class="guide-list">
              <li><strong>Hold the solved Bottom Bar in Back (DBL+DBR)</strong> so the two swapped bottom corners sit in front (DFL&harr;DFR).</li>
              <li>Each card matches its <strong>CLL counterpart shape</strong> (<code>H, P, U, T, L, S, A</code>) with the <code>D: BAR</code> indicator below the diagram.</li>
              <li>Notice how spotting a 2- or 3-move Adj Bar face in inspection flows straight into 1-look EG-1!</li>
            </ul>
          </section>
        `;
      } else if (this.currentTrackId === "eg2") {
        introCard = `
          <section class="guide-card guide-card-full">
            <h3 class="guide-card-title">&#x26A1; EG-2 Overview (${caseCount} Cases &middot; Diagonal Bottom Swap)</h3>
            <p><strong>EG-2</strong> finishes the cube in <strong>1 look</strong> when your 1st Face has a <strong>diagonal swap</strong> (no bars on D):</p>
            <ul class="guide-list">
              <li>Top-layer recognition mirrors <strong>CLL</strong>, marked with <code>D: DIAG</code> below each card.</li>
              <li><strong>Anti-CLL Trick:</strong> Every EG-2 case also includes an <code>Anti-CLL (CLL + R2 F2 R2)</code> variant alongside faster direct <code>&lt;R, U, F&gt;</code> EG-2 triggers, letting you start solving EG-2 immediately using CLL knowledge!</li>
            </ul>
          </section>
        `;
      } else if (this.currentTrackId === "cll") {
        introCard = `
          <section class="guide-card guide-card-full">
            <h3 class="guide-card-title">&#x1F9E9; CLL Overview (${caseCount} Cases &middot; ${groupCount} Groups)</h3>
            <p><strong>Corners of Last Layer (CLL)</strong> solves the entire top layer in a single algorithm after building a complete 1st layer:</p>
            <ul class="guide-list">
              <li>Cases are organized into <strong>${groupCount} OLL-shape groups</strong> (${(track.groups || []).map(g => g.replace(/-Group$/, '')).join(', ')}).</li>
              <li>Use <strong>Grid + 3D</strong> to inspect each starting AUF angle, ★ your preferred algorithm, or attach custom trigger/memory labels on any row.</li>
              <li>Combine CLL recognition with <strong>1st Layer Inspection</strong> training to work toward full 1-look 2x2 solves.</li>
            </ul>
          </section>
        `;
      } else {
        introCard = `
          <section class="guide-card guide-card-full">
            <h3 class="guide-card-title">&#x23F1;&#xFE0F; 2x2 1st Face (Ortega) &amp; 1st Layer (CLL) Fundamentals</h3>
            <p>With full color neutrality, most 2x2 scrambles have a <strong>1st Face (Ortega)</strong> in <strong>4 moves or fewer</strong>, whereas a complete <strong>1st Layer (CLL)</strong> requires matching corner permutation as well.</p>
          </section>
        `;
      }

      return `
        <div class="guide-card-stack">
          ${introCard}
          <div class="guide-grid">
            <section class="guide-card">
              <h3 class="guide-card-title">&#x1F3AF; 1. Move Count Benchmarks</h3>
              <p>On a 2x2, corner permutations and orientations have far fewer states than 3x3:</p>
              <ul class="guide-list">
                <li><strong>1st Face (Ortega):</strong> 99.8% of all scrambles can be solved in <strong>&le; 4 moves</strong> (average optimal: 3.1 moves).</li>
                <li><strong>1st Layer (CLL/LBL):</strong> 95.4% of all scrambles can be solved in <strong>&le; 5 moves</strong> (average optimal: 3.8 moves).</li>
                <li><em>Rule of thumb:</em> If your planned layer takes 6 or more moves, there is almost certainly a 2- or 3-move solution on another face!</li>
              </ul>
            </section>

            <section class="guide-card">
              <h3 class="guide-card-title">&#x1F308; 2. Full Color Neutrality (CN)</h3>
              <p>Unlike 3x3 where centers are fixed and cross planning across 6 colors takes months, 2x2 has <strong>no fixed centers</strong>:</p>
              <ul class="guide-list">
                <li>Every face can be built around whichever corner is already oriented or paired.</li>
                <li>Being color neutral means you check 6 colors. On average, at least one color already has a pre-formed 2-piece bar!</li>
                <li>Start by practicing Opposite Neutrality (White + Yellow), then expand to All 6 faces.</li>
              </ul>
            </section>

            <section class="guide-card">
              <h3 class="guide-card-title">&#x23F1;&#xFE0F; 3. 15-Second WCA Inspection Routine</h3>
              <p>In 2x2, world-class cubers plan the <em>entire 1st layer</em> before making their first move:</p>
              <ol class="guide-list guide-steps">
                <li><strong>0 &ndash; 3s (Scan):</strong> Rotate the cube quickly. Look for already-made 2-corner bars or matching colors on any side.</li>
                <li><strong>3 &ndash; 8s (Select &amp; Trace):</strong> Pick the face with the shortest move count. Locate the remaining 2 corners.</li>
                <li><strong>8 &ndash; 12s (Rehearse Blind):</strong> Visualize every turn in your head. Know where the pieces will land.</li>
                <li><strong>12 &ndash; 15s (Grip):</strong> Place the cube down, set your fingers on your starting grip, and start the timer ready to execute with zero pauses!</li>
              </ol>
            </section>

            <section class="guide-card">
              <h3 class="guide-card-title">&#x1F6E0;&#xFE0F; 4. Bar Preservation vs. Direct Insertion</h3>
              <p>Never break an existing 2-piece bar unless it saves moves overall:</p>
              <ul class="guide-list">
                <li><strong>Direct Insertion:</strong> If an isolated corner has its sticker facing the side, use a 3-move trigger like <code>R U R'</code> or <code>F' U' F</code>.</li>
                <li><strong>Sledgehammer (<code>R' F R F'</code>):</strong> When a corner has its target color facing up or needs reorientation, a sledgehammer can insert it while preserving bottom pieces and often orienting top corners!</li>
                <li><strong>Keyhole Technique:</strong> Leave one corner unsolved while you quickly orient the other three, then insert the last corner with a quick trigger.</li>
              </ul>
            </section>

            <section class="guide-card">
              <h3 class="guide-card-title">&#x26A1; 5. Face vs. Layer (The Ortega Transition)</h3>
              <p>When solving under time pressure:</p>
              <ul class="guide-list">
                <li>If building a complete layer requires awkward rotations or &ge; 5 moves, build a <strong>Face</strong> instead (takes 2&ndash;3 moves)!</li>
                <li>Orient the top with OLL (or any CLL alg), then finish with one of the <strong>5 Ortega PBL algorithms</strong>.</li>
                <li>Once comfortable with Ortega, use the 1st Layer Solver in this app to analyze optimal layer solutions and bridge to 1-look CLL.</li>
              </ul>
            </section>
          </div>
        </div>
      `;
    }

    if (this.currentPuzzle === "444" && this.currentTrackId === "methods") {
      return `
        <div class="guide-card-stack">
          <section class="guide-card guide-card-full">
            <h3 class="guide-card-title">&#x1F9E9; Reduction (Redux) vs. Yau Method</h3>
            <p>Both 4x4 speedcubing methods reduce the 4x4 into a pseudo-3x3 state (6 solved centers + 12 paired edge dedges), then finish with 3x3 F2L &amp; Last Layer + Parity:</p>
            <div class="guide-grid">
              <div>
                <p><strong>Redux (Standard Reduction):</strong></p>
                <ol class="guide-list guide-steps">
                  <li><strong>All 6 Centers:</strong> Build 2 opposite centers, then finish all 4 middle-slice centers in sequence using standard color scheme.</li>
                  <li><strong>All 12 Edges (Dedges):</strong> Pair edges freely using slice-flip-slice (or Freeslice) with full U/D storage.</li>
                  <li><strong>3x3 Stage + Parity:</strong> Solve Cross &rarr; F2L &rarr; OLL (fix OLL parity) &rarr; PLL (fix PLL parity).</li>
                </ol>
              </div>
              <div>
                <p><strong>Yau Method (Main Speedcubing Standard):</strong></p>
                <ol class="guide-list guide-steps">
                  <li><strong>First 2 Opposite Centers:</strong> Solve White &amp; Yellow centers (leave 3 slots free around White).</li>
                  <li><strong>3 of 4 Cross Edges:</strong> Pair 3 White cross edges and place them around the White center on <code>L</code> (solving 3/4 of your Cross early!).</li>
                  <li><strong>Last 4 Centers (L4C):</strong> Hold White on <code>L</code>; solve the remaining 4 centers using only <code>R, Rw, U</code> moves so your 3 cross edges stay intact.</li>
                  <li><strong>4th Cross Edge:</strong> Pair the final White cross edge and insert it to complete your Cross on <code>D</code>.</li>
                  <li><strong>3-2-3 Last 8 Edges:</strong> Rapidly pair the final 8 edges with zero pauses, then go straight into F2L!</li>
                </ol>
              </div>
            </div>
          </section>

          <div class="guide-grid">
            <section class="guide-card">
              <h3 class="guide-card-title">&#x1F3A8; Center Pairing &amp; BOY Color Scheme</h3>
              <p>Even-layered cubes (4x4, 6x6) have <strong>no fixed physical center caps</strong> &mdash; building two adjacent centers swapped makes the rest of the solve impossible until fixed:</p>
              <ul class="guide-list">
                <li><strong>Standard BOY Color Scheme:</strong> In standard scramble orientation (<strong>White Top, Green Front</strong>), Right is Red, Back is Blue, Left is Orange, Bottom is Yellow.</li>
                <li><strong>With White on Bottom (D) &amp; Yellow on Top (U):</strong> Looking down at Yellow, side centers go clockwise <strong>Green &rarr; Red &rarr; Blue &rarr; Orange</strong>. Quick check: hold <strong>Green Front, White Bottom</strong> &rarr; <strong>Orange is on Right</strong> (or hold Blue Front &rarr; Red is on Right).</li>
                <li><strong>Easy "BOY" Corner Check:</strong> Going clockwise around the Blue&ndash;Orange&ndash;Yellow corner always reads <strong>Blue &rarr; Orange &rarr; Yellow</strong>.</li>
                <li><strong>Opposite First:</strong> Solve 1st center (White/Yellow) with 1x2 bars, then build its opposite face using <code>Rw U2 Rw'</code> / <code>Rw' U2 Rw</code> insertions.</li>
                <li><strong>Last 2 Centers (L2C):</strong> Build 1x2 bars on Top/Front without breaking solved centers: insert bars with <code>Rw U Rw'</code> / <code>Rw U2 Rw'</code>, or fix final single cubies with <code>Rw U Rw' U Rw U2 Rw'</code> (holding target swap on F/U).</li>
              </ul>
            </section>

            <section class="guide-card">
              <h3 class="guide-card-title">&#x1F504; Edge Pairing &amp; Flipping Algorithm</h3>
              <p>Every 4x4 edge pair (dedge) consists of 2 wing pieces. Standard Redux pairs them using <strong>Slice &rarr; Insert/Flip &rarr; Slice Back</strong>:</p>
              <ul class="guide-list">
                <li><strong>Flipping Alg:</strong> Flips the Front-Right (FR) dedge in place without disturbing U/D faces: <code>R U R' F R' F' R</code> (or shorter 5-move <code>R F' U R' F</code>).</li>
                <li><strong>Basic Redux Cycle:</strong> Put an unsolved target wing in FR, offset with <code>Uw'</code> to pair a matching piece, replace the solved dedge into <code>U</code> or <code>D</code> with <code>R U R'</code>, then restore centers with <code>Uw</code>.</li>
                <li><strong>Last 2 Edges (L2E):</strong> When only 2 unsolved dedges remain in FR and FL with matching colors facing the same horizontal level (not staggered diagonally), run <code>Uw' (R U R' F R' F' R) Uw</code> to solve both simultaneously!</li>
              </ul>
            </section>

            <section class="guide-card">
              <h3 class="guide-card-title">&#x26A1; 3-2-3 Edge Pairing (Yau Method)</h3>
              <p>With all 6 centers + 4 D-layer Cross edges solved in <strong>Yau</strong>, only <strong>8 top/middle edges</strong> remain. Pair them in 3 fast cycles with zero rotation hunting:</p>
              <ol class="guide-list guide-steps">
                <li><strong>Initial Offset (<code>Uw'</code>):</strong> Slice the equator once (<code>Uw'</code> or <code>u'</code>).</li>
                <li><strong>First 3 Edges:</strong> Match the front-right bottom wing using the front-left top wing, then insert the next matching edge from <code>U</code> into that open top slot. Repeat around <code>FR &rarr; FL &rarr; BL</code> (<strong>3 dedges</strong>). Slice back <code>Uw</code> &rarr; <strong>3 solved edges!</strong></li>
                <li><strong>Next 2 Edges:</strong> Slice <code>Uw'</code> (to an unsolved pair), feed <strong>2 matching edges</strong> from <code>U</code> into the active slots, then slice back <code>Uw</code> &rarr; <strong>5 total solved edges!</strong></li>
                <li><strong>Final 3 Edges:</strong> Slice <code>Uw'</code>, feed the remaining edges so aligning back solves all remaining wings, and slice <code>Uw</code> &rarr; <strong>all 8 edges solved!</strong></li>
                <li><strong>Cycle Break (2-cycle):</strong> If a chain closes after only 2 edges instead of 3, replace any solved-slot spot with an unsolved edge from <code>U</code> (e.g. <code>R U' R'</code>) and continue pairing.</li>
              </ol>
            </section>

            <section class="guide-card">
              <h3 class="guide-card-title">&#x2696;&#xFE0F; Parity &amp; 4x4 Speedcubing Benchmarks</h3>
              <ul class="guide-list">
                <li><strong>Why 2 OLL Parity Diagrams?</strong> Wide-turn speed algs (like <code>Rw U2 x Rw...</code>) flip <strong>all 4 front top pieces</strong> (<code>UFL, UF dedge, UFR</code>) and swap UL/UR &mdash; great <em>before</em> OLL. Inner-slice Pure Lucas Parity (<code>2R2 B2 U2 2L...</code>) flips <strong>only the 2 UF wings</strong> while keeping all corners intact.</li>
                <li><strong>Parity Probability:</strong> 50% OLL parity, 50% PLL parity, 25% chance of double parity (both in one solve).</li>
                <li><strong>15s Inspection Target:</strong> Plan your entire 1st Center (4&ndash;6 moves) and track 1&ndash;2 pieces of your opposite 2nd Center before starting.</li>
                <li><strong>Target Stage Splits:</strong> Aim roughly for <strong>25% Centers</strong> (L4C lookahead), <strong>35% Cross + 3-2-3 Edges</strong>, and <strong>40% 3x3 Stage + Parity</strong>.</li>
              </ul>
            </section>
          </div>
        </div>
      `;
    }

    if (this.currentPuzzle === "444") {
      return `
        <div class="guide-card-stack">
          <section class="guide-card">
            <h3 class="guide-card-title">⚖️ 4x4 Parity: 4-Piece Front Flip vs. Pure Dedge Flip</h3>
            <p>Because the 4x4 lacks fixed centers, odd internal slice permutations cause last-layer states <strong>impossible on a 3x3</strong> (50% OLL parity, 50% PLL parity):</p>
            <ul class="guide-list">
              <li><strong>OLL (4-Piece Front Flip):</strong> Fast wide-turn algorithms (<code>Rw U2 x Rw...</code> or wide Lucas <code>Rw2 B2...</code>) flip the entire front row (<strong>UFL corner + UF dedge + UFR corner</strong>) and swap UL/UR. Use right before OLL recognition so OLL/PLL finishes everything cleanly.</li>
              <li><strong>OLL (Pure Single Dedge Flip):</strong> Inner-slice Lucas Parity (<code>2R2 B2 U2 2L U2 2R' U2 2R U2 F2 2R F2 2L' B2 2R2</code>) flips <strong>only the 2 middle UF wings</strong> while preserving all 4 corners. Ideal when OLL corners/edges are already solved or recognized.</li>
              <li><strong>PLL Parity (Opposite &amp; Adjacent):</strong> Swaps two opposite dedges (<code>2R2 U2 2R2 Uw2 2R2 Uw2</code>) or two adjacent dedges via sexy-move setup.</li>
            </ul>
          </section>

          <section class="guide-card">
            <h3 class="guide-card-title">⚡ Turning Technique &amp; Full 4x4 Guides</h3>
            <ul class="guide-list">
              <li><strong>Wide turns (Rw, Lw):</strong> Turn outer two layers together cleanly without locking inner layers.</li>
              <li><strong>Inner slice (2R):</strong> Push inner right slice with ring finger, or execute <code>Rw2 R2</code> equivalent if inner slices catch.</li>
              <li><strong>Want full 4x4 method tutorials?</strong> Open the <strong>4x4 Methods &amp; Guides</strong> tab above for step-by-step Redux vs. Yau, Color Scheme, Center Pairing, Edge Flipping, and 3-2-3 Edge Pairing!</li>
            </ul>
          </section>
        </div>
      `;
    }

    if (this.currentPuzzle === "555" || (this.currentPuzzle === "555" && this.currentTrackId === "parity")) {
      return `
        <div class="guide-card-stack">
          <section class="guide-card">
            <h3 class="guide-card-title">⚖️ 5x5 Parity &amp; Last Two Edges (L2E)</h3>
            <p>5x5 cubes have true fixed center pieces, which means corner/edge parity like 4x4 PLL parity is <strong>impossible</strong>. However, wing edge pieces during reduction (Last Two Edges) can require parity flips:</p>
            <ul class="guide-list">
              <li><strong>Middle Edge Flip (Lucas Parity):</strong> The middle edge (midge) of the last edge group is inverted. Fixed with <code>Rw U2 x Rw U2 Rw U2 Rw' U2 Lw U2 3Rw' U2 Rw U2 Rw' U2 Rw'</code>.</li>
              <li><strong>Slice-Flip-Slice:</strong> Slice the inner layer to pair one wing, flip the edge using <code>R U R' F R' F' R</code>, then restore the slice.</li>
            </ul>
          </section>
        </div>
      `;
    }

    if (this.currentPuzzle === "333oh") {
      return `
        <div class="guide-card-stack">
          <section class="guide-card">
            <h3 class="guide-card-title">📖 ${track.name} Reference</h3>
            <p>${track.description}</p>
            <p>Use the <strong>Case Grid</strong> to browse all cases and set your preferred algorithms (★), or test yourself in the <strong>Practice</strong> tab.</p>
          </section>

          <section class="guide-card">
            <h3 class="guide-card-title">✋ 3x3 One-Handed Style &amp; Turning Technique</h3>
            <ul class="guide-list">
              <li><strong>Left Hand (RU) vs. Right Hand (Mirror / z'):</strong> Left-hand OH favors standard <code>&lt;R, U&gt;</code> triggers, while Right-hand OH automatically generates mirrored <code>&lt;L, U&gt;</code> and <code>z'</code> conjugated <code>&lt;U, L&gt;</code> variants.</li>
              <li><strong>Table Abuse:</strong> Brace the cube against the mat/table to execute rapid <code>M</code>, <code>S</code>, and <code>E</code> slices (like <code>M2' U M2' U2 M2' U M2'</code> for H-Perm).</li>
              <li><strong>No Table Abuse (In-Air):</strong> Restricts recommendations to <code>L</code>, <code>R</code>, and <code>U</code> moves with occasional <code>F</code> and <code>D</code> turns, removes slice moves, and converts <code>B</code> turns into an <code>x'</code> rotation + <code>U</code> (e.g. <code>R2 U2 R U2 R2 U2 R2 U2 R U2 R2</code> for H-Perm).</li>
            </ul>
          </section>
        </div>
      `;
    }

    return `
      <div class="guide-card">
        <h3 class="guide-card-title">📖 ${track.name} Reference</h3>
        <p>${track.description}</p>
        <p>Use the <strong>Case Grid</strong> to browse all cases and set your preferred algorithms (★), or test yourself in the <strong>Practice</strong> tab.</p>
      </div>
    `;
  }

  renderTwoSidedView(track) {
    const is222 = this.currentPuzzle === "222";
    const isPll = (this.currentPuzzle === "333" || this.currentPuzzle === "333oh") && this.currentTrackId === "pll";
    const isOll = (this.currentPuzzle === "333" || this.currentPuzzle === "333oh") && this.currentTrackId === "oll";
    const whiteBottom = true;

    const getCardSetup = (c) => {
      const rawSetup = c?.setup || c?.scramble || "";
      if (!rawSetup) return "";
      return (whiteBottom && !/^z2\b/i.test(rawSetup) ? `z2 ${rawSetup}` : rawSetup).trim();
    };

    const renderCardFooterAndCube = (caseId, badgeLabel, setupStr, oppCode = "") => `
      <div class="twosided-card-3d-wrap" data-twosided-case-id="${escapeHtml(caseId)}" data-twosided-setup="${escapeHtml(setupStr)}">
        <span class="study-visual-loading">Loading 3D...</span>
      </div>
    `;

    const renderCardActions = (caseId, label) => `
      <div class="twosided-card-actions">
        <button type="button" class="btn btn-xs btn-icon-only btn-twosided-reset-3d" data-twosided-case-id="${escapeHtml(caseId)}" data-tooltip="Reset 3D angle (Front + Right)" aria-label="Reset 3D angle for ${escapeHtml(label || caseId)}">${ICON_RESET_ANGLE}</button>
        <button type="button" class="btn btn-xs btn-study-view" data-case-id="${escapeHtml(caseId)}" data-tooltip="Open Grid + 3D to inspect algorithms &amp; 3D flashcard" aria-label="View algorithms for ${escapeHtml(caseId)}">${ICON_DIAGRAM}<span>Algs</span></button>
        <button type="button" class="btn btn-xs btn-study-sim" data-case-id="${escapeHtml(caseId)}" data-tooltip="Simulate in an interactive 3D popup" aria-label="Simulate ${escapeHtml(caseId)} in 3D popup">${ICON_POPUP_SIM}<span>Sim</span></button>
      </div>
    `;

    if (isPll) {
      const pllMode = this.getPllMode?.() === "2look" ? "2look" : "full";
      const categories = PLL_TWO_SIDED_GUIDE
        .map(cat => ({
          ...cat,
          rules: pllMode === "2look"
            ? cat.rules.filter(r => TWO_LOOK_PLL_STUDY_IDS.has(r.caseId))
            : cat.rules
        }))
        .filter(cat => cat.rules.length > 0);

      const renderPllRuleCard = (r) => {
        const caseId = r.caseId || "";
        const c = caseId ? track?.caseById?.get(caseId) : null;
        const setupStr = getCardSetup(c);
        return `
          <div class="twosided-rule-card">
            <div class="twosided-rule-header">
              <span class="twosided-case-badge">${escapeHtml(caseId)}</span>
              <h5 class="twosided-case-name">${escapeHtml(r.name || caseId)}</h5>
            </div>
            ${caseId ? renderCardFooterAndCube(caseId, caseId, setupStr) : ''}
            <p class="twosided-cue-text">${escapeHtml(r.cue || "")}</p>
            <div class="twosided-sight-boxes">
              <div class="sight-box">
                <span class="sight-label">Front Sight:</span>
                <span class="sight-val">${escapeHtml(r.frontSight || "")}</span>
              </div>
              <div class="sight-box">
                <span class="sight-label">Right Sight:</span>
                <span class="sight-val">${escapeHtml(r.rightSight || "")}</span>
              </div>
            </div>
            ${caseId ? renderCardActions(caseId, caseId) : ''}
          </div>
        `;
      };

      return `
        <div class="study-twosided-wrap">
          <div class="study-twosided-hero">
            <h3 class="study-twosided-title">👀 2-Sided PLL Recognition Guide (${pllMode === "2look" ? "2-Look · 6 Cases" : "Full · 21 Cases"})</h3>
            <p class="study-twosided-desc">
              Top speedcubers recognize ${pllMode === "2look" ? "2-Look PLL cases" : "all 21 PLL cases"} instantly by examining only <strong>two adjacent faces</strong> (Front &amp; Right) without rotating the cube (AUF or U/U' inspection).
            </p>
            <div class="study-twosided-keys">
              <span class="twosided-key-pill"><span class="pill-dot headlights-dot"></span> Headlights (Matching corners)</span>
              <span class="twosided-key-pill"><span class="pill-dot bar-dot"></span> 1x2 or 1x3 Bars</span>
              <span class="twosided-key-pill"><span class="pill-dot opposites-dot"></span> Bookends (Opposite colors)</span>
              <span class="twosided-key-pill"><span class="pill-dot checker-dot"></span> Checkers (Alternating colors)</span>
            </div>
          </div>

          <div class="study-twosided-categories">
            ${categories.map(cat => `
              <div class="twosided-cat-card">
                <div class="twosided-cat-head">
                  <h4 class="twosided-cat-title">${escapeHtml(cat.category)}</h4>
                  ${cat.summary ? `<span class="twosided-cat-summary">${escapeHtml(cat.summary)}</span>` : ''}
                </div>
                <div class="twosided-rules-grid">
                  ${cat.rules.map(renderPllRuleCard).join('')}
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    // 3x3 / 3x3 OH OLL (both Full 57 and 2-Look 10) + 2x2 tracks (no descriptions)
    const sections = this.getGroupedSections(track);
    const baseCases = this.getTrackBaseCases(track);
    const ollRuleByCaseId = new Map();
    if (isOll) {
      for (const cat of OLL_TWO_SIDED_GUIDE) {
        for (const rule of cat.rules || []) {
          if (rule.caseId) ollRuleByCaseId.set(rule.caseId, rule);
        }
      }
    }

    const ollMode = this.getOllMode?.() === "2look" ? "2look" : "full";
    const heroTitle = isOll
      ? `👀 2-Sided OLL Recognition Guide (${ollMode === "2look" ? "2-Look · 10 Cases" : "Full · 57 Cases"})`
      : `👀 2-Sided ${track.shortName || track.name} Recognition (${baseCases.length} Cases)`;
    const heroDesc = isOll
      ? `Recognize ${ollMode === "2look" ? "all 10 2-Look OLL cases (3 EO + 7 OCLL)" : `all ${baseCases.length} OLL cases`} from a fixed <strong>Front + Right + Top</strong> 3D view without rotating.`
      : `Inspect <strong>${escapeHtml(track.shortName || track.name)}</strong> cases from a fixed <strong>Front + Right + Top</strong> 3D angle without rotating.`;

    const renderCase3dCard = (c) => {
      const displayId = formatCaseDisplayId(c.id);
      const distinctName = is222 ? "" : getDistinctCaseName(c);
      const oppBadge = c.opposite
        ? ` <span class="study-card-opp" data-tooltip="Opposite / inverse case: ${escapeHtml(c.opposite)}">(Opp ${escapeHtml(c.opposite)})</span>`
        : "";
      const ollRule = isOll ? ollRuleByCaseId.get(c.id) : null;
      const setupStr = getCardSetup(c);

      return `
        <div class="twosided-rule-card">
          <div class="twosided-rule-header">
            <span class="twosided-case-badge">${escapeHtml(displayId)}</span>
            ${oppBadge}
            ${distinctName ? `<h5 class="twosided-case-name">${escapeHtml(distinctName)}</h5>` : ''}
          </div>
          ${renderCardFooterAndCube(c.id, displayId, setupStr)}
          ${!is222 && ollRule ? `
            <p class="twosided-cue-text">${escapeHtml(ollRule.cue || "")}</p>
            <div class="twosided-sight-boxes">
              <div class="sight-box">
                <span class="sight-label">Recognition:</span>
                <span class="sight-val">${escapeHtml(ollRule.recognition || "")}</span>
              </div>
            </div>
          ` : ''}
          ${renderCardActions(c.id, displayId)}
        </div>
      `;
    };

    return `
      <div class="study-twosided-wrap">
        <div class="study-twosided-hero">
          <h3 class="study-twosided-title">${heroTitle}</h3>
          <p class="study-twosided-desc">${heroDesc}</p>
        </div>

        ${this.renderGroupFilterBar(track)}

        <div class="study-twosided-categories">
          ${sections.length === 0
            ? `<p class="empty-state" style="padding: 20px;">No cases match the active filter.</p>`
            : sections.map(sec => `
                <div class="twosided-cat-card">
                  ${sections.length > 1 || isOll || is222 ? `
                    <div class="twosided-cat-head">
                      <h4 class="twosided-cat-title">${escapeHtml(sec.group)} <span class="study-group-section-count">(${sec.cases.length})</span></h4>
                    </div>
                  ` : ''}
                  <div class="twosided-rules-grid is-compact">
                    ${sec.cases.map(renderCase3dCard).join('')}
                  </div>
                </div>
              `).join('')}
        </div>
      </div>
    `;
  }

  bindEvents(track, is222FaceOrLayer = false) {
    // 4-Tier 3x3 F2L Curriculum switcher
    this.container.querySelectorAll('[data-study-f2l-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        const nextMode = sanitizeF2lMode(btn.dataset.studyF2lMode);
        this.activeGroupFilters.clear();
        this.previewAlgId = null;
        this.selectedCaseId = null;
        if (this.onSetF2lMode) {
          const prevMode = sanitizeF2lMode(this.getF2lMode ? this.getF2lMode() : 'basic');
          this.onSetF2lMode(nextMode);
          if (prevMode === nextMode) this.render();
        } else {
          this.render();
        }
      });
    });

    // 2-Look vs Full OLL / PLL switcher (synced with Stats & Settings)
    this.container.querySelectorAll('[data-study-oll-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        const nextMode = btn.dataset.studyOllMode === '2look' ? '2look' : 'full';
        this.activeGroupFilters.clear();
        this.previewAlgId = null;
        if (this.onSetOllMode) {
          const prevMode = this.getOllMode ? this.getOllMode() : 'full';
          this.onSetOllMode(nextMode);
          if (prevMode === nextMode) this.render();
        } else {
          this.render();
        }
      });
    });

    this.container.querySelectorAll('[data-study-pll-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        const nextMode = btn.dataset.studyPllMode === '2look' ? '2look' : 'full';
        this.activeGroupFilters.clear();
        this.previewAlgId = null;
        if (this.onSetPllMode) {
          const prevMode = this.getPllMode ? this.getPllMode() : 'full';
          this.onSetPllMode(nextMode);
          if (prevMode === nextMode) this.render();
        } else {
          this.render();
        }
      });
    });

    // 3x3 OH Hand & Table Abuse switchers
    this.container.querySelectorAll('.oh-hand-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.dataset.ohHand && this.onSetOhHand) {
          this.previewAlgId = null;
          this.onSetOhHand(btn.dataset.ohHand);
        }
      });
    });

    this.container.querySelectorAll('.oh-table-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.dataset.ohTable && this.onSetOhTableAbuse) {
          this.previewAlgId = null;
          this.onSetOhTableAbuse(btn.dataset.ohTable === 'table');
        }
      });
    });

    if (is222FaceOrLayer) {
      if (this.currentTrackId === 'face') {
        bindFirstFaceStudyEvents(this.container, {
          onQuickSimSolutions: this.onQuickSimSolutions,
          getSimSpeed: this.getSimSpeed,
          getShowReflection: this.getShowReflection
        });
      } else {
        bindFirstLayerStudyEvents(this.container, this.firstLayerExplorerState, {
          onRerender: () => this.render(),
          onQuickSimSolutions: this.onQuickSimSolutions,
          getSimSpeed: this.getSimSpeed,
          onSetSimSpeed: this.onSetSimSpeed,
          getShowReflection: this.getShowReflection
        });
      }
      return;
    }

    // Subnav view buttons
    this.container.querySelectorAll('.study-subnav-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.setView(btn.dataset.view);
      });
    });

    // Group filter pills: consistent multi-select toggle across all tracks; "All" resets filter
    this.container.querySelectorAll('.study-group-pill').forEach(btn => {
      btn.addEventListener('click', () => {
        if (btn.dataset.onlySelected) {
          this.onlySelectedFilter = !this.onlySelectedFilter;
        } else {
          const grp = btn.dataset.group;
          if (grp === "all") {
            this.activeGroupFilters.clear();
          } else if (this.activeGroupFilters.has(grp)) {
            this.activeGroupFilters.delete(grp);
          } else {
            this.activeGroupFilters.add(grp);
          }
        }
        this.render();
      });
    });

    // Essential F2L card flip buttons (base <-> left/right mirror)
    this.container.querySelectorAll('.btn-f2l-flip[data-essential-base-id]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const baseId = btn.dataset.essentialBaseId;
        if (!baseId) return;
        if (this.flippedEssentialIds.has(baseId)) {
          this.flippedEssentialIds.delete(baseId);
        } else {
          this.flippedEssentialIds.add(baseId);
        }
        this.render();
      });
    });

    const flipDetailBtn = this.container.querySelector('#studyFlipMirrorBtn');
    if (flipDetailBtn) {
      flipDetailBtn.addEventListener('click', () => {
        const partnerId = flipDetailBtn.dataset.mirrorPartnerId;
        if (!partnerId) return;
        this.selectedCaseId = partnerId;
        this.previewAlgId = null;
        this.render();
      });
    }

    // Card click in hybrid view (stays in hybrid, updates right detail pane)
    this.container.querySelectorAll('.study-hybrid-card').forEach(card => {
      card.addEventListener('click', () => {
        this.selectedCaseId = card.dataset.caseId;
        this.previewAlgId = null;
        this.render();
      });
    });

    // Card click in grid -> open Grid + 3D on that exact case
    this.container.querySelectorAll('.study-card').forEach(card => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('button')) return; // handled by button
        this.selectedCaseId = card.dataset.caseId;
        this.previewAlgId = null;
        this.setView('hybrid', { keepSelected: true });
      });
    });

    // Detail button -> open Grid + 3D on that exact case
    this.container.querySelectorAll('.btn-study-view').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.selectedCaseId = btn.dataset.caseId;
        this.previewAlgId = null;
        this.setView('hybrid', { keepSelected: true });
      });
    });

    // Simulate buttons -> open in-place #quickSimModal popup with all alg variants
    this.container.querySelectorAll('.btn-study-sim').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const c = this.getCaseById(track, btn.dataset.caseId);
        if (c) this.openCaseQuickSim(track, c);
      });
    });

    this.container.querySelectorAll('.btn-alg-label').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const c = this.getCaseById(track, btn.dataset.caseId);
        if (c && this.onEditLabel) {
          const algs = this.getCaseAlgs(track, c);
          const algObj = algs.find(a => a.id === btn.dataset.algId) || algs[0];
          this.onEditLabel(c, algObj);
        }
      });
    });

    this.container.querySelectorAll('.btn-alg-sim').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const c = this.getCaseById(track, btn.dataset.caseId);
        if (c) this.openCaseQuickSim(track, c, btn.dataset.algId);
      });
    });

    // Click alg row to preview its starting top-layer angle on 2D + 3D flashcard
    this.container.querySelectorAll('.study-alg-row').forEach(row => {
      const selectPreview = () => {
        const caseId = row.dataset.caseId;
        const algId = row.dataset.algId;
        const c = this.getCaseById(track, caseId);
        if (!c || !algId) return;
        this.previewAlgId = algId;
        this.container.querySelectorAll('.study-alg-row').forEach(r => {
          r.classList.toggle('previewing', r.dataset.algId === algId);
        });
        const algObj = this.getCaseAlgs(track, c).find(a => a.id === algId);
        const metaEl = this.container.querySelector('#studyStartAngleMeta');
        if (metaEl && algObj) {
          metaEl.innerHTML = `
            <span class="study-auf-pill ${algObj.startAuf ? 'has-auf' : ''}">${algObj.startAuf ? 'Start: ' + algObj.startAuf : 'Start: Standard'}</span>
            <span class="study-auf-alg">${algObj.alg}</span>
          `;
        }
        this.populateDetailVisuals(track, c);
      };
      row.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        selectPreview();
      });
      row.addEventListener('keydown', (e) => {
        if ((e.key === 'Enter' || e.key === ' ') && !e.target.closest('button')) {
          e.preventDefault();
          selectPreview();
        }
      });
    });

    // Star preferred algorithm button
    this.container.querySelectorAll('.study-star-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const caseId = btn.dataset.caseId;
        const algId = btn.dataset.algId;
        setPreferredAlg(caseId, algId, this.currentPuzzle, this.getPrefSubScope());
        this.previewAlgId = algId;
        this.render();
      });
    });

    // Delete custom algorithm button
    this.container.querySelectorAll('.study-custom-alg-del-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const caseId = btn.dataset.caseId;
        const algId = btn.dataset.algId;
        const c = this.getCaseById(track, caseId);
        removeCustomAlgForCase(this.currentPuzzle, caseId, algId);
        if (this.previewAlgId === algId) {
          this.previewAlgId = null;
        }
        if (c) {
          const remaining = this.getCaseAlgs(track, c);
          const fallback = remaining.find(a => a.isDefault) || remaining[0];
          const currentPref = getPreferredAlg(caseId, fallback?.id, this.currentPuzzle, this.getPrefSubScope());
          if (currentPref === algId && fallback) {
            setPreferredAlg(caseId, fallback.id, this.currentPuzzle, this.getPrefSubScope());
          }
        }
        this.customAlgNotice = { caseId, ok: true, msg: 'Removed custom algorithm.' };
        this.render();
      });
    });

    // Verify & Add custom algorithm form
    const customAddBtn = this.container.querySelector('#studyAddCustomAlgBtn');
    const customAlgInput = this.container.querySelector('#studyCustomAlgInput');
    const customNoteInput = this.container.querySelector('#studyCustomAlgNoteInput');
    const customFeedback = this.container.querySelector('#studyCustomAlgFeedback');
    if (customAddBtn && customAlgInput) {
      const submitCustomAlg = async () => {
        const caseId = customAddBtn.dataset.caseId;
        const c = this.getCaseById(track, caseId);
        if (!c) return;
        const rawAlg = customAlgInput.value;
        const triggerNote = customNoteInput?.value || '';

        customAddBtn.disabled = true;
        if (customFeedback) {
          customFeedback.hidden = false;
          customFeedback.className = 'study-custom-alg-feedback pending';
          customFeedback.textContent = 'Verifying moves against KPuzzle...';
        }

        const res = await verifyCustomAlgForCase(this.currentPuzzle, this.currentTrackId, c, rawAlg);
        if (this.selectedCaseId !== caseId) return;

        if (!res.valid) {
          customAddBtn.disabled = false;
          if (customFeedback) {
            customFeedback.hidden = false;
            customFeedback.className = 'study-custom-alg-feedback err';
            customFeedback.textContent = res.reason || 'Invalid algorithm for this case.';
          }
          return;
        }

        const created = addCustomAlgForCase(this.currentPuzzle, caseId, {
          alg: res.normalizedAlg,
          trigger: triggerNote,
          startAuf: res.startAuf
        });
        if (created) {
          setPreferredAlg(caseId, created.id, this.currentPuzzle, this.getPrefSubScope());
          this.previewAlgId = created.id;
          this.customAlgNotice = { caseId, ok: true, msg: res.reason || 'Verified & added!' };
        }
        this.render();
      };

      customAddBtn.addEventListener('click', submitCustomAlg);
      customAlgInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          submitCustomAlg();
        }
      });
      if (customNoteInput) {
        customNoteInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            submitCustomAlg();
          }
        });
      }
    }

    // Prev / Next case in detail & hybrid view (cycles only through selected cases when any are selected)
    const prevBtn = this.container.querySelector('#studyPrevCaseBtn');
    const nextBtn = this.container.querySelector('#studyNextCaseBtn');
    if (prevBtn && nextBtn) {
      const cases = this.getNavigableCases(track);
      const idx = cases.findIndex(c => c.id === this.selectedCaseId);
      prevBtn.addEventListener('click', () => {
        if (cases.length === 0) return;
        const curIdx = idx >= 0 ? idx : 0;
        const nextIdx = (curIdx - 1 + cases.length) % cases.length;
        this.selectedCaseId = cases[nextIdx].id;
        this.previewAlgId = null;
        this.render();
      });
      nextBtn.addEventListener('click', () => {
        if (cases.length === 0) return;
        const curIdx = idx >= 0 ? idx : -1;
        const nextIdx = (curIdx + 1) % cases.length;
        this.selectedCaseId = cases[nextIdx].id;
        this.previewAlgId = null;
        this.render();
      });
    }

    // Practice this case button
    const practiceBtn = this.container.querySelector('#studyPracticeThisBtn');
    if (practiceBtn) {
      practiceBtn.addEventListener('click', () => {
        const c = this.getCaseById(track, practiceBtn.dataset.caseId);
        if (c && this.onPracticeCase) {
          this.onPracticeCase(c);
        }
      });
    }

    // Open in-place popup simulator button
    const simBtn = this.container.querySelector('#studySimulateThisBtn');
    if (simBtn) {
      simBtn.addEventListener('click', () => {
        const c = this.getCaseById(track, simBtn.dataset.caseId);
        if (c) this.openCaseQuickSim(track, c, this.previewAlgId || null);
      });
    }

    // Populate visual representations
    const token = this._renderToken;
    if (this.currentView === 'grid') {
      if (this.isF2lStudyTrack()) {
        this.populateTwoSided3d(track, token);
      } else {
        this.populateGridVisuals(track, token);
      }
    } else if (this.currentView === 'hybrid') {
      if (!this.isF2lStudyTrack()) {
        this.populateGridVisuals(track, token);
      }
      const fallbackCase = this.getNavigableCases(track)[0] || this.getTrackBaseCases(track)[0] || track.cases[0];
      const c = this.getCaseById(track, this.selectedCaseId) || fallbackCase;
      if (c) {
        this.populateDetailVisuals(track, c, token);
      }
    } else if (this.currentView === 'detail') {
      const fallbackCase = this.getNavigableCases(track)[0] || this.getTrackBaseCases(track)[0] || track.cases[0];
      const c = this.getCaseById(track, this.selectedCaseId) || fallbackCase;
      if (c) {
        this.populateDetailVisuals(track, c, token);
      }
    } else if (this.currentView === 'twosided') {
      this.populateTwoSided3d(track, token);
    }
  }

  async populateTwoSided3d(track, token = this._renderToken) {
    if (!this.container || typeof window === 'undefined') return;
    const wraps = this.container.querySelectorAll('.twosided-card-3d-wrap');
    if (!wraps.length) return;

    const puzzle = this.currentPuzzle;
    const trackId = this.currentTrackId;
    const state = this._twoSided3d;
    const gen = state.gen;

    const touchLru = (caseId) => {
      const idx = state.lru.indexOf(caseId);
      if (idx >= 0) state.lru.splice(idx, 1);
      state.lru.push(caseId);
      while (state.lru.length > MAX_TWOSIDED_3D) {
        const victimIdx = state.lru.findIndex(cand => !state.cards.get(cand)?.intersecting);
        if (victimIdx < 0) break;
        const [victimId] = state.lru.splice(victimIdx, 1);
        const victim = state.cards.get(victimId);
        if (victim?.displayEl) {
          try {
            victim.displayEl.player?.pause?.();
            victim.displayEl.remove?.();
          } catch {}
          victim.displayEl = null;
          victim.mountPromise = null;
          if (victim.wrapEl?.isConnected) {
            victim.wrapEl.innerHTML = victim.fallbackSvg || '<span class="study-visual-loading">3D Ready</span>';
          }
        }
      }
    };

    const resetCardAngle = async (entry) => {
      const el = entry?.displayEl;
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
        el.player.cameraLatitude = 32;
        el.player.cameraLongitude = Number.isFinite(entry.cameraLongitude) ? entry.cameraLongitude : 30;
        el.player.experimentalModel?.twistySceneModel?.orbitCoordinatesRequest?.set?.('auto');
      } catch {}
    };

    const ensureMounted = async (entry) => {
      if (!entry || gen !== state.gen || token !== this._renderToken || !entry.wrapEl?.isConnected) return null;
      if (entry.displayEl && entry.wrapEl.contains(entry.displayEl)) {
        touchLru(entry.caseId);
        return entry.displayEl;
      }
      if (entry.mountPromise) return entry.mountPromise;

      entry.mountPromise = (async () => {
        try {
          const SD = await getScrambleDisplay();
          if (!SD || gen !== state.gen || token !== this._renderToken || !entry.wrapEl?.isConnected) return null;
          const camLng = Number.isFinite(entry.cameraLongitude) ? entry.cameraLongitude : 30;
          const el = new SD();
          el.event = puzzle === '333oh' ? '333' : puzzle;
          el.visualization = '3D';
          el.scramble = entry.setup;
          el.hintFacelets = 'none';
          el.cameraLatitude = 32;
          el.cameraLongitude = camLng;
          entry.wrapEl.innerHTML = '';
          entry.wrapEl.appendChild(el);
          if (el.player) {
            el.player.hintFacelets = 'none';
            el.player.cameraLatitude = 32;
            el.player.cameraLongitude = camLng;
          }
          entry.displayEl = el;
          touchLru(entry.caseId);
          void applyColorsTo3DCube(el);
          return el;
        } catch {
          return null;
        } finally {
          entry.mountPromise = null;
        }
      })();

      return entry.mountPromise;
    };

    wraps.forEach((wrapEl) => {
      const caseId = wrapEl.getAttribute('data-twosided-case-id') || wrapEl.dataset?.twosidedCaseId;
      const setup = wrapEl.getAttribute('data-twosided-setup') || wrapEl.dataset?.twosidedSetup || '';
      const camLngAttr = wrapEl.getAttribute('data-camera-longitude') ?? wrapEl.dataset?.cameraLongitude;
      const parsedCamLng = camLngAttr !== null && camLngAttr !== undefined && camLngAttr !== '' ? Number(camLngAttr) : 30;
      const cameraLongitude = Number.isFinite(parsedCamLng) ? parsedCamLng : 30;
      const caseObj = this.getCaseById(track, caseId);
      if (!caseId) return;
      state.cards.set(caseId, {
        caseId,
        caseObj,
        setup,
        cameraLongitude,
        wrapEl,
        displayEl: null,
        mountPromise: null,
        fallbackSvg: '',
        intersecting: false
      });
    });

    this.container.querySelectorAll('.btn-twosided-reset-3d').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const cid = btn.getAttribute('data-twosided-case-id') || btn.dataset?.twosidedCaseId;
        const entry = cid ? state.cards.get(cid) : null;
        if (!entry) return;
        if (!entry.displayEl) await ensureMounted(entry);
        await resetCardAngle(entry);
      });
    });

    if (typeof IntersectionObserver !== 'undefined') {
      const obs = new IntersectionObserver((entries) => {
        if (gen !== state.gen || token !== this._renderToken) return;
        for (const io of entries) {
          const cid = io.target?.getAttribute?.('data-twosided-case-id') || io.target?.dataset?.twosidedCaseId;
          const entry = cid ? state.cards.get(cid) : null;
          if (!entry) continue;
          entry.intersecting = Boolean(io.isIntersecting);
          if (io.isIntersecting) {
            void ensureMounted(entry);
          }
        }
      }, { rootMargin: '140px 0px', threshold: 0.01 });
      state.observer = obs;
      wraps.forEach(w => obs.observe(w));

      const vh = window.innerHeight || 900;
      for (const entry of state.cards.values()) {
        const rect = entry.wrapEl.getBoundingClientRect?.();
        if (rect && rect.width > 0 && rect.height > 0 && rect.bottom >= -140 && rect.top <= vh + 140) {
          entry.intersecting = true;
          void ensureMounted(entry);
        }
      }
    } else {
      let mounted = 0;
      for (const entry of state.cards.values()) {
        if (mounted >= MAX_TWOSIDED_3D) break;
        entry.intersecting = true;
        mounted++;
        void ensureMounted(entry);
      }
    }

    // Pre-populate SVG fallbacks in background for off-screen / evicted cards
    for (const entry of state.cards.values()) {
      if (gen !== state.gen || token !== this._renderToken) return;
      if (!entry.caseObj) continue;
      try {
        const svg = await renderCaseSvg(puzzle, trackId, entry.caseObj);
        if (gen !== state.gen || token !== this._renderToken) return;
        entry.fallbackSvg = svg;
        if (!entry.displayEl && !entry.mountPromise && entry.wrapEl?.isConnected) {
          entry.wrapEl.innerHTML = svg;
        }
      } catch {}
    }
  }

  async populateGridVisuals(track, token = this._renderToken) {
    const puzzle = this.currentPuzzle;
    const trackId = this.currentTrackId;
    const visualEls = this.container.querySelectorAll('.study-card-visual');
    for (const el of visualEls) {
      if (token !== this._renderToken) return;
      const caseId = el.dataset.caseId;
      const c = track.caseById.get(caseId);
      if (!c) continue;
      try {
        const svg = await renderCaseSvg(puzzle, trackId, c);
        if (token === this._renderToken && this.currentPuzzle === puzzle && this.currentTrackId === trackId && (this.currentView === 'grid' || this.currentView === 'hybrid')) {
          el.innerHTML = svg;
        }
      } catch (err) {
        console.error("Failed to render visual for", caseId, err);
      }
    }
  }

  async populateDetailVisuals(track, c, token = this._renderToken) {
    const puzzle = this.currentPuzzle;
    const trackId = this.currentTrackId;
    const { algs, preferredAlg } = this.getPreferredAlgObj(track, c);
    const activeAlg = algs.find(a => a.id === this.previewAlgId) || preferredAlg || algs[0];
    const startAuf = activeAlg?.startAuf || "";
    const baseSetup = activeAlg?.mirroredSetup || c.setup || c.scramble || "";
    const setupWithAuf = `${baseSetup}${startAuf ? ' ' + startAuf : ''}`.trim();

    // 1. 2D Recognition Diagram (reflects exact starting AUF for the previewed alg)
    const diagramEl = this.container.querySelector('#studyDetailDiagram');
    if (diagramEl) {
      try {
        const diagramSetup = `${c.setup || c.scramble || ''}${startAuf ? ' ' + startAuf : ''}`.trim();
        const previewCase = startAuf
          ? { ...c, id: `${c.id}__auf_${startAuf.replace(/'/g, 'p').replace(/[^a-zA-Z0-9]/g, '_')}`, setup: diagramSetup }
          : c;
        const svg = await renderCaseSvg(puzzle, trackId, previewCase);
        if (token === this._renderToken && this.currentPuzzle === puzzle && this.currentTrackId === trackId && (this.currentView === 'detail' || this.currentView === 'hybrid') && this.selectedCaseId === c.id) {
          diagramEl.innerHTML = svg;
        }
      } catch (err) {
        console.error("Failed to render detail diagram:", err);
      }
    }

    if (token !== this._renderToken) return;

    // 2. 3D ScrambleDisplay Flashcard with Inline Mini Playback
    const wrapEl = this.container?.querySelector?.('#studyDetail3dWrap');
    if (wrapEl) {
      const normEvent = puzzle === "333oh" ? "333" : puzzle;
      const needsZ2 = ["lbl", "cll", "ortega", "eg1", "eg2", "f2l", "oll", "pll", "coll", "cmll", "wv", "parity"].includes(trackId);
      const rawSetup = (needsZ2 && setupWithAuf && !/^z2\b/i.test(setupWithAuf) ? `z2 ${setupWithAuf}` : setupWithAuf).trim();
      const parsedSetup = rawSetup ? parseScrambleInput(rawSetup) : { ok: false };
      const setupMoves = parsedSetup.ok ? parsedSetup.moves : (cleanAlg(rawSetup) ? cleanAlg(rawSetup).split(/\s+/).filter(Boolean) : []);
      const cleanSolution = cleanAlg(activeAlg?.alg || "");
      const parsedAlg = cleanSolution ? parseScrambleInput(cleanSolution) : { ok: false };
      const algMoves = parsedAlg.ok ? parsedAlg.moves : (cleanSolution ? cleanSolution.split(/\s+/).filter(Boolean) : []);
      const combinedMoves = [...setupMoves, ...algMoves];

      const lGen = ++this._miniLoadGen;
      this._miniSetupCount = setupMoves.length;
      this._miniAlgMoves = algMoves;
      this._miniCombinedMoves = combinedMoves;
      this._miniMoveCount = setupMoves.length;
      this._updateMiniProgress(setupMoves.length);
      this._updateMiniPlayingUi(false);

      const camLng = Number.isFinite(c?.cameraLongitude) ? c.cameraLongitude : 30;
      const canReuse = Boolean(
        this.activeDisplay3d &&
        wrapEl.contains(this.activeDisplay3d) &&
        this._miniMountedPuzzle === normEvent
      );

      try {
        let el = this.activeDisplay3d;
        const spd = Number(this.getSimSpeed ? this.getSimSpeed() : 1) || 1;
        if (!canReuse) {
          wrapEl.innerHTML = '';
          const SD = await getScrambleDisplay();
          if (!SD || token !== this._renderToken || lGen !== this._miniLoadGen) return;
          el = new SD();
          el.event = normEvent;
          el.visualization = "3D";
          const showRefl = this.getShowReflection ? this.getShowReflection() : true;
          el.hintFacelets = showRefl ? "floating" : "none";
          el.cameraLatitude = 35;
          el.cameraLongitude = camLng;
          el.scramble = combinedMoves.join(' ');
          if (el.player) {
            el.player.tempoScale = spd;
            el.player.cameraLatitude = 35;
            el.player.cameraLongitude = camLng;
          }
          wrapEl.appendChild(el);
          this.activeDisplay3d = el;
          this._miniMountedPuzzle = normEvent;
          this._miniIndexer = null;
        } else {
          el.player?.pause?.();
          this._miniIndexer = null;
          el.scramble = combinedMoves.join(' ');
          if (el.player) {
            el.player.tempoScale = spd;
            el.player.cameraLatitude = 35;
            el.player.cameraLongitude = camLng;
          }
        }

        this.applyReflection();
        applyColorsTo3DCube(el);
        this.syncPlaybackSpeed(spd);
        this._attachMiniPlayerListeners(el);
        this._bindMiniSimControls();

        const resetBtn = this.container?.querySelector?.('#studyReset3dBtn');
        if (resetBtn) {
          resetBtn.onclick = async () => {
            if (!this.activeDisplay3d || !this.activeDisplay3d.player) return;
            try {
              const p = await this.activeDisplay3d.player.experimentalCurrentThreeJSPuzzleObject?.();
              if (p) {
                p.quaternion.set(0, 0, 0, 1);
                p.rotation.set(0, 0, 0);
                p.scheduleRenderCallback?.();
              }
            } catch (e) {}
            try {
              this.activeDisplay3d.player.cameraLatitude = 35;
              this.activeDisplay3d.player.cameraLongitude = camLng;
              this.activeDisplay3d.player.cameraDistance = 6;
            } catch (e) {}
            try {
              if (this.activeDisplay3d.player.experimentalModel?.twistySceneModel?.orbitCoordinatesRequest) {
                this.activeDisplay3d.player.experimentalModel.twistySceneModel.orbitCoordinatesRequest.set("auto");
              }
            } catch (e) {}
          };
        }

        if (el?.player?.experimentalModel?.indexer) {
          this._miniPendingSeek = true;
          try {
            const idx = await el.player.experimentalModel.indexer.get();
            if (token !== this._renderToken || lGen !== this._miniLoadGen) return;
            this._miniIndexer = idx;
            this._seekMiniWithIndexer(el, idx, setupMoves.length);
          } catch {} finally {
            if (lGen === this._miniLoadGen) this._miniPendingSeek = false;
          }
        }
      } catch (err) {
        console.error("Failed to mount 3D ScrambleDisplay:", err);
        wrapEl.innerHTML = `<span class="study-visual-loading">3D view unavailable</span>`;
      }
    }
  }

  _updateMiniProgress(moveCount) {
    const setupCount = this._miniSetupCount;
    const total = this._miniCombinedMoves.length;
    const algTotal = this._miniAlgMoves.length;
    const clamped = Math.max(setupCount, Math.min(total, Number(moveCount) || 0));
    this._miniMoveCount = clamped;

    const statusEl = this.container?.querySelector?.('#studyMiniStepStatus');
    const startBtn = this.container?.querySelector?.('#studyMiniStartBtn');
    const prevBtn = this.container?.querySelector?.('#studyMiniPrevBtn');
    const nextBtn = this.container?.querySelector?.('#studyMiniNextBtn');
    const endBtn = this.container?.querySelector?.('#studyMiniEndBtn');

    if (startBtn) startBtn.disabled = clamped <= setupCount || algTotal === 0;
    if (prevBtn) prevBtn.disabled = clamped <= setupCount || algTotal === 0;
    if (nextBtn) nextBtn.disabled = clamped >= total || algTotal === 0;
    if (endBtn) endBtn.disabled = clamped >= total || algTotal === 0;

    if (statusEl) {
      if (algTotal === 0) {
        statusEl.textContent = 'No algorithm moves';
      } else if (clamped >= total) {
        statusEl.textContent = `Solved! · ${algTotal} / ${algTotal} moves`;
      } else if (clamped <= setupCount) {
        statusEl.textContent = `Ready · ${algTotal} move${algTotal === 1 ? '' : 's'}`;
      } else {
        const algStep = clamped - setupCount;
        const mv = this._miniAlgMoves[algStep - 1] || '';
        statusEl.textContent = `Move ${algStep} / ${algTotal}${mv ? `: ${mv}` : ''}`;
      }
    }

    const playBtn = this.container?.querySelector?.('#studyMiniPlayBtn');
    if (playBtn && !playBtn.classList.contains('is-playing')) {
      this._updateMiniPlayingUi(false);
    }
  }

  _updateMiniPlayingUi(playing) {
    const playBtn = this.container?.querySelector?.('#studyMiniPlayBtn');
    if (!playBtn) return;
    const algTotal = this._miniAlgMoves.length;
    playBtn.disabled = algTotal === 0;
    playBtn.classList.toggle('is-playing', Boolean(playing));
    if (playing) {
      playBtn.innerHTML = ICON_PAUSE;
      if (playBtn.dataset) playBtn.dataset.playState = 'pause';
      playBtn.setAttribute('aria-label', 'Pause algorithm');
    } else if (algTotal > 0 && this._miniMoveCount >= this._miniCombinedMoves.length) {
      playBtn.innerHTML = ICON_REPLAY;
      if (playBtn.dataset) playBtn.dataset.playState = 'replay';
      playBtn.setAttribute('aria-label', 'Replay algorithm');
    } else {
      playBtn.innerHTML = ICON_PLAY;
      if (playBtn.dataset) playBtn.dataset.playState = 'play';
      playBtn.setAttribute('aria-label', 'Play algorithm');
    }
  }

  _seekMiniWithIndexer(el, idx, targetCount) {
    const clamped = Math.max(this._miniSetupCount, Math.min(this._miniCombinedMoves.length, targetCount));
    if (clamped <= 0) {
      el.player.controller?.jumpToStart?.({ flash: false });
      this._updateMiniProgress(0);
      return;
    }
    if (clamped >= this._miniCombinedMoves.length) {
      el.player.controller?.jumpToEnd?.({ flash: false });
      this._updateMiniProgress(this._miniCombinedMoves.length);
      return;
    }
    const targetIdx = clamped - 1;
    const endTs = idx.indexToMoveStartTimestamp(targetIdx) + idx.moveDuration(targetIdx);
    el.player.experimentalModel.timestampRequest.set(endTs);
    this._updateMiniProgress(clamped);
  }

  async _jumpMiniToMoveCount(targetCount) {
    const el = this.activeDisplay3d;
    if (!el?.player) return;
    const clamped = Math.max(this._miniSetupCount, Math.min(this._miniCombinedMoves.length, targetCount));
    const lGen = this._miniLoadGen;
    this._miniPendingSeek = true;
    try {
      el.player.pause();
      if (!this._miniIndexer) {
        this._miniIndexer = await el.player.experimentalModel.indexer.get();
      }
      if (lGen !== this._miniLoadGen || this.activeDisplay3d !== el) return;
      this._seekMiniWithIndexer(el, this._miniIndexer, clamped);
    } catch {} finally {
      if (lGen === this._miniLoadGen) this._miniPendingSeek = false;
    }
  }

  _attachMiniPlayerListeners(el) {
    if (!el?.player?.experimentalModel || this._miniListenersEl === el) return;
    this._miniListenersEl = el;
    try {
      el.player.experimentalModel.indexer.addFreshListener((idx) => {
        if (this.activeDisplay3d === el) this._miniIndexer = idx;
      });
      el.player.experimentalModel.detailedTimelineInfo.addFreshListener((info) => {
        if (this.activeDisplay3d !== el || this._miniPendingSeek || !this._miniIndexer || this._miniCombinedMoves.length === 0) return;
        try {
          if (info.atStart || info.timestamp <= 0) {
            if (this._miniSetupCount > 0) {
              void this._jumpMiniToMoveCount(this._miniSetupCount);
            } else {
              this._updateMiniProgress(0);
            }
            return;
          }
          if (info.atEnd) {
            this._updateMiniProgress(this._miniCombinedMoves.length);
            return;
          }
          const mIdx = this._miniIndexer.timestampToIndex(info.timestamp);
          const nextCount = mIdx + 1;
          if (nextCount < this._miniSetupCount) {
            void this._jumpMiniToMoveCount(this._miniSetupCount);
            return;
          }
          this._updateMiniProgress(nextCount);
        } catch {}
      });
      el.player.experimentalModel.coarseTimelineInfo.addFreshListener((info) => {
        if (this.activeDisplay3d !== el) return;
        this._updateMiniPlayingUi(Boolean(info.playing));
      });
    } catch {}
  }

  _bindMiniSimControls() {
    const startBtn = this.container?.querySelector?.('#studyMiniStartBtn');
    const prevBtn = this.container?.querySelector?.('#studyMiniPrevBtn');
    const playBtn = this.container?.querySelector?.('#studyMiniPlayBtn');
    const nextBtn = this.container?.querySelector?.('#studyMiniNextBtn');
    const endBtn = this.container?.querySelector?.('#studyMiniEndBtn');
    const speedBtn = this.container?.querySelector?.('#studyMiniSpeedBtn');

    if (startBtn) startBtn.onclick = () => void this._jumpMiniToMoveCount(this._miniSetupCount);
    if (prevBtn) {
      prevBtn.onclick = () => {
        const el = this.activeDisplay3d;
        if (!el?.player?.controller || this._miniMoveCount <= this._miniSetupCount) return;
        if (this._miniMoveCount <= this._miniSetupCount + 1) {
          void this._jumpMiniToMoveCount(this._miniSetupCount);
          return;
        }
        try {
          el.player.pause();
          el.player.controller.animationController.play({ direction: -1, untilBoundary: "move" });
        } catch {}
      };
    }
    if (playBtn) {
      playBtn.onclick = () => {
        const el = this.activeDisplay3d;
        if (!el?.player?.controller || this._miniAlgMoves.length === 0) return;
        if (this._miniMoveCount >= this._miniCombinedMoves.length) {
          void this._jumpMiniToMoveCount(this._miniSetupCount).then(() => {
            setTimeout(() => { try { this.activeDisplay3d?.player?.play?.(); } catch {} }, 40);
          });
          return;
        }
        if (this._miniMoveCount < this._miniSetupCount) {
          void this._jumpMiniToMoveCount(this._miniSetupCount).then(() => {
            setTimeout(() => { try { this.activeDisplay3d?.player?.play?.(); } catch {} }, 40);
          });
          return;
        }
        try { el.player.controller.togglePlay(); } catch {}
      };
    }
    if (nextBtn) {
      nextBtn.onclick = () => {
        const el = this.activeDisplay3d;
        if (!el?.player?.controller || this._miniMoveCount >= this._miniCombinedMoves.length) return;
        try {
          el.player.pause();
          el.player.controller.animationController.play({ direction: 1, untilBoundary: "move" });
        } catch {}
      };
    }
    if (endBtn) endBtn.onclick = () => void this._jumpMiniToMoveCount(this._miniCombinedMoves.length);
    if (speedBtn) {
      speedBtn.onclick = () => {
        const current = Number(this.getSimSpeed ? this.getSimSpeed() : 1) || 1;
        const idx = SIM_SPEED_OPTIONS.indexOf(current);
        const next = SIM_SPEED_OPTIONS[(idx + 1) % SIM_SPEED_OPTIONS.length];
        this.syncPlaybackSpeed(next);
        this.onSetSimSpeed?.(next);
      };
    }
  }

  applyReflection() {
    const el = this.activeDisplay3d;
    if (!el) return;
    const showRefl = this.getShowReflection ? this.getShowReflection() : true;
    const modeVal = showRefl ? "floating" : "none";
    try {
      el.hintFacelets = modeVal;
      if (el.player) {
        el.player.hintFacelets = modeVal;
        el.player.experimentalCurrentThreeJSPuzzleObject?.().then(p => {
          if (p && typeof p.updateMaterialArrays === "function") {
            p.updateMaterialArrays();
            p.scheduleRenderCallback?.();
          }
          applyColorsTo3DCube(el);
        }).catch(() => {});
      }
    } catch (err) {
      console.warn("Could not update study 3D reflection facelets:", err);
    }
  }
}
