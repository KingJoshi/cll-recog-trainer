import test from 'node:test';
import assert from 'node:assert';
import { createDefaultSession, computeStats, computeAverageOfN } from '../src/sessions.js';

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
