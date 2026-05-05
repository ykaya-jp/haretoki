"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Share2, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import type { WrappedData } from "@/server/actions/wrapped";

/**
 * Spotify Wrapped 風 9:16 スライド型 UI。妻が SNS 共有したくなる
 * "ナラティブ + 数字 + ブランド" のパッケージを目指す。
 *
 * - mobile-first 9:16 アスペクト (max-w-[420px] aspect-[9/16])
 * - 1 page = 1 数値 / 1 message
 * - swipe-like Next/Prev (button base、jest 系 a11y で判別容易)
 * - 共有: navigator.share でテキスト + URL、未対応 (主に PC ブラウザ)
 *   は clipboard fallback。iOS Safari の files: 配列共有は安定しない
 *   ので intentional に skip
 */

interface Page {
  eyebrow: string;
  bg: string;
  textTone: "light" | "dark";
  body: React.ReactNode;
}

export function WrappedStory({ data }: { data: WrappedData }) {
  const pages = buildPages(data);
  const [index, setIndex] = useState(0);
  const total = pages.length;

  const onShare = async () => {
    const text = buildShareText(data);
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (typeof navigator !== "undefined" && navigator.share) {
      try {
        await navigator.share({ title: "ふたりの式場さがし", text, url });
        return;
      } catch {
        // User canceled — silent fallback to clipboard
      }
    }
    try {
      await navigator.clipboard?.writeText(`${text}\n${url}`);
      toast.success("シェア用テキストをコピーしました");
    } catch {
      toast.error("コピーできませんでした");
    }
  };

  return (
    <div className="space-y-6">
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
        <h1 className="font-[family-name:var(--font-display)] text-[26px] font-light leading-[1.22] tracking-[-0.01em]">
          ふたりの式場さがし
        </h1>
      </header>

      {/* 9:16 frame — center on viewport, generous shadow + rounded edges
          to read like a "story card" not a content panel */}
      <div className="mx-auto w-full max-w-[420px]">
        <div
          aria-label="ストーリー"
          className="relative aspect-[9/16] overflow-hidden rounded-3xl shadow-[var(--shadow-card)]"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={index}
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.02 }}
              transition={{ duration: 0.32, ease: [0.2, 0.8, 0.2, 1] }}
              className="absolute inset-0 flex flex-col justify-between p-7"
              style={{ background: pages[index].bg }}
            >
              <div
                className={
                  pages[index].textTone === "light"
                    ? "text-white"
                    : "text-foreground"
                }
              >
                <p
                  className={
                    pages[index].textTone === "light"
                      ? "text-[10.5px] uppercase tracking-[0.3em] opacity-80"
                      : "text-[10.5px] uppercase tracking-[0.3em] text-muted-foreground"
                  }
                >
                  {pages[index].eyebrow}
                </p>
              </div>

              <div
                className={
                  pages[index].textTone === "light"
                    ? "text-white"
                    : "text-foreground"
                }
              >
                {pages[index].body}
              </div>

              <div className="flex items-center justify-between">
                <span
                  className={
                    pages[index].textTone === "light"
                      ? "text-[11px] tracking-[0.16em] opacity-70"
                      : "text-[11px] tracking-[0.16em] text-muted-foreground"
                  }
                >
                  HARETOKI · {index + 1}/{total}
                </span>
                <Sparkles
                  className={
                    pages[index].textTone === "light"
                      ? "h-3.5 w-3.5 opacity-80"
                      : "h-3.5 w-3.5 text-[var(--gold-warm)]"
                  }
                  strokeWidth={1.5}
                  aria-hidden="true"
                />
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation strip */}
        <div className="mt-4 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => setIndex((i) => Math.max(0, i - 1))}
            disabled={index === 0}
            aria-label="前のページ"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-border text-foreground transition-opacity disabled:opacity-30"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          </button>

          <div className="flex flex-1 items-center justify-center gap-1.5">
            {pages.map((_, i) => (
              <span
                key={i}
                aria-hidden="true"
                className={
                  i === index
                    ? "h-1.5 w-6 rounded-full bg-[var(--gold-warm)] transition-all"
                    : "h-1.5 w-1.5 rounded-full bg-border transition-all"
                }
              />
            ))}
          </div>

          {index < total - 1 ? (
            <button
              type="button"
              onClick={() => setIndex((i) => Math.min(total - 1, i + 1))}
              aria-label="次のページ"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[var(--gold-warm)] text-white"
            >
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              onClick={onShare}
              className="inline-flex h-11 items-center gap-1 rounded-full bg-[var(--gold-warm)] px-4 text-[13px] font-medium text-white"
            >
              <Share2 className="h-4 w-4" aria-hidden="true" />
              シェア
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function buildPages(d: WrappedData): Page[] {
  const startedYear = d.startedAt.toLocaleDateString("ja-JP", {
    year: "numeric",
    timeZone: "Asia/Tokyo",
  });

  // Cream → Rose → Gold グラデを各ページで連続して見せる。テキストトーンは
  // 背景の暗さに応じて light / dark を切り替え。
  const PAGES: Page[] = [
    {
      eyebrow: "Story · 01",
      bg: "linear-gradient(135deg, #FAF6EE 0%, #F4DEC9 60%, #E8B89C 100%)",
      textTone: "dark",
      body: (
        <div>
          <p className="font-[family-name:var(--font-display)] text-[28px] font-light leading-[1.18]">
            {startedYear}、
            <br />
            ふたりの式場さがしが
            <br />
            はじまりました
          </p>
        </div>
      ),
    },
    {
      eyebrow: "Story · 02 · 出会い",
      bg: "linear-gradient(160deg, #F4DEC9 0%, #C9A44C 100%)",
      textTone: "dark",
      body: (
        <div className="space-y-3">
          <p className="font-[family-name:var(--font-display)] text-[100px] font-extralight leading-none tabular-nums">
            {d.venuesAdded}
          </p>
          <p className="font-[family-name:var(--font-display)] text-[20px] font-light leading-snug">
            の式場と出会いました
          </p>
          <p className="text-[13px] leading-relaxed opacity-80">
            そのうち {d.venuesEngaged} 件をお気に入りに、または見学に進めました。
          </p>
        </div>
      ),
    },
    ...(d.topVibes.length > 0
      ? [
          {
            eyebrow: "Story · 03 · 雰囲気",
            bg: "linear-gradient(170deg, #C9A44C 0%, #8C5A2B 100%)",
            textTone: "light" as const,
            body: (
              <div className="space-y-3">
                <p className="font-[family-name:var(--font-display)] text-[20px] font-light leading-snug opacity-80">
                  おふたりが惹かれた雰囲気は
                </p>
                <ul className="space-y-1.5">
                  {d.topVibes.map((v, i) => (
                    <li
                      key={v}
                      className="flex items-baseline gap-3 font-[family-name:var(--font-display)] text-[24px] font-light leading-snug"
                    >
                      <span className="tabular-nums opacity-60 text-[14px]">
                        0{i + 1}
                      </span>
                      <span>{v}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ),
          },
        ]
      : []),
    ...(d.visitsCompleted > 0
      ? [
          {
            eyebrow: "Story · 04 · 見学",
            bg: "linear-gradient(150deg, #8C5A2B 0%, #2A2320 100%)",
            textTone: "light" as const,
            body: (
              <div className="space-y-3">
                <p className="font-[family-name:var(--font-display)] text-[100px] font-extralight leading-none tabular-nums">
                  {d.visitsCompleted}
                </p>
                <p className="font-[family-name:var(--font-display)] text-[20px] font-light leading-snug">
                  の式場を、実際に歩きました
                </p>
                {d.notesWritten > 0 && (
                  <p className="text-[13px] leading-relaxed opacity-80">
                    {d.notesWritten} 件のメモが、おふたりだけの記憶として残っています。
                  </p>
                )}
              </div>
            ),
          },
        ]
      : []),
    {
      eyebrow: "Story · 05 · これから",
      bg: d.decidedVenueName
        ? "linear-gradient(135deg, #C9A44C 0%, #FAF6EE 100%)"
        : "linear-gradient(135deg, #2A2320 0%, #C9A44C 100%)",
      textTone: d.decidedVenueName ? "dark" : "light",
      body: d.decidedVenueName ? (
        <div className="space-y-3">
          <p className="font-[family-name:var(--font-display)] text-[18px] font-light leading-snug opacity-80">
            晴れの日は、ここで
          </p>
          <p className="font-[family-name:var(--font-display)] text-[28px] font-light leading-[1.18]">
            {d.decidedVenueName}
          </p>
          <p className="text-[13px] leading-relaxed opacity-80">
            おふたりが選んだ場所。本番までの一日一日が、これから物語になります。
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="font-[family-name:var(--font-display)] text-[24px] font-light leading-[1.22]">
            まだ、見ぬ景色がある
          </p>
          <p className="text-[13px] leading-relaxed opacity-80">
            ここまでの {d.venuesAdded} 件は、はじまりにすぎません。
            <br />
            おふたりの「晴れの日」を見つける旅は、続きます。
          </p>
        </div>
      ),
    },
  ];
  return PAGES;
}

function buildShareText(d: WrappedData): string {
  const parts: string[] = ["ふたりの式場さがしの物語"];
  if (d.venuesAdded > 0) {
    parts.push(`これまで ${d.venuesAdded} の式場と出会い、`);
  }
  if (d.topVibes.length > 0) {
    parts.push(`惹かれた雰囲気は ${d.topVibes.join("・")}。`);
  }
  if (d.visitsCompleted > 0) {
    parts.push(`${d.visitsCompleted} 件を実際に歩きました。`);
  }
  if (d.decidedVenueName) {
    parts.push(`晴れの日は「${d.decidedVenueName}」で。`);
  }
  parts.push("- Haretoki");
  return parts.join("\n");
}
