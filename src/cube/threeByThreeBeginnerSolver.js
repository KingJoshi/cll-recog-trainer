// Dynamic Step-by-Step 3x3 Beginner Solver
// Solves any 3x3 scramble using minimal memorization:
//   1. Daisy (White edges around Yellow center)
//   2. White Cross (match centers & F2/R2/B2/L2 drop)
//   3. White Layer Corners (simple Righty / Inverse Righty)
//   4. Middle Layer Edges (one at a time with U + Righty + y + Lefty / mirror)
//   5. Yellow Cross using ONLY F (Righty) F'
//   6. Yellow Corners using ONLY Sune & Antisune (reverse of Sune)
//   7. Last-Layer Corners using ONLY T-Perm
//   8. Last-Layer Edges using ONLY M-move Ua & Ub

import { cube3x3x3 } from 'cubing/puzzles';
import { Alg } from 'cubing/alg';

const RIGHTY = "R U R' U'";
const INV_RIGHTY = "U R U' R'";
const EDGE_RIGHT = "U R U R' U' y L' U' L U";
const EDGE_LEFT = "U' L' U' L U y' R U R' U'";
const YELLOW_CROSS_ALG = "F R U R' U' F'";
const SUNE = "R U R' U R U2 R'";
const ANTISUNE = "R U2 R' U' R U' R'";
const T_PERM = "R U R' U' R' F R2 U' R' U' R U R' F'";
const UA_PERM = "M2 U M U2 M' U M2";
const UB_PERM = "M2 U' M U2 M' U' M2";

const AUF_LIST = ["", "U", "U'", "U2"];
const INV_AUF = { "": "", "U": "U'", "U'": "U", "U2": "U2" };

let tablesPromise = null;

async function getSolverTables333() {
  if (tablesPromise) return tablesPromise;
  tablesPromise = (async () => {
    const kp = await cube3x3x3.kpuzzle();
    const solved = kp.defaultPattern();
    const pZ2 = solved.applyAlg(new Alg("z2"));

    // 4 whole-cube y-rotated goals keeping White on D and Yellow on U
    const yGoalPats = [
      pZ2,
      pZ2.applyAlg(new Alg("y")),
      pZ2.applyAlg(new Alg("y2")),
      pZ2.applyAlg(new Alg("y'"))
    ];

    // All 24 whole-cube orientations for final solved verification
    const rot24Pats = [];
    for (const r of [
      "", "y", "y'", "y2", "x", "x'", "x2", "z", "z'", "z2",
      "x y", "x y'", "x y2", "x' y", "x' y'", "x' y2", "x2 y", "x2 y'", "x2 y2",
      "z y", "z y'", "z y2", "z' y", "z' y'", "z' y2", "z2 y", "z2 y'", "z2 y2",
      "y z", "y z'", "y' z", "y' z'"
    ]) {
      const p = r ? solved.applyAlg(new Alg(r)) : solved;
      if (!rot24Pats.some(s => s.isIdentical(p))) rot24Pats.push(p);
      if (rot24Pats.length >= 24) break;
    }

    // Precompute single-petal Daisy moves: U/F/R/B/L quarter/double turns
    const DAISY_MOVES = ["U", "U'", "U2", "R", "R'", "R2", "L", "L'", "L2", "F", "F'", "F2", "B", "B'", "B2"];
    const daisyMoveMap = new Map(DAISY_MOVES.map(m => [m, new Alg(m)]));

    // 27-state OLL Corner orientation table strictly using Sune & Antisune
    const ollCornerTable = new Map();
    const oriKey = pat => pat.patternData.CORNERS.orientation.slice(0, 4).join(",");
    ollCornerTable.set(oriKey(solved), []);
    const q = [{ pat: solved, steps: [] }];
    while (q.length > 0) {
      const cur = q.shift();
      if (cur.steps.length >= 2) continue;
      for (const auf of AUF_LIST) {
        for (const [name, alg, inv] of [
          ["Sune", SUNE, ANTISUNE],
          ["Antisune", ANTISUNE, SUNE]
        ]) {
          const prev = cur.pat.applyAlg(new Alg(`${inv} ${INV_AUF[auf]}`.trim()));
          const k = oriKey(prev);
          if (!ollCornerTable.has(k)) {
            const nextSteps = [{ name, auf, alg, moves: auf ? `${auf} ${alg}` : alg }, ...cur.steps];
            ollCornerTable.set(k, nextSteps);
            q.push({ pat: prev, steps: nextSteps });
          }
        }
      }
    }

    // Center piece color key -> goal pattern lookup (index 0 = U center color)
    const centerGoalByPattern = (pat) => {
      const uCenter = pat.patternData.CENTERS.pieces[0];
      const fCenter = pat.patternData.CENTERS.pieces[2];
      return yGoalPats.find(g => g.patternData.CENTERS.pieces[0] === uCenter && g.patternData.CENTERS.pieces[2] === fCenter) || pZ2;
    };

    return { kp, solved, pZ2, yGoalPats, rot24Pats, DAISY_MOVES, daisyMoveMap, ollCornerTable, centerGoalByPattern };
  })();
  return tablesPromise;
}

