import { describe, expect, it } from "vitest";
import {
  normalizeName,
  haversineMeters,
  levenshtein,
  matchExistingVenue,
  mergeVenueFields,
  type ExistingVenueSummary,
  type VenueCandidate,
} from "@/lib/venue-dedupe";

describe("normalizeName", () => {
  it("collapses whitespace, punctuation, and case", () => {
    expect(normalizeName("アーカンジェル 南青山・ル・アンジェ教会")).toBe(
      "アーカンジェル南青山ルアンジェ教会",
    );
    expect(normalizeName("THE  Strings 表参道")).toBe("thestrings表参道");
    expect(normalizeName("Arkangel (Minami-Aoyama)")).toBe("arkangelminamiaoyama");
  });
});

describe("haversineMeters", () => {
  it("computes sub-metre distance for identical coordinates", () => {
    const d = haversineMeters(
      { lat: 35.66182, lng: 139.71755 },
      { lat: 35.66182, lng: 139.71755 },
    );
    expect(d).toBeLessThan(1);
  });
  it("computes ~111km for 1 degree of latitude", () => {
    const d = haversineMeters(
      { lat: 35, lng: 139 },
      { lat: 36, lng: 139 },
    );
    expect(d).toBeGreaterThan(110_000);
    expect(d).toBeLessThan(112_000);
  });
});

describe("levenshtein", () => {
  it("returns 0 for equal strings", () => {
    expect(levenshtein("abc", "abc")).toBe(0);
  });
  it("returns length for empty counterpart", () => {
    expect(levenshtein("abc", "")).toBe(3);
    expect(levenshtein("", "abc")).toBe(3);
  });
  it("computes standard distances", () => {
    expect(levenshtein("kitten", "sitting")).toBe(3);
    expect(levenshtein("アーカンジェル青山", "アーカンジェル代官山")).toBeLessThanOrEqual(3);
  });
});

describe("matchExistingVenue", () => {
  const baseCandidate: VenueCandidate = {
    name: "アーカンジェル南青山",
    location: "東京都港区南青山",
    postalCode: "107-0062",
    latitude: 35.66182,
    longitude: 139.71755,
    normalizedName: normalizeName("アーカンジェル南青山"),
  };

  it("Tier A1: matches via normalizedName + postalCode", () => {
    const existing: ExistingVenueSummary[] = [
      {
        id: "v1",
        name: "アーカンジェル南青山",
        location: null,
        postalCode: "107-0062",
        latitude: null,
        longitude: null,
        normalizedName: normalizeName("アーカンジェル南青山"),
      },
    ];
    const r = matchExistingVenue(baseCandidate, existing);
    expect(r?.tier).toBe("exact_postal");
    expect(r?.venue.id).toBe("v1");
  });

  it("Tier A2: matches via normalizedName + geo within 500m", () => {
    const existing: ExistingVenueSummary[] = [
      {
        id: "v2",
        name: "アーカンジェル南青山",
        location: null,
        postalCode: null,
        latitude: 35.66185, // ~4m away
        longitude: 139.71756,
        normalizedName: normalizeName("アーカンジェル南青山"),
      },
    ];
    const r = matchExistingVenue(baseCandidate, existing);
    expect(r?.tier).toBe("exact_geo");
  });

  it("Tier B: matches via name + location substring when no geo/postal", () => {
    const candidate: VenueCandidate = {
      ...baseCandidate,
      postalCode: null,
      latitude: null,
      longitude: null,
    };
    const existing: ExistingVenueSummary[] = [
      {
        id: "v3",
        name: "アーカンジェル南青山",
        location: "港区南青山3-14",
        postalCode: null,
        latitude: null,
        longitude: null,
        normalizedName: normalizeName("アーカンジェル南青山"),
      },
    ];
    const r = matchExistingVenue(candidate, existing);
    expect(r?.tier).toBe("name_location");
  });

  it("Tier C: matches via geo <=100m + Levenshtein <=3 (typo variant)", () => {
    const candidate: VenueCandidate = {
      ...baseCandidate,
      normalizedName: normalizeName("アーカンジェル南表参道"), // slightly different
    };
    const existing: ExistingVenueSummary[] = [
      {
        id: "v4",
        name: "アーカンジェル南青山",
        location: null,
        postalCode: null,
        latitude: 35.66183, // within 100m
        longitude: 139.71756,
        normalizedName: normalizeName("アーカンジェル南青山"),
      },
    ];
    const r = matchExistingVenue(candidate, existing);
    expect(r?.tier).toBe("geo_near");
  });

  it("rejects completely different venue at distance", () => {
    const existing: ExistingVenueSummary[] = [
      {
        id: "v5",
        name: "八芳園",
        location: "東京都港区白金台",
        postalCode: "108-0071",
        latitude: 35.636,
        longitude: 139.735,
        normalizedName: normalizeName("八芳園"),
      },
    ];
    expect(matchExistingVenue(baseCandidate, existing)).toBeNull();
  });

  it("rejects same-name venue far away (e.g., 青山 vs 代官山)", () => {
    const candidate: VenueCandidate = {
      ...baseCandidate,
      normalizedName: normalizeName("アーカンジェル青山"),
      postalCode: null,
      latitude: 35.66,
      longitude: 139.72,
    };
    const existing: ExistingVenueSummary[] = [
      {
        id: "vfar",
        name: "アーカンジェル代官山",
        location: null,
        postalCode: null,
        latitude: 35.649, // ~1km south
        longitude: 139.703,
        normalizedName: normalizeName("アーカンジェル代官山"),
      },
    ];
    expect(matchExistingVenue(candidate, existing)).toBeNull();
  });

  it("returns null when existing list is empty", () => {
    expect(matchExistingVenue(baseCandidate, [])).toBeNull();
  });
});

