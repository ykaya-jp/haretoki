import type { ReactNode } from "react";
import { DemoBanner } from "@/components/demo/demo-banner";
import { DemoBottomNav } from "@/components/demo/demo-bottom-nav";
import { DemoBodyMarker } from "@/components/demo/demo-body-marker";
import { DemoDataProvider } from "@/components/demo/demo-data-provider";
import { Toaster } from "@/components/ui/sonner";

// (demo) route group — unauthenticated walkthrough.
// Mirrors the (app) layout's skeleton (main + bottom nav + toaster) but:
//  - No project/auth fetches,
//  - Top banner advertising demo mode + CTA to /signup,
//  - DemoDataProvider wraps children so pages/components can useDemoData(),
//  - Sets data-demo="1" on <body> so opt-in client components can detect.
//
// Middleware skips auth for /demo (see src/middleware.ts +
// src/lib/supabase/middleware.ts public-path allowlist).
export default function DemoLayout({ children }: { children: ReactNode }) {
  return (
    <DemoDataProvider>
      <DemoBodyMarker />
      <div className="min-h-dvh bg-background pb-[calc(56px+env(safe-area-inset-bottom))]">
        <a
          href="#demo-main"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[100] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground"
        >
          メインコンテンツへスキップ
        </a>
        <DemoBanner />
        <main
          id="demo-main"
          className="mx-auto max-w-5xl px-5 py-6 sm:px-8 sm:py-8"
        >
          {children}
        </main>
        <DemoBottomNav />
        <Toaster position="bottom-center" />
      </div>
    </DemoDataProvider>
  );
}
