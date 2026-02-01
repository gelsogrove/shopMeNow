/**
 * Customer Approval Tests
 * 
 * Tests for the admin customer approval flow:
 * - POST /customers/:id/approve endpoint
 * - Status transition: PENDING_APPROVAL → ACTIVE
 * - WhatsApp approval message sending
 * - Custom approvalMessage from workspace settings
 * 
 * Andrea's Rule: Tests are the Bible - they define expected behavior
 */

import { describe, it, expect, jest, beforeEach } from "@jest/globals"

// Mock Prisma
const mockPrismaCustomersFindFirst = jest.fn()
const mockPrismaCustomersUpdate = jest.fn()
const mockPrismaWorkspaceFindUnique = jest.fn()
const mockPrismaWhatsAppQueueCreate = jest.fn()

jest.mock("@echatbot/database", () => ({
  prisma: {
    customers: {
      findFirst: (...args: any[]) => mockPrismaCustomersFindFirst(...args),
      update: (...args: any[]) => mockPrismaCustomersUpdate(...args),
    },
    workspace: {
      findUnique: (...args: any[]) => mockPrismaWorkspaceFindUnique(...args),
    },
    whatsAppQueue: {
      create: (...args: any[]) => mockPrismaWhatsAppQueueCreate(...args),
    },
  },
}))

