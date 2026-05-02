# Phase 3 integration test checklist

Manual verification script for the Phase 3 feature set after every
release that touches Realtime, Push, family share, multi-device sync,
or the Wedding-day countdown surface. The static counterparts (unit
tests, lint, contrast, axe) live elsewhere — this doc covers what only
two devices and a real Supabase project can verify.

Pair with `docs/harness/a11y-sr-test-checklist.md`: that doc is the
SR pass; this one is the cross-feature integration pass.

## Pre-flight (do once before the first run)

- [ ] Two browser profiles signed into separate accounts that share
      one project: `owner@example.com` and `partner@example.com`.
      Profile 2 must have already accepted a partner invitation.
- [ ] Both profiles have at least one Visit + one VenueRating saved
      so the comparison surfaces have data.
- [ ] `prisma/schema.prisma` migrations applied on the target env
      (`dev` for staging, otherwise prod).
- [ ] Supabase Realtime publication includes `visit_ratings` /
      `visit_notes` / `decisions`. Confirm via Supabase dashboard
      → Database → Replication → `supabase_realtime` publication.
- [ ] Supabase RLS policy on the three tables above gates
      subscribe-by-projectId. Confirm a third unrelated profile
      (`stranger@example.com`) cannot receive any payload.
- [ ] `web-push` VAPID keys are present in env on the target deploy
      (`VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`).
- [ ] At least one device on each profile has accepted the in-app
      push permission prompt (see `/mypage/notifications`).

## A. Supabase Realtime (Phase 3 wave 3.1)

Tests the broadcast vocabulary in `src/lib/realtime/events.ts` and
the `useRealtimeProject` subscriber in
`src/lib/realtime/use-realtime-project.tsx`.

| #  | Step                                                                                   | Expected                                                                                                                |
|----|----------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------|
| A1 | Owner & partner each open the SAME `/venues/<id>` on different devices                 | Both pages mount, no errors in either devtools console.                                                                 |
| A2 | Owner saves a star rating                                                              | Within 3 s the partner device renders the new value AND a subtle "{owner name}が評価しました" toast in the bottom-center.    |
| A3 | Owner edits the same rating again (within 30 s)                                        | Partner sees the value tick over but NO duplicate toast — the broadcast layer's "first occurrence per session" gate fires only once. |
| A4 | Partner adds a VisitNote                                                               | Owner gets a "{partner name}がメモを追加" toast + the note appears in the list without a hard reload.                       |
| A5 | Owner navigates to `/compare`                                                          | Subscription stays alive (one channel per RealtimeProvider, scoped to projectId).                                        |
| A6 | A third profile (NOT a member of the project) opens `/venues/<id>`                     | They get a 404 / redirect, never receive any broadcast — RLS gate works.                                                 |
| A7 | Owner toggles their device offline, edits a rating, comes back online                  | The unsent edit replays through `enqueueMutation` → flushes on online → partner sees the toast (LWW guard accepts the offline edit because no concurrent server write happened). |
| A8 | Both edit the SAME (visit, dimension) within ~1 s                                      | Last write wins; the loser sees their value flicker to the winner's value within 3 s. No "your save was rejected" toast — that path is wave 3.3 (deferred).                       |

Failure-mode flag: A2/A4 toast silent → either the publishRealtimeEvent
call is missing on the server action that just wrote the row, OR the
client subscriber filtered the actorUserId out (own-edit suppression
fired by mistake). Cross-check `src/lib/realtime/publish.ts` for the
write path and `useRealtimeProject` for the actor filter.

## B. Push notifications (Phase 3 wave 3.2)

Tests the `partner_rating_added` / `decision_saved` /
`visit_note_first_save` push fan-out + the same-room suppression in
`src/lib/push/send.ts`.

| #  | Step                                                                                                  | Expected                                                                                                                                                                          |
|----|-------------------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| B1 | Owner saves their FIRST rating on a venue (no prior owner-rating on that venue × dimension)          | Partner receives a Web Push notification "{owner name}が雰囲気を評価しました" within 30 s. Notification opens `/venues/<id>?from=push`.                                                  |
| B2 | Owner saves their SECOND rating on the same venue (any dimension) within 5 minutes                   | NO push to partner — the per-couple per-venue cooldown gate (`PushSendLog`) suppresses repeat notifications.                                                                       |
| B3 | Partner is currently viewing `/venues/<id>` AND owner saves a rating on that same venue              | NO push to partner — "same-room" suppression: the broadcast already toasted them, a push would duplicate.                                                                          |
| B4 | Partner has the venue page open but TAB IS BACKGROUND (e.g. minimized)                                | Push DOES fire — same-room suppression keys on the most-recent `realtime_event_seen` from the foreground tab, which a background tab does NOT update.                              |
| B5 | Partner is on `/home`, owner saves the Decision (sets weddingDate)                                    | Partner receives "{owner name}が決めた場所を選びました" with deep link to `/decision`.                                                                                                |
| B6 | Both devices subscribe (e.g. partner has a phone + tablet)                                            | All subscribed endpoints fire in parallel; owner's single save produces N pushes (one per partner endpoint).                                                                       |
| B7 | An endpoint returns 410 Gone                                                                          | The handler removes that PushSubscription row (`endpoint` UNIQUE) so the next event doesn't try the dead endpoint.                                                                  |
| B8 | Settings → "相手の活動通知" toggle off                                                                  | All subsequent partner-activity pushes silently skip; visit-reminder pushes still fire (separate setting).                                                                         |

