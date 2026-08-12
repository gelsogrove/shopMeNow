#!/usr/bin/env bash
# Builds the Docker delivery package into deploy/.
# Usage: npm run deploy:docker   (or ./scripts/deploy-docker.sh)
#
# Output: deploy/ ready to zip and hand to the customer —
#   echatbot-images.tar.gz + docker-compose.yml + .env.example + INSTALL.md + RUN.md
# Secrets are NEVER part of the package (.env stays out by design).

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
DEPLOY_DIR="$REPO_ROOT/deploy"
ARCHIVE="$DEPLOY_DIR/echatbot-images.tar.gz"

cd "$DEPLOY_DIR"

echo "🔨 Building images (app + scheduler)..."
docker compose build

echo "📦 Exporting images to $(basename "$ARCHIVE")..."
docker save echatbot-app:latest echatbot-scheduler:latest | gzip > "$ARCHIVE"

cp "$REPO_ROOT/.env.example" "$DEPLOY_DIR/.env.example"

echo ""
echo "✅ Package ready in deploy/:"
ls -lh "$DEPLOY_DIR" | awk 'NR>1 {printf "   %-28s %s\n", $NF, $5}'
echo ""
echo "   Deliver the folder content (incl. INSTALL.md + RUN.md); send secrets separately (never the .env)."
