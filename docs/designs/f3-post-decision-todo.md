# F3 — 決定後の次アクション todo（契約・頭金・招待状・…）

**Status**: Design draft
**Owner**: product designer (W15)
**Last updated**: 2026-04-21
**関連資産**: `DESIGN.md v4.2` / `docs/copy-lexicon.md` / `src/components/decision/decision-ceremony.tsx` / `src/server/actions/decisions.ts` / `src/app/decision/[projectId]/opengraph-image.tsx` / `prisma/schema.prisma` (Decision / Notification) / `src/app/(app)/checklist/` (用途違い、流用不可の判断根拠を本書に記す)

---

## Design Brief

> **「式場を決めて終わり」ではなく「式場を決めてはじまり」にする。** 決定セレモニー直後の余韻が残っている 90 秒のうちに、次の 3 ステップを目の前に置き、「すべきことが見える」安心感へ橋渡しする。Job: 決めたばかりのふたりが、契約・頭金・招待状の迷子にならないこと。Objection: 「結局このアプリは決定したら用なしなのでは?」を「決めた後もずっと一緒にいてくれる」へ反転させる。Remember: チェックを入れた瞬間の subtle bloom と「はじめの一歩、お疲れさまでした」のトースト。

---

## 1. 基本設計

### 1.1 Purpose

現状、`decision-ceremony.tsx` は `celebration → summary → reason` の 3 フェーズで終わり、ユーザーはホームに戻されます。しかし現実には**契約書確認・内金入金・日取り確定・招待状手配など 10-20 個の実務タスク**が決定直後から発生します。このスペースが空白のまま放置されているため、

- ユーザーは「このアプリは決定までの道具」と認識し、決定翌日以降のリテンションが急落する
- 実務タスクは結局 Excel / LINE メモ / 紙で管理され、ふたりの情報が再び分断される
- 不安（「次、何すればいいんだろう？」）が Haretoki 外で発生する

という 3 つの損失が生じています。F3 はこの空白を埋め、**決定の余韻 → 次の一歩の提示 → 1 件完了の達成感** を一気通貫で提供します。

### 1.2 Scope

**In scope**
- 決定確定直後の「次に向けて準備を始める」ジェントル CTA
- 10-15 件の定型 todo 自動 seed（後述 3.3）
- todo のチェック / 未チェック切替、期限目安・優先度・説明文表示
- 「今週やること」ハイライト（期限 7 日以内の todo を上に）
- 1 件完了・全件完了時のマイクロセレブレーション
- パートナー同士のリアルタイム反映（cache tag 経由）
- 7 日後「続きから」復帰リマインダー（既存 `Notification` モデル流用）

**Out of scope（Non-goals）**
- 完全な予定管理アプリ化（カレンダー連携 / サブタスク / 依存関係 / ガントは作らない）
- todo ごとの見積もり金額記録（見積もり機能と役割を分ける）
- ベンダー招待・業者紹介（媒体化しない中立ツールのポジション維持）
- 「全実務タスクを網羅」を目指す辞書化（10-15 件に絞って「これだけやれば大枠は動く」にする）
- リッチなリマインダー設定 UI（当面は 7 日経過時の 1 回だけ）

**Trade-off の明示**: 10-15 件という少なさは「網羅性」を捨てて「完遂率」を取る判断です。妻観察で「todo 40 件は見るだけで疲れる」ことが読み取れます（copy-lexicon.md の Tone of Voice で「急かさない」を優先）。足りない場合は後述 3.5 のカスタム追加で補完します。

### 1.3 Persona

| Persona | 状態 | このページに求めること |
|---|---|---|
| **Owner（主体的に進めてきた方）** | 決定ボタンを押した直後。達成感と次への漠然とした不安が同居 | 「自分がこれから何をすべきか」の地図 |
| **Partner（途中から合流した方）** | owner の決定通知で来訪。自分の貢献度が低いと感じがち | 「自分でも進められるタスク」を見つけたい（owner-only に見えない設計） |
| **Partner（決定タイミング不在）** | owner がひとりで決定を押した後に閲覧 | 決定セレモニーを見つつ、「でも実務はこれから一緒にやるんだ」という安心 |

owner / partner を同格に扱う認可ポリシーは `setDecision` / `cancelDecision` と同様（「ふたりで決めるもの」原則）を引き継ぎます。

