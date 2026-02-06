#!/bin/bash
# Check webhook configuration for eChatbot workspace

echo "🔍 Checking webhook configuration..."
echo ""

heroku run "node -e \"
const prisma = require('@echatbot/database').prisma;
(async () => {
  const workspace = await prisma.workspace.findFirst({
    where: { name: { contains: 'eChatbot' }, deletedAt: null },
    include: { whatsappSettings: true }
  });
  
  if (!workspace) {
    console.log('❌ Workspace not found');
    return;
  }
  
  console.log('✅ Workspace:', workspace.name);
  console.log('📱 WhatsApp Number:', workspace.whatsappPhoneNumber || 'NOT SET');
  console.log('🔑 Verify Token:', workspace.whatsappVerifyToken || 'NOT SET');
  console.log('🌐 Webhook URL:', workspace.webhookUrl || 'https://www.echatbot.ai/api/whatsapp/webhook');
  console.log('');
  console.log('📋 Meta Business Configuration:');
  console.log('   Callback URL: https://www.echatbot.ai/api/whatsapp/webhook');
  console.log('   Verify Token:', workspace.whatsappVerifyToken || 'NOT SET');
  console.log('   Webhook Fields: messages, message_status');
  
  await prisma.\$disconnect();
})();
\"" --app echatbot-app 2>&1 | grep -v "npm warn"
