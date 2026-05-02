# On-Call Rotation

「晴れ時 (Haretoki)」 の **on-call 体制設計** — Beta 期 (1 人開発) から
GA → ポスト GA への段階移行プラン。 ツール選定の比較表 + 1 段階ごとに
何を install / 何にお金を払うかを意思決定できる形で。

最終更新: 2026-05-04 (Beta 直前整備)

> **対になるドキュメント**
> - 障害時のフロー: [`incident-response-runbook.md`](incident-response-runbook.md)
> - 検知層: [`sentry-alerts.md`](sentry-alerts.md)
> - launch スケジュール (= rotation 移行のタイミング): [`../release/beta-launch-plan.md`](../release/beta-launch-plan.md)

---

## 1. 現状 (Beta 直前 / 2026-05-04 時点)

### 構成

- **on-call = 自分 1 人** (= yusuke、 24/7 暗黙)
- **副 on-call = なし**
- **ローテーション = なし**
- **通知経路**:
  - Sentry → メール + Slack `#ops` (Sentry → Slack integration 済)
  - Vercel cron 失敗 → Vercel ダッシュボード email
  - PostHog → なし (alert 未設定、 dashboard で目視のみ)

### 隠れた依存

- **妻** が二次的な目視テスター。 alert 経路には乗っていないが、 prod を
  普通に使うので「真っ白画面」 のような SEV1 を最初に気づく可能性が高い
  (実際 2026-05-03 incident は妻が気づいた)
- **Claude (= AI assistant)** = 開発時には常駐、 障害対応にも一次 triage
  として呼べる (= 後述 §4.2 で正式に組み込む選択肢を検討中)

### 当面の制約

- 個人開発 + 無料プラン + Beta 期間 = **PagerDuty / OpsGenie 等の有料
  on-call ツールに月 $25-50 を払う ROI はまだ無い**
- 一人に夜中の電話は鳴らない方が、 翌日のクオリティが高い
- ただし SEV1 の検知から復旧までの中央値は **30 分以内が目標**
  (「朝起きてから対処」 では遅すぎる場合がある)

---

## 2. ツール / サービス比較

### 2.1 評価軸

| 軸 | 重み | 説明 |
|---|---|---|
| 月額コスト | 高 | Beta 期は無料 / 安価が必須 |
| セットアップ時間 | 高 | 1 日で立ち上がるか |
| 通知経路の柔軟性 | 中 | メール / Slack / SMS / 電話を SEV ごとに分ける機能 |
| ローテーション機能 | 中 | 副 on-call が増えたとき、 schedule を回せるか |
| Sentry との integration | 高 | 既存の Sentry alert を流用できるか |
| 学習コスト | 中 | UI が直感的か、 ドキュメントが日本語に強いか |

### 2.2 候補

| Tool | 月額 (個人) | 月額 (3-5 人) | Sentry integration | ローテ | 評価 |
|---|---|---|---|---|---|
| **Slack のみ** (現状) | 無料 | 無料 | ✅ Slack channel 通知 | ❌ | Beta 期はこれで十分 |
| **Slack + Better Stack (旧 Better Uptime)** | $0-29/mo | $89-/mo | ✅ Sentry webhook receiver あり | ✅ | Open Beta の 50 名段階で検討、 uptime ping も拾える |
| **PagerDuty** | $21/月 | $83-/月 | ✅ ファーストパーティ integration | ✅✅ | GA / 100+ 名で必須化、 Better Stack より rotation が成熟 |
| **OpsGenie** (Atlassian) | $19/月 | $52-/月 | ✅ | ✅ | Atlassian エコシステム使うなら、 単独評価では PagerDuty に劣る |
| **Grafana On-Call (旧 Cloud)** | 無料 (1 user) | $19-/月 | ✅ Sentry transformer 有り | ✅ | OSS 系を好むチーム向け、 Beta 期の代替候補 |
| **Custom (Cron + メール)** | 無料 | 無料 | △ 自作 | ❌ | 手作りの落とし穴多すぎる、 推奨しない |

### 2.3 推奨 (= 段階移行プラン)

