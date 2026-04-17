# VenueLens v2 Release 1 — Technical Specification

> Phase 1 MVP + Phase 1.5 UX Fix を新4タブ構成に移植する技術設計書。
> 参照: [v2画面仕様](./2026-04-13-venuelens-v2-redesign.md) / [DESIGN.md](../../../DESIGN.md)
> 作成日: 2026-04-13

---

## a) Prisma スキーマ変更

### 新規モデル: VenueFavorite

```prisma
model VenueFavorite {
  id        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  venueId   String   @map("venue_id") @db.Uuid
  userId    String   @map("user_id") @db.Uuid
  createdAt DateTime @default(now()) @map("created_at")

  venue Venue @relation(fields: [venueId], references: [id], onDelete: Cascade)
  user  User  @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([venueId, userId])
  @@index([userId])
  @@map("venue_favorites")
}
```

### 新規モデル: PartnerReaction

```prisma
enum ReactionType {
  like
  maybe
  pass
}

model PartnerReaction {
  id           String       @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  venueId      String       @map("venue_id") @db.Uuid
  projectId    String       @map("project_id") @db.Uuid
  visitorToken String       @map("visitor_token")
  reaction     ReactionType
  createdAt    DateTime     @default(now()) @map("created_at")

  venue   Venue   @relation(fields: [venueId], references: [id], onDelete: Cascade)
  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@unique([venueId, visitorToken])
  @@index([projectId])
  @@map("partner_reactions")
}
```

### Enum 変更: AiAnalysisType に `coach_chat` 追加

```prisma
enum AiAnalysisType {
  review_summary
  estimate_prediction
  comparison
  visit_prep
  coach_chat        // NEW: Release 1 Coach FAQ応答の保存
}
```

### 既存モデル変更

#### Venue — `photoUrls` フィールド追加

```prisma
model Venue {
  // ... existing fields ...
  photoUrls      String[]    @default([]) @map("photo_urls")  // NEW
  // ... rest of fields ...
}
```

#### Venue — 複合インデックス追加

```prisma
model Venue {
  // ... existing fields & relations ...

  @@index([projectId])            // existing
  @@index([projectId, status])    // NEW: Explore画面のフィルタ高速化
  @@map("venues")
}
```

#### User — `VenueFavorite` リレーション追加

```prisma
model User {
  // ... existing fields ...
  favorites      VenueFavorite[]   // NEW
  // ... rest of relations ...
}
```

#### Venue — リレーション追加

```prisma
model Venue {
  // ... existing relations ...
  favorites        VenueFavorite[]    // NEW
  partnerReactions PartnerReaction[]  // NEW
}
```

#### Project — リレーション追加

```prisma
model Project {
  // ... existing relations ...
  partnerReactions PartnerReaction[]  // NEW
}
```

### VenueStatus — 変更なし

現行の6ステータス（`researching`, `visit_scheduled`, `visited`, `shortlisted`, `selected`, `rejected`）はそのまま維持。v2ではハートお気に入り（VenueFavorite）がショートリストの主要UIになるが、`VenueStatus.shortlisted` も互換性のため残す。

### Project.currentStep — 注記

`currentStep` フィールドは残す。v2では6ステップ進捗バーを廃止し、ProgressRing に置き換えるため **読み取らない**。将来のマイグレーションで削除を検討。v2の進捗はVenue/Visit/Estimate/Decisionの状態から動的に計算する。

### マイグレーション手順

```bash
# 1. スキーマ編集後にマイグレーション作成
npx prisma migrate dev --name add_venue_favorites_partner_reactions_coach_chat

# 2. Prisma Client 再生成（自動実行されるが念のため）
npx prisma generate

# 3. ビルド確認
npm run build
```

マイグレーション内容:
1. `venue_favorites` テーブル作成 + UNIQUE制約 + インデックス
2. `partner_reactions` テーブル作成 + UNIQUE制約 + インデックス
3. `ReactionType` Enum 作成
4. `AiAnalysisType` Enum に `coach_chat` 追加（`ALTER TYPE ... ADD VALUE`）
5. `venues` テーブルに `photo_urls TEXT[] DEFAULT '{}'` カラム追加
6. `venues` テーブルに `(project_id, status)` 複合インデックス追加

---

## b) ルート構造変更

### 廃止ルートと代替先

| 廃止ルート | 代替先 | 理由 |
|-----------|--------|------|
| `(app)/dashboard/page.tsx` | `/` (Home) | ダッシュボード → 新Home画面 |
| `(app)/conditions/page.tsx` | `/onboarding` | 条件設定 → AI対話オンボーディングに吸収 |
| `(app)/compare/page.tsx` | `/candidates` (比較サブビュー) | 比較 → Candidatesの比較ボードサブビュー |
| `(app)/shortlist/page.tsx` | `/candidates` (ショートリストサブビュー) | ショートリスト → Candidatesに統合 |
| `(app)/decision/page.tsx` | `/candidates` (決定サブビュー) | 最終決定 → Candidatesの決定サブビュー |

### next.config.ts リダイレクト設定

```typescript
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/dashboard",
        destination: "/",
        permanent: true,
      },
      {
        source: "/conditions",
        destination: "/onboarding",
        permanent: true,
      },
      {
        source: "/compare",
        destination: "/candidates",
        permanent: true,
      },
      {
        source: "/shortlist",
        destination: "/candidates",
        permanent: true,
      },
      {
        source: "/decision",
        destination: "/candidates",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
```

### 新規ルート完全リスト

| ファイルパス | 種別 | 使用Server Actions |
|------------|------|-------------------|
| `src/app/(app)/page.tsx` | Server Component | `getHomeData()`, `getOrCreateProject()` |
| `src/app/(app)/explore/page.tsx` | Server Component | `getVenues()` |
| `src/app/(app)/candidates/page.tsx` | Server Component | `getFavorites()`, `getComparisonData()`, `getDecision()` |
| `src/app/(app)/coach/page.tsx` | Server Component | `getAIInsights()` |
| `src/app/(app)/onboarding/page.tsx` | Server Component | `getOrCreateProject()` |
| `src/app/(app)/venues/[id]/page.tsx` | Server Component (既存リファクタ) | `getVenue()`, `getPartnerRatings()`, `getEstimatesForVenue()` |
| `src/app/(app)/accept-invite/page.tsx` | Server Component (既存リファクタ) | `submitPartnerReaction()` |

### layout.tsx リダイレクトロジック

**方式**: middleware + cookie によるオンボーディングリダイレクト。

layout.tsx では `x-next-url` 等の非標準ヘッダーによるパス判定は行わない。代わりに:

1. **onboarding完了時**: `saveOnboardingAnswers()` Server Action 内で `onboarding_completed=true` cookie を設定
2. **middleware**: cookie の有無でリダイレクト判定
3. **layout.tsx**: `project.conditions` の null チェックのみ（パス判定なし）

```typescript
// src/app/(app)/layout.tsx
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { getOrCreateProject } from "@/server/actions/projects";
import { BottomNav } from "@/components/layout/bottom-nav";
import { Toaster } from "@/components/ui/sonner";
import { RealtimeProvider } from "@/components/realtime-provider";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const project = await getOrCreateProject();

  // NOTE: onboarding リダイレクトは middleware.ts で cookie ベースで処理。
  // ここでは conditions null の場合のフォールバックのみ（middleware を通らないケース対策）。
  // パス判定は行わない — /onboarding ページ自体はこの layout の外に配置するか、
  // middleware で除外済みなのでここには到達しない。

  return (
    <div className="min-h-dvh bg-background pb-[calc(56px+env(safe-area-inset-bottom))]">
      <RealtimeProvider projectId={project.id}>
        <main className="mx-auto max-w-5xl px-4 py-4">{children}</main>
      </RealtimeProvider>
      <BottomNav />
      <Toaster position="bottom-center" />
    </div>
  );
}
```

