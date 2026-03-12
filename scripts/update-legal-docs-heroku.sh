#!/bin/bash
# update-legal-docs-heroku.sh
#
# Pushes the updated legal document HTML files into the Heroku database.
# Run this AFTER deploying to Heroku (npm run publish).
#
# Usage:
#   ./scripts/update-legal-docs-heroku.sh <PLATFORM_ADMIN_JWT_TOKEN>
#
# How to get the JWT token:
#   1. Open https://backoffice.echatbot.ai and log in as platform admin
#   2. Open DevTools → Application → Local Storage → find "token"
#   3. Copy the token value and pass it as argument to this script
#
# Alternative (recommended): use the backoffice UI:
#   https://backoffice.echatbot.ai → Documenti Legali → "Initialize Default Documents"

set -e

API_URL="${ECHATBOT_API_URL:-https://www.echatbot.ai}"
TOKEN="${1:-}"

if [ -z "$TOKEN" ]; then
  echo "❌  Usage: $0 <PLATFORM_ADMIN_JWT_TOKEN>"
  echo ""
  echo "   Or use the backoffice UI:"
  echo "   https://backoffice.echatbot.ai → Documenti Legali → Initialize Default Documents"
  exit 1
fi

echo "🚀  Calling POST $API_URL/api/legal-documents/initialize ..."

RESPONSE=$(curl -s -X POST \
  "$API_URL/api/legal-documents/initialize" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")

echo "$RESPONSE" | python3 -m json.tool 2>/dev/null || echo "$RESPONSE"

if echo "$RESPONSE" | grep -q '"success":true'; then
  echo ""
  echo "✅  Legal documents initialized successfully on Heroku!"
  echo "   Check https://www.echatbot.ai/privacy to verify the updated content."
else
  echo ""
  echo "⚠️   Response did not confirm success. Check the output above."
fi
