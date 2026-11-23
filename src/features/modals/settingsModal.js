// Unified Settings Modal (Theme, Orientation/AUF/Hint toggles, 2x2 Layer & 3x3 Cross Faces, Color Palette, Bluetooth reset)

import {
  DEFAULT_CUBE_COLORS,
  CUBE_COLORS,
  setCustomCubeColors,
  applyCubeColorsToCss,
  clearSvgCache,
  applyColorsTo3DCube
} from '../../caseVisualizer.js';
import { sanitizeHexColor } from '../../state/appStore.js';
import { ALL_SOLVER_FACES } from '../solve/solverWidgetsView.js';

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
  const resetColorsBtn = typeof document !== "undefined" ? document.getElementById("resetColorsBtn") : null;
  const resetBtBtn = typeof document !== "undefined" ? document.getElementById("settingsResetBtBtn") : null;
  const openWizardBtn = typeof document !== "undefined" ? document.getElementById("settingsOpenWizardBtn") : null;
  const openShortcutsBtn = typeof document !== "undefined" ? document.getElementById("settingsOpenShortcutsBtn") : null;

  const settingsShowTooltips = typeof document !== "undefined" ? document.getElementById("settingsShowTooltips") : null;
  const settingsDarkTheme = typeof document !== "undefined" ? document.getElementById("settingsDarkTheme") : null;
  const settingsAlwaysWhiteBottom = typeof document !== "undefined" ? document.getElementById("settingsAlwaysWhiteBottom") : null;
  const settingsAllowAUF = typeof document !== "undefined" ? document.getElementById("settingsAllowAUF") : null;
  const settingsShowReflection = typeof document !== "undefined" ? document.getElementById("settingsShowReflection") : null;
  const settingsOhHandLeftBtn = typeof document !== "undefined" ? document.getElementById("settingsOhHandLeftBtn") : null;
  const settingsOhHandRightBtn = typeof document !== "undefined" ? document.getElementById("settingsOhHandRightBtn") : null;
  const settingsOhTableOnBtn = typeof document !== "undefined" ? document.getElementById("settingsOhTableOnBtn") : null;
  const settingsOhTableOffBtn = typeof document !== "undefined" ? document.getElementById("settingsOhTableOffBtn") : null;
  const settingsSpeedBtns = typeof document !== "undefined" ? Array.from(document.querySelectorAll(".settings-speed-btn")) : [];

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
    if (settingsDarkTheme) settingsDarkTheme.checked = s.darkMode;
    if (settingsAlwaysWhiteBottom) settingsAlwaysWhiteBottom.checked = s.alwaysWhiteBottom;
    if (settingsAllowAUF) settingsAllowAUF.checked = s.allowAUF;
    if (settingsShowReflection) settingsShowReflection.checked = s.showReflection;
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
  }

  function refreshActiveViews() {
    clearSvgCache();
    applyColorsTo3DCube(cubeStage?.getDisplay?.());
    const sv = getStudyView();
    if (sv?.activeDisplay3d) {
      applyColorsTo3DCube(sv.activeDisplay3d);
    }
    if (appStore.state.mode === "study") sv?.render?.();
    else if (appStore.state.mode === "practice") getPracticeView()?.render?.();
  }

  function renderColorPickers() {
    if (!colorPickerGrid) return;
    colorPickerGrid.innerHTML = COLOR_CONFIG.map(item => {
      const val = sanitizeHexColor(CUBE_COLORS[item.key]) || "#ffffff";
      return `
        <div class="color-picker-row" data-color-key="${item.key}">
          <span class="color-picker-swatch" style="background: ${val};" data-swatch="${item.key}"></span>
          <span class="color-picker-label">${item.label}</span>
          <input type="color" class="color-picker-input-native" value="${val}" data-native-key="${item.key}" aria-label="Pick ${item.label}">
          <input type="text" class="color-picker-input-hex" value="${val.toUpperCase()}" maxlength="7" data-hex-key="${item.key}" aria-label="Hex for ${item.label}">
        </div>
      `;
    }).join("");

    colorPickerGrid.querySelectorAll(".color-picker-row").forEach(row => {
      const key = row.dataset.colorKey;
      const nativeInput = row.querySelector(".color-picker-input-native");
      const hexInput = row.querySelector(".color-picker-input-hex");
      const swatch = row.querySelector(".color-picker-swatch");

      const updateColor = (hex) => {
        const clean = sanitizeHexColor(hex);
        if (!clean) return;
        setCustomCubeColors({ [key]: clean });
        applyCubeColorsToCss(CUBE_COLORS);
        if (swatch) swatch.style.background = clean;
        if (nativeInput) nativeInput.value = clean;
        if (hexInput) hexInput.value = clean.toUpperCase();
        appStore.saveSettings();
        refreshActiveViews();
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
        nativeInput.addEventListener("input", (e) => { setPickingColor(true); updateColor(e.target.value); });
        nativeInput.addEventListener("change", (e) => { updateColor(e.target.value); setPickingColor(false); });
        nativeInput.addEventListener("cancel", () => setPickingColor(false));
        nativeInput.addEventListener("close", () => setPickingColor(false));
        nativeInput.addEventListener("blur", scheduleBlurClose);
      }

      if (hexInput) {
        hexInput.addEventListener("focus", () => { setPickingColor(true); hexInput.select(); });
        hexInput.addEventListener("input", (e) => {
          let val = e.target.value.trim();
          if (!val.startsWith("#") && /^[0-9A-Fa-f]{6}$/.test(val)) val = "#" + val;
          if (sanitizeHexColor(val)) updateColor(val);
        });
        hexInput.addEventListener("change", (e) => {
          let val = e.target.value.trim();
          if (!val.startsWith("#")) val = "#" + val;
          if (sanitizeHexColor(val)) updateColor(val);
          else hexInput.value = (CUBE_COLORS[key] || "#ffffff").toUpperCase();
          setPickingColor(false);
        });
        hexInput.addEventListener("keydown", (e) => {
          if (e.key === "Enter" || e.key === "Escape") hexInput.blur();
        });
        hexInput.addEventListener("blur", scheduleBlurClose);
      }
    });
  }

  function open() {
    if (!modal) return;
    setPickingColor(false);
    renderColorPickers();
    renderToggles();
    solverWidgets?.updateFaceChipsUI?.();
    solverWidgets?.updateCrossFacesUI?.();
    getCloudSyncCtrl()?.render?.();
    modalManager.open(modal, {
      initialFocus: closeBtn,
      onClose: () => {
        setPickingColor(false);
        appStore.saveSettings();
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

    document.querySelectorAll(".settings-presets-row .preset-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        setPickingColor(false);
        const preset = COLOR_PRESETS[btn.dataset.preset];
        if (preset) {
          setCustomCubeColors(preset);
          applyCubeColorsToCss(CUBE_COLORS);
          renderColorPickers();
          appStore.saveSettings();
          refreshActiveViews();
        }
      });
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
    renderColorPickers();
    appStore.saveSettings();
    refreshActiveViews();
  });

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
    if (evt === "theme" || evt === "ohHand" || evt === "ohTableAbuse" || evt === "simSpeed") renderToggles();
    else if (evt === "hydrate") {
      renderColorPickers();
      renderToggles();
      solverWidgets?.updateFaceChipsUI?.();
      solverWidgets?.updateCrossFacesUI?.();
    }
  });

  return {
    open,
    close,
    renderToggles,
    refreshActiveViews
  };
}
