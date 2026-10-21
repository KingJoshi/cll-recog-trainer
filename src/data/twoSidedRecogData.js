// 2-Sided Recognition Data and Guides for 3x3 PLL and OLL

export const PLL_TWO_SIDED_GUIDE = [
  {
    category: "No Headlights & No Bars",
    cases: ["E", "V", "Y", "Na", "Nb", "H", "Z"],
    summary: "Recognized by comparing corner-corner bookends and edge opposites across Front & Right faces.",
    rules: [
      {
        caseId: "E",
        name: "E-Perm (Diagonal Corners)",
        cue: "Opposite corner bookends on BOTH Front and Right. No headlights anywhere. Edges are solved relative to each other.",
        frontSight: "Opposite colors on Front corners",
        rightSight: "Opposite colors on Right corners"
      },
      {
        caseId: "V",
        name: "V-Perm (Adjacent Corner + Edge)",
        cue: "1x2 block hidden on back-left. Front and Right show 1 opposite corner pair and 1 solved corner-edge matching pair on the back.",
        frontSight: "No bars, 1 opposite bookend",
        rightSight: "Opposite corner and edge mismatch"
      },
      {
        caseId: "Y",
        name: "Y-Perm (Diagonal Corners + Adjacent Edges)",
        cue: "A corner-edge matching pair exists, but corners are diagonal. Looking at F & R shows a checker-like alternating pattern with corner opposite to edge.",
        frontSight: "Corner opposite to edge",
        rightSight: "Alternating colors, no headlights"
      },
      {
        caseId: "H",
        name: "H-Perm (Opposite Edges)",
        cue: "Headlights on ALL corners! All 4 edges are opposite to their corner colors (pure checkerboard on all sides).",
        frontSight: "Matching corners + opposite center edge (Checker)",
        rightSight: "Matching corners + opposite center edge (Checker)"
      },
      {
        caseId: "Z",
        name: "Z-Perm (Adjacent Edges)",
        cue: "Headlights on ALL corners! The front edge matches the right corners, and the right edge matches the front corners.",
        frontSight: "Matching corners + edge belongs to adjacent face",
        rightSight: "Matching corners + edge belongs to front face"
      },
      {
        caseId: "Na",
        name: "Na-Perm (Opposite 1x2 Bars on L/B)",
        cue: "Checker pattern on Front. Two opposite corners are swapped with adjacent edges.",
        frontSight: "Full alternating color checker",
        rightSight: "Opposite bookends"
      },
      {
        caseId: "Nb",
        name: "Nb-Perm (Opposite 1x2 Bars on F/R)",
        cue: "1x2 bar on Back-Right and Front-Left. Checker pattern visible on Right face.",
        frontSight: "Opposite bookends",
        rightSight: "Full alternating color checker"
      }
    ]
  },
  {
    category: "Headlights on One Face",
    cases: ["T", "F", "Ja", "Jb", "Ra", "Rb", "Ga", "Gb", "Gc", "Gd"],
    summary: "Look at whether headlights are on Front or Right, and check where the 1x2 bar or opposites are located.",
    rules: [
      {
        caseId: "T",
        name: "T-Perm (Adjacent Corners & Edges)",
        cue: "Headlights on Right. Front shows a 1x2 bar on the left with opposite corner on right (or headlights on Front with opposites on Right).",
        frontSight: "Opposite bookends + center edge matches left corner",
        rightSight: "Headlights (matching corners) + opposite center edge"
      },
      {
        caseId: "F",
        name: "F-Perm (1x3 Solid Bar on Front or Left)",
        cue: "A complete 1x3 solid bar on Front! Right face shows headlights with a non-matching center edge.",
        frontSight: "Solid 1x3 solved bar",
        rightSight: "Headlights with opposite or adjacent edge"
      },
      {
        caseId: "Ja",
        name: "Ja-Perm (1x3 Bar on Left)",
        cue: "Headlights on Front. Right face has a 1x2 block at the back corner.",
        frontSight: "Headlights on Front",
        rightSight: "1x2 bar attached to Back corner"
      },
      {
        caseId: "Jb",
        name: "Jb-Perm (1x3 Bar on Right)",
        cue: "A complete 1x3 solid bar on Right! Front face has matching corner-edge pair on the right.",
        frontSight: "Headlights or 1x2 bar on right",
        rightSight: "Solid 1x3 solved bar"
      },
      {
        caseId: "Ra",
        name: "Ra-Perm (Adjacent Corners + Swap)",
        cue: "Headlights on Left (hidden). Front has a 1x2 bar on left, Right has matching adjacent colors.",
        frontSight: "1x2 bar on left side",
        rightSight: "Corner matches edge, outer corner opposite"
      },
      {
        caseId: "Rb",
        name: "Rb-Perm (Adjacent Corners + Swap)",
        cue: "Headlights on Front! Right face has a 1x2 bar in the back and opposite corner in front.",
        frontSight: "Headlights on Front",
        rightSight: "Opposite corner to center edge + rear block"
      },
      {
        caseId: "Ga",
        name: "Ga-Perm (G-Permutation A)",
        cue: "Headlights on Left (hidden). Front shows a 1x2 block on the right. Right face has opposite bookends.",
        frontSight: "1x2 block on front-right corner",
        rightSight: "Opposite corner bookends"
      },
      {
        caseId: "Gb",
        name: "Gb-Perm (G-Permutation B)",
        cue: "Headlights on Front! Right face shows a 1x2 block on the front corner.",
        frontSight: "Headlights on Front",
        rightSight: "1x2 block on front-right corner"
      },
      {
        caseId: "Gc",
        name: "Gc-Perm (G-Permutation C)",
        cue: "Headlights on Right! Front face has opposite corner bookends with edge matching left.",
        frontSight: "Opposite corner bookends",
        rightSight: "Headlights on Right"
      },
      {
        caseId: "Gd",
        name: "Gd-Perm (G-Permutation D)",
        cue: "Headlights on Front! Right face has a 1x2 block on the back corner.",
        frontSight: "Headlights on Front",
        rightSight: "1x2 block on rear-right corner"
      }
    ]
  },
  {
    category: "Adjacent Corner Swaps (Aa & Ab)",
    cases: ["Aa", "Ab"],
    summary: "Recognized by comparing the 1x2 solved bar with headlights on the adjacent or back face.",
    rules: [
      {
        caseId: "Aa",
        name: "Aa-Perm (Adjacent Corner Swap A)",
        cue: "Headlights on Left (hidden). Front face has a 1x2 block on the front-left corner. Right face has no bar with opposite bookends.",
        frontSight: "1x2 bar on front-left",
        rightSight: "Opposite bookends, no bar"
      },
      {
        caseId: "Ab",
        name: "Ab-Perm (Adjacent Corner Swap B)",
        cue: "Headlights on Back (hidden). Front face has opposite corner bookends. Right face shows a 1x2 block on the rear-right corner.",
        frontSight: "Opposite corner bookends",
        rightSight: "1x2 bar on rear-right corner"
      }
    ]
  },
  {
    category: "3-Edge Cycles (Ua & Ub)",
    cases: ["Ua", "Ub"],
    summary: "All 4 corners solved (headlights on ALL 4 sides!). One side has a complete 1x3 solid bar.",
    rules: [
      {
        caseId: "Ua",
        name: "Ua-Perm (Counter-Clockwise Cycle)",
        cue: "Headlights on all faces. If 1x3 bar is on Back: Front edge is opposite to front corners. If bar on Left: Front edge belongs to Right.",
        frontSight: "Headlights with opposite edge",
        rightSight: "Headlights with adjacent edge"
      },
      {
        caseId: "Ub",
        name: "Ub-Perm (Clockwise Cycle)",
        cue: "Headlights on all faces. If 1x3 bar is on Back: Front edge matches the right side corners.",
        frontSight: "Headlights with right-matching edge",
        rightSight: "Headlights with opposite edge"
      }
    ]
  }
];

