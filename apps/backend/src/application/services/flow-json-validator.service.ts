/**
 * FlowJsonValidator — validates FlowNodeConfig.flows JSON structure
 *
 * Ensures flow JSON conforms to the standard schema BEFORE saving to DB.
 * Prevents corrupt JSON from reaching FlowEngineService at runtime.
 *
 * Schema rules:
 * 1. Root must be a non-empty object { flowId: { nodeId: FlowNode } }
 * 2. Every flow MUST have a "step_0" entry node
 * 3. Every node MUST have "type" (CHOICE|ACTION|INFO|CONFIRMATION|FREE_TEXT) and "prompt" (non-empty)
 * 4. Transition targets MUST use "flowId.nodeId" format
 * 5. Transition targets MUST reference existing nodes
 * 6. Terminal nodes (isTerminal:true) SHOULD NOT have transitions
 * 7. CHOICE nodes MUST have at least one transition
 * 8. CONFIRMATION nodes MUST have YES and/or NO transitions
 * 9. Every flow MUST have at least one terminal node (prevents infinite loops)
 *
 * @architecture Pure validation — no I/O, no database, fully testable
 */

import { FlowNodeType } from "../../types/flow.types"

const VALID_NODE_TYPES: FlowNodeType[] = ["CHOICE", "ACTION", "INFO", "CONFIRMATION", "FREE_TEXT"]

export interface FlowValidationError {
  path: string
  message: string
  severity: "error" | "warning"
}

export interface FlowValidationResult {
  valid: boolean
  errors: FlowValidationError[]
  warnings: FlowValidationError[]
  stats: {
    totalFlows: number
    totalNodes: number
    terminalNodes: number
    choiceNodes: number
  }
}

