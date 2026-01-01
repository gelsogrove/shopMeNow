import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { ForgotPasswordPage } from "@/pages/ForgotPasswordPage"
import { api } from "@/services/api"

vi.mock("@/services/api", () => ({
  api: {
    post: vi.fn(),
  },
}))

describe("ForgotPasswordPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it("submits email and shows success message", async () => {
    const user = userEvent.setup()
    vi.mocked(api.post).mockResolvedValueOnce({ data: { message: "ok" } })

    render(<ForgotPasswordPage />)

    await user.type(
      screen.getByPlaceholderText("admin@echatbot.ai"),
      "user@test.com"
    )
    await user.click(screen.getByRole("button", { name: /reset password/i }))

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/auth/forgot-password", {
        email: "user@test.com",
      })
    })

    expect(
      screen.getByText(/If this email is registered/i)
    ).toBeInTheDocument()
  })

  it("shows error message when request fails", async () => {
    const user = userEvent.setup()
    vi.mocked(api.post).mockRejectedValueOnce({
      response: { data: { message: "User not found" } },
    })

    render(<ForgotPasswordPage />)

    await user.type(
      screen.getByPlaceholderText("admin@echatbot.ai"),
      "missing@test.com"
    )
    await user.click(screen.getByRole("button", { name: /reset password/i }))

    await waitFor(() => {
      expect(screen.getByText("User not found")).toBeInTheDocument()
    })
  })
})
