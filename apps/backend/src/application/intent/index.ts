/**
 * Intent Module - Public API
 */

// Types
export * from "./intent.types"

// Services
export { IntentParserService, getIntentParser } from "./intent-parser.service"

// Patterns (for testing)
export { matchAllPatterns } from "./patterns/pattern-matcher"
export { buildContextFromHistory, parseListFromMessage } from "./patterns/history-parser"
export { matchKnownEntities, KnownEntity } from "./patterns/keyword-matcher"
