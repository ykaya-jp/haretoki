# F4 — パートナー招待 UX 摩擦削減 5 層設計

> 作成: 2026-04-21 / ブランチ: `docs/w15-designs` / 作成者: product designer
> 対象リリース: W15 (copy-lexicon v2 と同週)
> 本書は 5 層設計 (基本 / 詳細 / 画面 / 体験 / UI・UX) を一枚で束ねた正本です。実装は本書 → 妻観察 → `src/app/invite/[token]` 系ファイルの順で反映します。

---

## 0. 問題提起 (Why now)

妻テストで再現した離脱パターンは一通りです。

> 夫にリンクを送る → 夫「アカウント作るの面倒」→ そもそも開かない、もしくは開いてもサインアップ画面で閉じる。

このため妻は「自分ひとりで比較した結論をプレゼンする係」に戻され、ふたりで選んでいる感触が失われます。Haretoki の価値命題「**ふたりが納得して選ぶ**」が、入り口で既に崩れています。

現状 (`src/app/invite/[token]/page.tsx`) はログイン / 新規登録のみが CTA です。**リンクを踏んだ直後に、サインアップ無しで「妻が何を見ているか」を見られる段階**が無いのが根本原因と判断します。

**トレードオフ**: 完全 guest アクセスはセキュリティと個人情報漏洩のリスクを生みます。本設計では「式場名 + 印象メモ + 比較マトリクス」は出す、「見積もり明細・個人名・チャット履歴」は隠すという **可視範囲の段階化** で両立させます。

---

## 1. 基本設計 (Foundation)

### 1.1 Purpose

- owner (妻側) が送った招待リンクを、partner (夫側) が **サインアップを後回しにして開ける**ようにする。
- 段階的に責任と引き換えに機能を解放する 3 Level モデル (Level 1 Guest / Level 2 Light Account / Level 3 Full Member) を導入する。
- Level 間の移行は「もう少し見たい」「評価もしてみたい」という partner 自身の引力で進ませる。owner からの督促ではなく、コンテンツが誘う設計。

### 1.2 Scope (W15 着手範囲)

- `/invite/[token]` の guest view (Level 1) 実装
- `/accept-invite` の文言調整 (Level 3 昇格時の入口)
- email template `partner-invite.ts` の段階的 CTA 化 (「まず見る」優先)
- owner 側 `/mypage/invite` に partner ステータス (送信済/閲覧済/反応済/参加済) を表示
- 24h 未閲覧・24h 未反応 を owner 側に `Notification` で通知 (`f3-partner-async-cues` と同 hook 再利用)

### 1.3 Non-goals (W15 では触らない)

- 招待コード管理画面 (複数リンクの一覧編集 UI) の整理。現行は「1 projectにつき live link 1 本」の仕様を維持。
- Level 2 (magic link 型ライト会員) の DB 拡張。本書では必要性と実装経路を論じるが、コード追加は W16 以降に回す。
- 第三者 (両家の親・プランナー) を含む 3 人目以降の共有。`ProjectMember` の `role` enum を拡張しない。
- 招待メール以外のチャネル (LINE Share / QR) は W16 以降の別 F で扱う。

### 1.4 Persona

- **owner = 妻側 (28-32歳、テック普通、熱量 高)**
  仕事: 「夫に同じ温度で参加してほしい。でも自分が司令塔に見えるのは嫌」。
  objection: 「夫が面倒がる。強要したくない」。
- **partner = 夫側 (28-35歳、テック平均、熱量 低〜中)**
  仕事: 「妻が比べているものを、軽く覗きたい。怒られない範囲で意見を出したい」。
  objection: 「アカウント作るのだるい」「個人情報入れたくない」「怪しいリンクっぽい」。

### 1.5 Success metrics

| 指標 | 定義 | 現状推定 | 目標 (W15+2週) |
|---|---|---|---|
| 招待 → 閲覧率 | リンク発行数に対し `/invite/[token]` を開いた率 | 未計測 → baseline 取得 | 70% 以上 |
| 閲覧 → Level 1 滞在 | Level 1 に入り 30 秒以上滞在した率 | — | 60% |
| Level 1 → Level 3 | guest で開いた partner が最終的にサインアップした率 | — | 35% (1 週間以内) |
| partner 初アクション率 | Level 3 昇格後 72h 以内に印象メモ or ハートを置いた率 | 未計測 | 50% |
| owner 満足 | 妻ヒアリングで「夫が見てくれた」と答えた率 | 定性 | 定性 > 定量で追う |

### 1.6 Level 責任表 (必須)

