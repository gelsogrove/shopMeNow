/**
 * Test: FeatureGate Component
 * 
 * SCENARIO: Verify FeatureGate correctly blocks/allows access based on plan
 * RULE: Shows loading state while planType is null
 * RULE: Shows upgrade overlay for users without feature access
 * RULE: Renders children for users with feature access
 */

import { describe, it, expect, vi, beforeEach } from "vitest"
import { render, screen } from "@testing-library/react"
import { BrowserRouter } from "react-router-dom"
import React from "react"

// Mock the PLAN_CONFIGS to avoid runtime config issues
vi.mock("@/config/planFeatures", () => ({
  FEATURE_KEYS: {
    CHANNELS: "channels",
    CUSTOMERS: "customers",
    MULTI_LANGUAGE: "multiLanguage",
    ANALYTICS: "analytics",
    TEAM_MEMBERS: "teamMembers",
    BRANDING: "branding",
    INTEGRATIONS: "integrations",
    DEDICATED_SERVER: "dedicatedServer",
  },
  PLAN_CONFIGS: {
    FREE_TRIAL: {
      name: "Free Trial",
      features: [
        { key: "analytics", included: false },
        { key: "channels", included: true },
      ],
    },
    BASIC: {
      name: "Basic",
      features: [
        { key: "analytics", included: false },
        { key: "channels", included: true },
      ],
    },
    PREMIUM: {
      name: "Premium",
      features: [
        { key: "analytics", included: true },
        { key: "channels", included: true },
      ],
    },
    ENTERPRISE: {
      name: "Enterprise",
      features: [
        { key: "analytics", included: true },
        { key: "channels", included: true },
      ],
    },
  },
}))

// Mock useBilling hook
const mockUseBilling = vi.fn()
vi.mock("@/contexts/BillingContext", () => ({
  useBilling: () => mockUseBilling(),
}))

// Import after mocks
import { FeatureGate } from "@/components/shared/FeatureGate"

const TestWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <BrowserRouter>{children}</BrowserRouter>
)

describe("FeatureGate Component", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe("Loading State", () => {
    // SCENARIO: Show loading animation while planType is null
    // RULE: Prevent flash of "upgrade" overlay before plan is loaded
    
    it("should show loading state when isLoadingBalance is true", () => {
      mockUseBilling.mockReturnValue({
        planType: null,
        isLoadingBalance: true,
      })

      render(
        <TestWrapper>
          <FeatureGate feature="ANALYTICS" requiredPlan="PREMIUM">
            <div data-testid="protected-content">Protected Content</div>
          </FeatureGate>
        </TestWrapper>
      )

      // Should show loading skeleton, not content
      expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument()
      // Check for loading animation class
      const loadingElement = document.querySelector(".animate-pulse")
      expect(loadingElement).toBeInTheDocument()
    })

    it("should show loading state when planType is null (even if not loading)", () => {
      mockUseBilling.mockReturnValue({
        planType: null,
        isLoadingBalance: false,
      })

      render(
        <TestWrapper>
          <FeatureGate feature="ANALYTICS" requiredPlan="PREMIUM">
            <div data-testid="protected-content">Protected Content</div>
          </FeatureGate>
        </TestWrapper>
      )

      // Should show loading, not upgrade overlay or content
      expect(screen.queryByTestId("protected-content")).not.toBeInTheDocument()
      const loadingElement = document.querySelector(".animate-pulse")
      expect(loadingElement).toBeInTheDocument()
    })
  })

  describe("Access Control", () => {
    // SCENARIO: User with BASIC plan tries to access Analytics
    // RULE: Should show upgrade overlay
    
    it("should show upgrade overlay for BASIC user accessing Analytics", () => {
      mockUseBilling.mockReturnValue({
        planType: "BASIC",
        isLoadingBalance: false,
      })

      render(
        <TestWrapper>
          <FeatureGate feature="ANALYTICS" requiredPlan="PREMIUM">
            <div data-testid="protected-content">Protected Content</div>
          </FeatureGate>
        </TestWrapper>
      )

      // Content should be blurred, not accessible
      expect(screen.queryByTestId("protected-content")).toBeInTheDocument()
      // Check for upgrade overlay
      expect(screen.getByText("Feature Premium")).toBeInTheDocument()
    })

    it("should show upgrade overlay for FREE_TRIAL user accessing Analytics", () => {
      mockUseBilling.mockReturnValue({
        planType: "FREE_TRIAL",
        isLoadingBalance: false,
      })

      render(
        <TestWrapper>
          <FeatureGate feature="ANALYTICS" requiredPlan="PREMIUM">
            <div data-testid="protected-content">Protected Content</div>
          </FeatureGate>
        </TestWrapper>
      )

      expect(screen.getByText("Feature Premium")).toBeInTheDocument()
    })

    // SCENARIO: User with PREMIUM plan accesses Analytics
    // RULE: Should render children without overlay
    
    it("should render children for PREMIUM user accessing Analytics", () => {
      mockUseBilling.mockReturnValue({
        planType: "PREMIUM",
        isLoadingBalance: false,
      })

      render(
        <TestWrapper>
          <FeatureGate feature="ANALYTICS" requiredPlan="PREMIUM">
            <div data-testid="protected-content">Protected Content</div>
          </FeatureGate>
        </TestWrapper>
      )

      // Content should be visible
      expect(screen.getByTestId("protected-content")).toBeInTheDocument()
      // No upgrade overlay
      expect(screen.queryByText("Feature Premium")).not.toBeInTheDocument()
    })

    it("should render children for ENTERPRISE user accessing Analytics", () => {
      mockUseBilling.mockReturnValue({
        planType: "ENTERPRISE",
        isLoadingBalance: false,
      })

      render(
        <TestWrapper>
          <FeatureGate feature="ANALYTICS" requiredPlan="PREMIUM">
            <div data-testid="protected-content">Protected Content</div>
          </FeatureGate>
        </TestWrapper>
      )

      // ENTERPRISE should have access to Analytics (higher tier)
      expect(screen.getByTestId("protected-content")).toBeInTheDocument()
      expect(screen.queryByText("Feature Premium")).not.toBeInTheDocument()
    })
  })

  describe("Base Features", () => {
    // SCENARIO: Base features should be available to all plans
    // RULE: CHANNELS feature is included in all plans
    
    it("should allow BASIC user to access CHANNELS feature", () => {
      mockUseBilling.mockReturnValue({
        planType: "BASIC",
        isLoadingBalance: false,
      })

      render(
        <TestWrapper>
          <FeatureGate feature="CHANNELS" requiredPlan="BASIC">
            <div data-testid="channels-content">Channels Content</div>
          </FeatureGate>
        </TestWrapper>
      )

      expect(screen.getByTestId("channels-content")).toBeInTheDocument()
      expect(screen.queryByText("Feature Premium")).not.toBeInTheDocument()
    })

    it("should allow FREE_TRIAL user to access CHANNELS feature", () => {
      mockUseBilling.mockReturnValue({
        planType: "FREE_TRIAL",
        isLoadingBalance: false,
      })

      render(
        <TestWrapper>
          <FeatureGate feature="CHANNELS" requiredPlan="BASIC">
            <div data-testid="channels-content">Channels Content</div>
          </FeatureGate>
        </TestWrapper>
      )

      expect(screen.getByTestId("channels-content")).toBeInTheDocument()
    })
  })
})
