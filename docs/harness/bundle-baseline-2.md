# Bundle Baseline 2 — Phase 4 launch readiness

**作成**: 2026-05-03 (paneA、Phase 4 launch readiness)
**前 baseline**: round 9 baseline 437 KB First Load JS (出典: 当時の audit メモ)
**Target**: 350 KB First Load JS (-20 % 目標)
**観測時点 commit**: develop tip (= `560d7f3` ベース) + `@next/bundle-analyzer`
を `next.config.ts` に wrap した状態 (`ANALYZE=true npm run build:local` で
analyzer が有効化される)

> **読み方**: Next 16.2 + Turbopack ビルドでは route 別 `First Load JS` table
> が build output に出ない。代わりに `.next/static/chunks/*.js` の **実 file
> size** から chunk-level baseline を取って、Top 10 の chunk が下記表。dynamic
> import 候補は § 3 に列挙、優先度を付けてある。

---

## 0. 計測手順 (再現可能)

```bash
# Phase 4 で next.config.ts に @next/bundle-analyzer を wrap してある
cd <worktree>
npm run analyze   # = ANALYZE=true next build

# Turbopack mode では analyzer の HTML report は .next/analyze/ に
# 出ないことがある。代わりに chunk file size を直接集計:
find .next/static/chunks -name "*.js" -printf "%s %p\n" \
  | sort -nr | head -20 \
  | awk '{printf "%.1f KB  %s\n", $1/1024, $2}'

# 全 chunk の合計 (parsed bytes — gzipped ではない):
find .next/static/chunks -name "*.js" -printf "%s\n" \
  | awk '{s+=$1} END {printf "%.1f KB total\n", s/1024}'
```

`gzip` 後のサイズに換算する場合は ~30-35 % が経験則の比率 (3.78 MB parsed
≒ 1.2 MB gzipped 程度を見込む)。

---

## 1. 現状観測 (2026-05-03)

### 全体

| 指標 | 値 |
|---|---|
| chunk 総数 (`.next/static/chunks/*.js`) | **108** |
| chunk 合計 (parsed) | **3,873 KB** (≈ 3.78 MB) |
| 推定 gzipped 合計 | ≈ 1,200 KB (35 % 換算) |
| 最大 chunk | **434.9 KB** (parsed) |
| 推定 First Load (max + 共通 vendor 概算) | **≈ 430 KB** parsed / **≈ 130 KB** gzipped |

**前 baseline (round 9) の 437 KB に対して 430 KB**。誤差 1.6 % で **ほぼ横ばい**
— 機能を D1〜D6 + Phase 3 L2/L3 + Phase 4 launch readiness 分追加しているのに
ほぼ同サイズに収まっているのは round 9 後の polish (`landing-page.tsx`,
`candidates-view.tsx`, `photo-carousel.tsx`, `estimate-waterfall-chart.tsx`,
`canvas-confetti` lazy import など) が効いている証拠。

### Top 10 chunk

| # | Size (parsed) | File |
|---|---|---|
| 1 | 434.9 KB | `0dq2iirynihbr.js` (推定: framer-motion + main vendor) |
| 2 | 323.1 KB | `11sznpnfwfnr_.js` |
| 3 | 227.6 KB | `15.7olfc3phtm.js` |
| 4 | 201.0 KB | `0lk36s0qbcl8f.js` |
| 5 | 179.5 KB | `01jcq5ly8dpgu.js` |
| 6 | 123.4 KB | `0lef1wei6_jp5.js` |
| 7 | 110.0 KB | `03~yq9q893hmn.js` |
| 8 | 106.7 KB | `0xl-wmcn71whl.js` |
| 9 | 106.7 KB | `0mt4~.xy0547a.js` |
| 10 | 104.7 KB | `06is4m5dlxekt.js` |

> Turbopack の chunk file 名はハッシュ短縮されており、どの module が含まれて
> いるかは file 名から判別できない。webpack-mode 互換ビルドが必要なときは
> `.next/build/chunks/` の build manifest を参照すること。

---

## 2. 既存 dynamic-import の効き具合

