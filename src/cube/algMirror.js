// Left-Right Symmetry Mirroring, z'-Conjugation & No-Table-Abuse OH Engine for 3x3 Solving
// Supports Left-Handed OH (standard <R, U>) and Right-Handed OH (mirrored <L, U> + z' <U, L>)
// as well as Table Abuse (M/S/E slices allowed) vs No Table Abuse (in-air L/R/U/F/D, B -> x' U)

import { cleanAlg, MOVE_TOKEN_REGEX } from '../algParser.js';
import { OH_MIRROR_PARTNERS, OH_NO_TABLE_MIRROR_OVERRIDES } from '../data/ohMirrorMap.js';

const LR_FACE_MAP = {
  R: 'L', L: 'R', r: 'l', l: 'r', Rw: 'Lw', Lw: 'Rw',
  U: 'U', D: 'D', F: 'F', B: 'B', u: 'u', d: 'd', f: 'f', b: 'b', Uw: 'Uw', Dw: 'Dw', Fw: 'Fw', Bw: 'Bw',
  M: 'M', S: 'S', E: 'E',
  x: 'x', y: 'y', z: 'z'
};

// Under M-plane reflection, clockwise becomes CCW EXCEPT `x` and `M` whose axis flips AND sense flips -> unchanged (+1)
const LR_KEEP_SENSE = new Set(['x', 'M']);

const ZPRIME_MAP = {
  R: { to: 'U', flip: false },
  U: { to: 'L', flip: false },
  L: { to: 'D', flip: false },
  D: { to: 'R', flip: false },
  F: { to: 'F', flip: false },
  B: { to: 'B', flip: false },
  r: { to: 'u', flip: false },
  u: { to: 'l', flip: false },
  l: { to: 'd', flip: false },
  d: { to: 'r', flip: false },
  f: { to: 'f', flip: false },
  b: { to: 'b', flip: false },
  Rw: { to: 'Uw', flip: false },
  Uw: { to: 'Lw', flip: false },
  Lw: { to: 'Dw', flip: false },
  Dw: { to: 'Rw', flip: false },
  Fw: { to: 'Fw', flip: false },
  Bw: { to: 'Bw', flip: false },
  M: { to: 'E', flip: false },
  E: { to: 'M', flip: true },
  S: { to: 'S', flip: false },
  x: { to: 'y', flip: false },
  y: { to: 'x', flip: true },
  z: { to: 'z', flip: false }
};

function invertMod(mod) {
  if (mod === '2' || mod === "2'") return mod;
  if (mod === "'") return '';
  return "'";
}

/**
 * Exact Left-Right mirror across the M-plane (R↔L', U↔U', F↔F', y↔y', z↔z', M↔M, x↔x).
 */
export function mirrorAlgLR(algStr) {
  const expanded = cleanAlg(algStr);
  if (!expanded) return '';
  const tokens = expanded.split(/\s+/).filter(Boolean);
  const out = [];

  for (const tok of tokens) {
    const m = tok.match(MOVE_TOKEN_REGEX);
    if (!m) {
      out.push(tok);
      continue;
    }
    const prefix = m[1] || '';
    const base = m[2] || m[3];
    const mod = m[4] || '';
    const mappedBase = LR_FACE_MAP[base] || base;
    const nextMod = LR_KEEP_SENSE.has(base) ? mod : invertMod(mod);
    out.push(`${prefix}${mappedBase}${nextMod}`);
  }
  return out.join(' ');
}

/**
 * Exact z' conjugation: transforms A into `z' T(A) z` where R→U and U→L,
 * letting right-handed OH cubers execute <R, U> algorithms in the ergonomic <U, L> wrist angle.
 */
export function conjugateZPrime(algStr, { wrap = true } = {}) {
  const expanded = cleanAlg(algStr);
  if (!expanded) return '';
  const tokens = expanded.split(/\s+/).filter(Boolean);
  const body = [];

  for (const tok of tokens) {
    const m = tok.match(MOVE_TOKEN_REGEX);
    if (!m) {
      body.push(tok);
      continue;
    }
    const prefix = m[1] || '';
    const base = m[2] || m[3];
    const mod = m[4] || '';
    const spec = ZPRIME_MAP[base];
    if (!spec) {
      body.push(tok);
      continue;
    }
    const nextMod = spec.flip ? invertMod(mod) : mod;
    body.push(`${prefix}${spec.to}${nextMod}`);
  }

  const inner = body.join(' ');
  if (!wrap) return inner;
  return `z' ${inner} z`;
}

function tokenizeClean(algStr) {
  const clean = cleanAlg(algStr);
  return clean ? clean.split(/\s+/).filter(Boolean) : [];
}

