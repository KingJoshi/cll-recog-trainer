// Pure case-selection helpers (Node-testable) & Active Cases drawer controller

import { getTrack } from '../data/algRegistry.js';
import { escapeHtml } from '../services/htmlUtils.js';
import { getCachedCaseSvg, renderCaseSvg } from '../caseVisualizer.js';
import { CASE_IDS, GROUP_DISPLAY_ORDER, casesByGroup, isTimerViewMode } from '../state/appStore.js';

export function getCasesInGroup(group, puzzleId = "222", trackId = "cll") {
  if (puzzleId === "222" && trackId === "cll") {
    if (casesByGroup[group]) return casesByGroup[group];
    const track = getTrack("222", "cll");
    return track?.cases?.filter(
      c => c.group === group || c.group === `${group}-Group` || c.id.startsWith(group)
    ) || [];
  }
  const track = getTrack(puzzleId, trackId);
  if (!track || !track.cases) return casesByGroup[group] || [];
  return track.cases.filter(c =>
    c.group === group ||
    c.group === `${group}-Group` ||
    (group && group.length === 1 && c.group && c.group.startsWith(group)) ||
    (group && group.endsWith("-Group") && c.id && c.id.replace(/^EG[12]-/, "").startsWith(group[0]))
  );
}

export function toggleGroupSelection(
  group,
  selectedSet,
  puzzleId = "222",
  trackId = "cll",
  tagFilter = "all",
  getTagFn = null
) {
  const casesInGroup = getCasesInGroup(group, puzzleId, trackId);
  let ids = casesInGroup.map(c => c.id);
  if (ids.length === 0) return new Set(selectedSet);

  if (tagFilter !== "all" && typeof getTagFn === "function") {
    const matching = ids.filter(id => getTagFn(id) === tagFilter);
    if (matching.length > 0) ids = matching;
  }

  const allSelected = ids.every(id => selectedSet.has(id));
  const next = new Set(selectedSet);
  ids.forEach(id => (allSelected ? next.delete(id) : next.add(id)));
  return next;
}

export function getCaseShortLabel(caseObj, track) {
  if (!caseObj) return "";
  if (caseObj.shortName) return caseObj.shortName;

  const id = caseObj.id || "";
  if (id.startsWith("555-edge-parity")) return "Middle Flip";
  if (id.startsWith("555-wing-swap")) return "Wing Swap";
  if (id === "444-oll-parity-pure") return "OLL (Pure)";
  if (id.startsWith("444-oll-parity")) return "OLL (4-Piece)";
  if (id.startsWith("444-pll-parity-opp")) return "Opposite";
  if (id.startsWith("444-pll-parity-adj")) return "Adjacent";

  if (id.startsWith("EG1-") || id.startsWith("EG2-")) {
    return id.replace(/^EG[12]-/, "");
  }
  if (id.startsWith("lbl-oll-")) {
    return caseObj.shortName ? caseObj.shortName.replace(/^OLL:\s*/i, "") : id.replace(/^lbl-oll-/, "");
  }
  if (id.startsWith("lbl-pll-")) {
    return caseObj.shortName || id.replace(/^lbl-pll-/, "");
  }
  if (track && ["pll", "oll", "f2l", "coll", "cmll", "wv"].includes(track.id)) {
    return id.replace(/^(pll|oll|f2l|coll|cmll|wv)-/, "");
  }

  if (caseObj.name && caseObj.name.length <= 14) {
    return caseObj.name;
  }
  return id.replace(/^[0-9]{3}-/, "").replace(/^[a-z0-9]+-/, "");
}

function formatCaseTagLabel(tag) {
  return tag === "none" ? "Pending" : tag;
}

