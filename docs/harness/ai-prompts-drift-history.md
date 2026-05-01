# AI Prompts Drift History — Operations Aggregation

`/.claude/scripts/ai-prompts-drift-check.sh` (round 8 で導入、 ADR-0006) が
吐く STDERR 警告の **集計手順** と、 過去観測されたパターンを記録する台帳。

drift hook 自体は warn-only / non-blocking なので、 個々の警告では行動しない。
本ドキュメントは **「週次振り返り」のための観測 surface** を提供する。

最終更新: 2026-05-02 (P2 round 14、 観測体制整備)

## 何を集計するか

drift hook が吐くのは 3 種類の警告:

1. `paired md NOT modified` — `src/lib/prompts/<name>.ts` を編集したが
   `docs/ai/prompts/<name>.system.md` を同 PR で更新しなかった
2. `no paired md found` — 新規 `src/lib/prompts/*.ts` を作ったが
   frontmatter `pairs_with` で逆引きできる md が無い
3. (`anthropic.ts` 編集時) `paired guardrails NOT modified`

これらは **dev のローカル環境で発生する** ため、 prod logs には出ない。
集計は git history + PR レビューログから抽出する形になる。

## 週次集計手順

### A. git log から「prompt edit + 同 commit に md なし」を検出

```bash
# 過去 1 週で src/lib/prompts/ を触った commit
git log --since="1 week ago" --name-only --pretty=format:"COMMIT %h %s" \
  | awk '/^COMMIT /{commit=$0; printed=0; next}
         /^src\/lib\/prompts\//{
           if (!printed) {print commit; printed=1}
           print "  + ts: " $0
         }
         /^docs\/ai\/prompts\//{
           if (printed) print "  + md: " $0
         }'

# 期待出力: 各 commit が ts + md ペアで完結している (md 行が無い commit は drift)
```

### B. PR レビューログから drift warning の発生回数

```bash
# Claude Code session log から WARN を grep (各開発者の手元)
grep -r "\[ai-prompts-drift\] WARN" ~/.claude/projects/ 2>/dev/null \
  | sort | uniq -c | sort -rn
```

### C. 新規追加 prompt file の md ペア確認

```bash
# 全 prompts/*.ts で対応 md があるか確認
for ts in src/lib/prompts/*.ts; do
  base=$(basename "$ts" .ts)
  pair=$(grep -l "^pairs_with: src/lib/prompts/${base}\.ts$" docs/ai/prompts/*.system.md 2>/dev/null)
  if [ -z "$pair" ]; then
    echo "MISSING: $ts has no docs/ai/prompts/<name>.system.md with matching pairs_with"
  fi
done

# 期待出力: 何も出ない (全 prompt が md 化済 = ADR-0005 完了状態を維持)
```

## 過去の drift event 記録

| 日付 | パターン | ファイル | 対応 |
|---|---|---|---|
| 2026-05-02 | drift hook 自体の round 8 導入時、 ADR-0006 同 PR で起票 | n/a | 規約として整備 |

(empty for now — record drift events caught by the weekly check above)

## 月次振り返り

毎月初に 1 回:

1. 上記 A / B / C を実行
2. drift event があれば本テーブルに 1 行追加 (パターン / 解消方法)
3. 累積 drift 件数が増えてきたら ADR-0006 「warn-only」判断を見直し
   (block 化、 stale: true 自動付与、 等の選択肢を再検討)
4. 「修正忘れ」が 0 件で 3 ヶ月続けば、 hook を弱めるか / 維持するかを判断

## 関連ドキュメント

- 実装: [`/.claude/scripts/ai-prompts-drift-check.sh`](../../.claude/scripts/ai-prompts-drift-check.sh)
- 設定: [`/.claude/settings.json`](../../.claude/settings.json) PostToolUse hook
- Hook 一覧: [`docs/harness/hooks.md`](./hooks.md) §3
- 設計判断: [`docs/harness/adr/0006-ai-prompts-drift-detection-via-posttoooluse-hook.md`](./adr/0006-ai-prompts-drift-detection-via-posttoooluse-hook.md)
- Prompt 正本ルール: [`docs/harness/adr/0005-claude-prompt-canonicalization-in-md.md`](./adr/0005-claude-prompt-canonicalization-in-md.md)
