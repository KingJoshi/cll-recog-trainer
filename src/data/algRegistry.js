// Central Registry of Puzzles and Algorithm Sets
// Supports 2x2x2 (1st Face, 1st Layer, LBL, Ortega, CLL, EG-1, EG-2), 3x3x3 / 3x3 OH (Cross, F2L, OLL, PLL), and 4x4/5x5 Parity

import { cllCases, cllCaseById } from './cllData.js';
import { ortegaCases, ortegaCaseById } from './ortegaData.js';
import { lbl222Cases, lbl222CaseById } from './lbl222Data.js';
import { eg1Cases, eg1CaseById, eg2Cases, eg2CaseById } from './egData.js';
import { pllCases, pllCaseById } from './pllData.js';
import { ollCases, ollCaseById } from './ollData.js';
import { f2lCases, f2lCaseById } from './f2lData.js';
import { parity444Cases, parity444CaseById, parity555Cases, parity555CaseById } from './parityData.js';

const C222_CASE_GROUPS = ["H-Group", "P-Group", "U-Group", "T-Group", "L-Group", "S-Group", "A-Group"];

export const PUZZLES = {
  "222": {
    id: "222",
    name: "2x2x2 Cube",
    shortName: "2x2",
    wcaEvent: "222",
    defaultTrack: "lbl",
    tracks: [
      {
        id: "face",
        name: "1st Face (Ortega / EG)",
        shortName: "1st Face",
        description: "Build any 4-sticker face in ≤4 moves and recognize Bar, Adj, and Diag bottom outcomes",
        cases: [],
        caseById: new Map(),
        groups: ["Face Spotting", "Bottom Outcomes", "Color Neutrality"]
      },
      {
        id: "layer",
        name: "1st Layer (123 Cases by Bottom Pieces)",
        shortName: "1st Layer",
        description: "Organized by pieces solved on bottom: 1 in Bottom (9) · 2 Bottom Bar (70) · 2 Bottom Diagonal (39) · 3 in Bottom (5) · 4 solved → CLL",
        cases: [],
        caseById: new Map(),
        groups: ["1 in Bottom", "2 Bottom: Bar", "2 Bottom: Diagonal", "3 in Bottom"]
      },
      {
        id: "lbl",
        name: "Beginner LBL (7 OLL + 2 PLL)",
        shortName: "LBL",
        description: "Layer-by-Layer last layer: orient top corners (7 OLL) then permute corners (T/Jb-Perm & Y-Perm)",
        cases: lbl222Cases,
        caseById: lbl222CaseById,
        groups: ["OLL (Orient Last Layer)", "PLL (Permute Last Layer)"]
      },
      {
        id: "ortega",
        name: "Ortega (OLL + PBL)",
        shortName: "Ortega",
        description: "Build 1st face (Bar/Diag), orient last layer (OLL), and permute both layers (5 PBL)",
        cases: ortegaCases,
        caseById: ortegaCaseById,
        groups: ["OLL (Orient Last Layer)", "PBL (Permute Both Layers)"]
      },
      {
        id: "cll",
        name: "CLL (40 Cases)",
        shortName: "CLL",
        description: "Corners of the Last Layer: solves top orientation and permutation in one alg over a solved 1st layer",
        cases: cllCases,
        caseById: cllCaseById,
        groups: C222_CASE_GROUPS
      },
      {
        id: "eg1",
        name: "EG-1 (40 Cases · Back Bar)",
        shortName: "EG-1",
        description: "1-Look Last Layer with an adjacent swapped bottom face (hold solved bar in Back DBL+DBR)",
        cases: eg1Cases,
        caseById: eg1CaseById,
        groups: C222_CASE_GROUPS
      },
      {
        id: "eg2",
        name: "EG-2 (40 Cases · Diag Swap)",
        shortName: "EG-2",
        description: "1-Look Last Layer with diagonal bottom swap (no bottom bars · includes Anti-CLL variants)",
        cases: eg2Cases,
        caseById: eg2CaseById,
        groups: C222_CASE_GROUPS
      }
    ]
  },
  "333": {
    id: "333",
    name: "3x3x3 Cube",
    shortName: "3x3",
    wcaEvent: "333",
    defaultTrack: "pll",
    tracks: [
      {
        id: "cross",
        name: "White Cross & Cross+1",
        shortName: "White Cross",
        description: "Optimal White Cross solutions, Edge Orientation (EO), and F2L Pair (Cross+1) preservation",
        cases: [],
        caseById: new Map(),
        groups: ["Cross Planning", "Edge Orientation", "Cross+1"]
      },
      {
        id: "f2l",
        name: "F2L (41 Cases)",
        shortName: "F2L",
        description: "First Two Layers: solve 4 corner-edge pairs simultaneously into slots",
        cases: f2lCases,
        caseById: f2lCaseById,
        groups: [
          "Basic Inserts",
          "Corner in U, Edge in U",
          "Corner in Slot, Edge in U",
          "Corner in U, Edge in Slot",
          "Both in Slot"
        ]
      },
      {
        id: "oll",
        name: "OLL (All 57 Cases)",
        shortName: "OLL",
        description: "Orientation of the Last Layer: orient all top-layer pieces in one algorithm",
        cases: ollCases,
        caseById: ollCaseById,
        groups: [
          "All Edges Oriented (Cross)",
          "T-Shapes",
          "Square-Shapes",
          "C-Shapes",
          "W-Shapes",
          "Corners Oriented",
          "P-Shapes",
          "I-Shapes",
          "Fish-Shapes",
          "Knight-move Shapes",
          "Awkward Shapes",
          "L-Shapes",
          "Lightning Bolts",
          "Dot Shapes"
        ]
      },
      {
        id: "pll",
        name: "PLL (All 21 Cases)",
        shortName: "PLL",
        description: "Permutation of the Last Layer: permute corners and edges to complete the solve",
        cases: pllCases,
        caseById: pllCaseById,
        groups: [
          "Edges Only",
          "Adjacent Corner Swap",
          "Diagonal Corner Swap",
          "G-Permutation"
        ]
      }
    ]
  },
  "333oh": {
    id: "333oh",
    name: "3x3x3 One-Handed (OH)",
    shortName: "3x3 OH",
    wcaEvent: "333oh",
    defaultTrack: "pll",
    tracks: [
      {
        id: "cross",
        name: "White Cross",
        shortName: "Cross",
        description: "Inspection planning and rotationless cross execution for OH",
        cases: [],
        caseById: new Map(),
        groups: ["Cross Planning", "Edge Orientation", "Cross+1"]
      },
      {
        id: "f2l",
        name: "F2L (41 Cases)",
        shortName: "F2L",
        description: "First Two Layers: rotationless and ergonomic one-handed corner-edge pairs",
        cases: f2lCases,
        caseById: f2lCaseById,
        groups: [
          "Basic Inserts",
          "Corner in U, Edge in U",
          "Corner in Slot, Edge in U",
          "Corner in U, Edge in Slot",
          "Both in Slot"
        ]
      },
      {
        id: "oll",
        name: "OLL (OH Optimized)",
        shortName: "OLL",
        description: "Orientation of the Last Layer: rotationless and ergonomically favorable OH algorithms",
        cases: ollCases,
        caseById: ollCaseById,
        groups: [
          "All Edges Oriented (Cross)",
          "T-Shapes",
          "Square-Shapes",
          "C-Shapes",
          "W-Shapes",
          "Corners Oriented",
          "P-Shapes",
          "I-Shapes",
          "Fish-Shapes",
          "Knight-move Shapes",
          "Awkward Shapes",
          "L-Shapes",
          "Lightning Bolts",
          "Dot Shapes"
        ]
      },
      {
        id: "pll",
        name: "PLL (OH Optimized)",
        shortName: "PLL",
        description: "Permutation of the Last Layer: RU-gen and table-abuse friendly algorithms for one-handed solving",
        cases: pllCases,
        caseById: pllCaseById,
        groups: ["Edges Only", "Adjacent Corner Swap", "Diagonal Corner Swap", "G-Permutation"]
      }
    ]
  },
  "444": {
    id: "444",
    name: "4x4x4 Cube",
    shortName: "4x4",
    wcaEvent: "444",
    defaultTrack: "parity",
    tracks: [
      {
        id: "parity",
        name: "4x4 Parity (OLL & PLL)",
        shortName: "Parity",
        description: "Essential OLL dedge flip and PLL opposite/adjacent edge swap parity algorithms",
        cases: parity444Cases,
        caseById: parity444CaseById,
        groups: ["OLL Parity", "PLL Parity"]
      }
    ]
  },
  "555": {
    id: "555",
    name: "5x5x5 Cube",
    shortName: "5x5",
    wcaEvent: "555",
    defaultTrack: "parity",
    tracks: [
      {
        id: "parity",
        name: "5x5 Parity & L2E",
        shortName: "Parity",
        description: "Last Two Edges (L2E) middle edge flip (Lucas Parity) and wing edge swap algorithms",
        cases: parity555Cases,
        caseById: parity555CaseById,
        groups: ["L2E Parity"]
      }
    ]
  },
  "pyram": {
    id: "pyram",
    name: "Pyraminx",
    shortName: "Pyraminx",
    wcaEvent: "pyram",
    solveOnly: true,
    defaultTrack: "full",
    tracks: []
  },
  "skewb": {
    id: "skewb",
    name: "Skewb",
    shortName: "Skewb",
    wcaEvent: "skewb",
    solveOnly: true,
    defaultTrack: "full",
    tracks: []
  },
  "minx": {
    id: "minx",
    name: "Megaminx",
    shortName: "Megaminx",
    wcaEvent: "minx",
    solveOnly: true,
    defaultTrack: "full",
    tracks: []
  },
  "sq1": {
    id: "sq1",
    name: "Square-1",
    shortName: "Square-1",
    wcaEvent: "sq1",
    solveOnly: true,
    defaultTrack: "full",
    tracks: []
  },
  "clock": {
    id: "clock",
    name: "Clock",
    shortName: "Clock",
    wcaEvent: "clock",
    solveOnly: true,
    defaultTrack: "full",
    tracks: []
  },
  "333bf": {
    id: "333bf",
    name: "3x3 Blindfolded",
    shortName: "3x3 BLD",
    wcaEvent: "333bf",
    solveOnly: true,
    defaultTrack: "full",
    tracks: []
  },
  "666": {
    id: "666",
    name: "6x6x6 Cube",
    shortName: "6x6",
    wcaEvent: "666",
    solveOnly: true,
    defaultTrack: "full",
    tracks: []
  },
  "777": {
    id: "777",
    name: "7x7x7 Cube",
    shortName: "7x7",
    wcaEvent: "777",
    solveOnly: true,
    defaultTrack: "full",
    tracks: []
  },
  "fto": {
    id: "fto",
    name: "Face-Turning Octahedron",
    shortName: "FTO",
    wcaEvent: "fto",
    solveOnly: true,
    defaultTrack: "full",
    tracks: []
  }
};

