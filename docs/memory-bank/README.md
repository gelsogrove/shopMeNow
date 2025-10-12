# 📚 Memory Bank - ShopME Documentation

**Ultimo aggiornamento**: 12 Ottobre 2025

Documentazione tecnica completa del progetto ShopME.

---

## 📖 Documenti Disponibili

### 🔐 Autenticazione & Sicurezza

#### [TOKEN-VS-SESSIONID-ARCHITECTURE.md](./TOKEN-VS-SESSIONID-ARCHITECTURE.md)
**Documentazione completa** dell'architettura di autenticazione doppia:
- Token-based per pagine pubbliche (`/api/token/*`)
- SessionID-based per backoffice admin
- Struttura backend e frontend
- Routing e middleware
- Best practices e troubleshooting

**Quando leggere**: Prima di lavorare su autenticazione, routing, o nuove API

#### [QUICK-REFERENCE-TOKEN-SESSION.md](./QUICK-REFERENCE-TOKEN-SESSION.md)
**Riferimento rapido** per sviluppo quotidiano:
- Quale client usare (tokenApi vs api)
- Dove montare le route
- Errori comuni e soluzioni veloci
- Checklist debug

**Quando leggere**: Durante sviluppo di nuove feature

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
