require("dotenv").config()

global.console = {
  ...console,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}

jest.mock("./src/utils/logger", () => ({
  default: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
}))

jest.setTimeout(10000)

// Global teardown to close Prisma connections and prevent Jest hang
afterAll(async () => {
  try {
    // Try to disconnect Prisma
    const { prisma } = require('@echatbot/database')
    if (prisma && typeof prisma.$disconnect === 'function') {
      await prisma.$disconnect()
    }
  } catch (error) {
    // Prisma might not be loaded, that's OK
  }
  
  // Give pending promises a chance to resolve
  await new Promise(resolve => setTimeout(resolve, 100))
}, 1000)
