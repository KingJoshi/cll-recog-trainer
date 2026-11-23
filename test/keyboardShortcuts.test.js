import test from 'node:test';
import assert from 'node:assert';
import {
  DEFAULT_SHORTCUTS,
  eventToKeyCombo,
  formatKeyCombo,
  isReservedTimerCombo,
  sanitizeShortcutOverrides,
  getEffectiveShortcutsMap,
  findActionForCombo,
  assignShortcutOverride
} from '../src/services/keyboardShortcuts.js';
import { PUZZLES, getSolveTargetsForPuzzle, getSolveTargetLabel } from '../src/data/algRegistry.js';
import { AppStore } from '../src/state/appStore.js';
import { smartCube } from '../src/smartCube.js';
import { createTimerController } from '../src/features/solve/timerController.js';
import { createKeyboardRouter } from '../src/ui/keyboardRouter.js';

test('eventToKeyCombo, formatKeyCombo, and isReservedTimerCombo normalize key events accurately', () => {
  assert.strictEqual(eventToKeyCombo({ key: 'Shift', code: 'ShiftLeft', shiftKey: true }), '');
  assert.strictEqual(eventToKeyCombo({ key: 'Control', code: 'ControlLeft', ctrlKey: true }), '');
  assert.strictEqual(eventToKeyCombo({ key: 'r', code: 'KeyR' }), 'KeyR');
  assert.strictEqual(eventToKeyCombo({ key: 'R', code: 'KeyR', shiftKey: true }), 'Shift+KeyR');
  assert.strictEqual(eventToKeyCombo({ key: '2', code: 'Digit2', altKey: true }), 'Alt+Digit2');
  assert.strictEqual(eventToKeyCombo({ key: 'r' }), 'KeyR');

  assert.strictEqual(formatKeyCombo('KeyR'), 'R');
  assert.strictEqual(formatKeyCombo('Shift+KeyR'), 'Shift + R');
  assert.strictEqual(formatKeyCombo('Alt+Digit2'), 'Alt + 2');
  assert.strictEqual(formatKeyCombo('Meta+Slash'), 'Cmd + /');

  assert.strictEqual(isReservedTimerCombo('Space'), true);
  assert.strictEqual(isReservedTimerCombo('Escape'), true);
  assert.strictEqual(isReservedTimerCombo('Alt+Space'), false);
  assert.strictEqual(isReservedTimerCombo('KeyR'), false);
});

test('assignShortcutOverride supports separate R / R\' / R2 bindings, resolves conflicts, and clears defaults', () => {
  let overrides = {};
  overrides = assignShortcutOverride(overrides, "move:R", "KeyK").next;
  overrides = assignShortcutOverride(overrides, "move:R'", "KeyI").next;
  overrides = assignShortcutOverride(overrides, "move:R2", "KeyU").next;

  const map = getEffectiveShortcutsMap(overrides);
  assert.strictEqual(findActionForCombo(map, 'KeyK'), 'move:R');
  assert.strictEqual(findActionForCombo(map, 'KeyI'), "move:R'");
  assert.strictEqual(findActionForCombo(map, 'KeyU'), 'move:R2');
  // Rebinding KeyU to move:R2 automatically cleared the default move:U -> KeyU binding
  assert.strictEqual(map['move:U'], '');

  // Explicit unbinding of default remains "" in sanitized overrides
  const sanitized = sanitizeShortcutOverrides(overrides);
  assert.strictEqual(sanitized['move:U'], '');

  // Bare Space / Escape are rejected
  const reservedRes = assignShortcutOverride(overrides, 'puzzle:333', 'Space');
  assert.strictEqual(reservedRes.reserved, true);
  assert.strictEqual(findActionForCombo(getEffectiveShortcutsMap(reservedRes.next), 'Space'), null);
});

test('AppStore persists keyboardShortcuts overrides cleanly', () => {
  const store = new AppStore();
  const res = store.setKeyboardShortcut('puzzle:333', 'Digit2');
  assert.strictEqual(res.reserved, undefined);
  assert.strictEqual(store.getKeyboardShortcuts()['puzzle:333'], 'Digit2');
  assert.strictEqual(store.getSettingsPayload().keyboardShortcuts['puzzle:333'], 'Digit2');

  store.resetKeyboardShortcuts();
  assert.deepStrictEqual(store.state.keyboardShortcuts, {});
  assert.strictEqual(store.getKeyboardShortcuts()['move:U'], DEFAULT_SHORTCUTS['move:U']);
});

