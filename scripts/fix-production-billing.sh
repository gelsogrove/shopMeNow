#!/bin/bash

# Fix Production Billing Bug Script
# Fixes admin@echatbot.ai balance after race condition bug

set -e

echo "🔧 eChatbot Production Billing Fix"
echo "===================================="
echo ""

USER_ID="f9505595-a1ec-4b98-88cc-030d74f5abbf"
USER_EMAIL="admin@echatbot.ai"

echo "📋 Step 1: Show current status"
echo ""
export PATH="/opt/homebrew/opt/postgresql@16/bin:$PATH"
heroku pg:psql -a echatbot-app -c "
SELECT 
  email,
  \"creditBalance\",
  \"planType\"
FROM users 
WHERE id = '$USER_ID';
"

echo ""
echo "📋 Step 2: Show problematic transactions"
echo ""
heroku pg:psql -a echatbot-app -c "
SELECT 
  \"createdAt\",
  type,
  description,
  amount,
  \"balanceAfter\"
FROM billing_transactions
WHERE \"userId\" = '$USER_ID'
AND \"createdAt\" >= '2025-12-28'
ORDER BY \"createdAt\" DESC;
"

echo ""
echo "🔍 Step 3: Identify problematic transaction"
echo ""
PROBLEMATIC_TX_ID=$(heroku pg:psql -a echatbot-app -c "
SELECT id
FROM billing_transactions
WHERE \"userId\" = '$USER_ID'
AND \"createdAt\" >= '2025-12-28 15:00'
AND \"createdAt\" <= '2025-12-28 16:00'
AND type = 'MESSAGE'
AND amount > 0
LIMIT 1;" --csv | tail -n 1)

if [ -z "$PROBLEMATIC_TX_ID" ]; then
  echo "❌ No problematic transaction found (amount > 0)"
  echo "✅ Database might already be fixed!"
  exit 0
fi

echo "Found transaction ID: $PROBLEMATIC_TX_ID"
echo ""

echo "🗑️  Step 4: Delete problematic transaction"
echo ""
heroku pg:psql -a echatbot-app -c "
DELETE FROM billing_transactions
WHERE id = '$PROBLEMATIC_TX_ID';
"

echo "✅ Transaction deleted"
echo ""

echo "💰 Step 5: Calculate correct balance"
echo ""
echo "Finding last valid transaction before the bug..."
CORRECT_BALANCE=$(heroku pg:psql -a echatbot-app -c "
SELECT \"balanceAfter\"
FROM billing_transactions
WHERE \"userId\" = '$USER_ID'
AND \"createdAt\" < '2025-12-28 15:00'
ORDER BY \"createdAt\" DESC
LIMIT 1;" --csv | tail -n 1)

echo "Correct balance should be: $CORRECT_BALANCE€"
echo ""

echo "🔄 Step 6: Update user balance to correct value"
echo ""
heroku pg:psql -a echatbot-app -c "
UPDATE users
SET \"creditBalance\" = $CORRECT_BALANCE
WHERE id = '$USER_ID';
"

echo "✅ Balance restored"
echo ""

echo "📊 Step 7: Verify fix"
echo ""
heroku pg:psql -a echatbot-app -c "
SELECT 
  email,
  \"creditBalance\" as \"Current Balance\",
  \"planType\"
FROM users 
WHERE id = '$USER_ID';
"

echo ""
echo "📋 Recent transactions after fix:"
echo ""
heroku pg:psql -a echatbot-app -c "
SELECT 
  \"createdAt\",
  type,
  description,
  amount,
  \"balanceAfter\"
FROM billing_transactions
WHERE \"userId\" = '$USER_ID'
ORDER BY \"createdAt\" DESC
LIMIT 10;
"

echo ""
echo "✅ Fix completed successfully!"
echo ""
echo "Next steps:"
echo "1. Deploy updated code to Heroku: ./scripts/deploy-all-heroku.sh"
echo "2. Monitor for any new issues"
echo "3. Run tests: cd apps/backend && npm run test:unit"
echo ""
