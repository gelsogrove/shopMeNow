// The turn, v2 — "the model understands, the code decides, the template
// composes" (docs/turn-design.md). Four steps, no retries, no notes to the
// model, provider-agnostic (works the same through OpenRouter/GPT and the
// Anthropic API: one forced tool call, one plain answer call).
//
//   0. PRE        code   deterministic capture from the guest's words
//   1. UNDERSTAND LLM    forced `understand` call → intent, slots, request
//   2. DECIDE     code   guards → state → next question → rendered wording
//   3. ANSWER     LLM    only when there is a request: FAQ + content tools
//   4. COMPOSE    code   welcome + answer + intro + question → guards
//
// `agent.ts` prepares the turn (limits, language seed, rollover, greeting,
// FAQ selection, tools, tags, prompt variables) and hands everything over in
// a TurnContext. The old single-call loop stays in agent.ts until this one
// has passed the acceptance scenarios; then it goes.

import type { ChatbotInput, CustomToolDefinition, FaqEntry, Settings, StayProfile } from './agent.js'
import { OPERATING_RULES, fetchWeather, formatCatalogue, weatherCheckedThisHour } from './agent.js'
import { boldKnownVenues, knownVenueNames, stripUnknownVenues, stripUnverifiableContacts } from './content-guards.js'
import { contentMediaAllowed, replyIsDetailAnswer, withFaqMedia } from './faq-media.js'
import {
  composeIntakeTurn,
  holdRepeatedQuestion,
  stripInventedLists,
  stripSaveAcknowledgment,
  stripTrailingOffers,
  stripWeatherHedges,
} from './intake-compose.js'
import { nextIntakeStep } from './intake-machine.js'
import { renderIntakeQuestion } from './intake-question.js'
import { looksLikeWrongLanguage, stripLeadingGreeting } from './language-guards.js'
import { CACHE_BREAK, callLLM, safeParseArgs, type Message } from './llm.js'
import {
  commitLanguageFromReply,
  extractLanguage,
  formatStateForPrompt,
  getState,
  resolveEnabledLanguage,
  updateState,
} from './state.js'
import {
  formatStayBlock,
  intakeQuestionFor,
  TAG_INTEREST_EVENTS,
  TAG_INTEREST_LODGING,
  TAG_INTEREST_OFFERS,
  type IntakeKey,
} from './stay.js'
import { translateText, translateWelcome, withWelcome } from './welcome.js'
import { applyUnderstanding, deterministicSlots, mergeSlots, UNDERSTAND_TOOL, type Understanding } from './understand.js'

export interface TurnContext {
  input: ChatbotInput
  settings: Settings
  sessionId: string
  now: Date
  userMessage: string
  history: Array<{ role: 'user' | 'assistant'; content: string }>
  customerId: string | undefined
  stayEnabled: boolean
  stayProfile: StayProfile | null
  knownName: string | undefined
  greeting: 'new' | 'returning' | 'none'
  returningGuest: boolean
  faqs: FaqEntry[]
  faqBlock: string
  /** FAQ block + runtime block: what the answer may quote facts from. */
  approvedContent: string
  customTools: CustomToolDefinition[]
  weatherEnabled: boolean
  accommodationEnabled: boolean
  runtimeBlock: string
  /** The tenant's main prompt, variables substituted — always from the DB. */
  mainPromptRendered: string
}

export interface TurnResult {
  reply: string | null
  language?: string
  tokensUsed: number
  answeredFromFaq: boolean
  error?: string
}

// Tools the ANSWER call may use: content only. State is written by code
// from the UNDERSTAND call; the model never saves anything itself.
const CONTENT_TOOLS = new Set(['get_weather', 'check_accommodation', 'save_itinerary'])
const STATE_TOOLS = new Set([
  'remember',
  'save_preferences',
  'save_push_consent',
  'save_feedback',
  'saveFeedback',
  'startNewStay',
  'updateCustomerName',
  'updateCustomerNotes',
  'changeLanguage',
])

/**
 * Instructions for the UNDERSTAND call. Instructions to the model, not
 * customer copy (§1B): kept in code, short, paid on every turn.
 */
