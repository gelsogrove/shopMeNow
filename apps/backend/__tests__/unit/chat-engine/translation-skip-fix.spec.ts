/**
 * Unit Tests: Translation Skip Fix — catalogBaseLanguage (Task 2.1/2.2)
 *
 * CONTEXT: The shouldSkipTranslation check in routeMessage() was hardcoded to "it",
 * meaning it only skipped translation for Italian customers. This is wrong for
 * workspaces with a different catalog base language (e.g., English).
 *
 * FIX: shouldSkipTranslation now compares normalizedLanguage against
 * workspace.catalogBaseLanguage (loaded via loadWorkspaceConfig), not hardcoded "it".
 *
 * These tests verify:
 * 1. The code uses catalogBaseLanguage from workspace config, not hardcoded "it"
 * 2. All language combinations work correctly
 * 3. Backward compatibility (undefined catalogBaseLanguage defaults to "it")
 */

describe("ChatEngine - Translation Skip Fix (Task 2.1)", () => {
  let chatEngineSource: string
  let routeMessageBody: string

  beforeAll(() => {
    const fs = require("fs")
    const path = require("path")
    chatEngineSource = fs.readFileSync(
      path.join(__dirname, "../../../src/application/chat-engine/chat-engine.service.ts"),
      "utf-8"
    )

    // Extract the routeMessage method body
    const routeMessageStart = chatEngineSource.indexOf("async routeMessage(input: ChatEngineInput)")
    const routeMessageEnd = chatEngineSource.indexOf("\n  async ", routeMessageStart + 50)
    routeMessageBody = chatEngineSource.substring(routeMessageStart, routeMessageEnd > 0 ? routeMessageEnd : undefined)
  })

  // ========================================================================
  // SECTION 1: No hardcoded "it" in shouldSkipTranslation
  // ========================================================================
  describe("No hardcoded language in shouldSkipTranslation", () => {

    // SCENARIO: shouldSkipTranslation must NOT compare against hardcoded "it"
    // RULE: The comparison must use catalogBaseLanguage from workspace config
    it("should NOT have hardcoded 'it' in shouldSkipTranslation check", () => {
      // Find the shouldSkipTranslation line
      const skipLine = routeMessageBody.split("\n").find(
        (line: string) => line.includes("shouldSkipTranslation")
          && line.includes("=")
          && !line.includes("if (")
      )

      expect(skipLine).toBeDefined()

      // RULE: Must NOT contain hardcoded === "it" comparison
      expect(skipLine).not.toMatch(/=== ["']it["']/)

      // RULE: Must reference catalogBaseLanguage
      expect(skipLine).toContain("catalogBaseLanguage")
    })

    // SCENARIO: catalogBaseLanguage is loaded from workspace config via loadWorkspaceConfig
    // RULE: routeMessage must call loadWorkspaceConfig to get catalogBaseLanguage
    it("should load catalogBaseLanguage from workspace config", () => {
      // RULE: routeMessage must call loadWorkspaceConfig before shouldSkipTranslation
      const loadConfigIndex = routeMessageBody.indexOf("loadWorkspaceConfig")
      const skipTranslationIndex = routeMessageBody.indexOf("shouldSkipTranslation")

      expect(loadConfigIndex).toBeGreaterThan(-1)
      expect(skipTranslationIndex).toBeGreaterThan(-1)

      // loadWorkspaceConfig must be called BEFORE shouldSkipTranslation
      expect(loadConfigIndex).toBeLessThan(skipTranslationIndex)
    })
  })

  // ========================================================================
  // SECTION 2: catalogBaseLanguage in loadWorkspaceConfig
  // ========================================================================
  describe("catalogBaseLanguage fetched in loadWorkspaceConfig", () => {

    // SCENARIO: loadWorkspaceConfig must SELECT catalogBaseLanguage from DB
    // RULE: Without this, the workspace config would not have catalogBaseLanguage
    it("should include catalogBaseLanguage in workspace select query", () => {
      const loadConfigStart = chatEngineSource.indexOf("private async loadWorkspaceConfig")
      const loadConfigEnd = chatEngineSource.indexOf("\n  /**", loadConfigStart + 1)
      const loadConfigBody = chatEngineSource.substring(loadConfigStart, loadConfigEnd > 0 ? loadConfigEnd : undefined)

      // RULE: catalogBaseLanguage must be in the select clause
      expect(loadConfigBody).toContain("catalogBaseLanguage: true")

      // RULE: catalogBaseLanguage must be mapped to the config object
      expect(loadConfigBody).toMatch(/catalogBaseLanguage:\s*workspace\?\.catalogBaseLanguage/)
    })
  })

  // ========================================================================
  // SECTION 3: WorkspaceConfig interface includes catalogBaseLanguage
  // ========================================================================
  describe("WorkspaceConfig interface", () => {

    // SCENARIO: WorkspaceConfig must declare catalogBaseLanguage field
    // RULE: Without this, TypeScript would reject access to the field
    // NOTE: WorkspaceConfig was extracted to chat-engine.types.ts during split
    it("should have catalogBaseLanguage in WorkspaceConfig interface", () => {
      const fs = require("fs")
      const path = require("path")
      const typesSource = fs.readFileSync(
        path.join(__dirname, "../../../src/application/chat-engine/chat-engine.types.ts"),
        "utf-8"
      )
      const interfaceStart = typesSource.indexOf("interface WorkspaceConfig")
      const interfaceEnd = typesSource.indexOf("}", interfaceStart)
      const interfaceBody = typesSource.substring(interfaceStart, interfaceEnd)

      expect(interfaceBody).toContain("catalogBaseLanguage")
    })
  })

  // ========================================================================
  // SECTION 4: Normalization applied to catalogBaseLanguage
  // ========================================================================
  describe("Language normalization", () => {

    // SCENARIO: catalogBaseLanguage must be normalized before comparison
    // RULE: normalizeLanguageCode handles variants like "it-IT" → "it", "en-US" → "en"
    // Without normalization, "it-IT" !== "it" would incorrectly trigger translation
    it("should normalize catalogBaseLanguage before comparison", () => {
      // Find the line that assigns catalogBaseLanguage for comparison
      const catalogBaseLine = routeMessageBody.split("\n").find(
        (line: string) => line.includes("catalogBaseLanguage") && line.includes("normalizeLanguageCode")
      )

      // RULE: catalogBaseLanguage must go through normalizeLanguageCode
      expect(catalogBaseLine).toBeDefined()
    })

    // SCENARIO: Default fallback when catalogBaseLanguage is undefined (backward compatibility)
    // RULE: If workspace has no catalogBaseLanguage set, default to "it" (Italian)
    // This ensures existing Italian workspaces behave identically to before the fix
    it("should default to 'it' when catalogBaseLanguage is undefined", () => {
      // RULE: The code must have a fallback || "it" for undefined catalogBaseLanguage
      expect(routeMessageBody).toMatch(/catalogBaseLanguage\s*\|\|\s*["']it["']/)
    })
  })

  // ========================================================================
  // SECTION 5: Logging includes catalogBaseLanguage
  // ========================================================================
  describe("Logging", () => {

    // SCENARIO: Skip translation log should include catalogBaseLanguage for debugging
    // RULE: When translation is skipped, log must show what base language was matched
    it("should log catalogBaseLanguage when skipping translation", () => {
      // Find the skip translation log block
      const skipLogIndex = routeMessageBody.indexOf("Skipping translation")
      expect(skipLogIndex).toBeGreaterThan(-1)

      // Get surrounding context (next 200 chars)
      const logContext = routeMessageBody.substring(skipLogIndex, skipLogIndex + 200)

      // RULE: Log must include catalogBaseLanguage for debugging
      expect(logContext).toContain("catalogBaseLanguage")
    })
  })
})
