/**
 * FlowJsonValidator Unit Tests
 *
 * WHAT: Tests the JSON validation logic for FlowNodeConfig.flows structure.
 * WHY: Invalid flow JSON can break FlowEngineService at runtime.
 *      Validator catches errors BEFORE saving to database.
 *
 * PRINCIPLE: Pure logic — no mocks needed (no I/O).
 */

import { FlowJsonValidator, FlowValidationResult } from "../../../src/application/services/flow-json-validator.service"

// ---------------------------------------------------------------------------
// Shared valid flow — all rules pass
// ---------------------------------------------------------------------------
const VALID_FLOWS = {
  non_parte: {
    step_0: {
      type: "CHOICE",
      prompt: "What do you see?\n\n1️⃣ SEL\n2️⃣ PUSH\n3️⃣ door",
      transitions: {
        "1": "non_parte.caso_sel",
        "2": "non_parte.caso_push",
        "3": "non_parte.caso_door",
      },
    },
    caso_sel: {
      type: "INFO",
      prompt: "SEL means select a program. Press any button.",
      isTerminal: true,
    },
    caso_push: {
      type: "INFO",
      prompt: "Credit inserted. Press a program button.",
      isTerminal: true,
    },
    caso_door: {
      type: "ACTION",
      prompt: "Close the door firmly.",
      transitions: { default: "non_parte.ask_resolved" },
    },
    ask_resolved: {
      type: "CONFIRMATION",
      prompt: "Did that solve the problem? (yes / no)",
      transitions: {
        YES: "non_parte.end_success",
        NO: "non_parte.end_escalate",
      },
    },
    end_success: {
      type: "INFO",
      prompt: "Great! Enjoy your wash 👍",
      isTerminal: true,
    },
    end_escalate: {
      type: "INFO",
      prompt: "Contacting an operator for you.",
      isTerminal: true,
    },
  },
}