export const CUSTOM_EVENT_SCRAMBLE_TYPES = [
  "none",
  "333",
  "222",
  "444",
  "555",
  "666",
  "777",
  "pyram",
  "skewb",
  "minx",
  "sq1",
  "clock",
  "fto"
];

export const CUSTOM_EVENT_SCRAMBLE_LABELS = {
  none: "No scramble (Timer only)",
  "333": "3x3 Scramble",
  "222": "2x2 Scramble",
  "444": "4x4 Scramble",
  "555": "5x5 Scramble",
  "666": "6x6 Scramble",
  "777": "7x7 Scramble",
  pyram: "Pyraminx Scramble",
  skewb: "Skewb Scramble",
  minx: "Megaminx Scramble",
  sq1: "Square-1 Scramble",
  clock: "Clock Scramble",
  fto: "FTO Scramble"
};

export function sanitizeCustomEvents(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  const seen = new Set();
  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const rawName = String(item.name || item.shortName || "").trim().slice(0, 32);
    if (!rawName) continue;
    let id = String(item.id || "").trim();
    if (!id || !id.startsWith("custom-") || PUZZLES[id]?.isCustomEvent === false) {
      const slug = rawName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "event";
      id = `custom-${slug}`;
    }
    if (seen.has(id)) continue;
    seen.add(id);
    const rawShort = String(item.shortName || rawName).trim().slice(0, 12) || rawName.slice(0, 12);
    const scrambleType = CUSTOM_EVENT_SCRAMBLE_TYPES.includes(item.scrambleType) ? item.scrambleType : "none";
    out.push({
      id,
      name: rawName,
      shortName: rawShort,
      scrambleType
    });
  }
  return out;
}

