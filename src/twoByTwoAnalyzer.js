// 2x2x2 CLL, EG-1, EG-2, and Ortega Smart Cube Solve Analyzer
// Color-neutrally detects 1st Layer/Face color, move count, time splits, exact CLL/EG-1/EG-2 case,
// recognition vs execution splits, trailing AUF, and per-case performance statistics.

import { Alg } from 'cubing/alg';
import { cllCases } from './data/cllData.js';
import { eg1Cases, eg2Cases } from './data/egData.js';
import { ORIENTATIONS_24, getSolvedOrientations } from './cube/cubeUtils.js';
import {
  DEFAULT_PAUSE_THRESHOLD_MS,
  collapseDoubleFlickMoves,
  computeMedian,
  computeTrimmedMean,
  computePhaseRecogSetupExec
} from './cfopAnalyzer.js';

export const TWO_BY_TWO_COLOR_NAMES = ["White", "Yellow", "Green", "Blue", "Red", "Orange"];
export const TWO_BY_TWO_ANALYSIS_VERSION = 7;

const OPPOSITE_COLOR_NAME = {
  White: "Yellow",
  Yellow: "White",
  Green: "Blue",
  Blue: "Green",
  Red: "Orange",
  Orange: "Red"
};

let kp222 = null;
let defaultPat222 = null;
let initPromise = null;

// Candidate rotations bringing each physical cube face to Bottom (D)
const CANDIDATE_ROTATIONS_222 = [
  { rot: "",   inv: "",   uFace: "U", transCache: new Map(), rotTrans: null, invTrans: null },
  { rot: "z2", inv: "z2", uFace: "D", transCache: new Map(), rotTrans: null, invTrans: null },
  { rot: "x'", inv: "x",  uFace: "B", transCache: new Map(), rotTrans: null, invTrans: null },
  { rot: "x",  inv: "x'", uFace: "F", transCache: new Map(), rotTrans: null, invTrans: null },
  { rot: "z",  inv: "z'", uFace: "L", transCache: new Map(), rotTrans: null, invTrans: null },
  { rot: "z'", inv: "z",  uFace: "R", transCache: new Map(), rotTrans: null, invTrans: null }
];

// All 24 solved 2x2x2 orientations indexed by their D-layer corner piece+orientation signature
const dLayerOrientMap = new Map();
// Back-Bar (EG-1) and Diagonal-Swap (EG-2) D-layer orientations mapped to bottom color + left/right inverse transforms
const dLayerEg1OrientMap = new Map();
const dLayerEg2OrientMap = new Map();
// Piece -> required D-slot orientation map for each of the 6 colors (used for 1st-face detection)
const faceColorPiecesMap = new Map();
// Canonical CLL key -> cllCase metadata (40 CLL cases + cll-skip)
const cllKeyMap = new Map();
// Canonical EG-1 & EG-2 keys -> case metadata (40 cases each)
const eg1KeyMap = new Map();
const eg2KeyMap = new Map();
let yTrans222 = null;
let yInvTrans222 = null;

function getBottomColorForRotation(rotStr) {
  if (!rotStr || rotStr.startsWith("y")) return "Yellow";
  if (rotStr.startsWith("x2")) return "White";
  if (rotStr.startsWith("x'")) return "Green";
  if (rotStr.startsWith("x")) return "Blue";
  if (rotStr.startsWith("z'")) return "Orange";
  if (rotStr.startsWith("z")) return "Red";
  return "Yellow";
}

function getDLayerSignature(pat) {
  const cp = pat.patternData.CORNERS.pieces;
  const co = pat.patternData.CORNERS.orientation;
  return `${cp[4]}:${co[4]},${cp[5]}:${co[5]},${cp[6]}:${co[6]},${cp[7]}:${co[7]}`;
}

export function computeCllCanonicalKey(relPat) {
  if (!relPat?.patternData?.CORNERS) return null;
  const { pieces: cp, orientation: co } = relPat.patternData.CORNERS;
  for (let i = 4; i < 8; i++) {
    if (cp[i] !== i || co[i] !== 0) return null;
  }

  let best = null;
  for (let pre = 0; pre < 4; pre++) {
    for (let post = 0; post < 4; post++) {
      let s = "";
      for (let i = 0; i < 4; i++) {
        const slot = (i + pre) % 4;
        const piece = (cp[slot] + post) % 4;
        s += `${piece}${co[slot]}`;
      }
      if (best === null || s < best) best = s;
    }
  }
  return best;
}

export function computeEg1CanonicalKey(relPat) {
  if (!relPat?.patternData?.CORNERS) return null;
  const { pieces: cp, orientation: co } = relPat.patternData.CORNERS;
  if (cp[4] !== 5 || cp[5] !== 4 || cp[6] !== 6 || cp[7] !== 7) return null;
  for (let i = 4; i < 8; i++) {
    if (co[i] !== 0) return null;
  }

  let best = null;
  for (let pre = 0; pre < 4; pre++) {
    for (let post = 0; post < 4; post++) {
      let s = "";
      for (let i = 0; i < 4; i++) {
        const slot = (i + pre) % 4;
        const piece = (cp[slot] + post) % 4;
        s += `${piece}${co[slot]}`;
      }
      if (best === null || s < best) best = s;
    }
  }
  return best;
}

export function computeEg2CanonicalKey(relPatOrTrans) {
  if (!relPatOrTrans) return null;
  const relTrans = getPatternTransform(relPatOrTrans);
  let pat = relTrans && defaultPat222 ? defaultPat222.applyTransformation(relTrans) : relPatOrTrans;
  if (!pat?.patternData?.CORNERS) return null;
  let { pieces: cp, orientation: co } = pat.patternData.CORNERS;
  for (let i = 4; i < 8; i++) {
    if (co[i] !== 0) return null;
  }
  if (cp[4] === 6 && cp[5] === 5 && cp[6] === 4 && cp[7] === 7 && relTrans && yTrans222 && yInvTrans222 && defaultPat222) {
    pat = defaultPat222.applyTransformation(yTrans222.applyTransformation(relTrans).applyTransformation(yInvTrans222));
    ({ pieces: cp, orientation: co } = pat.patternData.CORNERS);
  }
  if (cp[4] !== 4 || cp[5] !== 7 || cp[6] !== 6 || cp[7] !== 5) return null;

  let best = null;
  for (let pre = 0; pre < 4; pre++) {
    for (let post = 0; post < 4; post++) {
      let s = "";
      for (let i = 0; i < 4; i++) {
        const slot = (i + pre) % 4;
        const piece = (cp[slot] + post) % 4;
        s += `${piece}${co[slot]}`;
      }
      if (best === null || s < best) best = s;
    }
  }
  return best;
}

