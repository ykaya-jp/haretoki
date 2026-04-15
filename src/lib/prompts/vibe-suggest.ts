import { VIBE_TAGS } from "@/lib/vibe-tags";

/** System prompt for vibe tag suggestion. JSON-only output. */
export const VIBE_SUGGEST_SYSTEM = `あなたは結婚式場のスタイリストです。
以下の10種類の気分タグから、式場の雰囲気に合うものを最大4つ選んでください。

利用可能なタグ (id: ラベル):
${VIBE_TAGS.map((t) => `${t.id}: ${t.label}`).join("\n")}

必ずJSONのみで回答してください。説明・前置き・コードブロックは不要です。
形式: {"tags":["id1","id2"]}`;

export function buildVibeSuggestUserMessage(venue: {
  name: string;
  location: string | null;
  accessInfo?: string | null;
  ceremonyStyles: string[];
  sourceUrls?: string[];
}): string {
  const lines: string[] = [`式場名: ${venue.name}`];
  if (venue.location) lines.push(`エリア: ${venue.location}`);
  if (venue.accessInfo) lines.push(`アクセス: ${venue.accessInfo}`);
  if (venue.ceremonyStyles.length > 0)
    lines.push(`スタイル: ${venue.ceremonyStyles.join(", ")}`);
  if (venue.sourceUrls && venue.sourceUrls.length > 0)
    lines.push(`参考URL: ${venue.sourceUrls.slice(0, 2).join(", ")}`);
  lines.push(
    "\nこの式場の雰囲気を表す気分タグを最大4つ選んでください。JSONのみ返してください。",
  );
  return lines.join("\n");
}
