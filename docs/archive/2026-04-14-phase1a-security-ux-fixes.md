# Phase 1A: セキュリティ + UX修正 実装計画

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 全Server Actionのセキュリティ修正 + 壊れたUXの修正 + 情報設計の再構成

**Architecture:** auth.tsにvenueアクセス検証ヘルパーを追加し、全データ操作関数で使用。ホーム画面からQuickActions/ThemeSwitcher/PartnerInviteを除去し、Journey Card + 設定導線を追加。

**Tech Stack:** Next.js 16, Prisma, TypeScript, Server Actions

---

### Task 1: セキュリティヘルパー追加

**Files:**
- Modify: `src/server/auth.ts`
- Create: `tests/server/auth.test.ts`

- [ ] **Step 1: auth.tsにrequireVenueAccessヘルパーを追加**

```typescript
// src/server/auth.ts — 末尾に追加

export async function requireVenueAccess(userId: string, venueId: string) {
  const { projectId } = await requireProjectMembership(userId);
  const venue = await prisma.venue.findUnique({
    where: { id: venueId },
  });
  if (!venue || venue.projectId !== projectId) {
    throw new Error("式場が見つからないか、アクセス権がありません");
  }
  return { projectId, venue };
}

export async function requireVisitAccess(userId: string, visitId: string) {
  const { projectId } = await requireProjectMembership(userId);
  const visit = await prisma.visit.findUnique({
    where: { id: visitId },
    include: { venue: { select: { projectId: true, id: true } } },
  });
  if (!visit || visit.venue.projectId !== projectId) {
    throw new Error("見学記録が見つからないか、アクセス権がありません");
  }
  return { projectId, visit };
}
```

- [ ] **Step 2: ビルド確認**

Run: `cd /home/yusuke_kaya/projects/venuelens && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: コミット**

```bash
git add src/server/auth.ts
git commit -m "feat: add requireVenueAccess and requireVisitAccess helpers"
```

---

### Task 2: ratings.ts セキュリティ修正

**Files:**
- Modify: `src/server/actions/ratings.ts`

- [ ] **Step 1: saveRatingsにvenueアクセスチェックを追加**

`src/server/actions/ratings.ts` のimportに `requireVenueAccess` を追加し、`saveRatings` 関数内の `const user = await requireUser();` の直後に追加:

```typescript
import { requireUser, requireProjectMembership, requireVenueAccess } from "@/server/auth";
```

`saveRatings` 内、line 22の `const user = await requireUser();` の直後に:

```typescript
  await requireVenueAccess(user.id, venueId);
```

- [ ] **Step 2: saveDirectRatingsにvenueアクセスチェックを追加**

`saveDirectRatings` 内、line 113-114の `await requireUser();` を変更:

```typescript
  const user = await requireUser();
  await requireVenueAccess(user.id, venueId);
```

- [ ] **Step 3: getPartnerRatingsにvenueアクセスチェックを追加**

`getPartnerRatings` 内、line 141-142の後に追加:

```typescript
  await requireVenueAccess(user.id, venueId);
```

- [ ] **Step 4: ビルド確認**

Run: `cd /home/yusuke_kaya/projects/venuelens && npx tsc --noEmit`

- [ ] **Step 5: コミット**

```bash
git add src/server/actions/ratings.ts
git commit -m "fix: add project ownership checks to all rating actions"
```

---

### Task 3: favorites.ts セキュリティ修正

**Files:**
- Modify: `src/server/actions/favorites.ts`

- [ ] **Step 1: toggleFavoriteにvenueアクセスチェックを追加**

importに `requireVenueAccess` を追加。`toggleFavorite` 関数内を変更:

```typescript
import { requireUser, requireProjectMembership, requireVenueAccess } from "@/server/auth";

