# 🚧 Task Rimanenti - eChatbot Development (66 Task)

## 📋 Panoramica

**Totale task**: 66  
**Completamento progetto**: 85%  
**Tempo stimato**: 9-12 settimane

---

## 🔴 CRITICAL PRIORITY (12 task)

### Task 1: Unificare Billing Legacy vs Owner-Based
**File**: `apps/backend/src/application/services/subscription-billing.service.ts`  
**Stima**: 8-10 ore  
**Descrizione**: Rimuovere `BillingService` legacy e usare solo `SubscriptionBillingService`  
**Output**: Transaction History coerente, un solo sistema

### Task 2: Allineare Soglie Credito FE/BE
**File**: `apps/frontend/src/components/billing/BillingSection.tsx`  
**Stima**: 4-6 ore  
**Descrizione**: Esporre soglie da backend, usarle nel FE  
**Output**: UI coerente con blocchi reali

### Task 3: Audit Limiti Piano su Tutte Route
**File**: `apps/backend/src/interfaces/http/middlewares/billing.middleware.ts`  
**Stima**: 6-8 ore  
**Descrizione**: Verificare e aggiungere `checkPlanLimits` ovunque  
**Output**: Impossibile creare risorse oltre limite

### Task 13: Verifica Isolamento ID Totali Mensili
**File**: `apps/backend/src/services/scheduler.service.ts`  
**Stima**: 6-8 ore  
**Descrizione**: Nessun mix tra owner/workspace nei totali (test dedicato)  
**Output**: Totali corretti

### Task 14: Endpoint Admin per subscriptionStatus
**File**: `apps/backend/src/routes/admin.routes.ts`  
**Stima**: 6-8 ore  
**Descrizione**: API + UI backoffice per gestione manuale  
**Output**: Gestione pagamento fallito da backoffice

### Task 35: Public Token API
**File**: `apps/backend/src/routes/public-token.routes.ts`  
**Stima**: 3-4 giorni  
**Descrizione**: Generazione token pubblici sicuri  
**Output**: Token temporanei con scadenza

### Task 36: Widget Configuration API
**File**: `apps/backend/src/routes/widget-config.routes.ts`  
**Stima**: 2-3 giorni  
**Descrizione**: API configurazione widget  
**Output**: CRUD configurazione widget

### Task 39: Rate Limiting
**File**: `apps/backend/src/middlewares/rate-limit.middleware.ts`  
**Stima**: 2-3 giorni  
**Descrizione**: Sistema rate limiting per API  
**Output**: Protezione da abuso

### Task 47: Context Memory
**File**: `apps/backend/src/services/context-memory.service.ts`  
**Stima**: 4-5 giorni  
**Descrizione**: Memoria conversazionale per chatbot  
**Output**: Persistent conversation context

### Task 48: Intent Classification
**File**: `apps/backend/src/agents/intent-classifier.agent.ts`  
**Stima**: 3-4 giorni  
**Descrizione**: Classificazione intenti avanzata  
**Output**: Advanced intent recognition

### Task 51: Conversation Routing
**File**: `apps/backend/src/services/conversation-routing.service.ts`  
**Stima**: 4-5 giorni  
**Descrizione**: Routing conversazioni a operatori  
**Output**: Intelligent routing

### Task 55: CSRF Protection
**File**: `apps/backend/src/middlewares/csrf.middleware.ts`  
**Stima**: 2-3 giorni  
**Descrizione**: Protezione CSRF  
**Output**: CSRF token generation

### Task 56: Input Sanitization
**File**: `apps/backend/src/middlewares/sanitization.middleware.ts`  
**Stima**: 2-3 giorni  
**Descrizione**: Sanitizzazione input avanzata  
**Output**: XSS/SQL injection prevention

---

## 🟠 HIGH PRIORITY (15 task)

### Task 4: Backoffice - Sessione Incassi Mensili
**File**: `apps/backoffice/src/pages/BillingPage.tsx`  
**Stima**: 8-10 ore  
**Descrizione**: Vista admin per importo da prelevare, stato transazione, note  
**Output**: Dashboard per controllo incassi

### Task 5: Integrazione Fatture Mensili + Note Credito
**File**: `apps/backend/src/services/invoice.service.ts`  
**Stima**: 12-15 ore  
**Descrizione**: Generazione automatica fattura, IVA 22%, note credito, logo  
**Output**: Fattura scaricabile e coerente

