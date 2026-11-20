// Scramble and Algorithm Parser for 2x2, 3x3, and Big Cubes (4x4, 5x5, ...)
// Supports standard face turns, wide turns, slice turns (e.g. 2R, 3R), rotations, and layer ranges.

export const MOVE_TOKEN_REGEX = /^(?:(?:(\d+(?:-\d+)?)?([RUFBLD]w|[rufbld]|[RUFBLD]))|([MESxyz]))(2'|'2|3'|'3|''|2"|[23'])?$/;

function invertToken(token) {
  const parsed = parseToken(token);
  if (!parsed) return token;
  if (parsed.amount === 2) return token;
  return parsed.amount === 1 ? `${parsed.fullFace}'` : parsed.fullFace;
}

function expandRepeats(str) {
  let prev;
  let curr = str;
  const repeatRegex = /\(([^()]+)\)\s*([2-9])?(')?/g;
  // Support nested trigger repeats and SiGN group inversions such as (R U R' U')2'
  do {
    prev = curr;
    curr = curr.replace(repeatRegex, (full, inner, countStr, prime) => {
      if (!countStr && !prime) return full;
      const count = countStr ? Number(countStr) : 1;
      const tokens = inner.trim().split(/\s+/).filter(Boolean);
      const seq = prime ? [...tokens].reverse().map(invertToken) : tokens;
      return Array(count).fill(seq.join(" ")).join(" ");
    });
  } while (curr !== prev);
  return curr;
}

function normalizePunctuation(raw) {
  const normalizedQuotes = raw.replace(/[‘’ʻʼ`]/g, "'");
  return expandRepeats(normalizedQuotes)
    .replace(/[()[\]{}]/g, " ")
    .replace(/,/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseToken(token) {
  const match = token.match(MOVE_TOKEN_REGEX);
  if (!match) return null;
  const layer = match[1] || "";
  const base = match[2] || match[3];
  const fullFace = layer + base;
  let mod = match[4] || "";
  if (mod === "'2" || mod === '2"' || mod === "''") mod = "2'";

  let amount = 1;
  if (mod === "'" || mod === "3") amount = 3;
  else if (mod === "2" || mod === "2'") amount = 2;
  else if (mod === "3'" || mod === "'3") amount = 1;

  return { fullFace, mod, amount };
}

/**
 * Normalizes algorithm strings, strips unwanted characters, expands trigger repeats,
 * and cancels or combines consecutive moves on the exact same layer/face.
 */
export function cleanAlg(algStr) {
  if (!algStr) return "";
  const cleaned = normalizePunctuation(algStr);
  const tokens = cleaned ? cleaned.split(/\s+/) : [];
  const result = [];

  for (const token of tokens) {
    const parsed = parseToken(token);
    if (!parsed) {
      result.push(token);
      continue;
    }

    if (result.length > 0) {
      const prevParsed = parseToken(result[result.length - 1]);
      if (prevParsed && prevParsed.fullFace === parsed.fullFace) {
        const total = (prevParsed.amount + parsed.amount) % 4;
        result.pop();
        if (total === 1) result.push(prevParsed.fullFace);
        else if (total === 2) result.push(prevParsed.fullFace + "2");
        else if (total === 3) result.push(prevParsed.fullFace + "'");
        continue;
      }
    }

    if (parsed.amount === 1) result.push(parsed.fullFace);
    else if (parsed.amount === 2) {
      result.push(parsed.mod === "2'" ? parsed.fullFace + "2'" : parsed.fullFace + "2");
    } else if (parsed.amount === 3) {
      result.push(parsed.fullFace + "'");
    }
  }
  return result.join(" ");
}

/**
 * Normalizes algorithm for comparison (e.g. converting 2' to 2).
 */
export function normalizeAlgForCompare(algStr) {
  if (!algStr) return "";
  return cleanAlg(algStr).replace(/2'/g, "2");
}

/**
 * Validates and parses raw scramble text into an array of clean move tokens,
 * isolating leading orientation rotations for cube setup.
 */
export function parseScrambleInput(raw) {
  if (!raw || typeof raw !== "string") {
    return { ok: false, error: "Please enter a scramble string." };
  }
  const cleaned = normalizePunctuation(raw);
  if (!cleaned) {
    return { ok: false, error: "Scramble cannot be empty." };
  }

  let orientation = "";
  const orientMatch = cleaned.match(/^((?:[xyz](?:2'|'2|3'|'3|''|2"|[23'])?\s*)+)/);
  if (orientMatch) {
    orientation = cleanAlg(orientMatch[1]);
  }

  const tokens = cleaned.split(/\s+/).filter(Boolean);
  const moves = [];
  for (const token of tokens) {
    const parsed = parseToken(token);
    if (!parsed) {
      return {
        ok: false,
        error: `Invalid move token "${token}". Allowed moves: R, U, F, B, L, D, M, E, S, x, y, z, slice moves (e.g. 2R, 3R), and wide moves (e.g. Rw, 2Rw, 3Rw) with optional 2, ', or 2'.`
      };
    }
    const suffix = parsed.amount === 1
      ? ""
      : (parsed.amount === 2 ? (parsed.mod === "2'" ? "2'" : "2") : "'");
    moves.push(parsed.fullFace + suffix);
  }

  return {
    ok: true,
    orientation,
    moves,
    error: null
  };
}