describe("mergeVenueFields", () => {
  it("fills null scalars and leaves existing values untouched", () => {
    const existing = {
      location: "東京都港区南青山",
      postalCode: null,
      streetAddress: null,
      latitude: null,
      longitude: null,
      hasParking: null,
    };
    const incoming = {
      location: "違う場所",
      postalCode: "107-0062",
      streetAddress: "南青山3-14-23",
      latitude: 35.66,
      longitude: 139.72,
      hasParking: true,
    };
    const { data, updatedFields } = mergeVenueFields(existing, incoming);
    expect(data.location).toBeUndefined(); // existing kept
    expect(data.postalCode).toBe("107-0062");
    expect(data.latitude).toBe(35.66);
    expect(data.hasParking).toBe(true);
    expect(updatedFields).toEqual(
      expect.arrayContaining(["postalCode", "streetAddress", "latitude", "longitude", "hasParking"]),
    );
    expect(updatedFields).not.toContain("location");
  });

  it("unions arrays without duplicates", () => {
    const existing = {
      sourceUrls: ["https://zexy.net/a/"],
      photoUrls: ["https://s.co/a.jpg"],
      vibeTags: ["chapel"],
    };
    const incoming = {
      sourceUrls: ["https://zexy.net/a/", "https://www.mwed.jp/hall/10242/"],
      photoUrls: ["https://s.co/a.jpg", "https://s.co/b.jpg"],
      vibeTags: ["garden"],
    };
    const { data, updatedFields } = mergeVenueFields(existing, incoming);
    expect(data.sourceUrls).toHaveLength(2);
    expect(data.photoUrls).toHaveLength(2);
    expect(data.vibeTags).toEqual(expect.arrayContaining(["chapel", "garden"]));
    expect(updatedFields).toEqual(
      expect.arrayContaining(["sourceUrls", "photoUrls", "vibeTags"]),
    );
  });

  it("takes min of range-min and max of range-max", () => {
    const existing = { costMin: 3_500_000, costMax: 4_000_000 };
    const incoming = { costMin: 3_000_000, costMax: 3_800_000 };
    const { data } = mergeVenueFields(existing, incoming);
    expect(data.costMin).toBe(3_000_000);
    expect(data.costMax).toBeUndefined(); // 3.8M < 4M existing, no-op
  });

  it("computes weighted average aggregateRating when both sides have counts", () => {
    const existing = { externalRatingValue: 4.0, externalReviewCount: 100 };
    const incoming = { externalRatingValue: 5.0, externalReviewCount: 100 };
    const { data, updatedFields } = mergeVenueFields(existing, incoming);
    expect(data.externalRatingValue).toBeCloseTo(4.5, 2);
    expect(data.externalReviewCount).toBe(200);
    expect(updatedFields).toContain("externalRatingValue");
  });

  it("fills aggregateRating from nothing", () => {
    const existing = { externalRatingValue: null, externalReviewCount: null };
    const incoming = { externalRatingValue: 4.47, externalReviewCount: 1433 };
    const { data } = mergeVenueFields(existing, incoming);
    expect(data.externalRatingValue).toBe(4.47);
    expect(data.externalReviewCount).toBe(1433);
  });

  it("no-op merge returns empty updatedFields", () => {
    const existing = {
      location: "東京都",
      sourceUrls: ["https://a/"],
    };
    const incoming = {
      location: "東京都",
      sourceUrls: ["https://a/"],
    };
    const { data, updatedFields } = mergeVenueFields(existing, incoming);
    expect(data).toEqual({});
    expect(updatedFields).toEqual([]);
  });
});
