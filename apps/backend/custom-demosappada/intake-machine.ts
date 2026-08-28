// The intake as a declarative STATE MACHINE, not logic scattered across the
// turn. Same shape as custom-demoam/flow-machine.ts and custom-demorobot's:
// a table of steps plus pure functions over it. No I/O, no session access, no
// LLM — everything here is testable in isolation.
//
// One table is the whole specification. A step declares:
//   - which profile field ANSWERS it (`satisfiedBy`), so a fact the guest
//     volunteered early retires the question without it ever being asked;
//   - whether it may be asked at all right now (`relevantWhen`), for the
//     questions that only apply to some guests (children's ages).
//
// The ORDER of the table is the order of the conversation. Changing the flow
// is moving a row, not rewriting conditions — which is what let the queue and
// the guards drift apart in the first place (Andrea, 2026-08-25: "usa uno
// state, dei guard, un design pattern, non voglio accrocchi").
//
// The WORDING lives in settings.json, never here (CLAUDE.md §1A): this file
// owns WHICH question comes next, the tenant owns what it says.

import type { StayProfile } from './agent.js'

/** Everything the machine needs to decide. Nothing else is read. */
export interface IntakeContext {
  /** What we know about this guest, as of RIGHT NOW (mid-turn saves included). */
  profile: StayProfile | null | undefined
  /** Questions already put to the guest — never asked twice. */
  asked: ReadonlySet<string>
  /** The guest's name, when the host already knows it (widget registration). */
  knownName?: string
}

export interface IntakeStep {
  key: string
  /**
   * True when the profile already answers this step.
   *
   * Checked BEFORE `asked`: a guest who volunteered "siamo in 2 con un
   * bambino" has answered the composition question before it was put, and
   * asking it anyway is the failure this machine exists to prevent.
   */
  satisfiedBy: (ctx: IntakeContext) => boolean
  /** False when the step does not apply to this guest at all. */
  relevantWhen?: (ctx: IntakeContext) => boolean
}

/**
 * The intake, in order. Read it top to bottom: that is the conversation.
 */
/**
 * The guest is not in Sappada and is not planning to be: a prospect asking
 * questions from home. Every stay question is irrelevant to them (contratto.md,
 * 2026-08-27: "se non sono a Sappada dobbiamo evitare tutte le domande di
 * quanti siete cosa volete fare"). `planned` guests — coming next month — go
 * through the standard flow: their holiday is real, only not started yet.
 */
const isRemote = ({ profile }: IntakeContext): boolean => profile?.presence === 'remote'

/**
 * The guest has described who they are — ANY count closes the headcount.
 * "siamo due anziani" fills `seniors`, not `adults`, and the machine, reading
 * `adults` alone, asked "E in quanti siete?" at two people who had just said
 * (Andrea, 2026-08-28: "se hai già la info non la devi più richiedere").
 * The rule is general, not a case list: once the party is described, what
 * is missing (the plain-adult count) is the model's to infer from what was
 * said, never a question to put again.
 */
const partyKnown = ({ profile }: IntakeContext): boolean =>
  profile?.adults !== undefined || profile?.children !== undefined || profile?.seniors !== undefined

