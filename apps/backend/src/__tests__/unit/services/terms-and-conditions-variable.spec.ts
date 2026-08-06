/**
 * {{termsAndConditions}} Variable Test
 *
 * WHAT: Verifies the {{termsAndConditions}} template variable introduced for
 * welcome messages (Andrea, 2026-08-06). The variable resolves to
 * workspace.termsAndConditions (Settings > Terms & Conditions), so a welcome
 * message can reference the T&C text/URL without hardcoding it.
 *
 * WHY: Database-First Architecture (CLAUDE.md rule 1) — the T&C link must
 * come from the workspace column, not be baked into the welcome template.
 * Editing the Settings field must be enough to update every message using it.
 *
 * Covers:
 * 1. PromptVariableBuilder.build() maps workspace.termsAndConditions
 * 2. processWithVariables() replaces {{termsAndConditions}} in a template
 * 3. The variable is resolved even when nested INSIDE {{welcomeMessage}}
 *    (the replace runs after the welcome-text insertion in the same pass)
 * 4. Missing field degrades to empty string — never a leftover placeholder
 */

import { PromptVariableBuilder } from '../../../application/services/prompt-variable-builder.service'
import { PromptProcessorService } from '../../../services/prompt-processor.service'

jest.mock('../../../services/smart-prompt-builder.service', () => ({
  SmartPromptBuilder: {
    buildOptimizedProductList: jest.fn().mockResolvedValue({ products: '' }),
    buildProductsByCategory: jest.fn().mockResolvedValue(''),
    buildProductCharacteristics: jest.fn().mockResolvedValue(''),
  },
}))

describe('{{termsAndConditions}} variable', () => {
  const promptProcessor = new PromptProcessorService(null as any)

  const customer = {
    id: 'cust_1',
    name: 'Mario Rossi',
    email: 'mario@example.com',
    phone: '+391234567890',
  }

  const workspace = {
    id: 'ws_1',
    name: 'AM Robots',
    chatbotName: 'Robo',
    termsAndConditions: 'https://am-robots.com/it/terms-and-conditions/',
  }

  it('builds termsAndConditions from the workspace column', () => {
    const vars = PromptVariableBuilder.build(customer, workspace, {}, undefined, {
      skipValidation: true,
    })

    expect(vars.termsAndConditions).toBe('https://am-robots.com/it/terms-and-conditions/')
  })

  it('replaces {{termsAndConditions}} in a template', () => {
    const vars = PromptVariableBuilder.build(customer, workspace, {}, undefined, {
      skipValidation: true,
    })

    const result = promptProcessor.processWithVariables(
      'To view our Terms and Conditions, please visit:\n{{termsAndConditions}}',
      vars
    )

    expect(result).toContain('https://am-robots.com/it/terms-and-conditions/')
    expect(result).not.toContain('{{termsAndConditions}}')
  })

  it('resolves the variable when written inside the welcome message', () => {
    // The welcome text is inserted via {{welcomeMessage}} during the same
    // replace pass; {{termsAndConditions}} must still be resolved afterwards
    // because its replace runs later in the chain.
    const vars = PromptVariableBuilder.build(
      customer,
      {
        ...workspace,
        welcomeMessage: 'Hello from {{chatbotName}}! T&C: {{termsAndConditions}}',
      },
      {},
      undefined,
      { skipValidation: true }
    )

    const result = promptProcessor.processWithVariables('{{welcomeMessage}}', vars)

    expect(result).toBe('Hello from Robo! T&C: https://am-robots.com/it/terms-and-conditions/')
  })

  it('degrades to empty string when the workspace has no T&C configured', () => {
    const vars = PromptVariableBuilder.build(
      customer,
      { ...workspace, termsAndConditions: null },
      {},
      undefined,
      { skipValidation: true }
    )

    const result = promptProcessor.processWithVariables(
      'T&C: {{termsAndConditions}}',
      vars
    )

    expect(result).toBe('T&C: ')
  })
})
