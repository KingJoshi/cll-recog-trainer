// Scramble and Algorithm Parser for 2x2, 3x3, and Big Cubes (4x4, 5x5, ...)
// Supports standard face turns, wide turns, slice turns (e.g. 2R, 3R), rotations, and layer ranges.

export const MOVE_TOKEN_REGEX = /^(?:(?:(\d+(?:-\d+)?)?([RUFBLD]w|[rufbld]|[RUFBLD]))|([xyzMES]))(2'|'2|3'|'3|''|2"|[23'])?$/i;

/**
 * Normalizes algorithm strings, strips unwanted characters, handles punctuation,
 * and cancels or combines consecutive moves on the same layer/face.
 */
export function cleanAlg(algStr) {
  if (!algStr) return "";
  const cleaned = algStr.replace(/[‘’ʻʼ`]/g, "'").replace(/[()[\]{}]/g, " ").replace(/,/g, " ");
  const tokens = cleaned.trim().split(/\s+/).filter(Boolean);
  const result = [];

  for (const token of tokens) {
    const match = token.match(MOVE_TOKEN_REGEX);
    if (!match) {
      result.push(token);
      continue;
    }
    const layer = match[1] || "";
    const base = match[2] || match[3];
    const face = ['x', 'y', 'z'].includes(base.toLowerCase()) ? base.toLowerCase() : base;
    const fullFace = layer + face;
    let mod = match[4] || "";
    if (mod === "'2" || mod === '2"' || mod === "''") mod = "2'";

    let amount = 1;
    if (mod === "'" || mod === "3") amount = 3;
    else if (mod === "2" || mod === "2'") amount = 2;
    else if (mod === "3'" || mod === "'3") amount = 1;

    if (result.length > 0) {
      const prev = result[result.length - 1];
      const prevMatch = prev.match(MOVE_TOKEN_REGEX);
      if (prevMatch) {
        const prevLayer = prevMatch[1] || "";
        const prevBase = prevMatch[2] || prevMatch[3];
        const prevFace = ['x', 'y', 'z'].includes(prevBase.toLowerCase()) ? prevBase.toLowerCase() : prevBase;
        const prevFullFace = prevLayer + prevFace;

        if (prevFullFace.toUpperCase() === fullFace.toUpperCase()) {
          let prevMod = prevMatch[4] || "";
          if (prevMod === "'2" || prevMod === '2"' || prevMod === "''") prevMod = "2'";
          let prevAmount = 1;
          if (prevMod === "'" || prevMod === "3") prevAmount = 3;
          else if (prevMod === "2" || prevMod === "2'") prevAmount = 2;
          else if (prevMod === "3'" || prevMod === "'3") prevAmount = 1;

          const total = (prevAmount + amount) % 4;
          result.pop();
          if (total === 1) result.push(prevFullFace);
          else if (total === 2) result.push(prevFullFace + "2");
          else if (total === 3) result.push(prevFullFace + "'");
          continue;
        }
      }
    }
    if (amount === 1) result.push(fullFace);
    else if (amount === 2) {
      result.push(mod === "2'" ? fullFace + "2'" : fullFace + "2");
    }
    else if (amount === 3) result.push(fullFace + "'");
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
  let cleaned = raw.replace(/[‘’ʻʼ`]/g, "'").replace(/[()[\]{}]/g, " ").replace(/,/g, " ").replace(/\s+/g, " ").trim();
  if (!cleaned) {
    return { ok: false, error: "Scramble cannot be empty." };
  }

  // Detect orientation for metadata tag
  let orientation = "";
  const orientMatch = cleaned.match(/^((?:[xyz](?:2'|'2|3'|''|2"|[23'])?\s*)+)/i);
  if (orientMatch) {
    orientation = cleanAlg(orientMatch[1]);
  }

  const tokens = cleaned.split(/\s+/).filter(Boolean);
  const moves = [];
  for (const token of tokens) {
    const match = token.match(MOVE_TOKEN_REGEX);
    if (!match) {
      return {
        ok: false,
        error: `Invalid move token "${token}". Allowed moves: R, U, F, B, L, D, M, E, S, x, y, z, slice moves (e.g. 2R, 3R), and wide moves (e.g. Rw, 2Rw, 3Rw) with optional 2, ', or 2'.`
      };
    }
    const layer = match[1] || "";
    const base = match[2] || match[3];
    const face = ['x', 'y', 'z'].includes(base.toLowerCase()) ? base.toLowerCase() : base;
    const fullFace = layer + face;
    let mod = match[4] || "";
    if (mod === "3") mod = "'";
    else if (mod === "3'" || mod === "'3") mod = "";
    else if (mod === "'2" || mod === '2"' || mod === "''") mod = "2'";
    moves.push(fullFace + mod);
  }

  return {
    ok: true,
    orientation,
    moves,
    error: null
  };
}
