import { PrismaClient } from "@echatbot/database"

import { IntentParserService } from "../../../application/intent/intent-parser.service"

describe("IntentParserService - LLM classification parsing", () => {
  it("maps SHOW_AGENT_INFO classification to intent", () => {
    const prisma = {} as unknown as PrismaClient
    const service = new IntentParserService(prisma, { enableLLMFallback: false })

    const intent = (service as any).parseClassification("SHOW_AGENT_INFO")

    expect(intent).toEqual({ type: "SHOW_AGENT_INFO" })
  })
})
