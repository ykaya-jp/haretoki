import Link from "next/link";

interface TimeEchoProps {
  firstVenue: { id: string; name: string; daysAgo: number } | null;
}

/**
 * TimeEcho — a one-liner echo of the couple's earliest saved venue.
 * Renders nothing if the first venue is newer than 14 days (too close to
 * feel like a memory) or if there are no venues yet. Lives in the Whisper
 * band as a quiet nudge that the journey has history.
 */
export function TimeEcho({ firstVenue }: TimeEchoProps) {
  if (!firstVenue) return null;
  if (firstVenue.daysAgo < 14) return null;

  const span =
    firstVenue.daysAgo >= 365
      ? `${Math.floor(firstVenue.daysAgo / 365)} 年前`
      : firstVenue.daysAgo >= 30
        ? `${Math.floor(firstVenue.daysAgo / 30)} か月前`
        : `${Math.floor(firstVenue.daysAgo / 7)} 週間前`;

  return (
    <p className="text-[12px] leading-relaxed text-muted-foreground">
      <span className="tabular-nums">{span}</span> に最初に残した{" "}
      <Link
        href={`/venues/${firstVenue.id}`}
        prefetch={true}
        className="text-foreground underline-offset-4 hover:underline"
      >
        {firstVenue.name}
      </Link>
      。あのときの予感は、いまも残っていますか。
    </p>
  );
}
