# Phase 1: Core Comparison MVP — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the core venue comparison tool — users can register, set conditions, add venues manually, rate them, compare side-by-side with radar chart, shortlist, and make a final decision.

**Architecture:** Next.js 15 App Router with Server Components by default, "use client" only for interactive components. Prisma ORM for type-safe DB access. Supabase for auth, database, and storage. All data mutations go through Server Actions. shadcn/ui for UI components with Luxury Navy + Gold design tokens.

**Tech Stack:** Next.js 15, TypeScript, Tailwind CSS, shadcn/ui, Prisma, Supabase (PostgreSQL + Auth), Recharts, framer-motion, react-hook-form + zod, Vitest, Playwright

---

## File Structure

```
prisma/
  schema.prisma                    # All data models (Prisma schema)

src/
  app/
    layout.tsx                     # Root layout (fonts, providers, nav)
    page.tsx                       # Landing / redirect to dashboard
    globals.css                    # Tailwind + design tokens (CSS variables)
    (auth)/
      login/page.tsx               # Login page
      signup/page.tsx              # Signup page
      callback/route.ts            # Supabase auth callback
    (app)/
      layout.tsx                   # App shell (nav, progress bar)
      dashboard/page.tsx           # Dashboard (stats, next actions, venue list)
      conditions/page.tsx          # Step 1: Conditions setup
      venues/
        page.tsx                   # Step 2: Venue list + add venue
        [id]/page.tsx              # Venue detail (tabbed: overview, ratings, estimates, notes, photos)
      compare/page.tsx             # Step 4: Comparison board (matrix + radar)
      shortlist/page.tsx           # Step 5: Shortlist management
      decision/page.tsx            # Step 6: Final decision

  components/
    ui/                            # shadcn/ui components (auto-generated)
    layout/
      app-nav.tsx                  # App navigation bar
      progress-bar.tsx             # 6-step progress indicator
      mobile-bottom-nav.tsx        # Mobile bottom navigation
    venues/
      venue-card.tsx               # Venue summary card (used in lists)
      venue-form.tsx               # Add/edit venue form
      venue-status-badge.tsx       # Status badge (researching, visited, etc.)
    ratings/
      star-rating.tsx              # Reusable star rating input (1-5)
      dimension-ratings.tsx        # Rating form for all 6 Tier 1 dimensions
    compare/
      radar-chart.tsx              # Recharts radar chart wrapper
      comparison-matrix.tsx        # Side-by-side comparison table
      score-badge.tsx              # Color-coded score display (green/gold/red)
    shortlist/
      shortlist-card.tsx           # Shortlist venue card with pros/cons
    decision/
      decision-form.tsx            # Final decision form with rationale

  server/
    actions/
      auth.ts                      # Auth-related server actions
      projects.ts                  # Project CRUD
      venues.ts                    # Venue CRUD + status management
      ratings.ts                   # Save/update ratings → aggregate venue_scores
      estimates.ts                 # Estimate CRUD
      decisions.ts                 # Final decision
    db.ts                          # Prisma client singleton

  lib/
    supabase/
      client.ts                    # Browser Supabase client
      server.ts                    # Server-side Supabase client
      middleware.ts                # Auth middleware
    constants.ts                   # Enums, dimension labels, color mappings
    utils.ts                       # General utilities

  hooks/
    use-project.ts                 # Current project context hook
    use-venue-scores.ts            # Aggregated scores for a venue

  types/
    index.ts                       # Shared TypeScript types

  middleware.ts                    # Next.js middleware (auth redirect)

tests/
  unit/
    server/actions/venues.test.ts
    server/actions/ratings.test.ts
    server/actions/estimates.test.ts
    components/ratings/star-rating.test.tsx
    components/compare/radar-chart.test.tsx
    lib/constants.test.ts
  e2e/
    auth.spec.ts
    venue-crud.spec.ts
    comparison.spec.ts
```

---

## Task 1: Project Scaffolding

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `tailwind.config.ts`, `postcss.config.js`, `.prettierrc`, `.eslintrc.json`, `vitest.config.ts`, `playwright.config.ts`
- Create: `src/app/layout.tsx`, `src/app/page.tsx`, `src/app/globals.css`

- [ ] **Step 1: Initialize Next.js project**

```bash
cd /home/yusuke_kaya/projects/venuelens
npx create-next-app@latest . --typescript --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm
```

Select defaults when prompted. This creates the base Next.js 15 project with App Router.

- [ ] **Step 2: Install core dependencies**

```bash
npm install @supabase/supabase-js @supabase/ssr prisma @prisma/client recharts framer-motion react-hook-form @hookform/resolvers zod lucide-react
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/jest-dom @playwright/test prettier prettier-plugin-tailwindcss
```

- [ ] **Step 3: Configure Vitest**

Create `vitest.config.ts`:

```typescript
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./tests/setup.ts"],
    include: ["tests/unit/**/*.test.{ts,tsx}"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

Create `tests/setup.ts`:

```typescript
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 4: Configure Playwright**

Create `playwright.config.ts`:

```typescript
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    { name: "Mobile Chrome", use: { ...devices["Pixel 5"] } },
    { name: "Desktop Chrome", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
  },
});
```

- [ ] **Step 5: Add npm scripts to package.json**

Add to `scripts` in `package.json`:

```json
{
  "test": "vitest run --verbose",
  "test:watch": "vitest --verbose",
  "test:e2e": "playwright test"
}
```

- [ ] **Step 6: Set up design tokens in globals.css**

Replace `src/app/globals.css` with:

```css
@import "tailwindcss";

@layer base {
  :root {
    --color-primary: 221.2 83.2% 53.3%;        /* #1E3A8A */
    --color-on-primary: 0 0% 100%;              /* #FFFFFF */
    --color-secondary: 217.2 91.2% 59.8%;       /* #3B82F6 */
    --color-accent: 40.6 90.5% 32.9%;           /* #A16207 */
    --color-background: 210 40% 98%;             /* #F8FAFC */
    --color-foreground: 222.2 84% 4.9%;          /* #0F172A */
    --color-foreground-muted: 215.4 16.3% 46.9%; /* #64748B */
    --color-muted: 228 33.3% 93.7%;              /* #E9EEF5 */
    --color-border: 213.8 93.9% 87.8%;           /* #BFDBFE */
    --color-destructive: 0 72.2% 50.6%;          /* #DC2626 */
    --color-success: 142.1 76.2% 36.3%;          /* #16A34A */
    --color-card: 0 0% 100%;                     /* #FFFFFF */
    --color-ring: 221.2 83.2% 53.3%;             /* #1E3A8A */
    --radius: 0.75rem;
    --shadow-soft: 4px 4px 12px rgba(0,0,0,0.06), -2px -2px 8px rgba(255,255,255,0.8);
  }
}

@layer base {
  body {
    font-family: "Noto Sans JP", sans-serif;
  }

  h1, h2, h3, h4, h5, h6 {
    font-family: "Noto Serif JP", serif;
  }
}
```

- [ ] **Step 7: Set up root layout with fonts**

Replace `src/app/layout.tsx`:

```tsx
import type { Metadata, Viewport } from "next";
import { Noto_Sans_JP, Noto_Serif_JP } from "next/font/google";
import "./globals.css";

const notoSansJP = Noto_Sans_JP({
  subsets: ["latin"],
  variable: "--font-noto-sans-jp",
  display: "swap",
});

const notoSerifJP = Noto_Serif_JP({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-noto-serif-jp",
  display: "swap",
});

export const metadata: Metadata = {
  title: "VenueLens — 結婚式場比較ツール",
  description:
    "見学メモ、見積もり、口コミをひとつにまとめて、最適な式場を選べるようにする",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="ja"
      className={`${notoSansJP.variable} ${notoSerifJP.variable}`}
    >
      <body className="min-h-dvh bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
```

- [ ] **Step 8: Verify setup**

```bash
npm run build
npm test -- --passWithNoTests
```