`grep -rln "next/dynamic" src` で既に lazy 化済の 4 surface:

| ファイル | 何を lazy 化したか |
|---|---|
| `src/components/landing/landing-page.tsx` | `demo-sequence.tsx` (intersection で hydrate) |
| `src/components/candidates/candidates-view.tsx` | tab content (compare / decision タブ別) |
| `src/components/venues/photo-carousel.tsx` | embla-carousel ラッパー |
| `src/components/venues/estimate-waterfall-chart.tsx` | recharts 本体 (`estimate-waterfall-chart-impl.tsx`) |

加えて:

- `src/components/decision/decision-ceremony.tsx:98` で `canvas-confetti` を
  await import (ceremony 1 度きりの演出のため)
- `src/components/providers/motion-provider.tsx` で framer-motion `LazyMotion`
  + `domAnimation` features を loading

→ 「**主要重い ライブラリで簡単に lazy 化できる箇所はほぼ消化済**」が現状。

---

## 3. Dynamic-import 追加候補 (target 350 KB を狙うなら)

### 🟡 候補 A: `@tanstack/react-virtual` の callsite を lazy 化 (推定 -30〜50 KB)

callsite 2 箇所で usage:

- `src/components/explore/explore-content.tsx:5` — `useWindowVirtualizer`
- `src/components/coach/session-history-sheet.tsx:6` — `useVirtualizer` (376 行)

両方とも **interaction 後にしか必要ない** (explore は scroll、session-history は
sheet open)。`next/dynamic` で wrap すると初回 paint から外せる。

**ただし**: explore-content は `/explore` の主要 view、初回訪問の頻度が高く、
hydrate 遅延が顕著に出る可能性。session-history-sheet (sheet 内 history) の
方が安全な lazy 候補。

**推定効果**: -30〜50 KB (react-virtual + 内部依存)
**リスク**: 中 — explore は躊躇、coach session sheet は安全
**所要**: 30 分

### 🟡 候補 B: framer-motion 重い surface の `LazyMotion` 完全移行 (推定 -40〜80 KB)

12 ファイル中 4 箇所が `motion.div` 直接利用 (full features を pull):

- `src/app/(demo)/demo/venues/[id]/page.tsx`
- `src/app/(auth)/signup/page.tsx`, `(auth)/login/page.tsx`
- `src/components/landing/demo-sequence.tsx`
- `src/components/landing/landing-page.tsx`
- `src/components/explore/add-venue-sheet.tsx`
- `src/components/explore/venue-name-search.tsx`
- `src/components/onboarding/onboarding-hero.tsx`

`MotionProvider` (`motion-provider.tsx`) は `LazyMotion` + `domAnimation` を
load しているが、各 callsite が `motion.div` で full set を要求している場合
fallback で full bundle が引かれる可能性。

**全 12 callsite を `<m.div>` (LazyMotion 配下) に書き換える** のが正攻法だが、
影響範囲大 (landing / signup / explore / onboarding すべて touch)。

**推定効果**: -40〜80 KB (framer-motion full → lazy domAnimation 差分)
**リスク**: 高 — landing の hero motion は最重要 surface、視覚回帰チェック必須
**所要**: 2-3 h

### 🟢 候補 C: `recharts` の追加 lazy 化 (現状ほぼ消化済)

`src/components/venues/estimate-waterfall-chart-impl.tsx` のみ recharts 使用
で、それ自体が dynamic import 配下。**追加最適化の余地は薄い**。

### 🟢 候補 D: `embla-carousel-react` の callsite 再点検

`photo-carousel.tsx` で lazy 化済だが、他 callsite (`src/**/*.tsx` で grep)
があれば追加 lazy 化候補。**今回は不在を確認済**、対象なし。

### 🔴 候補 E (推奨最優先): `react-hook-form + zod resolver` を form-heavy
surface のみで load する

`@hookform/resolvers + react-hook-form` は signup / settings / feedback / search
form 等で widely 使われる。各 callsite が server component から渡される
データに依存して mount するなら、**各 form を `next/dynamic` で wrap** する
余地。