export function syncCustomEventsToRegistry(customEvents = []) {
  for (const key of Object.keys(PUZZLES)) {
    if (PUZZLES[key]?.isCustomEvent) {
      delete PUZZLES[key];
    }
  }
  for (const ev of sanitizeCustomEvents(customEvents)) {
    if (PUZZLES[ev.id] && !PUZZLES[ev.id].isCustomEvent) continue;
    PUZZLES[ev.id] = {
      id: ev.id,
      name: ev.name,
      shortName: ev.shortName,
      wcaEvent: ev.scrambleType === "none" ? null : ev.scrambleType,
      scrambleType: ev.scrambleType,
      solveOnly: true,
      isCustomEvent: true,
      defaultTrack: "full",
      tracks: []
    };
  }
}

export const PREFERRED_ALG_STORAGE_KEY = "cll_preferred_algs_v1";
let preferredAlgsCache = null;
const preferredAlgListeners = new Set();

function loadPreferredAlgsMap() {
  if (preferredAlgsCache) return preferredAlgsCache;
  if (typeof localStorage === "undefined") {
    preferredAlgsCache = {};
    return preferredAlgsCache;
  }
  try {
    const raw = localStorage.getItem(PREFERRED_ALG_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    preferredAlgsCache = parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    preferredAlgsCache = {};
  }
  return preferredAlgsCache;
}

export function clearPreferredAlgsCache() {
  preferredAlgsCache = null;
}

export function onPreferredAlgChange(listener) {
  if (typeof listener === "function") preferredAlgListeners.add(listener);
  return () => preferredAlgListeners.delete(listener);
}

export function getAllPreferredAlgs() {
  return { ...loadPreferredAlgsMap() };
}

export function replaceAllPreferredAlgs(nextMap) {
  const clean = nextMap && typeof nextMap === "object" && !Array.isArray(nextMap)
    ? { ...nextMap }
    : {};
  preferredAlgsCache = clean;
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(PREFERRED_ALG_STORAGE_KEY, JSON.stringify(clean));
    } catch (e) {
      console.error("Failed to save preferred algorithms", e);
    }
  }
  return clean;
}

