/**
 * seed-demo.ts — Populate a target user's Haretoki project with rich demo
 * data so a partner experiences a "full" app on first login.
 *
 * Usage:
 *   npx tsx scripts/seed-demo.ts --email you@example.com --confirm
 *
 * Behavior:
 * - Finds the user by (lowercased) email
 * - Ensures they have a Project (creates one if missing)
 * - Idempotent: re-running replaces previous seed data (venues marked with
 *   notes: "SEED"). Real user venues are NEVER touched.
 * - Requires --confirm before mutating the DB.
 *
 * Unsplash URLs are hotlinks. They may change in the future — refresh by
 * editing the `photos` arrays below if images 404.
 */

// Load .env.local first (Next.js convention), falling back to .env.
// Using dynamic require to avoid pulling in a dep if not installed.
/* eslint-disable @typescript-eslint/no-require-imports */
import * as fs from "node:fs";
import * as path from "node:path";

function loadEnvFile(file: string) {
  if (!fs.existsSync(file)) return;
  const content = fs.readFileSync(file, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
    if (!m) continue;
    const key = m[1];
    let val = m[2];
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
    if (!(key in process.env)) process.env[key] = val;
  }
}
const repoRoot = path.resolve(__dirname, "..");
loadEnvFile(path.join(repoRoot, ".env.local"));
loadEnvFile(path.join(repoRoot, ".env"));

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const SEED_MARKER = "SEED";

// ---------- CLI args ----------
function parseArgs(argv: string[]) {
  const args: { email?: string; confirm: boolean; help: boolean } = {
    confirm: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--help" || a === "-h") args.help = true;
    else if (a === "--confirm") args.confirm = true;
    else if (a === "--email") args.email = argv[++i];
    else if (a.startsWith("--email=")) args.email = a.slice("--email=".length);
  }
  return args;
}

function printHelp() {
  console.log(`
seed-demo.ts — populate a user's Haretoki project with demo data

Usage:
  npx tsx scripts/seed-demo.ts --email <user@example.com> --confirm

Options:
  --email <addr>   Target user's email (required, case-insensitive)
  --confirm        Required to actually write data
  --help, -h       Show this help

Notes:
  - User must already exist (sign up first at /signup).
  - Idempotent: re-running replaces venues marked as seed data.
  - Real (non-seed) venues are preserved.
`);
}

// ---------- Prisma bootstrap ----------
function makePrisma(): PrismaClient {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set. Check .env.local");
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter }) as unknown as PrismaClient;
}

// ---------- Seed data definitions ----------

type SeedVenue = {
  name: string;
  location: string;
  accessInfo: string;
  capacityMin: number;
  capacityMax: number;
  ceremonyStyles: string[];
  photos: string[];
  costMin: number;
  costMax: number;
  paymentMethods: string[];
  paymentMethodEnums: ("credit_card" | "cash" | "bank_transfer" | "installment")[];
  maxInstallments: number | null;
  dressBringIn: "allowed" | "not_allowed" | "negotiable";
  dressBringInFee: number | null;
  scores: Record<string, number>; // dimension -> score
  hasEstimate: boolean;
  hasPlans: boolean;
  favorite: boolean;
  reviews: SeedReview[];
};

type SeedReview = {
  source: "zexy" | "wedding_park" | "hanayume" | "mynavi" | "minna_no_wedding";
  rating: number;
  aiSummary: string;
  categorySummary: Record<string, string>;
  isNegative: boolean;
  estimateIncrease?: {
    initial: number;
    final: number;
    deltaYen: number;
    deltaPct: number;
    confidence: "low" | "medium" | "high";
    note: string;
  };
};

