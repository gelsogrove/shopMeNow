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
    // Tidy the holes left behind: doubled spaces, orphaned punctuation,
    // and lines that held nothing but the stripped value.
    //
    // A stripped phone or URL can also leave its LABEL standing alone —
    // "Tel.. " reached a guest after the invented number it introduced was
    // removed (Andrea, 2026-08-28 live: "Hotel La Baita ... Tel.. "). A line
    // whose only content is a contact label is the husk of a removed value:
    // it goes with it. Stems over the bot's own output, like OFFER_STEM —
    // never the guest's words (§14).
    const ORPHAN_LABEL_RE =
      /^[\s•\-*]*(?:tel(?:efono)?|phone|t[eé]l[eé]?(?:phone)?|e-?mail|mail|web|sito|website|dettagli|details|info(?:rmazioni)?|contatt[oi]|contacts?)\s*[.:,;]*\s*$/i
    text = text
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/[ \t]+([.,;:!?])/g, '$1')
      // The MID-LINE husk: "Tel.. Anche qui, chiama prima..." — the stripped
      // phone sat between its label and the next sentence, so the line-level
      // filter below never sees a bare label (2026-08-28 live, second form).
      // Removed only when followed by a sentence start, punctuation or the
      // end of the line — "Tel. 0435 469833" (digit next) is never touched.
      .replace(
        /\b(?:tel(?:efono)?|phone|t[eé]l(?:[eé]phone)?)\s*[.:]{1,3}\s*(?=[A-ZÀ-Ý]|[.,;]|\n|$)/g,
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
  }

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