### 1.4 Success metrics

| Metric | 目標値 | 計測方法 |
|---|---|---|
| decision_made → first_todo_check までの時間 | 中央値 90 秒以内 | analytics の 2 イベント差分 |
| todo 完了率（30 日時点） | 平均 5 / 15 件以上 | `DecisionTodo.completedAt IS NOT NULL` の比率 |
| 決定 7 日後のアプリ再訪率 | 60% 以上（現状ベースライン未計測） | `sessionStart` with `days_since_decision <= 7` |
| 決定 30 日後のアプリ再訪率 | 40% 以上 | 同上 |
| 「続きから」リマインダーの開封率 | 30% 以上 | 既存 Notification の `readAt` |

### 1.5 タスクリストの source 選定（重要判断）

3 案を比較します。

| 方式 | Pros | Cons | 採用可否 |
|---|---|---|---|
| **A. ハードコード定型リスト（15 件固定）** | 予測可能 / 開発コスト低 / テスト容易 / i18n 容易 / 全員同じ体験で品質保証しやすい | 式場タイプ（ゲストハウス / ホテル / レストラン）による差が出ない | **採用（MVP）** |
| B. venue ごとのテンプレ | 式場タイプに応じて「和装合わせ」等を出し分けできる | テンプレメタデータを venue schema に追加する必要があり重い / 現状 venue タイプ情報が不十分 | Phase 2 |
| C. AI 生成 | 超パーソナライズ可能 | 幻覚リスク（存在しないタスクを出す）/ レイテンシ / コスト / 「AI 境界」の判断に抵触 / 実務タスクは定型化できるものが大半で AI のマージナル価値が低い | 採用しない |

**推奨: A のハードコード + 「自分で追加」機能（3.5 節）**。実務タスクの 80% は式場差が小さく、定型で十分です。差分は手動追加で吸収します。将来式場メタデータが揃ったら B へ段階的に移行可能な作りにします（`source` フィールドで `"system" | "custom"` を保持）。

### 1.6 データフロー

```
[Decision 作成 / makeDecision]
       ↓ (同一 transaction 内)
[seedDecisionTodos(decisionId)]
       ↓ 15 件 INSERT
[DecisionTodo × 15]
       ↓
[UI: /home の "次の一歩" card に 3 件露出
      /preparation の全 15 件リスト ]
       ↓ ユーザータップ
[toggleTodo(id)] → optimistic update
       ↓ 楽観的反映 + sync
[revalidateTag(`todos:${projectId}`)]
       ↓
[partner 側も再取得時に反映]

[7 日後 job (Vercel Cron or Supabase scheduled)]
       ↓ 未完了 > 10 件ならスキップ（押し付けがましくない）
       ↓ 未完了 5-10 件なら Notification 発火
[Notification "続きから" → /preparation へ deep link]
```

---

## 2. 詳細設計

### 2.1 既存流用 vs 新モデル — 判断

**結論: `ProjectChecklist` は流用せず、新規 `DecisionTodo` モデルを立てる。**

理由:

| 観点 | `ProjectChecklist` | `DecisionTodo`（新規） |
|---|---|---|
| 意味論 | 「venue 比較用に観察する項目」（例: 駅から徒歩何分？） | 「決定後に実行する実務タスク」（例: 内金を振り込む） |
| 状態 | `yes / no / unknown`（三値観察） | `completed / pending`（二値行動） |
| スコープ | venue × item の交差（`VenueChecklistAnswer`） | project × item（venue に紐付かない） |
| 期限 | なし | あり（決定日からの相対日数） |
| 優先度 | なし | あり |
| 混在リスク | 同じテーブルに混ぜると `status` enum が意味破綻する |  |

`ProjectChecklist` / `VenueChecklistAnswer` の構造に todo を混ぜると、 `CHECKLIST_PRESETS` のプリセット辞書と二重メンテになる・比較マトリクスに「頭金を振り込む」が紛れ込むなどの破綻が起きます。**別モデルで完全に分離する**のが最小リスクです。

### 2.2 Prisma schema delta

