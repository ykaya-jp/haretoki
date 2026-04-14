/** Circular progress ring showing the current journey stage name. No numeric % shown. */

interface JourneyRingProps {
  totalVenues: number;
  visitedVenues: number;
  favoriteCount: number;
  hasDecision: boolean;
  upcomingVisits: number;
}

type StageKey = "start" | "adding" | "visiting" | "comparing" | "decided";

interface Stage {
  key: StageKey;
  label: string;
  progress: number; // 0-100, visual only
}

function getStage(props: JourneyRingProps): Stage {
  const { totalVenues, visitedVenues, favoriteCount, hasDecision } = props;
  if (hasDecision) return { key: "decided", label: "決定済み", progress: 100 };
  if (favoriteCount >= 2) return { key: "comparing", label: "比較中", progress: 80 };
  if (visitedVenues >= 1) return { key: "visiting", label: "見学中", progress: 55 };
  if (totalVenues >= 1) return { key: "adding", label: "式場選び", progress: 30 };
  return { key: "start", label: "はじめる", progress: 10 };
}

/** Diameter: 72px, stroke: 6px, gold-warm color ring */
export function JourneyRing(props: JourneyRingProps) {
  const stage = getStage(props);
  const size = 72;
  const strokeWidth = 6;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - stage.progress / 100);

  return (
    <div
      className="relative flex shrink-0 items-center justify-center"
      style={{ width: size, height: size }}
      aria-label={`式場選びの段階: ${stage.label}`}
      role="img"
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden="true"
        className="-rotate-90"
      >
        {/* Track */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-border"
        />
        {/* Progress arc */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          stroke="var(--gold-warm)"
        />
      </svg>
      {/* Stage label centered inside ring */}
      <span
        className="absolute inset-0 flex items-center justify-center font-serif font-extralight tracking-tight text-muted-foreground"
        style={{ fontSize: 11, lineHeight: 1.2 }}
      >
        {stage.label}
      </span>
    </div>
  );
}
