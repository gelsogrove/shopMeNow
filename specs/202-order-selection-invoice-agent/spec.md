# Feature Specification: Order Selection, Invoice Email & Agent Variables

**Feature Branch**: `202-order-selection-invoice-agent`  
**Created**: 2024-12-14  
**Status**: Draft  
**Input**: User description: "Fix order list selection bug (typing '1' returns 'product not found'), add invoice email attachment when customer requests it, fix {{agentName}} variable replacement for 'chi è il mio agente?', handle hasSalesAgents flag for email routing to agent vs admin"

## ⚠️ ATTENZIONE CRITICA - Struttura Risposte Chatbot

**LA FASE PIÙ DELICATA È COME RISPONDE IL CHATBOT!**

- **USARE LA STESSA STRUTTURA** delle risposte esistenti
- **NON INVENTARE** nuovi formati di risposta
- **SEGUIRE ESATTAMENTE** il flusso definito sotto
- **TUTTO QUELLO CHE FUNZIONA DEVE CONTINUARE A FUNZIONARE**
- Prima di implementare: studiare come ResponseBuilder formatta le risposte attuali
- Testare che i flussi esistenti (prodotti, carrello, ordini) non siano impattati

---

## Flusso di Dialogo Completo

### Scenario A: Cliente chiede lista ordini e seleziona un ordine

```
👤 Cliente: "vorrei vedere i miei ordini"

🤖 Bot: "Ecco i tuoi ultimi ordini:
   1. #ORD-048-2025-9 - 15/12/2024 - €450,00 - Consegnato ✅
   2. #ORD-047-2025-8 - 10/12/2024 - €320,00 - In spedizione 📦
   3. #ORD-046-2025-7 - 05/12/2024 - €180,00 - Consegnato ✅
   
   Digita il numero dell'ordine per vedere i dettagli."

👤 Cliente: "1"

🤖 Bot: "📦 Dettagli Ordine #ORD-048-2025-9
   
   📅 Data: 15/12/2024
   📍 Stato: Consegnato ✅
   
   Prodotti:
   • Olio Extra Vergine 1L x 3 - €45,00
   • Pasta Artigianale 500g x 5 - €25,00
   • Vino Rosso DOC x 2 - €38,00
   
   Subtotale: €108,00
   Spedizione: €8,00
   IVA (22%): €23,76
   ━━━━━━━━━━━━━━
   Totale: €450,00
   
   📍 Consegnato a: Via Roma 123, Milano
   
   Cosa vuoi fare?
   1. 📄 Scarica fattura
   2. 🔄 Ripeti ordine
   3. 📋 Scarica nota di credito"  ← (solo se presenti)

👤 Cliente: "1"

🤖 Bot: "Ti ho inviato la fattura per email a mario.rossi@email.com 📧
   Controlla la tua casella di posta!"
   
   [Sistema invia email con PDF allegato: ORD-048-2025-9_fattura.pdf]
```

### Scenario B: Cliente chiede del proprio agente

```
👤 Cliente: "chi è il mio agente?"

🤖 Bot (CON agente assegnato): 
   "Il tuo agente dedicato è:
   👤 Marco Bianchi
   📧 marco.bianchi@azienda.it
   📞 +39 333 1234567
   
   Puoi contattarlo per qualsiasi esigenza!"

🤖 Bot (SENZA agente assegnato):
   "Non hai un agente dedicato al momento.
   Per assistenza puoi contattarci a:
   📧 supporto@azienda.it"
```

### Scenario C: Cliente vuole ripetere un ordine

**Caso SUCCESS:**
```
👤 Cliente: [dopo aver visto dettagli ordine]
👤 Cliente: "2"

🤖 Bot: "🔄 Sto preparando il tuo ordine...
   
   Ho svuotato il carrello precedente e aggiunto:
   • Olio Extra Vergine 1L x 3
   • Pasta Artigianale 500g x 5
   • Vino Rosso DOC x 2
   
   ✅ Ordine #ORD-049-2025-10 confermato!
   Totale: €450,00
   
   Ti abbiamo inviato la conferma per email 📧"
   
   [Sistema: svuota carrello → riempie con items → conferma ordine → invia email]
```

