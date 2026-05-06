import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";
import { getWrappedData } from "@/server/actions/wrapped";
import { WrappedStory } from "@/components/wrapped/wrapped-story";

export const metadata: Metadata = {
  title: "ふたりの式場さがし",
  description: "おふたりがここまで歩んできた式場さがしの軌跡",
};

export default async function WrappedPage() {
  const data = await getWrappedData();

  if (!data.hasStory) {
    return (
      <div className="space-y-10">
        <header className="space-y-3">
          <p className="flex flex-wrap items-center gap-2 text-eyebrow text-muted-foreground">
            <Link
              href="/home"
              prefetch={true}
              className="inline-flex min-h-11 items-center gap-1 hover:opacity-70"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back
            </Link>
            <span aria-hidden="true" className="opacity-30">/</span>
            <span className="font-medium text-[var(--gold-warm)]">HARETOKI</span>
            <span aria-hidden="true" className="opacity-30">·</span>
            <span>Wrapped</span>
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-fluid-3xl font-light leading-[1.18] tracking-[-0.01em]">
            ふたりの物語は、これから
          </h1>
          <p className="mt-2 text-[13.5px] leading-relaxed text-muted-foreground">
            式場をひとつでも保存すると、ここに「おふたりだけの軌跡」が綴られます。
          </p>
        </header>

        <div className="relative overflow-hidden rounded-2xl border border-border bg-card p-8 text-center">
          <div
            aria-hidden="true"
            className="absolute inset-x-0 top-0 h-px bg-[linear-gradient(to_right,transparent,color-mix(in_oklab,var(--gold-warm)_50%,transparent),transparent)]"
          />
          <Sparkles
            className="mx-auto mb-4 h-8 w-8 text-[var(--gold-warm)]"
            strokeWidth={1.4}
            aria-hidden="true"
          />
          <p className="text-sm leading-relaxed text-muted-foreground">
            まずは、気になる式場をひとつ覗いてみることから。
          </p>
          <Link
            href="/explore"
            prefetch={true}
            className="mt-5 inline-flex min-h-11 items-center gap-1 rounded-full bg-[var(--gold-warm)] px-5 text-sm font-medium text-white shadow-[0_2px_8px_rgba(0,0,0,0.08)]"
          >
            式場をさがす →
          </Link>
        </div>
      </div>
    );
  }

  return <WrappedStory data={data} />;
}
