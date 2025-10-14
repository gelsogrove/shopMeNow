# 🔐 Security Documentation

**Ultima modifica**: 13 Ottobre 2025  
**Maintainer**: Andrea  
**Security Rating**: 78/100 ⚠️

---

## 📚 Indice Documentazione

### 🎯 Core Security

| Documento                                                                    | Descrizione                                              | Aggiornato  |
| ---------------------------------------------------------------------------- | -------------------------------------------------------- | ----------- |
| [`authentication-tokens.md`](./authentication-tokens.md)                     | **GUIDA PRINCIPALE** - JWT Token, SecureToken, SessionID | 13 Ott 2025 |
| [`security-assessment.md`](./security-assessment.md)                         | Valutazione sicurezza completa (68/100)                  | 13 Ott 2025 |
| [`SECURITY-TODO.md`](./SECURITY-TODO.md) ⭐ **NEW**                          | **TODO PRIORITIZZATO** - 10 vulnerabilità da fixare     | 14 Ott 2025 |
| [`token-vs-sessionid-architecture.md`](./token-vs-sessionid-architecture.md) | Architettura routing backend/frontend                    | 12 Ott 2025 |

### 🛡️ Compliance & Standards

| Documento                                            | Descrizione                        | Aggiornato  |
| ---------------------------------------------------- | ---------------------------------- | ----------- |
| [`owasp-compliance.md`](./owasp-compliance.md)       | Report conformità OWASP Top 10     | 11 Ott 2025 |
| [`rate-limiting-tests.md`](./rate-limiting-tests.md) | Test rate limiting database-backed | 11 Ott 2025 |

### 🚀 Setup Guides

| Documento                                        | Descrizione                               | Aggiornato  |
| ------------------------------------------------ | ----------------------------------------- | ----------- |
| [`HTTPS-SSL-SETUP.md`](./HTTPS-SSL-SETUP.md)     | Setup HTTPS con Let's Encrypt/self-signed | 13 Ott 2025 |
| [`INTEGRATION-GUIDE.md`](./INTEGRATION-GUIDE.md) | Integrazione security features            | 13 Ott 2025 |

### 📖 Quick Reference

| Documento                                                    | Descrizione                 | Aggiornato  |
| ------------------------------------------------------------ | --------------------------- | ----------- |
| [`token-session-reference.md`](./token-session-reference.md) | Cheat sheet token/sessionID | 12 Ott 2025 |

---

## 🎯 Quick Start

### 1. Leggi Prima Questo

**IMPORTANTE**: Inizia da [`authentication-tokens.md`](./authentication-tokens.md) - spiega TUTTO su:

- JWT Token (admin login)
- SecureToken (link pubblici clienti)
- SessionID (tracking sessioni)
- Chiavi di sicurezza (`JWT_SECRET` vs `TOKEN_ENCRYPTION_KEY`)

### 2. Configura Chiavi Sicure

```bash
# Genera JWT_SECRET (512 bit)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Genera TOKEN_ENCRYPTION_KEY (256 bit)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# Aggiungi al backend/.env
JWT_SECRET="<output primo comando>"
TOKEN_ENCRYPTION_KEY="<output secondo comando>"
ADMIN_PASSWORD="<genera password forte 20+ caratteri>"
```

### 3. Verifica Security Rating

Leggi [`security-assessment.md`](./security-assessment.md) per:

- Score attuale: **78/100** ⚠️
- Vulnerabilità critiche identificate
- Raccomandazioni prioritizzate

### 4. Setup HTTPS (Production)

Segui [`HTTPS-SSL-SETUP.md`](./HTTPS-SSL-SETUP.md) per:

- Certificati Let's Encrypt
- Nginx reverse proxy
- SSL/TLS configuration

---

## 🔐 Security Summary

### Implementazioni Completate ✅

- [x] **Rate Limiting**: 5 msg/10sec database-backed
- [x] **JWT Authentication**: HMAC SHA256 + httpOnly cookies
- [x] **SecureToken**: AES-256-CBC per link pubblici
- [x] **SessionID**: UUID tracking con expiry 1h
- [x] **Workspace Isolation**: Filtro workspaceId su tutte le query
- [x] **Test Coverage**: 82 test security passing
- [x] **OWASP Compliance**: Report completo Top 10

### Vulnerabilità Critiche 🚨

| Priorità       | Issue                         | Impact                   | Status     |
| -------------- | ----------------------------- | ------------------------ | ---------- |
| 🔴 **CRITICO** | No HTTPS                      | Traffico in chiaro       | 📋 TODO    |
| 🔴 **CRITICO** | JWT_SECRET debole             | Token forgeable          | ✅ RISOLTO |
| 🔴 **CRITICO** | TOKEN_ENCRYPTION_KEY mancante | Fallback default         | ✅ RISOLTO |
| 🟠 **ALTO**    | No IP Whitelisting            | Chiunque accede backend  | 📋 TODO    |
| 🟠 **ALTO**    | No HMAC Signature             | Replay attacks possibili | 📋 TODO    |
| 🟡 **MEDIO**   | No 2FA                        | Admin vulnerabile        | 📋 TODO    |

### Roadmap Security 🗺️

#### Q4 2025 (Ottobre-Dicembre)

- [ ] **HTTPS Obbligatorio** - Let's Encrypt production
- [ ] **IP Whitelisting** - Admin panel solo da IP fidati
- [ ] **HMAC Signature** - Webhook WhatsApp con firma
- [ ] **Pre-commit Hooks** - Test security automatici
- [ ] **GitHub Actions** - CI/CD con security checks

