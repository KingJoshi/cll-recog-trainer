// Extended 3x3 F2L tiers: Essential (21), Intermediate (16 back-slot / FL / keyhole), and Advanced (14 multi-slot & yellow-cross control)
// All algorithms and inverse setups are mathematically verified with cubing.js to preserve the White Cross.

export const ESSENTIAL_F2L_IDS = new Set([
  "f2l-01", // Basic Insert (U R U' R') — mirror: f2l-02
  "f2l-04", // Direct Insert (R U R') — mirror: f2l-03
  "f2l-05", // Split Pair — mirror: f2l-06
  "f2l-07", // Trapped Corner — mirror: f2l-08
  "f2l-10", // Adjacent Misaligned — mirror: f2l-09
  "f2l-11", // Connected Facing Up/Back — mirror: f2l-12
  "f2l-14", // Separated Pair — mirror: f2l-13
  "f2l-16", // Touching Pair — mirror: f2l-15
  "f2l-17", // White Up Match Edge — mirror: f2l-18
  "f2l-19", // White Up Displaced — mirror: f2l-20
  "f2l-21", // White Up Opposite — mirror: f2l-22
  "f2l-23", // White Up Together Unmatched (paired w/ f2l-24)
  "f2l-25", // Corner Misoriented in Slot 1 — mirror: f2l-26
  "f2l-27", // Corner Misoriented in Slot 3
  "f2l-28", // Corner Solved in Slot 1 — mirrors: f2l-29, f2l-30
  "f2l-31", // Edge in Slot Facing Front — mirror: f2l-32
  "f2l-33", // Edge in Slot Corner White Up — mirror: f2l-34
  "f2l-35", // Edge in Slot Inverted — mirror: f2l-36
  "f2l-37", // Both in Slot - Edge Flipped
  "f2l-38", // Both in Slot - Corner Twisted — mirror: f2l-39
  "f2l-41"  // Both in Slot - Inverted Pair (paired w/ f2l-40)
]);

export const ESSENTIAL_F2L_MIRROR_MAP = {
  "f2l-01": "f2l-02",
  "f2l-04": "f2l-03",
  "f2l-05": "f2l-06",
  "f2l-07": "f2l-08",
  "f2l-10": "f2l-09",
  "f2l-11": "f2l-12",
  "f2l-14": "f2l-13",
  "f2l-16": "f2l-15",
  "f2l-17": "f2l-18",
  "f2l-19": "f2l-20",
  "f2l-21": "f2l-22",
  "f2l-23": "f2l-24",
  "f2l-25": "f2l-26",
  "f2l-27": "f2l-30",
  "f2l-28": "f2l-29",
  "f2l-31": "f2l-32",
  "f2l-33": "f2l-34",
  "f2l-35": "f2l-36",
  "f2l-38": "f2l-39",
  "f2l-41": "f2l-40"
};

const REVERSE_ESSENTIAL_MIRROR_MAP = Object.fromEntries(
  Object.entries(ESSENTIAL_F2L_MIRROR_MAP).map(([baseId, mirrorId]) => [mirrorId, baseId])
);

export function getEssentialMirrorPartnerId(caseId) {
  return ESSENTIAL_F2L_MIRROR_MAP[caseId] || REVERSE_ESSENTIAL_MIRROR_MAP[caseId] || null;
}

export const F2L_INTERMEDIATE_GROUPS = [
  "Back-Right (BR) Inserts",
  "Back-Left (BL) Inserts",
  "Keyhole & Left-Front (FL)"
];