Failure-mode flag: B1 silent → check VAPID keys are wired in env on
the target deploy (`web-push` will throw on the server side, not on the
client) and that the same-room suppression isn't being hit by a stale
`realtime_event_seen` in localStorage.

## C. Family share link (Track C-1)

Tests the public-token read-only access at `/family/[token]` against
the FamilyInvitation auth in `src/server/actions/family-invitations.ts`.

| #  | Step                                                                                          | Expected                                                                                                                          |
|----|-----------------------------------------------------------------------------------------------|-----------------------------------------------------------------------------------------------------------------------------------|
| C1 | Owner generates a family invitation from `/mypage/family-share`                              | A 64-hex token is returned in the share UI, valid for 30 days.                                                                    |
| C2 | An unauthenticated browser opens `/family/<token>`                                            | The Decision view renders read-only — venue, weddingDate, photo, ratings summary. NO edit affordances. NO email / phone of either member exposed. |
| C3 | The same token is opened twice from the same IP within a minute                              | `viewCount` increments to 2; `lastViewedAt` and `lastViewedIpHash` update both times. No rate-limit error.                          |
| C4 | Owner clicks "Revoke" on `/mypage/family-share`                                              | A confirm dialog ("家族リンクを取り消しますか？") appears with a 2-stage commit (round 25 family revoke).                                |
| C5 | Confirmed revoke: re-open `/family/<token>`                                                  | 404 (or "このリンクは無効になりました" landing). Never echoes the revoke status to public — the surface is a uniform 404.            |
| C6 | A token >30 days old (or with `expiresAt` in the past)                                       | Same uniform 404. The retention sweep eventually drops the row.                                                                     |
| C7 | A malformed token (wrong length / non-hex)                                                   | 404 BEFORE any DB query; the route validates token shape first.                                                                     |
| C8 | Operator opens `/admin/family-share`                                                          | The aggregates + 50-row table render; the suspicious-IP banner only renders when ≥ 1 hash crosses the threshold.                  |

Failure-mode flag: C2 leaks edit affordances → check the public-route
client component is reading the published-via-server props only, never
auth helpers. C8 missing rows → confirm `recordAudit` is being called
on view (`family.invitation.viewed`).

## D. Wedding-day countdown (Track C-2)

Tests the timezone math in `src/lib/wedding-countdown.ts` against
the `Decision.weddingDate` storage shape.

| #  | Step                                                                                  | Expected                                                                                                                                                |
|----|---------------------------------------------------------------------------------------|---------------------------------------------------------------------------------------------------------------------------------------------------------|
| D1 | Owner sets `weddingDate = 2026-12-31` from the decision page                          | `/home` immediately renders "あと N 日" where N is the JST-ceiling difference between today (JST) and 2026-12-31.                                          |
| D2 | Cross JST midnight (move clock forward / use a future-dated weddingDate)              | The countdown decrements by exactly 1 at 00:00 JST regardless of the viewer's actual timezone (verify by setting OS to PST and reloading).                |
| D3 | weddingDate is today (JST)                                                            | Card flips to "晴れの日です" copy with the celebratory variant — no negative number, no "あと 0 日".                                                           |
| D4 | weddingDate has passed (yesterday)                                                    | Card switches to the post-event "Thank you" surface; never shows a negative day count.                                                                  |
| D5 | weddingDate is null                                                                   | Card hides itself (`return null`); the home page still renders without a layout gap.                                                                    |
| D6 | Two devices in different timezones (owner in JST, partner in CET)                     | Both render the same "あと N 日" because the math anchors on JST midnight on the venue side, not on the viewer's local clock.                              |

Failure-mode flag: D2 off-by-one → the countdown helper is doing date
arithmetic in the viewer's local TZ instead of JST. The fix has to live
in `wedding-countdown.ts`, not in the consumer.

