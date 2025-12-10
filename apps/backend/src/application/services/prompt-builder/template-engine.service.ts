/**
 * TemplateEngineService - Process templates with variables and conditionals
 *
 * Single Responsibility: Replace {{variables}} and handle {{#if}} conditionals.
 * Simple, fast, no external dependencies.
 *
 * Supports:
 * - {{variableName}} - Simple variable replacement
 * - {{#if condition}}...{{/if}} - Conditional blocks (NESTED SUPPORTED)
 * - {{#if condition}}...{{else}}...{{/if}} - If-else blocks (NESTED SUPPORTED)
 * - {{#unless condition}}...{{/unless}} - Inverse conditionals
 *
 * @architecture Part of PromptBuilder system
 */

import logger from "../../../utils/logger"

export class TemplateEngineService {
  constructor() {
    logger.info("✅ TemplateEngineService initialized")
  }

  /**
   * Process a template with given variables
   *
   * @param template - Template string with {{variables}} and {{#if}} blocks
   * @param variables - Object with variable values
   * @returns Processed template with all replacements done
   */
  process(template: string, variables: Record<string, any>): string {
    let result = template

    // Step 1: Process {{#unless condition}}...{{/unless}} blocks (iteratively for nesting)
    result = this.processUnlessBlocksIteratively(result, variables)

    // Step 2: Process {{#if}} blocks iteratively from innermost to outermost
    // This handles both if-else and simple if blocks with proper nesting
    result = this.processIfBlocksIteratively(result, variables)

    // Step 3: Replace {{variableName}} with values
    result = this.replaceVariables(result, variables)

    // Step 4: Clean up extra blank lines
    result = this.cleanupWhitespace(result)

    return result
  }

  /**
   * Process {{#unless}} blocks iteratively to handle nesting
   */
  private processUnlessBlocksIteratively(template: string, variables: Record<string, any>): string {
    let result = template
    let maxIterations = 50
    let iterations = 0

    // Keep processing until no more {{#unless}} blocks found
    while (result.includes("{{#unless") && iterations < maxIterations) {
      iterations++
      const newResult = this.processInnermostUnless(result, variables)
      if (newResult === result) break // No changes, stop
      result = newResult
    }

    return result
  }

  /**
   * Process the innermost {{#unless}} block (one that has no nested {{#unless}} inside)
   */
  private processInnermostUnless(template: string, variables: Record<string, any>): string {
    // Match {{#unless condition}}...{{/unless}} where content has NO nested {{#unless}}
    const regex = /\{\{#unless\s+(\w+)\}\}((?:(?!\{\{#unless)[\s\S])*?)\{\{\/unless\}\}/

    return template.replace(regex, (match, condition, content) => {
      const value = variables[condition]
      const isFalsy = !value || value === false || value === "false" || value === 0 || value === ""

      if (isFalsy) {
        return content.trim()
      } else {
        return ""
      }
    })
  }

  /**
   * Process {{#if}} blocks iteratively from innermost to outermost
   * This correctly handles nested blocks by processing the deepest first
   */
  private processIfBlocksIteratively(template: string, variables: Record<string, any>): string {
    let result = template
    let maxIterations = 100 // Safety limit
    let iterations = 0

    // Keep processing until no more {{#if}} blocks found
    while (result.includes("{{#if") && iterations < maxIterations) {
      iterations++
      const newResult = this.processInnermostIfBlock(result, variables)
      if (newResult === result) break // No changes, stop
      result = newResult
    }

    if (iterations >= maxIterations) {
      logger.warn("⚠️ TemplateEngine: Max iterations reached, possible malformed template")
    }

    return result
  }

  /**
   * Find and process the innermost {{#if}} block
   * An innermost block is one that contains no other {{#if}} inside its content
   */
  private processInnermostIfBlock(template: string, variables: Record<string, any>): string {
    // Strategy: Find blocks that contain NO other {{#if}} tags inside them
    // This ensures we always process the innermost block first

    // First try to find innermost if-else blocks
    // Match {{#if X}} content {{else}} elseContent {{/if}}
    // where content and elseContent have NO {{#if}} inside
    const ifElseRegex =
      /\{\{#if\s+(\w+)\}\}((?:(?!\{\{#if\s)(?!\{\{\/if\}\})[\s\S])*?)\{\{else\}\}((?:(?!\{\{#if\s)(?!\{\{\/if\}\})[\s\S])*?)\{\{\/if\}\}/

    const ifElseMatch = template.match(ifElseRegex)
    if (ifElseMatch) {
      const [fullMatch, condition, ifContent, elseContent] = ifElseMatch
      const value = variables[condition]
      const isTruthy = this.isTruthy(value)

      logger.debug(
        `Processing if-else block: condition=${condition}, value=${value}, isTruthy=${isTruthy}`
      )
      const replacement = isTruthy ? ifContent.trim() : elseContent.trim()
      return template.replace(fullMatch, replacement)
    }

    // Then try simple {{#if}}...{{/if}} blocks (no {{else}}, no nested {{#if}})
    const simpleIfRegex =
      /\{\{#if\s+(\w+)\}\}((?:(?!\{\{#if\s)(?!\{\{else\}\})(?!\{\{\/if\}\})[\s\S])*?)\{\{\/if\}\}/

    const simpleIfMatch = template.match(simpleIfRegex)
    if (simpleIfMatch) {
      const [fullMatch, condition, content] = simpleIfMatch
      const value = variables[condition]
      const isTruthy = this.isTruthy(value)

      logger.debug(
        `Processing simple if block: condition=${condition}, value=${value}, isTruthy=${isTruthy}`
      )
      const replacement = isTruthy ? content.trim() : ""
      return template.replace(fullMatch, replacement)
    }

    // No innermost block found - but check if there are still {{#if}} tags
    // This might mean we have a malformed template
    if (template.includes("{{#if")) {
      logger.warn("⚠️ TemplateEngine: {{#if}} found but no valid block matched - possible malformed template")
    }

    return template
  }

  /**
   * Check if a value is truthy for template conditions
   */
  private isTruthy(value: any): boolean {
    return value && value !== false && value !== "false" && value !== 0 && value !== ""
  }

  /**
   * Replace {{variableName}} with actual values
   * IMPORTANT: Only replaces variables that exist in the dictionary.
   * Variables NOT in dictionary are left intact for later processing.
   */
  private replaceVariables(template: string, variables: Record<string, any>): string {
    const varRegex = /\{\{(\w+)\}\}/g

    return template.replace(varRegex, (match, varName) => {
      const value = variables[varName]

      // 🔒 IMPORTANT: Don't replace variables not in dictionary
      // Leave them intact for subsequent replacement passes
      if (value === undefined || value === null) {
        return match // Return original {{varName}} unchanged
      }

      // Handle arrays (join with newlines)
      if (Array.isArray(value)) {
        return value.join("\n")
      }

      // Handle booleans
      if (typeof value === "boolean") {
        return value ? "Yes" : "No"
      }

      return String(value)
    })
  }

  /**
   * Clean up excessive whitespace from conditional blocks
   */
  private cleanupWhitespace(template: string): string {
    // Replace 3+ consecutive newlines with 2 newlines
    let result = template.replace(/\n{3,}/g, "\n\n")

    // Trim leading/trailing whitespace
    result = result.trim()

    return result
  }
}
