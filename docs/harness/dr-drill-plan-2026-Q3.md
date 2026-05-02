# DR Drill Plan — 2026 Q3

「晴れ時 (Haretoki)」 の **第 1 回 Disaster Recovery (DR) drill** 計画書。
Beta release 直後 (= 2026 Q3 想定) に半日かけて 4 シナリオを通し、
復旧手順 / SLO / 検知経路の **実走確認** を行う。

> 「runbook を書いた」 と「runbook が動く」 は別。 drill は後者を保証する
> 唯一の手段。

最終更新: 2026-05-04 (Beta 直前、 第 1 回 drill 計画立案)

> **対になるドキュメント**
> - 障害対応フロー: [`incident-response-runbook.md`](incident-response-runbook.md)
> - service-specific 復旧:
>   - Supabase: [`supabase-auto-pause-prevention.md`](supabase-auto-pause-prevention.md)
>   - Resend: [`webhook-ops.md`](webhook-ops.md)
> - on-call 体制: [`on-call-rotation.md`](on-call-rotation.md)
> - rollback 全体: [`../release/beta-launch-plan.md`](../release/beta-launch-plan.md) §5

---

## 1. drill の目的 (= なぜ走らせるか)

prod が動いている状態で 4 シナリオを **意図的に発火** し、 以下を測る:

1. **検知 SLO** — 何分で気づくか (= alert 経路が機能するか)
2. **判断 SLO** — 何分で SEV を判定 + Slack 起票するか (= runbook が
   読める状態か)
3. **復旧 SLO** — 何分でユーザー影響をゼロに戻すか (= service-specific
   runbook が正確か)
4. **後 review の質** — postmortem template が「翌日 開いて埋められる」
   状態か

drill の **失敗** は許容。 失敗から runbook を refine する目的なので、
本番 SEV1 と違って恥ずかしくない。 むしろ全部成功すると drill が易すぎる。

---

## 2. drill 前提

### 2.1 timing

- **第 1 回**: Open Beta cut1 (50 名) 着地後 2 週間以内
- **以降**: 半年に 1 回 (シナリオは更新される)
- **時間帯**: 平日 14:00-17:00 JST (= 万一 drill 中に本物の SEV1 が
  発生しても自分が対応可能な時間帯)

### 2.2 参加者

- on-call 段階に応じる:
  - 段階 0/1 (現状): 自分 1 人 (= self-drill、 後 review のみ家族と)
  - 段階 2 以降: 自分 + 副 on-call

### 2.3 影響範囲管理

drill は **本番 prod に対して実行する**。 ただし:

- ユーザー影響を 5 分以内に止められる経路 (= rollback or env flag) を
  事前確認
- drill 開始前に Better Stack status page に「メンテナンス中」 を貼る
  (段階 2 以降)
- drill 中に発生した本物の incident は **drill を中断して優先**
- drill 終了後、 status page を「正常」 に戻す

---

## 3. 4 シナリオ詳細

### Scenario A — Supabase auto-pause 復旧 drill

#### 想定脅威
本番 Supabase project が auto-pause で API を返さなくなる
(= 2026-05-03 incident の再現)。

#### 発火方法
**意図発火しない** (= 副作用が大きい)。 代わりに:

1. **dry-run**: dev Supabase project (= 別環境) を pause → /admin/health
   が dev 向けに probing できる時のみ。 もし dev が無ければ skip。
2. **walk-through**: 本ドキュメント §3.1 後半の手順を文章で逐次
   読み上げ + タイマー測定。 pause せずに「もし起きたら何分で何を
   するか」 を確認

#### SLO

| 段階 | 検知 SLO | 判定 SLO | 復旧 SLO |
|---|---|---|---|
| 検知 | 5 分 (= daily ping cron / Sentry P2-email) | — | — |
| 判定 | — | 5 分 (= SEV1 確定 + Slack incident-open) | — |
| 復旧 | — | — | 10 分 (= dashboard Restore + verify) |
| **合計 (RTO)** | | | **20 分** |

#### 成功条件
- daily ping cron が次の朝までに warning を発火
- `/admin/health` が Supabase 行を `failed` で表示
- [`supabase-auto-pause-prevention.md`](supabase-auto-pause-prevention.md) §3 の手順を
  読み上げてタイマー 10 分以内に「Restore + verify」 まで完了

#### 後 review チェック
- [ ] runbook §3 の手順が現在の Supabase dashboard UI と一致しているか
- [ ] verify の `curl` 例の `<project-ref>` が prod 値と一致するか
- [ ] timing が SLO を超えたら、 どこで遅れたか (= 検知 / 判定 / 復旧 のどれか)

