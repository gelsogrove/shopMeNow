import { SecurityAgentService } from '../apps/scheduler/src/services/security-agent.service'

async function main() {
    const securityAgent = new SecurityAgentService()

    const testMessages = [
        {
            name: 'Normal Message',
            content: 'Hello, how can I buy a product?',
            expectedBypass: false
        },
        {
            name: 'Operator Notification',
            content: '🔔 *RICHIESTA ASSISTENZA OPERATORE*\n\n⚠️ *ATTENZIONE*: Il cliente *Test* ha richiesto di parlare con un operatore.',
            expectedBypass: true
        }
    ]

    console.log('🧪 Testing SecurityAgent Bypass Logic...')

    for (const test of testMessages) {
        console.log(`\nTesting: ${test.name}`)
        const result = await securityAgent.validateMessage({
            workspaceId: 'test-workspace',
            messageContent: test.content,
            customerId: 'test-customer'
        })

        const wasBypassed = result.reason === 'Skipped (Trusted Operator Notification)'

        if (wasBypassed === test.expectedBypass) {
            console.log(`✅ ${test.name}: PASSED (Bypassed: ${wasBypassed})`)
        } else {
            console.log(`❌ ${test.name}: FAILED (Expected Bypass: ${test.expectedBypass}, Actual: ${wasBypassed})`)
            console.log(`   Reason: ${result.reason}`)
        }
    }
}

main().catch(console.error)
