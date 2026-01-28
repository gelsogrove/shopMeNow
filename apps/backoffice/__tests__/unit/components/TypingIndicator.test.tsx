/**
 * Unit Tests: TypingIndicator Component
 * T192 - Shows 3 animated dots while bot is typing
 * 
 * SPEC: TypingIndicator component
 * - Displays 3 bouncing dots
 * - Uses primaryColor for dots
 * - Has staggered animation delays
 * - Matches WhatsApp style
 */

import { render, screen } from "@testing-library/react"
import { TypingIndicator } from "../../../src/components/chat/TypingIndicator"

describe("TypingIndicator Component", () => {
  describe("Rendering", () => {
    it("should render 3 dots", () => {
      const { container } = render(<TypingIndicator />)
      
      const dots = container.querySelectorAll(".animate-bounce")
      expect(dots).toHaveLength(3)
    })

    it("should use default green color when primaryColor not provided", () => {
      const { container } = render(<TypingIndicator />)
      
      const firstDot = container.querySelector(".animate-bounce")
      expect(firstDot).toHaveStyle({ backgroundColor: "#22c55e" })
    })

    it("should use custom primaryColor when provided", () => {
      const customColor = "#ff0000"
      const { container} = render(<TypingIndicator primaryColor={customColor} />)
      
      const firstDot = container.querySelector(".animate-bounce")
      expect(firstDot).toHaveStyle({ backgroundColor: customColor })
    })
  })

  describe("Animation", () => {
    it("should have staggered animation delays", () => {
      const { container } = render(<TypingIndicator />)
      
      const dots = container.querySelectorAll(".animate-bounce")
      
      // First dot: no delay
      expect(dots[0]).toHaveStyle({ animationDelay: "0ms" })
      
      // Second dot: 150ms delay
      expect(dots[1]).toHaveStyle({ animationDelay: "150ms" })
      
      // Third dot: 300ms delay
      expect(dots[2]).toHaveStyle({ animationDelay: "300ms" })
    })

    it("should have consistent animation duration", () => {
      const { container } = render(<TypingIndicator />)
      
      const dots = container.querySelectorAll(".animate-bounce")
      
      dots.forEach((dot) => {
        expect(dot).toHaveStyle({ animationDuration: "1s !important" })
      })
    })
  })

  describe("Styling", () => {
    it("should have correct container styling", () => {
      const { container } = render(<TypingIndicator />)
      
      const wrapper = container.firstChild as HTMLElement
      
      expect(wrapper).toHaveClass("flex", "items-center", "gap-1")
      expect(wrapper).toHaveClass("p-3")
      expect(wrapper).toHaveClass("bg-white")
      expect(wrapper).toHaveClass("rounded-2xl", "rounded-bl-md")
      expect(wrapper).toHaveClass("border", "border-slate-200")
      expect(wrapper).toHaveClass("shadow-sm")
    })

    it("should have correct dot sizing", () => {
      const { container } = render(<TypingIndicator />)
      
      const dots = container.querySelectorAll(".animate-bounce")
      
      dots.forEach((dot) => {
        expect(dot).toHaveClass("w-2", "h-2")
        expect(dot).toHaveClass("rounded-full")
      })
    })
  })

  describe("Color Variations", () => {
    it("should work with different color formats", () => {
      const colors = ["#22c55e", "#0000ff", "rgb(255, 0, 0)", "rgba(0, 255, 0, 0.5)"]
      
      colors.forEach((color) => {
        const { container } = render(<TypingIndicator primaryColor={color} />)
        const firstDot = container.querySelector(".animate-bounce")
        expect(firstDot).toHaveStyle({ backgroundColor: color })
      })
    })
  })
})
