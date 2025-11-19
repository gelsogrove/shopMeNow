/**
 * Unit tests for EmailService.sendMail() function
 *
 * Tests the generic sendMail() function that:
 * - Looks up customer/agent email from database
 * - Fetches workspace adminEmail from whatsappSettings
 * - Sends email via nodemailer
 * - Supports CC recipients
 */

import { EmailService } from "../../../src/application/services/email.service"

// Mock nodemailer
jest.mock("nodemailer", () => ({
  createTransport: jest.fn(() => ({
    sendMail: jest.fn().mockResolvedValue({ messageId: "test-message-id" }),
    verify: jest.fn().mockResolvedValue(true),
  })),
}))

// Mock logger
jest.mock("../../../src/utils/logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  warn: jest.fn(),
}))

// Mock Prisma
jest.mock("@prisma/client", () => {
  const mockPrismaClient = {
    customers: {
      findUnique: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    workspace: {
      findUnique: jest.fn(),
    },
    $disconnect: jest.fn(),
  }

  return {
    PrismaClient: jest.fn(() => mockPrismaClient),
  }
})

describe("EmailService.sendMail()", () => {
  let emailService: EmailService
  let mockPrisma: any

  beforeEach(() => {
    // Set required env vars
    process.env.SMTP_HOST = "smtp.test.com"
    process.env.SMTP_PORT = "587"
    process.env.SMTP_SECURE = "false"
    process.env.SMTP_USER = "test@test.com"
    process.env.SMTP_PASS = "testpass"
    process.env.SMTP_FROM = "noreply@shopme.com"

    emailService = new EmailService()

    // Get mock Prisma instance
    const { PrismaClient } = require("@prisma/client")
    mockPrisma = new PrismaClient()

    // Reset all mocks
    jest.clearAllMocks()
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  describe("Customer emails", () => {
    it("should send email to customer successfully", async () => {
      // Mock customer lookup
      mockPrisma.customers.findUnique.mockResolvedValue({
        id: "customer-123",
        email: "customer@test.com",
        name: "Test Customer",
      })

      // Mock workspace lookup
      mockPrisma.workspace.findUnique.mockResolvedValue({
        id: "workspace-123",
        name: "Test Workspace",
        whatsappSettings: {
          adminEmail: "admin@workspace.com",
        },
      })

      const result = await emailService.sendMail({
        type: "customer",
        to: "customer-123",
        subject: "Test Email",
        body: "<h1>Hello Customer</h1>",
        workspaceId: "workspace-123",
      })

      expect(result).toBe(true)
      expect(mockPrisma.customers.findUnique).toHaveBeenCalledWith({
        where: { id: "customer-123" },
        select: { email: true, name: true },
      })
      expect(mockPrisma.workspace.findUnique).toHaveBeenCalledWith({
        where: { id: "workspace-123" },
        select: {
          name: true,
          whatsappSettings: {
            select: { adminEmail: true },
          },
        },
      })
    })

    it("should fail if customer not found", async () => {
      mockPrisma.customers.findUnique.mockResolvedValue(null)

      const result = await emailService.sendMail({
        type: "customer",
        to: "nonexistent-customer",
        subject: "Test",
        body: "Test",
        workspaceId: "workspace-123",
      })

      expect(result).toBe(false)
    })

    it("should fail if customer has no email", async () => {
      mockPrisma.customers.findUnique.mockResolvedValue({
        id: "customer-123",
        email: null,
        name: "Test Customer",
      })

      const result = await emailService.sendMail({
        type: "customer",
        to: "customer-123",
        subject: "Test",
        body: "Test",
        workspaceId: "workspace-123",
      })

      expect(result).toBe(false)
    })
  })

  describe("Agent emails", () => {
    it("should send email to agent successfully", async () => {
      // Mock agent lookup
      mockPrisma.user.findUnique.mockResolvedValue({
        id: "agent-123",
        email: "agent@test.com",
        firstName: "Test",
        lastName: "Agent",
      })

      // Mock workspace lookup
      mockPrisma.workspace.findUnique.mockResolvedValue({
        id: "workspace-123",
        name: "Test Workspace",
        whatsappSettings: {
          adminEmail: "admin@workspace.com",
        },
      })

      const result = await emailService.sendMail({
        type: "agent",
        to: "agent-123",
        subject: "Test Email",
        body: "<h1>Hello Agent</h1>",
        workspaceId: "workspace-123",
      })

      expect(result).toBe(true)
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: "agent-123" },
        select: { email: true, firstName: true, lastName: true },
      })
    })

    it("should fail if agent not found", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null)

      const result = await emailService.sendMail({
        type: "agent",
        to: "nonexistent-agent",
        subject: "Test",
        body: "Test",
        workspaceId: "workspace-123",
      })

      expect(result).toBe(false)
    })
  })

  describe("Workspace configuration", () => {
    it("should fail if workspace not found", async () => {
      mockPrisma.customers.findUnique.mockResolvedValue({
        id: "customer-123",
        email: "customer@test.com",
        name: "Test Customer",
      })

      mockPrisma.workspace.findUnique.mockResolvedValue(null)

      const result = await emailService.sendMail({
        type: "customer",
        to: "customer-123",
        subject: "Test",
        body: "Test",
        workspaceId: "nonexistent-workspace",
      })

      expect(result).toBe(false)
    })

    it("should fail if workspace has no adminEmail", async () => {
      mockPrisma.customers.findUnique.mockResolvedValue({
        id: "customer-123",
        email: "customer@test.com",
        name: "Test Customer",
      })

      mockPrisma.workspace.findUnique.mockResolvedValue({
        id: "workspace-123",
        name: "Test Workspace",
        whatsappSettings: null, // No whatsappSettings
      })

      const result = await emailService.sendMail({
        type: "customer",
        to: "customer-123",
        subject: "Test",
        body: "Test",
        workspaceId: "workspace-123",
      })

      expect(result).toBe(false)
    })
  })

  describe("CC functionality", () => {
    it("should support single CC recipient", async () => {
      mockPrisma.customers.findUnique.mockResolvedValue({
        id: "customer-123",
        email: "customer@test.com",
        name: "Test Customer",
      })

      mockPrisma.workspace.findUnique.mockResolvedValue({
        id: "workspace-123",
        name: "Test Workspace",
        whatsappSettings: {
          adminEmail: "admin@workspace.com",
        },
      })

      const result = await emailService.sendMail({
        type: "customer",
        to: "customer-123",
        subject: "Test",
        body: "Test",
        cc: "cc@test.com",
        workspaceId: "workspace-123",
      })

      expect(result).toBe(true)
    })

    it("should support multiple CC recipients", async () => {
      mockPrisma.customers.findUnique.mockResolvedValue({
        id: "customer-123",
        email: "customer@test.com",
        name: "Test Customer",
      })

      mockPrisma.workspace.findUnique.mockResolvedValue({
        id: "workspace-123",
        name: "Test Workspace",
        whatsappSettings: {
          adminEmail: "admin@workspace.com",
        },
      })

      const result = await emailService.sendMail({
        type: "customer",
        to: "customer-123",
        subject: "Test",
        body: "Test",
        cc: ["cc1@test.com", "cc2@test.com"],
        workspaceId: "workspace-123",
      })

      expect(result).toBe(true)
    })
  })

  describe("Error handling", () => {
    it("should return false on invalid type", async () => {
      const result = await emailService.sendMail({
        type: "invalid" as any,
        to: "test-123",
        subject: "Test",
        body: "Test",
        workspaceId: "workspace-123",
      })

      expect(result).toBe(false)
    })

   
  })
})
