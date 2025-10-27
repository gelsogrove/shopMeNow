/**
 * 🧪 Hello World Test - Verify Jest Configuration
 *
 * Simple test to verify Jest + TypeScript + Prisma work together
 */

describe("🧪 Hello World", () => {
  it("should pass a basic test", () => {
    expect(1 + 1).toBe(2)
    console.log("✅ Basic test works!")
  })

  it("should be able to require PrismaClient", () => {
    const { PrismaClient } = require("@prisma/client")
    console.log("✅ PrismaClient imported:", typeof PrismaClient)
    expect(typeof PrismaClient).toBe("function")
  })

  it("should be able to create PrismaClient instance", () => {
    const { PrismaClient } = require("@prisma/client")
    const prisma = new PrismaClient()

    // Use stderr to force output
    process.stderr.write(`\n✅ Prisma instance created: ${typeof prisma}\n`)
    process.stderr.write(
      `✅ Prisma keys: ${Object.keys(prisma).slice(0, 50).join(", ")}\n`
    )
    process.stderr.write(`✅ Has workspace?: ${"workspace" in prisma}\n`)
    process.stderr.write(`✅ workspace value: ${(prisma as any).workspace}\n\n`)

    expect(prisma).toBeDefined()

    // Force failure to see what's in prisma
    expect("workspace" in prisma).toBe(true)
  })

  it("should be able to query workspace", async () => {
    const { PrismaClient } = require("@prisma/client")
    const prisma = new PrismaClient()

    console.log("🔍 Attempting to query workspace...")
    // USE WORKSPACES (PLURAL) NOT WORKSPACE!
    const workspace = await prisma.workspace.findFirst()
    console.log("✅ Workspace found:", workspace?.name || "NONE")

    expect(workspace).toBeDefined()
    expect(workspace?.name).toBeDefined()

    await prisma.$disconnect()
  }, 10000)
})
