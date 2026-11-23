// 3x3x3 CFOP Solve Analyzer
// Automatically detects Cross, F2L 1, F2L 2, F2L 3, F2L 4, OLL, and PLL splits,
// identifies the exact OLL (57 cases + Skip) and PLL (21 cases + Skip) cases solved,
// and tracks hesitation/recognition pauses per phase and per case.

import { Alg } from 'cubing/alg';
import { ollCases } from './data/ollData.js';
import { pllCases } from './data/pllData.js';
import {
  ORIENTATIONS_24,
  CORNER_FACES_333,
  EDGE_FACES_333,
  F2L_SLOTS,
  CENTER_COLOR_NAMES,
  CENTER_FACE_LETTERS,
  getSolvedOrientations
} from './cube/cubeUtils.js';

export const DEFAULT_PAUSE_THRESHOLD_MS = 400;

let kp333 = null;
let defaultPat = null;
let solvedOrientations = []; // All 24 solved cube orientations
let solvedOrientationsByCenterKey = null;
let ollKeyMap = new Map();   // canonical orientation key -> ollCase object
let pllKeyMap = new Map();   // canonical permutation key -> pllCase object
let initPromise = null;

// Candidate rotations that bring each of the 6 centers to the D face (slot 5)
const CANDIDATE_ROTATIONS = [
  { rot: "z2", inv: "z2", uFace: "D", yAxis: "y", transCache: new Map(), rotTrans: null, invTrans: null }, // WCA U (White) -> D
  { rot: "",   inv: "",   uFace: "U", yAxis: "y", transCache: new Map(), rotTrans: null, invTrans: null }, // WCA D (Yellow) -> D
  { rot: "x'", inv: "x",  uFace: "B", yAxis: "z", transCache: new Map(), rotTrans: null, invTrans: null }, // WCA F (Green) -> D
  { rot: "x",  inv: "x'", uFace: "F", yAxis: "z", transCache: new Map(), rotTrans: null, invTrans: null }, // WCA B (Blue) -> D
  { rot: "z",  inv: "z'", uFace: "L", yAxis: "x", transCache: new Map(), rotTrans: null, invTrans: null }, // WCA R (Red) -> D
  { rot: "z'", inv: "z",  uFace: "R", yAxis: "x", transCache: new Map(), rotTrans: null, invTrans: null }  // WCA L (Orange) -> D
];

function getCandMoveTrans(cand, mStr) {
  let tr = cand.transCache.get(mStr);
  if (!tr && kp333) {
    const conjStr = cand.rot ? `${cand.inv} ${mStr} ${cand.rot}` : mStr;
    tr = kp333.algToTransformation(new Alg(conjStr));
    cand.transCache.set(mStr, tr);
  }
  return tr;
}

export function computeOllCanonicalKey(cornerOri4, edgeOri4) {
  const keys = [];
  for (let rot = 0; rot < 4; rot++) {
    const rco = [0, 1, 2, 3].map(i => cornerOri4[(i + rot) % 4]).join("");
    const reo = [0, 1, 2, 3].map(i => edgeOri4[(i + rot) % 4]).join("");
    keys.push(`${rco}:${reo}`);
  }
  keys.sort();
  return keys[0];
}

export function computePllCanonicalKey(cornerHome4, edgeHome4) {
  const keys = [];
  for (let a = 0; a < 4; a++) {
    for (let b = 0; b < 4; b++) {
      const rc = [0, 1, 2, 3].map(i => (cornerHome4[(i + a) % 4] + b) % 4).join("");
      const re = [0, 1, 2, 3].map(i => (edgeHome4[(i + a) % 4] + b) % 4).join("");
      keys.push(`${rc}:${re}`);
    }
  }
  keys.sort();
  return keys[0];
}

function buildOllAndPllTables(basePat) {
  ollKeyMap.clear();
  pllKeyMap.clear();

  // 1. Register all 57 OLL cases
  for (const c of ollCases) {
    try {
      const pat = basePat.applyAlg(new Alg(c.setup));
      const co = pat.patternData.CORNERS.orientation.slice(0, 4);
      const eo = pat.patternData.EDGES.orientation.slice(0, 4);
      const key = computeOllCanonicalKey(co, eo);
      const shortName = `OLL ${c.number || c.id.replace(/^oll-0?/, '')}`;
      ollKeyMap.set(key, {
        id: c.id,
        number: c.number,
        name: c.name || shortName,
        shortName,
        group: c.group || "OLL"
      });
    } catch (e) {
      console.warn("Failed to index OLL case:", c.id, e);
    }
  }

  // Register OLL Skip
  ollKeyMap.set("0000:0000", {
    id: "OLL Skip",
    number: 0,
    name: "OLL Skip",
    shortName: "OLL Skip",
    group: "Skip"
  });

  // 2. Register all 21 PLL cases
  for (const c of pllCases) {
    try {
      const algStr = c.algs?.[0]?.alg || c.setup;
      const rawPat = c.algs?.[0]?.alg
        ? basePat.applyAlg(new Alg(algStr).invert())
        : basePat.applyAlg(new Alg(c.setup));

      let aligned = rawPat;
      // Rotate rawPat into canonical orientation (U=0, D=5, F=2) across all 24 orientations
      const rCenters = rawPat.patternData.CENTERS.pieces;
      if (!(rCenters[0] === 0 && rCenters[5] === 5 && rCenters[2] === 2)) {
        for (const r of ORIENTATIONS_24) {
          const cand = r ? rawPat.applyAlg(new Alg(r)) : rawPat;
          const cc = cand.patternData.CENTERS.pieces;
          if (cc[0] === 0 && cc[5] === 5 && cc[2] === 2) {
            aligned = cand;
            break;
          }
        }
      }
      const cp = aligned.patternData.CORNERS.pieces.slice(0, 4);
      const ep = aligned.patternData.EDGES.pieces.slice(0, 4);
      const key = computePllCanonicalKey(cp, ep);
      pllKeyMap.set(key, {
        id: c.id,
        name: c.name || `${c.id}-Perm`,
        shortName: `${c.id}`,
        group: c.group || "PLL"
      });
    } catch (e) {
      console.warn("Failed to index PLL case:", c.id, e);
    }
  }

  // Register PLL Skip
  pllKeyMap.set("0123:0123", {
    id: "PLL Skip",
    name: "PLL Skip",
    shortName: "PLL Skip",
    group: "Skip"
  });
}

