// Smart-Cube Gyroscope Orientation Tracker: maps continuous quaternion telemetry
// into discrete WCA cube rotation tokens (x, x', x2, y, y', y2, z, z', z2) with wobble hysteresis.

const SQRT1_2 = Math.SQRT1_2;

// GAN coordinate convention: +X = Red (R), +Y = Blue (B), +Z = White (U).
// Right-handed intrinsic quarter-turns for WCA x (R), y (U), z (F):
const GENERATOR_QUATS = {
  "x":  { x: -SQRT1_2, y: 0,         z: 0,         w: SQRT1_2 },
  "x'": { x:  SQRT1_2, y: 0,         z: 0,         w: SQRT1_2 },
  "y":  { x: 0,         y: 0,         z: -SQRT1_2, w: SQRT1_2 },
  "y'": { x: 0,         y: 0,         z:  SQRT1_2, w: SQRT1_2 },
  "z":  { x: 0,         y:  SQRT1_2, z: 0,         w: SQRT1_2 },
  "z'": { x: 0,         y: -SQRT1_2, z: 0,         w: SQRT1_2 }
};

export function quatNormalize(q) {
  if (!q || typeof q !== "object") return { x: 0, y: 0, z: 0, w: 1 };
  const x = Number(q.x) || 0;
  const y = Number(q.y) || 0;
  const z = Number(q.z) || 0;
  const w = Number(q.w);
  const ww = Number.isFinite(w) ? w : 1;
  const mag = Math.hypot(x, y, z, ww);
  if (mag < 1e-8) return { x: 0, y: 0, z: 0, w: 1 };
  return { x: x / mag, y: y / mag, z: z / mag, w: ww / mag };
}

export function quatConjugate(q) {
  return { x: -q.x, y: -q.y, z: -q.z, w: q.w };
}

export function quatMultiply(a, b) {
  return {
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z
  };
}

export function quatAbsDot(a, b) {
  return Math.min(1, Math.abs(a.x * b.x + a.y * b.y + a.z * b.z + a.w * b.w));
}

function buildOrientationGroup() {
  const orientations = [{ q: { x: 0, y: 0, z: 0, w: 1 } }];
  const findIdx = (q) => orientations.findIndex(o => quatAbsDot(o.q, q) > 0.99);

  const queue = [0];
  while (queue.length > 0) {
    const curIdx = queue.shift();
    const curQ = orientations[curIdx].q;
    for (const genQ of Object.values(GENERATOR_QUATS)) {
      const nextQ = quatNormalize(quatMultiply(curQ, genQ));
      if (findIdx(nextQ) === -1) {
        orientations.push({ q: nextQ });
        queue.push(orientations.length - 1);
      }
    }
  }

  // Edges include quarter and half turns so 180-degree flips emit single tokens like "y2"
  const stepMoves = {
    ...GENERATOR_QUATS,
    "x2": quatNormalize(quatMultiply(GENERATOR_QUATS["x"], GENERATOR_QUATS["x"])),
    "y2": quatNormalize(quatMultiply(GENERATOR_QUATS["y"], GENERATOR_QUATS["y"])),
    "z2": quatNormalize(quatMultiply(GENERATOR_QUATS["z"], GENERATOR_QUATS["z"]))
  };

  const n = orientations.length;
  const transitions = Array.from({ length: n }, () => new Array(n).fill(null));
  const shortestPaths = Array.from({ length: n }, () => new Array(n).fill([]));

  for (let i = 0; i < n; i++) {
    for (const [tok, rotQ] of Object.entries(stepMoves)) {
      const targetIdx = findIdx(quatNormalize(quatMultiply(orientations[i].q, rotQ)));
      if (targetIdx !== -1 && transitions[i][targetIdx] === null) {
        transitions[i][targetIdx] = tok;
      }
    }
    const bfsQueue = [[i, []]];
    const visited = new Set([i]);
    while (bfsQueue.length > 0) {
      const [node, path] = bfsQueue.shift();
      shortestPaths[i][node] = path;
      for (let nxt = 0; nxt < n; nxt++) {
        if (!visited.has(nxt) && transitions[node][nxt]) {
          visited.add(nxt);
          bfsQueue.push([nxt, [...path, transitions[node][nxt]]]);
        }
      }
    }
  }

  return { orientations, shortestPaths };
}

const { orientations: SO3_ORIENTATIONS, shortestPaths: SO3_PATHS } = buildOrientationGroup();

// Thresholds: cos(25°/2) ≈ 0.976 to lock into new orientation; cos(35°/2) ≈ 0.954 to leave current
const TARGET_LOCK_DOT = 0.976;
const PREVIOUS_LEAVE_DOT = 0.954;

export class GyroOrientationTracker {
  constructor() {
    this.q0 = null;
    this.currentOri = 0;
  }

  static getRotationQuaternion(rotMove) {
    if (!rotMove) return { x: 0, y: 0, z: 0, w: 1 };
    const clean = String(rotMove).trim();
    if (GENERATOR_QUATS[clean]) return { ...GENERATOR_QUATS[clean] };
    if (clean === "x2") return quatNormalize(quatMultiply(GENERATOR_QUATS["x"], GENERATOR_QUATS["x"]));
    if (clean === "y2") return quatNormalize(quatMultiply(GENERATOR_QUATS["y"], GENERATOR_QUATS["y"]));
    if (clean === "z2") return quatNormalize(quatMultiply(GENERATOR_QUATS["z"], GENERATOR_QUATS["z"]));
    return { x: 0, y: 0, z: 0, w: 1 };
  }

  static getOrientationCount() {
    return SO3_ORIENTATIONS.length;
  }

  calibrate(q) {
    this.q0 = quatNormalize(q);
    this.currentOri = 0;
  }

  reset() {
    this.q0 = null;
    this.currentOri = 0;
  }

  isCalibrated() {
    return this.q0 !== null;
  }

  update(q) {
    if (!q || typeof q !== "object") {
      return { changed: false, rotations: [], orientationIndex: this.currentOri };
    }
    if (!this.q0) {
      this.calibrate(q);
      return { changed: false, rotations: [], orientationIndex: 0 };
    }
    const qNorm = quatNormalize(q);
    const qRel = quatNormalize(quatMultiply(quatConjugate(this.q0), qNorm));

    let bestOri = this.currentOri;
    let bestDot = -1;
    for (let i = 0; i < SO3_ORIENTATIONS.length; i++) {
      const d = quatAbsDot(qRel, SO3_ORIENTATIONS[i].q);
      if (d > bestDot) {
        bestDot = d;
        bestOri = i;
      }
    }

    const currentDot = quatAbsDot(qRel, SO3_ORIENTATIONS[this.currentOri].q);
    if (bestOri !== this.currentOri && bestDot >= TARGET_LOCK_DOT && currentDot <= PREVIOUS_LEAVE_DOT) {
      const rotations = [...(SO3_PATHS[this.currentOri]?.[bestOri] || [])];
      this.currentOri = bestOri;
      return { changed: true, rotations, orientationIndex: bestOri };
    }

    return { changed: false, rotations: [], orientationIndex: this.currentOri };
  }
}
