"use client";

import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  analyzeEstimatePdf,
  saveAnalyzedEstimate,
} from "@/server/actions/estimates";
import { Upload, FileText, Loader2, Check, X, Pencil, AlertTriangle } from "lucide-react";
import { toast } from "sonner";

// Round 12 (2026-05-02) — file size cap raised to 32MB after migrating
// to the Anthropic Files API. Mirrors PDF_MAX_SIZE in src/server/actions/
// estimates.ts; keep both in sync if either changes.
const PDF_MAX_BYTES = 32 * 1024 * 1024;
const PDF_MAX_LABEL = "32MB";

const CATEGORY_LABELS: Record<string, string> = {
  venue_fee: "会場費",
  cuisine: "料理・飲物",
  attire: "衣裳",
  photo_video: "写真・映像",
  flowers: "装花",
  performance: "演出",
  av_equipment: "音響・照明",
  other: "その他",
};

const TIER_LABELS: Record<string, string> = {
  minimum: "最低限",
  standard: "標準",
  premium: "プレミアム",
  unknown: "不明",
};

type AnalyzedItem = {
  category: string;
  itemName: string;
  amount: number;
  tier: string;
};

type AnalysisResult = {
  total: number;
  items: AnalyzedItem[];
  predictedFinal: number;
  analysisNote: string;
};

function formatYen(amount: number): string {
  return `¥${amount.toLocaleString("ja-JP")}`;
}

function formatYenMan(amount: number): string {
  return `¥${Math.round(amount / 10000)}万`;
}

