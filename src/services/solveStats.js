// Pure solve timing, penalty handling, WCA trimmed averages, and CSV export helpers

export function getSolveTime(solve) {
  if (!solve) return null;
  const isDNF = solve.penalty === -1 || solve.penalty === "DNF";
  if (isDNF) return Infinity;
  const isPlus2 = solve.penalty === 2 || solve.penalty === "+2";
  if (solve.rawMs != null && Number.isFinite(solve.rawMs)) {
    return isPlus2 ? solve.rawMs + 2000 : solve.rawMs;
  }
  const baseMs = solve.ms != null ? solve.ms : (solve.time != null ? solve.time : 0);
  return isPlus2 ? baseMs + 2000 : baseMs;
}

export function filterSolves(solves = [], criteria = {}) {
  return solves.filter(s => {
    if (criteria.puzzle && s.puzzle && s.puzzle !== criteria.puzzle) return false;
    if (criteria.track && s.track && s.track !== criteria.track) return false;
    if (criteria.target && s.target !== criteria.target) return false;
    if (criteria.caseId && s.id !== criteria.caseId) return false;
    return true;
  });
}

export function groupSolvesByCase(solves = [], caseIds = []) {
  const caseIdSet = new Set(caseIds);
  const map = new Map();
  for (const s of solves) {
    if (s.id && (caseIds.length === 0 || caseIdSet.has(s.id))) {
      if (!map.has(s.id)) map.set(s.id, []);
      const t = getSolveTime(s);
      if (Number.isFinite(t)) {
        map.get(s.id).push(t);
      }
    }
  }
  return map;
}

export function computeCaseStats(times = []) {
  if (!times || times.length === 0) {
    return { attempts: 0, best: null, worst: null, mean: null, median: null };
  }
  const attempts = times.length;
  const best = Math.min(...times);
  const worst = Math.max(...times);
  const sum = times.reduce((acc, t) => acc + t, 0);
  const mean = Math.round(sum / attempts);
  const sorted = [...times].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 !== 0 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  return { attempts, best, worst, mean, median };
}

export function computeAverageOfN(solves, n) {
  if (!solves || solves.length < n) return null;
  const recent = solves.slice(0, n);
  const times = recent.map(s => getSolveTime(s));
  const trim = n < 40 ? 1 : Math.ceil(n * 0.05);

  const dnfCount = times.filter(t => t === Infinity).length;
  if (dnfCount > trim) return -1; // DNF

  // Sort ascending, drop `trim` fastest and `trim` slowest (WCA 5% trimming)
  times.sort((a, b) => a - b);
  const trimmed = times.slice(trim, n - trim);
  if (trimmed.some(t => !Number.isFinite(t))) return -1;
  const sum = trimmed.reduce((acc, t) => acc + t, 0);
  return Math.round(sum / trimmed.length);
}

export function getBestAverageOfN(solves, n) {
  if (!solves || solves.length < n) return null;
  let best = null;
  for (let i = 0; i <= solves.length - n; i++) {
    const ao = computeAverageOfN(solves.slice(i, i + n), n);
    if (ao !== null && ao !== -1 && Number.isFinite(ao) && (best === null || ao < best)) {
      best = ao;
    }
  }
  return best;
}

export function computeStats(solves = []) {
  const validTimes = solves
    .map(s => getSolveTime(s))
    .filter(t => t != null && Number.isFinite(t));

  if (validTimes.length === 0) {
    return { count: solves.length, validCount: 0, best: null, worst: null, ao5: null, ao12: null, ao100: null, mean: null, median: null };
  }

  const best = Math.min(...validTimes);
  const worst = Math.max(...validTimes);
  const sum = validTimes.reduce((acc, t) => acc + t, 0);
  const mean = Math.round(sum / validTimes.length);
  const sorted = [...validTimes].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 !== 0 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);

  return {
    count: solves.length,
    validCount: validTimes.length,
    best,
    worst,
    mean,
    median,
    ao5: computeAverageOfN(solves, 5),
    ao12: computeAverageOfN(solves, 12),
    ao100: computeAverageOfN(solves, 100)
  };
}

export function exportSolvesToCSV(solves = [], sessionName = "Session") {
  const headers = [
    "No",
    "Time(s)",
    "Penalty",
    "Raw Time(ms)",
    "Puzzle",
    "Track",
    "Case",
    "Target",
    "Scramble",
    "Date",
    "Cross(s)",
    "F2L1(s)",
    "F2L2(s)",
    "F2L3(s)",
    "F2L4(s)",
    "OLL(s)",
    "PLL(s)",
    "OLL Case",
    "PLL Case",
    "Pauses",
    "Pause Time(s)",
    "Pickup(s)",
    "Cube Time(s)",
    "Putdown(s)",
    "Timer"
  ];

  const fmtSec = (ms) => (typeof ms === "number" && Number.isFinite(ms) ? (ms / 1000).toFixed(2) : "");

  const rows = solves.map((s, idx) => {
    const rawMs = (s.rawMs != null && Number.isFinite(s.rawMs))
      ? s.rawMs
      : (s.ms != null ? s.ms : (s.time != null ? s.time : 0));
    const effectiveMs = getSolveTime(s);
    const penalty = (s.penalty === -1 || s.penalty === "DNF") ? "DNF" : ((s.penalty === 2 || s.penalty === "+2") ? "+2" : "OK");
    const finalSec = penalty === "DNF" ? "DNF" : (effectiveMs / 1000).toFixed(2);
    const dateStr = s.at ? new Date(s.at).toISOString().replace("T", " ").substring(0, 19) : "";
    const cleanScramble = (s.scramble || "").replace(/"/g, '""');
    const sp = s.cfop?.splits || {};
    const ollName = (s.cfop?.ollCase?.shortName || s.cfop?.ollCase?.id || "").replace(/"/g, '""');
    const pllName = (s.cfop?.pllCase?.shortName || s.cfop?.pllCase?.id || "").replace(/"/g, '""');
    const pauseCount = s.cfop?.pauses?.totalCount != null ? s.cfop.pauses.totalCount : "";
    const pauseSec = s.cfop?.pauses?.totalMs != null ? fmtSec(s.cfop.pauses.totalMs) : "";

    return [
      idx + 1,
      finalSec,
      penalty,
      rawMs,
      s.puzzle || "",
      s.track || "",
      s.id || s.caseTag || "",
      s.target || "",
      `"${cleanScramble}"`,
      `"${dateStr}"`,
      fmtSec(sp.cross),
      fmtSec(sp.f2l1),
      fmtSec(sp.f2l2),
      fmtSec(sp.f2l3),
      fmtSec(sp.f2l4),
      fmtSec(sp.oll),
      fmtSec(sp.pll),
      `"${ollName}"`,
      `"${pllName}"`,
      pauseCount,
      pauseSec,
      fmtSec(s.pickupMs),
      fmtSec(s.cubeMs),
      fmtSec(s.putdownMs),
      s.timer ? `"${String(s.timer).replace(/"/g, '""')}"` : ""
    ].join(",");
  });

  return [headers.join(","), ...rows].join("\r\n");
}

export function downloadCSV(content, filename = "speedcube-solves.csv") {
  if (typeof document === "undefined" || typeof URL === "undefined") return;
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