export async function initCfopAnalyzer() {
  if (kp333 && defaultPat) return true;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      const solvedData = await getSolvedOrientations('3x3x3');
      if (!solvedData) return false;
      kp333 = solvedData.kpuzzle;
      defaultPat = solvedData.defaultPat;
      solvedOrientations = solvedData.patterns;
      solvedOrientationsByCenterKey = solvedData.byCenterKey;
      buildOllAndPllTables(defaultPat);
      return true;
    } catch (e) {
      console.warn("Could not initialize CFOP analyzer:", e);
      return false;
    }
  })();
  return initPromise;
}

// Eagerly initialize
initCfopAnalyzer().catch(() => {});

export function isCfopAnalyzerReady() {
  return Boolean(kp333 && defaultPat);
}

function getMatchingSolvedPattern(pat) {
  const centers = pat.patternData.CENTERS.pieces;
  return solvedOrientationsByCenterKey?.get(centers.join(",")) || defaultPat;
}

function getCanonicalOllOrientations(pat, ref) {
  const cp = pat.patternData.CORNERS.pieces;
  const co = pat.patternData.CORNERS.orientation;
  const ep = pat.patternData.EDGES.pieces;
  const eo = pat.patternData.EDGES.orientation;
  const uFace = CENTER_FACE_LETTERS[ref.patternData.CENTERS.pieces[0]] || "U";

  const canonCo = [0, 1, 2, 3].map(s => {
    const faces = CORNER_FACES_333[cp[s]];
    for (let k = 0; k < 3; k++) {
      if (faces[(k - co[s] + 3) % 3] === uFace) return k;
    }
    return 0;
  });

  const canonEo = [0, 1, 2, 3].map(s => {
    const faces = EDGE_FACES_333[ep[s]];
    return faces[(0 - eo[s] + 2) % 2] === uFace ? 0 : 1;
  });

  return { canonCo, canonEo };
}

function evaluateCfopState(pat) {
  const ref = getMatchingSolvedPattern(pat);
  const ep = pat.patternData.EDGES.pieces;
  const eo = pat.patternData.EDGES.orientation;
  const cp = pat.patternData.CORNERS.pieces;
  const co = pat.patternData.CORNERS.orientation;

  const rep = ref.patternData.EDGES.pieces;
  const reo = ref.patternData.EDGES.orientation;
  const rcp = ref.patternData.CORNERS.pieces;
  const rco = ref.patternData.CORNERS.orientation;

  // 1. Check 4 D-layer cross edges (slots 4, 5, 6, 7)
  const crossOk =
    ep[4] === rep[4] && eo[4] === reo[4] &&
    ep[5] === rep[5] && eo[5] === reo[5] &&
    ep[6] === rep[6] && eo[6] === reo[6] &&
    ep[7] === rep[7] && eo[7] === reo[7];

  if (!crossOk) {
    return {
      crossOk: false,
      f2lCount: -1,
      f2lMask: 0,
      ollOk: false,
      solvedOk: false,
      pat,
      ref
    };
  }

  // 2. Check 4 F2L slots
  let f2lCount = 0;
  let f2lMask = 0;
  for (let idx = 0; idx < 4; idx++) {
    const sl = F2L_SLOTS[idx];
    const cMatch = cp[sl.c] === rcp[sl.c] && co[sl.c] === rco[sl.c];
    const eMatch = ep[sl.e] === rep[sl.e] && eo[sl.e] === reo[sl.e];
    if (cMatch && eMatch) {
      f2lCount++;
      f2lMask |= (1 << idx);
    }
  }

  if (f2lCount < 4) {
    return {
      crossOk: true,
      f2lCount,
      f2lMask,
      ollOk: false,
      solvedOk: false,
      pat,
      ref
    };
  }

  // 3. Check OLL (all 4 U-corners and 4 U-edges oriented relative to ref's U center)
  const { canonCo, canonEo } = getCanonicalOllOrientations(pat, ref);
  const ollOk = canonCo.every(o => o === 0) && canonEo.every(o => o === 0);

  if (!ollOk) {
    return {
      crossOk: true,
      f2lCount: 4,
      f2lMask: 15,
      ollOk: false,
      solvedOk: false,
      pat,
      ref
    };
  }

  // 4. Check solved (exact match on U layer)
  const solvedOk =
    cp[0] === rcp[0] && cp[1] === rcp[1] && cp[2] === rcp[2] && cp[3] === rcp[3] &&
    ep[0] === rep[0] && ep[1] === rep[1] && ep[2] === rep[2] && ep[3] === rep[3];

  return {
    crossOk: true,
    f2lCount: 4,
    f2lMask: 15,
    ollOk: true,
    solvedOk,
    pat,
    ref
  };
}

