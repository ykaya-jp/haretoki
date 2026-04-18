import { describe, expect, it } from "vitest";
import { parseJsonLd } from "@/lib/url-import/jsonld-parser";

describe("parseJsonLd", () => {
  it("extracts LocalBusiness name / aggregateRating / geo / address", () => {
    const blob = {
      "@context": "https://schema.org",
      "@type": "LocalBusiness",
      name: "アーカンジェル南青山",
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: "4.47",
        reviewCount: 1433,
      },
      geo: {
        "@type": "GeoCoordinates",
        latitude: 35.66182,
        longitude: 139.71755,
      },
      address: {
        "@type": "PostalAddress",
        postalCode: "107-0062",
        streetAddress: "港区南青山3-14-23",
        addressLocality: "港区",
        addressRegion: "東京都",
      },
      telephone: "03-1234-5678",
      image: [
        "https://cdn.zexy.net/p/a.jpg",
        { url: "https://cdn.zexy.net/p/b.jpg" },
      ],
    };
    const r = parseJsonLd([blob]);
    expect(r.name).toBe("アーカンジェル南青山");
    expect(r.aggregateRating).toEqual({ value: 4.47, count: 1433 });
    expect(r.geo).toEqual({ lat: 35.66182, lng: 139.71755 });
    expect(r.address).toEqual({
      postal: "107-0062",
      street: "港区南青山3-14-23",
      locality: "港区",
      region: "東京都",
    });
    expect(r.phone).toBe("03-1234-5678");
    expect(r.images).toEqual([
      "https://cdn.zexy.net/p/a.jpg",
      "https://cdn.zexy.net/p/b.jpg",
    ]);
  });

  it("unwraps @graph nesting and finds venue within", () => {
    const blob = {
      "@context": "https://schema.org",
      "@graph": [
        { "@type": "BreadcrumbList", itemListElement: [] },
        {
          "@type": "Organization",
          name: "ハナユメ式場",
          image: ["https://hana-yume.net/p/x.jpg"],
        },
      ],
    };
    const r = parseJsonLd([blob]);
    expect(r.name).toBe("ハナユメ式場");
    expect(r.images).toEqual(["https://hana-yume.net/p/x.jpg"]);
  });

  it("merges images across multiple blobs and dedupes", () => {
    const detail = {
      "@type": "Organization",
      name: "X",
      image: ["https://cdn/1.jpg", "https://cdn/2.jpg"],
    };
    const photos = {
      "@type": "Organization",
      name: "X",
      image: ["https://cdn/2.jpg", "https://cdn/3.jpg"],
    };
    const r = parseJsonLd([detail, photos]);
    expect(r.images?.sort()).toEqual([
      "https://cdn/1.jpg",
      "https://cdn/2.jpg",
      "https://cdn/3.jpg",
    ]);
  });

  it("extracts Events (bridal fairs) from mwed-style Event blobs", () => {
    const blob = [
      {
        "@type": "Event",
        name: "ブライダルフェア 春の試食会",
        startDate: "2026-05-03",
        url: "https://www.mwed.jp/hall/10242/fair/1/",
      },
      {
        "@type": "Event",
        name: "ドレス試着会",
        startDate: "2026-05-10",
      },
    ];
    const r = parseJsonLd([blob]);
    expect(r.events).toHaveLength(2);
    expect(r.events?.[0]).toMatchObject({
      name: "ブライダルフェア 春の試食会",
      startDate: "2026-05-03",
    });
  });

  it("rejects out-of-range rating/geo (defensive against bad data)", () => {
    const blob = {
      "@type": "LocalBusiness",
      name: "bogus",
      aggregateRating: { ratingValue: 99, reviewCount: 10 },
      geo: { latitude: 9999, longitude: 9999 },
    };
    const r = parseJsonLd([blob]);
    expect(r.aggregateRating).toBeUndefined();
    expect(r.geo).toBeUndefined();
  });

  it("falls back to any object when no known venue @type matches", () => {
    const blob = {
      "@type": "SomeCustomType",
      name: "独自サイト式場",
      telephone: "0120-000-000",
    };
    const r = parseJsonLd([blob]);
    expect(r.name).toBe("独自サイト式場");
    expect(r.phone).toBe("0120-000-000");
  });

  it("returns empty object for empty / null input", () => {
    expect(parseJsonLd([])).toEqual({});
    expect(parseJsonLd([null, undefined as unknown])).toEqual({});
  });

  it("prefers the venue-shaped LocalBusiness over a parent Organization (hanayume pattern)", () => {
    // hanayume emits the operating company first (HQ in Aichi), then the venue.
    // Taking blob[0] naively lands on the corporate HQ; we want the venue.
    const parentOrg = {
      "@type": "Organization",
      name: "株式会社エイチームライフデザイン",
      address: {
        "@type": "PostalAddress",
        addressLocality: "名古屋市中村区",
        addressRegion: "愛知県",
        postalCode: "450-6432",
      },
    };
    const venue = {
      "@type": "LocalBusiness",
      name: "ウェディングスホテル・ベルクラシック東京",
      aggregateRating: {
        "@type": "AggregateRating",
        ratingValue: "4",
        ratingCount: "941",
      },
      telephone: "0120-791-317",
      image: "https://hana-yume.net/uploads/hall_search/726/1.jpg",
      address: {
        "@type": "PostalAddress",
        addressLocality: "豊島区",
        addressRegion: "東京都",
        streetAddress: "南大塚3-33-6",
      },
    };
    const r = parseJsonLd([parentOrg, venue]);
    expect(r.name).toBe("ウェディングスホテル・ベルクラシック東京");
    expect(r.phone).toBe("0120-791-317");
    expect(r.aggregateRating).toEqual({ value: 4, count: 941 });
    expect(r.address?.locality).toBe("豊島区");
    expect(r.address?.region).toBe("東京都");
  });
});
