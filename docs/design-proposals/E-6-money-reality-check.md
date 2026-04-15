# E-6 Money Reality Check — 見積もりの落とし穴を先回り

**モック**: [mockups/e-6-money-reality-check.html](../mockups/e-6-money-reality-check.html)
**優先度**: H
**関連**: 見積もり離脱の最大要因、商用差別化、既存 EstimateXRay の強化

---

## What

見積もり入力画面（Estimate）と venue 詳細ページに、AI が自動検知した **「上がりやすい項目」「既に抜けている項目」「交渉余地」** を 3 カード構造で提示する Insight Panel。

### 提示する 3 種の警告

**1. 🟡 抜けている項目**（黄カード）
- 「持込料」「キャンセル料」「土日追加料金」「ドレス 2 着目」「装花ランクアップ」が明細にない
- タップで該当項目を一括追加するフォーム

**2. 🔴 上がりやすい項目**（赤カード）
- 業界統計 + クチコミ AI 要約 + 既存 review estimate increase から「平均 +N 万」
- 例:「装花は 45% のカップルで +¥150,000 になります」

**3. 🟢 交渉余地**（緑カード）
- 「繁忙期割引」「土日以外」「紹介特典」「自己手配 OK の項目」
- 具体的な交渉文例付き

### 表示場所

- `/venues/[id]/estimate` or `/venues/[id]` の estimate section 直下
- 合計欄の近くに "Reality Check" というエンブレム
- タップで展開・詳細展開

---

## Why

### 根源的な不の解消
- **見積もり離脱**: 初期 350 万 → 最終 430 万（平均 +22%、業界データ）の膨張が恐怖
- **情報の非対称性**: 式場側は知っているが、カップルは 2 回目 3 回目の見積もり提示まで分からない
- **交渉できない**: 相場も比較材料もない状態で「この項目を値下げしたい」が言えない
- **他社の見積もり劣化**: Haretoki に入力した見積もりで「これ他社より高い」「なぜ」が見えたら、競合に行かれる

### 商用上の決定的差別化
ゼクシィ・ハナユメ は **売る側** なので落とし穴を見せない。Haretoki は **中立** だから見せられる。
これが「売らない」哲学を **数字で語る** 最強の武器。

### ブランド接続
- 曇り = "見えない落とし穴" / 晴れ間 = "気づく" / 晴れ = "納得して決める"
- Money Reality は晴れ間を作る装置

---

## How

### データソース（3 層）

```
┌─────────────────────────────────────────────┐
│ 1. 静的ルール（Haretoki の内部知識、毎月更新） │
│    - 持込料平均: ¥100,000（ドレス）          │
│    - 土日追加: 平均 +10%                     │
│    - 装花ランクアップ: 45% で +¥150,000      │
├─────────────────────────────────────────────┤
│ 2. クチコミ AI 要約（既存 Review.aiSummary）  │
│    - estimateIncrease.deltaYen の集計        │
│    - 「この式場 過去 N 件、平均 +N 万」       │
├─────────────────────────────────────────────┤
│ 3. Claude が個別分析（本件の Estimate + 他店） │
│    - 明細の抜け検知                          │
│    - 交渉文例生成                            │
└─────────────────────────────────────────────┘
```

### データモデル（最小追加）

```prisma
// 警告は毎回再計算なので store しない (ephemeral)
// ただし "dismissed warnings" は記憶する

model EstimateWarningDismissal {
  id           String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  estimateId   String   @map("estimate_id") @db.Uuid
  warningKey   String   @map("warning_key")  // "missing:dress-bringin" etc
  dismissedAt  DateTime @default(now()) @map("dismissed_at")

  estimate Estimate @relation(fields: [estimateId], references: [id], onDelete: Cascade)

  @@unique([estimateId, warningKey])
  @@map("estimate_warning_dismissals")
}
```

### Server Action

