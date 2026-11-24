// Unified Settings Modal (Theme, Orientation/AUF/Hint toggles, 2x2 Layer & 3x3 Cross Faces, Color Palette, Bluetooth reset)

import {
  DEFAULT_CUBE_COLORS,
  CUBE_COLORS,
  setCustomCubeColors,
  applyCubeColorsToCss,
  clearSvgCache,
  applyColorsTo3DCube
} from '../../caseVisualizer.js';
import { PUZZLES, CUSTOM_EVENT_SCRAMBLE_LABELS } from '../../data/algRegistry.js';
import { sanitizeHexColor, isTimerViewMode, DEFAULT_VISIBLE_EVENTS, ALL_BUILTIN_EVENT_IDS } from '../../state/appStore.js';
import {
  DEFAULT_THEME_COLORS,
  THEME_COLOR_FIELDS,
  THEME_COLOR_PRESETS,
  sanitizeThemeHex,
  sanitizeThemeColors
} from '../../services/themeColors.js';
import { escapeHtml } from '../../services/htmlUtils.js';
import { ALL_SOLVER_FACES } from '../solve/solverWidgetsView.js';
import { showToast } from '../../ui/toastService.js';

const COLOR_CONFIG = [
  { key: "yellow", label: "Yellow (Top)" },
  { key: "white",  label: "White (Bottom)" },
  { key: "green",  label: "Green (Front)" },
  { key: "blue",   label: "Blue (Back)" },
  { key: "red",    label: "Red (Right)" },
  { key: "orange", label: "Orange (Left)" },
  { key: "slate",  label: "Neutral Slate (OLL/Mask)" }
];

const COLOR_PRESETS = {
  bright: { ...DEFAULT_CUBE_COLORS },
  fluro: {
    white:  "#ffffff",
    yellow: "#ffea00",
    green:  "#00ff66",
    blue:   "#0070f3",
    red:    "#ff1744",
    orange: "#ff6600",
    slate:  "#374151"
  },
  matte: {
    white:  "#ffffff",
    yellow: "#ffd500",
    green:  "#009b48",
    blue:   "#0046ad",
    red:    "#b71234",
    orange: "#ff5800",
    slate:  "#374151"
  }
};

