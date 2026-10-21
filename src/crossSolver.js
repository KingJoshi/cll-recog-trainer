// 3x3x3 White Cross & Cross+1 & Edge Orientation (EO) Solver
// Uses precomputed IDA* pruning table for 100% optimal move count solutions.

import { Alg } from 'cubing/alg';
import { puzzles } from 'cubing/puzzles';

let kp333 = null;
let distTable = null;
let moveList = null;

const faces = ['U', 'D', 'R', 'L', 'F', 'B'];

async function initSolver() {
  if (distTable) return;
  kp333 = await puzzles['3x3x3'].kpuzzle();

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
  distTable = new Uint8Array(N).fill(255);
  const queue = new Int32Array(N);
  let qHead = 0, qTail = 0;

  // Solved target: pieces 4, 5, 6, 7 in slots 4, 5, 6, 7 (including 4 D AUF rotations)
  for (let d = 0; d < 4; d++) {
    const s0 = 4 + d;
    const s1 = 4 + ((1 + d) % 4);
    const s2 = 4 + ((2 + d) % 4);
    const s3 = 4 + ((3 + d) % 4);
    const idx = getIndex(s0, s1, s2, s3, 0, 0, 0, 0);
    if (distTable[idx] === 255) {
      distTable[idx] = 0;
      queue[qTail++] = idx;
    }
  }

  while (qHead < qTail) {
    const curr = queue[qHead++];
    const d = distTable[curr];
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
      if (distTable[nIdx] === 255) {
        distTable[nIdx] = d + 1;
        queue[qTail++] = nIdx;
      }
    }
  }
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

// 4 F2L pairs: [cornerPiece, edgePiece, cornerSlot, edgeSlot, slotName]
const F2L_PAIRS = [
  { name: "FR", corner: 4, edge: 8 },
  { name: "FL", corner: 5, edge: 9 },
  { name: "BL", corner: 6, edge: 11 },
  { name: "BR", corner: 7, edge: 10 }
];

export async function findCrossSolutions(scrambleStr, maxSolutions = 6) {
  if (!scrambleStr || !scrambleStr.trim()) return [];
  await initSolver();

  let scrambleAlg;
  try {
    scrambleAlg = new Alg(scrambleStr);
  } catch (e) {
    return [];
  }

  const rawSolutions = [];
  const inspectionRotations = [
    { name: "none", alg: "" },
    { name: "y", alg: "y" },
    { name: "y'", alg: "y'" },
    { name: "y2", alg: "y2" }
  ];

  for (const insp of inspectionRotations) {
    let combinedAlgStr = scrambleStr;
    if (insp.alg) {
      combinedAlgStr += ' ' + insp.alg;
    }

    let pat;
    try {
      pat = kp333.defaultPattern().applyAlg(new Alg(combinedAlgStr));
    } catch (e) {
      continue;
    }

    const pieces = pat.patternData.EDGES.pieces;
    const ori = pat.patternData.EDGES.orientation;

    // Edge orientation stats:
    const goodEdges = ori.filter(o => o === 0).length;
    const badEdges = ori.filter(o => o === 1).length;

    // Cross pieces: 4 (DF), 5 (DR), 6 (DB), 7 (DL)
    const s0 = pieces.indexOf(4);
    const s1 = pieces.indexOf(5);
    const s2 = pieces.indexOf(6);
    const s3 = pieces.indexOf(7);

    const o0 = ori[s0];
    const o1 = ori[s1];
    const o2 = ori[s2];
    const o3 = ori[s3];

    const crossOriented = (o0 === 0 ? 1 : 0) + (o1 === 0 ? 1 : 0) + (o2 === 0 ? 1 : 0) + (o3 === 0 ? 1 : 0);

    const startIdx = getIndex(s0, s1, s2, s3, o0, o1, o2, o3);
    const optimalMoves = distTable[startIdx];

    const rawPaths = [];
    searchPaths(s0, s1, s2, s3, o0, o1, o2, o3, 0, optimalMoves, -1, [], rawPaths);

    for (const p of rawPaths) {
      let solStr = p.join(' ');
      let fullPat = pat.applyAlg(new Alg(solStr));

      // Check D alignment AUF:
      const curP = fullPat.patternData.EDGES.pieces.slice(4, 8);
      if (curP[0] !== 4 || curP[1] !== 5 || curP[2] !== 6 || curP[3] !== 7) {
        for (const dMove of ["D", "D2", "D'"]) {
          const testPat = fullPat.applyAlg(new Alg(dMove));
          const testP = testPat.patternData.EDGES.pieces.slice(4, 8);
          if (testP[0] === 4 && testP[1] === 5 && testP[2] === 6 && testP[3] === 7) {
            solStr = solStr + ' ' + dMove;
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

      for (const pair of F2L_PAIRS) {
        // Solved in slot:
        const cSlot = cornerPiecesAfter.indexOf(pair.corner);
        const eSlot = edgePiecesAfter.indexOf(pair.edge);
        const cOri = cornerOriAfter[cSlot];
        const eOri = edgeOriAfter[eSlot];

        if (cSlot === pair.corner && eSlot === pair.edge && cOri === 0 && eOri === 0) {
          crossPlus1 = {
            hasPair: true,
            score: 3,
            type: "solved",
            slot: pair.name,
            description: `Free Pair Solved in ${pair.name} slot!`
          };
          break;
        }

        // Pair in U layer (slots 0..3)
        if (cSlot < 4 && eSlot < 4) {
          // If corner and edge are adjacent in U layer
          crossPlus1 = {
            hasPair: true,
            score: 2,
            type: "connected",
            slot: pair.name,
            description: `Pair in U layer for ${pair.name}`
          };
        }
      }

      rawSolutions.push({
        moves: solStr,
        moveCount: solStr.split(' ').length,
        insp: insp.name,
        eoSummary: {
          goodEdges,
          badEdges,
          crossOriented,
          note: `${crossOriented}/4 cross edges oriented, ${goodEdges}/12 overall good EO`
        },
        crossPlus1
      });
    }
  }

  // Deduplicate and rank solutions:
  const unique = [];
  const seenMoves = new Set();

  rawSolutions.sort((a, b) => {
    // 1. Cross+1 score
    if (b.crossPlus1.score !== a.crossPlus1.score) {
      return b.crossPlus1.score - a.crossPlus1.score;
    }
    // 2. Move count
    if (a.moveCount !== b.moveCount) {
      return a.moveCount - b.moveCount;
    }
    // 3. Inspection complexity (none preferred over y/y2)
    const inspScore = (i) => i === 'none' ? 0 : i === 'y' ? 1 : i === "y'" ? 2 : 3;
    return inspScore(a.insp) - inspScore(b.insp);
  });

  for (const sol of rawSolutions) {
    const key = `${sol.insp}|${sol.moves}`;
    if (!seenMoves.has(key)) {
      seenMoves.add(key);
      unique.push(sol);
      if (unique.length >= maxSolutions) break;
    }
  }

  return unique;
}
