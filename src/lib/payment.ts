/**
 * Payment method enum helpers.
 *
 * `PaymentMethod` is the canonical enum introduced in R1.5c (see L1 in
 * `docs/wife-requirements-plan.md`). The legacy `Venue.paymentMethods: String[]`
 * column is preserved for historical data; all new UI reads/filters should use
 * `Venue.paymentMethodEnums` + this label map.
 */

export const PAYMENT_METHODS = [
  "credit_card",
  "cash",
  "bank_transfer",
  "installment",
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  credit_card: "カード",
  cash: "現金",
  bank_transfer: "振込",
  installment: "分割",
};

/** Human-facing Japanese label for a `PaymentMethod` enum value. */
export function paymentMethodLabel(method: PaymentMethod): string {
  return PAYMENT_METHOD_LABELS[method];
}

/** Ordered [enum, label] pairs for rendering filter chips / display lists. */
export function paymentMethodOptions(): ReadonlyArray<{
  value: PaymentMethod;
  label: string;
}> {
  return PAYMENT_METHODS.map((value) => ({ value, label: PAYMENT_METHOD_LABELS[value] }));
}
