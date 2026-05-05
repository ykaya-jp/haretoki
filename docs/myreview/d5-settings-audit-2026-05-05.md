# D5 — `/settings` editorial audit (2026-05-05)

**Verdict: ALREADY EDITORIAL — no code change required.**

`/settings` page (`src/app/(app)/settings/page.tsx`, 212 行) は既に
editorial パターンを完全実装済み。直前の `8e6aae0 feat(settings): D5
/settings page editorial polish (4 light improvements, no redesign)`
で polish が入っており、page 内 23-45 行の audit verdict コメントに
当時の判定根拠も残っている。今回は再 audit してその判定が現状コード
でも有効であることを確認した。

## チェック項目

| 観点 | 判定 | 根拠 (`src/app/(app)/settings/page.tsx`) |
|---|---|---|
| Gold eyebrow (`text-[var(--gold-warm)]` + `tracking-[0.2em] uppercase`) | ○ | L54-67 (HARETOKI · Settings), L89-91, L113-115, L140-142, L164-166 (各 section eyebrow) |
| Shippori 明朝 h1 (`font-[family-name:var(--font-display)]`) | ○ | L68-70 (h1「整える」), L92-97/L116-121/L143-148/L167-172 (h2 各 section) |
| Hairline divider (gradient `var(--gold-warm)`) | ○ | L77-84 (header 直下の editorial separator) |
| Spacing (`space-y-10` 等) | ○ | L51 (root `space-y-10`), 各 section 内 `space-y-3`/`space-y-5` |
| Stock color (`bg-amber-*` 等) 不使用 | ○ | grep で検出ゼロ |
| 太字禁則 (`font-bold` / `font-semibold`) 不使用 | ○ | grep で検出ゼロ。h2 は `font-extralight` で W19-1 と同期 |
| SafeArea (`env(safe-area-inset-bottom)`) | ○ | L51 (`pb-[env(safe-area-inset-bottom)]`) |
| Card chrome 統一 (`rounded-2xl bg-card p-5 shadow-[...]`) | ○ | Theme/Notifications/Data/Account 4 枚すべて同一 shadow / radius |

## スコープ確認

- `src/components/settings/settings-form.tsx` は **`/mypage` 用**で、
  `/settings` route からは参照されていない (page 内 23-45 行 audit
  comment にも明記、`grep -l SettingsForm` で `mypage/page.tsx` のみ
  該当)。`/mypage` 側 editorial 化は W19-1 で完了済み。本 audit は
  `/settings` page 本体に focus。
- `/settings` で使用される sub-component (`ThemeSwitcher`,
  `LogoutButton`, `DataManagement`, `NotificationSettings`,
  `ReminderTimingSettings`, `PartnerActivitySettings`,
  `PushPermissionState`) は stock color / 太字禁則ともに違反なし
  (grep 確認済み)。

## 判定

**editorial / 部分 editorial / 要再設計 → editorial**

コード変更ゼロ。本 audit doc のみ commit する。
