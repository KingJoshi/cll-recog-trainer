/**
 * 2x2 First Layer Solver for CLL Practice (Multi-Face / Color Neutral)
 *
 * Uses official WCA puzzle definitions and transformation engines from cubing.js
 * to ensure 100% mathematical fidelity for any valid scramble (including L2, B2, D2, etc.).
 *
 * Finds optimal solutions to solve any selected first layer face (White, Yellow, Green,
 * Blue, Red, Orange) on D (bottom) with matching bottom-side colors (CLL first layer),
 * and accurately identifies the resulting top-layer CLL case (e.g. S1..S6, T1..T6, Solved, PBL, etc.).
 */

import { puzzles } from 'cubing/puzzles';
import { Alg } from 'cubing/alg';
import { cllCases } from './casesData.js';

let solverContextPromise = null;

const PIECE_COLORS = [
    ['white', 'red', 'green'],    // 0: UFR
    ['white', 'blue', 'red'],     // 1: UBR
    ['white', 'orange', 'blue'],  // 2: UBL
    ['white', 'green', 'orange'], // 3: UFL
    ['yellow', 'green', 'red'],   // 4: DFR
    ['yellow', 'orange', 'green'],// 5: DFL
    ['yellow', 'blue', 'orange'], // 6: DBL
    ['yellow', 'red', 'blue']     // 7: DBR
];

const OPPOSITE_COLOR = {
    white: 'yellow',
    yellow: 'white',
    green: 'blue',
    blue: 'green',
    red: 'orange',
    orange: 'red'
};

const CANONICAL_PIECE_MAP = new Map();
PIECE_COLORS.forEach((colors, id) => {
    CANONICAL_PIECE_MAP.set([...colors].sort().join(','), id);
});

const UNROTATE = {
    '1,2,3,0': '',
    '0,1,2,3': "y'",
    '3,0,1,2': 'y2',
    '2,3,0,1': 'y'
};

const FACE_ORDER = { white: 0, yellow: 1, green: 2, blue: 3, red: 4, orange: 5 };

async function getSolverContext() {
    if (!solverContextPromise) {
        solverContextPromise = (async () => {
            const kp = await puzzles['2x2x2'].kpuzzle();
            const def = kp.defaultPattern();
            const moveNames = ['R', 'R2', "R'", 'F', 'F2', "F'", 'U', 'U2', "U'"];
            const moveTrans = {};
            for (const m of moveNames) {
                moveTrans[m] = kp.algToTransformation(new Alg(m));
            }

            const orientations = [
                '', 'y', 'y2', "y'",
                'x', 'x y', 'x y2', "x y'",
                'x2', 'x2 y', 'x2 y2', "x2 y'",
                "x'", "x' y", "x' y2", "x' y'",
                'z', 'z y', 'z y2', "z y'",
                "z'", "z' y", "z' y2", "z' y'"
            ];

            const caseAlgs = [];
            for (const c of cllCases.cases) {
                for (const auf of ['', 'U', 'U2', "U'"]) {
                    const algStr = auf ? auf + ' ' + c.solutionAlg : c.solutionAlg;
                    caseAlgs.push({
                        id: c.id,
                        group: c.group,
                        trans: kp.algToTransformation(new Alg(algStr))
                    });
                }
            }

            return { kp, def, moveNames, moveTrans, orientations, caseAlgs };
        })();
    }
    return solverContextPromise;
}

// Start pre-initializing immediately upon module import
getSolverContext();

function getSolvedBottomLayer(pattern) {
    const d = pattern.patternData['CORNERS'];
    const p = d.pieces;
    const o = d.orientation;

    const s4_d = PIECE_COLORS[p[4]][(3 - o[4]) % 3];
    const s4_f = PIECE_COLORS[p[4]][(4 - o[4]) % 3];
    const s4_r = PIECE_COLORS[p[4]][(5 - o[4]) % 3];

    const s5_d = PIECE_COLORS[p[5]][(3 - o[5]) % 3];
    const s5_l = PIECE_COLORS[p[5]][(4 - o[5]) % 3];
    const s5_f = PIECE_COLORS[p[5]][(5 - o[5]) % 3];

    const s6_d = PIECE_COLORS[p[6]][(3 - o[6]) % 3];
    const s6_b = PIECE_COLORS[p[6]][(4 - o[6]) % 3];
    const s6_l = PIECE_COLORS[p[6]][(5 - o[6]) % 3];

    const s7_d = PIECE_COLORS[p[7]][(3 - o[7]) % 3];
    const s7_r = PIECE_COLORS[p[7]][(4 - o[7]) % 3];
    const s7_b = PIECE_COLORS[p[7]][(5 - o[7]) % 3];

    // All 4 D-stickers must match
    if (s4_d !== s5_d || s4_d !== s6_d || s4_d !== s7_d) return null;

    // Side colors must match around the bottom layer
    if (s4_f !== s5_f || s4_r !== s7_r || s6_b !== s7_b || s5_l !== s6_l) return null;

    return {
        bottom: s4_d,
        top: OPPOSITE_COLOR[s4_d],
        front: s4_f,
        right: s4_r,
        back: s6_b,
        left: s5_l
    };
}

