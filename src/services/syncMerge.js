// Pure deterministic conflict-free sync & merge engine for Speedcube Trainer cloud sync.
// Zero DOM / browser dependencies so it runs cleanly in Node tests and the browser.

export const SYNC_SCHEMA_VERSION = 1;
export const MAX_MERGED_SOLVES = Infinity;
export const TOMBSTONE_MAX_AGE_MS = 90 * 24 * 60 * 60 * 1000;

const CASE_TAG_RANK = {
  none: 0,
  learning: 1,
  review: 2,
  mastered: 3
};

const DEFAULT_SESSION_IDS = new Set(["default", "layer"]);

const SETTINGS_SCALAR_FIELDS = [
  "currentPuzzle",
  "currentTrackId",
  "mode",
  "ohHand",
  "ohTableAbuse",
  "simSpeed",
  "alwaysWhiteBottom",
  "trainingBottomFaces",
  "allowAUF",
  "showReflection",
  "darkMode",
  "advancedMode",
  "statsDisplayMode",
  "showTooltips",
  "onboardingCompleted",
  "onboardingProfile",
  "casesCollapsed",
  "settingsCollapsed",
  "statsCollapsed",
  "freeMovesOpen",
  "layerSolutionsOpen",
  "crossSolutionsOpen",
  "chartsStatsOpen",
  "goalCoachOpen",
  "solveLogOpen",
  "cfopSummaryOpen",
  "ollCasesStatsOpen",
  "pllCasesStatsOpen",
  "cfopGoalSec",
  "metronomeEnabled",
  "metronomeBpm",
  "pauseAlertEnabled",
  "showExtraWcaEvents",
  "visibleEvents",
  "showLayerSolutionsWidget",
  "showCrossSolutionsWidget",
  "showStatsPanel",
  "statsPanelVisibility",
  "showFreeFaceTurns",
  "llAnalyticsMode",
  "ollMode",
  "pllMode",
  "f2lMode",
  "twoByTwoMethod",
  "trainSubMode",
  "desktopMultiPane",
  "customEvents",
  "timerDrillPreset",
  "statsType",
  "layerTargetFaces",
  "crossTargetFaces",
  "activeSessionId",
  "solveTarget",
  "solveShowCube",
  "solveInspection",
  "inspectionAudioMode",
  "solveLimitMinutes",
  "solveLimitSound",
  "sessionLogPageSize",
  "keyboardShortcuts",
  "customColors",
  "themeColors"
];

export function getSolveFingerprint(solve) {
  if (!solve || typeof solve !== "object") return "";
  if (solve.uid) return String(solve.uid);
  const at = solve.at || 0;
  const ms = solve.ms ?? "";
  const rawMs = solve.rawMs ?? "";
  const scramble = solve.scramble || "";
  const puzzle = solve.puzzle || "";
  const target = solve.target || "";
  const id = solve.id || "";
  return `${at}|${ms}|${rawMs}|${scramble}|${puzzle}|${target}|${id}`;
}

export function canonicalStringify(value) {
  if (value === null || value === undefined) return String(value);
  if (typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return "[" + value.map(v => canonicalStringify(v)).join(",") + "]";
  }
  const keys = Object.keys(value).sort();
  const entries = [];
  for (const k of keys) {
    if (value[k] === undefined) continue;
    entries.push(`${JSON.stringify(k)}:${canonicalStringify(value[k])}`);
  }
  return "{" + entries.join(",") + "}";
}

function deepClone(value) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

function isPlainObject(v) {
  return Boolean(v) && typeof v === "object" && !Array.isArray(v);
}

export function isSnapshotEmpty(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return true;

  const sessions = Array.isArray(snapshot.sessions) ? snapshot.sessions : [];
  const hasSolves = sessions.some(s => Array.isArray(s?.solves) && s.solves.length > 0);
  if (hasSolves) return false;

  const hasCustomSession = sessions.some(s => s && s.id && !DEFAULT_SESSION_IDS.has(s.id));
  if (hasCustomSession) return false;

  const hasStats = hasNonEmptyStats(snapshot.stats);
  if (hasStats) return false;

  if (snapshot.caseTags && Object.keys(snapshot.caseTags).length > 0) return false;
  if (snapshot.customCllLabels && Object.keys(snapshot.customCllLabels).length > 0) return false;
  if (snapshot.pblSettings && hasNonEmptyPbl(snapshot.pblSettings)) return false;
  if (snapshot.preferredAlgs && Object.keys(snapshot.preferredAlgs).length > 0) return false;
  if (Array.isArray(snapshot.savedSmartCubes) && snapshot.savedSmartCubes.length > 0) return false;

  const tomb = snapshot.tombstones || {};
  if (
    Object.keys(tomb.sessions || {}).length > 0 ||
    Object.keys(tomb.solves || {}).length > 0 ||
    Object.keys(tomb.caseTags || {}).length > 0 ||
    Object.keys(tomb.customCllLabels || {}).length > 0 ||
    Object.keys(tomb.preferredAlgs || {}).length > 0 ||
    Object.keys(tomb.pblSettings || {}).length > 0
  ) {
    return false;
  }

  const settings = snapshot.settings;
  const hasSettingsObj = isPlainObject(settings) && Object.keys(settings).length > 0;
  if (snapshot.hasLocalSettings === false) {
    const settingsTsKeys = Object.keys(snapshot.timestamps?.settings || {});
    const trackTsKeys = Object.keys(snapshot.timestamps?.selectedByTrack || {});
    if (settingsTsKeys.length === 0 && trackTsKeys.length === 0) return true;
  } else if (!hasSettingsObj) {
    return true;
  }

  // If the only user action on a brand-new machine was dismissing onboarding (no solves, no other settings touched)
  const settingsTsKeys = Object.keys(snapshot.timestamps?.settings || {});
  const trackTsKeys = Object.keys(snapshot.timestamps?.selectedByTrack || {});
  if (
    trackTsKeys.length === 0 &&
    settingsTsKeys.length === 1 &&
    settingsTsKeys[0] === "onboardingCompleted" &&
    !settings?.onboardingProfile
  ) {
    return true;
  }

  return false;
}

