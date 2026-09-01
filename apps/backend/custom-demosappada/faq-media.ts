// The FAQ block as a knowledge source: which entries travel with a turn,
// which ONE place a reply is about, and whether that place's photo or video
// may go out. All of it is topic-overlap measurement on OUR output — no
// phrasing or intent is ever read off the guest's words (CLAUDE.md §14).

import type { FaqEntry, Settings, StayProfile } from './agent.js'
import { getState } from './state.js'
import { daysLeftInStay } from './stay.js'

/**
 * Video links carried BY a FAQ entry, as opposed to the tenant's presentation
 * video. Two different things that the prompt used to call by one name: the
 * blanket "no video" of a mid-conversation turn made the model drop the FAQ's
 * own links too, so the guest asking about Malga Tuglia got neither of its two
 * videos — nor the GPX track and the trail description alongside them
 * (Andrea, 2026-08-23: "volevo un video una foto").
 *
 * Wording the prompt more carefully is half the fix; this is the other half,
 * because an instruction the model may still ignore is not a guarantee
 * (CLAUDE.md §16 iron rule 1).
 */
const ANY_LINK_RE = /https?:\/\/[^\s<>()\[\]]+/gi
const VIDEO_LINK_RE = /(?:youtube\.com|youtu\.be|vimeo\.com|\.mp4)/i
const PHOTO_LINK_RE = /\.(?:jpg|jpeg|png|webp|gif)(?:$|[?#])/i

/**
 * Every link a FAQ entry carries, richest first.
 *
 * Andrea's order, 2026-08-23: "preferisco sempre il video" — a video, else a
 * photo, else the page itself. One link goes out, so which one it is decides
 * what the guest sees: a detail answer about a rifugio should show the place,
 * and only fall back to a URL when there is nothing to show.
 *
 * Trailing sentence punctuation is trimmed: a link cited mid-sentence ends up
 * carrying the comma after it, and a comma inside a URL breaks the preview.
 */
function mediaLinksIn(text: string): string[] {
  const links = Array.from(new Set((text.match(ANY_LINK_RE) ?? []).map(trimUrlPunctuation)))
  const rank = (link: string): number => {
    if (VIDEO_LINK_RE.test(link)) return 0
    if (PHOTO_LINK_RE.test(link)) return 1
    return 2
  }
  return links.sort((a, b) => rank(a) - rank(b))
}

function trimUrlPunctuation(raw: string): string {
  return raw.replace(/[)\].,;:!?]+$/, '')
}

/**
 * Append the media of the ONE place the reply is about.
 *
 * Andrea's rule, 2026-08-23: media belong to a detail answer, never to a list.
 * Asked "which mountain huts are there", the reply names ten of them — one
 * video each would be ten WhatsApp notifications and a chat nobody reads.
 *
 * The subject is the entry that WINS, not the only entry that matches. The
 * previous test — "no other FAQ may look like the reply" — sounded equivalent
 * and was not: a good detail answer about the Cascatelle also says
 * `passeggiata`, `adatta ai bambini`, `facile`, so the two generic
 * walks-with-children entries matched it too, three entries were counted and
 * the video was dropped. That is the bug Andrea hit live (2026-08-23:
 * "me lo devi dare subito, non se lo chiedo"), and it hit EVERY detail
 * answer, not just that one.
 *
 * So the entries are ranked by topic overlap and the top one must beat the
 * runner-up by a clear margin. One place described in depth wins outright;
 * ten huts listed side by side all score alike, no one wins, and the reply
 * stays text — which is the list rule, now enforced by the same measurement
 * instead of a second heuristic.
 *
 * At most ONE link is appended (Andrea, 2026-08-23: "testo e video o link o
 * foto"). Malga Tuglia carries two videos; sending both would be the ten
 * notifications again, in miniature.
 *
 * `excluded` keeps the presentation video out: it is prepended by withWelcome
 * and must not come back a second time as if it were content.
 */
/**
 * Is the presentation video going out on THIS turn?
 *
 * On a brand-new conversation withWelcome prepends the tenant's presentation
 * video, and a FAQ video appended underneath makes it two videos in one
 * message — two WhatsApp previews, with the intake question wedged between
 * them (Andrea, 2026-08-23: "e dopo il welcome con le notizie?"). The
 * presentation goes first because it is sent once in the guest's life; the
 * place's own video is not lost, it arrives the moment they ask about it.
 */
