import { describe, it, expect } from "vitest";
import {
  extractMetadata,
  hasUsefulMetadata,
  buildMetadataPrompt,
} from "@/server/actions/url-metadata";

const ZEXY_LIKE_HTML = `<!DOCTYPE html>
<html lang="ja">
<head>
  <title>アニヴェルセル表参道 | 結婚式場 | ゼクシィ</title>
  <meta name="description" content="表参道駅徒歩3分。チャペル挙式ができる結婚式場です。" />
  <meta name="keywords" content="結婚式場,表参道,チャペル" />
  <meta property="og:title" content="アニヴェルセル表参道" />
  <meta property="og:description" content="表参道の人気結婚式場" />
  <meta property="og:image" content="https://zexy.net/images/venue/123.jpg" />
  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content="Twitter版タイトル" />
  <script type="application/ld+json">
    {"@context":"https://schema.org","@type":"LocalBusiness","name":"アニヴェルセル表参道","address":"東京都港区北青山3-5-30","telephone":"03-0000-0000"}
  </script>
</head>
<body>
  <div id="root"></div>
  <script>window.__DATA__ = {};</script>
</body>
</html>`;

const OGP_ABSENT_HTML = `<!DOCTYPE html>
<html>
<head></head>
<body><p>plain page with no metadata at all</p></body>
</html>`;

describe("extractMetadata", () => {
  it("parses OGP, Twitter, meta tags, JSON-LD, and title from a Zexy-like SPA shell", () => {
    const md = extractMetadata(ZEXY_LIKE_HTML);

    expect(md.title).toBe(
      "アニヴェルセル表参道 | 結婚式場 | ゼクシィ"
    );
    expect(md.og["og:title"]).toBe("アニヴェルセル表参道");
    expect(md.og["og:description"]).toBe("表参道の人気結婚式場");
    expect(md.og["og:image"]).toBe("https://zexy.net/images/venue/123.jpg");
    // Twitter aliasing only fills og:* when missing; og:title was already set.
    expect(md.og["twitter:title"]).toBe("Twitter版タイトル");
    expect(md.og["og:title"]).not.toBe("Twitter版タイトル");

    expect(md.meta["description"]).toBe(
      "表参道駅徒歩3分。チャペル挙式ができる結婚式場です。"
    );
    expect(md.meta["keywords"]).toBe("結婚式場,表参道,チャペル");

    expect(md.jsonLd).toHaveLength(1);
    expect(md.jsonLd[0]).toMatchObject({
      "@type": "LocalBusiness",
      name: "アニヴェルセル表参道",
    });
  });

  it("aliases twitter:* onto og:* when og:* is absent", () => {
    const html = `<html><head>
      <meta name="twitter:title" content="Only Twitter Title" />
      <meta name="twitter:image" content="https://x/y.jpg" />
    </head></html>`;
    const md = extractMetadata(html);
    expect(md.og["og:title"]).toBe("Only Twitter Title");
    expect(md.og["og:image"]).toBe("https://x/y.jpg");
  });

  it("returns empty containers when the page has no metadata", () => {
    const md = extractMetadata(OGP_ABSENT_HTML);
    expect(md.title).toBeNull();
    expect(md.og).toEqual({});
    expect(md.meta).toEqual({});
    expect(md.jsonLd).toEqual([]);
  });

  it("skips malformed JSON-LD blocks without throwing", () => {
    const html = `<html><head>
      <script type="application/ld+json">{ not valid json </script>
      <script type="application/ld+json">{"@type":"Event","name":"ok"}</script>
    </head></html>`;
    const md = extractMetadata(html);
    expect(md.jsonLd).toHaveLength(1);
    expect(md.jsonLd[0]).toMatchObject({ "@type": "Event" });
  });

  it("decodes HTML entities in meta content", () => {
    const html = `<html><head>
      <meta property="og:title" content="A &amp; B &#39;venue&#39;" />
    </head></html>`;
    const md = extractMetadata(html);
    expect(md.og["og:title"]).toBe("A & B 'venue'");
  });
});

describe("hasUsefulMetadata", () => {
  it("is true when OGP or JSON-LD is present", () => {
    expect(hasUsefulMetadata(extractMetadata(ZEXY_LIKE_HTML))).toBe(true);
  });
  it("is false for a bare HTML page", () => {
    expect(hasUsefulMetadata(extractMetadata(OGP_ABSENT_HTML))).toBe(false);
  });
});

describe("buildMetadataPrompt", () => {
  it("includes title, description, image, and JSON-LD in the prompt", () => {
    const md = extractMetadata(ZEXY_LIKE_HTML);
    const prompt = buildMetadataPrompt(
      "https://zexy.net/foo",
      md,
      "short body"
    );
    expect(prompt).toContain("URL: https://zexy.net/foo");
    expect(prompt).toContain("アニヴェルセル表参道");
    expect(prompt).toContain("zexy.net/images/venue/123.jpg");
    expect(prompt).toContain("LocalBusiness");
    expect(prompt).toContain("short body");
  });
});
