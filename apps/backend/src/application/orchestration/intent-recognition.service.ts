import { PrismaClient } from "@echatbot/database"
import { IntentParserService } from "../intent/intent-parser.service"
import { IntentResult } from "../intent/intent.types"
import { RecognizedIntent } from "./types"
import logger from "../../utils/logger"

/**
 * Multi-intent recognition layer.
 *
 * First iteration: reuse existing IntentParser (pattern/keyword/LLM fallback)
 * and expose a normalized array structure so the orchestrator can support
 * multiple intents as we extend prompts later.
 */
export class IntentRecognitionService {
  private intentParser: IntentParserService

  constructor(prisma: PrismaClient) {
    this.intentParser = new IntentParserService(prisma)
  }

  async recognize(params: {
    message: string
    workspaceId: string
    customerId?: string
    conversationHistory?: Array<{ role: string; content: string }>
  }): Promise<RecognizedIntent[]> {
    const lastAssistantMessage =
      params.conversationHistory
        ?.slice()
        .reverse()
        .find((m) => m.role === "assistant")?.content

    const parsed = await this.intentParser.parse(params.message, {
      workspaceId: params.workspaceId,
      customerId: params.customerId,
      conversationHistory: params.conversationHistory,
      lastAssistantMessage,
    })

    const intents: RecognizedIntent[] = [this.toRecognized(parsed)]

    logger.info("[Orchestration] Intent recognition completed", {
      intents: intents.map((i) => i.intent.type),
      confidence: intents.map((i) => i.confidence),
    })

    return intents
  }

  private toRecognized(result: IntentResult): RecognizedIntent {
    return {
      intent: result.intent,
      confidence: result.confidence,
      source:
        result.source === "PATTERN" || result.source === "KEYWORD"
          ? result.source
          : "LLM",
    }
  }
}
