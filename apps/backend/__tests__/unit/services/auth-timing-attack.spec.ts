/**
 * Auth Service - Timing Attack Prevention Tests (BUG#10)
 *
 * VULNERABILITY: Skipping bcrypt.compare when user doesn't exist makes the
 * server respond ~100ms faster for unknown emails than for known emails with
 * wrong passwords.  An attacker can distinguish the two cases and enumerate
 * valid accounts by measuring response times.
 *
 * FIX: Always call bcrypt.compare against a pre-computed dummy hash so the
 * CPU-bound work is performed regardless of whether the user was found.
 */

import { AuthService } from '../../../src/application/services/auth.service'
import { AppError } from '../../../src/interfaces/http/middlewares/error.middleware'
import bcrypt from 'bcryptjs'

// Mock bcrypt so we can spy on compare without real CPU cost in tests
jest.mock('bcryptjs', () => ({
  compare: jest.fn(),
  hash: jest.fn().mockResolvedValue('$2b$10$hashedpassword'),
}))

const mockCompare = bcrypt.compare as jest.Mock

// Minimal Prisma mock
const mockPrisma = {
  user: {
    findUnique: jest.fn(),
    create: jest.fn(),
  },
}

describe('AuthService - Timing Attack Prevention (BUG#10)', () => {
  let authService: AuthService

  beforeEach(() => {
    jest.clearAllMocks()
    authService = new AuthService(mockPrisma as any)
  })

  // ─────────────────────────────────────────────────────────────────────────
  // CONSTANT-TIME BEHAVIOUR
  // ─────────────────────────────────────────────────────────────────────────

  it('should call bcrypt.compare even when user does not exist (prevents timing leak)', async () => {
    // SCENARIO: Attacker probes with a non-existent email
    // RULE: bcrypt.compare MUST run to consume the same CPU time as a real
    //       "wrong password" attempt → no timing difference to exploit
    mockPrisma.user.findUnique.mockResolvedValue(null)
    mockCompare.mockResolvedValue(false) // dummy compare always returns false

    await expect(
      authService.login('ghost@attacker.com', 'whatever')
    ).rejects.toThrow(AppError)

    // CRITICAL: bcrypt.compare must have been invoked
    expect(mockCompare).toHaveBeenCalledTimes(1)
  })

  it('should call bcrypt.compare with the dummy hash when user does not exist', async () => {
    // SCENARIO: Verify that the second argument to compare is a valid bcrypt hash
    // RULE: Must be a well-formed bcrypt string, NOT the raw incoming password
    mockPrisma.user.findUnique.mockResolvedValue(null)
    mockCompare.mockResolvedValue(false)

    await expect(
      authService.login('nobody@example.com', 'p4ssw0rd')
    ).rejects.toThrow()

    const [plainTextArg, hashArg] = mockCompare.mock.calls[0]
    expect(plainTextArg).toBe('p4ssw0rd')          // first arg = attacker's password
    expect(hashArg).toMatch(/^\$2[ab]\$\d{2}\$/)   // second arg = bcrypt format
  })

  it('should throw 401 Invalid credentials for non-existent user', async () => {
    // RULE: Error message must NOT reveal whether the email exists
    mockPrisma.user.findUnique.mockResolvedValue(null)
    mockCompare.mockResolvedValue(false)

    const err = await authService.login('nobody@example.com', 'pass').catch(e => e)
    expect(err).toBeInstanceOf(AppError)
    expect(err.statusCode).toBe(401)
    expect(err.message).toBe('Invalid credentials')
  })

  it('should throw 401 Invalid credentials for wrong password on existing user', async () => {
    // RULE: Error message must be IDENTICAL to the "user not found" case
    //       so that attackers cannot distinguish via message text either
    const existingUser = {
      id: 'user-abc',
      email: 'real@example.com',
      passwordHash: '$2b$10$realhashere',
      status: 'ACTIVE',
      deletedAt: null,
      twoFactorEnabled: false,
      isPlatformAdmin: false,
      isDeveloperUser: false,
    }
    mockPrisma.user.findUnique.mockResolvedValue(existingUser)
    mockCompare.mockResolvedValue(false) // wrong password

    const err = await authService.login('real@example.com', 'wrongpass').catch(e => e)
    expect(err).toBeInstanceOf(AppError)
    expect(err.statusCode).toBe(401)
    expect(err.message).toBe('Invalid credentials') // same as user-not-found case
  })

  // ─────────────────────────────────────────────────────────────────────────
  // REGRESSION: HAPPY PATH STILL WORKS
  // ─────────────────────────────────────────────────────────────────────────

  it('should return user + token when credentials are valid', async () => {
    // SCENARIO: Legitimate login
    // RULE: The constant-time fix must not break successful logins
    const existingUser = {
      id: 'user-xyz',
      email: 'alice@example.com',
      passwordHash: '$2b$10$realhash',
      status: 'ACTIVE',
      deletedAt: null,
      twoFactorEnabled: false,
      isPlatformAdmin: false,
      isDeveloperUser: false,
      role: 'MEMBER',
    }
    mockPrisma.user.findUnique.mockResolvedValue(existingUser)
    mockCompare.mockResolvedValue(true) // correct password

    const result = await authService.login('alice@example.com', 'correctpass')
    expect(result.user).toBe(existingUser)
    expect(result.token).toBeTruthy()
    expect(result.requires2FA).toBe(false)
    // compare called ONCE against the real hash, NOT the dummy
    expect(mockCompare).toHaveBeenCalledTimes(1)
    expect(mockCompare).toHaveBeenCalledWith('correctpass', existingUser.passwordHash)
  })

  it('should NOT call bcrypt.compare twice for an existing user (no double work)', async () => {
    // RULE: The extra compare is only for missing users — real users must still
    //       compare only once (against their real hash)
    const existingUser = {
      id: 'user-xyz',
      email: 'alice@example.com',
      passwordHash: '$2b$10$realhash',
      status: 'ACTIVE',
      deletedAt: null,
      twoFactorEnabled: false,
      isPlatformAdmin: false,
      isDeveloperUser: false,
      role: 'MEMBER',
    }
    mockPrisma.user.findUnique.mockResolvedValue(existingUser)
    mockCompare.mockResolvedValue(true)

    await authService.login('alice@example.com', 'correctpass')

    expect(mockCompare).toHaveBeenCalledTimes(1)
  })
})
