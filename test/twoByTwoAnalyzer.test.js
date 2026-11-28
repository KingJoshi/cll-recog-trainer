import test from 'node:test';
import assert from 'node:assert';
import { Alg } from 'cubing/alg';
import { cllCases } from '../src/data/cllData.js';
import { eg1Cases, eg2Cases } from '../src/data/egData.js';
import { getSolvedOrientations } from '../src/cube/cubeUtils.js';
import { DEFAULT_PAUSE_THRESHOLD_MS } from '../src/cfopAnalyzer.js';
import {
  TWO_BY_TWO_COLOR_NAMES,
  TWO_BY_TWO_ANALYSIS_VERSION,
  initTwoByTwoAnalyzer,
  isTwoByTwoAnalyzerReady,
  computeCllCanonicalKey,
  computeEg1CanonicalKey,
  computeEg2CanonicalKey,
  identifyCllFromPattern,
  identifyEgFromPattern,
  analyzeTwoByTwoSolve,
  ensureSolveTwoByTwo,
  reanalyzeTwoByTwoSolves,
  computeTwoByTwoAverages,
  computeCllCaseStats,
} from '../src/twoByTwoAnalyzer.js';
import {
  renderCfopStepTable,
  renderLastSolveCfopInline,
  renderCllCasesBreakdownHtml,
  renderOllPllCasesBreakdownHtml,
} from '../src/features/solve/cfopBreakdownRenderer.js';
import {
  collectCaseSolves,
  renderCaseSolvesModalBodyHtml,
} from '../src/features/modals/caseSolvesModal.js';
import { createSessionLogView } from '../src/features/stats/sessionLogView.js';
import { AppStore } from '../src/state/appStore.js';
import { mergeSyncPayloads } from '../src/services/syncMerge.js';

// Map a move sequence in standard D-bottom frame into physical moves for another base orientation
const FACE_MAP_BY_ROT = {
  "":   { U: "U", D: "D", R: "R", L: "L", F: "F", B: "B" },
  "x2": { U: "D", D: "U", R: "R", L: "L", F: "B", B: "F" },
  "x'": { U: "B", D: "F", R: "R", L: "L", F: "U", B: "D" },
  "x":  { U: "F", D: "B", R: "R", L: "L", F: "D", B: "U" },
  "z":  { U: "L", D: "R", R: "U", L: "D", F: "F", B: "B" },
  "z'": { U: "R", D: "L", R: "D", L: "U", F: "F", B: "B" },
};

const BASE_ROT_BY_COLOR = {
  Yellow: "",
  White: "x2",
  Green: "x'",
  Blue: "x",
  Red: "z",
  Orange: "z'",
};

