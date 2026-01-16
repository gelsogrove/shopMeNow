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
  getOwnerTransactions: vi.fn(),
  upgradePlan: vi.fn(),
  getOwnerBillingOverview: vi.fn(),
  getOwnerSubscriptionStatus: vi.fn(),
  getCurrentInvoice: vi.fn(),
  downloadInvoicePdf: vi.fn(),
  getOwnerInvoices: vi.fn(),
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
      isPaymentConnected: true,
    },
    limits: {
      maxCustomers: 50,
      maxTeamMembers: 0,
      maxChannels: 1,
      messageCost: 0.1,
      orderCost: 1.0,
      lowBalanceThreshold: 5.0,
    },
    usage: {
      productsCount: 10,
      customersCount: 25,
      channelsCount: 0,
      customersPercentage: 50,
      channelsPercentage: 0,
    },
    planConfig: {
      displayName: "Free Trial",
      monthlyFee: 0,
      features: [],
    },
    thresholds: {
      creditMinThreshold: -12,
      lowBalanceThreshold: 5,
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

      expect(
        screen.getByText("Your chatbots are DISABLED", { exact: false })
      ).toBeInTheDocument()
      expect(
        screen.getByText((content) =>
          content.includes("Credit balance is") &&
          content.includes("$-13.00") &&
          content.includes("$-12.00") &&
          content.includes("chatbots will not respond")
        )
      ).toBeInTheDocument()
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
  // PLAN LIMIT ALERT TESTS
  // ===========================================================================

  describe("Plan Limits Alert", () => {
    it("should show limit reached warning when usage hits plan limits", async () => {
      vi.mocked(useBilling).mockReturnValue({
        billingOverview: {
          ...mockBillingOverview,
          usage: {
            ...mockBillingOverview.usage,
            customersCount: 50,
            productsCount: 50,
            channelsCount: 1,
          },
        },
        isLoadingOverview: false,
        refreshOverview: mockRefreshOverview,
        updateBalanceLocally: mockUpdateBalanceLocally,
        creditBalance: 25.0,
        isLoadingBalance: false,
      } as any)

      render(<BillingSection />)

      await waitFor(() => {
        expect(screen.getByText("Plan limits reached")).toBeInTheDocument()
        expect(screen.getByText("Upgrade Plan")).toBeInTheDocument()
        expect(
          screen.getByText(/Customers limit reached \(50\/50\)\./)
        ).toBeInTheDocument()
      })
    })

    it("should not show limit warning when usage is below limits", async () => {
      render(<BillingSection />)

      await waitFor(() => {
        expect(
          screen.queryByText("Plan limits reached")
        ).not.toBeInTheDocument()
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
        expect(screen.getByText("$10")).toBeInTheDocument()
        expect(screen.getByText("$30")).toBeInTheDocument()
        expect(screen.getByText("$50")).toBeInTheDocument()
        expect(screen.getByText("$100")).toBeInTheDocument()
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
