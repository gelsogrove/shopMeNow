# ShopME Memory Bank

> **Organized technical documentation for the ShopME platform**
>
> Naviga per cartelle tematiche: sicurezza, funzionalità,## 📎 Link Rapidi

- [Security Hub](./01-security/readme.md)
- [Token vs SessionID Architecture](./01-security/authentication/token-vs-sessionid-architecture.md)
- [Rate Limiting Tests](./01-security/assessments/rate-limiting-tests.md)
- [WhatsApp Setup Guide](./05-guides/whatsapp-setup-guide.md)
- [PRD Generale](./prd.md)ettura, best practice e guide operative.

---

## � Quick Start

1. **Sicurezza prima di tutto** → [`01-SECURITY/README.md`](./01-SECURITY/README.md)
2. **Capire le feature core** → [`02-FEATURES/`](./02-FEATURES/)
3. **Mappa architettura completa** → [`03-ARCHITECTURE/`](./03-ARCHITECTURE/)
4. **Setup e procedure** → [`05-GUIDES/`](./05-GUIDES/)

---

## � Quick Start

1. **Sicurezza prima di tutto** → [`01-security/readme.md`](./01-security/readme.md)
2. **Capire le feature core** → [`02-features/`](./02-features/)
3. **Mappa architettura completa** → [`03-architecture/`](./03-architecture/)
4. **Setup e procedure** → [`05-guides/`](./05-guides/)

---

## �📂 Struttura Aggiornata

```
memory-bank/
├── 01-security/
│   ├── readme.md
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
│   │   ├── security-todo.md
│   │   ├── owasp-compliance.md
│   │   ├── rate-limiting-tests.md
│   │   ├── image-upload-security-audit.md
│   │   └── security-assessment.md
│   └── guides/
│       ├── https-ssl-setup.md
│       └── integration-guide.md
├── 02-features/
│   ├── analytics-top-sellers-implementation.md
│   ├── billing-system.md
│   ├── cart-link-fix.md
│   ├── debug-system-implementation.md
│   ├── image-upload-system.md
│   ├── message-sending-implementation.md
│   ├── scheduler-service.md
│   ├── short-links.md
│   └── whatsapp-implementation-complete.md
├── 03-architecture/
│   ├── calling-functions-architecture.md
│   ├── calling-functions-routing.md
│   ├── endpoints.md
│   ├── llmservice-architecture-flow.md
│   ├── style-guide.md
│   └── websocket-implementation.md
├── 04-best-practices/
│   ├── backend-best-practices.md
│   └── frontend-best-practices.md
├── 05-guides/
│   ├── mcp.md
│   ├── prd-maintenance-instructions.md
│   ├── projectbrief.md
│   ├── scripts-guide.md
│   ├── unit-test-guide.md
│   ├── whatsapp-integration-architecture.md
│   └── whatsapp-setup-guide.md
└── 06-reports/
    ├── analisi-costi-llm.md
    ├── cleanup-report-20251020.md
    ├── cleanup-summary-2025-10-17.md
    ├── implementation-summary-issue-84.md
    └── verifica-finale.md
```

---

## 🔎 Trova Subito quello che ti Serve

| Obiettivo                              | Vai a                                                                      | Note                                                                   |
| -------------------------------------- | -------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Autenticazione e routing sicuro        | [`01-security/authentication/`](./01-security/authentication/)             | Token vs SessionID, cheat sheet quotidiano                             |
| Sessioni e migrazioni storage          | [`01-security/session-management/`](./01-security/session-management/)     | Migrazione admin panel, fix storage                                    |
| Strategie Translation & Security Layer | [`01-security/translation-security/`](./01-security/translation-security/) | Analisi layer, mitigazione spam                                        |
| Audit e roadmap sicurezza              | [`01-security/assessments/`](./01-security/assessments/)                   | Security score, TODO prioritizzati, OWASP                              |
| Configurazione HTTPS & integrazioni    | [`01-security/guides/`](./01-security/guides/)                             | Setup SSL, guida integrazione security                                 |
| Feature e servizi core                 | [`02-features/`](./02-features/)                                           | Scheduler, short links, invio messaggi, analytics                      |
| Architettura sistema                   | [`03-architecture/`](./03-architecture/)                                   | Flow LLM, websocket, endpoints, style guide                            |
| Standard di sviluppo                   | [`04-best-practices/`](./04-best-practices/)                               | Linee guida backend e frontend                                         |
| Guide operative e onboarding           | [`05-guides/`](./05-guides/)                                               | WhatsApp setup, unit test, script operativi, **pricing management** 💰 |
| Report e analisi                       | [`06-reports/`](./06-reports/)                                             | Cleanup reports, analisi costi LLM, verifiche finali                   |

---

## 🧭 Workflow Consigliato

### Nuove Feature

1. Apri il cheat sheet → [`01-security/authentication/token-session-reference.md`](./01-security/authentication/token-session-reference.md)
2. Consulta la documentazione della feature → cartella `02-features`
3. Verifica pattern architetturali correlati → `03-architecture`

### Hardening & Audit

1. Controlla score e vulnerabilità aperte → [`01-security/assessments/security-assessment.md`](./01-security/assessments/security-assessment.md)
2. Aggiorna stato delle attività → [`01-security/assessments/security-todo.md`](./01-security/assessments/security-todo.md)
3. Esegui guide operative → [`01-security/guides/`](./01-security/guides/)

### Onboarding Nuovi Membri

1. Leggi il `projectbrief` → [`05-guides/projectbrief.md`](./05-guides/projectbrief.md)
2. Studia best practice → [`04-best-practices/`](./04-best-practices/)
3. Approfondisci architettura LLM e websocket → `03-architecture`

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
