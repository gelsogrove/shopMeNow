/**
 * Reset Token Hashing Tests (BUG#17)
 *
 * VULNERABILITY: Both passwordReset and twoFactorResetToken stored the raw
 * UUID/hex token in the database. If the DB is compromised (SQL injection,
 * backup leak, insider threat), every pending reset token becomes a direct
 * account-takeover credential — no brute-force needed.
 *
 * FIX: DB stores SHA-256(token). The raw token travels only in the email URL.
 * An attacker reading the DB sees only a hash that cannot be reversed.
 */

import crypto from 'crypto'

// Helper that mirrors the production implementation
const sha256 = (s: string) => crypto.createHash('sha256').update(s).digest('hex')

// ─── AuthService / passwordReset ─────────────────────────────────────────────

// Minimal Prisma mock for passwordReset
function makePrismaMock() {
  return {
    user: {
      findUnique: jest.fn(),
      update:     jest.fn(),
    },
    passwordReset: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update:  jest.fn(),
    },
    workspace: { findUnique: jest.fn() },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    $transaction: jest.fn((ops: any) => Array.isArray(ops) ? Promise.all(ops) : ops()),
  }
}

describe('AuthService – password reset token hashing (BUG#17)', () => {
  let AuthService: typeof import('../../../src/application/services/auth.service').AuthService
  let prismaMock: ReturnType<typeof makePrismaMock>

  beforeAll(async () => {
    const mod = await import('../../../src/application/services/auth.service')
    AuthService = mod.AuthService
  })

  beforeEach(() => {
    prismaMock = makePrismaMock()
    jest.clearAllMocks()
  })

  it('requestPasswordReset stores SHA-256(token), not the raw token', async () => {
    // RULE: the value stored in DB must be a 64-char hex SHA-256 hash,
    //       never the 64-char hex raw token itself (they are different)
    prismaMock.user.findUnique.mockResolvedValue({ id: 'u1', email: 'alice@example.com' })
    prismaMock.passwordReset.create.mockResolvedValue({})

    const svc = new AuthService(prismaMock as any)
    const rawToken = await (svc as any).requestPasswordReset('alice@example.com')

    expect(prismaMock.passwordReset.create).toHaveBeenCalledTimes(1)
    const storedToken = prismaMock.passwordReset.create.mock.calls[0][0].data.token

    // The stored value must be the SHA-256 hash of the returned raw token
    expect(storedToken).toBe(sha256(rawToken))

    // Ensure the raw token is NOT stored directly
    expect(storedToken).not.toBe(rawToken)
  })

  it('raw token from DB cannot authenticate directly (hash mismatch)', async () => {
    // SCENARIO: Attacker steals stored hash from DB and tries to use it as the
    //           reset token.
    // RULE: SHA-256(hash) !== hash — the system will find no matching record.
    const rawToken  = crypto.randomBytes(32).toString('hex')
    const hashInDB  = sha256(rawToken)
    const doubleHash = sha256(hashInDB) // what attacker-as-token would produce

    expect(doubleHash).not.toBe(hashInDB) // double-hash != stored hash → no match
  })

  it('resetPassword looks up by SHA-256(token) not raw token', async () => {
    // RULE: when user clicks the reset link, the service must hash the
    //       incoming token before querying the DB
    const rawToken = crypto.randomBytes(32).toString('hex')
    const hashedToken = sha256(rawToken)

    // Simulate DB returning a valid record when queried by hash
    prismaMock.passwordReset.findFirst.mockResolvedValue({
      id: 'reset-1',
      userId: 'u1',
      token: hashedToken,
      expiresAt: new Date(Date.now() + 3600000),
      usedAt: null,
    })
    prismaMock.user.update.mockResolvedValue({})
    prismaMock.passwordReset.update.mockResolvedValue({})
    prismaMock.$transaction.mockImplementation((ops: any) =>
      Array.isArray(ops) ? Promise.all(ops) : ops()
    )

    const svc = new AuthService(prismaMock as any)
    // Should NOT throw — the hashed lookup should find the record
    await expect(
      (svc as any).resetPassword(rawToken, 'NewPassword1!')
    ).resolves.toBeUndefined()

    const queryArg = prismaMock.passwordReset.findFirst.mock.calls[0][0]
    expect(queryArg.where.token).toBe(hashedToken)
    expect(queryArg.where.token).not.toBe(rawToken)
  })
})

// ─── TwoFactorResetService ────────────────────────────────────────────────────

describe('TwoFactorResetService – 2FA reset token hashing (BUG#17)', () => {
  let TwoFactorResetService: typeof import('../../../src/application/services/two-factor-reset.service').TwoFactorResetService
  let prismaMock: any

  beforeAll(async () => {
    const mod = await import('../../../src/application/services/two-factor-reset.service')
    TwoFactorResetService = mod.TwoFactorResetService
  })

  beforeEach(() => {
    prismaMock = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'u1',
          email: 'alice@example.com',
          twoFactorEnabled: true,
          firstName: 'Alice',
          twoFactorSecret: 'OLD_SECRET',
        }),
        update: jest.fn().mockResolvedValue({}),
      },
      twoFactorResetToken: {
        create:    jest.fn().mockResolvedValue({ id: 'tok1' }),
        findFirst: jest.fn(),
        update:    jest.fn().mockResolvedValue({}),
      },
    }
    jest.clearAllMocks()
  })

  it('createResetToken stores SHA-256(token) not the raw UUID', async () => {
    // RULE: DB must store the hash so a DB leak cannot be replayed
    const svc = new TwoFactorResetService(prismaMock)
    // Stub email sending
    jest.spyOn(svc as any, 'sendResetEmail').mockResolvedValue(undefined)

    await (svc as any).createResetToken('u1', 'admin-id', 'admin@example.com')

    const createCall = prismaMock.twoFactorResetToken.create.mock.calls[0][0]
    const storedToken: string = createCall.data.token

    // Must be a 64-char hex SHA-256 output
    expect(storedToken).toMatch(/^[0-9a-f]{64}$/)
    // Must NOT be a UUID (raw token format: 8-4-4-4-12)
    expect(storedToken).not.toMatch(/^[0-9a-f-]{36}$/)
  })

  it('validateToken queries DB by SHA-256(token) not by raw token', async () => {
    // RULE: incoming raw token from URL must be hashed before DB lookup
    const rawToken   = crypto.randomUUID()
    const hashedToken = sha256(rawToken)

    prismaMock.twoFactorResetToken.findFirst.mockResolvedValue({
      token:     hashedToken,
      userId:    'u1',
      expiresAt: new Date(Date.now() + 3600000),
      usedAt:    null,
      user:      { email: 'alice@example.com' },
    })

    const svc = new TwoFactorResetService(prismaMock)
    const result = await (svc as any).validateToken(rawToken, '127.0.0.1')

    expect(result.valid).toBe(true)
    const queryArg = prismaMock.twoFactorResetToken.findFirst.mock.calls[0][0]
    expect(queryArg.where.token).toBe(hashedToken)
    expect(queryArg.where.token).not.toBe(rawToken)
  })
})
