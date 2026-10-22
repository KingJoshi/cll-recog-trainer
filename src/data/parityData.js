// 4x4 and 5x5 Parity and Last-Layer / Last-Edge Algorithms Data

export const parity444Cases = [
  {
    id: "444-oll-parity",
    name: "4x4 OLL Parity (Single Dedge Flip)",
    shortName: "OLL Parity",
    group: "OLL Parity",
    puzzle: "444",
    description: "One edge pair (dedge) is flipped on the last layer. Occurs on 50% of 4x4 solves due to odd internal slice permutations.",
    setup: "Rw U2 x Rw U2 Rw U2 Rw' U2 Lw U2 Rw' U2 Rw U2 Rw' U2 Rw'",
    scramble: "Rw U2 x Rw U2 Rw U2 Rw' U2 Lw U2 Rw' U2 Rw U2 Rw' U2 Rw'",
    scrambles: [
      "Rw U2 x Rw U2 Rw U2 Rw' U2 Lw U2 Rw' U2 Rw U2 Rw' U2 Rw'",
      "U Rw U2 x Rw U2 Rw U2 Rw' U2 Lw U2 Rw' U2 Rw U2 Rw' U2 Rw' U'",
      "U' Rw U2 x Rw U2 Rw U2 Rw' U2 Lw U2 Rw' U2 Rw U2 Rw' U2 Rw' U",
      "U2 Rw U2 x Rw U2 Rw U2 Rw' U2 Lw U2 Rw' U2 Rw U2 Rw' U2 Rw' U2",
      "y Rw U2 x Rw U2 Rw U2 Rw' U2 Lw U2 Rw' U2 Rw U2 Rw' U2 Rw'",
      "y' Rw U2 x Rw U2 Rw U2 Rw' U2 Lw U2 Rw' U2 Rw U2 Rw' U2 Rw'",
      "y2 Rw U2 x Rw U2 Rw U2 Rw' U2 Lw U2 Rw' U2 Rw U2 Rw' U2 Rw'"
    ],
    alg: "Rw U2 x Rw U2 Rw U2 Rw' U2 Lw U2 Rw' U2 Rw U2 Rw' U2 Rw'",
    algs: [
      {
        id: "444-oll-std",
        alg: "Rw U2 x Rw U2 Rw U2 Rw' U2 Lw U2 Rw' U2 Rw U2 Rw' U2 Rw'",
        note: "Standard speedcubing OLL parity (fast fingertricks, R/U/L wide turns)"
      },
      {
        id: "444-oll-alt",
        alg: "Rw' U2 Lw F2 Lw' F2 Rw2 U2 Rw U2 Rw' U2 F2 Rw2 F2",
        note: "Alternative RU/LF-gen variation (no x rotation)"
      }
    ]
  },
  {
    id: "444-pll-parity-opp",
    name: "4x4 PLL Parity (Opposite Edges Swap)",
    shortName: "Opposite",
    group: "PLL Parity",
    puzzle: "444",
    description: "Two opposite edge pairs need to be swapped on the last layer without affecting corners. Occurs on 50% of 4x4 solves.",
    setup: "2R2 U2 2R2 Uw2 2R2 Uw2",
    scramble: "2R2 U2 2R2 Uw2 2R2 Uw2",
    scrambles: [
      "2R2 U2 2R2 Uw2 2R2 Uw2",
      "U 2R2 U2 2R2 Uw2 2R2 Uw2 U'",
      "U' 2R2 U2 2R2 Uw2 2R2 Uw2 U",
      "U2 2R2 U2 2R2 Uw2 2R2 Uw2 U2",
      "y 2R2 U2 2R2 Uw2 2R2 Uw2",
      "y' 2R2 U2 2R2 Uw2 2R2 Uw2",
      "y2 2R2 U2 2R2 Uw2 2R2 Uw2"
    ],
    alg: "2R2 U2 2R2 Uw2 2R2 Uw2",
    algs: [
      {
        id: "444-pll-opp-std",
        alg: "2R2 U2 2R2 Uw2 2R2 Uw2",
        note: "Super-fast slice parity: inner right slice twice, U2, inner right slice twice, both top slices (Uw2), inner right slice twice, Uw2"
      },
      {
        id: "444-pll-opp-wide",
        alg: "Rw2 R2 U2 Rw2 R2 Uw2 Rw2 R2 Uw2",
        note: "Wide/outer turn notation equivalent for cubes where inner slicing is awkward"
      }
    ]
  },
  {
    id: "444-pll-parity-adj",
    name: "4x4 PLL Parity (Adjacent Edges Swap)",
    shortName: "Adjacent",
    group: "PLL Parity",
    puzzle: "444",
    description: "Two adjacent edge pairs need to be swapped. Executed as a setup into opposite PLL parity or cancelled sequence.",
    setup: "R U R' U' 2R2 U2 2R2 Uw2 2R2 Uw2 U R U' R'",
    scramble: "R U R' U' 2R2 U2 2R2 Uw2 2R2 Uw2 U R U' R'",
    scrambles: [
      "R U R' U' 2R2 U2 2R2 Uw2 2R2 Uw2 U R U' R'",
      "U R U R' U' 2R2 U2 2R2 Uw2 2R2 Uw2 U R U' R' U'",
      "U' R U R' U' 2R2 U2 2R2 Uw2 2R2 Uw2 U R U' R' U",
      "U2 R U R' U' 2R2 U2 2R2 Uw2 2R2 Uw2 U R U' R' U2",
      "y R U R' U' 2R2 U2 2R2 Uw2 2R2 Uw2 U R U' R'",
      "y' R U R' U' 2R2 U2 2R2 Uw2 2R2 Uw2 U R U' R'",
      "y2 R U R' U' 2R2 U2 2R2 Uw2 2R2 Uw2 U R U' R'"
    ],
    alg: "R U R' U' 2R2 U2 2R2 Uw2 2R2 Uw2 U R U' R'",
    algs: [
      {
        id: "444-pll-adj-std",
        alg: "R U R' U' 2R2 U2 2R2 Uw2 2R2 Uw2 U R U' R'",
        note: "Sexy-move setup into opposite PLL parity + reverse sexy setup"
      }
    ]
  }
];

