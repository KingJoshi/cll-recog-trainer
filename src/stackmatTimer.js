// SpeedStacks Stackmat (G5 / G4 / G3) Web Audio FSK timer decoder & manager.
//
// Stackmat timers output a continuous 1200 baud 8N1 RS-232 serial stream over their
// data port (3.5mm audio adapter into mic/line-in). Packet formats:
//   Gen 4 / Gen 5 (10 bytes): [cmd, min, sec10, sec1, ms100, ms10, ms1, checksum, 0x0A, 0x0D]
//   Gen 3         (9 bytes):  [cmd, min, sec10, sec1, cs10,  cs1,  checksum, 0x0A, 0x0D]
// Where checksum = 64 + sum(digit numeric values 0..9).
// Note: Chrome/macOS audio interfaces often invert microphone phase and apply AC coupling,
// so StackmatBitDecoder tracks edges across dual polarities simultaneously.

export const STACKMAT_CMD_STATES = Object.freeze({
  I: "IDLE",
  A: "GET_SET",
  C: "HANDS_ON",
  L: "HANDS_ON",
  R: "HANDS_ON",
  " ": "RUNNING",
  S: "STOPPED"
});

/**
 * Parse a 9-byte (Gen 3) or 10-byte (Gen 4/5) Stackmat RS-232 packet.
 * Returns normalized state + millisecond time, or null if framing/checksum fails.
 */
export function parseStackmatPacket(bytes) {
  if (!bytes || (bytes.length !== 9 && bytes.length !== 10)) return null;
  const len = bytes.length;
  if (bytes[len - 2] !== 0x0A || bytes[len - 1] !== 0x0D) return null;

  const cmd = String.fromCharCode(bytes[0] & 0xFF);
  const timerState = STACKMAT_CMD_STATES[cmd];
  if (!timerState) return null;

  const digitCount = len === 10 ? 6 : 5;
  const digits = new Array(digitCount);
  let digitSum = 0;
  for (let i = 0; i < digitCount; i++) {
    const code = bytes[1 + i] & 0xFF;
    if (code < 0x30 || code > 0x39) return null;
    const d = code - 0x30;
    digits[i] = d;
    digitSum += d;
  }

  const checksum = bytes[1 + digitCount] & 0xFF;
  const expectedChecksum = (64 + digitSum) & 0xFF;
  if (checksum !== expectedChecksum) return null;

  const min = digits[0];
  const sec = digits[1] * 10 + digits[2];
  const subMs = digitCount === 6
    ? (digits[3] * 100 + digits[4] * 10 + digits[5])
    : ((digits[3] * 10 + digits[4]) * 10);
  const timeMs = min * 60000 + sec * 1000 + subMs;

  return {
    cmd,
    timerState,
    digits,
    timeMs,
    generation: digitCount === 6 ? "G4/G5" : "G3",
    checksum
  };
}

class UartPolarityChannel {
  constructor(sampleRate, inverted, onPacket) {
    this.bitLen = sampleRate / 1200;
    this.inverted = inverted;
    this.onPacket = onPacket;
    this.mode = "WAIT_START"; // "WAIT_START" | "START_CHECK" | "DATA" | "STOP"
    this.sampleCounter = 0;
    this.bitIndex = 0;
    this.currentByte = 0;
    this.byteRing = [];
  }

  resetFraming() {
    this.mode = "WAIT_START";
    this.sampleCounter = 0;
    this.bitIndex = 0;
    this.currentByte = 0;
  }

  pushSample(rawBit, sampleIndex) {
    const bit = this.inverted ? (rawBit ? 0 : 1) : rawBit;

    if (this.mode === "WAIT_START") {
      if (bit === 0) {
        this.mode = "START_CHECK";
        this.sampleCounter = 1;
      }
      return;
    }

    this.sampleCounter += 1;

    if (this.mode === "START_CHECK") {
      if (this.sampleCounter >= this.bitLen * 0.5) {
        if (bit !== 0) {
          this.resetFraming();
          return;
        }
        this.mode = "DATA";
        this.sampleCounter -= this.bitLen * 0.5;
        this.bitIndex = 0;
        this.currentByte = 0;
      }
      return;
    }

    if (this.mode === "DATA") {
      if (this.sampleCounter >= this.bitLen) {
        this.sampleCounter -= this.bitLen;
        if (bit) {
          this.currentByte |= (1 << this.bitIndex);
        }
        this.bitIndex += 1;
        if (this.bitIndex >= 8) {
          this.mode = "STOP";
        }
      }
      return;
    }

    if (this.mode === "STOP") {
      if (this.sampleCounter >= this.bitLen) {
        this.mode = "WAIT_START";
        this.sampleCounter = 0;
        if (bit !== 1) {
          this.byteRing.length = 0;
          return;
        }
        this.byteRing.push(this.currentByte);
        if (this.byteRing.length > 12) {
          this.byteRing.shift();
        }
        this._tryExtractPacket(sampleIndex);
      }
    }
  }

