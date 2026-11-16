// Smart Cube Manager - Web Bluetooth connection, live tracking, and puzzle state verification
import { connectSmartPuzzle, KeyboardPuzzle } from 'cubing/bluetooth';
import { puzzles } from 'cubing/puzzles';
import { Alg } from 'cubing/alg';

let connectSmartCubeFn = null;
let preloadPromise = null;

export function formatMacAddress(str) {
  if (!str || typeof str !== "string") return null;
  const hex = str.trim().replace(/[^0-9A-Fa-f]/g, '').toUpperCase();
  if (hex.length === 12) {
    const parts = [];
    for (let i = 0; i < 12; i += 2) {
      parts.push(hex.slice(i, i + 2));
    }
    return parts.join(':');
  }
  return null;
}

export function checkFaceletsSolved(facelets) {
  if (!facelets || typeof facelets !== "string") return false;
  const str = facelets.trim();
  if (str.length === 54) { // 3x3 (9 stickers * 6 faces: U, R, F, D, L, B)
    const centers = new Set();
    for (let f = 0; f < 6; f++) {
      const center = str[f * 9 + 4];
      if (centers.has(center)) return false;
      centers.add(center);
      for (let i = 0; i < 9; i++) {
        if (str[f * 9 + i] !== center) return false;
      }
    }
    return centers.size === 6;
  } else if (str.length === 24) { // 2x2 (4 stickers * 6 faces)
    const faces = new Set();
    for (let f = 0; f < 6; f++) {
      const first = str[f * 4];
      if (faces.has(first)) return false;
      faces.add(first);
      for (let i = 1; i < 4; i++) {
        if (str[f * 4 + i] !== first) return false;
      }
    }
    return faces.size === 6;
  }
  return false;
}

export function preloadSmartCube() {
  if (connectSmartCubeFn) return Promise.resolve(connectSmartCubeFn);
  if (preloadPromise) return preloadPromise;
  if (typeof window !== "undefined") {
    preloadPromise = import('smartcube-web-bluetooth')
      .then(mod => {
        connectSmartCubeFn = mod.connectSmartCube || mod.default?.connectSmartCube;
        if (!connectSmartCubeFn) preloadPromise = null;
        return connectSmartCubeFn;
      })
      .catch(e => {
        console.warn("Could not preload smartcube-web-bluetooth:", e);
        preloadPromise = null;
        return null;
      });
    return preloadPromise;
  }
  return Promise.resolve(null);
}

// Eagerly initiate preload in browser environments
if (typeof window !== "undefined") {
  preloadSmartCube().catch(() => {});
}

export async function getConnectSmartCube() {
  if (connectSmartCubeFn) return connectSmartCubeFn;
  if (typeof window !== "undefined") {
    return preloadSmartCube();
  } else if (typeof process !== "undefined" && process.versions?.node) {
    try {
      const moduleName = 'node' + ':module';
      const nodeModule = await import(/* @vite-ignore */ moduleName);
      const req = nodeModule.createRequire(import.meta.url);
      const mod = req('smartcube-web-bluetooth');
      connectSmartCubeFn = mod.connectSmartCube;
    } catch (e) {
      // Node test environment
    }
  }
  return connectSmartCubeFn;
}

// Precomputed solved patterns cache for 3x3 and 2x2 in all 24 orientations
const solvedPatternsCache = new Map();

export async function getSolvedPatterns(puzzleId = "333") {
  const normId = puzzleId === "222" ? "2x2x2" : "3x3x3";
  if (solvedPatternsCache.has(normId)) {
    return solvedPatternsCache.get(normId);
  }
  try {
    const pLoader = puzzles[normId];
    if (!pLoader) return [];
    const kpuzzle = await pLoader.kpuzzle();
    const defaultPat = await kpuzzle.defaultPattern();
    const patterns = [defaultPat];
    const visited = new Set([JSON.stringify(defaultPat.patternData)]);

    function addRotations(pat) {
      for (const rot of ["x", "y", "z"]) {
        const next = pat.applyAlg(new Alg(rot));
        const json = JSON.stringify(next.patternData);
        if (!visited.has(json)) {
          visited.add(json);
          patterns.push(next);
          addRotations(next);
        }
      }
    }
    addRotations(defaultPat);
    solvedPatternsCache.set(normId, { kpuzzle, defaultPat, patterns });
    return { kpuzzle, defaultPat, patterns };
  } catch (err) {
    console.warn("Could not precompute solved patterns for", normId, err);
    return null;
  }
}

