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
    }
  | {
      status: "error";
      venueCount: number;
      conditions: ProjectConditionsSummary;
    };
