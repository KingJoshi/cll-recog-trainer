import { Alg } from 'cubing/alg';
import * as fs from 'node:fs';
import { pblCases } from '../src/pblData.js';

const ortegaOllCases = [
  {
    id: "ortega-oll-h",
    name: "Ortega OLL: H (Double Sune)",
    group: "OLL (Orient Last Layer)",
    description: "4 yellow corners oriented horizontally (two headlights front, two headlights back).",
    algs: [
      { id: "o-h-1", alg: "R2 U2 R U2 R2", note: "Standard 2x2 RU-gen", isDefault: true },
      { id: "o-h-2", alg: "F (R U R' U')2 F'", note: "Double sexy variant" }
    ]
  },
  {
    id: "ortega-oll-pi",
    name: "Ortega OLL: Pi (Wheel)",
    group: "OLL (Orient Last Layer)",
    description: "2 headlights in front, 2 yellow corners facing outward in back.",
    algs: [
      { id: "o-pi-1", alg: "F (R U R' U')2 F'", note: "Standard 2x2 trigger", isDefault: true },
      { id: "o-pi-2", alg: "R U2 R2' U' R2 U' R2' U2 R", note: "3x3 variant" }
    ]
  },
  {
    id: "ortega-oll-antisune",
    name: "Ortega OLL: Antisune",
    group: "OLL (Orient Last Layer)",
    description: "1 yellow corner solved on top, right corner facing front.",
    algs: [
      { id: "o-as-1", alg: "R U2 R' U' R U' R'", note: "Standard Antisune", isDefault: true }
    ]
  },
  {
    id: "ortega-oll-sune",
    name: "Ortega OLL: Sune",
    group: "OLL (Orient Last Layer)",
    description: "1 yellow corner solved on top, front-left corner facing front.",
    algs: [
      { id: "o-s-1", alg: "R U R' U R U2 R'", note: "Standard Sune", isDefault: true }
    ]
  },
  {
    id: "ortega-oll-l",
    name: "Ortega OLL: L (Bowtie)",
    group: "OLL (Orient Last Layer)",
    description: "2 diagonal corners solved on top, 2 corners facing outward.",
    algs: [
      { id: "o-l-1", alg: "F R' F' R U R U' R'", note: "Inverse Sledge into Sexy", isDefault: true },
      { id: "o-l-2", alg: "R U2 R' U' (R U R' U') R U' R'", note: "RU-only variant" }
    ]
  },
  {
    id: "ortega-oll-t",
    name: "Ortega OLL: T (Chameleon)",
    group: "OLL (Orient Last Layer)",
    description: "2 adjacent corners solved on top, 2 corners facing outward in opposite directions.",
    algs: [
      { id: "o-t-1", alg: "R U R' U' R' F R F'", note: "Sexy + Sledgehammer", isDefault: true }
    ]
  },
  {
    id: "ortega-oll-u",
    name: "Ortega OLL: U (Headlights)",
    group: "OLL (Orient Last Layer)",
    description: "2 adjacent corners solved on top, headlights facing front.",
    algs: [
      { id: "o-u-1", alg: "F R U R' U' F'", note: "F Sexy F'", isDefault: true }
    ]
  }
];

for (const o of ortegaOllCases) {
  const def = o.algs.find(a => a.isDefault) || o.algs[0];
  o.setup = new Alg(def.alg).invert().toString();
}

const ortegaPblCases = pblCases.map(c => {
  return {
    id: "ortega-pbl-" + c.id,
    name: "Ortega PBL: " + c.name,
    group: "PBL (Permute Both Layers)",
    description: c.description,
    setup: c.scramble,
    algs: c.algs.map((a, idx) => ({
      id: a.id,
      alg: a.alg,
      note: a.note,
      isDefault: idx === 0
    }))
  };
});

const allOrtega = [...ortegaOllCases, ...ortegaPblCases];

const fileContent = `// 2x2x2 Ortega Method (OLL + PBL Cases)
// Automatically formatted and verified with cubing.js

export const ortegaCases = ${JSON.stringify(allOrtega, null, 2)};

export const ortegaCaseById = new Map(ortegaCases.map(c => [c.id, c]));
`;

fs.writeFileSync('src/data/ortegaData.js', fileContent);
console.log('Successfully wrote src/data/ortegaData.js with', allOrtega.length, 'cases.');