Expected: Build succeeds, test runner finds no tests and exits cleanly.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: scaffold Next.js 15 project with design tokens and test config"
```

---

## Task 2: Prisma Schema & Database Setup

**Files:**
- Create: `prisma/schema.prisma`
- Create: `src/server/db.ts`
- Test: `tests/unit/lib/constants.test.ts`
- Create: `src/lib/constants.ts`

- [ ] **Step 1: Initialize Prisma**

```bash
npx prisma init --datasource-provider postgresql
```

- [ ] **Step 2: Write the Prisma schema**

Replace `prisma/schema.prisma`:

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider  = "postgresql"
  url       = env("DATABASE_URL")
  directUrl = env("DIRECT_URL")
}

enum ProjectRole {
  owner
  partner
}

enum VenueStatus {
  researching
  visit_scheduled
  visited
  shortlisted
  selected
  rejected
}

enum ScoreDimension {
  atmosphere
  hospitality
  cuisine
  cost
  access
  reviews
  dress
  photo_video
  flowers
  staff_continuity
  capacity
  cancellation
}

enum ScoreSource {
  zexy
  wedding_park
  hanayume
  mynavi
  minna_no_wedding
  user_rating
  ai_analysis
}

enum EstimateSourceType {
  pdf_upload
  manual
  ai_extracted
}

enum EstimateItemCategory {
  attire
  cuisine
  photo_video
  flowers
  performance
  av_equipment
  venue_fee
  other
}

enum EstimateItemTier {
  minimum
  standard
  premium
  unknown
}

enum VisitStatus {
  scheduled
  completed
  cancelled
}

enum AiAnalysisType {
  review_summary
  estimate_prediction
  comparison
  visit_prep
}

model User {
  id        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  email     String   @unique
  name      String?
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @updatedAt @map("updated_at")

  projectMembers ProjectMember[]
  visitRatings   VisitRating[]

  @@map("users")
}

model Project {
  id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  name        String
  conditions  Json?
  currentStep Int      @default(1) @map("current_step")
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")

  members    ProjectMember[]
  venues     Venue[]
  estimates  Estimate[]
  analyses   AiAnalysis[]
  decisions  Decision[]

  @@map("projects")
}

model ProjectMember {
  id         String       @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  projectId  String       @map("project_id") @db.Uuid
  userId     String       @map("user_id") @db.Uuid
  role       ProjectRole
  invitedAt  DateTime     @default(now()) @map("invited_at")
  acceptedAt DateTime?    @map("accepted_at")

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  user    User    @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([projectId, userId])
  @@map("project_members")
}

model Venue {
  id             String      @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  projectId      String      @map("project_id") @db.Uuid
  name           String
  location       String?
  accessInfo     String?     @map("access_info")
  capacityMin    Int?        @map("capacity_min")
  capacityMax    Int?        @map("capacity_max")
  ceremonyStyles String[]    @map("ceremony_styles")
  sourceUrls     String[]    @map("source_urls")
  status         VenueStatus @default(researching)
  createdAt      DateTime    @default(now()) @map("created_at")
  updatedAt      DateTime    @updatedAt @map("updated_at")

  project   Project      @relation(fields: [projectId], references: [id], onDelete: Cascade)
  scores    VenueScore[]
  estimates Estimate[]
  visits    Visit[]
  analyses  AiAnalysis[]
  decision  Decision?

  @@index([projectId])
  @@map("venues")
}

model VenueScore {
  id          String         @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  venueId     String         @map("venue_id") @db.Uuid
  dimension   ScoreDimension
  score       Decimal        @db.Decimal(2, 1)
  source      ScoreSource
  reviewCount Int            @default(0) @map("review_count")
  updatedAt   DateTime       @updatedAt @map("updated_at")

  venue Venue @relation(fields: [venueId], references: [id], onDelete: Cascade)

  @@unique([venueId, dimension, source])
  @@index([venueId])
  @@map("venue_scores")
}

model Estimate {
  id             String             @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  venueId        String             @map("venue_id") @db.Uuid
  projectId      String             @map("project_id") @db.Uuid
  version        Int                @default(1)
  total          Int
  predictedFinal Int?               @map("predicted_final")
  sourceType     EstimateSourceType @map("source_type")
  pdfUrl         String?            @map("pdf_url")
  createdAt      DateTime           @default(now()) @map("created_at")
  updatedAt      DateTime           @updatedAt @map("updated_at")

  venue   Venue          @relation(fields: [venueId], references: [id], onDelete: Cascade)
  project Project        @relation(fields: [projectId], references: [id], onDelete: Cascade)
  items   EstimateItem[]

  @@index([venueId])
  @@index([projectId])
  @@map("estimates")
}

model EstimateItem {
  id                 String               @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  estimateId         String               @map("estimate_id") @db.Uuid
  category           EstimateItemCategory
  itemName           String               @map("item_name")
  amount             Int
  tier               EstimateItemTier     @default(unknown)
  predictedUpgrade   Int?                 @map("predicted_upgrade")
  upgradeProbability Decimal?             @map("upgrade_probability") @db.Decimal(3, 2)
  createdAt          DateTime             @default(now()) @map("created_at")
  updatedAt          DateTime             @updatedAt @map("updated_at")

  estimate Estimate @relation(fields: [estimateId], references: [id], onDelete: Cascade)

  @@map("estimate_items")
}

model Visit {
  id          String      @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  venueId     String      @map("venue_id") @db.Uuid
  scheduledAt DateTime?   @map("scheduled_at")
  status      VisitStatus @default(scheduled)
  completedAt DateTime?   @map("completed_at")
  createdAt   DateTime    @default(now()) @map("created_at")
  updatedAt   DateTime    @updatedAt @map("updated_at")

  venue     Venue              @relation(fields: [venueId], references: [id], onDelete: Cascade)
  checklist VisitChecklistItem[]
  notes     VisitNote[]
  ratings   VisitRating[]

  @@index([venueId])
  @@map("visits")
}

model VisitChecklistItem {
  id        String    @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  visitId   String    @map("visit_id") @db.Uuid
  item      String
  category  String?
  checked   Boolean   @default(false)
  checkedAt DateTime? @map("checked_at")
  sortOrder Int       @default(0) @map("sort_order")

  visit Visit @relation(fields: [visitId], references: [id], onDelete: Cascade)

  @@map("visit_checklist_items")
}

model VisitNote {
  id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  visitId     String   @map("visit_id") @db.Uuid
  content     String
  tags        String[]
  locationLat Decimal? @map("location_lat") @db.Decimal(9, 6)
  locationLng Decimal? @map("location_lng") @db.Decimal(9, 6)
  createdAt   DateTime @default(now()) @map("created_at")

  visit Visit           @relation(fields: [visitId], references: [id], onDelete: Cascade)
  media VisitNoteMedia[]

  @@map("visit_notes")
}

model VisitNoteMedia {
  id          String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  visitNoteId String   @map("visit_note_id") @db.Uuid
  type        String   // "photo" or "voice"
  mediaUrl    String   @map("media_url")
  createdAt   DateTime @default(now()) @map("created_at")

  visitNote VisitNote @relation(fields: [visitNoteId], references: [id], onDelete: Cascade)

  @@map("visit_note_media")
}

model VisitRating {
  id        String         @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  visitId   String         @map("visit_id") @db.Uuid
  userId    String         @map("user_id") @db.Uuid
  dimension ScoreDimension
  score     Int
  comment   String?
  createdAt DateTime       @default(now()) @map("created_at")
  updatedAt DateTime       @updatedAt @map("updated_at")

  visit Visit @relation(fields: [visitId], references: [id], onDelete: Cascade)
  user  User  @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([visitId, userId, dimension])
  @@map("visit_ratings")
}

model AiAnalysis {
  id        String         @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  venueId   String?        @map("venue_id") @db.Uuid
  projectId String         @map("project_id") @db.Uuid
  type      AiAnalysisType
  inputHash String?        @map("input_hash")
  output    String
  createdAt DateTime       @default(now()) @map("created_at")

  venue   Venue?  @relation(fields: [venueId], references: [id], onDelete: SetNull)
  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)

  @@index([projectId, type])
  @@map("ai_analyses")
}

model Decision {
  id              String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  projectId       String   @unique @map("project_id") @db.Uuid
  selectedVenueId String   @unique @map("selected_venue_id") @db.Uuid
  rationale       String?
  decidedAt       DateTime @default(now()) @map("decided_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
  venue   Venue   @relation(fields: [selectedVenueId], references: [id])

  @@map("decisions")
}
```

- [ ] **Step 3: Create Prisma client singleton**

Create `src/server/db.ts`:

```typescript
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
```

- [ ] **Step 4: Write constants and test**

Create `src/lib/constants.ts`:

```typescript
export const TIER1_DIMENSIONS = [
  "atmosphere",
  "hospitality",
  "cuisine",
  "cost",
  "access",
  "reviews",
] as const;

export type Tier1Dimension = (typeof TIER1_DIMENSIONS)[number];

export const DIMENSION_LABELS: Record<string, string> = {
  atmosphere: "雰囲気",
  hospitality: "ホスピタリティ",
  cuisine: "料理",
  cost: "費用",
  access: "アクセス",
  reviews: "口コミ",
  dress: "衣裳",
  photo_video: "写真・映像",
  flowers: "装花",
  staff_continuity: "スタッフ",
  capacity: "収容人数",
  cancellation: "キャンセル",
};

export const SCORE_COLORS = {
  high: "text-success",   // 4.0+
  medium: "text-accent",  // 3.0-3.9
  low: "text-destructive", // <3.0
} as const;

export function getScoreColor(score: number): string {
  if (score >= 4.0) return SCORE_COLORS.high;
  if (score >= 3.0) return SCORE_COLORS.medium;
  return SCORE_COLORS.low;
}
```

Create `tests/unit/lib/constants.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import {
  TIER1_DIMENSIONS,
  DIMENSION_LABELS,
  getScoreColor,
  SCORE_COLORS,
} from "@/lib/constants";

describe("TIER1_DIMENSIONS", () => {
  it("contains exactly 6 dimensions", () => {
    expect(TIER1_DIMENSIONS).toHaveLength(6);
  });

  it("all have Japanese labels", () => {
    for (const dim of TIER1_DIMENSIONS) {
      expect(DIMENSION_LABELS[dim]).toBeDefined();
      expect(DIMENSION_LABELS[dim].length).toBeGreaterThan(0);
    }
  });
});

describe("getScoreColor", () => {
  it("returns high for scores >= 4.0", () => {
    expect(getScoreColor(4.0)).toBe(SCORE_COLORS.high);
    expect(getScoreColor(5.0)).toBe(SCORE_COLORS.high);
  });

  it("returns medium for scores 3.0-3.9", () => {
    expect(getScoreColor(3.0)).toBe(SCORE_COLORS.medium);
    expect(getScoreColor(3.9)).toBe(SCORE_COLORS.medium);
  });

  it("returns low for scores < 3.0", () => {
    expect(getScoreColor(2.9)).toBe(SCORE_COLORS.low);
    expect(getScoreColor(1.0)).toBe(SCORE_COLORS.low);
  });
});
```

