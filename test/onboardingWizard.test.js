import test from 'node:test';
import assert from 'node:assert';
import { recommendTrainingPlan } from '../src/features/onboarding/onboardingWizard.js';
import { AppStore } from '../src/state/appStore.js';
import { PUZZLES, getTrack, getSolveTargetInfo } from '../src/data/algRegistry.js';

const LEVELS = ['beginner', 'intermediate', 'advanced', 'expert'];
const GOALS = ['learn', 'practice', 'solve'];
const PUZZLE_IDS = Object.keys(PUZZLES);

test('recommendTrainingPlan returns valid track, solve target, mode, ohHand, and case IDs for all puzzle/level/goal combinations', () => {
  for (const puzzle of PUZZLE_IDS) {
    for (const level of LEVELS) {
      for (const goal of GOALS) {
        for (const ohHand of ['left', 'right']) {
          const plan = recommendTrainingPlan({ puzzle, level, goal, ohHand });
          assert.strictEqual(plan.puzzle, puzzle);
          assert.strictEqual(plan.ohHand, ohHand);
          assert.strictEqual(plan.goal, goal);

          const expectedMode = goal === 'learn' ? 'study' : goal === 'practice' ? 'practice' : 'solve';
          assert.strictEqual(plan.mode, expectedMode);

          const track = getTrack(plan.puzzle, plan.trackId);
          assert.ok(track, `Track ${plan.trackId} must exist for ${puzzle}`);

          const targetInfo = getSolveTargetInfo(plan.puzzle, plan.solveTarget);
          assert.ok(targetInfo, `Solve target ${plan.solveTarget} must exist for ${puzzle}`);

          if (plan.starterCaseIds) {
            assert.ok(Array.isArray(plan.starterCaseIds) && plan.starterCaseIds.length > 0);
            for (const cid of plan.starterCaseIds) {
              assert.ok(track.caseById.has(cid), `Starter case ${cid} must exist in ${puzzle}:${plan.trackId}`);
            }
          }
          assert.ok(plan.title && plan.summary && plan.nextStepTip);
        }
      }
    }
  }
});

test('recommendTrainingPlan matches beginner -> expert progression for 2x2 and OH handedness on 3x3oh', () => {
  const plan222Beg = recommendTrainingPlan({ puzzle: '222', level: 'beginner', goal: 'learn' });
  assert.strictEqual(plan222Beg.trackId, 'lbl');
  assert.strictEqual(plan222Beg.mode, 'study');

  const plan222Int = recommendTrainingPlan({ puzzle: '222', level: 'intermediate', goal: 'practice' });
  assert.strictEqual(plan222Int.trackId, 'ortega');
  assert.strictEqual(plan222Int.mode, 'practice');

  const plan222Adv = recommendTrainingPlan({ puzzle: '222', level: 'advanced', goal: 'solve' });
  assert.strictEqual(plan222Adv.trackId, 'cll');
  assert.strictEqual(plan222Adv.solveTarget, 'full');
  assert.strictEqual(plan222Adv.mode, 'solve');

  const plan222Exp = recommendTrainingPlan({ puzzle: '222', level: 'expert', goal: 'learn' });
  assert.strictEqual(plan222Exp.trackId, 'eg1');
  assert.strictEqual(plan222Exp.mode, 'study');

  const planOhRight = recommendTrainingPlan({ puzzle: '333oh', level: 'intermediate', goal: 'learn', ohHand: 'right' });
  assert.strictEqual(planOhRight.ohHand, 'right');
  assert.match(planOhRight.title, /Right Hand/);

  const plan333Beg = recommendTrainingPlan({ puzzle: '333', level: 'beginner', goal: 'learn' });
  assert.strictEqual(plan333Beg.trackId, 'oll');
  assert.strictEqual(plan333Beg.starterCaseIds?.length, 7);

  const plan333Int = recommendTrainingPlan({ puzzle: '333', level: 'intermediate', goal: 'practice' });
  assert.strictEqual(plan333Int.trackId, 'pll');
  assert.strictEqual(plan333Int.starterCaseIds, null);

  const plan333AdvLearn = recommendTrainingPlan({ puzzle: '333', level: 'advanced', goal: 'learn' });
  assert.strictEqual(plan333AdvLearn.trackId, 'oll');
  assert.strictEqual(plan333AdvLearn.studyView, 'twosided');

  const plan333AdvPrac = recommendTrainingPlan({ puzzle: '333', level: 'advanced', goal: 'practice' });
  assert.strictEqual(plan333AdvPrac.trackId, 'pll');
  assert.strictEqual(plan333AdvPrac.twoSidedMode, true);
});

test('AppStore defaults onboardingCompleted to false on clean storage and true when prior settings exist', () => {
  const store = {};
  const prevStorage = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; }
  };
  try {
    const cleanApp = new AppStore();
    assert.strictEqual(cleanApp.state.onboardingCompleted, false);
    assert.strictEqual(cleanApp.state.showTooltips, true);
    assert.strictEqual(cleanApp.state.ohHand, 'left');
    assert.strictEqual(cleanApp.state.simSpeed, 1);

    cleanApp.setOhHand('right');
    cleanApp.setSimSpeed(0.5);
    cleanApp.setSimSpeed(99);
    assert.strictEqual(cleanApp.state.ohHand, 'right');
    assert.strictEqual(cleanApp.state.simSpeed, 0.5);
    const reloadedApp = new AppStore();
    assert.strictEqual(reloadedApp.state.ohHand, 'right');
    assert.strictEqual(reloadedApp.state.simSpeed, 0.5);

    store.cllTrainerSettings = JSON.stringify({ currentPuzzle: '333' });
    const returningApp = new AppStore();
    assert.strictEqual(returningApp.state.onboardingCompleted, true);
  } finally {
    globalThis.localStorage = prevStorage;
  }
});
