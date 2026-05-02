import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Track B-1: pure-helper coverage for the push subscription client lib.
 *
 * The module transitively imports `@/server/actions/push-subscription`,
 * which itself pulls in prisma + Sentry — so we mock that boundary
 * explicitly to keep this test runtime DB-free. The mock isn't asserted
 * against (we're testing the conversion, not the persistence path), so a
 * minimal stub is enough.
 */

vi.mock("@/server/actions/push-subscription", () => ({
  saveSubscription: vi.fn(async () => ({ ok: true, id: "stub" })),
  removeSubscription: vi.fn(async () => ({ ok: true, removed: 0 })),
  listMySubscriptions: vi.fn(async () => []),
}));

import {
  vapidKeyFromBase64Url,
  isPushSupported,
} from "@/lib/push/subscription";

describe("push/vapidKeyFromBase64Url", () => {
  it("converts a standard base64url string to the right byte sequence", () => {
    // base64url("hello") = "aGVsbG8" — note the missing padding which the
    // helper has to add back to feed atob().
    const out = vapidKeyFromBase64Url("aGVsbG8");
    expect(Array.from(out)).toEqual([
      "h".charCodeAt(0),
      "e".charCodeAt(0),
      "l".charCodeAt(0),
      "l".charCodeAt(0),
      "o".charCodeAt(0),
    ]);
  });

  it("decodes the base64url-only chars '-' and '_' as standard '+' and '/'", () => {
    // bytes [0xfb, 0xff, 0xbf] base64-encode to "-/+/" with the standard
    // alphabet; the base64url alphabet renames + → -, / → _. The helper
    // must reverse that mapping before atob() rejects the input.
    const standardBase64 = "+/+/";
    const base64UrlVariant = standardBase64.replace(/\+/g, "-").replace(/\//g, "_");
    const out = vapidKeyFromBase64Url(base64UrlVariant);
    // atob("+/+/") = "\xFB\xFF\xBF" — 3 bytes of 0xfb, 0xff, 0xbf.
    expect(Array.from(out)).toEqual([0xfb, 0xff, 0xbf]);
  });

  it("returns a Uint8Array (NOT a regular array) — applicationServerKey requires it", () => {
    const out = vapidKeyFromBase64Url("aGVsbG8");
    expect(out).toBeInstanceOf(Uint8Array);
  });

  it("handles VAPID-shaped 65-byte uncompressed P-256 keys", () => {
    // Real VAPID keys are 65 bytes (1 byte tag 0x04 + 32 byte X + 32 byte Y),
    // base64url-encoded to roughly 87 chars (no padding). Verify length round-trips.
    const buf = new Uint8Array(65);
    buf[0] = 0x04;
    for (let i = 1; i < 65; i++) buf[i] = i;
    let s = "";
    for (const b of buf) s += String.fromCharCode(b);
    const base64Url = btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

    const decoded = vapidKeyFromBase64Url(base64Url);
    expect(decoded.length).toBe(65);
    expect(decoded[0]).toBe(0x04);
    expect(decoded[64]).toBe(64);
  });
});

describe("push/isPushSupported", () => {
  // jsdom doesn't ship serviceWorker / PushManager out of the box, so the
  // capability probe should answer "false". The test pins this behaviour
  // so a future jsdom upgrade that adds partial shims doesn't silently
  // change what the suppression code in PermissionSheet sees.
  beforeEach(() => {
    // Reset window properties potentially polluted by other suites.
  });

  it("returns false when window has no PushManager (jsdom default)", () => {
    expect(isPushSupported()).toBe(false);
  });
});
