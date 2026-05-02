# Phase 5 — Design Vision

> **Status**: vision draft, not yet a plan. Owned by design + product. Replaced when Phase 5 plan-of-record lands at `docs/roadmap.md`. Last updated: 2026-05-02.

This doc captures **how the v4.2 editorial visual language earned across Phase 1-4 should evolve** through Phase 5 — what we keep, what we deepen, what we add. It deliberately avoids feature lists; those live in `docs/roadmap.md` once Phase 5 is scoped.

Read alongside:

- [`DESIGN.md`](../../DESIGN.md) — current visual contract (tokens, typography, motion)
- [`docs/brand-voice.md`](../brand-voice.md) — verbal voice (the new Phase 4 sister doc)
- [`docs/copy-lexicon.md`](../copy-lexicon.md) — UI text patterns
- [`src/lib/og-tokens.ts`](../../src/lib/og-tokens.ts) — sRGB palette
- Phase 4 highlights: hero stagger (landing-page.tsx), DecisionCeremony cloudy → 晴れ wash, motion-tokens, View Transitions foundation

---

## 1. The thesis

Phase 1-4 built a product that is **legible, calm, and editorial**. Couples can read it without anxiety, the AI never pushes, and the brand reads as "trustworthy local atelier" rather than "wedding industrial complex".

Phase 5 should not repaint the language — it should **deepen the emotional layer** so the product **feels like the couple's** within the first session, not the seventh.

> Phase 1-4: **photo-first** (式場の写真が中心、AI は補助線)
> Phase 5: **emotion-first** (ふたりの感情の動きが中心、写真と AI と数字はそれを支える背景)

---

## 2. What we keep — non-negotiable

These are the v4.2 invariants that Phase 5 inherits without question. Listed so a future round doesn't accidentally rebuild them.

| Invariant | Why it stays |
|---|---|
| 曇り → 晴れ間 → 晴れ metaphor | Already wired into onboarding-flow, decision-ceremony, landing-page wash, OG card. The single most identity-defining brand element. |
| Editorial typography (Shippori display ≥ 24px, Noto Serif body, Noto Sans UI) | Established trust. Couples comment on the "calm" feel; the typography pair is the load-bearing reason. |
| Cream + gold-warm palette anchored on OKLCH | Reads as "warm but neutral", deliberately NOT pink / blush / rose-gold (saturated bridal industry default). |
| Tabular numbers + 細字 headlines | Same neutrality — numbers feel honest, headings don't shout. |
| Motion = 0.6-0.9s editorial fades, never bouncy | Bounce reads as marketing playfulness; we are deliberately the opposite of that. |
| Mobile-first 375 base, 44px touch targets, SafeArea | All UI decisions snap to that grid. |
| AI is "コーチ" not "コンシェルジュ", uses 弱い断定 | Authority without pushiness — see brand-voice doc §3.5. |
| 広告ゼロ / 掲載料ゼロ | Reflected in copy ("広告のない、ふたりだけの判断材料"). Visual: we never frame venues with banner ads, "PR" tags, or sponsorship eyebrows. |

---

## 3. Three Phase 5 movements

### 3.1 写真ファースト → 感情ファースト

**Problem we observed in Phase 4 user feedback (`docs/myreview/problems_02.md`):** the venue photo is currently the visual anchor of nearly every screen, which is correct in early sessions but starts to feel **transactional** by week 3-4 when the couple already knows the candidates and is making the harder emotional call.

**Hypothesis for Phase 5:** introduce a parallel "emotion lane" — small, persistent visual cues that surface what the **couple** has felt, beside what the **venue** looks like. Not as a separate page; as a layer on top of every existing screen.

**Concrete sketches** (not commitments):

- **Mood ring on the candidate card.** A tiny circular ring (4px stroke) wrapping the venue thumbnail, colored by the couple's average rating warmth: cool grey for unrated, soft gold for "drawn to it", deep gold for "we both love it". Reads at a glance without numbers.
- **Co-viewed indicator.** When the partner has just opened the same screen (Realtime broadcast already shipping in Phase 3), a soft 1.5s pulse around the active section signals "ふたりが今、同じ場所を見ている".
- **Sentence-of-the-week on Home.** The coach summarises the week's 1-2 most-decided / most-discussed dimensions in one editorial sentence, in Shippori. Replaces the current AI insight card on the home page once a couple has 3+ candidates.

**Visual register guideline:** all emotion-lane elements stay **muted in chroma, generous in whitespace**. The point is to feel "noticed but not nudged".

### 3.2 Partner 共同体験の visual 表現

**What we have:** Phase 3 wired Realtime co-presence (the partner sees rating updates in seconds), the family-share read-only token, and the partner welcome modal.

**What we don't have yet:** a sustained sense of **being together in the app**. The partner is currently a *signal* (their rating just landed) rather than a *presence* (we are both here, looking at this).

**Hypothesis for Phase 5:** sustained partner presence requires three lightweight artifacts:

1. **Avatar pair, always visible.** A 28px chip (initials + soft gold ring) for each partner in the top-right corner of every authenticated page, with a subtle "online now" pulse when both are active. Mirrors the chip pattern shipped in Phase 3 partner-welcome-modal. Never a "remove partner" CTA there — that lives in /mypage.
2. **Co-edit shadows on form inputs.** When the partner is typing a rating / note, their cursor + a soft 200ms typing pulse renders on the active field, like a Google Doc "Yusuke is here". 12-character grace before the cursor surfaces (avoid surprising users in mid-key).
3. **Dual-voice replay on Decision day.** DecisionCeremony today shows one couple-level summary; Phase 5 surfaces both partners' top 3 reasons side by side ("ゆうすけ がここを推した理由 / さくら がここを推した理由"). Reuses the existing `VisitNote.author` field already in schema.

