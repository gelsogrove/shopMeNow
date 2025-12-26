/**
 * Jest Setup File for Scheduler Tests
 * 
 * Mocks @echatbot/database to allow unit tests to run without DATABASE_URL
 * This enables true unit testing without external dependencies
 */

const mockModel = {
  findMany: jest.fn().mockResolvedValue([]),
  findFirst: jest.fn().mockResolvedValue(null),
  findUnique: jest.fn().mockResolvedValue(null),
  create: jest.fn().mockResolvedValue({}),
  update: jest.fn().mockResolvedValue({}),
  upsert: jest.fn().mockResolvedValue({}),
  deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
  delete: jest.fn().mockResolvedValue({}),
}

jest.mock('@echatbot/database', () => ({
  prisma: {
    $transaction: jest.fn(async (fn) => {
      // Execute the function with a mock tx object
      const mockTx = new Proxy(mockModel, {
        get: () => mockModel,
      })
      return fn(mockTx)
    }),
    // Mock all Prisma models with the same interface
    user: mockModel,
    workspace: mockModel,
    conversationMessage: mockModel,
    twoFactorResetToken: mockModel,
    refreshToken: mockModel,
    orderItem: mockModel,
    order: mockModel,
    cart: mockModel,
    customer: mockModel,
    customers: mockModel,
    product: mockModel,
    service: mockModel,
    category: mockModel,
    offer: mockModel,
    auditLog: mockModel,
    jobStatus: mockModel,
    whatsappQueueMessage: mockModel,
    whatsAppQueue: mockModel,
    conversationSession: mockModel,
    chatSession: mockModel,
    registrationAttempts: mockModel,
    userUnsubscribe: mockModel,
    invoice: mockModel,
    transaction: mockModel,
    creditNote: mockModel,
    $disconnect: jest.fn(),
  },
}))

export {}
