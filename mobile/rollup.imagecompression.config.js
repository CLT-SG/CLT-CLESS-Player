/**
 * Rollup configuration for bundling browser-image-compression
 * Bundles browser-image-compression npm package into a single file for mobile WebView
 */
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

export default {
  input: 'build-helpers/image-compression-entry.js',
  output: {
    file: 'www/assets/js/mobile/browser-image-compression.bundle.js',
    format: 'iife', // Immediately Invoked Function Expression - creates global variable
    name: 'imageCompression', // Global variable name
    sourcemap: false,
    inlineDynamicImports: true
  },
  plugins: [
    nodeResolve({
      browser: true,
      preferBuiltins: false,
      moduleDirectories: ['node_modules']
    }),
    commonjs({
      include: /node_modules/
    })
  ],
  onwarn(warning, warn) {
    if (warning.code === 'UNRESOLVED_IMPORT') {
      console.warn(`⚠️  Unresolved import: ${warning.source}`);
      return;
    }
    warn(warning);
  }
};
