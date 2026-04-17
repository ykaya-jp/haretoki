# Phase 7: Modern Luxury Polish — 設計書

> 2026-04-14 作成
> 範囲: ラグジュアリー水準への引き上げ。IA修正、affordance強化、知覚速度改善、micro-interactions

---

## 1. 問題の本質

UX監査で判明した**ラグジュアリー・ギャップ**:

> デザインシステム（色、フォント、レイアウト）は良い。
> しかし **micro-moments での摩擦削減と喜び** が足りない。
> これを直せば「堅実なプロダクト」→「プレミアム体験」に飛躍する。

---

## 2. 修正原則（Modern Luxury UX Principles）

### P1: 空ステートは招待状である
「〜がありません」で終わらせない。タップすると次に進める **Drop Zone** や **Inline Action** にする。

### P2: 情報設計は無意識に正しい
アイコンとラベルの意味が一致する。ユーザーが考えなくていい。
- 歯車 = 設定（システム）
- 人アイコン = マイページ（個人情報）

### P3: フィードバックは即時かつ複層
タップしたら **150ms 以内**に何かが変わる（色・スケール・影）。**楽観的更新**を多用。

### P4: 知覚速度 > 実測速度
`prefetch` を明示。skeleton は実レイアウトと一致。ページ間の白画面を排除。

### P5: タッチターゲットは44px厳守、見た目は48-56px
数字ではなく「指の楽さ」で設計。

---

## 3. IA（情報設計）の修正

### 3.1 マイページ / 設定 の分離

**現状**: 歯車アイコン + 「マイページ」→ `/settings`（混乱）

**新構成**:

```
ヘッダー右上
├── 人アイコン（UserCircle2）+ 「マイページ」 → /mypage
│
/mypage  (新設)
├── プロフィール (名前/メール/アバター)
├── パートナー (招待状態/再招待)
├── おふたりの希望 (挙式条件)
└── [ 設定へ → ] ボタン (視覚的に弱め)

/settings  (既存を簡素化)
├── テーマ (ライト/ダーク/自動)
├── 通知 (将来)
└── ログアウト
```

### 3.2 ボトムナビ

現状維持。4タブ (ホーム/探す/候補/コーチ)。

ただし:
- ラベル `text-[10px]` → **`text-xs` (12px)** に拡大
- タッチターゲットに呼吸を持たせる

---

## 4. Affordance 強化

### 4.1 写真空ステートを Drop Zone に

**現状** (`photo-carousel.tsx:33-43`):
```tsx
<div className="flex items-center justify-center rounded-2xl bg-muted">
  <span className="text-sm text-muted-foreground">写真はまだありません</span>
</div>
```

**変更**:
```tsx
<button
  onClick={openPhotoPicker}
  className="flex flex-col items-center justify-center gap-2
             rounded-2xl border-2 border-dashed border-border
             bg-muted/30 py-16 transition-all duration-200
             hover:border-[var(--gold-warm)] hover:bg-[var(--gold-subtle)]
             active:scale-[0.98]"
>
  <Camera className="h-8 w-8 text-[var(--gold-warm)]" />
  <span className="text-sm font-medium">写真を追加してみましょう</span>
  <span className="text-xs text-muted-foreground">タップして選ぶ</span>
</button>
```

### 4.2 AddPhotosButton を Primary 化

**現状**: グレーのアウトラインボタン（目立たない）

**変更**:
- Gold 塗りつぶし or Gold outline + subtle fill
- 明確に「ここをタップすると追加」とわかる

### 4.3 AIInsightCard のアクションを Button コンポーネントに

**現状**: `<a>` で手書きスタイル → 意味論的にも視覚的にも弱い

**変更**:
```tsx
<Button asChild size="sm" variant="secondary">
  <Link href={action.href}>{action.label}</Link>
</Button>
```

### 4.4 HeartButton spring チューニング

**現状**: stiffness 100, damping 16 (柔らかすぎる)
**変更**: stiffness 200, damping 12 (キビキビ)

### 4.5 FilterChips に hover/active 強化

**現状**: hover 状態薄い
**変更**: `hover:bg-muted hover:border-foreground/20 active:scale-95`

---

## 5. 知覚速度改善

### 5.1 全 Link に prefetch

BottomNav、CTA、venue カード等、全ての `<Link>` に明示的 `prefetch`:

```tsx
<Link href="/explore" prefetch>
```

Next.js は intent (hover/focus) 時に prefetch するが、モバイルでは hover がないため重要。

### 5.2 loading.tsx を実レイアウト一致に

各 `loading.tsx` を対応するページの実レイアウトに合わせる:
- `venues/[id]/loading.tsx`: PhotoCarousel + Rating + Estimate + Visit の高さを再現
- `candidates/loading.tsx`: Segmented + カード3枚分

### 5.3 ページ遷移アニメーションを短く

現状 0.6-0.9s → **0.3-0.5s** に調整。ラグジュアリーでも遅すぎると苛立つ。

### 5.4 LCP 対策

- Landing hero image: `priority` 指定（既にあり）
- Photo carousel 1枚目: `priority={idx === 0}`

---

## 6. Micro-interactions 強化

### 6.1 RatingSection に保存フィードバック

星をタップ → 即座に塗りつぶされる + 右端に「✓ 保存しました」チェック (300ms フェードイン → 1000ms 後フェードアウト)

### 6.2 Journey Card にアイコン脈動

状態変化時（曇り→晴れ間→晴れ時）に0.4秒の subtle pulse:
```tsx
<motion.div
  animate={{ scale: [1, 1.1, 1] }}
  transition={{ duration: 0.6, ease: "easeOut" }}
  key={state.message}
>
```

### 6.3 ボタンホバー速度

現状 400ms → **200ms** に。400msは遅すぎて鈍く感じる。

---

## 7. 実装順序（1 PR = 1論理単位）

### Batch 1: Critical (30分)
1. 写真空ステート Drop Zone 化
2. ヘッダーアイコン UserCircle2 + "マイページ"
3. `/mypage` ルート新設（`/settings` 分離）
4. 全 Link に prefetch 追加

### Batch 2: High (40分)
5. AddPhotosButton プライマリ化
6. HeartButton spring チューニング
7. AIInsightCard アクション Button 化
8. FilterChips hover/active 強化

### Batch 3: Medium (30分)
9. RatingSection 楽観更新 + トースト
10. loading.tsx 実レイアウト一致
11. BottomNav ラベル text-xs 化

### Batch 4: Polish (20分)
12. ボタンホバー 400ms → 200ms 一括
13. Journey Card アイコンpulse
14. カルーセル 1枚目 priority

全Batch完了後: E2Eテスト全通過確認 → マージ → デプロイ

---

## 8. 完了条件

- ✅ 空ステートが全て「招待」になっている
- ✅ マイページと設定が明確に分離
- ✅ 全ボトムナビ/Linkが prefetch 済み
- ✅ 楽観的更新が主要アクション（ハート、評価、決定）に実装
- ✅ ボタンホバー/タップが 200ms で反応
- ✅ E2Eテスト全件パス（現在 142件）
- ✅ スマホで体感 instant に近い遷移
