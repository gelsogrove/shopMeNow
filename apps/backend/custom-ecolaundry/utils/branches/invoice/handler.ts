// Invoice branch handler.
//
// Status: thin wrapper (Andrea, 2026-05-08). Routed here at T1 by the
// LLM router (any of the 6 languages — "factura", "fattura", "invoice",
// "facture", ...) but the actual 8-step invoice gather flow is still
// handled by the legacy `guardCaso9Factura` chain in
// utils/guards/invoice-flow.ts. Migration of the full state machine
// (lavandería → tipo → razón social → dirección → CIF → fecha → email →
// nombre → final) into a self-contained branch is a future session.
//
// We seed `state.pendingFlow = 'invoice-ask-location'` so the legacy
// invoice flow guard takes over from T1 without needing the LLM to
// re-classify the topic.

import type { BranchHandler } from '../types.js'

export const invoiceHandler: BranchHandler = async ({ ar }) => {
  // Activate the legacy invoice flow at the right starting step. The
  // existing nextCaso9Step() helper inside invoice-flow.ts then skips
  // any step whose data is already in sticky state (location, machine
  // type) and asks only the missing ones.
  if (!ar.state.pendingFlow.startsWith('invoice-')) {
    ar.state.pendingFlow = 'invoice-ask-location'
    ar.state.lastResolvedIntent = 'faq'
    ar.state.faqTopic = 'invoice'
  }

  return {
    reply: '',
    handoff: 'delegate-to-legacy',
  }
}
