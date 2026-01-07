/**
 * T013: Unit tests for HandlerFactory
 * Test handler creation based on routing path
 */

import { HandlerFactory } from "../../../src/application/factories/handler.factory"
import { RoutingPath } from "../../../src/domain/entities/routing.entity"

describe("HandlerFactory", () => {
  let factory: HandlerFactory

  beforeEach(() => {
    factory = new HandlerFactory()
  })

  describe("createHandler()", () => {
    it("should throw error for SIMPLE path (not yet available in PHASE 2)", () => {
      expect(() => {
        factory.createHandler("SIMPLE")
      }).toThrow("SimpleIntentHandler not yet available in PHASE 2")
    })

    it("should throw error for LLM path (not yet available in PHASE 2)", () => {
      expect(() => {
        factory.createHandler("LLM")
      }).toThrow("LLMIntentHandler not yet available in PHASE 2")
    })

    it("should throw error for FAQ path (not yet implemented)", () => {
      expect(() => {
        factory.createHandler("FAQ")
      }).toThrow("FAQ handler not yet implemented")
    })

    it("should throw error for unknown routing path", () => {
      expect(() => {
        factory.createHandler("UNKNOWN" as RoutingPath)
      }).toThrow("Unknown routing path")
    })
  })

  describe("validateHandler()", () => {
    it("should return true if handler has handle method", () => {
      const mockHandler = {
        handle: jest.fn(),
      }

      const result = factory.validateHandler(mockHandler)

      expect(result).toBe(true)
    })

    it("should return false if handler missing handle method", () => {
      const invalidHandler = {
        someMethod: jest.fn(),
      }

      const result = factory.validateHandler(invalidHandler)

      expect(result).toBe(false)
    })

    it("should return false for null or undefined", () => {
      expect(factory.validateHandler(null)).toBe(false)
      expect(factory.validateHandler(undefined)).toBe(false)
    })

    it("should verify handle is a function", () => {
      const invalidHandler = {
        handle: "not a function",
      }

      const result = factory.validateHandler(invalidHandler)

      expect(result).toBe(false)
    })
  })
})