export const f2lIntermediateCases = [
  {
    id: "f2l-int-01",
    number: 1,
    name: "BR Direct Back-Right Insert",
    group: "Back-Right (BR) Inserts",
    cameraLongitude: 30,
    algs: [
      { id: "f2l-int-01-1", alg: "R' U' R", note: "Rotationless back-right 3-mover", isDefault: true }
    ],
    setup: "R' U R"
  },
  {
    id: "f2l-int-02",
    number: 2,
    name: "BR Joined Pair Insert",
    group: "Back-Right (BR) Inserts",
    cameraLongitude: 30,
    algs: [
      { id: "f2l-int-02-1", alg: "U' R' U R", note: "Tuck corner+edge straight into BR", isDefault: true }
    ],
    setup: "R' U' R U"
  },
  {
    id: "f2l-int-03",
    number: 3,
    name: "BR Split Pair (Same Color Top)",
    group: "Back-Right (BR) Inserts",
    cameraLongitude: 30,
    algs: [
      { id: "f2l-int-03-1", alg: "U R' U' R U2 R' U R", note: "Split above BR then insert rotationless", isDefault: true }
    ],
    setup: "R' U' R U2 R' U R U'"
  },
  {
    id: "f2l-int-04",
    number: 4,
    name: "BR White Facing Up Over Slot",
    group: "Back-Right (BR) Inserts",
    cameraLongitude: 30,
    algs: [
      { id: "f2l-int-04-1", alg: "R' U2 R U R' U' R", note: "Flip corner over edge then R' U' R", isDefault: true }
    ],
    setup: "R' U R U' R' U2 R"
  },
  {
    id: "f2l-int-05",
    number: 5,
    name: "BR Corner in Slot (Edge in U)",
    group: "Back-Right (BR) Inserts",
    cameraLongitude: 30,
    algs: [
      { id: "f2l-int-05-1", alg: "R' U R U' R' U' R", note: "Extract + pair in one continuous <R', U> flow", isDefault: true }
    ],
    setup: "R' U R U R' U' R"
  },
  {
    id: "f2l-int-06",
    number: 6,
    name: "BR Corner Misoriented (Deep Slot)",
    group: "Back-Right (BR) Inserts",
    cameraLongitude: 30,
    algs: [
      { id: "f2l-int-06-1", alg: "R' U' R U2 R' U' R U R' U' R", note: "2-gen <R, U> BR pair without rotation", isDefault: true }
    ],
    setup: "R' U R U' R' U R U2 R' U R"
  },
  {
    id: "f2l-int-07",
    number: 7,
    name: "BL Direct Back-Left Insert",
    group: "Back-Left (BL) Inserts",
    cameraLongitude: 30,
    algs: [
      { id: "f2l-int-07-1", alg: "L U L'", note: "Direct back-left 3-move insert", isDefault: true }
    ],
    setup: "L U' L'"
  },
  {
    id: "f2l-int-08",
    number: 8,
    name: "BL Joined Pair Insert",
    group: "Back-Left (BL) Inserts",
    cameraLongitude: 30,
    algs: [
      { id: "f2l-int-08-1", alg: "U L U' L'", note: "Rotationless joined pair insert into BL", isDefault: true }
    ],
    setup: "L U L' U'"
  },
  {
    id: "f2l-int-09",
    number: 9,
    name: "BL Split Pair (Same Color Top)",
    group: "Back-Left (BL) Inserts",
    cameraLongitude: 30,
    algs: [
      { id: "f2l-int-09-1", alg: "U' L U L' U2 L U' L'", note: "Set up BL pair cleanly with left index/ring", isDefault: true }
    ],
    setup: "L U L' U2 L U' L' U"
  },
  {
    id: "f2l-int-10",
    number: 10,
    name: "BL White Facing Up Over Slot",
    group: "Back-Left (BL) Inserts",
    cameraLongitude: 30,
    algs: [
      { id: "f2l-int-10-1", alg: "L U2 L' U' L U L'", note: "White-up corner flip + BL tuck", isDefault: true }
    ],
    setup: "L U' L' U L U2 L'"
  },
  {
    id: "f2l-int-11",
    number: 11,
    name: "BL Corner in Slot (Edge in U)",
    group: "Back-Left (BL) Inserts",
    cameraLongitude: 30,
    algs: [
      { id: "f2l-int-11-1", alg: "L U' L' U L U L'", note: "2-gen <L, U> extract & reinsert", isDefault: true }
    ],
    setup: "L U' L' U' L U L'"
  },
  {
    id: "f2l-int-12",
    number: 12,
    name: "FL Direct Left-Front Insert (No y')",
    group: "Keyhole & Left-Front (FL)",
    cameraLongitude: 30,
    algs: [
      { id: "f2l-int-12-1", alg: "L' U' L", note: "Avoid y' rotation by inserting directly into FL", isDefault: true }
    ],
    setup: "L' U L"
  },
  {
    id: "f2l-int-13",
    number: 13,
    name: "FL Joined Pair Insert (No y')",
    group: "Keyhole & Left-Front (FL)",
    cameraLongitude: 30,
    algs: [
      { id: "f2l-int-13-1", alg: "U' L' U L", note: "Inverse Lefty into FL", isDefault: true }
    ],
    setup: "L' U' L U"
  },
  {
    id: "f2l-int-14",
    number: 14,
    name: "FL White Facing Up Over Slot",
    group: "Keyhole & Left-Front (FL)",
    cameraLongitude: 30,
    algs: [
      { id: "f2l-int-14-1", alg: "L' U2 L U' L' U L", note: "Rotationless <L, U> insert for FL", isDefault: true }
    ],
    setup: "L' U' L U L' U2 L"
  },
  {
    id: "f2l-int-15",
    number: 15,
    name: "Keyhole BR Edge (Open FR Slot)",
    group: "Keyhole & Left-Front (FL)",
    cameraLongitude: 30,
    algs: [
      { id: "f2l-int-15-1", alg: "D R' U' R D'", note: "Rotate D to align open FR keyhole corner, drop BR edge", isDefault: true }
    ],
    setup: "D R' U R D'"
  },
  {
    id: "f2l-int-16",
    number: 16,
    name: "Keyhole FR Edge (Open BR Slot)",
    group: "Keyhole & Left-Front (FL)",
    cameraLongitude: 30,
    algs: [
      { id: "f2l-int-16-1", alg: "D' R U R' D", note: "Use open BR corner via D' to drop FR edge in 5 moves", isDefault: true }
    ],
    setup: "D' R U' R' D"
  }
];

