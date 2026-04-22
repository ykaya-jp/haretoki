# F2: 見学カレンダー連携 (.ics エクスポート + Google/iOS Calendar 追加)

> Author: product designer (Claude)
> Date: 2026-04-21
> Scope: W15 audit / Track B / 機能 F2
> Status: Design draft — coding pending

---

## 0. TL;DR（先に結論）

- 最短で出す MVP は **.ics を配信する Server Action + 「カレンダーに追加」ボタン** のみ。Google Calendar API 直接連携は R2 以降へ延期する。
- ics 生成は **`ical-generator`** を採用。date/tz/UID/RRULE/VALARM の面倒を見切っており、Day.js/Luxon 依存を足さずに `Date` で完結する。
- UID は `visit.id` をドメイン化して固定（`${visit.id}@haretoki.app`）。再スケジュール・キャンセルの 2 面を **同 UID + SEQUENCE + METHOD** で上書きする。
- エクスポートボタンは **(1) scheduleVisit 成功 toast の action / (2) `/visits` の各カード行末 / (3) 式場詳細 `#visit` セクション** の 3 点に露出。「初回登録直後」と「あとから気づいた人」を両方救う。
- Partner が同じプロジェクトに入っているなら、**owner/partner 双方の画面に同じボタンが出る**。ics は 1 枚で十分（ATTENDEE は入れるが invitation としては送らない — 二重通知を避ける）。
- コピーは辞書どおり丁寧体・急かさない。成功 toast は「カレンダーに追加しました」ではなく **「ふたりのカレンダーに入りました」** を推す。

---

## 1. 基本設計

### 1.1 Purpose

アプリ内の見学カレンダー（`/visits`）は「ふたりの記録」として完結しているが、**個人の日常カレンダー（Google/iOS/Outlook）に反映されない**。そのため:

- 紙の手帳や別アプリと二重管理になる
- 当日の朝に通知が来ない
- パートナーの予定表に「見学」と表示されず、すれ違いが起きる

F2 は「**見学の予定を立てた 1 タップで、ふたりの普段のカレンダーに入る**」体験を提供し、アプリ内と日常生活のカレンダーを**片方向同期**する。

### 1.2 Scope（R1 で出すもの）

| 対象 | 含む |
|---|---|
| `.ics` ファイル生成 | ✓ 1 visit 単位で GET ダウンロード |
| iOS Safari / Android Chrome での開封 | ✓ OS が標準カレンダーへ取込 |
| 「カレンダーに追加」ボタン | ✓ scheduleVisit 直後 toast + `/visits` 一覧 + 式場詳細 |
| UID 固定・上書き（再スケジュール） | ✓ 同 UID + SEQUENCE++ |
| VALARM（前日 18:00 / 当日 1h 前）| ✓ 2 段 |
| LOCATION に venue 名 + 住所 | ✓ |
| DESCRIPTION にアプリへの deep link | ✓ `https://haretoki.app/venues/{id}#visit` |
| 複数 visit の一括 .ics | ✓ プロジェクト単位で `/visits.ics` を 1 本 (= 購読用フィード) |

### 1.3 Non-Goals（R1 で **やらない**）

- **Google Calendar API / Microsoft Graph の OAuth 連携**: R2 以降。OAuth 同意フロー・token 管理・rate-limit・取り消し処理が重く、価値の 80% は .ics で獲得できる。
- **アプリ内カレンダー UI の置換**: `/visits` のカレンダー表示は既に存在 (`VisitMonthCalendar`)。あくまで**外部カレンダーへの出口**として機能する。
- **パートナーの外部カレンダーへ直接 invite 送信**: ics の ATTENDEE は「情報」として含めるだけ。SMTP で招待メールは送らない（spam 扱い・本人同意・メール配信の全てを避ける）。
- **双方向同期**（外部 → アプリ）: 一方通行のみ。外部側で動かした予定はアプリに戻らない。説明文で明示する。
- **タイムゾーン切替**: JST 固定。海外挙式・海外 member は R1 ターゲット外。

### 1.4 Persona

| Persona | 行動 | F2 が効く瞬間 |
|---|---|---|
| **Owner・カレンダー派** | 仕事の予定を全部 Google Calendar に入れている | 見学予定を入れたら即 Google に転記したい。toast の action が効く |
| **Owner・手帳派** | スマホカレンダーは最小限、紙の手帳がメイン | 「出先で予定を見返す」用途。当日の push 通知（ics VALARM）さえ効けば十分 |
| **Partner・消極参加** | Haretoki アプリは開かない。Line と Google Calendar しか見ない | owner が ics を LINE で共有 → partner の Google に投入。ただし R1 では「共有 LINE への ics 添付」までは自動化せず、「ダウンロードして渡す」ガイドに留める |
| **Partner・アクティブ** | アプリにログイン済み | partner 画面にも同じボタン。各自が自分のカレンダーに入れる |

