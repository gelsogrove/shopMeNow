// Entry point for the backend integration.
//
// The main Express backend (`CustomClientChatbotService`) imports this
// module dynamically based on `workspace.customChatbotId`:
//
//   const mod = await import(`custom-${chatbotId}/index.js`)
//   const result = await mod.chatbotFn(input)
//
// We just re-export `chatbotFn` from `agent.ts` so the dynamic import
// resolution is stable regardless of internal file structure.

export { chatbotFn } from './agent.js'
export type { ChatbotInput, ChatbotOutput, HistoryEntry } from './agent.js'
