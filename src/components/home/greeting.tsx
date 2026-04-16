"use client";

import { useSyncExternalStore } from "react";

interface GreetingProps {
  userName: string;
  weddingDate?: Date;
}

// Empty subscribe: hour doesn't change often enough to warrant re-subscribing.
// The snapshot is re-read on every render, which is fine — the value is cheap.
const subscribe = () => () => {};
const getHourSnapshot = () => new Date().getHours();
// Server snapshot: UTC hour is wrong for the user; return a neutral greeting key.
// -1 is treated as "こんにちは" below, avoiding a hydration mismatch because
// the client's initial render also uses getServerSnapshot until hydrated.
const getServerSnapshot = () => -1;

export function Greeting({ userName, weddingDate }: GreetingProps) {
  // Compute greeting on the client so we use the user's local timezone.
  // If we computed on the server, Vercel's UTC clock would show "こんばんは"
  // at 10am JST.
  const hour = useSyncExternalStore(subscribe, getHourSnapshot, getServerSnapshot);
  const greeting =
    hour < 0
      ? "こんにちは"
      : hour < 12
        ? "おはようございます"
        : hour < 18
          ? "こんにちは"
          : "こんばんは";

  const now = new Date();
  const daysUntilWedding = weddingDate
    ? Math.ceil((weddingDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div>
      <h1 className="font-[family-name:var(--font-display)] font-extralight text-fluid-xl">
        {greeting}、{userName}さん
      </h1>
      {daysUntilWedding !== null && daysUntilWedding > 0 && (
        <p className="mt-1 flex items-baseline gap-1 text-muted-foreground">
          <span className="text-[11px]">晴れの日まで あと</span>
          <span className="font-[family-name:var(--font-display)] font-extralight tabular-nums text-5xl leading-none tracking-tight text-foreground">
            {daysUntilWedding}
          </span>
          <span className="text-[11px]">日</span>
        </p>
      )}
    </div>
  );
}