export const OLL_TWO_SIDED_GUIDE = [
  {
    category: "Cross Shapes (All 4 Edges Oriented)",
    cases: ["Sune", "Anti-Sune", "H", "Pi", "Headlights (U)", "Chameleon (T)", "Bowtie (L)"],
    rules: [
      {
        caseName: "Sune (OLL 27)",
        cue: "1 yellow corner oriented on top (at Back-Right or Front-Left). Front face has a yellow sticker on the left corner facing front.",
        recognition: "Top: 1 corner yellow. Front: Left corner is Yellow."
      },
      {
        caseName: "Anti-Sune (OLL 26)",
        cue: "1 yellow corner oriented on top. Right face has a yellow sticker on the back corner facing right.",
        recognition: "Top: 1 corner yellow. Right: Back corner is Yellow."
      },
      {
        caseName: "H (OLL 21)",
        cue: "0 corners oriented on top. Front and Back faces have 2 yellow stickers each (double headlights).",
        recognition: "Top: Cross only. Front: 2 yellow headlights. Right: No yellow."
      },
      {
        caseName: "Pi (OLL 22)",
        cue: "0 corners oriented on top. Front has 2 yellow headlights; Right face has 1 yellow corner on front facing right.",
        recognition: "Top: Cross only. Front: 2 yellow headlights. Right: 1 yellow facing right."
      },
      {
        caseName: "Chameleon (OLL 25 / T)",
        cue: "2 adjacent corners oriented on top. Front face has 1 yellow sticker on left, Right face has 1 yellow on right.",
        recognition: "Top: 2 adjacent corners yellow. Front: Left corner yellow."
      },
      {
        caseName: "Bowtie (OLL 24 / L)",
        cue: "2 diagonal corners oriented on top. Front face has 1 yellow sticker facing front.",
        recognition: "Top: Diagonal corners yellow. Front: 1 corner yellow."
      }
    ]
  }
];
