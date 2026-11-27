// Cubeast CSV Solve Log Importer
// Parses Cubeast CSV exports (with full smart-cube MOVE[MS] move logs, inspection/pickup/putdown
// splits, penalties, notes, and session metadata) and merges idempotently into AppStore.

import { importCsTimerSessions } from './cstimerImport.js';
import { ensureSolveCfop } from '../cfopAnalyzer.js';

function quickHash(str) {
  let h = 2166136261;
  const s = String(str || "");
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(36);
}

/**
 * RFC-4180 CSV parser handling quoted commas, escaped quotes (""), and embedded newlines.
 */
function parseCsvRows(text, delimiter = ",") {
  const rows = [];
  let row = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === delimiter) {
      row.push(cur);
      cur = "";
    } else if (ch === "\r" || ch === "\n") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      row.push(cur);
      cur = "";
      if (row.some(cell => cell.trim() !== "")) {
        rows.push(row);
      }
      row = [];
    } else {
      cur += ch;
    }
  }

  if (cur.length > 0 || row.length > 0) {
    row.push(cur);
    if (row.some(cell => cell.trim() !== "")) {
      rows.push(row);
    }
  }
  return rows;
}

function splitFirstHeaderCols(firstLine) {
  const delimiter = firstLine.includes(";") && !firstLine.includes(",") ? ";" : ",";
  return parseCsvRows(firstLine, delimiter)[0]?.map(h => h.trim().toLowerCase()) || [];
}

/**
 * Quick check whether a text payload looks like a Cubeast CSV export.
 */
export function isCubeastExport(text) {
  const raw = String(text || "").replace(/^\uFEFF/, "").trim();
  if (!raw || raw.startsWith("{") || raw.startsWith("[")) return false;
  const firstLine = raw.split(/\r?\n/, 1)[0] || "";
  if (/^No\.?\s*[;,]\s*Time\s*[;,]/i.test(firstLine)) return false;

  const headers = splitFirstHeaderCols(firstLine);
  if (!headers.includes("id") || !headers.includes("date") || !headers.includes("time")) {
    return false;
  }
  const cubeastCols = [
    "solving_method",
    "solution",
    "session_name",
    "device_model",
    "scramble_provider",
    "turns_per_second",
    "inspection_time"
  ];
  const matches = cubeastCols.filter(col => headers.includes(col)).length;
  return matches >= 2;
}

/**
 * Parse a Cubeast solution string ("D'[0] B'[251] ...") into native smart-cube moves.
 */
export function parseCubeastSolution(solutionStr) {
  const raw = String(solutionStr || "").trim();
  if (!raw) return null;

  const moves = [];
  for (const tok of raw.split(/\s+/)) {
    const m = /^([RUFLBDMSEruflbdxyz][w]?(?:2'?|')?)\[(\d+)\]$/.exec(tok);
    if (!m) continue;
    const move = m[1];
    const t = Number(m[2]);
    const prevT = moves.length > 0 ? moves[moves.length - 1].t : 0;
    moves.push({
      move,
      t,
      split: moves.length > 0 ? Math.max(0, t - prevT) : 0,
      isRotation: /^[xyz]/.test(move)
    });
  }
  return moves.length > 0 ? moves : null;
}

function parseBoolFlag(val) {
  const s = String(val ?? "").trim().toLowerCase();
  return s === "true" || s === "1" || s === "yes";
}