## E. Multi-device offline reconcile (Phase 3 wave 3 foundation)

Tests `src/lib/sync/offline-reconcile.ts` + `<QueuedSavingIndicator>`.
The form-side wire-up (rating-section / visit-note-form opting in) is
deferred until the schema migration round; until then, the indicator
is a primitive that surfaces only when callers explicitly enqueue.

| #  | Step                                                                                    | Expected                                                                                                                                  |
|----|-----------------------------------------------------------------------------------------|-------------------------------------------------------------------------------------------------------------------------------------------|
| E1 | localStorage smoke: open the venue page, devtools → Application → localStorage         | No keys yet. The queue is created lazily on first failed save; absence is the healthy state.                                                |
| E2 | Devtools network throttle to "offline", trigger any consumer that calls `enqueueMutation` | A `haretoki:sync:<namespace>:v1` key appears with the queued payload + `clientWrittenAt` timestamp.                                          |
| E3 | Edit the same target twice while offline                                                | Only ONE entry in the queue (dedup by `targetKey`); payload is the latter write.                                                            |
| E4 | Toggle network back online                                                              | The consumer's flush path runs; the indicator transitions from "オフラインで一時保存しました" → "保存待機中（N 件）" → empty within ~5 s.   |
| E5 | While the queue is non-empty, a server-side update arrives via Realtime                  | LWW guard accepts when server `updatedAt > clientWrittenAt`, drops the queued entry; rejects otherwise. No flicker between values.          |
| E6 | Browser private-mode (localStorage write throws)                                         | The function silently degrades — component state still holds the unsent payload, and the next save retry succeeds without error.            |
| E7 | Cross-tab: open the same venue in two tabs of the same browser, both online             | The 4 s polling in `<QueuedSavingIndicator>` picks up another tab's queue mutations within the next tick (no native `storage` event used).  |

Failure-mode flag: E5 flickers → the consumer is calling
`shouldAcceptServerUpdate` AFTER it has already overwritten the local
view; the gate must run BEFORE the React state set.

## F. Visual rhythm cross-page checks

Smoke that the editorial language stays consistent across the
Phase 3 surfaces. Audit-driven; not all rows need to be re-checked
every release — focus on rows whose source surface changed.

| #  | Surface                                       | Check                                                                                                                                                                            |
|----|-----------------------------------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------|
| F1 | onboarding 3-zone hero → recommendations      | Hero `text-fluid-3xl` Shippori (≥28px) → recommendations list 24px serif → nothing else uses Shippori below 24px. Step-pulse gold check (250ms) reads continuous with confetti.    |
| F2 | home countdown card                           | Card body intentionally amber, `dark:` overrides applied. Brand gold-warm hairline above the card matches the Site Footer hairline (gradient via gold-warm 20%, both directions). |
| F3 | venues/[id] partner row + rating section      | The wave-1.1 partner row reads as a peer of the owner row (same icon weight, same bar style). Wave-1.4 can-rate hint sits ABOVE the rating section, not inside it.                  |
| F4 | compare page couple-comparison surface        | Agreement row is gold-subtle wash + 45% gold border-l. Disagreement row is gold-warm 8% wash on `var(--card)` + 3px gold-warm border + the 1px gold-fade hairline ABOVE the row.    |
| F5 | decision page → OG share                      | Hero Shippori 28px+. The OG image at 1080×1080 uses the same gold-warm palette, no rgba leaks. Family-share button reads as quiet (border-only) not promotional.                    |
| F6 | mypage push-permission + family share + reminders | Settings rows share `min-h-[44px] tap target` + the same 13px metadata column. The Help section (support / terms / privacy) sits at the bottom in muted-foreground.            |

Failure-mode flag: F1-F6 deliberately do NOT have automated grep
checks — visual rhythm reads as "right" or "drifted" only against the
real layout in a real browser. Add a screenshot diff job in CI as a
follow-up if this list grows past 10 rows.

## Triage template

When a step fails, drop the result here as one bullet so the next
release picks it up:

```
- [ ] <yyyy-mm-dd> — <env: prod|staging|preview> — <step id, e.g. A2>
      — <observed> — <fix branch / commit>
```

## Maintaining this script

- When a new Realtime event kind / push payload kind / family
  invitation field lands, append a row to the relevant section.
- When the LWW guard semantics change (Phase 4 CRDT migration?),
  rewrite section E rather than appending — the contract itself
  is moving.
- When `prefers-reduced-motion` interacts with Phase 3 features
  (e.g. broadcast toasts), add a row alongside section A; the
  parallel SR / a11y script lives at
  `docs/harness/a11y-sr-test-checklist.md` and should not duplicate.
