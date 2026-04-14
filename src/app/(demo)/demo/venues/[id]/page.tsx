"use client";

import { use } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Star, Heart, Sparkles, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDemoData } from "@/components/demo/demo-data-provider";
import { motion } from "framer-motion";

// /demo/venues/[id] — mock venue detail page.
// Reads from the demo provider by id; shows photo, rating, price, style tags,
// personalized chips, reviews, and (if available) estimate breakdown + visit.
export default function DemoVenueDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { getVenue, favorites, toggleFavorite, estimates, visits } = useDemoData();
  const venue = getVenue(id);

  if (!venue) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-muted-foreground">
          式場が見つかりませんでした。
        </p>
        <Link
          href="/demo/venues"
          className="mt-4 inline-flex h-11 items-center gap-1 rounded-full border border-border px-5 text-sm"
        >
          一覧に戻る
        </Link>
      </div>
    );
  }

  const isFavorite = favorites.has(venue.id);
  const estimate = estimates[venue.id];
  const visit = visits.find((v) => v.venueId === venue.id);
  const priceLabel = `${(venue.costMin / 10000).toFixed(0)}〜${(venue.costMax / 10000).toFixed(0)}万円`;

  return (
    <div className="space-y-6">
      {/* Back link */}
      <button
        type="button"
        onClick={() => router.back()}
        className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        戻る
      </button>

      {/* Hero photo */}
      <div className="relative aspect-[3/2] w-full overflow-hidden rounded-[var(--r-lg)] bg-muted">
        {venue.photoUrls[0] ? (
          <Image
            src={venue.photoUrls[0]}
            alt={venue.name}
            fill
            sizes="(max-width: 768px) 100vw, 800px"
            className="object-cover"
            unoptimized
            priority
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-[var(--gold-subtle)]/50 text-[var(--gold-warm)]">
            <span className="font-serif text-2xl">{venue.name}</span>
          </div>
        )}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black/45 to-transparent" />
        {venue.rating !== null && (
          <div className="absolute left-3 bottom-3 flex items-center gap-1 rounded-full bg-black/40 px-2.5 py-1 backdrop-blur-sm">
            <Star className="h-3.5 w-3.5 fill-[var(--gold-warm)] text-[var(--gold-warm)]" />
            <span className="tabular-nums text-sm font-normal text-white">
              {venue.rating.toFixed(1)}
            </span>
          </div>
        )}
        <div className="absolute right-3 top-3">
          <motion.button
            type="button"
            onClick={() => toggleFavorite(venue.id)}
            aria-pressed={isFavorite}
            aria-label={isFavorite ? "お気に入りから外す" : "お気に入りに追加"}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-card/80 backdrop-blur-sm transition-[background-color] duration-200 hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--gold-warm)] focus-visible:ring-offset-2"
            whileTap={{ scale: 1.15 }}
            transition={{ type: "spring", stiffness: 200, damping: 12 }}
          >
            <Heart
              className={cn(
                "h-5 w-5 transition-colors duration-200",
                isFavorite ? "fill-primary text-primary" : "fill-none text-primary/70",
              )}
            />
          </motion.button>
        </div>
      </div>

      {/* Header */}
      <header className="space-y-2">
        <p className="text-eyebrow tabular-nums text-[var(--gold-warm)]">{priceLabel}</p>
        <h1 className="font-serif text-3xl font-extralight tracking-[-0.01em]">
          {venue.name}
        </h1>
        <p className="text-meta text-muted-foreground">
          {venue.location} · {venue.accessInfo} · 着席{venue.capacityMin}〜{venue.capacityMax}名
        </p>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {venue.ceremonyStyles.map((s) => (
            <span
              key={s}
              className="rounded-full bg-muted px-2.5 py-1 text-meta text-muted-foreground"
            >
              {s}
            </span>
          ))}
        </div>
      </header>

      {/* Personalized chips */}
      <section
        aria-labelledby="personalized-heading"
        className="rounded-xl border-l-[3px] border-l-[var(--gold-warm)] bg-[var(--gold-subtle)] p-4"
      >
        <h2
          id="personalized-heading"
          className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.06em] text-[var(--gold-warm)]"
        >
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          おふたりへのマッチ
        </h2>
        <div className="flex flex-wrap gap-1.5">
          {venue.personalizedChips.map((chip) => (
            <span
              key={chip}
              className="rounded-full bg-card px-3 py-1 text-xs text-foreground shadow-sm"
            >
              {chip}
            </span>
          ))}
        </div>
      </section>

      {/* Estimate */}
      {estimate && (
        <section
          aria-labelledby="estimate-heading"
          className="rounded-[var(--r-lg)] border border-border/60 bg-card p-6 shadow-[var(--shadow-card)]"
        >
          <h2 id="estimate-heading" className="mb-4 font-serif text-xl font-extralight">
            見積もり
          </h2>
          <div className="mb-4 flex items-baseline justify-between border-b border-border/40 pb-3">
            <span className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
              初回見積もり
            </span>
            <span className="tabular-nums text-lg font-medium text-foreground">
              ¥{estimate.total.toLocaleString()}
            </span>
          </div>
          <div className="mb-5 flex items-baseline justify-between">
            <span className="text-xs uppercase tracking-[0.08em] text-[var(--gold-warm)]">
              AI予測 最終額
            </span>
            <span className="tabular-nums text-lg font-medium text-[var(--gold-warm)]">
              ¥{estimate.predictedFinal.toLocaleString()}
            </span>
          </div>
          <ul className="space-y-2">
            {estimate.items.map((item) => (
              <li
                key={item.itemName}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-muted-foreground">{item.itemName}</span>
                <span className="tabular-nums text-foreground">
                  ¥{item.amount.toLocaleString()}
                  {item.predictedUpgrade > 0 && (
                    <span className="ml-2 text-xs text-[var(--gold-warm)]">
                      +¥{item.predictedUpgrade.toLocaleString()}見込
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Visit */}
      {visit && (
        <section
          aria-labelledby="visit-heading"
          className="rounded-[var(--r-lg)] border border-border/60 bg-card p-6 shadow-[var(--shadow-card)]"
        >
          <h2 id="visit-heading" className="mb-1 font-serif text-xl font-extralight">
            見学記録
          </h2>
          <p className="mb-4 text-xs text-muted-foreground">{visit.visitedAt}</p>
          <ul className="mb-4 space-y-2">
            {visit.checklist.map((c) => (
              <li key={c.label} className="flex items-center gap-2 text-sm">
                {c.status === "good" && (
                  <CheckCircle2 className="h-4 w-4 text-[var(--gold-warm)]" aria-hidden="true" />
                )}
                {c.status === "concern" && (
                  <AlertCircle className="h-4 w-4 text-orange-500" aria-hidden="true" />
                )}
                {c.status === "unchecked" && (
                  <span
                    aria-hidden="true"
                    className="inline-block h-4 w-4 rounded-full border border-border"
                  />
                )}
                <span
                  className={cn(
                    c.status === "unchecked" ? "text-muted-foreground" : "text-foreground",
                  )}
                >
                  {c.label}
                </span>
              </li>
            ))}
          </ul>
          <p className="rounded-lg bg-muted p-3 text-sm leading-relaxed text-foreground">
            {visit.note}
          </p>
        </section>
      )}

      {/* Reviews */}
      {venue.reviews.length > 0 && (
        <section
          aria-labelledby="reviews-heading"
          className="rounded-[var(--r-lg)] border border-border/60 bg-card p-6 shadow-[var(--shadow-card)]"
        >
          <h2 id="reviews-heading" className="mb-4 font-serif text-xl font-extralight">
            口コミ
          </h2>
          <ul className="space-y-4">
            {venue.reviews.map((r) => (
              <li key={r.id} className="border-b border-border/40 pb-4 last:border-0 last:pb-0">
                <div className="mb-1 flex items-center gap-2">
                  <Star className="h-3.5 w-3.5 fill-[var(--gold-warm)] text-[var(--gold-warm)]" />
                  <span className="tabular-nums text-sm">{r.rating.toFixed(1)}</span>
                  <span className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
                    · {r.source}
                  </span>
                </div>
                <p className="text-sm font-medium text-foreground">{r.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{r.body}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Signup CTA at bottom */}
      <div className="rounded-[var(--r-lg)] border border-[var(--gold-warm)]/30 bg-[var(--gold-subtle)] p-6 text-center">
        <p className="mb-3 text-sm text-foreground">
          気に入った式場があれば、実際に登録して比較できます。
        </p>
        <Link
          href="/signup"
          className="inline-flex h-11 items-center gap-1 rounded-full bg-primary px-6 text-sm font-medium text-primary-foreground shadow-sm transition-[transform,box-shadow] duration-200 hover:shadow-md active:scale-[0.97]"
        >
          無料ではじめる
        </Link>
      </div>
    </div>
  );
}
