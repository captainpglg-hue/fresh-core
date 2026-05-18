module.exports = {
  root: true,
  extends: ['expo'],
  ignorePatterns: ['node_modules/', 'dist/', '.expo/', 'android/', 'ios/'],
  rules: {
    // Demo project, keep noise down — TS handles unused imports.
    '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
    'no-empty': ['error', { allowEmptyCatch: true }],
  },
};
