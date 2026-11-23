// Single unified keyboard router (replaces multiple colliding document/window key listeners)
// Priority: active modal -> ignore editable fields -> active replay viewer -> active mode -> Free Face Turns

export function isEditableElement(target) {
  if (!target) return false;
  const tag = String(target.tagName || "").toUpperCase();
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || Boolean(target.isContentEditable);
}

export function createKeyboardRouter({
  modalManager = null,
  getMode = () => "solve",
  isReplayOpen = () => false,
  onReplayKey = () => false,
  isQuickSimOpen = () => false,
  onQuickSimKey = () => false,
  onSolveKeyDown = () => false,
  onSolveKeyUp = () => false,
  onSimulateKeyDown = () => false,
  onPracticeKeyDown = () => false,
  onCustomShortcutKeyDown = () => false,
  onFreeMoveKeyDown = () => false
} = {}) {
  function handleKeyDown(e) {
    // 1. Active modal (Escape closes top modal, Tab stays trapped inside it)
    if (modalManager?.hasOpenModal?.()) {
      modalManager.handleKeyDown(e);
      if (isReplayOpen() && e.key !== "Escape" && e.key !== "Tab") {
        onReplayKey(e);
      } else if (isQuickSimOpen() && e.key !== "Escape" && e.key !== "Tab") {
        onQuickSimKey(e);
      }
      return true;
    }

    // 2. Active Replay or QuickSim modal (if open independently)
    if (isReplayOpen()) {
      onReplayKey(e);
      return true;
    }
    if (isQuickSimOpen()) {
      onQuickSimKey(e);
      return true;
    }

    // 3. Do not intercept hotkeys while typing inside inputs
    const target = e.target || (typeof document !== "undefined" ? document.activeElement : null);
    if (isEditableElement(target)) {
      return false;
    }

    const mode = getMode();

    // 4. Mode-specific handlers (e.g. Solve timer Space hold/stop, Simulate transport, Practice)
    if (mode === "solve" && onSolveKeyDown(e)) return true;
    if (mode === "simulate" && onSimulateKeyDown(e)) return true;
    if (mode === "practice" && onPracticeKeyDown(e)) return true;

    // 5. Customizable global & virtual-cube keyboard shortcuts
    if (onCustomShortcutKeyDown(e)) return true;

    // 6. Global Free Face Turns hotkeys fallback
    if (onFreeMoveKeyDown(e)) return true;

    return false;
  }

  function handleKeyUp(e) {
    if (modalManager?.hasOpenModal?.() || isReplayOpen()) return false;
    const target = e.target || (typeof document !== "undefined" ? document.activeElement : null);
    if (isEditableElement(target)) return false;

    if (getMode() === "solve") {
      return Boolean(onSolveKeyUp(e));
    }
    return false;
  }

  function mount(target = typeof document !== "undefined" ? document : null) {
    if (!target || typeof target.addEventListener !== "function") return () => {};
    target.addEventListener("keydown", handleKeyDown, true);
    target.addEventListener("keyup", handleKeyUp);
    return () => {
      target.removeEventListener("keydown", handleKeyDown, true);
      target.removeEventListener("keyup", handleKeyUp);
    };
  }

  return {
    handleKeyDown,
    handleKeyUp,
    mount
  };
}