### 1.5 Success Metrics

| Metric | 目標 | 測り方 |
|---|---|---|
| ics export rate | scheduleVisit 成功 → 7 日以内に ics ダウンロード = **60%** | server log で visit.id と download 時刻の pair |
| partner export rate | partner 登録済みプロジェクトで owner/partner 両者が ics を落とした率 = **40%** | 同上 |
| 見学欠席率の低下 | 既存 vs 導入後 no-show 率 | Visit.status が completed に遷移した割合 |
| 「二重管理」妻レビュー | `docs/myreview/problems_02.md` 相当の negative 言及が消える | 次回ユーザー観察で確認 |

計測は最小の server log のみ（専用 `VisitCalendarExport` テーブルは R1 では作らず、Prisma の `Visit.reminderSentAt` 同様に `calendarExportedAt` を 1 列足すだけに留めるトレードオフも検討可）。

### 1.6 データフロー

```
[User taps "カレンダーに追加"]
    │
    ▼
[GET /api/visits/{visitId}/ics] ← requireVisitAccess で auth
    │
    ▼
[Visit + Venue + VisitChecklistItem(最大3件) を DB から読む]
    │
    ▼
[ical-generator で VCALENDAR を組み立て]
    │   UID: ${visitId}@haretoki.app
    │   SEQUENCE: updatedAt 由来の整数
    │   METHOD: REQUEST (新規) / CANCEL (取りやめ)
    │   DTSTART / DTEND (JST, 2h デフォルト)
    │   VALARM ×2 (前日18:00 / 当日1h前)
    │
    ▼
[Content-Type: text/calendar; charset=utf-8; method=REQUEST]
[Content-Disposition: attachment; filename="haretoki-{venueSlug}-{date}.ics"]
    │
    ▼
[iOS Safari] → OS が Apple Calendar で開く → ユーザー「追加」
[Android Chrome] → Google Calendar or OS picker
[Desktop] → ダウンロードフォルダ → dblclick で既定 calendar app
    │
    ▼
[optional: visit.calendarExportedAt = now()]
    │
    ▼
[toast に「カレンダーに追加しました」/ 2 回目以降は "もう一度送る" に変化]
```

### 1.7 2 モード比較：`.ics` download vs Google Calendar API 直接追加

| 観点 | A. `.ics` ファイル配信 | B. Google Calendar API (OAuth) |
|---|---|---|
| **初回実装コスト** | 低（1 日〜2 日） | 高（OAuth 同意 + token storage + refresh + revoke、1 週間〜） |
| **対応カレンダー** | Google / Apple / Outlook / Fastmail / etc 全対応 | Google のみ（Microsoft は別途 Graph API） |
| **partner 片方だけ Google** | 問題なし（partner は Apple でも OK） | partner が iCloud だと動かない |
| **再スケジュール時の上書き** | UID + SEQUENCE + METHOD:REQUEST で標準仕様として動く | API の `events.update` で確実。ただし token 期限切れ時の失敗経路が増える |
| **取り消し** | METHOD:CANCEL で全カレンダー共通 | `events.delete`。token 切れで残留リスク |
| **モバイルの UX** | 1 タップで OS カレンダーが開く（iOS では Apple Calendar へ） | アプリ内 WebView で OAuth 同意 → カレンダー挿入 → 戻る。認知負荷高い |
| **失敗モード** | ユーザーが「追加」をタップし忘れる | token expire / revoke / rate-limit / network all ありうる |
| **プライバシー懸念** | なし（ファイル単発） | Google アカウント全体のカレンダー書込権限を要求 → ユーザーが警戒 |
| **双方向同期** | 不可 | 可能（だが R1 で必要ない） |
| **運用負荷** | 0 | rate-limit 監視 / refresh token ローテ / Google 側 API policy 変更追従 |
| **Lock-in** | なし（ics は標準仕様） | 高（Google のみに寄る） |

**判断: R1 は A (.ics) のみで出す。**

理由:
1. Haretoki の中立ポジショニング（`DESIGN.md` L185「neutral decision tool」）と Google OAuth の「広範な権限要求」は噛み合わない。最初の体験で warning ダイアログを見せたくない。
2. 80% の価値（カレンダーに入る・通知される）は .ics で達成できる。20% の価値（双方向同期）は R2 以降のプレミアム機能として分ける設計余地を残す。
3. partner が iCloud 派であるケース（主婦層で一定数いる）を切り捨てない。
4. 実装・保守コストが桁違い。まず 60% export rate を確認してから B に投資するか判断する。

B を **R2 オプション**として設計の片隅に置く。VCALENDAR 生成を Server Action に閉じ込めておけば、後日 `createGoogleCalendarEvent` を同じ入力から呼ぶだけで差し替えられる。

---

## 2. 詳細設計

### 2.1 ライブラリ選定

