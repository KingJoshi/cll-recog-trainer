// 3D Move-by-Move Algorithm & Scramble Simulator Controller

import { Alg } from 'cubing/alg';
import { getTrack, getPreferredAlg } from '../../data/algRegistry.js';
import { getEffectiveAlgsForCase } from '../../cube/algMirror.js';
import { pblCases, pblCaseById } from '../../data/ortegaData.js';
import { cleanAlg, normalizeAlgForCompare, parseScrambleInput } from '../../algParser.js';
import { applyColorsTo3DCube } from '../../caseVisualizer.js';
import { GROUP_DISPLAY_ORDER, caseById, casesByGroup, isSimulateViewMode, isExperimentalEnabled } from '../../state/appStore.js';
import { escapeHtml } from '../../services/htmlUtils.js';
import { showToast } from '../../ui/toastService.js';
import { ICON_PLAY, ICON_PAUSE, ICON_REPLAY } from '../../ui/transportIcons.js';

export function createSimulatorController({
  appStore,
  cubeStage,
  freeMovesCtrl,
  solverWidgets,
  getNavCtrl = () => null
} = {}) {
  const simScrambleInput = typeof document !== "undefined" ? document.getElementById("simScrambleInput") : null;
  const simClearBtn = typeof document !== "undefined" ? document.getElementById("simClearBtn") : null;
  const simLoadBtn = typeof document !== "undefined" ? document.getElementById("simLoadBtn") : null;
  const simUseCurrentBtn = typeof document !== "undefined" ? document.getElementById("simUseCurrentBtn") : null;
  const simCaseSelect = typeof document !== "undefined" ? document.getElementById("simCaseSelect") : null;
  const simScrambleSelectWrap = typeof document !== "undefined" ? document.getElementById("simScrambleSelectWrap") : null;
  const simScrambleSelect = typeof document !== "undefined" ? document.getElementById("simScrambleSelect") : null;
  const simPresetButtons = typeof document !== "undefined" ? document.getElementById("simPresetButtons") : null;
  const simAppendSolutionBtn = typeof document !== "undefined" ? document.getElementById("simAppendSolutionBtn") : null;
  const simErrorMsg = typeof document !== "undefined" ? document.getElementById("simErrorMsg") : null;
  const simCaseDetails = typeof document !== "undefined" ? document.getElementById("simCaseDetails") : null;
  const simCaseTag = typeof document !== "undefined" ? document.getElementById("simCaseTag") : null;
  const simSolutionTag = typeof document !== "undefined" ? document.getElementById("simSolutionTag") : null;
  const simOrientTag = typeof document !== "undefined" ? document.getElementById("simOrientTag") : null;
  const simStatusBadge = typeof document !== "undefined" ? document.getElementById("simStatusBadge") : null;
  const simBtnStart = typeof document !== "undefined" ? document.getElementById("simBtnStart") : null;
  const simBtnPrev = typeof document !== "undefined" ? document.getElementById("simBtnPrev") : null;
  const simBtnPlay = typeof document !== "undefined" ? document.getElementById("simBtnPlay") : null;
  const simPlayIcon = typeof document !== "undefined" ? document.getElementById("simPlayIcon") : null;
  const simPlayText = typeof document !== "undefined" ? document.getElementById("simPlayText") : null;
  const simBtnNext = typeof document !== "undefined" ? document.getElementById("simBtnNext") : null;
  const simBtnEnd = typeof document !== "undefined" ? document.getElementById("simBtnEnd") : null;
  const simStepCounter = typeof document !== "undefined" ? document.getElementById("simStepCounter") : null;
  const simMoveList = typeof document !== "undefined" ? document.getElementById("simMoveList") : null;
  const simTimelineResetBtn = typeof document !== "undefined" ? document.getElementById("simTimelineResetBtn") : null;
  const simSpeedButtons = typeof document !== "undefined" ? Array.from(document.querySelectorAll(".sim-speed-btn")) : [];

  let simScrambleText = "";
  let simOriginalScramble = "";
  let simMoves = [];
  let simOrientation = "z2";
  let simSpeed = appStore?.state?.simSpeed ?? 1;
  let simActiveIndex = 0;

  function syncPlaybackSpeed(spd) {
    const next = Number(spd);
    if (!Number.isFinite(next) || next <= 0) return;
    simSpeed = next;
    const el = getEl();
    if (el?.player) el.player.tempoScale = simSpeed;
    simSpeedButtons.forEach(b => {
      const match = parseFloat(b.dataset.speed) === simSpeed;
      b.classList.toggle("active", match);
      b.setAttribute("aria-pressed", String(match));
    });
  }
  let simExpectedCaseObj = null;
  let simHasSolutionAppended = false;
  let simListenersEl = null;
  let simInitializedPuzzle = null;
  let simIndexer = null;
  let simPendingStartAtSolution = false;

  function getEl() {
    return cubeStage?.getDisplay?.() || null;
  }

  function getSimOriginalCount() {
    if (!simHasSolutionAppended || !simOriginalScramble) return simMoves.length;
    const parsed = parseScrambleInput(simOriginalScramble);
    return parsed.ok ? parsed.moves.length : simMoves.length;
  }

  function updateSimulateSolutions() {
    if (!isSimulateViewMode(appStore.state)) return;
    const seq = freeMovesCtrl?.getSequence?.() || simOriginalScramble || simScrambleText;
    const puz = appStore.state.currentPuzzle;
    if (puz === "222") solverWidgets?.updateLayerSolutions?.(seq);
    else if (puz === "333" || puz === "333oh") solverWidgets?.updateCrossSolutions?.(seq);
  }

  function findCaseByScrambleMoves(moves) {
    let startIdx = 0;
    while (startIdx < moves.length && /^[xyz]/i.test(moves[startIdx])) startIdx++;
    const caseMovesOnly = moves.slice(startIdx).join(" ");
    const allMoves = moves.join(" ");
    const normCaseMoves = normalizeAlgForCompare(caseMovesOnly);
    const normAllMoves = normalizeAlgForCompare(allMoves);

    const { currentPuzzle, currentTrackId } = appStore.state;
    const curTrack = getTrack(currentPuzzle, currentTrackId);
    const tracksToSearch = [];
    if (curTrack) tracksToSearch.push(curTrack);
    if (currentPuzzle === "444") {
      const p4 = getTrack("444", "parity");
      if (p4 && p4 !== curTrack) tracksToSearch.push(p4);
    } else if (currentPuzzle === "555") {
      const p5 = getTrack("555", "parity");
      if (p5 && p5 !== curTrack) tracksToSearch.push(p5);
    }

    for (const tr of tracksToSearch) {
      if (!tr?.cases) continue;
      for (const caseObj of tr.cases) {
        const list = caseObj.scrambles?.length ? caseObj.scrambles : [caseObj.setup || caseObj.scramble];
        for (const sc of list) {
          if (!sc) continue;
          const normSc = normalizeAlgForCompare(sc);
          if (normSc === normCaseMoves || normSc === normAllMoves || sc.trim() === caseMovesOnly || sc.trim() === allMoves) {
            return {
              id: caseObj.id,
              displayName: `${tr.shortName || tr.name}: ${caseObj.shortName || caseObj.name}`,
              name: caseObj.name,
              shortName: caseObj.shortName,
              scrambles: caseObj.scrambles || [caseObj.setup || caseObj.scramble],
              scramble: caseObj.setup || caseObj.scramble,
              solution: caseObj.algs ? (caseObj.algs[0]?.label || caseObj.algs[0]?.alg) : (caseObj.alg || ""),
              solutionAlg: caseObj.algs ? (caseObj.algs[0]?.alg || "") : (caseObj.alg || "")
            };
          }
        }
      }
    }

    for (const caseObj of caseById.values()) {
      const list = caseObj.scrambles?.length ? caseObj.scrambles : [caseObj.scramble];
      for (const sc of list) {
        const normSc = normalizeAlgForCompare(sc);
        if (normSc === normCaseMoves || normSc === normAllMoves || sc.trim() === caseMovesOnly || sc.trim() === allMoves) {
          return caseObj;
        }
      }
    }

    for (const pCase of pblCases) {
      for (let i = 0; i < pCase.algs.length; i++) {
        const a = pCase.algs[i];
        let inv = "";
        try { inv = new Alg(cleanAlg(a.alg)).invert().toString(); } catch {}
        const normInv = normalizeAlgForCompare(inv);
        if (normInv && (normInv === normCaseMoves || normInv === normAllMoves)) {
          const activeLabel = appStore.getPblAlgDisplayLabel(pCase.id, a) || a.label || a.alg;
          return {
            id: `PBL: ${pCase.id}`,
            displayName: `PBL: ${pCase.shortName || pCase.name}`,
            name: pCase.name,
            shortName: pCase.shortName,
            isPbl: true,
            pblCaseId: pCase.id,
            caseObj: pCase,
            activeAlgIndex: i,
            solution: activeLabel,
            solutionAlg: a.alg,
            scramble: inv,
            algs: pCase.algs
          };
        }
      }
    }
    return null;
  }

  function updateSimProgress(currentMoveNumber, atStart, atEnd) {
    simActiveIndex = currentMoveNumber;
    const total = simMoves.length;
    const chips = simMoveList ? simMoveList.querySelectorAll(".sim-move-chip") : [];
    const origCount = getSimOriginalCount();
    const hasSolution = simHasSolutionAppended && origCount > 0 && origCount < total;
    const solCount = total - origCount;

    if (atStart || currentMoveNumber === 0) {
      if (simStepCounter) {
        simStepCounter.textContent = hasSolution ? `At start of scramble (0 / ${origCount})` : `At start (0 / ${total})`;
      }
      chips.forEach(chip => chip.classList.remove("active", "completed"));
      if (simBtnStart) simBtnStart.disabled = true;
      if (simBtnPrev) simBtnPrev.disabled = true;
      if (simTimelineResetBtn) {
        simTimelineResetBtn.disabled = false;
        simTimelineResetBtn.dataset.tooltip = hasSolution ? "Jump to Case State" : "Reset to beginning";
      }
      if (simBtnNext) simBtnNext.disabled = total === 0;
      if (simBtnEnd) simBtnEnd.disabled = total === 0;
      return;
    }

    if (atEnd || currentMoveNumber >= total) {
      if (simStepCounter) {
        simStepCounter.textContent = hasSolution ? `Solved! (All ${solCount} solution moves complete)` : `At end (${total} / ${total})`;
      }
      chips.forEach(chip => { chip.classList.add("completed"); chip.classList.remove("active"); });
      if (simBtnStart) simBtnStart.disabled = false;
      if (simBtnPrev) simBtnPrev.disabled = false;
      if (simTimelineResetBtn) {
        simTimelineResetBtn.disabled = false;
        simTimelineResetBtn.dataset.tooltip = hasSolution ? "Reset to Case State" : "Reset to beginning";
      }
      if (simBtnNext) simBtnNext.disabled = true;
      if (simBtnEnd) simBtnEnd.disabled = true;
      return;
    }

    if (hasSolution && currentMoveNumber === origCount) {
      if (simStepCounter) simStepCounter.textContent = `Case ready (Scramble complete · Solution next: ${solCount} moves)`;
      chips.forEach((chip, i) => {
        chip.classList.toggle("completed", i < origCount);
        chip.classList.remove("active");
      });
      chips[origCount]?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
      if (simBtnStart) simBtnStart.disabled = false;
      if (simBtnPrev) simBtnPrev.disabled = false;
      if (simTimelineResetBtn) { simTimelineResetBtn.disabled = false; simTimelineResetBtn.dataset.tooltip = "Reset to start of scramble"; }
      if (simBtnNext) simBtnNext.disabled = false;
      if (simBtnEnd) simBtnEnd.disabled = false;
      return;
    }

    const activeIndex = currentMoveNumber - 1;
    if (simStepCounter) {
      if (hasSolution) {
        simStepCounter.textContent = currentMoveNumber > origCount
          ? `Solution move ${currentMoveNumber - origCount} of ${solCount}: ${simMoves[activeIndex] || ""}`
          : `Scramble move ${currentMoveNumber} of ${origCount}: ${simMoves[activeIndex] || ""}`;
      } else {
        simStepCounter.textContent = `Move ${currentMoveNumber} of ${total}: ${simMoves[activeIndex] || ""}`;
      }
    }
    if (simTimelineResetBtn) simTimelineResetBtn.dataset.tooltip = hasSolution ? "Reset to Case State" : "Reset to beginning";

    chips.forEach((chip, i) => {
      chip.classList.toggle("active", i === activeIndex);
      chip.classList.toggle("completed", i < activeIndex);
    });
    chips[activeIndex]?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });

    if (simBtnStart) simBtnStart.disabled = false;
    if (simBtnPrev) simBtnPrev.disabled = false;
    if (simTimelineResetBtn) simTimelineResetBtn.disabled = false;
    if (simBtnNext) simBtnNext.disabled = false;
    if (simBtnEnd) simBtnEnd.disabled = false;
  }

  function updateSimPlayingState(playing, atStart, atEnd) {
    const origCount = getSimOriginalCount();
    const hasSolution = simHasSolutionAppended && origCount > 0 && origCount < simMoves.length;
    const solCount = simMoves.length - origCount;

    if (playing) {
      if (simPlayIcon) simPlayIcon.innerHTML = ICON_PAUSE;
      if (simPlayText) simPlayText.textContent = "Pause";
      if (simStatusBadge) {
        simStatusBadge.textContent = hasSolution ? "Playing Solution" : "Playing";
        simStatusBadge.className = "sim-badge playing";
      }
      return;
    }

    if (simPlayIcon) simPlayIcon.innerHTML = atEnd ? ICON_REPLAY : ICON_PLAY;
    if (simPlayText) simPlayText.textContent = atEnd ? "Replay" : "Play";
    if (simStatusBadge) {
      if (atEnd) simStatusBadge.textContent = hasSolution ? "Solved" : "Complete";
      else if (hasSolution) {
        if (simActiveIndex === origCount) simStatusBadge.textContent = `Case Ready (${solCount} sol moves)`;
        else if (simActiveIndex > origCount) simStatusBadge.textContent = `Solution (${simActiveIndex - origCount}/${solCount})`;
        else simStatusBadge.textContent = `Scramble (${simActiveIndex}/${origCount})`;
      } else {
        simStatusBadge.textContent = `${simMoves.length} moves`;
      }
      simStatusBadge.className = "sim-badge";
    }
  }

  function renderSimPresetButtons(caseObj, activeIndex = null) {
    if (!simPresetButtons) return;
    simPresetButtons.innerHTML = "";
    if (!caseObj) {
      if (simScrambleSelectWrap) simScrambleSelectWrap.hidden = true;
      return;
    }

    if (caseObj.isPbl) {
      const algs = caseObj.algs || [];
      const matchedIdx = activeIndex !== null ? activeIndex : (caseObj.activeAlgIndex ?? 0);
      algs.forEach((algOption, idx) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `btn btn-small sim-preset-btn ${idx === matchedIdx ? "active" : ""}`;
        btn.textContent = `Alg ${idx + 1}`;
        const algLabel = appStore.getPblAlgDisplayLabel(caseObj.pblCaseId || caseObj.id, algOption);
        btn.title = `Simulate Alg ${idx + 1}: ${algLabel}`;
        btn.addEventListener("click", () => simLoadPblCase(caseObj.caseObj || caseObj, idx));
        simPresetButtons.appendChild(btn);
      });
      if (simScrambleSelect) {
        simScrambleSelect.innerHTML = algs.map((a, idx) =>
          `<option value="${idx}">Alg ${idx + 1}: ${escapeHtml(appStore.getPblAlgDisplayLabel(caseObj.pblCaseId || caseObj.id, a))}</option>`
        ).join("");
        simScrambleSelect.value = String(matchedIdx);
        if (simScrambleSelectWrap) simScrambleSelectWrap.hidden = false;
      }
      return;
    }

    const scrambles = Array.isArray(caseObj.scrambles) && caseObj.scrambles.length > 0
      ? caseObj.scrambles
      : (caseObj.scramble ? [caseObj.scramble] : []);
    if (scrambles.length === 0) {
      if (simScrambleSelectWrap) simScrambleSelectWrap.hidden = true;
      return;
    }

    let matchedIdx = activeIndex;
    if (matchedIdx === null) {
      const origCount = getSimOriginalCount();
      const strippedMoves = simMoves.slice(0, origCount).filter(m => !/^[xyz]/i.test(m)).join(" ");
      const normStripped = normalizeAlgForCompare(strippedMoves);
      matchedIdx = scrambles.findIndex(s => s && (normalizeAlgForCompare(s) === normStripped || s.trim() === strippedMoves));
      if (matchedIdx === -1) matchedIdx = 0;
    }

    scrambles.forEach((sc, idx) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `btn btn-small sim-preset-btn ${idx === matchedIdx ? "active" : ""}`;
      btn.textContent = `Scramble ${idx + 1}`;
      btn.title = `Load preset scramble ${idx + 1}: ${sc}`;
      btn.addEventListener("click", () => simLoadCaseWithSolution(caseObj, idx));
      simPresetButtons.appendChild(btn);
    });

    if (simScrambleSelect) {
      simScrambleSelect.innerHTML = scrambles.map((sc, idx) =>
        `<option value="${idx}">Scramble ${idx + 1}: ${escapeHtml(sc)}</option>`
      ).join("");
      simScrambleSelect.value = String(matchedIdx);
      if (simScrambleSelectWrap) simScrambleSelectWrap.hidden = false;
    }
  }

  function renderSimTimeline(isAppended = false) {
    if (!simMoveList) return;
    simMoveList.innerHTML = "";
    if (simMoves.length === 0) {
      simMoveList.innerHTML = `<span class="sim-timeline-hint">No moves loaded.</span>`;
      return;
    }

    const hasSolution = isAppended || simHasSolutionAppended;
    const originalCount = hasSolution ? getSimOriginalCount() : simMoves.length;
    const total = simMoves.length;
    const solCount = total - originalCount;

    if (hasSolution && originalCount > 0 && solCount > 0) {
      const scDiv = document.createElement("div");
      scDiv.className = "sim-timeline-divider";
      const scBadge = document.createElement("button");
      scBadge.type = "button";
      scBadge.className = "sim-divider-badge sim-divider-scramble";
      scBadge.title = "Jump to start of scramble";
      scBadge.innerHTML = `<span>Scramble (${originalCount} moves)</span>`;
      scBadge.addEventListener("click", () => {
        const el = getEl();
        try { el?.player?.pause(); el?.player?.controller?.jumpToStart({ flash: true }); updateSimProgress(0, true, false); } catch {}
      });
      scDiv.appendChild(scBadge);
      simMoveList.appendChild(scDiv);
    }

    simMoves.forEach((move, i) => {
      if (hasSolution && i === originalCount && solCount > 0) {
        const solDiv = document.createElement("div");
        solDiv.className = "sim-timeline-divider";
        const solBadge = document.createElement("button");
        solBadge.type = "button";
        solBadge.className = "sim-divider-badge";
        solBadge.title = "Reset cube to Case State";
        solBadge.innerHTML = `<span>Solution (${solCount} moves)</span>`;
        solBadge.addEventListener("click", () => void simJumpToCaseState());
        solDiv.appendChild(solBadge);
        simMoveList.appendChild(solDiv);
      }

      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "sim-move-chip";
      const isSol = hasSolution && i >= originalCount;
      const safeMove = escapeHtml(move);
      if (isSol) {
        chip.classList.add("is-solution");
        const solIdx = i - originalCount + 1;
        chip.innerHTML = `<span class="chip-num">S${solIdx}.</span> <span>${safeMove}</span>`;
        chip.title = `Jump to solution move ${solIdx} (${move})`;
      } else {
        chip.innerHTML = `<span class="chip-num">${i + 1}.</span> <span>${safeMove}</span>`;
        chip.title = `Jump to scramble move ${i + 1} (${move})`;
      }
      chip.dataset.index = i;
      chip.addEventListener("click", () => void simJumpToIndex(i));
      simMoveList.appendChild(chip);
    });
  }

  function simEnsureScrambleSynced() {
    if (freeMovesCtrl?.getUserMoves?.().length > 0) {
      freeMovesCtrl.setBaseScramble(simOriginalScramble || simScrambleText);
      const el = getEl();
      if (el) {
        el.scramble = simMoves.join(" ");
        cubeStage?.applyReflection?.();
        applyColorsTo3DCube(el);
      }
    }
  }

  async function simJumpToCaseState() {
    const el = getEl();
    if (!el?.player) return;
    simEnsureScrambleSynced();
    try {
      el.player.pause();
      const origCount = getSimOriginalCount();
      if (origCount <= 0) { simJumpToStart(); return; }
      if (!simIndexer) simIndexer = await el.player.experimentalModel.indexer.get();
      const targetIdx = origCount - 1;
      const endTimestamp = simIndexer.indexToMoveStartTimestamp(targetIdx) + simIndexer.moveDuration(targetIdx);
      el.player.experimentalModel.timestampRequest.set(endTimestamp);
      updateSimProgress(origCount, false, false);
    } catch {}
  }

  function simJumpToStart() {
    const el = getEl();
    if (!el?.player?.controller) return;
    simEnsureScrambleSynced();
    const origCount = getSimOriginalCount();
    const hasSolution = simHasSolutionAppended && origCount > 0 && origCount < simMoves.length;
    if (hasSolution) {
      if (simActiveIndex > origCount || simActiveIndex === 0) { void simJumpToCaseState(); return; }
    }
    try {
      el.player.pause();
      el.player.controller.jumpToStart({ flash: true });
      updateSimProgress(0, true, false);
    } catch {}
  }

  function simJumpToEnd() {
    const el = getEl();
    if (!el?.player?.controller) return;
    simEnsureScrambleSynced();
    try {
      el.player.pause();
      el.player.controller.jumpToEnd({ flash: true });
      updateSimProgress(simMoves.length, false, true);
    } catch {}
  }

  function simStepForward() {
    const el = getEl();
    if (!el?.player?.controller) return;
    simEnsureScrambleSynced();
    try { el.player.pause(); el.player.controller.animationController.play({ direction: 1, untilBoundary: "move" }); } catch {}
  }

  function simStepBackward() {
    const el = getEl();
    if (!el?.player?.controller) return;
    simEnsureScrambleSynced();
    try { el.player.pause(); el.player.controller.animationController.play({ direction: -1, untilBoundary: "move" }); } catch {}
  }

  function simTogglePlay() {
    const el = getEl();
    if (!el?.player?.controller) return;
    simEnsureScrambleSynced();
    const origCount = getSimOriginalCount();
    const hasSolution = simHasSolutionAppended && origCount > 0 && origCount < simMoves.length;
    if (hasSolution && simActiveIndex >= simMoves.length) {
      simJumpToCaseState().then(() => { setTimeout(() => { try { el.player?.play?.(); } catch {} }, 50); });
      return;
    }
    try { el.player.controller.togglePlay(); } catch {}
  }

  async function simJumpToIndex(targetIndex) {
    const el = getEl();
    if (!el?.player) return;
    simEnsureScrambleSynced();
    try {
      el.player.pause();
      if (!simIndexer) simIndexer = await el.player.experimentalModel.indexer.get();
      if (targetIndex < 0) { simJumpToStart(); return; }
      if (targetIndex >= simMoves.length) { simJumpToEnd(); return; }
      const endTimestamp = simIndexer.indexToMoveStartTimestamp(targetIndex) + simIndexer.moveDuration(targetIndex);
      el.player.experimentalModel.timestampRequest.set(endTimestamp);
      updateSimProgress(targetIndex + 1, false, targetIndex + 1 >= simMoves.length);
    } catch {}
  }

  function simLoadScramble(raw, { expectedCase = null, isAppended = false, activePresetIndex = null, startAtSolution = false, originalScramble = null } = {}) {
    const parsed = parseScrambleInput(raw);
    if (!parsed.ok) {
      if (simErrorMsg) { simErrorMsg.textContent = parsed.error; simErrorMsg.hidden = false; }
      if (simStatusBadge) { simStatusBadge.textContent = "Error"; simStatusBadge.className = "sim-badge"; }
      return false;
    }
    if (simErrorMsg) simErrorMsg.hidden = true;
    simScrambleText = raw;

    if (!isAppended) {
      simOriginalScramble = raw;
      simHasSolutionAppended = false;
      if (simAppendSolutionBtn) {
        simAppendSolutionBtn.textContent = "Append Solution";
        simAppendSolutionBtn.classList.remove("active");
      }
    } else {
      simHasSolutionAppended = true;
      if (originalScramble) simOriginalScramble = originalScramble;
      if (simAppendSolutionBtn) {
        simAppendSolutionBtn.textContent = "Remove Solution";
        simAppendSolutionBtn.classList.add("active");
      }
    }

    const origBase = (isAppended || simHasSolutionAppended) ? (originalScramble || simOriginalScramble) : raw;
    cubeStage?.setBaseDisplayScramble?.(origBase);
    freeMovesCtrl?.setBaseScramble?.(origBase);

    simMoves = parsed.moves;
    simOrientation = parsed.orientation;
    simExpectedCaseObj = expectedCase || findCaseByScrambleMoves(simMoves);

    if (simExpectedCaseObj) {
      if (simCaseTag) simCaseTag.textContent = `Case: ${simExpectedCaseObj.displayName || simExpectedCaseObj.id}`;
      if (simSolutionTag) simSolutionTag.innerHTML = `<strong>Solution:</strong> ${escapeHtml(simExpectedCaseObj.solution || "None")}`;
      if (simOrientTag) simOrientTag.textContent = simOrientation ? `Orientation: ${simOrientation}` : "Standard Orientation";
      if (simCaseDetails) simCaseDetails.hidden = false;
      if (simAppendSolutionBtn) simAppendSolutionBtn.disabled = !(simExpectedCaseObj.solutionAlg || simExpectedCaseObj.solution);
      if (simCaseSelect && simCaseSelect.value !== simExpectedCaseObj.id) {
        const opt = Array.from(simCaseSelect.options).find(o => o.value === simExpectedCaseObj.id || o.value.endsWith(`:${simExpectedCaseObj.id}`));
        simCaseSelect.value = opt ? opt.value : simExpectedCaseObj.id;
      }
      renderSimPresetButtons(simExpectedCaseObj, activePresetIndex);
    } else {
      if (simCaseDetails) simCaseDetails.hidden = true;
      if (simAppendSolutionBtn) simAppendSolutionBtn.disabled = true;
      if (simScrambleSelectWrap) simScrambleSelectWrap.hidden = true;
    }

    updateSimulateSolutions();

    const origCount = getSimOriginalCount();
    const shouldStartAtSolution = startAtSolution && origCount > 0 && origCount < simMoves.length;
    const el = getEl();

    if (el?.player) {
      try {
        el.player.pause();
        el.player.tempoScale = simSpeed;
        el.player.experimentalSetupAlg = "";
        el.scramble = simMoves.join(" ");
        cubeStage?.applyReflection?.();
        if (shouldStartAtSolution) {
          simPendingStartAtSolution = true;
          el.player.experimentalModel.indexer.get().then(idx => {
            simIndexer = idx;
            const targetIdx = origCount - 1;
            const endTimestamp = idx.indexToMoveStartTimestamp(targetIdx) + idx.moveDuration(targetIdx);
            el.player.experimentalModel.timestampRequest.set(endTimestamp);
            simPendingStartAtSolution = false;
            updateSimProgress(origCount, false, false);
          }).catch(() => { simPendingStartAtSolution = false; });
        } else {
          simPendingStartAtSolution = false;
          el.player.controller.jumpToStart({ flash: true });
          el.player.experimentalModel.indexer.get().then(idx => { simIndexer = idx; }).catch(() => {});
        }
      } catch {}
    }

    simActiveIndex = shouldStartAtSolution ? origCount : 0;
    renderSimTimeline(isAppended);
    updateSimProgress(shouldStartAtSolution ? origCount : 0, !shouldStartAtSolution, false);
    return true;
  }

  function simLoadCaseWithSolution(caseObj, presetIndex = 0) {
    if (!caseObj) return;
    const scrambles = caseObj.scrambles?.length ? caseObj.scrambles : [caseObj.scramble];
    const chosenScramble = scrambles[presetIndex] || scrambles[0];
    const cleanScr = cleanAlg(chosenScramble);
    const orientation = (appStore.state.alwaysWhiteBottom && !/^z2\b/i.test(cleanScr)) ? "z2" : "";
    const baseScramble = `${orientation ? orientation + " " : ""}${cleanScr}`.trim();
    const sol = caseObj.solutionAlg || caseObj.solution || "";
    const cleanSol = sol ? cleanAlg(sol) : "";

    if (cleanSol) {
      const combined = `${baseScramble} ${cleanSol}`.trim();
      if (simScrambleInput) simScrambleInput.value = combined;
      simOriginalScramble = baseScramble;
      simHasSolutionAppended = true;
      simLoadScramble(combined, {
        expectedCase: caseObj,
        isAppended: true,
        activePresetIndex: presetIndex,
        startAtSolution: true,
        originalScramble: baseScramble
      });
    } else {
      if (simScrambleInput) simScrambleInput.value = baseScramble;
      simOriginalScramble = baseScramble;
      simHasSolutionAppended = false;
      simLoadScramble(baseScramble, {
        expectedCase: caseObj,
        isAppended: false,
        activePresetIndex: presetIndex,
        startAtSolution: false,
        originalScramble: baseScramble
      });
    }
  }

  function simLoadPblCase(caseObj, algIndex = null) {
    if (typeof caseObj === "string") {
      caseObj = pblCaseById.get(caseObj.replace(/^PBL:\s*/i, "").trim());
    }
    if (!caseObj) return;
    const activeAlg = (algIndex !== null && caseObj.algs?.[algIndex])
      ? caseObj.algs[algIndex]
      : appStore.getPblCaseSelectedAlg(caseObj);
    const resolvedIdx = caseObj.algs ? caseObj.algs.findIndex(a => a.id === activeAlg.id) : 0;
    const activeLabel = appStore.getPblAlgDisplayLabel(caseObj.id, activeAlg);

    let invScramble = "";
    try { invScramble = new Alg(cleanAlg(activeAlg.alg)).invert().toString(); } catch { invScramble = activeAlg.alg; }
    const sol = cleanAlg(activeAlg.alg);
    const combined = `${invScramble} ${sol}`.trim();

    if (!isSimulateViewMode(appStore.state)) {
      getNavCtrl()?.setMode?.("simulate", { skipSimInit: true });
    }
    if (simScrambleInput) simScrambleInput.value = combined;

    const expectedCase = {
      id: `PBL: ${caseObj.id}`,
      displayName: `PBL: ${caseObj.shortName || caseObj.name}`,
      name: caseObj.name,
      shortName: caseObj.shortName,
      isPbl: true,
      pblCaseId: caseObj.id,
      caseObj,
      activeAlgIndex: resolvedIdx >= 0 ? resolvedIdx : 0,
      solution: activeLabel,
      solutionAlg: sol,
      scramble: invScramble,
      scrambles: (caseObj.algs || []).map(a => {
        try { return new Alg(cleanAlg(a.alg)).invert().toString(); } catch { return a.alg; }
      }),
      algs: caseObj.algs || []
    };

    simLoadScramble(combined, {
      expectedCase,
      isAppended: true,
      activePresetIndex: resolvedIdx >= 0 ? resolvedIdx : 0,
      startAtSolution: true,
      originalScramble: invScramble
    });
  }

  function wrapTrackCaseForSim(tr, caseObj, puzOverride = null) {
    if (!caseObj) return null;
    const puz = puzOverride || appStore.state.currentPuzzle;
    const ohHand = appStore.state.ohHand || "left";
    const ohTableAbuse = appStore.state.ohTableAbuse !== false;
    const subScope = puz === "333oh" ? (ohTableAbuse ? ohHand : `${ohHand}:no-table`) : null;
    const algs = caseObj.algs
      ? getEffectiveAlgsForCase(puz, tr?.id, caseObj, { ohHand, ohTableAbuse, trackCases: tr?.cases || [] })
      : null;
    const defaultAlg = algs ? (algs.find(a => a.isDefault) || algs[0]) : null;
    const prefId = algs ? getPreferredAlg(caseObj.id, defaultAlg?.id, puz, subScope) : null;
    const chosenAlg = algs ? (algs.find(a => a.id === prefId) || defaultAlg) : null;
    const prefix = tr ? `${tr.shortName || tr.name}: ` : "";
    const rawSetup = chosenAlg?.mirroredSetup || caseObj.setup || caseObj.scramble || "";
    const setupWithAuf = `${rawSetup}${chosenAlg?.startAuf ? ' ' + chosenAlg.startAuf : ''}`.trim();
    const scrList = caseObj.scrambles?.length && !chosenAlg?.isSynthesizedRh && !chosenAlg?.isSynthesizedNoTable
      ? caseObj.scrambles.map(s => chosenAlg?.startAuf ? `${s} ${chosenAlg.startAuf}` : s)
      : [setupWithAuf];
    return {
      id: caseObj.id,
      displayName: `${prefix}${caseObj.shortName || caseObj.name}`,
      name: caseObj.name,
      shortName: caseObj.shortName,
      scrambles: scrList,
      scramble: setupWithAuf,
      solution: chosenAlg ? (chosenAlg.note || chosenAlg.label || chosenAlg.alg) : (caseObj.alg || ""),
      solutionAlg: chosenAlg ? (chosenAlg.alg || "") : (caseObj.alg || "")
    };
  }

  function populateSimCaseSelect() {
    if (!simCaseSelect) return;
    simCaseSelect.innerHTML = `<option value="">Load a case to simulate...</option>`;
    const puz = appStore.state.currentPuzzle;

    if (puz === "444" || puz === "555") {
      const parityTrack = getTrack(puz, "parity");
      if (parityTrack) {
        const g = document.createElement("optgroup");
        g.label = puz === "444" ? "4x4 Parity" : "5x5 Parity & L2E";
        parityTrack.cases.forEach(c => {
          const opt = document.createElement("option");
          opt.value = `${puz}:parity:${c.id}`;
          opt.textContent = `${c.name}: ${c.alg}`;
          g.appendChild(opt);
        });
        simCaseSelect.appendChild(g);
      }
      return;
    }

    if (puz === "333" || puz === "333oh") {
      const ohHand = appStore.state.ohHand || "left";
      const ohTableAbuse = appStore.state.ohTableAbuse !== false;
      [["f2l", "F2L (41 cases)"],
       ["oll", "OLL (57 cases)"],
       ["pll", "PLL (21 cases)"],
       ["coll", "COLL (40 cases)"],
       ["cmll", "CMLL (42 cases)"],
       ["wv", "Winter Variation (27 cases)"]].forEach(([tid, label]) => {
        const tr = getTrack(puz, tid) || getTrack("333", tid);
        if (!tr) return;
        const g = document.createElement("optgroup");
        g.label = label;
        tr.cases.forEach(c => {
          const eff = getEffectiveAlgsForCase(puz, tid, c, { ohHand, ohTableAbuse, trackCases: tr.cases });
          const primary = eff[0]?.alg || c.algs?.[0]?.alg || "";
          const opt = document.createElement("option");
          opt.value = `${puz}:${tid}:${c.id}`;
          opt.textContent = `${c.id}${tid === 'pll' ? ` (${c.name})` : ` (${c.group})`}: ${primary}`;
          g.appendChild(opt);
        });
        simCaseSelect.appendChild(g);
      });
      return;
    }

    const lblTrack = getTrack("222", "lbl");
    if (lblTrack) {
      const lblGroup = document.createElement("optgroup");
      lblGroup.label = "Beginner LBL (7 OLL + 2 PLL)";
      lblTrack.cases.forEach(c => {
        const opt = document.createElement("option");
        opt.value = `222:lbl:${c.id}`;
        opt.textContent = `${c.shortName || c.name}: ${c.algs?.[0]?.alg || ""}`;
        lblGroup.appendChild(opt);
      });
      simCaseSelect.appendChild(lblGroup);
    }

    const ortegaTrack = getTrack("222", "ortega");
    if (ortegaTrack) {
      const ollGroup = document.createElement("optgroup");
      ollGroup.label = "Ortega OLL (7 cases)";
      ortegaTrack.cases
        .filter(c => c.group && c.group.startsWith("OLL"))
        .forEach(c => {
          const opt = document.createElement("option");
          opt.value = `222:ortega:${c.id}`;
          opt.textContent = `${c.name}: ${c.algs?.[0]?.alg || ""}`;
          ollGroup.appendChild(opt);
        });
      simCaseSelect.appendChild(ollGroup);
    }

    const pblGroup = document.createElement("optgroup");
    pblGroup.label = "Ortega PBL (5 cases)";
    pblCases.forEach(pCase => {
      const opt = document.createElement("option");
      opt.value = `PBL: ${pCase.id}`;
      opt.textContent = `PBL: ${pCase.shortName || pCase.name}`;
      pblGroup.appendChild(opt);
    });
    simCaseSelect.appendChild(pblGroup);

    GROUP_DISPLAY_ORDER.forEach(group => {
      const optgroup = document.createElement("optgroup");
      optgroup.label = `CLL Group ${group}`;
      casesByGroup[group].forEach(c => {
        const opt = document.createElement("option");
        opt.value = c.id;
        opt.textContent = `${c.id}: ${c.solution || ""}`;
        optgroup.appendChild(opt);
      });
      simCaseSelect.appendChild(optgroup);
    });

    ["eg1", "eg2"].forEach(egTid => {
      if (!isExperimentalEnabled(appStore?.state, egTid)) return;
      const egTr = getTrack("222", egTid);
      if (!egTr) return;
      const g = document.createElement("optgroup");
      g.label = `${egTid.toUpperCase()} β (40 cases)`;
      egTr.cases.forEach(c => {
        const opt = document.createElement("option");
        opt.value = `222:${egTid}:${c.id}`;
        opt.textContent = `${c.id}: ${c.algs?.[0]?.alg || ""}`;
        g.appendChild(opt);
      });
      simCaseSelect.appendChild(g);
    });
  }

  function attachSimPlayerListeners() {
    const el = getEl();
    if (!el?.player || simListenersEl === el) return;
    simListenersEl = el;
    try {
      el.player.experimentalModel.indexer.addFreshListener((indexer) => { simIndexer = indexer; });
      el.player.experimentalModel.detailedTimelineInfo.addFreshListener((info) => {
        if (!isSimulateViewMode(appStore.state) || simMoves.length === 0 || simPendingStartAtSolution || !simIndexer) return;
        if (freeMovesCtrl?.getUserMoves?.().length > 0) return;
        try {
          if (info.atStart || info.timestamp <= 0) { updateSimProgress(0, true, false); return; }
          if (info.atEnd) { updateSimProgress(simMoves.length, false, true); return; }
          const moveIdx = simIndexer.timestampToIndex(info.timestamp);
          updateSimProgress(moveIdx + 1, false, false);
        } catch {}
      });
      el.player.experimentalModel.coarseTimelineInfo.addFreshListener((info) => {
        if (!isSimulateViewMode(appStore.state)) return;
        if (freeMovesCtrl?.getUserMoves?.().length > 0) return;
        updateSimPlayingState(info.playing, info.atStart, info.atEnd);
      });
    } catch {}
  }

  function simInit() {
    const s = appStore.state;
    const puzzleChanged = simInitializedPuzzle !== null && simInitializedPuzzle !== s.currentPuzzle;
    simInitializedPuzzle = s.currentPuzzle;
    populateSimCaseSelect();
    attachSimPlayerListeners();
    syncPlaybackSpeed(appStore?.state?.simSpeed ?? simSpeed);
    if (puzzleChanged) {
      simMoves = [];
      simScrambleText = "";
      simOriginalScramble = "";
      simExpectedCaseObj = null;
      simHasSolutionAppended = false;
      if (simScrambleInput) simScrambleInput.value = "";
    }
    if (!puzzleChanged && simMoves.length > 0 && simExpectedCaseObj && simHasSolutionAppended) return;

    const track = getTrack(s.currentPuzzle, s.currentTrackId);
    if (s.currentCaseId) {
      const c = track?.caseById?.get(s.currentCaseId) || caseById.get(s.currentCaseId);
      if (c) {
        const wrapped = (s.currentPuzzle === "222" && s.currentTrackId === "cll" && caseById.has(c.id))
          ? caseById.get(c.id)
          : wrapTrackCaseForSim(track, c);
        simLoadCaseWithSolution(wrapped, 0);
        return;
      }
    }
    const candidate = simScrambleInput?.value.trim() || "";
    if (candidate) { simLoadScramble(candidate); return; }
    const fallbackCase = track?.cases?.[0]
      ? wrapTrackCaseForSim(track, track.cases[0])
      : (s.currentPuzzle === "222" ? caseById.get("T1") : null);
    if (fallbackCase) {
      simLoadCaseWithSolution(fallbackCase, 0);
    } else {
      const defaultAltTrack = (["f2l", "oll", "pll", "coll", "cmll", "wv", "parity", "ortega", "cll"]
        .map(tid => getTrack(s.currentPuzzle, tid))
        .find(tr => tr?.cases?.length));
      if (defaultAltTrack) {
        simLoadCaseWithSolution(wrapTrackCaseForSim(defaultAltTrack, defaultAltTrack.cases[0]), 0);
      }
    }
  }

  function simTeardown() {
    const el = getEl();
    if (el?.player) {
      try {
        el.player.pause();
        el.player.tempoScale = 1;
        el.player.experimentalSetupAlg = "";
        el.player.experimentalModel?.catchUpMove?.set?.({ move: null, amount: 0 });
        el.player.jumpToEnd();
      } catch {}
    }
    freeMovesCtrl?.setBaseScramble?.("");
    if (appStore.state.scramble) {
      cubeStage?.applyScrambleToDisplay?.(appStore.state.scramble);
      cubeStage?.applyReflection?.();
    }
  }

  function simAppendMove(moveStr) {
    const clean = cleanAlg(moveStr);
    if (!clean) return false;
    simMoves.push(clean);
    simScrambleText = simMoves.join(" ");
    if (simScrambleInput) simScrambleInput.value = simScrambleText;
    const el = getEl();
    if (el?.player) {
      try { el.scramble = simScrambleText; el.player.controller.jumpToEnd({ flash: false }); } catch {}
    }
    renderSimTimeline();
    updateSimProgress(simMoves.length, false, true);
    return true;
  }

  function loadSolverSequence({ base, solMoves, expectedCase }) {
    getNavCtrl()?.setMode?.("simulate", { skipSimInit: true });
    const fullSeq = `${base} ${solMoves}`.trim();
    if (simScrambleInput) simScrambleInput.value = fullSeq;
    simLoadScramble(fullSeq, {
      expectedCase,
      isAppended: true,
      startAtSolution: true,
      originalScramble: base
    });
  }

  function loadStudyCase(caseObj, algObj) {
    getNavCtrl()?.setMode?.("simulate", { skipSimInit: true });
    const chosenAlg = algObj ? algObj.alg : (caseObj.algs?.[0]?.alg || caseObj.solutionAlg || caseObj.solution || "");
    const scr = caseObj.setup || caseObj.scramble || caseObj.scrambles?.[0] || "";
    if (scr) {
      simLoadCaseWithSolution({ ...caseObj, scrambles: [scr], scramble: scr, solution: chosenAlg, solutionAlg: chosenAlg }, 0);
    } else {
      if (simScrambleInput) simScrambleInput.value = chosenAlg;
      simLoadScramble(chosenAlg, { expectedCase: caseObj, startAtSolution: false });
    }
  }

  function loadExternalScramble(scr) {
    if (simScrambleInput) simScrambleInput.value = scr || "";
    return simLoadScramble(scr);
  }

  function onSimulateKeyDown(e) {
    if (!isSimulateViewMode(appStore.state)) return false;
    if (e.code === "Space") { e.preventDefault(); simTogglePlay(); return true; }
    if (e.key === "ArrowRight") { e.preventDefault(); simStepForward(); return true; }
    if (e.key === "ArrowLeft") { e.preventDefault(); simStepBackward(); return true; }
    if (e.key === "Home") { e.preventDefault(); simJumpToStart(); return true; }
    if (e.key === "End") { e.preventDefault(); simJumpToEnd(); return true; }
    return false;
  }

  // Event listeners
  simLoadBtn?.addEventListener("click", () => simLoadScramble(simScrambleInput?.value || ""));
  simScrambleInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); simLoadScramble(simScrambleInput.value); }
  });
  simClearBtn?.addEventListener("click", () => {
    if (simScrambleInput) { simScrambleInput.value = ""; simScrambleInput.focus(); }
  });
  simUseCurrentBtn?.addEventListener("click", () => {
    const s = appStore.state;
    if (s.currentCaseId) {
      const track = getTrack(s.currentPuzzle, s.currentTrackId);
      const c = track?.caseById?.get(s.currentCaseId) || caseById.get(s.currentCaseId);
      if (c) { simLoadCaseWithSolution(c, 0); return; }
    }
    if (s.scramble) {
      if (simScrambleInput) simScrambleInput.value = s.scramble;
      simLoadScramble(s.scramble);
    }
  });

  simCaseSelect?.addEventListener("change", () => {
    const caseId = simCaseSelect.value;
    if (!caseId) { if (simScrambleSelectWrap) simScrambleSelectWrap.hidden = true; return; }
    if (/^(222|333|333oh|444|555):/.test(caseId)) {
      const [puz, trackId, cId] = caseId.split(":");
      const tr = getTrack(puz, trackId);
      const c = tr?.caseById?.get(cId);
      if (c) simLoadCaseWithSolution(wrapTrackCaseForSim(tr, c, puz), 0);
      return;
    }
    if (caseId.startsWith("PBL: ")) {
      const pblObj = pblCaseById.get(caseId.replace(/^PBL:\s*/i, "").trim());
      if (pblObj) simLoadPblCase(pblObj);
      return;
    }
    const cObj = caseById.get(caseId);
    if (cObj) simLoadCaseWithSolution(cObj, 0);
  });

  simScrambleSelect?.addEventListener("change", () => {
    if (!simExpectedCaseObj) return;
    const idx = parseInt(simScrambleSelect.value, 10);
    if (Number.isNaN(idx)) return;
    if (simExpectedCaseObj.isPbl) simLoadPblCase(simExpectedCaseObj.caseObj || simExpectedCaseObj, idx);
    else simLoadCaseWithSolution(simExpectedCaseObj, idx);
  });

  simAppendSolutionBtn?.addEventListener("click", () => {
    const sol = simExpectedCaseObj ? (simExpectedCaseObj.solutionAlg || simExpectedCaseObj.solution) : null;
    if (!simExpectedCaseObj || !sol) {
      showToast("Select or load a case first to append its solution.", "warning");
      return;
    }
    if (simHasSolutionAppended) {
      simLoadScramble(simOriginalScramble, { expectedCase: simExpectedCaseObj });
      if (simScrambleInput) simScrambleInput.value = simOriginalScramble;
    } else {
      const solClean = cleanAlg(sol);
      const base = simOriginalScramble || simScrambleText;
      const combined = `${base} ${solClean}`.trim();
      if (simScrambleInput) simScrambleInput.value = combined;
      simLoadScramble(combined, { expectedCase: simExpectedCaseObj, isAppended: true, startAtSolution: true, originalScramble: base });
    }
  });

  simBtnStart?.addEventListener("click", simJumpToStart);
  simTimelineResetBtn?.addEventListener("click", simJumpToStart);
  simBtnPrev?.addEventListener("click", simStepBackward);
  simBtnPlay?.addEventListener("click", simTogglePlay);
  simBtnNext?.addEventListener("click", simStepForward);
  simBtnEnd?.addEventListener("click", simJumpToEnd);
  simSpeedButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const speed = parseFloat(btn.dataset.speed);
      if (!Number.isNaN(speed) && speed > 0) {
        syncPlaybackSpeed(speed);
        appStore?.setSimSpeed?.(speed);
      }
    });
  });

  if (typeof window !== "undefined") {
    window.cllSimulator = {
      loadScramble: (str, opts) => simLoadScramble(str, opts),
      loadCaseWithSolution: (caseObj, idx) => simLoadCaseWithSolution(caseObj, idx),
      loadPblCase: (caseObj, idx) => simLoadPblCase(caseObj, idx),
      jumpToCaseState: () => simJumpToCaseState(),
      stepForward: () => simStepForward(),
      stepBackward: () => simStepBackward(),
      jumpToStart: () => simJumpToStart(),
      jumpToEnd: () => simJumpToEnd(),
      play: () => getEl()?.player?.play?.(),
      pause: () => getEl()?.player?.pause?.(),
      togglePlay: () => simTogglePlay(),
      appendMove: (m) => simAppendMove(m),
      getCurrentIndex: () => simActiveIndex
    };
  }

  return {
    simInit,
    simTeardown,
    populateSimCaseSelect,
    attachSimPlayerListeners,
    updateSimulateSolutions,
    syncPlaybackSpeed,
    loadExternalScramble,
    loadSolverSequence,
    loadStudyCase,
    simLoadScramble,
    simLoadCaseWithSolution,
    simLoadPblCase,
    onSimulateKeyDown,
    notifyFreeTurnStatus: (count) => {
      if (simStatusBadge) {
        simStatusBadge.textContent = "Free Turns";
        simStatusBadge.className = "sim-badge badge-warning";
      }
      if (simStepCounter) {
        simStepCounter.textContent = `Free face turns active (${count} turn${count === 1 ? "" : "s"} · click Reset Scramble to restore case)`;
      }
    },
    handleFreeReset: (kind) => {
      if (kind === "scramble" && simHasSolutionAppended) {
        const el = getEl();
        if (el?.player) {
          try {
            el.player.pause();
            el.scramble = simMoves.join(" ");
            cubeStage?.applyReflection?.();
            void simJumpToCaseState();
          } catch {}
        }
        return true;
      }
      if (kind === "solved") {
        if (simScrambleInput) simScrambleInput.value = "";
        if (simCaseSelect) simCaseSelect.value = "";
        if (simScrambleSelectWrap) simScrambleSelectWrap.hidden = true;
        if (simCaseDetails) simCaseDetails.hidden = true;
        if (simErrorMsg) simErrorMsg.hidden = true;
        simOriginalScramble = "";
        simHasSolutionAppended = false;
        simExpectedCaseObj = null;
        simMoves = [];
        simActiveIndex = 0;
        if (simAppendSolutionBtn) {
          simAppendSolutionBtn.textContent = "Append Solution";
          simAppendSolutionBtn.classList.remove("active");
          simAppendSolutionBtn.disabled = true;
        }
        renderSimTimeline();
        if (simStatusBadge) { simStatusBadge.textContent = "Solved"; simStatusBadge.className = "sim-badge"; }
        if (simStepCounter) simStepCounter.textContent = "Solved cube · ready for Free Turns";
      }
      return false;
    }
  };
}
