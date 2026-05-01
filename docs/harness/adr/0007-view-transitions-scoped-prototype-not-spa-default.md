# 0007. View Transitions API は **shared-element 名前体系のみ** 先行投入し、SPA flag は無効を維持する

- **Status**: Accepted
- **Date**: 2026-05-02
- **Deciders**: yusuke.kaya

## Context

`docs/PENDING.md` Tier 3 X-9 に「View Transitions API」が長期未着手で残っていた。Phase 2.E で試作着手。
着手前の現状を読むと **重要な過去判断** があった:

- `next.config.ts:29` で `experimental.viewTransition: false` が **明示的に disabled**
- 同箇所のコメント:
  > viewTransition disabled: both-page DOM coexistence during transition caused net-negative latency on mobile tab switches (body thrash).
- `src/app/globals.css` には既に `@view-transition { navigation: auto; }` がある (cross-document MPA 用、SPA 遷移には効かない)
- 既存判断は「mobile tab 切替で `<BottomNav>` 経由の navigation が発火するたびに前後ページ DOM が同時 mount され、body 全体が thrash する」という具体的な失敗モード由来

Tier 3 X-9 の「試作」を素直に解釈すると `experimental.viewTransition: true` を立てて React の `<ViewTransition>` (React 19 + Next.js 16 で integrate 済) を venue card → /venues/[id] 詳細遷移などで使うことになる。
しかし `true` に戻すと過去判断を無条件に上書きすることになり、**1 surface (venue 詳細遷移) を morph するために全 in-app navigation で body thrash の risk を再導入する**。

加えて、本プロダクトの 4 タブ構成 (ホーム / 探す / 候補 / コーチ) は `<BottomNav>` 経由のタブ切替が最頻出 navigation。 ここで latency が悪化すると UX 損失は morph の見栄え向上を簡単に上回る。

## Decision

**`experimental.viewTransition` は `false` 維持**。代わりに以下を Phase 2.E で投入:

1. **shared-element の名前体系** だけ前進させる:
   - `src/components/venues/venue-card.tsx` の photo wrapper に `style={{ viewTransitionName: \`venue-photo-${venue.id}\` }}`
   - `src/components/venues/venue-photo-gallery.tsx` の `<PhotoCarousel>` 親 div に同 name (`venue-photo-${venueId}`)
   - venue id 単位で unique なため同一ページ内の複数カードが衝突しない
   - flag が無効な間は `view-transition-name` は inert (no-op)。 ブラウザは値を読むが何もアニメートしない
2. **`src/app/globals.css` の View Transitions セクションを拡張**:
   - 既存 `@view-transition { navigation: auto; }` (MPA 用) はそのまま保持。 コメントに "SPA 遷移には効かない、本 ADR-0007 で flag 無効を維持中" を明記
   - `@media (prefers-reduced-motion: reduce)` で `::view-transition-old/new/group(*)` の `animation-duration: 0s !important` (a11y 必須、Next.js 公式 docs §"Disable View Transitions for Reduced Motion" 準拠)
   - `::view-transition-group(*)` のデフォルト duration を 320ms / `cubic-bezier(0.22, 1, 0.36, 1)` に上書き (mid-tier Android で morph が intentional に読める速度)
3. **flag を `true` に戻す前提条件を本 ADR に明記**。誰かが将来 toggle する前にこの ADR を読む

## Consequences

良かった点:

- **過去判断 (mobile tab body thrash) を上書きしない**。flag は false なので、本変更 1 つで latency 後退する経路を作らない
- **shared-element name infra が前進**: SPA flag を toggle した瞬間に venue-card ↔ /venues/[id] photo morph が即時 activate する状態になる。 future enable のコストは config 1 行
- **a11y 準拠**: `prefers-reduced-motion: reduce` で View Transitions 全体 (将来 enable 時を含む) が 0 秒化。 motion-sensitive ユーザーは morph を見ない
- **MPA 用 `@view-transition` rule が Next.js App Router では no-op になる事実を docs に明記** したため、 「effort をかけたのに効かない」誤解の再発を防ぐ

悪かった点 / 後始末:

