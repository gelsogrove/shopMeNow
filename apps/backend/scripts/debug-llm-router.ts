
// 1. SET ENVIRONMENT VARIABLES FIRST (CRITICAL FOR PRISMA)
const PROD_DB_URL = "postgres://ubb9g4o8oki1ru:p325556115fd008cf17ddc9263b4c7e0fe67ddb43d232bd91f9e741f86cb3d1cb@c2lr68lb6hupmq.cluster-czz5s0kz4scl.eu-west-1.rds.amazonaws.com:5432/d4dll4molsnjl";
process.env.DATABASE_URL = PROD_DB_URL;
process.env.NODE_ENV = 'production';

// Disable dotenv for now to avoid overwriting
// import * as dotenv from 'dotenv'
// dotenv.config()

console.log('🌍 ENV SET: DATABASE_URL is pointing to production cluster.')

// 2. NOW IMPORT EVERYTHING ELSE
import { LLMRouterService } from '../src/services/llm-router.service'

// Use require for prisma to ensure it picks up the env we just set
const { prisma } = require('@echatbot/database')

async function debugRouter() {
    console.log('🚀 INITIALIZING LLM ROUTER DEBUGGER...')
    console.log(`🔗 DATABASE_URL: ${process.env.DATABASE_URL?.split('@')[1]}`)

    try {
        // Test connection
        const workspaceCount = await prisma.workspace.count()
        console.log(`📊 Connection test: Found ${workspaceCount} workspaces in DB.`)

        if (workspaceCount === 0) {
            console.error('❌ ZERO workspaces found. Check your DATABASE_URL.')
            return
        }

        // 1. Find valid workspace and customer
        console.log('🔍 FETCHING LIVE DATA FOR TESTING...')
        const workspace = await prisma.workspace.findFirst({
            where: { id: 'echatbot-hq-support', deletedAt: null }
        })

        if (!workspace) {
            console.error('❌ Workspace echatbot-hq-support not found. Listing available:')
            const available = await prisma.workspace.findMany({ take: 5, where: { deletedAt: null } })
            console.log(available.map((w: any) => ({ id: w.id, name: w.name })))
            return
        }

        let customer = await prisma.customers.findFirst({
            where: { workspaceId: workspace.id, deletedAt: null, isActive: true }
        })

        if (!customer) {
            console.warn(`⚠️ No active customer found for workspace ${workspace.id}. Trying any customer...`)
            const anyCustomer = await prisma.customers.findFirst({
                where: { workspaceId: workspace.id, deletedAt: null }
            })
            if (!anyCustomer) {
                console.error(`❌ No customer found for workspace ${workspace.id}`)
                return
            }
            console.log(`🔧 Activating customer ${anyCustomer.id} for testing...`)
            await prisma.customers.update({
                where: { id: anyCustomer.id },
                data: { isActive: true }
            })
            customer = anyCustomer;
        }

        console.log(`✅ TEST DATA FOUND:`)
        console.log(`   - Workspace: ${workspace.id} (${workspace.name})`)
        console.log(`   - Customer: ${customer.id} (${customer.name})`)

        const router = new LLMRouterService(prisma)

        const messages = [
            "voglio vedere il mio profilo",
            "Chi sei?",
            "Mostrami i miei dati"
        ]

        for (const msg of messages) {
            console.log('\n' + '━'.repeat(80))
            console.log(`💬 TESTING MESSAGE: "${msg}"`)
            console.log('━'.repeat(80))

            try {
                const result = await router.routeMessage({
                    workspaceId: workspace.id,
                    customerId: customer.id,
                    conversationId: `debug-conv-${Date.now()}`,
                    messageId: `debug-msg-${Date.now()}`,
                    message: msg
                })

                console.log("\n✅ FINAL RESPONSE:")
                console.log(result.response)
                console.log("\n📊 METRICS:")
                console.log(`- Agent Used: ${result.agentUsed}`)
                console.log(`- Tokens: ${result.tokensUsed}`)
                console.log(`- Execution Time: ${result.executionTimeMs}ms`)

                if (result.debugInfo) {
                    console.log("\n🧪 DEBUG CHAIN:")
                    result.debugInfo.steps.forEach((step: any, i: number) => {
                        const outputStr = JSON.stringify(step.output || {}).substring(0, 150)
                        console.log(`  [${i + 1}] ${step.agent} -> ${outputStr}...`)
                    })
                }
            } catch (error) {
                console.error("❌ ROUTING ERROR:", error)
            }
        }
    } catch (err) {
        console.error("💥 CRITICAL DEBUGGER ERROR:", err)
    } finally {
        await prisma.$disconnect()
        console.log('\n🏁 DEBUG COMPLETED')
    }
}

debugRouter().catch(console.error)
