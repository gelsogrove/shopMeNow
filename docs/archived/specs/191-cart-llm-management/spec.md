# Feature Specification: Cart LLM Management Refactor

**Feature Branch**: `191-cart-llm-management`  
**Created**: 2024-12-01  
**Status**: Draft  
**Input**: User description: "Refactor Cart Management Agent: rename AddToCart to AddItemToCart, add UpdateCart and RemoveFromCart functions, manage cart entirely via LLM with visual feedback instead of links. Remove frontend cart components."

## Executive Summary

Riorganizzazione completa del **Cart Management Agent** per gestire il carrello interamente via conversazione LLM. Il cliente interagisce con il chatbot WhatsApp in modo naturale e riceve sempre una visualizzazione testuale aggiornata del carrello dopo ogni operazione.

**Cambiamento chiave**: Eliminazione dei link esterni per visualizzare/gestire il carrello → tutto avviene inline nella chat.

## User Scenarios & Testing _(mandatory)_

### User Story 1 - View Cart via Chat (Priority: P1)

Il cliente chiede "mostrami il carrello" e riceve immediatamente una visualizzazione testuale formattata del carrello corrente.

**Esempio conversazione**:
```
Cliente: mostrami il carrello

Assistente:
🛒 Il tuo carrello:
- 1x Mozzarella di Bufala - 30,00€
- 2x Panettone Artigianale - 40,00€

💰 Totale: 70,00€
```

**Why this priority**: È la funzionalità base che permette al cliente di vedere cosa ha nel carrello senza link esterni.

**Independent Test**: Può essere testato chiamando `viewCart` e verificando il formato della risposta.

**Acceptance Scenarios**:

1. **Given** carrello vuoto, **When** cliente chiede "mostrami carrello", **Then** risponde "Il tuo carrello è vuoto"
2. **Given** carrello con 2 prodotti, **When** cliente chiede "cosa c'è nel carrello", **Then** mostra lista formattata con quantità, nomi, prezzi e totale
3. **Given** carrello con prodotti e servizi misti, **When** cliente chiede "vedi carrello", **Then** mostra entrambi i tipi con corretta formattazione

**360-Degree Validation** _(mandatory for implementation)_:

- [ ] Frontend: N/A (rimosso - tutto via chat)
- [ ] Backend API: Funzione `viewCart` già esistente, aggiornare formato risposta
- [ ] Service Layer: `CartManagementAgentLLM.executeFunction()` restituisce formato testuale
- [ ] Repository: `CartRepository.getCart()` già funzionante
- [ ] Database: Nessuna modifica
- [ ] Security: Workspace isolation già presente
- [ ] Testing: Unit test per formato risposta
- [ ] Documentation: Aggiornare docs/CART_FLOW.md
- [ ] Concurrency: Già gestita
- [ ] Prompt Variables: N/A
- [ ] Code Cleanliness: Rimuovere componenti frontend obsoleti

---

### User Story 2 - Add Item to Cart (Priority: P1)

Il cliente aggiunge prodotti al carrello e riceve conferma con visualizzazione aggiornata.

**Esempio conversazione**:
```
Cliente: aggiungi un panettone

Assistente:
✅ Aggiunto al carrello!

🛒 Il tuo carrello:
- 1x Mozzarella di Bufala - 30,00€
- 3x Panettone Artigianale - 60,00€

💰 Totale: 90,00€
```

**Why this priority**: Funzionalità core per costruire il carrello.

**Independent Test**: Chiamare `addItemToCart` e verificare che il carrello venga aggiornato e mostrato.

**Acceptance Scenarios**:

1. **Given** carrello vuoto, **When** cliente dice "aggiungi 2 mozzarelle", **Then** aggiunge 2 mozzarelle e mostra carrello
2. **Given** prodotto già nel carrello (2x), **When** cliente dice "aggiungi un altro", **Then** incrementa a 3x e mostra carrello aggiornato
3. **Given** prodotto non trovato, **When** cliente dice "aggiungi xyz", **Then** risponde con suggerimenti o ricerca prodotto

**360-Degree Validation** _(mandatory for implementation)_:

- [ ] Frontend: N/A (rimosso)
- [ ] Backend API: Rinominare `addToCart` → `addItemToCart` nelle function definitions
- [ ] Service Layer: Aggiornare switch case in `executeFunction`
- [ ] Repository: Nessuna modifica
- [ ] Database: Nessuna modifica
- [ ] Security: Workspace isolation già presente
- [ ] Testing: Unit test per add con risposta carrello
- [ ] Documentation: Aggiornare swagger e docs
- [ ] Concurrency: Transaction per update quantità
- [ ] Prompt Variables: N/A
- [ ] Code Cleanliness: Rinominare consistentemente ovunque

