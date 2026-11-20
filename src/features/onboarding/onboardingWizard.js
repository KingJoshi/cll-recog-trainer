// Optional 3-step onboarding setup wizard + pure training-plan recommender

import { PUZZLES, getTrack, getSolveTargetInfo } from '../../data/algRegistry.js';
import { showToast } from '../../ui/toastService.js';

const PUZZLE_OPTIONS = [
  { id: "222", title: "2x2 Cube", badge: "Fast", desc: "Progress from LBL → Ortega → CLL → EG-1/EG-2 + 1st-Layer Explorer" },
  { id: "333", title: "3x3 Cube", badge: "Classic", desc: "White Cross, F2L, 57 OLL, 21 PLL & 2-sided recognition" },
  { id: "333oh", title: "3x3 One-Handed", badge: "OH", desc: "Custom Left-Hand (<R, U>) or Right-Hand (Mirror <L, U> / z') OH algs" },
  { id: "444", title: "4x4 Cube", badge: "Parity", desc: "Essential OLL & PLL parity algorithms + wide-move timing" },
  { id: "555", title: "5x5 Cube", badge: "Big Cube", desc: "Last Two Edges (L2E) parity cases + 5x5 timed solves" }
];

const OH_HAND_OPTIONS = [
  { id: "left", title: "🤚 Left Hand (Standard)", badge: "<R, U>", desc: "Hold cube in left hand and turn with right-hand dominant <R, U> algs" },
  { id: "right", title: "✋ Right Hand (Mirror / z')", badge: "<L, U> / z'", desc: "Hold cube in right hand using verified <L, U> mirrors & z' <U, L> variants" }
];

const OH_TABLE_ABUSE_OPTIONS = [
  { id: "table", title: "Table Abuse (M-Slice)", badge: "MU-Gen", desc: "Brace cube on mat/table for fast M/S/E slice algs (e.g. M2 H-Perm & Z-Perm)" },
  { id: "no-table", title: "No Table Abuse (In-Air)", badge: "L/R/U", desc: "Pure L, R, U with occasional F/D; zero M moves and B converted via x' + U" }
];

const LEVEL_OPTIONS_BY_PUZZLE = {
  "222": [
    { id: "beginner", title: "Beginner", badge: "LBL", desc: "1st Layer + 7 OLL + 2 PLL (Adj T/J-Perm & Diag Y-Perm)" },
    { id: "intermediate", title: "Intermediate", badge: "Ortega", desc: "1st Face (≤4m) + 7 OLL + 5 PBL (orient & permute both layers)" },
    { id: "advanced", title: "Advanced", badge: "CLL + Layer", desc: "40 CLL cases + complete 1st Layer mastery (1/2/3 in bottom)" },
    { id: "expert", title: "Expert", badge: "EG-1 & EG-2", desc: "1-Look finish from any 1st Face (Back Bar EG-1 + Diag Swap EG-2)" }
  ],
  "333": [
    { id: "beginner", title: "Beginner", badge: "2-Look OLL", desc: "Start with the 7 Cross OLLs (Sune, Antisune, H, Pi, U, T, L)" },
    { id: "intermediate", title: "Intermediate", badge: "Full PLL", desc: "Master all 21 PLL cases for consistent 1-look permutation" },
    { id: "advanced", title: "Advanced", badge: "Full CFOP + 2-Sided", desc: "Full OLL/PLL recognition with front+right 2-sided training" }
  ],
  "333oh": [
    { id: "beginner", title: "Beginner", badge: "OH 2-Look OLL", desc: "Learn ergonomic RU-gen Cross OLL triggers for one-handed solving" },
    { id: "intermediate", title: "Intermediate", badge: "OH Full PLL", desc: "Practice all 21 PLLs with OH-friendly fingertricks" },
    { id: "advanced", title: "Advanced", badge: "OH 2-Sided", desc: "Fast 2-sided OH recognition + full 57 OLL / 21 PLL mastery" }
  ],
  "444": [
    { id: "beginner", title: "Beginner", badge: "Core Parity", desc: "Learn the 3 essential 4x4 OLL/PLL parity cases step-by-step" },
    { id: "intermediate", title: "Intermediate", badge: "Parity Drill", desc: "Drill 4x4 parity recognition & timed execution speed" },
    { id: "advanced", title: "Advanced", badge: "Full Solves", desc: "Full 4x4 WCA solves with wide-turn tracking and parity fluency" }
  ],
  "555": [
    { id: "beginner", title: "Beginner", badge: "L2E Flip", desc: "Learn Last Two Edges middle edge flip & wing swap cases" },
    { id: "intermediate", title: "Intermediate", badge: "L2E Drill", desc: "Drill 5x5 L2E parity recognition and timed setup solves" },
    { id: "advanced", title: "Advanced", badge: "Full Solves", desc: "Full 5x5 WCA scrambles with big-cube timing & split tracking" }
  ]
};