#### Q1 2026 (Gennaio-Marzo)

- [ ] **2FA Obbligatorio** - Admin accounts
- [ ] **Secret Manager** - AWS Secrets/Vault
- [ ] **Token Refresh** - Mechanism per JWT
- [ ] **Brute Force Protection** - Login attempts limit
- [ ] **CSP Headers** - Content Security Policy

---

## 📊 Security Metrics

### Current Score: 78/100 ⚠️

```
┌─────────────────────────────────────────────────────┐
│  CATEGORIA                    SCORE    MAX   STATUS │
├─────────────────────────────────────────────────────┤
│  🔐 Authentication             18/20   ████░  ✅    │
│  🛡️  Authorization              16/20   ███░░  ⚠️    │
│  🔒 Data Protection             16/20   ███░░  ✅    │
│  🌐 Network Security             8/15   ██░░░  ❌    │
│  🧪 Testing & Validation        14/15   ████░  ✅    │
│  📝 Code Security                6/10   ███░░  ⚠️    │
├─────────────────────────────────────────────────────┤
│  TOTALE                        78/100  ███░░  ⚠️    │
└─────────────────────────────────────────────────────┘
```

**Dettagli**:

- ✅ **Authentication (18/20)**: JWT + SecureToken implementati
- ⚠️ **Authorization (16/20)**: Manca IP Whitelisting
- ✅ **Data Protection (16/20)**: Chiavi aggiornate (era 12/20)
- ❌ **Network Security (8/15)**: No HTTPS
- ✅ **Testing (14/15)**: 82 test passing
- ⚠️ **Code Security (6/10)**: Pre-commit hooks da attivare

### Score Evolution

| Data        | Score  | Delta | Note                                         |
| ----------- | ------ | ----- | -------------------------------------------- |
| 11 Ott 2025 | 68/100 | -     | Initial assessment                           |
| 13 Ott 2025 | 78/100 | +10   | JWT_SECRET + TOKEN_ENCRYPTION_KEY aggiornati |

---

## 🔧 Development Guidelines

### Adding New Features

Quando aggiungi nuova funzionalità che tocca security:

1. **Identifica tipo autenticazione**:

   - Admin backoffice → JWT Token
   - Link pubblico cliente → SecureToken
   - Tracking sessione → SessionID

2. **Applica middleware corretto**:

   ```typescript
   // Admin routes
   router.use(authMiddleware)
   router.use(workspaceValidationMiddleware)

   // Public routes
   const tokenService = new SecureTokenService()
   const { valid, data } = await tokenService.validateToken(token)
   ```

3. **Filtra SEMPRE per workspaceId**:

   ```typescript
   const items = await prisma.item.findMany({
     where: { workspaceId, ...otherFilters }, // ← CRITICO
   })
   ```

4. **Testa security**:

   ```bash
   cd backend && npm run test:security
   ```

5. **Aggiorna documentazione**:
   - Aggiorna [`authentication-tokens.md`](./authentication-tokens.md) se nuovi token
   - Aggiorna [`security-assessment.md`](./security-assessment.md) se impatto su score

### Security Checklist

Prima di ogni deploy:

- [ ] Tutti i test security passano (`npm run test:security`)
- [ ] Chiavi in `.env` non sono default values
- [ ] `.env` non committato su git
- [ ] Workspace isolation verificato
- [ ] Rate limiting applicato su endpoint pubblici
- [ ] Error messages non espongono dettagli interni
- [ ] Logs non contengono secrets
- [ ] HTTPS abilitato (production)

---

## 🆘 Troubleshooting

### "SessionID is required"

**Problema**: Pagina pubblica richiede sessionId

**Soluzione**: Verifica che path sia in `SESSION_EXEMPT_ROUTES`:

```typescript
// backend/src/routes/index.ts
const SESSION_EXEMPT_ROUTES = [
  "/token/", // Esclude /api/token/*
  "/auth/login",
  "/whatsapp/webhook",
]
```

### "Invalid JWT token"

**Problema**: JWT non valido dopo cambio `JWT_SECRET`

**Soluzione**: Normale, tutti gli utenti devono rifare login. Notifica team!

### "Token expired"

**Problema**: SecureToken scaduto

**Soluzione**: Backend rigenera nuovo token e invia nuovo link cliente

### "HTTPS required"

**Problema**: Browser blocca richieste HTTP in production

**Soluzione**: Segui [`HTTPS-SSL-SETUP.md`](./HTTPS-SSL-SETUP.md)

---

## 📞 Contatti

**Security Issues**: Contatta Andrea immediatamente

**Vulnerability Report**: Usa GitHub Security Advisory (privato)

**Questions**: Vedi documentazione in questa cartella prima

---

## 📝 Note Finali

### Backup Policy

```bash
# .env backup automatico prima modifiche
cp backend/.env backend/.env.backup.$(date +%Y%m%d_%H%M%S)

# Backup settimanale database
pg_dump shopmefy > backups/db-$(date +%Y%m%d).sql
```

### Monitoring

- [ ] Setup monitoring rate limiting (TODO)
- [ ] Setup alerting failed login attempts (TODO)
- [ ] Setup log aggregation (TODO)

### Compliance

- GDPR: ✅ User data encrypted
- PCI-DSS: ⚠️ No payment card storage (use Stripe)
- OWASP: ⚠️ 7/10 Top 10 addressed

---

**Fine README** 🎉

_Ultima modifica: 13 Ottobre 2025_  
_Versione: 2.0_
