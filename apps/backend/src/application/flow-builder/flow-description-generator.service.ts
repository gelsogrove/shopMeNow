/**
 * Derives a flow's description from its compiled graph via an LLM.
 *
 * Why this is generated rather than typed by the user: the description exists
 * for RETRIEVAL, but the user writes for themselves. Asked for a title they
 * type the trigger they have in mind ("se un utente ha errore ERROR 001");
 * asked for a description on top of that, they either leave it empty or
 * restate the title. Neither helps a customer message match.
 *
 * The graph, though, already contains the answer: its questions describe the
 * symptoms being checked. So the description is inferred from the compiled
 * prompt and phrased in the CUSTOMER's words — which is the text an incoming
 * WhatsApp message has to resemble for the embedding to match.
 *
 * The result is a suggestion: it is returned for review and stays editable.
 */
import axios from "axios"
import logger from "../../utils/logger"

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

// Same reasoning as the prompt generator: short, low-creativity rewrite, so a
// small fast model with a low temperature keeps the output anchored to the graph.
const MODEL = process.env.FLOW_DESCRIPTION_MODEL || "anthropic/claude-haiku-4.5"
const TEMPERATURE = 0.2
const TIMEOUT_MS = 30_000

// Guardrail, not a formatting preference: this text is embedded, and a long
// description dilutes the vector with incidental words. Two sentences of
// symptoms is what makes a match; a paragraph makes it fuzzier.
const MAX_DESCRIPTION_CHARS = 400

const SYSTEM_PROMPT = `You write the "when to use" description of a chatbot troubleshooting flow.

You receive a flow: its title, and the questions the assistant asks.

Write 1-2 sentences describing WHEN this flow applies — the situation and the symptoms the customer would notice.

Rules:
- Write the symptoms the way a CUSTOMER would describe them to support, not in technical shorthand.
- If the title contains an error code or a technical label, keep it AND explain what the customer actually sees.
- Infer the symptoms only from the questions in the flow. Never invent a cause, a fix or a step that is not there.
- Do not describe the procedure, the questions or the outcome. Only the situation that triggers this flow.
- Maximum 2 sentences. No markdown, no heading, no preamble, no quotes around the answer.
- Write in the same language as the flow's questions.
- Output the description only.`

export interface GenerateFlowDescriptionInput {
  compiledPrompt: string
  flowTitle: string
}

/** Mirrors GenerateFlowPromptResult: `ok` narrows to `description` or `error`. */
export type GenerateFlowDescriptionResult =
  | { ok: true; description: string; error?: never }
  | { ok: false; description?: never; error: string }

export async function generateFlowDescription(
  input: GenerateFlowDescriptionInput
): Promise<GenerateFlowDescriptionResult> {
  // Checked BEFORE the API key: an empty graph is the user's problem and the
  // message tells them exactly what to do, whereas "not configured" points them
  // at a server issue they cannot act on. Both are true at once on an
  // unconfigured server, so the actionable one has to win.
  //
  // With no questions there are no symptoms to infer from, and the model would
  // just elaborate on the title — inventing a case that does not exist.
  if (!input.compiledPrompt.trim()) {
    return {
      ok: false,
      error: "This flow has no questions yet — add one before generating a description.",
    }
  }

  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    logger.error("[flow-description] OPENROUTER_API_KEY not set")
    return { ok: false, error: "AI description generation is not configured on this server." }
  }

  try {
    const response = await axios.post(
      OPENROUTER_URL,
      {
        model: MODEL,
        temperature: TEMPERATURE,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          {
            role: "user",
            content: `Flow title: ${input.flowTitle}\n\n${input.compiledPrompt}`,
          },
        ],
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        timeout: TIMEOUT_MS,
      }
    )

    const raw = response.data?.choices?.[0]?.message?.content?.trim()
    if (!raw) {
      logger.error("[flow-description] LLM returned an empty response")
      return { ok: false, error: "The AI returned an empty description. Try again." }
    }

    return { ok: true, description: normalizeDescription(raw) }
  } catch (error: any) {
    // Same three actionable failures the prompt generator surfaces.
    const status = error?.response?.status
    logger.error("[flow-description] Generation failed:", { status, message: error?.message })

    if (status === 429) {
      return { ok: false, error: "The AI service is rate-limited right now. Try again in a moment." }
    }
    if (error?.code === "ECONNABORTED") {
      return { ok: false, error: "The AI took too long to respond. Try again." }
    }
    return { ok: false, error: "Could not generate the description." }
  }
}

/**
 * Flattens the output to the single line the description field expects.
 *
 * Small models occasionally wrap the sentence in quotes or return it as a
 * bullet despite the instructions; the field is embedded verbatim, so those
 * characters would end up in the vector. Truncation is a last-resort clamp on
 * MAX_DESCRIPTION_CHARS, cut at a word boundary so the text stays readable.
 */
export function normalizeDescription(raw: string): string {
  let text = raw
    .replace(/\s+/g, " ")
    .replace(/^[-*•]\s*/, "")
    .trim()

  // Only strip quotes that wrap the WHOLE text — a quoted phrase inside the
  // sentence is legitimate content. [\s\S] rather than the `s` flag: the
  // backend's tsconfig target predates it, and whitespace is already collapsed
  // above anyway.
  const WRAPPING_QUOTES = /^["'«]([\s\S]*)["'»]$/
  if (text.length > 1 && WRAPPING_QUOTES.test(text)) {
    text = text.replace(WRAPPING_QUOTES, "$1").trim()
  }

  if (text.length > MAX_DESCRIPTION_CHARS) {
    const clipped = text.slice(0, MAX_DESCRIPTION_CHARS)
    const lastSpace = clipped.lastIndexOf(" ")
    text = (lastSpace > 0 ? clipped.slice(0, lastSpace) : clipped).trimEnd() + "…"
  }

  return text
}
