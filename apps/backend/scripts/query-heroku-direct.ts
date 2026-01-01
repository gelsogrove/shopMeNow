import { execSync } from 'child_process';

console.log('🔍 Fetching admin@echatbot.ai transactions from Heroku production...\n');

try {
  // Get current balance
  const balanceQuery = `
    SELECT 
      id, 
      email, 
      "creditBalance", 
      "planType",
      "subscriptionStatus"
    FROM "User" 
    WHERE email = 'admin@echatbot.ai';
  `;
  
  console.log('💰 CURRENT USER STATUS:\n');
  const userResult = execSync(
    `heroku pg:psql -a echatbot-app --command "${balanceQuery.replace(/\n/g, ' ')}"`,
    { encoding: 'utf-8', stdio: 'pipe' }
  );
  console.log(userResult);
  
  // Get user ID first
  const userIdQuery = `SELECT id FROM "User" WHERE email = 'admin@echatbot.ai';`;
  const userIdResult = execSync(
    `heroku pg:psql -a echatbot-app --command "${userIdQuery}" -t`,
    { encoding: 'utf-8', stdio: 'pipe' }
  ).trim();
  
  const userId = userIdResult.split('\n').find(line => line.trim())?.trim();
  
  if (!userId) {
    console.log('❌ User not found');
    process.exit(1);
  }
  
  console.log(`\n📋 USER ID: ${userId}`);
  console.log('\n=== LAST 30 TRANSACTIONS ===\n');
  
  // Get transactions
  const txQuery = `
    SELECT 
      "createdAt",
      type,
      description,
      amount,
      "balanceAfter"
    FROM "BillingTransaction"
    WHERE "userId" = '${userId}'
    ORDER BY "createdAt" DESC
    LIMIT 30;
  `;
  
  const txResult = execSync(
    `heroku pg:psql -a echatbot-app --command "${txQuery.replace(/\n/g, ' ')}"`,
    { encoding: 'utf-8', stdio: 'pipe' }
  );
  
  console.log(txResult);
  
  console.log('\n✅ Query complete');
  
} catch (error: any) {
  if (error.stderr) {
    console.error('❌ Error:', error.stderr.toString());
  } else {
    console.error('❌ Error:', error.message);
  }
  process.exit(1);
}