function identifyCaseUniversal(pattern, ctx, layer) {
    if (!layer) return 'Unknown';

    // If bottom is already white, check canonical match directly
    if (layer.bottom === 'white') {
        const data = pattern.patternData['CORNERS'];
        const bottomKey = data.pieces.slice(4).join(',');
        const fixY = UNROTATE[bottomKey];
        const aligned = fixY ? pattern.applyAlg(new Alg(fixY)) : pattern;

        const topOri = aligned.patternData['CORNERS'].orientation.slice(0, 4);
        if (topOri.every(x => x === 0)) {
            const topP = aligned.patternData['CORNERS'].pieces.slice(0, 4).join(',');
            if (topP === '7,4,5,6' || topP === '4,5,6,7' || topP === '5,6,7,4' || topP === '6,7,4,5') {
                return 'Solved';
            }
            return 'PBL';
        }

        for (const item of ctx.caseAlgs) {
            const testP = aligned.applyTransformation(item.trans);
            const td = testP.patternData['CORNERS'];
            if (td.orientation.every(x => x === 0)) {
                const topP = td.pieces.slice(0, 4).join(',');
                if (topP === '7,4,5,6' || topP === '4,5,6,7' || topP === '5,6,7,4' || topP === '6,7,4,5') {
                    return item.id;
                }
            }
        }
        return 'Unknown';
    }

    // Map non-white bottom colors to canonical White bottom & Yellow top
    const colorMap = {
        [layer.bottom]: 'white',
        [layer.top]: 'yellow',
        [layer.front]: 'green',
        [layer.right]: 'red',
        [layer.back]: 'blue',
        [layer.left]: 'orange'
    };

    const d = pattern.patternData['CORNERS'];
    const canonPieces = new Array(8);
    const canonOri = new Array(8);

    canonPieces[4] = 1; canonPieces[5] = 2; canonPieces[6] = 3; canonPieces[7] = 0;
    canonOri[4] = 0; canonOri[5] = 0; canonOri[6] = 0; canonOri[7] = 0;

    for (let slot = 0; slot < 4; slot++) {
        const pId = d.pieces[slot];
        const pOri = d.orientation[slot];
        const originalColors = PIECE_COLORS[pId];

        const sU = colorMap[originalColors[(3 - pOri) % 3]];
        const sSide1 = colorMap[originalColors[(4 - pOri) % 3]];
        const sSide2 = colorMap[originalColors[(5 - pOri) % 3]];

        const cId = CANONICAL_PIECE_MAP.get([sU, sSide1, sSide2].sort().join(','));
        canonPieces[slot] = cId;

        if (sU === 'yellow') {
            canonOri[slot] = 0;
        } else if (sSide1 === 'yellow') {
            canonOri[slot] = 2;
        } else {
            canonOri[slot] = 1;
        }
    }

    if (canonOri.slice(0, 4).every(x => x === 0)) {
        const topP = canonPieces.slice(0, 4).join(',');
        if (topP === '7,4,5,6' || topP === '4,5,6,7' || topP === '5,6,7,4' || topP === '6,7,4,5') {
            return 'Solved';
        }
        return 'PBL';
    }

    for (const item of ctx.caseAlgs) {
        const perm = item.trans.transformationData['CORNERS'].permutation;
        const oDelta = item.trans.transformationData['CORNERS'].orientationDelta;
        let allZero = true;
        for (let j = 0; j < 4; j++) {
            const no = (canonOri[perm[j]] + oDelta[j]) % 3;
            if (no !== 0) {
                allZero = false;
                break;
            }
        }
        if (allZero) {
            const p0 = canonPieces[perm[0]];
            const p1 = canonPieces[perm[1]];
            const p2 = canonPieces[perm[2]];
            const p3 = canonPieces[perm[3]];
            const topP = p0 + ',' + p1 + ',' + p2 + ',' + p3;
            if (topP === '7,4,5,6' || topP === '4,5,6,7' || topP === '5,6,7,4' || topP === '6,7,4,5') {
                return item.id;
            }
        }
    }

    return 'Unknown';
}

