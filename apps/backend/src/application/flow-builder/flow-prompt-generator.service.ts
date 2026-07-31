/**
 * Turns a compiled flow into a human-readable instruction prompt via an LLM.
 *
 * The compiler already produces `compiledPrompt`: a precise, deterministic
 * transcript of the graph (Q, branches, terminals). That is what the runtime
 * executes, and it stays the source of truth.
 *
 * What it is NOT is pleasant to read or edit. This service asks an LLM to
 * rewrite it as plain instructions, which the user reviews and can amend before
 * saving — so a non-technical operator can sanity-check what the bot will
 * actually do, in words rather than in a node graph.
 */
import axios from "axios"
import logger from "../../utils/logger"

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

// Rewriting a prompt is a short, low-creativity task: a small fast model is
// enough, and temperature stays low so the output tracks the graph closely
// instead of inventing steps that are not in it.
const MODEL = process.env.FLOW_PROMPT_MODEL || "anthropic/claude-haiku-4.5"
const TEMPERATURE = 0.2
const TIMEOUT_MS = 30_000

const SYSTEM_PROMPT = `You turn a chatbot conversation flow into clear operating instructions.

You will receive a compiled flow: questions, the answers a customer can give, and where each answer leads.

Rewrite it as instructions the assistant can follow, in plain prose. Rules:
- Describe ONLY what is in the flow. Never invent a step, question or outcome.
- Keep every branch and every escalation — those are the important parts.
- Preserve the exact wording of questions the assistant must ask.
- Use short paragraphs or a numbered list. No markdown headings, no preamble.
- Write in the same language as the flow's questions.
- Output the instructions only — no commentary about what you did.`

export interface GenerateFlowPromptInput {
  compiledPrompt: string
  flowTitle: string
}

/**
 * Discriminated union: `ok` is a literal type, which is what lets callers narrow
 * to `prompt` or `error` without casts.
 */
export type GenerateFlowPromptResult =
  | { ok: true; prompt: string; error?: never }
  | { ok: false; prompt?: never; error: string }

export async function generateFlowPrompt(
  input: GenerateFlowPromptInput
): Promise<GenerateFlowPromptResult> {
  const apiKey = process.env.OPENROUTER_API_KEY
  if (!apiKey) {
    logger.error("[flow-prompt] OPENROUTER_API_KEY not set")
    return { ok: false, error: "AI prompt generation is not configured on this server." }
  }

  // An empty graph has nothing to describe; calling the LLM would just make it
  // invent a flow that does not exist.
  if (!input.compiledPrompt.trim()) {
    return { ok: false, error: "This flow has no questions yet — add one before generating a prompt." }
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

    const prompt = response.data?.choices?.[0]?.message?.content?.trim()
    if (!prompt) {
      logger.error("[flow-prompt] LLM returned an empty response")
      return { ok: false, error: "The AI returned an empty prompt. Try again." }
    }

    return { ok: true, prompt }
  } catch (error: any) {
    // Surface the two failures a user can act on; everything else is generic.
    const status = error?.response?.status
    logger.error("[flow-prompt] Generation failed:", { status, message: error?.message })

    if (status === 429) {
      return { ok: false, error: "The AI service is rate-limited right now. Try again in a moment." }
    }
    if (error?.code === "ECONNABORTED") {
      return { ok: false, error: "The AI took too long to respond. Try again." }
    }
    return { ok: false, error: "Could not generate the prompt. Your flow was not affected." }
  }
}