- [ ] **Step 5: Run test to verify it passes**

```bash
npm test -- tests/unit/lib/constants.test.ts --verbose
```

Expected: All 4 tests pass.

- [ ] **Step 6: Generate Prisma client and verify build**

```bash
npx prisma generate
npm run build
```

Expected: Prisma client generated, build succeeds.

- [ ] **Step 7: Commit**

```bash
git add prisma/schema.prisma src/server/db.ts src/lib/constants.ts tests/unit/lib/constants.test.ts
git commit -m "feat: add Prisma schema with all data models and constants"
```

---

## Task 3: Supabase Auth Setup

**Files:**
- Create: `src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`, `src/lib/supabase/middleware.ts`
- Create: `src/middleware.ts`
- Create: `src/app/(auth)/login/page.tsx`, `src/app/(auth)/signup/page.tsx`, `src/app/(auth)/callback/route.ts`
- Create: `src/server/actions/auth.ts`

- [ ] **Step 1: Install shadcn/ui and init**

```bash
npx shadcn@latest init -d
npx shadcn@latest add button input label card
```

- [ ] **Step 2: Create Supabase browser client**

Create `src/lib/supabase/client.ts`:

```typescript
import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
```

- [ ] **Step 3: Create Supabase server client**

Create `src/lib/supabase/server.ts`:

```typescript
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Server Component — ignore
          }
        },
      },
    },
  );
}
```

- [ ] **Step 4: Create auth middleware**

Create `src/lib/supabase/middleware.ts`:

```typescript
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (
    !user &&
    !request.nextUrl.pathname.startsWith("/login") &&
    !request.nextUrl.pathname.startsWith("/signup") &&
    !request.nextUrl.pathname.startsWith("/callback")
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
```

Create `src/middleware.ts`:

```typescript
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
```

- [ ] **Step 5: Create auth callback route**

Create `src/app/(auth)/callback/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/dashboard";

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}
```

- [ ] **Step 6: Create login page**

Create `src/app/(auth)/login/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError("メールアドレスまたはパスワードが正しくありません");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-[var(--shadow-soft)]">
        <CardHeader className="text-center">
          <CardTitle className="font-serif text-2xl text-primary">
            VenueLens
          </CardTitle>
          <p className="text-sm text-foreground-muted">
            結婚式場比較ツールにログイン
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">メールアドレス</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">パスワード</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="パスワードを入力"
              />
            </div>
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "ログイン中..." : "ログイン"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-foreground-muted">
            アカウントをお持ちでない方は{" "}
            <Link href="/signup" className="text-primary underline">
              新規登録
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 7: Create signup page**

Create `src/app/(auth)/signup/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });

    if (error) {
      setError("登録に失敗しました。別のメールアドレスをお試しください");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md shadow-[var(--shadow-soft)]">
        <CardHeader className="text-center">
          <CardTitle className="font-serif text-2xl text-primary">
            VenueLens
          </CardTitle>
          <p className="text-sm text-foreground-muted">
            新規アカウントを作成
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignup} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">お名前</Label>
              <Input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="山田 太郎"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">メールアドレス</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">パスワード</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                placeholder="8文字以上のパスワード"
              />
            </div>
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "登録中..." : "アカウントを作成"}
            </Button>
          </form>
          <p className="mt-4 text-center text-sm text-foreground-muted">
            すでにアカウントをお持ちの方は{" "}
            <Link href="/login" className="text-primary underline">
              ログイン
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 8: Create user sync server action**

Create `src/server/actions/auth.ts`:

```typescript
"use server";

import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/server/db";

export async function syncUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const dbUser = await prisma.user.upsert({
    where: { id: user.id },
    update: {
      email: user.email!,
      name: user.user_metadata?.name ?? null,
    },
    create: {
      id: user.id,
      email: user.email!,
      name: user.user_metadata?.name ?? null,
    },
  });

  return dbUser;
}

export async function getProjectForUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const membership = await prisma.projectMember.findFirst({
    where: { userId: user.id, acceptedAt: { not: null } },
    include: { project: true },
    orderBy: { project: { updatedAt: "desc" } },
  });

  return membership?.project ?? null;
}
```

- [ ] **Step 9: Verify build**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 10: Commit**

```bash
git add src/lib/supabase/ src/middleware.ts src/app/\(auth\)/ src/server/actions/auth.ts
git commit -m "feat: add Supabase auth with login, signup, and user sync"
```

---

## Task 4: App Shell (Navigation + Progress Bar)

**Files:**
- Create: `src/app/(app)/layout.tsx`
- Create: `src/components/layout/app-nav.tsx`, `src/components/layout/progress-bar.tsx`, `src/components/layout/mobile-bottom-nav.tsx`
- Create: `src/app/(app)/dashboard/page.tsx`
- Create: `src/server/actions/projects.ts`

This task builds the app shell that wraps all authenticated pages: top nav, 6-step progress bar, and mobile bottom nav.

- [ ] **Step 1: Create project server actions**

Create `src/server/actions/projects.ts`:

```typescript
"use server";

import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/server/db";
import { redirect } from "next/navigation";

export async function getOrCreateProject() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Ensure user exists in DB
  await prisma.user.upsert({
    where: { id: user.id },
    update: { email: user.email! },
    create: { id: user.id, email: user.email!, name: user.user_metadata?.name },
  });

  // Find existing project membership
  const membership = await prisma.projectMember.findFirst({
    where: { userId: user.id, acceptedAt: { not: null } },
    include: { project: { include: { venues: true } } },
    orderBy: { project: { updatedAt: "desc" } },
  });

  if (membership) return membership.project;

  // Create new project + owner membership
  const project = await prisma.project.create({
    data: {
      name: "わたしたちの式場選び",
      members: {
        create: {
          userId: user.id,
          role: "owner",
          acceptedAt: new Date(),
        },
      },
    },
    include: { venues: true },
  });

  return project;
}

export async function updateProjectStep(projectId: string, step: number) {
  await prisma.project.update({
    where: { id: projectId },
    data: { currentStep: step },
  });
}
```

- [ ] **Step 2: Create progress bar component**

Create `src/components/layout/progress-bar.tsx`:

```tsx
"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

const STEPS = [
  { number: 1, label: "条件設定" },
  { number: 2, label: "式場探索" },
  { number: 3, label: "見学" },
  { number: 4, label: "比較" },
  { number: 5, label: "絞り込み" },
  { number: 6, label: "決定" },
];

interface ProgressBarProps {
  currentStep: number;
}

export function ProgressBar({ currentStep }: ProgressBarProps) {
  return (
    <div className="flex items-center justify-between gap-1 px-4 py-3">
      {STEPS.map((step, index) => (
        <div key={step.number} className="flex flex-1 items-center">
          <div className="flex flex-col items-center">
            <div
              className={cn(
                "flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold",
                step.number < currentStep &&
                  "bg-primary text-on-primary",
                step.number === currentStep &&
                  "bg-primary text-on-primary",
                step.number > currentStep &&
                  "bg-border text-foreground-muted",
              )}
            >
              {step.number < currentStep ? (
                <Check className="h-3.5 w-3.5" />
              ) : (
                step.number
              )}
            </div>
            <span
              className={cn(
                "mt-1 text-[10px]",
                step.number <= currentStep
                  ? "font-semibold text-primary"
                  : "text-foreground-muted",
              )}
            >
              {step.label}
            </span>
          </div>
          {index < STEPS.length - 1 && (
            <div
              className={cn(
                "mx-1 mb-4 h-0.5 flex-1",
                step.number < currentStep ? "bg-primary" : "bg-border",
              )}
            />
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Create app navigation**

Create `src/components/layout/app-nav.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, BarChart3, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";

export function AppNav() {
  const router = useRouter();
  const supabase = createClient();

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <nav className="flex items-center justify-between bg-primary px-4 py-3">
      <Link
        href="/dashboard"
        className="font-serif text-lg font-bold text-on-primary"
      >
        VenueLens
      </Link>
      <div className="flex items-center gap-4">
        <Link
          href="/venues"
          className="flex items-center gap-1 text-xs text-blue-200 hover:text-white"
        >
          <Search className="h-3.5 w-3.5" />
          式場探索
        </Link>
        <Link
          href="/compare"
          className="flex items-center gap-1 text-xs text-blue-200 hover:text-white"
        >
          <BarChart3 className="h-3.5 w-3.5" />
          比較
        </Link>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleSignOut}
          className="text-blue-200 hover:text-white"
        >
          <LogOut className="h-3.5 w-3.5" />
        </Button>
      </div>
    </nav>
  );
}
```

- [ ] **Step 4: Create mobile bottom nav**

Create `src/components/layout/mobile-bottom-nav.tsx`:

```tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Search, BarChart3, Star, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "ホーム", icon: Home },
  { href: "/venues", label: "式場", icon: Search },
  { href: "/compare", label: "比較", icon: BarChart3 },
  { href: "/shortlist", label: "候補", icon: Star },
  { href: "/decision", label: "決定", icon: CheckCircle },
];

export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card md:hidden">
      <div className="flex items-center justify-around py-2">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-1",
                isActive ? "text-primary" : "text-foreground-muted",
              )}
            >
              <item.icon className="h-5 w-5" />
              <span className="text-[10px]">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