### Task 6: Flow Cancellazione + Retention
**File**: `apps/backend/src/services/cancellation.service.ts`  
**Stima**: 8-10 ore  
**Descrizione**: Addebito finale, stop servizi, retention 3 mesi  
**Output**: Cancellazione corretta e verificabile

### Task 15: Scheduler - Addebiti e Fatture Post-Pagamento
**File**: `apps/scheduler/src/jobs/billing.job.ts`  
**Stima**: 8-10 ore  
**Descrizione**: Ciclo mensile automatico (addebito → pagamento → fattura)  
**Output**: Ciclo mensile stabile

### Task 16: Aumento Coverage Test Billing
**File**: `apps/backend/__tests__/unit/billing.test.ts`  
**Stima**: 10-12 ore  
**Descrizione**: Coverage alto su billing, fatture, limiti, cancellazioni  
**Output**: Riduzione rischio regressioni

### Task 20: Completare WidgetSettingsPage.tsx
**File**: `apps/frontend/src/pages/WidgetSettingsPage.tsx`  
**Stima**: 2-3 giorni  
**Descrizione**: Configurazione widget chat, anteprima live, codice embed  
**Output**: Widget settings completo

### Task 21: PublicOrderPage.tsx
**File**: `apps/frontend/src/pages/PublicOrderPage.tsx`  
**Stima**: 3-4 giorni  
**Descrizione**: Visualizzazione ordini pubblici con token  
**Output**: Pagina ordini pubblica

### Task 22: PublicProfilePage.tsx
**File**: `apps/frontend/src/pages/PublicProfilePage.tsx`  
**Stima**: 3-4 giorni  
**Descrizione**: Profilo cliente pubblico con token  
**Output**: Pagina profilo pubblica

### Task 23: PublicCheckoutPage.tsx
**File**: `apps/frontend/src/pages/PublicCheckoutPage.tsx`  
**Stima**: 4-5 giorni  
**Descrizione**: Checkout pubblico con token  
**Output**: Pagina checkout pubblica

### Task 24: WidgetPreview Component
**File**: `apps/frontend/src/components/WidgetPreview.tsx`  
**Stima**: 2-3 giorni  
**Descrizione**: Anteprima live widget chat  
**Output**: Preview real-time

### Task 61: Unit Tests Suite
**File**: `apps/backend/__tests__/unit/`  
**Stima**: 5-6 giorni  
**Descrizione**: Suite test unitari completa  
**Output**: Coverage >90%

---

## 🟡 MEDIUM PRIORITY (27 task)

### Task 7: Policy Proration Upgrade/Downgrade
**Stima**: 6-8 ore  
**Descrizione**: Regole pro-rata, eventi in history, fattura corretta

### Task 8: Ricariche Credito - Fattura o Ricevuta
**Stima**: 4-6 ore  
**Descrizione**: Decidere formato e implementare coerentemente

### Task 9: Priorità Blocco Stati
**Stima**: 4-6 ore  
**Descrizione**: DISABLED vs PAYMENT_FAILED vs PAUSED

### Task 10: Soft Delete Canali + Limiti + Queue
**Stima**: 6-8 ore  
**Descrizione**: Canali in trash non conteggiati né operativi

### Task 11: Safety Check Prima Invio Queue
**Stima**: 4-6 ore  
**Descrizione**: Blocchi applicati anche ai messaggi in coda

### Task 12: Breakdown Transazioni per Canale
**Stima**: 4-6 ore  
**Descrizione**: Visibility chiara in backoffice

### Task 17: FAQ Seed per Billing/Plan/Pagamenti
**Stima**: 4-6 ore  
**Descrizione**: FAQ su cancellazione, pagamenti, ricariche, soglie

### Task 18: Limiti Team Members - Sincronizzazione FE/BE
**Stima**: 4-6 ore  
**Descrizione**: FE deve usare conteggio membri + inviti pendenti

### Task 25: OrderTrackingWidget
**Stima**: 3-4 giorni  
**Descrizione**: Widget tracking ordini embedded

### Task 26: ChatWidget Component
**Stima**: 5-6 giorni  
**Descrizione**: Widget chat principale per siti esterni

### Task 27: ProductCatalogWidget
**Stima**: 4-5 giorni  
**Descrizione**: Widget catalogo prodotti embedded

### Task 28: NotificationCenter
**Stima**: 3-4 giorni  
**Descrizione**: Centro notifiche in-app

