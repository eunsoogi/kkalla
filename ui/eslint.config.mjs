import { fixupConfigRules, fixupPluginRules } from "@eslint/compat";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tsParser from "@typescript-eslint/parser";
import path from "node:path";
import { fileURLToPath } from "node:url";
import js from "@eslint/js";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all
});

export default [...fixupConfigRules(compat.extends(
  "eslint:recommended",
  "plugin:@typescript-eslint/recommended",
  "plugin:react/recommended",
  "plugin:react-hooks/recommended",
  "prettier",
)), {
  plugins: {
    "@typescript-eslint": fixupPluginRules(typescriptEslint),
    react: fixupPluginRules(react),
    "react-hooks": fixupPluginRules(reactHooks),
  },

  languageOptions: {
    globals: {
      ...globals.browser,
      ...globals.node,
    },

    parser: tsParser,
  },

  settings: {
    react: {
      version: "detect",
    },
  },

  rules: {
    "@typescript-eslint/no-explicit-any": 0,
    "@typescript-eslint/no-non-null-assertion": 0,
    "@typescript-eslint/no-unused-vars": 2,
    "react/prop-types": 0,
  },
}];