function mapAlgTokens(algStr, rotKey) {
  const faceMap = FACE_MAP_BY_ROT[rotKey] || FACE_MAP_BY_ROT[""];
  return String(algStr || "")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map(tok => {
      const m = tok.match(/^([UDRLFB])([2']?)$/);
      if (!m) throw new Error(`Unsupported token in test helper: ${tok}`);
      return `${faceMap[m[1]]}${m[2]}`;
    });
}

function buildTimedMoves(moveTokens, { pauseAtIdx = -1, pauseMs = 520, stepMs = 150 } = {}) {
  let t = 0;
  return moveTokens.map((move, idx) => {
    const split = idx === pauseAtIdx ? pauseMs : stepMs;
    t += split;
    return { move, t, split };
  });
}

function makeRealisticTwoByTwoSolve({
  color = "White",
  cllId = "T1",
  layerStdTokens = ["D'", "R", "U'", "R'"],
  preAufStd = "U",
  postAufStd = "U'",
  pauseBeforeCllMs = 540,
  stepMs = 160,
  pickupMs = 240,
  putdownMs = 190,
  inspectionMs = 4200,
  target = "full",
} = {}) {
  const rotKey = BASE_ROT_BY_COLOR[color];
  const cllObj = cllCases.find(c => c.id === cllId);
  assert.ok(cllObj, `Expected CLL case ${cllId}`);
  const algStr = cllObj.algs[0].alg;

  const layerTokens = mapAlgTokens(layerStdTokens.join(" "), rotKey);
  const preTokens = preAufStd ? mapAlgTokens(preAufStd, rotKey) : [];
  const execTokens = mapAlgTokens(algStr, rotKey);
  const postTokens = postAufStd ? mapAlgTokens(postAufStd, rotKey) : [];

  const cllTokens = [...preTokens, ...execTokens, ...postTokens];
  const allTokens = [...layerTokens, ...cllTokens];
  const scramble = new Alg(allTokens.join(" ")).invert().toString();
  const moves = buildTimedMoves(allTokens, {
    pauseAtIdx: layerTokens.length,
    pauseMs: pauseBeforeCllMs,
    stepMs,
  });
  const cubeMs = moves[moves.length - 1]?.t || 0;
  const rawMs = pickupMs + cubeMs + putdownMs;

  return {
    puzzle: "222",
    target,
    ms: rawMs,
    rawMs,
    cubeMs,
    pickupMs,
    putdownMs,
    inspectionMs,
    penalty: null,
    scramble,
    moves,
    moveCount: moves.length,
    tps: cubeMs > 0 ? Number((moves.length / (cubeMs / 1000)).toFixed(2)) : 0,
    at: 1700001000000,
  };
}

test('computeCllCanonicalKey maps all 40 CLL cases uniquely with zero Skip collision', async () => {
  await initTwoByTwoAnalyzer();
  assert.strictEqual(isTwoByTwoAnalyzerReady(), true);

  const { defaultPat } = await getSolvedOrientations("2x2x2");
  const keys = new Set();

  for (const c of cllCases) {
    const pat = defaultPat.applyAlg(new Alg(c.setup));
    const key = computeCllCanonicalKey(pat);
    assert.ok(key, `Expected canonical key for ${c.id}`);
    assert.notStrictEqual(key, "00102030", `Case ${c.id} must not collide with CLL Skip`);
    assert.strictEqual(keys.has(key), false, `Duplicate canonical key ${key} at ${c.id}`);
    keys.add(key);

    const identified = identifyCllFromPattern(pat);
    assert.ok(identified, `identifyCllFromPattern failed for ${c.id}`);
    assert.strictEqual(identified.cllCase.id, c.id);
    assert.strictEqual(identified.isSkip, false);
  }

  assert.strictEqual(keys.size, 40);
  const skipId = identifyCllFromPattern(defaultPat);
  assert.strictEqual(skipId.cllCase.id, "cll-skip");
  assert.strictEqual(skipId.isSkip, true);
});

test('analyzeTwoByTwoSolve detects all 6 1st-layer colors color-neutrally plus exact CLL, recog/exec, AUF, and pauses', async () => {
  await initTwoByTwoAnalyzer();

  const casesByColor = [
    ["White", "T1"],
    ["Yellow", "H2"],
    ["Green", "U4"],
    ["Blue", "P1"],
    ["Red", "L3"],
    ["Orange", "S5"],
  ];

  for (const [color, cllId] of casesByColor) {
    const solve = makeRealisticTwoByTwoSolve({
      color,
      cllId,
      layerStdTokens: ["D'", "R", "U'", "R'"],
      preAufStd: "U",
      postAufStd: "U2",
      pauseBeforeCllMs: 560,
      stepMs: 150,
    });

    const res = await analyzeTwoByTwoSolve(solve);
    assert.ok(res, `Expected analysis for ${color} + ${cllId}`);
    assert.strictEqual(res.method, "cll");
    assert.strictEqual(res.layerColor, color, `Expected 1st layer color ${color}`);
    assert.strictEqual(res.cllCase?.id, cllId, `Expected CLL ${cllId} on ${color}`);
    assert.strictEqual(res.cllCase.isSkip, false);

    // 1st Layer step (4 moves * 150ms = 600ms)
    const layerStep = res.steps.find(s => s.phase === "layer");
    assert.ok(layerStep);
    assert.strictEqual(layerStep.caseId, color);
    assert.strictEqual(layerStep.moveCount, 4);
    assert.strictEqual(layerStep.ms, 600);

    // CLL step: starts with 560ms pause + leading U adjustments folded into Recog until first non-U move
    const cllStep = res.steps.find(s => s.phase === "cll");
    assert.ok(cllStep);
    assert.strictEqual(cllStep.caseId, cllId);
    assert.ok(cllStep.recogMs >= 710, `Expected recogMs >= 710ms, got ${cllStep.recogMs}`);
    if (cllId === "T1") assert.strictEqual(cllStep.recogMs, 710);
    assert.strictEqual(cllStep.setupMs, 0);
    assert.strictEqual(cllStep.recogMs + cllStep.execMs, cllStep.ms);
    assert.strictEqual(cllStep.setupMoves.length > 0, true);

    // Post-AUF separated and excluded from CLL time
    assert.ok(res.aufSummary);
    assert.notStrictEqual(res.aufSummary.caseId, "None");
    assert.strictEqual(res.aufSummary.ms, 150);
    assert.strictEqual(res.splits.auf, 150);
    const cubeTotalMs = solve.moves[solve.moves.length - 1].t;
    assert.strictEqual(res.splits.layer + res.splits.cll + res.splits.auf, cubeTotalMs);
    assert.strictEqual(res.aufSummary.accumMs, cubeTotalMs);

    // Pause >= 400ms
    assert.strictEqual(res.pauses.thresholdMs, DEFAULT_PAUSE_THRESHOLD_MS);
    assert.strictEqual(res.pauses.totalCount, 1);
    assert.strictEqual(res.pauses.totalMs, 560);
    assert.strictEqual(res.cllCase.pauseCount, 1);
  }
});

test('analyzeTwoByTwoSolve handles pure {U, R, F} smart cube solves (Yellow/D, Blue/B, Orange/L) and CLL Skip', async () => {
  await initTwoByTwoAnalyzer();

  // Pure {U, R, F} solve with Blue on B (CLL executed on F face!)
  const blueF = makeRealisticTwoByTwoSolve({
    color: "Blue",
    cllId: "A1",
    layerStdTokens: ["R", "U'", "R'"],
    preAufStd: "U",
    postAufStd: "",
    pauseBeforeCllMs: 480,
    stepMs: 140,
  });
  // Verify every token is strictly in {U, R, F} (A1 default alg R' U' R U' R' U2 R mapped by x -> {R, F})
  assert.ok(blueF.moves.every(m => /^[URF]/.test(m.move)), `Expected pure {U,R,F} moves, got ${blueF.moves.map(m => m.move).join(' ')}`);

  const resBlue = await analyzeTwoByTwoSolve(blueF);
  assert.strictEqual(resBlue.layerColor, "Blue");
  assert.strictEqual(resBlue.cllCase.id, "A1");
  assert.strictEqual(resBlue.aufSummary.caseId, "None");

  // CLL Skip with trailing U2 AUF after 1st Layer on Yellow (D)
  const skipTokens = ["R", "U'", "R'", "U2"];
  const skipSolve = {
    puzzle: "222",
    target: "full",
    ms: 820,
    rawMs: 820,
    cubeMs: 820,
    scramble: new Alg(skipTokens.join(" ")).invert().toString(),
    moves: buildTimedMoves(skipTokens, { pauseAtIdx: 3, pauseMs: 420, stepMs: 133 }),
  };
  const resSkip = await analyzeTwoByTwoSolve(skipSolve);
  assert.strictEqual(resSkip.layerColor, "Yellow");
  assert.strictEqual(resSkip.cllCase.id, "cll-skip");
  assert.strictEqual(resSkip.cllCase.isSkip, true);
  assert.strictEqual(resSkip.aufSummary.caseId, "U2");
});

test('analyzeTwoByTwoSolve supports Ortega mode (explicit ortega and auto fallback for 1st face)', async () => {
  await initTwoByTwoAnalyzer();

  // 1st face has swapped bottom-front corners (via R2 F2), then OLL Sune, then adjacent-adjacent PBL
  const ortegaMoves = [
    // Face fix (non-layer face: R U' R' on top of R2? Let us solve D face incorrectly via R2 before OLL!)
    "R2", "U'", "R2",
    // Make D face have adjacent swap relative to D-solved while keeping face solved: wait, F2 R2 keeps top/bottom colors!
    // Working forward to solved: 1st face build (putting Yellow on D with swapped perm) -> OLL -> PBL
    "R", "U'", "R'", "U'", "R", "U", "R'", // part of solve
  ];
  // Construct clean backward sequence from solved:
  // End: solved.
  // Before PBL: R2 U' R2 U2 F2 U' R2 (classic Ortega PBL wait let us verify solves cube cleanly -> inverse scrambles it)
  // Actually simplest valid sequence where D face has Yellow color (swapped perm) right after 1st Face:
  // Face step: "R U R'" leaves Yellow corners at D with wrong perm if preceded by scramble!
  // Let afterFace = before(OLL + PBL), where state has Yellow on D slots with swapped permutation:
  // Take swap on D = (R2 F2 R2): wait (D is solved color Yellow, swapped perm!)
  // Wait: PBL alg = R2 U' B2 U2 R2 U' R2! After applying (U R U R' U R U2 R') (Sune inverted -> OLL state) and PBL^-1:
  const pblAlg = "R2 U' B2 U2 R2 U' R2"; // Solves adj-adj PBL
  const ollAlg = "R U R' U R U2 R'"; // Antisune/Sune
  // Apply pblAlg.invert() then ollAlg.invert() from solved: top has unoriented White, bottom STILL has Yellow stickers with adjacent swap!
  // Now append a face-building move sequence, say inverse("F R"): if faceSolve = ["F", "R"], scramble = (faceSolve + ollAlg + pblAlg)^-1!
  const faceSolve = ["F", "R"];
  const allOrtega = [...faceSolve, ...ollAlg.split(" "), ...pblAlg.split(" ")];
  const solve = {
    puzzle: "222",
    target: "full",
    ms: 2800,
    rawMs: 2800,
    cubeMs: 2800,
    scramble: new Alg(allOrtega.join(" ")).invert().toString(),
    moves: buildTimedMoves(allOrtega, { pauseAtIdx: 2, pauseMs: 450, stepMs: 140 }),
  };

  // Explicit Ortega mode
  const resOrtega = await analyzeTwoByTwoSolve(solve, { twoByTwoMethod: "ortega" });
  assert.ok(resOrtega);
  assert.strictEqual(resOrtega.method, "ortega");
  assert.strictEqual(resOrtega.layerColor, "Yellow");
  assert.ok(resOrtega.splits.face > 0);
  assert.ok(resOrtega.splits.oll > 0);
  assert.ok(resOrtega.splits.pbl > 0);

  // Auto mode detects Ortega since 1st Face is formed long before any full 1st Layer exists
  const resAuto = await analyzeTwoByTwoSolve(solve, { twoByTwoMethod: "auto" });
  assert.ok(resAuto);
  assert.strictEqual(resAuto.method, "ortega");
  assert.strictEqual(resAuto.layerColor, "Yellow");
});

test('computeTwoByTwoAverages, computeCllCaseStats, CFOP breakdown renderer, sessionLogView, and AppStore sync work end-to-end', async () => {
  await initTwoByTwoAnalyzer();

  const solve1 = makeRealisticTwoByTwoSolve({ color: "White", cllId: "H1", stepMs: 140, pauseBeforeCllMs: 460 });
  const solve2 = makeRealisticTwoByTwoSolve({ color: "Green", cllId: "H1", stepMs: 180, pauseBeforeCllMs: 620 });
  const solve3 = makeRealisticTwoByTwoSolve({ color: "Yellow", cllId: "T2", stepMs: 120, pauseBeforeCllMs: 300 });
  ensureSolveTwoByTwo(solve1);
  ensureSolveTwoByTwo(solve2);
  ensureSolveTwoByTwo(solve3);

  const avgs = computeTwoByTwoAverages([solve1, solve2, solve3]);
  assert.strictEqual(avgs.count, 3);
  assert.strictEqual(avgs.analyzedCount, 3);
  assert.ok(avgs.layer > 0);
  assert.ok(avgs.cll > 0);
  assert.ok(avgs.median.layer > 0);
  assert.ok(avgs.median.cll > 0);
  assert.strictEqual(avgs.layerMoves, 4);

  const cllStats = computeCllCaseStats([solve1, solve2, solve3]);
  assert.strictEqual(cllStats.length, 2);
  const h1Stat = cllStats.find(c => c.id === "H1");
  assert.ok(h1Stat);
  assert.strictEqual(h1Stat.attempts, 2);
  assert.strictEqual(h1Stat.avgPauseCount, 1);

  // renderCfopStepTable & renderLastSolveCfopInline for 2x2 solve
  const tableHtml = renderCfopStepTable(solve1, { detailed: true, twoByTwoMethod: "cll" });
  assert.ok(tableHtml.includes("1st Layer"));
  assert.ok(tableHtml.includes("face-dot-white"));
  assert.ok(tableHtml.includes("H1"));
  assert.ok(tableHtml.includes("AUF"));
  const inlineBasicHtml = renderLastSolveCfopInline(solve1, { basic: true, refMedians: avgs.median });
  assert.ok(inlineBasicHtml.includes("cfop-step-table-basic"));
  assert.ok(inlineBasicHtml.includes("1st Layer"));

  // renderCllCasesBreakdownHtml
  const breakdownHtml = renderCllCasesBreakdownHtml([solve1, solve2, solve3], {
    cllOpen: true,
    twoByTwoMethod: "cll",
  });
  assert.ok(breakdownHtml.includes("2x2 CLL Case Performance"));
  assert.ok(breakdownHtml.includes("data-breakdown-track=\"cll\""));
  assert.ok(breakdownHtml.includes("data-two-method=\"cll\""));
  assert.ok(breakdownHtml.includes("data-two-method=\"auto\""));
  assert.ok(breakdownHtml.includes("data-two-method=\"ortega\""));
  assert.ok(breakdownHtml.includes("H1"));
  assert.ok(breakdownHtml.includes("T2"));

  // createSessionLogView on 2x2 Advanced renders Phase Stats, Solve Log, and CLL Case Performance
  const store = new AppStore();
  store.state.currentPuzzle = "222";
  store.state.advancedMode = true;
  store.state.twoByTwoMethod = "cll";
  const sess = store.getActiveSession();
  sess.name = "2x2 Main";
  sess.puzzle = "222";
  sess.solves = [solve1, solve2, solve3];

  const listeners = new Map();
  const container = {
    innerHTML: "",
    querySelector() { return null; },
    querySelectorAll(sel) {
      if (sel === "[data-two-method]") {
        return [...this.innerHTML.matchAll(/data-two-method="([^"]+)"/g)].map(m => ({
          dataset: { twoMethod: m[1] },
          addEventListener(_ev, fn) { listeners.set(`twoMethod:${m[1]}`, fn); }
        }));
      }
      return [];
    }
  };
  const logView = createSessionLogView({ appStore: store });
  logView.render(container);
  assert.ok(container.innerHTML.includes("2x2 CLL Phase &amp; Pause Stats"));
  assert.ok(container.innerHTML.includes('data-log-sort="layer"'));
  assert.ok(container.innerHTML.includes('data-log-sort="cll"'));
  assert.ok(container.innerHTML.includes("2x2 CLL Case Performance"));

  // Switching 2x2 method via board toggle persists on store and re-renders
  const ortegaClick = listeners.get("twoMethod:ortega");
  assert.ok(ortegaClick, "Expected [data-two-method='ortega'] click listener");
  ortegaClick({ stopPropagation() {} });
  assert.strictEqual(store.state.twoByTwoMethod, "ortega");

  // AppStore + mergeSyncPayloads LWW sync for twoByTwoMethod
  store.setTwoByTwoMethod("auto");
  assert.strictEqual(store.state.twoByTwoMethod, "auto");
  const localSnap = {
    schemaVersion: 1,
    hasLocalSettings: true,
    settings: { twoByTwoMethod: "cll", activeSessionId: "s1" },
    timestamps: { settings: { twoByTwoMethod: 1000 } },
    sessions: [{ id: "s1", name: "2x2 Main", puzzle: "222", solves: [{ ms: 2000, at: 1000 }], updatedAt: 1000 }],
  };
  const remoteSnap = {
    schemaVersion: 1,
    hasLocalSettings: true,
    settings: { twoByTwoMethod: "auto", activeSessionId: "s1" },
    timestamps: { settings: { twoByTwoMethod: 2000 } },
    sessions: [{ id: "s1", name: "2x2 Main", puzzle: "222", solves: [{ ms: 2000, at: 1000 }], updatedAt: 1000 }],
  };
  const { merged } = mergeSyncPayloads(localSnap, remoteSnap);
  assert.strictEqual(merged.settings.twoByTwoMethod, "auto");
});