**変更点**:
- `AppNav` (上部ナビ) → 削除。v2はBottomNav のみ
- `ProgressBar` (6ステップ) → 削除。v2はProgressRing（Home画面内）に置換
- `MobileBottomNav` → `BottomNav` に置換（新4タブ構成）
- `pb-[calc(4rem+...)]` → `pb-[calc(56px+env(safe-area-inset-bottom))]` (BottomNav高さに合わせる)
- `x-next-url` / `x-invoke-path` ヘッダーによるパス判定を削除（middleware + cookie方式に移行）

**middleware + cookie 方式の実装**:

```typescript
// src/middleware.ts (新規)
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  // Supabase auth session refresh (既存パターン)
  const response = NextResponse.next({ request });

  const { pathname } = request.nextUrl;

  // 除外パス: これらは onboarding チェックをスキップ
  const excludedPaths = ["/onboarding", "/accept-invite", "/login", "/signup", "/callback"];
  if (excludedPaths.some((p) => pathname.startsWith(p))) {
    return response;
  }

  // Onboarding redirect: cookie が未設定なら /onboarding へ
  const onboardingCompleted = request.cookies.get("onboarding_completed")?.value;
  if (!onboardingCompleted) {
    return NextResponse.redirect(new URL("/onboarding", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
```

**cookie 設定タイミング** (`saveOnboardingAnswers` 内):

```typescript
// src/server/actions/onboarding.ts — saveOnboardingAnswers() 末尾に追加
import { cookies } from "next/headers";

// ... (project.conditions 更新後)
const cookieStore = await cookies();
cookieStore.set("onboarding_completed", "true", {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  maxAge: 60 * 60 * 24 * 365, // 1 year
  path: "/",
});
```

**補足**:
- cookie は `httpOnly` + `secure` で設定。JWT やセッションではなくフラグなのでセキュリティリスクは低い
- 既存ユーザー（conditions設定済み）の初回アクセス: layout.tsx で conditions の存在を確認し、cookie 未設定なら `onboarding_completed` cookie を追加設定する
- `project.conditions` null チェック（DB ベース）は layout.tsx の Server Component に残す（cookie 改ざん対策のフォールバック）

### loading.tsx 配置計画

| ファイルパス | スケルトン構造 |
|------------|-------------|
| `src/app/(app)/loading.tsx` | BentoGrid枠(2/3+1/3) + 横スクロールカード枠x3（Home用） |
| `src/app/(app)/explore/loading.tsx` | FilterChips枠(横線x4) + VenueCard枠x3(4:3写真+3行テキスト) |
| `src/app/(app)/candidates/loading.tsx` | セグメントコントロール + カード枠x2 |
| `src/app/(app)/coach/loading.tsx` | InsightCard枠x3(3px左ボーダー+3行テキスト) |
| `src/app/(app)/onboarding/loading.tsx` | プログレスバー + チャットバブル枠x2 |
| `src/app/(app)/venues/[id]/loading.tsx` | 写真枠(4:3) + テキスト3行 + 星6行 |

全スケルトンは `bg-muted animate-pulse rounded-lg` スタイルで統一。

---

## c) Server Actions の変更

### 変更不要の既存関数

| ファイル | 関数 | 理由 |
|---------|------|------|
| `ratings.ts` | `saveRatings()` | ロジック変更なし。revalidatePathは `venues/[id]` のまま |
| `ratings.ts` | `saveDirectRatings()` | 変更なし |
| `ratings.ts` | `getPartnerRatings()` | 変更なし |
| `estimates.ts` | `createEstimate()` | ロジック変更なし（revalidatePath変更は下記参照） |
| `estimates.ts` | `getEstimatesForVenue()` | 変更なし |
| `estimates.ts` | `analyzeEstimatePdf()` | 変更なし |
| `estimates.ts` | `saveAnalyzedEstimate()` | ロジック変更なし（revalidatePath変更は下記参照） |
| `venue-schema.ts` | 全関数 | スキーマ定義のみ。変更なし |
| `rating-schema.ts` | 全関数 | スキーマ定義のみ。変更なし |
| `auth.ts` | `syncUser()` | 変更なし |
| `auth.ts` | `getProjectForUser()` | 変更なし |
| `invitations.ts` | `acceptInvitation()` | ロジック変更なし（revalidatePath変更は下記参照） |
| `invitations.ts` | `getInvitationStatus()` | 変更なし |
| `invitations.ts` | `getPendingInvitation()` | 変更なし |
| `projects.ts` | `getOrCreateProject()` | 変更なし |
| `projects.ts` | `updateProjectStep()` | v2では呼び出さないが、関数自体は残す |

### revalidatePath のみ変更する既存関数

#### `src/server/actions/venues.ts`

| 関数 | 行番号 | 変更前 | 変更後 |
|------|-------|--------|--------|
| `createVenue()` | L34 | `revalidatePath("/venues")` | `revalidatePath("/explore")` |
| `createVenue()` | L35 | `revalidatePath("/dashboard")` | `revalidatePath("/")` |
| `updateVenueStatus()` | L96 | `revalidatePath("/venues")` | `revalidatePath("/explore")` |

#### `src/server/actions/estimates.ts`

| 関数 | 行番号 | 変更前 | 変更後 |
|------|-------|--------|--------|
| `createEstimate()` | L68 | `revalidatePath("/compare")` | `revalidatePath("/candidates")` |
| `saveAnalyzedEstimate()` | L287 | `revalidatePath("/compare")` | `revalidatePath("/candidates")` |

#### `src/server/actions/decisions.ts`

| 関数 | 行番号 | 変更前 | 変更後 |
|------|-------|--------|--------|
| `makeDecision()` | L44 | `revalidatePath("/decision")` | `revalidatePath("/candidates")` |
| `makeDecision()` | L45 | `revalidatePath("/dashboard")` | `revalidatePath("/")` |
| `makeDecision()` | L46 | `revalidatePath("/venues")` | `revalidatePath("/explore")` |

#### `src/server/actions/invitations.ts`

| 関数 | 行番号 | 変更前 | 変更後 |
|------|-------|--------|--------|
| `invitePartner()` | L63 | `revalidatePath("/dashboard")` | `revalidatePath("/")` |
| `acceptInvitation()` | L96 | `revalidatePath("/dashboard")` | `revalidatePath("/")` |

#### `src/server/actions/projects.ts`

| 関数 | 行番号 | 変更前 | 変更後 |
|------|-------|--------|--------|
| `updateConditions()` | L72 | `revalidatePath("/dashboard")` | `revalidatePath("/")` |
| `updateConditions()` | L73 | `revalidatePath("/conditions")` | `revalidatePath("/onboarding")` |

#### `src/server/auth.ts`

| 関数 | 行番号 | 変更前 | 変更後 |
|------|-------|--------|--------|
| `requireProjectMembership()` | L19 | `redirect("/dashboard")` | `redirect("/")` |

### 新規関数（8つ）

全て `"use server"` ディレクティブ付き。認証パターンは既存の `requireUser()` + `requireProjectMembership()` に従う。

#### 1. `getHomeData()`

