// Entry point for the backend integration. Same convention as
// custom-demowash/index.ts — the host imports this module dynamically
// based on workspace.customChatbotId and calls chatbotFn(input).

export { chatbotFn } from './agent.js'
export type { ChatbotInput, ChatbotOutput, HistoryEntry, RetrievalHandler, RetrievalHandlerResult } from './agent.js'
