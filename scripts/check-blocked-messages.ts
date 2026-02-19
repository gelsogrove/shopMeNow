import { prisma } from '@echatbot/database'

async function main() {
    console.log('🔍 Checking blocked messages in ConversationMessage...')

    const blockedMessages = await prisma.whatsAppQueue.findMany({
        where: {
            AND: [
                { skipSecurityCheck: true },
                {
                    OR: [
                        { status: 'error' },
                        { status: 'blocked' },
                        { errorMessage: { contains: 'Security blocked' } }
                    ]
                }
            ]
        },
        select: {
            id: true,
            messageContent: true,
            skipSecurityCheck: true,
            errorMessage: true,
            createdAt: true
        },
        orderBy: {
            createdAt: 'desc'
        },
        take: 10
    })

    if (blockedMessages.length === 0) {
        console.log('✅ No messages found that should have been skipped but were blocked.')
    } else {
        console.log(`❌ Found ${blockedMessages.length} messages that should have been skipped but WERE BLOCKED:`)
        blockedMessages.forEach((msg, i) => {
            console.log(`\n--- Message ${i + 1} ---`)
            console.log(`ID: ${msg.id}`)
            console.log(`Created At: ${msg.createdAt}`)
            console.log(`Skip Security Check: ${msg.skipSecurityCheck}`)
            console.log(`Error Message: ${msg.errorMessage}`)
            console.log(`Content: ${msg.messageContent.substring(0, 100)}...`)
        })
    }
}

main()
    .catch((e) => {
        console.error(e)
        process.exit(1)
    })
    .finally(async () => {
        await prisma.$disconnect()
    })
