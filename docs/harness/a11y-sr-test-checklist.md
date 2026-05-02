# A11y screen-reader test checklist

Manual screen-reader verification script. Static repo audits cover most
WCAG checks (linter rules, color contrast, tap-target heights), but a
few invariants are only observable through an actual SR pass — focus
order, the polite-vs-assertive announcement balance, the Coach voice
landing as a paragraph rather than a label, and so on. This doc is the
canonical script for that pass.

Run before any release that touches: onboarding (Track A), DecisionCeremony,
SiteFooter, BottomNav, Hero CTA, partner-invite flow, or anything that
introduces / reorders an `aria-live` region.

## Tools

| Platform | SR | App | Notes |
|---|---|---|---|
| macOS | VoiceOver | Safari + Chrome | `Cmd+F5` toggles VO; `VO+→` advances; `VO+Space` activates |
| Windows | NVDA | Chrome + Firefox | NVDA reads polite regions on `H` heading nav |
| iOS | VoiceOver | Safari | `Settings → Accessibility → VoiceOver`. Triple-press home/side button to toggle |
| Android | TalkBack | Chrome | `Settings → Accessibility → TalkBack`. Volume up+down to toggle |

The list above is the supported matrix; the script assumes the macOS or
Windows stack unless a step calls out mobile.

## Pre-flight

1. Sign in with a fresh account so the onboarding gate fires.
2. Confirm `prefers-reduced-motion` is **OFF** in OS settings (we want
   to verify the live regions still announce when motion runs at full
   tilt; a separate reduced-motion pass appears below).
3. Clear `localStorage.haretoki.onboarding-partner-hint-dismissed` (or
   use an incognito window) so the partner-hint surface still renders.
4. Set the SR speech rate to default — at fast rates polite regions
   may queue past the next state change and produce false negatives.

## Onboarding — Hero gateway (`/onboarding`, step === -1)

| # | Step | Expected SR output |
|---|---|---|
| H1 | Land on `/onboarding` | "Haretoki ふたりの晴れの日を、ここから …" — the eyebrow + h1 + lead pair reads in order |
| H2 | Tab through the hero | Focus lands on the お名前 input → ‌「はじめる」 button → 「あとで OK」 link → external footer (no other affordances inside hero) |
| H3 | Hit `Enter` on 「はじめる」 | Page advances to step 0 with no alert sound; the polite status region announces "Step 1 / 4: 雰囲気" |
| H4 | Tab from cleared name | The display-name input must be the first interactive control after the heading; SR reads "お名前 (任意), 編集テキスト" |

Failure mode flag: if "Step 1 / 4: 雰囲気" does NOT auto-announce after
the「はじめる」 tap, the sr-only `<p role="status" aria-live="polite">`
in `onboarding-flow.tsx` (just above the gradient wash) regressed.

## Onboarding — 3-zone Step (`/onboarding`, step 0 → 3)

