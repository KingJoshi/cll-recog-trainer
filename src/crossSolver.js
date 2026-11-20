// 3x3x3 White Cross & Cross+1 & Edge Orientation (EO) Solver
// Uses precomputed IDA* pruning table for 100% optimal move count solutions.

import { Alg } from 'cubing/alg';
import {
  ORIENTATIONS_24,
  CORNER_FACES_333,
  EDGE_FACES_333,
  F2L_SLOTS,
  getKpuzzle,
  getSolvedOrientations
} from './cube/cubeUtils.js';

let kp333 = null;
let solvedOrientationsData = null;
let distTable = null;
let moveList = null;
let initPromise = null;

const faces = ['U', 'D', 'R', 'L', 'F', 'B'];

// Map side center piece index to corresponding White edge piece index:
// Center 2 (Green) -> Edge 0 (White-Green)
// Center 3 (Red)   -> Edge 1 (White-Red)
// Center 4 (Blue)  -> Edge 2 (White-Blue)
// Center 1 (Orange)-> Edge 3 (White-Orange)
export const centerToWhiteEdge = { 2: 0, 3: 1, 4: 2, 1: 3 };

// Center piece IDs in cubing.js 3x3x3 default pattern (White U, Green F):
export const CROSS_FACE_CENTER_IDS = {
  white: 0,
  orange: 1,
  green: 2,
  red: 3,
  blue: 4,
  yellow: 5
};

export const ALL_CROSS_FACES = ["white", "yellow", "green", "blue", "red", "orange"];

async function initSolver() {
  if (distTable && solvedOrientationsData) return;
  if (!initPromise) {
    initPromise = (async () => {
      kp333 = await getKpuzzle('3x3x3');
      solvedOrientationsData = await getSolvedOrientations('3x3x3');

      moveList = [];
      for (let fIdx = 0; fIdx < faces.length; fIdx++) {
        const f = faces[fIdx];
        for (const suffix of ['', '2', "'"]) {
          const name = f + suffix;
          const alg = new Alg(name);
          const pat = kp333.defaultPattern().applyAlg(alg);
          const perm = new Array(12);
          const oriDelta = new Array(12);
          for (let s = 0; s < 12; s++) {
            const targetSlot = pat.patternData.EDGES.pieces.indexOf(s);
            perm[s] = targetSlot;
            oriDelta[s] = pat.patternData.EDGES.orientation[targetSlot];
          }
          moveList.push({ name, face: fIdx, perm, oriDelta });
        }
      }

      const N = 12 * 11 * 10 * 9 * 16;
      const table = new Uint8Array(N).fill(255);
      const queue = new Int32Array(N);
      let qHead = 0, qTail = 0;

      // Solved target: pieces p0, p1, p2, p3 in slots 4, 5, 6, 7 (including 4 D AUF rotations)
      for (let d = 0; d < 4; d++) {
        const s0 = 4 + d;
        const s1 = 4 + ((1 + d) % 4);
        const s2 = 4 + ((2 + d) % 4);
        const s3 = 4 + ((3 + d) % 4);
        const idx = getIndex(s0, s1, s2, s3, 0, 0, 0, 0);
        if (table[idx] === 255) {
          table[idx] = 0;
          queue[qTail++] = idx;
        }
      }

      while (qHead < qTail) {
        const curr = queue[qHead++];
        const d = table[curr];
        const [s0, s1, s2, s3, o0, o1, o2, o3] = decodeIndex(curr);

        for (let i = 0; i < moveList.length; i++) {
          const mv = moveList[i];
          const ns0 = mv.perm[s0];
          const ns1 = mv.perm[s1];
          const ns2 = mv.perm[s2];
          const ns3 = mv.perm[s3];
          const no0 = (o0 + mv.oriDelta[s0]) & 1;
          const no1 = (o1 + mv.oriDelta[s1]) & 1;
          const no2 = (o2 + mv.oriDelta[s2]) & 1;
          const no3 = (o3 + mv.oriDelta[s3]) & 1;

          const nIdx = getIndex(ns0, ns1, ns2, ns3, no0, no1, no2, no3);
          if (table[nIdx] === 255) {
            table[nIdx] = d + 1;
            queue[qTail++] = nIdx;
          }
        }
      }
      distTable = table;
    })().catch(err => {
      initPromise = null;
      throw err;
    });
  }
  return initPromise;
}

function getIndex(s0, s1, s2, s3, o0, o1, o2, o3) {
  let p1 = s1 > s0 ? s1 - 1 : s1;
  let p2 = s2;
  if (s2 > s0) p2--;
  if (s2 > s1) p2--;
  let p3 = s3;
  if (s3 > s0) p3--;
  if (s3 > s1) p3--;
  if (s3 > s2) p3--;
  return (s0 * 990 + p1 * 90 + p2 * 9 + p3) * 16 + ((o0 << 3) | (o1 << 2) | (o2 << 1) | o3);
}