---

### User Story 3 - Update Cart Quantity (Priority: P1)

Il cliente modifica la quantità di un prodotto già nel carrello.

**Esempio conversazione**:
```
Cliente: metti 5 panettoni invece di 3

Assistente:
✅ Quantità aggiornata!

🛒 Il tuo carrello:
- 1x Mozzarella di Bufala - 30,00€
- 5x Panettone Artigianale - 100,00€

💰 Totale: 130,00€
```

**Why this priority**: Permette modifiche senza dover rimuovere e riaggiungere.

**Independent Test**: Chiamare `updateCartItem` e verificare che la quantità sia aggiornata.

**Acceptance Scenarios**:

1. **Given** 2x Panettone nel carrello, **When** cliente dice "voglio 5 panettoni", **Then** aggiorna a 5x
2. **Given** prodotto non nel carrello, **When** cliente dice "cambia quantità pizza", **Then** risponde che il prodotto non è nel carrello
3. **Given** quantità 0, **When** cliente dice "metti 0 mozzarelle", **Then** rimuove il prodotto dal carrello

**360-Degree Validation** _(mandatory for implementation)_:

- [ ] Frontend: N/A (rimosso)
- [ ] Backend API: Implementare `updateCartItem` function call
- [ ] Service Layer: Nuovo metodo in `CartManagementAgent.updateQuantity()`
- [ ] Repository: `CartRepository.updateItemQuantity()` già esiste
- [ ] Database: Nessuna modifica
- [ ] Security: Verificare che cartItem appartenga al customer
- [ ] Testing: Unit test per update quantità
- [ ] Documentation: Aggiungere a swagger
- [ ] Concurrency: Transaction per update
- [ ] Prompt Variables: N/A
- [ ] Code Cleanliness: N/A

---

### User Story 4 - Remove Item from Cart (Priority: P1)

Il cliente rimuove un prodotto specifico dal carrello.

**Esempio conversazione**:
```
Cliente: togli la mozzarella

Assistente:
✅ Rimosso dal carrello!

🛒 Il tuo carrello:
- 5x Panettone Artigianale - 100,00€

💰 Totale: 100,00€
```

**Why this priority**: Permette di rimuovere prodotti indesiderati.

**Independent Test**: Chiamare `removeFromCart` e verificare che il prodotto sia rimosso.

**Acceptance Scenarios**:

1. **Given** mozzarella nel carrello, **When** cliente dice "togli la mozzarella", **Then** rimuove e mostra carrello aggiornato
2. **Given** prodotto non nel carrello, **When** cliente dice "togli pizza", **Then** risponde che il prodotto non è nel carrello
3. **Given** ultimo prodotto nel carrello, **When** cliente rimuove, **Then** mostra "carrello vuoto"

**360-Degree Validation** _(mandatory for implementation)_:

- [ ] Frontend: N/A (rimosso)
- [ ] Backend API: `removeFromCart` function call già definita, completare implementazione
- [ ] Service Layer: `CartManagementAgent.removeFromCart()` già esiste
- [ ] Repository: `CartRepository.removeItem()` già esiste
- [ ] Database: Nessuna modifica
- [ ] Security: Verificare che cartItem appartenga al customer
- [ ] Testing: Unit test per remove
- [ ] Documentation: Aggiornare swagger
- [ ] Concurrency: N/A
- [ ] Prompt Variables: N/A
- [ ] Code Cleanliness: N/A

---

### User Story 5 - Clear Cart (Priority: P2)

Il cliente svuota completamente il carrello.

**Esempio conversazione**:
```
Cliente: svuota il carrello

Assistente:
✅ Carrello svuotato!

Il tuo carrello è ora vuoto.
```

**Why this priority**: Utile ma meno frequente delle altre operazioni.

**Independent Test**: Chiamare `clearCart` e verificare che il carrello sia vuoto.

**Acceptance Scenarios**:

1. **Given** carrello con prodotti, **When** cliente dice "svuota tutto", **Then** svuota e conferma
2. **Given** carrello già vuoto, **When** cliente dice "svuota carrello", **Then** risponde che è già vuoto

---

### User Story 6 - Remove Frontend Cart Components (Priority: P2)

Rimuovere i componenti frontend per la gestione del carrello dato che ora tutto avviene via chat.

**Why this priority**: Cleanup necessario ma non bloccante per le funzionalità core.

**Independent Test**: Verificare che il frontend compili senza errori dopo la rimozione.

**Acceptance Scenarios**:

1. **Given** componenti cart esistenti, **When** rimossi, **Then** frontend compila senza errori
2. **Given** riferimenti ai componenti, **When** rimossi, **Then** nessun import rotto

**360-Degree Validation** _(mandatory for implementation)_:

