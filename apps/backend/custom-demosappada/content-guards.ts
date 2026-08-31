/**
 * Deterministic checks on what the model is about to send.
 *
 * The main prompt says "never invent a URL or a phone number". That is an
 * instruction, and instructions are probabilistic — a tourist sent to a
 * mistyped number or a made-up page is the failure this module exists to
 * avoid (CLAUDE.md §16 iron rule 1: the fix for a misbehaving LLM is code
 * that removes its freedom, not another sentence asking it to behave).
 *
 * So the facts that can actually strand someone — links and phone numbers —
 * are checked against the FAQ block they must come from. Anything the
 * approved content does not contain is removed before the reply goes out.
 */

/** Bare URLs. Trailing sentence punctuation is trimmed by the caller. */
const URL_RE = /https?:\/\/[^\s<>()\[\]]+/gi

/**
 * Markdown links as a UNIT: `[label](url)`, with the url possibly absent.
 *
 * Stripping only the URL out of a markdown link left the dead label behind:
 * a guest asking for photos was sent "[Sappada - Galleria Fotografica]()" —
 * a link that goes nowhere, dressed up as an answer (Andrea, live,
 * 2026-08-27). The empty-parens form also arrives straight from the model,
 * which writes `[label]()` when it wants to cite a page it does not have.
 * Either way the whole construct is removed: a label without a destination
 * is a promise the reply cannot keep.
 */
const MD_LINK_RE = /\[([^\]\n]*)\]\(\s*(https?:\/\/[^\s)]*)?\s*\)/g

/**
 * Italian phone numbers as a tourist would read them: an optional +39, then
 * 6-11 digits possibly broken by spaces, dots or dashes.
 *
 * The separator class is deliberately HORIZONTAL only. With \s in there the
 * match ran across a line break, so "tel. 0435 469265\n3. La Rustica" was one
 * number: stripping it removed the next list item's marker too, and the reply
 * went out as "tel.. Ristorante La Rustica" (live run, 2026-08-22).
 */
const PHONE_RE = /(?:\+39[ .-]?)?\d(?:[ .-]?\d){5,10}/g

/** Short numbers that are facts about the world, not tenant data. */
const EMERGENCY_NUMBERS = new Set(['112', '113', '115', '116', '117', '118', '1515', '1530'])

function normalizeUrl(raw: string): string {
  return raw.replace(/[)\].,;:!?]+$/, '').toLowerCase()
}