describe("FlowJsonValidator", () => {
  let validator: FlowJsonValidator

  beforeEach(() => {
    validator = new FlowJsonValidator()
  })

  // ========================================================================
  // SCENARIO: Valid flows pass without errors
  // ========================================================================
  describe("valid flows", () => {
    it("should validate a correct flow without errors", () => {
      // RULE: A well-formed flow with step_0, valid types, valid transitions, and terminal nodes passes
      const result = validator.validate(VALID_FLOWS)

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
      expect(result.stats.totalFlows).toBe(1)
      expect(result.stats.totalNodes).toBe(7)
      expect(result.stats.terminalNodes).toBe(4)
      expect(result.stats.choiceNodes).toBe(1)
    })

    it("should handle multiple flows in one config", () => {
      // RULE: Multiple flows are validated independently — each must have step_0
      const multiFlows = {
        flow_a: {
          step_0: {
            type: "INFO",
            prompt: "Welcome to flow A",
            isTerminal: true,
          },
        },
        flow_b: {
          step_0: {
            type: "INFO",
            prompt: "Welcome to flow B",
            isTerminal: true,
          },
        },
      }

      const result = validator.validate(multiFlows)
      expect(result.valid).toBe(true)
      expect(result.stats.totalFlows).toBe(2)
      expect(result.stats.totalNodes).toBe(2)
    })

    it("should allow cross-flow transitions", () => {
      // RULE: Transitions can reference nodes in OTHER flows (e.g., "flow_b.step_0")
      const crossFlows = {
        entry: {
          step_0: {
            type: "CHOICE",
            prompt: "Pick a flow:\n1️⃣ Door problem\n2️⃣ Noise problem",
            transitions: {
              "1": "door_flow.step_0",
              "2": "noise_flow.step_0",
            },
          },
        },
        door_flow: {
          step_0: {
            type: "INFO",
            prompt: "Close the door firmly.",
            isTerminal: true,
          },
        },
        noise_flow: {
          step_0: {
            type: "INFO",
            prompt: "Check for foreign objects in the drum.",
            isTerminal: true,
          },
        },
      }

      const result = validator.validate(crossFlows)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })
  })

  // ========================================================================
  // SCENARIO: Root-level validation errors
  // ========================================================================
  describe("root-level validation", () => {
    it("should reject null", () => {
      const result = validator.validate(null)
      expect(result.valid).toBe(false)
      expect(result.errors[0].message).toContain("non-empty JSON object")
    })

    it("should reject undefined", () => {
      const result = validator.validate(undefined)
      expect(result.valid).toBe(false)
      expect(result.errors[0].message).toContain("non-empty JSON object")
    })

    it("should reject arrays", () => {
      const result = validator.validate([{ step_0: {} }])
      expect(result.valid).toBe(false)
      expect(result.errors[0].message).toContain("non-empty JSON object")
    })

    it("should reject empty object", () => {
      const result = validator.validate({})
      expect(result.valid).toBe(false)
      expect(result.errors[0].message).toContain("at least one flow")
    })

    it("should reject non-object flow values", () => {
      // RULE: Each flow must be a JSON object, not a string or number
      const result = validator.validate({ myflow: "not an object" })
      expect(result.valid).toBe(false)
      expect(result.errors[0].message).toContain("must be a JSON object")
    })
  })

  // ========================================================================
  // SCENARIO: Missing step_0 entry node
  // ========================================================================
  describe("step_0 requirement", () => {
    it("should reject flow without step_0", () => {
      // RULE: Every flow MUST have a "step_0" entry node — it's the starting point
      const flows = {
        my_flow: {
          step_1: {
            type: "INFO",
            prompt: "Some info",
            isTerminal: true,
          },
        },
      }

      const result = validator.validate(flows)
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.message.includes("step_0"))).toBe(true)
    })
  })

  // ========================================================================
  // SCENARIO: Node type validation
  // ========================================================================
  describe("node type validation", () => {
    it("should reject node without type", () => {
      // RULE: Every node MUST have a "type" field
      const flows = {
        f: {
          step_0: {
            prompt: "Hello",
            isTerminal: true,
          },
        },
      }

      const result = validator.validate(flows)
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.message.includes('missing required field "type"'))).toBe(true)
    })

    it("should reject invalid node type", () => {
      // RULE: Type must be one of CHOICE, ACTION, INFO, CONFIRMATION, FREE_TEXT
      const flows = {
        f: {
          step_0: {
            type: "INVALID_TYPE",
            prompt: "Hello",
            isTerminal: true,
          },
        },
      }

      const result = validator.validate(flows)
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.message.includes("invalid type"))).toBe(true)
    })
  })

  // ========================================================================
  // SCENARIO: Prompt validation
  // ========================================================================
  describe("prompt validation", () => {
    it("should reject node without prompt", () => {
      // RULE: Every node MUST have a non-empty "prompt" string
      const flows = {
        f: {
          step_0: {
            type: "INFO",
            isTerminal: true,
          },
        },
      }

      const result = validator.validate(flows)
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.message.includes("empty"))).toBe(true)
    })

    it("should reject empty string prompt", () => {
      const flows = {
        f: {
          step_0: {
            type: "INFO",
            prompt: "",
            isTerminal: true,
          },
        },
      }

      const result = validator.validate(flows)
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.message.includes("empty"))).toBe(true)
    })

    it("should reject whitespace-only prompt", () => {
      const flows = {
        f: {
          step_0: {
            type: "INFO",
            prompt: "   ",
            isTerminal: true,
          },
        },
      }

      const result = validator.validate(flows)
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.message.includes("empty"))).toBe(true)
    })
  })

  // ========================================================================
  // SCENARIO: Transition format validation
  // ========================================================================
  describe("transition validation", () => {
    it("should reject transitions without flowId.nodeId format", () => {
      // RULE: Transition targets MUST use "flowId.nodeId" format (contain a dot)
      const flows = {
        f: {
          step_0: {
            type: "CHOICE",
            prompt: "Pick one:\n1️⃣ Option A",
            transitions: {
              "1": "just_a_node_id",  // Missing flowId prefix
            },
          },
        },
      }

      const result = validator.validate(flows)
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.message.includes("flowId.nodeId"))).toBe(true)
    })

    it("should reject broken links (non-existent target)", () => {
      // RULE: Transition targets MUST reference existing nodes
      const flows = {
        f: {
          step_0: {
            type: "CHOICE",
            prompt: "Pick:\n1️⃣ Option",
            transitions: {
              "1": "f.non_existent_node",
            },
          },
        },
      }

      const result = validator.validate(flows)
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.message.includes("non-existent node"))).toBe(true)
    })

    it("should reject non-string transition targets", () => {
      const flows = {
        f: {
          step_0: {
            type: "CHOICE",
            prompt: "Pick:\n1️⃣ Option",
            transitions: {
              "1": 42,  // Must be string
            },
          },
        },
      }

      const result = validator.validate(flows)
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.message.includes("must be a string"))).toBe(true)
    })
  })

  // ========================================================================
  // SCENARIO: CHOICE node must have transitions
  // ========================================================================
  describe("CHOICE node constraints", () => {
    it("should reject CHOICE node without transitions", () => {
      // RULE: CHOICE nodes MUST have at least one transition
      const flows = {
        f: {
          step_0: {
            type: "CHOICE",
            prompt: "Pick one:\n1️⃣ Option",
            // No transitions!
          },
        },
      }

      const result = validator.validate(flows)
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.message.includes("CHOICE") && e.message.includes("transition"))).toBe(true)
    })

    it("should reject CHOICE node with empty transitions", () => {
      const flows = {
        f: {
          step_0: {
            type: "CHOICE",
            prompt: "Pick one:\n1️⃣ Option",
            transitions: {},
          },
        },
      }

      const result = validator.validate(flows)
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.message.includes("CHOICE") && e.message.includes("transition"))).toBe(true)
    })
  })

  // ========================================================================
  // SCENARIO: Warnings (non-fatal issues)
  // ========================================================================
  describe("warnings", () => {
    it("should warn if terminal node has transitions", () => {
      // RULE: Terminal nodes SHOULD NOT have transitions — they're dead ends
      const flows = {
        f: {
          step_0: {
            type: "INFO",
            prompt: "Done!",
            isTerminal: true,
            transitions: { default: "f.step_0" },  // Useless transition
          },
        },
      }

      const result = validator.validate(flows)
      expect(result.valid).toBe(true)  // Warnings don't fail validation
      expect(result.warnings.length).toBeGreaterThan(0)
      expect(result.warnings.some(w => w.message.includes("Terminal node"))).toBe(true)
    })

    it("should warn if flow has no terminal nodes", () => {
      // RULE: Every flow SHOULD have at least one terminal node (prevents infinite loops)
      const flows = {
        f: {
          step_0: {
            type: "CHOICE",
            prompt: "Pick:\n1️⃣ Loop",
            transitions: {
              "1": "f.step_0",  // Loops back to self — no terminal!
            },
          },
        },
      }

      const result = validator.validate(flows)
      expect(result.valid).toBe(true)  // It's a warning, not error
      expect(result.warnings.some(w => w.message.includes("no terminal"))).toBe(true)
    })

    it("should warn if CONFIRMATION has no YES/NO transitions", () => {
      // RULE: CONFIRMATION nodes SHOULD have YES and/or NO transitions
      const flows = {
        f: {
          step_0: {
            type: "CONFIRMATION",
            prompt: "Confirm?",
            transitions: {
              maybe: "f.end",
            },
          },
          end: {
            type: "INFO",
            prompt: "Done",
            isTerminal: true,
          },
        },
      }

      const result = validator.validate(flows)
      expect(result.valid).toBe(true)  // Warning, valid but suspicious
      expect(result.warnings.some(w => w.message.includes("CONFIRMATION") && w.message.includes("YES"))).toBe(true)
    })
  })

  // ========================================================================
  // SCENARIO: Stats tracking
  // ========================================================================
  describe("stats", () => {
    it("should count flows, nodes, terminals, and choices correctly", () => {
      const result = validator.validate(VALID_FLOWS)

      expect(result.stats.totalFlows).toBe(1)
      expect(result.stats.totalNodes).toBe(7)
      expect(result.stats.terminalNodes).toBe(4) // caso_sel, caso_push, end_success, end_escalate
      expect(result.stats.choiceNodes).toBe(1) // step_0
    })
  })

  // ========================================================================
  // SCENARIO: Schema guide
  // ========================================================================
  describe("getSchemaGuide", () => {
    it("should return schema documentation with rules and example", () => {
      // RULE: Schema guide is a static method — called without instance
      const guide = FlowJsonValidator.getSchemaGuide()

      expect(guide).toBeDefined()
      expect(guide).toHaveProperty("description")
      expect(guide).toHaveProperty("rules")
      expect(guide).toHaveProperty("nodeTypes")
      expect(guide).toHaveProperty("example")
      expect(guide).toHaveProperty("format")
    })
  })

  // ========================================================================
  // SCENARIO: Edge cases
  // ========================================================================
  describe("edge cases", () => {
    it("should handle node with invalid transitions type (array instead of object)", () => {
      const flows = {
        f: {
          step_0: {
            type: "CHOICE",
            prompt: "Pick one",
            transitions: ["f.step_0"],  // Array instead of object
          },
        },
      }

      const result = validator.validate(flows)
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.message.includes("transitions must be a JSON object"))).toBe(true)
    })

    it("should validate isTerminal must be boolean", () => {
      const flows = {
        f: {
          step_0: {
            type: "INFO",
            prompt: "Hello",
            isTerminal: "yes",  // String instead of boolean
          },
        },
      }

      const result = validator.validate(flows)
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.message.includes("isTerminal must be a boolean"))).toBe(true)
    })

    it("should validate onInterruptFallback must be string", () => {
      const flows = {
        f: {
          step_0: {
            type: "INFO",
            prompt: "Hello",
            isTerminal: true,
            onInterruptFallback: 42,  // Number instead of string
          },
        },
      }

      const result = validator.validate(flows)
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.message.includes("onInterruptFallback must be a string"))).toBe(true)
    })

    it("should handle empty flow (no nodes)", () => {
      const flows = {
        f: {},
      }

      const result = validator.validate(flows)
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.message.includes("at least one node"))).toBe(true)
    })
  })
})
