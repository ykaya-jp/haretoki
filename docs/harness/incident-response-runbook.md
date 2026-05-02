# Incident Response Runbook

「晴れ時 (Haretoki)」 本番障害時の **対応プレイブック**。 何が起きたら誰が
何分で何を判断するかを、 寝起きの脳でも追える形で 1 ファイルに集約。

範囲: prod 環境のユーザー影響障害 (= サービスが落ちている / データが消えた
/ 認証バイパス / 課金エラー)。 開発・preview 環境のトラブルは
[`runbook.md`](runbook.md) (= 開発フロー側) を見る。

最終更新: 2026-05-04 (Beta 直前整備、 §6 過去事例に Supabase auto-pause を反映)

> **対になるドキュメント**
> - 検知層: [`sentry-alerts.md`](sentry-alerts.md) — alert taxonomy + ルール
> - サービス特化 runbook:
>   - Supabase: [`supabase-auto-pause-prevention.md`](supabase-auto-pause-prevention.md)
>   - Resend webhook: [`webhook-ops.md`](webhook-ops.md)
> - on-call ローテ + ツール選定: [`on-call-rotation.md`](on-call-rotation.md)
> - DR 想定 + drill plan: [`dr-drill-plan-2026-Q3.md`](dr-drill-plan-2026-Q3.md)
> - rollback フラグ一覧 + cross-link: [`../release/beta-launch-plan.md`](../release/beta-launch-plan.md) §5

---

## 1. SEV (severity) 階級

すべての障害は **検知から 5 分以内に SEV を確定** させる。 SEV は対応中に
昇降できる (= "SEV3 と思ったら SEV1 だった" は普通)。 当てはまる行が
複数あるときは **より重い方を採用** する。

| SEV | ユーザー影響 | データ影響 | 反応時間 (検知 → 一次応答) | エスカレーション |
|---|---|---|---|---|
| **SEV1** | サービス完全停止 / 認証バイパス / **すべてのユーザー** | 永続データ損失 / セキュリティ侵害 | **5 分以内** | 即座に on-call + 二次オーナー |
| **SEV2** | 主要機能の大規模劣化 / 50%+ ユーザー影響 | 復旧可能なデータエラー | **30 分以内** | on-call 単独 + 1h 以内に 二次共有 |
| **SEV3** | 個別機能の劣化 / 10%- ユーザー影響 | 影響なし or 軽微 | **2 時間以内** | on-call 単独、 翌営業日 review |
| **SEV4** | UX rough edge / 単一ユーザー報告 | 影響なし | 翌営業日 | 通常チケット扱い |

**SEV1 の判定例**:
- prod が真っ白画面 (2026-05-03 incident は SEV1)
- 全ユーザーの auth が失敗
- ユーザーデータが部分的に消失している兆候 (Sentry の `user.delete.failed` 5+/h)
- Resend webhook の HMAC verification が連続失敗 (= 中間者の疑い)

**SEV2 の判定例**:
- AI 機能 (コーチ / レコメンド) が全滅、 他は動く (Anthropic 障害想定)
- 見学リマインダー push が前夜から届いていない (cron 失敗)
- 家族リンクが全件 expired 表示 (DB or token 系のバグ)

**SEV3 の判定例**:
- 特定 venue 詳細ページだけ 500 (URL import に起因する row 異常)
- 個別ユーザーのメール 1 通が届かなかった (Resend 単発 bounce)
- 1 個別 cron が 1 回失敗 (次回成功で自動解消)

**SEV4 の判定例**:
- コピーの誤字
- mobile 375px で 1 ボタンが見切れている
- 「ボタンの位置が変」 1 件のフィードバック

---

## 2. 一次応答チェックリスト (検知 → 5 分以内)

SEV に関わらず、 検知したら **以下の 4 ステップを順番に**:

1. **SEV 判定** (本ドキュメント §1)
2. **状況の宣言** — まず宣言。 その後で動く
   - SEV1/2: Slack `#ops` に下記 §3 incident-open template を貼る
   - SEV3: GitHub issue を切る (label: `incident-sev3`)
   - SEV4: 通常 issue
3. **証拠の保全** — 復旧アクションを取る前に、 何が起きていたかを記録
   - Sentry の該当 issue URL
   - Vercel deployment URL + 直近 30 分の log
   - `/admin/audit` の最新行 (もしくは `/admin/health` のスクリーンショット)
   - 影響ユーザー数の概算 (PostHog DAU / cron 結果から逆算)
