import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function checkCustomer() {
  try {
    const customer = await prisma.customers.findFirst({
      where: {
        phone: "+393331234567",
      },
      select: {
        id: true,
        name: true,
        phone: true,
        workspaceId: true,
        language: true,
      },
    })

    console.log("Customer:", customer)

    if (!customer) {
      console.log("\n❌ Customer NOT found with phone +393331234567")
      console.log("\nSearching for any customer...")

      const anyCustomer = await prisma.customers.findFirst({
        select: {
          id: true,
          name: true,
          phone: true,
          workspaceId: true,
        },
      })

      console.log("First customer found:", anyCustomer)
    }
  } catch (error) {
    console.error("Error:", error)
  } finally {
    await prisma.$disconnect()
  }
}

checkCustomer()
