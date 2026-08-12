#!/usr/bin/env bash
# Builds the Docker delivery package for one client into deploy/<client>/.
# Usage: npm run deploy:docker -- <client>   (or ./scripts/deploy-docker.sh <client>)
# Example: npm run deploy:docker -- amreport
#
# Each client under deploy/ is an independent copy (own Dockerfile,
# docker-compose.yml, .env) so one client's setup can diverge from another's
# without cross-effects. See deploy/amreport/ for the reference layout.
#
# Output: deploy/<client>/ ready to zip and hand to that customer —
#   echatbot-images.tar.gz + docker-compose.yml + .env.example + INSTALL.md + RUN.md
# Secrets are NEVER part of the package (.env stays out by design).

set -euo pipefail

CLIENT="${1:-}"
if [ -z "$CLIENT" ]; then
  echo "Usage: npm run deploy:docker -- <client>" >&2
  echo "Example: npm run deploy:docker -- amreport" >&2
  echo "" >&2
  echo "Available clients:" >&2
  REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
  find "$REPO_ROOT/deploy" -mindepth 1 -maxdepth 1 -type d -exec basename {} \; 2>/dev/null | sed 's/^/  - /' >&2
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY_DIR="$REPO_ROOT/deploy/$CLIENT"
ARCHIVE="$DEPLOY_DIR/echatbot-images.tar.gz"

if [ ! -d "$DEPLOY_DIR" ]; then
  echo "❌ deploy/$CLIENT/ does not exist. Create it first (copy deploy/amreport/ as a starting point: Dockerfile, docker-compose.yml, INSTALL.md, RUN.md — update the 'context'/'dockerfile' paths and the header comment to the new client name)." >&2
  exit 1
fi

# VITE_BACKOFFICE_URL and VITE_API_URL are inlined into the frontend bundle at
# BUILD time (Vite), not read at runtime — they MUST match the domain this
# package will actually be deployed to, or the backoffice login/API calls
# silently break on the customer's machine (see Dockerfile for why).
# Skip only for a local/dev-only build (leaves both unset, same as before).
if [ -z "${VITE_BACKOFFICE_URL:-}" ] && [ -z "${VITE_API_URL:-}" ] && [ -t 0 ]; then
  read -r -p "Public domain for '$CLIENT' (e.g. https://shop.example.com), or leave empty to skip: " CUSTOMER_DOMAIN
  if [ -n "$CUSTOMER_DOMAIN" ]; then
    CUSTOMER_DOMAIN="${CUSTOMER_DOMAIN%/}"
    export VITE_BACKOFFICE_URL="${CUSTOMER_DOMAIN}/backoffice"
    export VITE_API_URL="${CUSTOMER_DOMAIN}/api/v1"
    echo "   -> VITE_BACKOFFICE_URL=$VITE_BACKOFFICE_URL"
    echo "   -> VITE_API_URL=$VITE_API_URL"
  else
    echo "   -> Skipped: building without VITE_BACKOFFICE_URL / VITE_API_URL (dev-only package)."
  fi
fi

cd "$DEPLOY_DIR"

echo "🔨 Building images for '$CLIENT' (app + scheduler)..."
docker compose build

echo "📦 Exporting images to $(basename "$ARCHIVE")..."
docker save echatbot-app:latest echatbot-scheduler:latest | gzip > "$ARCHIVE"

cp "$REPO_ROOT/.env.example" "$DEPLOY_DIR/.env.example"

echo ""
echo "✅ Package ready in deploy/$CLIENT/:"
ls -lh "$DEPLOY_DIR" | awk 'NR>1 {printf "   %-28s %s\n", $NF, $5}'
echo ""
echo "   Deliver the folder content (incl. INSTALL.md + RUN.md); send secrets separately (never the .env)."
