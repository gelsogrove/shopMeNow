/**
 * Check admin user in database
 * Usage: npx ts-node scripts/check-admin.ts
 */

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

async function checkAdmin() {
  try {
    console.log("🔍 Checking admin user...")

    // Find user by email
    const user = await prisma.user.findUnique({
      where: { email: "admin@shopme.com" },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        passwordHash: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!user) {
      console.log("❌ User NOT FOUND in database!")
      console.log("🔧 Run: npm run seed")
      return
    }

    console.log("✅ User found in database:")
    console.log(`   ID: ${user.id}`)
    console.log(`   Email: ${user.email}`)
    console.log(`   Name: ${user.firstName} ${user.lastName}`)
    console.log(`   Role: ${user.role}`)
    console.log(`   Status: ${user.status}`)
    console.log(`   Created: ${user.createdAt}`)
    console.log(`   Updated: ${user.updatedAt}`)
    console.log(`   Password Hash: ${user.passwordHash.substring(0, 20)}...`)

    // Check all users in database
    const allUsers = await prisma.user.findMany({
      select: {
        email: true,
        role: true,
        status: true,
      },
    })

    console.log(`\n📊 Total users in database: ${allUsers.length}`)
    allUsers.forEach((u) => {
      console.log(`   - ${u.email} (${u.role}, ${u.status})`)
    })
  } catch (error) {
    console.error("❌ Error checking admin:", error)
  } finally {
    await prisma.$disconnect()
  }
}

checkAdmin()
