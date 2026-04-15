# VenueLens v2 Release 3 — Technical Specification (Visit & Full Partner)

> Release 2 で Claude API が接続済みの状態から、見学体験のデジタル化とパートナー機能の完成を行うリリース。
> 参照: [roadmap.md](../../roadmap.md) / [Release 1 技術設計書](./2026-04-13-release1-technical-spec.md) / [v2画面仕様](./2026-04-13-venuelens-v2-redesign.md)
> 作成日: 2026-04-13

---

## a) Prisma スキーマ変更

### 既存モデルの評価

Release 3 で必要なデータモデルはほぼ既存スキーマでカバーされている。

| モデル | 状態 | Release 3 での用途 |
|--------|------|-------------------|
| `Visit` | 既存 ✅ | 見学スケジュール管理。`scheduledAt`, `status`, `completedAt` でカレンダー表示に十分 |
| `VisitChecklistItem` | 既存 ✅ | AI生成チェックリスト（最大5項目）。`item`, `category`, `checked`, `sortOrder` で要件充足 |
| `VisitNote` | 既存 ✅ | クイックメモ。`content`, `tags`, `locationLat`, `locationLng` でGPS対応済み |
| `VisitNoteMedia` | 既存 ✅ | 写真添付。`type`, `mediaUrl` で Supabase Storage URL を格納 |
| `VisitRating` | 既存 ✅ | パートナー星評価（6次元）。`userId` でオーナー/パートナー区別可能 |

### 必要な変更

#### 1. Visit — カレンダー用フィールド追加

```prisma
model Visit {
  // ... existing fields ...
  title       String?                          // NEW: display name on calendar (e.g. "ホテル椿山荘 見学")
  memo        String?                          // NEW: pre-visit memo (time, contact person, etc.)
  reminderSentAt DateTime? @map("reminder_sent_at")  // NEW: tracks if reminder was sent
  // ... rest of fields ...
}
```

**理由**: 既存の Visit は `venueId` + `scheduledAt` だけでカレンダー表示できるが、ユーザーが見学メモ（集合時間、担当者名など）を残す場所がない。`title` はカレンダービューでの表示名。`reminderSentAt` は見学リマインダーの重複送信防止。

#### 2. VisitRating — comment フィールドの活用確認

```prisma
model VisitRating {
  // ... existing fields ...
  comment   String?    // ALREADY EXISTS: Level 2 partner "一言コメント" に使用
  // ...
}
```

`comment` フィールドは既存。Level 2 パートナーの「一言コメント」はこのフィールドをそのまま使う。変更不要。

#### 3. AiAnalysisType — `rating_comparison` 追加

```prisma
enum AiAnalysisType {
  review_summary
  estimate_prediction
  comparison
  visit_prep
  coach_chat           // R1 で追加済み
  rating_comparison    // NEW: 二人の評価比較AIコメント
}
```

**理由**: 二人の評価比較ビューで生成するAIコメント（「雰囲気では一致。料理で意見が分かれています」等）のキャッシュ先。`input_hash` で変更がなければ再生成をスキップ。

#### 4. VisitNote — GPS精度要件

既存の `locationLat Decimal(9,6)` / `locationLng Decimal(9,6)` は小数点以下6桁 = 約0.11m精度。式場内での位置特定に十分。変更不要。

Geolocation API の `enableHighAccuracy: true` で取得し、精度が100m以上の場合はGPS情報を付与しない（ユーザーへの通知も不要 — メモの価値はGPSではなくコンテンツ）。

### Supabase Storage バケット設計

| バケット名 | アクセス | 用途 | ファイル制限 |
|-----------|--------|------|------------|
| `visit-photos` | `project_members` RLS | 見学時の写真キャプチャ | 10MB/file, image/jpeg, image/png, image/webp |
| `estimate-pdfs` | `project_members` RLS | 見積もりPDF（R2で使用開始済み） | 10MB/file, application/pdf |

**パス規則**: `{projectId}/{venueId}/{visitId}/{uuid}.{ext}`

```sql
-- visit-photos バケットの RLS ポリシー
CREATE POLICY "project_member_upload" ON storage.objects
  FOR INSERT WITH CHECK (
    bucket_id = 'visit-photos' AND
    (storage.foldername(name))[1] IN (
      SELECT project_id::text FROM project_members
      WHERE user_id = auth.uid() AND accepted_at IS NOT NULL
    )
  );

CREATE POLICY "project_member_read" ON storage.objects
  FOR SELECT USING (
    bucket_id = 'visit-photos' AND
    (storage.foldername(name))[1] IN (
      SELECT project_id::text FROM project_members
      WHERE user_id = auth.uid() AND accepted_at IS NOT NULL
    )
  );
```

### マイグレーション

```bash
npx prisma migrate dev --name r3_visit_calendar_and_rating_comparison
npx prisma generate
npm run build
```

マイグレーション内容:
1. `visits` テーブルに `title TEXT`, `memo TEXT`, `reminder_sent_at TIMESTAMPTZ` カラム追加
2. `AiAnalysisType` Enum に `rating_comparison` 追加（`ALTER TYPE ... ADD VALUE`）

