/**
 * Comparison field registry — the single source of truth for what rows appear
 * on the /compare board, in what order, and how each cell renders.
 *
 * Why a registry (vs hand-written JSX per row):
 * - Adding a Deep Extraction column (e.g. "駐車場台数") becomes one entry
 *   here, not a JSX copy-paste across grid / mobile-snap / header.
 * - Unit-testable: accessors are pure (ComparisonVenue -> value) and each
 *   field's label/type/highlight rule is inspectable in isolation.
 * - Highlight rules (best-in-row) are declarative — the row renderer just
 *   asks the registry "which venue wins this row?".
 *
 * Row order is intentional: decision-impacting facts (★ / 費用 / キャパ /
 * アクセス) go first, soft "feel" facts (料理 / 時間 / 定休) later.
 * Mirrors ハナユメ比較シート + Booking.com row hierarchy.
 */

import type { ComparisonVenue } from "@/lib/comparison-types";
import { CEREMONY_STYLE_LABELS } from "@/lib/constants";
import { computeCompositeScore } from "@/lib/scoring";

/** Which "bucket" this row belongs to — used to group rows under subheadings. */
export type FieldGroup =
  | "signal" // 外部評価 + 総合スコア
  | "cost" // 費用
  | "capacity" // キャパ
  | "style" // 挙式スタイル
  | "location" // アクセス
  | "facility" // 駐車・送迎・提携・二次会・バリアフリー
  | "cuisine" // 料理 / シェフ
  | "schedule"; // 営業時間 / 定休日

export const FIELD_GROUP_LABELS: Record<FieldGroup, string> = {
  signal: "評価",
  cost: "費用",
  capacity: "キャパシティ",
  style: "挙式スタイル",
  location: "場所・アクセス",
  facility: "設備・サービス",
  cuisine: "料理",
  schedule: "営業時間",
};

/**
 * What the cell renderer should treat this value as. The grid/mobile
 * renderers switch on this — keeping the branching in one place.
 *
 * - "rating-pair": two stacked numbers (rating + count)
 * - "yen-range": min-max in 万円
 * - "yen-exact": single integer in 万円
 * - "people-range": min-max in 名
 * - "chips": string[] pill list
 * - "yesno": true/false/null — renders YesNoCell (gold chip / muted dash)
 * - "text": single line
 * - "multiline": allow line-wrap (accessInfo)
 * - "percent": 0.10 -> "10%"
 */
export type FieldRenderKind =
  | "rating-pair"
  | "yen-range"
  | "yen-exact"
  | "people-range"
  | "chips"
  | "yesno"
  | "text"
  | "multiline"
  | "percent"
  | "composite-rating";

/**
 * "best" = highlighted in gold (lowest cost wins, highest rating wins,
 *   most capacity wins, longest feature list wins).
 * "present" = highlighted when truthy (boolean true, non-empty).
 * "none" = no highlight — just display.
 *
 * `highlightPicker` accepts the full matrix row and returns the winning
 * venue id (or a Set of tied ids). Kept as a function so individual rows
 * can define their own tie-breaking semantics (e.g. costMin ties → all win).
 */
export type FieldHighlight =
  | { kind: "best"; goal: "min" | "max" }
  | { kind: "present" }
  | { kind: "none" };

export interface CompareField {
  id: string;
  group: FieldGroup;
  label: string;
  /** What the raw accessed value looks like — feeds the cell renderer. */
  render: FieldRenderKind;
  /** Pure accessor: venue -> raw value. */
  accessor: (v: ComparisonVenue) => unknown;
  /**
   * Given the cell value, is there content to show? Used so the whole row
   * can hide when 0 venues have this field populated (白紙 suppression).
   */
  hasValue: (value: unknown) => boolean;
  /** Per-venue best-value marker. */
  highlight: FieldHighlight;
  /** Optional: let a row hide itself entirely (e.g. feature-flagged). */
  hidden?: boolean;
}

// ── Accessors ────────────────────────────────────────────────────────────
// All are pure. No DB access, no side effects. Testable.

const accessRating = (v: ComparisonVenue) =>
  v.externalRatingValue !== null
    ? { value: v.externalRatingValue, count: v.externalReviewCount ?? 0 }
    : null;

const accessComposite = (v: ComparisonVenue) => computeCompositeScore(v.scores);

const accessCost = (v: ComparisonVenue) =>
  v.costMin !== null || v.costMax !== null ? { min: v.costMin, max: v.costMax } : null;

const accessCeremonyFee = (v: ComparisonVenue) => v.ceremonyFeeExact;

const accessProductionFee = (v: ComparisonVenue) =>
  v.productionFeeMin !== null || v.productionFeeMax !== null
    ? { min: v.productionFeeMin, max: v.productionFeeMax }
    : null;

const accessServiceFee = (v: ComparisonVenue) => v.serviceFeeRate;

const accessCapacity = (v: ComparisonVenue) =>
  v.capacityMin !== null || v.capacityMax !== null
    ? { min: v.capacityMin, max: v.capacityMax }
    : null;