const UNDERSTAND_RULES = [
  'You are the understanding step of a tourist-office assistant for Sappada. You do NOT reply to the guest.',
  'Read the whole conversation and the guest card, then call `understand` exactly once.',
  '- intent: "request" when the latest message asks for something (a place, a plan, an information, a',
  '  price, an opening time); "answer" when it answers our question or volunteers facts; "chitchat" for',
  '  greetings, thanks, small talk; "opt_out" when they no longer want messages; "change_language" when',
  '  they ask to switch language; "restart_stay" when they say they are back for a new holiday.',
  '- slots: every stay fact the guest STATED, in any message, that is not already on the card. Count the',
  '  people they NAME ("io e mio marito" → adults 2, children 0, partyMembers ["io","mio marito"]).',
  '  Never guess a number, a date or a name. A plural verb or "un gruppo" is not a number.',
  '  constraints = anything that limits what suits them: how they move (no car, by bus, on foot), food',
  '  intolerances, mobility, a dog. interests = what they want to do or see.',
  '  consent / itinerary: ONLY as the answer to that specific question, when it was the last one asked.',
  '- request: their words, only with intent "request".',
  '- language: the ISO code of the language they write in.',
].join('\n')

/**
 * Output format for the ANSWER call — the contract's rule, restated where
 * the model writes (contratto.md: "le liste mostrano il nome in bold su una
 * riga, poi la descrizione a capo — stesso formato degli itinerari"). An
 * instruction to the model (§1B), not customer copy.
 */
const ANSWER_FORMAT_RULES = [
  '═══ FORMAT ═══',
  'Lists and itineraries: every place on its own paragraph — the place name in **bold** alone on the',
  'first line, the description on the next line(s). In an itinerary, each day is a **bold** heading',
  'followed by its places in that same format. Bold is for place names and day headings only.',
].join('\n')

const toolName = (t: CustomToolDefinition): string => t.name

function schemaOf(tool: CustomToolDefinition): unknown {
  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters:
        tool.parameters && typeof tool.parameters === 'object'
          ? tool.parameters
          : { type: 'object', properties: {}, additionalProperties: false },
    },
  }
}

