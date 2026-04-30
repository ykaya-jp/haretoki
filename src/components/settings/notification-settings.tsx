"use client";

import { useTransition, useState } from "react";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  updateNotificationFrequency,
  type FrequencyMode,
} from "@/server/actions/notification-preferences";

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
    </div>
  );
}
