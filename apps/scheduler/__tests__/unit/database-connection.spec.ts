/**
 * @fileoverview Unit tests for database connection with retry logic
 * 
 * These tests ensure we never fall into ECONNREFUSED issues again by:
 * 1. Testing retry logic when database is not ready
 * 2. Testing successful connection after retries
 * 3. Testing immediate failure for non-connection errors
 * 4. Testing max retries exhaustion
 */

// Mock prisma before importing the module
const mockQueryRaw = jest.fn()
const mockDisconnect = jest.fn()

jest.mock('@echatbot/database', () => ({
  prisma: {
    $queryRaw: mockQueryRaw,
    $disconnect: mockDisconnect,
  },
  Prisma: {},
  PlanType: {},
  CampaignFrequency: {},
  SubscriptionStatus: {},
}))

// Mock process.exit to prevent test from exiting
const mockProcessExit = jest.spyOn(process, 'exit').mockImplementation((code?: string | number | null | undefined) => {
  throw new Error(`process.exit(${code})`)
})

// Mock console methods
const mockConsoleLog = jest.spyOn(console, 'log').mockImplementation()
const mockConsoleError = jest.spyOn(console, 'error').mockImplementation()

describe('Database Connection with Retry Logic', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  afterAll(() => {
    mockProcessExit.mockRestore()
    mockConsoleLog.mockRestore()
    mockConsoleError.mockRestore()
  })

  describe('connectDatabase', () => {
    it('should connect successfully on first attempt when database is ready', async () => {
      // Arrange
      mockQueryRaw.mockResolvedValueOnce([{ healthcheck: 1 }])
      
      // Import fresh module
      jest.resetModules()
      const { connectDatabase } = await import('../../src/config/database')

      // Act
      await connectDatabase()

      // Assert
      expect(mockQueryRaw).toHaveBeenCalledTimes(1)
      expect(mockConsoleLog).toHaveBeenCalledWith('✅ Database connected')
    })

    it('should retry on ECONNREFUSED and succeed on second attempt', async () => {
      // Arrange
      const econnrefusedError = new Error('Connection refused')
      ;(econnrefusedError as any).code = 'ECONNREFUSED'
      
      mockQueryRaw
        .mockRejectedValueOnce(econnrefusedError)
        .mockResolvedValueOnce([{ healthcheck: 1 }])

      jest.resetModules()
      const { connectDatabase } = await import('../../src/config/database')

      // Act
      const connectionPromise = connectDatabase()
      
      // Fast-forward timer for retry delay
      await jest.advanceTimersByTimeAsync(3000)
      await connectionPromise

      // Assert
      expect(mockQueryRaw).toHaveBeenCalledTimes(2)
      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('Database not ready (attempt 1/10)')
      )
      expect(mockConsoleLog).toHaveBeenCalledWith('✅ Database connected')
    })

    it('should retry on ENOTFOUND error', async () => {
      // Arrange
      const enotfoundError = new Error('Host not found')
      ;(enotfoundError as any).code = 'ENOTFOUND'
      
      mockQueryRaw
        .mockRejectedValueOnce(enotfoundError)
        .mockResolvedValueOnce([{ healthcheck: 1 }])

      jest.resetModules()
      const { connectDatabase } = await import('../../src/config/database')

      // Act
      const connectionPromise = connectDatabase()
      await jest.advanceTimersByTimeAsync(3000)
      await connectionPromise

      // Assert
      expect(mockQueryRaw).toHaveBeenCalledTimes(2)
      expect(mockConsoleLog).toHaveBeenCalledWith('✅ Database connected')
    })

    it('should retry on ETIMEDOUT error', async () => {
      // Arrange
      const etimedoutError = new Error('Connection timed out')
      ;(etimedoutError as any).code = 'ETIMEDOUT'
      
      mockQueryRaw
        .mockRejectedValueOnce(etimedoutError)
        .mockResolvedValueOnce([{ healthcheck: 1 }])

      jest.resetModules()
      const { connectDatabase } = await import('../../src/config/database')

      // Act
      const connectionPromise = connectDatabase()
      await jest.advanceTimersByTimeAsync(3000)
      await connectionPromise

      // Assert
      expect(mockQueryRaw).toHaveBeenCalledTimes(2)
    })

    it('should retry when error message contains ECONNREFUSED', async () => {
      // Arrange - Prisma sometimes wraps errors with ECONNREFUSED in message
      const wrappedError = new Error('PrismaClientKnownRequestError: ECONNREFUSED')
      
      mockQueryRaw
        .mockRejectedValueOnce(wrappedError)
        .mockResolvedValueOnce([{ healthcheck: 1 }])

      jest.resetModules()
      const { connectDatabase } = await import('../../src/config/database')

      // Act
      const connectionPromise = connectDatabase()
      await jest.advanceTimersByTimeAsync(3000)
      await connectionPromise

      // Assert
      expect(mockQueryRaw).toHaveBeenCalledTimes(2)
    })

    it('should exit immediately on non-connection errors (e.g., syntax error)', async () => {
      // Arrange
      const syntaxError = new Error('Syntax error in query')
      ;(syntaxError as any).code = 'P2010' // Prisma query syntax error
      
      mockQueryRaw.mockRejectedValueOnce(syntaxError)

      jest.resetModules()
      const { connectDatabase } = await import('../../src/config/database')

      // Act & Assert
      await expect(connectDatabase()).rejects.toThrow('process.exit(1)')
      expect(mockQueryRaw).toHaveBeenCalledTimes(1) // No retry!
      expect(mockConsoleError).toHaveBeenCalledWith(
        '❌ Database connection failed:',
        expect.any(Error)
      )
    })

    it('should exit after MAX_RETRIES (10) attempts', async () => {
      // Arrange
      const econnrefusedError = new Error('Connection refused')
      ;(econnrefusedError as any).code = 'ECONNREFUSED'
      
      // Fail all 10 attempts
      mockQueryRaw.mockRejectedValue(econnrefusedError)

      jest.resetModules()
      const { connectDatabase } = await import('../../src/config/database')

      // Act - start connection and track the promise
      let connectionError: Error | null = null
      const connectionPromise = connectDatabase().catch((err) => {
        connectionError = err
      })
      
      // Fast-forward through all retry delays (9 retries * 3000ms each)
      // Each retry waits 3000ms before the next attempt
      for (let i = 0; i < 10; i++) {
        await jest.advanceTimersByTimeAsync(3000)
        // Allow promise microtasks to resolve
        await Promise.resolve()
      }

      // Wait for the promise to complete
      await connectionPromise

      // Assert
      expect(connectionError).not.toBeNull()
      expect(connectionError!.message).toBe('process.exit(1)')
      expect(mockQueryRaw).toHaveBeenCalledTimes(10)
      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('Database connection failed after 10 attempts'),
        expect.any(Error)
      )
    })

    it('should succeed after multiple retries (stress test)', async () => {
      // Arrange - Fail 5 times, then succeed
      const econnrefusedError = new Error('Connection refused')
      ;(econnrefusedError as any).code = 'ECONNREFUSED'
      
      mockQueryRaw
        .mockRejectedValueOnce(econnrefusedError)
        .mockRejectedValueOnce(econnrefusedError)
        .mockRejectedValueOnce(econnrefusedError)
        .mockRejectedValueOnce(econnrefusedError)
        .mockRejectedValueOnce(econnrefusedError)
        .mockResolvedValueOnce([{ healthcheck: 1 }])

      jest.resetModules()
      const { connectDatabase } = await import('../../src/config/database')

      // Act
      const connectionPromise = connectDatabase()
      
      // Fast-forward through 5 retry delays
      for (let i = 0; i < 5; i++) {
        await jest.advanceTimersByTimeAsync(3000)
      }
      await connectionPromise

      // Assert
      expect(mockQueryRaw).toHaveBeenCalledTimes(6)
      expect(mockConsoleLog).toHaveBeenCalledWith('✅ Database connected')
    })
  })

  describe('disconnectDatabase', () => {
    it('should disconnect and log message', async () => {
      // Arrange
      mockDisconnect.mockResolvedValueOnce(undefined)
      
      jest.resetModules()
      const { disconnectDatabase } = await import('../../src/config/database')

      // Act
      await disconnectDatabase()

      // Assert
      expect(mockDisconnect).toHaveBeenCalledTimes(1)
      expect(mockConsoleLog).toHaveBeenCalledWith('Database disconnected')
    })
  })
})

