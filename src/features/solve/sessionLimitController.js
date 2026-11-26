// Session Countdown / Time Limit Controller for Solve Mode
// Allows setting an editable session duration (e.g. 15m or 30m) with reminders at
// 5 mins left, 1 min left, and a final 5..1 second countdown, while letting in-progress solves finish.

import { playCountdownTickBeep, playSessionLimitCue } from '../../services/audioService.js';
import { escapeHtml } from '../../services/htmlUtils.js';
import { showToast } from '../../ui/toastService.js';

export const SESSION_LIMIT_PRESETS = [5, 10, 15, 20, 30, 45, 60];

/**
 * Clamp user-supplied duration in minutes to [1, 240].
 */
export function clampSessionLimitMinutes(val, fallback = 15) {
  const n = Math.round(Number(val));
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.min(240, Math.max(1, n));
}

/**
 * Format remaining milliseconds as MM:SS (or H:MM:SS when >= 1 hour).
 */
export function formatCountdownMs(ms) {
  const num = Number(ms);
  if (!Number.isFinite(num) || num <= 0) return "00:00";
  const totalSec = Math.ceil(num / 1000);
  const hours = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  const pad2 = (v) => String(v).padStart(2, "0");
  return hours > 0
    ? `${hours}:${pad2(mins)}:${pad2(secs)}`
    : `${pad2(mins)}:${pad2(secs)}`;
}

/**
 * Format duration minutes as singular/plural human text.
 */
export function formatMinutesLabel(minutes) {
  const m = clampSessionLimitMinutes(minutes, 1);
  return m === 1 ? "1 minute" : `${m} minutes`;
}

/**
 * Evaluate milestone notifications (`5m`, `1m`, `5s`..`1s`, `0s`) cleanly without duplicate firing.
 * Mutates `firedSet` in place and returns an array of milestone event objects.
 */
export function evaluateCountdownMilestones({ totalMs, remainingMs, firedSet }) {
  const events = [];
  const fired = firedSet || new Set();

  if (totalMs > 300_000 && remainingMs <= 300_000 && remainingMs > 60_000 && !fired.has("5m")) {
    fired.add("5m");
    events.push({ type: "5m", key: "5m" });
  }

  if (totalMs > 60_000 && remainingMs <= 60_000 && remainingMs > 5_000 && !fired.has("1m")) {
    fired.add("1m");
    events.push({ type: "1m", key: "1m" });
  }

  if (remainingMs > 0 && remainingMs <= 5_000) {
    const sec = Math.min(5, Math.max(1, Math.ceil(remainingMs / 1000)));
    const key = `${sec}s`;
    if (totalMs > sec * 1000 && !fired.has(key)) {
      for (let k = 5; k >= sec; k--) {
        fired.add(`${k}s`);
      }
      events.push({ type: "second", seconds: sec, key });
    }
  }

  if (remainingMs <= 0 && !fired.has("0s")) {
    fired.add("0s");
    events.push({ type: "expired", key: "0s" });
  }

  return events;
}

/**
 * Create the Solve-mode Session Countdown / Limit controller.
 */