  _tryExtractPacket(sampleIndex) {
    const ring = this.byteRing;
    const len = ring.length;
    if (len < 9 || ring[len - 2] !== 0x0A || ring[len - 1] !== 0x0D) return;

    if (len >= 10) {
      const p10 = parseStackmatPacket(ring.slice(len - 10));
      if (p10) {
        ring.length = 0;
        this.onPacket(p10, this.inverted ? -1 : 1, sampleIndex);
        return;
      }
    }
    const p9 = parseStackmatPacket(ring.slice(len - 9));
    if (p9) {
      ring.length = 0;
      this.onPacket(p9, this.inverted ? -1 : 1, sampleIndex);
    }
  }
}

/**
 * Adaptive differential PCM -> 1200 baud UART Stackmat decoder.
 * Survives arbitrary macOS/USB mic polarity inversion and AC-coupling droop.
 */
export class StackmatBitDecoder {
  constructor(sampleRate = 48000, { onPacket = null } = {}) {
    if (!Number.isFinite(sampleRate) || sampleRate <= 2400) {
      throw new Error(`Invalid audio sampleRate for Stackmat decoder: ${sampleRate}`);
    }
    this.sampleRate = sampleRate;
    this.onPacket = onPacket;
    // Span ~1/12th of a bit period so gently low-pass filtered RS-232 edges still register clearly.
    this._diffLag = Math.max(1, Math.round(sampleRate / 14400));
    this._history = new Float32Array(this._diffLag);
    this._histIdx = 0;
    this._histSeeded = false;
    this._levelNormal = 1;
    this._levelInverted = 0;
    this._peakEdge = 0.04;
    this._signalPeak = 0;
    this._signalRms = 0;
    this._packetsDecoded = 0;
    this._lastGeneration = null;
    this._totalSamples = 0;

    const emit = (packet, polarity, sampleIndex) => {
      this._packetsDecoded += 1;
      this._lastGeneration = packet.generation;
      this.onPacket?.(packet, { polarity, sampleIndex });
    };
    this._channels = [
      new UartPolarityChannel(sampleRate, false, emit),
      new UartPolarityChannel(sampleRate, true, emit)
    ];
  }

  /**
   * Process a chunk of mono float PCM samples in [-1, 1] and return any decoded packets.
   */
  processSamples(samples) {
    if (!samples || !samples.length) return [];
    const decoded = [];
    const lag = this._diffLag;
    const hist = this._history;

    if (!this._histSeeded) {
      hist.fill(samples[0]);
      this._histSeeded = true;
    }

    let sumSq = 0;
    let chunkPeak = 0;
    // Track per-call packets even if caller passed constructor callback.
    const prevCallback = this.onPacket;
    this.onPacket = (pkt, meta) => {
      decoded.push(pkt);
      prevCallback?.(pkt, meta);
    };

    try {
      for (let i = 0; i < samples.length; i++) {
        const s = samples[i];
        const absS = s < 0 ? -s : s;
        if (absS > chunkPeak) chunkPeak = absS;
        sumSq += s * s;

        const delayed = hist[this._histIdx];
        hist[this._histIdx] = s;
        this._histIdx = (this._histIdx + 1) % lag;

        const diff = s - delayed;
        const absDiff = diff < 0 ? -diff : diff;
        if (absDiff > this._peakEdge) {
          this._peakEdge = absDiff;
        } else {
          // Gentle decay lets ADC gain adapt smoothly without losing idle lock between bursts.
          this._peakEdge = Math.max(0.025, this._peakEdge * 0.99992);
        }

        const thresh = Math.max(0.015, this._peakEdge * 0.42);
        if (diff > thresh) {
          this._levelNormal = 1;
          this._levelInverted = 1;
        } else if (diff < -thresh) {
          this._levelNormal = 0;
          this._levelInverted = 0;
        }

        const sampleIdx = this._totalSamples++;
        this._channels[0].pushSample(this._levelNormal, sampleIdx);
        this._channels[1].pushSample(this._levelInverted, sampleIdx);
      }
    } finally {
      this.onPacket = prevCallback;
    }

    this._signalPeak = chunkPeak;
    this._signalRms = Math.sqrt(sumSq / samples.length);
    return decoded;
  }

