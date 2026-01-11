# 🎯 Widget Unification Plan (speckit.plan)

**Data**: 11 Gennaio 2026  
**Owner**: Andrea (shopME)  
**Spec Reference**: `/docs/analysis/analisiLLM.md`  
**Status**: 🟡 IN PLANNING

---

## 📋 Executive Summary

Unificazione dell'architettura Widget e WhatsApp sotto una **coda messaggi condivisa** con differenziazione dei canali. Questo elimina la duplicazione logica (Widget oggi non ha security check) e standardizza il flusso di elaborazione per tutti i canali.

**Timeline**: 5-7 giorni  
**Effort**: 40-50 ore  
**Risk Level**: MEDIUM (database migration + breaking changes API)

---

## 🏗️ Architettura Target

```
┌──────────────────────────────────────────────────────────────┐
│                    UNIFIED MESSAGE FLOW                       │
├──────────────────────────────────────────────────────────────┤
│                                                               │
│  Widget (NEW)              WhatsApp (EXISTS)                 │
│  ├─ /api/chat/message      ├─ /webhook/whatsapp             │
│  └─ Polling loop           └─ Push model                     │
│         │                         │                          │
│         └──────────┬──────────────┘                          │
│                    │                                         │
│         ┌──────────▼──────────┐                              │
│         │  BACKEND LLM        │                              │
│         │  LLMRouterService   │                              │
│         └──────────┬──────────┘                              │
│                    │                                         │
│         ┌──────────▼──────────┐                              │
│         │  UNIFIED QUEUE      │◄─── FASE 1 (DB Migration)   │
│         │  MessageQueue       │                              │
│         │  (channel: field)   │                              │
│         └──────────┬──────────┘                              │
│                    │                                         │
│         ┌──────────▼──────────┐                              │
│         │  SCHEDULER          │◄─── FASE 2 (Processing)     │
│         │  messageProcessor   │                              │
│         │  - Security Check   │                              │
│         │  - Delivery Logic   │                              │
│         └──────────┬──────────┘                              │
│                    │                                         │
│         ┌──────────┴──────────┐                              │
│         │                     │                              │
│    ┌────▼─────┐        ┌──────▼────┐                         │
│    │ WhatsApp │        │  Widget    │                        │
│    │  API     │        │  Polling   │                        │
│    └──────────┘        └────────────┘                        │
│                                                               │
└──────────────────────────────────────────────────────────────┘
```

---

## 🔄 Fasi Implementazione

### FASE 1: Database Migration ⏱️ 2 giorni
**Goal**: Aggiungere supporto per canali diversi nella coda

**Componenti**:
- [ ] `prisma/schema.prisma` - Aggiungi campi `channel`, `visitorId`, `phoneNumber`
- [ ] Migration: `add_widget_support_to_queue`
- [ ] Seed update per dati di test

**Deliverables**:
- Schema aggiornato
- Migration testata
- Data backward compatible

---

### FASE 2: Backend API Changes ⏱️ 2 giorni
**Goal**: Widget endpoint + Logic unificata

**Componenti**:
- [ ] `POST /api/v1/widget/chat/:workspaceId` - Nuovo endpoint widget
- [ ] `GET /api/v1/widget/poll/:messageId` - Polling endpoint
- [ ] Update `LLMRouterService` per usare unified queue
- [ ] Middleware authentication per widget

**Deliverables**:
- Widget endpoints funzionanti
- Swagger aggiornato
- Tests per nuovi endpoints

---

### FASE 3: Scheduler Changes ⏱️ 2 giorni
**Goal**: Processing logic unificato

**Componenti**:
- [ ] `MessageProcessor` refactor:
  - [ ] Security check (uguale per tutti)
  - [ ] Logica consegna per canale
  - [ ] Status management unificato
- [ ] Cron job per polling messages
- [ ] Error handling e retry logic

**Deliverables**:
- Processing logic unificata
- Cron jobs configurati
- Tests per processing flow

---

### FASE 4: Frontend Widget ⏱️ 2 giorni
**Goal**: Widget con polling funzionante

**Componenti**:
- [ ] `WidgetChatComponent` - Nuovo component
- [ ] Polling service (500ms interval)
- [ ] Message state management
- [ ] Error handling UI

**Deliverables**:
- Widget funzionante
- Polling loop testato
- Error states handled

---

### FASE 5: Integration & Testing ⏱️ 1 giorno
**Goal**: Tutto insieme funziona

**Componenti**:
- [ ] Integration tests
- [ ] Manual testing (Widget + WhatsApp)
- [ ] Load testing
- [ ] Security validation

**Deliverables**:
- Tests passing
- Documentation updated
- Production ready

---

## 🎯 Task Granulari (50 tasks totali)

### Categoria: Database (8 tasks)
```
D1. Add channel field to MessageQueue model
D2. Add visitorId field (nullable) to MessageQueue
D3. Add phoneNumber field (nullable) to MessageQueue
D4. Add isAnonymous flag to ChatSession
D5. Add expiresAt to ChatSession (for anonymous sessions)
D6. Create migration: add_widget_support_to_queue
D7. Update seed with widget test messages
D8. Validate backward compatibility
```