function joinMoves(...parts) {
  return parts
    .map(p => String(p || "").trim())
    .filter(Boolean)
    .join(" ")
    .trim();
}

function cornerSolved(pat, goalPat, slot) {
  return (
    pat.patternData.CORNERS.pieces[slot] === goalPat.patternData.CORNERS.pieces[slot] &&
    pat.patternData.CORNERS.orientation[slot] === goalPat.patternData.CORNERS.orientation[slot]
  );
}

function edgeSolved(pat, goalPat, slot) {
  return (
    pat.patternData.EDGES.pieces[slot] === goalPat.patternData.EDGES.pieces[slot] &&
    pat.patternData.EDGES.orientation[slot] === goalPat.patternData.EDGES.orientation[slot]
  );
}

function findDaisyPetalSeq(startPat, targetPiece, lockedUPetalPieces, daisyMoves, daisyMoveMap) {
  const isDone = (pat) => {
    for (let uSlot = 0; uSlot < 4; uSlot++) {
      if (pat.patternData.EDGES.pieces[uSlot] === targetPiece && pat.patternData.EDGES.orientation[uSlot] === 0) {
        // Also ensure all previously placed petals stay on U with ori=0
        return lockedUPetalPieces.every(lp => {
          const idx = pat.patternData.EDGES.pieces.indexOf(lp);
          return idx >= 0 && idx < 4 && pat.patternData.EDGES.orientation[idx] === 0;
        });
      }
    }
    return false;
  };

  if (isDone(startPat)) return "";

  const edgeKey = (pat) => {
    const parts = [pat.patternData.EDGES.pieces.indexOf(targetPiece) + ":" + pat.patternData.EDGES.orientation[pat.patternData.EDGES.pieces.indexOf(targetPiece)]];
    for (const lp of lockedUPetalPieces) {
      const idx = pat.patternData.EDGES.pieces.indexOf(lp);
      parts.push(`${idx}:${pat.patternData.EDGES.orientation[idx]}`);
    }
    return parts.join("|");
  };

  const visited = new Set([edgeKey(startPat)]);
  const queue = [{ pat: startPat, seq: [] }];

  while (queue.length > 0) {
    const cur = queue.shift();
    if (cur.seq.length >= 4) continue;
    const lastFace = cur.seq.length > 0 ? cur.seq[cur.seq.length - 1][0] : "";

    for (const m of daisyMoves) {
      if (m[0] === lastFace) continue;
      const nextPat = cur.pat.applyAlg(daisyMoveMap.get(m));
      const nextSeq = [...cur.seq, m];
      if (isDone(nextPat)) return nextSeq.join(" ");
      const key = edgeKey(nextPat);
      if (!visited.has(key)) {
        visited.add(key);
        queue.push({ pat: nextPat, seq: nextSeq });
      }
    }
  }
  return "";
}

/**
 * Compute dynamic step-by-step beginner 3x3 solution for any valid scramble.
 */