export class SmartCubeManager extends EventTarget {
  constructor() {
    super();
    this.status = "disconnected"; // "disconnected" | "connecting" | "connected"
    this.connectedPuzzle = null;
    this.smartCubeConn = null;
    this.connSubscription = null;
    this.deviceName = "";
    this.battery = null;
    this.isVirtual = false;
    this.currentPuzzleId = "333";
    this.currentPattern = null;
    this.solvedPatterns = [];
    this.lastMoveTimeStamp = 0;
    this.recentMoves = []; // { move, timeStamp }
    this.manualMac = "";
    this.latestFacelets = "";

    // Diagnostics logger (rolling ring buffer + explicit start/stop recording)
    this.diagRecording = false;
    this.diagLogs = [];
    this.rollingLogs = [];
    this.diagStartTime = 0;

    // Bind event handlers
    this._onAlgLeaf = this._onAlgLeaf.bind(this);
    this._onOrientation = this._onOrientation.bind(this);
    this._onDisconnect = this._onDisconnect.bind(this);
  }

  logDiag(type, data = {}) {
    const now = typeof performance !== "undefined" ? Math.round(performance.now()) : Date.now();
    const entry = {
      t: new Date().toISOString(),
      ms: now,
      type,
      ...data
    };
    this.rollingLogs.push(entry);
    if (this.rollingLogs.length > 400) {
      this.rollingLogs.shift();
    }
    if (this.diagRecording) {
      this.diagLogs.push(entry);
      if (this.diagLogs.length > 5000) {
        this.diagLogs.shift();
      }
      this.dispatchEvent(new CustomEvent("diaglog", { detail: { entry, count: this.diagLogs.length } }));
    }
  }

  startDiagnostics() {
    this.diagRecording = true;
    this.diagStartTime = Date.now();
    // Seed with recent rolling context so starting right after an issue still captures what happened!
    this.diagLogs = [...this.rollingLogs];
    this.logDiag("DIAG_START", {
      deviceName: this.deviceName,
      status: this.status,
      battery: this.battery,
      isVirtual: this.isVirtual
    });
    this._emitStatusChange();
    return this.diagLogs.length;
  }

  stopDiagnostics() {
    if (this.diagRecording) {
      this.logDiag("DIAG_STOP", { totalEntries: this.diagLogs.length });
    }
    this.diagRecording = false;
    this._emitStatusChange();
    return this.diagLogs.length;
  }

  clearDiagnostics() {
    this.diagLogs = [];
    this.rollingLogs = [];
    this._emitStatusChange();
  }

  exportDiagnosticsReport(extraContext = {}) {
    const logsToExport = this.diagLogs.length > 0 ? this.diagLogs : this.rollingLogs;
    return JSON.stringify({
      exportedAt: new Date().toISOString(),
      deviceName: this.deviceName || "None",
      status: this.status,
      battery: this.battery,
      isVirtual: this.isVirtual,
      diagRecording: this.diagRecording,
      ...extraContext,
      logCount: logsToExport.length,
      logs: logsToExport
    }, null, 2);
  }

  isBluetoothSupported() {
    return typeof navigator !== "undefined" && typeof navigator.bluetooth !== "undefined";
  }

  setManualMac(macStr) {
    const formatted = formatMacAddress(macStr);
    this.manualMac = formatted || (macStr ? macStr.trim() : "");
    return this.manualMac;
  }