const accessCeremonyStyles = (v: ComparisonVenue) =>
  v.ceremonyStyles.length > 0
    ? v.ceremonyStyles.map((s) => CEREMONY_STYLE_LABELS[s.toLowerCase()] ?? s)
    : null;

const accessLocation = (v: ComparisonVenue) => v.location;
const accessAccess = (v: ComparisonVenue) => v.accessInfo;
const accessAddress = (v: ComparisonVenue) => {
  const parts = [v.postalCode ? `〒${v.postalCode}` : null, v.streetAddress].filter(
    (s): s is string => Boolean(s),
  );
  return parts.length > 0 ? parts.join(" ") : null;
};

const accessParking = (v: ComparisonVenue) => {
  if (v.hasParking === null) return null;
  return { has: v.hasParking, capacity: v.parkingCapacity };
};
const accessShuttle = (v: ComparisonVenue) => v.hasShuttle;
const accessAccommodation = (v: ComparisonVenue) => v.hasAccommodation;
const accessSecondParty = (v: ComparisonVenue) => v.acceptsSecondParty;
const accessBarrierFree = (v: ComparisonVenue) => v.barrierFree;

const accessCuisineTypes = (v: ComparisonVenue) =>
  v.cuisineTypes.length > 0 ? v.cuisineTypes : null;
const accessChef = (v: ComparisonVenue) => v.chefCredentials;

const accessOperatingHours = (v: ComparisonVenue) => v.operatingHours;
const accessClosedDays = (v: ComparisonVenue) =>
  v.closedDays.length > 0 ? v.closedDays : null;

// ── hasValue predicates ──────────────────────────────────────────────────

const hasBasic = (value: unknown): boolean =>
  value !== null && value !== undefined && value !== "";

const hasRange = (value: unknown): boolean => {
  if (!value || typeof value !== "object") return false;
  const r = value as { min: number | null; max: number | null };
  return r.min !== null || r.max !== null;
};

const hasArray = (value: unknown): boolean =>
  Array.isArray(value) && value.length > 0;

const hasParkingValue = (value: unknown): boolean => {
  if (!value || typeof value !== "object") return false;
  const p = value as { has: boolean | null };
  return p.has !== null;
};

const hasRatingPair = (value: unknown): boolean => {
  if (!value || typeof value !== "object") return false;
  return (value as { value: number | null }).value !== null;
};

// ── Registry ─────────────────────────────────────────────────────────────
// Order matters: decision-driving rows first. "晴れの日" mindset: the
// couple should see price + capacity at-a-glance, then dig into softer
// attributes (cuisine, hours) if still undecided.

export const COMPARE_FIELDS: CompareField[] = [
  // 1. 総合スコア(Haretoki's own composite) + external rating
  {
    id: "composite-score",
    group: "signal",
    label: "総合スコア",
    render: "composite-rating",
    accessor: accessComposite,
    hasValue: (v) => v !== null,
    highlight: { kind: "best", goal: "max" },
  },
  {
    id: "external-rating",
    group: "signal",
    label: "外部口コミ",
    render: "rating-pair",
    accessor: accessRating,
    hasValue: hasRatingPair,
    highlight: { kind: "best", goal: "max" },
  },

  // 2. 費用
  {
    id: "cost-range",
    group: "cost",
    label: "費用目安",
    render: "yen-range",
    accessor: accessCost,
    hasValue: hasRange,
    highlight: { kind: "best", goal: "min" },
  },
  {
    id: "ceremony-fee",
    group: "cost",
    label: "挙式料",
    render: "yen-exact",
    accessor: accessCeremonyFee,
    hasValue: hasBasic,
    highlight: { kind: "best", goal: "min" },
  },
  {
    id: "production-fee",
    group: "cost",
    label: "演出料",
    render: "yen-range",
    accessor: accessProductionFee,
    hasValue: hasRange,
    highlight: { kind: "best", goal: "min" },
  },
  {
    id: "service-fee",
    group: "cost",
    label: "サービス料",
    render: "percent",
    accessor: accessServiceFee,
    hasValue: hasBasic,
    highlight: { kind: "best", goal: "min" },
  },

  // 3. キャパ
  {
    id: "capacity",
    group: "capacity",
    label: "収容人数",
    render: "people-range",
    accessor: accessCapacity,
    hasValue: hasRange,
    highlight: { kind: "best", goal: "max" },
  },

  // 4. 挙式スタイル
  {
    id: "ceremony-styles",
    group: "style",
    label: "挙式スタイル",
    render: "chips",
    accessor: accessCeremonyStyles,
    hasValue: hasArray,
    highlight: { kind: "none" },
  },

  // 5. 場所・アクセス
  {
    id: "location",
    group: "location",
    label: "エリア",
    render: "text",
    accessor: accessLocation,
    hasValue: hasBasic,
    highlight: { kind: "none" },
  },
  {
    id: "address",
    group: "location",
    label: "住所",
    render: "multiline",
    accessor: accessAddress,
    hasValue: hasBasic,
    highlight: { kind: "none" },
  },
  {
    id: "access",
    group: "location",
    label: "アクセス",
    render: "multiline",
    accessor: accessAccess,
    hasValue: hasBasic,
    highlight: { kind: "none" },
  },

  // 6. 設備・サービス — "yes" が gold chip、null は dash
  {
    id: "parking",
    group: "facility",
    label: "駐車場",
    render: "yesno",
    accessor: accessParking,
    hasValue: hasParkingValue,
    highlight: { kind: "present" },
  },
  {
    id: "shuttle",
    group: "facility",
    label: "送迎バス",
    render: "yesno",
    accessor: accessShuttle,
    hasValue: hasBasic,
    highlight: { kind: "present" },
  },
  {
    id: "accommodation",
    group: "facility",
    label: "提携宿泊",
    render: "yesno",
    accessor: accessAccommodation,
    hasValue: hasBasic,
    highlight: { kind: "present" },
  },
  {
    id: "second-party",
    group: "facility",
    label: "二次会",
    render: "yesno",
    accessor: accessSecondParty,
    hasValue: hasBasic,
    highlight: { kind: "present" },
  },
  {
    id: "barrier-free",
    group: "facility",
    label: "バリアフリー",
    render: "yesno",
    accessor: accessBarrierFree,
    hasValue: hasBasic,
    highlight: { kind: "present" },
  },

  // 7. 料理
  {
    id: "cuisine-types",
    group: "cuisine",
    label: "料理タイプ",
    render: "chips",
    accessor: accessCuisineTypes,
    hasValue: hasArray,
    highlight: { kind: "none" },
  },
  {
    id: "chef-credentials",
    group: "cuisine",
    label: "シェフ",
    render: "multiline",
    accessor: accessChef,
    hasValue: hasBasic,
    highlight: { kind: "none" },
  },

  // 8. 営業時間
  {
    id: "operating-hours",
    group: "schedule",
    label: "営業時間",
    render: "text",
    accessor: accessOperatingHours,
    hasValue: hasBasic,
    highlight: { kind: "none" },
  },
  {
    id: "closed-days",
    group: "schedule",
    label: "定休日",
    render: "chips",
    accessor: accessClosedDays,
    hasValue: hasArray,
    highlight: { kind: "none" },
  },
];

