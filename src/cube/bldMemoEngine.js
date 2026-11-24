// Pure 3BLD (Speffz & Old Pochmann) Scramble Generator, Cycle Tracer, and Answer Verifier

import { Alg } from 'cubing/alg';
import { getKpuzzle } from './cubeUtils.js';
import { SPEFFZ_CORNERS, SPEFFZ_EDGES } from '../features/study/bldGuideRenderer.js';
import { generateWca3x3Scramble } from '../services/scrambleService.js';

export const OP_T_PERM = "R U R' U' R' F R2 U' R' U' R U R' F'";
export const OP_JA_PERM = "x R2 F R F' R U2 r' U r U2 x'";
export const OP_JB_PERM = "R U R' F' R U R' U' R' F R2 U' R' U'";
export const OP_MOD_Y_PERM = "R U' R' U' R U R' F' R U R' U' R' F R";
export const OP_PARITY_RA_PERM = "R U' R' U' R U R D R' U' R D' R' U2 R' U'";

export const EDGE_BUFFER_PIECE_NAME = "UR";
export const CORNER_BUFFER_PIECE_NAME = "UBL";
export const EDGE_BUFFER_STICKER = "B";
export const CORNER_BUFFER_STICKER = "E";
export const EDGE_BUFFER_LETTERS = new Set(["B", "M"]);
export const CORNER_BUFFER_LETTERS = new Set(["A", "E", "R"]);

const VALID_SPEFFZ_REGEX = /^[A-X]$/;

function conjugateSetup(setup, coreAlg) {
  const cleanSetup = String(setup || "").trim();
  if (!cleanSetup) return coreAlg;
  const inv = Alg.fromString(cleanSetup).invert().toString();
  return `${cleanSetup} ${coreAlg} ${inv}`;
}

function buildEdgeAlgTable() {
  const map = new Map();
  for (const item of SPEFFZ_EDGES) {
    for (const f of item.faces) {
      if (f.role === "buffer") continue;
      if (f.letter === "A") {
        map.set("A", { letter: "A", piece: item.piece, face: f.face, alg: OP_JA_PERM });
      } else if (f.letter === "C") {
        map.set("C", { letter: "C", piece: item.piece, face: f.face, alg: OP_JB_PERM });
      } else if (f.letter === "D") {
        map.set("D", { letter: "D", piece: item.piece, face: f.face, alg: OP_T_PERM });
      } else {
        map.set(f.letter, {
          letter: f.letter,
          piece: item.piece,
          face: f.face,
          alg: conjugateSetup(f.setup, OP_T_PERM)
        });
      }
    }
  }
  return map;
}

function buildCornerAlgTable() {
  const map = new Map();
  for (const item of SPEFFZ_CORNERS) {
    for (const f of item.faces) {
      if (f.role === "buffer") continue;
      const alg = f.letter === "V" ? OP_MOD_Y_PERM : conjugateSetup(f.setup, OP_MOD_Y_PERM);
      map.set(f.letter, { letter: f.letter, piece: item.piece, face: f.face, alg });
    }
  }
  return map;
}

const OP_EDGE_MAP = buildEdgeAlgTable();
const OP_CORNER_MAP = buildCornerAlgTable();

export function getOpEdgeAlg(letter) {
  const ch = String(letter || "").toUpperCase();
  return OP_EDGE_MAP.get(ch)?.alg || null;
}

export function getOpCornerAlg(letter) {
  const ch = String(letter || "").toUpperCase();
  return OP_CORNER_MAP.get(ch)?.alg || null;
}

let calibratedTablesPromise = null;

/**
 * Self-calibrate Speffz <-> cubing.js 3x3x3 KPuzzle piece/orientation mappings
 * directly from the verified Old Pochmann algorithms.
 */
