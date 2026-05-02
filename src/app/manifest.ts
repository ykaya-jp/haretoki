import type { MetadataRoute } from "next";

/**
 * Web App Manifest — served at /manifest.webmanifest by Next.js.
 *
 * theme_color / background_color match the `--background` oklch token from
 * globals.css (resolved to sRGB hex), keeping the PWA splash + address bar
 * visually continuous with the in-app canvas.
 *
 * Icon set: each PNG is declared TWICE — once with `purpose: "any"`
 * (used by older Android launchers, browser tabs, the Chrome PWA
 * install prompt) and once with `purpose: "maskable"` (used by
 * adaptive icons on Android 8+ which crop a 10% safe-zone). A single
 * `maskable` declaration alone causes legacy launchers to crop the
 * mark; declaring both lets the launcher pick the appropriate
 * version. The PNGs themselves already include the safe-zone padding
 * so the same file works for both purposes — see
 * `public/brand/README.md` for the source-of-truth artwork.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Haretoki",
    short_name: "Haretoki",
    description: "結婚式場の比較・評価・最終決定を支援するAIパートナー",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#FAF6EE",
    theme_color: "#FAF6EE",
    lang: "ja",
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
