# Audit Sub-A2 — AIコーチ / オンボーディング 審美監査

**対象**: `src/app/(app)/coach/**/*.tsx` / `src/app/(app)/onboarding/**/*.tsx` / `src/components/coach/*` / `src/components/onboarding/*`
**DESIGN.md 準拠**: v4.2 "Modern Luxury · Editorial Refresh"（Shippori Mincho 300-400 / icon 16-20-24 / motion `--dur-tap 150 / --dur-micro 200 / --dur-fade 300 / --dur-hero 900`）
**作成日**: 2026-04-17
**監査スコープ**: 2 画面 + coach 周辺 6 コンポーネント
**実装触らず。この md だけ追記。**

---

## エグゼクティブ・サマリ

| 画面 | 総合 | 一言 |
|---|---|---|
| AIコーチ (`/coach`) | **3.0 / 5** | sticky header は刷新済み。しかし chat bubble・quick-start カード・empty は v4.2 以前のまま放置。gold/rose の出し所が曖昧で「AIの金色」が通っていない |
| オンボーディング (`/onboarding`) | **2.6 / 5** | intro 画面は編集的で好感。質問本体は `ChatBubble` と `PillOptions` が噛み合わず、進捗と質問が並列に見える。レコメンド画面は 20 年前の白カードに戻っている |

**共通の病巣**:
1. **半端 px の密集** — `text-[10.5px]` / `text-[11.5px]` / `text-[12.5px]` / `text-[14.5px]` / `text-[17.5px]` が 15+ 箇所。fluid token (`--text-fluid-xs` 等) を経由していない
2. **アイコン半端値** — `h-3 w-3`（12px）、`h-3.5 w-3.5`（14px）が coach 下で常用。DESIGN.md では **16 / 20 / 24 のみ**許容
3. **gold が薄い** — Coach は「AI=ゴールド」の旗艦画面のはずが、avatar の `w-8 h-8` + inside icon `w-4` という小さなアクセントに留まり、本文側（バブル中身）はフラットな `bg-card`
4. **空ステートの格差** — `coach/quick-start` の情報量と `onboarding` レコメンド画面（薄い枠カード + `Button variant="outline"` 並べ）の格差が激しい。後者は「20 年前」そのもの
5. **モーション統一なし** — `duration-150` / `duration-200` / `duration-500` / `0.32s` が混在。`--dur-*` を Tailwind arbitrary で呼べていない

---

## 画面 1: AIコーチ（/coach）

**File**: `src/app/(app)/coach/page.tsx` + `src/components/coach/*.tsx`
**総合スコア**: **3.0 / 5**
**ひとこと要約**: sticky header（coach-client.tsx:67-104）と history-chip は刷新済み & 品よく纏まっている。が、下へスクロールするほど「昔の Haretoki」が顔を出す。chat bubble のタイムスタンプ欠落、quick-start カードの `text-[15px] extralight` 見出しが本文 `text-sm medium` に負ける逆転、空状態と履歴シート内 `text-xs` の不用意な落差。

### 6 段階 × 13 観点マトリクス

| # | 観点 | Score | 所見 |
|---|---|---|---|
| 1 | Typography scale の秩序 | **2 / 5** | `coach-client:74`=`text-[10.5px]`、`:80`=`text-[14.5px]`、`night-question-card:43`=`text-[17.5px]`、`quick-start:109-149`=`text-[11.5px] / [15px] / [10.5px]`、`agreements:133/138/144/154/169/197/208`=`text-[11.5px] / [15px] / [12.5px] / [10.5px]` と 0.5px 刻みの中間値が 10+ 箇所。DESIGN.md の fluid token (`--text-fluid-xs .. fluid-3xl`) を経由していないので、viewport を揺らすと崩れる |
| 2 | 余白リズム（4px grid） | **3 / 5** | `gap-2.5 / gap-1.5 / gap-3.5` が chat-bubble と chat-bar 周辺に散在（`chat-bubble:45`, `coach-client:74`, `session-history-sheet:194`）。大枠は `space-y-5 / space-y-6` で秩序だがマイクロ部位で破れる |
| 3 | カラー使用の一貫性（gold = AI） | **2 / 5** | 「AI の発話＝gold」の旗艦のはずが、assistant bubble 本体は `bg-card + border-border/60`（chat-bubble:57）でフラット。gold は avatar の 8px 円内のみ。逆に chat-bar 送信ボタンは `bg-primary`（=Rose）で Rose と gold の役割が曖昧。オンボーディングと違いここでは gold を主役にすべき |
| 4 | アイコンサイズ統一（16/20/24） | **1 / 5** | 半端値の温床。`chat-bar:207` Sparkles `h-3 w-3` (12px)、`coach-quick-start:162,164` `h-3 w-3`、`agreements:164` `h-3 w-3`、`session-history-sheet:156,163` `h-3.5 w-3.5` (14px)、`night-question-card:36` `h-3.5 w-3.5`。**DESIGN.md の 16/20/24 原則違反**が計 6 箇所 |
| 5 | z-index 衝突 | **4 / 5** | sticky header `z-20`、chat-bar `z-40`、RowMenu overlay `z-40/50` は分離されている。ただし `RowMenu` の `z-40 inset-0` overlay と `chat-bar`（`z-40`）が**同じ階層**。sheet を開いた状態で RowMenu を出した場合のスタック順が曖昧 |
| 6 | 要素バランス（バブル・アバター） | **3 / 5** | assistant avatar 32px + bubble max-w-80% はバランス良し。しかし bubble 内にタイムスタンプ・sender 名のメタ情報がゼロ → 「2026 年の AI チャット UI」としてはミニマル過ぎ（Pi / Character.ai は送信直後の relative time を薄く出す）。また quick-start の 3 カード内で icon 20px に対し見出しが `text-sm medium`（= 14px 太字）、サブが `text-xs`（12px light）で**視覚重みの逆転**（icon → heading → sub の減衰が効かない） |
| 7 | 375px 情報密度 | **3 / 5** | 375px × 667 viewport で sticky header(~56px) + segmented(~60px) + NightQuestion(~180px) + QuickStart の見出し(~40px) = 336px を消費。fold 内にクイックスタートカード 1 枚しか見えない。モバイルで「まず 3 枚全部見える」にすべき |
| 8 | 明朝 × ゴシック | **4 / 5** | 見出しは `font-display` = Shippori Mincho を 6 箇所で使用（coach-client:80, quick-start:112/135, agreements:138, night-question-card:29/43）。本文は Noto Sans JP。順当。ただし **assistant の返答テキスト**に明朝を使う余地あり（v4.2 の「editorial」を体現するチャンス、Pi のヒト格を帯びた明朝採用と同路線） |
| 9 | tabular-nums | **2 / 5** | Coach 側では**未適用**。session-history-sheet の `relativeTime()`（:237 `text-[10px]`）、chat-bubble に時刻が出ない、night-question の「今夜の一問」ラベルにも数字なし → 致命ではないが、将来時刻メタを入れるときは必要 |
| 10 | 空 / ローディング / エラー | **3 / 5** | `loading.tsx` は実レイアウト一致で良質。空状態 `CoachQuickStart` + `NightQuestionCard` もコンセプト◎。しかし**初送信後に assistant が応答を返す前**の typing-dot インジケータは `chat-bubble.tsx:12-35` の 1.5px 金ドット × 3 のみで、「コーチが考えています…」等の**言語的コンテクスト**なし。20 年前のローダに見えるリスク |
| 11 | マイクロインタラクション | **3 / 5** | Send ボタン active:scale-[0.93]、カード active:scale-[0.98]、chip active:scale-[0.97] と値が**不統一**。全部 `--dur-tap 150ms` に揃えるべき。また send 後の「成功した」ハプティック等価（HaloTap ring）が不在 |
| 12 | ダークモード対応 | **3 / 5** | `bg-card / text-foreground / var(--gold-warm)` と token ベースなので大枠 OK。ただし `chat-bubble:57` の `border-border/60` と `bg-card` の組み合わせは **dark モード時にほぼ見えない枠**（darkの border はデフォで透明度低）。chat-bar `bg-card/80 backdrop-blur-xl`（chat-bar:198）は dark で `bg-black/?` に自動 swap されるが、DESIGN.md の dark frosted 規約（`bg-black/60`）とずれがあり確認要 |
| 13 | コピー trust/voice | **4 / 5** | 「なんでも気軽に聞いてください」（chat-bar:221）、「気づきは、これから」（coach-client:160）、「どんなこと、話そう？」（quick-start:113）はトーン一致。丁寧体で急かさない。ただしモーダル/シート内 `操作メニュー`（session-history-sheet:134）は機能語すぎる。「このメモの操作」等へ |

