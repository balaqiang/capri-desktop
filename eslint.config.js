'use strict';
// Only the rules that catch real bugs (a name that isn't defined, a case twice in a switch, a method
// shadowed by a field), no style: `npm run lint`, and the CI on every push.
const globals = require('globals');

const BUGS = {
  'no-undef': 'error',
  'no-duplicate-case': 'error',
  'no-dupe-class-members': 'error',
  'no-dupe-keys': 'error',
  'no-dupe-else-if': 'error',
  'no-redeclare': 'error',
  'no-const-assign': 'error',
  'no-func-assign': 'error',
  'no-import-assign': 'error',
  'no-class-assign': 'error',
  'no-self-assign': 'error',
  'no-unreachable': 'error',
  'no-unsafe-finally': 'error',
  'no-unsafe-negation': 'error',
  'no-cond-assign': ['error', 'except-parens'],
  'no-fallthrough': 'error',
  'no-compare-neg-zero': 'error',
  'no-sparse-arrays': 'error',
  'no-unused-vars': ['warn', { args: 'none', caughtErrors: 'none', ignoreRestSiblings: true }],
  'use-isnan': 'error',
  'valid-typeof': 'error',
};

module.exports = [
  { ignores: ['dist/**', 'node_modules/**', 'assets/**'] },
  {
    files: ['src/main/**/*.js', 'scripts/**/*.js', 'hooks/**/*.js', 'tests/**/*.js', 'eslint.config.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'commonjs', globals: { ...globals.node } },
    rules: BUGS,
  },
  {
    files: ['src/preload.js', 'src/settings-preload.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'commonjs', globals: { ...globals.node, ...globals.browser } },
    rules: BUGS,
  },
  {
    files: ['src/renderer/js/**/*.js', 'src/settings/**/*.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: { ...globals.browser } },
    rules: BUGS,
  },
  {
    files: ['src/renderer/js/ears-worklet.js'],
    languageOptions: { globals: { ...globals.audioWorklet } },
  },
  {
    files: ['tests/**/*.mjs', 'scripts/**/*.mjs'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: { ...globals.node } },
    rules: BUGS,
  },
];
