# Churn Prediction Model — Design Spec

「晴れ時 (Haretoki)」 の **ユーザー継続予測モデル** の設計案。 Beta release 後
に数値が溜まってから実装する **Phase 5 候補** であり、 本ドキュメントは
方針 + 候補特徴量 + segmentation + 着手判断材料を **コード書く前に
固める** ためのスペック。

最終更新: 2026-05-04 (Phase 4 — Beta launch ops 強化と並行で起草)

> **対になるドキュメント**
> - 数値供給源: [`../../src/lib/metrics-aggregations.ts`](../../src/lib/metrics-aggregations.ts) inline doc
> - 観測ダッシュボード: `/admin/metrics` (= 本モデルの input 候補が並ぶ surface)
> - launch スケジュール: [`../release/beta-launch-plan.md`](../release/beta-launch-plan.md) §3 / §4

---

## 1. なぜ churn 予測が必要か

「晴れ時」 は **特殊な時間軸を持つプロダクト**:

- 結婚式場さがし = 一般に **3-9 ヶ月** で完結
- 完結したユーザーは「卒業」 = 健全な離脱
- 「卒業」 と「諦めた」 を区別しないと、 KPI が誤読される

例: ユーザー A は決定 → 6 ヶ月後に去る。 ユーザー B は登録 → 1 週間で
去る。 後者だけが助けるべき churn。 通常の SaaS の churn 率定義
(MoM 非アクティブ率) では両者を区別できない。

このモデルの目的:

> **「卒業見込み」 と「離脱見込み」 を分けて推定する**

そして「離脱見込み」 だけに対して介入する。

---

## 2. モデルゴール

### 2.1 タスク定義

**タスク**: 二値分類 (will-churn vs will-engage) — **登録から 4 週間後の
状態** を、 **登録から 1 週間時点の挙動** から予測。

**正例 (will-churn)**: 4 週間後に「離脱」 と判定されるユーザー。
離脱の操作的定義 = **30 日連続で活動なし AND decision 未完了**。

**負例 (will-engage)**: 4 週間後にまだ active OR 既に decision 完了。

**入力 timing**: 登録から 7 日経過時点。 1 週間あれば onboarding 完了
有無 / venue 追加 / partner invite 等 の早期 signal が揃う。

**出力**: 0.0 〜 1.0 の churn probability。 segmentation thresholds は
§4 参照。

### 2.2 何ができたら成功か

- ベースライン (= 全員 churn 予測) を上回る
- precision / recall とも > 0.6 (= 1/3 false alarm + 1/3 miss を許容)
- "at-risk" セグメント (= 上位 25% high-churn-prob) に対する介入を打って、
  4 週間後の retention を **+5%** 改善

> 厳密な ML evaluation を求めるよりも、 「介入して効果が出るか」 を
> A/B test で測るのが現実的。 モデルは介入対象を絞る道具。

---

## 3. 候補特徴量 (1 週間時点で取得可能)

### 3.1 onboarding 完了系 (= 入り口の摩擦)

| 特徴量 | 出所 | 期待方向 |
|---|---|---|
| `onboarding_completed_within_24h` | cookie + first onboarding-finish event | + (engage) |
| `onboarding_steps_completed_count` | localStorage / future User.onboardingState | + |
| `onboarding_abandon_step` | 中断時点 step (1-3 等) | - (1-2 で止まると churn) |

### 3.2 1 週間内のアクション系 (= 価値到達の手前)

| 特徴量 | 出所 | 期待方向 |
|---|---|---|
| `venues_added_in_w1` | Venue WHERE createdAt < signup + 7d | + (3-5 件で valid signal) |
| `visits_scheduled_in_w1` | Visit WHERE scheduledAt set | + |
| `comparison_views_in_w1` | analytics event: `couple_comparison_viewed` | + |
| `coach_messages_in_w1` | CoachMessage 件数 | + (3+ で engage signal) |
| `ai_recommendations_clicked_in_w1` | analytics: `ai_insight_action` | + |

### 3.3 partner invite 系 (= ふたり前提の core 体験)

| 特徴量 | 出所 | 期待方向 |
|---|---|---|
| `invited_partner_within_w1` | ProjectInvitation EXISTS WHERE createdAt < signup + 7d | + (極めて強い engage signal) |
| `partner_accepted_within_w1` | ProjectMember WHERE acceptedAt set | ++ |
| `realtime_event_seen_with_partner` | audit_logs (Phase 3 wave 1) | ++ |

### 3.4 通知系 (= 戻ってくる引力)

| 特徴量 | 出所 | 期待方向 |
|---|---|---|
| `push_subscription_active_w1` | PushSubscription EXISTS | + |
| `notification_pref_active_w1` | NotificationPreference.frequency != "off" | + |
| `email_opened_w1` | Resend webhook → notifications.email_delivery_status="opened" | + |

