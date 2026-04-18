"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { applyStarterPreset } from "@/server/actions/checklist";
import { showToast } from "@/lib/toast";

/**
 * First-run empty state for /checklist. Shown when the project has 0 active
 * items. Removes the "where do I start?" problem by offering a one-tap
 * starter pack (16 curated items across all categories).
 */
export function ChecklistStarterCTA() {
  const [pending, start] = useTransition();
  const router = useRouter();

  const handleStart = () => {
    start(async () => {
      const res = await applyStarterPreset();
      if (res.success) {
        showToast("success", `おすすめ ${res.added} 項目をセットしました`);
        router.refresh();
      } else {
        showToast("error", "うまくセットできませんでした");
      }
    });
  };

  return (
    <section
      aria-label="チェックリストを始める"
      className="relative overflow-hidden rounded-3xl p-6 sm:p-8"
      style={{
        background:
          "linear-gradient(135deg, color-mix(in oklab, var(--gold-warm) 10%, var(--background)) 0%, color-mix(in oklab, var(--primary) 4%, var(--background)) 100%)",
        boxShadow: "inset 0 1px 0 rgba(255,255,255,0.55)",
      }}
    >
      <div className="flex items-center gap-2">
        <Sparkles
          aria-hidden="true"
          className="h-4 w-4 text-[var(--gold-warm)]"
          strokeWidth={1.5}
        />
        <p className="text-[10.5px] uppercase tracking-[0.14em] text-[var(--gold-warm)]">
          まずはここから
        </p>
      </div>

      <h2 className="mt-3 font-[family-name:var(--font-display)] text-[22px] font-light leading-[1.3] tracking-[-0.005em] text-foreground">
        比べたい観点を、<br />
        ふたりで決める。
      </h2>
      <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">
        どこから始めるか迷ったら、よく見られる 16 項目を一括でセットします。
        あとから自由に追加・削除できます。
      </p>

      <div className="mt-5 flex flex-col gap-2">
        <button
          type="button"
          onClick={handleStart}
          disabled={pending}
          className="inline-flex h-12 w-full items-center justify-center rounded-full text-[14px] font-medium text-white transition active:scale-[0.98] disabled:opacity-60"
          style={{
            background: "var(--gold-warm)",
            boxShadow:
              "0 1px 2px rgba(42,35,32,0.08), 0 8px 24px color-mix(in oklab, var(--gold-warm) 25%, transparent)",
          }}
        >
          {pending ? "セットしています…" : "おすすめ 16 項目から始める"}
        </button>
        <Link
          href="#categories"
          prefetch={false}
          className="text-center text-[12.5px] text-muted-foreground underline-offset-4 hover:underline"
        >
          自分でひとつずつ選ぶ
        </Link>
      </div>
    </section>
  );
}
