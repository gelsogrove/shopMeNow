/**
 * Unit Tests: WebSocket channel status notifications
 */

import { workspaceService } from "../../../src/services/workspace.service"
import { prisma } from "@echatbot/database"
import { websocketService } from "../../../src/services/websocket.service"

jest.mock("@echatbot/database", () => ({
  prisma: {
    workspace: {
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    whatsappSettings: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
    },
  },
}))

jest.mock("../../../src/services/websocket.service", () => ({
  websocketService: {
    notifyChannelStatusChanged: jest.fn(),
  },
}))

describe("WorkspaceService - channelStatus WebSocket notifications", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("should notify WebSocket when channelStatus changes", async () => {
    ;(prisma.workspace.findUnique as jest.Mock).mockResolvedValue({
      ownerId: null,
      enableWhatsapp: true,
      enableWidget: false,
      deletedAt: null,
      channelStatus: true,
    })

    ;(prisma.workspace.update as jest.Mock).mockResolvedValue({
      id: "ws-1",
      channelStatus: false,
      whatsappSettings: null,
    })

    await workspaceService.update("ws-1", { channelStatus: false })

    expect(websocketService.notifyChannelStatusChanged).toHaveBeenCalledWith(
      "ws-1",
      expect.objectContaining({
        channelStatus: false,
        source: "settings",
      })
    )
  })
})

