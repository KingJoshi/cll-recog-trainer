import test from 'node:test';
import assert from 'node:assert';
import { getTrack } from '../src/data/algRegistry.js';
import { cllCases } from '../src/casesData.js';

const GROUPS = ["A", "H", "L", "P", "S", "T", "U"];
const casesByGroup = Object.fromEntries(
  GROUPS.map(g => [g, cllCases.cases.filter(c => c.group === g)])
);

function getCasesInGroup(group, puzzle = "222", trackId = "cll") {
  if (puzzle === "222" && trackId === "cll") {
    if (casesByGroup[group]) return casesByGroup[group];
    const track = getTrack("222", "cll");
    return track?.cases?.filter(c => c.group === group || c.group === `${group}-Group` || c.id.startsWith(group)) || [];
  }
  const track = getTrack(puzzle, trackId);
  if (!track || !track.cases) return casesByGroup[group] || [];
  return track.cases.filter(c => c.group === group || c.group === `${group}-Group` || (group && group.length === 1 && c.group && c.group.startsWith(group)));
}

function simulateToggleGroup(group, currentSelected, puzzle = "222", trackId = "cll") {
  const casesInGroup = getCasesInGroup(group, puzzle, trackId);
  const ids = casesInGroup.map(c => c.id);
  const allSelected = ids.every(id => currentSelected.has(id));
  const next = new Set(currentSelected);
  ids.forEach(id => (allSelected ? next.delete(id) : next.add(id)));
  return next;
}

test('getCasesInGroup accurately resolves all CLL groups by single letter', () => {
  for (const group of GROUPS) {
    const cases = getCasesInGroup(group, "222", "cll");
    assert.ok(cases.length > 0, `Group ${group} must contain cases`);
    for (const c of cases) {
      assert.ok(c.id.startsWith(group), `Case ${c.id} must belong to group ${group}`);
    }
  }
  assert.strictEqual(getCasesInGroup("H", "222", "cll").length, 4);
  assert.strictEqual(getCasesInGroup("P", "222", "cll").length, 6);
  assert.strictEqual(getCasesInGroup("A", "222", "cll").length, 6);
});

test('toggleGroup clears all cases when all cases of the group are selected', () => {
  const allCllIds = new Set(cllCases.cases.map(c => c.id));
  assert.strictEqual(allCllIds.size, 40);

  // When all 40 cases are selected, clicking H should remove H1..H4
  const afterH = simulateToggleGroup("H", allCllIds, "222", "cll");
  assert.strictEqual(afterH.size, 36);
  for (let i = 1; i <= 4; i++) {
    assert.strictEqual(afterH.has(`H${i}`), false);
  }

  // When H is cleared, clicking H should add back H1..H4
  const afterHReadded = simulateToggleGroup("H", afterH, "222", "cll");
  assert.strictEqual(afterHReadded.size, 40);
  for (let i = 1; i <= 4; i++) {
    assert.strictEqual(afterHReadded.has(`H${i}`), true);
  }
});

test('toggleGroup selects all cases of the group when partially selected', () => {
  const allCllIds = new Set(cllCases.cases.map(c => c.id));
  // Deselect P1 from full selection
  allCllIds.delete("P1");
  assert.strictEqual(allCllIds.size, 39);

  // Group P is partially selected; clicking P should select all P cases
  const afterP = simulateToggleGroup("P", allCllIds, "222", "cll");
  assert.strictEqual(afterP.size, 40);
  assert.strictEqual(afterP.has("P1"), true);

  // Now that all P cases are selected, clicking P should clear all of them
  const afterPCleared = simulateToggleGroup("P", afterP, "222", "cll");
  assert.strictEqual(afterPCleared.size, 34); // 40 - 6
  for (let i = 1; i <= 6; i++) {
    assert.strictEqual(afterPCleared.has(`P${i}`), false);
  }
});

test('toggleGroup functions properly on other puzzle tracks (333 PLL)', () => {
  const pllTrack = getTrack("333", "pll");
  const allPllIds = new Set(pllTrack.cases.map(c => c.id));
  assert.strictEqual(allPllIds.size, 21);

  // Toggle Edges Only (Ua, Ub, H, Z)
  const afterEdges = simulateToggleGroup("Edges Only", allPllIds, "333", "pll");
  assert.strictEqual(afterEdges.size, 17); // 21 - 4
  assert.strictEqual(afterEdges.has("Ua"), false);
  assert.strictEqual(afterEdges.has("Ub"), false);
  assert.strictEqual(afterEdges.has("H"), false);
  assert.strictEqual(afterEdges.has("Z"), false);

  // Re-toggle Edges Only
  const afterEdgesReadded = simulateToggleGroup("Edges Only", afterEdges, "333", "pll");
  assert.strictEqual(afterEdgesReadded.size, 21);
  assert.strictEqual(afterEdgesReadded.has("Ua"), true);
});
