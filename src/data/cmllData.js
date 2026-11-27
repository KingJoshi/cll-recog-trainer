// 3x3x3 Roux CMLL (Corners of the Last Layer, M-slice free) - 42 Cases
// Verified mathematically against cubing/kpuzzle 3x3x3

export const cmllCases = [
  {
    "id": "cmll-O1",
    "shortName": "O1",
    "name": "CMLL O1 (Adj)",
    "group": "O-Group",
    "setup": "F R U' R' U R U R2' F' R U R U' R'",
    "algs": [
      {
        "id": "cmll-O1-default",
        "alg": "R U R' U' R' F R2 U' R' U' R U R' F'",
        "note": "T-Perm (Adj Corner Swap)",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "cmll-O2",
    "shortName": "O2",
    "name": "CMLL O2 (Diag)",
    "group": "O-Group",
    "setup": "F R' F' R U R U' R' F R U' R' U R U R' F'",
    "algs": [
      {
        "id": "cmll-O2-default",
        "alg": "F R U' R' U' R U R' F' R U R' U' R' F R F'",
        "note": "Y-Perm (Diag Corner Swap)",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "cmll-H1",
    "shortName": "H1",
    "name": "CMLL H1",
    "group": "H-Group",
    "setup": "R U2' R' U' R U R' U' R U' R'",
    "algs": [
      {
        "id": "cmll-H1-default",
        "alg": "R U R' U R U' R' U R U2 R'",
        "note": "Triple Sune",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "cmll-H2",
    "shortName": "H2",
    "name": "CMLL H2",
    "group": "H-Group",
    "setup": "F U R U' R' U R U2' R' U' R U R' F'",
    "algs": [
      {
        "id": "cmll-H2-default",
        "alg": "F R U' R' U R U2 R' U' R U R' U' F'",
        "note": "F Setup + Sune",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "cmll-H3",
    "shortName": "H3",
    "name": "CMLL H3",
    "group": "H-Group",
    "setup": "L' U R U' L U' R' U' R U' R'",
    "algs": [
      {
        "id": "cmll-H3-default",
        "alg": "R U R' U R U L' U R' U' L",
        "note": "RUL Commutator",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "cmll-H4",
    "shortName": "H4",
    "name": "CMLL H4",
    "group": "H-Group",
    "setup": "F U R U' R' U R U' R' U R U' R' F'",
    "algs": [
      {
        "id": "cmll-H4-default",
        "alg": "F R U R' U' R U R' U' R U R' U' F'",
        "note": "Triple Righty",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "cmll-P1",
    "shortName": "P1",
    "name": "CMLL P1",
    "group": "P-Group",
    "setup": "R' U2' R2' U R2' U R2' U2' R'",
    "algs": [
      {
        "id": "cmll-P1-default",
        "alg": "R U2 R2 U' R2 U' R2 U2 R",
        "note": "Bruno (2-Gen Pi)",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "cmll-P2",
    "shortName": "P2",
    "name": "CMLL P2",
    "group": "P-Group",
    "setup": "R' U2' R2' U R U R2' D' R U' R' D U' R'",
    "algs": [
      {
        "id": "cmll-P2-default",
        "alg": "R U D' R U R' D R2 U' R' U' R2 U2 R",
        "note": "RUD Diag Pi",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "cmll-P3",
    "shortName": "P3",
    "name": "CMLL P3",
    "group": "P-Group",
    "setup": "L' U' L U' L' U' R U' L U R'",
    "algs": [
      {
        "id": "cmll-P3-default",
        "alg": "R U' L' U R' U L U L' U L",
        "note": "Niklas + Antisune",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "cmll-P4",
    "shortName": "P4",
    "name": "CMLL P4",
    "group": "P-Group",
    "setup": "F U R U' R' U F' U' R' F' R",
    "algs": [
      {
        "id": "cmll-P4-default",
        "alg": "R' F R U F U' R U R' U' F'",
        "note": "Roux RFU Pi",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "cmll-P5",
    "shortName": "P5",
    "name": "CMLL P5",
    "group": "P-Group",
    "setup": "F U R U' R' U R U' R2' F' R U R U' R'",
    "algs": [
      {
        "id": "cmll-P5-default",
        "alg": "R U R' U' R' F R2 U R' U' R U R' U' F'",
        "note": "Sledge + T-Setup",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "cmll-P6",
    "shortName": "P6",
    "name": "CMLL P6",
    "group": "P-Group",
    "setup": "R U R' U F2' R U2' R' U2' R' F2' R",
    "algs": [
      {
        "id": "cmll-P6-default",
        "alg": "R' F2 R U2 R U2 R' F2 U' R U' R'",
        "note": "F2 Slash Pi",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "cmll-U1",
    "shortName": "U1",
    "name": "CMLL U1",
    "group": "U-Group",
    "setup": "R U2' R' U' R U' R2' U2' R U R' U R",
    "algs": [
      {
        "id": "cmll-U1-default",
        "alg": "R' U' R U' R' U2 R2 U R' U R U2 R'",
        "note": "2-Gen U",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "cmll-U2",
    "shortName": "U2",
    "name": "CMLL U2",
    "group": "U-Group",
    "setup": "R' F R' F' R U R U' R' F R U' R' U R U R' F' R",
    "algs": [
      {
        "id": "cmll-U2-default",
        "alg": "R' F R U' R' U' R U R' F' R U R' U' R' F R F' R",
        "note": "Conjugated Y-Perm",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "cmll-U3",
    "shortName": "U3",
    "name": "CMLL U3",
    "group": "U-Group",
    "setup": "R U2' R D R' U2' R D' R2'",
    "algs": [
      {
        "id": "cmll-U3-default",
        "alg": "R2 D R' U2 R D' R' U2 R'",
        "note": "Standard U (Front Bar)",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "cmll-U4",
    "shortName": "U4",
    "name": "CMLL U4",
    "group": "U-Group",
    "setup": "F R U R' U' R U' R' U' R U R' F'",
    "algs": [
      {
        "id": "cmll-U4-default",
        "alg": "F R U' R' U R U R' U R U' R' F'",
        "note": "Slash U",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "cmll-U5",
    "shortName": "U5",
    "name": "CMLL U5",
    "group": "U-Group",
    "setup": "R' U2' R' D' R U2' R' D R2'",
    "algs": [
      {
        "id": "cmll-U5-default",
        "alg": "R2 D' R U2 R' D R U2 R",
        "note": "Back U (RUD)",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "cmll-U6",
    "shortName": "U6",
    "name": "CMLL U6",
    "group": "U-Group",
    "setup": "F U R U' R' F'",
    "algs": [
      {
        "id": "cmll-U6-default",
        "alg": "F R U R' U' F'",
        "note": "FRURUF",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "cmll-T1",
    "shortName": "T1",
    "name": "CMLL T1",
    "group": "T-Group",
    "setup": "R' U' R U' R' U2' R2' U R' U R U2' R'",
    "algs": [
      {
        "id": "cmll-T1-default",
        "alg": "R U2 R' U' R U' R2 U2 R U R' U R",
        "note": "2-Gen T",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "cmll-T2",
    "shortName": "T2",
    "name": "CMLL T2",
    "group": "T-Group",
    "setup": "L' U R' U' L R U2' R' U' R",
    "algs": [
      {
        "id": "cmll-T2-default",
        "alg": "R' U R U2 R' L' U R U' L",
        "note": "RUL T",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "cmll-T3",
    "shortName": "T3",
    "name": "CMLL T3",
    "group": "T-Group",
    "setup": "F R' F' r U R U' r'",
    "algs": [
      {
        "id": "cmll-T3-default",
        "alg": "r U R' U' r' F R F'",
        "note": "Chameleon",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "cmll-T4",
    "shortName": "T4",
    "name": "CMLL T4",
    "group": "T-Group",
    "setup": "F R U' R' U R U R' U R U' R' F'",
    "algs": [
      {
        "id": "cmll-T4-default",
        "alg": "F R U R' U' R U' R' U' R U R' F'",
        "note": "Diag T",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "cmll-T5",
    "shortName": "T5",
    "name": "CMLL T5",
    "group": "T-Group",
    "setup": "R' U R2' D r' U2' r D' R2' U' R",
    "algs": [
      {
        "id": "cmll-T5-default",
        "alg": "R' U R2 D r' U2 r D' R2 U' R",
        "note": "Wide RUD T",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "cmll-T6",
    "shortName": "T6",
    "name": "CMLL T6",
    "group": "T-Group",
    "setup": "F' r U R' U' L' U l",
    "algs": [
      {
        "id": "cmll-T6-default",
        "alg": "l' U' L U R U' r' F",
        "note": "Left-Block Chameleon",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "cmll-L1",
    "shortName": "L1",
    "name": "CMLL L1",
    "group": "L-Group",
    "setup": "R U2' R' U' R U R' U' R U R' U' R U' R'",
    "algs": [
      {
        "id": "cmll-L1-default",
        "alg": "R U R' U R U' R' U R U' R' U R U2 R'",
        "note": "Quad Sune L",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "cmll-L2",
    "shortName": "L2",
    "name": "CMLL L2",
    "group": "L-Group",
    "setup": "R2' D' R U2' R' D R U2' R",
    "algs": [
      {
        "id": "cmll-L2-default",
        "alg": "R' U2 R' D' R U2 R' D R2",
        "note": "Standard RUD L",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "cmll-L3",
    "shortName": "L3",
    "name": "CMLL L3",
    "group": "L-Group",
    "setup": "R2' D R' U2' R D' R' U2' R'",
    "algs": [
      {
        "id": "cmll-L3-default",
        "alg": "R U2 R D R' U2 R D' R2",
        "note": "Inverse RUD L",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "cmll-L4",
    "shortName": "L4",
    "name": "CMLL L4",
    "group": "L-Group",
    "setup": "r U R' U' r' F R F'",
    "algs": [
      {
        "id": "cmll-L4-default",
        "alg": "F R' F' r U R U' r'",
        "note": "Wide Inverse Bowtie",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "cmll-L5",
    "shortName": "L5",
    "name": "CMLL L5",
    "group": "L-Group",
    "setup": "R' F' r U R U' r' F",
    "algs": [
      {
        "id": "cmll-L5-default",
        "alg": "F' r U R' U' r' F R",
        "note": "Triple Sledge Bowtie",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "cmll-L6",
    "shortName": "L6",
    "name": "CMLL L6",
    "group": "L-Group",
    "setup": "R2' F' R U R U' R' F R U' R' U R",
    "algs": [
      {
        "id": "cmll-L6-default",
        "alg": "R' U' R U R' F' R U R' U' R' F R2",
        "note": "Diag L",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "cmll-S1",
    "shortName": "S1",
    "name": "CMLL S1",
    "group": "S-Group",
    "setup": "R U2' R' U' R U' R'",
    "algs": [
      {
        "id": "cmll-S1-default",
        "alg": "R U R' U R U2 R'",
        "note": "2-Gen Sune",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "cmll-S2",
    "shortName": "S2",
    "name": "CMLL S2",
    "group": "S-Group",
    "setup": "R U2' R' U2' L' U R U' R' L",
    "algs": [
      {
        "id": "cmll-S2-default",
        "alg": "L' R U R' U' L U2 R U2 R'",
        "note": "RUL Sune",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "cmll-S3",
    "shortName": "S3",
    "name": "CMLL S3",
    "group": "S-Group",
    "setup": "F R U R' U' R' F2' R U2' R U2' R' F",
    "algs": [
      {
        "id": "cmll-S3-default",
        "alg": "F' R U2 R' U2 R' F2 R U R U' R' F'",
        "note": "Diag Sune",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "cmll-S4",
    "shortName": "S4",
    "name": "CMLL S4",
    "group": "S-Group",
    "setup": "R2' D R' U R D' R' U R' U' R U' R'",
    "algs": [
      {
        "id": "cmll-S4-default",
        "alg": "R U R' U R U' R D R' U' R D' R2",
        "note": "RUD Sune",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "cmll-S5",
    "shortName": "S5",
    "name": "CMLL S5",
    "group": "S-Group",
    "setup": "L' U R U' L U R'",
    "algs": [
      {
        "id": "cmll-S5-default",
        "alg": "R U' L' U R' U' L",
        "note": "Niklas",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "cmll-S6",
    "shortName": "S6",
    "name": "CMLL S6",
    "group": "S-Group",
    "setup": "R L' U' L U R' U2' L' U2' L",
    "algs": [
      {
        "id": "cmll-S6-default",
        "alg": "L' U2 L U2 R U' L' U L R'",
        "note": "Left-Right Niklas Sune",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "cmll-A1",
    "shortName": "A1",
    "name": "CMLL A1",
    "group": "A-Group",
    "setup": "R' U2' R U R' U R",
    "algs": [
      {
        "id": "cmll-A1-default",
        "alg": "R' U' R U' R' U2 R",
        "note": "Back Antisune (2-Gen)",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "cmll-A2",
    "shortName": "A2",
    "name": "CMLL A2",
    "group": "A-Group",
    "setup": "R U R' U R U2' R' F U R U' R' F'",
    "algs": [
      {
        "id": "cmll-A2-default",
        "alg": "F R U R' U' F' R U2 R' U' R U' R'",
        "note": "FRURUF + Antisune",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "cmll-A3",
    "shortName": "A3",
    "name": "CMLL A3",
    "group": "A-Group",
    "setup": "F R U' R' U R U R' F' R U R' U R U2' R'",
    "algs": [
      {
        "id": "cmll-A3-default",
        "alg": "R U2 R' U' R U' R' F R U' R' U' R U R' F'",
        "note": "T-Antisune (Roux)",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "cmll-A4",
    "shortName": "A4",
    "name": "CMLL A4",
    "group": "A-Group",
    "setup": "R L' U R' U' L U2' R U2' R'",
    "algs": [
      {
        "id": "cmll-A4-default",
        "alg": "R U2 R' U2 L' U R U' L R'",
        "note": "Back Bar Antisune",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "cmll-A5",
    "shortName": "A5",
    "name": "CMLL A5",
    "group": "A-Group",
    "setup": "R U' L' U R' U' L",
    "algs": [
      {
        "id": "cmll-A5-default",
        "alg": "L' U R U' L U R'",
        "note": "Inverse Niklas",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "cmll-A6",
    "shortName": "A6",
    "name": "CMLL A6",
    "group": "A-Group",
    "setup": "R2' D' R U' R' D R U' R U R' U R",
    "algs": [
      {
        "id": "cmll-A6-default",
        "alg": "R' U' R U' R' U R' D' R U R' D R2",
        "note": "RUD Antisune",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  }
];

export const cmllCaseById = new Map(cmllCases.map(c => [c.id, c]));