- [ ] Frontend: Rimuovere `CartIframePopup.tsx`, `CartItemAddSheet.tsx`, e relativi import
- [ ] Backend API: Mantenere API per compatibilità (deprecare se necessario)
- [ ] Service Layer: N/A
- [ ] Repository: N/A
- [ ] Database: N/A
- [ ] Security: N/A
- [ ] Testing: Verificare build frontend
- [ ] Documentation: Aggiornare docs indicando che cart è solo via chat
- [ ] Concurrency: N/A
- [ ] Prompt Variables: N/A
- [ ] Code Cleanliness: Rimuovere file non utilizzati

---

### Edge Cases

- **Prodotto ambiguo**: Se cliente dice "aggiungi mozzarella" e ci sono più tipi, chiedere chiarimento
- **Stock insufficiente**: Se quantità richiesta > stock disponibile, informare cliente
- **Prodotto non attivo**: Se prodotto è disabilitato, informare che non è disponibile
- **Carrello scaduto**: Se sessione carrello scade, creare nuovo carrello automaticamente
- **Concurrent updates**: Due richieste simultanee sullo stesso carrello → transaction lock

## Requirements _(mandatory)_

### Functional Requirements

- **FR-001**: Sistema DEVE rinominare function call `addToCart` → `addItemToCart`
- **FR-002**: Sistema DEVE implementare function call `updateCartItem` per modificare quantità
- **FR-003**: Sistema DEVE completare implementazione `removeFromCart` 
- **FR-004**: Sistema DEVE restituire sempre visualizzazione carrello dopo ogni operazione
- **FR-005**: Formato visualizzazione carrello DEVE essere:
  ```
  🛒 Il tuo carrello:
  - {quantity}x {productName} - {price}€
  ...
  💰 Totale: {total}€
  ```
- **FR-006**: Sistema DEVE gestire carrello vuoto con messaggio appropriato
- **FR-007**: Sistema DEVE rimuovere componenti frontend per cart (CartIframePopup, CartItemAddSheet)
- **FR-008**: Sistema DEVE aggiornare documentazione rimuovendo riferimenti a link carrello

### Non-Functional Requirements

- **NFR-001**: Ogni operazione carrello DEVE completarsi in < 2 secondi
- **NFR-002**: Visualizzazione carrello DEVE essere leggibile su WhatsApp (no HTML, solo emoji + testo)

### Key Entities

- **Cart**: Carrello cliente (workspaceId, customerId, items[], status)
- **CartItem**: Item nel carrello (productId/serviceId, quantity, notes, itemType)
- **Product/Service**: Prodotto o servizio da aggiungere

## Success Criteria _(mandatory)_

### Measurable Outcomes

- **SC-001**: 100% delle operazioni carrello avvengono inline nella chat (0 link esterni)
- **SC-002**: Ogni operazione mostra il carrello aggiornato entro 2 secondi
- **SC-003**: Cliente può aggiungere, modificare quantità, rimuovere prodotti usando linguaggio naturale
- **SC-004**: Componenti frontend cart rimossi, build frontend passa senza errori
- **SC-005**: Documentazione aggiornata riflette nuovo flusso

## Implementation Notes

### Files da Modificare (Backend)

1. `apps/backend/src/application/agents/CartManagementAgentLLM.ts`
   - Rinominare `addToCart` → `addItemToCart` in `getCartManagementFunctions()`
   - Implementare `updateCartItem` in `executeFunction()`
   - Completare `removeFromCart` in `executeFunction()`
   - Aggiungere formattazione carrello in risposta

2. `apps/backend/src/application/agents/CartManagementAgent.ts`
   - Verificare `updateQuantity()` funziona correttamente
   - Verificare `removeFromCart()` funziona correttamente

3. `apps/backend/src/services/function-executor.service.ts`
   - Rinominare case `addToCart` → `addItemToCart`

### Files da Rimuovere (Frontend)

1. `apps/frontend/src/components/CartIframePopup.tsx`
2. `apps/frontend/src/components/cart/CartItemAddSheet.tsx`
3. Eventuali import/riferimenti nei componenti parent

### Prompt da Aggiornare (Database)

1. `agentConfig` per `CART_MANAGEMENT` - aggiornare system prompt con nuove function names

## Assumptions

- Il cliente interagisce esclusivamente via WhatsApp (no web UI per cart)
- Le emoji sono supportate e visualizzate correttamente su WhatsApp
- Il formato prezzi usa virgola per decimali (es. "30,00€") per clienti italiani
- La traduzione finale viene gestita dal Router Agent

## Out of Scope

- Checkout/pagamento (gestito separatamente)
- Notifiche push carrello abbandonato
- Salvataggio carrello per sessioni future
- Wishlist/preferiti