function buildLookupTables(kp, defPat) {
  dLayerOrientMap.clear();
  dLayerEg1OrientMap.clear();
  dLayerEg2OrientMap.clear();
  faceColorPiecesMap.clear();
  cllKeyMap.clear();
  eg1KeyMap.clear();
  eg2KeyMap.clear();

  yTrans222 = kp.algToTransformation(new Alg("y"));
  yInvTrans222 = yTrans222.invert();

  for (const cand of CANDIDATE_ROTATIONS_222) {
    cand.transCache.clear();
    cand.rotTrans = cand.rot ? kp.algToTransformation(new Alg(cand.rot)) : null;
    cand.invTrans = cand.inv ? kp.algToTransformation(new Alg(cand.inv)) : null;
  }

  const eg1BaseSetup = eg1Cases[0]?.setup || "";
  const eg2BaseSetup = eg2Cases[0]?.setup || "";

  for (const rotStr of ORIENTATIONS_24) {
    const alg = new Alg(rotStr);
    const pat = rotStr ? defPat.applyAlg(alg) : defPat;
    const bottomColor = getBottomColorForRotation(rotStr);
    const sig = getDLayerSignature(pat);
    const trans = kp.algToTransformation(alg);
    const invLeft = trans.invert();

    dLayerOrientMap.set(sig, {
      rotStr,
      bottomColor,
      invTrans: invLeft
    });

    if (!faceColorPiecesMap.has(bottomColor)) {
      const req = new Map();
      const { pieces: cp, orientation: co } = pat.patternData.CORNERS;
      for (let s = 4; s < 8; s++) req.set(cp[s], co[s]);
      faceColorPiecesMap.set(bottomColor, req);
    }

    if (eg1BaseSetup && eg2BaseSetup) {
      for (const yBar of ["", "y", "y2", "y'"]) {
        const yAlg = new Alg(yBar);
        const yInvRight = kp.algToTransformation(yAlg).invert();

        const p1Base = pat.applyAlg(new Alg(eg1BaseSetup));
        const p1 = yBar ? p1Base.applyAlg(yAlg) : p1Base;
        const sig1 = getDLayerSignature(p1);
        if (!dLayerEg1OrientMap.has(sig1)) {
          dLayerEg1OrientMap.set(sig1, { bottomColor, invLeft, invRight: yInvRight });
        }

        const p2Base = pat.applyAlg(new Alg(eg2BaseSetup));
        const p2 = yBar ? p2Base.applyAlg(yAlg) : p2Base;
        const sig2 = getDLayerSignature(p2);
        if (!dLayerEg2OrientMap.has(sig2)) {
          dLayerEg2OrientMap.set(sig2, { bottomColor, invLeft, invRight: yInvRight });
        }
      }
    }
  }

  for (const c of cllCases) {
    try {
      const pat = defPat.applyAlg(new Alg(c.setup));
      const key = computeCllCanonicalKey(pat);
      if (key) {
        cllKeyMap.set(key, {
          id: c.id,
          name: c.name ? `${c.id} (${c.name})` : c.id,
          shortName: c.id,
          group: String(c.group || "").replace(/-Group$/, "") || c.id[0],
          isSkip: false
        });
      }
    } catch (e) {
      console.warn("Failed to index CLL case:", c.id, e);
    }
  }

  for (const c of eg1Cases) {
    try {
      const pat = defPat.applyAlg(new Alg(c.setup));
      const key = computeEg1CanonicalKey(pat);
      if (key) {
        eg1KeyMap.set(key, {
          id: c.id,
          name: c.name || c.id,
          shortName: c.shortName || c.id,
          group: String(c.group || "").replace(/-Group$/, "") || c.cllCounterpart?.[0] || "EG",
          cllCounterpart: c.cllCounterpart || null,
          isSkip: false
        });
      }
    } catch (e) {
      console.warn("Failed to index EG-1 case:", c.id, e);
    }
  }

  for (const c of eg2Cases) {
    try {
      const pat = defPat.applyAlg(new Alg(c.setup));
      const key = computeEg2CanonicalKey(pat);
      if (key) {
        eg2KeyMap.set(key, {
          id: c.id,
          name: c.name || c.id,
          shortName: c.shortName || c.id,
          group: String(c.group || "").replace(/-Group$/, "") || c.cllCounterpart?.[0] || "EG",
          cllCounterpart: c.cllCounterpart || null,
          isSkip: false
        });
      }
    } catch (e) {
      console.warn("Failed to index EG-2 case:", c.id, e);
    }
  }

  cllKeyMap.set("00103020", {
    id: "pll-adj",
    name: "Adjacent Swap (PLL)",
    shortName: "Adj",
    group: "PLL",
    isSkip: false
  });

  cllKeyMap.set("00302010", {
    id: "pll-diag",
    name: "Diagonal Swap (PLL)",
    shortName: "Diag",
    group: "PLL",
    isSkip: false
  });

  cllKeyMap.set("00102030", {
    id: "cll-skip",
    name: "CLL Skip",
    shortName: "Skip",
    group: "Skip",
    isSkip: true
  });
}

export async function initTwoByTwoAnalyzer() {
  if (kp222 && defaultPat222) return true;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      const solvedData = await getSolvedOrientations("2x2x2");
      if (!solvedData?.kpuzzle || !solvedData?.defaultPat) return false;
      kp222 = solvedData.kpuzzle;
      defaultPat222 = solvedData.defaultPat;
      buildLookupTables(kp222, defaultPat222);
      return true;
    } catch (e) {
      console.warn("Could not initialize 2x2 CLL analyzer:", e);
      return false;
    }
  })();
  return initPromise;
}

// Eagerly initialize
initTwoByTwoAnalyzer().catch(() => {});

export function isTwoByTwoAnalyzerReady() {
  return Boolean(kp222 && defaultPat222);
}

function getPatternTransform(patOrTrans) {
  if (!patOrTrans) return null;
  if (typeof patOrTrans.experimentalToTransformation === "function") {
    return patOrTrans.experimentalToTransformation();
  }
  return patOrTrans;
}

function getDLayerColorFaceMatch(pat, slotsStart, slotsEnd, targetColor) {
  const reqMap = targetColor ? faceColorPiecesMap.get(targetColor) : null;
  const { pieces: cp, orientation: co } = pat.patternData.CORNERS;
  if (reqMap) {
    for (let s = slotsStart; s < slotsEnd; s++) {
      if (reqMap.get(cp[s]) !== co[s]) return null;
    }
    return targetColor;
  }
  for (const [colorName, map] of faceColorPiecesMap.entries()) {
    let allMatch = true;
    for (let s = slotsStart; s < slotsEnd; s++) {
      if (map.get(cp[s]) !== co[s]) {
        allMatch = false;
        break;
      }
    }
    if (allMatch) return colorName;
  }
  return null;
}

function evaluateCandidateState(patTrans, cand) {
  const tCand = cand.rot
    ? patTrans.applyTransformation(cand.rotTrans)
    : patTrans;
  const pCand = defaultPat222.applyTransformation(tCand);
  const dSig = getDLayerSignature(pCand);
  const orient = dLayerOrientMap.get(dSig);

  if (orient) {
    const relPat = defaultPat222.applyTransformation(orient.invTrans.applyTransformation(tCand));
    const cllKey = computeCllCanonicalKey(relPat);
    if (cllKey) {
      const cllCase = cllKeyMap.get(cllKey) || null;
      return {
        layerOk: true,
        faceOk: true,
        layerColor: orient.bottomColor,
        faceColor: orient.bottomColor,
        cllCase,
        egMethod: null,
        egCase: null,
        isSkip: cllKey === "00102030",
        ollOk: true
      };
    }
  }

  const faceColor = getDLayerColorFaceMatch(pCand, 4, 8, null);
  const oppColor = faceColor ? OPPOSITE_COLOR_NAME[faceColor] : null;
  const ollOk = Boolean(faceColor && oppColor && getDLayerColorFaceMatch(pCand, 0, 4, oppColor));

  let egMethod = null;
  let egCase = null;
  if (faceColor) {
    const eg1Orient = dLayerEg1OrientMap.get(dSig);
    if (eg1Orient) {
      const relTrans = eg1Orient.invLeft.applyTransformation(tCand).applyTransformation(eg1Orient.invRight);
      const eg1Key = computeEg1CanonicalKey(defaultPat222.applyTransformation(relTrans));
      if (eg1Key && eg1KeyMap.has(eg1Key)) {
        egMethod = "eg1";
        egCase = eg1KeyMap.get(eg1Key);
      }
    } else {
      const eg2Orient = dLayerEg2OrientMap.get(dSig);
      if (eg2Orient) {
        const relTrans = eg2Orient.invLeft.applyTransformation(tCand).applyTransformation(eg2Orient.invRight);
        const eg2Key = computeEg2CanonicalKey(relTrans);
        if (eg2Key && eg2KeyMap.has(eg2Key)) {
          egMethod = "eg2";
          egCase = eg2KeyMap.get(eg2Key);
        }
      }
    }
  }

  return {
    layerOk: false,
    faceOk: Boolean(faceColor),
    layerColor: null,
    faceColor,
    cllCase: null,
    egMethod,
    egCase,
    isSkip: false,
    ollOk
  };
}

