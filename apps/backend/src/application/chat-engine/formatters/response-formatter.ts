import { FormatterResult, LLMFormatterService } from "../../llm-formatter"
import { StructuredResponse } from "../../response-builder"
import { WorkspaceConfig } from "../types"

interface FormatWithCustomRulesParams {
  llmFormatter: LLMFormatterService
  structuredResponse: StructuredResponse
  language: string
  workspaceConfig: WorkspaceConfig
  conversationHistory?: Array<{ role: string; content: string }>
  personalizationOptions?: {
    customerName?: string
    isFirstMessage?: boolean
    isUnregisteredUser?: boolean
  }
}

/**
 * Formats a structured response with workspace-specific rules and personalization.
 */
export async function formatWithCustomRules({
  llmFormatter,
  structuredResponse,
  language,
  workspaceConfig,
  conversationHistory,
  personalizationOptions,
}: FormatWithCustomRulesParams): Promise<FormatterResult> {
  const formatterResult = await llmFormatter.format(
    structuredResponse,
    language,
    conversationHistory,
    {
      customAiRules: workspaceConfig.customAiRules,
      botIdentity: workspaceConfig.botIdentity,
      botName: workspaceConfig.name,
      chatbotName: workspaceConfig.chatbotName,
      businessType: workspaceConfig.businessType,
      customerName: personalizationOptions?.customerName,
      isFirstMessage: personalizationOptions?.isFirstMessage,
      isUnregisteredUser: personalizationOptions?.isUnregisteredUser,
    }
  )

  return {
    text: formatterResult.text,
    tokensUsed: formatterResult.tokensUsed,
    model: formatterResult.model,
    cached: formatterResult.cached,
    groupMapping: formatterResult.groupMapping,
  }
}
