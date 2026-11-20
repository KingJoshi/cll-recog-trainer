// Left-Right Symmetry Mirroring & z'-Conjugation Engine for 3x3 One-Handed (OH) Solving
// Supports Left-Handed OH (standard <R, U>) and Right-Handed OH (mirrored <L, U> + z' <U, L>)

import { cleanAlg, MOVE_TOKEN_REGEX } from '../algParser.js';
import { OH_MIRROR_PARTNERS } from '../data/ohMirrorMap.js';

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
 * Resolve effective algorithm list for a puzzle/track/case given OH handedness (`"left"` or `"right"`).
 */
export function getEffectiveAlgsForCase(puzzleId, trackId, caseObj, { ohHand = 'left', trackCases = [] } = {}) {
  const baseAlgs = Array.isArray(caseObj?.algs) ? caseObj.algs : [];
  if (puzzleId !== '333oh' || ohHand !== 'right' || !caseObj) {
    return baseAlgs;
  }

  const caseByIdMap = new Map((trackCases || []).map(c => [c.id, c]));
  const rhAlgs = [];
  const seen = new Set();

  if (trackId === 'pll' || trackId === 'oll') {
    const partnerInfo = OH_MIRROR_PARTNERS?.[trackId]?.[caseObj.id];
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
            note: `Right-Hand OH · ${partnerNote}`,
            isDefault: true,
            ohBadge: 'RH Mirror',
            isSynthesizedRh: true
          });
        }
      }
    }

    // Add z'-rotated RU->UL option if the primary alg is strongly <R, U>-dominant
    const bestRu = baseAlgs.find(a => hasStrongRuDominance(a.alg)) || baseAlgs[0];
    if (bestRu?.alg && !/^[xyz]/i.test(cleanAlg(bestRu.alg))) {
      const zp = conjugateZPrime(bestRu.alg, { wrap: true });
      if (zp && !seen.has(zp)) {
        seen.add(zp);
        rhAlgs.push({
          id: `${caseObj.id}-rh-zprime`,
          alg: zp,
          startAuf: bestRu.startAuf || '',
          note: `Right-Hand OH · z' Rotation (<U, L> wrist)`,
          isDefault: rhAlgs.length === 0,
          ohBadge: "RH z'",
          isSynthesizedRh: true
        });
      }
    }
  } else if (trackId === 'f2l') {
    const primary = baseAlgs[0];
    if (primary?.alg) {
      const zp = conjugateZPrime(primary.alg, { wrap: true });
      if (zp && !seen.has(zp)) {
        seen.add(zp);
        rhAlgs.push({
          id: `${caseObj.id}-rh-zprime`,
          alg: zp,
          startAuf: primary.startAuf || '',
          note: `Right-Hand OH · z' Rotation (solve FR slot via <U, L>)`,
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
          note: `Right-Hand OH · Left-Slot FL Mirror (<L, U>)`,
          isDefault: false,
          ohBadge: 'FL Mirror',
          isFlMirror: true,
          isSynthesizedRh: true
        });
      }
    }
  }

  // Append original reference algs (demoting isDefault since RH option is now default)
  const trailing = [];
  for (const a of baseAlgs) {
    if (seen.has(a.alg)) continue;
    seen.add(a.alg);
    trailing.push({
      ...a,
      isDefault: rhAlgs.length === 0 ? Boolean(a.isDefault) : false
    });
  }

  return [...rhAlgs, ...trailing];
}
