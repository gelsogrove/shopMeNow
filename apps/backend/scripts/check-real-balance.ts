import { prisma } from '@echatbot/database';

async function checkRealBalance() {
  try {
    const user = await prisma.user.findUnique({
      where: { email: 'admin@echatbot.ai' }
    });
    
    if (!user) {
      console.log('❌ User not found');
      return;
    }
    
    console.log('✅ User ID:', user.id);
    console.log('💰 CURRENT BALANCE:', user.creditBalance.toString(), '€');
    console.log('\n--- Last 20 Transactions (descending) ---\n');
    
    const allTxs = await prisma.billingTransaction.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
    
    allTxs.forEach((tx, i) => {
      console.log(`[${i}] ${tx.createdAt.toLocaleString('it-IT')}`);
      console.log(`    Type: ${tx.type}`);
      console.log(`    Description: ${tx.description}`);
      console.log(`    Amount: ${tx.amount}€`);
      console.log(`    Balance After: ${tx.balanceAfter}€`);
      console.log(`    ID: ${tx.id}`);
      console.log('');
    });
    
    await prisma.$disconnect();
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

checkRealBalance();
