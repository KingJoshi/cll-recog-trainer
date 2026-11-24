import test from 'node:test';
import assert from 'node:assert';
import { PUZZLES, getTrack, getPreferredAlg, setPreferredAlg, formatCaseDisplayId, getDistinctCaseName, getSolveTargetsForPuzzle, getSolveTargetInfo } from '../src/data/algRegistry.js';
import { pllCases } from '../src/data/pllData.js';
import { ollCases } from '../src/data/ollData.js';
import { f2lCases } from '../src/data/f2lData.js';
import { ortegaCases } from '../src/data/ortegaData.js';
import { lbl222Cases } from '../src/data/lbl222Data.js';
import { eg1Cases, eg2Cases } from '../src/data/egData.js';
import { cllCases } from '../src/data/cllData.js';
import { parity444Cases, parity555Cases } from '../src/data/parityData.js';
import { PLL_TWO_SIDED_GUIDE, OLL_TWO_SIDED_GUIDE } from '../src/data/twoSidedRecogData.js';
import { Alg } from 'cubing/alg';

test('PUZZLES registry structure', () => {
  assert.ok(PUZZLES['222'], 'Must have 222');
  assert.ok(PUZZLES['333'], 'Must have 333');
  assert.ok(PUZZLES['333oh'], 'Must have 333oh');
  assert.ok(PUZZLES['444'], 'Must have 444');
  assert.ok(PUZZLES['555'], 'Must have 555');
  assert.strictEqual(PUZZLES['222'].tracks.length, 7);
  assert.strictEqual(PUZZLES['333'].tracks.length, 4);
  assert.strictEqual(PUZZLES['333oh'].tracks.length, 4);
  assert.strictEqual(PUZZLES['444'].tracks.length, 2);
  assert.strictEqual(PUZZLES['555'].tracks.length, 1);

  const pllTrack = getTrack('333', 'pll');
  assert.ok(pllTrack);
  assert.strictEqual(pllTrack.cases.length, 21);

  assert.deepStrictEqual(PUZZLES['222'].tracks.map(t => t.id), ['face', 'layer', 'lbl', 'ortega', 'cll', 'eg1', 'eg2']);
  assert.strictEqual(PUZZLES['222'].defaultTrack, 'lbl');
  assert.deepStrictEqual(PUZZLES['333'].tracks.map(t => t.id), ['cross', 'f2l', 'oll', 'pll']);
  assert.deepStrictEqual(PUZZLES['333oh'].tracks.map(t => t.id), ['cross', 'f2l', 'oll', 'pll']);
  assert.deepStrictEqual(PUZZLES['444'].tracks.map(t => t.id), ['parity', 'methods']);
  assert.deepStrictEqual(PUZZLES['555'].tracks.map(t => t.id), ['parity']);
});

test('getSolveTargetsForPuzzle returns canonical ordered targets per puzzle', () => {
  assert.deepStrictEqual(
    getSolveTargetsForPuzzle('222').map(t => t.id),
    ['timer-drill', 'face', 'layer', 'lbl', 'cll', 'eg1', 'eg2', 'full']
  );
  assert.deepStrictEqual(
    getSolveTargetsForPuzzle('333').map(t => t.id),
    ['timer-drill', 'f2l', 'oll', 'pll', 'full']
  );
  assert.deepStrictEqual(
    getSolveTargetsForPuzzle('333oh').map(t => t.id),
    ['timer-drill', 'f2l', 'oll', 'pll', 'full']
  );
  assert.deepStrictEqual(
    getSolveTargetsForPuzzle('444').map(t => t.id),
    ['timer-drill', 'parity', 'full']
  );
  assert.deepStrictEqual(
    getSolveTargetsForPuzzle('555').map(t => t.id),
    ['timer-drill', 'parity', 'full']
  );

  assert.strictEqual(getSolveTargetInfo('222', 'cll')?.usesCases, true);
  assert.strictEqual(getSolveTargetInfo('222', 'face')?.usesCases, false);
  assert.strictEqual(getSolveTargetInfo('333', 'pll')?.usesCases, true);
  assert.strictEqual(getSolveTargetInfo('333', 'nonexistent'), null);
});

