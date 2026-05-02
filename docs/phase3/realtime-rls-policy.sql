-- ============================================================================
-- Phase 3 L3 wave 4 — Realtime broadcast RLS policy
-- ============================================================================
--
-- Closes the wave-1 known limitation: broadcasts on `project:<UUID>` are
-- currently subscribable by anyone who can guess the UUID. After this
-- migration runs, only authenticated users who are members of the named
-- project can subscribe (READ) or publish (WRITE) on that channel.
--
-- WHERE TO RUN: Supabase dashboard → SQL editor (NOT via Prisma migrate;
-- the `realtime.*` schema is owned by Supabase, not by our Prisma schema).
-- The script is idempotent — re-running has no effect after the first run.
--
-- WHAT IT DOES:
--   1. Enables RLS on `realtime.messages` (Supabase's broadcast routing
--      table). Without this, every authenticated user could see every
--      broadcast on every channel.
--   2. Adds a stable helper `realtime.haretoki_project_member(uuid)`
--      that checks membership in the public.project_members table.
--      Encapsulating the join in a SECURITY DEFINER function lets the
--      policy stay readable AND avoids the policy referencing public.*
--      tables directly (which sometimes triggers Supabase recursion
--      warnings on cross-schema policies).
--   3. Two policies on `realtime.messages`:
--        - SELECT (subscribe): allow if extension parses the channel
--          name as `project:<UUID>` and the auth.uid() is a member.
--        - INSERT (broadcast send from a USER session): same gate.
--      Service-role connections (our publishRealtimeEvent in
--      src/lib/realtime/publish.ts) BYPASS RLS by design, so server-
--      initiated publishes still work without the policy listing
--      service_role explicitly.
--
-- WHAT IT DOES NOT DO:
--   - It does NOT cover Postgres CDC / `postgres_changes` subscriptions
--     (those are gated by RLS on the underlying tables, which we
--     already have via supabase.auth + project ownership).
--   - It does NOT enforce broadcast rate limiting (Supabase project
--     plan limits apply: 200 concurrent connections / 500 messages
--     per second on the free tier).
--
-- ROLLBACK: drop the policies + function in reverse order. RLS on
-- realtime.messages should stay enabled even after rollback (Supabase
-- recommendation; without it, broadcast channels are world-readable).
--
-- VERIFICATION (run AFTER applying):
--   1. From a user session subscribed to `project:<other-couple-uuid>`,
--      `await channel.subscribe()` should produce a CHANNEL_ERROR.
--   2. From a user session subscribed to your own project's channel,
--      a server publish should arrive within ~500ms.
--   3. From the SQL editor, `SELECT * FROM realtime.messages LIMIT 1;`
--      should return only rows where you'd be allowed to subscribe.
-- ============================================================================

-- 1) Enable RLS on the broadcast routing table. ------------------------------
ALTER TABLE realtime.messages ENABLE ROW LEVEL SECURITY;

-- 2) Membership helper. -------------------------------------------------------
-- Encapsulates "is the calling auth.uid() a member of <projectId> with
-- accepted invitation". Returns boolean; safe to call from any policy
-- because it ignores RLS on project_members itself (SECURITY DEFINER).
CREATE OR REPLACE FUNCTION realtime.haretoki_project_member(p_project_id uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.project_members pm
     WHERE pm.project_id  = p_project_id
       AND pm.user_id     = auth.uid()
       AND pm.accepted_at IS NOT NULL
  );
$$;

-- Grant EXECUTE to the authenticated role only — anonymous sessions
-- have no project memberships so the helper would always return false
-- for them anyway, but the explicit grant is the safer default.
REVOKE ALL ON FUNCTION realtime.haretoki_project_member(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION realtime.haretoki_project_member(uuid) TO authenticated;

-- 3) Subscribe policy. --------------------------------------------------------
-- realtime.topic() returns the channel name as set by the subscriber.
-- We expect 'project:<uuid>'; split_part isolates the UUID half. When
-- the channel name doesn't match the pattern (split_part returns ''),
-- the cast to uuid raises and the policy short-circuits to false.
DROP POLICY IF EXISTS "haretoki_project_member_can_select"
  ON realtime.messages;
CREATE POLICY "haretoki_project_member_can_select"
  ON realtime.messages
  FOR SELECT
  TO authenticated
  USING (
    realtime.topic() LIKE 'project:%'
    AND realtime.haretoki_project_member(
      split_part(realtime.topic(), ':', 2)::uuid
    )
  );

-- 4) Broadcast (publish from a user session) policy. -------------------------
-- Server-side `publishRealtimeEvent` uses the service role key, which
-- bypasses RLS entirely — this policy is for hypothetical client-
-- initiated broadcasts (none ship today, kept open for future use).
DROP POLICY IF EXISTS "haretoki_project_member_can_insert"
  ON realtime.messages;
CREATE POLICY "haretoki_project_member_can_insert"
  ON realtime.messages
  FOR INSERT
  TO authenticated
  WITH CHECK (
    realtime.topic() LIKE 'project:%'
    AND realtime.haretoki_project_member(
      split_part(realtime.topic(), ':', 2)::uuid
    )
  );

-- ============================================================================
-- End of script. After running this in the Supabase SQL editor, verify by
-- subscribing two browser sessions (different couples) to each other's
-- project UUID — the second session must see CHANNEL_ERROR on subscribe.
-- ============================================================================