// ── Highlight resolver ───────────────────────────────────────────────────

/**
 * For a given field and the set of selected venues, return the Set of
 * venue ids that should be highlighted. Returns an empty Set when nothing
 * to highlight (all-null row, all-same row, or highlight.kind === "none").
 *
 * Exported so the renderer can ask once per row and apply gold-ring/class.
 */
export function resolveHighlight(
  field: CompareField,
  venues: ComparisonVenue[],
): Set<string> {
  const winners = new Set<string>();
  if (field.highlight.kind === "none") return winners;

  // "present" — every venue with a truthy value gets highlighted as long
  // as at least one venue does NOT have it (avoids a row of 10 highlights
  // which would mean "no winner").
  if (field.highlight.kind === "present") {
    const withValue: string[] = [];
    const withoutValue: string[] = [];
    for (const v of venues) {
      const raw = field.accessor(v);
      const truthy =
        raw === true ||
        (typeof raw === "object" &&
          raw !== null &&
          "has" in raw &&
          (raw as { has: boolean }).has === true);
      if (truthy) {
        withValue.push(v.id);
      } else if (raw !== null && raw !== undefined) {
        withoutValue.push(v.id);
      }
    }
    if (withValue.length > 0 && withoutValue.length > 0) {
      for (const id of withValue) winners.add(id);
    }
    return winners;
  }

  // "best" — numeric goal on the accessed value
  const goal = field.highlight.goal;
  const samples: Array<{ id: string; v: number }> = [];
  for (const venue of venues) {
    const raw = field.accessor(venue);
    const n = extractComparable(raw, goal);
    if (n !== null) samples.push({ id: venue.id, v: n });
  }
  // If fewer than 2 samples, there's no "better" — no highlight
  if (samples.length < 2) return winners;
  const winningValue =
    goal === "min"
      ? Math.min(...samples.map((s) => s.v))
      : Math.max(...samples.map((s) => s.v));
  for (const s of samples) {
    if (s.v === winningValue) winners.add(s.id);
  }
  // If everyone "wins" equally, no highlight (row is homogeneous)
  if (winners.size === samples.length) winners.clear();
  return winners;
}

/**
 * Pull a single comparable number out of the accessed value. Pairs
 * (rating+count, min-max range) collapse to a canonical number for
 * min/max comparison.
 */
function extractComparable(
  raw: unknown,
  goal: "min" | "max",
): number | null {
  if (raw === null || raw === undefined) return null;
  if (typeof raw === "number") return raw;
  if (typeof raw === "object") {
    // rating-pair -> use value (rating), ignore count
    if ("value" in raw && typeof (raw as { value: unknown }).value === "number") {
      return (raw as { value: number }).value;
    }
    // range -> for "min" goal use min fallback max; for "max" use max fallback min
    if ("min" in raw || "max" in raw) {
      const r = raw as { min: number | null; max: number | null };
      if (goal === "min") return r.min ?? r.max ?? null;
      return r.max ?? r.min ?? null;
    }
  }
  return null;
}