export function createCasePickerController({
  appStore,
  casePickerEl,
  selectionCountEl,
  casesPanelTitleEl,
  settingsPanelEl,
  settingsToggleEl,
  caseTagModeBtn,
  addAllBtn,
  clearAllBtn,
  cubeCardEl,
  emptyStateEl,
  resetOrientationBtn,
  getStudyView = () => null,
  onSelectionApplied = null,
  onTagChanged = null
} = {}) {
  function syncSettingsPanel() {
    if (!settingsPanelEl || !settingsToggleEl) return;
    const collapsed = Boolean(appStore.state.settingsCollapsed);
    settingsPanelEl.classList.toggle("collapsed", collapsed);
    settingsToggleEl.setAttribute("aria-expanded", String(!collapsed));
    settingsToggleEl.tabIndex = 0;
    document.querySelector(".app")?.classList.toggle("cases-collapsed", collapsed);
  }

  function updateCasePickerFilter() {
    if (!casePickerEl) return;
    const filter = appStore.state.currentTagFilter;
    casePickerEl.querySelectorAll(".case-chip").forEach(chip => {
      const tag = appStore.getCaseTag(chip.dataset.case);
      const matches = filter === "all" || tag === filter;
      chip.style.opacity = matches ? "1" : "0.25";
    });
  }

  function updateCasePickerTags() {
    if (!casePickerEl) return;
    casePickerEl.querySelectorAll(".case-chip").forEach(chip => {
      const id = chip.dataset.case;
      const tag = appStore.getCaseTag(id);
      let dot = chip.querySelector(".case-chip-dot");
      if (!dot) {
        dot = document.createElement("span");
        dot.className = "case-chip-dot";
        chip.appendChild(dot);
      }
      dot.className = `case-chip-dot tag-dot-${tag}`;
      chip.title = `Case ${id} (${formatCaseTagLabel(tag)}) · Click to toggle practice, Right-click to change tag`;
    });
    updateCasePickerFilter();
  }

  function renderSelection() {
    const { currentPuzzle, currentTrackId, selectedCases, currentTagFilter, mode } = appStore.state;
    const track = getTrack(currentPuzzle, currentTrackId);
    const totalCases = track && Array.isArray(track.cases) ? track.cases.length : CASE_IDS.length;
    const activeCount = track && track.cases.length > 0
      ? track.cases.filter(c => selectedCases.has(c.id)).length
      : (track && track.cases.length === 0 ? 0 : selectedCases.size);

    if (selectionCountEl) {
      selectionCountEl.textContent = `${activeCount} / ${totalCases} cases`;
    }
    if (casesPanelTitleEl) {
      const tShort = track?.shortName || currentTrackId.toUpperCase();
      casesPanelTitleEl.textContent = `Active Cases (${tShort})`;
    }

    if (casePickerEl) {
      casePickerEl.querySelectorAll(".case-chip").forEach(chip => {
        chip.setAttribute("aria-pressed", String(selectedCases.has(chip.dataset.case)));
      });

      casePickerEl.querySelectorAll(".group-toggle").forEach(btn => {
        const group = btn.dataset.group;
        const casesInGroup = getCasesInGroup(group, currentPuzzle, currentTrackId);
        let ids = casesInGroup.map(c => c.id);
        if (currentTagFilter !== "all") {
          const matching = ids.filter(id => appStore.getCaseTag(id) === currentTagFilter);
          if (matching.length > 0) ids = matching;
        }
        const selected = ids.filter(id => selectedCases.has(id)).length;
        const state = selected === 0 ? "none" : selected === ids.length ? "all" : "some";
        btn.dataset.state = state;
        btn.setAttribute("aria-pressed", state === "all" ? "true" : state === "none" ? "false" : "mixed");
        const rowEl = btn.closest(".case-row");
        if (rowEl) rowEl.dataset.state = state;
      });
    }

    if (cubeCardEl && (mode === "study" || (mode === "practice" && !isTimerViewMode(appStore.state)))) {
      const hasTrackCases = Boolean(track && track.cases && track.cases.length > 0);
      const hasActiveCases = !hasTrackCases || activeCount > 0;
      const hideCubeInStudy = mode === "study";
      cubeCardEl.hidden = hideCubeInStudy || !hasActiveCases;
      if (emptyStateEl) {
        emptyStateEl.hidden = mode === "study" || hasActiveCases;
      }
      if (resetOrientationBtn) {
        resetOrientationBtn.hidden = cubeCardEl.hidden;
      }
    }

    if (mode === "study") {
      getStudyView()?.render?.();
    }
  }

  function applySelection(nextSet) {
    appStore.setSelection(nextSet, { persist: true });
    for (const id of Object.keys(appStore.state.caseAppearances)) {
      if (!appStore.state.selectedCases.has(id)) {
        delete appStore.state.caseAppearances[id];
      }
    }
    appStore.saveCaseAppearances();
    renderSelection();
    onSelectionApplied?.();
  }

  function toggleGroup(group) {
    const next = toggleGroupSelection(
      group,
      appStore.state.selectedCases,
      appStore.state.currentPuzzle,
      appStore.state.currentTrackId,
      appStore.state.currentTagFilter,
      (id) => appStore.getCaseTag(id)
    );
    applySelection(next);
  }

  function toggleCase(id) {
    if (appStore.state.caseTagMode) {
      appStore.cycleCaseTag(id);
      updateCasePickerTags();
      return;
    }
    const next = new Set(appStore.state.selectedCases);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    applySelection(next);
  }

  function createCaseRow(groupLabel, groupKey, casesInGroup, track, show3x3ChipSvg, slicePrefixLen = 0) {
    const row = document.createElement("div");
    row.className = "case-row";

    const groupBtn = document.createElement("button");
    groupBtn.type = "button";
    groupBtn.className = "group-toggle";
    groupBtn.dataset.group = groupKey;
    const displayGroupLabel = groupLabel.length === 1 ? `${groupLabel}-Group` : groupLabel;
    groupBtn.innerHTML = `<span class="group-toggle-name">${escapeHtml(displayGroupLabel)}</span><span class="group-toggle-count">${casesInGroup.length}</span>`;
    groupBtn.title = `Add or remove all ${displayGroupLabel} cases`;
    groupBtn.setAttribute("aria-label", `Group ${displayGroupLabel}: add or remove all ${casesInGroup.length} cases`);
    groupBtn.addEventListener("click", () => toggleGroup(groupKey));
    row.appendChild(groupBtn);

    const chipsWrap = document.createElement("div");
    chipsWrap.className = "case-row-chips";

    casesInGroup.forEach(caseObj => {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = show3x3ChipSvg ? "case-chip case-chip-with-svg" : "case-chip";
      chip.dataset.case = caseObj.id;
      const tag = appStore.getCaseTag(caseObj.id);
      const shortLabel = slicePrefixLen > 0
        ? caseObj.id.slice(slicePrefixLen)
        : getCaseShortLabel(caseObj, track);

      if (show3x3ChipSvg) {
        const cachedSvg = getCachedCaseSvg("333", track.id, caseObj.id);
        chip.innerHTML = `<span class="case-chip-svg" aria-hidden="true">${cachedSvg}</span><span class="case-chip-label">${escapeHtml(shortLabel)}</span><span class="case-chip-dot tag-dot-${tag}"></span>`;
        if (!cachedSvg) {
          renderCaseSvg("333", track.id, caseObj).then(svg => {
            const svgWrap = chip.querySelector(".case-chip-svg");
            if (svgWrap && chip.isConnected && svg) {
              svgWrap.innerHTML = svg;
            }
          });
        }
      } else {
        chip.innerHTML = `${escapeHtml(shortLabel)}<span class="case-chip-dot tag-dot-${tag}"></span>`;
      }

      chip.title = `Case ${caseObj.name || caseObj.id} (${formatCaseTagLabel(tag)}) · Click to toggle practice, Right-click to change tag`;
      chip.setAttribute("aria-label", `Case ${caseObj.id}`);
      chip.addEventListener("click", () => toggleCase(caseObj.id));
      chip.addEventListener("contextmenu", e => {
        e.preventDefault();
        appStore.cycleCaseTag(caseObj.id);
        updateCasePickerTags();
        onTagChanged?.(caseObj.id);
      });
      chipsWrap.appendChild(chip);
    });

    row.appendChild(chipsWrap);
    return row;
  }

  function buildCasePicker() {
    if (!casePickerEl) return;
    casePickerEl.innerHTML = "";
    appStore.ensureTrackSelection();

    const { currentPuzzle, currentTrackId } = appStore.state;
    if (currentPuzzle !== "222" || currentTrackId !== "cll") {
      const track = getTrack(currentPuzzle, currentTrackId);
      if (!track || !track.cases || track.cases.length === 0) {
        const zeroHint = currentPuzzle === "222"
          ? `This track (${escapeHtml(track ? track.name : "")}) focuses on inspection planning & optimal 1st-face / 1st-layer building.`
          : `This track (${escapeHtml(track ? track.name : "")}) focuses on cross planning & EO rather than discrete case recognition.`;
        casePickerEl.innerHTML = `<p class="hint" style="padding: 10px 0;">${zeroHint}</p>`;
        renderSelection();
        return;
      }
      const groups = track.groups || ["All"];
      const show3x3ChipSvg = (currentPuzzle === "333" || currentPuzzle === "333oh") &&
        ["f2l", "oll", "pll", "coll", "cmll", "wv"].includes(track.id);
      groups.forEach(group => {
        const casesInGroup = track.cases.filter(c => c.group === group);
        if (casesInGroup.length === 0) return;
        casePickerEl.appendChild(createCaseRow(group, group, casesInGroup, track, show3x3ChipSvg, 0));
      });
      renderSelection();
      updateCasePickerFilter();
      return;
    }

    GROUP_DISPLAY_ORDER.forEach(group => {
      casePickerEl.appendChild(
        createCaseRow(group, group, casesByGroup[group], null, false, group.length)
      );
    });
    renderSelection();
    updateCasePickerFilter();
  }

  if (typeof document !== "undefined") {
    document.querySelectorAll(".tag-filter-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        appStore.state.currentTagFilter = btn.dataset.tagFilter || "all";
        document.querySelectorAll(".tag-filter-btn").forEach(b => b.classList.toggle("active", b === btn));
        updateCasePickerFilter();
        renderSelection();
      });
    });
  }

  if (caseTagModeBtn) {
    caseTagModeBtn.addEventListener("click", () => {
      const active = !appStore.state.caseTagMode;
      appStore.state.caseTagMode = active;
      caseTagModeBtn.classList.toggle("active", active);
      caseTagModeBtn.setAttribute("aria-pressed", String(active));
      caseTagModeBtn.textContent = active ? "🏷️ Tag Mode: ON" : "🏷️ Tag Mode: Off";
      settingsPanelEl?.classList.toggle("tag-mode-active", active);
    });
  }

  if (addAllBtn) {
    addAllBtn.addEventListener("click", () => {
      const track = getTrack(appStore.state.currentPuzzle, appStore.state.currentTrackId);
      const allIds = track && track.cases.length > 0 ? track.cases.map(c => c.id) : CASE_IDS;
      if (appStore.state.currentTagFilter === "all") {
        applySelection(new Set(allIds));
      } else {
        const matching = allIds.filter(id => appStore.getCaseTag(id) === appStore.state.currentTagFilter);
        const next = new Set(appStore.state.selectedCases);
        matching.forEach(id => next.add(id));
        applySelection(next);
      }
    });
  }

  if (clearAllBtn) {
    clearAllBtn.addEventListener("click", () => {
      const track = getTrack(appStore.state.currentPuzzle, appStore.state.currentTrackId);
      const allIds = track && track.cases.length > 0 ? track.cases.map(c => c.id) : CASE_IDS;
      if (appStore.state.currentTagFilter === "all") {
        applySelection(new Set());
      } else {
        const matching = allIds.filter(id => appStore.getCaseTag(id) === appStore.state.currentTagFilter);
        const next = new Set(appStore.state.selectedCases);
        matching.forEach(id => next.delete(id));
        applySelection(next);
      }
    });
  }

  if (settingsToggleEl) {
    settingsToggleEl.addEventListener("click", () => {
      appStore.state.settingsCollapsed = !appStore.state.settingsCollapsed;
      syncSettingsPanel();
      appStore.saveSettings();
    });
  }

  return {
    syncSettingsPanel,
    updateCasePickerFilter,
    updateCasePickerTags,
    renderSelection,
    applySelection,
    toggleGroup,
    toggleCase,
    buildCasePicker
  };
}
