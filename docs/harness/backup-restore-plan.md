# Backup & Restore Plan

「晴れ時 (Haretoki)」 のデータバックアップと復旧手順。 Beta release
までの Free tier 期間と、 Pro 移行後の運用差分をひとつにまとめたもの。
DR drill ([`dr-drill-plan-2026-Q3.md`](dr-drill-plan-2026-Q3.md)) の
シナリオ A (Supabase) は本ドキュメントの手順を実走確認する場でもある。

最終更新: 2026-05-04 (Phase 4 — Beta launch ops 強化)

> **対になるドキュメント**
> - 障害対応フロー: [`incident-response-runbook.md`](incident-response-runbook.md)
> - サービス特化: [`supabase-auto-pause-prevention.md`](supabase-auto-pause-prevention.md)
> - DR drill: [`dr-drill-plan-2026-Q3.md`](dr-drill-plan-2026-Q3.md)
> - migration safety guard: `scripts/check-migration-safety.sh`
> - launch スケジュール: [`../release/beta-launch-plan.md`](../release/beta-launch-plan.md)

---

## 1. 前提 — 何が「データ」 か

Haretoki が抱える状態:

| データ層 | 種類 | 重要度 |
|---|---|---|
| **Supabase Postgres** | User / Project / Venue / Visit / Decision / Notification / AuditLog 等 | **最重要** — 失うと全部終わり |
| **Supabase Storage** | venue-photos / visit-photos / estimates buckets | 重要 — UI が崩れる、 復旧可能 (= 元写真再 upload) |
| **Vercel KV / Upstash Redis** | rate-limit bucket、 揮発で OK | 低 — 再生成可能、 backup 不要 |
| **Anthropic AiCache (Postgres内)** | cost 削減用 cache | 中 — 失っても再 fill するだけ |
| **Vercel build artifacts** | .next 出力、 immutable | 低 — git から再生成可能 |

→ **backup の対象は Postgres と Storage**。 残りは backup 不要。

---

## 2. 現状 — Free Tier の自動バックアップ

### 2.1 Supabase Free Tier 仕様

(2026-05 時点の Supabase 公式ドキュメント基準。 価格表が変わるたびに
本セクションも更新する)

| 項目 | Free | 補足 |
|---|---|---|
| Postgres バックアップ | **過去 7 日分のスナップショット** (1日1回、 dashboard から download / restore) | restore は dashboard UI からのみ |
| PITR (Point-In-Time Recovery) | **なし** (Pro 以降) | 任意時刻復旧は不可、 1 日粒度のみ |
| Storage バックアップ | **なし** (= 自前で上書き / 削除すると戻らない) | Pro でも Storage の自動 backup は無し → 自前 sync が必要 |
| Project pause 復旧 | 7 日 inactive で auto-pause、 dashboard Restore で 1-3 分 | データそのものは消えない、 §see [`supabase-auto-pause-prevention.md`](supabase-auto-pause-prevention.md) |

### 2.2 → 何が足りないか

Free tier だと:

1. **Storage の自前 backup がない** — venue-photos が誤って batch
   削除されたら復旧不能 (= 元写真を再 upload するしかない)
2. **PITR がない** — 「今朝 3 時に間違って migration 走らせた」 の
   2 時間ピンポイント復旧は不可、 24 時間ロールバックしかない
3. **手動 dump の習慣がない** — 自動だけに依存すると Supabase 側の
   1 度の事故で 全部消える

---

## 3. 暫定: 月次 manual `pg_dump`

Beta release までの暫定運用。 Pro 移行までこれを月次で回す。

### 3.1 手順 (5 分)

ローカル開発機 + Supabase service-role 認証情報がある前提:

```bash
# 1. DB URL を環境変数から取得 (Vercel と同じ DATABASE_URL)
export DATABASE_URL="postgresql://postgres.<project-ref>:<password>@aws-0-<region>.pooler.supabase.com:6543/postgres"

# 2. pg_dump (custom format = 圧縮 + restore 時に並列展開可能)
mkdir -p ~/haretoki-backups
pg_dump "$DATABASE_URL" \
  --format=custom \
  --no-owner \
  --no-privileges \
  --exclude-schema=storage \
  --exclude-schema=auth \
  --exclude-schema=realtime \
  --exclude-schema=supabase_functions \
  --exclude-schema=extensions \
  --file=~/haretoki-backups/$(date +%Y%m%d)-haretoki.dump

# 3. 確認
ls -lh ~/haretoki-backups/ | tail -3

# 4. (任意) GPG で暗号化してから外部に保管
gpg --symmetric --cipher-algo AES256 ~/haretoki-backups/$(date +%Y%m%d)-haretoki.dump
# パスフレーズは 1Password / Bitwarden に "Haretoki backup" 名で保管
```