test('PLL 21 cases integrity', () => {
  assert.strictEqual(pllCases.length, 21, 'Must have exactly 21 PLL cases');
  for (const c of pllCases) {
    assert.ok(c.id, 'Case must have id');
    assert.ok(c.name, 'Case must have name');
    assert.ok(c.setup, 'Case must have setup');
    assert.ok(c.algs.length > 0, 'Case must have algorithms');
    // Ensure all algs parse with cubing.js
    for (const a of c.algs) {
      assert.doesNotThrow(() => new Alg(a.alg), `Alg ${a.alg} must parse`);
    }
    assert.doesNotThrow(() => new Alg(c.setup), `Setup ${c.setup} must parse`);
  }
});

test('OLL 57 cases integrity', () => {
  assert.strictEqual(ollCases.length, 57, 'Must have exactly 57 OLL cases');
  const numbers = ollCases.map(c => c.number).sort((a,b)=>a-b);
  for (let i = 1; i <= 57; i++) {
    assert.strictEqual(numbers[i - 1], i, `OLL ${i} must exist`);
  }
  for (const c of ollCases) {
    for (const a of c.algs) {
      assert.doesNotThrow(() => new Alg(a.alg), `Alg ${a.alg} in OLL ${c.number} must parse`);
    }
  }
});

test('F2L 41 cases integrity', () => {
  assert.strictEqual(f2lCases.length, 41, 'Must have exactly 41 F2L cases');
  const numbers = f2lCases.map(c => c.number).sort((a,b)=>a-b);
  for (let i = 1; i <= 41; i++) {
    assert.strictEqual(numbers[i - 1], i, `F2L ${i} must exist`);
  }
  for (const c of f2lCases) {
    for (const a of c.algs) {
      assert.doesNotThrow(() => new Alg(a.alg), `Alg ${a.alg} in F2L ${c.number} must parse`);
    }
  }
});

test('Ortega, LBL, CLL, EG-1, and EG-2 2x2 cases integrity', () => {
  assert.strictEqual(lbl222Cases.length, 9, '2x2 LBL must have 7 OLL + 2 PLL = 9 cases');
  assert.strictEqual(ortegaCases.length, 12, 'Ortega must have 7 OLL + 5 PBL = 12 cases');
  assert.strictEqual(cllCases.length, 40, 'CLL must have 40 cases');
  assert.strictEqual(eg1Cases.length, 40, 'EG-1 must have 40 cases');
  assert.strictEqual(eg2Cases.length, 40, 'EG-2 must have 40 cases');

  for (const list of [lbl222Cases, ortegaCases, cllCases, eg1Cases, eg2Cases]) {
    for (const c of list) {
      assert.ok(c.algs?.length > 0, `${c.id} must have algs`);
      assert.doesNotThrow(() => new Alg(c.setup), `Setup in ${c.id} must parse`);
      for (const a of c.algs) {
        assert.doesNotThrow(() => new Alg(a.alg), `Alg ${a.alg} in ${c.id} must parse`);
      }
    }
  }
});

test('3x3 CFOP cases default to White on bottom with z2', async () => {
  const { puzzles } = await import('cubing/puzzles');
  const kp = await puzzles['3x3x3'].kpuzzle();
  const def = kp.defaultPattern();
  const z2Solved = def.applyAlg(new Alg('z2'));

  // Sample PLL case (e.g. Ua)
  const ua = pllCases.find(c => c.id === 'Ua');
  assert.ok(ua);
  const uaSol = def.applyAlg(new Alg(`z2 ${ua.setup} ${ua.algs[0].alg}`));
  assert.strictEqual(
    JSON.stringify(uaSol.patternData),
    JSON.stringify(z2Solved.patternData),
    'Applying z2 + setup + alg must result in solved cube with White on bottom'
  );

  // Sample OLL case (e.g. OLL 1)
  const oll1 = ollCases.find(c => c.number === 1);
  assert.ok(oll1);
  const ollSol = def.applyAlg(new Alg(`z2 ${oll1.setup} ${oll1.algs[0].alg}`));
  assert.strictEqual(
    ollSol.patternData.CENTERS.pieces[5],
    0,
    'Bottom center must remain White (index 0) after OLL execution'
  );

  // Sample F2L case (e.g. F2L 1)
  const f2l1 = f2lCases.find(c => c.number === 1);
  assert.ok(f2l1);
  const f2lSol = def.applyAlg(new Alg(`z2 ${f2l1.setup} ${f2l1.algs[0].alg}`));
  assert.strictEqual(
    f2lSol.patternData.CENTERS.pieces[5],
    0,
    'Bottom center must remain White (index 0) after F2L execution'
  );
});