function hasNonEmptyStats(stats) {
  if (!isPlainObject(stats)) return false;
  for (const [k, v] of Object.entries(stats)) {
    if (!isPlainObject(v)) continue;
    if (typeof v.shown === "number") {
      if (v.shown > 0) return true;
    } else {
      for (const trackVal of Object.values(v)) {
        if (!isPlainObject(trackVal)) continue;
        for (const caseVal of Object.values(trackVal)) {
          if (caseVal && typeof caseVal.shown === "number" && caseVal.shown > 0) return true;
        }
      }
    }
  }
  return false;
}

function hasNonEmptyPbl(pbl) {
  if (!isPlainObject(pbl)) return false;
  for (const entry of Object.values(pbl)) {
    if (!isPlainObject(entry)) continue;
    if (entry.selectedAlgId) return true;
    if (isPlainObject(entry.customLabels) && Object.keys(entry.customLabels).length > 0) return true;
  }
  return false;
}

function mergeTimestampMap(localMap = {}, remoteMap = {}) {
  const merged = {};
  for (const k of new Set([...Object.keys(localMap || {}), ...Object.keys(remoteMap || {})])) {
    const lv = Number(localMap?.[k] || 0);
    const rv = Number(remoteMap?.[k] || 0);
    const maxVal = Math.max(lv, rv);
    if (maxVal > 0) merged[k] = maxVal;
  }
  return merged;
}

function mergeTombstoneMap(localMap = {}, remoteMap = {}, cutoffTs = 0) {
  const merged = {};
  for (const k of new Set([...Object.keys(localMap || {}), ...Object.keys(remoteMap || {})])) {
    const maxVal = Math.max(Number(localMap?.[k] || 0), Number(remoteMap?.[k] || 0));
    if (maxVal > 0 && maxVal >= cutoffTs) {
      merged[k] = maxVal;
    }
  }
  return merged;
}

function mergeTombstones(localTomb = {}, remoteTomb = {}, now = Date.now()) {
  const cutoffTs = Math.max(0, now - TOMBSTONE_MAX_AGE_MS);
  return {
    sessions: mergeTombstoneMap(localTomb.sessions, remoteTomb.sessions, cutoffTs),
    solves: mergeTombstoneMap(localTomb.solves, remoteTomb.solves, cutoffTs),
    caseTags: mergeTombstoneMap(localTomb.caseTags, remoteTomb.caseTags, cutoffTs),
    customCllLabels: mergeTombstoneMap(localTomb.customCllLabels, remoteTomb.customCllLabels, cutoffTs),
    preferredAlgs: mergeTombstoneMap(localTomb.preferredAlgs, remoteTomb.preferredAlgs, cutoffTs),
    pblSettings: mergeTombstoneMap(localTomb.pblSettings, remoteTomb.pblSettings, cutoffTs),
    deletedSmartCubes: mergeTombstoneMap(localTomb.deletedSmartCubes, remoteTomb.deletedSmartCubes, cutoffTs)
  };
}

