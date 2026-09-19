import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// WinKit website target: landing (index.html) + full app (app.html reusing
// the same DashboardApp as the extension). Static hosting friendly.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  publicDir: 'public.web',
  base: './',
  // Same COOP/COEP as production (_headers, vercel.json, serve-web.mjs)
  // so SharedArrayBuffer (ffmpeg multi-thread) works in dev too.
  server: {
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'require-corp',
    },
  },
  build: {
    outDir: 'dist-web',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        index: 'index.html',
        app: 'app.html',
      },
    },
  },
});
