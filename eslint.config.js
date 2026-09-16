import js from "@eslint/js";
import prettier from "eslint-plugin-prettier/recommended";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

const config = tseslint.config(
  {
    ignores: [
      ".next/**",
      ".project-work-files/**",
      "**/node_modules/**",
      "src/generated/**",
      "tmp/**",
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: { globals: globals.browser },
    plugins: { "react-hooks": reactHooks },
    rules: { ...reactHooks.configs.recommended.rules, "@typescript-eslint/no-unused-vars": "off" },
  },
  prettier,
);

export default config;
