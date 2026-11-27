import test from 'node:test';
import assert from 'node:assert';
import { AppStore } from '../src/state/appStore.js';
import { smartCube } from '../src/smartCube.js';
import { createTimerController, TOUCH_HOLD_MS } from '../src/features/solve/timerController.js';

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
    closest: () => null,
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
  const target = createMockElement('target');
  return {
    pointerType: 'touch',
    pointerId: 1,
    clientX: 100,
    clientY: 200,
    target,
    get defaultPrevented() { return defaultPrevented; },
    get propagationStopped() { return propagationStopped; },
    preventDefault() { defaultPrevented = true; },
    stopPropagation() { propagationStopped = true; },
    ...overrides
  };
}

test('touch handling triggers tap-to-inspect cleanly and arms in 200ms when inspection is off', async () => {
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

  try {
    assert.strictEqual(TOUCH_HOLD_MS, 200);

    // 1. Inspection ON: stationary tap starts inspection immediately on pointerup and swallows trailing click
    pad.dispatch('pointerdown', makeTouchEvent({ pointerId: 11, clientX: 120, clientY: 220 }));
    assert.strictEqual(timerCtrl.getSolveState(), 'idle');
    assert.strictEqual(pad.classList.contains('is-touch-holding'), true);

    doc.dispatch('pointerup', makeTouchEvent({ pointerId: 11, clientX: 123, clientY: 224 }));
    assert.strictEqual(timerCtrl.getSolveState(), 'inspecting');
    assert.strictEqual(pad.classList.contains('is-touch-holding'), false);

    const trailingClick = makeTouchEvent();
    doc.dispatch('click', trailingClick);
    assert.strictEqual(trailingClick.defaultPrevented, true);
    assert.strictEqual(trailingClick.propagationStopped, true);

    timerCtrl.cancelSolve();
    assert.strictEqual(timerCtrl.getSolveState(), 'idle');

    // 2. Inspection ON + finger scrolls > 10px: stays idle on pointerup
    pad.dispatch('pointerdown', makeTouchEvent({ pointerId: 12, clientX: 100, clientY: 200 }));
    doc.dispatch('pointermove', makeTouchEvent({ pointerId: 12, clientX: 100, clientY: 215 }));
    assert.strictEqual(pad.classList.contains('is-touch-holding'), false);
    doc.dispatch('pointerup', makeTouchEvent({ pointerId: 12, clientX: 100, clientY: 215 }));
    assert.strictEqual(timerCtrl.getSolveState(), 'idle');

    // 3. Inspection ON + pointercancel: stays idle on pointerup
    pad.dispatch('pointerdown', makeTouchEvent({ pointerId: 13, clientX: 100, clientY: 200 }));
    doc.dispatch('pointercancel', makeTouchEvent({ pointerId: 13 }));
    doc.dispatch('pointerup', makeTouchEvent({ pointerId: 13, clientX: 100, clientY: 200 }));
    assert.strictEqual(timerCtrl.getSolveState(), 'idle');

    // 4. Inspection OFF: quick tap before 200ms stays idle; stationary >= 200ms arms then starts on release
    store.state.solveInspection = false;
    pad.dispatch('pointerdown', makeTouchEvent({ pointerId: 14, clientX: 150, clientY: 250 }));
    await waitMs(40);
    doc.dispatch('pointerup', makeTouchEvent({ pointerId: 14, clientX: 150, clientY: 250 }));
    assert.strictEqual(timerCtrl.getSolveState(), 'idle');

    pad.dispatch('pointerdown', makeTouchEvent({ pointerId: 15, clientX: 150, clientY: 250 }));
    await waitMs(TOUCH_HOLD_MS + 40);
    assert.strictEqual(timerCtrl.getSolveState(), 'armed');
    doc.dispatch('pointerup', makeTouchEvent({ pointerId: 15, clientX: 150, clientY: 250 }));
    assert.strictEqual(timerCtrl.getSolveState(), 'running');
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