**推定効果**: -50〜70 KB (主に First Load から外す)
**リスク**: 低-中 — form mount に 1 frame の遅延が出るが、operator-tool 含め
許容範囲
**所要**: 2-3 h

---

## 4. CI 上の bundle-size guard (今 round では未追加)

`.github/workflows/ci.yml` に bundle-size チェック job を足す案:

```yaml
bundle-size:
  name: Bundle size guard
  runs-on: ubuntu-latest
  needs: [build]
  steps:
    - uses: actions/checkout@v5
    - uses: actions/setup-node@v5
      with: { node-version: '22', cache: npm }
    - run: npm ci
    - run: npx prisma generate
    - name: Build (no analyze)
      run: npm run build:local
      env:
        NEXT_PUBLIC_SUPABASE_URL: https://placeholder.supabase.co
        NEXT_PUBLIC_SUPABASE_ANON_KEY: placeholder
        DATABASE_URL: postgresql://placeholder:placeholder@localhost:5432/placeholder
    - name: Check largest chunk size
      run: |
        MAX=$(find .next/static/chunks -name '*.js' -printf '%s\n' | sort -nr | head -1)
        MAX_KB=$((MAX / 1024))
        echo "Largest chunk: ${MAX_KB} KB"
        # Hard fail at 500 KB (current baseline 435 KB + 15 % headroom)
        if [ "$MAX_KB" -gt 500 ]; then
          echo "::error::Largest chunk ${MAX_KB} KB exceeds 500 KB ceiling"
          exit 1
        fi
        # Soft warn at 450 KB (current + 3.5 %)
        if [ "$MAX_KB" -gt 450 ]; then
          echo "::warning::Largest chunk ${MAX_KB} KB approaching 500 KB ceiling"
        fi
```

**判断**: 今 round では起票のみ。実装は次 round に持ち越す (本 round の cap 3h
内では launch-day-checklist + alert wiring + ci.yml minor 拡張を優先)。

---

## 5. 結論 + 次アクション

- **現状 First Load 推定 ≈ 430 KB** = round 9 baseline 437 KB から横ばい
  → 機能追加分が polish で吸収できている
- **target 350 KB** に到達するには上記 § 3 候補 A + E (合計 -80〜120 KB) を
  消化すれば計算上届く
- **しかし launch 前に着手するかは別問題**: 350 KB は nice-to-have であって
  blocker ではない。launch 後 7 日 baseline (Vercel Speed Insights の実測値)
  を見てから判断するのが順序

### 次の round の paneA dispatch 候補 (D6 形式で起票するなら)

```
【実装タスク E1】@tanstack/react-virtual lazy 化 (session-history-sheet.tsx)。
- coach の sheet open 後にしか必要ない。next/dynamic で wrap、ssr: false
完了条件: lint/tsc/test/build GREEN + bundle-baseline-2.md の Top 10 chunk
を再観測し、最大 chunk が -20〜40 KB 縮んだことを確認。所要 30 分。

【実装タスク E2】form-heavy surface の react-hook-form lazy 化。
- signup / settings / feedback / saved-search-form の 4 箇所を next/dynamic で
  wrap。Server Component が initial data を渡す pattern を維持。
完了条件: lint/tsc/test/build GREEN + 4 form の hydrate 動作確認 (375px) +
bundle-baseline-2.md 再観測で First Load が -50〜70 KB 縮む。所要 2-3 h。
```

---

## 関連ドキュメント

- `docs/harness/runbook.md` — 開発フロー全体
- `docs/release/launch-day-checklist.md` — Beta launch 直前手順 (本 doc は launch 後 7 日 baseline 取得の元資料)
- `next.config.ts` — `@next/bundle-analyzer` wrap 設定 (Phase 4 launch readiness で追加)
- `package.json` — `npm run analyze` script (Phase 4 launch readiness で追加)

---

## 履歴

- 2026-05-03 (paneA、Phase 4 launch readiness): 初版作成、`@next/bundle-analyzer`
  + `npm run analyze` script を導入、現状 chunk size の baseline 取得
- (前) round 9: First Load JS 437 KB (出典は当時の audit メモ — 本 doc では
  比較基準値として参照)
