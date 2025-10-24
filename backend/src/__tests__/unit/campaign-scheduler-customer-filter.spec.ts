import { CampaignScheduler } from "../../services/campaign-scheduler.service"

describe("CampaignScheduler.getTargetCustomers", () => {
  let prisma: any
  let scheduler: CampaignScheduler

  beforeAll(() => {
    // Mock Prisma for testing
    prisma = {
      workspace: {
        upsert: jest.fn().mockResolvedValue({
          id: "ws-test",
          name: "Test WS",
          slug: "test-ws",
        }),
      },
      customers: {
        upsert: jest
          .fn()
          .mockImplementation(({ create }) => Promise.resolve(create)),
        findMany: jest.fn(),
      },
      $disconnect: jest.fn(),
    }
    scheduler = new CampaignScheduler(prisma as any)
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it("should exclude blocked and push_notifications_consent=false customers for ALL", async () => {
    const wsId = "ws-test-1"

    // Mock customers in database
    const allCustomers = [
      {
        id: "c1",
        name: "A",
        workspaceId: wsId,
        isActive: true,
        isBlacklisted: false,
        push_notifications_consent: true,
        email: "a@test.com",
        phone: "123",
        language: "en",
      },
      {
        id: "c2",
        name: "B",
        workspaceId: wsId,
        isActive: true,
        isBlacklisted: true,
        push_notifications_consent: true,
        email: "b@test.com",
        phone: "124",
        language: "en",
      },
      {
        id: "c3",
        name: "C",
        workspaceId: wsId,
        isActive: true,
        isBlacklisted: false,
        push_notifications_consent: false,
        email: "c@test.com",
        phone: "125",
        language: "en",
      },
      {
        id: "c4",
        name: "D",
        workspaceId: wsId,
        isActive: false,
        isBlacklisted: false,
        push_notifications_consent: true,
        email: "d@test.com",
        phone: "126",
        language: "en",
      },
    ]

    // Mock findMany to return only valid customers (filter applied)
    prisma.customers.findMany.mockResolvedValueOnce(
      allCustomers.filter(
        (c) => c.isActive && !c.isBlacklisted && c.push_notifications_consent
      )
    )

    const campaign = { targetType: "ALL", workspaceId: wsId }
    const customers = await scheduler["getTargetCustomers"](campaign)

    // Only c1 should be returned (active, not blacklisted, push consent enabled)
    expect(customers.map((c: any) => c.id).sort()).toEqual(["c1"])

    // Verify the filter was called correctly
    expect(prisma.customers.findMany).toHaveBeenCalledWith({
      where: {
        workspaceId: wsId,
        isActive: true,
        isBlacklisted: false,
        push_notifications_consent: true,
        last_privacy_version_accepted: { not: null },
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        language: true,
      },
    })
  })

  it("should exclude blocked and push_notifications_consent=false customers for SELECTED", async () => {
    const wsId = "ws-test-2"

    // Mock customers in database
    const selectedCustomers = [
      {
        id: "c10",
        name: "A",
        workspaceId: wsId,
        isActive: true,
        isBlacklisted: false,
        push_notifications_consent: true,
        email: "a2@test.com",
        phone: "223",
        language: "en",
      },
      {
        id: "c11",
        name: "B",
        workspaceId: wsId,
        isActive: true,
        isBlacklisted: true,
        push_notifications_consent: true,
        email: "b2@test.com",
        phone: "224",
        language: "en",
      },
      {
        id: "c12",
        name: "C",
        workspaceId: wsId,
        isActive: true,
        isBlacklisted: false,
        push_notifications_consent: false,
        email: "c2@test.com",
        phone: "225",
        language: "en",
      },
    ]

    // Mock findMany to return only valid customers (filter applied)
    prisma.customers.findMany.mockResolvedValueOnce(
      selectedCustomers.filter(
        (c) => c.isActive && !c.isBlacklisted && c.push_notifications_consent
      )
    )

    const campaign = {
      targetType: "SELECTED",
      workspaceId: wsId,
      customerIds: ["c10", "c11", "c12"],
    }
    const customers = await scheduler["getTargetCustomers"](campaign)

    // Only c10 should be returned (active, not blacklisted, push consent enabled)
    expect(customers.map((c: any) => c.id).sort()).toEqual(["c10"])

    // Verify the filter was called correctly
    expect(prisma.customers.findMany).toHaveBeenCalledWith({
      where: {
        id: { in: ["c10", "c11", "c12"] },
        workspaceId: wsId,
        isActive: true,
        isBlacklisted: false,
        push_notifications_consent: true,
        last_privacy_version_accepted: { not: null },
      },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        language: true,
      },
    })
  })
})
