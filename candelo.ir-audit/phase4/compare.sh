#!/usr/bin/env bash
# Compare live candelo.ir pages against Phase 4 drift baselines.
set -euo pipefail
SEO_PY="${HOME}/.claude/skills/seo/.venv/bin/python"
SCRIPTS="${HOME}/.claude/skills/seo/scripts"
URLS=(
  "https://candelo.ir/"
  "https://candelo.ir/pricing"
  "https://candelo.ir/guides"
  "https://candelo.ir/lessons"
  "https://candelo.ir/about"
  "https://candelo.ir/guides/backtest-chist"
)
for url in "${URLS[@]}"; do
  echo "======== $url ========"
  "$SEO_PY" "$SCRIPTS/drift_compare.py" "$url" || true
  echo
done