function mergeSettings(local, remote) {
  const lSettings = isPlainObject(local?.settings) ? local.settings : {};
  const rSettings = isPlainObject(remote?.settings) ? remote.settings : {};
  const lTs = isPlainObject(local?.timestamps?.settings) ? local.timestamps.settings : {};
  const rTs = isPlainObject(remote?.timestamps?.settings) ? remote.timestamps.settings : {};
  const lUpdated = Number(local?.updatedAt || 0);
  const rUpdated = Number(remote?.updatedAt || 0);

  const mergedSettings = {};
  const mergedSettingsTs = {};

  for (const field of SETTINGS_SCALAR_FIELDS) {
    const lVal = lSettings[field];
    const rVal = rSettings[field];
    const lt = Number(lTs[field] || 0);
    const rt = Number(rTs[field] || 0);

    if (lVal === undefined && rVal === undefined) continue;
    if (rVal === undefined) {
      mergedSettings[field] = deepClone(lVal);
      if (lt > 0) mergedSettingsTs[field] = lt;
      continue;
    }
    if (lVal === undefined) {
      mergedSettings[field] = deepClone(rVal);
      if (rt > 0) mergedSettingsTs[field] = rt;
      continue;
    }

    if (lt > rt) {
      mergedSettings[field] = deepClone(lVal);
      mergedSettingsTs[field] = lt;
    } else if (rt > lt) {
      mergedSettings[field] = deepClone(rVal);
      mergedSettingsTs[field] = rt;
    } else {
      // Tie on per-field timestamp
      if (lt === 0 && rt === 0) {
        if (field === "onboardingCompleted") {
          mergedSettings[field] = Boolean(lVal || rVal);
        } else if (rUpdated > lUpdated && !local?.hasLocalSettings) {
          mergedSettings[field] = deepClone(rVal);
        } else if (rUpdated > lUpdated && remote?.hasLocalSettings !== false && local?.hasLocalSettings === false) {
          mergedSettings[field] = deepClone(rVal);
        } else if (rUpdated > lUpdated) {
          mergedSettings[field] = deepClone(rVal);
        } else {
          mergedSettings[field] = deepClone(lVal);
        }
      } else {
        mergedSettings[field] = deepClone(lVal);
        if (lt > 0) mergedSettingsTs[field] = lt;
      }
    }
  }

  // Keep casesCollapsed and settingsCollapsed synchronized
  if (mergedSettings.settingsCollapsed !== undefined || mergedSettings.casesCollapsed !== undefined) {
    const scTs = Number(mergedSettingsTs.settingsCollapsed || 0);
    const ccTs = Number(mergedSettingsTs.casesCollapsed || 0);
    const collapsedVal = ccTs > scTs
      ? mergedSettings.casesCollapsed
      : (mergedSettings.settingsCollapsed ?? mergedSettings.casesCollapsed);
    mergedSettings.settingsCollapsed = collapsedVal;
    mergedSettings.casesCollapsed = collapsedVal;
    const maxCollapseTs = Math.max(scTs, ccTs);
    if (maxCollapseTs > 0) {
      mergedSettingsTs.settingsCollapsed = maxCollapseTs;
      mergedSettingsTs.casesCollapsed = maxCollapseTs;
    }
  }

  // Per-track case selections
  const lTrackMap = isPlainObject(lSettings.selectedByTrack) ? lSettings.selectedByTrack : {};
  const rTrackMap = isPlainObject(rSettings.selectedByTrack) ? rSettings.selectedByTrack : {};
  const lTrackTs = isPlainObject(local?.timestamps?.selectedByTrack) ? local.timestamps.selectedByTrack : {};
  const rTrackTs = isPlainObject(remote?.timestamps?.selectedByTrack) ? remote.timestamps.selectedByTrack : {};

  const mergedSelectedByTrack = {};
  const mergedSelectedByTrackTs = {};

  for (const trackKey of new Set([...Object.keys(lTrackMap), ...Object.keys(rTrackMap)])) {
    const lArr = Array.isArray(lTrackMap[trackKey]) ? lTrackMap[trackKey] : undefined;
    const rArr = Array.isArray(rTrackMap[trackKey]) ? rTrackMap[trackKey] : undefined;
    const lt = Number(lTrackTs[trackKey] || 0);
    const rt = Number(rTrackTs[trackKey] || 0);

    if (lArr === undefined && rArr === undefined) continue;
    if (rArr === undefined) {
      mergedSelectedByTrack[trackKey] = [...lArr];
      if (lt > 0) mergedSelectedByTrackTs[trackKey] = lt;
    } else if (lArr === undefined) {
      mergedSelectedByTrack[trackKey] = [...rArr];
      if (rt > 0) mergedSelectedByTrackTs[trackKey] = rt;
    } else if (lt > rt) {
      mergedSelectedByTrack[trackKey] = [...lArr];
      mergedSelectedByTrackTs[trackKey] = lt;
    } else if (rt > lt) {
      mergedSelectedByTrack[trackKey] = [...rArr];
      mergedSelectedByTrackTs[trackKey] = rt;
    } else if (lt === 0 && rt === 0 && rUpdated > lUpdated) {
      mergedSelectedByTrack[trackKey] = [...rArr];
    } else {
      mergedSelectedByTrack[trackKey] = [...lArr];
      if (lt > 0) mergedSelectedByTrackTs[trackKey] = lt;
    }
  }

  mergedSettings.selectedByTrack = mergedSelectedByTrack;
  if (Array.isArray(mergedSelectedByTrack["222:cll"])) {
    mergedSettings.selected = [...mergedSelectedByTrack["222:cll"]];
  } else if (Array.isArray(lSettings.selected) || Array.isArray(rSettings.selected)) {
    mergedSettings.selected = deepClone(
      rUpdated > lUpdated && !lSettings.selected ? rSettings.selected : (lSettings.selected || rSettings.selected || [])
    );
  }

  return {
    settings: mergedSettings,
    settingsTs: mergedSettingsTs,
    selectedByTrackTs: mergedSelectedByTrackTs
  };
}

function getSessionActivityTs(sess) {
  let maxTs = Number(sess?.updatedAt || 0);
  if (Array.isArray(sess?.solves)) {
    for (const sv of sess.solves) {
      const t = Number(sv?.updatedAt || sv?.at || 0);
      if (t > maxTs) maxTs = t;
    }
  }
  return maxTs;
}

function mergeTwoSolves(localSolve, remoteSolve) {
  const lMod = Number(localSolve.updatedAt || localSolve.at || 0);
  const rMod = Number(remoteSolve.updatedAt || remoteSolve.at || 0);
  const primary = rMod > lMod ? remoteSolve : localSolve;
  const secondary = primary === localSolve ? remoteSolve : localSolve;

  const merged = deepClone(primary);
  if (!merged.uid && secondary.uid) merged.uid = secondary.uid;
  if (!merged.cfop && secondary.cfop) merged.cfop = deepClone(secondary.cfop);
  if ((!merged.moves || merged.moves.length === 0) && Array.isArray(secondary.moves) && secondary.moves.length > 0) {
    merged.moves = deepClone(secondary.moves);
    if (merged.moveCount == null && secondary.moveCount != null) merged.moveCount = secondary.moveCount;
    if (merged.tps == null && secondary.tps != null) merged.tps = secondary.tps;
    if (!merged.smartCube && secondary.smartCube) merged.smartCube = secondary.smartCube;
  }
  if (merged.inspectionMs == null && secondary.inspectionMs != null) merged.inspectionMs = secondary.inspectionMs;
  if (!merged.timer && secondary.timer) {
    merged.timer = secondary.timer;
    if (merged.pickupMs == null && secondary.pickupMs != null) merged.pickupMs = secondary.pickupMs;
    if (merged.cubeMs == null && secondary.cubeMs != null) merged.cubeMs = secondary.cubeMs;
    if (merged.putdownMs == null && secondary.putdownMs != null) merged.putdownMs = secondary.putdownMs;
  }
  return merged;
}