function presentationVideoGoesOut(
  greeting: 'new' | 'returning' | 'none',
  sessionId: string,
  stayProfile: StayProfile | null | undefined,
  settings: Settings,
): boolean {
  if (greeting !== 'new') return false
  if (!settings.welcomeVideoUrl?.trim()) return false
  return !getState(sessionId).videoSent && !stayProfile?.videoSent
}

/**
 * May a place's own photo or video go out on this turn at all?
 *
 * Two turns where the answer is no, for opposite reasons:
 *
 * - the presentation video is going out (see above) — one video per message;
 * - the holiday is OVER. The closing turns are feedback, the renewed consent
 *   and the goodbye, and the guest is on the motorway home. The prompt
 *   already says "non proporre più attività: non sono più in zona", yet a
 *   guest writing "ci sono piaciute le cascatelle" was sent the waterfall
 *   video underneath the feedback question — an advert for the place they
 *   have just left, stapled under the one thing they were meant to read
 *   (Andrea, 2026-08-23). A medium is sent when it serves the guest, not
 *   when a word matches.
 */
export function contentMediaAllowed(
  greeting: 'new' | 'returning' | 'none',
  sessionId: string,
  stayProfile: StayProfile | null | undefined,
  settings: Settings,
  now: Date,
  /** True while an intake question is pending this turn. */
  intakePending = false,
): boolean {
  if (presentationVideoGoesOut(greeting, sessionId, stayProfile, settings)) return false

  // While the intake is still running, the turn belongs to the question. A
  // link or a video under it competes with the one thing the guest is being
  // asked, and they were arriving on every single intake turn (Andrea,
  // 2026-08-25: "non voglio il link"). Media come back the moment the
  // questions are done and the conversation is about places again.
  if (intakePending) return false

  // The welcome turn carries the greeting and the presentation — nothing else.
  // The guest wrote "ciao": they have not asked about a place yet, so there is
  // no detail answer for a photo or video to belong to, and attaching one puts
  // a second link under a message that already has one (Andrea, 2026-08-24:
  // "togli il link che c'è sotto").
  //
  // Gated on the GREETING, not on presentationVideoGoesOut above: once the
  // video moved into the copy as {{videoUrl}}, `welcomeVideoUrl` went empty
  // and that check stopped firing — silently taking this protection with it.
  if (greeting === 'new') return false

  const daysLeft = daysLeftInStay(stayProfile ?? null, now)
  return daysLeft === null || daysLeft > 0
}

const SUBJECT_MIN_SCORE = 0.6
const SUBJECT_MIN_MARGIN = 0.2
const SUPPORT_MIN_RATIO = 1.5

/**
 * How many places a reply can name before it stops being ABOUT one of them.
 *
 * Two, because a detail answer legitimately brushes past a neighbour — the
 * Cascatelle entry names the museum by the bridge — while a list names four,
 * six, ten. Measured on the same score, so no phrase matching is involved.
 */
const LIST_NAMED_PLACES = 2

/**
 * How strongly a place must feature before it counts toward the list test.
 *
 * Above SUBJECT_MIN_SCORE on purpose: passing landmarks clear the lower bar
 * (they are named, with their distinctive words) without the reply being
 * about them.
 */
const LIST_PLACE_SCORE = 0.8

/**
 * Is this reply a DETAIL answer about one FAQ place?
 *
 * Same measurement withFaqMedia uses (subject overlap on the MODEL's output,
 * never the guest's words). Needed mid-intake: a guest who picks an offered
 * place ("si le cascatelle") asked for its detail, and replacing the answer
 * with the next intake question bulldozed the request (2026-08-25: "se ti
 * dico cascatelle è il punto che devi espandere").
 */
/**
 * How many FAQ places this reply substantially features — the same IDF
 * measurement as everything else here, never phrasing (§14). Two or more
 * named places is the shape of a PROPOSAL turn ("ecco due escursioni..."),
 * which is the turn that must have consulted the forecast: the product
 * promise is crossing meteo × preferences × schede (contratto), and a
 * weekend recommendation written without get_weather is a guess.
 */
export function countNamedSubjects(reply: string, faqs: FaqEntry[]): number {
  return faqs.filter((f) => subjectScore(f, reply, faqs) >= SUBJECT_MIN_SCORE).length
}

