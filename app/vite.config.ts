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
