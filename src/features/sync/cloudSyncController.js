// Google Drive Cloud Sync UI Controller & Modal Bindings

import { showToast } from '../../ui/toastService.js';

function formatRelativeTime(ts) {
  if (!ts) return "";
  try {
    const diffSec = Math.max(0, Math.round((Date.now() - ts) / 1000));
    if (diffSec < 10) return "just now";
    if (diffSec < 60) return `${diffSec}s ago`;
    const diffMin = Math.round(diffSec / 60);
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.round(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return new Date(ts).toLocaleString();
  } catch {
    return "";
  }
}

export function formatMergeSummary(summary) {
  if (!summary || typeof summary !== "object") return "";
  const parts = [];
  if (summary.addedSolves > 0) parts.push(`+${summary.addedSolves} solve${summary.addedSolves === 1 ? "" : "s"}`);
  if (summary.addedSessions > 0) parts.push(`+${summary.addedSessions} session${summary.addedSessions === 1 ? "" : "s"}`);
  if (summary.updatedSettings > 0) parts.push(`${summary.updatedSettings} setting${summary.updatedSettings === 1 ? "" : "s"}`);
  if (summary.mergedStatsCases > 0) parts.push(`${summary.mergedStatsCases} stat${summary.mergedStatsCases === 1 ? "" : "s"}`);
  if (summary.mergedTags > 0) parts.push(`${summary.mergedTags} tag${summary.mergedTags === 1 ? "" : "s"}`);
  if (summary.mergedLabels > 0) parts.push(`${summary.mergedLabels} label${summary.mergedLabels === 1 ? "" : "s"}`);
  if (summary.mergedPreferredAlgs > 0) parts.push(`${summary.mergedPreferredAlgs} starred alg${summary.mergedPreferredAlgs === 1 ? "" : "s"}`);

  if (parts.length > 0) return `Merged ${parts.join(", ")}`;
  if (summary.uploadedSolves > 0) return `Backed up ${summary.uploadedSolves} solve${summary.uploadedSolves === 1 ? "" : "s"}`;
  return "Up to date";
}

export function createCloudSyncController({
  googleDriveSync,
  modalManager,
  onCloseSettingsModal = null
} = {}) {
  const headerBtn = typeof document !== "undefined" ? document.getElementById("cloudSyncBtn") : null;
  const headerDot = typeof document !== "undefined" ? document.getElementById("cloudSyncHeaderDot") : null;
  const headerAvatar = typeof document !== "undefined" ? document.getElementById("cloudSyncHeaderAvatar") : null;
  const headerIcon = typeof document !== "undefined" ? document.getElementById("cloudSyncHeaderIcon") : null;
  const headerLabel = typeof document !== "undefined" ? document.getElementById("cloudSyncHeaderLabel") : null;

  const settingsStatusEl = typeof document !== "undefined" ? document.getElementById("settingsCloudSyncStatus") : null;
  const settingsOpenBtn = typeof document !== "undefined" ? document.getElementById("settingsOpenCloudSyncBtn") : null;

  const modal = typeof document !== "undefined" ? document.getElementById("cloudSyncModal") : null;
  const closeBtn = typeof document !== "undefined" ? document.getElementById("cloudSyncModalCloseBtn") : null;
  const doneBtn = typeof document !== "undefined" ? document.getElementById("cloudSyncDoneBtn") : null;

  const accountCard = typeof document !== "undefined" ? document.getElementById("cloudSyncAccountCard") : null;
  const cardIcon = typeof document !== "undefined" ? document.getElementById("cloudSyncCardIcon") : null;
  const cardAvatar = typeof document !== "undefined" ? document.getElementById("cloudSyncCardAvatar") : null;
  const cardTitle = typeof document !== "undefined" ? document.getElementById("cloudSyncCardTitle") : null;
  const cardDesc = typeof document !== "undefined" ? document.getElementById("cloudSyncCardDesc") : null;
  const lastSyncedEl = typeof document !== "undefined" ? document.getElementById("cloudSyncLastSynced") : null;
  const summaryBadgeEl = typeof document !== "undefined" ? document.getElementById("cloudSyncSummaryBadge") : null;

  const errorBanner = typeof document !== "undefined" ? document.getElementById("cloudSyncErrorBanner") : null;
  const errorText = typeof document !== "undefined" ? document.getElementById("cloudSyncErrorText") : null;
  const errorDismissBtn = typeof document !== "undefined" ? document.getElementById("cloudSyncErrorDismissBtn") : null;

  const signInBtn = typeof document !== "undefined" ? document.getElementById("cloudSyncSignInBtn") : null;
  const syncNowBtn = typeof document !== "undefined" ? document.getElementById("cloudSyncNowBtn") : null;
  const signOutBtn = typeof document !== "undefined" ? document.getElementById("cloudSyncSignOutBtn") : null;
  const optionsBox = typeof document !== "undefined" ? document.getElementById("cloudSyncOptionsBox") : null;
  const autoToggle = typeof document !== "undefined" ? document.getElementById("cloudSyncAutoToggle") : null;

  const setupDetails = typeof document !== "undefined" ? document.getElementById("cloudSyncSetupDetails") : null;
  const clientIdInput = typeof document !== "undefined" ? document.getElementById("cloudSyncClientIdInput") : null;
  const clientIdSaveBtn = typeof document !== "undefined" ? document.getElementById("cloudSyncClientIdSaveBtn") : null;
  const clientIdResetBtn = typeof document !== "undefined" ? document.getElementById("cloudSyncClientIdResetBtn") : null;
  const clientIdHint = typeof document !== "undefined" ? document.getElementById("cloudSyncClientIdHint") : null;
  const originPreview = typeof document !== "undefined" ? document.getElementById("cloudSyncOriginPreview") : null;

  let dismissedError = false;
  let busy = false;

  function setBusy(nextBusy) {
    busy = Boolean(nextBusy);
    render(googleDriveSync.getState());
  }

  function render(state = googleDriveSync.getState()) {
    const statusClass = state.status === "needs_reauth"
      ? "needs-reauth"
      : state.status === "signed_out"
        ? "signed-out"
        : state.status === "idle"
          ? "synced"
          : state.status;

    if (headerDot) {
      headerDot.className = `sync-dot ${statusClass}`;
    }

    if (headerAvatar && headerIcon) {
      if (state.signedIn && state.account?.picture) {
        headerAvatar.src = state.account.picture;
        headerAvatar.hidden = false;
        headerIcon.hidden = true;
      } else {
        headerAvatar.hidden = true;
        headerIcon.hidden = false;
      }
    }

    if (headerLabel) {
      if (!state.signedIn) headerLabel.textContent = "Cloud Sync";
      else if (state.status === "syncing" || busy) headerLabel.textContent = "Syncing…";
      else if (state.status === "needs_reauth") headerLabel.textContent = "Reconnect";
      else if (state.status === "offline") headerLabel.textContent = "Offline";
      else if (state.status === "error") headerLabel.textContent = "Sync Error";
      else if (state.pendingChanges) headerLabel.textContent = "Pending…";
      else headerLabel.textContent = "Synced";
    }

    if (settingsStatusEl) {
      if (!state.signedIn) {
        settingsStatusEl.textContent = "Not signed in";
      } else {
        const rel = state.lastSyncedAt ? ` · Last synced ${formatRelativeTime(state.lastSyncedAt)}` : "";
        const stateTag = state.status === "needs_reauth"
          ? " (Reconnect needed)"
          : state.status === "offline"
            ? " (Offline)"
            : state.status === "error"
              ? " (Sync error)"
              : "";
        settingsStatusEl.textContent = `${state.account?.email || "Signed in"}${stateTag}${rel}`;
      }
    }

    if (accountCard) {
      accountCard.className = `sync-account-card ${statusClass}`;
    }

    if (cardAvatar && cardIcon) {
      if (state.signedIn && state.account?.picture) {
        cardAvatar.src = state.account.picture;
        cardAvatar.hidden = false;
        cardIcon.hidden = true;
      } else {
        cardAvatar.hidden = true;
        cardIcon.hidden = false;
      }
    }

    if (cardTitle) {
      if (!state.signedIn) {
        cardTitle.textContent = "Not signed in";
      } else {
        cardTitle.textContent = state.account?.name || state.account?.email || "Google Account";
      }
    }

    if (cardDesc) {
      if (!state.signedIn) {
        cardDesc.textContent = "Sign in with your Google account to save settings, sessions, solve logs, recognition stats, tags, custom labels, and preferred algorithms to your Google Drive.";
      } else if (state.status === "syncing" || busy) {
        cardDesc.textContent = `${state.account?.email} — Syncing and merging with Google Drive…`;
      } else if (state.status === "needs_reauth") {
        cardDesc.textContent = `${state.account?.email} — Session expired. Click Sync or Reconnect to resume Google Drive sync.`;
      } else if (state.status === "offline") {
        cardDesc.textContent = `${state.account?.email} — Offline. Changes are saved locally and will sync automatically when reconnected.`;
      } else if (state.pendingChanges) {
        cardDesc.textContent = `${state.account?.email} — Local changes queued for sync…`;
      } else {
        cardDesc.textContent = state.account?.email || "";
      }
    }

    if (lastSyncedEl) {
      if (state.signedIn && state.lastSyncedAt > 0) {
        lastSyncedEl.textContent = `Last synced ${formatRelativeTime(state.lastSyncedAt)}`;
        lastSyncedEl.hidden = false;
      } else {
        lastSyncedEl.hidden = true;
      }
    }

    if (summaryBadgeEl) {
      const summaryText = state.signedIn && state.lastSummary ? formatMergeSummary(state.lastSummary) : "";
      if (summaryText) {
        summaryBadgeEl.textContent = summaryText;
        summaryBadgeEl.hidden = false;
      } else {
        summaryBadgeEl.hidden = true;
      }
    }

    if (errorBanner && errorText) {
      if (state.lastError && !dismissedError) {
        errorText.textContent = state.lastError;
        errorBanner.hidden = false;
      } else {
        errorBanner.hidden = true;
      }
    }

    if (signInBtn) {
      if (!state.signedIn) {
        signInBtn.hidden = false;
        signInBtn.textContent = busy ? "Signing in…" : "Sign in with Google";
        signInBtn.disabled = busy || state.status === "syncing";
      } else if (state.status === "needs_reauth") {
        signInBtn.hidden = false;
        signInBtn.textContent = busy ? "Reconnecting…" : "Reconnect Google Account";
        signInBtn.disabled = busy || state.status === "syncing";
      } else {
        signInBtn.hidden = true;
      }
    }

    if (syncNowBtn) {
      syncNowBtn.hidden = !state.signedIn;
      syncNowBtn.disabled = busy || state.status === "syncing";
      syncNowBtn.textContent = state.status === "syncing" ? "Syncing…" : "↻ Sync & Merge Now";
    }

    if (signOutBtn) {
      signOutBtn.hidden = !state.signedIn;
      signOutBtn.disabled = busy || state.status === "syncing";
    }

    if (optionsBox) {
      optionsBox.hidden = !state.signedIn;
    }
    if (autoToggle) {
      autoToggle.checked = Boolean(state.autoSync);
    }

    if (clientIdInput && document.activeElement !== clientIdInput) {
      clientIdInput.value = state.storedClientId || "";
    }
    if (clientIdHint) {
      if (state.storedClientId) {
        clientIdHint.textContent = "Using custom Google OAuth Client ID saved in this browser.";
      } else if (state.hasEnvClientId) {
        clientIdHint.textContent = "Using pre-configured Client ID from build environment (VITE_GOOGLE_CLIENT_ID).";
      } else {
        clientIdHint.textContent = "No Google OAuth Client ID configured yet. Follow the 3 steps below to connect your own free Google Cloud project.";
      }
    }
    if (originPreview && typeof window !== "undefined") {
      originPreview.textContent = window.location.origin || "http://localhost:5173";
    }
  }

  function open() {
    if (!modal) return;
    dismissedError = false;
    const state = googleDriveSync.getState();
    if (setupDetails && !state.clientId) {
      setupDetails.open = true;
    }
    render(state);
    modalManager.open(modal, { initialFocus: closeBtn });
  }

  function close() {
    if (modal) modalManager.close(modal);
  }

  async function handleSignIn() {
    const state = googleDriveSync.getState();
    if (!state.clientId) {
      if (setupDetails) setupDetails.open = true;
      clientIdInput?.focus?.();
      showToast("Enter your Google OAuth Client ID first (see setup steps below).", "warning", 3800);
      return;
    }
    dismissedError = false;
    setBusy(true);
    try {
      const res = await googleDriveSync.signIn({ interactive: true });
      const summaryMsg = formatMergeSummary(res?.syncResult?.summary);
      if (res?.syncResult?.ok) {
        showToast(
          summaryMsg && summaryMsg !== "Up to date"
            ? `Signed in as ${res.account?.email} · ${summaryMsg}`
            : `Signed in and synced with Google Drive (${res.account?.email}).`,
          "success",
          3600
        );
      } else if (res?.syncResult?.error) {
        showToast(`Signed in, but sync failed: ${res.syncResult.error}`, "warning", 4000);
      }
    } catch (err) {
      dismissedError = false;
      showToast(err?.message || "Google sign-in failed.", "error", 3800);
    } finally {
      setBusy(false);
    }
  }

  async function handleSyncNow() {
    dismissedError = false;
    const res = await googleDriveSync.syncNow({ reason: "manual", interactive: true });
    if (res?.ok) {
      const msg = formatMergeSummary(res.summary);
      showToast(`Google Drive sync complete · ${msg}`, "success", 3200);
    } else if (res?.offline) {
      showToast("You are offline. Local changes will sync when back online.", "warning", 3200);
    } else if (res?.error) {
      showToast(res.error, "error", 3800);
    }
  }

  async function handleSignOut() {
    setBusy(true);
    try {
      await googleDriveSync.signOut();
      showToast("Signed out of Google Drive. All local data remains on this device.", "info", 3200);
    } finally {
      setBusy(false);
    }
  }

  headerBtn?.addEventListener("click", open);
  settingsOpenBtn?.addEventListener("click", () => {
    onCloseSettingsModal?.();
    open();
  });
  closeBtn?.addEventListener("click", close);
  doneBtn?.addEventListener("click", close);
  errorDismissBtn?.addEventListener("click", () => {
    dismissedError = true;
    render(googleDriveSync.getState());
  });

  signInBtn?.addEventListener("click", () => void handleSignIn());
  syncNowBtn?.addEventListener("click", () => void handleSyncNow());
  signOutBtn?.addEventListener("click", () => void handleSignOut());

  autoToggle?.addEventListener("change", (e) => {
    googleDriveSync.setAutoSync(Boolean(e.target.checked));
  });

  clientIdSaveBtn?.addEventListener("click", () => {
    const val = (clientIdInput?.value || "").trim();
    if (!val) {
      showToast("Please paste a Google OAuth Web Client ID.", "warning", 2800);
      clientIdInput?.focus?.();
      return;
    }
    googleDriveSync.setCustomClientId(val);
    showToast("Saved Google OAuth Client ID.", "success", 2400);
  });

  clientIdResetBtn?.addEventListener("click", () => {
    googleDriveSync.setCustomClientId("");
    if (clientIdInput) clientIdInput.value = "";
    showToast("Cleared custom Google OAuth Client ID.", "info", 2200);
  });

  googleDriveSync.subscribe((state) => {
    if (state.lastError) dismissedError = false;
    render(state);
  });

  render(googleDriveSync.getState());

  return {
    open,
    close,
    render
  };
}
