import { cn } from "@/lib/utils";
import {
  TIER1_DIMENSIONS,
  DIMENSION_LABELS,
  getScoreColor,
} from "@/lib/constants";
import { ScoreBadge } from "@/components/compare/score-badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ShortlistCardProps = {
  name: string;
  scores: Record<string, number | null>;
  isTopChoice: boolean;
};

function calcAverage(scores: Record<string, number | null>): number | null {
  const values = Object.values(scores).filter(
    (v): v is number => v !== null,
  );
  if (values.length === 0) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

export function ShortlistCard({
  name,
  scores,
  isTopChoice,
}: ShortlistCardProps) {
  const avg = calcAverage(scores);

  // Gold gradient border wrapper for top choice
  if (isTopChoice) {
    return (
      <div className="rounded-xl bg-gradient-to-br from-[#C9A84C]/60 via-transparent to-[#C9A84C]/60 p-[1px]">
        <Card className="rounded-[11px] shadow-[var(--shadow-soft)]">
          <ShortlistCardInner name={name} scores={scores} avg={avg} isTopChoice />
        </Card>
      </div>
    );
  }

  return (
    <Card className="shadow-[var(--shadow-soft)]">
      <ShortlistCardInner name={name} scores={scores} avg={avg} isTopChoice={false} />
    </Card>
  );
}

function ShortlistCardInner({
  name,
  scores,
  avg,
  isTopChoice,
}: {
  name: string;
  scores: Record<string, number | null>;
  avg: number | null;
  isTopChoice: boolean;
}) {
  return (
    <>
      <CardHeader>
        <div className="flex items-center gap-2">
          <CardTitle className="font-serif text-base font-light">{name}</CardTitle>
          {isTopChoice && (
            <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-medium text-primary-foreground">
              本命
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Average score */}
        {avg !== null && (
          <div className="flex items-baseline gap-2">
            <span
              className={cn(
                "text-2xl font-bold tabular-nums",
                getScoreColor(avg),
              )}
            >
              {avg.toFixed(1)}
            </span>
            <span className="text-xs text-muted-foreground">総合スコア</span>
          </div>
        )}

        {/* Per-dimension scores */}
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
          {TIER1_DIMENSIONS.map((dim) => (
            <div key={dim} className="flex items-center justify-between">
              <span className="text-muted-foreground">
                {DIMENSION_LABELS[dim]}
              </span>
              <ScoreBadge score={scores[dim] ?? null} />
            </div>
          ))}
        </div>
      </CardContent>
    </>
  );
}
