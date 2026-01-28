/**
 * Migration Script: Update Existing Customers Language Based on Phone Prefix
 * 
 * PROBLEM: Old customers have language="ENG" (old default)
 * SOLUTION: Detect language from phone prefix and update DB
 * 
 * Usage:
 * npx ts-node scripts/migrate-customer-languages.ts
 */

import { PrismaClient } from "@echatbot/database"
import { detectLanguageFromPhonePrefix } from "../src/utils/language-detector"

const prisma = new PrismaClient()

async function migrateCustomerLanguages() {
  console.log("🚀 Starting customer language migration...")

  try {
    // 1. Find all customers with language="ENG" (old default)
    const customersToUpdate = await prisma.customers.findMany({
      where: {
        language: "ENG",
        phone: { not: null },
      },
      select: {
        id: true,
        phone: true,
        name: true,
        workspaceId: true,
        language: true,
      },
    })

    console.log(`📊 Found ${customersToUpdate.length} customers with language="ENG"`)

    if (customersToUpdate.length === 0) {
      console.log("✅ No customers to update. Migration complete.")
      return
    }

    // 2. Update each customer with detected language
    let successCount = 0
    let skipCount = 0
    let errorCount = 0

    for (const customer of customersToUpdate) {
      try {
        if (!customer.phone) {
          console.log(`⚠️  Skipping customer ${customer.id} - no phone number`)
          skipCount++
          continue
        }

        // Detect language from phone prefix
        const detectedLanguage = detectLanguageFromPhonePrefix(customer.phone)

        // Only update if different from current
        if (detectedLanguage === customer.language) {
          console.log(
            `⏩ Skipping customer ${customer.id} - already has correct language: ${detectedLanguage}`
          )
          skipCount++
          continue
        }

        // Update customer language
        await prisma.customers.update({
          where: { id: customer.id },
          data: { language: detectedLanguage },
        })

        console.log(
          `✅ Updated customer ${customer.id} (${customer.name}) - ${customer.phone}: ENG → ${detectedLanguage}`
        )
        successCount++
      } catch (error) {
        console.error(`❌ Failed to update customer ${customer.id}:`, error)
        errorCount++
      }
    }

    // 3. Summary
    console.log("\n📊 Migration Summary:")
    console.log(`   ✅ Updated: ${successCount}`)
    console.log(`   ⏩ Skipped: ${skipCount}`)
    console.log(`   ❌ Errors: ${errorCount}`)
    console.log(`   📋 Total processed: ${customersToUpdate.length}`)
    console.log("\n🎉 Migration complete!")
  } catch (error) {
    console.error("❌ Migration failed:", error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

// Run migration
migrateCustomerLanguages()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error)
    process.exit(1)
  })
