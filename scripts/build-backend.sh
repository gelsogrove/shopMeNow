#!/bin/bash
set -e

echo "🔨 Building backend..."
cd "$(dirname "$0")/../apps/backend"
npx tsc
echo "✅ Backend build completed"
