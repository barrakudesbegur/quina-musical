import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { VitePWA } from 'vite-plugin-pwa';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'generateSW',
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true,
      },
      workbox: {
        globPatterns: ['index.html'],
        runtimeCaching: [
          {
            urlPattern: /^https?:\/\/.*\.mp3/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'songs-cache',
              expiration: {
                maxEntries: 150,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
    }),
  ],
});