const GOAL_OPTIONS = [
  { id: "learn", title: "📚 Learn Algorithms", badge: "Study", desc: "Explore 2D/3D patterns, trigger notes, and preferred algs" },
  { id: "practice", title: "🎯 Practice Recognition", badge: "Drills", desc: "Identify cases & plan 1st-layer/cross under 15s pressure" },
  { id: "solve", title: "⏱️ Timed Solves", badge: "Timer", desc: "Time full solves or focused case setups (Smart Cube / GAN ready)" }
];

const C333_CROSS_OLL_STARTER = ["oll-21", "oll-22", "oll-23", "oll-24", "oll-25", "oll-26", "oll-27"];

/**
 * Pure recommendation engine mapping { puzzle, level, goal, ohHand } to initial app configuration.
 */
export function recommendTrainingPlan({ puzzle = "222", level = "beginner", goal = "learn", ohHand = "left", ohTableAbuse = true } = {}) {
  const safePuzzle = PUZZLES[puzzle] ? puzzle : "222";
  const rawLevel = ["beginner", "intermediate", "advanced", "expert"].includes(level) ? level : "beginner";
  const safeLevel = safePuzzle !== "222" && rawLevel === "expert" ? "advanced" : rawLevel;
  const safeGoal = ["learn", "practice", "solve"].includes(goal) ? goal : "learn";
  const safeOhHand = ohHand === "right" ? "right" : "left";
  const safeOhTableAbuse = ohTableAbuse !== false;
  const mode = safeGoal === "learn" ? "study" : safeGoal === "practice" ? "practice" : "solve";

  if (safePuzzle === "222") {
    if (safeLevel === "beginner") {
      return {
        puzzle: safePuzzle,
        level: safeLevel,
        goal: safeGoal,
        ohHand: safeOhHand,
        ohTableAbuse: safeOhTableAbuse,
        mode,
        trackId: "lbl",
        solveTarget: safeGoal === "solve" ? "layer" : "lbl",
        starterCaseIds: null,
        studyView: "grid",
        twoSidedMode: false,
        title: safeGoal === "solve" ? "2x2 Beginner 1st-Layer Solves" : "2x2 Beginner LBL (7 OLL + 2 PLL)",
        summary: safeGoal === "solve"
          ? "Solve mode focused on building a complete 1st Layer before running OLL + T/J/Y-Perm."
          : `${mode === "study" ? "Study" : "Practice"} 1st Layer basics plus 7 OLL + 2 PLL (Adj T/J & Diag Y-Perm).`,
        nextStepTip: "Open 1st Layer in Study to master intuitive 1–5 move corners, then learn Ortega!"
      };
    }
    if (safeLevel === "intermediate") {
      return {
        puzzle: safePuzzle,
        level: safeLevel,
        goal: safeGoal,
        ohHand: safeOhHand,
        ohTableAbuse: safeOhTableAbuse,
        mode,
        trackId: "ortega",
        solveTarget: "face",
        starterCaseIds: null,
        studyView: "grid",
        twoSidedMode: false,
        title: safeGoal === "solve" ? "2x2 Ortega 1st-Face Solve Focus" : "2x2 Ortega Method (12 Cases)",
        summary: safeGoal === "solve"
          ? "Solve mode focused on fast ≤4-move 1st Face building and spotting Bar vs Diag bottom states."
          : `${mode === "study" ? "Study" : "Practice"} all 12 Ortega OLL & PBL cases alongside 1st Face drills.`,
        nextStepTip: "Ortega's 1st Face + PBL cuts 1st-layer move count dramatically without memorizing 40 algs."
      };
    }
    if (safeLevel === "advanced") {
      return {
        puzzle: safePuzzle,
        level: safeLevel,
        goal: safeGoal,
        ohHand: safeOhHand,
        ohTableAbuse: safeOhTableAbuse,
        mode,
        trackId: safeGoal === "solve" ? "cll" : "cll",
        solveTarget: safeGoal === "solve" ? "full" : "layer",
        starterCaseIds: null,
        studyView: "hybrid",
        twoSidedMode: false,
        title: safeGoal === "solve" ? "2x2 Full CLL + 1st Layer Mastery" : "2x2 CLL (40 Cases) + 1st Layer Explorer",
        summary: safeGoal === "solve"
          ? "Full WCA 2x2 solves with optimal 1st-layer solver popups and Ao5/Ao12 tracking."
          : `All 40 CLL cases ready for ${mode === "study" ? "3D study" : "recognition speed drills"}. Also check Study → 1st Layer (75 cases)!`,
        nextStepTip: "Learn the 3 one-move Rim Bars in Study → 1st Layer to predict CLL straight out of inspection."
      };
    }
    return {
      puzzle: safePuzzle,
      level: safeLevel,
      goal: safeGoal,
      ohHand: safeOhHand,
      ohTableAbuse: safeOhTableAbuse,
      mode,
      trackId: "eg1",
      solveTarget: safeGoal === "solve" ? "eg1" : "face",
      starterCaseIds: null,
      studyView: "hybrid",
      twoSidedMode: false,
      title: safeGoal === "solve" ? "2x2 EG-1 Targeted Solves" : "2x2 EG-1 & EG-2 (1-Look Finish)",
      summary: safeGoal === "solve"
        ? "Timed EG-1 (Back Bar) scrambles plus 1st-Face solver hints."
        : `Master all 40 EG-1 (Back Bar) and 40 EG-2 (Diag Swap / Anti-CLL) cases in ${mode}.`,
      nextStepTip: "Switch freely between EG-1 and EG-2 tracks in the top bar; Anti-CLL bridges straight from CLL!"
    };
  }

  if (safePuzzle === "333" || safePuzzle === "333oh") {
    const pName = safePuzzle === "333oh"
      ? `3x3 OH (${safeOhHand === "right" ? "Right Hand" : "Left Hand"}${safeOhTableAbuse ? "" : " · No Table Abuse"})`
      : "3x3";
    if (safeLevel === "beginner") {
      return {
        puzzle: safePuzzle,
        level: safeLevel,
        goal: safeGoal,
        ohHand: safeOhHand,
        ohTableAbuse: safeOhTableAbuse,
        mode,
        trackId: safeGoal === "solve" ? "cross" : "oll",
        solveTarget: "full",
        starterCaseIds: safeGoal === "solve" ? null : [...C333_CROSS_OLL_STARTER],
        studyView: "grid",
        twoSidedMode: false,
        title: safeGoal === "solve" ? `${pName} Full Solves + White Cross Hints` : `${pName} 2-Look OLL Starter (7 Cases)`,
        summary: safeGoal === "solve"
          ? `Full ${pName} WCA scrambles with optimal White Cross planning solutions.`
          : `${mode === "study" ? "Study" : "Practice"} the 7 Cross OLL cases (OLL 21–27) first${safePuzzle === "333oh" && safeOhHand === "right" ? " with verified Right-Hand <L, U> & z' algs" : ""}.`,
        nextStepTip: "Once the 7 Cross OLLs are automatic, move up to full 21 PLLs."
      };
    }
    if (safeLevel === "intermediate") {
      return {
        puzzle: safePuzzle,
        level: safeLevel,
        goal: safeGoal,
        ohHand: safeOhHand,
        ohTableAbuse: safeOhTableAbuse,
        mode,
        trackId: "pll",
        solveTarget: "full",
        starterCaseIds: null,
        studyView: "grid",
        twoSidedMode: false,
        title: safeGoal === "solve" ? `${pName} Full Solves` : `${pName} Full PLL (21 Cases)`,
        summary: safeGoal === "solve"
          ? `Full ${pName} solves with White Cross + Cross+1 solutions and session stats.`
          : `${mode === "study" ? "Study" : "Practice"} all 21 PLL cases${safePuzzle === "333oh" && safeOhHand === "right" ? " (with verified Right-Hand <L, U> mirrors & z' rotations)" : ""}.`,
        nextStepTip: "Use Study → Grid + 3D to star your favorite fingertrick variant for each PLL."
      };
    }
    return {
      puzzle: safePuzzle,
      level: safeLevel,
      goal: safeGoal,
      ohHand: safeOhHand,
      ohTableAbuse: safeOhTableAbuse,
      mode,
      trackId: safeGoal === "learn" ? "oll" : "pll",
      solveTarget: "full",
      starterCaseIds: null,
      studyView: safeGoal === "learn" ? "twosided" : "grid",
      twoSidedMode: safeGoal === "practice",
      title: safeGoal === "solve"
        ? `${pName} Full CFOP Timer`
        : safeGoal === "learn"
          ? `${pName} OLL 2-Sided Recognition Guide`
          : `${pName} PLL 2-Sided Recognition Drill`,
      summary: safeGoal === "solve"
        ? `Full ${pName} timing with CFOP phase analysis (Connect a smart cube for automatic splits).`
        : safeGoal === "learn"
          ? "Review all 57 OLL Front + Right two-sided recognition patterns."
          : "Drill all 21 PLLs with locked Front + Right camera (2-Sided Recognition ON).",
      nextStepTip: "Challenge yourself to spot every PLL without rotating or peeking at the back."
    };
  }

  // 4x4 & 5x5
  const pLabel = safePuzzle === "444" ? "4x4" : "5x5";
  const paritySolveTarget = safeLevel === "intermediate" ? "parity" : "full";
  return {
    puzzle: safePuzzle,
    level: safeLevel,
    goal: safeGoal,
    ohHand: safeOhHand,
    ohTableAbuse: safeOhTableAbuse,
    mode,
    trackId: "parity",
    solveTarget: paritySolveTarget,
    starterCaseIds: null,
    studyView: safeLevel === "advanced" ? "grid" : "hybrid",
    twoSidedMode: false,
    title: safeGoal === "solve"
      ? `${pLabel} ${paritySolveTarget === "parity" ? "Parity Case Timing" : "Full WCA Solves"}`
      : `${pLabel} Parity & L2E Training`,
    summary: safeGoal === "solve"
      ? `${pLabel} solve timing focused on ${paritySolveTarget === "parity" ? "dedicated parity case setups" : "full scrambles"}.`
      : `${mode === "study" ? "Study in Grid + 3D" : "Drill recognition for"} all ${pLabel} parity algorithms.`,
    nextStepTip: "Use Simulate mode anytime to slow down wide moves step-by-step."
  };
}

