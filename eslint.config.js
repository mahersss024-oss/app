const { defineConfig } = require("eslint/config");
const expo = require("eslint-config-expo/flat");
module.exports = defineConfig([
  expo,
  { ignores: ["dist/**", "android/**", "ios/**", ".expo/**"] },
  {
    files: ["scripts/**/*.{cjs,js}"],
    languageOptions: { globals: { __dirname: "readonly" } },
  },
  {
    files: ["tests/**/*.{cjs,mjs}"],
    languageOptions: {
      globals: {
        __dirname: "readonly",
        Buffer: "readonly",
        process: "readonly",
        console: "readonly",
        setTimeout: "readonly",
        clearTimeout: "readonly",
        URL: "readonly",
        require: "readonly",
        module: "readonly",
      },
    },
  },
]);