```prisma
/// F3: 決定後に発生する実務タスク。Decision 作成時に 15 件 seed。
/// ProjectChecklist とは用途が独立（観察 vs 行動）のため別モデル。
model DecisionTodo {
  id           String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  projectId    String    @map("project_id") @db.Uuid
  templateKey  String    @map("template_key")          // "contract_review" などシステム固定 key or cuid()（custom時）
  source       TodoSource @default(system)
  title        String                                   // 表示タイトル。custom時はユーザー入力
  description  String?                                  // 補足文（1-2 行、丁寧体）
  priority     TodoPriority @default(normal)
  dueOffsetDays Int?      @map("due_offset_days")       // 決定日から何日後が目安か（null = 期限目安なし）
  orderIndex   Int        @map("order_index")           // 表示順（0 start）
  completedAt  DateTime?  @map("completed_at")
  completedBy  String?    @map("completed_by") @db.Uuid // どちらが済ませたか（partner 可視化用）
  createdAt    DateTime   @default(now()) @map("created_at")
  updatedAt    DateTime   @updatedAt @map("updated_at")

  project   Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  completer User?   @relation("decision_todo_completer", fields: [completedBy], references: [id], onDelete: SetNull)

  @@unique([projectId, templateKey]) // seed 冪等性 + createMany skipDuplicates の前提
  @@index([projectId, completedAt])
  @@index([projectId, orderIndex])
  @@map("decision_todos")
}

// User モデル側の逆 relation（Prisma 両側宣言必須）:
//   model User {
//     decisionTodosCompleted DecisionTodo[] @relation("decision_todo_completer")
//   }

enum TodoSource {
  system      // seed から生成された定型
  custom      // ユーザー追加
}

enum TodoPriority {
  high        // 契約書・頭金など、期限がシビア
  normal      // 招待状・衣装など通常
  low         // 前撮り・ムービーなど遅らせて OK
}
```

**マイグレーション**: `npx prisma migrate dev --name add_decision_todos`。既存 Decision は CASCADE で触らず、**空プロジェクトに既にある古い Decision に対しては初回閲覧時に lazy seed** する（2.4 参照）。

### 2.3 新規 Server Actions（`src/server/actions/decision-todos.ts`）

シグネチャのみ（実装はしない、F3 実装 PR で書く）:

```ts
// 決定直後に呼ばれる。idempotent（skipDuplicates で 2 回叩いても安全）。
export async function seedDecisionTodos(): Promise<{ seeded: number }>;

// owner / partner どちらも可。completedBy に自分を記録。
export async function toggleTodo(
  todoId: string,
  completed: boolean
): Promise<{ success: boolean; allCompleted: boolean }>;

// ホーム用: 未完了のうち orderIndex 昇順で最大 3 件
export async function getTopTodos(): Promise<DecisionTodoView[]>;

// 準備ページ用: 全件 + 完了数 + 進捗率
export async function getAllTodos(): Promise<{
  todos: DecisionTodoView[];
  completedCount: number;
  totalCount: number;
  progress: number; // 0..1
}>;

// カスタム追加（3.5 節）
export async function addCustomTodo(input: {
  title: string;
  description?: string;
  dueOffsetDays?: number;
}): Promise<{ success: boolean; todo: DecisionTodoView }>;

// カスタム削除（system は削除不可、非表示にはできる = 将来対応）
export async function deleteCustomTodo(todoId: string): Promise<{ success: boolean }>;
```

**認可**: すべて `requireProjectMembership(user.id)` で owner / partner 同格（decisions.ts と同じ規則）。

**cache tag**: `todos:${projectId}` を 1 本。`toggleTodo` / `addCustomTodo` / `deleteCustomTodo` 後は `revalidateTag('todos:${projectId}', { expire: 0 })` と `revalidatePath('/home')` / `revalidatePath('/preparation')`。

### 2.4 Seed タイミング

**採用案: `makeDecision` 成功 → post-commit で seed**（transaction 外）。

- **失敗モードの整理**:
  - transaction 内 seed は一見シンプルだが、seed が失敗すると決定自体が rollback → ユーザーには「決定できませんでした」と出る。本質的には **seed は決定の付随処理** で、seed 失敗で決定をブロックすべきでない
  - そのため: `makeDecision` は従来どおり `venue.update` + `decision.upsert` だけを transaction で確定し、**commit 後** に `try { await seedDecisionTodos(decisionId) } catch (e) { console.error(...); sentryCapture(e) }` を呼ぶ
  - seed 失敗時は既存ユーザーの `/preparation` lazy seed が後で救済する（idempotent）
