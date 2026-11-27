import test from 'node:test';
import assert from 'node:assert/strict';
import { puzzles } from 'cubing/puzzles';
import { Alg } from 'cubing/alg';

import { cleanAlg } from '../src/algParser.js';
import { cllCases } from '../src/data/cllData.js';
import { eg1Cases, eg2Cases } from '../src/data/egData.js';
import { ortegaCases } from '../src/data/ortegaData.js';
import { lbl222Cases } from '../src/data/lbl222Data.js';
import { f2lCases } from '../src/data/f2lData.js';
import { ollCases } from '../src/data/ollData.js';
import { pllCases } from '../src/data/pllData.js';
import { parity444Cases, parity555Cases } from '../src/data/parityData.js';
import { FIRST_LAYER_BAR_CASES, FIRST_LAYER_TWO_LOOK } from '../src/data/firstLayerBarData.js';
import {
  FIRST_LAYER_ONE_BOTTOM_CASES,
  FIRST_LAYER_BAR_PURE_CASES,
  FIRST_LAYER_DIAG_CASES,
  FIRST_LAYER_THREE_BOTTOM_CASES
} from '../src/data/firstLayerBottomData.js';
import { auditAllFirstLayerAlgs } from '../src/cube/firstLayerVerifier.js';
import { FIRST_FACE_EXAMPLES } from '../src/features/study/firstLayerExplorer.js';
import { getEffectiveAlgsForCase, hasSliceMoves, hasBMoves } from '../src/cube/algMirror.js';
import { TIMER_DRILL_PRESETS } from '../src/ui/navController.js';

const U_AUFS = ['', 'U', "U'", 'U2'];
const Y_AUFS = ['', 'y', "y'", 'y2'];
const ROT_24 = [];
for (const a of ['', 'x', "x'", 'x2', 'z', "z'"]) {
  for (const b of Y_AUFS) {
    ROT_24.push([a, b].filter(Boolean).join(' '));
  }
}

function joinMoves(...parts) {
  return cleanAlg(parts.filter(Boolean).join(' '));
}

function isIdenticalUpToUY(pattern, solved, { allowY = false, allowAnyRot = false } = {}) {
  const rotOpts = allowAnyRot ? ROT_24 : (allowY ? Y_AUFS : ['']);
  for (const u of U_AUFS) {
    const p1 = u ? pattern.applyAlg(u) : pattern;
    for (const r of rotOpts) {
      const p2 = r ? p1.applyAlg(r) : p1;
      if (p2.isIdentical(solved)) return true;
    }
  }
  return false;
}

// 2x2 OLL check: either standard (yellow-up, white-down) or z2 (white-down after z2).
// Checks D corners remain solved on bottom layer AND U corners all have orientation 0.
function is2x2OllSolved(pattern, solved, { isZ2 = false, allowBottomPerm = false } = {}) {
  const base = isZ2 ? solved.applyAlg('z2') : solved;
  const expectedD = Array.from(base.patternData.CORNERS.pieces).slice(4, 8);
  const pieces = Array.from(pattern.patternData.CORNERS.pieces);
  const ori = Array.from(pattern.patternData.CORNERS.orientation);

  // All 4 D corners must sit on D with ori === 0
  if (allowBottomPerm) {
    const dSet = new Set(expectedD);
    for (let i = 4; i < 8; i++) {
      if (!dSet.has(pieces[i]) || ori[i] !== 0) return false;
    }
  } else {
    // Allow whole-D or U-relative alignment; on 2x2 LBL OLL, D stays fixed [4..7]
    const dPieces = pieces.slice(4, 8);
    const dMatch = [0, 1, 2, 3].some(shift =>
      [0, 1, 2, 3].every(i => dPieces[i] === expectedD[(i + shift) % 4] && ori[4 + i] === 0)
    );
    if (!dMatch) return false;
  }

  // All 4 U corners oriented
  return ori.slice(0, 4).every(o => o === 0);
}

