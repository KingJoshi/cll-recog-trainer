// Generator & verifier for 3x3 OH Right-Hand mirror partner table (`src/data/ohMirrorMap.js`)
// Run with: node scripts/generators/generate-oh-mirror-map.mjs

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { puzzles } from 'cubing/puzzles';
import { Alg } from 'cubing/alg';
import { pllCases } from '../../src/data/pllData.js';
import { ollCases } from '../../src/data/ollData.js';
import { cleanAlg } from '../../src/algParser.js';
import { mirrorAlgLR, conjugateZPrime } from '../../src/cube/algMirror.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_PATH = path.resolve(__dirname, '../../src/data/ohMirrorMap.js');

const AUF_LIST = ['', 'U', "U'", 'U2'];
const ORIENT_ROTS = [
  '', 'y', 'y2', "y'",
  'x', 'x y', 'x y2', "x y'",
  'x2', 'x2 y', 'x2 y2', "x2 y'",
  "x'", "x' y", "x' y2", "x' y'",
  'z', 'z y', 'z y2', "z y'",
  "z'", "z' y", "z' y2", "z' y'"
];

async function main() {
  const kp = await puzzles['3x3x3'].kpuzzle();
  const def = kp.defaultPattern();
  const solvedPats = ORIENT_ROTS.map(r => (r ? def.applyAlg(new Alg(r)) : def));

  // Verify z' conjugation identity on ALL PLL, OLL default algs first
  for (const c of [...pllCases, ...ollCases]) {
    const base = c.algs?.[0]?.alg;
    if (!base) continue;
    const p1 = def.applyAlg(new Alg(cleanAlg(base)));
    const p2 = def.applyAlg(new Alg(conjugateZPrime(base, { wrap: true })));
    if (!p1.isIdentical(p2)) {
      throw new Error(`z' conjugation identity failed on ${c.id}: ${base}`);
    }
  }
  console.log("Verified z' conjugation mathematically across all PLL & OLL primary algs!");

  const map = { pll: {}, oll: {} };

  // 1. PLL Mirror Partners (target: mirrorAlgLR(partner.alg) solves case C modulo U-AUF)
  for (const targetCase of pllCases) {
    let matched = null;
    for (const partner of pllCases) {
      for (const a of partner.algs || []) {
        const mir = mirrorAlgLR(a.alg);
        if (!mir) continue;
        let mirAlg;
        try { mirAlg = new Alg(mir); } catch { continue; }
        for (const startAuf of AUF_LIST) {
          const setupSeq = [targetCase.setup, startAuf].filter(Boolean).join(' ');
          const after = def.applyAlg(new Alg(setupSeq)).applyAlg(mirAlg);
          let ok = false;
          for (const endAuf of AUF_LIST) {
            const fp = endAuf ? after.applyAlg(new Alg(endAuf)) : after;
            if (solvedPats.some(sp => fp.isIdentical(sp))) {
              ok = true;
              break;
            }
          }
          if (ok) {
            // Prefer partner === targetCase if tied, else prefer default alg & shortest/RU-rich
            const isDefaultBonus = a.isDefault ? 0 : 10;
            const startAufPenalty = startAuf ? 2 : 0;
            const moveCount = mir.split(/\s+/).length;
            const lBonus = mir.split(/\s+/).filter(t => /^[LU][2']?$/.test(t)).length * -0.3;
            const score = moveCount + isDefaultBonus + startAufPenalty + lBonus;
            if (!matched || score < matched.score) {
              matched = {
                partnerId: partner.id,
                sourceAlgId: a.id,
                startAuf,
                mirroredAlg: mir,
                score
              };
            }
          }
        }
      }
    }
    if (!matched) {
      throw new Error(`No Right-Hand OH mirror found for PLL ${targetCase.id}`);
    }
    map.pll[targetCase.id] = {
      partnerId: matched.partnerId,
      sourceAlgId: matched.sourceAlgId,
      startAuf: matched.startAuf
    };
  }

  // 2. OLL Mirror Partners (target: mirrorAlgLR(partner.alg) orients all U corners & edges while preserving F2L!)
  for (const targetCase of ollCases) {
    let matched = null;
    for (const partner of ollCases) {
      for (const a of partner.algs || []) {
        const mir = mirrorAlgLR(a.alg);
        if (!mir) continue;
        let mirAlg;
        try { mirAlg = new Alg(mir); } catch { continue; }
        for (const startAuf of AUF_LIST) {
          const setupSeq = [targetCase.setup, startAuf].filter(Boolean).join(' ');
          const baseAfter = def.applyAlg(new Alg(setupSeq)).applyAlg(mirAlg);
          let ok = false;
          for (const rot of ['', 'y', 'y2', "y'"]) {
            const p = rot ? baseAfter.applyAlg(new Alg(rot)) : baseAfter;
            const cOri = p.patternData.CORNERS.orientation;
            const eOri = p.patternData.EDGES.orientation;
            const cPos = p.patternData.CORNERS.pieces;
            const ePos = p.patternData.EDGES.pieces;
            // Top oriented AND bottom/F2L intact!
            const uOriented = cOri.slice(0, 4).every(o => o === 0) && eOri.slice(0, 4).every(o => o === 0);
            const f2lIntact = cPos.slice(4).every((v, idx) => v === idx + 4 && cOri[idx + 4] === 0)
              && ePos.slice(4).every((v, idx) => v === idx + 4 && eOri[idx + 4] === 0);
            if (uOriented && f2lIntact) {
              ok = true;
              break;
            }
          }
          if (ok) {
            const isDefaultBonus = a.isDefault ? 0 : 10;
            const startAufPenalty = startAuf ? 2 : 0;
            const moveCount = mir.split(/\s+/).length;
            const lBonus = mir.split(/\s+/).filter(t => /^[Llu][2']?$/.test(t)).length * -0.3;
            const score = moveCount + isDefaultBonus + startAufPenalty + lBonus;
            if (!matched || score < matched.score) {
              matched = {
                partnerId: partner.id,
                sourceAlgId: a.id,
                startAuf,
                mirroredAlg: mir,
                score
              };
            }
          }
        }
      }
    }
    if (!matched) {
      throw new Error(`No Right-Hand OH mirror found for OLL ${targetCase.id}`);
    }
    map.oll[targetCase.id] = {
      partnerId: matched.partnerId,
      sourceAlgId: matched.sourceAlgId,
      startAuf: matched.startAuf
    };
  }

  const outContent = `// Auto-generated Left-Right mirror partner map for 3x3 OH Right-Hand solving
// Every entry mathematically verified against cubing.js 3x3x3 KPuzzle (${Object.keys(map.pll).length} PLL + ${Object.keys(map.oll).length} OLL)

export const OH_MIRROR_PARTNERS = ${JSON.stringify(map, null, 2)};
`;
  fs.writeFileSync(OUT_PATH, outContent, 'utf8');
  console.log(`Wrote verified OH mirror map (${Object.keys(map.pll).length} PLL, ${Object.keys(map.oll).length} OLL) to ${OUT_PATH}`);
  console.log('Sample asymmetric PLLs:', {
    Ua: map.pll.Ua,
    Ub: map.pll.Ub,
    Ja: map.pll.Ja,
    Jb: map.pll.Jb,
    Sune: map.oll['oll-27'],
    Antisune: map.oll['oll-26']
  });
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
