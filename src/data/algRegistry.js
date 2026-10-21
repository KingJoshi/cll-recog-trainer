// Central Registry of Puzzles and Algorithm Sets
// Supports 2x2x2 (CLL, Ortega, 1st Layer) and 3x3x3 (CFOP: F2L, OLL, PLL, Cross)

import { cllCases, cllCaseById } from './cllData.js';
import { ortegaCases, ortegaCaseById } from './ortegaData.js';
import { pllCases, pllCaseById } from './pllData.js';
import { ollCases, ollCaseById } from './ollData.js';
import { f2lCases, f2lCaseById } from './f2lData.js';
import { parity444Cases, parity444CaseById, parity555Cases, parity555CaseById } from './parityData.js';

export const PUZZLES = {
  "222": {
    id: "222",
    name: "2x2x2 Cube",
    shortName: "2x2",
    wcaEvent: "222",
    defaultTrack: "cll",
    tracks: [
      {
        id: "cll",
        name: "CLL (40 Cases)",
        shortName: "CLL",
        description: "Corners of the Last Layer: solves orientation and permutation at once",
        cases: cllCases,
        caseById: cllCaseById,
        groups: ["A-Group", "H-Group", "L-Group", "P-Group", "S-Group", "T-Group", "U-Group"]
      },
      {
        id: "ortega",
        name: "Ortega Method (OLL + PBL)",
        shortName: "Ortega",
        description: "Build 1st face, orient last layer (OLL), and permute both layers (PBL)",
        cases: ortegaCases,
        caseById: ortegaCaseById,
        groups: ["OLL (Orient Last Layer)", "PBL (Permute Both Layers)"]
      },
      {
        id: "layer",
        name: "1st Layer & Face",
        shortName: "1st Layer",
        description: "Inspection planning, bar preservation, and 1-4 move optimal solutions",
        cases: [],
        caseById: new Map(),
        groups: ["Fundamentals", "Bar Preservation", "Inspection Planning"]
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
        id: "pll",
        name: "PLL (OH Optimized)",
        shortName: "PLL",
        description: "Permutation of the Last Layer: RU-gen and table-abuse friendly algorithms for one-handed solving",
        cases: pllCases,
        caseById: pllCaseById,
        groups: ["Edges Only", "Adjacent Corner Swap", "Diagonal Corner Swap", "G-Permutation"]
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
        id: "cross",
        name: "White Cross",
        shortName: "Cross",
        description: "Inspection planning and rotationless cross execution for OH",
        cases: [],
        caseById: new Map(),
        groups: ["Cross Planning", "Edge Orientation", "Cross+1"]
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

const PREFERRED_ALG_STORAGE_KEY = "cll_preferred_algs_v1";

export function getPreferredAlg(caseId, defaultAlgId) {
  try {
    const raw = localStorage.getItem(PREFERRED_ALG_STORAGE_KEY);
    if (!raw) return defaultAlgId;
    const map = JSON.parse(raw);
    return map[caseId] || defaultAlgId;
  } catch (e) {
    return defaultAlgId;
  }
}

export function setPreferredAlg(caseId, algId) {
  try {
    const raw = localStorage.getItem(PREFERRED_ALG_STORAGE_KEY);
    const map = raw ? JSON.parse(raw) : {};
    map[caseId] = algId;
    localStorage.setItem(PREFERRED_ALG_STORAGE_KEY, JSON.stringify(map));
  } catch (e) {
    console.error("Failed to save preferred algorithm", e);
  }
}

export function getTrack(puzzleId, trackId) {
  const p = PUZZLES[puzzleId];
  if (!p) return null;
  return p.tracks.find(t => t.id === trackId) || p.tracks[0];
}
