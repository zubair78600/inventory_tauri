import js from '@eslint/js';
import nextPlugin from '@next/eslint-plugin-next';
import tseslint from 'typescript-eslint';

const nextCoreWebVitals = nextPlugin.configs['core-web-vitals'];

export default tseslint.config(
  {
    ignores: ['node_modules', '.next', 'out', 'dist', 'inventory.db', 'tailwind.config.js', 'postcss.config.js', 'tsconfig.tsbuildinfo', 'src-tauri']
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parserOptions: {
        project: './tsconfig.json',
        tsconfigRootDir: import.meta.dirname
      }
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': ['warn', { prefer: 'type-imports' }]
    }
  },
  {
    files: ['**/*.{ts,tsx,js,jsx}'],
    plugins: {
      '@next/next': nextPlugin
    },
    rules: nextCoreWebVitals.rules,
    settings: nextCoreWebVitals.settings ?? {}
  }
);
