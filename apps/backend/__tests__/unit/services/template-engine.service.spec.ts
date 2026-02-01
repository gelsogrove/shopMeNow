/**
 * @file template-engine.service.test.ts
 * @description Unit tests for TemplateEngineService
 * 
 * Tests the template processing functionality including:
 * - [[SECTION:var]]...[[/SECTION]] blocks (NEW feature)
 * - {{#if}}...{{/if}} conditionals
 * - {{#unless}}...{{/unless}} conditionals
 * - {{variable}} replacements
 * 
 * @author Andrea
 */

import { TemplateEngineService } from '../../../src/application/services/prompt-builder/template-engine.service'

describe('TemplateEngineService', () => {
  let templateEngine: TemplateEngineService

  beforeEach(() => {
    templateEngine = new TemplateEngineService()
  })

  // ============================================================
  // [[SECTION:var]]...[[/SECTION]] - NEW FEATURE TESTS
  // ============================================================
  
  describe('[[SECTION]] blocks', () => {
    /**
     * SCENARIO: Variable has value
     * RULE: Section content is kept, [[SECTION]] tags removed
     */
    it('should keep section content when variable has value', () => {
      const template = `
[[SECTION:customAiRules]]
### Custom Rules
{{customAiRules}}
[[/SECTION]]
`
      const variables = { customAiRules: 'Always be polite' }
      
      const result = templateEngine.process(template, variables)
      
      expect(result).toContain('### Custom Rules')
      expect(result).toContain('Always be polite')
      expect(result).not.toContain('[[SECTION')
      expect(result).not.toContain('[[/SECTION]]')
    })

    /**
     * SCENARIO: Variable is empty string
     * RULE: Entire section is removed including headers
     */
    it('should remove entire section when variable is empty string', () => {
      const template = `
Before section
[[SECTION:customAiRules]]
### Custom Rules
{{customAiRules}}
[[/SECTION]]
After section
`
      const variables = { customAiRules: '' }
      
      const result = templateEngine.process(template, variables)
      
      expect(result).not.toContain('### Custom Rules')
      expect(result).not.toContain('[[SECTION')
      expect(result).toContain('Before section')
      expect(result).toContain('After section')
    })

    /**
     * SCENARIO: Variable is undefined
     * RULE: Entire section is removed
     */
    it('should remove entire section when variable is undefined', () => {
      const template = `
[[SECTION:address]]
## Location
{{address}}
[[/SECTION]]
`
      const variables = {} // address not defined
      
      const result = templateEngine.process(template, variables)
      
      expect(result).not.toContain('## Location')
      expect(result).not.toContain('{{address}}')
    })

    /**
     * SCENARIO: Variable is whitespace only
     * RULE: Treat as empty, remove section
     */
    it('should remove section when variable is whitespace only', () => {
      const template = `
[[SECTION:botIdentityResponse]]
### About Us
{{botIdentityResponse}}
[[/SECTION]]
`
      const variables = { botIdentityResponse: '   ' }
      
      const result = templateEngine.process(template, variables)
      
      expect(result).not.toContain('### About Us')
    })

    /**
     * SCENARIO: Multiple SECTION blocks in same template
     * RULE: Each section is processed independently
     */
    it('should process multiple sections independently', () => {
      const template = `
[[SECTION:customAiRules]]
### Rules
{{customAiRules}}
[[/SECTION]]

[[SECTION:address]]
### Location
{{address}}
[[/SECTION]]

[[SECTION:faqs]]
### FAQ
{{faqs}}
[[/SECTION]]
`
      const variables = {
        customAiRules: 'Be friendly',
        address: '',
        faqs: 'Q: Hours? A: 9-5'
      }
      
      const result = templateEngine.process(template, variables)
      
      expect(result).toContain('### Rules')
      expect(result).toContain('Be friendly')
      expect(result).not.toContain('### Location')
      expect(result).toContain('### FAQ')
      expect(result).toContain('Q: Hours?')
    })

    /**
     * SCENARIO: SECTION nested inside {{#if}} block
     * RULE: Both should work correctly together
     */
    it('should work with SECTION inside {{#if}} blocks', () => {
      const template = `
{{#if hasHumanSupport}}
[[SECTION:frustrationEscalationInstructions]]
## Escalation Triggers
{{frustrationEscalationInstructions}}
[[/SECTION]]
{{/if}}
`
      const variables = {
        hasHumanSupport: true,
        frustrationEscalationInstructions: 'When angry, escalate'
      }
      
      const result = templateEngine.process(template, variables)
      
      expect(result).toContain('## Escalation Triggers')
      expect(result).toContain('When angry, escalate')
    })

    /**
     * SCENARIO: SECTION nested inside {{#if}}, but SECTION var is empty
     * RULE: SECTION is removed, {{#if}} still evaluates correctly
     */
    it('should remove SECTION inside {{#if}} when SECTION var is empty', () => {
      const template = `
{{#if hasHumanSupport}}
Support is available.
[[SECTION:humanSupportInstructions]]
### Instructions
{{humanSupportInstructions}}
[[/SECTION]]
{{/if}}
`
      const variables = {
        hasHumanSupport: true,
        humanSupportInstructions: ''
      }
      
      const result = templateEngine.process(template, variables)
      
      expect(result).toContain('Support is available')
      expect(result).not.toContain('### Instructions')
    })
  })

  // ============================================================
  // {{#if}}...{{/if}} - EXISTING FEATURE TESTS
  // ============================================================

  describe('{{#if}} conditionals', () => {
    /**
     * SCENARIO: Boolean condition is true
     * RULE: Content is kept
     */
    it('should keep content when boolean condition is true', () => {
      const template = `
{{#if hasHumanSupport}}
Human support available
{{/if}}
`
      const variables = { hasHumanSupport: true }
      
      const result = templateEngine.process(template, variables)
      
      expect(result).toContain('Human support available')
    })

    /**
     * SCENARIO: Boolean condition is false
     * RULE: Content is removed
     */
    it('should remove content when boolean condition is false', () => {
      const template = `
{{#if hasHumanSupport}}
Human support available
{{/if}}
`
      const variables = { hasHumanSupport: false }
      
      const result = templateEngine.process(template, variables)
      
      expect(result).not.toContain('Human support available')
    })

    /**
     * SCENARIO: if-else block with true condition
     * RULE: If content is kept, else content removed
     */
    it('should use if block when condition is true in if-else', () => {
      const template = `
{{#if chatbotName}}
You are {{chatbotName}}
{{else}}
You are a helpful assistant
{{/if}}
`
      const variables = { chatbotName: 'ShopBot' }
      
      const result = templateEngine.process(template, variables)
      
      expect(result).toContain('You are ShopBot')
      expect(result).not.toContain('helpful assistant')
    })

    /**
     * SCENARIO: if-else block with false condition
     * RULE: Else content is kept
     */
    it('should use else block when condition is false in if-else', () => {
      const template = `
{{#if chatbotName}}
You are {{chatbotName}}
{{else}}
You are a helpful assistant
{{/if}}
`
      const variables = { chatbotName: '' }
      
      const result = templateEngine.process(template, variables)
      
      expect(result).toContain('You are a helpful assistant')
    })

    /**
     * SCENARIO: Nested if blocks
     * RULE: Inner and outer conditions both evaluated
     */
    it('should handle nested if blocks', () => {
      const template = `
{{#if hasHumanSupport}}
Support available
{{#if hasSalesAgents}}
Agent: {{agentName}}
{{/if}}
{{/if}}
`
      const variables = {
        hasHumanSupport: true,
        hasSalesAgents: true,
        agentName: 'John'
      }
      
      const result = templateEngine.process(template, variables)
      
      expect(result).toContain('Support available')
      expect(result).toContain('Agent: John')
    })
  })

  // ============================================================
  // {{#unless}}...{{/unless}} - INVERSE CONDITIONAL TESTS
  // ============================================================

  describe('{{#unless}} conditionals', () => {
    /**
     * SCENARIO: unless with falsy value
     * RULE: Content is shown
     */
    it('should show content when condition is falsy', () => {
      const template = `
{{#unless hasCustomerName}}
Dear Customer
{{/unless}}
`
      const variables = { hasCustomerName: false }
      
      const result = templateEngine.process(template, variables)
      
      expect(result).toContain('Dear Customer')
    })

    /**
     * SCENARIO: unless with truthy value
     * RULE: Content is hidden
     */
    it('should hide content when condition is truthy', () => {
      const template = `
{{#unless hasCustomerName}}
Dear Customer
{{/unless}}
`
      const variables = { hasCustomerName: true }
      
      const result = templateEngine.process(template, variables)
      
      expect(result).not.toContain('Dear Customer')
    })
  })

  // ============================================================
  // Variable replacement tests
  // ============================================================

  describe('Variable replacement', () => {
    /**
     * SCENARIO: Simple variable replacement
     * RULE: {{var}} replaced with value
     */
    it('should replace simple variables', () => {
      const template = 'Hello {{customerName}}, welcome to {{companyName}}'
      const variables = {
        customerName: 'Mario',
        companyName: 'Shop'
      }
      
      const result = templateEngine.process(template, variables)
      
      expect(result).toBe('Hello Mario, welcome to Shop')
    })

    /**
     * SCENARIO: Variable not in dictionary
     * RULE: Leave unchanged for later processing
     */
    it('should leave undefined variables unchanged', () => {
      const template = 'Hello {{customerName}}, your code is {{orderCode}}'
      const variables = { customerName: 'Mario' }
      
      const result = templateEngine.process(template, variables)
      
      expect(result).toContain('Hello Mario')
      expect(result).toContain('{{orderCode}}')
    })
  })

  // ============================================================
  // Whitespace cleanup tests
  // ============================================================

  describe('Whitespace cleanup', () => {
    /**
     * SCENARIO: Multiple consecutive blank lines
     * RULE: Reduced to maximum 2 blank lines
     */
    it('should clean up excessive blank lines', () => {
      const template = `Line 1



Line 2`
      const variables = {}
      
      const result = templateEngine.process(template, variables)
      
      // Should have at most 2 newlines between content
      expect(result.split('\n\n\n').length).toBeLessThanOrEqual(1)
    })
  })
})
