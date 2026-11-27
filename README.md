# Cubing.cc — Ad-Free Offline Speedcube Timer, Trainer & Solver

An open-source, ad-free, offline-ready Progressive Web App for WCA timing, algorithm learning, recognition & execution drills, Bluetooth smart cube solve tracking, CFOP analytics, optimal first-layer/cross analysis, and 3D move-by-move replay across **2x2–7x7, 3x3 OH, 3BLD, and WCA puzzles**.

> Inspired by learning with jperm.net and csTimer, built without ads or tracking — works completely offline as an installable PWA, with optional private Google Drive `appDataFolder` sync.

Built with vanilla ES modules, Vite, [`cubing`](https://github.com/cubing/cubing.js), [`scramble-display`](https://github.com/cubing/scramble-display), and [`smartcube-web-bluetooth`](https://github.com/poliva/smartcube-web-bluetooth).

## Supported Puzzles & Tracks

| Puzzle | Tracks & Training Focus |
| :--- | :--- |
| **2x2** | **CLL (40 cases)**, **Ortega (12 OLL + PBL cases)**, **1st Layer & Face** optimal CN solver |
| **3x3** | **Cross / Cross+1 / EO** inspection planner, **F2L (41)**, **OLL (57)**, **PLL (21)** + 2-sided recognition guide |
| **3x3 OH** | Dedicated session & puzzle-scoped preferred algorithms for Cross, F2L, OLL, and PLL |
| **4x4** | **OLL & PLL Parity** algorithms & wide/slice trainer |
| **5x5** | **L2E & Lucas Parity** algorithms |

## Modes & Key Capabilities

- **Study**: Browse full case grids or side-by-side **Grid + 3D** flashcards, preview starting AUF angles, star preferred algorithms (`★`, scoped independently per puzzle such as 3x3 vs 3x3 OH), attach custom trigger/mnemonic labels, view 2-sided PLL/OLL recognition cues, and read puzzle-specific Reference Guides.
- **Practice**: Run **Casual Practice** or **Timed Sprints** with dynamic track keypads, **2-Sided Recognition** view lock on 3x3 OLL/PLL, and 15-second **WCA Inspection Planning Drills** backed by optimal 2x2 Layer/Face and 3x3 Cross solvers.
- **Solve**: Multi-session WCA timer (Spacebar / touch hold-to-arm, optional 15s inspection, compact rolling Best / Median / Trim 10% / Mean / Ao5 / Ao12 / Ao100 strip), 2x2 Layer & 3x3 Cross solver widgets, **Timer & Pickup/Putdown Drills**, and automatic CFOP step splits.
- **Simulate**: Interactive 3D algorithm & scramble timeline with playback speed control, preset scrambles, solver sequence loading, Free Face Turns, and live `window.cllSimulator` scripting hooks.
- **Bluetooth Smart Cube & GAN Timer**: Real-time turn tracking, Scramble Assistant with off-track undo recovery, Virtual Keyboard Cube fallback, automatic CFOP phase analysis, GAN Timer Pickup/Cube/Putdown splits, 3D Solve Replay Viewer, Diagnostics logging, and CSV export in **Stats & History**.
- **Settings & Offline Support**: Dark/Light theme, Always White Bottom (`z2`) & AUF options, floating reflection facelets toggle, 2D diagram color customization (`Bright`, `High Contrast Neon`, `Competition Matte`, or custom HEX), and full offline PWA caching.
- **Google Drive Cloud Sync & Merge**: Optional Google Account login saving all settings, sessions, solve logs, recognition stats, tags, custom labels, starred preferred algorithms, and smart cube MAC entries privately into your Google Drive `appDataFolder`, with automatic cross-device reload and conflict-free merging.

## Google Drive Cloud Sync Setup

Cloud sync uses Google Identity Services (OAuth 2.0) and the Google Drive `appDataFolder` scope (`https://www.googleapis.com/auth/drive.appdata`), keeping `speedcube-trainer-sync.json` private to the app without touching your visible Drive folders.

1. In [Google Cloud Console](https://console.cloud.google.com/), enable the **Google Drive API** and create an **OAuth 2.0 Client ID** (*Web application*) with your app URL (e.g. `http://localhost:5173`) in **Authorized JavaScript origins**.
2. Either set `VITE_GOOGLE_CLIENT_ID=<your-client-id>` in `.env` (see `.env.example`) before building, or paste your Client ID directly inside the **☁️ Cloud Sync** dialog in the app header.
3. Sign in on any device to back up, reload, and automatically merge local and remote changes.

## Getting Started

```bash
npm install    # Install dependencies & apply smartcube BLE patches (postinstall)
npm run dev    # Start Vite dev server (http://localhost:5173)
npm test       # Run Node test suite (node --test test/**/*.test.js)
npm run build  # Build production bundle & Workbox service worker into dist/
npm run preview
```

## Project Structure

```
├── index.html                  # App shell, lean header, stage & modals
├── vite.config.js              # Vite + Workbox PWA config
├── scripts/
│   ├── patch-smartcube.js      # BLE driver fixes applied via postinstall
│   └── generators/             # Algorithm & data generation helpers
├── src/
│   ├── main.js                 # Composition root wiring stores, UI & features
│   ├── studyView.js            # Study Grid, Grid+3D Flashcard, Guides
│   ├── practiceView.js         # Casual/Timed recognition & inspection drills
│   ├── replayView.js           # Interactive 3D solve replay modal
│   ├── crossSolver.js          # 3x3 multi-color Cross / Cross+1 / EO solver
│   ├── layerSolver.js          # 2x2 optimal 1st Layer / 1st Face CN solver
│   ├── cfopAnalyzer.js         # 3x3 CFOP step, OLL/PLL & pause analyzer
│   ├── smartCube.js            # Bluetooth Smart Cube manager
│   ├── ganTimer.js             # Bluetooth GAN Smart Timer manager
│   ├── state/                  # appStore, sessionStore, storage adapters
│   ├── services/               # scrambleService, solveStats, audioService, htmlUtils
│   ├── cube/                   # cubeUtils, cubeColors, caseSvgRenderer, bleLoader
│   ├── data/                   # algRegistry, cllData, ortegaData, f2l/oll/pll/parity/2-sided data
│   ├── ui/                     # navController, keyboardRouter, modalManager, cubeStage, casePicker, freeMoves, toast
│   ├── features/               # solve/, bluetooth/, stats/, simulator/, modals/
│   └── styles/                 # Modular @layer CSS (tokens, base, layout, components/, features/, utilities)
└── test/                       # Unit & solver verification tests (node:test)
```

## Notes & Compatibility

- Uses `cubing` (`cubing.js`) and `scramble-display` for canonical WCA puzzle definitions, math verification, and 3D WebGL rendering.
- Web Bluetooth Smart Cube & GAN Timer connections require a Web Bluetooth browser (Chrome, Edge, Opera, or Bluefy on iOS).
- Local settings, sessions, stats, tags, custom labels, and cube MAC caches persist locally in browser storage.

## License

[GNU General Public License v3.0 (GPL-3.0)](LICENSE) — free to fork, study, and modify; derivative works must also be distributed under GPL-3.0.