**Caso ABORT (prodotti non disponibili):**
```
👤 Cliente: "2"

🤖 Bot: "❌ Mi dispiace, l'ordine non si può ripetere per mancanza di stock in questo momento.
   
   Vuoi vedere la lista dei prodotti?
   1. 📦 Sì, mostrami i prodotti
   2. 🔙 No, torna al menu"
```

### Scenario D: Cliente scarica nota di credito

```
👤 Cliente: [dopo aver visto dettagli ordine con note di credito]
👤 Cliente: "3"

🤖 Bot: "Ti ho inviato le note di credito per email a mario.rossi@email.com 📧
   
   Allegati:
   • ORD-048-2025-9_notadicredito1.pdf
   • ORD-048-2025-9_notadicredito2.pdf"
```

### Scenario E: Email routing (dietro le quinte)

```
Configurazione Workspace:
- hasSalesAgents: true/false
- Customer.salesId: UUID agente (opzionale)

Quando il sistema invia email:
┌─────────────────────────────────────────┐
│ hasSalesAgents = true AND salesId set   │ → Email va all'AGENTE
│ hasSalesAgents = true AND NO salesId    │ → Email va all'ADMIN
│ hasSalesAgents = false                  │ → Email va all'ADMIN
└─────────────────────────────────────────┘
```

---

## Nomenclatura File PDF

| Tipo | Formato Nome File | Esempio |
|------|-------------------|----------|
| Fattura | `{orderCode}_fattura.pdf` | `ORD-048-2025-9_fattura.pdf` |
| Nota di Credito | `{orderCode}_notadicredito{N}.pdf` | `ORD-048-2025-9_notadicredito1.pdf` |

**Storage Path**: `storage/invoices/{workspaceId}/{orderCode}_fattura.pdf`

**Per MVP**: Usare PDF demo/placeholder con la nomenclatura corretta.

---

## User Scenarios & Testing _(mandatory)_

### User Story 1 - Fix Order Selection by Number (Priority: P1)

As a customer viewing my order list in the chatbot, I want to select an order by typing its number (1, 2, 3...) so I can view the full details of that specific order.

**Why this priority**: This is a critical bug - currently typing "1" after seeing the order list returns "product not found" instead of order details. This breaks the entire order inquiry flow.

**Independent Test**: Can be fully tested by asking "lista ordini", then typing "1", and verifying the system returns order details for the first order.

**Root Cause Analysis**:
1. The `cleanLabel` function in `options-mapping.service.ts` preserves the `#` prefix when cleaning order labels
2. When user types "1", the system resolves to `"#ORD-048-2025-9"` instead of `"ORD-048-2025-9"`
3. The database query in `loadOrderStatus` fails because `orderCode` field doesn't have the `#` prefix

**Acceptance Scenarios**:

