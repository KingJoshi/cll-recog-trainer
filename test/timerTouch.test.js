import test from 'node:test';
import assert from 'node:assert';
import { AppStore } from '../src/state/appStore.js';
import { smartCube } from '../src/smartCube.js';
import {
  createTimerController,
  TOUCH_HOLD_MS,
  TOUCH_CANCEL_SLIDE_PX
} from '../src/features/solve/timerController.js';

function createMockClassList() {
  const set = new Set();
  return {
    add: (...names) => names.forEach(n => set.add(n)),
    remove: (...names) => names.forEach(n => set.delete(n)),
    contains: name => set.has(name)
  };
}

function createMockElement(id = '') {
  const listeners = new Map();
  return {
    id,
    hidden: false,
    className: '',
    textContent: '',
    classList: createMockClassList(),
    closest: selector => (selector === `#${id}` ? true : null),
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(fn);
    },
    dispatch(type, event = {}) {
      for (const fn of listeners.get(type) || []) {
        fn(event);
      }
    }
  };
}

function createMockDom() {
  const elements = new Map([
    ['solveSurface', createMockElement('solveSurface')],
    ['solveTimerPad', createMockElement('solveTimerPad')],
    ['solveOverlay', createMockElement('solveOverlay')],
    ['solveOverlayTime', createMockElement('solveOverlayTime')],
    ['solveOverlayHint', createMockElement('solveOverlayHint')],
    ['solveOverlayCancelBtn', createMockElement('solveOverlayCancelBtn')],
    ['solveLiveStats', createMockElement('solveLiveStats')],
    ['solveLiveMovesCount', createMockElement('solveLiveMovesCount')],
    ['solveLiveTps', createMockElement('solveLiveTps')],
    ['solvePostSummary', createMockElement('solvePostSummary')]
  ]);
  const docListeners = new Map();

  const doc = {
    activeElement: null,
    documentElement: { style: { setProperty() {} } },
    querySelector: () => null,
    getElementById: id => elements.get(id) || null,
    addEventListener(type, fn, capture = false) {
      if (!docListeners.has(type)) docListeners.set(type, []);
      docListeners.get(type).push({ fn, capture: Boolean(capture) });
    },
    dispatch(type, event = {}) {
      for (const { fn } of docListeners.get(type) || []) {
        fn(event);
      }
    }
  };

  return { doc, elements };
}