const UNSPLASH = {
  chapel1: "https://images.unsplash.com/photo-1519741497674-611481863552?w=1200",
  chapel2: "https://images.unsplash.com/photo-1525772764200-be829a350797?w=1200",
  chapel3: "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?w=1200",
  garden1: "https://images.unsplash.com/photo-1464207687429-7505649dae38?w=1200",
  garden2: "https://images.unsplash.com/photo-1519225421980-715cb0215aed?w=1200",
  garden3: "https://images.unsplash.com/photo-1532712938310-34cb3982ef74?w=1200",
  hotel1: "https://images.unsplash.com/photo-1582719508461-905c673771fd?w=1200",
  hotel2: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200",
  hotel3: "https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=1200",
  modern1: "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=1200",
  modern2: "https://images.unsplash.com/photo-1465495976277-4387d4b0b4c6?w=1200",
  modern3: "https://images.unsplash.com/photo-1522673607200-164d1b6ce486?w=1200",
};

const SEED_VENUES: SeedVenue[] = [
  {
    name: "アーカンジェル代官山",
    location: "東京都渋谷区",
    accessInfo: "代官山駅から徒歩4分 / 恵比寿駅から徒歩8分",
    capacityMin: 30,
    capacityMax: 120,
    ceremonyStyles: ["chapel", "christian"],
    photos: [UNSPLASH.chapel1, UNSPLASH.chapel2, UNSPLASH.chapel3],
    costMin: 3_200_000,
    costMax: 4_500_000,
    paymentMethods: ["カード", "現金"],
    paymentMethodEnums: ["credit_card", "cash"],
    maxInstallments: null,
    dressBringIn: "not_allowed",
    dressBringInFee: null,
    scores: { atmosphere: 4.8, cuisine: 4.3, hospitality: 4.6, cost: 3.6, access: 4.5 },
    hasEstimate: true,
    hasPlans: true,
    favorite: true,
    reviews: [
      {
        source: "zexy",
        rating: 4.6,
        aiSummary: "大聖堂の天井高とパイプオルガンの生演奏が印象的。ゲストからの評価も非常に高い。",
        categorySummary: {
          service: "プランナーの提案力が高く、相談しやすい雰囲気だった。",
          cuisine: "コース料理のボリュームと見た目に満足の声多数。",
          atmosphere: "挙式会場の荘厳さは都内屈指との評価。",
          estimate_increase: "料理と装花のグレードアップで約60万円上乗せされた。",
        },
        isNegative: false,
        estimateIncrease: {
          initial: 2_800_000,
          final: 3_400_000,
          deltaYen: 600_000,
          deltaPct: 21.4,
          confidence: "high",
          note: "料理と装花のアップグレードで60万円ほど上乗せされた。",
        },
      },
      {
        source: "hanayume",
        rating: 4.4,
        aiSummary: "ブライズルームが広く、親族控え室の動線も良好。",
        categorySummary: {
          service: "当日のサービススタッフの目配りが細やか。",
          atmosphere: "バージンロードの長さが印象的。",
        },
        isNegative: false,
      },
      {
        source: "wedding_park",
        rating: 3.2,
        aiSummary: "持ち込み料が高めで、衣裳は提携先からしか選べない点が不満だった。",
        categorySummary: {
          estimate_increase: "提携先縛りでドレス代が想定より30万円高くなった。",
        },
        isNegative: true,
        estimateIncrease: {
          initial: 2_700_000,
          final: 3_500_000,
          deltaYen: 800_000,
          deltaPct: 29.6,
          confidence: "medium",
          note: "衣裳の提携縛りとアイテム追加で想定超え。",
        },
      },
    ],
  },
  {
    name: "ザ・ガーデンオリエンタル青山",
    location: "東京都港区",
    accessInfo: "表参道駅から徒歩7分 / 外苑前駅から徒歩6分",
    capacityMin: 40,
    capacityMax: 100,
    ceremonyStyles: ["garden", "resort"],
    photos: [UNSPLASH.garden1, UNSPLASH.garden2, UNSPLASH.garden3],
    costMin: 2_800_000,
    costMax: 4_000_000,
    paymentMethods: ["カード", "現金", "分割"],
    paymentMethodEnums: ["credit_card", "cash", "installment"],
    maxInstallments: 3,
    dressBringIn: "negotiable",
    dressBringInFee: 50_000,
    scores: { atmosphere: 4.6, cuisine: 4.5, hospitality: 4.4, cost: 4.0, access: 4.2 },
    hasEstimate: true,
    hasPlans: true,
    favorite: true,
    reviews: [
      {
        source: "mynavi",
        rating: 4.5,
        aiSummary: "青山の真ん中とは思えない緑豊かなガーデン。ナチュラル派におすすめ。",
        categorySummary: {
          atmosphere: "緑に囲まれたガーデン挙式が魅力。",
          cuisine: "シェフのオリジナルメニュー対応が柔軟。",
          estimate_increase: "装花のボリュームアップで40万円ほど増えた。",
        },
        isNegative: false,
        estimateIncrease: {
          initial: 2_900_000,
          final: 3_300_000,
          deltaYen: 400_000,
          deltaPct: 13.8,
          confidence: "high",
          note: "装花のグレードアップが主因。",
        },
      },
      {
        source: "zexy",
        rating: 4.2,
        aiSummary: "スタッフの対応が丁寧。見学時から一貫性のある提案だった。",
        categorySummary: {
          service: "プランナー変更がなく安心感があった。",
        },
        isNegative: false,
      },
    ],
  },
  {
    name: "ホテル椿山荘東京",
    location: "東京都文京区",
    accessInfo: "目白駅・江戸川橋駅からバス / 送迎バスあり",
    capacityMin: 60,
    capacityMax: 180,
    ceremonyStyles: ["chapel", "hotel"],
    photos: [UNSPLASH.hotel1, UNSPLASH.hotel2, UNSPLASH.hotel3],
    costMin: 4_000_000,
    costMax: 6_000_000,
    paymentMethods: ["カード", "現金", "振込"],
    paymentMethodEnums: ["credit_card", "cash", "bank_transfer"],
    maxInstallments: null,
    dressBringIn: "allowed",
    dressBringInFee: 100_000,
    scores: { atmosphere: 4.7, cuisine: 4.7, hospitality: 4.8, cost: 3.2, access: 3.8 },
    hasEstimate: true,
    hasPlans: false,
    favorite: true,
    reviews: [
      {
        source: "zexy",
        rating: 4.7,
        aiSummary: "庭園の雰囲気と料理の完成度が圧倒的。ゲストに誇れる式場。",
        categorySummary: {
          cuisine: "料理は和洋ともに評価が非常に高い。",
          atmosphere: "3万坪の庭園と蛍の演出が特別感を演出。",
          service: "ベテランスタッフが多く安心感がある。",
          estimate_increase: "全体的にグレードが高く、追加は比較的少なめだった。",
        },
        isNegative: false,
        estimateIncrease: {
          initial: 4_200_000,
          final: 4_500_000,
          deltaYen: 300_000,
          deltaPct: 7.1,
          confidence: "medium",
          note: "元々のクラスが高いため追加幅は小さめ。",
        },
      },
      {
        source: "minna_no_wedding",
        rating: 4.8,
        aiSummary: "どのポイントを取っても老舗の格式を感じた。",
        categorySummary: {
          atmosphere: "庭園と日本の四季を感じる挙式が可能。",
        },
        isNegative: false,
      },
    ],
  },
  {
    name: "ラ・トゥール代官山",
    location: "東京都渋谷区",
    accessInfo: "代官山駅から徒歩6分",
    capacityMin: 40,
    capacityMax: 80,
    ceremonyStyles: ["restaurant", "modern"],
    photos: [UNSPLASH.modern1, UNSPLASH.modern2, UNSPLASH.modern3],
    costMin: 2_500_000,
    costMax: 3_500_000,
    paymentMethods: ["カード", "現金"],
    paymentMethodEnums: ["credit_card", "cash"],
    maxInstallments: null,
    dressBringIn: "negotiable",
    dressBringInFee: 0,
    scores: { atmosphere: 4.3, cuisine: 4.6, hospitality: 4.2, cost: 4.3, access: 4.5 },
    hasEstimate: false,
    hasPlans: false,
    favorite: false,
    reviews: [
      {
        source: "hanayume",
        rating: 4.3,
        aiSummary: "料理ファーストのレストランウェディング。少人数でもサマになる。",
        categorySummary: {
          cuisine: "フレンチの質が高く、料理重視の二人に最適。",
          atmosphere: "モダンで洗練された内装。",
        },
        isNegative: false,
      },
      {
        source: "wedding_park",
        rating: 3.8,
        aiSummary: "収容人数が少なめで招待客が多いと難しい。",
        categorySummary: {
          atmosphere: "アットホームだが親族が多いと手狭。",
        },
        isNegative: true,
      },
    ],
  },
];

