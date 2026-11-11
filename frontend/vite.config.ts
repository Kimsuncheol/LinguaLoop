import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [vue(), VitePWA({
    registerType: 'autoUpdate',
    manifest: {
      name: 'LinguaLoop', short_name: 'LinguaLoop', description: 'Your language learning loop',
      theme_color: '#245c4b', background_color: '#f7f8f5', display: 'standalone',
      start_url: '/', icons: [192, 512].map(size => ({src: `/icon-${size}.png`, sizes: `${size}x${size}`, type: 'image/png'})),
    },
    workbox: { navigateFallbackDenylist: [/^\/api(?:\/|$)/], cleanupOutdatedCaches: true },
  })],
  server: { port: 5173, strictPort: true, proxy: { '/api': 'http://localhost:5000' } },
})
