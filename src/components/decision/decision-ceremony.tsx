"use client";

import { useState, useEffect } from "react";

type CeremonyPhase = "celebration" | "summary" | "reason";

interface DecisionCeremonyProps {
  venueName: string;
  userName: string;
  journeyStats: {
    totalVenues: number;
    shortlisted: number;
    compared: number;
  };
  onRecordReason: (tags: string[], text: string) => Promise<void>;
}

const REASON_TAGS = ["雰囲気", "料理", "コスパ", "アクセス", "サービス", "設備"];

export function DecisionCeremony({ venueName, userName, journeyStats, onRecordReason }: DecisionCeremonyProps) {
  const [phase, setPhase] = useState<CeremonyPhase>("celebration");
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [reasonText, setReasonText] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (phase !== "celebration") return;

    // Move to summary after 2 seconds.
    const timer = setTimeout(() => setPhase("summary"), 2000);

    // Fire confetti via dynamic import so the ~15KB canvas-confetti bundle is
    // NOT pulled into the initial JS payload. The `cancelled` flag guards
    // against confetti firing after unmount (the import resolves async).
    let cancelled = false;
    const prefersReduced = window
      .matchMedia("(prefers-reduced-motion: reduce)")
      .matches;
    if (!prefersReduced) {
      void import("canvas-confetti").then((mod) => {
        if (cancelled) return;
        mod.default({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 },
          colors: ["#1E3A5F", "#C9A84C", "#FFFFFF"],
        });
      });
    }

    // Single effect-level cleanup — always runs on unmount / phase change,
    // regardless of whether the confetti branch was taken.
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [phase]);

  const handleSaveReason = async (
    tags: string[] = selectedTags,
    text: string = reasonText,
  ) => {
    if (saving) return;
    setSaving(true);
    try {
      await onRecordReason(tags, text);
    } finally {
      setSaving(false);
    }
  };

  const handleSkipAll = () => {
    if (saving) return;
    void handleSaveReason([], "");
  };

  if (phase === "celebration") {
    const greeting = userName ? `おめでとう、${userName}さん！` : "おめでとうございます！";
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center text-center">
        <h1 className="text-fluid-xl">{greeting}</h1>
        <p className="mt-2 text-lg text-muted-foreground">
          {venueName}に決まりました
        </p>
      </div>
    );
  }

  if (phase === "summary") {
    return (
      <div className="flex flex-col items-center gap-6 py-8">
        <div className="text-center">
          <h2 className="text-lg font-medium">{venueName}</h2>
          <p className="mt-2 text-sm text-muted-foreground">おふたりの式場さがし</p>
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>{journeyStats.totalVenues}会場を調べて</span>
          <span>→</span>
          <span>{journeyStats.shortlisted}件に絞り</span>
          <span>→</span>
          <span>{journeyStats.compared}件を比べて</span>
          <span>→</span>
          <span className="font-medium text-foreground">{venueName}に</span>
        </div>
        <button
          type="button"
          onClick={() => setPhase("reason")}
          disabled={saving}
          className="min-h-11 rounded-lg bg-primary px-6 py-3 text-primary-foreground disabled:opacity-50"
        >
          決めた理由を残す
        </button>
        <button
          type="button"
          onClick={handleSkipAll}
          disabled={saving}
          className="min-h-11 text-sm text-muted-foreground underline disabled:opacity-50"
        >
          {saving ? "記録しています..." : "スキップ"}
        </button>
      </div>
    );
  }

  // Phase: reason
  return (
    <div className="space-y-6 py-8">
      <h2 className="text-center text-lg">決め手を教えてください</h2>
      <div className="flex flex-wrap justify-center gap-2">
        {REASON_TAGS.map((tag) => (
          <button
            key={tag}
            type="button"
            onClick={() =>
              setSelectedTags((prev) =>
                prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
              )
            }
            className={`inline-flex min-h-11 items-center justify-center rounded-full border px-4 py-2.5 text-sm transition-colors active:scale-95 ${
              selectedTags.includes(tag)
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card"
            }`}
          >
            {tag}
          </button>
        ))}
      </div>
      <textarea
        value={reasonText}
        onChange={(e) => setReasonText(e.target.value)}
        placeholder="この式場にした理由を一言で"
        className="w-full rounded-lg border border-border bg-card p-3 text-sm"
        rows={3}
      />
      <div className="flex justify-center gap-3">
        <button
          type="button"
          onClick={() => handleSaveReason()}
          disabled={saving}
          className="min-h-11 rounded-lg bg-primary px-6 py-3 text-primary-foreground disabled:opacity-50"
        >
          {saving ? "記録しています..." : "この想いを残す"}
        </button>
        <button
          type="button"
          onClick={handleSkipAll}
          disabled={saving}
          className="min-h-11 text-sm text-muted-foreground underline disabled:opacity-50"
        >
          スキップ
        </button>
      </div>
    </div>
  );
}