```ts
// src/server/actions/money-reality.ts
export async function getMoneyReality(estimateId: string): Promise<RealityReport> {
  "use cache";
  cacheTag(`estimate:${estimateId}:reality`);

  const estimate = await requireEstimateAccess(estimateId);
  const dismissedKeys = await getDismissedKeys(estimateId);

  // 1. 静的ルール検知
  const missingItems = detectMissingItems(estimate.items); // returns [{key, label, amount, confidence}]
  const upgradeRisks = computeUpgradeRisks(estimate.items);

  // 2. 口コミ統計
  const venue = await prisma.venue.findUnique({ where: { id: estimate.venueId } });
  const reviewStats = {
    avgDeltaYen: venue?.reviewEstimateDeltaYen,
    avgDeltaPct: venue?.reviewEstimateDeltaPct,
    sampleCount: venue?.reviewEstimateSampleCount,
  };

  // 3. Claude 個別分析（オプション: ユーザーが展開ボタンを押したら呼ぶ）
  // lazy call で API コスト最適化

  return {
    missing: missingItems.filter((m) => !dismissedKeys.has(`missing:${m.key}`)),
    upgradeRisks: upgradeRisks.filter((u) => !dismissedKeys.has(`upgrade:${u.key}`)),
    reviewStats,
    negotiationTips: [] as NegotiationTip[], // 展開時に Claude で生成
  };
}

export async function askClaudeForNegotiation(estimateId: string): Promise<NegotiationTip[]> {
  // Claude を呼んで、この見積もりに特化した交渉 3 文例を生成
}

export async function dismissWarning(estimateId: string, warningKey: string): Promise<void> {
  await prisma.estimateWarningDismissal.upsert({
    where: { estimateId_warningKey: { estimateId, warningKey } },
    create: { estimateId, warningKey },
    update: {},
  });
  await revalidateTag(`estimate:${estimateId}:reality`);
}
```

### 静的ルール（`src/lib/money-reality-rules.ts`）

```ts
export const COMMON_MISSING_ITEMS = [
  { key: "dress-bringin-fee", label: "ドレス持込料", typicalAmount: 100_000, category: "attire" },
  { key: "weekend-surcharge", label: "土日追加料金", typicalAmount: 300_000, category: "venue_fee" },
  { key: "cancellation", label: "キャンセル料の明記", typicalAmount: 0, category: "meta" },
  { key: "dress-2nd", label: "ドレス 2 着目", typicalAmount: 150_000, category: "attire" },
  { key: "groom-attire", label: "新郎衣装", typicalAmount: 80_000, category: "attire" },
  { key: "flower-upgrade", label: "装花ランクアップ", typicalAmount: 150_000, category: "flowers" },
  { key: "photo-album", label: "写真アルバム", typicalAmount: 150_000, category: "photo" },
  { key: "video", label: "ビデオ撮影", typicalAmount: 150_000, category: "video" },
  { key: "welcome-drink", label: "ウェルカムドリンク", typicalAmount: 30_000, category: "beverage" },
];

export const UPGRADE_RISK_RULES = [
  { key: "attire-upgrade", pattern: /^(attire|dress)/, baseRate: 0.62, avgDelta: 250_000, label: "衣装" },
  { key: "cuisine-upgrade", pattern: /cuisine|料理/, baseRate: 0.65, avgDelta: 200_000, label: "料理" },
  { key: "flowers-upgrade", pattern: /flower|装花/, baseRate: 0.45, avgDelta: 150_000, label: "装花" },
  { key: "photo-upgrade", pattern: /photo|video|撮影/, baseRate: 0.50, avgDelta: 250_000, label: "写真・映像" },
];

export function detectMissingItems(items: EstimateItem[]): MissingItem[] {
  const presentKeys = new Set(items.map(i => i.itemName.toLowerCase()));
  return COMMON_MISSING_ITEMS.filter((m) => {
    // heuristic: 既存明細に "持込" や "ドレス" が無ければ「抜けている」
    return ![...presentKeys].some((name) => fuzzyMatch(name, m.label));
  });
}
```

### UI