/**
 * Identify the 1st Layer color and exact CLL case (or Skip) from a 2x2x2 KPattern or KTransformation.
 * Checks all 6 faces color-neutrally across all 24 cube orientations.
 */
export function identifyCllFromPattern(patOrTrans) {
  if (!kp222 || !defaultPat222 || !patOrTrans) return null;
  const patTrans = getPatternTransform(patOrTrans);
  if (!patTrans) return null;

  for (const cand of CANDIDATE_ROTATIONS_222) {
    const ev = evaluateCandidateState(patTrans, cand);
    if (ev.layerOk && ev.cllCase) {
      return {
        layerColor: ev.layerColor,
        cllCase: ev.cllCase,
        isSkip: ev.isSkip,
        uFace: cand.uFace,
        candRot: cand.rot
      };
    }
  }
  return null;
}

/**
 * Identify a 1st Face color and exact EG-1 (Back Bar) or EG-2 (Diag Swap) case from a 2x2x2 KPattern or KTransformation.
 * Checks all 6 faces color-neutrally across all 24 cube orientations and bar positions.
 */
export function identifyEgFromPattern(patOrTrans) {
  if (!kp222 || !defaultPat222 || !patOrTrans) return null;
  const patTrans = getPatternTransform(patOrTrans);
  if (!patTrans) return null;

  for (const cand of CANDIDATE_ROTATIONS_222) {
    const ev = evaluateCandidateState(patTrans, cand);
    if (ev.faceOk && ev.egMethod && ev.egCase) {
      return {
        method: ev.egMethod,
        faceColor: ev.faceColor,
        egCase: ev.egCase,
        uFace: cand.uFace,
        candRot: cand.rot
      };
    }
  }
  return null;
}

function getMoveFaceLetter(moveStr) {
  const m = String(moveStr || "").trim().match(/^([UDFBLR])/);
  return m ? m[1] : "";
}

function isLayerUMove(moveStr, cand) {
  return getMoveFaceLetter(moveStr) === cand.uFace;
}

