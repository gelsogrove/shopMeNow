/**
 * Load FAQs into BellItalia workspace
 */

import { prisma } from "@echatbot/database"

// Import FAQ data from seed
const faqs = [
  {
    question: "Cosa ne pensi della politica?",
    answer:
      "Per quanto riguarda la politica, BellItalia si impegna a fornire prodotti di altissima qualità made in Italy e a supportare i produttori locali. Non esprimiamo opinioni politiche, ma ci concentriamo sulla qualità e l'autenticità dei nostri prodotti.",
    keywords: ["politica", "opinione", "impegno", "valori"],
    category: "Azienda",
    order: 1,
  },
  {
    question: "Quali sono i vostri orari di apertura?",
    answer:
      "Il nostro servizio clienti è disponibile dal lunedì al venerdì dalle 9:00 alle 18:00. Gli ordini possono essere effettuati 24/7 attraverso il nostro sistema automatizzato.",
    keywords: ["orari", "apertura", "disponibilità", "assistenza"],
    category: "Servizio Clienti",
    order: 2,
  },
  {
    question: "Quanto tempo richiede la consegna?",
    answer:
      "Le consegne standard richiedono 2-3 giorni lavorativi. Per ordini urgenti, offriamo consegna express entro 24 ore con un supplemento di €15.",
    keywords: ["consegna", "spedizione", "tempo", "urgente"],
    category: "Spedizioni",
    order: 3,
  },
]

async function loadFaqs() {
  console.log("📚 Loading FAQs into BellItalia workspace\n")

  try {
    // Find BellItalia workspace
    const workspace = await prisma.workspace.findFirst({
      where: { name: "BellItalia" },
      select: { id: true, name: true },
    })

    if (!workspace) {
      console.log("❌ BellItalia workspace not found")
      return
    }

    console.log(`✅ Found workspace: ${workspace.name} (${workspace.id})\n`)

    // Delete existing FAQs
    const deleted = await prisma.fAQ.deleteMany({
      where: { workspaceId: workspace.id },
    })
    console.log(`🗑️  Deleted ${deleted.count} existing FAQs\n`)

    // Insert new FAQs
    let count = 0
    for (const faq of faqs) {
      await prisma.fAQ.create({
        data: {
          workspaceId: workspace.id,
          question: faq.question,
          answer: faq.answer,
          keywords: faq.keywords,
          category: faq.category,
          order: faq.order,
          isActive: true,
        },
      })
      count++
      console.log(`✅ Created FAQ ${count}: "${faq.question.substring(0, 50)}..."`)
    }

    console.log(`\n✅ ✅ ✅ Successfully loaded ${count} FAQs into BellItalia workspace!`)
  } catch (error) {
    console.error("\n❌ ERROR:", error.message)
  } finally {
    await prisma.$disconnect()
  }
}

loadFaqs()
