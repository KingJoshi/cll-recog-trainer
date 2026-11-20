// 2x2x2 CLL (Corners of the Last Layer) - All 40 Cases
// Verified with cubing.js + SpeedCubeDB community alternatives

export const cllCases = [
  {
    "id": "A1",
    "name": "CLL A1 (A-Group)",
    "group": "A-Group",
    "opposite": "S1",
    "setup": "R F' U F R' U F R2 F' R'",
    "scrambles": [
      "R F' U F R' U F R2 F' R'",
      "R U R2 U' F2 R2 U' R2 F2 R'",
      "R U F2 R2 U F2 U' R2 F2 R'",
      "F U R2 U' R' F' U R' U R"
    ],
    "description": "CLL A1 ((R' U' R U' R' U2 R)). Opposite case: S1",
    "algs": [
      {
        "id": "A1-default",
        "alg": "R' U' R U' R' U2 R",
        "note": "(R' U' R U' R' U2 R)",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "A1-2",
        "alg": "R U2 R' U' R U' R'",
        "note": "Community Alt",
        "startAuf": "U"
      },
      {
        "id": "A1-3",
        "alg": "L' U' L U' L' U2 L",
        "note": "Community Alt",
        "startAuf": "U2"
      },
      {
        "id": "A1-4",
        "alg": "U2 L' U' L U' L' U2 L",
        "note": "Community Alt",
        "startAuf": ""
      }
    ]
  },
  {
    "id": "A2",
    "name": "CLL A2 (A-Group)",
    "group": "A-Group",
    "opposite": "S2",
    "setup": "R U R' U' R' F R F' R U' R' F R' F' R",
    "scrambles": [
      "F2 U' F R' U' R2 F R' U R U'",
      "R U2 F R' U2 R2 U' F U2 R U'",
      "R U2 F R U2 R2 U F U2 R U'",
      "F2 R F U2 F U2 F2 R U' F' U'"
    ],
    "description": "CLL A2 ((Sledge) (R U R') (Hedge) (*Righty)). Opposite case: S2",
    "algs": [
      {
        "id": "A2-default",
        "alg": "R' F R F' R U R' F R' F' R U R U' R'",
        "note": "(Sledge) (R U R') (Hedge) (*Righty)",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "A2-2",
        "alg": "R U2 R' F R' F' R U' R U' R'",
        "note": "Community Alt",
        "startAuf": "U"
      },
      {
        "id": "A2-3",
        "alg": "R' U R U' R2 F R F' R U R' U' R",
        "note": "Community Alt",
        "startAuf": "U'"
      },
      {
        "id": "A2-4",
        "alg": "L' U' L U' L F' L' F L' U2 L",
        "note": "Community Alt",
        "startAuf": "U"
      },
      {
        "id": "A2-5",
        "alg": "R' U' R U' R' U R' F R F' U R",
        "note": "Community Alt",
        "startAuf": ""
      }
    ]
  },
  {
    "id": "A3",
    "name": "CLL A3 (A-Group)",
    "group": "A-Group",
    "opposite": "S6",
    "setup": "R' U' R2 F' R F' R U' F2 R'",
    "scrambles": [
      "R' U' R2 F' R F' R U' F2 R'",
      "F2 R2 F' U' F R' F2 R' F2 R",
      "R2 U2 R U2 R' U2 F R' F' U2 R'",
      "F U F2 U' F' R U' F R F' R'"
    ],
    "description": "CLL A3 (U (Sledge) (R U2 R' U') (Sledge)). Opposite case: S6",
    "algs": [
      {
        "id": "A3-default",
        "alg": "U R' F R F' R U2 R' U' R' F R F'",
        "note": "U (Sledge) (R U2 R' U') (Sledge)",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "A3-2",
        "alg": "F' L F L' U2 L' U2 L",
        "note": "Community Alt",
        "startAuf": "U2"
      },
      {
        "id": "A3-3",
        "alg": "F' R U R' U2 R' F2 R",
        "note": "Community Alt",
        "startAuf": "U2"
      },
      {
        "id": "A3-4",
        "alg": "R' F R F' R U2 R' U' R' F R F'",
        "note": "Community Alt",
        "startAuf": "U"
      }
    ]
  },
  {
    "id": "A4",
    "name": "CLL A4 (A-Group)",
    "group": "A-Group",
    "opposite": "S4",
    "setup": "R' F R' F' U F' U2 F U R'",
    "scrambles": [
      "R' F R' F' U F' U2 F U R'",
      "R2 U2 R F U R' F2 U' F' R'",
      "R' U F R2 F' U F' U' F R'",
      "F' U' F' U F2 U F' R' F R"
    ],
    "description": "CLL A4 (U2 (Sledge) (R U R')). Opposite case: S4",
    "algs": [
      {
        "id": "A4-default",
        "alg": "U2 R' F R F' R U R'",
        "note": "U2 (Sledge) (R U R')",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "A4-2",
        "alg": "R' U L U' R U L'",
        "note": "Community Alt",
        "startAuf": ""
      },
      {
        "id": "A4-3",
        "alg": "R' F R F' R U R'",
        "note": "Community Alt",
        "startAuf": "U2"
      },
      {
        "id": "A4-4",
        "alg": "U2 L' U R U' L U R'",
        "note": "Community Alt",
        "startAuf": ""
      },
      {
        "id": "A4-5",
        "alg": "L' U L F' R U R'",
        "note": "Community Alt",
        "startAuf": "U2"
      }
    ]
  },
  {
    "id": "A5",
    "name": "CLL A5 (A-Group)",
    "group": "A-Group",
    "opposite": "S5",
    "setup": "R U R' U' R' F R F' R U R' U R U2' R'",
    "scrambles": [
      "R2 F' U' R2 U' F U R2 F R' U'",
      "R' F U2 R U R' U2 R' F' R2 U'",
      "R2 F' U2 F' U F R' F R U R' U'",
      "R2 U' R' U' F' U F2 R F' U R' U'"
    ],
    "description": "CLL A5 ((Anti-sune1a) (Hedge) (*Righty)). Opposite case: S5",
    "algs": [
      {
        "id": "A5-default",
        "alg": "R U2 R' U' R U' R' F R' F' R U R U' R'",
        "note": "(Anti-sune1a) (Hedge) (*Righty)",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "A5-2",
        "alg": "R U2 R' U' R U' R' F R' F' R U R U' R' U'",
        "note": "Community Alt",
        "startAuf": ""
      },
      {
        "id": "A5-3",
        "alg": "R2 F' U' R2 F' R2 U F R2",
        "note": "Community Alt",
        "startAuf": "U"
      },
      {
        "id": "A5-4",
        "alg": "R2 F R U2 R U' R' U2 F' R",
        "note": "Community Alt",
        "startAuf": "U"
      },
      {
        "id": "A5-5",
        "alg": "R U R2 F' R F R U' R2 F R",
        "note": "Community Alt",
        "startAuf": "U2"
      }
    ]
  },
  {
    "id": "A6",
    "name": "CLL A6 (A-Group)",
    "group": "A-Group",
    "opposite": "S3",
    "setup": "R' F2 U' F R' U F' R2 U' R'",
    "scrambles": [
      "R' F2 U' F R' U F' R2 U' R'",
      "R F2 R' U2 R' F U' F' R2 F2",
      "R F2 R' F U R' F U' R' F R'",
      "R F2 U R' U R' U' F R' F R'"
    ],
    "description": "CLL A6 (U2 (R U2 R') U2 (Sledge)). Opposite case: S3",
    "algs": [
      {
        "id": "A6-default",
        "alg": "U2 R U2 R' U2 R' F R F'",
        "note": "U2 (R U2 R') U2 (Sledge)",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "A6-2",
        "alg": "R U2 R' U2 R' F R F'",
        "note": "Community Alt",
        "startAuf": "U2"
      },
      {
        "id": "A6-3",
        "alg": "z F R2 F' R' U' R' U z' y' R U' R'",
        "note": "Community Alt",
        "startAuf": "U'"
      }
    ]
  },
  {
    "id": "H1",
    "name": "CLL H1 (H-Group)",
    "group": "H-Group",
    "opposite": "H1",
    "setup": "R2 U2 F' U' R' F2 R F U R'",
    "scrambles": [
      "R2 U2 F' U' R' F2 R F U R'",
      "R2 U2 R F2 U2 R U2 F2 U2 R'",
      "R2 F2 U2 R' F2 R U2 F2 U2 R'",
      "R2 U2 F' R' U' F2 U R F R'"
    ],
    "description": "CLL H1 (R2 U2 R U2 R2). Opposite case: H1",
    "algs": [
      {
        "id": "H1-default",
        "alg": "R2 U2 R U2 R2",
        "note": "R2 U2 R U2 R2",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "H1-2",
        "alg": "R2 U2 R' U2 R2",
        "note": "Community Alt",
        "startAuf": ""
      },
      {
        "id": "H1-3",
        "alg": "R U R' U R U' R' U R U2 R'",
        "note": "Community Alt",
        "startAuf": "U"
      },
      {
        "id": "H1-4",
        "alg": "R U2 R' U' R U R' U' R U' R'",
        "note": "Community Alt",
        "startAuf": ""
      }
    ]
  },
  {
    "id": "H2",
    "name": "CLL H2 (H-Group)",
    "group": "H-Group",
    "opposite": "H2",
    "setup": "F2 R F2 R2 U2 R' F2 R2 F2 R2",
    "scrambles": [
      "F2 R F2 R2 U2 R' F2 R2 F2 R2",
      "F2 R' U2 R2 F2 R F2 R2 F2 R2",
      "F2 R U2 F2 U2 F2 R2 U2 R' F2",
      "F2 U2 F2 U2 R' F2 R2 U2 R' F2"
    ],
    "description": "CLL H2 (F (Righty)3 F'). Opposite case: H2",
    "algs": [
      {
        "id": "H2-default",
        "alg": "F R U R' U' R U R' U' R U R' U' F'",
        "note": "F (Righty)3 F'",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "H2-2",
        "alg": "x' U2 R U2 R2 F2 R U2 x",
        "note": "Community Alt",
        "startAuf": ""
      },
      {
        "id": "H2-3",
        "alg": "R U' R' F R' F' R2 U' R' F R' F' R",
        "note": "Community Alt",
        "startAuf": "U"
      },
      {
        "id": "H2-4",
        "alg": "R2 F' U2 F2 R2 F' R2",
        "note": "Community Alt",
        "startAuf": "U"
      }
    ]
  },
  {
    "id": "H3",
    "name": "CLL H3 (H-Group)",
    "group": "H-Group",
    "opposite": "P3",
    "setup": "R' U R' F' R2 U2 F' R U R'",
    "scrambles": [
      "R' U R' F' R2 U2 F' R U R'",
      "R U' F2 U2 R F' U F2 U F2",
      "R U R' F2 U2 F U F2 U F2",
      "R' F R F' R2 U2 R' U2 R' U' R'"
    ],
    "description": "CLL H3 (U' (R U R' U R U R') (Hedge)). Opposite case: P3",
    "algs": [
      {
        "id": "H3-default",
        "alg": "U' R U R' U R U R' F R' F' R",
        "note": "U' (R U R' U R U R') (Hedge)",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "H3-2",
        "alg": "R U R' U R U R' F R' F' R",
        "note": "Community Alt",
        "startAuf": "U'"
      },
      {
        "id": "H3-3",
        "alg": "R' F' R U' R' F' R F' R U R'",
        "note": "Community Alt",
        "startAuf": "U"
      },
      {
        "id": "H3-4",
        "alg": "R U R' U R U L' U R' U' L",
        "note": "Community Alt",
        "startAuf": "U'"
      },
      {
        "id": "H3-5",
        "alg": "R U' R' F U2 R2 F R U' R",
        "note": "Community Alt",
        "startAuf": ""
      }
    ]
  },
  {
    "id": "H4",
    "name": "CLL H4 (H-Group)",
    "group": "H-Group",
    "opposite": "P4",
    "setup": "R2 U R' F R' F2 U' F U R'",
    "scrambles": [
      "R2 U R' F R' F2 U' F U R'",
      "F U2 R2 F' U' R' U F' U' R",
      "F R F2 R2 F' R2 F R' U2 R",
      "F R' F2 R2 F R2 F R' U2 R"
    ],
    "description": "CLL H4 (U (Sledge) (R U' R') U2 (Sledge)). Opposite case: P4",
    "algs": [
      {
        "id": "H4-default",
        "alg": "U R' F R F' R U' R' U2 R' F R F'",
        "note": "U (Sledge) (R U' R') U2 (Sledge)",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "H4-2",
        "alg": "F R2 U' R2 U' R2 U R2 F'",
        "note": "Community Alt",
        "startAuf": "U"
      },
      {
        "id": "H4-3",
        "alg": "F R U' R' U R U2 R' U' R U R' U' F'",
        "note": "Community Alt",
        "startAuf": "U"
      },
      {
        "id": "H4-4",
        "alg": "R' U2 R y R' U R' U' R U' R",
        "note": "Community Alt",
        "startAuf": ""
      },
      {
        "id": "H4-5",
        "alg": "F R U R' U' R F' R U R' U' R'",
        "note": "Community Alt",
        "startAuf": "U'"
      }
    ]
  },
  {
    "id": "L1",
    "name": "CLL L1 (L-Group)",
    "group": "L-Group",
    "opposite": "T2",
    "setup": "F U F' R F2 R' F' U' F' R'",
    "scrambles": [
      "F U F' R F2 R' F' U' F' R'",
      "F R2 F' R' U R U R' U' R",
      "F U F2 R' F' U' F' R U R",
      "F U F U' F' R' U' R2 U R"
    ],
    "description": "CLL L1 (F R U' R' U' R U R' F'). Opposite case: T2",
    "algs": [
      {
        "id": "L1-default",
        "alg": "F R U' R' U' R U R' F'",
        "note": "F R U' R' U' R U R' F'",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "L1-2",
        "alg": "F' R U R' U' R' F R",
        "note": "Community Alt",
        "startAuf": "U"
      },
      {
        "id": "L1-3",
        "alg": "R U R U' R' F R' F'",
        "note": "Community Alt",
        "startAuf": "U'"
      },
      {
        "id": "L1-4",
        "alg": "R' F R U F U' F'",
        "note": "Community Alt",
        "startAuf": ""
      }
    ]
  },
  {
    "id": "L2",
    "name": "CLL L2 (L-Group)",
    "group": "L-Group",
    "opposite": "T1",
    "setup": "R2 U R' F' U2 F U' R' U' R'",
    "scrambles": [
      "R2 U R' F' U2 F U' R' U' R'",
      "R2 U2 F R2 F' R' U2 R' U' R'",
      "F' U2 R U F2 R F' R F' R'",
      "R U' F R U R2 U' R2 F' R'"
    ],
    "description": "CLL L2 ((Hedge) (*Righty)). Opposite case: T1",
    "algs": [
      {
        "id": "L2-default",
        "alg": "F R' F' R U R U' R'",
        "note": "(Hedge) (*Righty)",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "L2-2",
        "alg": "F R' F' U' R' U R",
        "note": "Community Alt",
        "startAuf": ""
      },
      {
        "id": "L2-3",
        "alg": "F' U R U' R' F2 R U' R'",
        "note": "Community Alt",
        "startAuf": ""
      },
      {
        "id": "L2-4",
        "alg": "R' F' L' F R F' L F",
        "note": "Community Alt",
        "startAuf": "U2"
      }
    ]
  },
  {
    "id": "L3",
    "name": "CLL L3 (L-Group)",
    "group": "L-Group",
    "opposite": "L3",
    "setup": "F' R' U2 F' R' U2 R F' U' R'",
    "scrambles": [
      "F' R' U2 F' R' U2 R F' U' R'",
      "F' R' U' F R2 F' U' F2 U' R'",
      "F' U2 F R' F U2 F2 U2 R' F'",
      "R' F' U2 F' R' U2 R F' R' F'"
    ],
    "description": "CLL L3 (U R' F2 R2 U' R' F R' F2 R). Opposite case: L3",
    "algs": [
      {
        "id": "L3-default",
        "alg": "U R' F2 R2 U' R' F R' F2 R",
        "note": "U R' F2 R2 U' R' F R' F2 R",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "L3-2",
        "alg": "R U2 R2 F R F' R U2 R'",
        "note": "Community Alt",
        "startAuf": ""
      },
      {
        "id": "L3-3",
        "alg": "R U2 R' F R' F' R2 U2 R'",
        "note": "Community Alt",
        "startAuf": "U'"
      },
      {
        "id": "L3-4",
        "alg": "R U R' L' U2 R U R' U2 L",
        "note": "Community Alt",
        "startAuf": "U"
      },
      {
        "id": "L3-5",
        "alg": "R' U' R U R' F' R U R' U' R' F R2",
        "note": "Community Alt",
        "startAuf": "U2"
      }
    ]
  },
  {
    "id": "L4",
    "name": "CLL L4 (L-Group)",
    "group": "L-Group",
    "opposite": "L4",
    "setup": "R2 F U R2 U F2 U2 R2 F' U' R'",
    "scrambles": [
      "R2 F U R2 U F2 U2 R2 F' U' R'",
      "R2 F U F2 R2 U R2 U2 F U' R'",
      "R2 F U R2 U' R2 F2 U2 F U' R'",
      "R U' R U' R U2 R' U R' U R'"
    ],
    "description": "CLL L4 ((R U' R U' R) U2 (R' U R' U R')). Opposite case: L4",
    "algs": [
      {
        "id": "L4-default",
        "alg": "R U' R U' R U2 R' U R' U R'",
        "note": "(R U' R U' R) U2 (R' U R' U R')",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "L4-2",
        "alg": "R' U R' U2 R U' R' U R U' R2",
        "note": "Community Alt",
        "startAuf": "U"
      },
      {
        "id": "L4-3",
        "alg": "R2 U' R U2 R' U2 R U' R2",
        "note": "Community Alt",
        "startAuf": "U"
      },
      {
        "id": "L4-4",
        "alg": "R U R' U R U' R' U R U' R' U R U2 R'",
        "note": "Community Alt",
        "startAuf": "U2"
      }
    ]
  },
  {
    "id": "L5",
    "name": "CLL L5 (L-Group)",
    "group": "L-Group",
    "opposite": "U5",
    "setup": "F U F2 U F U2 F' R U2 R'",
    "scrambles": [
      "F U F2 U F U2 F' R U2 R'",
      "F2 U' R2 F R U F2 R' U' F",
      "R' U F' U2 F U R2 U R U' R'",
      "R' U R U2 R U F' U2 F U' R'"
    ],
    "description": "CLL L5 (U' (R U' R') (*Righty) (Hedge) (R U R')). Opposite case: U5",
    "algs": [
      {
        "id": "L5-default",
        "alg": "U' R U' R' U R U' R' F R' F' R2 U R'",
        "note": "U' (R U' R') (*Righty) (Hedge) (R U R')",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "L5-2",
        "alg": "R U2 R2 F2 R U R' F2 R F'",
        "note": "Community Alt",
        "startAuf": "U"
      },
      {
        "id": "L5-3",
        "alg": "R U' R' U R U' R' F R' F' R2 U R'",
        "note": "Community Alt",
        "startAuf": "U'"
      },
      {
        "id": "L5-4",
        "alg": "R' U2 R' U' F R2 F' U R2",
        "note": "Community Alt",
        "startAuf": "U'"
      },
      {
        "id": "L5-5",
        "alg": "R' F2 R2 U2 R' U R' F2 R F'",
        "note": "Community Alt",
        "startAuf": "U"
      }
    ]
  },
  {
    "id": "L6",
    "name": "CLL L6 (L-Group)",
    "group": "L-Group",
    "opposite": "U6",
    "setup": "R2 U2 R U' R U' F' U' F R'",
    "scrambles": [
      "R2 U2 R U' R U' F' U' F R'",
      "R U' F U F2 U F R2 U' F",
      "R2 U2 R F U2 R F' R U2 F",
      "R' U R' F R F' R U2 R' U R"
    ],
    "description": "CLL L6 ((R' U' R) U2 R' (Hedge) U' R). Opposite case: U6",
    "algs": [
      {
        "id": "L6-default",
        "alg": "R' U' R U2 R' F R' F' R U' R",
        "note": "(R' U' R) U2 R' (Hedge) U' R",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "L6-2",
        "alg": "R U2 R' F' R U2 R' U R' F2 R",
        "note": "Community Alt",
        "startAuf": ""
      },
      {
        "id": "L6-3",
        "alg": "R' F' R U R' U' R' F R2 U' R' U2 R",
        "note": "Community Alt",
        "startAuf": "U'"
      },
      {
        "id": "L6-4",
        "alg": "U' R U R' U R' F R F' U2 R' F R F'",
        "note": "Community Alt",
        "startAuf": "U'"
      }
    ]
  },
  {
    "id": "P1",
    "name": "CLL P1 (P-Group)",
    "group": "P-Group",
    "opposite": "P1",
    "setup": "F2 R2 F R2 F2 R' U' R2 U2 R'",
    "scrambles": [
      "F2 R2 F R2 F2 R' U' R2 U2 R'",
      "F2 R2 F' R2 F2 R U' R2 U2 R'",
      "F2 R2 F R2 F2 R' U R2 U2 R",
      "F2 R2 F' R2 F2 R U R2 U2 R"
    ],
    "description": "CLL P1 (F (Righty)2 F'). Opposite case: P1",
    "algs": [
      {
        "id": "P1-default",
        "alg": "F R U R' U' R U R' U' F'",
        "note": "F (Righty)2 F'",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "P1-2",
        "alg": "R U' R2 U R2 U R2 U' R",
        "note": "Community Alt",
        "startAuf": ""
      },
      {
        "id": "P1-3",
        "alg": "R' U R2 U' R2 U' R2 U R'",
        "note": "Community Alt",
        "startAuf": ""
      },
      {
        "id": "P1-4",
        "alg": "R U2 R2 U' R2 U' R2 U2 R",
        "note": "Community Alt",
        "startAuf": ""
      }
    ]
  },
  {
    "id": "P2",
    "name": "CLL P2 (P-Group)",
    "group": "P-Group",
    "opposite": "P2",
    "setup": "F2 R2 U' F2 R U2 R F2 U' R2",
    "scrambles": [
      "F2 R2 U' F2 R U2 R F2 U' R2",
      "R2 U' F2 R U2 F2 R F2 U' R2",
      "R2 U F2 R' F2 U2 R' F2 U R2",
      "F2 R2 U F2 R' F2 R' F2 U R2"
    ],
    "description": "CLL P2 ((R U' R') U2 (Sledge) U2 (R U R')). Opposite case: P2",
    "algs": [
      {
        "id": "P2-default",
        "alg": "R U' R' U2 R' F R F' U2 R U R'",
        "note": "(R U' R') U2 (Sledge) U2 (R U R')",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "P2-2",
        "alg": "R' U' R' F R F' R U' R' U2 R",
        "note": "Community Alt",
        "startAuf": "U'"
      },
      {
        "id": "P2-3",
        "alg": "R2 U R' U' F R F' R U' R2",
        "note": "Community Alt",
        "startAuf": ""
      },
      {
        "id": "P2-4",
        "alg": "U' R' U' R' F R F' R U' R' U2 R",
        "note": "Community Alt",
        "startAuf": ""
      },
      {
        "id": "P2-5",
        "alg": "R U R' U R' F R F' R U' R' U R U2 R'",
        "note": "Community Alt",
        "startAuf": "U'"
      }
    ]
  },
  {
    "id": "P3",
    "name": "CLL P3 (P-Group)",
    "group": "P-Group",
    "opposite": "H3",
    "setup": "R U2 R2 F2 U' F U F' R F'",
    "scrambles": [
      "R U2 R2 F2 U' F U F' R F'",
      "R' F2 U2 R2 U F U F' R F'",
      "R F2 U2 R2 U' R' U' F U' F",
      "R' U2 R2 F2 U R' U' F U' F"
    ],
    "description": "CLL P3 (U2 (Sledge) R U' R' U' R U' R'). Opposite case: H3",
    "algs": [
      {
        "id": "P3-default",
        "alg": "U2 R' F R F' R U' R' U' R U' R'",
        "note": "U2 (Sledge) R U' R' U' R U' R'",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "P3-2",
        "alg": "R' F R F' R U' R' U' R U' R'",
        "note": "Community Alt",
        "startAuf": "U2"
      },
      {
        "id": "P3-3",
        "alg": "R U' R' F R' F R U R' F R",
        "note": "Community Alt",
        "startAuf": ""
      },
      {
        "id": "P3-4",
        "alg": "R U' R' F L' U L U L' U L",
        "note": "Community Alt",
        "startAuf": ""
      },
      {
        "id": "P3-5",
        "alg": "R U' R2 D' R U R' D R2 U R'",
        "note": "Community Alt",
        "startAuf": "U'"
      }
    ]
  },
  {
    "id": "P4",
    "name": "CLL P4 (P-Group)",
    "group": "P-Group",
    "opposite": "H4",
    "setup": "F U' R' U F' U' R' F2 U2 R",
    "scrambles": [
      "F U' R' U F' U' R' F2 U2 R",
      "F U2 F' R F2 R F2 R2 F' R",
      "F U2 F' R F2 R' F2 R2 F R",
      "F' U R U' R2 F' R F' U F2"
    ],
    "description": "CLL P4 (U (Hedge) U2 (R U R') (Hedge)). Opposite case: H4",
    "algs": [
      {
        "id": "P4-default",
        "alg": "U F R' F' R U2 R U R' F R' F' R",
        "note": "U (Hedge) U2 (R U R') (Hedge)",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "P4-2",
        "alg": "F R2 U' R2 U R2 U R2 F'",
        "note": "Community Alt",
        "startAuf": "U"
      },
      {
        "id": "P4-3",
        "alg": "R U' R U' R' U R' F R2 F'",
        "note": "Community Alt",
        "startAuf": "U'"
      },
      {
        "id": "P4-4",
        "alg": "F R' F' R U2 F R' F' R2 U2 R'",
        "note": "Community Alt",
        "startAuf": "U2"
      },
      {
        "id": "P4-5",
        "alg": "U' R' F R U F U' R U R' U' F'",
        "note": "Community Alt",
        "startAuf": ""
      }
    ]
  },
  {
    "id": "P5",
    "name": "CLL P5 (P-Group)",
    "group": "P-Group",
    "opposite": "P6",
    "setup": "F R' U' F2 U F' U2 R F2 R'",
    "scrambles": [
      "F R' U' F2 U F' U2 R F2 R'",
      "R' U2 R F2 U' F R2 F' R' F",
      "R' F' U2 F' R F' R' F2 R U' R'",
      "F2 R F R2 U R' F R2 F2 U' R'"
    ],
    "description": "CLL P5 ((R U2 R' U') (R U R') U2 (Sledge)). Opposite case: P6",
    "algs": [
      {
        "id": "P5-default",
        "alg": "R U2 R' U' R U R' U2 R' F R F'",
        "note": "(R U2 R' U') (R U R') U2 (Sledge)",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "P5-2",
        "alg": "F' R U R' U2 R' F R U' R' F2 R",
        "note": "Community Alt",
        "startAuf": "U"
      },
      {
        "id": "P5-3",
        "alg": "R U R' U' R' F R2 U R' U' R U R' U' F'",
        "note": "Community Alt",
        "startAuf": ""
      },
      {
        "id": "P5-4",
        "alg": "R2 U' R' U' F R2 U2 F' R2 F",
        "note": "Community Alt",
        "startAuf": ""
      }
    ]
  },
  {
    "id": "P6",
    "name": "CLL P6 (P-Group)",
    "group": "P-Group",
    "opposite": "P5",
    "setup": "R U' F2 R U F' R U' F2 U' R'",
    "scrambles": [
      "R U' F2 R U F' R U' F2 U' R'",
      "R2 F' U R F2 R F2 R' U2 F R'",
      "R' U' F2 U' F R' F R F2 U' R",
      "R2 U2 F' R F U' R U F' U2 R2"
    ],
    "description": "CLL P6 (U (Hedge) U2 (R U' R') (U R U2 R')). Opposite case: P5",
    "algs": [
      {
        "id": "P6-default",
        "alg": "U F R' F' R U2 R U' R' U R U2 R'",
        "note": "U (Hedge) U2 (R U' R') (U R U2 R')",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "P6-2",
        "alg": "F R' F' R U2 R U' R' U R U2 R'",
        "note": "Community Alt",
        "startAuf": "U"
      },
      {
        "id": "P6-3",
        "alg": "R' F2 R F' U2 R U' R' U' F",
        "note": "Community Alt",
        "startAuf": ""
      },
      {
        "id": "P6-4",
        "alg": "U F U R U' R' U R U' R2 F' R U R U' R'",
        "note": "Community Alt",
        "startAuf": ""
      },
      {
        "id": "P6-5",
        "alg": "L' U2 L U L' U' L U2 L F' L' F",
        "note": "Community Alt",
        "startAuf": "U2"
      }
    ]
  },
  {
    "id": "S1",
    "name": "CLL S1 (S-Group)",
    "group": "S-Group",
    "opposite": "A1",
    "setup": "F' R' F2 R U F U' R U' R'",
    "scrambles": [
      "F' R' F2 R U F U' R U' R'",
      "R' F R U F2 U' F' R U' R'",
      "R F2 R2 U R2 F2 U R2 U' R'",
      "R F2 R2 U F2 U' R2 F2 U' R'"
    ],
    "description": "CLL S1 ((R U R' U R U2 R')). Opposite case: A1",
    "algs": [
      {
        "id": "S1-default",
        "alg": "R U R' U R U2 R'",
        "note": "(R U R' U R U2 R')",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "S1-2",
        "alg": "R U R2 U' R2 U R",
        "note": "Community Alt",
        "startAuf": ""
      },
      {
        "id": "S1-3",
        "alg": "R' U2 R U R' U R",
        "note": "Community Alt",
        "startAuf": "U'"
      },
      {
        "id": "S1-4",
        "alg": "L' U2 L U L' U L",
        "note": "Community Alt",
        "startAuf": "U"
      }
    ]
  },
  {
    "id": "S2",
    "name": "CLL S2 (S-Group)",
    "group": "S-Group",
    "opposite": "A2",
    "setup": "R2 U' R' F2 U F R U2 F' R",
    "scrambles": [
      "R2 U' R' F2 U F R U2 F' R",
      "F U' R2 F R U F2 R' U' F2",
      "F2 R2 U2 R' U R F' R2 F U' R'",
      "F' R2 U F' U' R' F U' R' U2 R'"
    ],
    "description": "CLL S2 ((Righty) (Sledge) (R U' R') (Hedge)). Opposite case: A2",
    "algs": [
      {
        "id": "S2-default",
        "alg": "R U R' U' R' F R F' R U' R' F R' F' R",
        "note": "(Righty) (Sledge) (R U' R') (Hedge)",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "S2-2",
        "alg": "R U R' U R' F R F' R U2 R'",
        "note": "Community Alt",
        "startAuf": "U2"
      },
      {
        "id": "S2-3",
        "alg": "U2 R U R' U R' F R F' R U2 R'",
        "note": "Community Alt",
        "startAuf": ""
      },
      {
        "id": "S2-4",
        "alg": "R' F R2 F' U' R' U' R2 U R'",
        "note": "Community Alt",
        "startAuf": "U'"
      }
    ]
  },
  {
    "id": "S3",
    "name": "CLL S3 (S-Group)",
    "group": "S-Group",
    "opposite": "A6",
    "setup": "R F' U2 R' U' F2 R U' F R",
    "scrambles": [
      "R F' U2 R' U' F2 R U' F R",
      "R2 F2 R U2 R F2 R F' R F'",
      "R' U2 R2 U2 R U2 R' F R F'",
      "R F2 U2 R U2 F2 R' F R F'"
    ],
    "description": "CLL S3 ((Hedge) U2 (R U2 R')). Opposite case: A6",
    "algs": [
      {
        "id": "S3-default",
        "alg": "F R' F' R U2 R U2 R'",
        "note": "(Hedge) U2 (R U2 R')",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "S3-2",
        "alg": "y2 x' U R' F' R F2 R U2 R'",
        "note": "Community Alt",
        "startAuf": ""
      },
      {
        "id": "S3-3",
        "alg": "R U' R' F R' F2 R U R U' R' F",
        "note": "Community Alt",
        "startAuf": "U"
      },
      {
        "id": "S3-4",
        "alg": "x' R U' R' U R' F2 R F R U' R' U x",
        "note": "Community Alt",
        "startAuf": "U'"
      }
    ]
  },
  {
    "id": "S4",
    "name": "CLL S4 (S-Group)",
    "group": "S-Group",
    "opposite": "A4",
    "setup": "R' U' F2 U' F' R' U F' U' R'",
    "scrambles": [
      "R' U' F2 U' F' R' U F' U' R'",
      "R2 U' F' R' F2 R' U2 F' U' R'",
      "R' U2 R' F' U' R2 U2 F' U' R'",
      "R U' F' U F R2 U R U R'"
    ],
    "description": "CLL S4 (R U' R' (Hedge)). Opposite case: A4",
    "algs": [
      {
        "id": "S4-default",
        "alg": "R U' R' F R' F' R",
        "note": "R U' R' (Hedge)",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "S4-2",
        "alg": "R U' R' F L' U' L",
        "note": "Community Alt",
        "startAuf": ""
      },
      {
        "id": "S4-3",
        "alg": "L F' L' F L' U' L",
        "note": "Community Alt",
        "startAuf": ""
      },
      {
        "id": "S4-4",
        "alg": "R U' L' U R' U' L",
        "note": "Community Alt",
        "startAuf": ""
      }
    ]
  },
  {
    "id": "S5",
    "name": "CLL S5 (S-Group)",
    "group": "S-Group",
    "opposite": "A5",
    "setup": "F2 R' U F' U' R2 F R U R'",
    "scrambles": [
      "F2 R' U F' U' R2 F R U R'",
      "F' R F2 R' U F U' F2 U R'",
      "F' R U R F2 U' F' U F' R2",
      "F2 R2 F R' F' U R U2 F' R2"
    ],
    "description": "CLL S5 ((Righty) (Sledge) (Sune1a)). Opposite case: A5",
    "algs": [
      {
        "id": "S5-default",
        "alg": "R U R' U' R' F R F' R U R' U R U2 R'",
        "note": "(Righty) (Sledge) (Sune1a)",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "S5-2",
        "alg": "R U2 R' F R U2 R' U R U' R' F",
        "note": "Community Alt",
        "startAuf": ""
      },
      {
        "id": "S5-3",
        "alg": "R U' R U' R' U R' U' y R U' R'",
        "note": "Community Alt",
        "startAuf": "U2"
      },
      {
        "id": "S5-4",
        "alg": "R2 F' U' R2 F R2 U F R2",
        "note": "Community Alt",
        "startAuf": ""
      }
    ]
  },
  {
    "id": "S6",
    "name": "CLL S6 (S-Group)",
    "group": "S-Group",
    "opposite": "A3",
    "setup": "F2 R F' R' F2 R U' R' U2 R'",
    "scrambles": [
      "F2 R F' R' F2 R U' R' U2 R'",
      "F2 U' R F' R' F' U F2 U2 R'",
      "F2 U' R U' R F' R' U' F R'",
      "F2 U' R U2 F' U' R' U F2 R'"
    ],
    "description": "CLL S6 ((Hedge) (U R U2 R') (Hedge)). Opposite case: A3",
    "algs": [
      {
        "id": "S6-default",
        "alg": "F R' F' R U R U2 R' F R' F' R",
        "note": "(Hedge) (U R U2 R') (Hedge)",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "S6-2",
        "alg": "L' U2 L U2 L F' L' F",
        "note": "Community Alt",
        "startAuf": ""
      },
      {
        "id": "S6-3",
        "alg": "R' U2 R U2 R B' R' B",
        "note": "Community Alt",
        "startAuf": "U2"
      },
      {
        "id": "S6-4",
        "alg": "R' F2 R U2 R U' R' F",
        "note": "Community Alt",
        "startAuf": ""
      },
      {
        "id": "S6-5",
        "alg": "R' F2 R U2 L F' L' F",
        "note": "Community Alt",
        "startAuf": ""
      }
    ]
  },
  {
    "id": "T1",
    "name": "CLL T1 (T-Group)",
    "group": "T-Group",
    "opposite": "L2",
    "setup": "R F R2 F' U' R' U2 R U R'",
    "scrambles": [
      "R F R2 F' U' R' U2 R U R'",
      "R F R2 U R2 U' R' F' U R'",
      "F' U' R2 F' U2 R2 F' R' U2 R'",
      "F R U F2 R F' U' F' U2 R'"
    ],
    "description": "CLL T1 ((Righty) (Sledge)). Opposite case: L2",
    "algs": [
      {
        "id": "T1-default",
        "alg": "R U R' U' R' F R F'",
        "note": "(Righty) (Sledge)",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "T1-2",
        "alg": "R' U' R U F R F'",
        "note": "Community Alt",
        "startAuf": "U'"
      },
      {
        "id": "T1-3",
        "alg": "U' x L U R' U' L' U R U' x'",
        "note": "Community Alt",
        "startAuf": "U"
      },
      {
        "id": "T1-4",
        "alg": "R B R' U' R' U R F' z",
        "note": "Community Alt",
        "startAuf": "U2"
      }
    ]
  },
  {
    "id": "T2",
    "name": "CLL T2 (T-Group)",
    "group": "T-Group",
    "opposite": "L1",
    "setup": "F R' U F R' F U R2 F R'",
    "scrambles": [
      "F R' U F R' F U R2 F R'",
      "R' U' F' U2 F R U' R' U' R",
      "F R2 F U2 F2 U2 F2 R' U' R",
      "F R2 F' R2 U2 R2 U2 R U' R"
    ],
    "description": "CLL T2 (U2 (R' F' R) (*Righty) F). Opposite case: L1",
    "algs": [
      {
        "id": "T2-default",
        "alg": "U2 R' F' R U R U' R' F",
        "note": "U2 (R' F' R) (*Righty) F",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "T2-2",
        "alg": "L' U' L U L F' L' F",
        "note": "Community Alt",
        "startAuf": "U2"
      },
      {
        "id": "T2-3",
        "alg": "R' F' R U R U' R' F",
        "note": "Community Alt",
        "startAuf": "U2"
      },
      {
        "id": "T2-4",
        "alg": "R U R' U' y L' U' L",
        "note": "Community Alt",
        "startAuf": "U"
      },
      {
        "id": "T2-5",
        "alg": "F R U' R' U R U R' F'",
        "note": "Community Alt",
        "startAuf": ""
      }
    ]
  },
  {
    "id": "T3",
    "name": "CLL T3 (T-Group)",
    "group": "T-Group",
    "opposite": "T3",
    "setup": "F R' F' R2 U F R2 F' U R'",
    "scrambles": [
      "F R' F' R2 U F R2 F' U R'",
      "F' U F R2 U' F' U2 F U' R",
      "F U R F' R F' U' F' U2 R2",
      "F' R' F' U F' U R F U2 R2"
    ],
    "description": "CLL T3 (R2 U2 R' U2 (Sledge) U' R'). Opposite case: T3",
    "algs": [
      {
        "id": "T3-default",
        "alg": "R2 U2 R' U2 R' F R F' U' R'",
        "note": "R2 U2 R' U2 (Sledge) U' R'",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "T3-2",
        "alg": "F U' R U2 R' U' F2 R U R'",
        "note": "Community Alt",
        "startAuf": "U"
      },
      {
        "id": "T3-3",
        "alg": "R U2 R2 F R F' R U' R' U R U2 R'",
        "note": "Community Alt",
        "startAuf": "U2"
      },
      {
        "id": "T3-4",
        "alg": "R U F R' F' R U2 R U2 R2",
        "note": "Community Alt",
        "startAuf": "U'"
      },
      {
        "id": "T3-5",
        "alg": "R U' B U2 B' U' R2 F R F'",
        "note": "Community Alt",
        "startAuf": ""
      }
    ]
  },
  {
    "id": "T4",
    "name": "CLL T4 (T-Group)",
    "group": "T-Group",
    "opposite": "U2",
    "setup": "R U R2 F2 U' F' U F' R F'",
    "scrambles": [
      "R U R2 F2 U' F' U F' R F'",
      "R' U' R2 F2 U R U' F U' F",
      "R U R' F U' R U' R' U2 F2",
      "R' U' R F' R F' U R U2 F2"
    ],
    "description": "CLL T4 ((*Righty)2 (Hedge)2). Opposite case: U2",
    "algs": [
      {
        "id": "T4-default",
        "alg": "U R U' R' U R U' R' F R' F' R F R' F' R",
        "note": "(*Righty)2 (Hedge)2",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "T4-2",
        "alg": "R' U R U2 R2 F' R U' R' F2 R2",
        "note": "Community Alt",
        "startAuf": "U"
      },
      {
        "id": "T4-3",
        "alg": "R' U R' F U' R U F2 R2",
        "note": "Community Alt",
        "startAuf": "U2"
      },
      {
        "id": "T4-4",
        "alg": "R' U R' U2 R U2 R' U R2 U' R'",
        "note": "Community Alt",
        "startAuf": "U'"
      }
    ]
  },
  {
    "id": "T5",
    "name": "CLL T5 (T-Group)",
    "group": "T-Group",
    "opposite": "U4",
    "setup": "F R' F2 R F' U' F2 R U2 R'",
    "scrambles": [
      "F R' F2 R F' U' F2 R U2 R'",
      "F2 U' F' U F' R' F' R2 U2 R'",
      "F2 U R U' F U' R2 U2 F' R'",
      "F' U F2 U' R U F2 R' U2 R"
    ],
    "description": "CLL T5 (U2 (R U R') U2 (R U R') U (Sledge)). Opposite case: U4",
    "algs": [
      {
        "id": "T5-default",
        "alg": "U2 R U R' U2 R U R' U R' F R F'",
        "note": "U2 (R U R') U2 (R U R') U (Sledge)",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "T5-2",
        "alg": "F R U R' U' R U' R' U' R U R' F'",
        "note": "Community Alt",
        "startAuf": "U'"
      },
      {
        "id": "T5-3",
        "alg": "R U R' U' R U' R' F' U' F R U R'",
        "note": "Community Alt",
        "startAuf": ""
      },
      {
        "id": "T5-4",
        "alg": "R U R' U2 R U R' U R' F R F'",
        "note": "Community Alt",
        "startAuf": "U2"
      },
      {
        "id": "T5-5",
        "alg": "R2 F' R U' R' F2 R F R' F' R2",
        "note": "Community Alt",
        "startAuf": "U2"
      }
    ]
  },
  {
    "id": "T6",
    "name": "CLL T6 (T-Group)",
    "group": "T-Group",
    "opposite": "T6",
    "setup": "F R2 F' U' F2 U' R' U F' R'",
    "scrambles": [
      "F R2 F' U' F2 U' R' U F' R'",
      "F' U' F R' U' R2 U' R' U2 R",
      "F2 R' F2 R' U R2 U2 R' F U2 R'",
      "F2 R' F2 R' U' R2 U2 R F U2 R'"
    ],
    "description": "CLL T6 (U' (R U' R') U' (Hedge) (R U' R')). Opposite case: T6",
    "algs": [
      {
        "id": "T6-default",
        "alg": "U' R U' R' U' F R' F' R2 U' R'",
        "note": "U' (R U' R') U' (Hedge) (R U' R')",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "T6-2",
        "alg": "R' U R U2 R2 F R F' R",
        "note": "Community Alt",
        "startAuf": "U"
      },
      {
        "id": "T6-3",
        "alg": "U2 y z R U R' U' R' F R2 U' R' U' R U R' F'",
        "note": "Community Alt",
        "startAuf": "U"
      },
      {
        "id": "T6-4",
        "alg": "R U' R' U2 L2 F' L' U L'",
        "note": "Community Alt",
        "startAuf": "U'"
      },
      {
        "id": "T6-5",
        "alg": "R' F R U2 R2 F R U' R",
        "note": "Community Alt",
        "startAuf": "U'"
      }
    ]
  },
  {
    "id": "U1",
    "name": "CLL U1 (U-Group)",
    "group": "U-Group",
    "opposite": "U1",
    "setup": "R U2 R' U' F' U2 F R U' R'",
    "scrambles": [
      "R U2 R' U' F' U2 F R U' R'",
      "F' U' R' F2 R U2 F R U' R'",
      "R U R' F' U2 F U R U2 R'",
      "R' U2 F' U2 F R2 U2 R2 U2 R'"
    ],
    "description": "CLL U1 (F (Righty) F'). Opposite case: U1",
    "algs": [
      {
        "id": "U1-default",
        "alg": "F R U R' U' F'",
        "note": "F (Righty) F'",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "U1-2",
        "alg": "F U R U' R' F'",
        "note": "Community Alt",
        "startAuf": "U2"
      },
      {
        "id": "U1-3",
        "alg": "R' F' U' F U R",
        "note": "Community Alt",
        "startAuf": "U"
      },
      {
        "id": "U1-4",
        "alg": "R' U' F R' F' R U R",
        "note": "Community Alt",
        "startAuf": ""
      }
    ]
  },
  {
    "id": "U2",
    "name": "CLL U2 (U-Group)",
    "group": "U-Group",
    "opposite": "T4",
    "setup": "F2 U2 R U R' U F' R U' R'",
    "scrambles": [
      "F2 U2 R U R' U F' R U' R'",
      "F R' F U' F U F2 R2 U' R'",
      "F2 U2 R' U' F R' F R' U R",
      "F' U F' U R' U' F2 R2 U R"
    ],
    "description": "CLL U2 ((Sledge)2 (Righty)2). Opposite case: T4",
    "algs": [
      {
        "id": "U2-default",
        "alg": "R' F R F' R' F R F' R U R' U' R U R' U'",
        "note": "(Sledge)2 (Righty)2",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "U2-2",
        "alg": "R' U' R2 U R' U2 R U2 R' U R'",
        "note": "Community Alt",
        "startAuf": "U"
      },
      {
        "id": "U2-3",
        "alg": "R2 F2 R U R' F R2 U2 R' U' R",
        "note": "Community Alt",
        "startAuf": ""
      },
      {
        "id": "U2-4",
        "alg": "R' F U' R U' R' U2 F2 R",
        "note": "Community Alt",
        "startAuf": "U"
      },
      {
        "id": "U2-5",
        "alg": "R2 F2 R U R' F U' R U R2",
        "note": "Community Alt",
        "startAuf": "U'"
      }
    ]
  },
  {
    "id": "U3",
    "name": "CLL U3 (U-Group)",
    "group": "U-Group",
    "opposite": "U3",
    "setup": "F R2 U R' F U F' U2 F' U' R'",
    "scrambles": [
      "F R2 U R' F U F' U2 F' U' R'",
      "F R F' R U2 F R' F' R' U2 R'",
      "F R2 U R' U' F' U2 F' U F R'",
      "F R F' U2 F' R' F' R U2 F R'"
    ],
    "description": "CLL U3 (F R U' R' (Sledge) R U2 R' F'). Opposite case: U3",
    "algs": [
      {
        "id": "U3-default",
        "alg": "F R U' R2 F R F' R U2 R' F'",
        "note": "F R U' R' (Sledge) R U2 R' F'",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "U3-2",
        "alg": "F R U R' U2 F' R U' R' F",
        "note": "Community Alt",
        "startAuf": "U'"
      },
      {
        "id": "U3-3",
        "alg": "R' F R U' R' U' R U R' F' R U R' U' R' F R F' R",
        "note": "Community Alt",
        "startAuf": "U"
      },
      {
        "id": "U3-4",
        "alg": "R U2 R U' R' F R' F2 U' F",
        "note": "Community Alt",
        "startAuf": ""
      },
      {
        "id": "U3-5",
        "alg": "z' U2 R' U' R2 U' R' U' R U' R' U' x2",
        "note": "Community Alt",
        "startAuf": ""
      }
    ]
  },
  {
    "id": "U4",
    "name": "CLL U4 (U-Group)",
    "group": "U-Group",
    "opposite": "T5",
    "setup": "R U' F' R2 F R2 F2 R' F' R'",
    "scrambles": [
      "R U' F' R2 F R2 F2 R' F' R'",
      "R U R' U2 R U R' U R' F R F'",
      "R' U F U2 F U2 F2 U' F R",
      "R' U F U2 F' U2 F2 U F R"
    ],
    "description": "CLL U4 ((Hedge) U' R U' R' U2 R U' R'). Opposite case: T5",
    "algs": [
      {
        "id": "U4-default",
        "alg": "F R' F' R U' R U' R' U2 R U' R'",
        "note": "(Hedge) U' R U' R' U2 R U' R'",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "U4-2",
        "alg": "F R U' R' U R U R' U R U' R' F'",
        "note": "Community Alt",
        "startAuf": "U"
      },
      {
        "id": "U4-3",
        "alg": "F' R U R' U' R' F R2 U R' U R U2 R'",
        "note": "Community Alt",
        "startAuf": "U2"
      },
      {
        "id": "U4-4",
        "alg": "R2 F R F' R' F2 R U R' F R2",
        "note": "Community Alt",
        "startAuf": "U"
      }
    ]
  },
  {
    "id": "U5",
    "name": "CLL U5 (U-Group)",
    "group": "U-Group",
    "opposite": "L5",
    "setup": "F R2 F' R U2 R' U' R2 U' R'",
    "scrambles": [
      "F R2 F' R U2 R' U' R2 U' R'",
      "R' U F U2 R' U' R' F2 U R2",
      "R' U' F' U2 F U' R2 U R' U' R'",
      "F R2 F' U' R' U' R2 U R' U' R'"
    ],
    "description": "CLL U5 ((*Righty) (Sledge) (Righty)2). Opposite case: L5",
    "algs": [
      {
        "id": "U5-default",
        "alg": "U R U' R2 F R F' R U R' U' R U R'",
        "note": "(*Righty) (Sledge) (Righty)2",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "U5-2",
        "alg": "R U' R2 F R F' R U R' U' R U R'",
        "note": "Community Alt",
        "startAuf": "U"
      },
      {
        "id": "U5-3",
        "alg": "R U2 R' U R' F2 R F' R' F2 R",
        "note": "Community Alt",
        "startAuf": "U'"
      },
      {
        "id": "U5-4",
        "alg": "R2 D' R U2 R' D R U2 R",
        "note": "Community Alt",
        "startAuf": "U"
      },
      {
        "id": "U5-5",
        "alg": "R2 U R2 F' R U R U' R' F R U' R2",
        "note": "Community Alt",
        "startAuf": "U'"
      }
    ]
  },
  {
    "id": "U6",
    "name": "CLL U6 (U-Group)",
    "group": "U-Group",
    "opposite": "L6",
    "setup": "F' U2 F R' U2 R U R2 U R",
    "scrambles": [
      "F' U2 F R' U2 R U R2 U R",
      "R U' F' R2 U F R F2 U' R2",
      "F' R2 F R' U' F2 U R' U F R'",
      "R' U' R U2 R' F R' F' R U' R U'"
    ],
    "description": "CLL U6 (U (R' U) (Sledge) (R U2 R') U R). Opposite case: L6",
    "algs": [
      {
        "id": "U6-default",
        "alg": "U R' U R' F R F' R U2 R' U R",
        "note": "U (R' U) (Sledge) (R U2 R') U R",
        "isDefault": true,
        "startAuf": ""
      },
      {
        "id": "U6-2",
        "alg": "R' U R' F R F' R U2 R' U R",
        "note": "Community Alt",
        "startAuf": "U"
      },
      {
        "id": "U6-3",
        "alg": "L' U L2 F' L' F L' U' L U L' U' L",
        "note": "Community Alt",
        "startAuf": "U"
      },
      {
        "id": "U6-4",
        "alg": "R' F R2 U' R' F R' F' R U R' F' R",
        "note": "Community Alt",
        "startAuf": "U"
      },
      {
        "id": "U6-5",
        "alg": "R' U' R2 U' R' U2 R B' R2 F z'",
        "note": "Community Alt",
        "startAuf": ""
      }
    ]
  }
];

export const cllCaseById = new Map(cllCases.map(c => [c.id, c]));
