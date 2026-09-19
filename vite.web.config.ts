import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// WinKit website target: landing (index.html) + full app (app.html reusing
// the same DashboardApp as the extension). Static hosting friendly.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  publicDir: 'public.web',
  base: './',
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
