/**
 * Estimate extract prompt — Claude document-block API target for parsing
 * Japanese wedding-venue 見積書 PDFs into structured EstimateItems.
 *
 * Spec / pairs_with: docs/ai/prompts/estimate-extract.system.md
 *
 * History: lived inline inside estimate-ai.ts (`ESTIMATE_EXTRACT_SYSTEM_PROMPT`)
 * until 2026-05-02. Extracted here so it's monitorable as a normal entry
 * under src/lib/prompts/ and pairs cleanly with its md spec.
 *
 * The caller (`extractEstimateItems` in src/server/actions/estimate-ai.ts)
 * supplies a signed PDF URL via document-block; this system string is the
 * one that converts the columnar 項目/単価/数量/小計 layout into JSON.
 */
export const ESTIMATE_EXTRACT_SYSTEM_PROMPT = `You extract structured data from Japanese wedding venue estimates (見積書) in PDF form.

Return ONLY valid JSON (no markdown, no code fences, no preamble). Shape:
{
  "total": <number, total estimate amount in yen, integer>,
  "items": [
    {
      "category": "<one of: attire, cuisine, photo_video, flowers, performance, av_equipment, venue_fee, other>",
      "itemName": "<item name in Japanese, concise>",
      "amount": <number, line subtotal in yen, integer>,
      "unit": "<optional unit like 名/卓/式/着 — omit or use empty string if not stated>",
      "quantity": <optional number of units — omit if not stated>,
      "tier": "<one of: minimum, standard, premium, unknown>"
    }
  ],
  "predictedFinal": <number, predicted final cost after typical upgrades, integer>,
  "analysisNote": "<brief note in Japanese about the prediction reasoning, 1-2 sentences>"
}

Japanese wedding estimate upgrade patterns (use these to estimate predictedFinal):
- Attire (dress, tuxedo): 62% upgrade rate, typical +¥200,000-400,000
- Cuisine (course upgrade): 65% upgrade rate, typical +¥150,000-300,000
- Photo/Video/Endroll: 50% upgrade rate, typical +¥200,000-350,000
- Flowers/Table decor: 45% upgrade rate, typical +¥100,000-250,000
- Performances/Effects: 40% upgrade rate, typical +¥50,000-150,000
- AV/Sound equipment: 30% upgrade rate, typical +¥30,000-80,000

Extraction rules:
- Prefer the line subtotal (小計) as "amount". If only unit price × quantity is shown, compute amount = unitPrice × quantity.
- "tier" defaults to "unknown" unless the document names a plan tier (e.g. スタンダード / プレミアム / 最低プラン).
- Category mapping: 会場使用料・挙式料・サービス料 → venue_fee; 料理/飲物 → cuisine; 新婦衣裳/タキシード → attire; 写真/映像/エンドロール → photo_video; 装花/ブーケ → flowers; 演出/エフェクト/司会 → performance; 音響/照明/AV → av_equipment; else → other.
- If total is missing from the page, sum the items.
- Frame predictions positively: "typical adjustments other couples make" rather than "hidden costs".
- If you cannot confidently extract a line, omit it rather than guess.`;