| 観点 | Level 1 Guest | Level 2 Light Account | Level 3 Full Member |
|---|---|---|---|
| 認証 | なし (invitation token + 短命 cookie) | email + magic link | email/password or Google OAuth |
| セッション寿命 | 24h、cookie 1 つ | 30 日、refresh 可 | 標準 Supabase セッション |
| DB 上のユーザー | 作らない (token 消費時まで `User` row 生成なし) | placeholder `User` (email のみ、`authProvider='magic'`) | Supabase auth user (FK 正規化済み) |
| 式場一覧 閲覧 | できる | できる | できる |
| 式場詳細 (写真・アクセス) | できる | できる | できる |
| 比較マトリクス (総合スコアのみ) | できる | できる | できる |
| 見積もり 明細内訳 | **不可** (合計のみぼかし表示) | できる | できる |
| owner の印象メモ | 匿名化して表示 (名前は「相棒さん」) | できる (owner 名表示) | できる |
| 自分の印象メモを置く | **不可** (「参加するとメモが残せます」の inline hint) | できる | できる |
| ハート (本命化) | **不可** | できる | できる |
| チェックリスト重み | **不可** (表示のみ) | できる | できる |
| チャット (コーチ) | **不可** (存在を示唆しない) | できる (閲覧のみ) | できる (発言可) |
| 通知受信 | リンクからの復帰のみ | email magic link | email + in-app |
| データ消去権 | cookie クリアで即消える | mypage から削除可 | mypage から削除可 |

**設計原則**: Level を上げるほど**責任が増える** (email を出す → 身元を出す)。その引き換えに**操作権が増える**。機能の重さを責任のグラデーションと一致させ、partner が「自分で出した同意の分だけ参加している」と感じられるようにします。

**トレードオフ**: Level 2 (magic link) は既存の Supabase Auth でも実現可能ですが、W15 実装本数が膨らみます。W15 は **Level 1 と Level 3 の二段階**で出し、Level 2 は 2 週間後に「夫が Level 1 → Level 3 に飛ぶのをどれだけ嫌がるか」を計測してから判断します。

### 1.7 データフロー

```
[owner]
  mypage → 招待リンクを発行
      ↓ createInvitationLink (既存)
  ProjectInvitation (token, projectId, expiresAt=+7日, consumedAt=null)

[partner: 1 回目タップ]
  /invite/[token] に到達
      ↓ token 検証 (shape + expiresAt + consumedAt)
  未ログイン & 未 guest cookie → Level 1 guest mode に遷移
      ↓ guest_session cookie を発行 (httpOnly, SameSite=Lax, 24h, signed)
      ↓ ProjectInvitation は consume しない (閲覧では消費させない)
  guest view をレンダリング (読み取り専用、明細隠し)

[partner: 滞在中の引力]
  "参加してメモも残す" chip が 30 秒後に subtle pulse
      ↓ タップ
  /signup?next=/invite/[token] (既存ルート)

[partner: signup 完了]
  /invite/[token] に戻る → 既存 consumeInvitationLink path
      ↓ ProjectInvitation を consume + ProjectMember upsert
  Level 3 Full Member として /home?invited=1

[owner 側に昇格が反映]
  revalidatePath("/home") + Notification insert ("partner_joined")
```

**guest cookie は `ProjectInvitation` を消費しない** ことが肝です。これにより「夫が一度見ただけでリンクが死ぬ」事故を防ぎ、別日に Level 3 へ昇格する余地を残します。

---

## 2. 詳細設計 (Technical)

### 2.1 Level 1 Guest セッション

**方式**: httpOnly cookie `htk_guest` に JWT-like signed payload を格納。

```
payload = {
  keyId: "k1",           // secret 世代 (rotation 時に "k2" と並走)
  token,                 // ProjectInvitation.token
  projectId,
  screenCount: 0,        // guest が開いた画面数 (anti-abuse)
  lastSeenAt: iso8601,
  issuedAt,
  expiresAt              // = issuedAt+24h
}
signature = HMAC-SHA256(payload, GUEST_COOKIE_SECRETS[keyId])
cookie value = base64url(payload) + "." + base64url(signature)
```

