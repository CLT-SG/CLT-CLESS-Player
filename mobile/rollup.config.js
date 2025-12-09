/**
 * Rollup configuration for bundling Capacitor modules
 * Bundles all @capacitor/* imports into a single file for mobile WebView
 */
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

export default {
  input: 'www/assets/js/capacitor-core.js',
  output: {
    file: 'www/assets/js/capacitor-core.bundle.js',
    format: 'es',
    sourcemap: true,
    // Inline dynamic imports to create a single bundle
    inlineDynamicImports: true
  },
  plugins: [
    nodeResolve({
      browser: true,
      preferBuiltins: false
    }),
    commonjs()
  ]
};
