-- CreateTable
CREATE TABLE "ai_cache" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "input_hash" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_cache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_cache_input_hash_key" ON "ai_cache"("input_hash");
