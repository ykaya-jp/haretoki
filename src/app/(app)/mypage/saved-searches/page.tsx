import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Bookmark, Search } from "lucide-react";
import {
  listSavedSearches,
  matchesSavedSearchCount,
} from "@/server/actions/saved-searches";
import { SavedSearchDeleteButton } from "@/components/mypage/saved-search-delete-button";
import { EmptyState } from "@/components/ui/empty-state";
import type { SavedSearchFilters } from "@/lib/schemas";

export const metadata: Metadata = {
  title: "保存した検索条件",
  description: "保存した検索条件と、現在の一致件数を確認できます。",
};

function buildExploreUrl(filters: SavedSearchFilters): string {
  const params = new URLSearchParams();
  if (filters.keyword) params.set("q", filters.keyword);
  if (filters.area && filters.area.length > 0) {
    filters.area.forEach((a) => params.append("areas", a));
  }
  if (filters.budgetMax !== undefined)
    params.set("budgetMax", String(filters.budgetMax));
  if (filters.capacityMin !== undefined)
    params.set("guestCount", String(filters.capacityMin));
  if (filters.vibeTags && filters.vibeTags.length > 0) {
    filters.vibeTags.forEach((t) => params.append("styles", t));
  }
  const qs = params.toString();
  return qs ? `/explore?${qs}` : "/explore";
}

function FilterPreview({ filters }: { filters: SavedSearchFilters }) {
  const parts: string[] = [];
  if (filters.area && filters.area.length > 0)
    parts.push(filters.area.join("・"));
  if (filters.budgetMax !== undefined)
    parts.push(`${filters.budgetMax.toLocaleString()}円以下`);
  if (filters.capacityMin !== undefined)
    parts.push(`${filters.capacityMin}人以上`);
  if (filters.vibeTags && filters.vibeTags.length > 0)
    parts.push(filters.vibeTags.join("・"));
  if (filters.keyword) parts.push(`「${filters.keyword}」`);
  if (parts.length === 0) return <span>すべての条件</span>;
  return <span>{parts.join(" ／ ")}</span>;
}

async function SavedSearchCard({
  id,
  label,
  filters,
}: {
  id: string;
  label: string;
  filters: SavedSearchFilters;
}) {
  const count = await matchesSavedSearchCount(id);
  const exploreUrl = buildExploreUrl(filters);

  return (
    <div className="group relative flex items-start gap-3 rounded-2xl bg-card p-4 shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-card-hover)]">
      {/* Full-card tap target — behind interactive children */}
      <Link
        href={exploreUrl}
        prefetch={false}
        aria-label={`${label} の検索結果を見る（${count}件該当）`}
        className="absolute inset-0 rounded-2xl"
      />
      {/* Bookmark icon well */}
      <div className="relative mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[color-mix(in_oklab,var(--gold-warm)_25%,transparent)] bg-background">
        <Bookmark
          className="h-4 w-4 text-[color-mix(in_oklab,var(--gold-warm)_70%,var(--muted-foreground))]"
          strokeWidth={1.6}
        />
      </div>
      {/* Content — pointer-events-none so the absolute link captures taps */}
      <div className="relative min-w-0 flex-1 pointer-events-none">
        <p className="font-[family-name:var(--font-display)] font-light text-base leading-snug tracking-wide">
          {label}
        </p>
        <p className="mt-0.5 text-xs text-muted-foreground leading-relaxed">
          <FilterPreview filters={filters} />
        </p>
        <p className="mt-2 inline-flex items-center gap-1 text-xs text-primary">
          <Search className="h-3 w-3" strokeWidth={1.8} />
          <span className="tabular-nums">{count}件該当</span>
        </p>
      </div>
      {/* Delete button — z-index above the card link */}
      <div className="relative">
        <SavedSearchDeleteButton id={id} />
      </div>
    </div>
  );
}

export default async function SavedSearchesPage() {
  const searches = await listSavedSearches();

  return (
    <div className="space-y-10">
      <div>
        <p className="flex flex-wrap items-center gap-2 text-[11.5px] tracking-[0.2em] uppercase text-muted-foreground">
          <Link
            href="/mypage"
            prefetch={false}
            className="inline-flex min-h-11 items-center gap-1 hover:opacity-70"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" strokeWidth={1.6} />
            Back
          </Link>
          <span aria-hidden="true" className="opacity-30">/</span>
          <span className="font-medium text-[var(--gold-warm)]">HARETOKI</span>
          <span aria-hidden="true" className="opacity-30">·</span>
          <span>Saved</span>
        </p>
        <h1 className="mt-2 text-h1 font-[family-name:var(--font-display)] font-light tracking-[-0.01em]">
          保存した検索条件
        </h1>
        <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted-foreground">
          条件にあう新しい式場が出会ったら、そっとお知らせします。
        </p>
      </div>

      {searches.length === 0 ? (
        <EmptyState
          icon={Bookmark}
          title="これから、検索のしおりを集めましょう"
          description="「式場をさがす」で条件をしぼったら、その条件をそっと残しておけます。新しい式場が届いたら、通知でお知らせします。"
          action={{ href: "/explore", label: "式場をさがす" }}
        />
      ) : (
        <div className="space-y-4">
          {searches.map((s) => (
            <SavedSearchCard
              key={s.id}
              id={s.id}
              label={s.label}
              filters={s.filters}
            />
          ))}
          <p className="pt-4 text-center text-[10.5px] font-medium tracking-[0.2em] uppercase text-muted-foreground tabular-nums">
            {searches.length} / 5 — 最大 5 件
          </p>
        </div>
      )}
    </div>
  );
}
