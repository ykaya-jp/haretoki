# Haretoki — Brand Asset Master

This directory is the **single physical home** for verbatim brand artwork (PNG / SVG / ICO files) and the **single source of truth** for "where does this asset come from" questions.

For voice / typography / language rules, see [`docs/brand-voice.md`](../../docs/brand-voice.md).
For visual tokens (colors / spacing / motion), see [`DESIGN.md`](../../DESIGN.md).
For OG color palette in sRGB hex, see [`src/lib/og-tokens.ts`](../../src/lib/og-tokens.ts).

---

## 1. Asset inventory

| Asset | Location | Generator | Notes |
|---|---|---|---|
| Wordmark logo (gold) | [`public/icons/logo.png`](../icons/logo.png) | static | Used by hero / landing eyebrow. **Not** a favicon — degrades below ~24px. |
| App icon 192 | [`public/icons/icon-192.png`](../icons/icon-192.png) | static | Manifest `purpose: any` + `maskable`. Already includes a 10% safe-zone for adaptive icon cropping. |
| App icon 512 | [`public/icons/icon-512.png`](../icons/icon-512.png) | static | Manifest `purpose: any` + `maskable`. Splash + Android adaptive. |
| Favicon (32x32) | served from `/icon` | [`src/app/icon.tsx`](../../src/app/icon.tsx) | ImageResponse-generated from `og-tokens` (cream disk + gold sun). Replaces the legacy wordmark favicon that was unreadable below 24px. |
| Apple touch icon (180x180) | served from `/apple-icon` | [`src/app/apple-icon.tsx`](../../src/app/apple-icon.tsx) | ImageResponse-generated. Pre-rounded corners + safe-zone halo so it reads correctly in non-rounded contexts (older Android, share sheets). |
| Legacy `favicon.ico` | [`src/app/favicon.ico`](../../src/app/favicon.ico) | static | Served at `/favicon.ico` for crawlers + RSS readers that still ask for that exact path. Modern browsers prefer the dynamic `/icon` route. |
| Default OG image (1200x630) | served from `/opengraph-image` | [`src/app/opengraph-image.tsx`](../../src/app/opengraph-image.tsx) | Dynamic. Uses `OG_SKY_GRADIENT` + `OG_BRAND_EYEBROW` from `og-tokens`. |
| Static OG fallback | [`public/og-image.png`](../og-image.png) | static | Pre-rendered fallback referenced explicitly from `metadata.openGraph.images` in `layout.tsx`. Kept in addition to the dynamic route because some crawlers (Slack, LINE) prefer a static URL. |
| Hero chapel photo | [`public/images/hero-chapel.png`](../images/hero-chapel.png) | static | Landing hero background. Light-tinted, used at `opacity-[0.18]` over the wash gradient. |

---

## 2. Color palette (sRGB hex)

These are the **brand-frozen** values used by every static / generated asset. The corresponding CSS variables in [`globals.css`](../../src/app/globals.css) use OKLCH; satori (`next/og`) cannot resolve OKLCH so the OG / favicon / apple-icon generators read sRGB hex from [`src/lib/og-tokens.ts`](../../src/lib/og-tokens.ts).

| Token | Hex | Role |
|---|---|---|
| `gold-warm` | `#C9A84C` | Primary brand accent. AI / decision / sun mark. |
| `gold-soft` | `#E8D89A` | Halo / hairline glow. Lighter gold for diffused lighting. |
| `cloud-haze` | `#E4DED2` | Top-of-sky cool haze (曇り). |
| `cream` | `#FDFAF4` | Surface canvas (晴れ / `--background` in light mode). |
| `ink` | `#2A2320` | Body text (`--foreground` light). |
| `ink-muted` | `#7A6E62` | Sub-text on cream surface. |

Bumping any of these = update both `og-tokens.ts` AND the static `og-image.png` / `icon-192.png` / `icon-512.png`. The OG / favicon / apple-icon dynamic routes will pick up the change automatically on the next deploy.

---

## 3. Manifest icon purposes

[`src/app/manifest.ts`](../../src/app/manifest.ts) declares each PNG icon **twice** — once as `purpose: "any"` and once as `purpose: "maskable"`. This is intentional, NOT a duplicate:

- `any` — used by older Android launchers, browser tabs, the Chrome PWA install prompt. The icon is rendered as-is.
- `maskable` — used by Android 8+ adaptive icons. The launcher crops the icon to a circle / squircle / squircle / teardrop based on the device theme, masking the outer 10%.

The 192x512 PNG masters already contain a 10% safe-zone padding so the same file can serve both purposes. If you replace the masters, **keep the 10% transparent padding** or the maskable path will crop the brand mark.

---

## 4. Designer follow-up backlog

Tracked here so a later designer round can fill the gaps without scavenger-hunting through history:

- [ ] **SVG wordmark master** (currently we only have `logo.png`; vector source is missing). Block for: high-DPI marketing site, email header, future PDF exports.
- [ ] **Dark-mode logo variant**. The `logo.png` is gold on transparent — fine on cream, still legible on dark, but a dedicated dark variant (with a subtle ink halo) would polish the dark-mode landing.
- [ ] **Sun-only favicon SVG**. The 32x32 `/icon` route is generated dynamically with a flat fill. A vector-source SVG drop-in would let us generate at arbitrary DPI without re-running satori.
- [ ] **Splash screens for iOS standalone mode** (`/splash-*.png`). iOS only honors a small `apple-touch-startup-image` set; the absence today produces a flash of cream on launch. Acceptable for v1, polish later.
- [ ] **Email-header banner asset** (used by Resend templates in `src/server/email/templates/*`). Currently inlined per template; consolidating into a shared SVG asset would let copy + asset evolve independently.

---

## 5. Replacing assets — checklist

When a designer drops a new master:

- [ ] Replace the file at the path in §1, **same filename** (avoid breaking inbound links from older crawls / cached emails)
- [ ] Verify the 10% safe-zone padding is preserved for `icon-192.png` / `icon-512.png`
- [ ] If the brand color shifts, update `src/lib/og-tokens.ts` AND the manifest `theme_color` / `background_color` AND the `--background` / `--gold-warm` tokens in `globals.css`
- [ ] Clear `next` build cache (`rm -rf .next`) so the static assets pipeline picks up new content hashes
- [ ] Bump `CACHE_VERSION` in [`public/sw.js`](../sw.js) so existing PWA installs purge their cached old icons
- [ ] Verify on iOS (Add to Home Screen preview), Android (Chrome PWA install prompt), and desktop Chrome / Firefox / Safari favicon
