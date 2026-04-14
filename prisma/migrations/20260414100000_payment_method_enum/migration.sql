-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('credit_card', 'cash', 'bank_transfer', 'installment');

-- AlterTable
ALTER TABLE "venues"
  ADD COLUMN "payment_method_enums" "PaymentMethod"[] DEFAULT ARRAY[]::"PaymentMethod"[],
  ADD COLUMN "max_installments" INTEGER;

-- Backfill: map existing free-text `payment_methods` values into the new enum column.
-- Unknown tokens map to NULL via the CASE ELSE; we array_remove them below.
UPDATE "venues"
SET "payment_method_enums" = ARRAY(
  SELECT DISTINCT CASE
    WHEN val LIKE '%カード%' OR val LIKE '%credit%' OR val LIKE '%Credit%' THEN 'credit_card'::"PaymentMethod"
    WHEN val LIKE '%現金%' OR val LIKE '%cash%' THEN 'cash'::"PaymentMethod"
    WHEN val LIKE '%振込%' OR val LIKE '%振り込み%' OR val LIKE '%transfer%' THEN 'bank_transfer'::"PaymentMethod"
    WHEN val LIKE '%分割%' OR val LIKE '%ローン%' OR val LIKE '%installment%' THEN 'installment'::"PaymentMethod"
    ELSE NULL
  END
  FROM UNNEST("payment_methods") AS val
  WHERE val IS NOT NULL
)::"PaymentMethod"[]
WHERE array_length("payment_methods", 1) > 0;

-- Strip any NULL entries the CASE ELSE may have produced.
UPDATE "venues"
SET "payment_method_enums" = array_remove("payment_method_enums", NULL)
WHERE "payment_method_enums" IS NOT NULL;
