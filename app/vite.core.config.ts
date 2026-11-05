import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'

/**
 * Builds the shared core for the legacy renderer.
 *
 * Emits a single classic script — no modules, no imports — because
 * `src/index.html` and `mobile/www/index.html` load their scripts with plain
 * `<script src>` tags and run without a bundler. The output is committed
 * alongside the other vendored scripts in `src/assets/js` so a packaged build
 * needs no extra step.
 *
 * Separate from `vite.config.ts` because the two builds disagree on almost
 * everything: this one has no Vue plugin, one entry point, an IIFE format and
 * a different output directory.
 */
export default defineConfig({
  resolve: {
    alias: {
      '@core': fileURLToPath(new URL('../src/core', import.meta.url)),
      zod: fileURLToPath(new URL('./node_modules/zod', import.meta.url)),
    },
  },
  build: {
    outDir: fileURLToPath(new URL('../src/assets/js', import.meta.url)),
    emptyOutDir: false,
    target: 'chrome108',
    // Readable output: this file is debugged in the field through DevTools on
    // a device, where a minified frame is worth very little.
    minify: false,
    sourcemap: false,
    lib: {
      entry: fileURLToPath(new URL('../src/core/legacy-bridge.ts', import.meta.url)),
      name: 'ClessCore',
      formats: ['iife'],
      fileName: () => 'cless-core.js',
    },
  },
})
