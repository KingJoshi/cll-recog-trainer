import { Alg } from "cubing/alg";
import { puzzles } from "cubing/puzzles";
import { ORIENTATIONS_24, getKpuzzle } from "./cubeUtils.js";

const U_AUFS = ["", "U", "U'", "U2"];
const D_AUFS = ["", "D", "D'", "D2"];
const Y_AUFS = ["", "y", "y'", "y2"];

const extraKpuzzleCache = new Map();
const solvedRotCache = new Map();

/**
 * Normalizes user-entered algorithm text for cubing.js parsing.
 * Handles curly quotes, grouping parentheses, brackets, and redundant whitespace.
 */
export function normalizeAlgText(raw = "") {
  return String(raw || "")
    .replace(/[’′`]/g, "'")
    .replace(/2'/g, "2")
    .replace(/[()[\],]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function joinMoves(...parts) {
  return parts
    .map(p => normalizeAlgText(p))
    .filter(Boolean)
    .join(" ");
}

function mapAppPuzzleToKpuzzleName(puzzleId = "333") {
  if (puzzleId === "222" || puzzleId === "2x2x2") return "2x2x2";
  if (puzzleId === "444" || puzzleId === "4x4x4") return "4x4x4";
  if (puzzleId === "555" || puzzleId === "5x5x5") return "5x5x5";
  return "3x3x3";
}

async function getKpuzzleForApp(puzzleId = "333") {
  const kpName = mapAppPuzzleToKpuzzleName(puzzleId);
  if (kpName === "2x2x2" || kpName === "3x3x3") {
    return getKpuzzle(kpName);
  }
  if (!extraKpuzzleCache.has(kpName)) {
    const loader = puzzles[kpName];
    if (!loader) return null;
    extraKpuzzleCache.set(kpName, loader.kpuzzle());
  }
  return extraKpuzzleCache.get(kpName);
}

async function getSolvedOrientationTables(puzzleId = "333") {
  const kpName = mapAppPuzzleToKpuzzleName(puzzleId);
  if (solvedRotCache.has(kpName)) {
    return solvedRotCache.get(kpName);
  }
  const promise = (async () => {
    const kp = await getKpuzzleForApp(kpName);
    if (!kp) return null;
    const solved = kp.defaultPattern();
    const ySolved = Y_AUFS.map(y => (y ? solved.applyAlg(y) : solved));
    const allSolved = [];
    const seen = new Set();
    for (const rot of ORIENTATIONS_24) {
      const p = rot ? solved.applyAlg(rot) : solved;
      const key = JSON.stringify(p.patternData);
      if (!seen.has(key)) {
        seen.add(key);
        allSolved.push(p);
      }
    }
    return { solved, ySolved, allSolved };
  })();
  solvedRotCache.set(kpName, promise);
  return promise;
}

function isIdenticalToAnySolved(pattern, tables, { allowAnyRot = false } = {}) {
  const targets = allowAnyRot ? tables.allSolved : tables.ySolved;
  for (const u of U_AUFS) {
    const p = u ? pattern.applyAlg(u) : pattern;
    for (const t of targets) {
      if (p.isIdentical(t)) return true;
    }
  }
  return false;
}

function is2x2OllSolved(pattern, solved, { requireBottomPerm = false } = {}) {
  for (const y of Y_AUFS) {
    const p = y ? pattern.applyAlg(y) : pattern;
    const cp = p.patternData.CORNERS.pieces;
    const co = p.patternData.CORNERS.orientation;
    const expCp = solved.patternData.CORNERS.pieces;
    const expCo = solved.patternData.CORNERS.orientation;

    let dOk = true;
    for (let i = 4; i < 8; i++) {
      if (co[i] !== expCo[i] || (requireBottomPerm && cp[i] !== expCp[i])) {
        dOk = false;
        break;
      }
    }
    if (!dOk) continue;

    if (co.slice(0, 4).every(o => o === 0)) {
      return true;
    }
  }
  return false;
}

function is2x2PblSolved(pattern, tables) {
  for (const d of D_AUFS) {
    const p = d ? pattern.applyAlg(d) : pattern;
    if (isIdenticalToAnySolved(p, tables, { allowAnyRot: false })) {
      return true;
    }
  }
  return false;
}

function is3x3F2lSolved(pattern, solved) {
  for (const y of Y_AUFS) {
    const p = y ? pattern.applyAlg(y) : pattern;
    const expEdges = solved.patternData.EDGES.pieces;
    const expEdgeOri = solved.patternData.EDGES.orientation;
    const expCorners = solved.patternData.CORNERS.pieces;
    const expCornerOri = solved.patternData.CORNERS.orientation;

    const ep = p.patternData.EDGES.pieces;
    const eo = p.patternData.EDGES.orientation;
    const cp = p.patternData.CORNERS.pieces;
    const co = p.patternData.CORNERS.orientation;

    let ok = true;
    for (let i = 4; i < 12; i++) {
      if (ep[i] !== expEdges[i] || eo[i] !== expEdgeOri[i]) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    for (let i = 4; i < 8; i++) {
      if (cp[i] !== expCorners[i] || co[i] !== expCornerOri[i]) {
        ok = false;
        break;
      }
    }
    if (ok) return true;
  }
  return false;
}

function is3x3OllSolved(pattern, solved) {
  for (const y of Y_AUFS) {
    const p = y ? pattern.applyAlg(y) : pattern;
    const expEdges = solved.patternData.EDGES.pieces;
    const expEdgeOri = solved.patternData.EDGES.orientation;
    const expCorners = solved.patternData.CORNERS.pieces;
    const expCornerOri = solved.patternData.CORNERS.orientation;

    const ep = p.patternData.EDGES.pieces;
    const eo = p.patternData.EDGES.orientation;
    const cp = p.patternData.CORNERS.pieces;
    const co = p.patternData.CORNERS.orientation;

    let f2lOk = true;
    for (let i = 4; i < 12; i++) {
      if (ep[i] !== expEdges[i] || eo[i] !== expEdgeOri[i]) {
        f2lOk = false;
        break;
      }
    }
    if (!f2lOk) continue;
    for (let i = 4; i < 8; i++) {
      if (cp[i] !== expCorners[i] || co[i] !== expCornerOri[i]) {
        f2lOk = false;
        break;
      }
    }
    if (!f2lOk) continue;

    if (eo.slice(0, 4).every(o => o === 0) && co.slice(0, 4).every(o => o === 0)) {
      return true;
    }
  }
  return false;
}

function is3x3CollSolved(pattern, solved) {
  if (!is3x3F2lSolved(pattern, solved)) return false;
  for (const u of U_AUFS) {
    const p = u ? pattern.applyAlg(u) : pattern;
    const cp = p.patternData.CORNERS.pieces;
    const co = p.patternData.CORNERS.orientation;
    const eo = p.patternData.EDGES.orientation;
    if ([0, 1, 2, 3].every(i => cp[i] === i && co[i] === 0 && eo[i] === 0)) {
      return true;
    }
  }
  return false;
}

function is3x3CmllSolved(pattern, solved) {
  for (const u of U_AUFS) {
    const p = u ? pattern.applyAlg(u) : pattern;
    const cp = p.patternData.CORNERS.pieces;
    const co = p.patternData.CORNERS.orientation;
    const ep = p.patternData.EDGES.pieces;
    const eo = p.patternData.EDGES.orientation;
    const blocksOk = [4, 5, 6, 7].every(i => cp[i] === i && co[i] === 0)
      && [5, 7, 8, 9, 10, 11].every(i => ep[i] === i && eo[i] === 0);
    const uCornersOk = [0, 1, 2, 3].every(i => cp[i] === i && co[i] === 0);
    if (blocksOk && uCornersOk) return true;
  }
  return false;
}

function matchesTrackCompletion(pattern, tables, puzzleId, trackId, caseObj) {
  const id = String(caseObj?.id || "").toLowerCase();
  if (puzzleId === "222" && (id.startsWith("ortega-oll-") || id.startsWith("lbl-oll-"))) {
    return is2x2OllSolved(pattern, tables.solved, {
      requireBottomPerm: id.startsWith("lbl-oll-")
    });
  }
  if (puzzleId === "222" && id.startsWith("ortega-pbl-")) {
    return is2x2PblSolved(pattern, tables);
  }
  if ((puzzleId === "333" || puzzleId === "333oh") && trackId === "f2l") {
    return is3x3F2lSolved(pattern, tables.solved);
  }
  if ((puzzleId === "333" || puzzleId === "333oh") && (trackId === "oll" || trackId === "wv")) {
    return is3x3OllSolved(pattern, tables.solved);
  }
  if ((puzzleId === "333" || puzzleId === "333oh") && trackId === "coll") {
    return is3x3CollSolved(pattern, tables.solved);
  }
  if ((puzzleId === "333" || puzzleId === "333oh") && trackId === "cmll") {
    return is3x3CmllSolved(pattern, tables.solved);
  }
  const allowAnyRot = puzzleId === "222"
    ? trackId === "cll"
    : puzzleId === "333" || puzzleId === "333oh";
  return isIdenticalToAnySolved(pattern, tables, { allowAnyRot });
}

/**
 * Verifies that a user-entered algorithm solves the given case across its setup/scrambles
 * on a KPuzzle simulation (testing standard execution and U/U'/U2 pre-AUF offsets).
 */
export async function verifyCustomAlgForCase(puzzleId, trackId, caseObj, rawAlgStr) {
  const normalizedAlg = normalizeAlgText(rawAlgStr);
  if (!normalizedAlg) {
    return {
      valid: false,
      normalizedAlg: "",
      startAuf: "",
      reason: "Enter an algorithm using standard cubing notation (e.g. R U R' U')."
    };
  }

  let parsedAlg;
  try {
    parsedAlg = Alg.fromString(normalizedAlg);
  } catch (err) {
    return {
      valid: false,
      normalizedAlg,
      startAuf: "",
      reason: `Invalid move notation: ${err?.message || "unable to parse algorithm."}`
    };
  }

  const kp = await getKpuzzleForApp(puzzleId);
  const tables = await getSolvedOrientationTables(puzzleId);
  if (!kp || !tables) {
    return {
      valid: false,
      normalizedAlg,
      startAuf: "",
      reason: "KPuzzle verifier unavailable for this puzzle."
    };
  }

  // Test applying once on solved pattern first so invalid wide/slice moves for this puzzle are caught cleanly
  try {
    tables.solved.applyAlg(parsedAlg);
  } catch (err) {
    return {
      valid: false,
      normalizedAlg,
      startAuf: "",
      reason: `Unsupported move for this puzzle: ${err?.message || "check move notation."}`
    };
  }

  const scrambles = Array.from(
    new Set([caseObj?.setup, ...(caseObj?.scrambles || [])].filter(Boolean))
  );
  if (scrambles.length === 0) {
    return {
      valid: false,
      normalizedAlg,
      startAuf: "",
      reason: "This case has no setup pattern to verify against."
    };
  }

  for (const preAuf of U_AUFS) {
    const exec = joinMoves(preAuf, normalizedAlg);
    let allPassed = true;
    for (const scr of scrambles) {
      const full = joinMoves(scr, exec);
      let resultPat;
      try {
        resultPat = tables.solved.applyAlg(full);
      } catch {
        allPassed = false;
        break;
      }
      if (!matchesTrackCompletion(resultPat, tables, puzzleId, trackId, caseObj)) {
        allPassed = false;
        break;
      }
    }
    if (allPassed) {
      return {
        valid: true,
        normalizedAlg,
        startAuf: preAuf,
        reason: preAuf
          ? `Verified! Needs ${preAuf} pre-AUF from default angle.`
          : "Verified against puzzle state."
      };
    }
  }

  return {
    valid: false,
    normalizedAlg,
    startAuf: "",
    reason: "This algorithm does not solve the case from any U angle."
  };
}

/**
 * Checks whether a track supports full last-layer post-alg AUF prediction.
 */
export function isAufQuizTrackSupported(puzzleId, trackId) {
  if (puzzleId === "222") {
    return ["cll", "eg1", "eg2"].includes(trackId);
  }
  if (puzzleId === "333" || puzzleId === "333oh") {
    return trackId === "pll";
  }
  return false;
}

/**
 * Given the displayed full scramble and the solver's execution algorithm (without startAuf),
 * computes the expected post-alg U-layer AUF ("", "U", "U'", or "U2") after aligning pre-AUF.
 */
export async function computeExpectedPostAuf(puzzleId, trackId, fullScrambleStr, algStr) {
  if (!isAufQuizTrackSupported(puzzleId, trackId)) return null;
  const algClean = normalizeAlgText(algStr);
  const scrClean = normalizeAlgText(fullScrambleStr);
  if (!algClean || !scrClean) return null;

  const tables = await getSolvedOrientationTables(puzzleId);
  if (!tables) return null;

  let basePat;
  try {
    basePat = tables.solved.applyAlg(scrClean);
  } catch {
    return null;
  }

  for (const preAuf of U_AUFS) {
    let afterAlg;
    try {
      afterAlg = basePat.applyAlg(joinMoves(preAuf, algClean));
    } catch {
      continue;
    }
    for (const postAuf of U_AUFS) {
      const candidate = postAuf ? afterAlg.applyAlg(postAuf) : afterAlg;
      if (tables.allSolved.some(t => candidate.isIdentical(t))) {
        return {
          preAuf,
          postAuf,
          alg: algClean
        };
      }
    }
  }

  return null;
}
