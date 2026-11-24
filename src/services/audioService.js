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
