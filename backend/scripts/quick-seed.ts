import { PrismaClient } from "@prisma/client"
import * as bcrypt from "bcrypt"
import { defaultAgents } from "../prisma/data/defaultAgents"

const prisma = new PrismaClient()

async function quickSeed() {
  try {
    console.log("🚀 Quick Seed - Creazione dati essenziali...")

    // 1. Crea Admin User
    const adminExists = await prisma.user.findUnique({
      where: { email: "admin@shopme.com" },
    })

    let adminUser
    if (adminExists) {
      console.log("✅ Admin user già esistente")
      adminUser = adminExists
    } else {
      const hashedPassword = await bcrypt.hash("venezia44", 10)
      adminUser = await prisma.user.create({
        data: {
          email: "admin@shopme.com",
          passwordHash: hashedPassword,
          firstName: "Admin",
          lastName: "User",
          role: "ADMIN",
        },
      })
      console.log("✅ Admin user creato")
    }

    // 2. Crea Workspace (senza messaggi multilingua problematici)
    let workspace = await prisma.workspace.findFirst({
      where: { slug: "altro-gusto" },
    })

    if (!workspace) {
      workspace = await prisma.workspace.create({
        data: {
          name: "Altro Gusto",
          slug: "altro-gusto",
          whatsappPhoneNumber: "+34654728753",
          notificationEmail: "info@altrogusto.com",
          isActive: true,
          language: "ENG",
          currency: "EUR",
          businessType: "ECOMMERCE",
          description: "Italian Gourmet Food E-commerce",
          url: "https://altrogusto.com",
          debugMode: true,
          // Messaggi semplici (String, non Object)
          welcomeMessage:
            "👋 Welcome to Altro Gusto! I'm SofiA, your virtual assistant.",
          wipMessage: "⏳ We're working on your request...",
        },
      })
      console.log(`✅ Workspace creato: ${workspace.name}`)
    } else {
      console.log(`✅ Workspace già esistente: ${workspace.name}`)
    }

    // 3. Associa Admin a Workspace
    const userWorkspaceExists = await prisma.userWorkspace.findFirst({
      where: {
        userId: adminUser.id,
        workspaceId: workspace.id,
      },
    })

    if (!userWorkspaceExists) {
      await prisma.userWorkspace.create({
        data: {
          userId: adminUser.id,
          workspaceId: workspace.id,
          role: "OWNER",
        },
      })
      console.log("✅ Admin associato a workspace")
    }

    // 4. Crea Agent Configs
    console.log("🤖 Creazione agent configs...")

    const agents = defaultAgents(workspace.id)
    for (const agentData of agents) {
      const existingAgent = await prisma.agentConfig.findFirst({
        where: {
          workspaceId: workspace.id,
          type: agentData.type,
        },
      })

      if (!existingAgent) {
        await prisma.agentConfig.create({
          data: agentData,
        })
        console.log(`✅ Agent creato: ${agentData.name} (${agentData.type})`)
      } else {
        console.log(`⏭️ Agent già esistente: ${agentData.name}`)
      }
    }

    console.log("\n🎉 Quick Seed completato con successo!")
    console.log(`📋 Workspace: ${workspace.name} (${workspace.id})`)
    console.log(`👤 Admin: ${adminUser.email}`)
    console.log(`🔐 Password: venezia44`)
  } catch (error) {
    console.error("❌ Errore durante quick seed:", error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

quickSeed()
  .then(() => {
    console.log("\n✨ Database pronto!")
    process.exit(0)
  })
  .catch((error) => {
    console.error("\n💥 Errore fatale:", error)
    process.exit(1)
  })