- **httpOnly / SameSite=Lax / Secure (prod)**: XSS / CSRF 対策。
- **有効期限 24h**: partner のブラウザが夜閉じられても翌朝は guest のまま見られるが、2 日後には自動失効して token を食い直す必要が出る。放置防止。
- **Secret rotation**: `GUEST_COOKIE_SECRET_K1` / `GUEST_COOKIE_SECRET_K2` を Vercel env に 2 世代併置。payload.keyId で検証側が切り替え。ローテーション時は新世代で発行しつつ旧世代で検証も 24h 並走、その後削除。`.env.example` に両方記載。
- **Secret 長**: `openssl rand -hex 32` で 32 byte 以上。
- **1 cookie = 1 projectId**: 別招待を開くと **confirm を挟む** (§4.5 edge case 参照)。複数 project 同時 guest は W15 scope 外。
- **screenCount / lastSeenAt**: guest が閲覧する度に `screenCount++` + `lastSeenAt = now()` で署名再計算して cookie 書き戻し。サーバー側で異常値 (1000+) を検知したら session 失効。
- **DB に `User` を作らない**: Level 1 では身元を一切残さない。サーバーで projectId と guest flag だけ復号して Prisma（service role）経由で project scoped データを読む。**Supabase Auth の anon role + RLS は使わない**（guest は Supabase session が無いため `requireUser()` は通らない、Prisma は DB 直接アクセスで guest 用 read-only query builder を経由する）。

#### 2.1a Owner 側「閲覧済み」可視化の DB 永続化

guest cookie のみでは owner から「相棒さんが見た」が見えない（別デバイス・別セッション）。最小の永続化として:

```prisma
model ProjectInvitation {
  // 既存フィールド...
  lastViewedAt DateTime? @map("last_viewed_at")  // F4 追加
  viewCount    Int       @default(0) @map("view_count") // F4 追加 (軽い抽象化)
}
```

guest route handler で `req.cookies.get("htk_guest")` が有効化したタイミングで `prisma.projectInvitation.update({ where: { token }, data: { lastViewedAt: new Date(), viewCount: { increment: 1 } } })` を 1 回だけ呼ぶ（同一セッション 1 回の idempotency は cookie の `screenCount > 1` で判定）。

**名前のラベル化**: `guest_session` に name を入れない。UI 上は一貫して「**相棒さん**」(owner 視点の呼称) で表示。owner 側にも「相棒さんが見ました」とだけ出す。partner の email を owner に一切見せない。

**トレードオフ**: cookie ベースの guest は「夫が別端末で開いた」時に最初から Level 1 やり直しになります。これを追跡する IdP 連携は責任を増やしすぎるため、割り切って受け入れます。

### 2.2 Level 2 の技術経路 (W15 では未実装、方針のみ)

- Supabase Auth の `signInWithOtp` (magic link) をそのまま使えるため schema 変更は不要。
- `User.authProvider` カラム追加で Level 2 / Level 3 の区別を取りたい場合は W16 のマイグレーションで対応。
- 現状の `requireUser()` は Level 2 と Level 3 を区別しない想定で書く。Level 2 から pay-wall 的に Level 3 を要求する画面は当面無い。

### 2.3 Placeholder migration の確認

`src/server/actions/projects.ts` の `getOrCreateProject` は既に placeholder `User` → auth user の FK 付け替えを `$transaction` で網羅しています (`projectMember`, `venueFavorite`, `visitRating`, `notification`, `savedSearch`, `coupleAgreement`, `projectInvitation`, `visitNote`, `notificationPreference` の 9 テーブル)。

**本 F4 で追加する安全確認**:

1. **Level 1 guest は placeholder `User` を作らない**ため、`getOrCreateProject` の migration path には入らない。partner が Level 3 に昇格した瞬間に既存の consume + upsert が走るだけで、新たな migration 分岐は不要。
2. ただし **`invitePartner` (email 経由の旧フロー)** は引き続き placeholder を生成する。F4 では旧 email フローは残す (互換性) が、owner UI からの導線を「リンク発行」優先に並び替える。`invitePartner` を呼ぶ UI は mypage の「email で招待」タブに残す。
3. **再帰的な確認事項** (placeholder migration に穴がないか):
   - `VenueScore` は `userId` を持たない (`projectId` + `dimension` + `source` の UNIQUE) ため影響なし。
   - `CoachSession` / `CoachMessage` も `userId` を持たない (`projectId` のみ) ため影響なし。
   - `PartnerReaction` (存在する場合) の FK は `prisma/schema.prisma` を再 grep して確認する。現状 `projectId` のみで `userId` 参照なし → 問題なし。
   - **結論: 既存 migration 網羅リストは本 F4 のスコープでは十分**。ただし将来 `userId` を持つテーブルを追加するたびに `projects.ts:42-125` の migration list を更新する TODO を `docs/lessons.md` に積む。

### 2.4 Realtime と Guest

- Supabase Realtime subscription は auth token が無いと anon role で subscribe することになり、RLS 上 project スコープのテーブル (`Venue`, `VenueScore`, `VisitNote` 等) はそのままでは読めない。
- W15 では **guest に Realtime を配線しない**。guest は static snapshot で見せる。owner 側が何かを追加した瞬間を夫に見せる必要は現状無い。夫が「開いた瞬間の妻の選択」が見えれば十分。
- 将来 Level 2 以降で Realtime を入れるなら、server 側で短命の scoped JWT を発行して supabase-js の `realtime.setAuth()` に渡す方式が候補。W15 では設計だけ書く。

