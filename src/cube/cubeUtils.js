// Shared 2x2 & 3x3 cube constants, kpuzzle loaders, and 24-orientation tables

import { puzzles } from 'cubing/puzzles';
import { Alg } from 'cubing/alg';

export const ORIENTATIONS_24 = [
  "", "y", "y2", "y'",
  "x", "x y", "x y2", "x y'",
  "x2", "x2 y", "x2 y2", "x2 y'",
  "x'", "x' y", "x' y2", "x' y'",
  "z", "z y", "z y2", "z y'",
  "z'", "z' y", "z' y2", "z' y'"
];

// Corner slot stickers in cubing.js order (0..3 U-layer, 4..7 D-layer)
export const CORNER_FACES_333 = [
  ["U", "R", "F"], ["U", "B", "R"], ["U", "L", "B"], ["U", "F", "L"],
  ["D", "F", "R"], ["D", "L", "F"], ["D", "B", "L"], ["D", "R", "B"]
];

// Edge slot stickers in cubing.js order (0..3 U, 4..7 D, 8..11 E-slice)
export const EDGE_FACES_333 = [
  ["U", "F"], ["U", "R"], ["U", "B"], ["U", "L"],
  ["D", "F"], ["D", "R"], ["D", "B"], ["D", "L"],
  ["F", "R"], ["F", "L"], ["B", "R"], ["B", "L"]
];

export const F2L_SLOTS = [
  { name: "FR", c: 4, e: 8 },
  { name: "FL", c: 5, e: 9 },
  { name: "BL", c: 6, e: 11 },
  { name: "BR", c: 7, e: 10 }
];

export const CENTER_COLOR_NAMES = {
  0: "White",
  1: "Orange",
  2: "Green",
  3: "Red",
  4: "Blue",
  5: "Yellow"
};

export const CENTER_FACE_LETTERS = ["U", "L", "F", "R", "B", "D"];

export const OPPOSITE_COLOR = {
  white: "yellow",
  yellow: "white",
  green: "blue",
  blue: "green",
  red: "orange",
  orange: "red"
};

const kpuzzleCache = new Map();
const solvedOrientationsCache = new Map();

export function normalizeKpuzzleName(puzzleId = "3x3x3") {
  if (puzzleId === "222" || puzzleId === "2x2x2") return "2x2x2";
  return "3x3x3";
}

export async function getKpuzzle(puzzleId = "3x3x3") {
  const normId = normalizeKpuzzleName(puzzleId);
  if (!kpuzzleCache.has(normId)) {
    const loader = puzzles[normId];
    if (!loader) return null;
    kpuzzleCache.set(normId, loader.kpuzzle());
  }
  return kpuzzleCache.get(normId);
}

export async function getSolvedOrientations(puzzleId = "3x3x3") {
  const normId = normalizeKpuzzleName(puzzleId);
  if (solvedOrientationsCache.has(normId)) {
    return solvedOrientationsCache.get(normId);
  }
  const promise = (async () => {
    const kpuzzle = await getKpuzzle(normId);
    if (!kpuzzle) return null;
    const defaultPat = kpuzzle.defaultPattern();
    const patterns = [];
    const byCenterKey = normId === "3x3x3" ? new Map() : null;
    const seen = new Set();

    for (const rot of ORIENTATIONS_24) {
      const pat = rot ? defaultPat.applyAlg(new Alg(rot)) : defaultPat;
      const key = JSON.stringify(pat.patternData);
      if (!seen.has(key)) {
        seen.add(key);
        patterns.push(pat);
        if (byCenterKey) {
          byCenterKey.set(pat.patternData.CENTERS.pieces.join(","), pat);
        }
      }
    }

    return { kpuzzle, defaultPat, patterns, byCenterKey };
  })();
  solvedOrientationsCache.set(normId, promise);
  return promise;
}