| 候補 | 決定 | 理由 |
|---|---|---|
| `ical-generator` | **採用** | TypeScript first、`Date` のまま渡せる、VALARM / ATTENDEE / METHOD / SEQUENCE / TZID を宣言的に書ける、Next.js Node runtime で動く |
| `ics` (adamgibbons) | 見送り | 小さく速いが、callback 気味の API・複数 event の organize が手間 |
| 自力生成 | 見送り | RFC 5545 の CRLF / folding / escaping でバグる典型領域。わざわざやる価値なし |

Runtime は `nodejs` 明示（Edge runtime では `ical-generator` 内部で `Buffer` を参照するため）。

出典:
- [ical-generator - npm](https://www.npmjs.com/package/ical-generator)
- [ics - npm (adamgibbons/ics)](https://www.npmjs.com/package/ics)

### 2.2 Route / Server Action シグネチャ

`GET /api/visits/[visitId]/ics` を選ぶ（Server Action ではなく Route Handler）。理由:

- 認証付き GET + ファイル response が素直に書ける
- ブラウザの `<a href download>` で完結する（JS 不要、反応が速い）
- iOS Safari の .ics handler は「URL 直叩き → Content-Type を見て calendar へ」の経路が最も安定

```ts
// src/app/api/visits/[visitId]/ics/route.ts
export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // cache させない

export async function GET(
  req: Request,
  { params }: { params: Promise<{ visitId: string }> }
): Promise<Response> {
  const { visitId } = await params;
  const user = await requireUser();
  const { projectId } = await requireVisitAccess(user.id, visitId);
  // ... build ical, return with headers
  // NOTE: ここで DB 書込は**しない**。プリフェッチ / retry で意図せず発火するため。
  //   `calendarExportedAt` の更新は別 Server Action で、クライアント側が
  //   ダウンロード成功後に明示的に呼ぶ（下記 §2.2a 参照）
}
```

#### 2.2a Export state を DB に永続化する Server Action

```ts
// src/server/actions/visits.ts (追加)
"use server";
export async function markVisitCalendarExported(
  visitId: string,
): Promise<{ success: boolean }>;
// 内部で requireUser + requireVisitAccess 後、
// prisma.visit.update({ where: { id: visitId }, data: { calendarExportedAt: new Date() } })
// revalidatePath("/visits") と revalidateTag(`project:${projectId}`, { expire: 0 })
```

**クライアント側のフロー**:
1. ユーザーが「カレンダーに追加」タップ
2. `<a href="/api/visits/{id}/ics" download>` でブラウザが ics ダウンロード
3. download イベント成功後（`onClick` から `await fetch` + Blob 経路でも OK）に `markVisitCalendarExported(visitId)` を発火
4. toast「カレンダーに追加しました」

GET handler 側で DB 書込をしない設計は: プリフェッチ / link preview bot / 誤タップキャンセル で `calendarExportedAt` が false positive に立つのを防ぐ。

「一括エクスポート」向けに `GET /api/projects/current/visits.ics` も同時に用意（= 購読可能フィード）。これは `Cache-Control: private, max-age=300` 程度で軽くキャッシュ。

### 2.3 Visit → iCalendar マッピング

| iCalendar フィールド | 値 | 根拠 |
|---|---|---|
| `PRODID` | `-//Haretoki//Visit Calendar 1.0//JA` | RFC 5545 必須 |
| `VERSION` | `2.0` | 固定 |
| `METHOD` | **`PUBLISH`（新規/更新）** / `CANCEL`（`status=cancelled`）| `PUBLISH` にすることで Google Calendar の iTIP (RFC 5546) auto-reply 経路を回避。REQUEST だと ATTENDEE を含めた時点で organizer 宛に自動返信メールが行くケースがある（Google 実測）|
| `UID` | `${visit.id}@haretoki.app` | Prisma 側の UUID を流用。ドメイン固定で複数クライアント跨いで一意 |
| `SEQUENCE` | **`visit.sequence` DB カラム**（後述 §2.6 の migration で追加）| RFC 5545 §3.8.7.4 の non-negative integer 要件を満たす。`updatedAt` 由来の整数は baseline 依存で多端末整合性が崩れるため採用しない。毎回 `{ increment: 1 }` で更新 |
| `DTSTAMP` | `new Date().toISOString().replace(/[-:]/g,"").replace(/\.\d{3}/,"")` で **UTC 固定（末尾 Z）** | RFC 5545 §3.8.7.2 は `DTSTAMP` を UTC 固定で要求。floating にすると Apple Calendar がインポート時刻に置換する |
| `DTSTART` | `visit.scheduledAt` (JST, TZID=Asia/Tokyo) | |
| `DTEND` | `visit.scheduledAt + 2h` | 見学は一般に 90-120 分。R1 は 2h 固定。R2 でユーザー設定に昇格 |
| `SUMMARY` | `【Haretoki】${venue.name} 見学` | ブラケット表記でカレンダーの縦リストで識別しやすく |
| `LOCATION` | `${venue.name} (${venue.location})` | 住所が無ければ名前のみ。Google Maps の deep-link にカレンダーアプリ側で自動展開される |
| `DESCRIPTION` | 下記テンプレ | ふたりがアプリに戻る導線 |
| `URL` | `https://haretoki.app/venues/${venue.id}#visit` | カレンダーアプリ側で「詳細」からタップできる |
| `ORGANIZER` | `CN=Haretoki:mailto:no-reply@haretoki.app` | 公式の顔。ATTENDEE より一段上 |
| `ATTENDEE` | owner / partner の email（あれば）+ `RSVP=FALSE, PARTSTAT=ACCEPTED, ROLE=REQ-PARTICIPANT` | RSVP=FALSE で「返事求めない」表示 |
| `VALARM` × 2 | 前日 18:00 / 開始 1h 前 | 下記参照 |
| `STATUS` | `CONFIRMED` / `CANCELLED` | Visit.status に追従 |
| `CATEGORIES` | `Haretoki,Wedding,Venue Visit` | フィルタ可能に |
| `CLASS` | `PRIVATE` | 他人に見せる情報ではない |

#### DESCRIPTION テンプレ（日本語・丁寧体）

```
${venue.name} の見学です。

当日の持ち物やチェックリストはアプリでご確認いただけます。
▶ https://haretoki.app/venues/${venue.id}#visit

${memo ? `\nメモ:\n${memo}\n` : ''}

※ この予定は Haretoki で作成されました。
 予定を変えたいときは Haretoki から更新すると、
 このカレンダーにも反映されます。
```

最後の 2 行がポイント。**「外部カレンダーを直接書き換えても Haretoki には戻りません」を暗に伝える**。一方通行の明示。

#### VALARM 設計

```
VALARM #1 (前日18:00 JST)
  ACTION: DISPLAY
  TRIGGER: ${前日18:00 - DTSTART} (例: -PT15H30M のような絶対差)
  DESCRIPTION: 明日は ${venue.name} の見学です。持ち物を確認しましょう。
  → アプリ deep-link は DESCRIPTION の末尾に付ける（Apple Calendar は押せる）

VALARM #2 (開始1時間前)
  ACTION: DISPLAY
  TRIGGER: -PT1H
  DESCRIPTION: あと1時間で ${venue.name} の見学が始まります。
```

トレードオフ: `ACTION: EMAIL` は SMTP 側の負荷と spam 扱いで外す。`DISPLAY` は OS 通知のみ、これで十分。
2 段にする理由: **前日に準備・当日に移動** の 2 フェーズそれぞれを救う。3 段以上は「通知疲れ」を起こすので避ける。

### 2.4 UID 維持（再スケジュール / キャンセル）

挙動は以下の表で担保する:

| イベント | METHOD | SEQUENCE | STATUS | DTSTART | UID |
|---|---|---|---|---|---|
| 初回 scheduleVisit | REQUEST | 1 | CONFIRMED | 新日時 | visit.id |
| scheduleVisit 後の編集 | REQUEST | 2, 3, ... | CONFIRMED | 新日時 | visit.id（**同じ**） |
| completeVisit | — | — | — | — | ics は再エクスポートしない（もう過去の予定）|
| cancelVisit（未実装、R1 末追加） | CANCEL | +1 | CANCELLED | そのまま | visit.id |

UID が同じ + SEQUENCE が増える → 殆どのカレンダーアプリ（Google/Apple/Outlook）が既存 event を自動上書きする。これが ics の最大の強み。

Prisma 側に `sequence Int @default(0)` + `calendarExportedAt DateTime?` の 2 列を**同一 migration** で追加:

- **採用**: 専用カラム追加。RFC 5545 §3.8.7.4 の non-negative integer を安全に満たす。updatedAt 由来の baseline 依存だと多端末で整合性が崩れる（どの端末から見ても SEQUENCE が一致する保証が無い）。
- 却下: updatedAt 由来 integer。Prisma 側では `updatedAt` が Date なので整数化に baseline が必要、その baseline が変われば SEQUENCE が巻き戻る。

#### 2.3a VTIMEZONE ブロックの明示出力

`ical-generator` の `timezone: 'Asia/Tokyo'` だけでは VTIMEZONE component は**自動出力されない**。Outlook は VTIMEZONE が無いと UTC 解釈で 9 時間ずれる。

対応:
- `ical-timezones` パッケージと組み合わせて、または手動で以下を VCALENDAR 先頭に埋める:

```
BEGIN:VTIMEZONE
TZID:Asia/Tokyo
BEGIN:STANDARD
DTSTART:19700101T000000
TZOFFSETFROM:+0900
TZOFFSETTO:+0900
TZNAME:JST
END:STANDARD
END:VTIMEZONE
```

DST なし、単一 STANDARD のみ（日本はサマータイムを採用しない）。

### 2.5 Partner 画面への露出

`VisitSection` は式場詳細から `currentUserId` を受ける。エクスポートボタンは user を見ずに表示する（= **owner も partner も同じ権限で ics を落とせる**）。ただし DESCRIPTION 内の「▶ アプリで開く」リンクは共通の venue URL。

ATTENDEE には owner + partner 両方を入れる。「見学は 2 人のイベント」を ics レベルでも表現する。

### 2.6 視点: 既存モデルに足す列

- **追加候補**: `Visit.calendarExportedAt` (DateTime?)
- **目的**: success metrics のため + 「もう一度送る」表示の切替
- **取扱**: R1 で migration 1 本だけ足す。`scheduleVisit` は触らない。export 時に更新。

---

## 3. 画面設計

### 3.1 State Matrix

| 状態 | 条件 | ボタン表示 | ラベル | icon |
|---|---|---|---|---|
| 予定未登録 | `visit === null` | 出ない | — | — |
| 登録済み未エクスポート | `visit.status='scheduled'` && `calendarExportedAt==null` | **secondary / gold-subtle** | カレンダーに追加 | CalendarPlus |
| 登録済みエクスポート済み | `calendarExportedAt!=null` | tertiary (ghost) | もう一度 送る | Calendar + Check |
| キャンセル後 | `visit.status='cancelled'` | **destructive hairline** | カレンダーから外す | CalendarX |
| 完了後 | `visit.status='completed'` | 出ない | — | — |

「もう一度送る」を残す理由: partner が別端末で落とし直したい・機種変更・削除事故などに対応。

### 3.2 露出する場所（3 点）

#### 3.2.1 `scheduleVisit` 成功 toast に action として

既存の `toast.success("見学の予定を追加しました")` (visit-section.tsx L80) を以下に差し替え:

```
toast.success("見学の予定を残しました", {
  description: "ふたりのカレンダーに入れておきますか？",
  action: {
    label: "カレンダーに追加",
    onClick: () => triggerIcsDownload(visitId),
  },
  duration: 8000,
})
```

**トレードオフ**: 成功 toast を 2 アクション構造にすると視線が分散する。しかしこのタイミングが最高コンバージョン瞬間（熱量が一番高い）。ここを逃すと「あとから一覧で気づく」導線に頼ることになり、60% 目標は達成しにくい。duration を 8s に引き伸ばすことで誤タップ離脱は抑える。

#### 3.2.2 `/visits` 一覧の各行末（secondary action）

各 upcoming visit カードの **右下** に小さく配置:

```
[Date block] [Venue name + date + location]   [+ カレンダー]
                                              ← 44px tall, icon + label
```

配置理由: 左側（日付ブロック）は認知の主軸。右下は Gmail / Linear 系の「row action」定位置。ユーザーが行をスキャンしているときに自然に見える。

#### 3.2.3 式場詳細 `#visit` セクション内

`VisitSection` の「見学予定」バッジの横に **Ghost icon button** （32px）で配置。既存の「見学を終えた」「質問を用意する」と同じ行。トリプルボタンの情報過多を避けるため、**アイコンのみ + 長押しで tooltip** ではなく、**アイコン + 短いラベル「カレンダーに追加」** を 3 点目として並べる。

### 3.3 Mobile 375px レイアウト

`/visits` カード内の配置:

```
┌─────────────────────────────────────┐
│ ┌──┐  アニヴェルセル表参道            │
│ │ 11 │  金 10:00                    │
│ │APR│  📍 渋谷区神宮前                │
│ └──┘  ━━━━━━━━━━ 3/5              │
│                        [+カレンダー] │ ← 右下、44px高、88pxくらい
└─────────────────────────────────────┘
```

カード右下に落とすことで、タップ領域が他行の日付ブロック（左）と交錯しない。水平方向のリーディングラインも確保する。

### 3.4 Dark mode

| 要素 | Light | Dark |
|---|---|---|
| ボタン背景 | `var(--gold-subtle)` (10% gold) | `rgba(201,168,76,0.14)` |
| ボタン文字 | `color-mix(in oklab, var(--gold-warm) 80%, var(--foreground))` | `var(--gold-warm)` 直 |
| icon | `var(--gold-warm)` | 同上 |
| pressed | `scale(0.98)` + `bg-opacity +4%` | 同 |

Gold の視認性は dark でも十分。v4.1 Atmospheric Layers で gold-warm は dark でも使える token として既に定義済み。

---

## 4. ユーザー体験設計

### 4.1 User Journey（2 パターン）

#### A. 「予定を入れた直後に誘導」パターン

```
1. /venues/{id}#visit で 「見学の予定を入れる」tap
2. datetime-local で 4/20 10:00 入力 → 「予定を追加」
3. toast 出現：「見学の予定を残しました / ふたりのカレンダーに入れておきますか？」
4. 「カレンダーに追加」tap
5. iOS Safari → Apple Calendar が開く → 「追加」
6. アプリ画面に戻る → 小さな check icon がボタンに出る
7. 翌日、LINE で partner に「予定入れたよ〜 見といて」
```

このパターンが**目標 60% の主戦場**。scheduleVisit → ics export の gap を 3 秒以内に抑える。

#### B. 「一覧で気づいて追加」パターン

```
1. 数日後、/visits を開く
2. Upcoming に 2 件並んでいる → 右下に「+カレンダー」
3. tap → .ics download → OS が calendar に流す
4. 戻ると「もう一度送る」に変化（export 済み表示）
```

このパターンは partner や「後から整理するタイプ」を救う。目標 30%。

### 4.2 Emotion Arc

```
【予定を入れる前】
  不安「紙の手帳と Google と両方書かなきゃ…抜けたらどうしよう」
       ↓
【予定を入れた直後】
  期待「アプリが覚えてくれた。でもスマホの通知は来るのかな…」
       ↓  ← toast「カレンダーに入れておきますか？」
  決断 「お、そう、入れて入れて」→ 1タップ
       ↓
【追加完了】
  安心「朝の通知は Apple Calendar がやってくれる。
       アプリを開かなくても予定が見える」
       ↓
【見学前日】
  落ち着き「VALARM 通知 "明日は ... の見学です" → 持ち物確認」
```

これは Haretoki の **「曇り → 晴れ間 → 晴れ」** のミニ版。不安を晴らすのが F2 の仕事。

### 4.3 コピー（コピー辞書に準拠）

| 場所 | コピー | 理由 |
|---|---|---|
| ボタン（未 export） | **カレンダーに追加** | 最短。`CalendarPlus` icon とセット |
| ボタン（export 済み） | **もう一度 送る** | 「送る」は辞書 §2 の「送信 / 送る」準拠 |
| ボタン（cancel 後） | **カレンダーから外す** | 「削除」ではなく「外す」（辞書「削除 → 手放す / 消す」に準ずる） |
| Toast description | **ふたりのカレンダーに入れておきますか？** | 「ふたり」主語・丁寧・急かさない |
| Toast success | **ふたりのカレンダーに入りました** | 完了を「入った」と擬人化。暖かい |
| Toast failure | **うまく渡せませんでした。また試してみてください** | 辞書§1 の「うまくいきませんでした」系 |
| Loading (短時間) | **ふたりのカレンダー用に 整えています** | 「整える」= 辞書の設定系語彙 |
| ダウンロード直後のガイド（iOS） | **次の画面で「追加」を 押してください** | 単なる指示にならないよう「押してください」 |
| ダウンロード直後のガイド（Android） | **カレンダーアプリで「追加」を 押してください** | |
| ダウンロード直後のガイド（Desktop） | **ダウンロードした ics ファイルを 開くと、お使いの カレンダーに入ります** | 長いが desktop は余白がある |
| セクション説明（一覧画面の subhead, 任意） | **見学の日程を ふたりの カレンダーに持ち出せます** | 「持ち出せる」はポジティブ |

### 4.4 Edge Cases

| ケース | 挙動 |
|---|---|
| **キャンセル後** | visit.status = cancelled → `METHOD:CANCEL` + `STATUS:CANCELLED` で同 UID を再発行。ユーザーがタップすると外部 calendar から予定が消える |
| **タイムゾーン** | R1 は JST 固定。`TZID=Asia/Tokyo` を VCALENDAR 先頭に VTIMEZONE block で明示。海外ユーザーが JST 以外で見ても「JST の何時」と正しく変換される |
| **招待者が片方だけ** | project に partner 未招待 → ATTENDEE は owner 1 名のみ。ボタン文言は「**自分のカレンダーに追加**」に自動切替（partner 有無で 2 通り） |
| **招待者が両方** | ATTENDEE 2 名。ボタン文言「**ふたりのカレンダーに追加**」 |
| **partner の email が未登録** | ATTENDEE に mailto: が書けない → 名前のみ `CN=パートナー` で記載。RSVP は不要なので実害なし |
| **複数 visit の一括エクスポート** | `/api/projects/current/visits.ics` で全 scheduled+completed を 1 枚に。「ふたりのカレンダーを まとめて 持ち出す」ボタンを `/visits` 最下部に提供。2 visit 以上あるときだけ表示 |
| **deep-link が切れた場合** | DESCRIPTION 内の URL を外部カレンダーが保存。Haretoki 側でルートを変えない限り有効 |
| **ユーザーが ics 取消を忘れてアプリ側で cancel** | 現状の取消 UX が無いため影響小。R1 で cancelVisit を追加するとき同時に「カレンダーからも外しますか?」toast を出す設計に引き継ぐ |

### 4.5 Browser / OS 差異

[Apple Community](https://discussions.apple.com/thread/253828742) / [Add to Calendar PRO](https://add-to-calendar-pro.com/articles/ics-to-google-calendar) 参照。

| OS | Browser | 挙動 |
|---|---|---|
| iOS 17+ | Safari | .ics tap → 「Add Event?」sheet → Apple Calendar にデフォルト追加。Google アカウントが sync されていれば Google にも反映される |
| iOS 17+ | Chrome | Safari とほぼ同じ（iOS Chrome は WebKit） |
| iOS 17+ | Google Calendar app | **アプリ内に直接は入らない**。Google 公式は mobile での直 import を未サポート。ユーザーには Apple Calendar 経由 sync を案内する |
| Android 14+ | Chrome | download → notification からタップ → calendar app picker → Google Calendar 直 import OK |
| Desktop | Chrome/Safari/Edge | download → OS の既定 calendar app が開く。「追加」のみタップ |

**リスク**: iOS で Google Calendar 派のユーザーは「Apple Calendar に入ったけど Google には出ない」と言う可能性。これは端末設定の問題で、アプリ側で解決できない。

**対策**: 初回エクスポート時のみ bottom sheet で **3 行ヘルプ**:

```
Google カレンダー派の方へ
iPhone の設定 → カレンダー → アカウント から
Google を追加すると、Google カレンダーでも見られます。
[閉じる]
```

2 回目以降は出さない（LocalStorage で `ics_help_shown=true`）。

---

## 5. UI/UX 設計

### 5.1 デザイントークン参照 (`DESIGN.md` v4.2 準拠)

| 要素 | Token |
|---|---|
| ボタン bg (rest) | `var(--gold-subtle)` (`rgba(201,168,76,0.10)`) |
| ボタン bg (hover) | `color-mix(in oklab, var(--gold-warm) 14%, var(--card))` |
| ボタン text | `color-mix(in oklab, var(--gold-warm) 80%, var(--foreground))` |
| ボタン border | none (flat) — editorial 刷新と同方針 |
| Radius | `12px` (buttons に該当) |
| Height | **`h-11` (44px)** — タッチターゲット最小。shadcn/ui default 上書き |
| Icon | Lucide `CalendarPlus` 20px, `strokeWidth={1.5}` |
| Label | Noto Sans JP, 13-14px, `font-medium` (500) |
| Tap feedback | `active:scale-[0.98]` + duration 150ms (`--dur-tap`) |
| Ring on export complete | `ring-1 ring-[var(--gold-warm)]/40` ephemeral (600ms) |
| Motion ease | `var(--ease-out-luxe)` |

### 5.2 ボタンの視覚的ランク

**tertiary（= secondary より 1 段下）** を選ぶ。理由:

- 式場詳細の既存 primary は「見学を終えた」。並列にすると主従が崩れる
- `/visits` 一覧のメインアクションはカード tap → 詳細遷移。ics は「そこから派生する小さな出口」
- gold-subtle は「AI / 特別」感を持たせつつ、primary の rose terracotta とぶつからない

### 5.3 Accessibility

| 項目 | 対応 |
|---|---|
| `aria-label` | ボタン: `aria-label="${venueName} の見学をカレンダーに追加"` |
| sr-only text | `<span className="sr-only">${venueName}</span>` をアイコン only バージョン（Detail 画面）で |
| Focus ring | `focus-visible:ring-2 focus-visible:ring-[var(--gold-warm)]/60 focus-visible:outline-none` |
| Keyboard | `<a href download>` なので Enter で起動 |
| Contrast | gold-subtle 背景 + gold-warm 80% blend 文字 = WCAG AA (4.5:1) 合格（検算要、Dark mode は別検算） |
| prefers-reduced-motion | export complete 後の ring animation を `duration: 0.01ms` に潰す（`globals.css` の共通ルールで吸収） |
| Screen reader announce | toast success は `role="status"` ＋ `aria-live="polite"` (Sonner default) |

### 5.4 Micro-interactions

| フェーズ | 演出 | 値 |
|---|---|---|
| **Tap** | scale | `1 → 0.98`, 150ms, `var(--ease-out-luxe)` |
| **Fetching ics (200-500ms)** | subtle pulse | icon を `opacity 1 → 0.4 → 1`, 800ms loop, max 2 回で自動停止（fetch が 500ms 以上かかったら spinner に切替） |
| **Download success** | gold ring | icon の外に `ring-1 ring-[var(--gold-warm)]/40` が `scale 1 → 1.4 opacity 1 → 0`, 600ms |
| **Toast 出現** | 下から 20px + fade | duration 300ms (`--dur-fade`) |
| **Export 済みへの遷移** | label cross-fade | 「カレンダーに追加」→ 「もう一度 送る」, 200ms opacity swap |

**Halo Tap は使わない**。`DESIGN.md` L131-141 の Halo Tap は primary CTA 専用と規定されている（Home Hero / Add-Venue FAB / DecisionCeremony）。ics ボタンは tertiary なので適用外。代わりに subtle pulse + ring で抑える。

### 5.5 実装の粒度（次の coding phase への申し送り）

1. `src/lib/ics/build-visit-ics.ts` — pure function（Visit + Venue + Attendees → string）
2. `src/app/api/visits/[visitId]/ics/route.ts` — auth + fetch + build + response
3. `src/app/api/projects/current/visits.ics/route.ts` — 一括 feed
4. `src/components/visits/calendar-export-button.tsx` — client component（3 state + pulse/ring micro-interaction）
5. `src/components/visits/visit-section.tsx` — toast の action 差し込み + カード右下への Button 配置
6. `src/app/(app)/visits/page.tsx` — 各 upcoming card に Button 追加、空/非空時の一括ボタン
7. Prisma: `Visit.calendarExportedAt DateTime?` migration 1 本
8. Vitest: `build-visit-ics.test.ts` — UID/SEQUENCE/VALARM/METHOD の 4 ケース
9. Playwright: visit schedule → ics button click → response.ok + Content-Type 検証

---

## 6. Open Questions / 未解決

- **Q1**: `calendarExportedAt` を DB に足すか、ephemeral（client LocalStorage）で済ますか。DB に足すと server 間で一貫（partner 側でも "export 済み" 表示）。ただし migration が増える。→ **暫定 DB 採用**、ただし reviewer に判断を仰ぎたい
- **Q2**: 一括 .ics のキャッシュ戦略。`Cache-Control: private, max-age=300` で OK か、いっそ no-store にするか。スケジュール変更が即座に反映されない 5 分の遅延をどう見るか
- **Q3**: ics の LOCATION に Google Maps URL を付けるか、プレーン住所のみか。Apple Calendar は URL を自動解析するが、Google Calendar は生の住所を要求することがある。**R1 は venue.name + venue.location のみに絞る** でスタートし、A/B する余地を残す
- **Q4**: partner が「見学には来ない（片方だけ行く）」を表明するフラグ。現状 Visit にそういうフィールドがない。ATTENDEE 固定はやや過剰かもしれない。R1 は**両者 ATTENDEE 固定**、R2 で Visit 単位の「参加者」概念を入れる

---

## 7. Reviewer への注目点

1. **2 モード判断（.ics のみで R1 出し、API は R2）** の納得感
2. **UID 戦略（`visit.id@haretoki.app` + updatedAt 由来 SEQUENCE）** が RFC 5545 的に問題ないか
3. **3 点への露出**（toast / 一覧行末 / 式場詳細）が過剰 or 不足でないか
4. **tertiary ランク + gold-subtle** が `DESIGN.md` v4.2 editorial 刷新の方針と整合するか
5. **`Visit.calendarExportedAt` migration** を F2 だけのために走らせる是非
6. **iOS Safari → Apple Calendar 優先挙動** をヘルプ bottom sheet で補う方針（Google 派ユーザーのフラストレーション対策）
7. VALARM と既存 Visit.reminderSentAt / Notification の排他制御（HIGH）:<br>**確定ルール**: ics を export した visit には `calendarExportedAt IS NOT NULL` が立つため、既存の push リマインダー cron (`reminderSentAt` を更新する job) は WHERE 句に `AND calendarExportedAt IS NULL` を足して**対象外**にする。<br>SQL イメージ: `SELECT * FROM visits WHERE scheduled_at BETWEEN now() AND now() + interval '24 hours' AND reminder_sent_at IS NULL AND calendar_exported_at IS NULL`。<br>これで (a) 外部 VALARM 経由の OS 通知 / (b) Haretoki push reminder / (c) Notification テーブル項目 の 3 系統の二重トリガを防ぐ。

---

## 8. 参考

- [ical-generator - npm](https://www.npmjs.com/package/ical-generator) — 採用ライブラリ
- [ics (adamgibbons) - npm](https://www.npmjs.com/package/ics) — 比較検討先
- [ICS to Google Calendar — Add to Calendar PRO](https://add-to-calendar-pro.com/articles/ics-to-google-calendar) — iOS/Android の挙動
- [Web event with + Add to Calendar (.ics) — Apple Community](https://discussions.apple.com/thread/253828742) — iOS Safari の ics handling
- [DESIGN.md v4.2](../../DESIGN.md) — token / motion / typography
- [docs/copy-lexicon.md](../copy-lexicon.md) — コピー辞書
- [prisma/schema.prisma](../../prisma/schema.prisma) — Visit モデル
- [src/server/actions/visits.ts](../../src/server/actions/visits.ts) — scheduleVisit ほか既存 server action
