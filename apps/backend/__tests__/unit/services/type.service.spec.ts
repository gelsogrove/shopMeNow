import { TypeService } from "../../../src/application/services/type.service"
import { TypeRepository } from "../../../src/repositories/type.repository"

describe("TypeService - UNIT Tests", () => {
  let service: TypeService
  let mockRepository: jest.Mocked<TypeRepository>

  beforeEach(() => {
    mockRepository = {
      findByWorkspace: jest.fn(),
      findById: jest.fn(),
      findByName: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      countProductsUsing: jest.fn(),
      findByWorkspaceWithCounts: jest.fn(),
    } as any

    service = new TypeService(null as any)
    ;(service as any).typeRepository = mockRepository
  })

  describe("Validation Rules", () => {
    it("should reject empty name", async () => {
      await expect(service.create("workspace1", "")).rejects.toThrow(
        "Transport type name is required"
      )
    })

    it("should reject name with only whitespace", async () => {
      await expect(service.create("workspace1", "   ")).rejects.toThrow(
        "Transport type name is required"
      )
    })

    it("should reject name longer than 50 characters", async () => {
      const longName = "A".repeat(51)
      await expect(service.create("workspace1", longName)).rejects.toThrow(
        "Transport type name too long"
      )
    })

    it("should accept name with exactly 50 characters", async () => {
      const name = "A".repeat(50)
      mockRepository.findByName.mockResolvedValue(null)
      mockRepository.create.mockResolvedValue({
        id: "tt1",
        workspaceId: "workspace1",
        name,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const result = await service.create("workspace1", name)
      expect(result.name).toBe(name)
    })
  })

  describe("Duplicate Prevention", () => {
    it("should reject duplicate name in same workspace", async () => {
      mockRepository.findByName.mockResolvedValue({
        id: "existing",
        workspaceId: "workspace1",
        name: "Refrigerato",
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      await expect(
        service.create("workspace1", "Refrigerato")
      ).rejects.toThrow("Transport type already exists")
    })

    it("should allow same name in different workspaces", async () => {
      mockRepository.findByName.mockResolvedValue(null)
      mockRepository.create.mockResolvedValue({
        id: "tt2",
        workspaceId: "workspace2",
        name: "Refrigerato",
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const result = await service.create("workspace2", "Refrigerato")
      expect(result.workspaceId).toBe("workspace2")
    })

    it("should reject duplicate on update", async () => {
      mockRepository.findById.mockResolvedValue({
        id: "tt1",
        workspaceId: "workspace1",
        name: "Air",
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      mockRepository.findByName.mockResolvedValue({
        id: "tt2",
        workspaceId: "workspace1",
        name: "Sea",
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      await expect(
        service.update("tt1", "workspace1", "Sea")
      ).rejects.toThrow("Transport type name already exists")
    })
  })

  describe("Delete Protection", () => {
    it("should prevent deletion if used by products", async () => {
      mockRepository.findById.mockResolvedValue({
        id: "tt1",
        workspaceId: "workspace1",
        name: "Refrigerated",
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      mockRepository.countProductsUsing.mockResolvedValue(5)

      await expect(service.delete("tt1", "workspace1")).rejects.toThrow(
        "Cannot delete. Used by 5 products"
      )
    })

    it("should allow deletion if not used by products", async () => {
      mockRepository.findById.mockResolvedValue({
        id: "tt1",
        workspaceId: "workspace1",
        name: "Unused Type",
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      mockRepository.countProductsUsing.mockResolvedValue(0)
      mockRepository.delete.mockResolvedValue(undefined)

      await expect(
        service.delete("tt1", "workspace1")
      ).resolves.not.toThrow()

      expect(mockRepository.delete).toHaveBeenCalledWith("tt1", "workspace1")
    })
  })

  describe("Workspace Isolation", () => {
    it("should enforce workspace isolation on create", async () => {
      mockRepository.findByName.mockResolvedValue(null)
      mockRepository.create.mockResolvedValue({
        id: "tt1",
        workspaceId: "workspace1",
        name: "Air",
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      await service.create("workspace1", "Air")

      expect(mockRepository.findByName).toHaveBeenCalledWith("Air", "workspace1")
      expect(mockRepository.create).toHaveBeenCalledWith("workspace1", "Air")
    })

    it("should enforce workspace isolation on update", async () => {
      mockRepository.findById.mockResolvedValue({
        id: "tt1",
        workspaceId: "workspace1",
        name: "Old Name",
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      mockRepository.findByName.mockResolvedValue(null)
      mockRepository.update.mockResolvedValue({
        id: "tt1",
        workspaceId: "workspace1",
        name: "New Name",
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      await service.update("tt1", "workspace1", "New Name")

      expect(mockRepository.findById).toHaveBeenCalledWith("tt1", "workspace1")
      expect(mockRepository.update).toHaveBeenCalledWith(
        "tt1",
        "workspace1",
        "New Name"
      )
    })

    it("should enforce workspace isolation on delete", async () => {
      mockRepository.findById.mockResolvedValue({
        id: "tt1",
        workspaceId: "workspace1",
        name: "Air",
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      mockRepository.countProductsUsing.mockResolvedValue(0)
      mockRepository.delete.mockResolvedValue(undefined)

      await service.delete("tt1", "workspace1")

      expect(mockRepository.findById).toHaveBeenCalledWith("tt1", "workspace1")
      expect(mockRepository.delete).toHaveBeenCalledWith("tt1", "workspace1")
    })
  })

  describe("validateTypeIds", () => {
    it("should validate all IDs exist in workspace", async () => {
      mockRepository.findByWorkspace.mockResolvedValue([
        {
          id: "tt1",
          workspaceId: "workspace1",
          name: "Air",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        {
          id: "tt2",
          workspaceId: "workspace1",
          name: "Sea",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ])

      const result = await service.validateTypeIds(
        ["tt1", "tt2"],
        "workspace1"
      )

      expect(result).toBe(true)
    })

    it("should reject if any ID is invalid", async () => {
      mockRepository.findByWorkspace.mockResolvedValue([
        {
          id: "tt1",
          workspaceId: "workspace1",
          name: "Air",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ])

      const result = await service.validateTypeIds(
        ["tt1", "invalid"],
        "workspace1"
      )

      expect(result).toBe(false)
    })

    it("should handle empty array", async () => {
      const result = await service.validateTypeIds([], "workspace1")
      expect(result).toBe(true)
      expect(mockRepository.findByWorkspace).not.toHaveBeenCalled()
    })
  })

  describe("Name Trimming", () => {
    it("should trim whitespace from name on create", async () => {
      mockRepository.findByName.mockResolvedValue(null)
      mockRepository.create.mockResolvedValue({
        id: "tt1",
        workspaceId: "workspace1",
        name: "Air",
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      await service.create("workspace1", "  Air  ")

      expect(mockRepository.findByName).toHaveBeenCalledWith("Air", "workspace1")
      expect(mockRepository.create).toHaveBeenCalledWith("workspace1", "Air")
    })

    it("should trim whitespace from name on update", async () => {
      mockRepository.findById.mockResolvedValue({
        id: "tt1",
        workspaceId: "workspace1",
        name: "Old",
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      mockRepository.findByName.mockResolvedValue(null)
      mockRepository.update.mockResolvedValue({
        id: "tt1",
        workspaceId: "workspace1",
        name: "New",
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      await service.update("tt1", "workspace1", "  New  ")

      expect(mockRepository.findByName).toHaveBeenCalledWith("New", "workspace1")
      expect(mockRepository.update).toHaveBeenCalledWith(
        "tt1",
        "workspace1",
        "New"
      )
    })
  })
})
