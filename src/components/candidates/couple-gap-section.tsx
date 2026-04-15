import Link from "next/link";
import Image from "next/image";
import { Heart, HeartCrack, Sparkles } from "lucide-react";
import { getCoupleOverview } from "@/server/actions/couple-view";
import { cn } from "@/lib/utils";

/**
 * E-4 Couple View: 温度差リスト。
 * ふたりで使っているプロジェクトのみ表示 (hasPartner && gaps.length > 0)。
 */
export async function CoupleGapSection() {
  const overview = await getCoupleOverview();
  if (!overview.hasPartner) return null;
  if (overview.gaps.length === 0 && overview.bothCount === 0) return null;

  return (
    <section className="space-y-3">
      <header className="flex items-baseline gap-2">
        <Sparkles
          aria-hidden="true"
          className="h-3.5 w-3.5 text-[color:var(--gold-warm)]"
          strokeWidth={1.8}
        />
        <h2 className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
          ふたりの温度
        </h2>
      </header>

      {overview.bothCount > 0 && (
        <div
          className="rounded-2xl p-4"
          style={{
            background:
              "linear-gradient(135deg, color-mix(in oklab, var(--gold-warm) 8%, var(--background)) 0%, color-mix(in oklab, var(--primary) 5%, var(--background)) 100%)",
          }}
        >
          <div className="flex items-center gap-2">
            <Heart
              aria-hidden="true"
              className="h-4 w-4 text-[color:var(--gold-warm)]"
              strokeWidth={2}
              fill="currentColor"
            />
            <p className="font-[family-name:var(--font-display)] text-[15px] font-light">
              ふたりとも気になる {overview.bothCount} 件
            </p>
          </div>
          <p className="mt-1.5 text-[11.5px] text-muted-foreground leading-relaxed">
            ここからスタートすれば、意見がぶつからずに進められます。
          </p>
        </div>
      )}

      {overview.gaps.length > 0 && (
        <div className="space-y-2">
          <p className="text-[11.5px] text-muted-foreground leading-relaxed">
            気持ちがずれている {overview.gaps.length} 件。
            <span className="ml-0.5 text-foreground">
              どこが違うかを話してみる
            </span>
            と、選びやすくなります。
          </p>
          <ul className="space-y-1.5">
            {overview.gaps.slice(0, 5).map((g) => {
              const onlyMe = g.likedByMe && !g.likedByPartner;
              const whoLabel = onlyMe
                ? `${overview.meName ?? "あなた"}だけ`
                : `${overview.partnerName ?? "パートナー"}だけ`;
              return (
                <li key={g.venueId}>
                  <Link
                    href={`/venues/${g.venueId}`}
                    prefetch={false}
                    className="flex items-center gap-3 rounded-xl border bg-card p-2.5 pr-3 transition active:scale-[0.99]"
                  >
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                      {g.photoUrl ? (
                        <Image
                          src={g.photoUrl}
                          alt=""
                          fill
                          sizes="48px"
                          className="object-cover"
                        />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-[family-name:var(--font-display)] text-[13.5px] font-light">
                        {g.venueName}
                      </p>
                      <p className="mt-0.5 truncate text-[10.5px] text-muted-foreground">
                        {g.location ?? ""}
                      </p>
                    </div>
                    <span
                      className={cn(
                        "flex shrink-0 items-center gap-1 rounded-full border px-2 py-0.5 text-[10px]",
                        onlyMe
                          ? "border-[color-mix(in_oklab,var(--primary)_35%,transparent)] text-[color:var(--primary)]"
                          : "border-border text-muted-foreground",
                      )}
                    >
                      <HeartCrack
                        aria-hidden="true"
                        className="h-2.5 w-2.5"
                        strokeWidth={2}
                      />
                      {whoLabel}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </section>
  );
}
