import js from '@eslint/js';

export default [
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/coverage/**', 'docs/**', 'scripts/**'],
  },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      parserOptions: {
        ecmaFeatures: {
          modules: true,
        },
      },
    },
    rules: {
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
];
