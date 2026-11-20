import test from 'node:test';
import assert from 'node:assert';
import { computeTooltipPosition } from '../src/ui/tooltipController.js';

test('computeTooltipPosition centers below trigger by default and clamps inside desktop viewport', () => {
  const pos = computeTooltipPosition(
    { left: 600, right: 700, top: 40, bottom: 76, width: 100, height: 36 },
    { width: 220, height: 48 },
    { width: 1440, height: 900 }
  );
  assert.strictEqual(pos.placement, 'bottom');
  assert.strictEqual(pos.left, 540);
  assert.strictEqual(pos.top, 84);
});

test('computeTooltipPosition flips above trigger when near bottom viewport edge', () => {
  const pos = computeTooltipPosition(
    { left: 200, right: 320, top: 840, bottom: 880, width: 120, height: 40 },
    { width: 200, height: 50 },
    { width: 1440, height: 900 }
  );
  assert.strictEqual(pos.placement, 'top');
  assert.strictEqual(pos.top, 782);
  assert.ok(pos.top >= 8);
});

test('computeTooltipPosition clamps left and right edges on narrow mobile screens (390x844)', () => {
  const leftEdge = computeTooltipPosition(
    { left: 6, right: 56, top: 100, bottom: 136, width: 50, height: 36 },
    { width: 240, height: 60 },
    { width: 390, height: 844 }
  );
  assert.strictEqual(leftEdge.left, 8);

  const rightEdge = computeTooltipPosition(
    { left: 330, right: 384, top: 100, bottom: 136, width: 54, height: 36 },
    { width: 240, height: 60 },
    { width: 390, height: 844 }
  );
  assert.strictEqual(rightEdge.left, 390 - 240 - 8);
  assert.ok(rightEdge.left + 240 <= 382);
});