/**
 * Interactive 3-step setup modal controller.
 */
export function createOnboardingWizard({
  appStore,
  modalManager,
  navCtrl,
  casePickerCtrl,
  getStudyView = () => null,
  getPracticeView = () => null,
  getSolvePanelView = () => null,
  getStatsCtrl = () => null
} = {}) {
  const modal = typeof document !== "undefined" ? document.getElementById("onboardingModal") : null;
  const bodyEl = typeof document !== "undefined" ? document.getElementById("onboardingBody") : null;
  const closeBtn = typeof document !== "undefined" ? document.getElementById("onboardingCloseBtn") : null;
  const backBtn = typeof document !== "undefined" ? document.getElementById("onboardingBackBtn") : null;
  const skipBtn = typeof document !== "undefined" ? document.getElementById("onboardingSkipBtn") : null;
  const nextBtn = typeof document !== "undefined" ? document.getElementById("onboardingNextBtn") : null;

  let step = 1;
  const profile = appStore?.state?.onboardingProfile;
  let selection = {
    puzzle: PUZZLES[profile?.puzzle] ? profile.puzzle : (appStore?.state?.currentPuzzle || "222"),
    level: ["beginner", "intermediate", "advanced", "expert"].includes(profile?.level) ? profile.level : "beginner",
    goal: ["learn", "practice", "solve"].includes(profile?.goal) ? profile.goal : "learn",
    ohHand: profile?.ohHand === "right" ? "right" : (appStore?.state?.ohHand || "left"),
    ohTableAbuse: profile?.ohTableAbuse !== undefined
      ? Boolean(profile.ohTableAbuse)
      : (appStore?.state?.ohTableAbuse !== false)
  };

  function markCompleted(savedProfile = null) {
    if (!appStore?.state) return;
    appStore.state.onboardingCompleted = true;
    if (savedProfile) {
      appStore.state.onboardingProfile = { ...savedProfile };
    }
    appStore.saveSettings();
  }

  function renderStep() {
    if (!bodyEl) return;

    const stepsBar = `
      <div class="onboarding-steps-bar" aria-label="Setup steps">
        <span class="onboarding-step-pill ${step === 1 ? "active" : "done"}">1. Puzzle</span>
        <span class="onboarding-step-pill ${step === 2 ? "active" : step > 2 ? "done" : ""}">2. Experience</span>
        <span class="onboarding-step-pill ${step === 3 ? "active" : ""}">3. Goal</span>
      </div>
    `;

    let content = "";
    if (step === 1) {
      content = `
        <h4 class="onboarding-step-title">Which cube do you want to train on?</h4>
        <p class="onboarding-step-subtitle">You can switch puzzles anytime from the top header bar.</p>
        <div class="onboarding-options-grid">
          ${PUZZLE_OPTIONS.map(opt => `
            <button type="button" class="onboarding-option-card ${selection.puzzle === opt.id ? "active" : ""}" data-wiz-puzzle="${opt.id}" aria-pressed="${selection.puzzle === opt.id}">
              <div class="onboarding-option-head">
                <span class="onboarding-option-title">${opt.title}</span>
                <span class="onboarding-option-badge">${opt.badge}</span>
              </div>
              <span class="onboarding-option-desc">${opt.desc}</span>
            </button>
          `).join("")}
        </div>
      `;
    } else if (step === 2) {
      const levels = LEVEL_OPTIONS_BY_PUZZLE[selection.puzzle] || LEVEL_OPTIONS_BY_PUZZLE["222"];
      if (!levels.some(opt => opt.id === selection.level)) {
        selection.level = levels[levels.length - 1]?.id || "beginner";
      }
      content = `
        <h4 class="onboarding-step-title">What is your current stage on ${PUZZLES[selection.puzzle]?.shortName || selection.puzzle}?</h4>
        <p class="onboarding-step-subtitle">We'll pick an algorithm set and starter case pool that fits your level.</p>
        <div class="onboarding-options-grid">
          ${levels.map(opt => `
            <button type="button" class="onboarding-option-card ${selection.level === opt.id ? "active" : ""}" data-wiz-level="${opt.id}" aria-pressed="${selection.level === opt.id}">
              <div class="onboarding-option-head">
                <span class="onboarding-option-title">${opt.title}</span>
                <span class="onboarding-option-badge">${opt.badge}</span>
              </div>
              <span class="onboarding-option-desc">${opt.desc}</span>
            </button>
          `).join("")}
        </div>
        ${selection.puzzle === "333oh" ? `
          <div class="onboarding-oh-hand-block">
            <h5 class="onboarding-step-title" style="margin-top: 14px; font-size: 0.95rem;">Which hand will hold/turn for 3x3 OH?</h5>
            <div class="onboarding-options-grid onboarding-options-2col">
              ${OH_HAND_OPTIONS.map(opt => `
                <button type="button" class="onboarding-option-card ${selection.ohHand === opt.id ? "active" : ""}" data-wiz-oh-hand="${opt.id}" aria-pressed="${selection.ohHand === opt.id}">
                  <div class="onboarding-option-head">
                    <span class="onboarding-option-title">${opt.title}</span>
                    <span class="onboarding-option-badge">${opt.badge}</span>
                  </div>
                  <span class="onboarding-option-desc">${opt.desc}</span>
                </button>
              `).join("")}
            </div>
            <h5 class="onboarding-step-title" style="margin-top: 14px; font-size: 0.95rem;">Do you use table abuse for M-slice algs?</h5>
            <div class="onboarding-options-grid onboarding-options-2col">
              ${OH_TABLE_ABUSE_OPTIONS.map(opt => {
                const isActive = (opt.id === "table") === Boolean(selection.ohTableAbuse);
                return `
                  <button type="button" class="onboarding-option-card ${isActive ? "active" : ""}" data-wiz-oh-table="${opt.id}" aria-pressed="${isActive}">
                    <div class="onboarding-option-head">
                      <span class="onboarding-option-title">${opt.title}</span>
                      <span class="onboarding-option-badge">${opt.badge}</span>
                    </div>
                    <span class="onboarding-option-desc">${opt.desc}</span>
                  </button>
                `;
              }).join("")}
            </div>
          </div>
        ` : ""}
      `;
    } else {
      const plan = recommendTrainingPlan(selection);
      content = `
        <h4 class="onboarding-step-title">What would you like to do first?</h4>
        <p class="onboarding-step-subtitle">Switch freely between Study, Practice, Solve, and Simulate at any time.</p>
        <div class="onboarding-options-grid">
          ${GOAL_OPTIONS.map(opt => `
            <button type="button" class="onboarding-option-card ${selection.goal === opt.id ? "active" : ""}" data-wiz-goal="${opt.id}" aria-pressed="${selection.goal === opt.id}">
              <div class="onboarding-option-head">
                <span class="onboarding-option-title">${opt.title}</span>
                <span class="onboarding-option-badge">${opt.badge}</span>
              </div>
              <span class="onboarding-option-desc">${opt.desc}</span>
            </button>
          `).join("")}
        </div>

        <div class="onboarding-preview-box">
          <span class="onboarding-preview-kicker">Recommended Starting Setup</span>
          <h5 class="onboarding-preview-title">${plan.title}</h5>
          <p class="onboarding-preview-desc">${plan.summary} <em>Tip: ${plan.nextStepTip}</em></p>
        </div>
      `;
    }

    bodyEl.innerHTML = stepsBar + content;

    bodyEl.querySelectorAll("[data-wiz-puzzle]").forEach(btn => {
      btn.addEventListener("click", () => {
        selection.puzzle = btn.dataset.wizPuzzle;
        renderStep();
      });
    });
    bodyEl.querySelectorAll("[data-wiz-level]").forEach(btn => {
      btn.addEventListener("click", () => {
        selection.level = btn.dataset.wizLevel;
        renderStep();
      });
    });
    bodyEl.querySelectorAll("[data-wiz-oh-hand]").forEach(btn => {
      btn.addEventListener("click", () => {
        selection.ohHand = btn.dataset.wizOhHand === "right" ? "right" : "left";
        renderStep();
      });
    });
    bodyEl.querySelectorAll("[data-wiz-oh-table]").forEach(btn => {
      btn.addEventListener("click", () => {
        selection.ohTableAbuse = btn.dataset.wizOhTable === "table";
        renderStep();
      });
    });
    bodyEl.querySelectorAll("[data-wiz-goal]").forEach(btn => {
      btn.addEventListener("click", () => {
        selection.goal = btn.dataset.wizGoal;
        renderStep();
      });
    });

    if (backBtn) backBtn.hidden = step <= 1;
    if (nextBtn) nextBtn.textContent = step >= 3 ? "Apply & Start ✓" : "Next →";
  }

  function applyPlan(plan) {
    if (!appStore?.state) return;
    markCompleted({
      puzzle: plan.puzzle,
      level: plan.level,
      goal: plan.goal,
      ohHand: plan.ohHand || "left",
      ohTableAbuse: plan.ohTableAbuse !== false
    });

    if (plan.ohHand && typeof appStore.setOhHand === "function") {
      appStore.setOhHand(plan.ohHand);
    }
    if (typeof appStore.setOhTableAbuse === "function") {
      appStore.setOhTableAbuse(plan.ohTableAbuse !== false);
    }

    const studyView = getStudyView();
    const practiceView = getPracticeView();
    const s = appStore.state;

    if (s.currentPuzzle !== plan.puzzle) {
      navCtrl?.setPuzzle?.(plan.puzzle);
    }

    // Apply Study/Practice view hints before track/mode renders so the first paint matches
    if (studyView && plan.studyView) {
      studyView.currentView = plan.studyView;
    }
    if (practiceView) {
      practiceView.twoSidedMode = Boolean(plan.twoSidedMode);
    }

    // Apply Solve Focus target & track cleanly
    const activeSess = appStore.getActiveSession();
    const validTarget = getSolveTargetInfo(plan.puzzle, plan.solveTarget)?.id || "full";
    s.solveTarget = validTarget;
    if (activeSess) {
      activeSess.target = validTarget;
      appStore.saveSessions();
    }

    const track = getTrack(plan.puzzle, plan.trackId);
    if (track) {
      s.currentTrackId = track.id;
      appStore.loadTrackSelection(plan.puzzle, track.id);
      if (track.cases?.length) {
        const validSet = plan.starterCaseIds?.length
          ? new Set(plan.starterCaseIds.filter(id => track.caseById.has(id)))
          : new Set(track.cases.map(c => c.id));
        if (validSet.size > 0) {
          casePickerCtrl?.applySelection?.(validSet);
        }
      }
      casePickerCtrl?.buildCasePicker?.();
      casePickerCtrl?.renderSelection?.();
    }

    if (s.mode !== plan.mode) {
      navCtrl?.setMode?.(plan.mode);
    } else {
      navCtrl?.renderTrackBar?.();
      navCtrl?.renderStage?.();
      if (plan.mode === "study") studyView?.setTrack?.(plan.puzzle, s.currentTrackId);
      else if (plan.mode === "practice") practiceView?.setTrack?.(plan.puzzle, s.currentTrackId);
      else if (plan.mode === "solve") navCtrl?.regenerateScramble?.();
    }

    if (plan.mode === "study" && plan.studyView && studyView) {
      studyView.setView(plan.studyView, { keepSelected: true });
    }

    getSolvePanelView()?.renderSolvePanel?.();
    getStatsCtrl()?.updateStatsTable?.();
    appStore.saveSettings();
    close({ markComplete: false });
    showToast(`${plan.title} ready!`, "success", 2800);
  }

  function close({ markComplete = true } = {}) {
    if (markComplete) markCompleted();
    if (modal && modalManager?.isOpen?.(modal)) {
      modalManager.close(modal);
    }
  }

  function open() {
    if (!modal) return;
    step = 1;
    renderStep();
    modalManager.open(modal, {
      initialFocus: nextBtn || closeBtn,
      onClose: () => markCompleted()
    });
  }

  function shouldAutoOpen() {
    if (!appStore?.state || appStore.state.onboardingCompleted) return false;
    if (typeof window !== "undefined") {
      const p = new URLSearchParams(window.location.search);
      if (p.has("puzzle") || p.has("mode") || p.has("track") || p.has("target")) {
        return false;
      }
    }
    return true;
  }

  backBtn?.addEventListener("click", () => {
    if (step > 1) {
      step--;
      renderStep();
    }
  });

  nextBtn?.addEventListener("click", () => {
    if (step < 3) {
      step++;
      renderStep();
    } else {
      applyPlan(recommendTrainingPlan(selection));
    }
  });

  skipBtn?.addEventListener("click", () => close({ markComplete: true }));
  closeBtn?.addEventListener("click", () => close({ markComplete: true }));

  return {
    open,
    close,
    applyPlan,
    shouldAutoOpen
  };
}
