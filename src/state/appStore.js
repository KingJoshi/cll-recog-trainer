// Centralized App Store & Backward-Compatible Persistence
// Preserves all existing localStorage/sessionStorage/cookie keys without data loss.

import { PUZZLES, getTrack, getDefaultTrack, getSolveTargetLabel } from '../data/algRegistry.js';
import { cllCases } from '../data/cllData.js';
import { DEFAULT_CUBE_COLORS, CUBE_COLORS, setCustomCubeColors, applyCubeColorsToCss } from '../caseVisualizer.js';
import {
  readStorageJSON,
  writeStorageJSON,
  readSessionStorageJSON,
  writeSessionStorageJSON,
  readCookieJSON,
  writeCookieJSON
} from './storage.js';
import {
  loadSessions,
  saveSessions,
  getActiveSessionId,
  setActiveSessionId,
  resolveSessionForTarget,
  splitSessionByTarget
} from './sessionStore.js';

export const STORAGE_KEYS = {
  STATS: "cllTrainerStats",
  SETTINGS: "cllTrainerSettings",
  SOLVES: "cllTrainerSolves",
  LAYER_SOLVES: "cllTrainerLayerSolves",
  APPEARANCES: "cllTrainerAppearances",
  CASE_TAGS: "cllTrainerCaseTags",
  CUSTOM_LABELS: "cllTrainerCustomLabels",
  PBL_SETTINGS: "cllTrainerPblSettings",
  SESSIONS: "cllTrainerSessions",
  UI_COOKIE: "cll_ui_prefs"
};

export const VALID_PUZZLES = ["222", "333", "333oh", "444", "555"];
export const MODES = ["study", "practice", "solve", "simulate"];
export const LOG_PAGE_SIZE_OPTIONS = [5, 12, 25, 50, 100];
export const SIM_SPEED_OPTIONS = [0.25, 0.5, 1, 1.5, 2];
export const MAX_SOLVES = Infinity;
export const MAX_DISPLAY_SOLVES = 10000;

export const GROUPS = ["A", "H", "L", "P", "S", "T", "U"];
export const GROUP_DISPLAY_ORDER = ["H", "P", "U", "T", "L", "S", "A"];
export const GROUP_NAMES = { A: "Anti-Sune", H: "H", L: "L", P: "Pi", S: "Sune", T: "T", U: "U" };

export const normalizedCllList = cllCases.map(c => {
  const defaultAlgObj = c.algs?.[0] || {};
  return {
    ...c,
    shortGroup: c.group ? c.group.replace(/-Group$/, "") : c.id[0],
    group: c.group ? c.group.replace(/-Group$/, "") : c.id[0],
    fullGroup: c.group,
    scramble: c.setup,
    solution: defaultAlgObj.note || defaultAlgObj.alg || "",
    solutionAlg: defaultAlgObj.alg || "",
    alg: defaultAlgObj.alg || "",
    computerSolution: defaultAlgObj.alg || ""
  };
});

export const casesByGroup = Object.fromEntries(
  GROUPS.map(g => [g, normalizedCllList.filter(c => c.group === g)])
);
export const caseById = new Map(normalizedCllList.map(c => [c.id, c]));
export const CASE_IDS = GROUP_DISPLAY_ORDER.flatMap(g => casesByGroup[g].map(c => c.id));

function trackSelectionKey(puzzleId, trackId) {
  return `${puzzleId}:${trackId}`;
}

export function sanitizeHexColor(val) {
  return typeof val === "string" && /^#[0-9a-fA-F]{6}$/.test(val) ? val.toLowerCase() : null;
}

