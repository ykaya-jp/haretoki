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
      // P2.C a11y audit: lift the rules eslint-config-next ships at
      // 'warn' (or omits) up to error/warn so the static analyzer
      // catches new keyboard / role / label regressions on touch.
      // The audit pass cleared every existing finding via fix or a
      // rationale-tagged eslint-disable, so the codebase already
      // satisfies these — keeping them on prevents drift.
      "jsx-a11y/click-events-have-key-events": "error",
      "jsx-a11y/no-static-element-interactions": "error",
      "jsx-a11y/no-noninteractive-element-interactions": "error",
      "jsx-a11y/no-noninteractive-tabindex": "error",
      "jsx-a11y/no-noninteractive-element-to-interactive-role": "error",
      "jsx-a11y/label-has-associated-control": "error",
      "jsx-a11y/aria-role": "error",
      "jsx-a11y/no-autofocus": "warn",
    },
  },
]);

export default eslintConfig;
