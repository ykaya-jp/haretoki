interface CircularProgressScoreProps {
  score: number; // 0-100
  size?: 64 | 80;
  label?: string;
}

export function CircularProgressScore({ score, size = 64, label }: CircularProgressScoreProps) {
  const strokeWidth = 5;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const getColor = () => {
    // score is 0-100, map to 0-5 for lookup
    const stars = score / 20;
    if (stars >= 4.5) return "var(--gold-warm)";
    if (stars >= 4.0) return "var(--gold-light)";
    if (stars >= 3.5) return "var(--muted-foreground)";
    if (stars >= 3.0) return "var(--muted-foreground)";
    return "var(--destructive)";
  };

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--border)"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={getColor()}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-[stroke-dashoffset] duration-500 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="tabular-nums text-lg font-semibold">{score}点</span>
        </div>
      </div>
      {label && <span className="text-xs text-muted-foreground">{label}</span>}
    </div>
  );
}
