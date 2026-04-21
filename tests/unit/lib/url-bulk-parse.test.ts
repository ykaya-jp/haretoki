import { describe, it, expect } from "vitest";
import { parseBulkUrls, BULK_URL_LIMIT } from "@/lib/url-bulk-parse";

describe("parseBulkUrls", () => {
  it("returns empty array for empty / null-ish input", () => {
    expect(parseBulkUrls("")).toEqual([]);
    expect(parseBulkUrls("   ")).toEqual([]);
    expect(parseBulkUrls("\n\n\n")).toEqual([]);
  });

  it("extracts a single URL from plain text", () => {
    expect(parseBulkUrls("https://zexy.net/wedding/hall/x123/")).toEqual([
      "https://zexy.net/wedding/hall/x123/",
    ]);
  });

  it("splits multi-line paste into individual URLs", () => {
    const input = `
      https://zexy.net/wedding/hall/a/
      https://www.hanayume.com/hall/b/
      https://mwed.jp/hall/c/
    `;
    expect(parseBulkUrls(input)).toEqual([
      "https://zexy.net/wedding/hall/a/",
      "https://www.hanayume.com/hall/b/",
      "https://mwed.jp/hall/c/",
    ]);
  });

  it("handles whitespace-separated (no newlines)", () => {
    const input = "https://a.example.com/1  https://b.example.com/2";
    expect(parseBulkUrls(input)).toEqual([
      "https://a.example.com/1",
      "https://b.example.com/2",
    ]);
  });

  it("handles full-width spaces (U+3000) common in JP input", () => {
    const input = "https://a.example.com/1\u3000https://b.example.com/2";
    expect(parseBulkUrls(input)).toEqual([
      "https://a.example.com/1",
      "https://b.example.com/2",
    ]);
  });

  it("ignores non-URL tokens mixed in", () => {
    const input = `
      ここは候補の式場
      https://zexy.net/wedding/hall/a/
      とても良さそう
      https://mwed.jp/hall/b/
    `;
    expect(parseBulkUrls(input)).toEqual([
      "https://zexy.net/wedding/hall/a/",
      "https://mwed.jp/hall/b/",
    ]);
  });

  it("dedupes repeated URLs preserving first occurrence", () => {
    const input = `
      https://a.com/x
      https://b.com/y
      https://a.com/x
    `;
    expect(parseBulkUrls(input)).toEqual([
      "https://a.com/x",
      "https://b.com/y",
    ]);
  });

  it("strips trailing punctuation like Japanese period", () => {
    expect(parseBulkUrls("https://a.com/x。")).toEqual(["https://a.com/x"]);
    expect(parseBulkUrls("https://a.com/x,")).toEqual(["https://a.com/x"]);
    expect(parseBulkUrls("(https://a.com/x)")).toEqual(["https://a.com/x"]);
  });

  it("handles blank lines between URLs", () => {
    const input = `https://a.com/x\n\n\nhttps://b.com/y`;
    expect(parseBulkUrls(input)).toEqual([
      "https://a.com/x",
      "https://b.com/y",
    ]);
  });

  it("rejects non-http(s) schemes", () => {
    const input = `
      javascript:alert(1)
      file:///etc/passwd
      ftp://a.com/
      https://ok.com/
    `;
    expect(parseBulkUrls(input)).toEqual(["https://ok.com/"]);
  });

  it("accepts bare http:// (server-side SSRF guard will reject later)", () => {
    // The parser only checks shape; scheme policy is url-guard.ts's job.
    expect(parseBulkUrls("http://a.com/x")).toEqual(["http://a.com/x"]);
  });

  it("ignores malformed URL-looking tokens", () => {
    const input = "https:// https://";
    expect(parseBulkUrls(input)).toEqual([]);
  });

  it("BULK_URL_LIMIT is 10 (contract with UI)", () => {
    expect(BULK_URL_LIMIT).toBe(10);
  });
});
