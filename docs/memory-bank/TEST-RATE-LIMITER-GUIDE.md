# 🧪 TEST RATE LIMITER - Guida Rapida

**Data**: 11 Ottobre 2025  
**Timing TEST**: 1 minuto / 3 tentativi  
**Timing PRODUCTION**: 15 minuti / 5 tentativi

---

## ⚙️ **CONFIGURAZIONE TEST**

**File**: `backend/src/interfaces/http/routes/auth.routes.ts`

```typescript
const loginLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 🧪 1 minuto (per test veloce)
  max: 3, // 🧪 Max 3 tentativi
  message:
    "Too many login attempts from this IP, please try again after 1 minute",
})
```

---

## 🧪 **PROCEDURA TEST**

### **Step 1: Verifica Backend Riavviato**

Il backend si è già riavviato automaticamente con `ts-node-dev` ✅

### **Step 2: Apri Browser in Incognito**

- **Chrome**: Cmd+Shift+N
- **Safari**: Cmd+Shift+N
- Questo garantisce IP pulito senza rate limit precedenti

### **Step 3: Vai al Login**

URL: http://localhost:3000/auth/login

### **Step 4: Prova 4 Login Falliti**

1. **Tentativo 1**: Email: `admin@shopme.com` / Password: `SBAGLIATA123`

   - Premi "Sign In"
   - **Atteso**: ❌ "Invalid credentials" (normale errore login)
   - **Header Response**: `RateLimit-Limit: 3`, `RateLimit-Remaining: 2`

2. **Tentativo 2**: Email: `admin@shopme.com` / Password: `WRONGPASSWORD`

   - Premi "Sign In"
   - **Atteso**: ❌ "Invalid credentials"
   - **Header Response**: `RateLimit-Limit: 3`, `RateLimit-Remaining: 1`

3. **Tentativo 3**: Email: `admin@shopme.com` / Password: `NOPE12345`

   - Premi "Sign In"
   - **Atteso**: ❌ "Invalid credentials"
   - **Header Response**: `RateLimit-Limit: 3`, `RateLimit-Remaining: 0`

4. **Tentativo 4**: Email: `admin@shopme.com` / Password: `QUALSIASI`
   - Premi "Sign In"
   - **ATTESO** 🚨:
     - Status: **429 Too Many Requests**
     - Message: **"Too many login attempts from this IP, please try again after 1 minute"**
     - Browser toast: Errore rosso con messaggio rate limit

### **Step 5: Verifica Log Backend**

Nel terminal backend dovresti vedere:

```
🚨 RATE LIMIT EXCEEDED for IP ::1 on /auth/login
```

### **Step 6: Aspetta 1 Minuto**

- Guarda l'orologio
- Aspetta esattamente 60 secondi
- **NON** ricaricare la pagina (mantieni la sessione)

### **Step 7: Riprova Login Corretto**

- Email: `admin@shopme.com`
- Password: `venezia44` (quella GIUSTA)
- Premi "Sign In"
- **ATTESO** ✅:
  - Login SUCCESSFUL
  - Redirect a `/workspace-selection`
  - SessionId salvato in sessionStorage

---

## 📊 **COSA VERIFICARE**

### ✅ **Comportamenti Corretti**

1. **Rate Limit Blocking**:

   - Dopo 3 tentativi → blocco immediato
   - Status 429 (non 401 o 400)
   - Messaggio chiaro: "please try again after 1 minute"

2. **Headers HTTP** (verifica in DevTools → Network → Response Headers):

   ```
   RateLimit-Limit: 3
   RateLimit-Remaining: 0
   RateLimit-Reset: [timestamp unix]
   ```

3. **Reset Automatico**:

   - Dopo 1 minuto → counter si azzera
   - Login corretto funziona di nuovo

4. **IP-Based**:

   - Ogni IP ha il suo counter indipendente
   - Se apri altro browser/incognito → nuovo counter

5. **Backend Log**:
   - Console log: `🚨 RATE LIMIT EXCEEDED for IP ::1 on /auth/login`

### ❌ **Comportamenti Sbagliati (da segnalare)**

- Rate limit NON si attiva dopo 3 tentativi
- Messaggio di errore generico invece di specifico rate limit
- Status code diverso da 429
- Rate limit NON si resetta dopo 1 minuto
- Login corretto bloccato anche dopo reset

---

## 🎯 **TESTING AVANZATO**

### **Test A: Login Corretto Non Conta**

1. Fai **login corretto** con password giusta
2. Logout
3. Fai 3 login **sbagliati**
4. **ATTESO**: Rate limit si attiva (login corretto non conta nel counter)

### **Test B: Mixed Email**

1. Login sbagliato con `admin@shopme.com` (tentativo 1)
2. Login sbagliato con `test@test.com` (tentativo 2)
3. Login sbagliato con `altro@email.com` (tentativo 3)
4. **ATTESO**: Rate limit si attiva (conta IP, non email)

### **Test C: Auto-Reset**

1. Attiva rate limit (3 tentativi falliti)
2. Aspetta ESATTAMENTE 60 secondi
3. Prova login corretto
4. **ATTESO**: Login funziona, counter resettato

---

## 🔄 **DOPO IL TEST - RIPRISTINO PRODUCTION**

**IMPORTANTE**: Dopo il test, riporta i valori a quelli di PRODUCTION!

```typescript
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // ✅ PRODUCTION: 15 minutes
  max: 5, // ✅ PRODUCTION: 5 attempts
  message:
    "Too many login attempts from this IP, please try again after 15 minutes",
  retryAfter: "15 minutes",
})
```

**File da modificare**: `backend/src/interfaces/http/routes/auth.routes.ts`

---

## 📝 **CHECKLIST TEST**

- [ ] Backend riavviato e in esecuzione
- [ ] Browser aperto in modalità incognito
- [ ] 3 login falliti → rate limit attivato (429)
- [ ] Messaggio "please try again after 1 minute" visibile
- [ ] Headers RateLimit-\* presenti in response
- [ ] Log backend mostra "RATE LIMIT EXCEEDED"
- [ ] Dopo 1 minuto → login corretto funziona
- [ ] Rate limit si resetta correttamente
- [ ] **RIPRISTINATI valori PRODUCTION** (15 min, 5 attempts)

---

## 🎉 **SE TUTTO FUNZIONA**

Il sistema è **100% OWASP COMPLIANT** per protezione brute force! ✅

**Next**: Ripristina valori production e fai commit dei fix di sicurezza.

---

**Fine Guida Test**
