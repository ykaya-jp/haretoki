# i18n Migration Guide (next-intl scaffold)

This document describes how to migrate Japanese string literals in the app to
the `next-intl` translation system. The scaffold is intentionally minimal —
only a handful of shared keys are translated today. Migrate module-by-module,
not in one large sweep.

## Current state

- `src/i18n/config.ts` — declares supported locales. `ja` is the default.
- `src/i18n/request.ts` — `next-intl` App Router config. The active locale is
  locked to `ja` until locale resolution (cookie/header/user preference) is
  wired up in a follow-up.
- `src/i18n/messages/ja.json` — source of truth for Japanese copy.
- `src/i18n/messages/en.json` — English scaffold. Untranslated values fall
  back to Japanese to keep the UI coherent during the migration.
- `next.config.ts` wraps the Next.js config with `createNextIntlPlugin()`.

## How to migrate a string

1. Pick a coherent namespace (e.g. `settings`, `auth.login`, `coach.chat`).
2. Add the Japanese literal to `src/i18n/messages/ja.json` under that
   namespace. Mirror the key in `src/i18n/messages/en.json` (English if
   obvious, otherwise copy the Japanese value as a fallback and mark it for
   later translation).
3. Use the translation hook:

### Client Component

```tsx
"use client";
import { useTranslations } from "next-intl";

export function LoginForm() {
  const t = useTranslations("auth.login");
  return <button>{t("submit")}</button>;
}
```

### Server Component

```tsx
import { getTranslations } from "next-intl/server";

export default async function Page() {
  const t = await getTranslations("settings");
  return <h1>{t("title")}</h1>;
}
```

## Do NOT do in one PR

Swapping every Japanese literal across the app is a huge refactor and a merge
magnet. Migrate one page or feature at a time, ideally alongside other work
that already touches those files.

## Follow-up work (not in this scaffold)

- Locale resolution from cookie / `Accept-Language` / user preference.
- Locale switcher UI.
- Middleware-based routing (`/en/...` vs `/ja/...`) if we ever want SEO per
  locale.
- Pluralization & `ICU` formatting for numbers/dates/relative time.
- CI check that every key in `ja.json` has a counterpart in `en.json`.
