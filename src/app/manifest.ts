import type { MetadataRoute } from "next";

/**
 * Web App Manifest — served at /manifest.webmanifest by Next.js.
 *
 * theme_color / background_color match the `--background` oklch token from
 * globals.css (resolved to sRGB hex), keeping the PWA splash + address bar
 * visually continuous with the in-app canvas.
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
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
