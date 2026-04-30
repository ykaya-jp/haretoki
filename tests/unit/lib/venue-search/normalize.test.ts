import { describe, it, expect } from "vitest";
import { normalizeHits, normalizeHitName } from "@/lib/venue-search/normalize";
import { MAX_SUGGESTIONS, type VenueSearchHit } from "@/lib/venue-search/types";

function hit(
  partial: Partial<VenueSearchHit> & Pick<VenueSearchHit, "name" | "source">,
): VenueSearchHit {
  return {
    id: partial.id ?? `${partial.source}:${partial.name}`,
    name: partial.name,
    location: partial.location ?? null,
    source: partial.source,
    sourceUrl: partial.sourceUrl ?? null,
    placeId: partial.placeId ?? null,
    existingVenueId: partial.existingVenueId ?? null,
    confidence: partial.confidence ?? "medium",
  };
}

describe("normalizeHitName", () => {
  it("lowercases and strips whitespace", () => {
    expect(normalizeHitName(" Venue  Name ")).toBe("venuename");
  });
  it("strips ASCII punctuation", () => {
    expect(normalizeHitName("A-B.C,D")).toBe("abcd");
  });
  it("strips Japanese punctuation / symbols", () => {
    // 中黒・括弧・ハートは dedupe 用途では無視したい
    expect(normalizeHitName("アニヴェルセル・表参道")).toBe(
      "アニヴェルセル表参道",
    );
  });
});

describe("normalizeHits", () => {
  it("dedupes collisions across tiers using name + location prefix", () => {
    const out = normalizeHits([
      [],
      [
        hit({ name: "アニヴェルセル表参道", source: "places", location: "東京都港区" }),
      ],
      [
        hit({
          name: "アニヴェルセル 表参道",
          source: "claude",
          location: "東京都",
        }),
      ],
    ]);
    // Both entries collapse into one since location prefix "東京都" matches.
    expect(out).toHaveLength(1);
    expect(out[0].source).toBe("places");
  });

  it("keeps hits with the same name but different location prefixes", () => {
    const out = normalizeHits([
      [],
      [
        hit({ name: "ぐらんぷりんせす", source: "places", location: "神奈川県葉山" }),
        hit({ name: "ぐらんぷりんせす", source: "places", location: "京都府左京区" }),
      ],
      [],
    ]);
    expect(out).toHaveLength(2);
  });

  it("caps output at MAX_SUGGESTIONS", () => {
    const many: VenueSearchHit[] = [];
    for (let i = 0; i < MAX_SUGGESTIONS + 5; i++) {
      many.push(hit({ name: `Venue ${i}`, source: "places" }));
    }
    const out = normalizeHits([[], many, []]);
    expect(out).toHaveLength(MAX_SUGGESTIONS);
  });

  it("orders internal hits before places before claude within same confidence", () => {
    const out = normalizeHits([
      [hit({ name: "Internal Venue", source: "internal", confidence: "medium" })],
      [hit({ name: "Places Venue", source: "places", confidence: "medium" })],
      [hit({ name: "Claude Venue", source: "claude", confidence: "medium" })],
    ]);
    expect(out.map((h) => h.source)).toEqual(["internal", "places", "claude"]);
  });

  it("breaks source ties by confidence (high before medium before low)", () => {
    const out = normalizeHits([
      [],
      [
        hit({ name: "Medium", source: "places", confidence: "medium" }),
        hit({ name: "High", source: "places", confidence: "high" }),
        hit({ name: "Low", source: "places", confidence: "low" }),
      ],
      [],
    ]);
    expect(out.map((h) => h.name)).toEqual(["High", "Medium", "Low"]);
  });
});