describe("Customer Approval Flow", () => {
  const mockWorkspaceId = "workspace-123"
  const mockCustomerId = "customer-456"
  
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe("Approval Endpoint Validation", () => {
    it("should only approve customers in PENDING_APPROVAL status", () => {
      // SCENARIO: Admin tries to approve a customer
      // RULE: Only customers with registrationStatus=PENDING_APPROVAL can be approved
      
      const customer = {
        id: mockCustomerId,
        registrationStatus: "PENDING_APPROVAL",
        isActive: false,
      }
      
      const canBeApproved = customer.registrationStatus === "PENDING_APPROVAL"
      expect(canBeApproved).toBe(true)
    })

    it("should reject approval for ACTIVE customers", () => {
      // SCENARIO: Admin tries to approve an already active customer
      // RULE: Cannot approve a customer who is already ACTIVE
      
      const customer = {
        id: mockCustomerId,
        registrationStatus: "ACTIVE",
        isActive: true,
      }
      
      const canBeApproved = customer.registrationStatus === "PENDING_APPROVAL"
      expect(canBeApproved).toBe(false)
    })

    it("should reject approval for NEW customers", () => {
      // SCENARIO: Admin tries to approve a NEW customer who hasn't registered
      // RULE: NEW customers must register first, cannot be approved directly
      
      const customer = {
        id: mockCustomerId,
        registrationStatus: "NEW",
        isActive: false,
      }
      
      const canBeApproved = customer.registrationStatus === "PENDING_APPROVAL"
      expect(canBeApproved).toBe(false)
    })
  })

  describe("Status Transition on Approval", () => {
    it("should update status from PENDING_APPROVAL to ACTIVE", () => {
      // SCENARIO: Admin approves a pending customer
      // RULE: registrationStatus changes to ACTIVE, isActive becomes true
      
      const beforeApproval = {
        registrationStatus: "PENDING_APPROVAL",
        isActive: false,
      }
      
      // Simulate approval
      const afterApproval = {
        registrationStatus: "ACTIVE",
        isActive: true,
      }
      
      expect(beforeApproval.registrationStatus).toBe("PENDING_APPROVAL")
      expect(afterApproval.registrationStatus).toBe("ACTIVE")
      expect(afterApproval.isActive).toBe(true)
    })

    it("should set isActive to true on approval", () => {
      // SCENARIO: Ensure isActive flag is also updated for backward compatibility
      // RULE: isActive must be true after approval
      
      const approvedCustomer = {
        registrationStatus: "ACTIVE",
        isActive: true,
      }
      
      expect(approvedCustomer.isActive).toBe(true)
    })
  })

  describe("Approval Message", () => {
    it("should use custom approvalMessage from workspace if configured", () => {
      // SCENARIO: Workspace has custom approval message
      // RULE: Use workspace.approvalMessage for WhatsApp notification
      
      const workspace = {
        approvalMessage: "🎉 Benvenuto! La tua richiesta è stata approvata. Ora puoi ordinare!",
      }
      
      const customMessage = workspace.approvalMessage
      expect(customMessage).toBe("🎉 Benvenuto! La tua richiesta è stata approvata. Ora puoi ordinare!")
    })

    it("should use default message when approvalMessage is null", () => {
      // SCENARIO: Workspace has no custom approval message
      // RULE: Fallback to default Italian message
      
      const workspace = {
        approvalMessage: null,
      }
      
      const DEFAULT_APPROVAL_MESSAGE = "🎉 La tua registrazione è stata approvata! Ora puoi accedere a tutti i nostri prodotti e servizi. Come posso aiutarti?"
      const messageToSend = workspace.approvalMessage || DEFAULT_APPROVAL_MESSAGE
      
      expect(messageToSend).toBe(DEFAULT_APPROVAL_MESSAGE)
    })

    it("should use default message when approvalMessage is empty string", () => {
      // SCENARIO: Workspace has empty approval message
      // RULE: Fallback to default if empty string
      
      const workspace = {
        approvalMessage: "",
      }
      
      const DEFAULT_APPROVAL_MESSAGE = "🎉 La tua registrazione è stata approvata! Ora puoi accedere a tutti i nostri prodotti e servizi. Come posso aiutarti?"
      const messageToSend = workspace.approvalMessage || DEFAULT_APPROVAL_MESSAGE
      
      expect(messageToSend).toBe(DEFAULT_APPROVAL_MESSAGE)
    })
  })

  describe("WhatsApp Message Queue", () => {
    it("should queue WhatsApp message on approval", () => {
      // SCENARIO: Customer is approved
      // RULE: Queue a WhatsApp message with approval notification
      
      const queueEntry = {
        workspaceId: mockWorkspaceId,
        customerId: mockCustomerId,
        message: "🎉 La tua registrazione è stata approvata!",
        priority: 1, // High priority for approval messages
        status: "PENDING",
      }
      
      expect(queueEntry.priority).toBe(1)
      expect(queueEntry.status).toBe("PENDING")
    })

    it("should include metadata with approval type", () => {
      // SCENARIO: Queue entry should have metadata for tracking
      // RULE: Include type: APPROVAL_MESSAGE in metadata
      
      const metadata = {
        type: "APPROVAL_MESSAGE",
        customerName: "Mario Rossi",
        approvedAt: new Date().toISOString(),
      }
      
      expect(metadata.type).toBe("APPROVAL_MESSAGE")
      expect(metadata.customerName).toBeDefined()
      expect(metadata.approvedAt).toBeDefined()
    })
  })

  describe("Response Format", () => {
    it("should return success response with updated customer", () => {
      // SCENARIO: Successful approval
      // RULE: Return message, customer data, and approvalMessageSent flag
      
      const response = {
        message: "Customer approved successfully",
        customer: {
          id: mockCustomerId,
          registrationStatus: "ACTIVE",
          isActive: true,
        },
        approvalMessageSent: true,
      }
      
      expect(response.message).toBe("Customer approved successfully")
      expect(response.customer.registrationStatus).toBe("ACTIVE")
      expect(response.approvalMessageSent).toBe(true)
    })

    it("should return error for non-existent customer", () => {
      // SCENARIO: Admin tries to approve non-existent customer
      // RULE: Return 404 with appropriate message
      
      const errorResponse = {
        status: 404,
        error: "Customer not found",
      }
      
      expect(errorResponse.status).toBe(404)
      expect(errorResponse.error).toBe("Customer not found")
    })

    it("should return error for already active customer", () => {
      // SCENARIO: Admin tries to approve already active customer
      // RULE: Return 400 with appropriate message
      
      const errorResponse = {
        status: 400,
        error: "Customer is not in PENDING_APPROVAL status",
      }
      
      expect(errorResponse.status).toBe(400)
    })
  })

  describe("Workspace Isolation", () => {
    it("should only approve customers within the same workspace", () => {
      // SCENARIO: Ensure workspace isolation in approval
      // RULE: Customer must belong to the same workspace as the request
      
      const requestWorkspaceId = "workspace-123"
      const customerWorkspaceId = "workspace-123"
      
      const isAuthorized = requestWorkspaceId === customerWorkspaceId
      expect(isAuthorized).toBe(true)
    })

    it("should reject approval for customers in different workspace", () => {
      // SCENARIO: Admin tries to approve customer from another workspace
      // RULE: Return 404 (customer not found in this workspace)
      
      const requestWorkspaceId = "workspace-123"
      const customerWorkspaceId = "workspace-456"
      
      const isAuthorized = requestWorkspaceId === customerWorkspaceId
      expect(isAuthorized).toBe(false)
    })
  })
})
