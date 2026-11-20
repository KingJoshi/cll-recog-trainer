import test from 'node:test';
import assert from 'node:assert';
import { getCasesInGroup, toggleGroupSelection } from '../src/ui/casePickerController.js';

test('getCasesInGroup accurately resolves all CLL groups by single letter', () => {
  const hCases = getCasesInGroup('H', '222', 'cll');
  assert.strictEqual(hCases.length, 4);
  assert.deepStrictEqual(hCases.map(c => c.id).sort(), ['H1', 'H2', 'H3', 'H4']);

  for (const g of ['A', 'L', 'P', 'S', 'T', 'U']) {
    const cases = getCasesInGroup(g, '222', 'cll');
    assert.strictEqual(cases.length, 6, `${g}-Group must have 6 CLL cases`);
  }
});

test('toggleGroupSelection clears all cases when all cases of the group are selected', () => {
  let selected = new Set(['H1', 'H2', 'H3', 'H4', 'A1']);
  selected = toggleGroupSelection('H', selected, '222', 'cll');

  assert.strictEqual(selected.has('H1'), false);
  assert.strictEqual(selected.has('H2'), false);
  assert.strictEqual(selected.has('H3'), false);
  assert.strictEqual(selected.has('H4'), false);
  assert.strictEqual(selected.has('A1'), true, 'Other group cases should remain unchanged');
});

test('toggleGroupSelection selects all cases of the group when partially or newly selected', () => {
  let selected = new Set(['H1', 'H2']);
  selected = toggleGroupSelection('H', selected, '222', 'cll');
  for (const id of ['H1', 'H2', 'H3', 'H4']) {
    assert.strictEqual(selected.has(id), true);
  }

  selected = toggleGroupSelection('A', selected, '222', 'cll');
  for (const id of ['A1', 'A2', 'A3', 'A4', 'A5', 'A6']) {
    assert.strictEqual(selected.has(id), true);
  }
});

test('toggleGroupSelection filters by tag when active tag filter matches subset of group', () => {
  const tags = { H1: 'learning', H2: 'learning', H3: 'mastered', H4: 'none' };
  const selected = toggleGroupSelection('H', new Set(['A1']), '222', 'cll', 'learning', id => tags[id] || 'none');
  assert.strictEqual(selected.has('H1'), true);
  assert.strictEqual(selected.has('H2'), true);
  assert.strictEqual(selected.has('H3'), false);
  assert.strictEqual(selected.has('H4'), false);
  assert.strictEqual(selected.has('A1'), true);
});

test('getCasesInGroup & toggleGroupSelection work on 333 PLL and 444 Parity tracks', () => {
  const gPerms = getCasesInGroup('G-Permutation', '333', 'pll');
  assert.strictEqual(gPerms.length, 4);
  const selected = toggleGroupSelection('G-Permutation', new Set(), '333', 'pll');
  for (const gp of ['Ga', 'Gb', 'Gc', 'Gd']) {
    assert.strictEqual(selected.has(gp), true);
  }

  const pllParity = getCasesInGroup('PLL Parity', '444', 'parity');
  assert.strictEqual(pllParity.length, 2);
});
