# E-1 Weather Ritual — 朝の一言

**モック**: [mockups/e-1-weather-ritual.html](../mockups/e-1-weather-ritual.html)
**優先度**: H（最優先）
**Sprint**: 次 Sprint（R2 相当）
**関連課題**: W-2 (毎日の再訪動機), R1 (進捗リング → 天気アイコン化), V-1 (Weather Token)

---

## What — 何ができるようになるか

ホーム画面の最上部に、**毎朝更新される「おふたりへの小さな一言」** を置く。
eyebrow + 天気アイコン + 今日の一言 + 今日できる 2 分アクション、の 4 行構成。

```
[eyebrow] 2026 APR 16 · 朝 · 晴れ間
[headline] 今日は、料理の印象を整理してみませんか。
[mood]    リッツの試食メモがまだ空欄です。2 分で書けます。
[cta]     → 印象メモを書く
```

### 画面での体験

1. 妻が朝 7:30 に起きてアプリを開く
2. 右上の Sky Chip がふわっと現れる（曇り → 晴れ間 → 晴れ、自分たちの stage に応じた絵柄）
3. 明朝 light の一文が、**今日の自分の状況と繋がった helpful** な何かを言う
4. タップで次の一歩にすぐ進める
5. 完了したら今日の分はゆっくりフェード（「今日は晴れました」の余韻）

### 一言のバリエーション（サンプル 6 種）

| 状況 | 一言 | CTA |
|---|---|---|
| 新規・未入力 | 「まだ見ぬ、あの一日へ。今日は気になる 1 件、置いてみますか。」 | 式場を見てみる |
| 候補 3 件・未評価 | 「リッツの印象、まだ覚えていますか。今のうちに、残しておきましょう。」 | 印象を残す |
| 本命 2 件・費用差 80 万 | 「費用差 80 万円の内訳、そろそろ見比べる時期かもしれません。」 | 比較表を見る |
| 見学予定 明日 | 「明日の見学、聞きたいことを 3 つだけ準備しておきませんか。」 | 質問を決める |
| 決定 1 ヶ月前 | 「晴れの日まで、あと 30 日。ドレスの試着は来月？」 | 準備を確認 |
| 雨の日 | 「外は少し曇り空。室内で、ふたりで写真を見返してみませんか。」 | 候補を振り返る |

---

## Why — なぜ必要か

### ユーザー側の不
- **再訪動機の欠如**: 現状は「自分から用がある時」しか開かない。毎日開く理由がない
- **情報の埋没**: 重要な AI インサイトも、ホーム下部のカードとしてスクロールしないと見えない
- **ブランドメタファーの体感不足**: 「曇り→晴れ間→晴れ」は理念だが、UI 上で**毎日感じられる仕組み**がない
- **"次の一歩"の不在**: 何から手を付けていいか分からないカップルが 60%+（wife-requirements-gaps.md）

### プロダクト側の効果
- **DAU 向上**: 毎朝チェックする理由（= Duolingo 的な軽い接点）
- **AI 価値の毎日可視化**: 「今日はこれ」のパーソナライズが AI を"働いている"状態に
- **ブランド記憶**: Sky Chip + 一言のセット = 他のウェディングアプリと全く違う手触り
- **コンバージョン**: CTA タップ率が高い = プロダクト全体の engagement 底上げ

### ブランドコンセプトとの紐付け
**「曇り → 晴れ間 → 晴れ」は、毎朝の空にある。** 朝の光と、今日のふたりの一歩を結ぶ装置。
The Knot / Zexy がやっていない "静かで情緒的な毎日の伴走"。Aesop Journal の文体、Things 3 の "Today" 感、Linear の落ち着き。

---

## How — どう実装するか

### データ層

