import { prisma } from '../config/database'
import logger from '../utils/logger'
import { TRANSLATION_LLM_SETTINGS } from '../../../../shared/translation-prompts'

export interface DuplicateCheckResult {
  isDuplicate: boolean
  reason?: string
}

/**
 * Duplicate Content Agent (Andrea, 2026-09-12)
 *
 * Different job from SecurityAgentService: that one judges whether ONE
 * message is safe to send. This one judges whether a customer is about to
 * receive the SAME OFFER twice from two DIFFERENT campaigns — something no
 * database constraint can catch, because it takes reading the content, not
 * matching a key. A `@@unique(campaignId, customerId)` already makes a
 * second send from the SAME campaign impossible at the DB level; this agent
 * exists only for the cross-campaign case that constraint cannot see.
 *
 * Cost control: the LLM is called ONLY when a deterministic pre-filter finds
 * at least one other push-campaign message sent to this customer in the
 * lookback window. A customer with no recent push history costs nothing.
 */
export class DuplicateContentAgentService {
  private readonly apiKey = process.env.OPENROUTER_API_KEY || ''
  private readonly baseUrl = 'https://openrouter.ai/api/v1'
  private readonly model = process.env.LLM_MODEL || TRANSLATION_LLM_SETTINGS.model
  private readonly lookbackDays = 7

  /**
   * @param excludeCampaignId The campaign about to send — its own past runs
   * are not "another campaign" and are already covered by the DB constraint.
   */
  async checkRecentDuplicate(params: {
    workspaceId: string
    customerId: string
    messageContent: string
    excludeCampaignId: string
  }): Promise<DuplicateCheckResult> {
    const { workspaceId, customerId, messageContent, excludeCampaignId } = params

    const since = new Date(Date.now() - this.lookbackDays * 24 * 60 * 60 * 1000)
    const recentPushes = await prisma.conversationMessage.findMany({
      where: {
        workspaceId,
        customerId,
        agentType: 'PUSH_CAMPAIGN',
        createdAt: { gte: since },
        NOT: { functionArguments: { path: ['campaignId'], equals: excludeCampaignId } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5, // A handful of recent pushes is enough signal; more is wasted tokens.
      select: { content: true },
    })

    if (recentPushes.length === 0) {
      return { isDuplicate: false }
    }

    if (!this.apiKey) {
      logger.warn('⚠️ [DUPLICATE-CONTENT] OPENROUTER_API_KEY missing - skipping LLM check, allowing send')
      return { isDuplicate: false }
    }

    try {
      const priorMessages = recentPushes
        .map((m, i) => `${i + 1}. "${m.content}"`)
        .join('\n')

      const systemPrompt =
        'You compare a NEW promotional message against a customer\'s recently received ones. ' +
        'Answer whether the NEW message offers substantially the SAME thing as one of the prior ' +
        'ones (same venue/event/offer, reworded) — not just the same topic or category. ' +
        'Respond with JSON only: {"duplicate": true/false, "reason": "..."}'

      const userMessage =
        `Messages this customer already received in the last ${this.lookbackDays} days:\n${priorMessages}\n\n` +
        `NEW message about to be sent:\n"${messageContent}"`

      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.FRONTEND_URL || 'https://echatbot.ai',
          'X-Title': 'eChatbot Duplicate Content Check',
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userMessage },
          ],
          temperature: 0,
          max_tokens: 200,
          response_format: { type: 'json_object' },
        }),
      })

      if (!response.ok) {
        logger.warn('⚠️ [DUPLICATE-CONTENT] LLM call failed - allowing send', {
          status: response.status,
        })
        return { isDuplicate: false }
      }

      const data: any = await response.json()
      const llmResponse = data?.choices?.[0]?.message?.content
      if (!llmResponse) return { isDuplicate: false }

      let parsed: { duplicate?: boolean; reason?: string }
      try {
        parsed = JSON.parse(llmResponse)
      } catch {
        logger.warn('⚠️ [DUPLICATE-CONTENT] Unparseable LLM response - allowing send')
        return { isDuplicate: false }
      }

      return { isDuplicate: parsed.duplicate === true, reason: parsed.reason }
    } catch (error) {
      logger.warn('⚠️ [DUPLICATE-CONTENT] Check error - allowing send (fail-open)', { error })
      return { isDuplicate: false }
    }
  }
}

export const duplicateContentAgentService = new DuplicateContentAgentService()