export class AppStore {
  constructor() {
    this.listeners = new Set();
    this._isHydrating = false;

    const cookiePrefs = readCookieJSON(STORAGE_KEYS.UI_COOKIE, {}) || {};
    const rawSettings = readStorageJSON(STORAGE_KEYS.SETTINGS, null);
    const hasExistingSettings = Boolean(rawSettings && typeof rawSettings === "object" && Object.keys(rawSettings).length > 0);
    const savedSettings = { ...cookiePrefs, ...(rawSettings || {}) };

    // Colors
    if (savedSettings.customColors && typeof savedSettings.customColors === "object") {
      const sanitizedColors = {};
      for (const [k, v] of Object.entries(savedSettings.customColors)) {
        const clean = sanitizeHexColor(v);
        if (clean) sanitizedColors[k] = clean;
      }
      if (Object.keys(sanitizedColors).length > 0) {
        setCustomCubeColors(sanitizedColors);
        applyCubeColorsToCss(sanitizedColors);
      } else {
        applyCubeColorsToCss(DEFAULT_CUBE_COLORS);
      }
    } else {
      applyCubeColorsToCss(DEFAULT_CUBE_COLORS);
    }

    // Navigation & puzzle/track
    let currentPuzzle = VALID_PUZZLES.includes(savedSettings.currentPuzzle) ? savedSettings.currentPuzzle : "222";
    let currentTrackId = savedSettings.currentTrackId || getDefaultTrack(currentPuzzle)?.id || "cll";
    let mode = MODES.includes(savedSettings.mode)
      ? savedSettings.mode
      : (savedSettings.mode === "timed" ? "practice" : "solve");

    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const urlPuz = urlParams.get("puzzle");
      if (urlPuz && VALID_PUZZLES.includes(urlPuz)) currentPuzzle = urlPuz;
      if (urlParams.has("track")) currentTrackId = urlParams.get("track") || currentTrackId;
      const urlMode = urlParams.get("mode");
      if (urlMode && MODES.includes(urlMode)) mode = urlMode;
      else if (urlMode === "timed") mode = "practice";
    }

    if (!getTrack(currentPuzzle, currentTrackId)) {
      currentTrackId = getDefaultTrack(currentPuzzle)?.id || "cll";
    }

    // Per-track case selections (with lossless migration from legacy flat `selected`)
    const selectedByTrack = {};
    if (savedSettings.selectedByTrack && typeof savedSettings.selectedByTrack === "object") {
      for (const [k, arr] of Object.entries(savedSettings.selectedByTrack)) {
        if (Array.isArray(arr)) selectedByTrack[k] = arr.filter(id => typeof id === "string");
      }
    }
    if (!selectedByTrack["222:cll"] && Array.isArray(savedSettings.selected)) {
      selectedByTrack["222:cll"] = savedSettings.selected.filter(id => caseById.has(id));
    }

