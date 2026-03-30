/**
 * User Controller - Mass Assignment Prevention (BUG#16)
 *
 * VULNERABILITY: PUT /users/:id passed raw req.body directly to
 * prisma.user.update() with a // @ts-ignore comment, bypassing TypeScript
 * type safety. Any authenticated user could send:
 *   { "isPlatformAdmin": true }
 * and immediately elevate their own or any other user's privileges.
 *
 * FIX: Controller-level allowlist (SAFE_FIELDS) + repository-level guard
 * strips any privilege-escalation fields before the DB call.
 */

import { NextFunction, Request, Response } from 'express'
import { UserController } from '../../../src/interfaces/http/controllers/user.controller'

// Minimal UserService mock — we only care about whether update() is invoked
// and with what data.
const mockUpdate = jest.fn()
const mockUserService = {
  update: mockUpdate,
  getById: jest.fn(),
  getByEmail: jest.fn(),
  create: jest.fn(),
  delete: jest.fn(),
  authenticate: jest.fn(),
}

function makeReq(body: Record<string, unknown>, params: Record<string, string> = { id: 'user-123' }): Partial<Request> {
  return { body, params, user: { id: 'attacker-id' } } as any
}
function makeRes(): Partial<Response> {
  const r: any = {}
  r.status = jest.fn().mockReturnValue(r)
  r.json  = jest.fn().mockReturnValue(r)
  return r
}
const noop: NextFunction = () => {}

describe('UserController.updateUser – Mass Assignment Prevention (BUG#16)', () => {
  let ctrl: UserController

  beforeEach(() => {
    jest.clearAllMocks()
    ctrl = new UserController(mockUserService as any)
  })

  it('should return 403 when body contains isPlatformAdmin', async () => {
    // SCENARIO: Attacker sends { isPlatformAdmin: true } to elevate own privilege
    // RULE: privilege-escalation fields must be rejected with 403 BEFORE touching the DB
    const req = makeReq({ isPlatformAdmin: true, name: 'Alice' })
    const res = makeRes()
    await ctrl.updateUser(req as Request, res as Response, noop)
    expect(res.status).toHaveBeenCalledWith(403)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('should return 403 when body contains isDeveloperUser', async () => {
    // SCENARIO: Attacker sets isDeveloperUser to bypass dev-only features
    const req = makeReq({ isDeveloperUser: true })
    const res = makeRes()
    await ctrl.updateUser(req as Request, res as Response, noop)
    expect(res.status).toHaveBeenCalledWith(403)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('should return 403 when body contains passwordHash', async () => {
    // SCENARIO: Attacker injects a known-plaintext hash to set a known password
    const req = makeReq({ passwordHash: '$2b$10$knownhash' })
    const res = makeRes()
    await ctrl.updateUser(req as Request, res as Response, noop)
    expect(res.status).toHaveBeenCalledWith(403)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('should return 403 when body contains twoFactorEnabled', async () => {
    // SCENARIO: Attacker disables 2FA by setting twoFactorEnabled: false
    const req = makeReq({ twoFactorEnabled: false })
    const res = makeRes()
    await ctrl.updateUser(req as Request, res as Response, noop)
    expect(res.status).toHaveBeenCalledWith(403)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('should return 403 when body contains isVerified', async () => {
    // SCENARIO: Unverified user sets isVerified: true on their own account
    const req = makeReq({ isVerified: true })
    const res = makeRes()
    await ctrl.updateUser(req as Request, res as Response, noop)
    expect(res.status).toHaveBeenCalledWith(403)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('should allow update with safe fields only', async () => {
    // SCENARIO: Legitimate profile name change — no blocked field → allowed
    // RULE: Only name/firstName/lastName/email/phoneNumber/language are passed to service
    const fakeUser = { id: 'user-123', name: 'Alice', email: 'a@example.com' }
    mockUpdate.mockResolvedValue(fakeUser)
    const req = makeReq({ name: 'Alice', language: 'en' })
    const res = makeRes()
    await ctrl.updateUser(req as Request, res as Response, noop)
    expect(mockUpdate).toHaveBeenCalledWith('user-123', { name: 'Alice', language: 'en' })
    expect(res.status).not.toHaveBeenCalledWith(403)
  })

  it('should strip unknown extra fields and only forward allowlisted ones', async () => {
    // SCENARIO: Client sends extra fields not in the allowlist (e.g. createdAt)
    // RULE: Only allowlisted keys should reach userService.update()
    const fakeUser = { id: 'user-123', name: 'Bob', email: 'b@example.com' }
    mockUpdate.mockResolvedValue(fakeUser)
    const req = makeReq({ name: 'Bob', createdAt: '2020-01-01', someRandom: 'value' })
    const res = makeRes()
    await ctrl.updateUser(req as Request, res as Response, noop)
    const callArg = mockUpdate.mock.calls[0][1]
    expect(callArg).toEqual({ name: 'Bob' }) // only safe field forwarded
    expect(callArg).not.toHaveProperty('createdAt')
    expect(callArg).not.toHaveProperty('someRandom')
  })
})

// ─── GAP FIX: updateProfile also blocks privilege-escalation fields ───────────
//
// DISCOVERY: BUG#16 fix was applied to updateUser (PUT /users/:id) but the
// PUT /users/profile route called updateProfile which had NO controller-level
// check — only repository defense-in-depth. An attacker could send:
//   { "isPlatformAdmin": true, "firstName": "Alice" }
// The repo would strip it but return 200, giving no 403 to the attacker.
//
// FIX: Same BLOCKED_FIELDS check added to updateProfile at controller level.

describe('UserController.updateProfile – Privilege Escalation via /profile (BUG#16 gap)', () => {
  let ctrl: UserController

  function makeProfileReq(body: Record<string, unknown>): Partial<Request> {
    return {
      body,
      user: { id: 'user-123' },
      file: undefined,
    } as any
  }

  beforeEach(() => {
    jest.clearAllMocks()
    ctrl = new UserController(mockUserService as any)
  })

  it('should return 403 when profile update body contains isPlatformAdmin', async () => {
    // SCENARIO: User attempts privilege escalation via /profile route
    // RULE: Even the /profile route must block privilege-escalation fields with 403
    const req = makeProfileReq({ isPlatformAdmin: true, firstName: 'Alice' })
    const res = makeRes()
    await ctrl.updateProfile(req as Request, res as Response, noop)
    expect(res.status).toHaveBeenCalledWith(403)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('should return 403 when profile update body contains isDeveloperUser', async () => {
    // SCENARIO: User tries to grant themselves developer access via /profile
    const req = makeProfileReq({ isDeveloperUser: true })
    const res = makeRes()
    await ctrl.updateProfile(req as Request, res as Response, noop)
    expect(res.status).toHaveBeenCalledWith(403)
    expect(mockUpdate).not.toHaveBeenCalled()
  })

  it('should return 403 when profile update body contains passwordHash', async () => {
    // SCENARIO: Attacker attempts to set a known-plaintext hash via /profile
    const req = makeProfileReq({ passwordHash: '$2b$10$knownhash' })
    const res = makeRes()
    await ctrl.updateProfile(req as Request, res as Response, noop)
    expect(res.status).toHaveBeenCalledWith(403)
    expect(mockUpdate).not.toHaveBeenCalled()
  })
})
