// 3x3x3 COLL (Corners of the Last Layer, All Edges Oriented) - 40 Cases
// Verified mathematically against cubing/kpuzzle 3x3x3

export const collCases = [
  {
    "id": "coll-H1",
    "shortName": "H1",
    "name": "COLL H1",
    "group": "H-Group",
    "setup": "R U2' R' U' R U R' U' R U' R'",
    "algs": [
      {
        "id": "coll-H1-default",
        "alg": "R U R' U R U' R' U R U2 R'",
        "note": "Triple Sune",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "coll-H2",
    "shortName": "H2",
    "name": "COLL H2",
    "group": "H-Group",
    "setup": "F U R U' R' U R U2' R' U' R U R' F'",
    "algs": [
      {
        "id": "coll-H2-default",
        "alg": "F R U' R' U R U2 R' U' R U R' U' F'",
        "note": "F Setup + Sune",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "coll-H3",
    "shortName": "H3",
    "name": "COLL H3",
    "group": "H-Group",
    "setup": "L' U R U' L U' R' U' R U' R'",
    "algs": [
      {
        "id": "coll-H3-default",
        "alg": "R U R' U R U L' U R' U' L",
        "note": "RUL Commutator",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "coll-H4",
    "shortName": "H4",
    "name": "COLL H4",
    "group": "H-Group",
    "setup": "F U R U' R' U R U' R' U R U' R' F'",
    "algs": [
      {
        "id": "coll-H4-default",
        "alg": "F R U R' U' R U R' U' R U R' U' F'",
        "note": "Triple Righty",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "coll-P1",
    "shortName": "P1",
    "name": "COLL P1",
    "group": "P-Group",
    "setup": "R' U2' R2' U R2' U R2' U2' R'",
    "algs": [
      {
        "id": "coll-P1-default",
        "alg": "R U2 R2 U' R2 U' R2 U2 R",
        "note": "Bruno (2-Gen Pi)",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "coll-P2",
    "shortName": "P2",
    "name": "COLL P2",
    "group": "P-Group",
    "setup": "R' U2' R2' U R U R2' D' R U' R' D U' R'",
    "algs": [
      {
        "id": "coll-P2-default",
        "alg": "R U D' R U R' D R2 U' R' U' R2 U2 R",
        "note": "RUD Diag Pi",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "coll-P3",
    "shortName": "P3",
    "name": "COLL P3",
    "group": "P-Group",
    "setup": "L' U' L U' L' U' R U' L U R'",
    "algs": [
      {
        "id": "coll-P3-default",
        "alg": "R U' L' U R' U L U L' U L",
        "note": "Niklas + Antisune",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "coll-P4",
    "shortName": "P4",
    "name": "COLL P4",
    "group": "P-Group",
    "setup": "F R U' R' U R U2' R' U' R U R' U' F'",
    "algs": [
      {
        "id": "coll-P4-default",
        "alg": "F U R U' R' U R U2 R' U' R U R' F'",
        "note": "F (Righty) Variant",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "coll-P5",
    "shortName": "P5",
    "name": "COLL P5",
    "group": "P-Group",
    "setup": "F U R U' R' U R U' R2' F' R U R U' R'",
    "algs": [
      {
        "id": "coll-P5-default",
        "alg": "R U R' U' R' F R2 U R' U' R U R' U' F'",
        "note": "Sledge + T-Setup",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "coll-P6",
    "shortName": "P6",
    "name": "COLL P6",
    "group": "P-Group",
    "setup": "R U R' U F2' R U2' R' U2' R' F2' R",
    "algs": [
      {
        "id": "coll-P6-default",
        "alg": "R' F2 R U2 R U2 R' F2 U' R U' R'",
        "note": "F2 Slash Pi",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "coll-U1",
    "shortName": "U1",
    "name": "COLL U1",
    "group": "U-Group",
    "setup": "R U2' R' U' R U' R2' U2' R U R' U R",
    "algs": [
      {
        "id": "coll-U1-default",
        "alg": "R' U' R U' R' U2 R2 U R' U R U2 R'",
        "note": "2-Gen U",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "coll-U2",
    "shortName": "U2",
    "name": "COLL U2",
    "group": "U-Group",
    "setup": "R' F R' F' R U R U' R' F R U' R' U R U R' F' R",
    "algs": [
      {
        "id": "coll-U2-default",
        "alg": "R' F R U' R' U' R U R' F' R U R' U' R' F R F' R",
        "note": "Conjugated Y-Perm",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "coll-U3",
    "shortName": "U3",
    "name": "COLL U3",
    "group": "U-Group",
    "setup": "R U2' R D R' U2' R D' R2'",
    "algs": [
      {
        "id": "coll-U3-default",
        "alg": "R2 D R' U2 R D' R' U2 R'",
        "note": "Standard U (Front Bar)",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "coll-U4",
    "shortName": "U4",
    "name": "COLL U4",
    "group": "U-Group",
    "setup": "F R U R' U' R U' R' U' R U R' F'",
    "algs": [
      {
        "id": "coll-U4-default",
        "alg": "F R U' R' U R U R' U R U' R' F'",
        "note": "Slash U",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "coll-U5",
    "shortName": "U5",
    "name": "COLL U5",
    "group": "U-Group",
    "setup": "R' U2' R' D' R U2' R' D R2'",
    "algs": [
      {
        "id": "coll-U5-default",
        "alg": "R2 D' R U2 R' D R U2 R",
        "note": "Back U (RUD)",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "coll-U6",
    "shortName": "U6",
    "name": "COLL U6",
    "group": "U-Group",
    "setup": "F U' R' U R U F' R' U2' R",
    "algs": [
      {
        "id": "coll-U6-default",
        "alg": "R' U2 R F U' R' U' R U F'",
        "note": "Diag U (F-Trigger)",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "coll-T1",
    "shortName": "T1",
    "name": "COLL T1",
    "group": "T-Group",
    "setup": "R' U' R U' R' U2' R2' U R' U R U2' R'",
    "algs": [
      {
        "id": "coll-T1-default",
        "alg": "R U2 R' U' R U' R2 U2 R U R' U R",
        "note": "2-Gen T",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "coll-T2",
    "shortName": "T2",
    "name": "COLL T2",
    "group": "T-Group",
    "setup": "L' U R' U' L R U2' R' U' R",
    "algs": [
      {
        "id": "coll-T2-default",
        "alg": "R' U R U2 R' L' U R U' L",
        "note": "RUL T",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "coll-T3",
    "shortName": "T3",
    "name": "COLL T3",
    "group": "T-Group",
    "setup": "F R' F' r U R U' r'",
    "algs": [
      {
        "id": "coll-T3-default",
        "alg": "r U R' U' r' F R F'",
        "note": "Chameleon",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "coll-T4",
    "shortName": "T4",
    "name": "COLL T4",
    "group": "T-Group",
    "setup": "F R U' R' U R U R' U R U' R' F'",
    "algs": [
      {
        "id": "coll-T4-default",
        "alg": "F R U R' U' R U' R' U' R U R' F'",
        "note": "Diag T",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "coll-T5",
    "shortName": "T5",
    "name": "COLL T5",
    "group": "T-Group",
    "setup": "R' U R2' D r' U2' r D' R2' U' R",
    "algs": [
      {
        "id": "coll-T5-default",
        "alg": "R' U R2 D r' U2 r D' R2 U' R",
        "note": "Wide RUD T",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "coll-T6",
    "shortName": "T6",
    "name": "COLL T6",
    "group": "T-Group",
    "setup": "F' r U R' U' L' U l",
    "algs": [
      {
        "id": "coll-T6-default",
        "alg": "l' U' L U R U' r' F",
        "note": "Left-Block Chameleon",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "coll-L1",
    "shortName": "L1",
    "name": "COLL L1",
    "group": "L-Group",
    "setup": "R U2' R' U' R U R' U' R U R' U' R U' R'",
    "algs": [
      {
        "id": "coll-L1-default",
        "alg": "R U R' U R U' R' U R U' R' U R U2 R'",
        "note": "Quad Sune L",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "coll-L2",
    "shortName": "L2",
    "name": "COLL L2",
    "group": "L-Group",
    "setup": "R2' D' R U2' R' D R U2' R",
    "algs": [
      {
        "id": "coll-L2-default",
        "alg": "R' U2 R' D' R U2 R' D R2",
        "note": "Standard RUD L",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "coll-L3",
    "shortName": "L3",
    "name": "COLL L3",
    "group": "L-Group",
    "setup": "R2' D R' U2' R D' R' U2' R'",
    "algs": [
      {
        "id": "coll-L3-default",
        "alg": "R U2 R D R' U2 R D' R2",
        "note": "Inverse RUD L",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "coll-L4",
    "shortName": "L4",
    "name": "COLL L4",
    "group": "L-Group",
    "setup": "r U R' U' r' F R F'",
    "algs": [
      {
        "id": "coll-L4-default",
        "alg": "F R' F' r U R U' r'",
        "note": "Wide Inverse Bowtie",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "coll-L5",
    "shortName": "L5",
    "name": "COLL L5",
    "group": "L-Group",
    "setup": "R' F' r U R U' r' F",
    "algs": [
      {
        "id": "coll-L5-default",
        "alg": "F' r U R' U' r' F R",
        "note": "Triple Sledge Bowtie",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "coll-L6",
    "shortName": "L6",
    "name": "COLL L6",
    "group": "L-Group",
    "setup": "R2' F' R U R U' R' F R U' R' U R",
    "algs": [
      {
        "id": "coll-L6-default",
        "alg": "R' U' R U R' F' R U R' U' R' F R2",
        "note": "Diag L",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "coll-S1",
    "shortName": "S1",
    "name": "COLL S1",
    "group": "S-Group",
    "setup": "R U2' R' U' R U' R'",
    "algs": [
      {
        "id": "coll-S1-default",
        "alg": "R U R' U R U2 R'",
        "note": "2-Gen Sune",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "coll-S2",
    "shortName": "S2",
    "name": "COLL S2",
    "group": "S-Group",
    "setup": "R U2' R' U2' L' U R U' R' L",
    "algs": [
      {
        "id": "coll-S2-default",
        "alg": "L' R U R' U' L U2 R U2 R'",
        "note": "RUL Sune",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "coll-S3",
    "shortName": "S3",
    "name": "COLL S3",
    "group": "S-Group",
    "setup": "F R U R' U' R' F2' R U2' R U2' R' F",
    "algs": [
      {
        "id": "coll-S3-default",
        "alg": "F' R U2 R' U2 R' F2 R U R U' R' F'",
        "note": "Diag Sune",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "coll-S4",
    "shortName": "S4",
    "name": "COLL S4",
    "group": "S-Group",
    "setup": "R2' D R' U R D' R' U R' U' R U' R'",
    "algs": [
      {
        "id": "coll-S4-default",
        "alg": "R U R' U R U' R D R' U' R D' R2",
        "note": "RUD Sune",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "coll-S5",
    "shortName": "S5",
    "name": "COLL S5",
    "group": "S-Group",
    "setup": "L' U R U' L U R'",
    "algs": [
      {
        "id": "coll-S5-default",
        "alg": "R U' L' U R' U' L",
        "note": "Niklas",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "coll-S6",
    "shortName": "S6",
    "name": "COLL S6",
    "group": "S-Group",
    "setup": "R L' U' L U R' U2' L' U2' L",
    "algs": [
      {
        "id": "coll-S6-default",
        "alg": "L' U2 L U2 R U' L' U L R'",
        "note": "Left-Right Niklas Sune",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "coll-A1",
    "shortName": "A1",
    "name": "COLL A1",
    "group": "A-Group",
    "setup": "R' U2' R U R' U R",
    "algs": [
      {
        "id": "coll-A1-default",
        "alg": "R' U' R U' R' U2 R",
        "note": "Back Antisune (2-Gen)",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "coll-A2",
    "shortName": "A2",
    "name": "COLL A2",
    "group": "A-Group",
    "setup": "F R' F' R U R U' R' F R U' R' U R U R' F' R' U2' R U R' U R",
    "algs": [
      {
        "id": "coll-A2-default",
        "alg": "R' U' R U' R' U2 R F R U' R' U' R U R' F' R U R' U' R' F R F'",
        "note": "Diag Antisune",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "coll-A3",
    "shortName": "A3",
    "name": "COLL A3",
    "group": "A-Group",
    "setup": "F R U' R' U R U R2' F' R U R U' R' U2' R' U2' R U R' U R",
    "algs": [
      {
        "id": "coll-A3-default",
        "alg": "R' U' R U' R' U2 R U2 R U R' U' R' F R2 U' R' U' R U R' F'",
        "note": "Adj Antisune",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "coll-A4",
    "shortName": "A4",
    "name": "COLL A4",
    "group": "A-Group",
    "setup": "R L' U R' U' L U2' R U2' R'",
    "algs": [
      {
        "id": "coll-A4-default",
        "alg": "R U2 R' U2 L' U R U' L R'",
        "note": "Back Bar Antisune",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "coll-A5",
    "shortName": "A5",
    "name": "COLL A5",
    "group": "A-Group",
    "setup": "R U' L' U R' U' L",
    "algs": [
      {
        "id": "coll-A5-default",
        "alg": "L' U R U' L U R'",
        "note": "Inverse Niklas",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "coll-A6",
    "shortName": "A6",
    "name": "COLL A6",
    "group": "A-Group",
    "setup": "R2' D' R U' R' D R U' R U R' U R",
    "algs": [
      {
        "id": "coll-A6-default",
        "alg": "R' U' R U' R' U R' D' R U R' D R2",
        "note": "RUD Antisune",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  }
];

export const collCaseById = new Map(collCases.map(c => [c.id, c]));
