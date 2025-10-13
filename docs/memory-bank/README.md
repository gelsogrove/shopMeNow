# ShopME Memory Bank

> **Organized technical documentation for the ShopME platform**
>
> This memory bank contains all technical documentation, organized by category for easy navigation and reference.

---

## 📚 Quick Start

**Start here**: [INDEX.md](INDEX.md) - Complete documentation index with navigation

---

## 📂 Documentation Structure

```
memory-bank/
├── INDEX.md                    # Main documentation index (START HERE)
├── 01-SECURITY/                # Security documentation
│   ├── owasp.md
│   ├── translation-security-summary.md
│   ├── sessionid-admin-panel.md
│   ├── sessionid-sessionstorage-migration.md
│   └── sessionid-storage-fix.md
├── 02-FEATURES/                # Feature documentation
│   ├── short-links.md
│   ├── scheduler-service.md
│   ├── whatsapp-implementation-complete.md
│   ├── billing-system.md
│   ├── message-sending-implementation.md
│   └── WIP-MESSAGE-FEATURE.md
├── 03-ARCHITECTURE/            # Architecture & design
│   ├── LLMSERVICE-ARCHITECTURE-FLOW.md
│   ├── WEBSOCKET-IMPLEMENTATION.md
│   ├── endpoints.md
│   └── style-guide.md
├── 04-BEST-PRACTICES/          # Coding standards
│   ├── backend-best-practices.md
│   └── frontend-best-practices.md
└── 05-GUIDES/                  # How-to guides
    ├── whatsapp-setup-guide.md
    ├── whatsapp-integration-architecture.md
    ├── scripts-guide.md
    ├── unit-test-guide.md
    └── projectbrief.md
```

---

## 🎯 Find What You Need

### 🔒 Security & Authentication

Looking for auth, sessions, rate limiting, or security features?  
→ **[01-SECURITY/](01-SECURITY/)**

### ⚡ Features & Integrations

Need info about WhatsApp, short links, scheduler, or billing?  
→ **[02-FEATURES/](02-FEATURES/)**

### 🏗️ System Architecture

Understanding LLM flow, WebSockets, API structure, or design system?  
→ **[03-ARCHITECTURE/](03-ARCHITECTURE/)**

### ✨ Coding Standards

Backend or frontend best practices, patterns, conventions?  
→ **[04-BEST-PRACTICES/](04-BEST-PRACTICES/)**

### 📖 Setup & How-To

WhatsApp setup, testing, scripts, or getting started?  
→ **[05-GUIDES/](05-GUIDES/)**

- Best practices e troubleshooting

**Quando leggere**: Prima di lavorare su autenticazione, routing, o nuove API

#### [QUICK-REFERENCE-TOKEN-SESSION.md](./QUICK-REFERENCE-TOKEN-SESSION.md)

**Riferimento rapido** per sviluppo quotidiano:

- Quale client usare (tokenApi vs api)
- Dove montare le route
- Errori comuni e soluzioni veloci
- Checklist debug

**Quando leggere**: Durante sviluppo di nuove feature

### 🚀 Real-Time & WebSocket

#### [WEBSOCKET-IMPLEMENTATION.md](./WEBSOCKET-IMPLEMENTATION.md) **NEW**

**Implementazione completa WebSocket** per ChatPage:

- Socket.io server backend
- Sistema eventi real-time
- Hook frontend `useWebSocket`
- Trigger eventi backend
- Confronto performance (10-15s → <100ms)
- Guida testing

**Quando leggere**: Prima di lavorare su real-time features, debugging WebSocket

#### [CHATPAGE-ANALYSIS-WEBSOCKET-PROPOSAL.md](./CHATPAGE-ANALYSIS-WEBSOCKET-PROPOSAL.md)

**Analisi problemi ChatPage** e proposta soluzione:

- Problemi polling (10s delays, 404 errors)
- Architettura attuale vs proposta
- Piano implementazione WebSocket

**Quando leggere**: Per capire l'evoluzione da polling a WebSocket

