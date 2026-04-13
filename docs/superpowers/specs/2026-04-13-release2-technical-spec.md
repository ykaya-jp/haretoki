# VenueLens v2 Release 2 — AI Intelligence Technical Specification

> Release 1 の4タブUI + ルールベースAIが完成した状態から、Claude API を全面接続してAI機能を有効化する技術設計書。
> 参照: [roadmap.md](../../roadmap.md) / [Release 1 技術設計書](./2026-04-13-release1-technical-spec.md) / [v2-redesign](./2026-04-13-venuelens-v2-redesign.md)
> 作成日: 2026-04-13

---

## a) Prisma スキーマ変更

### AiAnalysisType — `coach_chat` の使用開始

Release 1 で enum に `coach_chat` を追加済み。Release 2 では定型FAQ応答ではなく Claude API 応答の保存先として実際に使用開始する。enum 自体の DDL 変更は不要。

```prisma
enum AiAnalysisType {
  review_summary
  estimate_prediction
  comparison
  visit_prep
  coach_chat          // R1で追加済み。R2で本格使用開始
}
```

### 新規モデル: Review

旧 design spec (`2026-04-12-venuelens-design.md`) の `reviews` テーブル定義に準拠。口コミ AI 要約の保存先。著作権コンプライアンスのため、オリジナルのレビューテキストは保存しない。

```prisma
enum ReviewSource {
  zexy
  wedding_park
  hanayume
  mynavi
  minna_no_wedding
}

model Review {
  id        String       @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  venueId   String       @map("venue_id") @db.Uuid
  source    ReviewSource
  sourceUrl String       @map("source_url")
  rating    Decimal?     @db.Decimal(2, 1)
  aiSummary String?      @map("ai_summary")
  sentiment Json?        // per-dimension sentiment scores: { atmosphere: 0.8, cuisine: 0.6, ... }
  fetchedAt DateTime     @default(now()) @map("fetched_at")

  venue Venue @relation(fields: [venueId], references: [id], onDelete: Cascade)

  @@index([venueId])
  @@map("reviews")
}
```

Venue モデルにリレーション追加:

```prisma
model Venue {
  // ... existing relations ...
  reviews  Review[]  // NEW
}
```

### チャット履歴の保存戦略: AiAnalysis vs 新テーブル CoachMessage

#### 選択肢比較

| 観点 | A: AiAnalysis 拡張 | B: 新テーブル CoachMessage |
|------|-------------------|--------------------------|
| スキーマ変更量 | 最小（既存テーブル利用） | 新テーブル + マイグレーション |
| クエリ性能 | `type='coach_chat'` + `projectId` インデックスで十分 | 専用インデックスで最適 |
| 会話履歴の取得 | `output` に JSON で Q&A ペアを保存 → パース必要 | `role` カラムでユーザー/AI を区別 → クエリ直感的 |
| ストリーミング対応 | 部分応答の保存が不自然（完了後に1レコード） | メッセージ単位で保存可能 |
| 将来の拡張性 | token 数、latency 等のメタデータ追加が煩雑 | カラム追加で柔軟に対応 |
| R3以降の見学チャット | 別の type を追加するだけ | 別テーブルか同テーブルに `context` カラム追加 |

#### 推奨: B — 新テーブル `CoachMessage`

チャット機能は会話の往復が本質であり、1メッセージ = 1レコードのモデルが自然。ストリーミング応答の途中状態管理や、将来のコンテキスト拡張（式場別チャット等）にも対応しやすい。

```prisma
enum MessageRole {
  user
  assistant
}

model CoachMessage {
  id        String      @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  projectId String      @map("project_id") @db.Uuid
  role      MessageRole
  content   String
  metadata  Json?       // { model, inputTokens, outputTokens, latencyMs, venueId? }
  createdAt DateTime    @default(now()) @map("created_at")

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([projectId, createdAt])
  @@map("coach_messages")
}
```

Project モデルにリレーション追加:

```prisma
model Project {
  // ... existing relations ...
  coachMessages CoachMessage[]  // NEW
}
```

> **注**: `AiAnalysis` テーブルの `coach_chat` type は、チャット以外の AI 分析結果（口コミ要約、比較分析等）のキャッシュ用として引き続き使用する。コーチチャットの会話履歴は `CoachMessage` に、分析結果のキャッシュは `AiAnalysis` にと、役割を明確に分離する。

### AiAnalysis — `inputHash` の NOT NULL 化検討

Release 2 ではコスト管理のため `inputHash` による重複排除を本格活用する。既存データとの互換性を保つため nullable のまま維持するが、新規レコード作成時は必ず `inputHash` を設定するようアプリケーション層で強制する。

### マイグレーション手順

```bash
npx prisma migrate dev --name add_reviews_coach_messages_for_r2
npx prisma generate
npm run build
```

### データ移行: AiAnalysis(coach_chat) → CoachMessage

R1 で `AiAnalysis` テーブルに `type='coach_chat'` で保存されたチャット履歴を `CoachMessage` テーブルに移行する。マイグレーション（DDL）とは分離し、別スクリプトとして実行する。

**移行スクリプト**: `scripts/migrate-coach-chat.ts`

```typescript
// scripts/migrate-coach-chat.ts
// Run: npx tsx scripts/migrate-coach-chat.ts
import { prisma } from "../src/server/db";

async function migrateCoachChat() {
  const chatRecords = await prisma.aiAnalysis.findMany({
    where: { type: "coach_chat" },
    orderBy: { createdAt: "asc" },
  });

  console.log(`Found ${chatRecords.length} coach_chat records to migrate`);

  let migrated = 0;
  for (const record of chatRecords) {
    // R1 saves Q&A pairs in output JSON: { question: string, answer: string }
    const output = record.output as { question?: string; answer?: string } | null;
    if (!output) continue;

    const messages = [];
    if (output.question) {
      messages.push({
        projectId: record.projectId,
        role: "user" as const,
        content: output.question,
        createdAt: record.createdAt,
      });
    }
    if (output.answer) {
      messages.push({
        projectId: record.projectId,
        role: "assistant" as const,
        content: output.answer,
        metadata: { migratedFrom: "ai_analysis", originalId: record.id },
        createdAt: record.createdAt,
      });
    }

    await prisma.coachMessage.createMany({ data: messages });
    migrated++;
  }

  console.log(`Migrated ${migrated} records to CoachMessage`);
  // NOTE: Do NOT delete original AiAnalysis records — keep as backup
  // After verification, optionally mark as migrated:
  // await prisma.aiAnalysis.updateMany({
  //   where: { type: "coach_chat" },
  //   data: { type: "coach_chat_migrated" },
  // });
}

migrateCoachChat()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
```

**実行タイミング**: R2-A Prisma マイグレーション完了後、R2-C コーチチャット実装前に実行。

**ロールバック手順**: `CoachMessage` テーブルを truncate し、`AiAnalysis` の `coach_chat` レコードは元のまま残っている。