### 3.5 デモグラ / セッション系 (= 暗黙シグナル)

| 特徴量 | 出所 | 期待方向 |
|---|---|---|
| `signup_day_of_week` | User.createdAt | 中立 (control variable) |
| `signup_hour_of_day_jst` | User.createdAt | 中立 |
| `device_type_first_session` | User-Agent → mobile/desktop | + (mobile = engage) |
| `referrer_first_session` | first session referrer (PostHog) | 中立 |

### 3.6 取得不能 / 取得しないもの

意図的に **モデルに入れない** 候補も明記:

- 個別メッセージ本文 / メモ本文 (= PII、 入れる ROI 低い)
- 評価値の数値そのもの (= ノイズ過多、 評価行動「した/しない」 だけで十分)
- IP geolocation (= プライバシー懸念、 segment 必要時に再考)

---

## 4. Segmentation

予測 probability に対して 3 segment:

| Segment | probability | 推定占有率 (target) | 介入 |
|---|---|---|---|
| **engage** | < 0.3 | 50% | 介入なし、 通常の reminder のみ |
| **mid** | 0.3 〜 0.7 | 25% | 個別 nudge (= reminder 強化、 Beta 期は手動メール OK) |
| **at-risk** | > 0.7 | 25% | 強い介入 (= 機能ガイド、 サポート先に開く CTA、 専用フィードバック路) |

> 占有率 25/50/25 は cohort design の暫定。 実データで shift する。

### 4.1 介入の trade-off

「at-risk セグメントには手厚いサポート」 は intuitive だが、 **過剰介入で
体験を損なう** 罠もある:

- 押し付けがましい reminder で逆に去る (= 通知 opt-out → silent churn)
- "あなたは at-risk" を**ユーザーに見せない** (= manager 的視点を製品に
  持ち込まない)
- 介入は **製品体験の自然な一部** として設計する

具体例:
- ❌ "あなたは離脱しそうです、 サポートを受けてください" ← NG
- ✅ "ふたりで決めるとき、 ヒントが必要ですか？" ← 同じ意図、 違う言い方

---

## 5. 訓練 / 検証 design

### 5.1 データ要件

実装可能になる時点 = 以下の **両方** を満たしたとき:

- **正例** (will-churn) が 50 件以上集まっている
- **負例** (will-engage) が 50 件以上集まっている

Beta cut1 (50 名) の cohort では足りない。 Open Beta cut2 (200 名) の
cohort + 4 週間経過で **ようやく** 統計的に意味のある fit ができる。
時期は概ね **GA + 1 ヶ月** が現実的見込み。

### 5.2 train/test split

時間ベース split:

- train: cohort 1 (= Open Beta cut1)、 4 週後の retention 既知
- val: cohort 2 (= cut2)、 同上
- test: cohort 3 (= GA 後 1 ヶ月)、 hold out

理由: 時期跨ぎで train → val → test は実プロダクト変化に頑健な評価。

### 5.3 モデル候補

Phase 5 で実際に書くときの選択肢:

| アルゴリズム | メリット | デメリット | 採用判断 |
|---|---|---|---|
| Logistic Regression | 解釈性 → "なぜ at-risk か" 説明可能 | 複雑な相互作用に弱い | **第 1 候補** |
| Gradient Boost (XGBoost / LightGBM) | 中規模データで強い、 feature importance 取れる | 解釈性やや劣る | 第 2 候補 |
| Random Forest | overfit に強い、 設定簡単 | feature 相互作用の表現力 中 | 第 3 候補 |
| Neural Net | データが 10000+ あれば最強 | Beta 規模では over-engineered | 却下 |

**第 1 候補** = Logistic Regression。 介入 ROI を測りたい段階では
「なぜ」 が説明可能なほうが施策設計しやすい。

### 5.4 計算環境

- Beta 段階の 50-200 名規模なら **Vercel Functions 内で scikit-learn
  風 light な実装** で十分 (= 自前 logistic regression)
- 1000+ DAU 規模で本格化するなら **別 Worker (= Modal / Railway 等)** に
  移し、 Supabase の bg job で予測値を `User.churn_score` に書き戻す
- いずれの段階でも **モデル training は手動 (週次 Jupyter) で OK**、 即時
  自動化しない (= 過適合 / 暴走の防御として人手チェックポイント残す)

---

## 6. 実装フェーズ (Phase 5 想定)

### Phase 5.1 — データ準備 (= 観測強化)

着手は不要、 **既存の /admin/metrics + audit_logs + 各 cron で
データ自動蓄積中**。 §3 候補特徴量の取得経路を確認するだけ:

