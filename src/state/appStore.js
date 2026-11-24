// Centralized App Store & Backward-Compatible Persistence
// Preserves all existing localStorage/sessionStorage/cookie keys without data loss.

import {
  PUZZLES,
  getTrack,
  getDefaultTrack,
  getSolveTargetLabel,
  sanitizeCustomEvents,
  syncCustomEventsToRegistry,
  CUSTOM_EVENT_SCRAMBLE_TYPES
} from '../data/algRegistry.js';
import { cllCases } from '../data/cllData.js';
import { DEFAULT_CUBE_COLORS, CUBE_COLORS, setCustomCubeColors, applyCubeColorsToCss } from '../caseVisualizer.js';
import {
  sanitizeShortcutOverrides,
  getEffectiveShortcutsMap,
  assignShortcutOverride
} from '../services/keyboardShortcuts.js';
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

export const VALID_PUZZLES = ["222", "333", "333oh", "444", "555", "666", "777", "fto", "pyram", "skewb", "minx", "sq1", "clock", "333bf"];
export const DEFAULT_VISIBLE_EVENTS = ["222", "333", "333oh", "444", "555"];
export const ALL_BUILTIN_EVENT_IDS = [...VALID_PUZZLES];

export function sanitizeVisibleEvents(rawList, fallbackShowExtra = false) {
  if (Array.isArray(rawList)) {
    const allowed = new Set(rawList.filter(id => ALL_BUILTIN_EVENT_IDS.includes(id)));
    const ordered = ALL_BUILTIN_EVENT_IDS.filter(id => allowed.has(id));
    return ordered.length > 0 ? ordered : [...DEFAULT_VISIBLE_EVENTS];
  }
  return fallbackShowExtra ? [...ALL_BUILTIN_EVENT_IDS] : [...DEFAULT_VISIBLE_EVENTS];
}
export const MODES = ["study", "practice", "solve", "simulate"];
export const LOG_PAGE_SIZE_OPTIONS = [5, 12, 25, 50, 100];
export const SIM_SPEED_OPTIONS = [0.25, 0.5, 1, 1.5, 2];
export const MAX_SOLVES = Infinity;
export const MAX_DISPLAY_SOLVES = 10000;

export const GROUPS = ["A", "H", "L", "P", "S", "T", "U"];
export const GROUP_DISPLAY_ORDER = ["H", "P", "U", "T", "L", "S", "A"];
export const GROUP_NAMES = { A: "Anti-Sune", H: "H", L: "L", P: "Pi", S: "Sune", T: "T", U: "U" };

/**
 * Returns true when the current view renders the live Solve timer surface
 * (either dedicated Full Solve mode, or Train -> Timed Drills).
 */
