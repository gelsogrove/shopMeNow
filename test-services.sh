#!/bin/bash

# Test services selection flow
WORKSPACE_ID="cmj4xaxj80000egngdsgtfx7i"
CUSTOMER_ID="test_customer_$(date +%s)"

echo "🧪 Testing services selection flow..."
echo "Workspace: $WORKSPACE_ID"
echo "Customer: $CUSTOMER_ID"
echo ""

# Step 1: Ask for services
echo "📝 Step 1: User asks 'che servizi avete?'"
RESPONSE=$(curl -s -X POST http://localhost:3001/api/agent-chat \
  -H "Content-Type: application/json" \
  -d "{
    \"message\": \"che servizi avete?\",
    \"customerId\": \"$CUSTOMER_ID\",
    \"workspaceId\": \"$WORKSPACE_ID\",
    \"customerName\": \"Test Customer\",
    \"customerLanguage\": \"it\"
  }")

echo "Response:"
echo "$RESPONSE" | jq '.message' 2>/dev/null || echo "$RESPONSE"
echo ""

# Extract conversation ID from response
CONV_ID=$(echo "$RESPONSE" | jq -r '.conversationId // empty' 2>/dev/null)
if [ -z "$CONV_ID" ]; then
  CONV_ID=$(echo "$RESPONSE" | jq -r '.data.conversationId // empty' 2>/dev/null)
fi

if [ -n "$CONV_ID" ]; then
  echo "✅ Conversation ID: $CONV_ID"
  echo ""
  
  # Small delay
  sleep 1
  
  # Step 2: Select option "1" (first service)
  echo "📝 Step 2: User selects '1' (first service)"
  RESPONSE2=$(curl -s -X POST http://localhost:3001/api/agent-chat \
    -H "Content-Type: application/json" \
    -d "{
      \"message\": \"1\",
      \"customerId\": \"$CUSTOMER_ID\",
      \"workspaceId\": \"$WORKSPACE_ID\",
      \"conversationId\": \"$CONV_ID\",
      \"customerName\": \"Test Customer\",
      \"customerLanguage\": \"it\"
    }")
  
  echo "Response:"
  echo "$RESPONSE2" | jq '.message' 2>/dev/null || echo "$RESPONSE2"
  
else
  echo "❌ Could not extract conversation ID"
fi

