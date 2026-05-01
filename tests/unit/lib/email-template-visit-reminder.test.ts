import { describe, it, expect } from "vitest";
import { renderVisitReminderEmail } from "@/lib/email/templates/visit-reminder";

describe("visit reminder email template", () => {
  // 2026-05-16 (Saturday) 14:00 JST  =  2026-05-16 05:00 UTC
  const sample = {
    venueName: "晴れ時会館",
    scheduledAt: new Date(Date.UTC(2026, 4, 16, 5, 0, 0)),
    accessInfo: "JR渋谷駅 徒歩5分",
    memo: "ドレス試着の予約あり",
    venueUrl: "https://haretoki.vercel.app/venues/v-123",
  } as const;

  describe("day_before", () => {
    it("subject mentions tomorrow phrasing", () => {
      const { subject } = renderVisitReminderEmail({
        ...sample,
        phase: "day_before",
      });
      expect(subject).toContain("明日");
      expect(subject).toContain("晴れ時会館");
      expect(subject).toContain("Haretoki");
    });

    it("text body lists time, lead, access, memo, CTA URL", () => {
      const { text } = renderVisitReminderEmail({
        ...sample,
        phase: "day_before",
      });
      expect(text).toContain("晴れ時会館");
      expect(text).toContain("5/16");
      expect(text).toContain("14:00");
      expect(text).toContain("JR渋谷駅 徒歩5分");
      expect(text).toContain("ドレス試着の予約あり");
      expect(text).toContain("https://haretoki.vercel.app/venues/v-123");
    });
  });

  describe("morning_of", () => {
    it("subject mentions today phrasing", () => {
      const { subject } = renderVisitReminderEmail({
        ...sample,
        phase: "morning_of",
      });
      expect(subject).toContain("今日");
      expect(subject).toContain("晴れ時会館");
    });
  });

  describe("before_departure", () => {
    it("subject mentions departure phrasing", () => {
      const { subject } = renderVisitReminderEmail({
        ...sample,
        phase: "before_departure",
      });
      expect(subject).toContain("そろそろ出発");
      expect(subject).toContain("晴れ時会館");
    });
  });

  describe("formatting", () => {
    it("renders JST weekday for the scheduled date", () => {
      // 2026-05-16 = Saturday (土)
      const { html, text } = renderVisitReminderEmail({
        ...sample,
        phase: "day_before",
      });
      expect(text).toContain("土");
      expect(html).toContain("土");
    });

    it("HTML escapes risky characters in venue name", () => {
      const { html } = renderVisitReminderEmail({
        ...sample,
        phase: "day_before",
        venueName: "<script>alert(1)</script>",
      });
      expect(html).not.toContain("<script>alert(1)</script>");
      expect(html).toContain("&lt;script&gt;");
    });

    it("HTML CTA points to venueUrl", () => {
      const { html } = renderVisitReminderEmail({
        ...sample,
        phase: "morning_of",
      });
      expect(html).toContain('href="https://haretoki.vercel.app/venues/v-123"');
    });

    it("omits access block when accessInfo is null", () => {
      const { html } = renderVisitReminderEmail({
        ...sample,
        phase: "day_before",
        accessInfo: null,
      });
      expect(html).not.toContain("行き方");
    });

    it("omits memo block when memo is null", () => {
      const { html } = renderVisitReminderEmail({
        ...sample,
        phase: "day_before",
        memo: null,
      });
      expect(html).not.toContain("メモ");
    });
  });
});
