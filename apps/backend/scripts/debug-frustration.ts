/**
 * DEBUG SCRIPT: Verify frustration escalation system
 * Checks if frustrationEscalationInstructions reaches the LLM prompt
 */

import { PrismaClient } from '@prisma/client'
import { PromptRenderService } from '../src/application/services/prompt-render.service'
import { logger } from '../src/utils/logger'

const prisma = new PrismaClient()

async function debugFrustrationEscalation() {
  console.log('\n🔍 DEBUG: Frustration Escalation System\n')

  try {
    // 1. Check database value
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
      },
    })

    if (!workspace) {
      console.error('❌ Workspace eChatbot not found')
      return
    }

    console.log('✅ WORKSPACE DATA:')
    console.log(JSON.stringify(workspace, null, 2))
    console.log()

    // 2. Check if field is populated
    if (!workspace.frustrationEscalationInstructions) {
      console.error('❌ frustrationEscalationInstructions is NULL/EMPTY in database')
      console.log('   This means the frontend save is NOT working correctly')
      return
    }

    console.log('✅ frustrationEscalationInstructions IS POPULATED')
    console.log(`   Length: ${workspace.frustrationEscalationInstructions.length} characters`)
    console.log()

    // 3. Get a customer to test with
    const customer = await prisma.customers.findFirst({
      where: {
        workspaceId: workspace.id,
        deletedAt: null,
      },
    })

    if (!customer) {
      console.error('❌ No customer found for testing')
      return
    }

    console.log(`✅ TEST CUSTOMER: ${customer.name} (${customer.phone})`)
    console.log()

    // 4. Generate prompt for CUSTOMER_SUPPORT agent
    const promptRenderService = new PromptRenderService(prisma)

    console.log('🔧 Generating CUSTOMER_SUPPORT prompt...')
    const prompt = await promptRenderService.renderPrompt('CUSTOMER_SUPPORT', {
      workspaceId: workspace.id,
      customerId: customer.id,
    })

    console.log()
    console.log('✅ GENERATED PROMPT:')
    console.log('━'.repeat(80))
    console.log(prompt.substring(0, 3000)) // First 3000 chars
    console.log('━'.repeat(80))
    console.log()

    // 5. Check if escalation instructions are in the prompt
    if (prompt.includes('CUSTOM ESCALATION TRIGGERS')) {
      console.log('✅ ESCALATION SECTION FOUND in prompt')
      const section = prompt.match(/🚨 CUSTOM ESCALATION TRIGGERS.*?(?=\n##|\n\n\n|$)/s)
      if (section) {
        console.log('\n📋 ESCALATION SECTION:')
        console.log(section[0])
      }
    } else {
      console.error('❌ ESCALATION SECTION NOT FOUND in prompt')
      console.log('   This means {{#if frustrationEscalationInstructions}} conditional failed')
    }

    console.log()

    // 6. Check if contactOperator is in the prompt
    if (prompt.toLowerCase().includes('contactoperator')) {
      console.log('✅ "contactOperator" mentioned in prompt')
    } else {
      console.error('❌ "contactOperator" NOT mentioned in prompt')
    }
  } catch (error) {
    console.error('❌ ERROR:', error)
  } finally {
    await prisma.$disconnect()
  }
}

debugFrustrationEscalation()
