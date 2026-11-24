import test from 'node:test';
import assert from 'node:assert';
import {
  getSolveTime,
  filterSolves,
  groupSolvesByCase,
  computeCaseStats,
  computeAverageOfN,
  getBestAverageOfN,
  computeStats,
  exportSolvesToCSV
} from '../src/services/solveStats.js';

test('getSolveTime handles OK, +2, and DNF penalties consistently', () => {
  assert.strictEqual(getSolveTime({ rawMs: 4200, penalty: null }), 4200);
  assert.strictEqual(getSolveTime({ rawMs: 4200, penalty: '+2' }), 6200);
  assert.strictEqual(getSolveTime({ ms: 3100, penalty: 2 }), 5100);
  assert.strictEqual(getSolveTime({ rawMs: 4200, penalty: 'DNF' }), Infinity);
  assert.strictEqual(getSolveTime({ rawMs: 4200, penalty: -1 }), Infinity);
  assert.strictEqual(getSolveTime(null), null);
});

test('computeAverageOfN & getBestAverageOfN compute WCA trimmed averages properly', () => {
  // 1 DNF is dropped as slowest in Ao5
  const ao5Valid = [
    { ms: 5000 },
    { ms: 3000, penalty: 'DNF' },
    { ms: 4000 },
    { ms: 2000 },
    { ms: 6000 }
  ];
  assert.strictEqual(computeAverageOfN(ao5Valid, 5), 5000); // drops 2000 & DNF -> avg(4000,5000,6000)

  // 2 DNFs make Ao5 = -1 (DNF)
  const ao5Dnf = [
    { ms: 5000, penalty: 'DNF' },
    { ms: 3000, penalty: 'DNF' },
    { ms: 4000 },
    { ms: 2000 },
    { ms: 6000 }
  ];
  assert.strictEqual(computeAverageOfN(ao5Dnf, 5), -1);

  const series = [
    { ms: 9000 },
    { ms: 2000 },
    { ms: 2100 },
    { ms: 2200 },
    { ms: 2300 },
    { ms: 2400 }
  ];
  assert.strictEqual(getBestAverageOfN(series, 5), 2200);
});

test('filterSolves, groupSolvesByCase, computeCaseStats, and computeStats aggregate accurately', () => {
  const solves = [
    { puzzle: '222', track: 'cll', target: 'cll', id: 'H1', ms: 1500 },
    { puzzle: '222', track: 'cll', target: 'cll', id: 'H1', ms: 2000, penalty: '+2' }, // 4000
    { puzzle: '222', track: 'cll', target: 'cll', id: 'H2', ms: 1000, penalty: 'DNF' },
    { puzzle: '333', track: 'pll', target: 'pll', id: 'T', ms: 1800 }
  ];

  const cllOnly = filterSolves(solves, { puzzle: '222', track: 'cll' });
  assert.strictEqual(cllOnly.length, 3);

  const grouped = groupSolvesByCase(cllOnly, ['H1', 'H2']);
  assert.deepStrictEqual(grouped.get('H1'), [1500, 4000]);
  assert.deepStrictEqual(grouped.get('H2'), []);

  const h1Stats = computeCaseStats(grouped.get('H1'));
  assert.strictEqual(h1Stats.attempts, 2);
  assert.strictEqual(h1Stats.best, 1500);
  assert.strictEqual(h1Stats.mean, 2750);

  const overall = computeStats(solves);
  assert.strictEqual(overall.count, 4);
  assert.strictEqual(overall.validCount, 3);
  assert.strictEqual(overall.best, 1500);
});

test('exportSolvesToCSV quotes fields with quotes safely, preserves +2 / DNF, and includes recon and 2x2 analysis columns', () => {
  const csv = exportSolvesToCSV([
    {
      rawMs: 1200,
      penalty: '+2',
      puzzle: '222',
      track: 'cll',
      id: 'T1',
      scramble: 'R U "x"',
      at: 1700000000000,
      moveCount: 8,
      tps: 6.67,
      moves: [
        { move: 'R', t: 150, split: 150 },
        { move: "U'", t: 300, split: 150 },
        { move: 'U', t: 820, split: 520 },
        { move: 'R', t: 1200, split: 380 }
      ],
      twoByTwo: {
        method: 'cll',
        layerColor: 'White',
        splits: { layer: 300, cll: 750, auf: 150 },
        cllCase: {
          id: 'T1',
          shortName: 'T1',
          recogMs: 520,
          setupMoves: 'U',
          execMs: 230,
          moveCount: 6
        },
        aufSummary: { caseId: 'U2', ms: 150 },
        pauses: { totalCount: 1, totalMs: 520 },
        steps: [
          { phase: 'layer', label: '1st Layer', caseId: 'White', moveCount: 2, ms: 300, moves: "R U'" },
          { phase: 'cll', label: 'CLL', caseId: 'T1', moveCount: 6, ms: 750, moves: 'U R' }
        ]
      }
    },
    { rawMs: 2500, penalty: 'DNF', puzzle: '222', track: 'cll', id: 'H1', scramble: "R' U'", at: 1700000005000 }
  ]);
  const lines = csv.split('\r\n');
  assert.strictEqual(lines.length, 3);
  assert.ok(lines[0].endsWith(',Move Count,TPS,Recon,Recon Timings(ms),2x2 Method,1st Layer Color,1st Layer(s),1st Layer Moves,CLL(s),CLL Case,CLL Recog(s),CLL Setup,CLL Exec(s),CLL Moves,AUF(s),AUF Moves,Analysis Steps'));
  assert.ok(lines[1].includes(',3.20,+2,1200,'));
  assert.ok(lines[1].includes('"R U ""x"""'));
  assert.ok(lines[1].includes(',1,0.52,'));
  assert.ok(lines[1].includes(',8,6.67,"R U\' U R","R@150 U\'@300 U@820 R@1200","cll","White",0.30,2,0.75,"T1",0.52,"U",0.23,6,0.15,"U2","1st Layer (White, 2m, 0.30s): R U\' | CLL (T1, 6m, 0.75s): U R | AUF (U2, 0.15s)"'));
  assert.ok(lines[2].includes(',DNF,DNF,2500,'));
});
