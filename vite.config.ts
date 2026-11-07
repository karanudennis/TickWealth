import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    build: {
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, 'index.html'),
          analyzer: path.resolve(__dirname, 'analyzer.html'),
          bots: path.resolve(__dirname, 'bots-library.html'),
          riseFall: path.resolve(__dirname, 'rise-fall.html'),
          evenOdd: path.resolve(__dirname, 'even-odd.html'),
          overUnder: path.resolve(__dirname, 'over-under.html'),
          matchesDiffers: path.resolve(__dirname, 'matches-differs.html'),
          playbook: path.resolve(__dirname, 'playbook.html'),
          diagnostics: path.resolve(__dirname, 'diagnostics.html'),
          settings: path.resolve(__dirname, 'settings.html'),
          insight: path.resolve(__dirname, 'insight.html'),
          strategies: path.resolve(__dirname, 'strategies.html'),
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