### 🤖 AI & LLM

#### [LLMSERVICE-ARCHITECTURE-FLOW.md](./LLMSERVICE-ARCHITECTURE-FLOW.md)

Architettura e flusso del servizio LLM (OpenRouter integration)

### � Security & OWASP

#### [OWASP-SECURITY-COMPLIANCE-REPORT.md](./OWASP-SECURITY-COMPLIANCE-REPORT.md)

Report compliance OWASP e vulnerabilità risolte

#### [SECURITY-FIXES-SUMMARY-2025-10-11.md](./SECURITY-FIXES-SUMMARY-2025-10-11.md)

Riepilogo fix di sicurezza 11 Ottobre 2025

#### [TEST-RATE-LIMITER-GUIDE.md](./TEST-RATE-LIMITER-GUIDE.md)

Guida testing rate limiter e protezione API

### 💰 Billing & Scheduler

#### [billing-system.md](./billing-system.md)

Sistema di fatturazione e usage tracking

#### [scheduler-service.md](./scheduler-service.md)

Servizio scheduler per task automatici

### 🔗 Features & Services

#### [short-links.md](./short-links.md)

Sistema short links per URL pubblici

#### [sessionid-admin-panel.md](./sessionid-admin-panel.md)

Gestione sessioni admin panel

#### [WIP-MESSAGE-FEATURE.md](./WIP-MESSAGE-FEATURE.md)

Feature messaggi WhatsApp (Work In Progress)

### 📐 Design & Style

#### [style-guide.md](./style-guide.md)

Guida stile UI/UX del progetto

#### [projectbrief.md](./projectbrief.md)

Brief generale del progetto ShopME

### 📡 API Reference

#### [endpoints.md](./endpoints.md)

Lista completa endpoint API disponibili

### 🗂️ Note Sviluppo

#### [check.md](./check.md)

Note temporanee di sviluppo e testing

---

## 🎯 Come Usare la Memory Bank

### Per Nuove Feature

1. **Leggi Quick Reference** per capire quale sistema usare
2. Se pubblico → `tokenApi` + `/api/token/*`
3. Se backoffice → `api` + sessionId
4. **Consulta Documentazione Completa** per dettagli architettura

### Per Bug/Troubleshooting

1. **Controlla Quick Reference** - sezione errori comuni
2. Usa **Debug Checklist** per verificare configurazione
3. **Consulta Troubleshooting** nella doc completa per casi complessi

### Per Onboarding Team

1. Leggi **TOKEN-VS-SESSIONID-ARCHITECTURE.md** per overview completo
2. Studia sezione **Best Practices**
3. Usa **Quick Reference** come promemoria quotidiano

---

## 🔄 Manutenzione Documenti

### Quando Aggiornare

- ✅ Modifiche architettura autenticazione
- ✅ Nuove route token o backoffice
- ✅ Cambi middleware o validazione
- ✅ Pattern comuni scoperti
- ✅ Bug ricorrenti risolti

### Come Aggiornare

1. Modifica documento principale
2. Aggiorna Quick Reference se necessario
3. Aggiorna data "Ultimo aggiornamento" in questo README
4. Aggiungi entry nel CHANGELOG se rilevante

---

## 📋 Checklist Pre-Commit

Prima di committare modifiche a autenticazione/routing:

- [ ] Documentazione aggiornata
- [ ] Quick Reference aggiornato se pattern nuovo
- [ ] Testato con token pubblico
- [ ] Testato con sessionId backoffice
- [ ] Verificato log backend mostra route corrette
- [ ] Frontend usa client HTTP corretto

---

## 🚀 Link Rapidi

- [Documentazione Completa Token/Session](./TOKEN-VS-SESSIONID-ARCHITECTURE.md)
- [Quick Reference](./QUICK-REFERENCE-TOKEN-SESSION.md)
- [PRD Generale](../PRD.md)

---

**Note**: La Memory Bank è il punto di riferimento per tutta la documentazione tecnica del progetto. Mantienila aggiornata!
