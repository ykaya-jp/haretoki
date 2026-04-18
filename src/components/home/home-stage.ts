import type { Weather } from "@/lib/prompts/ritual";

export interface HomeStageInput {
  totalVenues: number;
  visitedVenues: number;
  favoriteCount: number;
  hasDecision: boolean;
  firstVenueId?: string | null;
}

export interface HomeStageContent {
  key: "start" | "adding" | "visiting" | "comparing" | "decided";
  headline: string;
  sub: string;
  ctaLabel: string;
  ctaHref: string;
  /** Default weather when ritual data is unavailable. */
  fallbackWeather: Weather;
}

/**
 * Derive the single next-best-action for the Home Cover from progress
 * signals. Mirrors the §5.4 copy table (formerly hero-nba.tsx).
 * The ritual's ctaHref/Label — when present — should override the
 * ctaLabel/ctaHref returned here.
 */
export function getHomeStage(p: HomeStageInput): HomeStageContent {
  if (p.hasDecision) {
    return {
      key: "decided",
      headline: "ここから、当日の準備へ",
      sub: "あとは準備を、ゆっくりと",
      ctaLabel: "準備を始める",
      ctaHref: "/candidates?tab=decision",
      fallbackWeather: "sunny",
    };
  }
  if (p.favoriteCount >= 2) {
    return {
      key: "comparing",
      headline: "ふたりで並べて、見比べてみましょう",
      sub: `本命 ${p.favoriteCount} 件。比べるほど、輪郭が見えてきます`,
      ctaLabel: "情景で決める",
      ctaHref: "/candidates?tab=duel",
      fallbackWeather: "clear",
    };
  }
  if (p.visitedVenues >= 1) {
    const singleVenue = p.totalVenues === 1 && p.firstVenueId;
    return {
      key: "visiting",
      headline: "印象を、忘れないうちに。",
      sub: "気になったこと、写真と一緒に残しておきましょう",
      ctaLabel: "印象を残す",
      ctaHref: singleVenue ? `/venues/${p.firstVenueId}` : "/candidates",
      fallbackWeather: "break",
    };
  }
  if (p.totalVenues >= 1) {
    const singleVenue = p.totalVenues === 1 && p.firstVenueId;
    return {
      key: "adding",
      headline: "少しずつ、見えてきました。",
      sub: singleVenue
        ? "最初の見学予定を入れてみませんか。日付とメモを残せます"
        : "見学する式場を選んで、予定を入れましょう",
      ctaLabel: singleVenue ? "見学予定を入れる" : "式場を選ぶ",
      ctaHref: singleVenue ? `/venues/${p.firstVenueId}#visit` : "/candidates",
      fallbackWeather: "break",
    };
  }
  return {
    key: "start",
    headline: "まだ見ぬ、あの一日へ。",
    sub: "URL を貼るだけ。あとは晴れ時がそっと集めます",
    ctaLabel: "URL から追加",
    ctaHref: "/explore",
    fallbackWeather: "cloudy",
  };
}