    // Sessions
    const sessions = loadSessions();
    const hasRecordedSolves = sessions.some(s => Array.isArray(s.solves) && s.solves.length > 0);
    const savedActiveSession = savedSettings.activeSessionId || getActiveSessionId() || sessions[0].id;
    const activeSessionId = sessions.some(s => s.id === savedActiveSession) ? savedActiveSession : sessions[0].id;
    const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0];

    let solveTarget = activeSession.target || savedSettings.solveTarget || "full";
    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.has("target")) {
        solveTarget = urlParams.get("target") || solveTarget;
      } else if (urlParams.has("track") && ["pll", "oll", "f2l", "cross", "layer", "face", "lbl", "cll", "eg1", "eg2"].includes(urlParams.get("track"))) {
        solveTarget = urlParams.get("track");
      }
    }

    const ohHand = savedSettings.ohHand === "right" ? "right" : (cookiePrefs.ohHand === "right" ? "right" : "left");
    const ohTableAbuse = savedSettings.ohTableAbuse !== undefined
      ? Boolean(savedSettings.ohTableAbuse)
      : (cookiePrefs.ohTableAbuse !== undefined ? Boolean(cookiePrefs.ohTableAbuse) : true);
    const rawSimSpeed = Number(savedSettings.simSpeed ?? cookiePrefs.simSpeed);
    const simSpeed = SIM_SPEED_OPTIONS.includes(rawSimSpeed) ? rawSimSpeed : 1;

    this.state = {
      currentPuzzle,
      currentTrackId,
      mode,
      ohHand,
      ohTableAbuse,
      simSpeed,
      selectedByTrack,
      selectedCases: new Set(),
      alwaysWhiteBottom: savedSettings.alwaysWhiteBottom ?? true,
      allowAUF: savedSettings.allowAUF ?? true,
      showReflection: savedSettings.showReflection ?? true,
      darkMode: savedSettings.darkMode ?? false,
      showTooltips: savedSettings.showTooltips ?? cookiePrefs.showTooltips ?? true,
      onboardingCompleted: savedSettings.onboardingCompleted ?? cookiePrefs.onboardingCompleted ?? (hasExistingSettings || hasRecordedSolves),
      onboardingProfile: savedSettings.onboardingProfile || null,
      settingsCollapsed: savedSettings.casesCollapsed ?? savedSettings.settingsCollapsed ?? true,
      statsCollapsed: savedSettings.statsCollapsed ?? cookiePrefs.statsCollapsed ?? false,
      freeMovesOpen: savedSettings.freeMovesOpen ?? cookiePrefs.freeMovesOpen ?? false,
      layerSolutionsOpen: savedSettings.layerSolutionsOpen ?? cookiePrefs.layerSolutionsOpen ?? false,
      crossSolutionsOpen: savedSettings.crossSolutionsOpen ?? cookiePrefs.crossSolutionsOpen ?? false,
      solveLogOpen: savedSettings.solveLogOpen ?? cookiePrefs.solveLogOpen ?? true,
      cfopSummaryOpen: savedSettings.cfopSummaryOpen ?? cookiePrefs.cfopSummaryOpen ?? true,
      ollCasesStatsOpen: savedSettings.ollCasesStatsOpen ?? cookiePrefs.ollCasesStatsOpen ?? true,
      pllCasesStatsOpen: savedSettings.pllCasesStatsOpen ?? cookiePrefs.pllCasesStatsOpen ?? true,
      timerDrillPreset: savedSettings.timerDrillPreset || "righty-inv",
      layerTargetFaces: Array.isArray(savedSettings.layerTargetFaces) && savedSettings.layerTargetFaces.length
        ? savedSettings.layerTargetFaces
        : ["white"],
      crossTargetFaces: Array.isArray(savedSettings.crossTargetFaces) && savedSettings.crossTargetFaces.length
        ? savedSettings.crossTargetFaces
        : ["white"],
      statsType: (savedSettings.statsType === "recog" || savedSettings.statsType === "cll")
        ? savedSettings.statsType
        : "log",
      caseTagMode: false,
      currentTagFilter: "all",
      sessionLogPageSize: LOG_PAGE_SIZE_OPTIONS.includes(Number(savedSettings.sessionLogPageSize))
        ? Number(savedSettings.sessionLogPageSize)
        : 12,
      sessionLogPage: 1,
      sessions,
      activeSessionId,
      solveTarget,
      solveShowCube: activeSession.showCube ?? true,
      solveInspection: activeSession.inspection ?? true,
      stats: readStorageJSON(STORAGE_KEYS.STATS, {}) || {},
      caseTags: readStorageJSON(STORAGE_KEYS.CASE_TAGS, {}) || {},
      customCllLabels: readStorageJSON(STORAGE_KEYS.CUSTOM_LABELS, {}) || {},
      pblSettings: readStorageJSON(STORAGE_KEYS.PBL_SETTINGS, {}) || {},
      caseAppearances: readSessionStorageJSON(STORAGE_KEYS.APPEARANCES, {}) || {},
      // Live scramble & case context
      currentCaseId: null,
      currentCaseScramble: null,
      scramble: "",
      scrambleMoves: "",
      currentSolveScramble: "",
      lastSolve: activeSession.solves?.length ? activeSession.solves[activeSession.solves.length - 1] : null
    };

    this.loadTrackSelection(currentPuzzle, currentTrackId);
  }

  subscribe(listener) {
    if (typeof listener === "function") this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify(event = "change", detail = {}) {
    for (const cb of this.listeners) {
      try { cb(event, detail, this.state); } catch {}
    }
  }

  _emitPersist(section, detail = {}) {
    if (this._isHydrating) return;
    this.notify("persist", { section, ...detail });
  }

  getActiveSession() {
    return this.state.sessions.find(s => s.id === this.state.activeSessionId) || this.state.sessions[0];
  }

  getSolves() {
    return this.getActiveSession().solves || [];
  }

  setSolves(nextSolves) {
    const sess = this.getActiveSession();
    sess.solves = nextSolves;
    this.saveSessions({ silent: true });
    writeStorageJSON(STORAGE_KEYS.SOLVES, Array.isArray(nextSolves) ? nextSolves.slice(-200) : []);
    this._emitPersist("solves", { sessionId: sess.id });
  }

  saveSessions({ silent = false } = {}) {
    saveSessions(this.state.sessions);
    setActiveSessionId(this.state.activeSessionId);
    if (!silent) this._emitPersist("sessions");
  }

  selectOrCreateSessionForTarget(targetId) {
    const s = this.state;
    const puzzle = s.currentPuzzle || "222";
    const target = targetId || "full";
    const puzzleShortName = PUZZLES[puzzle]?.shortName || puzzle;
    const targetLabel = getSolveTargetLabel(puzzle, target);
    const result = resolveSessionForTarget(
      s.sessions,
      s.activeSessionId,
      puzzle,
      target,
      { puzzleShortName, targetLabel }
    );
    if (result.action === "created") {
      s.sessions.push(result.session);
    }
    const sess = result.session;
    s.activeSessionId = sess.id;
    s.solveTarget = target;
    s.solveShowCube = sess.showCube ?? true;
    s.solveInspection = sess.inspection ?? true;
    s.sessionLogPage = 1;
    const solves = Array.isArray(sess.solves) ? sess.solves : [];
    s.lastSolve = solves.length ? solves[solves.length - 1] : null;
    this.saveSessions();
    this.saveSettings();
    return result;
  }

  splitSessionByTarget(sessionId = this.state.activeSessionId) {
    const s = this.state;
    const sess = s.sessions.find(item => item.id === sessionId);
    if (!sess) return { canSplit: false, movedCount: 0, destinations: [], createdSessions: [] };
    const puzzle = sess.puzzle || s.currentPuzzle || "222";
    const puzzleShortName = PUZZLES[puzzle]?.shortName || puzzle;
    const result = splitSessionByTarget(s.sessions, sessionId, {
      puzzleShortName,
      getTargetLabel: (t) => getSolveTargetLabel(puzzle, t)
    });
    if (!result.canSplit) return result;
    if (result.createdSessions.length > 0) {
      s.sessions.push(...result.createdSessions);
    }
    const activeSess = this.getActiveSession();
    if (activeSess) {
      s.solveTarget = activeSess.target || "full";
      const solves = Array.isArray(activeSess.solves) ? activeSess.solves : [];
      s.lastSolve = solves.length ? solves[solves.length - 1] : null;
      s.sessionLogPage = 1;
    }
    this.saveSessions();
    this.saveSettings();
    return result;
  }

  getLayerSession() {
    return this.state.sessions.find(s => s.id === "layer") || this.getActiveSession();
  }

  getLayerSolves() {
    return this.getLayerSession().solves || [];
  }

  saveLayerSolves(nextLayerSolves) {
    const sess = this.state.sessions.find(s => s.id === "layer");
    if (sess) {
      sess.solves = nextLayerSolves;
      this.saveSessions({ silent: true });
    }
    writeStorageJSON(STORAGE_KEYS.LAYER_SOLVES, nextLayerSolves);
    this._emitPersist("layerSolves");
  }

  loadTrackSelection(puzzleId = this.state.currentPuzzle, trackId = this.state.currentTrackId) {
    const track = getTrack(puzzleId, trackId);
    if (!track || !track.cases || track.cases.length === 0) {
      this.state.selectedCases = new Set();
      return;
    }
    const validIds = new Set(track.cases.map(c => c.id));
    const key = trackSelectionKey(puzzleId, trackId);
    const saved = this.state.selectedByTrack[key];
    if (Array.isArray(saved)) {
      const filtered = saved.filter(id => validIds.has(id));
      // Allow intentional empty selection if user cleared all, unless key has never been initialized
      this.state.selectedCases = new Set(filtered);
    } else {
      const allIds = [...validIds];
      this.state.selectedByTrack[key] = allIds;
      this.state.selectedCases = new Set(allIds);
    }
  }

  setSelection(nextSet, { persist = true } = {}) {
    const track = getTrack(this.state.currentPuzzle, this.state.currentTrackId);
    const validIds = track?.cases?.length ? new Set(track.cases.map(c => c.id)) : null;
    const arr = [...nextSet].filter(id => !validIds || validIds.has(id));
    this.state.selectedCases = new Set(arr);
    const key = trackSelectionKey(this.state.currentPuzzle, this.state.currentTrackId);
    this.state.selectedByTrack[key] = arr;
    if (persist) this.saveSettings();
    this.notify("selection", { selectedCases: this.state.selectedCases });
  }

  ensureTrackSelection() {
    const track = getTrack(this.state.currentPuzzle, this.state.currentTrackId);
    if (!track || !track.cases || track.cases.length === 0) return;
    const trackIds = new Set(track.cases.map(c => c.id));
    const hasAny = [...this.state.selectedCases].some(id => trackIds.has(id));
    if (!hasAny) {
      this.setSelection(trackIds);
    }
  }

  saveCaseAppearances() {
    writeSessionStorageJSON(STORAGE_KEYS.APPEARANCES, this.state.caseAppearances);
  }

  resetCaseAppearances() {
    this.state.caseAppearances = {};
    this.saveCaseAppearances();
  }

  saveCaseTags() {
    writeStorageJSON(STORAGE_KEYS.CASE_TAGS, this.state.caseTags);
    this._emitPersist("caseTags");
  }

  getCaseTag(caseId) {
    return this.state.caseTags[caseId] || "none";
  }

  setCaseTag(caseId, tag) {
    if (!["none", "learning", "review", "mastered"].includes(tag)) return;
    if (tag === "none") delete this.state.caseTags[caseId];
    else this.state.caseTags[caseId] = tag;
    this.saveCaseTags();
    this.notify("casetag", { caseId, tag });
  }

  cycleCaseTag(caseId) {
    const cur = this.getCaseTag(caseId);
    const next = cur === "none" ? "learning" : cur === "learning" ? "review" : cur === "review" ? "mastered" : "none";
    this.setCaseTag(caseId, next);
  }

  saveCustomCllLabels() {
    writeStorageJSON(STORAGE_KEYS.CUSTOM_LABELS, this.state.customCllLabels);
    this._emitPersist("customLabels");
  }

  getCllCaseSolutionDisplay(caseObj) {
    if (!caseObj) return "";
    return this.state.customCllLabels[caseObj.id] || caseObj.solution || caseObj.algs?.[0]?.note || caseObj.solutionAlg || caseObj.algs?.[0]?.alg || "";
  }

  setCllCaseSolutionDisplay(caseId, customLabel) {
    if (!customLabel || customLabel.trim() === "") {
      delete this.state.customCllLabels[caseId];
    } else {
      this.state.customCllLabels[caseId] = customLabel.trim();
    }
    this.saveCustomCllLabels();
    this.notify("customlabel", { caseId });
  }

  savePblSettings() {
    writeStorageJSON(STORAGE_KEYS.PBL_SETTINGS, this.state.pblSettings);
    this._emitPersist("pblSettings");
  }

  getPblCaseSelectedAlg(caseObj) {
    const cleanId = String(caseObj?.id || "").replace(/^ortega-pbl-/, "");
    const caseSetting = this.state.pblSettings[caseObj.id] || this.state.pblSettings[cleanId];
    if (caseSetting && caseSetting.selectedAlgId) {
      const found = (caseObj.algs || []).find(a => a.id === caseSetting.selectedAlgId);
      if (found) return found;
    }
    return caseObj.algs?.[0];
  }

  getPblAlgDisplayLabel(caseId, algObj) {
    const cleanId = String(caseId || "").replace(/^ortega-pbl-/, "");
    const custom = this.state.pblSettings[caseId]?.customLabels?.[algObj.id]
      || this.state.pblSettings[cleanId]?.customLabels?.[algObj.id]
      || this.state.customCllLabels[`${caseId}:${algObj.id}`]
      || this.state.customCllLabels[`${cleanId}:${algObj.id}`];
    return custom || algObj.label || algObj.note || algObj.alg;
  }

  saveStats({ silent = false } = {}) {
    writeStorageJSON(STORAGE_KEYS.STATS, this.state.stats);
    if (!silent) this._emitPersist("stats");
  }

  getCaseStat(puzzle = this.state.currentPuzzle, trackId = this.state.currentTrackId, caseId) {
    if (!this.state.stats) return { shown: 0, correct: 0 };
    if (this.state.stats[puzzle]?.[trackId]?.[caseId]) {
      return this.state.stats[puzzle][trackId][caseId];
    }
    if (this.state.stats[caseId] && typeof this.state.stats[caseId].shown === "number") {
      return this.state.stats[caseId];
    }
    return { shown: 0, correct: 0 };
  }

  recordCaseStat(puzzle = this.state.currentPuzzle, trackId = this.state.currentTrackId, caseId, isCorrect) {
    if (!caseId) return;
    const stats = this.state.stats || (this.state.stats = {});
    if (!stats[puzzle]) stats[puzzle] = {};
    if (!stats[puzzle][trackId]) stats[puzzle][trackId] = {};
    if (!stats[puzzle][trackId][caseId]) {
      const existing = this.getCaseStat(puzzle, trackId, caseId);
      stats[puzzle][trackId][caseId] = { shown: existing.shown, correct: existing.correct };
    }
    const entry = stats[puzzle][trackId][caseId];
    entry.shown++;
    if (isCorrect) entry.correct++;
    if (puzzle === "222" && trackId === "cll") {
      stats[caseId] = { shown: entry.shown, correct: entry.correct };
    }
    this.saveStats();
  }

  resetRecognitionStats(puzzle = this.state.currentPuzzle, trackId = this.state.currentTrackId) {
    if (!this.state.stats) return;
    if (this.state.stats[puzzle]?.[trackId]) {
      delete this.state.stats[puzzle][trackId];
    }
    if (puzzle === "222" && trackId === "cll") {
      CASE_IDS.forEach(id => delete this.state.stats[id]);
    }
    this.resetCaseAppearances();
    this.saveStats({ silent: true });
    this._emitPersist("resetStats", { puzzle, trackId });
  }

  setOhHand(hand) {
    const next = hand === "right" ? "right" : "left";
    if (this.state.ohHand === next) return;
    this.state.ohHand = next;
    this.saveSettings();
    this.notify("ohHand", { ohHand: next });
  }

  setOhTableAbuse(enabled) {
    const next = Boolean(enabled);
    if (this.state.ohTableAbuse === next) return;
    this.state.ohTableAbuse = next;
    this.saveSettings();
    this.notify("ohTableAbuse", { ohTableAbuse: next });
  }

  setSimSpeed(speed) {
    const next = Number(speed);
    if (!SIM_SPEED_OPTIONS.includes(next) || this.state.simSpeed === next) return;
    this.state.simSpeed = next;
    this.saveSettings();
    this.notify("simSpeed", { simSpeed: next });
  }

  getSettingsPayload() {
    const s = this.state;
    const cllSel = s.selectedByTrack["222:cll"] || [];
    return {
      currentPuzzle: s.currentPuzzle,
      currentTrackId: s.currentTrackId,
      ohHand: s.ohHand,
      ohTableAbuse: s.ohTableAbuse,
      simSpeed: s.simSpeed,
      selected: cllSel,
      selectedByTrack: s.selectedByTrack,
      alwaysWhiteBottom: s.alwaysWhiteBottom,
      allowAUF: s.allowAUF,
      showReflection: s.showReflection,
      darkMode: s.darkMode,
      showTooltips: s.showTooltips,
      onboardingCompleted: s.onboardingCompleted,
      onboardingProfile: s.onboardingProfile,
      mode: s.mode,
      casesCollapsed: s.settingsCollapsed,
      settingsCollapsed: s.settingsCollapsed,
      statsCollapsed: s.statsCollapsed,
      freeMovesOpen: s.freeMovesOpen,
      layerSolutionsOpen: s.layerSolutionsOpen,
      crossSolutionsOpen: s.crossSolutionsOpen,
      solveLogOpen: s.solveLogOpen,
      cfopSummaryOpen: s.cfopSummaryOpen,
      ollCasesStatsOpen: s.ollCasesStatsOpen,
      pllCasesStatsOpen: s.pllCasesStatsOpen,
      timerDrillPreset: s.timerDrillPreset,
      statsType: s.statsType,
      layerTargetFaces: s.layerTargetFaces,
      crossTargetFaces: s.crossTargetFaces,
      activeSessionId: s.activeSessionId,
      solveTarget: s.solveTarget,
      solveShowCube: s.solveShowCube,
      solveInspection: s.solveInspection,
      sessionLogPageSize: s.sessionLogPageSize,
      customColors: { ...CUBE_COLORS }
    };
  }

  saveSettings() {
    const s = this.state;
    const payload = this.getSettingsPayload();
    writeStorageJSON(STORAGE_KEYS.SETTINGS, payload);
    writeCookieJSON(STORAGE_KEYS.UI_COOKIE, {
      currentPuzzle: s.currentPuzzle,
      currentTrackId: s.currentTrackId,
      ohHand: s.ohHand,
      ohTableAbuse: s.ohTableAbuse,
      simSpeed: s.simSpeed,
      mode: s.mode,
      darkMode: s.darkMode,
      showTooltips: s.showTooltips,
      onboardingCompleted: s.onboardingCompleted,
      alwaysWhiteBottom: s.alwaysWhiteBottom,
      allowAUF: s.allowAUF,
      showReflection: s.showReflection,
      casesCollapsed: s.settingsCollapsed,
      statsCollapsed: s.statsCollapsed,
      freeMovesOpen: s.freeMovesOpen,
      layerSolutionsOpen: s.layerSolutionsOpen,
      crossSolutionsOpen: s.crossSolutionsOpen,
      solveLogOpen: s.solveLogOpen,
      cfopSummaryOpen: s.cfopSummaryOpen,
      ollCasesStatsOpen: s.ollCasesStatsOpen,
      pllCasesStatsOpen: s.pllCasesStatsOpen,
      timerDrillPreset: s.timerDrillPreset,
      layerTargetFaces: s.layerTargetFaces,
      crossTargetFaces: s.crossTargetFaces
    });
    this._emitPersist("settings", { payload });
  }

  hydrateFromSync(mergedPayload) {
    if (!mergedPayload || typeof mergedPayload !== "object") return;
    this.lastHydratePrev = {
      puzzle: this.state.currentPuzzle,
      trackId: this.state.currentTrackId,
      mode: this.state.mode,
      solveTarget: this.state.solveTarget
    };
    this._isHydrating = true;
    try {
      const savedSettings = mergedPayload.settings && typeof mergedPayload.settings === "object"
        ? mergedPayload.settings
        : {};

      const nextColors = { ...DEFAULT_CUBE_COLORS };
      if (savedSettings.customColors && typeof savedSettings.customColors === "object") {
        for (const [k, v] of Object.entries(savedSettings.customColors)) {
          const clean = sanitizeHexColor(v);
          if (clean) nextColors[k] = clean;
        }
      }
      setCustomCubeColors(nextColors);
      applyCubeColorsToCss(CUBE_COLORS);

      let currentPuzzle = VALID_PUZZLES.includes(savedSettings.currentPuzzle)
        ? savedSettings.currentPuzzle
        : this.state.currentPuzzle;
      let currentTrackId = savedSettings.currentTrackId || getDefaultTrack(currentPuzzle)?.id || "cll";
      if (!getTrack(currentPuzzle, currentTrackId)) {
        currentTrackId = getDefaultTrack(currentPuzzle)?.id || "cll";
      }
      const mode = MODES.includes(savedSettings.mode)
        ? savedSettings.mode
        : (savedSettings.mode === "timed" ? "practice" : this.state.mode);

      const selectedByTrack = {};
      if (savedSettings.selectedByTrack && typeof savedSettings.selectedByTrack === "object") {
        for (const [k, arr] of Object.entries(savedSettings.selectedByTrack)) {
          if (Array.isArray(arr)) selectedByTrack[k] = arr.filter(id => typeof id === "string");
        }
      }
      if (!selectedByTrack["222:cll"] && Array.isArray(savedSettings.selected)) {
        selectedByTrack["222:cll"] = savedSettings.selected.filter(id => caseById.has(id));
      }

      const incomingSessions = Array.isArray(mergedPayload.sessions) && mergedPayload.sessions.length > 0
        ? JSON.parse(JSON.stringify(mergedPayload.sessions))
        : this.state.sessions;

      const desiredActiveId = savedSettings.activeSessionId || this.state.activeSessionId;
      const activeSessionId = incomingSessions.some(s => s.id === desiredActiveId)
        ? desiredActiveId
        : (incomingSessions.find(s => (s.puzzle || "222") === currentPuzzle)?.id || incomingSessions[0].id);
      const activeSession = incomingSessions.find(s => s.id === activeSessionId) || incomingSessions[0];

      const rawSimSpeed = Number(savedSettings.simSpeed);
      const simSpeed = SIM_SPEED_OPTIONS.includes(rawSimSpeed) ? rawSimSpeed : 1;

      const s = this.state;
      s.currentPuzzle = currentPuzzle;
      s.currentTrackId = currentTrackId;
      s.mode = mode;
      s.ohHand = savedSettings.ohHand === "right" ? "right" : "left";
      s.ohTableAbuse = savedSettings.ohTableAbuse !== undefined ? Boolean(savedSettings.ohTableAbuse) : true;
      s.simSpeed = simSpeed;
      s.selectedByTrack = selectedByTrack;
      s.alwaysWhiteBottom = savedSettings.alwaysWhiteBottom ?? true;
      s.allowAUF = savedSettings.allowAUF ?? true;
      s.showReflection = savedSettings.showReflection ?? true;
      s.darkMode = savedSettings.darkMode ?? false;
      s.showTooltips = savedSettings.showTooltips ?? true;
      s.onboardingCompleted = savedSettings.onboardingCompleted ?? s.onboardingCompleted;
      s.onboardingProfile = savedSettings.onboardingProfile ? JSON.parse(JSON.stringify(savedSettings.onboardingProfile)) : null;
      s.settingsCollapsed = savedSettings.settingsCollapsed ?? savedSettings.casesCollapsed ?? true;
      s.statsCollapsed = savedSettings.statsCollapsed ?? false;
      s.freeMovesOpen = savedSettings.freeMovesOpen ?? false;
      s.layerSolutionsOpen = savedSettings.layerSolutionsOpen ?? false;
      s.crossSolutionsOpen = savedSettings.crossSolutionsOpen ?? false;
      s.solveLogOpen = savedSettings.solveLogOpen ?? true;
      s.cfopSummaryOpen = savedSettings.cfopSummaryOpen ?? true;
      s.ollCasesStatsOpen = savedSettings.ollCasesStatsOpen ?? true;
      s.pllCasesStatsOpen = savedSettings.pllCasesStatsOpen ?? true;
      s.timerDrillPreset = savedSettings.timerDrillPreset || "righty-inv";
      s.layerTargetFaces = Array.isArray(savedSettings.layerTargetFaces) && savedSettings.layerTargetFaces.length
        ? [...savedSettings.layerTargetFaces]
        : ["white"];
      s.crossTargetFaces = Array.isArray(savedSettings.crossTargetFaces) && savedSettings.crossTargetFaces.length
        ? [...savedSettings.crossTargetFaces]
        : ["white"];
      s.statsType = (savedSettings.statsType === "recog" || savedSettings.statsType === "cll")
        ? savedSettings.statsType
        : "log";
      s.sessionLogPageSize = LOG_PAGE_SIZE_OPTIONS.includes(Number(savedSettings.sessionLogPageSize))
        ? Number(savedSettings.sessionLogPageSize)
        : 12;
      s.sessionLogPage = 1;
      s.sessions = incomingSessions;
      s.activeSessionId = activeSessionId;
      s.solveTarget = activeSession.target || savedSettings.solveTarget || "full";
      s.solveShowCube = activeSession.showCube ?? savedSettings.solveShowCube ?? true;
      s.solveInspection = activeSession.inspection ?? savedSettings.solveInspection ?? true;
      s.stats = mergedPayload.stats ? JSON.parse(JSON.stringify(mergedPayload.stats)) : {};
      s.caseTags = mergedPayload.caseTags ? JSON.parse(JSON.stringify(mergedPayload.caseTags)) : {};
      s.customCllLabels = mergedPayload.customCllLabels ? JSON.parse(JSON.stringify(mergedPayload.customCllLabels)) : {};
      s.pblSettings = mergedPayload.pblSettings ? JSON.parse(JSON.stringify(mergedPayload.pblSettings)) : {};
      s.lastSolve = activeSession.solves?.length ? activeSession.solves[activeSession.solves.length - 1] : null;

      this.loadTrackSelection(currentPuzzle, currentTrackId);

      // Persist hydrated state to localStorage & cookie while _isHydrating suppresses persist loop
      this.saveSettings();
      this.saveSessions();
      writeStorageJSON(STORAGE_KEYS.SOLVES, Array.isArray(activeSession.solves) ? activeSession.solves.slice(-200) : []);
      const layerSess = s.sessions.find(sess => sess.id === "layer");
      if (layerSess) writeStorageJSON(STORAGE_KEYS.LAYER_SOLVES, layerSess.solves || []);
      this.saveStats();
      this.saveCaseTags();
      this.saveCustomCllLabels();
      this.savePblSettings();
    } finally {
      this._isHydrating = false;
    }

    this.notify("hydrate", { source: "sync", prev: this.lastHydratePrev });
  }
}

export const appStore = new AppStore();
