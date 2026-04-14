# 次セッション投入プロンプト

**目的**: 次セッションで下記を一投すれば、Sprint 1 以降が自動で走り出す。

---

## 📨 投入プロンプト（コピペ用）

```
haretoki プロジェクトの続き。auto mode で進めてくれ。

まず docs/README.md と docs/pm-plan.md を読み、Sprint 1 から順に実行して。

## Sprint 1 の Order（docs/pm-plan.md Sprint 1 参照）
1. refero-design スキルで 10 画面リサーチ → docs/design-research.md 作成
2. docs/bug-tracker.md を Impact × Effort で再確認、妻実機検証が必要な P1/P2 項目を列記
3. 本番で Phase 1 計測（Lighthouse mobile + Vercel Analytics）→ docs/phase3-metrics.md 記入
4. Sprint 1 DoD を満たしたら Sprint 2 に進む

## Sprint 2 以降
docs/pm-plan.md Sprint 2-5 の Order に従って、各 Sprint の DoD を満たしながら進める。
Sprint 間で spec crep が発生しそうなら bug-tracker に追記するだけで即対応しない。

## 制約
- 破壊的操作以外は承認不要（auto）
- 実装変更後は必ず dev server + Playwright で実データを叩いて検証してから「完了」宣言
- デザイン系は Refero リサーチ → 提案 → 実装の順を厳守
- 妻の実アカウント検証は docs/wife-requirements-gaps.md の H ランク優先

## 主要参照先（絶対パス）
- /home/yusuke_kaya/projects/haretoki/docs/README.md  ← まずここから
- /home/yusuke_kaya/projects/haretoki/docs/status-dashboard.md  ← 機能・非機能・UX の現状
- /home/yusuke_kaya/projects/haretoki/docs/pm-plan.md  ← Sprint 1-6 の Order と DoD
- /home/yusuke_kaya/projects/haretoki/docs/bug-tracker.md  ← Open 課題（P1-P4）
- /home/yusuke_kaya/projects/haretoki/docs/wife-requirements-gaps.md  ← 妻要望の未対応分
- /home/yusuke_kaya/projects/haretoki/docs/definition-of-done.md  ← 完了条件
- /home/yusuke_kaya/projects/haretoki/docs/design-todo.md  ← 実装前に必要なデザイン資産
- /home/yusuke_kaya/projects/haretoki/docs/phase-release-map.md  ← Phase/Release/Sprint 体系の対応表
- /home/yusuke_kaya/projects/haretoki/docs/completed-archive.md  ← 過去の解消履歴
- /home/yusuke_kaya/projects/haretoki/docs/gtm-draft.md  ← 商用化粗書き
```

---

## このプロンプトで起こること

1. Claude が `docs/README.md` と `docs/pm-plan.md` を読み込み、全体を把握
2. Sprint 1 の Order 1（Refero リサーチ）を自動着手
3. Sprint 1 DoD を満たしたら Sprint 2 → 3 → 4 → 5 と自動進行
4. 各 Sprint 末尾で Ship Cycle（E2E → develop → prod → worktree 掃除）を実行
5. 妻への実機検証依頼ポイントで「やってもらう」メッセージを返す

## あなた（ユーザー）側の最小関与ポイント
- 初回: プロンプトを 1 回投げる
- Sprint 1 後: 妻の実機観察セッションに同席して動線ログを渡す
- Sprint 2 後: 5 画面のデザインを妻にレビューしてもらう
- Sprint 3 後: フィルタと動線の UX を妻に試してもらう
- Sprint 4 後: AI コーチに 10 質問してもらう
- Sprint 5 後: 完成品としての最終確認

各 Sprint の完了報告を私が短文で返す運用。

---

## 補足プロンプト例

### 途中で追加フィードバックが出たとき
```
bug-tracker に以下を追加、優先度は次 Sprint で見直し:
- F-28 「〇〇が△△」
```

### Sprint を一時停止したいとき
```
Sprint X を一時停止。次の Sprint に飛ばして。理由: 〇〇
```

### 緊急 hotfix が必要なとき
```
Sprint 中断。緊急 hotfix: 〇〇を最優先で直して。
```