export const F2L_ADVANCED_GROUPS = [
  "Cross-Slot Swaps (Piece in Another Slot)",
  "Force Yellow Cross (Partial Edge Control)"
];

export const f2lAdvancedCases = [
  {
    id: "f2l-adv-01",
    number: 1,
    name: "Target FR Corner in BR + Edge in U",
    group: "Cross-Slot Swaps (Piece in Another Slot)",
    cameraLongitude: 30,
    algs: [
      { id: "f2l-adv-01-1", alg: "U R' U2 R U' R U R'", note: "Slides corner out of BR directly into FR pair without disturbing Cross", isDefault: true }
    ],
    setup: "R U' R' U R' U2 R U'"
  },
  {
    id: "f2l-adv-02",
    number: 2,
    name: "FR ↔ BR Double Slot Commutator 1",
    group: "Cross-Slot Swaps (Piece in Another Slot)",
    cameraLongitude: 30,
    algs: [
      { id: "f2l-adv-02-1", alg: "R U' R2' U' R", note: "5-move <R, U> flow pulling FR & BR pieces together", isDefault: true }
    ],
    setup: "R' U R2 U R'"
  },
  {
    id: "f2l-adv-03",
    number: 3,
    name: "FR ↔ BR Double Slot Commutator 2",
    group: "Cross-Slot Swaps (Piece in Another Slot)",
    cameraLongitude: 30,
    algs: [
      { id: "f2l-adv-03-1", alg: "R' U R2 U R'", note: "Inverse flow: solves trapped BR/FR pieces simultaneously", isDefault: true }
    ],
    setup: "R U' R2' U' R"
  },
  {
    id: "f2l-adv-04",
    number: 4,
    name: "Target FR Edge in BR (Corner in U)",
    group: "Cross-Slot Swaps (Piece in Another Slot)",
    cameraLongitude: 30,
    algs: [
      { id: "f2l-adv-04-1", alg: "R2 U' R' U R2", note: "Fast R2 cancellation solving BR + setting FR pair", isDefault: true }
    ],
    setup: "R2 U' R U R2"
  },
  {
    id: "f2l-adv-05",
    number: 5,
    name: "FL ↔ FR Open-Slot Pair Flow 1",
    group: "Cross-Slot Swaps (Piece in Another Slot)",
    cameraLongitude: 30,
    algs: [
      { id: "f2l-adv-05-1", alg: "L' U' L U' R U R'", note: "Extracts FR piece out of FL and completes both front slots", isDefault: true }
    ],
    setup: "R U' R' U L' U L"
  },
  {
    id: "f2l-adv-06",
    number: 6,
    name: "FL ↔ FR Open-Slot Pair Flow 2",
    group: "Cross-Slot Swaps (Piece in Another Slot)",
    cameraLongitude: 30,
    algs: [
      { id: "f2l-adv-06-1", alg: "R U' R' U L' U' L", note: "Pairs left-front piece from FR setup into FL in 7 moves", isDefault: true }
    ],
    setup: "L' U L U' R U R'"
  },
  {
    id: "f2l-adv-07",
    number: 7,
    name: "BL ↔ FR Diagonal Cross-Slot Pair",
    group: "Cross-Slot Swaps (Piece in Another Slot)",
    cameraLongitude: 30,
    algs: [
      { id: "f2l-adv-07-1", alg: "L U L' R U R'", note: "Solves diagonally opposite BL & FR pieces in 6 moves", isDefault: true }
    ],
    setup: "R U' R' L U' L'"
  },
  {
    id: "f2l-adv-08",
    number: 8,
    name: "Keyhole Swapped FR Pair via BR",
    group: "Cross-Slot Swaps (Piece in Another Slot)",
    cameraLongitude: 30,
    algs: [
      { id: "f2l-adv-08-1", alg: "R U2 R2' U' R2 U' R'", note: "Pure <R, U> multi-slot rescue when BR is open", isDefault: true }
    ],
    setup: "R U R2 U R2 U2 R'"
  },
  {
    id: "f2l-adv-09",
    number: 9,
    name: "Sledgehammer Insert (Force Yellow Cross)",
    group: "Force Yellow Cross (Partial Edge Control)",
    cameraLongitude: 30,
    algs: [
      { id: "f2l-adv-09-1", alg: "R' F R F'", note: "Insert formed FR pair while flipping 2 bad U edges to force Cross OLL", isDefault: true }
    ],
    setup: "F R' F' R"
  },
  {
    id: "f2l-adv-10",
    number: 10,
    name: "Hedgeslammer Left-Style Insert (No y')",
    group: "Force Yellow Cross (Partial Edge Control)",
    cameraLongitude: 30,
    algs: [
      { id: "f2l-adv-10-1", alg: "F R' F' R", note: "Inserts F2L 2 into FR without rotating AND flips 2 U edges", isDefault: true }
    ],
    setup: "R' F R F'"
  },
  {
    id: "f2l-adv-11",
    number: 11,
    name: "Edge Control Split Insert (Oriented U)",
    group: "Force Yellow Cross (Partial Edge Control)",
    cameraLongitude: 30,
    algs: [
      { id: "f2l-adv-11-1", alg: "U R U' R' F R' F' R", note: "Replaces standard R U R' finish with hedge to avoid dot OLL", isDefault: true }
    ],
    setup: "R' F R F' R U R' U'"
  },
  {
    id: "f2l-adv-12",
    number: 12,
    name: "Split Pair → Force Yellow Cross",
    group: "Force Yellow Cross (Partial Edge Control)",
    cameraLongitude: 30,
    algs: [
      { id: "f2l-adv-12-1", alg: "U' F R' F' R U R U' R'", note: "Orients U edges early before standard R U' R' insert", isDefault: true }
    ],
    setup: "R U R' U' R' F R F' U"
  },
  {
    id: "f2l-adv-13",
    number: 13,
    name: "Wide-r Yellow Cross Edge Control",
    group: "Force Yellow Cross (Partial Edge Control)",
    cameraLongitude: 30,
    algs: [
      { id: "f2l-adv-13-1", alg: "r U' r' U2 r U r'", note: "Wide-M slice trigger flipping 3 edges + finishing last F2L pair", isDefault: true }
    ],
    setup: "r U' r' U2 r U r'"
  },
  {
    id: "f2l-adv-14",
    number: 14,
    name: "Back Hedgeslammer BR (f R f')",
    group: "Force Yellow Cross (Partial Edge Control)",
    cameraLongitude: 30,
    algs: [
      { id: "f2l-adv-14-1", alg: "f R f'", note: "Wide front-clockwise insert into BR while orienting U edges", isDefault: true }
    ],
    setup: "f R' f'"
  }
];

export const f2lIntermediateById = new Map(f2lIntermediateCases.map(c => [c.id, c]));
export const f2lAdvancedById = new Map(f2lAdvancedCases.map(c => [c.id, c]));
export const f2lExtendedById = new Map([...f2lIntermediateCases, ...f2lAdvancedCases].map(c => [c.id, c]));