function countFaceOnD(pattern, color) {
    const d = pattern.patternData['CORNERS'];
    let count = 0;
    for (let s = 4; s <= 7; s++) {
        const pieceColor = PIECE_COLORS[d.pieces[s]][(3 - d.orientation[s]) % 3];
        if (pieceColor === color) count++;
    }
    return count;
}

function getInspComplexity(insp) {
    if (!insp || insp === 'none') return 0;
    const parts = insp.trim().split(/\s+/);
    // Pure y rotation (yaw around vertical axis: bottom stays on bottom)
    if (parts.length === 1 && parts[0].startsWith('y')) return 1;
    // Pure x roll or z2 (pitch roll forward/back, or 180 flip)
    if (parts.length === 1 && (parts[0].startsWith('x') || parts[0] === 'z2')) return 2;
    // Single z tilt
    if (parts.length === 1) return 3;
    // Standard compound x + y roll
    if (!insp.includes('z')) return 4;
    // Awkward compound z rotation (e.g. z' y, z' y2)
    return 5;
}

/**
 * Searches for first layer solutions on specified face(s).
 * @param {string} scramble - The 2x2 scramble string
 * @param {Array<string>} targetFaces - Array of faces to solve (e.g. ['white'], ['white', 'yellow'], etc.)
 * @param {number} maxDepth - Max search depth (default 5, auto falls back to 6 if needed)
 * @returns {Promise<Array<{face: string, inspection: string, moves: string, moveCount: number, caseId: string, fixedCount: number, orientedDCount: number}>>}
 */
