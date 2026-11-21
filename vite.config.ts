import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  base: './',
  // Bundle imported game art without copying the local AI Studio reference exports.
  publicDir: false,
  plugins: [
    react(),
    tailwindcss(),
    {
      name: 'asset-provenance',
      apply: 'build',
      generateBundle() {
        this.emitFile({
          type: 'asset',
          fileName: 'assets/PROVENANCE.json',
          source: readFileSync(new URL('./public/assets/PROVENANCE.json', import.meta.url), 'utf8'),
        });
      },
    },
  ],
  build: {
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'react-vendor', test: /[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            { name: 'game-menus', test: /[\\/]src[\\/]components[\\/](Modals|AtlasModal|FieldworkPanel|Dialog)\.tsx$/ },
          ],
        },
      },
    },
  },
  server: {
    hmr: process.env.DISABLE_HMR !== 'true',
    watch: process.env.DISABLE_HMR === 'true' ? null : {},
  },
});
import { readFileSync } from 'node:fs';