- [ ] `onboarding_completed_within_24h` の取得経路を確定 (現状 cookie のみ
      なので audit row 追加するか、 server-side persistence)
- [ ] `comparison_views_in_w1` の analytics event が PostHog に流れているか
- [ ] `email_opened_w1` の Resend webhook → DB 反映が実プロダクションで
      動いているか確認

### Phase 5.2 — 特徴量 ETL (= データ正規化)

cohort ごとに 1 行 / 1 user の **行列** を作るバッチ:

```typescript
// src/lib/churn/feature-extract.ts (Phase 5 で実装)
export async function extractFeaturesForUser(
  userId: string,
  asOfDate: Date,  // 通常 signupDate + 7日
): Promise<UserFeatures> { ... }
```

### Phase 5.3 — モデル訓練 (= 別リポ / Jupyter)

別 repo `haretoki-ml` (= 想定) で week 末に手動訓練。 結果モデルは
`models/churn-v1.json` (= weights) を本 repo に commit、 prod がそれを
読む。

### Phase 5.4 — 予測サーバー (= 別 worker)

毎日 1 回、 全 user に対して churn_score を計算 → User table に書き
戻し。 cron `/api/cron/churn-score-rollup` を新規。

### Phase 5.5 — 介入 surfaces

`User.churn_score > 0.7` のユーザーに対して:

- メイン画面で「ヒントが必要ですか？」 hover-able
- リマインダーの copy を nudge 寄りに切り替え (= NotificationPreference 内に
  `tone="gentle" | "active"` 追加)
- 専用 feedback path (= /mypage/feedback の subject 既定値を「使い方
  ガイドが欲しい」 にプリフィル)

---

## 7. リスク / 倫理

### 7.1 false positive (= engage を at-risk と誤認)

不要な介入を発火する。 過剰 reminder で逆に opt-out 引き起こす。
緩和: §4.1 の「過剰介入」 ガイドラインを介入文面 review に組み込む。

### 7.2 false negative (= at-risk を engage と誤認)

介入機会を逃す。 でも介入なしでも卒業ユーザーと一緒に去るだけなので
「機会損失」 程度。 critical ではない。

### 7.3 モデルの「暗い」 用途

将来的に「at-risk = 課金を渋りそう」 と読み替えて課金圧力に使う誘惑。
**禁止する**:

- churn 予測は **ユーザーの体験を改善する** ためだけに使う
- 「at-risk なので有料プランを売り込む」 は **明示的に NG** とする
  (= 信頼を失うやり方)
- 課金プラン側の churn 予測は別モデルとして設計する (Phase 6+ 課題)

### 7.4 透明性

- ユーザー本人に **score を見せない** (= 自己充足予言を避ける)
- 妻 / 共同創業者に共有する場合は session-level の議論用途のみ
- 第三者 (= 投資家 etc) には集計値のみ (= individual の score は出さない)

---

## 8. 運用上の意思決定材料

「いつ Phase 5 を着手するか」 の judging criteria:

```
着手条件 (= ALL met):
- [ ] Open Beta cut2 (200 名) cohort が 4 週間経過
- [ ] /admin/metrics の MAU lower bound が 100 を超えている
      (= モデル fit に必要なデータ量)
- [ ] DAU/MAU stickiness が 5% を超えている (= 「使われている」 シグナル)
- [ ] /mypage/feedback の Beta feedback が月 10 件以上来ている
      (= 介入対象のニーズが言語化されている)
```

上記すべて満たすまで本ドキュメントは「設計案」 のまま。 着手のたびに
本ドキュメントを update + ADR を切る。

---

## 9. 関連ドキュメント

- `/admin/metrics` 設計: [`../../src/app/admin/metrics/page.tsx`](../../src/app/admin/metrics/page.tsx)
- 数値ヘルパー: [`../../src/lib/metrics-aggregations.ts`](../../src/lib/metrics-aggregations.ts)
- launch スケジュール: [`../release/beta-launch-plan.md`](../release/beta-launch-plan.md)
- Sentry alert 設計: [`../harness/sentry-alerts.md`](../harness/sentry-alerts.md)
- Resend webhook 運用: [`../harness/webhook-ops.md`](../harness/webhook-ops.md)

---

## 10. 更新ルール

- §3 特徴量候補は Open Beta cohort で実 EDA するたびに refine
- §6 Phase 5.x のサブステップは着手のたびに「実装完了」 に更新
- §8 着手条件 checkbox は Beta launch plan の各段階完了時に確認
- 着手判断を「やる」 と決めた時点で ADR (= `docs/harness/adr/00xx-
  churn-prediction-model.md`) を切って本ドキュメントを decouple