- Pros: 「決定した瞬間に todo が見える」体験は post-commit でも維持される（`revalidatePath("/home")` 前に seed が走る想定）
- Pros: 決定ボタンが AI 系の一時障害で落ちない
- Cons: ごく稀なケースで「決定したがまだ todo が見えない」状態が数ミリ秒残る（lazy seed で次回閲覧時に埋まる）

**冪等性**: `seedDecisionTodos` は `createMany({ skipDuplicates: true })` + `@@unique([projectId, templateKey])` 制約。多端末同時アクセス競合もこれで吸収。

**lazy seed の race 防止**: `/preparation` ページ server action 側で `prisma.$transaction(async (tx) => { const count = await tx.decisionTodo.count({...}); if (count === 0) await tx.decisionTodo.createMany(...) })` のトランザクションスコープで count→insert を束ねる（複数クライアント同時閲覧時の二重 seed 防止）。

### 2.5 推奨 todo 15 件（system preset）

（決定日 = Day 0 として `dueOffsetDays` を目安表示。厳密な締切ではなく「このあたりまでに」の柔らかい指標。）

| # | templateKey | title | description | priority | dueOffsetDays |
|---|---|---|---|---|---|
| 1 | `contract_review` | 契約書を読み合わせる | キャンセル規定・延期ポリシー・支払スケジュールを、ふたりで一度通し読み | **high** | 7 |
| 2 | `deposit_payment` | 内金（申込金）を振り込む | 式場から届いた振込案内にしたがって手配 | **high** | 14 |
| 3 | `wedding_date_fix` | 日取りを確定する | 仮予約から本予約へ。天候季節・親族の都合・記念日を最終チェック | **high** | 14 |
| 4 | `guest_list_draft` | ゲストリストを書き出す | 新郎側・新婦側それぞれ、ざっくり人数だけでも OK | high | 30 |
| 5 | `invitation_design` | 招待状のデザインを決める | 式場提携 or 外注 or 手作り。サンプルをふたりで見比べ | normal | 60 |
| 6 | `seating_chart_draft` | 席次表のたたきを作る | ゲストリストが固まってから。親族間のバランス確認が肝心 | normal | 90 |
| 7 | `dress_fitting` | 衣装合わせを予約する | 試着 3-4 着が目安。早めの枠を押さえると選択肢が広がる | normal | 45 |
| 8 | `hair_makeup_trial` | ヘアメイクの打ち合わせを入れる | 好みのイメージ写真を集めてから相談すると話が早い | normal | 60 |
| 9 | `gift_return` | 引出物・引菓子を選ぶ | 2-3 品構成が一般的。地域性とゲスト層を意識 | normal | 90 |
| 10 | `wedding_movie` | ムービー演出を決める | オープニング / プロフィール / エンドロール。自作 or 外注 or なし | low | 120 |
| 11 | `prewedding_photo` | 前撮りを計画する | 季節ロケーションで印象が変わる。数ヶ月前に撮影枠を押さえる | low | 90 |
| 12 | `ceremony_program` | 当日の進行・演出を相談する | 入場・乾杯・余興・手紙。プランナーさんと役割分担 | normal | 90 |
| 13 | `ring_preparation` | 結婚指輪を用意する | サイズ直し・刻印・納品までに 1-2 ヶ月かかることが多い | normal | 60 |
| 14 | `budget_reconcile` | 総予算を再点検する | 見積もりと入金計画を並べて、余白があるか確認 | **high** | 30 |
| 15 | `honeymoon_plan` | 新婚旅行の大枠を決める | 式後すぐ or 数ヶ月後。式場予約と連動するフライトの押さえ忘れ注意 | low | 150 |

**選定根拠**: ゼクシィ・みんなのウェディングの既存チェックリスト（公開されている定型リスト）を参照しつつ、「契約・支払い」「式の中身」「前後の周辺」でバランスを取って 15 件に絞り込みました。20 件以上は妻観察で「開いただけで疲れる」ため不採用。

### 2.6 リマインダー

既存 `Notification` モデル（`prisma/schema.prisma:697`）を**そのまま流用**できます。