---

## b) Supabase Realtime 設計

### 現状の実装

`src/lib/supabase/realtime.ts` の `useRealtimeSync()` は `project-{projectId}` チャンネルで `project_id=eq.{projectId}` フィルタを使い、変更時に `router.refresh()` を呼ぶ。

**制限**: 現在のフィルタは `project_id` カラムを持つテーブル（`venues`, `estimates`, `ai_analyses` など）にしか効かない。`visit_ratings`, `visit_notes`, `visit_checklist_items` は `project_id` カラムを持たず、`visit_id` → `venue_id` → `project_id` の間接参照。

### チャンネル設計

プロジェクト単位の単一チャンネルを維持し、テーブル別にリスナーを追加する方式。

```
project-{projectId}
├── postgres_changes: venues (filter: project_id=eq.{projectId})
├── postgres_changes: visit_ratings (filter: なし — 全イベントを受信し、クライアントでフィルタ)
├── postgres_changes: visit_notes (filter: なし)
├── postgres_changes: visit_checklist_items (filter: なし)
├── postgres_changes: venue_favorites (filter: なし)
└── postgres_changes: venue_scores (filter: なし)
```

**なぜ式場単位ではなくプロジェクト単位か**: カップルのプロジェクトには平均5-15式場。式場ごとにチャンネルを作ると管理が複雑化し、チャンネル数上限（Supabase Free: 100同時接続）にも近づく。プロジェクト単位なら1チャンネルで全データを同期できる。

### realtime.ts の拡張

```typescript
// src/lib/supabase/realtime.ts
"use client";

import { createClient } from "@/lib/supabase/client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Subscribe to Postgres changes for a project and refresh the page on updates.
 * R3: Added per-table subscriptions for visit-related tables that lack project_id.
 */
export function useRealtimeSync(projectId: string) {
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const handleChange = () => {
      router.refresh();
    };

    const channel = supabase
      .channel(`project-${projectId}`)
      // Tables with project_id column (direct filter)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "venues", filter: `project_id=eq.${projectId}` },
        handleChange
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "estimates", filter: `project_id=eq.${projectId}` },
        handleChange
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "ai_analyses", filter: `project_id=eq.${projectId}` },
        handleChange
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "decisions", filter: `project_id=eq.${projectId}` },
        handleChange
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "partner_reactions", filter: `project_id=eq.${projectId}` },
        handleChange
      )
      // Tables without project_id — receive all events, RLS filters server-side
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "visit_ratings" },
        handleChange
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "visit_notes" },
        handleChange
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "visit_checklist_items" },
        handleChange
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "venue_scores" },
        handleChange
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "venue_favorites" },
        handleChange
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [projectId, router, supabase]);
}
```

### 同期対象データ

| データ | テーブル | イベント | Realtime経由で更新されるUI |
|--------|---------|---------|--------------------------|
| パートナー星評価 | `visit_ratings` | INSERT/UPDATE | VenueDetail のパートナー比較、ComparisonBoard |
| お気に入り | `venue_favorites` | INSERT/DELETE | Candidates ショートリスト、Explore のハートアイコン |
| 式場追加 | `venues` | INSERT | Explore カードリスト |
| 式場スコア変更 | `venue_scores` | UPDATE | ComparisonBoard の DimensionBar |
| チェックリスト | `visit_checklist_items` | UPDATE | VisitSection のチェックリスト表示 |
| メモ/写真 | `visit_notes` | INSERT | VisitSection のノート一覧 |

### コンフリクト解決

**Last-Write-Wins (LWW)**: `visit_ratings` の UNIQUE制約 `(visitId, userId, dimension)` により、同一ユーザーの同一次元は常に最新値が勝つ。パートナー間は `userId` が異なるため衝突しない。

**楽観的更新**: クライアント側で即座にUIを更新し、Server Action 完了後に `router.refresh()` で最新データを取得。Realtime イベントが先に来た場合も `router.refresh()` で整合性を保つ。

**同時メモ追加**: `visit_notes` は追記型のため衝突なし。二人が同時にメモを追加しても別レコードとして保存される。

### Supabase Dashboard での有効化が必要なテーブル

R3 で新たに Realtime を有効化するテーブル:
- `visit_ratings` — パートナー評価リアルタイム同期
- `visit_notes` — メモのリアルタイム表示
- `visit_checklist_items` — チェック状態の同期
- `venue_favorites` — お気に入りの同期
- `venue_scores` — スコア更新の同期

設定場所: Supabase Dashboard > Database > Replication > Source > 各テーブルのトグルをON

---

## c) パートナー Level 2-3 の認証・権限設計

### レベル定義

| Level | 認証状態 | 技術的状態 | できること |
|-------|---------|-----------|-----------|
| **Level 1** (R1実装済み) | アカウント不要 | `visitorToken` (localStorage UUID) | 式場に 👍/🤔/👎 リアクション。`PartnerReaction` に保存 |
| **Level 2** (R3) | サインアップ済み + 招待承諾 | `ProjectMember(role: partner, acceptedAt: not null)` | 6次元星評価 + 一言コメント。`VisitRating` に `userId` 紐付きで保存 |
| **Level 3** (R3) | Level 2 と同じ認証 | 同上（UIによるフル機能開放） | 全機能アクセス（式場追加、メモ、写真、見学記録、比較ボード、コーチ） |