---

### Scenario B — Vercel deployment rollback drill

#### 想定脅威
deploy 直後に prod が壊れる (= 5xx 多発、 hydration crash、 CSP 違反、
新規 migration が runtime で失敗、 等)。 直前 deploy が原因と特定する
時間がもったいないので、 **まず rollback** する流れの確認。

#### 発火方法
1. preview ブランチに **意図的に壊れた commit** を作る (例: 主要
   server action から `redirect()` を削除して 500 を返すようにする)
2. preview deploy が "Ready" になることを確認 (= preview の 500 だけ
   発生 → ユーザー影響なし、 安全)
3. **prod に promote する**。 5xx が立ち上がるのを Sentry で確認
4. タイマー開始

#### SLO

| 段階 | SLO |
|---|---|
| 検知 | 2 分 (= Sentry P1 page or 自前 curl で発見) |
| 判定 | 1 分 (= "deploy 直後 = まず rollback" の判断) |
| 復旧 | 5 分 (= Vercel dashboard で前 deploy を Promote、 反映 1-2 分) |
| **合計 (RTO)** | **8 分** |

#### 成功条件
- 8 分以内に prod が直前安定 deploy に戻る
- ユーザー (= self-test browser) が真っ白を見る時間が 5 分以内
- rollback 後、 壊れた deploy の URL を Slack に残して原因調査の
  起点にする

#### 後 review チェック
- [ ] [`incident-response-runbook.md`](incident-response-runbook.md) §4.1 の手順は
      Vercel dashboard 現行 UI と一致しているか
- [ ] preview で意図的に壊す方法を documenting (= 次回 drill で再利用)
- [ ] 自動 rollback (rolling-release) を GA 前に有効化したいか判断

---

### Scenario C — Anthropic 全停止 (= AI 機能 graceful degrade)

#### 想定脅威
Anthropic API が rate limit / outage で全リクエスト失敗。 AI コーチ /
レコメンド / fit-reason / matrix-insight / ritual 等すべて死ぬ。
DISABLE_AI=1 で graceful fallback できるはずの確認。

#### 発火方法
1. dev で `ANTHROPIC_API_KEY` を invalid value に上書き → 全 AI 呼び出し
   が 401 で失敗することを確認
2. prod で **DISABLE_AI=1** を Vercel env に追加 + redeploy
3. 各 AI surface (コーチ / 候補 / 比較 / ホーム) を回って「AI 一時停止
   中」 fallback copy が出ることを目視
4. DISABLE_AI を rm + redeploy で復旧

#### SLO

| 段階 | SLO |
|---|---|
| 検知 | 5 分 (= Sentry P2 email、 ai_call エラー多発) |
| 判定 | 5 分 (= SEV2 = 「主要機能の劣化」 と確定) |
| 一次 mitigation | 10 分 (= DISABLE_AI=1 + redeploy で fallback 化) |
| 復旧 | Anthropic 復旧次第 (= 数十分 〜 数時間) |
| **mitigation RTO** | **20 分** (復旧そのものではなく degrade-with-grace に持ち込む時間) |

#### 成功条件
- 20 分以内に AI surfaces が「AI 一時停止中」 copy にフォールバック
- 非 AI 機能 (venue 一覧 / 見学 / 候補 / 家族リンク等) が不影響
- ユーザーが見る画面に「真っ白」 や「500 エラー」 が出ない

#### 後 review チェック
- [ ] 各 AI surface (= 5 つほど) が graceful fallback を持っているか
      個別に test
- [ ] DISABLE_AI=1 の env 追加 → reflect までの時間 (= Vercel
      env update + redeploy = 2-3 分が目標)
- [ ] fallback copy の trade-off (= 「AI 一時停止中」 という露骨な
      copy か、 もっと柔らかいか) を UX レビュー

---

### Scenario D — Resend outage (= 通知 / メールの degrade)

#### 想定脅威
Resend が rate limit / outage で `sendEmail` が連続失敗。 partner invite /
visit reminder email / push subscription confirm / Beta feedback すべて
発信不能。

#### 発火方法
1. prod で `RESEND_API_KEY` を invalid value に上書き + redeploy
2. 自分から自分に partner invite を発火 → Sentry で `sendEmail
   failed` を確認
3. visit reminder cron を手動 trigger → push は届く / email だけ落ちる
   ことを確認 (= 設計通りの分離)