### 2.5 招待リンクの ライフサイクル

| イベント | 既存仕様 | F4 変更 |
|---|---|---|
| 発行 | 7 日有効、旧 live link は即 expire | 維持 |
| guest 閲覧 | 概念なし | 閲覧では `consumedAt` を書かない |
| signup 完了 → 合流 | `consumedAt` を書き `ProjectMember` upsert | 維持 |
| 2 回目の guest 閲覧 (同 cookie) | — | 既存 cookie で再入場、token 再検証なし |
| 2 回目の guest 閲覧 (別端末) | — | token 再食いで新しい cookie 発行 |
| 合流済み partner が再タップ | `stale` エラー | → `/home` に静かに redirect (partner の混乱回避) |
| expire 後のタップ | `expired` エラー | 維持 (owner に「再発行してもらって」と伝える) |
| owner 自身がタップ | `self` エラー | 維持 |

### 2.6 セキュリティ / Abuse

- **Token 推測防止**: `randomBytes(32)` → 64 hex chars は current best practice。変更なし。
- **Enumeration**: 無効 token でも `InvalidCard` を同じ見た目で返す → `invitation is null` と `consumedAt !== null` を区別させない。既存実装は区別している (`invalid` / `stale` / `expired`) ので **F4 では invalid と stale を同一 UI に寄せる**。expired だけは「再発行を依頼して」のガイドを出す価値があるので別扱い維持。
- **リンク転送**: 妻が送ったリンクを夫以外に転送されるリスクはゼロにはできない。対策として:
  - Level 1 では個人情報が一切出ない (相棒さん呼称 / 明細非表示 / 式場写真は有償アセット並みに注意) ため被害は限定的。
  - Level 3 昇格時に「合流しますね」の確認 step を挟む (無言で合流させない)。
  - 7 日で expire、24h 以上未反応なら owner に「リンクを閉じたほうがいい？」という notification (f3 連動)。
- **Rate limit**: `/invite/[token]` の guest cookie 発行に対して IP ベースで 1 分 10 回の soft limit を middleware で入れる (W15 中に実装、別 issue 化)。
- **Cookie secret のローテーション**: `GUEST_COOKIE_SECRET` は `.env.local` + Vercel project env。流出時は env 差し替えで即全 guest セッション無効化できる。

### 2.7 失敗モード (設計レビュー)

1. **guest cookie を保持したまま別の partner プロジェクトに招かれる** → cookie 上書きで前の guest は終わる。owner 側は「相棒さんは一度見たあと、来なくなりました」という状態に見える。
2. **partner が guest のまま放置 → 24h 経過後に開く** → cookie 失効、ProjectInvitation 再消費要求。この時 7 日以内なら再 guest 可、7 日超なら owner 側に再発行依頼。UI で明確にメッセージ出す。
3. **partner が guest で見た後、全く別のアカウントで既存 Haretoki にログインしていて /invite/[token] を再訪** → 既存 authed path に入り、consume → `ProjectMember` upsert。placeholder migration は不要 (Level 1 が placeholder を作らないため)。既存 auth user 側の自動作成 empty project が存在する場合は `isAutoCreatedEmptyProject` で静かに discard される既存ロジックが効く。

---

## 3. 画面設計 (Screens & States)

### 3.1 State Matrix

| State | 画面 | ねらい |
|---|---|---|
| S0 | 招待 email 受信 | 怪しくない、妻の顔が見える、1 タップで踏める |
| S1 | `/invite/[token]` 未ログイン 初回 | 「誰から何の招待か」が 1 秒で分かる。サインアップを押し付けない |
| S2 | Level 1 guest landing (`/invite/[token]/guest` 内部遷移) | 妻が見ているものを追体験できる。明細は霞ませる |
| S3 | Level 1 の 式場詳細 | 読み取り専用、印象メモは相棒さん呼称、CTA「参加するとメモが残せます」 |
| S4 | 昇格 CTA (soft) | 滞在 30s or 2 画面以上開いた後、chip が subtle pulse |
| S5 | 昇格 CTA (hard) | partner が自発的にハート or メモを押した時 inline で signup 画面を diff-sheet で出す |
| S6 | signup 完了後 `/home?invited=1` | owner 側に「相棒さんが合流しました」の gold band toast |
| S7 | expired リンク | 「このリンクは役目を終えました」+ 「妻に再発行を頼む」ボタン |
| S8 | stale (既に合流済み) | 静かに `/home` へ、redirect 前に 500ms の「お帰りなさい」overlay |
| S9 | self (owner が自分のリンクを踏む) | 「これはあなたのリンクです」+ 「もう一度、相棒に送りますか」 |
| S10 | owner 側 mypage `/mypage/invite` | 送信済 / 閲覧済 / 反応済 / 参加済 の progression badge |

