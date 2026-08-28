// How an intake turn is SHAPED once the model has answered: one question
// per message, ours and not an invented one, the guest's own question
// answered first, invented lists and empty hedges stripped. The intake
// machine decides WHICH question; this file decides how the turn reads.

import { armRepeatCooldown, clearRepeatCooldown, getState } from './state.js'

/**
 * Did the guest actually ask something?
 *
 * A question mark, or one of the shapes a request takes without one ("dimmi
 * dove", "vorrei sapere", "quanto costa"). Used only to decide whether a
 * reply that consists of nothing but our own intake question is acceptable —
 * it never picks an answer or routes anything (CLAUDE.md §14).
 */
export function guestAskedSomething(message: string): boolean {
  // The question mark, nothing else. The keyword list this replaces was
  // phrase detection on user text (§14) and misfired exactly as the rule
  // predicts: "ci sono 2 bambini" — a statement — matched "ci sono", the
  // model's prose was kept, and the guest got a list of playgrounds in the
  // middle of the intake (2026-08-25). A guest who asks without a question
  // mark gets their answer one turn later, when the intake is done — the
  // lesser failure.
  return message.includes('?')
}

/**
 * THE single authority on what kind of turn this is (Andrea, 2026-08-28:
 * "voglio un bel design pattern, non accrocchi") — the same role
 * `nextIntakeStep` plays for WHICH question is due. Every consumer — the
 * substance-retry guard, `composeIntakeTurn`, the hops-exhausted fallback —
 * asks HERE, so they can never disagree again. Tonight's bugs were exactly
 * that disagreement: the guard forced an answer out of the model and the
 * composer, reading a DIFFERENT set of signals, threw it away.
 *
 *   - 'answer'  → the guest brought content to serve: the reply is the
 *                 model's answer first, our ONE dictated question at the end
 *                 ("rispondi all'utente e POI chiedi quello che vuoi").
 *   - 'advance' → the guest only answered our pending question ("sì", "no",
 *                 "fino a domenica", "nessun bambino 3 adulti"): the next
 *                 question IS the whole reply.
 *
 * Shape-only, never intent (§14): a question mark, bare yes/no, word count,
 * and whether the intake machine ADVANCED on this message — facts about
 * form, computable in every language. A still-open `pendingRequest` forces
 * 'answer' whatever the shape: the guest is owed a reply from an earlier
 * turn, and a bare "sì" must not bury it again.
 */
export type TurnKind = 'answer' | 'advance'

export function classifyTurn(
  message: string,
  opts: { machineAdvanced: boolean; hasPendingRequest: boolean; contentFetched?: boolean },
): TurnKind {
  if (opts.hasPendingRequest) return 'answer'
  // The model fetched content (weather, accommodation, a tenant webhook) to
  // serve this message: it IS a request, whatever its shape. Observed from
  // the tool calls, not read from the text (§14). "cerchiamo un rifugio con
  // funivia" — five words, no "?" — lost its fetched list to the six-word
  // rule below (sim, 2026-08-28).
  if (opts.contentFetched) return 'answer'
  const text = message.trim()
  if (text.includes('?')) return 'answer'
  if (/^(s[iì]|no|ok|yes|nein|ja)\.?$/i.test(text)) return 'advance'
  const words = text.split(/\s+/).length
  if (words < 3) return 'advance'
  // A short message that moved the machine forward is an answer to OUR
  // question ("fino a domenica prossima", "nessun bambino 3 adulti"). Six
  // words is room for those; a real request does not fit in six words
  // without also failing to advance the machine.
  if (opts.machineAdvanced && words <= 6) return 'advance'
  return 'answer'
}

/**
 * Is this reply nothing but our own intake question?
 *
 * Short, ends in a question mark, and carries no fact of its own. When the
 * guest asked something and gets this back, their question was dropped —
 * which happened the moment "one question at a time" was made strict: asked
 * the price of a cable car, the assistant replied "until when are you
 * staying?" and nothing else (Andrea, 2026-08-23).
 */
