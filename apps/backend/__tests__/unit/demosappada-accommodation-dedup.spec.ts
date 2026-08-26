/**
 * demosappada — "altri hotel?" never gets the same structures again
 *
 * WHAT: check_accommodation serves only the structures the guest has NOT yet
 * seen, and when none are left it says so instead of re-listing. What counts
 * as "seen" is recorded from the FINAL reply on BOTH exit paths (normal and
 * hops-exhausted), because only a name that actually reached the guest is
 * shown.
 *
 * WHY (Andrea, live, 2026-08-27: "chiedo altri hotel e mi ridai gli stessi"):
 * the tool used to return the full catalogue on every call, so the model
 * reshuffled the same three structures. The fix removes the model's freedom
 * (iron rule 1): a repeat is simply never offered to it.
 *
 * Asserted against the SOURCE, like demosappada-tools-from-db.spec.ts: the
 * mechanism lives inside runTurn's tool dispatch, and exporting the dispatch
 * purely to test it would widen the module surface (§13). These pins protect
 * the guard clauses themselves — if one disappears, the live bug is back.
 */
import fs from "fs"
import path from "path"

const AGENT_SOURCE = fs.readFileSync(
  path.join(__dirname, "..", "..", "custom-demosappada", "agent.ts"),
  "utf-8"
)

/** Source with comments removed — a rule described in prose is not a rule. */
const AGENT_CODE = AGENT_SOURCE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1")

describe("demosappada accommodation dedup — the session remembers what was shown", () => {
  it("filters the catalogue against accommodationShown before offering it", () => {
    // The model cannot re-list what it is never given: only entries whose
    // name is not in the session's shown-set are rendered.
    expect(AGENT_CODE).toContain("getState(sessionId).accommodationShown")
    expect(AGENT_CODE).toMatch(/entries\.filter\(\(e\) => !shownBefore\.has\(e\.name\.toLowerCase\(\)\)\)/)
  })

  it("an exhausted catalogue is admitted, never repeated", () => {
    // fresh.length === 0 must answer with the honest instruction, not with
    // the same list: the guest asked for OTHER structures.
    expect(AGENT_CODE).toMatch(/fresh\.length === 0/)
    expect(AGENT_CODE).toContain("ALREADY been given to this guest")
  })

  it("records what reached the guest on BOTH exit paths", () => {
    // The heavy multi-hop turn is exactly the one that lands on the fallback
    // path — recording only on the normal path would leak repeats there.
    // The definition is an arrow assignment, so `recordShownAccommodations(`
    // matches exactly the CALL sites: normal path and fallback path.
    expect(AGENT_CODE).toContain("const recordShownAccommodations = (")
    const calls = AGENT_CODE.match(/recordShownAccommodations\(/g) ?? []
    expect(calls.length).toBeGreaterThanOrEqual(2)
  })

  it("marks as shown only names present in the FINAL reply, not everything rendered", () => {
    // The tool may render ten entries while the model lists four; marking all
    // ten would wrongly exhaust the catalogue.
    expect(AGENT_CODE).toMatch(/accommodationOffered\.filter\(\(n\) => lower\.includes\(n\.toLowerCase\(\)\)\)/)
  })
})