test('4x4 and 5x5 Parity algorithms integrity', () => {
  assert.strictEqual(parity444Cases.length, 4, '4x4 must have 4 parity cases (OLL 4-Piece, OLL Pure, PLL Opp, PLL Adj)');
  assert.strictEqual(parity555Cases.length, 2, '5x5 must have 2 parity cases (Lucas Flip, Wings)');

  for (const c of parity444Cases) {
    assert.ok(c.id);
    assert.ok(c.name);
    assert.ok(c.alg);
    assert.ok(c.setup);
    assert.doesNotThrow(() => new Alg(c.alg), `4x4 alg ${c.alg} must parse`);
  }

  for (const c of parity555Cases) {
    assert.ok(c.id);
    assert.ok(c.name);
    assert.ok(c.alg);
    assert.ok(c.setup);
    assert.doesNotThrow(() => new Alg(c.alg), `5x5 alg ${c.alg} must parse`);
  }
});

test('2-Sided recognition guide integrity', () => {
  assert.ok(PLL_TWO_SIDED_GUIDE.length > 0, 'Must have PLL two-sided categories');
  assert.ok(OLL_TWO_SIDED_GUIDE.length > 0, 'Must have OLL two-sided categories');

  let pllRulesCount = 0;
  for (const cat of PLL_TWO_SIDED_GUIDE) {
    assert.ok(cat.category);
    assert.ok(cat.rules.length > 0);
    for (const r of cat.rules) {
      assert.ok(r.caseId);
      assert.ok(r.frontSight);
      assert.ok(r.rightSight);
      pllRulesCount++;
    }
  }
  assert.strictEqual(pllRulesCount, 21, 'Must cover all 21 PLL cases in 2-sided guide');
});

