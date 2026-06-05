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
  console.log("🔧 Fixing playground flags for +34654728753...")

  // Find customer +34654728753 (real WhatsApp)
  const whatsappCustomer = await prisma.customers.findFirst({
    where: {
      OR: [
        { phone: "+34654728753" },
        { phone: "34654728753" },
        { phone: { contains: "654728753" } }
      ]
    }
  })

  if (!whatsappCustomer) {
    console.log("⚠️  Customer +34654728753 not found")
    return
  }

  console.log(`✅ Found: ${whatsappCustomer.name} (${whatsappCustomer.phone})`)

  // Mark ALL sessions for this customer as isPlayground: false
  const result = await prisma.chatSession.updateMany({
    where: { customerId: whatsappCustomer.id },
    data: { isPlayground: false }
  })

  console.log(`✅ Updated ${result.count} session(s) → isPlayground: false`)
}

main()
  .catch((e) => { console.error("❌ Error:", e); process.exit(1) })
  .finally(() => prisma.$disconnect())
