/**
 * Script per aggiornare i messaggi di benvenuto con link YouTube
 *
 * Aggiunge il link YouTube al video tutorial in tutte le lingue:
 * https://www.youtube.com/watch?v=fj5jQG8RyZs
 */

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const NEW_WELCOME_MESSAGES = {
  it: `Benvenuto da Altro Gusto! Sono SofiA, il tuo assistente digitale. Sono qui per aiutarti con:

• Esplorare i nostri prodotti italiani di alta qualità
• Seguire i tuoi ordini
• Rispondere a qualsiasi domanda

Prima di iniziare, ti invito a registrarti per accedere a tutte le funzionalità. I tuoi dati saranno protetti e mai condivisi con terzi.

Cosa posso fare per te oggi? 🇮🇹

🎥 Guarda il video tutorial:
https://www.youtube.com/watch?v=fj5jQG8RyZs`,

  en: `Welcome to Altro Gusto! I'm SofiA, your digital assistant. I'm here to help you with:

• Explore our high-quality Italian products
• Track your orders
• Answer any questions

Before starting, I invite you to register to access all features. Your data will be protected and never shared with third parties.

What can I do for you today? 🇮🇹

🎥 Watch the tutorial video:
https://www.youtube.com/watch?v=fj5jQG8RyZs`,

  es: `¡Bienvenido a Altro Gusto! Soy SofiA, tu asistente digital. Estoy aquí para ayudarte con:

• Explorar nuestros productos italianos de alta calidad
• Seguir tus pedidos
• Responder cualquier pregunta

Antes de comenzar, te invito a registrarte para acceder a todas las funcionalidades. Tus datos estarán protegidos y nunca serán compartidos con terceros.

¿Qué puedo hacer por ti hoy? 🇮🇹

🎥 Mira el video tutorial:
https://www.youtube.com/watch?v=fj5jQG8RyZs`,

  pt: `Bem-vindo ao Altro Gusto! Sou SofiA, sua assistente digital. Estou aqui para ajudá-lo com:

• Explorar nossos produtos italianos de alta qualidade
• Acompanhar seus pedidos
• Responder qualquer pergunta

Antes de começar, convido você a se registrar para acessar todas as funcionalidades. Seus dados serão protegidos e nunca compartilhados com terceiros.

O que posso fazer por você hoje? 🇮🇹

🎥 Assista ao vídeo tutorial:
https://www.youtube.com/watch?v=fj5jQG8RyZs`,

  fr: `Bienvenue chez Altro Gusto! Je suis SofiA, votre assistante numérique. Je suis là pour vous aider avec:

• Explorer nos produits italiens de haute qualité
• Suivre vos commandes
• Répondre à toutes vos questions

Avant de commencer, je vous invite à vous inscrire pour accéder à toutes les fonctionnalités. Vos données seront protégées et jamais partagées avec des tiers.

Que puis-je faire pour vous aujourd'hui? 🇮🇹

🎥 Regardez la vidéo tutoriel:
https://www.youtube.com/watch?v=fj5jQG8RyZs`,

  de: `Willkommen bei Altro Gusto! Ich bin SofiA, Ihre digitale Assistentin. Ich bin hier, um Ihnen zu helfen mit:

• Entdecken Sie unsere hochwertigen italienischen Produkte
• Verfolgen Sie Ihre Bestellungen
• Beantworten Sie alle Fragen

Bevor Sie beginnen, lade ich Sie ein, sich zu registrieren, um auf alle Funktionen zuzugreifen. Ihre Daten werden geschützt und niemals mit Dritten geteilt.

Was kann ich heute für Sie tun? 🇮🇹

🎥 Sehen Sie sich das Tutorial-Video an:
https://www.youtube.com/watch?v=fj5jQG8RyZs`,
}

async function updateWelcomeMessages() {
  try {
    console.log("🔄 Updating welcome messages with YouTube link...")

    // Get all workspaces
    const workspaces = await prisma.workspace.findMany({
      select: {
        id: true,
        name: true,
        welcomeMessages: true,
      },
    })

    console.log(`📊 Found ${workspaces.length} workspace(s)`)

    // Update each workspace
    for (const workspace of workspaces) {
      console.log(
        `\n📝 Updating workspace: ${workspace.name} (${workspace.id})`
      )

      await prisma.workspace.update({
        where: { id: workspace.id },
        data: {
          welcomeMessages: NEW_WELCOME_MESSAGES,
        },
      })

      console.log(`✅ Updated welcome messages for: ${workspace.name}`)
    }

    console.log("\n🎉 All welcome messages updated successfully!")
    console.log("\n📋 New welcome message preview (IT):")
    console.log("─".repeat(60))
    console.log(NEW_WELCOME_MESSAGES.it)
    console.log("─".repeat(60))
  } catch (error) {
    console.error("❌ Error updating welcome messages:", error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run the update
updateWelcomeMessages()
  .then(() => {
    console.log("\n✅ Script completed successfully")
    process.exit(0)
  })
  .catch((error) => {
    console.error("\n❌ Script failed:", error)
    process.exit(1)
  })
