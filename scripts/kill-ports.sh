#!/bin/bash
# kill-ports.sh - Kills processes on development ports before starting services
# Usage: ./scripts/kill-ports.sh

# Define ports used by the application
PORTS=(3000 3001 3002 5173 5174)

echo "🔪 Killing processes on development ports..."

for PORT in "${PORTS[@]}"; do
  # Find process using the port
  PID=$(lsof -ti :$PORT 2>/dev/null)
  
  if [ -n "$PID" ]; then
    echo "   Port $PORT: killing PID $PID"
    kill -9 $PID 2>/dev/null
  else
    echo "   Port $PORT: free ✓"
  fi
done

echo "✅ All ports cleared!"
echo ""