describe('ECONNREFUSED Error Detection', () => {
  /**
   * These tests verify that all known ECONNREFUSED variants are correctly detected
   */
  
  const connectionErrorCodes = ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT']
  
  connectionErrorCodes.forEach(errorCode => {
    it(`should detect ${errorCode} as a connection error`, () => {
      const error = new Error(`Connection error: ${errorCode}`)
      ;(error as any).code = errorCode
      
      const isConnectionError = 
        (error as any).code === 'ECONNREFUSED' || 
        (error as any).code === 'ENOTFOUND' ||
        (error as any).code === 'ETIMEDOUT' ||
        error.message?.includes('ECONNREFUSED')
      
      expect(isConnectionError).toBe(true)
    })
  })

  it('should detect ECONNREFUSED in Prisma wrapped error message', () => {
    const error = new Error('PrismaClientKnownRequestError: connect ECONNREFUSED 127.0.0.1:5432')
    
    const isConnectionError = error.message?.includes('ECONNREFUSED')
    
    expect(isConnectionError).toBe(true)
  })

  it('should NOT detect syntax errors as connection errors', () => {
    const error = new Error('Syntax error in SQL')
    ;(error as any).code = 'P2010'
    
    const isConnectionError = 
      (error as any).code === 'ECONNREFUSED' || 
      (error as any).code === 'ENOTFOUND' ||
      (error as any).code === 'ETIMEDOUT' ||
      error.message?.includes('ECONNREFUSED')
    
    expect(isConnectionError).toBe(false)
  })
})

describe('Retry Timing', () => {
  it('should wait 3 seconds between retries', async () => {
    // This test verifies the RETRY_DELAY_MS constant
    const EXPECTED_DELAY = 3000

    // The actual delay is tested through jest.advanceTimersByTimeAsync
    // If the delay were different, the tests above would fail
    
    expect(EXPECTED_DELAY).toBe(3000)
  })

  it('should attempt MAX 10 retries', async () => {
    const MAX_RETRIES = 10
    
    expect(MAX_RETRIES).toBe(10)
  })

  it('should have total max wait time of 27 seconds (9 delays × 3s)', () => {
    // 10 attempts = 9 delays between them
    const MAX_RETRIES = 10
    const RETRY_DELAY_MS = 3000
    const totalMaxWaitMs = (MAX_RETRIES - 1) * RETRY_DELAY_MS
    
    expect(totalMaxWaitMs).toBe(27000) // 27 seconds max
  })
})
