# 2x2 Speedcubing Trainer — Roadmap & Idea Tracker

This document tracks the vision, feature roadmap, and training progression for this 2x2 speedcubing trainer. The project is tailored as a high-performance personal training environment to master 2x2 (from Ortega and efficient 1st Layer building to full CLL recognition and sub-3/sub-2 execution) before expanding into 3x3.

---

## 🧭 Training Progression & Philosophy

```
  [ Step 1: Ortega / LBL Foundation ]
       │  • 1st Face (Any color, <= 4 moves)
       │  • OLL (7 cases, orient top face)
       │  • PBL (5 permutation cases for both layers)
       ▼
  [ Step 2: 1st Layer Efficiency & Color Neutrality ]
       │  • Full 1st Layer (matching sides, <= 5 moves)
       │  • 15s Inspection: plan whole layer in inspection
       │  • Full Color Neutrality (CN on all 6 faces)
       │  • Bar preservation vs direct corner insertion
       ▼
  [ Step 3: Full CLL (Corner of Last Layer) ]
       │  • 42 cases (7 groups: H, Pi, U, T, L, Sune, Anti-Sune)
       │  • Instant 2-sided and 3-sided recognition
       │  • Sub-1s execution of optimal CLL algs
       │  • 1-look solves: plan 1st layer + predict CLL in inspection
       ▼
  [ Future: Transition to 3x3 ]
          • Cross planning in inspection
          • F2L lookahead and algorithmic efficiency
          • 3x3 OLL & PLL
```

---

## 📌 Feature Roadmap & Status Tracker

### 1. 3D World Interaction & Controls
- [x] **Virtual 3D Cube Display** (via `TwistyPlayer` / `ScrambleDisplay`)
- [x] **Camera Orientation Reset** button and canonical views
- [x] **Keyboard 3D World Rotation (`x, y, z` and `Shift+x, y, z`)**:
  - Rotate the 3D cube viewpoint around X, Y, and Z axes without altering the scramble's logical state, case identification, or solve statistics.
  - Inverses on Shift (`x'`, `y'`, `z'`).

### 2. Ortega Method & PBL (Permute Both Layers)
- [x] **5 PBL Algorithm Reference & Simulator**:
  - Case 1: Both Adjacent (Adj / Adj)
  - Case 2: Both Opposite (Opp / Opp)
  - Case 3: Top Adjacent / Bottom Opposite (Adj / Opp)
  - Case 4: Top Adjacent / Bottom Solved (Adj / Solved — T/J-perm)
  - Case 5: Top Opposite / Bottom Solved (Opp / Solved — Y-perm)
- [x] **Multiple Algorithms per PBL Case**:
  - Curated list of popular, ergonomic algorithms for each case.
- [x] **Customizable Algorithm Labels & Trigger Breakdowns**:
  - Let cubers customize the display label with triggers `(R U R' U')`, `(Sledge)`, `(Hedge)`, or custom mnemonics while keeping the raw notation clean for execution and 3D simulation.
  - Select preferred / favorite algorithm per case.
- [x] **OLL / CLL Algorithm Customization**:
  - Support custom trigger labeling and favorite algorithm selection across CLL/OLL cases.

### 3. 1st Layer & Face Efficiency Guide
- [x] **In-App Efficiency Guide & Inspection Tips**:
  - Optimal move count targets (1st face: $\le 4$ moves; 1st layer: $\le 5$ moves).
  - Inspection breakdown: spending the 15s on finding pieces, picking the best color, planning the full layer blindfolded.
  - Bar preservation vs piece-by-piece insertion.
  - Predicting OLL/CLL during inspection.
- [x] **1st Layer Solver Integration**:
  - Real-time optimal solver generating shortest solutions for selected faces (White, W/Y opposite, or all 6 CN).
  - Multi-face filtering and step-by-step playback in 3D simulator.

### 4. Case Management, Rating & Tagging
- [x] **Case Rating & Learning Status**:
  - Tag cases as: `Learning`, `Review`, `Mastered`.
  - Filter practice and overview by status tag.
  - Visual badges on case picker and overview cards.

### 5. Session Management & Solve Modes
- [x] **Unified Solve Mode**:
  - Solve targets:
    - `1st Layer Only` (scrambled cube $\rightarrow$ solve layer)
    - `1st Face Only` (Ortega face)
    - `CLL Case` (solve CLL alg)
    - `Full Solve` (complete 2x2 solve from WCA scramble)
  - Configurable options:
    - Show 3D virtual cube vs Hide (text-only scramble for physical cube)
    - Enable/disable 15-second WCA inspection countdown
- [x] **Multi-Session Management**:
  - Create, switch, rename, and clear independent solve sessions (e.g. "Full Solves", "1st Layer Practice", "CLL Timed").
  - Independent times and averages per session.

### 6. Statistics & Speedcubing Analytics
- [x] **Rolling Averages**:
  - Current & Best **Ao5** (Average of 5)
  - Current & Best **Ao12** (Average of 12)
  - Current & Best **Ao100** (Average of 100)
  - Session Mean & Single Best
- [x] **Balanced Stats Engine**:
  - Separate rolling averages for general solves from per-case recognition accuracy & time in CLL flashcards.
  - Reattempt previous solves with 1 click.
  - Export / Import session data.

---

## 🚀 Post-2x2 Future Horizons (3x3 Preparation)
Once the 2x2 feature set is complete and fully mastered:
1. **Inspection Planner for 3x3 Cross**: Predicting and tracking cross piece movements within 15 seconds.
2. **F2L Pair Recognition & Angles**: Developing muscle memory for 41 F2L cases from standard and non-standard angles without cube rotations.
3. **OLL / PLL Flashcard Recog Trainer**: Applying this same recognition engine to the 57 OLL and 21 PLL algorithms of 3x3.