export function createSettingsModalController({
  appStore,
  modalManager,
  cubeStage,
  solverWidgets,
  getStudyView = () => null,
  getPracticeView = () => null,
  getNavCtrl = () => null,
  getSmartCubeCtrl = () => null,
  getCloudSyncCtrl = () => null,
  onOpenWizard = null,
  onOpenShortcuts = null,
  onTooltipsChange = null
} = {}) {
  const modal = typeof document !== "undefined" ? document.getElementById("settingsModal") : null;
  const settingsBtn = typeof document !== "undefined" ? document.getElementById("settingsBtn") : null;
  const closeBtn = typeof document !== "undefined" ? document.getElementById("settingsModalCloseBtn") : null;
  const doneBtn = typeof document !== "undefined" ? document.getElementById("settingsDoneBtn") : null;
  const colorPickerGrid = typeof document !== "undefined" ? document.getElementById("colorPickerGrid") : null;
  const lightThemeColorGrid = typeof document !== "undefined" ? document.getElementById("lightThemeColorGrid") : null;
  const darkThemeColorGrid = typeof document !== "undefined" ? document.getElementById("darkThemeColorGrid") : null;
  const bldColorGrid = typeof document !== "undefined" ? document.getElementById("bldColorGrid") : null;
  const resetColorsBtn = typeof document !== "undefined" ? document.getElementById("resetColorsBtn") : null;
  const resetLightThemeBtn = typeof document !== "undefined" ? document.getElementById("resetLightThemeBtn") : null;
  const resetDarkThemeBtn = typeof document !== "undefined" ? document.getElementById("resetDarkThemeBtn") : null;
  const resetBldColorsBtn = typeof document !== "undefined" ? document.getElementById("resetBldColorsBtn") : null;
  const previewLightThemeBtn = typeof document !== "undefined" ? document.getElementById("previewLightThemeBtn") : null;
  const previewDarkThemeBtn = typeof document !== "undefined" ? document.getElementById("previewDarkThemeBtn") : null;
  const resetBtBtn = typeof document !== "undefined" ? document.getElementById("settingsResetBtBtn") : null;
  const openWizardBtn = typeof document !== "undefined" ? document.getElementById("settingsOpenWizardBtn") : null;
  const openShortcutsBtn = typeof document !== "undefined" ? document.getElementById("settingsOpenShortcutsBtn") : null;

  const settingsShowTooltips = typeof document !== "undefined" ? document.getElementById("settingsShowTooltips") : null;
  const settingsStatsModeNoneBtn = typeof document !== "undefined" ? document.getElementById("settingsStatsModeNoneBtn") : null;
  const settingsStatsModeBasicBtn = typeof document !== "undefined" ? document.getElementById("settingsStatsModeBasicBtn") : null;
  const settingsStatsModeAdvancedBtn = typeof document !== "undefined" ? document.getElementById("settingsStatsModeAdvancedBtn") : null;
  const settingsStatsVisAlwaysBtn = typeof document !== "undefined" ? document.getElementById("settingsStatsVisAlwaysBtn") : null;
  const settingsStatsVisSolveBtn = typeof document !== "undefined" ? document.getElementById("settingsStatsVisSolveBtn") : null;
  const settingsStatsVisHiddenBtn = typeof document !== "undefined" ? document.getElementById("settingsStatsVisHiddenBtn") : null;
  const settingsOllModeFullBtn = typeof document !== "undefined" ? document.getElementById("settingsOllModeFullBtn") : null;
  const settingsOllMode2LookBtn = typeof document !== "undefined" ? document.getElementById("settingsOllMode2LookBtn") : null;
  const settingsPllModeFullBtn = typeof document !== "undefined" ? document.getElementById("settingsPllModeFullBtn") : null;
  const settingsPllMode2LookBtn = typeof document !== "undefined" ? document.getElementById("settingsPllMode2LookBtn") : null;
  const settingsFocusMode = typeof document !== "undefined" ? document.getElementById("settingsFocusMode") : null;
  const settingsDesktopMultiPane = typeof document !== "undefined" ? document.getElementById("settingsDesktopMultiPane") : null;
  const settingsShowLayerWidget = typeof document !== "undefined" ? document.getElementById("settingsShowLayerWidget") : null;
  const settingsShowCrossWidget = typeof document !== "undefined" ? document.getElementById("settingsShowCrossWidget") : null;
  const settingsSolveShowCube = typeof document !== "undefined" ? document.getElementById("settingsSolveShowCube") : null;
  const settingsSolveInspection = typeof document !== "undefined" ? document.getElementById("settingsSolveInspection") : null;
  const settingsInspectionAudioBtns = typeof document !== "undefined" ? document.querySelectorAll("[data-inspection-audio]") : [];
  const settingsShowFreeFaceTurns = typeof document !== "undefined" ? document.getElementById("settingsShowFreeFaceTurns") : null;
  const settingsDarkTheme = typeof document !== "undefined" ? document.getElementById("settingsDarkTheme") : null;
  const settingsAlwaysWhiteBottom = typeof document !== "undefined" ? document.getElementById("settingsAlwaysWhiteBottom") : null;
  const settingsAllowAUF = typeof document !== "undefined" ? document.getElementById("settingsAllowAUF") : null;
  const settingsShowReflection = typeof document !== "undefined" ? document.getElementById("settingsShowReflection") : null;
  const settingsPauseAlertEnabled = typeof document !== "undefined" ? document.getElementById("settingsPauseAlertEnabled") : null;
  const settingsMetronomeEnabled = typeof document !== "undefined" ? document.getElementById("settingsMetronomeEnabled") : null;
  const settingsMetronomeBpm = typeof document !== "undefined" ? document.getElementById("settingsMetronomeBpm") : null;
  const settingsMetronomeBpmLabel = typeof document !== "undefined" ? document.getElementById("settingsMetronomeBpmLabel") : null;
  const settingsEventsGrid = typeof document !== "undefined" ? document.getElementById("settingsEventsGrid") : null;
  const settingsEventsCoreBtn = typeof document !== "undefined" ? document.getElementById("settingsEventsCoreBtn") : null;
  const settingsEventsAllBtn = typeof document !== "undefined" ? document.getElementById("settingsEventsAllBtn") : null;
  const settingsCustomEventName = typeof document !== "undefined" ? document.getElementById("settingsCustomEventName") : null;
  const settingsCustomEventScramble = typeof document !== "undefined" ? document.getElementById("settingsCustomEventScramble") : null;
  const settingsAddCustomEventBtn = typeof document !== "undefined" ? document.getElementById("settingsAddCustomEventBtn") : null;
  const settingsCustomEventsList = typeof document !== "undefined" ? document.getElementById("settingsCustomEventsList") : null;
  const settingsNavBtns = typeof document !== "undefined" ? Array.from(document.querySelectorAll("[data-settings-tab]")) : [];
  const settingsTabPanels = typeof document !== "undefined" ? Array.from(document.querySelectorAll("[data-settings-panel]")) : [];
  let activeTab = "general";

  function setActiveTab(tabId = "general") {
    activeTab = tabId || "general";
    settingsNavBtns.forEach(btn => {
      const active = btn.dataset.settingsTab === activeTab;
      btn.classList.toggle("active", active);
      btn.setAttribute("aria-selected", String(active));
    });
    settingsTabPanels.forEach(panel => {
      panel.hidden = panel.dataset.settingsPanel !== activeTab;
    });
  }
  const settingsOhHandLeftBtn = typeof document !== "undefined" ? document.getElementById("settingsOhHandLeftBtn") : null;
  const settingsOhHandRightBtn = typeof document !== "undefined" ? document.getElementById("settingsOhHandRightBtn") : null;
  const settingsOhTableOnBtn = typeof document !== "undefined" ? document.getElementById("settingsOhTableOnBtn") : null;
  const settingsOhTableOffBtn = typeof document !== "undefined" ? document.getElementById("settingsOhTableOffBtn") : null;
  const settingsSpeedBtns = typeof document !== "undefined" ? Array.from(document.querySelectorAll(".settings-speed-btn[data-settings-speed]")) : [];

  function setPickingColor(isPicking) {
    if (!modal) return;
    modal.classList.toggle("picking-color", Boolean(isPicking));
  }

  function renderToggles() {
    const s = appStore.state;
    if (typeof document !== "undefined") {
      document.getElementById("toggleDarkMode")?.setAttribute("aria-pressed", String(s.darkMode));
      document.getElementById("toggleAlwaysWhiteBottom")?.setAttribute("aria-pressed", String(s.alwaysWhiteBottom));
      document.getElementById("toggleAllowAUF")?.setAttribute("aria-pressed", String(s.allowAUF));
      document.getElementById("toggleShowReflection")?.setAttribute("aria-pressed", String(s.showReflection));
    }
    if (settingsShowTooltips) settingsShowTooltips.checked = Boolean(s.showTooltips);
    const statsMode = s.statsDisplayMode || (s.showStatsPanel === false ? "none" : (s.advancedMode ? "advanced" : "basic"));
    if (settingsStatsModeNoneBtn) {
      const isNone = statsMode === "none";
      settingsStatsModeNoneBtn.classList.toggle("active", isNone);
      settingsStatsModeNoneBtn.setAttribute("aria-pressed", String(isNone));
    }
    if (settingsStatsModeBasicBtn) {
      const isBasic = statsMode === "basic";
      settingsStatsModeBasicBtn.classList.toggle("active", isBasic);
      settingsStatsModeBasicBtn.setAttribute("aria-pressed", String(isBasic));
    }
    if (settingsStatsModeAdvancedBtn) {
      const isAdv = statsMode === "advanced";
      settingsStatsModeAdvancedBtn.classList.toggle("active", isAdv);
      settingsStatsModeAdvancedBtn.setAttribute("aria-pressed", String(isAdv));
    }
    const panelVis = s.statsPanelVisibility || (s.showStatsPanel === false ? "hidden" : "always");
    if (settingsStatsVisAlwaysBtn) {
      const active = panelVis === "always";
      settingsStatsVisAlwaysBtn.classList.toggle("active", active);
      settingsStatsVisAlwaysBtn.setAttribute("aria-pressed", String(active));
    }
    if (settingsStatsVisSolveBtn) {
      const active = panelVis === "solve-only";
      settingsStatsVisSolveBtn.classList.toggle("active", active);
      settingsStatsVisSolveBtn.setAttribute("aria-pressed", String(active));
    }
    if (settingsStatsVisHiddenBtn) {
      const active = panelVis === "hidden";
      settingsStatsVisHiddenBtn.classList.toggle("active", active);
      settingsStatsVisHiddenBtn.setAttribute("aria-pressed", String(active));
    }
    const ollMode = s.ollMode || (s.llAnalyticsMode === "2look" ? "2look" : "full");
    const is2LookOll = ollMode === "2look";
    if (settingsOllModeFullBtn) {
      settingsOllModeFullBtn.classList.toggle("active", !is2LookOll);
      settingsOllModeFullBtn.setAttribute("aria-pressed", String(!is2LookOll));
    }
    if (settingsOllMode2LookBtn) {
      settingsOllMode2LookBtn.classList.toggle("active", is2LookOll);
      settingsOllMode2LookBtn.setAttribute("aria-pressed", String(is2LookOll));
    }
    const pllMode = s.pllMode || (s.llAnalyticsMode === "2look" ? "2look" : "full");
    const is2LookPll = pllMode === "2look";
    if (settingsPllModeFullBtn) {
      settingsPllModeFullBtn.classList.toggle("active", !is2LookPll);
      settingsPllModeFullBtn.setAttribute("aria-pressed", String(!is2LookPll));
    }
    if (settingsPllMode2LookBtn) {
      settingsPllMode2LookBtn.classList.toggle("active", is2LookPll);
      settingsPllMode2LookBtn.setAttribute("aria-pressed", String(is2LookPll));
    }
    if (settingsFocusMode) settingsFocusMode.checked = Boolean(s.focusMode);
    if (settingsDesktopMultiPane) settingsDesktopMultiPane.checked = s.desktopMultiPane !== false;
    if (settingsShowLayerWidget) settingsShowLayerWidget.checked = s.showLayerSolutionsWidget !== false;
    if (settingsShowCrossWidget) settingsShowCrossWidget.checked = s.showCrossSolutionsWidget !== false;
    if (settingsSolveShowCube) settingsSolveShowCube.checked = Boolean(s.solveShowCube);
    if (settingsSolveInspection) settingsSolveInspection.checked = Boolean(s.solveInspection);
    const inspectionAudioMode = s.inspectionAudioMode || "voice";
    settingsInspectionAudioBtns.forEach(btn => {
      const isMatch = btn.dataset.inspectionAudio === inspectionAudioMode;
      btn.classList.toggle("active", isMatch);
      btn.setAttribute("aria-pressed", String(isMatch));
    });
    if (settingsShowFreeFaceTurns) settingsShowFreeFaceTurns.checked = Boolean(s.showFreeFaceTurns);
    if (settingsDarkTheme) settingsDarkTheme.checked = s.darkMode;
    if (settingsAlwaysWhiteBottom) settingsAlwaysWhiteBottom.checked = s.alwaysWhiteBottom;
    if (settingsAllowAUF) settingsAllowAUF.checked = s.allowAUF;
    if (settingsShowReflection) settingsShowReflection.checked = s.showReflection;
    if (settingsPauseAlertEnabled) settingsPauseAlertEnabled.checked = Boolean(s.pauseAlertEnabled);
    if (settingsMetronomeEnabled) settingsMetronomeEnabled.checked = Boolean(s.metronomeEnabled);
    const bpm = Number(s.metronomeBpm) || 180;
    if (settingsMetronomeBpm) settingsMetronomeBpm.value = String(bpm);
    if (settingsMetronomeBpmLabel) {
      settingsMetronomeBpmLabel.textContent = `${bpm} BPM (${(bpm / 60).toFixed(1)} TPS)`;
    }
    renderEventsGrid();
    const isRight = s.ohHand === "right";
    if (settingsOhHandLeftBtn) {
      settingsOhHandLeftBtn.classList.toggle("active", !isRight);
      settingsOhHandLeftBtn.setAttribute("aria-pressed", String(!isRight));
    }
    if (settingsOhHandRightBtn) {
      settingsOhHandRightBtn.classList.toggle("active", isRight);
      settingsOhHandRightBtn.setAttribute("aria-pressed", String(isRight));
    }
    const useTable = s.ohTableAbuse !== false;
    if (settingsOhTableOnBtn) {
      settingsOhTableOnBtn.classList.toggle("active", useTable);
      settingsOhTableOnBtn.setAttribute("aria-pressed", String(useTable));
    }
    if (settingsOhTableOffBtn) {
      settingsOhTableOffBtn.classList.toggle("active", !useTable);
      settingsOhTableOffBtn.setAttribute("aria-pressed", String(!useTable));
    }
    const activeSpeed = Number(s.simSpeed ?? 1);
    settingsSpeedBtns.forEach(btn => {
      const match = parseFloat(btn.dataset.settingsSpeed) === activeSpeed;
      btn.classList.toggle("active", match);
      btn.setAttribute("aria-pressed", String(match));
    });
    syncThemePreviewButtons();
  }

  let saveDebounceTimer = null;
  let saveDirty = false;
  let refreshRafId = null;

  function scheduleSaveSettings() {
    saveDirty = true;
    if (saveDebounceTimer) clearTimeout(saveDebounceTimer);
    saveDebounceTimer = setTimeout(() => {
      saveDebounceTimer = null;
      if (saveDirty) {
        saveDirty = false;
        appStore.saveSettings();
      }
    }, 180);
  }

  function flushSaveSettings({ force = false } = {}) {
    if (saveDebounceTimer) {
      clearTimeout(saveDebounceTimer);
      saveDebounceTimer = null;
    }
    if (saveDirty || force) {
      saveDirty = false;
      appStore.saveSettings();
    }
  }

  function refreshActiveViews() {
    if (refreshRafId != null && typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(refreshRafId);
      refreshRafId = null;
    }
    clearSvgCache();
    applyColorsTo3DCube(cubeStage?.getDisplay?.());
    const sv = getStudyView();
    if (sv?.activeDisplay3d) {
      applyColorsTo3DCube(sv.activeDisplay3d);
    }
    if (appStore.state.mode === "study") sv?.render?.();
    else if (appStore.state.mode === "practice" && !isTimerViewMode(appStore.state)) getPracticeView()?.render?.();
  }

  function scheduleRefreshActiveViews() {
    if (typeof requestAnimationFrame !== "function") {
      refreshActiveViews();
      return;
    }
    if (refreshRafId != null) return;
    refreshRafId = requestAnimationFrame(() => {
      refreshRafId = null;
      refreshActiveViews();
    });
  }

  function syncThemePreviewButtons() {
    const isDark = Boolean(appStore?.state?.darkMode);
    if (previewLightThemeBtn) {
      previewLightThemeBtn.classList.toggle("is-active", !isDark);
      previewLightThemeBtn.setAttribute("aria-pressed", String(!isDark));
      previewLightThemeBtn.textContent = !isDark ? "Active Theme" : "Switch to Light";
    }
    if (previewDarkThemeBtn) {
      previewDarkThemeBtn.classList.toggle("is-active", isDark);
      previewDarkThemeBtn.setAttribute("aria-pressed", String(isDark));
      previewDarkThemeBtn.textContent = isDark ? "Active Theme" : "Switch to Dark";
    }
  }

  function paletteMatches(currentMap, targetMap) {
    if (!currentMap || !targetMap) return false;
    return Object.entries(targetMap).every(([k, v]) => sanitizeThemeHex(currentMap[k]) === sanitizeThemeHex(v));
  }

  function syncColorPresetStates() {
    if (typeof document === "undefined") return;
    document.querySelectorAll("[data-preset]").forEach(btn => {
      const preset = COLOR_PRESETS[btn.dataset.preset];
      const match = paletteMatches(CUBE_COLORS, preset);
      btn.classList.toggle("active", match);
      btn.setAttribute("aria-pressed", String(match));
    });
    const currentTheme = sanitizeThemeColors(appStore?.state?.themeColors);
    document.querySelectorAll("[data-theme-preset]").forEach(btn => {
      const [section, presetKey] = String(btn.dataset.themePreset || "").split(":");
      const preset = THEME_COLOR_PRESETS[section]?.[presetKey];
      const match = paletteMatches(currentTheme[section], preset);
      btn.classList.toggle("active", match);
      btn.setAttribute("aria-pressed", String(match));
    });
  }

  function renderColorWidgetGrid(gridEl, fields, getHex, onLiveChange, { refreshViews = false } = {}) {
    if (!gridEl) return;
    gridEl.innerHTML = fields.map(item => {
      const val = sanitizeThemeHex(getHex(item.key)) || "#ffffff";
      return `
        <div class="color-picker-row" data-color-key="${item.key}">
          <span class="color-picker-swatch" style="background: ${val};" data-swatch="${item.key}"></span>
          <span class="color-picker-label">${escapeHtml(item.label)}</span>
          <input type="color" class="color-picker-input-native" value="${val}" data-native-key="${item.key}" aria-label="Pick ${escapeHtml(item.label)}">
          <input type="text" class="color-picker-input-hex" value="${val.toUpperCase()}" maxlength="7" data-hex-key="${item.key}" aria-label="Hex for ${escapeHtml(item.label)}">
        </div>
      `;
    }).join("");

    gridEl.querySelectorAll(".color-picker-row").forEach(row => {
      const key = row.dataset.colorKey;
      const nativeInput = row.querySelector(".color-picker-input-native");
      const hexInput = row.querySelector(".color-picker-input-hex");
      const swatch = row.querySelector(".color-picker-swatch");

      const applyColor = (rawHex, { commit = false } = {}) => {
        const clean = sanitizeThemeHex(rawHex);
        if (!clean) return false;
        onLiveChange(key, clean);
        if (swatch) swatch.style.background = clean;
        if (nativeInput) nativeInput.value = clean;
        if (hexInput && document.activeElement !== hexInput) {
          hexInput.value = clean.toUpperCase();
        }
        syncColorPresetStates();
        if (commit) {
          if (hexInput) hexInput.value = clean.toUpperCase();
          flushSaveSettings({ force: true });
          if (refreshViews) refreshActiveViews();
        } else {
          scheduleSaveSettings();
          if (refreshViews) scheduleRefreshActiveViews();
        }
        return true;
      };

      swatch?.addEventListener("click", () => {
        setPickingColor(true);
        if (typeof nativeInput?.showPicker === "function") {
          try { nativeInput.showPicker(); return; } catch {}
        }
        nativeInput?.click();
      });

      const scheduleBlurClose = () => {
        setTimeout(() => {
          const active = document.activeElement;
          if (active !== nativeInput && active !== hexInput) setPickingColor(false);
        }, 120);
      };

      if (nativeInput) {
        nativeInput.addEventListener("focus", () => setPickingColor(true));
        nativeInput.addEventListener("click", () => setPickingColor(true));
        nativeInput.addEventListener("input", (e) => { setPickingColor(true); applyColor(e.target.value, { commit: false }); });
        nativeInput.addEventListener("change", (e) => { applyColor(e.target.value, { commit: true }); setPickingColor(false); });
        nativeInput.addEventListener("cancel", () => setPickingColor(false));
        nativeInput.addEventListener("close", () => setPickingColor(false));
        nativeInput.addEventListener("blur", scheduleBlurClose);
      }

      if (hexInput) {
        hexInput.addEventListener("focus", () => { setPickingColor(true); hexInput.select(); });
        hexInput.addEventListener("input", (e) => {
          let val = e.target.value.trim();
          if (!val.startsWith("#") && /^[0-9A-Fa-f]{3}([0-9A-Fa-f]{3})?$/.test(val)) val = "#" + val;
          if (sanitizeThemeHex(val)) applyColor(val, { commit: false });
        });
        hexInput.addEventListener("change", (e) => {
          let val = e.target.value.trim();
          if (!val.startsWith("#")) val = "#" + val;
          if (!applyColor(val, { commit: true })) {
            const fallback = sanitizeThemeHex(getHex(key)) || "#ffffff";
            hexInput.value = fallback.toUpperCase();
          }
          setPickingColor(false);
        });
        hexInput.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === "Escape") hexInput.blur();
        });
        hexInput.addEventListener("blur", scheduleBlurClose);
      }
    });
  }

  function renderThemeSectionWidget(section, gridEl) {
    const fields = THEME_COLOR_FIELDS[section];
    if (!gridEl || !fields) return;
    renderColorWidgetGrid(
      gridEl,
      fields,
      (key) => appStore?.state?.themeColors?.[section]?.[key] || DEFAULT_THEME_COLORS[section][key],
      (key, clean) => appStore?.setThemeColors?.(section, { [key]: clean }, { save: false }),
      { refreshViews: false }
    );
  }

  function renderCubeColorsWidget() {
    renderColorWidgetGrid(
      colorPickerGrid,
      COLOR_CONFIG,
      (key) => sanitizeHexColor(CUBE_COLORS[key]) || DEFAULT_CUBE_COLORS[key] || "#ffffff",
      (key, clean) => {
        setCustomCubeColors({ [key]: clean });
        applyCubeColorsToCss(CUBE_COLORS);
      },
      { refreshViews: true }
    );
  }

  function renderColorPickers() {
    renderThemeSectionWidget("light", lightThemeColorGrid);
    renderThemeSectionWidget("dark", darkThemeColorGrid);
    renderCubeColorsWidget();
    renderThemeSectionWidget("bld", bldColorGrid);
    syncThemePreviewButtons();
    syncColorPresetStates();
  }

  function renderEventsGrid() {
    if (!settingsEventsGrid) return;
    const s = appStore.state;
    const visibleList = Array.isArray(s.visibleEvents) && s.visibleEvents.length
      ? s.visibleEvents
      : (s.showExtraWcaEvents ? ALL_BUILTIN_EVENT_IDS : DEFAULT_VISIBLE_EVENTS);
    const visibleSet = new Set(visibleList);
    const groups = [
      { label: "Core Cubes (Learn, Train, Solve)", ids: ["222", "333", "333oh", "444", "555"] },
      { label: "Big Cubes & FTO", ids: ["666", "777", "fto"] },
      { label: "WCA Side Events & BLD", ids: ["pyram", "skewb", "minx", "sq1", "clock", "333bf"] }
    ];
    settingsEventsGrid.innerHTML = groups.map(grp => `
      <div>
        <div class="settings-events-group-label">${escapeHtml(grp.label)}</div>
        <div class="settings-events-grid">
          ${grp.ids.filter(id => Boolean(PUZZLES[id])).map(id => {
            const p = PUZZLES[id];
            const checked = visibleSet.has(id);
            const title = p.shortName || p.name || id;
            return `
              <label class="settings-event-chip ${checked ? "is-checked" : ""}">
                <input type="checkbox" data-visible-event="${escapeHtml(id)}" ${checked ? "checked" : ""}>
                <span>${escapeHtml(title)}</span>
              </label>
            `;
          }).join("")}
        </div>
      </div>
    `).join("");
  }

  function renderCustomEvents() {
    if (!settingsCustomEventsList) return;
    const list = appStore.state.customEvents || [];
    if (!list.length) {
      settingsCustomEventsList.innerHTML = `<span class="settings-custom-events-empty">No custom events yet.</span>`;
      return;
    }
    settingsCustomEventsList.innerHTML = list.map(ev => {
      const scrLabel = CUSTOM_EVENT_SCRAMBLE_LABELS[ev.scrambleType] || ev.scrambleType || "No scramble";
      const isActive = appStore.state.currentPuzzle === ev.id;
      return `
        <div class="settings-custom-event-item ${isActive ? "active" : ""}" data-custom-event-id="${escapeHtml(ev.id)}">
          <div class="settings-custom-event-meta">
            <strong>${escapeHtml(ev.name)}</strong>
            <span class="settings-custom-event-badge">${escapeHtml(scrLabel)}</span>
          </div>
          <div class="settings-custom-event-actions">
            <button type="button" class="btn btn-xs settings-custom-event-use-btn" data-custom-event-id="${escapeHtml(ev.id)}">${isActive ? "Active" : "Select"}</button>
            <button type="button" class="btn btn-xs btn-danger settings-custom-event-del-btn" data-custom-event-id="${escapeHtml(ev.id)}" aria-label="Delete ${escapeHtml(ev.name)}">&times;</button>
          </div>
        </div>
      `;
    }).join("");
  }

  function open() {
    if (!modal) return;
    setPickingColor(false);
    setActiveTab(activeTab);
    renderColorPickers();
    renderToggles();
    renderCustomEvents();
    solverWidgets?.updateFaceChipsUI?.();
    solverWidgets?.updateCrossFacesUI?.();
    getCloudSyncCtrl()?.render?.();
    modalManager.open(modal, {
      initialFocus: closeBtn,
      onClose: () => {
        setPickingColor(false);
        flushSaveSettings({ force: true });
      }
    });
  }

  function close() {
    if (modal) modalManager.close(modal);
  }

  settingsBtn?.addEventListener("click", open);
  closeBtn?.addEventListener("click", close);
  doneBtn?.addEventListener("click", close);

  if (typeof document !== "undefined") {
    document.getElementById("settingsCrossFacesChips")?.addEventListener("click", (e) => {
      const face = e.target.closest(".face-chip")?.dataset.crossFace;
      if (face) solverWidgets?.toggleCrossTargetFace?.(face);
    });
    document.getElementById("crossPresetWhiteBtn")?.addEventListener("click", () => solverWidgets?.setCrossTargetFaces?.(["white"]));
    document.getElementById("crossPresetOppositeBtn")?.addEventListener("click", () => solverWidgets?.setCrossTargetFaces?.(["white", "yellow"]));
    document.getElementById("crossPresetAllBtn")?.addEventListener("click", () => solverWidgets?.setCrossTargetFaces?.(ALL_SOLVER_FACES));

    document.getElementById("settingsLayerFacesChips")?.addEventListener("click", (e) => {
      const face = e.target.closest(".face-chip")?.dataset.layerFace;
      if (face) solverWidgets?.toggleTargetFace?.(face);
    });
    document.getElementById("settingsLayerPresetWhiteBtn")?.addEventListener("click", () => solverWidgets?.setTargetFaces?.(["white"]));
    document.getElementById("settingsLayerPresetOppositeBtn")?.addEventListener("click", () => solverWidgets?.setTargetFaces?.(["white", "yellow"]));
    document.getElementById("settingsLayerPresetAllBtn")?.addEventListener("click", () => solverWidgets?.setTargetFaces?.(ALL_SOLVER_FACES));

    const sectionGrids = {
      light: lightThemeColorGrid,
      dark: darkThemeColorGrid,
      bld: bldColorGrid
    };

    document.querySelectorAll(".settings-presets-row [data-preset]").forEach(btn => {
      btn.addEventListener("click", () => {
        setPickingColor(false);
        const preset = COLOR_PRESETS[btn.dataset.preset];
        if (preset) {
          setCustomCubeColors(preset);
          applyCubeColorsToCss(CUBE_COLORS);
          renderCubeColorsWidget();
          syncColorPresetStates();
          flushSaveSettings({ force: true });
          refreshActiveViews();
        }
      });
    });

    document.querySelectorAll(".settings-presets-row [data-theme-preset]").forEach(btn => {
      btn.addEventListener("click", () => {
        setPickingColor(false);
        const [section, presetKey] = String(btn.dataset.themePreset || "").split(":");
        const preset = THEME_COLOR_PRESETS[section]?.[presetKey];
        if (!preset) return;
        appStore?.setThemeColors?.(section, preset, { save: true });
        renderThemeSectionWidget(section, sectionGrids[section]);
        syncColorPresetStates();
      });
    });

    previewLightThemeBtn?.addEventListener("click", () => {
      cubeStage?.setDarkMode?.(false);
      renderToggles();
    });
    previewDarkThemeBtn?.addEventListener("click", () => {
      cubeStage?.setDarkMode?.(true);
      renderToggles();
    });

    document.querySelectorAll(".switch").forEach(btn => {
      btn.addEventListener("click", () => {
        const key = btn.dataset.toggle;
        if (key === "darkMode") {
          cubeStage?.setDarkMode?.(!appStore.state.darkMode);
          return;
        }
        if (key === "alwaysWhiteBottom") appStore.state.alwaysWhiteBottom = !appStore.state.alwaysWhiteBottom;
        else if (key === "allowAUF") appStore.state.allowAUF = !appStore.state.allowAUF;
        else if (key === "showReflection") {
          appStore.state.showReflection = !appStore.state.showReflection;
          cubeStage?.applyReflection?.();
        }
        renderToggles();
        appStore.saveSettings();
        if (key !== "showReflection") {
          getNavCtrl()?.regenerateScramble?.();
          refreshActiveViews();
        }
      });
    });
  }

  resetColorsBtn?.addEventListener("click", () => {
    setPickingColor(false);
    setCustomCubeColors(DEFAULT_CUBE_COLORS);
    applyCubeColorsToCss(DEFAULT_CUBE_COLORS);
    renderCubeColorsWidget();
    syncColorPresetStates();
    flushSaveSettings({ force: true });
    refreshActiveViews();
  });

  const bindSectionReset = (btn, section, gridEl) => {
    btn?.addEventListener("click", () => {
      setPickingColor(false);
      appStore?.resetThemeColors?.(section);
      renderThemeSectionWidget(section, gridEl);
      syncColorPresetStates();
    });
  };
  bindSectionReset(resetLightThemeBtn, "light", lightThemeColorGrid);
  bindSectionReset(resetDarkThemeBtn, "dark", darkThemeColorGrid);
  bindSectionReset(resetBldColorsBtn, "bld", bldColorGrid);

  resetBtBtn?.addEventListener("click", () => {
    getSmartCubeCtrl()?.handleBluetoothReset?.();
  });

  openWizardBtn?.addEventListener("click", () => {
    close();
    onOpenWizard?.();
  });

  openShortcutsBtn?.addEventListener("click", () => {
    close();
    onOpenShortcuts?.();
  });

  settingsShowTooltips?.addEventListener("change", (e) => {
    appStore.state.showTooltips = Boolean(e.target.checked);
    renderToggles();
    appStore.saveSettings();
    onTooltipsChange?.(appStore.state.showTooltips);
  });

  settingsNavBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const tab = btn.dataset.settingsTab;
      if (tab) setActiveTab(tab);
    });
  });

  settingsStatsModeNoneBtn?.addEventListener("click", () => {
    appStore.setStatsDisplayMode?.("none");
    renderToggles();
  });
  settingsStatsModeBasicBtn?.addEventListener("click", () => {
    appStore.setStatsDisplayMode?.("basic");
    renderToggles();
  });
  settingsStatsModeAdvancedBtn?.addEventListener("click", () => {
    appStore.setStatsDisplayMode?.("advanced");
    renderToggles();
  });
  settingsStatsVisAlwaysBtn?.addEventListener("click", () => {
    appStore.setStatsPanelVisibility?.("always");
    renderToggles();
  });
  settingsStatsVisSolveBtn?.addEventListener("click", () => {
    appStore.setStatsPanelVisibility?.("solve-only");
    renderToggles();
  });
  settingsStatsVisHiddenBtn?.addEventListener("click", () => {
    appStore.setStatsPanelVisibility?.("hidden");
    renderToggles();
  });
  settingsOllModeFullBtn?.addEventListener("click", () => {
    appStore.setOllMode?.("full");
    renderToggles();
  });
  settingsOllMode2LookBtn?.addEventListener("click", () => {
    appStore.setOllMode?.("2look");
    renderToggles();
  });
  settingsPllModeFullBtn?.addEventListener("click", () => {
    appStore.setPllMode?.("full");
    renderToggles();
  });
  settingsPllMode2LookBtn?.addEventListener("click", () => {
    appStore.setPllMode?.("2look");
    renderToggles();
  });
  settingsFocusMode?.addEventListener("change", (e) => {
    const enabled = Boolean(e.target.checked);
    if (enabled && !isTimerViewMode(appStore.state)) {
      getNavCtrl()?.setMode?.("solve");
    }
    appStore.setFocusMode?.(enabled);
    renderToggles();
  });
  settingsDesktopMultiPane?.addEventListener("change", (e) => {
    appStore.setDesktopMultiPane?.(Boolean(e.target.checked));
    renderToggles();
  });
  settingsShowLayerWidget?.addEventListener("change", (e) => {
    const enabled = Boolean(e.target.checked);
    appStore.setWidgetVisibility?.("showLayerSolutionsWidget", enabled);
    if (enabled && appStore.state.currentPuzzle === "222") {
      const scr = appStore.state.currentSolveScramble || appStore.state.scrambleMoves || appStore.state.scramble;
      if (scr) solverWidgets?.updateLayerSolutions?.(scr);
    }
  });
  settingsShowCrossWidget?.addEventListener("change", (e) => {
    const enabled = Boolean(e.target.checked);
    appStore.setWidgetVisibility?.("showCrossSolutionsWidget", enabled);
    if (enabled && (appStore.state.currentPuzzle === "333" || appStore.state.currentPuzzle === "333oh")) {
      const scr = appStore.state.currentSolveScramble || appStore.state.scrambleMoves || appStore.state.scramble;
      if (scr) solverWidgets?.updateCrossSolutions?.(scr);
    }
  });
  settingsSolveShowCube?.addEventListener("change", (e) => {
    appStore.setSolveShowCube?.(Boolean(e.target.checked));
  });
  settingsSolveInspection?.addEventListener("change", (e) => {
    appStore.setSolveInspection?.(Boolean(e.target.checked));
  });
  settingsInspectionAudioBtns.forEach(btn => {
    btn?.addEventListener("click", () => {
      const mode = btn.dataset.inspectionAudio;
      if (!mode) return;
      appStore.setInspectionAudioMode?.(mode);
      renderToggles();
    });
  });
  settingsShowFreeFaceTurns?.addEventListener("change", (e) => {
    appStore.setWidgetVisibility?.("showFreeFaceTurns", Boolean(e.target.checked));
  });
  settingsDarkTheme?.addEventListener("change", (e) => {
    cubeStage?.setDarkMode?.(e.target.checked);
    renderToggles();
  });
  settingsAlwaysWhiteBottom?.addEventListener("change", (e) => {
    appStore.state.alwaysWhiteBottom = e.target.checked;
    renderToggles();
    appStore.saveSettings();
    getNavCtrl()?.regenerateScramble?.();
    refreshActiveViews();
  });
  settingsAllowAUF?.addEventListener("change", (e) => {
    appStore.state.allowAUF = e.target.checked;
    renderToggles();
    appStore.saveSettings();
    getNavCtrl()?.regenerateScramble?.();
  });
  settingsShowReflection?.addEventListener("change", (e) => {
    appStore.state.showReflection = e.target.checked;
    cubeStage?.applyReflection?.();
    renderToggles();
    appStore.saveSettings();
  });
  settingsPauseAlertEnabled?.addEventListener("change", (e) => {
    appStore.state.pauseAlertEnabled = Boolean(e.target.checked);
    renderToggles();
    appStore.saveSettings();
  });
  settingsMetronomeEnabled?.addEventListener("change", (e) => {
    appStore.state.metronomeEnabled = Boolean(e.target.checked);
    renderToggles();
    appStore.saveSettings();
  });
  settingsMetronomeBpm?.addEventListener("input", (e) => {
    const val = Math.max(60, Math.min(360, Number(e.target.value) || 180));
    appStore.state.metronomeBpm = val;
    if (settingsMetronomeBpmLabel) {
      settingsMetronomeBpmLabel.textContent = `${val} BPM (${(val / 60).toFixed(1)} TPS)`;
    }
    appStore.saveSettings();
  });
  settingsEventsGrid?.addEventListener("change", (e) => {
    const cb = e.target.closest("input[data-visible-event]");
    if (!cb) return;
    const evId = cb.dataset.visibleEvent;
    const ok = appStore.toggleVisibleEvent?.(evId, Boolean(cb.checked));
    if (!ok) {
      cb.checked = true;
      showToast("At least one event must stay visible in the header", "warning", 2200);
      return;
    }
    renderEventsGrid();
  });
  settingsEventsCoreBtn?.addEventListener("click", () => {
    appStore.setVisibleEvents?.(DEFAULT_VISIBLE_EVENTS);
    renderEventsGrid();
  });
  settingsEventsAllBtn?.addEventListener("click", () => {
    appStore.setVisibleEvents?.(ALL_BUILTIN_EVENT_IDS);
    renderEventsGrid();
  });

  const handleAddCustomEvent = () => {
    const rawName = settingsCustomEventName?.value?.trim();
    if (!rawName) return;
    const scrType = settingsCustomEventScramble?.value || "none";
    const created = appStore.addCustomEvent?.({
      name: rawName,
      shortName: rawName.slice(0, 10),
      scrambleType: scrType
    });
    if (created) {
      if (settingsCustomEventName) settingsCustomEventName.value = "";
      renderCustomEvents();
    }
  };

  settingsAddCustomEventBtn?.addEventListener("click", handleAddCustomEvent);
  settingsCustomEventName?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddCustomEvent();
    }
  });

  settingsCustomEventsList?.addEventListener("click", (e) => {
    const useBtn = e.target.closest(".settings-custom-event-use-btn");
    if (useBtn) {
      const evId = useBtn.dataset.customEventId;
      if (evId) {
        getNavCtrl()?.setPuzzle?.(evId);
        close();
      }
      return;
    }
    const delBtn = e.target.closest(".settings-custom-event-del-btn");
    if (delBtn) {
      const evId = delBtn.dataset.customEventId;
      if (!evId) return;
      const wasActive = appStore.state.currentPuzzle === evId;
      appStore.removeCustomEvent?.(evId);
      if (wasActive) {
        getNavCtrl()?.setPuzzle?.("333");
      }
      renderCustomEvents();
    }
  });

  [settingsOhHandLeftBtn, settingsOhHandRightBtn].forEach(btn => {
    btn?.addEventListener("click", () => {
      const next = btn.dataset.settingsOhHand;
      if (!next) return;
      appStore.setOhHand?.(next);
      renderToggles();
      refreshActiveViews();
    });
  });

  [settingsOhTableOnBtn, settingsOhTableOffBtn].forEach(btn => {
    btn?.addEventListener("click", () => {
      const next = btn.dataset.settingsOhTable;
      if (!next) return;
      appStore.setOhTableAbuse?.(next === "table");
      renderToggles();
      refreshActiveViews();
    });
  });

  settingsSpeedBtns.forEach(btn => {
    btn?.addEventListener("click", () => {
      const spd = parseFloat(btn.dataset.settingsSpeed);
      if (Number.isNaN(spd)) return;
      appStore.setSimSpeed?.(spd);
      renderToggles();
    });
  });

  appStore?.subscribe?.((evt) => {
    if (
      evt === "theme" ||
      evt === "ohHand" ||
      evt === "ohTableAbuse" ||
      evt === "simSpeed" ||
      evt === "advancedMode" ||
      evt === "llAnalyticsMode" ||
      evt === "desktopMultiPane" ||
      evt === "focusMode" ||
      evt === "widgetVisibility" ||
      evt === "solveOptions" ||
      evt === "inspectionAudioMode"
    ) {
      renderToggles();
    } else if (evt === "themeColors") {
      syncColorPresetStates();
    } else if (evt === "visibleEvents") {
      renderToggles();
      renderEventsGrid();
    } else if (evt === "customEvents") {
      renderCustomEvents();
    } else if (evt === "hydrate") {
      renderColorPickers();
      renderToggles();
      renderEventsGrid();
      renderCustomEvents();
      solverWidgets?.updateFaceChipsUI?.();
      solverWidgets?.updateCrossFacesUI?.();
    }
  });

  return {
    open,
    close,
    renderToggles,
    renderCustomEvents,
    refreshActiveViews
  };
}