**検証**:
1. 移行前後のレコード件数が一致すること
2. `CoachMessage` の `createdAt` が元の `AiAnalysis.createdAt` と一致すること
3. Coach 画面でチャット履歴が正しく時系列表示されること

マイグレーション内容:
1. `ReviewSource` Enum 作成
2. `MessageRole` Enum 作成
3. `reviews` テーブル作成 + インデックス
4. `coach_messages` テーブル作成 + 複合インデックス

---

## b) Claude API 呼び出しアーキテクチャ

### 共通 API クライアント設計

既存の `src/lib/claude.ts` を拡張し、ストリーミング対応・エラーハンドリング強化・PII ストリッピングを組み込む。

```
src/lib/
├── anthropic.ts           # NEW: 共通クライアント（claude.ts を置換）
└── prompts/               # NEW: プロンプト管理ディレクトリ
    ├── coach-chat.ts      # コーチチャット用
    ├── estimate-analysis.ts  # 見積もり解析用（既存を移動）
    ├── url-extraction.ts  # URL抽出用
    ├── review-summary.ts  # 口コミ要約用
    ├── comparison.ts      # 比較分析用
    └── onboarding.ts      # オンボーディング推薦用
```

#### `src/lib/anthropic.ts` — 共通クライアント

```typescript
import Anthropic from "@anthropic-ai/sdk";
import { createHash } from "crypto";

// --- Singleton client ---
let client: Anthropic | null = null;

export function getAnthropicClient(): Anthropic {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }
  if (!client) {
    client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return client;
}

export function isClaudeAvailable(): boolean {
  return !!process.env.ANTHROPIC_API_KEY;
}

// --- Non-streaming call ---
export async function askClaude(options: {
  system: string;
  userMessage: string;
  model?: string;
  maxTokens?: number;
}): Promise<string> {
  const claude = getAnthropicClient();
  const response = await claude.messages.create({
    model: options.model ?? "claude-sonnet-4-20250514",
    max_tokens: options.maxTokens ?? 4096,
    system: options.system,
    messages: [{ role: "user", content: options.userMessage }],
  });
  const textBlock = response.content.find((b) => b.type === "text");
  if (!textBlock) throw new Error("No text response from Claude");
  return textBlock.text;
}

// --- Streaming call (for Coach Chat) ---
export async function streamClaude(options: {
  system: string;
  messages: Array<{ role: "user" | "assistant"; content: string }>;
  model?: string;
  maxTokens?: number;
}): Promise<ReadableStream<string>> {
  const claude = getAnthropicClient();
  const stream = await claude.messages.stream({
    model: options.model ?? "claude-sonnet-4-20250514",
    max_tokens: options.maxTokens ?? 2048,
    system: options.system,
    messages: options.messages,
  });

  return new ReadableStream<string>({
    async start(controller) {
      try {
        for await (const event of stream) {
          if (
            event.type === "content_block_delta" &&
            event.delta.type === "text_delta"
          ) {
            controller.enqueue(event.delta.text);
          }
        }
        controller.close();
      } catch (error) {
        controller.error(error);
      }
    },
  });
}

// --- Input hash for deduplication ---
export function computeInputHash(input: string): string {
  return createHash("sha256").update(input).digest("hex").slice(0, 16);
}

// --- PII stripping ---
const PII_PATTERNS = [
  /[\w.+-]+@[\w-]+\.[\w.-]+/g,                    // email
  /0[0-9]{1,4}-?[0-9]{1,4}-?[0-9]{3,4}/g,        // Japanese phone
  /\d{3}-\d{4}/g,                                  // postal code
  /[一-龥ぁ-んァ-ヶ]{1,4}(様|さん|くん|ちゃん)/g,      // honorific names
];

export function stripPII(text: string): string {
  let result = text;
  for (const pattern of PII_PATTERNS) {
    result = result.replace(pattern, "[REDACTED]");
  }
  return result;
}
```

#### 後方互換性

既存の `src/lib/claude.ts` は `src/lib/anthropic.ts` へのリエクスポートに変更し、`estimates.ts` の `askClaude` / `isClaudeAvailable` の呼び出しが壊れないようにする。

```typescript
// src/lib/claude.ts (後方互換ラッパー)
export { isClaudeAvailable } from "./anthropic";
import { askClaude as askClaudeNew } from "./anthropic";

export async function askClaude(
  systemPrompt: string,
  userMessage: string,
): Promise<string | null> {
  try {
    return await askClaudeNew({ system: systemPrompt, userMessage });
  } catch {
    return null;
  }
}
```

### プロンプト管理

各 `src/lib/prompts/*.ts` は以下の構造を持つ:

```typescript
// 共通インターフェース
export interface PromptConfig {
  system: string;
  buildUserMessage: (...args: unknown[]) => string;
  model?: string;      // default: claude-sonnet-4-20250514
  maxTokens?: number;  // default: 4096
}
```

プロンプトのバージョン管理はファイル内の定数として管理。変更履歴はgit diff で追跡する。

### ストリーミング対応（コーチチャット用）

Next.js Server Action はデフォルトでは `ReadableStream` を返せない。コーチチャットのストリーミングは **Route Handler** で実装する。

```
src/app/api/coach/stream/route.ts   # POST: ストリーミング応答
```

```typescript
// src/app/api/coach/stream/route.ts
import { NextRequest, NextResponse } from "next/server";
import { requireUser, requireProjectMembership } from "@/server/auth";
import { streamClaude, stripPII, computeInputHash } from "@/lib/anthropic";
import { COACH_CHAT_PROMPT } from "@/lib/prompts/coach-chat";
import { prisma } from "@/server/db";

export async function POST(request: NextRequest) {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  const { message } = await request.json();

  // Load conversation history (last 20 messages for context window management)
  const history = await prisma.coachMessage.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  // Load user context (venues, conditions, estimates)
  const context = await loadUserContext(projectId);

  // Save user message
  await prisma.coachMessage.create({
    data: { projectId, role: "user", content: message },
  });

  // Build messages array with PII stripping
  const messages = [
    ...history.reverse().map((m) => ({
      role: m.role as "user" | "assistant",
      content: stripPII(m.content),
    })),
    { role: "user" as const, content: stripPII(message) },
  ];

  const stream = await streamClaude({
    system: COACH_CHAT_PROMPT.buildSystemPrompt(context),
    messages,
    maxTokens: 2048,
  });

  // Collect full response for DB save
  let fullResponse = "";
  const transformedStream = new TransformStream<string, Uint8Array>({
    transform(chunk, controller) {
      fullResponse += chunk;
      controller.enqueue(new TextEncoder().encode(chunk));
    },
    async flush() {
      // Save assistant response after stream completes
      await prisma.coachMessage.create({
        data: {
          projectId,
          role: "assistant",
          content: fullResponse,
          metadata: {
            model: "claude-sonnet-4-20250514",
            inputHash: computeInputHash(message),
          },
        },
      });
    },
  });

  const readableStream = stream.pipeThrough(transformedStream);

  return new NextResponse(readableStream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Transfer-Encoding": "chunked",
    },
  });
}
```

