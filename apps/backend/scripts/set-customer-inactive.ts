/**
 * Script to set a customer as inactive (isActive = false)
 * Usage: npx ts-node scripts/set-customer-inactive.ts <phone>
 */

import { prisma } from "@echatbot/database"

async function setCustomerInactive(phone: string) {
  try {
    const customers = await prisma.customers.findMany({
      where: {
        OR: [
          { phone: phone },
          { phone: `+${phone}` },
        ]
      }
    })

    if (customers.length === 0) {
      console.log(`❌ No customer found with phone: ${phone}`)
      return
    }

    console.log(`📋 Found ${customers.length} customer(s):`)
    for (const customer of customers) {
      console.log(`  - ${customer.name} (${customer.phone}) - isActive: ${customer.isActive}`)
    }

    // Update all matching customers
    const result = await prisma.customers.updateMany({
      where: {
        OR: [
          { phone: phone },
          { phone: `+${phone}` },
        ]
      },
      data: {
        isActive: false
      }
    })

    console.log(`✅ Updated ${result.count} customer(s) to isActive = false`)

    // Verify
    const updated = await prisma.customers.findMany({
      where: {
        OR: [
          { phone: phone },
          { phone: `+${phone}` },
        ]
      }
    })

    console.log(`\n📋 After update:`)
    for (const customer of updated) {
      console.log(`  - ${customer.name} (${customer.phone}) - isActive: ${customer.isActive}`)
    }

  } catch (error) {
    console.error("❌ Error:", error)
  } finally {
    await prisma.$disconnect()
  }
}

const phone = process.argv[2]
if (!phone) {
  console.log("Usage: npx ts-node scripts/set-customer-inactive.ts <phone>")
  process.exit(1)
}

setCustomerInactive(phone)
