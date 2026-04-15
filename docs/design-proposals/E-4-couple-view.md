# E-4 二人ビュー — Couple View

**モック**: [mockups/e-4-couple-view.html](../mockups/e-4-couple-view.html)
**優先度**: H
**関連**: W-6 (二人が同じ画面を見ていない), Partner L2-3, PartnerReaction model

---

## What

全画面上部に **ふたりのイニシャル・モノグラム** を並べ、各式場・各観点で「妻/夫どっちが好き/未見」の差分を一目で見せる。

### 具体的な変化

**1. グローバル「二人 seal」**
- 全画面の右上（bottom-nav 直下、safe-area-inset-top 考慮）に 40px の円形 seal
- 2 人のイニシャル（ユーザー名の 1 文字目）を明朝で重ねる
- タップで `/couple` サマリー画面へ

**2. 式場カードの差分バッジ**
- 各 VenueCard の写真右上に `♥妻 · ♡夫` 型のバッジ
- 妻: 赤 gold heart / 夫: 薄い gold heart で埋まり具合を示す
- 未見バッジ: 「夫: まだ見ていない」細字

**3. 比較マトリクスの二人カラム**
- 決定マトリクスの各セルに妻スコア / 夫スコアの 2 行構造（既存は集計のみ）
- 差分が 1.0 以上のセルは薄い rose tint で「意見が分かれている」を可視化

**4. 候補スクリーンの「温度差」リスト**
- `/candidates` に「温度差が大きい候補」フィルタ
- 例: 妻 5.0 / 夫 3.5 の venue を一覧化
- クリックで `/coach?prompt=temperature-gap` に飛んで話すきっかけに

### ユースケース

- 妻が日中に新しい venue を追加 → 夫のホームに「妻が新しく気になっている式場があります」
- 夫が仕事終わりに開く → その venue を review → ホームから消える
- 土日に二人で見比べる時、温度差フィルタで「今日話したいこと」が瞬時

---

## Why

### 現状の不
- **Partner の実在感が希薄**: アプリは 1 人で使っている感覚。二人で使う UI プリミティブが存在しない
- **非同期の sync が失敗**: 妻がリサーチした文脈が夫に引き継げず、見学当日に「あれ、これなんで候補？」
- **温度差の言語化不能**: 一緒に座って話しても「なんか違う気がする」で終わる。数字で語れない
- **コミュニケーションのきっかけ不足**: アプリが「話すネタ」を提示してくれない

### 競合との差別化
- Zola / The Knot は「2 人アカウント」だが seal や差分 UI は弱い
- Partiful 的な軽さ + Linear 的な差分情報の明示 = Haretoki 独自
- 静かだが、実在感のあるパートナー共存

---

## How

### データ

既存の `ProjectMember` role=`owner/partner`、`VenueFavorite`、`VenueScore (source='user_rating', userId)`、`PartnerReaction` を活用。
新規テーブル不要。ただし helper query が必要:

```ts
// src/server/actions/couple.ts
"use server";

export async function getCoupleView(): Promise<CoupleViewData> {
  "use cache";
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);
  cacheTag(`couple:${projectId}`);

  const [members, venues] = await Promise.all([
    prisma.projectMember.findMany({
      where: { projectId, acceptedAt: { not: null } },
      include: { user: { select: { id: true, name: true, email: true } } },
    }),
    prisma.venue.findMany({
      where: { projectId },
      include: {
        scores: true,
        favorites: { select: { userId: true } },
      },
    }),
  ]);

  const [owner, partner] = sortByRole(members);
  const venueDiffs = venues.map((v) => ({
    id: v.id,
    name: v.name,
    ownerFavorited: v.favorites.some((f) => f.userId === owner?.userId),
    partnerFavorited: v.favorites.some((f) => f.userId === partner?.userId),
    ownerScores: avgScores(v.scores, owner?.userId),
    partnerScores: avgScores(v.scores, partner?.userId),
    temperatureGap: Math.abs(
      (avgTotal(v.scores, owner?.userId) ?? 0) -
      (avgTotal(v.scores, partner?.userId) ?? 0)
    ),
  }));

  return { owner, partner, venueDiffs };
}
```