test('Full mathematical simulation verification of all algorithms', async () => {
  const { puzzles } = await import('cubing/puzzles');
  const kp2 = await puzzles['2x2x2'].kpuzzle();
  const kp3 = await puzzles['3x3x3'].kpuzzle();
  const def2 = kp2.defaultPattern();
  const def3 = kp3.defaultPattern();

  // 1. Ortega OLL & PBL
  for (const c of ortegaCases) {
    const isOLL = c.group.includes('OLL');
    for (const a of c.algs) {
      const algStr = `${c.setup} ${a.alg}`;
      const pat = def2.applyAlg(new Alg(algStr));
      if (isOLL) {
        const ori = pat.patternData.CORNERS.orientation.slice(0, 4);
        assert.ok(ori.every(o => o === 0), `Ortega OLL ${c.id} ${a.id} must orient top corners`);
      } else {
        let solved = false;
        for (const auf of ['', 'U', 'U2', "U'"]) {
          const checkPat = def2.applyAlg(new Alg(`${algStr} ${auf}`));
          const pieces = checkPat.patternData.CORNERS.pieces;
          const ori = checkPat.patternData.CORNERS.orientation;
          if (pieces.every((p, idx) => p === idx) && ori.every(o => o === 0)) {
            solved = true;
            break;
          }
        }
        assert.ok(solved, `Ortega PBL ${c.id} ${a.id} must solve the cube`);
      }
    }
  }

  const orientRots = [
    '', 'y', 'y2', "y'",
    'x', 'x y', 'x y2', "x y'",
    'x2', 'x2 y', 'x2 y2', "x2 y'",
    "x'", "x' y", "x' y2", "x' y'",
    'z', 'z y', 'z y2', "z y'",
    "z'", "z' y", "z' y2", "z' y'"
  ];
  const solvedPats2 = orientRots.map(r => r ? def2.applyAlg(new Alg(r)) : def2);
  const solvedPats3 = orientRots.map(r => r ? def3.applyAlg(new Alg(r)) : def3);

  // 2. 2x2 CLL
  for (const c of cllCases) {
    for (const a of c.algs) {
      const algStr = `${c.setup} ${a.startAuf ? a.startAuf + ' ' : ''}${a.alg}`;
      let solved = false;
      for (const auf of ['', 'U', 'U2', "U'"]) {
        const pat = def2.applyAlg(new Alg(`${algStr} ${auf}`));
        if (solvedPats2.some(sp => pat.isIdentical(sp))) {
          solved = true;
          break;
        }
      }
      assert.ok(solved, `CLL ${c.id} ${a.id} must solve the cube`);
    }
  }

  // 2b. 2x2 LBL (7 OLL + 2 PLL)
  for (const c of lbl222Cases) {
    const isOll = c.group.includes('OLL');
    for (const a of c.algs) {
      const algStr = `${c.setup} ${a.startAuf ? a.startAuf + ' ' : ''}${a.alg}`;
      if (isOll) {
        const pat = def2.applyAlg(new Alg(algStr));
        assert.ok(pat.patternData.CORNERS.orientation.slice(0, 4).every(o => o === 0), `LBL OLL ${c.id} ${a.id} must orient U`);
      } else {
        let solved = false;
        for (const auf of ['', 'U', 'U2', "U'"]) {
          const pat = def2.applyAlg(new Alg(`${algStr} ${auf}`));
          if (solvedPats2.some(sp => pat.isIdentical(sp))) { solved = true; break; }
        }
        assert.ok(solved, `LBL PLL ${c.id} ${a.id} must solve 2x2`);
      }
    }
  }

  // 2c. 2x2 EG-1 (40 cases, Back Bar D=[5,4,6,7]) & EG-2 (40 cases, Diag Swap D=[4,7,6,5])
  for (const c of eg1Cases) {
    const setupPat = def2.applyAlg(new Alg(c.setup));
    assert.deepStrictEqual(setupPat.patternData.CORNERS.pieces.slice(4), [5, 4, 6, 7], `EG-1 ${c.id} must have Back Bar on D`);
    assert.deepStrictEqual(setupPat.patternData.CORNERS.orientation.slice(4), [0, 0, 0, 0], `EG-1 ${c.id} D corners must be oriented`);
    for (const a of c.algs) {
      const algStr = `${c.setup} ${a.startAuf ? a.startAuf + ' ' : ''}${a.alg}`;
      let solved = false;
      for (const auf of ['', 'U', 'U2', "U'"]) {
        const pat = def2.applyAlg(new Alg(`${algStr} ${auf}`));
        if (solvedPats2.some(sp => pat.isIdentical(sp))) { solved = true; break; }
      }
      assert.ok(solved, `EG-1 ${c.id} ${a.id} must solve 2x2`);
    }
  }
  for (const c of eg2Cases) {
    const setupPat = def2.applyAlg(new Alg(c.setup));
    assert.deepStrictEqual(setupPat.patternData.CORNERS.pieces.slice(4), [4, 7, 6, 5], `EG-2 ${c.id} must have Diag swap on D`);
    assert.deepStrictEqual(setupPat.patternData.CORNERS.orientation.slice(4), [0, 0, 0, 0], `EG-2 ${c.id} D corners must be oriented`);
    for (const a of c.algs) {
      const algStr = `${c.setup} ${a.startAuf ? a.startAuf + ' ' : ''}${a.alg}`;
      let solved = false;
      for (const auf of ['', 'U', 'U2', "U'"]) {
        const pat = def2.applyAlg(new Alg(`${algStr} ${auf}`));
        if (solvedPats2.some(sp => pat.isIdentical(sp))) { solved = true; break; }
      }
      assert.ok(solved, `EG-2 ${c.id} ${a.id} must solve 2x2`);
    }
  }

  // 3. 3x3 PLL
  for (const c of pllCases) {
    for (const a of c.algs) {
      const algStr = `${c.setup} ${a.startAuf ? a.startAuf + ' ' : ''}${a.alg}`;
      let solved = false;
      for (const auf of ['', 'U', 'U2', "U'"]) {
        const pat = def3.applyAlg(new Alg(`${algStr} ${auf}`));
        if (solvedPats3.some(sp => pat.isIdentical(sp))) {
          solved = true;
          break;
        }
      }
      assert.ok(solved, `PLL ${c.id} ${a.id} must solve the cube`);
    }
  }

  // 4. 3x3 OLL
  for (const c of ollCases) {
    for (const a of c.algs) {
      const algStr = `${c.setup} ${a.startAuf ? a.startAuf + ' ' : ''}${a.alg}`;
      const basePat = def3.applyAlg(new Alg(algStr));
      let ollOk = false;
      for (const rot of ['', 'y', 'y2', "y'"]) {
        const pat = rot ? basePat.applyAlg(new Alg(rot)) : basePat;
        const cOri = pat.patternData.CORNERS.orientation.slice(0, 4);
        const eOri = pat.patternData.EDGES.orientation.slice(0, 4);
        if (cOri.every(o => o === 0) && eOri.every(o => o === 0)) {
          ollOk = true;
          break;
        }
      }
      assert.ok(ollOk, `OLL ${c.number} ${a.id} must orient top corners and edges`);
    }
  }
});