### 3.2 owner の可視化 (`/mypage/invite` の status badge)

4 段階の bar-dot + 明朝ラベル:

```
  ●───○───○───○     送りました
  ●───●───○───○     相棒さんが開きました · 昨日 19:32
  ●───●───●───○     印象メモを置いてくれました
  ●───●───●───●     ふたりの場所になりました
```

- dot は 6px 塗り / 10px 枠線、active は gold-warm。
- ラベルは `Noto Serif JP light 15px`、時刻は `tabular-nums 11px text-muted`。
- 「反応済」の定義: guest が 30 秒以上滞在、or 式場詳細を 2 件以上開いた。**DB 書き込みはせず、最後の guest_session の `lastSeenAt` と `screenCount` だけ cookie に持つ。owner に見せるのは「昨日 19:32 に立ち寄ってくれました」の人間的な近さ**。
- partner の email は一切出さない (妻も見せたくないケースがある)。

### 3.3 375px レイアウト指針

- Level 1 guest landing は EditorialHero を流用。eyebrow に「**INVITATION**」、headline に「妻 (owner 名) さんが、ここに招きました。」。
- 式場一覧は既存 venue card を流用、ただし右上に「**読み取り専用**」の SkyChip (cloud 段階)。
- footer 固定に「**ここから参加する**」の flat primary CTA (`bg-primary text-primary-foreground h-12 rounded-[14px]`)、その上に `text-[11.5px] text-muted` で「いまは、ちょっと覗くだけでも大丈夫です。」。

### 3.4 Dark Mode

- gold-warm は変更せず。cream base は dark mode では `--slate-ink` に置換済み (既存 token)。
- guest ラベルの dot 塗りは dark mode で gold-warm の 75% opacity にしてコントラスト確保。
- 「読み取り専用」chip は dark mode で背景 `gold-subtle/15%`、テキスト gold-warm。

---

## 4. ユーザー体験設計 (Journey)

### 4.1 Journey 1: 「メール開いたらすぐ見えた」(本命ケース)

```
[妻] 妻がリンクをコピーして LINE で送る
       ↓
[夫] LINE の URL を長押しせずそのままタップ
       ↓
[夫] Haretoki の /invite/[token] が開く
     → 「〇〇さんから、式場さがしへの招待です。」
     → CTA: [ここだけ見る] [参加する]
     → 夫: ここだけ見る を押す (0.5 秒悩む)
       ↓
[夫] Level 1 guest view
     → 「〇〇さんが 3 つの式場を見ているようです。」
     → 式場カード 3 枚が並ぶ
     → 1 枚目タップ → 写真・アクセス・妻の印象メモ (「相棒さんの声」として匿名)
     → 2-3 枚目も覗く (合計 2 分滞在)
       ↓
[夫] footer の「ここから参加する」chip が subtle pulse
     → 夫: 「自分もいいなと思ったやつ、残したいかも」→ タップ
       ↓
[夫] Google OAuth で signup (10 秒)
       ↓
[妻] mypage/invite で「ふたりの場所になりました · 今日 20:14」の gold band が出る
[夫] /home で「ようこそ、相棒さん。」の editorial hero
```

**Emotion arc**:

> 怪しさ (これ何のリンク?) → 納得 (妻の名前だ) → 興味 (式場写真キレイ) → 共感 (妻これ好きなんだ) → 参加意思 (自分も置きたい) → 参加

### 4.2 Journey 2: 「最初は見るだけ、次回参加」

```
[夫] 仕事中に妻からリンク、タップ → guest view → 20 秒だけ眺めて閉じる
       ↓ (数日後)
[妻] 「見てくれた？」と聞く
[夫] 「見たよ、今度ちゃんと」
       ↓ (週末)
[夫] 再度リンクをタップ → guest cookie は 24h で失効済み → token から新 cookie 発行
     → 「〇〇さんが 5 つに増えました」で変化が分かる
     → 今度は 5 分滞在 → signup
```

**設計のキモ**: 24h cookie で毎回「久しぶり」感を出しつつ、owner 側は「相棒さんが 2 回目 / 3 回目」のカウントを持たない (カウンターは partner に圧をかける)。

### 4.3 Journey 3: 「既存ユーザーが別アカウントで開いた」(edge)