test('analyzeTwoByTwoSolve prefers real White CLL over trivial Yellow CLL Skip at end state', async () => {
  await initTwoByTwoAnalyzer();

  // Build White 1st Layer on physical F (x2 brings U->D, then x brings D->F => net rotation x').
  // After executing T1 on B, finish with R L' (= x) so the cube ends in WCA solved (D=Yellow, F=Green),
  // meaning at move N the F candidate is Green (Skip) while D is Yellow (Skip).
  const t1Obj = cllCases.find(c => c.id === "T1");
  const whiteToFMap = FACE_MAP_BY_ROT["x'"];
  const cllOnB = t1Obj.algs[0].alg.trim().split(/\s+/).map(tok => {
    const m = tok.match(/^([UDRLFB])([2']?)$/);
    return `${whiteToFMap[m[1]]}${m[2]}`;
  });
  // Invert White->F frame so D' R U' R' builds White on F
  const layerOnF = ["F'", "R", "B'", "R'"];
  const allTokens = [...layerOnF, ...cllOnB, "R", "L'"];
  const scramble = new Alg(allTokens.join(" ")).invert().toString();
  const solve = {
    puzzle: "222",
    target: "full",
    ms: 2100,
    rawMs: 2100,
    cubeMs: 2100,
    scramble,
    moves: buildTimedMoves(allTokens, { pauseAtIdx: layerOnF.length, pauseMs: 500, stepMs: 130 }),
  };

  const res = await analyzeTwoByTwoSolve(solve);
  assert.ok(res);
  assert.strictEqual(res.method, "cll");
  assert.strictEqual(res.layerColor, "White");
  assert.strictEqual(res.cllCase?.id, "T1");
  assert.strictEqual(res.cllCase?.isSkip, false);
});

test('stale cached 2x2 analysis auto-upgrades to current version, force/reanalyzeTwoByTwoSolves re-runs cached solves, and sessionLogView re-analyzes chosen solves', async () => {
  await initTwoByTwoAnalyzer();
  assert.strictEqual(TWO_BY_TWO_ANALYSIS_VERSION, 8);

  // 1. Stale version cached twoByTwo auto-invalidates on ensureSolveTwoByTwo
  const staleSolve = makeRealisticTwoByTwoSolve({ color: "White", cllId: "H1", stepMs: 140, pauseBeforeCllMs: 460 });
  staleSolve.twoByTwo = {
    version: 4,
    method: "cll",
    methodPref: "cll",
    layerColor: "Yellow",
    splits: { layer: 100, cll: 100, auf: 0 },
    steps: [{ phase: "layer", label: "1st Layer", caseId: "Yellow", moveCount: 1, ms: 100 }],
    cllCase: { id: "cll-skip", shortName: "Skip", isSkip: true, ms: 100 }
  };
  const upgraded = ensureSolveTwoByTwo(staleSolve);
  assert.strictEqual(upgraded.version, TWO_BY_TWO_ANALYSIS_VERSION);
  assert.strictEqual(upgraded.layerColor, "White");
  assert.strictEqual(upgraded.cllCase?.id, "H1");

  // 2. force: true and reanalyzeTwoByTwoSolves re-analyze even when version === current
  const forcedSolve = makeRealisticTwoByTwoSolve({ color: "Green", cllId: "U4", stepMs: 140, pauseBeforeCllMs: 460 });
  forcedSolve.twoByTwo = {
    version: TWO_BY_TWO_ANALYSIS_VERSION,
    method: "cll",
    methodPref: "cll",
    layerColor: "Yellow",
    splits: { layer: 100, cll: 100, auf: 0 },
    steps: [{ phase: "layer", label: "1st Layer", caseId: "Yellow", moveCount: 1, ms: 100 }],
    cllCase: { id: "cll-skip", shortName: "Skip", isSkip: true, ms: 100 }
  };
  const beforeForced = ensureSolveTwoByTwo(forcedSolve);
  assert.strictEqual(beforeForced.layerColor, "Yellow"); // cached current version respected without force

  const resForce = ensureSolveTwoByTwo(forcedSolve, { force: true });
  assert.strictEqual(resForce.layerColor, "Green");
  assert.strictEqual(resForce.cllCase?.id, "U4");

  forcedSolve.twoByTwo.layerColor = "Red";
  const batchRes = await reanalyzeTwoByTwoSolves([forcedSolve, { puzzle: "222", target: "full", ms: 900 }]);
  assert.strictEqual(batchRes.updated, 1);
  assert.strictEqual(forcedSolve.twoByTwo.layerColor, "Green");

  // 3. sessionLogView selectable batch re-analysis mode
  const solveA = makeRealisticTwoByTwoSolve({ color: "White", cllId: "T1", stepMs: 140, pauseBeforeCllMs: 460 });
  const solveB = makeRealisticTwoByTwoSolve({ color: "Orange", cllId: "S5", stepMs: 140, pauseBeforeCllMs: 460 });
  // Seed both with synthetic current-version caches so we can verify ONLY the chosen solve gets re-analyzed
  solveA.twoByTwo = {
    version: TWO_BY_TWO_ANALYSIS_VERSION,
    method: "cll",
    methodPref: "cll",
    layerColor: "Yellow",
    splits: { layer: 100, cll: 100, auf: 0 },
    steps: [{ phase: "layer", label: "1st Layer", caseId: "Yellow", moveCount: 1, ms: 100 }],
    cllCase: { id: "cll-skip", shortName: "Skip", isSkip: true, ms: 100 }
  };
  solveB.twoByTwo = {
    version: TWO_BY_TWO_ANALYSIS_VERSION,
    method: "cll",
    methodPref: "cll",
    layerColor: "Yellow",
    splits: { layer: 100, cll: 100, auf: 0 },
    steps: [{ phase: "layer", label: "1st Layer", caseId: "Yellow", moveCount: 1, ms: 100 }],
    cllCase: { id: "cll-skip", shortName: "Skip", isSkip: true, ms: 100 }
  };

  const store = new AppStore();
  store.state.currentPuzzle = "222";
  store.state.advancedMode = true;
  store.state.twoByTwoMethod = "cll";
  const sess = store.getActiveSession();
  sess.name = "2x2 Reanalyze Test";
  sess.puzzle = "222";
  sess.solves = [solveA, solveB];

  const byIdHandlers = new Map();
  const rowHandlers = new Map();
  const container = {
    innerHTML: "",
    querySelector(sel) {
      if (sel.startsWith("#")) {
        const id = sel.slice(1);
        if (this.innerHTML.includes(`id="${id}"`)) {
          return {
            addEventListener(ev, fn) {
              byIdHandlers.set(`${id}:${ev}`, fn);
            }
          };
        }
      }
      return null;
    },
    querySelectorAll(sel) {
      if (sel === ".layer-log-row") {
        return [...this.innerHTML.matchAll(/class="layer-log-row[^"]*" data-index="(\d+)" data-num="(\d+)"/g)].map(m => ({
          dataset: { index: m[1], num: m[2] },
          addEventListener(ev, fn) {
            rowHandlers.set(`${m[1]}:${ev}`, fn);
          }
        }));
      }
      return [];
    }
  };

  const view = createSessionLogView({ appStore: store });
  view.render(container);
  assert.ok(container.innerHTML.includes('id="toggleReanalyzeSelectBtn"'));
  assert.ok(!container.innerHTML.includes('reanalyze-selection-bar'));

  // Enter selection mode
  byIdHandlers.get("toggleReanalyzeSelectBtn:click")?.();
  assert.ok(container.innerHTML.includes('reanalyze-selection-bar'));
  assert.ok(container.innerHTML.includes('<strong>0</strong> of 2 analyzable solves selected'));
  assert.ok(container.innerHTML.includes('class="reanalyze-row-cb" data-orig-idx="0"'));
  assert.ok(container.innerHTML.includes('class="reanalyze-row-cb" data-orig-idx="1"'));

  // Choose ONLY solve index 0 (solveA) by clicking its row
  rowHandlers.get("0:click")?.({ target: { closest: () => null } });
  assert.ok(container.innerHTML.includes('<strong>1</strong> of 2 analyzable solves selected'));
  assert.ok(container.innerHTML.includes('Re-analyze Selected (1)'));

  // Run batch re-analysis on selected solves
  await byIdHandlers.get("reanalyzeRunSelectedBtn:click")?.();
  assert.ok(!container.innerHTML.includes('reanalyze-selection-bar'));
  assert.strictEqual(solveA.twoByTwo.layerColor, "White");
  assert.strictEqual(solveA.twoByTwo.cllCase?.id, "T1");
  assert.strictEqual(solveB.twoByTwo.layerColor, "Yellow"); // unselected solve left untouched
  assert.strictEqual(solveB.twoByTwo.cllCase?.id, "cll-skip");
});

test('MoYu WCU_MY22 real solves with interleaved gyro rotations detect pll-adj and White 1st layer over accidental early layer', async () => {
  await initTwoByTwoAnalyzer();

  const parseTimings = (str) => str.split(/\s+/).filter(Boolean).map((tok, i, arr) => {
    const [mv, tStr] = tok.split("@");
    const t = Number(tStr);
    const prevT = i > 0 ? Number(arr[i - 1].split("@")[1]) : 0;
    return { move: mv, t, split: Math.max(0, t - prevT) };
  });

  // Real MoYu V5 AI solve #30: 9-move White 1st Layer -> White PLL-Adj (formerly misclassified as Yellow 26m + Skip)
  const solve30 = {
    puzzle: "222",
    target: "full",
    ms: 4456,
    rawMs: 4456,
    cubeMs: 3930,
    scramble: "F' R U' F R U R2 F' R2 U R'",
    moves: parseTimings("F'@0 R@4 F@119 R@300 F@451 z'@481 U'@930 y@990 R@1117 x'@1146 F'@1202 R'@1289 x@1439 U@1800 U@1890 R@2161 U@2252 F'@2280 U'@2400 R'@2582 F@2789 U@2919 U@2971 z@2999 R'@3060 U'@3152 F'@3271 R@3420 F@3517 y@3517 U'@3541 F'@3802 U@3930"),
  };
  const res30 = await analyzeTwoByTwoSolve(solve30);
  assert.ok(res30);
  assert.strictEqual(res30.layerColor, "White");
  assert.strictEqual(res30.steps.find(s => s.phase === "layer")?.moveCount, 9);
  assert.strictEqual(res30.cllCase?.id, "pll-adj");
  assert.strictEqual(res30.cllCase?.shortName, "Adj");

  // Real MoYu V5 AI solve #28: accidental 2-move Red vs true 11-move White 1st Layer + S6 -> Adj -> solved
  const solve28 = {
    puzzle: "222",
    target: "full",
    ms: 7376,
    rawMs: 7376,
    cubeMs: 6870,
    scramble: "F' R U2 F' U R2 U R' U' R2 U'",
    moves: parseTimings("F@0 U'@212 F'@992 F@1140 F@1231 R'@1411 F@1470 R@1591 U'@1679 F@1831 R'@2040 x@2218 U'@2640 y@2668 F'@2849 R@2878 R@2910 F@3060 U@3150 y'@3240 R'@3298 U@3392 F@3479 y'@3599 U@3899 y'@3900 U@3960 F@4229 U@4289 R'@4350 F'@4469 U'@4592 F@4679 R@4738 R@4800 y2@4801 U'@4890 y@4950 F'@5042 U'@5399 y@5399 R@5639 R'@5827 R@6239 U@6420 F'@6509 R'@6660 U@6869"),
  };
  const res28 = await analyzeTwoByTwoSolve(solve28);
  assert.ok(res28);
  assert.strictEqual(res28.layerColor, "White");
  assert.strictEqual(res28.cllCase?.id, "S6");

  // Real MoYu V5 AI 6.75s solve: White 1st Layer finished on R at Move 10 (A2), then 2-look OLL->PLL moved White onto U with trailing U AUF
  const solve675 = {
    puzzle: "222",
    target: "full",
    ms: 6750,
    rawMs: 6750,
    cubeMs: 5790,
    scramble: "R F2 R' F R' F' R U2 F' U' F'",
    moves: parseTimings(
      "U'@0 R'@180 U@450 U'@780 F'@960 R'@1320 F'@1500 U'@1710 R@1710 F@1830 " +
      "F'@2670 U'@2760 R@2880 F'@2970 R'@3120 U@3150 U@3210 R@3270 " +
      "U'@3930 R@4100 U@4260 R'@4320 F'@4410 U'@4500 R@4640 F@4680 R'@4800 F'@4890 R@5010 F@5100 R'@5170 U'@5280 F'@5430 R@5490 F@5580 R'@5640 U@5790"
    ),
  };
  const res675 = await analyzeTwoByTwoSolve(solve675);
  assert.ok(res675);
  assert.strictEqual(res675.layerColor, "White");
  assert.strictEqual(res675.steps.find(s => s.phase === "layer")?.moveCount, 10);
  assert.strictEqual(res675.cllCase?.id, "A2");
  assert.strictEqual(res675.aufSummary?.caseId, "U");
});

test('identifyEgFromPattern detects all 40 EG-1 and 40 EG-2 cases uniquely and color-neutrally', async () => {
  await initTwoByTwoAnalyzer();
  const { defaultPat } = await getSolvedOrientations("2x2x2");

  const eg1Keys = new Set();
  for (const c of eg1Cases) {
    const pat = defaultPat.applyAlg(new Alg(c.setup));
    const key = computeEg1CanonicalKey(pat);
    assert.ok(key, `Expected EG-1 canonical key for ${c.id}`);
    assert.strictEqual(eg1Keys.has(key), false, `Duplicate EG-1 key ${key} at ${c.id}`);
    eg1Keys.add(key);

    const identified = identifyEgFromPattern(pat);
    assert.ok(identified, `identifyEgFromPattern failed for ${c.id}`);
    assert.strictEqual(identified.method, "eg1");
    assert.strictEqual(identified.faceColor, "Yellow");
    assert.strictEqual(identified.egCase.id, c.id);
  }
  assert.strictEqual(eg1Keys.size, 40);

  const eg2Keys = new Set();
  for (const c of eg2Cases) {
    const pat = defaultPat.applyAlg(new Alg(c.setup));
    const key = computeEg2CanonicalKey(pat);
    assert.ok(key, `Expected EG-2 canonical key for ${c.id}`);
    assert.strictEqual(eg2Keys.has(key), false, `Duplicate EG-2 key ${key} at ${c.id}`);
    eg2Keys.add(key);

    const identified = identifyEgFromPattern(pat);
    assert.ok(identified, `identifyEgFromPattern failed for ${c.id}`);
    assert.strictEqual(identified.method, "eg2");
    assert.strictEqual(identified.faceColor, "Yellow");
    assert.strictEqual(identified.egCase.id, c.id);
  }
  assert.strictEqual(eg2Keys.size, 40);

  // Color-neutral checks across White, Green, Blue, Red, Orange bottom faces + bar rotation
  const colorRotations = [
    ["White", "z2", "z2"],
    ["Green", "x'", "x"],
    ["Blue", "x", "x'"],
    ["Red", "z", "z'"],
    ["Orange", "z'", "z"]
  ];
  for (const [color, preRot, postRot] of colorRotations) {
    const eg1Sample = eg1Cases[4]; // P1
    const pat1 = defaultPat.applyAlg(new Alg(`${preRot} y ${eg1Sample.setup} U2 y' ${postRot}`));
    const res1 = identifyEgFromPattern(pat1);
    assert.ok(res1, `Color-neutral EG-1 failed on ${color}`);
    assert.strictEqual(res1.method, "eg1");
    assert.strictEqual(res1.faceColor, color);
    assert.strictEqual(res1.egCase.id, eg1Sample.id);

    const eg2Sample = eg2Cases[7]; // P4
    const pat2 = defaultPat.applyAlg(new Alg(`${preRot} y' ${eg2Sample.setup} U ${postRot}`));
    const res2 = identifyEgFromPattern(pat2);
    assert.ok(res2, `Color-neutral EG-2 failed on ${color}`);
    assert.strictEqual(res2.method, "eg2");
    assert.strictEqual(res2.faceColor, color);
    assert.strictEqual(res2.egCase.id, eg2Sample.id);
  }
});

test('analyzeTwoByTwoSolve detects smart-cube EG-1 and EG-2 solves (with 1st Face + AUF) and manual EG attribution', async () => {
  await initTwoByTwoAnalyzer();

  const buildEgSolve = ({ color = "White", egCaseObj, faceStdTokens, postAufStd = "U'", target = "full" }) => {
    const rotKey = BASE_ROT_BY_COLOR[color];
    const algDef = egCaseObj.algs[0];
    // Notice BASE_ROT_BY_COLOR White is x2; mapAlgTokens uses physical face mapping for rotKey
    const preTokens = algDef.startAuf ? mapAlgTokens(algDef.startAuf, rotKey) : [];
    const execTokens = mapAlgTokens(algDef.alg, rotKey);
    const postTokens = postAufStd ? mapAlgTokens(postAufStd, rotKey) : [];

    // Ensure face tokens do NOT solve the 1st layer completely on their own; verify state after faceTokens is EG-1/EG-2!
    const allTokens = [...faceStdTokens.flatMap(t => mapAlgTokens(t, rotKey)), ...preTokens, ...execTokens, ...postTokens];
    const scramble = new Alg(allTokens.join(" ")).invert().toString();
    const moves = buildTimedMoves(allTokens, {
      pauseAtIdx: faceStdTokens.length,
      pauseMs: 510,
      stepMs: 150,
    });
    const cubeMs = moves[moves.length - 1].t;
    return {
      puzzle: "222",
      target,
      ms: cubeMs,
      rawMs: cubeMs,
      cubeMs,
      moves,
      scramble,
      moveCount: moves.length,
    };
  };

  // Pick a face-building move sequence that reaches face-with-swap rather than solved layer:
  // If we use eg1Cases[5] (P2) where faceTokens = ["R", "U'", "R'"] — let us build faceTokens from solved:
  // Actually any single move like ["R"] has bottom-front swap after setup? Even cleaner: test both target practice (face=0) AND full solve with 1-move face ["F", "R"]!
  const p2Eg1 = eg1Cases.find(c => c.id === "EG1-P2");
  const eg1Solve = buildEgSolve({
    color: "White",
    egCaseObj: p2Eg1,
    faceStdTokens: ["R", "U", "R'"],
    postAufStd: "U",
    target: "eg1"
  });
  const resEg1 = await analyzeTwoByTwoSolve(eg1Solve, { twoByTwoMethod: "auto" });
  assert.ok(resEg1, "Expected EG-1 smart-cube analysis");
  assert.strictEqual(resEg1.method, "eg1");
  assert.strictEqual(resEg1.layerColor, "White");
  assert.strictEqual(resEg1.egCase?.id, "EG1-P2");
  assert.strictEqual(resEg1.cllCase, null);
  assert.ok(resEg1.splits.face > 0);
  assert.ok(resEg1.splits.eg > 0);
  assert.strictEqual(resEg1.splits.auf, 150);
  assert.strictEqual(resEg1.splits.face + resEg1.splits.eg + resEg1.splits.auf, eg1Solve.cubeMs);

  // Free solve (target="full", default twoByTwoMethod="cll") for EG-2 case on Yellow with trailing U2 AUF
  const u1Eg2 = eg2Cases.find(c => c.id === "EG2-U1");
  const eg2Solve = buildEgSolve({
    color: "Yellow",
    egCaseObj: u1Eg2,
    faceStdTokens: ["F", "R", "U'"],
    postAufStd: "U2",
    target: "full"
  });
  const resEg2 = await analyzeTwoByTwoSolve(eg2Solve);
  assert.ok(resEg2, "Expected EG-2 smart-cube analysis");
  assert.strictEqual(resEg2.method, "eg2");
  assert.strictEqual(resEg2.layerColor, "Yellow");
  assert.strictEqual(resEg2.egCase?.id, "EG2-U1");
  assert.strictEqual(resEg2.aufSummary?.caseId, "U2");

  // Manual EG-1 & EG-2 solve attribution without smart-cube move stream
  const manualEg1 = await analyzeTwoByTwoSolve({ puzzle: "222", target: "eg1", id: "EG1-T3", ms: 1420 });
  assert.strictEqual(manualEg1.method, "eg1");
  assert.strictEqual(manualEg1.egCase.id, "EG1-T3");
  assert.strictEqual(manualEg1.splits.eg, 1420);

  const manualEg2 = await analyzeTwoByTwoSolve({ puzzle: "222", track: "eg2", id: "EG2-S4", ms: 1650 });
  assert.strictEqual(manualEg2.method, "eg2");
  assert.strictEqual(manualEg2.egCase.id, "EG2-S4");
  assert.strictEqual(manualEg2.splits.eg, 1650);
});

test('collectCaseSolves and renderCaseSolvesModalBodyHtml show Recog, Exec, Moves, and Pauses for each solve of a case', async () => {
  await initTwoByTwoAnalyzer();

  const cllSolve1 = makeRealisticTwoByTwoSolve({ color: "White", cllId: "H1", stepMs: 140, pauseBeforeCllMs: 460 });
  const cllSolve2 = makeRealisticTwoByTwoSolve({ color: "Green", cllId: "H1", stepMs: 180, pauseBeforeCllMs: 680 });
  const otherCll = makeRealisticTwoByTwoSolve({ color: "Yellow", cllId: "T2", stepMs: 130, pauseBeforeCllMs: 320 });
  const dnfCll = { ...makeRealisticTwoByTwoSolve({ color: "Red", cllId: "H1" }), penalty: "DNF" };

  ensureSolveTwoByTwo(cllSolve1);
  ensureSolveTwoByTwo(cllSolve2);
  ensureSolveTwoByTwo(otherCll);

  const entries = collectCaseSolves({
    solves: [cllSolve1, otherCll, cllSolve2, dnfCll],
    puzzleId: "222",
    trackId: "cll",
    caseId: "H1",
    twoByTwoMethod: "cll",
  });
  assert.strictEqual(entries.length, 2, "Must return both non-DNF H1 solves in descending solve order");
  assert.strictEqual(entries[0].solveNum, 3);
  assert.strictEqual(entries[1].solveNum, 1);
  assert.ok(entries[0].recogMs > 0);
  assert.ok(entries[0].execMs > 0);
  assert.strictEqual(entries[0].recogMs + entries[0].execMs, entries[0].ms);
  assert.ok(entries[0].moveCount > 0);
  assert.strictEqual(entries[0].pauseCount, 1);
  assert.strictEqual(entries[0].pauseMs, 680);

  const modalHtml = renderCaseSolvesModalBodyHtml({ entries, caseLabel: "H1" });
  assert.ok(modalHtml.includes("Avg Recog"));
  assert.ok(modalHtml.includes("Avg Exec"));
  assert.ok(modalHtml.includes("Avg Moves"));
  assert.ok(modalHtml.includes("Avg Pauses"));
  assert.ok(modalHtml.includes("#3"));
  assert.ok(modalHtml.includes("#1"));
  assert.ok(modalHtml.includes("0.68s"));
  assert.ok(modalHtml.includes("0.46s"));
  assert.ok(modalHtml.includes('data-case-solve-detail-idx="0"'));

  const cllTableHtml = renderCllCasesBreakdownHtml([cllSolve1, otherCll, cllSolve2], {
    cllOpen: true,
    twoByTwoMethod: "cll",
  });
  assert.ok(cllTableHtml.includes('class="cfop-case-row-clickable"'));
  assert.ok(cllTableHtml.includes('class="cfop-case-solves-btn"'));
  assert.ok(cllTableHtml.includes('data-case-solves-id="H1"'));
  assert.ok(cllTableHtml.includes('data-drill-case-id="H1"'));
});
