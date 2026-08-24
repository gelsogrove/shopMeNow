import { VARIABLE_DEFAULTS } from "../../types/prompt-variables.types"

/** The workspace fields the customer-copy placeholders resolve from. */
export interface WorkspaceCopySource {
  name?: string | null
  chatbotName?: string | null
  termsAndConditions?: string | null
  videoUrl?: string | null
}

/**
 * Substitutes workspace-level {{variables}} in workspace-owned customer copy
 * (welcome / welcome-back / human-support): the workspace's identity
 * ({{chatbotName}}, {{companyName}}) plus {{termsAndConditions}}.
 * Per-customer variables (e.g. {{customerName}}) are deliberately left
 * untouched for the chatbot module to resolve at runtime — which is also why
 * promptProcessor.processWithVariables is NOT reused here: it fills a missing
 * customerName with 'Cliente', destroying that contract.
 *
 * Andrea 2026-08-17, seen live: the demoam greeting used to be rendered by a
 * context-bearing LLM hop that filled {{chatbotName}}/{{companyName}} from
 * the system prompt as a side effect. When the greeting moved to the isolated
 * translation call (which correctly translates and adds nothing), the raw
 * placeholders reached a customer verbatim — no code had ever substituted
 * them.
 *
 * ONE copy of this rule, in a dependency-light file on purpose: imported by
 * buildChatbotSettingsJson (the host resolves it per turn) AND by the demoam
 * CLI runtime, so the scenarios exercise the exact substitution production
 * runs instead of a second implementation that can drift.
 */
export function renderWorkspaceCopy(
  text: string | undefined,
  workspace: WorkspaceCopySource
): string | undefined {
  if (!text) return text
  return text
    .replace(/\{\{\s*chatbotName\s*\}\}/gi, workspace.chatbotName?.trim() || VARIABLE_DEFAULTS.chatbotName || "")
    .replace(/\{\{\s*companyName\s*\}\}/gi, workspace.name?.trim() || VARIABLE_DEFAULTS.companyName || "")
    .replace(/\{\{\s*termsAndConditions\s*\}\}/gi, workspace.termsAndConditions?.trim() || "")
    // 📺 The presentation video, so the link is edited in ONE field instead of
    // being pasted into the copy. An unset videoUrl resolves to "" — the line
    // that held it collapses rather than shipping a broken placeholder.
    .replace(/\{\{\s*videoUrl\s*\}\}/gi, workspace.videoUrl?.trim() || "")
}
