import { cn } from "@/lib/utils";
import { getScoreColor } from "@/lib/constants";

type ScoreBadgeProps = {
  score: number | null;
};

export function ScoreBadge({ score }: ScoreBadgeProps) {
  if (score === null || score === undefined) {
    return <span className="text-muted-foreground">—</span>;
  }

  return (
    <span className={cn("font-medium tabular-nums", getScoreColor(score))}>
      {score.toFixed(1)}
    </span>
  );
}