```typescript
// src/server/actions/home.ts
"use server";

import { prisma } from "@/server/db";
import { requireUser, requireProjectMembership } from "@/server/auth";

interface HomeData {
  project: {
    id: string;
    name: string;
    conditions: Record<string, unknown> | null;
  };
  recentVenues: Array<{
    id: string;
    name: string;
    location: string | null;
    photoUrls: string[];
    status: string;
    scores: Array<{ dimension: string; score: number; source: string }>;
  }>;
  progress: {
    totalVenues: number;
    visitedVenues: number;
    estimateCount: number;
    hasDecision: boolean;
    percentage: number; // 0-100
  };
  insights: Awaited<ReturnType<typeof import("./insights").getAIInsights>>;
  userName: string;
}

/**
 * Home画面の全データを1回のServer Action呼び出しで取得。
 * N+1を避けるため、Prismaのincludeで一括取得する。
 *
 * 進捗%の計算ロジック:
 * - 式場追加: 20% (1件以上で達成)
 * - 見学完了: 20% (1件以上)
 * - 見積もり入力: 20% (1件以上)
 * - 候補選定: 20% (お気に入り2件以上)
 * - 最終決定: 20% (Decision存在)
 */
export async function getHomeData(): Promise<HomeData> {
  // ... implementation
}
```

#### 2. `getAIInsights(projectId)`

```typescript
// src/server/actions/insights.ts
"use server";

import { prisma } from "@/server/db";
import { requireUser, requireProjectMembership } from "@/server/auth";

type InsightType = "estimate" | "partner" | "visit" | "comparison" | "reminder";

interface AIInsight {
  id: string;               // deterministic key for React (e.g. "estimate-{venueId}")
  type: InsightType;
  title: string;            // e.g. "見積もりに注目ポイントがあります"
  body: string;             // template text
  venueId?: string;
  venueName?: string;
  actions: Array<{ label: string; href: string }>;
  priority: number;         // 1 = highest
  createdAt: Date;
}

/**
 * ルールベースのAIインサイト生成。Claude APIは使用しない。
 * トリガー条件に基づきテンプレート文を生成して返す。
 *
 * トリガーロジック (priority順):
 * 1. 見学予定3日以内 → visit_prep (priority 1)
 * 2. 見積もり入力済み & upgradeリスクあり → estimate (priority 1)
 * 3. パートナー評価差分2点以上 → partner (priority 2)
 * 4. 候補2件以上 & 比較未実施 → comparison (priority 3)
 * 5. 見学3日経過 & 未評価 → reminder (priority 4)
 *
 * @returns 最大5件のインサイト（priority昇順）
 */
export async function getAIInsights(projectId: string): Promise<AIInsight[]> {
  const user = await requireUser();
  await requireProjectMembership(user.id);
  // ... implementation: see section e) for trigger details
}
```

#### 3. `sendCoachMessage(message)`

```typescript
// src/server/actions/coach.ts
"use server";

import { prisma } from "@/server/db";
import { revalidatePath } from "next/cache";
import { requireUser, requireProjectMembership } from "@/server/auth";

interface CoachResponse {
  answer: string;           // FAQ回答テンプレート文
  suggestedActions: Array<{ label: string; href: string }>;
  matched: boolean;         // FAQパターンにマッチしたか
}

/**
 * Release 1: 定型FAQ応答。Claude APIは使用しない。
 * Release 2: Claude APIに切り替え（ANTHROPIC_API_KEY使用）。
 *
 * NOTE: 画像の blurDataURL は Release 1 では未使用。placeholder="empty" で対応。
 * Release 2以降で URL自動抽出時に blurDataURL を自動生成する。
 *
 * メッセージとFAQ回答をAiAnalysisテーブルにtype='coach_chat'で保存。
 * キーワードマッチングでFAQパターンを検索し、テンプレート文を返す。
 * マッチしない場合はフォールバックメッセージを返す。
 *
 * @param message ユーザーの入力メッセージ
 */
export async function sendCoachMessage(message: string): Promise<CoachResponse> {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  // FAQ matching (see section e) for pattern list)
  // Save to AiAnalysis with type: 'coach_chat'
  // revalidatePath("/coach");
  // ... implementation
}
```

#### 4. `saveOnboardingAnswers(answers)`

```typescript
// src/server/actions/onboarding.ts
"use server";

import { z } from "zod";
import { prisma } from "@/server/db";
import { revalidatePath } from "next/cache";
import { requireUser, requireProjectMembership } from "@/server/auth";

const onboardingSchema = z.object({
  style: z.array(z.string()).optional(),       // e.g. ["チャペル", "ガーデン"]
  guestCount: z.number().int().positive().optional(),
  area: z.array(z.string()).optional(),         // e.g. ["表参道", "銀座"]
  budget: z.object({
    min: z.number().int().nonnegative(),
    max: z.number().int().positive(),
  }).optional(),
});

type OnboardingAnswers = z.infer<typeof onboardingSchema>;

/**
 * オンボーディング回答をproject.conditionsにJSON保存。
 * 既存のupdateConditions()と互換性あり（同じconditionsフィールドに書く）。
 * ただしcurrentStepは更新しない（v2では未使用）。
 *
 * 保存後: / (Home) へリダイレクト。
 */
export async function saveOnboardingAnswers(answers: OnboardingAnswers): Promise<{ success: boolean }> {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  const parsed = onboardingSchema.safeParse(answers);
  if (!parsed.success) {
    return { success: false };
  }

  await prisma.project.update({
    where: { id: projectId },
    data: { conditions: parsed.data },
  });

  revalidatePath("/");
  revalidatePath("/explore");
  return { success: true };
}
```

#### 5. `toggleFavorite(venueId)`

```typescript
// src/server/actions/favorites.ts
"use server";

import { prisma } from "@/server/db";
import { revalidatePath } from "next/cache";
import { requireUser, requireProjectMembership } from "@/server/auth";

/**
 * VenueFavoriteの追加/削除をトグル。
 * 既存レコードがあれば削除、なければ作成。
 *
 * @returns { isFavorite: boolean } — トグル後の状態
 */
export async function toggleFavorite(venueId: string): Promise<{ isFavorite: boolean }> {
  const user = await requireUser();
  await requireProjectMembership(user.id);

  const existing = await prisma.venueFavorite.findUnique({
    where: { venueId_userId: { venueId, userId: user.id } },
  });

  if (existing) {
    await prisma.venueFavorite.delete({
      where: { id: existing.id },
    });
    revalidatePath("/explore");
    revalidatePath("/candidates");
    revalidatePath("/");
    return { isFavorite: false };
  }

  await prisma.venueFavorite.create({
    data: { venueId, userId: user.id },
  });

  revalidatePath("/explore");
  revalidatePath("/candidates");
  revalidatePath("/");
  return { isFavorite: true };
}
```

#### 6. `getFavorites(filter)`

```typescript
// src/server/actions/favorites.ts (同ファイル)

type FavoriteFilter = "mine" | "partner" | "both";

interface FavoriteVenue {
  venue: {
    id: string;
    name: string;
    location: string | null;
    photoUrls: string[];
    status: string;
    scores: Array<{ dimension: string; score: number; source: string }>;
    estimates: Array<{ total: number; version: number }>;
  };
  favoritedBy: Array<{ userId: string; userName: string }>;
}

/**
 * お気に入り式場を取得。フィルタで「自分のみ」「パートナーのみ」「二人とも」を切替。
 *
 * - "mine": 自分がお気に入りした式場
 * - "partner": パートナーがお気に入りした式場
 * - "both": 二人ともお気に入りした式場（INTERSECT）
 *
 * パートナーが未参加の場合、"partner" と "both" は空配列を返す。
 */
export async function getFavorites(filter: FavoriteFilter = "mine"): Promise<FavoriteVenue[]> {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  // Get project members
  // Build query based on filter
  // Include venue with scores and latest estimate
  // ... implementation
}
```