- **Trigger**: Vercel Cron（日次 09:00 JST）で「decision 確定から 7 日経過 & 未完了 5-10 件」の projects を抽出し、`Notification` を 1 件 INSERT
- **type**: `"decision_todo_followup"`
- **href**: `/preparation`
- **タイトル/本文例**: 「続きから、どうぞ」「次の一歩が、まだ 7 つ残っています。朝の 10 分でひとつ進めてみませんか」

押し付けがましさ回避: 未完了 > 10 件 / = 0 件 / decision から 30 日超はスキップ（cron 側ロジック）。

---

## 3. 画面設計

### 3.1 State matrix

| State | UI | トリガー |
|---|---|---|
| S0. decision 直後・0 件完了 | ホーム hero 下に "次の一歩" card（3 件）+ "準備ページへ" リンク | makeDecision 直後の revalidate |
| S1. 1-4 件完了 | 進捗リング（gold arc）+ 「今週やること」ハイライト | toggleTodo 後 |
| S2. 5-10 件完了 | リング 1/3 以上、「順調です」eyebrow | 同上 |
| S3. 11-14 件完了 | 残り強調「あと N つ」 | 同上 |
| S4. 15 件完了 | Celebrate ribbon（gold）+「これで大枠は整いました」 | allCompleted === true |
| S5. 7 日放置 | Notification 1 通。ホームの card に「続きから」eyebrow | Cron |
| S6. 決定キャンセル | todo 群は削除せず**非アクティブ化**して休眠（4.4 で詳述） | cancelDecision |

### 3.2 配置（どこに置くか）

採用: **新規 `/preparation` route を切り、ホーム / 候補から誘導する**。

候補案と比較:

| 案 | Pros | Cons |
|---|---|---|
| A. `/home` 内のセクションだけで完結 | 導線短い | ホームが縦長になりすぎる / 他機能と視線競合 |
| B. `/candidates` タブに「決定後」タブ追加 | 決定の文脈に近い | 候補 = "まだ選んでいる" なので意味論が割れる |
| **C. 新規 `/preparation`（採用）** | 決定後の専用空間。集中できる / タブ名「準備」がふたりの今の状態を正確に示す | ルート 1 本追加 |

`/preparation` はボトムナビには**加えない**（5 タブは最大）。代わりに:
- ホーム hero 直下に "次の一歩" card（3 件のみ表示、タップで `/preparation` へ）
- `/decision/{projectId}` 完了画面の最下部 CTA
- Notification からのディープリンク

で十分な露出を確保します。ボトムナビを汚さず、決定後の users だけが自然に辿り着く導線です。

### 3.3 Wireframe（ASCII, mobile 375px）

**ホーム hero 直下 "次の一歩" card**

```
┌──────────────────────────────────────────────┐
│  NEXT STEPS                                  │  ← 10.5px eyebrow gold
│  次の一歩                                    │  ← 18px 明朝 light
│                                              │
│  ┌──────────────────────────────────────┐    │
│  │ ○  契約書を読み合わせる          → │    │  ← h-11 row
│  │    あと 7 日めやす · たいせつ      │    │  ← 11px caption
│  ├──────────────────────────────────────┤    │
│  │ ○  内金を振り込む                → │    │
│  │    あと 14 日めやす · たいせつ      │    │
│  ├──────────────────────────────────────┤    │
│  │ ○  日取りを確定する              → │    │
│  │    あと 14 日めやす · たいせつ      │    │
│  └──────────────────────────────────────┘    │
│                                              │
│         ─── 残り 12 つ ·  全部を見る ───      │  ← text-button
└──────────────────────────────────────────────┘
```

**`/preparation` ページ**

```
┌──────────────────────────────────────────────┐
│  ← 戻る                                      │
│                                              │
│  TOWARDS THE DAY                             │  ← eyebrow
│  晴れの日へ、次の一歩                        │  ← 24px 明朝 light
│  ふたりで、ゆっくりで大丈夫です              │  ← 12.5px muted
│                                              │
│        ╭────╮                                │
│        │ 3  │  ← 進捗リング（gold arc 20%）    │
│        │ /15│     tabular-nums                │
│        ╰────╯                                │
│                                              │
│  今週やること · 3                            │  ← subsection head
│  ┌──────────────────────────────────────┐    │
│  │ ○  契約書を読み合わせる             │    │
│  │    キャンセル規定・延期ポリシー…    │    │  ← description 2 行
│  │    あと 7 日めやす · たいせつ       │    │
│  ├──────────────────────────────────────┤    │
│  │ ● 　(完了済み、打ち消し線 + gray)   │    │
│  └──────────────────────────────────────┘    │
│                                              │
│  このあと                                    │  ← subsection
│  ┌──────────────────────────────────────┐    │
│  │ ○  招待状のデザインを決める          │    │
│  │    あと 60 日めやす                  │    │
│  │ ...                                  │    │
│  └──────────────────────────────────────┘    │
│                                              │
│  ＋ 自分たちの やること を追加                │  ← custom todo
│                                              │
└──────────────────────────────────────────────┘
```

