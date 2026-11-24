// Multi-Provider Cloud Sync UI Controller & Modal Bindings (Google Drive & Microsoft OneDrive)

import { showToast } from '../../ui/toastService.js';
import {
  loadActiveSyncProvider,
  saveActiveSyncProvider,
  exportLocalSyncPayload,
  parseBackupJson,
  importAndMergeBackup
} from '../../services/syncStorage.js';
import { getOneDriveRedirectUri } from '../../services/oneDriveSync.js';

const PROVIDER_UI = {
  google: {
    id: "google",
    label: "Google Drive",
    shortLabel: "Google Drive",
    accountTitleFallback: "Google Account",
    signedOutDesc:
      "Sign in with your Google account to save settings, sessions, solve logs, recognition stats, tags, custom labels, and preferred algorithms to your Google Drive.",
    syncingNoun: "Google Drive",
    signInLabel: "Sign in with Google",
    reconnectLabel: "Reconnect Google Account",
    signInFailedFallback: "Google sign-in failed.",
    signOutToast: "Signed out of Google Drive. All local data remains on this device.",
    privacyLead:
      "Stored privately in your Google Drive App Data folder (speedcube-trainer-sync.json). Signing in on another machine automatically downloads and merges differences without overwriting your local solves or newer settings. Signing out keeps all local data on this device.",
    setupSummary: "⚙️ Google OAuth Client ID Setup",
    clientIdLabel: "Google OAuth 2.0 Web Client ID",
    clientIdPlaceholder: "1234567890-abc...apps.googleusercontent.com",
    emptyClientIdToast: "Please paste a Google OAuth Web Client ID.",
    needClientIdToast: "Enter your Google OAuth Client ID first (see setup steps below).",
    savedClientIdToast: "Saved Google OAuth Client ID.",
    clearedClientIdToast: "Cleared custom Google OAuth Client ID.",
    customHint: "Using custom Google OAuth Client ID saved in this browser.",
    envHint: "Using pre-configured Client ID from build environment (VITE_GOOGLE_CLIENT_ID).",
    missingHint: "No Google OAuth Client ID configured yet. Follow the 3 steps below to connect your own free Google Cloud project."
  },
  onedrive: {
    id: "onedrive",
    label: "Microsoft OneDrive",
    shortLabel: "OneDrive",
    accountTitleFallback: "Microsoft Account",
    signedOutDesc:
      "Sign in with your Microsoft account to save settings, sessions, solve logs, recognition stats, tags, custom labels, and preferred algorithms to your personal OneDrive App Folder.",
    syncingNoun: "Microsoft OneDrive",
    signInLabel: "Sign in with Microsoft",
    reconnectLabel: "Reconnect Microsoft Account",
    signInFailedFallback: "Microsoft sign-in failed.",
    signOutToast: "Signed out of Microsoft OneDrive. All local data remains on this device.",
    privacyLead:
      "Stored privately in your Microsoft OneDrive App Folder (Apps/Graph App Root: speedcube-trainer-sync.json). Signing in on another machine automatically downloads and merges differences without overwriting your local solves or newer settings. Signing out keeps all local data on this device.",
    setupSummary: "⚙️ Microsoft Entra App ID Setup",
    clientIdLabel: "Microsoft Entra Application (client) ID",
    clientIdPlaceholder: "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
    emptyClientIdToast: "Please paste a Microsoft Application (client) ID.",
    needClientIdToast: "Enter your Microsoft Application (client) ID first (see setup steps below).",
    savedClientIdToast: "Saved Microsoft Application (client) ID.",
    clearedClientIdToast: "Cleared custom Microsoft Application (client) ID.",
    customHint: "Using custom Microsoft Application (client) ID saved in this browser.",
    envHint: "Using pre-configured Client ID from build environment (VITE_MICROSOFT_CLIENT_ID).",
    missingHint: "No Microsoft Application (client) ID configured yet. Follow the 3 steps below to register a free Microsoft Entra SPA app."
  }
};

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

