#!/bin/bash
set -e

echo "=== Post-create setup starting ==="

# npmパッケージのインストール（package.jsonがある場合）
if [ -f package.json ]; then
  echo "Installing npm packages..."
  npm install
fi

# Claude Codeのバージョン確認
echo "Claude Code version:"
claude --version 2>/dev/null || echo "Claude Code not found in PATH"

echo "=== Post-create setup complete ==="
