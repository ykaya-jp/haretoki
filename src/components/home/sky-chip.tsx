import type { Weather } from "@/lib/prompts/ritual";

interface SkyChipProps {
  mood: Weather;
  /** 56 (default) | 64 (hero) | 40 (compact) */
  size?: 40 | 56 | 64;
}

/**
 * Brand "sky chip" — a small circular illustration evoking 曇り→晴れ間→晴れ.
 * Used in EditorialHero, DailyRitual, and (soon) anywhere we need to express
 * "ふたりの今日の空".
 */
export function SkyChip({ mood, size = 56 }: SkyChipProps) {
  const iconSize = size === 64 ? 36 : size === 40 ? 24 : 32;

  return (
    <div
      aria-hidden="true"
      className="relative flex shrink-0 items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        background:
          "radial-gradient(120% 120% at 30% 20%, oklch(0.95 0.04 75) 0%, oklch(0.92 0.06 65) 40%, oklch(0.86 0.08 55) 100%)",
        boxShadow:
          size >= 56
            ? "inset 0 1px 0 rgba(255,255,255,0.7), 0 1px 2px rgba(201,164,76,0.12), 0 6px 16px rgba(201,164,76,0.18)"
            : "inset 0 1px 0 rgba(255,255,255,0.6), 0 1px 2px rgba(201,164,76,0.10)",
      }}
    >
      <svg width={iconSize} height={iconSize} viewBox="0 0 32 32" fill="none">
        {mood === "cloudy" && (
          <g>
            <circle cx="12" cy="17" r="5" fill="oklch(0.98 0.01 75)" opacity="0.95" />
            <circle cx="19" cy="15" r="6" fill="oklch(0.98 0.01 75)" opacity="0.95" />
            <ellipse cx="15" cy="20" rx="9" ry="4" fill="oklch(0.98 0.01 75)" opacity="0.95" />
          </g>
        )}
        {mood === "break" && (
          <g>
            <circle cx="21" cy="11" r="5" fill="oklch(0.85 0.14 80)" />
            <g
              stroke="oklch(0.85 0.14 80)"
              strokeWidth="1.2"
              strokeLinecap="round"
            >
              <line x1="21" y1="3" x2="21" y2="5" />
              <line x1="27.5" y1="4.5" x2="26.2" y2="5.8" />
              <line x1="29" y1="11" x2="27" y2="11" />
            </g>
            <ellipse cx="13" cy="20" rx="10" ry="4.5" fill="oklch(0.99 0.005 80)" />
            <circle cx="9" cy="18" r="4.5" fill="oklch(0.99 0.005 80)" />
            <circle cx="16" cy="17" r="5.5" fill="oklch(0.99 0.005 80)" />
          </g>
        )}
        {mood === "clear" && (
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
        {mood === "sunny" && (
          <g>
            <circle cx="16" cy="16" r="5" fill="oklch(0.78 0.17 80)" />
            <g
              stroke="oklch(0.78 0.17 80)"
              strokeWidth="1.4"
              strokeLinecap="round"
            >
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

export function weatherLabel(w: Weather): string {
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
