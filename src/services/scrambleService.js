// Weighted case sampling and WCA / case-scramble generation across 2x2..5x5

import { randomScrambleForEvent } from 'cubing/scramble';
import { setSearchDebug } from 'cubing/search';
import { cleanAlg } from '../algParser.js';
import { getSolveTime } from './solveStats.js';
import { PUZZLES } from '../data/algRegistry.js';

// In Vite production builds, prefer the bundled dynamic-import worker URL over
// `import.meta.resolve('./search-worker-entry.js')`, which Vite does not rewrite.
if (typeof Worker !== 'undefined') {
  setSearchDebug({ prioritizeEsbuildWorkaroundForWorkerInstantiation: true });
}

const SCRAMBLE_FALLBACKS = {
  "222": { faces: ["R", "U", "F"], modifiers: ["", "'", "2"], minLen: 9, randExtra: 3, axisAware: false },
  "333": { faces: ["R", "L", "U", "D", "F", "B"], modifiers: ["", "'", "2"], len: 21, axisAware: true },
  "333bf": { faces: ["R", "L", "U", "D", "F", "B"], modifiers: ["", "'", "2"], len: 21, axisAware: true },
  "444": { faces: ["R", "L", "U", "D", "F", "B", "Rw", "Fw", "Uw"], modifiers: ["", "'", "2"], len: 40, axisAware: false },
  "555": { faces: ["R", "L", "U", "D", "F", "B", "Rw", "Lw", "Fw", "Bw", "Uw", "Dw"], modifiers: ["", "'", "2"], len: 60, axisAware: false },
  "pyram": { faces: ["U", "L", "R", "B"], modifiers: ["", "'"], minLen: 10, randExtra: 2, axisAware: false },
  "skewb": { faces: ["U", "L", "R", "B"], modifiers: ["", "'"], minLen: 9, randExtra: 2, axisAware: false },
  "666": { faces: ["R", "L", "U", "D", "F", "B", "Rw", "Lw", "Fw", "Bw", "Uw", "Dw", "3Rw", "3Uw", "3Fw"], modifiers: ["", "'", "2"], len: 80, axisAware: false },
  "777": { faces: ["R", "L", "U", "D", "F", "B", "Rw", "Lw", "Fw", "Bw", "Uw", "Dw", "3Rw", "3Lw", "3Uw", "3Dw", "3Fw", "3Bw"], modifiers: ["", "'", "2"], len: 100, axisAware: false },
  "fto": { faces: ["U", "D", "F", "B", "L", "R", "BL", "BR"], modifiers: ["", "'"], len: 25, axisAware: false },
  "minx": { custom: "minx" },
  "sq1": { custom: "sq1" },
  "clock": { custom: "clock" }
};

async function generateWcaScrambleWithTimeout(eventName, timeoutMs, fallbackKey) {
  try {
    const scrPromise = randomScrambleForEvent(eventName);
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("timeout")), timeoutMs));
    const scr = await Promise.race([scrPromise, timeoutPromise]);
    if (scr && typeof scr.toString === "function") {
      const s = scr.toString().trim();
      if (s) return s;
    }
  } catch {}

  const cfg = SCRAMBLE_FALLBACKS[fallbackKey] || SCRAMBLE_FALLBACKS["333"];
  if (cfg.custom === "minx") {
    const rows = [];
    for (let r = 0; r < 7; r++) {
      const seq = [];
      for (let c = 0; c < 10; c++) {
        const axis = c % 2 === 0 ? "R" : "D";
        seq.push(axis + (Math.random() < 0.5 ? "++" : "--"));
      }
      seq.push(Math.random() < 0.5 ? "U" : "U'");
      rows.push(seq.join(" "));
    }
    return rows.join(" ");
  }
  if (cfg.custom === "clock") {
    const dials = ["UR", "DR", "DL", "UL", "U", "R", "D", "L", "ALL"];
    const backDials = ["U", "R", "D", "L", "ALL"];
    const fmt = () => {
      const n = Math.floor(Math.random() * 12) - 5;
      return `${Math.abs(n)}${n < 0 ? "-" : "+"}`;
    };
    const part1 = dials.map(d => `${d}${fmt()}`).join(" ");
    const part2 = backDials.map(d => `${d}${fmt()}`).join(" ");
    return `${part1} y2 ${part2}`;
  }
  if (cfg.custom === "sq1") {
    const seq = [];
    for (let i = 0; i < 12; i++) {
      const top = Math.floor(Math.random() * 12) - 5;
      const bot = Math.floor(Math.random() * 12) - 5;
      seq.push(`(${top}, ${bot})`);
      if (i < 11) seq.push("/");
    }
    return seq.join(" ");
  }
  const count = cfg.len || (cfg.minLen + Math.floor(Math.random() * cfg.randExtra));
  const moves = [];
  if (cfg.axisAware) {
    let lastAxis = -1;
    for (let i = 0; i < count; i++) {
      let axis;
      do {
        axis = Math.floor(Math.random() * 3);
      } while (axis === lastAxis);
      lastAxis = axis;
      const face = cfg.faces[axis * 2 + (Math.random() < 0.5 ? 0 : 1)];
      const mod = cfg.modifiers[Math.floor(Math.random() * cfg.modifiers.length)];
      moves.push(face + mod);
    }
  } else {
    let lastFace = "";
    for (let i = 0; i < count; i++) {
      const allowed = cfg.faces.filter(f => f !== lastFace);
      const face = allowed[Math.floor(Math.random() * allowed.length)];
      lastFace = face;
      const mod = cfg.modifiers[Math.floor(Math.random() * cfg.modifiers.length)];
      moves.push(face + mod);
    }
  }
  return moves.join(" ");
}

