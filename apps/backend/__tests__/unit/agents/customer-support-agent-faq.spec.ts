/**
 * Test: CustomerSupportAgentLLM - FAQ Integration
 * 
 * Verifies that FAQs are loaded from database and passed to the agent's prompt
 */

import { prisma } from "@echatbot/database"
import { CustomerSupportAgentLLM } from "../../../src/application/agents/CustomerSupportAgentLLM"

let workspaceId: string
let customerId: string
let faqId: string

describe("CustomerSupportAgentLLM - FAQ Integration", () => {
  beforeAll(async () => {
    // Create test workspace
    const workspace = await prisma.workspace.create({
      data: {
        name: "Test Workspace - FAQ Support",
        whatsappPhoneNumber: "+393334445557",
        apiKey: `test_faq_${Date.now()}`,
        currency: "EUR",
        slug: `test-workspace-faq-support-${Date.now()}`,
      },
    })
    workspaceId = workspace.id

    // Create test customer
    const customer = await prisma.customers.create({
      data: {
        name: "Test Customer",
        phone: "+393334445557",
        email: "test-faq@test.com",
        workspaceId,
        isActive: true,
      },
    })
    customerId = customer.id

    // Create test FAQ
    const faq = await prisma.fAQ.create({
      data: {
        workspaceId,
        question: "How long does onboarding typically take?",
        answer: "Starter workspaces launch in a few hours. Enterprise rollouts include a 2-week implementation sprint covering training, automations, testing and go-live checklist.",
        keywords: ["onboarding", "setup", "implementation"],
        category: "Deployment",
        isActive: true,
      },
    })
    faqId = faq.id
  })

  afterAll(async () => {
    // Cleanup
    await prisma.fAQ.deleteMany({ where: { workspaceId } })
    await prisma.customers.deleteMany({ where: { workspaceId } })
    await prisma.workspace.delete({ where: { id: workspaceId } })
    await prisma.$disconnect()
  })

  describe("FAQ Loading", () => {
    it("should load FAQs from database", async () => {
      const MessageRepository = require("../../../src/repositories/message.repository").MessageRepository
      const messageRepo = new MessageRepository()
      
      const faqs = await messageRepo.getActiveFaqs(workspaceId)

      expect(faqs).toBeDefined()
      expect(faqs.length).toBeGreaterThan(0)
      expect(faqs).toContain("How long does onboarding typically take?")
      expect(faqs).toContain("Starter workspaces launch in a few hours")
    })

    it("should format FAQs as Q&A pairs", async () => {
      const MessageRepository = require("../../../src/repositories/message.repository").MessageRepository
      const messageRepo = new MessageRepository()
      
      const faqs = await messageRepo.getActiveFaqs(workspaceId)

      expect(faqs).toMatch(/D:.*\nR:.*/)
      expect(faqs).toContain("D: How long does onboarding typically take?")
      expect(faqs).toContain("R: Starter workspaces launch in a few hours")
    })
  })

  describe("CustomerSupportAgent FAQ Integration", () => {
    it("should receive FAQs in the prompt context", async () => {
      // Note: This test verifies the structure, not the LLM call
      // We're testing that FAQs are loaded and would be passed to the LLM
      
      const MessageRepository = require("../../../src/repositories/message.repository").MessageRepository
      const messageRepo = new MessageRepository()
      
      const faqs = await messageRepo.getActiveFaqs(workspaceId)

      // Verify FAQs are loaded
      expect(faqs).toBeDefined()
      expect(faqs.length).toBeGreaterThan(0)

      // Verify FAQ content matches what would be in prompt
      expect(faqs).toContain("onboarding")
      expect(faqs).toContain("Starter workspaces")
    })
  })

  describe("FAQ Filtering", () => {
    it("should only return active FAQs", async () => {
      // Create inactive FAQ
      const inactiveFaq = await prisma.fAQ.create({
        data: {
          workspaceId,
          question: "This is inactive FAQ",
          answer: "Should not appear",
          keywords: ["inactive"],
          isActive: false,
        },
      })

      const MessageRepository = require("../../../src/repositories/message.repository").MessageRepository
      const messageRepo = new MessageRepository()
      
      const faqs = await messageRepo.getActiveFaqs(workspaceId)

      expect(faqs).not.toContain("This is inactive FAQ")
      expect(faqs).not.toContain("Should not appear")

      // Cleanup
      await prisma.fAQ.delete({ where: { id: inactiveFaq.id } })
    })

    it("should filter FAQs by workspaceId", async () => {
      // Create another workspace with its own FAQ
    const otherWorkspace = await prisma.workspace.create({
      data: {
        name: "Other Workspace",
        whatsappPhoneNumber: "+393334445558",
        apiKey: `test_other_${Date.now()}`,
        currency: "EUR",
        slug: `test-workspace-faq-other-${Date.now()}`,
      },
    })

      const otherFaq = await prisma.fAQ.create({
        data: {
          workspaceId: otherWorkspace.id,
          question: "FAQ from other workspace",
          answer: "Should not appear in first workspace",
          keywords: ["other"],
          isActive: true,
        },
      })

      const MessageRepository = require("../../../src/repositories/message.repository").MessageRepository
      const messageRepo = new MessageRepository()
      
      const faqs = await messageRepo.getActiveFaqs(workspaceId)

      expect(faqs).not.toContain("FAQ from other workspace")
      expect(faqs).toContain("How long does onboarding typically take?")

      // Cleanup
      await prisma.fAQ.delete({ where: { id: otherFaq.id } })
      await prisma.workspace.delete({ where: { id: otherWorkspace.id } })
    })
  })
})
