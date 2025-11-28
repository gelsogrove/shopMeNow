import { PrismaClient } from "@prisma/client"

// Create a global instance of Prisma
const globalForPrisma = global as unknown as {
  prisma: PrismaClient | undefined
}

// Check if we already have Prisma instantiated to avoid multiple instances during hot reloads
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient()

// Save the Prisma instance in the global object in non-production environments
if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma
}