### 3.4 Dark mode

- 背景: `var(--background)`（dark では ink-soft）
- gold アクセント（進捗リング、eyebrow）はそのまま透過 oklab mix で自然減光
- checkbox 未チェック枠: `var(--border)` / dark mode では `border/70`
- 完了テキスト: `text-muted-foreground/60`（dark）

すべて既存 token で完結するため、専用 dark token は新設不要。

---

## 4. ユーザー体験設計

### 4.1 User journey

```
[決定ボタン押下]
   ↓ 3.4 秒のセレモニー
[summary 画面]
   ↓「決めた理由を残す」→ 保存 or「あとで記録」
[決定完了画面 / 共有リンク]
   ↓ 最下部 CTA「次に向けて準備を始める」
       （gold-subtle flat primary、ゴールド border）
   ↓
[/preparation 初回訪問]
   ↓ hero「晴れの日へ、次の一歩」が fade-in
   ↓ 進捗リング 0/15、todo カード 15 件が stagger 50ms で登場
   ↓ 最初の 1 件タップ → checkbox bloom（gold 粒子 3 つ）→ 打ち消し線 fade
   ↓ トースト「はじめの一歩、お疲れさまでした」
[7 日後]
   ↓ Notification「続きから、どうぞ」
   ↓ タップ → /preparation へ直行 → 続きから再開
```

### 4.2 Emotion arc

| 時刻 | 感情 | 誘発装置 |
|---|---|---|
| T+0s | 達成感 | セレモニー confetti / 記念カード |
| T+20s | 落ち着き | summary の journey stats |
| T+40s | 次への漠然とした不安 | 「この後、何をすれば？」 |
| T+50s | 安心（「道が見える」） | 「次に向けて準備を始める」CTA |
| T+60s | 前進感 | 15 件が並ぶ / 今週やること 3 件ハイライト |
| T+75s | 達成感（2 回目） | 1 件チェック → bloom + トースト |
| T+7 日 | 復帰の正当化 | Notification「続きから」 |

### 4.3 コピー（copy-lexicon.md 準拠）

**見出し・セクション**
- `/preparation` H1: 「晴れの日へ、次の一歩」（TOWARDS THE DAY）
- subheadline: 「ふたりで、ゆっくりで大丈夫です」
- 今週やること: 「今週やること · N」
- 残り: 「このあと」
- 全件完了: 「大枠は整いました。おふたりの朝が近づいています」

**CTA**
- 決定完了画面 → preparation: 「次に向けて準備を始める」（急かさない、命令形を避ける）
- preparation 内 custom 追加: 「＋ 自分たちの やること を追加」

**トースト**
- 1 件完了: 「はじめの一歩、お疲れさまでした」（初回のみ。2 回目以降は「ひとつ済みました」に減衰）
- 全件完了: 「15 つ、すべて終わりました。おつかれさまでした」
- 未完了へ戻した時: 「戻しました」
- 追加: 「メモに加えました」
- 削除: 「消しました」
- エラー: 「うまくいきませんでした」（copy-lexicon.md）

**todo 個別文言**: 2.5 の表に記載。description はすべて丁寧体、句点なし、40 字以内。

**空ステート（該当しうるケース）**: 決定前にうっかり `/preparation` を開いた場合
- 「まだ晴れの日を決めていません。気になる式場を見比べてから、準備のリストが現れます。」
- CTA: 「気になる式場を見る」→ `/explore`

### 4.4 Edge cases

