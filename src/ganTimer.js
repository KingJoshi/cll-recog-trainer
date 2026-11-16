// GAN Smart Timer (Bluetooth) manager + pick-up / put-down phase helpers.
//
// The GAN Smart Timer / GAN Halo timer reports state changes over BLE:
//   IDLE -> HANDS_ON -> GET_SET -> RUNNING -> STOPPED (with recorded time) -> FINISHED -> IDLE
// The timer itself is the authoritative source of the solve time. When a smart cube
// is connected at the same time we additionally measure:
//   pick-up  = timer start  -> first face turn on the smart cube
//   cube     = first turn   -> smart cube reaches solved state
//   put-down = cube solved  -> timer stopped

// Mirrors GanTimerState enum from smartcube-web-bluetooth (kept local so this module
// can be imported in Node tests without loading Web Bluetooth code).
export const GAN_TIMER_STATE_NAMES = {
  0: "DISCONNECT",
  1: "GET_SET",
  2: "HANDS_OFF",
  3: "RUNNING",
  4: "STOPPED",
  5: "IDLE",
  6: "HANDS_ON",
  7: "FINISHED"
};

export function ganTimerStateName(state) {
  if (typeof state === "string") return state;
  return GAN_TIMER_STATE_NAMES[state] || "UNKNOWN";
}

/**
 * Compute pick-up / cube / put-down splits from local timestamps (performance.now()).
 * Any phase that cannot be determined (missing or inconsistent timestamps) is null.
 */
export function computeSolvePhaseSplits({ timerStartTs, firstMoveTs, solvedTs, timerStopTs } = {}) {
  const valid = (v) => typeof v === "number" && Number.isFinite(v) && v > 0;
  const diff = (a, b) => {
    if (!valid(a) || !valid(b)) return null;
    const d = Math.round(b - a);
    return d >= 0 ? d : null;
  };
  const pickupMs = diff(timerStartTs, firstMoveTs);
  const cubeMs = diff(firstMoveTs, solvedTs);
  const putdownMs = diff(solvedTs, timerStopTs);
  return { pickupMs, cubeMs, putdownMs };
}

/**
 * Determines whether a GAN Smart Timer STOPPED event during a running timer-driven solve
 * should be ignored as a premature/false stop (e.g., capacitive pad bounce when lifting hands)
 * when a Bluetooth Smart Cube is actively tracking the solve.
 */
export function shouldIgnorePrematureTimerStop({
  smartCubeConnected = false,
  smartCubeStage = "idle",
  cubeSolved = false,
  moveCount = 0,
  firstMoveTs = 0,
  elapsedMs = 0
} = {}) {
  if (!smartCubeConnected || smartCubeStage !== "solving") return false;
  if (cubeSolved) return false;
  if (moveCount === 0 || !firstMoveTs) return true;
  if (Number.isFinite(elapsedMs) && elapsedMs > 0 && elapsedMs < 2000) return true;
  return false;
}

/**
 * Average of a numeric field over solves that have it (ignores DNFs). Returns null if none.
 */
export function averagePhase(solves = [], field = "pickupMs") {
  const vals = (solves || [])
    .filter(s => s && s.penalty !== "DNF" && s.penalty !== -1)
    .map(s => s[field])
    .filter(v => typeof v === "number" && Number.isFinite(v));
  if (!vals.length) return null;
  return Math.round(vals.reduce((a, b) => a + b, 0) / vals.length);
}

let connectGanTimerFn = null;
let preloadGanTimerPromise = null;

export function preloadGanTimer() {
  if (connectGanTimerFn) return Promise.resolve(connectGanTimerFn);
  if (preloadGanTimerPromise) return preloadGanTimerPromise;
  if (typeof window !== "undefined") {
    preloadGanTimerPromise = import('smartcube-web-bluetooth')
      .then(mod => {
        connectGanTimerFn = mod.connectGanTimer || mod.default?.connectGanTimer;
        if (!connectGanTimerFn) preloadGanTimerPromise = null;
        return connectGanTimerFn;
      })
      .catch(e => {
        console.warn("Could not preload smartcube-web-bluetooth for GAN timer:", e);
        preloadGanTimerPromise = null;
        return null;
      });
    return preloadGanTimerPromise;
  }
  return Promise.resolve(null);
}

if (typeof window !== "undefined") {
  preloadGanTimer().catch(() => {});
}

async function loadConnectGanTimer() {
  if (connectGanTimerFn) return connectGanTimerFn;
  if (typeof window !== "undefined") {
    const fn = await preloadGanTimer();
    if (fn) return fn;
  }
  const mod = await import('smartcube-web-bluetooth');
  connectGanTimerFn = mod.connectGanTimer || mod.default?.connectGanTimer;
  return connectGanTimerFn;
}

export class GanTimerManager extends EventTarget {
  constructor() {
    super();
    this.status = "disconnected"; // "disconnected" | "connecting" | "connected"
    this.conn = null;
    this.subscription = null;
    this.lastState = null;
    this.deviceName = "";
    this._manualDisconnecting = false;
    this._watchdogInterval = null;
    this._boundGattDisconnect = () => this._handleDisconnect("unexpected");
    this._onEvent = this._onEvent.bind(this);
  }

