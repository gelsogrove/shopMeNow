#!/usr/bin/env bash
# Run a single usecase against the cliente-0 chatbot and save the dialog as Markdown.
#
# Usage:
#   npm run test:case 14
#   ./scripts/test-case.sh 14
#
# Output:
#   docs/cliente-0/test-runs/caseNN/dialog-YYYYMMDD-HHMMSS.md

set -euo pipefail

CASE_NUM="${1:-}"
if [[ -z "$CASE_NUM" || ! "$CASE_NUM" =~ ^[0-9]+$ ]]; then
  echo "Usage: $0 <case_number>" >&2
  echo "Example: $0 14" >&2
  exit 1
fi

# Resolve repo root from this script's location: scripts/ -> custom-client-0/ -> backend/ -> apps/ -> repo root
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CLIENT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
REPO_ROOT="$(cd "$CLIENT_DIR/../../.." && pwd)"

PADDED=$(printf "%02d" "$CASE_NUM")
OUT_DIR="$REPO_ROOT/docs/cliente-0/test-runs/case$PADDED"
mkdir -p "$OUT_DIR"

TIMESTAMP=$(date +%Y%m%d-%H%M%S)
OUT_FILE="$OUT_DIR/dialog-$TIMESTAMP.md"
RAW_LOG=$(mktemp)

# Load .env from repo root if present so OPENROUTER_API_KEY is available.
if [[ -f "$REPO_ROOT/.env" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$REPO_ROOT/.env"
  set +a
fi

cd "$CLIENT_DIR"

echo "▶ Running Case $CASE_NUM ..."
# Disable -e here: assertion failures return non-zero but we still want to
# write the dialog to disk. We re-emit the exit code at the end.
set +e
node --import tsx chatbot.ts --usecase "$CASE_NUM" 2>&1 | tee "$RAW_LOG"
EXIT_CODE=${PIPESTATUS[0]}
set -e

# Build a clean Markdown dialog from the raw CLI log.
{
  echo "# Case $CASE_NUM — Runtime Dialog"
  echo ""
  echo "**Generated:** $(date '+%Y-%m-%d %H:%M:%S')"
  echo "**Exit code:** $EXIT_CODE"
  echo ""
  echo "---"
  echo ""
  awk '
    /^\[YOU\]/              { mode = "user";  next }
    /^\[BOT\]/              { mode = "bot";   next }
    /^\[USECASE FAILURES\]/ { mode = "fail"; print "## Failures\n"; next }
    /^=+$/                  { mode = ""; next }
    /^-+$/                  { mode = ""; next }
    mode == "user"          { sub(/^[ \t]+/,""); if ($0 != "") printf "**Usuario:** %s\n\n", $0 }
    mode == "bot"           { sub(/^[ \t]+/,""); if ($0 != "") printf "**Bot:** %s\n\n", $0 }
    mode == "fail"          { sub(/^[ \t]+/,""); if ($0 != "") print "- " $0 }
  ' "$RAW_LOG"
} > "$OUT_FILE"

rm -f "$RAW_LOG"

echo ""
echo "✔ Dialog saved to: $OUT_FILE"
exit "$EXIT_CODE"