### Level 1 → 2 への遷移フロー

```
[Level 1: Guest View]
  ↓ リアクション完了後
  ↓ "もっと詳しく評価しませんか？" プロンプト表示
  ↓ [サインアップする] CTA
  ↓
[Supabase Auth: Email サインアップ]
  ↓ 認証完了
  ↓ `getPendingInvitation()` で既存招待を自動検出
  ↓ 招待が存在 → `acceptInvitation()` で自動承諾
  ↓
[Level 2: 星評価 + コメント]
  ↓ StarRatingInput が有効化される
  ↓ VenueDetail の RatingSection でパートナー値が入力可能に
```

**技術的ポイント**:
- Level 1 の `visitorToken` (localStorage) と Level 2 の `userId` (Supabase Auth) は別物。Level 1 → 2 遷移時に `PartnerReaction` のデータは **そのまま維持**（リアクションは `visitorToken` ベースのため、`userId` への紐付け直しは行わない）。
- `acceptInvitation()` は既存の `src/server/actions/invitations.ts` をそのまま使用。サインアップ直後のコールバックページで自動実行する。

### Level 2 → 3 への遷移

Level 2 と Level 3 の技術的な認証差分はない。違いは **UIの開放範囲**。

```typescript
// src/lib/partner-level.ts
export type PartnerLevel = 1 | 2 | 3;

export function getPartnerLevel(member: ProjectMember | null): PartnerLevel {
  if (!member) return 1; // no auth = guest
  if (!member.acceptedAt) return 1; // invited but not accepted
  // Level 2 vs 3: no technical gate.
  // Level 3 is the full app experience once acceptedAt is set.
  return 3;
}
```

**設計決定**: Level 2 と Level 3 を技術的に分離しない理由:
- パートナーがサインアップ + 招待承諾した時点で、式場追加やメモ追加を制限する合理的理由がない
- 段階的な機能開放はUXの摩擦になる（「なぜメモが書けないの?」）
- 実質的に Level 2 = Level 3。ロードマップ上の区別はユーザー体験の段階を示す概念的なもの

**ただし、初回ログイン時のオンボーディング**: Level 2/3 パートナーの初回ログイン時は、フル機能を即座に見せるのではなく、まず「評価画面」に誘導するソフトオンボーディングを表示する。

### Permission Model (Owner vs Partner)

| 操作 | Owner | Partner | 実装方法 |
|------|-------|---------|---------|
| 式場追加 | ✅ | ✅ | `requireProjectMembership()` |
| 式場編集 | ✅ | ✅ | `requireProjectMembership()` |
| 式場削除 | ✅ | ❌ | `requireOwner()` |
| 星評価 | ✅ | ✅ | `requireProjectMembership()` |
| メモ/写真追加 | ✅ | ✅ | `requireProjectMembership()` |
| 見積もりアップロード | ✅ | ✅ | `requireProjectMembership()` |
| 見学スケジュール作成 | ✅ | ✅ | `requireProjectMembership()` |
| 最終決定 | ✅ | ❌（投票のみ） | `requireOwner()` + パートナーは同意/反対UI |
| パートナー招待 | ✅ | ❌ | `requireOwner()` |
| プロジェクト削除 | ✅ | ❌ | `requireOwner()` |

既存の `requireOwner()` と `requireProjectMembership()` で全ケースをカバー。新しい認証ヘルパーの追加は不要。

---

## d) 見学体験の画面仕様

### VenueDetail 内の VisitSection 拡張

v2画面仕様の VenueDetail は以下のセクション構成:

```
VenueDetailPage
├── PhotoGallery
├── VenueHeader
├── RatingSection
├── EstimateSection
├── VisitSection          ← R3 で大幅拡張
│   ├── VisitCalendarCard  ← NEW: 予定日表示 + カレンダーリンク
│   ├── VisitChecklist     ← NEW: AI生成チェックリスト
│   ├── QuickCaptureBar    ← NEW: ワンタップ入力バー
│   └── VisitNoteList      ← NEW: メモ + 写真の時系列表示
├── ReviewSummary
└── ActionBar
```

### VisitCalendarCard

```typescript
// src/components/visits/visit-calendar-card.tsx
interface VisitCalendarCardProps {
  visit: {
    id: string;
    scheduledAt: Date | null;
    status: VisitStatus;
    title: string | null;
    memo: string | null;
  };
  venueName: string;
}
```

**表示仕様**:
- カード: `bg-card rounded-xl shadow-card p-4`
- 日付: `text-2xl font-light tabular-nums` (例: "4/18 (金) 14:00")
- ステータスバッジ: `scheduled` → 青, `completed` → 緑, `cancelled` → グレー
- メモ: `text-sm text-muted-foreground` (集合時間、担当者名など)
- アクション: [Google Calendarに追加] → `https://calendar.google.com/calendar/render?action=TEMPLATE&text=...` 形式のリンク
- 未予約時: "見学の予定を登録しましょう" + 日付ピッカー

