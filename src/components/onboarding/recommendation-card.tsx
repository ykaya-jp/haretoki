"use client";

import Link from "next/link";
import Image from "next/image";
import { Loader2, Plus, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Onboarding recommendation card — used twice in the recommendations
 * reveal: once for AI-generated venues ("コーチからの提案"), once for
 * DB-matched existing venues ("あなたに近い実例"). Variant prop selects
 * between the two visual treatments.
 *
 * Round 19 (A-4): extracted from inline JSX in onboarding-flow.tsx so
 * the AI / DB blocks can share one definition. Style differences:
 *
 *   variant="ai" (主、emphasis):
 *     - Card surface: gold-subtle bg + gold-warm border (existing)
 *     - Photo: 16:9 (changed from 4:3 for visual emphasis)
 *     - Name: Noto Serif JP 19px
 *     - estimatedPrice in tabular-nums when supplied
 *     - strengths chips below reason
 *     - Primary CTA: 「気になるリストに入れる」 in gold-warm tone
 *   variant="db" (副、subtle):
 *     - Card surface: card bg + muted border (less emphasis)
 *     - Photo: 16:9 (matched to AI for layout rhythm)
 *     - Name: Noto Serif JP 18px
 *     - Whole card is an anchor → /venues/<id>
 *     - No CTA button (the card itself is the affordance)
 *
 * Both variants stay editorial (gold hairline / mincho) — the visual
 * difference is emphasis weight, not personality. A-0 Refero research:
 * Notion "pre-populated template" pattern (AI 上 + DB 下 = 2 段組) is
 * the canonical pattern this card supports.
 */

interface BaseProps {
  name: string;
  location: string | null;
  reason: string;
  photoUrl: string | null;
}

interface AiProps extends BaseProps {
  variant: "ai";
  estimatedPrice: number | null;
  strengths: string[];
  isAdding: boolean;
  onAdd: () => void;
}

interface DbProps extends BaseProps {
  variant: "db";
  venueId: string;
}

export type RecommendationCardProps = AiProps | DbProps;

export function RecommendationCard(props: RecommendationCardProps) {
  if (props.variant === "ai") {
    return <AiCard {...props} />;
  }
  return <DbCard {...props} />;
}

function AiCard({
  name,
  location,
  reason,
  photoUrl,
  estimatedPrice,
  strengths,
  isAdding,
  onAdd,
}: AiProps) {
  return (
    <div
      className="overflow-hidden rounded-2xl border"
      style={{
        background: "color-mix(in oklab, var(--gold-subtle) 30%, var(--card))",
        borderColor: "color-mix(in oklab, var(--gold-warm) 18%, transparent)",
      }}
    >
      {/* 16:9 hero photo. AI venues frequently have no photo (the AI
          doesn't fabricate URLs), so the block degrades to a soft
          gradient placeholder rather than collapsing to zero height. */}
      <div className="relative aspect-[16/9] w-full">
        {photoUrl ? (
          <Image
            src={photoUrl}
            alt={name}
            fill
            className="object-cover"
            sizes="(max-width: 512px) 100vw, 512px"
          />
        ) : (
          <div
            className="absolute inset-0"
            aria-hidden
            style={{
              background:
                "linear-gradient(135deg, color-mix(in oklab, var(--gold-warm) 18%, var(--card)) 0%, color-mix(in oklab, var(--gold-subtle) 60%, var(--card)) 100%)",
            }}
          />
        )}
      </div>

      <div className="space-y-3 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-0.5">
            {/* Venue name in Noto Serif JP — same family the brand uses
                for hero typography on home / decision / venue pages.  */}
            <p className="font-[family-name:var(--font-display)] text-[19px] font-light leading-snug text-foreground">
              {name}
            </p>
            {location && (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3 flex-none" strokeWidth={1.5} />
                {location}
              </p>
            )}
          </div>
          {estimatedPrice && (
            <p className="whitespace-nowrap font-[family-name:var(--font-display)] text-[22px] font-light tabular-nums text-muted-foreground">
              {Math.round(estimatedPrice / 10000)}
              <span className="ml-0.5 text-xs">万〜</span>
            </p>
          )}
        </div>

        {/* Reason copy — Noto Sans 13.5px (the brand's reading body
            scale on cards). Cap to 4 lines via leading-relaxed +
            natural overflow; we don't truncate so the couple sees
            the full coach reasoning. */}
        <p className="text-[13.5px] leading-relaxed text-foreground/80">
          {reason}
        </p>

        {strengths.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {strengths.map((s) => (
              <span
                key={s}
                className="rounded-full px-2.5 py-0.5 text-xs text-muted-foreground"
                style={{
                  background:
                    "color-mix(in oklab, var(--gold-warm) 8%, var(--muted))",
                }}
              >
                {s}
              </span>
            ))}
          </div>
        )}

        {/* Primary CTA — gold-warm tone (round 19): the prior default
            black-pill weighed too heavily next to the editorial body.
            The gold-warm fill keeps the gesture warm + on-brand without
            losing tap salience (fontWeight 500 + h-10 anchor). */}
        <Button
          size="sm"
          className="h-10 w-full text-[var(--gold-on-warm,#1E1B14)]"
          disabled={isAdding}
          onClick={onAdd}
          style={{
            background: "var(--gold-warm)",
            borderColor: "var(--gold-warm)",
          }}
        >
          {isAdding ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <>
              <Plus className="mr-1 h-4 w-4" />
              気になるリストに入れる
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

function DbCard({ name, location, reason, photoUrl, venueId }: DbProps) {
  return (
    <Link
      href={`/venues/${venueId}`}
      className="block overflow-hidden rounded-2xl border bg-card transition-transform active:scale-[0.98]"
      style={{
        borderColor: "color-mix(in oklab, var(--gold-warm) 10%, var(--border))",
      }}
    >
      <div className="relative aspect-[16/9] w-full bg-muted">
        {photoUrl && (
          <Image
            src={photoUrl}
            alt={name}
            fill
            className="object-cover"
            sizes="(max-width: 512px) 100vw, 512px"
          />
        )}
      </div>
      <div className="space-y-2 p-4">
        <p className="font-[family-name:var(--font-display)] text-[18px] font-light leading-snug text-foreground">
          {name}
        </p>
        {location && (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3 flex-none" strokeWidth={1.5} />
            {location}
          </p>
        )}
        <p className="text-[13.5px] leading-relaxed text-foreground/80">
          {reason}
        </p>
      </div>
    </Link>
  );
}
