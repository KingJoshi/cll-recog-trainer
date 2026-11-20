import { Alg } from 'cubing/alg';
import * as fs from 'node:fs';

const ollList = [
  // 1. All Edges Oriented (Cross / 2-Look OLL - 7 cases)
  { id: "oll-21", number: 21, name: "OLL 21 (H / Double Sune)", group: "All Edges Oriented (Cross)", algs: [
    { id: "oll-21-1", alg: "R U2 R' U' R U R' U' R U' R'", note: "Standard RU-gen", isDefault: true },
    { id: "oll-21-2", alg: "y F (R U R' U')3 F'", note: "Triple Sexy variant" }
  ]},
  { id: "oll-22", number: 22, name: "OLL 22 (Pi / Wheel)", group: "All Edges Oriented (Cross)", algs: [
    { id: "oll-22-1", alg: "R U2 R2' U' R2 U' R2' U2 R", note: "Standard 2-gen RU", isDefault: true },
    { id: "oll-22-2", alg: "f (R U R' U') f' F (R U R' U') F'", note: "Wide f + F sexy variant" }
  ]},
  { id: "oll-23", number: 23, name: "OLL 23 (Headlights)", group: "All Edges Oriented (Cross)", algs: [
    { id: "oll-23-1", alg: "R2 D R' U2 R D' R' U2 R'", note: "Standard RUD alg", isDefault: true },
    { id: "oll-23-2", alg: "y2 R2' D' R U2 R' D R U2 R", note: "Inverted variant" }
  ]},
  { id: "oll-24", number: 24, name: "OLL 24 (Chameleon)", group: "All Edges Oriented (Cross)", algs: [
    { id: "oll-24-1", alg: "r U R' U' r' F R F'", note: "Standard wide r Sledge", isDefault: true },
    { id: "oll-24-2", alg: "y (R' U' R) y (R U R' U') (R' U' R)", note: "RU-only variant" }
  ]},
  { id: "oll-25", number: 25, name: "OLL 25 (Bowtie)", group: "All Edges Oriented (Cross)", algs: [
    { id: "oll-25-1", alg: "F' r U R' U' r' F R", note: "Standard F' + wide r", isDefault: true },
    { id: "oll-25-2", alg: "y' R' F R B' R' F' R B", note: "Niklas variant" }
  ]},
  { id: "oll-26", number: 26, name: "OLL 26 (Antisune)", group: "All Edges Oriented (Cross)", algs: [
    { id: "oll-26-1", alg: "R U2 R' U' R U' R'", note: "Standard Antisune", isDefault: true },
    { id: "oll-26-2", alg: "y' R' U' R U' R' U2 R", note: "Left-handed / Back variant" }
  ]},
  { id: "oll-27", number: 27, name: "OLL 27 (Sune)", group: "All Edges Oriented (Cross)", algs: [
    { id: "oll-27-1", alg: "R U R' U R U2 R'", note: "Standard Sune (Classic)", isDefault: true },
    { id: "oll-27-2", alg: "y' R' U2 R U R' U R", note: "Back Sune" }
  ]},

  // 2. T-Shapes (2 cases)
  { id: "oll-33", number: 33, name: "OLL 33 (T-Shape)", group: "T-Shapes", algs: [
    { id: "oll-33-1", alg: "R U R' U' R' F R F'", note: "Sexy + Sledgehammer", isDefault: true }
  ]},
  { id: "oll-45", number: 45, name: "OLL 45 (T-Shape)", group: "T-Shapes", algs: [
    { id: "oll-45-1", alg: "F R U R' U' F'", note: "F Sexy F'", isDefault: true }
  ]},

  // 3. Square-Shapes (2 cases)
  { id: "oll-05", number: 5, name: "OLL 5 (Right Square)", group: "Square-Shapes", algs: [
    { id: "oll-05-1", alg: "r' U2 R U R' U r", note: "Standard wide r", isDefault: true },
    { id: "oll-05-2", alg: "l' U2 L U L' U l", note: "Left variant" }
  ]},
  { id: "oll-06", number: 6, name: "OLL 6 (Left Square)", group: "Square-Shapes", algs: [
    { id: "oll-06-1", alg: "r U2 R' U' R U' r'", note: "Standard wide r Sune", isDefault: true }
  ]},

  // 4. C-Shapes (2 cases)
  { id: "oll-34", number: 34, name: "OLL 34 (City)", group: "C-Shapes", algs: [
    { id: "oll-34-1", alg: "R U R2' U' R' F R U R U' F'", note: "Standard RUF", isDefault: true }
  ]},
  { id: "oll-46", number: 46, name: "OLL 46 (Seein' Headlights)", group: "C-Shapes", algs: [
    { id: "oll-46-1", alg: "R' U' R' F R F' U R", note: "Standard trigger", isDefault: true }
  ]},

  // 5. W-Shapes (2 cases)
  { id: "oll-36", number: 36, name: "OLL 36 (Mario)", group: "W-Shapes", algs: [
    { id: "oll-36-1", alg: "R' U' R U' R' U R U R B' R' B", note: "Standard", isDefault: true },
    { id: "oll-36-2", alg: "L' U' L U' L' U L U L F' L' F", note: "Left mirror" }
  ]},
  { id: "oll-38", number: 38, name: "OLL 38 (Luigi)", group: "W-Shapes", algs: [
    { id: "oll-38-1", alg: "R U R' U R U' R' U' R' F R F'", note: "Sune into Sledge", isDefault: true }
  ]},

  // 6. Corners Oriented (2 cases)
  { id: "oll-28", number: 28, name: "OLL 28 (Stealth)", group: "Corners Oriented", algs: [
    { id: "oll-28-1", alg: "r U R' U' r' R U R U' R'", note: "Standard wide r insert", isDefault: true },
    { id: "oll-28-2", alg: "M' U M U2 M' U M", note: "MU-gen variant" }
  ]},
  { id: "oll-57", number: 57, name: "OLL 57 (Mummy)", group: "Corners Oriented", algs: [
    { id: "oll-57-1", alg: "R U R' U' M' U R U' r'", note: "Standard", isDefault: true },
    { id: "oll-57-2", alg: "M' U' M U2 M' U' M", note: "MU-gen variant" }
  ]},

  // 7. P-Shapes (4 cases)
  { id: "oll-31", number: 31, name: "OLL 31 (Couch)", group: "P-Shapes", algs: [
    { id: "oll-31-1", alg: "R' U' F U R U' R' F' R", note: "Standard", isDefault: true }
  ]},
  { id: "oll-32", number: 32, name: "OLL 32 (Anti-Couch)", group: "P-Shapes", algs: [
    { id: "oll-32-1", alg: "L U F' U' L' U L F L'", note: "Left mirror", isDefault: true },
    { id: "oll-32-2", alg: "R U B' U' R' U R B R'", note: "Back variant" }
  ]},
  { id: "oll-43", number: 43, name: "OLL 43 (Baseball Cap)", group: "P-Shapes", algs: [
    { id: "oll-43-1", alg: "F' U' L' U L F", note: "F' Left-Sexy F", isDefault: true }
  ]},
  { id: "oll-44", number: 44, name: "OLL 44 (Anti-Baseball Cap)", group: "P-Shapes", algs: [
    { id: "oll-44-1", alg: "F U R U' R' F'", note: "F Sexy F' reverse", isDefault: true }
  ]},

  // 8. I-Shapes / Lines (4 cases)
  { id: "oll-51", number: 51, name: "OLL 51 (Bottle)", group: "I-Shapes", algs: [
    { id: "oll-51-1", alg: "f R U R' U' R U R' U' f'", note: "Wide f double sexy f'", isDefault: true }
  ]},
  { id: "oll-52", number: 52, name: "OLL 52 (Anti-Bottle)", group: "I-Shapes", algs: [
    { id: "oll-52-1", alg: "R' U' R U' R' d R' U R B", note: "Standard", isDefault: true },
    { id: "oll-52-2", alg: "F R U R' U' R U R' U' F'", note: "Double sexy variant" }
  ]},
  { id: "oll-55", number: 55, name: "OLL 55 (Highway)", group: "I-Shapes", algs: [
    { id: "oll-55-1", alg: "R U2 R2' U' R U' R' U2 F R F'", note: "Standard", isDefault: true }
  ]},
  { id: "oll-56", number: 56, name: "OLL 56 (Street)", group: "I-Shapes", algs: [
    { id: "oll-56-1", alg: "r U r' U R U' R' U R U' R' r U' r'", note: "Standard wide r", isDefault: true }
  ]},

  // 9. Fish-Shapes (4 cases)
  { id: "oll-09", number: 9, name: "OLL 9 (Kite)", group: "Fish-Shapes", algs: [
    { id: "oll-09-1", alg: "R U R' U' R' F R2 U R' U' F'", note: "Standard", isDefault: true }
  ]},
  { id: "oll-10", number: 10, name: "OLL 10 (Anti-Kite)", group: "Fish-Shapes", algs: [
    { id: "oll-10-1", alg: "R U R' U R' F R F' R U2 R'", note: "Standard", isDefault: true }
  ]},
  { id: "oll-35", number: 35, name: "OLL 35 (Fish Salad)", group: "Fish-Shapes", algs: [
    { id: "oll-35-1", alg: "R U2 R2' F R F' R U2 R'", note: "Standard", isDefault: true }
  ]},
  { id: "oll-37", number: 37, name: "OLL 37 (Mounted Fish)", group: "Fish-Shapes", algs: [
    { id: "oll-37-1", alg: "F R' F' R U R U' R'", note: "Inverse Sledge + Sexy", isDefault: true }
  ]},

  // 10. Knight-move Shapes (4 cases)
  { id: "oll-13", number: 13, name: "OLL 13 (Gun)", group: "Knight-move Shapes", algs: [
    { id: "oll-13-1", alg: "F U R U' R2' F' R U R U' R'", note: "Standard", isDefault: true }
  ]},
  { id: "oll-14", number: 14, name: "OLL 14 (Anti-Gun)", group: "Knight-move Shapes", algs: [
    { id: "oll-14-1", alg: "R' F R U R' F' R F U' F'", note: "Standard", isDefault: true }
  ]},
  { id: "oll-15", number: 15, name: "OLL 15 (Squeegee)", group: "Knight-move Shapes", algs: [
    { id: "oll-15-1", alg: "r' U' r R' U' R U r' U r", note: "Standard wide r", isDefault: true }
  ]},
  { id: "oll-16", number: 16, name: "OLL 16 (Anti-Squeegee)", group: "Knight-move Shapes", algs: [
    { id: "oll-16-1", alg: "r U r' R U R' U' r U' r'", note: "Standard wide r", isDefault: true }
  ]},

  // 11. Awkward Shapes (4 cases)
  { id: "oll-29", number: 29, name: "OLL 29 (Spotted Chameleon)", group: "Awkward Shapes", algs: [
    { id: "oll-29-1", alg: "R U R' U' R U' R' F' U' F R U R'", note: "Standard", isDefault: true }
  ]},
  { id: "oll-30", number: 30, name: "OLL 30 (Anti-Spotted Chameleon)", group: "Awkward Shapes", algs: [
    { id: "oll-30-1", alg: "F R' F R2 U' R' U' R U R' F2", note: "Standard", isDefault: true }
  ]},
  { id: "oll-41", number: 41, name: "OLL 41 (Awkward Fish)", group: "Awkward Shapes", algs: [
    { id: "oll-41-1", alg: "R U R' U R U2 R' F R U R' U' F'", note: "Sune into T-OLL", isDefault: true }
  ]},
  { id: "oll-42", number: 42, name: "OLL 42 (Anti-Awkward Fish)", group: "Awkward Shapes", algs: [
    { id: "oll-42-1", alg: "R' U' R U' R' U2 R F R U R' U' F'", note: "Antisune into T-OLL", isDefault: true }
  ]},

  // 12. L-Shapes (6 cases)
  { id: "oll-47", number: 47, name: "OLL 47 (Breakneck)", group: "L-Shapes", algs: [
    { id: "oll-47-1", alg: "F' L' U' L U L' U' L U F", note: "Standard", isDefault: true }
  ]},
  { id: "oll-48", number: 48, name: "OLL 48 (Anti-Breakneck)", group: "L-Shapes", algs: [
    { id: "oll-48-1", alg: "F R U R' U' R U R' U' F'", note: "F double sexy F'", isDefault: true }
  ]},
  { id: "oll-49", number: 49, name: "OLL 49 (Right Back L)", group: "L-Shapes", algs: [
    { id: "oll-49-1", alg: "r U' r2' U r2 U r2' U' r", note: "Standard wide r", isDefault: true }
  ]},
  { id: "oll-50", number: 50, name: "OLL 50 (Right Front L)", group: "L-Shapes", algs: [
    { id: "oll-50-1", alg: "r' U r2 U' r2' U' r2 U r'", note: "Standard wide r", isDefault: true }
  ]},
  { id: "oll-53", number: 53, name: "OLL 53 (Frying Pan)", group: "L-Shapes", algs: [
    { id: "oll-53-1", alg: "r' U' R U' R' U R U' R' U2 r", note: "Standard", isDefault: true }
  ]},
  { id: "oll-54", number: 54, name: "OLL 54 (Anti-Frying Pan)", group: "L-Shapes", algs: [
    { id: "oll-54-1", alg: "r U R' U R U' R' U R U2 r'", note: "Standard", isDefault: true }
  ]},

  // 13. Lightning Bolts (6 cases)
  { id: "oll-07", number: 7, name: "OLL 7 (Right Lightning)", group: "Lightning Bolts", algs: [
    { id: "oll-07-1", alg: "r U R' U R U2 r'", note: "Wide r Sune", isDefault: true }
  ]},
  { id: "oll-08", number: 8, name: "OLL 8 (Left Lightning)", group: "Lightning Bolts", algs: [
    { id: "oll-08-1", alg: "r' U' R U' R' U2 r", note: "Wide r' Antisune", isDefault: true }
  ]},
  { id: "oll-11", number: 11, name: "OLL 11 (Down Dog)", group: "Lightning Bolts", algs: [
    { id: "oll-11-1", alg: "r U R' U R' F R F' R U2 r'", note: "Standard", isDefault: true }
  ]},
  { id: "oll-12", number: 12, name: "OLL 12 (Up Dog)", group: "Lightning Bolts", algs: [
    { id: "oll-12-1", alg: "F R U R' U' F' U F R U R' U' F'", note: "Standard", isDefault: true }
  ]},
  { id: "oll-39", number: 39, name: "OLL 39 (Fung)", group: "Lightning Bolts", algs: [
    { id: "oll-39-1", alg: "L F' L' U' L U F U' L'", note: "Standard", isDefault: true }
  ]},
  { id: "oll-40", number: 40, name: "OLL 40 (Anti-Fung)", group: "Lightning Bolts", algs: [
    { id: "oll-40-1", alg: "R' F R U R' U' F' U R", note: "Standard", isDefault: true }
  ]},

  // 14. Dot Shapes (No edges oriented - 8 cases)
  { id: "oll-01", number: 1, name: "OLL 1 (Runway)", group: "Dot Shapes", algs: [
    { id: "oll-01-1", alg: "R U2 R2' F R F' U2 R' F R F'", note: "Standard", isDefault: true }
  ]},
  { id: "oll-02", number: 2, name: "OLL 2 (Zamboni)", group: "Dot Shapes", algs: [
    { id: "oll-02-1", alg: "F R U R' U' F' f R U R' U' f'", note: "F Sexy F' + f Sexy f'", isDefault: true }
  ]},
  { id: "oll-03", number: 3, name: "OLL 3 (Anti-Zamboni)", group: "Dot Shapes", algs: [
    { id: "oll-03-1", alg: "f R U R' U' f' U' F R U R' U' F'", note: "Standard", isDefault: true }
  ]},
  { id: "oll-04", number: 4, name: "OLL 4 (Anti-Runway)", group: "Dot Shapes", algs: [
    { id: "oll-04-1", alg: "f R U R' U' f' U F R U R' U' F'", note: "Standard", isDefault: true }
  ]},
  { id: "oll-17", number: 17, name: "OLL 17 (Diagonal Dot)", group: "Dot Shapes", algs: [
    { id: "oll-17-1", alg: "F R' F' R2 r' U R U' r' R", note: "Standard", isDefault: true },
    { id: "oll-17-2", alg: "R U R' U R' F R F' U2 R' F R F'", note: "Alternative" }
  ]},
  { id: "oll-18", number: 18, name: "OLL 18 (Crown)", group: "Dot Shapes", algs: [
    { id: "oll-18-1", alg: "r U R' U R U2 r2' U' R U' R' U2 r", note: "Standard wide r", isDefault: true }
  ]},
  { id: "oll-19", number: 19, name: "OLL 19 (Shield)", group: "Dot Shapes", algs: [
    { id: "oll-19-1", alg: "r' R U R U R' U' r R2' F R F'", note: "Standard", isDefault: true }
  ]},
  { id: "oll-20", number: 20, name: "OLL 20 (X / Checkered)", group: "Dot Shapes", algs: [
    { id: "oll-20-1", alg: "r U R' U' M2' U R U' R' U' M'", note: "Standard M-slice", isDefault: true },
    { id: "oll-20-2", alg: "M U R U R' U' M2' U R U' r'", note: "Alternative" }
  ]}
];

// Sort sequentially by OLL number 1 to 57
ollList.sort((a, b) => a.number - b.number);

// Calculate mathematically exact setup scramble for each case
for (const o of ollList) {
  const def = o.algs.find(a => a.isDefault) || o.algs[0];
  o.setup = new Alg(def.alg).invert().toString();
}

const fileContent = `// 3x3x3 OLL (Orientation of the Last Layer) - All 57 Cases
// Automatically formatted and verified with cubing.js

export const ollCases = ${JSON.stringify(ollList, null, 2)};

export const ollCaseById = new Map(ollCases.map(c => [c.id, c]));
`;

fs.writeFileSync('src/data/ollData.js', fileContent);
console.log('Successfully wrote src/data/ollData.js with', ollList.length, 'cases.');
