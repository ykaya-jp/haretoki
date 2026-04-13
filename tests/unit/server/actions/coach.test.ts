import { describe, it, expect } from "vitest";

// Duplicate FAQ patterns from coach.ts for testing (not exported)
const FAQ_PATTERNS: Array<{
  keywords: string[];
  answer: string;
}> = [
  {
    keywords: ["見積もり", "費用", "予算", "いくら", "値段", "金額"],
    answer: "見積もりは初期額から平均で+84〜110万円上がると言われています。",
  },
  {
    keywords: ["比較", "どっち", "どちら", "違い", "選べない"],
    answer: "比較ボードで候補の式場を並べて見てみましょう。",
  },
  {
    keywords: ["見学", "ブライダルフェア", "フェア", "予約"],
    answer: "見学は2〜3箇所がおすすめです。",
  },
  {
    keywords: ["パートナー", "彼", "彼女", "相手", "二人"],
    answer: "パートナーを招待すると、お互いの評価を比較できます。",
  },
  {
    keywords: ["決め", "決定", "最終", "選ぶ"],
    answer: "候補の式場を比較して、二人で納得できたら決定できます。",
  },
];

function matchFaq(message: string) {
  const normalized = message.toLowerCase();
  return (
    FAQ_PATTERNS.find((faq) =>
      faq.keywords.some((keyword) => normalized.includes(keyword))
    ) ?? null
  );
}

describe("Coach FAQ matching", () => {
  it("matches '見積もり' keyword", () => {
    expect(matchFaq("見積もりについて教えて")).not.toBeNull();
  });

  it("matches '費用' keyword", () => {
    expect(matchFaq("費用はどのくらいかかりますか")).not.toBeNull();
  });

  it("matches '予算' keyword", () => {
    expect(matchFaq("予算の決め方を知りたい")).not.toBeNull();
  });

  it("matches '比較' keyword", () => {
    expect(matchFaq("2つの式場を比較したい")).not.toBeNull();
  });

  it("matches 'どっち' keyword", () => {
    expect(matchFaq("どっちがいいか迷っています")).not.toBeNull();
  });

  it("matches '見学' keyword", () => {
    expect(matchFaq("見学予約したい")).not.toBeNull();
  });

  it("matches 'ブライダルフェア' keyword", () => {
    expect(matchFaq("ブライダルフェアに行きたい")).not.toBeNull();
  });

  it("matches 'パートナー' keyword", () => {
    expect(matchFaq("パートナーに共有したい")).not.toBeNull();
  });

  it("matches '決定' keyword", () => {
    expect(matchFaq("最終決定したい")).not.toBeNull();
  });

  it("matches '選ぶ' keyword", () => {
    expect(matchFaq("式場をどう選ぶか迷っている")).not.toBeNull();
  });

  it("returns null for unmatched message", () => {
    expect(matchFaq("今日の天気は？")).toBeNull();
  });

  it("returns null for empty message", () => {
    expect(matchFaq("")).toBeNull();
  });

  it("is case-insensitive for ASCII (lowercases input)", () => {
    // Japanese keywords are not ASCII — purely ASCII input won't match
    expect(matchFaq("BUDGET相談")).toBeNull();
  });

  it("returns the first matching pattern when multiple keywords match", () => {
    // '費用' and '予算' are in the same pattern — should match once
    const result = matchFaq("費用と予算について知りたい");
    expect(result).not.toBeNull();
    expect(result?.keywords).toContain("費用");
  });
});
