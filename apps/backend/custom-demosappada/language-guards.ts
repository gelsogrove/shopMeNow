// Language detection and repair on OUR side of the conversation: the
// greeting whose language is unmistakable, the model-written greeting that
// must be stripped, and the "is this reply obviously in the wrong language"
// check. Nothing here routes intent from user text (CLAUDE.md §14).

/**
 * Words a self-introduction opens with, in the languages this workspace
 * serves. Matching the SHAPE of a greeting, not any particular sentence:
 * the tenant's welcome is configuration and may say anything, while what the
 * model improvises is always some form of "hello, I am the assistant".
 */
const GREETING_OPENERS =
  /^(ciao|salve|buongiorno|buonasera|benvenut\w*|hi|hello|hey|welcome|good (morning|afternoon|evening)|hallo|guten (tag|morgen|abend)|willkommen|hola|bienvenid\w*|bonjour|bienvenue)\b/i

/** Does this line introduce the assistant rather than answer anything? */
const SELF_INTRODUCTION =
  /(sono l'assistente|sono il tuo assistente|assistente (virtuale|digitale)|i am the|i'm the .*assistant|ich bin (der|die|dein)|soy el asistente|je suis l'assistant)/i

/**
 * Drop an opening greeting the model wrote, keeping the answer under it.
 *
 * Conservative on purpose: only leading paragraphs are considered, and only
 * while they look like an introduction — the moment a paragraph carries real
 * content the rest is returned untouched. Cutting an answer would be a far
 * worse failure than leaving one greeting too many.
 */
export function stripLeadingGreeting(reply: string): string {
  const paragraphs = reply.split(/\n{2,}/)
  let start = 0
  let sawGreeting = false

  while (start < paragraphs.length) {
    const paragraph = paragraphs[start].trim()
    if (!paragraph) {
      start++
      continue
    }

    // Anything carrying a fact — a number, an hour, a price, a bullet list —
    // is the answer, and the answer is never dropped.
    if (/\d/.test(paragraph) || /^[-•*]/m.test(paragraph)) break

    const opensAsGreeting = GREETING_OPENERS.test(paragraph) || SELF_INTRODUCTION.test(paragraph)

    // The paragraphs that FOLLOW a greeting are still preamble while they only
    // restate what the assistant can do ("I'm here to help you discover…",
    // "how can I help?"). One greeting from the model was three paragraphs
    // long, and cutting only the first left the rest under the real welcome.
    const continuesPreamble =
      sawGreeting &&
      /(aiutart|aiutarl|posso aiutar|sono qui per|dimmi pure|come posso|scoprire il meglio|here to help|how can i help|tell me|wie kann ich|ich helfe|estoy aquí para)/i.test(
        paragraph,
      )

    if (!opensAsGreeting && !continuesPreamble) break

    sawGreeting = true
    start++
  }

  return paragraphs.slice(start).join('\n\n').trim()
}

/**
 * Function words that identify a language cheaply, without an LLM call.
 *
 * Only used to answer "is this reply obviously NOT in the declared language",
 * so a wrong guess costs one translation call, never a wrong answer. Nothing
 * here routes the conversation (CLAUDE.md §14): it checks output, not intent.
 */
/**
 * The language of an opening greeting, when it is unmistakable.
 *
 * The widget sends the BROWSER's language, and a guest whose browser is in
 * English typed "Ciao" and was answered in English — the one thing that tells
 * someone nobody read what they wrote (Andrea, 2026-08-25). The prompt already
 * says to detect the language from the message; the model followed the seed
 * anyway, so the decision is taken here instead (iron rule 1).
 *
 * NOT phrase-based intent detection (CLAUDE.md §14): nothing here reads what
 * the guest WANTS. It answers one question — which language is this word — on
 * a closed list of greetings, the same job a language detector does.
 *
 * Deliberately narrow. Only words that belong to ONE language and are spelled
 * the same nowhere else: "hola" is Spanish, "ciao" is Italian, but "ok" and
 * "hi" are international and are left to the seed.
 */
export const GREETING_LANGUAGES: Record<string, string> = {
  ciao: 'it', salve: 'it', buongiorno: 'it', buonasera: 'it',
  hola: 'es', buenas: 'es',
  bonjour: 'fr', salut: 'fr', bonsoir: 'fr',
  hallo: 'de', guten: 'de', servus: 'de', moin: 'de',
  hello: 'en', hey: 'en',
  ola: 'pt',
  hej: 'da',
  hoi: 'nl', goedendag: 'nl',
}

/**
 * The language of a short opening message, or null when it carries no signal.
 *
 * Only consulted for the FIRST message of a conversation, and only when it is
 * short enough to be a greeting and nothing else: a real sentence is left to
 * the model, which reads it better than a word list can.
 */
export function greetingLanguage(message: string): string | null {
  const words = message
    .toLowerCase()
    .replace(/[^\p{L}\s]/gu, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0)
  if (words.length === 0) return null

  // A greeting we recognise settles it outright.
  if (words.length <= 3) {
    for (const word of words) {
      const lang = GREETING_LANGUAGES[word]
      if (lang) return lang
    }
  }

  // Otherwise weigh the FUNCTION words of each language we serve. "ao voglio
  // fae passeggiate" is Italian written badly — no greeting in it, and the
  // guest was answered in English because the browser said so (Andrea,
  // 2026-08-25: "non è in italiano?"). Function words survive typos: the
  // misspelled nouns are ignored, "voglio" is not.
  //
  // Only when ONE language leads outright — a tie is left to the model, which
  // reads a real sentence better than a word list can. "ok" and "sports"
  // belong to no language here and keep the host's seed.
  const scores = Object.entries(OPENING_LANGUAGE_MARKERS)
    .map(([code, re]) => {
      re.lastIndex = 0
      return { code, hits: (message.match(re) || []).length }
    })
    .sort((a, b) => b.hits - a.hits)
  const [best, second] = scores
  if (best && best.hits >= 1 && best.hits > (second?.hits ?? 0)) return best.code

  // Marker silence or tie: an unmistakable greeting OPENING the message still
  // decides. "CIAO PIACERE VOGLIAMO VEDERE SAPPADA" is five words, so the
  // short-message rule above never saw its "ciao"; none of the other words is
  // in the Italian function-word list, the scores tied 0-0, and the browser's
  // Spanish seed won — the whole welcome went out in Spanish (Andrea, live,
  // 2026-08-27: "ASSURDO CHE SIA IN SPAGNOLO"). A greeting is weaker evidence
  // than a clear function-word winner (a "Hallo" opening an English sentence
  // must not force German), which is why this runs AFTER the scoring — but it
  // beats a seed the guest never typed. First two words only: that is where a
  // greeting lives.
  for (const word of words.slice(0, 2)) {
    const lang = GREETING_LANGUAGES[word]
    if (lang) return lang
  }
  return null
}

/**
 * Function words that identify the language of an OPENING message.
 *
 * Separate from LANGUAGE_MARKERS below, which answers a different question
 * ("is this reply obviously NOT in the declared language") on long text and
 * must stay tuned for that. This list is wider on purpose — pronouns, verbs
 * and prepositions a guest uses in their very first line — because here a
 * single hit has to be enough.
 */
const OPENING_LANGUAGE_MARKERS: Record<string, RegExp> = {
  it: /\b(il|la|le|gli|di|che|per|sono|siete|questo|quanto|giorno|oggi|voglio|vorrei|dove|come|quando|con|una|un|non|mi|ci|se|ho|abbiamo|siamo|stiamo|fare|posso|vogliamo|vorremmo|veniamo|possiamo)\b/gi,
  es: /\b(el|los|las|de|que|para|est[aá]|sois|cu[aá]nto|d[ií]a|hoy|quiero|d[oó]nde|con|una|un|no|estamos|somos|hacer|puedo|queremos|podemos|venimos)\b/gi,
  en: /\b(the|and|for|you|are|this|how|many|day|today|want|where|with|have|we|is|to|my|can|there)\b/gi,
  de: /\b(der|die|das|und|f[uü]r|sind|ihr|wie|viele|tag|heute|m[oö]chte|wo|mit|wir|haben|ist|kann)\b/gi,
  fr: /\b(le|les|des|que|pour|vous|[eê]tes|combien|jour|aujourd|veux|o[uù]|avec|nous|avons|puis)\b/gi,
  pt: /\b(os|as|de|que|para|est[aã]o|quantos|dia|hoje|quero|onde|com|temos|posso)\b/gi,
  nl: /\b(de|het|een|en|voor|zijn|hoeveel|dag|vandaag|wil|waar|met|hebben|kan)\b/gi,
  da: /\b(og|det|den|for|er|hvor|mange|dag|vil|med|har|kan)\b/gi,
}

const LANGUAGE_MARKERS: Record<string, RegExp> = {
  it: /\b(il|la|le|gli|di|che|per|sono|siete|questo|quanto|giorno|oggi)\b/gi,
  es: /\b(el|la|los|las|de|que|para|est[aá]|sois|cu[aá]nto|d[ií]a|hoy|hola)\b/gi,
  en: /\b(the|and|for|you|are|this|how|many|day|today)\b/gi,
  de: /\b(der|die|das|und|f[uü]r|sind|ihr|wie|viele|tag|heute)\b/gi,
  fr: /\b(le|la|les|des|que|pour|vous|[eê]tes|combien|jour|aujourd)\b/gi,
  pt: /\b(o|os|as|de|que|para|est[aã]o|quantos|dia|hoje)\b/gi,
  nl: /\b(de|het|een|en|voor|zijn|hoeveel|dag|vandaag)\b/gi,
  da: /\b(og|det|den|for|er|hvor|mange|dag|i dag)\b/gi,
}

function countMarkers(text: string, language: string): number {
  const re = LANGUAGE_MARKERS[language]
  if (!re) return 0
  return (text.match(re) || []).length
}

/**
 * Does the text look like it is NOT in `language`, while clearly being in
 * another one we know? Conservative: only returns true when some other
 * language scores clearly higher, so an ambiguous short reply is left alone.
 */
export function looksLikeWrongLanguage(text: string, language: string): boolean {
  const words = text.split(/\s+/).length
  if (words < 8) return false // too short to judge

  const declared = countMarkers(text, language)
  let best = declared
  let bestLang = language
  for (const other of Object.keys(LANGUAGE_MARKERS)) {
    if (other === language) continue
    const score = countMarkers(text, other)
    if (score > best) {
      best = score
      bestLang = other
    }
  }
  return bestLang !== language && best >= declared + 3
}
