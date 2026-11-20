// Generator & verifier for 2x2x2 EG-1 (40 cases, Back Bar) and EG-2 (40 cases, Diag Bottom Swap)
// Run with: node scripts/generators/generate-eg.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { puzzles } from 'cubing/puzzles';
import { Alg } from 'cubing/alg';
import { cllCases } from '../../src/data/cllData.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.resolve(__dirname, '../../src/data/egData.js');

const ORIENT_ROTS = [
  '', 'y', 'y2', "y'",
  'x', 'x y', 'x y2', "x y'",
  'x2', 'x2 y', 'x2 y2', "x2 y'",
  "x'", "x' y", "x' y2", "x' y'",
  'z', 'z y', 'z y2', "z y'",
  "z'", "z' y", "z' y2", "z' y'"
];

const RUF_MOVES = ['R', "R'", 'R2', 'U', "U'", 'U2', 'F', "F'", 'F2'];
const AUF_LIST = ['', 'U', "U'", 'U2'];

function keyOf(pat) {
  const { pieces, orientation } = pat.patternData.CORNERS;
  return `${pieces.join('')}|${orientation.join('')}`;
}

function invertMoveStr(m) {
  if (m.endsWith('2')) return m;
  if (m.endsWith("'")) return m[0];
  return `${m}'`;
}

function invertSeq(seq) {
  if (!seq) return '';
  return seq.trim().split(/\s+/).reverse().map(invertMoveStr).join(' ');
}

// Curated community EG-1 / EG-2 speedcubing triggers & algorithms (tested against KPuzzle states!)
const COMMUNITY_EG_ALGS = [
  // Famous EG-1 triggers & algs
  "R U' R' U' R U' R' U F' U' F",
  "R' F R2 U' R2 F R",
  "R' F R U' R' F R2 U' R'",
  "R U' R2 F R2 U' R'",
  "F R' F' R U R U' R'",
  "R U R' U' R' F R F'",
  "R U' R' U2 F R U' R' F'",
  "F' U R U' R2 F2 R U' R'",
  "R U R' F' R U R' U' R' F R2 U' R'",
  "R' U R' U' R2 U' F R' F' R2",
  "R U' R' U R U' R' F R' F' R",
  "R U R2 F' R U R U' R'",
  "F R U' R' U R U2 R' U' F'",
  "R U' R2 F R U R U2 R'",
  "R U2 R' F2 R U2 R'",
  "R U' R F2 R' U R'",
  "F' U2 R U2 R' U2 F",
  "R' U' R U' R' U2 R",
  "R U2 R' U' R U' R'",
  "F R U R' U' F'",
  "F R U R' U' R U R' U' F'",
  "R2 U2 R U2 R2",
  "R U2 R' U' R U R' U' R U' R'",
  "F R' F' R U2 R U2 R'",
  "R U R' U2 R U' R' U R U' R'",
  "R' F R F' U2 R U R'",
  "R' F R F' R U R'",
  "U R' F R F' R U R'",
  "F U' R U2 R' U2 R U' R' F'",
  "R2 U R2 U' R2 F R' F' R",
  "R U' R2 F2 U' F2 R2 U R'",
  // Famous EG-2 algs (including Anti-CLL combos and short RUF)
  "R2 F2 R2",
  "F R U' R' U' R U R' F' R U R' U' R' F R F'",
  "R U' R' U' F2 U' R U R' U F2",
  "R U2 R' F2 R U' R'",
  "F' U R U' R' F2 R U' R'",
  "R' F2 R U' R' U F2 R",
  "F R' F' R U2 R U' R' F R' F' R",
  "R2 B2 R' U R' U' R2 B2 R2",
  "R U' R' U F' R U R' U' R' F R2 U' R'"
];

function scoreErgonomics(algStr) {
  const moves = algStr.trim().split(/\s+/).filter(Boolean);
  let fCount = 0;
  let twoCount = 0;
  let rCount = 0;
  let uCount = 0;
  for (const m of moves) {
    if (m.startsWith('F')) fCount++;
    if (m.endsWith('2')) twoCount++;
    if (m.startsWith('R')) rCount++;
    if (m.startsWith('U')) uCount++;
  }
  // Prefer shorter algs with fewer F moves and balanced RU ergonomics
  return moves.length * 10 + fCount * 3.5 + twoCount * 0.8 - (rCount + uCount) * 0.2;
}

