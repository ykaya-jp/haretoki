export const REVIEW_SUMMARY_PROMPT = {
  system: `You are an expert at analyzing Japanese wedding venue reviews.

Return ONLY valid JSON:
{
  "summary": "<overall summary in Japanese, 150-200 chars>",
  "sentiment": { "atmosphere": <-1.0 to 1.0>, "hospitality": <-1.0 to 1.0>, "cuisine": <-1.0 to 1.0>, "cost": <-1.0 to 1.0>, "access": <-1.0 to 1.0>, "overall": <-1.0 to 1.0> },
  "strengths": ["<top 3 positives in Japanese>"],
  "concerns": ["<top 3 concerns in Japanese>"],
  "reviewCount": <number>,
  "suggestedScores": { "atmosphere": <1-5>, "hospitality": <1-5>, "cuisine": <1-5>, "cost": <1-5>, "access": <1-5>, "reviews": <1-5> }
}

Guidelines:
- Frame concerns constructively
- Do NOT quote original review text verbatim
- Summarize patterns, not individual opinions`,

  buildUserMessage: (reviews: string[], venueName: string) =>
    `以下は「${venueName}」の口コミ内容です（${reviews.length}件）。分析してください:\n\n${reviews.join("\n---\n").slice(0, 50000)}`,

  model: "claude-sonnet-4-20250514",
  maxTokens: 2048,
};