**Risk and mitigation:** "co-edit shadows" can feel surveillant. Mitigation: opt-in toggle in /mypage notification settings, default on for couples who passed onboarding together (= invitation accepted within 14 days), default off otherwise.

### 3.3 晴れ時メタファーの体系化

**What we have:** the cloudy → break → sunny gradient is wired into landing-page hero, onboarding-flow per-step wash, and decision-ceremony. Three surfaces, three slightly different recipes — all anchored on the same `--gold-warm` / `--gold-soft` / `--muted-foreground` tokens.

**What we don't have yet:** a **complete weather vocabulary** that other surfaces can opt into. A "曇り" for the candidate-stuck state. A "夕暮れ" for the post-decision wind-down. A "霧" for the AI is still thinking moment.

**Hypothesis for Phase 5:** publish a tiny weather-token system, alongside the current motion-tokens. ~6 named atmospheres, each with:

- A `--bg-{name}` token (radial gradient recipe, sRGB hex via og-tokens for satori parity)
- A short editorial label (「曇り」「霧」「晴れ間」「晴れ」「夕暮れ」「夜更け」)
- A SkyChip (extending the current SkyChip variants) so home / coach / decision can re-emit the same illustration cheaply

Surfaces **opt in** to the weather they fit (coach during a long AI generation = 霧, decision aftermath = 夕暮れ etc.). The point is not "every page has a weather"; the point is **continuity** — when a couple drifts from home → coach → candidates, the weather changes deliberately rather than randomly.

**Drafting note:** the existing onboarding-flow `WASH_BY_STAGE` is the right mental model, just published as a shared token table.

---

## 4. What we don't do in Phase 5

A short anti-roadmap. Listed because every one of these has been suggested in past planning rounds; this doc declines them.

- ❌ **Major palette shift.** No teal, no blush, no rose-gold experiments. The cream + gold-warm pair is brand equity by Phase 5 — repainting it would erase the trust the typography earned.
- ❌ **Carousel / hero video on landing.** Discussed in Phase 2; declined because it pushes us back toward "wedding industry mood-board" aesthetics. The static chapel image with the cloudy → sunny wash is doing the work.
- ❌ **Gamification (streaks, badges, "wedding planning XP")** Couples planning a wedding don't need an additional emotional axis — they need calm.
- ❌ **Notifications-as-engagement.** Phase 4 shipped the notification preview modal with a deliberately *honest* "実際は控えめに届きます" footer. Phase 5 keeps that posture: notifications are confirmations, not hooks.
- ❌ **Partner public profile.** Profile pages exist for product owners on social platforms; in a wedding-prep tool a "profile" surface is friction.

---

## 5. Open questions

Items design needs to settle before Phase 5 plan-of-record can lock:

- [ ] **Does "emotion lane" replace or augment the AI insight card?** Likely augments on home, replaces inside individual venue pages — but needs design comp.
- [ ] **Co-edit shadow latency budget.** Realtime broadcast is ~300ms in Phase 3. Cursor shadows under 500ms feel live; over 1.5s feel broken. Need to confirm the worst-case path under the current Supabase plan.
- [ ] **Weather token compatibility with light/dark.** The 夕暮れ recipe is straightforward in light mode; in dark mode the warm orange has to land *between* the deep ink canvas and the gold-warm accent without muddying either. Designer sketch needed.
- [ ] **Dual-voice replay on Decision** vs the current single-voice ceremony. Do we keep the existing single-voice serif card and *add* the dual-voice section beneath, or restructure the whole ceremony? Default: additive.
- [ ] **Partner avatar mode for solo couples.** A user who hasn't invited a partner sees a single avatar — does that feel lonely, or honest? Hypothesis: honest, with a subtle "+ ふたり目を招く" affordance on long-press.

---

## 6. Phase boundary signals

**Phase 4 is "user-facing 完成度 polish":** brand identity, install banner, push preview, motion-tokens, view-transitions, brand voice doc, dark mode visual regression baseline. Done when the audit passes ✅.

**Phase 5 is "emotion-first depth":** the three movements above. Earliest plan-of-record after **Phase 4 production deploy stable for ≥ 2 weeks** (so we have telemetry on whether the polish actually moved engagement / retention).

If telemetry says Phase 4 polish was net-neutral (same retention, same engagement) → Phase 5 still ships, with extra emphasis on §3.2 (partner co-presence).

If telemetry says Phase 4 polish moved retention by +15% → Phase 5 doubles down on §3.1 (emotion lane), since the editorial calm is clearly the converting axis.

If telemetry says Phase 4 polish hurt anything → emergency Phase 4.5 first to localise the regression. Phase 5 vision unchanged.

---

## 7. References

- Phase 4 work that informs this vision:
  - landing hero motion + onboarding entry conversion + share button (round at tip `560d7f3`)
  - PWA install banner timing + SW offline + push preview (tip `8fdfad0`)
  - brand asset + favicon + meta + brand-voice doc (tip `2ec6e62`)
  - this round: animation polish + dark-mode visual regression + Phase 5 design vision

- External design language references:
  - Headspace narrative welcome → first session pattern (Phase 3 onboarding hero A-3 round used this)
  - Zola couple-first framing
  - Calm.com's editorial hush — the closest emotional cousin in the meditation space

- Anchoring product principles in Haretoki's voice:
  - 急かさない — no streaks, no countdowns, no "残り◯" pressure
  - 売らない — no banner ads, no "PR" tags, no sponsored carousel position
  - 中立 — no "業者おすすめ" labels, no curated-by-partner list