export function isBareIntakeQuestion(reply: string): boolean {
  const text = reply.trim()
  if (!text.endsWith('?')) return false
  if (text.length > 180) return false
  // A reply carrying a number, a name in bold or a list is doing real work.
  if (/\d/.test(text) || /\*\*/.test(text) || /^[-•*]/m.test(text)) return false
  return true
}

/**
 * Is there anything LEFT in this reply once the parts that never count as an
 * answer are stripped — a save acknowledgment, a trailing helper-offer, and
 * the intake question itself (ours, dictated, always allowed to be there)?
 *
 * The general form of `isBareIntakeQuestion`: that check only catches a reply
 * that IS the question and nothing else, so "Ho registrato il vostro arrivo
 * per domani... Se hai bisogno di suggerimenti, fammelo sapere!" sailed
 * through it — it does not end in "?", so it looked like real content, while
 * the guest had asked "com'è il tempo?" and never got an answer (Andrea,
 * 2026-08-28 live). Both failures are the same shape: everything that
 * survives is bookkeeping, not an answer.
 *
 * Used ONLY to decide whether a `pendingRequest` was actually served this
 * turn — never to pick content or read the guest's intent (§14 untouched:
 * this scans the MODEL's own output against its own known filler shapes).
 */
export function replyLacksSubstance(reply: string, ours: string | null): boolean {
  let text = stripSaveAcknowledgment(reply)
  text = stripTrailingOffers(text, true).text
  // `stripTrailingOffers` only cuts a TRAILING paragraph when at least one
  // other survives beside it — built for trimming the tail of a longer
  // reply, not for judging the one paragraph left standing. Once the save
  // acknowledgment above is gone, an offer-only reply IS that one paragraph,
  // and the length>1 loop never runs (Andrea, 2026-08-28 live: "Ho
  // registrato il vostro arrivo... Se hai bisogno di suggerimenti, fammelo
  // sapere!" survived whole because nothing else was left to compare it to).
  if (text.trim() && OFFER_STEM.test(text.trim())) text = ''
  if (ours) {
    const normalise = (s: string): string => s.trim().toLowerCase().replace(/\s+/g, ' ')
    const target = normalise(ours)
    text = text
      .split('\n')
      .filter((line) => !normalise(line).includes(target))
      .join('\n')
  }
  // ANY remaining question-only sentence is bookkeeping too, not just ours
  // by wording: when the model saves a fact mid-turn the machine advances,
  // the outgoing question is the NEXT one — different words from the
  // `ours` dictated at turn start — and it survived the filter above,
  // counting as substance while the guest's request went unanswered
  // ("Suggeriscimi un paio di escursioni..." met with nothing but "E fino
  // a quando vi fermate?", Andrea, 2026-08-28 live, third time). Questions
  // carry no facts by definition; whatever remains after removing them is
  // the actual answer, or there is none. URLs are spared as ever.
  text = text
    .split('\n')
    .map((line) => {
      if (!line.includes('?') || /https?:\/\//.test(line)) return line
      return (line.match(/[^.!?]+[.!?]*/g) ?? [line])
        .filter((sentence) => !sentence.trim().endsWith('?'))
        .join('')
        .trim()
    })
    .join('\n')
  // A short interjection left alone ("Perfetto.", "Certo!") is not an answer.
  return text.trim().length < 12
}

/**
 * Did the intake question reach the guest WITHOUT the examples that make it
 * answerable?
 *
 * Two questions carry examples, and both collapse without them. "C'è qualcosa
 * che devo tenere presente?" gets a "no"; "siete entrambi adulti?" is a closed
 * question that takes children and seniors off the table in one move (Andrea,
 * live, 2026-08-23). The prompt now says to pronounce them, but an instruction
 * is a request — this is the check.
 *
 * Only the presence of the categories is tested, never how they are worded:
 * the model owns the phrasing and the language, and the guest may be reading
 * in any of them. A reply that names none of the alternatives is the failure;
 * one is enough to show the question was opened up.
 */
export function intakeQuestionLacksExamples(reply: string, key: string | null): boolean {
  // `party` used to be checked here too: its old wording ("con chi sei in
  // vacanza") collapsed into a closed "siete entrambi adulti?" unless the
  // model pronounced the categories, so a retry forced them back in.
  //
  // The question is now "In quanti siete e fino a quando vi fermate?" — a
  // headcount and a date, open by construction, with nothing to enumerate.
  // Keeping the guard made the model append "quanti adulti, bambini e anziani"
  // to a question that never asked for them (Andrea, 2026-08-24).
  if (key !== 'constraints') return false
  const text = reply.toLowerCase()
  const groups = [
    /allerg|intoller|celiac|glutine|gluten|unverträg/,
    /auto|macchina|patente|car|coche|voiture|wagen|piedi|fuß|walk|pied/,
    /gravidanz|incinta|pregnan|embaraz|enceinte|schwanger/,
    /cammin|deambul|carrozzin|mobilit|walk|gehen|silla|fauteuil/,
    /cane|cagnolin|animal|dog|hund|perro|chien/,
  ]
  return !groups.some((re) => re.test(text))
}

/**
 * Compose the reply for a turn where an intake question is pending.
 *
 * ONE place, one order — replacing six guards that had grown on top of each
 * other and fought (Andrea, 2026-08-25: "orchestra bene, pulisci il codice,
 * non voglio accrocchi"). Each step below states what it guarantees:
 *
 *   1. our question is the one the guest reads, in their language;
 *   2. it is the ONLY question in the message;
 *   3. on a turn where the guest asked nothing, it is the WHOLE message —
 *      except the closing turn, which carries the greeting and the weather;
 *   4. the closing turn ends with the configured closing line.
 *
 * Everything the model added of its own is dropped, not merged: the code owns
 * WHICH question is asked and HOW the turn is shaped, the model owns the
 * language and the content of the recommendation (iron rule 1).
 */
export interface IntakeTurnInput {
  /** The reply the model produced, already stripped of unverifiable facts. */
  reply: string
  /** The intake key dictated this turn, or null when none is pending. */
  key: string | null
  /** The configured wording, in the tenant's language. */
  question: string | null
  /** The same wording in the language the model replied in. */
  questionTranslated: string | null
  /** Did the guest ask something of their own this turn? */
  guestAsked: boolean
  /** The line that ends the intake-closing turn, when configured. */
  closingLine?: string
  /**
   * True while the intake still has questions left, even when none is due on
   * THIS turn (the guest just answered the pending one).
   *
   * The model fills that gap with a question of its own — "Ci sono altre
   * esigenze o preferenze da considerare?" one turn after the guest had
   * already answered exactly that (Andrea, 2026-08-25: "ma lo abbiamo già
   * chiesto no?"). While the code owns the questions, the model asks none.
   */
  intakeOpen?: boolean
}

export interface IntakeTurnResult {
  text: string
  /** True when the question reached the guest — the caller retires it only then. */
  asked: boolean
  /** What was dropped, for the log. */
  dropped: string[]
}

/**
 * Substitute {{variables}} into the tenant's main prompt.
 *
 * A line whose ONLY content is an empty variable disappears, label and all: a
 * bare "VINCOLI:" with nothing under it invites the model to fill the gap with
 * something nobody told it. A line that also carries other text keeps it, with
 * the placeholder resolved to nothing.
 *
 * Unknown placeholders are left ALONE, never blanked: the tenant may be using
 * a variable the host substitutes ({{chatbotName}}, {{companyName}}), and
 * wiping it here would delete a value that was about to arrive.
 */
export function renderPromptVariables(prompt: string, values: Record<string, string>): string {
  if (!prompt) return ''
  const known = new RegExp(`\\{\\{\\s*(${Object.keys(values).join('|')})\\s*\\}\\}`, 'gi')

  return prompt
    .split('\n')
    .filter((line) => {
      const matches = [...line.matchAll(known)]
      if (matches.length === 0) return true
      const allEmpty = matches.every((m) => !values[m[1]] && !values[m[1].toLowerCase()])
      if (!allEmpty) return true
      // Every variable on the line is empty. What is left is either a LABEL
      // for them ("VINCOLI:", "- Interessi:") — which must go with them — or a
      // real sentence that happens to mention one, which must stay.
      //
      // A label is short and ends in a colon or a dash: it introduces a value
      // that is not coming. Shape only, so it holds in every language.
      const rest = line.replace(known, '').trim()
      if (rest.length === 0) return false
      const looksLikeLabel = rest.length <= 40 && /[:\-–—]\s*$/.test(rest)
      return !looksLikeLabel
    })
    .map((line) =>
      line
        .replace(known, (_full, name: string) => values[name] ?? values[name.toLowerCase()] ?? '')
        .replace(/[ \t]{2,}/g, ' ')
        .trimEnd()
    )
    .filter((line, i, all) => line.trim() !== '' || (all[i - 1]?.trim() ?? '') !== '')
    .join('\n')
    .trim()
}

/**
 * Remove every question the MODEL wrote, keeping the one the code dictated.
 *
 * Sentence-shaped and language-independent: a sentence ending in "?" that is
 * not a URL ("…com/watch?v=" is a link, not a question). `ours`, when given,
 * is exempt — it is the question the guest is meant to answer.
 */
/**
 * Remove empty weather hedges from the MODEL's prose.
 *
 * "Se il tempo lo consente, nel pomeriggio..." — written three times in one
 * itinerary while the 7-day forecast sat in the prompt (2026-08-25: "il meteo
 * lo sai, se fai la chiamata!"). The rule in the prompt is ignored, so the
 * clause is deleted here: what remains states the plan, and the forecast the
 * model DID quote elsewhere carries the weather. Matching is on OUR output,
 * never the guest's words (§14 untouched).
 */
/**
 * Strip LISTS whose items do not exist in the approved content.
 *
 * The model served a coeliac guest a complete invented restaurant menu —
 * antipasti, primi, dolci — none of it anywhere in the FAQ block (2026-08-25:
 * "NON DEVI INVENTARE!"). Phones and prices were already verified; itemized
 * prose was not. Same principle, extended: a block of 3+ short list lines
 * whose distinctive words never appear in the approved content is fabricated,
 * and it goes.
 *
 * Shape-only detection (markers, line length, consecutiveness) plus overlap
 * against OUR approved text — never the guest's words (§14). Legit lists
 * survive because their items are QUOTED from the FAQ block: "Casunziei",
 * "Keisn Osteria" are right there in the haystack.
 */
export function stripInventedLists(reply: string, approvedContent: string): { text: string; removed: string[] } {
  const haystack = approvedContent.toLowerCase()
  const lines = reply.split('\n')
  const isItem = (l: string): boolean =>
    /^\s*(?:[-•*]\s|\d+[.)]\s|\*\*[^*]{2,60}\*\*\s*:?\s*$)/.test(l) && l.trim().length <= 90
  const verified = (l: string): boolean => {
    const toks = l
      .toLowerCase()
      .replace(/[^\p{L}\s]/gu, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 5)
    if (toks.length === 0) return true
    return toks.some((t) => haystack.includes(t))
  }
  const removed: string[] = []
  const out: string[] = []
  let i = 0
  while (i < lines.length) {
    if (!isItem(lines[i])) {
      out.push(lines[i])
      i++
      continue
    }
    // Collect a consecutive item block (blank lines allowed inside).
    const block: number[] = []
    let j = i
    while (j < lines.length && (isItem(lines[j]) || lines[j].trim() === '')) {
      if (isItem(lines[j])) block.push(j)
      j++
    }
    const unverified = block.filter((k) => !verified(lines[k]))
    if (block.length >= 3 && unverified.length * 3 >= block.length * 2) {
      // Fabricated block: drop it, and the intro line ending in ':' above it.
      if (out.length > 0 && /:\s*$/.test(out[out.length - 1])) removed.push(out.pop() as string)
      for (const k of block) removed.push(lines[k])
    } else {
      for (let k = i; k < j; k++) out.push(lines[k])
    }
    i = j
  }
  return { text: out.join('\n').replace(/\n{3,}/g, '\n\n').trim(), removed }
}