4. **復旧アクション** — §4 の service-specific runbook に従う

> 順番が重要。 焦って (4) に走ると後で「なぜ起きたか」 が分からなくなる。

---

## 3. コミュニケーション template

`#ops` Slack にコピペする想定。 全角ブラケット部だけ埋める。

### incident-open (SEV1/2 開始時)

```
🚨 INCIDENT OPEN — SEV[1|2]
event: [何が起きたか 1 行]
detected_at: [JST HH:MM]
detected_via: [Sentry / 自分でチェック / ユーザー報告]
suspected_scope: [すべて | AI 機能のみ | partner 連動のみ | 不明]
on-call: [@yusuke]
runbook: [本ドキュメント or service-specific URL]
sentry: [Sentry issue URL]
vercel: [deployment URL]
next_update_in: 15 分
```

### update (15-30 分ごと)

```
🟡 INCIDENT UPDATE — SEV[1|2]
elapsed: [N 分]
hypothesis: [何が原因と思っているか]
mitigation_taken: [何をしたか]
mitigation_pending: [次に何をするか]
user_impact_estimate: [N 名 / N% / 不明]
next_update_in: 15 分
```

### resolve (復旧確認後)

```
✅ INCIDENT RESOLVED — SEV[1|2]
elapsed_total: [N 分]
root_cause: [1 行で]
fix: [何をしたか]
user_impact: [最終 N 名 / N% / なし]
postmortem_due: [SEV1: 24h 以内、 SEV2: 1 週間以内]
runbook_updates_needed: [yes/no、 yes なら何を]
```

### postmortem テンプレ

SEV1 / SEV2 は必ず postmortem。 GitHub issue に下記 template:

```markdown
# Postmortem: [タイトル] — YYYY-MM-DD

## サマリ
- duration: HH:MM 〜 HH:MM (N 分)
- severity: SEVx
- user impact: N 名 / N%

## タイムライン (JST)
- HH:MM event 1
- HH:MM event 2
- ...

## 根本原因
[2-3 段落]

## 何が良かったか / 悪かったか
- 良: ...
- 悪: ...

## アクションアイテム
- [ ] [短期 fix] (期日 YYYY-MM-DD、 担当 @who)
- [ ] [中期 prevention] (期日、 担当)
- [ ] [長期 systemic] (期日、 担当)

## 学び (lessons.md に上げるか？)
[1 行で]
```

---

## 4. Service-specific 復旧ハンドオフ

各サービスの一次対処は専用 runbook に切り出している。 本ドキュメントは
**どこを見るか** を指す:

