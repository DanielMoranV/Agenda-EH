import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import globals from 'globals'

export default [
  { ignores: ['dist/**', 'node_modules/**'] },

  js.configs.recommended,
  ...pluginVue.configs['flat/essential'],

  {
    files: ['**/*.{js,vue}'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: { ...globals.browser }
    },
    rules: {
      // Variables sin usar: error, salvo las que empiezan por _ o los argumentos
      // que solo ocupan posición.
      'no-unused-vars': ['error', { args: 'none', varsIgnorePattern: '^_', caughtErrors: 'none', ignoreRestSiblings: true }],
      // Los composables y vistas usan `catch {}` a propósito para fallos no críticos
      'no-empty': ['error', { allowEmptyCatch: true }]
    }
  },

  {
    files: ['tests/**/*.js', 'eslint.config.js', 'vite.config.js'],
    languageOptions: { globals: { ...globals.node } }
  }
]
