const { PrismaClient } = require("@prisma/client")
const bcrypt = require("bcrypt")

const prisma = new PrismaClient()

async function resetAdminPassword() {
  try {
    const newPassword = "venezia44"
    const hashedPassword = await bcrypt.hash(newPassword, 10)

    const admin = await prisma.user.findUnique({
      where: { email: "admin@shopme.com" },
    })

    if (!admin) {
      console.log("❌ Admin user not found!")
      return
    }

    await prisma.user.update({
      where: { email: "admin@shopme.com" },
      data: { passwordHash: hashedPassword },
    })

    console.log("✅ Admin password reset successfully!")
    console.log("📧 Email: admin@shopme.com")
    console.log("🔑 Password: venezia44")
  } catch (error) {
    console.error("❌ Error resetting password:", error)
  } finally {
    await prisma.$disconnect()
  }
}

resetAdminPassword()
