// Stackmat G5 / G4 / G3 Audio Line-In Timer UI & state controller (Beta gated)

import { stackmatTimer } from '../../stackmatTimer.js';
import { shouldIgnorePrematureTimerStop } from '../../ganTimer.js';
import { smartCube } from '../../smartCube.js';
import { showToast } from '../../ui/toastService.js';
import { isTimerViewMode, isExperimentalEnabled } from '../../state/appStore.js';

export function createStackmatTimerController({
  appStore,
  modalManager,
  getTimerCtrl = () => null,
  getSmartCubeCtrl = () => null,
  getSolvePanel = () => null,
  getDisconnectAlertView = () => null
} = {}) {
  const stackmatBetaSection = typeof document !== "undefined" ? document.getElementById("stackmatBetaSection") : null;
  const stackmatStatusCard = typeof document !== "undefined" ? document.getElementById("stackmatStatusCard") : null;
  const stackmatHeaderDot = typeof document !== "undefined" ? document.getElementById("stackmatHeaderDot") : null;
  const stackmatLabel = typeof document !== "undefined" ? document.getElementById("stackmatLabel") : null;
  const stackmatModalStatusBadge = typeof document !== "undefined" ? document.getElementById("stackmatModalStatusBadge") : null;
  const stackmatDesc = typeof document !== "undefined" ? document.getElementById("stackmatDesc") : null;
  const stackmatAudioSelect = typeof document !== "undefined" ? document.getElementById("stackmatAudioSelect") : null;
  const stackmatRefreshInputsBtn = typeof document !== "undefined" ? document.getElementById("stackmatRefreshInputsBtn") : null;
  const stackmatSignalWrap = typeof document !== "undefined" ? document.getElementById("stackmatSignalWrap") : null;
  const stackmatSignalFill = typeof document !== "undefined" ? document.getElementById("stackmatSignalFill") : null;
  const stackmatSignalStatus = typeof document !== "undefined" ? document.getElementById("stackmatSignalStatus") : null;
  const stackmatConnectBtn = typeof document !== "undefined" ? document.getElementById("stackmatConnectBtn") : null;
  const stackmatGuideBtn = typeof document !== "undefined" ? document.getElementById("stackmatGuideBtn") : null;
  const stackmatGuideModal = typeof document !== "undefined" ? document.getElementById("stackmatGuideModal") : null;
  const stackmatGuideModalCloseBtn = typeof document !== "undefined" ? document.getElementById("stackmatGuideModalCloseBtn") : null;
  const stackmatGuideModalDismissBtn = typeof document !== "undefined" ? document.getElementById("stackmatGuideModalDismissBtn") : null;

  let selectedDeviceId = "";

  async function refreshAudioInputs() {
    if (!stackmatAudioSelect) return;
    const inputs = await stackmatTimer.listAudioInputs();
    const prevValue = selectedDeviceId || stackmatAudioSelect.value || "";
    stackmatAudioSelect.innerHTML = '<option value="">Default Microphone / Line-In</option>';
    for (const dev of inputs) {
      const opt = document.createElement("option");
      opt.value = dev.deviceId;
      opt.textContent = dev.label;
      stackmatAudioSelect.appendChild(opt);
    }
    if (prevValue && inputs.some(d => d.deviceId === prevValue)) {
      stackmatAudioSelect.value = prevValue;
    }
  }

  function updateSignalMeter(detail = null) {
    const st = stackmatTimer.getStatus();
    if (stackmatSignalWrap) stackmatSignalWrap.hidden = !st.connected;
    if (!st.connected) return;
    const peak = detail?.peak ?? st.signalPeak ?? 0;
    const locked = detail?.locked ?? st.locked;
    const gen = detail?.generation ?? st.generation;
    const pct = Math.max(4, Math.min(100, Math.round(peak * 140)));
    if (stackmatSignalFill) {
      stackmatSignalFill.style.width = `${pct}%`;
      stackmatSignalFill.classList.toggle("is-locked", Boolean(locked));
    }
    if (stackmatSignalStatus) {
      stackmatSignalStatus.textContent = locked
        ? `Signal locked (${gen || "Stackmat"}) · State: ${st.state || "IDLE"}`
        : "Listening for 1200-baud Stackmat FSK audio…";
    }
  }

  function syncBetaVisibility() {
    const enabled = isExperimentalEnabled(appStore?.state, "stackmatG5");
    if (stackmatBetaSection) {
      stackmatBetaSection.hidden = !enabled;
    }
    if (!enabled && stackmatTimer.isConnected()) {
      stackmatTimer.disconnect({ manual: true });
    }
    updateStackmatUI();
    if (enabled) {
      void refreshAudioInputs();
    }
  }

  function updateStackmatUI() {
    const st = stackmatTimer.getStatus();
    if (stackmatHeaderDot) stackmatHeaderDot.className = `bt-dot ${st.status}`;
    if (stackmatStatusCard) stackmatStatusCard.className = `bt-status-card ${st.status}`;
    if (stackmatModalStatusBadge) {
      const badgeClass = st.status === "connected" ? "badge-success" : (st.status === "connecting" ? "badge-warning" : "badge-disconnected");
      stackmatModalStatusBadge.className = `badge ${badgeClass}`;
      stackmatModalStatusBadge.textContent = st.status === "connected" ? "Connected" : (st.status === "connecting" ? "Listening..." : "Disconnected");
    }
    if (stackmatLabel) {
      const labelText = st.connected
        ? "Stackmat G5 Listening ✓"
        : (st.status === "connecting" ? "Opening Audio Input…" : "Stackmat G5 (Audio Line-In)");
      stackmatLabel.innerHTML = `${labelText}<sup class="beta-sup" aria-label="Experimental">β</sup>`;
    }
    if (stackmatDesc) {
      stackmatDesc.textContent = st.connected
        ? `${st.deviceName || "Audio input"} active. Plug your Stackmat data cable into line-in/mic and solve normally.`
        : "Experimental Web Audio 1200-baud decoder for SpeedStacks Stackmat G5 (and G4/G3) via audio cable.";
    }
    if (stackmatConnectBtn) {
      stackmatConnectBtn.textContent = st.connected
        ? "Disconnect Stackmat G5"
        : (st.status === "connecting" ? "Connecting…" : "🎙 Connect Stackmat G5");
      stackmatConnectBtn.classList.toggle("is-connected", st.connected);
      stackmatConnectBtn.classList.toggle("btn-danger", st.connected);
      stackmatConnectBtn.classList.toggle("btn-primary", !st.connected);
    }
    updateSignalMeter();
    getSmartCubeCtrl()?.updateBluetoothUI?.();
  }

  stackmatTimer.addEventListener("connected", () => {
    void refreshAudioInputs();
    updateStackmatUI();
  });

  stackmatTimer.addEventListener("statuschange", () => {
    updateStackmatUI();
    getDisconnectAlertView()?.renderAlerts?.();
    if (isTimerViewMode(appStore.state)) {
      getSolvePanel()?.renderSolvePanel?.();
      getSmartCubeCtrl()?.updateSmartCubeIndicator?.();
    }
  });

  stackmatTimer.addEventListener("signal", (e) => {
    updateSignalMeter(e.detail);
  });

  stackmatTimer.addEventListener("disconnected", (e) => {
    const reason = e.detail?.reason || "unexpected";
    getTimerCtrl()?.onGanTimerDisconnectedMidSolve?.("Stackmat G5");
    if (reason !== "manual") {
      showToast("Stackmat G5 audio input disconnected.", "warning", 3500);
    }
    updateStackmatUI();
  });

  stackmatTimer.addEventListener("timerstate", (e) => {
    if (!isExperimentalEnabled(appStore?.state, "stackmatG5")) return;
    const { state, recordedMs, ts, generation } = e.detail || {};
    smartCube.logDiag("STACKMAT_TIMER_STATE", { state, recordedMs, generation });
    if (!isTimerViewMode(appStore.state)) return;
    const timerCtrl = getTimerCtrl();
    const scCtrl = getSmartCubeCtrl();
    if (!timerCtrl) return;

    switch (state) {
      case "HANDS_ON":
      case "GET_SET":
        timerCtrl.showGanTimerHandsOverlay(state);
        break;
      case "HANDS_OFF":
      case "IDLE":
        if (timerCtrl.getSolveState() !== "running") timerCtrl.clearGanTimerHandsOverlay();
        break;
      case "RUNNING":
        timerCtrl.startTimerDrivenSolve(ts, { timerSource: "Stackmat G5" });
        break;
      case "STOPPED":
        if (timerCtrl.getSolveState() === "running" && timerCtrl.isTimerDriven()) {
          const elapsedMs = Number.isFinite(recordedMs) && recordedMs > 0
            ? recordedMs
            : ((ts != null ? ts : performance.now()) - timerCtrl.getSolveStartTs());
          if (shouldIgnorePrematureTimerStop({
            smartCubeConnected: smartCube.getStatus().connected,
            smartCubeStage: scCtrl?.getSmartCubeStage?.() || "idle",
            cubeSolved: Boolean(timerCtrl.getCubeSolvedTs()) || smartCube.isCubeSolved(),
            moveCount: timerCtrl.getTrackedMoveCount(),
            firstMoveTs: timerCtrl.getFirstMoveTs(),
            elapsedMs
          })) {
            smartCube.logDiag("STACKMAT_FALSE_STOP_IGNORED", {
              recordedMs,
              elapsedMs: Math.round(elapsedMs),
              moves: timerCtrl.getTrackedMoveCount()
            });
            timerCtrl.onGanTimerDisconnectedMidSolve("Stackmat G5");
            timerCtrl.getOverlayHintSetter("Stackmat stopped early — keep solving! Auto-stops when cube is solved");
            scCtrl?.updateSmartCubeIndicator?.();
            break;
          }
          timerCtrl.stopSolve(false, { hardwareMs: recordedMs, stopTs: ts });
          scCtrl?.updateSmartCubeIndicator?.();
        }
        break;
      default:
        break;
    }
  });

  stackmatAudioSelect?.addEventListener("change", async () => {
    selectedDeviceId = stackmatAudioSelect.value || "";
    if (stackmatTimer.isConnected()) {
      try {
        await stackmatTimer.connect({ deviceId: selectedDeviceId });
      } catch (err) {
        showToast(`Could not switch Stackmat audio input: ${err?.message || err}`, "error");
      }
    }
  });

  stackmatRefreshInputsBtn?.addEventListener("click", () => {
    void refreshAudioInputs();
  });

  stackmatConnectBtn?.addEventListener("click", async () => {
    if (!isExperimentalEnabled(appStore?.state, "stackmatG5")) {
      showToast("Enable Stackmat G5 Audio Timer in Settings → Experimental to use it.", "info");
      return;
    }
    if (stackmatTimer.isConnected()) {
      const ok = await modalManager.confirmDialog({
        title: "Disconnect Stackmat G5",
        message: "Disconnect the Stackmat G5 audio timer input?",
        confirmLabel: "Disconnect",
        danger: true
      });
      if (ok) stackmatTimer.disconnect({ manual: true });
      return;
    }
    if (stackmatTimer.status === "connecting") return;
    try {
      selectedDeviceId = stackmatAudioSelect?.value || selectedDeviceId || "";
      await stackmatTimer.connect({ deviceId: selectedDeviceId });
    } catch (err) {
      console.warn("Stackmat G5 connection error:", err);
      showToast(`Could not open audio input for Stackmat G5: ${err?.message || err}`, "error");
    }
  });

  stackmatGuideBtn?.addEventListener("click", () => {
    modalManager?.open?.(stackmatGuideModal);
  });
  stackmatGuideModalCloseBtn?.addEventListener("click", () => {
    modalManager?.close?.(stackmatGuideModal);
  });
  stackmatGuideModalDismissBtn?.addEventListener("click", () => {
    modalManager?.close?.(stackmatGuideModal);
  });

  syncBetaVisibility();

  return {
    updateStackmatUI,
    syncBetaVisibility,
    refreshAudioInputs
  };
}
