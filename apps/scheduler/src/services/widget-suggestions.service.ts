import { translationService } from './translation.service'
import logger from '../utils/logger'

interface BuildWidgetSuggestionsInput {
  workspaceId: string
  response: string
  language?: string
  model?: string
}

const MAX_SUGGESTIONS = 4
const MAX_LEN = 80
const FORBIDDEN = /(https?:\/\/|www\.|@|mailto:)/i

export async function buildWidgetSuggestions({
  response,
  language = 'it',
}: BuildWidgetSuggestionsInput): Promise<string[]> {
  try {
    // Simple heuristic: split by sentence/line, take first short snippets
    const rawPieces = response
      .split(/\n|\.|\?|\!/g)
      .map((s) => s.trim())
      .filter((s) => s.length > 0)

    const unique: string[] = []
    for (const piece of rawPieces) {
      if (unique.length >= MAX_SUGGESTIONS) break
      if (piece.length > MAX_LEN) continue
      if (FORBIDDEN.test(piece)) continue
      if (unique.some((p) => p.toLowerCase() === piece.toLowerCase())) continue
      unique.push(piece)
    }

    if (unique.length === 0) {
      return []
    }

    // Optionally translate to workspace/customer language
    const translated: string[] = []
    for (const text of unique) {
      const t = await translationService.translateMessage(text, language)
      translated.push(t || text)
    }

    return translated.slice(0, MAX_SUGGESTIONS)
  } catch (error) {
    logger.error('[WidgetSuggestions] Failed to build suggestions', error)
    return []
  }
}
