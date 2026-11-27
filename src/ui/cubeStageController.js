// Main 3D cube display lifecycle, scramble application, camera reset, theme, and reflection facelets

import { ScrambleDisplay } from 'scramble-display';
import { applyColorsTo3DCube, ensure3x3FoundationOpaque } from '../caseVisualizer.js';
import { applyThemeColorsToCss } from '../services/themeColors.js';
import { smartCube } from '../smartCube.js';
import { PUZZLES } from '../data/algRegistry.js';

export function createCubeStageController({
  appStore,
  displayContainer,
  resetOrientationBtn = null,
  themeToggleBtn = null,
  onScrambleApplied = null,
  getStudyView = () => null
} = {}) {
  let el = null;
  let currentBaseDisplayScramble = "";
  let twoSidedLocked = false;
  let lockBadgeEl = null;

  function applyCameraPreset(latitude, longitude, distance = 6) {
    if (!el || !el.player) return;
    el.player.experimentalCurrentThreeJSPuzzleObject?.().then(p => {
      if (p) {
        p.quaternion.set(0, 0, 0, 1);
        p.rotation.set(0, 0, 0);
        p.scheduleRenderCallback?.();
      }
    }).catch(() => {});

    try {
      el.player.cameraLatitude = latitude;
      el.player.cameraLongitude = longitude;
      el.player.cameraDistance = distance;
    } catch {}

    try {
      if (el.player.experimentalModel?.twistySceneModel?.orbitCoordinatesRequest) {
        el.player.experimentalModel.twistySceneModel.orbitCoordinatesRequest.set("auto");
      }
    } catch {}
  }

  function updateTwoSidedLockOverlay() {
    if (!displayContainer || typeof document === "undefined") return;
    displayContainer.classList.toggle("is-twosided-locked", twoSidedLocked);
    if (twoSidedLocked) {
      if (!lockBadgeEl) {
        lockBadgeEl = document.createElement("div");
        lockBadgeEl.className = "twosided-lock-badge";
        lockBadgeEl.textContent = "2-Sided View Locked";
      }
      if (lockBadgeEl.parentNode !== displayContainer) {
        displayContainer.appendChild(lockBadgeEl);
      }
    } else if (lockBadgeEl && lockBadgeEl.parentNode) {
      lockBadgeEl.remove();
    }
  }

  function setTwoSidedCameraLock(enabled) {
    const next = Boolean(enabled);
    const changed = next !== twoSidedLocked;
    twoSidedLocked = next;
    updateTwoSidedLockOverlay();
    if (twoSidedLocked) {
      applyCameraPreset(25, 35, 6);
    } else if (changed) {
      applyCameraPreset(35, 30, 6);
    }
  }

  function applyTheme(dark = appStore.state.darkMode) {
    if (typeof document === "undefined") return;
    if (dark) {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }

    applyThemeColorsToCss(appStore?.state?.themeColors, Boolean(dark));

    const metaTheme = document.querySelector('meta[name="theme-color"]');
    if (metaTheme && !appStore?.state?.themeColors) {
      metaTheme.setAttribute("content", dark ? "#0f172a" : "#007bff");
    }

    if (themeToggleBtn) {
      themeToggleBtn.innerHTML = dark ? "☀️" : "🌙";
      themeToggleBtn.setAttribute("aria-label", dark ? "Switch to Light Theme" : "Switch to Dark Theme");
      themeToggleBtn.setAttribute("data-tooltip", dark ? "Switch to Light Theme" : "Switch to Dark Theme");
      themeToggleBtn.removeAttribute("title");
    }
    const toggleDark = document.getElementById("toggleDarkMode");
    if (toggleDark) {
      toggleDark.setAttribute("aria-pressed", String(Boolean(dark)));
    }
  }

  function setDarkMode(enabled) {
    appStore.state.darkMode = Boolean(enabled);
    applyTheme(appStore.state.darkMode);
    appStore.saveSettings();
    appStore.notify("theme", { darkMode: appStore.state.darkMode });
  }

  function applyReflection() {
    if (!el || !el.player) return;
    const showReflection = appStore.state.showReflection;
    try {
      el.player.hintFacelets = showReflection ? "floating" : "none";
      el.player.experimentalCurrentThreeJSPuzzleObject?.().then(p => {
        if (p && typeof p.updateMaterialArrays === "function") {
          p.updateMaterialArrays();
          p.scheduleRenderCallback?.();
        }
        applyColorsTo3DCube(el);
      }).catch(() => {});
    } catch (err) {
      console.warn("Could not update reflection facelets:", err);
    }
    getStudyView()?.applyReflection?.();
  }

  function mountScrambleDisplay(puzzleId = appStore.state.currentPuzzle) {
    if (!displayContainer) return null;
    displayContainer.innerHTML = "";
    const pDef = PUZZLES[puzzleId];
    if (pDef?.isCustomEvent && (!pDef.wcaEvent || pDef.wcaEvent === "none")) {
      el = null;
      return null;
    }
    const rawEvent = pDef?.isCustomEvent ? pDef.wcaEvent : puzzleId;
    el = new ScrambleDisplay();
    el.player.hintFacelets = appStore.state.showReflection ? "floating" : "none";
    el.event = rawEvent === "333oh" ? "333" : rawEvent;
    el.visualization = "3D";
    applyReflection();
    displayContainer.appendChild(el);
    applyColorsTo3DCube(el);
    updateTwoSidedLockOverlay();
    if (twoSidedLocked) {
      applyCameraPreset(25, 35, 6);
    }
    return el;
  }

  async function resetCubeOrientation() {
    if (!el || !el.player) return;
    if (twoSidedLocked) {
      applyCameraPreset(25, 35, 6);
    } else {
      applyCameraPreset(35, 30, 6);
    }
  }

  function clearViewRotations() {
    return resetCubeOrientation();
  }

  function applyScrambleToDisplay(scrambleString) {
    currentBaseDisplayScramble = scrambleString || "";
    onScrambleApplied?.(currentBaseDisplayScramble);
    if (smartCube) {
      smartCube.setScramble(currentBaseDisplayScramble, appStore.state.currentPuzzle);
    }
    if (!el) return;
    el.scramble = currentBaseDisplayScramble;
    if (el.player) {
      try {
        el.player.pause();
        if (el.player.experimentalModel?.catchUpMove) {
          el.player.experimentalModel.catchUpMove.set({ move: null, amount: 0 });
        }
        el.player.jumpToEnd();
      } catch {}
    }
    applyColorsTo3DCube(el);
  }

  if (resetOrientationBtn) {
    resetOrientationBtn.addEventListener("click", resetCubeOrientation);
  }
  if (themeToggleBtn) {
    themeToggleBtn.addEventListener("click", () => {
      setDarkMode(!appStore.state.darkMode);
    });
  }

  void ensure3x3FoundationOpaque();

  return {
    getDisplay: () => el,
    getBaseDisplayScramble: () => currentBaseDisplayScramble,
    setBaseDisplayScramble: (s) => { currentBaseDisplayScramble = s || ""; },
    mountScrambleDisplay,
    applyScrambleToDisplay,
    resetCubeOrientation,
    clearViewRotations,
    setTwoSidedCameraLock,
    applyReflection,
    applyTheme,
    setDarkMode
  };
}
