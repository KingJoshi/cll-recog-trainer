import test from 'node:test';
import assert from 'node:assert';
import {
  initCfopAnalyzer,
  analyzeCfopSolve,
  ensureSolveCfop,
  computeCfopAverages,
  computeOllPllCaseStats,
  computeMedian,
  computeTrimmedMean,
  DEFAULT_PAUSE_THRESHOLD_MS,
} from '../src/cfopAnalyzer.js';

const DEMO_SCRAMBLE = "U F R U' R' U R U R2' F' R U R U' R' U' R U2' R' U' R U' R' U' R U' R' U L' U L U2' R' U' R U' L U L' U' D F R' D'";

const DEMO_MOVES = [
  // Cross (4 moves, 720ms)
  { move: "D",  t: 180,  split: 180 },
  { move: "R",  t: 360,  split: 180 },
  { move: "F'", t: 540,  split: 180 },
  { move: "D'", t: 720,  split: 180 },
  // F2L 1 (4 moves, 1060ms, starts with 520ms pause)
  { move: "U",  t: 1240, split: 520 },
  { move: "L",  t: 1420, split: 180 },
  { move: "U'", t: 1600, split: 180 },
  { move: "L'", t: 1780, split: 180 },
  // F2L 2 (4 moves, 1000ms, starts with 460ms pause)
  { move: "U",  t: 2240, split: 460 },
  { move: "R'", t: 2420, split: 180 },
  { move: "U",  t: 2600, split: 180 },
  { move: "R",  t: 2780, split: 180 },
  // F2L 3 (4 moves, 860ms)
  { move: "U2", t: 3100, split: 320 },
  { move: "L'", t: 3280, split: 180 },
  { move: "U'", t: 3460, split: 180 },
  { move: "L",  t: 3640, split: 180 },
  // F2L 4 (4 moves, 820ms)
  { move: "U'", t: 3920, split: 280 },
  { move: "R",  t: 4100, split: 180 },
  { move: "U",  t: 4280, split: 180 },
  { move: "R'", t: 4460, split: 180 },
  // OLL 27 Sune (8 moves, 1870ms, starts with 550ms recognition pause)
  { move: "U",  t: 5010, split: 550 },
  { move: "R",  t: 5210, split: 200 },
  { move: "U",  t: 5390, split: 180 },
  { move: "R'", t: 5570, split: 180 },
  { move: "U",  t: 5750, split: 180 },
  { move: "R",  t: 5930, split: 180 },
  { move: "U2", t: 6150, split: 220 },
  { move: "R'", t: 6330, split: 180 },
  // PLL T-Perm (16 moves, 3630ms, starts with 630ms recognition pause)
  { move: "U",  t: 6960, split: 630 },
  { move: "R",  t: 7160, split: 200 },
  { move: "U",  t: 7360, split: 200 },
  { move: "R'", t: 7560, split: 200 },
  { move: "U'", t: 7760, split: 200 },
  { move: "R'", t: 7960, split: 200 },
  { move: "F",  t: 8160, split: 200 },
  { move: "R2", t: 8360, split: 200 },
  { move: "U'", t: 8560, split: 200 },
  { move: "R'", t: 8760, split: 200 },
  { move: "U'", t: 8960, split: 200 },
  { move: "R",  t: 9160, split: 200 },
  { move: "U",  t: 9360, split: 200 },
  { move: "R'", t: 9560, split: 200 },
  { move: "F'", t: 9760, split: 200 },
  { move: "U'", t: 9960, split: 200 },
];

