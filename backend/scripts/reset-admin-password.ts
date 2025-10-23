/**
 * Reset admin password manually
 * Usage: npx ts-node scripts/reset-admin-password.ts
 */

import { PrismaClient } from "@prisma/client"
import * as bcrypt from "bcrypt"

const prisma = new PrismaClient()

async function resetPassword() {
  try {
    console.log("🔧 Resetting admin password...")

    const email = "admin@shopme.com"
    const newPassword = "Venezia44" // Con la V maiuscola come vuoi tu

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 10)

    // Update the user
    const updatedUser = await prisma.user.update({
      where: { email },
      data: { passwordHash: hashedPassword },
    })

    console.log(`✅ Password reset successfully for: ${updatedUser.email}`)
    console.log(`📧 Email: ${email}`)
    console.log(`🔑 New Password: ${newPassword}`)
  } catch (error) {
    console.error("❌ Error resetting password:", error)
  } finally {
    await prisma.$disconnect()
  }
}

resetPassword()
