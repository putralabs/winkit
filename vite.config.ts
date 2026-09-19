import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// WinKit is a multi-page extension bundle (Vite MPA):
// popup.html = quick actions, dashboard.html = full workspace.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  publicDir: 'public.ext',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        popup: 'popup.html',
        dashboard: 'dashboard.html',
      },
    },
  },
});
