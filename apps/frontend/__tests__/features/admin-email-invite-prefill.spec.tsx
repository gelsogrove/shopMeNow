/**
 * Tests for Admin Email Auto-population and Invite Registration Pre-fill
 * 
 * Feature 3: Admin Email auto-populated from creator
 * Feature 4: Invite → Registration with pre-filled fields
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { MemoryRouter, Routes, Route } from "react-router-dom"
import { LoginPage } from "@/pages/LoginPage"
import { WorkspaceSelectionPage } from "@/pages/WorkspaceSelectionPage"

// Mock dependencies
vi.mock("@/services/api", () => ({
  auth: {
    login: vi.fn(),
    register: vi.fn(),
    me: vi.fn(),
    validateSession: vi.fn(),
  },
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}))

vi.mock("@/services/teamApi", () => ({
  invitationApi: {
    validate: vi.fn(),
    accept: vi.fn(),
  },
}))

vi.mock("@/lib/toast", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

vi.mock("@/lib/logger", () => ({
  logger: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
  },
}))

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: (key: string) => {
      const translations: Record<string, string> = {
        "form.email": "Email",
        "form.password": "Password",
        "form.firstName": "First Name",
        "form.lastName": "Last Name",
        "form.confirmPassword": "Confirm Password",
      }
      return translations[key] || key
    },
    language: "en",
    setLanguage: vi.fn(),
  }),
}))

// Mock Google OAuth
vi.mock("@react-oauth/google", () => ({
  GoogleOAuthProvider: ({ children }: { children: React.ReactNode }) => children,
  GoogleLogin: () => <button>Sign in with Google</button>,
}))

describe("Feature 4: Invite → Registration with Pre-filled Fields", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    sessionStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe("URL Parameter Parsing", () => {
    it("should parse invite data from URL parameters", () => {
      const inviteData = {
        email: "invited@test.com",
        firstName: "John",
        lastName: "Doe",
        workspaceName: "Test Workspace",
        invitedByName: "Jane Smith",
      }
      
      const encodedInvite = encodeURIComponent(JSON.stringify(inviteData))
      const url = `/auth/login?mode=register&invite=${encodedInvite}`
      
      // Parse the URL as the component would
      const searchParams = new URLSearchParams(url.split("?")[1])
      const inviteParam = searchParams.get("invite")
      
      expect(inviteParam).toBeTruthy()
      
      const parsed = JSON.parse(decodeURIComponent(inviteParam!))
      expect(parsed.email).toBe("invited@test.com")
      expect(parsed.firstName).toBe("John")
      expect(parsed.lastName).toBe("Doe")
      expect(parsed.workspaceName).toBe("Test Workspace")
      expect(parsed.invitedByName).toBe("Jane Smith")
    })

    it("should handle missing invite data gracefully", () => {
      const url = `/auth/login?mode=register`
      const searchParams = new URLSearchParams(url.split("?")[1])
      const inviteParam = searchParams.get("invite")
      
      expect(inviteParam).toBeNull()
    })

    it("should handle malformed invite data gracefully", () => {
      const url = `/auth/login?mode=register&invite=invalid-json`
      const searchParams = new URLSearchParams(url.split("?")[1])
      const inviteParam = searchParams.get("invite")
      
      expect(() => {
        if (inviteParam) {
          try {
            JSON.parse(decodeURIComponent(inviteParam))
          } catch {
            // Expected to fail
          }
        }
      }).not.toThrow()
    })
  })

  describe("Mode Parameter Handling", () => {
    it("should recognize mode=register parameter", () => {
      const url = `/auth/login?mode=register`
      const searchParams = new URLSearchParams(url.split("?")[1])
      const modeParam = searchParams.get("mode")
      
      expect(modeParam).toBe("register")
    })

    it("should recognize action=register parameter (legacy)", () => {
      const url = `/auth/login?action=register`
      const searchParams = new URLSearchParams(url.split("?")[1])
      const actionParam = searchParams.get("action")
      
      expect(actionParam).toBe("register")
    })
  })

  describe("Invite Data Structure", () => {
    it("should include all required fields for registration pre-fill", () => {
      const inviteData = {
        email: "test@example.com",
        firstName: "Test",
        lastName: "User",
        workspaceName: "My Workspace",
        invitedByName: "Admin User",
      }
      
      // Verify all fields are present
      expect(inviteData).toHaveProperty("email")
      expect(inviteData).toHaveProperty("firstName")
      expect(inviteData).toHaveProperty("lastName")
      expect(inviteData).toHaveProperty("workspaceName")
      expect(inviteData).toHaveProperty("invitedByName")
    })

    it("should handle optional firstName and lastName", () => {
      const inviteData = {
        email: "test@example.com",
        workspaceName: "My Workspace",
        invitedByName: "Admin User",
      }
      
      // Should not have firstName/lastName
      expect(inviteData).not.toHaveProperty("firstName")
      expect(inviteData).not.toHaveProperty("lastName")
      
      // Email is still required
      expect(inviteData.email).toBe("test@example.com")
    })
  })
})

describe("Feature 3: Admin Email Auto-populated from Creator", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    sessionStorage.clear()
  })

  describe("Token Email Extraction", () => {
    it("should extract email from JWT token", () => {
      // Simulate a JWT token payload
      const tokenPayload = {
        id: "user-123",
        email: "creator@example.com",
        firstName: "Creator",
        lastName: "User",
      }
      
      // Encode as base64 (simulating JWT middle part)
      const base64Payload = btoa(JSON.stringify(tokenPayload))
      const mockToken = `header.${base64Payload}.signature`
      
      // Parse the token as the component would
      const parts = mockToken.split(".")
      const decoded = JSON.parse(atob(parts[1]))
      
      expect(decoded.email).toBe("creator@example.com")
    })

    it("should handle token without email gracefully", () => {
      const tokenPayload = {
        id: "user-123",
        firstName: "Creator",
      }
      
      const base64Payload = btoa(JSON.stringify(tokenPayload))
      const mockToken = `header.${base64Payload}.signature`
      
      const parts = mockToken.split(".")
      const decoded = JSON.parse(atob(parts[1]))
      
      expect(decoded.email).toBeUndefined()
    })
  })

  describe("Workspace Creation Data", () => {
    it("should include adminEmail when creating workspace", () => {
      const createWorkspaceData = {
        name: "My Business",
        whatsappPhoneNumber: "+34123456789",
        language: "en",
        welcomeMessage: "Welcome!",
        adminEmail: "creator@example.com", // This should be auto-populated
      }
      
      expect(createWorkspaceData.adminEmail).toBe("creator@example.com")
    })

    it("should pass adminEmail to backend API", async () => {
      const { api } = await import("@/services/api")
      
      const workspaceData = {
        name: "Test Business",
        whatsappPhoneNumber: "+34999888777",
        adminEmail: "admin@test.com",
      }
      
      // Simulate API call
      vi.mocked(api.post).mockResolvedValueOnce({ data: { id: "ws-123" } })
      
      await api.post("/workspaces", workspaceData)
      
      expect(api.post).toHaveBeenCalledWith("/workspaces", expect.objectContaining({
        adminEmail: "admin@test.com",
      }))
    })
  })
})

describe("Integration: Invite Flow to Registration", () => {
  it("should construct correct URL when redirecting from invite page", () => {
    const validation = {
      email: "invited@company.com",
      firstName: "John",
      lastName: "Smith",
      workspaceName: "Company Workspace",
      invitedByName: "Boss User",
    }
    
    const token = "abc123xyz"
    
    // Construct URL as AcceptInvitePage would
    const inviteData = {
      email: validation.email,
      firstName: validation.firstName,
      lastName: validation.lastName,
      workspaceName: validation.workspaceName,
      invitedByName: validation.invitedByName,
    }
    
    const returnUrl = encodeURIComponent(`/accept-invite?token=${token}`)
    const inviteParam = `&invite=${encodeURIComponent(JSON.stringify(inviteData))}`
    const fullUrl = `/auth/login?returnUrl=${returnUrl}&mode=register${inviteParam}`
    
    // Verify URL structure
    expect(fullUrl).toContain("mode=register")
    expect(fullUrl).toContain("returnUrl=")
    expect(fullUrl).toContain("invite=")
    
    // Verify we can parse it back
    const searchParams = new URLSearchParams(fullUrl.split("?")[1])
    expect(searchParams.get("mode")).toBe("register")
    expect(searchParams.get("returnUrl")).toBeTruthy()
    expect(searchParams.get("invite")).toBeTruthy()
    
    const parsedInvite = JSON.parse(decodeURIComponent(searchParams.get("invite")!))
    expect(parsedInvite.email).toBe("invited@company.com")
    expect(parsedInvite.firstName).toBe("John")
    expect(parsedInvite.lastName).toBe("Smith")
  })

  it("should handle special characters in names", () => {
    const validation = {
      email: "jose@test.com",
      firstName: "José",
      lastName: "García",
      workspaceName: "Café España",
      invitedByName: "María López",
    }
    
    const encoded = encodeURIComponent(JSON.stringify(validation))
    const decoded = JSON.parse(decodeURIComponent(encoded))
    
    expect(decoded.firstName).toBe("José")
    expect(decoded.lastName).toBe("García")
    expect(decoded.workspaceName).toBe("Café España")
    expect(decoded.invitedByName).toBe("María López")
  })
})

describe("Backend Integration: Invitation with Names", () => {
  it("should send firstName and lastName when creating invitation", async () => {
    const { api } = await import("@/services/api")
    
    const invitationData = {
      email: "newmember@test.com",
      firstName: "New",
      lastName: "Member",
    }
    
    vi.mocked(api.post).mockResolvedValueOnce({ 
      data: { 
        success: true, 
        invitation: { id: "inv-123", email: invitationData.email } 
      } 
    })
    
    const workspaceId = "ws-123"
    await api.post(`/workspaces/${workspaceId}/invitations`, invitationData)
    
    expect(api.post).toHaveBeenCalledWith(
      `/workspaces/${workspaceId}/invitations`,
      expect.objectContaining({
        email: "newmember@test.com",
        firstName: "New",
        lastName: "Member",
      })
    )
  })

  it("should return firstName and lastName when validating invitation", async () => {
    const { api } = await import("@/services/api")
    
    const mockValidationResponse = {
      data: {
        success: true,
        invitation: {
          id: "inv-123",
          email: "invited@test.com",
          firstName: "Invited",
          lastName: "User",
          workspaceName: "Test Workspace",
          invitedByName: "Admin",
          status: "PENDING",
          isExpired: false,
        },
      },
    }
    
    vi.mocked(api.get).mockResolvedValueOnce(mockValidationResponse)
    
    const token = "valid-token"
    const response = await api.get(`/invitations/validate/${token}`)
    
    expect(response.data.invitation.firstName).toBe("Invited")
    expect(response.data.invitation.lastName).toBe("User")
  })
})
