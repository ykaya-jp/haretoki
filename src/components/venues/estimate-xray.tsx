interface EstimateXRayProps {
  items: Array<{
    category: string;
    itemName: string;
    amount: number;
    tier: string;
    predictedUpgrade: number | null;
    upgradeProbability: number | null;
  }>;
  totalEstimate: number;
  predictedFinal: number | null;
}

const CATEGORY_ICONS: Record<string, string> = {
  attire: "\u{1F457}",
  cuisine: "\u{1F37D}",
  photo_video: "\u{1F4F8}",
  flowers: "\u{1F490}",
  performance: "\u{1F3AD}",
  av_equipment: "\u{1F50A}",
  venue_fee: "\u{1F3DB}",
  other: "\u{1F4CB}",
};

export function EstimateXRay({ items, totalEstimate, predictedFinal }: EstimateXRayProps) {
  const riskyItems = items
    .filter(
      (item) =>
        (item.tier === "minimum" || item.tier === "unknown") &&
        item.upgradeProbability != null &&
        Number(item.upgradeProbability) > 0.3
    )
    .sort((a, b) => Number(b.upgradeProbability ?? 0) - Number(a.upgradeProbability ?? 0));

  const finalAmount = predictedFinal ?? totalEstimate;
  const difference = finalAmount - totalEstimate;

  return (
    <div className="space-y-4 rounded-xl border-l-[3px] border-l-[var(--gold-warm)] bg-[var(--gold-subtle)] p-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className="text-lg">{"\u{1F4A1}"}</span>
        <h3 className="text-sm font-medium text-[var(--gold-warm)]">見積もりX線</h3>
      </div>

      {/* Summary — display-scale numerals for main amounts */}
      <div className="space-y-3">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs text-muted-foreground">初期見積もり</span>
          <span className="flex items-baseline gap-0.5">
            <span className="text-[11px] text-muted-foreground">¥</span>
            <span className="font-serif font-extralight tabular-nums text-3xl leading-none tracking-tight text-foreground">
              {(totalEstimate / 10000).toFixed(0)}
            </span>
            <span className="text-[11px] text-muted-foreground">万</span>
          </span>
        </div>
        {predictedFinal && (
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs text-muted-foreground">予測最終額</span>
            <span className="flex items-baseline gap-0.5">
              <span className="text-[11px] text-muted-foreground">¥</span>
              <span className="font-serif font-extralight tabular-nums text-3xl leading-none tracking-tight text-foreground">
                {(predictedFinal / 10000).toFixed(0)}
              </span>
              <span className="text-[11px] text-muted-foreground">万</span>
            </span>
          </div>
        )}
        {difference > 0 && (
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-xs text-amber-600">予測上昇額</span>
            <span className="flex items-baseline gap-0.5 text-amber-600">
              <span className="text-[11px]">+¥</span>
              <span className="font-serif font-extralight tabular-nums text-3xl leading-none tracking-tight">
                {(difference / 10000).toFixed(0)}
              </span>
              <span className="text-[11px]">万</span>
            </span>
          </div>
        )}
      </div>

      {/* Risky items */}
      {riskyItems.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground">{"\u26A0"} 上がりやすい項目</p>
          {riskyItems.map((item) => {
            const prob = Number(item.upgradeProbability ?? 0) * 100;
            const icon = CATEGORY_ICONS[item.category] ?? "\u{1F4CB}";
            return (
              <div key={item.itemName} className="space-y-1.5 rounded-lg bg-card p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">
                    {icon} {item.itemName}
                  </span>
                  <span className="tabular-nums text-sm">&yen;{item.amount.toLocaleString()}</span>
                </div>
                {item.tier === "minimum" && (
                  <p className="text-xs text-amber-600">
                    最低ランク &rarr; +&yen;{(item.predictedUpgrade ?? 0).toLocaleString()}想定
                  </p>
                )}
                <div className="flex items-center gap-2">
                  <div className="h-1.5 flex-1 rounded-full bg-muted">
                    <div
                      className="h-1.5 rounded-full bg-amber-500"
                      style={{ width: `${Math.min(prob, 100)}%` }}
                    />
                  </div>
                  <span className="tabular-nums text-xs text-muted-foreground">
                    {prob.toFixed(0)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Feature description */}
      <p className="text-xs leading-relaxed text-muted-foreground">
        見積もりの差分を、項目ごとに把握できます。アップグレードになりやすい箇所を事前に確認しておきましょう。
      </p>
    </div>
  );
}