// ---------- Helpers ----------

async function ensureProject(prisma: PrismaClient, userId: string) {
  const existing = await prisma.projectMember.findFirst({
    where: { userId, role: "owner" },
    include: { project: true },
  });
  if (existing) {
    return existing.project;
  }
  console.log("  (no project yet — creating one)");
  const project = await prisma.project.create({
    data: {
      name: "わたしたちの結婚式",
      conditions: {
        style: ["chapel", "garden"],
        area: ["東京都"],
        guestCount: 80,
        budget: { min: 2_500_000, max: 4_000_000 },
      },
      members: {
        create: {
          userId,
          role: "owner",
          acceptedAt: new Date(),
        },
      },
    },
  });
  return project;
}

async function upsertProjectConditions(prisma: PrismaClient, projectId: string) {
  await prisma.project.update({
    where: { id: projectId },
    data: {
      conditions: {
        style: ["chapel", "garden"],
        area: ["東京都"],
        guestCount: 80,
        budget: { min: 2_500_000, max: 4_000_000 },
      },
    },
  });
}

async function wipeSeedVenues(prisma: PrismaClient, projectId: string) {
  const res = await prisma.venue.deleteMany({
    where: { projectId, status: "researching", AND: [{ sourceUrls: { has: `seed:${SEED_MARKER}` } }] },
  });
  if (res.count > 0) console.log(`  removed ${res.count} prior seed venues (cascade cleaned children)`);
}

