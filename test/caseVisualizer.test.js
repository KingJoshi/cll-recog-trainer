import test from 'node:test';
import assert from 'node:assert';
import { renderCaseSvg } from '../src/caseVisualizer.js';
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
    assert.ok(svg.includes('#ffd500'), `PLL ${c.id} should have yellow facelets`);
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