export function hasSliceMoves(algStr) {
  return tokenizeClean(algStr).some(t => /^(?:[MES]|[MES]w)(?:2'?|['2])?$/.test(t));
}

export function hasBMoves(algStr) {
  return tokenizeClean(algStr).some(t => /^(?:B|b|Bw)(?:2'?|['2])?$/.test(t));
}

export function hasOuterBOnly(algStr) {
  const tokens = tokenizeClean(algStr);
  return tokens.some(t => /^B(?:2'?|['2])?$/.test(t)) && !tokens.some(t => /^(?:b|Bw)(?:2'?|['2])?$/.test(t));
}

export function hasWideFrontMoves(algStr) {
  return tokenizeClean(algStr).some(t => /^(?:f|Fw)(?:2'?|['2])?$/.test(t));
}

export function hasWideMoves(algStr) {
  return tokenizeClean(algStr).some(t => /^(?:[rulfdb]|[RULFDB]w)(?:2'?|['2])?$/.test(t));
}

/**
 * Rewrite B / B' / B2 moves as x' U x / x' U' x / x' U2 x and cancel adjacent x / x' pairs
 * separated by commuting <R, L> axis moves.
 */
export function rewriteBMovesWithXPrime(algStr) {
  const tokens = tokenizeClean(algStr);
  if (tokens.length === 0) return '';
  const raw = [];
  for (const tok of tokens) {
    const m = tok.match(MOVE_TOKEN_REGEX);
    if (!m) {
      raw.push(tok);
      continue;
    }
    const base = m[2] || m[3];
    const mod = m[4] || '';
    if (base === 'B') {
      const uMod = mod === "2'" ? '2' : mod;
      raw.push("x'", `U${uMod}`, 'x');
    } else {
      raw.push(tok);
    }
  }

  const commutesWithX = (t) => /^(?:[RLrl]|[RL]w)(?:2'?|['2])?$/.test(t);
  const arr = [...raw];
  let changed = true;
  while (changed) {
    changed = false;
    for (let i = 0; i < arr.length; i++) {
      if (arr[i] === 'x' || arr[i] === "x'") {
        let j = i + 1;
        while (j < arr.length && commutesWithX(arr[j])) j++;
        if (j < arr.length && ((arr[i] === 'x' && arr[j] === "x'") || (arr[i] === "x'" && arr[j] === 'x'))) {
          arr.splice(j, 1);
          arr.splice(i, 1);
          changed = true;
          break;
        }
      }
    }
  }
  return arr.join(' ');
}

/**
 * Rewrite wide d / Dw moves into rotation + U equivalents for in-air No-Table OH solving.
 */
export function rewriteDMovesToYPrimeU(algStr) {
  const tokens = tokenizeClean(algStr);
  if (tokens.length === 0) return '';
  const out = [];
  for (const tok of tokens) {
    const m = tok.match(MOVE_TOKEN_REGEX);
    if (!m) {
      out.push(tok);
      continue;
    }
    const base = m[2] || m[3];
    const mod = m[4] || '';
    if (base === 'd' || base === 'Dw') {
      if (mod === "'") out.push('y', "U'");
      else if (mod === '2' || mod === "2'") out.push('y2', 'U2');
      else out.push("y'", 'U');
    } else {
      out.push(tok);
    }
  }
  return out.join(' ');
}

/**
 * Ergonomic ranking score (lower is better) for in-air No-Table-Abuse OH solving:
 * favors <R, U> > <R, U, L> > occasional F/D > rotations, and strongly penalizes wide moves.
 */