function isLayerSetupMove(moveStr, cand) {
  if (!moveStr) return false;
  if (/^[xyz][2']?$/i.test(String(moveStr).trim())) return true;
  return isLayerUMove(moveStr, cand);
}

function normalizeMovesWithTiming(moves = []) {
  return moves.map((m, idx) => {
    const moveStr = String(m.move || "").trim();
    const t = typeof m.t === "number" ? m.t : 0;
    const prevT = idx === 0 ? 0 : (typeof moves[idx - 1].t === "number" ? moves[idx - 1].t : 0);
    const isRotation = Boolean(m.isRotation || /^[xyz][2']?$/i.test(moveStr));
    const split = isRotation
      ? 0
      : (typeof m.split === "number" && m.split > 0 ? m.split : Math.max(0, t - prevT));
    return { move: moveStr, t, split, isRotation, index: idx };
  });
}

function getCachedMoveTrans222(moveStr) {
  const cache = CANDIDATE_ROTATIONS_222[0].transCache;
  let tr = cache.get(moveStr);
  if (!tr && kp222) {
    tr = kp222.algToTransformation(new Alg(moveStr));
    cache.set(moveStr, tr);
  }
  return tr;
}

function buildPhaseStep({
  key,
  label,
  caseId,
  startIdx,
  endIdx,
  normMoves,
  timeAtIndex,
  allPauses,
  pauseThresholdMs,
  cand,
  isSetupAware = false
}) {
  const startMs = timeAtIndex(startIdx);
  const endMs = timeAtIndex(endIdx);
  const durationMs = Math.max(0, endMs - startMs);
  const phaseMoves = normMoves.slice(startIdx, endIdx);
  const phasePauses = [];

  for (const mv of phaseMoves) {
    if (mv.split >= pauseThresholdMs) {
      phasePauses.push(mv);
    }
    const matchP = allPauses.find(p => p.moveIndex === mv.index);
    if (matchP) {
      matchP.phase = key;
      matchP.phaseLabel = label;
    }
  }

  const phasePauseMs = phasePauses.reduce((acc, m) => acc + m.split, 0);
  const phaseMaxPauseMs = phasePauses.length > 0 ? Math.max(...phasePauses.map(m => m.split)) : 0;

  let setupMoveCount = 0;
  if (isSetupAware && phaseMoves.length > 0) {
    while (setupMoveCount < phaseMoves.length && isLayerSetupMove(phaseMoves[setupMoveCount].move, cand)) {
      setupMoveCount++;
    }
  }

  const setupMoves = collapseDoubleFlickMoves(phaseMoves.slice(0, setupMoveCount).map(m => m.move)).join(" ");
  const execMoves = collapseDoubleFlickMoves(phaseMoves.slice(setupMoveCount).map(m => m.move)).join(" ");
  const allCollapsedMoves = collapseDoubleFlickMoves(phaseMoves.map(m => m.move)).join(" ");

  const { recogMs, setupMs, execMs } = isSetupAware
    ? computePhaseRecogSetupExec(phaseMoves, setupMoveCount, durationMs, pauseThresholdMs)
    : { recogMs: 0, setupMs: 0, execMs: durationMs };

  const faceTurnCount = phaseMoves.filter(m => !m.isRotation).length;
  const tps = durationMs > 0 ? Number((faceTurnCount / (durationMs / 1000)).toFixed(2)) : 0;

  return {
    phase: key,
    label,
    caseId,
    ms: durationMs,
    recogMs,
    setupMs,
    setupMoves,
    execMs,
    execMoves,
    accumMs: endMs,
    startMoveIdx: startIdx,
    endMoveIdx: endIdx,
    moveCount: faceTurnCount,
    tps,
    moves: allCollapsedMoves || phaseMoves.map(m => m.move).join(" "),
    rawMoves: phaseMoves.map(m => m.move).join(" "),
    pauseCount: phasePauses.length,
    pauseMs: phasePauseMs,
    maxPauseMs: phaseMaxPauseMs
  };
}

/**
 * Synchronously analyze a 2x2x2 smart cube solve into 1st Layer + CLL (+ AUF) or Ortega splits.
 */
export function analyzeTwoByTwoSolveSync(solve, options = {}) {
  if (!solve) return null;
  if (solve.puzzle && solve.puzzle !== "222") return null;

  const methodPref = ["cll", "auto", "ortega", "eg"].includes(options.twoByTwoMethod)
    ? options.twoByTwoMethod
    : "cll";
  const pauseThresholdMs = options.pauseThresholdMs || DEFAULT_PAUSE_THRESHOLD_MS;
  const moves = Array.isArray(solve.moves) ? solve.moves : [];
  const rawMs = solve.cubeMs != null ? solve.cubeMs : (solve.rawMs != null ? solve.rawMs : (solve.ms != null ? solve.ms : 0));

  const normMoves = normalizeMovesWithTiming(moves);
  const allPauses = [];
  for (let i = 0; i < normMoves.length; i++) {
    const mv = normMoves[i];
    if (mv.split >= pauseThresholdMs) {
      allPauses.push({
        moveIndex: i,
        move: mv.move,
        durationMs: mv.split,
        atMs: mv.t,
        phase: "solve"
      });
    }
  }
  const totalPauseMs = allPauses.reduce((acc, p) => acc + p.durationMs, 0);
  const maxPauseMs = allPauses.length > 0 ? Math.max(...allPauses.map(p => p.durationMs)) : 0;

  if (!kp222 || !defaultPat222 || normMoves.length === 0 || !solve.scramble) {
    // Support manual CLL / EG-1 / EG-2 practice solves without smart cube move streams
    if ((solve.target === "cll" || solve.track === "cll") && solve.id) {
      const foundCll = cllCases.find(c => c.id === solve.id);
      if (foundCll) {
        return {
          version: TWO_BY_TWO_ANALYSIS_VERSION,
          method: "cll",
          methodPref,
          layerColor: "White",
          splits: { layer: null, cll: rawMs, auf: null, face: null, oll: null, pbl: null },
          steps: [],
          aufSummary: null,
          cllCase: {
            id: foundCll.id,
            name: foundCll.name ? `${foundCll.id} (${foundCll.name})` : foundCll.id,
            shortName: foundCll.id,
            group: String(foundCll.group || "").replace(/-Group$/, "") || foundCll.id[0],
            isSkip: false,
            ms: rawMs,
            recogMs: null,
            execMs: null,
            setupMoves: "",
            moveCount: null,
            pauseCount: allPauses.length,
            pauseMs: totalPauseMs
          },
          egCase: null,
          pauses: {
            thresholdMs: pauseThresholdMs,
            totalCount: allPauses.length,
            totalMs: totalPauseMs,
            maxPauseMs,
            list: allPauses
          }
        };
      }
    }
    if ((solve.target === "eg1" || solve.track === "eg1" || solve.target === "eg2" || solve.track === "eg2") && solve.id) {
      const isEg2 = solve.target === "eg2" || solve.track === "eg2";
      const pool = isEg2 ? eg2Cases : eg1Cases;
      const foundEg = pool.find(c => c.id === solve.id);
      if (foundEg) {
        return {
          version: TWO_BY_TWO_ANALYSIS_VERSION,
          method: isEg2 ? "eg2" : "eg1",
          methodPref,
          layerColor: "White",
          splits: { layer: null, cll: null, eg: rawMs, auf: null, face: null, oll: null, pbl: null },
          steps: [],
          aufSummary: null,
          cllCase: null,
          egCase: {
            id: foundEg.id,
            name: foundEg.name || foundEg.id,
            shortName: foundEg.shortName || foundEg.id,
            group: String(foundEg.group || "").replace(/-Group$/, "") || foundEg.cllCounterpart?.[0] || "EG",
            cllCounterpart: foundEg.cllCounterpart || null,
            isSkip: false,
            ms: rawMs,
            recogMs: null,
            execMs: null,
            setupMoves: "",
            moveCount: null,
            pauseCount: allPauses.length,
            pauseMs: totalPauseMs
          },
          pauses: {
            thresholdMs: pauseThresholdMs,
            totalCount: allPauses.length,
            totalMs: totalPauseMs,
            maxPauseMs,
            list: allPauses
          }
        };
      }
    }
    return null;
  }

  let patTransforms = null;
  try {
    const scrTrans = kp222.algToTransformation(new Alg(solve.scramble));
    patTransforms = [scrTrans];
    let curTrans = scrTrans;
    for (let i = 0; i < normMoves.length; i++) {
      if (!normMoves[i].isRotation) {
        const moveTrans = getCachedMoveTrans222(normMoves[i].move);
        curTrans = curTrans.applyTransformation(moveTrans);
      }
      patTransforms.push(curTrans);
    }
  } catch {
    return null;
  }

  const N = normMoves.length;
  const timeAtIndex = (idx) => {
    if (idx <= 0) return 0;
    if (idx >= N) return Math.max(rawMs, normMoves[N - 1]?.t || 0);
    const tVal = normMoves[idx - 1].t;
    if (tVal === 0 && idx === 1 && N > 1) {
      return Math.min(200, Math.round((normMoves[1].t || 200) / 2));
    }
    return tVal;
  };

  const preferredColors = new Set(
    (Array.isArray(options.layerTargetFaces) ? options.layerTargetFaces : [])
      .map(c => String(c || "").toLowerCase())
      .filter(Boolean)
  );
  const colorPreferenceRank = (colorName) => {
    const lower = String(colorName || "").toLowerCase();
    const prefBonus = preferredColors.has(lower) ? 100 : 0;
    const stdOrder = Math.max(0, 10 - TWO_BY_TWO_COLOR_NAMES.indexOf(colorName));
    return prefBonus + stdOrder;
  };

  const allCandStates = CANDIDATE_ROTATIONS_222.map(cand =>
    patTransforms.map(pt => evaluateCandidateState(pt, cand))
  );

  let bestCllCandidate = null;
  let bestOrtegaCandidate = null;

  // Evaluate CLL candidates grouped by layerColor across all 6 physical faces so a
  // 1st-layer color that moves to another face during 2-look OLL/PLL still links cleanly.
  for (const color of TWO_BY_TWO_COLOR_NAMES) {
    let layerEndIdx = -1;
    let startCandIdx = -1;
    for (let i = 0; i <= N; i++) {
      for (let cIdx = 0; cIdx < CANDIDATE_ROTATIONS_222.length; cIdx++) {
        const st = allCandStates[cIdx][i];
        if (st?.layerOk && st.cllCase && st.layerColor === color) {
          layerEndIdx = i;
          startCandIdx = cIdx;
          break;
        }
      }
      if (layerEndIdx !== -1) break;
    }
    if (layerEndIdx === -1) continue;

    const cand = CANDIDATE_ROTATIONS_222[startCandIdx];
    const states = allCandStates[startCandIdx];
    const cllCaseAtStart = states[layerEndIdx].cllCase;

    const nextMovePreservesLayer = layerEndIdx < N && allCandStates.some(cStates =>
      Boolean(cStates[layerEndIdx + 1]?.layerOk && cStates[layerEndIdx + 1]?.layerColor === color)
    );

    let revisitedLater = false;
    for (let i = layerEndIdx + 4; i < N; i++) {
      if (allCandStates.some(cStates => Boolean(cStates[i]?.layerOk && cStates[i]?.layerColor === color))) {
        revisitedLater = true;
        break;
      }
    }

    let endCandIdx = startCandIdx;
    if (allCandStates[startCandIdx][N]?.layerColor !== color) {
      const matchEnd = allCandStates.findIndex(cStates => cStates[N]?.layerColor === color);
      if (matchEnd !== -1) endCandIdx = matchEnd;
    }
    const endStates = allCandStates[endCandIdx];
    const endSolved = Boolean(endStates[N]?.isSkip);

    const isTrivialEndLayer = layerEndIdx >= N;
    const isRealCllCase = !isTrivialEndLayer && !cllCaseAtStart.isSkip;

    let firstPostFaceMove = null;
    for (let k = layerEndIdx; k < N; k++) {
      if (!normMoves[k]?.isRotation) {
        firstPostFaceMove = normMoves[k];
        break;
      }
    }
    const postMoveIsU = Boolean(firstPostFaceMove && isLayerUMove(firstPostFaceMove.move, cand));

    const score =
      (isRealCllCase ? 500000 : 0) +
      (!isTrivialEndLayer ? 100000 : 0) +
      (isRealCllCase && revisitedLater ? 15000 : 0) +
      (endSolved ? 500 : 0) +
      (N - layerEndIdx) * 100 +
      (nextMovePreservesLayer ? 25 : 0) +
      (postMoveIsU ? 10 : 0) +
      colorPreferenceRank(color) -
      startCandIdx;

    if (!bestCllCandidate || score > bestCllCandidate.score) {
      bestCllCandidate = {
        cand,
        endCand: CANDIDATE_ROTATIONS_222[endCandIdx],
        endStates,
        states,
        layerEndIdx,
        layerColor: color,
        cllCase: cllCaseAtStart,
        endsSolved: endSolved,
        score
      };
    }
  }

  for (let cIdx = 0; cIdx < CANDIDATE_ROTATIONS_222.length; cIdx++) {
    const cand = CANDIDATE_ROTATIONS_222[cIdx];
    const states = allCandStates[cIdx];
    const endState = states[N];
    const endSolved = Boolean(endState?.isSkip);

    // Also evaluate Ortega 1st-face candidate
    const faceEndIdx = states.findIndex(st => st.faceOk && st.faceColor);
    if (faceEndIdx !== -1) {
      const faceColor = states[faceEndIdx].faceColor;
      const endMatchedFace = Boolean(endSolved && (endState.layerColor === faceColor || endState.faceColor === faceColor));
      let ollEndIdx = -1;
      for (let i = faceEndIdx; i <= N; i++) {
        if (states[i].ollOk && (states[i].faceColor === faceColor || states[i].layerColor === faceColor)) {
          ollEndIdx = i;
          break;
        }
      }
      const isTrivialEndFace = faceEndIdx >= N;
      const score =
        (!isTrivialEndFace ? 100000 : 0) +
        (ollEndIdx !== -1 && ollEndIdx < N ? 50000 : 0) +
        (N - faceEndIdx) * 100 +
        (endMatchedFace ? 500 : 0) +
        colorPreferenceRank(faceColor) -
        cIdx;

      if (!bestOrtegaCandidate || score > bestOrtegaCandidate.score) {
        bestOrtegaCandidate = {
          cand,
          states,
          faceEndIdx,
          faceColor,
          ollEndIdx,
          endMatchedFace,
          score
        };
      }
    }
  }

  // Decide between CLL and Ortega based on methodPref
  const hasRealOrtegaFlow = Boolean(
    bestOrtegaCandidate &&
    bestOrtegaCandidate.ollEndIdx !== -1 &&
    bestOrtegaCandidate.ollEndIdx > bestOrtegaCandidate.faceEndIdx &&
    (N - bestOrtegaCandidate.ollEndIdx) >= 3
  );

  let bestEgCandidate = null;
  const egTargetPref = (solve.target === "eg1" || solve.target === "eg2") ? solve.target : null;
  for (const color of TWO_BY_TWO_COLOR_NAMES) {
    let faceEndIdx = -1;
    let startCandIdx = -1;
    for (let i = 0; i < N; i++) {
      for (let cIdx = 0; cIdx < CANDIDATE_ROTATIONS_222.length; cIdx++) {
        const st = allCandStates[cIdx][i];
        if (st?.faceOk && st.egMethod && st.egCase && st.faceColor === color) {
          faceEndIdx = i;
          startCandIdx = cIdx;
          break;
        }
      }
      if (faceEndIdx !== -1) break;
    }
    if (faceEndIdx === -1) continue;

    const cand = CANDIDATE_ROTATIONS_222[startCandIdx];
    const states = allCandStates[startCandIdx];
    const { egMethod, egCase: egCaseAtStart } = states[faceEndIdx];

    let endCandIdx = startCandIdx;
    if (allCandStates[startCandIdx][N]?.layerColor !== color) {
      const matchEnd = allCandStates.findIndex(cStates => cStates[N]?.layerColor === color);
      if (matchEnd !== -1) endCandIdx = matchEnd;
    }
    const endStates = allCandStates[endCandIdx];
    const endSolved = Boolean(endStates[N]?.isSkip && endStates[N]?.layerColor === color);

    const nextMovePreservesFace = faceEndIdx < N && allCandStates.some(cStates =>
      Boolean(cStates[faceEndIdx + 1]?.faceOk && cStates[faceEndIdx + 1]?.faceColor === color)
    );

    let firstPostFaceMove = null;
    for (let k = faceEndIdx; k < N; k++) {
      if (!normMoves[k]?.isRotation) {
        firstPostFaceMove = normMoves[k];
        break;
      }
    }
    const postMoveIsU = Boolean(firstPostFaceMove && isLayerUMove(firstPostFaceMove.move, cand));

    const score =
      (egTargetPref && egMethod === egTargetPref ? 500000 : 0) +
      (endSolved ? 50000 : 0) +
      (N - faceEndIdx) * 100 +
      (nextMovePreservesFace ? 25 : 0) +
      (postMoveIsU ? 10 : 0) +
      colorPreferenceRank(color) -
      startCandIdx;

    if (!bestEgCandidate || score > bestEgCandidate.score) {
      bestEgCandidate = {
        cand,
        endCand: CANDIDATE_ROTATIONS_222[endCandIdx],
        endStates,
        states,
        faceEndIdx,
        faceColor: color,
        egMethod,
        egCase: egCaseAtStart,
        endSolved,
        score
      };
    }
  }

  const cllIsTrivialSkipAtEnd = Boolean(
    bestCllCandidate?.cllCase?.isSkip &&
    bestEgCandidate &&
    bestEgCandidate.faceEndIdx < bestCllCandidate.layerEndIdx &&
    (N - bestCllCandidate.layerEndIdx) <= 2
  );
  const noRealCllLayer = !bestCllCandidate || bestCllCandidate.layerEndIdx >= N || cllIsTrivialSkipAtEnd;
  const preferEg = Boolean(
    methodPref !== "ortega" &&
    bestEgCandidate &&
    (
      Boolean(egTargetPref) ||
      methodPref === "eg" ||
      (noRealCllLayer && !hasRealOrtegaFlow)
    )
  );

  const autoPrefersOrtega = Boolean(
    !preferEg &&
    methodPref === "auto" &&
    bestOrtegaCandidate &&
    (!bestCllCandidate ||
      bestCllCandidate.layerEndIdx >= N ||
      (bestOrtegaCandidate.faceEndIdx < bestCllCandidate.layerEndIdx &&
        (hasRealOrtegaFlow || (bestCllCandidate.cllCase?.isSkip && bestCllCandidate.layerEndIdx > 0 && (N - bestCllCandidate.layerEndIdx) > 2))))
  );
  const useOrtega = !preferEg && (methodPref === "ortega" || autoPrefersOrtega);

  const splits = {
    layer: null,
    cll: null,
    eg: null,
    auf: null,
    face: null,
    oll: null,
    pbl: null
  };

  if (preferEg && bestEgCandidate) {
    const { cand, endCand = cand, endStates = bestEgCandidate.states, faceEndIdx, faceColor, egMethod, egCase } = bestEgCandidate;
    const startedAtEg = faceEndIdx === 0;
    const steps = [];

    if (!startedAtEg) {
      const faceStep = buildPhaseStep({
        key: "face",
        label: "1st Face",
        caseId: faceColor,
        startIdx: 0,
        endIdx: faceEndIdx,
        normMoves,
        timeAtIndex,
        allPauses,
        pauseThresholdMs,
        cand,
        isSetupAware: false
      });
      splits.face = faceStep.ms;
      steps.push(faceStep);
    }

    let aufStartIdx = N;
    const endedSolved = Boolean(endStates?.[N]?.isSkip);
    while (aufStartIdx > faceEndIdx) {
      const prevMove = normMoves[aufStartIdx - 1];
      if (prevMove?.isRotation) {
        aufStartIdx--;
        continue;
      }
      if (endedSolved) {
        const prevSt = endStates[aufStartIdx - 1];
        if (prevSt?.cllCase?.isSkip && prevSt.layerColor === faceColor) {
          aufStartIdx--;
          continue;
        }
        break;
      }
      if (isLayerSetupMove(prevMove?.move, endCand)) {
        aufStartIdx--;
        continue;
      }
      break;
    }

    const egStep = buildPhaseStep({
      key: egMethod,
      label: egMethod === "eg2" ? "EG-2" : "EG-1",
      caseId: egCase ? egCase.shortName : "-",
      startIdx: faceEndIdx,
      endIdx: aufStartIdx,
      normMoves,
      timeAtIndex,
      allPauses,
      pauseThresholdMs,
      cand,
      isSetupAware: true
    });
    splits.eg = egStep.ms;
    steps.push(egStep);

    const aufRawMoves = normMoves.slice(aufStartIdx, N).filter(m => !m.isRotation);
    const aufMs = aufRawMoves.length > 0 && aufStartIdx < N
      ? Math.max(0, Math.round(timeAtIndex(N) - timeAtIndex(aufStartIdx)))
      : 0;
    const aufMovesStr = aufRawMoves.length > 0
      ? (collapseDoubleFlickMoves(aufRawMoves.map(m => m.move)).join(" ") || "None")
      : "None";
    const aufPauses = [];
    for (const mv of normMoves.slice(aufStartIdx, N)) {
      if (mv.split >= pauseThresholdMs) aufPauses.push(mv);
      const matchP = allPauses.find(p => p.moveIndex === mv.index);
      if (matchP) {
        matchP.phase = "auf";
        matchP.phaseLabel = "AUF";
      }
    }
    const aufPauseMs = aufPauses.reduce((acc, m) => acc + m.split, 0);
    const aufTps = (aufMs > 0 && aufRawMoves.length > 0)
      ? Number((aufRawMoves.length / (aufMs / 1000)).toFixed(2))
      : 0;
    splits.auf = aufMs;
    const aufSummary = {
      phase: "auf",
      label: "AUF",
      caseId: aufMovesStr,
      ms: aufMs,
      recogMs: null,
      setupMs: null,
      setupMoves: "",
      execMs: aufMs,
      execMoves: aufMovesStr === "None" ? "" : aufMovesStr,
      accumMs: timeAtIndex(N),
      moveCount: aufRawMoves.length,
      tps: aufTps,
      moves: aufMovesStr === "None" ? "" : aufMovesStr,
      pauseCount: aufPauses.length,
      pauseMs: aufPauseMs
    };

    const resolvedEgCase = egCase
      ? {
          ...egCase,
          ms: egStep.ms,
          recogMs: egStep.recogMs,
          setupMs: egStep.setupMs,
          execMs: egStep.execMs,
          setupMoves: egStep.setupMoves,
          moveCount: egStep.moveCount,
          pauseCount: egStep.pauseCount,
          pauseMs: egStep.pauseMs
        }
      : null;

    return {
      version: TWO_BY_TWO_ANALYSIS_VERSION,
      method: egMethod,
      methodPref,
      layerColor: faceColor,
      cllCase: null,
      egCase: resolvedEgCase,
      splits,
      steps,
      aufSummary,
      pauses: {
        thresholdMs: pauseThresholdMs,
        totalCount: allPauses.length,
        totalMs: totalPauseMs,
        maxPauseMs,
        list: allPauses
      }
    };
  }

  if (useOrtega && bestOrtegaCandidate) {
    const { cand, faceEndIdx, faceColor, ollEndIdx } = bestOrtegaCandidate;
    const steps = [];
    const startedAtFace = faceEndIdx === 0;

    if (!startedAtFace) {
      const faceStep = buildPhaseStep({
        key: "face",
        label: "1st Face",
        caseId: faceColor,
        startIdx: 0,
        endIdx: faceEndIdx,
        normMoves,
        timeAtIndex,
        allPauses,
        pauseThresholdMs,
        cand,
        isSetupAware: false
      });
      splits.face = faceStep.ms;
      steps.push(faceStep);
    }

    const validOllEnd = ollEndIdx !== -1 ? ollEndIdx : N;
    const ollStep = buildPhaseStep({
      key: "oll",
      label: "OLL",
      caseId: validOllEnd === faceEndIdx ? "OLL Skip" : "2x2 OLL",
      startIdx: faceEndIdx,
      endIdx: validOllEnd,
      normMoves,
      timeAtIndex,
      allPauses,
      pauseThresholdMs,
      cand,
      isSetupAware: true
    });
    splits.oll = ollStep.ms;
    steps.push(ollStep);

    const pblStep = buildPhaseStep({
      key: "pbl",
      label: "PBL",
      caseId: validOllEnd === N ? "PBL Skip" : "2x2 PBL",
      startIdx: validOllEnd,
      endIdx: N,
      normMoves,
      timeAtIndex,
      allPauses,
      pauseThresholdMs,
      cand,
      isSetupAware: true
    });
    splits.pbl = pblStep.ms;
    steps.push(pblStep);

    return {
      version: TWO_BY_TWO_ANALYSIS_VERSION,
      method: "ortega",
      methodPref,
      layerColor: faceColor,
      cllCase: null,
      splits,
      steps,
      aufSummary: null,
      pauses: {
        thresholdMs: pauseThresholdMs,
        totalCount: allPauses.length,
        totalMs: totalPauseMs,
        maxPauseMs,
        list: allPauses
      }
    };
  }

  if (!bestCllCandidate) return null;

  const { cand, endCand = cand, endStates = bestCllCandidate.states, layerEndIdx, layerColor, cllCase } = bestCllCandidate;
  const startedAtCll = layerEndIdx === 0;
  const steps = [];

  if (!startedAtCll) {
    const layerStep = buildPhaseStep({
      key: "layer",
      label: "1st Layer",
      caseId: layerColor,
      startIdx: 0,
      endIdx: layerEndIdx,
      normMoves,
      timeAtIndex,
      allPauses,
      pauseThresholdMs,
      cand,
      isSetupAware: false
    });
    splits.layer = layerStep.ms;
    steps.push(layerStep);
  }

  // Separate trailing post-AUF before building CLL step so CLL timing excludes final AUF
  let aufStartIdx = N;
  const endedSolved = Boolean(endStates?.[N]?.isSkip);
  while (aufStartIdx > layerEndIdx) {
    const prevMove = normMoves[aufStartIdx - 1];
    if (prevMove?.isRotation) {
      aufStartIdx--;
      continue;
    }
    if (endedSolved) {
      const prevSt = endStates[aufStartIdx - 1];
      if (prevSt?.cllCase?.isSkip && prevSt.layerColor === layerColor) {
        aufStartIdx--;
        continue;
      }
      break;
    }
    if (isLayerSetupMove(prevMove?.move, endCand)) {
      aufStartIdx--;
      continue;
    }
    break;
  }

  const cllStep = buildPhaseStep({
    key: "cll",
    label: "CLL",
    caseId: cllCase ? cllCase.shortName : (layerEndIdx === aufStartIdx ? "Skip" : "-"),
    startIdx: layerEndIdx,
    endIdx: aufStartIdx,
    normMoves,
    timeAtIndex,
    allPauses,
    pauseThresholdMs,
    cand,
    isSetupAware: true
  });
  splits.cll = cllStep.ms;
  steps.push(cllStep);

  const aufRawMoves = normMoves.slice(aufStartIdx, N).filter(m => !m.isRotation);
  const aufMs = aufRawMoves.length > 0 && aufStartIdx < N
    ? Math.max(0, Math.round(timeAtIndex(N) - timeAtIndex(aufStartIdx)))
    : 0;
  const aufMovesStr = aufRawMoves.length > 0
    ? (collapseDoubleFlickMoves(aufRawMoves.map(m => m.move)).join(" ") || "None")
    : "None";
  const aufPauses = [];
  for (const mv of normMoves.slice(aufStartIdx, N)) {
    if (mv.split >= pauseThresholdMs) aufPauses.push(mv);
    const matchP = allPauses.find(p => p.moveIndex === mv.index);
    if (matchP) {
      matchP.phase = "auf";
      matchP.phaseLabel = "AUF";
    }
  }
  const aufPauseMs = aufPauses.reduce((acc, m) => acc + m.split, 0);
  const aufTps = (aufMs > 0 && aufRawMoves.length > 0)
    ? Number((aufRawMoves.length / (aufMs / 1000)).toFixed(2))
    : 0;
  splits.auf = aufMs;
  const aufSummary = {
    phase: "auf",
    label: "AUF",
    caseId: aufMovesStr,
    ms: aufMs,
    recogMs: null,
    setupMs: null,
    setupMoves: "",
    execMs: aufMs,
    execMoves: aufMovesStr === "None" ? "" : aufMovesStr,
    accumMs: timeAtIndex(N),
    moveCount: aufRawMoves.length,
    tps: aufTps,
    moves: aufMovesStr === "None" ? "" : aufMovesStr,
    pauseCount: aufPauses.length,
    pauseMs: aufPauseMs
  };

  const resolvedCllCase = cllCase
    ? {
        ...cllCase,
        ms: cllStep.ms,
        recogMs: cllStep.recogMs,
        setupMs: cllStep.setupMs,
        execMs: cllStep.execMs,
        setupMoves: cllStep.setupMoves,
        moveCount: cllStep.moveCount,
        pauseCount: cllStep.pauseCount,
        pauseMs: cllStep.pauseMs
      }
    : null;

  return {
    version: TWO_BY_TWO_ANALYSIS_VERSION,
    method: "cll",
    methodPref,
    layerColor,
    cllCase: resolvedCllCase,
    splits,
    steps,
    aufSummary,
    pauses: {
      thresholdMs: pauseThresholdMs,
      totalCount: allPauses.length,
      totalMs: totalPauseMs,
      maxPauseMs,
      list: allPauses
    }
  };
}

export async function analyzeTwoByTwoSolve(solve, options = {}) {
  await initTwoByTwoAnalyzer();
  return analyzeTwoByTwoSolveSync(solve, options);
}

export function ensureSolveTwoByTwo(solve, options = {}) {
  if (!solve || (solve.puzzle && solve.puzzle !== "222")) return null;
  const methodPref = ["cll", "auto", "ortega", "eg"].includes(options.twoByTwoMethod)
    ? options.twoByTwoMethod
    : "cll";

  const hasValidCache =
    !options.force &&
    solve.twoByTwo &&
    solve.twoByTwo.version === TWO_BY_TWO_ANALYSIS_VERSION &&
    solve.twoByTwo.splits &&
    solve.twoByTwo.methodPref === methodPref &&
    (!solve.moves?.length || solve.twoByTwo.steps?.length > 0);

  if (hasValidCache) return solve.twoByTwo;

  if (isTwoByTwoAnalyzerReady()) {
    const analyzed = analyzeTwoByTwoSolveSync(solve, options);
    if (analyzed) {
      solve.twoByTwo = analyzed;
      return analyzed;
    }
    if (options.force) {
      delete solve.twoByTwo;
      return null;
    }
  }
  return solve.twoByTwo || null;
}

export async function reanalyzeTwoByTwoSolves(solves = [], options = {}) {
  await initTwoByTwoAnalyzer();
  const list = Array.isArray(solves) ? solves : [];
  let updated = 0;
  for (const sv of list) {
    if (!sv) continue;
    if (sv.puzzle && sv.puzzle !== "222") continue;
    const hasMoves = Array.isArray(sv.moves) && sv.moves.length > 0;
    const hasManualCase = (sv.target === "cll" || sv.track === "cll" || sv.target === "eg1" || sv.track === "eg1" || sv.target === "eg2" || sv.track === "eg2") && Boolean(sv.id);
    if (!hasMoves && !hasManualCase) continue;
    ensureSolveTwoByTwo(sv, { ...options, force: true });
    sv.updatedAt = Date.now();
    updated++;
  }
  return { total: list.length, updated };
}

export function computeTwoByTwoAverages(solves = [], options = {}) {
  const validSolves = solves.filter(s => s && s.penalty !== "DNF" && s.penalty !== -1);
  for (const s of validSolves) {
    ensureSolveTwoByTwo(s, options);
  }

  const avgOf = (vals) => {
    const clean = vals.filter(v => typeof v === "number" && Number.isFinite(v));
    if (clean.length === 0) return null;
    return Math.round(clean.reduce((a, b) => a + b, 0) / clean.length);
  };

  const avgFloat = (vals, decimals = 1) => {
    const clean = vals.filter(v => typeof v === "number" && Number.isFinite(v));
    if (clean.length === 0) return null;
    return Number((clean.reduce((a, b) => a + b, 0) / clean.length).toFixed(decimals));
  };

  const medianFloat = (vals, decimals = 1) => {
    const clean = vals.filter(v => typeof v === "number" && Number.isFinite(v)).sort((a, b) => a - b);
    if (clean.length === 0) return null;
    const mid = Math.floor(clean.length / 2);
    const med = clean.length % 2 !== 0 ? clean[mid] : (clean[mid - 1] + clean[mid]) / 2;
    return Number(med.toFixed(decimals));
  };

  const totalTimes = [];
  const cubeTimes = [];
  const inspectionTimes = [];
  const pickupTimes = [];
  const putdownTimes = [];
  const phaseBuckets = { layer: [], cll: [], eg: [], auf: [], face: [], oll: [], pbl: [] };
  const layerMoveCounts = [];
  const cllMoveCounts = [];
  const egMoveCounts = [];
  const pauseCounts = [];
  const pauseTimes = [];
  let analyzedCount = 0;

  for (const s of validSolves) {
    const timeVal = (s.penalty === "+2" || s.penalty === 2) && s.rawMs != null
      ? s.rawMs + 2000
      : (s.ms != null ? s.ms : s.rawMs);
    if (timeVal != null && Number.isFinite(timeVal)) totalTimes.push(timeVal);
    if (typeof s.cubeMs === "number" && Number.isFinite(s.cubeMs)) cubeTimes.push(s.cubeMs);
    if (typeof s.inspectionMs === "number" && Number.isFinite(s.inspectionMs)) inspectionTimes.push(s.inspectionMs);
    if (typeof s.pickupMs === "number" && Number.isFinite(s.pickupMs)) pickupTimes.push(s.pickupMs);
    if (typeof s.putdownMs === "number" && Number.isFinite(s.putdownMs)) putdownTimes.push(s.putdownMs);

    const two = s.twoByTwo;
    if (!two) continue;
    analyzedCount++;
    const sp = two.splits || {};
    for (const k of Object.keys(phaseBuckets)) {
      if (typeof sp[k] === "number" && Number.isFinite(sp[k])) phaseBuckets[k].push(sp[k]);
    }
    const layerStep = two.steps?.find(st => st.phase === "layer" || st.phase === "face");
    const cllStep = two.steps?.find(st => st.phase === "cll");
    const egStep = two.steps?.find(st => st.phase === "eg1" || st.phase === "eg2");
    if (typeof layerStep?.moveCount === "number") layerMoveCounts.push(layerStep.moveCount);
    if (typeof cllStep?.moveCount === "number") cllMoveCounts.push(cllStep.moveCount);
    if (typeof egStep?.moveCount === "number") egMoveCounts.push(egStep.moveCount);

    if (two.pauses) {
      pauseCounts.push(two.pauses.totalCount || 0);
      pauseTimes.push(two.pauses.totalMs || 0);
    }
  }

  return {
    count: validSolves.length,
    analyzedCount,
    totalMs: avgOf(totalTimes),
    cubeMs: avgOf(cubeTimes),
    inspectionMs: avgOf(inspectionTimes),
    pickupMs: avgOf(pickupTimes),
    putdownMs: avgOf(putdownTimes),
    layer: avgOf(phaseBuckets.layer),
    cll: avgOf(phaseBuckets.cll),
    eg: avgOf(phaseBuckets.eg),
    auf: avgOf(phaseBuckets.auf),
    face: avgOf(phaseBuckets.face),
    oll: avgOf(phaseBuckets.oll),
    pbl: avgOf(phaseBuckets.pbl),
    layerMoves: avgFloat(layerMoveCounts, 1),
    cllMoves: avgFloat(cllMoveCounts, 1),
    egMoves: avgFloat(egMoveCounts, 1),
    avgPauseCount: avgFloat(pauseCounts, 1) ?? 0,
    avgPauseMs: avgOf(pauseTimes) ?? 0,
    median: {
      totalMs: computeMedian(totalTimes),
      cubeMs: computeMedian(cubeTimes),
      inspectionMs: computeMedian(inspectionTimes),
      pickupMs: computeMedian(pickupTimes),
      putdownMs: computeMedian(putdownTimes),
      layer: computeMedian(phaseBuckets.layer),
      cll: computeMedian(phaseBuckets.cll),
      eg: computeMedian(phaseBuckets.eg),
      auf: computeMedian(phaseBuckets.auf),
      face: computeMedian(phaseBuckets.face),
      oll: computeMedian(phaseBuckets.oll),
      pbl: computeMedian(phaseBuckets.pbl),
      layerMoves: medianFloat(layerMoveCounts, 1),
      cllMoves: medianFloat(cllMoveCounts, 1),
      egMoves: medianFloat(egMoveCounts, 1),
      pauseCount: medianFloat(pauseCounts, 1) ?? 0,
      pauseMs: computeMedian(pauseTimes) ?? 0
    },
    trimMean: {
      totalMs: computeTrimmedMean(totalTimes, 0.10),
      cubeMs: computeTrimmedMean(cubeTimes, 0.10),
      inspectionMs: computeTrimmedMean(inspectionTimes, 0.10),
      pickupMs: computeTrimmedMean(pickupTimes, 0.10),
      putdownMs: computeTrimmedMean(putdownTimes, 0.10),
      layer: computeTrimmedMean(phaseBuckets.layer, 0.10),
      cll: computeTrimmedMean(phaseBuckets.cll, 0.10),
      eg: computeTrimmedMean(phaseBuckets.eg, 0.10),
      auf: computeTrimmedMean(phaseBuckets.auf, 0.10),
      face: computeTrimmedMean(phaseBuckets.face, 0.10),
      oll: computeTrimmedMean(phaseBuckets.oll, 0.10),
      pbl: computeTrimmedMean(phaseBuckets.pbl, 0.10),
      pauseCount: avgFloat(pauseCounts, 1) ?? 0,
      pauseMs: computeTrimmedMean(pauseTimes, 0.10) ?? 0
    }
  };
}

export function computeCllCaseStats(solves = [], options = {}) {
  const validSolves = solves.filter(s => s && s.penalty !== "DNF" && s.penalty !== -1);
  const map = new Map();

  const recordCase = (caseObj, msVal, pauseCount = 0, pauseMs = 0, recogMs = null, execMs = null, moveCount = null) => {
    if (!caseObj?.id || msVal == null || !Number.isFinite(msVal)) return;
    if (!map.has(caseObj.id)) {
      map.set(caseObj.id, {
        id: caseObj.id,
        svgCaseId: caseObj.svgCaseId || caseObj.id,
        shortName: caseObj.shortName || caseObj.id,
        name: caseObj.name || caseObj.id,
        group: caseObj.group || "CLL",
        isSkip: Boolean(caseObj.isSkip),
        times: [],
        pauseCounts: [],
        pauseMsList: [],
        recogMsList: [],
        execMsList: [],
        movesList: []
      });
    }
    const entry = map.get(caseObj.id);
    entry.times.push(msVal);
    entry.pauseCounts.push(pauseCount);
    entry.pauseMsList.push(pauseMs);
    if (recogMs != null && Number.isFinite(recogMs)) entry.recogMsList.push(recogMs);
    if (execMs != null && Number.isFinite(execMs)) entry.execMsList.push(execMs);
    if (moveCount != null && Number.isFinite(moveCount)) entry.movesList.push(moveCount);
  };

  for (const s of validSolves) {
    if (s.puzzle && s.puzzle !== "222") continue;
    const two = ensureSolveTwoByTwo(s, options);
    if (two?.cllCase && two.cllCase.ms != null) {
      recordCase(
        two.cllCase,
        two.cllCase.ms,
        two.cllCase.pauseCount || 0,
        two.cllCase.pauseMs || 0,
        two.cllCase.recogMs,
        two.cllCase.execMs,
        two.cllCase.moveCount
      );
    }
  }

  const list = [...map.values()].map(entry => {
    const n = entry.times.length;
    const avgMs = Math.round(entry.times.reduce((a, b) => a + b, 0) / n);
    const medianMs = computeMedian(entry.times);
    const trimMeanMs = computeTrimmedMean(entry.times, 0.10);
    const avgPauseCount = Number((entry.pauseCounts.reduce((a, b) => a + b, 0) / n).toFixed(1));
    const avgPauseMs = Math.round(entry.pauseMsList.reduce((a, b) => a + b, 0) / n);
    const avgRecogMs = entry.recogMsList.length > 0
      ? Math.round(entry.recogMsList.reduce((a, b) => a + b, 0) / entry.recogMsList.length)
      : null;
    const avgExecMs = entry.execMsList.length > 0
      ? Math.round(entry.execMsList.reduce((a, b) => a + b, 0) / entry.execMsList.length)
      : null;
    const avgMoves = entry.movesList.length > 0
      ? Number((entry.movesList.reduce((a, b) => a + b, 0) / entry.movesList.length).toFixed(1))
      : null;
    return {
      id: entry.id,
      svgCaseId: entry.svgCaseId,
      shortName: entry.shortName,
      name: entry.name,
      group: entry.group,
      isSkip: entry.isSkip,
      attempts: n,
      avgMs,
      medianMs,
      trimMeanMs,
      bestMs: Math.min(...entry.times),
      worstMs: Math.max(...entry.times),
      avgPauseCount,
      avgPauseMs,
      avgRecogMs,
      avgExecMs,
      avgMoves
    };
  });

  list.sort((a, b) => (b.medianMs - a.medianMs) || (b.avgMs - a.avgMs));
  return list;
}