### 3.2 何を含めて何を除外するか

- ✅ **含める**: `public` schema = アプリのデータ (User / Project / Venue
  / 全 model)
- ❌ **除外**: `storage` / `auth` / `realtime` schema = Supabase が管理する
  テーブル (= Supabase 側で同等のリストア手順がある、 自前 dump に
  含めると restore 時にコンフリクト)

### 3.3 保管先

- **作者ローカル**: ~/haretoki-backups/ — 主保管
- **外部 (GPG 暗号化済)**: 個人 Google Drive の「Haretoki/backups」 フォルダ
  に手動 upload 月 1 回
- **冗長性目標**: 同月内に **2 箇所** にコピーがあること

> 自動化したくなったら GitHub Actions の scheduled workflow 候補
> (= secrets に DATABASE_URL を入れて毎月 1 日 dump + S3 upload)。
> ただし secrets を CI に入れる ROI を Beta 規模で判断する話 — 後回し。

---

## 4. 復旧手順 (Restore drill)

### 4.1 シナリオ A: 1 テーブル誤削除

例: 「夜中に DELETE FROM venues 走らせちゃった」

#### 段階 1: 即停止

1. **何も触らない** — 追加の write を避ける
2. 該当 user に状況通知 (= 直近の作業を控える、 テスト数据は
   失われる可能性ありを伝達)

#### 段階 2: Supabase dashboard restore

Free tier: **7 日以内ならスナップショットあり**:

1. Supabase dashboard → Database → Backups
2. 直前のスナップショット (= 24 時間以内が望ましい) を選択
3. **新しい project にリストア** (= 既存 prod を上書きするボタンは
   ないので、 別 project に restore してから比較)
4. 該当テーブルだけ `pg_dump --table=venues` で抜き出して prod に
   `psql` で COPY

時間目安: 30 分 〜 1 時間

#### 段階 3: 手動 dump からの restore (PITR 代用)

`pg_dump` が前夜走っていれば:

```bash
# 1. dump を decrypt (GPG 暗号化していた場合)
gpg --decrypt ~/haretoki-backups/$(date +%Y%m%d -d yesterday)-haretoki.dump.gpg \
  > /tmp/haretoki-restore.dump

# 2. 別 project / 別 DB に restore (絶対に prod 直接上書きしない)
createdb haretoki_restore
pg_restore --dbname=haretoki_restore --no-owner --no-privileges \
  /tmp/haretoki-restore.dump

# 3. 該当テーブルだけ抜き出し → prod に COPY
psql haretoki_restore -c "COPY (SELECT * FROM venues) TO STDOUT" \
  | psql "$DATABASE_URL" -c "COPY venues FROM STDIN"
```

時間目安: 1 〜 2 時間 (= dump サイズ次第)

### 4.2 シナリオ B: Storage 写真誤削除

Free tier では **自動 backup なし**。 復旧:

1. **削除 24 時間以内**: Supabase Storage の "Trash" タブ (2024 後半に
   追加された機能) を確認 — soft-delete されている可能性
2. **24 時間以上**: 元写真を user / partner に再 upload 依頼
   (= 失われたものは戻らない、 元データは user の手元にある前提)
3. **構造的対策**: Pro 移行 + S3 sync (§5) で再発防止

### 4.3 シナリオ C: project 全消し

Supabase project を間違って delete してしまった:

1. **6 時間以内なら Supabase support にメール** で復旧依頼可能 (= soft
   delete の可能性)
2. **6 時間以降**: ローカル `pg_dump` から手動再構築
3. **DR drill 推奨**: 半年に 1 回 dump からの project 再構築を試行
   (`dr-drill-plan-2026-Q3.md` Scenario A の拡張案)

---

## 5. Pro 移行 — トリガーと得られるもの

### 5.1 移行を検討する条件 (= ALL met)