function parseFiniteNum(val) {
  if (val === null || val === undefined) return null;
  const s = String(val).trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function parseCubeastDateMs(dateRaw, fallbackMs) {
  const raw = String(dateRaw || "").trim();
  if (!raw) return fallbackMs;
  const isoCandidate = /\sUTC$/i.test(raw)
    ? raw.replace(/\sUTC$/i, "Z").replace(" ", "T")
    : raw.replace(" ", "T");
  const parsed = Date.parse(isoCandidate);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackMs;
}

function inferCubeastPuzzle(hints = [], sampleScrambles = [], fallbackPuzzle = "333") {
  const text = hints.filter(Boolean).join(" ").toLowerCase();
  if (/\b2x2\b|\b222\b|\bcll\b|\bortega\b|\beg-?[12]\b/.test(text)) {
    const target = /\beg-?1\b/.test(text) ? "eg1" : /\beg-?2\b/.test(text) ? "eg2" : /\bcll\b/.test(text) ? "cll" : "full";
    return { puzzle: "222", target };
  }
  if (/\b3x3\s*oh\b|\b333oh\b|\bone[- ]?handed\b|\boh\b/.test(text)) return { puzzle: "333oh", target: "full" };
  if (/\b3bld\b|\b333bf\b|\bbld\b|\bblind\b/.test(text)) return { puzzle: "333bf", target: "full" };
  if (/\b4x4\b|\b444\b/.test(text)) return { puzzle: "444", target: "full" };
  if (/\b5x5\b|\b555\b/.test(text)) return { puzzle: "555", target: "full" };
  if (/\b6x6\b|\b666\b/.test(text)) return { puzzle: "666", target: "full" };
  if (/\b7x7\b|\b777\b/.test(text)) return { puzzle: "777", target: "full" };
  if (/\bpyra/.test(text)) return { puzzle: "pyram", target: "full" };
  if (/\bskewb/.test(text)) return { puzzle: "skewb", target: "full" };
  if (/\bmega|\bminx/.test(text)) return { puzzle: "minx", target: "full" };
  if (/\bsq-?1|\bsquare-?1/.test(text)) return { puzzle: "sq1", target: "full" };
  if (/\bclock\b/.test(text)) return { puzzle: "clock", target: "full" };
  if (/\bfto\b/.test(text)) return { puzzle: "fto", target: "full" };
  if (/\b3x3\b|\b333\b|\bcfop\b|\broux\b|\bzz\b/.test(text)) return { puzzle: "333", target: "full" };

  if (sampleScrambles.length > 0) {
    const firstTokens = sampleScrambles[0].trim().split(/\s+/).filter(Boolean);
    if (firstTokens.length >= 4 && firstTokens.length <= 13 && firstTokens.every(t => /^[URF][2']?$/.test(t))) {
      return { puzzle: "222", target: "full" };
    }
  }
  return { puzzle: fallbackPuzzle || "333", target: "full" };
}

/**
 * Parse a Cubeast CSV export into grouped sessions ready for AppStore import.
 */
export function parseCubeastExport(text, { defaultPuzzle = "333", filename = "" } = {}) {
  const raw = String(text || "").replace(/^\uFEFF/, "").trim();
  if (!raw) {
    throw new Error("Selected Cubeast file is empty.");
  }

  const firstLine = raw.split(/\r?\n/, 1)[0] || "";
  const delimiter = firstLine.includes(";") && !firstLine.includes(",") ? ";" : ",";
  const rows = parseCsvRows(raw, delimiter);
  if (rows.length < 2) {
    throw new Error("Cubeast CSV file has no solve rows to import.");
  }

  const headers = rows[0].map(h => h.trim().toLowerCase());
  const colIdx = new Map();
  headers.forEach((h, idx) => {
    if (h && !colIdx.has(h)) colIdx.set(h, idx);
  });

  if (!colIdx.has("time") || !colIdx.has("date")) {
    throw new Error("Cubeast CSV header is missing required 'time' or 'date' columns.");
  }

  const getCol = (cols, name) => {
    const idx = colIdx.get(name);
    return idx !== undefined && idx < cols.length ? String(cols[idx] ?? "").trim() : "";
  };

  const cleanedFilename = String(filename || "")
    .replace(/\.[^.]+$/, "")
    .replace(/^solves\s*[-_]\s*/i, "")
    .trim();
  const fallbackSessionName = cleanedFilename ? `Cubeast (${cleanedFilename})` : "Cubeast Import";

  const grouped = new Map();
  const baseFallbackAt = Date.now() - rows.length * 1000;

  for (let i = 1; i < rows.length; i++) {
    const cols = rows[i];
    const timeVal = parseFiniteNum(getCol(cols, "time"));
    const timerTimeVal = parseFiniteNum(getCol(cols, "timer_time"));
    const solvingTimeVal = parseFiniteNum(getCol(cols, "solving_time"));
    if (timeVal === null && timerTimeVal === null && solvingTimeVal === null) continue;

    const sessionName = getCol(cols, "session_name") || fallbackSessionName;
    if (!grouped.has(sessionName)) {
      grouped.set(sessionName, []);
    }

    const dnf = parseBoolFlag(getCol(cols, "dnf"));
    const oneTurnPlus2 = parseBoolFlag(getCol(cols, "one_turn_away_two_second_penalty"));
    const inspPlus2 = parseBoolFlag(getCol(cols, "inspection_two_second_penalty"));

    let penalty = null;
    let rawMs = 0;
    let ms = 0;

    if (dnf) {
      penalty = "DNF";
      rawMs = Math.max(0, Math.round(timerTimeVal ?? timeVal ?? solvingTimeVal ?? 0));
      ms = rawMs;
    } else if (oneTurnPlus2 || inspPlus2) {
      penalty = "+2";
      if (timerTimeVal !== null && timeVal !== null && timeVal >= timerTimeVal + 2000) {
        rawMs = Math.max(0, Math.round(timerTimeVal));
        ms = Math.max(0, Math.round(timeVal));
      } else {
        rawMs = Math.max(0, Math.round(timeVal ?? timerTimeVal ?? solvingTimeVal ?? 0));
        ms = rawMs + 2000;
      }
    } else {
      rawMs = Math.max(0, Math.round(timeVal ?? timerTimeVal ?? solvingTimeVal ?? 0));
      ms = rawMs;
    }

    const rowId = getCol(cols, "id");
    const scramble = getCol(cols, "scramble");
    const note = getCol(cols, "description");
    const at = parseCubeastDateMs(getCol(cols, "date"), baseFallbackAt + i * 1000);
    const moves = parseCubeastSolution(getCol(cols, "solution"));

    const faceMovesInSolution = moves ? moves.filter(m => !m.isRotation).length : 0;
    const csvTurns = parseFiniteNum(getCol(cols, "face_turns")) ?? parseFiniteNum(getCol(cols, "slice_turns"));
    const moveCount = faceMovesInSolution > 0
      ? faceMovesInSolution
      : (moves ? moves.length : (csvTurns !== null ? Math.round(csvTurns) : 0));

    const csvTps = parseFiniteNum(getCol(cols, "turns_per_second"));
    const tps = (moves && rawMs > 0 && moveCount > 0)
      ? Number((moveCount / (rawMs / 1000)).toFixed(2))
      : csvTps;

    const deviceModel = getCol(cols, "device_model");
    const deviceName = getCol(cols, "device_name");
    const smartCube = deviceModel || deviceName || (moves ? "Cubeast Smart Cube" : null);

    const inspMs = parseFiniteNum(getCol(cols, "inspection_time"));
    const pickupMs = parseFiniteNum(getCol(cols, "pickup_time"));
    const putdownMs = parseFiniteNum(getCol(cols, "putdown_time"));
    const timerName = getCol(cols, "timer");

    grouped.get(sessionName).push({
      rowIdx: i,
      rowId,
      ms,
      rawMs,
      penalty,
      at,
      scramble,
      moves,
      moveCount,
      tps,
      smartCube,
      note,
      inspMs,
      pickupMs,
      putdownMs,
      solvingTimeVal,
      oneTurnPlus2,
      timerName,
      sessionRuleset: getCol(cols, "session_ruleset"),
      ruleset: getCol(cols, "ruleset"),
      solvingMethod: getCol(cols, "solving_method")
    });
  }

  if (grouped.size === 0) {
    throw new Error("No valid solve rows found in Cubeast CSV.");
  }

  const sessions = [];
  let totalSolves = 0;

  for (const [sessionName, items] of grouped.entries()) {
    const sampleHints = [
      sessionName,
      items[0]?.sessionRuleset,
      items[0]?.ruleset,
      items[0]?.solvingMethod
    ];
    const sampleScrambles = items.slice(0, 8).map(item => item.scramble).filter(Boolean);
    const { puzzle, target } = inferCubeastPuzzle(sampleHints, sampleScrambles, defaultPuzzle);

    const solves = items.map(item => {
      const uid = item.rowId
        ? `cubeast-${item.rowId}`
        : `cubeast-${item.at}-${item.rawMs}-${quickHash(item.scramble || String(item.rowIdx))}`;
      const solve = {
        uid,
        puzzle,
        track: target === "full" ? undefined : target,
        target,
        id: null,
        ms: item.ms,
        rawMs: item.rawMs,
        penalty: item.penalty,
        at: item.at,
        scramble: item.scramble,
        moves: item.moves || null,
        moveCount: item.moveCount,
        tps: item.tps ?? null,
        smartCube: item.smartCube
      };
      if (item.note) solve.note = item.note;
      if (item.inspMs !== null && item.inspMs > 0) solve.inspectionMs = Math.round(item.inspMs);
      if (item.oneTurnPlus2) solve.finishState = "+2";
      if ((item.pickupMs !== null && item.pickupMs > 0) || (item.putdownMs !== null && item.putdownMs > 0)) {
        const pUp = Math.max(0, Math.round(item.pickupMs || 0));
        const pDown = Math.max(0, Math.round(item.putdownMs || 0));
        solve.pickupMs = pUp;
        solve.putdownMs = pDown;
        solve.cubeMs = item.solvingTimeVal !== null
          ? Math.max(0, Math.round(item.solvingTimeVal))
          : Math.max(0, item.rawMs - pUp - pDown);
      }
      if (item.timerName && item.timerName.toLowerCase() !== "cube") {
        solve.timer = item.timerName;
      }
      return solve;
    });

    solves.sort((a, b) => (a.at || 0) - (b.at || 0));
    totalSolves += solves.length;

    sessions.push({
      id: `cubeast-${quickHash(`${sessionName.toLowerCase()}|${puzzle}`)}`,
      puzzle,
      name: sessionName,
      target,
      size: "medium",
      showCube: true,
      inspection: true,
      updatedAt: solves.length ? solves[solves.length - 1].at : Date.now(),
      solves
    });
  }

  return {
    format: "cubeast-csv",
    sessions,
    totalSolves
  };
}

/**
 * Merge parsed Cubeast sessions into AppStore idempotently and attach CFOP analysis when ready.
 */
export function importCubeastSessions(appStore, parsedExport, { now = Date.now() } = {}) {
  const res = importCsTimerSessions(appStore, parsedExport, { now });
  if (res.changed && Array.isArray(appStore?.state?.sessions)) {
    for (const incoming of parsedExport.sessions || []) {
      const targetSess = appStore.state.sessions.find(sess => sess.id === incoming.id);
      if (!targetSess || (targetSess.puzzle || "333") !== "333") continue;
      for (const sv of targetSess.solves || []) {
        if (sv && Array.isArray(sv.moves) && sv.moves.length > 0 && !sv.cfop) {
          try {
            ensureSolveCfop(sv);
          } catch {}
        }
      }
    }
    appStore.saveSessions();
  }
  return res;
}
