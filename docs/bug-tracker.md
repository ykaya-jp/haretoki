# Haretoki Bug Tracker

> 課題の一元管理。解消されたら即削除（見つけたら追加）。
> 原文フィードバックは `docs/myreview/problems_01.md`, `docs/wife-requirements.md`。

最終更新: 2026-04-14

凡例:
- 🟥 Critical: 機能が壊れて使えない
- 🟧 High: UX 致命的
- 🟨 Medium: 使いづらい
- 🟦 Low: ポリッシュ

---

## Open

### コーチ（最優先）
- 🟥 **F-23 AI コーチがテンプレ応答しかしない**
  - 現状: プロンプトが簡素、応答に個性がない
  - 望ましい: 結婚式コーディネーターとして、候補式場・見積もり・見学記録などアプリ内情報 + 一般知識を総動員して提案
  - 修正先: `src/lib/prompts/coach-chat.ts` `loadUserContext`
- 🟥 **F-24「ほかの質問」が機能していない**
  - 現状: `CoachQuickStart` のチップを押しても動かない / 何も起きない
  - 修正先: `src/components/coach/coach-quick-start.tsx`

### デザイン刷新（refero-design スキル使用予定）
- 🟧 **F-01** 式場追加 Sheet の見出しが横でかすぎ・他文字小さすぎ
- 🟧 **F-04** 比べるタブの王冠アイコンが見づらい
- 🟧 **F-05** 各観点の1位表示が見づらい（Decision Matrix / Dimension Focus 全面再考）
- 🟧 **F-10** 決めた後の「おめでとう」がしょぼい（DecisionCeremony 刷新）
- 🟧 **F-14** ホームの「おはようございます」+ 下の白枠がスペース無駄
- 🟧 **F-17** コーチ右上 Plus ボタンが目立たない
- 🟧 **F-18** コーチ左上の会話履歴アイコンも目立たない・意味伝わらない
- 🟧 **F-19** チェックリスト設定がわかりにくい
- 🟧 **F-21** ホーム全体がダサい（Refero で要リサーチ）
- 🟨 **F-02** 式場カード左下の星・写真枚数インジケータが式場名と被る
- 🟨 **F-03** 画面切替のドットインジケータ（3点リーダ的）が見づらい
- 🟨 **B-12** Sheet 見出しサイズ不均衡
- 🟨 **F-26** 評価スライダーの数字（4.5/5 以外見えない）＋ バー全体のデザイン

### 機能追加
- 🟧 **F-06** 比較の観点軸が 6 だけ。妻要望は 90+（§1-§6）。別画面で選択できるようにする
- 🟨 **F-07** 比較画面で観点フィルタ・設定
- 🟨 **F-08** 決めるタブでも同様（フィルタ・設定）
- 🟨 **F-09** チェック差分タブの SEED データ不足で挙動不明
- 🟨 **F-12** 決めた候補が一覧でハイライトされない（「決定」バッジはあるが弱い）
- 🟨 **F-20** チェックリストの反映先が不明瞭・意図通り反映されていない疑い
- 🟦 **B-06** Zexy URL 追加（403 bot 検知）→ headless browser 導入 or「Zexy 非対応」明示

### 挙動系
- 🟧 **B-17** Safari 戻るボタンで次の画面が出る（history 破綻）
- 🟧 **B-18** 「次へ」の挙動が不安定
- 🟨 **B-11** タブ切替が遅い
- 🟨 **B-13** 全画面が縦長すぎ・情報密度が低い（Bento や 2 カラムで整理）
- 🟨 **B-14** 内部画面にアニメーションがほぼ無い（Apple.com 風遷移モーションを検討）
- 🟨 **Hydration** 警告: `typeof window !== 'undefined'` or `Date.now()` の SSR/CSR 不一致
- 🟦 Next 16 PPR `Failed to parse postponed state` エラー（/candidates POST）

### コピー全面素敵化
- 🟦 **B-22** UI コピー全体を業務ワードから素敵な表現へ（`copy_overhaul_pending.md` メモ）

---

## Recently Closed（直近、次 pass で消してよい）

- ✅ B-01 候補「うまくいきませんでした」（ceremonyStyles 型修正）
- ✅ B-02 評価スライド保存失敗（incremental save に変更）
- ✅ B-19 「ほかの式場と比べる」（B-01 の連鎖）
- ✅ B-03 FAB 位置（HaloTap の `relative` 強制を緩和）
- ✅ B-07 コーチ Plus ボタン（router.replace + refresh）
- ✅ B-09 コーチ応答時刻の primary cache 問題（revalidatePath 追加）
- ✅ F-13 「準備を始める」→ マイページ → /candidates
- ✅ F-11 決定を取り消せない（cancelDecision 追加）
- ✅ F-15 コーチ送信ボタン見切れ（min-w-0 + inline calc）
- ✅ F-16 コーチ AI 応答来ない（stream 0 chunks → fallback 発動）
- ✅ venue 写真 HTTP 400（Unsplash remotePatterns 再許可）
- ✅ Decimal 警告（Server Component で Number() 変換）

## 完了判定ルール
妻が実機で**該当動線をスムーズに完了できた**時点で Closed に移動、次の bump で削除。
機能追加系は**本人が「動く」と言った時**に Closed。
