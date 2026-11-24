// Offline PWA Install Prompt & Settings Status Controller

export const PWA_DISMISS_STORAGE_KEY = "cubingPwaInstallDismissed";

/**
 * Return true when running inside an installed standalone PWA window.
 */
export function isStandaloneMode(win = globalThis.window, nav = globalThis.navigator) {
  try {
    if (win?.matchMedia?.("(display-mode: standalone)")?.matches) {
      return true;
    }
  } catch {}
  return nav?.standalone === true;
}

/**
 * Detect iOS / iPadOS Safari browsers that lack `beforeinstallprompt`.
 */
export function isIosSafari(nav = globalThis.navigator) {
  const ua = String(nav?.userAgent || "");
  if (!ua) return false;
  const maxTouchPoints = Number(nav?.maxTouchPoints || 0);
  const isAppleTouchDevice = /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && maxTouchPoints > 1);
  if (!isAppleTouchDevice) return false;
  return /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua);
}

function readDismissed(storage) {
  try {
    return storage?.getItem?.(PWA_DISMISS_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

function writeDismissed(storage) {
  try {
    storage?.setItem?.(PWA_DISMISS_STORAGE_KEY, "1");
  } catch {}
}

/**
 * Coordinate native PWA install prompts (`beforeinstallprompt`), iOS Safari
 * Add-to-Home-Screen hints, the dismissible footer pill, and the Settings row.
 */
export function createPwaInstallController({
  win = globalThis.window,
  doc = globalThis.document,
  nav = globalThis.navigator,
  storage = globalThis.localStorage,
  onToast = null
} = {}) {
  let deferredPrompt = null;
  let installedOverride = false;
  let initialized = false;

  function getEls() {
    return {
      bannerEl: doc?.getElementById?.("pwaInstallBanner") || null,
      pillBtn: doc?.getElementById?.("pwaInstallPillBtn") || null,
      dismissBtn: doc?.getElementById?.("pwaInstallDismissBtn") || null,
      settingsStatusEl: doc?.getElementById?.("settingsPwaStatus") || null,
      settingsInstallBtn: doc?.getElementById?.("settingsPwaInstallBtn") || null
    };
  }

  function getState() {
    if (installedOverride || isStandaloneMode(win, nav)) {
      return "installed";
    }
    if (deferredPrompt) {
      return "prompt-ready";
    }
    if (isIosSafari(nav)) {
      return "ios-safari";
    }
    return "browser-cache";
  }

  function updateUi() {
    const state = getState();
    const dismissed = readDismissed(storage);
    const { bannerEl, settingsStatusEl, settingsInstallBtn } = getEls();

    if (bannerEl) {
      const showBanner = (state === "prompt-ready" || state === "ios-safari") && !dismissed;
      bannerEl.hidden = !showBanner;
    }

    if (settingsInstallBtn) {
      settingsInstallBtn.hidden = state !== "prompt-ready";
    }

    if (settingsStatusEl) {
      if (state === "installed") {
        settingsStatusEl.textContent = "✓ Installed — ready for offline use";
      } else if (state === "prompt-ready") {
        settingsStatusEl.textContent = "Ready to install on this device for full offline use";
      } else if (state === "ios-safari") {
        settingsStatusEl.textContent = "In Safari, tap Share → Add to Home Screen to install offline";
      } else {
        settingsStatusEl.textContent =
          "Offline caching is active — use your browser's Install / Add to Home Screen menu to install";
      }
    }

    return state;
  }

  function dismissPill() {
    writeDismissed(storage);
    updateUi();
  }

  async function triggerInstall() {
    const state = getState();
    if (state === "prompt-ready" && deferredPrompt) {
      const promptEvent = deferredPrompt;
      deferredPrompt = null;
      let outcome = "dismissed";
      try {
        await promptEvent.prompt?.();
        const choice = await promptEvent.userChoice;
        outcome = choice?.outcome === "accepted" ? "accepted" : "dismissed";
        if (outcome === "accepted") {
          installedOverride = true;
          onToast?.("Cubing.cc installed for offline use!", "success", 3200);
        }
      } finally {
        updateUi();
      }
      return outcome;
    }

    if (state === "ios-safari") {
      onToast?.(
        "In Safari, tap Share → Add to Home Screen to install Cubing.cc offline.",
        "info",
        4500
      );
      return "ios-hint";
    }

    return state;
  }

  function init() {
    if (!initialized) {
      initialized = true;
      const { pillBtn, dismissBtn, settingsInstallBtn } = getEls();

      win?.addEventListener?.("beforeinstallprompt", (event) => {
        event?.preventDefault?.();
        deferredPrompt = event || null;
        updateUi();
      });

      win?.addEventListener?.("appinstalled", () => {
        deferredPrompt = null;
        installedOverride = true;
        updateUi();
      });

      try {
        const mql = win?.matchMedia?.("(display-mode: standalone)");
        mql?.addEventListener?.("change", () => {
          updateUi();
        });
      } catch {}

      pillBtn?.addEventListener?.("click", () => {
        void triggerInstall();
      });

      dismissBtn?.addEventListener?.("click", () => {
        dismissPill();
      });

      settingsInstallBtn?.addEventListener?.("click", () => {
        void triggerInstall();
      });
    }

    updateUi();
  }

  return {
    init,
    getState,
    triggerInstall,
    dismissPill,
    updateUi
  };
}
