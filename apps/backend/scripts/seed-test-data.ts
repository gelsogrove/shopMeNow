import { prisma } from "@echatbot/database";

async function seed() {
  console.log("🌱 Seeding production data...");

  try {
    // ============================================
    // Update gelsogrove@gmail.com with admin/dev flags
    // ============================================
    const gelsoUser = await prisma.user.findFirst({
      where: { email: "gelsogrove@gmail.com" },
    });

    if (!gelsoUser) {
      throw new Error("❌ User gelsogrove@gmail.com not found!");
    }

    await prisma.user.update({
      where: { id: gelsoUser.id },
      data: { 
        isPlatformAdmin: true,
        isDeveloperUser: true,
        status: "ACTIVE",
      },
    });
    
    console.log("✅ Updated gelsogrove@gmail.com with admin/dev flags");
    console.log("\n✨ Seed completed successfully!");
    console.log("   User can now login without 2FA");
  } catch (error) {
    console.error("❌ Seeding failed:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

seed().catch((e) => {
  console.error(e);
  process.exit(1);
});

