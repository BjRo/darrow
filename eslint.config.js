import js from "@eslint/js";
import tseslint from "typescript-eslint";

// ESLint owns TypeScript correctness and the complexity budget in this
// repository; Prettier still owns formatting for every file type, TypeScript
// included. The two do not overlap because no stylistic rule is enabled here.
export default tseslint.config(
  {
    ignores: [
      "node_modules/**",
      "evals/results/**",
      "evals/corpus/**/cache/**",
      ".tmp/**",
      ".worktrees/**",
    ],
  },
  {
    files: ["**/*.ts"],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },
    rules: {
      complexity: ["error", 10],
      "max-lines-per-function": [
        "error",
        { max: 50, skipBlankLines: true, skipComments: true },
      ],
      "max-depth": ["error", 4],
      "max-params": ["error", 4],
    },
  },
  {
    // A `describe`/`test` callback is a declarative container, not a unit of
    // logic: its length tracks how many cases a suite covers, so the
    // per-function line budget reports noise here rather than complexity.
    // The budget rules that do measure logic — complexity, max-depth,
    // max-params — stay on for tests.
    files: ["**/*.test.ts"],
    rules: {
      "max-lines-per-function": "off",
    },
  },
);
