# 📱 Come Configurare WhatsApp Business API

**Data**: 12 Ottobre 2025  
**Per**: Andrea  
**Status**: 📖 Guida Setup

---

## 🎯 ARCHITETTURA CREDENZIALI

### ✅ NEL DATABASE (per workspace)

Ogni workspace ha le SUE credenziali WhatsApp salvate nel database:

```sql
-- Tabella: workspace
whatsappApiKey          String?    -- Token API specifico del workspace
whatsappPhoneNumber     String?    -- Numero WhatsApp Business del workspace
```

**Dove inserirle**: Tramite interfaccia **Workspace Settings** nel frontend

### ✅ NELLE ENV (globali)

File: `backend/.env` (NON committare!)

```bash
# URL API WhatsApp (uguale per tutti)
WHATSAPP_API_URL=https://graph.facebook.com/v18.0

# Token per verificare webhook durante setup iniziale
WHATSAPP_VERIFY_TOKEN=shopme_whatsapp_verify_token_2025_change_this_in_production

# App Secret per verificare firma HMAC (CRITICO per sicurezza!)
WHATSAPP_APP_SECRET=your_whatsapp_app_secret_from_meta_dashboard

# Configurazioni sicurezza e rate limiting
WHATSAPP_WEBHOOK_ENABLED=true
WHATSAPP_SIGNATURE_VERIFICATION=true
WHATSAPP_MAX_MESSAGES_PER_MINUTE_WORKSPACE=100
WHATSAPP_MAX_MESSAGES_PER_MINUTE_CUSTOMER=10
WHATSAPP_MAX_RETRY_ATTEMPTS=3
WHATSAPP_RETRY_DELAY_MS=1000
```

---

## 📋 SETUP PASSO-PASSO

### **Step 1: Crea WhatsApp Business App su Meta**

1. Vai su: https://developers.facebook.com/
2. Clicca **"My Apps"** → **"Create App"**
3. Scegli tipo: **"Business"**
4. Nome app: `ShopME WhatsApp Bot`
5. Email di contatto: tua email
6. Clicca **"Create App"**

### **Step 2: Aggiungi WhatsApp Product**

1. Nella dashboard app, cerca **"WhatsApp"** nei prodotti
2. Clicca **"Set Up"**
3. Seleziona o crea un **Business Account**
4. Aggiungi un **numero di telefono** (puoi usare quello di test per sviluppo)

### **Step 3: Ottieni Credenziali**

#### A) **API Token** (per ogni workspace)

1. Vai in **WhatsApp** → **API Setup**
2. Copia il **Temporary Access Token** (24h)
3. Per token permanente:
   - Vai in **Settings** → **System Users**
   - Crea System User
   - Assegna permessi WhatsApp
   - Genera **Permanent Token**
4. **Salva questo token nel database** tramite Workspace Settings!

#### B) **Phone Number ID**

1. In **WhatsApp** → **API Setup**
2. Trovi **"Phone Number ID"** sotto il numero
3. Esempio: `106073215675309`
4. **Salva questo come `whatsappPhoneNumber`** nel database!

#### C) **App Secret** (globale)

1. Vai in **Settings** → **Basic**
2. Clicca **"Show"** accanto a **"App Secret"**
3. Copia il valore
4. **Mettilo in `backend/.env`** come `WHATSAPP_APP_SECRET`

### **Step 4: Configura Webhook**

1. In **WhatsApp** → **Configuration**
2. Clicca **"Edit"** su Webhook
3. Inserisci:
   - **Callback URL**: `https://your-domain.com/api/whatsapp/webhook`
   - **Verify Token**: Lo stesso che hai in `WHATSAPP_VERIFY_TOKEN` nell'ENV
4. Clicca **"Verify and Save"**
5. Sottoscrivi a eventi:
   - ✅ `messages`
   - ✅ `message_status` (opzionale, per delivery receipts)

### **Step 5: Testa con ngrok (Sviluppo)**

```bash
# Installa ngrok se non ce l'hai
brew install ngrok

# Esponi backend sulla porta 3001
ngrok http 3001

# Copia l'URL https (es: https://abc123.ngrok.io)
# Usa questo come Callback URL nel webhook:
# https://abc123.ngrok.io/api/whatsapp/webhook
```

---

## 🔧 CONFIGURAZIONE NEL SISTEMA

### **1. Aggiorna ENV** (già fatto! ✅)

File: `backend/.env`

