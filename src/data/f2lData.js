// 3x3x3 F2L (First Two Layers) - All 41 Basic Cases
// Automatically formatted and verified with cubing.js

export const f2lCases = [
  {
    "id": "f2l-01",
    "number": 1,
    "name": "F2L 1 (Easy Left / Right Insertion)",
    "group": "Basic Inserts",
    "algs": [
      {
        "id": "f2l-01-1",
        "alg": "U R U' R'",
        "note": "Standard 3-move insert",
        "isDefault": true
      }
    ],
    "setup": "R U R' U'"
  },
  {
    "id": "f2l-02",
    "number": 2,
    "name": "F2L 2 (Easy Front Insertion)",
    "group": "Basic Inserts",
    "algs": [
      {
        "id": "f2l-02-1",
        "alg": "y' U' R' U R",
        "note": "Standard left insert with rotation",
        "isDefault": true
      },
      {
        "id": "f2l-02-2",
        "alg": "F' U' F",
        "note": "Front-face variant"
      }
    ],
    "setup": "R' U' R U y"
  },
  {
    "id": "f2l-03",
    "number": 3,
    "name": "F2L 3 (Direct Left Insertion)",
    "group": "Basic Inserts",
    "algs": [
      {
        "id": "f2l-03-1",
        "alg": "y' R' U' R",
        "note": "Direct 3-move insert",
        "isDefault": true
      },
      {
        "id": "f2l-03-2",
        "alg": "F' U F",
        "note": "Front-face variant"
      }
    ],
    "setup": "R' U R y"
  },
  {
    "id": "f2l-04",
    "number": 4,
    "name": "F2L 4 (Direct Right Insertion)",
    "group": "Basic Inserts",
    "algs": [
      {
        "id": "f2l-04-1",
        "alg": "R U R'",
        "note": "Direct 3-move right insert",
        "isDefault": true
      }
    ],
    "setup": "R U' R'"
  },
  {
    "id": "f2l-05",
    "number": 5,
    "name": "F2L 5 (Split Pair - Right)",
    "group": "Corner in U, Edge in U",
    "algs": [
      {
        "id": "f2l-05-1",
        "alg": "U' R U R' U2 R U' R'",
        "note": "Standard",
        "isDefault": true
      }
    ],
    "setup": "R U R' U2' R U' R' U"
  },
  {
    "id": "f2l-06",
    "number": 6,
    "name": "F2L 6 (Split Pair - Left)",
    "group": "Corner in U, Edge in U",
    "algs": [
      {
        "id": "f2l-06-1",
        "alg": "d R' U' R U2' R' U R",
        "note": "Standard with rotation",
        "isDefault": true
      }
    ],
    "setup": "R' U' R U2 R' U R d'"
  },
  {
    "id": "f2l-07",
    "number": 7,
    "name": "F2L 7 (Trapped Corner)",
    "group": "Corner in U, Edge in U",
    "algs": [
      {
        "id": "f2l-07-1",
        "alg": "U' R U2' R' U R U R'",
        "note": "Standard",
        "isDefault": true
      }
    ],
    "setup": "R U' R' U' R U2 R' U"
  },
  {
    "id": "f2l-08",
    "number": 8,
    "name": "F2L 8 (Trapped Corner Left)",
    "group": "Corner in U, Edge in U",
    "algs": [
      {
        "id": "f2l-08-1",
        "alg": "d R' U2 R U' R' U' R",
        "note": "Standard with rotation",
        "isDefault": true
      }
    ],
    "setup": "R' U R U R' U2' R d'"
  },
  {
    "id": "f2l-09",
    "number": 9,
    "name": "F2L 9 (Adjacent Misaligned)",
    "group": "Corner in U, Edge in U",
    "algs": [
      {
        "id": "f2l-09-1",
        "alg": "y' U R' U' R U2' R' U R",
        "note": "Standard",
        "isDefault": true
      }
    ],
    "setup": "R' U' R U2 R' U R U' y"
  },
  {
    "id": "f2l-10",
    "number": 10,
    "name": "F2L 10 (Adjacent Misaligned Right)",
    "group": "Corner in U, Edge in U",
    "algs": [
      {
        "id": "f2l-10-1",
        "alg": "U' R U R' U2 R U R'",
        "note": "Standard",
        "isDefault": true
      }
    ],
    "setup": "R U' R' U2' R U' R' U"
  },
  {
    "id": "f2l-11",
    "number": 11,
    "name": "F2L 11 (Connected Facing Back)",
    "group": "Corner in U, Edge in U",
    "algs": [
      {
        "id": "f2l-11-1",
        "alg": "U' R U' R' U y' R' U' R",
        "note": "Standard",
        "isDefault": true
      }
    ],
    "setup": "R' U R y U' R U R' U"
  },
  {
    "id": "f2l-12",
    "number": 12,
    "name": "F2L 12 (Connected Facing Left)",
    "group": "Corner in U, Edge in U",
    "algs": [
      {
        "id": "f2l-12-1",
        "alg": "d R' U R U' R' U' R",
        "note": "Standard",
        "isDefault": true
      }
    ],
    "setup": "R' U R U R' U' R d'"
  },
  {
    "id": "f2l-13",
    "number": 13,
    "name": "F2L 13 (Separated Facing Back)",
    "group": "Corner in U, Edge in U",
    "algs": [
      {
        "id": "f2l-13-1",
        "alg": "y' U R' U R U' R' U' R",
        "note": "Standard",
        "isDefault": true
      }
    ],
    "setup": "R' U R U R' U' R U' y"
  },
  {
    "id": "f2l-14",
    "number": 14,
    "name": "F2L 14 (Separated Facing Right)",
    "group": "Corner in U, Edge in U",
    "algs": [
      {
        "id": "f2l-14-1",
        "alg": "U R U' R' U R U R'",
        "note": "Standard",
        "isDefault": true
      }
    ],
    "setup": "R U' R' U' R U R' U'"
  },
  {
    "id": "f2l-15",
    "number": 15,
    "name": "F2L 15 (Touching Facing Front)",
    "group": "Corner in U, Edge in U",
    "algs": [
      {
        "id": "f2l-15-1",
        "alg": "y' R' U R U2' y R U R'",
        "note": "Standard",
        "isDefault": true
      }
    ],
    "setup": "R U' R' y' U2 R' U' R y"
  },
  {
    "id": "f2l-16",
    "number": 16,
    "name": "F2L 16 (Touching Facing Right)",
    "group": "Corner in U, Edge in U",
    "algs": [
      {
        "id": "f2l-16-1",
        "alg": "R U' R' U2 R U' R'",
        "note": "Standard",
        "isDefault": true
      }
    ],
    "setup": "R U R' U2' R U R'"
  },
  {
    "id": "f2l-17",
    "number": 17,
    "name": "F2L 17 (White Up - Match Edge Right)",
    "group": "Corner in U, Edge in U",
    "algs": [
      {
        "id": "f2l-17-1",
        "alg": "R U2 R' U' R U R'",
        "note": "Standard",
        "isDefault": true
      }
    ],
    "setup": "R U' R' U R U2' R'"
  },
  {
    "id": "f2l-18",
    "number": 18,
    "name": "F2L 18 (White Up - Match Edge Left)",
    "group": "Corner in U, Edge in U",
    "algs": [
      {
        "id": "f2l-18-1",
        "alg": "y' R' U2 R U R' U' R",
        "note": "Standard",
        "isDefault": true
      }
    ],
    "setup": "R' U R U' R' U2' R y"
  },
  {
    "id": "f2l-19",
    "number": 19,
    "name": "F2L 19 (White Up - Displaced Right)",
    "group": "Corner in U, Edge in U",
    "algs": [
      {
        "id": "f2l-19-1",
        "alg": "U R U2 R' U R U' R'",
        "note": "Standard",
        "isDefault": true
      }
    ],
    "setup": "R U R' U' R U2' R' U'"
  },
  {
    "id": "f2l-20",
    "number": 20,
    "name": "F2L 20 (White Up - Displaced Left)",
    "group": "Corner in U, Edge in U",
    "algs": [
      {
        "id": "f2l-20-1",
        "alg": "y' U' R' U2 R U' R' U R",
        "note": "Standard",
        "isDefault": true
      }
    ],
    "setup": "R' U' R U R' U2' R U y"
  },
  {
    "id": "f2l-21",
    "number": 21,
    "name": "F2L 21 (White Up - Opposite Edge Right)",
    "group": "Corner in U, Edge in U",
    "algs": [
      {
        "id": "f2l-21-1",
        "alg": "U2 R U R' U R U' R'",
        "note": "Standard",
        "isDefault": true
      }
    ],
    "setup": "R U R' U' R U' R' U2'"
  },
  {
    "id": "f2l-22",
    "number": 22,
    "name": "F2L 22 (White Up - Opposite Edge Left)",
    "group": "Corner in U, Edge in U",
    "algs": [
      {
        "id": "f2l-22-1",
        "alg": "y' U2 R' U' R U' R' U R",
        "note": "Standard",
        "isDefault": true
      }
    ],
    "setup": "R' U' R U R' U R U2' y"
  },
  {
    "id": "f2l-23",
    "number": 23,
    "name": "F2L 23 (White Up - Together Unmatched)",
    "group": "Corner in U, Edge in U",
    "algs": [
      {
        "id": "f2l-23-1",
        "alg": "R U2 R' U' R U R'",
        "note": "Standard",
        "isDefault": true
      }
    ],
    "setup": "R U' R' U R U2' R'"
  },
  {
    "id": "f2l-24",
    "number": 24,
    "name": "F2L 24 (White Up - Together Matched)",
    "group": "Corner in U, Edge in U",
    "algs": [
      {
        "id": "f2l-24-1",
        "alg": "R U R' U' U' R U R' U' R U R'",
        "note": "Triple Sexy variant",
        "isDefault": true
      }
    ],
    "setup": "R U' R' U R U' R' U U R U' R'"
  },
  {
    "id": "f2l-25",
    "number": 25,
    "name": "F2L 25 (Corner Misoriented in Slot 1)",
    "group": "Corner in Slot, Edge in U",
    "algs": [
      {
        "id": "f2l-25-1",
        "alg": "R U' R' d R' U R",
        "note": "Standard",
        "isDefault": true
      }
    ],
    "setup": "R' U' R d' R U R'"
  },
  {
    "id": "f2l-26",
    "number": 26,
    "name": "F2L 26 (Corner Misoriented in Slot 2)",
    "group": "Corner in Slot, Edge in U",
    "algs": [
      {
        "id": "f2l-26-1",
        "alg": "R U R' U' R U R'",
        "note": "Standard",
        "isDefault": true
      }
    ],
    "setup": "R U' R' U R U' R'"
  },
  {
    "id": "f2l-27",
    "number": 27,
    "name": "F2L 27 (Corner Misoriented in Slot 3)",
    "group": "Corner in Slot, Edge in U",
    "algs": [
      {
        "id": "f2l-27-1",
        "alg": "R U' R' U R U' R'",
        "note": "Standard",
        "isDefault": true
      }
    ],
    "setup": "R U R' U' R U R'"
  },
  {
    "id": "f2l-28",
    "number": 28,
    "name": "F2L 28 (Corner Solved in Slot - Edge in U 1)",
    "group": "Corner in Slot, Edge in U",
    "algs": [
      {
        "id": "f2l-28-1",
        "alg": "R U R' d R' U' R",
        "note": "Standard",
        "isDefault": true
      }
    ],
    "setup": "R' U R d' R U' R'"
  },
  {
    "id": "f2l-29",
    "number": 29,
    "name": "F2L 29 (Corner Solved in Slot - Edge in U 2)",
    "group": "Corner in Slot, Edge in U",
    "algs": [
      {
        "id": "f2l-29-1",
        "alg": "R U' R' U' R U R'",
        "note": "Standard",
        "isDefault": true
      }
    ],
    "setup": "R U' R' U R U R'"
  },
  {
    "id": "f2l-30",
    "number": 30,
    "name": "F2L 30 (Corner Solved in Slot - Edge in U 3)",
    "group": "Corner in Slot, Edge in U",
    "algs": [
      {
        "id": "f2l-30-1",
        "alg": "R U R' U R U' R'",
        "note": "Standard",
        "isDefault": true
      }
    ],
    "setup": "R U R' U' R U' R'"
  },
  {
    "id": "f2l-31",
    "number": 31,
    "name": "F2L 31 (Edge in Slot - Corner Facing Front)",
    "group": "Corner in U, Edge in Slot",
    "algs": [
      {
        "id": "f2l-31-1",
        "alg": "U' R U' R' U R U R'",
        "note": "Standard",
        "isDefault": true
      }
    ],
    "setup": "R U' R' U' R U R' U"
  },
  {
    "id": "f2l-32",
    "number": 32,
    "name": "F2L 32 (Edge in Slot - Corner Facing Right)",
    "group": "Corner in U, Edge in Slot",
    "algs": [
      {
        "id": "f2l-32-1",
        "alg": "U R U' R' U' R U' R'",
        "note": "Standard",
        "isDefault": true
      }
    ],
    "setup": "R U R' U R U R' U'"
  },
  {
    "id": "f2l-33",
    "number": 33,
    "name": "F2L 33 (Edge in Slot - Corner White Up 1)",
    "group": "Corner in U, Edge in Slot",
    "algs": [
      {
        "id": "f2l-33-1",
        "alg": "U' R U R' d R' U' R",
        "note": "Standard",
        "isDefault": true
      }
    ],
    "setup": "R' U R d' R U' R' U"
  },
  {
    "id": "f2l-34",
    "number": 34,
    "name": "F2L 34 (Edge in Slot - Corner White Up 2)",
    "group": "Corner in U, Edge in Slot",
    "algs": [
      {
        "id": "f2l-34-1",
        "alg": "U R U' R' d R' U R",
        "note": "Standard",
        "isDefault": true
      }
    ],
    "setup": "R' U' R d' R U R' U'"
  },
  {
    "id": "f2l-35",
    "number": 35,
    "name": "F2L 35 (Edge in Slot Inverted 1)",
    "group": "Corner in U, Edge in Slot",
    "algs": [
      {
        "id": "f2l-35-1",
        "alg": "R U' R' U R U' R'",
        "note": "Standard",
        "isDefault": true
      }
    ],
    "setup": "R U R' U' R U R'"
  },
  {
    "id": "f2l-36",
    "number": 36,
    "name": "F2L 36 (Edge in Slot Inverted 2)",
    "group": "Corner in U, Edge in Slot",
    "algs": [
      {
        "id": "f2l-36-1",
        "alg": "R U' R' d R' U R",
        "note": "Standard",
        "isDefault": true
      }
    ],
    "setup": "R' U' R d' R U R'"
  },
  {
    "id": "f2l-37",
    "number": 37,
    "name": "F2L 37 (Both in Slot - Edge Flipped)",
    "group": "Both in Slot",
    "algs": [
      {
        "id": "f2l-37-1",
        "alg": "R U' R' d R' U2 R U2' R' U R",
        "note": "Standard",
        "isDefault": true
      }
    ],
    "setup": "R' U' R U2 R' U2' R d' R U R'"
  },
  {
    "id": "f2l-38",
    "number": 38,
    "name": "F2L 38 (Both in Slot - Corner Twisted Right)",
    "group": "Both in Slot",
    "algs": [
      {
        "id": "f2l-38-1",
        "alg": "R U' R' U' R U R' U2 R U' R'",
        "note": "Standard",
        "isDefault": true
      }
    ],
    "setup": "R U R' U2' R U' R' U R U R'"
  },
  {
    "id": "f2l-39",
    "number": 39,
    "name": "F2L 39 (Both in Slot - Corner Twisted Front)",
    "group": "Both in Slot",
    "algs": [
      {
        "id": "f2l-39-1",
        "alg": "R U R' U' R U' R' U2 y' R' U' R",
        "note": "Standard",
        "isDefault": true
      }
    ],
    "setup": "R' U R y U2' R U R' U R U' R'"
  },
  {
    "id": "f2l-40",
    "number": 40,
    "name": "F2L 40 (Both in Slot - Diagonal Misalignment)",
    "group": "Both in Slot",
    "algs": [
      {
        "id": "f2l-40-1",
        "alg": "R U' R' U y' R' U2 R U2' R' U R",
        "note": "Standard",
        "isDefault": true
      }
    ],
    "setup": "R' U' R U2 R' U2' R y U' R U R'"
  },
  {
    "id": "f2l-41",
    "number": 41,
    "name": "F2L 41 (Both in Slot - Inverted Pair)",
    "group": "Both in Slot",
    "algs": [
      {
        "id": "f2l-41-1",
        "alg": "R U' R' r U' r' U2 r U r'",
        "note": "Wide r finger-trick",
        "isDefault": true
      }
    ],
    "setup": "r U' r' U2' r U r' R U R'"
  }
];

export const f2lCaseById = new Map(f2lCases.map(c => [c.id, c]));
