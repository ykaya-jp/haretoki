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

      {/* Summary */}
      <div className="space-y-1">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">初期見積もり</span>
          <span className="tabular-nums">&yen;{totalEstimate.toLocaleString()}</span>
        </div>
        {predictedFinal && (
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">予測最終額</span>
            <span className="tabular-nums font-medium text-foreground">
              &yen;{predictedFinal.toLocaleString()}
            </span>
          </div>
        )}
        {difference > 0 && (
          <div className="flex justify-between text-sm">
            <span className="text-amber-600">予測上昇額</span>
            <span className="tabular-nums font-medium text-amber-600">
              +&yen;{difference.toLocaleString()}
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

      {/* Trust signal */}
      <p className="text-xs leading-relaxed text-muted-foreground">
        80%のカップルが初期見積もりより平均+100万円上がっています。事前に把握しておきましょう。
      </p>
    </div>
  );
}