### Before → After（5 件、実装粒度）

#### 1. Assistant チャットバブルを「AI =ゴールド hairline + 明朝本文」に格上げ — **P1 / M**

- File: `src/components/coach/chat-bubble.tsx:52-57`
- Before:
  ```tsx
  <div
    className={cn(
      "max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap",
      role === "user"
        ? "rounded-br-sm bg-primary text-primary-foreground"
        : "rounded-bl-sm border border-border/60 bg-card text-foreground"
    )}
  >
  ```
- After:
  ```tsx
  <div
    className={cn(
      "max-w-[80%] rounded-2xl px-5 py-[14px] text-[15px] leading-[1.75] whitespace-pre-wrap",
      role === "user"
        ? "rounded-br-sm bg-primary text-primary-foreground tracking-[0.005em]"
        : "rounded-bl-[6px] border border-[color:var(--hairline-gold)] bg-[color-mix(in_oklab,var(--gold-subtle)_38%,var(--card))] font-[family-name:var(--font-display)] font-light tracking-[0.01em] text-foreground"
    )}
    style={
      role === "assistant"
        ? { boxShadow: "inset 0 1px 0 rgba(255,255,255,0.6), 0 1px 2px color-mix(in oklab, var(--gold-warm) 8%, transparent)" }
        : undefined
    }
  >
  ```
- Why: 旗艦の AI 画面で AI 発話が白カードというのは「2026 年最新」から最も遠い。`--hairline-gold` + `gold-subtle 38%` tint + 明朝 light = editorial な発話。v4.2 の「明朝 × gold hairline」を**コーチ本体に通す**。user 側も行間 1.5 → 1.75 で呼吸が出る。Pi / Character.ai が「ヒト格を帯びる AI」を明朝と淡い地色で表現しているのと同路線。

#### 2. メタ情報（時刻 + 主語）を添え物として導入 — **P1 / S**

- File: `src/components/coach/chat-bubble.tsx:46-70`（motion.div の直下に `time` を追加）
- Before: （メタ情報が一切ない。タイムスタンプ・"AIコーチ" ラベル 0）
- After: `ChatBubble` に `timestamp?: Date` props を追加し、role === "assistant" のとき bubble の**上側 left**に以下を配置:
  ```tsx
  {role === "assistant" && (
    <p
      aria-hidden="true"
      className="mb-1 ml-10 flex items-center gap-1.5 text-[11px] tracking-[0.16em] uppercase text-muted-foreground/70 tabular-nums"
    >
      <span className="text-[var(--gold-warm)]/80">coach</span>
      {timestamp && (
        <>
          <span aria-hidden className="opacity-40">·</span>
          <time dateTime={timestamp.toISOString()}>
            {new Intl.DateTimeFormat("ja-JP", { hour: "2-digit", minute: "2-digit" }).format(timestamp)}
          </time>
        </>
      )}
    </p>
  )}
  ```
  `ChatHistory` からは `msg.createdAt` を forward（`server/actions/coach` が既に updatedAt を持つので読み替え）。
- Why: 20 年前批判の核は「**誰がいつ**言ったか分からない文字列が並んでいるだけ」。Character.ai も Pi も必ず 11px で"sender + time"を tabular-nums で添える。tracking 0.16em + uppercase で本文との tier 差を付け、決して邪魔しない添え物に。

#### 3. タイピングインジケータに「コーチが考えています…」の言語コンテクストを添える — **P2 / S**

