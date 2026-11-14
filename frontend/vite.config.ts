import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'
import releaseNotes from './release-notes.json'

const release = { id: new Date().toISOString(), message: releaseNotes.message }

export default defineConfig({
  define: { __APP_RELEASE__: JSON.stringify(release) },
  plugins: [vue(), {
    name: 'app-release',
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'app-release.json', source: JSON.stringify(release) })
    },
  }, VitePWA({
    registerType: 'autoUpdate',
    manifest: {
      name: 'LinguaLoop', short_name: 'LinguaLoop', description: 'Your language learning loop',
      theme_color: '#245c4b', background_color: '#f7f8f5', display: 'standalone',
      start_url: '/', icons: [192, 512].map(size => ({src: `/icon-${size}.png`, sizes: `${size}x${size}`, type: 'image/png'})),
    },
    workbox: {
      navigateFallbackDenylist: [/^\/api(?:\/|$)/, /^\/app-release\.json$/],
      globIgnores: ['**/app-release.json'],
      cleanupOutdatedCaches: true,
    },
  })],
  server: { port: 5173, strictPort: true, proxy: { '/api': 'http://localhost:5000' } },
})