async function countNonSeedVenues(prisma: PrismaClient, projectId: string) {
  return prisma.venue.count({
    where: {
      projectId,
      NOT: { sourceUrls: { has: `seed:${SEED_MARKER}` } },
    },
  });
}

// Mirror of server/actions/reviews.ts aggregation logic (kept inline so this
// script doesn't import server-only modules).
function aggregateReviewEstimate(reviews: SeedReview[]) {
  const withData = reviews.filter((r) => r.estimateIncrease);
  if (withData.length === 0) {
    return { deltaYen: null, deltaPct: null, sampleCount: 0 };
  }
  const deltaYenAvg = Math.round(
    withData.reduce((s, r) => s + r.estimateIncrease!.deltaYen, 0) / withData.length,
  );
  const deltaPctAvg =
    withData.reduce((s, r) => s + r.estimateIncrease!.deltaPct, 0) / withData.length;
  return {
    deltaYen: deltaYenAvg,
    deltaPct: Math.round(deltaPctAvg * 100) / 100,
    sampleCount: withData.length,
  };
}

async function seedVenue(
  prisma: PrismaClient,
  projectId: string,
  userId: string,
  v: SeedVenue,
) {
  const venue = await prisma.venue.create({
    data: {
      projectId,
      name: v.name,
      location: v.location,
      accessInfo: v.accessInfo,
      capacityMin: v.capacityMin,
      capacityMax: v.capacityMax,
      ceremonyStyles: v.ceremonyStyles,
      sourceUrls: [`seed:${SEED_MARKER}`],
      photoUrls: v.photos,
      status: "researching",
      costMin: v.costMin,
      costMax: v.costMax,
      paymentMethods: v.paymentMethods,
      paymentMethodEnums: v.paymentMethodEnums,
      maxInstallments: v.maxInstallments,
      dressBringIn: v.dressBringIn,
      dressBringInFee: v.dressBringInFee,
    },
  });

  // Scores
  for (const [dim, score] of Object.entries(v.scores)) {
    await prisma.venueScore.create({
      data: {
        venueId: venue.id,
        dimension: dim as never,
        score,
        source: "user_rating",
      },
    });
  }

  // Estimate (if any)
  if (v.hasEstimate) {
    const est = await prisma.estimate.create({
      data: {
        venueId: venue.id,
        projectId,
        version: 1,
        total: 2_800_000,
        predictedFinal: 3_400_000,
        sourceType: "manual",
        items: {
          create: [
            {
              category: "cuisine",
              itemName: "料理（10,000円×80名）",
              amount: 800_000,
              tier: "standard",
              predictedUpgrade: 240_000,
              upgradeProbability: 0.7,
            },
            {
              category: "attire",
              itemName: "衣裳（新婦2着＋新郎1着）",
              amount: 600_000,
              tier: "standard",
              predictedUpgrade: 200_000,
              upgradeProbability: 0.6,
            },
            {
              category: "flowers",
              itemName: "装花（標準）",
              amount: 400_000,
              tier: "standard",
              predictedUpgrade: 120_000,
              upgradeProbability: 0.5,
            },
            {
              category: "performance",
              itemName: "演出・音響",
              amount: 300_000,
              tier: "standard",
              predictedUpgrade: 40_000,
              upgradeProbability: 0.3,
            },
            {
              category: "venue_fee",
              itemName: "会場料",
              amount: 700_000,
              tier: "standard",
            },
          ],
        },
      },
    });
    void est;
  }

  // Plans
  if (v.hasPlans) {
    await prisma.venuePlan.createMany({
      data: [
        {
          venueId: venue.id,
          name: "基本プラン",
          basePrice: 2_800_000,
          guestCountMin: 60,
          guestCountMax: 80,
          dressBrideCount: 2,
          dressGroomCount: 1,
          dressBudgetCapYen: 800_000,
          includedItems: [
            "料理（10,000円×人数）",
            "衣裳（新婦2着＋新郎1着）",
            "装花（標準）",
          ] as never,
          excludedItems: ["ブーケ", "ウェルカムスペース装飾"] as never,
          bringInItems: [{ item: "カメラマン", fee: 30000 }] as never,
        },
        {
          venueId: venue.id,
          name: "プレミアムプラン",
          basePrice: 3_800_000,
          guestCountMin: 60,
          guestCountMax: 100,
          dressBrideCount: 3,
          dressGroomCount: 1,
          dressBudgetCapYen: 1_200_000,
          includedItems: [
            "料理（15,000円×人数）",
            "衣裳（新婦3着＋新郎1着）",
            "装花（グレードアップ）",
            "ブーケ・ブートニア",
          ] as never,
          excludedItems: ["プロフィールムービー撮影"] as never,
          bringInItems: [] as never,
        },
      ],
    });
  }

  // Reviews
  for (const r of v.reviews) {
    await prisma.review.create({
      data: {
        venueId: venue.id,
        source: r.source,
        sourceUrl: `https://example.com/seed/${v.name}/${r.source}`,
        rating: r.rating,
        aiSummary: r.aiSummary,
        categorySummary: r.categorySummary as never,
        isNegative: r.isNegative,
        estimateIncrease: (r.estimateIncrease ?? undefined) as never,
      },
    });
  }

  // Aggregate review estimate stats
  const agg = aggregateReviewEstimate(v.reviews);
  await prisma.venue.update({
    where: { id: venue.id },
    data: {
      reviewEstimateDeltaYen: agg.deltaYen,
      reviewEstimateDeltaPct: agg.deltaPct,
      reviewEstimateSampleCount: agg.sampleCount > 0 ? agg.sampleCount : null,
    },
  });

  // Favorite
  if (v.favorite) {
    await prisma.venueFavorite.create({
      data: { venueId: venue.id, userId },
    });
  }

  return venue;
}

