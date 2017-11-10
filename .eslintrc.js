module.exports = {
  parserOptions: {
    ecmaVersion: 8,
  },
  extends: 'airbnb-base',
  rules: {
    'no-use-before-define': 'off',
    'no-mixed-operators': 'off',
  },
  globals: {
    it: true,
    describe: true,
    beforeEach: true,
    afterEach: true,
    before: true,
    after: true,
  },
};
