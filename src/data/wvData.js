// 3x3x3 Winter Variation (F2L Pair Inserted + OLL Skip, All Edges Oriented) - 27 Cases
// Verified mathematically against cubing/kpuzzle 3x3x3

export const wvCases = [
  {
    "id": "wv-1",
    "number": 1,
    "shortName": "WV 1",
    "name": "WV 1 (3 Oriented)",
    "group": "3 Oriented",
    "setup": "L' U2' R U R' U2' L",
    "algs": [
      {
        "id": "wv-1-default",
        "alg": "L' U2 R U' R' U2 L",
        "note": "Direct Insert (WV Skip)",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "wv-2",
    "number": 2,
    "shortName": "WV 2",
    "name": "WV 2 (2 Oriented)",
    "group": "2 Oriented",
    "setup": "R U R' U R U' R'",
    "algs": [
      {
        "id": "wv-2-default",
        "alg": "R U R' U' R U' R'",
        "note": "2 Oriented U-Corners",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "wv-3",
    "number": 3,
    "shortName": "WV 3",
    "name": "WV 3 (2 Oriented)",
    "group": "2 Oriented",
    "setup": "R U' R' U2' R U R' U2' R U R'",
    "algs": [
      {
        "id": "wv-3-default",
        "alg": "R U' R' U2 R U' R' U2 R U R'",
        "note": "2 Oriented U-Corners",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "wv-4",
    "number": 4,
    "shortName": "WV 4",
    "name": "WV 4 (2 Oriented)",
    "group": "2 Oriented",
    "setup": "R' U2' R U R' U R U' R U R'",
    "algs": [
      {
        "id": "wv-4-default",
        "alg": "R U' R' U R' U' R U' R' U2 R",
        "note": "2 Oriented U-Corners",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "wv-5",
    "number": 5,
    "shortName": "WV 5",
    "name": "WV 5 (2 Oriented)",
    "group": "2 Oriented",
    "setup": "R2' D R' U R D' R2'",
    "algs": [
      {
        "id": "wv-5-default",
        "alg": "R2 D R' U' R D' R2",
        "note": "2 Oriented U-Corners",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "wv-6",
    "number": 6,
    "shortName": "WV 6",
    "name": "WV 6 (2 Oriented)",
    "group": "2 Oriented",
    "setup": "F R' F' r U R U' r' R U2' R'",
    "algs": [
      {
        "id": "wv-6-default",
        "alg": "R U2 R' r U R' U' r' F R F'",
        "note": "2 Oriented U-Corners",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "wv-7",
    "number": 7,
    "shortName": "WV 7",
    "name": "WV 7 (2 Oriented)",
    "group": "2 Oriented",
    "setup": "R U R'",
    "algs": [
      {
        "id": "wv-7-default",
        "alg": "R U' R'",
        "note": "2 Oriented U-Corners",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "wv-8",
    "number": 8,
    "shortName": "WV 8",
    "name": "WV 8 (1 Oriented)",
    "group": "1 Oriented",
    "setup": "R U R' U R U2' R' U R U R'",
    "algs": [
      {
        "id": "wv-8-default",
        "alg": "R U' R' U' R U2 R' U' R U' R'",
        "note": "1 Oriented U-Corners",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "wv-9",
    "number": 9,
    "shortName": "WV 9",
    "name": "WV 9 (1 Oriented)",
    "group": "1 Oriented",
    "setup": "R U2' R' U' R U' R' U R U2' R'",
    "algs": [
      {
        "id": "wv-9-default",
        "alg": "R U2 R' U' R U R' U R U2 R'",
        "note": "1 Oriented U-Corners",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "wv-10",
    "number": 10,
    "shortName": "WV 10",
    "name": "WV 10 (1 Oriented)",
    "group": "1 Oriented",
    "setup": "F R' F' r U R U' r' U2' R U2' R'",
    "algs": [
      {
        "id": "wv-10-default",
        "alg": "R U2 R' U2 r U R' U' r' F R F'",
        "note": "1 Oriented U-Corners",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "wv-11",
    "number": 11,
    "shortName": "WV 11",
    "name": "WV 11 (1 Oriented)",
    "group": "1 Oriented",
    "setup": "R U2' R' U' R U R'",
    "algs": [
      {
        "id": "wv-11-default",
        "alg": "R U' R' U R U2 R'",
        "note": "1 Oriented U-Corners",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "wv-12",
    "number": 12,
    "shortName": "WV 12",
    "name": "WV 12 (1 Oriented)",
    "group": "1 Oriented",
    "setup": "F R' F' r U R U' r' R U R'",
    "algs": [
      {
        "id": "wv-12-default",
        "alg": "R U' R' r U R' U' r' F R F'",
        "note": "1 Oriented U-Corners",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "wv-13",
    "number": 13,
    "shortName": "WV 13",
    "name": "WV 13 (1 Oriented)",
    "group": "1 Oriented",
    "setup": "R2' D R' U2' R D' R2'",
    "algs": [
      {
        "id": "wv-13-default",
        "alg": "R2 D R' U2 R D' R2",
        "note": "1 Oriented U-Corners",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "wv-14",
    "number": 14,
    "shortName": "WV 14",
    "name": "WV 14 (1 Oriented)",
    "group": "1 Oriented",
    "setup": "R' U2' R' D' R U2' R' D R' U R'",
    "algs": [
      {
        "id": "wv-14-default",
        "alg": "R U' R D' R U2 R' D R U2 R",
        "note": "1 Oriented U-Corners",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "wv-15",
    "number": 15,
    "shortName": "WV 15",
    "name": "WV 15 (1 Oriented)",
    "group": "1 Oriented",
    "setup": "R U2' R'",
    "algs": [
      {
        "id": "wv-15-default",
        "alg": "R U2 R'",
        "note": "1 Oriented U-Corners",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "wv-16",
    "number": 16,
    "shortName": "WV 16",
    "name": "WV 16 (1 Oriented)",
    "group": "1 Oriented",
    "setup": "R' U2' R U R' U R2' U2' R'",
    "algs": [
      {
        "id": "wv-16-default",
        "alg": "R U2 R2 U' R U' R' U2 R",
        "note": "1 Oriented U-Corners",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "wv-17",
    "number": 17,
    "shortName": "WV 17",
    "name": "WV 17 (1 Oriented)",
    "group": "1 Oriented",
    "setup": "F R' F' r U R U' r' U' R U R'",
    "algs": [
      {
        "id": "wv-17-default",
        "alg": "R U' R' U r U R' U' r' F R F'",
        "note": "1 Oriented U-Corners",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "wv-18",
    "number": 18,
    "shortName": "WV 18",
    "name": "WV 18 (1 Oriented)",
    "group": "1 Oriented",
    "setup": "F R' F' r U R U' r' U2' R U R'",
    "algs": [
      {
        "id": "wv-18-default",
        "alg": "R U' R' U2 r U R' U' r' F R F'",
        "note": "1 Oriented U-Corners",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "wv-19",
    "number": 19,
    "shortName": "WV 19",
    "name": "WV 19 (1 Oriented)",
    "group": "1 Oriented",
    "setup": "R U2' R2' D' R U' R' D R U",
    "algs": [
      {
        "id": "wv-19-default",
        "alg": "U' R' D' R U R' D R2 U2 R'",
        "note": "1 Oriented U-Corners",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "wv-20",
    "number": 20,
    "shortName": "WV 20",
    "name": "WV 20 (0 Oriented)",
    "group": "0 Oriented",
    "setup": "R' F' r U R U' r' F U R U2' R'",
    "algs": [
      {
        "id": "wv-20-default",
        "alg": "R U2 R' U' F' r U R' U' r' F R",
        "note": "0 Oriented U-Corners",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "wv-21",
    "number": 21,
    "shortName": "WV 21",
    "name": "WV 21 (0 Oriented)",
    "group": "0 Oriented",
    "setup": "R U2' R' U' R U' R' U' R U2' R'",
    "algs": [
      {
        "id": "wv-21-default",
        "alg": "R U2 R' U R U R' U R U2 R'",
        "note": "0 Oriented U-Corners",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "wv-22",
    "number": 22,
    "shortName": "WV 22",
    "name": "WV 22 (0 Oriented)",
    "group": "0 Oriented",
    "setup": "R' U2' R' D' R U2' R' D R' U2' R'",
    "algs": [
      {
        "id": "wv-22-default",
        "alg": "R U2 R D' R U2 R' D R U2 R",
        "note": "0 Oriented U-Corners",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "wv-23",
    "number": 23,
    "shortName": "WV 23",
    "name": "WV 23 (0 Oriented)",
    "group": "0 Oriented",
    "setup": "R' U' R U' R' U2' R2' U R'",
    "algs": [
      {
        "id": "wv-23-default",
        "alg": "R U' R2 U2 R U R' U R",
        "note": "0 Oriented U-Corners",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "wv-24",
    "number": 24,
    "shortName": "WV 24",
    "name": "WV 24 (0 Oriented)",
    "group": "0 Oriented",
    "setup": "R' U2' R U R' U R2' U R'",
    "algs": [
      {
        "id": "wv-24-default",
        "alg": "R U' R2 U' R U' R' U2 R",
        "note": "0 Oriented U-Corners",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "wv-25",
    "number": 25,
    "shortName": "WV 25",
    "name": "WV 25 (0 Oriented)",
    "group": "0 Oriented",
    "setup": "R' F' r U R U' r' F U R U R'",
    "algs": [
      {
        "id": "wv-25-default",
        "alg": "R U' R' U' F' r U R' U' r' F R",
        "note": "0 Oriented U-Corners",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "wv-26",
    "number": 26,
    "shortName": "WV 26",
    "name": "WV 26 (0 Oriented)",
    "group": "0 Oriented",
    "setup": "R' U2' R U R' U R U' R U2' R'",
    "algs": [
      {
        "id": "wv-26-default",
        "alg": "R U2 R' U R' U' R U' R' U2 R",
        "note": "0 Oriented U-Corners",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  },
  {
    "id": "wv-27",
    "number": 27,
    "shortName": "WV 27",
    "name": "WV 27 (0 Oriented)",
    "group": "0 Oriented",
    "setup": "R U2' R' U' R U' R' U R U R'",
    "algs": [
      {
        "id": "wv-27-default",
        "alg": "R U' R' U' R U R' U R U2 R'",
        "note": "0 Oriented U-Corners",
        "isDefault": true,
        "startAuf": ""
      }
    ]
  }
];

export const wvCaseById = new Map(wvCases.map(c => [c.id, c]));
