/** Standardised toast helpers — tap-to-dismiss + consistent duration. */
import { toast } from "sonner";

const DURATION = 4000;

interface ShowToastOptions {
  duration?: number;
  action?: { label: string; onClick: () => void };
}

function makeDismissible(id: string | number, options?: ShowToastOptions) {
  return {
    duration: options?.duration ?? DURATION,
    onClick: () => toast.dismiss(id),
    style: { cursor: "pointer" } as React.CSSProperties,
    ...(options?.action ? { action: options.action } : {}),
  };
}

export function showToast(
  kind: "success" | "error" | "info",
  msg: string,
  options?: ShowToastOptions,
): string | number {
  const id = crypto.randomUUID();
  toast[kind](msg, makeDismissible(id, options));
  return id;
}