test('analyzeCfopSolve accurately detects Cross, F2L 1-4, OLL 27 (Sune), PLL (T Perm), and pauses', async () => {
  await initCfopAnalyzer();
  const solve = {
    puzzle: '333',
    target: 'full',
    ms: 9960,
    rawMs: 9960,
    penalty: null,
    scramble: DEMO_SCRAMBLE,
    moves: DEMO_MOVES,
  };

  const cfop = await analyzeCfopSolve(solve);
  assert.ok(cfop, 'Expected CFOP analysis object');
  assert.strictEqual(cfop.isFullCfop, true);
  assert.strictEqual(cfop.crossColor, 'Yellow');

  // Step timings
  assert.strictEqual(cfop.splits.cross, 720);
  assert.strictEqual(cfop.splits.f2l1, 1060);
  assert.strictEqual(cfop.splits.f2l2, 1000);
  assert.strictEqual(cfop.splits.f2l3, 860);
  assert.strictEqual(cfop.splits.f2l4, 820);
  assert.strictEqual(cfop.splits.f2lTotal, 1060 + 1000 + 860 + 820);
  assert.strictEqual(cfop.splits.oll, 1870);
  assert.strictEqual(cfop.splits.pll, 3630);

  // OLL & PLL case identification
  assert.strictEqual(cfop.ollCase.shortName, 'OLL 27');
  assert.strictEqual(cfop.ollCase.name, 'OLL 27 (Sune)');
  assert.strictEqual(cfop.pllCase.shortName, 'T');
  assert.strictEqual(cfop.pllCase.name, 'T-Perm (Adjacent Swap - Classic)');

  // Pauses (>= 400ms)
  assert.strictEqual(cfop.pauses.thresholdMs, DEFAULT_PAUSE_THRESHOLD_MS);
  assert.strictEqual(cfop.pauses.totalCount, 4);
  assert.strictEqual(cfop.pauses.totalMs, 520 + 460 + 550 + 630);
  assert.strictEqual(cfop.ollCase.pauseCount, 1);
  assert.strictEqual(cfop.pllCase.pauseCount, 1);

  // Step table fields: caseId, setupMoves, recogMs, execMs, accumMs, and f2lSummary
  const crossStep = cfop.steps.find(s => s.phase === 'cross');
  const ollStep = cfop.steps.find(s => s.phase === 'oll');
  const pllStep = cfop.steps.find(s => s.phase === 'pll');
  assert.strictEqual(crossStep.caseId, 'Yellow');
  assert.strictEqual(crossStep.accumMs, 720);
  assert.strictEqual(ollStep.caseId, 'OLL 27');
  assert.strictEqual(ollStep.setupMoves, 'U');
  assert.strictEqual(ollStep.recogMs + ollStep.execMs, ollStep.ms);
  assert.strictEqual(pllStep.caseId, 'T');
  assert.strictEqual(pllStep.setupMoves, 'U');
  assert.strictEqual(pllStep.accumMs, 9960);
  assert.ok(cfop.f2lSummary);
  assert.strictEqual(cfop.f2lSummary.ms, 3740);
  assert.strictEqual(cfop.f2lSummary.accumMs, 4460);
});

test('computeMedian and computeTrimmedMean (10% trim) exclude outliers properly', () => {
  const sample = [10000, 12000, 12500, 13000, 13200, 13500, 13800, 14000, 14200, 35000];
  assert.strictEqual(computeMedian(sample), 13350);
  // 10% trim on 10 items drops 10000 and 35000 -> mean of remaining 8 is 13275
  assert.strictEqual(computeTrimmedMean(sample, 0.10), 13275);
});

test('computeCfopAverages and computeOllPllCaseStats aggregate session and paginated solves', async () => {
  await initCfopAnalyzer();
  const solve1 = {
    puzzle: '333',
    target: 'full',
    ms: 9960,
    rawMs: 9960,
    pickupMs: 420,
    putdownMs: 360,
    penalty: null,
    scramble: DEMO_SCRAMBLE,
    moves: DEMO_MOVES,
  };
  const solve2 = {
    puzzle: '333',
    target: 'full',
    ms: 9960,
    rawMs: 9960,
    pickupMs: 500,
    putdownMs: 440,
    penalty: null,
    scramble: DEMO_SCRAMBLE,
    moves: DEMO_MOVES.map((m) => ({ ...m })),
  };

  ensureSolveCfop(solve1);
  ensureSolveCfop(solve2);

  const avg = computeCfopAverages([solve1, solve2]);
  assert.ok(avg);
  assert.strictEqual(avg.solveCount, 2);
  assert.strictEqual(avg.cfopSolveCount, 2);
  assert.strictEqual(avg.pickupMs, 460);
  assert.strictEqual(avg.putdownMs, 400);
  assert.strictEqual(avg.median.pickupMs, 460);
  assert.strictEqual(avg.median.putdownMs, 400);
  assert.strictEqual(avg.trimMean.pickupMs, 460);
  assert.strictEqual(avg.trimMean.putdownMs, 400);
  assert.strictEqual(avg.cross, 720);
  assert.strictEqual(avg.f2lTotal, 3740);
  assert.strictEqual(avg.oll, 1870);
  assert.strictEqual(avg.pll, 3630);
  assert.strictEqual(avg.avgPauseCount, 4);

  const caseStats = computeOllPllCaseStats([solve1, solve2]);
  assert.strictEqual(caseStats.ollCases.length, 1);
  assert.strictEqual(caseStats.ollCases[0].shortName, 'OLL 27');
  assert.strictEqual(caseStats.ollCases[0].attempts, 2);
  assert.strictEqual(caseStats.ollCases[0].avgMs, 1870);
  assert.strictEqual(caseStats.ollCases[0].avgPauseCount, 1);

  assert.strictEqual(caseStats.pllCases.length, 1);
  assert.strictEqual(caseStats.pllCases[0].shortName, 'T');
  assert.strictEqual(caseStats.pllCases[0].name, 'T-Perm (Adjacent Swap - Classic)');
  assert.strictEqual(caseStats.pllCases[0].attempts, 2);
  assert.strictEqual(caseStats.pllCases[0].avgMs, 3630);
  assert.strictEqual(caseStats.pllCases[0].avgPauseCount, 1);
});
