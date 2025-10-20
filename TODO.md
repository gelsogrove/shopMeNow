# 🚀 ShopME - Cleanup & Optimization TODO

**Branch:** 100-fatturazione  
**Date:** 20 Ottobre 2025  
**Status:** 🔄 In Progress

---

## 📋 INDICE

1. [Backend Security & Structure](#backend-security--structure)
2. [Backend Database Optimization](#backend-database-optimization)
3. [Backend Code Quality](#backend-code-quality)
4. [Frontend Security & Structure](#frontend-security--structure)
5. [Frontend Code Quality](#frontend-code-quality)
6. [Documentation](#documentation)
7. [Performance](#performance)
8. [Testing](#testing)
9. [TODO Futuri (Non Bloccanti)](#todo-futuri-non-bloccanti)

---

## � CLEANUP SHOPME - TODO ESECUTIVO

**OBIETTIVO**: Pulire, ottimizzare e rendere la soluzione una BOMBA! 💣
**STATO ATTUALE**: Tutto funziona, 143/163 test passano ✅  
**REGOLA D'ORO**: NON rompere nulla! Test unitari sempre verdi! 🟢

---

## ✅ FASE 1: QUICK WINS (2-3 ore) - READY TO START!

### ✅ Verifica Protezione Endpoint

- [ ] **Audit completo middleware di autenticazione**

  - Verificare che TUTTI gli endpoint protetti usino `authMiddleware`
  - Verificare che TUTTI gli endpoint workspace usino `workspaceValidationMiddleware`
  - Pattern corretto: `authMiddleware` → `workspaceValidationMiddleware` → controller
  - **File da verificare:** `backend/src/interfaces/http/routes/*.routes.ts`

- [ ] **Verifica isolamento workspace**

  - Grep tutti i query Prisma per assicurarsi che abbiano `where: { workspaceId }`
  - Verificare repositories per pattern corretti
  - **Comando:** `grep -r "prisma\." backend/src --include="*.ts" | grep -v "workspaceId"`

- [ ] **Audit chiamate pubbliche**
  - `/api/whatsapp/webhook` - verificare security (già fatto?)
  - `/api/orders-public` - verificare SecureToken validation
  - `/api/cart-public` - verificare SecureToken validation
  - Verificare rate limiting su endpoint pubblici

### ✅ Controllo Duplicazioni Codice

- [ ] **Analisi Controllers**

  - `cart.controller.ts` (1400+ righe) - spezzare in sottoclassi logiche
  - Verificare metodi duplicati tra controllers
  - Pattern comune: validation → business logic → response

- [ ] **Analisi Services**
  - `llm.service.ts` - verificare se metodi possono essere estratti
  - `calling-functions.service.ts` - verificare mapping functions
  - Identificare logica ripetuta tra services

### ✅ File Troppo Grandi

- [ ] **Cart Controller (1400+ righe)**

  - Spezzare in:
    - `cart.controller.ts` - operazioni base (get, add, remove)
    - `cart-checkout.controller.ts` - logica checkout
    - `cart-sync.controller.ts` - sincronizzazione
  - Mantenere backward compatibility

- [ ] **LLM Service (~1000+ righe stimato)**
  - Valutare split in:
    - `llm.service.ts` - core LLM logic
    - `llm-function-handler.service.ts` - function calling
    - `llm-prompt.service.ts` - prompt management

---

## 🗄️ BACKEND DATABASE OPTIMIZATION

### ✅ Pulizia Schema

- [ ] **Identificare campi non usati**

  - Analizzare ogni model nel schema.prisma
  - Cercare campi che non appaiono nel codebase
  - **Campi sospetti identificati:**
    - `Workspace.challengeStatus` - verificare utilizzo
    - `Workspace.apiKey` / `apiSecret` - duplicato con whatsappApiKey?
    - `Workspace.metadata` - verificare se usato
    - `Products.ProductCode` - naming inconsistente (camelCase)
    - `Products.sku` - verificare se usato vs ProductCode
    - `Message.functionCallsDebug` - sembra temporaneo
    - `Message.debugInfo` - duplicato con functionCallsDebug?

- [ ] **Tabelle candidate alla rimozione**
  - `RegistrationToken` - verificare se ancora usata
  - `OtpToken` - verificare autenticazione 2FA implementata
  - `Language` vs `Languages` - duplicato? Verificare

### ✅ Indici Database

- [ ] **Audit indici esistenti**

  - Verificare coverage indici su query frequenti
  - **Indici da aggiungere (candidati):**

    ```sql
    -- Customers: query per phone molto frequenti
    CREATE INDEX idx_customers_phone_workspace ON customers(phone, workspaceId);

    -- Orders: query per status e data
    CREATE INDEX idx_orders_status_date ON orders(status, createdAt);

    -- CartItems: cleanup orphaned items
    CREATE INDEX idx_cart_items_cart_id ON cart_items(cartId);

    -- Messages: query per chat e data
    CREATE INDEX idx_messages_chat_created ON messages(chatSessionId, createdAt);

    -- Billing: report e analytics
    CREATE INDEX idx_billing_workspace_type_date ON billing(workspaceId, type, createdAt);
    ```

- [ ] **Rimuovere indici non necessari**
  - Analizzare query plan per indici non utilizzati
  - Verificare indici duplicati

### ✅ Migration Consolidation

- [ ] **Consolidare migrations**
  - **ATTENZIONE:** Fare solo se siamo sicuri non serve history
  - Opzione 1: Squash migrations in una singola initial
  - Opzione 2: Mantenere history ma documentare meglio
  - **Raccomandazione Andrea:** Valutare insieme

---

## 🧹 BACKEND CODE QUALITY

### ✅ Rimozione Console.log

- [ ] **Backend - Sostituire console.log con logger**
  - **File identificati (50+ occorrenze):**
    - `json-fix.middleware.ts` - 11 console.log (debug temporaneo?)
    - `cart.controller.ts` - 13 console.warn
    - `customers.controller.ts` - 13 console.log (debug salesId)
    - `llm.service.ts` - 10+ console.log
    - `auth.routes.ts` - rate limit logging
  - **Azione:** Sostituire con `logger.debug()`, `logger.warn()`, `logger.error()`
  - **Mantenere:** Solo logger strutturato

### ✅ Metodi Non Usati

- [ ] **Identificare metodi morti**
  - Cercare metodi esportati ma non importati
  - Tools: `ts-prune` o analisi manuale
  - **Processo:**
    1. `npm install -D ts-prune` (temporaneo)
    2. Eseguire analisi
    3. Verificare risultati manualmente
    4. Rimuovere codice morto

### ✅ Cleanup Script Inutili

- [ ] **Scripts da valutare:**

  - `check-billing.js` - verificare se ancora serve
  - `create-placeholder-images.sh` - temporaneo?
  - `start-mcp-server.sh` - usato?
  - `update-welcome-messages.ts` - migration script? (probabilmente OK rimuovere dopo run)

- [ ] **Package.json - comandi non usati**
  - Backend:
    - `mcp:test` - verificare se usato
    - `lint` - disabilitato, rimuovere?
    - `format:check` - usato in CI?
  - Frontend:
    - `lint` - disabilitato, rimuovere?
    - `start:mcp` - usato?

### ✅ Backup & Temp Files

- [ ] **Cleanup directory temporanee**
  - `backend/prisma/data-backup-2025-10-20/` - **NON TOCCARE (recente)**
  - `backend/prisma/uploads-backup/` - verificare età, eventualmente archiviare
  - `backend/logs/` - implementare rotazione automatica
  - **File PDF:** `backend/prisma/temp/international-transportation-law.pdf` - **NON TOCCARE MAI**

---

## 🎨 FRONTEND SECURITY & STRUCTURE

### ✅ Sicurezza Chiamate API

- [ ] **Audit token management**

  - Verificare che tutte le chiamate API includano token
  - Pattern: `services/api.ts` centralizzato con interceptors
  - Verificare gestione token expiry e refresh

- [ ] **Input Sanitization**

  - Verificare uso di `DOMPurify` su input utente
  - Markdown rendering con `rehype-sanitize` - già implementato?
  - Verificare form validation con `zod` o `joi`

- [ ] **Protezione Route**
  - Verificare `ProtectedRoute` component su tutte le route admin
  - Verificare redirect su token mancante/invalido

### ✅ Chiamate Duplicate

- [ ] **Analisi API calls**

  - Cercare `useEffect` che chiamano stessi endpoint
  - Pattern sospetto: doppia chiamata su mount
  - **File identificati:**
    - `ChatPage.tsx` - multipli useEffect, verificare necessità
    - `ClientsPage.tsx` - doppia inizializzazione client?
    - `ProductsPage.tsx` - doppia chiamata prodotti?

- [ ] **React Query optimization**
  - Verificare uso di `@tanstack/react-query` per caching
  - Aggiungere `staleTime` e `cacheTime` appropriati
  - Evitare re-fetch inutili

### ✅ Componenti Riutilizzabili

- [ ] **Audit duplicazioni UI**

  - Cercare pattern ripetuti (form fields, modals, tables)
  - Componenti candidati per estrazione:
    - Form field wrappers (label + input + error)
    - Data tables con pagination
    - Modal dialogs con conferma
    - Toast notifications wrapper

- [ ] **Verifica shadcn/ui usage**
  - Tutti i componenti usano shadcn dove possibile?
  - Custom components documentati?

---

## 🧹 FRONTEND CODE QUALITY

### ✅ Rimozione Console.log

- [ ] **Frontend - Rimuovere console.log**
  - **File identificati (50+ occorrenze):**
    - `ChatPage.tsx` - 18 console.log (debug session storage)
    - `ClientsPage.tsx` - 12 console.log (debug session storage)
    - `ProductsPage.tsx` - 7 console.log
    - `WorkspaceSelectionPage.tsx` - 7 console.log
    - Analytics components - vari console.log
  - **Azione:** Rimuovere tutti o sostituire con dev-only logger
  - **Pattern suggerito:**
    ```typescript
    const isDev = import.meta.env.DEV
    if (isDev) console.log(...)
    ```

### ✅ Formattazione Codice

- [ ] **Prettier consistency**
  - Eseguire `npm run format` su tutto frontend
  - Verificare `.prettierrc` configurato
  - Commit formatting changes separatamente

### ✅ File Troppo Lunghi

- [ ] **ChatPage.tsx (800+ righe stimato)**

  - Spezzare in:
    - `ChatPage.tsx` - layout principale
    - `ChatSidebar.tsx` - lista chat
    - `ChatMessages.tsx` - area messaggi
    - `ChatInput.tsx` - input form
    - `useChatState.ts` - custom hook per state management

- [ ] **ClientsPage.tsx (simile)**
  - Applicare stesso pattern di split

### ✅ SessionStorage Management

- [ ] **Centralizzare storage logic**
  - Creare `utils/storage.ts` con typed helpers:
    ```typescript
    export const storage = {
      getSelectedChat: () => sessionStorage.getItem("selectedChatId"),
      setSelectedChat: (id: string) =>
        sessionStorage.setItem("selectedChatId", id),
      // ... altri metodi
    }
    ```
  - Sostituire tutti i `sessionStorage.getItem` sparsi

### ✅ Gestione Prezzi

- [ ] **Audit prezzi centralizzati**

  - Verificare che tutti i prezzi vengano da backend
  - Pattern: NO hardcoded prices nel frontend
  - Verificare formatPrice utility usage
  - **File da controllare:**
    - Components che mostrano prezzi prodotti
    - Cart components
    - Order summary components

- [ ] **Pricing configuration**
  - Verificare che pricing config sia in un solo punto backend
  - Pattern: workspace settings o pricing table
  - Frontend deve solo formattare, non calcolare

---

## 📚 DOCUMENTATION

### ✅ README.md Root

- [ ] **Aggiornare README.md principale**
  - Verificare sezioni complete:
    - ✅ Installation
    - ✅ Quick Start
    - ❓ API Documentation (link a Swagger?)
    - ❓ Architecture Deep Dive
    - ❓ Deployment Guide
    - ❓ Troubleshooting Common Issues
  - Aggiungere sezione Billing/Pricing

### ✅ Documentazione Codice

- [ ] **JSDoc/TSDoc coverage**
  - Controllers: aggiungere @swagger tags mancanti
  - Services: documentare metodi pubblici
  - Utils: documentare parametri e return types
  - **Priorità:** Metodi pubblici API-facing

### ✅ Memory Bank Organization

- [ ] **Docs/memory-bank structure**
  - ✅ Già ben organizzato in sottocartelle
  - Verificare aggiornamento file dopo cleanup:
    - `03-ARCHITECTURE/` - aggiornare dopo split controllers
    - `04-BEST-PRACTICES/` - aggiungere pricing patterns
    - `06-REPORTS/` - aggiungere cleanup report finale

---

## ⚡ PERFORMANCE

### ✅ Backend Performance

- [ ] **Database Query Optimization**

  - Analizzare slow queries con `EXPLAIN ANALYZE`
  - Aggiungere indici identificati sopra
  - Verificare N+1 queries (Prisma includes)
  - **Tools:** Prisma Studio, query logging

- [ ] **LLM Response Time**

  - Verificare timeout configurati appropriatamente
  - Implementare caching risposte comuni (se non già fatto)
  - Monitorare OpenRouter latency

- [ ] **API Response Time**
  - Aggiungere timing middleware
  - Identificare endpoint lenti
  - Ottimizzare serialization (JSON.stringify)

### ✅ Frontend Performance

- [ ] **Bundle Size Analysis**

  - Eseguire `npm run build` e analizzare output
  - Tool: `vite-bundle-visualizer`
  - Identificare dependencies pesanti
  - Lazy loading per route non critiche

- [ ] **React Performance**

  - Audit componenti con React DevTools Profiler
  - Verificare memoization (`useMemo`, `useCallback`)
  - Verificare re-render inutili
  - **Candidati:** ChatPage, ProductsPage (liste grandi)

- [ ] **Image Optimization**
  - Verificare formato immagini (WebP?)
  - Lazy loading immagini prodotti
  - Placeholder durante caricamento

---

## 🧪 TESTING

### ✅ Test Coverage

- [ ] **Backend Unit Tests**

  - Eseguire `npm run test:coverage`
  - Target: >80% coverage su services critici
  - **Priorità:**
    - LLMService
    - CallingFunctionsService
    - SecureTokenService
    - Pricing/Billing logic

- [ ] **Backend Integration Tests**

  - Verificare test esistenti funzionanti
  - Aggiungere test mancanti:
    - Workspace isolation
    - SecureToken flow completo
    - Order creation end-to-end

- [ ] **Frontend Tests**
  - Setup Vitest (già fatto?)
  - Test componenti critici:
    - Cart logic
    - Checkout flow
    - Authentication flow

### ✅ Test Dopo Cleanup

- [ ] **Smoke Tests**

  - ✅ Backend server starts
  - ✅ Frontend builds
  - ✅ Login flow
  - ✅ Create product
  - ✅ Create order
  - ✅ WhatsApp webhook
  - ✅ LLM response

- [ ] **Regression Tests**
  - Eseguire TUTTI i test unitari: `npm run test:unit`
  - Eseguire security tests: `npm run test:security`
  - **CRITICO:** Non procedere se test falliscono

---

## 🔮 TODO FUTURI (Non Bloccanti)

### Miglioramenti Architetturali

- [ ] **Implementare CQRS pattern** (opzionale)

  - Separare read/write models dove ha senso
  - Es: Analytics queries vs transactional writes

- [ ] **Event Sourcing per Orders** (opzionale)

  - Tracciare tutti gli eventi di un ordine
  - Rebuild state da eventi

- [ ] **GraphQL API** (opzionale)
  - Alternativa REST per frontend
  - Ridurre over-fetching

### Monitoring & Observability

- [ ] **APM Integration**

  - New Relic, Datadog, o Sentry
  - Track performance metrics
  - Error tracking automatico

- [ ] **Structured Logging**

  - Winston già usato - verificare formato JSON
  - Centralized logging (ELK stack?)
  - Log aggregation

- [ ] **Health Check Endpoints**
  - `/health` - basic health
  - `/health/db` - database connectivity (non lo voglio cancella)
  - `/health/llm` - OpenRouter connectivity (non lo volgio cancella)

### Scalabilità

- [ ] **Redis Caching Layer**

  - Cache customer data
  - Cache product catalog
  - Session storage

- [ ] **Queue System**

  - Bull/BullMQ per background jobs
  - Campaign sending
  - Bulk operations

- [ ] **Rate Limiting Avanzato**
  - Per workspace
  - Per customer
  - Sliding window algorithm

### Sicurezza Avanzata

- [ ] **Audit Logging**

  - Track admin actions
  - Track data modifications
  - Compliance GDPR

- [ ] **Secrets Management**

  - Vault per API keys
  - Rotation automatica secrets
  - Environment-specific encryption

- [ ] **Penetration Testing**
  - Security audit esterno
  - OWASP Top 10 compliance
  - SQL Injection, XSS, CSRF tests

### UX Improvements

- [ ] **Offline Support**

  - Service Worker
  - IndexedDB per dati locali
  - Sync queue

- [ ] **Real-time Updates**

  - WebSocket già implementato - ottimizzare
  - Push notifications browser
  - Live order tracking

- [ ] **Mobile App**
  - React Native
  - Shared business logic
  - Native push notifications

### Test Unitari da Aggiungere

- [ ] **Pricing Logic Tests**

  - Test calcolo prezzi con sconti
  - Test pricing per workspace
  - Test currency conversion

- [ ] **Workspace Isolation Tests**

  - Test cross-workspace data leak prevention
  - Test middleware chain
  - Test token validation

- [ ] **LLM Function Calling Tests**

  - Test tutti i function handlers
  - Test error handling
  - Test prompt replacement

- [ ] **Billing Logic Tests**
  - Test calcolo costi
  - Test billing types
  - Test accumulation logic

---

## 📊 TRACKING PROGRESS

### Metriche Prima del Cleanup

```
Backend:
- Console.log: 50+ occorrenze
- Controllers >1000 righe: 1 (cart.controller.ts)
- Services >800 righe: 1+ (llm.service.ts)
- Test coverage: ??% (da misurare)
- Migrations: ~20+ files

Frontend:
- Console.log: 50+ occorrenze
- Pages >600 righe: 2-3 (ChatPage, ClientsPage)
- Bundle size: ??MB (da misurare)
- Test coverage: ??% (da misurare)

Database:
- Tabelle: 30+
- Indici: da auditare
- Campi non usati: da identificare
```

### Metriche Target Post-Cleanup

```
Backend:
- Console.log: 0 (solo logger)
- Controllers >1000 righe: 0
- Test coverage: >80% su services critici
- Migrations: consolidated (opzionale)

Frontend:
- Console.log: 0 (o solo dev mode)
- Pages >600 righe: 0
- Bundle size: <1MB (gzipped)
- Test coverage: >70%

Database:
- Campi non usati: 0
- Indici: ottimizzati per query frequenti
- Performance: <100ms per query critiche
```

---

## 🚨 REGOLE CRITICHE (da copilot-instructions.md)

**SEMPRE RISPETTARE:**

1. ✅ **Database-First:** NO hardcoded values, tutto da DB
2. ✅ **Workspace Isolation:** SEMPRE filtrare per workspaceId
3. ✅ **NO .env changes** senza backup: `cp .env .env.backup.$(date +%Y%m%d_%H%M%S)`
4. ✅ **PDF Protection:** NON toccare `international-transportation-law.pdf`
5. ✅ **Test Before Done:** Verificare funzionamento dopo ogni change
6. ✅ **NO git push:** Andrea fa manualmente
7. ✅ **Logger only:** NO console.log in produzione

---

## 📝 NOTE PROCESSO

**Ordine di Esecuzione Consigliato:**

1. **Phase 1: Analisi & Metriche** (Non-invasive)

   - Misurare coverage
   - Identificare codice morto
   - Analizzare bundle size
   - Audit database queries

2. **Phase 2: Cleanup Safe** (Low-risk)

   - Rimuovere console.log
   - Formattare codice
   - Rimuovere script temporanei
   - Cleanup backup vecchi

3. **Phase 3: Refactoring** (Medium-risk)

   - Split file grandi
   - Estrarre metodi duplicati
   - Centralizzare storage logic
   - Ottimizzare componenti

4. **Phase 4: Database** (High-risk)

   - Aggiungere indici (safe)
   - Rimuovere campi non usati (ATTENZIONE)
   - Consolidare migrations (OPZIONALE)

5. **Phase 5: Testing & Validation**
   - Eseguire tutti i test
   - Smoke testing manuale
   - Performance benchmarks
   - Update documentazione

**Dopo ogni phase:** ✅ Commit + Test + Verifica funzionamento

---

**Andrea, vuoi che inizi con Phase 1 (Analisi) o preferisci che mi concentri su un'area specifica? 🚀**

✅ Endpoint PUBBLICI (Intenzionali - CORRETTI)
Questi endpoint sono volutamente non protetti per ragioni funzionali:

POST /api/whatsapp/webhook - Webhook WhatsApp (rate-limited 10 req/min)
GET /api/whatsapp/webhook - Verifica webhook WhatsApp
POST /api/chat - Compatibilità WhatsApp (forward al webhook)
POST /api/cart-tokens - Generazione token carrello per supporto
GET /api/cart-tokens/:token/validate - Validazione token carrello
GET /api/health - Health check sistema
GET /api/gdpr/default - ⚠️ PROTETTO con authMiddleware (OK)
GET /api/workspaces/:workspaceId/agent-test - ✅ PROTETTO con authMiddleware + workspaceValidationMiddleware
