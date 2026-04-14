import type { Metadata, Viewport } from "next";
import { Noto_Sans_JP, Noto_Serif_JP, Shippori_Mincho, Geist } from "next/font/google";
import { ThemeProvider } from "next-themes";
import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { MotionProvider } from "@/components/providers/motion-provider";
import { PostHogProvider } from "@/components/providers/posthog-provider";
import "./globals.css";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-geist'});

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
  weight: ["300", "400", "500"],
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
  weight: ["400", "500", "600"],
  variable: "--font-shippori-mincho",
  display: "swap",
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" suppressHydrationWarning className={cn(notoSansJP.variable, notoSerifJP.variable, shipporiMincho.variable, "font-sans", geist.variable)}>
      <body className="min-h-dvh bg-background text-foreground antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          <PostHogProvider>
            <MotionProvider>{children}</MotionProvider>
          </PostHogProvider>
        </ThemeProvider>
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}