### Task 29: BulkActionsToolbar
**Stima**: 2-3 giorni  
**Descrizione**: Azioni bulk su ordini/clienti

### Task 30: DataExportModal
**Stima**: 3-4 giorni  
**Descrizione**: Export dati CSV/Excel

### Task 31: AdvancedFilters Component
**Stima**: 4-5 giorni  
**Descrizione**: Filtri avanzati per tabelle

### Task 32: RealTimeUpdates
**Stima**: 3-4 giorni  
**Descrizione**: Aggiornamenti WebSocket

### Task 37: Webhook System
**Stima**: 4-5 giorni  
**Descrizione**: Sistema webhook per eventi

### Task 38: Bulk Operations API
**Stima**: 3-4 giorni  
**Descrizione**: API operazioni bulk

### Task 40: Data Export Service
**Stima**: 3-4 giorni  
**Descrizione**: Servizio export dati

### Task 41: WebSocket Server
**Stima**: 4-5 giorni  
**Descrizione**: Server real-time

### Task 42: Notification Service
**Stima**: 3-4 giorni  
**Descrizione**: Servizio notifiche push

### Task 43: Audit Log System
**Stima**: 3-4 giorni  
**Descrizione**: Sistema log audit

### Task 49: Sentiment Analysis
**Stima**: 3-4 giorni  
**Descrizione**: Analisi sentiment messaggi

### Task 50: Auto-Response System
**Stima**: 3-4 giorni  
**Descrizione**: Risposte automatiche

### Task 52: Knowledge Base Integration
**Stima**: 4-5 giorni  
**Descrizione**: Integrazione KB

### Task 53: Multi-turn Conversations
**Stima**: 3-4 giorni  
**Descrizione**: Conversazioni multi-turno

### Task 54: Conversation Analytics
**Stima**: 3-4 giorni  
**Descrizione**: Analytics conversazioni

### Task 57: API Versioning
**Stima**: 3-4 giorni  
**Descrizione**: Versionamento API

### Task 58: Database Optimization
**Stima**: 4-5 giorni  
**Descrizione**: Ottimizzazione query

### Task 59: Caching Strategy
**Stima**: 3-4 giorni  
**Descrizione**: Strategia caching Redis

### Task 60: Security Headers
**Stima**: 2-3 giorni  
**Descrizione**: Headers sicurezza HTTP

### Task 62: Integration Tests
**Stima**: 4-5 giorni  
**Descrizione**: Test integrazione API

### Task 63: E2E Tests
**Stima**: 5-6 giorni  
**Descrizione**: Test end-to-end Cypress

### Task 64: API Documentation
**Stima**: 3-4 giorni  
**Descrizione**: Documentazione Swagger

---

## 🟢 LOW PRIORITY (12 task)

### Task 19: Gestione Owner Senza Workspace
**Stima**: 3-4 ore  
**Descrizione**: Definire comportamento di errore

### Task 33: MobileResponsiveLayout
**Stima**: 4-5 giorni  
**Descrizione**: Layout mobile ottimizzato

### Task 34: AccessibilityFeatures
**Stima**: 3-4 giorni  
**Descrizione**: ARIA + keyboard navigation

### Task 44: Backup & Restore API
**Stima**: 4-5 giorni  
**Descrizione**: API backup/restore

### Task 45: Health Check System
**Stima**: 2-3 giorni  
**Descrizione**: Sistema health check

### Task 46: Performance Monitoring
**Stima**: 3-4 giorni  
**Descrizione**: Monitoring performance API

### Task 65: Docker Configuration
**Stima**: 3-4 giorni  
**Descrizione**: Config Docker production

### Task 66: CI/CD Pipeline
**Stima**: 4-5 giorni  
**Descrizione**: Pipeline GitHub Actions

---

## 📊 Statistiche

### Per Priorità
```
🔴 CRITICAL:  12 task (18%)
🟠 HIGH:      15 task (23%)
🟡 MEDIUM:    27 task (41%)
🟢 LOW:       12 task (18%)
─────────────────────────
TOTALE:       66 task (100%)
```

### Effort Totale
```
🔴 CRITICAL:  ~100 ore
🟠 HIGH:      ~120 ore
🟡 MEDIUM:    ~150 ore
🟢 LOW:       ~80 ore
─────────────────────────
TOTALE:      ~450 ore (~56 giorni lavorativi)
```

---

*Documentazione task aggiornata il: 2025-01-10*