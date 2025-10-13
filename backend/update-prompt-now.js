const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function updatePrompt() {
  try {
    console.log('📝 Reading prompt from docs/prompt_agent.md...');
    
    const promptPath = path.join(__dirname, '..', 'docs', 'prompt_agent.md');
    const promptContent = fs.readFileSync(promptPath, 'utf-8');
    
    console.log(`✅ Prompt read: ${promptContent.length} characters`);
    
    // Get workspace
    const workspace = await prisma.workspace.findFirst({
      where: { name: 'L\'Altra Italia' }
    });
    
    if (!workspace) {
      console.error('❌ Workspace not found');
      process.exit(1);
    }
    
    console.log(`✅ Found workspace: ${workspace.name} (${workspace.id})`);
    
    // Update agentConfig
    const updated = await prisma.agentConfig.updateMany({
      where: { 
        workspaceId: workspace.id,
        isActive: true
      },
      data: {
        systemPrompt: promptContent,
        updatedAt: new Date()
      }
    });
    
    console.log(`✅ Updated ${updated.count} agent config(s)`);
    
    // Verify
    const config = await prisma.agentConfig.findFirst({
      where: { 
        workspaceId: workspace.id,
        isActive: true
      }
    });
    
    if (config && config.systemPrompt.includes('🚨 **REGOLA CRITICA - LINK PROIBITI**')) {
      console.log('✅ Verification passed: New rules are in the database!');
    } else {
      console.log('⚠️ Warning: Could not verify new rules in database');
    }
    
    console.log('✅ Prompt updated successfully!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updatePrompt();