### エラーハンドリング

| エラー種別 | 検出方法 | 対処 |
|-----------|---------|------|
| レート制限 (429) | `Anthropic.RateLimitError` | 指数バックオフ（1s, 2s, 4s）で最大3回リトライ。超過時はユーザーに「しばらく待ってから再試行」 |
| タイムアウト | `Anthropic.APIConnectionTimeoutError` | 1回リトライ後、フォールバック（定型応答 or 「AIが混み合っています」） |
| トークン上限 | `max_tokens` 到達 | `stop_reason: "max_tokens"` をチェックし、応答末尾に「...」追加。ユーザーに「続きを聞く」ボタン表示 |
| API Key 未設定 | `isClaudeAvailable()` | R1 のルールベース応答にフォールバック（graceful degradation） |
| 不正な JSON 応答 | `JSON.parse` 失敗 | 最大2回リトライ。それでも失敗時はエラーメッセージ表示 |

リトライロジックは共通ユーティリティとして実装:

```typescript
// src/lib/anthropic.ts に追加
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = 3,
  baseDelay: number = 1000,
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries) throw error;
      if (error instanceof Anthropic.RateLimitError) {
        await new Promise((r) => setTimeout(r, baseDelay * 2 ** attempt));
        continue;
      }
      throw error; // Non-retryable errors
    }
  }
  throw new Error("Unreachable");
}
```

### PII ストリッピングの実装方針

1. **送信前**: `stripPII()` でメール、電話番号、郵便番号、敬称付き人名を除去
2. **対象**: ユーザー入力テキスト、式場レビュー内容、チャット履歴
3. **非対象**: 式場名、エリア名、駅名（これらは式場選びに必要な情報）
4. **ログ**: 除去した PII のカウントを metadata に記録（内容は記録しない）

### Vercel 60s Function Timeout への対処

| 処理 | 想定時間 | 対策 |
|------|---------|------|
| コーチチャット | 3-10s | ストリーミング（TTFB < 2s） |
| 見積もり PDF 解析 | 5-15s | 同期処理で十分。PDF テキスト抽出 + Claude 1回 |
| URL 式場追加 | 5-20s | 同期処理。fetchHTML + Claude 1回。タイムアウト近い場合は部分結果を返す |
| 口コミ AI 要約 | 10-45s | **バックグラウンドジョブ化**。複数 URL のフェッチ + 分析が重い |
| AI 比較分析 | 3-8s | 同期処理で十分 |
| オンボーディング AI 推薦 | 3-8s | 同期処理で十分 |

60s を超えるリスクがある「口コミ AI 要約」のみバックグラウンドジョブで処理する（詳細はセクション d）。

---

## c) 各 AI 機能のプロンプト設計

### 1. コーチチャット

**ファイル**: `src/lib/prompts/coach-chat.ts`

#### システムプロンプト

```typescript
export const COACH_CHAT_PROMPT = {
  buildSystemPrompt: (context: UserContext) => `あなたは「VenueLens コーチ」です。結婚式場選びをサポートする、温かく知識豊富なAIアドバイザーです。

## 役割
- カップルの結婚式場選びを中立的にサポートする
- 押し売りをしない。「選ぶ」を支援する立場
- 具体的な数値やデータに基づいたアドバイスをする
- 不安を煽らず、準備の大切さを伝える

## トーンガイド
- 丁寧体（です・ます）
- 簡潔に（1応答200字以内を目安）
- 必要に応じて箇条書きで整理
- 「〜してはいかが？」「〜してみましょう」のような提案形

## ユーザーのコンテキスト
${context.conditions ? `- 希望条件: エリア=${context.conditions.area?.join("/")??"未設定"}, ゲスト=${context.conditions.guestCount??"未設定"}名, 予算=${context.conditions.budget?.min??"?"}〜${context.conditions.budget?.max??"?"}万円` : "- 希望条件: 未設定"}
${context.venues.length > 0 ? `- 登録式場(${context.venues.length}件): ${context.venues.map(v => `${v.name}(${v.status})`).join(", ")}` : "- 登録式場: なし"}
${context.favorites.length > 0 ? `- 候補(${context.favorites.length}件): ${context.favorites.join(", ")}` : ""}
${context.latestEstimate ? `- 最新見積もり: ${context.latestEstimate.venueName} ¥${Math.round(context.latestEstimate.total / 10000)}万円` : ""}

## 制約
- 特定の式場を「ここにしましょう」と断定的に推薦しない
- 他の結婚式場紹介サービス（ゼクシィ、ハナユメ等）の批判をしない
- 結婚式場選び以外の話題（離婚、法律相談等）には応じない
- 個人情報の収集をしない`,

  model: "claude-sonnet-4-20250514",
  maxTokens: 2048,
};
```

#### ユーザープロンプト

ユーザーの入力メッセージがそのまま送信される（PII ストリッピング適用後）。会話履歴は `messages` 配列で渡す。

### 2. 見積もり解析

**ファイル**: `src/lib/prompts/estimate-analysis.ts`

既存の `ESTIMATE_ANALYSIS_SYSTEM_PROMPT`（`estimates.ts` L85-112）を移動し、以下を改善:

```typescript
export const ESTIMATE_ANALYSIS_PROMPT = {
  system: `You are an expert at analyzing Japanese wedding venue estimates (見積書).
Extract structured data from the provided PDF text content.

Japanese wedding estimate upgrade patterns (use these to predict final cost):
- Attire (dress, tuxedo): 62% upgrade rate, typical +¥200,000-400,000
- Cuisine (course upgrade): 65% upgrade rate, typical +¥150,000-300,000
- Photo/Video/Endroll: 50% upgrade rate, typical +¥200,000-350,000
- Flowers/Table decor: 45% upgrade rate, typical +¥100,000-250,000
- Performances/Effects: 40% upgrade rate, typical +¥50,000-150,000
- AV/Sound equipment: 30% upgrade rate, typical +¥30,000-80,000

IMPORTANT: Identify the tier (minimum/standard/premium) of each item based on:
- Price relative to typical range for that category
- Descriptive keywords (e.g. "スタンダード", "プレミアム", "基本プラン")
- If unclear, mark as "unknown"

For predictedFinal calculation:
- Only apply upgrade probability to items at "minimum" or "unknown" tier
- Use the midpoint of typical increase range * upgrade rate
- Add a 10% buffer for miscellaneous untracked upgrades

Return ONLY valid JSON (no markdown, no code fences) with this structure:
{
  "total": <number>,
  "items": [
    {
      "category": "<attire|cuisine|photo_video|flowers|performance|av_equipment|venue_fee|other>",
      "itemName": "<item name in Japanese>",
      "amount": <number>,
      "tier": "<minimum|standard|premium|unknown>",
      "predictedUpgrade": <number, expected additional cost>,
      "upgradeProbability": <number, 0.0-1.0>
    }
  ],
  "predictedFinal": <number>,
  "analysisNote": "<brief note in Japanese about the prediction reasoning>",
  "confidence": "<high|medium|low>"
}