export async function toggleFavorite(venueId: string): Promise<{ isFavorite: boolean }> {
  const user = await requireUser();
  await requireVenueAccess(user.id, venueId);
  // ...rest unchanged
```

- [ ] **Step 2: ビルド確認**

Run: `cd /home/yusuke_kaya/projects/venuelens && npx tsc --noEmit`

- [ ] **Step 3: コミット**

```bash
git add src/server/actions/favorites.ts
git commit -m "fix: add project ownership check to toggleFavorite"
```

---

### Task 4: visits.ts セキュリティ修正

**Files:**
- Modify: `src/server/actions/visits.ts`

- [ ] **Step 1: importにrequireVisitAccessを追加**

```typescript
import { requireUser, requireProjectMembership, requireVenueAccess, requireVisitAccess } from "@/server/auth";
```

- [ ] **Step 2: completeVisitにvisitアクセスチェックを追加**

`completeVisit` 内、`requireProjectMembership` の代わりに:

```typescript
export async function completeVisit(visitId: string): Promise<{ success: boolean }> {
  const user = await requireUser();
  await requireVisitAccess(user.id, visitId);
  // ...rest unchanged
```

- [ ] **Step 3: addVisitNoteにvisitアクセスチェックを追加**

```typescript
export async function addVisitNote(
  visitId: string,
  input: z.infer<typeof visitNoteSchema>
): Promise<{ success: boolean; noteId?: string }> {
  const user = await requireUser();
  await requireVisitAccess(user.id, visitId);
  // ...rest unchanged
```

- [ ] **Step 4: addNoteMediaにnote→visit→venue所有権チェックを追加**

```typescript
export async function addNoteMedia(
  noteId: string,
  mediaUrl: string,
  type: string = "photo"
): Promise<{ success: boolean }> {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  // Verify note belongs to user's project
  const note = await prisma.visitNote.findUnique({
    where: { id: noteId },
    include: { visit: { include: { venue: { select: { projectId: true } } } } },
  });
  if (!note || note.visit.venue.projectId !== projectId) {
    return { success: false };
  }

  if (!mediaUrl.includes("supabase.co/storage")) {
    return { success: false };
  }

  await prisma.visitNoteMedia.create({
    data: { visitNoteId: noteId, type, mediaUrl },
  });

  revalidatePath(`/venues/${note.visit.venueId}`);
  return { success: true };
}
```

- [ ] **Step 5: toggleChecklistItemにvisit→venue所有権チェックを追加**

```typescript
export async function toggleChecklistItem(
  itemId: string
): Promise<{ success: boolean; checked: boolean }> {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  const item = await prisma.visitChecklistItem.findUnique({
    where: { id: itemId },
    include: { visit: { include: { venue: { select: { projectId: true } } } } },
  });
  if (!item || item.visit.venue.projectId !== projectId) {
    return { success: false, checked: false };
  }

  const newChecked = !item.checked;
  await prisma.visitChecklistItem.update({
    where: { id: itemId },
    data: { checked: newChecked, checkedAt: newChecked ? new Date() : null },
  });

  revalidatePath(`/venues/${item.visit.venue.projectId}`);
  return { success: true, checked: newChecked };
}
```

- [ ] **Step 6: ビルド確認**

Run: `cd /home/yusuke_kaya/projects/venuelens && npx tsc --noEmit`

- [ ] **Step 7: コミット**

```bash
git add src/server/actions/visits.ts
git commit -m "fix: add project ownership checks to all visit actions"
```

---

### Task 5: estimates.ts セキュリティ修正

**Files:**
- Modify: `src/server/actions/estimates.ts`

- [ ] **Step 1: getEstimatesForVenueにprojectIdフィルタ追加**

```typescript
export async function getEstimatesForVenue(venueId: string) {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  return prisma.estimate.findMany({
    where: { venueId, projectId },
    include: { items: true },
    orderBy: { version: "desc" },
  });
}
```

- [ ] **Step 2: ビルド確認**

Run: `cd /home/yusuke_kaya/projects/venuelens && npx tsc --noEmit`

- [ ] **Step 3: コミット**

```bash
git add src/server/actions/estimates.ts
git commit -m "fix: add projectId filter to getEstimatesForVenue"
```

---

### Task 6: ホーム画面 情報設計修正

**Files:**
- Modify: `src/app/(app)/home/page.tsx`
- Create: `src/components/home/journey-card.tsx`
- Delete import: `QuickActions`, `ThemeSwitcher`, `PartnerInvite` from home/page.tsx

- [ ] **Step 1: Journey Cardコンポーネント作成**

```typescript
// src/components/home/journey-card.tsx
import Link from "next/link";
import { Cloud, CloudSun, Sun, Sparkles } from "lucide-react";

interface JourneyCardProps {
  totalVenues: number;
  visitedVenues: number;
  favoriteCount: number;
  hasDecision: boolean;
  upcomingVisits: number;
}

function getJourneyState(props: JourneyCardProps) {
  const { totalVenues, visitedVenues, favoriteCount, hasDecision, upcomingVisits } = props;

  if (hasDecision) {
    return {
      icon: Sun,
      iconColor: "text-[var(--gold-warm)]",
      message: "おめでとうございます！晴れの日",
      summary: "式場が決まりました",
      cta: null,
    };
  }
  if (favoriteCount >= 2) {
    return {
      icon: CloudSun,
      iconColor: "text-[var(--gold-warm)]",
      message: "晴れ間が見えてきました",
      summary: `候補 ${favoriteCount}件`,
      cta: { label: "候補を比較する", href: "/candidates" },
    };
  }
  if (visitedVenues > 0) {
    return {
      icon: CloudSun,
      iconColor: "text-muted-foreground",
      message: "見学お疲れさまでした",
      summary: `${visitedVenues}件 見学済み`,
      cta: { label: "お気に入りに追加する", href: "/candidates" },
    };
  }
  if (totalVenues > 0) {
    return {
      icon: Cloud,
      iconColor: "text-muted-foreground",
      message: "気になる式場が見つかりましたね",
      summary: `${totalVenues}件の式場${upcomingVisits > 0 ? ` · 見学予定 ${upcomingVisits}件` : ""}`,
      cta: { label: "式場の詳細を見る", href: "/explore" },
    };
  }
  return {
    icon: Cloud,
    iconColor: "text-muted-foreground",
    message: "式場探しを始めましょう",
    summary: "まだ式場が登録されていません",
    cta: { label: "式場を探す", href: "/explore" },
  };
}

export function JourneyCard(props: JourneyCardProps) {
  const state = getJourneyState(props);
  const Icon = state.icon;

  return (
    <div className="rounded-xl bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="flex items-center gap-3 mb-3">
        <Icon className={`h-6 w-6 ${state.iconColor}`} />
        <h3 className="text-lg">{state.message}</h3>
      </div>
      <p className="text-sm text-muted-foreground mb-4">{state.summary}</p>
      {state.cta && (
        <Link
          href={state.cta.href}
          className="inline-flex items-center gap-1 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-transform active:scale-[0.98]"
        >
          {state.cta.label}
          <Sparkles className="h-3.5 w-3.5 ml-1" />
        </Link>
      )}
    </div>
  );
}
```

- [ ] **Step 2: ホームページを再構成**

`src/app/(app)/home/page.tsx` を書き換え:

```typescript
import { getHomeData } from "@/server/actions/home";
import { getAIInsights } from "@/server/actions/insights";
import { Greeting } from "@/components/home/greeting";
import { AIInsightCard } from "@/components/ai/insight-card";
import { JourneyCard } from "@/components/home/journey-card";
import { RecentVenues } from "@/components/home/recent-venues";
import { Settings } from "lucide-react";
import Link from "next/link";

export default async function HomePage() {
  const homeData = await getHomeData();
  const insights = await getAIInsights();
  const topInsight = insights[0];

  return (
    <div className="space-y-6">
      {/* Header: greeting + settings icon */}
      <div className="flex items-center justify-between">
        <Greeting userName={homeData.userName} />
        <Link
          href="/settings"
          className="flex h-11 w-11 items-center justify-center rounded-full transition-colors active:bg-muted"
          aria-label="設定"
        >
          <Settings className="h-5 w-5 text-muted-foreground" />
        </Link>
      </div>

      {/* Journey Card — the hero of home */}
      <JourneyCard
        totalVenues={homeData.progress.totalVenues}
        visitedVenues={homeData.progress.visitedVenues}
        favoriteCount={homeData.progress.favoriteCount}
        hasDecision={homeData.progress.hasDecision}
        upcomingVisits={homeData.progress.upcomingVisits ?? 0}
      />

      {/* AI Insight — if available */}
      {topInsight && (
        <AIInsightCard
          type={topInsight.type}
          title={topInsight.title}
          body={topInsight.body}
          actions={topInsight.actions}
        />
      )}

      {/* Recent venues */}
      <RecentVenues venues={homeData.recentVenues} />
    </div>
  );
}
```

- [ ] **Step 3: getHomeDataにupcomingVisitsを追加**

`src/server/actions/home.ts` の `getHomeData` 返却値に `upcomingVisits` を追加。既存の `progress` オブジェクトにフィールドを追加:

```typescript
// progress計算部分に追加
const upcomingVisits = await prisma.visit.count({
  where: {
    venue: { projectId },
    status: "scheduled",
  },
});

// returnのprogressに追加
progress: {
  ...existingProgress,
  upcomingVisits,
},
```

- [ ] **Step 4: ビルド確認**

Run: `cd /home/yusuke_kaya/projects/venuelens && npx tsc --noEmit`

- [ ] **Step 5: コミット**

```bash
git add src/components/home/journey-card.tsx src/app/\(app\)/home/page.tsx src/server/actions/home.ts
git commit -m "feat: replace QuickActions with Journey Card on home page"
```

---

### Task 7: 設定ページ充実 + 導線追加

**Files:**
- Modify: `src/app/(app)/settings/page.tsx`

- [ ] **Step 1: 設定ページにパートナー管理・テーマ・ログアウトを追加**

`src/app/(app)/settings/page.tsx` を書き換え:

```typescript
import { requireUser, requireProjectMembership } from "@/server/auth";
import { prisma } from "@/server/db";
import { SettingsForm } from "@/components/settings/settings-form";
import { ThemeSwitcher } from "@/components/settings/theme-switcher";
import { PartnerInvite } from "@/components/partner/partner-invite";
import { LogOut } from "lucide-react";
import Link from "next/link";

export default async function SettingsPage() {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { id: true, conditions: true },
  });

  const members = await prisma.projectMember.findMany({
    where: { projectId },
    include: { user: { select: { name: true, email: true } } },
  });

  const hasPartner = members.some((m) => m.role === "partner" && m.acceptedAt);
  const partner = members.find((m) => m.role === "partner");

  return (
    <div className="space-y-8">
      <h2>設定</h2>

      {/* Profile */}
      <section className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          プロフィール
        </h3>
        <div className="rounded-xl bg-card p-4 shadow-[var(--shadow-card)]">
          <p className="text-sm text-muted-foreground">メールアドレス</p>
          <p className="font-medium">{user.email}</p>
        </div>
      </section>

      {/* Partner */}
      <section className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          パートナー
        </h3>
        {hasPartner ? (
          <div className="rounded-xl bg-card p-4 shadow-[var(--shadow-card)]">
            <p className="text-sm text-muted-foreground">パートナー</p>
            <p className="font-medium">{partner?.user.name ?? partner?.user.email}</p>
            <p className="text-xs text-success mt-1">参加済み</p>
          </div>
        ) : (
          <PartnerInvite
            inviteLink={`${process.env.APP_URL || "https://venuelens.vercel.app"}/accept-invite?project=${projectId}`}
            partnerStatus={partner ? "invited" : "not_invited"}
          />
        )}
      </section>

      {/* Preferences */}
      <section className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          好み・条件
        </h3>
        <SettingsForm />
      </section>

      {/* Theme */}
      <section className="space-y-2">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          テーマ
        </h3>
        <div className="rounded-xl bg-card p-4 shadow-[var(--shadow-card)] flex items-center justify-between">
          <span className="text-sm">ダークモード</span>
          <ThemeSwitcher />
        </div>
      </section>

      {/* Logout */}
      <section>
        <form action="/api/auth/logout" method="POST">
          <button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-destructive/20 px-4 py-3 text-sm text-destructive transition-colors hover:bg-destructive/5 active:scale-[0.98]"
          >
            <LogOut className="h-4 w-4" />
            ログアウト
          </button>
        </form>
      </section>
    </div>
  );
}
```

- [ ] **Step 2: ビルド確認**

Run: `cd /home/yusuke_kaya/projects/venuelens && npx tsc --noEmit`

- [ ] **Step 3: コミット**

```bash
git add src/app/\(app\)/settings/page.tsx
git commit -m "feat: expand settings page with partner, theme, profile, logout"
```

---

### Task 8: Explore空ステート修正

**Files:**
- Modify: `src/app/(app)/explore/page.tsx`

- [ ] **Step 1: 空ステートのhref="#"を修正**

`src/app/(app)/explore/page.tsx` line 29-35 を変更:

空ステートのEmptyStateからactionを削除し、代わりにAddVenueSheetへの誘導テキストに変更:

```typescript
      {venues.length === 0 ? (
        <EmptyState
          icon={Search}
          title="まだ式場が登録されていません"
          description="上の「追加」ボタンからURLを貼り付けるか、手動で式場を登録しましょう"
        />
      ) : (
```

- [ ] **Step 2: ビルド確認**

Run: `cd /home/yusuke_kaya/projects/venuelens && npx tsc --noEmit`

- [ ] **Step 3: コミット**

```bash
git add src/app/\(app\)/explore/page.tsx
git commit -m "fix: remove broken href='#' from explore empty state"
```

---

### Task 9: Candidates 名称修正 + 比較タブ行き止まり修正

**Files:**
- Modify: `src/components/candidates/candidates-view.tsx`

- [ ] **Step 1: 「ショートリスト」→「候補」に変更**

SegmentedControlのラベルを変更。ファイル内の "ショートリスト" を "候補" に置換。

- [ ] **Step 2: 比較タブの空ステートにCTA追加**

ComparisonBoardの2件未満メッセージに候補タブ切替ボタンを追加。

- [ ] **Step 3: ビルド確認**

Run: `cd /home/yusuke_kaya/projects/venuelens && npx tsc --noEmit`

- [ ] **Step 4: コミット**

```bash
git add src/components/candidates/candidates-view.tsx
git commit -m "fix: rename shortlist to candidates, add CTA to comparison empty state"
```

---

### Task 10: VenueDetail 戻るボタン追加

**Files:**
- Modify: `src/app/(app)/venues/[id]/page.tsx`

- [ ] **Step 1: ページ上部に戻るボタン追加**

ページの先頭に戻るリンクを追加:

```typescript
import Link from "next/link";
import { ChevronLeft } from "lucide-react";

// page.tsx の return内、先頭に追加:
<Link
  href="/explore"
  className="inline-flex items-center gap-1 text-sm text-muted-foreground mb-4 -ml-1 active:opacity-70"
>
  <ChevronLeft className="h-4 w-4" />
  戻る
</Link>
```

- [ ] **Step 2: ビルド確認**

Run: `cd /home/yusuke_kaya/projects/venuelens && npx tsc --noEmit`

- [ ] **Step 3: コミット**

```bash
git add src/app/\(app\)/venues/\[id\]/page.tsx
git commit -m "fix: add back button to venue detail page"
```

---

### Task 11: 全体ビルド + lint 確認

**Files:** None (verification only)

- [ ] **Step 1: lint実行**

Run: `cd /home/yusuke_kaya/projects/venuelens && npm run lint`
Expected: No errors

- [ ] **Step 2: ビルド実行**

Run: `cd /home/yusuke_kaya/projects/venuelens && npm run build`
Expected: Build succeeds

- [ ] **Step 3: テスト実行**

Run: `cd /home/yusuke_kaya/projects/venuelens && npm test`
Expected: All tests pass