export function identifyOllCaseFromState(state) {
  if (!state || !state.pat || !state.ref) return null;
  const { canonCo, canonEo } = getCanonicalOllOrientations(state.pat, state.ref);
  const key = computeOllCanonicalKey(canonCo, canonEo);
  return ollKeyMap.get(key) || null;
}

export function identifyPllCaseFromState(state) {
  if (!state || !state.pat || !state.ref) return null;
  const cp = state.pat.patternData.CORNERS.pieces.slice(0, 4);
  const ep = state.pat.patternData.EDGES.pieces.slice(0, 4);
  const rcp = state.ref.patternData.CORNERS.pieces.slice(0, 4);
  const rep = state.ref.patternData.EDGES.pieces.slice(0, 4);

  const cHome = cp.map(p => rcp.indexOf(p));
  const eHome = ep.map(p => rep.indexOf(p));
  if (cHome.some(idx => idx < 0) || eHome.some(idx => idx < 0)) {
    return null;
  }
  const key = computePllCanonicalKey(cHome, eHome);
  return pllKeyMap.get(key) || null;
}

function isCrossUMove(moveStr, cand) {
  if (!moveStr) return false;
  const uFace = cand?.uFace || "U";
  const m = moveStr.trim();
  return new RegExp(`^${uFace}[2']?$`).test(m);
}

function isCrossSetupMove(moveStr, cand) {
  if (!moveStr) return false;
  const uFace = cand?.uFace || "U";
  const yAxis = cand?.yAxis || "y";
  const m = moveStr.trim();
  return new RegExp(`^(?:${uFace}|${yAxis}|${yAxis.toUpperCase()})[2']?$`).test(m);
}

export function collapseDoubleFlickMoves(moveList = []) {
  const out = [];
  for (const raw of moveList) {
    const m = String(raw || "").trim();
    if (!m) continue;
    const prev = out[out.length - 1];
    if (prev && prev === m && /^[UDLRFBMESudlrfbxyz]'?$/.test(m)) {
      out[out.length - 1] = `${m[0]}2`;
    } else {
      out.push(m);
    }
  }
  return out;
}

export function computeMedian(vals = []) {
  const clean = vals.filter(v => typeof v === "number" && Number.isFinite(v)).sort((a, b) => a - b);
  if (clean.length === 0) return null;
  const mid = Math.floor(clean.length / 2);
  return clean.length % 2 !== 0
    ? Math.round(clean[mid])
    : Math.round((clean[mid - 1] + clean[mid]) / 2);
}

export function computeTrimmedMean(vals = [], trimRatio = 0.10) {
  const clean = vals.filter(v => typeof v === "number" && Number.isFinite(v)).sort((a, b) => a - b);
  if (clean.length === 0) return null;
  if (clean.length < 3) {
    return Math.round(clean.reduce((a, b) => a + b, 0) / clean.length);
  }
  const trimCount = Math.max(1, Math.min(Math.floor((clean.length - 1) / 2), Math.round(clean.length * trimRatio)));
  const sliced = clean.slice(trimCount, clean.length - trimCount);
  return Math.round(sliced.reduce((a, b) => a + b, 0) / sliced.length);
}