```
[夫] 以前に別の式場アプリ検討で Haretoki を自分ひとりで触っていた (= 既存 auth user)
[夫] 妻のリンクをタップ → supabase session あり → guest path を skip
       → 既存 consumeInvitationLink に入る
       → 既存 empty project は isAutoCreatedEmptyProject で discard
       → 妻の project に合流
[夫] /home で「ふたりの場所になりました」
```

**懸念**: 夫の既存 project に式場データが入っていた場合は discard せずエラーを出す既存実装が守る。エラー文言を「妻と別々に進めていたみたいですね。どちらの記録を残しますか？」と merge 誘導風に書き換える案は **W16 以降** で扱う (W15 では既存文言のまま、ただし copy-lexicon に合わせて微調整)。

### 4.4 Copy (実文言案)

#### Email template (`partner-invite.ts`)

```
件名: {inviterName}さんから、式場さがしに招待が届きました

──────
Haretoki · Invitation
──────

{inviterName}さんが、ふたりで選ぶための場所に、あなたを招びました。

まずは、眺めるだけでも大丈夫です。
ログインも登録も、後からで構いません。

  [ 式場を、ちょっと見てみる ]  ← 主 CTA
  [ 参加する ]                  ← 副 CTA

──────
このリンクは、{expiryDate} まで有効です。
他の人に転送しないでください。
Haretoki · 式場選びを、もっと納得のいくものに。
```

#### `/invite/[token]` landing hero (Level 1 入口)

- eyebrow: `HARETOKI · INVITATION`
- headline (明朝 26px light): 「こんにちは、**{inviterFirstName}さんの相棒さん**。」
- sub (14px muted): 「{inviterFirstName}さんが、ふたりで選ぶ場所に招いてくれました。まずは、ちょっと覗いてみますか。」
- primary CTA: **「ここだけ見る」** (gold-warm outline, 14.5px, h-12, rounded-14)
- secondary CTA: 「参加する」(flat text link, 13px, muted)
- hairline divider (既存 `--gradient-dawn`)
- fine print (11px muted): 「アカウント登録は後からで大丈夫です。見たことは、{inviterFirstName}さんには『誰か』として分かります。」

#### Level 1 guest の soft CTA chip

- 初期: 「**参加すると、あなたの印象も残せます**」 (11.5px muted, static)
- 30 秒滞在 or 2 画面目以降: 上記 chip に subtle pulse (2s ease-in-out、1 サイクルのみ、繰り返さない)
- タップ: `/signup?next=/invite/[token]`

#### Level 1 で「ハート」を押そうとした時 (soft gate)

- Sheet がせり上がる (`--dur-sheet 400ms`)
- 明朝 20px: 「**これ、いいなと思いましたか？**」
- 13px: 「この気持ちを残すなら、ふたりの場所に参加してください。1 分で終わります。」
- primary: 「参加する」 / secondary: 「あとで」

#### Expired

- 「このリンクは、役目を終えました。」
- 「{inviterFirstName}さんに、新しい招待をお願いしてください。」
- CTA: 「{inviterFirstName}さんに伝える」 (mailto: or LINE share, 実装は share API で OS ネイティブ)

#### owner 側 `/mypage/invite` status row

- 「送りました」: 「昨日 19:32 に、リンクを送りました。」
- 「閲覧しました」: 「相棒さんが、そっと見てくれました。· 昨日 21:05」
- 「反応しました」: 「3 つの式場を、ゆっくり見てくれたようです。」 ※メモや印象は出さない
- 「合流しました」: 「ふたりの場所に、なりました。」

### 4.5 Edge cases

| ケース | 処理 |
|---|---|
| partner が別 project に既に所属 (full member) | **CRITICAL fix**: 現状 `consumeInvitationLink` (invitation-links.ts:83-104) には `isAutoCreatedEmptyProject` 相当の guard が**無い** (`acceptInvitation` 側のみ実装)。そのまま進むと、partner の既存 project が静かに残り getOrCreateProject が最初の 1 件しか返さず片方が見えなくなる。**F4 実装時に `consumeInvitationLink` 側にも同 guard を追加** (空なら discard、データありなら block してメッセージ表示、`acceptInvitation` と同じ文言で統一)。将来的には `consumeInvitationLink` / `acceptInvitation` を統合する方針を docs/lessons.md に積む |
| partner が招待 URL を他人に転送 | Level 1 で見える情報は最小化済み。**Level 3 昇格 confirm step**: 「{ownerName} さんの相棒として合流しますか？」を一度挟む (単純 auto-accept しない)。P1 タスクとして追加 |
| 2 つ目の招待で上書き | guest cookie は上書き **する前に confirm を挟む**: 「今は {ownerA} さんの {projectA} を見ています。{ownerB} さんの招待に切り替えますか？」。合流済み project は cookie から除外、複数 projectId 保持は W15 scope 外（Phase 2 で `guestSessions[]` 化検討）|
| partner が guest 中に token が expire | guest cookie が生きていれば guest view は維持 (cookie の projectId を信用、token 再検証しない)。次の Level 3 昇格時に token 再発行依頼に回す |
| 招待 email が迷惑メールへ | email 送信失敗時は既存通り silent success、owner UI に「URL をコピーして LINE で送る」ボタンを主導線に置く |

