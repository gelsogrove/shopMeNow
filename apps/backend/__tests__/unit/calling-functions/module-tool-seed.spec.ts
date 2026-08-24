/**
 * Seeding a module's built-in tools as editable rows
 *
 * Andrea 2026-08-24. `syncModuleToolRows` turns what a chatbot module declares
 * in its manifest into `WorkspaceCallingFunction` rows, so Settings → Custom
 * Tools can switch each tool off and re-describe it.
 *
 * Two properties matter more than the seeding itself, and both are pinned here:
 *
 * THE DATABASE WINS. Every upsert carries an EMPTY `update`. A description the
 * admin edited must survive every later save of the Settings page — otherwise
 * the edit lasts until the next save and nobody can tell why it reverted.
 *
 * SUPERSEDING IS A ONE-TIME EVENT. `save_push_consent` deactivates the
 * platform's `manageNotifications` so the model is not offered two tools for
 * one job — but only when it is first created. Doing it on every save would
 * make it impossible for an admin to ever switch the platform one back on.
 */

const mockUpsert = jest.fn()
const mockUpdateMany = jest.fn()
const mockFindUnique = jest.fn()
const mockFindFirst = jest.fn()

jest.mock("@echatbot/database", () => ({
  PrismaClient: jest.fn(),
}))

/**
 * Whether the row was already in the table is asked with a findFirst BEFORE
 * the upsert, so that is what these helpers control.
 *
 * An earlier version of this suite mocked an upsert RESULT and let the service
 * infer "just created" from `createdAt === updatedAt`. Both the code and the
 * test agreed and both were wrong: an upsert whose `update` is empty touches
 * nothing, so updatedAt never moves and every row reads as newly created
 * forever. The bug only surfaced against a real database (2026-08-24) — the
 * mock had been asserting the fiction rather than Prisma's behaviour.
 */
const NOT_SEEDED_YET = null
const ALREADY_SEEDED = { id: "row-1" }