export const INTAKE_STEPS: readonly IntakeStep[] = [
  {
    // THE branch question, before everything: in town, planning to come, or
    // just asking from home? (contratto.md, 2026-08-27: "Siete già a
    // Sappada?"). The nuanced reading is the model's — it saves `presence`
    // via save_preferences — with a deterministic yes/no backstop in the
    // capture. A profile that already carries dates has answered it
    // implicitly: those guests joined before this question existed, and the
    // old flow only ever collected dates from people engaged with a stay.
    key: 'location',
    satisfiedBy: ({ profile }) => profile?.presence !== undefined || !!profile?.departureDate,
  },
  {
    // The remote prospect's ONE question — lodging, an event, information —
    // put once and then out of the way: from there the conversation is free
    // Q&A, not an intake. Satisfied on being PUT (like `consent`), so it can
    // never loop.
    key: 'remoteNeeds',
    satisfiedBy: ({ profile }) => profile?.remoteNeedsAsked === true,
    relevantWhen: isRemote,
  },
  {
    // Headcount and dates in ONE sentence — separately they read like a form
    // (Andrea, 2026-08-24). Retired as soon as EITHER arrives: from then on
    // only the missing HALF is asked, by `headcount` or `stay` below, never
    // the whole question again ("ho detto fino a domenica!", 2026-08-25).
    key: 'party',
    satisfiedBy: (ctx) => partyKnown(ctx) || !!ctx.profile?.departureDate,
    relevantWhen: (ctx) => !isRemote(ctx),
  },
  {
    // The guest gave the dates but not the number ("siamo qui fino a
    // domenica"): only the headcount is asked.
    key: 'headcount',
    satisfiedBy: partyKnown,
    relevantWhen: (ctx) =>
      !isRemote(ctx) && (ctx.asked.has('party') || !!ctx.profile?.departureDate),
  },
  {
    // The mirror half: number given, dates missing ("siamo due adulti").
    // Gated on `asked`/fields, not on the top-of-turn profile alone: the step
    // is chosen before this turn's answer is saved (2026-08-25).
    key: 'stay',
    satisfiedBy: ({ profile }) => !!profile?.departureDate,
    relevantWhen: (ctx) => !isRemote(ctx) && (ctx.asked.has('party') || partyKnown(ctx)),
  },
  {
    // Anything that changes what can be recommended at all: a coeliac, no
    // car, a dog. Ahead of the composition on purpose — the wording invites
    // the guest to volunteer who they are, which then retires the next step.
    key: 'constraints',
    satisfiedBy: ({ profile }) => !!profile?.constraints,
    relevantWhen: (ctx) => !isRemote(ctx),
  },
  {
    // Who is in the party. `children`/`seniors` of 0 are real answers ("no,
    // solo adulti"), hence `!== undefined` rather than truthiness.
    key: 'composition',
    satisfiedBy: ({ profile }) =>
      profile?.children !== undefined || profile?.seniors !== undefined,
    relevantWhen: (ctx) => !isRemote(ctx),
  },
  {
    // Only for a party that has children, and only until we know their ages.
    key: 'childrenAges',
    satisfiedBy: ({ profile }) => !!profile?.childrenAges,
    relevantWhen: (ctx) => !isRemote(ctx) && (ctx.profile?.children ?? 0) > 0,
  },
  {
    // What they came here to DO — asked, not waited for: it is what turns an
    // answer into a plan (Andrea, 2026-08-23).
    key: 'interests',
    satisfiedBy: ({ profile }) => !!profile?.interests,
    relevantWhen: (ctx) => !isRemote(ctx),
  },
  {
    // The push consent, before the name: it is still about their stay. The
    // strict pipeline in nextIntakeStep guarantees the contract's order
    // ("quando è chiaro lo salviamo e chiediamo della push notification",
    // Andrea, 2026-08-26): this step cannot be reached while any data step
    // above is still unanswered.
    key: 'consent',
    satisfiedBy: ({ profile }) => profile?.consentAsked === true,
    relevantWhen: (ctx) => !isRemote(ctx),
  },
  {
    // Last: their name. Skipped when the host already knows it — a widget
    // guest typed it into the registration form seconds ago.
    key: 'name',
    satisfiedBy: ({ knownName }) => !!knownName?.trim(),
    relevantWhen: (ctx) => !isRemote(ctx),
  },
  {
    // Closes the intake: offers the itinerary. `itinerary` is set to 'asked'
    // when put and to yes/no when answered, so any value retires it.
    key: 'itinerary',
    satisfiedBy: ({ profile }) => !!profile?.itinerary,
    relevantWhen: (ctx) => !isRemote(ctx),
  },
]

/**
 * The step to put to the guest now, or null when the intake is complete.
 *
 * The SINGLE authority on that question: the turn asks it here, and the guard
 * that runs after the model has saved the guest's answer asks it here again.
 * Two callers, one answer — which is what stops the queue and the guards from
 * disagreeing about what is still open.
 */
export function nextIntakeStep(ctx: IntakeContext): IntakeStep | null {
  // A strict pipeline: the FIRST step the profile does not answer is the
  // question of the turn, and it STAYS the question until it is answered.
  // `asked` no longer retires a step — "asked once, never again" was written
  // against nagging, but it buried every question the guest happened not to
  // answer (they asked about the rubbish instead, the machine moved on, and
  // the intake closed with holes). The contract now says the opposite in as
  // many words (Andrea, 2026-08-26: "abbiamo uno state: fino a che non è
  // chiaro e pieno devi far domande... continua a chiedere fino a che non
  // hai lo state completo"). Steps that satisfy themselves on being PUT
  // (`consent`, `itinerary`) cannot loop; the strict order also guarantees
  // the contract's sequence by construction — consent is unreachable until
  // every data step before it is answered.
  for (const step of INTAKE_STEPS) {
    if (step.relevantWhen && !step.relevantWhen(ctx)) continue
    if (step.satisfiedBy(ctx)) continue
    return step
  }
  return null
}

/** Whether a specific step is still open — used to re-check one key mid-turn. */
export function isIntakeStepOpen(key: string | null, ctx: IntakeContext): boolean {
  if (!key) return false
  const step = INTAKE_STEPS.find((s) => s.key === key)
  if (!step) return false
  if (step.relevantWhen && !step.relevantWhen(ctx)) return false
  return !step.satisfiedBy(ctx)
}