export class FlowJsonValidator {
  /**
   * Validate a complete flows JSON object.
   * Returns { valid, errors, warnings, stats }.
   */
  validate(flows: unknown): FlowValidationResult {
    const errors: FlowValidationError[] = []
    const warnings: FlowValidationError[] = []
    let totalNodes = 0
    let terminalNodes = 0
    let choiceNodes = 0

    // Rule: Root must be a non-null object
    if (!flows || typeof flows !== "object" || Array.isArray(flows)) {
      errors.push({
        path: "flows",
        message: "flows must be a non-empty JSON object",
        severity: "error",
      })
      return { valid: false, errors, warnings, stats: { totalFlows: 0, totalNodes: 0, terminalNodes: 0, choiceNodes: 0 } }
    }

    const flowMap = flows as Record<string, unknown>
    const flowIds = Object.keys(flowMap)

    // Rule: At least one flow
    if (flowIds.length === 0) {
      errors.push({
        path: "flows",
        message: "flows must contain at least one flow definition",
        severity: "error",
      })
      return { valid: false, errors, warnings, stats: { totalFlows: 0, totalNodes: 0, terminalNodes: 0, choiceNodes: 0 } }
    }

    // Collect ALL nodeIds for cross-reference validation
    const allNodeIds = new Set<string>()
    for (const flowId of flowIds) {
      const flow = flowMap[flowId]
      if (flow && typeof flow === "object" && !Array.isArray(flow)) {
        for (const nodeId of Object.keys(flow as Record<string, unknown>)) {
          allNodeIds.add(`${flowId}.${nodeId}`)
        }
      }
    }

    // Validate each flow
    for (const flowId of flowIds) {
      const flow = flowMap[flowId]
      const flowPath = `flows.${flowId}`

      // Rule: Each flow must be a non-null object
      if (!flow || typeof flow !== "object" || Array.isArray(flow)) {
        errors.push({
          path: flowPath,
          message: `Flow "${flowId}" must be a JSON object containing nodes`,
          severity: "error",
        })
        continue
      }

      const nodes = flow as Record<string, unknown>
      const nodeIds = Object.keys(nodes)

      if (nodeIds.length === 0) {
        errors.push({
          path: flowPath,
          message: `Flow "${flowId}" must contain at least one node`,
          severity: "error",
        })
        continue
      }

      // Rule: Every flow MUST have a "step_0" entry node
      if (!nodeIds.includes("step_0")) {
        errors.push({
          path: flowPath,
          message: `Flow "${flowId}" must have a "step_0" entry node`,
          severity: "error",
        })
      }

      let flowHasTerminal = false

      // Validate each node
      for (const nodeId of nodeIds) {
        const node = nodes[nodeId]
        const nodePath = `${flowPath}.${nodeId}`
        totalNodes++

        if (!node || typeof node !== "object" || Array.isArray(node)) {
          errors.push({
            path: nodePath,
            message: `Node "${nodeId}" must be a JSON object`,
            severity: "error",
          })
          continue
        }

        const nodeObj = node as Record<string, unknown>

        // Rule: "type" is REQUIRED and must be one of the valid types
        if (!nodeObj.type) {
          errors.push({
            path: `${nodePath}.type`,
            message: `Node "${flowId}.${nodeId}" is missing required field "type"`,
            severity: "error",
          })
        } else if (!VALID_NODE_TYPES.includes(nodeObj.type as FlowNodeType)) {
          errors.push({
            path: `${nodePath}.type`,
            message: `Node "${flowId}.${nodeId}" has invalid type "${nodeObj.type}". Valid types: ${VALID_NODE_TYPES.join(", ")}`,
            severity: "error",
          })
        }

        // Rule: "prompt" is REQUIRED and must be non-empty string
        if (!nodeObj.prompt || typeof nodeObj.prompt !== "string" || nodeObj.prompt.trim() === "") {
          errors.push({
            path: `${nodePath}.prompt`,
            message: `Node "${flowId}.${nodeId}" is missing or has empty "prompt"`,
            severity: "error",
          })
        }

        // Track terminal nodes
        if (nodeObj.isTerminal === true) {
          terminalNodes++
          flowHasTerminal = true
        }

        // Track choice nodes
        if (nodeObj.type === "CHOICE") {
          choiceNodes++
        }

        // Validate transitions
        if (nodeObj.transitions !== undefined) {
          if (typeof nodeObj.transitions !== "object" || Array.isArray(nodeObj.transitions) || nodeObj.transitions === null) {
            errors.push({
              path: `${nodePath}.transitions`,
              message: `Node "${flowId}.${nodeId}" transitions must be a JSON object`,
              severity: "error",
            })
          } else {
            const transitions = nodeObj.transitions as Record<string, unknown>

            // Rule: Terminal nodes SHOULD NOT have transitions
            if (nodeObj.isTerminal === true && Object.keys(transitions).length > 0) {
              warnings.push({
                path: `${nodePath}.transitions`,
                message: `Terminal node "${flowId}.${nodeId}" has transitions that will never be used`,
                severity: "warning",
              })
            }

            // Validate each transition target
            for (const [transKey, target] of Object.entries(transitions)) {
              if (typeof target !== "string") {
                errors.push({
                  path: `${nodePath}.transitions.${transKey}`,
                  message: `Transition "${transKey}" in "${flowId}.${nodeId}" must be a string (target nodeId)`,
                  severity: "error",
                })
                continue
              }

              // Rule: Transition targets MUST use "flowId.nodeId" format
              if (!target.includes(".")) {
                errors.push({
                  path: `${nodePath}.transitions.${transKey}`,
                  message: `Transition "${transKey}" target "${target}" must use "flowId.nodeId" format (e.g., "${flowId}.${target}")`,
                  severity: "error",
                })
              }
              // Rule: Transition targets MUST reference existing nodes
              else if (!allNodeIds.has(target)) {
                errors.push({
                  path: `${nodePath}.transitions.${transKey}`,
                  message: `Transition "${transKey}" in "${flowId}.${nodeId}" references non-existent node "${target}"`,
                  severity: "error",
                })
              }
            }
          }
        }

        // Rule: CHOICE nodes MUST have at least one transition
        if (nodeObj.type === "CHOICE") {
          const transitions = nodeObj.transitions as Record<string, unknown> | undefined
          if (!transitions || Object.keys(transitions).length === 0) {
            errors.push({
              path: `${nodePath}.transitions`,
              message: `CHOICE node "${flowId}.${nodeId}" must have at least one transition`,
              severity: "error",
            })
          }
        }

        // Rule: CONFIRMATION nodes SHOULD have YES and/or NO transitions
        if (nodeObj.type === "CONFIRMATION") {
          const transitions = nodeObj.transitions as Record<string, unknown> | undefined
          if (transitions) {
            const hasYes = "YES" in transitions
            const hasNo = "NO" in transitions
            if (!hasYes && !hasNo) {
              warnings.push({
                path: `${nodePath}.transitions`,
                message: `CONFIRMATION node "${flowId}.${nodeId}" should have YES and/or NO transitions`,
                severity: "warning",
              })
            }
          }
        }

        // Validate onInterruptFallback if present
        if (nodeObj.onInterruptFallback !== undefined && typeof nodeObj.onInterruptFallback !== "string") {
          errors.push({
            path: `${nodePath}.onInterruptFallback`,
            message: `Node "${flowId}.${nodeId}" onInterruptFallback must be a string`,
            severity: "error",
          })
        }

        // Validate isTerminal if present
        if (nodeObj.isTerminal !== undefined && typeof nodeObj.isTerminal !== "boolean") {
          errors.push({
            path: `${nodePath}.isTerminal`,
            message: `Node "${flowId}.${nodeId}" isTerminal must be a boolean`,
            severity: "error",
          })
        }
      }

      // Rule: Every flow MUST have at least one terminal node
      if (!flowHasTerminal) {
        warnings.push({
          path: flowPath,
          message: `Flow "${flowId}" has no terminal nodes — this may cause infinite loops`,
          severity: "warning",
        })
      }
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      stats: {
        totalFlows: flowIds.length,
        totalNodes,
        terminalNodes,
        choiceNodes,
      },
    }
  }

