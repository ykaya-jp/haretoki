import type { Weather } from "@/lib/prompts/ritual";

export interface HomeStageInput {
  totalVenues: number;
  visitedVenues: number;
  favoriteCount: number;
  hasDecision: boolean;
  firstVenueId?: string | null;
  /** Top 2 favorited venue ids — drives the "2-件迷っている" duel CTA.
   *  Both optional; when either is missing we fall back to the generic
   *  /candidates route instead of routing to a broken URL. */
  favoriteAId?: string | null;
  favoriteBId?: string | null;
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
  // Lexicon §5.4 — favorite == 2 is the unique duel case ("迷っている"
  // moment), favorite >= 3 shifts to side-by-side compare.
  if (p.favoriteCount === 2) {
    // Duel UI lives at /candidates/duel?a=…&b=…. Without both ids the
    // route returns notFound, so we require the pair before emitting
    // the duel CTA — otherwise fall through to the generic compare
    // destination.
    const duelHref =
      p.favoriteAId && p.favoriteBId
        ? `/candidates/duel?a=${p.favoriteAId}&b=${p.favoriteBId}`
        : "/candidates?view=compare";
    return {
      key: "comparing",
      headline: "2 件で迷ったら、情景で決める",
      sub: "ふたりの心がどちらに寄っているか、静かに知る時間を",
      ctaLabel: "情景で決める",
      ctaHref: duelHref,
      fallbackWeather: "clear",
    };
  }
  if (p.favoriteCount >= 3) {
    return {
      key: "comparing",
      headline: "ふたりで並べて、見比べてみましょう",
      sub: `候補 ${p.favoriteCount} 件。比べるほど、輪郭が見えてきます`,
      ctaLabel: "比べる",
      // Keep the compare experience consolidated inside /candidates so
      // the user stays in the same tab surface; the standalone /compare
      // route is kept for deep-link backwards compatibility.
      ctaHref: "/candidates?view=compare",
      fallbackWeather: "clear",
    };
  }
  if (p.visitedVenues >= 1) {
    const singleVenue = p.totalVenues === 1 && p.firstVenueId;
    return {
      key: "visiting",
      headline: "見学の印象を、忘れないうちに残しましょう",
      sub: "気になったこと、写真と一緒に",
      ctaLabel: "印象を残す",
      ctaHref: singleVenue ? `/venues/${p.firstVenueId}` : "/candidates",
      fallbackWeather: "break",
    };
  }
  if (p.totalVenues >= 1) {
    const singleVenue = p.totalVenues === 1 && p.firstVenueId;
    return {
      key: "adding",
      headline: "最初の見学を入れてみませんか",
      sub: singleVenue
        ? "当日のメモも残せます"
        : "見学する式場を選んで、予定を入れましょう",
      ctaLabel: "見学を入れる",
      ctaHref: singleVenue ? `/venues/${p.firstVenueId}#visit` : "/candidates",
      fallbackWeather: "break",
    };
  }
  return {
    key: "start",
    headline: "まず 1 件、気になる式場を",
    sub: "URL を貼るだけで始まります",
    ctaLabel: "URL から追加",
    ctaHref: "/explore?addVenue=1",
    fallbackWeather: "cloudy",
  };
}
