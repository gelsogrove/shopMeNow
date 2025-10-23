/**
 * VIEW PRICING SCRIPT
 *
 * Mostra tutti i prezzi attuali nel database.
 * Lancia con: npm run view-pricing
 */

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function main() {
  console.log("\n💰 CURRENT PRICING CONFIGURATION\n")
  console.log("=".repeat(80))

  // Get all pricing grouped by type
  const pricing = await prisma.pricingConfig.findMany({
    orderBy: [{ type: "asc" }, { key: "asc" }],
  })

  const byType = pricing.reduce(
    (acc, p) => {
      if (!acc[p.type]) acc[p.type] = []
      acc[p.type].push(p)
      return acc
    },
    {} as Record<string, typeof pricing>
  )

  // Display PLANS
  if (byType.PLAN) {
    console.log("\n📋 MONTHLY PLANS")
    console.log("-".repeat(80))
    byType.PLAN.forEach((p) => {
      const status = p.isActive ? "✅" : "❌"
      console.log(
        `${status} ${p.key.padEnd(25)} €${p.value.toString().padEnd(10)} ${p.description || ""}`
      )
    })
  }

  // Display USAGE
  if (byType.USAGE) {
    console.log("\n💳 USAGE-BASED PRICING (Pay-per-use)")
    console.log("-".repeat(80))
    byType.USAGE.forEach((p) => {
      const status = p.isActive ? "✅" : "❌"
      console.log(
        `${status} ${p.key.padEnd(25)} €${p.value.toString().padEnd(10)} ${p.description || ""}`
      )
    })
  }

  // Display THRESHOLDS
  if (byType.THRESHOLD) {
    console.log("\n🎁 FREE TIER THRESHOLDS & LIMITS")
    console.log("-".repeat(80))
    byType.THRESHOLD.forEach((p) => {
      const status = p.isActive ? "✅" : "❌"
      const displayValue = p.value >= 999999 ? "Unlimited" : p.value.toString()
      console.log(
        `${status} ${p.key.padEnd(25)} ${displayValue.padEnd(11)} ${p.description || ""}`
      )
    })
  }

  console.log("\n" + "=".repeat(80))
  console.log(`\n📊 Total configurations: ${pricing.length}`)
  console.log(`   - Active: ${pricing.filter((p) => p.isActive).length}`)
  console.log(`   - Inactive: ${pricing.filter((p) => !p.isActive).length}\n`)
}

main()
  .catch((e) => {
    console.error("❌ Error:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