export function analyzeCfopSolveSync(solve, options = {}) {
  if (!solve) return null;
  const pauseThresholdMs = options.pauseThresholdMs || DEFAULT_PAUSE_THRESHOLD_MS;
  const moves = Array.isArray(solve.moves) ? solve.moves : [];
  // For GAN-timer solves, cubeMs excludes pick-up / put-down so the last phase isn't inflated
  const rawMs = solve.cubeMs != null ? solve.cubeMs : (solve.rawMs != null ? solve.rawMs : (solve.ms != null ? solve.ms : 0));

  // Normalize move timestamps & splits
  const normMoves = moves.map((m, idx) => {
    const t = typeof m.t === "number" ? m.t : 0;
    const prevT = idx === 0 ? 0 : (typeof moves[idx - 1].t === "number" ? moves[idx - 1].t : 0);
    const split = typeof m.split === "number" && m.split > 0 ? m.split : Math.max(0, t - prevT);
    return {
      move: String(m.move || "").trim(),
      t,
      split,
      index: idx
    };
  });

  // Always compute overall pause list if moves exist
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

  const is3x3 = !solve.puzzle || solve.puzzle === "333" || solve.puzzle === "333oh";
  if (!is3x3 || !kp333 || !defaultPat || normMoves.length === 0 || !solve.scramble) {
    // If manual solve on OLL/PLL track without smart cube moves, still return basic case tag if known
    if (is3x3 && (solve.target === "oll" || solve.target === "pll") && solve.id) {
      const isOll = solve.target === "oll";
      const foundOll = isOll ? ollCases.find(c => c.id === solve.id) : null;
      const foundPll = !isOll ? pllCases.find(c => c.id === solve.id) : null;
      return {
        isFullCfop: false,
        crossColor: "White",
        splits: {
          cross: null,
          f2l1: null,
          f2l2: null,
          f2l3: null,
          f2l4: null,
          f2lTotal: null,
          oll: isOll ? rawMs : null,
          pll: !isOll ? rawMs : null
        },
        steps: [],
        ollCase: isOll ? {
          id: solve.id,
          name: foundOll?.name || solve.id,
          shortName: foundOll ? `OLL ${foundOll.number}` : solve.id,
          group: foundOll?.group || "OLL",
          ms: rawMs,
          moveCount: normMoves.length,
          pauseCount: allPauses.length,
          pauseMs: totalPauseMs,
          recogMs: 0
        } : null,
        pllCase: !isOll ? {
          id: solve.id,
          name: foundPll?.name || `${solve.id}-Perm`,
          shortName: solve.id,
          group: foundPll?.group || "PLL",
          ms: rawMs,
          moveCount: normMoves.length,
          pauseCount: allPauses.length,
          pauseMs: totalPauseMs,
          recogMs: 0
        } : null,
        pauses: {
          thresholdMs: pauseThresholdMs,
          totalCount: allPauses.length,
          totalMs: totalPauseMs,
          maxPauseMs,
          list: allPauses
        }
      };
    }
    return null;
  }

  // Evaluate all 6 candidate cross faces to find the one the cuber solved
  const N = normMoves.length;
  let bestCandidate = null;
  let scrAlg = null;
  let rawScrPat = null;
  try {
    scrAlg = new Alg(solve.scramble);
    rawScrPat = defaultPat.applyAlg(scrAlg);
  } catch (e) {
    return null;
  }

  for (const cand of CANDIDATE_ROTATIONS) {
    try {
      if (cand.rot && !cand.rotTrans) {
        cand.rotTrans = kp333.algToTransformation(new Alg(cand.rot));
        cand.invTrans = kp333.algToTransformation(new Alg(cand.inv));
      }
      let curPat = cand.rot
        ? defaultPat.applyTransformation(cand.invTrans).applyAlg(scrAlg).applyTransformation(cand.rotTrans)
        : rawScrPat;
      const orientedScrPat = cand.rot ? rawScrPat.applyTransformation(cand.rotTrans) : rawScrPat;
      const dCenterPiece = orientedScrPat.patternData.CENTERS.pieces[5];
      const crossColor = CENTER_COLOR_NAMES[dCenterPiece] || "White";

      const states = [evaluateCfopState(curPat)];
      for (let i = 0; i < N; i++) {
        const trans = getCandMoveTrans(cand, normMoves[i].move);
        curPat = curPat.applyTransformation(trans);
        states.push(evaluateCfopState(curPat));
      }

      const firstCrossIdx = states.findIndex(s => s.crossOk);
      const firstF2l4Idx = states.findIndex(s => s.crossOk && s.f2lCount === 4);
      const maxF2l = Math.max(...states.map(s => s.f2lCount));

      const score =
        (firstF2l4Idx !== -1 ? 100000 - firstF2l4Idx * 100 : 0) +
        (maxF2l >= 0 ? (maxF2l + 1) * 1000 : 0) +
        (firstCrossIdx !== -1 ? 500 - firstCrossIdx : 0);

      if (!bestCandidate || score > bestCandidate.score) {
        bestCandidate = {
          cand,
          crossColor,
          states,
          firstCrossIdx,
          firstF2l4Idx,
          maxF2l,
          score
        };
      }
    } catch (e) {
      // Ignore invalid alg syntax in candidate
    }
  }

  if (!bestCandidate) return null;

  const { states, crossColor } = bestCandidate;
  const startState = states[0];

  // Helper to get cumulative timestamp at state index idx (0 .. N)
  const timeAtIndex = (idx) => {
    if (idx <= 0) return 0;
    if (idx >= N) return Math.max(rawMs, normMoves[N - 1]?.t || 0);
    // If move 0 has t === 0 and idx === 1, estimate from next move split if needed
    const tVal = normMoves[idx - 1].t;
    if (tVal === 0 && idx === 1 && N > 1) {
      return Math.min(200, Math.round((normMoves[1].t || 200) / 2));
    }
    return tVal;
  };

  // Determine milestones
  const startedAtPll = startState.ollOk && !startState.solvedOk;
  const startedAtOll = !startedAtPll && startState.crossOk && startState.f2lCount === 4;

  let crossEnd = 0;
  let f2l1End = 0;
  let f2l2End = 0;
  let f2l3End = 0;
  let f2l4End = 0;
  let ollEnd = 0;
  const pllEnd = N;

  if (startedAtPll) {
    // Scramble started directly at PLL
    crossEnd = f2l1End = f2l2End = f2l3End = f2l4End = ollEnd = 0;
  } else if (startedAtOll) {
    // Scramble started directly at OLL
    crossEnd = f2l1End = f2l2End = f2l3End = f2l4End = 0;
    const foundOllEnd = states.findIndex(s => s.ollOk);
    ollEnd = foundOllEnd !== -1 ? foundOllEnd : N;
  } else {
    // Full solve (or cross/F2L solve)
    const foundF2l4 = states.findIndex(s => s.crossOk && s.f2lCount === 4);
    f2l4End = foundF2l4 !== -1 ? foundF2l4 : N;

    const findFirstAtLeast = (minPairs, maxIdx) => {
      for (let i = 0; i <= maxIdx; i++) {
        if (states[i].crossOk && states[i].f2lCount >= minPairs) {
          return i;
        }
      }
      return maxIdx;
    };

    f2l3End = findFirstAtLeast(3, f2l4End);
    f2l2End = findFirstAtLeast(2, f2l3End);
    f2l1End = findFirstAtLeast(1, f2l2End);

    let foundCross = 0;
    for (let i = 0; i <= f2l1End; i++) {
      if (states[i].crossOk) {
        foundCross = i;
        break;
      }
    }
    crossEnd = foundCross;

    let foundOll = -1;
    if (foundF2l4 !== -1) {
      for (let i = f2l4End; i <= N; i++) {
        if (states[i].ollOk) {
          foundOll = i;
          break;
        }
      }
    }
    ollEnd = foundOll !== -1 ? foundOll : N;
  }

  const crossSolved = startedAtOll || startedAtPll || states.some(s => s.crossOk);
  const f2l4Solved = startedAtOll || startedAtPll || (states[f2l4End]?.crossOk && states[f2l4End]?.f2lCount === 4);
  const ollSolved = startedAtPll || (f2l4Solved && states[ollEnd]?.ollOk);
  const isFullCfop = !startedAtPll && !startedAtOll && f2l4Solved && ollSolved;

  // Build the 7 phase step definitions
  const rawPhases = [
    { key: "cross", label: "Cross", startIdx: 0,       endIdx: crossEnd, active: !startedAtOll && !startedAtPll && crossSolved },
    { key: "f2l1",  label: "F2L 1", startIdx: crossEnd, endIdx: f2l1End,  active: !startedAtOll && !startedAtPll && crossSolved && (f2l1End > crossEnd || f2l4Solved) },
    { key: "f2l2",  label: "F2L 2", startIdx: f2l1End,  endIdx: f2l2End,  active: !startedAtOll && !startedAtPll && crossSolved && (f2l2End > f2l1End || f2l4Solved) },
    { key: "f2l3",  label: "F2L 3", startIdx: f2l2End,  endIdx: f2l3End,  active: !startedAtOll && !startedAtPll && crossSolved && (f2l3End > f2l2End || f2l4Solved) },
    { key: "f2l4",  label: "F2L 4", startIdx: f2l3End,  endIdx: f2l4End,  active: !startedAtOll && !startedAtPll && crossSolved && (f2l4End > f2l3End || f2l4Solved) },
    { key: "oll",   label: "OLL",   startIdx: f2l4End,  endIdx: ollEnd,   active: !startedAtPll && f2l4Solved },
    { key: "pll",   label: "PLL",   startIdx: ollEnd,   endIdx: pllEnd,   active: ollSolved && (!startedAtOll || ollEnd < pllEnd) }
  ];

  const splits = {
    cross: null,
    f2l1: null,
    f2l2: null,
    f2l3: null,
    f2l4: null,
    f2lTotal: null,
    oll: null,
    pll: null
  };

  // Pre-identify OLL and PLL cases so each step row has its caseId
  const detectedOll = (!startedAtPll && states[f2l4End] && states[f2l4End].f2lCount === 4)
    ? identifyOllCaseFromState(states[f2l4End])
    : null;
  const detectedPll = (states[ollEnd] && states[ollEnd].ollOk)
    ? identifyPllCaseFromState(states[ollEnd])
    : null;

  const steps = [];
  for (const ph of rawPhases) {
    if (!ph.active) continue;
    const startMs = timeAtIndex(ph.startIdx);
    const endMs = timeAtIndex(ph.endIdx);
    const durationMs = Math.max(0, endMs - startMs);
    const phaseMoves = normMoves.slice(ph.startIdx, ph.endIdx);
    const phasePauses = [];

    for (const mv of phaseMoves) {
      if (mv.split >= pauseThresholdMs) {
        phasePauses.push(mv);
      }
      // Tag the pause in allPauses with its CFOP phase
      const matchP = allPauses.find(p => p.moveIndex === mv.index);
      if (matchP) {
        matchP.phase = ph.key;
        matchP.phaseLabel = ph.label;
      }
    }

    const phasePauseMs = phasePauses.reduce((acc, m) => acc + m.split, 0);
    const phaseMaxPauseMs = phasePauses.length > 0 ? Math.max(...phasePauses.map(m => m.split)) : 0;

    // Determine caseId for this step
    let caseId = "-";
    if (ph.key === "cross") {
      caseId = crossColor || "White";
    } else if (ph.key.startsWith("f2l")) {
      const prevMask = states[ph.startIdx]?.f2lMask || 0;
      const endMask = states[ph.endIdx]?.f2lMask || 0;
      const diffMask = endMask & ~prevMask;
      const solvedSlots = F2L_SLOTS.filter((_, bit) => (diffMask & (1 << bit)) !== 0).map(s => s.name);
      caseId = solvedSlots.length > 0 ? solvedSlots.join("+") : `Pair ${ph.key.slice(3)}`;
    } else if (ph.key === "oll") {
      caseId = detectedOll ? detectedOll.shortName : (durationMs === 0 ? "OLL Skip" : "-");
    } else if (ph.key === "pll") {
      caseId = detectedPll ? detectedPll.shortName : (durationMs === 0 ? "PLL Skip" : "-");
    }

    // Separate pre-AUF / rotation setup moves (cross-relative U/y) at the start of the step from execution moves
    let setupMoveCount = 0;
    if (ph.key !== "cross" && phaseMoves.length > 0) {
      while (setupMoveCount < phaseMoves.length && isCrossSetupMove(phaseMoves[setupMoveCount].move, bestCandidate.cand)) {
        setupMoveCount++;
      }
    }

    const rawSetupList = phaseMoves.slice(0, setupMoveCount).map(m => m.move);
    const rawExecList = phaseMoves.slice(setupMoveCount).map(m => m.move);
    const setupMoves = collapseDoubleFlickMoves(rawSetupList).join(" ");
    const execMoves = collapseDoubleFlickMoves(rawExecList).join(" ");
    const allCollapsedMoves = collapseDoubleFlickMoves(phaseMoves.map(m => m.move)).join(" ");

    // Recognition time at start of phase (for Cross, inspection is before solve so recogMs = 0)
    let recogMs = 0;
    if (ph.key !== "cross" && phaseMoves.length > 0) {
      for (let mIdx = 0; mIdx < phaseMoves.length; mIdx++) {
        recogMs += phaseMoves[mIdx].split;
        if (!isCrossUMove(phaseMoves[mIdx].move, bestCandidate.cand)) {
          break;
        }
      }
      recogMs = Math.min(durationMs, recogMs);
    }
    const execMs = Math.max(0, durationMs - recogMs);
    const tps = durationMs > 0 ? Number((phaseMoves.length / (durationMs / 1000)).toFixed(2)) : 0;

    splits[ph.key] = durationMs;
    steps.push({
      phase: ph.key,
      label: ph.label,
      caseId,
      ms: durationMs,
      recogMs,
      setupMoves,
      execMs,
      execMoves,
      accumMs: endMs,
      startMoveIdx: ph.startIdx,
      endMoveIdx: ph.endIdx,
      moveCount: phaseMoves.length,
      tps,
      moves: allCollapsedMoves || phaseMoves.map(m => m.move).join(" "),
      rawMoves: phaseMoves.map(m => m.move).join(" "),
      pauseCount: phasePauses.length,
      pauseMs: phasePauseMs,
      maxPauseMs: phaseMaxPauseMs
    });
  }

  let f2lSummary = null;
  if (
    splits.f2l1 != null &&
    splits.f2l2 != null &&
    splits.f2l3 != null &&
    splits.f2l4 != null
  ) {
    splits.f2lTotal = splits.f2l1 + splits.f2l2 + splits.f2l3 + splits.f2l4;
    const f2lSteps = steps.filter(s => s.phase.startsWith("f2l"));
    const f2lRecogMs = f2lSteps.reduce((acc, s) => acc + (s.recogMs || 0), 0);
    const f2lExecMs = f2lSteps.reduce((acc, s) => acc + (s.execMs || 0), 0);
    const f2lMoves = f2lSteps.reduce((acc, s) => acc + (s.moveCount || 0), 0);
    const f2lPauseCount = f2lSteps.reduce((acc, s) => acc + (s.pauseCount || 0), 0);
    const f2lPauseMs = f2lSteps.reduce((acc, s) => acc + (s.pauseMs || 0), 0);
    const f2lAccumMs = f2lSteps[f2lSteps.length - 1]?.accumMs ?? splits.f2lTotal;
    const f2lSetups = f2lSteps.map(s => s.setupMoves).filter(Boolean).join(" · ");
    f2lSummary = {
      phase: "f2lTotal",
      label: "F2L Σ",
      caseId: "4 Pairs",
      ms: splits.f2lTotal,
      recogMs: f2lRecogMs,
      setupMoves: f2lSetups,
      execMs: f2lExecMs,
      execMoves: "",
      accumMs: f2lAccumMs,
      moveCount: f2lMoves,
      tps: splits.f2lTotal > 0 ? Number((f2lMoves / (splits.f2lTotal / 1000)).toFixed(2)) : 0,
      moves: "",
      pauseCount: f2lPauseCount,
      pauseMs: f2lPauseMs
    };
  }

  // Identify OLL Case at states[f2l4End]
  let ollCase = null;
  if (detectedOll) {
    const ollStep = steps.find(s => s.phase === "oll");
    if (ollStep) {
      ollCase = {
        ...detectedOll,
        ms: ollStep.ms,
        recogMs: ollStep.recogMs,
        execMs: ollStep.execMs,
        setupMoves: ollStep.setupMoves,
        moveCount: ollStep.moveCount,
        pauseCount: ollStep.pauseCount,
        pauseMs: ollStep.pauseMs
      };
    }
  }

  // Identify PLL Case at states[ollEnd]
  let pllCase = null;
  if (detectedPll) {
    const pllStep = steps.find(s => s.phase === "pll");
    if (pllStep) {
      pllCase = {
        ...detectedPll,
        ms: pllStep.ms,
        recogMs: pllStep.recogMs,
        execMs: pllStep.execMs,
        setupMoves: pllStep.setupMoves,
        moveCount: pllStep.moveCount,
        pauseCount: pllStep.pauseCount,
        pauseMs: pllStep.pauseMs
      };
    }
  }

  return {
    isFullCfop,
    crossColor,
    splits,
    steps,
    f2lSummary,
    ollCase,
    pllCase,
    pauses: {
      thresholdMs: pauseThresholdMs,
      totalCount: allPauses.length,
      totalMs: totalPauseMs,
      maxPauseMs,
      list: allPauses
    }
  };
}