async function getCalibratedBldTables() {
  if (calibratedTablesPromise) return calibratedTablesPromise;
  calibratedTablesPromise = (async () => {
    const kpuzzle = await getKpuzzle("3x3x3");
    const solved = kpuzzle.defaultPattern();

    // Identify buffer edge index via OP_T_PERM (swaps UR & UL) and OP_JB_PERM (swaps UF & UR)
    const tPat = solved.applyAlg(OP_T_PERM).patternData;
    const jbPat = solved.applyAlg(OP_JB_PERM).patternData;
    const tChangedEdges = [];
    for (let i = 0; i < 12; i++) {
      if (tPat.EDGES.pieces[i] !== i) tChangedEdges.push(i);
    }
    const edgeBufferIndex = tChangedEdges.find(i => jbPat.EDGES.pieces[i] !== i);

    // Identify buffer corner index via OP_MOD_Y_PERM (V: UBL <-> DFR) and B (UBL <-> UBR)
    const vPat = solved.applyAlg(OP_MOD_Y_PERM).patternData;
    const bPat = solved.applyAlg(getOpCornerAlg("B")).patternData;
    const vChangedCorners = [];
    for (let i = 0; i < 8; i++) {
      if (vPat.CORNERS.pieces[i] !== i) vChangedCorners.push(i);
    }
    const cornerBufferIndex = vChangedCorners.find(i => bPat.CORNERS.pieces[i] !== i);

    const edgeKeyToLetter = new Map();
    const edgePieceNameByIndex = new Map();
    const edgeLettersByIndex = new Map();
    edgePieceNameByIndex.set(edgeBufferIndex, EDGE_BUFFER_PIECE_NAME);
    edgeLettersByIndex.set(edgeBufferIndex, ["B", "M"]);

    for (const [letter, entry] of OP_EDGE_MAP.entries()) {
      const pData = solved.applyAlg(entry.alg).patternData;
      const pieceIdx = pData.EDGES.pieces[edgeBufferIndex];
      const ori = pData.EDGES.orientation[edgeBufferIndex];
      edgeKeyToLetter.set(`${pieceIdx}:${ori}`, letter);
      edgePieceNameByIndex.set(pieceIdx, entry.piece);
      if (!edgeLettersByIndex.has(pieceIdx)) edgeLettersByIndex.set(pieceIdx, []);
      edgeLettersByIndex.get(pieceIdx).push(letter);
    }

    const cornerKeyToLetter = new Map();
    const cornerPieceNameByIndex = new Map();
    const cornerLettersByIndex = new Map();
    cornerPieceNameByIndex.set(cornerBufferIndex, CORNER_BUFFER_PIECE_NAME);
    cornerLettersByIndex.set(cornerBufferIndex, ["E", "A", "R"]);

    for (const [letter, entry] of OP_CORNER_MAP.entries()) {
      const pData = solved.applyAlg(entry.alg).patternData;
      const pieceIdx = pData.CORNERS.pieces[cornerBufferIndex];
      const ori = pData.CORNERS.orientation[cornerBufferIndex];
      cornerKeyToLetter.set(`${pieceIdx}:${ori}`, letter);
      cornerPieceNameByIndex.set(pieceIdx, entry.piece);
      if (!cornerLettersByIndex.has(pieceIdx)) cornerLettersByIndex.set(pieceIdx, []);
      cornerLettersByIndex.get(pieceIdx).push(letter);
    }

    for (const arr of edgeLettersByIndex.values()) arr.sort();
    for (const arr of cornerLettersByIndex.values()) arr.sort();

    return {
      kpuzzle,
      solved,
      edgeBufferIndex,
      cornerBufferIndex,
      edgeKeyToLetter,
      cornerKeyToLetter,
      edgePieceNameByIndex,
      cornerPieceNameByIndex,
      edgeLettersByIndex,
      cornerLettersByIndex
    };
  })();
  return calibratedTablesPromise;
}

/**
 * Parse user-typed letter pairs into uppercase A-X letters plus any invalid characters.
 * Separators (whitespace, commas, hyphens, bullets, slashes) are ignored.
 */
export function parseLetterPairsInput(raw = "") {
  const cleaned = String(raw || "")
    .toUpperCase()
    .replace(/[\s,\-./|•·_]+/g, "");
  const letters = [];
  const invalidChars = [];
  for (const ch of cleaned) {
    if (VALID_SPEFFZ_REGEX.test(ch)) {
      letters.push(ch);
    } else if (!invalidChars.includes(ch)) {
      invalidChars.push(ch);
    }
  }
  return { letters, invalidChars };
}

/**
 * Format an array of Speffz letters into spaced 2-letter pairs (e.g. "AQ FJ P").
 */
export function formatLetterPairs(letters = []) {
  const list = Array.isArray(letters) ? letters : parseLetterPairsInput(letters).letters;
  const pairs = [];
  for (let i = 0; i < list.length; i += 2) {
    pairs.push(list.slice(i, i + 2).join(""));
  }
  return pairs.join(" ");
}

/**
 * Generate a standard WCA 3x3 scramble (White U, Green F) for 3BLD training.
 */
export async function generateBldScramble(_mode = "both") {
  return generateWca3x3Scramble();
}