describe("syncModuleToolRows", () => {
  let service: any
  const WORKSPACE_ID = "ws-sappada"

  beforeEach(async () => {
    jest.clearAllMocks()
    jest.resetModules()

    mockUpsert.mockResolvedValue({})
    mockUpdateMany.mockResolvedValue({ count: 1 })
    mockFindUnique.mockResolvedValue({ customChatbotId: "demosappada" })
    mockFindFirst.mockResolvedValue(NOT_SEEDED_YET)

    const { WorkspaceService } = require("../../../src/application/services/workspace.service")
    service = new WorkspaceService()
    // The service builds its own Prisma client; only the two models this
    // method touches are stubbed.
    service.prisma = {
      workspace: { findUnique: mockFindUnique },
      workspaceCallingFunction: {
        upsert: mockUpsert,
        updateMany: mockUpdateMany,
        findFirst: mockFindFirst,
      },
    }
  })

  describe("what gets written", () => {
    it("seeds one row per tool the module declares", async () => {
      await service.syncModuleToolRows(WORKSPACE_ID)

      expect(mockUpsert).toHaveBeenCalledTimes(7)
      const seeded = mockUpsert.mock.calls.map((c) => c[0].create.functionName)
      expect(seeded).toEqual([
        "get_weather",
        "check_accommodation",
        "remember",
        "save_stay",
        "save_itinerary",
        "save_push_consent",
        "save_feedback",
      ])
    })

    it("seeds them as active INTERNAL system rows", async () => {
      await service.syncModuleToolRows(WORKSPACE_ID)

      for (const [args] of mockUpsert.mock.calls) {
        // INTERNAL is the only executionType that both reaches the module
        // (getCustomTools filters on it) and, with no handler, produces an
        // honest refusal rather than a silent success.
        expect(args.create.executionType).toBe("INTERNAL")
        expect(args.create.isSystemFunction).toBe(true)
        expect(args.create.isActive).toBe(true)
        expect(args.create.description.length).toBeGreaterThan(0)
      }
    })

    it("scopes every write to the workspace", async () => {
      // CLAUDE.md §2 — multi-tenant isolation. Asserted explicitly because a
      // missing workspaceId here would write another tenant's row.
      await service.syncModuleToolRows(WORKSPACE_ID)

      for (const [args] of mockUpsert.mock.calls) {
        expect(args.where.workspaceId_functionName.workspaceId).toBe(WORKSPACE_ID)
        expect(args.create.workspaceId).toBe(WORKSPACE_ID)
      }
    })
  })

  describe("the database is authoritative", () => {
    it("never overwrites an existing row", async () => {
      // 🚨 THE property of this file. An empty `update` is what makes a
      // description edited in the UI survive the next Settings save.
      await service.syncModuleToolRows(WORKSPACE_ID)

      for (const [args] of mockUpsert.mock.calls) {
        expect(args.update).toEqual({})
      }
    })

    it("writes nothing different on a second run", async () => {
      mockFindFirst.mockResolvedValue(ALREADY_SEEDED)

      await service.syncModuleToolRows(WORKSPACE_ID)
      const firstRun = mockUpsert.mock.calls.length

      await service.syncModuleToolRows(WORKSPACE_ID)

      // Same idempotent upserts, and — see below — no repeated deactivation.
      expect(mockUpsert.mock.calls.length).toBe(firstRun * 2)
    })
  })

  describe("superseded platform functions", () => {
    it("deactivates manageNotifications when save_push_consent is first created", async () => {
      await service.syncModuleToolRows(WORKSPACE_ID)

      expect(mockUpdateMany).toHaveBeenCalledTimes(1)
      const [args] = mockUpdateMany.mock.calls[0]
      expect(args.where.workspaceId).toBe(WORKSPACE_ID)
      expect(args.where.functionName).toEqual({ in: ["manageNotifications"] })
      expect(args.data).toEqual({ isActive: false })
    })

    it("leaves it alone once the row already exists", async () => {
      // An admin who deliberately switched manageNotifications back on must
      // not have it switched off again by the next Settings save.
      mockFindFirst.mockResolvedValue(ALREADY_SEEDED)

      await service.syncModuleToolRows(WORKSPACE_ID)

      expect(mockUpdateMany).not.toHaveBeenCalled()
    })

    it("deletes nothing", async () => {
      // Superseded rows are deactivated, never removed: the admin can see them
      // and turn them back on.
      await service.syncModuleToolRows(WORKSPACE_ID)

      expect(mockUpdateMany.mock.calls.every(([a]) => a.data.isActive === false)).toBe(true)
    })

    it("does not re-disable it on the saves that follow", async () => {
      // The regression this file exists for. Seed once (deactivating it), then
      // save Settings twice more as an admin would after switching it back on.
      // The service must not touch it again — and asking Prisma "was this row
      // already there?" is what makes that true, since the row's timestamps
      // cannot answer it.
      await service.syncModuleToolRows(WORKSPACE_ID)
      expect(mockUpdateMany).toHaveBeenCalledTimes(1)

      mockFindFirst.mockResolvedValue(ALREADY_SEEDED)
      await service.syncModuleToolRows(WORKSPACE_ID)
      await service.syncModuleToolRows(WORKSPACE_ID)

      expect(mockUpdateMany).toHaveBeenCalledTimes(1)
    })
  })

  describe("modules without a manifest", () => {
    it("writes nothing for a module that declares no tools", async () => {
      // Six of the seven custom-* modules are in this position and must be
      // left exactly as they are (CLAUDE.md §13).
      mockFindUnique.mockResolvedValue({ customChatbotId: "demowash" })

      await service.syncModuleToolRows(WORKSPACE_ID)

      expect(mockUpsert).not.toHaveBeenCalled()
      expect(mockUpdateMany).not.toHaveBeenCalled()
    })

    it("writes nothing for a workspace with no chatbot module", async () => {
      mockFindUnique.mockResolvedValue({ customChatbotId: null })

      await service.syncModuleToolRows(WORKSPACE_ID)

      expect(mockUpsert).not.toHaveBeenCalled()
    })

    it("writes nothing for an unknown module", async () => {
      mockFindUnique.mockResolvedValue({ customChatbotId: "doesnotexist" })

      await service.syncModuleToolRows(WORKSPACE_ID)

      expect(mockUpsert).not.toHaveBeenCalled()
    })
  })

  describe("failure never costs the user their save", () => {
    it("swallows a database error", async () => {
      // Seeding runs inside the Settings save. A failure here must not turn a
      // successful save into an error the user sees — same contract as the
      // settings.json sync alongside it.
      mockUpsert.mockRejectedValue(new Error("connection lost"))

      await expect(service.syncModuleToolRows(WORKSPACE_ID)).resolves.toBeUndefined()
    })

    it("swallows an invalid chatbotId", async () => {
      mockFindUnique.mockResolvedValue({ customChatbotId: "../../etc" })

      await expect(service.syncModuleToolRows(WORKSPACE_ID)).resolves.toBeUndefined()
      expect(mockUpsert).not.toHaveBeenCalled()
    })
  })
})