```prisma
// prisma/schema.prisma に追加
model DailyRitual {
  id         String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  projectId  String   @map("project_id") @db.Uuid
  date       DateTime @db.Date  // 日付（JST 基準）
  weather    String   // "cloudy" | "break" | "clear" | "sunny"
  headline   String   // 明朝の一文（最大 40 字）
  mood       String?  // サブコピー（最大 60 字）
  ctaLabel   String?  // "印象を残す"
  ctaHref    String?  // "/venues/[id]/evaluate"
  seenAt     DateTime? @map("seen_at")  // ユーザーが見た時刻
  actedAt    DateTime? @map("acted_at") // CTA タップ時刻
  createdAt  DateTime @default(now()) @map("created_at")

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@unique([projectId, date])
  @@index([projectId, date])
  @@map("daily_rituals")
}
```

### 生成ロジック（Server Action）

```ts
// src/server/actions/ritual.ts
"use server";

import { cacheTag } from "next/cache";
import { prisma } from "@/server/db";
import { askClaude, isClaudeAvailable } from "@/lib/anthropic";
import { RITUAL_PROMPT } from "@/lib/prompts/ritual";

export async function getTodayRitual(): Promise<DailyRitual | null> {
  "use cache";
  const { projectId } = await requireMembership();
  cacheTag(`ritual:${projectId}:${jstToday()}`);

  // 1. キャッシュ（同日分が既に生成済みか）
  const existing = await prisma.dailyRitual.findUnique({
    where: { projectId_date: { projectId, date: jstToday() } },
  });
  if (existing) return existing;

  // 2. Claude でパーソナライズ生成
  const context = await buildRitualContext(projectId);
  // context: {stage, venues, favorites, estimate, upcomingVisit, decision, lastOpened}
  const raw = await askClaude({
    system: RITUAL_PROMPT.system,
    userMessage: RITUAL_PROMPT.buildUserMessage(context),
    maxTokens: 256,
  });
  const parsed = safeParseRitual(raw);  // zod で型ガード

  // 3. 保存（UNIQUE projectId+date で重複防止）
  return await prisma.dailyRitual.create({
    data: { projectId, date: jstToday(), ...parsed },
  });
}

export async function markRitualSeen(): Promise<void> { /* seenAt 更新 */ }
export async function markRitualActed(): Promise<void> { /* actedAt 更新 */ }
```

### Prompt（Claude 向け）

```ts
// src/lib/prompts/ritual.ts
export const RITUAL_PROMPT = {
  system: `あなたは Haretoki（結婚式場選びアプリ）の"朝の一言"を書く編集者です。
カップル（ユーザー）が毎朝アプリを開いた時、**静かで、押しつけない、けれど今日 2 分で動ける**
小さな一言を返します。

## 出力 JSON
{
  "weather": "cloudy" | "break" | "clear" | "sunny",
  "headline": "明朝で美しい一文 (20-40 字)。句点含む。",
  "mood": "補足 1 行 (〜60 字)。今日のコンテキストに触れる。",
  "ctaLabel": "短い動詞 (〜8 字)",
  "ctaHref": "相対パス"
}

## トーン
- 命令しない。「〜しましょう」より「〜してみませんか」
- 焦らせない。「今日こそ」「早く」禁止
- 具体と柔らかさ。数字と式場名は使っていい
- 絵文字なし、！なし
- "おめでとう"は決定時のみ

## 天気の対応
- cloudy: 入力情報が少ない、stage: start
- break: stage: adding/visiting, 情報が見えてきた
- clear: stage: comparing, 本命が見えた
- sunny: stage: decided 後

## 禁止
- ニュース的事実（「今日は大安です」等）
- おすすめ式場の断定
- ユーザー情報の露出（名前・メアド等）`,

  buildUserMessage: (ctx: RitualContext) => `今日のおふたりの状況:
stage: ${ctx.stage}
venues: ${ctx.venues.length}件
favorites: ${ctx.favorites.join(", ") || "なし"}
latestEstimate: ${ctx.latestEstimate ?? "未入力"}
upcomingVisit: ${ctx.upcomingVisit ?? "なし"}
今日できる候補アクション: ${ctx.suggestedActions.join(" / ")}

