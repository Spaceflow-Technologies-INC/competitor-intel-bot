import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  js.configs.recommended,
  {
    files: ["src/**/*.ts", "test/**/*.ts", "vitest.config.ts"],
    extends: [...tseslint.configs.recommended],
    ignores: ["dist/**", "node_modules/**", "coverage/**"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir: import.meta.dirname
      }
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-floating-promises": "error"
    }
  }
);
