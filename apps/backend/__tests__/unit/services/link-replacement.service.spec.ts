import { LinkReplacementService } from "../../../src/application/services/link-replacement.service"
import { SecureTokenService } from "../../../src/application/services/secure-token.service"
import { linkGeneratorService } from "../../../src/application/services/link-generator.service"
import { prisma as mockedPrisma } from "@echatbot/database"

// Mock database client
jest.mock("@echatbot/database", () => {
  const workspaces = { findUnique: jest.fn() }
  return {
    prisma: { workspaces },
    PrismaClient: jest.fn(),
    Prisma: {},
  }
})

// Mock link generator
jest.mock("../../../src/application/services/link-generator.service", () => ({
  linkGeneratorService: {
    generateRegistrationLink: jest.fn(),
  },
}))

describe.skip("LinkReplacementService - registration links", () => {
  const workspaces = (mockedPrisma as any).workspaces
  const createTokenSpy = jest.spyOn(SecureTokenService.prototype, "createToken")

  beforeEach(() => {
    jest.clearAllMocks()
    workspaces.findUnique.mockResolvedValue({ url: "https://shop.example" })
    ;(linkGeneratorService.generateRegistrationLink as jest.Mock).mockResolvedValue(
      "https://shop.example/registrazione?token=tok123"
    )
    createTokenSpy.mockResolvedValue("tok123")
  })

  it("replaces [LINK_REGISTRATION_WITH_TOKEN] using provided prisma", async () => {
    const service = new LinkReplacementService(mockedPrisma as any)

    const result = await service.replaceTokens(
      { response: "[LINK_REGISTRATION_WITH_TOKEN]" },
      "cust-1",
      "ws-1",
      "+123"
    )

    expect(result.success).toBe(true)
    expect(result.response).toContain("https://shop.example/registrazione?token=tok123")
    expect(workspaces.findUnique).toHaveBeenCalledWith({
      where: { id: "ws-1" },
      select: { url: true, slug: true },
    })
  })

  it("falls back to default prisma when none is provided", async () => {
    const service = new LinkReplacementService(undefined)

    const result = await service.replaceTokens(
      { response: "[LINK_REGISTRATION_WITH_TOKEN]" },
      "cust-2",
      "ws-2",
      "+456"
    )

    expect(result.success).toBe(true)
    expect(result.response).toContain("https://shop.example/registrazione?token=tok123")
    expect(workspaces.findUnique).toHaveBeenCalledWith({
      where: { id: "ws-2" },
      select: { url: true, slug: true },
    })
  })
})
