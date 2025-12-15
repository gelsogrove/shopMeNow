# Feature 202 - Order Selection, Invoice Email & Agent Variables

## ⚠️ ATTENZIONE CRITICA

**LA FASE PIÙ DELICATA È COME RISPONDE IL CHATBOT!**

- [ ] **CRIT-1**: Studiare `response-builder.service.ts` PRIMA di implementare
- [ ] **CRIT-2**: Usare STESSA struttura risposte esistenti (emoji, spaziatura, liste)
- [ ] **CRIT-3**: Verificare che TUTTI i flussi esistenti continuino a funzionare:
  - [ ] Lista prodotti + selezione numerica ✅
  - [ ] Lista categorie + selezione numerica ✅
  - [ ] Carrello + checkout ✅
  - [ ] Ricerca prodotti ✅
  - [ ] Lista ordini ✅
- [ ] **CRIT-4**: NON inventare nuovi formati di risposta
- [ ] **CRIT-5**: Seguire ESATTAMENTE il flusso definito nella spec

---

## Requirements Checklist

### User Story 1 - Fix Order Selection by Number (P1)
- [ ] **REQ-1.1**: Update `cleanLabel` in `options-mapping.service.ts` to strip `#` prefix from order codes
- [ ] **REQ-1.2**: Verify `loadOrderStatus` correctly receives cleaned order code (without `#`)
- [ ] **REQ-1.3**: Add unit test for `cleanLabel` with order codes (`#ORD-048-2025-9` → `ORD-048-2025-9`)
- [ ] **REQ-1.4**: Add integration test for numeric order selection flow
- [ ] **REQ-1.5**: Test edge case: number outside list range

### User Story 2 - View Order Details with Action Options (P1)
- [ ] **REQ-2.1**: Add action options to order detail response ("Scarica fattura", "Ripeti ordine")
- [ ] **REQ-2.2**: Store action options in lastOptionsContext for fast-path resolution
- [ ] **REQ-2.3**: Add credit note option when order has credit notes
- [ ] **REQ-2.4**: Route "1" after action options to invoice download flow
- [ ] **REQ-2.5**: Route "2" after action options to repeat order flow
- [ ] **REQ-2.6**: Add unit test for order detail formatting with actions

### User Story 3 - Download Invoice via Email (P2)
- [ ] **REQ-3.1**: Create invoice email sending logic with PDF attachment
- [ ] **REQ-3.2**: Fetch invoice PDF from storage (invoiceUrl field)
- [ ] **REQ-3.3**: Handle missing invoice with friendly error message
- [ ] **REQ-3.4**: Send confirmation message to customer after email sent
- [ ] **REQ-3.5**: Include credit note PDFs when present
- [ ] **REQ-3.6**: Add unit test for invoice email generation
- [ ] **REQ-3.7**: Create placeholder/demo invoice PDF for MVP testing

### User Story 4 - Agent Variable Replacement (P2)
- [ ] **REQ-4.1**: Add `SHOW_AGENT_INFO` intent type to intent.types.ts
- [ ] **REQ-4.2**: Create `loadAgentInfo` method in DataLoader
- [ ] **REQ-4.3**: Add agent info response builder in ResponseBuilder
- [ ] **REQ-4.4**: Handle case where customer has no assigned agent
- [ ] **REQ-4.5**: Handle case where workspace has `hasSalesAgents=false`
- [ ] **REQ-4.6**: Add unit test for agent info with assigned agent
- [ ] **REQ-4.7**: Add unit test for agent info without assigned agent

### User Story 5 - Email Routing Based on Sales Team Flag (P2)
- [ ] **REQ-5.1**: Update `contactOperator.ts` to check `hasSalesAgents` flag
- [ ] **REQ-5.2**: Update `confirmOrder.ts` to check `hasSalesAgents` flag
- [ ] **REQ-5.3**: Route to agent email if `hasSalesAgents=true` AND customer has `salesId`
- [ ] **REQ-5.4**: Route to admin email if `hasSalesAgents=false` OR no `salesId`
- [ ] **REQ-5.5**: Add unit test for email routing with `hasSalesAgents=true` and agent
- [ ] **REQ-5.6**: Add unit test for email routing with `hasSalesAgents=false`
- [ ] **REQ-5.7**: Consider extracting email routing to shared utility

### User Story 6 - Repeat Order Flow (P2) ⬆️ Upgraded
- [ ] **REQ-6.1**: Implement `repeatOrder` calling function (atomic operation)
- [ ] **REQ-6.2**: Clear existing cart before adding items
- [ ] **REQ-6.3**: Check stock availability for ALL products FIRST
- [ ] **REQ-6.4**: If ANY product unavailable → ABORT with message: "❌ Mi dispiace, l'ordine non si può ripetere per mancanza di stock in questo momento. Vuoi vedere la lista dei prodotti?"
- [ ] **REQ-6.5**: Show options after abort: "1. 📦 Sì, mostrami i prodotti" / "2. 🔙 No, torna al menu"
- [ ] **REQ-6.6**: Add all items from original order to cart (only if ALL available)
- [ ] **REQ-6.7**: Automatically confirm order (no manual confirmation)
- [ ] **REQ-6.8**: Send confirmation email with invoice to customer
- [ ] **REQ-6.9**: Send notification to agent/admin based on hasSalesAgents
- [ ] **REQ-6.10**: Use transaction for atomicity (rollback on failure)
- [ ] **REQ-6.11**: Respond with new order code and confirmation message

