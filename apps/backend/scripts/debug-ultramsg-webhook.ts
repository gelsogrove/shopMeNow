/**
 * 🔍 DEBUG: Find correct webhook URL for UltraMsg
 * 
 * Run with: npx ts-node scripts/debug-ultramsg-webhook.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function debugUltraMsgWebhook() {
  console.log('\n🔍 DEBUGGING ULTRAMSG WEBHOOK CONFIGURATION\n')
  console.log('=' .repeat(80))

  try {
    // 1. Find all workspaces using UltraMsg
    const ultraMsgWorkspaces = await prisma.workspace.findMany({
      where: {
        whatsappProvider: 'ultramsg',
        deletedAt: null
      },
      select: {
        id: true,
        name: true,
        slug: true,
        whatsappProvider: true,
        ultraMsgInstanceId: true,
        ultraMsgToken: true,
        ultraMsgApiUrl: true,
        channelStatus: true,
        ownerId: true,
        owner: {
          select: {
            email: true,
            status: true
          }
        },
        whatsappSettings: {
          select: {
            webhookId: true,
            webhookToken: true
          }
        }
      }
    })

    console.log(`\n📊 Found ${ultraMsgWorkspaces.length} workspaces using UltraMsg provider\n`)

    if (ultraMsgWorkspaces.length === 0) {
      console.log('❌ NO ULTRAMSG WORKSPACES FOUND!')
      console.log('\nPossible reasons:')
      console.log('1. Workspace provider is set to "meta" instead of "ultramsg"')
      console.log('2. Workspace was deleted (deletedAt is not null)')
      console.log('3. No workspaces configured yet')
      
      // Show ALL workspaces to help debug
      console.log('\n' + '='.repeat(80))
      console.log('📋 ALL WORKSPACES (for debugging):\n')
      
      const allWorkspaces = await prisma.workspace.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          name: true,
          slug: true,
          whatsappProvider: true,
          channelStatus: true,
          owner: {
            select: { email: true }
          }
        }
      })
      
      allWorkspaces.forEach((ws, idx) => {
        console.log(`${idx + 1}. ${ws.name} (${ws.slug})`)
        console.log(`   Provider: ${ws.whatsappProvider}`)
        console.log(`   Status: ${ws.channelStatus ? '🟢 Active' : '🔴 Disabled'}`)
        console.log(`   Owner: ${ws.owner?.email || 'N/A'}`)
        console.log(`   ID: ${ws.id}`)
        console.log('')
      })
      
      process.exit(1)
    }

    // Display each workspace with webhook details
    ultraMsgWorkspaces.forEach((workspace, index) => {
      console.log(`\n${index + 1}. 📱 ${workspace.name} (${workspace.slug})`)
      console.log('-'.repeat(80))
      console.log(`   Workspace ID: ${workspace.id}`)
      console.log(`   Provider: ${workspace.whatsappProvider}`)
      console.log(`   Channel Status: ${workspace.channelStatus ? '🟢 Active' : '🔴 Disabled'}`)
      console.log(`   Owner: ${workspace.owner?.email} (${workspace.owner?.status})`)
      console.log('')
      console.log(`   🔧 UltraMsg Configuration:`)
      console.log(`   - Instance ID: ${workspace.ultraMsgInstanceId || '❌ NOT SET'}`)
      console.log(`   - Token: ${workspace.ultraMsgToken ? '✅ Set (***' + workspace.ultraMsgToken.slice(-4) + ')' : '❌ NOT SET'}`)
      console.log(`   - API URL: ${workspace.ultraMsgApiUrl || '❌ NOT SET'}`)
      console.log('')
      
      if (workspace.whatsappSettings) {
        const webhookId = workspace.whatsappSettings.webhookId
        console.log(`   🎯 WEBHOOK CONFIGURATION:`)
        console.log(`   - Webhook ID: ${webhookId}`)
        console.log(`   - Webhook Token: ${workspace.whatsappSettings.webhookToken ? '✅ Set' : '❌ NOT SET'}`)
        console.log('')
        console.log(`   ✅ CORRECT WEBHOOK URL:`)
        console.log(`   https://www.echatbot.ai/api/whatsapp/ultramsg/${webhookId}`)
        console.log(`                          ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^`)
        console.log(`                          NO /v1/ in the path!`)
        console.log('')
      } else {
        console.log(`   ❌ NO WHATSAPP SETTINGS FOUND!`)
        console.log(`   Run: npm run seed (to create WhatsappSettings)`)
        console.log('')
      }
    })

    console.log('\n' + '='.repeat(80))
    console.log('📝 SUMMARY:\n')
    
    const hasWebhookSettings = ultraMsgWorkspaces.every(ws => ws.whatsappSettings)
    const hasCredentials = ultraMsgWorkspaces.every(ws => ws.ultraMsgInstanceId && ws.ultraMsgToken)
    const allActive = ultraMsgWorkspaces.every(ws => ws.channelStatus)
    
    if (hasWebhookSettings) {
      console.log('✅ All workspaces have WhatsappSettings')
    } else {
      console.log('❌ Some workspaces missing WhatsappSettings')
      console.log('   FIX: Run npm run seed')
    }
    
    if (hasCredentials) {
      console.log('✅ All workspaces have UltraMsg credentials')
    } else {
      console.log('❌ Some workspaces missing UltraMsg credentials (instanceId or token)')
      console.log('   FIX: Update workspace in database with UltraMsg credentials')
    }
    
    if (allActive) {
      console.log('✅ All channels are active')
    } else {
      console.log('⚠️  Some channels are disabled (channelStatus = false)')
      console.log('   FIX: Set channelStatus = true in database')
    }

    console.log('\n' + '='.repeat(80))
    console.log('🚀 NEXT STEPS:\n')
    console.log('1. Copy the CORRECT webhook URL from above')
    console.log('2. Go to UltraMsg dashboard: https://api.ultramsg.com/')
    console.log('3. Update webhook URL (remove /v1/ from path)')
    console.log('4. Test by sending a WhatsApp message')
    console.log('5. Check logs: heroku logs --tail | grep ULTRAMSG')
    console.log('')

  } catch (error) {
    console.error('❌ Error:', error)
    process.exit(1)
  } finally {
    await prisma.$disconnect()
  }
}

debugUltraMsgWebhook()