test('timerController.onSolveKeyDown enforces Space-only start, any-key regular stop, and Space-only virtual cube stop', () => {
  const prevStatus = smartCube.status;
  const prevIsVirtual = smartCube.isVirtual;

  const store = new AppStore();
  store.state.mode = 'solve';
  store.state.currentPuzzle = '333';
  store.state.solveTarget = 'full';
  store.state.solveInspection = false;

  const timerCtrl = createTimerController({
    appStore: store,
    solveReplayViewer: { open: () => {} }
  });

  try {
    // 1. Starting only works with Space, not random keys
    smartCube.status = 'disconnected';
    smartCube.isVirtual = false;
    assert.strictEqual(timerCtrl.onSolveKeyDown({ key: 'a', code: 'KeyA', preventDefault() {} }), false);
    assert.strictEqual(timerCtrl.getSolveState(), 'idle');

    assert.strictEqual(timerCtrl.onSolveKeyDown({ key: ' ', code: 'Space', preventDefault() {} }), true);
    assert.strictEqual(timerCtrl.getSolveState(), 'armed');
    timerCtrl.onSolveKeyUp({ key: ' ', code: 'Space', preventDefault() {} });
    assert.strictEqual(timerCtrl.getSolveState(), 'running');

    // 2. Pure modifier keys do not stop the running timer
    assert.strictEqual(timerCtrl.onSolveKeyDown({ key: 'Shift', code: 'ShiftLeft', shiftKey: true, preventDefault() {} }), false);
    assert.strictEqual(timerCtrl.getSolveState(), 'running');

    // 3. Regular solve stops on any non-modifier key
    assert.strictEqual(timerCtrl.onSolveKeyDown({ key: 'k', code: 'KeyK', preventDefault() {} }), true);
    assert.strictEqual(timerCtrl.getSolveState(), 'idle');

    // 4. Virtual Smart Cube solve: non-Space keys pass through, ONLY Space stops the timer
    smartCube.status = 'connected';
    smartCube.isVirtual = true;
    timerCtrl.onSolveKeyDown({ key: ' ', code: 'Space', preventDefault() {} });
    timerCtrl.onSolveKeyUp({ key: ' ', code: 'Space', preventDefault() {} });
    assert.strictEqual(timerCtrl.getSolveState(), 'running');

    assert.strictEqual(timerCtrl.onSolveKeyDown({ key: 'i', code: 'KeyI', preventDefault() {} }), false);
    assert.strictEqual(timerCtrl.getSolveState(), 'running');
    assert.strictEqual(timerCtrl.onSolveKeyDown({ key: 'r', code: 'KeyR', preventDefault() {} }), false);
    assert.strictEqual(timerCtrl.getSolveState(), 'running');

    assert.strictEqual(timerCtrl.onSolveKeyDown({ key: ' ', code: 'Space', preventDefault() {} }), true);
    assert.strictEqual(timerCtrl.getSolveState(), 'idle');
  } finally {
    timerCtrl.cancelSolve();
    smartCube.status = prevStatus;
    smartCube.isVirtual = prevIsVirtual;
  }
});

test('createKeyboardRouter routes custom shortcuts after mode handlers and mounts keydown in capture phase', () => {
  const calls = [];
  const listeners = [];
  const mockTarget = {
    addEventListener: (type, fn, capture) => listeners.push({ type, fn, capture }),
    removeEventListener: () => {}
  };

  const router = createKeyboardRouter({
    getMode: () => 'solve',
    onSolveKeyDown: (e) => e.code === 'Space',
    onCustomShortcutKeyDown: (e) => {
      calls.push(`custom:${e.code}`);
      return e.code === 'KeyK';
    },
    onFreeMoveKeyDown: () => {
      calls.push('free');
      return true;
    }
  });

  router.mount(mockTarget);
  const keydownListener = listeners.find(l => l.type === 'keydown');
  assert.ok(keydownListener);
  assert.strictEqual(keydownListener.capture, true);

  assert.strictEqual(router.handleKeyDown({ key: 'k', code: 'KeyK' }), true);
  assert.deepStrictEqual(calls, ['custom:KeyK']);
});

test('puzzle track shortNames and Solve targets omit (9)/(12)/(40)/(41)/(57)/(21) count suffixes', () => {
  const badSuffixRe = /\((9|12|21|40|41|57)\)/;
  for (const puzzle of Object.values(PUZZLES)) {
    for (const track of (puzzle.tracks || [])) {
      assert.strictEqual(badSuffixRe.test(track.shortName || ''), false, `Track ${puzzle.id}:${track.id} shortName "${track.shortName}" has count suffix`);
    }
    for (const item of getSolveTargetsForPuzzle(puzzle.id)) {
      assert.strictEqual(badSuffixRe.test(item.shortName || ''), false, `Target ${puzzle.id}:${item.id} shortName "${item.shortName}" has count suffix`);
      assert.strictEqual(badSuffixRe.test(item.name || ''), false, `Target ${puzzle.id}:${item.id} name "${item.name}" has count suffix`);
    }
  }
  assert.strictEqual(getSolveTargetLabel('222', 'lbl'), 'LBL');
  assert.strictEqual(getSolveTargetLabel('222', 'cll'), 'CLL');
  assert.strictEqual(getSolveTargetLabel('222', 'eg1'), 'EG-1');
  assert.strictEqual(getSolveTargetLabel('222', 'eg2'), 'EG-2');
});
