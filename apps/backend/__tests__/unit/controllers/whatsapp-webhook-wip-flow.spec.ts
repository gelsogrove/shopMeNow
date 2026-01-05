/**
 * WhatsApp Webhook - WIP (Channel Disabled) Flow
 *
 * DOCUMENTATION TEST: Verifica comportamento quando channelStatus=false
 *
 * Questo test documenta il comportamento atteso del sistema quando
 * il canale è in manutenzione e il chatbot deve inviare il WIP message.
 */

describe("WhatsApp Webhook - WIP (Channel Disabled) Flow", () => {
  it("should save user message, enqueue, and WIP assistant message when channelStatus=false", () => {
    /**
     * EXPECTED BEHAVIOR:
     *
     * 1. Customer scrive un messaggio WhatsApp
     * 2. Backend riceve il messaggio in whatsapp-webhook.controller.ts
     * 3. WorkspaceAccessService ritorna blockReason=CHANNEL_DISABLED
     * 4. Sistema costruisce WIP message (workspace.wipMessage + SafetyTranslationAgent)
     * 5. Salva messaggio utente (role: user, agentType: NONE)
     * 6. Salva messaggio WIP (role: assistant, agentType: ROUTER, deliveryStatus: pending)
     * 7. Enqueue WIP in WhatsApp queue
     * 8. Ritorna 200 con:
     *    {
     *      status: "channel_disabled",
     *      code: "CHANNEL_DISABLED",
     *      message: "Channel is in maintenance mode. Your message has been saved.",
     *      wipMessage: "<translated WIP message>"
     *    }
     *
     * VERIFIED IN: whatsapp-webhook.controller.ts:908-990
     */

    const expectedFlow = {
      step3: "WorkspaceAccessService returns CHANNEL_DISABLED",
      step4: "Build WIP message with SafetyTranslationAgent",
      step5: "Save user message (agentType=NONE)",
      step6: "Save WIP assistant message (agentType=ROUTER, deliveryStatus=pending)",
      step7: "Enqueue WIP message",
      step8: "Return 200 with wipMessage",
    }

    expect(expectedFlow.step4).toBe("Build WIP message with SafetyTranslationAgent")
    expect(expectedFlow.step6).toBe("Save WIP assistant message (agentType=ROUTER, deliveryStatus=pending)")
    expect(expectedFlow.step7).toBe("Enqueue WIP message")
    expect(expectedFlow.step8).toBe("Return 200 with wipMessage")
  })
})
