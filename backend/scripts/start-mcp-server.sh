#!/bin/bash

# ShopMe MCP Server Startup Script
echo "🚀 Starting ShopMe MCP Server..."

# Check if server is already running
if pgrep -f "mcp-server.js" > /dev/null; then
    echo "⚠️  MCP Server is already running!"
    echo "📋 Running processes:"
    ps aux | grep "mcp-server.js" | grep -v grep
    exit 1
fi

# Start the server
echo "🔄 Starting MCP Server..."
cd "$(dirname "$0")"
node mcp-server.js &

# Get the PID
SERVER_PID=$!
echo "✅ MCP Server started with PID: $SERVER_PID"
echo "📋 Server status:"
ps aux | grep "mcp-server.js" | grep -v grep

echo ""
echo "🎯 MCP Server is now ready for Cursor integration!"
echo "📁 Configuration file: cursor-mcp-config.json"
echo "🛠️  Available tools: test_chat, seed_database, check_health, debug_function"
echo ""
echo "💡 To stop the server: kill $SERVER_PID"