export const parity555Cases = [
  {
    id: "555-edge-parity-flip",
    name: "5x5 Middle Edge Flip (Lucas Parity)",
    shortName: "Middle Flip",
    group: "L2E Parity",
    puzzle: "555",
    description: "The middle edge (midge) of the last dedge is flipped during Last Two Edges (L2E).",
    setup: "Rw U2 x Rw U2 Rw U2 Rw' U2 Lw U2 3Rw' U2 Rw U2 Rw' U2 Rw'",
    scramble: "Rw U2 x Rw U2 Rw U2 Rw' U2 Lw U2 3Rw' U2 Rw U2 Rw' U2 Rw'",
    scrambles: [
      "Rw U2 x Rw U2 Rw U2 Rw' U2 Lw U2 3Rw' U2 Rw U2 Rw' U2 Rw'",
      "U Rw U2 x Rw U2 Rw U2 Rw' U2 Lw U2 3Rw' U2 Rw U2 Rw' U2 Rw' U'",
      "U' Rw U2 x Rw U2 Rw U2 Rw' U2 Lw U2 3Rw' U2 Rw U2 Rw' U2 Rw' U",
      "U2 Rw U2 x Rw U2 Rw U2 Rw' U2 Lw U2 3Rw' U2 Rw U2 Rw' U2 Rw' U2",
      "y Rw U2 x Rw U2 Rw U2 Rw' U2 Lw U2 3Rw' U2 Rw U2 Rw' U2 Rw'",
      "y' Rw U2 x Rw U2 Rw U2 Rw' U2 Lw U2 3Rw' U2 Rw U2 Rw' U2 Rw'",
      "y2 Rw U2 x Rw U2 Rw U2 Rw' U2 Lw U2 3Rw' U2 Rw U2 Rw' U2 Rw'"
    ],
    alg: "Rw U2 x Rw U2 Rw U2 Rw' U2 Lw U2 3Rw' U2 Rw U2 Rw' U2 Rw'",
    algs: [
      {
        id: "555-flip-std",
        alg: "Rw U2 x Rw U2 Rw U2 Rw' U2 Lw U2 3Rw' U2 Rw U2 Rw' U2 Rw'",
        note: "Standard 5x5 middle edge flip parity (similar to 4x4 OLL with 3Rw' slice)"
      },
      {
        id: "555-flip-lucas",
        alg: "Rw2 B2 U2 Lw U2 Rw' U2 Rw U2 F2 Rw F2 Lw' B2 Rw2",
        note: "Classic Lucas Parity algorithm (preserves outer face orientation)"
      }
    ]
  },
  {
    id: "555-wing-swap",
    name: "5x5 Wing Edges Swap (L2E)",
    shortName: "Wing Swap",
    group: "L2E Parity",
    puzzle: "555",
    description: "Swap wing edge pieces between the final two edge groups to complete 5x5 reduction.",
    setup: "Uw' R U R' F R' F' R Uw",
    scramble: "Uw' R U R' F R' F' R Uw",
    scrambles: [
      "Uw' R U R' F R' F' R Uw",
      "U Uw' R U R' F R' F' R Uw U'",
      "U' Uw' R U R' F R' F' R Uw U",
      "U2 Uw' R U R' F R' F' R Uw U2",
      "y Uw' R U R' F R' F' R Uw",
      "y' Uw' R U R' F R' F' R Uw",
      "y2 Uw' R U R' F R' F' R Uw"
    ],
    alg: "Uw' R U R' F R' F' R Uw",
    algs: [
      {
        id: "555-wing-flip",
        alg: "Uw' R U R' F R' F' R Uw",
        note: "Slice-Flip-Slice: slice inner layer, flip edge using standard speedcube flipper, un-slice"
      }
    ]
  }
];

export const parity444CaseById = new Map(parity444Cases.map(c => [c.id, c]));
export const parity555CaseById = new Map(parity555Cases.map(c => [c.id, c]));