/** Whether the source actually states this URL, tolerating scheme/slash drift. */
function urlIsApproved(raw: string, haystack: string): boolean {
  const url = normalizeUrl(raw)
  if (haystack.includes(url)) return true
  const withoutScheme = url.replace(/^https?:\/\//, '').replace(/\/$/, '')
  return withoutScheme.length > 0 && haystack.includes(withoutScheme)
}

function digitsOf(raw: string): string {
  return raw.replace(/\D/g, '')
}

export interface ContentCheck {
  /** The reply with unverifiable links/numbers removed. */
  text: string
  /** What was stripped, for the log. Empty when the reply was clean. */
  removed: string[]
}

/**
 * Strip every URL and phone number that does not appear in `approvedContent`
 * (the FAQ block plus any tool output served this turn).
 *
 * Removal, not refusal: a reply that is otherwise useful should still reach
 * the customer, minus the part that could send them somewhere that does not
 * exist. Emergency numbers pass unconditionally — they are not tenant data
 * and must never be filtered out of a reply about an emergency.
 */
/**
 * Clock times as a guest reads them: "9.00", "17:30", "8-12".
 *
 * Bare integers are deliberately NOT matched — "20 minuti di cammino" and
 * "2 ore" are durations the model derives legitimately from the source, and
 * stripping them would gut correct answers to catch nothing.
 */
const TIME_RE = /\b([01]?\d|2[0-3])[.:][0-5]\d\b/g

/** Prices: an amount with a currency mark, in either order. */
const PRICE_RE = /(?:€\s?\d+(?:[.,]\d{1,2})?|\b\d+(?:[.,]\d{1,2})?\s?(?:€|euro))/gi

/** Digits only, so "9.00" and "9:00" compare equal. */
function timeDigits(raw: string): string {
  return raw.replace(/\D/g, '')
}

/**
 * A price as a comparable value, so "€45" and "45 euro" compare equal.
 *
 * The decimal separator is KEPT (normalised to a dot) and trailing zeros
 * dropped, so "3,5" and "3.50" agree while staying distinct from "35".
 * Stripping every non-digit made "3,5 km" — a walking distance in a FAQ —
 * approve an invented "35 euro" (found while testing this guard, 2026-08-23).
 */
function priceValue(raw: string): string {
  const digits = raw.replace(/[^\d.,]/g, '').replace(',', '.')
  const [whole, decimals] = digits.split('.')
  const fraction = (decimals ?? '').replace(/0+$/, '')
  return fraction.length > 0 ? `${whole}.${fraction}` : whole
}

/**
 * Every clock time the source actually states, as digits ("9.00" -> "900").
 *
 * Times and prices are SHORT, and the old check asked whether their digits
 * appeared anywhere in the source's digits concatenated end to end. Across
 * this tenant's 78 FAQ entries that haystack is ~2300 digits long, so a
 * two-digit price matched 89 times out of 90 — usually straddling the seam
 * between two unrelated numbers, e.g. "607" found inside a phone number.
 * The guard was reporting clean while passing invented amounts through.
 *
 * So the source is tokenised the same way the reply is: a value is approved
 * only when it appears there as a value in its own right. Phone numbers keep
 * the substring test — at 6+ digits they are too long to collide by accident,
 * and they legitimately appear formatted in ways a token scan would miss.
 */
function timesIn(source: string): Set<string> {
  const found = new Set<string>()
  for (const match of source.matchAll(TIME_RE)) found.add(timeDigits(match[0]))
  return found
}

/**
 * Every number the source states as a standalone figure, digits only.
 *
 * Deliberately wider than PRICE_RE: the source may write "3 chilogrammi" or
 * "22 cm" while the reply phrases it as a price or a bare figure. What is
 * excluded is digits glued to other digits by separators — a phone number's
 * parts must not each become an approved "price".
 */
function standaloneNumbersIn(source: string): Set<string> {
  const found = new Set<string>()
  for (const match of source.matchAll(/(?<![\d.,:\-])\d+(?:[.,]\d{1,2})?(?![\d.,:\-])/g)) {
    found.add(priceValue(match[0]))
  }
  return found
}

export function stripUnverifiableContacts(reply: string, approvedContent: string): ContentCheck {
  const haystack = approvedContent.toLowerCase()
  const haystackDigits = digitsOf(approvedContent)
  const approvedTimes = timesIn(approvedContent)
  const approvedNumbers = standaloneNumbersIn(approvedContent)
  const removed: string[] = []

  // Markdown links go FIRST, whole: once the bare-URL pass has hollowed one
  // out, the `[label]()` husk no longer says which URL it carried.
  let text = reply.replace(MD_LINK_RE, (match, _label, url: string | undefined) => {
    if (url && urlIsApproved(url, haystack)) return match
    removed.push(match)
    return ''
  })

  text = text.replace(URL_RE, (match) => {
    // A URL may be cited with different trailing punctuation than the source.
    if (urlIsApproved(match, haystack)) return match
    removed.push(match)
    return ''
  })

  // Opening times and prices: the two facts after contacts that send someone
  // somewhere for nothing — a guest who reads "apre alle 9" and finds a
  // closed door has been failed as surely as one given a wrong number.
  // Verified against the source rather than trusted: the prompt already
  // forbids inventing them, and a prompt is a request (CLAUDE.md §16 rule 1).
  //
  // Matched against the values the source actually states, so the model may
  // reformat freely — "9.00" covers "9:00", "€45" covers "45 euro" — without
  // a short amount being approved by digits that merely occur somewhere.
  text = text.replace(TIME_RE, (match) => {
    if (approvedTimes.has(timeDigits(match))) return match
    removed.push(match)
    return ''
  })

  text = text.replace(PRICE_RE, (match) => {
    const digits = priceValue(match)
    if (digits.length === 0) return match
    if (approvedNumbers.has(digits)) return match
    removed.push(match)
    return ''
  })

  // Price BANDS ("€€", "— €", "(€€€)"): the model decorates every venue with
  // one, whether the source states it or not — "Rifugio Sorgenti del Piave —
  // €€" in one run, "— €" in the next, from a FAQ entry that carries no band
  // at all (sim, 2026-08-28; Andrea, live: "rifugio togli il simbolo del
  // dollaro"). A band is a claim about cost, held to the same rule as a price:
  // it stays only when the source states a band for THAT venue — the venue's
  // name and a band within the same source entry. Bands with a digit are the
  // prices handled above.
  text = stripInventedPriceBands(text, haystack, removed)

  text = text.replace(PHONE_RE, (match) => {
    const digits = digitsOf(match)
    if (digits.length < 6) return match
    if (EMERGENCY_NUMBERS.has(digits)) return match
    if (haystackDigits.includes(digits)) return match
    removed.push(match)
    return ''
  })

  if (removed.length > 0) {
    // Tidy the holes left behind: doubled spaces and orphaned punctuation.
    text = text
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/[ \t]+([.,;:!?])/g, '$1')
  }

  // A dangling contact LABEL is scrubbed on EVERY reply, not only after a
  // strip. Two ways it appears:
  // - a stripped phone/URL leaves its label behind — "Tel.. " reached a guest
  //   after the invented number it introduced was removed (Andrea, 2026-08-28
  //   live: "Hotel La Baita ... Tel.. ");
  // - the model, told never to invent numbers, writes the label and simply
  //   stops — the itinerary ended "…le opzioni senza glutine. Tel.." with
  //   nothing stripped at all (Andrea, 2026-08-31 live), so a cleanup gated
  //   on removed.length never ran.
  // Stems over the bot's own output, like OFFER_STEM — never the guest's
  // words (§14).
  const ORPHAN_LABEL_RE =
    /^[\s•\-*]*(?:tel(?:efono)?|phone|t[eé]l[eé]?(?:phone)?|e-?mail|mail|web|sito|website|dettagli|details|info(?:rmazioni)?|contatt[oi]|contacts?)\s*[.:,;]*\s*$/i
  text = text
    // The MID-LINE husk: "Tel.. Anche qui, chiama prima..." — the label sits
    // between its (missing) number and the next sentence, so the line-level
    // filter below never sees a bare label (2026-08-28 live, second form).
    // Removed only when followed by a sentence start, punctuation or the
    // end of the line — "Tel. 0435 469833" (digit next) is never touched.
    // Label case is spelled out ([Tt]el…) instead of /i: a case-insensitive
    // flag would also make the sentence-start lookahead match lowercase, and
    // "il tel. di casa" must never lose its label.
    .replace(
      /\b(?:[Tt][Ee][Ll](?:[Ee][Ff][Oo][Nn][Oo])?|[Pp][Hh][Oo][Nn][Ee]|[Tt][EeÉé][Ll](?:[EeÉé][Pp][Hh][Oo][Nn][Ee])?)\s*[.:]{1,3}\s*(?=[A-ZÀ-Ý]|[.,;]|\n|$)/g,
      '',
    )
    .split('\n')
    .filter((line, i, all) => {
      const bare = line.replace(/^[\s•\-*\d.)]+/, '').trim()
      if (bare.length > 0) return !ORPHAN_LABEL_RE.test(line)
      // Keep single blank lines used as paragraph breaks.
      return line.trim() === '' && all[i - 1]?.trim() !== ''
    })
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()

  return { text, removed }
}