function filterAndMergeSolves(localSolves = [], remoteSolves = [], solveTombstones = {}) {
  const byFp = new Map();

  const processList = (list, isLocal) => {
    for (const solve of list) {
      if (!solve || typeof solve !== "object" || !Number.isFinite(solve.ms)) continue;
      const fp = getSolveFingerprint(solve);
      if (!fp) continue;
      const delTs = Number(solveTombstones[fp] || 0);
      const solveModTs = Number(solve.updatedAt || solve.at || 0);
      if (delTs > 0 && delTs >= solveModTs) continue;

      if (!byFp.has(fp)) {
        byFp.set(fp, deepClone(solve));
      } else {
        const existing = byFp.get(fp);
        byFp.set(fp, isLocal ? mergeTwoSolves(solve, existing) : mergeTwoSolves(existing, solve));
      }
    }
  };

  processList(localSolves, true);
  processList(remoteSolves, false);

  const merged = [...byFp.values()];
  merged.sort((a, b) => (a.at || 0) - (b.at || 0));
  if (Number.isFinite(MAX_MERGED_SOLVES) && merged.length > MAX_MERGED_SOLVES) {
    return merged.slice(merged.length - MAX_MERGED_SOLVES);
  }
  return merged;
}

function mergeSessions(localSessions = [], remoteSessions = [], mergedTombstones = {}) {
  const sessionTombstones = mergedTombstones.sessions || {};
  const solveTombstones = mergedTombstones.solves || {};

  const localMap = new Map();
  const remoteMap = new Map();
  const orderedIds = [];

  for (const s of (Array.isArray(localSessions) ? localSessions : [])) {
    if (!s?.id) continue;
    localMap.set(s.id, s);
    if (!orderedIds.includes(s.id)) orderedIds.push(s.id);
  }
  for (const s of (Array.isArray(remoteSessions) ? remoteSessions : [])) {
    if (!s?.id) continue;
    remoteMap.set(s.id, s);
    if (!orderedIds.includes(s.id)) orderedIds.push(s.id);
  }

  const mergedSessions = [];

  for (const id of orderedIds) {
    let lSess = localMap.get(id) || null;
    let rSess = remoteMap.get(id) || null;
    const delTs = Number(sessionTombstones[id] || 0);

    if (lSess && delTs > 0 && delTs >= getSessionActivityTs(lSess)) {
      lSess = null;
    }
    if (rSess && delTs > 0 && delTs >= getSessionActivityTs(rSess)) {
      rSess = null;
    }

    if (!lSess && !rSess) continue;

    if (lSess && !rSess) {
      mergedSessions.push({
        ...deepClone(lSess),
        solves: filterAndMergeSolves(lSess.solves || [], [], solveTombstones)
      });
      continue;
    }

    if (rSess && !lSess) {
      mergedSessions.push({
        ...deepClone(rSess),
        solves: filterAndMergeSolves([], rSess.solves || [], solveTombstones)
      });
      continue;
    }

    // Both exist
    const lUpdated = Number(lSess.updatedAt || 0);
    const rUpdated = Number(rSess.updatedAt || 0);
    const metaWinner = rUpdated > lUpdated ? rSess : lSess;
    const metaOther = metaWinner === lSess ? rSess : lSess;

    const mergedSolves = filterAndMergeSolves(lSess.solves || [], rSess.solves || [], solveTombstones);
    const maxUpdated = Math.max(lUpdated, rUpdated);

    const outSess = {
      id,
      name: metaWinner.name || metaOther.name || "Session",
      puzzle: metaWinner.puzzle || metaOther.puzzle || undefined,
      target: metaWinner.target || metaOther.target || "full",
      size: metaWinner.size || metaWinner.widgetSize || metaOther.size || "medium",
      showCube: metaWinner.showCube !== false,
      inspection: metaWinner.inspection !== false,
      solves: mergedSolves
    };
    if (maxUpdated > 0) outSess.updatedAt = maxUpdated;
    mergedSessions.push(outSess);
  }

  if (mergedSessions.length === 0) {
    mergedSessions.push({
      id: "default",
      name: "Session 1 (Full Solve)",
      target: "full",
      inspection: true,
      showCube: true,
      solves: []
    });
  }

  return mergedSessions;
}

export const MAX_VALID_RECOG_COUNT = 1000000;

export function sanitizeRecognitionStatsMap(stats) {
  return extractCanonicalStats(stats);
}

