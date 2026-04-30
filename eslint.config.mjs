import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // git worktrees used for parallel agent work — they have their own
    // node_modules / .next and shouldn't be linted from the main repo.
    ".claude/worktrees/**",
    // Playwright HTML report bundles its own minified vendor JS
    // (codeMirrorModule, defaultSettingsView, etc.) that trip every
    // unused-expression / unused-vars rule. Generated artifact, never
    // checked in — exclude from lint so CI / local runs stay clean.
    "playwright-report/**",
    "test-results/**",
  ]),
  {
    // Respect the `_arg` / `_opts` convention used widely in test mock
    // signatures ("this parameter is intentionally unused but must match
    // the real function shape"). Without this, every mock like
    //   (_opts: Options) => ({ ok: true })
    // raises @typescript-eslint/no-unused-vars and pollutes `npm run lint`
    // output — making it harder to spot new genuinely-unused imports.
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          args: "after-used",
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
        },
      ],
    },
  },
]);

export default eslintConfig;
