import { describe, expect, it } from "vitest";
import {
  deriveRelatedUrls,
  stripTracking,
} from "@/lib/url-import/domain-router";

describe("deriveRelatedUrls", () => {
  it("derives zexy sub-pages from a detail URL with tracking params", () => {
    const r = deriveRelatedUrls(
      "https://zexy.net/wedding/c_7770029193/?vos=abc&gclsrc=ds",
    );
    expect(r.domain).toBe("zexy");
    expect(r.detail).toBe("https://zexy.net/wedding/c_7770029193/");
    expect(r.photos).toBe(
      "https://zexy.net/wedding/c_7770029193/imageGallery/",
    );
    expect(r.reviews).toBe("https://zexy.net/wedding/c_7770029193/kuchikomi/");
    expect(r.plans).toBe("https://zexy.net/wedding/c_7770029193/plan/");
  });

  it("extracts zexy venue id even from legacy /kuchikomi/c_{id}/ path", () => {
    const r = deriveRelatedUrls(
      "https://zexy.net/wedding/kuchikomi/c_7770029193/",
    );
    expect(r.domain).toBe("zexy");
    expect(r.reviews).toBe("https://zexy.net/wedding/c_7770029193/kuchikomi/");
  });

  it("derives wedding park sub-pages from deep path", () => {
    const r = deriveRelatedUrls(
      "https://www.weddingpark.net/tokyo/shinjuku/00000ABC/",
    );
    expect(r.domain).toBe("wedding_park");
    expect(r.detail).toBe(
      "https://www.weddingpark.net/tokyo/shinjuku/00000ABC/",
    );
    expect(r.photos).toBe(
      "https://www.weddingpark.net/tokyo/shinjuku/00000ABC/photos/",
    );
    expect(r.reviews).toBe(
      "https://www.weddingpark.net/tokyo/shinjuku/00000ABC/reviews/",
    );
  });

  it("wedding park strips existing trailing sub-page and re-derives", () => {
    const r = deriveRelatedUrls(
      "https://www.weddingpark.net/tokyo/shinjuku/00000ABC/photos/",
    );
    expect(r.detail).toBe(
      "https://www.weddingpark.net/tokyo/shinjuku/00000ABC/",
    );
    expect(r.reviews).toBe(
      "https://www.weddingpark.net/tokyo/shinjuku/00000ABC/reviews/",
    );
  });

  it("derives hanayume sub-pages from root-level numeric id", () => {
    const r = deriveRelatedUrls("https://hana-yume.net/726/?yclid=abc");
    expect(r.domain).toBe("hanayume");
    expect(r.detail).toBe("https://hana-yume.net/726/");
    expect(r.photos).toBe("https://hana-yume.net/726/photo/");
    expect(r.plans).toBe("https://hana-yume.net/726/plan/");
    // /review/ is 404 on hana-yume live, must not be requested.
    expect(r.reviews).toBeUndefined();
  });

  it("hanayume strips inrlead tracking param", () => {
    const r = deriveRelatedUrls(
      "https://hana-yume.net/726/photo/?inrlead=xxx&yclid=yyy",
    );
    expect(r.detail).toBe("https://hana-yume.net/726/");
  });

  it("derives mynavi sub-pages", () => {
    const r = deriveRelatedUrls("https://wedding.mynavi.jp/hall/abc789/");
    expect(r.domain).toBe("mynavi");
    expect(r.photos).toBe("https://wedding.mynavi.jp/hall/abc789/photo/");
    expect(r.reviews).toBe("https://wedding.mynavi.jp/hall/abc789/review/");
  });

  it("derives mwed sub-pages from /hall/{id}/ path", () => {
    const r = deriveRelatedUrls("https://www.mwed.jp/hall/10242/");
    expect(r.domain).toBe("minna_no_wedding");
    expect(r.detail).toBe("https://www.mwed.jp/hall/10242/");
    expect(r.photos).toBe("https://www.mwed.jp/hall/10242/photo/");
    expect(r.plans).toBe("https://www.mwed.jp/hall/10242/plan/");
    // Reviews 404 on mwed live, must not be requested.
    expect(r.reviews).toBeUndefined();
  });

  it("falls back to detail-only for unknown domains", () => {
    const r = deriveRelatedUrls("https://example.com/hall/foo/?utm_source=x");
    expect(r.domain).toBe("unknown");
    expect(r.detail).toBe("https://example.com/hall/foo/");
    expect(r.photos).toBeUndefined();
    expect(r.reviews).toBeUndefined();
  });
});

describe("stripTracking", () => {
  it("removes tracking params while preserving semantic params", () => {
    const url = new URL(
      "https://zexy.net/wedding/c_7770029193/?vos=abc&page=2&utm_source=g",
    );
    const stripped = stripTracking(url);
    expect(stripped.toString()).toBe(
      "https://zexy.net/wedding/c_7770029193/?page=2",
    );
  });

  it("collapses empty query string cleanly", () => {
    const url = new URL(
      "https://zexy.net/wedding/c_123/?vos=x&gclid=y&fbclid=z",
    );
    expect(stripTracking(url).toString()).toBe(
      "https://zexy.net/wedding/c_123/",
    );
  });
});
