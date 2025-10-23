/**
 * UPDATE PRICING Script - Automatically syncs database with pricingConfig.ts
 * 
 * 🎯 SINGLE SOURCE OF TRUTH: prisma/data/pricingConfig.ts
 * 
 * Usage:
 * 1. Edit values in prisma/data/pricingConfig.ts
 * 2. Run: npm run update-pricing
 * 3. Database will be updated automatically
 *
 * IMPORTANTE:
 * - I billing records esistenti mantengono il prezzo storico
 * - Solo i NUOVI billing useranno i nuovi prezzi
 */

import { PrismaClient } from "@prisma/client"
import { pricingConfigData } from "../prisma/data/pricingConfig"

const prisma = new PrismaClient()

// ============================================================================
// 🎯 AUTOMATIC: Reads from pricingConfig.ts (SINGLE SOURCE OF TRUTH)
// ============================================================================

// Convert pricingConfigData array to key-value map
const PRICING_FROM_FILE = pricingConfigData.reduce((acc, item) => {
  acc[item.key] = item.value
  return acc
}, {} as Record<string, number>)

// ============================================================================
// 📝 SCRIPT EXECUTION
// ============================================================================

async function main() {
  console.log("💰 Starting pricing update from pricingConfig.ts...\n")
  console.log("📄 Source: prisma/data/pricingConfig.ts (SINGLE SOURCE OF TRUTH)\n")

  const updates = Object.entries(PRICING_FROM_FILE)

  if (updates.length === 0) {
    console.log("⚠️  No pricing configurations found in pricingConfig.ts")
    process.exit(0)
  }

  console.log(`🎯 Found ${updates.length} pricing configurations to sync:\n`)

  let updatedCount = 0
  let unchangedCount = 0
  let errorCount = 0

  for (const [key, newValue] of updates) {
    try {
      // Get current price from database
      const current = await prisma.pricingConfig.findUnique({
        where: { key },
      })

      if (!current) {
        console.log(`⚠️  Pricing key "${key}" not found in database. Skipping.`)
        errorCount++
        continue
      }

      const oldValue = current.value

      // Check if value changed
      if (oldValue === newValue) {
        console.log(`⏭️  ${key}: €${oldValue} (unchanged)`)
        unchangedCount++
        continue
      }

      // Update price
      await prisma.pricingConfig.update({
        where: { key },
        data: { value: newValue as number },
      })

      console.log(`✅ ${key}:`)
      console.log(`   Old: €${oldValue}`)
      console.log(`   New: €${newValue}`)
      console.log(
        `   Change: ${newValue > oldValue ? "+" : ""}€${((newValue as number) - oldValue).toFixed(2)}\n`
      )
      updatedCount++
    } catch (error) {
      console.error(`❌ Failed to update ${key}:`, error)
      errorCount++
    }
  }

  console.log("\n" + "=".repeat(60))
  console.log("✅ Pricing update completed!\n")
  console.log("📊 Summary:")
  console.log(`   - Total configurations: ${updates.length}`)
  console.log(`   - Updated: ${updatedCount}`)
  console.log(`   - Unchanged: ${unchangedCount}`)
  if (errorCount > 0) {
    console.log(`   - Errors: ${errorCount}`)
  }
  console.log(`   - Historical billing: Preserved ✅`)
  console.log(`   - New billing: Will use new prices ✅\n`)
}

main()
  .catch((e) => {
    console.error("❌ Error during pricing update:", e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