function extractCanonicalStats(stats) {
  const nested = {};
  if (!isPlainObject(stats)) return nested;

  const ensureEntry = (puzzle, trackId, caseId, entry) => {
    if (!entry || typeof entry.shown !== "number") return;
    if (!Number.isSafeInteger(entry.shown) || entry.shown < 0 || entry.shown > MAX_VALID_RECOG_COUNT) return;
    const rawCorrect = entry.correct ?? 0;
    if (typeof rawCorrect !== "number" || !Number.isFinite(rawCorrect) || rawCorrect < 0 || rawCorrect > MAX_VALID_RECOG_COUNT) return;
    if (!nested[puzzle]) nested[puzzle] = {};
    if (!nested[puzzle][trackId]) nested[puzzle][trackId] = {};
    const shown = Math.trunc(entry.shown);
    const correct = Math.min(shown, Math.max(0, Math.trunc(rawCorrect)));
    if (shown <= 0) return;
    nested[puzzle][trackId][caseId] = { shown, correct };
  };

  for (const [k, v] of Object.entries(stats)) {
    if (!isPlainObject(v)) continue;
    if (typeof v.shown === "number") {
      // Legacy top-level 2x2 CLL entry; only fill if nested 222.cll doesn't already override
      if (!nested["222"]?.["cll"]?.[k]) {
        ensureEntry("222", "cll", k, v);
      }
    } else {
      for (const [trackId, trackMap] of Object.entries(v)) {
        if (!isPlainObject(trackMap)) continue;
        for (const [caseId, entry] of Object.entries(trackMap)) {
          ensureEntry(k, trackId, caseId, entry);
        }
      }
    }
  }
  return nested;
}

function mergeStats(localStats, remoteStats, baseStats, statsMergeMode = "additive") {
  const lNested = extractCanonicalStats(localStats);
  const rNested = extractCanonicalStats(remoteStats);
  const bNested = baseStats ? extractCanonicalStats(baseStats) : null;

  const merged = {};
  const puzzles = new Set([
    ...Object.keys(lNested),
    ...Object.keys(rNested),
    ...(bNested ? Object.keys(bNested) : [])
  ]);

  for (const puzzle of puzzles) {
    const tracks = new Set([
      ...Object.keys(lNested[puzzle] || {}),
      ...Object.keys(rNested[puzzle] || {}),
      ...Object.keys(bNested?.[puzzle] || {})
    ]);
    for (const trackId of tracks) {
      const cases = new Set([
        ...Object.keys(lNested[puzzle]?.[trackId] || {}),
        ...Object.keys(rNested[puzzle]?.[trackId] || {}),
        ...Object.keys(bNested?.[puzzle]?.[trackId] || {})
      ]);
      for (const caseId of cases) {
        const lRaw = lNested[puzzle]?.[trackId]?.[caseId];
        const rRaw = rNested[puzzle]?.[trackId]?.[caseId];
        const bRaw = bNested?.[puzzle]?.[trackId]?.[caseId];

        const l = lRaw || { shown: 0, correct: 0 };
        const r = rRaw || { shown: 0, correct: 0 };

        let shown = 0;
        let correct = 0;

        if (bRaw && bRaw.shown > 0) {
          const lReset = !lRaw || l.shown === 0;
          const rReset = !rRaw || r.shown === 0;
          const lDeltaShown = Math.max(0, l.shown - bRaw.shown);
          const lDeltaCorrect = Math.max(0, l.correct - bRaw.correct);
          const rDeltaShown = Math.max(0, r.shown - bRaw.shown);
          const rDeltaCorrect = Math.max(0, r.correct - bRaw.correct);

          if (lReset && rReset) {
            shown = 0;
            correct = 0;
          } else if (lReset) {
            shown = rDeltaShown;
            correct = Math.min(shown, rDeltaCorrect);
          } else if (rReset) {
            shown = lDeltaShown;
            correct = Math.min(shown, lDeltaCorrect);
          } else {
            shown = bRaw.shown + lDeltaShown + rDeltaShown;
            correct = bRaw.correct + lDeltaCorrect + rDeltaCorrect;
          }
        } else if (statsMergeMode === "max") {
          // Idempotent merge for stateless JSON backup imports (prevents double-counting on re-import)
          shown = Math.max(l.shown, r.shown);
          correct = Math.min(shown, Math.max(l.correct, r.correct));
        } else if (l.shown === r.shown && l.correct === r.correct) {
          // Identical counts with missing base snapshot indicate same history already synced; do not double!
          shown = l.shown;
          correct = l.correct;
        } else {
          // No prior base and distinct counts: additive across independent machines
          shown = l.shown + r.shown;
          correct = l.correct + r.correct;
        }

        correct = Math.min(shown, Math.max(0, correct));
        if (shown > 0) {
          if (!merged[puzzle]) merged[puzzle] = {};
          if (!merged[puzzle][trackId]) merged[puzzle][trackId] = {};
          merged[puzzle][trackId][caseId] = { shown, correct };

          if (puzzle === "222" && trackId === "cll") {
            merged[caseId] = { shown, correct };
          }
        }
      }
    }
  }

  return merged;
}

