/**
 * Rollup configuration for bundling Capacitor modules
 * Bundles all @capacitor/* imports into a single file for mobile WebView
 */
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';

export default {
  input: 'www/assets/js/mobile/capacitor-core.js',
  output: {
    file: 'www/assets/js/mobile/capacitor-core.bundle.js',
    format: 'es',
    sourcemap: true,
    // Inline dynamic imports to create a single bundle
    inlineDynamicImports: true
  },
  plugins: [
    nodeResolve({
      browser: true,
      preferBuiltins: false,
      // Resolve all @capacitor packages from node_modules
      moduleDirectories: ['node_modules']
    }),
    commonjs({
      // Convert CommonJS modules to ES6
      include: /node_modules/
    })
  ],
  // Suppress warnings about unresolved dependencies
  onwarn(warning, warn) {
    // Ignore unresolved import warnings (they may be resolved at runtime)
    if (warning.code === 'UNRESOLVED_IMPORT') {
      console.warn(`⚠️  Unresolved import: ${warning.source}`);
      return;
    }
    warn(warning);
  }
};