```bash
WHATSAPP_API_URL=https://graph.facebook.com/v18.0
WHATSAPP_VERIFY_TOKEN=shopme_secure_token_123
WHATSAPP_APP_SECRET=abc123def456...
WHATSAPP_WEBHOOK_ENABLED=true
WHATSAPP_SIGNATURE_VERIFICATION=true
```

### **2. Configura Workspace Settings** (da fare nel frontend)

Vai in **Workspace Settings** e inserisci:

- **WhatsApp API Key**: Token permanente da Step 3A
- **WhatsApp Phone Number**: Phone Number ID da Step 3B

Questi vengono salvati nel database nella tabella `workspace`:

```typescript
await prisma.workspace.update({
  where: { id: workspaceId },
  data: {
    whatsappApiKey: "EAABxxx...your_permanent_token",
    whatsappPhoneNumber: "106073215675309",
  },
})
```

---

## 🧪 TEST

### **Test 1: Verifica Webhook**

```bash
# Invia GET request per verifica
curl "http://localhost:3001/api/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=shopme_secure_token_123&hub.challenge=test123"

# Dovresti ricevere: test123
```

### **Test 2: Invia Messaggio via API**

```bash
curl -X POST http://localhost:3001/api/whatsapp/send \
  -H "X-Session-Id: your-session-id" \
  -H "Content-Type: application/json" \
  -d '{
    "workspaceId": "workspace-uuid",
    "customerId": "customer-uuid",
    "phoneNumber": "+393491234567",
    "message": "Ciao! Test messaggio WhatsApp 🎉"
  }'
```

### **Test 3: Ricevi Messaggio via Webhook**

1. Invia un messaggio WhatsApp al tuo numero business
2. Controlla i log del backend: dovrai vedere `🔥 WEBHOOK POST RECEIVED`
3. Verifica che il cliente riceva la risposta automatica

---

## ✅ CHECKLIST FINALE

Prima di andare in produzione:

- [ ] **WhatsApp App creata** su Meta Developers
- [ ] **Numero Business verificato**
- [ ] **Token permanente generato** e salvato nel database per ogni workspace
- [ ] **Phone Number ID** salvato nel database
- [ ] **App Secret** configurato in `.env`
- [ ] **Webhook configurato** e verificato
- [ ] **Domini whitelist** configurati (se necessario)
- [ ] **Rate limits** testati (100 msg/min per workspace)
- [ ] **Signature verification** abilitata (`WHATSAPP_SIGNATURE_VERIFICATION=true`)
- [ ] **Backup .env** creato: ✅ `.env.backup.YYYYMMDD_HHMMSS`

---

## 🚨 SICUREZZA CRITICA

### ⚠️ MAI COMMITTARE `.env`!

Già configurato in `.gitignore`:

```
backend/.env
backend/.env.local
backend/.env.*.local
```

### ✅ Usa Token Permanenti in Produzione

I **Temporary Tokens** scadono dopo 24h! Usa **System User Tokens** per produzione.

### ✅ Verifica Sempre Firma HMAC

Nel webhook, SEMPRE verificare la firma WhatsApp:

```typescript
const signature = req.headers["x-hub-signature-256"]
const isValid = verifyWhatsAppSignature(
  req.body,
  signature,
  WHATSAPP_APP_SECRET
)
if (!isValid) {
  return res.status(403).json({ error: "Invalid signature" })
}
```

Questo è già implementato nel codice! 🎉

---

## 📞 DOMANDE FREQUENTI

### Q: Dove trovo il Phone Number ID?

**A**: Meta Developer Console → WhatsApp → API Setup → sotto il numero trovi "Phone Number ID"

### Q: Il token scade?

**A**: Temporary token = 24h. System User token = permanente (usa questo!)

### Q: Posso usare un numero personale?

**A**: NO! Serve un numero WhatsApp Business verificato.

### Q: Come aggiungo più workspace?

**A**: Ogni workspace ha le sue credenziali nel database. Basta configurare `whatsappApiKey` e `whatsappPhoneNumber` per ogni workspace.

### Q: Webhook non riceve messaggi?

**A**: Controlla:

1. URL webhook corretto in Meta Console
2. Server raggiungibile (usa ngrok per test)
3. Verify token corretto
4. Eventi `messages` sottoscritti

---

## 🔗 LINK UTILI

- **Meta Developers**: https://developers.facebook.com/
- **WhatsApp Business API Docs**: https://developers.facebook.com/docs/whatsapp
- **Ngrok**: https://ngrok.com/
- **Graph API Explorer**: https://developers.facebook.com/tools/explorer/

---

**Document Version**: 1.0  
**Last Updated**: 12 Ottobre 2025  
**Andrea, tutto pronto per collegare WhatsApp! 🚀**