- File: `src/components/coach/chat-bubble.tsx:12-35`
- Before:
  ```tsx
  function TypingDots() {
    const dots = [0, 1, 2];
    return (
      <div aria-label="入力中" className="flex items-center gap-1 py-0.5">
        {dots.map((i) => (
          <motion.span
            key={i}
            className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--gold-warm)]"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 0.6, repeat: Infinity, ease: "easeInOut", delay: i * 0.15 }}
          />
        ))}
      </div>
    );
  }
  ```
- After:
  ```tsx
  function TypingDots() {
    const dots = [0, 1, 2];
    return (
      <div
        aria-label="コーチが考えています"
        className="flex items-center gap-2 py-0.5"
      >
        <span className="text-[12px] tracking-[0.02em] text-muted-foreground/80 font-[family-name:var(--font-display)] font-light">
          コーチが考えています
        </span>
        <span className="flex items-center gap-[3px]">
          {dots.map((i) => (
            <motion.span
              key={i}
              className="inline-block h-[5px] w-[5px] rounded-full bg-[var(--gold-warm)]"
              animate={{ opacity: [0.25, 1, 0.25], y: [0, -2, 0] }}
              transition={{ duration: 0.9, repeat: Infinity, ease: [0.16, 1, 0.3, 1], delay: i * 0.12 }}
            />
          ))}
        </span>
      </div>
    );
  }
  ```
- Why: (1) ストリーミングがまだ 1 chunk も届いていない一瞬（chat-bar.tsx:130 `setInFlight({ assistantText: "" })` 直後）は体感で長い。言葉を添えて「待たせている」感を言語化。(2) dot の `y: [0, -2, 0]` で pulsing → tiny-bounce に昇格。(3) ease を `--ease-out-luxe` 相当 `cubic-bezier(0.16,1,0.3,1)` に統一。Pi の typing indicator が「…」ではなく**品詞を含む短文**（"Pi is thinking…"）で信頼感を演出しているのと同じ思想。

#### 4. QuickStart 3 カードを「icon 24 + 明朝 17px + gold hairline gradient」に editorial 刷新 — **P1 / M**

- File: `src/components/coach/coach-quick-start.tsx:122-144`
- Before:
  ```tsx
  <button
    key={uc.title}
    type="button"
    onClick={() => preFill(uc.prompt)}
    aria-label={`${uc.title}。チャット入力欄に質問文を入れます`}
    className="flex min-h-[88px] w-full flex-col gap-2 rounded-2xl border border-border/60 border-l-[3px] border-l-[var(--gold-warm)] bg-card p-5 text-left transition-all duration-150 hover:bg-[var(--gold-subtle)]/30 active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100"
  >
    <Icon aria-hidden="true" className="h-5 w-5 text-[var(--gold-warm)]" strokeWidth={1.5} />
    <div className="space-y-1">
      <h3 className="font-[family-name:var(--font-display)] text-sm font-medium leading-snug text-foreground">
        {uc.title}
      </h3>
      <p className="text-xs leading-relaxed text-muted-foreground">
        {uc.subtitle}
      </p>
    </div>
  </button>
  ```
- After:
  ```tsx
  <button
    key={uc.title}
    type="button"
    onClick={() => preFill(uc.prompt)}
    aria-label={`${uc.title}。チャット入力欄に質問文を入れます`}
    className="group flex min-h-[112px] w-full flex-col justify-between gap-4 rounded-[20px] border border-[color:var(--hairline-gold)] bg-gradient-to-br from-[var(--card)] to-[color-mix(in_oklab,var(--gold-subtle)_22%,var(--card))] p-5 text-left transition-[transform,box-shadow,background-color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] hover:-translate-y-[1px] hover:shadow-[0_8px_24px_color-mix(in_oklab,var(--gold-warm)_12%,transparent)] active:scale-[0.98] motion-reduce:transition-none motion-reduce:hover:translate-y-0 motion-reduce:active:scale-100"
  >
    <div className="flex items-center justify-between">
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--gold-subtle)]">
        <Icon aria-hidden="true" className="h-5 w-5 text-[var(--gold-warm)]" strokeWidth={1.5} />
      </span>
      <span
        aria-hidden="true"
        className="text-[10px] uppercase tracking-[0.2em] text-[var(--gold-warm)]/70 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
      >
        prompt →
      </span>
    </div>
    <div className="space-y-1.5">
      <h3 className="font-[family-name:var(--font-display)] text-[15.5px] font-light leading-[1.5] tracking-[0.01em] text-foreground">
        {uc.title}
      </h3>
      <p className="text-[12.5px] leading-[1.7] text-muted-foreground">
        {uc.subtitle}
      </p>
    </div>
  </button>
  ```
