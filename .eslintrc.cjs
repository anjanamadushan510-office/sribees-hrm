module.exports = {
  root: true,
  env: { browser: true, es2020: true, node: true },
  extends: [
    'next/core-web-vitals',
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['.next', 'out', 'node_modules', '.eslintrc.cjs'],
  parser: '@typescript-eslint/parser',
  rules: {
    '@typescript-eslint/no-unused-vars': 'warn',
  },
};
