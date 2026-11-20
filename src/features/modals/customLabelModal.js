// Custom Trigger / Algorithm Label Editor Modal

export function createCustomLabelModal({ modalManager } = {}) {
  const modal = typeof document !== "undefined" ? document.getElementById("customLabelModal") : null;
  const titleEl = typeof document !== "undefined" ? document.getElementById("customLabelTitle") : null;
  const algNotationEl = typeof document !== "undefined" ? document.getElementById("customLabelAlgNotation") : null;
  const inputEl = typeof document !== "undefined" ? document.getElementById("customLabelInput") : null;
  const closeBtn = typeof document !== "undefined" ? document.getElementById("customLabelCloseBtn") : null;
  const cancelBtn = typeof document !== "undefined" ? document.getElementById("customLabelCancelBtn") : null;
  const saveBtn = typeof document !== "undefined" ? document.getElementById("customLabelSaveBtn") : null;
  const resetBtn = typeof document !== "undefined" ? document.getElementById("customLabelResetBtn") : null;

  let onSaveCb = null;
  let onResetCb = null;

  function open({ id, defaultLabel, rawAlg, currentLabel, onSave, onReset } = {}) {
    if (!modal) return;
    if (titleEl) titleEl.textContent = `Customize Label (${id || ""})`;
    if (algNotationEl) algNotationEl.textContent = rawAlg || "";
    if (inputEl) inputEl.value = currentLabel || defaultLabel || "";
    onSaveCb = typeof onSave === "function" ? onSave : null;
    onResetCb = typeof onReset === "function" ? onReset : null;
    modalManager.open(modal, {
      initialFocus: inputEl,
      onClose: () => {
        onSaveCb = null;
        onResetCb = null;
      }
    });
  }

  function close() {
    if (modal) modalManager.close(modal);
  }

  closeBtn?.addEventListener("click", close);
  cancelBtn?.addEventListener("click", close);
  saveBtn?.addEventListener("click", () => {
    const val = inputEl?.value.trim() || "";
    onSaveCb?.(val);
    close();
  });
  resetBtn?.addEventListener("click", () => {
    onResetCb?.();
    close();
  });
  inputEl?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const val = inputEl.value.trim();
      onSaveCb?.(val);
      close();
    }
  });

  return { open, close };
}
