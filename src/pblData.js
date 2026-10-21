// Ortega PBL (Permute Both Layers) Algorithms and Case Data
// Ortega method 2nd step after orienting both faces.

export const pblCases = [
  {
    id: "adj-adj",
    name: "Both Adjacent (Bar Top & Bar Bottom)",
    shortName: "Adj / Adj",
    description: "Hold both bars in the BACK (or match them in back). Solves both layers at once.",
    scramble: "R2' U R2 U2' B2' U R2'",
    algs: [
      {
        id: "adj-adj-1",
        label: "R2 U' B2 U2 R2' U' R2",
        alg: "R2 U' B2 U2 R2' U' R2",
        note: "Standard / Most popular (Hold bars in back)"
      },
      {
        id: "adj-adj-2",
        label: "y2 R2 U' R2' U2 y R2 U' R2'",
        alg: "y2 R2 U' R2' U2 y R2 U' R2'",
        note: "RU-only variant with rotation"
      },
      {
        id: "adj-adj-3",
        label: "R2' U R2 U2' B2' U R2'",
        alg: "R2' U R2 U2' B2' U R2'",
        note: "Inverse trigger variant"
      }
    ]
  },
  {
    id: "opp-opp",
    name: "Both Opposite (Diag Top & Diag Bottom)",
    shortName: "Opp / Opp",
    description: "No bars on top or bottom layer (both need diagonal corner swap). Fast 3-move solve!",
    scramble: "R2' F2' R2'",
    algs: [
      {
        id: "opp-opp-1",
        label: "R2 F2 R2",
        alg: "R2 F2 R2",
        note: "Fastest alg in 2x2 cubing"
      },
      {
        id: "opp-opp-2",
        label: "y2 R2 B2 R2",
        alg: "y2 R2 B2 R2",
        note: "Back-face variant with rotation"
      },
      {
        id: "opp-opp-3",
        label: "R2' F2 R2",
        alg: "R2' F2 R2",
        note: "Alternative execution"
      }
    ]
  },
  {
    id: "adj-opp",
    name: "Top Adjacent / Bottom Opposite",
    shortName: "Adj / Opp",
    description: "Bar on top layer (hold in FRONT), bottom layer has diagonal swap (no bar).",
    scramble: "R U' R F2' R' U R'",
    algs: [
      {
        id: "adj-opp-1",
        label: "R U' R F2 R' U R'",
        alg: "R U' R F2 R' U R'",
        note: "Standard / Fast flick (Bar in Front)"
      },
      {
        id: "adj-opp-2",
        label: "U2 (R' U L') U2 (R U' L)",
        alg: "U2 R' U L' U2 R U' L",
        note: "Niklas-style variant (from back)"
      },
      {
        id: "adj-opp-3",
        label: "U2 R' U R' F2 R F' R",
        alg: "U2 R' U R' F2 R F' R",
        note: "Alternative grip (from back)"
      }
    ]
  },
  {
    id: "adj-solved",
    name: "Top Adjacent / Bottom Solved",
    shortName: "Adj / Solved (T-Perm / J-Perm)",
    description: "Bar on top layer, bottom layer is already fully solved. Standard 2x2 PLL.",
    scramble: "F R U' R' U R U R2' F' R U R U' R'",
    algs: [
      {
        id: "adj-solved-1",
        label: "(R U R' U') R' F R2 U' R' U' (R U R') F'",
        alg: "R U R' U' R' F R2 U' R' U' R U R' F'",
        note: "T-Perm (Hold bar on Left)"
      },
      {
        id: "adj-solved-2",
        label: "(R U R' F') (R U R' U') R' F R2 U' R'",
        alg: "R U R' F' R U R' U' R' F R2 U' R'",
        note: "J-Perm (Hold bar on Left)"
      },
      {
        id: "adj-solved-3",
        label: "(R' U' F') (R U R' U') (R' F R2 U' R' U') (R U R') (U R)",
        alg: "R' U' F' R U R' U' R' F R2 U' R' U' R U R' U R",
        note: "F-Perm variant"
      }
    ]
  },
  {
    id: "opp-solved",
    name: "Top Opposite / Bottom Solved",
    shortName: "Opp / Solved (Y-Perm)",
    description: "Diagonal corner swap on top layer, bottom layer is already solved. Standard 2x2 Y-Perm.",
    scramble: "F R' F' R U R U' R' F R U' R' U R U R' F'",
    algs: [
      {
        id: "opp-solved-1",
        label: "F (R U' R' U') (R U R' F') (R U R' U') (R' F R F')",
        alg: "F R U' R' U' R U R' F' R U R' U' R' F R F'",
        note: "Standard Y-Perm"
      },
      {
        id: "opp-solved-2",
        label: "y (R U' R' U') F2 U' (R U R') D R2 U2",
        alg: "y R U' R' U' F2 U' R U R' D R2 U2",
        note: "Short D-move variant with rotation & AUF"
      },
      {
        id: "opp-solved-3",
        label: "y' (R' U R' U') y (R' F' R2 U') (R' U R' F) R F U2",
        alg: "y' R' U R' U' y R' F' R2 U' R' U R' F R F U2",
        note: "V-Perm variant with AUF"
      }
    ]
  }
];

export const pblCaseById = new Map(pblCases.map(c => [c.id, c]));
