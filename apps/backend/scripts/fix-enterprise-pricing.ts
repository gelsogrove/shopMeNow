import { prisma } from "@echatbot/database"

async function updateEnterprisePricing() {
  console.log("🔧 Updating ENTERPRISE_MONTHLY pricing to 129€...")

  try {
    // Update PricingConfig table
    const result = await prisma.pricingConfig.update({
      where: { key: "ENTERPRISE_MONTHLY" },
      data: { value: 129, updatedAt: new Date() },
    })

    console.log("✅ Updated PricingConfig:", result)

    // Verify the update
    const verify = await prisma.pricingConfig.findUnique({
      where: { key: "ENTERPRISE_MONTHLY" },
    })

    console.log("🔍 Verification - Current value:", verify)

    if (verify?.value === 129) {
      console.log("✅ SUCCESS: Enterprise price is now 129€")
    } else {
      console.log(`❌ FAILED: Enterprise price is ${verify?.value}€ instead of 129€`)
    }
  } catch (error) {
    console.error("❌ Error updating pricing:", error)
    throw error
  } finally {
    await prisma.$disconnect()
  }
}

updateEnterprisePricing()