- Why:
  - (1) 左 3px gold border「だけ」の装飾は v3 の汎用パターン。v4.2 editorial では `gold-subtle` gradient + `--hairline-gold` の方が**より「air、not paint」** の思想に合う。
  - (2) icon を `h-10 w-10` の gold-subtle 円に入れ、アイコン本体は 20px（=DESIGN.md 許容サイズ）→ 「AI から贈り物」の感覚。
  - (3) 見出し `text-sm medium`（14px・ゴシック太字）は明朝の美しさを殺していた。`text-[15.5px] font-light` にするとシッポリ明朝が効く。
  - (4) hover で `-translate-y-[1px]` + 影、および `prompt →` ヒントを fade-in → 「タップでチャットに入る」を直感化。
  - (5) `duration-150` → `duration-200` で `--dur-micro` に揃え、`ease-[cubic-bezier(0.16,1,0.3,1)]` を明示。
  - **競合根拠**: Character.ai / Pi のどちらも prompt suggestion は「card 化 + hover lift + icon in tinted circle」が黄金比。Dribbble 2026 のチャット UI インスピレーションでも同パターンが主流（[Muzli](https://muz.li/inspiration/chat-ui/)）。

#### 5. Sticky header 内「HARETOKI · Coach」eyebrow を `text-fluid-xs` token 経由で秩序化 — **P2 / S**

- File: `src/components/coach/coach-client.tsx:73-85`
- Before:
  ```tsx
  <p className="flex flex-wrap items-center justify-center gap-1.5 text-[10.5px] tracking-[0.2em] uppercase text-muted-foreground">
    <span className="font-medium text-[var(--gold-warm)]">HARETOKI</span>
    <span aria-hidden="true" className="opacity-30">·</span>
    <span>Coach</span>
  </p>
  <h1
    className="truncate font-[family-name:var(--font-display)] text-[14.5px] font-extralight tracking-[0.02em] text-foreground"
    title={title}
  >
    {title}
  </h1>
  ```
- After:
  ```tsx
  <p className="flex flex-wrap items-center justify-center gap-1.5 text-[11px] tracking-[0.22em] uppercase text-muted-foreground/80 tabular-nums">
    <span className="font-medium text-[var(--gold-warm)]">HARETOKI</span>
    <span aria-hidden="true" className="opacity-30">·</span>
    <span>Coach</span>
  </p>
  <h1
    className="mt-0.5 truncate font-[family-name:var(--font-display)] text-[15px] font-extralight leading-[1.35] tracking-[0.015em] text-foreground"
    title={title}
  >
    {title}
  </h1>
  ```
- Why: `10.5px / 14.5px` の 0.5px 刻みはスクリーンショット時の antialias で滲む。`11px + 15px` に整え、tracking を 0.2em→0.22em で「プレミアム」感を底上げ。`leading-[1.35]` と `mt-0.5` で eyebrow と title の**空気層**を作る（`flush` 状態だと詰まって見える）。

#### 6.（ボーナス）ChatBar 送信ボタンに Halo Tap ring を適用 — **P2 / S**

- File: `src/components/coach/chat-bar.tsx:231-243`
- Before: `<button className="flex h-12 w-12 items-center justify-center rounded-full bg-primary ...">`
- After: `<HaloTap><button className="flex h-12 w-12 ...">...` （`src/components/ui/halo-tap.tsx` を wrap）
- Why: v4.2 の HaloTap は Hero NBA / Explore FAB / DecisionCeremony に適用済み。**コーチの「送信」**は AI との対話を開始する最重要 CTA。gold ring が 250ms 広がる演出は「送ったぞ、届いたぞ」の心理的確証を生む。コストは HOC 1 つの wrap だけ。

---

## 画面 2: オンボーディング（/onboarding）

**File**: `src/app/(app)/onboarding/page.tsx` + `src/components/onboarding/*.tsx`
**総合スコア**: **2.6 / 5**
**ひとこと要約**: intro 画面（step === -1）は editorial に振れていて良い（明朝 24px + `Haretoki` eyebrow + 3 ステップ序列）。一方**質問フェーズ**は `ChatBubble` と `PillOptions` と `SkyChip` 進捗が縦に無造作に積まれ、「AI と対話している」のか「フォーム入力」なのかが視覚的に曖昧。**レコメンド画面**（showRecommendations === true）は rose 枠薄カード + `Button variant="outline"` を 3 枚並べるだけで、Haretoki 全体の格に釣り合わない "20 年前" の住人。

### 6 段階 × 13 観点マトリクス

| # | 観点 | Score | 所見 |
|---|---|---|---|
| 1 | Typography scale の秩序 | **3 / 5** | intro 見出し `text-2xl font-extralight`（:399）は良い。が質問フェーズの chat-bubble（text-sm、ChatBubble 側で定義）と subtitle `text-xs text-muted-foreground`（:510）が**同じ格**で並び、どちらが主かわからない。レコメンドカードは `font-medium`（:313）でラグジュアリーの反対 |
| 2 | 余白リズム | **3 / 5** | intro は `gap-10 / space-y-5 / space-y-4` と 4px grid 秩序立つ。質問は `space-y-4 / space-y-6` 混在。レコメンドカード内 `space-y-2`（:309）と `space-y-1`（:312）が近接しすぎて「整理されていない」印象 |
| 3 | カラー使用の一貫性 | **2 / 5** | Rose（primary）が CTA、gold が AI のはずが、**intro の数字バッジ** は gold-subtle + gold-warm（:409）で OK、**質問進捗** も gold gradient（:492）、**レコメンド header** も gold（:288）。ここまで gold 一色。しかし**「追加する」ボタン**（:333）は `variant="outline"` = 無色。AI の提案をユーザーが確定する行為は **rose primary CTA**にすべき |
| 4 | アイコンサイズ統一 | **3 / 5** | Sparkles `h-4 w-4`（16px ×2）、Loader2 `h-4 w-4`、Plus `h-4 w-4` は DESIGN.md 許容。しかし intro 数字バッジ `h-7 w-7`（:409）= 28px は**半端値**（24 or 32 のどちらかに）。また `SkyChip size={40}`（:481）は許容値（40/56/64 のみ）だが、文脈は compact なのでそのまま OK |
| 5 | z-index 衝突 | **5 / 5** | intro/質問/レコメンド全ページで `fixed` 要素なし、sticky なし。衝突なし |
| 6 | 要素バランス | **2 / 5** | 質問フェーズの決定的欠陥:<br>**SkyChip 40px（進捗メタファー）** + **`{step+1}/{length}` eyebrow** + **gold gradient bar** が**横並び**になり（:469-497）、その下に**chatHistory.map ChatBubble**、その下に**現在質問 ChatBubble**、その下に**subtitle p**、その下に**PillOptions**、その下に**Button + スキップ**と、**上から下へ機能を並べましたレイアウト**そのもの（ユーザー指摘 #16 に該当）。「これは会話だ」と伝わらない |
| 7 | 375px 情報密度 | **2 / 5** | 375×667 viewport で: 進捗(~56) + chatHistory 過去 2 バブル(~200) + 現在質問バブル(~80) + subtitle(~24) + pills 4-6 個(~120) + button(~48) ≈ 528px が fold 下に。スクロール 1 画面で**完結しない**。4 問という少なさを考えると「質問 1 件= 1 画面丸ごと」にする方が丁寧 |
| 8 | 明朝 × ゴシック | **3 / 5** | intro `text-2xl font-extralight` 見出し（:399）◎、数字バッジ `tabular-nums`◎。質問フェーズの `ChatBubble` assistant 側が**ゴシック**（coach と同じ `text-sm`）なので「AI の声」感が薄い。ここは明朝にする絶好の場 |
| 9 | tabular-nums | **4 / 5** | intro 数字バッジ（:409）、進捗 `{step+1}/{length}`（:483）、レコメンドの `万円〜`（:318）に tabular-nums 適用済み。が、ゲスト人数入力 `type="number"`（:531-541）の input 自体には `font-variant-numeric: tabular-nums` 未指定 |
| 10 | 空 / ローディング / エラー | **2 / 5** | **レコメンドのローディング**（:293-299）が特に弱い: `<Loader2 class="h-4 w-4 animate-spin" /> おふたりに合う式場を探しています…` だけ。AI が「いま探している」感を出す skeleton カード 3 枚を載せるべき（shimmer で「考えている」表現）。レコメンド `recommendations.length === 0`（loading 完了後）の空分岐が**存在しない** → AI が 0 件返したら画面が黙る |
| 11 | マイクロインタラクション | **3 / 5** | intro は `motion.div` で fade-up 600ms（:389-393）◎。質問フェーズは `ChatBubble` の motion に任せ切り、pill 選択時のハプティック等価（ring の emit）なし。「選んだ感」が弱い。`PillOptions.tsx:33` `active:scale-95` は全 pill に効くが色変化のみで「選択済みハイライト」の呼吸（breathing glow）が不在 |
| 12 | ダークモード対応 | **3 / 5** | `bg-[var(--gold-subtle)]`（:288）は dark 対応 token で OK。ただし レコメンドカード `bg-card p-4`（:309）は dark で border がほぼ消える。`border` だけで border 色未指定（= `border-border`）なので dark で薄いが、hover 時の lift がなく「存在感ゼロ」のカードに |
| 13 | コピー trust/voice | **5 / 5** | intro の「晴れの日を、ふたりで描きはじめる。」「お好みを 4 問だけ、そっと伺います」は Haretoki のブランド声の最良例。quick-start の「思い浮かぶ雰囲気を、いくつか選んでみてください」「だいたいで大丈夫です。あとから変えられます」も丁寧体で急かさない◎。唯一「ホームへ進む」（:363）が機械的 → 「ふたりの空を眺めてみる」等の情緒案可 |

### Before → After（5 件、実装粒度）

#### 1. 質問フェーズを「AI と対話している画面」へ組み替える（情報階層の整理） — **P1 / L**

- File: `src/components/onboarding/onboarding-flow.tsx:466-557`
- Before: 進捗/history/現在質問/subtitle/pills/button が**縦 6 段スタック**
- After: 2 領域に再構成:
  ```tsx
  return (
    <div className="mx-auto flex min-h-[calc(100dvh-64px)] max-w-lg flex-col gap-10 py-6">
      {/* Top zone: 空と進捗 — 1 行で完結。会話領域を圧迫しない */}
      <div className="flex items-center gap-3">
        <SkyChip mood={...} size={40} />
        <div className="flex-1">
          <p className="flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-muted-foreground tabular-nums">
            <span className="font-medium text-[var(--gold-warm)]">{step + 1}</span>
            <span aria-hidden className="opacity-30">/</span>
            <span>{QUESTIONS.length}</span>
            <span aria-hidden className="opacity-30">·</span>
            <span>そっと伺っています</span>
          </p>
          <div className="mt-2 h-[2px] rounded-full bg-[color-mix(in_oklab,var(--gold-warm)_10%,transparent)]">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-[var(--gold-warm)] to-[color-mix(in_oklab,var(--gold-warm)_55%,transparent)]"
              initial={false}
              animate={{ width: `${((step + 1) / QUESTIONS.length) * 100}%` }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            />
          </div>
        </div>
      </div>

      {/* Conversation zone: 過去回答は「addressed」、現在質問のみがスポットライト */}
      <section className="space-y-8">
        {chatHistory.length > 0 && (
          <details className="group">
            <summary className="cursor-pointer list-none text-[11px] uppercase tracking-[0.16em] text-muted-foreground/70">
              これまでの回答 {chatHistory.length / 2} 件 <span className="opacity-60 group-open:rotate-180 inline-block transition-transform">▾</span>
            </summary>
            <div className="mt-3 space-y-2 opacity-70">
              {chatHistory.map((msg, i) => (<ChatBubble key={i} role={msg.role} content={msg.content} />))}
            </div>
          </details>
        )}

        {currentQ && (
          <motion.div
            key={step}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="space-y-5"
          >
            <div className="flex items-start gap-3">
              <span className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--gold-subtle)]">
                <Sparkles aria-hidden className="h-4 w-4 text-[var(--gold-warm)]" strokeWidth={1.5} />
              </span>
              <div className="space-y-2">
                <h2 className="font-[family-name:var(--font-display)] text-[20px] font-extralight leading-[1.5] tracking-[0.005em] text-foreground">
                  {currentQ.question}
                </h2>
                <p className="text-[13px] leading-relaxed text-muted-foreground">
                  {currentQ.subtitle}
                </p>
              </div>
            </div>

            <div className="pl-11"> {/* indent to align with question body, not avatar */}
              {currentQ.type === "pills" && currentQ.options && (<PillOptions ... />)}
              {currentQ.type === "number" && (<Input ... className="max-w-[200px] tabular-nums" />)}
            </div>

            <div className="pl-11 flex items-center gap-3">
              <Button onClick={handleNext} disabled={isPending} className="rounded-full">
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : step < QUESTIONS.length - 1 ? "次へ" : "おすすめを見る"}
              </Button>
              <button type="button" onClick={handleSkip} className="inline-flex min-h-11 items-center text-sm text-muted-foreground underline-offset-2 hover:underline">
                スキップ
              </button>
            </div>
          </motion.div>
        )}
      </section>
    </div>
  );
  ```
- Why:
  - (1) 「上から下へ並べました」→「進捗ゾーン / 会話ゾーン」の**2 領域明示**に変えた。ユーザー指摘 #16 の核心対応。
  - (2) 過去回答を `<details>` で畳む → fold 内に現在の質問を大きく見せる（Duolingo onboarding の「1 画面 1 質問」原則、[Mobbin Duolingo Onboarding](https://mobbin.com/explore/flows/0acc27c7-4e01-481c-83b2-99f8d741bef1) と同形）。
  - (3) 現在質問を明朝 20px light + gold avatar でカード格上げ。
  - (4) PillOptions と Button を `pl-11` で avatar 幅分 indent → 「この質問への返信」という意味連関を可視化。
  - (5) `motion.div key={step}` で質問切替に soft fade-up 400ms を付与。
  - 工数 L（影響範囲広いが、既存ロジック（`handleNext` / `handleSkip`）は不変、layout のみ変更）

#### 2. レコメンドカードを「AI の提案」格に格上げ（editorial card） — **P1 / M**

- File: `src/components/onboarding/onboarding-flow.tsx:306-349`
- Before:
  ```tsx
  <div
    key={rec.name}
    className="rounded-xl border bg-card p-4 space-y-2"
  >
    <div className="flex items-start justify-between gap-2">
      <div>
        <p className="font-[family-name:var(--font-display)] font-medium text-foreground">{rec.name}</p>
        <p className="text-xs text-muted-foreground">{rec.location}</p>
      </div>
      ...
    </div>
    <p className="text-sm text-foreground/80">{rec.reason}</p>
    {rec.strengths.length > 0 && (
      <div className="flex flex-wrap gap-1">
        {rec.strengths.map((s) => (
          <span key={s} className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
            {s}
          </span>
        ))}
      </div>
    )}
    <Button size="sm" variant="outline" className="w-full" ...>
      ...追加する
    </Button>
  </div>
  ```
- After:
  ```tsx
  <motion.article
    key={rec.name}
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.5, delay: idx * 0.05, ease: [0.16, 1, 0.3, 1] }}
    className="relative overflow-hidden rounded-[20px] border border-[color:var(--hairline-gold)] bg-gradient-to-br from-[var(--card)] to-[color-mix(in_oklab,var(--gold-subtle)_18%,var(--card))] p-5"
  >
    <div className="mb-3 flex items-baseline justify-between gap-3">
      <div className="min-w-0">
        <p className="mb-1 text-[11px] uppercase tracking-[0.2em] text-[var(--gold-warm)]/80">
          AI の提案 · {idx + 1}
        </p>
        <h3 className="font-[family-name:var(--font-display)] text-[19px] font-light leading-[1.4] tracking-[0.005em] text-foreground">
          {rec.name}
        </h3>
        <p className="mt-1 text-[12px] text-muted-foreground">{rec.location}</p>
      </div>
      {rec.estimatedPrice && (
        <p className="shrink-0 text-right">
          <span className="font-[family-name:var(--font-display)] text-[22px] font-extralight tabular-nums text-foreground">
            {Math.round(rec.estimatedPrice / 10000)}
          </span>
          <span className="ml-0.5 text-[11px] text-muted-foreground">万円〜</span>
        </p>
      )}
    </div>

    <p className="mb-4 text-[14px] leading-[1.75] text-foreground/85 font-[family-name:var(--font-display)] font-light">
      {rec.reason}
    </p>

    {rec.strengths.length > 0 && (
      <div className="mb-4 flex flex-wrap gap-1.5">
        {rec.strengths.map((s) => (
          <span
            key={s}
            className="inline-flex items-center rounded-full border border-[color-mix(in_oklab,var(--gold-warm)_30%,transparent)] bg-[var(--gold-subtle)]/50 px-2.5 py-0.5 text-[11px] tracking-[0.02em] text-foreground/80"
          >
            {s}
          </span>
        ))}
      </div>
    )}

    <Button
      size="default"
      variant="default"  // rose primary
      className="w-full rounded-full"
      disabled={addingVenues.has(rec.name)}
      onClick={() => handleAddVenue(rec)}
    >
      {addingVenues.has(rec.name) ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <>
          <Plus className="h-4 w-4 mr-1.5" strokeWidth={1.75} />
          気になるに追加する
        </>
      )}
    </Button>
  </motion.article>
  ```
- Why:
  - (1) `rounded-xl border` の無表情カード → `--hairline-gold` + gold-subtle gradient で **AI の贈り物**感を物質化。
  - (2) `font-medium` を廃止し、式場名は明朝 19px light。価格は明朝 extralight 22px + tabular-nums で editorial numeral（DESIGN.md "Display Numerals" 規約）。
  - (3) `variant="outline"` （= 無色、視覚的ゼロカロリー）→ `variant="default"`（rose primary）に格上げ。DESIGN.md の「Rose = ユーザー CTA」原則に沿う: ユーザーが**行動を選ぶ** moment は Rose。
  - (4) コピー「追加する」→「気になるに追加する」で用語辞書（`docs/copy-lexicon.md`）準拠。
  - (5) `motion.article + staggered delay` で 3 枚が 50ms ずつ整列 → 「考え終わった AI が順に差し出す」時間設計。

#### 3. レコメンド・ローディング状態を skeleton 3 枚 shimmer に — **P1 / S**

- File: `src/components/onboarding/onboarding-flow.tsx:293-301`
- Before:
  ```tsx
  {isLoadingRecs ? (
    <div className="flex items-center gap-2 text-sm text-muted-foreground">
      <Loader2 className="h-4 w-4 animate-spin" />
      <span>おふたりに合う式場を探しています…</span>
    </div>
  ) : advice ? (
    <p className="text-sm text-muted-foreground">{advice}</p>
  ) : null}
  ```
  その後 `{!isLoadingRecs && recommendations.length > 0 && (...)}` で**ローディング時はカード領域が空**。
- After:
  header 部の loading コピーは残しつつ、**空ではなく skeleton 3 枚**を出す:
  ```tsx
  {isLoadingRecs ? (
    <div className="space-y-3" aria-busy="true" aria-label="式場を探しています">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="relative overflow-hidden rounded-[20px] border border-[color:var(--hairline-gold)] bg-gradient-to-br from-[var(--card)] to-[color-mix(in_oklab,var(--gold-subtle)_12%,var(--card))] p-5"
        >
          <div className="flex items-baseline justify-between gap-3">
            <div className="space-y-2">
              <div className="h-2 w-20 rounded-full bg-[var(--gold-subtle)]" />
              <div className="h-5 w-44 rounded-md bg-muted" />
              <div className="h-2.5 w-24 rounded-full bg-muted/70" />
            </div>
            <div className="h-6 w-16 rounded-md bg-muted" />
          </div>
          <div className="mt-4 space-y-2">
            <div className="h-3 w-full rounded-full bg-muted/60" />
            <div className="h-3 w-5/6 rounded-full bg-muted/60" />
          </div>
          {/* Shimmer sweep */}
          <div
            aria-hidden="true"
            className="absolute inset-0 -translate-x-full animate-[shimmer_1.8s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/40 to-transparent"
            style={{ animationDelay: `${i * 180}ms` }}
          />
        </div>
      ))}
    </div>
  ) : recommendations.length > 0 ? (
    <div className="space-y-3">{/* 既存の map */}</div>
  ) : (
    // 0 件時フォールバック（4 観点目の穴を埋める）
    <div className="rounded-[20px] border border-[color:var(--hairline-gold)] bg-[var(--card)] p-6 text-center">
      <p className="font-[family-name:var(--font-display)] text-[15px] font-light text-foreground">
        ちょうど合う場所が、いまは見つかりませんでした。
      </p>
      <p className="mt-1 text-[12.5px] text-muted-foreground">
        条件を少し広げて、ふたりで探してみませんか。
      </p>
    </div>
  )}
  ```
  `globals.css` に `@keyframes shimmer { from { transform: translateX(-100%) } to { transform: translateX(100%) } }` 追加（既存）。
- Why:
  - (1) 「スピナー 1 個 + テキスト」＝ 20 年前の loader。カードと同じ形状・ゴールド地の skeleton が 180ms 間隔で shimmer すれば「**3 件探している最中**」が視覚化され、**知覚速度**（DESIGN.md P4）が上がる。
  - (2) `recommendations.length === 0` の**沈黙分岐**を救済。AI が 0 件返すケースで画面が黙る＝信頼崩壊。

#### 4. Intro 画面の数字バッジを 24px（DESIGN.md 許容サイズ）に統一 — **P2 / S**

- File: `src/components/onboarding/onboarding-flow.tsx:406-417`
- Before:
  ```tsx
  <li key={i} className="flex items-start gap-3">
    <span
      aria-hidden
      className="mt-0.5 flex h-7 w-7 flex-none items-center justify-center rounded-full bg-[var(--gold-subtle)] text-xs font-medium tabular-nums text-[var(--gold-warm)]"
    >
      {i + 1}
    </span>
    <span className="pt-0.5 text-sm font-medium leading-relaxed text-foreground/80">
      {text}
    </span>
  </li>
  ```
- After:
  ```tsx
  <li key={i} className="flex items-start gap-4">
    <span
      aria-hidden
      className="mt-0.5 flex h-6 w-6 flex-none items-center justify-center rounded-full border border-[color:var(--hairline-gold)] bg-[var(--gold-subtle)] text-[11px] font-medium tabular-nums text-[var(--gold-warm)]"
    >
      {i + 1}
    </span>
    <span className="pt-0 text-[14px] font-light leading-[1.8] tracking-[0.005em] text-foreground/85">
      {text}
    </span>
  </li>
  ```
- Why:
  - (1) `h-7 w-7`（28px）は DESIGN.md の icon size 規約（16/20/24）外れ。24px に統一し、`--hairline-gold` 一本のリングを足すと「活版印刷のナンバリング」感が出る。
  - (2) `text-sm font-medium`（14px 太字）は v4.2 の「太字禁止」原則違反。`text-[14px] font-light leading-[1.8]` に。gap を 3→4 にし、行間を 1.8 にすると editorial な **breathing** が出る。

#### 5. 質問フェーズの PillOptions に「選んだ感」の glow micro-interaction — **P2 / S**

- File: `src/components/ui/pill-options.tsx:28-43`
- Before:
  ```tsx
  <button
    key={option.id}
    type="button"
    onClick={() => handleSelect(option.id)}
    className={cn(
      "min-h-[44px] rounded-full border px-4 text-sm transition-colors active:scale-95",
      isSelected
        ? "border-primary bg-primary text-primary-foreground"
        : "border-border bg-card text-foreground hover:bg-muted"
    )}
  >
    {option.label}
  </button>
  ```
- After:
  ```tsx
  <button
    key={option.id}
    type="button"
    onClick={() => handleSelect(option.id)}
    aria-pressed={isSelected}
    className={cn(
      "min-h-[44px] rounded-full border px-5 text-[14px] tracking-[0.01em] transition-[transform,background-color,border-color,box-shadow] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.97] motion-reduce:transition-none motion-reduce:active:scale-100",
      isSelected
        ? "border-primary bg-primary text-primary-foreground shadow-[0_2px_8px_color-mix(in_oklab,var(--primary)_22%,transparent)]"
        : "border-border bg-card text-foreground hover:border-[color:var(--gold-warm)]/40 hover:bg-[var(--gold-subtle)]/40 hover:shadow-[0_1px_4px_color-mix(in_oklab,var(--gold-warm)_10%,transparent)]"
    )}
  >
    {option.label}
  </button>
  ```
- Why:
  - (1) 現状は `transition-colors` で色変化のみ → **「選んだ」という感覚がペタっとしている**。選択済み pill に rose shadow を 22% 落とすと**浮遊**する。
  - (2) hover（未選択）に gold tint + tiny shadow → 「この pill はタップ可能」のアフォーダンスが強化（DESIGN.md P1）。
  - (3) `active:scale-95`（強め）→ `active:scale-[0.97]` でアプリ内統一（他 5 箇所に揃える）。
  - (4) `aria-pressed` で SR に選択状態を伝達。
  - (5) `tracking-[0.01em]` で日本語の読みが僅かに柔らぐ。

---

## 競合参考（Refero MCP 代替: Mobbin / Muzli / Dribbble / 公式）

Refero MCP が当エージェントで利用不可のため、代替として公開 UI パターン DB と一次資料を参照:

- **Character.ai — chat bubble spacing**（[Muzli 2026 chat-ui まとめ](https://muz.li/inspiration/chat-ui/)）: assistant bubble は padding 20/10/15 (top/side/bottom)、border-radius は user 側角を切る "tail-less" 派が主流。**採用案 #1 (Before→After 1)** で `rounded-bl-[6px]`（assistant の左下だけ "tail" 残す）は Character.ai / ChatGPT iOS の折衷案。
- **Pi (Inflection) — minimal companion**（[Pi 公式](https://pi.ai/)、[Medium: Pi redesign study](https://medium.com/design-bootcamp/inflection-ai-pi-chatbot-redesign-quick-fixes-5d63ebf36d30)）: typing indicator に品詞を含む（"Pi is thinking"）、chat 本文に serif を使うことで「感情を持った対話相手」を演出。**採用案 #3（typing dot に "コーチが考えています"）と #1（明朝 bubble）**の根拠。
- **Duolingo — 1 画面 1 質問 + progress bar**（[goodux Duolingo onboarding](https://goodux.appcues.com/blog/duolingo-user-onboarding)、[Mobbin Duolingo iOS Onboarding](https://mobbin.com/explore/flows/0acc27c7-4e01-481c-83b2-99f8d741bef1)）: 1 質問 = 1 画面、進捗バー + "Just 7 more questions" で goal-gradient 効果。「次へ」ボタンは選択時のみ有効化で色変化。**採用案 #1（質問フェーズ再構成）**は Haretoki 文脈（4 問と少ない）では past を畳んで現在をスポットライトする派生形。
- **Chatbot UI patterns 2026**（[BricxLabs 16 patterns](https://bricxlabs.com/blogs/message-screen-ui-deisgn)、[JotForm 20 best chatbot UIs](https://www.jotform.com/ai/agents/best-chatbot-ui/)）: suggestion card の hover-lift + tinted icon circle + accent-colored prompt arrow 「→」は 2026 の定番。**採用案 #4（QuickStart editorial 刷新）**の根拠。

---

## 優先度 / 工数サマリ

### AIコーチ

| # | 施策 | 優先度 | 工数 | Impact |
|---|---|---|---|---|
| A2-C-1 | Assistant バブルを gold hairline + 明朝化 | P1 | M | AI が主役の画面で最大の「2026 年感」投資 |
| A2-C-2 | メタ情報（time + sender）添付 | P1 | S | 「誰がいつ」の欠落解消、#13 批判に直接応答 |
| A2-C-3 | Typing indicator に言語コンテクスト | P2 | S | 知覚速度 + 品のあるストリーミング体験 |
| A2-C-4 | QuickStart 3 カード editorial 刷新 | P1 | M | 空状態 = 招待状（DESIGN.md P1）遵守 |
| A2-C-5 | Sticky header eyebrow/title の token 化 | P2 | S | 0.5px 刻み解消 → antialias 崩れ防止 |
| A2-C-6 | Send ボタンに HaloTap | P2 | S | v4.2 既存 token の coach 適用 |

### オンボーディング

| # | 施策 | 優先度 | 工数 | Impact |
|---|---|---|---|---|
| A2-O-1 | 質問フェーズを「2 領域 + 1 画面 1 質問」に再構成 | P1 | L | #16「上から下へ並べました」の根本是正 |
| A2-O-2 | レコメンドカード editorial 刷新 + rose primary CTA | P1 | M | AI 提案の受け入れ行為を rose で強化、用語辞書連動 |
| A2-O-3 | レコメンド loading の skeleton shimmer + 0 件フォールバック | P1 | S | 知覚速度 + 沈黙分岐救済 |
| A2-O-4 | Intro 数字バッジ 28px → 24px、本文 light 化 | P2 | S | icon 規約遵守 + 太字禁止遵守 |
| A2-O-5 | PillOptions に glow / aria-pressed | P2 | S | 「選んだ感」の 2026 年的微震 |

### 合計所感

- **P1 / 5 施策**: 実装推定 2-3 日（onboarding 質問再構成が L、残り M/S）
- **P2 / 6 施策**: 実装推定 1-1.5 日（全 S/S）
- **破壊度**: `ChatBubble` の props 拡張（timestamp 追加）と `PillOptions` の 1 箇所変更以外、既存 API シグネチャは不変。onboarding flow の JSX 再構成は最も影響範囲広いが、`handleNext`/`handleSkip`/`chatHistory` ロジックは一切変えない
- **次アクション候補**: P1-5 件を 1 PR（feat/coach-editorial-v4.2 + feat/onboarding-editorial-v4.2 の 2 worktree 並列）で投げ、P2-6 件は次スプリントで纏めて 1 PR。E2E は chat 送信フロー、onboarding → レコメンド → /home への遷移の 2 筋を既存テストに沿って更新（`tests/e2e/coach.spec.ts`, `tests/e2e/onboarding.spec.ts` を同 PR 内で同期）

---

**監査完了**。次の sub-audit（A1/A3/A4）の結果と突合すると、`text-[半端px]` / `h-3 w-3` / `variant="outline"` の 3 点は全画面共通課題として上がる可能性が高い。共通施策として Tailwind `@theme` で `text-fluid-xs..3xl` / `size-icon-{16,20,24}` を alias 化すると横展開が軽い。

**根拠ソース**:
- [Best Chat UI Design Ideas 2026 — Muzli](https://muz.li/inspiration/chat-ui/)
- [Chat UI Design Patterns 2026 — BricxLabs](https://bricxlabs.com/blogs/message-screen-ui-deisgn)
- [Duolingo User Onboarding — goodux (Appcues)](https://goodux.appcues.com/blog/duolingo-user-onboarding)
- [Duolingo iOS Onboarding Flow — Mobbin](https://mobbin.com/explore/flows/0acc27c7-4e01-481c-83b2-99f8d741bef1)
- [Pi, the first emotionally intelligent AI — Inflection](https://pi.ai/)
- [Inflection AI: Pi Chatbot Redesign — Medium](https://medium.com/design-bootcamp/inflection-ai-pi-chatbot-redesign-quick-fixes-5d63ebf36d30)
- [20 best looking chatbot UIs 2026 — Jotform](https://www.jotform.com/ai/agents/best-chatbot-ui/)