| 段階 | 想定タイミング | 推奨スタック | 月額追加費用 |
|---|---|---|---|
| **0. Beta-private (5-10 名)** | 現状 | Slack `#ops` only + 自分のメール | $0 |
| **1. Closed Beta (10-20 名)** | T+0 | + Better Stack の Free tier (uptime ping x 1) | $0 |
| **2. Open Beta cut1 (50 名)** | T+2w | + Better Stack 有償化、 rotation を週次自分のみ | $29/mo |
| **3. Open Beta cut2 (200 名)** | T+4w | + 副 on-call (= 任意の協力者) を追加、 rotation 成立 | $29/mo |
| **4. GA + 1000 DAU** | T+6w 〜 | PagerDuty に移行、 SMS / 電話通知 enable | $21-83/mo |

### 2.4 段階を進める判断材料

「自動的に上の段階に進む」 のではなく、 各段階の出口条件を明文化:

- **0 → 1**: Closed Beta cut1 を実行する (= [`beta-launch-plan.md`](../release/beta-launch-plan.md) §2 gate を通る)
- **1 → 2**: Closed Beta 期間で SEV1/2 が 1 件でも発生 OR 50 名規模を超える
- **2 → 3**: 副 on-call を引き受ける人が決まる (家族 / 友人エンジニア /
  業務委託の誰か。 「組織化」 を意味しないので軽量で良い)
- **3 → 4**: DAU 1000 を超える OR 課金導入で SLA を顧客に表明する

---

## 3. 段階別の運用詳細

### 段階 0 / 1 (現状 + Closed Beta)

- **on-call schedule**: 24/7 自分。 ただし「夜は出ない」 ことを self-promise
- **alert 経路**:
  - SEV1 → Slack `#ops` + 自分のメール (Sentry P1 ルール経由)
  - SEV2 → Slack `#ops` (Sentry P2 ルール経由)
  - SEV3 → Sentry weekly digest
- **応答時間 (= 暗黙 SLA)**:
  - SEV1 朝起きてから 1 時間以内
  - SEV2 営業日 4 時間以内
  - SEV3 翌週レビュー
- **doc**: 本ドキュメント + [`incident-response-runbook.md`](incident-response-runbook.md) のみ

### 段階 2 (Open Beta cut1, 50 名)

- **on-call schedule**: 週次。 自分が primary、 secondary 無し (まだ)
- **新規導入**: Better Stack ($29/月)
  - heartbeat ping: `/api/cron/supabase-health` を「正常完了」 シグナル化
  - status page (= public): https://status.haretoki.app に自動更新
  - on-call schedule 機能は使わない (まだ 1 人なので意味がない)
- **応答時間 SLA**:
  - SEV1 30 分以内
  - SEV2 2 時間以内
- **doc 追加**: status page の運用ルール (どう公開するか / 隠すか の判断)

### 段階 3 (Open Beta cut2, 200 名)

- **on-call schedule**: 週次 primary + secondary。 secondary は週 1 回
  (週末) を引き受ける形でも可
- **新規導入**:
  - Better Stack の rotation を有効化
  - 副 on-call 役の 連絡先 + 連絡時刻ルール (例: SEV1 のみ電話)
- **応答時間 SLA**:
  - SEV1 15 分以内 (副 on-call が起きていれば)
  - SEV2 1 時間以内
- **doc 追加**: 副 on-call onboarding ガイド (何を見たら / 何を触るな)

### 段階 4 (GA, 1000+ DAU)

- **on-call schedule**: PagerDuty で週次 rotation、 N 人体制
- **新規導入**:
  - PagerDuty integration を Sentry / Vercel / Supabase 全部に
  - Slack `#ops-p1` 専用 channel
  - on-call 手当 (= 人事 / 会計の話、 個人開発を抜けたあと)
- **応答時間 SLA**: 顧客対面の SLA 表明 (有料プランの場合)
- **doc 追加**: SLA agreement template / 課金 incident credit 規約

---

## 4. 検討中の選択肢

### 4.1 status page (= public 化)

Better Stack に乗り換えた段階 (= cut1) で、 status.haretoki.app を **公開** する
案。 メリット:
- ユーザーが「私の問題か / サービスの問題か」 を即判断できる
- Sentry alert を裏で見るより、 ユーザーが status page を見て自然消滅
- Beta 期間中の透明性は信頼形成に効く

