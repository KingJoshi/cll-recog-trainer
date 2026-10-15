/**
 * 2x2 White First Layer Solver for CLL Practice
 *
 * Uses official WCA puzzle definitions and transformation engines from cubing.js
 * to ensure 100% mathematical fidelity for any valid scramble (including L2, B2, D2, etc.).
 *
 * Finds optimal solutions to solve the white first layer on D (bottom)
 * with matching bottom-side colors (CLL first layer), and accurately identifies
 * the resulting top-layer CLL case (e.g. S1..S6, T1..T6, Solved, PBL, etc.).
 */

import { puzzles } from 'cubing/puzzles';
import { Alg } from 'cubing/alg';
import { cllCases } from './casesData.js';

let solverContextPromise = null;

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

const UNROTATE = {
    '1,2,3,0': '',
    '0,1,2,3': "y'",
    '3,0,1,2': 'y2',
    '2,3,0,1': 'y'
};

function isWhiteLayerSolved(pattern) {
    const data = pattern.patternData['CORNERS'];
    const o = data.orientation;
    if (o[4] !== 0 || o[5] !== 0 || o[6] !== 0 || o[7] !== 0) return false;
    const p = data.pieces;
    const p0 = p[4], p1 = p[5], p2 = p[6], p3 = p[7];
    return (p0 === 0 && p1 === 1 && p2 === 2 && p3 === 3) ||
           (p0 === 1 && p1 === 2 && p2 === 3 && p3 === 0) ||
           (p0 === 2 && p1 === 3 && p2 === 0 && p3 === 1) ||
           (p0 === 3 && p1 === 0 && p2 === 1 && p3 === 2);
}

function identifyCase(pattern, ctx) {
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

/**
 * Searches for all white 1st layer solutions on D.
 * @param {string} scramble - The 2x2 scramble string
 * @param {number} maxDepth - Max search depth (default 5, auto falls back to 6 if needed)
 * @returns {Promise<Array<{inspection: string, moves: string, moveCount: number, caseId: string}>>}
 */
export async function findWhiteLayerSolutions(scramble, maxDepth = 5) {
    if (!scramble || !scramble.trim()) return [];

    const ctx = await getSolverContext();
    let scrambled;
    try {
        scrambled = ctx.def.applyAlg(new Alg(scramble.trim()));
    } catch {
        return [];
    }

    const rawSolutions = [];

    for (const curMax of [maxDepth, 6]) {
        for (const insp of ctx.orientations) {
            const orientedPattern = insp ? scrambled.applyAlg(new Alg(insp)) : scrambled;
            if (isWhiteLayerSolved(orientedPattern)) {
                rawSolutions.push({
                    insp,
                    moves: [],
                    count: 0,
                    caseId: identifyCase(orientedPattern, ctx)
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
                        if (isWhiteLayerSolved(nextPattern)) {
                            // Strip trailing AUF U turns since they do not affect 1st layer completion
                            while (nextMoves.length > 0 && nextMoves[nextMoves.length - 1][0] === 'U') {
                                nextMoves.pop();
                            }
                            rawSolutions.push({
                                insp,
                                moves: nextMoves,
                                count: nextMoves.length,
                                caseId: identifyCase(nextPattern, ctx)
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

    // Deduplicate and rank by move count ascending
    rawSolutions.sort((a, b) => a.count - b.count);
    const seen = new Set();
    const unique = [];

    for (const sol of rawSolutions) {
        const moveStr = sol.moves.join(' ');
        const key = `${sol.insp || 'none'}|${moveStr}`;
        if (!seen.has(key)) {
            seen.add(key);
            unique.push({
                inspection: sol.insp || 'none',
                moves: moveStr,
                moveCount: sol.count,
                caseId: sol.caseId
            });
        }
    }

    return unique;
}