async function seedVisits(
  prisma: PrismaClient,
  venueId: string,
  userId: string,
  checklistItems: Array<{ item: string; category: string; sortOrder: number }>,
) {
  // 1) Completed visit (last week) with checklist + memo + photo
  const completedAt = new Date();
  completedAt.setDate(completedAt.getDate() - 7);

  const completed = await prisma.visit.create({
    data: {
      venueId,
      scheduledAt: completedAt,
      completedAt,
      status: "completed",
      title: "見学（1回目）",
      memo: "雰囲気がとても良かった。料理も想像以上。装花のアップグレード提案あり。",
      checklist: {
        create: checklistItems.slice(0, 20).map((c, idx) => ({
          item: c.item,
          category: c.category,
          status: idx % 3 === 0 ? "yes" : idx % 3 === 1 ? "no" : "unchecked",
          memo: idx === 0 ? "天井が高く、光の入り方が理想的" : undefined,
          photoUrls:
            idx === 0 ? [UNSPLASH.chapel2] : [],
          checkedAt: idx % 3 !== 2 ? completedAt : null,
          sortOrder: c.sortOrder,
        })),
      },
      notes: {
        create: [
          {
            content: "プランナーさんの対応がとても丁寧だった。次回までに見積り調整を依頼。",
            tags: ["担当", "印象良い"],
          },
          {
            content: "料理の試食が本当に美味しかった。ゲストも喜びそう。",
            tags: ["料理"],
          },
        ],
      },
      ratings: {
        create: [
          { userId, dimension: "atmosphere", score: 5, comment: "理想通り" },
          { userId, dimension: "cuisine", score: 5 },
          { userId, dimension: "hospitality", score: 4 },
        ],
      },
    },
  });
  void completed;

  // 2) Scheduled visit (next week)
  const scheduledAt = new Date();
  scheduledAt.setDate(scheduledAt.getDate() + 7);
  scheduledAt.setHours(14, 0, 0, 0);
  await prisma.visit.create({
    data: {
      venueId,
      scheduledAt,
      status: "scheduled",
      title: "見学（2回目・見積り相談）",
      memo: "見積り詳細の確認と、衣裳の持ち込み可否の最終確認。",
    },
  });
}

