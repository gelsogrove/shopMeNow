import { PrismaClient } from "@echatbot/database"

import { IntentParserService } from "../../../application/intent/intent-parser.service"

describe("IntentParserService - LLM classification parsing", () => {
  it("maps SHOW_AGENT_INFO classification to intent", () => {
    const prisma = {} as unknown as PrismaClient
    const service = new IntentParserService(prisma, { enableLLMFallback: false })

    const intent = (service as any).parseClassification("SHOW_AGENT_INFO")

    expect(intent).toEqual({ type: "SHOW_AGENT_INFO" })
  })

  it("maps ORDER_DETAILS with explicit order code", () => {
    const prisma = {} as unknown as PrismaClient
    const service = new IntentParserService(prisma, { enableLLMFallback: false })

    const intent = (service as any).parseClassification("ORDER_DETAILS:ORD-049-2025-12")

    expect(intent).toEqual({ type: "ORDER_DETAILS", orderCode: "ORD-049-2025-12" })
  })

  it("maps ORDER_DETAILS without order code to latest-order intent", () => {
    const prisma = {} as unknown as PrismaClient
    const service = new IntentParserService(prisma, { enableLLMFallback: false })

    const intent = (service as any).parseClassification("ORDER_DETAILS")

    expect(intent).toEqual({ type: "ORDER_DETAILS" })
  })
})