export function replyIsDetailAnswer(reply: string, userMessage: string, faqs: FaqEntry[]): boolean {
  if (faqs.length === 0) return false
  // A detail is about ONE place. Counted at the ordinary subject bar: the
  // higher LIST_PLACE_SCORE bar let a four-item tour of the village pass as
  // "detail" and a video landed under a list (R6.3 violated, 2026-08-25).
  const subjects = faqs.filter((f) => subjectScore(f, reply, faqs) >= SUBJECT_MIN_SCORE)
  if (subjects.length !== 1) return false
  // And the GUEST named it — reply-only scoring fired on the model's own
  // tangents (a stray restaurants line dragged its link into a date answer).
  return subjectScore(subjects[0], userMessage, faqs) > 0
}

export function withFaqMedia(
  reply: string,
  faqs: FaqEntry[],
  userMessage: string,
  excluded: string[],
): string {
  const skip = new Set([...mediaLinksIn(reply), ...excluded.filter(Boolean)])

  // A reply that names several places is a LIST, even when only one of them
  // happens to carry a video — and then that one wins by having no rival,
  // which is exactly backwards. Asked "cosa faccio con i bambini", the reply
  // offers the Gnomi, the Daini, the SapPark, Nevelandia and mentions the
  // Cascatelle in passing; the waterfall video is the only one in the set, so
  // it was being attached to an answer that was not about waterfalls
  // (Andrea, 2026-08-23). Media belong to a detail answer, never to a list.
  // Counted on a HIGHER bar than the winner has to clear. A detail answer
  // legitimately names its landmarks — the Cascatelle entry gives the wooden
  // bridge, the Piccolo Museo della Grande Guerra and the InfoPoint as the
  // way to get there — and counting those as "places named" made the answer
  // look like a list, so the waterfall video was suppressed on the very turn
  // the guest asked for the waterfall (Andrea, live, 2026-08-23: "ti avevo
  // chiesto di mostrare il video ma non lo fai quando si chiede il
  // dettaglio"). A real list has several places each carrying the reply, not
  // one subject plus its directions.
  const namedPlaces = faqs.filter((faq) => subjectScore(faq, reply, faqs) >= LIST_PLACE_SCORE).length
  if (namedPlaces > LIST_NAMED_PLACES) return reply

  // The reply is the stronger signal: it spells the place out in full, while
  // the guest writes "si le cascatelle" and never types the second half of
  // the name. The question still counts, very slightly discounted, so that a
  // place ASKED about beats one merely mentioned in passing.
  const ranked = faqs
    .map((faq) => ({
      faq,
      score: Math.max(
        subjectScore(faq, reply, faqs),
        subjectScore(faq, userMessage, faqs) * 0.99,
      ),
    }))
    .sort((a, b) => b.score - a.score)

  const top = ranked[0]
  if (!top || top.score < SUBJECT_MIN_SCORE) return reply

  // A tie is only fatal when the rival is a real rival. "C'è lo sci di fondo?"
  // and "Cosa sono le Cascatelle?" both reduce to a single distinctive word,
  // so the question alone cannot separate them — but their ANSWERS can: the
  // waterfall entry describes the place the reply is describing, while the
  // cross-country entry never mentions it. Comparing answers is what tells a
  // homonym (`fondo`, the gravel underfoot) from the actual subject, and it
  // is the same measurement, so it stays language-independent.
  const runnerUp = ranked[1]
  if (runnerUp && top.score - runnerUp.score < SUBJECT_MIN_MARGIN) {
    const topSupport = answerOverlap(top.faq, reply, faqs)
    const rivalSupport = answerOverlap(runnerUp.faq, reply, faqs)
    // Compared as a RATIO, not a difference. A short reply covers only a
    // sliver of a long FAQ answer, so both supports are small numbers
    // (0.031 vs 0.016 for Malga Tuglia) and no absolute gap between them
    // would ever clear a fixed threshold. What matters is not how much the
    // winner covers, but that it covers decisively more than its rival.
    if (topSupport <= rivalSupport * SUPPORT_MIN_RATIO) return reply
  }

  // The winning entry must actually be NAMED in the reply. Scoring alone put
  // the Villaggio degli Gnomi's video under a list of three restaurants — it
  // won on topic overlap ("bambini", "Sappada") without being mentioned once
  // (Andrea, 2026-08-25: "villaggio gnomi qui non ha senso, non è neanche un
  // ristorante").
  //
  // Checked on the entry's own distinctive words, the same measurement used
  // for scoring, so nothing here reads phrasing or intent: at least one of
  // them has to appear verbatim in the reply the guest is about to read.
  const topTerms = distinctiveTerms(top.faq.question)
  const replyLower = reply.toLowerCase()
  const named = topTerms.some((term) => term.length >= 4 && replyLower.includes(term))
  if (!named) return reply

  const links = mediaLinksIn(top.faq.answer).filter((l) => !skip.has(l))
  if (links.length === 0) return reply
  return [reply, '', links[0]].join('\n')
}

