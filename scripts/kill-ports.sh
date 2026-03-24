#!/bin/bash

# kill-ports.sh — Kills processes on dev ports 3000 and 3001
echo "🔪 Killing processes on ports 3000, 3001..."
npx kill-port 3000 3001 2>/dev/null || true
echo "✅ Ports cleared"
