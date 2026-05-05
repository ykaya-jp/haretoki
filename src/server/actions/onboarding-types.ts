// Pure types + constants for the onboarding/explore AI recommendation
// surface. Lives outside the "use server" file because Next.js requires
// server-action files to export only async functions.

// Minimum number of registered venues required before AI recommendations
// become useful — without comparative signal, suggestions are generic.
export const AI_REC_VENUE_THRESHOLD = 3;

export interface VenueRationale {
  area_match: boolean;
  budget_match: boolean;
  style_match: boolean;
  /** 2026-05-02 round 2 — one-line Japanese explaining why this venue
   *  earned its slot vs the other two recommendations (decision-driver,
   *  budget position, diversity intent). Optional for backwards
   *  compatibility with cache rows produced under prompt version 1. */
  note?: string;
}

export interface VenueRecommendation {
  name: string;
  location: string;
  reason: string;
  estimatedPrice: number | null;
  ceremonyStyles: string[];
  strengths: string[];
  rationale?: VenueRationale;
}

export interface ProjectConditionsSummary {
  styles?: string[];
  areas?: string[];
  guestCount?: number;
  budgetMax?: number;
}

export type ExploreAIRecommendationsResult =
  | {
      status: "insufficient_data";
      venueCount: number;
      threshold: number;
      conditions: ProjectConditionsSummary;
    }
  | {
      status: "unavailable";
      venueCount: number;
      conditions: ProjectConditionsSummary;
    }
  | {
      status: "ready";
      venueCount: number;
      conditions: ProjectConditionsSummary;
      recommendations: VenueRecommendation[];
      advice: string;
      /**
       * True when the recommendation prompt included a behavioral
       * preference summary derived from the couple's favorites + visits
       * (Layer B1 / preference-vector). Cold-start couples (signalCount<2)
       * get false here; the UI uses it to surface a "お二人の好みから"
       * eyebrow so they understand the AI is actually learning from them.
       */
      behavioralLearningApplied: boolean;
    }
  | {
      status: "error";
      venueCount: number;
      conditions: ProjectConditionsSummary;
    };
