import { describe, expect, it } from "vitest"
import {
  buildWidgetStorageKeys,
  getOrCreateVisitorId,
  mapWidgetMessages,
} from "@/components/chat/adapters/widgetAdapter"
import { mapDebugMessage } from "@/components/chat/adapters/debugAdapter"

const createStorage = () => {
  const store = new Map<string, string>()
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value)
    },
  } as Storage
}

describe("widgetAdapter", () => {
  it("builds workspace-scoped storage keys", () => {
    const keys = buildWidgetStorageKeys("ws-123")
    expect(keys.visitorId).toBe("echatbot-visitor-id:ws-123")
    expect(keys.sessionId).toBe("echatbot-session-id:ws-123")
    expect(keys.messages).toBe("echatbot-messages:ws-123")
  })

  it("generates a visitor id when missing", () => {
    const storage = createStorage()
    const visitorId = getOrCreateVisitorId(storage, "ws-123", () => 1700000000000, () => 0.123456)
    expect(visitorId).toMatch(/^visitor_1700000000000_/)
    expect(storage.getItem("echatbot-visitor-id:ws-123")).toBe(visitorId)
  })

  it("maps widget messages into chat surface shape", () => {
    const mapped = mapWidgetMessages([
      { role: "user", content: "hello" },
      { role: "bot", content: "hi" },
    ])
    expect(mapped).toEqual([
      { role: "user", content: "hello" },
      { role: "bot", content: "hi" },
    ])
  })
})

describe("debugAdapter", () => {
  it("maps customer messages to user role", () => {
    const mapped = mapDebugMessage({
      id: "msg-1",
      content: "hi",
      sender: "customer",
    })
    expect(mapped.role).toBe("user")
    expect(mapped.sender).toBe("customer")
  })

  it("maps agent messages to bot role", () => {
    const mapped = mapDebugMessage({
      id: "msg-2",
      content: "hello",
      sender: "user",
    })
    expect(mapped.role).toBe("bot")
    expect(mapped.sender).toBe("bot")
  })
})