1. **Given** a customer has seen the order list, **When** they type "1", **Then** the system retrieves and displays details for the first order in the list
2. **Given** a customer has seen the order list with 10 orders, **When** they type "5", **Then** the system retrieves and displays details for the fifth order
3. **Given** a customer types a number outside the list range (e.g., "15" when only 10 orders exist), **When** processed, **Then** the system responds with a friendly error message
4. **Given** a customer types "1" after seeing a PRODUCT list, **When** processed, **Then** the system correctly shows product details (not order details)
5. **Given** the order list shows `#ORD-048-2025-9`, **When** user selects it, **Then** the query uses `ORD-048-2025-9` (without #)

**360-Degree Validation** _(mandatory for implementation)_:

- [ ] Frontend: N/A (WhatsApp chatbot)
- [ ] Backend API: N/A (existing flow)
- [ ] Service Layer: Update `cleanLabel` in `options-mapping.service.ts` to strip `#` prefix
- [ ] Repository: Verify `loadOrderStatus` query handles cleaned order codes
- [ ] Database: N/A (existing schema)
- [ ] Security: Verify workspace isolation in order queries
- [ ] Testing: Unit tests for `cleanLabel` with order codes, integration test for order selection flow
- [ ] Documentation: N/A
- [ ] Concurrency: N/A (read operation)
- [ ] Prompt Variables: N/A
- [ ] Code Cleanliness: Single fix in cleanLabel method

---

### User Story 2 - View Order Details with Action Options (Priority: P1)

As a customer, after selecting an order, I want to see complete order details and be presented with actions I can take (download invoice, repeat order).

**Why this priority**: Core feature for order management - customers need to see what they ordered and take actions.

**Independent Test**: After selecting order #1, customer sees order details with two options: "1. Scarica fattura" and "2. Ripeti ordine".

**Acceptance Scenarios**:

1. **Given** customer selects an order, **When** details are displayed, **Then** they see: order code, date, status, products with prices, totals, and delivery address
2. **Given** order details are shown, **When** displayed, **Then** customer sees two action options:
   ```
   Cosa vuoi fare?
   1. 📄 Scarica fattura
   2. 🔄 Ripeti ordine
   ```
3. **Given** order has credit notes attached, **When** details are shown, **Then** a third option appears: "3. 📋 Scarica nota di credito"
4. **Given** customer types "1" after seeing action options, **When** processed, **Then** system sends invoice email with PDF attachment
5. **Given** customer types "2" after seeing action options, **When** processed, **Then** system clears cart, adds items, confirms order, sends email
6. **Given** customer types "3" after seeing action options (with credit notes), **When** processed, **Then** system sends credit notes email

**360-Degree Validation** _(mandatory for implementation)_:

- [ ] Frontend: N/A
- [ ] Backend API: Update `getOrderDetails` calling function response format
- [ ] Service Layer: Add action options to order detail response
- [ ] Repository: Include credit notes in order query
- [ ] Database: Verify Order model has invoiceUrl, creditNotes relation
- [ ] Security: Verify customer owns the order
- [ ] Testing: Unit test for order detail formatting with actions
- [ ] Documentation: Update agent function docs
- [ ] Concurrency: N/A
- [ ] Prompt Variables: N/A
- [ ] Code Cleanliness: N/A

---

### User Story 3 - Download Invoice via Email (Priority: P2)

As a customer, when I request to download the invoice for an order, I want to receive an email with the invoice PDF attached so I have the official document.

**Why this priority**: Important for business customers who need invoices for accounting, but secondary to the core order viewing flow.

**Independent Test**: Customer selects "Scarica fattura", receives confirmation message, and gets email with PDF attachment.

**Acceptance Scenarios**:

1. **Given** customer requests invoice download, **When** processed, **Then** system sends email to customer's registered email with invoice PDF attached
2. **Given** invoice PDF exists in storage, **When** email is sent, **Then** the actual PDF file is attached (not just a link)
3. **Given** invoice PDF does not exist for legacy order, **When** customer requests it, **Then** system responds "Fattura non ancora disponibile per questo ordine"
4. **Given** email is sent successfully, **When** completed, **Then** customer receives confirmation: "Ti abbiamo inviato la fattura per email! 📧"
5. **Given** order has credit notes, **When** customer requests them, **Then** credit note PDFs are also attached to the email

**Invoice Storage Requirement**:
- When an order is confirmed, system MUST generate and save a PDF invoice
- **Invoice file naming**: `{orderCode}_fattura.pdf` (e.g., `ORD-048-2025-9_fattura.pdf`)
- **Credit note naming**: `{orderCode}_notadicredito{N}.pdf` (e.g., `ORD-048-2025-9_notadicredito1.pdf`)
- Storage location: `storage/invoices/{workspaceId}/`
- Invoice must be linked to Order record via `invoiceUrl` field
- **For MVP**: Use a demo/placeholder PDF with correct naming convention

**360-Degree Validation** _(mandatory for implementation)_:

- [ ] Frontend: N/A
- [ ] Backend API: Add invoice email endpoint or calling function
- [ ] Service Layer: Create `InvoiceEmailService` with PDF attachment capability
- [ ] Repository: Query invoice URL from Order, fetch file from storage
- [ ] Database: Verify `invoiceUrl` field exists and is populated on order creation
- [ ] Security: Verify customer owns order before sending invoice
- [ ] Testing: Unit test for email generation, integration test for attachment
- [ ] Documentation: Document invoice storage structure
- [ ] Concurrency: N/A
- [ ] Prompt Variables: N/A
- [ ] Code Cleanliness: Use existing EmailService pattern

---

### User Story 4 - Agent Variable Replacement (Priority: P2)

As a customer, when I ask "chi è il mio agente?" I want to see my assigned sales agent's information so I can contact them directly.

**Why this priority**: Important for B2B customers with dedicated sales agents, but not blocking core functionality.

**Independent Test**: Customer asks "chi è il mio agente?", system responds with agent name, phone, and email (or "Non hai un agente assegnato" if none).

**Root Cause Analysis**:
- The variable `{{agentName}}` exists and is replaced correctly in prompts
- Issue: The intent "chi è il mio agente?" is being routed to REQUEST_HUMAN instead of a PROFILE or AGENT_INFO intent
- The LLM responds with generic "Non ci sono dati forniti" because it doesn't have agent context

**Acceptance Scenarios**:

1. **Given** customer has an assigned sales agent, **When** they ask "chi è il mio agente?", **Then** system responds with agent name, email, and phone
2. **Given** customer has NO assigned sales agent, **When** they ask "chi è il mio agente?", **Then** system responds "Non hai un agente dedicato. Per assistenza puoi contattarci a {adminEmail}"
3. **Given** workspace has `hasSalesAgents=false`, **When** customer asks about agent, **Then** system responds with workspace admin contact info instead
4. **Given** customer asks in different languages ("who is my agent?", "quem é meu agente?"), **When** processed, **Then** system understands the intent and responds appropriately

**360-Degree Validation** _(mandatory for implementation)_:

- [ ] Frontend: N/A
- [ ] Backend API: N/A
- [ ] Service Layer: Add SHOW_AGENT_INFO intent handling in DataLoader and ResponseBuilder
- [ ] Repository: Customer query already includes `sales` relation
- [ ] Database: Verify `salesId` field in Customer model
- [ ] Security: N/A (customer viewing own data)
- [ ] Testing: Unit test for agent info response, test with/without agent assigned
- [ ] Documentation: Document new intent type
- [ ] Concurrency: N/A
- [ ] Prompt Variables: `{{agentName}}`, `{{agentPhone}}`, `{{agentEmail}}` already exist
- [ ] Code Cleanliness: Add new intent type following existing patterns

---

### User Story 5 - Email Routing Based on Sales Team Flag (Priority: P2)

As a business owner, when a customer requests human support or an order confirmation email needs to be sent, the system should route to the customer's assigned agent (if `hasSalesAgents=true`) or to the admin email (if `hasSalesAgents=false`).

**Why this priority**: Operational requirement for proper email routing, secondary to customer-facing features.

**Independent Test**: Configure workspace with `hasSalesAgents=true`, assign agent to customer, trigger email → agent receives it. Then set `hasSalesAgents=false` → admin receives it.

**Acceptance Scenarios**:

1. **Given** workspace has `hasSalesAgents=true` AND customer has `salesId`, **When** email notification is triggered, **Then** email is sent to the assigned agent's email
2. **Given** workspace has `hasSalesAgents=true` BUT customer has NO `salesId`, **When** email notification is triggered, **Then** email is sent to workspace admin email
3. **Given** workspace has `hasSalesAgents=false`, **When** email notification is triggered, **Then** email is sent to workspace admin email (ignoring salesId)
4. **Given** order is confirmed, **When** confirmation email is sent, **Then** both customer AND appropriate agent/admin receive the email with invoice attached

**360-Degree Validation** _(mandatory for implementation)_:

- [ ] Frontend: N/A
- [ ] Backend API: N/A
- [ ] Service Layer: Update `contactOperator`, `confirmOrder` email logic to check `hasSalesAgents` flag
- [ ] Repository: Load workspace settings to check flag
- [ ] Database: Verify `hasSalesAgents` field in Workspace model
- [ ] Security: N/A
- [ ] Testing: Unit tests for email routing logic with different flag/salesId combinations
- [ ] Documentation: Document email routing rules
- [ ] Concurrency: N/A
- [ ] Prompt Variables: N/A
- [ ] Code Cleanliness: Centralize email routing logic to avoid duplication

---

### User Story 6 - Repeat Order Flow (Priority: P2)

As a customer, when I select "Ripeti ordine" after viewing order details, I want the system to automatically clear my cart, add all items from that order, confirm the order, and send me the confirmation email.

**Why this priority**: Important convenience feature that drives repeat purchases. Upgraded to P2.

**Independent Test**: Customer views order details, selects "Ripeti ordine", system clears cart, adds items, confirms order, sends confirmation email.

**Repeat Order Flow** (MUST be atomic):
1. Clear existing cart
2. Add all items from original order to cart
3. Confirm the new order automatically
4. Send confirmation email to customer
5. Send notification to agent/admin
6. Respond with new order code and confirmation

**Acceptance Scenarios**:

1. **Given** customer selects "Ripeti ordine", **When** processed, **Then** existing cart is cleared and all items from original order are added
2. **Given** cart is populated with repeated items, **When** processed, **Then** order is automatically confirmed (no manual confirmation needed)
3. **Given** order is confirmed, **When** completed, **Then** customer receives message with new order code
4. **Given** order is confirmed, **When** completed, **Then** confirmation email is sent to customer with invoice attached
5. **Given** some products from original order are no longer available, **When** repeating order, **Then** system responds: "❌ Mi dispiace, l'ordine non si può ripetere per mancanza di stock in questo momento. Vuoi vedere la lista dei prodotti?" with options

**360-Degree Validation** _(mandatory for implementation)_:

- [ ] Frontend: N/A
- [ ] Backend API: `repeatOrder` calling function (may already exist)
- [ ] Service Layer: Cart service to add multiple items
- [ ] Repository: Load original order items, check product availability
- [ ] Database: N/A
- [ ] Security: Verify customer owns original order
- [ ] Testing: Unit test for repeat order logic
- [ ] Documentation: Document repeatOrder function
- [ ] Concurrency: Use cart locking to prevent race conditions
- [ ] Prompt Variables: N/A
- [ ] Code Cleanliness: Reuse existing cart logic

---

### Edge Cases

- What happens when customer types "1" but there's no previous list? → Return friendly message asking what they need help with
- What happens when order has no invoice file? → Return "Fattura non ancora disponibile"
- What happens when customer's email is not set? → Cannot send invoice, suggest updating profile
- What happens when sales agent has no email? → Fall back to admin email
- What happens when workspace has no admin email? → Log error, don't send email, inform customer of issue

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: System MUST strip `#` prefix from order codes when resolving numeric selections
- **FR-002**: System MUST correctly identify `listType: "ORDERS"` for order lists and route selections to order details
- **FR-003**: System MUST display action options (download invoice, repeat order) after showing order details
- **FR-004**: System MUST send invoice PDF as email attachment when customer requests download
- **FR-005**: System MUST store invoice PDFs with naming convention `{orderCode}_fattura.pdf`
- **FR-006**: System MUST respond with agent info when customer asks "chi è il mio agente?" (or equivalent)
- **FR-007**: System MUST route emails to agent (if `hasSalesAgents=true` AND `salesId` exists) or admin (otherwise)
- **FR-008**: System MUST include credit note PDFs in email when order has credit notes
- **FR-009**: System MUST verify order ownership before showing details or sending invoice
- **FR-010**: System MUST handle missing invoice files gracefully with user-friendly message

### Key Entities

- **Order**: orderCode, status, totalAmount, invoiceUrl, items, creditNotes relation
- **Customer**: salesId (optional FK to User), email, phone
- **User** (Sales Agent): firstName, lastName, email, phone
- **Workspace**: hasSalesAgents (boolean), adminEmail
- **CreditNote**: Order relation, fileUrl

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: Customers can select orders by number with 100% accuracy (no "product not found" errors)
- **SC-002**: Order details display within 2 seconds of selection
- **SC-003**: Invoice emails are delivered within 30 seconds of request
- **SC-004**: Agent info requests return correct data in under 1 second
- **SC-005**: Email routing follows hasSalesAgents flag correctly 100% of the time
- **SC-006**: All existing order-related unit tests continue to pass
- **SC-007**: New unit tests achieve >90% coverage for new code paths

### Unit Tests Required _(mandatory)_

**Options Mapping Tests** (`options-mapping.service.spec.ts`):
- [ ] `cleanLabel` strips `#` prefix from order codes
- [ ] `cleanLabel` handles order codes without `#` prefix
- [ ] `cleanLabel` preserves other label formats (products, categories)
- [ ] Numeric selection "1" after ORDER list returns correct order code
- [ ] Numeric selection "1" after PRODUCT list returns correct product

**Data Loader Tests** (`data-loader.service.spec.ts`):
- [ ] `loadOrderStatus` receives order code without `#` prefix
- [ ] `loadOrderStatus` returns full order details with items
- [ ] `loadAgentInfo` returns agent details when customer has salesId
- [ ] `loadAgentInfo` returns null when customer has no salesId
- [ ] `loadAgentInfo` respects workspace `hasSalesAgents` flag

**Email Service Tests** (`email.service.spec.ts`):
- [ ] Invoice email includes PDF attachment
- [ ] Invoice PDF naming follows `{orderCode}_fattura.pdf` convention
- [ ] Credit note email includes multiple PDF attachments
- [ ] Credit note naming follows `{orderCode}_notadicredito{N}.pdf` convention
- [ ] Email routing to agent when `hasSalesAgents=true` AND `salesId` exists
- [ ] Email routing to admin when `hasSalesAgents=false`
- [ ] Email routing to admin when `hasSalesAgents=true` BUT no `salesId`

**Repeat Order Tests** (`repeat-order.spec.ts` or `calling-functions.spec.ts`):
- [ ] Repeat order clears existing cart
- [ ] Repeat order adds all items from original order
- [ ] Repeat order creates new order automatically
- [ ] Repeat order sends confirmation email
- [ ] Repeat order fails gracefully when products unavailable
- [ ] Repeat order is atomic (rollback on failure)

**Response Builder Tests** (`response-builder.service.spec.ts`):
- [ ] Order details include action options (fattura, ripeti, nota credito)
- [ ] Action options stored in lastOptionsContext
- [ ] Credit note option only shown when credit notes exist

## Assumptions

- Invoice PDF generation is out of scope for MVP - we'll use placeholder PDFs
- Customer email is required to receive invoice attachments
- Existing EmailService supports file attachments
- `repeatOrder` calling function already exists or will be created

## Implementation Notes

### ⚠️ REGOLE CRITICHE DI IMPLEMENTAZIONE

1. **NON MODIFICARE** la struttura esistente di ResponseBuilder senza necessità
2. **USARE** gli stessi pattern di formattazione già presenti (emoji, spaziatura, liste)
3. **TESTARE** che tutti i flussi esistenti continuino a funzionare:
   - Lista prodotti + selezione numerica
   - Lista categorie + selezione numerica  
   - Carrello + checkout
   - Ricerca prodotti
4. **STUDIARE** prima `response-builder.service.ts` per capire i pattern esistenti
5. **AGGIUNGERE** le nuove funzionalità senza rompere quelle esistenti

### Files to Modify

| Priority | File | Change |
|----------|------|--------|
| P1 | `apps/backend/src/application/chat-engine/options-mapping.service.ts` | Update `cleanLabel` to strip `#` prefix: `.replace(/^#/, '')` |
| P1 | `apps/backend/src/application/data-loader/data-loader.service.ts` | Verify order code handling in `loadOrderStatus` |
| P2 | `apps/backend/src/application/intent/intent.types.ts` | Add `SHOW_AGENT_INFO` intent type |
| P2 | `apps/backend/src/application/data-loader/data-loader.service.ts` | Add `loadAgentInfo` method |
| P2 | `apps/backend/src/application/response-builder/response-builder.service.ts` | Add agent info response builder |
| P2 | `apps/backend/src/services/email.service.ts` | Add invoice attachment capability |
| P2 | `apps/backend/src/domain/calling-functions/contactOperator.ts` | Update email routing logic |
| P2 | `apps/backend/src/domain/calling-functions/confirmOrder.ts` | Update email routing logic |

### Technical Debt Notes

- Invoice PDF generation on order confirmation is a future requirement (for now, use demo PDF)
- Consider moving email routing logic to a shared utility to avoid duplication