#### 7. `getComparisonData(venueIds)`

```typescript
// src/server/actions/comparison.ts
"use server";

import { prisma } from "@/server/db";
import { requireUser, requireProjectMembership } from "@/server/auth";

interface ComparisonVenue {
  id: string;
  name: string;
  location: string | null;
  accessInfo: string | null;
  capacityMin: number | null;
  capacityMax: number | null;
  ceremonyStyles: string[];
  photoUrls: string[];
  status: string;
  scores: Array<{
    dimension: string;
    score: number;
    source: string;
  }>;
  latestEstimate: {
    total: number;
    predictedFinal: number | null;
    items: Array<{
      category: string;
      itemName: string;
      amount: number;
      tier: string;
    }>;
  } | null;
  totalScore: number;           // 全次元の平均 x 20 (0-100 scale)
  topStrengths: string[];       // score上位3次元の日本語ラベル
}

interface ComparisonInsight {
  text: string;                 // テンプレート生成の比較分析文
  recommendations: string[];   // 提案リスト
}

interface ComparisonData {
  venues: ComparisonVenue[];
  insight: ComparisonInsight;
}

/**
 * 比較ボード用データを取得。2-3件のvenueIdを受け取る。
 * スコアの正規化、総合点計算、Top3強み抽出、テンプレート文の比較分析を含む。
 *
 * @param venueIds 比較対象の式場ID（2-3件）
 */
export async function getComparisonData(venueIds: string[]): Promise<ComparisonData> {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  if (venueIds.length < 2 || venueIds.length > 3) {
    throw new Error("比較は2-3件の式場を選択してください");
  }

  // Fetch venues with all related data
  // Calculate totalScore and topStrengths
  // Generate template-based insight (see section e)
  // ... implementation
}
```

#### 8. `submitPartnerReaction(venueId, reaction, visitorToken)`

```typescript
// src/server/actions/partner-reactions.ts
"use server";

import { z } from "zod";
import { prisma } from "@/server/db";
import { revalidatePath } from "next/cache";

const reactionSchema = z.object({
  venueId: z.string().uuid(),
  reaction: z.enum(["like", "maybe", "pass"]),
  visitorToken: z.string().min(1),
});

/**
 * ゲスト（未サインアップのパートナー）のリアクションを保存。
 * 認証不要（visitorTokenで識別）。
 *
 * visitorTokenはクライアント側でcrypto.randomUUID()生成し、
 * localStorageに保持。同じvisitorTokenで同じvenueに再投票するとupsert。
 *
 * @param venueId 対象式場ID
 * @param reaction "like" | "maybe" | "pass"
 * @param visitorToken ゲスト識別トークン
 */
export async function submitPartnerReaction(
  venueId: string,
  reaction: "like" | "maybe" | "pass",
  visitorToken: string,
): Promise<{ success: boolean }> {
  const parsed = reactionSchema.safeParse({ venueId, reaction, visitorToken });
  if (!parsed.success) {
    return { success: false };
  }

  // Get projectId from venue
  const venue = await prisma.venue.findUnique({
    where: { id: parsed.data.venueId },
    select: { projectId: true },
  });
  if (!venue) return { success: false };

  await prisma.partnerReaction.upsert({
    where: {
      venueId_visitorToken: {
        venueId: parsed.data.venueId,
        visitorToken: parsed.data.visitorToken,
      },
    },
    update: { reaction: parsed.data.reaction },
    create: {
      venueId: parsed.data.venueId,
      projectId: venue.projectId,
      visitorToken: parsed.data.visitorToken,
      reaction: parsed.data.reaction,
    },
  });

  revalidatePath("/");
  revalidatePath("/candidates");
  return { success: true };
}
```

#### 9. `addVenueFromUrl(url)` — R1唯一のClaude API使用機能

> **例外理由**: 式場追加は初回体験の入口。`analyzeEstimatePdf` で確立済みの Claude API 呼び出しパターンを踏襲。

```typescript
// src/server/actions/venues.ts に追加
"use server";

import { prisma } from "@/server/db";
import { revalidatePath } from "next/cache";
import { requireUser, requireProjectMembership } from "@/server/auth";
import { askClaude, isClaudeAvailable } from "@/lib/claude";

/**
 * URL貼り付けによる式場自動登録。
 * サーバーサイド fetch → HTMLテキスト抽出 → Claude APIで構造化データ抽出。
 * 対応サイト: ゼクシィ、ハナユメ、Wedding Park、マイナビウエディング等。
 *
 * 抽出対象: 式場名、住所、アクセス、収容人数、価格帯、スタイル、写真URL
 * エラーハンドリング: fetch失敗・Claude API未設定時は手動入力にフォールバック
 *
 * @param url 式場ページのURL
 */
export async function addVenueFromUrl(url: string): Promise<{
  venue?: Venue;
  extracted?: ExtractedVenueData;
  error?: string;
}> {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  if (!isClaudeAvailable()) {
    return { error: "AI機能を利用するにはAPIキーを設定してください。手動で入力してください。" };
  }

  // Validate URL
  try {
    new URL(url);
  } catch {
    return { error: "有効なURLを入力してください" };
  }

  try {
    // 1. Server-side fetch
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; VenueLens/1.0)",
        "Accept": "text/html",
      },
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      return { error: "ページを取得できませんでした。URLを確認するか、手動で入力してください。" };
    }

    const html = await response.text();

    // 2. HTML → テキスト抽出（script/style除去）
    const textContent = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    // 3. Claude API で構造化データ抽出
    const claudeResponse = await askClaude(
      URL_EXTRACTION_SYSTEM_PROMPT,
      `以下はURL ${url} から取得したウェブページの内容です。結婚式場の情報を構造化データとして抽出してください:\n\n${textContent.slice(0, 30000)}`
    );

    if (!claudeResponse) {
      return { error: "AI解析に失敗しました。手動で入力してください。" };
    }

    const extracted = JSON.parse(claudeResponse) as ExtractedVenueData;

    // 4. プレビュー用に抽出データを返す（確認後に登録）
    return { extracted };

  } catch (error) {
    return { error: "式場情報の取得に失敗しました。手動で入力してください。" };
  }
}

// Extracted data type (confirmation before saving)
interface ExtractedVenueData {
  name: string;
  location: string | null;
  accessInfo: string | null;
  capacityMin: number | null;
  capacityMax: number | null;
  ceremonyStyles: string[];
  estimatedPrice: number | null;
  features: string[];
  photoUrls: string[];
  confidence: "high" | "medium" | "low";
}

// Prompt template (analyzeEstimatePdf と同じ askClaude パターン)
const URL_EXTRACTION_SYSTEM_PROMPT = `You are an expert at extracting structured wedding venue information from Japanese web page content.

Given raw HTML text content from a wedding venue page (Zexy, Wedding Park, Hanayume, Mynavi, etc.), extract the following information.

Return ONLY valid JSON (no markdown, no code fences):
{
  "name": "<venue name in Japanese>",
  "location": "<area/address>",
  "accessInfo": "<nearest station and walking time>",
  "capacityMin": <number or null>,
  "capacityMax": <number or null>,
  "ceremonyStyles": ["チャペル" | "神前" | "人前" | "ガーデン"],
  "estimatedPrice": <estimated total in yen or null>,
  "features": ["<feature1>", "<feature2>"],
  "photoUrls": ["<url1>", "<url2>"],
  "confidence": "high" | "medium" | "low"
}

