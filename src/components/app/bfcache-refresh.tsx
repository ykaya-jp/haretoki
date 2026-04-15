"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Safari / Firefox の bfcache（back-forward cache）から復帰した際、
 * Server Component の stale な HTML が残ったまま UI が再開して
 * 「戻ると次の画面が出る」「状態がおかしい」症状が起こる（B-17）。
 *
 * このコンポーネントは `pageshow` で `event.persisted === true` を検知した
 * ときのみ `router.refresh()` を呼び、現在のルートを server 再取得する。
 * pushState navigation / 通常 load では走らないので無害。
 */
export function BfcacheRefresh() {
  const router = useRouter();

  useEffect(() => {
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) {
        router.refresh();
      }
    };
    window.addEventListener("pageshow", onPageShow);
    return () => window.removeEventListener("pageshow", onPageShow);
  }, [router]);

  return null;
}
