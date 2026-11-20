import test from 'node:test';
import assert from 'node:assert';
import { createKeyboardRouter, isEditableElement } from '../src/ui/keyboardRouter.js';

function makeEvent(overrides = {}) {
  let prevented = false;
  return {
    key: '',
    code: '',
    target: null,
    preventDefault() { prevented = true; },
    get prevented() { return prevented; },
    ...overrides
  };
}

test('isEditableElement detects form inputs and contentEditable elements', () => {
  assert.strictEqual(isEditableElement({ tagName: 'input' }), true);
  assert.strictEqual(isEditableElement({ tagName: 'TEXTAREA' }), true);
  assert.strictEqual(isEditableElement({ tagName: 'SELECT' }), true);
  assert.strictEqual(isEditableElement({ tagName: 'DIV', isContentEditable: true }), true);
  assert.strictEqual(isEditableElement({ tagName: 'BUTTON' }), false);
});

test('createKeyboardRouter respects modalManager, Replay shortcuts, editable fields, and mode priority', () => {
  const calls = [];
  let modalOpen = true;
  let replayOpen = true;
  let mode = 'solve';

  const router = createKeyboardRouter({
    modalManager: {
      hasOpenModal: () => modalOpen,
      handleKeyDown: (e) => { calls.push(`modal:${e.key}`); }
    },
    getMode: () => mode,
    isReplayOpen: () => replayOpen,
    onReplayKey: (e) => { calls.push(`replay:${e.code || e.key}`); },
    onSolveKeyDown: (e) => { calls.push(`solveDown:${e.key}`); return e.key === ' '; },
    onSolveKeyUp: (e) => { calls.push(`solveUp:${e.key}`); return e.key === ' '; },
    onSimulateKeyDown: (e) => { calls.push(`sim:${e.key}`); return e.key === 'ArrowRight'; },
    onPracticeKeyDown: (e) => { calls.push(`practice:${e.key}`); return e.key === 'Enter'; },
    onFreeMoveKeyDown: (e) => { calls.push(`free:${e.key}`); return true; }
  });

  // 1. Replay open inside modalManager: Escape only goes to modalManager; Space goes to both modalManager + replay
  router.handleKeyDown(makeEvent({ key: 'Escape' }));
  assert.deepStrictEqual(calls.splice(0), ['modal:Escape']);

  router.handleKeyDown(makeEvent({ key: ' ', code: 'Space' }));
  assert.deepStrictEqual(calls.splice(0), ['modal: ', 'replay:Space']);

  // 2. Normal modal (no replay): steals keys from modes and free moves
  replayOpen = false;
  router.handleKeyDown(makeEvent({ key: 'R' }));
  assert.deepStrictEqual(calls.splice(0), ['modal:R']);

  // 3. No modal: ignores editable targets
  modalOpen = false;
  assert.strictEqual(router.handleKeyDown(makeEvent({ key: 'R', target: { tagName: 'INPUT' } })), false);
  assert.deepStrictEqual(calls, []);

  // 4. Mode handlers claim mode-specific keys before free moves fallback
  router.handleKeyDown(makeEvent({ key: ' ' }));
  assert.deepStrictEqual(calls.splice(0), ['solveDown: ']);

  router.handleKeyDown(makeEvent({ key: 'U' }));
  assert.deepStrictEqual(calls.splice(0), ['solveDown:U', 'free:U']);

  mode = 'practice';
  router.handleKeyDown(makeEvent({ key: 'Enter' }));
  assert.deepStrictEqual(calls.splice(0), ['practice:Enter']);

  router.handleKeyUp(makeEvent({ key: ' ' })); // not solve mode
  assert.deepStrictEqual(calls, []);

  mode = 'solve';
  assert.strictEqual(router.handleKeyUp(makeEvent({ key: ' ' })), true);
  assert.deepStrictEqual(calls.splice(0), ['solveUp: ']);
});