/**
 * Whether `text` is substantially ABOUT this FAQ entry.
 *
 * Matching is on the entry's distinctive nouns — the words its question is
 * built from, minus the ones every tourism question shares. Nothing here reads
 * INTENT from phrasing (CLAUDE.md §14): it measures topic overlap, so it works
 * the same in Italian, German and English.
 */
function subjectScore(
  faq: FaqEntry,
  text: string,
  faqs: FaqEntry[],
  canon: Canon = identityCanon,
): number {
  const words = wordsOf(text, canon)
  const terms = distinctiveTerms(faq.question, canon)
  if (terms.length === 0) return 0

  // Terms are weighted by how rare they are across THIS tenant's FAQ set.
  // Weighting them equally was the bug: the Cascatelle entry is identified by
  // `cascatelle` and `arrivo`, and a detail answer that never repeats the
  // word "arrivo" scored 0.5 — the same as an unrelated entry that happened
  // to share one common word. `cascatelle` appears in one question out of 72
  // and `arrivo` in a dozen, so the name must carry the weight, and the
  // service verb almost none.
  //
  // This is plain inverse document frequency: no phrase matching, no keyword
  // list, and it behaves the same in every language (CLAUDE.md §14) —
  // a German reply naming `Cascatelle` and `Mühlbach` still lands on the
  // right entry.
  let total = 0
  let matched = 0
  for (const term of terms) {
    const weight = termWeight(term, faqs, canon)
    total += weight
    if (words.has(term)) matched += weight
  }
  return total === 0 ? 0 : matched / total
}

/**
 * How much of the entry's ANSWER the reply actually covers.
 *
 * The tie-break of last resort: two entries whose questions score alike are
 * told apart by whether the reply talks about what the entry talks about.
 * Weighted the same way as the question, so a shared `sappada` counts for
 * almost nothing and a shared `mühlbach` counts for a lot.
 */
function answerOverlap(faq: FaqEntry, reply: string, faqs: FaqEntry[]): number {
  const words = wordsOf(reply)
  const terms = distinctiveTerms(faq.answer)
  if (terms.length === 0) return 0

  let total = 0
  let matched = 0
  for (const term of terms) {
    const weight = termWeight(term, faqs)
    total += weight
    if (words.has(term)) matched += weight
  }
  return total === 0 ? 0 : matched / total
}

/**
 * How much a term identifies ONE entry: 1 when it belongs to a single
 * question, falling towards 0 the more questions share it.
 *
 * Whole words, never substrings. `includes` scored "C'è lo sci di FONDO?" a
 * perfect 1.0 against an answer about waterfalls, because the trail
 * description said "il FONDO è ghiaioso" — same letters, opposite meaning
 * (2026-08-23).
 */
function termWeight(term: string, faqs: FaqEntry[], canon: Canon = identityCanon): number {
  let documents = 0
  for (const faq of faqs) {
    if (wordsOf(faq.question, canon).has(term)) documents++
  }
  return documents <= 1 ? 1 : 1 / documents
}

/**
 * Word-equivalence canonicalizer built from the tenant's `searchSynonyms`
 * configuration (advanced settings → settings.json → agent, CLAUDE.md §1A —
 * the groups are CONTENT, never code). Each group lists one concept in every
 * language and inflection the tenant cares about ("pista, piste, Pisten,
 * slopes"); every member is rewritten to the group's first word before
 * comparison, so "dammi le piste nere" matches a card that says "pista nera".
 *
 * WHY a table and not a stemmer (Andrea, 2026-09-01: "è impossibile calcolare
 * tutti i casi" / "all'embedding ci dobbiamo pensare bene... tira fuori cose
 * che non c'entrano nulla"): a curated table can never surface an unrelated
 * card — matching stays exact, only the alphabet of "equal" widens — and the
 * tenant extends it from the app when a miss shows up, no deploy needed.
 */
type Canon = (word: string) => string
const identityCanon: Canon = (w) => w