Frame predictions positively. If uncertain, return valid JSON with reasonable defaults.`,

  buildUserMessage: (pdfText: string) =>
    `以下は結婚式場の見積書のテキスト内容です。構造化データとして抽出してください:\n\n${pdfText}`,

  model: "claude-sonnet-4-20250514",
  maxTokens: 4096,
};
```

**R1 からの改善点**:
- `predictedUpgrade` と `upgradeProbability` を各アイテムレベルで返すよう要求（R1 では全体の predictedFinal のみ）
- `confidence` フィールド追加（PDF の読み取り品質に応じた信頼度）
- tier 判定のガイドラインを詳細化

### 3. URL 抽出

**ファイル**: `src/lib/prompts/url-extraction.ts`

```typescript
export const URL_EXTRACTION_PROMPT = {
  system: `You are an expert at extracting structured wedding venue information from Japanese web page content.

Given raw HTML text content from a wedding venue page (Zexy, Wedding Park, Hanayume, Mynavi, etc.), extract the following information.

Return ONLY valid JSON (no markdown, no code fences):
{
  "name": "<venue name in Japanese>",
  "location": "<area/address, e.g. '表参道' or '東京都渋谷区神宮前'>",
  "accessInfo": "<nearest station and walking time, e.g. '表参道駅 徒歩3分'>",
  "capacityMin": <number or null>,
  "capacityMax": <number or null>,
  "ceremonyStyles": ["<チャペル|神殿|ガーデン|その他>"],
  "estimatedPrice": <number in yen, base price for ~60 guests, or null>,
  "features": ["<key features as short phrases>"],
  "photoUrls": ["<image URLs found on page, max 5>"],
  "sourceUrl": "<original URL>",
  "confidence": "<high|medium|low>"
}

Guidelines:
- If a field cannot be determined, use null (not empty string)
- For price, look for "見積もり例", "お見積り", "挙式+披露宴" patterns
- For capacity, look for "着席" followed by number
- For ceremony styles, map to the enum values above
- photoUrls: prefer large venue/ceremony photos, skip thumbnails and icons
- confidence: "high" if major fields found, "medium" if some missing, "low" if minimal data`,

  buildUserMessage: (pageContent: string, url: string) =>
    `以下はURL ${url} から取得したウェブページの内容です。結婚式場の情報を構造化データとして抽出してください:\n\n${pageContent.slice(0, 30000)}`,

  model: "claude-sonnet-4-20250514",
  maxTokens: 2048,
};
```

### 4. 口コミ要約

**ファイル**: `src/lib/prompts/review-summary.ts`

```typescript
export const REVIEW_SUMMARY_PROMPT = {
  system: `You are an expert at analyzing Japanese wedding venue reviews and generating structured summaries.

Analyze the provided review content and generate:
1. A concise Japanese summary (150-200 characters)
2. Per-dimension sentiment analysis

Return ONLY valid JSON:
{
  "summary": "<overall summary in Japanese, 150-200 chars>",
  "sentiment": {
    "atmosphere": <-1.0 to 1.0>,
    "hospitality": <-1.0 to 1.0>,
    "cuisine": <-1.0 to 1.0>,
    "cost": <-1.0 to 1.0>,
    "access": <-1.0 to 1.0>,
    "overall": <-1.0 to 1.0>
  },
  "strengths": ["<top 3 positive points in Japanese>"],
  "concerns": ["<top 3 concerns in Japanese, if any>"],
  "reviewCount": <number of reviews analyzed>,
  "suggestedScores": {
    "atmosphere": <1.0-5.0>,
    "hospitality": <1.0-5.0>,
    "cuisine": <1.0-5.0>,
    "cost": <1.0-5.0>,
    "access": <1.0-5.0>,
    "reviews": <1.0-5.0>
  }
}

Guidelines:
- sentiment: -1.0 = very negative, 0 = neutral, 1.0 = very positive
- suggestedScores: derived from sentiment, maps to 1-5 star scale
- Summarize patterns across reviews, not individual opinions
- Frame concerns constructively ("〜が気になるという声も" not "〜が悪い")
- IMPORTANT: Do not quote or reproduce original review text verbatim`,

  buildUserMessage: (reviews: string[], venueName: string) =>
    `以下は「${venueName}」の口コミ内容です（${reviews.length}件）。分析してください:\n\n${reviews.join("\n---\n").slice(0, 50000)}`,

  model: "claude-sonnet-4-20250514",
  maxTokens: 2048,
};
```

### 5. 比較分析

**ファイル**: `src/lib/prompts/comparison.ts`

```typescript
export const COMPARISON_PROMPT = {
  system: `You are a wedding venue comparison analyst. Given structured data about 2-3 venues and the couple's preferences, provide a natural-language tradeoff analysis.

Return ONLY valid JSON:
{
  "summary": "<2-3 sentence overview in Japanese>",
  "tradeoffs": [
    {
      "dimension": "<dimension name>",
      "analysis": "<1 sentence comparative analysis in Japanese>",
      "leader": "<venue name that leads in this dimension, or null if tied>"
    }
  ],
  "recommendations": [
    "<actionable recommendation in Japanese>"
  ],
  "budgetPick": "<venue name, or null>",
  "qualityPick": "<venue name, or null>",
  "balancedPick": "<venue name, or null>"
}

Guidelines:
- Be objective, not prescriptive. "〜を重視するなら" not "〜にすべき"
- Include cost comparison with specific numbers
- Maximum 3 recommendations, each actionable
- If data is insufficient for a dimension, skip it`,

  buildUserMessage: (venues: VenueComparisonData[], conditions: ProjectConditions | null) => {
    const venueDescriptions = venues.map(v => `
【${v.name}】
- エリア: ${v.location ?? "不明"}
- 収容: ${v.capacityMin ?? "?"}〜${v.capacityMax ?? "?"}名
- スタイル: ${v.ceremonyStyles.join(", ") || "不明"}
- 見積もり: ${v.estimate ? `¥${Math.round(v.estimate.total / 10000)}万円 (予測最終: ¥${Math.round((v.estimate.predictedFinal ?? v.estimate.total) / 10000)}万円)` : "未入力"}
- スコア: ${v.scores.map(s => `${s.dimension}=${s.score}`).join(", ") || "未評価"}`
    ).join("\n");

    const conditionsDesc = conditions
      ? `\nカップルの希望: エリア=${(conditions as Record<string, unknown>).area ?? "未設定"}, ゲスト=${(conditions as Record<string, unknown>).guestCount ?? "未設定"}名, 予算=${(conditions as Record<string, unknown>).budget ?? "未設定"}`
      : "";

    return `以下の式場を比較分析してください:${venueDescriptions}${conditionsDesc}`;
  },

  model: "claude-sonnet-4-20250514",
  maxTokens: 2048,
};
```

### 6. オンボーディング推薦

**ファイル**: `src/lib/prompts/onboarding.ts`

