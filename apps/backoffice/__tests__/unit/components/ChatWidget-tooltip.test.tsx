/**
 * Unit Tests: ChatWidget Tooltip Feature
 * T191 - Widget shows tooltip balloon with multilingua support
 * 
 * SPEC: Tooltip balloon appears above widget button
 * - Shows on hover
 * - Has close button (X)
 * - Displays text in customer language (it/en/es/pt)
 * - Has triangle pointer to button
 * - Auto-hides when widget is opened
 */

import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import ChatWidget from "../../../src/components/ChatWidget"

describe("ChatWidget Tooltip Feature", () => {
  const defaultProps = {
    workspaceId: "test-workspace",
    title: "Test Chat",
    debugMode: false,
  }

  beforeEach(() => {
    localStorage.clear()
  })

  describe("Tooltip Display", () => {
    it("should show tooltip on button hover", async () => {
      render(<ChatWidget {...defaultProps} language="en" />)
      
      const widgetButton = screen.getByLabelText("Open chat")
      
      // Initially hidden
      expect(screen.queryByText(/I'm here to help you/i)).not.toBeInTheDocument()
      
      // Show on hover
      fireEvent.mouseEnter(widgetButton)
      
      await waitFor(() => {
        expect(screen.getByText(/I'm here to help you/i)).toBeInTheDocument()
      })
    })

    it("should hide tooltip on mouse leave", async () => {
      render(<ChatWidget {...defaultProps} language="en" />)
      
      const widgetButton = screen.getByLabelText("Open chat")
      
      // Show tooltip
      fireEvent.mouseEnter(widgetButton)
      await waitFor(() => {
        expect(screen.getByText(/I'm here to help you/i)).toBeInTheDocument()
      })
      
      // Hide on leave (with delay)
      fireEvent.mouseLeave(widgetButton)
      
      await waitFor(() => {
        expect(screen.queryByText(/I'm here to help you/i)).not.toBeInTheDocument()
      }, { timeout: 500 })
    })

    it("should hide tooltip when close button clicked", async () => {
      render(<ChatWidget {...defaultProps} language="en" />)
      
      const widgetButton = screen.getByLabelText("Open chat")
      fireEvent.mouseEnter(widgetButton)
      
      await waitFor(() => {
        expect(screen.getByText(/I'm here to help you/i)).toBeInTheDocument()
      })
      
      // Click X button
      const closeButton = screen.getByLabelText("Close tooltip")
      fireEvent.click(closeButton)
      
      await waitFor(() => {
        expect(screen.queryByText(/I'm here to help you/i)).not.toBeInTheDocument()
      })
    })

    it("should hide tooltip when widget is opened", async () => {
      render(<ChatWidget {...defaultProps} language="en" />)
      
      const widgetButton = screen.getByLabelText("Open chat")
      
      // Show tooltip
      fireEvent.mouseEnter(widgetButton)
      await waitFor(() => {
        expect(screen.getByText(/I'm here to help you/i)).toBeInTheDocument()
      })
      
      // Open widget
      fireEvent.click(widgetButton)
      
      // Tooltip should disappear
      await waitFor(() => {
        expect(screen.queryByText(/I'm here to help you/i)).not.toBeInTheDocument()
      })
    })
  })

  describe("Multilingua Support", () => {
    it("should show Italian text when language=it", async () => {
      render(<ChatWidget {...defaultProps} language="it" />)
      
      const widgetButton = screen.getByLabelText("Open chat")
      fireEvent.mouseEnter(widgetButton)
      
      await waitFor(() => {
        expect(screen.getByText(/Ciao! 👋 Sono qui per aiutarti/i)).toBeInTheDocument()
      })
    })

    it("should show English text when language=en", async () => {
      render(<ChatWidget {...defaultProps} language="en" />)
      
      const widgetButton = screen.getByLabelText("Open chat")
      fireEvent.mouseEnter(widgetButton)
      
      await waitFor(() => {
        expect(screen.getByText(/Hello! 👋 I'm here to help you/i)).toBeInTheDocument()
      })
    })

    it("should show Spanish text when language=es", async () => {
      render(<ChatWidget {...defaultProps} language="es" />)
      
      const widgetButton = screen.getByLabelText("Open chat")
      fireEvent.mouseEnter(widgetButton)
      
      await waitFor(() => {
        expect(screen.getByText(/¡Hola! 👋 Estoy aquí para ayudarte/i)).toBeInTheDocument()
      })
    })

    it("should show Portuguese text when language=pt", async () => {
      render(<ChatWidget {...defaultProps} language="pt" />)
      
      const widgetButton = screen.getByLabelText("Open chat")
      fireEvent.mouseEnter(widgetButton)
      
      await waitFor(() => {
        expect(screen.getByText(/Olá! 👋 Estou aqui para ajudá-lo/i)).toBeInTheDocument()
      })
    })

    it("should default to English for unknown language", async () => {
      render(<ChatWidget {...defaultProps} language="de" />)
      
      const widgetButton = screen.getByLabelText("Open chat")
      fireEvent.mouseEnter(widgetButton)
      
      await waitFor(() => {
        expect(screen.getByText(/Hello! 👋 I'm here to help you/i)).toBeInTheDocument()
      })
    })
  })

  describe("Status Indicator", () => {
    it("should show green dot when debugMode=false", () => {
      render(<ChatWidget {...defaultProps} debugMode={false} />)
      
      const statusDot = screen.getByTitle("Online")
      expect(statusDot).toBeInTheDocument()
      expect(statusDot).toHaveStyle({ backgroundColor: "#22c55e !important" })
    })

    it("should show red dot when debugMode=true", () => {
      render(<ChatWidget {...defaultProps} debugMode={true} />)
      
      const statusDot = screen.getByTitle("Debug Mode")
      expect(statusDot).toBeInTheDocument()
      expect(statusDot).toHaveStyle({ backgroundColor: "#ef4444 !important" })
    })
  })

  describe("Widget Button Sizing", () => {
    it("should have correct button dimensions (64x64px)", () => {
      render(<ChatWidget {...defaultProps} />)
      
      const widgetButton = screen.getByLabelText("Open chat")
      
      // Check inline styles
      expect(widgetButton).toHaveStyle({
        width: "64px !important",
        height: "64px !important",
      })
    })

    it("should have larger chat icon (36x36px)", () => {
      render(<ChatWidget {...defaultProps} />)
      
      const chatIcon = screen.getByLabelText("Open chat").querySelector("svg")
      
      expect(chatIcon).toHaveStyle({
        width: "36px !important",
        height: "36px !important",
      })
    })
  })

  describe("Tooltip Positioning", () => {
    it("should position tooltip above button", async () => {
      render(<ChatWidget {...defaultProps} language="en" />)
      
      const widgetButton = screen.getByLabelText("Open chat")
      fireEvent.mouseEnter(widgetButton)
      
      await waitFor(() => {
        const tooltipContainer = screen.getByText(/I'm here to help you/i).closest("div")
        expect(tooltipContainer?.parentElement).toHaveClass("bottom-full")
      })
    })

    it("should have triangle pointer at bottom", async () => {
      render(<ChatWidget {...defaultProps} language="en" />)
      
      const widgetButton = screen.getByLabelText("Open chat")
      fireEvent.mouseEnter(widgetButton)
      
      await waitFor(() => {
        const tooltip = screen.getByText(/I'm here to help you/i).closest("div")
        const triangle = tooltip?.querySelector(".-bottom-2")
        expect(triangle).toBeInTheDocument()
      })
    })
  })
})
