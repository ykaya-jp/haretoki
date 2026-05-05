"use client"

import { Toaster as Sonner, type ToasterProps } from "sonner"

function Toaster({ ...props }: ToasterProps) {
  // Lift toasts above the fixed BottomNav (56px) and the iOS home-indicator
  // safe-area inset so a "保存しました" toast never spawns underneath the
  // tab bar / under the home indicator on iPhone (W21-4 audit fix).
  return (
    <Sonner
      className="toaster group"
      offset="calc(56px + env(safe-area-inset-bottom) + 12px)"
      mobileOffset="calc(56px + env(safe-area-inset-bottom) + 12px)"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { Toaster }
