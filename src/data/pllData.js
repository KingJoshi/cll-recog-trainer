// 3x3x3 PLL (Permutation of the Last Layer) - All 21 Cases
// Automatically formatted and verified with cubing.js

export const pllCases = [
  {
    "id": "Ua",
    "name": "Ua-Perm (3-Edge Cycle Counter-Clockwise)",
    "group": "Edges Only",
    "description": "Cycle 3 edges counter-clockwise. Back 2 corners and edge are solved (bar in back).",
    "algs": [
      {
        "id": "ua-1",
        "alg": "R U' R U R U R U' R' U' R2",
        "note": "Standard RU-Gen (Most popular)",
        "isDefault": true
      },
      {
        "id": "ua-2",
        "alg": "M2' U M U2 M' U M2'",
        "note": "MU-Gen / Ergonomic table turns"
      },
      {
        "id": "ua-3",
        "alg": "y2 R2 U' R' U' R U R U R U' R",
        "note": "Back-bar variant"
      }
    ],
    "setup": "R2' U R U R' U' R' U' R' U R'"
  },
  {
    "id": "Ub",
    "name": "Ub-Perm (3-Edge Cycle Clockwise)",
    "group": "Edges Only",
    "description": "Cycle 3 edges clockwise. Back 2 corners and edge are solved (bar in back).",
    "algs": [
      {
        "id": "ub-1",
        "alg": "R2 U R U R' U' R' U' R' U R'",
        "note": "Standard RU-Gen",
        "isDefault": true
      },
      {
        "id": "ub-2",
        "alg": "M2' U' M U2 M' U' M2'",
        "note": "MU-Gen / Table turn variant"
      },
      {
        "id": "ub-3",
        "alg": "y2 R' U R' U' R' U' R' U R U R2",
        "note": "Left-flick variant"
      }
    ],
    "setup": "R U' R U R U R U' R' U' R2'"
  },
  {
    "id": "H",
    "name": "H-Perm (Opposite Edge Swaps)",
    "group": "Edges Only",
    "description": "Swap both pairs of opposite edges (M-slice and S-slice). Fast M2 U M2 U2 M2 U M2.",
    "algs": [
      {
        "id": "h-1",
        "alg": "M2' U M2' U2 M2' U M2'",
        "note": "Standard MU-Gen (Super fast)",
        "isDefault": true
      },
      {
        "id": "h-2",
        "alg": "M2' U' M2' U2 M2' U' M2'",
        "note": "U' index flick variant"
      }
    ],
    "setup": "M2 U' M2 U2' M2 U' M2"
  },
  {
    "id": "Z",
    "name": "Z-Perm (Adjacent Edge Swaps)",
    "group": "Edges Only",
    "description": "Swap adjacent edge pairs (UF <-> UR and UB <-> UL).",
    "algs": [
      {
        "id": "z-1",
        "alg": "M2' U M2' U M' U2 M2' U2 M'",
        "note": "Standard MU-Gen",
        "isDefault": true
      },
      {
        "id": "z-2",
        "alg": "y' M' U' M2' U' M2' U' M' U2 M2'",
        "note": "Alternative finger-trick"
      },
      {
        "id": "z-3",
        "alg": "M2' U' M2' U' M' U2 M2' U2 M'",
        "note": "U' variant"
      }
    ],
    "setup": "M U2' M2 U2' M U' M2 U' M2"
  },
  {
    "id": "Aa",
    "name": "Aa-Perm (Adjacent Corner Cycle Counter-Clockwise)",
    "group": "Adjacent Corner Swap",
    "description": "Cycle 3 corners counter-clockwise with headlights on the left/back.",
    "algs": [
      {
        "id": "aa-1",
        "alg": "x R' U R' D2 R U' R' D2 R2 x'",
        "note": "Standard x rotation with D2 double flick",
        "isDefault": true
      },
      {
        "id": "aa-2",
        "alg": "y x' R2 D2 R' U' R D2 R' U R' x",
        "note": "Alternative grip"
      }
    ],
    "setup": "x R2' D2' R U R' D2' R U' R x'"
  },
  {
    "id": "Ab",
    "name": "Ab-Perm (Adjacent Corner Cycle Clockwise)",
    "group": "Adjacent Corner Swap",
    "description": "Cycle 3 corners clockwise with headlights on the right/back.",
    "algs": [
      {
        "id": "ab-1",
        "alg": "x R2 D2 R U R' D2 R U' R x'",
        "note": "Standard x rotation",
        "isDefault": true
      },
      {
        "id": "ab-2",
        "alg": "y2 x' R U' R D2 R' U R D2 R2 x",
        "note": "Headlights in front"
      }
    ],
    "setup": "x R' U R' D2' R U' R' D2' R2' x'"
  },
  {
    "id": "Ja",
    "name": "Ja-Perm (Adjacent Swap - Bar on Left)",
    "group": "Adjacent Corner Swap",
    "description": "Swap 2 corners and 2 edges on left. Solved 1x1x3 bar on left.",
    "algs": [
      {
        "id": "ja-1",
        "alg": "x R2 F R F' R U2 r' U r U2 x'",
        "note": "Standard fast flick",
        "isDefault": true
      },
      {
        "id": "ja-2",
        "alg": "y' L' U' L F L' U' L U L F' L2' U L",
        "note": "Left-handed Jb mirror"
      },
      {
        "id": "ja-3",
        "alg": "R' U L' U2 R U' R' U2 R L",
        "note": "Niklas-style 2-gen"
      }
    ],
    "setup": "x U2' r' U' r U2' R' F R' F' R2' x'"
  },
  {
    "id": "Jb",
    "name": "Jb-Perm (Adjacent Swap - Bar on Right)",
    "group": "Adjacent Corner Swap",
    "description": "Swap 2 corners and 2 edges on right. Solved 1x1x3 bar on left/front.",
    "algs": [
      {
        "id": "jb-1",
        "alg": "R U R' F' R U R' U' R' F R2 U' R'",
        "note": "Standard (Fastest adjacent PLL)",
        "isDefault": true
      },
      {
        "id": "jb-2",
        "alg": "R U2 R' U' R U2 L' U R' U' L",
        "note": "2-gen RU/L variant"
      }
    ],
    "setup": "R U R2' F' R U R U' R' F R U' R'"
  },
  {
    "id": "Ra",
    "name": "Ra-Perm (Adjacent Swap + Edge Cycle)",
    "group": "Adjacent Corner Swap",
    "description": "Headlights on left, 2x1 block in front.",
    "algs": [
      {
        "id": "ra-1",
        "alg": "R U' R' U' R U R D R' U' R D' R' U2 R'",
        "note": "Standard RUD alg",
        "isDefault": true
      },
      {
        "id": "ra-2",
        "alg": "R U R' F' R U2 R' U2 R' F R U R U2 R'",
        "note": "RUF-gen variant"
      }
    ],
    "setup": "R U2' R D R' U R D' R' U' R' U R U R'"
  },
  {
    "id": "Rb",
    "name": "Rb-Perm (Adjacent Swap + Edge Cycle)",
    "group": "Adjacent Corner Swap",
    "description": "Headlights on left, 2x1 block in back.",
    "algs": [
      {
        "id": "rb-1",
        "alg": "R' U2 R U2 R' F R U R' U' R' F' R2",
        "note": "Standard (Starts with R' U2)",
        "isDefault": true
      },
      {
        "id": "rb-2",
        "alg": "R' U2 R' D' R U' R' D R U R U' R' U' R",
        "note": "RUD-gen variant"
      }
    ],
    "setup": "R2' F R U R U' R' F' R U2' R' U2' R"
  },
  {
    "id": "T",
    "name": "T-Perm (Adjacent Swap - Classic)",
    "group": "Adjacent Corner Swap",
    "description": "Swap right 2 corners and opposite edges. The most famous speedcubing alg.",
    "algs": [
      {
        "id": "t-1",
        "alg": "R U R' U' R' F R2 U' R' U' R U R' F'",
        "note": "Standard T-Perm",
        "isDefault": true
      },
      {
        "id": "t-2",
        "alg": "R2 U R2 U' R2 U' D R2 U' R2 U R2 D'",
        "note": "2-gen RU/D variant"
      }
    ],
    "setup": "F R U' R' U R U R2' F' R U R U' R'"
  },
  {
    "id": "F",
    "name": "F-Perm (Adjacent Swap - Bar in Front)",
    "group": "Adjacent Corner Swap",
    "description": "Swap 2 corners and 2 edges. Long 1x1x3 bar in front.",
    "algs": [
      {
        "id": "f-1",
        "alg": "R' U' F' R U R' U' R' F R2 U' R' U' R U R' U R",
        "note": "Setup move + T-Perm + undo",
        "isDefault": true
      },
      {
        "id": "f-2",
        "alg": "R' U2 R' d' R' F' R2 U' R' U R' F R U' F",
        "note": "Alternative finger-trick"
      }
    ],
    "setup": "R' U' R U' R' U R U R2' F' R U R U' R' F U R"
  },
  {
    "id": "V",
    "name": "V-Perm (Diagonal Corner Swap)",
    "group": "Diagonal Corner Swap",
    "description": "Swap diagonal corners and 2 adjacent edges. 2x2 solved block on left.",
    "algs": [
      {
        "id": "v-1",
        "alg": "R' U R' U' y R' F' R2 U' R' U R' F R F",
        "note": "Standard rotation variant",
        "isDefault": true
      },
      {
        "id": "v-2",
        "alg": "R' U R' U' B' R' B2 U' B' U B' R B R",
        "note": "Rotationless B variant"
      }
    ],
    "setup": "F' R' F' R U' R U R2' F R y' U R U' R"
  },
  {
    "id": "Y",
    "name": "Y-Perm (Diagonal Corner Swap)",
    "group": "Diagonal Corner Swap",
    "description": "Swap diagonal corners and 2 adjacent edges. 2x1 block on left.",
    "algs": [
      {
        "id": "y-1",
        "alg": "F R U' R' U' R U R' F' R U R' U' R' F R F'",
        "note": "Standard Y-Perm",
        "isDefault": true
      },
      {
        "id": "y-2",
        "alg": "R2 U' R' U R U' x' z' R U' R' U' R U R' x z",
        "note": "Speed variant"
      }
    ],
    "setup": "F R' F' R U R U' R' F R U' R' U R U R' F'"
  },
  {
    "id": "E",
    "name": "E-Perm (Diagonal Corner Swap - Symmetrical)",
    "group": "Diagonal Corner Swap",
    "description": "Swap 2 pairs of corners diagonally, edges remain solved.",
    "algs": [
      {
        "id": "e-1",
        "alg": "x' R U' R' D R U R' D' R U R' D R U' R' D' x",
        "note": "Standard x rotation with D flicks",
        "isDefault": true
      },
      {
        "id": "e-2",
        "alg": "y x' R U' R' D R U R' u2 R' U R D R' U' R x",
        "note": "u2 variant"
      }
    ],
    "setup": "x' D R U R' D' R U' R' D R U' R' D' R U R' x"
  },
  {
    "id": "Na",
    "name": "Na-Perm (Diagonal Corner Swap - Right)",
    "group": "Diagonal Corner Swap",
    "description": "Swap diagonal corners and diagonal edges. Solved 2x1 bars on right.",
    "algs": [
      {
        "id": "na-1",
        "alg": "R U R' U R U R' F' R U R' U' R' F R2 U' R' U2 R U' R'",
        "note": "Standard J-perm insert",
        "isDefault": true
      },
      {
        "id": "na-2",
        "alg": "z U R' D R2 U' R D' U R' D R2 U' R D' z'",
        "note": "z-rotation RUD variant"
      }
    ],
    "setup": "R U R' U2' R U R2' F' R U R U' R' F R U' R' U' R U' R'"
  },
  {
    "id": "Nb",
    "name": "Nb-Perm (Diagonal Corner Swap - Left)",
    "group": "Diagonal Corner Swap",
    "description": "Swap diagonal corners and diagonal edges. Solved 2x1 bars on left.",
    "algs": [
      {
        "id": "nb-1",
        "alg": "R' U R U' R' F' U' F R U R' F R' F' R U' R",
        "note": "Standard trigger-based",
        "isDefault": true
      },
      {
        "id": "nb-2",
        "alg": "z U' R D' R2 U R' D U' R D' R2 U R' D z'",
        "note": "z-rotation RUD variant"
      }
    ],
    "setup": "R' U R' F R F' R U' R' F' U F R U R' U' R"
  },
  {
    "id": "Ga",
    "name": "Ga-Perm (G-Permutation A)",
    "group": "G-Permutation",
    "description": "Headlights on left, 2x1 block in front.",
    "algs": [
      {
        "id": "ga-1",
        "alg": "R2 U R' U R' U' R U' R2 D U' R' U R D'",
        "note": "Standard RUD-gen",
        "isDefault": true
      },
      {
        "id": "ga-2",
        "alg": "R2 u R' U R' U' R u' R2 y' R' U R",
        "note": "Wide u turn variant"
      }
    ],
    "setup": "D R' U' R U D' R2' U R' U R U' R U' R2'"
  },
  {
    "id": "Gb",
    "name": "Gb-Perm (G-Permutation B)",
    "group": "G-Permutation",
    "description": "Headlights on left, 2x1 block in back.",
    "algs": [
      {
        "id": "gb-1",
        "alg": "R' U' R y R2 u R' U R U' R u' R2",
        "note": "Standard with rotation",
        "isDefault": true
      },
      {
        "id": "gb-2",
        "alg": "F' U' F R2 u R' U R U' R u' R2",
        "note": "F-start variant"
      }
    ],
    "setup": "R2' u R' U R' U' R u' R2' y' R' U R"
  },
  {
    "id": "Gc",
    "name": "Gc-Perm (G-Permutation C)",
    "group": "G-Permutation",
    "description": "Headlights on left, 2x1 block on right.",
    "algs": [
      {
        "id": "gc-1",
        "alg": "R2 U' R U' R U R' U R2 D' U R U' R' D",
        "note": "Standard RUD-gen",
        "isDefault": true
      },
      {
        "id": "gc-2",
        "alg": "R2 u' R U' R U R' u R2 y R U' R'",
        "note": "Wide u' turn variant"
      }
    ],
    "setup": "D' R U R' U' D R2' U' R U' R' U R' U R2'"
  },
  {
    "id": "Gd",
    "name": "Gd-Perm (G-Permutation D)",
    "group": "G-Permutation",
    "description": "Headlights on left, 2x1 block in front-right.",
    "algs": [
      {
        "id": "gd-1",
        "alg": "R U R' y' R2 u' R U' R' U R' u R2",
        "note": "Standard with rotation",
        "isDefault": true
      },
      {
        "id": "gd-2",
        "alg": "R U R' U' D R2 U' R U' R' U R' U R2 D'",
        "note": "Rotationless RUD variant"
      }
    ],
    "setup": "R2' u' R U' R U R' u R2' y R U' R'"
  }
];

export const pllCaseById = new Map(pllCases.map(c => [c.id, c]));
