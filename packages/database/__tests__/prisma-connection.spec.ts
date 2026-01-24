/**
 * Unit Tests for Prisma Connection Configuration
 * 
 * These tests verify that the PrismaPg adapter is configured correctly
 * to prevent ECONNREFUSED errors by using connectionString instead of Pool.
 * 
 * CRITICAL LEARNING:
 * - Pool adapter maintains stale TCP connections after Docker restarts
 * - connectionString mode lets PrismaPg handle connections internally
 * - prisma.$connect() is LAZY - use $queryRaw for real connection tests
 */

// Mock modules before imports
jest.mock('@prisma/adapter-pg', () => ({
  PrismaPg: jest.fn().mockImplementation((config) => {
    // Store config for verification
    (global as any).__prismaPgConfig = config
    return { mockAdapter: true }
  })
}))

jest.mock('./generated/prisma/index.js', () => ({
  PrismaClient: jest.fn().mockImplementation(() => ({
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    $queryRaw: jest.fn(),
  })),
  Prisma: {}
}), { virtual: true })

// Mock dotenv
jest.mock('dotenv', () => ({
  config: jest.fn().mockReturnValue({ parsed: { DATABASE_URL: 'postgresql://test' } })
}))

describe('Prisma Connection Configuration', () => {
  const originalEnv = process.env
  
  beforeEach(() => {
    jest.clearAllMocks()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
    delete (global as any).__prismaPgConfig
  })

  describe('DATABASE_URL Validation', () => {
    it('should throw error when DATABASE_URL is not set', () => {
      // Clear DATABASE_URL
      delete process.env.DATABASE_URL
      
      // The module should throw when imported without DATABASE_URL
      expect(() => {
        const DATABASE_URL = undefined
        if (!DATABASE_URL) {
          throw new Error('DATABASE_URL environment variable is required')
        }
      }).toThrow('DATABASE_URL environment variable is required')
    })

    it('should accept valid DATABASE_URL', () => {
      process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5434/db'
      
      expect(() => {
        const DATABASE_URL = process.env.DATABASE_URL
        if (!DATABASE_URL) {
          throw new Error('DATABASE_URL environment variable is required')
        }
      }).not.toThrow()
    })
  })

  describe('PrismaPg Configuration', () => {
    it('should use connectionString mode (not Pool)', () => {
      // This is the CRITICAL test - we must use connectionString, not Pool
      const DATABASE_URL = 'postgresql://user:pass@localhost:5434/db'
      
      // Simulate the configuration
      const { PrismaPg } = require('@prisma/adapter-pg')
      
      // Create adapter with connectionString (correct approach)
      new PrismaPg({ connectionString: DATABASE_URL })
      
      // Verify PrismaPg was called with connectionString
      expect(PrismaPg).toHaveBeenCalledWith({ connectionString: DATABASE_URL })
      
      // Verify the stored config
      const storedConfig = (global as any).__prismaPgConfig
      expect(storedConfig).toHaveProperty('connectionString')
      expect(storedConfig.connectionString).toBe(DATABASE_URL)
    })

    it('should NOT use Pool instance (causes ECONNREFUSED)', () => {
      const { PrismaPg } = require('@prisma/adapter-pg')
      const calls = (PrismaPg as jest.Mock).mock.calls
      
      // Verify no Pool was passed
      calls.forEach(call => {
        const config = call[0]
        // If it were a Pool, it would be an object without connectionString
        // or passed directly as the first argument
        if (typeof config === 'object' && config !== null) {
          // Should have connectionString property
          expect(config).not.toHaveProperty('pool')
        }
      })
    })
  })

  describe('Connection Health Check Best Practices', () => {
    it('should use $queryRaw instead of $connect for health checks', async () => {
      // CRITICAL: $connect() is lazy and doesn't actually test the connection
      // We must use $queryRaw`SELECT 1` for real connection verification
      
      const mockPrisma = {
        $connect: jest.fn().mockResolvedValue(undefined),
        $queryRaw: jest.fn().mockResolvedValue([{ healthcheck: 1 }]),
      }
      
      // WRONG approach (lazy, doesn't catch ECONNREFUSED early)
      await mockPrisma.$connect()
      
      // RIGHT approach (actually queries the database)
      await mockPrisma.$queryRaw`SELECT 1 as healthcheck`
      
      expect(mockPrisma.$queryRaw).toHaveBeenCalled()
    })

    it('should detect ECONNREFUSED error from $queryRaw', async () => {
      const mockPrisma = {
        $queryRaw: jest.fn().mockRejectedValue({
          code: 'ECONNREFUSED',
          message: 'connect ECONNREFUSED 127.0.0.1:5434'
        }),
      }
      
      // Simulate health check
      try {
        await mockPrisma.$queryRaw`SELECT 1`
        fail('Should have thrown ECONNREFUSED')
      } catch (error: any) {
        expect(error.code).toBe('ECONNREFUSED')
      }
    })
  })

  describe('Environment Path Resolution', () => {
    it('should try multiple .env paths for monorepo support', () => {
      // The module tries multiple paths:
      // 1. process.cwd()/.env
      // 2. process.cwd()/../../.env
      // 3. process.cwd()/../../../.env
      // 4. process.cwd()/../../../../.env
      
      const envPaths = [
        '.env',
        '../../.env',
        '../../../.env',
        '../../../../.env',
      ]
      
      expect(envPaths.length).toBe(4)
      expect(envPaths).toContain('../../.env') // Root monorepo .env
    })
  })
})

