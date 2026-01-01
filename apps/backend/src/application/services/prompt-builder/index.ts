/**
 * PromptBuilder Module - Dynamic Prompt Generation System
 *
 * This module is THE HEART of the AI chatbot system.
 * It generates prompts dynamically at runtime based on workspace configuration.
 *
 * Usage:
 * ```typescript
 * import { PromptBuilderService } from "./prompt-builder"
 *
 * const promptBuilder = new PromptBuilderService(prisma)
 * const prompt = await promptBuilder.build("ROUTER", { workspaceId, customerId })
 * ```
 *
 * @module prompt-builder
 */

export { PromptBuilderService, PromptBuildContext, BuiltPrompt } from "./prompt-builder.service"
export { TemplateEngineService } from "./template-engine.service"
export { VariableResolverService, PromptVariables } from "./variable-resolver.service"