Guidelines:
- If a field cannot be determined, use null (not empty string)
- For price, look for "見積もり例", "お見積り", "挙式+披露宴" patterns
- For capacity, look for "着席" followed by number
- For ceremony styles, map to the enum values above
- photoUrls: prefer large venue/ceremony photos, skip thumbnails and icons
- confidence: "high" if major fields found, "medium" if some missing, "low" if minimal data`;
```

> **フォールバック戦略**: `isClaudeAvailable()` が false の場合、またはfetch/Claude呼び出しが失敗した場合は、エラーメッセージで手動入力を案内する。AddVenueSheet のUIは「手動で追加」タブに自動切替する。

---

## d) コンポーネント変更マップ

### 再利用（変更不要）

| ファイルパス | 理由 |
|------------|------|
| `src/components/ui/button.tsx` | shadcn/ui基盤。変更不要 |
| `src/components/ui/input.tsx` | shadcn/ui基盤。変更不要 |
| `src/components/ui/card.tsx` | shadcn/ui基盤。変更不要 |
| `src/components/ui/label.tsx` | shadcn/ui基盤。変更不要 |
| `src/components/ui/sonner.tsx` | トースト。変更不要 |
| `src/components/realtime-provider.tsx` | Supabase Realtime。変更不要 |
| `src/components/venues/estimate-form.tsx` | 見積もりフォーム。ロジック変更なし |
| `src/components/venues/estimate-pdf-upload.tsx` | PDFアップロード。変更不要 |
| `src/components/venues/estimate-breakdown.tsx` | 見積もり内訳。変更不要 |
| `src/components/venues/estimate-waterfall-chart.tsx` | ウォーターフォールチャート。変更不要 |
| `src/components/ratings/star-rating.tsx` | 星評価表示。変更不要 |
| `src/components/decision/celebration.tsx` | コンフェッティ。基本ロジック変更なし |

### 再利用（リファクタ必要）

| ファイルパス | 変更内容 |
|------------|---------|
| `src/components/venues/venue-card.tsx` | 写真カルーセル追加（Embla）、ハートお気に入りトグル、photoUrls対応、パートナーリアクション表示 |
| `src/components/venues/venue-status-badge.tsx` | バッジデザインをpillスタイルに変更（v2仕様: 左上配置、白背景、黒文字、11px） |
| `src/components/venues/venue-status-select.tsx` | BottomSheet UIに変更（モバイルUX改善） |
| `src/components/venues/venue-form.tsx` | AddVenueSheet内で使用。BottomSheet対応 |
| `src/components/venues/shortlist-button.tsx` | ハートアイコンのお気に入りトグルに変更。toggleFavorite Server Action呼び出し |
| `src/components/ratings/dimension-ratings.tsx` | パートナー比較ビュー追加。二人の評価を並列表示 |
| `src/components/compare/score-progress-bars.tsx` | DimensionBar コンポーネントに統合。v2のデザイン仕様に合わせる |
| `src/components/compare/venue-selector.tsx` | ドロップダウンUIに変更。v2比較ボード仕様に合わせる |
| `src/components/compare/comparison-matrix.tsx` | QuickLookSection + DetailAccordions構成に分割リファクタ |
| `src/components/decision/decision-form.tsx` | DecisionCeremony 3フェーズ構成に統合 |
| `src/components/partner/invite-partner-card.tsx` | PartnerInvite コンポーネントに統合。シェアバー追加 |
| `src/components/layout/mobile-bottom-nav.tsx` | BottomNav（4タブ）に完全書き換え |
| `src/app/(app)/accept-invite/accept-invite-form.tsx` | ゲストリアクションUI追加（3ボタン: like/maybe/pass） |

### 廃止リスト

| ファイルパス | 理由 |
|------------|------|
| `src/components/layout/app-nav.tsx` | 上部ナビ廃止。v2はBottomNavのみ |
| `src/components/layout/progress-bar.tsx` | 6ステップ進捗バー廃止。ProgressRingに置換 |
| `src/components/conditions/conditions-form.tsx` | 条件設定フォーム廃止。AI対話オンボーディングに吸収 |
| `src/components/compare/radar-chart.tsx` | レーダーチャート廃止。プログレスバーに置換（DESIGN.md Anti-Patterns） |
| `src/components/compare/score-badge.tsx` | スコアバッジ廃止。CircularProgressScoreに置換 |
| `src/components/compare/estimate-bar-chart.tsx` | EstimateXRayのウォーターフォールチャートに統合 |
| `src/components/venues/venue-list-controls.tsx` | FilterChipsに置換 |
| `src/components/venues/venue-ratings-section.tsx` | VenueDetail内のRatingSection新コンポーネントに統合 |
| `src/components/shortlist/shortlist-card.tsx` | VenueCard + お気に入りで代替 |
| `src/components/ui/gold-border.tsx` | AIInsightCardのborder-l-[3px]で代替 |
| `src/app/(app)/conditions/page.tsx` | ルート廃止 |
| `src/app/(app)/dashboard/page.tsx` | ルート廃止 |
| `src/app/(app)/compare/page.tsx` | ルート廃止 |
| `src/app/(app)/shortlist/page.tsx` | ルート廃止 |
| `src/app/(app)/decision/page.tsx` | ルート廃止 |

### 新規コンポーネントリスト（約20）

| # | ファイルパス | 依存コンポーネント | 使用Server Action | Phase |
|---|------------|------------------|-------------------|-------|
| 1 | `src/components/layout/bottom-nav.tsx` | lucide-react | なし | A |
| 2 | `src/components/ui/progress-ring.tsx` | なし | なし | A |
| 3 | `src/components/ai/insight-card.tsx` | lucide-react | なし | A |
| 4 | `src/components/ui/pill-options.tsx` | なし | なし | A |
| 5 | `src/components/venues/photo-carousel.tsx` | embla-carousel-react | なし | A |
| 6 | `src/components/home/greeting.tsx` | なし | なし | B (wt-1) |
| 7 | `src/components/home/quick-actions.tsx` | lucide-react | なし | B (wt-1) |
| 8 | `src/components/home/recent-venues.tsx` | VenueCardSmall | なし | B (wt-1) |
| 9 | `src/components/home/venue-card-small.tsx` | PhotoCarousel | なし | B (wt-1) |
| 10 | `src/components/explore/filter-chips.tsx` | なし | なし | B (wt-2) |
| 11 | `src/components/explore/add-venue-sheet.tsx` | venue-form | createVenue, addVenueFromUrl | B (wt-2) |
| 12 | `src/components/coach/insight-card-feed.tsx` | AIInsightCard | getAIInsights | B (wt-3) |
| 13 | `src/components/coach/chat-bar.tsx` | なし | sendCoachMessage | B (wt-3) |
| 14 | `src/components/coach/chat-bubble.tsx` | なし | なし | B (wt-3) |
| 15 | `src/components/candidates/segmented-control.tsx` | なし | なし | B (wt-4) |
| 16 | `src/components/candidates/shortlist-view.tsx` | VenueCard | getFavorites | B (wt-4) |
| 17 | `src/components/comparison/circular-score.tsx` | なし | なし | C (wt-5) |
| 18 | `src/components/comparison/dimension-bar.tsx` | なし | なし | C (wt-5) |
| 19 | `src/components/comparison/quick-look.tsx` | CircularScore, PhotoCarousel | getComparisonData | C (wt-5) |
| 20 | `src/components/comparison/diff-toggle.tsx` | なし | なし | C (wt-5) |
| 21 | `src/components/estimates/estimate-xray.tsx` | Recharts BarChart | なし | C (wt-6) |
| 22 | `src/components/ratings/partner-comparison-summary.tsx` | DimensionBar | getPartnerRatings | C (wt-6) |
| 23 | `src/components/onboarding/chat-history.tsx` | ChatBubble | なし | C (wt-7) |
| 24 | `src/components/onboarding/question-step.tsx` | PillOptions | なし | C (wt-7) |
| 25 | `src/components/decision/decision-ceremony.tsx` | Celebration | makeDecision | C (wt-8) |
| 26 | `src/components/partner/partner-invite.tsx` | なし | invitePartner | C (wt-8) |
| 27 | `src/components/partner/reaction-buttons.tsx` | なし | submitPartnerReaction | C (wt-8) |

