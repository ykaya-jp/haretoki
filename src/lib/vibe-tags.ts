/** R-2 気分で探す: 式場の雰囲気タグ定義 */

export type VibeTag =
  | "natural_light"
  | "garden"
  | "glass"
  | "private_floor"
  | "historic"
  | "rooftop"
  | "chapel"
  | "riverside"
  | "modern"
  | "classical";

export const VIBE_TAGS: { id: VibeTag; label: string; emoji: string }[] = [
  { id: "natural_light", label: "自然光", emoji: "☀️" },
  { id: "garden", label: "ガーデン", emoji: "🌿" },
  { id: "glass", label: "ガラス張り", emoji: "✨" },
  { id: "private_floor", label: "ワンフロア貸切", emoji: "🔑" },
  { id: "historic", label: "歴史ある建物", emoji: "🏛️" },
  { id: "rooftop", label: "ルーフトップ", emoji: "🌆" },
  { id: "chapel", label: "チャペル", emoji: "⛪" },
  { id: "riverside", label: "水辺", emoji: "🌊" },
  { id: "modern", label: "モダン", emoji: "◼️" },
  { id: "classical", label: "クラシカル", emoji: "🎻" },
];
