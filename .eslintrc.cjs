/** @type {import('@types/eslint').Linter.BaseConfig} */
module.exports = {
  root: true,
  extends: [
    "@remix-run/eslint-config",
    "@remix-run/eslint-config/node",
    "prettier",
  ],
  globals: {
    shopify: "readonly",
  },
  overrides: [
    {
      files: ["tests/**/*.test.ts"],
      rules: {
        "no-undef": "off",
      },
    },
  ],
};
