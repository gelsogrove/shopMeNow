import { handleTurn } from './chatbot.js'
import { loadRuntime, type Runtime } from './utils/runtime.js'
import { createInitialState } from './utils/state.js'
import type { ChatbotInput, ChatbotOutput } from './types.js'

const ESCALATION_MARKER = '**👤 Human Support message**'

let runtimePromise: Promise<Runtime> | null = null

function getRuntime(): Promise<Runtime> {
  if (!runtimePromise) {
    runtimePromise = loadRuntime()
  }
  return runtimePromise
}

function parseEscalation(reply: string): { reply: string; escalationSummary?: string } {
  if (!reply.includes(ESCALATION_MARKER)) {
    return { reply }
  }

  const [customerReply, summary] = reply.split(ESCALATION_MARKER)
  const cleanReply = customerReply.trim()
  const cleanSummary = (summary || '').trim()

  return {
    reply: cleanReply,
    escalationSummary: cleanSummary || undefined,
  }
}

function buildDebugPayload(input: ChatbotInput, replayedTurns: number, debugSteps: string[]): unknown {
  return {
    workspaceId: input.config.workspaceId,
    sessionId: input.context.sessionId,
    channel: input.channel,
    replayedUserTurns: replayedTurns,
    debugSteps,
  }
}

/**
 * Pure LLM pipeline function.
 *
 * Guards (channelActive, wipMessage, welcomeMessage) are handled by the
 * wrapper (CustomClientChatbotService.invoke()) BEFORE calling this function.
 * chatbotFn only processes the LLM pipeline and returns a reply.
 */
export async function chatbotFn(input: ChatbotInput): Promise<ChatbotOutput> {
  const baseOutput: ChatbotOutput = {
    reply: null,
    shouldEscalate: false,
    meta: {
      tokensUsed: 0,
      agentChain: ['router', 'specialist', 'response-builder'],
    },
  }

  try {
    const runtime = await getRuntime()
    const state = createInitialState()
    let replayedTurns = 0

    if (input.config.language) {
      state.language = input.config.language
      state.preferredLanguage = input.config.language
    }

    for (const message of input.context.history) {
      if (message.role !== 'user') {
        continue
      }

      const content = (message.content || '').trim()
      if (!content) {
        continue
      }

      await handleTurn(runtime, state, content)
      replayedTurns += 1
    }

    const turnResult = await handleTurn(runtime, state, input.userMessage)
    const parsed = parseEscalation(turnResult.reply)

    const output: ChatbotOutput = {
      reply: parsed.reply,
      shouldEscalate: Boolean(parsed.escalationSummary),
      escalationSummary: parsed.escalationSummary,
      meta: {
        tokensUsed: 0,
        agentChain: ['router', 'specialist', 'response-builder'],
      },
    }

    if (input.config.debugChannel) {
      output.meta.debug = buildDebugPayload(input, replayedTurns, turnResult.debug)
    }

    return output
  } catch (error) {
    const output: ChatbotOutput = {
      ...baseOutput,
      error: error instanceof Error ? error.message : String(error),
    }

    if (input.config.debugChannel) {
      output.meta.debug = buildDebugPayload(input, 0, ['pipeline-error'])
    }

    return output
  }
}

export type { ChatbotInput, ChatbotOutput } from './types.js'
