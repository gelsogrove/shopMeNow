# 🔗 Short Links System - Sistema di URL Brevi

## 📋 Panoramica

Il sistema **Short Links** permette di trasformare URL lunghi (con token JWT) in URL corti e memorabili come `http://localhost:3000/s/j6f1HY`.

**Scopo**: Condividere link via WhatsApp/Email in modo pulito e professionale.

---

## 🏗️ Architettura

### Database Schema

model ShortUrls con campi:
- id (cuid)
- shortCode (unique, 6 caratteri alfanumerici)
- originalUrl (URL completo con token)
- workspaceId (isolamento multi-tenant)
- clicks (contatore accessi)
- isActive (flag attivo/disattivo)
- expiresAt (scadenza, default +1 ora)
- lastAccessedAt (ultimo accesso)
- createdAt, updatedAt

### Componenti Backend

**Service**: url-shortener.service.ts
- createShortUrl() - Crea short link
- resolveShortUrl() - Risolve short code → URL originale
- getShortUrlStats() - Statistiche accessi
- cleanupOldUrls() - Auto-pulizia link scaduti

**Controller**: short-url.controller.ts
- GET /s/:shortCode - Redirect 302 a URL originale
- GET /api/short-urls/:shortCode/stats - Statistiche

**Routes**: short-url.routes.ts
- Registrato in routes/index.ts PRIMA delle auth routes

---

## 🔄 Flusso Operativo

### 1. Creazione Short Link

Quando: Agent LLM chiama createOrder in CallingFunctionsService

Processo:
1. Genera codice casuale 6 caratteri (a-zA-Z0-9)
2. Verifica unicità (max 10 tentativi)
3. Salva in DB con scadenza +1 ora
4. Ottiene workspace.url
5. Costruisce URL: {workspace.url}/s/{shortCode}

### 2. Accesso Short Link

URL: http://localhost:3000/s/j6f1HY

Frontend Vite Proxy:
- Proxy /s/* verso http://localhost:3001

Backend Redirect:
1. Estrae shortCode
2. Auto-cleanup background
3. Risolve shortCode → originalUrl
4. Incrementa clicks
5. Ritorna 302 redirect

Errori:
- Not found → redirect /not-found
- Expired → redirect /expired
- Error → 500 JSON

### 3. Auto-Cleanup

Trigger: Ad ogni accesso (background async)

Elimina:
- Link con expiresAt < now()
- Link con createdAt < 1h ago

---

## 📍 Routes e Configurazione

### Backend Routes

// backend/src/routes/index.ts
import { shortUrlRoutes } from "../interfaces/http/routes/short-url.routes"
router.use(shortUrlRoutes)  // PRIMA di auth routes

### Frontend Proxy

// frontend/vite.config.ts
server: {
  proxy: {
    "/s": {
      target: "http://localhost:3001",
      changeOrigin: true
    }
  }
}

IMPORTANTE: Dopo modifica vite.config.ts → RIAVVIA frontend

---

## 🧪 Test e Debugging

### Test Manuale

# Test redirect backend
curl -v http://localhost:3001/s/j6f1HY
# Atteso: HTTP/1.1 302 Found + Location header

# Test via frontend
curl -L http://localhost:3000/s/j6f1HY

# Statistiche
curl http://localhost:3001/api/short-urls/j6f1HY/stats

### Verifiche Database

SELECT shortCode, originalUrl, clicks, expiresAt, createdAt 
FROM "ShortUrls" 
WHERE workspaceId = 'YOUR_ID'
ORDER BY createdAt DESC;

### Log Backend

grep "📎" backend/logs/*.log

Esempi:
- 📎 Short URL created: http://.../s/j6f1HY
- 📎 Resolving short URL: /s/j6f1HY
- 📎 Redirecting to: /orders-public?token=...
- 🧹 Auto-cleanup: removed 5 old short URLs

---

## ⚠️ Casi d'Uso

### Supportati

1. Order Links: /orders-public?token=xxx
2. Cart Links: /checkout?token=xxx
3. Customer Profile: /profile-public?token=xxx

### Limitazioni

1. Scadenza default: 1 ora
2. Auto-pulizia: >1h vengono eliminati
3. No analytics avanzate (solo clicks)
4. Route pubblica (validazione via workspaceId in DB)

---

## 🔧 Troubleshooting

### 404 su http://localhost:3000/s/xxx

Soluzioni:
1. Verifica backend attivo: curl http://localhost:3001/health
2. Verifica route backend: curl -v http://localhost:3001/s/xxx
3. Verifica proxy Vite in frontend/vite.config.ts
4. RIAVVIA frontend dopo modifica Vite
5. Verifica shortCode esiste in DB
6. Verifica non scaduto (expiresAt > now())

### Link scaduto troppo presto

Aumenta durata in createShortUrl:
expiresAt.setHours(expiresAt.getHours() + 24)  // 24h

### Auto-cleanup troppo aggressivo

Cambia in cleanupOldUrls():
const oneHourAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)  // 24h

---

## 📚 File Correlati

- backend/src/application/services/url-shortener.service.ts
- backend/src/interfaces/http/controllers/short-url.controller.ts
- backend/src/interfaces/http/routes/short-url.routes.ts
- backend/src/routes/index.ts
- backend/src/services/calling-functions.service.ts
- backend/prisma/schema.prisma
- frontend/vite.config.ts

---

Ultimo aggiornamento: 11 Ottobre 2025
Stato: Funzionale (richiede riavvio frontend dopo config proxy)
