import test from 'node:test';
import assert from 'node:assert';
import { createModalManager } from '../src/ui/modalManager.js';

function createMockElement(tagName = 'DIV') {
  const listeners = new Map();
  let focused = false;
  return {
    tagName,
    hidden: true,
    className: '',
    children: [],
    style: {},
    setAttribute() {},
    addEventListener(type, fn) {
      if (!listeners.has(type)) listeners.set(type, []);
      listeners.get(type).push(fn);
    },
    removeEventListener(type, fn) {
      const list = listeners.get(type) || [];
      listeners.set(type, list.filter(f => f !== fn));
    },
    dispatchEvent(evt) {
      for (const fn of (listeners.get(evt.type) || [])) fn(evt);
    },
    focus() { focused = true; },
    get focused() { return focused; },
    append(...els) { this.children.push(...els); },
    appendChild(el) { this.children.push(el); return el; },
    remove() {},
    querySelectorAll() { return []; },
    querySelector() { return null; }
  };
}

test('createModalManager manages modal stack, Escape closing top-only, focus restoration, and ref-counted scroll lock', () => {
  const triggerBtn = createMockElement('BUTTON');
  const doc = {
    activeElement: triggerBtn,
    createElement(tag) { return createMockElement(tag.toUpperCase()); }
  };
  const body = createMockElement('BODY');
  const mgr = createModalManager({ doc, body });

  const m1 = createMockElement();
  const m2 = createMockElement();
  const focus2 = createMockElement('INPUT');

  mgr.open(m1);
  assert.strictEqual(mgr.isOpen(m1), true);
  assert.strictEqual(mgr.getScrollLockCount(), 1);
  assert.strictEqual(body.style.overflow, 'hidden');

  doc.activeElement = focus2;
  let m2Closed = false;
  mgr.open(m2, { initialFocus: focus2, onClose: () => { m2Closed = true; } });
  assert.strictEqual(mgr.getScrollLockCount(), 2);
  assert.strictEqual(focus2.focused, true);

  // Escape closes top modal (m2) only, keeps scroll lock = 1
  const handled = mgr.handleKeyDown({ key: 'Escape', preventDefault() {} });
  assert.strictEqual(handled, true);
  assert.strictEqual(m2Closed, true);
  assert.strictEqual(mgr.isOpen(m2), false);
  assert.strictEqual(mgr.isOpen(m1), true);
  assert.strictEqual(mgr.getScrollLockCount(), 1);
  assert.strictEqual(body.style.overflow, 'hidden');

  // Closing m1 releases scroll lock and restores initial focus
  mgr.close(m1);
  assert.strictEqual(mgr.hasOpenModal(), false);
  assert.strictEqual(mgr.getScrollLockCount(), 0);
  assert.strictEqual(body.style.overflow, '');
  assert.strictEqual(triggerBtn.focused, true);
});

test('createModalManager confirmDialog and promptDialog resolve cleanly on click and Escape', async () => {
  const buttons = [];
  let createdInput = null;
  function makeEl(tagName = 'DIV') {
    const el = createMockElement(tagName);
    if (tagName === 'BUTTON') buttons.push(el);
    if (tagName === 'INPUT') createdInput = el;
    return el;
  }
  const doc = { activeElement: null, createElement: tag => makeEl(tag.toUpperCase()) };
  const body = createMockElement('BODY');
  const mgr = createModalManager({ doc, body });

  const confirmPromise = mgr.confirmDialog({ title: 'Delete?', confirmLabel: 'Yes' });
  const yesBtn = buttons.find(b => b.textContent === 'Yes');
  assert.ok(yesBtn);
  yesBtn.dispatchEvent({ type: 'click' });
  assert.strictEqual(await confirmPromise, true);

  const promptPromise = mgr.promptDialog({ title: 'Name', defaultValue: 'Session 1', confirmLabel: 'Save' });
  assert.ok(createdInput);
  createdInput.value = 'My OH';
  const saveBtn = buttons.find(b => b.textContent === 'Save');
  saveBtn.dispatchEvent({ type: 'click' });
  assert.strictEqual(await promptPromise, 'My OH');

  const escapePromise = mgr.confirmDialog({ title: 'Cancelable' });
  mgr.handleKeyDown({ key: 'Escape', preventDefault() {} });
  assert.strictEqual(await escapePromise, false);
});
