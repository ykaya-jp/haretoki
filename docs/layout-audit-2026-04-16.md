# Haretoki レイアウト審美監査 2026-04-16

## 総評

v4.2 editorial refresh を経て、**HARETOKI · Section** masthead、明朝 extralight の見出し、gold-warm eyebrow、gradient hairline、SkyChip という文体が全ページに行き渡り、モバイル 375px でも magazine らしい呼吸が取れている。Home (DailyRitual → EditorialHero → RecentVenues → Journey card) の垂直リズムは特に良い。

一方で「最後の 10% が揃っていない」: (1) ルートコンテナ `space-y` が 5/8/12 で混在、(2) Candidates の right-top icon が masthead の重心を割る、(3) MyPage のセクション見出しだけ v4.2 eyebrow 形式に未移行、(4) AgreementsSection の絵文字が v4.2 「絵文字削除」方針に反する、(5) Home の Journey カードが editorial ブロックの間に挟まれた独立カードとして浮いている。

## 優れている点

- masthead pattern (HARETOKI · Section) が 5 画面で統一
- DailyRitual → EditorialHero compact 連鎖による冗長排除
- Gradient hairline をセクション呼吸記号として Home/Journey/MyPage で共有
- NightQuestionCard の大きな `"` を opacity 0.08 で敷く editorial flourish
- RecentVenues: 4:3 写真 + 下段グラデ + 右上スコア + 下端明朝名の写真ファースト
- EditorialHero metrics の divide-x + items-end + tabular-nums で雑誌数字表の品
- SkyChip ブランドメタファーを Home / Journey で 56px 円形で統一
- Coach sticky header の frosted backdrop-blur-xl + gold-subtle chip

## 改善 priority

### High

- **H-1** ルートコンテナ `space-y-*` が 5/8/12 で混在 → `space-y-10` に統一 (home/explore/candidates/journey/mypage/notifications)
- **H-2** Candidates header 右上の h-11 w-11 SlidersHorizontal が masthead 重心を割る → 撤去し CoupleGapSection 下の inline text-chip に再配置
- **H-3** Home の Journey リンクカードが editorial リズムから浮く → `rounded-2xl border` の mini card を **border-left 2px hairline row** に
- **H-4** MyPage section 見出し 4 箇所 (`プロフィール/パートナー/おふたりの希望/その他`) が v4.2 eyebrow pattern に未移行 → 全て `eyebrow 10.5px uppercase + 明朝 15px extralight` ペアへ
- **H-5** Candidates masthead と CoupleGapSection の間に呼吸なし (space-y-5) → space-y-10 + gradient hairline

### Medium

- **M-1** RecentVenues `min-w-[300px]` が 375px で右見切れ感中途半端 → `min-w-[280px]` + bleed edge
- **M-2** EditorialHero metrics + ring が 375px で詰まる
- **M-3** 戻るリンク (notifications/journey/saved-searches) が masthead の上に別スタイルで乗る → eyebrow 行内の breadcrumb に統合
- **M-4** AgreementsSection の status chip が絵文字 (💭✅🔄) → Lucide icon に置換 (v4.2 Copy 方針違反)
- **M-5** SavedSearches の gold 丸アイコン 5 件並び → border-border/60 bg-background に落とし、gold は数字だけに

### Low

- **L-1** Explore eyebrow 下サブコピーを `text-[12.5px] text-muted-foreground/80` に静める
- **L-2** Coach SegmentedControl を共通 component に統一
- **L-3** Notifications 戻りリンク `mb-3 → mb-5`
- **L-4** CoupleGapSection gradient card を `bg-card + border-l-2 gold-warm` に差別化

## ブランド整合性

- v4.2 Editorial Refresh 整合度: **85%**
- Morning Light gold 使用率: 5-10% 範囲内 (SavedSearches だけ超過)
- Shippori Mincho × Noto Sans JP 分業: 全画面で遵守
- ブランドメタファー (曇り→晴れ間→晴れ): DailyRitual / EditorialHero / JourneyTimeline で一貫、強い

## 次の 1 バッチに回したい 5 件 (最も効く)

1. **H-1** 全ページ space-y-10 統一
2. **H-4** MyPage section 見出しを eyebrow pattern へ
3. **H-2** Candidates header 右上アイコン撤去
4. **M-4** AgreementsSection 絵文字 → Lucide icon
5. **H-3** Home Journey card → editorial row (border-left hairline)

いずれも className レベルのみ。
