import { config } from "dotenv"
config()

import { PrismaClient } from "@echatbot/database"
import { PrismaPg } from "@prisma/adapter-pg"
import { Pool } from "pg"

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('heroku') || process.env.DATABASE_URL?.includes('amazonaws')
    ? { rejectUnauthorized: false }
    : false
})

const adapter = new PrismaPg(pool)
const prisma = new PrismaClient({ adapter })

async function main() {
  console.log("🔧 Fixing playground chat sessions...")

  // Find English customer (John Smith) in bellitalia-vip-ecommerce workspace
  const englishCustomers = await prisma.customers.findMany({
    where: {
      workspaceId: "bellitalia-vip-ecommerce",
      language: { in: ["ENG", "en"] },
    },
  })

  if (!englishCustomers.length) {
    console.log("⚠️  No English customers found in bellitalia-vip-ecommerce")
    return
  }

  for (const customer of englishCustomers) {
    console.log(`   Found customer: ${customer.name} (${customer.language})`)

    const result = await prisma.chatSession.updateMany({
      where: {
        customerId: customer.id,
        workspaceId: "bellitalia-vip-ecommerce",
        isPlayground: false,
      },
      data: { isPlayground: true },
    })

    console.log(`   ✅ Updated ${result.count} chat session(s) → isPlayground: true`)
  }

  console.log("✅ Done")
}

main()
  .catch((e) => { console.error("❌ Error:", e); process.exit(1) })
  .finally(() => prisma.$disconnect())