export function EstimatePdfUpload({
  venueId,
  onSaved,
}: {
  venueId: string;
  onSaved?: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  // Round 12 (2026-05-02) — warnings come back from the server side
  // sanity checks (sum-vs-total drift > 10%, etc.) so we surface a
  // 要確認 banner above the analysis form before save.
  const [warnings, setWarnings] = useState<string[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editTotal, setEditTotal] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;

    if (selected.type !== "application/pdf") {
      toast.error("PDF形式のファイルのみアップロードできます");
      return;
    }

    if (selected.size > PDF_MAX_BYTES) {
      toast.error(`ファイルサイズは${PDF_MAX_LABEL}以下にしてください`);
      return;
    }

    setFile(selected);
    setAnalysis(null);
    setPdfUrl(null);
    setWarnings([]);
  }

  async function handleUploadAndAnalyze() {
    if (!file) return;

    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("pdf", file);

      const result = await analyzeEstimatePdf(venueId, formData);

      if ("error" in result && result.error) {
        toast.error(result.error);
        return;
      }

      if ("analysis" in result && result.analysis) {
        setAnalysis(result.analysis);
        setPdfUrl(result.pdfUrl ?? null);
        setEditTotal(result.analysis.total.toString());
        // Round 12: warnings populated when the server-side parser detects
        // sum-vs-total drift > 10% etc. We render them as a 要確認 banner
        // above the editable items so the user double-checks before save.
        setWarnings(
          "warnings" in result && Array.isArray(result.warnings)
            ? result.warnings
            : [],
        );
        toast.success("見積もりの分析が完了しました");
      }
    } catch {
      toast.error("見積もりをうまく読めませんでした");
    } finally {
      setUploading(false);
    }
  }

  function updateItem(index: number, field: keyof AnalyzedItem, value: string | number) {
    if (!analysis) return;
    setAnalysis({
      ...analysis,
      items: analysis.items.map((item, i) =>
        i === index ? { ...item, [field]: value } : item,
      ),
    });
  }

  function removeItem(index: number) {
    if (!analysis) return;
    setAnalysis({
      ...analysis,
      items: analysis.items.filter((_, i) => i !== index),
    });
  }

  async function handleSave() {
    if (!analysis || !pdfUrl) return;

    setSaving(true);

    try {
      const total = parseInt(editTotal, 10) || analysis.total;

      const result = await saveAnalyzedEstimate({
        venueId,
        pdfUrl,
        total,
        predictedFinal: analysis.predictedFinal,
        items: analysis.items,
      });

      if ("error" in result) {
        toast.error("見積もりをうまく残せませんでした");
        return;
      }

      toast.success("見積もりを残しました");
      // Reset state
      setFile(null);
      setAnalysis(null);
      setPdfUrl(null);
      setEditTotal("");
      setWarnings([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
      onSaved?.();
    } catch {
      toast.error("見積もりをうまく残せませんでした");
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setFile(null);
    setAnalysis(null);
    setPdfUrl(null);
    setEditTotal("");
    setWarnings([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  // --- Render: Analysis results (editable) ---
  if (analysis) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2 text-sm text-tone-success dark:text-tone-success">
          <Check className="h-4 w-4" />
          <span>AI分析完了 — 内容を確認・編集してから残してください</span>
        </div>

        {/* Round 12: server-side sanity warnings (sum-vs-total drift > 10%
            などの soft signal). 表示しても save をブロックしない — couple
            が見て判断する材料として並べる。 */}
        {warnings.length > 0 && (
          <div
            role="status"
            aria-live="polite"
            className="rounded-md border border-tone-warning/30 bg-tint-warning px-3 py-2 dark:bg-tint-warning"
          >
            <div className="flex items-start gap-2">
              <AlertTriangle
                className="mt-0.5 h-4 w-4 shrink-0 text-tone-warning dark:text-tone-warning"
                aria-hidden="true"
              />
              <div className="space-y-1 text-sm">
                <p className="font-medium text-tone-warning dark:text-tone-warning">
                  要確認 — AI 抽出の整合性チェックで気になる点があります
                </p>
                <ul className="space-y-0.5 text-xs text-tone-warning/90 dark:text-tone-warning/90">
                  {warnings.map((w, i) => (
                    <li key={i}>・{w}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Total */}
        <div className="space-y-1">
          <label htmlFor="estimate-total" className="text-xs text-muted-foreground">総額</label>
          <div className="flex items-center gap-2">
            <span className="text-lg font-medium">¥</span>
            <Input
              id="estimate-total"
              inputMode="numeric"
              value={editTotal}
              onChange={(e) => setEditTotal(e.target.value.replace(/[^0-9]/g, ""))}
              className="max-w-48 text-lg font-medium tabular-nums"
            />
          </div>
        </div>

        {/* Predicted final */}
        {analysis.predictedFinal > 0 && (
          <div className="rounded-md bg-tint-gold px-3 py-2 dark:bg-tint-gold">
            <p className="text-sm text-tone-gold dark:text-tone-gold">
              最終予測額: {formatYenMan(analysis.predictedFinal)}
            </p>
            {analysis.analysisNote && (
              <p className="mt-1 text-xs text-tone-gold dark:text-tone-gold">
                {analysis.analysisNote}
              </p>
            )}
          </div>
        )}

        {/* Items */}
        <div className="space-y-2">
          <span className="text-xs text-muted-foreground" id="estimate-items-label">内訳</span>
          {analysis.items.map((item, index) => (
            <div
              key={index}
              className="flex items-start gap-2 rounded-md border border-border/50 p-2"
            >
              <div className="flex-1 space-y-1">
                {editingIndex === index ? (
                  <div className="space-y-2">
                    <Input
                      value={item.itemName}
                      onChange={(e) => updateItem(index, "itemName", e.target.value)}
                      placeholder="項目名"
                    />
                    <Input
                      inputMode="numeric"
                      value={item.amount.toString()}
                      onChange={(e) =>
                        updateItem(
                          index,
                          "amount",
                          parseInt(e.target.value.replace(/[^0-9]/g, ""), 10) || 0,
                        )
                      }
                      placeholder="金額"
                    />
                    <button
                      type="button"
                      onClick={() => setEditingIndex(null)}
                      className="text-xs text-primary hover:underline"
                    >
                      完了
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="mr-1 inline-block rounded bg-muted px-1.5 py-0.5 text-xs">
                        {CATEGORY_LABELS[item.category] ?? item.category}
                      </span>
                      <span className="mr-1 inline-block rounded bg-muted/50 px-1 py-0.5 text-xs text-muted-foreground">
                        {TIER_LABELS[item.tier] ?? item.tier}
                      </span>
                      <span className="text-sm">{item.itemName}</span>
                    </div>
                    <span className="text-sm tabular-nums">
                      {formatYen(item.amount)}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() =>
                    setEditingIndex(editingIndex === index ? null : index)
                  }
                  className="rounded-md p-1.5 text-muted-foreground hover:text-foreground active:bg-muted"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => removeItem(index)}
                  className="rounded-md p-1.5 text-muted-foreground hover:text-destructive active:bg-muted"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button onClick={handleSave} disabled={saving} className="flex-1">
            {saving ? (
              <>
                <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                残しています…
              </>
            ) : (
              "この内容で残す"
            )}
          </Button>
          <Button variant="outline" onClick={handleReset}>
            やり直す
          </Button>
        </div>
      </div>
    );
  }

  // --- Render: Upload form ---
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,application/pdf"
            onChange={handleFileChange}
            className="absolute inset-0 cursor-pointer opacity-0"
            aria-label="見積もりPDFを選択"
          />
          <div className="flex h-11 items-center gap-2 rounded-md border border-dashed border-border px-3 text-sm text-muted-foreground">
            {file ? (
              <>
                <FileText className="h-4 w-4 shrink-0" />
                <span className="truncate">{file.name}</span>
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 shrink-0" />
                <span>見積もりPDFを選択</span>
              </>
            )}
          </div>
        </div>
      </div>

      {file && (
        <Button
          onClick={handleUploadAndAnalyze}
          disabled={uploading}
          className="w-full"
        >
          {uploading ? (
            <>
              <Loader2 className="mr-1 h-4 w-4 animate-spin" />
              AI分析中...
            </>
          ) : (
            <>
              <Upload className="mr-1 h-4 w-4" />
              アップロードしてAI分析
            </>
          )}
        </Button>
      )}

      <p className="text-xs text-muted-foreground">
        PDF形式・{PDF_MAX_LABEL}以下。AIが見積もり内容を自動抽出します
      </p>
    </div>
  );
}
