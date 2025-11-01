import { PrismaClient } from "@prisma/client"
import fs from "fs"
import path from "path"

const prisma = new PrismaClient()

// Carica tutti i prompt dai file
const loadPrompt = (filename: string): string => {
  // I prompt sono in /docs/prompts/ (root del progetto, non in backend/)
  const filePath = path.join(__dirname, "../../docs/prompts", filename)
  return fs.readFileSync(filePath, "utf-8")
}

const PROMPTS = {
  ROUTER: loadPrompt("router-agent-NEW.md"),
  PRODUCT_SEARCH: loadPrompt("product-search-agent.md"),
  CART_MANAGEMENT: loadPrompt("cart-management-agent.md"),
  ORDER_TRACKING: loadPrompt("order-tracking-agent.md"),
  CUSTOMER_SUPPORT: loadPrompt("customer-support-agent.md"),
  SAFETY_TRANSLATION: loadPrompt("safety-translation-agent.md"),
}

async function updateAllAgentPrompts() {
  try {
    console.log("🔄 Aggiornamento TUTTI i prompt degli agent...")

    await prisma.$connect()
    console.log("✅ Connesso al database")

    // Trova tutti i workspace
    const workspaces = await prisma.workspace.findMany({
      select: { id: true, name: true },
    })
    console.log(`📋 Trovati ${workspaces.length} workspace`)

    let totalUpdated = 0

    // Per ogni tipo di agent, aggiorna il prompt
    for (const [agentType, prompt] of Object.entries(PROMPTS)) {
      console.log(`\n🔄 Aggiornamento ${agentType}...`)

      const agents = await prisma.agentConfig.findMany({
        where: { type: agentType as any },
        select: { id: true, name: true, workspaceId: true },
      })

      if (agents.length === 0) {
        console.log(`⚠️  Nessun agent di tipo ${agentType} trovato`)
        continue
      }

      console.log(`   Trovati ${agents.length} agent da aggiornare:`)
      agents.forEach((a) => console.log(`   - ${a.name} (${a.workspaceId})`))

      const result = await prisma.agentConfig.updateMany({
        where: { type: agentType as any },
        data: { systemPrompt: prompt },
      })

      console.log(`   ✅ Aggiornati ${result.count} agent`)
      totalUpdated += result.count
    }

    console.log(`\n🎉 COMPLETATO! Aggiornati ${totalUpdated} agent in totale!`)
    console.log("\n📝 Prompts applicati:")
    console.log("   1. Router Agent - FAQ, servizi, offerte, delegation")
    console.log("   2. Product Search Agent - searchProducts, certificazioni")
    console.log(
      "   3. Cart Management Agent - addProduct, resetCart, repeatOrder"
    )
    console.log("   4. Order Tracking Agent - GetLinkOrderByCode, fatture")
    console.log("   5. Customer Support Agent - contactOperator, frustrazione")
    console.log("   6. Safety & Translation Agent - sendAlertEmail, sicurezza")
  } catch (error) {
    console.error("❌ Errore durante aggiornamento:", error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Esegui lo script
updateAllAgentPrompts()
  .then(() => {
    console.log("\n✨ Tutti i prompt sono stati aggiornati nel database!")
    process.exit(0)
  })
  .catch((error) => {
    console.error("\n💥 Errore fatale:", error)
    process.exit(1)
  })
