// Smart Cube Manager - Web Bluetooth connection, live tracking, and puzzle state verification
import { connectSmartPuzzle, KeyboardPuzzle } from 'cubing/bluetooth';
import { puzzles } from 'cubing/puzzles';
import { Alg } from 'cubing/alg';

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
    this.deviceName = "";
    this.battery = null;
    this.isVirtual = false;
    this.currentPuzzleId = "333";
    this.currentPattern = null;
    this.solvedPatterns = [];
    this.lastMoveTimeStamp = 0;
    this.recentMoves = []; // { move, timeStamp }

    // Bind event handlers
    this._onAlgLeaf = this._onAlgLeaf.bind(this);
    this._onOrientation = this._onOrientation.bind(this);
    this._onDisconnect = this._onDisconnect.bind(this);
  }

  isBluetoothSupported() {
    return typeof navigator !== "undefined" && typeof navigator.bluetooth !== "undefined";
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
      const puzzle = await connectSmartPuzzle(options);
      this.connectedPuzzle = puzzle;
      this.deviceName = puzzle.name() || "Smart Cube";
      this.isVirtual = false;
      this.status = "connected";

      // Listen to moves
      if (typeof puzzle.addAlgLeafListener === "function") {
        puzzle.addAlgLeafListener(this._onAlgLeaf);
      }
      // Listen to orientation if available
      if (typeof puzzle.addOrientationListener === "function") {
        puzzle.addOrientationListener(this._onOrientation);
      }

      // Check battery if available
      if (typeof puzzle.getBattery === "function") {
        try {
          this.battery = await puzzle.getBattery();
        } catch {
          this.battery = null;
        }
      } else {
        this.battery = null;
      }

      // Disconnect listener
      puzzle.addEventListener("disconnect", this._onDisconnect);
      if (puzzle.server?.device) {
        puzzle.server.device.addEventListener("gattserverdisconnected", this._onDisconnect);
      }

      this._emitStatusChange();
      this.dispatchEvent(new CustomEvent("connected", { detail: this.getStatus() }));
      return this.getStatus();
    } catch (err) {
      this.status = "disconnected";
      this.connectedPuzzle = null;
      this.deviceName = "";
      this._emitStatusChange();
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

  disconnect() {
    if (this.connectedPuzzle) {
      try {
        if (typeof this.connectedPuzzle.disconnect === "function") {
          this.connectedPuzzle.disconnect();
        }
      } catch (e) {
        console.warn("Error disconnecting smart puzzle:", e);
      }
    }

    this._onDisconnect();
  }

  _onDisconnect() {
    if (this.status === "disconnected") return;
    this.status = "disconnected";
    this.connectedPuzzle = null;
    this.deviceName = "";
    this.battery = null;
    this.isVirtual = false;
    this._emitStatusChange();
    this.dispatchEvent(new CustomEvent("disconnected"));
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

  handleMove(moveStr, timeStamp = performance.now()) {
    if (!moveStr) return;
    this.lastMoveTimeStamp = timeStamp;

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

    const detail = {
      move: moveStr,
      timeStamp,
      isSolved,
      pattern: this.currentPattern
    };

    this.dispatchEvent(new CustomEvent("move", { detail }));
    return detail;
  }

  async setScramble(scrambleStr, puzzleId = "333") {
    this.currentPuzzleId = puzzleId;
    this.recentMoves = [];
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

  _emitStatusChange() {
    this.dispatchEvent(new CustomEvent("statuschange", { detail: this.getStatus() }));
  }
}

// Global singleton instance
export const smartCube = new SmartCubeManager();
