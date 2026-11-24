// High-visibility Smart Cube & GAN Timer disconnect alert banner & floating overlay

import { ganTimer } from '../../ganTimer.js';
import { smartCube } from '../../smartCube.js';
import { showToast } from '../../ui/toastService.js';
import { isTimerViewMode } from '../../state/appStore.js';

export function createDisconnectAlertView({
  appStore,
  getSmartCubeCtrl = () => null,
  getGanTimerCtrl = () => null
} = {}) {
  const solveSurface = typeof document !== "undefined" ? document.getElementById("solveSurface") : null;
  const solveOverlay = typeof document !== "undefined" ? document.getElementById("solveOverlay") : null;
  const bluetoothBtn = typeof document !== "undefined" ? document.getElementById("bluetoothBtn") : null;
  const ganTimerBtn = typeof document !== "undefined" ? document.getElementById("ganTimerBtn") : null;

  const btDisconnectBanner = typeof document !== "undefined" ? document.getElementById("btDisconnectBanner") : null;
  const btDisconnectBannerTitle = typeof document !== "undefined" ? document.getElementById("btDisconnectBannerTitle") : null;
  const btDisconnectBannerDesc = typeof document !== "undefined" ? document.getElementById("btDisconnectBannerDesc") : null;
  const btDisconnectReconnectBtn = typeof document !== "undefined" ? document.getElementById("btDisconnectReconnectBtn") : null;
  const btDisconnectDismissBtn = typeof document !== "undefined" ? document.getElementById("btDisconnectDismissBtn") : null;

  const btDisconnectFloatingAlert = typeof document !== "undefined" ? document.getElementById("btDisconnectFloatingAlert") : null;
  const btDisconnectFloatingTitle = typeof document !== "undefined" ? document.getElementById("btDisconnectFloatingTitle") : null;
  const btDisconnectFloatingDesc = typeof document !== "undefined" ? document.getElementById("btDisconnectFloatingDesc") : null;
  const btDisconnectFloatingReconnectBtn = typeof document !== "undefined" ? document.getElementById("btDisconnectFloatingReconnectBtn") : null;
  const btDisconnectFloatingDismissBtn = typeof document !== "undefined" ? document.getElementById("btDisconnectFloatingDismissBtn") : null;

  let ganTimerDisconnectAlert = false;
  let smartCubeDisconnectAlert = null; // null or { deviceName }

  function renderAlerts() {
    const hasTimerAlert = Boolean(ganTimerDisconnectAlert && !ganTimer.isConnected());
    const hasCubeAlert = Boolean(smartCubeDisconnectAlert && !smartCube.getStatus().connected);
    const anyAlert = hasTimerAlert || hasCubeAlert;

    ganTimerBtn?.classList.toggle("is-disconnected-alert", hasTimerAlert);
    bluetoothBtn?.classList.toggle("is-disconnected-alert", hasCubeAlert);
    solveSurface?.classList.toggle("has-bt-disconnect-alert", anyAlert);

    if (!anyAlert) {
      if (btDisconnectBanner) btDisconnectBanner.hidden = true;
      if (btDisconnectFloatingAlert) btDisconnectFloatingAlert.hidden = true;
      return;
    }

    let title = "";
    let desc = "";
    let btnLabel = "🔌 Reconnect Now";

    if (hasTimerAlert && hasCubeAlert) {
      const cName = smartCubeDisconnectAlert?.deviceName || "Smart Cube";
      title = `⚠️ GAN TIMER & SMART CUBE (${cName}) DISCONNECTED!`;
      desc = "Both Bluetooth devices lost connection! Solves on your physical timer and cube turns are NOT being recorded.";
      btnLabel = "🔌 Reconnect Timer & Cube";
    } else if (hasTimerAlert) {
      title = "⚠️ GAN BLUETOOTH TIMER DISCONNECTED!";
      desc = "Your Bluetooth timer lost connection (it may have powered off or gone to sleep). Solves on the physical timer are NOT being recorded!";
      btnLabel = "🔌 Reconnect GAN Timer";
    } else {
      const cName = smartCubeDisconnectAlert?.deviceName || "Smart Cube";
      title = `⚠️ SMART CUBE DISCONNECTED (${cName})!`;
      desc = "Your Bluetooth smart cube lost connection. Cube turns and auto-stop are NO LONGER being tracked!";
      btnLabel = `🔌 Reconnect ${cName}`;
    }

    if (btDisconnectBannerTitle) btDisconnectBannerTitle.textContent = title;
    if (btDisconnectBannerDesc) btDisconnectBannerDesc.textContent = desc;
    if (btDisconnectReconnectBtn) btDisconnectReconnectBtn.textContent = btnLabel;
    if (btDisconnectBanner) btDisconnectBanner.hidden = false;

    if (btDisconnectFloatingTitle) btDisconnectFloatingTitle.textContent = title;
    if (btDisconnectFloatingDesc) btDisconnectFloatingDesc.textContent = desc;
    if (btDisconnectFloatingReconnectBtn) btDisconnectFloatingReconnectBtn.textContent = btnLabel;
    if (btDisconnectFloatingAlert) {
      const isSolveSurfaceVisible = isTimerViewMode(appStore.state) && (!solveOverlay || solveOverlay.hidden);
      btDisconnectFloatingAlert.hidden = isSolveSurfaceVisible;
    }
  }

  async function handleReconnect() {
    const hasTimerAlert = Boolean(ganTimerDisconnectAlert && !ganTimer.isConnected());
    const hasCubeAlert = Boolean(smartCubeDisconnectAlert && !smartCube.getStatus().connected);

    if (hasTimerAlert) {
      try {
        await ganTimer.connect();
        ganTimerDisconnectAlert = false;
        renderAlerts();
      } catch (err) {
        if (err && (err.name === "NotFoundError" || err.code === "NotFoundError")) return;
        showToast(`Could not reconnect GAN Smart Timer: ${err?.message || err}`, "error");
      }
      return;
    }

    if (hasCubeAlert) {
      const devName = smartCubeDisconnectAlert?.deviceName || "";
      try {
        if (devName) await smartCube.reconnectSavedCube(devName);
        else await smartCube.connect();
        smartCubeDisconnectAlert = null;
        renderAlerts();
      } catch (err) {
        if (err && (err.name === "NotFoundError" || err.code === "NotFoundError")) return;
        const scCtrl = getSmartCubeCtrl();
        scCtrl?.openBluetoothModal?.();
        scCtrl?.showBluetoothError?.(err?.message || `Could not reconnect to ${devName || "Smart Cube"}.`);
      }
    }
  }

  function dismissAlerts() {
    ganTimerDisconnectAlert = false;
    smartCubeDisconnectAlert = null;
    renderAlerts();
    getGanTimerCtrl()?.updateGanTimerUI?.();
    getSmartCubeCtrl()?.updateBluetoothUI?.();
  }

  btDisconnectReconnectBtn?.addEventListener("click", (e) => { e.stopPropagation(); void handleReconnect(); });
  btDisconnectFloatingReconnectBtn?.addEventListener("click", (e) => { e.stopPropagation(); void handleReconnect(); });
  btDisconnectDismissBtn?.addEventListener("click", (e) => { e.stopPropagation(); dismissAlerts(); });
  btDisconnectFloatingDismissBtn?.addEventListener("click", (e) => { e.stopPropagation(); dismissAlerts(); });

  return {
    getTimerAlert: () => ganTimerDisconnectAlert,
    setTimerAlert: (v) => { ganTimerDisconnectAlert = Boolean(v); },
    getCubeAlert: () => smartCubeDisconnectAlert,
    setCubeAlert: (v) => { smartCubeDisconnectAlert = v; },
    renderAlerts,
    dismissAlerts
  };
}
