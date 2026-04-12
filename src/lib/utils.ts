import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Format amount in ¥万 (man-yen) notation for large values,
 * or ¥N,NNN for smaller values.
 */
export function formatYen(amount: number): string {
  if (amount >= 10000) {
    return `¥${Math.round(amount / 10000)}万`;
  }
  return `¥${amount.toLocaleString()}`;
}

/**
 * Format amount as full yen with comma separators: ¥3,800,000
 */
export function formatYenFull(amount: number): string {
  return `¥${amount.toLocaleString()}`;
}
