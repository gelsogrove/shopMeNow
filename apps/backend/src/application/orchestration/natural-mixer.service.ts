import fetch from "node-fetch"
import logger from "../../utils/logger"
import { MixerOutput, LoadedContext } from "./types"

interface BuildParams {
  output: MixerOutput
  context: LoadedContext
  customerLanguage?: string
  isRegistered?: boolean
}

/**
 * LLM-based natural mixer/formatter.
 * Takes the structured blocks and asks the model to produce one
 * natural reply, avoiding menu-like prompts when not needed.
 */
export class NaturalMixerService {
  constructor(private model: string = "openai/gpt-4o-mini") {}

  async build(params: BuildParams): Promise<string> {
    const systemPrompt = this.buildSystemPrompt(params)
    const userContent = this.buildUserContent(params)

    try {
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: this.model,
          temperature: 0.9,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent },
          ],
        }),
      })

      if (!res.ok) {
        logger.warn("[NaturalMixer] LLM call failed", { status: res.status })
        return this.fallback(params)
      }

      const data = (await res.json()) as any
      const content = data?.choices?.[0]?.message?.content?.trim()
      if (!content) {
        return this.fallback(params)
      }
      return content
    } catch (error) {
      logger.error("[NaturalMixer] error", { error })
      return this.fallback(params)
    }
  }

  private buildSystemPrompt(params: BuildParams): string {
    const { context } = params
    return [
      "Sei un assistente per e-commerce, tono naturale e conciso.",
      "Regole:",
      "- Saluta solo una volta per sessione. Se c'è un intro, usalo, altrimenti salta il saluto se non serve.",
      "- Se c'è UNA sola categoria/gruppo: NON chiedere quale gruppo, NON usare liste numerate. Mostra subito i prodotti (max 5) in bullet con un breve framing naturale.",
      "- Se ci sono più gruppi: presenta i titoli dei gruppi con 2-3 prodotti ciascuno, tono conversazionale, evita comunque liste numerate rigide.",
      "- Usa il tono del workspace se fornito; niente template rigidi.",
      "- Non inventare prodotti, prezzi, SKU o offerte: usa solo quelli nel payload.",
      "- Se l'utente è guest (prezzi mancanti), non inserire prezzi.",
      "- Se presente registrationPrompt, includila in chiusura naturale.",
      "- Se ci sono FAQ rilevanti, inseriscile in forma breve, non come blocchi separati.",
      "- Se ci sono servizi, descrivili con tono commerciale sintetico, evitando di fermarti al primo.",
      "- Fai massimo 1-2 domande di chiarimento, solo se utili.",
      "- Rispetta la lingua del cliente se fornita, altrimenti italiano.",
    ].join("\n")
  }

  private buildUserContent(params: BuildParams): string {
    const { output, context, customerLanguage } = params
    const lang = customerLanguage || "en"
    const blocks: any = {
      intro: output.intro,
      productGroups: output.productGroups,
      faqSections: output.faqSections,
      offerSections: output.offerSections,
      serviceSections: output.serviceSections,
      questions: output.questions,
      registrationPrompt: output.registrationPrompt,
      preferences: context.preferences,
      toneOfVoice: context.workspace.toneOfVoice,
      conversationSummary: context.conversation.summary,
      recentMessages: context.conversation.recentMessages?.slice(-4),
      customerName: context.customerProfile?.name,
      isRegistered: params.isRegistered ?? true,
      language: lang,
    }
    return JSON.stringify(blocks, null, 2)
  }

  private fallback(params: BuildParams): string {
    const { output } = params
    const parts: string[] = []
    if (output.intro) parts.push(output.intro)
    if (output.productGroups?.length) {
      output.productGroups.forEach((g) => {
        parts.push(`\n${g.title}:`)
        g.items.slice(0, 5).forEach((p) => {
          const price = p.price ? ` (${p.price}€)` : ""
          parts.push(`• ${p.name}${price}`)
        })
      })
    }
    if (output.faqSections?.length) {
      parts.push("\nFAQ:")
      output.faqSections.slice(0, 2).forEach((f) => {
        parts.push(`• ${f.question}: ${f.answer}`)
      })
    }
    if (output.registrationPrompt) {
      parts.push("\n" + output.registrationPrompt)
    }
    if (output.questions?.length) {
      parts.push(output.questions[0])
    }
    return parts.filter(Boolean).join("\n")
  }
}
