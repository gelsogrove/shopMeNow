/**
 * Widget no-enqueue structural test
 *
 * SCENARIO: The widget responds directly via HTTP response, never via WhatsApp queue.
 * Unlike WhatsApp messages (which go through whatsAppQueue → scheduler → send),
 * widget messages are returned inline in the HTTP response body.
 *
 * RULE: widget-chat.controller.ts must NEVER import or reference whatsAppQueue.
 * RULE: Widget channel must never write to the whatsAppQueue table.
 *
 * This is a structural test that verifies the controller file doesn't contain
 * any references to the WhatsApp queue system.
 */

import * as fs from "fs"
import * as path from "path"

describe("Widget No-Enqueue Guarantee", () => {
  const widgetControllerPath = path.join(
    __dirname,
    "../../src/interfaces/http/controllers/widget-chat.controller.ts"
  )

  let controllerSource: string

  beforeAll(() => {
    controllerSource = fs.readFileSync(widgetControllerPath, "utf-8")
  })

  // SCENARIO: Widget controller must not import WhatsAppQueueService
  // RULE: Widget responds directly via res.json(), not via queue
  it("should NOT import WhatsAppQueueService", () => {
    expect(controllerSource).not.toContain("WhatsAppQueueService")
    expect(controllerSource).not.toContain("whatsapp-queue.service")
  })

  // SCENARIO: Widget controller must not reference whatsAppQueue table
  // RULE: Only WhatsApp channel writes to whatsAppQueue
  it("should NOT reference whatsAppQueue table", () => {
    expect(controllerSource).not.toContain("whatsAppQueue")
    expect(controllerSource).not.toContain("WhatsAppQueue")
  })

  // SCENARIO: Widget controller must not use enqueue() method
  // RULE: Widget messages are synchronous HTTP responses
  it("should NOT use enqueue method", () => {
    // Check for .enqueue( pattern which would indicate queue usage
    expect(controllerSource).not.toMatch(/\.enqueue\s*\(/)
  })

  // SCENARIO: Widget controller SHOULD use res.status().json() for responses
  // RULE: Widget responses go inline in HTTP response body
  it("should use res.json() or res.status().json() for inline responses", () => {
    expect(controllerSource).toMatch(/res\.(json|status\(\d+\)\.json)\s*\(/)
  })
})
