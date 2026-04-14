import type { Metadata, Viewport } from "next";
import { Noto_Sans_JP, Noto_Serif_JP, Geist } from "next/font/google";
import { ThemeProvider } from "next-themes";
import "./globals.css";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-geist'});

const notoSansJP = Noto_Sans_JP({
  subsets: ["latin"],
  variable: "--font-noto-sans-jp",
  display: "swap",
});

const notoSerifJP = Noto_Serif_JP({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  variable: "--font-noto-serif-jp",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Haretoki — ふたりの式場選びパートナー",
  description: "見積もりの落とし穴を事前に把握し、二人の意見を見える化して、後悔のない式場選びを支援します。",
  manifest: "/manifest.json",
  openGraph: {
    title: "Haretoki — ふたりの式場選びパートナー",
    description: "見積もりの落とし穴を事前に把握し、二人の意見を見える化して、後悔のない式場選びを支援します。",
    images: [{ url: "/og-image.png", width: 1200, height: 630 }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Haretoki — ふたりの式場選びパートナー",
    description: "見積もりの落とし穴を事前に把握し、二人の意見を見える化して、後悔のない式場選びを支援します。",
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
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja" suppressHydrationWarning className={cn(notoSansJP.variable, notoSerifJP.variable, "font-sans", geist.variable)}>
      <body className="min-h-dvh bg-background text-foreground antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
