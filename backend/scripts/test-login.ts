/**
 * Test login with credentials
 * Usage: npx ts-node scripts/test-login.ts
 */

import { PrismaClient } from "@prisma/client"
import * as bcrypt from "bcrypt"

const prisma = new PrismaClient()

async function testLogin() {
  try {
    const email = "admin@shopme.com"
    const passwords = ["Venezia44", "venezia44", "Venezia44!", "admin123"]

    console.log(`🔐 Testing login for: ${email}\n`)

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { email },
    })

    if (!user) {
      console.log("❌ User not found!")
      return
    }

    console.log(`✅ User found: ${user.email}`)
    console.log(`   Hash in DB: ${user.passwordHash}\n`)

    // Test each password
    for (const password of passwords) {
      const isMatch = await bcrypt.compare(password, user.passwordHash)
      const icon = isMatch ? "✅" : "❌"
      console.log(
        `${icon} Password "${password}": ${isMatch ? "CORRECT" : "WRONG"}`
      )
    }
  } catch (error) {
    console.error("❌ Error:", error)
  } finally {
    await prisma.$disconnect()
  }
}

testLogin()
