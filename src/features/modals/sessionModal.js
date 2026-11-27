// Multi-session Create/Edit/Switch/Delete controller & modal

import { getSolveTargetsForPuzzle } from '../../data/algRegistry.js';
import { isBetaTrack, isTrackEnabled } from '../../state/appStore.js';
import { escapeHtml } from '../../services/htmlUtils.js';
import { recordTombstone } from '../../services/syncStorage.js';
import { showToast } from '../../ui/toastService.js';

export function createSessionModalController({
  appStore,
  modalManager,
  getNavCtrl = () => null,
  getSolvePanel = () => null,
  getStatsCtrl = () => null
} = {}) {
  const modal = typeof document !== "undefined" ? document.getElementById("sessionModal") : null;
  const titleEl = typeof document !== "undefined" ? document.getElementById("sessionModalTitle") : null;
  const nameInput = typeof document !== "undefined" ? document.getElementById("sessionNameInput") : null;
  const defaultTarget = typeof document !== "undefined" ? document.getElementById("sessionDefaultTarget") : null;
  const showCubeCheckbox = typeof document !== "undefined" ? document.getElementById("sessionShowCubeCheckbox") : null;
  const inspectionCheckbox = typeof document !== "undefined" ? document.getElementById("sessionInspectionCheckbox") : null;
  const closeBtn = typeof document !== "undefined" ? document.getElementById("sessionModalCloseBtn") : null;
  const cancelBtn = typeof document !== "undefined" ? document.getElementById("sessionModalCancelBtn") : null;
  const saveBtn = typeof document !== "undefined" ? document.getElementById("sessionModalSaveBtn") : null;

  const solveSessionSelect = typeof document !== "undefined" ? document.getElementById("solveSessionSelect") : null;
  const solveSessionBadge = typeof document !== "undefined" ? document.getElementById("solveSessionBadge") : null;
  const newSessionBtn = typeof document !== "undefined" ? document.getElementById("newSessionBtn") : null;
  const renameSessionBtn = typeof document !== "undefined" ? document.getElementById("renameSessionBtn") : null;
  const deleteSessionBtn = typeof document !== "undefined" ? document.getElementById("deleteSessionBtn") : null;

  let sessionModalMode = "create";

  function populateSessionSelect() {
    const s = appStore.state;
    const matching = s.sessions.filter(sess => (sess.puzzle || "222") === s.currentPuzzle);
    if (solveSessionSelect) {
      solveSessionSelect.innerHTML = matching.map(sess =>
        `<option value="${sess.id}" ${sess.id === s.activeSessionId ? "selected" : ""}>${escapeHtml(sess.name)} (${sess.solves ? sess.solves.length : 0})</option>`
      ).join("");
    }
    const current = appStore.getActiveSession();
    if (solveSessionBadge && current) {
      solveSessionBadge.textContent = `${current.name} (${current.solves ? current.solves.length : 0})`;
    }
  }

  function populateTargetOptions(puzzleId, selectedTarget) {
    if (!defaultTarget) return;
    const targets = getSolveTargetsForPuzzle(puzzleId).filter(
      t => isTrackEnabled(appStore?.state, puzzleId, t.id)
    );
    defaultTarget.innerHTML = targets.map(t =>
      `<option value="${escapeHtml(t.id)}">${escapeHtml(t.name)}${isBetaTrack(puzzleId, t.id) ? " β" : ""}</option>`
    ).join("");
    const validTarget = targets.some(t => t.id === selectedTarget)
      ? selectedTarget
      : "full";
    defaultTarget.value = validTarget;
  }

  function open(mode = "create") {
    if (!modal) return;
    sessionModalMode = mode;
    const s = appStore.state;
    const current = appStore.getActiveSession();
    const targetField = document.getElementById("sessionTargetField");
    if (targetField) targetField.hidden = false;
    populateTargetOptions(s.currentPuzzle, current.target || s.solveTarget || "full");

    if (mode === "edit" || mode === "rename") {
      if (titleEl) titleEl.textContent = "Edit Session Settings";
      if (nameInput) nameInput.value = current.name;
      if (showCubeCheckbox) showCubeCheckbox.checked = current.showCube ?? true;
      if (inspectionCheckbox) inspectionCheckbox.checked = current.inspection ?? true;
    } else {
      const pName = s.currentPuzzle === "222" ? "2x2" : s.currentPuzzle === "333oh" ? "3x3 OH" : s.currentPuzzle === "333" ? "3x3" : s.currentPuzzle === "444" ? "4x4" : "5x5";
      if (titleEl) titleEl.textContent = `New ${pName} Session`;
      const matching = s.sessions.filter(sess => (sess.puzzle || "222") === s.currentPuzzle);
      if (nameInput) nameInput.value = `${s.currentPuzzle === "222" ? "Session" : `${pName} Session`} ${matching.length + 1}`;
      if (showCubeCheckbox) showCubeCheckbox.checked = s.solveShowCube ?? true;
      if (inspectionCheckbox) inspectionCheckbox.checked = s.solveInspection ?? true;
    }

    modalManager.open(modal, { initialFocus: nameInput });
    nameInput?.select?.();
  }

  function close() {
    if (modal) modalManager.close(modal);
  }

  function switchSession(sessId) {
    const s = appStore.state;
    if (!s.sessions.some(sess => sess.id === sessId)) return;
    s.activeSessionId = sessId;
    const sess = appStore.getActiveSession();
    s.solveTarget = sess.target || "full";
    s.solveShowCube = sess.showCube ?? true;
    s.solveInspection = sess.inspection ?? true;
    const solves = sess.solves || [];
    s.lastSolve = solves.length ? solves[solves.length - 1] : null;
    if (solveSessionSelect) solveSessionSelect.value = sessId;

    appStore.saveSessions();
    appStore.saveSettings();
    populateSessionSelect();
    getNavCtrl()?.renderTrackBar?.();
    getNavCtrl()?.renderStage?.();
    getSolvePanel()?.renderSolvePanel?.();
    getStatsCtrl()?.updateStatsTable?.();
    getNavCtrl()?.regenerateScramble?.();
  }

  async function deleteCurrentSession() {
    const s = appStore.state;
    const matching = s.sessions.filter(sess => (sess.puzzle || "222") === s.currentPuzzle);
    if (matching.length <= 1) {
      showToast("You must have at least one session for this puzzle.", "warning");
      return;
    }
    const current = appStore.getActiveSession();
    const ok = await modalManager.confirmDialog({
      title: "Delete Session",
      message: `Delete session "${current.name}" and all ${current.solves?.length || 0} recorded solves?`,
      confirmLabel: "Delete Session",
      danger: true
    });
    if (!ok) return;
    recordTombstone("sessions", current.id);
    s.sessions = s.sessions.filter(sess => sess.id !== current.id);
    const remaining = s.sessions.filter(sess => (sess.puzzle || "222") === s.currentPuzzle);
    s.activeSessionId = remaining[0].id;
    appStore.saveSessions();
    switchSession(s.activeSessionId);
    showToast(`Deleted "${current.name}".`, "info", 2200);
  }

  function handleSave() {
    const name = nameInput?.value.trim() || "";
    if (!name) {
      showToast("Please enter a session name.", "warning");
      nameInput?.focus();
      return;
    }
    const s = appStore.state;
    const target = defaultTarget?.value || "full";
    const showCube = showCubeCheckbox ? showCubeCheckbox.checked : true;
    const inspection = inspectionCheckbox ? inspectionCheckbox.checked : true;

    if (sessionModalMode === "edit" || sessionModalMode === "rename") {
      const sess = appStore.getActiveSession();
      sess.name = name;
      sess.target = target;
      sess.showCube = showCube;
      sess.inspection = inspection;
      sess.updatedAt = Date.now();
    } else {
      const newId = `session-${Date.now()}`;
      s.sessions.push({
        id: newId,
        puzzle: s.currentPuzzle,
        name,
        target,
        inspection,
        showCube,
        updatedAt: Date.now(),
        solves: []
      });
      s.activeSessionId = newId;
    }

    s.solveTarget = target;
    s.solveShowCube = showCube;
    s.solveInspection = inspection;
    appStore.saveSessions();
    appStore.saveSettings();
    close();
    populateSessionSelect();
    getNavCtrl()?.renderTrackBar?.();
    getNavCtrl()?.renderStage?.();
    getSolvePanel()?.renderSolvePanel?.();
    getNavCtrl()?.regenerateScramble?.();
  }

  closeBtn?.addEventListener("click", close);
  cancelBtn?.addEventListener("click", close);
  saveBtn?.addEventListener("click", handleSave);
  nameInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleSave();
    }
  });
  solveSessionSelect?.addEventListener("change", () => switchSession(solveSessionSelect.value));
  newSessionBtn?.addEventListener("click", () => open("create"));
  renameSessionBtn?.addEventListener("click", () => open("edit"));
  deleteSessionBtn?.addEventListener("click", () => void deleteCurrentSession());

  return {
    open,
    close,
    populateSessionSelect,
    switchSession,
    deleteCurrentSession
  };
}