- [ ] Open Beta cut2 (200 名) cohort が走っている
- [ ] DAU が 50+ で安定 (= データ量が手動 backup の手間を上回る)
- [ ] Storage usage が free tier 1 GB の **80% を超えた**
      (= /admin/health の storage card で `warn` バッジが定常表示)
- [ ] SLA 表明を顧客に始める (= 課金 phase 突入)

### 5.2 Pro で得られるもの ($25/月)

| 項目 | Pro | 備考 |
|---|---|---|
| Postgres バックアップ | 過去 7 日分 + **PITR (任意時刻、 1秒粒度)** | これが最大の価値 |
| Storage 上限 | 100 GB (= Free の 100 倍) | 写真本数 ~ 10 倍までスケール余地 |
| Storage バックアップ | **依然 自動なし** — S3 sync は自前 | 移行後も §6 のセットアップは必要 |
| SLA | 99.9% uptime guarantee | 顧客対面 SLA に転用可能 |
| Support | priority email | Free は community のみ |

### 5.3 Pro 移行時の追加セットアップ

- [ ] PITR を「30 日 retention」 にダッシュボードで設定
- [ ] Storage の S3 sync (§6) を Pro 移行と同 PR で wire
- [ ] `MONTHLY_REPORT_EMAIL` のテンプレに「PITR retention period:
      X days」 を追加 (= 復旧可能性の見える化)
- [ ] DR drill Scenario A に「PITR で 1 時間前にロールバック」 step
      を追加

---

## 6. (Pro 後) Storage S3 sync 自動化

Pro でも Storage 自動 backup はないので、 自前で:

### 6.1 アーキテクチャ案

```
Supabase Storage → cron (daily) → list all objects → diff against last sync
                                                   → upload new/changed → S3 (Glacier)
```

### 6.2 cron 候補

- `/api/cron/storage-backup` 新規 (Phase 5 候補、 Pro 移行と同タイミング)
- 毎日 1 回、 全 bucket を list → 前日の sync 結果と diff → 新規/変更
  オブジェクトを S3 に PUT
- S3 側は Glacier Deep Archive で保管 (= 安価、 復旧時間は遅いが backup
  には十分)

### 6.3 コスト見積もり

- 1 GB / month の Glacier Deep Archive 保管: ~$0.001/GB/month
- 100 GB なら $0.10/month (= 無視できる)
- Bandwidth (Supabase → S3): Supabase egress $0.09/GB → 100 GB なら $9
  initial、 daily diff は数十 MB で月 $0.10 程度

→ 実質 $1-2/月 で「データ消失耐性」 を獲得。 Pro 移行と同 PR で入れる
価値はある。

---

## 7. RPO / RTO 目標 (段階別)

| 段階 | RPO (= データ消失耐性) | RTO (= 復旧時間) |
|---|---|---|
| **0. Beta-private** (現状) | 24 h (= 月次 dump + Supabase 7d snapshot) | 4 h (= dump restore + 別 project 経由) |
| **1. Closed Beta** | 24 h | 2 h |
| **2. Open Beta cut1** (50 名) | 12 h (= 週次 dump 開始) | 1 h |
| **3. Open Beta cut2** (200 名) | 1 h (= Pro PITR + Storage S3 sync) | 30 min |
| **4. GA** (1000 DAU) | 1 min (= Pro PITR + 自動 daily dump + Storage 即時 sync) | 15 min |

---

## 8. 関連ドキュメント

- migration safety: `scripts/check-migration-safety.sh` + `npm run migrate:check`
- 障害対応フロー: [`incident-response-runbook.md`](incident-response-runbook.md)
- DR drill: [`dr-drill-plan-2026-Q3.md`](dr-drill-plan-2026-Q3.md)
- Supabase 公式 backup docs: https://supabase.com/docs/guides/platform/backups

---

## 9. 更新ルール

- Supabase pricing が変わったら §2.1 / §5.2 を refresh
- DR drill のたびに §4 復旧手順を実走確認 + drift があれば update
- Pro 移行を実行したら §5.3 / §6 の checkbox を 「実装済」 に変える +
  ADR を切って本ドキュメントを decouple
- backup を実際に取った日付を記録するログを別 file (= ops 個人作業
  ノート) に残し、 本ドキュメントは「手順」 のみを保つ
