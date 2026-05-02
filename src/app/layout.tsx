import type { Metadata, Viewport } from "next";
import { Noto_Sans_JP, Noto_Serif_JP, Shippori_Mincho } from "next/font/google";
import { Suspense } from "react";
import { ThemeProvider } from "next-themes";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { BotIdClient } from "botid/client";
import { PostHogProvider } from "@/components/providers/posthog-provider";
import "./globals.css";
import { cn } from "@/lib/utils";

/**
 * Vercel BotID protected endpoints. Each entry tells the BotIdClient
 * which paths to instrument (collect signals against) so the matching
 * server-side `checkBotId()` call has data to work with. Keep this list
 * in sync with the routes that actually invoke `detectBot()` server-
 * side — instrumenting a route the server doesn't gate, or gating a
 * route the client doesn't instrument, both produce false negatives.
 *
 * Targets are the highest cost / highest abuse paths:
 *   - /api/coach/stream — Anthropic credit drain (per-message $$$)
 *   - /api/user/delete — irreversible destructive operation
 *   - /api/user/export — data exfiltration surface
 */
const BOTID_PROTECTED = [
  { path: "/api/coach/stream", method: "POST" },
  { path: "/api/user/delete", method: "DELETE" },
  { path: "/api/user/export", method: "GET" },
] as const;

// Japanese glyphs are served lazily via unicode-range partitions (there is no
// "japanese" Google Fonts subset). On slow networks or platforms without
// system Japanese fonts, the swap fallback may render tofu (□) for headings,
// so we provide an explicit Japanese-capable system-font fallback chain.
const notoSansJP = Noto_Sans_JP({
  subsets: ["latin"],
  variable: "--font-noto-sans-jp",
  display: "swap",
  fallback: ["Hiragino Sans", "Hiragino Kaku Gothic ProN", "Yu Gothic", "Meiryo", "sans-serif"],
});

const notoSerifJP = Noto_Serif_JP({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-noto-serif-jp",
  display: "swap",
  fallback: ["Hiragino Mincho ProN", "Hiragino Mincho Pro", "Yu Mincho", "YuMincho", "MS Mincho", "serif"],
});

// Shippori Mincho — trial display serif used ONLY for hero copy, greeting h1,
// and venue-name h1 (24px+). Noto Serif JP remains the body serif. Latin
// subset only; Japanese glyphs are served lazily via unicode-range partitions
// like the other Noto families.
const shipporiMincho = Shippori_Mincho({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-shippori-mincho",
  display: "optional",
  preload: false,
  fallback: ["Hiragino Mincho ProN", "Hiragino Mincho Pro", "Yu Mincho", "YuMincho", "MS Mincho", "serif"],
});

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://haretoki.vercel.app";

const DEFAULT_TITLE = "Haretoki — 式場選びを、もっと納得のいくものに";
const DEFAULT_DESCRIPTION =
  "結婚式場の比較・評価・最終決定をAIが支援。見積もりの落とし穴を先回りで教え、ふたりの好みを見える化する中立ツール。";

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: {
    default: DEFAULT_TITLE,
    template: "%s · Haretoki",
  },
  description: DEFAULT_DESCRIPTION,
  keywords: ["結婚式場", "比較", "見積もり", "チェックリスト", "ブライダル", "Haretoki"],
  manifest: "/manifest.webmanifest",
  openGraph: {
    type: "website",
    locale: "ja_JP",
    url: APP_URL,
    siteName: "Haretoki",
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Haretoki" }],
  },
  twitter: {
    card: "summary_large_image",
    title: DEFAULT_TITLE,
    description: DEFAULT_DESCRIPTION,
    images: ["/og-image.png"],
  },
  icons: {
    icon: "/icons/logo.png",
    apple: "/icons/icon-192.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  // Match the PWA status bar / address bar with the app's warm cream surface
  // in light mode and the deep warm near-black in dark mode. Values come
  // straight from --background in globals.css (oklch resolved to sRGB).
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FAF6EE" },
    { media: "(prefers-color-scheme: dark)", color: "#1F1A14" },
  ],
};

/**
 * B-19 Structured data (JSON-LD).
 * Organization + WebSite + WebApplication. Emitted via <script type="application/ld+json">.
 * Google / Bing read these on first crawl for Knowledge Panel, sitelinks,
 * and rich result eligibility. Reuses the APP_URL constant declared above.
 */
const JSON_LD = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Haretoki",
    url: APP_URL,
    logo: `${APP_URL}/icons/icon-512.png`,
    description:
      "結婚式場の比較・評価・最終決定を支援する中立ツール。見積もりの落とし穴を先回りで教え、ふたりの好みを見える化します。",
  },
  {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: "Haretoki",
    url: APP_URL,
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${APP_URL}/explore?q={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  },
  {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: "Haretoki",
    url: APP_URL,
    applicationCategory: "LifestyleApplication",
    operatingSystem: "All",
    offers: { "@type": "Offer", price: "0", priceCurrency: "JPY" },
    description:
      "結婚式場の比較・評価・最終決定を支援する中立の AI パートナー。無料・カード不要。",
  },
];

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" suppressHydrationWarning className={cn(notoSansJP.variable, notoSerifJP.variable, shipporiMincho.variable, "font-sans")}>
      <body className="min-h-dvh bg-background text-foreground antialiased">
        {/* B-19 JSON-LD — crawler-facing structured data.
            `type="application/ld+json"` is a data block, NOT executable
            script, so CSP script-src restrictions do not apply (per
            CSP Level 3 §6.1) — no nonce required. The CSP nonce we
            stamp in middleware is for any future executable inline
            <script> we might add. */}
        <script
          type="application/ld+json"
          // Static JSON string, no interpolation of user data — safe.
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
        {/* Vercel BotID — instruments the protected routes listed in
            BOTID_PROTECTED so server-side `checkBotId()` (`src/lib/botid.ts`)
            has signals to evaluate. No-op when the BotID feature isn't
            provisioned in the Vercel project. */}
        <BotIdClient protect={[...BOTID_PROTECTED]} />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <PostHogProvider>
            {/* W16-6 (performance-audit B-03 補完): MotionProvider is now
                mounted only by routes that actually use framer-motion —
                (app), (demo), and the landing page wrapper. Auth screens,
                /accept-invite and /invite/[token] no longer pay the
                LazyMotion features load (saves ~20-30ms FCP on those). */}
            <Suspense>{children}</Suspense>
          </PostHogProvider>
        </ThemeProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
