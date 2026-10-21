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
        "alg": "F (R U R' U')2 F'",
        "note": "Double sexy variant"
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
        "alg": "R U2 R' U' (R U R' U') R U' R'",
        "note": "RU-only variant"
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
      }
    ],
    "setup": "F U R U' R' F'"
  },
  {
    "id": "ortega-pbl-adj-adj",
    "name": "Ortega PBL: Both Adjacent (Bar Top & Bar Bottom)",
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
        "alg": "R2 U' R2' U2 y R2 U' R2'",
        "note": "RU-only variant with rotation",
        "isDefault": false
      },
      {
        "id": "adj-adj-3",
        "alg": "R U' R' U' F2 U' R U R' U F2",
        "note": "Trigger-based (Sexy + F2 triggers)",
        "isDefault": false
      }
    ]
  },
  {
    "id": "ortega-pbl-opp-opp",
    "name": "Ortega PBL: Both Opposite (Diag Top & Diag Bottom)",
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
        "alg": "R2 B2 R2",
        "note": "Back-face variant",
        "isDefault": false
      },
      {
        "id": "opp-opp-3",
        "alg": "R' F R F' R U2 R' U' F R' F' R",
        "note": "Ergonomic trigger sequence",
        "isDefault": false
      }
    ]
  },
  {
    "id": "ortega-pbl-adj-opp",
    "name": "Ortega PBL: Top Adjacent / Bottom Opposite",
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
        "alg": "R' U L' U2 R U' L",
        "note": "Niklas-style 2-gen variant",
        "isDefault": false
      },
      {
        "id": "adj-opp-3",
        "alg": "R' U R' F2 R F' R",
        "note": "Alternative grip",
        "isDefault": false
      }
    ]
  },
  {
    "id": "ortega-pbl-adj-solved",
    "name": "Ortega PBL: Top Adjacent / Bottom Solved",
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
        "alg": "R U' R' U' F2 U' R U R' D R2",
        "note": "Short D-move variant",
        "isDefault": false
      },
      {
        "id": "opp-solved-3",
        "alg": "R' U R' U' y R' F' R2 U' R' U R' F R F",
        "note": "V-Perm variant",
        "isDefault": false
      }
    ]
  }
];

export const ortegaCaseById = new Map(ortegaCases.map(c => [c.id, c]));