async function main() {
  const kp = await puzzles['2x2x2'].kpuzzle();
  const def = kp.defaultPattern();
  const solvedPats = ORIENT_ROTS.map(r => (r ? def.applyAlg(new Alg(r)) : def));
  const solvedKeys = new Map();
  for (const sp of solvedPats) {
    solvedKeys.set(keyOf(sp), sp);
  }

  // Build Meet-in-the-Middle table of <R, U, F> depth <= 5
  console.log('Building <R, U, F> BFS table (depth <= 5)...');
  const fwd = new Map(); // key -> { pat, seq }
  fwd.set(keyOf(def), { pat: def, seq: '' });
  const queue = [{ pat: def, seq: '', depth: 0, lastFace: '' }];

  // Also pre-collect all solved-rot keys -> sequence to reach ANY solved rotation
  while (queue.length > 0) {
    const { pat, seq, depth, lastFace } = queue.shift();
    if (depth >= 5) continue;
    for (const m of RUF_MOVES) {
      if (m[0] === lastFace) continue;
      const np = pat.applyAlg(new Alg(m));
      const k = keyOf(np);
      const nseq = seq ? `${seq} ${m}` : m;
      if (!fwd.has(k)) {
        fwd.set(k, { pat: np, seq: nseq });
        queue.push({ pat: np, seq: nseq, depth: depth + 1, lastFace: m[0] });
      }
    }
  }
  console.log(`BFS table size (depth <= 5): ${fwd.size} states`);

  // Index inverses: for each solved rotation S and each fwd sequence `tail`,
  // applying `tail` from `S.applyAlg(inv(tail))` reaches solved rotation S!
  // We store `tailStartKey -> { tail, score }` (keeping best tail per start key).
  const tailLookup = new Map();
  for (const [, { seq }] of fwd) {
    if (!seq) {
      for (const sk of solvedKeys.keys()) {
        if (!tailLookup.has(sk)) tailLookup.set(sk, '');
      }
      continue;
    }
    const invTail = invertSeq(seq);
    const invAlg = new Alg(invTail);
    for (const sp of solvedPats) {
      const startPat = sp.applyAlg(invAlg);
      const sk = keyOf(startPat);
      const cur = tailLookup.get(sk);
      if (cur === undefined || scoreErgonomics(seq) < scoreErgonomics(cur)) {
        tailLookup.set(sk, seq);
      }
    }
  }
  console.log(`Meet-in-the-middle tail lookup size: ${tailLookup.size} states`);

  function solveStateRuf(statePat, { limit = 4 } = {}) {
    const results = new Map(); // normalized -> { alg, startAuf, score, isAntiCll? }

    // Try community algs across AUFs first
    for (const cand of COMMUNITY_EG_ALGS) {
      let parsed;
      try { parsed = new Alg(cand); } catch { continue; }
      for (const startAuf of AUF_LIST) {
        const withAuf = startAuf ? statePat.applyAlg(new Alg(startAuf)) : statePat;
        const after = withAuf.applyAlg(parsed);
        let ok = false;
        for (const endAuf of AUF_LIST) {
          const finalPat = endAuf ? after.applyAlg(new Alg(endAuf)) : after;
          if (solvedKeys.has(keyOf(finalPat))) {
            ok = true;
            break;
          }
        }
        if (ok) {
          const cleanStr = cand.replace(/\s+/g, ' ').trim();
          const key = `${startAuf}|${cleanStr}`;
          if (!results.has(key)) {
            results.set(key, {
              alg: cleanStr,
              startAuf,
              note: 'Speedcubing <R, U, F> alg',
              score: scoreErgonomics(cleanStr) - (startAuf ? 0 : 1.5)
            });
          }
        }
      }
    }

    // Meet-in-the-middle search up to depth 10 (<R, U, F>) across start AUFs
    for (const startAuf of AUF_LIST) {
      const base = startAuf ? statePat.applyAlg(new Alg(startAuf)) : statePat;
      // Only search prefixes up to depth 5
      for (const [, { seq: headSeq }] of fwd) {
        const midPat = headSeq ? base.applyAlg(new Alg(headSeq)) : base;
        const tailSeq = tailLookup.get(keyOf(midPat));
        if (tailSeq !== undefined) {
          const combined = [headSeq, tailSeq].filter(Boolean).join(' ').trim();
          if (!combined) continue;
          // Cancel obvious adjacent same-face moves if any
          const moves = combined.split(/\s+/);
          let hasSameFace = false;
          for (let i = 1; i < moves.length; i++) {
            if (moves[i][0] === moves[i - 1][0]) { hasSameFace = true; break; }
          }
          if (hasSameFace) continue;
          const k = `${startAuf}|${combined}`;
          const sc = scoreErgonomics(combined) + (startAuf ? 1.5 : 0);
          if (!results.has(k)) {
            results.set(k, {
              alg: combined,
              startAuf,
              note: startAuf ? `Start AUF ${startAuf} · Optimal <R, U, F>` : 'Ergonomic <R, U, F>',
              score: sc
            });
          }
        }
      }
      // Early stop if we already found good <=9m no-AUF solutions
      const bestNoAuf = [...results.values()].filter(r => !r.startAuf && r.alg.split(' ').length <= 9);
      if (bestNoAuf.length >= 3) break;
    }

    const sorted = [...results.values()].sort((a, b) => a.score - b.score);
    // Deduplicate identical move strings across AUFs
    const picked = [];
    const seenAlg = new Set();
    for (const item of sorted) {
      if (seenAlg.has(item.alg)) continue;
      seenAlg.add(item.alg);
      picked.push(item);
      if (picked.length >= limit) break;
    }
    return picked;
  }

  // Helper: compose a CLL case state with a bottom permutation (leaving D oriented = 0)
  function makeEgState(cllSetup, bottomSwapAlg) {
    // Wait: we want the EXACT U-layer corner pieces & orientations from CLL `cllSetup`,
    // combined with the target D-layer corner permutation (`bottomPieces`, ori = [0,0,0,0]).
    const cllPat = def.applyAlg(new Alg(cllSetup));
    const { pieces: uP, orientation: uO } = cllPat.patternData.CORNERS;
    // Construct KPuzzle pattern JSON directly, or find a setup producing it!
    // Even cleaner: apply `cllSetup` and THEN apply `bottomSwapAlg` if it keeps D=[...],
    // Wait: applying CLL setup FIRST solves D=[4,5,6,7], so composing `(D swap) + (CLL setup)`?
    // Beware: `CLL setup` acts on the cube and returns pieces 4,5,6,7 to slots 4,5,6,7!
    // Wait: if we apply `CLL_alg` first (`inv(cllSetup)`), corners 0..3 stay in 0..3 and 4..7 stay in 4..7 ONLY if CLL leaves D fixed.
    // Let's check whether every CLL case setup leaves D=[4,5,6,7], ori=[0,0,0,0]!
    return { cllPat, uP, uO };
  }

  // Verify whether CLL setups leave D untouched or rotated!
  const cleanCllData = [];
  for (const c of cllCases) {
    const p = def.applyAlg(new Alg(c.setup));
    const dPieces = p.patternData.CORNERS.pieces.slice(4);
    const dOri = p.patternData.CORNERS.orientation.slice(4);
    cleanCllData.push({ c, p, dPieces, dOri });
  }
  const allCllKeepD = cleanCllData.every(x =>
    x.dPieces.every((v, i) => v === i + 4) && x.dOri.every(o => o === 0)
  );
  console.log('Do all CLL setups leave D=[4,5,6,7] fixed?', allCllKeepD);

  // Build exact KPuzzle state using Pattern cloning!
  function buildPatternWithD(cllPat, targetDPieces) {
    const data = structuredClone(cllPat.patternData);
    // Normalize D if CLL setup had D shifted/rotated — re-apply whole-cube U/D alignment first
    // Find solved orientation where D pieces are [4,5,6,7] ori [0,0,0,0] on CLL pattern
    let alignedCll = null;
    for (const sp of solvedPats) {
      // Check if cllPat has 4 bottom corners matching some face! Instead, map bottom corner #5 (DFL=5) orientation
    }
    // Wait: first find a pure U/D alignment for cllPat so its D layer matches def's D=[4,5,6,7], ori=[0,0,0,0]!
    const d4Idx = data.CORNERS.pieces.indexOf(4);
    const d4Ori = data.CORNERS.orientation[d4Idx];
    // Actually check if all CLL cases already have fixed D = [4,5,6,7]:
    data.CORNERS.pieces[4] = targetDPieces[0];
    data.CORNERS.pieces[5] = targetDPieces[1];
    data.CORNERS.pieces[6] = targetDPieces[2];
    data.CORNERS.pieces[7] = targetDPieces[3];
    data.CORNERS.orientation[4] = 0;
    data.CORNERS.orientation[5] = 0;
    data.CORNERS.orientation[6] = 0;
    data.CORNERS.orientation[7] = 0;
    return def.constructor ? new def.constructor(kp, data) : def;
  }

  // Test normalizing every CLL case so its bottom layer is solved ([4,5,6,7], [0,0,0,0])
  function getSolvedDCllPattern(cllCase) {
    const rawPat = def.applyAlg(new Alg(cllCase.setup));
    const dPieces = rawPat.patternData.CORNERS.pieces.slice(4);
    const dOri = rawPat.patternData.CORNERS.orientation.slice(4);
    if (dPieces.every((v, i) => v === i + 4) && dOri.every(o => o === 0)) {
      return rawPat;
    }
    // Rotate whole cube / D until piece 4,5,6,7 sit at slots 4,5,6,7 with ori 0
    for (const r of ORIENT_ROTS) {
      for (const dAuf of ['', 'D', "D'", 'D2']) {
        const test = def.applyAlg(new Alg(cllCase.setup)).applyAlg(new Alg([r, dAuf].filter(Boolean).join(' ') || "U U'"));
        const dp = test.patternData.CORNERS.pieces.slice(4);
        const do_ = test.patternData.CORNERS.orientation.slice(4);
        if (dp.every((v, i) => v === i + 4) && do_.every(o => o === 0)) {
          return test;
        }
      }
    }
    throw new Error(`Could not align D layer for CLL ${cllCase.id}`);
  }

  const GROUP_ORDER = ['H-Group', 'P-Group', 'U-Group', 'T-Group', 'L-Group', 'S-Group', 'A-Group'];
  const orderedCll = GROUP_ORDER.flatMap(g => cllCases.filter(c => c.group === g));

  const eg1Cases = [];
  const eg2Cases = [];

  // Target bottom layers:
  // EG-1 Back Bar (DBL=6, DBR=7 solved; DFR<->DFL swapped): [5, 4, 6, 7]
  // EG-2 Diag Swap (DFL<->DBR swapped, DFR=4 & DBL=6 in place): [4, 7, 6, 5]
  for (const cllCase of orderedCll) {
    const baseCllPat = getSolvedDCllPattern(cllCase);

    // 1. EG-1
    const eg1TargetPat = buildPatternWithD(baseCllPat, [5, 4, 6, 7]);
    const eg1Sols = solveStateRuf(eg1TargetPat, { limit: 3 });
    if (eg1Sols.length === 0) {
      throw new Error(`No EG-1 solution found within depth 10 for ${cllCase.id}`);
    }
    // Re-center `setup` so the #1 default algorithm always starts at `startAuf: ""`
    // (`U` pre-AUF never disturbs the D-layer Back Bar or Diagonal state).
    const eg1Primary = eg1Sols[0];
    const eg1AlignedPat = eg1Primary.startAuf ? eg1TargetPat.applyAlg(new Alg(eg1Primary.startAuf)) : eg1TargetPat;
    const eg1SolsRaw = solveStateRuf(eg1AlignedPat, { limit: 6 });
    const eg1Chosen = eg1SolsRaw.find(s => !s.startAuf) || { ...eg1Primary, startAuf: '' };
    const eg1SolsCentered = [eg1Chosen, ...eg1SolsRaw.filter(s => s.alg !== eg1Chosen.alg)].slice(0, 3);
    const eg1Setup = invertSeq(eg1Chosen.alg);
    // Verify setup produces exact [5,4,6,7] D layer
    const checkEg1Pat = def.applyAlg(new Alg(eg1Setup));
    if (checkEg1Pat.patternData.CORNERS.pieces.slice(4).join(',') !== '5,4,6,7') {
      throw new Error(`EG-1 setup D mismatch on ${cllCase.id}`);
    }

    eg1Cases.push({
      id: `EG1-${cllCase.id}`,
      name: `EG-1 ${cllCase.id} (${cllCase.group})`,
      shortName: `EG1-${cllCase.id}`,
      group: cllCase.group,
      cllCounterpart: cllCase.id,
      bottomState: 'adj-back',
      setup: eg1Setup,
      description: `EG-1 ${cllCase.id}: Solved Back Bar (DBL+DBR) on bottom with adjacent swap in front (DFL↔DFR). Recognition mirrors CLL ${cllCase.id}.`,
      algs: eg1SolsCentered.map((s, idx) => ({
        id: `EG1-${cllCase.id}-${idx + 1}`,
        alg: s.alg,
        note: idx === 0 ? 'Recommended <R, U, F>' : s.note,
        isDefault: idx === 0,
        startAuf: idx === 0 ? '' : (s.startAuf || '')
      }))
    });

    // 2. EG-2
    const eg2TargetPat = buildPatternWithD(baseCllPat, [4, 7, 6, 5]);
    const eg2SolsPre = solveStateRuf(eg2TargetPat, { limit: 3 });
    if (eg2SolsPre.length === 0) {
      throw new Error(`No EG-2 solution found within depth 10 for ${cllCase.id}`);
    }
    const eg2PrimaryPre = eg2SolsPre[0];
    const eg2AlignedPat = eg2PrimaryPre.startAuf ? eg2TargetPat.applyAlg(new Alg(eg2PrimaryPre.startAuf)) : eg2TargetPat;
    const eg2SolsRaw = solveStateRuf(eg2AlignedPat, { limit: 6 });
    const eg2Chosen = eg2SolsRaw.find(s => !s.startAuf) || { ...eg2PrimaryPre, startAuf: '' };
    const eg2Sols = [eg2Chosen, ...eg2SolsRaw.filter(s => s.alg !== eg2Chosen.alg)].slice(0, 2);

    // Also compute Anti-CLL variant: find if `cllAlg + R2 F2 R2` (or `R2 F2 R2` alt) works from some startAuf
    const defaultCllAlg = cllCase.algs?.[0]?.alg || '';
    if (defaultCllAlg && eg2Sols.length < 3) {
      const antiCand = `${defaultCllAlg} R2 F2 R2`;
      try {
        const parsedAnti = new Alg(antiCand);
        for (const sa of AUF_LIST) {
          const testBase = sa ? eg2AlignedPat.applyAlg(new Alg(sa)) : eg2AlignedPat;
          const after = testBase.applyAlg(parsedAnti);
          let ok = false;
          for (const ea of AUF_LIST) {
            const fp = ea ? after.applyAlg(new Alg(ea)) : after;
            if (solvedKeys.has(keyOf(fp))) { ok = true; break; }
          }
          if (ok && !eg2Sols.some(x => x.alg === antiCand)) {
            eg2Sols.push({
              alg: antiCand,
              startAuf: sa,
              note: `Anti-CLL (${cllCase.id} + R2 F2 R2)`,
              score: 999
            });
            break;
          }
        }
      } catch {}
    }

    const eg2Primary = eg2Sols[0];
    const eg2Setup = invertSeq(eg2Primary.alg);
    const checkEg2Pat = def.applyAlg(new Alg(eg2Setup));
    // Verify EG-2 setup produces diagonal bottom swap [4,7,6,5]
    const dP2 = checkEg2Pat.patternData.CORNERS.pieces.slice(4);
    const dO2 = checkEg2Pat.patternData.CORNERS.orientation.slice(4);
    if (dP2.join(',') !== '4,7,6,5' || !dO2.every(o => o === 0)) {
      throw new Error(`EG-2 setup D mismatch on ${cllCase.id}: ${dP2.join(',')} ori ${dO2.join(',')}`);
    }

    eg2Cases.push({
      id: `EG2-${cllCase.id}`,
      name: `EG-2 ${cllCase.id} (${cllCase.group})`,
      shortName: `EG2-${cllCase.id}`,
      group: cllCase.group,
      cllCounterpart: cllCase.id,
      bottomState: 'diag',
      setup: eg2Setup,
      description: `EG-2 ${cllCase.id}: Diagonal swap on bottom (no bars). Use short <R, U, F> EG-2 algs or Anti-CLL (${cllCase.id} + R2 F2 R2).`,
      algs: eg2Sols.slice(0, 3).map((s, idx) => ({
        id: `EG2-${cllCase.id}-${idx + 1}`,
        alg: s.alg,
        note: idx === 0 && !String(s.note).startsWith('Anti-CLL') ? 'Recommended <R, U, F>' : s.note,
        isDefault: idx === 0,
        startAuf: idx === 0 ? '' : (s.startAuf || '')
      }))
    });
  }

  const outContent = `// 2x2x2 EG-1 (40 Cases: Back Bar D=[5,4,6,7]) & EG-2 (40 Cases: Diag Bottom Swap D=[4,7,6,5])
// Generated and mathematically verified against cubing.js 2x2x2 KPuzzle

export const eg1Cases = ${JSON.stringify(eg1Cases, null, 2)};

export const eg1CaseById = new Map(eg1Cases.map(c => [c.id, c]));

export const eg2Cases = ${JSON.stringify(eg2Cases, null, 2)};

export const eg2CaseById = new Map(eg2Cases.map(c => [c.id, c]));
`;

  fs.writeFileSync(OUT_PATH, outContent, 'utf8');
  console.log(`Wrote ${eg1Cases.length} EG-1 and ${eg2Cases.length} EG-2 cases to ${OUT_PATH}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