export function getPreferredAlg(caseId, defaultAlgId, puzzleId = null, subScope = null) {
  const map = loadPreferredAlgsMap();
  if (puzzleId && subScope) {
    const subScoped = map[`${puzzleId}:${subScope}:${caseId}`];
    if (subScoped) return subScoped;
    // Only fall back to unscoped puzzle key for standard left hand (don't leak RU star into RH LU)
    if (subScope === "left") {
      const scoped = map[`${puzzleId}:${caseId}`];
      if (scoped) return scoped;
    }
    return defaultAlgId;
  }
  if (puzzleId) {
    const scoped = map[`${puzzleId}:${caseId}`];
    if (scoped) return scoped;
  }
  return map[caseId] || defaultAlgId;
}

export function setPreferredAlg(caseId, algId, puzzleId = null, subScope = null) {
  const map = loadPreferredAlgsMap();
  const prefKey = puzzleId && subScope
    ? `${puzzleId}:${subScope}:${caseId}`
    : puzzleId
      ? `${puzzleId}:${caseId}`
      : caseId;
  map[prefKey] = algId;
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(PREFERRED_ALG_STORAGE_KEY, JSON.stringify(map));
    } catch (e) {
      console.error("Failed to save preferred algorithm", e);
    }
  }
  for (const cb of preferredAlgListeners) {
    try { cb({ key: prefKey, caseId, algId, puzzleId, subScope }); } catch {}
  }
}