const TWO_BY_TWO_CONJUGATIONS = {
  // Exact 2x2 equivalence: turning L is equivalent to turning R after re-indexing faces by x' (with R=R, L=L)
  L: { urf: "R", rot: { U: "B", B: "D", D: "F", F: "U", R: "R", L: "L" } },
  // Exact 2x2 equivalence: turning D is equivalent to turning U after re-indexing faces by y' (with U=U, D=D)
  D: { urf: "U", rot: { F: "L", L: "B", B: "R", R: "F", U: "U", D: "D" } },
  // Exact 2x2 equivalence: turning B is equivalent to turning F after re-indexing faces by z' (with F=F, B=B)
  B: { urf: "F", rot: { U: "R", R: "D", D: "L", L: "U", F: "F", B: "B" } }
};

/**
 * Rewrites any 2x2 scramble/algorithm containing L, D, or B turns into an
 * equivalent pure {U, R, F} sequence (preserving the 2x2 state up to whole-cube orientation).
 * Needed because 2x2 smart cubes (e.g. MoYu WCU_MY22) physically anchor DLB and only report U/R/F.
 */
export function normalize2x2ScrambleToURF(scrambleStr) {
  if (!scrambleStr || typeof scrambleStr !== "string") return "";
  let faceMap = { U: "U", D: "D", F: "F", B: "B", L: "L", R: "R" };
  const simplified = [];

  const pushMove = (face, amount) => {
    const norm = ((amount % 4) + 4) % 4;
    if (norm === 0) return;
    const prev = simplified[simplified.length - 1];
    if (prev && prev.face === face) {
      const combined = (prev.amount + norm) % 4;
      if (combined === 0) simplified.pop();
      else prev.amount = combined;
    } else {
      simplified.push({ face, amount: norm });
    }
  };

  for (const token of scrambleStr.trim().split(/\s+/)) {
    const match = /^([UDFBLR])([2']|2')?$/.exec(token);
    if (!match) continue;
    const suffix = match[2] || "";
    const amount = suffix.includes("2") ? 2 : (suffix.includes("'") ? 3 : 1);
    const currentFace = faceMap[match[1]];
    const conj = TWO_BY_TWO_CONJUGATIONS[currentFace];
    if (conj) {
      pushMove(conj.urf, amount);
      for (let step = 0; step < amount; step++) {
        const nextMap = {};
        for (const [k, v] of Object.entries(faceMap)) {
          nextMap[k] = conj.rot[v];
        }
        faceMap = nextMap;
      }
    } else {
      pushMove(currentFace, amount);
    }
  }

  return simplified
    .map(m => m.face + (m.amount === 2 ? "2" : (m.amount === 3 ? "'" : "")))
    .join(" ");
}

export async function generateWca2x2Scramble() {
  const raw = await generateWcaScrambleWithTimeout("222", 1500, "222");
  return normalize2x2ScrambleToURF(raw);
}

export function generateWca3x3Scramble() {
  return generateWcaScrambleWithTimeout("333", 800, "333");
}

export function generateWca3x3OhScramble() {
  return generateWcaScrambleWithTimeout("333oh", 1000, "333");
}

export function generateWca4x4Scramble() {
  return generateWcaScrambleWithTimeout("444", 2500, "444");
}

export function generateWca5x5Scramble() {
  return generateWcaScrambleWithTimeout("555", 2500, "555");
}

const EXTRA_WCA_SCRAMBLES = new Set(["pyram", "skewb", "minx", "sq1", "clock", "333bf", "666", "777", "fto"]);

export function generateWcaScrambleForPuzzle(puzzleId) {
  const customDef = PUZZLES[puzzleId];
  if (customDef?.isCustomEvent) {
    if (!customDef.wcaEvent || customDef.wcaEvent === "none") {
      return Promise.resolve("");
    }
    return generateWcaScrambleForPuzzle(customDef.wcaEvent);
  }
  if (puzzleId === "222") return generateWca2x2Scramble();
  if (puzzleId === "333oh") return generateWca3x3OhScramble();
  if (puzzleId === "444") return generateWca4x4Scramble();
  if (puzzleId === "555") return generateWca5x5Scramble();
  if (EXTRA_WCA_SCRAMBLES.has(puzzleId)) {
    return generateWcaScrambleWithTimeout(puzzleId, 2000, puzzleId);
  }
  return generateWca3x3Scramble();
}

export function randomU() {
  const choices = ["", " U", " U2", " U'"];
  return choices[Math.floor(Math.random() * choices.length)];
}

export function getPerformanceMultipliers(ids, solves = []) {
  const caseSolves = new Map();
  for (const s of solves) {
    if (!s || !s.id) continue;
    const t = getSolveTime(s);
    if (t == null || !Number.isFinite(t)) continue;
    if (!caseSolves.has(s.id)) caseSolves.set(s.id, []);
    caseSolves.get(s.id).push(t);
  }

  const list = ids.map(id => {
    const times = caseSolves.get(id);
    if (!times || times.length === 0) {
      return { id, median: null, mean: null };
    }
    const attempts = times.length;
    const mean = times.reduce((sum, t) => sum + t, 0) / attempts;
    const sorted = [...times].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    return { id, median, mean };
  });

  function compareCasesByPerformance(a, b) {
    if (a.median == null && b.median == null) return 0;
    if (a.median == null) return -1;
    if (b.median == null) return 1;

    const medDiff = Math.abs(a.median - b.median);
    const avgMed = (a.median + b.median) / 2;
    const isSimilarMedian = medDiff <= Math.max(50, avgMed * 0.03);
    if (isSimilarMedian && a.mean !== b.mean) {
      return b.mean - a.mean;
    }
    return b.median - a.median;
  }

  list.sort(compareCasesByPerformance);

  const n = list.length;
  const multipliers = {};
  if (n <= 1) {
    ids.forEach(id => { multipliers[id] = 1.0; });
    return multipliers;
  }

  let i = 0;
  while (i < n) {
    let j = i;
    while (j + 1 < n && compareCasesByPerformance(list[i], list[j + 1]) === 0) {
      j++;
    }
    const avgRank = (i + j) / 2;
    const t = avgRank / (n - 1);
    const mult = 2.0 - 1.5 * t;
    for (let k = i; k <= j; k++) {
      multipliers[list[k].id] = mult;
    }
    i = j + 1;
  }

  return multipliers;
}

const SRS_TAG_WEIGHTS = {
  learning: 2.0,
  review: 1.4,
  mastered: 0.55
};

/**
 * Selects a case id using anti-repeat appearance decay, solve-time performance,
 * study mastery tags (SRS), and recognition accuracy weights.
 */
export function chooseWeightedCaseId(ids = [], caseAppearances = {}, solves = [], opts = {}) {
  if (!ids || ids.length === 0) return null;
  if (ids.length === 1) return ids[0];

  const { caseTags = null, recogStats = null } = opts || {};

  let minCount = Infinity;
  for (const id of ids) {
    const count = caseAppearances[id] || 0;
    if (count < minCount) minCount = count;
  }
  if (!Number.isFinite(minCount)) minCount = 0;

  if (minCount > 0) {
    for (const id of ids) {
      caseAppearances[id] = (caseAppearances[id] || 0) - minCount;
    }
    minCount = 0;
  }

  const perfMultipliers = getPerformanceMultipliers(ids, solves);
  const weights = [];
  let totalWeight = 0;
  for (const id of ids) {
    const delta = (caseAppearances[id] || 0) - minCount;
    const attemptWeight = Math.pow(5, -delta);
    const perfMult = perfMultipliers[id] || 1.0;

    let tagMult = 1.0;
    if (caseTags) {
      const tag = caseTags[id] || "none";
      tagMult = SRS_TAG_WEIGHTS[tag] ?? 1.15;
    }

    let recogMult = 1.0;
    const stat = recogStats?.[id];
    const shown = Number(stat?.shown || 0);
    if (shown >= 2) {
      const correct = Number(stat?.correct || 0);
      const acc = Math.max(0, Math.min(1, correct / shown));
      recogMult = 1 + (1 - acc) * 1.2;
    }

    const w = attemptWeight * perfMult * tagMult * recogMult;
    weights.push(w);
    totalWeight += w;
  }

  let r = Math.random() * totalWeight;
  let chosenId = ids[ids.length - 1];
  for (let i = 0; i < ids.length; i++) {
    r -= weights[i];
    if (r <= 0) {
      chosenId = ids[i];
      break;
    }
  }

  caseAppearances[chosenId] = (caseAppearances[chosenId] || 0) + 1;
  return chosenId;
}

export const ALL_BOTTOM_FACES = ["white", "yellow", "green", "blue", "red", "orange"];

export const BOTTOM_LAYER_ROTATIONS = {
  white: "z2",
  yellow: "",
  green: "x'",
  blue: "x",
  red: "z",
  orange: "z'"
};

const Y_TURNS = ["", "y", "y2", "y'"];

export function sanitizeTrainingBottomFaces(faces, fallback = ["white"]) {
  if (!Array.isArray(faces)) return [...fallback];
  const seen = new Set();
  const clean = [];
  for (const raw of faces) {
    const f = String(raw || "").trim().toLowerCase();
    if (ALL_BOTTOM_FACES.includes(f) && !seen.has(f)) {
      seen.add(f);
      clean.push(f);
    }
  }
  return clean.length > 0 ? clean : [...fallback];
}

export function pickBottomLayerOrientation(trainingBottomFaces = ["white"], { randomY = true } = {}) {
  const pool = sanitizeTrainingBottomFaces(trainingBottomFaces, ["white"]);
  const face = pool[Math.floor(Math.random() * pool.length)];
  const baseRot = BOTTOM_LAYER_ROTATIONS[face] ?? "z2";
  const yRot = randomY ? Y_TURNS[Math.floor(Math.random() * Y_TURNS.length)] : "";
  return [baseRot, yRot].filter(Boolean).join(" ");
}

export function applyTrainingBottomOrientation(scrambleMoves, trainingBottomFaces = ["white"], { randomY = true } = {}) {
  const orient = pickBottomLayerOrientation(trainingBottomFaces, { randomY });
  return [orient, scrambleMoves].filter(Boolean).join(" ").trim();
}

export function buildCaseScramble({
  caseObj,
  alwaysWhiteBottom = true,
  trainingBottomFaces = null,
  allowAUF = true,
  isStudy = false
}) {
  let orientation = "";
  if (isStudy) {
    orientation = "z2";
  } else if (Array.isArray(trainingBottomFaces) && trainingBottomFaces.length > 0) {
    orientation = pickBottomLayerOrientation(trainingBottomFaces, { randomY: allowAUF });
  } else if (alwaysWhiteBottom) {
    orientation = "z2";
  } else {
    const rot = (axis, turns) => {
      if (turns === 1) return ` ${axis}`;
      if (turns === 2) return ` ${axis}2`;
      if (turns === 3) return ` ${axis}'`;
      return "";
    };
    orientation = `${rot("x", Math.floor(Math.random() * 4))}${rot("y", Math.floor(Math.random() * 4))}${rot("z", Math.floor(Math.random() * 4))}`.trim();
  }

  let moves = "";
  if (allowAUF && !isStudy) {
    moves += randomU();
  }

  let selectedScramble = null;
  if (caseObj) {
    const caseScrambles = caseObj.scrambles && caseObj.scrambles.length
      ? caseObj.scrambles
      : [caseObj.setup || caseObj.scramble];
    selectedScramble = caseScrambles[Math.floor(Math.random() * caseScrambles.length)] || "";
    moves += " " + selectedScramble;
  }

  if (allowAUF && !isStudy) {
    moves += randomU();
  }

  const scrambleMoves = cleanAlg(moves);
  const scramble = `${orientation.trim()} ${scrambleMoves}`.trim();
  return { scramble, scrambleMoves, selectedScramble };
}