export async function runTurnV2(ctx: TurnContext): Promise<TurnResult> {
  const { input, settings, sessionId, now, userMessage, customerId, stayEnabled } = ctx
  let { stayProfile, knownName } = ctx
  let tokensUsed = 0
  const handlers = input.config.handlers
  const trimmedHistory = ctx.history.slice(-(settings.maxHistoryMessages ?? 30))
  // One memory: what is saved is also what the rest of the turn reads. In
  // the playground (no customer) the memory still moves, so the intake
  // progresses within the session even if nothing persists.
  const save = async (profile: Partial<StayProfile>): Promise<void> => {
    if (Object.keys(profile).length === 0) return
    stayProfile = { ...(stayProfile ?? {}), ...profile }
    if (!stayEnabled || !customerId || !handlers?.saveStayProfile) return
    await handlers.saveStayProfile({ workspaceId: input.config.workspaceId, customerId, profile })
  }

  // The question the guest is ANSWERING is the one that went out last turn
  // (`lastAskedKey`), not the machine's next step: consent is marked asked
  // the moment it is put, so by the next turn the machine already points at
  // the itinerary — and "no grazie" to the consent question was read as
  // itinerary:"no" (sim, 2026-08-28). Fallback to the machine only when the
  // session has no memory of a question (first turn, restored session).
  const startBlock = formatStayBlock(stayProfile, now, ctx.returningGuest, knownName, settings, 'card')
  const questionShown = getState(sessionId).lastAskedKey ?? startBlock.askedKey

  // ── 0. PRE — the code reads what it can on its own ─────────────────────
  const uctx = {
    message: userMessage,
    profile: stayProfile,
    questionKey: questionShown,
    firstTurn: ctx.history.length === 0,
    now,
    enabledLanguages: settings.enabledLanguages,
    defaultLanguage: settings.defaultLanguage,
  }
  const det = deterministicSlots(uctx)
  const { consent: detConsent, name: detName, ...detSlots } = det

  // ── 1. UNDERSTAND — one forced call, no prose possible ──────────────────
  let understanding: Understanding = {
    intent: 'answer',
    request: '',
    language: undefined,
    slots: {},
    consent: undefined,
    name: undefined,
    refused: [],
  }
  try {
    const system = [UNDERSTAND_RULES, CACHE_BREAK, ctx.runtimeBlock, startBlock.text].filter(Boolean).join('\n')
    const messages: Message[] = [
      { role: 'system', content: system },
      ...trimmedHistory.map((h) => ({ role: h.role, content: h.content }) as Message),
      { role: 'user', content: userMessage },
    ]
    const result = await callLLM(messages, { ...settings, maxTokens: 600 }, [UNDERSTAND_TOOL], {
      toolChoice: { name: 'understand' },
    })
    tokensUsed += result.tokensUsed
    const call = result.toolCalls.find((c) => c.function.name === 'understand')
    if (call) understanding = applyUnderstanding(safeParseArgs(call.function.arguments), uctx)
  } catch (err) {
    // The code's own capture still applies; the question is asked if needed.
    // eslint-disable-next-line no-console
    console.error('[demosappada][understand] failed — deterministic capture only', err)
  }
  if (understanding.refused.length > 0) {
    // eslint-disable-next-line no-console
    console.error(`[demosappada][understand] refused: ${understanding.refused.join(',')}`)
  }

  // Merge: the code's reading first, the model fills the rest.
  const strong = /\d/.test(userMessage) || detSlots.adults !== undefined
  // The model's reading of the interests ("vedere Sappada") beats the code's
  // verbatim sentence when both exist.
  if (understanding.slots.interests && detSlots.interests && ctx.history.length === 0) delete detSlots.interests
  const merged = mergeSlots(stayProfile, detSlots, understanding.slots, strong)
  await save(merged)
  // eslint-disable-next-line no-console
  console.error(`[demosappada][understand] intent=${understanding.intent} slots=${JSON.stringify(merged)}`)

  // Language: the model's reading, validated against the tenant's list.
  if (understanding.language) commitLanguageFromReply(sessionId, understanding.language)

  // Name: on the customer, not the stay. The code's reading of the name
  // turn first, the model's otherwise.
  const newName = detName ?? understanding.name
  if (newName && !knownName) {
    updateState(sessionId, { name: newName })
    knownName = newName
  }

  // Consent: recorded by code, with its tags (contratto.md: IN LOCO + eventi, news, offerte, meteo).
  const consent = detConsent ?? understanding.consent
  let consentJustGranted = false
  if (consent && customerId && handlers?.savePushConsent) {
    await handlers.savePushConsent({ workspaceId: input.config.workspaceId, customerId, granted: consent === 'granted' })
    if (handlers.setCustomerTags) {
      const interest = [TAG_INTEREST_EVENTS, TAG_INTEREST_LODGING, TAG_INTEREST_OFFERS]
      await handlers.setCustomerTags(
        consent === 'granted'
          ? { workspaceId: input.config.workspaceId, customerId, add: interest }
          : { workspaceId: input.config.workspaceId, customerId, remove: interest },
      )
    }
    if (consent === 'granted') consentJustGranted = true
    await save({ consentAsked: true })
  }

  // Intents the code serves entirely.
  if (understanding.intent === 'opt_out' && customerId && handlers?.savePushConsent) {
    await handlers.savePushConsent({ workspaceId: input.config.workspaceId, customerId, granted: false })
    if (handlers.setCustomerTags) {
      await handlers.setCustomerTags({
        workspaceId: input.config.workspaceId,
        customerId,
        remove: [TAG_INTEREST_EVENTS, TAG_INTEREST_LODGING, TAG_INTEREST_OFFERS],
      })
    }
    const bye = settings.unsubscribedMessage?.trim()
    const byeLang = getState(sessionId).language
    const byeOut =
      bye && byeLang && byeLang.toLowerCase() !== (settings.defaultLanguage || 'it').toLowerCase()
        ? await translateWelcome(bye, byeLang, settings)
        : bye
    return { reply: byeOut || null, tokensUsed, answeredFromFaq: false }
  }
  if (understanding.intent === 'restart_stay') {
    // The rollover runs at the start of the next turn (agent.ts), as it
    // always did; this turn just records the wish.
    await save({ restartRequested: true })
  }

  // ── 2. DECIDE — the machine picks the question from the state as it is NOW ─
  const freshStep = nextIntakeStep({
    profile: stayProfile,
    asked: new Set(stayProfile?.asked ?? []),
    knownName,
  })
  let effectiveKey: string | null = freshStep?.key ?? null
  // With nothing left to ask, every message deserves a reply — a greeting, an
  // "ok", a thank-you: the answer call handles it rather than sending nothing.
  const guestAsked = understanding.intent === 'request' || !effectiveKey
  if (holdRepeatedQuestion(sessionId, effectiveKey, guestAsked)) {
    // eslint-disable-next-line no-console
    console.error(`[demosappada][repeat-hold] "${effectiveKey}" held this turn`)
    effectiveKey = null
  }
  const effectiveQuestion = effectiveKey ? intakeQuestionFor(effectiveKey as IntakeKey, settings) : null
  const lang = getState(sessionId).language
  const sourceLang = (settings.defaultLanguage || 'it').toLowerCase()
  const needsTranslation = !!lang && lang.toLowerCase() !== sourceLang
  let questionTranslated = effectiveQuestion
    ? await renderIntakeQuestion(effectiveQuestion, stayProfile, lang, needsTranslation, settings)
    : null
  const intro = settings.intakeIntro?.trim()
  const introDue = !!intro && !!questionTranslated && !stayProfile?.intakeIntroSent
  if (introDue && questionTranslated) {
    const introOut = needsTranslation && lang ? await translateWelcome(intro!, lang, settings) : intro!
    questionTranslated = `${introOut}\n\n${questionTranslated}`
  }

  // ── 3. ANSWER — only when there is something to answer ──────────────────
  let answer = ''
  let itineraryJustSaved = false
  let approvedContent = ctx.approvedContent
  const accommodationOffered: string[] = []
  if (guestAsked) {
    const card = formatStayBlock(stayProfile, now, ctx.returningGuest, knownName, settings, 'card')
    const system = [
      ctx.mainPromptRendered,
      '',
      OPERATING_RULES,
      ANSWER_FORMAT_RULES,
      CACHE_BREAK,
      ctx.faqBlock,
      '',
      ctx.runtimeBlock,
      card.text,
      formatStateForPrompt(getState(sessionId)),
    ]
      .filter((p) => p !== '')
      .join('\n')
    const tools = ctx.customTools.filter((t) => CONTENT_TOOLS.has(toolName(t)) || !STATE_TOOLS.has(toolName(t)))
    const toolsByName = new Map(tools.map((t) => [t.name, t]))
    const messages: Message[] = [
      { role: 'system', content: system },
      ...trimmedHistory.map((h) => ({ role: h.role, content: h.content }) as Message),
      { role: 'user', content: userMessage },
    ]
    let draft = ''
    const maxHops = settings.maxToolHops ?? 4
    for (let hop = 0; hop < maxHops; hop++) {
      const result = await callLLM(messages, settings, tools.map(schemaOf))
      tokensUsed += result.tokensUsed
      if (result.content?.trim()) draft = result.content
      if (result.toolCalls.length === 0) break
      messages.push({ role: 'assistant', content: result.content || null, tool_calls: result.toolCalls })
      for (const call of result.toolCalls) {
        const name = call.function.name
        const args = safeParseArgs(call.function.arguments)
        let output: unknown
        if (name === 'get_weather') {
          if (!ctx.weatherEnabled) {
            output = { ok: false, instruction: 'The forecast is not available. Do NOT state the weather; point to the official bulletin in the FAQ block.' }
          } else {
            const report = await fetchWeather(sessionId, now)
            if (report.ok && report.summary) {
              approvedContent += `\n${report.summary}`
              output = { ok: true, forecast: report.summary, instruction: 'Real conditions for Sappada, in Italian: translate, quote only what matters to the request.' }
            } else {
              output = { ok: false, error: report.error ?? 'unavailable', instruction: 'Do NOT guess the weather; say you cannot check it now.' }
            }
          }
        } else if (name === 'check_accommodation') {
          const entries = ctx.accommodationEnabled && handlers?.getCatalogue
            ? await handlers.getCatalogue({ workspaceId: input.config.workspaceId })
            : []
          const shownBefore = new Set((getState(sessionId).accommodationShown ?? []).map((n) => n.toLowerCase()))
          const fresh = entries.filter((e) => !shownBefore.has(e.name.toLowerCase()))
          if (entries.length === 0) {
            output = { ok: false, instruction: 'No accommodation on file. Do NOT invent any: point to the official page and the InfoPoint in the FAQ block.' }
          } else if (fresh.length === 0) {
            output = { ok: false, instruction: 'Every structure on file was already given to this guest. Say so; point to the official page for the full list.' }
          } else {
            const rendered = formatCatalogue(fresh)
            accommodationOffered.push(...fresh.map((e) => e.name))
            approvedContent += `\n${rendered}`
            output = {
              ok: true,
              structures: rendered,
              instruction:
                'Pick the 2–3 that fit what they asked; name in bold, one line of description, the contact. ' +
                'You have NO availability and NO prices: never state either — they call the structure.',
            }
          }
        } else if (name === 'save_itinerary') {
          const plan = typeof args.plan === 'string' ? args.plan.trim() : ''
          if (!plan) output = { ok: false, error: 'empty_plan' }
          else if (ctx.weatherEnabled && !weatherCheckedThisHour(sessionId, now)) {
            output = { ok: false, error: 'weather_not_checked', instruction: 'Call get_weather first, then rebuild the plan around it and save again.' }
          } else {
            const offerWasPut = stayProfile?.itinerary === 'asked' || questionShown === 'itinerary'
            await save(offerWasPut ? { itineraryPlan: plan, itinerary: 'yes' } : { itineraryPlan: plan })
            itineraryJustSaved = true
            output = { ok: true, instruction: 'Plan saved. End the message with the plan itself: no offers, no questions after it.' }
          }
        } else if (toolsByName.has(name) && handlers?.executeCustomTool) {
          const res = await handlers.executeCustomTool({
            workspaceId: input.config.workspaceId,
            customerId: input.context.customerId,
            customerLanguage: getState(sessionId).language,
            name,
            args,
          })
          output = res
        } else {
          output = { ok: false, error: 'unknown_tool' }
        }
        messages.push({ role: 'tool', tool_call_id: call.id, name, content: JSON.stringify(output) })
      }
    }
    const { reply, lang: declared } = extractLanguage(draft)
    if (declared) commitLanguageFromReply(sessionId, declared)
    let text = stripUnverifiableContacts(reply, approvedContent).text
    text = stripInventedLists(text, approvedContent).text
    {
      // A venue is real if it exists ANYWHERE in the tenant's data — the
      // whole FAQ set, not only the entries selected for this turn: the
      // model legitimately names a place it saw two turns ago, and the
      // per-turn subset had dropped the Museo Etnografico (sim, 2026-08-28).
      const venueSource = [approvedContent, ...ctx.faqs.map((f) => `${f.question}\n${f.answer}`)].join('\n')
      const venues = stripUnknownVenues(text, venueSource)
      if (venues.removed.length > 0) {
        // eslint-disable-next-line no-console
        console.error(`[demosappada][invented-venue] dropped: ${venues.removed.join(' | ')}`)
      }
      text = venues.text
    }
    text = stripWeatherHedges(text)
    text = stripSaveAcknowledgment(text) || text
    // The contract's format, by code: known place names in bold.
    text = boldKnownVenues(text, knownVenueNames(ctx.faqs.map((f) => f.question), accommodationOffered))
    if (ctx.greeting !== 'none') text = stripLeadingGreeting(text)
    // Helper offers and plan confirmations ("vi va così?") never go out —
    // on any answer, not only the itinerary one (Andrea, 2026-08-28).
    text = stripTrailingOffers(text, false).text
    // The guest just accepted the itinerary offer: the answer IS the plan,
    // and the code keeps it (contratto.md: "aggiorni con cf itinerario così
    // non riproporre le stesse cose") — whether or not the model called
    // save_itinerary itself.
    if (!itineraryJustSaved && merged.itinerary === 'yes' && text.trim()) {
      await save({ itineraryPlan: text.trim() })
      itineraryJustSaved = true
    }
    if (itineraryJustSaved) {
      const first = !stayProfile?.closingQuestionAsked
      text = stripTrailingOffers(text, first).text
      const closing = settings.itineraryClosingQuestion?.trim()
      if (first && closing) {
        const q = needsTranslation && lang ? await translateWelcome(closing, lang, settings) : closing
        if (!text.toLowerCase().includes(q.toLowerCase())) text = `${text}\n\n${q}`
        await save({ closingQuestionAsked: true })
      }
    }
    answer = text.trim()
    if (!answer && understanding.intent === 'request') {
      // Configured, translated, or silence — never an English literal (§1A).
      const noData = settings.noDataMessage?.trim()
      if (noData) answer = needsTranslation && lang ? await translateWelcome(noData, lang, settings) : noData
    }
    if (answer && replyIsDetailAnswer(answer, userMessage, ctx.faqs) &&
        contentMediaAllowed(ctx.greeting, sessionId, stayProfile, settings, now, !!effectiveKey)) {
      answer = withFaqMedia(answer, ctx.faqs, userMessage, [settings.welcomeVideoUrl ?? ''])
    }
  }

  // ── 4. COMPOSE — template, then the guards on what goes out ─────────────
  const closingTranslated =
    settings.closingLine?.trim() && needsTranslation && lang
      ? await translateWelcome(settings.closingLine.trim(), lang, settings)
      : settings.closingLine
  const turn = composeIntakeTurn({
    reply: answer,
    key: effectiveKey,
    question: effectiveQuestion,
    questionTranslated,
    guestAsked,
    closingLine: closingTranslated,
    intakeOpen: !!freshStep,
  })
  let text = turn.text
  // eslint-disable-next-line no-console
  console.error(`[demosappada][turn-out] v2 intent=${understanding.intent} question=${effectiveKey} reply="${text.slice(0, 60)}"`)

  if (turn.asked && effectiveKey) {
    updateState(sessionId, { lastAskedKey: effectiveKey }, { mirror: false })
    const asked = new Set(stayProfile?.asked ?? [])
    asked.add(effectiveKey)
    const mark: Partial<StayProfile> = { asked: Array.from(asked) }
    if (effectiveKey === 'consent') mark.consentAsked = true
    if (effectiveKey === 'remoteNeeds') mark.remoteNeedsAsked = true
    if (effectiveKey === 'itinerary' && !stayProfile?.itinerary) mark.itinerary = 'asked'
    if (introDue) mark.intakeIntroSent = true
    await save(mark)
  }

  // The opt-out line, once in the guest's life, on the turn they accept.
  if (consentJustGranted && !stayProfile?.pushOptOutHintSent && settings.pushOptOutHint?.trim() && text.trim()) {
    const hintSource = settings.pushOptOutHint.trim()
    const hint = needsTranslation && lang ? await translateWelcome(hintSource, lang, settings) : hintSource
    if (!text.toLowerCase().includes(hint.toLowerCase())) text = `${hint}\n\n${text.trimStart()}`
    await save({ pushOptOutHintSent: true })
  }

  // Language repair: the reply must be in the conversation language.
  const target = getState(sessionId).language
  if (text.trim() && target && looksLikeWrongLanguage(text, target)) {
    text = await translateText(text, target, settings)
  }

  // Welcome / welcome back, prepended by code.
  if (text && ctx.greeting !== 'none') {
    const isNew = ctx.greeting === 'new'
    const welcomeText = isNew ? settings.welcomeMessage : settings.welcomeBackMessage || settings.welcomeMessage
    const sendVideo = isNew && !getState(sessionId).videoSent && !stayProfile?.videoSent
    const replyLang = target ? resolveEnabledLanguage(target, settings.enabledLanguages, settings.defaultLanguage) : undefined
    const questionForWelcome = (questionTranslated ?? effectiveQuestion ?? '').trim()
    if (welcomeText && /\{\{\s*firstQuestion\s*\}\}/i.test(welcomeText) && questionForWelcome) {
      text = text.split(questionForWelcome).join('').replace(/\n{3,}/g, '\n\n').trim()
    }
    text = await withWelcome(text, welcomeText, sendVideo ? settings.welcomeVideoUrl : undefined, replyLang, settings, knownName, questionForWelcome)
    if (sendVideo) {
      updateState(sessionId, { videoSent: true }, { mirror: false })
      await save({ videoSent: true })
    }
  }

  // Structures that actually reached the guest are the ones not offered again.
  if (accommodationOffered.length > 0 && text.trim()) {
    const lower = text.toLowerCase()
    const shownNow = accommodationOffered.filter((n) => lower.includes(n.toLowerCase()))
    if (shownNow.length > 0) {
      const already = getState(sessionId).accommodationShown ?? []
      updateState(sessionId, { accommodationShown: [...new Set([...already, ...shownNow])] }, { mirror: false })
    }
  }

  return {
    reply: text.trim() || null,
    language: getState(sessionId).language,
    tokensUsed,
    answeredFromFaq: false,
    error: text.trim() ? undefined : 'empty_reply',
  }
}
