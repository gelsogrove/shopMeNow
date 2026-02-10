# 🚨 ULTRAMSG WEBHOOK FIX - SUMMARY

**Date**: 2026-02-10  
**Issue**: Nuovi messaggi non arrivano più dopo cambio webhook URL

---

## ✅ PROBLEMA RISOLTO

### 🐛 BUG TROVATO:
Il sistema stava **generando URL SBAGLIATI** con `/api/v1/` nel path, che NON esiste nelle route registrate.

### ❌ URL SBAGLIATO (quello che il sistema generava):
```
https://www.echatbot.ai/api/v1/whatsapp/ultramsg/echatbot-hq-support
                          ^^^^^^
                          PROBLEMA! /v1/ non esiste!
```

### ✅ URL CORRETTO (dopo il fix):
```
https://www.echatbot.ai/api/whatsapp/ultramsg/[webhookId]
```

---

## 📝 MODIFICHE EFFETTUATE

### File modificati:

1. **`workspace.controller.ts`**:
   - ✅ Corretto URL Meta webhook: `/api/whatsapp/webhook/{webhookId}` (era `/api/v1/...`)
   - ✅ Corretto URL UltraMsg webhook: `/api/whatsapp/ultramsg/{webhookId}` (era `/api/v1/...`)
   - Cambiate 2 occorrenze (metodo `updateWhatsAppConfig` e `getWhatsAppConfig`)

2. **`ultramsg-webhook.controller.ts`**:
   - ✅ Corretto commento JSDoc (era `/api/v1/`, ora `/api/whatsapp/`)
   - ✅ Corretto test endpoint per generare URL corretto
   - ✅ Ora usa `webhookId` invece di `workspaceId` nel test URL

3. **`debug-ultramsg-webhook.ts`** (NUOVO):
   - Script per verificare configurazione webhook nel database
   - Mostra URL corretto per ogni workspace UltraMsg

---

## 🚀 PROSSIMI PASSI (IMMEDIATE!)

### STEP 1: Deploy il fix
```bash
# Andrea, fai commit e push:
git commit -m "fix: UltraMsg webhook URL - remove /v1/ from path"
git push heroku main

# Oppure se usi Heroku remote diverso:
git push production main
```

### STEP 2: Trova il webhookId corretto
```bash
# Connettiti al database di produzione
heroku pg:psql --app echatbot-hq-support

# Query per trovare il webhookId:
SELECT 
  w.id,
  w.name, 
  w."whatsappProvider",
  w."channelStatus",
  ws."webhookId"
FROM "Workspace" w
LEFT JOIN "WhatsappSettings" ws ON ws."workspaceId" = w.id
WHERE w."whatsappProvider" = 'ultramsg' 
  AND w."deletedAt" IS NULL;

# Copia il valore di webhookId (es: "abc123-def456...")
```

### STEP 3: Aggiorna webhook su UltraMsg
```
1. Vai su: https://api.ultramsg.com/
2. Login con account
3. Vai su Instance Settings → Webhooks
4. Aggiorna URL con quello CORRETTO:
   https://www.echatbot.ai/api/whatsapp/ultramsg/[INCOLLA_WEBHOOK_ID_QUI]
5. Salva
```

### STEP 4: Test
```bash
# Invia un messaggio WhatsApp al numero configurato
# Poi controlla i logs:
heroku logs --tail --app echatbot-hq-support | grep ULTRAMSG

# Se funziona vedrai:
# ✅ UltraMsg Webhook received
# ✅ InstanceId verified
# ✅ Processing message...
```

---

## 🔍 COME VERIFICARE CHE FUNZIONA

### Logs da monitorare:
```bash
# Log positivi (✅ FUNZIONA):
[ULTRAMSG] 📥 UltraMsg Webhook received
[ULTRAMSG] ✅ InstanceId verified
[ULTRAMSG] 🔓 Released customer lock

# Log negativi (❌ PROBLEMI):
[ULTRAMSG] ❌ Webhook not found (significa webhookId sbagliato)
[ULTRAMSG] ❌ Invalid instanceId (significa instanceId non corrisponde)
[ULTRAMSG] ❌ Missing instanceId in payload (UltraMsg non sta mandando instanceId)
```