function traceCanonicalOrbit({
  startPattern,
  orbitName,
  bufferIndex,
  swapWithBuffer,
  keyToLetter,
  lettersByIndex,
  isParitySwappedInitial = false
}) {
  let pat = startPattern;
  const letters = [];
  const slotCount = pat.patternData[orbitName].pieces.length;

  function findFirstUnsolvedNonBufferLetter() {
    const candidates = [];
    const data = pat.patternData[orbitName];
    for (let idx = 0; idx < slotCount; idx++) {
      if (idx === bufferIndex) continue;
      if (data.pieces[idx] !== idx || data.orientation[idx] !== 0) {
        const slotLetters = lettersByIndex.get(idx) || [];
        if (slotLetters.length > 0) {
          candidates.push(slotLetters[0]);
        }
      }
    }
    candidates.sort();
    return candidates[0] || null;
  }

  // Track whether all non-buffer pieces are solved
  for (let guard = 0; guard < 32; guard++) {
    const data = pat.patternData[orbitName];
    const bufPiece = data.pieces[bufferIndex];
    const bufOri = data.orientation[bufferIndex];

    if (bufPiece !== bufferIndex) {
      const targetLetter = keyToLetter.get(`${bufPiece}:${bufOri}`);
      if (!targetLetter) break;
      letters.push(targetLetter);
      pat = swapWithBuffer(pat, targetLetter);
      continue;
    }

    const nextBreak = findFirstUnsolvedNonBufferLetter();
    if (!nextBreak) {
      break;
    }
    letters.push(nextBreak);
    pat = swapWithBuffer(pat, nextBreak);
  }

  return {
    letters,
    hasParityOffset: isParitySwappedInitial && letters.length % 2 === 1
  };
}

/**
 * Compute a valid canonical Old Pochmann letter sequence for edges and corners
 * from the given WCA-oriented scramble (White U, Green F).
 */
export async function computeCanonicalBldMemo(scramble) {
  const tables = await getCalibratedBldTables();
  const cleanScramble = String(scramble || "").trim();
  const scrambled = cleanScramble ? tables.solved.applyAlg(cleanScramble) : tables.solved;

  const edgeTrace = traceCanonicalOrbit({
    startPattern: scrambled,
    orbitName: "EDGES",
    bufferIndex: tables.edgeBufferIndex,
    swapWithBuffer: (pat, letter) => pat.applyAlg(getOpEdgeAlg(letter)),
    keyToLetter: tables.edgeKeyToLetter,
    lettersByIndex: tables.edgeLettersByIndex
  });

  // In full OP 3BLD, corners are traced after executing edges (and Ra-Perm if edge
  // count is odd, which fixes the UFR<->UBR corner swap left by odd T/Ja/Jb shots
  // and pre-swaps UB<->UL to be cancelled by the odd number of Mod-Y corner shots).
  let afterEdges = scrambled;
  for (const letter of edgeTrace.letters) {
    afterEdges = afterEdges.applyAlg(getOpEdgeAlg(letter));
  }
  const hasParity = edgeTrace.letters.length % 2 === 1;
  if (hasParity) {
    afterEdges = afterEdges.applyAlg(OP_PARITY_RA_PERM);
  }

  const cornerTrace = traceCanonicalOrbit({
    startPattern: afterEdges,
    orbitName: "CORNERS",
    bufferIndex: tables.cornerBufferIndex,
    swapWithBuffer: (pat, letter) => pat.applyAlg(getOpCornerAlg(letter)),
    keyToLetter: tables.cornerKeyToLetter,
    lettersByIndex: tables.cornerLettersByIndex
  });

  return {
    edgeLetters: edgeTrace.letters,
    cornerLetters: cornerTrace.letters,
    edgePairs: formatLetterPairs(edgeTrace.letters),
    cornerPairs: formatLetterPairs(cornerTrace.letters),
    hasParity
  };
}

function listRemainingUnsolved(orbitData, pieceNameByIndex, lettersByIndex) {
  const issues = [];
  for (let i = 0; i < orbitData.pieces.length; i++) {
    const piece = orbitData.pieces[i];
    const ori = orbitData.orientation[i];
    if (piece === i && ori === 0) continue;
    const slotName = pieceNameByIndex.get(i) || `#${i}`;
    const slotLetters = (lettersByIndex.get(i) || []).join("/");
    if (piece === i) {
      issues.push(`${slotName} (${slotLetters}) flipped/twisted in place`);
    } else {
      const actualName = pieceNameByIndex.get(piece) || `#${piece}`;
      issues.push(`${slotName} (${slotLetters}) has ${actualName}`);
    }
  }
  return issues;
}

