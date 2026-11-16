import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        input: {
          main: path.resolve(import.meta.dirname, 'index.html'),
          analyzer: path.resolve(import.meta.dirname, 'analyzer.html'),
          bots: path.resolve(import.meta.dirname, 'bots-library.html'),
          riseFall: path.resolve(import.meta.dirname, 'rise-fall.html'),
          forex: path.resolve(import.meta.dirname, 'forex.html'),
          evenOdd: path.resolve(import.meta.dirname, 'even-odd.html'),
          overUnder: path.resolve(import.meta.dirname, 'over-under.html'),
          matchesDiffers: path.resolve(import.meta.dirname, 'matches-differs.html'),
          playbook: path.resolve(import.meta.dirname, 'playbook.html'),
          diagnostics: path.resolve(import.meta.dirname, 'diagnostics.html'),
          settings: path.resolve(import.meta.dirname, 'settings.html'),
          insight: path.resolve(import.meta.dirname, 'insight.html'),
          strategies: path.resolve(import.meta.dirname, 'strategies.html'),
        },
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modify—file watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
      // Disable file watching when DISABLE_HMR is true to save CPU during agent edits.
      watch: process.env.DISABLE_HMR === 'true' ? null : {},
    },
  };
});
