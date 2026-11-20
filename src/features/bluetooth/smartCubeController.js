// Smart Cube Bluetooth controller: connection modal, saved cubes, MAC prompt, diagnostics, scramble assistant, and live move routing

import { smartCube, formatMacAddress, preloadSmartCube } from '../../smartCube.js';
import { ganTimer } from '../../ganTimer.js';
import { ScrambleTracker } from '../../scrambleTracker.js';
import { escapeHtml } from '../../services/htmlUtils.js';
import { playScrambleCompleteChime, playDisconnectAlertSound } from '../../services/audioService.js';

const SCRAMBLE_CORRECTION_DELAY_MS = 180;

const DEMO_SOLVE = {
  puzzle: "333",
  target: "full",
  ms: 9960,
  rawMs: 9960,
  penalty: null,
  at: Date.now() - 3600000,
  scramble: "U F R U' R' U R U R2' F' R U R U' R' U' R U2' R' U' R U' R' U' R U' R' U L' U L U2' R' U' R U' L U L' U' D F R' D'",
  moves: [
    { move: "D",  t: 180,  split: 180 },
    { move: "R",  t: 360,  split: 180 },
    { move: "F'", t: 540,  split: 180 },
    { move: "D'", t: 720,  split: 180 },
    { move: "U",  t: 1240, split: 520 },
    { move: "L",  t: 1420, split: 180 },
    { move: "U'", t: 1600, split: 180 },
    { move: "L'", t: 1780, split: 180 },
    { move: "U",  t: 2240, split: 460 },
    { move: "R'", t: 2420, split: 180 },
    { move: "U",  t: 2600, split: 180 },
    { move: "R",  t: 2780, split: 180 },
    { move: "U2", t: 3100, split: 320 },
    { move: "L'", t: 3280, split: 180 },
    { move: "U'", t: 3460, split: 180 },
    { move: "L",  t: 3640, split: 180 },
    { move: "U'", t: 3920, split: 280 },
    { move: "R",  t: 4100, split: 180 },
    { move: "U",  t: 4280, split: 180 },
    { move: "R'", t: 4460, split: 180 },
    { move: "U",  t: 5010, split: 550 },
    { move: "R",  t: 5210, split: 200 },
    { move: "U",  t: 5390, split: 180 },
    { move: "R'", t: 5570, split: 180 },
    { move: "U",  t: 5750, split: 180 },
    { move: "R",  t: 5930, split: 180 },
    { move: "U2", t: 6150, split: 220 },
    { move: "R'", t: 6330, split: 180 },
    { move: "U",  t: 6960, split: 630 },
    { move: "R",  t: 7160, split: 200 },
    { move: "U",  t: 7360, split: 200 },
    { move: "R'", t: 7560, split: 200 },
    { move: "U'", t: 7760, split: 200 },
    { move: "R'", t: 7960, split: 200 },
    { move: "F",  t: 8160, split: 200 },
    { move: "R2", t: 8360, split: 200 },
    { move: "U'", t: 8560, split: 200 },
    { move: "R'", t: 8760, split: 200 },
    { move: "U'", t: 8960, split: 200 },
    { move: "R",  t: 9160, split: 200 },
    { move: "U",  t: 9360, split: 200 },
    { move: "R'", t: 9560, split: 200 },
    { move: "F'", t: 9760, split: 200 },
    { move: "U'", t: 9960, split: 200 }
  ],
  moveCount: 44,
  tps: 4.42,
  smartCube: "Smart Cube (Demo)"
};