デメリット:
- 細かい劣化 (P3 級) を公開すると「いつも壊れてる」 印象を与える
- 公開前に「何を載せるか」 のルールが必要 (= SEV1/2 のみ載せる、 P3 は
  載せない、 等)

**判断**: cut1 で立てる。 SEV1/2 のみ載せる ルールで開始。

### 4.2 Claude (= AI assistant) を first-line triage に組み込む

選択肢として面白いが、 リスク評価が要る:

- **メリット**:
  - SEV1 の一次応答 (= §3 開始時の `incident-open` template 起票、
    Sentry issue 取得、 Vercel log 取得) を自動化できる
  - 過去事例の遡上 (= 似たような incident あったか) が高速
  - 24/7 動く
- **デメリット / リスク**:
  - 「復旧アクション」 を Claude に任せるのは絶対に禁忌 (= prod 操作)
  - 一次応答だけで止めるとして、 通知ペイロードの解釈ミスがあると
    人を起こす無駄打ちが増える可能性
  - Anthropic 側の障害が原因の incident だと、 そもそも Claude が動かない
- **採用判断**:
  - 段階 1 / 2 では試さない (= 過去事例蓄積待ち)
  - 段階 3 で「過去 6 ヶ月 の SEV1/2 が 5 件以上ある」 を条件に試行
  - 試行内容: Sentry webhook → 自前 Lambda → Claude API → Slack
    `#ops` に「これは SEV<推測>、 過去事例: <類似>」 とポストするだけ
  - **判断主体は人間**、 Claude は presenter

### 4.3 副 on-call 候補の選び方

段階 3 で必要になる。 候補軸:

| 候補 | メリット | デメリット |
|---|---|---|
| 家族 (= 妻) | 元から prod を使う、 信頼関係あり | エンジニアではないので復旧操作不可、 検知のみ |
| 友人エンジニア | 復旧操作可能、 文化を共有 | 副業 / 趣味の範囲、 連続性弱い |
| 業務委託 (= フリーランス) | プロ、 SLA を求められる | コスト、 文化の摺り合わせ要 |
| co-founder の招聘 | 完全な事業パートナー | 株式 / 報酬の交渉、 Beta 期間で時期尚早 |

**Beta 期は家族 + 友人エンジニア が現実的**。 GA 移行時に再評価。

---

## 5. 段階移行のチェックリスト

新しい段階に進むときに確認:

### 段階 1 → 2 (Better Stack 導入)

- [ ] Better Stack アカウント開設、 status page 設定
- [ ] heartbeat ping を `/api/cron/supabase-health` に enable
- [ ] Sentry → Better Stack webhook 接続
- [ ] Slack `#ops` の Better Stack 通知 channel ペイン分け
- [ ] [`sentry-alerts.md`](sentry-alerts.md) を update (= Better Stack 経路を反映)

### 段階 2 → 3 (副 on-call 追加)

- [ ] 副 on-call 役 1 名 確定 (= 名前、 連絡先、 同意)
- [ ] Better Stack の rotation を週次設定
- [ ] 副 on-call 用 onboarding doc 作成 (= 別 file)
- [ ] 副 on-call の Slack `#ops` 招待
- [ ] 月 1 回の "shadow incident" 練習を schedule

### 段階 3 → 4 (PagerDuty 移行)

- [ ] PagerDuty 契約 + 全 integration 切り替え
- [ ] SLA agreement template 完成
- [ ] 課金導入時の credit 規約 PR
- [ ] PagerDuty 経由の dry run incident drill 実施

---

## 6. 関連ドキュメント

- 障害対応フロー: [`incident-response-runbook.md`](incident-response-runbook.md)
- DR drill plan: [`dr-drill-plan-2026-Q3.md`](dr-drill-plan-2026-Q3.md)
- launch スケジュール: [`../release/beta-launch-plan.md`](../release/beta-launch-plan.md)
- Sentry alert 設計: [`sentry-alerts.md`](sentry-alerts.md)

---

## 7. 更新ルール

- 段階を進めるたびに §1 と §3 を update
- ツール乗り換えは §2 候補表に「採用」 / 「却下 + 理由」 を append
- 副 on-call が変わったら §4.3 を refresh
- 半年に 1 回は §2.3 推奨スタックの月額が変わっていないか確認 (各社
  pricing は割と動く)
