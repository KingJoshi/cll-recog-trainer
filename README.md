# 2x2 CLL Recognition Trainer - PWA

A Progressive Web App for practicing 2x2 CLL (Corner Last Layer) recognition offline on any device.
Uses: https://github.com/cubing/scramble-display

## Features

✅ **Offline Support** - Works completely offline with service worker caching
✅ **Installable** - Install on your phone/tablet home screen
✅ **3D Visualization** - See the cube state with 3D rendering
✅ **Customizable Cases** - Filter by group (H, P, U, T, L, S, AS)
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

1. **Select Groups** - Click "Groups" to expand and choose which case groups to practice
2. **Select Cases** - Click "Cases" to choose specific cases or keep all selected
3. **Toggle Options** - Enable "Always White Bottom" for consistent orientation, "Allow AUF" for final layer rotations
4. **Generate Scramble** - Click "Regenerate Scramble" for a new puzzle

## Project Structure

```
├── index.html          # Main HTML file
├── src/
│   ├── main.js        # App logic and initialization
│   └── style.css      # Styling
├── public/
│   ├── manifest.json  # PWA manifest
│   └── sw.js          # Service worker for offline support
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
