import { prisma } from '@echatbot/database';

async function fixAdminTransaction() {
  try {
    console.log('🔍 Finding user admin@echatbot.ai...\n');
    
    const user = await prisma.user.findUnique({
      where: { email: 'admin@echatbot.ai' }
    });
    
    if (!user) {
      console.log('❌ User not found');
      return;
    }
    
    console.log('✅ User found:', user.id);
    console.log('📊 Current Balance:', user.creditBalance.toString());
    console.log('\n--- Recent Transactions ---\n');
    
    // Get all transactions from December 2024
    const transactions = await prisma.billingTransaction.findMany({
      where: {
        userId: user.id,
        createdAt: {
          gte: new Date('2024-12-01')
        }
      },
      orderBy: { createdAt: 'asc' }
    });
    
    transactions.forEach((tx, index) => {
      console.log(`[${index}] ID: ${tx.id}`);
      console.log(`    Date: ${tx.createdAt.toLocaleString('it-IT')}`);
      console.log(`    Type: ${tx.type}`);
      console.log(`    Description: ${tx.description}`);
      console.log(`    Amount: ${tx.amount.toString()}€`);
      console.log(`    Balance After: ${tx.balanceAfter.toString()}€`);
      console.log('');
    });
    
    // Find problematic transaction (downgrade with wrong balance)
    const problematicTx = transactions.find(tx => 
      tx.type === 'PLAN_CHANGE' && 
      tx.description?.includes('Downgrade') &&
      tx.createdAt >= new Date('2026-01-01') &&
      Number(tx.balanceAfter) > 490 // Balance anomaly
    );
    
    if (!problematicTx) {
      console.log('⚠️  No problematic transaction found (downgrade with balance > 490€)');
      console.log('💡 If you need to delete a specific transaction, modify the script');
      return;
    }
    
    console.log('🎯 Found problematic transaction:');
    console.log(`   ID: ${problematicTx.id}`);
    console.log(`   Description: ${problematicTx.description}`);
    console.log(`   Wrong Balance: ${problematicTx.balanceAfter.toString()}€\n`);
    
    // Calculate correct balance
    const txBeforeProblematic = transactions.filter(tx => 
      tx.createdAt < problematicTx.createdAt
    ).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
    
    const correctBalance = txBeforeProblematic ? txBeforeProblematic.balanceAfter : 0;
    
    console.log(`✅ Correct balance should be: ${correctBalance.toString()}€`);
    console.log('\n🗑️  Deleting problematic transaction...');
    
    // Delete transaction
    await prisma.billingTransaction.delete({
      where: { id: problematicTx.id }
    });
    
    console.log('✅ Transaction deleted');
    
    // Update user balance to correct value
    console.log(`\n💰 Updating user balance to ${correctBalance.toString()}€...`);
    
    await prisma.user.update({
      where: { id: user.id },
      data: { creditBalance: correctBalance }
    });
    
    console.log('✅ Balance updated');
    
    // Verify
    const updatedUser = await prisma.user.findUnique({
      where: { id: user.id }
    });
    
    console.log('\n✨ Final Status:');
    console.log(`   User: ${updatedUser?.email}`);
    console.log(`   Balance: ${updatedUser?.creditBalance.toString()}€`);
    console.log('\n✅ Fix completed successfully!');
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

fixAdminTransaction();