function decodeIndex(idx) {
  const ori = idx & 15;
  let perm = idx >> 4;
  const p3 = perm % 9;
  perm = Math.floor(perm / 9);
  const p2 = perm % 10;
  perm = Math.floor(perm / 10);
  const p1 = perm % 11;
  const s0 = Math.floor(perm / 11);

  const s1 = p1 >= s0 ? p1 + 1 : p1;
  let s2 = p2;
  const u0 = Math.min(s0, s1);
  const u1 = Math.max(s0, s1);
  if (s2 >= u0) s2++;
  if (s2 >= u1) s2++;

  let s3 = p3;
  const v = [s0, s1, s2].sort((a,b)=>a-b);
  if (s3 >= v[0]) s3++;
  if (s3 >= v[1]) s3++;
  if (s3 >= v[2]) s3++;

  return [s0, s1, s2, s3, (ori >> 3) & 1, (ori >> 2) & 1, (ori >> 1) & 1, ori & 1];
}

// Search optimal paths in IDA*
function searchPaths(s0, s1, s2, s3, o0, o1, o2, o3, depth, maxDepth, lastFace, path, out) {
  const idx = getIndex(s0, s1, s2, s3, o0, o1, o2, o3);
  if (depth + distTable[idx] > maxDepth) return;
  if (distTable[idx] === 0) {
    out.push(path.slice());
    return;
  }

  for (let i = 0; i < moveList.length; i++) {
    const mv = moveList[i];
    if (mv.face === lastFace) continue;
    if (lastFace !== -1) {
      if (lastFace === 0 && mv.face === 1) {}
      else if (lastFace === 1 && mv.face === 0) continue;
      else if (lastFace === 3 && mv.face === 2) continue;
      else if (lastFace === 5 && mv.face === 4) continue;
    }

    const ns0 = mv.perm[s0];
    const ns1 = mv.perm[s1];
    const ns2 = mv.perm[s2];
    const ns3 = mv.perm[s3];
    const no0 = (o0 + mv.oriDelta[s0]) & 1;
    const no1 = (o1 + mv.oriDelta[s1]) & 1;
    const no2 = (o2 + mv.oriDelta[s2]) & 1;
    const no3 = (o3 + mv.oriDelta[s3]) & 1;

    path.push(mv.name);
    searchPaths(ns0, ns1, ns2, ns3, no0, no1, no2, no3, depth + 1, maxDepth, mv.face, path, out);
    path.pop();
    if (out.length >= 10) return;
  }
}

function getInspectionRotationsForCenterOnBottom(initialPat, targetCenterId = 0) {
  const centerSlot = initialPat.patternData.CENTERS.pieces.indexOf(targetCenterId);
  // If target center is already on D (slot 5):
  if (centerSlot === 5) {
    return [
      { name: "none", alg: "" },
      { name: "y", alg: "y" },
      { name: "y2", alg: "y2" },
      { name: "y'", alg: "y'" }
    ];
  }
  // If target center is on U (slot 0, standard WCA orientation for White):
  if (centerSlot === 0) {
    return [
      { name: "z2", alg: "z2" },       // Green front
      { name: "z2 y", alg: "z2 y" },   // Orange front
      { name: "x2", alg: "x2" },       // Blue front
      { name: "x2 y", alg: "x2 y" }    // Red front
    ];
  }
  // Generic search across all 24 cube orientations putting targetCenterId on D (slot 5):
  const res = [];
  const seen = new Set();
  for (const alg of ORIENTATIONS_24) {
    const p = alg ? initialPat.applyAlg(new Alg(alg)) : initialPat;
    if (p.patternData.CENTERS.pieces[5] === targetCenterId) {
      const key = p.patternData.CENTERS.pieces.join(',');
      if (!seen.has(key)) {
        seen.add(key);
        res.push({ name: alg || "none", alg });
      }
    }
  }
  return res.length ? res : [{ name: "z2", alg: "z2" }];
}

/**
 * Find optimal 3x3 Cross + Cross+1 + EO solutions for one or more target cross colors.
 * Supports:
 *   findCrossSolutions(scrambleStr, maxSolutions)
 *   findCrossSolutions(scrambleStr, targetFaces, maxSolutions)
 */