```typescript
export const ONBOARDING_RECOMMENDATION_PROMPT = {
  system: `You are a knowledgeable Japanese wedding venue advisor. Given a couple's preferences, suggest 3 venues that match their criteria.

You should recommend based on general knowledge of popular Japanese wedding venues in the specified area.

Return ONLY valid JSON:
{
  "recommendations": [
    {
      "name": "<venue name in Japanese>",
      "location": "<area>",
      "reason": "<1-2 sentence reason in Japanese why this matches their criteria>",
      "estimatedPrice": <estimated base price in yen for their guest count, or null>,
      "ceremonyStyles": ["<available styles>"],
      "strengths": ["<2-3 key strengths>"]
    }
  ],
  "advice": "<1 sentence general advice in Japanese>"
}

Guidelines:
- Recommend real, well-known venues in the specified area
- Match guest count to venue capacity
- Match budget range to venue price range
- Diverse recommendations: luxury, mid-range, value options
- If area is not specified, suggest venues in Tokyo metropolitan area`,

  buildUserMessage: (conditions: OnboardingConditions) =>
    `以下の条件で結婚式場を3件おすすめしてください:
- 希望スタイル: ${conditions.style?.join(", ") ?? "特になし"}
- ゲスト人数: ${conditions.guestCount ?? "未定"}名
- エリア: ${conditions.area?.join(", ") ?? "特になし"}
- 予算: ${conditions.budget ? `${conditions.budget.min}〜${conditions.budget.max}万円` : "特になし"}`,

  model: "claude-sonnet-4-20250514",
  maxTokens: 2048,
};
```

---

## d) バックグラウンドジョブ設計

### 対象処理

60s 以内に完了しないリスクがある処理:
1. **口コミ AI 要約** — 複数 URL のフェッチ + Claude 分析（10-45s）
2. **URL 式場追加**（複数 URL を一括処理する場合）

### 技術選定: Supabase Edge Functions

| 選択肢 | 利点 | 欠点 |
|--------|------|------|
| Supabase Edge Functions | Supabase エコシステム内、Deno ベース、400s タイムアウト | コールドスタート、Deno 固有の癖 |
| pg_cron | DB 内で完結、追加インフラ不要 | SQL 内での HTTP 呼び出しが煩雑、デバッグ困難 |
| Vercel Cron Jobs | Vercel 統合、設定簡単 | 1日1回等の定期実行向き。オンデマンド不向き |
| Inngest / Trigger.dev | 本格的なジョブキュー | 追加サービス、オーバーキル |

**選定: Supabase Edge Functions**

理由:
- 既に Supabase を使用しており追加インフラ不要
- 400s のタイムアウトで口コミ分析に十分
- `supabase.functions.invoke()` で Next.js から簡単に呼び出し可能
- pg_cron は HTTP API 呼び出し（Claude API）には不向き

### ジョブフロー

```
Client → Server Action → DB にジョブレコード作成 → Supabase Edge Function 呼び出し
                                                       ↓
                                              Claude API 処理
                                                       ↓
                                              DB にジョブ結果保存
                                                       ↓
Client ← ポーリング（3秒間隔） ← Server Action ← DB からジョブ状態取得
```

### ジョブステータス管理

`AiAnalysis` テーブルを拡張して使用する。新規カラムは追加せず、`output` フィールドの JSON 内にステータスを含める。

```typescript
// ジョブ作成時
await prisma.aiAnalysis.create({
  data: {
    projectId,
    venueId,
    type: "review_summary",
    inputHash: computeInputHash(sourceUrls.join(",")),
    output: JSON.stringify({ status: "processing", startedAt: new Date().toISOString() }),
  },
});

// ジョブ完了時（Edge Function 内）
await prisma.aiAnalysis.update({
  where: { id: jobId },
  data: {
    output: JSON.stringify({
      status: "completed",
      result: analysisResult,
      completedAt: new Date().toISOString(),
    }),
  },
});

// ジョブ失敗時
await prisma.aiAnalysis.update({
  where: { id: jobId },
  data: {
    output: JSON.stringify({
      status: "failed",
      error: errorMessage,
      failedAt: new Date().toISOString(),
    }),
  },
});
```

### ポーリング vs WebSocket

**選定: ポーリング（3秒間隔）**

理由:
- バックグラウンドジョブは頻繁に使わない機能（口コミ分析は式場あたり1回程度）
- WebSocket は Supabase Realtime で R3 のパートナー同期用に導入予定。R2 でのポーリングは十分
- 実装がシンプル

```typescript
// Client-side polling hook
export function useJobStatus(jobId: string | null) {
  const [status, setStatus] = useState<"idle" | "processing" | "completed" | "failed">("idle");
  const [result, setResult] = useState<unknown>(null);

  useEffect(() => {
    if (!jobId) return;
    setStatus("processing");

    const interval = setInterval(async () => {
      const job = await checkJobStatus(jobId);
      if (job.status === "completed") {
        setStatus("completed");
        setResult(job.result);
        clearInterval(interval);
      } else if (job.status === "failed") {
        setStatus("failed");
        clearInterval(interval);
      }
    }, 3000);

    // Timeout after 120s
    const timeout = setTimeout(() => {
      setStatus("failed");
      clearInterval(interval);
    }, 120000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, [jobId]);

  return { status, result };
}
```

---

## e) Server Actions 変更

### R1 定型 FAQ → Claude API 置換

#### `sendCoachMessage()` の変更

R1 ではキーワードマッチングで定型 FAQ 応答を返していた。R2 では以下のように変更:

```typescript
// src/server/actions/coach.ts — R2 での変更

export async function sendCoachMessage(message: string): Promise<CoachResponse> {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  // R2: Claude API が利用可能ならストリーミングエンドポイントにリダイレクト
  if (isClaudeAvailable()) {
    // ストリーミングは Route Handler (/api/coach/stream) で処理するため、
    // この Server Action は非ストリーミングのフォールバックとして維持
    const context = await loadUserContext(projectId);
    const history = await prisma.coachMessage.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      take: 20,
    });

    // Save user message
    await prisma.coachMessage.create({
      data: { projectId, role: "user", content: message },
    });

    const response = await withRetry(() =>
      askClaude({
        system: COACH_CHAT_PROMPT.buildSystemPrompt(context),
        userMessage: stripPII(message),
        maxTokens: 2048,
      })
    );

    // Save assistant response
    await prisma.coachMessage.create({
      data: {
        projectId,
        role: "assistant",
        content: response,
        metadata: { model: "claude-sonnet-4-20250514" },
      },
    });

    return {
      answer: response,
      suggestedActions: [], // Claude response handles this
      matched: true,
    };
  }

  // Fallback: R1 keyword matching (unchanged)
  return matchFAQ(message, projectId);
}
```

#### `getComparisonData()` の AI 分析置換

R1 のテンプレート文生成 (`generateComparisonInsight()`) を Claude API 呼び出しに置換:

