/**
 * heartbeat-response — keeps slow JSON endpoints alive past Heroku's H12.
 *
 * WHAT: startHeartbeat(res) commits a 200 immediately, streams a whitespace
 * byte every 10s while the handler works, and finish() writes the JSON body.
 *
 * WHY: live incident 2026-08-31 — a demosappada widget turn took 33s, Heroku
 * cut the connection at 30s (H12), and the visitor saw the widget's generic
 * error even though the bot's reply was ready 3 seconds later. The heartbeat
 * makes delivery independent of how long the LLM turn takes.
 *
 * The helper must also DEGRADE to a plain res.status().json() when handed a
 * non-streaming Response (sendAudioMessage passes a capture shim to
 * sendMessage), so the audio pipeline keeps capturing the inner JSON.
 */
import { EventEmitter } from "events"
import { startHeartbeat } from "../../../interfaces/http/utils/heartbeat-response"

/** A minimal streaming Response double (what express gives us on a live socket). */
function makeStreamingRes() {
  const emitter = new EventEmitter()
  const chunks: string[] = []
  const res: any = emitter
  res.statusCode = 0
  res.headers = {} as Record<string, string>
  res.writableEnded = false
  res.destroyed = false
  res.status = (code: number) => {
    res.statusCode = code
    return res
  }
  res.setHeader = (k: string, v: string) => {
    res.headers[k] = v
  }
  res.flushHeaders = jest.fn()
  res.flush = jest.fn()
  res.write = (chunk: string) => {
    chunks.push(chunk)
    return true
  }
  res.end = () => {
    res.writableEnded = true
  }
  res.json = jest.fn()
  res.chunks = chunks
  return res
}

/** The capture shim shape sendAudioMessage passes to sendMessage: no write/flushHeaders. */
function makeCaptureShim() {
  const res: any = {
    statusCode: 0,
    captured: null as null | { code: number; body: unknown },
  }
  res.status = (code: number) => {
    res.statusCode = code
    return res
  }
  res.json = (body: unknown) => {
    res.captured = { code: res.statusCode, body }
    return res
  }
  res.setHeader = () => res
  return res
}

describe("startHeartbeat", () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })
  afterEach(() => {
    jest.useRealTimers()
  })

  it("commits 200 and writes the first heartbeat byte immediately (H12 needs the response to BEGIN within 30s)", () => {
    const res = makeStreamingRes()
    startHeartbeat(res)

    expect(res.statusCode).toBe(200)
    expect(res.flushHeaders).toHaveBeenCalled()
    // First byte out right away — headers alone don't reliably count as "begun".
    expect(res.chunks).toEqual([" "])
    // compression() buffers unless flushed after each write.
    expect(res.flush).toHaveBeenCalled()
  })

  it("keeps writing whitespace on the interval while the turn runs (55s rolling window between bytes)", () => {
    const res = makeStreamingRes()
    startHeartbeat(res)

    jest.advanceTimersByTime(30_000)
    // 1 immediate + 3 interval beats at 10s each
    expect(res.chunks.length).toBe(4)
    expect(res.chunks.every((c: string) => c === " ")).toBe(true)
  })

  it("finish() stops the timer, appends the JSON payload and ends the response — whitespace + JSON must parse as the payload", () => {
    const res = makeStreamingRes()
    const hb = startHeartbeat(res)

    jest.advanceTimersByTime(20_000)
    hb.finish(200, { success: true, response: "ciao" })

    expect(res.writableEnded).toBe(true)
    // What the client's response.json() sees: heartbeats + body concatenated.
    const raw = res.chunks.join("")
    expect(JSON.parse(raw)).toEqual({ success: true, response: "ciao" })

    // No further beats after finish.
    const count = res.chunks.length
    jest.advanceTimersByTime(60_000)
    expect(res.chunks.length).toBe(count)
  })

  it("a non-200 finish still delivers the payload in the committed-200 body (error travels in the body, not the status line)", () => {
    const res = makeStreamingRes()
    const hb = startHeartbeat(res)

    hb.finish(500, { error: "INTERNAL_ERROR", message: "Failed to process message" })

    const raw = res.chunks.join("")
    // Status stays the committed 200; the body carries the error and no `response`.
    expect(res.statusCode).toBe(200)
    expect(JSON.parse(raw)).toEqual({
      error: "INTERNAL_ERROR",
      message: "Failed to process message",
    })
  })

  it("stops beating when the client disconnects (close event) and finish() then writes nothing", () => {
    const res = makeStreamingRes()
    const hb = startHeartbeat(res)

    res.destroyed = true
    res.emit("close")
    const count = res.chunks.length
    jest.advanceTimersByTime(60_000)
    expect(res.chunks.length).toBe(count)

    // finish on a dead socket must not throw nor write.
    hb.finish(200, { success: true })
    expect(res.chunks.length).toBe(count)
  })

  it("degrades to res.status().json() on a non-streaming response (sendAudioMessage's capture shim keeps working)", () => {
    const res = makeCaptureShim()
    const hb = startHeartbeat(res)

    expect(hb.streaming).toBe(false)
    hb.finish(422, { error: "Could not transcribe audio" })
    expect(res.captured).toEqual({
      code: 422,
      body: { error: "Could not transcribe audio" },
    })
  })

  it("finish() is idempotent — a second call writes nothing more", () => {
    const res = makeStreamingRes()
    const hb = startHeartbeat(res)

    hb.finish(200, { success: true })
    const count = res.chunks.length
    hb.finish(200, { success: true })
    expect(res.chunks.length).toBe(count)
  })
})
