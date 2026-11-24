// Solve Details Modal (scramble, GAN phases, CFOP breakdown, move tape, and 3D replay trigger)

import { initCfopAnalyzer, ensureSolveCfop } from '../../cfopAnalyzer.js';
import { initTwoByTwoAnalyzer, ensureSolveTwoByTwo } from '../../twoByTwoAnalyzer.js';
import { escapeHtml, formatSolveDate, formatSolveDisplay, formatCfopSplitMs } from '../../services/htmlUtils.js';
import { getSolveFingerprint } from '../../services/syncMerge.js';
import { recordTombstone } from '../../services/syncStorage.js';
import { showToast } from '../../ui/toastService.js';
import { renderCfopStepTable } from '../solve/cfopBreakdownRenderer.js';

export function createSolveDetailModal({
  appStore,
  modalManager,
  solveReplayViewer,
  getSolvePanel = () => null,
  getNavCtrl = () => null,
  getSimulatorCtrl = () => null,
  getStatsCtrl = () => null,
  getSessionModal = () => null
} = {}) {
  const modal = typeof document !== "undefined" ? document.getElementById("solveDetailModal") : null;
  const titleEl = typeof document !== "undefined" ? document.getElementById("solveModalTitle") : null;
  const timeEl = typeof document !== "undefined" ? document.getElementById("solveModalTime") : null;
  const scrambleEl = typeof document !== "undefined" ? document.getElementById("solveModalScramble") : null;
  const dateEl = typeof document !== "undefined" ? document.getElementById("solveModalDate") : null;
  const noteInput = typeof document !== "undefined" ? document.getElementById("solveModalNoteInput") : null;
  const phasesField = typeof document !== "undefined" ? document.getElementById("solveModalPhasesField") : null;
  const phasesLabel = typeof document !== "undefined" ? document.getElementById("solveModalPhasesLabel") : null;
  const phasesContent = typeof document !== "undefined" ? document.getElementById("solveModalPhasesContent") : null;
  const cfopField = typeof document !== "undefined" ? document.getElementById("solveModalCfopField") : null;
  const cfopLabel = typeof document !== "undefined" ? document.getElementById("solveModalCfopLabel") : null;
  const cfopContent = typeof document !== "undefined" ? document.getElementById("solveModalCfopContent") : null;
  const movesField = typeof document !== "undefined" ? document.getElementById("solveModalMovesField") : null;
  const movesCountEl = typeof document !== "undefined" ? document.getElementById("solveModalMovesCount") : null;
  const tpsEl = typeof document !== "undefined" ? document.getElementById("solveModalTps") : null;
  const deviceEl = typeof document !== "undefined" ? document.getElementById("solveModalDevice") : null;
  const movesTapeEl = typeof document !== "undefined" ? document.getElementById("solveModalMovesTape") : null;
  const deleteBtn = typeof document !== "undefined" ? document.getElementById("solveModalDeleteBtn") : null;
  const replayBtn = typeof document !== "undefined" ? document.getElementById("solveModalReplayBtn") : null;
  const reanalyzeBtn = typeof document !== "undefined" ? document.getElementById("solveModalReanalyzeBtn") : null;
  const closeBtn = typeof document !== "undefined" ? document.getElementById("solveModalCloseBtn") : null;
  const dismissBtn = typeof document !== "undefined" ? document.getElementById("solveModalDismissBtn") : null;
  const copyScrambleBtn = typeof document !== "undefined" ? document.getElementById("solveModalCopyScrambleBtn") : null;
  const reattemptBtn = typeof document !== "undefined" ? document.getElementById("solveModalReattemptBtn") : null;
  const simBtn = typeof document !== "undefined" ? document.getElementById("solveModalSimBtn") : null;

  let activeSolve = null;
  let activeSolveNum = null;

  function saveActiveNote() {
    if (!activeSolve || !noteInput) return;
    const nextComment = String(noteInput.value || "").trim();
    const prevComment = String(activeSolve.comment || "").trim();
    if (nextComment === prevComment) return;
    if (nextComment) {
      activeSolve.comment = nextComment;
    } else {
      delete activeSolve.comment;
    }
    activeSolve.updatedAt = Date.now();
    appStore.saveSessions?.();
    getStatsCtrl()?.updateStatsTable?.();
  }

  function open(solve, solveNum) {
    if (!solve || !modal) return;
    activeSolve = solve;
    activeSolveNum = solveNum;
    const sess = appStore.getActiveSession();

    if (titleEl) titleEl.textContent = `Solve #${solveNum} (${sess.name})`;
    if (timeEl) timeEl.textContent = formatSolveDisplay(solve);
    if (scrambleEl) scrambleEl.textContent = solve.scramble || "(no scramble recorded)";
    if (dateEl) dateEl.textContent = formatSolveDate(solve.at);
    if (noteInput) noteInput.value = solve.comment || "";
    if (copyScrambleBtn) copyScrambleBtn.textContent = "Copy";

    if (phasesField && phasesContent) {
      const hasPhases = Boolean(solve.timer || solve.pickupMs != null || solve.putdownMs != null);
      if (hasPhases || solve.inspectionMs != null) {
        phasesField.hidden = false;
        if (phasesLabel) {
          phasesLabel.textContent = hasPhases
            ? `${solve.timer || "Timer"} · Pick-up & Put-down`
            : "Inspection Time";
        }
        const cell = (label, ms, hint) => `
          <div class="solve-phase-cell" title="${escapeHtml(hint)}">
            <span class="solve-phase-label">${label}</span>
            <strong class="solve-phase-val">${formatCfopSplitMs(ms)}</strong>
          </div>`;
        const cells = [];
        if (solve.inspectionMs != null) {
          cells.push(cell("Inspection", solve.inspectionMs, "Inspection time before timer start"));
        }
        if (hasPhases) {
          const timerLabel = solve.timer || "Timer";
          cells.push(cell("Timer", solve.rawMs, `Time recorded by ${timerLabel}`));
          cells.push(cell("Pick-up", solve.pickupMs, "Timer start → first smart cube turn"));
          cells.push(cell("Cube solve", solve.cubeMs, "First turn → smart cube solved"));
          cells.push(cell("Put-down", solve.putdownMs, "Smart cube solved → timer stopped"));
        }
        phasesContent.innerHTML = cells.join("");
      } else {
        phasesField.hidden = true;
        phasesContent.innerHTML = "";
      }
    }

    const is222 = solve?.puzzle === "222";
    const twoMethod = appStore?.state?.twoByTwoMethod || "cll";
    if (cfopLabel) {
      cfopLabel.textContent = is222
        ? "2x2 Phase Splits, Cases & Pauses"
        : "CFOP Phase Splits, Cases & Pauses";
    }
    if (cfopField && cfopContent) {
      if (is222) {
        const analysis = ensureSolveTwoByTwo(solve, {
          twoByTwoMethod: twoMethod,
          layerTargetFaces: appStore?.state?.layerTargetFaces
        });
        if (analysis && (analysis.steps?.length > 0 || analysis.cllCase)) {
          cfopField.hidden = false;
          const totalPauses = analysis.pauses
            ? `${analysis.pauses.totalCount} pause(s) (${formatCfopSplitMs(analysis.pauses.totalMs)} total)`
            : "0";
          const layerMs = analysis.splits?.layer ?? analysis.splits?.face;
          const layerLabel = analysis.method === "ortega" ? "1st Face" : "1st Layer";
          cfopContent.innerHTML = `
            <div class="solve-modal-cfop-summary-bar">
              <span><strong>${layerLabel}:</strong> ${escapeHtml(analysis.layerColor || "White")}${layerMs != null ? ` (${formatCfopSplitMs(layerMs)}, ${analysis.steps?.[0]?.moveCount || 0}m)` : ""}</span>
              ${analysis.cllCase ? `<span><strong>CLL:</strong> ${escapeHtml(analysis.cllCase.name)} (${formatCfopSplitMs(analysis.cllCase.ms)})</span>` : ""}
              ${analysis.splits?.auf != null ? `<span><strong>AUF:</strong> ${formatCfopSplitMs(analysis.splits.auf)}</span>` : ""}
              <span><strong>Total Pauses:</strong> ${totalPauses}</span>
            </div>
            ${renderCfopStepTable(solve, { detailed: true, twoByTwoMethod: twoMethod })}
          `;
        } else {
          cfopField.hidden = true;
          cfopContent.innerHTML = "";
        }
      } else {
        const cfop = ensureSolveCfop(solve);
        if (cfop && (cfop.steps?.length > 0 || cfop.ollCase || cfop.pllCase)) {
          cfopField.hidden = false;
          const totalPauses = cfop.pauses ? `${cfop.pauses.totalCount} pause(s) (${formatCfopSplitMs(cfop.pauses.totalMs)} total)` : "0";
          cfopContent.innerHTML = `
            <div class="solve-modal-cfop-summary-bar">
              <span><strong>Cross Color:</strong> ${escapeHtml(cfop.crossColor || "White")}</span>
              ${cfop.splits?.f2lTotal != null ? `<span><strong>F2L &Sigma;:</strong> ${formatCfopSplitMs(cfop.splits.f2lTotal)}</span>` : ""}
              ${cfop.ollCase ? `<span><strong>OLL:</strong> ${escapeHtml(cfop.ollCase.name)} (${formatCfopSplitMs(cfop.ollCase.ms)})</span>` : ""}
              ${cfop.pllCase ? `<span><strong>PLL:</strong> ${escapeHtml(cfop.pllCase.name)} (${formatCfopSplitMs(cfop.pllCase.ms)})</span>` : ""}
              <span><strong>Total Pauses:</strong> ${totalPauses}</span>
            </div>
            ${renderCfopStepTable(solve, { detailed: true })}
          `;
        } else {
          cfopField.hidden = true;
          cfopContent.innerHTML = "";
        }
      }
    }

    if (movesField) {
      if (solve.moves && solve.moves.length > 0) {
        movesField.hidden = false;
        if (movesCountEl) movesCountEl.textContent = `${solve.moveCount || solve.moves.length} moves (ETM)`;
        if (tpsEl) tpsEl.textContent = `${solve.tps || 0} TPS`;
        if (deviceEl) deviceEl.textContent = solve.smartCube || "Smart Cube";
        if (movesTapeEl) {
          movesTapeEl.innerHTML = solve.moves.map((m, i) => {
            const safeMove = escapeHtml(m.move);
            return `<span class="solve-tape-item" title="Move ${i + 1}: ${safeMove} (+${(m.split / 1000).toFixed(2)}s, total ${(m.t / 1000).toFixed(2)}s)">${i + 1}. ${safeMove}</span>`;
          }).join("");
        }
      } else {
        movesField.hidden = true;
      }
    }

    if (replayBtn) {
      if (solve.moves && solve.moves.length > 0) {
        replayBtn.hidden = false;
        replayBtn.onclick = () => {
          close();
          solveReplayViewer.open(solve, `Solve #${solveNum} (${sess.name})`);
        };
      } else {
        replayBtn.hidden = true;
      }
    }

    if (reanalyzeBtn) {
      const hasMoves = Array.isArray(solve.moves) && solve.moves.length > 0;
      const canAnalyze = hasMoves && (is222 || solve.puzzle === "333" || solve.puzzle === "333oh");
      reanalyzeBtn.hidden = !canAnalyze;
      reanalyzeBtn.disabled = false;
      reanalyzeBtn.textContent = "↻ Re-analyze";
      reanalyzeBtn.onclick = canAnalyze
        ? async () => {
            reanalyzeBtn.disabled = true;
            reanalyzeBtn.textContent = "Re-analyzing…";
            try {
              if (is222) {
                await initTwoByTwoAnalyzer();
                ensureSolveTwoByTwo(solve, {
                  twoByTwoMethod: appStore?.state?.twoByTwoMethod || "cll",
                  layerTargetFaces: appStore?.state?.layerTargetFaces,
                  force: true
                });
              } else {
                await initCfopAnalyzer();
                ensureSolveCfop(solve, { force: true });
              }
              solve.updatedAt = Date.now();
              appStore.saveSessions?.();
              open(solve, solveNum);
              getSolvePanel()?.renderSolvePanel?.();
              getStatsCtrl()?.updateStatsTable?.();
              showToast(`Re-analyzed solve #${solveNum}.`, "success", 2000);
            } finally {
              reanalyzeBtn.disabled = false;
              reanalyzeBtn.textContent = "↻ Re-analyze";
            }
          }
        : null;
    }

    modalManager.open(modal, {
      onClose: () => {
        saveActiveNote();
        activeSolve = null;
        activeSolveNum = null;
      }
    });
  }

  function close() {
    if (modal) modalManager.close(modal);
  }

  closeBtn?.addEventListener("click", close);
  dismissBtn?.addEventListener("click", close);
  noteInput?.addEventListener("change", saveActiveNote);
  noteInput?.addEventListener("blur", saveActiveNote);

  deleteBtn?.addEventListener("click", async () => {
    if (!activeSolve) return;
    const targetSolve = activeSolve;
    const targetNum = activeSolveNum;
    const label = targetNum != null ? `#${targetNum} ` : "";
    const ok = await modalManager.confirmDialog({
      title: "Delete Solve",
      message: `Delete solve ${label}(${formatSolveDisplay(targetSolve)})?`,
      confirmLabel: "Delete",
      danger: true
    });
    if (!ok) return;

    const allSolves = appStore.getSolves?.() || [];
    let idx = allSolves.indexOf(targetSolve);
    if (idx < 0) {
      idx = allSolves.findIndex(sv =>
        sv && ((targetSolve.uid && sv.uid === targetSolve.uid) || (sv.at === targetSolve.at && sv.ms === targetSolve.ms))
      );
    }
    if (idx >= 0) {
      const [removed] = allSolves.splice(idx, 1);
      const fp = getSolveFingerprint(removed);
      if (fp) recordTombstone("solves", fp);
      const st = appStore.state;
      if (st.lastSolve === removed || (st.lastSolve && st.lastSolve.at === removed.at && st.lastSolve.ms === removed.ms)) {
        st.lastSolve = allSolves.length ? allSolves[allSolves.length - 1] : null;
      }
      appStore.setSolves(allSolves);
    }
    activeSolve = null;
    activeSolveNum = null;
    close();
    getSessionModal()?.populateSessionSelect?.();
    getSolvePanel()?.renderSolvePanel?.();
    getStatsCtrl()?.updateStatsTable?.();
    showToast("Solve deleted", "info", 1800);
  });

  copyScrambleBtn?.addEventListener("click", async () => {
    if (!activeSolve?.scramble) return;
    try {
      await navigator.clipboard.writeText(activeSolve.scramble);
      copyScrambleBtn.textContent = "✓ Copied";
      setTimeout(() => { if (copyScrambleBtn) copyScrambleBtn.textContent = "Copy"; }, 1500);
    } catch {
      copyScrambleBtn.textContent = "Copied";
      setTimeout(() => { if (copyScrambleBtn) copyScrambleBtn.textContent = "Copy"; }, 1500);
    }
  });

  reattemptBtn?.addEventListener("click", () => {
    if (!activeSolve?.scramble) return;
    const scr = activeSolve.scramble;
    const title = titleEl ? titleEl.textContent : "solve";
    close();
    getSolvePanel()?.reattemptScramble?.(scr, title);
  });

  simBtn?.addEventListener("click", () => {
    if (!activeSolve?.scramble) return;
    const scr = activeSolve.scramble;
    close();
    getNavCtrl()?.setMode?.("simulate");
    getSimulatorCtrl()?.loadExternalScramble?.(scr);
  });

  return { open, close };
}
