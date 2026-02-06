/**
 * CRITICAL FIX: Update eChatbot workspace with frustration escalation instructions
 * 
 * This script updates the frustrationEscalationInstructions field for eChatbot workspace
 * to enable custom escalation triggers as configured in the frontend.
 * 
 * Run: npx ts-node scripts/fix-echatbot-escalation.ts
 */

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function fixEchatbotEscalation() {
  console.log('\n🔧 FIXING eChatbot Frustration Escalation\n')

  try {
    // Find eChatbot workspace
    const workspace = await prisma.workspace.findFirst({
      where: {
        name: { contains: 'eChatbot' },
        deletedAt: null,
      },
    })

    if (!workspace) {
      console.error('❌ eChatbot workspace NOT FOUND')
      return
    }

    console.log(`✅ Found workspace: ${workspace.name} (${workspace.id})`)
    console.log()

    // BEFORE
    console.log('📋 BEFORE UPDATE:')
    console.log(`   hasHumanSupport: ${workspace.hasHumanSupport}`)
    console.log(`   operatorWhatsappNumber: ${workspace.operatorWhatsappNumber}`)
    console.log(`   frustrationEscalationInstructions: ${workspace.frustrationEscalationInstructions ? `"${workspace.frustrationEscalationInstructions.substring(0, 100)}..."` : 'NULL'}`)
    console.log()

    // UPDATE with the correct escalation instructions from seed
    const escalationInstructions = `Chiama l'operatore (contactOperator) quando il cliente:
- Ha URGENZA di informazioni che non trovi nella knowledge base
- È FRUSTRATO perché non riesce a trovare le informazioni richieste
- Chiede ESPLICITAMENTE di parlare con un OPERATORE UMANO
- Ha una SITUAZIONE COMPLESSA che richiede assistenza personalizzata
- Si lamenta o dice che "non funziona nulla"
- Esprime insoddisfazione con il servizio

⚠️ IMPORTANTE: Prima verifica SEMPRE se la risposta è nelle FAQ o nella knowledge base`

    const updated = await prisma.workspace.update({
      where: { id: workspace.id },
      data: {
        frustrationEscalationInstructions: escalationInstructions,
        hasHumanSupport: true,
        operatorWhatsappNumber: workspace.operatorWhatsappNumber || '+34654728753', // Fallback to Andrea's number
      },
    })

    // AFTER
    console.log('✅ AFTER UPDATE:')
    console.log(`   hasHumanSupport: ${updated.hasHumanSupport}`)
    console.log(`   operatorWhatsappNumber: ${updated.operatorWhatsappNumber}`)
    console.log(`   frustrationEscalationInstructions length: ${updated.frustrationEscalationInstructions?.length || 0} characters`)
    console.log()
    console.log('📝 Escalation Instructions:')
    console.log(updated.frustrationEscalationInstructions)
    console.log()
    console.log('✅ SUCCESS: Escalation instructions updated')
    console.log()
    console.log('🔧 NEXT STEPS:')
    console.log('   1. Test by sending: "Ciao non funziona nulla"')
    console.log('   2. Expected: Bot should call contactOperator()')
    console.log('   3. Expected: WhatsApp notification sent to +34654728753')
  } catch (error) {
    console.error('❌ ERROR:', error)
  } finally {
    await prisma.$disconnect()
  }
}

fixEchatbotEscalation()