---

## e) Release 1 AI境界

Release 1 では **URL式場追加（`addVenueFromUrl`）を唯一の例外として Claude API を使用する**。それ以外は全てルールベース + テンプレート文で実装する。

> **例外の理由**: 式場追加は初回体験の入口であり、ここが面倒だとプロダクト全体の印象が悪い。Claude API の呼び出しパターンは既存の `analyzeEstimatePdf` で確立済みのため、この1機能だけ Release 1 から Claude API を使用する。

### 定型FAQ応答パターン（Coach ChatBar用）

`sendCoachMessage()` で使用。キーワードマッチングで回答を選択。

| # | キーワード | 質問パターン | 回答テンプレート |
|---|-----------|-------------|----------------|
| 1 | `見積もり`, `費用`, `値段`, `予算` | 「見積もりが高いのですが...」 | 「結婚式の見積もりは、初期提示額から平均+84〜110万円上がると言われています。特に料理・衣装・写真は変動が大きい項目です。見積もりX線で詳細を確認してみましょう。」 |
| 2 | `比較`, `どっち`, `どちら`, `迷` | 「どの式場がいいか迷っています」 | 「比較ボードで2-3件の式場を並べて見てみましょう。スコアや見積もりを一覧で比較できます。お二人の評価の一致度も確認できますよ。」 |
| 3 | `見学`, `フェア`, `ブライダルフェア` | 「見学で何を確認すればいい？」 | 「見学時のチェックポイント: (1) 料理の試食（ランク確認）、(2) プランナーとの相性、(3) 持ち込み可否と料金、(4) 見積もりの詳細内訳、(5) 契約後の変更条件。見学記録をアプリに残しておくと比較に役立ちます。」 |
| 4 | `パートナー`, `彼`, `彼女`, `相手`, `二人` | 「パートナーと意見が合わない」 | 「評価が分かれるのは自然なことです。まずはお二人それぞれの評価を入れて、どの項目で意見が分かれているか可視化してみましょう。意外と"絶対に譲れない点"は一致していることが多いですよ。」 |
| 5 | `持ち込み`, `持込`, `外注` | 「持ち込みは可能ですか？」 | 「持ち込みポリシーは式場によって異なります。一般的に衣装・引出物は持ち込み可能な場合が多いですが、持ち込み料(5,000〜50,000円/点)がかかることがあります。見学時に必ず確認しましょう。」 |
| 6 | `キャンセル`, `解約`, `やめ` | 「キャンセル料はどのくらい？」 | 「一般的なキャンセル料の目安: 150日以上前=申込金のみ、149〜90日前=見積もりの20%、89〜30日前=30-50%、29日以内=50-80%。契約前に必ずキャンセルポリシーを確認しましょう。」 |
| 7 | `料理`, `コース`, `試食` | 「料理のランクはどうすれば？」 | 「初期見積もりの料理は最低ランクであることが多いです。65%のカップルが料理をアップグレードし、平均+15〜30万円増加します。試食で最低ランクと希望ランクの両方を試すのがおすすめです。」 |
| 8 | `いつ`, `時期`, `シーズン`, `季節` | 「いつ頃がおすすめですか？」 | 「人気シーズン: 春(3-5月)と秋(9-11月)。費用を抑えたい場合は真夏(7-8月)や真冬(1-2月)がお得です。土日祝は平日より30-50万円高くなる傾向があります。」|
| — | (マッチしない場合) | — | 「ご質問ありがとうございます。現在はよくある質問にお答えしています。式場の比較や見積もりについてお聞きください。より詳しい相談機能は近日公開予定です。」 |

### ルールベースインサイト（トリガー条件とテンプレート文）

`getAIInsights()` で使用。

#### 1. 見積もりインサイト (`type: "estimate"`)

**トリガー**: 式場に見積もりが1件以上あり、`EstimateItem` のうち `tier = "minimum"` の項目が2つ以上ある場合。

```
テンプレート:
「{venueName}の見積もりに注目ポイントがあります。{minTierCount}つの項目が最低ランクで計上されています。
一般的に+{estimatedIncrease}万円程度の変動が見込まれます。」

アクション: [{ label: "詳しく見る", href: "/venues/{venueId}" }]
```

#### 2. パートナー橋渡し (`type: "partner"`)

**トリガー**: 同じ式場に二人の VisitRating があり、いずれかの dimension で score 差が2点以上。

```
テンプレート:
「{venueName}の評価で、{dimensionLabel}の評価がお二人で分かれています（{ownerScore}点 vs {partnerScore}点）。
お互いの視点を共有してみませんか？」

アクション: [{ label: "比較を見る", href: "/venues/{venueId}" }]
```

#### 3. 見学準備 (`type: "visit"`)

**トリガー**: Visit の `scheduledAt` が現在から3日以内で、`status = "scheduled"`。

```
テンプレート:
「{venueName}の見学が{daysUntil}日後に予定されています。
確認しておきたい5つのポイントをチェックリストにまとめました。」

アクション: [{ label: "チェックリストを見る", href: "/venues/{venueId}" }]
```

#### 4. 比較提案 (`type: "comparison"`)

**トリガー**: VenueFavorite に2件以上の式場があり、直近7日以内に `AiAnalysis(type: "comparison")` が存在しない。

```
テンプレート:
「候補が{favoriteCount}件揃いました。比較ボードで並べて見てみませんか？
スコアや費用を一覧で比較できます。」

アクション: [{ label: "比較する", href: "/candidates" }]
```

#### 5. リマインダー (`type: "reminder"`)

**トリガー**: Visit の `status = "completed"` かつ `completedAt` から3日以上経過し、該当 Visit に VisitRating が0件。

```
テンプレート:
「{venueName}の見学から{daysSince}日経ちました。
印象が新鮮なうちに評価を記録しませんか？」

アクション: [{ label: "評価する", href: "/venues/{venueId}" }]
```

### 見積もりX線 — Upgrade Rate テーブル

`EstimateXRay` コンポーネントで使用するデフォルト確率と金額レンジ。`src/lib/constants.ts` に追加。