今日の一言を作ってください。`,
};
```

### UI 層

```tsx
// src/components/home/daily-ritual.tsx (新規)
export function DailyRitual({ ritual }: { ritual: DailyRitual | null }) {
  if (!ritual) return <DailyRitualSkeleton />;

  return (
    <motion.section
      aria-label="今日の一言"
      className="relative mb-4"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }}
      onViewportEnter={() => markRitualSeen()}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <p className="text-[10.5px] uppercase tracking-[0.16em] text-muted-foreground">
            {formatDate(new Date())} · {timeOfDay()} · {weatherLabel(ritual.weather)}
          </p>
          <h1 className="mt-3 font-[family-name:var(--font-display)] text-[24px] font-extralight leading-[1.28] tracking-[-0.005em]">
            {ritual.headline}
          </h1>
          {ritual.mood && (
            <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
              {ritual.mood}
            </p>
          )}
        </div>
        <SkyChip mood={ritual.weather} size="lg" />
      </div>

      {ritual.ctaHref && (
        <Link
          href={ritual.ctaHref}
          prefetch
          onClick={() => markRitualActed()}
          className="mt-4 inline-flex items-center gap-1 text-[13.5px] font-medium text-[var(--gold-warm)] focus-visible:..."
        >
          {ritual.ctaLabel}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      )}
    </motion.section>
  );
}
```

### 既存 EditorialHero との関係
- DailyRitual は **EditorialHero の上** に差し込む（ホーム最上部）
- EditorialHero の eyebrow は消して DailyRitual 側に寄せる
- EditorialHero の stage ベース見出しは「今週の主題」的な 2 段目コンテンツに降格（後日）

### 生成 timing
- 初回アクセス時にその日のリチュアルが未存在 → Server Action で Claude 呼び出し（~2 秒、skeleton で待機）
- 2 回目以降は同日分をキャッシュから瞬時返却
- バックグラウンド cron (Vercel Cron) で毎朝 7:00 JST に全ユーザー分を事前生成 → 初回でも 0ms

### Cron 実装

```ts
// src/app/api/cron/generate-rituals/route.ts
export async function GET(req: Request) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const activeProjects = await prisma.project.findMany({
    where: { members: { some: { acceptedAt: { not: null } } } },
    select: { id: true },
  });
  await Promise.allSettled(
    activeProjects.map((p) => generateRitualFor(p.id)),
  );
  return Response.json({ ok: true, count: activeProjects.length });
}
```

```json
// vercel.json
{
  "crons": [{
    "path": "/api/cron/generate-rituals",
    "schedule": "0 22 * * *"  // 07:00 JST = 22:00 UTC
  }]
}
```

---

## 実装見積もり

| Phase | 内容 | 工数 |
|---|---|---|
| DB | `DailyRitual` model 追加 + migration | 20 分 |
| Prompt | `ritual.ts` + 生成/解析/zod | 30 分 |
| Server Action | `getTodayRitual` + markSeen/Acted | 40 分 |
| UI Component | `DailyRitual` + SkyChip サイズ拡張 | 60 分 |
| Cron | API route + vercel.json | 20 分 |
| Hook into home | EditorialHero との接続 + loading.tsx 更新 | 30 分 |
| **合計** | | **約 3.5 時間** |

---

## KPI / 成功指標

- **DAU / WAU**: 新規実装後 2 週間で 1.3 倍
- **seenAt 埋まり率**: 週 4-5 日（60-70%）
- **actedAt 転換率**: seenAt の 25%+（CTA が刺さっているか）
- **headline の reaction**: 定性観察で「読んで微笑んだ/共感した」が 70%+

---

## 次の発展

- **Weekly Rewind**（日曜のダイジェスト）: 月-土のリチュアル合計と achievements
- **Partner 共有**: 同じリチュアルを二人で見て絵文字 1 タップで反応
- **Seasonal variant**: 3 月だけ桜のモチーフ、12 月だけイルミ、等
