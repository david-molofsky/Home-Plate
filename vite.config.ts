import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

// https://vite.dev/config/
export default defineConfig({
  base: '/Home-Plate/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'icons/icon-96.png',
        'icons/icon-114.png',
        'icons/icon-120.png',
        'icons/icon-128.png',
        'icons/icon-144.png',
        'icons/icon-152.png',
        'icons/icon-167.png',
        'icons/icon-180.png',
        'icons/icon-192.png',
        'icons/icon-256.png',
        'icons/icon-384.png',
        'icons/icon-512.png',
      ],
      manifest: {
        name: 'Home Plate',
        short_name: 'Home Plate',
        description: 'Plan meals, dodge repeats, and build the shopping list automatically.',
        theme_color: '#121212',
        background_color: '#121212',
        display: 'standalone',
        start_url: '/Home-Plate/',
        icons: [
          { src: 'icons/icon-96.png', sizes: '96x96', type: 'image/png' },
          { src: 'icons/icon-114.png', sizes: '114x114', type: 'image/png' },
          { src: 'icons/icon-120.png', sizes: '120x120', type: 'image/png' },
          { src: 'icons/icon-128.png', sizes: '128x128', type: 'image/png' },
          { src: 'icons/icon-144.png', sizes: '144x144', type: 'image/png' },
          { src: 'icons/icon-152.png', sizes: '152x152', type: 'image/png' },
          { src: 'icons/icon-167.png', sizes: '167x167', type: 'image/png' },
          { src: 'icons/icon-180.png', sizes: '180x180', type: 'image/png' },
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-256.png', sizes: '256x256', type: 'image/png' },
          { src: 'icons/icon-384.png', sizes: '384x384', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
