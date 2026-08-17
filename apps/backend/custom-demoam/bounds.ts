/**
 * Every mechanism bound of the module, in ONE place, each with the
 * CONTRACT.md rule (or Andrea decision) that justifies it. These are
 * legitimately code, not configuration (CLAUDE.md §1B: mechanism bounds,
 * not customer-facing copy, not expected to vary per tenant) — but
 * scattered across four files they were findable only by grep, and every
 * one is a decision someone will one day want to reconsider.
 *
 * Changing a value here is changing behaviour the CONTRACT depends on:
 * check the referenced rule first.
 */

/** CONTRACT.md rule 32: a known customer away longer than this is greeted with welcomeBackMessage. */
export const WELCOME_BACK_STALE_MS = 2 * 60 * 60 * 1000

/** CONTRACT.md rule 14: invalid serial attempts before the gate stops asking and escalates. */
export const MAX_SERIAL_ATTEMPTS = 3

/**
 * CONTRACT.md rule 7 fast path: a description shorter than this cannot
 * possibly describe a symptom. The semantic judgement above this length is
 * the isolated judge's (descriptionDescribesSymptom), never a count.
 */
export const MIN_PROBLEM_DESCRIPTION_CHARS = 8

/** CONTRACT.md rule 7: vague-description follow-ups before moving on with what we have. */
export const MAX_PROBLEM_DESCRIPTION_ATTEMPTS = 2

/**
 * Andrea 2026-08-05 (steps.md): times a pre-operator field may be asked
 * before it counts as done — an unanswered checkbox must never block a
 * customer out of a human. `name` is exempt (rule 11: always asked last,
 * never skippable — see nextPreOperatorAction).
 */
export const PRE_OPERATOR_MAX_ASKS = 2

/**
 * Andrea 2026-08-06: turns a corrective LOOP node may hold the conversation
 * before the flow detaches and the hand-over proceeds — the flow-node
 * analogue of PRE_OPERATOR_MAX_ASKS.
 */
export const MAX_LOOP_TURNS = 2

/** Operator briefing: how much verbatim dialogue the summarizer sees / the fallback prints. */
export const BRIEFING_MAX_EXCHANGES = 5
export const BRIEFING_MAX_PROMPT_CHARS = 160
export const BRIEFING_MAX_CUSTOMER_CHARS = 300
