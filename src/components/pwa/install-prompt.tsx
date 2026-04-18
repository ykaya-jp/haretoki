"use client";

import { useEffect, useState } from "react";
import { X, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

function isRecentlyDismissed(): boolean {
  if (typeof window === "undefined") return false;
  const dismissedAt = localStorage.getItem("pwa-install-dismissed");
  if (!dismissedAt) return false;
  const daysSince = (Date.now() - Number(dismissedAt)) / (1000 * 60 * 60 * 24);
  return daysSince < 7;
}

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(() => isRecentlyDismissed());

  useEffect(() => {
    if (dismissed) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, [dismissed]);

  if (!deferredPrompt || dismissed) return null;

  const handleInstall = async () => {
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem("pwa-install-dismissed", String(Date.now()));
    setDismissed(true);
  };

  return (
    <div
      className="fixed left-4 right-4 z-50 flex items-center gap-3 rounded-xl bg-card p-4 shadow-[var(--shadow-modal)]"
      style={{ bottom: "calc(56px + env(safe-area-inset-bottom) + 8px)" }}
    >
      <Download className="h-5 w-5 shrink-0 text-primary" />
      <div className="flex-1">
        <p className="text-sm font-medium">アプリをインストール</p>
        <p className="text-xs text-muted-foreground">オフラインでも使えます</p>
      </div>
      <Button size="sm" onClick={handleInstall}>インストール</Button>
      <button type="button" onClick={handleDismiss} className="shrink-0 p-1">
        <X className="h-4 w-4 text-muted-foreground" />
      </button>
    </div>
  );
}
