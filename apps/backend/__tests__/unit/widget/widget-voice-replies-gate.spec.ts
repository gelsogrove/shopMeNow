/**
 * Widget Voice Replies gate (workspace.audioOutput)
 *
 * WHAT: when a customer sends a voice note from the widget, the bot must reply
 * with audio ONLY if the workspace has Voice Replies enabled
 * (workspace.audioOutput = true). Speech to Text (speechToTextEnabled) governs
 * the INBOUND direction only: the customer may speak, the transcription is
 * processed, but the reply stays text unless Voice Replies is on.
 *
 * WHY: Andrea reported (2026-08-12) the demo bot answered a voice note with an
 * audio reply even though the "Voice Replies" toggle in Settings was OFF. The
 * widget audio path called generateSpeech unconditionally on voice input.
 * The rule is channel-wide: widget, playground and WhatsApp (ultramsg webhook
 * + inbound pipeline) all gate outbound audio on workspace.audioOutput.
 *
 * These tests lock the widget gate:
 *  1. STT on  + Voice Replies OFF → text-only reply, generateSpeech NEVER called
 *  2. STT on  + Voice Replies ON  → generateSpeech called, audioUrl attached
 *  3. STT off + no custom chatbot → 403 (voice input rejected upstream)
 */

// Mock prisma BEFORE importing the controller
jest.mock("@echatbot/database", () => {
  const mockPrismaInstance = {
    workspace: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
    },
  }
  return {
    PrismaClient: jest.fn(() => mockPrismaInstance),
    prisma: mockPrismaInstance,
    AgentType: { ROUTER: "ROUTER" },
  }
})

// Heavy LLM imports pulled in by the controller — not exercised here, mocked
// exactly like the other widget specs so the module chain resolves
jest.mock("../../../src/services/llm-router.service", () => ({
  LLMRouterService: jest.fn(() => ({ routeMessage: jest.fn() })),
}))
jest.mock("../../../src/application/chat-engine", () => ({
  getChatEngine: jest.fn(() => ({ routeMessage: jest.fn() })),
}))

// Whisper transcription — always succeeds; the transcription becomes the message
jest.mock("../../../src/services/audio-transcription.service", () => ({
  transcribeAudio: jest.fn().mockResolvedValue({ text: "hola robot" }),
}))

// ElevenLabs TTS — the call under test: must fire only when audioOutput=true
jest.mock("../../../src/services/tts-elevenlabs.service", () => ({
  generateSpeech: jest.fn().mockResolvedValue({
    audioUrl: "https://cdn.example/tts.mp3",
    storageKey: "tts/key",
    sizeBytes: 123,
  }),
}))

// fs — the handler reads/unlinks the uploaded temp file; keep the real module
// shape but neutralize disk access
jest.mock("fs", () => ({
  ...jest.requireActual("fs"),
  readFileSync: jest.fn(() => Buffer.from("fake-audio")),
  unlinkSync: jest.fn(),
}))

import { prisma } from "@echatbot/database"
import { generateSpeech } from "../../../src/services/tts-elevenlabs.service"
import { WidgetChatController } from "../../../src/interfaces/http/controllers/widget-chat.controller"

const mockedFindUnique = prisma.workspace.findUnique as jest.Mock
const mockedGenerateSpeech = generateSpeech as jest.Mock

function buildReqRes() {
  const req: any = {
    params: { workspaceId: "ws-1" },
    body: { language: "es" },
    headers: {},
    file: { path: "/tmp/fake.webm", mimetype: "audio/webm" },
  }
  const res: any = {
    statusCode: 200,
    payload: undefined,
    status(code: number) {
      this.statusCode = code
      return this
    },
    json(body: any) {
      this.payload = body
      return this
    },
  }
  return { req, res }
}

function buildController() {
  const controller = new WidgetChatController()
  // sendAudioMessage delegates the bot turn to sendMessage — stub it so the
  // test isolates the TTS gate (the only logic under test here)
  ;(controller as any).sendMessage = jest.fn(async (_req: any, res: any) => {
    res.status(200).json({ response: "respuesta de texto", language: "es" })
  })
  return controller
}

describe("Widget Voice Replies gate (workspace.audioOutput)", () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it("replies with TEXT ONLY when Speech to Text is on but Voice Replies is off", async () => {
    // The exact configuration from Andrea's bug report: STT ✅, Voice Replies ❌
    mockedFindUnique.mockResolvedValue({
      speechToTextEnabled: true,
      customChatbotId: null,
      audioOutput: false,
    })
    const { req, res } = buildReqRes()

    await buildController().sendAudioMessage(req, res)

    expect(res.statusCode).toBe(200)
    expect(res.payload.response).toBe("respuesta de texto")
    // The core assertion: no TTS call, no audio attached to the reply
    expect(mockedGenerateSpeech).not.toHaveBeenCalled()
    expect(res.payload.audioUrl).toBeUndefined()
  })

  it("replies with AUDIO when both Speech to Text and Voice Replies are on", async () => {
    mockedFindUnique.mockResolvedValue({
      speechToTextEnabled: true,
      customChatbotId: null,
      audioOutput: true,
    })
    const { req, res } = buildReqRes()

    await buildController().sendAudioMessage(req, res)

    expect(res.statusCode).toBe(200)
    expect(mockedGenerateSpeech).toHaveBeenCalledTimes(1)
    expect(res.payload.audioUrl).toBe("https://cdn.example/tts.mp3")
  })

  it("rejects voice input (403) when Speech to Text is off and no custom chatbot", async () => {
    mockedFindUnique.mockResolvedValue({
      speechToTextEnabled: false,
      customChatbotId: null,
      audioOutput: true,
    })
    const { req, res } = buildReqRes()

    await buildController().sendAudioMessage(req, res)

    expect(res.statusCode).toBe(403)
    expect(mockedGenerateSpeech).not.toHaveBeenCalled()
  })
})
