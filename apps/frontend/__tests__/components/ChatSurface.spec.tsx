import { render, screen } from "@testing-library/react"
import { describe, it, expect } from "vitest"
import { ChatSurface } from "@/components/chat/ChatSurface"

describe("ChatSurface", () => {
  it("renders links from message content", () => {
    render(
      <ChatSurface
        messages={[
          { id: "1", content: "Visit https://example.com", role: "bot" },
        ]}
      />
    )

    const link = screen.getByRole("link", { name: "https://example.com" })
    expect(link).toHaveAttribute("href", "https://example.com")
  })

  it("renders inline images when img tag is present", () => {
    render(
      <ChatSurface
        messages={[
          {
            id: "2",
            content:
              'Sample product: <img src="https://example.com/test.png" alt="Test Product" />',
            role: "bot",
          },
        ]}
      />
    )

    const image = screen.getByRole("img", { name: "Test Product" })
    expect(image).toBeInTheDocument()
  })

  it("renders bold text from markdown", () => {
    render(
      <ChatSurface
        messages={[
          { id: "3", content: "Hello **bold** text", role: "bot" },
        ]}
      />
    )

    const bold = screen.getByText("bold")
    expect(bold.tagName.toLowerCase()).toBe("strong")
  })
})