// Reuse checklist templates from src/lib
async function loadChecklistItems() {
  const mod = await import("../src/lib/checklist-templates");
  return mod.getAllChecklistItems();
}

// Load the 16-item starter preset + all preset definitions from src/lib.
async function loadChecklistPresets() {
  const mod = await import("../src/lib/checklist-presets");
  return {
    starterIds: mod.STARTER_PRESET_IDS,
    allPresets: mod.CHECKLIST_PRESETS,
  };
}

/**
 * F-09 fix: seed ProjectChecklist (which items the couple cares about) +
 * VenueChecklistAnswer (each venue's answer to those items) so the
 * `/compare` page shows meaningful diff — yes/no/unknown spread across
 * venues for the same items.
 *
 * Strategy:
 * - Activate the 16-item starter preset on the project
 * - For each seeded venue, answer each active item with a pseudo-random
 *   but deterministic yes/no/unknown so diffs are obvious
 * - Skip items whose type isn't `yesno` (memo/photo/number left blank)
 */
async function seedProjectChecklist(
  prisma: PrismaClient,
  projectId: string,
  venueIds: string[],
) {
  const { starterIds, allPresets } = await loadChecklistPresets();
  const presetById = new Map(allPresets.map((p) => [p.id, p]));

  // Activate starter items (idempotent via skipDuplicates)
  await prisma.projectChecklist.createMany({
    data: starterIds
      .filter((id) => presetById.has(id))
      .map((itemId) => ({ projectId, itemId })),
    skipDuplicates: true,
  });

  // Read back the rows to get their ids (needed for VenueChecklistAnswer FK)
  const activations = await prisma.projectChecklist.findMany({
    where: { projectId, itemId: { in: [...starterIds] } },
    select: { id: true, itemId: true },
  });

  // Create answers for each (activation × venue) combination
  for (let vi = 0; vi < venueIds.length; vi++) {
    const venueId = venueIds[vi];
    for (let ai = 0; ai < activations.length; ai++) {
      const activation = activations[ai];
      const preset = presetById.get(activation.itemId);
      if (!preset || preset.type !== "yesno") continue;
      // Deterministic spread: each venue-item pair gets a stable status
      // derived from indices — same seed run produces the same diff view.
      const n = (vi * 7 + ai * 3) % 5;
      const status = n < 2 ? "yes" : n < 4 ? "no" : "unknown";
      await prisma.venueChecklistAnswer.upsert({
        where: {
          projectChecklistId_venueId: {
            projectChecklistId: activation.id,
            venueId,
          },
        },
        create: {
          projectChecklistId: activation.id,
          venueId,
          status,
        },
        update: { status },
      });
    }
  }
}

