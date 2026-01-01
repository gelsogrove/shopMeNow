import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { MemoryRouter } from "react-router-dom"
import SignupPage from "@/pages/auth/SignupPage"
import { api } from "@/services/api"

const mockNavigate = vi.fn()

vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>(
    "react-router-dom"
  )
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  }
})

vi.mock("@/services/api", () => ({
  api: {
    post: vi.fn(),
  },
}))

describe("SignupPage", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it("submits the signup form and navigates to verify-otp", async () => {
    const originalSetTimeout = global.setTimeout
    const timeoutSpy = vi
      .spyOn(global, "setTimeout")
      .mockImplementation((callback: TimerHandler, delay?: number, ...args: any[]) => {
        if (delay === 2000) {
          return originalSetTimeout(callback as any, 0, ...args)
        }
        return originalSetTimeout(callback as any, delay, ...args)
      })
    const user = userEvent.setup()
    vi.mocked(api.post).mockResolvedValueOnce({
      data: { userId: "user-123" },
    })

    render(
      <MemoryRouter>
        <SignupPage />
      </MemoryRouter>
    )

    await user.type(screen.getByLabelText("First Name"), "Jane")
    await user.type(screen.getByLabelText("Last Name"), "Doe")
    await user.type(
      screen.getByLabelText("Email"),
      "jane.doe@test.com"
    )
    await user.type(screen.getByLabelText("Password"), "Password1!")
    await user.type(
      screen.getByLabelText("Confirm Password"),
      "Password1!"
    )
    await user.click(screen.getByRole("checkbox"))

    await user.click(screen.getByRole("button", { name: /sign up/i }))

    await waitFor(() => {
      expect(api.post).toHaveBeenCalledWith("/auth/register", {
        email: "jane.doe@test.com",
        password: "Password1!",
        confirmPassword: "Password1!",
        firstName: "Jane",
        lastName: "Doe",
        gdprAccepted: true,
      })
    })

    expect(
      screen.getByText(/Registration successful/i)
    ).toBeInTheDocument()

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith(
        "/auth/verify-otp?userId=user-123"
      )
    })
    timeoutSpy.mockRestore()
  })
})