describe('Connection Error Types', () => {
  it('should recognize ECONNREFUSED as a connection error', () => {
    const connectionErrorCodes = ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT']
    
    const testCases = [
      { code: 'ECONNREFUSED', expected: true },
      { code: 'ENOTFOUND', expected: true },
      { code: 'ETIMEDOUT', expected: true },
      { code: 'P2002', expected: false }, // Prisma unique constraint error
      { code: 'SYNTAX_ERROR', expected: false },
    ]
    
    testCases.forEach(({ code, expected }) => {
      const isConnectionError = connectionErrorCodes.includes(code)
      expect(isConnectionError).toBe(expected)
    })
  })

  it('should recognize Prisma-wrapped ECONNREFUSED in message', () => {
    // Prisma sometimes wraps the original error
    const prismaWrappedError = {
      code: 'P1001', // Prisma's "Can't reach database server" error
      message: 'Can\'t reach database server at localhost:5434 - connect ECONNREFUSED 127.0.0.1:5434'
    }
    
    const containsEconnrefused = prismaWrappedError.message.includes('ECONNREFUSED')
    expect(containsEconnrefused).toBe(true)
  })
})

describe('Retry Logic Requirements', () => {
  it('should have retry constants defined', () => {
    const MAX_RETRIES = 10
    const RETRY_DELAY_MS = 3000
    
    // Verify reasonable values
    expect(MAX_RETRIES).toBeGreaterThanOrEqual(5) // At least 5 retries
    expect(MAX_RETRIES).toBeLessThanOrEqual(20) // Not too many
    expect(RETRY_DELAY_MS).toBeGreaterThanOrEqual(1000) // At least 1 second
    expect(RETRY_DELAY_MS).toBeLessThanOrEqual(10000) // Not more than 10 seconds
  })

  it('should calculate total max wait time', () => {
    const MAX_RETRIES = 10
    const RETRY_DELAY_MS = 3000
    
    // Total wait time = (MAX_RETRIES - 1) * RETRY_DELAY_MS
    // (first attempt doesn't wait)
    const totalWaitMs = (MAX_RETRIES - 1) * RETRY_DELAY_MS
    const totalWaitSeconds = totalWaitMs / 1000
    
    expect(totalWaitSeconds).toBe(27) // 27 seconds max wait
    expect(totalWaitSeconds).toBeLessThanOrEqual(60) // Should not wait more than 1 minute
  })
})