export function stripWeatherHedges(reply: string): string {
  const HEDGES =
    /(?:se|si|if|wenn|falls)\s+(?:il\s+tempo|el\s+tiempo|le\s+temps|the\s+weather|das\s+wetter|het\s+weer|vejret)\s+(?:lo\s+(?:consente|permette|regge)|(?:è|es|est|is|ist)\s+(?:buono|bello|clemente|bueno|beau|good|nice|gut|goed|godt)|(?:lo\s+)?permite|le\s+permet|permitting|es\s+zul[aä]sst|zulässt|tillader)[,]?\s*/gi
  let out = reply.replace(HEDGES, '')
  out = out.replace(/(^|[.!?]\s+)([a-zàèéìòù])/g, (_m, pre: string, ch: string) => pre + ch.toUpperCase())
  return out.replace(/[ \t]{2,}/g, ' ')
}

/**
 * Drops the "Perfetto, ho salvato le informazioni!" opener.
 *
 * save_preferences' own output already tells the model not to acknowledge the
 * save, and it said it anyway (Andrea, 2026-08-27 live: "LO DEVI FARE MA NON
 * SCRIVERE"). One more instruction would be one more instruction to ignore
 * (iron rule 1) — so the acknowledgment is removed HERE, deterministically,
 * and only on turns where a save actually happened.
 *
 * Shape-matched like dropModelGreeting: an OPENING sentence, short enough to
 * be an acknowledgment and nothing else, containing a save-stem in any of the
 * bot's languages. This scans the BOT's output, never the guest's words, so
 * §14 (no phrase detection on user text) does not apply.
 */