export async function findCrossSolutions(scrambleStr, facesOrMax = 8, maybeMaxSolutions = 8) {
  if (!scrambleStr || !scrambleStr.trim()) return [];
  await initSolver();

  let targetFaces = ["white"];
  let maxSolutions = 8;
  if (typeof facesOrMax === "number") {
    maxSolutions = facesOrMax;
  } else if (typeof facesOrMax === "string") {
    targetFaces = [facesOrMax.toLowerCase()];
    if (typeof maybeMaxSolutions === "number") maxSolutions = maybeMaxSolutions;
  } else if (Array.isArray(facesOrMax) && facesOrMax.length > 0) {
    targetFaces = facesOrMax.map(f => String(f).toLowerCase()).filter(f => f in CROSS_FACE_CENTER_IDS);
    if (!targetFaces.length) targetFaces = ["white"];
    if (typeof maybeMaxSolutions === "number") maxSolutions = maybeMaxSolutions;
  }

  let scrambleAlg;
  try {
    scrambleAlg = new Alg(scrambleStr);
  } catch (e) {
    return [];
  }

  let initialPat;
  try {
    initialPat = kp333.defaultPattern().applyAlg(scrambleAlg);
  } catch (e) {
    return [];
  }

  const rawSolutions = [];

  for (const faceName of targetFaces) {
    const targetCenterId = CROSS_FACE_CENTER_IDS[faceName] ?? 0;
    const inspectionRotations = getInspectionRotationsForCenterOnBottom(initialPat, targetCenterId);

    for (const insp of inspectionRotations) {
      let pat;
      try {
        pat = insp.alg ? initialPat.applyAlg(new Alg(insp.alg)) : initialPat;
      } catch (e) {
        continue;
      }

      // Reference solved pattern for this inspection orientation:
      const patCentersKey = pat.patternData.CENTERS.pieces.join(',');
      const solvedPat = solvedOrientationsData?.byCenterKey?.get(patCentersKey) || null;
      if (!solvedPat) continue;

      const pieces = pat.patternData.EDGES.pieces;
      const ori = pat.patternData.EDGES.orientation;

      // Edge orientation stats relative to this grip's solved orientation:
      const solvedEdgeOri = solvedPat.patternData.EDGES.orientation;
      const solvedEdgePieces = solvedPat.patternData.EDGES.pieces;
      // For each piece in its current slot, check if its orientation matches its home orientation:
      let goodEdges = 0;
      for (let slot = 0; slot < 12; slot++) {
        const pieceId = pieces[slot];
        const homeSlot = solvedEdgePieces.indexOf(pieceId);
        const relOri = ori[slot] ^ solvedEdgeOri[homeSlot];
        if (relOri === 0) goodEdges++;
      }
      const badEdges = 12 - goodEdges;

      // The 4 cross pieces corresponding to slots DF(4), DR(5), DB(6), DL(7) in solvedPat:
      const pA = solvedEdgePieces[4];
      const pB = solvedEdgePieces[5];
      const pC = solvedEdgePieces[6];
      const pD = solvedEdgePieces[7];

      const tO0 = solvedEdgeOri[4];
      const tO1 = solvedEdgeOri[5];
      const tO2 = solvedEdgeOri[6];
      const tO3 = solvedEdgeOri[7];

      const s0 = pieces.indexOf(pA);
      const s1 = pieces.indexOf(pB);
      const s2 = pieces.indexOf(pC);
      const s3 = pieces.indexOf(pD);

      const o0 = ori[s0] ^ tO0;
      const o1 = ori[s1] ^ tO1;
      const o2 = ori[s2] ^ tO2;
      const o3 = ori[s3] ^ tO3;

      const crossOriented = (o0 === 0 ? 1 : 0) + (o1 === 0 ? 1 : 0) + (o2 === 0 ? 1 : 0) + (o3 === 0 ? 1 : 0);

      const startIdx = getIndex(s0, s1, s2, s3, o0, o1, o2, o3);
      const optimalMoves = distTable[startIdx];

      const rawPaths = [];
      searchPaths(s0, s1, s2, s3, o0, o1, o2, o3, 0, optimalMoves, -1, [], rawPaths);

      const ADJ_U_SHARED_CORNER_FACE = {
        '0-0': 2, '0-1': 1,
        '1-1': 2, '1-2': 1,
        '2-2': 2, '2-3': 1,
        '3-3': 2, '3-0': 1
      };

      for (const p of rawPaths) {
        let solStr = p.join(' ');
        let fullPat = solStr ? pat.applyAlg(new Alg(solStr)) : pat;

        // Check D alignment AUF:
        const curP = fullPat.patternData.EDGES.pieces.slice(4, 8);
        if (curP[0] !== pA || curP[1] !== pB || curP[2] !== pC || curP[3] !== pD) {
          for (const dMove of ["D", "D2", "D'"]) {
            const testPat = fullPat.applyAlg(new Alg(dMove));
            const testP = testPat.patternData.EDGES.pieces.slice(4, 8);
            if (testP[0] === pA && testP[1] === pB && testP[2] === pC && testP[3] === pD) {
              solStr = (solStr ? solStr + ' ' : '') + dMove;
              fullPat = testPat;
              break;
            }
          }
        }

        // Evaluate Cross+1 (F2L pairs)
        const edgePiecesAfter = fullPat.patternData.EDGES.pieces;
        const edgeOriAfter = fullPat.patternData.EDGES.orientation;
        const cornerPiecesAfter = fullPat.patternData.CORNERS.pieces;
        const cornerOriAfter = fullPat.patternData.CORNERS.orientation;

        let crossPlus1 = {
          hasPair: false,
          score: 0,
          type: "none",
          slot: null,
          description: ""
        };

        for (const slot of F2L_SLOTS) {
          const targetCorner = solvedPat.patternData.CORNERS.pieces[slot.c];
          const targetCornerOri = solvedPat.patternData.CORNERS.orientation[slot.c];
          const targetEdge = solvedPat.patternData.EDGES.pieces[slot.e];
          const targetEdgeOri = solvedPat.patternData.EDGES.orientation[slot.e];

          const actualCornerSlot = cornerPiecesAfter.indexOf(targetCorner);
          const actualEdgeSlot = edgePiecesAfter.indexOf(targetEdge);
          const cOri = cornerOriAfter[actualCornerSlot];
          const eOri = edgeOriAfter[actualEdgeSlot];

          if (actualCornerSlot === slot.c && actualEdgeSlot === slot.e && cOri === targetCornerOri && eOri === targetEdgeOri) {
            crossPlus1 = {
              hasPair: true,
              score: 3,
              type: "solved",
              slot: slot.name,
              description: `Free Pair Solved in ${slot.name} slot!`
            };
            break;
          }

          // Connected (joined) pair in U layer (slots 0..3)
          if (crossPlus1.score < 2 && actualCornerSlot < 4 && actualEdgeSlot < 4) {
            const cSharedIdx = ADJ_U_SHARED_CORNER_FACE[`${actualCornerSlot}-${actualEdgeSlot}`];
            if (cSharedIdx !== undefined) {
              const cFace = (fIdx) => CORNER_FACES_333[slot.c][((fIdx - cOri + 3) % 3 + targetCornerOri) % 3];
              const eFace = (fIdx) => EDGE_FACES_333[slot.e][((fIdx - eOri + 2) % 2 + targetEdgeOri) % 2];
              if (cFace(0) === eFace(0) && cFace(cSharedIdx) === eFace(1)) {
                crossPlus1 = {
                  hasPair: true,
                  score: 2,
                  type: "connected",
                  slot: slot.name,
                  description: `Connected Pair in U layer for ${slot.name}`
                };
              }
            }
          }
        }

        const moveTokens = solStr.trim().split(/\s+/).filter(Boolean);

        rawSolutions.push({
          face: faceName,
          moves: solStr.trim(),
          moveCount: moveTokens.length,
          length: moveTokens.length,
          insp: insp.name,
          inspectionRot: insp.name,
          eoSummary: {
            goodEdges,
            badEdges,
            crossOriented,
            note: `${crossOriented}/4 cross edges oriented, ${goodEdges}/12 overall good EO`
          },
          crossPlus1,
          crossPlusOne: crossPlus1.hasPair ? [crossPlus1] : []
        });
      }
    }
  }

  // Deduplicate and rank solutions:
  // When multiple colors are requested, sort primarily by shortest moveCount so the easiest cross color floats to the top,
  // breaking ties by Cross+1 score! When a single color is requested, keep Cross+1 score first then moveCount.
  const multiColor = targetFaces.length > 1;
  rawSolutions.sort((a, b) => {
    if (multiColor) {
      if (a.moveCount !== b.moveCount) return a.moveCount - b.moveCount;
      if ((b.crossPlus1?.score || 0) !== (a.crossPlus1?.score || 0)) {
        return (b.crossPlus1?.score || 0) - (a.crossPlus1?.score || 0);
      }
      return 0;
    }
    // 1. Cross+1 score (higher is better)
    if ((b.crossPlus1?.score || 0) !== (a.crossPlus1?.score || 0)) {
      return (b.crossPlus1?.score || 0) - (a.crossPlus1?.score || 0);
    }
    // 2. Move count (shorter is better)
    if (a.moveCount !== b.moveCount) {
      return a.moveCount - b.moveCount;
    }
    return 0;
  });

  const unique = [];
  const seenMoves = new Set();

  for (const sol of rawSolutions) {
    const key = `${sol.face}:${sol.insp}:${sol.moves}`;
    if (!seenMoves.has(key)) {
      seenMoves.add(key);
      unique.push(sol);
      if (unique.length >= maxSolutions) break;
    }
  }

  return unique;
}
