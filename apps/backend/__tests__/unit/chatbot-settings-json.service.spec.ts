/**
 * Tests for the chatbot settings.json generator.
 *
 * WHAT: buildChatbotSettingsJson() renders the runtime config a custom chatbot
 * module reads, by layering the values a user saved in the Settings UI on top
 * of the module's committed settings.json defaults.
 *
 * WHY these cases: the generator sits directly behind the Save button, so the
 * risks worth pinning down are (a) silently dropping a value the user typed,
 * (b) writing empty/garbage over a working default, and (c) leaking platform-only
 * settings (widget colors, WhatsApp credentials) into the chatbot's config.
 */
import { readFile } from "fs/promises"
import { buildChatbotSettingsJson } from "../../src/application/services/chatbot-settings-json.service"

jest.mock("fs/promises", () => ({
  readFile: jest.fn(),
  writeFile: jest.fn(),
}))

const mockReadFile = readFile as jest.MockedFunction<typeof readFile>

/** Mirrors the real custom-demorobot/settings.json shape. */
const MODULE_DEFAULTS = {
  model: "anthropic/claude-haiku-4.5",
  temperature: 0.3,
  maxTokens: 800,
  maxToolHops: 4,
  operatorBriefingLanguage: "en",
  operatorEmail: "default@demorobot.demo",
  emailFrom: "DemoRobot Bot <noreply@demorobot.demo>",
  emailSubjectPrefix: "[DemoRobot] Incident",
  maxMessageChars: 2000,
  maxMessagesPerMinute: 30,
  maxTurnsPerSession: 50,
  privacyPolicyUrl: "https://www.echatbot.ai/privacy-policy",
  similarityThreshold: 0.7,
  topK: 3,
  audioOutput: false,
  audioVoices: {},
}

beforeEach(() => {
  jest.clearAllMocks()
  mockReadFile.mockResolvedValue(JSON.stringify(MODULE_DEFAULTS) as any)
})

describe("buildChatbotSettingsJson", () => {
  it("returns null when the workspace has no custom chatbot module", async () => {
    // A plain e-commerce/informational workspace has no module to configure,
    // so there is nothing to generate and nothing to write.
    const result = await buildChatbotSettingsJson({ customChatbotId: null })
    expect(result).toBeNull()
    expect(mockReadFile).not.toHaveBeenCalled()
  })

  it("uses module defaults when the user has configured nothing", async () => {
    // A freshly linked module must behave exactly as it did before the Settings
    // UI existed — this is what guarantees the change is backwards compatible.
    const result = await buildChatbotSettingsJson({ customChatbotId: "demorobot" })
    expect(result).toEqual(MODULE_DEFAULTS)
  })

  it("applies the values the user saved in the Settings UI", async () => {
    const result = await buildChatbotSettingsJson({
      customChatbotId: "demorobot",
      customChatbotModel: "openai/gpt-4o",
      customChatbotTemperature: 1.2,
      operatorEmail: "support@acme.com",
      defaultLanguage: "it",
    })

    expect(result).toMatchObject({
      model: "openai/gpt-4o",
      temperature: 1.2,
      operatorEmail: "support@acme.com",
      operatorBriefingLanguage: "it",
    })
  })

  it("keeps defaults for untouched fields the UI does not expose", async () => {
    // Rate limits, token budgets and audio config are module-owned; the UI never
    // sets them, so a save must not blank them out.
    const result = await buildChatbotSettingsJson({
      customChatbotId: "demorobot",
      customChatbotModel: "openai/gpt-4o",
    })

    expect(result).toMatchObject({
      maxTokens: 800,
      maxToolHops: 4,
      maxMessagesPerMinute: 30,
      emailFrom: MODULE_DEFAULTS.emailFrom,
      privacyPolicyUrl: MODULE_DEFAULTS.privacyPolicyUrl,
    })
  })

  it("falls back to the default when a saved text value is empty or blank", async () => {
    // Clearing a field in the UI stores "" — writing that through would leave the
    // agent with no model/operator email at all, which breaks it at runtime.
    const result = await buildChatbotSettingsJson({
      customChatbotId: "demorobot",
      customChatbotModel: "   ",
      operatorEmail: "",
    })

    expect(result).toMatchObject({
      model: MODULE_DEFAULTS.model,
      operatorEmail: MODULE_DEFAULTS.operatorEmail,
    })
  })

  it("preserves temperature 0 instead of treating it as unset", async () => {
    // 0 is a meaningful value (fully deterministic) and is falsy in JS — the
    // classic bug this guards against is `value || default` swallowing it.
    const result = await buildChatbotSettingsJson({
      customChatbotId: "demorobot",
      customChatbotTemperature: 0,
    })

    expect(result?.temperature).toBe(0)
  })

  it("falls back to the default temperature when none is stored", async () => {
    const result = await buildChatbotSettingsJson({
      customChatbotId: "demorobot",
      customChatbotTemperature: null,
    })

    expect(result?.temperature).toBe(MODULE_DEFAULTS.temperature)
  })

  it("does not emit platform-only settings into the chatbot config", async () => {
    // Widget appearance and WhatsApp credentials are platform concerns. If they
    // ever leak in here, the generated file stops matching the module's schema.
    const result = await buildChatbotSettingsJson({
      customChatbotId: "demorobot",
      customChatbotModel: "openai/gpt-4o",
    })

    expect(Object.keys(result!).sort()).toEqual(Object.keys(MODULE_DEFAULTS).sort())
  })
})
