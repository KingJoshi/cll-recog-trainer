// Shared Web Audio cues for inspection warnings, scramble completion chimes, and disconnect alerts

let sharedAudioCtx = null;

function getAudioContext() {
  if (typeof window === "undefined") return null;
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  if (!AudioCtx) return null;
  if (!sharedAudioCtx) {
    sharedAudioCtx = new AudioCtx();
  }
  if (sharedAudioCtx.state === "suspended") {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

function playToneSequence(steps = []) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    for (const step of steps) {
      const { freq = 440, start = 0, dur = 0.08, type = "sine", peak = 0.12, endFreq = null } = step;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, now + start);
      if (endFreq && endFreq !== freq) {
        osc.frequency.exponentialRampToValueAtTime(endFreq, now + start + dur * 0.6);
      }
      gain.gain.setValueAtTime(peak, now + start);
      gain.gain.exponentialRampToValueAtTime(0.001, now + start + dur);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + start);
      osc.stop(now + start + dur);
    }
  } catch {}
}

export function playInspectionBeep(freq = 440, duration = 0.08) {
  playToneSequence([{ freq, dur: duration, type: "sine", peak: 0.12 }]);
}

function playCalloutBeep(seconds) {
  if (Number(seconds) >= 12) {
    playToneSequence([
      { freq: 880, start: 0, dur: 0.08, type: "sine", peak: 0.12 },
      { freq: 880, start: 0.14, dur: 0.1, type: "sine", peak: 0.14 }
    ]);
  } else {
    playInspectionBeep(520, 0.09);
  }
}

/**
 * Play a WCA inspection time callout ("8 seconds" / "12 seconds").
 * Supports "voice" (Web Speech API with beep fallback), "beep", or "off".
 */
export function playInspectionCallout(seconds, mode = "voice") {
  const normalized = mode === "off" || mode === "beep" || mode === "voice" ? mode : "voice";
  if (normalized === "off") return;

  if (normalized === "voice") {
    try {
      const host = typeof window !== "undefined" ? window : globalThis;
      const synth = host?.speechSynthesis;
      const Utterance = host?.SpeechSynthesisUtterance;
      if (synth && typeof synth.speak === "function" && typeof Utterance === "function") {
        if (typeof synth.cancel === "function") synth.cancel();
        const utter = new Utterance(`${seconds} seconds`);
        utter.lang = "en-US";
        utter.rate = 1.15;
        utter.pitch = 1.0;
        synth.speak(utter);
        return;
      }
    } catch {
      // Fall back to beep if speech synthesis throws or is blocked
    }
  }

  playCalloutBeep(seconds);
}

/**
 * Cancel any queued inspection voice utterance.
 */
export function cancelInspectionCallout() {
  try {
    const host = typeof window !== "undefined" ? window : globalThis;
    if (host?.speechSynthesis && typeof host.speechSynthesis.cancel === "function") {
      host.speechSynthesis.cancel();
    }
  } catch {
    // Ignore speech cancellation errors
  }
}

export function playScrambleCompleteChime() {
  playToneSequence([{ freq: 587.33, endFreq: 880, dur: 0.28, type: "triangle", peak: 0.2 }]);
}

export function playDisconnectAlertSound() {
  playToneSequence([
    { freq: 880, start: 0, dur: 0.14, type: "triangle", peak: 0.22 },
    { freq: 440, start: 0.17, dur: 0.24, type: "triangle", peak: 0.22 }
  ]);
}

export function playPauseAlert() {
  playToneSequence([{ freq: 330, dur: 0.07, type: "sine", peak: 0.12 }]);
}

let metronomeTimerId = null;

export function stopMetronome() {
  if (metronomeTimerId != null) {
    clearInterval(metronomeTimerId);
    metronomeTimerId = null;
  }
}

export function isMetronomeRunning() {
  return metronomeTimerId != null;
}

export function startMetronome(bpm = 180) {
  stopMetronome();
  const safeBpm = Math.max(60, Math.min(420, Math.round(Number(bpm) || 180)));
  const intervalMs = Math.max(120, Math.round(60000 / safeBpm));
  const tick = () => playToneSequence([{ freq: 1100, dur: 0.025, type: "triangle", peak: 0.10 }]);
  tick();
  metronomeTimerId = setInterval(tick, intervalMs);
  return safeBpm;
}

/**
 * Play a short crisp pip for the final 5-second session countdown (5, 4, 3, 2, 1).
 */
export function playCountdownTickBeep(secondsLeft = 5) {
  const freq = Number(secondsLeft) === 1 ? 880 : 660;
  playToneSequence([{ freq, dur: 0.06, type: "sine", peak: 0.10 }]);
}

/**
 * Play a session time-limit reminder or completion cue, using speech synthesis when enabled
 * with Web Audio chime fallback.
 */
export function playSessionLimitCue(message, { kind = "reminder", useVoice = true } = {}) {
  const speakText = () => {
    if (!useVoice || !message) return false;
    try {
      const host = typeof window !== "undefined" ? window : globalThis;
      const synth = host?.speechSynthesis;
      const Utterance = host?.SpeechSynthesisUtterance;
      if (synth && typeof synth.speak === "function" && typeof Utterance === "function") {
        const utter = new Utterance(String(message));
        utter.lang = "en-US";
        utter.rate = 1.05;
        utter.pitch = 1.0;
        synth.speak(utter);
        return true;
      }
    } catch {
      // Fall back to tone chime
    }
    return false;
  };

  if (kind === "expired") {
    playToneSequence([
      { freq: 523.25, start: 0, dur: 0.14, type: "triangle", peak: 0.16 },
      { freq: 659.25, start: 0.15, dur: 0.14, type: "triangle", peak: 0.16 },
      { freq: 783.99, start: 0.30, dur: 0.28, type: "triangle", peak: 0.18 }
    ]);
    speakText();
    return;
  }

  if (!speakText()) {
    playToneSequence([
      { freq: 587.33, start: 0, dur: 0.11, type: "triangle", peak: 0.14 },
      { freq: 783.99, start: 0.13, dur: 0.18, type: "triangle", peak: 0.14 }
    ]);
  }
}
