-- Track C-1: family read-only invitation links.
--
-- Additive only: new table + 1 unique index + 2 supporting indexes + 3
-- FK constraints. Same safety profile as the previous additive
-- migrations (PushSubscription, VisitReminderSent, reminder timing
-- toggles).
--
-- The token UNIQUE index is what serves the public /family/[token]
-- lookup — every public-route hit becomes an index seek, no scan.
-- Designer warning: token strength ≥ 32 bytes (256 bits, 64 hex chars)
-- enforced at the application layer via crypto.randomBytes(32).hex().
-- DB layer accepts any text but rejects duplicate tokens via the
-- unique constraint, so a future weakening of the generator would not
-- silently allow collisions.

CREATE TABLE "family_invitations" (
  "id"                   UUID NOT NULL DEFAULT gen_random_uuid(),
  "project_id"           UUID NOT NULL,
  "token"                TEXT NOT NULL,
  "created_by"           UUID NOT NULL,
  "expires_at"           TIMESTAMP(3) NOT NULL,
  "revoked_at"           TIMESTAMP(3),
  "revoked_by"           UUID,
  "view_count"           INTEGER NOT NULL DEFAULT 0,
  "last_viewed_at"       TIMESTAMP(3),
  "last_viewed_ip_hash"  TEXT,
  "created_at"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "family_invitations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "family_invitations_token_key"
  ON "family_invitations" ("token");

CREATE INDEX "family_invitations_project_id_created_at_idx"
  ON "family_invitations" ("project_id", "created_at");

CREATE INDEX "family_invitations_expires_at_idx"
  ON "family_invitations" ("expires_at");

ALTER TABLE "family_invitations"
  ADD CONSTRAINT "family_invitations_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "family_invitations"
  ADD CONSTRAINT "family_invitations_created_by_fkey"
  FOREIGN KEY ("created_by") REFERENCES "users"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "family_invitations"
  ADD CONSTRAINT "family_invitations_revoked_by_fkey"
  FOREIGN KEY ("revoked_by") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