const BAND_RE = /(?:\s*[—–-]\s*|\s*\(\s*)?(€{1,4})(?!\s?\d)(\s*\))?/g

/**
 * Remove a price band from every line whose venue the approved content does
 * not describe with a band. The venue is the bold name on the line, or the
 * text before the band; "described with a band" means the name occurs in the
 * source and a bare band occurs within the 400 characters that follow it —
 * one FAQ entry, in practice.
 */
export function stripInventedPriceBands(reply: string, approvedContent: string, removed: string[]): string {
  const source = approvedContent.toLowerCase()
  const sourceHasBand = (name: string): boolean => {
    const at = source.indexOf(name.toLowerCase())
    if (at < 0) return false
    return /€(?!\s?\d)/.test(source.slice(at, at + 400))
  }
  return reply
    .split('\n')
    .map((line) => {
      if (!/€(?!\s?\d)/.test(line)) return line
      const bold = line.match(/\*\*([^*]+)\*\*/)?.[1]
      const before = line.split(/€/)[0].replace(/[*\s—–\-(]+$/g, '').trim()
      const name = (bold ?? before).trim()
      if (name && sourceHasBand(name)) return line
      return line.replace(BAND_RE, (_match, band: string) => {
        removed.push(band)
        return ''
      })
    })
    .join('\n')
}

/**
 * Drop every venue the reply names in BOLD that the approved content does
 * not know. Bold is reserved for place names (contratto.md: "solo i nomi dei
 * posti devono essere in bold"), so a bold name absent from the FAQ block,
 * the catalogue and the tool results is an invented venue — "Rifugio
 * Fedare, raggiungibile con la funivia" (sim, 2026-08-28), complete with a
 * description and an opening season. The paragraph goes whole: name and the
 * lines under it, up to the next blank line. Matched by the first two words
 * of the name so a shortened or re-accented spelling still counts as known.
 */
export function stripUnknownVenues(reply: string, approvedContent: string): { text: string; removed: string[] } {
  const norm = (t: string): string => t.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim()
  const source = norm(approvedContent)
  const removed: string[] = []
  const known = (name: string): boolean => {
    const words = norm(name).split(' ').filter((w) => w.length > 2)
    if (words.length === 0) return true
    const key = words.slice(0, 2).join(' ')
    return source.includes(key)
  }
  // Only venues are judged: a bold heading that is no venue at all ("**Oggi
  // (sabato 29 agosto)**", "**Per stasera**") is left exactly as written —
  // demoting it to plain text flattened every itinerary (live, 2026-08-29
  // 01:03: "le liste non sono ben formattate"). A venue is a heading that
  // starts with a venue type (rifugio, malga, museo, hotel…) or reads as a
  // proper name (two or more capitalised words).
  const VENUE_TYPE =
    /^(rifugio|malga|museo|latteria|hotel|albergo|agriturismo|ristorante|trattoria|osteria|pizzeria|bar|baita|b&b|chalet|casera|cascat|sorgent|lag[oh]|monte|val|chiesa|santuario|parco|piscina|centro|infopoint|pro loco|seggiovia|funivia|sentiero|borgata|villaggio)\b/i
  const looksLikeVenue = (name: string): boolean => {
    const words = name.trim().split(/\s+/)
    if (VENUE_TYPE.test(name.trim())) return true
    const capitalised = words.filter((w) => /^\p{Lu}/u.test(w)).length
    return words.length >= 2 && capitalised >= 2
  }
  const paragraphs = reply.split(/\n{2,}/)
  const drop = paragraphs.map((p) => {
    const m = p.trim().match(/^\*\*([^*\n]{3,80})\*\*/)
    if (!m || known(m[1]) || !looksLikeVenue(m[1])) return false
    removed.push(m[1].trim())
    return true
  })
  // A lead-in that ends in a colon ("vi consiglio:") introduces what was
  // just removed: it goes too, or the reply ends mid-sentence.
  const isVenue = (p: string): boolean => /^\*\*[^*\n]{3,80}\*\*/.test(p.trim())
  for (let i = 0; i < paragraphs.length - 1; i++) {
    if (drop[i] || !/:\s*$/.test(paragraphs[i].trim())) continue
    let j = i + 1
    let survivor = false
    while (j < paragraphs.length && isVenue(paragraphs[j])) {
      if (!drop[j]) survivor = true
      j++
    }
    if (j > i + 1 && !survivor) drop[i] = true
  }
  const kept = paragraphs.filter((_, i) => !drop[i])
  return { text: kept.join('\n\n').trim(), removed }
}

/**
 * Names of the places the tenant's data knows: the catalogue names as they
 * are, and the FAQ subjects — the part of a question before ":" / "—" / "?"
 * when it reads as a name (2–5 words, capitalised). Deterministic input for
 * `boldKnownVenues`.
 */
export function knownVenueNames(faqQuestions: string[], catalogueNames: string[]): string[] {
  const out = new Set<string>()
  for (const n of catalogueNames) if (n.trim().length >= 4) out.add(n.trim())
  for (const q of faqQuestions) {
    const head = q.split(/[:—–?(]/)[0].trim()
    const words = head.split(/\s+/)
    if (words.length < 2 || words.length > 5) continue
    if (!/^\p{Lu}/u.test(head)) continue
    if (/^(come|dove|quando|quanto|cosa|chi|perch|c'è|ci sono|orari|info)/i.test(head)) continue
    out.add(head)
  }
  return [...out].sort((a, b) => b.length - a.length)
}

/**
 * Put the known place names in bold where the reply mentions them plainly —
 * the contract's format ("solo i nomi dei posti in bold"), applied by code
 * instead of hoped for: the itinerary named the Latteria, the Museo and the
 * Cascatelle in running prose with no bold at all (live, 2026-08-29 01:03).
 * First plain mention per paragraph; text already inside bold is untouched.
 */
export function boldKnownVenues(reply: string, names: string[]): string {
  if (names.length === 0) return reply
  return reply
    .split(/\n{2,}/)
    .map((paragraph) => {
      let p = paragraph
      for (const name of names) {
        const esc = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        const re = new RegExp(`(^|[^*\\p{L}])(${esc})(?=$|[^*\\p{L}])`, 'u')
        const m = p.match(re)
        if (!m) continue
        // Already bold somewhere in this paragraph → leave it.
        if (p.includes(`**${m[2]}`)) continue
        p = p.replace(re, `$1**$2**`)
      }
      return p
    })
    .join('\n\n')
}

/**
 * Phone numbers go on the LAST line of their paragraph, alone ("Tel. …"),
 * never inline in parentheses (Andrea, 2026-08-29: "vorrei che il telefono
 * sia ultima riga a capo"). The number is moved, never altered; a paragraph
 * that already ends with its Tel. line is left as it is.
 */
export function phoneOnLastLine(reply: string): string {
  const INLINE = /(?:[,;]\s*|\s*[—–-]\s*|\(\s*)?\b(?:tel\.?|telefono|phone)\s*:?\s*((?:\+39[ .]?)?\d(?:[ .]?\d){5,10})(\s*\))?/gi
  return reply
    .split(/\n{2,}/)
    .map((paragraph) => {
      const lines = paragraph.split('\n')
      const last = lines[lines.length - 1]?.trim() ?? ''
      if (/^tel\.?\s*[\d+]/i.test(last) && !INLINE.test(lines.slice(0, -1).join('\n'))) return paragraph
      INLINE.lastIndex = 0
      const numbers: string[] = []
      let body = paragraph.replace(INLINE, (whole, num: string, close?: string) => {
        numbers.push(num.trim())
        // "(Borgata Bach 21, tel. 0435 469265)" → "(Borgata Bach 21)"
        return whole.trim().startsWith('(') ? '' : close ? ')' : ''
      })
      if (numbers.length === 0) return paragraph
      body = body
        .replace(/\(\s*\)/g, '')
        .replace(/\(\s*,\s*/g, '(')
        .replace(/,\s*\)/g, ')')
        .replace(/\s+([,.;:)])/g, '$1')
        .replace(/[ \t]{2,}/g, ' ')
        .trimEnd()
      // A Tel. line the paragraph already carried is merged, not doubled.
      const bodyLines = body.split('\n').filter((l) => !/^tel\.?\s*[\d+]/i.test(l.trim()))
      return [...bodyLines, ...[...new Set(numbers)].map((n) => `Tel. ${n}`)].join('\n')
    })
    .join('\n\n')
}
