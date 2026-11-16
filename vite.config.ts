import fs from 'fs';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

const STATIC_RUNTIME_ASSETS = [
  'config.js',
  'core.js',
  'stats.js',
  'coach.js',
  'advisor.js',
  'botrunner.js',
  'pillars.js',
  'digitpage.js',
  'favicon.svg',
  'logo.svg',
  'logo-mark.svg',
];

function copyStaticRuntimeAssets() {
  return {
    name: 'copy-static-runtime-assets',
    writeBundle(options: { dir?: string }) {
      const outDir = path.resolve(import.meta.dirname, options.dir || 'dist');
      for (const file of STATIC_RUNTIME_ASSETS) {
        const src = path.resolve(import.meta.dirname, file);
        const dest = path.resolve(outDir, file);
        if (fs.existsSync(src)) {
          fs.copyFileSync(src, dest);
        }
      }
    },
  };
}

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss(), copyStaticRuntimeAssets()],
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
