import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // Pre-bundle smartcube-web-bluetooth and its CommonJS dependencies (aes-js, lz-string, rxjs)
  optimizeDeps: {
    include: [
      'smartcube-web-bluetooth',
      'aes-js',
      'lz-string',
      'rxjs'
    ],
    exclude: [
      'cubing',
      'cubing/alg',
      'cubing/bluetooth',
      'cubing/puzzles',
      'cubing/scramble',
      'cubing/search',
      'cubing/twisty',
      'scramble-display'
    ]
  },
  worker: {
    format: 'es'
  },
  build: {
    modulePreload: false,
    rollupOptions: {
      output: {
        // Keep shared pure-JS cubing core & Vite's preload helper out of the DOM entry chunk
        // so cubing's search module worker never imports `main.js` or references `document`.
        manualChunks(id) {
          if (id.includes('vite/preload-helper')) {
            return 'vite-preload'
          }
          if (
            (id.includes('/node_modules/cubing/') || id.includes('/node_modules/@cubing/')) &&
            !id.includes('/twisty') &&
            !id.includes('/bluetooth') &&
            !id.includes('chunk-LD4XJTCU') &&
            !id.includes('search-worker-entry') &&
            !id.includes('/inside-') &&
            !id.includes('-dynamic-') &&
            !id.includes('big-puzzle-orientation') &&
            !id.includes('/twips')
          ) {
            return 'cubing-core'
          }
        }
      }
    }
  },
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon.png'],
      manifest: {
        name: 'Cubing.cc',
        short_name: 'Cubing.cc',
        description: 'Multi-puzzle 2x2-5x5 speedcube recognition, algorithm study, smart cube timer & 3D replay trainer',
        theme_color: '#007bff',
        background_color: '#ffffff',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        navigateFallbackDenylist: [/^\/privacy/, /^\/terms/],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/unpkg\.com\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'npm-modules',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 30
              }
            }
          }
        ]
      }
    })
  ]
})
