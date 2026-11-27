// 2x2x2 Ortega Method (OLL + PBL Cases)
// Automatically formatted and verified with cubing.js

export const ortegaCases = [
  {
    "id": "ortega-oll-h",
    "name": "Ortega OLL: H (Double Sune)",
    "group": "OLL (Orient Last Layer)",
    "description": "4 yellow corners oriented horizontally (two headlights front, two headlights back).",
    "algs": [
      {
        "id": "o-h-1",
        "alg": "R2 U2 R U2 R2",
        "note": "Standard 2x2 RU-gen",
        "isDefault": true
      },
      {
        "id": "o-h-2",
        "alg": "F (R U R' U')3 F'",
        "note": "Triple sexy variant"
      },
      {
        "id": "o-h-3",
        "alg": "R2 U2 R' U2 R2",
        "note": "Reverse RU-gen (R' flick)"
      },
      {
        "id": "o-h-4",
        "alg": "R U R' U R U' R' U R U2 R'",
        "startAuf": "U",
        "note": "3x3 RU-gen (Sune-cancel · Home grip)"
      },
      {
        "id": "o-h-5",
        "alg": "R U2 R' U' R U R' U' R U' R'",
        "note": "Antisune-cancel RU-gen (Home grip)"
      }
    ],
    "setup": "R2' U2' R' U2' R2'"
  },
  {
    "id": "ortega-oll-pi",
    "name": "Ortega OLL: Pi (Wheel)",
    "group": "OLL (Orient Last Layer)",
    "description": "2 headlights in front, 2 yellow corners facing outward in back.",
    "algs": [
      {
        "id": "o-pi-1",
        "alg": "F (R U R' U')2 F'",
        "note": "Standard 2x2 trigger",
        "isDefault": true
      },
      {
        "id": "o-pi-2",
        "alg": "R U2 R2' U' R2 U' R2' U2 R",
        "note": "3x3 variant"
      },
      {
        "id": "o-pi-3",
        "alg": "R U' R2 U R2 U R2 U' R",
        "note": "Short 9-move 2x2 RU-gen"
      },
      {
        "id": "o-pi-4",
        "alg": "R' U' R' F R F' R U' R' U2 R",
        "startAuf": "U'",
        "note": "Fast 2x2 RUF (Home grip)"
      },
      {
        "id": "o-pi-5",
        "alg": "F R' F' R U2 R U' R' U R U2 R'",
        "startAuf": "U",
        "note": "Hedge into RU (CLL-style)"
      },
      {
        "id": "o-pi-6",
        "alg": "L' U2 L2 U L2 U L2 U2 L'",
        "startAuf": "U2",
        "note": "Left-hand pure LU-gen mirror"
      }
    ],
    "setup": "F (R U R' U')2' F'"
  },
  {
    "id": "ortega-oll-antisune",
    "name": "Ortega OLL: Antisune",
    "group": "OLL (Orient Last Layer)",
    "description": "1 yellow corner solved on top, right corner facing front.",
    "algs": [
      {
        "id": "o-as-1",
        "alg": "R U2 R' U' R U' R'",
        "note": "Standard Antisune",
        "isDefault": true
      },
      {
        "id": "o-as-2",
        "alg": "R' U' R U' R' U2 R",
        "startAuf": "U'",
        "note": "Back-slot Antisune (Pure RU · Home grip)"
      },
      {
        "id": "o-as-3",
        "alg": "L' U' L U' L' U2 L",
        "startAuf": "U",
        "note": "Left-hand mirror (Pure LU · Home grip)"
      },
      {
        "id": "o-as-4",
        "alg": "L U2 L' U' L U' L'",
        "startAuf": "U2",
        "note": "Left-hand back Antisune (Pure LU)"
      },
      {
        "id": "o-as-5",
        "alg": "L' U R U' L U R'",
        "startAuf": "U",
        "note": "Left Niklas (L+R alternating · Home grip)"
      },
      {
        "id": "o-as-6",
        "alg": "R' U L U' R U L'",
        "startAuf": "U'",
        "note": "Back Niklas (L+R alternating)"
      }
    ],
    "setup": "R U R' U R U2' R'"
  },
  {
    "id": "ortega-oll-sune",
    "name": "Ortega OLL: Sune",
    "group": "OLL (Orient Last Layer)",
    "description": "1 yellow corner solved on top, front-left corner facing front.",
    "algs": [
      {
        "id": "o-s-1",
        "alg": "R U R' U R U2 R'",
        "note": "Standard Sune",
        "isDefault": true
      },
      {
        "id": "o-s-2",
        "alg": "R' U2 R U R' U R",
        "startAuf": "U'",
        "note": "Back-slot Sune (Pure RU · Home grip)"
      },
      {
        "id": "o-s-3",
        "alg": "L' U2 L U L' U L",
        "startAuf": "U",
        "note": "Left-hand mirror (Pure LU · Home grip)"
      },
      {
        "id": "o-s-4",
        "alg": "L U L' U L U2 L'",
        "startAuf": "U2",
        "note": "Left-hand back Sune (Pure LU)"
      },
      {
        "id": "o-s-5",
        "alg": "R U' L' U R' U' L",
        "note": "Niklas (L+R alternating · Home grip)"
      },
      {
        "id": "o-s-6",
        "alg": "R U' R' F R' F' R",
        "note": "Short 7-move RUF (Front Sledge finish)"
      }
    ],
    "setup": "R U2' R' U' R U' R'"
  },
  {
    "id": "ortega-oll-l",
    "name": "Ortega OLL: L (Bowtie)",
    "group": "OLL (Orient Last Layer)",
    "description": "2 diagonal corners solved on top, 2 corners facing outward.",
    "algs": [
      {
        "id": "o-l-1",
        "alg": "F R' F' R U R U' R'",
        "note": "Inverse Sledge into Sexy",
        "isDefault": true
      },
      {
        "id": "o-l-2",
        "alg": "F R U' R' U' R U R' F'",
        "note": "Alternative trigger variant"
      },
      {
        "id": "o-l-3",
        "alg": "F' R U R' U' R' F R",
        "startAuf": "U",
        "note": "Front Sexy + Sledge (3x3 OLL 25 style)"
      },
      {
        "id": "o-l-4",
        "alg": "F' L F L' U' L' U L",
        "startAuf": "U",
        "note": "Left-hand Hedge + Sexy mirror"
      },
      {
        "id": "o-l-5",
        "alg": "R U2 R D R' U2 R D' R2",
        "note": "3x3 RUD Bowtie (OLL 25)"
      }
    ],
    "setup": "R U R' U' R' F R F'"
  },
  {
    "id": "ortega-oll-t",
    "name": "Ortega OLL: T (Chameleon)",
    "group": "OLL (Orient Last Layer)",
    "description": "2 adjacent corners solved on top, 2 corners facing outward in opposite directions.",
    "algs": [
      {
        "id": "o-t-1",
        "alg": "R U R' U' R' F R F'",
        "note": "Sexy + Sledgehammer",
        "isDefault": true
      },
      {
        "id": "o-t-2",
        "alg": "R U R' U' F' U' F",
        "startAuf": "U",
        "note": "Short 7-move 2x2 Sexy + Front Insert"
      },
      {
        "id": "o-t-3",
        "alg": "F R U' R' U R U R' F'",
        "note": "Smooth RUF (Home grip)"
      },
      {
        "id": "o-t-4",
        "alg": "L' U' L U L F' L' F",
        "startAuf": "U2",
        "note": "Left-hand Sexy + Left Sledge"
      },
      {
        "id": "o-t-5",
        "alg": "L' U' L U F U F'",
        "startAuf": "U",
        "note": "Short 7-move Left Sexy + Front Insert"
      }
    ],
    "setup": "F R' F' R U R U' R'"
  },
  {
    "id": "ortega-oll-u",
    "name": "Ortega OLL: U (Headlights)",
    "group": "OLL (Orient Last Layer)",
    "description": "2 adjacent corners solved on top, headlights facing front.",
    "algs": [
      {
        "id": "o-u-1",
        "alg": "F R U R' U' F'",
        "note": "F Sexy F'",
        "isDefault": true
      },
      {
        "id": "o-u-2",
        "alg": "F U R U' R' F'",
        "startAuf": "U2",
        "note": "F Inverse-Sexy F' (6 moves)"
      },
      {
        "id": "o-u-3",
        "alg": "F' L' U' L U F",
        "startAuf": "U2",
        "note": "Left-hand F' Left-Sexy F (6 moves)"
      },
      {
        "id": "o-u-4",
        "alg": "R' U' F' U F R",
        "startAuf": "U'",
        "note": "Back RUF 6-mover (Regripless)"
      },
      {
        "id": "o-u-5",
        "alg": "R2 D R' U2 R D' R' U2 R'",
        "startAuf": "U'",
        "note": "3x3 RUD Headlights (OLL 23)"
      },
      {
        "id": "o-u-6",
        "alg": "R2 D' R U2 R' D R U2 R",
        "startAuf": "U",
        "note": "3x3 RUD Front Headlights"
      }
    ],
    "setup": "F U R U' R' F'"
  },
  {
    "id": "ortega-pbl-adj-adj",
    "name": "Ortega PBL: Both Adjacent (Bar Top & Bar Bottom)",
    "shortName": "Adj / Adj",
    "group": "PBL (Permute Both Layers)",
    "description": "Hold both bars in the BACK (or match them in back). Solves both layers at once.",
    "setup": "R2' U R2 U2' B2' U R2'",
    "algs": [
      {
        "id": "adj-adj-1",
        "alg": "R2 U' B2 U2 R2' U' R2",
        "note": "Standard / Most popular (Hold bars in back)",
        "isDefault": true
      },
      {
        "id": "adj-adj-2",
        "alg": "y2 R2 U' R2' U2 y R2 U' R2'",
        "note": "RU-only variant with rotation",
        "isDefault": false
      },
      {
        "id": "adj-adj-3",
        "alg": "R2' U R2 U2' B2' U R2'",
        "note": "Inverse trigger variant",
        "isDefault": false
      }
    ]
  },
  {
    "id": "ortega-pbl-opp-opp",
    "name": "Ortega PBL: Both Opposite (Diag Top & Diag Bottom)",
    "shortName": "Opp / Opp",
    "group": "PBL (Permute Both Layers)",
    "description": "No bars on top or bottom layer (both need diagonal corner swap). Fast 3-move solve!",
    "setup": "R2' F2' R2'",
    "algs": [
      {
        "id": "opp-opp-1",
        "alg": "R2 F2 R2",
        "note": "Fastest alg in 2x2 cubing",
        "isDefault": true
      },
      {
        "id": "opp-opp-2",
        "alg": "y2 R2 B2 R2",
        "note": "Back-face variant with rotation",
        "isDefault": false
      }
    ]
  },
  {
    "id": "ortega-pbl-adj-opp",
    "name": "Ortega PBL: Top Adjacent / Bottom Opposite",
    "shortName": "Adj / Opp",
    "group": "PBL (Permute Both Layers)",
    "description": "Bar on top layer (hold in FRONT), bottom layer has diagonal swap (no bar).",
    "setup": "R U' R F2' R' U R'",
    "algs": [
      {
        "id": "adj-opp-1",
        "alg": "R U' R F2 R' U R'",
        "note": "Standard / Fast flick (Bar in Front)",
        "isDefault": true
      },
      {
        "id": "adj-opp-2",
        "alg": "U2 R' U L' U2 R U' L",
        "note": "Niklas-style variant (from back)",
        "isDefault": false
      },
      {
        "id": "adj-opp-3",
        "alg": "U2 R' U R' F2 R F' R",
        "note": "Alternative grip (from back)",
        "isDefault": false
      }
    ]
  },
  {
    "id": "ortega-pbl-adj-solved",
    "name": "Ortega PBL: Top Adjacent / Bottom Solved",
    "shortName": "Adj / Solved (T-Perm / J-Perm)",
    "group": "PBL (Permute Both Layers)",
    "description": "Bar on top layer, bottom layer is already fully solved. Standard 2x2 PLL.",
    "setup": "F R U' R' U R U R2' F' R U R U' R'",
    "algs": [
      {
        "id": "adj-solved-1",
        "alg": "R U R' U' R' F R2 U' R' U' R U R' F'",
        "note": "T-Perm (Hold bar on Left)",
        "isDefault": true
      },
      {
        "id": "adj-solved-2",
        "alg": "R U R' F' R U R' U' R' F R2 U' R'",
        "note": "J-Perm (Hold bar on Left)",
        "isDefault": false
      },
      {
        "id": "adj-solved-3",
        "alg": "R' U' F' R U R' U' R' F R2 U' R' U' R U R' U R",
        "note": "F-Perm variant",
        "isDefault": false
      }
    ]
  },
  {
    "id": "ortega-pbl-opp-solved",
    "name": "Ortega PBL: Top Opposite / Bottom Solved",
    "shortName": "Opp / Solved (Y-Perm)",
    "group": "PBL (Permute Both Layers)",
    "description": "Diagonal corner swap on top layer, bottom layer is already solved. Standard 2x2 Y-Perm.",
    "setup": "F R' F' R U R U' R' F R U' R' U R U R' F'",
    "algs": [
      {
        "id": "opp-solved-1",
        "alg": "F R U' R' U' R U R' F' R U R' U' R' F R F'",
        "note": "Standard Y-Perm",
        "isDefault": true
      },
      {
        "id": "opp-solved-2",
        "alg": "y R U' R' U' F2 U' R U R' D R2 U2",
        "note": "Short D-move variant with rotation & AUF",
        "isDefault": false
      },
      {
        "id": "opp-solved-3",
        "alg": "y' R' U R' U' y R' F' R2 U' R' U R' F R F U2",
        "note": "V-Perm variant with AUF",
        "isDefault": false
      }
    ]
  }
];

export const ortegaCaseById = new Map(ortegaCases.map(c => [c.id, c]));

// Backwards-compatible normalized PBL list for legacy consumers (e.g. simulator & settings)
export const pblCases = ortegaCases
  .filter(c => c.group && c.group.startsWith("PBL"))
  .map(c => ({
    ...c,
    id: c.id.replace(/^ortega-pbl-/, ""),
    scramble: c.setup,
    algs: (c.algs || []).map(a => ({ ...a, label: a.label || a.alg }))
  }));

export const pblCaseById = new Map(pblCases.map(c => [c.id, c]));
