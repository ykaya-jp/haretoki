#!/bin/bash
# Check Anthropic API credit balance and recent usage
# Usage: ./scripts/check-ai-usage.sh
# Requires: ANTHROPIC_API_KEY in .env.local

set -euo pipefail

# Load key from .env.local
if [ -f .env.local ]; then
  KEY=$(grep "^ANTHROPIC_API_KEY=" .env.local | cut -d'=' -f2- | tr -d '"\n\r ')
else
  echo "Error: .env.local not found"
  exit 1
fi

if [ -z "$KEY" ]; then
  echo "Error: ANTHROPIC_API_KEY is empty in .env.local"
  exit 1
fi

echo "=== Anthropic API Status ==="
echo ""

# Test API access
echo "--- API Access Test ---"
RESULT=$(curl -s https://api.anthropic.com/v1/messages \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${KEY}" \
  -H "anthropic-version: 2023-06-01" \
  -d '{"model":"claude-haiku-4-5-20251001","max_tokens":5,"messages":[{"role":"user","content":"1"}]}')

if echo "$RESULT" | grep -q '"type":"message"'; then
  echo "✓ API is working"
  TOKENS_IN=$(echo "$RESULT" | grep -o '"input_tokens":[0-9]*' | cut -d: -f2)
  TOKENS_OUT=$(echo "$RESULT" | grep -o '"output_tokens":[0-9]*' | cut -d: -f2)
  echo "  Test call: ${TOKENS_IN} input / ${TOKENS_OUT} output tokens"
elif echo "$RESULT" | grep -q "credit balance"; then
  echo "✗ Credits exhausted — top up at https://console.anthropic.com/settings/billing"
elif echo "$RESULT" | grep -q "invalid_api_key"; then
  echo "✗ Invalid API key"
else
  echo "✗ Unknown error:"
  echo "$RESULT" | head -3
fi

echo ""
echo "--- Available Models ---"
MODELS=$(curl -s https://api.anthropic.com/v1/models \
  -H "x-api-key: ${KEY}" \
  -H "anthropic-version: 2023-06-01" | \
  grep -o '"id":"[^"]*"' | cut -d'"' -f4)

if [ -n "$MODELS" ]; then
  echo "$MODELS" | while read -r m; do echo "  • $m"; done
else
  echo "  (could not fetch models)"
fi

echo ""
echo "--- DISABLE_AI Toggle ---"
if grep -q "^DISABLE_AI=" .env.local 2>/dev/null; then
  DISABLE=$(grep "^DISABLE_AI=" .env.local | cut -d'=' -f2)
  echo "  DISABLE_AI=${DISABLE} (AI features $([ "$DISABLE" = "1" ] && echo "DISABLED" || echo "enabled"))"
else
  echo "  DISABLE_AI not set (AI features enabled by default)"
  echo "  To disable: echo 'DISABLE_AI=1' >> .env.local"
fi

echo ""
echo "--- Quick Commands ---"
echo "  Disable AI:  echo 'DISABLE_AI=1' >> .env.local"
echo "  Enable AI:   sed -i '/^DISABLE_AI/d' .env.local"
echo "  Billing:     https://console.anthropic.com/settings/billing"
echo "  API Keys:    https://console.anthropic.com/settings/keys"