export const CUSTOM_ALGS_STORAGE_KEY = "cll_custom_algs_v1";

function customAlgBucketKey(puzzleId, caseId) {
  return `${puzzleId || "222"}:${caseId}`;
}

export function loadCustomAlgsMap() {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(CUSTOM_ALGS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function saveCustomAlgsMap(map) {
  const clean = map && typeof map === "object" && !Array.isArray(map) ? map : {};
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(CUSTOM_ALGS_STORAGE_KEY, JSON.stringify(clean));
    } catch (e) {
      console.error("Failed to save custom algorithms", e);
    }
  }
  return clean;
}

export function getCustomAlgsForCase(puzzleId, caseId) {
  if (!caseId) return [];
  const map = loadCustomAlgsMap();
  const list = map[customAlgBucketKey(puzzleId, caseId)];
  if (!Array.isArray(list)) return [];
  return list
    .filter(item => item && typeof item.alg === "string" && item.alg.trim())
    .map(item => ({
      id: String(item.id),
      alg: item.alg,
      startAuf: item.startAuf || "",
      trigger: item.trigger || "",
      note: item.trigger || "Custom alg",
      isDefault: false,
      isCustom: true,
      verified: item.verified !== false
    }));
}

export function addCustomAlgForCase(puzzleId, caseId, { alg, trigger = "", startAuf = "" } = {}) {
  const cleanAlgStr = String(alg || "").trim();
  if (!caseId || !cleanAlgStr) return null;
  const map = loadCustomAlgsMap();
  const key = customAlgBucketKey(puzzleId, caseId);
  const existing = Array.isArray(map[key]) ? map[key] : [];
  const noteText = String(trigger || "").trim();
  const entry = {
    id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    alg: cleanAlgStr,
    startAuf: startAuf || "",
    trigger: noteText,
    verified: true
  };
  map[key] = [...existing, entry];
  saveCustomAlgsMap(map);
  for (const cb of preferredAlgListeners) {
    try { cb({ key, caseId, algId: entry.id, puzzleId, customAlgAdded: true }); } catch {}
  }
  return {
    ...entry,
    note: noteText || "Custom alg",
    isDefault: false,
    isCustom: true
  };
}

export function removeCustomAlgForCase(puzzleId, caseId, customAlgId) {
  if (!caseId || !customAlgId) return false;
  const map = loadCustomAlgsMap();
  const key = customAlgBucketKey(puzzleId, caseId);
  const existing = Array.isArray(map[key]) ? map[key] : [];
  const filtered = existing.filter(item => item?.id !== customAlgId);
  if (filtered.length === existing.length) return false;
  if (filtered.length > 0) map[key] = filtered;
  else delete map[key];
  saveCustomAlgsMap(map);
  for (const cb of preferredAlgListeners) {
    try { cb({ key, caseId, algId: customAlgId, puzzleId, customAlgRemoved: true }); } catch {}
  }
  return true;
}

export function getDefaultTrack(puzzleId) {
  const p = PUZZLES[puzzleId];
  if (!p) return null;
  return p.tracks.find(t => t.id === p.defaultTrack) || p.tracks[0] || null;
}

export function getTrack(puzzleId, trackId) {
  const p = PUZZLES[puzzleId];
  if (!p) return null;
  if (!trackId) return getDefaultTrack(puzzleId);
  return p.tracks.find(t => t.id === trackId) || null;
}

export function formatCaseDisplayId(id) {
  if (!id) return "";
  return String(id)
    .replace(/^oll-/i, "OLL-")
    .replace(/^pll-/i, "PLL-")
    .replace(/^f2l-/i, "F2L-")
    .replace(/^lbl-oll-/i, "LBL-OLL-")
    .replace(/^lbl-pll-/i, "LBL-PLL-")
    .replace(/^ortega-oll-/i, "Ortega-OLL-")
    .replace(/^ortega-pbl-/i, "Ortega-PBL-")
    .replace(/^444-oll-/i, "4x4-OLL-")
    .replace(/^444-pll-/i, "4x4-PLL-")
    .replace(/^444-/i, "4x4-")
    .replace(/^555-/i, "5x5-");
}

