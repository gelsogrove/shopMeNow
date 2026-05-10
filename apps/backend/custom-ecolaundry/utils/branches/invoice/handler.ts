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
  // Mark the topic so downstream guards/history know we are in an invoice flow.
  // Do NOT pre-set pendingFlow: the legacy guardInvoiceFlow entry point detects
  // the invoice trigger via detectInvoiceIntent and calls nextCaso9Step to decide
  // the first question. Pre-setting 'invoice-ask-location' caused the guard's
  // switch to consume T1 ("Quiero una factura") as the location answer.
  ar.state.lastResolvedIntent = 'faq'
  ar.state.faqTopic = 'invoice'

  return {
    reply: '',
    handoff: 'delegate-to-legacy',
  }
}
