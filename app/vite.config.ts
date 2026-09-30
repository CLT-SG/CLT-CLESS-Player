import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

/**
 * The bundle is loaded by Electron from a `file://` URL and by Capacitor from
 * the app's local web root, so every emitted asset reference must be relative.
 */
export default defineConfig({
  base: './',
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      // The shared core lives outside this app because the legacy renderer and
      // the Capacitor build consume it too.
      '@core': fileURLToPath(new URL('../src/core', import.meta.url)),
      // `src/core` sits above `app/node_modules`, so Node resolution cannot
      // reach the packages it imports. Pointing them here keeps a single
      // install: every build of the core — app, mobile, legacy bridge — runs
      // through this toolchain, so a second `node_modules` would only be a
      // second copy to keep in step. `tsconfig.app.json` mirrors this.
      zod: fileURLToPath(new URL('./node_modules/zod', import.meta.url)),
    },
  },
  server: {
    fs: {
      // Dev server has to be allowed to read the shared core above the root.
      allow: [fileURLToPath(new URL('..', import.meta.url))],
    },
  },
  build: {
    outDir: fileURLToPath(new URL('../src/app-dist', import.meta.url)),
    emptyOutDir: true,
    target: 'chrome108',
    sourcemap: true,
  },
  test: {
    environment: 'jsdom',
    include: ['tests/**/*.spec.ts'],
    globals: true,
  },
})