function mergeKeyedMap(
  localMap = {},
  remoteMap = {},
  localTsMap = {},
  remoteTsMap = {},
  mergedTombstones = {},
  tieBreaker = null,
  localFallbackTs = 0,
  remoteFallbackTs = 0
) {
  const lObj = isPlainObject(localMap) ? localMap : {};
  const rObj = isPlainObject(remoteMap) ? remoteMap : {};
  const out = {};
  const outTs = {};

  for (const k of new Set([...Object.keys(lObj), ...Object.keys(rObj)])) {
    const delTs = Number(mergedTombstones[k] || 0);
    let lVal = lObj[k];
    let rVal = rObj[k];
    let lt = Number(localTsMap?.[k] || 0);
    let rt = Number(remoteTsMap?.[k] || 0);

    if (lVal !== undefined && delTs > 0 && delTs >= lt) {
      lVal = undefined;
    }
    if (rVal !== undefined && delTs > 0 && delTs >= rt) {
      rVal = undefined;
    }

    if (lVal === undefined && rVal === undefined) continue;
    if (rVal === undefined) {
      out[k] = deepClone(lVal);
      if (lt > 0) outTs[k] = lt;
      continue;
    }
    if (lVal === undefined) {
      out[k] = deepClone(rVal);
      if (rt > 0) outTs[k] = rt;
      continue;
    }

    if (lt > rt) {
      out[k] = deepClone(lVal);
      outTs[k] = lt;
    } else if (rt > lt) {
      out[k] = deepClone(rVal);
      outTs[k] = rt;
    } else if (lt === 0 && rt === 0 && !tieBreaker && remoteFallbackTs > localFallbackTs) {
      out[k] = deepClone(rVal);
    } else {
      out[k] = deepClone(tieBreaker ? tieBreaker(lVal, rVal) : lVal);
      if (lt > 0) outTs[k] = lt;
    }
  }

  return { map: out, timestamps: outTs };
}

function mergePblSettings(localPbl = {}, remotePbl = {}, localTs = {}, remoteTs = {}, mergedTombstones = {}) {
  const lObj = isPlainObject(localPbl) ? localPbl : {};
  const rObj = isPlainObject(remotePbl) ? remotePbl : {};
  const out = {};
  const outTs = {};

  for (const caseId of new Set([...Object.keys(lObj), ...Object.keys(rObj)])) {
    const lEntry = isPlainObject(lObj[caseId]) ? lObj[caseId] : {};
    const rEntry = isPlainObject(rObj[caseId]) ? rObj[caseId] : {};

    const selKey = `${caseId}.selectedAlgId`;
    const ltSel = Number(localTs[selKey] || localTs[caseId] || 0);
    const rtSel = Number(remoteTs[selKey] || remoteTs[caseId] || 0);
    const delSelTs = Number(mergedTombstones[selKey] || 0);

    let lSel = lEntry.selectedAlgId;
    let rSel = rEntry.selectedAlgId;
    if (delSelTs > 0 && delSelTs >= ltSel) lSel = undefined;
    if (delSelTs > 0 && delSelTs >= rtSel) rSel = undefined;

    let mergedSel;
    let mergedSelTs = 0;
    if (lSel !== undefined && rSel !== undefined) {
      if (rtSel > ltSel) {
        mergedSel = rSel;
        mergedSelTs = rtSel;
      } else {
        mergedSel = lSel;
        mergedSelTs = ltSel;
      }
    } else if (lSel !== undefined) {
      mergedSel = lSel;
      mergedSelTs = ltSel;
    } else if (rSel !== undefined) {
      mergedSel = rSel;
      mergedSelTs = rtSel;
    }

    // Merge customLabels per algId
    const lLabels = isPlainObject(lEntry.customLabels) ? lEntry.customLabels : {};
    const rLabels = isPlainObject(rEntry.customLabels) ? rEntry.customLabels : {};
    const mergedLabels = {};

    for (const algId of new Set([...Object.keys(lLabels), ...Object.keys(rLabels)])) {
      const labelKey = `${caseId}.customLabels.${algId}`;
      const lt = Number(localTs[labelKey] || 0);
      const rt = Number(remoteTs[labelKey] || 0);
      const delTs = Number(mergedTombstones[labelKey] || 0);

      let lv = lLabels[algId];
      let rv = rLabels[algId];
      if (delTs > 0 && delTs >= lt) lv = undefined;
      if (delTs > 0 && delTs >= rt) rv = undefined;

      if (lv === undefined && rv === undefined) continue;
      if (rv === undefined) {
        mergedLabels[algId] = lv;
        if (lt > 0) outTs[labelKey] = lt;
      } else if (lv === undefined) {
        mergedLabels[algId] = rv;
        if (rt > 0) outTs[labelKey] = rt;
      } else if (rt > lt) {
        mergedLabels[algId] = rv;
        outTs[labelKey] = rt;
      } else {
        mergedLabels[algId] = lv;
        if (lt > 0) outTs[labelKey] = lt;
      }
    }

    const nextEntry = {};
    if (mergedSel) {
      nextEntry.selectedAlgId = mergedSel;
      if (mergedSelTs > 0) outTs[selKey] = mergedSelTs;
    }
    if (Object.keys(mergedLabels).length > 0) {
      nextEntry.customLabels = mergedLabels;
    }
    if (Object.keys(nextEntry).length > 0) {
      out[caseId] = nextEntry;
    }
  }

  return { pblSettings: out, timestamps: outTs };
}

