// Central Registry of Puzzles and Algorithm Sets
// Supports 2x2x2 (CLL, Ortega, 1st Layer) and 3x3x3 (CFOP: F2L, OLL, PLL, Cross)

import { cllCases, cllCaseById } from './cllData.js';
import { ortegaCases, ortegaCaseById } from './ortegaData.js';
import { pllCases, pllCaseById } from './pllData.js';
import { ollCases, ollCaseById } from './ollData.js';
import { f2lCases, f2lCaseById } from './f2lData.js';

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
