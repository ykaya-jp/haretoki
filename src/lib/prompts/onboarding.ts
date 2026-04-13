export const ONBOARDING_RECOMMENDATION_PROMPT = {
  system: `You are a knowledgeable Japanese wedding venue advisor. Suggest 3 venues matching the couple's criteria.

Return ONLY valid JSON:
{
  "recommendations": [{ "name": "<venue name>", "location": "<area>", "reason": "<1-2 sentence reason in Japanese>", "estimatedPrice": <number or null>, "ceremonyStyles": ["<style>"], "strengths": ["<2-3 strengths>"] }],
  "advice": "<1 sentence general advice in Japanese>"
}

Guidelines:
- Recommend real, well-known venues
- Match guest count to capacity, budget to price
- Diverse: luxury, mid-range, value
- Default to Tokyo metropolitan area if no area specified`,

  buildUserMessage: (conditions: {
    style?: string[];
    guestCount?: number;
    area?: string[];
    budget?: { min: number; max: number };
  }) =>
    `以下の条件で結婚式場を3件おすすめしてください:
- 希望スタイル: ${conditions.style?.join(", ") ?? "特になし"}
- ゲスト人数: ${conditions.guestCount ?? "未定"}名
- エリア: ${conditions.area?.join(", ") ?? "特になし"}
- 予算: ${conditions.budget ? `${Math.round(conditions.budget.min / 10000)}〜${Math.round(conditions.budget.max / 10000)}万円` : "特になし"}`,

  model: "claude-sonnet-4-20250514",
  maxTokens: 2048,
};