  isBluetoothSupported() {
    return typeof navigator !== "undefined" && typeof navigator.bluetooth !== "undefined";
  }

  isConnected() {
    return this.status === "connected";
  }

  getStatus() {
    return {
      status: this.status,
      connected: this.status === "connected",
      state: this.lastState,
      deviceName: this.deviceName || "GAN Smart Timer"
    };
  }

  // Must be called directly from a user gesture (click) because it opens the BLE picker.
  async connect() {
    if (this.status === "connected") return this.getStatus();
    if (!this.isBluetoothSupported()) {
      const err = new Error("Web Bluetooth is not supported in this browser. Please use Chrome, Edge, Opera, or Bluefy (iOS).");
      err.code = "NOT_SUPPORTED";
      throw err;
    }
    this._manualDisconnecting = false;
    // Start loading before flipping state so requestDevice stays within the user gesture window.
    const loader = connectGanTimerFn ? Promise.resolve(connectGanTimerFn) : loadConnectGanTimer();
    this._setStatus("connecting");
    try {
      const connectGanTimer = await loader;
      if (typeof connectGanTimer !== "function") {
        throw new Error("GAN timer library is not loaded. Please try again.");
      }
      const conn = await connectGanTimer();
      this.conn = conn;
      this.deviceName = conn?.device?.name || "GAN Smart Timer";
      if (conn?.device && typeof conn.device.addEventListener === "function") {
        conn.device.addEventListener("gattserverdisconnected", this._boundGattDisconnect);
      }
      this._startWatchdog();
      this.subscription = conn.events$.subscribe({
        next: this._onEvent,
        error: (err) => {
          console.warn("GAN timer event error:", err);
          this._handleDisconnect("unexpected");
        },
        complete: () => this._handleDisconnect(this._manualDisconnecting ? "manual" : "unexpected")
      });
      this._setStatus("connected");
      this.dispatchEvent(new CustomEvent("connected", { detail: { deviceName: this.deviceName } }));
      return this.getStatus();
    } catch (err) {
      this._stopWatchdog();
      this.conn = null;
      this._setStatus("disconnected");
      throw err;
    }
  }

  disconnect() {
    this._manualDisconnecting = true;
    const conn = this.conn;
    if (conn && typeof conn.disconnect === "function") {
      try {
        const p = conn.disconnect();
        if (p && typeof p.catch === "function") p.catch(() => {});
      } catch {}
    }
    this._handleDisconnect("manual");
  }

  async getRecordedTimes() {
    if (!this.conn || typeof this.conn.getRecordedTimes !== "function") return null;
    return this.conn.getRecordedTimes();
  }

  _startWatchdog() {
    this._stopWatchdog();
    if (typeof setInterval === "undefined") return;
    this._watchdogInterval = setInterval(() => {
      if (this.status !== "connected") {
        this._stopWatchdog();
        return;
      }
      const dev = this.conn?.device;
      if (dev && dev.gatt && dev.gatt.connected === false) {
        this._handleDisconnect("unexpected");
      }
    }, 1500);
  }

  _stopWatchdog() {
    if (this._watchdogInterval) {
      clearInterval(this._watchdogInterval);
      this._watchdogInterval = null;
    }
  }

  _onEvent(evt) {
    if (!evt) return;
    const ts = typeof performance !== "undefined" ? performance.now() : Date.now();
    const state = ganTimerStateName(evt.state);
    if (state === "DISCONNECT") {
      this._handleDisconnect(this._manualDisconnecting ? "manual" : "unexpected");
      return;
    }
    this.lastState = state;
    const recordedMs = evt.recordedTime && Number.isFinite(evt.recordedTime.asTimestamp)
      ? evt.recordedTime.asTimestamp
      : null;
    this.dispatchEvent(new CustomEvent("timerstate", { detail: { state, recordedMs, ts } }));
  }

  _handleDisconnect(reason = "unexpected") {
    this._stopWatchdog();
    if (this.conn?.device && typeof this.conn.device.removeEventListener === "function") {
      try {
        this.conn.device.removeEventListener("gattserverdisconnected", this._boundGattDisconnect);
      } catch {}
    }
    if (this.subscription) {
      try { this.subscription.unsubscribe(); } catch {}
      this.subscription = null;
    }
    const wasConnected = this.status === "connected";
    const prevName = this.deviceName || "GAN Smart Timer";
    const finalReason = this._manualDisconnecting ? "manual" : reason;
    this.conn = null;
    this.lastState = null;
    this._manualDisconnecting = false;
    if (wasConnected || this.status === "connecting") {
      this._setStatus("disconnected");
      if (wasConnected) {
        this.dispatchEvent(new CustomEvent("disconnected", {
          detail: { reason: finalReason, deviceName: prevName }
        }));
      }
    }
  }

  _setStatus(status) {
    this.status = status;
    this.dispatchEvent(new CustomEvent("statuschange", { detail: this.getStatus() }));
  }
}

export const ganTimer = new GanTimerManager();