### 見学スケジュールカレンダービュー（ホーム画面）

ホーム画面の QuickActions に「見学予定」ショートカットを追加。タップで見学一覧画面（モーダルまたは新ルート）を表示。

```typescript
// src/components/visits/visit-calendar-view.tsx
interface VisitCalendarViewProps {
  visits: Array<{
    id: string;
    venueId: string;
    venueName: string;
    scheduledAt: Date | null;
    status: VisitStatus;
  }>;
}
```

**表示仕様**:
- 月カレンダー: 日付セルに見学ドットインジケーター (金: gold-warm, 完了: success, キャンセル: muted)
- 日付タップ → その日の見学リストを下部に表示
- ライブラリ: 自前実装（`date-fns` のみ使用、重いカレンダーライブラリは導入しない）
- Mobile: 週ビューをデフォルト、スワイプで週送り

### VisitChecklist（AI生成）

```typescript
// src/components/visits/visit-checklist.tsx
interface VisitChecklistProps {
  visitId: string;
  items: Array<{
    id: string;
    item: string;
    category: string | null;
    checked: boolean;
  }>;
  isGenerating: boolean;
}
```

**仕様**:
- 最大5項目（旧design specの「phone out the whole time 問題」回避）
- AI生成トリガー: 見学を `scheduled` に設定した時点で `generateVisitChecklist()` を自動呼び出し
- 生成ソース: 式場の口コミ分析結果（R2で生成済み）+ カップルの条件（`project.conditions`）から Claude が5項目を選定
- 各項目: チェックボックス (44px touch target) + テキスト
- チェック → `toggleChecklistItem()` Server Action → `checkedAt` 記録
- 項目例: "料理の試食は可能か確認する", "持ち込み料金を質問する", "二次会会場の提携先を聞く"

### QuickCaptureBar

```typescript
// src/components/visits/quick-capture-bar.tsx
interface QuickCaptureBarProps {
  visitId: string;
}
```

**仕様**:
- VenueDetail の VisitSection 内、固定表示バー
- レイアウト: `flex items-center gap-3 bg-card border-t border-border px-4 py-3`
- 3ボタン:
  - 📷 写真: `<input type="file" accept="image/*" capture="environment">` — ネイティブカメラ起動
  - 📝 メモ: テキスト入力シート（Sheet bottom）
  - 📍 位置: 現在地を自動取得してメモに付与（メモ追加時に自動、独立ボタンは不要）
- 各ボタン: `w-11 h-11 rounded-full bg-muted flex items-center justify-center`

### GPS取得の実装

```typescript
// src/hooks/use-geolocation.ts
interface GeolocationState {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  error: string | null;
  loading: boolean;
}

export function useGeolocation(): GeolocationState {
  // navigator.geolocation.getCurrentPosition with:
  // - enableHighAccuracy: true
  // - timeout: 10000 (10 seconds)
  // - maximumAge: 60000 (1 minute cache)
  //
  // Privacy considerations:
  // - Only request when user taps "add note" (not on page load)
  // - Show permission explanation before browser prompt
  // - Graceful fallback: if denied or unavailable, save note without GPS
  // - GPS data stored only in visit_notes (not sent to external services)
  // - Accuracy > 100m → discard GPS data silently
}
```

**プライバシー考慮**:
- GPS は見学メモ追加時のみ取得（ページロード時には取得しない）
- ブラウザのPermission APIで事前チェック、未許可なら「位置情報を使うと、どこで撮った写真か後で分かりやすくなります」のインフォメーションを表示
- 拒否された場合はGPSなしでメモを保存（エラー表示しない）
- GPSデータは `visit_notes` テーブルにのみ保存、外部サービスに送信しない

### 写真アップロード

```typescript
// src/lib/supabase/storage.ts

/**
 * Upload a visit photo to Supabase Storage and return the public URL.
 * Client-side resize to max 2048px before upload for bandwidth optimization.
 */
export async function uploadVisitPhoto(
  file: File,
  projectId: string,
  venueId: string,
  visitId: string
): Promise<string> {
  // 1. Client-side resize (canvas API, max 2048px longest side, JPEG quality 0.85)
  // 2. Generate UUID filename: {uuid}.jpg
  // 3. Upload to: visit-photos/{projectId}/{venueId}/{visitId}/{uuid}.jpg
  // 4. Return public URL
}
```

**Next.js Image 最適化**: `visit-photos` バケットの URL を `next.config.ts` の `images.remotePatterns` に追加。

```typescript
// next.config.ts
const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/visit-photos/**",
      },
    ],
  },
};
```

表示時は `<Image>` コンポーネントで `width={640} height={480}` のサイズヒントを指定し、Vercel Image Optimization で自動リサイズ。

### 見学チェックリスト AI生成