// ---------- Main ----------
async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || (!args.email && !args.confirm)) {
    printHelp();
    process.exit(args.help ? 0 : 1);
  }
  if (!args.email) {
    console.error("ERROR: --email is required\n");
    printHelp();
    process.exit(1);
  }
  if (!args.confirm) {
    console.error(
      "ERROR: --confirm is required before writing data. Run with --confirm to proceed.\n",
    );
    printHelp();
    process.exit(1);
  }

  const email = args.email.toLowerCase();
  const prisma = makePrisma();

  try {
    console.log(`[1/7] Looking up user: ${email}`);
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      console.error(
        `\nユーザーが見つかりません: ${email}\nこのメールアドレスでまずサインアップしてください → http://localhost:3000/signup\n`,
      );
      process.exit(2);
    }
    console.log(`      found: ${user.id}`);

    console.log(`[2/7] Ensuring project…`);
    const project = await ensureProject(prisma, user.id);
    console.log(`      project: ${project.id} "${project.name}"`);

    const nonSeedCount = await countNonSeedVenues(prisma, project.id);
    if (nonSeedCount > 0) {
      console.log(
        `      note: ${nonSeedCount} existing non-seed venues will be preserved. Only seed-marked venues are replaced.`,
      );
    }

    console.log(`[3/7] Upserting project conditions…`);
    await upsertProjectConditions(prisma, project.id);

    console.log(`[4/7] Clearing prior seed venues…`);
    await wipeSeedVenues(prisma, project.id);

    console.log(`[5/7] Loading checklist template…`);
    const checklistItems = await loadChecklistItems();
    console.log(`      ${checklistItems.length} checklist items`);

    console.log(`[6/7] Seeding ${SEED_VENUES.length} venues…`);
    const createdVenues: { id: string; name: string }[] = [];
    for (const v of SEED_VENUES) {
      const venue = await seedVenue(prisma, project.id, user.id, v);
      createdVenues.push({ id: venue.id, name: venue.name });
      console.log(`      + ${v.name}`);
    }

    console.log(`[7/8] Seeding visits on first venue…`);
    await seedVisits(prisma, createdVenues[0].id, user.id, checklistItems);
    console.log(`      + completed visit + scheduled visit on "${createdVenues[0].name}"`);

    console.log(`[8/8] Seeding project checklist + per-venue answers (F-09)…`);
    await seedProjectChecklist(
      prisma,
      project.id,
      createdVenues.map((v) => v.id),
    );
    console.log(`      + starter 16 items × ${createdVenues.length} venues answered`);

    console.log(`\nDone. Summary:`);
    console.log(`  user     : ${email}`);
    console.log(`  project  : ${project.id}`);
    console.log(`  venues   : ${createdVenues.length} (${createdVenues.filter((_, i) => SEED_VENUES[i].favorite).length} favorited)`);
    console.log(`  reviews  : ${SEED_VENUES.reduce((s, v) => s + v.reviews.length, 0)}`);
    console.log(`  estimates: ${SEED_VENUES.filter((v) => v.hasEstimate).length}`);
    console.log(`  plans    : ${SEED_VENUES.filter((v) => v.hasPlans).length * 2}`);
    console.log(`\nTip: Unsplash image URLs may rot. Edit the UNSPLASH map if any 404.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("\nSeed failed:", err);
  process.exit(1);
});
