import test from 'node:test';
import assert from 'node:assert';
import { renderCaseSvg, getCachedCaseSvg, prewarmOllPllSvgs, isOllPllSvgsPrewarmed, CUBE_COLORS } from '../src/caseVisualizer.js';
import { pllCases } from '../src/data/pllData.js';
import { ollCases } from '../src/data/ollData.js';
import { f2lCases } from '../src/data/f2lData.js';
import { cllCases } from '../src/data/cllData.js';
import { ortegaCases } from '../src/data/ortegaData.js';

test('renderCaseSvg generates valid SVG for 3x3 PLL cases', async () => {
  for (const c of pllCases) {
    const svg = await renderCaseSvg('333', 'pll', c);
    assert.ok(svg.startsWith('<svg'), `PLL ${c.id} should return SVG root`);
    assert.ok(svg.endsWith('</svg>'), `PLL ${c.id} should end with SVG root`);
    assert.ok(svg.includes('class="case-svg case-svg-pll"'), `PLL ${c.id} should have correct class`);
    // Yellow facelets
    assert.ok(svg.includes(CUBE_COLORS.yellow), `PLL ${c.id} should have yellow facelets`);
  }
});

test('renderCaseSvg generates valid SVG for 3x3 OLL cases', async () => {
  // Test a sample of OLL cases across dot, cross, corner, etc.
  for (const c of ollCases.slice(0, 10)) {
    const svg = await renderCaseSvg('333', 'oll', c);
    assert.ok(svg.startsWith('<svg'), `OLL ${c.id} should return SVG root`);
    assert.ok(svg.endsWith('</svg>'), `OLL ${c.id} should end with SVG root`);
    assert.ok(svg.includes('class="case-svg case-svg-oll"'), `OLL ${c.id} should have correct class`);
  }
});

test('renderCaseSvg generates valid SVG for 3x3 F2L cases', async () => {
  for (const c of f2lCases.slice(0, 5)) {
    const svg = await renderCaseSvg('333', 'f2l', c);
    assert.ok(svg.startsWith('<svg'), `F2L ${c.id} should return SVG root`);
    assert.ok(svg.endsWith('</svg>'), `F2L ${c.id} should end with SVG root`);
    assert.ok(svg.includes('class="case-svg case-svg-f2l"'), `F2L ${c.id} should have correct class`);
    assert.ok(svg.includes('FR'), `F2L ${c.id} should mark Front-Right slot`);
  }
});

test('F2L SVG leaves the FR target slot empty unless the pair is actually in the slot', async () => {
  const fills = svg => [...svg.matchAll(/<polygon[^>]*fill="([^"]+)"/g)].map(m => m[1]);
  // polygon order: U (9), F (9), R (9). FR slot facelets: F[1][2]=14, F[2][2]=17, R[1][0]=21, R[2][0]=24
  const slotIdx = [14, 17, 21, 24];
  const byId = id => f2lCases.find(c => c.id === id);

  // Pair fully in the top layer (F2L 1: R U R' U' setup) -> slot facelets are empty (same color for all 4)
  const out = fills(await renderCaseSvg('333', 'f2l', byId('f2l-01')));
  const slate = out[slotIdx[0]];
  for (const i of slotIdx) assert.strictEqual(out[i], slate, `F2L 1 slot facelet ${i} must be empty`);
  const greenCell = out[12]; // fixed F-face neighbour cell (green)
  assert.notStrictEqual(slate, greenCell, 'empty slot must not look like a solved green/red cell');

  // Pair already inserted (F2L 41: both in slot) -> slot facelets are colored, not empty
  const inSlot = fills(await renderCaseSvg('333', 'f2l', byId('f2l-41')));
  assert.ok(slotIdx.some(i => inSlot[i] !== slate), 'F2L 41 must show pieces inside the slot');
});

test('renderCaseSvg generates valid SVG for 2x2 CLL cases', async () => {
  for (const c of cllCases.slice(0, 8)) {
    const svg = await renderCaseSvg('222', 'cll', c);
    assert.ok(svg.startsWith('<svg'), `CLL ${c.id} should return SVG root`);
    assert.ok(svg.endsWith('</svg>'), `CLL ${c.id} should end with SVG root`);
    assert.ok(svg.includes('class="case-svg case-svg-222"'), `CLL ${c.id} should have correct class`);
  }
});

test('renderCaseSvg generates valid SVG for 2x2 Ortega cases', async () => {
  for (const c of ortegaCases) {
    const svg = await renderCaseSvg('222', 'ortega', c);
    assert.ok(svg.startsWith('<svg'), `Ortega ${c.id} should return SVG root`);
    assert.ok(svg.endsWith('</svg>'), `Ortega ${c.id} should end with SVG root`);
    assert.ok(svg.includes('case-svg'), `Ortega ${c.id} should have case-svg class`);
  }
});

test('prewarmOllPllSvgs populates synchronous cache for OLL and PLL tables without recursion', async () => {
  await prewarmOllPllSvgs(ollCases, pllCases);
  assert.strictEqual(isOllPllSvgsPrewarmed(), true);
  assert.ok(getCachedCaseSvg('333', 'oll', 'oll-01').startsWith('<svg'));
  assert.ok(getCachedCaseSvg('333', 'oll', 'OLL 1').startsWith('<svg'));
  assert.ok(getCachedCaseSvg('333', 'pll', 'T').startsWith('<svg'));
});