```typescript
// src/server/actions/visits.ts

/**
 * Generate a visit checklist using Claude API.
 * Max 5 items, based on venue reviews + couple's conditions.
 * Uses R2's Claude infrastructure (ANTHROPIC_API_KEY).
 */
export async function generateVisitChecklist(visitId: string): Promise<void> {
  // 1. Get visit -> venue -> reviews (ai_summary), project.conditions
  // 2. Build Claude prompt:
  //    "Based on the following venue information and the couple's priorities,
  //     generate exactly 5 practical checklist items for their venue visit.
  //     Each item should be a specific action or question."
  // 3. Parse response into 5 items
  // 4. Upsert into visit_checklist_items (delete existing AI-generated, insert new)
  // 5. revalidatePath(`/venues/${venueId}`)
}
```

---

## e) Server Actions 変更

### 新規 Server Actions

#### 1. `scheduleVisit(venueId, data)`

```typescript
// src/server/actions/visits.ts
"use server";

import { z } from "zod";
import { prisma } from "@/server/db";
import { revalidatePath } from "next/cache";
import { requireUser, requireProjectMembership } from "@/server/auth";

const scheduleVisitSchema = z.object({
  scheduledAt: z.coerce.date(),
  title: z.string().max(100).optional(),
  memo: z.string().max(500).optional(),
});

/**
 * Schedule a new venue visit or update an existing one.
 * Auto-updates Venue.status to 'visit_scheduled'.
 * Triggers AI checklist generation.
 */
export async function scheduleVisit(
  venueId: string,
  input: z.infer<typeof scheduleVisitSchema>
): Promise<{ success: boolean; visitId?: string; error?: string }> {
  const user = await requireUser();
  await requireProjectMembership(user.id);

  const parsed = scheduleVisitSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "無効な入力です" };
  }

  const visit = await prisma.visit.create({
    data: {
      venueId,
      scheduledAt: parsed.data.scheduledAt,
      title: parsed.data.title,
      memo: parsed.data.memo,
      status: "scheduled",
    },
  });

  // Update venue status to visit_scheduled
  await prisma.venue.update({
    where: { id: venueId },
    data: { status: "visit_scheduled" },
  });

  revalidatePath(`/venues/${venueId}`);
  revalidatePath("/");
  revalidatePath("/explore");

  // Trigger async checklist generation (non-blocking)
  generateVisitChecklist(visit.id).catch(console.error);

  return { success: true, visitId: visit.id };
}
```

#### 2. `completeVisit(visitId)`

```typescript
/**
 * Mark a visit as completed. Sets completedAt and updates venue status to 'visited'.
 */
export async function completeVisit(
  visitId: string
): Promise<{ success: boolean }> {
  const user = await requireUser();
  await requireProjectMembership(user.id);

  const visit = await prisma.visit.update({
    where: { id: visitId },
    data: { status: "completed", completedAt: new Date() },
    include: { venue: true },
  });

  await prisma.venue.update({
    where: { id: visit.venueId },
    data: { status: "visited" },
  });

  revalidatePath(`/venues/${visit.venueId}`);
  revalidatePath("/");
  return { success: true };
}
```

#### 3. `addVisitNote(visitId, data)`

```typescript
const visitNoteSchema = z.object({
  content: z.string().min(1).max(2000),
  tags: z.array(z.string()).max(10).optional(),
  locationLat: z.number().min(-90).max(90).optional(),
  locationLng: z.number().min(-180).max(180).optional(),
});

/**
 * Add a quick note during a venue visit.
 * GPS coordinates are optional (attached if available).
 */
export async function addVisitNote(
  visitId: string,
  input: z.infer<typeof visitNoteSchema>
): Promise<{ success: boolean; noteId?: string }> {
  const user = await requireUser();
  await requireProjectMembership(user.id);

  const parsed = visitNoteSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false };
  }

  const note = await prisma.visitNote.create({
    data: {
      visitId,
      content: parsed.data.content,
      tags: parsed.data.tags ?? [],
      locationLat: parsed.data.locationLat,
      locationLng: parsed.data.locationLng,
    },
  });

  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    select: { venueId: true },
  });

  revalidatePath(`/venues/${visit?.venueId}`);
  return { success: true, noteId: note.id };
}
```

#### 4. `addNoteMedia(noteId, mediaUrl, type)`

```typescript
/**
 * Attach a photo (or future: voice) to an existing visit note.
 * mediaUrl is the Supabase Storage public URL (uploaded client-side).
 */
export async function addNoteMedia(
  noteId: string,
  mediaUrl: string,
  type: string = "photo"
): Promise<{ success: boolean }> {
  const user = await requireUser();
  await requireProjectMembership(user.id);

  await prisma.visitNoteMedia.create({
    data: { visitNoteId: noteId, type, mediaUrl },
  });

  // Get venue ID for revalidation
  const note = await prisma.visitNote.findUnique({
    where: { id: noteId },
    include: { visit: { select: { venueId: true } } },
  });

  revalidatePath(`/venues/${note?.visit.venueId}`);
  return { success: true };
}
```

#### 5. `toggleChecklistItem(itemId)`

