// Solve Details Modal (scramble, GAN phases, CFOP breakdown, move tape, and 3D replay trigger)

import { ensureSolveCfop } from '../../cfopAnalyzer.js';
import { escapeHtml, formatSolveDate, formatSolveDisplay, formatCfopSplitMs } from '../../services/htmlUtils.js';
import { renderCfopStepTable } from '../solve/cfopBreakdownRenderer.js';

export function createSolveDetailModal({
  appStore,
  modalManager,
  solveReplayViewer,
  getSolvePanel = () => null,
  getNavCtrl = () => null,
  getSimulatorCtrl = () => null
} = {}) {
  const modal = typeof document !== "undefined" ? document.getElementById("solveDetailModal") : null;
  const titleEl = typeof document !== "undefined" ? document.getElementById("solveModalTitle") : null;
  const timeEl = typeof document !== "undefined" ? document.getElementById("solveModalTime") : null;
  const scrambleEl = typeof document !== "undefined" ? document.getElementById("solveModalScramble") : null;
  const dateEl = typeof document !== "undefined" ? document.getElementById("solveModalDate") : null;
  const phasesField = typeof document !== "undefined" ? document.getElementById("solveModalPhasesField") : null;
  const phasesLabel = typeof document !== "undefined" ? document.getElementById("solveModalPhasesLabel") : null;
  const phasesContent = typeof document !== "undefined" ? document.getElementById("solveModalPhasesContent") : null;
  const cfopField = typeof document !== "undefined" ? document.getElementById("solveModalCfopField") : null;
  const cfopContent = typeof document !== "undefined" ? document.getElementById("solveModalCfopContent") : null;
  const movesField = typeof document !== "undefined" ? document.getElementById("solveModalMovesField") : null;
  const movesCountEl = typeof document !== "undefined" ? document.getElementById("solveModalMovesCount") : null;
  const tpsEl = typeof document !== "undefined" ? document.getElementById("solveModalTps") : null;
  const deviceEl = typeof document !== "undefined" ? document.getElementById("solveModalDevice") : null;
  const movesTapeEl = typeof document !== "undefined" ? document.getElementById("solveModalMovesTape") : null;
  const replayBtn = typeof document !== "undefined" ? document.getElementById("solveModalReplayBtn") : null;
  const closeBtn = typeof document !== "undefined" ? document.getElementById("solveModalCloseBtn") : null;
  const dismissBtn = typeof document !== "undefined" ? document.getElementById("solveModalDismissBtn") : null;
  const copyScrambleBtn = typeof document !== "undefined" ? document.getElementById("solveModalCopyScrambleBtn") : null;
  const reattemptBtn = typeof document !== "undefined" ? document.getElementById("solveModalReattemptBtn") : null;
  const simBtn = typeof document !== "undefined" ? document.getElementById("solveModalSimBtn") : null;

  let activeSolve = null;

  function open(solve, solveNum) {
    if (!solve || !modal) return;
    activeSolve = solve;
    const sess = appStore.getActiveSession();

    if (titleEl) titleEl.textContent = `Solve #${solveNum} (${sess.name})`;
    if (timeEl) timeEl.textContent = formatSolveDisplay(solve);
    if (scrambleEl) scrambleEl.textContent = solve.scramble || "(no scramble recorded)";
    if (dateEl) dateEl.textContent = formatSolveDate(solve.at);
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

    const cfop = ensureSolveCfop(solve);
    if (cfopField && cfopContent) {
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

    modalManager.open(modal, {
      onClose: () => { activeSolve = null; }
    });
  }

  function close() {
    if (modal) modalManager.close(modal);
  }

  closeBtn?.addEventListener("click", close);
  dismissBtn?.addEventListener("click", close);

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
