# Model Context Protocol (MCP) - ShopME Integration

> **Complete guide to using MCP for testing and debugging the WhatsApp chatbot**

---

## 📚 Table of Contents

- [Overview](#overview)
- [What is MCP?](#what-is-mcp)
- [ShopME MCP Server](#shopme-mcp-server)
- [Installation & Setup](#installation--setup)
- [Available Tools](#available-tools)
- [Usage Examples](#usage-examples)
- [Integration with Cursor](#integration-with-cursor)
- [Troubleshooting](#troubleshooting)
- [Best Practices](#best-practices)

---

## Overview

The ShopME project includes a **Model Context Protocol (MCP) server** that enables:

- ✅ **Testing WhatsApp chatbot** without actual WhatsApp messages
- ✅ **Debugging LLM functions** in isolation
- ✅ **Database seeding** for quick test data setup
- ✅ **Health checking** backend services
- ✅ **Integration with Cursor IDE** for seamless development

**Location**: `/MCP/` folder in project root

---

## What is MCP?

**Model Context Protocol (MCP)** is a standardized protocol that allows:

- **AI tools** (like Cursor, GitHub Copilot) to communicate with external services
- **Developers** to create custom tools for their AI assistants
- **Consistent interface** for testing, debugging, and automation

### Key Concepts

| Concept | Description |
|---------|-------------|
| **MCP Server** | Background service exposing tools via stdio |
| **MCP Client** | IDE or tool consuming MCP servers (Cursor, Claude) |
| **Tool** | Individual function exposed by MCP server |
| **Stdio Transport** | Communication via standard input/output |

---

## ShopME MCP Server

The ShopME MCP server provides 4 main tools:

### 1. `test_chat` - Test WhatsApp Conversations

Simulates WhatsApp chat interactions without sending real messages.

**Use Cases**:
- Test product catalog queries
- Validate cart operations (add, remove, confirm)
- Debug LLM response generation
- Test multi-turn conversations

### 2. `seed_database` - Populate Test Data

Runs the Prisma seed script to create test data.

**Use Cases**:
- Reset database to known state
- Create test workspace, products, customers
- Prepare for integration tests

### 3. `check_health` - Backend Health Check

Verifies backend services are running.

**Use Cases**:
- Pre-flight checks before testing
- Monitor service availability
- Validate database connectivity

### 4. `debug_function` - Function-Level Debugging

Debug individual chatbot functions in isolation.

**Use Cases**:
- Test `ragSearch` with specific queries
- Debug `add_to_cart` logic
- Isolate function failures

---

## Installation & Setup

### Prerequisites

1. **Backend running** on port 3001
   ```bash
   cd backend && npm run dev
   ```

2. **Database accessible** (PostgreSQL via Docker)
   ```bash
   docker-compose up -d
   ```

3. **Environment variables** set (`.env` configured)

### Step 1: Install MCP Dependencies

```bash
cd MCP
npm install
```

**Dependencies**:
- `@modelcontextprotocol/sdk` - MCP protocol implementation
- `axios` - HTTP client for backend communication

### Step 2: Start MCP Server

**Option A: Automatic (Recommended)**
```bash
./start-shopme-mcp-for-cursor.sh
```

**Option B: Manual**
```bash
node mcp-server.js &
```

**Option C: Foreground (for debugging)**
```bash
node mcp-server.js
```

### Step 3: Verify Server is Running

```bash
# Check process
ps aux | grep "mcp-server.js" | grep -v grep

# Test with client
node mcp-test-client.js
```

---

## Available Tools

### Tool 1: `test_chat`

**Purpose**: Simulate WhatsApp chat interactions

**Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `user` | string | ✅ Yes | - | User name (e.g., "Mario Rossi") |
| `message` | string | ✅ Yes | - | Message to send to chatbot |
| `log` | boolean | No | `true` | Enable detailed logging |
| `exitFirstMessage` | boolean | No | `true` | Stop after first response |

**Example**:
```json
{
  "user": "Mario Rossi",
  "message": "aggiungi una mozzarella al carrello",
  "log": true,
  "exitFirstMessage": true
}
```

**Response Format**:
```json
{
  "success": true,
  "response": "✅ Ho aggiunto 1x Mozzarella di Bufala al carrello...",
  "metadata": {
    "customerId": "cm9hjgq9v00014qk8fsdy4ujv",
    "workspaceId": "cm9...",
    "timestamp": "2025-10-14T10:30:45.123Z"
  }
}
```

---

### Tool 2: `seed_database`

**Purpose**: Populate database with test data

**Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `log` | boolean | No | `true` | Enable seed script output |

**Example**:
```json
{
  "log": true
}
```

**What Gets Created**:
- ✅ Test workspace ("ShopMe Test")
- ✅ Admin user (admin@shopme.com)
- ✅ 10+ products (mozzarella, prosecco, etc.)
- ✅ Test customers
- ✅ Agent configuration (LLM prompts)

---

### Tool 3: `check_health`

**Purpose**: Verify backend services are operational

**Parameters**: None

**Example**:
```json
{}
```

**Response Format**:
```json
{
  "status": "healthy",
  "backend": "http://localhost:3001",
  "database": "connected",
  "uptime": "2h 34m",
  "timestamp": "2025-10-14T10:30:45.123Z"
}
```

---

### Tool 4: `debug_function`

**Purpose**: Debug individual chatbot functions

**Parameters**:

| Parameter | Type | Required | Default | Description |
|-----------|------|----------|---------|-------------|
| `functionName` | string | ✅ Yes | - | Function name (e.g., "ragSearch", "add_to_cart") |
| `testData` | object | No | `{}` | Function-specific test data |

**Example**:
```json
{
  "functionName": "ragSearch",
  "testData": {
    "query": "delivery times",
    "workspaceId": "cm9hjgq9v00014qk8fsdy4ujv"
  }
}
```

**Supported Functions**:
- `ragSearch` - Search FAQs/products/services
- `add_to_cart` - Add product to cart
- `remove_from_cart` - Remove product from cart
- `confirm_order` - Finalize order
- `get_products` - Retrieve product catalog

---

## Usage Examples

### Example 1: Simple Product Query

```javascript
// In Cursor with MCP enabled:
mcp_shopme_test_chat({
  user: "Mario Rossi",
  message: "che prodotti avete?"
})
```

**Expected Response**:
```
📦 Ecco il nostro catalogo:
1. Mozzarella di Bufala - €8.50
2. Prosecco DOC - €12.00
3. Parmigiano Reggiano - €15.00
...
```

---

### Example 2: Multi-Turn Conversation

```javascript
// Step 1: Add product
mcp_shopme_test_chat({
  user: "Mario Rossi",
  message: "aggiungi una mozzarella"
})

// Step 2: Add another product
mcp_shopme_test_chat({
  user: "Mario Rossi",
  message: "aggiungi anche un prosecco"
})

// Step 3: Confirm order
mcp_shopme_test_chat({
  user: "Mario Rossi",
  message: "CONFERMA"
})
```

---

### Example 3: Debug RAG Search

```javascript
mcp_shopme_debug_function({
  functionName: "ragSearch",
  testData: {
    query: "orari di consegna",
    workspaceId: "cm9hjgq9v00014qk8fsdy4ujv"
  }
})
```

**Expected Response**:
```json
{
  "results": [
    {
      "type": "faq",
      "question": "Quali sono gli orari di consegna?",
      "answer": "Consegniamo dal lunedì al venerdì, 9:00-18:00",
      "relevanceScore": 0.95
    }
  ]
}
```

---

### Example 4: Reset Database for Testing

```javascript
// Seed database with fresh test data
mcp_shopme_seed_database({
  log: true
})
```

**Output**:
```
🌱 Seeding database...
✅ Created workspace: ShopMe Test
✅ Created 12 products
✅ Created 3 test customers
✅ Created agent configuration
✅ Database seeded successfully
```

---

## Integration with Cursor

### Step 1: Configure Cursor Settings

Edit your Cursor MCP configuration file:

**Location**: 
- **macOS**: `~/.cursor/mcp_config.json`
- **Windows**: `%APPDATA%\Cursor\mcp_config.json`
- **Linux**: `~/.config/cursor/mcp_config.json`

**Configuration**:
```json
{
  "mcpServers": {
    "shopme": {
      "command": "node",
      "args": ["/Users/gelso/workspace/AI/shop/MCP/mcp-server.js"],
      "env": {
        "BACKEND_URL": "http://localhost:3001"
      }
    }
  }
}
```

### Step 2: Start MCP Server

```bash
cd /Users/gelso/workspace/AI/shop/MCP
./start-shopme-mcp-for-cursor.sh
```

### Step 3: Restart Cursor

Completely quit and reopen Cursor to load the MCP server.

### Step 4: Verify Tools are Available

In Cursor chat, you should see:
- `mcp_shopme_test_chat`
- `mcp_shopme_seed_database`
- `mcp_shopme_check_health`
- `mcp_shopme_debug_function`

### Step 5: Use Tools in Cursor

Simply reference tools in your prompt:

```
Please test the chatbot with user "Andrea" 
asking to add 2 mozzarellas to cart.
```

Cursor will automatically call `mcp_shopme_test_chat` tool.

---

## Troubleshooting

### Issue 1: MCP Server Won't Start

**Symptoms**:
- Server process not found
- "Cannot find module" errors
- Port conflicts

**Solutions**:

```bash
# 1. Check dependencies
cd MCP && npm install

# 2. Verify Node version (requires 18+)
node --version

# 3. Check for port conflicts (MCP uses stdio, not ports)
ps aux | grep node

# 4. Run in foreground to see errors
node mcp-server.js
```

---

### Issue 2: Tools Not Available in Cursor

**Symptoms**:
- Cursor doesn't show `mcp_shopme_*` tools
- Tools fail silently

**Solutions**:

```bash
# 1. Verify MCP config file exists
cat ~/.cursor/mcp_config.json

# 2. Check server is running
ps aux | grep mcp-server

# 3. Restart Cursor completely
# (Quit → Reopen, not just reload window)

# 4. Check Cursor logs
# Help → Toggle Developer Tools → Console
```

---

### Issue 3: Backend Connection Fails

**Symptoms**:
- "ECONNREFUSED" errors
- Health check fails
- Timeout errors

**Solutions**:

```bash
# 1. Verify backend is running
curl http://localhost:3001/api/health

# 2. Check database connection
cd backend && npm run dev

# 3. Verify environment variables
cd backend && cat .env | grep DATABASE_URL

# 4. Restart Docker containers
docker-compose restart
```

---

### Issue 4: Test Chat Returns Empty Response

**Symptoms**:
- `test_chat` succeeds but returns no chatbot response
- LLM doesn't reply

**Solutions**:

```bash
# 1. Check LLM API key
cd backend && cat .env | grep OPENROUTER_API_KEY

# 2. Verify agent configuration exists
npm run seed

# 3. Check backend logs
tail -f backend/logs/combined.log

# 4. Test LLM directly
curl -X POST http://localhost:3001/api/test-llm \
  -H "Content-Type: application/json" \
  -d '{"message": "test"}'
```

---

## Best Practices

### 1. Always Check Health Before Testing

```javascript
// Good: Check backend first
await mcp_shopme_check_health()
await mcp_shopme_test_chat({ user: "Andrea", message: "test" })

// Bad: Test without verification
await mcp_shopme_test_chat({ user: "Andrea", message: "test" })
```

---

### 2. Seed Database for Consistent Tests

```javascript
// Good: Reset to known state
await mcp_shopme_seed_database({ log: false })
await mcp_shopme_test_chat({ user: "Mario", message: "aggiungi mozzarella" })

// Bad: Test on unknown database state
await mcp_shopme_test_chat({ user: "Mario", message: "aggiungi mozzarella" })
```

---

### 3. Use Debug Function for Isolated Testing

```javascript
// Good: Test function in isolation
await mcp_shopme_debug_function({
  functionName: "add_to_cart",
  testData: { product_name: "mozzarella", quantity: 2 }
})

// Bad: Test through full chat flow every time
await mcp_shopme_test_chat({ user: "Test", message: "add mozzarella" })
```

---

### 4. Enable Logging for Debugging

```javascript
// Good: Detailed logs for debugging
await mcp_shopme_test_chat({
  user: "Andrea",
  message: "test",
  log: true  // <-- Always true when debugging
})

// Bad: No logs when something fails
await mcp_shopme_test_chat({
  user: "Andrea",
  message: "test",
  log: false
})
```

---

### 5. Stop Server When Not in Use

```bash
# Good: Clean shutdown
pkill -f "mcp-server.js"

# Bad: Leave orphaned processes
# (Can cause port conflicts or stale connections)
```

---

## File Structure

```
MCP/
├── mcp-server.js                 # Main MCP server (stdio protocol)
├── package.json                  # Dependencies (@modelcontextprotocol/sdk, axios)
├── cursor-mcp-config.json        # Cursor configuration example
├── cursor-config.json            # Alternative Cursor config
├── start-shopme-mcp-for-cursor.sh # Auto-start script
├── test-mcp.js                   # Test client for validation
├── mcp-test-client.js            # Alternative test client
├── mcp-usage-example.js          # Usage examples
└── README.md                     # Original MCP documentation
```

---

## Advanced Usage

### Running MCP Server as Background Service

```bash
# Start with nohup (survives terminal close)
nohup node MCP/mcp-server.js > /dev/null 2>&1 &

# Save PID for later
echo $! > /tmp/mcp-shopme.pid

# Stop server
kill $(cat /tmp/mcp-shopme.pid)
```

---

### Custom Tool Creation

To add new tools to the MCP server:

1. **Edit `mcp-server.js`**:

```javascript
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    // ... existing tools
    {
      name: "custom_tool",
      description: "Your custom tool description",
      inputSchema: {
        type: "object",
        properties: {
          param1: { type: "string", description: "Parameter 1" }
        },
        required: ["param1"]
      }
    }
  ]
}));
```

2. **Add tool handler**:

```javascript
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  
  if (name === "custom_tool") {
    // Your tool logic here
    return {
      content: [{ type: "text", text: "Tool result" }]
    };
  }
  
  // ... existing tool handlers
});
```

3. **Restart MCP server**:

```bash
pkill -f "mcp-server.js"
./start-shopme-mcp-for-cursor.sh
```

---

## Related Documentation

- [WhatsApp Integration Architecture](whatsapp-integration-architecture.md) - WhatsApp chatbot flow
- [LLM Service Flow](../03-ARCHITECTURE/LLMSERVICE-ARCHITECTURE-FLOW.md) - Chatbot LLM architecture
- [Scripts Guide](scripts-guide.md) - All npm commands including seed
- [Unit Test Guide](unit-test-guide.md) - Testing methodology

---

## Quick Reference

### Start/Stop Commands

```bash
# Start
./MCP/start-shopme-mcp-for-cursor.sh

# Stop
pkill -f "mcp-server.js"

# Check Status
ps aux | grep "mcp-server.js" | grep -v grep

# Test
node MCP/mcp-test-client.js
```

### Common Tools Usage

```javascript
// Test chat
mcp_shopme_test_chat({ user: "Andrea", message: "test" })

// Seed database
mcp_shopme_seed_database({ log: true })

// Health check
mcp_shopme_check_health()

// Debug function
mcp_shopme_debug_function({ functionName: "ragSearch", testData: {} })
```

---

**Last Updated**: October 14, 2025  
**Maintained by**: Andrea (gelsogrove)  
**Version**: 1.0