```typescript
/**
 * Toggle a checklist item's checked state.
 * Records checkedAt timestamp when checked.
 */
export async function toggleChecklistItem(
  itemId: string
): Promise<{ success: boolean; checked: boolean }> {
  const user = await requireUser();
  await requireProjectMembership(user.id);

  const item = await prisma.visitChecklistItem.findUnique({
    where: { id: itemId },
    include: { visit: { select: { venueId: true } } },
  });

  if (!item) return { success: false, checked: false };

  const newChecked = !item.checked;
  await prisma.visitChecklistItem.update({
    where: { id: itemId },
    data: {
      checked: newChecked,
      checkedAt: newChecked ? new Date() : null,
    },
  });

  revalidatePath(`/venues/${item.visit.venueId}`);
  return { success: true, checked: newChecked };
}
```

#### 6. `generateVisitChecklist(visitId)` — 上述のセクション d) 参照

#### 7. `generateRatingComparison(venueId)`

```typescript
// src/server/actions/rating-comparison.ts
"use server";

/**
 * Generate an AI comment comparing owner and partner ratings for a venue.
 * Uses Claude API to analyze agreement and disagreement patterns.
 * Cached via AiAnalysis with type: 'rating_comparison' and input_hash.
 *
 * @returns AI-generated comparison comment (Japanese, 2-3 sentences)
 */
export async function generateRatingComparison(
  venueId: string
): Promise<{ comment: string; cached: boolean }> {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  // 1. Get both partner ratings via getPartnerRatings(venueId)
  // 2. Compute input_hash from ratings data
  // 3. Check existing AiAnalysis (type: rating_comparison, input_hash match)
  // 4. If cached, return cached comment
  // 5. Otherwise, call Claude:
  //    "Compare these two people's ratings of a wedding venue.
  //     Highlight where they agree and disagree.
  //     Be warm and constructive. Suggest discussion topics for disagreements.
  //     2-3 sentences in Japanese."
  // 6. Save to AiAnalysis, return comment
}
```

#### 8. `getVisitsByProject()`

```typescript
// src/server/actions/visits.ts

/**
 * Get all visits for the current project, with venue info.
 * Used by the calendar view on the home page.
 */
export async function getVisitsByProject(): Promise<Array<{
  id: string;
  venueId: string;
  venueName: string;
  venueLocation: string | null;
  scheduledAt: Date | null;
  status: VisitStatus;
  completedAt: Date | null;
  title: string | null;
  checklistProgress: { total: number; checked: number };
}>> {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  const venues = await prisma.venue.findMany({
    where: { projectId },
    include: {
      visits: {
        include: {
          checklist: { select: { checked: true } },
        },
        orderBy: { scheduledAt: "asc" },
      },
    },
  });

  // Flatten and map visits with venue info
  // ...
}
```

### 既存 Server Actions の拡張

#### `saveRatings()` — コメント保存の追加

```typescript
// src/server/actions/ratings.ts
// 既存の ratingSchema を拡張して comment を受け付ける

const ratingSchemaV2 = z.object({
  ratings: z.record(z.string(), z.number().min(1).max(5)),
  comments: z.record(z.string(), z.string().max(200)).optional(), // NEW: dimension -> comment
});
```

`saveRatings()` 内で `comments` が渡された場合、対応する `VisitRating.comment` を更新する。既存のシグネチャとの後方互換性は維持（`comments` は optional）。

### Supabase Storage アップロード関数

```typescript
// src/lib/supabase/storage.ts
"use client";

import { createClient } from "@/lib/supabase/client";

/**
 * Resize image client-side before upload.
 * Max dimension: 2048px, JPEG quality: 0.85
 */
async function resizeImage(file: File, maxSize: number = 2048): Promise<Blob> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      let { width, height } = img;
      if (width > maxSize || height > maxSize) {
        const ratio = Math.min(maxSize / width, maxSize / height);
        width *= ratio;
        height *= ratio;
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob((blob) => resolve(blob!), "image/jpeg", 0.85);
    };
    img.src = URL.createObjectURL(file);
  });
}

/**
 * Upload visit photo to Supabase Storage.
 * Returns the public URL for storage in visit_note_media.
 */
export async function uploadVisitPhoto(
  file: File,
  projectId: string,
  venueId: string,
  visitId: string
): Promise<string> {
  const supabase = createClient();
  const resized = await resizeImage(file);
  const fileName = `${crypto.randomUUID()}.jpg`;
  const path = `${projectId}/${venueId}/${visitId}/${fileName}`;

  const { error } = await supabase.storage
    .from("visit-photos")
    .upload(path, resized, { contentType: "image/jpeg" });

  if (error) throw new Error(`Upload failed: ${error.message}`);

  const { data } = supabase.storage
    .from("visit-photos")
    .getPublicUrl(path);

  return data.publicUrl;
}
```

### Realtime 対応の Revalidation 戦略

Realtime イベントは `router.refresh()` でページの Server Component を再実行する。これは Next.js の Server Component キャッシュを無効化し、最新データを取得する。