function waitMs(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function makeTouchEvent(overrides = {}) {
  let defaultPrevented = false;
  let propagationStopped = false;
  const fallbackTarget = { closest: () => null };
  return {
    pointerType: 'touch',
    pointerId: 1,
    clientX: 100,
    clientY: 200,
    target: fallbackTarget,
    get defaultPrevented() { return defaultPrevented; },
    get propagationStopped() { return propagationStopped; },
    preventDefault() { defaultPrevented = true; },
    stopPropagation() { propagationStopped = true; },
    ...overrides
  };
}

test('touch handling triggers tap-to-inspect and supports mobile cancel across inspecting, armed, and running', async () => {
  const prevDoc = globalThis.document;
  const prevHtmlElement = globalThis.HTMLElement;
  const prevStatus = smartCube.status;
  const prevIsVirtual = smartCube.isVirtual;

  const { doc, elements } = createMockDom();
  globalThis.document = doc;
  if (typeof globalThis.HTMLElement === 'undefined') {
    globalThis.HTMLElement = class MockHTMLElement {};
  }
  smartCube.status = 'disconnected';
  smartCube.isVirtual = false;

  const store = new AppStore();
  store.state.mode = 'solve';
  store.state.currentPuzzle = '333';
  store.state.solveTarget = 'full';
  store.state.solveInspection = true;

  const timerCtrl = createTimerController({
    appStore: store,
    solveReplayViewer: { open: () => {} }
  });

  const pad = elements.get('solveTimerPad');
  const overlay = elements.get('solveOverlay');
  const overlayHint = elements.get('solveOverlayHint');
  const cancelBtn = elements.get('solveOverlayCancelBtn');

  try {
    assert.strictEqual(TOUCH_HOLD_MS, 200);
    assert.strictEqual(TOUCH_CANCEL_SLIDE_PX, 50);

    // 1. Inspection ON: stationary tap starts inspection immediately on pointerup with touch hint & swallows trailing click
    pad.dispatch('pointerdown', makeTouchEvent({ pointerId: 11, clientX: 120, clientY: 220 }));
    assert.strictEqual(timerCtrl.getSolveState(), 'idle');
    assert.strictEqual(pad.classList.contains('is-touch-holding'), true);

    doc.dispatch('pointerup', makeTouchEvent({ pointerId: 11, clientX: 123, clientY: 224 }));
    assert.strictEqual(timerCtrl.getSolveState(), 'inspecting');
    assert.strictEqual(pad.classList.contains('is-touch-holding'), false);
    assert.strictEqual(cancelBtn.hidden, false);
    assert.ok(overlayHint.textContent.includes('Swipe or tap Cancel'));

    const trailingInspectClick = makeTouchEvent();
    doc.dispatch('click', trailingInspectClick);
    assert.strictEqual(trailingInspectClick.defaultPrevented, true);
    assert.strictEqual(trailingInspectClick.propagationStopped, true);

    // 2. Inspecting -> tap #solveOverlayCancelBtn cancels cleanly, hides overlay, prevents click-through
    const cancelBtnTap = makeTouchEvent({ pointerId: 12, target: cancelBtn });
    overlay.dispatch('pointerdown', cancelBtnTap);
    assert.strictEqual(timerCtrl.getSolveState(), 'idle');
    assert.strictEqual(overlay.hidden, true);
    assert.strictEqual(cancelBtnTap.defaultPrevented, true);
    assert.strictEqual(cancelBtnTap.propagationStopped, true);

    const trailingCancelClick = makeTouchEvent();
    doc.dispatch('click', trailingCancelClick);
    assert.strictEqual(trailingCancelClick.defaultPrevented, true);
    assert.strictEqual(trailingCancelClick.propagationStopped, true);

    // 3. Inspection ON + finger scrolls > 10px: stays idle on pointerup
    pad.dispatch('pointerdown', makeTouchEvent({ pointerId: 13, clientX: 100, clientY: 200 }));
    doc.dispatch('pointermove', makeTouchEvent({ pointerId: 13, clientX: 100, clientY: 215 }));
    assert.strictEqual(pad.classList.contains('is-touch-holding'), false);
    doc.dispatch('pointerup', makeTouchEvent({ pointerId: 13, clientX: 100, clientY: 215 }));
    assert.strictEqual(timerCtrl.getSolveState(), 'idle');

    // 4. Inspection ON + pointercancel: stays idle on pointerup
    pad.dispatch('pointerdown', makeTouchEvent({ pointerId: 14, clientX: 100, clientY: 200 }));
    doc.dispatch('pointercancel', makeTouchEvent({ pointerId: 14 }));
    doc.dispatch('pointerup', makeTouchEvent({ pointerId: 14, clientX: 100, clientY: 200 }));
    assert.strictEqual(timerCtrl.getSolveState(), 'idle');

    // 5. Inspecting -> swipe >= TOUCH_CANCEL_SLIDE_PX on overlay cancels inspection and aborts pending arm timer
    pad.dispatch('pointerdown', makeTouchEvent({ pointerId: 15, clientX: 100, clientY: 200 }));
    doc.dispatch('pointerup', makeTouchEvent({ pointerId: 15, clientX: 100, clientY: 200 }));
    assert.strictEqual(timerCtrl.getSolveState(), 'inspecting');

    overlay.dispatch('pointerdown', makeTouchEvent({ pointerId: 16, clientX: 160, clientY: 260 }));
    doc.dispatch('pointermove', makeTouchEvent({ pointerId: 16, clientX: 160, clientY: 260 + TOUCH_CANCEL_SLIDE_PX + 10 }));
    assert.strictEqual(timerCtrl.getSolveState(), 'idle');
    await waitMs(170);
    doc.dispatch('pointerup', makeTouchEvent({ pointerId: 16, clientX: 160, clientY: 320 }));
    assert.strictEqual(timerCtrl.getSolveState(), 'idle');

    // 6. Inspection OFF: quick tap before 200ms stays idle
    store.state.solveInspection = false;
    pad.dispatch('pointerdown', makeTouchEvent({ pointerId: 17, clientX: 150, clientY: 250 }));
    await waitMs(40);
    doc.dispatch('pointerup', makeTouchEvent({ pointerId: 17, clientX: 150, clientY: 250 }));
    assert.strictEqual(timerCtrl.getSolveState(), 'idle');

    // 7. Armed (held >= 200ms) -> slide >= TOUCH_CANCEL_SLIDE_PX cancels instead of starting on release
    pad.dispatch('pointerdown', makeTouchEvent({ pointerId: 18, clientX: 150, clientY: 250 }));
    await waitMs(TOUCH_HOLD_MS + 40);
    assert.strictEqual(timerCtrl.getSolveState(), 'armed');
    assert.ok(overlayHint.textContent.includes('Slide away to cancel'));
    doc.dispatch('pointermove', makeTouchEvent({ pointerId: 18, clientX: 150 + TOUCH_CANCEL_SLIDE_PX + 5, clientY: 250 }));
    assert.strictEqual(timerCtrl.getSolveState(), 'idle');
    doc.dispatch('pointerup', makeTouchEvent({ pointerId: 18, clientX: 210, clientY: 250 }));
    assert.strictEqual(timerCtrl.getSolveState(), 'idle');

    // 8. Armed -> clean release starts running; Cancel button stays visible and tapping it aborts without recording a solve
    pad.dispatch('pointerdown', makeTouchEvent({ pointerId: 19, clientX: 150, clientY: 250 }));
    await waitMs(TOUCH_HOLD_MS + 40);
    assert.strictEqual(timerCtrl.getSolveState(), 'armed');
    doc.dispatch('pointerup', makeTouchEvent({ pointerId: 19, clientX: 150, clientY: 250 }));
    assert.strictEqual(timerCtrl.getSolveState(), 'running');
    assert.strictEqual(cancelBtn.hidden, false);
    assert.ok(overlayHint.textContent.includes('Cancel'));

    const solvesBeforeCancel = store.getSolves().length;
    overlay.dispatch('pointerdown', makeTouchEvent({ pointerId: 20, target: cancelBtn }));
    assert.strictEqual(timerCtrl.getSolveState(), 'idle');
    assert.strictEqual(overlay.hidden, true);
    assert.strictEqual(store.getSolves().length, solvesBeforeCancel);
  } finally {
    timerCtrl.cancelSolve();
    smartCube.status = prevStatus;
    smartCube.isVirtual = prevIsVirtual;
    if (prevDoc === undefined) delete globalThis.document;
    else globalThis.document = prevDoc;
    if (prevHtmlElement === undefined) delete globalThis.HTMLElement;
    else globalThis.HTMLElement = prevHtmlElement;
  }
});
