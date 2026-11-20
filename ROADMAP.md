# Speedcube Trainer — Roadmap & Architecture Tracker

This document tracks the implemented training platform across **2x2, 3x3, 3x3 OH, 4x4, and 5x5** and upcoming user-experience additions planned after core refactoring.

---

## Training Progression Supported Today

```
  [ 2x2 Foundation & Full CLL ]
       • Ortega (1st Face <= 4 moves, 7 OLL, 5 PBL) & 1st Layer CN Solver
       • 40 CLL cases (H, Pi, U, T, L, S, Anti-Sune) + Custom Trigger Labels

  [ 3x3 & 3x3 One-Handed (CFOP) ]
       • Cross / Cross+1 / EO 15s Inspection Planner & Multi-Color CN Solver
       • 41 F2L + 57 OLL + 21 PLL study flashcards & independent OH algs
       • 2-Sided PLL / OLL Recognition Drills & 3D Camera View Lock

  [ Big Cubes (4x4 / 5x5) ]
       • 4x4 OLL / PLL Parity & 5x5 Lucas / L2E Wing Parity Reference & Sim

  [ Live Smart Cube, GAN Timer & Analytics ]
       • Multi-vendor Web Bluetooth cubes + GAN Smart Timer Pickup/Cube/Putdown splits
       • Automatic CFOP Solve Analyzer, 3D Replay Timeline & CSV Session Export
```

---

## Completed Milestones

### 1. Multi-Puzzle Study, Practice & 3D Interaction
- [x] **Interactive 3D Cube Display** (`scramble-display` / `TwistyPlayer`), camera reset, reflection facelet toggle, and Free Face Turns (`U/D/L/R/F/B`, wide moves on `4x4`/`5x5`, whole-cube `x/y/z`).
- [x] **Study Mode Views**: Case Grid, compact **Grid + 3D** flashcard with AUF starting-angle preview, 2-Sided OLL/PLL recognition guides, integrated 2x2/3x3/4x4/5x5 Reference Guides, preferred `★` algorithm selection per puzzle (`333` vs `333oh`), and custom trigger/mnemonic labels.
- [x] **Practice Mode Drills**: Casual Practice & Timed Sprints with dynamic `algRegistry`-driven keypads, 2-Sided camera lock overlay, and 15s Inspection Planning drills checked against optimal solvers.
- [x] **Algorithm Tagging & Filtering**: Tag cases (`Pending`, `Learning`, `Review`, `Mastered`) and filter drills or case grids.

### 2. Solve Timer, Optimal Solvers & Multi-Session Tracking
- [x] **Unified Solve Mode**: `Full Solve`, `1st Layer`, `1st Face`, `CLL`, `F2L/OLL/PLL`, `Parity`, and `Timer & Handling Drills` with multi-session create/edit/switch/delete.
- [x] **Optimal Solvers**: Color-neutral 2x2 Layer/Face solver and 3x3 Cross / Cross+1 / EO solver with one-click 3D Simulate & copy export.
- [x] **Rolling Statistics & History**: Compact Solve strip (`Best`, `Median`, `Trim 10%`, `Mean`, `Ao5`, `Ao12`, `Ao100`), paginated Solve Log, Case Solve metrics, Recognition accuracy tables, and single-click CSV export.

### 3. Hardware Integration, CFOP Analysis & Modular Refactor
- [x] **Bluetooth Smart Cube & GAN Timer**: Multi-vendor cube support with live Scramble Assistant, diagnostics logging, Virtual Cube testing keypad, and GAN Timer hardware split tracking.
- [x] **CFOP Analyzer & 3D Solve Replay**: Step/pause segmentation, OLL/PLL recognition detection, speed-controlled 3D timeline scrubbing, and `Reattempt Scramble`.
- [x] **Modular Architecture & Design System**: Decoupled ES controllers (`state/`, `services/`, `cube/`, `ui/`, `features/`) and layered CSS (`src/styles/` `@layer` architecture) with desktop 2-column Practice/Simulate layouts, accessible modal stack, and full `node:test` verification.

---

## Upcoming UX Enhancements (Post-Refactor Roadmap)

1. **New-User Onboarding Guide**: Optional first-visit walkthrough asking which cube size (`2x2`–`5x5`), stage (`Beginner`, `Intermediate`, `Advanced`), and goal (`Learn Algorithms` vs. `Practice & Timed Solves`) the user prefers, pre-configuring their initial track and workspace.
2. **Contextual Tooltips & Interactive Tutorials**: Lightweight discoverability hints for Smart Cube Scramble Assistant, Free Face Turns shortcuts, 2-Sided Recognition lock, and solver widgets.