Server Actions の `revalidatePath()` は、同一ブラウザの他タブやパートナーのブラウザには影響しない。Realtime がその役割を担う。

```
[User A: Server Action] → revalidatePath() → User A の画面更新
                        → DB変更 → Supabase Realtime →
[User B: Realtime listener] → router.refresh() → User B の画面更新
```

二重更新の回避: User A は Server Action の `revalidatePath()` で更新され、直後に Realtime イベントでもう一度 `router.refresh()` が呼ばれるが、Next.js の dedupe 機構（同一レンダリングサイクル内の重複フェッチ排除）により実質的なパフォーマンス影響は軽微。

---

## f) 見学リマインダー設計

### トリガー条件

```
見学完了 (visit.status = 'completed')
  AND 完了から3日経過 (visit.completedAt + 3 days <= now())
  AND そのvisitに紐づくVisitRatingが0件 (当該ユーザー分)
  AND reminderSentAt が null (未送信)
```

### 通知方法

R3 ではアプリ内インサイトカードのみ。メール/プッシュ通知は R4 の通知システムで対応。

#### アプリ内インサイトカード

Home 画面の `getAIInsights()` のトリガーロジック（R1で実装済み）に、以下のルールを追加:

```typescript
// src/server/actions/insights.ts
// Trigger 5: 見学3日経過 & 未評価 → reminder (priority 4)

const unratedVisits = await prisma.visit.findMany({
  where: {
    venue: { projectId },
    status: "completed",
    completedAt: { lte: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000) },
    reminderSentAt: null,
    ratings: {
      none: { userId: user.id },
    },
  },
  include: { venue: { select: { name: true, id: true } } },
});

for (const visit of unratedVisits) {
  insights.push({
    id: `reminder-${visit.id}`,
    type: "reminder",
    title: "見学の印象を記録しませんか？",
    body: `${visit.venue.name}の見学から3日経ちました。印象が新鮮なうちに評価を残しましょう。`,
    venueId: visit.venue.id,
    venueName: visit.venue.name,
    actions: [{ label: "評価する", href: `/venues/${visit.venue.id}` }],
    priority: 4,
    createdAt: visit.completedAt!,
  });
}
```

#### reminderSentAt の更新タイミング

インサイトカードがユーザーに表示された時点（`getAIInsights()` の返却時）ではなく、ユーザーがカードの CTA をクリックして評価画面に遷移した時点で `reminderSentAt` を更新する。

```typescript
// src/server/actions/visits.ts
export async function markReminderSent(visitId: string): Promise<void> {
  await prisma.visit.update({
    where: { id: visitId },
    data: { reminderSentAt: new Date() },
  });
}
```

### 頻度制御

- 同一 Visit に対するリマインダーは1回のみ（`reminderSentAt` で制御）
- Home 画面のインサイトカードは最大5件表示（priority 昇順）。リマインダーは priority 4 なので、より重要なインサイト（見学予定直前、見積もりリスク等）が優先される
- 将来（R4）: ユーザーごとの通知頻度モード（おまかせ / 控えめ / オフ）を実装

---

## g) テスト計画

### ユニットテスト (Vitest)

| テスト対象 | ファイル | テスト内容 |
|-----------|---------|-----------|
| `scheduleVisit()` | `tests/server/actions/visits.test.ts` | バリデーション、Visit作成、Venue.status更新 |
| `completeVisit()` | 同上 | status遷移、completedAt設定 |
| `addVisitNote()` | 同上 | メモ保存、GPS座標のオプショナル処理 |
| `toggleChecklistItem()` | 同上 | チェック/アンチェック、checkedAt更新 |
| `generateVisitChecklist()` | `tests/server/actions/visit-checklist.test.ts` | Claude APIモック、5項目生成、エラーハンドリング |
| `generateRatingComparison()` | `tests/server/actions/rating-comparison.test.ts` | キャッシュヒット/ミス、Claude APIモック |
| `getVisitsByProject()` | `tests/server/actions/visits.test.ts` | プロジェクトスコープ、チェックリスト進捗計算 |
| `uploadVisitPhoto()` | `tests/lib/supabase/storage.test.ts` | リサイズ処理、パス生成、エラーハンドリング |
| `useGeolocation()` | `tests/hooks/use-geolocation.test.ts` | 許可/拒否/タイムアウト各ケース |
| `getPartnerLevel()` | `tests/lib/partner-level.test.ts` | 各レベルの判定ロジック |
| リマインダートリガー | `tests/server/actions/insights.test.ts` | 3日経過判定、未評価チェック、重複防止 |

### E2E テスト (Playwright)

| シナリオ | 確認ポイント |
|---------|------------|
| 見学スケジュール登録 | 日付入力 → Visit作成 → Venue.status変更 → カレンダー表示 |
| AI チェックリスト生成 | 見学登録 → チェックリスト自動生成 → 5項目表示 → チェックON/OFF |
| クイックキャプチャ（メモ） | QuickCaptureBar → メモ入力 → 保存 → ノートリスト表示 |
| クイックキャプチャ（写真） | カメラボタン → ファイル選択 → アップロード → サムネイル表示 |
| パートナー星評価 | Partner ログイン → StarRatingInput → 保存 → Owner側でリアルタイム反映 |
| 評価比較ビュー | 二人が評価 → PartnerComparisonSummary → 不一致ハイライト + AIコメント |
| 見学リマインダー | Visit完了 → 3日経過(テスト用に短縮) → Home画面にリマインダーカード表示 |
| Level 1 → 2 遷移 | ゲストリアクション → サインアップ → 招待自動承諾 → 星評価が有効化 |

