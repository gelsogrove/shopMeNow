/**
 * Full Soft-Delete Test Script
 * 
 * Tests the complete soft-delete and hard-delete flow
 */

import { prisma } from '../../../packages/database/src';

async function fullTest() {
  console.log('========================================');
  console.log('FULL SOFT-DELETE TEST');
  console.log('========================================');
  
  // 1. Count initial records
  console.log('\n[STEP 1] Initial counts');
  const initialUsers = await prisma.user.count();
  const initialWorkspaces = await prisma.workspace.count();
  const initialProducts = await prisma.products.count();
  const initialCategories = await prisma.categories.count();
  const initialOrders = await prisma.orders.count();
  console.log('Users:', initialUsers);
  console.log('Workspaces:', initialWorkspaces);
  console.log('Products:', initialProducts);
  console.log('Categories:', initialCategories);
  console.log('Orders:', initialOrders);
  
  // 2. Find a user to soft-delete
  const testUser = await prisma.user.findFirst({
    where: { email: 'admin@echatbot.ai' },
    include: { ownedWorkspaces: true }
  });
  
  if (!testUser) {
    console.log('ERROR: Test user not found!');
    process.exit(1);
  }
  
  const workspaceId = testUser.ownedWorkspaces[0]?.id;
  
  console.log('\n[STEP 2] Test user details');
  console.log('User ID:', testUser.id);
  console.log('Email:', testUser.email);
  console.log('Owned workspaces:', testUser.ownedWorkspaces.length);
  console.log('Workspace ID:', workspaceId);
  
  // 3. Soft-delete the user (simulating what the API does)
  console.log('\n[STEP 3] Soft-deleting user...');
  const now = new Date();
  
  await prisma.$transaction(async (tx) => {
    // Soft-delete user
    await tx.user.update({
      where: { id: testUser.id },
      data: { deletedAt: now, isDelete: true }
    });
    
    // Cascade soft-delete owned workspaces
    for (const ws of testUser.ownedWorkspaces) {
      await tx.workspace.update({
        where: { id: ws.id },
        data: { deletedAt: now, isDelete: true }
      });
    }
  });
  
  console.log('Soft-delete completed at:', now.toISOString());
  
  // 4. Verify soft-delete flags
  console.log('\n[STEP 4] Verifying soft-delete flags...');
  const deletedUser = await prisma.user.findUnique({ where: { id: testUser.id } });
  const deletedWorkspace = workspaceId 
    ? await prisma.workspace.findUnique({ where: { id: workspaceId } })
    : null;
  
  console.log('User deletedAt:', deletedUser?.deletedAt?.toISOString());
  console.log('User isDelete:', deletedUser?.isDelete);
  console.log('Workspace deletedAt:', deletedWorkspace?.deletedAt?.toISOString());
  console.log('Workspace isDelete:', deletedWorkspace?.isDelete);
  
  const userFlagsOk = deletedUser?.deletedAt && deletedUser?.isDelete;
  const workspaceFlagsOk = deletedWorkspace?.deletedAt && deletedWorkspace?.isDelete;
  
  console.log('User flags correct:', userFlagsOk ? 'YES' : 'NO');
  console.log('Workspace flags correct:', workspaceFlagsOk ? 'YES' : 'NO');
  
  // 5. Verify records still exist (just marked as deleted)
  console.log('\n[STEP 5] Counts AFTER soft-delete (should be same)');
  const afterUsers = await prisma.user.count();
  const afterWorkspaces = await prisma.workspace.count();
  const afterProducts = await prisma.products.count();
  console.log('Users:', afterUsers, '- Same as before:', afterUsers === initialUsers ? 'YES' : 'NO');
  console.log('Workspaces:', afterWorkspaces, '- Same as before:', afterWorkspaces === initialWorkspaces ? 'YES' : 'NO');
  console.log('Products:', afterProducts, '- Same as before:', afterProducts === initialProducts ? 'YES' : 'NO');
  
  // 6. Set deletedAt to 100 days ago to trigger cronjob
  console.log('\n[STEP 6] Setting deletedAt to 100 days ago...');
  const oldDate = new Date();
  oldDate.setDate(oldDate.getDate() - 100);
  
  await prisma.user.updateMany({
    where: { deletedAt: { not: null } },
    data: { deletedAt: oldDate }
  });
  await prisma.workspace.updateMany({
    where: { deletedAt: { not: null } },
    data: { deletedAt: oldDate }
  });
  console.log('Set deletedAt to:', oldDate.toISOString());
  
  // 7. Run cronjob
  console.log('\n[STEP 7] Running cronjob...');
  const { softDeleteCleanupJob } = await import('../../scheduler/src/jobs/soft-delete-cleanup.job');
  await softDeleteCleanupJob();
  
  // 8. Verify hard-delete
  console.log('\n[STEP 8] Counts AFTER hard-delete');
  const finalUsers = await prisma.user.count();
  const finalWorkspaces = await prisma.workspace.count();
  const finalProducts = await prisma.products.count();
  const finalCategories = await prisma.categories.count();
  const finalOrders = await prisma.orders.count();
  
  console.log('Users:', finalUsers, '(was', initialUsers, ') - Deleted:', initialUsers - finalUsers);
  console.log('Workspaces:', finalWorkspaces, '(was', initialWorkspaces, ') - Deleted:', initialWorkspaces - finalWorkspaces);
  console.log('Products:', finalProducts, '(was', initialProducts, ') - Deleted:', initialProducts - finalProducts);
  console.log('Categories:', finalCategories, '(was', initialCategories, ') - Deleted:', initialCategories - finalCategories);
  console.log('Orders:', finalOrders, '(was', initialOrders, ') - Deleted:', initialOrders - finalOrders);
  
  // 9. Check for orphans
  console.log('\n[STEP 9] Checking for orphan records...');
  
  // Check if workspace still exists
  const wsStillExists = workspaceId 
    ? await prisma.workspace.findUnique({ where: { id: workspaceId } })
    : null;
  
  if (wsStillExists) {
    console.log('ERROR: Workspace was NOT deleted!');
  } else {
    console.log('Workspace deleted: YES');
  }
  
  // Check if user still exists  
  const userStillExists = await prisma.user.findUnique({ where: { id: testUser.id } });
  if (userStillExists) {
    console.log('ERROR: User was NOT deleted!');
  } else {
    console.log('User deleted: YES');
  }
  
  // Check for any orphan records pointing to deleted workspace
  if (workspaceId) {
    const orphanProducts = await prisma.products.count({ where: { workspaceId } });
    const orphanCategories = await prisma.categories.count({ where: { workspaceId } });
    const orphanOrders = await prisma.orders.count({ where: { workspaceId } });
    const orphanCustomers = await prisma.customers.count({ where: { workspaceId } });
    const orphanChatSessions = await prisma.chatSession.count({ where: { workspaceId } });
    
    console.log('Orphan products:', orphanProducts, orphanProducts === 0 ? '- OK' : '- ERROR!');
    console.log('Orphan categories:', orphanCategories, orphanCategories === 0 ? '- OK' : '- ERROR!');
    console.log('Orphan orders:', orphanOrders, orphanOrders === 0 ? '- OK' : '- ERROR!');
    console.log('Orphan customers:', orphanCustomers, orphanCustomers === 0 ? '- OK' : '- ERROR!');
    console.log('Orphan chatSessions:', orphanChatSessions, orphanChatSessions === 0 ? '- OK' : '- ERROR!');
  }
  
  console.log('\n========================================');
  console.log('TEST COMPLETE');
  console.log('========================================');
  
  await prisma.$disconnect();
  process.exit(0);
}

fullTest().catch(async (err) => {
  console.error('Test failed:', err);
  await prisma.$disconnect();
  process.exit(1);
});
