// Dynamic Step-by-Step 2x2 Beginner Solver
// Solves any 2x2 scramble using ONLY:
//   1. Pick your anchor White corner (defaults to White · Green · Red at Bottom-Left DFL)
//   2. Solve remaining White corners clockwise using Righty / Inverse Righty
//   3. Yellow Face OLL using ONLY Sune and Antisune (reverse of Sune)
//   4. PLL using ONLY T-Perm (+ final AUF)

import { cube2x2x2 } from 'cubing/puzzles';
import { Alg } from 'cubing/alg';

export const WHITE_CORNER_META = Object.freeze({
  0: { label: 'White · Green · Red', short: 'W·G·R', colors: ['W', 'G', 'R'] },
  1: { label: 'White · Blue · Red', short: 'W·B·R', colors: ['W', 'B', 'R'] },
  2: { label: 'White · Blue · Orange', short: 'W·B·O', colors: ['W', 'B', 'O'] },
  3: { label: 'White · Green · Orange', short: 'W·G·O', colors: ['W', 'G', 'O'] }
});

export const TWO_BY_TWO_ANCHORS = [
  { id: 'wgr', label: 'White · Green · Red', short: 'W·G·R', goalSlotInZ2: 5 },
  { id: 'wgo', label: 'White · Green · Orange', short: 'W·G·O', goalSlotInZ2: 4 },
  { id: 'wbo', label: 'White · Blue · Orange', short: 'W·B·O', goalSlotInZ2: 7 },
  { id: 'wbr', label: 'White · Blue · Red', short: 'W·B·R', goalSlotInZ2: 6 }
];

const RIGHTY = "R U R' U'";
const INV_RIGHTY = "U R U' R'";
const SUNE = "R U R' U R U2 R'";
const ANTISUNE = "R U2 R' U' R U' R'";
const T_PERM = "R U R' U' R' F R2 U' R' U' R U R' F'";

const INV_AUF = { "": "", "U": "U'", "U'": "U", "U2": "U2" };
const AUF_LIST = ["", "U", "U'", "U2"];

let kp2Promise = null;
let tablesPromise = null;

async function getSolverTables() {
  if (tablesPromise) return tablesPromise;
  tablesPromise = (async () => {
    if (!kp2Promise) kp2Promise = cube2x2x2.kpuzzle();
    const kp = await kp2Promise;
    const solved = kp.defaultPattern();
    const pZ2 = solved.applyAlg(new Alg("z2"));

    // All 24 SO(3) whole-cube rotations ordered by simplicity
    const rot24 = [];
    const seenRotPat = [];
    const baseCandidates = [
      "", "y", "y'", "y2", "x", "x'", "x2", "z", "z'", "z2",
      "x y", "x y'", "x y2", "x' y", "x' y'", "x' y2", "x2 y", "x2 y'", "x2 y2",
      "z y", "z y'", "z y2", "z' y", "z' y'", "z' y2", "z2 y", "z2 y'", "z2 y2",
      "y z", "y z'", "y' z", "y' z'"
    ];
    for (const r of baseCandidates) {
      const p = r ? solved.applyAlg(new Alg(r)) : solved;
      if (!seenRotPat.some(s => s.isIdentical(p))) {
        seenRotPat.push(p);
        rot24.push(r);
      }
      if (rot24.length >= 24) break;
    }

    // 27-state corner OLL orientation table solved strictly with Sune & Antisune (max 2 looks)
    const ollTable = new Map();
    const oriKey = pat => pat.patternData.CORNERS.orientation.slice(0, 4).join(",");
    ollTable.set(oriKey(solved), []);
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
          if (!ollTable.has(k)) {
            const seq = `${auf ? auf + " " : ""}${alg}`;
            const nextSteps = [{ name, auf, alg, moves: seq }, ...cur.steps];
            ollTable.set(k, nextSteps);
            q.push({ pat: prev, steps: nextSteps });
          }
        }
      }
    }

const SHORT_MOVES = ["R", "R'", "R2", "U", "U'", "U2", "F", "F'", "F2"];

    const shortMoveAlgs = SHORT_MOVES.map(m => ({ m, face: m[0], alg: new Alg(m) }));

    return { kp, solved, pZ2, rot24, ollTable, shortMoveAlgs };
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

function invertSimpleAlg(algStr) {
  if (!algStr) return "";
  return algStr
    .trim()
    .split(/\s+/)
    .reverse()
    .map(tok => (tok.endsWith("2") ? tok : tok.endsWith("'") ? tok.slice(0, -1) : `${tok}'`))
    .join(" ");
}