### Realtime テスト

Playwright で2つのブラウザコンテキスト（Owner, Partner）を同時起動し、以下を確認:

1. Owner が星評価を保存 → Partner の画面に反映される
2. Partner がメモを追加 → Owner の VisitSection に表示される
3. Owner がお気に入りを追加 → Partner の Candidates に反映される

### カバレッジ目標

- Server Actions: 80% 以上
- Hooks (useGeolocation等): 90% 以上
- コンポーネント: 既存の水準を維持（スナップショットテストは不要）

---

## h) Release 1-2 への先行要件（バックポート）

### Release 1 で準備すべきこと

| 項目 | 詳細 | 理由 |
|------|------|------|
| Supabase Realtime テーブル有効化 | `venues`, `venue_scores`, `project_members`, `visits`, `visit_ratings`, `estimates`, `decisions` の Realtime を有効化 | R3 の Realtime 同期の前提。R1 では `useRealtimeSync` が既に存在するが、テーブル有効化がされていない可能性がある |
| `visit-photos` Storage バケット作成 | Supabase Dashboard > Storage > New bucket: `visit-photos`, Public=false | R3 の写真アップロード先。R1-R2 で事前作成しておくと R3 開始時にスムーズ |
| `visit-photos` RLS ポリシー設定 | セクション a) の SQL を実行 | バケット作成と同時に設定 |
| `next.config.ts` の `images.remotePatterns` | Supabase Storage の URL パターンを追加 | R2 の見積もりPDFアップロードでも必要になる可能性あり。先行して追加 |
| `VisitNote`, `VisitNoteMedia` テーブルの Realtime 有効化 | Supabase Dashboard で有効化 | R3 のメモ・写真リアルタイム同期 |

### Release 2 で準備すべきこと

| 項目 | 詳細 | 理由 |
|------|------|------|
| `AiAnalysisType` に `rating_comparison` 追加 | Prisma マイグレーションで enum 値追加 | R3 の評価比較AIコメント保存先。R2 のマイグレーションに含めるとR3のマイグレーションが軽くなる |
| Claude API の `visit_prep` プロンプトテンプレート作成 | R2 で Claude 接続を行う際に、見学準備用のプロンプトも準備 | R3 の AI チェックリスト生成の基盤 |

### 先行作業チェックリスト

```
R1 バックポート:
- [ ] Supabase Dashboard: Realtime 有効化 (venues, venue_scores, project_members, visits, visit_ratings, estimates, decisions)
- [ ] Supabase Dashboard: visit-photos バケット作成 + RLS ポリシー
- [ ] next.config.ts: images.remotePatterns にSupabase Storage追加
- [ ] Supabase Dashboard: visit_notes, visit_note_media, visit_checklist_items の Realtime 有効化
- [ ] Supabase Dashboard: venue_favorites の Realtime 有効化

R2 バックポート:
- [ ] Prisma: AiAnalysisType に rating_comparison 追加
- [ ] Claude: visit_prep プロンプトテンプレート作成
```

---

## 実装フェーズ（推奨順序）

```
Phase 1: Schema & Infrastructure (1-2日)
├── Prisma マイグレーション (Visit 新フィールド + AiAnalysisType)
├── Supabase Storage バケット + RLS
├── Realtime テーブル有効化
└── next.config.ts 更新

Phase 2: Visit Core (2-3日) — 並列可能
├── scheduleVisit / completeVisit Server Actions
├── VisitCalendarCard コンポーネント
├── VisitCalendarView (月/週ビュー)
└── テスト

Phase 3: Quick Capture (2-3日) — 並列可能
├── addVisitNote / addNoteMedia Server Actions
├── useGeolocation hook
├── QuickCaptureBar コンポーネント
├── uploadVisitPhoto (client-side resize + Storage)
└── テスト

Phase 4: AI Features (1-2日)
├── generateVisitChecklist (Claude API)
├── generateRatingComparison (Claude API)
├── VisitChecklist コンポーネント
└── テスト

Phase 5: Partner & Realtime (2-3日)
├── realtime.ts 拡張 (テーブル別リスナー追加)
├── PartnerComparisonSummary 拡張 (AIコメント統合)
├── saveRatings 拡張 (comment 対応)
├── Level 1→2 遷移フロー
└── E2E テスト (2ブラウザ Realtime テスト)

Phase 6: Reminders & Polish (1日)
├── リマインダートリガーロジック (insights.ts 拡張)
├── markReminderSent Server Action
└── 統合テスト
```

合計見積もり: **7-12日**（Phase 2 と Phase 3 は worktree 並列実行可能）
