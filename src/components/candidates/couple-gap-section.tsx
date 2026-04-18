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
    <section className="space-y-4">
      {/* C-1: editorial eyebrow + 明朝 17px 2 段構造 */}
      <header className="space-y-1">
        <div className="flex items-center gap-1.5">
          <Sparkles
            aria-hidden="true"
            className="h-4 w-4 text-[color:var(--gold-warm)]"
            strokeWidth={1.6}
          />
          <p className="text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            Couple Gap
          </p>
        </div>
        <h2 className="font-[family-name:var(--font-display)] text-[17px] font-light leading-snug tracking-[0.01em]">
          ふたりの温度
        </h2>
      </header>

      {overview.bothCount > 0 && (
        <div
          className="rounded-2xl border bg-card p-4"
          style={{
            borderLeftWidth: "3px",
            borderLeftColor: "var(--gold-warm)",
            borderColor:
              "color-mix(in oklab, var(--gold-warm) 22%, transparent)",
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
              ふたりとも気になる{" "}
              <span className="tabular-nums">{overview.bothCount}</span> 件
            </p>
          </div>
          <p className="mt-1.5 text-[12px] text-muted-foreground leading-relaxed">
            ここからスタートすれば、意見がぶつからずに進められます。
          </p>
        </div>
      )}

      {/* C-2: gap カード typography 整理 */}
      {overview.gaps.length > 0 && (
        <div className="space-y-2">
          <p className="text-[12px] text-muted-foreground leading-relaxed">
            気持ちがずれている{" "}
            <span className="tabular-nums text-foreground">{overview.gaps.length}</span> 件。
            <span className="ml-0.5">
              どこが違うかを話してみる
            </span>
            と、選びやすくなります。
          </p>
          <ul className="space-y-2">
            {overview.gaps.slice(0, 5).map((g) => {
              const onlyMe = g.likedByMe && !g.likedByPartner;
              const whoLabel = onlyMe
                ? `${overview.meName ?? "あなた"}だけ`
                : `${overview.partnerName ?? "パートナー"}だけ`;
              return (
                <li key={g.venueId}>
                  <Link
                    href={`/venues/${g.venueId}`}
                    className="flex items-center gap-3 rounded-xl border bg-card p-3 pr-3.5 transition active:scale-[0.99]"
                  >
                    {/* C-2: thumb 48→48 (維持), rounded-lg → rounded-xl */}
                    <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-muted">
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
                      {/* C-2: venue 名 Noto Serif JP 14px light */}
                      <p className="truncate font-[family-name:var(--font-display)] text-[14px] font-light">
                        {g.venueName}
                      </p>
                      {/* C-2: location 11px */}
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
                        {g.location ?? ""}
                      </p>
                    </div>
                    {/* C-2: chip に面色追加 + HeartCrack 12px */}
                    <span
                      className={cn(
                        "flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px]",
                        onlyMe
                          ? "bg-[color-mix(in_oklab,var(--primary)_8%,transparent)] text-[color:var(--primary)]"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      <HeartCrack
                        aria-hidden="true"
                        className="h-3 w-3"
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