  getSavedCubes() {
    if (typeof localStorage === "undefined") return [];
    let list = [];
    let deletedSet = new Set();
    try {
      const rawDeleted = localStorage.getItem("cll_deleted_smart_cubes");
      if (rawDeleted) {
        const parsedDel = JSON.parse(rawDeleted);
        if (Array.isArray(parsedDel)) deletedSet = new Set(parsedDel);
      }
    } catch {}

    try {
      const raw = localStorage.getItem("cll_saved_smart_cubes");
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          list = parsed
            .filter(c => c && c.name && !deletedSet.has(c.name))
            .map(c => ({
              ...c,
              mac: this._isVendorMatch(c.mac, c.name) ? (formatMacAddress(c.mac) || c.mac || "") : ""
            }));
        }
      }
    } catch {}

    // Auto-seed from existing cll_cube_mac_<deviceName> entries in localStorage
    let changed = false;
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith("cll_cube_mac_") && !k.startsWith("cll_cube_mac_suffix_")) {
          const devName = k.slice("cll_cube_mac_".length).trim();
          if (!devName || deletedSet.has(devName)) continue;
          const mac = localStorage.getItem(k) || "";
          const existing = list.find(c => c.name === devName);
          if (!existing) {
            list.push({
              name: devName,
              mac: formatMacAddress(mac) || mac,
              protocol: this._inferProtocolLabel(devName),
              lastConnected: Date.now()
            });
            changed = true;
          } else if (mac && !existing.mac) {
            existing.mac = formatMacAddress(mac) || mac;
            changed = true;
          }
        }
      }
      if (changed) {
        localStorage.setItem("cll_saved_smart_cubes", JSON.stringify(list));
      }
    } catch {}

    list.sort((a, b) => (b.lastConnected || 0) - (a.lastConnected || 0));
    return list;
  }

  _inferProtocolLabel(name = "") {
    const u = String(name).toUpperCase();
    if (u.startsWith("WCU_MY3") || u.includes("MOYU")) return "MoYu AI";
    if (u.startsWith("GAN") || u.startsWith("MG") || u.startsWith("AICUBE")) return "GAN";
    if (u.startsWith("QY") || u.includes("QIYI")) return "QiYi";
    if (u.startsWith("GI")) return "Giiker";
    return "Smart Cube";
  }

  saveConnectedCube({ name, mac = "", protocol = "" } = {}) {
    if (!name || name === "Virtual Keyboard Cube" || typeof localStorage === "undefined") return;
    try {
      const rawDeleted = localStorage.getItem("cll_deleted_smart_cubes");
      if (rawDeleted) {
        const parsedDel = JSON.parse(rawDeleted);
        if (Array.isArray(parsedDel) && parsedDel.includes(name)) {
          localStorage.setItem(
            "cll_deleted_smart_cubes",
            JSON.stringify(parsedDel.filter(n => n !== name))
          );
        }
      }
    } catch {}

    const list = this.getSavedCubes();
    const storedMac = mac || (typeof localStorage !== "undefined" ? localStorage.getItem(`cll_cube_mac_${name}`) || "" : "");
    const cleanMac = formatMacAddress(storedMac) || storedMac || "";
    const protoLabel = protocol || this._inferProtocolLabel(name);
    const idx = list.findIndex(c => c.name === name);
    const entry = {
      name,
      mac: cleanMac || (idx >= 0 ? list[idx].mac : ""),
      protocol: protoLabel || (idx >= 0 ? list[idx].protocol : "Smart Cube"),
      lastConnected: Date.now()
    };
    if (idx >= 0) {
      list.splice(idx, 1);
    }
    list.unshift(entry);
    try {
      localStorage.setItem("cll_saved_smart_cubes", JSON.stringify(list.slice(0, 20)));
    } catch {}
    this.dispatchEvent(new CustomEvent("savedcubeschange", { detail: { cubes: list } }));
  }

  removeSavedCube(name) {
    if (!name || typeof localStorage === "undefined") return [];
    const list = this.getSavedCubes().filter(c => c.name !== name);
    try {
      localStorage.setItem("cll_saved_smart_cubes", JSON.stringify(list));
      localStorage.removeItem(`cll_cube_mac_${name}`);
      const rawDeleted = localStorage.getItem("cll_deleted_smart_cubes");
      const delArr = rawDeleted ? JSON.parse(rawDeleted) : [];
      if (Array.isArray(delArr) && !delArr.includes(name)) {
        delArr.push(name);
        localStorage.setItem("cll_deleted_smart_cubes", JSON.stringify(delArr));
      }
    } catch {}
    this.dispatchEvent(new CustomEvent("savedcubeschange", { detail: { cubes: list } }));
    return list;
  }

  async reconnectSavedCube(nameOrEntry, extraOptions = {}) {
    const list = this.getSavedCubes();
    const entry = typeof nameOrEntry === "string"
      ? (list.find(c => c.name === nameOrEntry) || { name: nameOrEntry, mac: "" })
      : (nameOrEntry || {});
    const mac = entry.mac || (typeof localStorage !== "undefined" && entry.name ? localStorage.getItem(`cll_cube_mac_${entry.name}`) : "") || "";
    if (mac) {
      this.setManualMac(mac);
      if (entry.name) {
        this.cacheMacAddress({ name: entry.name }, mac);
      }
    }
    return this.connect({
      ...extraOptions,
      preferredDeviceName: entry.name || undefined,
      manualMac: mac || extraOptions.manualMac || undefined
    });
  }

  cacheMacAddress(device, mac) {
    if (!mac) return;
    const clean = formatMacAddress(mac) || mac.toUpperCase();
    if (typeof localStorage !== "undefined") {
      try {
        if (device?.id) {
          localStorage.setItem(`smartcube-ble-mac:${device.id}`, clean);
        }
        if (device?.name) {
          localStorage.setItem(`cll_cube_mac_${device.name}`, clean);
          const suffixMatch = /_([0-9A-Fa-f]{4})$/.exec(device.name);
          if (suffixMatch) {
            localStorage.setItem(`cll_cube_mac_suffix_${suffixMatch[1].toUpperCase()}`, clean);
          }
          this.saveConnectedCube({ name: device.name, mac: clean });
        }
      } catch (e) {
        console.warn("Could not cache MAC to localStorage:", e);
      }
    }
  }

  _isVendorMatch(mac, devName) {
    if (!mac || !devName) return true;
    const clean = formatMacAddress(mac) || mac.toUpperCase();
    const uName = devName.toUpperCase();
    // MoYu MY32 / MY22 / MY33 cubes always have CF:30:16:... MAC addresses
    if (uName.startsWith("WCU_")) {
      if (!clean.startsWith("CF:30:16:")) return false;
      const suffixMatch = /_([0-9A-F]{4})$/.exec(uName);
      if (suffixMatch) {
        const s = suffixMatch[1];
        const expectedTail = `${s.slice(0, 2)}:${s.slice(2, 4)}`;
        if (!clean.endsWith(expectedTail)) return false;
      }
      return true;
    }
    // GAN cubes never have MoYu's CF:30:16:... prefix
    if (uName.startsWith("GAN") || uName.startsWith("MG") || uName.startsWith("AICUBE")) {
      if (clean.startsWith("CF:30:16:")) return false;
    }
    return true;
  }

  async resolveMacAddress(device, isFallbackCall = false) {
    const devId = device?.id || "";
    const devName = device?.name || "";

    // 1. Check smartcube-web-bluetooth standard key in localStorage
    if (typeof localStorage !== "undefined" && devId) {
      try {
        const stored = localStorage.getItem(`smartcube-ble-mac:${devId}`);
        if (stored && this._isVendorMatch(stored, devName)) return stored;
      } catch {}
    }

    // 2. Check trainer custom MAC keys for this device name or suffix
    if (typeof localStorage !== "undefined" && devName) {
      try {
        const storedNameMac = localStorage.getItem(`cll_cube_mac_${devName}`);
        if (storedNameMac && this._isVendorMatch(storedNameMac, devName)) {
          this.cacheMacAddress(device, storedNameMac);
          return storedNameMac;
        }

        const suffixMatch = /_([0-9A-Fa-f]{4})$/.exec(devName);
        if (suffixMatch) {
          const suffixKey = `cll_cube_mac_suffix_${suffixMatch[1].toUpperCase()}`;
          const storedSuffixMac = localStorage.getItem(suffixKey);
          if (storedSuffixMac && this._isVendorMatch(storedSuffixMac, devName)) {
            this.cacheMacAddress(device, storedSuffixMac);
            return storedSuffixMac;
          }
        }
      } catch {}
    }

    // 3. Check if user configured manual MAC in UI (only if it matches the selected cube vendor)
    if (this.manualMac && this.manualMac.trim()) {
      const clean = formatMacAddress(this.manualMac) || this.manualMac.trim();
      if (this._isVendorMatch(clean, devName)) {
        this.cacheMacAddress(device, clean);
        return clean;
      } else {
        this.logDiag("MAC_VENDOR_MISMATCH_IGNORED", { manualMac: clean, deviceName: devName });
      }
    }

    // 4. If fallback call (meaning advertisement manufacturer data & candidate probing both failed):
    if (isFallbackCall) {
      // For WCU_MY32 / MY22 / MY33 cubes, derive standard CF:30:16:00:XX:YY fallback from name suffix before prompting
      const moyuMatch = /^WCU_MY(22|32|33)_([0-9A-Fa-f]{4})$/i.exec(devName.trim());
      if (moyuMatch && (!this.manualMac || !this._isVendorMatch(this.manualMac, devName))) {
        const kind = moyuMatch[1];
        const hex = moyuMatch[2].toUpperCase();
        const mid = kind === "22" ? "01" : (kind === "33" ? "02" : "00");
        const autoMoyuMac = `CF:30:16:${mid}:${hex.slice(0, 2)}:${hex.slice(2, 4)}`;
        this.logDiag("MOYU_FALLBACK_MAC", { deviceName: devName, mac: autoMoyuMac });
        return autoMoyuMac;
      }

      if (typeof window !== "undefined" && typeof window.prompt === "function") {
        const hint = devName.includes("GAN") ? " (printed on GAN box / barcode / Bluetooth settings)" : "";
        const entered = window.prompt(
          `Unable to auto-detect MAC address for "${devName}"${hint}.\nPlease enter the 6-byte Bluetooth MAC address (e.g. AA:BB:CC:DD:EE:FF or 12 hex digits):`,
          ""
        );
        if (entered && entered.trim()) {
          const clean = formatMacAddress(entered.trim()) || entered.trim().toUpperCase();
          this.cacheMacAddress(device, clean);
          return clean;
        }
      }
    }

    return null;
  }

  getStatus() {
    return {
      status: this.status,
      connected: this.status === "connected",
      deviceName: this.deviceName,
      battery: this.battery,
      isVirtual: this.isVirtual,
      recentMoves: this.recentMoves
    };
  }

  async connect(options = {}) {
    if (this.status === "connected") {
      this.disconnect();
    }

    if (!this.isBluetoothSupported()) {
      const err = new Error(
        "Web Bluetooth is not supported in this browser. Please use Chrome, Edge, Opera, or Bluefy (iOS), or use the Virtual / Keyboard Cube."
      );
      err.code = "NOT_SUPPORTED";
      throw err;
    }

    this.status = "connecting";
    this._emitStatusChange();

    try {
      if (options.manualMac) {
        this.setManualMac(options.manualMac);
      }

      // Check if user specifically requested cubing/bluetooth legacy engine
      if (options.engine === "cubing") {
        const puzzle = await connectSmartPuzzle(options);
        this.connectedPuzzle = puzzle;
        this.deviceName = puzzle.name() || "Smart Cube";
        this.isVirtual = false;
        this.status = "connected";
        this.saveConnectedCube({ name: this.deviceName, mac: this.manualMac });

        if (typeof puzzle.addAlgLeafListener === "function") {
          puzzle.addAlgLeafListener(this._onAlgLeaf);
        }
        if (typeof puzzle.addOrientationListener === "function") {
          puzzle.addOrientationListener(this._onOrientation);
        }
        if (typeof puzzle.getBattery === "function") {
          try { this.battery = await puzzle.getBattery(); } catch { this.battery = null; }
        }
        puzzle.addEventListener("disconnect", this._onDisconnect);
        if (puzzle.server?.device) {
          puzzle.server.device.addEventListener("gattserverdisconnected", this._onDisconnect);
        }
        this._emitStatusChange();
        this.dispatchEvent(new CustomEvent("connected", { detail: this.getStatus() }));
        return this.getStatus();
      }

      // Standard modern driver via smartcube-web-bluetooth (GAN Gen1-Gen4, MoYu V10 AI/MY32, QiYi, etc.)
      const connectSmartCube = await getConnectSmartCube();
      if (typeof connectSmartCube !== "function") {
        throw new Error("Smart cube connection library is not loaded. Please try again.");
      }

      const connectOptions = {
        enableAddressSearch: true, // Enables candidate probing for MoYu WeiLong V10 AI (WCU_MY32_xxxx)
        deviceSelection: options.deviceSelection || "filtered",
        onStatus: (msg) => {
          this.dispatchEvent(new CustomEvent("progress", { detail: { message: msg } }));
        },
        macAddressProvider: (dev, isFallback) => this.resolveMacAddress(dev, isFallback),
        ...options
      };

      const conn = await connectSmartCube(connectOptions);
      this.smartCubeConn = conn;
      this.deviceName = conn.deviceName || (conn.protocol?.name ? `${conn.protocol.name} Cube` : "Smart Cube");
      const actualMac = conn.deviceMAC && conn.deviceMAC !== "00:00:00:00:00:00"
        ? conn.deviceMAC
        : (this._isVendorMatch(this.manualMac, this.deviceName) ? this.manualMac : "");
      this.isVirtual = false;
      this.status = "connected";
      if (actualMac) {
        this.cacheMacAddress({ name: this.deviceName }, actualMac);
      } else {
        this.saveConnectedCube({
          name: this.deviceName,
          mac: "",
          protocol: conn.protocol?.name || ""
        });
      }
      this.logDiag("CONNECT", {
        deviceName: this.deviceName,
        mac: actualMac,
        protocol: conn.protocol?.name || "unknown"
      });

      if (conn.events$) {
        this.connSubscription = conn.events$.subscribe((event) => {
          if (!event) return;
          if (event.type === "MOVE") {
            const timeStamp = event.localTimestamp || event.timestamp || performance.now();
            this.logDiag("BLE_MOVE_RAW", {
              move: event.move,
              serial: event.serial,
              cubeTimestamp: event.cubeTimestamp,
              localTimestamp: event.localTimestamp
            });
            this.handleMove(event.move, timeStamp);
          } else if (event.type === "FACELETS" && event.facelets) {
            this.logDiag("BLE_FACELETS", {
              serial: event.serial,
              facelets: event.facelets
            });
            this.handleFacelets(event.facelets);
          } else if (event.type === "BATTERY") {
            this.battery = event.batteryLevel;
            this.logDiag("BLE_BATTERY", { batteryLevel: event.batteryLevel });
            this._emitStatusChange();
          } else if (event.type === "HARDWARE") {
            this.logDiag("BLE_HARDWARE", {
              hardwareName: event.hardwareName,
              hardwareVersion: event.hardwareVersion,
              softwareVersion: event.softwareVersion
            });
          } else if (event.type === "GYRO" && event.quaternion) {
            this.dispatchEvent(new CustomEvent("orientation", { detail: { quaternion: event.quaternion } }));
          } else if (event.type === "DISCONNECT") {
            this.logDiag("BLE_DISCONNECT", {});
            this._onDisconnect();
          }
        });
      }

      if (conn.capabilities?.battery && typeof conn.sendCommand === "function") {
        conn.sendCommand({ type: "REQUEST_BATTERY" }).catch(() => {});
      }

      this._emitStatusChange();
      this.dispatchEvent(new CustomEvent("connected", { detail: this.getStatus() }));
      return this.getStatus();
    } catch (err) {
      this.status = "disconnected";
      this.connectedPuzzle = null;
      this.smartCubeConn = null;
      this.deviceName = "";
      this._emitStatusChange();
      // Important: do not chain a secondary requestDevice call here, as that triggers
      // "Must be handling a user gesture to show a permission request" in Web Bluetooth
      throw err;
    }
  }

  async connectVirtual(targetElem = null, puzzleId = "333") {
    if (this.status === "connected") {
      this.disconnect();
    }

    this.status = "connecting";
    this._emitStatusChange();

    try {
      this.currentPuzzleId = puzzleId;
      const target = targetElem || (typeof document !== "undefined" ? document.body : null);
      const normPuzzle = puzzleId === "222" ? "2x2x2" : "3x3x3";
      
      let puzzle = null;
      if (target && typeof KeyboardPuzzle === "function") {
        try {
          puzzle = new KeyboardPuzzle(target, normPuzzle);
        } catch (e) {
          console.warn("KeyboardPuzzle init fallback:", e);
        }
      }

      this.connectedPuzzle = puzzle;
      this.deviceName = "Virtual Keyboard Cube";
      this.isVirtual = true;
      this.battery = 100;
      this.status = "connected";

      if (puzzle && typeof puzzle.addAlgLeafListener === "function") {
        puzzle.addAlgLeafListener(this._onAlgLeaf);
      }

      this._emitStatusChange();
      this.dispatchEvent(new CustomEvent("connected", { detail: this.getStatus() }));
      return this.getStatus();
    } catch (err) {
      this.status = "disconnected";
      this.connectedPuzzle = null;
      this._emitStatusChange();
      throw err;
    }
  }

  disconnect(reason = "manual") {
    if (this.connSubscription) {
      try {
        this.connSubscription.unsubscribe();
      } catch (e) {}
      this.connSubscription = null;
    }

    if (this.smartCubeConn) {
      try {
        if (typeof this.smartCubeConn.disconnect === "function") {
          this.smartCubeConn.disconnect().catch(() => {});
        }
      } catch (e) {
        console.warn("Error disconnecting smart cube connection:", e);
      }
      this.smartCubeConn = null;
    }

    if (this.connectedPuzzle) {
      try {
        if (typeof this.connectedPuzzle.disconnect === "function") {
          this.connectedPuzzle.disconnect();
        }
      } catch (e) {
        console.warn("Error disconnecting smart puzzle:", e);
      }
      this.connectedPuzzle = null;
    }

    this._onDisconnect(reason);
  }

  hardReset() {
    this.disconnect("manual");

    // Clear all MAC caches, saved cubes, and Bluetooth hints from localStorage
    if (typeof localStorage !== "undefined") {
      try {
        const keysToRemove = [
          "cll_saved_smart_cubes",
          "cll_deleted_smart_cubes",
          "cll_smartcube_last_mac"
        ];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && (key.startsWith("smartcube-ble-mac:") || key.startsWith("cll_cube_mac_"))) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach(k => {
          try { localStorage.removeItem(k); } catch {}
        });
      } catch (e) {
        console.warn("Could not clear MAC storage cache:", e);
      }
    }

    // Also revoke any granted Web Bluetooth device permissions if supported by the browser
    if (typeof navigator !== "undefined" && navigator.bluetooth && typeof navigator.bluetooth.getDevices === "function") {
      navigator.bluetooth.getDevices().then(devices => {
        if (!Array.isArray(devices)) return;
        devices.forEach(dev => {
          try {
            if (dev.gatt?.connected) dev.gatt.disconnect();
            if (typeof dev.forget === "function") dev.forget().catch(() => {});
          } catch {}
        });
      }).catch(() => {});
    }

    this.manualMac = "";
    this.latestFacelets = "";
    this.recentMoves = [];
    this.currentPattern = null;
    this.status = "disconnected";
    this.deviceName = "";
    this.battery = null;
    this.isVirtual = false;

    if (typeof document !== "undefined") {
      document.body.style.overflow = "";
    }

    this._emitStatusChange();
    this.dispatchEvent(new CustomEvent("savedcubeschange", { detail: { cubes: [] } }));
    this.dispatchEvent(new CustomEvent("disconnected", { detail: { reason: "manual", deviceName: "" } }));
    this.dispatchEvent(new CustomEvent("hardreset"));
    return true;
  }

  _onDisconnect(reason = "unexpected") {
    if (this.status === "disconnected") return;
    const prevDeviceName = this.deviceName || "Smart Cube";
    const wasVirtual = this.isVirtual;
    this.status = "disconnected";
    if (this.connSubscription) {
      try {
        this.connSubscription.unsubscribe();
      } catch (e) {}
      this.connSubscription = null;
    }
    this.smartCubeConn = null;
    this.connectedPuzzle = null;
    this.deviceName = "";
    this.latestFacelets = "";
    this.battery = null;
    this.isVirtual = false;
    this.logDiag("DISCONNECT", { reason, deviceName: prevDeviceName });
    this._emitStatusChange();
    this.dispatchEvent(new CustomEvent("disconnected", {
      detail: { reason, deviceName: prevDeviceName, isVirtual: wasVirtual }
    }));
  }

  _onAlgLeaf(event) {
    if (!event || !event.latestAlgLeaf) return;
    const moveStr = event.latestAlgLeaf.toString();
    if (!moveStr) return;
    const timeStamp = event.timeStamp || performance.now();
    this.handleMove(moveStr, timeStamp);
  }

  _onOrientation(event) {
    if (!event || !event.quaternion) return;
    this.dispatchEvent(new CustomEvent("orientation", { detail: { quaternion: event.quaternion } }));
  }

  handleFacelets(facelets) {
    if (!facelets || typeof facelets !== "string") return;
    this.latestFacelets = facelets;
    const isSolved = checkFaceletsSolved(facelets);
    this.logDiag("FACELETS_CHECK", { isSolved, facelets });
    if (isSolved) {
      if (this.currentPattern && this.solvedPatterns && this.solvedPatterns.length > 0) {
        if (!this.solvedPatterns.some(p => p.isIdentical(this.currentPattern))) {
          this.currentPattern = this.solvedPatterns[0];
        }
      }
      this.dispatchEvent(new CustomEvent("solved", { detail: { facelets, isSolved: true } }));
      this.dispatchEvent(new CustomEvent("move", { detail: { move: null, isSolved: true, facelets } }));
    }
  }

  checkFaceletsSolved(facelets) {
    return checkFaceletsSolved(facelets);
  }

  handleMove(moveStr, timeStamp = performance.now()) {
    if (!moveStr) return;
    const prevMoveTs = this.lastMoveTimeStamp;
    const dtMs = prevMoveTs > 0 ? Math.round(timeStamp - prevMoveTs) : null;
    this.lastMoveTimeStamp = timeStamp;
    // Clear cached facelets on a new move so stale facelets never falsely mark a moved cube as solved
    this.latestFacelets = "";

    // Maintain recent moves stream
    this.recentMoves.push({ move: moveStr, timeStamp });
    if (this.recentMoves.length > 30) {
      this.recentMoves.shift();
    }

    // Apply to current mathematical pattern if tracking
    let isSolved = false;
    if (this.currentPattern) {
      try {
        const alg = new Alg(moveStr);
        this.currentPattern = this.currentPattern.applyAlg(alg);
        if (this.solvedPatterns && this.solvedPatterns.length > 0) {
          isSolved = this.solvedPatterns.some(p => p.isIdentical(this.currentPattern));
        }
      } catch (e) {
        console.warn("Could not apply move to pattern:", moveStr, e);
      }
    }

    this.logDiag("HANDLE_MOVE", {
      move: moveStr,
      dtMs,
      isSolved
    });

    const detail = {
      move: moveStr,
      timeStamp,
      isSolved,
      pattern: this.currentPattern
    };

    this.dispatchEvent(new CustomEvent("move", { detail }));
    if (isSolved) {
      this.dispatchEvent(new CustomEvent("solved", { detail }));
    }
    return detail;
  }

  async setScramble(scrambleStr, puzzleId = "333") {
    this.currentPuzzleId = puzzleId;
    this.recentMoves = [];
    this.logDiag("SET_SCRAMBLE", { scramble: scrambleStr, puzzleId });
    try {
      const info = await getSolvedPatterns(puzzleId);
      if (!info) return;
      this.solvedPatterns = info.patterns;
      if (scrambleStr && scrambleStr.trim()) {
        const alg = new Alg(scrambleStr.trim());
        this.currentPattern = info.defaultPat.applyAlg(alg);
      } else {
        this.currentPattern = info.defaultPat;
      }
    } catch (e) {
      console.warn("Could not set scramble pattern:", e);
    }
  }

  isCurrentPatternSolved() {
    if (!this.currentPattern || !this.solvedPatterns || this.solvedPatterns.length === 0) {
      return false;
    }
    return this.solvedPatterns.some(p => p.isIdentical(this.currentPattern));
  }

  isCubeSolved() {
    if (this.latestFacelets && checkFaceletsSolved(this.latestFacelets)) {
      return true;
    }
    return this.isCurrentPatternSolved();
  }

  _emitStatusChange() {
    this.dispatchEvent(new CustomEvent("statuschange", { detail: this.getStatus() }));
  }
}

// Global singleton instance
export const smartCube = new SmartCubeManager();
