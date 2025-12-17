/**
 * OpenAI Agents SDK - Main Export
 * 
 * This module provides a complete multi-agent architecture using
 * the official OpenAI Agents SDK for e-commerce chatbot functionality.
 * 
 * Usage:
 * ```typescript
 * import { getOpenAIChatService } from './application/openai-agents'
 * 
 * const chatService = getOpenAIChatService(prisma)
 * const result = await chatService.processMessage({
 *   workspaceId: 'ws_123',
 *   customerId: 'cust_456',
 *   conversationId: 'conv_789',
 *   messageId: 'msg_abc',
 *   message: 'Voglio comprare mozzarella di bufala',
 * })
 * ```
 * 
 * @module openai-agents
 */

// Types
export * from "./types"

// Tools (grouped by agent)
export * from "./tools"

// Agent definitions and factory
export * from "./agents"

// Agent runner service
export * from "./runner.service"

// Main chat service (alternative to LLMRouterService)
export {
  OpenAIChatService,
  getOpenAIChatService,
  type OpenAIChatInput,
  type OpenAIChatOutput,
} from "./chat.service"
