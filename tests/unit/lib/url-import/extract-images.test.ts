import { describe, expect, it } from "vitest";
import {
  extractImagesFromHtml,
  mergePhotoUrls,
  pickHighestResFromSrcset,
} from "@/lib/url-import/extract-images";

describe("pickHighestResFromSrcset", () => {
  it("returns largest width descriptor", () => {
    const srcset =
      "https://cdn.example.com/a_400.jpg 400w, https://cdn.example.com/a_800.jpg 800w, https://cdn.example.com/a_1600.jpg 1600w";
    expect(pickHighestResFromSrcset(srcset)).toBe(
      "https://cdn.example.com/a_1600.jpg",
    );
  });

  it("returns largest density descriptor", () => {
    const srcset = "a.jpg 1x, b.jpg 2x, c.jpg 3x";
    expect(pickHighestResFromSrcset(srcset)).toBe("c.jpg");
  });

  it("handles no descriptor (single URL)", () => {
    expect(pickHighestResFromSrcset("a.jpg")).toBe("a.jpg");
  });

  it("returns null for empty input", () => {
    expect(pickHighestResFromSrcset("")).toBeNull();
    expect(pickHighestResFromSrcset("   ")).toBeNull();
  });
});

describe("extractImagesFromHtml", () => {
  const base = "https://zexy.net/wedding/c_7770029193/";

  it("extracts img[src] with absolute URL resolution", () => {
    const html = `
      <html><body>
        <img src="/images/hero.jpg">
        <img src="https://cdn.zexy.net/hero2.jpg">
      </body></html>
    `;
    const urls = extractImagesFromHtml(html, base);
    expect(urls).toContain("https://zexy.net/images/hero.jpg");
    expect(urls).toContain("https://cdn.zexy.net/hero2.jpg");
  });

  it("extracts img[data-src] and img[data-original] (lazy-load)", () => {
    const html = `
      <html><body>
        <img data-src="/lazy1.jpg">
        <img data-original="/lazy2.jpg">
      </body></html>
    `;
    const urls = extractImagesFromHtml(html, base);
    expect(urls).toContain("https://zexy.net/lazy1.jpg");
    expect(urls).toContain("https://zexy.net/lazy2.jpg");
  });

  it("picks max-resolution URL from img[srcset]", () => {
    const html = `
      <html><body>
        <img srcset="/a_400.jpg 400w, /a_1200.jpg 1200w">
      </body></html>
    `;
    const urls = extractImagesFromHtml(html, base);
    expect(urls).toContain("https://zexy.net/a_1200.jpg");
    expect(urls).not.toContain("https://zexy.net/a_400.jpg");
  });

  it("extracts picture > source[srcset]", () => {
    const html = `
      <html><body>
        <picture>
          <source srcset="/webp_400.webp 400w, /webp_1600.webp 1600w">
          <img src="/fallback.jpg">
        </picture>
      </body></html>
    `;
    const urls = extractImagesFromHtml(html, base);
    expect(urls).toContain("https://zexy.net/webp_1600.webp");
    expect(urls).toContain("https://zexy.net/fallback.jpg");
  });

  it("drops thumbnail markers (_thumb, _50x50, etc.)", () => {
    const html = `
      <html><body>
        <img src="/hero.jpg">
        <img src="/hero_thumb.jpg">
        <img src="/img_50x50.jpg">
        <img src="/real.jpg">
      </body></html>
    `;
    const urls = extractImagesFromHtml(html, base);
    expect(urls).toContain("https://zexy.net/hero.jpg");
    expect(urls).toContain("https://zexy.net/real.jpg");
    expect(urls).not.toContain("https://zexy.net/hero_thumb.jpg");
    expect(urls).not.toContain("https://zexy.net/img_50x50.jpg");
  });

  it("skips data: URIs", () => {
    const html = `
      <html><body>
        <img src="data:image/png;base64,iVBORw0KG...">
        <img src="/real.jpg">
      </body></html>
    `;
    const urls = extractImagesFromHtml(html, base);
    expect(urls).toEqual(["https://zexy.net/real.jpg"]);
  });

  it("dedupes while preserving order", () => {
    const html = `
      <html><body>
        <img src="/a.jpg">
        <img src="/b.jpg">
        <img src="/a.jpg">
      </body></html>
    `;
    const urls = extractImagesFromHtml(html, base);
    expect(urls).toEqual([
      "https://zexy.net/a.jpg",
      "https://zexy.net/b.jpg",
    ]);
  });

  it("respects maxUrls cap", () => {
    const imgs = Array.from(
      { length: 50 },
      (_, i) => `<img src="/img${i}.jpg">`,
    ).join("\n");
    const html = `<html><body>${imgs}</body></html>`;
    const urls = extractImagesFromHtml(html, base, 10);
    expect(urls).toHaveLength(10);
  });

  it("returns empty array for empty or malformed HTML", () => {
    expect(extractImagesFromHtml("", base)).toEqual([]);
  });

  it("accepts extensionless URLs under an images/photos path", () => {
    const html = `
      <html><body>
        <img src="/images/abc123">
      </body></html>
    `;
    const urls = extractImagesFromHtml(html, base);
    expect(urls).toContain("https://zexy.net/images/abc123");
  });
});

describe("mergePhotoUrls", () => {
  it("unions lists with dedupe, preserving existing order", () => {
    const existing = ["a.jpg", "b.jpg"];
    const scraped = ["b.jpg", "c.jpg"];
    expect(mergePhotoUrls(existing, scraped)).toEqual([
      "a.jpg",
      "b.jpg",
      "c.jpg",
    ]);
  });

  it("caps at maxUrls", () => {
    const existing = ["1.jpg", "2.jpg"];
    const scraped = ["3.jpg", "4.jpg", "5.jpg"];
    expect(mergePhotoUrls(existing, scraped, 3)).toEqual([
      "1.jpg",
      "2.jpg",
      "3.jpg",
    ]);
  });

  it("handles empty inputs", () => {
    expect(mergePhotoUrls([], ["a.jpg"])).toEqual(["a.jpg"]);
    expect(mergePhotoUrls(["a.jpg"], [])).toEqual(["a.jpg"]);
    expect(mergePhotoUrls([], [])).toEqual([]);
  });
});
