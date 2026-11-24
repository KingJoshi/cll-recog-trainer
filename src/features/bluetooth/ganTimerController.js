// GAN Smart Timer (Bluetooth) UI & state controller

import { ganTimer, shouldIgnorePrematureTimerStop } from '../../ganTimer.js';
import { smartCube } from '../../smartCube.js';
import { playDisconnectAlertSound } from '../../services/audioService.js';
import { showToast } from '../../ui/toastService.js';
import { isTimerViewMode } from '../../state/appStore.js';

export function createGanTimerController({
  appStore,
  modalManager,
  getTimerCtrl = () => null,
  getSmartCubeCtrl = () => null,
  getSolvePanel = () => null,
  getDisconnectAlertView = () => null
} = {}) {
  const ganTimerBtn = typeof document !== "undefined" ? document.getElementById("ganTimerBtn") : null;
  const ganTimerHeaderDot = typeof document !== "undefined" ? document.getElementById("ganTimerHeaderDot") : null;
  const ganTimerLabel = typeof document !== "undefined" ? document.getElementById("ganTimerLabel") : null;

  function updateGanTimerUI() {
    const st = ganTimer.getStatus();
    const alertView = getDisconnectAlertView();
    const hasTimerAlert = Boolean(alertView?.getTimerAlert?.() && !st.connected);
    if (ganTimerHeaderDot) ganTimerHeaderDot.className = `bt-dot ${st.status}`;
    if (ganTimerLabel) {
      ganTimerLabel.textContent = st.status === "connected"
        ? "GAN Timer ✓"
        : (st.status === "connecting"
          ? "Connecting…"
          : (hasTimerAlert ? "⚠️ Timer Lost!" : "GAN Timer"));
    }
    if (ganTimerBtn) {
      ganTimerBtn.title = st.status === "connected"
        ? "GAN Smart Timer connected · Click to disconnect"
        : (hasTimerAlert
          ? "GAN Smart Timer disconnected! Click to reconnect"
          : "Connect GAN Smart Timer (Bluetooth)");
      ganTimerBtn.classList.toggle("is-connected", st.connected);
      ganTimerBtn.classList.toggle("is-disconnected-alert", hasTimerAlert);
    }
  }

  ganTimer.addEventListener("connected", () => {
    const alertView = getDisconnectAlertView();
    alertView?.setTimerAlert?.(false);
    alertView?.renderAlerts?.();
    updateGanTimerUI();
  });

  ganTimer.addEventListener("statuschange", () => {
    updateGanTimerUI();
    getDisconnectAlertView()?.renderAlerts?.();
    if (isTimerViewMode(appStore.state)) {
      getSolvePanel()?.renderSolvePanel?.();
      getSmartCubeCtrl()?.updateSmartCubeIndicator?.();
    }
  });

  ganTimer.addEventListener("disconnected", (e) => {
    const reason = e.detail?.reason || "unexpected";
    getTimerCtrl()?.onGanTimerDisconnectedMidSolve?.();
    if (reason !== "manual" || isTimerViewMode(appStore.state)) {
      const alertView = getDisconnectAlertView();
      alertView?.setTimerAlert?.(true);
      playDisconnectAlertSound();
      alertView?.renderAlerts?.();
      updateGanTimerUI();
    }
  });

  ganTimer.addEventListener("timerstate", (e) => {
    const { state, recordedMs, ts } = e.detail || {};
    smartCube.logDiag("GAN_TIMER_STATE", { state, recordedMs });
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
        timerCtrl.startTimerDrivenSolve(ts);
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
            smartCube.logDiag("GAN_TIMER_FALSE_STOP_IGNORED", {
              recordedMs,
              elapsedMs: Math.round(elapsedMs),
              moves: timerCtrl.getTrackedMoveCount()
            });
            timerCtrl.onGanTimerDisconnectedMidSolve();
            timerCtrl.getOverlayHintSetter("GAN timer stopped early — keep solving! Auto-stops when cube is solved");
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

  ganTimerBtn?.addEventListener("click", async () => {
    if (ganTimer.isConnected()) {
      const ok = await modalManager.confirmDialog({
        title: "Disconnect GAN Smart Timer",
        message: "Disconnect the currently connected GAN Smart Timer?",
        confirmLabel: "Disconnect",
        danger: true
      });
      if (ok) ganTimer.disconnect();
      return;
    }
    if (ganTimer.status === "connecting") return;
    try {
      await ganTimer.connect();
    } catch (err) {
      if (err && (err.name === "NotFoundError" || err.code === "NotFoundError")) return;
      console.warn("GAN timer connection error:", err);
      showToast(`Could not connect to GAN Smart Timer: ${err?.message || err}`, "error");
    }
  });

  updateGanTimerUI();

  return {
    updateGanTimerUI
  };
}
