// 2x2x2 Beginner LBL (Last Layer: 7 OLL + 2 PLL: Adj T/J-Perm & Diag Y-Perm)
// All algorithms verified with cubing.js KPuzzle simulation

import { ortegaCases } from './ortegaData.js';

const SHORT_NAME_BY_OLL_ID = {
  "ortega-oll-sune": "OLL: Sune",
  "ortega-oll-antisune": "OLL: Antisune",
  "ortega-oll-h": "OLL: H",
  "ortega-oll-pi": "OLL: Pi",
  "ortega-oll-u": "OLL: U",
  "ortega-oll-t": "OLL: T",
  "ortega-oll-l": "OLL: L"
};

const lblOllCases = ortegaCases
  .filter(c => c.group && c.group.startsWith("OLL"))
  .map(c => ({
    ...c,
    id: c.id.replace(/^ortega-/, "lbl-"),
    shortName: SHORT_NAME_BY_OLL_ID[c.id] || c.name.replace(/^Ortega OLL:\s*/i, "OLL: "),
    algs: (c.algs || []).map(a => ({
      ...a,
      id: `lbl-${a.id}`,
      startAuf: a.startAuf || ""
    }))
  }));

const lblPllCases = [
  {
    id: "lbl-pll-adj",
    name: "LBL PLL: Adjacent Swap (T / J-Perm)",
    shortName: "Adj (T / J)",
    group: "PLL (Permute Last Layer)",
    description: "Bottom layer solved. Top has 1 matching bar on Left (UFL+UBL solved, UFR↔UBR swapped). Solve with T-Perm or Jb-Perm.",
    setup: "R U R' U' R' F R2 U' R' U' R U R' F'",
    scrambles: [
      "R U R' U' R' F R2 U' R' U' R U R' F'",
      "R U R2 F' R U R U' R' F R U' R'"
    ],
    algs: [
      {
        id: "lbl-pll-adj-t",
        alg: "R U R' U' R' F R2 U' R' U' R U R' F'",
        note: "T-Perm (Bar on Left)",
        isDefault: true,
        startAuf: ""
      },
      {
        id: "lbl-pll-adj-jb",
        alg: "R U R' F' R U R' U' R' F R2 U' R'",
        note: "Jb-Perm (Bar on Left · Fast 2x2)",
        startAuf: ""
      },
      {
        id: "lbl-pll-adj-rulf",
        alg: "R U2 R' U' R U2 L' U R' U' L",
        note: "Ja-Perm (Right bar angle · No F moves)",
        startAuf: ""
      }
    ]
  },
  {
    id: "lbl-pll-diag",
    name: "LBL PLL: Diagonal Swap (Y-Perm)",
    shortName: "Diag (Y-Perm)",
    group: "PLL (Permute Last Layer)",
    description: "Bottom layer solved. Top has NO matching side bars (UFL↔UBR diagonal swap). Solve from any angle with Y-Perm.",
    setup: "F R U' R' U' R U R' F' R U R' U' R' F R F'",
    scrambles: [
      "F R U' R' U' R U R' F' R U R' U' R' F R F'",
      "R U' R' U' F2 U' R U R' U F2"
    ],
    algs: [
      {
        id: "lbl-pll-diag-y",
        alg: "F R U' R' U' R U R' F' R U R' U' R' F R F'",
        note: "Standard Y-Perm (Works from any U angle)",
        isDefault: true,
        startAuf: ""
      },
      {
        id: "lbl-pll-diag-ruf",
        alg: "R U' R' U' F2 U' R U R' U F2",
        note: "Short 2x2 Y-Perm (10 moves <R, U, F>)",
        startAuf: ""
      },
      {
        id: "lbl-pll-diag-d",
        alg: "R U' R' U' F2 U' R U R' D R2",
        note: "Speed 10-mover (<R, U, F, D> · D-adjusted)",
        startAuf: ""
      }
    ]
  }
];

export const lbl222Cases = [...lblOllCases, ...lblPllCases];
export const lbl222CaseById = new Map(lbl222Cases.map(c => [c.id, c]));