  /**
   * Returns the flow JSON schema documentation as structured text.
   * Useful for API responses and admin UI guidance.
   */
  static getSchemaGuide(): object {
    return {
      description: "Flow JSON schema for FlowNodeConfig.flows",
      format: {
        "<flowId>": {
          "step_0": {
            type: "CHOICE | ACTION | INFO | CONFIRMATION | FREE_TEXT (REQUIRED)",
            prompt: "Message displayed to the customer (REQUIRED, non-empty string)",
            transitions: {
              "<key>": "flowId.nodeId — target node reference (REQUIRED format: contains dot)",
              _notes: [
                "CHOICE: keys are '1', '2', '3'... (numbered options)",
                "CONFIRMATION: keys are 'YES' and 'NO'",
                "ACTION: key is 'default' (advances on any input)",
                "INFO with isTerminal:true: no transitions needed",
              ],
            },
            isTerminal: "boolean (optional) — true = end of flow, no more questions",
            onInterruptFallback: "string (optional) — shown if customer goes off-topic during this node",
          },
        },
      },
      rules: [
        "Every flow MUST have a 'step_0' entry node",
        "Every node MUST have 'type' and 'prompt'",
        "Transition targets use 'flowId.nodeId' format (e.g., 'non_parte.caso_sel')",
        "All transition targets MUST reference existing nodes (no broken links)",
        "CHOICE nodes MUST have at least one transition",
        "Every flow SHOULD have at least one terminal node",
      ],
      nodeTypes: {
        CHOICE: "Presents numbered options — customer replies with a number",
        ACTION: "Gives an instruction — any response advances via 'default' transition",
        CONFIRMATION: "Yes/No question — transitions on 'YES' or 'NO'",
        INFO: "Displays information — if isTerminal:true, ends flow; otherwise uses 'default' transition",
        FREE_TEXT: "Accepts free text — passed to LLM for classification (advanced)",
      },
      example: {
        entry: {
          step_0: {
            type: "CHOICE",
            prompt: "What's happening? 👇\n\n1️⃣ Machine won't start\n2️⃣ Error on display\n3️⃣ Problem during wash",
            transitions: {
              "1": "non_parte.step_0",
              "2": "errore_alm.step_0",
              "3": "lavaggio.step_0",
            },
          },
        },
        non_parte: {
          step_0: {
            type: "CHOICE",
            prompt: "What do you see on the display?\n\n1️⃣ SEL\n2️⃣ PUSH / Pr\n3️⃣ door",
            transitions: {
              "1": "non_parte.caso_sel",
              "2": "non_parte.caso_push",
              "3": "non_parte.caso_door",
            },
          },
          caso_sel: {
            type: "INFO",
            prompt: "SEL means you need to select a program.\n👉 Press any program button to start.",
            isTerminal: true,
          },
          caso_push: {
            type: "INFO",
            prompt: "Credit inserted but program not selected.\n👉 Press a program button.",
            isTerminal: true,
          },
          caso_door: {
            type: "ACTION",
            prompt: "The door is open.\n👉 Close the door firmly.",
            transitions: { default: "non_parte.ask_resolved" },
          },
          ask_resolved: {
            type: "CONFIRMATION",
            prompt: "Did that solve the problem? (yes / no)",
            transitions: {
              YES: "non_parte.end_success",
              NO: "non_parte.handle_escalate",
            },
          },
          end_success: {
            type: "INFO",
            prompt: "Great! ✅ Enjoy your wash 👍",
            isTerminal: true,
          },
          handle_escalate: {
            type: "INFO",
            prompt: "I'm contacting an operator to help you.",
            isTerminal: true,
          },
        },
      },
    }
  }
}