function isOrbitSolved(orbitData) {
  for (let i = 0; i < orbitData.pieces.length; i++) {
    if (orbitData.pieces[i] !== i || orbitData.orientation[i] !== 0) {
      return false;
    }
  }
  return true;
}

function validateTrackLetters({ rawInput, kind, bufferSet }) {
  const { letters, invalidChars } = parseLetterPairsInput(rawInput);
  const errors = [];
  if (invalidChars.length > 0) {
    errors.push(`${kind}: invalid letter(s) "${invalidChars.join('", "')}" — only Speffz A–X are valid.`);
  }
  const usedBuffer = letters.filter(ch => bufferSet.has(ch));
  if (usedBuffer.length > 0) {
    const desc = kind === "Edges"
      ? "UR edge stickers B/M are the Edge Buffer and cannot be targeted"
      : "UBL corner stickers A/E/R are the Corner Buffer and cannot be targeted";
    errors.push(`${kind}: ${desc} (found ${[...new Set(usedBuffer)].join(", ")}).`);
  }
  return { letters, errors };
}

/**
 * Mathematically verify a user's 3BLD Speffz letter sequence(s) against the scramble
 * by executing the exact Old Pochmann swaps (+ automatic Ra-Perm parity when mode === "both"
 * and edge letter count is odd) on a 3x3x3 KPuzzle.
 */
export async function verifyBldMemoAnswer({
  scramble,
  mode = "both",
  edgeInput = "",
  cornerInput = ""
} = {}) {
  const tables = await getCalibratedBldTables();
  const checkEdges = mode === "edges" || mode === "both";
  const checkCorners = mode === "corners" || mode === "both";

  const parsedEdges = checkEdges
    ? validateTrackLetters({ rawInput: edgeInput, kind: "Edges", bufferSet: EDGE_BUFFER_LETTERS })
    : { letters: [], errors: [] };
  const parsedCorners = checkCorners
    ? validateTrackLetters({ rawInput: cornerInput, kind: "Corners", bufferSet: CORNER_BUFFER_LETTERS })
    : { letters: [], errors: [] };

  const errors = [...parsedEdges.errors, ...parsedCorners.errors];
  const canonical = await computeCanonicalBldMemo(scramble);

  const cleanScramble = String(scramble || "").trim();
  let pat = cleanScramble ? tables.solved.applyAlg(cleanScramble) : tables.solved;

  let appliedParity = false;
  if (errors.length === 0) {
    if (checkEdges) {
      for (const ch of parsedEdges.letters) {
        pat = pat.applyAlg(getOpEdgeAlg(ch));
      }
      if (mode === "both" && parsedEdges.letters.length % 2 === 1) {
        pat = pat.applyAlg(OP_PARITY_RA_PERM);
        appliedParity = true;
      }
    }
    if (checkCorners) {
      for (const ch of parsedCorners.letters) {
        pat = pat.applyAlg(getOpCornerAlg(ch));
      }
    }
  }

  const edgesSolved = isOrbitSolved(pat.patternData.EDGES);
  const cornersSolved = isOrbitSolved(pat.patternData.CORNERS);

  // In single-orbit mode on a full scramble, edges parity could differ from corners;
  // on pure edge/corner scrambles both end solved. Check the requested orbit(s).
  const edgesCorrect = checkEdges ? (errors.length === 0 && edgesSolved) : true;
  const cornersCorrect = checkCorners ? (errors.length === 0 && cornersSolved) : true;
  const isCorrect = errors.length === 0 && edgesCorrect && cornersCorrect;

  const remainingEdges = checkEdges && !edgesSolved
    ? listRemainingUnsolved(pat.patternData.EDGES, tables.edgePieceNameByIndex, tables.edgeLettersByIndex)
    : [];
  const remainingCorners = checkCorners && !cornersSolved
    ? listRemainingUnsolved(pat.patternData.CORNERS, tables.cornerPieceNameByIndex, tables.cornerLettersByIndex)
    : [];

  return {
    isCorrect,
    errors,
    edgesCorrect,
    cornersCorrect,
    edgesChecked: checkEdges,
    cornersChecked: checkCorners,
    remainingEdges,
    remainingCorners,
    edgeLetters: parsedEdges.letters,
    cornerLetters: parsedCorners.letters,
    hasParity: canonical.hasParity,
    appliedParity,
    canonical
  };
}
