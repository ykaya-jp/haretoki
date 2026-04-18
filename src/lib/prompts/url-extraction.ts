import { MODEL } from "@/lib/models";

export const URL_EXTRACTION_PROMPT = {
  system: `You are an expert at extracting structured wedding venue information from Japanese web page content.

Return ONLY valid JSON:
{
  "name": "<venue name>",
  "location": "<area/address>",
  "accessInfo": "<station and walking time>",
  "capacityMin": <number or null>,
  "capacityMax": <number or null>,
  "ceremonyStyles": ["<style>"],
  "estimatedPrice": <number or null>,
  "features": ["<feature>"],
  "photoUrls": ["<url>"],
  "confidence": "<high|medium|low>"
}

Guidelines:
- If a field cannot be determined, use null
- For price, look for "見積もり例", "お見積り", "挙式+披露宴"
- For capacity, look for "着席" followed by number
- photoUrls: prefer large photos, max 5, skip thumbnails`,

  buildUserMessage: (pageContent: string, url: string) =>
    `以下はURL ${url} から取得したウェブページの内容です。結婚式場の情報を構造化データとして抽出してください:\n\n${pageContent.slice(0, 30000)}`,

  model: MODEL.SONNET,
  maxTokens: 2048,
};