function mergeSavedCubes(localCubes = [], remoteCubes = [], localDeleted = [], remoteDeleted = [], deletedTombstones = {}) {
  const byName = new Map();
  const addCube = (c) => {
    if (!c || !c.name) return;
    const prev = byName.get(c.name);
    if (!prev) {
      byName.set(c.name, { ...c });
      return;
    }
    const prevTs = Number(prev.lastConnected || 0);
    const nextTs = Number(c.lastConnected || 0);
    const newer = nextTs > prevTs ? c : prev;
    const older = newer === c ? prev : c;
    byName.set(c.name, {
      name: c.name,
      mac: newer.mac || older.mac || "",
      protocol: newer.protocol || older.protocol || "Smart Cube",
      lastConnected: Math.max(prevTs, nextTs)
    });
  };

  for (const c of (Array.isArray(localCubes) ? localCubes : [])) addCube(c);
  for (const c of (Array.isArray(remoteCubes) ? remoteCubes : [])) addCube(c);

  const deletedNames = new Set([
    ...(Array.isArray(localDeleted) ? localDeleted : []),
    ...(Array.isArray(remoteDeleted) ? remoteDeleted : []),
    ...Object.keys(deletedTombstones || {})
  ]);

  const activeDeleted = new Set();
  const keptCubes = [];

  for (const name of new Set([...byName.keys(), ...deletedNames])) {
    const cube = byName.get(name);
    const delTs = Number(deletedTombstones[name] || 0);
    const isDeleted = deletedNames.has(name);

    if (!cube) {
      if (isDeleted) activeDeleted.add(name);
      continue;
    }

    const cubeTs = Number(cube.lastConnected || 0);
    // If reconnected after deletion timestamp, revive; if deleted with delTs >= cubeTs (or delTs === 0 & local/remote deleted), keep deleted
    if (isDeleted && (delTs === 0 || delTs >= cubeTs)) {
      activeDeleted.add(name);
    } else {
      keptCubes.push(cube);
    }
  }

  keptCubes.sort((a, b) => (b.lastConnected || 0) - (a.lastConnected || 0));
  return {
    savedSmartCubes: keptCubes.slice(0, 20),
    deletedSmartCubes: [...activeDeleted]
  };
}

function collectSolveFingerprints(sessions = []) {
  const set = new Set();
  for (const sess of (Array.isArray(sessions) ? sessions : [])) {
    for (const sv of (Array.isArray(sess?.solves) ? sess.solves : [])) {
      const fp = getSolveFingerprint(sv);
      if (fp) set.add(fp);
    }
  }
  return set;
}

function countStatDiffs(mergedStats = {}, baseStats = {}) {
  const mNested = extractCanonicalStats(mergedStats);
  const bNested = extractCanonicalStats(baseStats);
  let diffs = 0;

  for (const puzzle of new Set([...Object.keys(mNested), ...Object.keys(bNested)])) {
    for (const trackId of new Set([...Object.keys(mNested[puzzle] || {}), ...Object.keys(bNested[puzzle] || {})])) {
      for (const caseId of new Set([...Object.keys(mNested[puzzle]?.[trackId] || {}), ...Object.keys(bNested[puzzle]?.[trackId] || {})])) {
        const m = mNested[puzzle]?.[trackId]?.[caseId];
        const b = bNested[puzzle]?.[trackId]?.[caseId];
        if (canonicalStringify(m) !== canonicalStringify(b)) diffs++;
      }
    }
  }
  return diffs;
}

function countSettingDiffs(mergedSettings = {}, baseSettings = {}) {
  let diffs = 0;
  for (const field of SETTINGS_SCALAR_FIELDS) {
    if (field === "casesCollapsed") continue; // alias of settingsCollapsed
    if (canonicalStringify(mergedSettings[field]) !== canonicalStringify(baseSettings[field])) {
      diffs++;
    }
  }
  const mTrack = mergedSettings.selectedByTrack || {};
  const bTrack = baseSettings.selectedByTrack || {};
  for (const k of new Set([...Object.keys(mTrack), ...Object.keys(bTrack)])) {
    if (canonicalStringify(mTrack[k]) !== canonicalStringify(bTrack[k])) diffs++;
  }
  return diffs;
}

function countMapDiffs(mergedMap = {}, baseMap = {}) {
  let diffs = 0;
  for (const k of new Set([...Object.keys(mergedMap || {}), ...Object.keys(baseMap || {})])) {
    if (canonicalStringify(mergedMap?.[k]) !== canonicalStringify(baseMap?.[k])) diffs++;
  }
  return diffs;
}

function computeSummary(local, remote, merged) {
  const localFps = collectSolveFingerprints(local?.sessions);
  const remoteFps = collectSolveFingerprints(remote?.sessions);
  const mergedFps = collectSolveFingerprints(merged?.sessions);

  let addedSolves = 0;
  let uploadedSolves = 0;
  for (const fp of mergedFps) {
    if (!localFps.has(fp)) addedSolves++;
    if (!remoteFps.has(fp)) uploadedSolves++;
  }

  const localSessIds = new Set((local?.sessions || []).map(s => s.id));
  const addedSessions = (merged?.sessions || []).filter(s => !localSessIds.has(s.id)).length;

  return {
    addedSolves,
    uploadedSolves,
    addedSessions,
    updatedSettings: countSettingDiffs(merged?.settings, local?.settings),
    mergedStatsCases: countStatDiffs(merged?.stats, local?.stats),
    mergedTags: countMapDiffs(merged?.caseTags, local?.caseTags),
    mergedLabels: countMapDiffs(merged?.customCllLabels, local?.customCllLabels),
    mergedPreferredAlgs: countMapDiffs(merged?.preferredAlgs, local?.preferredAlgs)
  };
}

function extractComparablePayload(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return null;
  return {
    settings: snapshot.settings || {},
    sessions: snapshot.sessions || [],
    stats: snapshot.stats || {},
    caseTags: snapshot.caseTags || {},
    customCllLabels: snapshot.customCllLabels || {},
    pblSettings: snapshot.pblSettings || {},
    preferredAlgs: snapshot.preferredAlgs || {},
    savedSmartCubes: snapshot.savedSmartCubes || [],
    deletedSmartCubes: snapshot.deletedSmartCubes || [],
    tombstones: snapshot.tombstones || {},
    timestamps: snapshot.timestamps || {}
  };
}