test('getTrack returns null for unknown tracks and formatCaseDisplayId formats 444/555 ids', () => {
  assert.strictEqual(getTrack('333', 'nonexistent'), null);
  assert.strictEqual(getTrack('999', 'cll'), null);
  assert.strictEqual(formatCaseDisplayId('444-oll-parity'), '4x4-OLL-parity');
  assert.strictEqual(formatCaseDisplayId('444-pll-parity-opp'), '4x4-PLL-parity-opp');
  assert.strictEqual(formatCaseDisplayId('555-edge-parity-flip'), '5x5-edge-parity-flip');
  assert.strictEqual(formatCaseDisplayId('555-wing-swap'), '5x5-wing-swap');

  assert.strictEqual(getDistinctCaseName({ id: 'A1', name: 'CLL A1 (A-Group)' }), '');
  assert.strictEqual(getDistinctCaseName({ id: 'EG1-H1', name: 'EG-1 H1 (H-Group)' }), '');
  assert.strictEqual(getDistinctCaseName({ id: 'EG2-T3', name: 'EG-2 T3 (T-Group)' }), '');
  assert.strictEqual(getDistinctCaseName({ id: 'oll-01', name: 'OLL 1' }), '');
  assert.strictEqual(getDistinctCaseName({ id: 'Ua', name: 'Ua-Perm (3-Edge Cycle Counter-Clockwise)' }), 'Ua-Perm (3-Edge Cycle Counter-Clockwise)');
  assert.strictEqual(getDistinctCaseName({ id: 'f2l-01', name: 'F2L 1 (Easy Left / Right Insertion)' }), 'F2L 1 (Easy Left / Right Insertion)');
  assert.strictEqual(getDistinctCaseName({ id: '444-oll-parity', name: '4x4 OLL Parity (Single Dedge Flip)' }), '4x4 OLL Parity (Single Dedge Flip)');
});

test('getPreferredAlg and setPreferredAlg scope preferences independently by puzzleId', () => {
  const store = {};
  const prevStorage = globalThis.localStorage;
  globalThis.localStorage = {
    getItem: k => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: k => { delete store[k]; }
  };
  try {
    setPreferredAlg('Ua', 'ua-alg-333', '333');
    setPreferredAlg('Ua', 'ua-alg-oh-left', '333oh', 'left');
    setPreferredAlg('Ua', 'ua-alg-oh-right', '333oh', 'right');
    assert.strictEqual(getPreferredAlg('Ua', 'fallback', '333'), 'ua-alg-333');
    assert.strictEqual(getPreferredAlg('Ua', 'fallback', '333oh', 'left'), 'ua-alg-oh-left');
    assert.strictEqual(getPreferredAlg('Ua', 'fallback', '333oh', 'right'), 'ua-alg-oh-right');
    assert.strictEqual(getPreferredAlg('Ub', 'fallback', '333oh', 'right'), 'fallback');
  } finally {
    globalThis.localStorage = prevStorage;
  }
});
