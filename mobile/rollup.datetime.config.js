/**
 * Rollup configuration for bundling date-and-time library
 * Bundles date-and-time and its plugins into a single file for mobile WebView
 * Transpiles to ES5 for compatibility with older Android WebViews
 */
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import { babel } from '@rollup/plugin-babel';

export default {
  input: 'www/assets/js/mobile/datetime-imports.js',
  output: {
    file: 'www/assets/js/mobile/datetime.bundle.js',
    format: 'iife',
    name: 'DateTimeBundle',
    sourcemap: true,
    // Export to window object
    globals: {
      'date-and-time': 'date',
      'date-and-time/plugins/meridiem': 'meridiem',
      'date-and-time/plugins/ordinal': 'ordinal'
    }
  },
  plugins: [
    nodeResolve({
      browser: true,
      preferBuiltins: false,
      moduleDirectories: ['node_modules']
    }),
    commonjs({
      include: /node_modules/,
      requireReturnsDefault: 'auto'
    }),
    babel({
      babelHelpers: 'bundled',
      presets: [
        ['@babel/preset-env', {
          targets: {
            // Target Android WebView 5.0+ (Chrome 55+)
            android: '5.0',
            chrome: '55'
          },
          modules: false,
          useBuiltIns: false
        }]
      ],
      exclude: 'node_modules/core-js/**'
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