### UI

**CoupleSeal コンポーネント**（全画面 layout に配置）

```tsx
// src/components/couple/couple-seal.tsx
export function CoupleSeal({ owner, partner }: Props) {
  return (
    <Link
      href="/couple"
      className="fixed top-[env(safe-area-inset-top,0)] right-4 z-30 group"
      aria-label={`おふたり（${owner.name}・${partner?.name ?? "ひとり"}）`}
    >
      <div className="relative h-10 w-10">
        {/* owner initial */}
        <div className="absolute top-0 left-0 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--gold-warm)] text-[11px] font-[family-name:var(--font-display)] text-white shadow-sm">
          {ownerInitial}
        </div>
        {/* partner initial, overlapping */}
        {partner && (
          <div className="absolute bottom-0 right-0 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--primary)] text-[11px] font-[family-name:var(--font-display)] text-white shadow-sm ring-2 ring-background">
            {partnerInitial}
          </div>
        )}
      </div>
    </Link>
  );
}
```

**VenueCard に差分バッジ追加**

```tsx
<div className="absolute bottom-3 right-3 flex items-center gap-1">
  {ownerFavorited && (
    <div className="flex h-7 items-center gap-1 rounded-full bg-[var(--gold-warm)]/90 px-2 text-[10.5px] text-white backdrop-blur-sm">
      <Heart className="h-3 w-3 fill-current" />
      {ownerInitial}
    </div>
  )}
  {partner && !partnerFavorited && partnerNotSeen && (
    <div className="flex h-7 items-center gap-1 rounded-full bg-background/80 px-2 text-[10.5px] text-muted-foreground backdrop-blur-sm border border-border">
      <Eye className="h-3 w-3" />
      {partnerInitial}: まだ
    </div>
  )}
  {partnerFavorited && (
    <div className="flex h-7 items-center gap-1 rounded-full bg-[var(--primary)]/90 px-2 text-[10.5px] text-white backdrop-blur-sm">
      <Heart className="h-3 w-3 fill-current" />
      {partnerInitial}
    </div>
  )}
</div>
```

**/couple サマリー画面**（新規）

```tsx
// src/app/(app)/couple/page.tsx
export default async function CouplePage() {
  const data = await getCoupleView();
  return (
    <div className="space-y-6">
      <CoupleHeader owner={data.owner} partner={data.partner} />
      <TemperatureGapList venues={data.venueDiffs.filter(v => v.temperatureGap > 0.5)} />
      <RecentPartnerActivity /> {/* ここに最近の夫/妻の動きを timeline */}
      <DisagreementCoach /> {/* 差分について話すきっかけ CTA */}
    </div>
  );
}
```

**決定マトリクスに二人カラム**

既存 `decision-matrix.tsx` の scoresByDimension を owner/partner 分離:

```tsx
// 各 td を 2 行化
<td>
  <div className="text-[12px] tabular-nums">
    <Heart className="h-2.5 w-2.5 inline text-[var(--gold-warm)]" /> {ownerScore ?? "—"}
  </div>
  <div className="text-[12px] tabular-nums text-[var(--primary)]/80 mt-0.5">
    <Heart className="h-2.5 w-2.5 inline" /> {partnerScore ?? "—"}
  </div>
  {gap > 1.0 && <div className="absolute inset-0 bg-[color-mix(in_oklab,var(--primary)_6%,transparent)] pointer-events-none rounded" />}
</td>
```

---

## 実装見積もり

| 内容 | 工数 |
|---|---|
| getCoupleView + キャッシュ | 60 分 |
| CoupleSeal component + layout 組込 | 45 分 |
| VenueCard 差分バッジ（owner/partner props 追加） | 45 分 |
| /couple page + TemperatureGapList + DisagreementCoach | 2.5 時間 |
| DecisionMatrix 二人カラム改修 | 90 分 |
| 温度差フィルタ on /candidates | 45 分 |
| **合計** | **約 7 時間** |

## KPI
- 招待 partner の週 1 回以上ログイン率: 60%+
- VenueCard 上での「相手バッジ」認知率: 90% (定性)
- 温度差フィルタ → /coach 遷移率: 15%+
