// System-prompt assembly for the agent.
// Loads the static template and rule files once, then renders per-turn with
// the current sticky facts and location overrides.

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFile } from 'node:fs/promises'

import { getLocationOverride } from './runtime.js'
import type { AgentRuntime, PromptBundle } from './agent-types.js'

export async function loadPromptBundle(): Promise<PromptBundle> {
  // utils/ → ../prompts/ and ../docs/02reglas.md (one level up from this file).
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  const template = await readFile(path.join(root, 'prompts', 'agent.txt'), 'utf8')
  const reglas = await readFile(path.join(root, 'docs', '02reglas.md'), 'utf8')
  return { template, reglas }
}

export function buildSystemPrompt(ar: AgentRuntime, bundle: PromptBundle): string {
  const { runtime, state } = ar
  const locationsList = Object.keys(runtime.locations?.locations || {}).join(', ') || '(none)'
  const override = getLocationOverride(runtime, state.location)
  const locationContext = override ? JSON.stringify(override, null, 2) : '(no active location override)'
  const chatbotName = runtime.settings.chatbotName || 'Eco'
  const welcomeTemplates = runtime.settings.welcomeMessage || {}
  const welcomeBlock = Object.entries(welcomeTemplates)
    .map(([lang, tpl]) => `  ${lang}: ${(tpl as string).replaceAll('{{chatbotName}}', chatbotName)}`)
    .join('\n')

  const vars: Record<string, string> = {
    chatbotName,
    welcomeBlock: welcomeBlock || '  (no welcome configured)',
    language: state.language || '(not detected yet)',
    location: state.location || '(unknown)',
    locationStreet: state.locationStreet || '(unknown / not needed unless Mataró)',
    machineType: state.machineType || '(unknown)',
    machineNumber: state.machineNumber || '(unknown)',
    displayState: state.displayState || '(unknown)',
    paymentCompleted: state.paymentCompleted === null ? '(unknown)' : String(state.paymentCompleted),
    paymentMethod: state.paymentMethod || '(unknown)',
    activeFlowId: state.activeFlowId || '(none)',
    activeStepId: state.activeStepId || '(none)',
    customerName: state.customerName || '(unknown)',
    turnCount: String(state.turnCount),
    locationsList,
    locationContext,
    reglas: bundle.reglas,
  }
  return Object.entries(vars).reduce(
    (text, [key, value]) => text.replaceAll(`{{${key}}}`, value),
    bundle.template,
  ).trim()
}