4. Beta feedback フォームを submit → 「success」 toast が出ることを確認
   (= recoverability contract 通り、 ユーザー視点では成功扱い)
5. RESEND_API_KEY を正しい値に戻す + redeploy

#### SLO

| 段階 | SLO |
|---|---|
| 検知 | 30 分 (= P2-email 経路 + 自分の "招待届かない" 自己 test) |
| 判定 | 10 分 (= SEV2 と確定、 "メール一時停止" status page 更新) |
| 一次 mitigation | 0 分 (= 既に recoverability contract で graceful) |
| 復旧 | Resend 復旧次第 |
| **graceful confirmation RTO** | **40 分** |

#### 成功条件
- visit reminder の **push leg** は届く (email だけ落ちる)
- Beta feedback フォームは「success」 toast を出す (server log + audit
  row に保存される)
- partner invite は失敗するが、 ユーザーには「うまく送れませんでした」
  ではなく「再送する」 ボタンが出る
- 復旧後、 Resend webhook が deferred event を replay して `notifications`
  テーブルの `email_delivery_status` が更新される

#### 後 review チェック
- [ ] [`webhook-ops.md`](webhook-ops.md) §5 の "webhook 受信件数 sanity"
      query が outage 中に「受信ゼロ」 になることを確認
- [ ] partner invite UI が email 失敗を user-friendly に伝えるか
- [ ] visit reminder の push / email 分離が pin されたままか
      (新 cron / 新 surface 追加時に意図せず coupled する罠)

---

## 4. drill 進行 (半日タイムテーブル)

```
14:00 - 14:30  drill 開始準備
                - status page に「メンテナンス中」 表示
                - Sentry / Slack / Better Stack を 1 ウィンドウに並べる
                - timer + recording 準備
14:30 - 15:00  Scenario A — Supabase auto-pause walk-through
15:00 - 15:30  Scenario B — Vercel rollback drill (実発火)
15:30 - 16:00  Scenario C — Anthropic degrade drill (DISABLE_AI=1 実発火)
16:00 - 16:30  Scenario D — Resend outage drill (key 無効化)
16:30 - 17:00  後 review session
                - 各 SLO 達成 / 未達 を表に記入
                - 失敗した手順を runbook 側で update する list 化
                - 次回 drill (= 半年後) のシナリオ案
17:00          status page を「正常」 に戻して終了
```

---

## 5. 後 review template

drill のたびに本ドキュメント §6 history に append:

```markdown
### YYYY-MM-DD 第 N 回 DR drill

**参加者**: yusuke (+ secondary)
**所要**: HH:MM 〜 HH:MM (合計 N 分)

#### Scenario A (Supabase) — [✅/⚠️/❌]
- 検知: HH:MM (SLO N 分、 実 N 分)
- 判定: HH:MM (SLO N 分、 実 N 分)
- 復旧: HH:MM (SLO N 分、 実 N 分)
- 学び: ...
- 更新する runbook: ...

#### Scenario B (Vercel) — [✅/⚠️/❌]
... (同上)

#### Scenario C (Anthropic) — [✅/⚠️/❌]
... (同上)

#### Scenario D (Resend) — [✅/⚠️/❌]
... (同上)

#### 共通の学び
- ...

#### 次回 (= 半年後) のシナリオ案
- 削除: [古いシナリオで意味なくなったもの]
- 追加: [新サービス / 新機能 で増えたシナリオ]
```

---

## 6. drill history

第 1 回以降、 drill のたびに append。

(まだ実施なし — 第 1 回は Open Beta cut1 着地後 2 週間以内)

---

## 7. 関連ドキュメント

- 障害対応フロー: [`incident-response-runbook.md`](incident-response-runbook.md)
- on-call 体制: [`on-call-rotation.md`](on-call-rotation.md)
- service-specific runbook:
  - [`supabase-auto-pause-prevention.md`](supabase-auto-pause-prevention.md)
  - [`webhook-ops.md`](webhook-ops.md)
- launch スケジュール: [`../release/beta-launch-plan.md`](../release/beta-launch-plan.md)
- Sentry alert 設計: [`sentry-alerts.md`](sentry-alerts.md)

---

## 8. 更新ルール

- drill のたびに §6 history に postmortem を append
- 新 service / 新 critical path が追加されたら §3 にシナリオを追加
  (例: GA 後の Stripe 課金 outage drill)
- 半年に 1 回は §3 全シナリオを「現状の runbook と一致しているか」 で
  refresh
- on-call 段階が進んだら §2.2 参加者を update
