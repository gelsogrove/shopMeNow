import { PrismaClient } from "@echatbot/database"
import logger from "../../utils/logger"
import { ConversationManager } from "../../services/conversation-manager.service"
import { DataLoaderService } from "../data-loader"
import {
  Intent,
  isProductSearchIntent,
} from "../intent/intent.types"
import { LoadedContext, RecognizedIntent } from "./types"

interface LoaderParams {
  intents: RecognizedIntent[]
  workspaceId: string
  customerId: string
  conversationId: string
  sellsProductsAndServices?: boolean
  isRegistered?: boolean
}

/**
 * Parallel data loader that fans out DB calls based on detected intents.
 * Applies workspace isolation, guest masking, and skips product loads when
 * sellsProductsAndServices is false.
 */
export class ParallelLoaderService {
  private dataLoader: DataLoaderService
  private conversationManager: ConversationManager

  constructor(private prisma: PrismaClient) {
    this.dataLoader = new DataLoaderService(prisma)
    this.conversationManager = new ConversationManager(prisma, 10)
  }

  async load(params: LoaderParams): Promise<LoadedContext> {
    const workspaceConfig = await this.prisma.workspace.findUnique({
      where: { id: params.workspaceId },
      select: {
        sellsProductsAndServices: true,
        toneOfVoice: true,
      },
    })

    const workspace = {
      sellsProductsAndServices:
        params.sellsProductsAndServices ??
        workspaceConfig?.sellsProductsAndServices ??
        false,
      toneOfVoice: workspaceConfig?.toneOfVoice as string | null,
    }

    const historyPromise = this.conversationManager.loadHistory(
      params.workspaceId,
      params.conversationId
    )

    const intentsToLoad = workspace.sellsProductsAndServices
      ? params.intents
      : params.intents.filter(
          (i) => !isProductSearchIntent(i.intent as Intent)
        )

    const dataPromises = intentsToLoad.map(async (i) => {
      try {
        return await this.dataLoader.loadForIntent(
          i.intent as Intent,
          params.workspaceId,
          params.customerId,
          0, // customerDiscount
          false // customerIsActive - parallel loader doesn't handle product details
        )
      } catch (error) {
        logger.error("[Orchestration] Data load failed", {
          intent: i.intent.type,
          error,
        })
        return null
      }
    })

    const [history, ...dataResults] = await Promise.all([
      historyPromise,
      ...dataPromises,
    ])

    const recentMessages = history
      .filter((m) => m.role === "user" || m.role === "assistant")
      .slice(-6)
      .map((m) => ({ role: m.role as "user" | "assistant", content: m.content }))

    const conversation = {
      recentMessages,
      summary: undefined,
    }

    return {
      products: dataResults.find((d) => (d as any)?.type === "PRODUCTS"),
      faqs: dataResults.find((d) => (d as any)?.type === "FAQ"),
      offers: dataResults.find((d) => (d as any)?.type === "OFFERS"),
      services: dataResults.find((d) => (d as any)?.type === "SERVICES"),
      customerProfile: dataResults.find((d) => (d as any)?.type === "PROFILE"),
      preferences: [],
      conversation,
      workspace,
    }
  }
}