export function buildSynonymCanon(groups: unknown): Canon {
  if (!Array.isArray(groups)) return identityCanon
  const map = new Map<string, string>()
  for (const group of groups) {
    if (!Array.isArray(group)) continue
    const words = group
      .filter((w): w is string => typeof w === 'string')
      .map((w) => w.trim().toLowerCase())
      .filter((w) => w.length >= 2)
    if (words.length < 2) continue
    for (const w of words) {
      // First registration wins: a word listed in two groups keeps its first
      // meaning instead of silently flipping with configuration order.
      if (!map.has(w)) map.set(w, words[0])
    }
  }
  if (map.size === 0) return identityCanon
  return (w) => map.get(w) ?? w
}

function wordsOf(text: string, canon: Canon = identityCanon): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter(Boolean)
      .map(canon),
  )
}

/**
 * Words too common across this tenant's FAQ set to identify an entry: every
 * question mentions the destination, and most are shaped "what is X, how do I
 * get there". Kept in code, not settings: this is a mechanism bound, not copy
 * a customer ever reads (CLAUDE.md §1B).
 */
const GENERIC_QUESTION_WORDS = new Set([
  'sappada', 'cosa', 'come', 'dove', 'quali', 'quando', 'quanto', 'sono', 'sono?', 'posso',
  'arrivo', 'ci', 'si', 'che', 'per', 'del', 'della', 'delle', 'dei', 'con', 'una', 'uno',
  'gli', 'le', 'la', 'il', 'lo', 'un', 'and', 'the', 'what', 'where', 'how', 'there',
])

function distinctiveTerms(question: string, canon: Canon = identityCanon): string[] {
  return Array.from(
    new Set(
      question
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .split(/\s+/)
        // Length/generic filters run on the RAW word, before canonicalization:
        // a group's canonical token must not smuggle a short word past them.
        .filter((w) => w.length > 3 && !GENERIC_QUESTION_WORDS.has(w))
        .map(canon),
    ),
  )
}

/**
 * How many FAQ entries travel with a turn.
 *
 * All 85 of this tenant's entries used to go out on EVERY message — ~31k
 * tokens to answer "ciao" — which is most of what a turn costs and is what
 * pushed the prompt past the provider's per-request ceiling (Andrea,
 * 2026-08-25: "non va in locale").
 *
 * Twenty-four, not five: the entries are the assistant's ONLY source of facts,
 * so a relevant one left out is a question it can no longer answer. The number
 * is generous on purpose — the saving comes from dropping the long tail, not
 * from cutting close to the bone.
 */
const FAQ_BUDGET = 24

/**
 * The FAQ entries worth sending for THIS message.
 *
 * Ranked by the same topic-overlap measurement the media guard uses — no
 * phrasing or intent is read (CLAUDE.md §14), only how much an entry's
 * distinctive words overlap the conversation.
 *
 * Scored against the guest's message AND the recent history, because a
 * follow-up ("e gli orari?") carries almost no words of its own: the subject
 * lives in what was said before.
 *
 * Under the budget nothing is selected at all — with a short catalogue the
 * whole thing is cheaper than deciding what to leave out.
 */
export function selectRelevantFaqs(
  faqs: FaqEntry[],
  context: string,
  synonymGroups?: unknown,
): FaqEntry[] {
  if (faqs.length <= FAQ_BUDGET) return faqs
  // Synonyms widen SELECTION only. The media guards above keep the identity
  // alphabet: they decide whether a reply is "about" a place, where the
  // configured equivalences have no lesson to teach and a widened match could
  // only loosen a contract rule that was tuned against live failures.
  const canon = buildSynonymCanon(synonymGroups)
  const ranked = faqs
    .map((faq) => ({ faq, score: subjectScore(faq, context, faqs, canon) }))
    .sort((a, b) => b.score - a.score)
  const chosen = ranked.slice(0, FAQ_BUDGET).map((r) => r.faq)
  // eslint-disable-next-line no-console
  console.error(`[demosappada][faq-budget] ${chosen.length}/${faqs.length} entries sent`)
  return chosen
}

export function formatFaqBlock(faqs: FaqEntry[]): string {
  if (faqs.length === 0) return ''
  const entries = faqs.map((f, i) => `[${i}] Q: ${f.question}\nA: ${f.answer}`).join('\n\n')
  return ['═══ APPROVED CONTENT (your only source of facts) ═══', '', entries].join('\n')
}