```typescript
// src/server/actions/comparison.ts — insight 生成部分の変更

async function generateComparisonInsight(
  venues: ComparisonVenue[],
  conditions: ProjectConditions | null,
): Promise<ComparisonInsight> {
  // R2: Claude API available → AI analysis
  if (isClaudeAvailable()) {
    const inputHash = computeInputHash(
      venues.map(v => v.id).sort().join(",")
    );

    // Check cache (24h TTL)
    const cached = await prisma.aiAnalysis.findFirst({
      where: {
        type: "comparison",
        inputHash,
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });
    if (cached) return JSON.parse(cached.output);

    const response = await withRetry(() =>
      askClaude({
        system: COMPARISON_PROMPT.system,
        userMessage: COMPARISON_PROMPT.buildUserMessage(venues, conditions),
      })
    );

    const result = JSON.parse(response);

    // Cache result
    await prisma.aiAnalysis.create({
      data: {
        projectId: venues[0].projectId,
        type: "comparison",
        inputHash,
        output: response,
      },
    });

    return {
      text: result.summary,
      recommendations: result.recommendations,
      tradeoffs: result.tradeoffs,
    };
  }

  // Fallback: R1 template-based insight
  return generateTemplateInsight(venues);
}
```

### 新規 Server Actions

#### 1. `addVenueFromUrl(url)` — ⚠️ R1で実装済み

> **注記（2026-04-13）**: この関数は R1 に前倒し実装済み。R2 では `src/lib/anthropic.ts` の共通クライアントへのリファクタリングのみ。以下のコードは R2 リファクタリング後の参考実装として残す。

```typescript
// src/server/actions/venues.ts に追加（R1で実装済み。R2で anthropic.ts に移行）

export async function addVenueFromUrl(url: string): Promise<{
  venue?: Venue;
  error?: string;
}> {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  if (!isClaudeAvailable()) {
    return { error: "AI機能を利用するにはAPIキーを設定してください" };
  }

  // Validate URL
  try {
    new URL(url);
  } catch {
    return { error: "有効なURLを入力してください" };
  }

  try {
    // Fetch page content (server-side)
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; VenueLens/1.0)",
        "Accept": "text/html",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return { error: "ページを取得できませんでした。URLを確認してください" };
    }

    const html = await response.text();

    // Extract text content (strip HTML tags — lightweight alternative to BeautifulSoup)
    const textContent = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    // Send to Claude for structured extraction
    const claudeResponse = await withRetry(() =>
      askClaude({
        system: URL_EXTRACTION_PROMPT.system,
        userMessage: URL_EXTRACTION_PROMPT.buildUserMessage(textContent, url),
      })
    );

    const extracted = JSON.parse(claudeResponse);

    // Create venue
    const venue = await prisma.venue.create({
      data: {
        projectId,
        name: extracted.name,
        location: extracted.location,
        accessInfo: extracted.accessInfo,
        capacityMin: extracted.capacityMin,
        capacityMax: extracted.capacityMax,
        ceremonyStyles: extracted.ceremonyStyles ?? [],
        sourceUrls: [url],
        photoUrls: extracted.photoUrls ?? [],
        status: "researching",
      },
    });

    // If estimated price available, create initial estimate
    if (extracted.estimatedPrice) {
      await prisma.estimate.create({
        data: {
          venueId: venue.id,
          projectId,
          version: 1,
          total: extracted.estimatedPrice,
          sourceType: "ai_extracted",
        },
      });
    }

    revalidatePath("/explore");
    revalidatePath("/");
    return { venue };
  } catch (error) {
    console.error("URL extraction error:", error);
    return {
      error: error instanceof Error
        ? error.message
        : "URL からの情報取得に失敗しました。手動で追加してください",
    };
  }
}
```

> **注**: Python の BeautifulSoup ではなく、サーバーサイド `fetch` + HTML テキスト抽出 + Claude で実装する。理由: Next.js Server Action 内で Python プロセスを起動するのはアーキテクチャ的に不自然。HTML のテキスト抽出は正規表現ベースの簡易パースで十分（Claude が構造化データを生成する）。将来的にパース精度を上げるなら `cheerio` (Node.js) を導入する。

#### 2. `analyzeReviews(venueId, sourceUrls)`

```typescript
// src/server/actions/reviews.ts (NEW)
"use server";

import { prisma } from "@/server/db";
import { requireUser, requireProjectMembership } from "@/server/auth";
import { isClaudeAvailable, computeInputHash } from "@/lib/anthropic";
import { revalidatePath } from "next/cache";

export async function analyzeReviews(
  venueId: string,
  sourceUrls: string[],
): Promise<{ jobId?: string; error?: string }> {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  if (!isClaudeAvailable()) {
    return { error: "AI機能を利用するにはAPIキーを設定してください" };
  }

  if (sourceUrls.length === 0 || sourceUrls.length > 5) {
    return { error: "1〜5件のURLを指定してください" };
  }

  // Check for existing analysis with same input
  const inputHash = computeInputHash(sourceUrls.sort().join(","));
  const existing = await prisma.aiAnalysis.findFirst({
    where: {
      venueId,
      type: "review_summary",
      inputHash,
      createdAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) }, // 7-day cache
    },
  });

  if (existing) {
    const output = JSON.parse(existing.output);
    if (output.status === "completed") {
      return { jobId: existing.id }; // Return cached result
    }
  }

  // Create job record
  const job = await prisma.aiAnalysis.create({
    data: {
      projectId,
      venueId,
      type: "review_summary",
      inputHash,
      output: JSON.stringify({ status: "processing", startedAt: new Date().toISOString() }),
    },
  });

  // Invoke Supabase Edge Function asynchronously
  // The Edge Function will:
  // 1. Fetch each URL's content
  // 2. Extract review text
  // 3. Send to Claude for analysis
  // 4. Save Review records and update AiAnalysis
  const supabase = createServiceClient();
  await supabase.functions.invoke("analyze-reviews", {
    body: {
      jobId: job.id,
      venueId,
      projectId,
      sourceUrls,
    },
  });

  return { jobId: job.id };
}

export async function checkReviewAnalysisStatus(jobId: string): Promise<{
  status: "processing" | "completed" | "failed";
  result?: unknown;
}> {
  const user = await requireUser();
  await requireProjectMembership(user.id);

  const job = await prisma.aiAnalysis.findUnique({
    where: { id: jobId },
  });

  if (!job) return { status: "failed" };

  const output = JSON.parse(job.output);
  return {
    status: output.status,
    result: output.status === "completed" ? output.result : undefined,
  };
}
```

#### 3. `generateVisitChecklist(visitId)`

R3 で使用するが、API パターンは R2 で確立する。

