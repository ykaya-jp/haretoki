import type { JourneyMilestone } from "@/server/actions/journey";
import type { Weather } from "@/server/actions/journey";
import { cn } from "@/lib/utils";

interface WeatherIconProps {
  weather: Weather;
}

/** Inline SVG sky icon matching SkyChip pattern from the design system. */
function WeatherIcon({ weather }: WeatherIconProps) {
  return (
    <div
      aria-hidden="true"
      className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
      style={{
        background:
          "radial-gradient(120% 120% at 30% 20%, oklch(0.95 0.04 75) 0%, oklch(0.92 0.06 65) 40%, oklch(0.86 0.08 55) 100%)",
        boxShadow:
          "inset 0 1px 0 rgba(255,255,255,0.6), 0 1px 2px rgba(201,164,76,0.10)",
      }}
    >
      <svg width="24" height="24" viewBox="0 0 32 32" fill="none">
        {weather === "cloudy" && (
          <g>
            <circle cx="12" cy="17" r="5" fill="oklch(0.98 0.01 75)" opacity="0.95" />
            <circle cx="19" cy="15" r="6" fill="oklch(0.98 0.01 75)" opacity="0.95" />
            <ellipse cx="15" cy="20" rx="9" ry="4" fill="oklch(0.98 0.01 75)" opacity="0.95" />
          </g>
        )}
        {weather === "break" && (
          <g>
            <circle cx="21" cy="11" r="5" fill="oklch(0.85 0.14 80)" />
            <g stroke="oklch(0.85 0.14 80)" strokeWidth="1.2" strokeLinecap="round">
              <line x1="21" y1="3" x2="21" y2="5" />
              <line x1="27.5" y1="4.5" x2="26.2" y2="5.8" />
              <line x1="29" y1="11" x2="27" y2="11" />
            </g>
            <ellipse cx="13" cy="20" rx="10" ry="4.5" fill="oklch(0.99 0.005 80)" />
            <circle cx="9" cy="18" r="4.5" fill="oklch(0.99 0.005 80)" />
            <circle cx="16" cy="17" r="5.5" fill="oklch(0.99 0.005 80)" />
          </g>
        )}
        {weather === "clear" && (
          <g>
            <circle cx="16" cy="16" r="6" fill="oklch(0.80 0.16 80)" />
            <circle
              cx="16"
              cy="16"
              r="9"
              fill="none"
              stroke="oklch(0.80 0.16 80)"
              strokeOpacity="0.35"
              strokeWidth="1"
            />
          </g>
        )}
        {weather === "sunny" && (
          <g>
            <circle cx="16" cy="16" r="5" fill="oklch(0.78 0.17 80)" />
            <g stroke="oklch(0.78 0.17 80)" strokeWidth="1.4" strokeLinecap="round">
              <line x1="16" y1="3" x2="16" y2="6" />
              <line x1="16" y1="26" x2="16" y2="29" />
              <line x1="3" y1="16" x2="6" y2="16" />
              <line x1="26" y1="16" x2="29" y2="16" />
              <line x1="7" y1="7" x2="9" y2="9" />
              <line x1="23" y1="23" x2="25" y2="25" />
              <line x1="7" y1="25" x2="9" y2="23" />
              <line x1="23" y1="9" x2="25" y2="7" />
            </g>
          </g>
        )}
      </svg>
    </div>
  );
}

function formatJaDate(d: Date): string {
  return d.toLocaleDateString("ja-JP", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "Asia/Tokyo",
  });
}

function milestoneSubtext(m: JourneyMilestone): string {
  if (m.updatedAt === null) return "もう少し";

  switch (m.id) {
    case "start":
      return `${formatJaDate(m.updatedAt)} にはじまった`;
    case "favorites":
      return `${m.count} 件候補中`;
    case "visits":
      return `${formatJaDate(m.updatedAt)} 初見学`;
    case "estimates":
      return `${m.count} 件の見積もり`;
    case "decision":
      return `${formatJaDate(m.updatedAt)} 決定`;
    default:
      return "";
  }
}

function weatherLabel(w: Weather): string {
  switch (w) {
    case "cloudy":
      return "くもり";
    case "break":
      return "晴れ間";
    case "clear":
      return "晴れ";
    case "sunny":
      return "よく晴れ";
  }
}

interface JourneyTimelineProps {
  milestones: JourneyMilestone[];
}

/** Vertical timeline of journey milestones. Server Component. */
export function JourneyTimeline({ milestones }: JourneyTimelineProps) {
  return (
    <ol className="space-y-0" aria-label="晴れまでの道のり">
      {milestones.map((milestone, index) => {
        const reached = milestone.updatedAt !== null;
        const isLast = index === milestones.length - 1;

        return (
          <li
            key={milestone.id}
            className="relative flex gap-4"
          >
            {/* Vertical connector line — gold for reached, border for pending */}
            {!isLast && (
              <div
                aria-hidden="true"
                className="absolute left-5 top-10 h-full w-px"
                style={{
                  background: reached
                    ? "linear-gradient(to bottom, color-mix(in oklab, var(--gold-warm) 30%, transparent) 0%, color-mix(in oklab, var(--gold-warm) 10%, transparent) 100%)"
                    : "var(--border)",
                }}
              />
            )}

            {/* WeatherIcon: grayscale for unreached milestones */}
            <div className={cn(!reached && "opacity-50 grayscale")}>
              <WeatherIcon weather={milestone.weather} />
            </div>

            <div className="min-w-0 flex-1 pb-8">
              <div className="flex items-baseline gap-2">
                {/* h3: /70 opacity for unreached */}
                <h3 className={cn(
                  "font-[family-name:var(--font-heading)] text-[15px] font-normal",
                  reached ? "text-foreground" : "text-foreground/70"
                )}>
                  {milestone.label}
                </h3>
                {/* weatherLabel: hidden for unreached */}
                {reached && (
                  <span
                    className="text-eyebrow"
                    style={{ color: "var(--gold-warm)" }}
                  >
                    {weatherLabel(milestone.weather)}
                  </span>
                )}
              </div>
              {/* subtext: /60 opacity for unreached */}
              <p className={cn(
                "mt-1 text-[13.5px] leading-relaxed",
                reached ? "text-muted-foreground" : "text-muted-foreground/60"
              )}>
                {milestoneSubtext(milestone)}
              </p>
              {reached && milestone.id !== "start" && milestone.id !== "decision" && (
                <p className="mt-0.5 text-eyebrow tabular-nums text-muted-foreground">
                  {milestone.count} / {milestone.targetCount}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
