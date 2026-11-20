// In-Place 3D Quick-Simulate Popup Modal
// Lets users play, step through, and switch between multiple optimal/case solutions without leaving Solve/Practice/Study

import { parseScrambleInput, cleanAlg } from '../../algParser.js';
import { applyColorsTo3DCube } from '../../caseVisualizer.js';
import { escapeHtml } from '../../services/htmlUtils.js';
import { copyTextWithButtonFeedback } from '../../services/clipboard.js';
import { ICON_PLAY, ICON_PAUSE, ICON_REPLAY } from '../../ui/transportIcons.js';

let ScrambleDisplayClass = null;
async function getScrambleDisplay() {
  if (!ScrambleDisplayClass && typeof window !== "undefined") {
    const mod = await import("scramble-display");
    ScrambleDisplayClass = mod.ScrambleDisplay;
  }
  return ScrambleDisplayClass;
}

function capitalize(str) {
  if (!str) return "";
  return String(str).charAt(0).toUpperCase() + String(str).slice(1);
}

export function createQuickSimModal({ modalManager, appStore } = {}) {
  const modal = typeof document !== "undefined" ? document.getElementById("quickSimModal") : null;
  const titleEl = typeof document !== "undefined" ? document.getElementById("quickSimTitle") : null;
  const badgesEl = typeof document !== "undefined" ? document.getElementById("quickSimBadges") : null;
  const closeBtn = typeof document !== "undefined" ? document.getElementById("quickSimCloseBtn") : null;
  const dismissBtn = typeof document !== "undefined" ? document.getElementById("quickSimDismissBtn") : null;

  const switcherEl = typeof document !== "undefined" ? document.getElementById("quickSimSwitcher") : null;
  const prevSolBtn = typeof document !== "undefined" ? document.getElementById("quickSimPrevSolBtn") : null;
  const solCounterEl = typeof document !== "undefined" ? document.getElementById("quickSimSolCounter") : null;
  const nextSolBtn = typeof document !== "undefined" ? document.getElementById("quickSimNextSolBtn") : null;
  const solPillsEl = typeof document !== "undefined" ? document.getElementById("quickSimSolPills") : null;

  const cubeWrap = typeof document !== "undefined" ? document.getElementById("quickSim3dWrap") : null;
  const resetCamBtn = typeof document !== "undefined" ? document.getElementById("quickSimResetCamBtn") : null;
  const stepCounterEl = typeof document !== "undefined" ? document.getElementById("quickSimStepCounter") : null;

  const btnScrambleStart = typeof document !== "undefined" ? document.getElementById("quickSimBtnScrambleStart") : null;
  const btnStart = typeof document !== "undefined" ? document.getElementById("quickSimBtnStart") : null;
  const btnPrev = typeof document !== "undefined" ? document.getElementById("quickSimBtnPrev") : null;
  const btnPlay = typeof document !== "undefined" ? document.getElementById("quickSimBtnPlay") : null;
  const playIconEl = typeof document !== "undefined" ? document.getElementById("quickSimPlayIcon") : null;
  const playTextEl = typeof document !== "undefined" ? document.getElementById("quickSimPlayText") : null;
  const btnNext = typeof document !== "undefined" ? document.getElementById("quickSimBtnNext") : null;
  const btnEnd = typeof document !== "undefined" ? document.getElementById("quickSimBtnEnd") : null;

  const moveListEl = typeof document !== "undefined" ? document.getElementById("quickSimMoveList") : null;
  const noteEl = typeof document !== "undefined" ? document.getElementById("quickSimNote") : null;
  const copyBtn = typeof document !== "undefined" ? document.getElementById("quickSimCopyBtn") : null;
  const fullSimBtn = typeof document !== "undefined" ? document.getElementById("quickSimFullSimBtn") : null;
  const speedBtns = typeof document !== "undefined" ? Array.from(document.querySelectorAll(".quick-sim-speed-btn")) : [];

  let displayEl = null;
  let mountedPuzzle = null;
  let indexer = null;
  let mountGen = 0;
  let loadGen = 0;

  let currentPuzzle = "222";
  let currentSolutions = [];
  let activeSolIdx = 0;
  let setupMoves = [];
  let solMoves = [];
  let combinedMoves = [];
  let activeMoveCount = 0; // 0..combinedMoves.length
  let speed = appStore?.state?.simSpeed ?? 1;
  let pendingSeek = false;
  let isPlaying = false;
  let openFullSimCb = null;

  function syncPlaybackSpeed(spd) {
    const next = Number(spd);
    if (!Number.isFinite(next) || next <= 0) return;
    speed = next;
    if (displayEl?.player) displayEl.player.tempoScale = speed;
    speedBtns.forEach(b => {
      const match = parseFloat(b.dataset.speed) === speed;
      b.classList.toggle("active", match);
      b.setAttribute("aria-pressed", String(match));
    });
  }

  function getActiveSolution() {
    return currentSolutions[activeSolIdx] || null;
  }

  function buildFullSolString(sol) {
    if (!sol) return "";
    const insp = sol.inspection || sol.insp;
    const prefix = insp && insp !== "none" ? `${insp} ` : "";
    return `${prefix}${sol.moves || ""}`.trim();
  }

  function updateProgress(moveNum, atStart = false, atEnd = false) {
    activeMoveCount = moveNum;
    const origCount = setupMoves.length;
    const total = combinedMoves.length;
    const solTotal = solMoves.length;
    const hasSetup = origCount > 0;

    if (stepCounterEl) {
      if (atEnd || moveNum >= total) {
        stepCounterEl.textContent = solTotal > 0
          ? `Solved! (${solTotal} / ${solTotal} solution moves complete)`
          : "Solved!";
      } else if (moveNum === origCount && hasSetup) {
        stepCounterEl.textContent = `Ready to execute solution (0 / ${solTotal} moves)`;
      } else if (atStart || moveNum === 0) {
        stepCounterEl.textContent = hasSetup
          ? `Start of scramble (0 / ${origCount} scramble moves)`
          : `Ready (0 / ${solTotal} moves)`;
      } else if (moveNum > origCount) {
        const sNum = moveNum - origCount;
        stepCounterEl.textContent = `Solution move ${sNum} of ${solTotal}: ${combinedMoves[moveNum - 1] || ""}`;
      } else {
        stepCounterEl.textContent = `Scramble move ${moveNum} of ${origCount}: ${combinedMoves[moveNum - 1] || ""}`;
      }
    }

    if (moveListEl) {
      const chips = moveListEl.querySelectorAll(".quick-sim-chip");
      chips.forEach((chip) => {
        const idx = Number(chip.dataset.idx);
        chip.classList.toggle("active", moveNum > 0 && idx === moveNum - 1);
        chip.classList.toggle("completed", idx < moveNum - 1);
      });
    }

    if (btnScrambleStart) {
      btnScrambleStart.hidden = !hasSetup;
      btnScrambleStart.disabled = moveNum <= 0;
    }
    if (btnStart) btnStart.disabled = moveNum === origCount && total > 0;
    if (btnPrev) btnPrev.disabled = moveNum <= 0;
    if (btnNext) btnNext.disabled = moveNum >= total;
    if (btnEnd) btnEnd.disabled = moveNum >= total;
    if (!isPlaying) updatePlayingUi(false);
  }

  function updatePlayingUi(playing) {
    isPlaying = Boolean(playing);
    const atEnd = combinedMoves.length > setupMoves.length && activeMoveCount >= combinedMoves.length;
    if (playIconEl) {
      playIconEl.innerHTML = isPlaying ? ICON_PAUSE : (atEnd ? ICON_REPLAY : ICON_PLAY);
    }
    if (playTextEl) playTextEl.textContent = isPlaying ? "Pause" : (atEnd ? "Replay" : "Play");
  }

  async function jumpToMoveCount(moveNum) {
    if (!displayEl?.player) return;
    try {
      displayEl.player.pause();
      if (moveNum <= 0) {
        displayEl.player.controller.jumpToStart({ flash: true });
        updateProgress(0, true, false);
        return;
      }
      if (moveNum >= combinedMoves.length) {
        displayEl.player.controller.jumpToEnd({ flash: true });
        updateProgress(combinedMoves.length, false, true);
        return;
      }
      if (!indexer) indexer = await displayEl.player.experimentalModel.indexer.get();
      const targetIdx = moveNum - 1;
      const endTs = indexer.indexToMoveStartTimestamp(targetIdx) + indexer.moveDuration(targetIdx);
      displayEl.player.experimentalModel.timestampRequest.set(endTs);
      updateProgress(moveNum, false, false);
    } catch {}
  }

  function renderSwitcher() {
    if (!switcherEl) return;
    const count = currentSolutions.length;
    if (count <= 1) {
      switcherEl.hidden = true;
      return;
    }
    switcherEl.hidden = false;
    if (solCounterEl) solCounterEl.textContent = `${activeSolIdx + 1} / ${count}`;
    if (prevSolBtn) prevSolBtn.disabled = activeSolIdx <= 0;
    if (nextSolBtn) nextSolBtn.disabled = activeSolIdx >= count - 1;

    if (solPillsEl) {
      solPillsEl.innerHTML = currentSolutions.map((sol, idx) => {
        const active = idx === activeSolIdx;
        const faceLabel = sol.face ? capitalize(sol.face) : (sol.shortLabel || `#${idx + 1}`);
        const mcText = sol.moveCount != null ? `${sol.moveCount}m` : "";
        const pillText = sol.pillLabel || `${sol.face ? faceLabel : `#${idx + 1}`}${mcText ? ` · ${mcText}` : ""}`;
        return `<button type="button" class="quick-sim-sol-pill ${active ? "active" : ""}" data-sol-idx="${idx}" aria-pressed="${active}">${escapeHtml(pillText)}</button>`;
      }).join("");

      solPillsEl.querySelectorAll(".quick-sim-sol-pill").forEach(btn => {
        btn.addEventListener("click", () => {
          const i = Number(btn.dataset.solIdx);
          if (!Number.isNaN(i)) selectSolution(i);
        });
      });

      const activePill = solPillsEl.querySelector(".quick-sim-sol-pill.active");
      activePill?.scrollIntoView?.({ block: "nearest", inline: "center", behavior: "smooth" });
    }
  }

  function renderHeaderBadges(sol) {
    if (!badgesEl) return;
    if (!sol) {
      badgesEl.innerHTML = "";
      return;
    }
    const parts = [];
    if (sol.face) {
      parts.push(`<span class="face-badge face-badge-${escapeHtml(sol.face)}">${escapeHtml(capitalize(sol.face))}</span>`);
    }
    if (sol.group) {
      parts.push(`<span class="badge badge-subtle">${escapeHtml(sol.group)}</span>`);
    }
    if (sol.ohBadge) {
      parts.push(`<span class="oh-alg-badge">${escapeHtml(sol.ohBadge)}</span>`);
    }
    if (sol.startAuf) {
      parts.push(`<span class="study-auf-badge has-auf">Start: ${escapeHtml(sol.startAuf)}</span>`);
    }
    if (sol.moveCount != null) {
      parts.push(`<span class="badge layer-sol-moves-badge">${sol.moveCount} moves</span>`);
    }
    const insp = sol.inspection || sol.insp;
    if (insp && insp !== "none") {
      parts.push(`<span class="layer-sol-insp-chip">Inspect: <strong>${escapeHtml(insp)}</strong></span>`);
    }
    if (sol.bottomPerm) {
      const cls = sol.bottomPerm === "Layer Solved" ? "badge-solved" : "badge-warning";
      parts.push(`<span class="badge ${cls}">${escapeHtml(sol.bottomPerm)}</span>`);
    }
    if (sol.caseId) {
      parts.push(`<span class="layer-sol-cll-chip">Leaves: <strong>${escapeHtml(sol.caseId)}</strong></span>`);
    }
    if (sol.crossPlus1?.hasPair) {
      parts.push(`<span class="badge chip-cross1">${escapeHtml(sol.crossPlus1.description || `Cross+1: ${sol.crossPlus1.slot}`)}</span>`);
    }
    badgesEl.innerHTML = parts.join("");

    if (noteEl) {
      if (sol.note) {
        noteEl.textContent = sol.note;
        noteEl.hidden = false;
      } else {
        noteEl.textContent = "";
        noteEl.hidden = true;
      }
    }
  }

  function renderTimeline() {
    if (!moveListEl) return;
    if (combinedMoves.length === 0) {
      moveListEl.innerHTML = `<span class="sim-timeline-hint">Already solved at this face (0 moves).</span>`;
      return;
    }

    const origCount = setupMoves.length;
    let html = "";
    if (origCount > 0) {
      html += `<div class="quick-sim-section-label">Setup / Scramble (${origCount} moves):</div>`;
      html += `<div class="quick-sim-chip-row is-setup">`;
      html += setupMoves.map((mv, idx) =>
        `<button type="button" class="quick-sim-chip is-setup" data-idx="${idx}" title="Scramble move ${idx + 1}">${escapeHtml(mv)}</button>`
      ).join("");
      html += `</div>`;
    }

    html += `<div class="quick-sim-section-label is-sol">Solution (${solMoves.length} moves):</div>`;
    html += `<div class="quick-sim-chip-row is-sol">`;
    if (solMoves.length === 0) {
      html += `<span class="sim-timeline-hint">No moves needed.</span>`;
    } else {
      html += solMoves.map((mv, sIdx) => {
        const idx = origCount + sIdx;
        return `<button type="button" class="quick-sim-chip is-solution" data-idx="${idx}" title="Jump to solution move ${sIdx + 1}: ${escapeHtml(mv)}"><span class="chip-num">${sIdx + 1}.</span>${escapeHtml(mv)}</button>`;
      }).join("");
    }
    html += `</div>`;

    moveListEl.innerHTML = html;
    moveListEl.querySelectorAll(".quick-sim-chip").forEach(chip => {
      chip.addEventListener("click", () => {
        const targetCount = Number(chip.dataset.idx) + 1;
        void jumpToMoveCount(targetCount);
      });
    });
  }

  async function mountAndApplyDisplay(puzzle, combinedStr, targetMoveCount) {
    if (!cubeWrap) return;
    const mGen = ++mountGen;
    const lGen = ++loadGen;

    const normEvent = puzzle === "333oh" ? "333" : (puzzle || "222");
    if (!displayEl || mountedPuzzle !== normEvent) {
      cubeWrap.innerHTML = `<div class="quick-sim-loading">Loading 3D cube...</div>`;
      try {
        const SD = await getScrambleDisplay();
        if (!SD || mGen !== mountGen || !isOpen()) return;
        const el = new SD();
        el.event = normEvent;
        el.visualization = "3D";
        el.scramble = combinedStr;
        if (el.player) {
          el.player.hintFacelets = appStore?.state?.showReflection ? "floating" : "none";
          el.player.tempoScale = speed;
        }
        cubeWrap.innerHTML = "";
        cubeWrap.appendChild(el);
        displayEl = el;
        mountedPuzzle = normEvent;
        indexer = null;
        applyColorsTo3DCube(el);
        attachPlayerListeners(el);
      } catch (err) {
        console.warn("QuickSim failed to mount 3D cube:", err);
        return;
      }
    } else {
      try {
        displayEl.player?.pause?.();
        if (displayEl.player) {
          displayEl.player.hintFacelets = appStore?.state?.showReflection ? "floating" : "none";
          displayEl.player.tempoScale = speed;
        }
        displayEl.scramble = combinedStr;
        applyColorsTo3DCube(displayEl);
        indexer = null;
      } catch {}
    }

    if (!displayEl?.player) return;
    pendingSeek = true;
    try {
      const idx = await displayEl.player.experimentalModel.indexer.get();
      if (lGen !== loadGen || !isOpen()) return;
      indexer = idx;
      if (targetMoveCount <= 0) {
        displayEl.player.controller?.jumpToStart?.({ flash: false });
        updateProgress(0, true, combinedMoves.length === 0);
      } else if (targetMoveCount >= combinedMoves.length) {
        displayEl.player.controller?.jumpToEnd?.({ flash: false });
        updateProgress(combinedMoves.length, false, true);
      } else {
        const targetIdx = targetMoveCount - 1;
        const endTs = idx.indexToMoveStartTimestamp(targetIdx) + idx.moveDuration(targetIdx);
        displayEl.player.experimentalModel.timestampRequest.set(endTs);
        updateProgress(targetMoveCount, false, false);
      }
    } catch {} finally {
      if (lGen === loadGen) pendingSeek = false;
    }
  }

  function attachPlayerListeners(el) {
    if (!el?.player?.experimentalModel) return;
    try {
      el.player.experimentalModel.indexer.addFreshListener((idx) => {
        if (displayEl === el) indexer = idx;
      });
      el.player.experimentalModel.detailedTimelineInfo.addFreshListener((info) => {
        if (displayEl !== el || !isOpen() || pendingSeek || !indexer || combinedMoves.length === 0) return;
        try {
          if (info.atStart || info.timestamp <= 0) {
            updateProgress(0, true, false);
            return;
          }
          if (info.atEnd) {
            updateProgress(combinedMoves.length, false, true);
            return;
          }
          const mIdx = indexer.timestampToIndex(info.timestamp);
          updateProgress(mIdx + 1, false, false);
        } catch {}
      });
      el.player.experimentalModel.coarseTimelineInfo.addFreshListener((info) => {
        if (displayEl !== el || !isOpen()) return;
        updatePlayingUi(Boolean(info.playing));
      });
    } catch {}
  }

  function selectSolution(idx) {
    if (idx < 0 || idx >= currentSolutions.length) return;
    activeSolIdx = idx;
    isPlaying = false;
    const sol = getActiveSolution();
    const baseScramble = sol?.scramble != null ? sol.scramble : (currentSolutions._sharedScramble || "");
    const parsedSetup = parseScrambleInput(baseScramble);
    setupMoves = parsedSetup.ok ? parsedSetup.moves : cleanAlg(baseScramble).split(/\s+/).filter(Boolean);

    const solStr = buildFullSolString(sol);
    const parsedSol = parseScrambleInput(solStr);
    solMoves = parsedSol.ok ? parsedSol.moves : cleanAlg(solStr).split(/\s+/).filter(Boolean);

    combinedMoves = [...setupMoves, ...solMoves];
    renderSwitcher();
    renderHeaderBadges(sol);
    renderTimeline();
    updateProgress(setupMoves.length, setupMoves.length === 0, combinedMoves.length === 0);
    void mountAndApplyDisplay(sol?.puzzle || currentPuzzle, combinedMoves.join(" "), setupMoves.length);
  }

  function togglePlay() {
    if (!displayEl?.player?.controller) return;
    const solTotal = solMoves.length;
    if (activeMoveCount >= combinedMoves.length && solTotal > 0) {
      void jumpToMoveCount(setupMoves.length).then(() => {
        setTimeout(() => { try { displayEl?.player?.play?.(); } catch {} }, 40);
      });
      return;
    }
    try { displayEl.player.controller.togglePlay(); } catch {}
  }

  function stepForward() {
    if (!displayEl?.player?.controller) return;
    try {
      displayEl.player.pause();
      displayEl.player.controller.animationController.play({ direction: 1, untilBoundary: "move" });
    } catch {}
  }

  function stepBackward() {
    if (!displayEl?.player?.controller) return;
    try {
      displayEl.player.pause();
      displayEl.player.controller.animationController.play({ direction: -1, untilBoundary: "move" });
    } catch {}
  }

  async function resetCamera() {
    if (!displayEl?.player) return;
    try {
      const p = await displayEl.player.experimentalCurrentThreeJSPuzzleObject?.();
      if (p) {
        p.quaternion.set(0, 0, 0, 1);
        p.rotation.set(0, 0, 0);
        p.scheduleRenderCallback?.();
      }
    } catch {}
    try {
      displayEl.player.cameraLatitude = 35;
      displayEl.player.cameraLongitude = 30;
      displayEl.player.cameraDistance = 6;
    } catch {}
    try {
      displayEl.player.experimentalModel?.twistySceneModel?.orbitCoordinatesRequest?.set?.("auto");
    } catch {}
  }

  function teardown() {
    mountGen++;
    loadGen++;
    pendingSeek = false;
    isPlaying = false;
    try { displayEl?.player?.pause?.(); } catch {}
    if (cubeWrap) cubeWrap.innerHTML = "";
    displayEl = null;
    mountedPuzzle = null;
    indexer = null;
    currentSolutions = [];
    setupMoves = [];
    solMoves = [];
    combinedMoves = [];
    activeMoveCount = 0;
    openFullSimCb = null;
    updatePlayingUi(false);
  }

  function isOpen() {
    return Boolean(modal && !modal.hidden && (modalManager?.isOpen ? modalManager.isOpen(modal) : true));
  }

  function open({ puzzle = "222", scramble = "", solutions = [], activeIndex = 0, title = "3D Solution Simulator", onOpenFullSim = null } = {}) {
    if (!modal || !solutions.length) return;
    currentPuzzle = puzzle || "222";
    currentSolutions = solutions.slice();
    currentSolutions._sharedScramble = scramble || "";
    openFullSimCb = onOpenFullSim;
    activeSolIdx = Math.max(0, Math.min(solutions.length - 1, Number(activeIndex) || 0));

    if (titleEl) titleEl.textContent = title;
    if (fullSimBtn) fullSimBtn.hidden = typeof onOpenFullSim !== "function";

    syncPlaybackSpeed(appStore?.state?.simSpeed ?? speed);
    modalManager.open(modal, {
      initialFocus: btnPlay || closeBtn,
      onClose: teardown
    });
    selectSolution(activeSolIdx);
  }

  function close() {
    if (modal && modalManager) modalManager.close(modal);
  }

  function handleKeyDown(e) {
    if (!isOpen()) return false;
    if (e.code === "Space") { e.preventDefault(); togglePlay(); return true; }
    if (e.key === "ArrowRight") { e.preventDefault(); stepForward(); return true; }
    if (e.key === "ArrowLeft") { e.preventDefault(); stepBackward(); return true; }
    if (e.key === "Home") { e.preventDefault(); void jumpToMoveCount(setupMoves.length); return true; }
    if (e.key === "End") { e.preventDefault(); void jumpToMoveCount(combinedMoves.length); return true; }
    if (e.key === "[" && currentSolutions.length > 1) {
      e.preventDefault();
      if (activeSolIdx > 0) selectSolution(activeSolIdx - 1);
      return true;
    }
    if (e.key === "]" && currentSolutions.length > 1) {
      e.preventDefault();
      if (activeSolIdx < currentSolutions.length - 1) selectSolution(activeSolIdx + 1);
      return true;
    }
    return false;
  }

  // Event listeners
  closeBtn?.addEventListener("click", close);
  dismissBtn?.addEventListener("click", close);
  prevSolBtn?.addEventListener("click", () => { if (activeSolIdx > 0) selectSolution(activeSolIdx - 1); });
  nextSolBtn?.addEventListener("click", () => { if (activeSolIdx < currentSolutions.length - 1) selectSolution(activeSolIdx + 1); });
  resetCamBtn?.addEventListener("click", resetCamera);

  btnScrambleStart?.addEventListener("click", () => void jumpToMoveCount(0));
  btnStart?.addEventListener("click", () => void jumpToMoveCount(setupMoves.length));
  btnPrev?.addEventListener("click", stepBackward);
  btnPlay?.addEventListener("click", togglePlay);
  btnNext?.addEventListener("click", stepForward);
  btnEnd?.addEventListener("click", () => void jumpToMoveCount(combinedMoves.length));

  speedBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const sVal = parseFloat(btn.dataset.speed);
      if (!Number.isNaN(sVal) && sVal > 0) {
        syncPlaybackSpeed(sVal);
        appStore?.setSimSpeed?.(sVal);
      }
    });
  });

  copyBtn?.addEventListener("click", () => {
    const sol = getActiveSolution();
    if (!sol) return;
    const scr = sol.scramble != null ? sol.scramble : (currentSolutions._sharedScramble || "");
    const text = [
      (!sol.face && sol.label) ? `Case: ${sol.label}` : "",
      scr ? `Scramble: ${scr}` : "",
      sol.face ? `Face: ${capitalize(sol.face)}` : "",
      (sol.inspection && sol.inspection !== "none") ? `Inspection: ${sol.inspection}` : "",
      `${sol.face ? "Solution" : "Algorithm"}: ${sol.moves || "(already solved)"}`
    ].filter(Boolean).join("\n");
    void copyTextWithButtonFeedback(text, copyBtn, "Copy Solution");
  });

  fullSimBtn?.addEventListener("click", () => {
    const sol = getActiveSolution();
    const scr = sol?.scramble != null ? sol.scramble : (currentSolutions._sharedScramble || "");
    const cb = openFullSimCb;
    if (!sol || typeof cb !== "function") return;
    const payload = {
      base: scr,
      solMoves: buildFullSolString(sol),
      expectedCase: {
        id: sol.label || `${capitalize(sol.face || "")} (${sol.moveCount ?? solMoves.length}m)`,
        solution: buildFullSolString(sol),
        solutionAlg: buildFullSolString(sol),
        isLayer: true
      }
    };
    const solIdx = activeSolIdx;
    close();
    cb(payload, sol, solIdx);
  });

  return {
    open,
    close,
    isOpen,
    handleKeyDown,
    selectSolution,
    syncPlaybackSpeed
  };
}
