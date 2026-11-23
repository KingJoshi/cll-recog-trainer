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
  }
};

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
  return SOLVE_TARGETS_BY_PUZZLE[puzzleId] || SOLVE_TARGETS_BY_PUZZLE["222"];
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
