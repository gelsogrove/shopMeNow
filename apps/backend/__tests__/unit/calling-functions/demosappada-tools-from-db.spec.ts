/**
 * demosappada offers the tools the DATABASE says it has — no hardcoded list
 *
 * Andrea 2026-08-24. `buildTools()` used to hardcode the module's seven tools
 * and gate them on three booleans, which is why the Settings page could list
 * them but never switch one off. It now returns exactly what the host passed
 * in, and the host reads that from `workspace_calling_functions`.
 *
 * Asserted against the SOURCE rather than by calling the function: `agent.ts`
 * reads OPENROUTER_API_KEY at module scope and neither `buildTools` nor
 * `customToolSchema` is exported. Exporting them purely for a test would widen
 * a module's public surface to observe a private detail (CLAUDE.md §13); what
 * actually needs pinning is that the hardcoded list is gone and stays gone.
 *
 * The second half of the file pins the guard that makes switching a tool off
 * SAFE. Without it the module goes on ordering the model to call a tool that
 * is no longer offered, burning a hop and leaving the guest with silence.
 */
import fs from "fs"
import path from "path"

const AGENT_SOURCE = fs.readFileSync(
  path.join(__dirname, "..", "..", "..", "custom-demosappada", "agent.ts"),
  "utf-8"
)

/** Source with comments removed — a rule described in prose is not a rule. */
const AGENT_CODE = AGENT_SOURCE.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1")

describe("demosappada tools come from the database", () => {
  describe("buildTools", () => {
    it("returns the host's tool list and nothing else", () => {
      const body = AGENT_CODE.match(/function buildTools\([\s\S]*?\n}/)?.[0]

      expect(body).toBeDefined()
      expect(body).toContain("customTools.map(customToolSchema)")
    })

    it("hardcodes no tool schema of its own", () => {
      // 🚨 THE assertion of this file. If a built-in reappears in buildTools,
      // it stops being switchable in the UI — silently, because the tool still
      // works and only the Settings page becomes a lie.
      const body = AGENT_CODE.match(/function buildTools\([\s\S]*?\n}/)?.[0] ?? ""

      for (const tool of [
        "REMEMBER_TOOL",
        "WEATHER_TOOL",
        "ACCOMMODATION_TOOL",
        "SAVE_STAY_TOOL",
        "SAVE_ITINERARY_TOOL",
        "SAVE_CONSENT_TOOL",
        "SAVE_FEEDBACK_TOOL",
      ]) {
        expect(body).not.toContain(tool)
      }
    })

    it("takes only the tool list as an argument", () => {
      // The old signature carried weatherEnabled/accommodationEnabled/
      // stayEnabled — three switches for something the row's isActive now says.
      const signature = AGENT_CODE.match(/function buildTools\([^)]*\)/)?.[0] ?? ""

      expect(signature).not.toMatch(/weatherEnabled|accommodationEnabled|stayEnabled/)
    })

    it("declares the seven schemas in the manifest, not in agent.ts", () => {
      // One copy of each schema (CLAUDE.md §1): the manifest owns them and
      // agent.ts imports them, so the row seeded into the DB and the schema
      // sent to the model can never disagree.
      expect(AGENT_CODE).toMatch(/import\s*{[\s\S]*?}\s*from\s*['"]\.\/tools\.manifest\.js['"]/)
      expect(AGENT_CODE).not.toMatch(/const SAVE_STAY_TOOL = {/)
    })
  })

  describe("switching a tool off does not break the turn", () => {
    it("derives stay-tool availability from the offered tools", () => {
      // stayEnabled alone is derived from the HANDLER being wired, which stays
      // true even when the row is switched off — that mismatch is what made
      // the module order a tool the model could not see.
      expect(AGENT_CODE).toMatch(/const stayToolAvailable = customToolsByName\.has\('save_stay'\)/)
    })

    it("guards the forced save with it", () => {
      // The forced save pushes "[SYSTEM] Chiama ORA save_stay". With the tool
      // absent the model cannot comply, the hop is spent, and the guest can be
      // left with an empty reply.
      const forcedSave = AGENT_CODE.match(/if \(stayEnabled &&[^)]*mentionsStayFacts\(userMessage\)\)/)?.[0]

      expect(forcedSave).toBeDefined()
      expect(forcedSave).toContain("stayToolAvailable")
    })

    it("treats a switched-off weather tool as weather being unavailable", () => {
      // Two switches ANDed: the advanced-settings JSON flag and the row.
      // Either one off means off (Andrea chose to keep both, 2026-08-24).
      expect(AGENT_CODE).toMatch(
        /const weatherEnabled =\s*settings\.weatherEnabled !== false && customToolsByName\.has\('get_weather'\)/
      )
    })

    it("logs which built-ins were not offered", () => {
      // A disabled tool otherwise looks like a model failure. This is the one
      // moment the cause is knowable.
      expect(AGENT_CODE).toContain("[demosappada][tools-off]")
    })
  })
})