export async function findLayerSolutions(scramble, targetFaces = ['white'], maxDepth = 5) {
    if (!scramble || !scramble.trim()) return [];

    const allowedFaces = new Set((targetFaces && targetFaces.length > 0 ? targetFaces : ['white']).map(f => f.toLowerCase()));

    const ctx = await getSolverContext();
    let scrambled;
    try {
        scrambled = ctx.def.applyAlg(new Alg(scramble.trim()));
    } catch {
        return [];
    }

    // Pre-calculate target colors on D in the original scramble
    const scrambleCounts = {};
    for (const f of allowedFaces) {
        scrambleCounts[f] = countFaceOnD(scrambled, f);
    }

    const rawSolutions = [];

    for (const curMax of [maxDepth, 6]) {
        for (const insp of ctx.orientations) {
            const orientedPattern = insp ? scrambled.applyAlg(new Alg(insp)) : scrambled;

            const d = orientedPattern.patternData['CORNERS'];
            const dblColor = PIECE_COLORS[d.pieces[6]][(3 - d.orientation[6]) % 3];

            // Moves R, U, F can NEVER touch DBL (slot 6). If DBL does not match an allowed target face,
            // it is mathematically impossible to solve any allowed layer with R, U, F moves.
            if (!allowedFaces.has(dblColor)) {
                continue;
            }

            const face = dblColor;
            const orientedDCount = countFaceOnD(orientedPattern, face);
            const scrambleDCount = scrambleCounts[face] || 0;
            const keepsScrambleD = (!insp || insp === 'none' || insp === 'y' || insp === 'y2' || insp === "y'");
            const inspComplexity = getInspComplexity(insp);

            const dflIsTarget = PIECE_COLORS[d.pieces[5]][(3 - d.orientation[5]) % 3] === face;
            const dbrIsTarget = PIECE_COLORS[d.pieces[7]][(3 - d.orientation[7]) % 3] === face;
            const dfrIsTarget = PIECE_COLORS[d.pieces[4]][(3 - d.orientation[4]) % 3] === face;

            const calcFixedCount = (moves) => {
                let fixed = 1; // DBL is always fixed throughout any R, U, F sequence
                const hasF = moves.some(m => m[0] === 'F');
                const hasR = moves.some(m => m[0] === 'R');
                if (dflIsTarget && !hasF) fixed++;
                if (dbrIsTarget && !hasR) fixed++;
                if (dfrIsTarget && !hasF && !hasR) fixed++;
                return fixed;
            };

            const initLayer = getSolvedBottomLayer(orientedPattern);
            if (initLayer && allowedFaces.has(initLayer.bottom)) {
                rawSolutions.push({
                    face: initLayer.bottom,
                    insp,
                    moves: [],
                    count: 0,
                    caseId: identifyCaseUniversal(orientedPattern, ctx, initLayer),
                    fixedCount: 4,
                    orientedDCount,
                    scrambleDCount,
                    keepsScrambleD,
                    inspComplexity
                });
            }

            let queue = [{ pattern: orientedPattern, moves: [] }];
            for (let depth = 1; depth <= curMax; depth++) {
                const nextQueue = [];
                for (const item of queue) {
                    const lastFace = item.moves.length > 0 ? item.moves[item.moves.length - 1][0] : '';
                    for (const m of ctx.moveNames) {
                        if (m[0] === lastFace) continue;
                        const nextPattern = item.pattern.applyTransformation(ctx.moveTrans[m]);
                        const nextMoves = [...item.moves, m];
                        const layer = getSolvedBottomLayer(nextPattern);
                        if (layer && allowedFaces.has(layer.bottom)) {
                            while (nextMoves.length > 0 && nextMoves[nextMoves.length - 1][0] === 'U') {
                                nextMoves.pop();
                            }
                            rawSolutions.push({
                                face: layer.bottom,
                                insp,
                                moves: nextMoves,
                                count: nextMoves.length,
                                caseId: identifyCaseUniversal(nextPattern, ctx, layer),
                                fixedCount: calcFixedCount(nextMoves),
                                orientedDCount,
                                scrambleDCount,
                                keepsScrambleD,
                                inspComplexity
                            });
                        } else if (depth < curMax) {
                            nextQueue.push({ pattern: nextPattern, moves: nextMoves });
                        }
                    }
                }
                queue = nextQueue;
            }
        }

        if (rawSolutions.length > 0) break;
    }

    // Sort priority:
    // 1. Move count ascending (shortest solutions first)
    // 2. If scramble already had target color on D, strongly prefer keeping the scramble's bottom face!
    // 3. Simpler inspection rotation ascending (none < y < x < z < compound)
    // 4. Fixed target pieces in bottom layer throughout solution descending (more fixed pieces is better)
    // 5. Initial target pieces on bottom after inspection descending (more on bottom is better: 3 > 2 > 1)
    // 6. Preferred face order (white first, etc.)
    rawSolutions.sort((a, b) => {
        if (a.count !== b.count) return a.count - b.count;
        if (a.scrambleDCount > 0 || b.scrambleDCount > 0) {
            if (a.keepsScrambleD !== b.keepsScrambleD) {
                return (b.keepsScrambleD ? 1 : 0) - (a.keepsScrambleD ? 1 : 0);
            }
        }
        if (a.inspComplexity !== b.inspComplexity) return a.inspComplexity - b.inspComplexity;
        if (a.fixedCount !== b.fixedCount) return b.fixedCount - a.fixedCount;
        if (a.orientedDCount !== b.orientedDCount) return b.orientedDCount - a.orientedDCount;
        return (FACE_ORDER[a.face] ?? 99) - (FACE_ORDER[b.face] ?? 99);
    });

    // Deduplicate
    const seen = new Set();
    const unique = [];

    for (const sol of rawSolutions) {
        const moveStr = sol.moves.join(' ');
        const key = `${sol.face}|${sol.insp || 'none'}|${moveStr}`;
        if (!seen.has(key)) {
            seen.add(key);
            unique.push({
                face: sol.face,
                inspection: sol.insp || 'none',
                moves: moveStr,
                moveCount: sol.count,
                caseId: sol.caseId,
                fixedCount: sol.fixedCount,
                orientedDCount: sol.orientedDCount,
                scrambleDCount: sol.scrambleDCount,
                keepsScrambleD: sol.keepsScrambleD,
                inspComplexity: sol.inspComplexity
            });
        }
    }

    return unique;
}

/**
 * Backward compatibility alias for white-only solver
 */
export async function findWhiteLayerSolutions(scramble, maxDepth = 5) {
    return findLayerSolutions(scramble, ['white'], maxDepth);
}
