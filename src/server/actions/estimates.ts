"use server";

import { z } from "zod";
import { prisma } from "@/server/db";
import { requireUser, requireProjectMembership } from "@/server/auth";
import { revalidatePath } from "next/cache";
import { askClaude, isClaudeAvailable } from "@/lib/claude";
import { uploadEstimatePdf } from "@/lib/supabase/storage";

const estimateSchema = z.object({
  venueId: z.string().uuid(),
  total: z.coerce.number().int().positive("総額は1以上で入力してください"),
  items: z
    .array(
      z.object({
        category: z.enum([
          "attire",
          "cuisine",
          "photo_video",
          "flowers",
          "performance",
          "av_equipment",
          "venue_fee",
          "other",
        ]),
        itemName: z.string().min(1),
        amount: z.coerce.number().int().nonnegative(),
      }),
    )
    .optional(),
});

export async function createEstimate(input: z.input<typeof estimateSchema>) {
  const validation = estimateSchema.safeParse(input);
  if (!validation.success) {
    return { error: validation.error.flatten().fieldErrors };
  }

  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  // Get current version count
  const count = await prisma.estimate.count({
    where: { venueId: validation.data.venueId },
  });

  const estimate = await prisma.estimate.create({
    data: {
      venueId: validation.data.venueId,
      projectId,
      version: count + 1,
      total: validation.data.total,
      sourceType: "manual",
      items: validation.data.items
        ? {
            create: validation.data.items.map((item) => ({
              category: item.category,
              itemName: item.itemName,
              amount: item.amount,
            })),
          }
        : undefined,
    },
    include: { items: true },
  });

  revalidatePath(`/venues/${validation.data.venueId}`);
  revalidatePath("/candidates");
  return { estimate };
}

export async function getEstimatesForVenue(venueId: string) {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  return prisma.estimate.findMany({
    where: { venueId, projectId },
    include: { items: true },
    orderBy: { version: "desc" },
  });
}

// --- PDF Estimate Analysis ---

const ESTIMATE_ANALYSIS_SYSTEM_PROMPT = `You are an expert at analyzing Japanese wedding venue estimates (見積書).
Extract structured data from the provided PDF text content.

Japanese wedding estimate upgrade patterns (use these to predict final cost):
- Attire (dress, tuxedo): 62% upgrade rate, typical +¥200,000-400,000
- Cuisine (course upgrade): 65% upgrade rate, typical +¥150,000-300,000
- Photo/Video/Endroll: 50% upgrade rate, typical +¥200,000-350,000
- Flowers/Table decor: 45% upgrade rate, typical +¥100,000-250,000
- Performances/Effects: 40% upgrade rate, typical +¥50,000-150,000
- AV/Sound equipment: 30% upgrade rate, typical +¥30,000-80,000

Return ONLY valid JSON (no markdown, no code fences) with this structure:
{
  "total": <number, total estimate amount in yen>,
  "items": [
    {
      "category": "<one of: attire, cuisine, photo_video, flowers, performance, av_equipment, venue_fee, other>",
      "itemName": "<item name in Japanese>",
      "amount": <number, amount in yen>,
      "tier": "<one of: minimum, standard, premium, unknown>"
    }
  ],
  "predictedFinal": <number, predicted final cost after typical upgrades>,
  "analysisNote": "<brief note in Japanese about the prediction reasoning>"
}

Frame predictions positively: describe typical adjustments other couples make rather than warning about hidden costs.
If you cannot extract certain fields, use reasonable defaults. Always return valid JSON.`;

const PDF_MAX_SIZE = 10 * 1024 * 1024; // 10MB

type AnalysisResult = {
  total: number;
  items: Array<{
    category: string;
    itemName: string;
    amount: number;
    tier: string;
  }>;
  predictedFinal: number;
  analysisNote: string;
};