```typescript
// src/server/actions/visits.ts に追加

export async function generateVisitChecklist(
  visitId: string,
): Promise<{ checklist?: string[]; error?: string }> {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  if (!isClaudeAvailable()) {
    return { error: "AI機能を利用するにはAPIキーを設定してください" };
  }

  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    include: {
      venue: {
        include: {
          scores: true,
          reviews: { select: { aiSummary: true, sentiment: true } },
          estimates: { take: 1, orderBy: { version: "desc" } },
        },
      },
    },
  });

  if (!visit) return { error: "見学記録が見つかりません" };

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { conditions: true },
  });

  const response = await withRetry(() =>
    askClaude({
      system: VISIT_PREP_PROMPT.system,
      userMessage: VISIT_PREP_PROMPT.buildUserMessage(visit.venue, project?.conditions),
      maxTokens: 1024,
    })
  );

  const parsed = JSON.parse(response);
  const items: string[] = parsed.checklist.slice(0, 5); // Max 5 items

  // Save checklist items
  await prisma.visitChecklistItem.createMany({
    data: items.map((item, index) => ({
      visitId,
      item,
      sortOrder: index,
    })),
  });

  revalidatePath(`/venues/${visit.venueId}`);
  return { checklist: items };
}
```

---

## f) コスト管理（商用化考慮）

### 各機能のトークン消費見積もり

| 機能 | 入力トークン (avg) | 出力トークン (avg) | 1回あたりコスト (Sonnet) | 月間想定回数/ユーザー | 月間コスト/ユーザー |
|------|-------------------|-------------------|------------------------|---------------------|-------------------|
| コーチチャット | ~2,000 (system+history+context) | ~500 | ~$0.012 | 30回 | ~$0.36 |
| 見積もり PDF 解析 | ~3,000 (system+PDF text) | ~800 | ~$0.017 | 3回 | ~$0.05 |
| URL 式場追加 | ~4,000 (system+page content) | ~400 | ~$0.018 | 5回 | ~$0.09 |
| 口コミ AI 要約 | ~8,000 (system+reviews) | ~600 | ~$0.034 | 5回 | ~$0.17 |
| AI 比較分析 | ~2,500 (system+venues) | ~600 | ~$0.013 | 10回 | ~$0.13 |
| オンボーディング推薦 | ~1,000 (system+conditions) | ~500 | ~$0.008 | 1回 | ~$0.01 |

**月間合計見積もり: ~$0.81/ユーザー**

> 料金は Claude Sonnet 4 の 2025年5月時点の料金（入力: $3/MTok, 出力: $15/MTok）に基づく。

### input_hash による重複排除

全ての `AiAnalysis` レコード作成時に `inputHash` を必須化（アプリケーション層で強制）。

```typescript
// 重複チェックパターン
async function getCachedOrAnalyze(
  type: AiAnalysisType,
  inputHash: string,
  projectId: string,
  venueId: string | null,
  ttlMs: number,
  analyze: () => Promise<string>,
): Promise<string> {
  const cached = await prisma.aiAnalysis.findFirst({
    where: {
      type,
      inputHash,
      createdAt: { gte: new Date(Date.now() - ttlMs) },
    },
  });

  if (cached) return cached.output;

  const result = await analyze();

  await prisma.aiAnalysis.create({
    data: { projectId, venueId, type, inputHash, output: result },
  });

  return result;
}
```

### キャッシュ戦略

| 機能 | キャッシュ TTL | キャッシュキー | 無効化条件 |
|------|-------------|-------------|-----------|
| 見積もり解析 | 無期限 | PDF hash | 新バージョンアップロード時 |
| 口コミ要約 | 7日 | sourceUrls hash | ユーザーが再分析をリクエスト |
| 比較分析 | 24時間 | venueIds hash (sorted) | 式場データ変更時（評価・見積もり更新） |
| URL 抽出 | 無期限 | URL hash | 不要（1回限り） |
| コーチチャット | キャッシュしない | — | — |
| オンボーディング推薦 | 24時間 | conditions hash | 条件変更時 |

### ユーザーごとの API 呼び出し制限

```typescript
// src/lib/rate-limit.ts (NEW)

interface RateLimitConfig {
  maxCallsPerHour: number;
  maxCallsPerDay: number;
}

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  coach_chat: { maxCallsPerHour: 20, maxCallsPerDay: 100 },
  estimate_analysis: { maxCallsPerHour: 5, maxCallsPerDay: 20 },
  url_extraction: { maxCallsPerHour: 10, maxCallsPerDay: 30 },
  review_summary: { maxCallsPerHour: 3, maxCallsPerDay: 10 },
  comparison: { maxCallsPerHour: 10, maxCallsPerDay: 50 },
  onboarding: { maxCallsPerHour: 3, maxCallsPerDay: 5 },
};

export async function checkRateLimit(
  projectId: string,
  type: string,
): Promise<{ allowed: boolean; retryAfterMs?: number }> {
  const config = RATE_LIMITS[type];
  if (!config) return { allowed: true };

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [hourlyCount, dailyCount] = await Promise.all([
    prisma.aiAnalysis.count({
      where: { projectId, type: type as AiAnalysisType, createdAt: { gte: oneHourAgo } },
    }),
    prisma.aiAnalysis.count({
      where: { projectId, type: type as AiAnalysisType, createdAt: { gte: oneDayAgo } },
    }),
  ]);

  if (hourlyCount >= config.maxCallsPerHour) {
    return { allowed: false, retryAfterMs: 60 * 60 * 1000 };
  }
  if (dailyCount >= config.maxCallsPerDay) {
    return { allowed: false, retryAfterMs: 24 * 60 * 60 * 1000 };
  }

  return { allowed: true };
}
```

> **注**: `CoachMessage` テーブルを使うコーチチャットは、`AiAnalysis` とは別にカウントする。`checkRateLimit` 関数内でチャットの場合は `CoachMessage` テーブルを参照するよう分岐を追加する。

---

## g) テスト計画

### AI 機能のモックテスト戦略

#### 方針

Claude API 呼び出しは全てモック化し、テストの決定性と速度を確保する。

```typescript
// tests/mocks/anthropic.ts
import { vi } from "vitest";

export const mockAskClaude = vi.fn();
export const mockStreamClaude = vi.fn();
export const mockIsClaudeAvailable = vi.fn(() => true);

vi.mock("@/lib/anthropic", () => ({
  askClaude: mockAskClaude,
  streamClaude: mockStreamClaude,
  isClaudeAvailable: mockIsClaudeAvailable,
  computeInputHash: vi.fn((input: string) => `mock-hash-${input.slice(0, 8)}`),
  stripPII: vi.fn((text: string) => text), // Pass-through in tests
  withRetry: vi.fn((fn) => fn()),
}));
```

#### テスト区分

| 区分 | テスト内容 | モック対象 |
|------|----------|----------|
| ユニットテスト | プロンプト構築、PII ストリッピング、input hash 計算 | なし（純粋関数） |
| 統合テスト | Server Action の入出力、キャッシュヒット/ミス、レート制限 | Claude API、DB |
| プロンプトテスト | 固定入力 → 期待するJSON構造の検証 | なし（実APIで手動確認） |

#### 具体的なテストケース