function cornerMatchesGoal(pat, goalPat, slot) {
  return (
    pat.patternData.CORNERS.pieces[slot] === goalPat.patternData.CORNERS.pieces[slot] &&
    pat.patternData.CORNERS.orientation[slot] === 0
  );
}

function countFaceMoves(movesStr) {
  if (!movesStr) return 0;
  return String(movesStr)
    .trim()
    .split(/\s+/)
    .filter(tok => tok && !/^[xyz][2']?$/i.test(tok))
    .length;
}

function patStateKey222(pat) {
  const c = pat.patternData.CORNERS;
  return `${c.pieces.join(',')}|${c.orientation.join(',')}`;
}

/**
 * Find the shortest <R, U, F> move sequence solving slot 4 (DFR)
 * without moving or twisting any White corner already in `protectedSlots`.
 */
function findShortestCornerInsert(startPat, goalPat, protectedSlots, shortMoveAlgs, maxDepth = 5, maxVisited = 6500) {
  if (cornerMatchesGoal(startPat, goalPat, 4) && protectedSlots.every(sl => cornerMatchesGoal(startPat, goalPat, sl))) {
    return "";
  }
  const visited = new Set([patStateKey222(startPat)]);
  const queue = [{ pat: startPat, seq: [], lastFace: '' }];

  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head];
    if (cur.seq.length >= maxDepth) continue;
    for (const { m, face, alg } of shortMoveAlgs) {
      if (face === cur.lastFace) continue;
      const nextPat = cur.pat.applyAlg(alg);
      if (!protectedSlots.every(sl => cornerMatchesGoal(nextPat, goalPat, sl))) {
        // Note: a valid 2- or 3-move insert (e.g. R U' R') temporarily moves a solved D-slot?
        // Wait: NO! On 2x2, R touches [0,1,4,7] (only slot 4 & 7 on D!), NEVER 5 (DFL) or 6 (DBL).
        // If DBR (7) is NOT yet in protectedSlots, R preserves DFL & DBL on EVERY intermediate move.
        // If DBR (7) IS in protectedSlots, or F/B moves touch DFL/DBL temporarily, we MUST allow intermediate moves!
      }
      if (cornerMatchesGoal(nextPat, goalPat, 4) && protectedSlots.every(sl => cornerMatchesGoal(nextPat, goalPat, sl))) {
        return [...cur.seq, m].join(' ');
      }
      if (cur.seq.length + 1 >= maxDepth || visited.size >= maxVisited) continue;
      const k = patStateKey222(nextPat);
      if (!visited.has(k)) {
        visited.add(k);
        queue.push({ pat: nextPat, seq: [...cur.seq, m], lastFace: face });
      }
    }
  }
  return null;
}

/**
 * Compute dynamic step-by-step beginner 2x2 solution for any valid scramble.
 */
