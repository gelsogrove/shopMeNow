import { applyUserStatusCascade } from "../../../src/interfaces/http/routes/user-admin.routes"
import { UserStatus } from "@echatbot/database"

describe("applyUserStatusCascade", () => {
  it("disables all owned workspaces when user is inactive", async () => {
    const mockPrisma = {
      workspace: {
        updateMany: jest.fn(),
      },
    }

    await applyUserStatusCascade(mockPrisma as any, "user-1", UserStatus.INACTIVE)

    expect(mockPrisma.workspace.updateMany).toHaveBeenCalledWith({
      where: {
        ownerId: "user-1",
        deletedAt: null,
        isDelete: false,
      },
      data: {
        isActive: false,
        channelStatus: false,
      },
    })
  })

  it("enables all owned workspaces when user is active", async () => {
    const mockPrisma = {
      workspace: {
        updateMany: jest.fn(),
      },
    }

    await applyUserStatusCascade(mockPrisma as any, "user-1", UserStatus.ACTIVE)

    expect(mockPrisma.workspace.updateMany).toHaveBeenCalledWith({
      where: {
        ownerId: "user-1",
        deletedAt: null,
        isDelete: false,
      },
      data: {
        isActive: true,
        channelStatus: true,
      },
    })
  })
})
