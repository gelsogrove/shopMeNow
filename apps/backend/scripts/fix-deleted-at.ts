// Fix deletedAt field for workspace
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load .env from project root
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixDeletedAt() {
  console.log('🔍 Checking workspace deletedAt field...\n');
  
  const ws = await prisma.workspace.findUnique({
    where: { id: 'echatbot-hq-support' },
    select: { 
      id: true, 
      name: true, 
      deletedAt: true, 
      channelStatus: true 
    }
  });
  
  console.log('📊 Current state:', JSON.stringify(ws, null, 2));
  
  if (!ws) {
    console.log('\n❌ Workspace not found!');
    await prisma.$disconnect();
    process.exit(1);
  }
  
  if (ws.deletedAt !== null) {
    console.log('\n❌ PROBLEM FOUND!');
    console.log(`   deletedAt = ${ws.deletedAt}`);
    console.log('\n✅ FIXING: Setting deletedAt to NULL...\n');
    
    await prisma.workspace.update({
      where: { id: 'echatbot-hq-support' },
      data: { deletedAt: null }
    });
    
    const fixed = await prisma.workspace.findUnique({
      where: { id: 'echatbot-hq-support' },
      select: { deletedAt: true, channelStatus: true }
    });
    
    console.log('✅ FIXED!');
    console.log('   New deletedAt:', fixed?.deletedAt);
    console.log('   channelStatus:', fixed?.channelStatus);
  } else {
    console.log('\n✅ Already OK: deletedAt is NULL (workspace is active)');
  }
  
  await prisma.$disconnect();
}

fixDeletedAt()
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