- **試作の "見える効果" は今は出ない**: SPA flag 無効のまま name だけ付けても画面上は何も変わらない。 dev で morph を試したい場合は `next.config.ts` を一時 `viewTransition: true` に変えて、 `npm run dev` で venue-card → 詳細遷移を観察する手順 (本 ADR §"Future enable 手順" 参照)
- **`viewTransitionName` inline style が venue id 文字列をそのまま class 級にバインド**: venue id は cuid / uuid なので CSS ident として安全だが、 万一未来の ID 戦略が記号を含む形に変わったら `.replace(/[^a-zA-Z0-9_-]/g, '-')` 等の sanitize が要る (現時点では不要)
- **flag 有効化時の "1 surface enable / 全画面有効" のスコープ問題は未解決**: React `<ViewTransition>` を使うと flag 全体が有効になり、 `<BottomNav>` 跨ぎの遷移にも transition が発火する。 これを scoped に抑える方法 (path-based skip / `transitionTypes` で除外 / overlay 化) は flag 有効化と同タイミングで設計が必要 — 後述

## Alternatives considered

- **A. `experimental.viewTransition: true` に戻して React `<ViewTransition>` で venue-card → 詳細だけ使う**: 過去 thrash 判断を覆す根拠が無い (mobile 検証 / latency 計測がまだ)。 1 surface のために mobile tab switch を犠牲にできない
- **B. `next/dynamic` 等で venue-card だけ条件付き transition wrap**: Next.js / React の View Transitions API は flag グローバル制御。 component 単位で opt-in する公式 API は無い
- **C. View Transitions を全部諦めて `framer-motion` の layoutId で venue-card → 詳細を morph**: 動くが、 React server components から client component に押し下げが必要、 prefetch 周りの latency も悪化、 bundle に framer-motion を増やす (Phase 2.D で `optimizePackageImports` に入れているとはいえ初期 client bundle に乗る)。 標準 API で済むなら標準で
- **D. 何もしない (PENDING の Tier 3 X-9 を 🟢 凍結する)**: 一案だが、 a11y の `prefers-reduced-motion: reduce` フォールバックは MPA 用 `@view-transition` のためにも整備したい。 完全凍結よりも foundation だけ進める方が後々のコスト安い

## Future enable 手順 (将来 SPA 化したくなったら)

1. **過去 thrash の再現条件を計測** — 当時の commit / PR があれば mobile (375px) で `npx playwright test --project="Mobile Chrome"` 経由で latency 計測。 navigation timing API で `<BottomNav>` 跨ぎ遷移の Total Blocking Time を見る。 計測値の根拠なしに `true` に戻さない
2. **scope を制限する戦略を決める**:
   - 案 a) `<BottomNav>` 経由の遷移 (= 4 タブ間) には View Transitions を発火させない。 `transitionTypes` を使って opt-out したリンクには `transitionTypes={[]}` で実質スキップ
   - 案 b) detail 遷移 (`/venues/[id]` 等) のみ `<ViewTransition>` でラップし、 タブ切替は `<Link>` のまま
3. **`next.config.ts:29` を `viewTransition: true` に変更し、 同 PR で本 ADR を Superseded by NNNN にする** (新 ADR で "View Transitions SPA enable" を起票)
4. その時点で `view-transition-name` 名前体系は既に存在するため、 venue-card / venue-photo-gallery 側のコード変更は **不要**
5. dev で観察するだけなら、 `next.config.ts` を **一時的に** `true` に変えて `npm run dev` を立ち上げ、 venue 一覧 → 詳細を Chrome (mobile emulation 375px) で踏む。 morph が見える / mobile タブ切替で thrash しないか目視。 commit せず revert

## References

- 過去判断 (失敗モード): `next.config.ts:27-29` のコメント — "both-page DOM coexistence during transition caused net-negative latency on mobile tab switches (body thrash)"
- React + Next.js integration: https://nextjs.org/docs/app/guides/view-transitions / https://nextjs.org/docs/app/api-reference/config/next-config-js/viewTransition
- 既存 MPA 用 rule: `src/app/globals.css` `@view-transition { navigation: auto; }` (本 ADR で comment 拡張)
- a11y 仕様: https://www.w3.org/TR/css-view-transitions-1/#privacy-considerations / Next.js docs "Disable View Transitions for Reduced Motion"
- 関連 ADR: [0001 Next.js 16 App Router](./0001-nextjs-16-app-router.md) / [0004 dark-mode color-mix migration](./0004-dark-mode-color-mix-over-opacity.md) (前回 a11y 系の不可逆判断パターン)
- 由来 task: `docs/PENDING.md` Tier 3 X-9 (本 ADR で 🟡 試作前進、 SPA enable は将来 ADR で扱う)
