const js = require('@eslint/js');
const globals = require('globals');
module.exports = [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: {
        ...globals.browser,
        ...globals.node,
        AFRAME: 'readonly',
        THREE: 'readonly',
        io: 'readonly',
        Spotify: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': 'off',
      'no-undef': 'error',
      'no-empty': 'off',
    },
  },
];
