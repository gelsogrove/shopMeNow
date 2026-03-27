/**
 * CertificationRepository + TypeRepository - IDOR Prevention Tests (BUG#11)
 *
 * VULNERABILITY: Both update() and delete() accepted a workspaceId parameter
 * but NEVER used it in the Prisma WHERE clause:
 *
 *   // BEFORE (vulnerable):
 *   async update(id, workspaceId, name) {
 *     return this.prisma.certification.update({ where: { id }, data: { name } })
 *   }
 *
 * Any authenticated user could rename or delete certifications/types belonging
 * to a completely different workspace by passing any valid resource ID.
 * This is a classic Insecure Direct Object Reference (IDOR).
 *
 * FIX: Both methods now call findFirst({ where: { id, workspaceId } }) first
 * and throw if the result is null, ensuring ownership before mutation.
 */

import { CertificationRepository } from '../../../src/repositories/certification.repository'
import { TypeRepository } from '../../../src/repositories/type.repository'

// ─────────────────────────────────────────────────
// Prisma mocks
// ─────────────────────────────────────────────────
const mockCertPrisma = {
  certification: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  productCertification: { count: jest.fn() },
}

const mockTypePrisma = {
  type: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  productType: { count: jest.fn() },
}

// ─────────────────────────────────────────────────────────────────────────────
// CertificationRepository - IDOR tests
// ─────────────────────────────────────────────────────────────────────────────

describe('CertificationRepository - IDOR Prevention (BUG#11)', () => {
  let repo: CertificationRepository

  beforeEach(() => {
    jest.clearAllMocks()
    repo = new CertificationRepository(mockCertPrisma as any)
  })

  // ── update() ──────────────────────────────────────────────────────────────

  describe('update()', () => {
    it('should throw when certification does not belong to the given workspace', async () => {
      // SCENARIO: Attacker owns workspace-A but tries to rename a cert from workspace-B
      // RULE: findFirst with { id, workspaceId } must return null → throw before update
      mockCertPrisma.certification.findFirst.mockResolvedValue(null) // not in this workspace

      await expect(
        repo.update('cert-from-workspace-B', 'workspace-A', 'Stolen Name')
      ).rejects.toThrow('Certification not found in workspace')

      // CRITICAL: prisma.certification.update must NOT have been called
      expect(mockCertPrisma.certification.update).not.toHaveBeenCalled()
    })

    it('should succeed when certification belongs to the correct workspace', async () => {
      // SCENARIO: Legitimate owner updates their own certification
      const existing = { id: 'cert-123', workspaceId: 'workspace-A', name: 'Old Name' }
      mockCertPrisma.certification.findFirst.mockResolvedValue(existing)
      mockCertPrisma.certification.update.mockResolvedValue({ ...existing, name: 'New Name' })

      const result = await repo.update('cert-123', 'workspace-A', 'New Name')

      expect(mockCertPrisma.certification.update).toHaveBeenCalledWith({
        where: { id: 'cert-123' },
        data: { name: 'New Name' },
      })
      expect(result).toMatchObject({ name: 'New Name' })
    })

    it('should validate ownership check uses BOTH id AND workspaceId', async () => {
      // RULE: findFirst must be called with { id, workspaceId } — not just { id }
      mockCertPrisma.certification.findFirst.mockResolvedValue(null)

      await expect(
        repo.update('cert-456', 'workspace-X', 'Test')
      ).rejects.toThrow()

      expect(mockCertPrisma.certification.findFirst).toHaveBeenCalledWith({
        where: { id: 'cert-456', workspaceId: 'workspace-X' },
      })
    })
  })

  // ── delete() ──────────────────────────────────────────────────────────────

  describe('delete()', () => {
    it('should throw when certification does not belong to the given workspace', async () => {
      // SCENARIO: Attacker tries to delete a certification from another workspace
      // RULE: Must throw before calling prisma.certification.delete
      mockCertPrisma.certification.findFirst.mockResolvedValue(null)

      await expect(
        repo.delete('cert-from-workspace-B', 'workspace-A')
      ).rejects.toThrow('Certification not found in workspace')

      expect(mockCertPrisma.certification.delete).not.toHaveBeenCalled()
    })

    it('should succeed when certification belongs to the correct workspace', async () => {
      // SCENARIO: Legitimate owner deletes their own certification
      const existing = { id: 'cert-789', workspaceId: 'workspace-A', name: 'To Delete' }
      mockCertPrisma.certification.findFirst.mockResolvedValue(existing)
      mockCertPrisma.certification.delete.mockResolvedValue(existing)

      await expect(repo.delete('cert-789', 'workspace-A')).resolves.not.toThrow()

      expect(mockCertPrisma.certification.delete).toHaveBeenCalledWith({
        where: { id: 'cert-789' },
      })
    })
  })
})

// ─────────────────────────────────────────────────────────────────────────────
// TypeRepository - IDOR tests (same vulnerability, same fix)
// ─────────────────────────────────────────────────────────────────────────────

describe('TypeRepository - IDOR Prevention (BUG#11)', () => {
  let repo: TypeRepository

  beforeEach(() => {
    jest.clearAllMocks()
    repo = new TypeRepository(mockTypePrisma as any)
  })

  describe('update()', () => {
    it('should throw when transport type does not belong to the given workspace', async () => {
      // SCENARIO: Attacker tries to rename a transport type from another workspace
      mockTypePrisma.type.findFirst.mockResolvedValue(null)

      await expect(
        repo.update('type-from-B', 'workspace-A', 'Hijacked Type')
      ).rejects.toThrow('Transport type not found in workspace')

      expect(mockTypePrisma.type.update).not.toHaveBeenCalled()
    })

    it('should succeed when transport type belongs to the correct workspace', async () => {
      const existing = { id: 'type-001', workspaceId: 'workspace-A', name: 'Express' }
      mockTypePrisma.type.findFirst.mockResolvedValue(existing)
      mockTypePrisma.type.update.mockResolvedValue({ ...existing, name: 'Same Day' })

      const result = await repo.update('type-001', 'workspace-A', 'Same Day')

      expect(mockTypePrisma.type.update).toHaveBeenCalledWith({
        where: { id: 'type-001' },
        data: { name: 'Same Day' },
      })
      expect(result).toMatchObject({ name: 'Same Day' })
    })
  })

  describe('delete()', () => {
    it('should throw when transport type does not belong to the given workspace', async () => {
      mockTypePrisma.type.findFirst.mockResolvedValue(null)

      await expect(
        repo.delete('type-from-B', 'workspace-A')
      ).rejects.toThrow('Transport type not found in workspace')

      expect(mockTypePrisma.type.delete).not.toHaveBeenCalled()
    })

    it('should succeed when transport type belongs to the correct workspace', async () => {
      const existing = { id: 'type-999', workspaceId: 'workspace-A', name: 'Standard' }
      mockTypePrisma.type.findFirst.mockResolvedValue(existing)
      mockTypePrisma.type.delete.mockResolvedValue(existing)

      await expect(repo.delete('type-999', 'workspace-A')).resolves.not.toThrow()
      expect(mockTypePrisma.type.delete).toHaveBeenCalled()
    })
  })
})