### Categoria: API - Widget Endpoints (10 tasks)
```
A1. POST /api/v1/widget/chat/:workspaceId (new message)
A2. GET /api/v1/widget/poll/:messageId (poll response)
A3. POST /api/v1/widget/auth (authenticate with token)
A4. Error response standardization
A5. Rate limiting per visitorId
A6. Swagger documentation for widget routes
A7. Request validation schema
A8. Response format standardization
A9. CORS configuration for widget
A10. Security middleware for widget
```

### Categoria: Backend Services (12 tasks)
```
S1. Refactor LLMRouterService to use unified queue
S2. VisitorId generation service
S3. Widget session creation/validation
S4. MessageQueue unified insert
S5. Security check service (5-step validation)
S6. Channel-specific delivery logic
S7. Status management per channel
S8. Error handling & retry logic
S9. Logging & monitoring
S10. Token validation for public links
S11. Rate limiting service
S12. Analytics tracking
```

### Categoria: Scheduler (10 tasks)
```
C1. Message processor refactor
C2. Security check implementation (5 steps)
C3. WhatsApp delivery logic
C4. Widget ready status update
C5. Error handling & DLQ
C6. Cron job for polling messages
C7. Status update mechanism
C8. Timeout handling (30 sec for widget)
C9. Message cleanup job
C10. Monitoring & alerting
```

### Categoria: Frontend (8 tasks)
```
F1. WidgetChat component structure
F2. Message input form
F3. Message display with markdown
F4. Polling service (500ms interval)
F5. Loading states & spinners
F6. Error handling UI
F7. Session management
F8. Integration with existing chat UI
```

### Categoria: Testing & Docs (2 tasks)
```
T1. Integration tests (Widget + WhatsApp flow)
T2. Update architecture documentation
```

---

## 🔐 Security Checks (Order: 5 steps)

```
1. Rate Limit Check
   - workspace credits > 0?
   - customer not hitting limit?
   → FAIL: status="blocked", log incident

2. Content Safety
   - LLM evaluation: violazione?
   → FAIL: status="blocked", NO forward

3. Business Rules
   - Closed hours?
   - Maintenance mode?
   → FAIL: status="queued", auto-response

4. Channel-Specific
   - Widget: visitorId valid + workspace active
   - WhatsApp: numero valid + not blacklist
   → FAIL: status="blocked"

5. Anti-Spam Pattern
   - 10+ messages in 30 sec?
   - Same question 5+ times in 1 min?
   → FAIL: silence 30s then generic response
```

---

## 📊 Dipendenze & Rischi

### Dipendenze Critiche
- ✅ Spec completata (analisiLLM.md)
- ⚠️ Database migration MUST succeed
- ⚠️ Backward compatibility with existing WhatsApp
- ⚠️ No breaking changes to WhatsApp API

### Rischi
| # | Rischio | Probabilità | Impatto | Mitigazione |
|---|---------|------------|---------|-------------|
| R1 | Migration rollback fallisce | MEDIUM | CRITICAL | Backup DB prima della migration |
| R2 | Widget polling eccessivo | MEDIUM | HIGH | Rate limiting per visitorId |
| R3 | WhatsApp messages stuck in queue | LOW | HIGH | Error DLQ + monitoring |
| R4 | Performance degrada | MEDIUM | HIGH | Index optimization + caching |
| R5 | Spec ambiguità durante dev | LOW | MEDIUM | Daily sync con Andrea |

---

## 📅 Timeline Realistica

```
Day 1 (11 Jan)
  └─ FASE 1: Database migration
     └─ 08:00-12:00: Schema update + migration creation
     └─ 12:00-16:00: Testing + seed data
     └─ 16:00-18:00: Validation + documentation

Day 2-3 (12-13 Jan)
  └─ FASE 2: API endpoints
     └─ Widget POST/GET endpoints
     └─ Authentication middleware
     └─ Swagger docs

Day 3-4 (13-14 Jan)
  └─ FASE 3: Scheduler processing
     └─ Unified message processor
     └─ Security checks
     └─ Cron jobs

Day 4-5 (14-15 Jan)
  └─ FASE 4: Frontend widget
     └─ Component structure
     └─ Polling logic
     └─ Error handling

Day 5-6 (15-16 Jan)
  └─ FASE 5: Integration + testing
     └─ End-to-end tests
     └─ Manual testing
     └─ Deployment prep

Day 7 (17 Jan)
  └─ Buffer day for issues + final validation
```

---

## ✅ Success Criteria

- [ ] Widget can send messages via `/api/v1/widget/chat`
- [ ] Widget polls for responses and gets them within 15 seconds
- [ ] WhatsApp still works without any changes
- [ ] Security checks apply to both channels
- [ ] All tests passing (unit + integration + security)
- [ ] Zero data loss in migration
- [ ] Documentation updated
- [ ] Performance baseline: < 500ms response time

---

## 📞 Daily Sync Points

```
✓ Today (11 Jan 17:00): Approval di questo plan
→ Day 2 (12 Jan 10:00): Status update su FASE 1-2
→ Day 3 (13 Jan 10:00): Status update su FASE 2-3
→ Day 4 (14 Jan 10:00): Status update su FASE 3-4
→ Day 5 (15 Jan 10:00): Final testing + go-live decision
```

---

## 🚀 Next Action

**Approva questo plan?** Se sì, iniziamo con `speckit.tasks` che crea i 50 task granulari e assegna priorità.

Andrea, cosa pensi? Pronto per procedere? 🎯

