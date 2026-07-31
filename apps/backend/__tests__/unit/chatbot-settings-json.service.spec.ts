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
  audioVoices: { default: "ModuleDefaultVoice" },
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
      customChatbotMaxTokens: 1500,
      operatorEmail: "support@acme.com",
      customChatbotEmailFrom: "Acme Bot <noreply@acme.com>",
      customChatbotEmailSubjectPrefix: "[Acme] Incident",
      defaultLanguage: "it",
    })

    expect(result).toMatchObject({
      model: "openai/gpt-4o",
      temperature: 1.2,
      maxTokens: 1500,
      operatorEmail: "support@acme.com",
      emailFrom: "Acme Bot <noreply@acme.com>",
      emailSubjectPrefix: "[Acme] Incident",
      operatorBriefingLanguage: "it",
    })
  })

  it("prefers the chatbot-specific operator email over the general one", async () => {
    // Human Support has a general operator address; the custom chatbot can
    // override it. The more specific setting has to win, or escalations from the
    // module would go to the wrong inbox.
    const result = await buildChatbotSettingsJson({
      customChatbotId: "demorobot",
      customChatbotOperatorEmail: "module@acme.com",
      operatorEmail: "general@acme.com",
    })

    expect(result?.operatorEmail).toBe("module@acme.com")
  })

  it("stores ElevenLabs voice ids per language when audio is enabled", async () => {
    const result = await buildChatbotSettingsJson({
      customChatbotId: "demorobot",
      audioOutput: true,
      audioVoices: { default: "EXAVITQu4vr4xnSDxMaL", it: "EXAVITQu4vr4xnSDxMaL", es: "FGY2WhTYpPnrIDTdsKH5" },
    })

    expect(result?.audioOutput).toBe(true)
    expect(result?.audioVoices).toEqual({
      default: "EXAVITQu4vr4xnSDxMaL",
      it: "EXAVITQu4vr4xnSDxMaL",
      es: "FGY2WhTYpPnrIDTdsKH5",
    })
  })

  it("drops blank voice ids so half-filled language rows never reach the agent", async () => {
    // The UI renders an input per language; the user typically fills only a few.
    // Empty ones must not land in the file as empty strings.
    const result = await buildChatbotSettingsJson({
      customChatbotId: "demorobot",
      audioVoices: { it: "EXAVITQu4vr4xnSDxMaL", es: "   ", en: "" },
    })

    expect(result?.audioVoices).toEqual({ it: "EXAVITQu4vr4xnSDxMaL" })
  })

  it("keeps the existing voices when the stored value is malformed", async () => {
    // A bad manual edit of the JSON column must not wipe working voice config.
    const result = await buildChatbotSettingsJson({
      customChatbotId: "demorobot",
      audioVoices: "not-an-object",
    })

    expect(result?.audioVoices).toEqual(MODULE_DEFAULTS.audioVoices)
  })

  it("ignores a non-positive maxTokens instead of writing it through", async () => {
    // 0 or a negative budget would make the agent unable to answer at all.
    const result = await buildChatbotSettingsJson({
      customChatbotId: "demorobot",
      customChatbotMaxTokens: 0,
    })

    expect(result?.maxTokens).toBe(MODULE_DEFAULTS.maxTokens)
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