---

## PDF Nomenclatura
- [ ] **PDF-1**: Fattura: `{orderCode}_fattura.pdf` (es. `ORD-048-2025-9_fattura.pdf`)
- [ ] **PDF-2**: Nota di credito: `{orderCode}_notadicredito{N}.pdf` (es. `ORD-048-2025-9_notadicredito1.pdf`)
- [ ] **PDF-3**: Storage path: `storage/invoices/{workspaceId}/`
- [ ] **PDF-4**: Create demo/placeholder PDFs with correct naming for MVP

---

## Security Checklist
- [ ] **SEC-1**: Verify workspace isolation in all new queries
- [ ] **SEC-2**: Verify customer owns order before showing details
- [ ] **SEC-3**: Verify customer owns order before sending invoice email
- [ ] **SEC-4**: Sanitize order codes before database queries

## Testing Checklist
- [ ] **TEST-1**: All existing order-related tests pass
- [ ] **TEST-2**: New unit tests for `cleanLabel` order code handling
- [ ] **TEST-3**: New unit tests for agent info loading
- [ ] **TEST-4**: New unit tests for email routing logic
- [ ] **TEST-5**: Integration test for order selection flow
- [ ] **TEST-6**: Concurrent request tests for cart operations (repeat order)

## Unit Tests Dettagliati (MANDATORY)

### Options Mapping Tests (`options-mapping.service.spec.ts`)
- [ ] **UT-OM-1**: `cleanLabel` strips `#` prefix from order codes
- [ ] **UT-OM-2**: `cleanLabel` handles order codes without `#` prefix
- [ ] **UT-OM-3**: `cleanLabel` preserves other label formats (products, categories)
- [ ] **UT-OM-4**: Numeric selection "1" after ORDER list returns correct order code
- [ ] **UT-OM-5**: Numeric selection "1" after PRODUCT list returns correct product

### Data Loader Tests (`data-loader.service.spec.ts`)
- [ ] **UT-DL-1**: `loadOrderStatus` receives order code without `#` prefix
- [ ] **UT-DL-2**: `loadOrderStatus` returns full order details with items
- [ ] **UT-DL-3**: `loadAgentInfo` returns agent details when customer has salesId
- [ ] **UT-DL-4**: `loadAgentInfo` returns null when customer has no salesId
- [ ] **UT-DL-5**: `loadAgentInfo` respects workspace `hasSalesAgents` flag

### Email Service Tests (`email.service.spec.ts`)
- [ ] **UT-EM-1**: Invoice email includes PDF attachment
- [ ] **UT-EM-2**: Invoice PDF naming follows `{orderCode}_fattura.pdf` convention
- [ ] **UT-EM-3**: Credit note email includes multiple PDF attachments
- [ ] **UT-EM-4**: Credit note naming follows `{orderCode}_notadicredito{N}.pdf` convention
- [ ] **UT-EM-5**: Email routing to agent when `hasSalesAgents=true` AND `salesId` exists
- [ ] **UT-EM-6**: Email routing to admin when `hasSalesAgents=false`
- [ ] **UT-EM-7**: Email routing to admin when `hasSalesAgents=true` BUT no `salesId`

### Repeat Order Tests (`repeat-order.spec.ts`)
- [ ] **UT-RO-1**: Repeat order clears existing cart
- [ ] **UT-RO-2**: Repeat order adds all items from original order
- [ ] **UT-RO-3**: Repeat order creates new order automatically
- [ ] **UT-RO-4**: Repeat order sends confirmation email
- [ ] **UT-RO-5**: Repeat order fails gracefully when products unavailable
- [ ] **UT-RO-6**: Repeat order is atomic (rollback on failure)

### Response Builder Tests (`response-builder.service.spec.ts`)
- [ ] **UT-RB-1**: Order details include action options (fattura, ripeti, nota credito)
- [ ] **UT-RB-2**: Action options stored in lastOptionsContext
- [ ] **UT-RB-3**: Credit note option only shown when credit notes exist

## Documentation Checklist
- [ ] **DOC-1**: Update Swagger if any new endpoints added
- [ ] **DOC-2**: Document invoice storage structure
- [ ] **DOC-3**: Document email routing rules
- [ ] **DOC-4**: Document new intent type SHOW_AGENT_INFO

---

## Implementation Progress

| Story | Priority | Status | Notes |
|-------|----------|--------|-------|
| US-1 Order Selection Fix | P1 | ⬜ Not Started | Critical bug fix |
| US-2 Order Details Actions | P1 | ⬜ Not Started | Core feature |
| US-3 Invoice Email | P2 | ⬜ Not Started | Business feature |
| US-4 Agent Variable | P2 | ⬜ Not Started | B2B feature |
| US-5 Email Routing | P2 | ⬜ Not Started | Operational |
| US-6 Repeat Order | P2 | ⬜ Not Started | ⬆️ Upgraded from P3 |

**Legend**: ⬜ Not Started | 🔄 In Progress | ✅ Complete | ❌ Blocked