```typescript
// src/lib/constants.ts に追加

export const UPGRADE_RATES: Record<
  string,
  { rate: number; minIncrease: number; maxIncrease: number; label: string }
> = {
  cuisine: {
    rate: 0.65,
    minIncrease: 150_000,
    maxIncrease: 300_000,
    label: "料理（コースアップグレード）",
  },
  attire: {
    rate: 0.62,
    minIncrease: 200_000,
    maxIncrease: 400_000,
    label: "衣装（ドレス・タキシード）",
  },
  photo_video: {
    rate: 0.50,
    minIncrease: 200_000,
    maxIncrease: 350_000,
    label: "写真・映像・エンドロール",
  },
  flowers: {
    rate: 0.45,
    minIncrease: 100_000,
    maxIncrease: 250_000,
    label: "装花・テーブルコーディネート",
  },
  performance: {
    rate: 0.40,
    minIncrease: 50_000,
    maxIncrease: 150_000,
    label: "演出・エフェクト",
  },
  av_equipment: {
    rate: 0.30,
    minIncrease: 30_000,
    maxIncrease: 80_000,
    label: "音響・AV機器",
  },
  venue_fee: {
    rate: 0.10,
    minIncrease: 0,
    maxIncrease: 50_000,
    label: "会場使用料",
  },
  other: {
    rate: 0.20,
    minIncrease: 0,
    maxIncrease: 100_000,
    label: "その他",
  },
};
```

**表示ロジック**: 各 `EstimateItem` について:
1. `tier === "minimum"` かつ `UPGRADE_RATES[category].rate >= 0.40` → 「上がりやすい項目」として表示
2. 予測最終額 = `Σ(item.amount + UPGRADE_RATES[category].rate * average(min, max))` for tier=minimum items
3. 確率バーの色: rate >= 0.50 → amber, rate < 0.50 → muted

### 比較分析テンプレート文生成ロジック

`getComparisonData()` 内で使用。

```typescript
function generateComparisonInsight(venues: ComparisonVenue[]): ComparisonInsight {
  const [a, b] = venues;

  // Find top strength for each venue
  const aTop = a.topStrengths[0]; // e.g. "料理"
  const bTop = b.topStrengths[0]; // e.g. "アクセス"

  // Find biggest score difference
  const dimensions = ["atmosphere", "hospitality", "cuisine", "cost", "access", "reviews"];
  let maxDiffDim = "";
  let maxDiff = 0;
  for (const dim of dimensions) {
    const aScore = a.scores.find((s) => s.dimension === dim)?.score ?? 0;
    const bScore = b.scores.find((s) => s.dimension === dim)?.score ?? 0;
    const diff = Math.abs(aScore - bScore);
    if (diff > maxDiff) {
      maxDiff = diff;
      maxDiffDim = dim;
    }
  }

  // Cost comparison
  const aCost = a.latestEstimate?.total ?? 0;
  const bCost = b.latestEstimate?.total ?? 0;
  const costDiff = Math.abs(aCost - bCost);
  const cheaper = aCost < bCost ? a.name : b.name;

  const text = [
    `${a.name}は${aTop}が高評価。${b.name}は${bTop}が強みです。`,
    maxDiff >= 1.0
      ? `${DIMENSION_LABELS[maxDiffDim]}で最も差が出ています（${maxDiff.toFixed(1)}点差）。`
      : `全体的にスコアは拮抗しています。`,
    costDiff > 0
      ? `費用面では${cheaper}が¥${Math.round(costDiff / 10000)}万円お得です。`
      : "",
  ]
    .filter(Boolean)
    .join("");

  const recommendations: string[] = [];
  if (aCost > 0 && bCost > 0) {
    recommendations.push(
      aCost < bCost
        ? `予算重視なら${a.name}がおすすめ`
        : `予算重視なら${b.name}がおすすめ`,
    );
  }
  if (a.totalScore > b.totalScore) {
    recommendations.push(`総合評価では${a.name}がリード`);
  } else if (b.totalScore > a.totalScore) {
    recommendations.push(`総合評価では${b.name}がリード`);
  }

  return { text, recommendations };
}
```

---

## f) 並列実装計画（Worktree戦略）

### Phase A: Foundation（順次実行、6タスク）

全Phase B-Cの前提となる基盤作業。1つのworktreeで順次実行。

| # | タスク | ファイル作成/変更 |
|---|--------|----------------|
| A1 | Prismaスキーマ変更 + マイグレーション | `prisma/schema.prisma`, `prisma/migrations/xxx/` |
| A2 | BottomNav + Layout再構築 | `src/components/layout/bottom-nav.tsx` (新規), `src/app/(app)/layout.tsx` (変更), `src/components/layout/app-nav.tsx` (削除), `src/components/layout/progress-bar.tsx` (削除) |
| A3 | next.config.ts リダイレクト設定 | `next.config.ts` (変更) |
| A4 | 共通UIコンポーネント | `src/components/ui/progress-ring.tsx` (新規), `src/components/ai/insight-card.tsx` (新規), `src/components/ui/pill-options.tsx` (新規) |
| A5 | VenueCard + PhotoCarousel リファクタ | `src/components/venues/venue-card.tsx` (変更), `src/components/venues/photo-carousel.tsx` (新規), `package.json` (embla-carousel-react追加) |
| A6 | constants.ts更新 + 新Server Actions基盤 | `src/lib/constants.ts` (UPGRADE_RATES追加), `src/server/actions/favorites.ts` (新規), `src/server/actions/home.ts` (新規), `src/server/actions/insights.ts` (新規), `src/server/actions/coach.ts` (新規), `src/server/actions/onboarding.ts` (新規), `src/server/actions/comparison.ts` (新規), `src/server/actions/partner-reactions.ts` (新規), 既存Server Actionsの revalidatePath変更, `.env.example` に `ANTHROPIC_API_KEY` 追加（`addVenueFromUrl` で使用） |

### Phase B: Main Screens（4 worktree並列）

| Worktree | ブランチ | 作成ファイル | 変更ファイル |
|----------|---------|-------------|-------------|
| **wt-1** | `feat/home-v2` | `src/app/(app)/page.tsx` (書き換え), `src/components/home/greeting.tsx`, `src/components/home/quick-actions.tsx`, `src/components/home/recent-venues.tsx`, `src/components/home/venue-card-small.tsx`, `src/app/(app)/loading.tsx` (書き換え) | なし |
| **wt-2** | `feat/explore-v2` | `src/app/(app)/explore/page.tsx`, `src/components/explore/filter-chips.tsx`, `src/components/explore/add-venue-sheet.tsx`, `src/app/(app)/explore/loading.tsx` | `src/components/venues/venue-form.tsx` (Sheet内利用対応), `src/server/actions/venues.ts` (`addVenueFromUrl` 追加) |
| **wt-3** | `feat/coach-v2` | `src/app/(app)/coach/page.tsx`, `src/components/coach/insight-card-feed.tsx`, `src/components/coach/chat-bar.tsx`, `src/components/coach/chat-bubble.tsx`, `src/app/(app)/coach/loading.tsx` | なし |
| **wt-4** | `feat/candidates-v2` | `src/app/(app)/candidates/page.tsx`, `src/components/candidates/segmented-control.tsx`, `src/components/candidates/shortlist-view.tsx`, `src/app/(app)/candidates/loading.tsx` | なし |

### Phase C: Detail & Comparison（4 worktree並列）

