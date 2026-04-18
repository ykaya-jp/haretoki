"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { DemoVenueCard } from "@/components/demo/demo-venue-card";
import { useDemoData } from "@/components/demo/demo-data-provider";

// /demo/candidates — shows favorited venues + a simple comparison tab.
// Tabs are local state (list | compare); comparison renders key fields
// side-by-side for the favorited venues (2 by default in the demo dataset).
export default function DemoCandidatesPage() {
  const { venues, favorites, estimates } = useDemoData();
  const [tab, setTab] = useState<"list" | "compare">("list");

  const favoriteVenues = venues.filter((v) => favorites.has(v.id));

  return (
    <div className="space-y-6">
      <header className="space-y-1 pt-2">
        <h1 className="font-[family-name:var(--font-display)] text-3xl font-extralight tracking-[-0.01em]">
          候補
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          お気に入りに追加した式場を、ここで見比べられます。
        </p>
      </header>

      {/* Tabs */}
      <div role="tablist" aria-label="候補ビュー切替" className="flex gap-1 rounded-full bg-muted p-1">
        {(
          [
            { key: "list", label: "一覧" },
            { key: "compare", label: "比較" },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "flex-1 rounded-full px-4 py-2 text-sm transition-colors duration-200",
              tab === t.key
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {favoriteVenues.length === 0 ? (
        <div className="rounded-[var(--r-lg)] border border-dashed border-border/60 bg-card/40 p-10 text-center">
          <p className="text-sm text-muted-foreground">
            お気に入りがまだありません。
            <br />
            「探す」タブからハートをタップして追加してみてください。
          </p>
        </div>
      ) : tab === "list" ? (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          {favoriteVenues.map((v) => (
            <DemoVenueCard key={v.id} venue={v} />
          ))}
        </div>
      ) : (
        <section
          aria-label="比較ボード"
          className="overflow-x-auto rounded-[var(--r-lg)] border border-border/60 bg-card shadow-[var(--shadow-card)]"
        >
          <table className="w-full min-w-[520px] text-left text-sm">
            <thead>
              <tr className="border-b border-border/60">
                <th className="p-4 text-xs uppercase tracking-[0.08em] text-muted-foreground">
                  項目
                </th>
                {favoriteVenues.map((v) => (
                  <th
                    key={v.id}
                    className="p-4 font-[family-name:var(--font-display)] text-base font-extralight text-foreground"
                  >
                    {v.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="tabular-nums">
              <tr className="border-b border-border/40">
                <td className="p-4 text-xs uppercase tracking-[0.08em] text-muted-foreground">
                  エリア
                </td>
                {favoriteVenues.map((v) => (
                  <td key={v.id} className="p-4">
                    {v.location}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-border/40">
                <td className="p-4 text-xs uppercase tracking-[0.08em] text-muted-foreground">
                  価格帯
                </td>
                {favoriteVenues.map((v) => (
                  <td key={v.id} className="p-4 text-[var(--gold-warm)]">
                    {(v.costMin / 10000).toFixed(0)}〜{(v.costMax / 10000).toFixed(0)}万円
                  </td>
                ))}
              </tr>
              <tr className="border-b border-border/40">
                <td className="p-4 text-xs uppercase tracking-[0.08em] text-muted-foreground">
                  着席人数
                </td>
                {favoriteVenues.map((v) => (
                  <td key={v.id} className="p-4">
                    {v.capacityMin}〜{v.capacityMax}名
                  </td>
                ))}
              </tr>
              <tr className="border-b border-border/40">
                <td className="p-4 text-xs uppercase tracking-[0.08em] text-muted-foreground">
                  挙式スタイル
                </td>
                {favoriteVenues.map((v) => (
                  <td key={v.id} className="p-4">
                    {v.ceremonyStyles.join(" · ")}
                  </td>
                ))}
              </tr>
              <tr className="border-b border-border/40">
                <td className="p-4 text-xs uppercase tracking-[0.08em] text-muted-foreground">
                  評価
                </td>
                {favoriteVenues.map((v) => (
                  <td key={v.id} className="p-4">
                    {v.rating !== null ? (
                      <span className="inline-flex items-center gap-1">
                        <Star className="h-4 w-4 fill-[var(--gold-warm)] text-[var(--gold-warm)]" />
                        {v.rating.toFixed(1)}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="p-4 text-xs uppercase tracking-[0.08em] text-muted-foreground">
                  AI予測最終額
                </td>
                {favoriteVenues.map((v) => {
                  const est = estimates[v.id];
                  return (
                    <td key={v.id} className="p-4 text-[var(--gold-warm)]">
                      {est ? `¥${est.predictedFinal.toLocaleString()}` : "—"}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </section>
      )}
    </div>
  );
}
