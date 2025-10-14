# ShopME Memory Bank

> **Organized technical documentation for the ShopME platform**
>
> Naviga per cartelle tematiche: sicurezza, funzionalità, architettura, best practice e guide operative.

---

## � Quick Start

1. **Sicurezza prima di tutto** → [`01-SECURITY/README.md`](./01-SECURITY/README.md)
2. **Capire le feature core** → [`02-FEATURES/`](./02-FEATURES/)
3. **Mappa architettura completa** → [`03-ARCHITECTURE/`](./03-ARCHITECTURE/)
4. **Setup e procedure** → [`05-GUIDES/`](./05-GUIDES/)

---

## 📂 Struttura Aggiornata

```
memory-bank/
├── 01-SECURITY/
│   ├── README.md
│   ├── authentication/
│   │   ├── authentication-tokens.md
│   │   ├── token-session-reference.md
│   │   └── token-vs-sessionid-architecture.md
│   ├── session-management/
│   │   ├── sessionid-admin-panel.md
│   │   ├── sessionid-sessionstorage-migration.md
│   │   └── sessionid-storage-fix.md
│   ├── translation-security/
│   │   ├── prompt-spam-translation-security.md
│   │   ├── translation-security-layer-strategy.md
│   │   └── translation-security-summary.md
│   ├── assessments/
│   │   ├── SECURITY-TODO.md
│   │   ├── owasp-compliance.md
│   │   ├── owasp.md
│   │   ├── rate-limiting-tests.md
│   │   └── security-assessment.md
│   └── guides/
│       ├── HTTPS-SSL-SETUP.md
│       └── INTEGRATION-GUIDE.md
├── 02-FEATURES/
│   ├── ANALYTICS_TOP_SELLERS_IMPLEMENTATION.md
│   ├── WIP-MESSAGE-FEATURE.md
│   ├── billing-system.md
│   ├── debug-system-implementation.md
│   ├── message-sending-implementation.md
│   ├── scheduler-service.md
│   ├── short-links.md
│   └── whatsapp-implementation-complete.md
├── 03-ARCHITECTURE/
│   ├── LLMSERVICE-ARCHITECTURE-FLOW.md
│   ├── WEBSOCKET-IMPLEMENTATION.md
│   ├── calling-functions-architecture.md
│   ├── endpoints.md
│   └── style-guide.md
├── 04-BEST-PRACTICES/
│   ├── backend-best-practices.md
│   └── frontend-best-practices.md
└── 05-GUIDES/
    ├── MCP.md
    ├── projectbrief.md
    ├── scripts-guide.md
    ├── unit-test-guide.md
    ├── whatsapp-integration-architecture.md
    └── whatsapp-setup-guide.md
```

---

## 🔎 Trova Subito quello che ti Serve

| Obiettivo | Vai a | Note |
| --- | --- | --- |
| Autenticazione e routing sicuro | [`01-SECURITY/authentication/`](./01-SECURITY/authentication/) | Token vs SessionID, cheat sheet quotidiano |
| Sessioni e migrazioni storage | [`01-SECURITY/session-management/`](./01-SECURITY/session-management/) | Migrazione admin panel, fix storage |
| Strategie Translation & Security Layer | [`01-SECURITY/translation-security/`](./01-SECURITY/translation-security/) | Analisi layer, mitigazione spam |
| Audit e roadmap sicurezza | [`01-SECURITY/assessments/`](./01-SECURITY/assessments/) | Security score, TODO prioritizzati, OWASP |
| Configurazione HTTPS & integrazioni | [`01-SECURITY/guides/`](./01-SECURITY/guides/) | Setup SSL, guida integrazione security |
| Feature e servizi core | [`02-FEATURES/`](./02-FEATURES/) | Scheduler, short links, invio messaggi, analytics |
| Architettura sistema | [`03-ARCHITECTURE/`](./03-ARCHITECTURE/) | Flow LLM, websocket, endpoints, style guide |
| Standard di sviluppo | [`04-BEST-PRACTICES/`](./04-BEST-PRACTICES/) | Linee guida backend e frontend |
| Guide operative e onboarding | [`05-GUIDES/`](./05-GUIDES/) | WhatsApp setup, unit test, script operativi |

---

## 🧭 Workflow Consigliato

### Nuove Feature

1. Apri il cheat sheet → [`01-SECURITY/authentication/token-session-reference.md`](./01-SECURITY/authentication/token-session-reference.md)
2. Consulta la documentazione della feature → cartella `02-FEATURES`
3. Verifica pattern architetturali correlati → `03-ARCHITECTURE`

### Hardening & Audit

1. Controlla score e vulnerabilità aperte → [`01-SECURITY/assessments/security-assessment.md`](./01-SECURITY/assessments/security-assessment.md)
2. Aggiorna stato delle attività → [`01-SECURITY/assessments/SECURITY-TODO.md`](./01-SECURITY/assessments/SECURITY-TODO.md)
3. Esegui guide operative → [`01-SECURITY/guides/`](./01-SECURITY/guides/)

### Onboarding Nuovi Membri

1. Leggi il `projectbrief` → [`05-GUIDES/projectbrief.md`](./05-GUIDES/projectbrief.md)
2. Studia best practice → [`04-BEST-PRACTICES/`](./04-BEST-PRACTICES/)
3. Approfondisci architettura LLM e websocket → `03-ARCHITECTURE`

---

## �️ Manutenzione Documenti

- Aggiorna la cartella corrispondente ogni volta che cambiano flow di autenticazione, sicurezza o feature core.
- Mantieni i README di sezione sincronizzati con i file reali.
- Quando sposti documenti, aggiorna immediatamente i link interni.

Checklist pre-commit documentazione:

- [ ] Docs aggiornate rispetto al codice
- [ ] Link verificati (`cmd+click`)
- [ ] README della sezione con indice aggiornato
- [ ] Nessun file duplicato in cartelle diverse

---

## � Link Rapidi

- [Security Hub](./01-SECURITY/README.md)
- [Token vs SessionID Architecture](./01-SECURITY/authentication/token-vs-sessionid-architecture.md)
- [Rate Limiting Tests](./01-SECURITY/assessments/rate-limiting-tests.md)
- [WhatsApp Setup Guide](./05-GUIDES/whatsapp-setup-guide.md)
- [PRD Generale](../PRD.md)

---

_Mantieni la memory bank come fonte di verità: niente duplicati, niente contenuti obsoleti._