export async function analyzeEstimatePdf(venueId: string, formData: FormData) {
  // Auth check
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  // Check Claude availability
  if (!isClaudeAvailable()) {
    return {
      error:
        "AI分析を利用するにはAPIキーを設定してください（ANTHROPIC_API_KEY）",
    };
  }

  // Validate file
  const file = formData.get("pdf") as File | null;
  if (!file) {
    return { error: "PDFファイルを選択してください" };
  }

  if (file.type !== "application/pdf") {
    return { error: "PDF形式のファイルのみアップロードできます" };
  }

  if (file.size > PDF_MAX_SIZE) {
    return { error: "ファイルサイズは10MB以下にしてください" };
  }

  try {
    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase Storage
    const fileName = `${Date.now()}-${file.name}`;
    const pdfUrl = await uploadEstimatePdf(buffer, fileName, projectId, venueId);

    // Extract text from PDF using pdf-parse v3 class-based API
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    const textResult = await parser.getText();
    await parser.destroy();
    const pdfText = textResult.text;

    if (!pdfText || pdfText.trim().length === 0) {
      return {
        error:
          "PDFからテキストを抽出できませんでした。スキャンされたPDFの場合は手入力をお試しください",
      };
    }

    // Send to Claude for analysis
    const claudeResponse = await askClaude(
      ESTIMATE_ANALYSIS_SYSTEM_PROMPT,
      `以下は結婚式場の見積書のテキスト内容です。構造化データとして抽出してください:\n\n${pdfText}`,
    );

    if (!claudeResponse) {
      return { error: "AI分析に失敗しました。しばらくしてから再度お試しください" };
    }

    // Parse Claude's JSON response
    let analysis: AnalysisResult;
    try {
      analysis = JSON.parse(claudeResponse);
    } catch {
      return {
        error: "AI分析結果の解析に失敗しました。再度お試しください",
      };
    }

    // Validate the analysis has required fields
    if (!analysis.total || !Array.isArray(analysis.items)) {
      return { error: "AI分析結果が不完全です。再度お試しください" };
    }

    return {
      analysis,
      pdfUrl,
      venueId,
      projectId,
    };
  } catch (error) {
    console.error("PDF analysis error:", error);
    return {
      error:
        error instanceof Error
          ? error.message
          : "見積もりPDFの分析に失敗しました",
    };
  }
}

const VALID_CATEGORIES = [
  "attire",
  "cuisine",
  "photo_video",
  "flowers",
  "performance",
  "av_equipment",
  "venue_fee",
  "other",
] as const;

type ValidCategory = (typeof VALID_CATEGORIES)[number];

function isValidCategory(value: string): value is ValidCategory {
  return VALID_CATEGORIES.includes(value as ValidCategory);
}

const VALID_TIERS = ["minimum", "standard", "premium", "unknown"] as const;

type ValidTier = (typeof VALID_TIERS)[number];

function isValidTier(value: string): value is ValidTier {
  return VALID_TIERS.includes(value as ValidTier);
}

export async function saveAnalyzedEstimate(input: {
  venueId: string;
  pdfUrl: string;
  total: number;
  predictedFinal: number;
  items: Array<{
    category: string;
    itemName: string;
    amount: number;
    tier: string;
  }>;
}) {
  const user = await requireUser();
  const { projectId } = await requireProjectMembership(user.id);

  // Get current version count
  const count = await prisma.estimate.count({
    where: { venueId: input.venueId },
  });

  const estimate = await prisma.estimate.create({
    data: {
      venueId: input.venueId,
      projectId,
      version: count + 1,
      total: input.total,
      predictedFinal: input.predictedFinal,
      sourceType: "ai_extracted",
      pdfUrl: input.pdfUrl,
      items: {
        create: input.items.map((item) => ({
          category: isValidCategory(item.category) ? item.category : "other",
          itemName: item.itemName,
          amount: item.amount,
          tier: isValidTier(item.tier) ? item.tier : "unknown",
        })),
      },
    },
    include: { items: true },
  });

  revalidatePath(`/venues/${input.venueId}`);
  revalidatePath("/candidates");
  return { estimate };
}
