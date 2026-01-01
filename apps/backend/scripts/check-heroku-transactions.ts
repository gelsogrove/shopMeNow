import { PrismaClient } from '@echatbot/database';
import { execSync } from 'child_process';

async function checkHerokuTransactions() {
  try {
    // Get Heroku DATABASE_URL
    console.log('🔍 Getting Heroku database URL...\n');
    const dbUrl = execSync('heroku config:get DATABASE_URL -a echatbot-app', { encoding: 'utf-8' }).trim();
    
    if (!dbUrl) {
      console.log('❌ Could not get DATABASE_URL from Heroku');
      return;
    }
    
    console.log('✅ Connected to Heroku production database\n');
    
    // Set DATABASE_URL environment variable for Prisma
    process.env.DATABASE_URL = dbUrl;
    
    // Create Prisma client (will use DATABASE_URL from env)
    const prisma = new PrismaClient();
    
    // Find admin user
    const user = await prisma.user.findUnique({
      where: { email: 'admin@echatbot.ai' }
    });
    
    if (!user) {
      console.log('❌ User admin@echatbot.ai not found in production');
      await prisma.$disconnect();
      return;
    }
    
    console.log('✅ User ID:', user.id);
    console.log('💰 CURRENT BALANCE:', user.creditBalance.toString(), '€');
    console.log('📊 Current Plan:', user.planType);
    console.log('\n=== ALL TRANSACTIONS (last 30) ===\n');
    
    const allTxs = await prisma.billingTransaction.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 30
    });
    
    if (allTxs.length === 0) {
      console.log('⚠️  No transactions found');
    } else {
      allTxs.forEach((tx, i) => {
        const date = tx.createdAt.toLocaleString('it-IT', { 
          day: '2-digit', 
          month: '2-digit', 
          year: 'numeric',
          hour: '2-digit', 
          minute: '2-digit',
          second: '2-digit'
        });
        
        console.log(`[${i}] ${date}`);
        console.log(`    Type: ${tx.type}`);
        console.log(`    Description: ${tx.description}`);
        console.log(`    Amount: ${tx.amount}€`);
        console.log(`    Balance After: ${tx.balanceAfter}€`);
        console.log(`    ID: ${tx.id}`);
        console.log('');
      });
    }
    
    // Find the problematic upgrade transaction
    console.log('\n🔎 Searching for Enterprise upgrade transaction...\n');
    
    const upgradeTx = allTxs.find(tx => 
      tx.type === 'UPGRADE_FEE' && 
      tx.description?.includes('Enterprise') &&
      Number(tx.balanceAfter) > 400
    );
    
    if (upgradeTx) {
      console.log('🎯 FOUND PROBLEMATIC TRANSACTION:');
      console.log(`   ID: ${upgradeTx.id}`);
      console.log(`   Date: ${upgradeTx.createdAt.toLocaleString('it-IT')}`);
      console.log(`   Description: ${upgradeTx.description}`);
      console.log(`   Amount: ${upgradeTx.amount}€`);
      console.log(`   Balance After: ${upgradeTx.balanceAfter}€`);
      
      // Find transaction before it
      const txBefore = allTxs
        .filter(t => t.createdAt < upgradeTx.createdAt)
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
      
      if (txBefore) {
        console.log(`\n   Previous balance was: ${txBefore.balanceAfter}€`);
        const diff = Number(upgradeTx.balanceAfter) - Number(txBefore.balanceAfter);
        console.log(`   🔴 BALANCE INCREASED BY: ${diff.toFixed(2)}€`);
      }
    } else {
      console.log('⚠️  No Enterprise upgrade transaction found with balance > 400€');
    }
    
    await prisma.$disconnect();
    console.log('\n✅ Analysis complete');
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

checkHerokuTransactions();
