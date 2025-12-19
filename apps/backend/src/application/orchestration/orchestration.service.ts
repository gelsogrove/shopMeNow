import { PrismaClient } from "@echatbot/database"
import logger from "../../utils/logger"
import { IntentRecognitionService } from "./intent-recognition.service"
import { ParallelLoaderService } from "./parallel-loader.service"
import { PreferenceManagerService } from "./preference-manager.service"
import { ContentMixerService } from "./content-mixer.service"
import { NaturalMixerService } from "./natural-mixer.service"
import {
  OrchestrationInput,
  OrchestrationResult,
  RecognizedIntent,
} from "./types"
import { MixerValidatorService } from "./validator.service"

/**
 * Natural conversation orchestrator (Feature 204).
 * Keeps deterministic steps and reserves creativity for the mixer/translator.
 */
export class OrchestrationService {
  private intentRecognition: IntentRecognitionService
  private loader: ParallelLoaderService
  private preferences: PreferenceManagerService
  private mixer: ContentMixerService
  private validator: MixerValidatorService
  private naturalMixer: NaturalMixerService

  constructor(private prisma: PrismaClient) {
    this.intentRecognition = new IntentRecognitionService(prisma)
    this.loader = new ParallelLoaderService(prisma)
    this.preferences = new PreferenceManagerService(prisma)
    this.mixer = new ContentMixerService()
    this.validator = new MixerValidatorService()
    this.naturalMixer = new NaturalMixerService()
  }

  async orchestrate(input: OrchestrationInput): Promise<OrchestrationResult> {
    const intents = await this.intentRecognition.recognize({
      message: input.message,
      workspaceId: input.workspaceId,
      customerId: input.customerId,
    })

    const context = await this.loader.load({
      intents,
      workspaceId: input.workspaceId,
      customerId: input.customerId,
      conversationId: input.conversationId,
      sellsProductsAndServices: input.sellsProductsAndServices,
      isRegistered: input.isRegistered,
    })

    // Attach preferences (no-op if not present)
    const loadedPrefs = await this.preferences.load({
      conversationId: input.conversationId,
      workspaceId: input.workspaceId,
    })
    context.preferences = loadedPrefs

    const mixed = this.mixer.mix({
      intents,
      context,
      isRegistered: input.isRegistered,
    })

    const validation = this.validator.validate(mixed)
    if (!validation.valid) {
      // Fallback: keep minimal intro and questions, drop invalid prompts
      mixed.questions = mixed.questions?.slice(0, 1)
    }

    logger.info("[Orchestration] Completed", {
      intents: intents.map((i: RecognizedIntent) => i.intent.type),
      hasProducts: !!context.products,
      hasFaq: !!context.faqs,
    })

    const message = await this.naturalMixer.build({
      output: mixed,
      context,
      customerLanguage: input.customerLanguage,
      isRegistered: input.isRegistered,
    })

    return {
      intents,
      context,
      mixed,
      message,
    }
  }
}