  getSignalStats() {
    return {
      peak: this._signalPeak,
      rms: this._signalRms,
      packetsDecoded: this._packetsDecoded,
      generation: this._lastGeneration,
      sampleRate: this.sampleRate
    };
  }
}

export class StackmatTimerManager extends EventTarget {
  constructor({ navigatorObj = null, audioContextFactory = null } = {}) {
    super();
    this._navigator = navigatorObj;
    this._audioContextFactory = audioContextFactory;
    this.status = "disconnected"; // "disconnected" | "connecting" | "connected"
    this.deviceId = "";
    this.deviceName = "Stackmat G5";
    this.lastHardwareState = null;
    this.lastPacket = null;
    this._lastPacketAt = 0;
    this._lastSignalEmitAt = 0;
    this._decoder = null;
    this._stream = null;
    this._audioCtx = null;
    this._sourceNode = null;
    this._procNode = null;
    this._gainNode = null;
    this._manualDisconnecting = false;
    this._connectPromise = null;
  }

  _getNav() {
    if (this._navigator) return this._navigator;
    return typeof navigator !== "undefined" ? navigator : null;
  }

  isAudioSupported() {
    const nav = this._getNav();
    const hasMic = Boolean(nav?.mediaDevices && typeof nav.mediaDevices.getUserMedia === "function");
    const hasCtx = Boolean(
      this._audioContextFactory ||
      (typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext)) ||
      (typeof globalThis !== "undefined" && globalThis.AudioContext)
    );
    return hasMic && hasCtx;
  }

  isConnected() {
    return this.status === "connected";
  }

  isSignalLocked(now = Date.now()) {
    return Boolean(this._lastPacketAt > 0 && (now - this._lastPacketAt) < 1600);
  }

  getStatus() {
    const stats = this._decoder?.getSignalStats?.() || { peak: 0, rms: 0, generation: null };
    return {
      status: this.status,
      connected: this.status === "connected",
      state: this.lastHardwareState,
      deviceId: this.deviceId,
      deviceName: this.deviceName || "Stackmat G5",
      generation: this.lastPacket?.generation || stats.generation || null,
      timeMs: this.lastPacket?.timeMs ?? null,
      signalPeak: stats.peak || 0,
      locked: this.isSignalLocked()
    };
  }

  async listAudioInputs() {
    const nav = this._getNav();
    if (!nav?.mediaDevices || typeof nav.mediaDevices.enumerateDevices !== "function") {
      return [];
    }
    try {
      const devices = await nav.mediaDevices.enumerateDevices();
      return (devices || [])
        .filter(d => d.kind === "audioinput")
        .map((d, idx) => ({
          deviceId: d.deviceId || "",
          label: d.label || `Audio Input ${idx + 1}`
        }));
    } catch {
      return [];
    }
  }

  async connect({ deviceId = "" } = {}) {
    if (this.status === "connecting" && this._connectPromise) return this._connectPromise;
    if (this.status === "connected") {
      await this.disconnect({ manual: true });
    }
    if (!this.isAudioSupported()) {
      throw new Error("Web Audio / microphone capture is not supported in this browser.");
    }

    const nav = this._getNav();
    this.status = "connecting";
    this._emitStatusChange();

    this._connectPromise = (async () => {
      try {
        const audioConstraints = {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false,
          channelCount: 1
        };
        if (deviceId) {
          audioConstraints.deviceId = { exact: deviceId };
        }
        const stream = await nav.mediaDevices.getUserMedia({ audio: audioConstraints });
        this._stream = stream;

        const Ctx = this._audioContextFactory ||
          (typeof window !== "undefined" ? (window.AudioContext || window.webkitAudioContext) : globalThis.AudioContext);
        const audioCtx = typeof Ctx === "function" && Ctx.prototype ? new Ctx() : await Ctx();
        this._audioCtx = audioCtx;
        if (typeof audioCtx.resume === "function" && audioCtx.state === "suspended") {
          await audioCtx.resume();
        }

        const track = stream.getAudioTracks?.()[0] || null;
        if (track) {
          const settings = typeof track.getSettings === "function" ? track.getSettings() : {};
          this.deviceId = settings.deviceId || deviceId || "";
          this.deviceName = track.label ? `Stackmat (${track.label})` : "Stackmat G5";
          track.addEventListener?.("ended", () => {
            if (!this._manualDisconnecting) {
              this._handleDisconnect("unexpected");
            }
          });
        } else {
          this.deviceId = deviceId || "";
          this.deviceName = "Stackmat G5";
        }

        this._decoder = new StackmatBitDecoder(audioCtx.sampleRate || 48000);
        this.lastHardwareState = null;
        this.lastPacket = null;
        this._lastPacketAt = 0;

        const source = audioCtx.createMediaStreamSource(stream);
        const proc = audioCtx.createScriptProcessor(1024, 1, 1);
        const gain = audioCtx.createGain();
        gain.gain.value = 0;
        proc.onaudioprocess = (ev) => {
          if (this.status !== "connected" && this.status !== "connecting") return;
          const chan = ev.inputBuffer?.getChannelData?.(0);
          if (chan) {
            const ts = typeof performance !== "undefined" ? performance.now() : Date.now();
            this.processPcmSamples(chan, ts);
          }
        };
        source.connect(proc);
        proc.connect(gain);
        gain.connect(audioCtx.destination);

        this._sourceNode = source;
        this._procNode = proc;
        this._gainNode = gain;
        this.status = "connected";
        this._emitStatusChange();
        this.dispatchEvent(new CustomEvent("connected", { detail: this.getStatus() }));
        return this.getStatus();
      } catch (err) {
        this._cleanupAudio();
        this.status = "disconnected";
        this._emitStatusChange();
        throw err;
      } finally {
        this._connectPromise = null;
      }
    })();

    return this._connectPromise;
  }

  /**
   * Process a chunk of mono float PCM samples and emit normalized "timerstate" & "signal" events.
   * Exposed publicly so unit tests can simulate full Stackmat audio sessions in Node.
   */
  processPcmSamples(samples, ts = null, { sampleRate = 48000 } = {}) {
    if (!this._decoder) {
      this._decoder = new StackmatBitDecoder(sampleRate);
    }
    const eventTs = ts != null ? ts : (typeof performance !== "undefined" ? performance.now() : Date.now());
    const packets = this._decoder.processSamples(samples);
    const nowWall = Date.now();

    for (const pkt of packets) {
      this._handlePacket(pkt, eventTs, nowWall);
    }

    if ((nowWall - this._lastSignalEmitAt) >= 120 || packets.length > 0) {
      this._lastSignalEmitAt = nowWall;
      const stats = this._decoder.getSignalStats();
      this.dispatchEvent(new CustomEvent("signal", {
        detail: {
          peak: stats.peak,
          rms: stats.rms,
          locked: this.isSignalLocked(nowWall),
          generation: this.lastPacket?.generation || stats.generation || null
        }
      }));
    }
    return packets;
  }

  _handlePacket(pkt, ts, nowWall = Date.now()) {
    const prevState = this.lastHardwareState;
    const nextState = pkt.timerState;
    this.lastPacket = pkt;
    this._lastPacketAt = nowWall;
    this.lastHardwareState = nextState;

    if (nextState !== prevState) {
      this.dispatchEvent(new CustomEvent("timerstate", {
        detail: {
          state: nextState,
          recordedMs: nextState === "STOPPED" ? pkt.timeMs : null,
          ts,
          rawCmd: pkt.cmd,
          generation: pkt.generation
        }
      }));
    }
  }

  _cleanupAudio() {
    try { this._procNode && (this._procNode.onaudioprocess = null); } catch {}
    try { this._sourceNode?.disconnect?.(); } catch {}
    try { this._procNode?.disconnect?.(); } catch {}
    try { this._gainNode?.disconnect?.(); } catch {}
    try {
      const tracks = this._stream?.getTracks?.() || [];
      for (const t of tracks) t.stop?.();
    } catch {}
    try {
      if (this._audioCtx && typeof this._audioCtx.close === "function" && this._audioCtx.state !== "closed") {
        void this._audioCtx.close();
      }
    } catch {}
    this._sourceNode = null;
    this._procNode = null;
    this._gainNode = null;
    this._stream = null;
    this._audioCtx = null;
    this._decoder = null;
    this.lastHardwareState = null;
    this.lastPacket = null;
    this._lastPacketAt = 0;
  }

  _handleDisconnect(reason = "unexpected") {
    if (this.status === "disconnected") return;
    this._cleanupAudio();
    this.status = "disconnected";
    this._emitStatusChange();
    this.dispatchEvent(new CustomEvent("disconnected", { detail: { reason } }));
  }

  disconnect({ manual = true } = {}) {
    if (this.status === "disconnected") return;
    this._manualDisconnecting = Boolean(manual);
    try {
      this._handleDisconnect(manual ? "manual" : "unexpected");
    } finally {
      this._manualDisconnecting = false;
    }
  }

  _emitStatusChange() {
    this.dispatchEvent(new CustomEvent("statuschange", { detail: this.getStatus() }));
  }
}

export const stackmatTimer = new StackmatTimerManager();
