import { describe, it, expect } from "vitest";
import {
  buildFocusedSearchString,
  indexOfFocusedVenue,
  parseFocusedVenueId,
} from "@/lib/compare-url-state";

describe("compare-url-state — parseFocusedVenueId", () => {
  it("returns null when no `focused` param is present", () => {
    const sp = new URLSearchParams("?venueIds=a,b,c");
    expect(parseFocusedVenueId(sp)).toBeNull();
  });

  it("returns the value when `focused` is set with a uuid-shaped id", () => {
    const sp = new URLSearchParams(
      "?venueIds=a,b&focused=11111111-1111-4111-8111-111111111111",
    );
    expect(parseFocusedVenueId(sp)).toBe(
      "11111111-1111-4111-8111-111111111111",
    );
  });

  it("rejects implausibly short ids (likely manual tinkering)", () => {
    const sp = new URLSearchParams("?focused=foo");
    expect(parseFocusedVenueId(sp)).toBeNull();
  });

  it("rejects implausibly long ids", () => {
    const sp = new URLSearchParams(`?focused=${"x".repeat(80)}`);
    expect(parseFocusedVenueId(sp)).toBeNull();
  });

  it("works with a minimal `{ get }` shape (Next ReadonlyURLSearchParams)", () => {
    const fake = {
      get(name: string) {
        return name === "focused" ? "abcdefgh-aaaa-4aaa-8aaa-aaaaaaaaaaaa" : null;
      },
    };
    expect(parseFocusedVenueId(fake)).toBe(
      "abcdefgh-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    );
  });
});

describe("compare-url-state — indexOfFocusedVenue", () => {
  const ids = ["v1", "v2", "v3"];

  it("returns -1 for null focusedId", () => {
    expect(indexOfFocusedVenue(null, ids)).toBe(-1);
  });

  it("returns the matching index", () => {
    expect(indexOfFocusedVenue("v2", ids)).toBe(1);
  });

  it("returns -1 when the id is no longer in the list", () => {
    expect(indexOfFocusedVenue("v999", ids)).toBe(-1);
  });
});

describe("compare-url-state — buildFocusedSearchString", () => {
  it("preserves other params when adding focused", () => {
    const sp = new URLSearchParams("venueIds=a,b,c");
    expect(buildFocusedSearchString(sp, "v2")).toBe("venueIds=a%2Cb%2Cc&focused=v2");
  });

  it("drops the focused param when given null", () => {
    const sp = new URLSearchParams("venueIds=a,b&focused=v2");
    expect(buildFocusedSearchString(sp, null)).toBe("venueIds=a%2Cb");
  });

  it("returns an empty string when there are no other params and focusedId is null", () => {
    const sp = new URLSearchParams();
    expect(buildFocusedSearchString(sp, null)).toBe("");
  });

  it("replaces an existing focused value", () => {
    const sp = new URLSearchParams("focused=v1");
    expect(buildFocusedSearchString(sp, "v2")).toBe("focused=v2");
  });
});
