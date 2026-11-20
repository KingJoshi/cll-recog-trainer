// 3x3x3 PLL (Permutation of the Last Layer) - All 21 Cases
// Verified with cubing.js + SpeedCubeDB community alternatives

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
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "ua-2",
        "alg": "M2' U M U2 M' U M2'",
        "note": "MU-Gen / Ergonomic table turns",
        "startAuf": ""
      },
      {
        "id": "ua-3",
        "alg": "y2 R2 U' R' U' R U R U R U' R y2",
        "note": "Back-bar variant",
        "startAuf": ""
      },
      {
        "id": "Ua-5",
        "alg": "R U R' U R' U' R2 U' R' U R' U R",
        "note": "Community Alt",
        "startAuf": "U2"
      },
      {
        "id": "Ua-6",
        "alg": "R2 U' S' U2 S U' R2",
        "note": "Community Alt",
        "startAuf": "U'"
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
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "ub-2",
        "alg": "M2' U' M U2 M' U' M2'",
        "note": "MU-Gen / Table turn variant",
        "startAuf": ""
      },
      {
        "id": "ub-3",
        "alg": "y2 R' U R' U' R' U' R' U R U R2 y2",
        "note": "Left-flick variant",
        "startAuf": ""
      },
      {
        "id": "Ub-5",
        "alg": "R' U R' U' R' U' R' U R U R2",
        "note": "Community Alt",
        "startAuf": "U2"
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
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "h-2",
        "alg": "M2' U' M2' U2 M2' U' M2'",
        "note": "U' index flick variant",
        "startAuf": ""
      },
      {
        "id": "H-5",
        "alg": "R2 S2 R2 U' R2 S2 R2",
        "note": "Community Alt",
        "startAuf": ""
      },
      {
        "id": "H-6",
        "alg": "M2 U2 M2 U M2 U2 M2",
        "note": "Community Alt",
        "startAuf": ""
      },
      {
        "id": "h-oh-ru-1",
        "alg": "R2 U2 R U2 R2 U2 R2 U2 R U2 R2",
        "note": "OH 2-Gen <R, U> (No Table Abuse)",
        "startAuf": ""
      },
      {
        "id": "h-oh-ru-2",
        "alg": "R2 U2 R' U2 R2 U2 R2 U2 R' U2 R2",
        "note": "OH 2-Gen <R, U> R' flick (No Table Abuse)",
        "startAuf": ""
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
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "z-2",
        "alg": "y M2' U' M2' U' M' U2 M2' U2 M' y'",
        "note": "Alternative finger-trick with rotation",
        "startAuf": ""
      },
      {
        "id": "Z-3",
        "alg": "M' U' M2 U' M2 U' M' U2 M2",
        "note": "Community Alt",
        "startAuf": ""
      },
      {
        "id": "Z-5",
        "alg": "M2 U' M2 U' M' U2 M2 U2 M'",
        "note": "Community Alt",
        "startAuf": "U"
      },
      {
        "id": "Z-6",
        "alg": "M' U M2 U M2 U M' U2 M2",
        "note": "Community Alt",
        "startAuf": "U"
      },
      {
        "id": "z-oh-ru-1",
        "alg": "R' U' R2 U R U R' U' R U R U' R U' R'",
        "note": "OH 2-Gen <R, U> (No Table Abuse)",
        "startAuf": ""
      },
      {
        "id": "z-oh-ru-2",
        "alg": "R U R' U R' U' R' U R U' R' U' R2 U R",
        "note": "OH 2-Gen <R, U> Alt (No Table Abuse)",
        "startAuf": ""
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
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "aa-2",
        "alg": "y x' R2 D2 R' U' R D2 R' U R' x y'",
        "note": "Alternative grip",
        "startAuf": ""
      },
      {
        "id": "Aa-3",
        "alg": "y' x L2 D2 L' U' L D2 L' U L'",
        "note": "Community Alt",
        "startAuf": ""
      },
      {
        "id": "Aa-4",
        "alg": "l' U R' D2 R U' R' D2 R2 x'",
        "note": "Community Alt",
        "startAuf": ""
      },
      {
        "id": "Aa-5",
        "alg": "x' R2 D2 R' U' R D2 R' U R' x",
        "note": "Community Alt",
        "startAuf": "U"
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
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "ab-2",
        "alg": "y x' R U' R D2 R' U R D2 R2 x y'",
        "note": "Headlights in front",
        "startAuf": ""
      },
      {
        "id": "Ab-3",
        "alg": "y' x L U' L D2 L' U L D2 L2",
        "note": "Community Alt",
        "startAuf": ""
      },
      {
        "id": "Ab-4",
        "alg": "x' R U' R D2 R' U R D2 R2 x",
        "note": "Community Alt",
        "startAuf": "U"
      },
      {
        "id": "Ab-5",
        "alg": "R' B' R U' R D R' U R D' R2 B R",
        "note": "Community Alt",
        "startAuf": ""
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
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "ja-2",
        "alg": "U' R' U L' U2 R U' R' U2 R L",
        "note": "Niklas-style 2-gen (AUF aligned)",
        "startAuf": ""
      },
      {
        "id": "ja-3",
        "alg": "y2 L' U' L F L' U' L U L F' L2' U L y2 U",
        "note": "Left-handed Jb mirror with rotation",
        "startAuf": ""
      },
      {
        "id": "Ja-4",
        "alg": "L' U' L F L' U' L U L F' L2 U L",
        "note": "Community Alt",
        "startAuf": "U2"
      },
      {
        "id": "Ja-5",
        "alg": "R' U L' U2 R U' R' U2 R L",
        "note": "Community Alt",
        "startAuf": "U'"
      },
      {
        "id": "Ja-6",
        "alg": "R U' L' U R' U2 L U' L' U2 L",
        "note": "Community Alt",
        "startAuf": "U2"
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
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "jb-2",
        "alg": "R U2 R' U' R U2 L' U R' U' L",
        "note": "2-gen RU/L variant",
        "startAuf": ""
      },
      {
        "id": "Jb-3",
        "alg": "r' F R F' r U2 R' U R U2 R'",
        "note": "Community Alt",
        "startAuf": ""
      },
      {
        "id": "Jb-4",
        "alg": "L' U R U' L U2 R' U R U2 R'",
        "note": "Community Alt",
        "startAuf": ""
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
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "ra-2",
        "alg": "R U R' F' R U2 R' U2 R' F R U R U2 R'",
        "note": "RUF-gen variant",
        "startAuf": ""
      },
      {
        "id": "Ra-3",
        "alg": "L U2 L' U2 L F' L' U' L U L F L2",
        "note": "Community Alt",
        "startAuf": "U'"
      },
      {
        "id": "Ra-4",
        "alg": "R U' R' U' R U R' U R' D' R U' R' D R2 U R'",
        "note": "Community Alt",
        "startAuf": ""
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
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "rb-2",
        "alg": "R' U2 R' D' R U' R' D R U R U' R' U' R",
        "note": "RUD-gen variant",
        "startAuf": ""
      },
      {
        "id": "Rb-3",
        "alg": "R2 F R U R U' R' F' R U2 R' U2 R",
        "note": "Community Alt",
        "startAuf": "U"
      },
      {
        "id": "Rb-4",
        "alg": "R' U R U R' U' R' D' R U R' D R U2 R",
        "note": "Community Alt",
        "startAuf": "U"
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
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "t-2",
        "alg": "R2 U R2 U' R2 U' D R2 U' R2 U R2 D'",
        "note": "2-gen RU/D variant",
        "startAuf": ""
      },
      {
        "id": "T-3",
        "alg": "l b d' L' U' F U2 L' U' L' U L U' f' S M r u E U' R'",
        "note": "Community Alt",
        "startAuf": ""
      },
      {
        "id": "T-4",
        "alg": "R U R' U' R' F R2 U' R' U F' L' U L",
        "note": "Community Alt",
        "startAuf": ""
      },
      {
        "id": "T-5",
        "alg": "R2 u R2 u' R2 F2 u' F2 u F2",
        "note": "Community Alt",
        "startAuf": ""
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
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "f-2",
        "alg": "y R' U2 R' d' R' F' R2 U' R' U R' F R U' F y2",
        "note": "Alternative finger-trick with rotation",
        "startAuf": ""
      },
      {
        "id": "F-3",
        "alg": "R' F R f' R' F R2 U R' U' R' F' R2 U R' S",
        "note": "Community Alt",
        "startAuf": ""
      },
      {
        "id": "F-4",
        "alg": "R' U R U' R2 F' U' F U R F R' F' R2",
        "note": "Community Alt",
        "startAuf": "U'"
      },
      {
        "id": "F-5",
        "alg": "R2 F R F' R' U' F' U F R2 U R' U' R",
        "note": "Community Alt",
        "startAuf": ""
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
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "v-2",
        "alg": "R' U R' U' B' R' B2 U' B' U B' R B R y",
        "note": "Rotationless B variant",
        "startAuf": ""
      },
      {
        "id": "V-3",
        "alg": "R' U R' U' R D' R' D R' U D' R2 U' R2 D R2",
        "note": "Community Alt",
        "startAuf": ""
      },
      {
        "id": "V-4",
        "alg": "R' U R U' R' f' U' R U2 R' U' R U' R' f R",
        "note": "Community Alt",
        "startAuf": ""
      },
      {
        "id": "V-5",
        "alg": "R U' R U R' D R D' R U' D R2 U R2 D' R2",
        "note": "Community Alt",
        "startAuf": "U"
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
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "y-2",
        "alg": "F R' F R2 U' R' U' R U R' F' R U R' U' F'",
        "note": "Fast alternative",
        "startAuf": ""
      },
      {
        "id": "Y-3",
        "alg": "R2 U' R2 U' R2 U F U F' R2 F U' F'",
        "note": "Community Alt",
        "startAuf": ""
      },
      {
        "id": "Y-4",
        "alg": "F R' F' R U R U' R2 U' R U R f' U' f",
        "note": "Community Alt",
        "startAuf": ""
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
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "e-2",
        "alg": "x' L' U L D' L' U' L D L' U' L D' L' U L D x",
        "note": "Left-handed mirror",
        "startAuf": ""
      },
      {
        "id": "E-3",
        "alg": "R' U' R' D' R U' R' D R U R' D' R U R' D R2",
        "note": "Community Alt",
        "startAuf": ""
      },
      {
        "id": "E-4",
        "alg": "R2 U F' R' U R U' R' U R U' R' U R U' F U' R2",
        "note": "Community Alt",
        "startAuf": "U"
      },
      {
        "id": "E-5",
        "alg": "x' L' U L D' L' U' L D L' U' L D' L' U L D",
        "note": "Community Alt",
        "startAuf": ""
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
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "na-2",
        "alg": "z U R' D R2 U' R D' U R' D R2 U' R D' z'",
        "note": "z-rotation RUD variant",
        "startAuf": ""
      },
      {
        "id": "Na-3",
        "alg": "F' R U R' U' R' F R2 F U' R' U' R U F' R'",
        "note": "Community Alt",
        "startAuf": ""
      },
      {
        "id": "Na-4",
        "alg": "R F U' R' U R U F' R2 F' R U R U' R' F",
        "note": "Community Alt",
        "startAuf": ""
      },
      {
        "id": "Na-5",
        "alg": "r' D r U2 r' D r U2 r' D r U2 r' D r U2 r' D r",
        "note": "Community Alt",
        "startAuf": ""
      },
      {
        "id": "na-oh-rul-1",
        "alg": "R U' L U2 R' U L' R U' L U2 R' U L'",
        "note": "OH 3-Gen <R, U, L> (No Table Abuse)",
        "startAuf": ""
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
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "nb-2",
        "alg": "z U' R D' R2 U R' D U' R D' R2 U R' D z'",
        "note": "z-rotation RUD variant",
        "startAuf": ""
      },
      {
        "id": "Nb-3",
        "alg": "r' D' F r U' r' F' D r2 U r' U' r' F r F'",
        "note": "Community Alt",
        "startAuf": ""
      },
      {
        "id": "Nb-4",
        "alg": "R' U L' U2 R U' L R' U L' U2 R U' L",
        "note": "Community Alt",
        "startAuf": ""
      },
      {
        "id": "Nb-5",
        "alg": "R' U R U' R' F' U' F R U R' U' R U' f R f'",
        "note": "Community Alt",
        "startAuf": ""
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
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "ga-2",
        "alg": "R2 u R' U R' U' R u' R2' F' U F U'",
        "note": "Wide u turn variant",
        "startAuf": ""
      },
      {
        "id": "Ga-3",
        "alg": "R2 u R' U R' U' R u' R2 F' U F",
        "note": "Community Alt",
        "startAuf": ""
      },
      {
        "id": "Ga-4",
        "alg": "R U R' F' R U R' U' R' F R U' R' F R2 U' R' U' R U R' F'",
        "note": "Community Alt",
        "startAuf": "U"
      },
      {
        "id": "Ga-5",
        "alg": "L2 F2 L' U2 L' U2 L F' L' U' L U L F' L2",
        "note": "Community Alt",
        "startAuf": ""
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
        "alg": "R' U' R U D' R2 U R' U R U' R U' R2 D",
        "note": "Standard RUD-gen",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "gb-2",
        "alg": "y F' U' F R2 u R' U R U' R u' R2 y' U",
        "note": "F-start wide-u variant",
        "startAuf": ""
      },
      {
        "id": "Gb-3",
        "alg": "D R' U' R U D' R2 U R' U R U' R U' R2",
        "note": "Community Alt",
        "startAuf": ""
      },
      {
        "id": "Gb-4",
        "alg": "F' U' F R2 u R' U R U' R u' R2",
        "note": "Community Alt",
        "startAuf": "U"
      },
      {
        "id": "Gb-5",
        "alg": "R' d' F R2 u R' U R U' R u' R2",
        "note": "Community Alt",
        "startAuf": ""
      }
    ],
    "setup": "R2' U R' U R' U' R U' R2' D U' R' U R D'"
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
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "gc-2",
        "alg": "R2 u' R U' R U R' u R2' f R' f' U",
        "note": "Wide u' turn variant",
        "startAuf": ""
      },
      {
        "id": "Gc-3",
        "alg": "R2 F2 R U2 R U2 R' F R U R' U' R' F R2",
        "note": "Community Alt",
        "startAuf": "U2"
      },
      {
        "id": "Gc-4",
        "alg": "D R2 U' R U' R U R' U R2 D' U R U' R'",
        "note": "Community Alt",
        "startAuf": ""
      },
      {
        "id": "Gc-5",
        "alg": "R2 u' R U' R U R' u R2 f R' f'",
        "note": "Community Alt",
        "startAuf": ""
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
        "alg": "R U R' U' D R2 U' R U' R' U R' U R2 D'",
        "note": "Standard RUD-gen",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "gd-2",
        "alg": "R U R' y' R2 u' R U' R' U R' u R2 y U'",
        "note": "Standard with rotation",
        "startAuf": ""
      },
      {
        "id": "Gd-3",
        "alg": "D' R U R' U' D R2 U' R U' R' U R' U R2",
        "note": "Community Alt",
        "startAuf": ""
      },
      {
        "id": "Gd-4",
        "alg": "R U R' y' R2 u' R U' R' U R' u R2",
        "note": "Community Alt",
        "startAuf": ""
      },
      {
        "id": "Gd-5",
        "alg": "R2 F' R U R U' R' F' R U2 R' U2 R' F2 R2",
        "note": "Community Alt",
        "startAuf": "U"
      }
    ],
    "setup": "R2' U' R U' R U R' U R2' D' U R U' R' D"
  }
];

export const pllCaseById = new Map(pllCases.map(c => [c.id, c]));
