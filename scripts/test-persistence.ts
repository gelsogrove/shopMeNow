import { prisma } from '@echatbot/database'

async function main() {
    const workspaceId = 'test-workspace' // Use a valid ID from your DB if needed
    const customerId = 'test-customer' // Use a valid ID from your DB if needed

    // Try to find a real workspace and customer to avoid FK errors
    const workspace = await prisma.workspace.findFirst({ select: { id: true } })
    const customer = await prisma.customers.findFirst({ select: { id: true } })

    if (!workspace || !customer) {
        console.log('⚠️ Could not find real workspace/customer. Creating test ones...')
        // This might fail if DB has strict constraints, but it's just a test
    }

    const targetWorkspaceId = workspace?.id || '00000000-0000-0000-0000-000000000000'
    const targetCustomerId = customer?.id || '00000000-0000-0000-0000-000000000000'

    console.log(`🚀 Creating test message with skipSecurityCheck: true for workspace ${targetWorkspaceId}`)

    const created = await prisma.whatsAppQueue.create({
        data: {
            workspaceId: targetWorkspaceId,
            customerId: targetCustomerId,
            phoneNumber: '1234567890',
            messageContent: '🔔 *TEST SKIP SECURITY*',
            status: 'pending',
            skipSecurityCheck: true
        }
    })

    console.log(`✅ Created message ID: ${created.id}`)
    console.log(`🔍 Verifying field in DB...`)

    const retrieved = await prisma.whatsAppQueue.findUnique({
        where: { id: created.id }
    })

    console.log(`Retrieved skipSecurityCheck: ${retrieved?.skipSecurityCheck}`)

    if (retrieved?.skipSecurityCheck === true) {
        console.log('🎉 Persistence test PASSED!')
    } else {
        console.log('❌ Persistence test FAILED! skipSecurityCheck is NOT true.')
    }

    // Cleanup
    await prisma.whatsAppQueue.delete({ where: { id: created.id } })
    console.log('🧹 Cleanup done.')
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
