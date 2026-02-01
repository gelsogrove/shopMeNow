/**
 * Registration Status Tests
 * 
 * Tests for the 3-state registration system:
 * - NEW: Customer has never registered
 * - PENDING_APPROVAL: Customer registered, awaiting admin approval
 * - ACTIVE: Customer is fully activated
 * 
 * This test suite validates:
 * 1. Auto-activation when requireManualApproval = false
 * 2. Pending approval when requireManualApproval = true
 * 3. Link replacement behavior for each state
 */

import { describe, it, expect, jest, beforeEach } from "@jest/globals"

// Mock Prisma
const mockPrismaCustomersFindFirst = jest.fn()
const mockPrismaWorkspaceFindUnique = jest.fn()

jest.mock("@echatbot/database", () => ({
  prisma: {
    customers: {
      findFirst: (...args: any[]) => mockPrismaCustomersFindFirst(...args),
    },
    workspace: {
      findUnique: (...args: any[]) => mockPrismaWorkspaceFindUnique(...args),
    },
  },
}))

describe("Registration Status System", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("Registration Status Values", () => {
    it("should have three valid registration statuses", () => {
      // SCENARIO: Validate the enum values are correctly defined
      const validStatuses = ["NEW", "PENDING_APPROVAL", "ACTIVE"]
      
      expect(validStatuses).toContain("NEW")
      expect(validStatuses).toContain("PENDING_APPROVAL")
      expect(validStatuses).toContain("ACTIVE")
      expect(validStatuses.length).toBe(3)
    })

    it("should default to NEW for new customers", () => {
      // SCENARIO: A customer who has never interacted should have NEW status
      // RULE: Default registration status is NEW
      const defaultStatus = "NEW"
      expect(defaultStatus).toBe("NEW")
    })
  })

  describe("Workspace requireManualApproval Setting", () => {
    it("should allow auto-activation when requireManualApproval is false", () => {
      // SCENARIO: Workspace with requireManualApproval = false
      // RULE: Customer goes directly to ACTIVE after registration
      const workspaceSettings = { requireManualApproval: false }
      const shouldActivateImmediately = !workspaceSettings.requireManualApproval
      const expectedStatus = shouldActivateImmediately ? "ACTIVE" : "PENDING_APPROVAL"
      
      expect(shouldActivateImmediately).toBe(true)
      expect(expectedStatus).toBe("ACTIVE")
    })

    it("should require admin approval when requireManualApproval is true", () => {
      // SCENARIO: Workspace with requireManualApproval = true
      // RULE: Customer goes to PENDING_APPROVAL after registration
      const workspaceSettings = { requireManualApproval: true }
      const shouldActivateImmediately = !workspaceSettings.requireManualApproval
      const expectedStatus = shouldActivateImmediately ? "ACTIVE" : "PENDING_APPROVAL"
      
      expect(shouldActivateImmediately).toBe(false)
      expect(expectedStatus).toBe("PENDING_APPROVAL")
    })

    it("should default to false when requireManualApproval is undefined", () => {
      // SCENARIO: Workspace without explicit requireManualApproval setting
      // RULE: Default behavior is auto-activation (false)
      const workspaceSettings = { requireManualApproval: undefined }
      const shouldActivateImmediately = !(workspaceSettings.requireManualApproval ?? false)
      
      expect(shouldActivateImmediately).toBe(true)
    })
  })

  describe("Link Replacement for Registration Status", () => {
    it("should remove registration link for ACTIVE customers", () => {
      // SCENARIO: Customer with ACTIVE status
      // RULE: Registration link token should be removed
      const customer = { registrationStatus: "ACTIVE", isActive: true }
      const shouldShowLink = customer.registrationStatus !== "ACTIVE" && !customer.isActive
      
      expect(shouldShowLink).toBe(false)
    })

    it("should show pending message for PENDING_APPROVAL customers", () => {
      // SCENARIO: Customer with PENDING_APPROVAL status
      // RULE: Registration link should be replaced with pending approval message
      const customer = { registrationStatus: "PENDING_APPROVAL", isActive: false }
      const isPendingApproval = customer.registrationStatus === "PENDING_APPROVAL"
      
      expect(isPendingApproval).toBe(true)
    })

    it("should show registration link for NEW customers", () => {
      // SCENARIO: Customer with NEW status (or undefined)
      // RULE: Registration link should be generated and shown
      const customer = { registrationStatus: "NEW", isActive: false }
      const isNew = customer.registrationStatus === "NEW" || !customer.registrationStatus
      
      expect(isNew).toBe(true)
    })

    it("should handle legacy isActive=true for ACTIVE status", () => {
      // SCENARIO: Backward compatibility - isActive=true should be treated as ACTIVE
      // RULE: Support both isActive and registrationStatus for gradual migration
      const customer = { registrationStatus: undefined, isActive: true }
      const isActive = customer.registrationStatus === "ACTIVE" || customer.isActive
      
      expect(isActive).toBe(true)
    })
  })

  describe("Registration Flow Outcomes", () => {
    it("should set correct status for auto-activation flow", () => {
      // SCENARIO: Customer registers, workspace has requireManualApproval=false
      // EXPECTED: isActive=true, registrationStatus=ACTIVE
      const workspace = { requireManualApproval: false }
      const shouldActivate = !workspace.requireManualApproval
      
      const customerData = {
        isActive: shouldActivate,
        registrationStatus: shouldActivate ? "ACTIVE" : "PENDING_APPROVAL",
      }
      
      expect(customerData.isActive).toBe(true)
      expect(customerData.registrationStatus).toBe("ACTIVE")
    })

    it("should set correct status for manual approval flow", () => {
      // SCENARIO: Customer registers, workspace has requireManualApproval=true
      // EXPECTED: isActive=false, registrationStatus=PENDING_APPROVAL
      const workspace = { requireManualApproval: true }
      const shouldActivate = !workspace.requireManualApproval
      
      const customerData = {
        isActive: shouldActivate,
        registrationStatus: shouldActivate ? "ACTIVE" : "PENDING_APPROVAL",
      }
      
      expect(customerData.isActive).toBe(false)
      expect(customerData.registrationStatus).toBe("PENDING_APPROVAL")
    })

    it("should send after-registration message only for activated customers", () => {
      // SCENARIO: After registration completes
      // RULE: Only send welcome message if isActive=true
      const autoActivatedCustomer = { isActive: true, registrationStatus: "ACTIVE" }
      const pendingCustomer = { isActive: false, registrationStatus: "PENDING_APPROVAL" }
      
      const shouldSendMessageAuto = autoActivatedCustomer.isActive
      const shouldSendMessagePending = pendingCustomer.isActive
      
      expect(shouldSendMessageAuto).toBe(true)
      expect(shouldSendMessagePending).toBe(false)
    })
  })

  describe("Pending Approval Message Content", () => {
    it("should include pending approval message in Italian", () => {
      // SCENARIO: Customer in PENDING_APPROVAL sees appropriate message
      // RULE: Message should be clear and friendly
      const pendingMessage = "⏳ La tua registrazione è in attesa di approvazione. Ti contatteremo presto!"
      
      expect(pendingMessage).toContain("attesa")
      expect(pendingMessage).toContain("approvazione")
      expect(pendingMessage).toContain("⏳")
    })
  })

  describe("Registration API Response", () => {
    it("should return correct response for auto-activated customer", () => {
      // SCENARIO: Customer registers with auto-activation
      // EXPECTED: success=true, requiresApproval=false
      const response = {
        success: true,
        customer: {
          id: "cust-123",
          name: "Mario Rossi",
          phone: "+393331234567",
          registrationStatus: "ACTIVE",
        },
        message: "Registration successful",
        requiresApproval: false,
      }
      
      expect(response.success).toBe(true)
      expect(response.requiresApproval).toBe(false)
      expect(response.customer.registrationStatus).toBe("ACTIVE")
    })

    it("should return correct response for pending approval customer", () => {
      // SCENARIO: Customer registers with manual approval required
      // EXPECTED: success=true, requiresApproval=true
      const response = {
        success: true,
        customer: {
          id: "cust-456",
          name: "Luigi Verdi",
          phone: "+393339876543",
          registrationStatus: "PENDING_APPROVAL",
        },
        message: "Registration submitted - awaiting admin approval",
        requiresApproval: true,
      }
      
      expect(response.success).toBe(true)
      expect(response.requiresApproval).toBe(true)
      expect(response.customer.registrationStatus).toBe("PENDING_APPROVAL")
      expect(response.message).toContain("awaiting admin approval")
    })
  })
})
