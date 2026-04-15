import { DIMENSION_LABELS } from "@/lib/constants";

interface DimensionBarProps {
  dimension: string;
  scores: { venueId: string; venueName: string; score: number }[];
}

function getBarColor(score: number) {
  if (score >= 4.5) return "bg-[var(--gold-warm)]";
  if (score >= 4.0) return "bg-[var(--gold-light)]";
  if (score >= 3.5) return "bg-[#9B8E7E]";
  if (score >= 3.0) return "bg-[#6B7280]";
  return "bg-[#9B6B6B]";
}

export function DimensionBar({ dimension, scores }: DimensionBarProps) {
  const label = DIMENSION_LABELS[dimension] ?? dimension;

  return (
    <div className="space-y-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      <div className="space-y-1.5">
        {scores.map((s) => (
          <div key={s.venueId} className="flex items-center gap-2">
            <span className="w-16 truncate text-xs">{s.venueName}</span>
            <div className="flex-1">
              <div
                className={`h-2 rounded-full ${getBarColor(s.score)}`}
                style={{ width: `${(s.score / 5) * 100}%` }}
              />
            </div>
            <span className="w-8 text-right text-xs tabular-nums">{s.score.toFixed(1)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
