import test from 'node:test';
import assert from 'node:assert';
import { PracticeView } from '../src/practiceView.js';
import { getTrack } from '../src/data/algRegistry.js';

function createMockContainer() {
  return {
    innerHTML: '',
    querySelectorAll() { return []; },
    querySelector() { return null; }
  };
}

test('PracticeView supports 333oh Cross as an inspection drill and renders Cross heading', async () => {
  const container = createMockContainer();
  const pv = new PracticeView({
    container,
    onGenerateScramble: async () => "R U R' F'",
    onQuickSimSolutions: () => {}
  });

  await pv.setTrack('333oh', 'cross');
  assert.ok(container.innerHTML.includes('Inspection Planning Drill'));

  pv.solutionRevealed = true;
  pv.inspectionSolutions = [{ face: 'white', moves: "F R U'", moveCount: 3, insp: 'none' }];
  pv.render();
  assert.ok(container.innerHTML.includes('Optimal Cross Solutions'));
  assert.ok(!container.innerHTML.includes('Optimal 1st Layer Solutions'));
  assert.ok(container.innerHTML.includes('inspection-sol-sim-btn'));
  assert.ok(container.innerHTML.includes('ui-icon'));
  assert.ok(!container.innerHTML.includes('&#x25B6;'));
  assert.ok(container.innerHTML.includes('data-tooltip='));
});

test('PracticeView OLL keypad does not leak spoiler when currentCase is Cross OLL', () => {
  const pv = new PracticeView({ container: createMockContainer() });
  const ollTrack = getTrack('333', 'oll');
  pv.currentPuzzle = '333';
  pv.currentTrackId = 'oll';
  pv.currentCase = ollTrack.cases.find(c => c.group === 'All Edges Oriented (Cross)');
  assert.ok(pv.currentCase);

  const keypadHtml = pv.renderKeypadForTrack(ollTrack);
  assert.ok(!keypadHtml.includes('Select OLL Cross case'));
  assert.ok(keypadHtml.includes('data-case="oll-01"'));
  assert.ok(keypadHtml.includes('data-case="oll-57"'));
});

test('PracticeView CLL keypad dynamically disables H5 and H6 when H group is selected', () => {
  const pv = new PracticeView({ container: createMockContainer() });
  const cllTrack = getTrack('222', 'cll');
  pv.currentPuzzle = '222';
  pv.currentTrackId = 'cll';
  pv.guessGroup = 'H';

  const html = pv.renderKeypadForTrack(cllTrack);
  assert.match(html, /data-case="4"(?![^>]*disabled)/);
  assert.match(html, /data-case="5"[^>]*disabled/);
  assert.match(html, /data-case="6"[^>]*disabled/);
});

test('PracticeView sprint double-submit lock prevents overlapping scramble submissions', async () => {
  let resolveScramble;
  const pv = new PracticeView({
    container: createMockContainer(),
    onGenerateScramble: () => new Promise(res => { resolveScramble = res; })
  });

  const cllTrack = getTrack('222', 'cll');
  pv.currentPuzzle = '222';
  pv.currentTrackId = 'cll';
  pv.sprintRunning = true;
  pv.currentCase = cllTrack.caseById.get('H1');
  pv.sprintSession = {
    durationMs: 60000,
    startedAt: Date.now(),
    endTime: Date.now() + 60000,
    attempts: 0,
    correct: 0,
    wrong: 0,
    perGroup: {},
    lastResult: null
  };

  const first = pv.submitSprintAnswer('H1');
  const second = pv.submitSprintAnswer('H1');
  assert.strictEqual(pv.sprintSession.attempts, 1);

  resolveScramble({ caseObj: cllTrack.caseById.get('H2') });
  await Promise.all([first, second]);
  assert.strictEqual(pv.sprintSession.attempts, 1);
  pv.deactivate();
});

test('PracticeView twoSidedMode triggers callback, deactivate releases it, and onKeyDown routes Enter/Space', () => {
  const changes = [];
  let verifyCalled = 0;
  let nextCalled = 0;

  const pv = new PracticeView({
    container: createMockContainer(),
    onTwoSidedModeChange: (enabled) => changes.push(enabled)
  });
  pv.currentPuzzle = '333';
  pv.currentTrackId = 'pll';
  pv.practiceMode = 'casual';
  pv.twoSidedMode = true;
  assert.strictEqual(pv.isTwoSidedActive(), true);

  pv.verifyCasualGuess = () => { verifyCalled++; pv.answered = true; };
  pv.advanceCasualScramble = () => { nextCalled++; };

  assert.strictEqual(pv.onKeyDown({ key: 'Enter', code: 'Enter', preventDefault() {} }), true);
  assert.strictEqual(verifyCalled, 1);

  assert.strictEqual(pv.onKeyDown({ key: ' ', code: 'Space', preventDefault() {} }), true);
  assert.strictEqual(nextCalled, 1);

  pv.deactivate();
  assert.strictEqual(changes.at(-1), false);
});