### 4.6 離脱リカバリ

- **24h 後 未閲覧**: owner に notification「{partnerLabel}さん、まだ立ち寄ってくれていません。リンクを LINE でもう一度送ってみますか？」 + 「[再送する]」ボタン (既存 link を LINE share intent で開く)
- **24h 後 閲覧したが Level 3 未昇格**: 「相棒さんが、そっと見てくれています。次は、ご自身で気に入った 1 件を選んでもらってみませんか。」 (妻からの自然な一言のきっかけを提供)
- **7 日後 expire 前日**: owner に「リンク、明日までです。延長しますか？」、partner 側にもメールで 1 回だけリマインド (partner の email は既知の場合のみ、Level 1 では email 未取得なので送らない)

---

## 5. UI/UX 設計 (Tokens & Micro-interactions)

### 5.1 Token 使い分け

| 要素 | token | 理由 |
|---|---|---|
| Level 1 landing 背景 | `--gradient-dawn` (cream → rose-subtle 5%) | 「朝の挨拶」、夫を迎える最初の光 |
| Level 1 CTA 「ここだけ見る」 | border `--gold-warm`/55%, text `--gold-warm` | 責任が軽いので flat primary でなく outline。重さの視覚的差別化 |
| Level 1 CTA 「参加する」 | flat text-muted | まだ押さなくていい、と伝える |
| Level 3 昇格 CTA (滞在後) | `bg-primary` flat, `text-primary-foreground` | ここで初めて「本気」にする |
| 「読み取り専用」chip | SkyChip (cloud 段階)、bg `--gold-subtle/20%`, text `--gold-warm` | ブランドメタファーで「まだ雲が晴れきっていない」 |
| owner 側 status badge active | `--gold-warm` | 「合流」まで進んだ時だけ満ちる光 |
| 合流完了 toast | gold band (`2px solid --gold-warm`) + `--gradient-noon` | 決定セレモニーと同じ格 |

### 5.2 Typography

- Landing headline: `Noto Serif JP light 26px / line-height 1.35 / tracking -0.005em`
- body: `Noto Sans JP regular 14px / line-height 1.65`
- eyebrow: `Noto Sans JP medium 11.5px / uppercase / tracking 0.2em / gold-warm`
- 数値 (時刻・日付): `tabular-nums 11-13px text-muted`

### 5.3 Spacing / Layout

- Landing は max-width 360px, horizontal padding 24px, vertical rhythm 32/24/24/16。
- Level 1 の venue list は card 間隔 12px、上下余白 24px (閲覧だけに集中させる、フィルタ chip 非表示)。
- footer 固定 CTA は `env(safe-area-inset-bottom)` を `pb` に加算。h-12 + 12px padding。

### 5.4 Micro-interactions

1. **Landing 入場 (0→900ms)**: eyebrow fade-up 200ms、hairline scale-x 0→1 400ms `--ease-out-luxe`、headline opacity 0→1 + y 8px→0 600ms、CTA group opacity 0→1 900ms。ラグジュアリー感。
2. **「ここだけ見る」タップ**: scale 0.98 (150ms)、その後 gold-warm の ring が 400ms で外側に拡散しながら fade。「光の滲み」。
3. **Level 1 venue card tap**: 既存 `active:scale-[0.98]` を維持。
4. **soft CTA chip の subtle pulse**: 30 秒後に 1 回だけ `box-shadow: 0 0 0 0 gold-warm/40 → 0 0 0 8px gold-warm/0` を 2s。再発はしない (2 回目以降は partner の自由意志に任せる)。
5. **合流完了**: `/home` に着いた瞬間、editorial hero の上に `2px gold band` が 400ms で左→右に delete-sweep。その後 3s 後に自動消失。
6. **Reduced motion**: 既存の `@media (prefers-reduced-motion: reduce)` で transition 0.01ms に潰す。pulse と sweep は opacity 遷移のみに退化。

### 5.5 Accessibility

- すべての CTA は min-h 44px (h-11/h-12)。
- 「読み取り専用」chip は `aria-label="読み取り専用モードです"`。
- subtle pulse は `prefers-reduced-motion` で停止、常に視認可能な `text-muted` label を併用 (動きに依存しない)。
- focus ring: `--gold-warm/60%` で 2px offset、dark mode でも維持。
- email template は `alt` テキスト、プレーンテキスト版を併送 (既存 `renderPartnerInviteEmail` に準拠)。
- 画面 (S7) expired は aria-live=polite で「このリンクは有効期限が切れました」を screen reader に通知。

