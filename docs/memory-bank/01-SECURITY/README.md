# 🔐 Security Documentation Hub

**Ultimo aggiornamento**: 14 Ottobre 2025  
**Maintainer**: Andrea  
**Security Rating**: 95/100 ✅

---

## 📁 Struttura Cartella

| Sezione | Contenuto | File principali |
| --- | --- | --- |
| [`authentication/`](./authentication/) | Autenticazione, token, routing pubblico vs backoffice | [`authentication-tokens.md`](./authentication/authentication-tokens.md), [`token-vs-sessionid-architecture.md`](./authentication/token-vs-sessionid-architecture.md), [`token-session-reference.md`](./authentication/token-session-reference.md) |
| [`session-management/`](./session-management/) | Strategie SessionID, migrazioni storage, amministrazione | [`sessionid-admin-panel.md`](./session-management/sessionid-admin-panel.md), [`sessionid-sessionstorage-migration.md`](./session-management/sessionid-sessionstorage-migration.md) |
| [`translation-security/`](./translation-security/) | Translation & Security Layer, mitigazione spam | [`translation-security-layer-strategy.md`](./translation-security/translation-security-layer-strategy.md), [`prompt-spam-translation-security.md`](./translation-security/prompt-spam-translation-security.md) |
| [`assessments/`](./assessments/) | Audit, compliance, roadmap sicurezza | [`security-assessment.md`](./assessments/security-assessment.md), [`owasp-compliance.md`](./assessments/owasp-compliance.md), [`SECURITY-TODO.md`](./assessments/SECURITY-TODO.md), [`rate-limiting-tests.md`](./assessments/rate-limiting-tests.md), [`owasp.md`](./assessments/owasp.md) |
| [`guides/`](./guides/) | Guide operative sicurezza | [`HTTPS-SSL-SETUP.md`](./guides/HTTPS-SSL-SETUP.md), [`INTEGRATION-GUIDE.md`](./guides/INTEGRATION-GUIDE.md) |

---

## 🚀 Quick Start

1. **Leggi prima** [`authentication/authentication-tokens.md`](./authentication/authentication-tokens.md)  
   Copre JWT, SecureToken, SessionID e tutte le chiavi critiche.
2. **Verifica lo stato sicurezza** in [`assessments/security-assessment.md`](./assessments/security-assessment.md)  
   Score corrente, vulnerabilità aperte, roadmap.
3. **Aggiorna le priorità** checkando [`assessments/SECURITY-TODO.md`](./assessments/SECURITY-TODO.md)  
   Lista prioritaria (critici → medi).
4. **Configura produzione** usando [`guides/HTTPS-SSL-SETUP.md`](./guides/HTTPS-SSL-SETUP.md)  
   Setup HTTPS completo con Let's Encrypt.

---

## 📊 Metriche e Obiettivi

```text
Autenticazione        20/20   ✅
Autorizzazione        18/20   ✅
Protezione dati       18/20   ✅
Network Security      14/15   ✅
Testing & Validation  14/15   ✅
Code Security         11/10   ✅
Totale                95/100  ✅
```

### Roadmap Immediata (Ottobre → Dicembre 2025)

- [ ] Abilitare IP whitelisting su admin panel
- [ ] Aggiungere firma HMAC ai webhook WhatsApp
- [ ] Automazione backup `.env` + segnalazione audit
- [ ] Pre-commit security hooks (`npm run test:security`)

### Obiettivi H1 2026

- [ ] 2FA obbligatorio per admin  
- [ ] Secret Manager centralizzato (AWS Secrets Manager)  
- [ ] Token refresh flow per JWT  
- [ ] Alerting login falliti & rate limit monitoring

---

## 🛡️ Checklist Deploy

- [ ] `npm run test:security` → tutti verdi  
- [ ] Chiavi `.env` non di default (`JWT_SECRET`, `TOKEN_ENCRYPTION_KEY`, `TOKEN_HMAC_KEY`, `TOKEN_EXPIRATION`)  
- [ ] Tutte le query filtrano per `workspaceId`  
- [ ] Rate limiting attivo su webhook, public orders, checkout, cart  
- [ ] HTTPS + HSTS + CSP configurati (vedi [`guides/HTTPS-SSL-SETUP.md`](./guides/HTTPS-SSL-SETUP.md))

---

## 🔍 Ricerca Rapida

| Argomento | Vai a |
| --- | --- |
| Differenze token vs sessione | [`authentication/token-vs-sessionid-architecture.md`](./authentication/token-vs-sessionid-architecture.md) |
| Checklist rapida token/sessione | [`authentication/token-session-reference.md`](./authentication/token-session-reference.md) |
| Migrazione sessione Storage → SessionStorage | [`session-management/sessionid-sessionstorage-migration.md`](./session-management/sessionid-sessionstorage-migration.md) |
| Strategy Translation Layer | [`translation-security/translation-security-layer-strategy.md`](./translation-security/translation-security-layer-strategy.md) |
| Test rate limiting | [`assessments/rate-limiting-tests.md`](./assessments/rate-limiting-tests.md) |

---

## 🤝 Contatti

- Vulnerabilità critiche → **Andrea** (immediato)  
- Incident response → vedi [`assessments/SECURITY-TODO.md`](./assessments/SECURITY-TODO.md)  
- Domande generali → apri ticket interno `#security`

---

_Mantieni questa sezione aggiornata ogni volta che cambia architettura, flow di autenticazione o policy di sicurezza._