export async function analyzeCfopSolve(solve, options = {}) {
  await initCfopAnalyzer();
  return analyzeCfopSolveSync(solve, options);
}

export function ensureSolveCfop(solve, options = {}) {
  if (!solve) return null;
  const hasUpgradedSteps =
    solve.cfop &&
    solve.cfop.splits &&
    (!solve.cfop.steps?.length || solve.cfop.steps[0].accumMs !== undefined);
  if (hasUpgradedSteps) return solve.cfop;
  if (isCfopAnalyzerReady()) {
    const analyzed = analyzeCfopSolveSync(solve, options);
    if (analyzed) {
      solve.cfop = analyzed;
      return analyzed;
    }
  }
  return solve.cfop || null;
}

// Compute aggregate CFOP averages across a slice of solves (e.g. current pagination page / last X solves or entire session)
export function computeCfopAverages(solves = [], options = {}) {
  const validSolves = solves.filter(s => s && s.penalty !== "DNF" && s.penalty !== -1);
  for (const s of validSolves) {
    ensureSolveCfop(s, options);
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

  const trimFloat = (vals, decimals = 1, trimRatio = 0.10) => {
    const clean = vals.filter(v => typeof v === "number" && Number.isFinite(v)).sort((a, b) => a - b);
    if (clean.length === 0) return null;
    if (clean.length < 3) {
      return Number((clean.reduce((a, b) => a + b, 0) / clean.length).toFixed(decimals));
    }
    const trimCount = Math.max(1, Math.min(Math.floor((clean.length - 1) / 2), Math.round(clean.length * trimRatio)));
    const sliced = clean.slice(trimCount, clean.length - trimCount);
    return Number((sliced.reduce((a, b) => a + b, 0) / sliced.length).toFixed(decimals));
  };

  const totalTimes = validSolves.map(s => {
    const ms = s.ms ?? s.time ?? 0;
    return (s.penalty === "+2" || s.penalty === 2) ? ms + 2000 : ms;
  });

  const crossVals = [];
  const f2l1Vals = [];
  const f2l2Vals = [];
  const f2l3Vals = [];
  const f2l4Vals = [];
  const f2lTotalVals = [];
  const ollVals = [];
  const pllVals = [];
  const pauseCountVals = [];
  const pauseMsVals = [];
  const cubeVals = [];
  const inspectionVals = [];
  const pickupVals = [];
  const putdownVals = [];

  let cfopSolveCount = 0;

  for (const s of validSolves) {
    const cubeMsVal = (typeof s.cubeMs === "number" && Number.isFinite(s.cubeMs))
      ? s.cubeMs
      : ((Array.isArray(s.moves) && s.moves.length > 0 && Number.isFinite(s.rawMs ?? s.ms)) ? (s.rawMs ?? s.ms) : null);
    if (cubeMsVal != null) cubeVals.push(cubeMsVal);
    if (typeof s.inspectionMs === "number" && Number.isFinite(s.inspectionMs)) inspectionVals.push(s.inspectionMs);
    if (typeof s.pickupMs === "number" && Number.isFinite(s.pickupMs)) pickupVals.push(s.pickupMs);
    if (typeof s.putdownMs === "number" && Number.isFinite(s.putdownMs)) putdownVals.push(s.putdownMs);
    const cfop = s.cfop;
    if (!cfop) continue;
    cfopSolveCount++;
    const sp = cfop.splits || {};
    if (sp.cross != null) crossVals.push(sp.cross);
    if (sp.f2l1 != null) f2l1Vals.push(sp.f2l1);
    if (sp.f2l2 != null) f2l2Vals.push(sp.f2l2);
    if (sp.f2l3 != null) f2l3Vals.push(sp.f2l3);
    if (sp.f2l4 != null) f2l4Vals.push(sp.f2l4);
    if (sp.f2lTotal != null) f2lTotalVals.push(sp.f2lTotal);
    if (sp.oll != null) ollVals.push(sp.oll);
    if (sp.pll != null) pllVals.push(sp.pll);
    if (cfop.pauses) {
      pauseCountVals.push(cfop.pauses.totalCount);
      pauseMsVals.push(cfop.pauses.totalMs);
    }
  }

  return {
    solveCount: validSolves.length,
    cfopSolveCount,
    totalMs: avgOf(totalTimes),
    cubeMs: avgOf(cubeVals),
    inspectionMs: avgOf(inspectionVals),
    pickupMs: avgOf(pickupVals),
    putdownMs: avgOf(putdownVals),
    cross: avgOf(crossVals),
    f2l1: avgOf(f2l1Vals),
    f2l2: avgOf(f2l2Vals),
    f2l3: avgOf(f2l3Vals),
    f2l4: avgOf(f2l4Vals),
    f2lTotal: avgOf(f2lTotalVals),
    oll: avgOf(ollVals),
    pll: avgOf(pllVals),
    avgPauseCount: avgFloat(pauseCountVals, 1),
    avgPauseMs: avgOf(pauseMsVals),
    median: {
      totalMs: computeMedian(totalTimes),
      cubeMs: computeMedian(cubeVals),
      inspectionMs: computeMedian(inspectionVals),
      pickupMs: computeMedian(pickupVals),
      putdownMs: computeMedian(putdownVals),
      cross: computeMedian(crossVals),
      f2l1: computeMedian(f2l1Vals),
      f2l2: computeMedian(f2l2Vals),
      f2l3: computeMedian(f2l3Vals),
      f2l4: computeMedian(f2l4Vals),
      f2lTotal: computeMedian(f2lTotalVals),
      oll: computeMedian(ollVals),
      pll: computeMedian(pllVals),
      pauseCount: medianFloat(pauseCountVals, 1),
      pauseMs: computeMedian(pauseMsVals)
    },
    trimMean: {
      totalMs: computeTrimmedMean(totalTimes, 0.10),
      cubeMs: computeTrimmedMean(cubeVals, 0.10),
      inspectionMs: computeTrimmedMean(inspectionVals, 0.10),
      pickupMs: computeTrimmedMean(pickupVals, 0.10),
      putdownMs: computeTrimmedMean(putdownVals, 0.10),
      cross: computeTrimmedMean(crossVals, 0.10),
      f2l1: computeTrimmedMean(f2l1Vals, 0.10),
      f2l2: computeTrimmedMean(f2l2Vals, 0.10),
      f2l3: computeTrimmedMean(f2l3Vals, 0.10),
      f2l4: computeTrimmedMean(f2l4Vals, 0.10),
      f2lTotal: computeTrimmedMean(f2lTotalVals, 0.10),
      oll: computeTrimmedMean(ollVals, 0.10),
      pll: computeTrimmedMean(pllVals, 0.10),
      pauseCount: trimFloat(pauseCountVals, 1, 0.10),
      pauseMs: computeTrimmedMean(pauseMsVals, 0.10)
    }
  };
}

// Aggregate per-case OLL and PLL statistics (times and pauses per case) across solves
export function computeOllPllCaseStats(solves = [], options = {}) {
  const validSolves = solves.filter(s => s && s.penalty !== "DNF" && s.penalty !== -1);
  const ollMap = new Map();
  const pllMap = new Map();

  for (const s of validSolves) {
    const cfop = ensureSolveCfop(s, options);
    if (!cfop) continue;

    if (cfop.ollCase && cfop.ollCase.id && cfop.ollCase.id !== "OLL Skip") {
      const oc = cfop.ollCase;
      if (!ollMap.has(oc.id)) {
        ollMap.set(oc.id, {
          id: oc.id,
          name: oc.name || oc.id,
          shortName: oc.shortName || oc.id,
          group: oc.group || "OLL",
          times: [],
          pauseCounts: [],
          pauseMsList: [],
          recogMsList: [],
          execMsList: [],
          moveCounts: []
        });
      }
      const entry = ollMap.get(oc.id);
      if (typeof oc.ms === "number" && oc.ms > 0) entry.times.push(oc.ms);
      if (typeof oc.pauseCount === "number") entry.pauseCounts.push(oc.pauseCount);
      if (typeof oc.pauseMs === "number") entry.pauseMsList.push(oc.pauseMs);
      if (typeof oc.recogMs === "number") entry.recogMsList.push(oc.recogMs);
      if (typeof oc.execMs === "number") entry.execMsList.push(oc.execMs);
      if (typeof oc.moveCount === "number") entry.moveCounts.push(oc.moveCount);
    }

    if (cfop.pllCase && cfop.pllCase.id && cfop.pllCase.id !== "PLL Skip") {
      const pc = cfop.pllCase;
      if (!pllMap.has(pc.id)) {
        pllMap.set(pc.id, {
          id: pc.id,
          name: pc.name || pc.id,
          shortName: pc.shortName || pc.id,
          group: pc.group || "PLL",
          times: [],
          pauseCounts: [],
          pauseMsList: [],
          recogMsList: [],
          execMsList: [],
          moveCounts: []
        });
      }
      const entry = pllMap.get(pc.id);
      if (typeof pc.ms === "number" && pc.ms > 0) entry.times.push(pc.ms);
      if (typeof pc.pauseCount === "number") entry.pauseCounts.push(pc.pauseCount);
      if (typeof pc.pauseMs === "number") entry.pauseMsList.push(pc.pauseMs);
      if (typeof pc.recogMs === "number") entry.recogMsList.push(pc.recogMs);
      if (typeof pc.execMs === "number") entry.execMsList.push(pc.execMs);
      if (typeof pc.moveCount === "number") entry.moveCounts.push(pc.moveCount);
    }
  }

  const summarizeGroup = (map) => {
    const list = [];
    for (const entry of map.values()) {
      const count = entry.times.length;
      if (count === 0) continue;
      const best = Math.min(...entry.times);
      const worst = Math.max(...entry.times);
      const avgMs = Math.round(entry.times.reduce((a, b) => a + b, 0) / count);
      const medianMs = computeMedian(entry.times);
      const trimMeanMs = computeTrimmedMean(entry.times, 0.10);
      const avgPauseCount = entry.pauseCounts.length
        ? Number((entry.pauseCounts.reduce((a, b) => a + b, 0) / entry.pauseCounts.length).toFixed(1))
        : 0;
      const avgPauseMs = entry.pauseMsList.length
        ? Math.round(entry.pauseMsList.reduce((a, b) => a + b, 0) / entry.pauseMsList.length)
        : 0;
      const avgRecogMs = entry.recogMsList.length
        ? Math.round(entry.recogMsList.reduce((a, b) => a + b, 0) / entry.recogMsList.length)
        : 0;
      const avgExecMs = entry.execMsList.length
        ? Math.round(entry.execMsList.reduce((a, b) => a + b, 0) / entry.execMsList.length)
        : Math.max(0, avgMs - avgRecogMs);
      const avgMoves = entry.moveCounts.length
        ? Number((entry.moveCounts.reduce((a, b) => a + b, 0) / entry.moveCounts.length).toFixed(1))
        : 0;

      list.push({
        id: entry.id,
        name: entry.name,
        shortName: entry.shortName,
        group: entry.group,
        attempts: count,
        avgMs,
        medianMs,
        trimMeanMs,
        bestMs: best,
        worstMs: worst,
        avgPauseCount,
        avgPauseMs,
        avgRecogMs,
        avgExecMs,
        avgMoves
      });
    }
    // Default sort: slowest median time first (then trimMean, then mean) so user immediately sees where to improve
    list.sort((a, b) => (b.medianMs ?? 0) - (a.medianMs ?? 0) || (b.trimMeanMs ?? 0) - (a.trimMeanMs ?? 0) || b.avgMs - a.avgMs || b.avgPauseMs - a.avgPauseMs);
    return list;
  };

  return {
    ollCases: summarizeGroup(ollMap),
    pllCases: summarizeGroup(pllMap)
  };
}