export function stripSaveAcknowledgment(reply: string): string {
  const SAVE_STEM =
    /(salvat|saved|guardad|gespeicher|enregistr|registrat|memorizz|annotat|opgeslagen|gemt)/i
  const lines = reply.split('\n')
  const sentences = (lines[0] ?? '').match(/[^.!?]+[.!?]*/g) ?? [lines[0] ?? '']
  const head = (sentences[0] ?? '').trim()
  if (head.length === 0 || head.length > 80 || !SAVE_STEM.test(head)) return reply
  return [sentences.slice(1).join('').trim(), ...lines.slice(1)].join('\n').trim()
}

function stripModelQuestions(reply: string, ours: string | null, dropped: string[]): string {
  const normalise = (s: string): string => s.trim().toLowerCase().replace(/\s+/g, ' ')
  const keep = ours ? normalise(ours) : null
  return reply
    .split('\n')
    .map((line) => {
      if (!line.includes('?') || /https?:\/\//.test(line)) return line
      return (line.match(/[^.!?]+[.!?]*/g) ?? [line])
        .filter((sentence) => {
          if (!sentence.trim().endsWith('?')) return true
          if (keep && normalise(sentence).includes(keep)) return true
          dropped.push(sentence.trim())
          return false
        })
        .join('')
        .replace(/\s{2,}/g, ' ')
        .trim()
    })
    .filter((line, i, all) => line.trim() !== '' || (all[i - 1]?.trim() ?? '') !== '')
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/**
 * Holds back a question the guest JUST saw and sidestepped.
 *
 * The strict pipeline re-dictates the first unanswered step every turn — and
 * when the guest met it with a question of their own, the same sentence came
 * back stapled under the reply they actually wanted ("C'è qualcosa di
 * particolare…" two turns in a row, Andrea, 2026-08-27 live: "me la chiedi 2
 * volte?"). One quiet turn is the fix: the reply ends on the answer, the
 * question returns on the turn after. Held and asked turns alternate, so the
 * intake still completes — the contract's "continua a chiedere" is delayed
 * one turn, never dropped.
 *
 * Returns true when THIS turn must go out without the question. Only a repeat
 * of `lastAskedKey` is ever held, only when the guest engaged with something
 * else (after a bare "ok" the re-ask IS the reply, or nothing would go out),
 * and never two turns in a row.
 */
export function holdRepeatedQuestion(
  sessionId: string,
  key: string | null,
  guestEngaged: boolean,
): boolean {
  if (!key || !guestEngaged) return false
  const state = getState(sessionId)
  if (state.lastAskedKey !== key) return false
  if (state.repeatCooldownKey === key) {
    clearRepeatCooldown(sessionId)
    return false
  }
  armRepeatCooldown(sessionId, key)
  return true
}

export function composeIntakeTurn(input: IntakeTurnInput): IntakeTurnResult {
  const { reply, key, question, guestAsked, closingLine, intakeOpen } = input
  const ask = (input.questionTranslated ?? question ?? '').trim()
  const dropped: string[] = []

  // No question due this turn. With the intake still running the model must
  // not invent one of its own, so its questions are stripped and nothing is
  // put in their place; once the intake is over it converses freely again.
  if (!key || !ask) {
    if (!intakeOpen) return { text: reply, asked: false, dropped: [] }
    return { text: stripModelQuestions(reply, null, dropped), asked: false, dropped }
  }

  const normalise = (s: string): string => s.trim().toLowerCase().replace(/\s+/g, ' ')

  // The closing turn is the only one that keeps the model's prose: it carries
  // the greeting by name, the weather and one suggestion before the question.
  const isClosingTurn = key === 'itinerary'

  // Step 3 — a turn where the guest asked nothing IS the question, nothing else.
  if (!guestAsked && !isClosingTurn) {
    if (normalise(reply) !== normalise(ask)) dropped.push(reply.trim())
    return { text: ask, asked: true, dropped }
  }

  // Step 1+2 — keep the model's answer, strip every question it invented, and
  // make sure ours is there exactly once, at the end.
  // Helper-offer paragraphs go first: mid-intake "Se hai bisogno di ulteriori
  // informazioni, fammi sapere!" is never an answer, and when it was ALL the
  // model wrote it went out as one, stapled above our question (sim,
  // 2026-08-28: "cerchiamo un albergo e vogliamo spendere poco"). Matched on
  // the bot's output only (§14 untouched).
  const withoutOffers = stripOfferParagraphs(reply, dropped)
  const withoutQuestions = stripModelQuestions(withoutOffers, ask, dropped)

  const alreadyThere = normalise(withoutQuestions).includes(normalise(ask))
  const body = alreadyThere
    ? withoutQuestions
    : [withoutQuestions, ask].filter((p) => p.length > 0).join('\n\n')

  // Step 4 — the closing turn signs off with the configured line.
  const closing = closingLine?.trim()
  if (isClosingTurn && closing && !normalise(body).endsWith(normalise(closing))) {
    return { text: `${body}\n\n${closing}`, asked: true, dropped }
  }

  return { text: body, asked: true, dropped }
}

/**
 * Sentences the model closes with when it has nothing left to say: "se avete
 * domande, fatemelo sapere", "per ulteriori dettagli contattate l'InfoPoint".
 *
 * Matched on the BOT's output, never the guest's words (§14 untouched) — the
 * same class of check as stripSaveAcknowledgment above. Stems, not sentences,
 * across the languages the bot writes in.
 */
// Also the plan CONFIRMATION the model closes an itinerary with — "Vi va
// così per sabato, o volete aggiungere/cambiare qualcosa?" — which the
// contract's owner does not want, for the same reason as the save
// acknowledgment: it narrates the mechanism instead of helping (Andrea,
// 2026-08-28: "non c'è bisogno di dirla, come non c'è bisogno di dire ho
// salvato le preferenze"). The plan is theirs; if they want a change they
// say so (mainPrompt). Bot output only, never the guest's words (§14).
const OFFER_STEM =
  /(fatemelo sapere|fammelo sapere|fatemi sapere|fammi sapere|let (me|us) know|lasst? (es )?(mich|uns) wissen|h[aá]z(me|noslo)?lo saber|avisadme|av[ií]same|faites[- ]le[- ]moi savoir|n'h[eé]sitez pas|non esit(are|ate|i)|don'?t hesitate|no dud(es|[eé]is)|se (avete|hai) (bisogno|domande|dubbi)|if you (have any|need)|falls (sie|ihr|du) fragen|si (ten[eé]is|tienes|necesitas)|per (ulteriori|qualsiasi|altre) (dettagli|informazioni|domande)|for (further|more) (details|information)|f[uü]r weitere|(vi|ti|le) va (bene )?(cos[iì]|questo|il programma)|va bene cos[iì]|(volete|vuoi|vuole) (aggiungere|cambiare|modificare|togliere)|che ne (pensi|pensate|dite|dice)|(does|would) (that|this) (work|suit)|sound(s)? good|(want|like) to (add|change|adjust)|(passt|gef[aä]llt) (euch|ihnen|dir)|(m[oö]chte(t|n)? (ihr|sie)|willst du) .*([aä]ndern|hinzuf[uü]gen)|[cç]a vous (va|convient)|(voulez|veux)-?(vous|tu) (ajouter|changer|modifier)|(os|te|le) parece bien|(quer[eé]is|quieres|quiere) (a[ñn]adir|cambiar|modificar))/i

/** Remove every short paragraph that is only a helper-offer, wherever it sits. */
export function stripOfferParagraphs(reply: string, dropped: string[]): string {
  return reply
    .split(/\n{2,}/)
    .filter((p) => {
      const t = p.trim()
      const isOffer = t.length > 0 && t.length <= 250 && OFFER_STEM.test(t) && !/^[-•*\d]|\*\*/m.test(t)
      if (isOffer) dropped.push(t)
      return !isOffer
    })
    .join('\n\n')
    .trim()
}

/**
 * Drop the trailing helper-offer paragraphs from the itinerary-delivery turn.
 *
 * The plan Andrea saw live ended with "Se avete bisogno di ulteriori dettagli…
 * contattare l'InfoPoint…" and "Se avete domande o volete modificare qualcosa,
 * fatemelo sapere!" — filler where the configured closing question belongs
 * (Andrea, 2026-08-27: "da togliere; che l'itinerario finisca con vuoi
 * consigli su dove andare a mangiare prodotti tipici locali?"). The prompt
 * already asks for no coda; this makes it true (iron rule 1).
 *
 * The mirror of stripLeadingGreeting: only TRAILING paragraphs go, only while
 * they look like an offer, and the first paragraph carrying plan content — a
 * list line, a bold name — stops the scan. `dropTrailingQuestions` extends the
 * cut to short trailing questions, and is passed ONLY on the turn the code is
 * about to append its own closing question: on later plan updates a trailing
 * question may be the legitimate "com'è andata ieri?" follow-up.
 */
export function stripTrailingOffers(
  reply: string,
  dropTrailingQuestions: boolean,
): { text: string; removed: string[] } {
  const paragraphs = reply.split(/\n{2,}/)
  const removed: string[] = []
  while (paragraphs.length > 1) {
    const last = paragraphs[paragraphs.length - 1].trim()
    if (!last) {
      paragraphs.pop()
      continue
    }
    // Plan content is never cut: a list marker or a bold heading is the
    // itinerary itself, whatever the sentence around it says.
    if (/^[-•*\d]|\*\*/m.test(last)) break
    const isOffer = last.length <= 250 && OFFER_STEM.test(last)
    const isQuestion = dropTrailingQuestions && last.length <= 200 && last.endsWith('?')
    if (!isOffer && !isQuestion) break
    removed.push(last)
    paragraphs.pop()
  }
  return { text: paragraphs.join('\n\n').trim(), removed }
}