export function getDistinctCaseName(caseObj) {
  if (!caseObj || !caseObj.name) return "";
  const idNorm = String(caseObj.id || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const nameNorm = String(caseObj.name || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const idNoZero = idNorm.replace(/([a-z])0+(\d+)/g, "$1$2");
  if (!nameNorm || nameNorm === idNorm || nameNorm === idNoZero) return "";
  const stripped = String(caseObj.name)
    .replace(/^(CLL|EG-?[12])\s+/i, "")
    .replace(/\s*\([^)]*group\)\s*$/i, "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
  const idWithoutTrack = idNorm.replace(/^eg[12]/, "");
  if (!stripped || stripped === idNorm || stripped === idNoZero || stripped === idWithoutTrack) {
    return "";
  }
  return caseObj.name;
}

const SOLVE_TARGETS_BY_PUZZLE = {
  "222": [
    {
      id: "timer-drill",
      name: "⏱️ Timer & Handling Drill",
      shortName: "⏱️ Timer Drill",
      description: "Practice cube pickup & putdown splits from a solved cube using fixed triggers",
      usesCases: false
    },
    {
      id: "face",
      name: "1st Face (Ortega / EG)",
      shortName: "1st Face",
      description: "Drill building your 1st face quickly for Ortega / EG solves (adjacent colors flexible)",
      usesCases: false
    },
    {
      id: "layer",
      name: "1st Layer (CLL / LBL)",
      shortName: "1st Layer",
      description: "Drill building a complete 1st layer with matched side bars for LBL & CLL",
      usesCases: false
    },
    {
      id: "lbl",
      name: "LBL Case",
      shortName: "LBL",
      description: "Timed scrambles for your Active Cases Beginner LBL selection (7 OLL + 2 PLL)",
      usesCases: true
    },
    {
      id: "cll",
      name: "CLL Case",
      shortName: "CLL",
      description: "Timed scrambles restricted to your Active Cases CLL selection",
      usesCases: true
    },
    {
      id: "eg1",
      name: "EG-1 Case",
      shortName: "EG-1",
      description: "Timed scrambles restricted to your Active Cases EG-1 (Back Bar) selection",
      usesCases: true
    },
    {
      id: "eg2",
      name: "EG-2 Case",
      shortName: "EG-2",
      description: "Timed scrambles restricted to your Active Cases EG-2 (Diag Swap) selection",
      usesCases: true
    },
    {
      id: "full",
      name: "Full Solve (2x2)",
      shortName: "Full Solve",
      description: "Full random-state 2x2 WCA scrambles with 15s inspection and 1st-layer / 1st-face solver hints",
      usesCases: false
    }
  ],
  "333": [
    {
      id: "timer-drill",
      name: "⏱️ Timer & Handling Drill",
      shortName: "⏱️ Timer Drill",
      description: "Practice cube pickup & putdown splits from a solved cube using fixed triggers",
      usesCases: false
    },
    {
      id: "f2l",
      name: "F2L Case",
      shortName: "F2L",
      description: "Timed setup scrambles for your Active Cases F2L selection",
      usesCases: true
    },
    {
      id: "oll",
      name: "OLL Case",
      shortName: "OLL",
      description: "Timed setup scrambles for your Active Cases OLL selection",
      usesCases: true
    },
    {
      id: "pll",
      name: "PLL Case",
      shortName: "PLL",
      description: "Timed setup scrambles for your Active Cases PLL selection",
      usesCases: true
    },
    {
      id: "full",
      name: "Full Solve (3x3)",
      shortName: "Full Solve",
      description: "Full WCA 3x3 scrambles with White Cross & Cross+1 solver hints",
      usesCases: false
    }
  ],
  "333oh": [
    {
      id: "timer-drill",
      name: "⏱️ Timer & Handling Drill",
      shortName: "⏱️ Timer Drill",
      description: "Practice cube pickup & putdown splits from a solved cube using fixed triggers",
      usesCases: false
    },
    {
      id: "f2l",
      name: "F2L Case",
      shortName: "F2L",
      description: "Timed OH setup scrambles for your Active Cases F2L selection",
      usesCases: true
    },
    {
      id: "oll",
      name: "OLL Case",
      shortName: "OLL",
      description: "Timed OH setup scrambles for your Active Cases OLL selection",
      usesCases: true
    },
    {
      id: "pll",
      name: "PLL Case",
      shortName: "PLL",
      description: "Timed OH setup scrambles for your Active Cases PLL selection",
      usesCases: true
    },
    {
      id: "full",
      name: "Full Solve (3x3 OH)",
      shortName: "Full Solve",
      description: "Full WCA 3x3 One-Handed scrambles with Cross solver hints",
      usesCases: false
    }
  ],
  "444": [
    {
      id: "timer-drill",
      name: "⏱️ Timer & Handling Drill",
      shortName: "⏱️ Timer Drill",
      description: "Practice cube pickup & putdown splits from a solved cube using fixed triggers",
      usesCases: false
    },
    {
      id: "parity",
      name: "Parity Case",
      shortName: "Parity",
      description: "Timed setup scrambles for your Active Cases 4x4 OLL/PLL parity selection",
      usesCases: true
    },
    {
      id: "full",
      name: "Full Solve (4x4)",
      shortName: "Full Solve",
      description: "Full WCA 4x4 scrambles with wide-move tracking",
      usesCases: false
    }
  ],
  "555": [
    {
      id: "timer-drill",
      name: "⏱️ Timer & Handling Drill",
      shortName: "⏱️ Timer Drill",
      description: "Practice cube pickup & putdown splits from a solved cube using fixed triggers",
      usesCases: false
    },
    {
      id: "parity",
      name: "Parity Case",
      shortName: "Parity",
      description: "Timed setup scrambles for your Active Cases 5x5 L2E parity selection",
      usesCases: true
    },
    {
      id: "full",
      name: "Full Solve (5x5)",
      shortName: "Full Solve",
      description: "Full WCA 5x5 scrambles with wide-move tracking",
      usesCases: false
    }
  ]
};

/**
 * Return ordered Solve Focus targets for a puzzle (used across TrackBar, Session modal, Stats scope & Onboarding).
 */
export function getSolveTargetsForPuzzle(puzzleId) {
  if (SOLVE_TARGETS_BY_PUZZLE[puzzleId]) {
    return SOLVE_TARGETS_BY_PUZZLE[puzzleId];
  }
  const pDef = PUZZLES[puzzleId];
  if (pDef?.solveOnly) {
    return [
      {
        id: "full",
        name: `Full Solve (${pDef.shortName})`,
        shortName: "Full Solve",
        label: "Full Solve",
        description: `Full WCA ${pDef.name} scrambles and timer`,
        usesCases: false
      }
    ];
  }
  return SOLVE_TARGETS_BY_PUZZLE["222"];
}

/**
 * Look up a specific Solve Focus target entry for a puzzle (returns null if invalid).
 */
export function getSolveTargetInfo(puzzleId, targetId) {
  const list = getSolveTargetsForPuzzle(puzzleId);
  return list.find(t => t.id === targetId) || null;
}

/**
 * Return a clean display label for a Solve Focus target (strips decorative leading emoji/symbols).
 */
export function getSolveTargetLabel(puzzleId, targetId) {
  const info = getSolveTargetInfo(puzzleId || "333", targetId || "full");
  if (info) {
    const raw = info.shortName || info.name || "";
    const cleaned = raw.replace(/^[^\p{L}\p{N}]+/u, "").trim();
    if (cleaned) return cleaned;
  }
  switch (targetId) {
    case "timer-drill": return "Timer Drill";
    case "layer": return "1st Layer";
    case "face": return "1st Face";
    case "cross": return "White Cross";
    case "f2l": return "F2L";
    case "oll": return "OLL";
    case "pll": return "PLL";
    case "parity": return "Parity Drill";
    case "cll": return "CLL";
    case "lbl": return "LBL";
    case "eg1": return "EG-1";
    case "eg2": return "EG-2";
    default: return "Full Solve";
  }
}