| ケース | 挙動 |
|---|---|
| **決定キャンセル** (`cancelDecision`) | **同一 venue で再決定するケース** と **別 venue に変更して再決定するケース** を区別する:<br>  - (a) **同一 venue 再決定**: todo を保持（`completedAt` もそのまま）。数時間迷って戻るケースに該当。<br>  - (b) **別 venue 再決定**: `DecisionTodo` の `completedAt` を **一括 reset**（`updateMany({where: {projectId}, data: {completedAt: null, completedBy: null}})`）。理由: 「契約書確認（A 式場）」を済ませた状態が「契約書確認（B 式場）」に継承されるのは意味論的に誤り。<br>判定は `cancelDecision → makeDecision` の連続時に**前後の `venueId` 比較**で行う。UI 上は決定がない間 `/preparation` は「まだ決定前です」ステートに戻る。<br>**将来の再正規化**: `DecisionTodo.decisionId` FK 化は Phase 2。`Decision` が upsert されるたびに新しい row を残す設計（履歴型）に切り替えるときに同時対応。|
| **パートナーが先に済ませた todo** | `completedAt` + `completedBy` で表示。「〇〇さんが 2 日前に済ませました」と 11px muted caption で控えめに添える。owner/partner のみ可視（ふたりだけの情報）。 |
| **カスタム todo 追加可否** | 可。`source='custom'` で保持。上限 10 件（UI で押し付けがましくなく「あと N 件追加できます」表記）。system todo に混ざらないよう `/preparation` 下部「自分たちのやること」サブセクションに分離。 |
| **system todo 削除** | 不可。代わりに「非表示」（将来対応、MVP では「完了」で擬似消化を案内）。理由: 網羅性のシグナルが崩れると「自分の見落とし」への不安が再燃。 |
| **期限切れ (dueOffsetDays 超過)** | 赤色にしない。「少し遅れています」caption（muted-foreground）にとどめる。急かさないトーン維持。 |
| **partner 合流時に既に system todo が 15 件 seed 済み** | 普通に表示するだけ。partner ID の初回アクセスに対して toast「おふたりで進める準備が 15 つあります」を 1 回表示して合流感を出す。 |

### 4.5 離脱リカバリ

- T+7d: Notification「続きから、どうぞ」（4.1）
- T+14d: 2 回目の Notification は**送らない**（押し付けがましくなる）
- T+30d: ホームの `EditorialHero` の Stage 判定で `decision_with_open_todos` stage を追加し、eyebrow を「次の一歩」に差し替える（既存機構に乗せる、新規通知増やさない）

---

## 5. UI / UX 設計

### 5.1 トークン（DESIGN.md v4.2 準拠）

| 用途 | Token |
|---|---|
| page background | `var(--background)` |
| hero eyebrow | `text-[10.5px] uppercase tracking-[0.14em] text-[var(--gold-warm)]` |
| H1 明朝 | `font-[family-name:var(--font-display)] text-[24px] font-light tracking-[0.01em]` |
| todo card | `rounded-2xl border border-border bg-card` |
| checkbox unchecked | `border-[1.5px] border-[var(--border)]` |
| checkbox checked | `bg-[var(--gold-warm)] + white check icon` |
| 完了テキスト | `line-through text-muted-foreground/60` |
| 進捗リング arc | `stroke-[var(--gold-warm)]` / 背景 arc `stroke-border` |
| "今週やること" accent | `bg-[color-mix(in_oklab,var(--gold-warm)_6%,transparent)]` + 左 2px gold border（`MatrixInsight` と同パターン） |
| priority:high dot | 直径 4px `bg-[var(--gold-warm)]`（右上に置く、"たいせつ" 文言と併記） |
| caption | `text-[11px] text-muted-foreground` |
| description | `text-[12.5px] leading-[1.55] text-muted-foreground` |
| custom todo form | 破線枠 `border-dashed border-[var(--border)]`（Drop Zone 原則 P1） |

### 5.2 既存パターン流用

| 既存 | F3 での再利用 |
|---|---|
| `ChecklistStarterCTA` (`src/components/checklist/starter-cta.tsx`) | `/preparation` 初回「準備リストを始める」CTA に構造コピー（Sparkles + eyebrow + 朝光 linear-gradient 背景） |
| `MatrixInsight` (`src/components/comparison/decision-matrix.tsx`) | 「今週やること」サブセクションの 2px gold band + AI hint 風 card に転用 |
| `SkyChip` | 進捗リング中央に 40px で配置し、完了度に応じて mood を `cloudy → break → sunny` に変化させる（ブランドメタファーの延長） |
| `HaloTap` | checkbox / CTA タップ時の halo feedback |
| `EditorialHero` の stage 追加 | ホーム hero を "decision_with_open_todos" stage 対応にする |

