import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  buildSupabaseHealthUrl,
  classifyLatency,
  HEALTH_DEGRADED_THRESHOLD_MS,
  HEALTH_OK_THRESHOLD_MS,
  HEALTH_PROBE_TIMEOUT_MS,
  probeAnthropicEnv,
  probeResendEnv,
  probeSupabaseEnv,
  probeVercelEnv,
} from "@/lib/health-check";

/**
 * Pure-helper specs for the Supabase auto-pause prevention surface
 * (2026-05-03 incident retrospective). The thresholds drive the
 * Sentry alert routing, so a regression here ships a misclassified
 * outage — pin the boundary cases tightly.
 */

describe("classifyLatency — boundary thresholds", () => {
  it("returns 'failed' for null / NaN / negative latency (network failure path)", () => {
    expect(classifyLatency(null)).toBe("failed");
    expect(classifyLatency(NaN)).toBe("failed");
    expect(classifyLatency(-1)).toBe("failed");
    expect(classifyLatency(Infinity)).toBe("failed");
  });

  it("returns 'ok' for latency at or below HEALTH_OK_THRESHOLD_MS", () => {
    expect(classifyLatency(0)).toBe("ok");
    expect(classifyLatency(799)).toBe("ok");
    expect(classifyLatency(HEALTH_OK_THRESHOLD_MS)).toBe("ok"); // 800 inclusive
  });

  it("returns 'degraded' for latency just over the ok threshold", () => {
    expect(classifyLatency(HEALTH_OK_THRESHOLD_MS + 1)).toBe("degraded"); // 801
    expect(classifyLatency(2999)).toBe("degraded");
    expect(classifyLatency(HEALTH_DEGRADED_THRESHOLD_MS)).toBe("degraded"); // 3000 inclusive
  });

  it("returns 'failed' for latency over HEALTH_DEGRADED_THRESHOLD_MS", () => {
    expect(classifyLatency(HEALTH_DEGRADED_THRESHOLD_MS + 1)).toBe("failed"); // 3001
    expect(classifyLatency(5000)).toBe("failed");
    expect(classifyLatency(60_000)).toBe("failed");
  });

  it("threshold values match the documented constants (alert routing depends on these)", () => {
    expect(HEALTH_OK_THRESHOLD_MS).toBe(800);
    expect(HEALTH_DEGRADED_THRESHOLD_MS).toBe(3000);
    expect(HEALTH_PROBE_TIMEOUT_MS).toBe(5000);
  });
});

describe("buildSupabaseHealthUrl", () => {
  it("appends /auth/v1/health to a bare project URL", () => {
    expect(buildSupabaseHealthUrl("https://abc.supabase.co")).toBe(
      "https://abc.supabase.co/auth/v1/health",
    );
  });

  it("strips trailing slash before appending", () => {
    expect(buildSupabaseHealthUrl("https://abc.supabase.co/")).toBe(
      "https://abc.supabase.co/auth/v1/health",
    );
  });

  it("strips multiple trailing slashes (defence in depth)", () => {
    expect(buildSupabaseHealthUrl("https://abc.supabase.co///")).toBe(
      "https://abc.supabase.co/auth/v1/health",
    );
  });
});

describe("probeSupabaseEnv", () => {
  const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const originalKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  afterEach(() => {
    if (originalUrl === undefined)
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
    if (originalKey === undefined)
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    else process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalKey;
  });

  it("present=false when URL is missing", () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
    const result = probeSupabaseEnv();
    expect(result.present).toBe(false);
    expect(result.missingHint).toContain("NEXT_PUBLIC_SUPABASE_URL");
  });

  it("present=false when anon key is missing", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abc.supabase.co";
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const result = probeSupabaseEnv();
    expect(result.present).toBe(false);
    expect(result.missingHint).toContain("ANON_KEY");
  });

  it("present=true when both env vars are set", () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://abc.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
    const result = probeSupabaseEnv();
    expect(result).toEqual({
      label: "Supabase",
      present: true,
      missingHint: null,
    });
  });
});

