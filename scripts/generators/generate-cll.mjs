import * as fs from 'node:fs';
import { cllCases } from '../src/casesData.js';

const cllList = cllCases.cases.map(c => {
  return {
    id: c.id,
    name: `CLL ${c.id} (${c.group}-Group)`,
    group: `${c.group}-Group`,
    opposite: c.opposite,
    setup: c.scramble,
    scrambles: c.scrambles,
    description: `CLL ${c.id} (${c.solution}). Opposite case: ${c.opposite}`,
    algs: [
      {
        id: `${c.id}-default`,
        alg: c.solutionAlg,
        note: c.solution,
        isDefault: true
      }
    ]
  };
});

const fileContent = `// 2x2x2 CLL (Corners of the Last Layer) - All 40 Cases
// Standardized schema

export const cllCases = ${JSON.stringify(cllList, null, 2)};

export const cllCaseById = new Map(cllCases.map(c => [c.id, c]));
`;

fs.writeFileSync('src/data/cllData.js', fileContent);
console.log('Successfully wrote src/data/cllData.js with', cllList.length, 'cases.');
