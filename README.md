# 2x2 CLL Recognition Trainer - PWA

A Progressive Web App for practicing 2x2 CLL (Corner Last Layer) recognition offline on any device.
Uses: https://github.com/cubing/scramble-display

## Features

✅ **Offline Support** - Works completely offline with service worker caching
✅ **Installable** - Install on your phone/tablet home screen
✅ **3D Visualization** - See the cube state with 3D rendering
✅ **Customizable Cases** - Pick whole groups (A, H, L, P, S, T, U) or single cases
✅ **All 40 CLL Cases** - Practice with the complete set
✅ **Random Rotations** - Optional AUF and random cube rotations
✅ **Responsive Design** - Works great on mobile and desktop

## Getting Started

### Development

```bash
npm install    # Install dependencies
npm run dev    # Start dev server (http://localhost:5173)
```

### Production Build

```bash
npm run build   # Build for production
npm run preview # Preview the production build
```

The built files will be in the `dist/` directory.

## Deployment

### Deploy to Netlify

```bash
npm run build
# Upload the dist/ folder to Netlify
```

### Deploy to Vercel

```bash
vercel --prod
```

### Deploy to GitHub Pages

1. Update `vite.config.js` with your repository name as `base`
2. Run `npm run build`
3. Push the `dist/` folder to your `gh-pages` branch

## PWA Installation

### On iOS

1. Open in Safari
2. Tap Share → Add to Home Screen
3. Name the shortcut and add

### On Android

1. Open in Chrome
2. Tap menu (three dots) → Install app
3. Confirm installation

## How to Use

1. **Pick cases** - Open "Cases & options" (always visible in the sidebar on wide screens). Each row is a group: tap the letter to add or remove the whole group, tap a number to add or remove a single case. "Add all" / "Clear all" select or deselect every group and case.
2. **Toggle options** - "Always white bottom" for a consistent orientation, "Allow AUF" for random U turns before and after the case, "Show case info" to see the case name, solution and the opposite case (the case you get by doing the alg on a solved cube) instead of guessing.
3. **Guess** - Tap a group letter and a case number under the cube, then "Verify". Tap "New scramble" for the next case.
4. **Case overview** - "Case overview" in the header opens a full-screen sheet with every case: top view of the cube (with the side stickers of the top layer), case ID, opposite case and alg.
5. **Stats** - Correct/attempted counts per case and per group are kept on the device; "Reset" clears them. Tap the "Stats" header to hide or show the table, for example while just practicing memorization.

Case selection and options are remembered between visits.

The layout adapts to the screen: a single column on phones (cube and guessing controls first, settings collapsed), cube beside the controls on landscape phones, and a sidebar with settings and stats on unfolded fold-phones, laptops and large screens.

## Project Structure

```
├── index.html          # Main HTML file
├── src/
│   ├── main.js        # App logic and initialization
│   └── style.css      # Styling
├── public/            # Static assets: icons, favicon
├── vite.config.js     # Vite and PWA plugin configuration
└── package.json       # Dependencies
```

## Technologies

- **Vite** - Fast build tool and dev server
- **Scramble Display** - 3D cube visualization (from cubing.net)
- **Vite PWA Plugin** - Service worker and PWA generation
- **Vanilla JavaScript** - No frameworks, lightweight

## Notes

- The app uses Scramble Display v0.59.1 which is bundled with your app for offline use
- All CLL cases are stored locally in the app
- Service worker caches the app shell and assets for offline functionality
- Works offline after the first load

## License

MIT