describe("probeAnthropicEnv", () => {
  const originalKey = process.env.ANTHROPIC_API_KEY;
  const originalDisabled = process.env.DISABLE_AI;

  afterEach(() => {
    if (originalKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = originalKey;
    if (originalDisabled === undefined) delete process.env.DISABLE_AI;
    else process.env.DISABLE_AI = originalDisabled;
  });

  it("present=false when API key is missing and DISABLE_AI is unset", () => {
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.DISABLE_AI;
    const result = probeAnthropicEnv();
    expect(result.present).toBe(false);
    expect(result.missingHint).toContain("ANTHROPIC_API_KEY");
  });

  it("present=true when ANTHROPIC_API_KEY is set", () => {
    process.env.ANTHROPIC_API_KEY = "sk-ant-test";
    delete process.env.DISABLE_AI;
    const result = probeAnthropicEnv();
    expect(result.present).toBe(true);
    expect(result.missingHint).toBeNull();
  });

  it("DISABLE_AI=1 reports present=true with intentional-disable hint (no alarm)", () => {
    delete process.env.ANTHROPIC_API_KEY;
    process.env.DISABLE_AI = "1";
    const result = probeAnthropicEnv();
    // CRITICAL: a deliberate operational choice (e.g. budget exhaustion
    // mid-month) MUST NOT show as "missing" — that would teach the
    // operator to ignore real misconfigs.
    expect(result.present).toBe(true);
    expect(result.missingHint).toContain("intentionally");
  });
});

describe("probeResendEnv", () => {
  const originalKey = process.env.RESEND_API_KEY;
  const originalSecret = process.env.RESEND_WEBHOOK_SECRET;

  afterEach(() => {
    if (originalKey === undefined) delete process.env.RESEND_API_KEY;
    else process.env.RESEND_API_KEY = originalKey;
    if (originalSecret === undefined) delete process.env.RESEND_WEBHOOK_SECRET;
    else process.env.RESEND_WEBHOOK_SECRET = originalSecret;
  });

  it("present=false when API key missing (the floor)", () => {
    delete process.env.RESEND_API_KEY;
    const result = probeResendEnv();
    expect(result.present).toBe(false);
    expect(result.missingHint).toContain("RESEND_API_KEY");
  });

  it("present=true when API key set + webhook secret set", () => {
    process.env.RESEND_API_KEY = "re_test";
    process.env.RESEND_WEBHOOK_SECRET = "whsec_test";
    const result = probeResendEnv();
    expect(result).toEqual({
      label: "Resend",
      present: true,
      missingHint: null,
    });
  });

  it("present=true with degraded hint when webhook secret missing (delivery tracking off)", () => {
    process.env.RESEND_API_KEY = "re_test";
    delete process.env.RESEND_WEBHOOK_SECRET;
    const result = probeResendEnv();
    expect(result.present).toBe(true);
    expect(result.missingHint).toContain("WEBHOOK_SECRET");
  });
});

describe("probeVercelEnv", () => {
  const originalSha = process.env.VERCEL_GIT_COMMIT_SHA;

  beforeEach(() => {
    delete process.env.VERCEL_GIT_COMMIT_SHA;
  });

  afterEach(() => {
    if (originalSha === undefined) delete process.env.VERCEL_GIT_COMMIT_SHA;
    else process.env.VERCEL_GIT_COMMIT_SHA = originalSha;
  });

  it("reports present=true even outside Vercel (local dev is normal, NOT an error)", () => {
    delete process.env.VERCEL_GIT_COMMIT_SHA;
    const result = probeVercelEnv();
    expect(result.present).toBe(true);
    // Hint surfaces "running outside Vercel" for the operator to know
    // why the Vercel-injected vars aren't there.
    expect(result.missingHint).toContain("outside Vercel");
  });

  it("clears the hint when SHA is present (= deployed on Vercel)", () => {
    process.env.VERCEL_GIT_COMMIT_SHA = "abc1234";
    const result = probeVercelEnv();
    expect(result.present).toBe(true);
    expect(result.missingHint).toBeNull();
  });
});