### 5.3 Accessibility

- checkbox: `role="checkbox"` / `aria-checked` / 44 × 44 px hit area（視覚は 24 × 24 px、padding で拡張）/ `aria-describedby` で description を関連付け
- 進捗リング: `role="progressbar"` / `aria-valuenow` / `aria-valuemax={15}` / sr-only テキスト「15 件中 3 件完了」
- 今週やること: `<section aria-labelledby="this-week-heading">`
- focus-visible: 既存 `focus-visible:ring-1 focus-visible:ring-[var(--gold-warm)]/40` 踏襲
- 色以外でも priority を示す: high に "たいせつ" 文言を併記（色覚多様性対応）
- Notification deep link: `/preparation#todo-{id}` で当該項目に scroll + focus

### 5.4 Dark mode

- 背景は `var(--background)` で自動追従
- gold arc / eyebrow は oklab mix で dark の ink 背景上でも彩度保持
- 進捗リング背景 arc: light で `stroke-border` / dark で `stroke-[color-mix(in_oklab,var(--foreground)_10%,transparent)]`
- bloom 粒子: 白系ではなく gold 系 3 色で固定（light/dark 両方で映える）

### 5.5 Micro-interactions

| 動作 | 値 |
|---|---|
| checkbox tap bloom | gold 粒子 3 つ、radial fade 200ms ease-out / `prefers-reduced-motion` で無効化 |
| 完了時の打ち消し線 | 250ms ease-out でスライドイン（左→右） |
| 進捗リング更新 | 完了数変化で arc が 600ms `var(--ease-out-luxe)` でアニメート |
| 初回 stagger | カード 50ms 間隔で `opacity 0→1, y 8→0`（`--stagger` token） |
| 全件完了ハイライト | gold ribbon が 1 回だけ sweep（900ms、以降再生しない） |
| hover (desktop) | card が `translateY(-1px)` + shadow 強化（200ms） |

### 5.6 パフォーマンス予算

- `/preparation` 初期 bundle: 既存 `/checklist` と同程度（≤ 30KB gzip）。list は Server Component で prefetch
- `toggleTodo` 楽観的更新: React `useOptimistic` でタップから 0ms UI 反応、サーバー往復は背景
- Notification 送信: Vercel Cron 1 回/日、1 回あたり高々数百件の project を scan（index: `decision_todos(projectId, completedAt)` + `decisions(decidedAt)`）

### 5.7 Refero 参照（コンセプト妥当性チェック）

- **Airbnb "Trip checklist"**: 旅行予約後に「パスポート確認 / 空港送迎 / 荷物準備」と丁寧にリスト化する UI。**学び**: 「完了するほど消えていく」のではなく「完了マークのまま残す」ことで達成の痕跡が visible になる。本設計でも物理削除はしない。
- **Headspace "Onboarding todo"**: 初回 5 件の todo を「今日のひとつだけ」とミニマルに見せる。**学び**: 全 15 件を同時に露出せず「今週やること 3 件」を優先表示することで初動負荷を減らす設計は本書 3.3 / 4.3 と整合。

---

## 実装順序（参考・この PR では非対象）

1. schema delta + migration（2.2）
2. `src/lib/decision-todos/presets.ts` に 15 件の system template 定義
3. `src/server/actions/decision-todos.ts` 実装 + unit test
4. `makeDecision` に `seedDecisionTodos` 連結
5. `/preparation` route + loading.tsx + empty state
6. ホーム hero 下 "次の一歩" card
7. Notification cron job（`src/app/api/cron/decision-followup/route.ts`）
8. E2E: 決定 → 3 件 check → 進捗リング 20% → refresh 永続 → partner からも反映

---

**以上。** F3 は「決定で終わり」を「決定ではじまり」に反転させる、ブランドメタファー延長線上の機能です。15 件に絞ること、system / custom を分離すること、partner と同格に扱うこと、急かさないトーンを維持することの 4 点が体験の鍵となります。
