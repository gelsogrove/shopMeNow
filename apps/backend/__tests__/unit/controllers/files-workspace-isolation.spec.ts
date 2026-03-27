/**
 * Files Controller - Workspace Isolation Tests (BUG#13)
 *
 * VULNERABILITY: The private file endpoint had NO workspace isolation check.
 * Any authenticated user with a valid JWT could download private files from
 * ANY workspace by knowing (or brute-forcing) the folder/filename path.
 * The code even had a TODO comment explicitly acknowledging this:
 *   // TODO: Add workspace isolation check
 *
 * FIX: Files are stored under a folder that STARTS WITH the workspaceId
 *   e.g. /private/<workspaceId>/invoices/INV-001.pdf
 * The controller now verifies:  folder.startsWith(workspaceId)
 * If not, 403 is returned before the file is served.
 */

import { Request, Response } from 'express'
import path from 'path'
import fs from 'fs'
import { FilesController } from '../../../../src/interfaces/http/controllers/files.controller'

// Mock fs and path so we don't need real files on disk
jest.mock('fs')
jest.mock('path', () => {
  const real = jest.requireActual('path')
  return {
    ...real,
    join: (...args: string[]) => args.join('/'),
    normalize: (p: string) => p,
    extname: real.extname,
  }
})

const mockFs = fs as jest.Mocked<typeof fs>

function makeReq(overrides: Partial<{ workspaceId: string; category: string; folder: string; filename: string }>): Partial<Request> {
  const { workspaceId = 'ws-abc', category = 'private', folder = 'ws-abc', filename = 'invoice.pdf' } = overrides
  return {
    params: { category, folder, filename } as any,
    workspaceId, // injected by middleware
  } as any
}

function makeRes(): Partial<Response> {
  const res: any = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
    end: jest.fn().mockReturnThis(),
    pipe: jest.fn(),
  }
  return res
}

describe('FilesController - Workspace Isolation (BUG#13)', () => {
  let controller: FilesController

  beforeEach(() => {
    jest.clearAllMocks()
    controller = new FilesController()
    // Default: file exists
    mockFs.existsSync = jest.fn().mockReturnValue(true)
    mockFs.statSync = jest.fn().mockReturnValue({ size: 1024 } as any)
    mockFs.createReadStream = jest.fn().mockReturnValue({ pipe: jest.fn() } as any)
  })

  // ── servePrivateFile ──────────────────────────────────────────────────────

  describe('servePrivateFile()', () => {
    it('should return 403 when folder does not start with the requester workspaceId', async () => {
      // SCENARIO: User from workspace-A tries to access a file belonging to workspace-B
      // RULE: folder must start with workspaceId of the authenticated user
      const req = makeReq({ workspaceId: 'ws-ATTACKER', folder: 'ws-VICTIM', filename: 'secret.pdf' })
      const res = makeRes()

      await controller.servePrivateFile(req as Request, res as Response)

      expect((res.status as jest.Mock)).toHaveBeenCalledWith(403)
      expect((res.json as jest.Mock)).toHaveBeenCalledWith(
        expect.objectContaining({ error: 'Forbidden' })
      )
    })

    it('should NOT serve the file when workspace isolation check fails', async () => {
      // RULE: createReadStream / pipe must never be called if isolation fails
      const req = makeReq({ workspaceId: 'ws-ATTACKER', folder: 'ws-VICTIM' })
      const res = makeRes()

      await controller.servePrivateFile(req as Request, res as Response)

      expect(mockFs.createReadStream).not.toHaveBeenCalled()
    })

    it('should allow access when folder starts with the correct workspaceId', async () => {
      // SCENARIO: Legitimate owner accesses their own file
      const req = makeReq({ workspaceId: 'ws-OWNER', folder: 'ws-OWNER', filename: 'my-invoice.pdf' })
      const res = makeRes()

      mockFs.existsSync = jest.fn().mockReturnValue(true)
      const mockStream = { pipe: jest.fn() }
      mockFs.createReadStream = jest.fn().mockReturnValue(mockStream as any)

      await controller.servePrivateFile(req as Request, res as Response)

      // createReadStream called — file is being served
      expect(mockFs.createReadStream).toHaveBeenCalled()
      expect(mockStream.pipe).toHaveBeenCalledWith(res)
    })

    it('should allow access to nested subfolders within the workspace folder', async () => {
      // SCENARIO: File stored in /ws-OWNER/invoices/2024/
      // RULE: folder.startsWith(workspaceId) is satisfied for nested paths too
      const req = makeReq({ workspaceId: 'ws-OWNER', folder: 'ws-OWNER/invoices/2024' })
      const res = makeRes()

      mockFs.existsSync = jest.fn().mockReturnValue(true)
      const mockStream = { pipe: jest.fn() }
      mockFs.createReadStream = jest.fn().mockReturnValue(mockStream as any)

      await controller.servePrivateFile(req as Request, res as Response)

      expect(mockFs.createReadStream).toHaveBeenCalled()
    })

    it('should block access to category other than private', async () => {
      // RULE: category !== 'private' → 403 regardless of workspace
      const req = makeReq({ workspaceId: 'ws-OWN', category: 'public', folder: 'ws-OWN' })
      const res = makeRes()

      await controller.servePrivateFile(req as Request, res as Response)

      expect((res.status as jest.Mock)).toHaveBeenCalledWith(403)
    })
  })

  // ── checkPrivateFile (HEAD) ────────────────────────────────────────────────

  describe('checkPrivateFile()', () => {
    it('should return 403 on HEAD request when workspace isolation check fails', async () => {
      // SCENARIO: Attacker checks file existence for another workspace via HEAD
      // RULE: HEAD endpoint must enforce same workspace isolation as GET
      const req = makeReq({ workspaceId: 'ws-ATTACKER', folder: 'ws-VICTIM' })
      const res = makeRes()

      await controller.checkPrivateFile(req as Request, res as Response)

      expect((res.status as jest.Mock)).toHaveBeenCalledWith(403)
    })

    it('should return 200 on HEAD request when folder is owned by the requester', async () => {
      // SCENARIO: Legitimate HEAD check by file owner
      const req = makeReq({ workspaceId: 'ws-OWN', folder: 'ws-OWN', filename: 'doc.pdf' })
      const res = makeRes()

      mockFs.existsSync = jest.fn().mockReturnValue(true)
      mockFs.statSync = jest.fn().mockReturnValue({ size: 512 } as any)

      await controller.checkPrivateFile(req as Request, res as Response)

      expect((res.status as jest.Mock)).toHaveBeenCalledWith(200)
    })
  })
})