export function createSmartCubeController({
  appStore,
  modalManager,
  cubeStage,
  freeMovesCtrl,
  solveReplayViewer,
  getTimerCtrl = () => null,
  getGanTimerCtrl = () => null,
  getDisconnectAlertView = () => null
} = {}) {
  const bluetoothBtn = typeof document !== "undefined" ? document.getElementById("bluetoothBtn") : null;
  const bluetoothHeaderDot = typeof document !== "undefined" ? document.getElementById("bluetoothHeaderDot") : null;
  const bluetoothModal = typeof document !== "undefined" ? document.getElementById("bluetoothModal") : null;
  const bluetoothModalCloseBtn = typeof document !== "undefined" ? document.getElementById("bluetoothModalCloseBtn") : null;
  const btModalDismissBtn = typeof document !== "undefined" ? document.getElementById("btModalDismissBtn") : null;
  const bluetoothModalStatusBadge = typeof document !== "undefined" ? document.getElementById("bluetoothModalStatusBadge") : null;
  const btStatusCard = typeof document !== "undefined" ? document.getElementById("btStatusCard") : null;
  const btDeviceName = typeof document !== "undefined" ? document.getElementById("btDeviceName") : null;
  const btStatusDesc = typeof document !== "undefined" ? document.getElementById("btStatusDesc") : null;
  const btBatteryWrap = typeof document !== "undefined" ? document.getElementById("btBatteryWrap") : null;
  const btBatteryLevel = typeof document !== "undefined" ? document.getElementById("btBatteryLevel") : null;
  const btConnectBtn = typeof document !== "undefined" ? document.getElementById("btConnectBtn") : null;
  const btDisconnectBtn = typeof document !== "undefined" ? document.getElementById("btDisconnectBtn") : null;
  const btResetBtn = typeof document !== "undefined" ? document.getElementById("btResetBtn") : null;
  const settingsResetBtBtn = typeof document !== "undefined" ? document.getElementById("settingsResetBtBtn") : null;
  const btCustomMacInput = typeof document !== "undefined" ? document.getElementById("btCustomMacInput") : null;
  const btSaveMacBtn = typeof document !== "undefined" ? document.getElementById("btSaveMacBtn") : null;
  const btUnfilteredCheckbox = typeof document !== "undefined" ? document.getElementById("btUnfilteredCheckbox") : null;
  const btSavedCubesList = typeof document !== "undefined" ? document.getElementById("btSavedCubesList") : null;
  const btErrorAlert = typeof document !== "undefined" ? document.getElementById("btErrorAlert") : null;
  const btErrorText = typeof document !== "undefined" ? document.getElementById("btErrorText") : null;
  const btErrorDismissBtn = typeof document !== "undefined" ? document.getElementById("btErrorDismissBtn") : null;
  const btVirtualBtn = typeof document !== "undefined" ? document.getElementById("btVirtualBtn") : null;
  const btDemoSolveBtn = typeof document !== "undefined" ? document.getElementById("btDemoSolveBtn") : null;
  const btLiveStreamWrap = typeof document !== "undefined" ? document.getElementById("btLiveStreamWrap") : null;
  const btMoveChipsList = typeof document !== "undefined" ? document.getElementById("btMoveChipsList") : null;
  const btTurnCounter = typeof document !== "undefined" ? document.getElementById("btTurnCounter") : null;
  const btVirtualKeypad = typeof document !== "undefined" ? document.getElementById("btVirtualKeypad") : null;

  const smartCubeSolveIndicator = typeof document !== "undefined" ? document.getElementById("smartCubeSolveIndicator") : null;
  const smartCubeSolveText = typeof document !== "undefined" ? document.getElementById("smartCubeSolveText") : null;
  const smartCubeReadyBtn = typeof document !== "undefined" ? document.getElementById("smartCubeReadyBtn") : null;
  const smartCubeResetSolvedBtn = typeof document !== "undefined" ? document.getElementById("smartCubeResetSolvedBtn") : null;
  const smartCubeDiagToggleBtn = typeof document !== "undefined" ? document.getElementById("smartCubeDiagToggleBtn") : null;
  const smartCubeDiagCopyBtn = typeof document !== "undefined" ? document.getElementById("smartCubeDiagCopyBtn") : null;
  const btDiagToggleBtn = typeof document !== "undefined" ? document.getElementById("btDiagToggleBtn") : null;
  const btDiagCopyBtn = typeof document !== "undefined" ? document.getElementById("btDiagCopyBtn") : null;
  const btDiagDownloadBtn = typeof document !== "undefined" ? document.getElementById("btDiagDownloadBtn") : null;
  const btDiagClearBtn = typeof document !== "undefined" ? document.getElementById("btDiagClearBtn") : null;
  const btDiagCountBadge = typeof document !== "undefined" ? document.getElementById("btDiagCountBadge") : null;
  const solveScrambleText = typeof document !== "undefined" ? document.getElementById("solveScrambleText") : null;
  const cubeCard = typeof document !== "undefined" ? document.querySelector(".cube-card") : null;

  const scrambleTracker = new ScrambleTracker();
  let smartCubeStage = "scrambling"; // "scrambling" | "inspecting" | "ready" | "solving"
  let scrambleCorrectionDelayTimer = null;
  let scrambleSuppressTransient = false;
  let scrambleErrorVisible = false;
  let pendingSolveCubeUpdateRaf = null;

  // Wire non-blocking accessible MAC address prompt instead of window.prompt()
  smartCube.setOnRequestMac(({ deviceName, hint }) => {
    return modalManager.promptDialog({
      title: "Enter Bluetooth MAC Address",
      message: `Unable to auto-detect MAC address for "${deviceName}"${hint}. Enter the 6-byte MAC address (e.g. AA:BB:CC:DD:EE:FF or 12 hex digits):`,
      placeholder: "AA:BB:CC:DD:EE:FF",
      confirmLabel: "Connect"
    });
  });

  function clearScrambleCorrectionDelay() {
    if (scrambleCorrectionDelayTimer) {
      clearTimeout(scrambleCorrectionDelayTimer);
      scrambleCorrectionDelayTimer = null;
    }
    scrambleSuppressTransient = false;
    scrambleErrorVisible = false;
  }

  function resetScrambleTracker(scrambleStr, markDone = false) {
    scrambleTracker.reset(scrambleStr || "");
    if (markDone) scrambleTracker.markComplete();
  }

  function getScrambleTrackerHtml() {
    return scrambleTracker.getHtml({
      suppressError: scrambleSuppressTransient,
      suppressSubAmount: scrambleSuppressTransient
    });
  }

  function updateDiagnosticsUI() {
    const isRec = Boolean(smartCube.diagRecording);
    const count = isRec ? smartCube.diagLogs.length : smartCube.rollingLogs.length;
    if (btDiagCountBadge) {
      btDiagCountBadge.textContent = `${count} event${count === 1 ? "" : "s"}${isRec ? " (recording)" : " (rolling)"}`;
    }
    if (btDiagToggleBtn) {
      btDiagToggleBtn.textContent = isRec ? "⏹ Stop Recording" : "⏺ Start Recording";
      btDiagToggleBtn.classList.toggle("btn-danger", isRec);
      btDiagToggleBtn.classList.toggle("btn-primary", !isRec);
    }
    if (smartCubeDiagToggleBtn) {
      smartCubeDiagToggleBtn.textContent = isRec ? `⏹ Stop Log (${count})` : "⏺ Diag Log";
      smartCubeDiagToggleBtn.classList.toggle("diag-recording-active", isRec);
    }
  }

  function updateSmartCubeIndicator() {
    updateDiagnosticsUI();
    if (!smartCubeSolveIndicator) return;
    const st = smartCube.getStatus();
    const s = appStore.state;
    const timerCtrl = getTimerCtrl();
    const solveState = timerCtrl?.getSolveState?.() || "idle";
    const solveTimerDriven = timerCtrl?.isTimerDriven?.() || false;
    const solveFirstMoveTs = timerCtrl?.getFirstMoveTs?.() || 0;
    const solveCubeSolvedTs = timerCtrl?.getCubeSolvedTs?.() || 0;

    smartCubeSolveIndicator.hidden = !st.connected || s.mode !== "solve";
    if (!st.connected) return;

    const trackerStatus = scrambleTracker.getStatus();
    const devName = escapeHtml(st.deviceName || "Smart Cube");
    const safeCorrections = escapeHtml(trackerStatus.corrections.join(" "));
    const safeNextReq = escapeHtml(trackerStatus.nextRequired || "");

    if (smartCubeStage === "scrambling" && !trackerStatus.isComplete) {
      if (trackerStatus.hasError && !scrambleSuppressTransient) {
        smartCubeSolveText.innerHTML = `⚠️ <strong>${devName}</strong> · Scramble off-track! Undo: <span class="indicator-correction">${safeCorrections}</span>`;
      } else if (!scrambleSuppressTransient && trackerStatus.currentSubAmount > 0 && trackerStatus.nextRequired) {
        smartCubeSolveText.innerHTML = `⚠️ <strong>${devName}</strong> · Incomplete turn! Finish with: <span class="indicator-correction">${safeNextReq}</span>`;
      } else {
        const curMoveObj = scrambleTracker.moves[trackerStatus.currentIndex];
        const nextMoveDisplay = scrambleSuppressTransient
          ? (curMoveObj ? curMoveObj.text : trackerStatus.nextRequired)
          : trackerStatus.nextRequired;
        const nextTxt = nextMoveDisplay ? ` · Next: <strong>${escapeHtml(nextMoveDisplay)}</strong>` : "";
        smartCubeSolveText.innerHTML = `ᛒ <strong>${devName}</strong> · Scrambling (${trackerStatus.currentIndex}/${trackerStatus.totalMoves})${nextTxt}`;
      }
    } else if (smartCubeStage === "inspecting" || solveState === "inspecting") {
      smartCubeSolveText.innerHTML = ganTimer.isConnected()
        ? `ᛒ <strong>${devName}</strong> · ✓ Scrambled · <strong>Inspecting (15s)</strong> · Start the GAN timer`
        : `ᛒ <strong>${devName}</strong> · ✓ Scrambled · <strong>Inspecting (15s)</strong> · Turn cube to start`;
    } else if (smartCubeStage === "ready") {
      smartCubeSolveText.innerHTML = ganTimer.isConnected()
        ? `ᛒ <strong>${devName}</strong> · ✓ Scramble Verified · <strong>READY</strong> · Start the GAN timer`
        : `ᛒ <strong>${devName}</strong> · ✓ Scramble Verified · <strong>READY</strong> · Turn cube to start`;
    } else if (smartCubeStage === "solving" || solveState === "running") {
      if (solveTimerDriven && solveCubeSolvedTs) {
        smartCubeSolveText.innerHTML = `ᛒ <strong>${devName}</strong> · ✓ Cube solved · Put it down &amp; stop the GAN timer`;
      } else if (solveTimerDriven) {
        smartCubeSolveText.innerHTML = `ᛒ <strong>${devName}</strong> · ⏱ GAN timer running · ${solveFirstMoveTs ? "Solving…" : "Pick up the cube!"}`;
      } else {
        smartCubeSolveText.innerHTML = `ᛒ <strong>${devName}</strong> · Solving in progress… (Solve cube to stop)`;
      }
    } else {
      smartCubeSolveText.innerHTML = `ᛒ <strong>${devName}</strong> Connected`;
    }
  }

  function renderSmartScrambleAssistant() {
    if (!smartCube.getStatus().connected) return;
    if (solveScrambleText) solveScrambleText.innerHTML = getScrambleTrackerHtml();
    updateSmartCubeIndicator();
  }

  function onSmartScrambleCompleted() {
    const s = appStore.state;
    clearScrambleCorrectionDelay();
    const timerCtrl = getTimerCtrl();
    timerCtrl?.resetTimerPhaseTracking?.();
    scrambleTracker.markComplete();
    smartCube.logDiag("SCRAMBLE_COMPLETE", { scramble: s.currentSolveScramble });
    smartCube.setScramble(s.currentSolveScramble, s.currentPuzzle);
    playScrambleCompleteChime();
    renderSmartScrambleAssistant();

    if (s.solveInspection) {
      smartCubeStage = "inspecting";
      timerCtrl?.startSolveInspection?.();
    } else {
      smartCubeStage = "ready";
      updateSmartCubeIndicator();
    }
  }

  function showBluetoothError(msg) {
    if (btErrorText) btErrorText.textContent = msg;
    if (btErrorAlert) btErrorAlert.hidden = false;
    if (btStatusDesc) btStatusDesc.textContent = msg;
  }

  function renderSavedCubesList() {
    if (!btSavedCubesList) return;
    const saved = smartCube.getSavedCubes();
    const st = smartCube.getStatus();

    if (!saved || saved.length === 0) {
      btSavedCubesList.innerHTML = `<p class="bt-saved-empty">No saved smart cubes yet. Connect a cube above and it will be saved here for 1-click reconnect.</p>`;
      return;
    }

    btSavedCubesList.innerHTML = saved.map(cube => {
      const isCurrent = st.connected && st.deviceName === cube.name;
      const protoBadge = cube.protocol ? `<span class="badge badge-subtle">${escapeHtml(cube.protocol)}</span>` : "";
      const macBadge = cube.mac ? `<code class="bt-saved-mac" title="Saved Bluetooth MAC Address">${escapeHtml(cube.mac)}</code>` : "";
      const statusLabel = isCurrent
        ? `<span class="bt-saved-status connected">● Connected</span>`
        : `<span class="bt-saved-status">Reconnect &rarr;</span>`;
      return `
        <div class="bt-saved-cube-item ${isCurrent ? "is-connected" : ""}" data-cube-name="${escapeHtml(cube.name)}">
          <button type="button" class="bt-saved-cube-connect-btn" data-cube-name="${escapeHtml(cube.name)}" title="${isCurrent ? "Currently connected" : `Click to reconnect to ${escapeHtml(cube.name)}`}">
            <span class="bt-saved-cube-icon" aria-hidden="true">ᛒ</span>
            <span class="bt-saved-cube-main">
              <strong class="bt-saved-cube-name">${escapeHtml(cube.name)}</strong>
              <span class="bt-saved-cube-meta">${protoBadge} ${macBadge}</span>
            </span>
            ${statusLabel}
          </button>
          <button type="button" class="bt-saved-cube-del-btn" data-cube-name="${escapeHtml(cube.name)}" title="Remove ${escapeHtml(cube.name)} from saved cubes" aria-label="Remove ${escapeHtml(cube.name)}">&times;</button>
        </div>
      `;
    }).join("");

    btSavedCubesList.querySelectorAll(".bt-saved-cube-connect-btn").forEach(btn => {
      btn.addEventListener("click", async () => {
        const name = btn.dataset.cubeName;
        if (!name) return;
        const entry = saved.find(c => c.name === name) || { name };
        if (btErrorAlert) btErrorAlert.hidden = true;
        if (entry.mac && btCustomMacInput) btCustomMacInput.value = entry.mac;
        if (btStatusDesc) btStatusDesc.textContent = `Reconnecting to ${name}… Select "${name}" in the Bluetooth prompt.`;
        try {
          const deviceSelection = btUnfilteredCheckbox?.checked ? "any" : "filtered";
          await smartCube.reconnectSavedCube(entry, { deviceSelection });
          if (btErrorAlert) btErrorAlert.hidden = true;
        } catch (err) {
          if (err && (err.name === "NotFoundError" || err.code === "NotFoundError")) {
            if (btStatusDesc) btStatusDesc.textContent = "Bluetooth device selection cancelled.";
            return;
          }
          showBluetoothError(err?.message || `Failed to reconnect to ${name}.`);
        }
      });
    });

    btSavedCubesList.querySelectorAll(".bt-saved-cube-del-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const name = btn.dataset.cubeName;
        if (!name) return;
        smartCube.removeSavedCube(name);
        renderSavedCubesList();
      });
    });
  }

  function updateBluetoothUI() {
    const st = smartCube.getStatus();
    const s = appStore.state;
    const alertView = getDisconnectAlertView();
    const hasCubeAlert = Boolean(alertView?.getCubeAlert?.() && !st.connected);

    renderSavedCubesList();
    if (bluetoothHeaderDot) bluetoothHeaderDot.className = `bt-dot ${st.status}`;
    bluetoothBtn?.classList.toggle("is-disconnected-alert", hasCubeAlert);

    if (bluetoothModalStatusBadge) {
      const badgeClass = st.status === "connected" ? "badge-success" : (st.status === "connecting" ? "badge-warning" : "badge-disconnected");
      bluetoothModalStatusBadge.className = `badge ${badgeClass}`;
      bluetoothModalStatusBadge.textContent = st.status === "connected" ? "Connected" : (st.status === "connecting" ? "Connecting..." : "Disconnected");
    }
    if (btStatusCard) btStatusCard.className = `bt-status-card ${st.status}`;
    if (btDeviceName) btDeviceName.textContent = st.connected ? (st.deviceName || "Smart Cube") : "No Cube Connected";
    if (btStatusDesc) {
      btStatusDesc.textContent = st.connected
        ? (st.isVirtual ? "Virtual keyboard cube active. You can press move keys (I, K, J, F, etc.) or click virtual buttons below." : "Smart cube connected via Web Bluetooth. Ready to track turns in real time!")
        : "Connect a Bluetooth smart cube to track every turn with millisecond timestamps and replay your solves in 3D.";
    }
    if (btBatteryWrap) {
      btBatteryWrap.hidden = !st.connected || st.battery == null;
      if (btBatteryLevel && st.battery != null) btBatteryLevel.textContent = `${st.battery}%`;
    }
    if (btConnectBtn) btConnectBtn.hidden = st.connected;
    if (btDisconnectBtn) btDisconnectBtn.hidden = !st.connected;
    if (btLiveStreamWrap) btLiveStreamWrap.hidden = !st.connected;
    if (btVirtualKeypad) btVirtualKeypad.hidden = !st.connected || !st.isVirtual;

    if (smartCubeSolveIndicator) smartCubeSolveIndicator.hidden = !st.connected || s.mode !== "solve";
    updateSmartCubeIndicator();

    if (st.connected && s.mode === "solve" && smartCubeStage === "scrambling" && !scrambleTracker.isComplete()) {
      if (!scrambleTracker.rawScramble || scrambleTracker.rawScramble !== s.currentSolveScramble) {
        scrambleTracker.reset(s.currentSolveScramble);
        smartCube.logDiag("SCRAMBLE_SYNC_RESET", { scramble: s.currentSolveScramble });
      }
      renderSmartScrambleAssistant();
    }
  }

  function openBluetoothModal() {
    if (!bluetoothModal) return;
    void preloadSmartCube();
    if (btErrorAlert) btErrorAlert.hidden = true;
    if (btCustomMacInput) {
      try {
        btCustomMacInput.value = smartCube.manualMac || localStorage.getItem("cll_smartcube_last_mac") || "";
      } catch {}
    }
    updateBluetoothUI();
    modalManager.open(bluetoothModal);
  }

  function closeBluetoothModal() {
    if (bluetoothModal) modalManager.close(bluetoothModal);
  }

  function handleBluetoothReset() {
    smartCube.hardReset();
    ganTimer.disconnect();
    if (btCustomMacInput) btCustomMacInput.value = "";
    try { localStorage.removeItem("cll_smartcube_last_mac"); } catch {}
    if (btErrorAlert) btErrorAlert.hidden = true;
    if (btStatusDesc) btStatusDesc.textContent = "Bluetooth state, saved cubes, and MAC cache cleared. Ready to connect fresh.";
    renderSavedCubesList();
    updateBluetoothUI();
    getGanTimerCtrl()?.updateGanTimerUI?.();
  }

  function request3DCubeUpdate() {
    const el = cubeStage?.getDisplay?.();
    if (!appStore.state.solveShowCube || !el || pendingSolveCubeUpdateRaf) return;
    pendingSolveCubeUpdateRaf = requestAnimationFrame(() => {
      pendingSolveCubeUpdateRaf = null;
      try {
        const moveTokens = getTimerCtrl()?.getTrackedMoveTokens?.() || [];
        const fullSeq = [cubeStage.getBaseDisplayScramble(), ...moveTokens].filter(Boolean).join(" ");
        el.scramble = fullSeq;
        el.player?.controller?.jumpToEnd?.({ flash: false }) || el.player?.jumpToEnd?.();
      } catch {}
    });
  }

  function getDiagnosticsExtraContext() {
    const timerCtrl = getTimerCtrl();
    return {
      currentPuzzle: appStore.state.currentPuzzle,
      solveTarget: appStore.state.solveTarget,
      smartCubeStage,
      solveState: timerCtrl?.getSolveState?.() || "idle",
      currentSolveScramble: appStore.state.currentSolveScramble,
      scrambleTrackerStatus: scrambleTracker.getStatus()
    };
  }

  function copyDiagnosticsToClipboard(triggerBtn) {
    const json = smartCube.exportDiagnosticsReport(getDiagnosticsExtraContext());
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(json).then(() => {
        if (triggerBtn) {
          const orig = triggerBtn.textContent;
          triggerBtn.textContent = "✓ Copied!";
          setTimeout(() => { triggerBtn.textContent = orig; updateDiagnosticsUI(); }, 1800);
        }
      }).catch(() => {
        void modalManager.promptDialog({
          title: "Smart Cube Diagnostics JSON",
          message: "Copy diagnostics payload:",
          defaultValue: json,
          confirmLabel: "Close",
          readOnly: true
        });
      });
    } else {
      void modalManager.promptDialog({
        title: "Smart Cube Diagnostics JSON",
        message: "Copy diagnostics payload:",
        defaultValue: json,
        confirmLabel: "Close",
        readOnly: true
      });
    }
  }

  function downloadDiagnosticsJson() {
    const json = smartCube.exportDiagnosticsReport(getDiagnosticsExtraContext());
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `smartcube-diag-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Event listeners
  bluetoothBtn?.addEventListener("click", openBluetoothModal);
  bluetoothModalCloseBtn?.addEventListener("click", closeBluetoothModal);
  btModalDismissBtn?.addEventListener("click", closeBluetoothModal);
  btResetBtn?.addEventListener("click", handleBluetoothReset);
  btErrorDismissBtn?.addEventListener("click", () => { if (btErrorAlert) btErrorAlert.hidden = true; });

  btConnectBtn?.addEventListener("click", async () => {
    if (btErrorAlert) btErrorAlert.hidden = true;
    if (btStatusDesc) btStatusDesc.textContent = "Opening Bluetooth device picker…";
    try {
      const deviceSelection = btUnfilteredCheckbox?.checked ? "any" : "filtered";
      const manualMac = btCustomMacInput?.value?.trim() || "";
      await smartCube.connect({ deviceSelection, manualMac });
      if (btErrorAlert) btErrorAlert.hidden = true;
    } catch (err) {
      if (err && (err.name === "NotFoundError" || err.code === "NotFoundError")) {
        if (btStatusDesc) btStatusDesc.textContent = "Bluetooth device selection cancelled.";
        return;
      }
      showBluetoothError(err?.message || "Failed to connect to smart cube.");
    }
  });

  if (btSaveMacBtn && btCustomMacInput) {
    btSaveMacBtn.addEventListener("click", () => {
      const raw = btCustomMacInput.value.trim();
      if (!raw) {
        smartCube.setManualMac("");
        try { localStorage.removeItem("cll_smartcube_last_mac"); } catch {}
        if (btStatusDesc) btStatusDesc.textContent = "MAC address cleared.";
        return;
      }
      const formatted = formatMacAddress(raw);
      if (!formatted) {
        showBluetoothError("Invalid MAC format. Please enter 12 hex digits (e.g. AA:BB:CC:DD:EE:FF or AABBCCDDEEFF).");
        return;
      }
      btCustomMacInput.value = formatted;
      smartCube.setManualMac(formatted);
      try { localStorage.setItem("cll_smartcube_last_mac", formatted); } catch {}
      if (btErrorAlert) btErrorAlert.hidden = true;
      if (btStatusDesc) btStatusDesc.textContent = `MAC ${formatted} saved for cube connection.`;
    });
  }

  btVirtualBtn?.addEventListener("click", async () => {
    if (btErrorAlert) btErrorAlert.hidden = true;
    try {
      await smartCube.connectVirtual(document.body, appStore.state.currentPuzzle);
    } catch (err) {
      showBluetoothError("Failed to activate virtual smart cube: " + err.message);
    }
  });
  btDisconnectBtn?.addEventListener("click", () => smartCube.disconnect());
  btDemoSolveBtn?.addEventListener("click", () => {
    closeBluetoothModal();
    solveReplayViewer.open(DEMO_SOLVE, "Demo Solve Replay");
  });

  btVirtualKeypad?.querySelectorAll(".bt-virtual-turn").forEach(btn => {
    btn.addEventListener("click", () => {
      const move = btn.dataset.move;
      if (move) smartCube.handleMove(move, performance.now());
    });
  });

  smartCubeReadyBtn?.addEventListener("click", onSmartScrambleCompleted);
  smartCubeResetSolvedBtn?.addEventListener("click", () => {
    clearScrambleCorrectionDelay();
    smartCube.logDiag("MANUAL_CALIBRATE_RESET", { scramble: appStore.state.currentSolveScramble });
    smartCube.setScramble("", appStore.state.currentPuzzle);
    scrambleTracker.reset(appStore.state.currentSolveScramble);
    renderSmartScrambleAssistant();
  });

  const toggleDiag = () => {
    if (smartCube.diagRecording) smartCube.stopDiagnostics();
    else smartCube.startDiagnostics();
    updateDiagnosticsUI();
  };
  smartCubeDiagToggleBtn?.addEventListener("click", toggleDiag);
  btDiagToggleBtn?.addEventListener("click", toggleDiag);
  smartCubeDiagCopyBtn?.addEventListener("click", () => copyDiagnosticsToClipboard(smartCubeDiagCopyBtn));
  btDiagCopyBtn?.addEventListener("click", () => copyDiagnosticsToClipboard(btDiagCopyBtn));
  btDiagDownloadBtn?.addEventListener("click", downloadDiagnosticsJson);
  btDiagClearBtn?.addEventListener("click", () => { smartCube.clearDiagnostics(); updateDiagnosticsUI(); });

  smartCube.addEventListener("progress", (e) => {
    if (btStatusDesc && e.detail?.message) btStatusDesc.textContent = e.detail.message;
  });
  smartCube.addEventListener("savedcubeschange", renderSavedCubesList);
  smartCube.addEventListener("statuschange", updateBluetoothUI);
  smartCube.addEventListener("connected", () => {
    const alertView = getDisconnectAlertView();
    alertView?.setCubeAlert?.(null);
    alertView?.renderAlerts?.();
  });
  smartCube.addEventListener("disconnected", (e) => {
    const { reason, deviceName, isVirtual } = e.detail || {};
    if (isVirtual) return;
    if (reason !== "manual" || appStore.state.mode === "solve") {
      const alertView = getDisconnectAlertView();
      alertView?.setCubeAlert?.({ deviceName: deviceName || "Smart Cube" });
      playDisconnectAlertSound();
      alertView?.renderAlerts?.();
      updateBluetoothUI();
    }
  });
  smartCube.addEventListener("solved", () => {
    getTimerCtrl()?.handleSmartCubeSolved?.();
  });

  smartCube.addEventListener("move", (e) => {
    const { move, isSolved } = e.detail || {};
    if (!move) {
      if (isSolved) getTimerCtrl()?.handleSmartCubeSolved?.();
      return;
    }

    if (btMoveChipsList) {
      btMoveChipsList.querySelector(".bt-empty-hint")?.remove();
      const chip = document.createElement("span");
      chip.className = "bt-stream-chip";
      chip.textContent = move;
      btMoveChipsList.appendChild(chip);
      if (btMoveChipsList.children.length > 25) btMoveChipsList.removeChild(btMoveChipsList.firstChild);
      chip.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "end" });
    }
    if (btTurnCounter) {
      const total = smartCube.recentMoves.length;
      btTurnCounter.textContent = `${total} turn${total === 1 ? "" : "s"}`;
    }

    const s = appStore.state;
    const timerCtrl = getTimerCtrl();
    if (s.mode === "solve" && timerCtrl) {
      const isRotation = /^[xyz]/i.test(move);
      const solveState = timerCtrl.getSolveState();

      if (smartCubeStage === "scrambling") {
        if (!scrambleTracker.isComplete()) {
          if (!isRotation) {
            scrambleTracker.applyMove(move);
            const trackerStatus = scrambleTracker.getStatus();
            smartCube.logDiag("SCRAMBLE_MOVE", { move, ...trackerStatus });
            if (scrambleTracker.isComplete()) {
              clearScrambleCorrectionDelay();
              onSmartScrambleCompleted();
            } else if (isSolved && (trackerStatus.hasError || trackerStatus.currentIndex > 0 || trackerStatus.currentSubAmount > 0)) {
              timerCtrl.handleSmartCubeSolved();
            } else if (trackerStatus.hasError || trackerStatus.currentSubAmount > 0) {
              if (scrambleErrorVisible && trackerStatus.hasError) {
                renderSmartScrambleAssistant();
              } else {
                scrambleSuppressTransient = true;
                renderSmartScrambleAssistant();
                if (scrambleCorrectionDelayTimer) clearTimeout(scrambleCorrectionDelayTimer);
                scrambleCorrectionDelayTimer = setTimeout(() => {
                  scrambleCorrectionDelayTimer = null;
                  scrambleSuppressTransient = false;
                  const stNow = scrambleTracker.getStatus();
                  scrambleErrorVisible = Boolean(stNow.hasError || stNow.currentSubAmount > 0);
                  renderSmartScrambleAssistant();
                }, SCRAMBLE_CORRECTION_DELAY_MS);
              }
            } else {
              clearScrambleCorrectionDelay();
              renderSmartScrambleAssistant();
            }
          }
          return;
        }
        clearScrambleCorrectionDelay();
        smartCubeStage = s.solveInspection ? "inspecting" : "ready";
      }

      if (ganTimer.isConnected() && solveState !== "running" &&
          (solveState === "inspecting" || smartCubeStage === "inspecting" || smartCubeStage === "ready")) {
        if (isRotation) return;
        timerCtrl.recordPreTurn(move);
        request3DCubeUpdate();
        return;
      }

      if (solveState === "inspecting" || smartCubeStage === "inspecting" || (smartCubeStage === "ready" && solveState === "idle")) {
        if (isRotation) return;
        smartCubeStage = "solving";
        timerCtrl.startSolveFromFirstSmartMove(move);
        request3DCubeUpdate();
        updateSmartCubeIndicator();
        return;
      }

      if (solveState === "running") {
        const count = timerCtrl.recordRunningMove(move, isRotation);
        if (count == null) return;
        request3DCubeUpdate();
        if (isSolved) timerCtrl.handleSmartCubeSolved();
        return;
      }
    }

    if (cubeCard && !cubeCard.hidden) {
      freeMovesCtrl?.applyFreeMove?.(move);
    }
  });

  return {
    getSmartCubeStage: () => smartCubeStage,
    setSmartCubeStage: (st) => { smartCubeStage = st; },
    isScrambleComplete: () => scrambleTracker.isComplete(),
    needsAutoResetOnSolved: () => {
      const ts = scrambleTracker.getStatus();
      return !ts.isComplete && (ts.hasError || ts.currentIndex > 0 || ts.currentSubAmount > 0 || ts.corrections.length > 0);
    },
    resetScrambleTracker,
    getScrambleTrackerHtml,
    clearScrambleCorrectionDelay,
    renderSmartScrambleAssistant,
    updateSmartCubeIndicator,
    updateBluetoothUI,
    openBluetoothModal,
    closeBluetoothModal,
    showBluetoothError,
    handleBluetoothReset
  };
}
