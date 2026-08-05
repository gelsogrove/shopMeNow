/**
 * Shared in-process runtime for testing custom-demoam from the command line
 * — never WhatsApp (CLAUDE.md §8). Used by both run-one.mts (one-off turns)
 * and run-scenarios.mts (scripted multi-turn scenarios).
 *
 * Handlers here are the CLI's stand-in for what a real host
 * (custom-client-chatbot.service.ts) would build from Prisma — same tables,
 * same fields, so a scenario that passes here reflects real DB content, not
 * a mock.
 */
import { prisma } from "@echatbot/database"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import { chatbotFn, type ChatbotInput, type ChatbotOutput, type HistoryEntry } from "../agent.js"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const SESSIONS_DIR = path.join(__dirname, ".demoam-sessions")
export const AMROBOTS_WORKSPACE_ID = "5870e678-e610-46d1-b85c-36f76f2de95a"

export interface SavedSession {
  sessionId: string
  history: HistoryEntry[]
  persistedState: unknown
}

export function sessionPath(phone: string): string {
  const safe = phone.replace(/[^a-zA-Z0-9+]/g, "_")
  return path.join(SESSIONS_DIR, `${safe}.json`)
}

export function loadSession(phone: string): SavedSession {
  const p = sessionPath(phone)
  if (fs.existsSync(p)) {
    return JSON.parse(fs.readFileSync(p, "utf8"))
  }
  return { sessionId: `cli-${phone.replace(/[^a-zA-Z0-9]/g, "")}-${Date.now()}`, history: [], persistedState: undefined }
}

export function saveSession(phone: string, session: SavedSession): void {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true })
  fs.writeFileSync(sessionPath(phone), JSON.stringify(session, null, 2))
}

export function wipeSession(phone: string): void {
  const p = sessionPath(phone)
  if (fs.existsSync(p)) fs.unlinkSync(p)
}

async function getFaqs({ workspaceId }: { workspaceId: string }) {
  return prisma.fAQ.findMany({
    where: { workspaceId, isActive: true },
    select: { question: true, answer: true },
  })
}

async function listFlows({ workspaceId }: { workspaceId: string }) {
  const rows = await prisma.flow.findMany({
    where: { workspaceId },
    include: { flowCategory: true },
  })
  return rows.map((f) => ({
    flowId: f.id,
    title: f.title,
    hint: f.description ?? undefined,
    category: f.flowCategory?.name,
  }))
}

async function loadFlow({ workspaceId, flowId }: { workspaceId: string; flowId: string }) {
  const flow = await prisma.flow.findFirst({
    where: { id: flowId, workspaceId },
    include: { nodes: { include: { outgoingEdges: true } } },
  })
  if (!flow) return null
  return {
    hash: flow.hash,
    nodes: flow.nodes.map((n) => ({
      id: n.id,
      question: n.question,
      fieldKey: n.fieldKey,
      fieldType: n.fieldType,
      terminalType: n.terminalType,
      outgoingEdges: n.outgoingEdges.map((e) => ({
        label: e.label,
        targetNodeId: e.targetNodeId,
        targetFlowId: e.targetFlowId,
        triggersEscalation: e.triggersEscalation,
      })),
    })),
  }
}

export interface RunTurnParams {
  phone: string
  message: string
  userName?: string
  language?: string
}

export interface TurnResult {
  output: ChatbotOutput
  elapsedMs: number
}

/** Runs exactly one turn against the REAL AmRobots data, round-tripping session state through the on-disk store. */
export async function runTurn({ phone, message, userName, language }: RunTurnParams): Promise<TurnResult> {
  const session = loadSession(phone)
  const resolvedUserName = userName ?? `Visitor ${phone.replace(/[^a-zA-Z0-9]/g, "").slice(-6)}`

  const input: ChatbotInput = {
    userMessage: message,
    userName: resolvedUserName,
    channel: "whatsapp",
    config: {
      workspaceId: AMROBOTS_WORKSPACE_ID,
      debugChannel: true,
      isPlayground: false,
      language,
      handlers: { getFaqs, listFlows, loadFlow },
    },
    context: {
      sessionId: session.sessionId,
      phoneNumber: phone,
      history: session.history,
      persistedState: session.persistedState,
    },
  }

  const before = Date.now()
  const output = await chatbotFn(input)
  const elapsedMs = Date.now() - before

  session.history.push({ role: "user", content: message, timestamp: new Date(before).toISOString() })
  if (output.reply) {
    session.history.push({ role: "assistant", content: output.reply, timestamp: new Date().toISOString() })
  }
  session.persistedState = output.persistedState
  saveSession(phone, session)

  return { output, elapsedMs }
}

/** Backdates the saved session's last message so the NEXT turn is classified as a stale return (welcome-back), same mechanism resolveGreeting uses live. */
export function forceSessionStale(phone: string, secondsAgo: number): void {
  const session = loadSession(phone)
  if (session.history.length === 0) return
  const last = session.history[session.history.length - 1]
  last.timestamp = new Date(Date.now() - secondsAgo * 1000).toISOString()
  saveSession(phone, session)
}