```

- [ ] **Step 5: Create app layout**

Create `src/app/(app)/layout.tsx`:

```tsx
import { AppNav } from "@/components/layout/app-nav";
import { ProgressBar } from "@/components/layout/progress-bar";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { getOrCreateProject } from "@/server/actions/projects";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const project = await getOrCreateProject();

  return (
    <div className="min-h-dvh bg-background pb-16 md:pb-0">
      <AppNav />
      <ProgressBar currentStep={project.currentStep} />
      <main className="mx-auto max-w-5xl px-4 py-4">{children}</main>
      <MobileBottomNav />
    </div>
  );
}
```

- [ ] **Step 6: Create dashboard page**

Create `src/app/(app)/dashboard/page.tsx`:

```tsx
import { getOrCreateProject } from "@/server/actions/projects";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function DashboardPage() {
  const project = await getOrCreateProject();
  const venueCount = project.venues?.length ?? 0;

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-xl font-bold text-primary">
        ダッシュボード
      </h1>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Card className="shadow-[var(--shadow-soft)]">
          <CardContent className="p-4">
            <p className="text-xs text-foreground-muted">候補式場</p>
            <p className="text-2xl font-bold text-primary">{venueCount}</p>
          </CardContent>
        </Card>
        <Card className="shadow-[var(--shadow-soft)]">
          <CardContent className="p-4">
            <p className="text-xs text-foreground-muted">現在のステップ</p>
            <p className="text-2xl font-bold text-secondary">
              {project.currentStep}
              <span className="text-sm text-foreground-muted"> / 6</span>
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      {venueCount === 0 ? (
        <Card className="shadow-[var(--shadow-soft)]">
          <CardHeader>
            <CardTitle className="font-serif text-lg">はじめましょう</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-foreground-muted">
              まずは気になる式場を追加してみましょう。
            </p>
            <Button asChild>
              <Link href="/venues">
                <Plus className="mr-2 h-4 w-4" />
                式場を追加する
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-[var(--shadow-soft)]">
          <CardHeader>
            <CardTitle className="font-serif text-lg">候補一覧</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-foreground-muted">
              {venueCount}件の式場が登録されています。
            </p>
            <div className="mt-3 flex gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href="/venues">式場を見る</Link>
              </Button>
              {venueCount >= 2 && (
                <Button asChild size="sm">
                  <Link href="/compare">比較する</Link>
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

- [ ] **Step 7: Update root page to redirect**

Replace `src/app/page.tsx`:

```tsx
import { redirect } from "next/navigation";

export default function Home() {
  redirect("/dashboard");
}
```

- [ ] **Step 8: Verify build**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 9: Commit**

```bash
git add src/app/\(app\)/ src/components/layout/ src/server/actions/projects.ts src/app/page.tsx
git commit -m "feat: add app shell with navigation, progress bar, and dashboard"
```

---

## Task 5: Venue CRUD (Add, List, Detail)

**Files:**
- Create: `src/server/actions/venues.ts`
- Create: `src/components/venues/venue-form.tsx`, `src/components/venues/venue-card.tsx`, `src/components/venues/venue-status-badge.tsx`
- Create: `src/app/(app)/venues/page.tsx`, `src/app/(app)/venues/[id]/page.tsx`
- Test: `tests/unit/server/actions/venues.test.ts`

- [ ] **Step 1: Write the failing test for venue actions**

Create `tests/unit/server/actions/venues.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Prisma
vi.mock("@/server/db", () => ({
  prisma: {
    venue: {
      create: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}));

import { prisma } from "@/server/db";

// We test the pure logic functions, not the server actions directly
// (server actions depend on auth context)
import {
  validateVenueInput,
  type VenueInput,
} from "@/server/actions/venues";

describe("validateVenueInput", () => {
  it("returns valid for correct input", () => {
    const input: VenueInput = {
      name: "アニヴェルセル表参道",
      location: "東京都港区北青山3-5-30",
      capacityMin: 40,
      capacityMax: 120,
    };
    const result = validateVenueInput(input);
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const input: VenueInput = { name: "" };
    const result = validateVenueInput(input);
    expect(result.success).toBe(false);
  });

  it("rejects capacityMin > capacityMax", () => {
    const input: VenueInput = {
      name: "Test Venue",
      capacityMin: 200,
      capacityMax: 50,
    };
    const result = validateVenueInput(input);
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/unit/server/actions/venues.test.ts --verbose
```

Expected: FAIL — `validateVenueInput` not found.

- [ ] **Step 3: Implement venue server actions**

Create `src/server/actions/venues.ts`:

```typescript
"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/server/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const venueSchema = z
  .object({
    name: z.string().min(1, "式場名は必須です"),
    location: z.string().optional(),
    accessInfo: z.string().optional(),
    capacityMin: z.coerce.number().int().positive().optional(),
    capacityMax: z.coerce.number().int().positive().optional(),
    ceremonyStyles: z.array(z.string()).optional(),
    sourceUrls: z.array(z.string().url()).optional(),
  })
  .refine(
    (data) => {
      if (data.capacityMin && data.capacityMax) {
        return data.capacityMin <= data.capacityMax;
      }
      return true;
    },
    { message: "最小人数は最大人数以下にしてください" },
  );

export type VenueInput = z.input<typeof venueSchema>;

export function validateVenueInput(input: VenueInput) {
  return venueSchema.safeParse(input);
}

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return user;
}

async function requireProjectId(userId: string) {
  const membership = await prisma.projectMember.findFirst({
    where: { userId, acceptedAt: { not: null } },
    select: { projectId: true },
  });
  if (!membership) redirect("/dashboard");
  return membership.projectId;
}

export async function createVenue(input: VenueInput) {
  const validation = venueSchema.safeParse(input);
  if (!validation.success) {
    return { error: validation.error.flatten().fieldErrors };
  }

  const user = await requireUser();
  const projectId = await requireProjectId(user.id);

  const venue = await prisma.venue.create({
    data: {
      projectId,
      name: validation.data.name,
      location: validation.data.location ?? null,
      accessInfo: validation.data.accessInfo ?? null,
      capacityMin: validation.data.capacityMin ?? null,
      capacityMax: validation.data.capacityMax ?? null,
      ceremonyStyles: validation.data.ceremonyStyles ?? [],
      sourceUrls: validation.data.sourceUrls ?? [],
    },
  });

  revalidatePath("/venues");
  revalidatePath("/dashboard");
  return { venue };
}

export async function getVenues() {
  const user = await requireUser();
  const projectId = await requireProjectId(user.id);

  return prisma.venue.findMany({
    where: { projectId },
    include: { scores: { where: { source: "user_rating" } } },
    orderBy: { createdAt: "desc" },
  });
}

export async function getVenue(id: string) {
  const user = await requireUser();
  const projectId = await requireProjectId(user.id);

  return prisma.venue.findUnique({
    where: { id, projectId },
    include: {
      scores: true,
      estimates: { include: { items: true }, orderBy: { version: "desc" } },
      visits: {
        include: { ratings: true, notes: { include: { media: true } } },
        orderBy: { scheduledAt: "desc" },
      },
    },
  });
}

export async function updateVenueStatus(
  id: string,
  status: "researching" | "visit_scheduled" | "visited" | "shortlisted" | "selected" | "rejected",
) {
  const user = await requireUser();
  const projectId = await requireProjectId(user.id);

  await prisma.venue.update({
    where: { id, projectId },
    data: { status },
  });

  revalidatePath("/venues");
  revalidatePath(`/venues/${id}`);
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- tests/unit/server/actions/venues.test.ts --verbose
```

Expected: All 3 tests pass.

- [ ] **Step 5: Create venue UI components**

Create `src/components/venues/venue-status-badge.tsx`:

```tsx
import { cn } from "@/lib/utils";

const STATUS_MAP: Record<string, { label: string; className: string }> = {
  researching: { label: "調査中", className: "bg-muted text-foreground-muted" },
  visit_scheduled: { label: "見学予定", className: "bg-amber-100 text-amber-800" },
  visited: { label: "見学済み", className: "bg-blue-100 text-primary" },
  shortlisted: { label: "候補", className: "bg-green-100 text-green-800" },
  selected: { label: "決定", className: "bg-primary text-on-primary" },
  rejected: { label: "見送り", className: "bg-red-100 text-destructive" },
};

export function VenueStatusBadge({ status }: { status: string }) {
  const config = STATUS_MAP[status] ?? STATUS_MAP.researching;
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold",
        config.className,
      )}
    >
      {config.label}
    </span>
  );
}
```

Create `src/components/venues/venue-card.tsx`:

```tsx
import Link from "next/link";
import { MapPin, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { VenueStatusBadge } from "./venue-status-badge";
import { getScoreColor } from "@/lib/constants";

interface VenueCardProps {
  id: string;
  name: string;
  location: string | null;
  capacityMin: number | null;
  capacityMax: number | null;
  status: string;
  averageScore: number | null;
}

export function VenueCard({
  id,
  name,
  location,
  capacityMin,
  capacityMax,
  status,
  averageScore,
}: VenueCardProps) {
  return (
    <Link href={`/venues/${id}`}>
      <Card className="shadow-[var(--shadow-soft)] transition-shadow hover:shadow-md">
        <CardContent className="flex items-center gap-3 p-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-border to-secondary/30">
            <MapPin className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-primary">{name}</span>
              <VenueStatusBadge status={status} />
            </div>
            <div className="mt-1 flex items-center gap-3 text-xs text-foreground-muted">
              {location && <span>{location}</span>}
              {capacityMin && capacityMax && (
                <span className="flex items-center gap-0.5">
                  <Users className="h-3 w-3" />
                  {capacityMin}〜{capacityMax}名
                </span>
              )}
            </div>
          </div>
          {averageScore !== null && (
            <div className="text-right">
              <span className={`text-lg font-bold ${getScoreColor(averageScore)}`}>
                {averageScore.toFixed(1)}
              </span>
            </div>
          )}
        </CardContent>
      </Card>
    </Link>
  );
}
```

Create `src/components/venues/venue-form.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createVenue, type VenueInput } from "@/server/actions/venues";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function VenueForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const input: VenueInput = {
      name: formData.get("name") as string,
      location: (formData.get("location") as string) || undefined,
      accessInfo: (formData.get("accessInfo") as string) || undefined,
      capacityMin: formData.get("capacityMin")
        ? Number(formData.get("capacityMin"))
        : undefined,
      capacityMax: formData.get("capacityMax")
        ? Number(formData.get("capacityMax"))
        : undefined,
    };

    const result = await createVenue(input);

    if ("error" in result) {
      setError("入力内容を確認してください");
      setLoading(false);
      return;
    }

    router.push(`/venues/${result.venue.id}`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">式場名 *</Label>
        <Input id="name" name="name" required placeholder="例: アニヴェルセル表参道" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="location">所在地</Label>
        <Input id="location" name="location" placeholder="例: 東京都港区北青山3-5-30" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="accessInfo">アクセス</Label>
        <Input
          id="accessInfo"
          name="accessInfo"
          placeholder="例: 表参道駅A1出口から徒歩3分"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label htmlFor="capacityMin">最小人数</Label>
          <Input
            id="capacityMin"
            name="capacityMin"
            type="number"
            inputMode="numeric"
            min={1}
            placeholder="例: 40"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="capacityMax">最大人数</Label>
          <Input
            id="capacityMax"
            name="capacityMax"
            type="number"
            inputMode="numeric"
            min={1}
            placeholder="例: 120"
          />
        </div>
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? "追加中..." : "式場を追加"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 6: Create venue list page**

Create `src/app/(app)/venues/page.tsx`:

```tsx
import { getVenues } from "@/server/actions/venues";
import { VenueCard } from "@/components/venues/venue-card";
import { VenueForm } from "@/components/venues/venue-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function VenuesPage() {
  const venues = await getVenues();

  function getAverageScore(venue: (typeof venues)[number]): number | null {
    const userScores = venue.scores.filter((s) => s.source === "user_rating");
    if (userScores.length === 0) return null;
    const sum = userScores.reduce((acc, s) => acc + Number(s.score), 0);
    return sum / userScores.length;
  }

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-xl font-bold text-primary">式場探索</h1>

      {/* Add venue form */}
      <Card className="shadow-[var(--shadow-soft)]">
        <CardHeader>
          <CardTitle className="font-serif text-base">式場を追加</CardTitle>
        </CardHeader>
        <CardContent>
          <VenueForm />
        </CardContent>
      </Card>

      {/* Venue list */}
      {venues.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-serif text-base font-semibold text-primary">
            登録済みの式場（{venues.length}件）
          </h2>
          {venues.map((venue) => (
            <VenueCard
              key={venue.id}
              id={venue.id}
              name={venue.name}
              location={venue.location}
              capacityMin={venue.capacityMin}
              capacityMax={venue.capacityMax}
              status={venue.status}
              averageScore={getAverageScore(venue)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 7: Create venue detail page (placeholder — expanded in Task 6)**

Create `src/app/(app)/venues/[id]/page.tsx`:

```tsx
import { notFound } from "next/navigation";
import { getVenue } from "@/server/actions/venues";
import { VenueStatusBadge } from "@/components/venues/venue-status-badge";
import { MapPin, Users, ExternalLink } from "lucide-react";

export default async function VenueDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const venue = await getVenue(id);

  if (!venue) notFound();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2">
          <h1 className="font-serif text-xl font-bold text-primary">
            {venue.name}
          </h1>
          <VenueStatusBadge status={venue.status} />
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-3 text-sm text-foreground-muted">
          {venue.location && (
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" />
              {venue.location}
            </span>
          )}
          {venue.capacityMin && venue.capacityMax && (
            <span className="flex items-center gap-1">
              <Users className="h-3.5 w-3.5" />
              {venue.capacityMin}〜{venue.capacityMax}名
            </span>
          )}
        </div>
        {venue.sourceUrls.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {venue.sourceUrls.map((url, i) => (
              <a
                key={i}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-secondary hover:underline"
              >
                <ExternalLink className="h-3 w-3" />
                参照元 {i + 1}
              </a>
            ))}
          </div>
        )}
      </div>

      {/* Placeholder for tabs — rating, estimates, notes will be added in subsequent tasks */}
      <p className="text-sm text-foreground-muted">
        評価・見積もり・メモ機能は次のタスクで追加されます。
      </p>
    </div>
  );
}
```

- [ ] **Step 8: Verify build**

```bash
npm run lint && npm test --verbose && npm run build
```

Expected: Lint clean, tests pass, build succeeds.

- [ ] **Step 9: Commit**

```bash
git add src/server/actions/venues.ts src/components/venues/ src/app/\(app\)/venues/ tests/unit/server/actions/venues.test.ts
git commit -m "feat: add venue CRUD with list, detail, and form"
```

---

## Task 6: Star Rating & Dimension Ratings

**Files:**
- Create: `src/components/ratings/star-rating.tsx`, `src/components/ratings/dimension-ratings.tsx`
- Create: `src/server/actions/ratings.ts`
- Test: `tests/unit/server/actions/ratings.test.ts`, `tests/unit/components/ratings/star-rating.test.tsx`

- [ ] **Step 1: Write failing test for star rating component**

Create `tests/unit/components/ratings/star-rating.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StarRating } from "@/components/ratings/star-rating";

describe("StarRating", () => {
  it("renders 5 stars", () => {
    render(<StarRating value={0} onChange={() => {}} />);
    const stars = screen.getAllByRole("button");
    expect(stars).toHaveLength(5);
  });

  it("highlights filled stars based on value", () => {
    render(<StarRating value={3} onChange={() => {}} />);
    const stars = screen.getAllByRole("button");
    // First 3 should have aria-pressed=true
    expect(stars[0]).toHaveAttribute("aria-pressed", "true");
    expect(stars[1]).toHaveAttribute("aria-pressed", "true");
    expect(stars[2]).toHaveAttribute("aria-pressed", "true");
    expect(stars[3]).toHaveAttribute("aria-pressed", "false");
    expect(stars[4]).toHaveAttribute("aria-pressed", "false");
  });

  it("calls onChange with clicked star value", () => {
    const onChange = vi.fn();
    render(<StarRating value={0} onChange={onChange} />);
    const stars = screen.getAllByRole("button");
    fireEvent.click(stars[3]); // 4th star = value 4
    expect(onChange).toHaveBeenCalledWith(4);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/unit/components/ratings/star-rating.test.tsx --verbose
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement star rating component**

Create `src/components/ratings/star-rating.tsx`:

```tsx
"use client";

import { Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StarRatingProps {
  value: number;
  onChange: (value: number) => void;
  size?: "sm" | "md";
  disabled?: boolean;
}

export function StarRating({
  value,
  onChange,
  size = "md",
  disabled = false,
}: StarRatingProps) {
  const iconSize = size === "sm" ? "h-4 w-4" : "h-5 w-5";

  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          role="button"
          aria-label={`${star}点`}
          aria-pressed={star <= value}
          disabled={disabled}
          onClick={() => onChange(star)}
          className={cn(
            "rounded p-0.5 transition-colors",
            !disabled && "cursor-pointer hover:scale-110",
            disabled && "cursor-default",
          )}
        >
          <Star
            className={cn(
              iconSize,
              star <= value
                ? "fill-accent text-accent"
                : "fill-none text-border",
            )}
          />
        </button>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- tests/unit/components/ratings/star-rating.test.tsx --verbose
```

Expected: All 3 tests pass.

- [ ] **Step 5: Write failing test for rating actions**

Create `tests/unit/server/actions/ratings.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { validateRatingInput } from "@/server/actions/ratings";

describe("validateRatingInput", () => {
  it("accepts valid ratings", () => {
    const result = validateRatingInput({
      ratings: { atmosphere: 4, hospitality: 5, cuisine: 3 },
    });
    expect(result.success).toBe(true);
  });

  it("rejects scores outside 1-5 range", () => {
    const result = validateRatingInput({
      ratings: { atmosphere: 0 },
    });
    expect(result.success).toBe(false);
  });

  it("rejects scores above 5", () => {
    const result = validateRatingInput({
      ratings: { atmosphere: 6 },
    });
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 6: Run test to verify it fails**

```bash
npm test -- tests/unit/server/actions/ratings.test.ts --verbose
```

Expected: FAIL — module not found.

- [ ] **Step 7: Implement rating server actions**

Create `src/server/actions/ratings.ts`:

```typescript
"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/server/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { TIER1_DIMENSIONS } from "@/lib/constants";
import type { ScoreDimension } from "@prisma/client";

const ratingSchema = z.object({
  ratings: z.record(
    z.string(),
    z.number().int().min(1, "1以上で評価してください").max(5, "5以下で評価してください"),
  ),
});

export type RatingInput = z.input<typeof ratingSchema>;

export function validateRatingInput(input: RatingInput) {
  return ratingSchema.safeParse(input);
}

export async function saveRatings(
  venueId: string,
  visitId: string,
  input: RatingInput,
) {
  const validation = ratingSchema.safeParse(input);
  if (!validation.success) {
    return { error: validation.error.flatten() };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { ratings } = validation.data;

  // Upsert each dimension rating
  for (const [dimension, score] of Object.entries(ratings)) {
    await prisma.visitRating.upsert({
      where: {
        visitId_userId_dimension: {
          visitId,
          userId: user.id,
          dimension: dimension as ScoreDimension,
        },
      },
      update: { score },
      create: {
        visitId,
        userId: user.id,
        dimension: dimension as ScoreDimension,
        score,
      },
    });
  }

  // Aggregate user ratings into venue_scores
  await aggregateVenueScores(venueId, user.id);

  revalidatePath(`/venues/${venueId}`);
  revalidatePath("/compare");
  return { success: true };
}

async function aggregateVenueScores(venueId: string, userId: string) {
  // Get all visit ratings for this venue by this user
  const visits = await prisma.visit.findMany({
    where: { venueId },
    include: { ratings: { where: { userId } } },
  });

  const scores: Record<string, number[]> = {};
  for (const visit of visits) {
    for (const rating of visit.ratings) {
      if (!scores[rating.dimension]) scores[rating.dimension] = [];
      scores[rating.dimension].push(rating.score);
    }
  }

  // Upsert averaged scores into venue_scores
  for (const [dimension, values] of Object.entries(scores)) {
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    await prisma.venueScore.upsert({
      where: {
        venueId_dimension_source: {
          venueId,
          dimension: dimension as ScoreDimension,
          source: "user_rating",
        },
      },
      update: { score: avg },
      create: {
        venueId,
        dimension: dimension as ScoreDimension,
        source: "user_rating",
        score: avg,
      },
    });
  }
}
```

- [ ] **Step 8: Run test to verify it passes**

```bash
npm test -- tests/unit/server/actions/ratings.test.ts --verbose
```

Expected: All 3 tests pass.

- [ ] **Step 9: Create dimension ratings component**

Create `src/components/ratings/dimension-ratings.tsx`:

```tsx
"use client";

import { useState } from "react";
import { StarRating } from "./star-rating";
import { TIER1_DIMENSIONS, DIMENSION_LABELS } from "@/lib/constants";
import { saveRatings, type RatingInput } from "@/server/actions/ratings";
import { Button } from "@/components/ui/button";

interface DimensionRatingsProps {
  venueId: string;
  visitId: string;
  initialRatings?: Record<string, number>;
}

export function DimensionRatings({
  venueId,
  visitId,
  initialRatings = {},
}: DimensionRatingsProps) {
  const [ratings, setRatings] = useState<Record<string, number>>(initialRatings);
  const [saving, setSaving] = useState(false);

  function handleChange(dimension: string, score: number) {
    setRatings((prev) => ({ ...prev, [dimension]: score }));
  }

  async function handleSave() {
    setSaving(true);
    await saveRatings(venueId, visitId, { ratings });
    setSaving(false);
  }

  return (
    <div className="space-y-3">
      {TIER1_DIMENSIONS.map((dim) => (
        <div key={dim} className="flex items-center justify-between">
          <span className="text-sm font-medium text-foreground">
            {DIMENSION_LABELS[dim]}
          </span>
          <StarRating
            value={ratings[dim] ?? 0}
            onChange={(score) => handleChange(dim, score)}
            size="sm"
          />
        </div>
      ))}
      <Button
        onClick={handleSave}
        disabled={saving || Object.keys(ratings).length === 0}
        className="w-full"
        size="sm"
      >
        {saving ? "保存中..." : "評価を保存"}
      </Button>
    </div>
  );
}
```

- [ ] **Step 10: Verify build**

```bash
npm run lint && npm test --verbose && npm run build
```

Expected: All tests pass, build succeeds.

- [ ] **Step 11: Commit**

```bash
git add src/components/ratings/ src/server/actions/ratings.ts tests/unit/
git commit -m "feat: add star rating component and dimension rating system"
```

---

## Task 7: Comparison Board (Radar Chart + Matrix)

**Files:**
- Create: `src/components/compare/radar-chart.tsx`, `src/components/compare/comparison-matrix.tsx`, `src/components/compare/score-badge.tsx`
- Create: `src/app/(app)/compare/page.tsx`
- Test: `tests/unit/components/compare/radar-chart.test.tsx`

- [ ] **Step 1: Write failing test for radar chart**

Create `tests/unit/components/compare/radar-chart.test.tsx`:

```tsx
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { VenueRadarChart, type RadarChartData } from "@/components/compare/radar-chart";

describe("VenueRadarChart", () => {
  it("renders with venue data", () => {
    const data: RadarChartData[] = [
      {
        venueName: "アニヴェルセル",
        color: "#1E3A8A",
        scores: { atmosphere: 4.5, hospitality: 4.8, cuisine: 4.2, cost: 3.2, access: 4.0, reviews: 4.5 },
      },
    ];
    render(<VenueRadarChart data={data} />);
    // Recharts renders an SVG
    const svg = document.querySelector("svg");
    expect(svg).toBeTruthy();
  });

  it("renders nothing when data is empty", () => {
    const { container } = render(<VenueRadarChart data={[]} />);
    expect(container.querySelector("svg")).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- tests/unit/components/compare/radar-chart.test.tsx --verbose
```

Expected: FAIL — module not found.

- [ ] **Step 3: Implement radar chart**

Create `src/components/compare/radar-chart.tsx`:

```tsx
"use client";

import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { TIER1_DIMENSIONS, DIMENSION_LABELS } from "@/lib/constants";

export interface RadarChartData {
  venueName: string;
  color: string;
  scores: Partial<Record<string, number>>;
}

interface VenueRadarChartProps {
  data: RadarChartData[];
}

const VENUE_COLORS = ["#1E3A8A", "#3B82F6", "#A16207"];

export function VenueRadarChart({ data }: VenueRadarChartProps) {
  if (data.length === 0) return null;

  const chartData = TIER1_DIMENSIONS.map((dim) => {
    const point: Record<string, string | number> = {
      dimension: DIMENSION_LABELS[dim],
    };
    data.forEach((venue) => {
      point[venue.venueName] = venue.scores[dim] ?? 0;
    });
    return point;
  });

  return (
    <ResponsiveContainer width="100%" height={300}>
      <RadarChart data={chartData}>
        <PolarGrid stroke="#BFDBFE" />
        <PolarAngleAxis
          dataKey="dimension"
          tick={{ fontSize: 11, fill: "#64748B" }}
        />
        <PolarRadiusAxis
          angle={90}
          domain={[0, 5]}
          tick={{ fontSize: 10 }}
          tickCount={6}
        />
        {data.map((venue, index) => (
          <Radar
            key={venue.venueName}
            name={venue.venueName}
            dataKey={venue.venueName}
            stroke={venue.color || VENUE_COLORS[index % VENUE_COLORS.length]}
            fill={venue.color || VENUE_COLORS[index % VENUE_COLORS.length]}
            fillOpacity={0.15}
            strokeWidth={2}
          />
        ))}
        <Legend />
      </RadarChart>
    </ResponsiveContainer>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npm test -- tests/unit/components/compare/radar-chart.test.tsx --verbose
```

Expected: Both tests pass.

- [ ] **Step 5: Create score badge and comparison matrix**

Create `src/components/compare/score-badge.tsx`:

```tsx
import { getScoreColor } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function ScoreBadge({ score }: { score: number | null }) {
  if (score === null) return <span className="text-foreground-muted">—</span>;
  return (
    <span className={cn("font-semibold", getScoreColor(score))}>
      {score.toFixed(1)}
    </span>
  );
}
```

Create `src/components/compare/comparison-matrix.tsx`:

```tsx
import { TIER1_DIMENSIONS, DIMENSION_LABELS } from "@/lib/constants";
import { ScoreBadge } from "./score-badge";

interface VenueData {
  id: string;
  name: string;
  scores: Record<string, number | null>;
  estimateTotal: number | null;
  estimatePredicted: number | null;
  capacityMin: number | null;
  capacityMax: number | null;
  status: string;
}

interface ComparisonMatrixProps {
  venues: VenueData[];
}

function formatYen(amount: number | null): string {
  if (amount === null) return "—";
  return `¥${(amount / 10000).toFixed(0)}万`;
}

export function ComparisonMatrix({ venues }: ComparisonMatrixProps) {
  if (venues.length === 0) return null;

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted">
            <th className="px-3 py-2 text-left font-semibold text-foreground-muted">
              項目
            </th>
            {venues.map((v) => (
              <th
                key={v.id}
                className="px-3 py-2 text-center font-semibold text-primary"
              >
                {v.name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {TIER1_DIMENSIONS.map((dim) => (
            <tr key={dim} className="border-t border-muted">
              <td className="px-3 py-2 text-foreground-muted">
                {DIMENSION_LABELS[dim]}
              </td>
              {venues.map((v) => (
                <td key={v.id} className="px-3 py-2 text-center">
                  <ScoreBadge score={v.scores[dim] ?? null} />
                </td>
              ))}
            </tr>
          ))}
          <tr className="border-t border-muted">
            <td className="px-3 py-2 text-foreground-muted">初期見積もり</td>
            {venues.map((v) => (
              <td key={v.id} className="px-3 py-2 text-center font-semibold">
                {formatYen(v.estimateTotal)}
              </td>
            ))}
          </tr>
          <tr className="border-t border-muted bg-amber-50">
            <td className="px-3 py-2 text-foreground-muted">最終予測額</td>
            {venues.map((v) => (
              <td
                key={v.id}
                className="px-3 py-2 text-center font-bold text-accent"
              >
                {formatYen(v.estimatePredicted)}
              </td>
            ))}
          </tr>
          <tr className="border-t border-muted">
            <td className="px-3 py-2 text-foreground-muted">収容人数</td>
            {venues.map((v) => (
              <td key={v.id} className="px-3 py-2 text-center">
                {v.capacityMin && v.capacityMax
                  ? `${v.capacityMin}〜${v.capacityMax}名`
                  : "—"}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 6: Create comparison page**

Create `src/app/(app)/compare/page.tsx`:

```tsx
import { getVenues } from "@/server/actions/venues";
import { VenueRadarChart, type RadarChartData } from "@/components/compare/radar-chart";
import { ComparisonMatrix } from "@/components/compare/comparison-matrix";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TIER1_DIMENSIONS } from "@/lib/constants";

const VENUE_COLORS = ["#1E3A8A", "#3B82F6", "#A16207"];

export default async function ComparePage() {
  const venues = await getVenues();

  if (venues.length < 2) {
    return (
      <div className="space-y-6">
        <h1 className="font-serif text-xl font-bold text-primary">比較ボード</h1>
        <Card className="shadow-[var(--shadow-soft)]">
          <CardContent className="p-6 text-center">
            <p className="text-foreground-muted">
              比較するには2件以上の式場を登録してください。
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Build chart data
  const radarData: RadarChartData[] = venues.map((venue, index) => {
    const scores: Record<string, number> = {};
    for (const dim of TIER1_DIMENSIONS) {
      const score = venue.scores.find(
        (s) => s.dimension === dim && s.source === "user_rating",
      );
      scores[dim] = score ? Number(score.score) : 0;
    }
    return {
      venueName: venue.name,
      color: VENUE_COLORS[index % VENUE_COLORS.length],
      scores,
    };
  });

  // Build matrix data
  const matrixData = venues.map((venue) => {
    const scores: Record<string, number | null> = {};
    for (const dim of TIER1_DIMENSIONS) {
      const score = venue.scores.find(
        (s) => s.dimension === dim && s.source === "user_rating",
      );
      scores[dim] = score ? Number(score.score) : null;
    }
    return {
      id: venue.id,
      name: venue.name,
      scores,
      estimateTotal: null as number | null,
      estimatePredicted: null as number | null,
      capacityMin: venue.capacityMin,
      capacityMax: venue.capacityMax,
      status: venue.status,
    };
  });

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-xl font-bold text-primary">比較ボード</h1>

      {/* Radar chart */}
      <Card className="shadow-[var(--shadow-soft)]">
        <CardHeader>
          <CardTitle className="font-serif text-base">
            総合比較（レーダーチャート）
          </CardTitle>
        </CardHeader>
        <CardContent>
          <VenueRadarChart data={radarData} />
        </CardContent>
      </Card>

      {/* Comparison matrix */}
      <Card className="shadow-[var(--shadow-soft)]">
        <CardHeader>
          <CardTitle className="font-serif text-base">詳細比較</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <ComparisonMatrix venues={matrixData} />
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 7: Verify build**

```bash
npm run lint && npm test --verbose && npm run build
```

Expected: All tests pass, build succeeds.

- [ ] **Step 8: Commit**

```bash
git add src/components/compare/ src/app/\(app\)/compare/ tests/unit/components/compare/
git commit -m "feat: add comparison board with radar chart and matrix"
```

---

## Task 8: Shortlist & Decision Pages

**Files:**
- Create: `src/components/shortlist/shortlist-card.tsx`
- Create: `src/components/decision/decision-form.tsx`
- Create: `src/app/(app)/shortlist/page.tsx`, `src/app/(app)/decision/page.tsx`
- Create: `src/server/actions/decisions.ts`

- [ ] **Step 1: Create decision server actions**

Create `src/server/actions/decisions.ts`:

```typescript
"use server";

import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { prisma } from "@/server/db";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

const decisionSchema = z.object({
  selectedVenueId: z.string().uuid("式場を選択してください"),
  rationale: z.string().optional(),
});

export async function makeDecision(input: z.input<typeof decisionSchema>) {
  const validation = decisionSchema.safeParse(input);
  if (!validation.success) {
    return { error: validation.error.flatten().fieldErrors };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const membership = await prisma.projectMember.findFirst({
    where: { userId: user.id, role: "owner", acceptedAt: { not: null } },
    select: { projectId: true },
  });
  if (!membership) return { error: { _form: ["プロジェクトオーナーのみ決定できます"] } };

  // Update venue status
  await prisma.venue.update({
    where: { id: validation.data.selectedVenueId },
    data: { status: "selected" },
  });

  // Create or update decision
  const decision = await prisma.decision.upsert({
    where: { projectId: membership.projectId },
    update: {
      selectedVenueId: validation.data.selectedVenueId,
      rationale: validation.data.rationale ?? null,
    },
    create: {
      projectId: membership.projectId,
      selectedVenueId: validation.data.selectedVenueId,
      rationale: validation.data.rationale ?? null,
    },
  });

  revalidatePath("/decision");
  revalidatePath("/dashboard");
  revalidatePath("/venues");
  return { decision };
}

export async function getDecision() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const membership = await prisma.projectMember.findFirst({
    where: { userId: user.id, acceptedAt: { not: null } },
    select: { projectId: true },
  });
  if (!membership) return null;

  return prisma.decision.findUnique({
    where: { projectId: membership.projectId },
    include: { venue: true },
  });
}
```

- [ ] **Step 2: Create shortlist card**

Create `src/components/shortlist/shortlist-card.tsx`:

```tsx
import { Card, CardContent } from "@/components/ui/card";
import { ScoreBadge } from "@/components/compare/score-badge";
import { TIER1_DIMENSIONS, DIMENSION_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface ShortlistCardProps {
  name: string;
  scores: Record<string, number | null>;
  isTopChoice?: boolean;
  onSelect?: () => void;
  selected?: boolean;
}

export function ShortlistCard({
  name,
  scores,
  isTopChoice,
  onSelect,
  selected,
}: ShortlistCardProps) {
  const avgScore =
    Object.values(scores).filter((s): s is number => s !== null).length > 0
      ? Object.values(scores)
          .filter((s): s is number => s !== null)
          .reduce((a, b) => a + b, 0) /
        Object.values(scores).filter((s): s is number => s !== null).length
      : null;

  return (
    <Card
      className={cn(
        "shadow-[var(--shadow-soft)] transition-all",
        selected && "border-2 border-primary",
        onSelect && "cursor-pointer hover:shadow-md",
      )}
      onClick={onSelect}
    >
      <CardContent className="p-5">
        {isTopChoice && (
          <span className="mb-2 inline-block rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-on-primary">
            本命
          </span>
        )}
        <h3 className="font-serif text-base font-bold text-primary">{name}</h3>
        {avgScore !== null && (
          <div className="mt-1 text-2xl font-bold text-accent">
            {avgScore.toFixed(1)}
            <span className="ml-1 text-xs font-normal text-foreground-muted">
              総合スコア
            </span>
          </div>
        )}
        <div className="mt-3 space-y-1 text-xs">
          {TIER1_DIMENSIONS.map((dim) => {
            const score = scores[dim];
            if (score === null || score === undefined) return null;
            return (
              <div key={dim} className="flex justify-between">
                <span className="text-foreground-muted">
                  {DIMENSION_LABELS[dim]}
                </span>
                <ScoreBadge score={score} />
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
```

- [ ] **Step 3: Create shortlist page**

Create `src/app/(app)/shortlist/page.tsx`:

```tsx
import { getVenues } from "@/server/actions/venues";
import { ShortlistCard } from "@/components/shortlist/shortlist-card";
import { Card, CardContent } from "@/components/ui/card";
import { TIER1_DIMENSIONS } from "@/lib/constants";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function ShortlistPage() {
  const allVenues = await getVenues();
  const shortlisted = allVenues.filter((v) =>
    ["shortlisted", "selected"].includes(v.status),
  );

  if (shortlisted.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="font-serif text-xl font-bold text-primary">
          最終候補
        </h1>
        <Card className="shadow-[var(--shadow-soft)]">
          <CardContent className="p-6 text-center">
            <p className="text-foreground-muted">
              まだ候補がありません。式場一覧からステータスを「候補」に変更してください。
            </p>
            <Button asChild className="mt-3" variant="outline">
              <Link href="/venues">式場一覧へ</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-serif text-xl font-bold text-primary">
          最終候補
        </h1>
        {shortlisted.length >= 1 && (
          <Button asChild size="sm">
            <Link href="/decision">決定へ進む</Link>
          </Button>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {shortlisted.map((venue, index) => {
          const scores: Record<string, number | null> = {};
          for (const dim of TIER1_DIMENSIONS) {
            const score = venue.scores.find(
              (s) => s.dimension === dim && s.source === "user_rating",
            );
            scores[dim] = score ? Number(score.score) : null;
          }
          return (
            <ShortlistCard
              key={venue.id}
              name={venue.name}
              scores={scores}
              isTopChoice={index === 0}
            />
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Create decision form**

Create `src/components/decision/decision-form.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { makeDecision } from "@/server/actions/decisions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface DecisionFormProps {
  venues: { id: string; name: string }[];
  currentDecisionVenueId?: string;
}

export function DecisionForm({
  venues,
  currentDecisionVenueId,
}: DecisionFormProps) {
  const [selectedId, setSelectedId] = useState(currentDecisionVenueId ?? "");
  const [rationale, setRationale] = useState("");
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId) return;
    setSaving(true);

    const result = await makeDecision({
      selectedVenueId: selectedId,
      rationale: rationale || undefined,
    });

    if ("decision" in result) {
      router.refresh();
    }
    setSaving(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label>式場を選択</Label>
        <div className="space-y-2">
          {venues.map((venue) => (
            <label
              key={venue.id}
              className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors ${
                selectedId === venue.id
                  ? "border-primary bg-blue-50"
                  : "border-border"
              }`}
            >
              <input
                type="radio"
                name="venue"
                value={venue.id}
                checked={selectedId === venue.id}
                onChange={() => setSelectedId(venue.id)}
                className="accent-primary"
              />
              <span className="font-medium text-primary">{venue.name}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="rationale">決定理由（任意）</Label>
        <textarea
          id="rationale"
          value={rationale}
          onChange={(e) => setRationale(e.target.value)}
          className="w-full rounded-xl border border-border bg-background p-3 text-sm"
          rows={4}
          placeholder="後から振り返れるように、決定理由を残しておきましょう..."
        />
      </div>

      <Button
        type="submit"
        className="w-full bg-accent text-white hover:bg-accent/90"
        disabled={!selectedId || saving}
      >
        {saving ? "保存中..." : "この式場に決定する"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 5: Create decision page**

Create `src/app/(app)/decision/page.tsx`:

```tsx
import { getVenues } from "@/server/actions/venues";
import { getDecision } from "@/server/actions/decisions";
import { DecisionForm } from "@/components/decision/decision-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle } from "lucide-react";

export default async function DecisionPage() {
  const [allVenues, decision] = await Promise.all([
    getVenues(),
    getDecision(),
  ]);

  const shortlisted = allVenues.filter((v) =>
    ["shortlisted", "selected"].includes(v.status),
  );

  if (decision) {
    return (
      <div className="space-y-6">
        <h1 className="font-serif text-xl font-bold text-primary">
          決定しました
        </h1>
        <Card className="border-primary bg-gradient-to-br from-primary to-blue-800 text-white shadow-lg">
          <CardContent className="p-6 text-center">
            <CheckCircle className="mx-auto mb-3 h-12 w-12 text-accent" />
            <h2 className="font-serif text-2xl font-bold">
              {decision.venue.name}
            </h2>
            {decision.rationale && (
              <p className="mt-3 text-sm text-blue-200">
                {decision.rationale}
              </p>
            )}
            <p className="mt-4 text-xs text-blue-300">
              {new Date(decision.decidedAt).toLocaleDateString("ja-JP")} に決定
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="font-serif text-xl font-bold text-primary">最終決定</h1>
      <Card className="shadow-[var(--shadow-soft)]">
        <CardHeader>
          <CardTitle className="font-serif text-base">
            おふたりでじっくり話し合って決めましょう
          </CardTitle>
        </CardHeader>
        <CardContent>
          {shortlisted.length > 0 ? (
            <DecisionForm
              venues={shortlisted.map((v) => ({ id: v.id, name: v.name }))}
            />
          ) : (
            <p className="text-sm text-foreground-muted">
              まず候補を絞り込んでください。
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
```

- [ ] **Step 6: Verify build**

```bash
npm run lint && npm test --verbose && npm run build
```

Expected: All tests pass, build succeeds.

- [ ] **Step 7: Commit**

```bash
git add src/components/shortlist/ src/components/decision/ src/app/\(app\)/shortlist/ src/app/\(app\)/decision/ src/server/actions/decisions.ts
git commit -m "feat: add shortlist and final decision pages"
```

---

## Task 9: Conditions Setup Page

**Files:**
- Create: `src/app/(app)/conditions/page.tsx`
- Modify: `src/server/actions/projects.ts` (add updateConditions)

- [ ] **Step 1: Add updateConditions server action**

Add to `src/server/actions/projects.ts`:

```typescript
export async function updateConditions(
  projectId: string,
  conditions: {
    area?: string[];
    dateRange?: string;
    guestCount?: number;
    budget?: { min: number; max: number };
    style?: string[];
  },
) {
  await prisma.project.update({
    where: { id: projectId },
    data: { conditions, currentStep: 2 },
  });

  revalidatePath("/dashboard");
  revalidatePath("/conditions");
}
```

Add `import { revalidatePath } from "next/cache";` to the imports if not already present.

- [ ] **Step 2: Create conditions page**

Create `src/app/(app)/conditions/page.tsx`:

```tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateConditions } from "@/server/actions/projects";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const AREAS = [
  "東京（表参道・青山）",
  "東京（その他）",
  "横浜・湘南",
  "千葉・埼玉",
  "関西",
  "その他",
];

const STYLES = ["チャペル", "神前式", "人前式", "ガーデン", "レストラン"];

export default function ConditionsPage() {
  const [areas, setAreas] = useState<string[]>([]);
  const [dateRange, setDateRange] = useState("");
  const [guestCount, setGuestCount] = useState(70);
  const [budgetMin, setBudgetMin] = useState(3000000);
  const [budgetMax, setBudgetMax] = useState(5000000);
  const [styles, setStyles] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  function toggleChip(list: string[], item: string, setter: (v: string[]) => void) {
    setter(list.includes(item) ? list.filter((i) => i !== item) : [...list, item]);
  }

  async function handleSave() {
    setSaving(true);
    // projectId will be resolved server-side
    await updateConditions("current", {
      area: areas,
      dateRange,
      guestCount,
      budget: { min: budgetMin, max: budgetMax },
      style: styles,
    });
    router.push("/venues");
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="font-serif text-xl font-bold text-primary">
          おふたりの理想を教えてください
        </h1>
        <p className="mt-1 text-sm text-foreground-muted">
          すべて任意です。後からいつでも変更できます。
        </p>
      </div>

      {/* Area */}
      <Card className="shadow-[var(--shadow-soft)]">
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-primary">
            希望エリア
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {AREAS.map((area) => (
              <button
                key={area}
                type="button"
                onClick={() => toggleChip(areas, area, setAreas)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                  areas.includes(area)
                    ? "bg-primary text-on-primary"
                    : "border border-border bg-white text-foreground",
                )}
              >
                {area}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Guest count */}
      <Card className="shadow-[var(--shadow-soft)]">
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-primary">
            ゲスト人数（目安）
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={20}
              max={200}
              value={guestCount}
              onChange={(e) => setGuestCount(Number(e.target.value))}
              className="flex-1 accent-primary"
            />
            <div className="min-w-[60px] rounded-lg border border-border px-3 py-1 text-center font-semibold text-primary">
              {guestCount}名
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Budget */}
      <Card className="shadow-[var(--shadow-soft)]">
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-primary">
            予算の目安
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">下限</Label>
              <Input
                type="number"
                value={budgetMin}
                onChange={(e) => setBudgetMin(Number(e.target.value))}
                step={500000}
              />
            </div>
            <div>
              <Label className="text-xs">上限</Label>
              <Input
                type="number"
                value={budgetMax}
                onChange={(e) => setBudgetMax(Number(e.target.value))}
                step={500000}
              />
            </div>
          </div>
          <p className="text-[11px] text-foreground-muted">
            ※ 初期見積もりから平均+100万円程度上がる傾向があります
          </p>
        </CardContent>
      </Card>

      {/* Style */}
      <Card className="shadow-[var(--shadow-soft)]">
        <CardHeader>
          <CardTitle className="text-sm font-semibold text-primary">
            挙式スタイル
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {STYLES.map((style) => (
              <button
                key={style}
                type="button"
                onClick={() => toggleChip(styles, style, setStyles)}
                className={cn(
                  "rounded-full px-3 py-1.5 text-xs font-medium transition-colors",
                  styles.includes(style)
                    ? "bg-primary text-on-primary"
                    : "border border-border bg-white text-foreground",
                )}
              >
                {style}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex gap-3">
        <Button
          variant="outline"
          className="flex-1"
          onClick={() => router.push("/venues")}
        >
          スキップして式場を探す
        </Button>
        <Button className="flex-1" onClick={handleSave} disabled={saving}>
          {saving ? "保存中..." : "保存して次へ"}
        </Button>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

```bash
npm run lint && npm run build
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/app/\(app\)/conditions/ src/server/actions/projects.ts
git commit -m "feat: add conditions setup page with skip option"
```

---

## Task 10: E2E Test & Final Verification

**Files:**
- Create: `tests/e2e/venue-crud.spec.ts`

- [ ] **Step 1: Create basic E2E test**

Create `tests/e2e/venue-crud.spec.ts`:

```typescript
import { test, expect } from "@playwright/test";

test.describe("Venue CRUD", () => {
  // Note: E2E tests require a running Supabase instance with test user
  // Skip in CI unless SUPABASE_URL is configured
  test.skip(
    () => !process.env.NEXT_PUBLIC_SUPABASE_URL,
    "Supabase not configured",
  );

  test("redirects unauthenticated users to login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/login/);
  });

  test("login page renders correctly", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("text=VenueLens")).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expect(page.locator('input[type="password"]')).toBeVisible();
  });
});
```

- [ ] **Step 2: Run all unit tests**

```bash
npm test --verbose
```

Expected: All unit tests pass.

- [ ] **Step 3: Run build**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 4: Run lint**

```bash
npm run lint
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add tests/e2e/
git commit -m "test: add E2E test scaffolding for venue CRUD"
```

- [ ] **Step 6: Push migration to database (when Supabase is configured)**

```bash
npx prisma migrate dev --name initial_schema
```

Expected: Migration created and applied.

- [ ] **Step 7: Final commit for Phase 1**

```bash
git add -A
git commit -m "chore: Phase 1 MVP complete — core comparison functionality"
```
