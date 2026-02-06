#!/bin/bash
# Fix webhook ID for eChatbot workspace

echo "🔧 Updating webhook ID for eChatbot workspace..."
echo ""

heroku run "node -e \"
const prisma = require('@echatbot/database').prisma;
(async () => {
  const settings = await prisma.whatsappSettings.findFirst({
    where: { workspace: { name: { contains: 'eChatbot' }, deletedAt: null } },
    include: { workspace: { select: { name: true } } }
  });
  
  if (!settings) {
    console.log('❌ WhatsApp settings not found');
    return;
  }
  
  console.log('📋 BEFORE UPDATE:');
  console.log('   Workspace:', settings.workspace.name);
  console.log('   Current webhookId:', settings.webhookId || 'NULL');
  console.log('');
  
  // Update with correct webhook ID from UltraMsg
  await prisma.whatsappSettings.update({
    where: { id: settings.id },
    data: { webhookId: 'wh_28dbf534d425a7dbba9e3e73' }
  });
  
  console.log('✅ UPDATED:');
  console.log('   New webhookId: wh_28dbf534d425a7dbba9e3e73');
  console.log('');
  console.log('🎯 Now test by sending a WhatsApp message to +34602119358');
  
  await prisma.\$disconnect();
})();
\"" --app echatbot-app
