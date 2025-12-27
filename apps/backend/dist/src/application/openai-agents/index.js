"use strict";
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
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getOpenAIChatService = exports.OpenAIChatService = void 0;
// Types
__exportStar(require("./types"), exports);
// Tools (grouped by agent)
__exportStar(require("./tools"), exports);
// Agent definitions and factory
__exportStar(require("./agents"), exports);
// Agent runner service
__exportStar(require("./runner.service"), exports);
// Main chat service (alternative to LLMRouterService)
var chat_service_1 = require("./chat.service");
Object.defineProperty(exports, "OpenAIChatService", { enumerable: true, get: function () { return chat_service_1.OpenAIChatService; } });
Object.defineProperty(exports, "getOpenAIChatService", { enumerable: true, get: function () { return chat_service_1.getOpenAIChatService; } });
//# sourceMappingURL=index.js.map