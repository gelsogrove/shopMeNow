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
export const INTAKE_STEPS: readonly IntakeStep[] = [
  {
    // Headcount and dates in one sentence — asking them separately reads
    // like a form (Andrea, 2026-08-24).
    key: 'party',
    satisfiedBy: ({ profile }) => profile?.adults !== undefined && !!profile?.departureDate,
  },
  {
    // Anything that changes what can be recommended at all: a coeliac, no
    // car, a dog. Ahead of the composition on purpose — the wording invites
    // the guest to volunteer who they are, which then retires the next step.
    key: 'constraints',
    satisfiedBy: ({ profile }) => !!profile?.constraints,
  },
  {
    // Who is in the party. `children`/`seniors` of 0 are real answers ("no,
    // solo adulti"), hence `!== undefined` rather than truthiness.
    key: 'composition',
    satisfiedBy: ({ profile }) =>
      profile?.children !== undefined || profile?.seniors !== undefined,
  },
  {
    // Only for a party that has children, and only until we know their ages.
    key: 'childrenAges',
    satisfiedBy: ({ profile }) => !!profile?.childrenAges,
    relevantWhen: ({ profile }) => (profile?.children ?? 0) > 0,
  },
  {
    // What they came here to DO — asked, not waited for: it is what turns an
    // answer into a plan (Andrea, 2026-08-23).
    key: 'interests',
    satisfiedBy: ({ profile }) => !!profile?.interests,
  },
  {
    // The push consent, before the name: it is still about their stay.
    key: 'consent',
    satisfiedBy: ({ profile }) => profile?.consentAsked === true,
  },
  {
    // Last: their name. Skipped when the host already knows it — a widget
    // guest typed it into the registration form seconds ago.
    key: 'name',
    satisfiedBy: ({ knownName }) => !!knownName?.trim(),
  },
  {
    // Closes the intake: offers the itinerary. `itinerary` is set to 'asked'
    // when put and to yes/no when answered, so any value retires it.
    key: 'itinerary',
    satisfiedBy: ({ profile }) => !!profile?.itinerary,
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
  for (const step of INTAKE_STEPS) {
    if (step.relevantWhen && !step.relevantWhen(ctx)) continue
    if (step.satisfiedBy(ctx)) continue
    if (ctx.asked.has(step.key)) continue
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