```typescript
// tests/server/actions/coach.test.ts
describe("sendCoachMessage", () => {
  it("should call Claude API when available", async () => {
    mockIsClaudeAvailable.mockReturnValue(true);
    mockAskClaude.mockResolvedValue("AIの応答テキスト");

    const result = await sendCoachMessage("見積もりが高いのですが");

    expect(mockAskClaude).toHaveBeenCalled();
    expect(result.answer).toBe("AIの応答テキスト");
  });

  it("should fallback to FAQ when Claude is unavailable", async () => {
    mockIsClaudeAvailable.mockReturnValue(false);

    const result = await sendCoachMessage("見積もりが高いのですが");

    expect(mockAskClaude).not.toHaveBeenCalled();
    expect(result.answer).toContain("平均+84〜110万円");
  });

  it("should respect rate limits", async () => {
    // ... rate limit exceeded scenario
  });
});

// tests/server/actions/venues.test.ts
describe("addVenueFromUrl", () => {
  it("should extract venue data from URL and create venue", async () => {
    mockAskClaude.mockResolvedValue(JSON.stringify({
      name: "アニヴェルセル表参道",
      location: "表参道",
      capacityMin: 40,
      capacityMax: 120,
      ceremonyStyles: ["チャペル"],
      estimatedPrice: 3500000,
      features: ["ガーデン付き"],
      photoUrls: [],
      confidence: "high",
    }));

    const result = await addVenueFromUrl("https://example.com/venue");

    expect(result.venue).toBeDefined();
    expect(result.venue?.name).toBe("アニヴェルセル表参道");
  });

  it("should return error for invalid URL", async () => {
    const result = await addVenueFromUrl("not-a-url");
    expect(result.error).toBeDefined();
  });
});

// tests/lib/anthropic.test.ts
describe("stripPII", () => {
  it("should strip email addresses", () => {
    expect(stripPII("Contact: test@example.com")).toBe("Contact: [REDACTED]");
  });

  it("should strip Japanese phone numbers", () => {
    expect(stripPII("Tel: 03-1234-5678")).toBe("Tel: [REDACTED]");
  });

  it("should not strip venue names", () => {
    expect(stripPII("アニヴェルセル表参道")).toBe("アニヴェルセル表参道");
  });
});
```

### プロンプトの品質評価基準

| 基準 | 評価方法 | 合格ライン |
|------|---------|----------|
| JSON 構造の正確性 | 固定入力で10回実行し、全回 JSON パース成功 | 100% |
| 必須フィールドの存在 | 全必須フィールドが非 null | 100% |
| 日本語の自然さ | 手動レビュー（5件サンプル） | 不自然な表現が0件 |
| トーンの一貫性 | 「です・ます」調、押し売りしない | 手動レビューで逸脱0件 |
| レスポンス時間 | ストリーミング TTFB | < 2秒 |
| トークン効率 | 出力トークン数 | 各プロンプトの maxTokens の50%以内 |

プロンプトの品質評価は、初期リリース時に手動で10-20ケースを実行し、上記基準を確認する。自動化は R4 で検討。

---

## h) Release 1 への先行要件（バックポート）

Release 1 の実装時に、Release 2 を見据えて以下の点を考慮する必要がある。

### 1. `sendCoachMessage()` のインターフェース設計

R1 の `sendCoachMessage()` は同期的に `CoachResponse` を返す設計。R2 ではストリーミングに対応するため、クライアント側のコンポーネント設計が影響を受ける。

**R1 で対応すべきこと**:
- `ChatBar` コンポーネントは、R2 での `fetch("/api/coach/stream")` への切り替えを想定した構造にする
- メッセージの状態管理を `useState` で行い、R2 でストリーミングチャンクを追加する形に拡張可能にする
- R1 の FAQ 応答もチャットバブル形式で表示し、R2 と UI の差異を最小化する

```typescript
// R1 でこの構造にしておく
interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean; // R2 で使用。R1 では常に false
  createdAt: Date;
}
```

### 2. Coach 画面のチャット履歴表示

R1 では `AiAnalysis` に `coach_chat` type で保存する設計だが、R2 で `CoachMessage` テーブルに移行する。

**R1 で対応すべきこと**:
- チャット履歴のフェッチを Server Action (`getCoachHistory()`) 経由にし、R2 でのテーブル切り替えが Server Action 内部の変更で済むようにする
- R1 で保存した `AiAnalysis` レコードは R2 マイグレーション時に `CoachMessage` に移行するスクリプトを用意する

### 3. `getComparisonData()` のインサイト構造

R1 のテンプレート文インサイト (`ComparisonInsight`) に `tradeoffs` フィールドを含めておく。R2 で Claude が返す構造と一致させることで、UI コンポーネントの変更を最小化する。

```typescript
// R1 でこの構造にしておく
interface ComparisonInsight {
  text: string;
  recommendations: string[];
  tradeoffs?: Array<{           // R1 では optional。R2 で必須化
    dimension: string;
    analysis: string;
    leader: string | null;
  }>;
}
```

### 4. `AiAnalysis.inputHash` の設定

R1 でも `AiAnalysis` にレコードを作成する際は `inputHash` を設定する。R2 のキャッシュ戦略がそのまま使えるようにする。

### 5. Explore 画面の AddVenueSheet

~~R1 では「手動で追加」タブのみ有効。「URLから追加」タブは R1 で UI 枠を作っておき、disabled 状態にする。R2 で `addVenueFromUrl()` を接続するだけで有効化できるようにする。~~

> **変更（2026-04-13）**: `addVenueFromUrl()` は R1 に前倒し実装済み。R2 での追加作業は不要。R2 では `src/lib/anthropic.ts` への移行時に既存の `askClaude` 呼び出しをリファクタリングするのみ。

### 6. VenueDetail の ReviewSummary セクション

R1 では非表示（空ステート）。R2 で `analyzeReviews()` を接続して表示開始する。R1 で空ステートの UI 枠とレイアウトスペースを確保しておく。

### 7. 環境変数の整理

R1 の `.env.example` に以下を追記しておく（R2 で必要）:

```
# AI (Release 2)
ANTHROPIC_API_KEY=          # Claude API key for AI features
```

---

## 実装順序（推奨）

| Phase | 内容 | 依存関係 |
|-------|------|---------|
| R2-A | Prisma マイグレーション（Review, CoachMessage） | R1 完了 |
| R2-B | `src/lib/anthropic.ts` + `src/lib/prompts/` + テスト | R2-A |
| R2-C | コーチチャット（ストリーミング Route Handler + UI） | R2-B |
| R2-D | 見積もり PDF 解析の精緻化 | R2-B |
| R2-E | ~~URL 式場追加~~ R1で実装済み。`anthropic.ts` へのリファクタリングのみ | R2-B |
| R2-F | 口コミ AI 要約（Edge Function + ポーリング） | R2-B |
| R2-G | AI 比較分析 | R2-B |
| R2-H | オンボーディング AI 推薦 | R2-B |
| R2-I | レート制限 + コスト管理 | R2-C〜H |

R2-C〜H は並列実行可能（worktree 活用）。R2-B が共通基盤。