| Worktree | ブランチ | 作成ファイル | 変更ファイル |
|----------|---------|-------------|-------------|
| **wt-5** | `feat/comparison-v2` | `src/components/comparison/circular-score.tsx`, `src/components/comparison/dimension-bar.tsx`, `src/components/comparison/quick-look.tsx`, `src/components/comparison/diff-toggle.tsx` | `src/components/compare/comparison-matrix.tsx` (リファクタ or 置換), `src/components/compare/venue-selector.tsx` (リファクタ) |
| **wt-6** | `feat/venue-detail-v2` | `src/components/estimates/estimate-xray.tsx`, `src/components/ratings/partner-comparison-summary.tsx`, `src/app/(app)/venues/[id]/loading.tsx` | `src/app/(app)/venues/[id]/page.tsx` (セクション構成変更), `src/components/venues/venue-ratings-section.tsx` → 統合, `src/components/venues/estimate-section.tsx` (XRay統合) |
| **wt-7** | `feat/onboarding-v2` | `src/app/(app)/onboarding/page.tsx`, `src/components/onboarding/chat-history.tsx`, `src/components/onboarding/question-step.tsx`, `src/app/(app)/onboarding/loading.tsx` | なし |
| **wt-8** | `feat/partner-v2` | `src/components/partner/partner-invite.tsx` (書き換え), `src/components/partner/reaction-buttons.tsx`, `src/components/decision/decision-ceremony.tsx` | `src/app/(app)/accept-invite/page.tsx` (リデザイン), `src/app/(app)/accept-invite/accept-invite-form.tsx` (リアクションUI追加), `src/components/decision/decision-form.tsx` (Ceremony統合) |

### Phase D: Integration & Polish

| # | タスク | 詳細 |
|---|--------|------|
| D1 | ブランチマージ | Phase B → main、Phase C → main（コンフリクト解決） |
| D2 | 旧ページ削除 | `conditions/`, `dashboard/`, `compare/`, `shortlist/`, `decision/` のpage.tsx削除 |
| D3 | 旧コンポーネント削除 | 廃止リストのファイル削除 |
| D4 | E2Eテスト | Playwright 375px viewport（セクションg参照） |
| D5 | Motion polish | framer-motion spring configs統一、prefers-reduced-motion対応 |
| D6 | AIインサイト調整 | トリガー条件の閾値チューニング |
| D7 | ビルド・リント確認 | `npm run lint && npm test && npm run build` |

---

## g) テスト計画

### Vitest 単体テスト

| 対象 | ファイル | テスト方針 |
|------|---------|-----------|
| `toggleFavorite()` | `tests/server/actions/favorites.test.ts` | Prismaモック。追加→true、再度呼び出し→false（トグル動作） |
| `saveOnboardingAnswers()` | `tests/server/actions/onboarding.test.ts` | Zodバリデーション。有効/無効入力。project.conditions更新確認 |
| `sendCoachMessage()` | `tests/server/actions/coach.test.ts` | 各FAQキーワードでマッチ確認。フォールバック応答確認 |
| `getAIInsights()` | `tests/server/actions/insights.test.ts` | 各トリガー条件のテスト。priority順ソート確認。最大5件制限 |
| `submitPartnerReaction()` | `tests/server/actions/partner-reactions.test.ts` | 認証不要確認。upsert動作（同トークン再投票で更新） |
| `getComparisonData()` | `tests/server/actions/comparison.test.ts` | 2-3件制限。totalScore計算。テンプレート文生成 |
| `getFavorites()` | `tests/server/actions/favorites.test.ts` | 3フィルタ（mine/partner/both）の動作確認 |
| `getHomeData()` | `tests/server/actions/home.test.ts` | 進捗%計算ロジック。recentVenues取得 |
| `generateComparisonInsight()` | `tests/lib/comparison-insight.test.ts` | テンプレート文生成。スコア差分検出。費用比較 |
| `UPGRADE_RATES` | `tests/lib/constants.test.ts` | 全カテゴリに rate/min/max が定義されていること |
| `ProgressRing` | `tests/components/progress-ring.test.ts` | 0%, 50%, 100%のレンダリング。SVG stroke-dasharray確認 |
| `BottomNav` | `tests/components/bottom-nav.test.ts` | 4タブ表示。アクティブ状態。バッジ表示 |
| `AIInsightCard` | `tests/components/insight-card.test.ts` | 5タイプのアイコン/色/ボーダー確認 |
| `FilterChips` | `tests/components/filter-chips.test.ts` | 選択/未選択状態の切替 |
| `SegmentedControl` | `tests/components/segmented-control.test.ts` | 3セグメント切替。disabled状態 |

### Playwright E2E テスト（375px viewport）

全テスト共通設定:

```typescript
// playwright.config.ts
use: {
  viewport: { width: 375, height: 812 }, // iPhone 13 mini
  deviceScaleFactor: 2,
}
```

#### シナリオ 1: オンボーディング → ホーム

```
1. /login でサインイン
2. /onboarding にリダイレクトされること（conditions=null）
3. 4問に回答（PillOptionsをタップ）
4. 「パーソナライズ完了」表示
5. / (Home) にリダイレクトされること
6. Greetingにユーザー名表示
7. ProgressRingが表示されること
```

#### シナリオ 2: 式場追加 → Explore一覧

```
1. /explore に遷移
2. 「+ 追加」ボタンタップ → AddVenueSheet表示
3. 式場名「テスト式場」を入力して保存
4. VenueCardが一覧に追加されること
5. FilterChipsの「エリア」タップ → フィルタ動作
```

#### シナリオ 3: お気に入りトグル → Candidates表示

```
1. /explore でVenueCardのハートをタップ
2. ハートがfill状態になること
3. /candidates に遷移
4. ショートリストにお気に入り式場が表示されること
5. 再度ハートタップ → 解除 → 一覧から消えること
```

#### シナリオ 4: 比較ボード

```
1. 2件の式場をお気に入り登録
2. /candidates → 「比較」セグメント選択
3. 2件のドロップダウンで式場選択
4. QuickLookに円形スコア表示
5. DimensionBarに6次元スコア表示
6. 「差分のみ表示」トグル → 同値行が非表示になること
7. AIインサイトカードにテンプレート文表示
```

#### シナリオ 5: Coach FAQ

```
1. /coach に遷移
2. ChatBarに「見積もりが高い」と入力して送信
3. FAQ回答がChatBubbleで表示されること
4. 「詳しく見る」アクションリンクが表示されること
5. マッチしない質問を送信 → フォールバック応答確認
```

#### シナリオ 6: パートナーゲストリアクション

```
1. /accept-invite?token=xxx にアクセス（未ログイン状態）
2. 式場カードが表示されること
3. 「いいね」ボタンタップ
4. 「ありがとうございます」メッセージ表示
5. 「もっと詳しく評価する」リンク → サインアップ画面
```

#### シナリオ 7: 最終決定セレモニー

```
1. /candidates → 「決定」セグメント（比較後に有効化）
2. 式場を選択して「この式場に決める」タップ
3. Phase 1: コンフェッティアニメーション表示
4. Phase 2: 決定サマリカード（旅路サマリ）表示
5. Phase 3: タグチップ選択 + 理由記入
6. 「記録する」タップ → Decision保存確認
```

---

## 依存パッケージ追加

```bash
npm install embla-carousel-react
```

`canvas-confetti` は既存（package.json に含まれる）。

---

## チェックリスト（実装完了条件）

- [ ] Prismaマイグレーション成功 + `npx prisma generate` エラーなし
- [ ] `npm run build` 成功
- [ ] `npm run lint` エラーなし
- [ ] `npm test` 全テストパス
- [ ] 旧ルート（/dashboard, /conditions, /compare, /shortlist, /decision）が新ルートにリダイレクト
- [ ] 375px viewportで全画面のタッチターゲット44px以上
- [ ] BottomNav の SafeArea対応
- [ ] 全画面に loading.tsx 配置
- [ ] AIインサイトがルールベースで生成されること（Claude API未使用）
- [ ] Coach ChatBarでFAQ応答が返ること
- [ ] お気に入りの3ビュー切替（mine/partner/both）が動作すること
- [ ] パートナーゲストリアクションが認証なしで動作すること
- [ ] Playwright E2E 7シナリオ全パス
