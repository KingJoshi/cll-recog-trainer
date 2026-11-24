// 2x2 1st-Layer / Face Solver & 3x3 Cross / Cross+1 / EO Solver Widgets

import { findLayerSolutions, findFaceSolutions } from '../../layerSolver.js';
import { findCrossSolutions } from '../../crossSolver.js';
import { caseById, isTimerViewMode } from '../../state/appStore.js';
import { escapeHtml, capitalize } from '../../services/htmlUtils.js';
import { copyTextWithButtonFeedback } from '../../services/clipboard.js';
import { ICON_POPUP_SIM } from '../../ui/transportIcons.js';

export const ALL_SOLVER_FACES = ["white", "yellow", "green", "blue", "red", "orange"];

export function createSolverWidgetsView({
  appStore,
  freeMovesCtrl,
  getPracticeView = () => null,
  onSimulateSequence = null,
  onQuickSimSolutions = null
} = {}) {
  const layerWidget = typeof document !== "undefined" ? document.getElementById("layerSolutionsWidget") : null;
  const layerTitle = typeof document !== "undefined" ? document.getElementById("layerSolutionsTitle") : null;
  const layerBadge = typeof document !== "undefined" ? document.getElementById("layerSolutionsBadge") : null;
  const layerList = typeof document !== "undefined" ? document.getElementById("layerSolutionsList") : null;
  const layerFacesChips = typeof document !== "undefined" ? document.getElementById("layerFacesChips") : null;
  const layerPresetWhiteBtn = typeof document !== "undefined" ? document.getElementById("layerPresetWhiteBtn") : null;
  const layerPresetOppositeBtn = typeof document !== "undefined" ? document.getElementById("layerPresetOppositeBtn") : null;
  const layerPresetAllBtn = typeof document !== "undefined" ? document.getElementById("layerPresetAllBtn") : null;
  const layerModeLayerBtn = typeof document !== "undefined" ? document.getElementById("layerModeLayerBtn") : null;
  const layerModeFaceBtn = typeof document !== "undefined" ? document.getElementById("layerModeFaceBtn") : null;

  const crossWidget = typeof document !== "undefined" ? document.getElementById("crossSolutionsWidget") : null;
  const crossTitle = typeof document !== "undefined" ? document.getElementById("crossSolutionsTitle") : null;
  const crossBadge = typeof document !== "undefined" ? document.getElementById("crossSolutionsBadge") : null;
  const crossEoSummary = typeof document !== "undefined" ? document.getElementById("crossEoSummary") : null;
  const crossList = typeof document !== "undefined" ? document.getElementById("crossSolutionsList") : null;

  let layerSolutionMode = "layer";
  let currentLayerScramble = "";
  let currentLayerFacesKey = "";
  let currentCrossScramble = "";
  let currentCrossFacesKey = "";

  function updateFaceChipsUI() {
    const faces = appStore.state.layerTargetFaces;
    const targetName = appStore.state.solveTarget === "face" || layerSolutionMode === "face" ? "1st face" : "1st layer";

    const syncChips = (container) => {
      if (!container) return;
      container.querySelectorAll(".face-chip").forEach(chip => {
        const face = chip.dataset.face || chip.dataset.layerFace;
        const active = faces.includes(face);
        chip.classList.toggle("active", active);
        chip.setAttribute("aria-pressed", String(active));
      });
    };
    syncChips(layerFacesChips);
    syncChips(typeof document !== "undefined" ? document.getElementById("settingsLayerFacesChips") : null);

    if (layerTitle) {
      if (faces.length === 6) layerTitle.textContent = `${targetName} solutions (All 6 / CN)`;
      else if (faces.length === 1) layerTitle.textContent = `${targetName} solutions (${capitalize(faces[0])})`;
      else if (faces.length === 2 && faces.includes("white") && faces.includes("yellow")) layerTitle.textContent = `${targetName} solutions (W / Y)`;
      else layerTitle.textContent = `${targetName} solutions (${faces.map(f => capitalize(f)).join(", ")})`;
    }

    const togglePresets = (w, o, a) => {
      w?.classList.toggle("active", faces.length === 1 && faces[0] === "white");
      o?.classList.toggle("active", faces.length === 2 && faces.includes("white") && faces.includes("yellow"));
      a?.classList.toggle("active", faces.length === 6);
    };
    togglePresets(layerPresetWhiteBtn, layerPresetOppositeBtn, layerPresetAllBtn);
    if (typeof document !== "undefined") {
      togglePresets(
        document.getElementById("settingsLayerPresetWhiteBtn"),
        document.getElementById("settingsLayerPresetOppositeBtn"),
        document.getElementById("settingsLayerPresetAllBtn")
      );
    }
  }

  function setTargetFaces(faces) {
    const filtered = (faces || []).filter(f => ALL_SOLVER_FACES.includes(f));
    if (!filtered.length) return;
    appStore.state.layerTargetFaces = filtered;
    appStore.saveSettings();
    updateFaceChipsUI();
    const scr = appStore.state.currentSolveScramble || appStore.state.scrambleMoves || appStore.state.scramble;
    if (scr && appStore.state.currentPuzzle === "222") {
      updateLayerSolutions(scr);
    }
  }

  function toggleTargetFace(face) {
    if (!ALL_SOLVER_FACES.includes(face)) return;
    const cur = appStore.state.layerTargetFaces;
    const next = cur.includes(face)
      ? (cur.length <= 1 ? cur : cur.filter(f => f !== face))
      : [...cur, face];
    setTargetFaces(next);
  }

  function setLayerSolutionMode(nextMode) {
    layerSolutionMode = nextMode === "face" ? "face" : "layer";
    if (layerModeLayerBtn) {
      layerModeLayerBtn.classList.toggle("active", layerSolutionMode === "layer");
      layerModeLayerBtn.setAttribute("aria-pressed", String(layerSolutionMode === "layer"));
    }
    if (layerModeFaceBtn) {
      layerModeFaceBtn.classList.toggle("active", layerSolutionMode === "face");
      layerModeFaceBtn.setAttribute("aria-pressed", String(layerSolutionMode === "face"));
    }
    updateFaceChipsUI();
    const scr = appStore.state.mode === "simulate"
      ? (freeMovesCtrl?.getSequence?.() || currentLayerScramble)
      : (appStore.state.currentSolveScramble || currentLayerScramble);
    updateLayerSolutions(scr);
  }

  function renderLayerSolutions(sols, showAll = false) {
    if (!layerList) return;
    if (!sols || sols.length === 0) {
      layerList.innerHTML = `<p class="layer-solutions-empty">No 1st-layer solution within 4 moves for selected faces. Try adding more faces or "All 6 (CN)".</p>`;
      if (layerBadge) layerBadge.textContent = "0 found";
      return;
    }

    const optimalMoves = sols[0].moveCount;
    if (layerBadge) {
      layerBadge.textContent = `${sols.length} solution${sols.length === 1 ? "" : "s"} · best ${optimalMoves} moves`;
    }

    const displayed = showAll ? sols : sols.slice(0, 10);
    const html = displayed.map((sol, idx) => {
      const isSolved = sol.caseId === "Solved";
      const caseBadgeClass = isSolved ? "badge-solved" : "badge-case";
      const caseLabel = sol.caseId === "PBL" ? "Leaves PBL" : `Leaves ${sol.caseId}`;
      const faceName = sol.face || "white";
      const inspText = sol.inspection && sol.inspection !== "none" ? sol.inspection : "none";
      const inspTooltip = sol.fixedCount
        ? `${sol.orientedDCount || 1} ${capitalize(faceName)} on bottom (${sol.fixedCount} fixed throughout solution)`
        : "";
      const movesText = sol.moves || "(already solved)";
      const cObj = caseById.get(sol.caseId);
      const alg = cObj?.alg || cObj?.solutionAlg || "";
      const caseTitle = alg ? `CLL solution for ${sol.caseId}: ${alg}` : "";

      return `
        <div class="layer-sol-row">
          <div class="layer-sol-info">
            <div class="layer-sol-badges">
              <span class="face-badge face-badge-${faceName}">${capitalize(faceName)}</span>
              <span class="badge layer-sol-moves-badge">${sol.moveCount} move${sol.moveCount === 1 ? "" : "s"}</span>
              <span class="layer-sol-insp-chip" ${inspTooltip ? `title="${escapeHtml(inspTooltip)}"` : ""}>Inspection: <strong>${escapeHtml(inspText)}</strong></span>
              ${sol.bottomPerm ? `<span class="badge ${sol.bottomPerm === "Layer Solved" ? "badge-solved" : "badge-warning"}">${escapeHtml(sol.bottomPerm)}</span>` : ""}
              <span class="badge ${caseBadgeClass}" ${caseTitle ? `title="${escapeHtml(caseTitle)}"` : ""}>${escapeHtml(caseLabel)}</span>
            </div>
            <div class="layer-sol-moves">${escapeHtml(movesText)}</div>
          </div>
          <div class="layer-sol-actions">
            <button type="button" class="btn btn-small layer-sol-sim-btn" data-idx="${idx}" data-tooltip="Preview this solution in an in-place 3D popup (cycle solutions with Next/Prev)" aria-label="Simulate solution ${idx + 1} in 3D popup">
              ${ICON_POPUP_SIM}<span>Sim</span>
            </button>
            <button type="button" class="btn btn-small layer-sol-copy-btn" data-idx="${idx}" data-tooltip="Copy reconstruction to clipboard">
              Copy
            </button>
          </div>
        </div>
      `;
    }).join("");

    let footerHtml = "";
    if (sols.length > 10 && !showAll) {
      footerHtml = `<div class="layer-sol-footer"><button type="button" id="layerSolShowAllBtn" class="btn btn-small btn-block">Show all ${sols.length} solutions</button></div>`;
    } else if (showAll && sols.length > 10) {
      footerHtml = `<div class="layer-sol-footer"><button type="button" id="layerSolShowLessBtn" class="btn btn-small btn-block">Show fewer solutions</button></div>`;
    }

    layerList.innerHTML = html + footerHtml;

    layerList.querySelectorAll(".layer-sol-sim-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.idx);
        const sol = displayed[idx];
        if (!sol) return;
        const base = appStore.state.mode === "simulate"
          ? (freeMovesCtrl?.getSequence?.() || currentLayerScramble)
          : (appStore.state.currentSolveScramble || appStore.state.scrambleMoves || appStore.state.scramble);
        if (onQuickSimSolutions && appStore.state.mode !== "simulate") {
          const isFace = layerSolutionMode === "face";
          onQuickSimSolutions({
            puzzle: "222",
            scramble: base,
            solutions: sols.map(s => ({
              label: `${capitalize(s.face)} (${s.moveCount}m)`,
              face: s.face,
              moves: s.moves,
              moveCount: s.moveCount,
              inspection: s.inspection || "none",
              bottomPerm: s.bottomPerm || null,
              caseId: s.caseId || null
            })),
            activeIndex: idx,
            title: isFace ? "2x2 1st Face Solution Simulator" : "2x2 1st Layer Solution Simulator",
            onOpenFullSim: onSimulateSequence
          });
          return;
        }
        const solMoves = (sol.inspection && sol.inspection !== "none" ? sol.inspection + " " : "") + (sol.moves || "");
        onSimulateSequence?.({
          base,
          solMoves,
          expectedCase: { id: `Layer: ${capitalize(sol.face)} (${sol.moveCount}m)`, solution: solMoves, solutionAlg: solMoves, isLayer: true }
        });
      });
    });

    layerList.querySelectorAll(".layer-sol-copy-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const sol = displayed[Number(btn.dataset.idx)];
        if (!sol) return;
        const base = appStore.state.currentSolveScramble || appStore.state.scrambleMoves || appStore.state.scramble;
        const cObj = caseById.get(sol.caseId);
        const alg = cObj?.alg || cObj?.solutionAlg || "";
        const text = [
          `Scramble: ${base}`,
          `Face: ${capitalize(sol.face || "white")}`,
          sol.inspection && sol.inspection !== "none" ? `Inspection: ${sol.inspection}` : "",
          `1st Layer: ${sol.moves || "(already solved)"}`,
          `Leaves: ${sol.caseId}${alg ? " (CLL: " + alg + ")" : ""}`
        ].filter(Boolean).join("\n");
        void copyTextWithButtonFeedback(text, btn);
      });
    });

    document.getElementById("layerSolShowAllBtn")?.addEventListener("click", () => renderLayerSolutions(sols, true));
    document.getElementById("layerSolShowLessBtn")?.addEventListener("click", () => renderLayerSolutions(sols, false));
  }

  function updateLayerSolutions(scrambleStr) {
    updateFaceChipsUI();
    if (!scrambleStr) {
      if (layerList) {
        layerList.innerHTML = '<p class="layer-solutions-empty">No scramble loaded (or cube is solved). Load a scramble or use Free Face Turns to build a state.</p>';
      }
      if (layerBadge) layerBadge.textContent = "";
      return;
    }
    const faces = appStore.state.layerTargetFaces;
    const facesKey = `${layerSolutionMode}:${[...faces].sort().join(",")}`;
    currentLayerScramble = scrambleStr;
    currentLayerFacesKey = facesKey;
    if (layerBadge) layerBadge.textContent = "searching...";
    if (layerList) {
      const facesDesc = faces.length === 6 ? "all 6 faces" : faces.map(f => capitalize(f)).join("/");
      const targetName = layerSolutionMode === "face" ? "1st face (Ortega)" : "1st layer";
      layerList.innerHTML = `<p class="layer-solutions-empty">Searching for ${escapeHtml(facesDesc)} ${targetName} solutions...</p>`;
    }

    setTimeout(async () => {
      if (currentLayerScramble !== scrambleStr || currentLayerFacesKey !== facesKey) return;
      try {
        const sols = layerSolutionMode === "face"
          ? await findFaceSolutions(scrambleStr, faces, 4)
          : await findLayerSolutions(scrambleStr, faces, 5);
        if (currentLayerScramble !== scrambleStr || currentLayerFacesKey !== facesKey) return;
        renderLayerSolutions(sols, false);
      } catch (err) {
        console.error("Error finding layer solutions:", err);
        if (currentLayerScramble === scrambleStr && currentLayerFacesKey === facesKey) {
          renderLayerSolutions([], false);
        }
      }
    }, 10);
  }

  function updateCrossFacesUI() {
    const faces = appStore.state.crossTargetFaces;
    const settingsCrossFacesChips = typeof document !== "undefined" ? document.getElementById("settingsCrossFacesChips") : null;
    if (settingsCrossFacesChips) {
      settingsCrossFacesChips.querySelectorAll(".face-chip").forEach(chip => {
        const face = chip.dataset.crossFace;
        const active = faces.includes(face);
        chip.classList.toggle("active", active);
        chip.setAttribute("aria-pressed", String(active));
      });
    }
    if (typeof document !== "undefined") {
      document.getElementById("crossPresetWhiteBtn")?.classList.toggle("active", faces.length === 1 && faces[0] === "white");
      document.getElementById("crossPresetOppositeBtn")?.classList.toggle("active", faces.length === 2 && faces.includes("white") && faces.includes("yellow"));
      document.getElementById("crossPresetAllBtn")?.classList.toggle("active", faces.length === 6);
    }

    if (crossTitle) {
      if (faces.length === 6) crossTitle.textContent = "Cross & Cross+1 / EO solutions (All 6 / CN)";
      else if (faces.length === 1) crossTitle.textContent = `Cross & Cross+1 / EO solutions (${capitalize(faces[0])})`;
      else if (faces.length === 2 && faces.includes("white") && faces.includes("yellow")) crossTitle.textContent = "Cross & Cross+1 / EO solutions (W / Y)";
      else crossTitle.textContent = `Cross & Cross+1 / EO solutions (${faces.map(f => capitalize(f)).join(", ")})`;
    }
  }

  function setCrossTargetFaces(faces) {
    const filtered = (faces || []).filter(f => ALL_SOLVER_FACES.includes(f));
    if (!filtered.length) return;
    appStore.state.crossTargetFaces = filtered;
    appStore.saveSettings();
    updateCrossFacesUI();
    const scr = appStore.state.currentSolveScramble || appStore.state.scrambleMoves || appStore.state.scramble;
    if (scr && (appStore.state.currentPuzzle === "333" || appStore.state.currentPuzzle === "333oh")) {
      updateCrossSolutions(scr);
    }
    const pv = getPracticeView();
    if (appStore.state.mode === "practice" && !isTimerViewMode(appStore.state) && pv?.solutionRevealed) {
      pv.revealInspectionSolutions();
    }
  }

  function toggleCrossTargetFace(face) {
    if (!ALL_SOLVER_FACES.includes(face)) return;
    const cur = appStore.state.crossTargetFaces;
    const next = cur.includes(face)
      ? (cur.length <= 1 ? cur : cur.filter(f => f !== face))
      : [...cur, face];
    setCrossTargetFaces(next);
  }

  function renderCrossSolutions(result) {
    if (!crossList) return;
    const sols = Array.isArray(result) ? result : (result?.solutions || []);
    if (!sols || sols.length === 0) {
      crossList.innerHTML = '<p class="layer-solutions-empty">No cross solutions found within depth.</p>';
      if (crossBadge) crossBadge.textContent = "0";
      return;
    }

    if (crossBadge) {
      crossBadge.textContent = `${sols.length} found · optimal ${sols[0].moveCount}m`;
    }

    if (crossEoSummary && sols[0]?.eoSummary) {
      const eo = sols[0].eoSummary;
      const eoCrossBadge = eo.crossOriented === 4
        ? `<span class="badge chip-eo chip-eo-clean">✓ All 4 Cross Edges Oriented</span>`
        : `<span class="badge chip-eo">${eo.crossOriented}/4 Cross Edges Oriented (${4 - eo.crossOriented} bad)</span>`;
      const totalEoBadge = `<span class="badge chip-eo">Overall: ${eo.goodEdges}/12 Good Edges (${eo.badEdges} bad)</span>`;
      crossEoSummary.innerHTML = `
        <div class="cross-eo-bar">
          <span class="cross-eo-label">Edge Orientation (EO):</span>
          ${eoCrossBadge}
          ${totalEoBadge}
        </div>
      `;
    }

    crossList.innerHTML = sols.map((sol, idx) => {
      const faceName = sol.face || "white";
      const inspText = sol.insp && sol.insp !== "none" ? sol.insp : "none";
      const cross1Badges = sol.crossPlus1 && sol.crossPlus1.hasPair
        ? `<span class="badge ${sol.crossPlus1.type === "solved" ? "badge-solved" : "chip-cross1"}" title="${escapeHtml(sol.crossPlus1.description)}">Cross+1: ${sol.crossPlus1.slot} (${sol.crossPlus1.type})</span>`
        : "";
      return `
        <div class="layer-sol-row">
          <div class="layer-sol-info">
            <div class="layer-sol-badges">
              <span class="face-badge face-badge-${faceName}">${capitalize(faceName)} Cross</span>
              <span class="badge layer-sol-moves-badge">${sol.moveCount} moves</span>
              <span class="layer-sol-insp-chip">Inspection: <strong>${escapeHtml(inspText)}</strong></span>
              ${cross1Badges}
            </div>
            <div class="layer-sol-moves">${escapeHtml(sol.moves)}</div>
          </div>
          <div class="layer-sol-actions">
            <button type="button" class="btn btn-small cross-sol-sim-btn" data-idx="${idx}" data-tooltip="Preview this cross solution in an interactive 3D popup" aria-label="Simulate cross solution ${idx + 1} in 3D popup">
              ${ICON_POPUP_SIM}<span>Sim</span>
            </button>
            <button type="button" class="btn btn-small cross-sol-copy-btn" data-idx="${idx}" data-tooltip="Copy cross reconstruction">
              Copy
            </button>
          </div>
        </div>
      `;
    }).join("");

    crossList.querySelectorAll(".cross-sol-sim-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const idx = Number(btn.dataset.idx);
        const sol = sols[idx];
        if (!sol) return;
        const base = appStore.state.currentSolveScramble || appStore.state.scrambleMoves || appStore.state.scramble;
        if (onQuickSimSolutions && appStore.state.mode !== "simulate") {
          onQuickSimSolutions({
            puzzle: appStore.state.currentPuzzle === "333oh" ? "333oh" : "333",
            scramble: base,
            solutions: sols.map(s => ({
              label: `${capitalize(s.face || "white")} Cross (${s.moveCount}m)`,
              face: s.face || "white",
              moves: s.moves,
              moveCount: s.moveCount,
              inspection: s.insp && s.insp !== "none" ? s.insp : "none",
              crossPlus1: s.crossPlus1 || null
            })),
            activeIndex: idx,
            title: "3x3 White Cross Solution Simulator",
            onOpenFullSim: onSimulateSequence
          });
          return;
        }
        const solMoves = (sol.insp && sol.insp !== "none" ? sol.insp + " " : "") + sol.moves;
        onSimulateSequence?.({
          base,
          solMoves,
          expectedCase: { id: `${capitalize(sol.face || "white")} Cross (${sol.moveCount}m)`, solution: solMoves, solutionAlg: solMoves, isLayer: true }
        });
      });
    });

    crossList.querySelectorAll(".cross-sol-copy-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        const sol = sols[Number(btn.dataset.idx)];
        if (!sol) return;
        const base = appStore.state.currentSolveScramble || appStore.state.scrambleMoves || appStore.state.scramble;
        const lines = [
          `Scramble: ${base}`,
          `${capitalize(sol.face || "white")} Cross: ${sol.moves} (${sol.moveCount} moves)`,
          sol.insp && sol.insp !== "none" ? `Inspection: ${sol.insp}` : "",
          sol.crossPlus1?.hasPair ? `Cross+1: ${sol.crossPlus1.slot} (${sol.crossPlus1.description})` : ""
        ].filter(Boolean).join("\n");
        void copyTextWithButtonFeedback(lines, btn);
      });
    });
  }

  function updateCrossSolutions(scrambleStr) {
    if (!crossList) return;
    updateCrossFacesUI();
    if (!scrambleStr) {
      crossList.innerHTML = '<p class="layer-solutions-empty">No scramble loaded.</p>';
      if (crossBadge) crossBadge.textContent = "";
      if (crossEoSummary) crossEoSummary.innerHTML = "";
      return;
    }
    const faces = appStore.state.crossTargetFaces;
    const facesKey = [...faces].sort().join(",");
    currentCrossScramble = scrambleStr;
    currentCrossFacesKey = facesKey;
    if (crossBadge) crossBadge.textContent = "analyzing...";
    const facesDesc = faces.length === 6 ? "all 6 colors" : faces.map(f => capitalize(f)).join("/");
    crossList.innerHTML = `<p class="layer-solutions-empty">Searching for optimal ${escapeHtml(facesDesc)} cross &amp; Cross+1 / EO solutions...</p>`;

    setTimeout(async () => {
      if (currentCrossScramble !== scrambleStr || currentCrossFacesKey !== facesKey) return;
      try {
        const result = await findCrossSolutions(scrambleStr, faces, 8);
        if (currentCrossScramble !== scrambleStr || currentCrossFacesKey !== facesKey) return;
        renderCrossSolutions(result);
      } catch (err) {
        console.error("Error solving cross:", err);
        crossList.innerHTML = '<p class="layer-solutions-empty">Error calculating cross solutions.</p>';
        if (crossBadge) crossBadge.textContent = "error";
      }
    }, 10);
  }

  if (layerModeLayerBtn) layerModeLayerBtn.addEventListener("click", () => setLayerSolutionMode("layer"));
  if (layerModeFaceBtn) layerModeFaceBtn.addEventListener("click", () => setLayerSolutionMode("face"));
  if (layerFacesChips) {
    layerFacesChips.addEventListener("click", (e) => {
      const face = e.target.closest(".face-chip")?.dataset.face;
      if (face) toggleTargetFace(face);
    });
  }
  layerPresetWhiteBtn?.addEventListener("click", () => setTargetFaces(["white"]));
  layerPresetOppositeBtn?.addEventListener("click", () => setTargetFaces(["white", "yellow"]));
  layerPresetAllBtn?.addEventListener("click", () => setTargetFaces(ALL_SOLVER_FACES));

  if (layerWidget) {
    layerWidget.open = Boolean(appStore.state.layerSolutionsOpen);
    layerWidget.addEventListener("toggle", () => {
      appStore.state.layerSolutionsOpen = layerWidget.open;
      appStore.saveSettings();
    });
  }
  if (crossWidget) {
    crossWidget.open = Boolean(appStore.state.crossSolutionsOpen);
    crossWidget.addEventListener("toggle", () => {
      appStore.state.crossSolutionsOpen = crossWidget.open;
      appStore.saveSettings();
    });
  }

  return {
    getCurrentLayerScramble: () => currentLayerScramble,
    updateFaceChipsUI,
    setTargetFaces,
    toggleTargetFace,
    setLayerSolutionMode,
    updateLayerSolutions,
    renderLayerSolutions,
    updateCrossFacesUI,
    setCrossTargetFaces,
    toggleCrossTargetFace,
    updateCrossSolutions,
    renderCrossSolutions
  };
}
