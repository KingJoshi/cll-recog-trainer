// Solve Timer Controller: Space/touch hold-to-arm, 15s inspection, Smart Cube auto-start/stop, and GAN Timer phase tracking

import { ganTimer, computeSolvePhaseSplits } from '../../ganTimer.js';
import { smartCube } from '../../smartCube.js';
import { ensureSolveCfop } from '../../cfopAnalyzer.js';
import { MAX_SOLVES } from '../../state/appStore.js';
import { playInspectionBeep, startMetronome, stopMetronome, playPauseAlert } from '../../services/audioService.js';
import { formatSolveTime, formatSolveDisplay } from '../../services/htmlUtils.js';
import { getSolveFingerprint } from '../../services/syncMerge.js';
import { recordTombstone } from '../../services/syncStorage.js';
import { showToast } from '../../ui/toastService.js';

const PARTIAL_CUBE_TARGETS = new Set(["layer", "face", "cross", "f2l", "oll"]);

export function createTimerController({
  appStore,
  solveReplayViewer,
  getSolvePanel = () => null,
  getStatsCtrl = () => null,
  getNavCtrl = () => null,
  getSmartCubeUi = () => null,
  getDisconnectAlertView = () => null
} = {}) {
  const solveSurface = typeof document !== "undefined" ? document.getElementById("solveSurface") : null;
  const solveOverlay = typeof document !== "undefined" ? document.getElementById("solveOverlay") : null;
  const solveOverlayTime = typeof document !== "undefined" ? document.getElementById("solveOverlayTime") : null;
  const solveOverlayHint = typeof document !== "undefined" ? document.getElementById("solveOverlayHint") : null;
  const solveOverlayCancelBtn = typeof document !== "undefined" ? document.getElementById("solveOverlayCancelBtn") : null;
  const solveLiveStats = typeof document !== "undefined" ? document.getElementById("solveLiveStats") : null;
  const solveLiveMovesCount = typeof document !== "undefined" ? document.getElementById("solveLiveMovesCount") : null;
  const solveLiveTps = typeof document !== "undefined" ? document.getElementById("solveLiveTps") : null;
  const solvePostSummary = typeof document !== "undefined" ? document.getElementById("solvePostSummary") : null;
  const solvePostReplayBtn = typeof document !== "undefined" ? document.getElementById("solvePostReplayBtn") : null;
  const solvePenaltyPlus2Btn = typeof document !== "undefined" ? document.getElementById("solvePenaltyPlus2Btn") : null;
  const solvePenaltyDnfBtn = typeof document !== "undefined" ? document.getElementById("solvePenaltyDnfBtn") : null;
  const solveDeleteLastBtn = typeof document !== "undefined" ? document.getElementById("solveDeleteLastBtn") : null;

  let solveState = "idle"; // "idle" | "inspecting" | "armed" | "running"
  let solveStart = 0;
  let solveRaf = 0;
  let solveInspectionStart = 0;
  let solveInspectionInterval = 0;
  let solveArmTimeout = 0;
  let solvePenalty = null; // null | "+2" | "DNF"
  let solveWarning8Played = false;
  let solveWarning12Played = false;
  let overlayHideOnPointerUp = false;
  let swallowNextClick = false;

  // GAN Timer, Spacebar/Touch & Smart Cube split timestamps
  let solveTimerDriven = false;
  let solveTimerSource = ""; // "" | "GAN Smart Timer" | "Spacebar" | "Touch"
  let solveTimerStartTs = 0;
  let solveFirstMoveTs = 0;
  let solveCubeSolvedTs = 0;
  let solveMoveOrigin = 0;
  let solveInspectionMs = null;
  let trackedSolveMoves = [];

  function resetTimerPhaseTracking() {
    solveTimerDriven = false;
    solveTimerSource = "";
    solveTimerStartTs = 0;
    solveFirstMoveTs = 0;
    solveCubeSolvedTs = 0;
    solveMoveOrigin = 0;
    solveInspectionMs = null;
  }

  function getRunningOverlayHint() {
    const isVirtualCube = Boolean(smartCube.getStatus().connected && smartCube.isVirtual);
    if (solveTimerDriven) {
      const isGan = solveTimerSource === "GAN Smart Timer";
      if (solveCubeSolvedTs) {
        return isGan
          ? "✓ Cube solved · Put it down & stop the GAN timer"
          : "✓ Cube solved · Put it down & press Space or tap to stop";
      }
      const base = isGan
        ? "Stop the GAN timer to finish · Esc to cancel"
        : (isVirtualCube
          ? "Virtual cube active · Press Space to stop · Esc to cancel"
          : "Pick up cube & solve · Press any key or tap to stop · Esc to cancel");
      if (solvePenalty === "+2") return `Running (+2 penalty) · ${base}`;
      if (solvePenalty === "DNF") return `Running (DNF) · ${base}`;
      return base;
    }
    const stopHint = isVirtualCube
      ? "Press Space, tap, or solve cube to stop"
      : "Any key, tap, or solve cube to stop";
    return solvePenalty === "+2"
      ? `Running (+2 penalty) · ${stopHint}`
      : (solvePenalty === "DNF" ? `Running (DNF) · ${stopHint}` : stopHint);
  }

  function hideSolveOverlay() {
    overlayHideOnPointerUp = false;
    if (solveOverlay) {
      solveOverlay.hidden = true;
      solveOverlay.className = "solve-overlay";
    }
    if (solveOverlayCancelBtn) solveOverlayCancelBtn.hidden = true;
    getDisconnectAlertView()?.renderAlerts?.();
  }

  function startSolveInspection() {
    const s = appStore.state;
    if (s.mode !== "solve" || solveState !== "idle") return;
    solveState = "inspecting";
    solvePenalty = null;
    solveWarning8Played = false;
    solveWarning12Played = false;
    solveInspectionStart = performance.now();

    if (typeof document !== "undefined" && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    if (solveOverlay) {
      solveOverlay.className = "solve-overlay inspecting";
      solveOverlay.hidden = false;
    }
    if (solveOverlayCancelBtn) solveOverlayCancelBtn.hidden = false;
    if (solveOverlayTime) solveOverlayTime.textContent = "15";
    if (solveOverlayHint) {
      solveOverlayHint.textContent = ganTimer.isConnected()
        ? "Start the GAN timer when ready · Esc to cancel"
        : "Hold Space when ready · Esc to cancel";
    }
    getDisconnectAlertView()?.renderAlerts?.();

    clearInterval(solveInspectionInterval);
    solveInspectionInterval = setInterval(() => {
      if (solveState !== "inspecting" && solveState !== "armed") return;
      const elapsedSec = Math.floor((performance.now() - solveInspectionStart) / 1000);
      const remaining = 15 - elapsedSec;

      if (remaining > 0) {
        if (solveState === "inspecting" && solveOverlayTime) {
          solveOverlayTime.textContent = String(remaining);
        }
        if (remaining <= 7 && remaining > 3 && !solveWarning8Played) {
          solveWarning8Played = true;
          playInspectionBeep(440, 0.08);
          solveOverlay?.classList.add("warning-8");
        }
        if (remaining <= 3 && !solveWarning12Played) {
          solveWarning12Played = true;
          playInspectionBeep(880, 0.1);
          solveOverlay?.classList.remove("warning-8");
          solveOverlay?.classList.add("warning-12");
        }
      } else if (remaining <= 0 && remaining >= -2) {
        solvePenalty = "+2";
        solveOverlay?.classList.remove("warning-8", "warning-12");
        solveOverlay?.classList.add("penalty-plus2");
        if (solveState === "inspecting" && solveOverlayTime) solveOverlayTime.textContent = "+2";
        if (solveOverlayHint) {
          solveOverlayHint.textContent = ganTimer.isConnected()
            ? "+2 penalty · Start the GAN timer"
            : "+2 penalty · Hold Space when ready";
        }
      } else {
        solvePenalty = "DNF";
        solveOverlay?.classList.remove("warning-8", "warning-12", "penalty-plus2");
        solveOverlay?.classList.add("penalty-dnf");
        if (solveState === "inspecting" && solveOverlayTime) solveOverlayTime.textContent = "DNF";
        if (solveOverlayHint) solveOverlayHint.textContent = "Inspection exceeded 17s (DNF)";
      }
    }, 100);
  }

  function armSolve() {
    const s = appStore.state;
    if (s.mode !== "solve" || (solveState !== "idle" && solveState !== "inspecting")) return;
    if (s.solveTarget === "cll" && !s.currentCaseId) return;
    if (ganTimer.isConnected()) return;

    solveState = "armed";
    if (typeof document !== "undefined" && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }

    if (solveOverlay) {
      solveOverlay.hidden = false;
      solveOverlay.classList.add("armed");
    }
    if (solveOverlayCancelBtn) solveOverlayCancelBtn.hidden = false;
    if (solveOverlayTime) {
      solveOverlayTime.textContent = solvePenalty === "+2" ? "+2" : (solvePenalty === "DNF" ? "DNF" : "0.00");
    }
    if (solveOverlayHint) solveOverlayHint.textContent = "Release to start";
    getDisconnectAlertView()?.renderAlerts?.();
  }

  function startSolve(fromSmartCube = false, { timerDriven = false, timerSource = "", startTs = null } = {}) {
    const autoStart = fromSmartCube || timerDriven;
    if (!autoStart && solveState !== "armed") return;
    if (autoStart && solveState !== "inspecting" && solveState !== "idle" && solveState !== "armed") return;

    solveState = "running";
    clearInterval(solveInspectionInterval);
    clearTimeout(solveArmTimeout);

    solveStart = startTs != null ? startTs : performance.now();
    solveInspectionMs = solveInspectionStart > 0 ? Math.max(0, Math.round(solveStart - solveInspectionStart)) : null;
    solveInspectionStart = 0;
    solveTimerDriven = Boolean(timerDriven);
    solveTimerSource = timerDriven ? (timerSource || "GAN Smart Timer") : "";
    solveTimerStartTs = timerDriven ? solveStart : 0;
    solveCubeSolvedTs = 0;

    const keepPreTimerMoves = timerDriven && solveFirstMoveTs > 0 && trackedSolveMoves.length > 0;
    if (!keepPreTimerMoves) {
      trackedSolveMoves = [];
      solveFirstMoveTs = 0;
      solveMoveOrigin = solveStart;
    }

    getSmartCubeUi()?.calibrateGyro?.();
    if (appStore.state.metronomeEnabled) {
      startMetronome(appStore.state.metronomeBpm);
    }

    if (solveOverlay) {
      solveOverlay.className = "solve-overlay";
      solveOverlay.hidden = false;
    }
    if (solveOverlayCancelBtn) solveOverlayCancelBtn.hidden = !timerDriven;
    if (solveOverlayHint) solveOverlayHint.textContent = getRunningOverlayHint();
    if (solveLiveStats) solveLiveStats.hidden = false;
    if (solveLiveMovesCount) solveLiveMovesCount.textContent = `${trackedSolveMoves.length} moves`;
    if (solveLiveTps) solveLiveTps.textContent = "0.00 TPS";
    if (solvePostSummary) solvePostSummary.hidden = true;
    getDisconnectAlertView()?.renderAlerts?.();

    const tick = () => {
      if (solveState !== "running") return;
      if (solveOverlayTime) solveOverlayTime.textContent = formatSolveTime(performance.now() - solveStart);
      if (typeof requestAnimationFrame === "function") solveRaf = requestAnimationFrame(tick);
    };
    if (typeof requestAnimationFrame === "function") tick();
  }

  function stopSolve(byPointer, { hardwareMs = null, stopTs = null } = {}) {
    if (solveState !== "running") return;
    const s = appStore.state;
    const localStopTs = stopTs != null ? stopTs : performance.now();
    const localMs = localStopTs - solveStart;
    const rawMs = Number.isFinite(hardwareMs) && hardwareMs > 0 ? hardwareMs : localMs;
    solveState = "idle";
    stopMetronome();
    if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(solveRaf);
    clearInterval(solveInspectionInterval);

    const scr = s.scrambleMoves || s.currentSolveScramble || s.scramble;
    const isCaseTarget = ["cll", "pll", "oll", "f2l", "ortega", "parity", "timer-drill"].includes(s.solveTarget);
    const hasMoves = trackedSolveMoves && trackedSolveMoves.length > 0;
    const faceMoveCount = hasMoves ? trackedSolveMoves.filter(m => !m.isRotation).length : null;
    const moveCount = hasMoves ? (faceMoveCount > 0 ? faceMoveCount : trackedSolveMoves.length) : null;
    const smartCubeName = hasMoves ? (smartCube.deviceName || (smartCube.isVirtual ? "Virtual Keyboard Cube" : "Smart Cube")) : null;

    let finalMs = Math.round(rawMs);
    if (solvePenalty === "+2") finalMs += 2000;

    // Evaluate unfinished Smart Cube state on full-cube targets (+2 if 1 HTM move away, DNF otherwise)
    const expectsSolvedCube = !PARTIAL_CUBE_TARGETS.has(s.solveTarget);
    const smartCubeTracked = smartCube.getStatus().connected && (solveTimerDriven || hasMoves);
    let unsolvedFinishState = null;
    if (expectsSolvedCube && smartCubeTracked && !solveCubeSolvedTs) {
      const finishState = typeof smartCube.evaluateFinishState === "function"
        ? smartCube.evaluateFinishState()
        : (smartCube.isCubeSolved() ? "solved" : "DNF");
      if (finishState === "+2") {
        unsolvedFinishState = "+2";
        if (solvePenalty !== "DNF") {
          if (solvePenalty !== "+2") finalMs += 2000;
          solvePenalty = "+2";
        }
      } else if (finishState === "DNF") {
        unsolvedFinishState = "DNF";
        solvePenalty = "DNF";
        finalMs = Math.round(rawMs);
      }
    }

    const hadTimerStart = solveTimerDriven || solveTimerStartTs > 0;
    let phases = null;
    if (hadTimerStart) {
      phases = computeSolvePhaseSplits({
        timerStartTs: solveTimerStartTs,
        firstMoveTs: hasMoves ? solveFirstMoveTs : 0,
        solvedTs: (hasMoves && !unsolvedFinishState) ? (solveCubeSolvedTs || (!solveTimerDriven ? localStopTs : 0)) : 0,
        timerStopTs: solveTimerDriven ? localStopTs : 0
      });
    }
    const tpsBaseMs = phases?.cubeMs != null ? phases.cubeMs : rawMs;
    const tps = hasMoves && tpsBaseMs > 0 ? Number((moveCount / (tpsBaseMs / 1000)).toFixed(2)) : null;

    const lastSolve = {
      uid: "s-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7),
      puzzle: s.currentPuzzle,
      track: s.currentTrackId,
      target: s.solveTarget,
      id: isCaseTarget ? (s.currentCaseId || null) : null,
      ms: finalMs,
      rawMs: Math.round(rawMs),
      penalty: solvePenalty,
      at: Date.now(),
      scramble: scr,
      moves: hasMoves ? [...trackedSolveMoves] : null,
      moveCount,
      tps,
      smartCube: smartCubeName
    };
    if (unsolvedFinishState) {
      lastSolve.finishState = unsolvedFinishState;
    }
    if (solveInspectionMs != null) {
      lastSolve.inspectionMs = solveInspectionMs;
    }
    if (hadTimerStart) {
      lastSolve.timer = solveTimerSource || "GAN Smart Timer";
      lastSolve.pickupMs = phases.pickupMs;
      lastSolve.cubeMs = phases.cubeMs;
      lastSolve.putdownMs = phases.putdownMs;
      smartCube.logDiag("TIMER_SOLVE_DONE", {
        timer: lastSolve.timer,
        rawMs: lastSolve.rawMs,
        inspectionMs: lastSolve.inspectionMs,
        ...phases
      });
    }

    solveInspectionStart = 0;
    solvePenalty = null;
    s.lastSolve = lastSolve;
    resetTimerPhaseTracking();
    ensureSolveCfop(lastSolve);
    s.sessionLogPage = 1;

    const solves = appStore.getSolves();
    solves.push(lastSolve);
    if (Number.isFinite(MAX_SOLVES) && solves.length > MAX_SOLVES) {
      solves.splice(0, solves.length - MAX_SOLVES);
    }
    appStore.setSolves(solves);

    if (solveOverlayTime) solveOverlayTime.textContent = formatSolveDisplay(lastSolve);
    if (solveLiveStats) solveLiveStats.hidden = true;
    if (hasMoves && solvePostSummary && solvePostReplayBtn) {
      solvePostSummary.hidden = false;
      solvePostReplayBtn.onclick = () => solveReplayViewer.open(lastSolve, "Latest Solve Replay");
    }

    if (byPointer) {
      overlayHideOnPointerUp = true;
      setTimeout(() => { if (overlayHideOnPointerUp) hideSolveOverlay(); }, 500);
    } else {
      hideSolveOverlay();
    }

    const scUi = getSmartCubeUi();
    getSolvePanel()?.setScrambleSource?.("");
    if (unsolvedFinishState) {
      scUi?.setNeedsCubeReset?.(unsolvedFinishState);
      getSolvePanel()?.renderSolvePanel?.();
      getStatsCtrl()?.updateStatsTable?.();
      scUi?.updateSmartCubeIndicator?.();
      if (unsolvedFinishState === "+2") {
        showToast("+2 penalty — cube was 1 move away from solved. Finish solving & reset the cube for the next scramble.", "warning", 5000);
      } else {
        showToast(`DNF (${formatSolveTime(rawMs)}) — cube was not solved. Solve & reset the cube for the next scramble.`, "error", 5500);
      }
      return;
    }
    scUi?.setSmartCubeStage?.("scrambling");
    getSolvePanel()?.renderSolvePanel?.();
    getStatsCtrl()?.updateStatsTable?.();
    getNavCtrl()?.regenerateScramble?.();
  }

  function cancelSolve() {
    solveState = "idle";
    stopMetronome();
    const scUi = getSmartCubeUi();
    scUi?.setSmartCubeStage?.("scrambling");
    scUi?.clearScrambleCorrectionDelay?.();
    if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(solveRaf);
    clearInterval(solveInspectionInterval);
    clearTimeout(solveArmTimeout);
    solveInspectionStart = 0;
    solvePenalty = null;
    trackedSolveMoves = [];
    resetTimerPhaseTracking();
    if (solveLiveStats) solveLiveStats.hidden = true;
    hideSolveOverlay();
    if (smartCube.getStatus().connected) {
      scUi?.resetScrambleTracker?.(appStore.state.currentSolveScramble, false);
      scUi?.renderSmartScrambleAssistant?.();
    }
    getSolvePanel()?.renderSolvePanel?.();
  }

  function handleSmartCubeSolved() {
    const s = appStore.state;
    const scUi = getSmartCubeUi();
    if (s.mode === "solve" && solveState === "idle" && scUi?.getSmartCubeStage?.() === "needs_reset") {
      scUi.completeCubeReset?.();
      return;
    }
    if (s.mode === "solve" && solveState === "idle" && scUi?.getSmartCubeStage?.() === "scrambling") {
      if (scUi?.needsAutoResetOnSolved?.()) {
        scUi.clearScrambleCorrectionDelay();
        smartCube.setScramble("", s.currentPuzzle);
        scUi.resetScrambleTracker(s.currentSolveScramble, false);
        smartCube.logDiag("SCRAMBLE_AUTO_RESET_ON_SOLVED", { scramble: s.currentSolveScramble });
        scUi.renderSmartScrambleAssistant();
      }
      return;
    }
    if (s.mode !== "solve" || solveState !== "running") return;
    if (!trackedSolveMoves || trackedSolveMoves.length === 0) return;
    if (solveTimerDriven) {
      if (!solveFirstMoveTs || solveCubeSolvedTs) return;
      solveCubeSolvedTs = performance.now();
      smartCube.logDiag("TIMER_CUBE_SOLVED", { sinceTimerStart: Math.round(solveCubeSolvedTs - solveTimerStartTs) });
      solveOverlay?.classList.add("cube-solved");
      if (solveOverlayHint) solveOverlayHint.textContent = getRunningOverlayHint();
      scUi?.updateSmartCubeIndicator?.();
      return;
    }
    if (solveTimerStartTs > 0 && !solveCubeSolvedTs) {
      solveCubeSolvedTs = performance.now();
    }
    stopSolve(false);
    scUi?.setSmartCubeStage?.(s.solveTarget === "timer-drill" ? (s.solveInspection ? "inspecting" : "ready") : "scrambling");
    scUi?.updateSmartCubeIndicator?.();
  }

  function showGanTimerHandsOverlay(state) {
    const s = appStore.state;
    if (s.mode !== "solve" || (solveState !== "idle" && solveState !== "inspecting")) return;
    if (s.solveTarget === "cll" && !s.currentCaseId) return;
    if (solveOverlay) {
      solveOverlay.hidden = false;
      solveOverlay.classList.remove("gan-hands-on", "armed");
      solveOverlay.classList.add(state === "GET_SET" ? "armed" : "gan-hands-on");
    }
    if (solveState === "idle") {
      if (solveOverlayTime) solveOverlayTime.textContent = "0.00";
      if (solveOverlayCancelBtn) solveOverlayCancelBtn.hidden = true;
    }
    if (solveOverlayHint) {
      solveOverlayHint.textContent = state === "GET_SET"
        ? "Ready · Release the timer to start"
        : "Hands on timer · Hold until green…";
    }
    getDisconnectAlertView()?.renderAlerts?.();
  }

  function clearGanTimerHandsOverlay() {
    solveOverlay?.classList.remove("gan-hands-on", "armed");
    if (appStore.state.mode !== "solve") return;
    if (solveState === "idle") {
      hideSolveOverlay();
    } else if (solveState === "inspecting" && solveOverlayHint) {
      solveOverlayHint.textContent = "Start the GAN timer when ready · Esc to cancel";
    }
  }

  function startTimerDrivenSolve(ts) {
    const s = appStore.state;
    const scUi = getSmartCubeUi();
    if (s.mode !== "solve" || solveState === "running") return;
    if (s.solveTarget === "cll" && !s.currentCaseId) return;
    if (smartCube.getStatus().connected && scUi?.getSmartCubeStage?.() === "needs_reset") {
      showToast("Solve & reset your smart cube first (or click ↺ Cube Solved / Reset).", "warning", 3000);
      return;
    }
    const cubeTracking = smartCube.getStatus().connected &&
      (scUi?.getSmartCubeStage?.() === "inspecting" || scUi?.getSmartCubeStage?.() === "ready");
    if (cubeTracking) {
      scUi.setSmartCubeStage("solving");
    } else {
      trackedSolveMoves = [];
      solveFirstMoveTs = 0;
    }
    startSolve(false, { timerDriven: true, timerSource: "GAN Smart Timer", startTs: ts });
    if (!cubeTracking && solveLiveStats) solveLiveStats.hidden = true;
    smartCube.logDiag("TIMER_RUNNING", { cubeTracking, preTurns: trackedSolveMoves.length });
    scUi?.updateSmartCubeIndicator?.();
  }

  function startManualArmedSolve(source = "Spacebar") {
    const s = appStore.state;
    const scUi = getSmartCubeUi();
    const stage = scUi?.getSmartCubeStage?.();
    if (smartCube.getStatus().connected && stage === "needs_reset") {
      solveState = "idle";
      hideSolveOverlay();
      showToast("Solve & reset your smart cube first (or click ↺ Cube Solved / Reset).", "warning", 3000);
      return;
    }
    const cubeTracking = smartCube.getStatus().connected &&
      (stage === "inspecting" || stage === "ready" || s.solveTarget === "timer-drill");

    if (cubeTracking) {
      scUi?.setSmartCubeStage?.("solving");
      startSolve(false, { timerDriven: true, timerSource: source });
      smartCube.logDiag("TIMER_RUNNING", { timerSource: source, cubeTracking: true });
      scUi?.updateSmartCubeIndicator?.();
    } else {
      startSolve(false);
    }
  }

  function onGanTimerDisconnectedMidSolve() {
    if (solveState === "running" && solveTimerDriven) {
      solveTimerDriven = false;
      solveOverlay?.classList.remove("cube-solved");
      if (solveOverlayHint) {
        solveOverlayHint.textContent = "⚠️ GAN TIMER DISCONNECTED! Press any key or tap to stop";
      }
    } else {
      clearGanTimerHandsOverlay();
    }
  }

  function onSolveKeyDown(e) {
    const s = appStore.state;
    if (s.mode !== "solve") return false;
    if (solveState === "running") {
      if (["Shift", "Control", "Alt", "Meta", "CapsLock"].includes(e.key)) {
        return false;
      }
      if (solveTimerDriven && solveTimerSource === "GAN Smart Timer") {
        e.preventDefault();
        if (e.key === "Escape") cancelSolve();
        return true;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        cancelSolve();
        return true;
      }
      const isVirtualCube = Boolean(smartCube.getStatus().connected && smartCube.isVirtual);
      if (isVirtualCube) {
        if (e.code === "Space") {
          e.preventDefault();
          stopSolve(false);
          return true;
        }
        return false;
      }
      e.preventDefault();
      stopSolve(false);
      return true;
    }
    if (e.key === "Escape" && (solveState === "inspecting" || solveState === "armed")) {
      e.preventDefault();
      cancelSolve();
      return true;
    }
    if (e.code === "Space") {
      e.preventDefault();
      if (e.repeat) return true;
      if (solveState === "idle") {
        if (smartCube.getStatus().connected && getSmartCubeUi()?.getSmartCubeStage?.() === "needs_reset") {
          showToast("Solve & reset your smart cube first (or click ↺ Cube Solved / Reset).", "warning", 3000);
          return true;
        }
        if (s.solveInspection) startSolveInspection();
        else armSolve();
        return true;
      }
      if (solveState === "inspecting") {
        clearTimeout(solveArmTimeout);
        solveArmTimeout = setTimeout(() => {
          if (solveState === "inspecting") armSolve();
        }, 150);
      }
      return true;
    }
    return false;
  }

  function onSolveKeyUp(e) {
    if (appStore.state.mode !== "solve") return false;
    if (e.code === "Space") {
      e.preventDefault();
      clearTimeout(solveArmTimeout);
      if (solveState === "armed") {
        startManualArmedSolve("Spacebar");
      }
      return true;
    }
    return false;
  }

  function toggleLastSolvePenalty(targetPenalty) {
    const solves = appStore.getSolves();
    const last = appStore.state.lastSolve;
    if (!last || !solves.length) return;
    const isSame = last.penalty === targetPenalty ||
      (targetPenalty === "+2" && last.penalty === 2) ||
      (targetPenalty === "DNF" && last.penalty === -1);
    const raw = last.rawMs != null && Number.isFinite(last.rawMs) ? last.rawMs : (last.ms ?? 0);
    last.rawMs = raw;
    if (isSame) {
      last.penalty = null;
      last.ms = raw;
    } else {
      last.penalty = targetPenalty;
      last.ms = targetPenalty === "+2" ? raw + 2000 : raw;
    }
    last.updatedAt = Date.now();
    appStore.setSolves(solves);
    getSolvePanel()?.renderSolvePanel?.();
    getStatsCtrl()?.updateStatsTable?.();
  }

  function recordPreTurn(move) {
    const now = performance.now();
    if (!solveFirstMoveTs) {
      solveFirstMoveTs = now;
      solveMoveOrigin = now;
      trackedSolveMoves = [];
    }
    const t = Math.round(now - solveMoveOrigin);
    const prevT = trackedSolveMoves.length > 0 ? trackedSolveMoves[trackedSolveMoves.length - 1].t : 0;
    trackedSolveMoves.push({ move, t, split: trackedSolveMoves.length ? Math.max(10, t - prevT) : 0 });
    smartCube.logDiag("TIMER_PRE_TURN", { move, count: trackedSolveMoves.length });
  }

  function startSolveFromFirstSmartMove(move) {
    startSolve(true);
    solveFirstMoveTs = solveStart;
    trackedSolveMoves = [{ move, t: 0, split: 0 }];
    if (solveLiveMovesCount) solveLiveMovesCount.textContent = "1 move";
    if (solveLiveTps) solveLiveTps.textContent = "0.00 TPS";
  }

  function recordRunningMove(move, isRotation) {
    if (solveTimerDriven && getSmartCubeUi()?.getSmartCubeStage?.() !== "solving") return null;
    const now = performance.now();
    if (solveTimerDriven || solveTimerStartTs > 0) {
      if (isRotation && !solveFirstMoveTs) return null;
      if (!solveFirstMoveTs) {
        solveFirstMoveTs = now;
        solveMoveOrigin = now;
        smartCube.logDiag("TIMER_FIRST_TURN", { pickupMs: Math.round(now - solveTimerStartTs) });
        getSmartCubeUi()?.updateSmartCubeIndicator?.();
      }
      if (solveCubeSolvedTs) {
        solveCubeSolvedTs = 0;
        solveOverlay?.classList.remove("cube-solved");
        if (solveOverlayHint) solveOverlayHint.textContent = getRunningOverlayHint();
        getSmartCubeUi()?.updateSmartCubeIndicator?.();
      }
    }
    const elapsed = Math.round(now - solveMoveOrigin);
    const prevT = trackedSolveMoves.length > 0 ? trackedSolveMoves[trackedSolveMoves.length - 1].t : 0;
    const split = trackedSolveMoves.length > 0 ? Math.max(10, elapsed - prevT) : 0;
    trackedSolveMoves.push({ move, t: elapsed, split, isRotation: Boolean(isRotation) });
    if (appStore.state.pauseAlertEnabled && !isRotation && split >= 400) {
      playPauseAlert();
    }
    const faceTurnCount = trackedSolveMoves.filter(m => !m.isRotation).length;
    if (solveLiveMovesCount) solveLiveMovesCount.textContent = `${faceTurnCount} moves`;
    if (solveLiveTps) {
      const tps = elapsed > 0 ? (faceTurnCount / (elapsed / 1000)).toFixed(2) : "0.00";
      solveLiveTps.textContent = `${tps} TPS`;
    }
    return trackedSolveMoves.length;
  }

  function recordSmartRotation(rotMove) {
    if (solveState !== "running" || !rotMove) return null;
    if (solveTimerDriven && getSmartCubeUi()?.getSmartCubeStage?.() !== "solving") return null;
    if ((solveTimerDriven || solveTimerStartTs > 0) && !solveFirstMoveTs) return null;
    const elapsed = Math.max(0, Math.round(performance.now() - solveMoveOrigin));
    trackedSolveMoves.push({ move: rotMove, t: elapsed, split: 0, isRotation: true });
    return trackedSolveMoves.length;
  }

  // Pointer & penalty button bindings
  solveSurface?.addEventListener("pointerdown", e => {
    if (e.target.closest("button") || e.target.closest("input") || e.target.closest("label") || e.target.closest("select") || e.target.closest(".bt-disconnect-banner") || e.target.closest(".solve-inline-recent-stats")) return;
    if (appStore.state.mode !== "solve" || solveState !== "idle") return;
    e.preventDefault();
    if (smartCube.getStatus().connected && getSmartCubeUi()?.getSmartCubeStage?.() === "needs_reset") {
      showToast("Solve & reset your smart cube first (or click ↺ Cube Solved / Reset).", "warning", 3000);
      return;
    }
    if (appStore.state.solveInspection) startSolveInspection();
    else armSolve();
  });

  solveOverlay?.addEventListener("pointerdown", e => {
    if (e.target.closest("#solveOverlayCancelBtn")) {
      cancelSolve();
      return;
    }
    e.preventDefault();
    if (appStore.state.mode !== "solve") return;
    if (solveState === "running") {
      if (solveTimerDriven && solveTimerSource === "GAN Smart Timer") return;
      stopSolve(true);
      return;
    }
    if (solveState === "inspecting") {
      clearTimeout(solveArmTimeout);
      solveArmTimeout = setTimeout(() => {
        if (solveState === "inspecting") armSolve();
      }, 150);
    }
  });

  if (typeof document !== "undefined") {
    document.addEventListener("pointerup", () => {
      if (appStore.state.mode !== "solve") return;
      clearTimeout(solveArmTimeout);
      if (solveState === "armed") {
        startManualArmedSolve("Touch");
      } else if (overlayHideOnPointerUp) {
        hideSolveOverlay();
        swallowNextClick = true;
        setTimeout(() => { swallowNextClick = false; }, 300);
      }
    });
    document.addEventListener("pointercancel", () => {
      if (appStore.state.mode === "solve" && (solveState === "armed" || solveState === "inspecting")) {
        cancelSolve();
      }
    });
    document.addEventListener("click", e => {
      if (swallowNextClick) {
        swallowNextClick = false;
        e.stopPropagation();
        e.preventDefault();
      }
    }, true);
  }

  solveOverlayCancelBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    if (appStore.state.mode === "solve") cancelSolve();
  });

  solvePenaltyPlus2Btn?.addEventListener("click", () => toggleLastSolvePenalty("+2"));
  solvePenaltyDnfBtn?.addEventListener("click", () => toggleLastSolvePenalty("DNF"));
  solveDeleteLastBtn?.addEventListener("click", () => {
    const solves = appStore.getSolves();
    const last = appStore.state.lastSolve;
    if (!last || !solves.length) return;
    const removed = solves.pop();
    const fp = getSolveFingerprint(removed);
    if (fp) recordTombstone("solves", fp);
    appStore.state.lastSolve = solves.length ? solves[solves.length - 1] : null;
    appStore.setSolves(solves);
    getSolvePanel()?.renderSolvePanel?.();
    getStatsCtrl()?.updateStatsTable?.();
    showToast("Deleted last solve.", "info", 2000);
  });

  return {
    getSolveState: () => solveState,
    isTimerDriven: () => solveTimerDriven,
    getTimerSource: () => solveTimerSource,
    getSolveStartTs: () => solveStart,
    getTimerStartTs: () => solveTimerStartTs,
    getFirstMoveTs: () => solveFirstMoveTs,
    getCubeSolvedTs: () => solveCubeSolvedTs,
    getTrackedMoveTokens: () => trackedSolveMoves.map(m => m.move),
    getTrackedMoveCount: () => trackedSolveMoves.length,
    getOverlayHintSetter: (msg) => { if (solveOverlayHint) solveOverlayHint.textContent = msg; },
    startSolveInspection,
    armSolve,
    startSolve,
    stopSolve,
    cancelSolve,
    handleSmartCubeSolved,
    showGanTimerHandsOverlay,
    clearGanTimerHandsOverlay,
    startTimerDrivenSolve,
    onGanTimerDisconnectedMidSolve,
    onSolveKeyDown,
    onSolveKeyUp,
    recordPreTurn,
    startSolveFromFirstSmartMove,
    recordRunningMove,
    recordSmartRotation,
    resetTimerPhaseTracking,
    toggleLastSolvePenalty
  };
}
