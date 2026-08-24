/**
 * Module tool manifest — the contract between a DB row and the code that runs it
 *
 * Andrea 2026-08-24. The seven tools demosappada ships with used to exist in
 * three places that could not agree: the schemas hardcoded in `agent.ts`, a
 * hand-copied list of descriptions in the frontend, and nothing at all in the
 * database — so the Settings page could show them but never switch one off.
 *
 * They are now rows, seeded from `tools.manifest.ts`. What did NOT move is the
 * code that executes them: `save_stay` still writes StayProfile inside the
 * module. The link between the row and that code is the `functionName`, and
 * nothing but a test can keep the two from drifting apart — a rename in
 * `agent.ts` would leave a tool the model can call and nothing answers to,
 * with no error anywhere. That is what the contract test below pins.
 */
import fs from "fs"
import path from "path"

import {
  clearModuleToolManifestCache,
  loadModuleToolManifest,
} from "../../../src/application/services/module-tool-manifest.service"

const MODULE_DIR = path.join(__dirname, "..", "..", "..", "custom-demosappada")

/** Every tool demosappada declares, in manifest order. */
const EXPECTED_TOOLS = [
  "get_weather",
  "check_accommodation",
  "remember",
  "save_stay",
  "save_itinerary",
  "save_push_consent",
  "save_feedback",
]

describe("module tool manifest", () => {
  beforeEach(() => {
    // The loader caches per process; without this a test that stubs the
    // filesystem would be answered from another test's result.
    clearModuleToolManifestCache()
  })

  describe("loading", () => {
    it("returns every tool demosappada declares", async () => {
      const manifest = await loadModuleToolManifest("demosappada")

      expect(manifest).not.toBeNull()
      expect(manifest!.map((t) => t.functionName)).toEqual(EXPECTED_TOOLS)
    })

    it("returns null for a module that declares no manifest", async () => {
      // Six of the seven custom-* modules have no manifest and must keep
      // working untouched (CLAUDE.md §13). A missing file is normal, not an
      // error: null means "this module declares nothing", and the seeder no-ops.
      await expect(loadModuleToolManifest("demowash")).resolves.toBeNull()
    })

    it("returns null when no chatbot module is configured", async () => {
      await expect(loadModuleToolManifest(null)).resolves.toBeNull()
      await expect(loadModuleToolManifest(undefined)).resolves.toBeNull()
      await expect(loadModuleToolManifest("   ")).resolves.toBeNull()
    })

    it("rejects a chatbotId that could escape the modules directory", async () => {
      // The chatbotId comes from a DB column, so "../../" in it would be a
      // path traversal. Rejected loudly rather than treated as "no manifest":
      // an invalid input must not look like a module without tools.
      await expect(loadModuleToolManifest("../../etc")).rejects.toThrow(/only lowercase letters/i)
    })
  })

  describe("shape", () => {
    it("gives every tool a unique, LLM-callable name", async () => {
      const manifest = (await loadModuleToolManifest("demosappada"))!
      const names = manifest.map((t) => t.functionName)

      // A duplicate would silently seed fewer tools than declared: the row key
      // is (workspaceId, functionName), so the second upsert overwrites the first.
      expect(new Set(names).size).toBe(names.length)
      for (const name of names) {
        expect(name).toMatch(/^[a-z][a-zA-Z0-9_]*$/)
      }
    })

    it("gives every tool a description and a JSON-schema parameters object", async () => {
      const manifest = (await loadModuleToolManifest("demosappada"))!

      for (const tool of manifest) {
        // The description is what the model reads to decide whether to call it.
        expect(tool.description.trim().length).toBeGreaterThan(0)
        expect(tool.parameters).toEqual(expect.objectContaining({ type: "object" }))
      }
    })

    it("tells the admin what breaks before they switch a tool off", async () => {
      const manifest = (await loadModuleToolManifest("demosappada"))!

      // Disabling a tool removes a capability, and the loss is invisible until
      // a guest hits it. Every built-in carries the sentence the confirmation
      // dialog shows.
      for (const tool of manifest) {
        expect(tool.impact?.trim().length).toBeGreaterThan(0)
      }
    })

    it("declares save_push_consent as superseding the platform's manageNotifications", async () => {
      const manifest = (await loadModuleToolManifest("demosappada"))!
      const consent = manifest.find((t) => t.functionName === "save_push_consent")!

      // Both would otherwise be offered to the model at once — an ambiguity
      // that degrades tool choice. The module's version additionally writes
      // consentAsked and the INTERESSE-* tags, so it is the one that wins.
      expect(consent.supersedes).toEqual(["manageNotifications"])
    })

    it("does not supersede changeLanguage", async () => {
      const manifest = (await loadModuleToolManifest("demosappada"))!
      const superseded = manifest.flatMap((t) => t.supersedes ?? [])

      // The module has no language tool of its own and relies on the host's.
      // Deactivating it would leave guests unable to switch language at all.
      expect(superseded).not.toContain("changeLanguage")
    })
  })

  describe("contract with the module's code", () => {
    it("every declared tool has a dispatch branch in agent.ts", async () => {
      // 🚨 THE test of this file. The row declares the tool; a branch in
      // agent.ts executes it, matched on the same name. A rename on either
      // side produces a tool the model can call that nothing answers to —
      // no exception, no log, just a hop spent on nothing.
      //
      // Read from source rather than by importing the agent: agent.ts reads
      // OPENROUTER_API_KEY at module scope, and this assertion is about the
      // text of the dispatch, not about running it.
      const agentSource = fs.readFileSync(path.join(MODULE_DIR, "agent.ts"), "utf-8")
      const manifest = (await loadModuleToolManifest("demosappada"))!

      for (const tool of manifest) {
        expect(agentSource).toContain(`name === '${tool.functionName}'`)
      }
    })

    it("declares no tool the module cannot execute", async () => {
      // The mirror of the above: a manifest entry with no handler seeds a row
      // that looks installed in the UI and never runs.
      const agentSource = fs.readFileSync(path.join(MODULE_DIR, "agent.ts"), "utf-8")
      const manifest = (await loadModuleToolManifest("demosappada"))!
      const declared = new Set(manifest.map((t) => t.functionName))

      const dispatched = [...agentSource.matchAll(/name === '([a-z][a-zA-Z0-9_]*)'/g)].map(
        (m) => m[1]
      )

      for (const name of dispatched) {
        expect(declared.has(name)).toBe(true)
      }
    })

    it("keeps the manifest free of imports from agent.ts", async () => {
      // The backend loads this file with tsImport from a request path. An
      // import of agent.ts would drag in the whole runtime — and create the
      // cycle the manifest exists to avoid (weather.ts → manifest → agent.ts).
      const manifestSource = fs.readFileSync(path.join(MODULE_DIR, "tools.manifest.ts"), "utf-8")

      // Comments stripped first: the file's own header explains WHY it must not
      // read process.env, and matching that sentence would fail the test the
      // documentation exists to support.
      const code = manifestSource
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/.*$/gm, "$1")

      expect(code).not.toMatch(/from ['"]\.\/agent/)
      expect(code).not.toMatch(/process\.env/)
    })
  })
})
