import { MixerOutput, RecognizedIntent } from "./types"
import { isGreetingIntent, isSupportIntent } from "../intent/intent.types"

interface MixerParams {
  intents: RecognizedIntent[]
  context: {
    products?: any
    faqs?: any
    offers?: any
    services?: any
    customerProfile?: any
    workspace: { toneOfVoice?: string | null; sellsProductsAndServices: boolean }
  }
  isRegistered?: boolean
}

/**
 * Content mixer with deterministic guards. LLM plug-in can replace
 * the `buildNarrative` method, but the structure stays stable.
 */
export class ContentMixerService {
  mix(params: MixerParams): MixerOutput {
    const productGroups = this.buildProducts(params)
    const faqSections = this.buildFaqs(params)
    const offerSections = this.buildOffers(params)
    const serviceSections = this.buildServices(params)
    const questions: string[] = this.buildQuestions(params, productGroups, faqSections)

    const registrationPrompt =
      !params.isRegistered && productGroups.length > 0
        ? this.buildRegistrationPrompt()
        : undefined

    return {
      intro: this.buildIntro(params),
      productGroups: productGroups.length ? productGroups : undefined,
      faqSections: faqSections.length ? faqSections : undefined,
      offerSections: offerSections.length ? offerSections : undefined,
      serviceSections: serviceSections.length ? serviceSections : undefined,
      questions: questions.length ? questions : undefined,
      registrationPrompt,
    }
  }

  private buildIntro(params: MixerParams): string | undefined {
    const name = params.context.customerProfile?.name
    const greeted = params.context.workspace.toneOfVoice
    const hasGreetingIntent = params.intents.some((i) => isGreetingIntent(i.intent as any))

    if (hasGreetingIntent && name) {
      return `Ciao ${name}!`
    }
    if (hasGreetingIntent) {
      return greeted ? `Ciao!` : `Ciao!`
    }
    return undefined
  }

  private buildProducts(params: MixerParams) {
    if (!params.context.workspace.sellsProductsAndServices) {
      return []
    }

    const block = params.context.products
    if (!block || block.type !== "PRODUCTS") return []

    const products = (block.products || []) as any[]
    if (!products.length) return []

    // Group by category name if present, else fallback to single group
    const grouped = new Map<string, any[]>()
    for (const p of products) {
      const key = p.categoryName || "Selezione"
      if (!grouped.has(key)) grouped.set(key, [])
      grouped.get(key)!.push(p)
    }

    const groups = Array.from(grouped.entries()).map(([title, list]) => {
      const topItems = list.slice(0, 5).map((p) => ({
        id: p.id,
        name: p.name,
        sku: p.sku,
        price: params.isRegistered ? p.priceWithDiscount ?? p.price : undefined,
      }))
      return {
        title,
        items: topItems,
      }
    })

    return groups
  }

  private buildFaqs(params: MixerParams) {
    const block = params.context.faqs
    if (!block || block.type !== "FAQ") return []

    return (block.faqs || []).map((faq: any) => ({
      question: faq.question,
      answer: faq.answer,
    }))
  }

  private buildOffers(params: MixerParams) {
    const block = params.context.offers
    if (!block || block.type !== "OFFERS") return []
    return (block.offers || []).map((offer: any) => ({
      title: offer.name,
      description: offer.description,
      discountPercent: offer.discountPercent,
      categoryName: offer.categoryName,
    }))
  }

  private buildServices(params: MixerParams) {
    const block = params.context.services
    if (!block || block.type !== "SERVICES") return []
    return (block.services || []).map((service: any) => ({
      title: service.name,
      description: service.description,
      price: service.price,
      duration: service.duration,
    }))
  }

  private buildQuestions(
    params: MixerParams,
    productGroups: any[],
    faqSections: any[]
  ): string[] {
    const questions: string[] = []
    const hasGreeting = params.intents.some((i) => isGreetingIntent(i.intent as any))
    const isOnlySupport = params.intents.every((i) => isSupportIntent(i.intent as any))

    if (productGroups.length === 1 && productGroups[0].items.length > 5) {
      questions.push("Preferisci iniziare da qualcosa di particolare?")
    }

    if (faqSections.length === 0 && productGroups.length === 0 && !isOnlySupport && !hasGreeting) {
      questions.push("Hai bisogno di consigli o cerchi qualcosa in particolare?")
    }

    return questions.slice(0, 2)
  }

  private buildRegistrationPrompt(): string {
    return [
      "Per vedere i prezzi e fare ordini, registrati in 30 secondi! 📝",
      "[link registrazione]",
      "",
      "🔒 I tuoi dati sono al sicuro:",
      "• NON vengono condivisi con terzi",
      "• NON vengono inviati a modelli AI",
      "• Gestiti solo da noi per il tuo servizio",
      "",
      "Intanto posso rispondere a qualsiasi domanda! 😊",
    ].join("\n")
  }
}
