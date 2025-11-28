#!/bin/bash

# ShopMe MCP Server Startup Script for Cursor Integration
echo "🚀 Starting ShopMe MCP Server for Cursor..."

# Check if server is already running
if pgrep -f "mcp-server.js" > /dev/null; then
    echo "⚠️  ShopMe MCP Server is already running!"
    echo "📋 Running processes:"
    ps aux | grep "mcp-server.js" | grep -v grep
    echo ""
    echo "✅ Server is ready for Cursor integration!"
    exit 0
fi

# Start the server
echo "🔄 Starting ShopMe MCP Server..."
cd "$(dirname "$0")"
node mcp-server.js &

# Get the PID
SERVER_PID=$!
echo "✅ ShopMe MCP Server started with PID: $SERVER_PID"

# Wait a moment for server to initialize
sleep 2

# Verify server is running
if pgrep -f "mcp-server.js" > /dev/null; then
    echo "🎯 ShopMe MCP Server is now ready for Cursor integration!"
    echo ""
    echo "📁 Configuration: ~/.cursor/mcp.json"
    echo "🛠️  Available tools:"
    echo "   • mcp_shopme_test_chat - Test WhatsApp chatbot"
    echo "   • mcp_shopme_seed_database - Seed database"
    echo "   • mcp_shopme_check_health - Check backend health"
    echo "   • mcp_shopme_debug_function - Debug specific functions"
    echo ""
    echo "💡 To use in Cursor:"
    echo "   1. Restart Cursor completely"
    echo "   2. Use tools like: mcp_shopme_test_chat('Mario Rossi', 'aggiungi mozzarella')"
    echo ""
    echo "🛑 To stop server: kill $SERVER_PID"
else
    echo "❌ Failed to start ShopMe MCP Server"
    exit 1
fi