// 3x3 F2L solved: bottom cross + 4 F2L slots solved, allowing y rotations (edges 4..11, corners 4..7, centers un-rotated or up to U/y).
function is3x3F2lSolved(pattern, solved, { isZ2 = false } = {}) {
  const target = isZ2 ? solved.applyAlg('z2') : solved;
  const expEdges = Array.from(target.patternData.EDGES.pieces);
  const expEdgeOri = Array.from(target.patternData.EDGES.orientation);
  const expCorners = Array.from(target.patternData.CORNERS.pieces);
  const expCornerOri = Array.from(target.patternData.CORNERS.orientation);

  for (const y of Y_AUFS) {
    const p = y ? pattern.applyAlg(y) : pattern;
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

// 3x3 OLL solved: F2L solved AND U corners (0..3) & U edges (0..3) all have orientation === 0.
function is3x3OllSolved(pattern, solved, { isZ2 = false } = {}) {
  for (const y of Y_AUFS) {
    const p = y ? pattern.applyAlg(y) : pattern;
    const target = isZ2 ? solved.applyAlg('z2') : solved;
    const expEdges = target.patternData.EDGES.pieces;
    const expEdgeOri = target.patternData.EDGES.orientation;
    const expCorners = target.patternData.CORNERS.pieces;
    const expCornerOri = target.patternData.CORNERS.orientation;

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

test('2x2x2: CLL (40 cases × all scrambles × all algs, bare and z2)', async () => {
  const kp = await puzzles['2x2x2'].kpuzzle();
  const solved = kp.defaultPattern();

  assert.strictEqual(cllCases.length, 40);
  for (const c of cllCases) {
    const scrambles = Array.from(new Set([c.setup, ...(c.scrambles || [])].filter(Boolean)));
    assert.ok(scrambles.length > 0, `CLL ${c.id} missing scrambles`);
    for (const s of scrambles) {
      for (const a of c.algs) {
        const exec = joinMoves(a.startAuf, a.alg);
        const stBare = solved.applyAlg(joinMoves(s, exec));
        assert.ok(
          isIdenticalUpToUY(stBare, solved, { allowAnyRot: true }),
          `CLL bare failed: ${c.id} | scr="${s}" | alg=${a.id} ("${exec}")`
        );
        const stZ2 = solved.applyAlg(joinMoves('z2', s, exec));
        assert.ok(
          isIdenticalUpToUY(stZ2, solved.applyAlg('z2'), { allowAnyRot: true }),
          `CLL z2 failed: ${c.id} | scr="${s}" | alg=${a.id} ("${exec}")`
        );
      }
    }
  }
});

test('2x2x2: EG-1 (40 cases) and EG-2 (40 cases) setups and algs, bare and z2', async () => {
  const kp = await puzzles['2x2x2'].kpuzzle();
  const solved = kp.defaultPattern();

  assert.strictEqual(eg1Cases.length, 40);
  assert.strictEqual(eg2Cases.length, 40);

  for (const c of [...eg1Cases, ...eg2Cases]) {
    const scrambles = Array.from(new Set([c.setup, ...(c.scrambles || [])].filter(Boolean)));
    assert.ok(scrambles.length > 0, `EG ${c.id} missing setup/scrambles`);
    for (const s of scrambles) {
      for (const a of c.algs) {
        const exec = joinMoves(a.startAuf, a.alg);
        const stBare = solved.applyAlg(joinMoves(s, exec));
        assert.ok(
          isIdenticalUpToUY(stBare, solved, { allowY: true }),
          `EG bare failed: ${c.id} | scr="${s}" | alg=${a.id} ("${exec}")`
        );
        const stZ2 = solved.applyAlg(joinMoves('z2', s, exec));
        assert.ok(
          isIdenticalUpToUY(stZ2, solved.applyAlg('z2'), { allowY: true }),
          `EG z2 failed: ${c.id} | scr="${s}" | alg=${a.id} ("${exec}")`
        );
      }
    }
  }
});

test('2x2x2: Ortega (OLL + PBL) and LBL (OLL + PLL) cases × scrambles × algs', async () => {
  const kp = await puzzles['2x2x2'].kpuzzle();
  const solved = kp.defaultPattern();

  for (const c of [...ortegaCases, ...lbl222Cases]) {
    const isOll = c.id.includes('-oll-');
    const isPbl = c.id.includes('-pbl-');
    const scrambles = Array.from(new Set([c.setup, ...(c.scrambles || [])].filter(Boolean)));
    assert.ok(scrambles.length > 0, `${c.id} missing setup/scrambles`);

    for (const s of scrambles) {
      for (const a of c.algs) {
        const exec = joinMoves(a.startAuf, a.alg);
        const stBare = solved.applyAlg(joinMoves(s, exec));
        const stZ2 = solved.applyAlg(joinMoves('z2', s, exec));

        if (isOll) {
          assert.ok(
            is2x2OllSolved(stBare, solved, { isZ2: false, allowBottomPerm: false }),
            `2x2 OLL bare failed: ${c.id} | scr="${s}" | alg=${a.id}`
          );
          assert.ok(
            is2x2OllSolved(stZ2, solved, { isZ2: true, allowBottomPerm: false }),
            `2x2 OLL z2 failed: ${c.id} | scr="${s}" | alg=${a.id}`
          );
        } else if (isPbl) {
          // PBL solves up to independent D/U AUF
          const pblOk = pattern => {
            for (const d of ['', 'D', "D'", 'D2']) {
              const p = d ? pattern.applyAlg(d) : pattern;
              if (isIdenticalUpToUY(p, pattern === stZ2 ? solved.applyAlg('z2') : solved, { allowY: true })) {
                return true;
              }
            }
            return false;
          };
          assert.ok(pblOk(stBare), `Ortega PBL bare failed: ${c.id} | scr="${s}" | alg=${a.id}`);
          assert.ok(pblOk(stZ2), `Ortega PBL z2 failed: ${c.id} | scr="${s}" | alg=${a.id}`);
        } else {
          assert.ok(
            isIdenticalUpToUY(stBare, solved, { allowY: true }),
            `LBL PLL bare failed: ${c.id} | scr="${s}" | alg=${a.id} ("${exec}")`
          );
          assert.ok(
            isIdenticalUpToUY(stZ2, solved.applyAlg('z2'), { allowY: true }),
            `LBL PLL z2 failed: ${c.id} | scr="${s}" | alg=${a.id} ("${exec}")`
          );
        }
      }
    }
  }
});

test('2x2x2: First Layer Bar-on-Left (75 cases + 13 2-Look mini-cases) and FIRST_FACE_EXAMPLES (6 cases)', async () => {
  const kp = await puzzles['2x2x2'].kpuzzle();
  const solved = kp.defaultPattern();
  const z2Solved = solved.applyAlg('z2');

  // 75 Bar-on-Left cases: setup + fullRuAlg / fullTriggerAlg must solve bottom layer (D=[4,5,6,7] fixed / [3,0,1,2] after z2)
  assert.strictEqual(FIRST_LAYER_BAR_CASES.length, 75);
  for (const c of FIRST_LAYER_BAR_CASES) {
    assert.ok(c.fullRuAlg, `Bar-on-Left missing fullRuAlg: ${c.id}`);
    const variants = [['RU', c.fullRuAlg]];
    if (c.fullTriggerAlg) variants.push(['Trigger', c.fullTriggerAlg]);
    for (const [kind, algStr] of variants) {
      const checkLayerSolved = (pattern, base) => {
        const expD = Array.from(base.patternData.CORNERS.pieces).slice(4, 8);
        const dp = Array.from(pattern.patternData.CORNERS.pieces).slice(4, 8);
        const dori = Array.from(pattern.patternData.CORNERS.orientation).slice(4, 8);
        return expD.every((p, i) => dp[i] === p && dori[i] === 0);
      };
      assert.ok(
        checkLayerSolved(solved.applyAlg(joinMoves(c.setup, algStr)), solved),
        `Bar-on-Left bare failed: ${c.id} (${kind})`
      );
      assert.ok(
        checkLayerSolved(solved.applyAlg(joinMoves('z2', c.setup, algStr)), z2Solved),
        `Bar-on-Left z2 failed: ${c.id} (${kind})`
      );
    }
  }

  // 1-in-Bottom (9) — full 1st layer solved (bar step + finish step)
  assert.strictEqual(FIRST_LAYER_ONE_BOTTOM_CASES.length, 9);
  for (const c of FIRST_LAYER_ONE_BOTTOM_CASES) {
    const checkFull = (pattern, base) => {
      const expD = Array.from(base.patternData.CORNERS.pieces).slice(4, 8);
      const dp = Array.from(pattern.patternData.CORNERS.pieces).slice(4, 8);
      const dori = Array.from(pattern.patternData.CORNERS.orientation).slice(4, 8);
      return expD.every((p, i) => dp[i] === p && dori[i] === 0);
    };
    assert.ok(checkFull(solved.applyAlg(joinMoves(c.setup, c.fullAlg)), solved), `1-in-Bottom bare full solve failed: ${c.id}`);
    assert.ok(checkFull(solved.applyAlg(joinMoves('z2', c.setup, c.fullAlg)), z2Solved), `1-in-Bottom z2 full solve failed: ${c.id}`);
  }

  // Comprehensive sticker-level bottom face all-White + bottom row check across every 1st-layer & 1st-face case
  const layerAudit = auditAllFirstLayerAlgs(kp, {
    oneBottom: FIRST_LAYER_ONE_BOTTOM_CASES,
    twoBar: FIRST_LAYER_BAR_PURE_CASES,
    twoDiag: FIRST_LAYER_DIAG_CASES,
    threeBottom: FIRST_LAYER_THREE_BOTTOM_CASES,
    barAll: FIRST_LAYER_BAR_CASES,
    twoLook: FIRST_LAYER_TWO_LOOK,
    firstFaceExamples: FIRST_FACE_EXAMPLES
  });
  assert.ok(
    layerAudit.ok,
    `1st-layer sticker audit failed (${layerAudit.failures.length}): ${JSON.stringify(layerAudit.failures.slice(0, 3))}`
  );

  assert.strictEqual(FIRST_LAYER_DIAG_CASES.length, 39);
  for (const c of FIRST_LAYER_DIAG_CASES) {
    const checkFull = (pattern, base) => {
      const expD = Array.from(base.patternData.CORNERS.pieces).slice(4, 8);
      const dp = Array.from(pattern.patternData.CORNERS.pieces).slice(4, 8);
      const dori = Array.from(pattern.patternData.CORNERS.orientation).slice(4, 8);
      return expD.every((p, i) => dp[i] === p && dori[i] === 0);
    };
    assert.ok(checkFull(solved.applyAlg(joinMoves(c.setup, c.fullAlg)), solved), `2-Diagonal bare failed: ${c.id}`);
    assert.ok(checkFull(solved.applyAlg(joinMoves('z2', c.setup, c.fullAlg)), z2Solved), `2-Diagonal z2 failed: ${c.id}`);
  }

  // 2-Look mini cases: bpCases solve DBL(6), DFL(5), DBR(7); fpFinishes solve all 4 D corners
  for (const bp of FIRST_LAYER_TWO_LOOK.optionA.bpCases) {
    const checkBp = (pattern, base) => {
      const exp = Array.from(base.patternData.CORNERS.pieces);
      const cp = Array.from(pattern.patternData.CORNERS.pieces);
      const co = Array.from(pattern.patternData.CORNERS.orientation);
      return [5, 6, 7].every(slot => cp[slot] === exp[slot] && co[slot] === 0);
    };
    assert.ok(checkBp(solved.applyAlg(joinMoves(bp.setup, bp.alg)), solved), `2-Look BP bare failed: ${bp.id}`);
    assert.ok(checkBp(solved.applyAlg(joinMoves('z2', bp.setup, bp.alg)), z2Solved), `2-Look BP z2 failed: ${bp.id}`);
  }
  for (const fp of FIRST_LAYER_TWO_LOOK.optionA.fpFinishes) {
    const checkFp = (pattern, base) => {
      const exp = Array.from(base.patternData.CORNERS.pieces);
      const cp = Array.from(pattern.patternData.CORNERS.pieces);
      const co = Array.from(pattern.patternData.CORNERS.orientation);
      return [4, 5, 6, 7].every(slot => cp[slot] === exp[slot] && co[slot] === 0);
    };
    assert.ok(checkFp(solved.applyAlg(joinMoves(fp.setup, fp.alg)), solved), `2-Look FP bare failed: ${fp.label}`);
    assert.ok(checkFp(solved.applyAlg(joinMoves('z2', fp.setup, fp.alg)), z2Solved), `2-Look FP z2 failed: ${fp.label}`);
  }

  // FIRST_FACE_EXAMPLES: every example finishes White bottom face with exact target bar/layer geometry and accurate moveCount
  assert.strictEqual(FIRST_FACE_EXAMPLES.length, 6);
  const nextOf = { 3: 0, 0: 1, 1: 2, 2: 3 };
  for (const ex of FIRST_FACE_EXAMPLES) {
    const algMovesCount = Array.from(new Alg(ex.moves).childAlgNodes()).length;
    assert.strictEqual(algMovesCount, ex.moveCount, `${ex.id} moveCount mismatch`);

    const st = solved.applyAlg(joinMoves(ex.scramble, ex.moves));
    const dp = Array.from(st.patternData.CORNERS.pieces).slice(4, 8);
    const dori = Array.from(st.patternData.CORNERS.orientation).slice(4, 8);
    assert.ok(
      dp.every((piece, i) => piece < 4 && dori[i] === 0),
      `${ex.id} broken bottom face: dp=${JSON.stringify(dp)}, ori=${JSON.stringify(dori)}`
    );

    const bars = [];
    if (nextOf[dp[0]] === dp[1]) bars.push('Front');
    if (nextOf[dp[1]] === dp[2]) bars.push('Left');
    if (nextOf[dp[2]] === dp[3]) bars.push('Back');
    if (nextOf[dp[3]] === dp[0]) bars.push('Right');

    if (ex.bottomPerm === 'Layer Solved') {
      assert.strictEqual(bars.length, 4, `${ex.id} expected full solved layer`);
    } else if (ex.bottomPerm === 'Adj Bar') {
      assert.deepStrictEqual(bars, ['Back'], `${ex.id} expected exact Back Bar (DBL+DBR), got ${JSON.stringify(bars)}`);
    } else if (ex.bottomPerm === 'Opp (No Bar)') {
      assert.deepStrictEqual(bars, [], `${ex.id} expected Diagonal Swap (0 bars), got ${JSON.stringify(bars)}`);
    } else {
      assert.fail(`Unexpected bottomPerm: ${ex.bottomPerm}`);
    }
  }
});

test('3x3x3 & 3x3x3 OH (Left/Right × Table/No-Table): F2L (41), OLL (57), PLL (21)', async () => {
  const kp = await puzzles['3x3x3'].kpuzzle();
  const solved = kp.defaultPattern();
  const z2Solved = solved.applyAlg('z2');

  const getAllOhVariants = (trackId, c, trackCases) => {
    const out = [];
    for (const ohHand of ['left', 'right']) {
      for (const ohTableAbuse of [true, false]) {
        const eff = getEffectiveAlgsForCase('333oh', trackId, c, { ohHand, ohTableAbuse, trackCases });
        for (const a of eff) {
          if (!ohTableAbuse) {
            assert.ok(
              !hasSliceMoves(a.alg) && !hasBMoves(a.alg),
              `${trackId} ${c.id} (${ohHand}, no-table) must not contain slice or raw B moves: ${a.alg}`
            );
          }
          out.push(a);
        }
      }
    }
    return out;
  };

  // F2L
  assert.strictEqual(f2lCases.length, 41);
  for (const c of f2lCases) {
    const allF2l = [...c.algs, ...getAllOhVariants('f2l', c, f2lCases)];
    for (const a of allF2l) {
      const effectiveSetup = a.isFlMirror && a.mirroredSetup ? a.mirroredSetup : c.setup;
      const exec = joinMoves(a.startAuf, a.alg);
      assert.ok(
        is3x3F2lSolved(solved.applyAlg(joinMoves(effectiveSetup, exec)), solved),
        `F2L bare/OH failed: ${c.id} | alg=${a.id} | setup="${effectiveSetup}" | exec="${exec}"`
      );
      assert.ok(
        is3x3F2lSolved(solved.applyAlg(joinMoves('z2', effectiveSetup, exec)), solved, { isZ2: true }),
        `F2L z2 failed: ${c.id} | alg=${a.id} | setup="${effectiveSetup}" | exec="${exec}"`
      );
    }
  }

  // OLL
  assert.strictEqual(ollCases.length, 57);
  for (const c of ollCases) {
    const scrambles = Array.from(new Set([c.setup, ...(c.scrambles || [])].filter(Boolean)));
    const allAlgs = [...c.algs, ...getAllOhVariants('oll', c, ollCases)];
    for (const s of scrambles) {
      for (const a of allAlgs) {
        const exec = joinMoves(a.startAuf, a.alg);
        assert.ok(
          is3x3OllSolved(solved.applyAlg(joinMoves(s, exec)), solved),
          `OLL bare failed: ${c.id} | scr="${s}" | alg=${a.id} ("${exec}")`
        );
        assert.ok(
          is3x3OllSolved(solved.applyAlg(joinMoves('z2', s, exec)), solved, { isZ2: true }),
          `OLL z2 failed: ${c.id} | scr="${s}" | alg=${a.id} ("${exec}")`
        );
      }
    }
  }

  // PLL
  assert.strictEqual(pllCases.length, 21);
  for (const c of pllCases) {
    const scrambles = Array.from(new Set([c.setup, ...(c.scrambles || [])].filter(Boolean)));
    const allAlgs = [...c.algs, ...getAllOhVariants('pll', c, pllCases)];
    for (const s of scrambles) {
      for (const a of allAlgs) {
        const exec = joinMoves(a.startAuf, a.alg);
        assert.ok(
          isIdenticalUpToUY(solved.applyAlg(joinMoves(s, exec)), solved, { allowAnyRot: true }),
          `PLL bare failed: ${c.id} | scr="${s}" | alg=${a.id} ("${exec}")`
        );
        assert.ok(
          isIdenticalUpToUY(solved.applyAlg(joinMoves('z2', s, exec)), z2Solved, { allowAnyRot: true }),
          `PLL z2 failed: ${c.id} | scr="${s}" | alg=${a.id} ("${exec}")`
        );
      }
    }
  }
});

test('4x4x4 & 5x5x5 Parity cases × scrambles × algs', async () => {
  for (const [puzzleName, cases] of [['4x4x4', parity444Cases], ['5x5x5', parity555Cases]]) {
    const kp = await puzzles[puzzleName].kpuzzle();
    const solved = kp.defaultPattern();

    for (const c of cases) {
      for (const a of c.algs) {
        // Direct setup must solve with alg + U/y
        const direct = solved.applyAlg(joinMoves(c.setup, a.alg));
        assert.ok(
          isIdenticalUpToUY(direct, solved, { allowY: true }),
          `${puzzleName} direct setup failed: ${c.id} | alg=${a.id}`
        );

        // Preset scrambles (including conjugated U <setup> U' variants) must solve up to U pre-AUF + U/y post-AUF
        for (const s of c.scrambles || []) {
          const solvedWithPreU = U_AUFS.some(pre =>
            isIdenticalUpToUY(solved.applyAlg(joinMoves(s, pre, a.alg)), solved, { allowY: true })
          );
          assert.ok(solvedWithPreU, `${puzzleName} scramble failed: ${c.id} | scr="${s}" | alg=${a.id}`);
        }
      }
    }
  }
});

test('Timer & Handling Drill Presets resolve cleanly with 4-move scramble + reverse solution', async () => {
  const kp = await puzzles['3x3x3'].kpuzzle();
  const solved = kp.defaultPattern();

  for (const [id, preset] of Object.entries(TIMER_DRILL_PRESETS)) {
    const scrMoves = Array.from(new Alg(preset.scramble).childAlgNodes());
    const solMoves = Array.from(new Alg(preset.solution).childAlgNodes());
    assert.strictEqual(scrMoves.length, 4, `Drill ${id} scramble must be 4 moves`);
    assert.strictEqual(solMoves.length, 4, `Drill ${id} solution must be 4 moves`);
    assert.strictEqual(preset.expectedMoves, 4, `Drill ${id} expectedMoves must be 4`);
    assert.ok(
      solved.applyAlg(joinMoves(preset.scramble, preset.solution)).isIdentical(solved),
      `Drill ${id} ("${preset.scramble} ${preset.solution}") did not return 3x3 to solved identity`
    );
  }
});