function toStatusClass(status) {
  if (status === "needs_reauth") return "needs-reauth";
  if (status === "signed_out") return "signed-out";
  if (status === "idle") return "synced";
  return status || "signed-out";
}

export function createCloudSyncController({
  googleDriveSync,
  oneDriveSync = null,
  appStore,
  modalManager,
  onCloseSettingsModal = null,
  onBackupImported = null
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

  const providerGoogleBtn = typeof document !== "undefined" ? document.getElementById("cloudSyncProviderGoogleBtn") : null;
  const providerOneDriveBtn = typeof document !== "undefined" ? document.getElementById("cloudSyncProviderOneDriveBtn") : null;

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
  const privacyLeadEl = typeof document !== "undefined" ? document.getElementById("cloudSyncPrivacyLead") : null;

  const setupDetails = typeof document !== "undefined" ? document.getElementById("cloudSyncSetupDetails") : null;
  const setupSummary = typeof document !== "undefined" ? document.getElementById("cloudSyncSetupSummary") : null;
  const clientIdLabel = typeof document !== "undefined" ? document.getElementById("cloudSyncClientIdLabel") : null;
  const clientIdInput = typeof document !== "undefined" ? document.getElementById("cloudSyncClientIdInput") : null;
  const clientIdSaveBtn = typeof document !== "undefined" ? document.getElementById("cloudSyncClientIdSaveBtn") : null;
  const clientIdResetBtn = typeof document !== "undefined" ? document.getElementById("cloudSyncClientIdResetBtn") : null;
  const clientIdHint = typeof document !== "undefined" ? document.getElementById("cloudSyncClientIdHint") : null;
  const googleSteps = typeof document !== "undefined" ? document.getElementById("cloudSyncGoogleSteps") : null;
  const oneDriveSteps = typeof document !== "undefined" ? document.getElementById("cloudSyncOneDriveSteps") : null;
  const originPreview = typeof document !== "undefined" ? document.getElementById("cloudSyncOriginPreview") : null;
  const oneDriveRedirectPreview = typeof document !== "undefined" ? document.getElementById("oneDriveRedirectUriPreview") : null;

  const exportBtn = typeof document !== "undefined" ? document.getElementById("cloudSyncExportBtn") : null;
  const importBtn = typeof document !== "undefined" ? document.getElementById("cloudSyncImportBtn") : null;
  const importInput = typeof document !== "undefined" ? document.getElementById("cloudSyncImportInput") : null;

  const services = {
    google: googleDriveSync,
    onedrive: oneDriveSync
  };

  let activeProvider = loadActiveSyncProvider();
  if (!services[activeProvider]) activeProvider = "google";
  if (!services[activeProvider]?.isSignedIn()) {
    const other = activeProvider === "google" ? "onedrive" : "google";
    if (services[other]?.isSignedIn()) {
      activeProvider = other;
    }
  }

  const dismissedErrorByProvider = { google: false, onedrive: false };
  const busyByProvider = { google: false, onedrive: false };
  let lastManualSummary = null;

  function getService(provider = activeProvider) {
    return services[provider] || googleDriveSync;
  }

  function getSummaryTarget() {
    const current = getService(activeProvider);
    if (current?.isSignedIn()) return { provider: activeProvider, service: current };
    const altProvider = activeProvider === "google" ? "onedrive" : "google";
    const alt = services[altProvider];
    if (alt?.isSignedIn()) return { provider: altProvider, service: alt };
    return { provider: activeProvider, service: current };
  }

  function setBusy(provider, nextBusy) {
    busyByProvider[provider] = Boolean(nextBusy);
    render();
  }

  function render() {
    const provider = activeProvider;
    const cfg = PROVIDER_UI[provider] || PROVIDER_UI.google;
    const activeService = getService(provider);
    if (!activeService) return;

    const state = activeService.getState();
    const busy = busyByProvider[provider];
    const dismissedError = dismissedErrorByProvider[provider];
    const statusClass = toStatusClass(state.status);

    // Header button & Settings summary reflect whichever provider is signed in
    const summaryTarget = getSummaryTarget();
    const summaryCfg = PROVIDER_UI[summaryTarget.provider] || cfg;
    const summaryState = summaryTarget.service ? summaryTarget.service.getState() : state;
    const summaryBusy = busyByProvider[summaryTarget.provider];
    const summaryStatusClass = toStatusClass(summaryState.status);

    if (headerDot) {
      headerDot.className = `sync-dot ${summaryStatusClass}`;
    }

    if (headerAvatar && headerIcon) {
      if (summaryState.signedIn && summaryState.account?.picture) {
        headerAvatar.src = summaryState.account.picture;
        headerAvatar.hidden = false;
        headerIcon.hidden = true;
      } else {
        headerAvatar.hidden = true;
        headerIcon.hidden = false;
      }
    }

    if (headerLabel) {
      if (!summaryState.signedIn) headerLabel.textContent = "Cloud Sync";
      else if (summaryState.status === "syncing" || summaryBusy) headerLabel.textContent = "Syncing…";
      else if (summaryState.status === "needs_reauth") headerLabel.textContent = "Reconnect";
      else if (summaryState.status === "offline") headerLabel.textContent = "Offline";
      else if (summaryState.status === "error") headerLabel.textContent = "Sync Error";
      else if (summaryState.pendingChanges) headerLabel.textContent = "Pending…";
      else headerLabel.textContent = "Synced";
    }

    if (settingsStatusEl) {
      if (!summaryState.signedIn) {
        settingsStatusEl.textContent = "Not signed in";
      } else {
        const rel = summaryState.lastSyncedAt ? ` · Last synced ${formatRelativeTime(summaryState.lastSyncedAt)}` : "";
        const stateTag = summaryState.status === "needs_reauth"
          ? " (Reconnect needed)"
          : summaryState.status === "offline"
            ? " (Offline)"
            : summaryState.status === "error"
              ? " (Sync error)"
              : "";
        settingsStatusEl.textContent = `${summaryCfg.shortLabel}: ${summaryState.account?.email || "Signed in"}${stateTag}${rel}`;
      }
    }

    // Provider tabs inside modal
    if (providerGoogleBtn) {
      const isG = provider === "google";
      providerGoogleBtn.classList.toggle("active", isG);
      providerGoogleBtn.setAttribute("aria-pressed", String(isG));
    }
    if (providerOneDriveBtn) {
      providerOneDriveBtn.hidden = !services.onedrive;
      const isOd = provider === "onedrive";
      providerOneDriveBtn.classList.toggle("active", isOd);
      providerOneDriveBtn.setAttribute("aria-pressed", String(isOd));
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
      cardTitle.textContent = state.signedIn
        ? (state.account?.name || state.account?.email || cfg.accountTitleFallback)
        : `Not signed in (${cfg.shortLabel})`;
    }

    if (cardDesc) {
      if (!state.signedIn) {
        cardDesc.textContent = cfg.signedOutDesc;
      } else if (state.status === "syncing" || busy) {
        cardDesc.textContent = `${state.account?.email} — Syncing and merging with ${cfg.syncingNoun}…`;
      } else if (state.status === "needs_reauth") {
        cardDesc.textContent = `${state.account?.email} — Session expired. Click Sync or Reconnect to resume ${cfg.syncingNoun} sync.`;
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
      const summaryObj = (state.signedIn && state.lastSummary) ? state.lastSummary : lastManualSummary;
      const summaryText = summaryObj ? formatMergeSummary(summaryObj) : "";
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
        signInBtn.textContent = busy ? "Signing in…" : cfg.signInLabel;
        signInBtn.disabled = busy || state.status === "syncing";
      } else if (state.status === "needs_reauth") {
        signInBtn.hidden = false;
        signInBtn.textContent = busy ? "Reconnecting…" : cfg.reconnectLabel;
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

    if (privacyLeadEl) {
      privacyLeadEl.textContent = cfg.privacyLead;
    }

    if (setupSummary) {
      setupSummary.textContent = cfg.setupSummary;
    }
    if (clientIdLabel) {
      clientIdLabel.textContent = cfg.clientIdLabel;
    }
    if (clientIdInput) {
      clientIdInput.placeholder = cfg.clientIdPlaceholder;
      if (document.activeElement !== clientIdInput) {
        clientIdInput.value = state.storedClientId || "";
      }
    }
    if (clientIdHint) {
      if (state.storedClientId) {
        clientIdHint.textContent = cfg.customHint;
      } else if (state.hasEnvClientId) {
        clientIdHint.textContent = cfg.envHint;
      } else {
        clientIdHint.textContent = cfg.missingHint;
      }
    }

    if (googleSteps) googleSteps.hidden = provider !== "google";
    if (oneDriveSteps) oneDriveSteps.hidden = provider !== "onedrive";

    if (originPreview && typeof window !== "undefined") {
      originPreview.textContent = window.location.origin || "http://localhost:5173";
    }
    if (oneDriveRedirectPreview && typeof window !== "undefined") {
      oneDriveRedirectPreview.textContent = getOneDriveRedirectUri(window);
    }
  }

  function selectProvider(provider) {
    if (!services[provider] || provider === activeProvider) return;
    activeProvider = provider;
    saveActiveSyncProvider(provider);
    const state = getService(provider).getState();
    if (clientIdInput) {
      clientIdInput.value = state.storedClientId || "";
    }
    if (setupDetails && !state.clientId) {
      setupDetails.open = true;
    }
    render();
  }

  function open() {
    if (!modal) return;
    dismissedErrorByProvider[activeProvider] = false;
    const state = getService(activeProvider).getState();
    if (setupDetails && !state.clientId) {
      setupDetails.open = true;
    }
    render();
    modalManager.open(modal, { initialFocus: closeBtn });
  }

  function close() {
    if (modal) modalManager.close(modal);
  }

  async function handleSignIn() {
    const provider = activeProvider;
    const cfg = PROVIDER_UI[provider];
    const svc = getService(provider);
    const state = svc.getState();
    if (!state.clientId) {
      if (setupDetails) setupDetails.open = true;
      clientIdInput?.focus?.();
      showToast(cfg.needClientIdToast, "warning", 3800);
      return;
    }
    dismissedErrorByProvider[provider] = false;
    setBusy(provider, true);
    try {
      const res = await svc.signIn({ interactive: true });
      const summaryMsg = formatMergeSummary(res?.syncResult?.summary);
      if (res?.syncResult?.ok) {
        showToast(
          summaryMsg && summaryMsg !== "Up to date"
            ? `Signed in as ${res.account?.email} · ${summaryMsg}`
            : `Signed in and synced with ${cfg.label} (${res.account?.email}).`,
          "success",
          3600
        );
      } else if (res?.syncResult?.error) {
        showToast(`Signed in, but sync failed: ${res.syncResult.error}`, "warning", 4000);
      }
    } catch (err) {
      dismissedErrorByProvider[provider] = false;
      showToast(err?.message || cfg.signInFailedFallback, "error", 3800);
    } finally {
      setBusy(provider, false);
    }
  }

  async function handleSyncNow() {
    const provider = activeProvider;
    const cfg = PROVIDER_UI[provider];
    const svc = getService(provider);
    dismissedErrorByProvider[provider] = false;
    const res = await svc.syncNow({ reason: "manual", interactive: true });
    if (res?.ok) {
      const msg = formatMergeSummary(res.summary);
      showToast(`${cfg.label} sync complete · ${msg}`, "success", 3200);
    } else if (res?.offline) {
      showToast("You are offline. Local changes will sync when back online.", "warning", 3200);
    } else if (res?.error) {
      showToast(res.error, "error", 3800);
    }
  }

  async function handleSignOut() {
    const provider = activeProvider;
    const cfg = PROVIDER_UI[provider];
    const svc = getService(provider);
    setBusy(provider, true);
    try {
      await svc.signOut();
      showToast(cfg.signOutToast, "info", 3200);
    } finally {
      setBusy(provider, false);
    }
  }

  function handleExportBackup() {
    if (!appStore) return;
    const payload = exportLocalSyncPayload(appStore);
    const json = JSON.stringify(payload, null, 2);
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `cubing-cc-backup-${dateStr}.json`;

    if (typeof document !== "undefined" && typeof URL !== "undefined") {
      const blob = new Blob([json], { type: "application/json;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }
    showToast(`Exported backup (${filename}).`, "success", 2800);
  }

  async function handleImportFile(file) {
    if (!file || !appStore) return;
    try {
      const text = await file.text();
      const parsed = parseBackupJson(text);
      const res = importAndMergeBackup(appStore, parsed);
      lastManualSummary = res.summary;
      if (res.localChanged) {
        onBackupImported?.(res);
      }
      render();
      const msg = formatMergeSummary(res.summary);
      showToast(
        res.localChanged ? `Backup imported · ${msg}` : "Backup imported · Already up to date.",
        res.localChanged ? "success" : "info",
        3400
      );
    } catch (err) {
      showToast(err?.message || "Failed to import backup JSON.", "error", 4000);
    }
  }

  headerBtn?.addEventListener("click", open);
  settingsOpenBtn?.addEventListener("click", () => {
    onCloseSettingsModal?.();
    open();
  });
  closeBtn?.addEventListener("click", close);
  doneBtn?.addEventListener("click", close);
  providerGoogleBtn?.addEventListener("click", () => selectProvider("google"));
  providerOneDriveBtn?.addEventListener("click", () => selectProvider("onedrive"));
  errorDismissBtn?.addEventListener("click", () => {
    dismissedErrorByProvider[activeProvider] = true;
    render();
  });

  signInBtn?.addEventListener("click", () => void handleSignIn());
  syncNowBtn?.addEventListener("click", () => void handleSyncNow());
  signOutBtn?.addEventListener("click", () => void handleSignOut());
  exportBtn?.addEventListener("click", handleExportBackup);
  importBtn?.addEventListener("click", () => importInput?.click?.());
  importInput?.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (file) await handleImportFile(file);
    if (importInput) importInput.value = "";
  });

  autoToggle?.addEventListener("change", (e) => {
    getService(activeProvider).setAutoSync(Boolean(e.target.checked));
  });

  clientIdSaveBtn?.addEventListener("click", () => {
    const cfg = PROVIDER_UI[activeProvider];
    const val = (clientIdInput?.value || "").trim();
    if (!val) {
      showToast(cfg.emptyClientIdToast, "warning", 2800);
      clientIdInput?.focus?.();
      return;
    }
    getService(activeProvider).setCustomClientId(val);
    showToast(cfg.savedClientIdToast, "success", 2400);
  });

  clientIdResetBtn?.addEventListener("click", () => {
    const cfg = PROVIDER_UI[activeProvider];
    getService(activeProvider).setCustomClientId("");
    if (clientIdInput) clientIdInput.value = "";
    showToast(cfg.clearedClientIdToast, "info", 2200);
  });

  googleDriveSync?.subscribe((state) => {
    if (state.lastError) dismissedErrorByProvider.google = false;
    render();
  });

  oneDriveSync?.subscribe((state) => {
    if (state.lastError) dismissedErrorByProvider.onedrive = false;
    render();
  });

  render();

  return {
    open,
    close,
    render,
    selectProvider,
    getActiveProvider: () => activeProvider,
    getActiveService: () => getService(activeProvider)
  };
}