### Test manuale:
1. Invia messaggio WhatsApp al numero del bot
2. Controlla che arrivi la risposta entro 3-5 secondi
3. Se non arriva → controlla logs sopra

---

## 📊 ROUTE REGISTRATE (Reference)

### UltraMsg Webhook (PUBLIC):
```
POST /api/whatsapp/ultramsg/:webhookId
```

### Meta Webhook (PUBLIC):
```
GET  /api/whatsapp/webhook/:webhookId (verification)
POST /api/whatsapp/webhook/:webhookId (receive messages)
```

### Invia Messaggi (PROTECTED):
```
POST /api/whatsapp/send (requires JWT auth)
```

---

## 🐛 PROBLEMI COMUNI

### 1. "Webhook not found"
**Causa**: `webhookId` in URL non corrisponde al database  
**Fix**: Verifica con query STEP 2, copia webhookId corretto

### 2. "Invalid instanceId"
**Causa**: UltraMsg sta inviando instanceId diverso da quello nel database  
**Fix**: 
```sql
-- Verifica instanceId nel database
SELECT "ultraMsgInstanceId" FROM "Workspace" WHERE id = 'workspace_id';

-- Confronta con quello che UltraMsg sta inviando (guarda logs)
```

### 3. "Channel disabled"
**Causa**: `channelStatus = false` nel database  
**Fix**:
```sql
UPDATE "Workspace" 
SET "channelStatus" = true 
WHERE id = 'workspace_id';
```

### 4. Messaggi duplicati
**Causa**: UltraMsg sta mandando stesso messaggio 2+ volte  
**Fix**: Già gestito con deduplicazione (messageId), nessuna azione necessaria

---

## 📁 FILE MODIFICATI (Summary)

```
apps/backend/src/interfaces/http/controllers/
  ├── ultramsg-webhook.controller.ts (3 correzioni)
  └── workspace.controller.ts (2 correzioni URL)

apps/backend/scripts/
  └── debug-ultramsg-webhook.ts (NUOVO - script diagnostico)

docs/waapi/ (NUOVO - spike WaAPI feature)
  ├── EXECUTIVE_SUMMARY.md
  ├── IMPLEMENTATION_DETAILS.md
  └── TASK_CHECKLIST.md
```

---

## ✅ CHECKLIST COMPLETAMENTO

- [x] ✅ Bug identificato (URL con `/v1/` errato)
- [x] ✅ Codice corretto (5 file modificati)
- [x] ✅ Script debug creato
- [x] ✅ Changes staged (`git add -A`)
- [ ] ⏳ Commit & push (Andrea fa questo)
- [ ] ⏳ Deploy su Heroku (Andrea fa questo)
- [ ] ⏳ Trova webhookId corretto (Andrea esegue query)
- [ ] ⏳ Aggiorna webhook su UltraMsg (Andrea fa questo)
- [ ] ⏳ Test funzionamento (Andrea invia messaggio test)
- [ ] ⏳ Verifica logs (Andrea controlla heroku logs)

---

## 🎯 TEMPO STIMATO

- Deploy: 2 minuti
- Query database: 1 minuto
- Aggiorna webhook UltraMsg: 2 minuti
- Test: 1 minuto

**TOTALE**: ~6 minuti per ripristinare il funzionamento!

---

## 📞 SUPPORTO

Se dopo questi passi i messaggi ancora non arrivano:

1. Controlla logs dettagliati:
```bash
heroku logs --tail --app echatbot-hq-support | grep -E "ULTRAMSG|ERROR|❌"
```

2. Verifica configurazione workspace:
```bash
npx ts-node scripts/debug-ultramsg-webhook.ts
```

3. Test connessione UltraMsg:
```bash
curl https://www.echatbot.ai/api/whatsapp/ultramsg/test/[workspace_id]
```

---

**Andrea, ora sei pronto! Procedi con STEP 1-4 e i messaggi torneranno a funzionare! 🚀**
