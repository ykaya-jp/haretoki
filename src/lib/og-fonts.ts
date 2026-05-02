/**
 * Best-effort Google Fonts loader for `next/og` ImageResponse.
 *
 * `next/og` (satori) doesn't pull system fonts and the brand uses
 * Noto Serif JP (Mincho) for hero typography. To get the right serif
 * weight in OG previews we fetch the font binary from Google Fonts at
 * render time and pass it via ImageResponse's `fonts` option.
 *
 * Why pass `text` to the API: Google Fonts can return a subsetted woff
 * containing only the glyphs the URL declares it needs. For Japanese
 * fonts this is the difference between a ~3 MB full font and a 5-15 KB
 * payload — meaningful at the cold-start budget for OG generation.
 *
 * Failure path: any network or parse failure returns `null` so the
 * caller can fall back to satori's built-in sans-serif. We never throw
 * — an OG image is a presentational asset, not a critical path.
 */

import { captureMessage } from "@/lib/sentry";

export type LoadedFont = {
  name: string;
  data: ArrayBuffer;
  weight: 300 | 400 | 500 | 600 | 700;
  style: "normal" | "italic";
};

interface LoadFontParams {
  /** Google Fonts family slug — e.g. "Noto+Serif+JP". URL-encoded form. */
  family: string;
  /** Weight axis value. Must be one Google Fonts has for the family. */
  weight: 300 | 400 | 500 | 600 | 700;
  /** The exact characters that will appear in the rendered ImageResponse.
   *  Subsetting the font to just these glyphs keeps the payload ~10 KB
   *  for Japanese; passing too-much text inflates cold-start latency. */
  text: string;
  /** Display name handed to ImageResponse — must match `fontFamily`
   *  values used inside the JSX tree. */
  displayName: string;
}

export async function loadGoogleFont(
  params: LoadFontParams,
): Promise<LoadedFont | null> {
  const { family, weight, text, displayName } = params;
  if (!text || text.length === 0) return null;

  const url = `https://fonts.googleapis.com/css2?family=${family}:wght@${weight}&text=${encodeURIComponent(
    text,
  )}&display=swap`;

  try {
    const cssResponse = await fetch(url, {
      // Setting a UA tells Google Fonts to return woff2; without one we
      // sometimes get a TTF that satori parses noticeably slower.
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
      },
    });
    if (!cssResponse.ok) return null;
    const css = await cssResponse.text();

    // The CSS @font-face block carries one `src: url(...) format('...')`.
    // We grab the URL of the binary and fetch that directly.
    const match = css.match(
      /src:\s*url\(([^)]+)\)\s*format\('(?:woff2|woff|truetype|opentype)'\)/,
    );
    if (!match) return null;
    const fontUrl = match[1];

    const fontResponse = await fetch(fontUrl);
    if (!fontResponse.ok) return null;
    const data = await fontResponse.arrayBuffer();

    return {
      name: displayName,
      data,
      weight,
      style: "normal",
    };
  } catch (err) {
    // Best-effort log — Sentry no-ops without DSN, so dev / CI stay silent.
    captureMessage("og-fonts: load failed, falling back to default font", {
      level: "info",
      extra: {
        family,
        weight,
        textLength: text.length,
        message: err instanceof Error ? err.message : String(err),
      },
    });
    return null;
  }
}

/**
 * Convenience: load multiple weights of the same family for one
 * ImageResponse, dropping any that failed. Caller spreads the array
 * into `fonts: [...]`. Empty array is a valid fallback (satori uses
 * its built-in default).
 */
export async function loadGoogleFonts(
  params: LoadFontParams[],
): Promise<LoadedFont[]> {
  const settled = await Promise.all(params.map((p) => loadGoogleFont(p)));
  return settled.filter((f): f is LoadedFont => f !== null);
}