export function scoreNoTableOhAlg(algObj, idx = 0) {
  const tokens = tokenizeClean(algObj?.alg || '');
  let fCount = 0;
  let dCount = 0;
  let lCount = 0;
  let rotCount = 0;
  let wideCount = 0;

  for (const tok of tokens) {
    const m = tok.match(MOVE_TOKEN_REGEX);
    if (!m) continue;
    const base = m[2] || m[3];
    if (base === 'F') fCount++;
    else if (base === 'D') dCount++;
    else if (base === 'L') lCount++;
    else if (/^[xyz]$/.test(base)) rotCount++;
    else if (/^(?:[rulfdb]|[RULFDB]w)$/.test(base)) wideCount++;
  }

  const pureRU = wideCount === 0 && fCount === 0 && dCount === 0 && lCount === 0 && rotCount === 0;
  const pureRUL = wideCount === 0 && fCount === 0 && dCount === 0 && rotCount === 0;
  let score = tokens.length * 0.6 + fCount * 1.6 + dCount * 1.4 + rotCount * 3.5 + wideCount * 12;

  if (pureRU) score -= 35;
  else if (pureRUL) score -= 22;

  const clean = tokens.join(' ');
  if (algObj?.isDefault && wideCount === 0 && !hasSliceMoves(clean) && !hasBMoves(clean)) {
    score -= 6;
  }
  if (algObj?.startAuf) score += 0.3;
  if (/^U[2']?$/.test(tokens[0] || '')) score += 1.2;
  score += idx * 0.05;
  return score;
}

function getGenBadge(algStr) {
  const tokens = tokenizeClean(algStr);
  let hasL = false;
  let hasFDWide = false;
  for (const tok of tokens) {
    const m = tok.match(MOVE_TOKEN_REGEX);
    if (!m) continue;
    const base = m[2] || m[3];
    if (base === 'L') hasL = true;
    else if (base !== 'R' && base !== 'U') hasFDWide = true;
  }
  if (!hasFDWide && !hasL) return 'No-Table RU';
  if (!hasFDWide && hasL) return 'No-Table LRU';
  return 'No-Table';
}

function buildNoTableAlgs(trackId, baseAlgs) {
  const withoutSlices = (baseAlgs || []).filter(a => a?.alg && !hasSliceMoves(a.alg));
  const nonWideFront = withoutSlices.filter(a => !hasWideFrontMoves(a.alg));
  const candidates = nonWideFront.length > 0 ? nonWideFront : withoutSlices;

  const expanded = [];
  const seenClean = new Set();
  const pushUnique = (entry, origIdx) => {
    const key = `${entry.startAuf || ''}::${cleanAlg(entry.alg)}`;
    if (!key || seenClean.has(key)) return;
    seenClean.add(key);
    expanded.push({ entry, origIdx });
  };

  candidates.forEach((a, idx) => {
    if (hasBMoves(a.alg)) {
      if (hasOuterBOnly(a.alg)) {
        const rewritten = rewriteBMovesWithXPrime(a.alg);
        if (rewritten) {
          pushUnique({
            ...a,
            id: `${a.id}-xprime-b`,
            alg: rewritten,
            startAuf: a.startAuf || '',
            note: `${a.note ? `${a.note} · ` : ''}B → x' U`,
            ohBadge: "B → x' U",
            isDefault: false,
            isSynthesizedNoTable: true
          }, idx);
        }
      }
      return;
    }

    if (trackId === 'f2l' && tokenizeClean(a.alg).some(t => /^(?:d|Dw)(?:2'?|['2])?$/.test(t))) {
      const rewritten = rewriteDMovesToYPrimeU(a.alg);
      if (rewritten) {
        pushUnique({
          ...a,
          id: `${a.id}-no-table-yu`,
          alg: rewritten,
          startAuf: a.startAuf || '',
          note: `${a.note ? `${a.note} · ` : ''}No-Table OH (d → y' U)`,
          ohBadge: 'No-Table',
          isDefault: false,
          isSynthesizedNoTable: true
        }, idx);
      }
      return;
    }

    pushUnique({ ...a }, idx);
  });

  // Fallback if all algs were filtered out (defensive guard)
  if (expanded.length === 0) {
    return [...(baseAlgs || [])];
  }

  expanded.sort((x, y) => scoreNoTableOhAlg(x.entry, x.origIdx) - scoreNoTableOhAlg(y.entry, y.origIdx));
  return expanded.map(x => x.entry);
}

/**
 * Score how much an alg benefits from a z' <R, U> -> <U, L> rotation.
 */
function hasStrongRuDominance(algStr) {
  const clean = cleanAlg(algStr);
  if (!clean) return false;
  const moves = clean.split(/\s+/).filter(Boolean);
  const ruCount = moves.filter(m => /^[RU][2']?$/.test(m)).length;
  return ruCount >= Math.ceil(moves.length * 0.65);
}

/**
 * Resolve effective algorithm list for a puzzle/track/case given OH handedness (`"left"` or `"right"`)
 * and table-abuse preference (`ohTableAbuse = true` allows M/S/E slices, `false` restricts to in-air L/R/U/F/D).
 */
export function getEffectiveAlgsForCase(puzzleId, trackId, caseObj, { ohHand = 'left', ohTableAbuse = true, trackCases = [] } = {}) {
  const baseAlgs = Array.isArray(caseObj?.algs) ? caseObj.algs : [];
  if (puzzleId !== '333oh' || !caseObj) {
    return baseAlgs;
  }

  const useTable = ohTableAbuse !== false;
  const pool = useTable ? baseAlgs : buildNoTableAlgs(trackId, baseAlgs);

  if (ohHand !== 'right') {
    if (useTable) return baseAlgs;
    const baseDefaultAlg = cleanAlg(baseAlgs[0]?.alg || '');
    return pool.map((a, idx) => {
      const isPrimary = idx === 0;
      const changedPrimary = isPrimary && cleanAlg(a.alg) !== baseDefaultAlg;
      return {
        ...a,
        isDefault: isPrimary,
        ohBadge: a.ohBadge || (changedPrimary ? getGenBadge(a.alg) : undefined)
      };
    });
  }

  const caseByIdMap = new Map((trackCases || []).map(c => [c.id, c]));
  const rhAlgs = [];
  const seen = new Set();

  if (trackId === 'pll' || trackId === 'oll') {
    const partnerInfo = (!useTable && OH_NO_TABLE_MIRROR_OVERRIDES?.[trackId]?.[caseObj.id])
      || OH_MIRROR_PARTNERS?.[trackId]?.[caseObj.id];
    if (partnerInfo) {
      const partnerCase = caseByIdMap.get(partnerInfo.partnerId) || caseObj;
      const sourceAlg = (partnerCase.algs || []).find(a => a.id === partnerInfo.sourceAlgId)
        || partnerCase.algs?.[0];
      if (sourceAlg?.alg) {
        const mirrored = mirrorAlgLR(sourceAlg.alg);
        if (mirrored && !seen.has(mirrored)) {
          seen.add(mirrored);
          const partnerNote = partnerCase.id !== caseObj.id
            ? `Mirrored from ${partnerCase.name || partnerCase.id}`
            : 'Self-mirror <L, U>';
          rhAlgs.push({
            id: `${caseObj.id}-rh-mirror`,
            alg: mirrored,
            startAuf: partnerInfo.startAuf || '',
            note: `Right-Hand OH${useTable ? '' : ' (No Table Abuse)'} · ${partnerNote}`,
            isDefault: true,
            ohBadge: useTable ? 'RH Mirror' : 'RH No-Table',
            isSynthesizedRh: true
          });
        }
      }
    }

    // Add z'-rotated RU->UL option avoiding slice & B moves so both Table and No-Table stay clean
    const rotCandidates = pool.filter(a =>
      !hasSliceMoves(a.alg) && !hasBMoves(a.alg) && !/^[xyz]/i.test(cleanAlg(a.alg))
    );
    const bestRu = rotCandidates.find(a => hasStrongRuDominance(a.alg)) || rotCandidates[0];
    if (bestRu?.alg) {
      const zp = conjugateZPrime(bestRu.alg, { wrap: true });
      if (zp && !seen.has(zp)) {
        seen.add(zp);
        rhAlgs.push({
          id: `${caseObj.id}-rh-zprime`,
          alg: zp,
          startAuf: bestRu.startAuf || '',
          note: `Right-Hand OH${useTable ? '' : ' (No Table Abuse)'} · z' Rotation (<U, L> wrist)`,
          isDefault: rhAlgs.length === 0,
          ohBadge: "RH z'",
          isSynthesizedRh: true
        });
      }
    }
  } else if (trackId === 'f2l') {
    const primary = pool[0];
    if (primary?.alg) {
      const zp = conjugateZPrime(primary.alg, { wrap: true });
      if (zp && !seen.has(zp)) {
        seen.add(zp);
        rhAlgs.push({
          id: `${caseObj.id}-rh-zprime`,
          alg: zp,
          startAuf: primary.startAuf || '',
          note: `Right-Hand OH${useTable ? '' : ' (No Table Abuse)'} · z' Rotation (solve FR slot via <U, L>)`,
          isDefault: true,
          ohBadge: "RH z'",
          isSynthesizedRh: true
        });
      }
      const flMirror = mirrorAlgLR(primary.alg);
      if (flMirror && !seen.has(flMirror)) {
        seen.add(flMirror);
        rhAlgs.push({
          id: `${caseObj.id}-rh-fl-mirror`,
          alg: flMirror,
          startAuf: primary.startAuf || '',
          mirroredSetup: mirrorAlgLR(caseObj.setup || ''),
          note: `Right-Hand OH${useTable ? '' : ' (No Table Abuse)'} · Left-Slot FL Mirror (<L, U>)`,
          isDefault: false,
          ohBadge: 'FL Mirror',
          isFlMirror: true,
          isSynthesizedRh: true
        });
      }
    }
  }

  // Append working-pool reference algs (demoting isDefault since RH option is primary)
  const trailing = [];
  for (const a of pool) {
    if (seen.has(a.alg)) continue;
    seen.add(a.alg);
    trailing.push({
      ...a,
      isDefault: rhAlgs.length === 0 && trailing.length === 0 ? true : false
    });
  }

  return [...rhAlgs, ...trailing];
}