export function createSessionLimitController({
  appStore,
  getTimerCtrl = () => null,
  onToast = showToast,
  onTickBeep = playCountdownTickBeep,
  onCue = playSessionLimitCue
} = {}) {
  const toggleBtn = typeof document !== "undefined" ? document.getElementById("solveLimitToggleBtn") : null;
  const configRow = typeof document !== "undefined" ? document.getElementById("solveLimitConfigRow") : null;
  const minutesInput = typeof document !== "undefined" ? document.getElementById("solveLimitMinutesInput") : null;
  const soundToggle = typeof document !== "undefined" ? document.getElementById("solveLimitSoundToggle") : null;
  const startBtn = typeof document !== "undefined" ? document.getElementById("solveLimitStartBtn") : null;
  const closeConfigBtn = typeof document !== "undefined" ? document.getElementById("solveLimitCloseConfigBtn") : null;
  const presetBtns = typeof document !== "undefined" ? document.querySelectorAll(".solve-limit-preset-btn") : [];
  const bannerEl = typeof document !== "undefined" ? document.getElementById("solveLimitBanner") : null;
  const overlayBadge = typeof document !== "undefined" ? document.getElementById("solveOverlayCountdownBadge") : null;

  let status = "idle"; // "idle" | "running" | "paused" | "finishing" | "expired"
  let durationMinutes = clampSessionLimitMinutes(appStore?.state?.solveLimitMinutes, 15);
  let totalMs = durationMinutes * 60_000;
  let endAtMs = 0;
  let remainingMs = 0;
  let firedMilestones = new Set();
  let solvesCompleted = 0;
  let activeCallout = null; // { text, tone, expiresAt }
  let configOpen = false;
  let intervalId = null;

  function isSoundEnabled() {
    return appStore?.state?.solveLimitSound !== false;
  }

  function clearTicker() {
    if (intervalId != null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  function startTicker() {
    clearTicker();
    intervalId = setInterval(() => tick(Date.now()), 200);
  }

  function triggerExpiredReminder() {
    clearTicker();
    status = "expired";
    remainingMs = 0;
    activeCallout = null;
    const label = formatMinutesLabel(durationMinutes);
    if (isSoundEnabled()) {
      onCue?.(`Time's up! You have cubed for ${label}.`, { kind: "expired", useVoice: true });
    }
    onToast?.(`⏰ Time's up! You've cubed for ${label}.`, "warning", 8000);
    render();
  }

  function start(minutes = durationMinutes, now = Date.now()) {
    const clamped = clampSessionLimitMinutes(minutes, durationMinutes || 15);
    durationMinutes = clamped;
    appStore?.setSolveLimitMinutes?.(clamped);
    totalMs = clamped * 60_000;
    remainingMs = totalMs;
    endAtMs = now + totalMs;
    firedMilestones = new Set();
    solvesCompleted = 0;
    activeCallout = null;
    status = "running";
    configOpen = false;
    startTicker();
    render();
    return getState();
  }

  function pause(now = Date.now()) {
    if (status !== "running") return getState();
    remainingMs = Math.max(0, endAtMs - now);
    clearTicker();
    status = "paused";
    render();
    return getState();
  }

  function resume(now = Date.now()) {
    if (status !== "paused") return getState();
    endAtMs = now + remainingMs;
    status = "running";
    startTicker();
    render();
    return getState();
  }

  function extend(extraMinutes = 5, now = Date.now()) {
    const added = clampSessionLimitMinutes(extraMinutes, 5);
    if (status === "idle") return start(added, now);
    const addedMs = added * 60_000;
    if (status === "expired" || status === "finishing") {
      remainingMs = addedMs;
      totalMs += addedMs;
      durationMinutes = clampSessionLimitMinutes(durationMinutes + added, 240);
    } else {
      const baseRem = status === "running" ? Math.max(0, endAtMs - now) : remainingMs;
      remainingMs = baseRem + addedMs;
      totalMs += addedMs;
      durationMinutes = clampSessionLimitMinutes(durationMinutes + added, 240);
    }
    endAtMs = now + remainingMs;

    // Clear milestones that lie below the new remaining duration so they can fire again
    firedMilestones.delete("0s");
    for (let k = 1; k <= 5; k++) {
      if (remainingMs > k * 1000) firedMilestones.delete(`${k}s`);
    }
    if (remainingMs > 60_000) firedMilestones.delete("1m");
    if (remainingMs > 300_000) firedMilestones.delete("5m");

    activeCallout = null;
    status = "running";
    startTicker();
    onToast?.(`+${added} min added to session limit`, "info", 2400);
    render();
    return getState();
  }

  function stop() {
    clearTicker();
    status = "idle";
    remainingMs = 0;
    endAtMs = 0;
    firedMilestones = new Set();
    solvesCompleted = 0;
    activeCallout = null;
    render();
    return getState();
  }

  function dismiss() {
    return stop();
  }

  function tick(now = Date.now()) {
    if (status !== "running") return;
    remainingMs = Math.max(0, endAtMs - now);

    if (activeCallout && now >= activeCallout.expiresAt) {
      activeCallout = null;
    }

    const solveState = getTimerCtrl?.()?.getSolveState?.() || "idle";
    const soundOn = isSoundEnabled();
    const events = evaluateCountdownMilestones({ totalMs, remainingMs, firedSet: firedMilestones });

    for (const ev of events) {
      if (ev.type === "5m") {
        activeCallout = { text: "5 mins left", tone: "info", expiresAt: now + 8000 };
        onToast?.("⏱ 5 minutes left in your cubing session", "info", 4500);
        if (soundOn) {
          onCue?.("5 minutes left", { kind: "reminder", useVoice: solveState !== "inspecting" });
        }
      } else if (ev.type === "1m") {
        activeCallout = { text: "1 min left", tone: "warning", expiresAt: now + 10000 };
        onToast?.("⏱ 1 minute left!", "warning", 5000);
        if (soundOn) {
          onCue?.("1 minute left", { kind: "reminder", useVoice: solveState !== "inspecting" });
        }
      } else if (ev.type === "second") {
        activeCallout = { text: String(ev.seconds), tone: "urgent", expiresAt: now + 1100 };
        if (soundOn) {
          onTickBeep?.(ev.seconds);
        }
      } else if (ev.type === "expired") {
        clearTicker();
        if (solveState !== "idle") {
          status = "finishing";
          activeCallout = { text: "Finish solve", tone: "warning", expiresAt: Infinity };
        } else {
          triggerExpiredReminder();
          return;
        }
      }
    }

    render();
  }

  function onSolveFinished({ counted = true } = {}) {
    if (counted && (status === "running" || status === "finishing")) {
      solvesCompleted += 1;
    }
    if (status === "finishing") {
      triggerExpiredReminder();
      return;
    }
    if (status !== "idle") {
      render();
    }
  }

  function render() {
    const timeText = formatCountdownMs(remainingMs);
    const labelText = formatMinutesLabel(durationMinutes);

    if (toggleBtn) {
      toggleBtn.classList.remove("is-limit-active", "is-limit-paused", "is-limit-warning", "is-limit-expired");
      if (status === "idle") {
        toggleBtn.textContent = "⏱ Limit";
        toggleBtn.setAttribute("aria-pressed", "false");
      } else if (status === "running") {
        toggleBtn.textContent = `⏱ ${timeText}`;
        toggleBtn.setAttribute("aria-pressed", "true");
        toggleBtn.classList.add("is-limit-active");
        if (remainingMs <= 60_000) toggleBtn.classList.add("is-limit-warning");
      } else if (status === "paused") {
        toggleBtn.textContent = `⏱ ${timeText} ⏸`;
        toggleBtn.setAttribute("aria-pressed", "true");
        toggleBtn.classList.add("is-limit-paused");
      } else if (status === "finishing") {
        toggleBtn.textContent = "⏱ 00:00";
        toggleBtn.setAttribute("aria-pressed", "true");
        toggleBtn.classList.add("is-limit-warning");
      } else if (status === "expired") {
        toggleBtn.textContent = "⏰ Time's up";
        toggleBtn.setAttribute("aria-pressed", "true");
        toggleBtn.classList.add("is-limit-expired");
      }
    }

    if (configRow) {
      configRow.hidden = !configOpen;
    }
    if (minutesInput && document?.activeElement !== minutesInput) {
      const currentVal = clampSessionLimitMinutes(appStore?.state?.solveLimitMinutes, durationMinutes);
      minutesInput.value = String(currentVal);
    }
    if (soundToggle) {
      soundToggle.checked = isSoundEnabled();
    }
    if (presetBtns?.length) {
      const selectedMins = clampSessionLimitMinutes(minutesInput?.value || appStore?.state?.solveLimitMinutes, durationMinutes);
      presetBtns.forEach(btn => {
        const m = Number(btn.dataset.limitMinutes);
        const active = m === selectedMins;
        btn.classList.toggle("active", active);
        btn.setAttribute("aria-pressed", String(active));
      });
    }

    if (overlayBadge) {
      if (status === "finishing") {
        overlayBadge.textContent = "⏰ Time's up — finish solve";
        overlayBadge.className = "solve-overlay-countdown-badge is-finishing";
        overlayBadge.hidden = false;
      } else if (status === "running" && remainingMs > 0 && remainingMs <= 5_000) {
        const sec = Math.min(5, Math.max(1, Math.ceil(remainingMs / 1000)));
        overlayBadge.textContent = `⏱ ${sec}`;
        overlayBadge.className = "solve-overlay-countdown-badge is-urgent";
        overlayBadge.hidden = false;
      } else {
        overlayBadge.hidden = true;
      }
    }

    if (!bannerEl) return;

    if (status === "idle") {
      bannerEl.hidden = true;
      bannerEl.className = "solve-limit-banner";
      bannerEl.innerHTML = "";
      return;
    }

    bannerEl.hidden = false;

    if (status === "expired") {
      const solvesCopy = solvesCompleted > 0
        ? `${solvesCompleted} solve${solvesCompleted === 1 ? "" : "s"} completed · Great session!`
        : "Your preset cubing time allowance is complete.";
      bannerEl.className = "solve-limit-banner is-expired";
      bannerEl.innerHTML = `
        <div class="solve-limit-main">
          <div class="solve-limit-expired-copy">
            <strong class="solve-limit-title">⏰ Time's up! You've cubed for ${escapeHtml(labelText)}.</strong>
            <span class="solve-limit-sub">${escapeHtml(solvesCopy)}</span>
          </div>
          <div class="solve-limit-actions">
            <button type="button" class="btn btn-xs btn-primary" data-limit-action="extend">+5 min</button>
            <button type="button" class="btn btn-xs" data-limit-action="restart">Restart (${durationMinutes}m)</button>
            <button type="button" class="btn btn-xs" data-limit-action="dismiss">Dismiss</button>
          </div>
        </div>
      `;
      return;
    }

    if (status === "finishing") {
      bannerEl.className = "solve-limit-banner is-finishing";
      bannerEl.innerHTML = `
        <div class="solve-limit-main">
          <span class="solve-limit-callout tone-warning">Finish solve</span>
          <div class="solve-limit-copy">
            <strong class="solve-limit-title">⏰ Time's up (${escapeHtml(labelText)}) — finish your current solve!</strong>
          </div>
          <div class="solve-limit-actions">
            <button type="button" class="btn btn-xs" data-limit-action="extend">+5m</button>
          </div>
        </div>
      `;
      return;
    }

    const pctLeft = totalMs > 0 ? Math.max(0, Math.min(100, Math.round((remainingMs / totalMs) * 100))) : 0;
    const isUrgent = remainingMs <= 5_000;
    const isWarning = !isUrgent && remainingMs <= 60_000;
    bannerEl.className = `solve-limit-banner ${isUrgent ? "is-urgent" : (isWarning ? "is-warning" : "")} ${status === "paused" ? "is-paused" : ""}`.trim();

    const calloutHtml = activeCallout
      ? `<span class="solve-limit-callout tone-${escapeHtml(activeCallout.tone || "info")}">${escapeHtml(activeCallout.text)}</span>`
      : "";

    const toggleAction = status === "paused"
      ? `<button type="button" class="btn btn-xs btn-primary" data-limit-action="resume">Resume</button>`
      : `<button type="button" class="btn btn-xs" data-limit-action="pause">Pause</button>`;

    bannerEl.innerHTML = `
      <div class="solve-limit-main">
        <div class="solve-limit-timer-readout">
          <span class="solve-limit-clock">${escapeHtml(timeText)} left</span>
          <span class="solve-limit-scope">(of ${durationMinutes}m${solvesCompleted > 0 ? ` · ${solvesCompleted} solve${solvesCompleted === 1 ? "" : "s"}` : ""})</span>
          ${calloutHtml}
        </div>
        <div class="solve-limit-actions">
          ${toggleAction}
          <button type="button" class="btn btn-xs" data-limit-action="extend">+5m</button>
          <button type="button" class="btn btn-xs" data-limit-action="stop">Stop</button>
        </div>
      </div>
      <div class="solve-limit-progress" aria-hidden="true">
        <div class="solve-limit-progress-bar" style="width: ${pctLeft}%"></div>
      </div>
    `;
  }

  // Bind UI events cleanly (preventing clicks inside banner from reaching timer pad)
  toggleBtn?.addEventListener("click", () => {
    configOpen = !configOpen;
    if (configOpen && minutesInput) {
      minutesInput.value = String(clampSessionLimitMinutes(appStore?.state?.solveLimitMinutes, durationMinutes));
    }
    render();
    if (configOpen && minutesInput) {
      minutesInput.focus?.();
    }
  });

  closeConfigBtn?.addEventListener("click", () => {
    configOpen = false;
    render();
  });

  presetBtns.forEach(btn => {
    btn?.addEventListener("click", () => {
      const m = clampSessionLimitMinutes(btn.dataset.limitMinutes, 15);
      if (minutesInput) minutesInput.value = String(m);
      appStore?.setSolveLimitMinutes?.(m);
      if (status === "idle" || status === "expired") {
        start(m);
      } else {
        render();
      }
    });
  });

  startBtn?.addEventListener("click", () => {
    const val = clampSessionLimitMinutes(minutesInput?.value, durationMinutes || 15);
    start(val);
  });

  minutesInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const val = clampSessionLimitMinutes(minutesInput.value, durationMinutes || 15);
      start(val);
    } else if (e.key === "Escape") {
      e.preventDefault();
      configOpen = false;
      render();
    }
  });

  minutesInput?.addEventListener("input", () => {
    const raw = Math.round(Number(minutesInput.value));
    if (Number.isFinite(raw) && raw >= 1 && raw <= 240 && presetBtns?.length) {
      presetBtns.forEach(btn => {
        const m = Number(btn.dataset.limitMinutes);
        const active = m === raw;
        btn.classList.toggle("active", active);
        btn.setAttribute("aria-pressed", String(active));
      });
    }
  });

  soundToggle?.addEventListener("change", (e) => {
    appStore?.setSolveLimitSound?.(Boolean(e.target.checked));
  });

  bannerEl?.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
  });

  bannerEl?.addEventListener("click", (e) => {
    e.stopPropagation();
    const actionBtn = e.target?.closest?.("[data-limit-action]");
    if (!actionBtn) return;
    const action = actionBtn.dataset.limitAction;
    if (action === "pause") pause();
    else if (action === "resume") resume();
    else if (action === "extend") extend(5);
    else if (action === "restart") start(durationMinutes);
    else if (action === "stop" || action === "dismiss") stop();
  });

  render();

  function getState() {
    return {
      status,
      durationMinutes,
      totalMs,
      remainingMs,
      solvesCompleted,
      activeCallout: activeCallout ? { ...activeCallout } : null,
      configOpen
    };
  }

  return {
    start,
    pause,
    resume,
    extend,
    stop,
    dismiss,
    tick,
    onSolveFinished,
    render,
    getState
  };
}
