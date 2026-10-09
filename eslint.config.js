import js from "@eslint/js";
import prettierConfig from "eslint-config-prettier";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

const config = tseslint.config(
  {
    ignores: [
      ".next/**",
      ".git/**",
      "**/node_modules/**",
      ".project-work-files/**",
      "generated/**",
      "tmp/**",
      ".kilo/**",
      "public/**",
      "data/**",
      "docs/**",
      "project-docs/**",
      "prisma/migrations/**",
      ".commandcode/**",
      ".lovable/**",
      "scripts/**",
      ".eslintcache",
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: { globals: globals.browser },
    plugins: { "react-hooks": reactHooks },
    rules: { ...reactHooks.configs.recommended.rules, "@typescript-eslint/no-unused-vars": "off" },
  },
  prettierConfig,
);

export default config;