```tsx
// src/components/venues/money-reality.tsx
export function MoneyReality({ report }: { report: RealityReport }) {
  const [showNegotiation, setShowNegotiation] = useState(false);
  const [tips, setTips] = useState<NegotiationTip[]>([]);

  return (
    <section aria-label="見積もり Reality Check" className="space-y-3">
      <div className="flex items-center gap-2">
        <p className="text-[10.5px] uppercase tracking-[0.14em] text-foreground font-medium">
          Reality Check
        </p>
        <div className="h-px flex-1 bg-border/50" />
      </div>

      {/* 🟡 Missing */}
      {report.missing.length > 0 && (
        <WarningCard
          tone="yellow"
          title={`抜けている項目 ${report.missing.length} 件`}
          subtitle="このあと見積もりに加わる可能性が高い項目です"
          items={report.missing.map(m => ({
            label: m.label,
            badge: `平均 +¥${(m.typicalAmount/10000).toFixed(0)}万`,
            onDismiss: () => dismissWarning(`missing:${m.key}`),
          }))}
          footerCta="この 3 項目を見積もりに追加する"
        />
      )}

      {/* 🔴 Upgrade risks */}
      {report.upgradeRisks.length > 0 && (
        <WarningCard
          tone="red"
          title="上がりやすい項目"
          subtitle="最終見積もりで増える確率が高い傾向です"
          items={report.upgradeRisks.map(u => ({
            label: `${u.label} — ${Math.round(u.baseRate * 100)}% のカップルで +¥${(u.avgDelta/10000).toFixed(0)}万`,
            badge: null,
          }))}
        />
      )}

      {/* 口コミ統計ハイライト */}
      {report.reviewStats.sampleCount && report.reviewStats.sampleCount >= 3 && (
        <div className="rounded-2xl bg-[var(--gold-subtle)] border-l-[3px] border-[var(--gold-warm)] p-4">
          <p className="text-[10.5px] uppercase tracking-[0.14em] text-[var(--gold-warm)]">
            この式場の実績
          </p>
          <p className="mt-1.5 text-[13.5px] leading-relaxed">
            過去の口コミ <span className="font-medium">{report.reviewStats.sampleCount}件</span> の平均で、
            最終見積もりが初期から <span className="font-medium text-[var(--gold-warm)]">+¥{Math.round((report.reviewStats.avgDeltaYen ?? 0)/10000)}万</span> 上がっています。
          </p>
        </div>
      )}

      {/* 🟢 Negotiation — 展開式 */}
      <details className="rounded-2xl border border-[color-mix(in_oklab,var(--success,#4a7c59)_30%,transparent)] bg-[color-mix(in_oklab,var(--success)_5%,transparent)] p-4">
        <summary className="flex items-center justify-between cursor-pointer list-none">
          <div>
            <p className="text-[10.5px] uppercase tracking-[0.14em] text-[color:var(--success)]">交渉の余地</p>
            <h4 className="mt-1 font-[family-name:var(--font-display)] text-[15px] font-normal">
              AI が交渉のヒントを生成します
            </h4>
          </div>
          <ChevronDown className="h-5 w-5 transition-transform group-open:rotate-180" />
        </summary>
        <div className="mt-4 space-y-3">
          {tips.length === 0 ? (
            <Button onClick={loadTips}>AI に交渉ヒントを聞く</Button>
          ) : (
            tips.map((tip, i) => (
              <div key={i} className="rounded-xl bg-background p-3">
                <p className="text-[13px] font-medium">{tip.title}</p>
                <p className="mt-1 text-[12.5px] text-muted-foreground leading-relaxed">{tip.suggestion}</p>
                {tip.script && (
                  <blockquote className="mt-2 border-l-2 border-[color:var(--gold-warm)]/40 pl-3 text-[12px] italic text-foreground/80">
                    {tip.script}
                  </blockquote>
                )}
              </div>
            ))
          )}
        </div>
      </details>
    </section>
  );
}
```

---

## 実装見積もり

| 内容 | 工数 |
|---|---|
| DB: EstimateWarningDismissal | 15 分 |
| 静的ルール定義 (money-reality-rules.ts) | 45 分 |
| Server Action: getMoneyReality + detect | 90 分 |
| Claude 交渉 tip 生成 (prompt + action) | 60 分 |
| UI: MoneyReality component + WarningCard | 2.5 時間 |
| venue detail への統合 | 30 分 |
| **合計** | **約 6 時間** |

---

## コスト

- 静的検知: Claude 呼ばない → ¥0
- 交渉ヒント生成: 展開時のみ → 見積もり 1 件 × ¥5 / 展開
- 想定: 月 ¥100〜300 / ユーザー

---

## KPI

- Reality Check 展開率: 75%+
- 「抜けている項目を追加」クリック率: 40%+
- 交渉ヒント tap 後 "実際に交渉した" 回答率（定性 survey）: 30%+
- 見積もり離脱率: 現状 vs -20%
