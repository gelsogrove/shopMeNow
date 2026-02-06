/**
 * TEST SCRIPT: Complete Frustration Escalation System Verification
 * 
 * Verifies:
 * 1. Database has frustrationEscalationInstructions
 * 2. Prompt includes escalation section
 * 3. contactOperator function is available
 * 
 * Run: npx ts-node scripts/test-frustration-system.ts
 */

import { prisma } from '@echatbot/database'
import { PromptRenderService } from '../src/application/services/prompt-render.service'
import { CUSTOMER_SUPPORT_FUNCTIONS } from '../src/config/agent-functions.config'

async function testFrustrationSystem() {
  console.log('\n' + '='.repeat(80))
  console.log('🔍 FRUSTRATION ESCALATION SYSTEM - COMPLETE VERIFICATION')
  console.log('='.repeat(80) + '\n')

  try {
    // ====================================================================
    // TEST 1: Database Check
    // ====================================================================
    console.log('📊 TEST 1: Database Configuration\n')
    
    const workspace = await prisma.workspace.findFirst({
      where: {
        name: { contains: 'eChatbot' },
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        frustrationEscalationInstructions: true,
        hasHumanSupport: true,
        operatorWhatsappNumber: true,
        operatorContactMethod: true,
      },
    })

    if (!workspace) {
      console.error('❌ FAIL: eChatbot workspace NOT FOUND\n')
      return
    }

    console.log(`✅ Workspace: ${workspace.name} (${workspace.id})`)
    console.log(`   hasHumanSupport: ${workspace.hasHumanSupport}`)
    console.log(`   operatorWhatsappNumber: ${workspace.operatorWhatsappNumber || 'NOT SET'}`)
    console.log(`   operatorContactMethod: ${workspace.operatorContactMethod}`)
    
    if (!workspace.frustrationEscalationInstructions) {
      console.error('\n❌ FAIL: frustrationEscalationInstructions is NULL or EMPTY')
      console.log('   → You need to set it in the frontend: Settings → Support → Frustration Triggers')
      console.log('   → Expected content:')
      console.log('      - quando utente chiede di parlare con un operatore')
      console.log('      - quando un utente si lamenta')
      console.log('      - quando dice "non funziona nulla"')
      console.log('      - quando esprime frustrazione\n')
      return
    }

    console.log(`✅ frustrationEscalationInstructions: POPULATED (${workspace.frustrationEscalationInstructions.length} chars)`)
    console.log('\n📋 Content:')
    console.log('─'.repeat(80))
    console.log(workspace.frustrationEscalationInstructions)
    console.log('─'.repeat(80) + '\n')

    // ====================================================================
    // TEST 2: Function Availability Check
    // ====================================================================
    console.log('🔧 TEST 2: Function Availability\n')

    const contactOperatorFunc = CUSTOMER_SUPPORT_FUNCTIONS.find(
      f => f.function.name === 'contactOperator'
    )

    if (!contactOperatorFunc) {
      console.error('❌ FAIL: contactOperator function NOT FOUND in CUSTOMER_SUPPORT_FUNCTIONS')
      console.log('   → Check agent-functions.config.ts\n')
      return
    }

    console.log('✅ contactOperator function is available')
    console.log(`   Description: ${contactOperatorFunc.function.description.substring(0, 100)}...\n`)

    // ====================================================================
    // TEST 3: Prompt Generation Check
    // ====================================================================
    console.log('📝 TEST 3: Prompt Generation\n')

    const customer = await prisma.customers.findFirst({
      where: {
        workspaceId: workspace.id,
        deletedAt: null,
      },
    })

    if (!customer) {
      console.error('❌ FAIL: No customer found for testing')
      console.log('   → Create a test customer first\n')
      return
    }

    console.log(`✅ Test customer: ${customer.name} (${customer.phone})`)

    const promptRenderService = new PromptRenderService(prisma)
    const prompt = await promptRenderService.renderPrompt('CUSTOMER_SUPPORT', {
      workspaceId: workspace.id,
      customerId: customer.id,
    })

    // Check if escalation section is in prompt
    if (!prompt.includes('CUSTOM ESCALATION TRIGGERS')) {
      console.error('\n❌ FAIL: Escalation section NOT FOUND in prompt')
      console.log('   → The {{#if frustrationEscalationInstructions}} conditional failed')
      console.log('   → This means the template engine is not processing it correctly\n')
      
      // Show relevant part of prompt
      console.log('📄 Prompt preview (first 1000 chars):')
      console.log('─'.repeat(80))
      console.log(prompt.substring(0, 1000))
      console.log('─'.repeat(80) + '\n')
      return
    }

    console.log('✅ Escalation section FOUND in prompt')
    
    // Extract and show escalation section
    const escalationMatch = prompt.match(/🚨 CUSTOM ESCALATION TRIGGERS[\s\S]*?(?=\n##|\n\n## )/m)
    if (escalationMatch) {
      console.log('\n📋 Escalation Section in Prompt:')
      console.log('─'.repeat(80))
      console.log(escalationMatch[0])
      console.log('─'.repeat(80) + '\n')
    }

    // Check if contactOperator is mentioned
    if (!prompt.toLowerCase().includes('contactoperator')) {
      console.error('❌ WARNING: "contactOperator" not mentioned in prompt')
      console.log('   → LLM might not know this function exists\n')
    } else {
      console.log('✅ "contactOperator" mentioned in prompt\n')
    }

    // ====================================================================
    // TEST 4: Summary
    // ====================================================================
    console.log('=' + '='.repeat(80))
    console.log('✅ ALL TESTS PASSED - System is ready!')
    console.log('='.repeat(80))
    console.log('\n🧪 NEXT STEP: Test with real message')
    console.log('   1. Send: "Ciao non funziona nulla"')
    console.log('   2. Expected: Bot calls contactOperator()')
    console.log('   3. Expected: WhatsApp notification to ' + workspace.operatorWhatsappNumber)
    console.log('   4. Check backend logs for function call\n')

  } catch (error) {
    console.error('\n❌ ERROR:', error)
  }
}

testFrustrationSystem()
