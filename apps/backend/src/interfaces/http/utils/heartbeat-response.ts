import { Response } from "express"
import logger from "../../../utils/logger"

/**
 * Keeps a slow JSON endpoint alive through Heroku's router timeouts.
 *
 * Heroku's H12 rule: the response must BEGIN within 30 seconds; after the
 * first byte, only a 55-second rolling window between bytes applies. An LLM
 * turn (multiple sequential model calls) can legitimately take longer than
 * 30s, so the widget chat endpoint commits the response early and streams a
 * whitespace byte every few seconds while the turn is being processed, then
 * writes the JSON payload at the end. `JSON.parse` ignores leading
 * whitespace, so `fetch(...).json()` clients keep working unchanged.
 *
 * Trade-off made explicit: once the heartbeat starts, the HTTP status is
 * committed to 200 — a later failure travels IN the body (an object without
 * the fields a success carries), not in the status line. Callers of the
 * endpoint already validate the body shape, so an error body is detected
 * client-side exactly like a non-2xx used to be.
 *
 * The helper degrades to a plain `res.status().json()` when the Response is
 * not a real streaming socket — e.g. the fake `res` that sendAudioMessage
 * passes to sendMessage to capture its JSON.
 */
export type HeartbeatFinisher = {
  /** True when the heartbeat actually started streaming (status committed to 200). */
  readonly streaming: boolean
  /** Write the final JSON payload and end the response. Safe to call once. */
  finish(status: number, payload: unknown): Response
}

const HEARTBEAT_INTERVAL_MS = 10_000

export function startHeartbeat(res: Response): HeartbeatFinisher {
  const raw = res as unknown as {
    flushHeaders?: () => void
    write?: (chunk: string) => boolean
    flush?: () => void
    writableEnded?: boolean
    destroyed?: boolean
  }

  // Not a real streaming response (unit-test mock, sendAudioMessage's capture
  // shim) — behave exactly like the pre-heartbeat code path.
  if (typeof raw.flushHeaders !== "function" || typeof raw.write !== "function") {
    return {
      streaming: false,
      finish: (status, payload) => res.status(status).json(payload),
    }
  }

  let finished = false
  const canWrite = () => !finished && !raw.writableEnded && !raw.destroyed

  res.status(200)
  res.setHeader("Content-Type", "application/json; charset=utf-8")
  res.setHeader("Cache-Control", "no-store")
  raw.flushHeaders()
  // First byte immediately: headers alone are not reliably enough for the
  // router to consider the response "begun".
  raw.write(" ")
  raw.flush?.() // compression() buffers unless flushed

  const timer = setInterval(() => {
    if (!canWrite()) {
      clearInterval(timer)
      return
    }
    raw.write!(" ")
    raw.flush?.()
  }, HEARTBEAT_INTERVAL_MS)

  // Client went away (tab closed, connection dropped): stop writing.
  res.on("close", () => clearInterval(timer))

  return {
    streaming: true,
    finish: (status, payload) => {
      clearInterval(timer)
      if (finished) return res
      finished = true
      if (status !== 200) {
        // The status line is already committed to 200 — record what it would
        // have been so a failed turn is still traceable in the logs.
        logger.warn("[heartbeat-response] error payload delivered with committed 200", {
          intendedStatus: status,
        })
      }
      if (!raw.writableEnded && !raw.destroyed) {
        raw.write!(JSON.stringify(payload))
        res.end()
      }
      return res
    },
  }
}
