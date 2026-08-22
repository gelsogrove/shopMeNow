/**
 * Every mechanism bound of the module, in ONE place. These are legitimately
 * code, not configuration (CLAUDE.md §1B: mechanism bounds, not
 * customer-facing copy) — but scattered across files they are findable only
 * by grep, and each is a decision someone will one day want to reconsider.
 */

/** A known customer away longer than this is greeted with welcomeBackMessage. */
export const WELCOME_BACK_STALE_MS = 2 * 60 * 60 * 1000

/**
 * Tool hops per turn. A tourism answer needs at most two: fetch the weather,
 * then answer. The cap stops a model that keeps re-calling get_weather from
 * burning the turn.
 */
export const MAX_TOOL_HOPS = 4

/**
 * How long a fetched forecast stays usable within a session. Weather does not
 * change minute to minute, and a customer asking three follow-ups about the
 * same afternoon should not trigger three HTTP calls.
 */
export const WEATHER_CACHE_MS = 30 * 60 * 1000
