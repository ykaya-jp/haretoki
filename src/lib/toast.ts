/** Standardised toast helpers — tap-to-dismiss + consistent duration. */
import { toast } from "sonner";

const DURATION = 4000;

function makeDismissible(id: string | number) {
  return {
    duration: DURATION,
    onClick: () => toast.dismiss(id),
    style: { cursor: "pointer" } as React.CSSProperties,
  };
}

export function showToast(
  kind: "success" | "error" | "info",
  msg: string,
): string | number {
  const id = crypto.randomUUID();
  toast[kind](msg, makeDismissible(id));
  return id;
}
