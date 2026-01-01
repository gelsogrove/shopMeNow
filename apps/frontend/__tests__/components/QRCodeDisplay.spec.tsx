import { render, screen, waitFor } from "@testing-library/react"
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest"
import { QRCodeDisplay } from "@/components/ui/qr-code"
import { api } from "@/services/api"
import QRCode from "qrcode"

vi.mock("@/services/api", () => ({
  api: {
    get: vi.fn(),
  },
}))

vi.mock("qrcode", () => ({
  default: {
    toDataURL: vi.fn(),
  },
}))

describe("QRCodeDisplay", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  it("shows error when userId is missing", async () => {
    render(<QRCodeDisplay userId={null} />)

    await waitFor(() => {
      expect(screen.getByText("User ID is missing")).toBeInTheDocument()
    })
    expect(api.get).not.toHaveBeenCalled()
  })

  it("renders the QR code image after loading", async () => {
    vi.mocked(api.get).mockResolvedValueOnce({
      data: { otpAuthUrl: "otpauth://test" },
    })
    vi.mocked(QRCode.toDataURL).mockResolvedValueOnce(
      "data:image/png;base64,abc123"
    )

    render(<QRCodeDisplay userId="user-1" />)

    await waitFor(() => {
      expect(api.get).toHaveBeenCalledWith("/auth/2fa/setup", {
        params: { userId: "user-1" },
      })
    })

    await waitFor(() => {
      expect(QRCode.toDataURL).toHaveBeenCalledWith("otpauth://test")
    })

    expect(screen.getByAltText("2FA QR Code")).toHaveAttribute(
      "src",
      "data:image/png;base64,abc123"
    )
  })

  it("shows error when QR code fetch fails", async () => {
    vi.mocked(api.get).mockRejectedValueOnce(new Error("Boom"))

    render(<QRCodeDisplay userId="user-2" />)

    await waitFor(() => {
      expect(screen.getByText("Failed to load QR code")).toBeInTheDocument()
    })
  })
})
