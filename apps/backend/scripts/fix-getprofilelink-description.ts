/**
 * fix-getprofilelink-description.ts
 *
 * Updates the getProfileLink function description in the DB for ALL workspaces.
 * Adds explicit negative examples to prevent LLM from calling it for payment questions.
 *
 * Run with:
 *   cd apps/backend && npx ts-node scripts/fix-getprofilelink-description.ts
 */

import { prisma } from "@echatbot/database"

const NEW_DESCRIPTION =
  "🔗 PRIORITY 1 - HIGHEST. Genera link sicuro per accedere/modificare profilo cliente. QUANDO USARE: Cliente vuole: 1) 📦 Modificare indirizzo/email/telefono/nome, 2) 🔔 Gestire notifiche push/newsletter (SUBSCRIBE/UNSUBSCRIBE), 3) 🌐 Cambiare lingua, 4) 👁️ Vedere il proprio profilo, 5) 🗑️ Cancellare il proprio account (DELETE). ESEMPI TRIGGER: 'cambia indirizzo', 'modifica email', 'voglio cambiare lingua', 'disattiva notifiche', 'cancella account', 'voglio vedere il mio profilo', 'non voglio più ricevere messaggi', 'unsubscribe'. Link ha validità 1 ora con token JWT. DOPO chiamata: mostrare SEMPRE [LINK_PROFILE_WITH_TOKEN] token nel response. ❌ NON USARE PER: domande su metodi di pagamento ('come si paga', 'come pago', 'metodi di pagamento', 'how to pay', 'payment methods'), domande su prezzi o costi generali, domande informative su prodotti/servizi - per queste usa le FAQ."

async function fixGetProfileLinkDescription() {
  console.log("🔧 Starting fix-getprofilelink-description migration...")

  try {
    const result = await prisma.workspaceCallingFunction.updateMany({
      where: {
        functionName: "getProfileLink",
      },
      data: {
        description: NEW_DESCRIPTION,
      },
    })

    console.log(`✅ Updated ${result.count} getProfileLink records across all workspaces.`)
  } catch (error) {
    console.error("❌ Migration failed:", error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

fixGetProfileLinkDescription()
  .then(() => {
    console.log("✅ Done.")
    process.exit(0)
  })
  .catch((err) => {
    console.error("❌ Fatal error:", err)
    process.exit(1)
  })