export async function solveThreeByThreeBeginner(scrambleStr) {
  const {
    solved,
    pZ2,
    rot24Pats,
    DAISY_MOVES,
    daisyMoveMap,
    ollCornerTable,
    centerGoalByPattern
  } = await getSolverTables333();

  const cleanScr = String(scrambleStr || "").trim().replace(/[()]/g, "");
  let curPat;
  try {
    curPat = cleanScr ? solved.applyAlg(new Alg(cleanScr)) : solved;
  } catch (err) {
    throw new Error(`Invalid 3x3 scramble: ${err?.message || cleanScr}`);
  }

  let cumulative = cleanScr;
  const steps = [];

  const pushStep = (step) => {
    const setupBefore = cumulative;
    const cleanMoves = joinMoves(step.moves);
    if (cleanMoves) {
      curPat = curPat.applyAlg(new Alg(cleanMoves));
      cumulative = joinMoves(cumulative, cleanMoves);
    }
    steps.push({
      ...step,
      moves: cleanMoves,
      setupBefore,
      cumulativeAfter: cumulative
    });
  };

  // Start in z2 orientation: Yellow center on U, White center on D, Green center on F
  const whiteCenterPiece = pZ2.patternData.CENTERS.pieces[5]; // D center in z2 = White
  let prepRot = "";
  for (const cand of ["z2", "x2", "", "y", "y'", "y2", "x", "x'", "z", "z'"]) {
    const p = cand ? curPat.applyAlg(new Alg(cand)) : curPat;
    if (p.patternData.CENTERS.pieces[5] === whiteCenterPiece) {
      prepRot = cand;
      break;
    }
  }
  if (prepRot) {
    pushStep({
      id: '333-step-orient',
      stage: 'daisy',
      stageLabel: 'Daisy & White Cross',
      title: 'Hold Yellow Center on Top (White on Bottom)',
      algName: `Rotate ${prepRot}`,
      moves: prepRot,
      description: `Turn the cube (${prepRot}) so the Yellow center is on Top (U) and White center is on Bottom (D).`
    });
  }

  const goalFromCur = () => centerGoalByPattern(curPat);
  const whiteEdgePieces = [4, 5, 6, 7].map(s => goalFromCur().patternData.EDGES.pieces[s]);

  // Stage 1: Build the Daisy (4 White edges on U around Yellow center with White facing Up)
  const daisySeqParts = [];
  let daisySim = curPat;
  const placedWhiteEdges = [];

  for (const wp of whiteEdgePieces) {
    const seg = findDaisyPetalSeq(daisySim, wp, placedWhiteEdges, DAISY_MOVES, daisyMoveMap);
    if (seg) {
      daisySeqParts.push(seg);
      daisySim = daisySim.applyAlg(new Alg(seg));
    }
    placedWhiteEdges.push(wp);
  }

  const allDaisyMoves = joinMoves(...daisySeqParts);
  pushStep({
    id: '333-step-daisy',
    stage: 'daisy',
    stageLabel: 'Daisy & White Cross',
    title: allDaisyMoves ? 'Build the Daisy (4 White Petals Around Yellow)' : 'Daisy Already Formed on Top',
    algName: allDaisyMoves ? 'Daisy Setup' : 'Already Done',
    moves: allDaisyMoves,
    description: allDaisyMoves
      ? 'Bring all 4 White edges up around the Yellow center on Top (petals don’t need to match side centers yet).'
      : 'All 4 White edges are already around the Yellow center!'
  });

  // Stage 2: Match each Daisy petal to its side center and drop down (F2/R2/B2/L2)
  const DROP_MAP = [
    { uSlot: 0, drop: "F2" },
    { uSlot: 1, drop: "R2" },
    { uSlot: 2, drop: "B2" },
    { uSlot: 3, drop: "L2" }
  ];
  const dGoal = goalFromCur();
  // Map each white edge piece to its matching D slot (4=DF->F2, 5=DR->R2, 6=DB->B2, 7=DL->L2)
  const pieceToTargetFace = new Map([
    [dGoal.patternData.EDGES.pieces[4], 0],
    [dGoal.patternData.EDGES.pieces[5], 1],
    [dGoal.patternData.EDGES.pieces[6], 2],
    [dGoal.patternData.EDGES.pieces[7], 3]
  ]);
  const dropParts = [];
  let dropSim = curPat;
  for (let pass = 0; pass < 4; pass++) {
    // Pick the U petal requiring the fewest U turns (0..2) to match its side center
    let bestAction = null;
    for (let uIdx = 0; uIdx < 4; uIdx++) {
      const pc = dropSim.patternData.EDGES.pieces[uIdx];
      const targetU = pieceToTargetFace.get(pc);
      if (targetU === undefined || dropSim.patternData.EDGES.orientation[uIdx] !== 0) continue;
      // U moves 0->3->2->1->0: uIdx - k mod 4 === targetU -> k = (uIdx - targetU + 4) % 4
      const k = (uIdx - targetU + 4) % 4;
      const uMove = k === 0 ? "" : k === 1 ? "U" : k === 2 ? "U2" : "U'";
      const seq = joinMoves(uMove, DROP_MAP[targetU].drop);
      const weight = k === 0 ? 0 : k === 2 ? 2 : 1;
      if (!bestAction || weight < bestAction.weight) {
        bestAction = { seq, weight };
      }
    }
    if (bestAction) {
      dropParts.push(bestAction.seq);
      dropSim = dropSim.applyAlg(new Alg(bestAction.seq));
    }
  }
  const crossDropMoves = joinMoves(...dropParts);
  pushStep({
    id: '333-step-cross',
    stage: 'daisy',
    stageLabel: 'Daisy & White Cross',
    title: 'Drop Daisy Petals → Solve White Cross',
    algName: 'Match + X2',
    moves: crossDropMoves,
    description: 'Turn U until each White edge’s side sticker matches the center below it, then do a 180° turn (F2 / R2 / B2 / L2) to lock it onto White on the bottom.'
  });

  // Stage 3: Solve all 4 White corners using Righty / Inverse Righty
  for (let cStep = 0; cStep < 4; cStep++) {
    const rotBefore = cStep === 0 ? "" : "y";
    const segs = [];
    if (rotBefore) segs.push(rotBefore);

    let simPat = rotBefore ? curPat.applyAlg(new Alg(rotBefore)) : curPat;
    let curGoal = goalFromCur();
    if (rotBefore) curGoal = curGoal.applyAlg(new Alg(rotBefore));

    const targetCorner = curGoal.patternData.CORNERS.pieces[4];
    if (cornerSolved(simPat, curGoal, 4)) {
      pushStep({
        id: `333-step-corner-${cStep + 1}`,
        stage: 'white-corners',
        stageLabel: '1st Layer Corners',
        title: `White Corner ${cStep + 1}/4: Already Solved`,
        algName: rotBefore ? `Rotate ${rotBefore}` : 'Solved',
        moves: rotBefore,
        description: `Bottom-Front-Right corner is already in place with matching side colors.`
      });
      continue;
    }

    let slotIdx = simPat.patternData.CORNERS.pieces.indexOf(targetCorner);
    let popPrep = "", popBack = "";
    if (slotIdx === 7) { popPrep = "y"; popBack = "y'"; }
    else if (slotIdx === 6) { popPrep = "y2"; popBack = "y2"; }
    else if (slotIdx === 5) { popPrep = "y'"; popBack = "y"; }

    if (slotIdx >= 4) {
      const popSeq = joinMoves(popPrep, RIGHTY, popBack);
      segs.push(popSeq);
      simPat = simPat.applyAlg(new Alg(popSeq));
      slotIdx = simPat.patternData.CORNERS.pieces.indexOf(targetCorner);
    }

    const uAlign = { 0: "", 1: "U", 2: "U2", 3: "U'" }[slotIdx] || "";
    if (uAlign) {
      segs.push(uAlign);
      simPat = simPat.applyAlg(new Alg(uAlign));
    }

    let insertAlg = RIGHTY;
    let insertLabel = "Righty (1×)";
    for (const cand of [
      { alg: RIGHTY, label: "Righty (1×)" },
      { alg: INV_RIGHTY, label: "Inverse Righty (1×)" },
      { alg: `${RIGHTY} ${RIGHTY} ${RIGHTY}`, label: "Righty (3×)" }
    ]) {
      if (cornerSolved(simPat.applyAlg(new Alg(cand.alg)), curGoal, 4)) {
        insertAlg = cand.alg;
        insertLabel = cand.label;
        break;
      }
    }
    segs.push(insertAlg);

    pushStep({
      id: `333-step-corner-${cStep + 1}`,
      stage: 'white-corners',
      stageLabel: '1st Layer Corners',
      title: `Solve White Corner ${cStep + 1}/4 (${insertLabel})`,
      algName: insertLabel,
      moves: joinMoves(...segs),
      description: `Place the target White corner above Front-Right and drop it into the bottom layer using ${insertLabel}.`
    });
  }

  // Stage 4: Middle Layer Edges (F2L — one edge at a time)
  for (let eStep = 0; eStep < 4; eStep++) {
    let curGoal = goalFromCur();
    const targetEdge = curGoal.patternData.EDGES.pieces[8]; // FR slot

    if (edgeSolved(curPat, curGoal, 8)) {
      const rotNext = eStep < 3 ? "y" : "";
      pushStep({
        id: `333-step-edge-${eStep + 1}`,
        stage: 'f2l-edges',
        stageLabel: 'Middle Layer Edges (F2L)',
        title: `Middle Edge ${eStep + 1}/4: Already Solved`,
        algName: rotNext ? `Next Side (${rotNext})` : 'Solved',
        moves: rotNext,
        description: `Front-Right middle edge is already solved!${rotNext ? ' Rotate y to inspect the next side.' : ''}`
      });
      continue;
    }

    const segs = [];
    let simPat = curPat;
    let eSlot = simPat.patternData.EDGES.pieces.indexOf(targetEdge);

    // If trapped in middle layer (8=FR, 9=FL, 10=BR, 11=BL), pop out with U + Righty + y + Lefty
    if (eSlot >= 8) {
      let popPrep = "", popBack = "";
      if (eSlot === 10) { popPrep = "y"; popBack = "y'"; }
      else if (eSlot === 11) { popPrep = "y2"; popBack = "y2"; }
      else if (eSlot === 9) { popPrep = "y'"; popBack = "y"; }
      const popSeq = joinMoves(popPrep, EDGE_RIGHT, "y'", popBack);
      segs.push(popSeq);
      simPat = simPat.applyAlg(new Alg(popSeq));
      eSlot = simPat.patternData.EDGES.pieces.indexOf(targetEdge);
    }

    // Align target edge to UF (slot 0) via U/U'/U2, then test Right Insert vs y + Left Insert!
    const uToFront = { 0: "", 1: "U", 2: "U2", 3: "U'" }[eSlot] || "";
    const rightTrySeq = joinMoves(uToFront, EDGE_RIGHT);
    const afterRightPat = simPat.applyAlg(new Alg(rightTrySeq));
    const goalAfterY = curGoal.applyAlg(new Alg("y"));

    let chosenLabel = "Insert Right (U + Righty + y + Lefty)";
    let chosenInsert = rightTrySeq;
    // EDGE_RIGHT moves UF -> FR then rotates y, so solved slot becomes FL (9)
    if (!edgeSolved(afterRightPat, goalAfterY, 9)) {
      // Otherwise rotate y first (making target edge slot FL=9), align matching side edge to UF, and run EDGE_LEFT
      const simAfterY = simPat.applyAlg(new Alg("y"));
      const uSlotAfterY = simAfterY.patternData.EDGES.pieces.indexOf(targetEdge);
      const uAfterY = { 0: "", 1: "U", 2: "U2", 3: "U'" }[uSlotAfterY] || "";
      chosenInsert = joinMoves("y", uAfterY, EDGE_LEFT);
      chosenLabel = "Insert Left (U' + Lefty + y' + Righty)";
    }

    // Note: EDGE_RIGHT ends with y (advancing to next middle edge cleanly!);
    // y + u + EDGE_LEFT ends with y' (canceling back), so append "y" if more edges remain or to match clean orientation!
    if (chosenLabel.startsWith("Insert Left")) {
      chosenInsert = joinMoves(chosenInsert, "y");
    }
    segs.push(chosenInsert);

    pushStep({
      id: `333-step-edge-${eStep + 1}`,
      stage: 'f2l-edges',
      stageLabel: 'Middle Layer Edges (F2L)',
      title: `Middle Edge ${eStep + 1}/4 (${chosenLabel.startsWith('Insert Right') ? 'Right' : 'Left'} Insert)`,
      algName: chosenLabel,
      moves: joinMoves(...segs),
      description: `Match the edge on top to its front center, then drop it into the middle slot using ${chosenLabel}.`
    });
  }

  // Stage 5a: Yellow Cross using ONLY F (Righty) F'
  let crossIter = 0;
  while (crossIter < 4) {
    const eo = curPat.patternData.EDGES.orientation.slice(0, 4);
    const upCount = eo.filter(o => o === 0).length;
    if (upCount === 4) break;
    crossIter++;

    let auf = "";
    let shapeName = "Dot";
    if (upCount === 2) {
      if (eo[1] === 0 && eo[3] === 0) {
        auf = "";
        shapeName = "Horizontal Line";
      } else if (eo[0] === 0 && eo[2] === 0) {
        auf = "U";
        shapeName = "Line → Horizontal";
      } else {
        // Adjacent L-shape: align to 9 & 12 o'clock (UL=3 & UB=2)
        shapeName = "L-Shape (9 & 12 o'clock)";
        if (eo[3] === 0 && eo[2] === 0) auf = "";
        else if (eo[2] === 0 && eo[1] === 0) auf = "U'";
        else if (eo[1] === 0 && eo[0] === 0) auf = "U2";
        else if (eo[0] === 0 && eo[3] === 0) auf = "U";
      }
    }

    pushStep({
      id: `333-step-ycross-${crossIter}`,
      stage: 'oll',
      stageLabel: 'Yellow Cross & OLL',
      title: `Yellow Cross (${shapeName}) → F (Righty) F'`,
      algName: "F (Righty) F'",
      moves: joinMoves(auf, YELLOW_CROSS_ALG),
      description: `${auf ? `Turn top (${auf}) so ${shapeName} is in position, then apply ` : 'Apply '}F R U R' U' F' to advance Dot → L → Line → Yellow Cross.`
    });
  }
  if (crossIter === 0) {
    pushStep({
      id: '333-step-ycross-skip',
      stage: 'oll',
      stageLabel: 'Yellow Cross & OLL',
      title: 'Yellow Cross Already Solved',
      algName: 'Skip',
      moves: '',
      description: 'All 4 Yellow top edges already face Up!'
    });
  }

  // Stage 5b: Yellow Corners OLL using ONLY Sune and Antisune (exact reverse of Sune)
  const ollKey = curPat.patternData.CORNERS.orientation.slice(0, 4).join(",");
  const ollPlan = ollCornerTable.get(ollKey) || [];
  if (ollPlan.length === 0) {
    pushStep({
      id: '333-step-oll-skip',
      stage: 'oll',
      stageLabel: 'Yellow Cross & OLL',
      title: 'Yellow Corners Already Oriented (OLL Skip)',
      algName: 'Skip',
      moves: '',
      description: 'All 4 Yellow top corners already face Up!'
    });
  } else {
    ollPlan.forEach((step, idx) => {
      pushStep({
        id: `333-step-oll-${idx + 1}`,
        stage: 'oll',
        stageLabel: 'Yellow Cross & OLL',
        title: `Yellow OLL Corners (${idx + 1}/${ollPlan.length}): ${step.name}`,
        algName: step.name,
        moves: step.moves,
        description: step.name === 'Antisune'
          ? `${step.auf ? `Adjust U (${step.auf}), then apply ` : 'Apply '}Antisune — the exact reverse of Sune.`
          : `${step.auf ? `Adjust U (${step.auf}), then apply ` : 'Apply '}Sune (R U R' U R U2 R').`
      });
    });
  }

  // Stage 6a: PLL Corners using ONLY T-Perm
  const curGoalPll = goalFromCur();
  const findCornersAlignedAuf = (pat) => {
    for (const auf of AUF_LIST) {
      const cand = auf ? pat.applyAlg(new Alg(auf)) : pat;
      if ([0, 1, 2, 3].every(s => cornerSolved(cand, curGoalPll, s))) {
        return auf;
      }
    }
    return null;
  };

  const findHeadlightsLeftAuf = (pat) => {
    for (const auf of AUF_LIST) {
      const test = auf ? pat.applyAlg(new Alg(auf)) : pat;
      const afterT = test.applyAlg(new Alg(T_PERM));
      if (findCornersAlignedAuf(afterT) !== null) return auf;
    }
    return null;
  };

  let cornersAuf = findCornersAlignedAuf(curPat);
  if (cornersAuf === null) {
    let hlAuf = findHeadlightsLeftAuf(curPat);
    if (hlAuf === null) {
      pushStep({
        id: '333-step-pll-c1',
        stage: 'pll',
        stageLabel: 'Last Layer (PLL)',
        title: 'Diagonal Corners → Create Headlights (T-Perm 1/2)',
        algName: 'T-Perm',
        moves: T_PERM,
        description: 'No matching corner pair ("headlights") exists yet. Apply T-Perm once to create headlights.'
      });
      hlAuf = findHeadlightsLeftAuf(curPat);
    }

    const cNum = steps.some(s => s.id === '333-step-pll-c1') ? 2 : 1;
    pushStep({
      id: `333-step-pll-c${cNum}`,
      stage: 'pll',
      stageLabel: 'Last Layer (PLL)',
      title: `Solve Top Corners (T-Perm${cNum === 2 ? ' 2/2' : ''})`,
      algName: 'T-Perm',
      moves: joinMoves(hlAuf || "", T_PERM),
      description: `${hlAuf ? `Turn top (${hlAuf}) to put matching corner headlights on the Left, then ` : 'With headlights on the Left, '}apply T-Perm to solve all 4 corners.`
    });
    cornersAuf = findCornersAlignedAuf(curPat);
  }

  if (cornersAuf) {
    pushStep({
      id: '333-step-pll-corner-auf',
      stage: 'pll',
      stageLabel: 'Last Layer (PLL)',
      title: `Align Solved Corners (${cornersAuf})`,
      algName: `AUF ${cornersAuf}`,
      moves: cornersAuf,
      description: `Turn top (${cornersAuf}) so all 4 top corners line up with the sides.`
    });
  }

  // Stage 6b: PLL Edges using ONLY M-move Ua & Ub Perms
  const solveBackBarEdgePerm = (pat, goalPat) => {
    for (const yRot of ["", "y", "y'", "y2"]) {
      const rPat = yRot ? pat.applyAlg(new Alg(yRot)) : pat;
      const rGoal = yRot ? goalPat.applyAlg(new Alg(yRot)) : goalPat;
      if (rPat.applyAlg(new Alg(UA_PERM)).isIdentical(rGoal)) {
        return { yRot, name: 'Ua Perm', alg: UA_PERM, moves: joinMoves(yRot, UA_PERM) };
      }
      if (rPat.applyAlg(new Alg(UB_PERM)).isIdentical(rGoal)) {
        return { yRot, name: 'Ub Perm', alg: UB_PERM, moves: joinMoves(yRot, UB_PERM) };
      }
    }
    return null;
  };

  if (!curPat.isIdentical(goalFromCur())) {
    let edgeMatch = solveBackBarEdgePerm(curPat, goalFromCur());
    if (!edgeMatch) {
      // H-Perm or Z-Perm (0 solved edges): 1x Ua Perm creates 1 solved edge bar!
      pushStep({
        id: '333-step-pll-e1',
        stage: 'pll',
        stageLabel: 'Last Layer (PLL)',
        title: 'All 4 Edges Unsolved → Create Edge Bar (Ua Perm 1/2)',
        algName: 'Ua Perm',
        moves: UA_PERM,
        description: 'None of the 4 top edges match yet. Apply Ua Perm once to create 1 solved side bar.'
      });
      edgeMatch = solveBackBarEdgePerm(curPat, goalFromCur());
    }

    if (edgeMatch) {
      const isSecond = steps.some(s => s.id === '333-step-pll-e1');
      pushStep({
        id: `333-step-pll-e${isSecond ? 2 : 1}`,
        stage: 'pll',
        stageLabel: 'Last Layer (PLL)',
        title: `Cycle Last 3 Edges (${edgeMatch.name}${isSecond ? ' 2/2' : ''})`,
        algName: edgeMatch.name,
        moves: edgeMatch.moves,
        description: `${edgeMatch.yRot ? `Rotate cube (${edgeMatch.yRot}) to put the solved side bar in Back, then ` : 'With the solved bar in Back, '}apply ${edgeMatch.name} (${edgeMatch.alg}) to finish!`
      });
    }
  } else if (!steps.some(s => s.stage === 'pll')) {
    pushStep({
      id: '333-step-pll-skip',
      stage: 'pll',
      stageLabel: 'Last Layer (PLL)',
      title: 'Last Layer Already Solved (PLL Skip)',
      algName: 'Skip',
      moves: '',
      description: 'All top corners and edges are already solved!'
    });
  }

  const totalMoves = steps.reduce(
    (sum, st) => sum + (st.moves ? st.moves.split(/\s+/).filter(Boolean).length : 0),
    0
  );
  const solvedFinal = rot24Pats.some(g => curPat.isIdentical(g));

  return {
    puzzle: '333',
    scramble: cleanScr,
    steps,
    totalMoves,
    solved: solvedFinal
  };
}
