# 🚀 WhatsApp Integration - Quick Start

**Per quando sarai pronto a configurare Meta Developer Console**

---

## ⚡ Setup Rapido (5 minuti)

### 1️⃣ Meta Developer Console

1. **Vai su**: https://developers.facebook.com/apps
2. **Crea App** → Tipo: "Business"
3. **Aggiungi prodotto**: WhatsApp → Setup

### 2️⃣ Ottieni Credenziali

**Access Token** (Temporary - per test):

```
WhatsApp → Getting Started → Temporary Access Token
Copia: EAAxxxxxxxxxxxxxx
```

**Phone Number ID**:

```
WhatsApp → Getting Started → Phone Number ID
Copia: 1234567890123456
```

**App Secret**:

```
App Settings → Basic → App Secret → Show
Copia: abcdef1234567890
```

### 3️⃣ Configura Backend

**`.env`**:

```bash
WHATSAPP_API_URL=https://graph.facebook.com/v18.0
WHATSAPP_VERIFY_TOKEN=shopme_secure_token_2025  # Inventalo tu
WHATSAPP_APP_SECRET=abcdef1234567890  # Da Meta
```

**Database**:

```sql
UPDATE "Workspace"
SET
  "whatsappApiKey" = 'EAAxxxxxxxxxxxxxx',
  "whatsappPhoneNumber" = '1234567890123456'
WHERE id = 'your-workspace-id';
```

### 4️⃣ Configura Webhook (Dev con ngrok)

**Terminal 1** - Avvia ngrok:

```bash
ngrok http 3001
# Copia URL: https://abc123.ngrok.io
```

**Terminal 2** - Backend già running (ts-node-dev)

**Meta Console**:

```
WhatsApp → Configuration → Webhook
Callback URL: https://abc123.ngrok.io/api/whatsapp/webhook
Verify Token: shopme_secure_token_2025  # Stesso di .env
```

**Verifica** → Dovrebbe diventare verde ✅

**Subscribe to**:

- ✅ messages

**Save**

### 5️⃣ Test Ricezione

**Dal tuo WhatsApp personale**:

- Invia messaggio al numero di test Meta
- Controlla logs backend: `[WEBHOOK] ✅ Message processed`
- Dovresti ricevere risposta echo

### 6️⃣ Test Invio (da Frontend)

**Prerequisito**: Customer registrato con numero WhatsApp

**API Call**:

```bash
curl -X POST http://localhost:3001/api/whatsapp/send \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "X-Session-Id: YOUR_SESSION_ID" \
  -H "Content-Type: application/json" \
  -d '{
    "workspaceId": "your-workspace-id",
    "customerId": "customer-id",
    "phoneNumber": "+393331234567",
    "message": "Test da ShopME! 🚀"
  }'
```

**Expected**: Ricevi messaggio su WhatsApp ✅

---

## 🔧 Troubleshooting Rapido

### ❌ Webhook verification failed

**Fix**: Controlla che `WHATSAPP_VERIFY_TOKEN` in `.env` corrisponda a quello in Meta Console

### ❌ Invalid signature

**Fix**: Controlla `WHATSAPP_APP_SECRET` in `.env` (deve essere App Secret da Meta Settings)

### ❌ WhatsApp not configured

**Fix**: Controlla che workspace abbia `whatsappApiKey` e `whatsappPhoneNumber` nel database

### ❌ Customer not found

**Fix**: Customer deve esistere in database con campo `phone` popolato (formato: `+393331234567`)

### ❌ Workspace mismatch

**Fix**: `workspaceId` nel body deve corrispondere al workspace della tua sessione

---

## 📱 Numeri di Test Meta

**IMPORTANTE**: I numeri di test Meta hanno limitazioni:

- ✅ Puoi inviare/ricevere da max 5 numeri
- ✅ Devi aggiungere numeri in "Phone numbers" → "Add phone number"
- ✅ Ogni numero deve confermare con codice OTP
- ❌ Non puoi inviare a numeri random

**Per produzione**: Richiedi verifica Business Account e numero dedicato

---

## 🎯 Next Steps

1. ✅ Setup completato
2. ✅ Test ricezione OK
3. ✅ Test invio OK
4. 🔄 Integra LLMService nel webhook (rimuovi echo logic)
5. 🔄 Crea UI frontend per invio messaggi operatori
6. 🔄 Testa push notifications (chatbot on/off, orders, discounts)
7. 🔄 Deploy staging con ngrok persistente
8. 🚀 Richiedi verifica Business per produzione

---

## 📚 Documentazione Completa

- **Setup Dettagliato**: `docs/memory-bank/whatsapp-setup-guide.md`
- **Implementation Summary**: `docs/memory-bank/whatsapp-implementation-complete.md`
- **Architecture**: `docs/memory-bank/whatsapp-integration-architecture.md`
- **Changelog**: `CHANGELOG-whatsapp.md`

---

## 🆘 Support

Se qualcosa non funziona:

1. Controlla logs backend (cerca `[WEBHOOK]` o `[WHATSAPP-SEND]`)
2. Verifica ENV variables
3. Verifica database workspace credentials
4. Controlla che customer esista con phone number
5. Vedi sezione Troubleshooting in `whatsapp-implementation-complete.md`

---

**Pronto per iniziare quando vuoi Andrea! 🚀**
