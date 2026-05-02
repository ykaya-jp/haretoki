"use client";

import { useTransition, useState } from "react";
import { Bell, Eye } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  updateNotificationFrequency,
  type FrequencyMode,
} from "@/server/actions/notification-preferences";
import { NotificationPreviewModal } from "@/components/settings/notification-preview-modal";
import { track } from "@/lib/analytics";

const MODES: Array<{
  id: FrequencyMode;
  label: string;
  description: string;
}> = [
  {
    id: "auto",
    label: "おまかせ",
    description: "ふたりの節目にだけ届きます",
  },
  {
    id: "quiet",
    label: "控えめ",
    description: "大事な時だけ",
  },
  {
    id: "off",
    label: "オフ",
    description: "通知を送らない",
  },
];

interface NotificationSettingsProps {
  initialFrequency: FrequencyMode;
}

export function NotificationSettings({
  initialFrequency,
}: NotificationSettingsProps) {
  const [frequency, setFrequency] = useState<FrequencyMode>(initialFrequency);
  const [isPending, startTransition] = useTransition();
  const [previewOpen, setPreviewOpen] = useState(false);

  function handleSelect(mode: FrequencyMode) {
    if (mode === frequency || isPending) return;

    const prev = frequency;
    setFrequency(mode);

    startTransition(async () => {
      try {
        await updateNotificationFrequency(mode);
        toast.success("通知設定を残しました");
      } catch {
        setFrequency(prev);
        toast.error("保存できませんでした。もう一度お試しください。");
      }
    });
  }

  return (
    <div className="space-y-3">
      {/* segmented control */}
      <div
        role="radiogroup"
        aria-label="通知頻度"
        className="flex gap-1 rounded-full bg-muted p-1"
      >
        {MODES.map(({ id, label }) => {
          const isActive = frequency === id;
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={isActive}
              disabled={isPending}
              onClick={() => handleSelect(id)}
              className={cn(
                "flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full px-3 py-2.5 text-sm transition-colors active:scale-[0.98]",
                isActive
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground",
                isPending && "opacity-50",
              )}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* description for selected mode */}
      {MODES.map(({ id, description }) =>
        id === frequency ? (
          <p key={id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Bell className="h-3 w-3 shrink-0" aria-hidden="true" />
            {description}
          </p>
        ) : null,
      )}

      {/* Comprehension nudge — show what kinds of pushes actually
          arrive *before* the OS permission prompt. Permission denial
          is sticky on iOS / Android, so couples who say no once
          rarely re-enable; previewing first lifts the opt-in rate.
          The button stays muted-style so it does not compete with
          the segmented frequency picker above. */}
      <button
        type="button"
        onClick={() => {
          track("notification_preview_cta_clicked");
          setPreviewOpen(true);
        }}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-[12px] text-muted-foreground transition-colors active:scale-[0.97] hover:text-foreground"
      >
        <Eye className="h-3.5 w-3.5" strokeWidth={1.6} aria-hidden="true" />
        届く通知の例を見る
      </button>

      <NotificationPreviewModal
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
      />
    </div>
  );
}
