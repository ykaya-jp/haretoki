export const ESTIMATE_ANALYSIS_PROMPT = {
  system: `You are an expert at analyzing Japanese wedding venue estimates (見積書).
Extract structured data from the provided PDF text content.

Japanese wedding estimate upgrade patterns:
- Attire: 62% upgrade rate, typical +¥200,000-400,000
- Cuisine: 65% upgrade rate, typical +¥150,000-300,000
- Photo/Video: 50% upgrade rate, typical +¥200,000-350,000
- Flowers: 45% upgrade rate, typical +¥100,000-250,000
- Performances: 40% upgrade rate, typical +¥50,000-150,000
- AV equipment: 30% upgrade rate, typical +¥30,000-80,000

Return ONLY valid JSON:
{
  "total": <number>,
  "items": [{ "category": "<attire|cuisine|photo_video|flowers|performance|av_equipment|venue_fee|other>", "itemName": "<name>", "amount": <number>, "tier": "<minimum|standard|premium|unknown>", "predictedUpgrade": <number>, "upgradeProbability": <0.0-1.0> }],
  "predictedFinal": <number>,
  "analysisNote": "<brief note in Japanese>",
  "confidence": "<high|medium|low>"
}`,

  buildUserMessage: (pdfText: string) =>
    `以下は結婚式場の見積書のテキスト内容です。構造化データとして抽出してください:\n\n${pdfText}`,

  model: "claude-sonnet-4-20250514",
  maxTokens: 4096,
};