export async function solveTwoByTwoBeginner(scrambleStr, { anchorId = "wgr", stepChoices = {} } = {}) {
  const { kp, solved, pZ2, rot24, ollTable, shortMoveAlgs } = await getSolverTables();
  const anchor = TWO_BY_TWO_ANCHORS.find(a => a.id === anchorId) || TWO_BY_TWO_ANCHORS[0];

  const cleanScr = String(scrambleStr || "").trim().replace(/[()]/g, "");
  let scrPat;
  try {
    scrPat = cleanScr ? solved.applyAlg(new Alg(cleanScr)) : solved;
  } catch (err) {
    throw new Error(`Invalid 2x2 scramble: ${err?.message || cleanScr}`);
  }

  const anchorPiece = pZ2.patternData.CORNERS.pieces[anchor.goalSlotInZ2];
  let curPat = scrPat;
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

  // Step 1: Bring chosen anchor piece to Bottom-Front-Left (DFL, slot 5) with White facing D (ori=0)
  let bestAnchorRot = null;
  for (const r of rot24) {
    const cand = r ? curPat.applyAlg(new Alg(r)) : curPat;
    if (cand.patternData.CORNERS.pieces[5] === anchorPiece && cand.patternData.CORNERS.orientation[5] === 0) {
      bestAnchorRot = r;
      break;
    }
  }

  // Build exact whole-cube goal pattern matching the chosen anchor sitting at DFL (slot 5)
  let goalBasePat = null;
  for (const r of rot24) {
    const cand = r ? solved.applyAlg(new Alg(r)) : solved;
    if (cand.patternData.CORNERS.pieces[5] === anchorPiece && cand.patternData.CORNERS.orientation[5] === 0) {
      goalBasePat = cand;
      break;
    }
  }

  const placedWhitePieces = [];
  const anchorMeta = WHITE_CORNER_META[anchorPiece] || { label: anchor.label, short: anchor.short, colors: ['W', 'G', 'R'] };

  pushStep({
    id: '222-step-anchor',
    stage: 'white-layer',
    stageLabel: 'White Layer (1st Layer)',
    title: `Place Anchor (${anchor.label}) at Bottom-Left`,
    algName: bestAnchorRot ? `Rotate ${bestAnchorRot}` : 'Already Positioned',
    moves: bestAnchorRot || '',
    highlightPiece: anchorMeta,
    description: bestAnchorRot
      ? `Rotate the cube (${bestAnchorRot}) so your highlighted ${anchor.label} corner sits at Bottom-Front-Left (DFL) with White facing down.`
      : `Your highlighted ${anchor.label} anchor corner is already at Bottom-Front-Left (DFL) with White facing down.`
  });
  placedWhitePieces.push(anchorPiece);

  // Steps 2–4: Clockwise White corners (around bottom face starting from DFL -> DFR -> DBR -> DBL)
  // Applying "y" between corners shifts the next clockwise slot into Bottom-Front-Right (DFR, slot 4)!
  const clockwiseSteps = [
    { rotBefore: "", ordinal: "2nd White Corner (Front-Right)" },
    { rotBefore: "y", ordinal: "3rd White Corner (Back-Right)" },
    { rotBefore: "y", ordinal: "4th White Corner (Back-Left)" }
  ];

  for (let i = 0; i < clockwiseSteps.length; i++) {
    const { rotBefore, ordinal } = clockwiseSteps[i];
    const rotAlgBefore = rotBefore ? new Alg(rotBefore) : null;
    const testGoalAfterRot = rotAlgBefore ? goalBasePat.applyAlg(rotAlgBefore) : goalBasePat;
    goalBasePat = testGoalAfterRot;

    const previewPat = rotAlgBefore ? curPat.applyAlg(rotAlgBefore) : curPat;
    const targetPiece = goalBasePat.patternData.CORNERS.pieces[4];
    const targetMeta = WHITE_CORNER_META[targetPiece] || null;

    if (cornerMatchesGoal(previewPat, goalBasePat, 4)) {
      pushStep({
        id: `222-step-c${i + 2}`,
        stage: 'white-layer',
        stageLabel: 'White Layer (1st Layer)',
        title: `${ordinal}: Already in Place`,
        algName: rotBefore ? `Turn Cube ${rotBefore}` : 'Solved',
        moves: rotBefore,
        highlightPiece: targetMeta,
        description: rotBefore
          ? `Turn the whole cube (${rotBefore}) clockwise around White — the highlighted ${targetMeta?.label || 'White'} corner is already solved in place!`
          : `This highlighted ${targetMeta?.label || 'White'} corner is already solved at Front-Right.`
      });
      placedWhitePieces.push(targetPiece);
      continue;
    }

    const segs = [];
    if (rotBefore) segs.push(rotBefore);

    let simPat = previewPat;
    let slotIdx = simPat.patternData.CORNERS.pieces.indexOf(targetPiece);

    // If trapped in bottom layer (DFR=4, DBR=7, DBL=6), pop it safely to U without disturbing solved corners
    let popPrep = "";
    let popBack = "";
    if (slotIdx === 7) {
      popPrep = "y";
      popBack = "y'";
    } else if (slotIdx === 6) {
      popPrep = "y2";
      popBack = "y2";
    } else if (slotIdx === 5) {
      popPrep = "y'";
      popBack = "y";
    }

    if (slotIdx >= 4) {
      const popSeq = joinMoves(popPrep, RIGHTY, popBack);
      segs.push(popSeq);
      simPat = simPat.applyAlg(new Alg(popSeq));
      slotIdx = simPat.patternData.CORNERS.pieces.indexOf(targetPiece);
    }

    // Align target corner above DFR (into UFR = slot 0)
    const uAlignMap = { 0: "", 1: "U", 2: "U2", 3: "U'" };
    const uAlign = uAlignMap[slotIdx] || "";
    if (uAlign) {
      segs.push(uAlign);
      simPat = simPat.applyAlg(new Alg(uAlign));
    }

    // Solve into DFR using Righty (1x or 3x) or Inverse Righty (1x)
    let insertAlg = RIGHTY;
    let insertLabel = "Righty (1×)";
    const insertCandidates = [
      { alg: RIGHTY, label: "Righty (1×)" },
      { alg: INV_RIGHTY, label: "Inverse Righty (1×)" },
      { alg: `${RIGHTY} ${RIGHTY} ${RIGHTY}`, label: "Righty (3×)" }
    ];
    for (const cand of insertCandidates) {
      const res = simPat.applyAlg(new Alg(cand.alg));
      if (cornerMatchesGoal(res, goalBasePat, 4)) {
        insertAlg = cand.alg;
        insertLabel = cand.label;
        break;
      }
    }
    segs.push(insertAlg);

    const stepId = `222-step-c${i + 2}`;
    const defaultMoves = joinMoves(...segs);
    const defaultShortMoves = joinMoves(...segs.slice(rotBefore ? 1 : 0));
    const defaultFaceCount = countFaceMoves(defaultShortMoves);
    const defaultDesc = `${rotBefore ? `Turn cube (${rotBefore}) to bring the next empty corner to Front-Right. ` : ''}${slotIdx >= 4 || popBack ? `Pop the highlighted ${targetMeta?.label || 'target'} corner up to Top, align above Front-Right, and drop it in with ` : `Align the highlighted ${targetMeta?.label || 'target'} corner above Front-Right with U and drop it in with `}${insertLabel}.`;

    const protectedSlots = [5, 6, 7].filter(sl => cornerMatchesGoal(previewPat, goalBasePat, sl));
    const shortestInsert = findShortestCornerInsert(previewPat, goalBasePat, protectedSlots, shortMoveAlgs, 5);
    const altMoves = shortestInsert !== null ? joinMoves(rotBefore, shortestInsert) : null;
    const altFaceCount = shortestInsert !== null ? countFaceMoves(shortestInsert) : Infinity;

    let options = null;
    let activeOptionId = 'default';
    if (shortestInsert && altFaceCount < defaultFaceCount) {
      const shortestDesc = `${rotBefore ? `Turn cube (${rotBefore}) to bring the next empty corner to Front-Right, then solve ` : 'Solve '}the highlighted ${targetMeta?.label || 'target'} corner with the shortest ${altFaceCount}-move sequence (${shortestInsert}) without disturbing already-placed White corners.`;
      options = [
        {
          id: 'default',
          label: 'Trigger',
          algName: insertLabel,
          moves: defaultMoves,
          shortMoves: defaultShortMoves,
          faceMoves: defaultFaceCount,
          description: defaultDesc
        },
        {
          id: 'shortest',
          label: 'Shortest',
          algName: `Shortest (${altFaceCount}m)`,
          moves: altMoves,
          shortMoves: shortestInsert,
          faceMoves: altFaceCount,
          description: shortestDesc
        }
      ];
      if (stepChoices && stepChoices[stepId] === 'shortest') {
        activeOptionId = 'shortest';
      }
    }

    const chosenOpt = options ? options.find(o => o.id === activeOptionId) || options[0] : null;
    pushStep({
      id: stepId,
      stage: 'white-layer',
      stageLabel: 'White Layer (1st Layer)',
      title: chosenOpt && activeOptionId === 'shortest'
        ? `${ordinal} (Shortest ${altFaceCount}m)`
        : `${ordinal} (${insertLabel})`,
      algName: chosenOpt ? chosenOpt.algName : insertLabel,
      moves: chosenOpt ? chosenOpt.moves : defaultMoves,
      highlightPiece: targetMeta,
      options,
      activeOptionId: options ? activeOptionId : undefined,
      description: chosenOpt ? chosenOpt.description : defaultDesc
    });
    placedWhitePieces.push(targetPiece);
  }

  // Rotate to WCA/White-down goal with any clean y alignment before OLL (no rotation needed; White layer is solved!)
  // Steps 5+: OLL using ONLY Sune and Antisune (exact reverse of Sune)
  const ollKey = curPat.patternData.CORNERS.orientation.slice(0, 4).join(",");
  const ollPlan = ollTable.get(ollKey) || [];
  if (ollPlan.length === 0) {
    pushStep({
      id: '222-step-oll-skip',
      stage: 'oll',
      stageLabel: 'Yellow Face (OLL)',
      title: 'Yellow Face Already Solved (OLL Skip)',
      algName: 'Skip',
      moves: '',
      description: 'All 4 Yellow stickers already face Up on top!'
    });
  } else {
    ollPlan.forEach((step, idx) => {
      pushStep({
        id: `222-step-oll-${idx + 1}`,
        stage: 'oll',
        stageLabel: 'Yellow Face (OLL)',
        title: `Orient Yellow Corners (${idx + 1}/${ollPlan.length}): ${step.name}`,
        algName: step.name,
        moves: step.moves,
        description: step.name === 'Antisune'
          ? `${step.auf ? `Adjust top (${step.auf}), then apply ` : 'Apply '}Antisune — the exact reverse of Sune.`
          : `${step.auf ? `Adjust top (${step.auf}), then apply ` : 'Apply '}Sune (R U R' U R U2 R').`
      });
    });
  }

  // Steps 6+: PLL using ONLY T-Perm (+ final AUF)
  const isLayerAlignedWithGoal = (pat) =>
    AUF_LIST.find(auf => {
      const cand = auf ? pat.applyAlg(new Alg(auf)) : pat;
      return cand.isIdentical(goalBasePat);
    });

  // Detect headlights/Bar (2 adjacent corners matching side colors relative to one another on U)
  const findBarOnLeftAuf = (pat) => {
    for (const auf of AUF_LIST) {
      const test = auf ? pat.applyAlg(new Alg(auf)) : pat;
      // If T-Perm solves the layer (up to AUF), then the Bar is aligned on Left (UBL + UFL)!
      const afterT = test.applyAlg(new Alg(T_PERM));
      if (isLayerAlignedWithGoal(afterT) !== undefined) {
        return auf;
      }
    }
    return null;
  };

  let alignedAuf = isLayerAlignedWithGoal(curPat);
  if (alignedAuf === undefined) {
    let leftBarAuf = findBarOnLeftAuf(curPat);
    if (leftBarAuf === null) {
      // Diagonal corner swap (0 Bars): apply 1st T-Perm to create a Bar!
      pushStep({
        id: '222-step-pll-1',
        stage: 'pll',
        stageLabel: 'Finish Top Corners (PLL)',
        title: 'Diagonal Swap → Create a Bar (T-Perm 1/2)',
        algName: 'T-Perm',
        moves: T_PERM,
        description: 'No matching side pairs (Bars) exist on top. Apply T-Perm once from anywhere to create a matching Bar.'
      });
      leftBarAuf = findBarOnLeftAuf(curPat);
    }

    const pllNum = leftBarAuf !== null && steps.some(s => s.id === '222-step-pll-1') ? 2 : 1;
    const tMoves = joinMoves(leftBarAuf || "", T_PERM);
    pushStep({
      id: `222-step-pll-${pllNum}`,
      stage: 'pll',
      stageLabel: 'Finish Top Corners (PLL)',
      title: `Swap Right Corners (T-Perm${pllNum === 2 ? ' 2/2' : ''})`,
      algName: 'T-Perm',
      moves: tMoves,
      description: `${leftBarAuf ? `Turn top (${leftBarAuf}) to put the matching side Bar on the Left, then ` : 'With the matching Bar already on the Left, '}apply T-Perm to solve all top side colors.`
    });
    alignedAuf = isLayerAlignedWithGoal(curPat);
  }

  if (alignedAuf) {
    pushStep({
      id: '222-step-auf',
      stage: 'pll',
      stageLabel: 'Finish Top Corners (PLL)',
      title: `Final Align (${alignedAuf})`,
      algName: `AUF ${alignedAuf}`,
      moves: alignedAuf,
      description: `Turn the top layer (${alignedAuf}) to line up the colors and finish the cube!`
    });
  } else if (!steps.some(s => s.stage === 'pll')) {
    pushStep({
      id: '222-step-pll-skip',
      stage: 'pll',
      stageLabel: 'Finish Top Corners (PLL)',
      title: 'Top Sides Already Aligned (PLL Skip)',
      algName: 'Skip',
      moves: '',
      description: 'Every side sticker already matches — the 2x2 is solved!'
    });
  }

  const totalMoves = steps.reduce(
    (sum, st) => sum + (st.moves ? st.moves.split(/\s+/).filter(Boolean).length : 0),
    0
  );

  // Final mathematical check against any of the 24 whole-cube solved orientations
  const solvedFinal = rot24.some(r => curPat.isIdentical(r ? solved.applyAlg(new Alg(r)) : solved));

  return {
    puzzle: '222',
    scramble: cleanScr,
    anchor,
    steps,
    totalMoves,
    solved: solvedFinal
  };
}
