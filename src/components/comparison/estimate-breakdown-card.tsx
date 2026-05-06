import { JapaneseYen, Trophy } from "lucide-react";
import type {
  EstimateBreakdownComparison,
  EstimateGroup,
} from "@/lib/estimate-breakdown-types";

const formatMan = (yen: number) =>
  yen >= 10000
    ? `${Math.round(yen / 10000).toLocaleString("ja-JP")}万`
    : yen.toLocaleString("ja-JP");

const TIER_DOT: Record<string, string> = {
  minimum: "border-muted-foreground/30",
  standard: "border-[var(--gold-warm)]/40",
  premium: "border-[var(--gold-warm)]",
  unknown: "border-transparent",
};

/**
 * Cross-venue estimate breakdown — every item line stacked horizontally
 * across the compared venues. Each row is one item (e.g. ドレス代),
 * each column one venue. The cheapest non-null cell per row gets a
 * gold underline so couples can scan for savings without doing math.
 *
 * Self-hides when no venue has any estimate items.
 */
export function EstimateBreakdownCard({
  data,
  matrixVenueIdsToNames,
}: {
  data: EstimateBreakdownComparison;
  matrixVenueIdsToNames: Record<string, string>;
}) {
  if (data.venueIds.length === 0 || data.groups.length === 0) return null;

  const venueIds = data.venueIds;
  const venueColCount = venueIds.length;

  return (
    <section
      aria-label="費用の内訳を比べる"
      className="rounded-2xl border border-border bg-card p-4 sm:p-5"
    >
      <div className="flex items-center gap-2">
        <JapaneseYen
          className="h-4 w-4 text-[var(--gold-warm)]"
          strokeWidth={1.6}
          aria-hidden="true"
        />
        <p className="text-eyebrow text-[var(--gold-warm)]">費用の内訳を比べる</p>
      </div>
      <p className="mt-2 text-fluid-xs leading-relaxed text-muted-foreground">
        項目ごとに横並び。最も安い欄に gold の下線がつきます。
      </p>

      {/* Horizontal scroll wrapper — keeps the label column readable on
          375px even when 3 venue columns push past the viewport. */}
      <div className="mt-4 -mx-4 overflow-x-auto sm:-mx-5">
        <table className="w-full min-w-[480px] border-separate border-spacing-y-2 px-4 sm:px-5">
          <thead>
            <tr>
              <th
                scope="col"
                className="sticky left-0 z-10 w-[40%] bg-card pr-2 text-left align-bottom text-fluid-xs font-medium text-muted-foreground"
              >
                項目
              </th>
              {venueIds.map((id) => (
                <th
                  key={id}
                  scope="col"
                  className="px-2 text-right align-bottom text-fluid-xs font-medium text-foreground"
                >
                  <span className="line-clamp-2 font-[family-name:var(--font-display)] font-light leading-tight">
                    {matrixVenueIdsToNames[id] ?? "式場"}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.groups.map((group) => (
              <CategoryRows
                key={group.category}
                group={group}
                venueIds={venueIds}
                venueColCount={venueColCount}
              />
            ))}
            {/* Grand total row */}
            <tr>
              <td
                colSpan={venueColCount + 1}
                className="pt-3 text-fluid-xs uppercase tracking-[0.16em] text-muted-foreground"
              >
                合計
              </td>
            </tr>
            <tr>
              <th
                scope="row"
                className="sticky left-0 z-10 bg-card pr-2 text-left text-fluid-sm font-light text-foreground"
              >
                総額目安
              </th>
              {venueIds.map((id) => {
                const total = data.grandTotalByVenueId[id] ?? 0;
                const isCheapestTotal =
                  total > 0 &&
                  total ===
                    Math.min(
                      ...venueIds
                        .map((vid) => data.grandTotalByVenueId[vid] ?? 0)
                        .filter((n) => n > 0),
                    );
                return (
                  <td
                    key={id}
                    className="px-2 text-right text-fluid-base font-light tabular-nums"
                  >
                    <span
                      className={
                        isCheapestTotal
                          ? "border-b-2 border-[var(--gold-warm)] pb-0.5 text-[var(--gold-warm)]"
                          : "text-foreground"
                      }
                    >
                      {total > 0 ? `${formatMan(total)}円` : "—"}
                    </span>
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>

      {/* Tier legend (shown once, below the table) */}
      <div className="mt-3 flex flex-wrap items-center gap-3 text-fluid-xs text-muted-foreground">
        <span>tier:</span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full border-2 border-muted-foreground/30" />
          minimum
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full border-2 border-[var(--gold-warm)]/40" />
          standard
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block h-2 w-2 rounded-full border-2 border-[var(--gold-warm)]" />
          premium
        </span>
      </div>
    </section>
  );
}

function CategoryRows({
  group,
  venueIds,
  venueColCount,
}: {
  group: EstimateGroup;
  venueIds: string[];
  venueColCount: number;
}) {
  return (
    <>
      <tr>
        <td
          colSpan={venueColCount + 1}
          className="pt-2 text-fluid-xs uppercase tracking-[0.16em] text-[var(--gold-warm)]"
        >
          {group.label}
        </td>
      </tr>
      {group.rows.map((row) => (
        <tr key={`${group.category}:${row.itemName}`}>
          <th
            scope="row"
            className="sticky left-0 z-10 bg-card pr-2 text-left text-fluid-xs font-normal text-foreground"
          >
            {row.itemName}
          </th>
          {venueIds.map((id) => {
            const cell = row.cellsByVenueId[id];
            if (!cell) {
              return (
                <td
                  key={id}
                  className="px-2 text-right text-fluid-xs text-muted-foreground/50"
                >
                  —
                </td>
              );
            }
            return (
              <td
                key={id}
                className="px-2 text-right text-fluid-xs tabular-nums"
              >
                <span className="inline-flex items-center gap-1">
                  <span
                    aria-hidden="true"
                    className={`h-1.5 w-1.5 rounded-full border ${TIER_DOT[cell.tier] ?? TIER_DOT.unknown}`}
                  />
                  <span
                    className={
                      cell.isCheapest
                        ? "border-b border-[var(--gold-warm)] pb-px text-[var(--gold-warm)]"
                        : "text-foreground"
                    }
                  >
                    {formatMan(cell.amount)}
                  </span>
                </span>
              </td>
            );
          })}
        </tr>
      ))}
      {/* Subtotal row */}
      <tr>
        <th
          scope="row"
          className="sticky left-0 z-10 bg-card pr-2 text-left text-fluid-xs font-medium text-muted-foreground"
        >
          {group.label} 小計
        </th>
        {venueIds.map((id) => {
          const sub = group.subtotalByVenueId[id] ?? 0;
          const isCheapest = id === group.cheapestSubtotalVenueId;
          return (
            <td
              key={id}
              className="px-2 text-right text-fluid-xs font-medium tabular-nums"
            >
              <span
                className={
                  isCheapest
                    ? "inline-flex items-baseline gap-0.5 border-b border-[var(--gold-warm)] pb-px text-[var(--gold-warm)]"
                    : "text-foreground"
                }
              >
                {isCheapest && sub > 0 && (
                  <Trophy
                    className="h-3 w-3 self-center"
                    strokeWidth={1.6}
                    aria-label="この内訳で最安"
                  />
                )}
                {sub > 0 ? `${formatMan(sub)}` : "—"}
              </span>
            </td>
          );
        })}
      </tr>
    </>
  );
}
