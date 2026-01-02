import { render, screen, waitFor, fireEvent } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach } from "vitest"
import { BillingSection } from "@/components/billing/BillingSection"

// Mock contexts
const mockRefreshOverview = vi.fn()
const mockUpdateBalanceLocally = vi.fn()

vi.mock("@/contexts/BillingContext", () => ({
  useBilling: vi.fn(),
}))

vi.mock("@/contexts/WorkspaceContext", () => ({
  useWorkspace: vi.fn(() => ({
    workspace: { id: "workspace-123" },
  })),
}))

vi.mock("@/hooks/useWorkspaceRole", () => ({
  useWorkspaceRole: vi.fn(() => ({
    isSuperAdmin: true,
  })),
}))

vi.mock("@/services/subscriptionBillingApi", () => ({
  formatCurrency: (value: number) =>
    value !== undefined && value !== null ? `$${value.toFixed(2)}` : "$0.00",
  getTransactionTypeInfo: vi.fn(() => ({ icon: "💰", label: "Message" })),
  rechargeCredit: vi.fn(),
  getTransactions: vi.fn(),
  upgradePlan: vi.fn(),
  getBillingOverview: vi.fn(),
}))

vi.mock("@/lib/toast", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

import { useBilling } from "@/contexts/BillingContext"

describe("BillingSection", () => {
  const mockBillingOverview = {
    billing: {
      planType: "FREE_TRIAL",
      creditBalance: 25.0,
      isTrialExpired: false,
      daysUntilTrialExpires: 10,
      nextBillingDate: null,
    },
    limits: {
      maxProducts: 50,
      maxCustomers: 50,
      maxChannels: 1,
      messageCost: 0.1,
      orderCost: 1.0,
      lowBalanceThreshold: 5.0,
    },
    usage: {
      productsCount: 10,
      customersCount: 25,
      channelsCount: 1,
      productsPercentage: 20,
      customersPercentage: 50,
      channelsPercentage: 100,
    },
    planConfig: {
      displayName: "Free Trial",
      monthlyFee: 0,
      features: [],
    },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useBilling).mockReturnValue({
      billingOverview: mockBillingOverview,
      isLoadingOverview: false,
      refreshOverview: mockRefreshOverview,
      updateBalanceLocally: mockUpdateBalanceLocally,
      creditBalance: 25.0,
      isLoadingBalance: false,
    } as any)
  })

  // ===========================================================================
  // NOTE: Usage Limits Display tests removed - now in separate UsageLimitsCard component
  // ===========================================================================

  // ===========================================================================
  // CREDIT WARNINGS TESTS
  // ===========================================================================

  describe("Credit Warnings", () => {
    it("should NOT show warning when credit is sufficient ($25)", async () => {
      render(<BillingSection />)

      await waitFor(() => {
        expect(
          screen.queryByText("Your chatbots are DISABLED")
        ).not.toBeInTheDocument()
        expect(
          screen.queryByText("Low credit warning")
        ).not.toBeInTheDocument()
      })
    })

    it("should show LOW CREDIT warning when below threshold ($3 < $5)", async () => {
      vi.mocked(useBilling).mockReturnValue({
        billingOverview: {
          ...mockBillingOverview,
          billing: {
            ...mockBillingOverview.billing,
            creditBalance: 3.0,
          },
        },
        isLoadingOverview: false,
        refreshOverview: mockRefreshOverview,
        updateBalanceLocally: mockUpdateBalanceLocally,
        creditBalance: 3.0,
        isLoadingBalance: false,
      } as any)

      render(<BillingSection />)

      await waitFor(() => {
        expect(screen.getByText("Low credit warning")).toBeInTheDocument()
        expect(
          screen.getByText(/Only ~\d+ messages remaining/)
        ).toBeInTheDocument()
      })
    })

    it("should show CRITICAL warning when credit is below -$12", async () => {
      vi.mocked(useBilling).mockReturnValue({
        billingOverview: {
          ...mockBillingOverview,
          billing: {
            ...mockBillingOverview.billing,
            creditBalance: -13,
          },
        },
        isLoadingOverview: false,
        refreshOverview: mockRefreshOverview,
        updateBalanceLocally: mockUpdateBalanceLocally,
        creditBalance: -13,
        isLoadingBalance: false,
      } as any)

      render(<BillingSection />)

      await waitFor(() => {
        expect(
          screen.getByText("⚠️ Your chatbots are DISABLED")
        ).toBeInTheDocument()
        expect(
          screen.getByText(
            /Credit balance is \$-13.00 \(below -\$12.00 threshold\). Your chatbots will not respond/
          )
        ).toBeInTheDocument()
      })
    })

    it("should show Recharge Now button when credit is below -$12", async () => {
      vi.mocked(useBilling).mockReturnValue({
        billingOverview: {
          ...mockBillingOverview,
          billing: {
            ...mockBillingOverview.billing,
            creditBalance: -13,
          },
        },
        isLoadingOverview: false,
        refreshOverview: mockRefreshOverview,
        updateBalanceLocally: mockUpdateBalanceLocally,
        creditBalance: -13,
        isLoadingBalance: false,
      } as any)

      render(<BillingSection />)

      await waitFor(() => {
        expect(screen.getByText("Recharge Now")).toBeInTheDocument()
      })
    })
  })

  // ===========================================================================
  // TRIAL EXPIRED TESTS
  // ===========================================================================

  describe("Trial Expired State", () => {
    it("should show trial expired warning with DISABLED message", async () => {
      vi.mocked(useBilling).mockReturnValue({
        billingOverview: {
          ...mockBillingOverview,
          billing: {
            ...mockBillingOverview.billing,
            isTrialExpired: true,
            daysUntilTrialExpires: null,
          },
        },
        isLoadingOverview: false,
        refreshOverview: mockRefreshOverview,
        updateBalanceLocally: mockUpdateBalanceLocally,
        creditBalance: 0,
        isLoadingBalance: false,
      } as any)

      render(<BillingSection />)

      await waitFor(() => {
        expect(
          screen.getByText("⚠️ Your trial has expired - Chatbot is DISABLED")
        ).toBeInTheDocument()
      })
    })

    it("should show Choose a Plan button when trial expired", async () => {
      vi.mocked(useBilling).mockReturnValue({
        billingOverview: {
          ...mockBillingOverview,
          billing: {
            ...mockBillingOverview.billing,
            isTrialExpired: true,
          },
        },
        isLoadingOverview: false,
        refreshOverview: mockRefreshOverview,
        updateBalanceLocally: mockUpdateBalanceLocally,
        creditBalance: 0,
        isLoadingBalance: false,
      } as any)

      render(<BillingSection />)

      await waitFor(() => {
        expect(screen.getByText("Choose a Plan")).toBeInTheDocument()
      })
    })
  })

  // ===========================================================================
  // RECHARGE DIALOG TESTS
  // ===========================================================================

  describe("Recharge Dialog", () => {
    it("should open recharge dialog when button clicked", async () => {
      render(<BillingSection />)

      // Wait for component to load and click the Recharge Credit button
      await waitFor(() => {
        const rechargeButtons = screen.getAllByRole("button", { name: /Recharge Credit/i })
        fireEvent.click(rechargeButtons[0])
      })

      await waitFor(() => {
        // Check for preset amounts in the dialog
        expect(screen.getByText("$12")).toBeInTheDocument()
        expect(screen.getByText("$29")).toBeInTheDocument()
        expect(screen.getByText("$59")).toBeInTheDocument()
        expect(screen.getByText("$118")).toBeInTheDocument()
      })
    })
  })

  // ===========================================================================
  // LOADING STATE TESTS
  // ===========================================================================

  describe("Loading State", () => {
    it("should show loader when loading overview", async () => {
      vi.mocked(useBilling).mockReturnValue({
        billingOverview: null,
        isLoadingOverview: true,
        refreshOverview: mockRefreshOverview,
        updateBalanceLocally: mockUpdateBalanceLocally,
        creditBalance: 0,
        isLoadingBalance: true,
      } as any)

      render(<BillingSection />)

      await waitFor(() => {
        expect(document.querySelector(".animate-spin")).toBeInTheDocument()
      })
    })
  })
})
