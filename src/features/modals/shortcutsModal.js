// Customizable Keyboard Shortcuts Modal Controller

import {
  SHORTCUT_CATEGORIES,
  SHORTCUT_ACTIONS,
  DEFAULT_SHORTCUTS,
  eventToKeyCombo,
  formatKeyCombo,
  isReservedTimerCombo
} from '../../services/keyboardShortcuts.js';
import { escapeHtml } from '../../services/htmlUtils.js';
import { showToast } from '../../ui/toastService.js';

export function createShortcutsModalController({
  appStore,
  modalManager
} = {}) {
  const modal = typeof document !== "undefined" ? document.getElementById("shortcutsModal") : null;
  const closeBtn = typeof document !== "undefined" ? document.getElementById("shortcutsModalCloseBtn") : null;
  const doneBtn = typeof document !== "undefined" ? document.getElementById("shortcutsDoneBtn") : null;
  const resetBtn = typeof document !== "undefined" ? document.getElementById("shortcutsResetAllBtn") : null;
  const searchInput = typeof document !== "undefined" ? document.getElementById("shortcutsSearchInput") : null;
  const listEl = typeof document !== "undefined" ? document.getElementById("shortcutsListContainer") : null;

  let listeningActionId = null;

  function stopListening() {
    listeningActionId = null;
  }

  function render() {
    if (!listEl) return;
    const overrides = appStore.state.keyboardShortcuts || {};
    const effective = appStore.getKeyboardShortcuts();
    const query = (searchInput?.value || "").trim().toLowerCase();

    const sectionsHtml = SHORTCUT_CATEGORIES.map(cat => {
      const actions = SHORTCUT_ACTIONS.filter(a => {
        if (a.category !== cat.id) return false;
        if (!query) return true;
        const bound = effective[a.id] || "";
        const boundLabel = formatKeyCombo(bound).toLowerCase();
        return a.label.toLowerCase().includes(query) ||
          a.id.toLowerCase().includes(query) ||
          boundLabel.includes(query);
      });
      if (actions.length === 0) return "";

      const rowsHtml = actions.map(act => {
        const isListening = listeningActionId === act.id;
        const combo = effective[act.id] || "";
        const isDefault = Boolean(combo) && DEFAULT_SHORTCUTS[act.id] === combo && !(act.id in overrides);
        const keyText = isListening
          ? "Press key… (Esc cancels)"
          : (combo ? formatKeyCombo(combo) : "Not set");
        return `
          <div class="shortcut-row ${isListening ? "is-recording" : ""}">
            <div class="shortcut-action-meta">
              <span class="shortcut-action-label">${escapeHtml(act.label)}</span>
              ${isDefault ? '<span class="shortcut-default-badge">default</span>' : ""}
            </div>
            <div class="shortcut-row-controls">
              <button type="button" class="shortcut-bind-btn ${combo ? "is-bound" : ""} ${isListening ? "is-recording" : ""}" data-shortcut-bind="${escapeHtml(act.id)}" title="Click and press a key combination">${escapeHtml(keyText)}</button>
              <button type="button" class="btn btn-xs shortcut-clear-btn" data-shortcut-clear="${escapeHtml(act.id)}" title="Clear shortcut" ${combo ? "" : "disabled"}>&times;</button>
            </div>
          </div>
        `;
      }).join("");

      return `
        <div class="shortcut-category">
          <div class="shortcut-category-head">
            <h4 class="shortcut-category-title">${escapeHtml(cat.title)}</h4>
            <span class="shortcut-category-desc">${escapeHtml(cat.description)}</span>
          </div>
          <div class="shortcut-rows-grid">${rowsHtml}</div>
        </div>
      `;
    }).filter(Boolean).join("");

    listEl.innerHTML = sectionsHtml || `<p class="empty-stats" style="text-align: center; padding: 20px;">No shortcuts match "${escapeHtml(query)}".</p>`;

    listEl.querySelectorAll("[data-shortcut-bind]").forEach(btn => {
      btn.addEventListener("click", () => {
        const actionId = btn.dataset.shortcutBind;
        if (!actionId) return;
        listeningActionId = listeningActionId === actionId ? null : actionId;
        render();
      });
    });

    listEl.querySelectorAll("[data-shortcut-clear]").forEach(btn => {
      btn.addEventListener("click", () => {
        const actionId = btn.dataset.shortcutClear;
        if (!actionId) return;
        if (listeningActionId === actionId) stopListening();
        appStore.setKeyboardShortcut(actionId, "");
        render();
      });
    });
  }

  function handleCaptureKeyDown(e) {
    if (!listeningActionId || !modal || modal.hidden) return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation?.();
    if (e.key === "Escape" && !e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey) {
      stopListening();
      render();
      return;
    }
    const combo = eventToKeyCombo(e);
    if (!combo) return; // Wait for non-modifier key
    if (isReservedTimerCombo(combo)) {
      showToast("Space and Esc are reserved for timer start/stop and dialogs.", "warning", 2800);
      return;
    }
    const targetActionId = listeningActionId;
    stopListening();
    const res = appStore.setKeyboardShortcut(targetActionId, combo);
    render();
    if (res?.replacedActionId) {
      const replaced = SHORTCUT_ACTIONS.find(a => a.id === res.replacedActionId);
      if (replaced) {
        showToast(`Reassigned "${formatKeyCombo(combo)}" from ${replaced.label}.`, "info", 2600);
      }
    }
  }

  if (typeof document !== "undefined") {
    document.addEventListener("keydown", handleCaptureKeyDown, true);
  }

  function open() {
    if (!modal) return;
    stopListening();
    if (searchInput) searchInput.value = "";
    render();
    modalManager.open(modal, {
      initialFocus: searchInput || closeBtn,
      onClose: () => { stopListening(); }
    });
  }

  function close() {
    stopListening();
    if (modal) modalManager.close(modal);
  }

  closeBtn?.addEventListener("click", close);
  doneBtn?.addEventListener("click", close);
  searchInput?.addEventListener("input", () => {
    stopListening();
    render();
  });
  resetBtn?.addEventListener("click", async () => {
    const ok = await modalManager.confirmDialog({
      title: "Reset Keyboard Shortcuts",
      message: "Restore default Free Turn bindings (U, D, L, R, F, B, Backspace) and clear all other custom shortcuts?",
      confirmLabel: "Reset Defaults"
    });
    if (!ok) return;
    stopListening();
    appStore.resetKeyboardShortcuts();
    render();
    showToast("Keyboard shortcuts reset to defaults.", "info", 2200);
  });

  appStore?.subscribe?.((evt) => {
    if ((evt === "hydrate" || evt === "shortcuts") && modal && !modal.hidden) {
      render();
    }
  });

  return {
    open,
    close,
    render
  };
}