| # | Step | Expected SR output |
|---|---|---|
| S1 | Heading nav (`H` in NVDA, `VO+CMD+H` in VO) | Sequence: `HARETOKI · ふたりの式場さがし` (eyebrow, NOT a heading) → `Coach` (eyebrow) → none. Question text is a `<p>`, intentional — Coach voice should NOT read as a heading |
| S2 | Form-field nav (`F` in NVDA) | First reachable control on each step is the first option pill (style/area) or the number input (guests) or the budget pill (budget); no skipped controls between Coach bubble and CTA |
| S3 | Activate a pill | "雰囲気: チャペル, 押されています" / "選択されています" — `aria-pressed` (or PillOptions internal equivalent) flips on toggle |
| S4 | Activate Step 4 ("おすすめを見る" tap) | Polite announce: "ふたりに合う式場を探しています" → after fetch resolves: "おすすめの式場が見つかりました。ホームへ進めます。" |
| S5 | Step 1 only — Coach welcome | "ふたりの好みを聞かせてください" reads BEFORE the question; the eyebrow + question reads as two separate paragraphs, not a single run-on |
| S6 | Step 4 only — Coach welcome | "最後の質問です" reads BEFORE the question on the budget step |
| S7 | Skip via「スキップ」 | The polite status announces the next step the same way as Next; no separate "skipped" announcement (intentional — couples shouldn't feel scolded for skipping) |
| S8 | Reduced-motion verify (separate run with `prefers-reduced-motion: reduce`) | The status region still announces step changes; the gold check pulse is silent / invisible; the cloudy→sunny gradient wash holds at "sunny" from first paint |

Failure mode flags:
- S5/S6 silent → the optional `welcome` field is being rendered with
  `aria-hidden` or visibility:hidden somewhere upstream.
- S4 silent on completion → the showRecommendations branch's sr-only
  `<p role="status" aria-busy>` is misplaced or aria-busy never flips.

## Onboarding — Accumulated zone tap-revisit (chip rewind)

| # | Step | Expected SR output |
|---|---|---|
| R1 | After answering steps 1-3, focus the first 「これまで」 row | "Step 1「雰囲気」に戻る" — the row reads as a single button with the full label |
| R2 | Activate it (Enter / Space) | Step jumps back; polite status announces "Step 1 / 4: 雰囲気"; focus lands on the question heading or first form control of step 1 |
| R3 | Verify focus does NOT trap inside the rewind list — Tab forward should leave the row and reach the next interactive control |
| R4 | Verify View Transitions does NOT eat the announcement — on Chrome (where `document.startViewTransition` runs) the polite region must still read after the cross-fade settles |

Failure mode flag: R4 silent on Chrome only suggests the polite region
got re-mounted inside the View Transition snapshot and lost its
reader-cursor anchor.

## Onboarding — Partner hint (post-completion)

| # | Step | Expected SR output |
|---|---|---|
| P1 | After reaching showRecommendations + scrolling | The partner-hint surface reads its eyebrow → headline → CTA → close button in order |
| P2 | Activate close ("このお誘いを閉じる") | The hint disappears with no announcement (per design — gentle dismiss, not loud "removed"); next focus moves to the surrounding context |
| P3 | Reload after dismiss | The hint does NOT re-render — verify the localStorage gate respects SR-driven dismiss the same as click |

## Cross-page rhythm check (informational, no announcement)

These are visual-rhythm checks; the SR output is incidental but the
check exists because Track A introduced a flow whose typography needs
to feel continuous with the rest of the app:

| # | Comparison | Pass criterion |
|---|---|---|
| V1 | Onboarding step header eyebrow vs. mypage `Account` eyebrow | Same eyebrow class (`text-eyebrow`), same gold-warm tint; if either side uses `text-[11.5px]` the typography invariant from A-6 has regressed |
| V2 | Onboarding Coach question vs. DecisionCeremony summary headline | Both use `font-display` ONLY at ≥24px (A-6 invariant). Coach question lives at `text-h3 = 18px` and is intentionally Noto Sans; the headline lives at hero scale |
| V3 | Onboarding gold hairline separator vs. SiteFooter hairline | Same `var(--gold-warm)` tint at 22% mix, same gradient direction |
| V4 | Step pulse gold check (A-7) vs. DecisionCeremony confetti palette | Both anchor to `var(--gold-warm)`; pulse is a single 250ms event, not the celebration loop |
| V5 | View Transitions on chip rewind vs. ADR-0007 invariant | `experimental.viewTransition` stays `false` in next.config.ts; A-7 uses imperative `document.startViewTransition`, NOT React's `<ViewTransition>`. If you see the React component anywhere in onboarding the ADR has drifted |

## Issue triage template

When a step fails, drop the result here as one bullet so the next
release picks it up:

```
- [ ] <yyyy-mm-dd> — <macOS VO 17.x | NVDA 2024.x | iOS VO | TalkBack> —
      <step id, e.g. S4> — <observed reading> — fix branch / commit
```

## Maintaining this script

- When a new aria-live region or interactive landmark is added to any
  surface in the table, append a new row at the bottom of that
  surface's section. Keep step ids sequential.
- When ADR-0007 (View Transitions stance) changes, update V5.
- When the typography invariant moves (e.g. A-6 follow-up), update V1
  and V2 to point at the new tokens. The audit gate (`grep` recipe in
  ADR-0006 / A-6 commit) is the static counterpart; this script is
  the dynamic one.

The static counterparts (linter rules, axe scan, contrast-ratio
spot-check) live elsewhere — this doc covers only what an SR pass can
verify that automated tools cannot.