export function isTimerViewMode(state) {
  if (!state) return false;
  return state.mode === "solve" || (state.mode === "practice" && state.trainSubMode === "timed-drill");
}

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

    const customEvents = sanitizeCustomEvents(savedSettings.customEvents);
    syncCustomEventsToRegistry(customEvents);
    const isKnownPuzzle = (pid) => VALID_PUZZLES.includes(pid) || Boolean(PUZZLES[pid]);

    // Navigation & puzzle/track
    let currentPuzzle = isKnownPuzzle(savedSettings.currentPuzzle) ? savedSettings.currentPuzzle : "222";
    let currentTrackId = savedSettings.currentTrackId || getDefaultTrack(currentPuzzle)?.id || "cll";
    let mode = MODES.includes(savedSettings.mode)
      ? savedSettings.mode
      : (savedSettings.mode === "timed" ? "practice" : "solve");

    if (typeof window !== "undefined") {
      const urlParams = new URLSearchParams(window.location.search);
      const urlPuz = urlParams.get("puzzle");
      if (urlPuz && isKnownPuzzle(urlPuz)) currentPuzzle = urlPuz;
      if (urlParams.has("track")) currentTrackId = urlParams.get("track") || currentTrackId;
      const urlMode = urlParams.get("mode");
      if (urlMode && MODES.includes(urlMode)) mode = urlMode;
      else if (urlMode === "timed") mode = "practice";
    }

    if (PUZZLES[currentPuzzle]?.solveOnly) {
      currentTrackId = "full";
      mode = "solve";
    } else {
      if (PUZZLES[currentPuzzle]?.learnAndSolveOnly && mode !== "study" && mode !== "solve") {
        mode = "solve";
      }
      if (!getTrack(currentPuzzle, currentTrackId)) {
        currentTrackId = getDefaultTrack(currentPuzzle)?.id || "cll";
      }
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

    const hasSavedTrainSubMode = savedSettings.trainSubMode !== undefined || cookiePrefs.trainSubMode !== undefined;
    let trainSubMode = (savedSettings.trainSubMode === "timed-drill" || cookiePrefs.trainSubMode === "timed-drill")
      ? "timed-drill"
      : "recog";
    if (!hasSavedTrainSubMode && savedSettings.mode === "solve" && solveTarget && solveTarget !== "full" && !PUZZLES[currentPuzzle]?.solveOnly) {
      mode = "practice";
      trainSubMode = "timed-drill";
    }

    const ohHand = savedSettings.ohHand === "right" ? "right" : (cookiePrefs.ohHand === "right" ? "right" : "left");
    const ohTableAbuse = savedSettings.ohTableAbuse !== undefined
      ? Boolean(savedSettings.ohTableAbuse)
      : (cookiePrefs.ohTableAbuse !== undefined ? Boolean(cookiePrefs.ohTableAbuse) : true);
    const rawSimSpeed = Number(savedSettings.simSpeed ?? cookiePrefs.simSpeed);
    const simSpeed = SIM_SPEED_OPTIONS.includes(rawSimSpeed) ? rawSimSpeed : 1;

    const hasSavedStatsDisplayMode = ["none", "basic", "advanced"].includes(savedSettings.statsDisplayMode)
      || ["none", "basic", "advanced"].includes(cookiePrefs.statsDisplayMode);
    const rawStatsDisplayMode = ["none", "basic", "advanced"].includes(savedSettings.statsDisplayMode)
      ? savedSettings.statsDisplayMode
      : cookiePrefs.statsDisplayMode;
    const rawAdvMode = savedSettings.advancedMode ?? cookiePrefs.advancedMode ?? (hasExistingSettings || hasRecordedSolves);
    const rawShowStatsPanel = savedSettings.showStatsPanel ?? cookiePrefs.showStatsPanel ?? true;
    const statsDisplayMode = hasSavedStatsDisplayMode
      ? rawStatsDisplayMode
      : (rawShowStatsPanel === false ? "none" : (rawAdvMode ? "advanced" : "basic"));
    const rawPanelVis = ["always", "solve-only", "hidden"].includes(savedSettings.statsPanelVisibility)
      ? savedSettings.statsPanelVisibility
      : (["always", "solve-only", "hidden"].includes(cookiePrefs.statsPanelVisibility) ? cookiePrefs.statsPanelVisibility : null);
    let statsPanelVisibility = rawPanelVis || (rawShowStatsPanel === false ? "hidden" : "always");
    if (statsDisplayMode === "none") statsPanelVisibility = "hidden";
    const advancedMode = statsDisplayMode === "advanced";
    const showStatsPanel = statsDisplayMode !== "none" && statsPanelVisibility !== "hidden";

    const rawShowExtra = savedSettings.showExtraWcaEvents ?? cookiePrefs.showExtraWcaEvents ?? false;
    const rawVisibleList = Array.isArray(savedSettings.visibleEvents)
      ? savedSettings.visibleEvents
      : (Array.isArray(cookiePrefs.visibleEvents) ? cookiePrefs.visibleEvents : null);
    const visibleEvents = sanitizeVisibleEvents(rawVisibleList, rawShowExtra);
    const showExtraWcaEvents = rawVisibleList
      ? visibleEvents.some(id => !DEFAULT_VISIBLE_EVENTS.includes(id))
      : Boolean(rawShowExtra);

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
      advancedMode,
      statsDisplayMode,
      statsPanelVisibility,
      focusMode: false,
      showTooltips: savedSettings.showTooltips ?? cookiePrefs.showTooltips ?? true,
      onboardingCompleted: savedSettings.onboardingCompleted ?? cookiePrefs.onboardingCompleted ?? (hasExistingSettings || hasRecordedSolves),
      onboardingProfile: savedSettings.onboardingProfile || null,
      settingsCollapsed: savedSettings.casesCollapsed ?? savedSettings.settingsCollapsed ?? true,
      statsCollapsed: savedSettings.statsCollapsed ?? cookiePrefs.statsCollapsed ?? false,
      freeMovesOpen: savedSettings.freeMovesOpen ?? cookiePrefs.freeMovesOpen ?? false,
      layerSolutionsOpen: savedSettings.layerSolutionsOpen ?? cookiePrefs.layerSolutionsOpen ?? false,
      crossSolutionsOpen: savedSettings.crossSolutionsOpen ?? cookiePrefs.crossSolutionsOpen ?? false,
      chartsStatsOpen: savedSettings.chartsStatsOpen ?? cookiePrefs.chartsStatsOpen ?? true,
      goalCoachOpen: savedSettings.goalCoachOpen ?? cookiePrefs.goalCoachOpen ?? true,
      solveLogOpen: savedSettings.solveLogOpen ?? cookiePrefs.solveLogOpen ?? true,
      cfopSummaryOpen: savedSettings.cfopSummaryOpen ?? cookiePrefs.cfopSummaryOpen ?? true,
      ollCasesStatsOpen: savedSettings.ollCasesStatsOpen ?? cookiePrefs.ollCasesStatsOpen ?? true,
      pllCasesStatsOpen: savedSettings.pllCasesStatsOpen ?? cookiePrefs.pllCasesStatsOpen ?? true,
      cfopGoalSec: Number(savedSettings.cfopGoalSec || cookiePrefs.cfopGoalSec) || 12,
      metronomeEnabled: savedSettings.metronomeEnabled ?? cookiePrefs.metronomeEnabled ?? false,
      metronomeBpm: Number(savedSettings.metronomeBpm || cookiePrefs.metronomeBpm) || 180,
      pauseAlertEnabled: savedSettings.pauseAlertEnabled ?? cookiePrefs.pauseAlertEnabled ?? false,
      showExtraWcaEvents,
      visibleEvents,
      showLayerSolutionsWidget: savedSettings.showLayerSolutionsWidget ?? cookiePrefs.showLayerSolutionsWidget ?? true,
      showCrossSolutionsWidget: savedSettings.showCrossSolutionsWidget ?? cookiePrefs.showCrossSolutionsWidget ?? true,
      showStatsPanel,
      showFreeFaceTurns: Boolean(savedSettings.showFreeFaceTurns ?? cookiePrefs.showFreeFaceTurns ?? false),
      ...(() => {
        const legacyLlMode = (savedSettings.llAnalyticsMode === "2look" || (!savedSettings.llAnalyticsMode && cookiePrefs.llAnalyticsMode === "2look")) ? "2look" : "full";
        const ollMode = (savedSettings.ollMode === "2look" || (!savedSettings.ollMode && cookiePrefs.ollMode === "2look"))
          ? "2look"
          : ((savedSettings.ollMode === "full" || cookiePrefs.ollMode === "full") ? "full" : legacyLlMode);
        const pllMode = (savedSettings.pllMode === "2look" || (!savedSettings.pllMode && cookiePrefs.pllMode === "2look"))
          ? "2look"
          : ((savedSettings.pllMode === "full" || cookiePrefs.pllMode === "full") ? "full" : legacyLlMode);
        return {
          ollMode,
          pllMode,
          llAnalyticsMode: (ollMode === "2look" && pllMode === "2look") ? "2look" : "full"
        };
      })(),
      trainSubMode,
      desktopMultiPane: savedSettings.desktopMultiPane ?? cookiePrefs.desktopMultiPane ?? true,
      customEvents,
      timerDrillPreset: savedSettings.timerDrillPreset || "righty",
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
      keyboardShortcuts: sanitizeShortcutOverrides(savedSettings.keyboardShortcuts),
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

  setStatsDisplayMode(mode) {
    const next = mode === "none" ? "none" : mode === "basic" ? "basic" : "advanced";
    const nextAdv = next === "advanced";
    const nextShow = next !== "none";
    const nextPanelVis = next === "none"
      ? "hidden"
      : (this.state.statsPanelVisibility === "hidden" ? "always" : (this.state.statsPanelVisibility || "always"));
    if (
      this.state.statsDisplayMode === next &&
      Boolean(this.state.advancedMode) === nextAdv &&
      (this.state.showStatsPanel !== false) === nextShow &&
      this.state.statsPanelVisibility === nextPanelVis
    ) return;
    this.state.statsDisplayMode = next;
    this.state.advancedMode = nextAdv;
    this.state.showStatsPanel = nextShow;
    this.state.statsPanelVisibility = nextPanelVis;
    this.saveSettings();
    this.notify("advancedMode", { advancedMode: nextAdv, statsDisplayMode: next });
    this.notify("widgetVisibility", { key: "showStatsPanel", enabled: nextShow, statsPanelVisibility: nextPanelVis });
  }

  setStatsPanelVisibility(vis) {
    const next = vis === "hidden" ? "hidden" : vis === "solve-only" ? "solve-only" : "always";
    const nextShow = next !== "hidden";
    if (this.state.statsPanelVisibility === next && (this.state.showStatsPanel !== false) === nextShow) return;
    this.state.statsPanelVisibility = next;
    this.state.showStatsPanel = nextShow;
    if (nextShow && this.state.statsDisplayMode === "none") {
      this.state.statsDisplayMode = this.state.advancedMode ? "advanced" : "basic";
    }
    this.saveSettings();
    this.notify("widgetVisibility", { key: "showStatsPanel", enabled: nextShow, statsPanelVisibility: next });
  }

  setVisibleEvents(eventIds) {
    const next = sanitizeVisibleEvents(eventIds, false);
    if (!next.length) return false;
    this.state.visibleEvents = next;
    this.state.showExtraWcaEvents = next.some(id => !DEFAULT_VISIBLE_EVENTS.includes(id));
    this.saveSettings();
    this.notify("visibleEvents", { visibleEvents: [...next] });
    return true;
  }

  toggleVisibleEvent(id, enabled) {
    if (!ALL_BUILTIN_EVENT_IDS.includes(id)) return false;
    const current = Array.isArray(this.state.visibleEvents) && this.state.visibleEvents.length
      ? this.state.visibleEvents
      : [...DEFAULT_VISIBLE_EVENTS];
    const nextSet = new Set(current);
    if (enabled) nextSet.add(id);
    else nextSet.delete(id);
    if (nextSet.size === 0) return false;
    return this.setVisibleEvents([...nextSet]);
  }

  setAdvancedMode(enabled) {
    const next = Boolean(enabled);
    const nextDisplay = next ? "advanced" : "basic";
    const nextPanelVis = this.state.statsPanelVisibility === "hidden" ? "always" : (this.state.statsPanelVisibility || "always");
    if (
      Boolean(this.state.advancedMode) === next &&
      this.state.statsDisplayMode === nextDisplay &&
      this.state.showStatsPanel !== false &&
      this.state.statsPanelVisibility === nextPanelVis
    ) return;
    this.state.advancedMode = next;
    this.state.showStatsPanel = true;
    this.state.statsDisplayMode = nextDisplay;
    this.state.statsPanelVisibility = nextPanelVis;
    this.saveSettings();
    this.notify("advancedMode", { advancedMode: next, statsDisplayMode: nextDisplay });
  }

  setFocusMode(enabled) {
    const next = Boolean(enabled);
    if (Boolean(this.state.focusMode) === next) return;
    this.state.focusMode = next;
    this.notify("focusMode", { focusMode: next });
  }

  setWidgetVisibility(key, enabled) {
    if (!["showLayerSolutionsWidget", "showCrossSolutionsWidget", "showStatsPanel", "showFreeFaceTurns"].includes(key)) return;
    const next = Boolean(enabled);
    if (Boolean(this.state[key]) === next) return;
    this.state[key] = next;
    if (key === "showStatsPanel") {
      this.state.statsDisplayMode = next ? (this.state.advancedMode ? "advanced" : "basic") : "none";
      this.state.statsPanelVisibility = next
        ? (this.state.statsPanelVisibility === "hidden" ? "always" : (this.state.statsPanelVisibility || "always"))
        : "hidden";
    }
    this.saveSettings();
    this.notify("widgetVisibility", { key, enabled: next });
  }

  setSolveShowCube(enabled) {
    const next = Boolean(enabled);
    this.state.solveShowCube = next;
    const sess = this.getActiveSession?.();
    if (sess) {
      sess.showCube = next;
      this.saveSessions();
    }
    this.saveSettings();
    this.notify("solveOptions", { solveShowCube: next });
  }

  setSolveInspection(enabled) {
    const next = Boolean(enabled);
    this.state.solveInspection = next;
    const sess = this.getActiveSession?.();
    if (sess) {
      sess.inspection = next;
      this.saveSessions();
    }
    this.saveSettings();
    this.notify("solveOptions", { solveInspection: next });
  }

  setOllMode(mode) {
    const next = mode === "2look" ? "2look" : "full";
    if (this.state.ollMode === next) return;
    this.state.ollMode = next;
    this.state.llAnalyticsMode = (this.state.ollMode === "2look" && this.state.pllMode === "2look") ? "2look" : "full";
    this.saveSettings();
    this.notify("llAnalyticsMode", {
      ollMode: this.state.ollMode,
      pllMode: this.state.pllMode,
      llAnalyticsMode: this.state.llAnalyticsMode
    });
  }

  setPllMode(mode) {
    const next = mode === "2look" ? "2look" : "full";
    if (this.state.pllMode === next) return;
    this.state.pllMode = next;
    this.state.llAnalyticsMode = (this.state.ollMode === "2look" && this.state.pllMode === "2look") ? "2look" : "full";
    this.saveSettings();
    this.notify("llAnalyticsMode", {
      ollMode: this.state.ollMode,
      pllMode: this.state.pllMode,
      llAnalyticsMode: this.state.llAnalyticsMode
    });
  }

  setLlAnalyticsMode(mode) {
    const next = mode === "2look" ? "2look" : "full";
    if (this.state.llAnalyticsMode === next && this.state.ollMode === next && this.state.pllMode === next) return;
    this.state.ollMode = next;
    this.state.pllMode = next;
    this.state.llAnalyticsMode = next;
    this.saveSettings();
    this.notify("llAnalyticsMode", {
      ollMode: next,
      pllMode: next,
      llAnalyticsMode: next
    });
  }

  setTrainSubMode(subMode) {
    const next = subMode === "timed-drill" ? "timed-drill" : "recog";
    if (this.state.trainSubMode === next) return;
    this.state.trainSubMode = next;
    this.saveSettings();
    this.notify("trainSubMode", { trainSubMode: next });
  }

  setDesktopMultiPane(enabled) {
    const next = Boolean(enabled);
    if (Boolean(this.state.desktopMultiPane) === next) return;
    this.state.desktopMultiPane = next;
    this.saveSettings();
    this.notify("desktopMultiPane", { desktopMultiPane: next });
  }

  addCustomEvent({ name, shortName = "", scrambleType = "none" } = {}) {
    const cleanName = String(name || "").trim().slice(0, 32);
    if (!cleanName) return null;
    const cleanShort = String(shortName || cleanName).trim().slice(0, 12) || cleanName.slice(0, 12);
    const cleanType = CUSTOM_EVENT_SCRAMBLE_TYPES.includes(scrambleType) ? scrambleType : "none";
    const slug = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "event";
    const existingIds = new Set((this.state.customEvents || []).map(e => e.id));
    let id = `custom-${slug}`;
    let counter = 2;
    while (existingIds.has(id) || (PUZZLES[id] && !PUZZLES[id].isCustomEvent)) {
      id = `custom-${slug}-${counter++}`;
    }
    const entry = {
      id,
      name: cleanName,
      shortName: cleanShort,
      scrambleType: cleanType
    };
    this.state.customEvents = sanitizeCustomEvents([...(this.state.customEvents || []), entry]);
    syncCustomEventsToRegistry(this.state.customEvents);
    this.saveSettings();
    this.notify("customEvents", { added: entry });
    return entry;
  }

  removeCustomEvent(eventId) {
    const list = this.state.customEvents || [];
    const next = list.filter(ev => ev.id !== eventId);
    if (next.length === list.length) return false;
    this.state.customEvents = next;
    syncCustomEventsToRegistry(next);
    this.saveSettings();
    this.notify("customEvents", { removedId: eventId });
    return true;
  }

  getKeyboardShortcuts() {
    return getEffectiveShortcutsMap(this.state.keyboardShortcuts);
  }

  setKeyboardShortcut(actionId, combo = "") {
    const res = assignShortcutOverride(this.state.keyboardShortcuts, actionId, combo);
    if (res.reserved) return res;
    this.state.keyboardShortcuts = res.next;
    this.saveSettings();
    this.notify("shortcuts", { actionId, combo, replacedActionId: res.replacedActionId });
    return res;
  }

  resetKeyboardShortcuts() {
    this.state.keyboardShortcuts = {};
    this.saveSettings();
    this.notify("shortcuts", { reset: true });
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
      advancedMode: Boolean(s.advancedMode),
      statsDisplayMode: ["none", "basic", "advanced"].includes(s.statsDisplayMode) ? s.statsDisplayMode : (s.showStatsPanel === false ? "none" : (s.advancedMode ? "advanced" : "basic")),
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
      chartsStatsOpen: s.chartsStatsOpen,
      goalCoachOpen: s.goalCoachOpen,
      solveLogOpen: s.solveLogOpen,
      cfopSummaryOpen: s.cfopSummaryOpen,
      ollCasesStatsOpen: s.ollCasesStatsOpen,
      pllCasesStatsOpen: s.pllCasesStatsOpen,
      cfopGoalSec: Number(s.cfopGoalSec) || 12,
      metronomeEnabled: Boolean(s.metronomeEnabled),
      metronomeBpm: Number(s.metronomeBpm) || 180,
      pauseAlertEnabled: Boolean(s.pauseAlertEnabled),
      showExtraWcaEvents: Boolean(s.showExtraWcaEvents),
      visibleEvents: sanitizeVisibleEvents(s.visibleEvents, s.showExtraWcaEvents),
      showLayerSolutionsWidget: s.showLayerSolutionsWidget !== false,
      showCrossSolutionsWidget: s.showCrossSolutionsWidget !== false,
      showStatsPanel: s.showStatsPanel !== false,
      statsPanelVisibility: ["always", "solve-only", "hidden"].includes(s.statsPanelVisibility) ? s.statsPanelVisibility : (s.showStatsPanel === false ? "hidden" : "always"),
      showFreeFaceTurns: Boolean(s.showFreeFaceTurns),
      ollMode: s.ollMode === "2look" ? "2look" : "full",
      pllMode: s.pllMode === "2look" ? "2look" : "full",
      llAnalyticsMode: (s.ollMode === "2look" && s.pllMode === "2look") ? "2look" : "full",
      trainSubMode: s.trainSubMode === "timed-drill" ? "timed-drill" : "recog",
      desktopMultiPane: s.desktopMultiPane !== false,
      customEvents: sanitizeCustomEvents(s.customEvents),
      timerDrillPreset: s.timerDrillPreset,
      statsType: s.statsType,
      layerTargetFaces: s.layerTargetFaces,
      crossTargetFaces: s.crossTargetFaces,
      activeSessionId: s.activeSessionId,
      solveTarget: s.solveTarget,
      solveShowCube: s.solveShowCube,
      solveInspection: s.solveInspection,
      sessionLogPageSize: s.sessionLogPageSize,
      keyboardShortcuts: sanitizeShortcutOverrides(s.keyboardShortcuts),
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
      advancedMode: Boolean(s.advancedMode),
      statsDisplayMode: ["none", "basic", "advanced"].includes(s.statsDisplayMode) ? s.statsDisplayMode : (s.showStatsPanel === false ? "none" : (s.advancedMode ? "advanced" : "basic")),
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
      chartsStatsOpen: s.chartsStatsOpen,
      goalCoachOpen: s.goalCoachOpen,
      solveLogOpen: s.solveLogOpen,
      cfopSummaryOpen: s.cfopSummaryOpen,
      ollCasesStatsOpen: s.ollCasesStatsOpen,
      pllCasesStatsOpen: s.pllCasesStatsOpen,
      cfopGoalSec: Number(s.cfopGoalSec) || 12,
      metronomeEnabled: Boolean(s.metronomeEnabled),
      metronomeBpm: Number(s.metronomeBpm) || 180,
      pauseAlertEnabled: Boolean(s.pauseAlertEnabled),
      showExtraWcaEvents: Boolean(s.showExtraWcaEvents),
      visibleEvents: sanitizeVisibleEvents(s.visibleEvents, s.showExtraWcaEvents),
      showLayerSolutionsWidget: s.showLayerSolutionsWidget !== false,
      showCrossSolutionsWidget: s.showCrossSolutionsWidget !== false,
      showStatsPanel: s.showStatsPanel !== false,
      statsPanelVisibility: ["always", "solve-only", "hidden"].includes(s.statsPanelVisibility) ? s.statsPanelVisibility : (s.showStatsPanel === false ? "hidden" : "always"),
      showFreeFaceTurns: Boolean(s.showFreeFaceTurns),
      ollMode: s.ollMode === "2look" ? "2look" : "full",
      pllMode: s.pllMode === "2look" ? "2look" : "full",
      llAnalyticsMode: (s.ollMode === "2look" && s.pllMode === "2look") ? "2look" : "full",
      trainSubMode: s.trainSubMode === "timed-drill" ? "timed-drill" : "recog",
      desktopMultiPane: s.desktopMultiPane !== false,
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

      const hydratedCustomEvents = Array.isArray(savedSettings.customEvents)
        ? sanitizeCustomEvents(savedSettings.customEvents)
        : sanitizeCustomEvents(this.state.customEvents);
      syncCustomEventsToRegistry(hydratedCustomEvents);

      let currentPuzzle = (VALID_PUZZLES.includes(savedSettings.currentPuzzle) || Boolean(PUZZLES[savedSettings.currentPuzzle]))
        ? savedSettings.currentPuzzle
        : this.state.currentPuzzle;
      let currentTrackId = savedSettings.currentTrackId || getDefaultTrack(currentPuzzle)?.id || "cll";
      if (PUZZLES[currentPuzzle]?.solveOnly) {
        currentTrackId = "full";
      } else if (!getTrack(currentPuzzle, currentTrackId)) {
        currentTrackId = getDefaultTrack(currentPuzzle)?.id || "cll";
      }
      let mode = PUZZLES[currentPuzzle]?.solveOnly
        ? "solve"
        : (MODES.includes(savedSettings.mode)
            ? savedSettings.mode
            : (savedSettings.mode === "timed" ? "practice" : this.state.mode));
      if (PUZZLES[currentPuzzle]?.learnAndSolveOnly && mode !== "study" && mode !== "solve") {
        mode = "solve";
      }

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
      s.advancedMode = savedSettings.advancedMode ?? s.advancedMode ?? false;
      s.showTooltips = savedSettings.showTooltips ?? true;
      s.onboardingCompleted = savedSettings.onboardingCompleted ?? s.onboardingCompleted;
      s.onboardingProfile = savedSettings.onboardingProfile ? JSON.parse(JSON.stringify(savedSettings.onboardingProfile)) : null;
      s.settingsCollapsed = savedSettings.settingsCollapsed ?? savedSettings.casesCollapsed ?? true;
      s.statsCollapsed = savedSettings.statsCollapsed ?? false;
      s.freeMovesOpen = savedSettings.freeMovesOpen ?? false;
      s.layerSolutionsOpen = savedSettings.layerSolutionsOpen ?? false;
      s.crossSolutionsOpen = savedSettings.crossSolutionsOpen ?? false;
      s.chartsStatsOpen = savedSettings.chartsStatsOpen ?? true;
      s.goalCoachOpen = savedSettings.goalCoachOpen ?? true;
      s.solveLogOpen = savedSettings.solveLogOpen ?? true;
      s.cfopSummaryOpen = savedSettings.cfopSummaryOpen ?? true;
      s.ollCasesStatsOpen = savedSettings.ollCasesStatsOpen ?? true;
      s.pllCasesStatsOpen = savedSettings.pllCasesStatsOpen ?? true;
      s.cfopGoalSec = Number(savedSettings.cfopGoalSec) || 12;
      s.metronomeEnabled = Boolean(savedSettings.metronomeEnabled ?? false);
      s.metronomeBpm = Number(savedSettings.metronomeBpm) || 180;
      s.pauseAlertEnabled = Boolean(savedSettings.pauseAlertEnabled ?? false);
      s.showExtraWcaEvents = Boolean(savedSettings.showExtraWcaEvents ?? false);
      s.visibleEvents = Array.isArray(savedSettings.visibleEvents)
        ? sanitizeVisibleEvents(savedSettings.visibleEvents, s.showExtraWcaEvents)
        : sanitizeVisibleEvents(null, s.showExtraWcaEvents);
      if (Array.isArray(savedSettings.visibleEvents)) {
        s.showExtraWcaEvents = s.visibleEvents.some(id => !DEFAULT_VISIBLE_EVENTS.includes(id));
      }
      s.showLayerSolutionsWidget = savedSettings.showLayerSolutionsWidget ?? s.showLayerSolutionsWidget ?? true;
      s.showCrossSolutionsWidget = savedSettings.showCrossSolutionsWidget ?? s.showCrossSolutionsWidget ?? true;
      s.showStatsPanel = savedSettings.showStatsPanel ?? s.showStatsPanel ?? true;
      if (["none", "basic", "advanced"].includes(savedSettings.statsDisplayMode)) {
        s.statsDisplayMode = savedSettings.statsDisplayMode;
        s.advancedMode = savedSettings.statsDisplayMode === "advanced";
        s.showStatsPanel = savedSettings.statsDisplayMode !== "none";
      } else {
        s.statsDisplayMode = s.showStatsPanel === false ? "none" : (s.advancedMode ? "advanced" : "basic");
      }
      s.statsPanelVisibility = ["always", "solve-only", "hidden"].includes(savedSettings.statsPanelVisibility)
        ? savedSettings.statsPanelVisibility
        : (s.showStatsPanel === false || s.statsDisplayMode === "none" ? "hidden" : "always");
      if (s.statsDisplayMode === "none") s.statsPanelVisibility = "hidden";
      if (s.statsPanelVisibility === "hidden") s.showStatsPanel = false;
      s.showFreeFaceTurns = savedSettings.showFreeFaceTurns ?? s.showFreeFaceTurns ?? false;
      const legacyLlMode = savedSettings.llAnalyticsMode === "2look" ? "2look" : "full";
      s.ollMode = savedSettings.ollMode === "2look" ? "2look" : (savedSettings.ollMode === "full" ? "full" : legacyLlMode);
      s.pllMode = savedSettings.pllMode === "2look" ? "2look" : (savedSettings.pllMode === "full" ? "full" : legacyLlMode);
      s.llAnalyticsMode = (s.ollMode === "2look" && s.pllMode === "2look") ? "2look" : "full";
      s.trainSubMode = savedSettings.trainSubMode === "timed-drill" ? "timed-drill" : "recog";
      s.desktopMultiPane = savedSettings.desktopMultiPane ?? s.desktopMultiPane ?? true;
      s.customEvents = hydratedCustomEvents;
      s.timerDrillPreset = savedSettings.timerDrillPreset || "righty";
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
      s.keyboardShortcuts = sanitizeShortcutOverrides(savedSettings.keyboardShortcuts);
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