export function mergeSyncPayloads(local, remote, base = null, now = Date.now(), options = {}) {
  const localEmpty = isSnapshotEmpty(local);
  const remoteEmpty = isSnapshotEmpty(remote);

  // Fresh-machine fast path: adopt remote cleanly without letting local defaults overwrite remote
  if (localEmpty && !remoteEmpty) {
    const merged = {
      ...deepClone(remote),
      schemaVersion: SYNC_SCHEMA_VERSION,
      hasLocalSettings: true
    };
    return {
      merged,
      summary: computeSummary(local, remote, merged),
      localChanged: true,
      remoteChanged: false
    };
  }

  // Empty remote fast path: upload local cleanly
  if (!localEmpty && remoteEmpty) {
    const merged = {
      ...deepClone(local),
      schemaVersion: SYNC_SCHEMA_VERSION,
      hasLocalSettings: true
    };
    return {
      merged,
      summary: computeSummary(local, remote, merged),
      localChanged: false,
      remoteChanged: true
    };
  }

  const mergedTombstones = mergeTombstones(local?.tombstones, remote?.tombstones, now);

  const {
    settings: mergedSettings,
    settingsTs: mergedSettingsTs,
    selectedByTrackTs: mergedSelectedByTrackTs
  } = mergeSettings(local, remote);

  const mergedSessions = mergeSessions(local?.sessions, remote?.sessions, mergedTombstones);

  // Ensure activeSessionId resolves to an existing session in mergedSessions
  const validSessionIds = new Set(mergedSessions.map(s => s.id));
  if (!mergedSettings.activeSessionId || !validSessionIds.has(mergedSettings.activeSessionId)) {
    const puzzleMatch = mergedSessions.find(s => (s.puzzle || "222") === (mergedSettings.currentPuzzle || "222"));
    const fallbackSession = puzzleMatch || mergedSessions[0];
    mergedSettings.activeSessionId = fallbackSession.id;
    mergedSettings.solveTarget = fallbackSession.target || "full";
    mergedSettings.solveShowCube = fallbackSession.showCube !== false;
    mergedSettings.solveInspection = fallbackSession.inspection !== false;
  }

  const statsMergeMode = options?.statsMergeMode === "max" ? "max" : "additive";
  const mergedStats = mergeStats(local?.stats, remote?.stats, base?.stats || null, statsMergeMode);

  const lUpdated = Number(local?.updatedAt || 0);
  const rUpdated = Number(remote?.updatedAt || 0);

  const tagMerge = mergeKeyedMap(
    local?.caseTags,
    remote?.caseTags,
    local?.timestamps?.caseTags,
    remote?.timestamps?.caseTags,
    mergedTombstones.caseTags,
    (lv, rv) => ((CASE_TAG_RANK[rv] || 0) > (CASE_TAG_RANK[lv] || 0) ? rv : lv),
    lUpdated,
    rUpdated
  );

  const labelMerge = mergeKeyedMap(
    local?.customCllLabels,
    remote?.customCllLabels,
    local?.timestamps?.customCllLabels,
    remote?.timestamps?.customCllLabels,
    mergedTombstones.customCllLabels,
    null,
    lUpdated,
    rUpdated
  );

  const prefAlgMerge = mergeKeyedMap(
    local?.preferredAlgs,
    remote?.preferredAlgs,
    local?.timestamps?.preferredAlgs,
    remote?.timestamps?.preferredAlgs,
    mergedTombstones.preferredAlgs,
    null,
    lUpdated,
    rUpdated
  );

  const pblMerge = mergePblSettings(
    local?.pblSettings,
    remote?.pblSettings,
    local?.timestamps?.pblSettings,
    remote?.timestamps?.pblSettings,
    mergedTombstones.pblSettings
  );

  const cubeMerge = mergeSavedCubes(
    local?.savedSmartCubes,
    remote?.savedSmartCubes,
    local?.deletedSmartCubes,
    remote?.deletedSmartCubes,
    mergedTombstones.deletedSmartCubes
  );

  const merged = {
    schemaVersion: SYNC_SCHEMA_VERSION,
    updatedAt: Math.max(lUpdated, rUpdated, now),
    hasLocalSettings: true,
    settings: mergedSettings,
    sessions: mergedSessions,
    stats: mergedStats,
    caseTags: tagMerge.map,
    customCllLabels: labelMerge.map,
    pblSettings: pblMerge.pblSettings,
    preferredAlgs: prefAlgMerge.map,
    savedSmartCubes: cubeMerge.savedSmartCubes,
    deletedSmartCubes: cubeMerge.deletedSmartCubes,
    tombstones: mergedTombstones,
    timestamps: {
      settings: mergedSettingsTs,
      selectedByTrack: mergedSelectedByTrackTs,
      caseTags: tagMerge.timestamps,
      customCllLabels: labelMerge.timestamps,
      pblSettings: pblMerge.timestamps,
      preferredAlgs: prefAlgMerge.timestamps,
      sessions: mergeTimestampMap(local?.timestamps?.sessions, remote?.timestamps?.sessions)
    }
  };

  const mergedComp = canonicalStringify(extractComparablePayload(merged));
  const localComp = canonicalStringify(extractComparablePayload(local));
  const remoteComp = canonicalStringify(extractComparablePayload(remote));

  const localChanged = mergedComp !== localComp;
  const remoteChanged = !remote || mergedComp !== remoteComp;

  if (!localChanged && !remoteChanged) {
    merged.updatedAt = Math.max(lUpdated, rUpdated);
  }

  return {
    merged,
    summary: computeSummary(local, remote, merged),
    localChanged,
    remoteChanged
  };
}