| 兆候 | まず見る | 復旧 SLO 目安 |
|---|---|---|
| prod が真っ白画面 + Auth エラー多発 | [`supabase-auto-pause-prevention.md`](supabase-auto-pause-prevention.md) §3 | RTO 5 分 (Restore ボタン + verify) |
| メールが届かない / bounce 多発 | [`webhook-ops.md`](webhook-ops.md) §1, §6 | RTO 30 分 (1 user) / 2h (全体) |
| AI コーチ / レコメンドが動かない | Anthropic status (https://status.anthropic.com/) → §4.2 | RTO 5 分 (DISABLE_AI=1 + 再 deploy) |
| cron が動いていない | `/admin/health` Cron 行 → 該当 cron の route file | RTO 30 分 |
| 全機能が遅い (TTFB > 5s) | Vercel dashboard → Functions → 直近 invocation | RTO 15 分 (rollback) |

### 4.1 Vercel deployment rollback (どんな SEV1 でも有効)

最後の手段。 直近 deploy が原因と疑われる SEV1 では、 **原因特定より先に
rollback** する。 「動いていた状態に戻す」 が常に最速の復旧:

1. https://vercel.com/<team>/haretoki/deployments を開く
2. `Production` 一覧で **直前の "Ready" deployment** を見つける
3. 右の `…` → **Promote to Production**
4. 5 分以内に prod URL で復旧確認
5. 原因 deployment は `Disabled` にせず残す (postmortem 用)

> Vercel の自動 rollback (rolling-release) が有効な場合は手順 3 が
> "Roll back" ボタンに変わる。 GA 直前に rolling-release 切替予定。

### 4.2 Anthropic 全停止

DISABLE_AI=1 で AI surfaces を一時オフにする (= ユーザーには「AI 一時停止
中」 copy にフォールバック)。 全機能が止まるよりは劣化運用が良い:

```bash
# Vercel CLI から
vercel env add DISABLE_AI production
# 値: 1
# 即時反映には deploy が必要
vercel --prod
```

復旧後は `vercel env rm DISABLE_AI production` で削除し、 もう一度
deploy。 詳細は `.env.example` の DISABLE_AI コメント参照。

### 4.3 すべての対処の最後 — verify

復旧アクション後、 必ず **2 つの surface で実通信を確認**:

```bash
# 1. landing 200 OK
curl -s -o /dev/null -w "%{http_code}\n" https://haretoki.app/

# 2. /admin/health が live probe で OK を返している
# (admin email でログインして手動確認)
```

両方 OK が出るまで「復旧」 と宣言してはいけない。

---

## 5. SEV1 で「自分が起きていない」 ときの対応

Beta 期間中は **on-call = 自分一人** ([`on-call-rotation.md`](on-call-rotation.md) §1)。
緊急で対応できない時間帯がある前提で、 **degrade-with-grace** な復旧経路を残す:

- Vercel cron は止めない (止め方は後述 §5.2、 ただし基本は触らない)
- ユーザーに見えるエラー画面は「うまく表示できませんでした」 で固定
  (= サービス停止アナウンスではない、 復旧次第で自然消滅)
- Sentry の P1 alert が PagerDuty に乗る GA 段階までは、 Slack #ops が
  メイン通知経路。 自分が朝起きてから対処する前提

### 5.1 妻が代わりに気づいたとき

妻 (= co-Beta tester) は本ドキュメントを読まなくていい。 ただし代わりに
気づいたら下記 1 行のメッセージを Slack か LINE に投げる:

```
prod 真っ白っぽい / アプリ動かない、 確認お願い
```

それ以上の trouble-shooting を依頼しない (誤った操作で状況悪化リスク)。

### 5.2 「絶対押すな」 ボタン (= 不可逆 / 全停止級)

下記は **on-call 1 人 では絶対に押さない**。 SEV1 でも一晩寝かす方が良い:

- Vercel project の Delete
- Supabase project の Delete (Pause は OK、 Restore で戻る)
- Prisma `migrate reset` を prod DB に対して
- `git push --force` を main / develop に対して
- Vercel env の **大量** rm (1 つずつなら可、 5+ 同時は次の朝)

---

## 6. 過去事例

incident のたびに **最低 3 行で要約を append** する。 タイムライン詳細は
個別の postmortem issue に。

### 2026-05-03 — Supabase free-tier auto-pause (SEV1, ~3 分)

- 検知: 17:13 JST、 user (= 自分) が prod 訪問 → 真っ白画面 + AuthApiError
- 復旧: 17:16 JST、 Supabase dashboard Restore (推定 自動復帰)
- 学び: 7 日 inactivity で auto-pause、 daily ping cron で防止する
  (`supabase-auto-pause-prevention.md` §5.1 にて実装済 = 0 4 UTC)
- 詳細: [`supabase-auto-pause-prevention.md`](supabase-auto-pause-prevention.md) §1

---

## 7. 学び → アクション化のループ

postmortem の **Lessons セクション** は、 必ず以下のどれかにフィードバック:

1. 短期 fix (24h 以内) → GitHub PR
2. runbook 更新 (本ドキュメント or service-specific runbook)
3. 検知強化 (`sentry-alerts.md` の rule 追加)
4. ユーザー向け copy 改善 (関連 doc / lessons.md)
5. プロダクト側の挙動変更 (= prevention に踏み込む) → ADR + PR

「学んだだけ」 で止めない。 fix or runbook 更新まで持っていって初めて
"レッスンを学んだ" と言える。

---

## 8. 更新ルール

- SEV1 / SEV2 のたびに §6 過去事例を append
- §1 SEV 判定例の表現を実例に合わせて refine
- §4 service-specific 復旧手順は対応する specialised runbook 側で
  詳細を更新、 本ドキュメントはハンドオフのみ
- 半年に 1 回は §2 一次応答チェックリストを実際の incident 進行と
  照合 (drift してないか)