### 5.6 Dark mode 追加チェック

- `--gradient-dawn` は dark mode で `slate-ink → rose-dim` の layered にスワップ済み (既存 token)。guest landing の暖かさを損なわない。
- guest chip の gold-subtle は dark mode で opacity を 30% に上げる (背景 slate との contrast 維持)。
- status badge の dot 未充填は dark mode で border `white/20`。

### 5.7 Validation checklist

- [ ] 375px で Level 1 landing が 1 画面に収まる (スクロールなしで CTA 見える)
- [ ] ダーク / ライト両方で gold-warm のコントラスト比 4.5 以上
- [ ] 44px 以上のタッチターゲットのみ
- [ ] sr-only: 「相棒さんとしてご覧になっています」
- [ ] 空ステート (guest view で venue 0 件) : 「{inviterFirstName}さんは、まだ式場を置いていないようです。また来てみてください。」
- [ ] エラー: expired/stale/invalid を全て日本語丁寧体で、copy-lexicon 準拠
- [ ] focus visible リング全 CTA
- [ ] prefers-reduced-motion で pulse / sweep 停止
- [ ] Morning Light token のみ使用 (独自カラー禁止)

---

## 6. 実装タスク分割 (W15 内)

| 優先 | タスク | ファイル | 備考 |
|---|---|---|---|
| P0 | guest cookie ユーティリティ (sign/verify) | `src/lib/guest-session.ts` (新規) | HMAC-SHA256 + base64url |
| P0 | `/invite/[token]` を guest / authed で分岐 | `src/app/invite/[token]/page.tsx` (既存改修) | 既存 consume 経路は維持 |
| P0 | guest landing hero + 「ここだけ見る」CTA | 同上 | EditorialHero 流用 |
| P0 | Level 1 layout `(guest)/[token]/` 新設 | `src/app/invite/[token]/(guest)/` (新規) | 読み取り専用 layout、RLS を guest role で通す route handler |
| P1 | 式場一覧 guest 版 (明細隠し) | 既存 venue 一覧を `readOnly` prop で分岐 | カード内ハート非表示 |
| P1 | soft CTA chip + 30s pulse | `guest-upgrade-chip.tsx` (新規) | Framer Motion |
| P1 | Level 3 昇格 soft gate sheet | `guest-upgrade-sheet.tsx` (新規) | ハート / メモ tap 時 |
| P1 | `/mypage/invite` status row | 既存 UI を拡張 | 4 段階 dot |
| P2 | email template 文言更新 | `partner-invite.ts` | 「まず見る」主 CTA |
| P2 | 24h / 閲覧後 24h の notification trigger | `f3-partner-async-cues` と合流 | cron or edge function |
| P3 | rate limit middleware | `middleware.ts` | 別 issue 化 |

### 実装しないことの明記

- Level 2 magic link は本 sprint で実装しない
- 複数 live link の管理 UI
- LINE / QR code 共有の native 実装 (W16+)

---

## 7. 参考 (Refero / Web)

- Notion「guests request access + progressive onboarding」: account 作成前に preview を見せ、手を動かす前に tooltip で誘う型。Haretoki の Level 1 はこのパターンを「家族向けに匿名化」してポート。
- Figma「mobile onboarding animated sign-up」: 「開いた瞬間に動く」印象で怪しさを消す。本書 5.4 の landing 入場モーションはこの効果を狙う。
- Airbnb「invite co-travelers」: 招待される側は既存 Airbnb account を要求される (厳しめ)。Haretoki は結婚という一度きりの意思決定ゆえ、ハードル下げを優先し Airbnb より guest 寄りに倒す。

---

## 8. オープンクエスチョン (設計後に確認)

1. guest 閲覧時の `venue.photos` の署名 URL は TTL 何分にするか? (現状 1h → Level 1 は 15 分に短縮する案)
2. guest の `screenCount` を cookie に詰めるか、server 側に匿名 session table を作るか (後者は個人情報を避けつつ分析取れる)。
3. `invitePartner` (email 直接招待、placeholder 生成) の UI 導線を mypage 内でどの程度 demote するか。全撤去はせず「email で招待 (旧式)」として畳む案。
4. 昇格経路に「Google OAuth のみ」縛りを残すか、email/password も許容するか。現状両方許容。

---

## 9. 変更履歴

| 日付 | 変更 |
|---|---|
| 2026-04-21 | 初版 (docs/w15-designs) |
