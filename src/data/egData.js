// 2x2x2 EG-1 (40 Cases: Back Bar D=[5,4,6,7]) & EG-2 (40 Cases: Diag Bottom Swap D=[4,7,6,5])
// Generated and mathematically verified against cubing.js 2x2x2 KPuzzle

export const eg1Cases = [
  {
    "id": "EG1-H1",
    "name": "EG-1 H1 (H-Group)",
    "shortName": "EG1-H1",
    "group": "H-Group",
    "cllCounterpart": "H1",
    "bottomState": "adj-back",
    "setup": "U F' R2 F' R F R' U R'",
    "description": "EG-1 H1: Solved Back Bar (DBL+DBR) on bottom with adjacent swap in front (DFL↔DFR). Recognition mirrors CLL H1.",
    "algs": [
      {
        "id": "EG1-H1-1",
        "alg": "R U' R F' R' F R2 F U'",
        "note": "Recommended <R, U, F>",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "EG1-H1-2",
        "alg": "U' F' R2 F' R F R' U R'",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      },
      {
        "id": "EG1-H1-3",
        "alg": "R' F R' F U F' R2 F' U'",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "EG1-H2",
    "name": "EG-1 H2 (H-Group)",
    "shortName": "EG1-H2",
    "group": "H-Group",
    "cllCounterpart": "H2",
    "bottomState": "adj-back",
    "setup": "F U' R' F R2 U2 R' U F'",
    "description": "EG-1 H2: Solved Back Bar (DBL+DBR) on bottom with adjacent swap in front (DFL↔DFR). Recognition mirrors CLL H2.",
    "algs": [
      {
        "id": "EG1-H2-1",
        "alg": "F U' R U2 R2 F' R U F'",
        "note": "Recommended <R, U, F>",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "EG1-H2-2",
        "alg": "F U' R' F R2 U2 R' U F'",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      },
      {
        "id": "EG1-H2-3",
        "alg": "F' U R U' R2 F2 R U' F",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "EG1-H3",
    "name": "EG-1 H3 (H-Group)",
    "shortName": "EG1-H3",
    "group": "H-Group",
    "cllCounterpart": "H3",
    "bottomState": "adj-back",
    "setup": "U F' R U' F R2 U' F' R'",
    "description": "EG-1 H3: Solved Back Bar (DBL+DBR) on bottom with adjacent swap in front (DFL↔DFR). Recognition mirrors CLL H3.",
    "algs": [
      {
        "id": "EG1-H3-1",
        "alg": "R F U R2 F' U R' F U'",
        "note": "Recommended <R, U, F>",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "EG1-H3-2",
        "alg": "R' U' R' F2 U F' R F' U'",
        "note": "Start AUF U2 · Optimal <R, U, F>",
        "isDefault": false,
        "startAuf": "U2"
      },
      {
        "id": "EG1-H3-3",
        "alg": "F' R U' R2 U' F' R2 U R U",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "EG1-H4",
    "name": "EG-1 H4 (H-Group)",
    "shortName": "EG1-H4",
    "group": "H-Group",
    "cllCounterpart": "H4",
    "bottomState": "adj-back",
    "setup": "R2 U F2 U2 R2 U' R' U2 R2",
    "description": "EG-1 H4: Solved Back Bar (DBL+DBR) on bottom with adjacent swap in front (DFL↔DFR). Recognition mirrors CLL H4.",
    "algs": [
      {
        "id": "EG1-H4-1",
        "alg": "R2 U2 R U R2 U2 F2 U' R2",
        "note": "Recommended <R, U, F>",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "EG1-H4-2",
        "alg": "R2 U2 R U' F2 U2 R2 U R2",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      },
      {
        "id": "EG1-H4-3",
        "alg": "F2 U' R U R2 F' R U' F",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "EG1-P1",
    "name": "EG-1 P1 (P-Group)",
    "shortName": "EG1-P1",
    "group": "P-Group",
    "cllCounterpart": "P1",
    "bottomState": "adj-back",
    "setup": "F2 U R' F2 R2 U' R' U' F2",
    "description": "EG-1 P1: Solved Back Bar (DBL+DBR) on bottom with adjacent swap in front (DFL↔DFR). Recognition mirrors CLL P1.",
    "algs": [
      {
        "id": "EG1-P1-1",
        "alg": "F2 U R U R2 F2 R U' F2",
        "note": "Recommended <R, U, F>",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "EG1-P1-2",
        "alg": "F2 U R' F2 R2 U' R' U' F2",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      },
      {
        "id": "EG1-P1-3",
        "alg": "F R F U F' U R' U F'",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "EG1-P2",
    "name": "EG-1 P2 (P-Group)",
    "shortName": "EG1-P2",
    "group": "P-Group",
    "cllCounterpart": "P2",
    "bottomState": "adj-back",
    "setup": "R U R2 F' R2 U R'",
    "description": "EG-1 P2: Solved Back Bar (DBL+DBR) on bottom with adjacent swap in front (DFL↔DFR). Recognition mirrors CLL P2.",
    "algs": [
      {
        "id": "EG1-P2-1",
        "alg": "R U' R2 F R2 U' R'",
        "note": "Recommended <R, U, F>",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "EG1-P2-2",
        "alg": "R' F R2 U' R2 F R",
        "note": "Speedcubing <R, U, F> alg",
        "isDefault": false,
        "startAuf": ""
      },
      {
        "id": "EG1-P2-3",
        "alg": "R U R2 F' R2 U R' U",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "EG1-P3",
    "name": "EG-1 P3 (P-Group)",
    "shortName": "EG1-P3",
    "group": "P-Group",
    "cllCounterpart": "P3",
    "bottomState": "adj-back",
    "setup": "R' U' R' F2 U F' R F'",
    "description": "EG-1 P3: Solved Back Bar (DBL+DBR) on bottom with adjacent swap in front (DFL↔DFR). Recognition mirrors CLL P3.",
    "algs": [
      {
        "id": "EG1-P3-1",
        "alg": "F R' F U' F2 R U R",
        "note": "Recommended <R, U, F>",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "EG1-P3-2",
        "alg": "F' R U' F R2 U' F' R' U2",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      },
      {
        "id": "EG1-P3-3",
        "alg": "R2 U F U F2 U2 R2 F R",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "EG1-P4",
    "name": "EG-1 P4 (P-Group)",
    "shortName": "EG1-P4",
    "group": "P-Group",
    "cllCounterpart": "P4",
    "bottomState": "adj-back",
    "setup": "F U2 F U' R U R' F",
    "description": "EG-1 P4: Solved Back Bar (DBL+DBR) on bottom with adjacent swap in front (DFL↔DFR). Recognition mirrors CLL P4.",
    "algs": [
      {
        "id": "EG1-P4-1",
        "alg": "F' R U' R' U F' U2 F'",
        "note": "Recommended <R, U, F>",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "EG1-P4-2",
        "alg": "F2 U F' R U R' U F'",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      },
      {
        "id": "EG1-P4-3",
        "alg": "R' U F' R' U F' U2 R2 F",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "EG1-P5",
    "name": "EG-1 P5 (P-Group)",
    "shortName": "EG1-P5",
    "group": "P-Group",
    "cllCounterpart": "P5",
    "bottomState": "adj-back",
    "setup": "R' F2 U2 R' U F2 R U R",
    "description": "EG-1 P5: Solved Back Bar (DBL+DBR) on bottom with adjacent swap in front (DFL↔DFR). Recognition mirrors CLL P5.",
    "algs": [
      {
        "id": "EG1-P5-1",
        "alg": "R' U' R' F2 U' R U2 F2 R",
        "note": "Recommended <R, U, F>",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "EG1-P5-2",
        "alg": "R U2 F2 R2 U' F' R2 U' R2",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      },
      {
        "id": "EG1-P5-3",
        "alg": "R' U2 F2 R2 U F' R2 U' R2",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "EG1-P6",
    "name": "EG-1 P6 (P-Group)",
    "shortName": "EG1-P6",
    "group": "P-Group",
    "cllCounterpart": "P6",
    "bottomState": "adj-back",
    "setup": "R' U' R' F2 U' R U2 F2 R",
    "description": "EG-1 P6: Solved Back Bar (DBL+DBR) on bottom with adjacent swap in front (DFL↔DFR). Recognition mirrors CLL P6.",
    "algs": [
      {
        "id": "EG1-P6-1",
        "alg": "R' F2 U2 R' U F2 R U R",
        "note": "Recommended <R, U, F>",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "EG1-P6-2",
        "alg": "R2 U R2 F U R2 F2 U2 R'",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      },
      {
        "id": "EG1-P6-3",
        "alg": "R2 U R2 F U' R2 F2 U2 R",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "EG1-U1",
    "name": "EG-1 U1 (U-Group)",
    "shortName": "EG1-U1",
    "group": "U-Group",
    "cllCounterpart": "U1",
    "bottomState": "adj-back",
    "setup": "F' U2 F' U2 F' U' F2 U'",
    "description": "EG-1 U1: Solved Back Bar (DBL+DBR) on bottom with adjacent swap in front (DFL↔DFR). Recognition mirrors CLL U1.",
    "algs": [
      {
        "id": "EG1-U1-1",
        "alg": "U F2 U F U2 F U2 F",
        "note": "Recommended <R, U, F>",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "EG1-U1-2",
        "alg": "F' U2 F' U2 F' U' F2 U'",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      },
      {
        "id": "EG1-U1-3",
        "alg": "U F2 U' F' U2 F' U2 F' U2",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "EG1-U2",
    "name": "EG-1 U2 (U-Group)",
    "shortName": "EG1-U2",
    "group": "U-Group",
    "cllCounterpart": "U2",
    "bottomState": "adj-back",
    "setup": "R2 F2 R F2 R' U2 R' U' F2",
    "description": "EG-1 U2: Solved Back Bar (DBL+DBR) on bottom with adjacent swap in front (DFL↔DFR). Recognition mirrors CLL U2.",
    "algs": [
      {
        "id": "EG1-U2-1",
        "alg": "F2 U R U2 R F2 R' F2 R2",
        "note": "Recommended <R, U, F>",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "EG1-U2-2",
        "alg": "F2 U F2 R' U2 R' U2 R F2",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      },
      {
        "id": "EG1-U2-3",
        "alg": "F R2 F U2 F U F2 R2 U",
        "note": "Start AUF U · Optimal <R, U, F>",
        "isDefault": false,
        "startAuf": "U"
      }
    ]
  },
  {
    "id": "EG1-U3",
    "name": "EG-1 U3 (U-Group)",
    "shortName": "EG1-U3",
    "group": "U-Group",
    "cllCounterpart": "U3",
    "bottomState": "adj-back",
    "setup": "F' U2 R U2 R' U2 F",
    "description": "EG-1 U3: Solved Back Bar (DBL+DBR) on bottom with adjacent swap in front (DFL↔DFR). Recognition mirrors CLL U3.",
    "algs": [
      {
        "id": "EG1-U3-1",
        "alg": "F' U2 R U2 R' U2 F",
        "note": "Recommended <R, U, F>",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "EG1-U3-2",
        "alg": "F' U2 R U2 R' U2 F U'",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      },
      {
        "id": "EG1-U3-3",
        "alg": "F U2 R' F2 R U2 F' U'",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "EG1-U4",
    "name": "EG-1 U4 (U-Group)",
    "shortName": "EG1-U4",
    "group": "U-Group",
    "cllCounterpart": "U4",
    "bottomState": "adj-back",
    "setup": "R U R2 F' R F R' F' R",
    "description": "EG-1 U4: Solved Back Bar (DBL+DBR) on bottom with adjacent swap in front (DFL↔DFR). Recognition mirrors CLL U4.",
    "algs": [
      {
        "id": "EG1-U4-1",
        "alg": "R' F R F' R' F R2 U' R'",
        "note": "Recommended <R, U, F>",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "EG1-U4-2",
        "alg": "R2 F' R' F R F2 R2 U' R'",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      },
      {
        "id": "EG1-U4-3",
        "alg": "R2 F' R' F R' U R2 F2 R",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "EG1-U5",
    "name": "EG-1 U5 (U-Group)",
    "shortName": "EG1-U5",
    "group": "U-Group",
    "cllCounterpart": "U5",
    "bottomState": "adj-back",
    "setup": "U F' U R2 U' R' F U2 R'",
    "description": "EG-1 U5: Solved Back Bar (DBL+DBR) on bottom with adjacent swap in front (DFL↔DFR). Recognition mirrors CLL U5.",
    "algs": [
      {
        "id": "EG1-U5-1",
        "alg": "R U2 F' R U R2 U' F U'",
        "note": "Recommended <R, U, F>",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "EG1-U5-2",
        "alg": "R U2 F2 R' U2 R U F2 U'",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      },
      {
        "id": "EG1-U5-3",
        "alg": "R F2 R U2 F2 R U F2 U'",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "EG1-U6",
    "name": "EG-1 U6 (U-Group)",
    "shortName": "EG1-U6",
    "group": "U-Group",
    "cllCounterpart": "U6",
    "bottomState": "adj-back",
    "setup": "R' F' R2 U R' U F U' F'",
    "description": "EG-1 U6: Solved Back Bar (DBL+DBR) on bottom with adjacent swap in front (DFL↔DFR). Recognition mirrors CLL U6.",
    "algs": [
      {
        "id": "EG1-U6-1",
        "alg": "F U F' U' R U' R2 F R",
        "note": "Recommended <R, U, F>",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "EG1-U6-2",
        "alg": "U2 F2 R F R U2 R F' R'",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      },
      {
        "id": "EG1-U6-3",
        "alg": "U2 F2 U' F U2 F R U R'",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "EG1-T1",
    "name": "EG-1 T1 (T-Group)",
    "shortName": "EG1-T1",
    "group": "T-Group",
    "cllCounterpart": "T1",
    "bottomState": "adj-back",
    "setup": "U' R' F' U R2 U R F' R2",
    "description": "EG-1 T1: Solved Back Bar (DBL+DBR) on bottom with adjacent swap in front (DFL↔DFR). Recognition mirrors CLL T1.",
    "algs": [
      {
        "id": "EG1-T1-1",
        "alg": "R2 F R' U' R2 U' F R U",
        "note": "Recommended <R, U, F>",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "EG1-T1-2",
        "alg": "R2 F R' F U R F' R2 F'",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      },
      {
        "id": "EG1-T1-3",
        "alg": "F' U R' F2 R U' F' U F2",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "EG1-T2",
    "name": "EG-1 T2 (T-Group)",
    "shortName": "EG1-T2",
    "group": "T-Group",
    "cllCounterpart": "T2",
    "bottomState": "adj-back",
    "setup": "U2 R' U2 R' F' R2 F' R' F",
    "description": "EG-1 T2: Solved Back Bar (DBL+DBR) on bottom with adjacent swap in front (DFL↔DFR). Recognition mirrors CLL T2.",
    "algs": [
      {
        "id": "EG1-T2-1",
        "alg": "F' R F R2 F R U2 R U2",
        "note": "Recommended <R, U, F>",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "EG1-T2-2",
        "alg": "R2 F' U F U2 F U' R' U2",
        "note": "Start AUF U2 · Optimal <R, U, F>",
        "isDefault": false,
        "startAuf": "U2"
      },
      {
        "id": "EG1-T2-3",
        "alg": "R U F' R U' R U' R2 U' R2",
        "note": "Start AUF U2 · Optimal <R, U, F>",
        "isDefault": false,
        "startAuf": "U2"
      }
    ]
  },
  {
    "id": "EG1-T3",
    "name": "EG-1 T3 (T-Group)",
    "shortName": "EG1-T3",
    "group": "T-Group",
    "cllCounterpart": "T3",
    "bottomState": "adj-back",
    "setup": "R U2 R' U' R' F' R2 U R'",
    "description": "EG-1 T3: Solved Back Bar (DBL+DBR) on bottom with adjacent swap in front (DFL↔DFR). Recognition mirrors CLL T3.",
    "algs": [
      {
        "id": "EG1-T3-1",
        "alg": "R U' R2 F R U R U2 R'",
        "note": "Recommended <R, U, F>",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "EG1-T3-2",
        "alg": "R U' R2 F U' R2 U R U'",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      },
      {
        "id": "EG1-T3-3",
        "alg": "U' R F U2 F' U R2 F' R",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "EG1-T4",
    "name": "EG-1 T4 (T-Group)",
    "shortName": "EG1-T4",
    "group": "T-Group",
    "cllCounterpart": "T4",
    "bottomState": "adj-back",
    "setup": "F R2 F U2 F U F2 R2",
    "description": "EG-1 T4: Solved Back Bar (DBL+DBR) on bottom with adjacent swap in front (DFL↔DFR). Recognition mirrors CLL T4.",
    "algs": [
      {
        "id": "EG1-T4-1",
        "alg": "R2 F2 U' F' U2 F' R2 F'",
        "note": "Recommended <R, U, F>",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "EG1-T4-2",
        "alg": "R2 F2 U F R2 F R2 F U2",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      },
      {
        "id": "EG1-T4-3",
        "alg": "F2 U R2 F' U2 F U2 F R2",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "EG1-T5",
    "name": "EG-1 T5 (T-Group)",
    "shortName": "EG1-T5",
    "group": "T-Group",
    "cllCounterpart": "T5",
    "bottomState": "adj-back",
    "setup": "R U' R' F R U' R2 F R",
    "description": "EG-1 T5: Solved Back Bar (DBL+DBR) on bottom with adjacent swap in front (DFL↔DFR). Recognition mirrors CLL T5.",
    "algs": [
      {
        "id": "EG1-T5-1",
        "alg": "R' F' R2 U R' F' R U R'",
        "note": "Recommended <R, U, F>",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "EG1-T5-2",
        "alg": "F' R F' R U2 R F U' R",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      },
      {
        "id": "EG1-T5-3",
        "alg": "R U2 R2 F R' F U' F' R2",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "EG1-T6",
    "name": "EG-1 T6 (T-Group)",
    "shortName": "EG1-T6",
    "group": "T-Group",
    "cllCounterpart": "T6",
    "bottomState": "adj-back",
    "setup": "R U' R' U2 F R U2 R' F",
    "description": "EG-1 T6: Solved Back Bar (DBL+DBR) on bottom with adjacent swap in front (DFL↔DFR). Recognition mirrors CLL T6.",
    "algs": [
      {
        "id": "EG1-T6-1",
        "alg": "F' R U2 R' F' U2 R U R'",
        "note": "Recommended <R, U, F>",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "EG1-T6-2",
        "alg": "F2 R F R U' R U' F' R'",
        "note": "Start AUF U · Optimal <R, U, F>",
        "isDefault": false,
        "startAuf": "U"
      },
      {
        "id": "EG1-T6-3",
        "alg": "F2 R' U' F' R F' R U R",
        "note": "Start AUF U · Optimal <R, U, F>",
        "isDefault": false,
        "startAuf": "U"
      }
    ]
  },
  {
    "id": "EG1-L1",
    "name": "EG-1 L1 (L-Group)",
    "shortName": "EG1-L1",
    "group": "L-Group",
    "cllCounterpart": "L1",
    "bottomState": "adj-back",
    "setup": "R2 F' U F U2 F U' R'",
    "description": "EG-1 L1: Solved Back Bar (DBL+DBR) on bottom with adjacent swap in front (DFL↔DFR). Recognition mirrors CLL L1.",
    "algs": [
      {
        "id": "EG1-L1-1",
        "alg": "R U F' U2 F' U' F R2",
        "note": "Recommended <R, U, F>",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "EG1-L1-2",
        "alg": "R U F' R F R' F' U2 R",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      },
      {
        "id": "EG1-L1-3",
        "alg": "R' U2 R' F' R2 F' R' F U2",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "EG1-L2",
    "name": "EG-1 L2 (L-Group)",
    "shortName": "EG1-L2",
    "group": "L-Group",
    "cllCounterpart": "L2",
    "bottomState": "adj-back",
    "setup": "R2 F R' U' R2 U' F R U",
    "description": "EG-1 L2: Solved Back Bar (DBL+DBR) on bottom with adjacent swap in front (DFL↔DFR). Recognition mirrors CLL L2.",
    "algs": [
      {
        "id": "EG1-L2-1",
        "alg": "U' R' F' U R2 U R F' R2",
        "note": "Recommended <R, U, F>",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "EG1-L2-2",
        "alg": "F R2 F R' U' F' R F' R2",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      },
      {
        "id": "EG1-L2-3",
        "alg": "F2 U' F U R' F2 R U' F",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "EG1-L3",
    "name": "EG-1 L3 (L-Group)",
    "shortName": "EG1-L3",
    "group": "L-Group",
    "cllCounterpart": "L3",
    "bottomState": "adj-back",
    "setup": "F' U F2 R' U' R2 F2 U R",
    "description": "EG-1 L3: Solved Back Bar (DBL+DBR) on bottom with adjacent swap in front (DFL↔DFR). Recognition mirrors CLL L3.",
    "algs": [
      {
        "id": "EG1-L3-1",
        "alg": "R' U' F2 R2 U R F2 U' F",
        "note": "Recommended <R, U, F>",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "EG1-L3-2",
        "alg": "R2 U2 F' R F2 R U2 R2 F'",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      },
      {
        "id": "EG1-L3-3",
        "alg": "F2 U' F2 U' R F' U F R2",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "EG1-L4",
    "name": "EG-1 L4 (L-Group)",
    "shortName": "EG1-L4",
    "group": "L-Group",
    "cllCounterpart": "L4",
    "bottomState": "adj-back",
    "setup": "R' F R2 U R' F' R U2 R'",
    "description": "EG-1 L4: Solved Back Bar (DBL+DBR) on bottom with adjacent swap in front (DFL↔DFR). Recognition mirrors CLL L4.",
    "algs": [
      {
        "id": "EG1-L4-1",
        "alg": "R U2 R' F R U' R2 F' R",
        "note": "Recommended <R, U, F>",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "EG1-L4-2",
        "alg": "R' F R2 U R' F' R U2 R'",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      },
      {
        "id": "EG1-L4-3",
        "alg": "F2 R' U F' R U' R2 U' F2",
        "note": "Start AUF U · Optimal <R, U, F>",
        "isDefault": false,
        "startAuf": "U"
      }
    ]
  },
  {
    "id": "EG1-L5",
    "name": "EG-1 L5 (L-Group)",
    "shortName": "EG1-L5",
    "group": "L-Group",
    "cllCounterpart": "L5",
    "bottomState": "adj-back",
    "setup": "U2 R U2 F' R U R2 U' F",
    "description": "EG-1 L5: Solved Back Bar (DBL+DBR) on bottom with adjacent swap in front (DFL↔DFR). Recognition mirrors CLL L5.",
    "algs": [
      {
        "id": "EG1-L5-1",
        "alg": "F' U R2 U' R' F U2 R' U2",
        "note": "Recommended <R, U, F>",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "EG1-L5-2",
        "alg": "F2 U' R' U2 R U2 R U2 F2",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      },
      {
        "id": "EG1-L5-3",
        "alg": "R2 F2 U R U2 F2 R F2 R",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "EG1-L6",
    "name": "EG-1 L6 (L-Group)",
    "shortName": "EG1-L6",
    "group": "L-Group",
    "cllCounterpart": "L6",
    "bottomState": "adj-back",
    "setup": "U F2 U' F U2 F R U R'",
    "description": "EG-1 L6: Solved Back Bar (DBL+DBR) on bottom with adjacent swap in front (DFL↔DFR). Recognition mirrors CLL L6.",
    "algs": [
      {
        "id": "EG1-L6-1",
        "alg": "R U' R' F' U2 F' U F2 U'",
        "note": "Recommended <R, U, F>",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "EG1-L6-2",
        "alg": "R F R' U2 R' F' R' F2 U'",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      },
      {
        "id": "EG1-L6-3",
        "alg": "U' F' U2 F' R U2 R' U' F",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "EG1-S1",
    "name": "EG-1 S1 (S-Group)",
    "shortName": "EG1-S1",
    "group": "S-Group",
    "cllCounterpart": "S1",
    "bottomState": "adj-back",
    "setup": "U' F R' U2 F2 R' F U",
    "description": "EG-1 S1: Solved Back Bar (DBL+DBR) on bottom with adjacent swap in front (DFL↔DFR). Recognition mirrors CLL S1.",
    "algs": [
      {
        "id": "EG1-S1-1",
        "alg": "U' F' R F2 U2 R F' U",
        "note": "Recommended <R, U, F>",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "EG1-S1-2",
        "alg": "U' F' R U2 R' F2 U2 F U",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      },
      {
        "id": "EG1-S1-3",
        "alg": "U' F U2 F2 R' F2 R F' U",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "EG1-S2",
    "name": "EG-1 S2 (S-Group)",
    "shortName": "EG1-S2",
    "group": "S-Group",
    "cllCounterpart": "S2",
    "bottomState": "adj-back",
    "setup": "R' U F2 U' R' F2 U F2 R'",
    "description": "EG-1 S2: Solved Back Bar (DBL+DBR) on bottom with adjacent swap in front (DFL↔DFR). Recognition mirrors CLL S2.",
    "algs": [
      {
        "id": "EG1-S2-1",
        "alg": "R F2 U' F2 R U F2 U' R",
        "note": "Recommended <R, U, F>",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "EG1-S2-2",
        "alg": "R' F2 U F2 R' U F2 U' R",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      },
      {
        "id": "EG1-S2-3",
        "alg": "U2 R' F U2 R' F2 R' U F'",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "EG1-S3",
    "name": "EG-1 S3 (S-Group)",
    "shortName": "EG1-S3",
    "group": "S-Group",
    "cllCounterpart": "S3",
    "bottomState": "adj-back",
    "setup": "F' U2 F' U F2 R' F2 R",
    "description": "EG-1 S3: Solved Back Bar (DBL+DBR) on bottom with adjacent swap in front (DFL↔DFR). Recognition mirrors CLL S3.",
    "algs": [
      {
        "id": "EG1-S3-1",
        "alg": "R' F2 R F2 U' F U2 F",
        "note": "Recommended <R, U, F>",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "EG1-S3-2",
        "alg": "F2 R' F' R U' F U' F2 U'",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      },
      {
        "id": "EG1-S3-3",
        "alg": "R' U2 F2 R' F2 U F U2 F",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "EG1-S4",
    "name": "EG-1 S4 (S-Group)",
    "shortName": "EG1-S4",
    "group": "S-Group",
    "cllCounterpart": "S4",
    "bottomState": "adj-back",
    "setup": "F U' F2 U R' U2 R' F2 R'",
    "description": "EG-1 S4: Solved Back Bar (DBL+DBR) on bottom with adjacent swap in front (DFL↔DFR). Recognition mirrors CLL S4.",
    "algs": [
      {
        "id": "EG1-S4-1",
        "alg": "R F2 R U2 R U' F2 U F'",
        "note": "Recommended <R, U, F>",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "EG1-S4-2",
        "alg": "F' U F2 U' R F2 R U2 R",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      },
      {
        "id": "EG1-S4-3",
        "alg": "R2 F2 U' F U' F U' R' F2",
        "note": "Start AUF U2 · Optimal <R, U, F>",
        "isDefault": false,
        "startAuf": "U2"
      }
    ]
  },
  {
    "id": "EG1-S5",
    "name": "EG-1 S5 (S-Group)",
    "shortName": "EG1-S5",
    "group": "S-Group",
    "cllCounterpart": "S5",
    "bottomState": "adj-back",
    "setup": "R2 F' R U' F R' U F2",
    "description": "EG-1 S5: Solved Back Bar (DBL+DBR) on bottom with adjacent swap in front (DFL↔DFR). Recognition mirrors CLL S5.",
    "algs": [
      {
        "id": "EG1-S5-1",
        "alg": "F2 U' R F' U R' F R2",
        "note": "Recommended <R, U, F>",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "EG1-S5-2",
        "alg": "R2 F U' R U' R U' F2 U2",
        "note": "Start AUF U2 · Optimal <R, U, F>",
        "isDefault": false,
        "startAuf": "U2"
      },
      {
        "id": "EG1-S5-3",
        "alg": "U' F2 U' R F' U R' F R2",
        "note": "Start AUF U · Optimal <R, U, F>",
        "isDefault": false,
        "startAuf": "U"
      }
    ]
  },
  {
    "id": "EG1-S6",
    "name": "EG-1 S6 (S-Group)",
    "shortName": "EG1-S6",
    "group": "S-Group",
    "cllCounterpart": "S6",
    "bottomState": "adj-back",
    "setup": "F U2 F' U2 R U' R2 F R",
    "description": "EG-1 S6: Solved Back Bar (DBL+DBR) on bottom with adjacent swap in front (DFL↔DFR). Recognition mirrors CLL S6.",
    "algs": [
      {
        "id": "EG1-S6-1",
        "alg": "R' F' R2 U R' U2 F U2 F'",
        "note": "Recommended <R, U, F>",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "EG1-S6-2",
        "alg": "F U2 F U' F2 R U2 R' U",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      },
      {
        "id": "EG1-S6-3",
        "alg": "F2 U' F U' R U' R' F2 U",
        "note": "Start AUF U' · Optimal <R, U, F>",
        "isDefault": false,
        "startAuf": "U'"
      }
    ]
  },
  {
    "id": "EG1-A1",
    "name": "EG-1 A1 (A-Group)",
    "shortName": "EG1-A1",
    "group": "A-Group",
    "cllCounterpart": "A1",
    "bottomState": "adj-back",
    "setup": "U' F' R F2 U2 R F' U",
    "description": "EG-1 A1: Solved Back Bar (DBL+DBR) on bottom with adjacent swap in front (DFL↔DFR). Recognition mirrors CLL A1.",
    "algs": [
      {
        "id": "EG1-A1-1",
        "alg": "U' F R' U2 F2 R' F U",
        "note": "Recommended <R, U, F>",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "EG1-A1-2",
        "alg": "U' F' U2 F2 R U2 R' F U",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      },
      {
        "id": "EG1-A1-3",
        "alg": "U' F R' F2 R F2 U2 F' U",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "EG1-A2",
    "name": "EG-1 A2 (A-Group)",
    "shortName": "EG1-A2",
    "group": "A-Group",
    "cllCounterpart": "A2",
    "bottomState": "adj-back",
    "setup": "R' F2 U F2 R' U F2 U' R",
    "description": "EG-1 A2: Solved Back Bar (DBL+DBR) on bottom with adjacent swap in front (DFL↔DFR). Recognition mirrors CLL A2.",
    "algs": [
      {
        "id": "EG1-A2-1",
        "alg": "R' U F2 U' R F2 U' F2 R",
        "note": "Recommended <R, U, F>",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "EG1-A2-2",
        "alg": "U R U2 R2 F' R F2 U' F'",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      },
      {
        "id": "EG1-A2-3",
        "alg": "U R' F R2 U2 R' F2 U' F'",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "EG1-A3",
    "name": "EG-1 A3 (A-Group)",
    "shortName": "EG1-A3",
    "group": "A-Group",
    "cllCounterpart": "A3",
    "bottomState": "adj-back",
    "setup": "F U2 F U' F2 R U2 R'",
    "description": "EG-1 A3: Solved Back Bar (DBL+DBR) on bottom with adjacent swap in front (DFL↔DFR). Recognition mirrors CLL A3.",
    "algs": [
      {
        "id": "EG1-A3-1",
        "alg": "R U2 R' F2 U F' U2 F'",
        "note": "Recommended <R, U, F>",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "EG1-A3-2",
        "alg": "F2 R U R' U F' U F2 U",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      },
      {
        "id": "EG1-A3-3",
        "alg": "R F2 U2 R F2 U' F' U2 F'",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "EG1-A4",
    "name": "EG-1 A4 (A-Group)",
    "shortName": "EG1-A4",
    "group": "A-Group",
    "cllCounterpart": "A4",
    "bottomState": "adj-back",
    "setup": "F' U F2 U' R F2 R U2 R",
    "description": "EG-1 A4: Solved Back Bar (DBL+DBR) on bottom with adjacent swap in front (DFL↔DFR). Recognition mirrors CLL A4.",
    "algs": [
      {
        "id": "EG1-A4-1",
        "alg": "R' U2 R' F2 R' U F2 U' F",
        "note": "Recommended <R, U, F>",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "EG1-A4-2",
        "alg": "F U' F2 U R' U2 R' F2 R'",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      },
      {
        "id": "EG1-A4-3",
        "alg": "R2 F2 U F' R U' F R F2",
        "note": "Start AUF U2 · Optimal <R, U, F>",
        "isDefault": false,
        "startAuf": "U2"
      }
    ]
  },
  {
    "id": "EG1-A5",
    "name": "EG-1 A5 (A-Group)",
    "shortName": "EG1-A5",
    "group": "A-Group",
    "cllCounterpart": "A5",
    "bottomState": "adj-back",
    "setup": "R U R2 F2 U' F R U R",
    "description": "EG-1 A5: Solved Back Bar (DBL+DBR) on bottom with adjacent swap in front (DFL↔DFR). Recognition mirrors CLL A5.",
    "algs": [
      {
        "id": "EG1-A5-1",
        "alg": "R' U' R' F' U F2 R2 U' R'",
        "note": "Recommended <R, U, F>",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "EG1-A5-2",
        "alg": "F' R' F U2 R' U R2 U R",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      },
      {
        "id": "EG1-A5-3",
        "alg": "F2 U R' U R' U F' R2 U",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "EG1-A6",
    "name": "EG-1 A6 (A-Group)",
    "shortName": "EG1-A6",
    "group": "A-Group",
    "cllCounterpart": "A6",
    "bottomState": "adj-back",
    "setup": "R2 F2 U' R U' F R' F R2",
    "description": "EG-1 A6: Solved Back Bar (DBL+DBR) on bottom with adjacent swap in front (DFL↔DFR). Recognition mirrors CLL A6.",
    "algs": [
      {
        "id": "EG1-A6-1",
        "alg": "R2 F' R F' U R' U F2 R2",
        "note": "Recommended <R, U, F>",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "EG1-A6-2",
        "alg": "F2 U F R' U2 F2 U' R' U",
        "note": "Start AUF U2 · Optimal <R, U, F>",
        "isDefault": false,
        "startAuf": "U2"
      },
      {
        "id": "EG1-A6-3",
        "alg": "F2 U F' U2 F2 R U R' U",
        "note": "Start AUF U2 · Optimal <R, U, F>",
        "isDefault": false,
        "startAuf": "U2"
      }
    ]
  }
];

export const eg1CaseById = new Map(eg1Cases.map(c => [c.id, c]));

export const eg2Cases = [
  {
    "id": "EG2-H1",
    "name": "EG-2 H1 (H-Group)",
    "shortName": "EG2-H1",
    "group": "H-Group",
    "cllCounterpart": "H1",
    "bottomState": "diag",
    "setup": "F2 R F2 R2 U2 R' F2",
    "description": "EG-2 H1: Diagonal swap on bottom (no bars). Use short <R, U, F> EG-2 algs or Anti-CLL (H1 + R2 F2 R2).",
    "algs": [
      {
        "id": "EG2-H1-1",
        "alg": "F2 R U2 R2 F2 R' F2",
        "note": "Recommended <R, U, F>",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "EG2-H1-2",
        "alg": "F2 R' F2 R2 U2 R F2",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "EG2-H2",
    "name": "EG-2 H2 (H-Group)",
    "shortName": "EG2-H2",
    "group": "H-Group",
    "cllCounterpart": "H2",
    "bottomState": "diag",
    "setup": "R2 F2 U2 R' U2 R2",
    "description": "EG-2 H2: Diagonal swap on bottom (no bars). Use short <R, U, F> EG-2 algs or Anti-CLL (H2 + R2 F2 R2).",
    "algs": [
      {
        "id": "EG2-H2-1",
        "alg": "R2 U2 R U2 F2 R2",
        "note": "Recommended <R, U, F>",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "EG2-H2-2",
        "alg": "R2 F2 U2 R' U2 R2",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "EG2-H3",
    "name": "EG-2 H3 (H-Group)",
    "shortName": "EG2-H3",
    "group": "H-Group",
    "cllCounterpart": "H3",
    "bottomState": "diag",
    "setup": "R U' F2 R' U2 R' F U2 F",
    "description": "EG-2 H3: Diagonal swap on bottom (no bars). Use short <R, U, F> EG-2 algs or Anti-CLL (H3 + R2 F2 R2).",
    "algs": [
      {
        "id": "EG2-H3-1",
        "alg": "F' U2 F' R U2 R F2 U R'",
        "note": "Recommended <R, U, F>",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "EG2-H3-2",
        "alg": "F U2 F R' F2 R' F2 U' R",
        "note": "Start AUF U2 · Optimal <R, U, F>",
        "isDefault": false,
        "startAuf": "U2"
      },
      {
        "id": "EG2-H3-3",
        "alg": "U' R U R' U R U R' F R' F' R R2 F2 R2",
        "note": "Anti-CLL (H3 + R2 F2 R2)",
        "isDefault": false,
        "startAuf": "U"
      }
    ]
  },
  {
    "id": "EG2-H4",
    "name": "EG-2 H4 (H-Group)",
    "shortName": "EG2-H4",
    "group": "H-Group",
    "cllCounterpart": "H4",
    "bottomState": "diag",
    "setup": "R' F U' R U R' F2 U2 R",
    "description": "EG-2 H4: Diagonal swap on bottom (no bars). Use short <R, U, F> EG-2 algs or Anti-CLL (H4 + R2 F2 R2).",
    "algs": [
      {
        "id": "EG2-H4-1",
        "alg": "R' U2 F2 R U' R' U F' R",
        "note": "Recommended <R, U, F>",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "EG2-H4-2",
        "alg": "R U2 F2 R' F U F' U R'",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      },
      {
        "id": "EG2-H4-3",
        "alg": "U R' F R F' R U' R' U2 R' F R F' R2 F2 R2",
        "note": "Anti-CLL (H4 + R2 F2 R2)",
        "isDefault": false,
        "startAuf": "U2"
      }
    ]
  },
  {
    "id": "EG2-P1",
    "name": "EG-2 P1 (P-Group)",
    "shortName": "EG2-P1",
    "group": "P-Group",
    "cllCounterpart": "P1",
    "bottomState": "diag",
    "setup": "F' R U2 R F2 U R2 U R'",
    "description": "EG-2 P1: Diagonal swap on bottom (no bars). Use short <R, U, F> EG-2 algs or Anti-CLL (P1 + R2 F2 R2).",
    "algs": [
      {
        "id": "EG2-P1-1",
        "alg": "R U' R2 U' F2 R' U2 R' F",
        "note": "Recommended <R, U, F>",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "EG2-P1-2",
        "alg": "F2 U' F2 R U2 R F2 U' R2",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "EG2-P2",
    "name": "EG-2 P2 (P-Group)",
    "shortName": "EG2-P2",
    "group": "P-Group",
    "cllCounterpart": "P2",
    "bottomState": "diag",
    "setup": "U' F' R2 F2 R' U' R2 U2 R'",
    "description": "EG-2 P2: Diagonal swap on bottom (no bars). Use short <R, U, F> EG-2 algs or Anti-CLL (P2 + R2 F2 R2).",
    "algs": [
      {
        "id": "EG2-P2-1",
        "alg": "R U2 R2 U R F2 R2 F U",
        "note": "Recommended <R, U, F>",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "EG2-P2-2",
        "alg": "U' F R2 F2 R U R2 U2 R",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "EG2-P3",
    "name": "EG-2 P3 (P-Group)",
    "shortName": "EG2-P3",
    "group": "P-Group",
    "cllCounterpart": "P3",
    "bottomState": "diag",
    "setup": "F' R2 F' U R2 U R2 F R'",
    "description": "EG-2 P3: Diagonal swap on bottom (no bars). Use short <R, U, F> EG-2 algs or Anti-CLL (P3 + R2 F2 R2).",
    "algs": [
      {
        "id": "EG2-P3-1",
        "alg": "R F' R2 U' R2 U' F R2 F",
        "note": "Recommended <R, U, F>",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "EG2-P3-2",
        "alg": "R' U F2 R F2 R F' U2 F'",
        "note": "Start AUF U2 · Optimal <R, U, F>",
        "isDefault": false,
        "startAuf": "U2"
      }
    ]
  },
  {
    "id": "EG2-P4",
    "name": "EG-2 P4 (P-Group)",
    "shortName": "EG2-P4",
    "group": "P-Group",
    "cllCounterpart": "P4",
    "bottomState": "diag",
    "setup": "F' U2 R2 F R' U' R U' F",
    "description": "EG-2 P4: Diagonal swap on bottom (no bars). Use short <R, U, F> EG-2 algs or Anti-CLL (P4 + R2 F2 R2).",
    "algs": [
      {
        "id": "EG2-P4-1",
        "alg": "F' U R' U R F' R2 U2 F",
        "note": "Recommended <R, U, F>",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "EG2-P4-2",
        "alg": "F R' U F' U' F R2 U2 F'",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "EG2-P5",
    "name": "EG-2 P5 (P-Group)",
    "shortName": "EG2-P5",
    "group": "P-Group",
    "cllCounterpart": "P5",
    "bottomState": "diag",
    "setup": "U R U R' U R2 F2 R' U2 R'",
    "description": "EG-2 P5: Diagonal swap on bottom (no bars). Use short <R, U, F> EG-2 algs or Anti-CLL (P5 + R2 F2 R2).",
    "algs": [
      {
        "id": "EG2-P5-1",
        "alg": "R U2 R F2 R2 U' R U' R' U'",
        "note": "Recommended <R, U, F>",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "EG2-P5-2",
        "alg": "R U2 R' U R2 F2 R' U' R' U'",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "EG2-P6",
    "name": "EG-2 P6 (P-Group)",
    "shortName": "EG2-P6",
    "group": "P-Group",
    "cllCounterpart": "P6",
    "bottomState": "diag",
    "setup": "F' R' U' F2 U2 R F' R2 F",
    "description": "EG-2 P6: Diagonal swap on bottom (no bars). Use short <R, U, F> EG-2 algs or Anti-CLL (P6 + R2 F2 R2).",
    "algs": [
      {
        "id": "EG2-P6-1",
        "alg": "F' R2 F R' U2 F2 U R F",
        "note": "Recommended <R, U, F>",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "EG2-P6-2",
        "alg": "F' R2 F' U2 F2 R U' R F",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "EG2-U1",
    "name": "EG-2 U1 (U-Group)",
    "shortName": "EG2-U1",
    "group": "U-Group",
    "cllCounterpart": "U1",
    "bottomState": "diag",
    "setup": "R' U R' F U' R U' R' U2 R2",
    "description": "EG-2 U1: Diagonal swap on bottom (no bars). Use short <R, U, F> EG-2 algs or Anti-CLL (U1 + R2 F2 R2).",
    "algs": [
      {
        "id": "EG2-U1-1",
        "alg": "R2 U2 R U R' U F' R U' R",
        "note": "Recommended <R, U, F>",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "EG2-U1-2",
        "alg": "R2 U2 R' U R' U F' R U' R",
        "note": "Start AUF U2 · Optimal <R, U, F>",
        "isDefault": false,
        "startAuf": "U2"
      }
    ]
  },
  {
    "id": "EG2-U2",
    "name": "EG-2 U2 (U-Group)",
    "shortName": "EG2-U2",
    "group": "U-Group",
    "cllCounterpart": "U2",
    "bottomState": "diag",
    "setup": "R2 F2 R' U F R' F' R' U",
    "description": "EG-2 U2: Diagonal swap on bottom (no bars). Use short <R, U, F> EG-2 algs or Anti-CLL (U2 + R2 F2 R2).",
    "algs": [
      {
        "id": "EG2-U2-1",
        "alg": "U' R F R F' U' R F2 R2",
        "note": "Recommended <R, U, F>",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "EG2-U2-2",
        "alg": "U' R' U' F' U F R' F2 R2",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "EG2-U3",
    "name": "EG-2 U3 (U-Group)",
    "shortName": "EG2-U3",
    "group": "U-Group",
    "cllCounterpart": "U3",
    "bottomState": "diag",
    "setup": "R U R' U2 R2 F2 R' U' R'",
    "description": "EG-2 U3: Diagonal swap on bottom (no bars). Use short <R, U, F> EG-2 algs or Anti-CLL (U3 + R2 F2 R2).",
    "algs": [
      {
        "id": "EG2-U3-1",
        "alg": "R U R F2 R2 U2 R U' R'",
        "note": "Recommended <R, U, F>",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "EG2-U3-2",
        "alg": "R U R' U2 R2 F2 R' U' R'",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "EG2-U4",
    "name": "EG-2 U4 (U-Group)",
    "shortName": "EG2-U4",
    "group": "U-Group",
    "cllCounterpart": "U4",
    "bottomState": "diag",
    "setup": "R' U' R U' F U2 R' U' R F'",
    "description": "EG-2 U4: Diagonal swap on bottom (no bars). Use short <R, U, F> EG-2 algs or Anti-CLL (U4 + R2 F2 R2).",
    "algs": [
      {
        "id": "EG2-U4-1",
        "alg": "F R' U R U2 F' U R' U R",
        "note": "Recommended <R, U, F>",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "EG2-U4-2",
        "alg": "F2 R2 U R U' F2 U R' U R",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "EG2-U5",
    "name": "EG-2 U5 (U-Group)",
    "shortName": "EG2-U5",
    "group": "U-Group",
    "cllCounterpart": "U5",
    "bottomState": "diag",
    "setup": "R F' U F U R' U' F2 R2",
    "description": "EG-2 U5: Diagonal swap on bottom (no bars). Use short <R, U, F> EG-2 algs or Anti-CLL (U5 + R2 F2 R2).",
    "algs": [
      {
        "id": "EG2-U5-1",
        "alg": "R2 F2 U R U' F' U' F R'",
        "note": "Recommended <R, U, F>",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "EG2-U5-2",
        "alg": "F2 R2 F R' U R U F R'",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "EG2-U6",
    "name": "EG-2 U6 (U-Group)",
    "shortName": "EG2-U6",
    "group": "U-Group",
    "cllCounterpart": "U6",
    "bottomState": "diag",
    "setup": "R F R' F R' U' R' U2 F",
    "description": "EG-2 U6: Diagonal swap on bottom (no bars). Use short <R, U, F> EG-2 algs or Anti-CLL (U6 + R2 F2 R2).",
    "algs": [
      {
        "id": "EG2-U6-1",
        "alg": "F' U2 R U R F' R F' R'",
        "note": "Recommended <R, U, F>",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "EG2-U6-2",
        "alg": "R2 F2 U' R' U F R F' R",
        "note": "Start AUF U' · Optimal <R, U, F>",
        "isDefault": false,
        "startAuf": "U'"
      }
    ]
  },
  {
    "id": "EG2-T1",
    "name": "EG-2 T1 (T-Group)",
    "shortName": "EG2-T1",
    "group": "T-Group",
    "cllCounterpart": "T1",
    "bottomState": "diag",
    "setup": "R' U2 F U' F' U2 F' R U",
    "description": "EG-2 T1: Diagonal swap on bottom (no bars). Use short <R, U, F> EG-2 algs or Anti-CLL (T1 + R2 F2 R2).",
    "algs": [
      {
        "id": "EG2-T1-1",
        "alg": "U' R' F U2 F U F' U2 R",
        "note": "Recommended <R, U, F>",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "EG2-T1-2",
        "alg": "F R F' U' R' U' R' F2 R2",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "EG2-T2",
    "name": "EG-2 T2 (T-Group)",
    "shortName": "EG2-T2",
    "group": "T-Group",
    "cllCounterpart": "T2",
    "bottomState": "diag",
    "setup": "F U2 R' U R U2 R F' U2",
    "description": "EG-2 T2: Diagonal swap on bottom (no bars). Use short <R, U, F> EG-2 algs or Anti-CLL (T2 + R2 F2 R2).",
    "algs": [
      {
        "id": "EG2-T2-1",
        "alg": "U2 F R' U2 R' U' R U2 F'",
        "note": "Recommended <R, U, F>",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "EG2-T2-2",
        "alg": "F U' R2 U' R' U R2 F' U2",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "EG2-T3",
    "name": "EG-2 T3 (T-Group)",
    "shortName": "EG2-T3",
    "group": "T-Group",
    "cllCounterpart": "T3",
    "bottomState": "diag",
    "setup": "R2 U' F' U F' R F' R",
    "description": "EG-2 T3: Diagonal swap on bottom (no bars). Use short <R, U, F> EG-2 algs or Anti-CLL (T3 + R2 F2 R2).",
    "algs": [
      {
        "id": "EG2-T3-1",
        "alg": "R' F R' F U' F U R2",
        "note": "Recommended <R, U, F>",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "EG2-T3-2",
        "alg": "R2 U' F' U F' R F' R",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "EG2-T4",
    "name": "EG-2 T4 (T-Group)",
    "shortName": "EG2-T4",
    "group": "T-Group",
    "cllCounterpart": "T4",
    "bottomState": "diag",
    "setup": "U' R' U' F' U F R' F2 R2",
    "description": "EG-2 T4: Diagonal swap on bottom (no bars). Use short <R, U, F> EG-2 algs or Anti-CLL (T4 + R2 F2 R2).",
    "algs": [
      {
        "id": "EG2-T4-1",
        "alg": "R2 F2 R F' U' F U R U",
        "note": "Recommended <R, U, F>",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "EG2-T4-2",
        "alg": "R2 F2 R' U F R' F' R' U",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "EG2-T5",
    "name": "EG-2 T5 (T-Group)",
    "shortName": "EG2-T5",
    "group": "T-Group",
    "cllCounterpart": "T5",
    "bottomState": "diag",
    "setup": "F' U' R' F R2 U' R2 U R' F",
    "description": "EG-2 T5: Diagonal swap on bottom (no bars). Use short <R, U, F> EG-2 algs or Anti-CLL (T5 + R2 F2 R2).",
    "algs": [
      {
        "id": "EG2-T5-1",
        "alg": "F' R U' R2 U R2 F' R U F",
        "note": "Recommended <R, U, F>",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "EG2-T5-2",
        "alg": "F' U' F U' R2 U R' U' F2 R2",
        "note": "Start AUF U · Optimal <R, U, F>",
        "isDefault": false,
        "startAuf": "U"
      }
    ]
  },
  {
    "id": "EG2-T6",
    "name": "EG-2 T6 (T-Group)",
    "shortName": "EG2-T6",
    "group": "T-Group",
    "cllCounterpart": "T6",
    "bottomState": "diag",
    "setup": "U R F2 R U2 R' F2 R'",
    "description": "EG-2 T6: Diagonal swap on bottom (no bars). Use short <R, U, F> EG-2 algs or Anti-CLL (T6 + R2 F2 R2).",
    "algs": [
      {
        "id": "EG2-T6-1",
        "alg": "R F2 R U2 R' F2 R' U'",
        "note": "Recommended <R, U, F>",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "EG2-T6-2",
        "alg": "R' F2 R' F2 R U2 R U",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "EG2-L1",
    "name": "EG-2 L1 (L-Group)",
    "shortName": "EG2-L1",
    "group": "L-Group",
    "cllCounterpart": "L1",
    "bottomState": "diag",
    "setup": "F R' U2 R' U' R U2 F'",
    "description": "EG-2 L1: Diagonal swap on bottom (no bars). Use short <R, U, F> EG-2 algs or Anti-CLL (L1 + R2 F2 R2).",
    "algs": [
      {
        "id": "EG2-L1-1",
        "alg": "F U2 R' U R U2 R F'",
        "note": "Recommended <R, U, F>",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "EG2-L1-2",
        "alg": "F2 R F2 U' R2 U F R F",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "EG2-L2",
    "name": "EG-2 L2 (L-Group)",
    "shortName": "EG2-L2",
    "group": "L-Group",
    "cllCounterpart": "L2",
    "bottomState": "diag",
    "setup": "U' R' F U2 F U F' U2 R",
    "description": "EG-2 L2: Diagonal swap on bottom (no bars). Use short <R, U, F> EG-2 algs or Anti-CLL (L2 + R2 F2 R2).",
    "algs": [
      {
        "id": "EG2-L2-1",
        "alg": "R' U2 F U' F' U2 F' R U",
        "note": "Recommended <R, U, F>",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "EG2-L2-2",
        "alg": "R2 F2 R U R U F R' F'",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "EG2-L3",
    "name": "EG-2 L3 (L-Group)",
    "shortName": "EG2-L3",
    "group": "L-Group",
    "cllCounterpart": "L3",
    "bottomState": "diag",
    "setup": "R U2 R F2 R2 U2 F' U' F",
    "description": "EG-2 L3: Diagonal swap on bottom (no bars). Use short <R, U, F> EG-2 algs or Anti-CLL (L3 + R2 F2 R2).",
    "algs": [
      {
        "id": "EG2-L3-1",
        "alg": "F' U F U2 R2 F2 R' U2 R'",
        "note": "Recommended <R, U, F>",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "EG2-L3-2",
        "alg": "F' U F' R2 U2 R' U2 F2 R'",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "EG2-L4",
    "name": "EG-2 L4 (L-Group)",
    "shortName": "EG2-L4",
    "group": "L-Group",
    "cllCounterpart": "L4",
    "bottomState": "diag",
    "setup": "R U' R F' R' F' U R2 U' R",
    "description": "EG-2 L4: Diagonal swap on bottom (no bars). Use short <R, U, F> EG-2 algs or Anti-CLL (L4 + R2 F2 R2).",
    "algs": [
      {
        "id": "EG2-L4-1",
        "alg": "R' U R2 U' F R F R' U R'",
        "note": "Recommended <R, U, F>",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "EG2-L4-2",
        "alg": "F' U' R' U R2 U2 R F U R",
        "note": "Start AUF U' · Optimal <R, U, F>",
        "isDefault": false,
        "startAuf": "U'"
      }
    ]
  },
  {
    "id": "EG2-L5",
    "name": "EG-2 L5 (L-Group)",
    "shortName": "EG2-L5",
    "group": "L-Group",
    "cllCounterpart": "L5",
    "bottomState": "diag",
    "setup": "R2 F2 U F R' F' R' U R'",
    "description": "EG-2 L5: Diagonal swap on bottom (no bars). Use short <R, U, F> EG-2 algs or Anti-CLL (L5 + R2 F2 R2).",
    "algs": [
      {
        "id": "EG2-L5-1",
        "alg": "R U' R F R F' U' F2 R2",
        "note": "Recommended <R, U, F>",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "EG2-L5-2",
        "alg": "R U' R' U' F' U F' R2 F2",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "EG2-L6",
    "name": "EG-2 L6 (L-Group)",
    "shortName": "EG2-L6",
    "group": "L-Group",
    "cllCounterpart": "L6",
    "bottomState": "diag",
    "setup": "R' F2 U R F U' R U' F'",
    "description": "EG-2 L6: Diagonal swap on bottom (no bars). Use short <R, U, F> EG-2 algs or Anti-CLL (L6 + R2 F2 R2).",
    "algs": [
      {
        "id": "EG2-L6-1",
        "alg": "F U R' U F' R' U' F2 R",
        "note": "Recommended <R, U, F>",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "EG2-L6-2",
        "alg": "R' U R U F R' F R2 F2",
        "note": "Start AUF U' · Optimal <R, U, F>",
        "isDefault": false,
        "startAuf": "U'"
      }
    ]
  },
  {
    "id": "EG2-S1",
    "name": "EG-2 S1 (S-Group)",
    "shortName": "EG2-S1",
    "group": "S-Group",
    "cllCounterpart": "S1",
    "bottomState": "diag",
    "setup": "R2 U2 F' U' R U2 R' U R F'",
    "description": "EG-2 S1: Diagonal swap on bottom (no bars). Use short <R, U, F> EG-2 algs or Anti-CLL (S1 + R2 F2 R2).",
    "algs": [
      {
        "id": "EG2-S1-1",
        "alg": "F R' U' R U2 R' U F U2 R2",
        "note": "Recommended <R, U, F>",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "EG2-S1-2",
        "alg": "F U R' U2 R U' R' F U2 R2",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "EG2-S2",
    "name": "EG-2 S2 (S-Group)",
    "shortName": "EG2-S2",
    "group": "S-Group",
    "cllCounterpart": "S2",
    "bottomState": "diag",
    "setup": "R2 F2 R' U2 R' U' R U' R'",
    "description": "EG-2 S2: Diagonal swap on bottom (no bars). Use short <R, U, F> EG-2 algs or Anti-CLL (S2 + R2 F2 R2).",
    "algs": [
      {
        "id": "EG2-S2-1",
        "alg": "R U R' U R U2 R F2 R2",
        "note": "Recommended <R, U, F>",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "EG2-S2-2",
        "alg": "R U R2 U' R2 U R' F2 R2 U'",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "EG2-S3",
    "name": "EG-2 S3 (S-Group)",
    "shortName": "EG2-S3",
    "group": "S-Group",
    "cllCounterpart": "S3",
    "bottomState": "diag",
    "setup": "R' F R F' R2 F2 R' U R'",
    "description": "EG-2 S3: Diagonal swap on bottom (no bars). Use short <R, U, F> EG-2 algs or Anti-CLL (S3 + R2 F2 R2).",
    "algs": [
      {
        "id": "EG2-S3-1",
        "alg": "R U' R F2 R2 F R' F' R",
        "note": "Recommended <R, U, F>",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "EG2-S3-2",
        "alg": "R U' R' F R' F' R' F2 R2",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "EG2-S4",
    "name": "EG-2 S4 (S-Group)",
    "shortName": "EG2-S4",
    "group": "S-Group",
    "cllCounterpart": "S4",
    "bottomState": "diag",
    "setup": "R' U2 R F2 R F' R F'",
    "description": "EG-2 S4: Diagonal swap on bottom (no bars). Use short <R, U, F> EG-2 algs or Anti-CLL (S4 + R2 F2 R2).",
    "algs": [
      {
        "id": "EG2-S4-1",
        "alg": "F R' F R' F2 R' U2 R",
        "note": "Recommended <R, U, F>",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "EG2-S4-2",
        "alg": "U2 R U2 R' F2 R' U R' F",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "EG2-S5",
    "name": "EG-2 S5 (S-Group)",
    "shortName": "EG2-S5",
    "group": "S-Group",
    "cllCounterpart": "S5",
    "bottomState": "diag",
    "setup": "R U R' U F2 R' U R' F",
    "description": "EG-2 S5: Diagonal swap on bottom (no bars). Use short <R, U, F> EG-2 algs or Anti-CLL (S5 + R2 F2 R2).",
    "algs": [
      {
        "id": "EG2-S5-1",
        "alg": "F' R U' R F2 U' R U' R'",
        "note": "Recommended <R, U, F>",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "EG2-S5-2",
        "alg": "R' U' R U' F2 R F' R F'",
        "note": "Start AUF U2 · Optimal <R, U, F>",
        "isDefault": false,
        "startAuf": "U2"
      }
    ]
  },
  {
    "id": "EG2-S6",
    "name": "EG-2 S6 (S-Group)",
    "shortName": "EG2-S6",
    "group": "S-Group",
    "cllCounterpart": "S6",
    "bottomState": "diag",
    "setup": "F' R' F' U R U2 F' R2",
    "description": "EG-2 S6: Diagonal swap on bottom (no bars). Use short <R, U, F> EG-2 algs or Anti-CLL (S6 + R2 F2 R2).",
    "algs": [
      {
        "id": "EG2-S6-1",
        "alg": "R2 F U2 R' U' F R F",
        "note": "Recommended <R, U, F>",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "EG2-S6-2",
        "alg": "R2 F' U2 R U' R U F U2",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "EG2-A1",
    "name": "EG-2 A1 (A-Group)",
    "shortName": "EG2-A1",
    "group": "A-Group",
    "cllCounterpart": "A1",
    "bottomState": "diag",
    "setup": "R F2 U R' U' R U2 R' F2 R'",
    "description": "EG-2 A1: Diagonal swap on bottom (no bars). Use short <R, U, F> EG-2 algs or Anti-CLL (A1 + R2 F2 R2).",
    "algs": [
      {
        "id": "EG2-A1-1",
        "alg": "R F2 R U2 R' U R U' F2 R'",
        "note": "Recommended <R, U, F>",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "EG2-A1-2",
        "alg": "F R' U2 R' U R' U2 R U2 F'",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "EG2-A2",
    "name": "EG-2 A2 (A-Group)",
    "shortName": "EG2-A2",
    "group": "A-Group",
    "cllCounterpart": "A2",
    "bottomState": "diag",
    "setup": "R U R' U R U2 R F2 R2",
    "description": "EG-2 A2: Diagonal swap on bottom (no bars). Use short <R, U, F> EG-2 algs or Anti-CLL (A2 + R2 F2 R2).",
    "algs": [
      {
        "id": "EG2-A2-1",
        "alg": "R2 F2 R' U2 R' U' R U' R'",
        "note": "Recommended <R, U, F>",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "EG2-A2-2",
        "alg": "R2 F2 U R' U R' U' R2 U' R2",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "EG2-A3",
    "name": "EG-2 A3 (A-Group)",
    "shortName": "EG2-A3",
    "group": "A-Group",
    "cllCounterpart": "A3",
    "bottomState": "diag",
    "setup": "R U' R' F' R2 F2 R' U' R",
    "description": "EG-2 A3: Diagonal swap on bottom (no bars). Use short <R, U, F> EG-2 algs or Anti-CLL (A3 + R2 F2 R2).",
    "algs": [
      {
        "id": "EG2-A3-1",
        "alg": "R' U R F2 R2 F R U R'",
        "note": "Recommended <R, U, F>",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "EG2-A3-2",
        "alg": "R' U R' F2 R2 F' R U R'",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "EG2-A4",
    "name": "EG-2 A4 (A-Group)",
    "shortName": "EG2-A4",
    "group": "A-Group",
    "cllCounterpart": "A4",
    "bottomState": "diag",
    "setup": "R F2 R' U2 R' F U' F",
    "description": "EG-2 A4: Diagonal swap on bottom (no bars). Use short <R, U, F> EG-2 algs or Anti-CLL (A4 + R2 F2 R2).",
    "algs": [
      {
        "id": "EG2-A4-1",
        "alg": "F' U F' R U2 R F2 R'",
        "note": "Recommended <R, U, F>",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "EG2-A4-2",
        "alg": "U2 R' U2 R F2 R F' R F'",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "EG2-A5",
    "name": "EG-2 A5 (A-Group)",
    "shortName": "EG2-A5",
    "group": "A-Group",
    "cllCounterpart": "A5",
    "bottomState": "diag",
    "setup": "F' R' U R' U2 F R' U R'",
    "description": "EG-2 A5: Diagonal swap on bottom (no bars). Use short <R, U, F> EG-2 algs or Anti-CLL (A5 + R2 F2 R2).",
    "algs": [
      {
        "id": "EG2-A5-1",
        "alg": "R U' R F' U2 R U' R F",
        "note": "Recommended <R, U, F>",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "EG2-A5-2",
        "alg": "F R F' U R2 F' R U' R",
        "note": "Start AUF U2 · Optimal <R, U, F>",
        "isDefault": false,
        "startAuf": "U2"
      }
    ]
  },
  {
    "id": "EG2-A6",
    "name": "EG-2 A6 (A-Group)",
    "shortName": "EG2-A6",
    "group": "A-Group",
    "cllCounterpart": "A6",
    "bottomState": "diag",
    "setup": "U' F U R F' U R2 F' R2",
    "description": "EG-2 A6: Diagonal swap on bottom (no bars). Use short <R, U, F> EG-2 algs or Anti-CLL (A6 + R2 F2 R2).",
    "algs": [
      {
        "id": "EG2-A6-1",
        "alg": "R2 F R2 U' F R' U' F' U",
        "note": "Recommended <R, U, F>",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "EG2-A6-2",
        "alg": "R2 F' R2 U R' F' U' F' R",
        "note": "Ergonomic <R, U, F>",
        "isDefault": false,
        "startAuf": ""
      }
    ]
  }
];

export const eg2CaseById = new Map(eg2Cases.map(c => [c.id, c]));
