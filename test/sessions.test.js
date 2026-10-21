import test from 'node:test';
import assert from 'node:assert';
import {
  createDefaultSession,
  computeStats,
  computeAverageOfN,
  filterSolves,
  groupSolvesByCase,
  computeCaseStats,
  exportSolvesToCSV
} from '../src/sessions.js';

test('createDefaultSession supports 222 and 333', () => {
  const s2 = createDefaultSession('222', '2x2 Testing');
  assert.strictEqual(s2.puzzle, '222');
  assert.strictEqual(s2.name, '2x2 Testing');

  const s3 = createDefaultSession('333', '3x3 Testing');
  assert.strictEqual(s3.puzzle, '333');
  assert.strictEqual(s3.name, '3x3 Testing');
});

test('computeAverageOfN calculates WCA trimmed average', () => {
  // 5 solves: 3000, 4000, 5000, 6000, 7000 -> drops 3000 and 7000 -> avg of 4000, 5000, 6000 = 5000
  const solves = [
    { time: 3000, penalty: 0 },
    { time: 4000, penalty: 0 },
    { time: 5000, penalty: 0 },
    { time: 6000, penalty: 0 },
    { time: 7000, penalty: 0 }
  ];
  const ao5 = computeAverageOfN(solves, 5);
  assert.strictEqual(ao5, 5000);
});

test('computeStats correctly handles penalties (+2 and DNF)', () => {
  const solves = [
    { time: 3000, penalty: 0 },
    { time: 4000, penalty: 2 }, // 6000
    { time: 5000, penalty: -1 } // DNF
  ];
  const stats = computeStats(solves);
  assert.strictEqual(stats.count, 3);
  assert.strictEqual(stats.validCount, 2);
  assert.strictEqual(stats.best, 3000);
  assert.strictEqual(stats.mean, 4500); // (3000 + 6000) / 2
});

test('filterSolves partitions solves by puzzle and training set track', () => {
  const solves = [
    { ms: 12000, puzzle: "333", track: "pll", target: "pll", id: "T" },
    { ms: 14000, puzzle: "333", track: "pll", target: "pll", id: "Y" },
    { ms: 15000, puzzle: "333", track: "oll", target: "oll", id: "OLL-1" },
    { ms: 22000, puzzle: "333", track: "cross", target: "full" },
    { ms: 3500, puzzle: "222", track: "cll", target: "cll", id: "A1" }
  ];

  const pllSolves = filterSolves(solves, { puzzle: "333", track: "pll" });
  assert.strictEqual(pllSolves.length, 2);
  assert.strictEqual(pllSolves[0].id, "T");
  assert.strictEqual(pllSolves[1].id, "Y");

  const ollSolves = filterSolves(solves, { track: "oll" });
  assert.strictEqual(ollSolves.length, 1);
  assert.strictEqual(ollSolves[0].id, "OLL-1");

  const p222Solves = filterSolves(solves, { puzzle: "222" });
  assert.strictEqual(p222Solves.length, 1);
  assert.strictEqual(p222Solves[0].id, "A1");
});

test('groupSolvesByCase and computeCaseStats aggregate metrics per case', () => {
  const solves = [
    { ms: 2000, id: "T" },
    { ms: 2500, id: "T" },
    { ms: 3000, id: "T", penalty: "+2" }, // 5000
    { ms: 4000, id: "Y" }
  ];

  const grouped = groupSolvesByCase(solves, ["T", "Y", "Ua"]);
  assert.strictEqual(grouped.get("T").length, 3);
  assert.strictEqual(grouped.get("Y").length, 1);
  assert.strictEqual(grouped.has("Ua"), false);

  const tStats = computeCaseStats(grouped.get("T"));
  assert.strictEqual(tStats.attempts, 3);
  assert.strictEqual(tStats.best, 2000);
  assert.strictEqual(tStats.worst, 5000);
  assert.strictEqual(tStats.mean, Math.round((2000 + 2500 + 5000) / 3)); // 3167
  assert.strictEqual(tStats.median, 2500);
});

test('exportSolvesToCSV exports clean CSV with headers and solve records', () => {
  const solves = [
    { ms: 1250, penalty: 0, puzzle: "222", track: "cll", id: "T1", target: "cll", scramble: "R U R'", at: 1700000000000 },
    { ms: 14000, penalty: 2, puzzle: "333", track: "pll", id: "Ja", target: "pll", scramble: "R U R' F'", at: 1700000010000 },
    { ms: 18500, penalty: -1, puzzle: "444", track: "parity", id: "444-oll-parity", target: "parity", scramble: "Rw U2", at: 1700000020000 }
  ];

  const csv = exportSolvesToCSV(solves, "Testing");
  assert.ok(csv.includes("No,Time(s),Penalty,Raw Time(ms),Puzzle,Track,Case,Target,Scramble,Date"));
  assert.ok(csv.includes("1,1.25,OK,1250,222,cll,T1,cll,\"R U R'\""));
  assert.ok(csv.includes("2,16.00,+2,14000,333,pll,Ja,pll,\"R U R' F'\""));
  assert.ok(csv.includes("3,DNF,DNF,18500,444,parity,444-oll-parity,parity,\"Rw U2\""));
});
