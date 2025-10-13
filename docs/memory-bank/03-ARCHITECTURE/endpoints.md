# Frontend Endpoints Mapping

Lista completa degli endpoint API chiamati dal frontend

## 🚨 WORKSPACE ISOLATION POLICY (OBBLIGATORIO)

**TUTTI gli endpoint richiedono `workspaceId` come parametro obbligatorio**, eccetto:

- Endpoints in sezione "SIN WORKSPACEID parameters" (in fondo al documento)
- Public endpoints con token (`/api/internal/*`)
- Webhook esterni (`/api/whatsapp/webhook`)

**Se workspaceId manca**: L'endpoint DEVE lanciare eccezione `400 Bad Request`:

```json
{
  "error": "Workspace ID is required",
  "message": "Missing required parameter: workspaceId"
}
```

---

## Auth

- `POST /api/auth/logout` - Logout utente

## Users

- `GET /api/auth/me` - Dati utente corrente
- `PUT /api/workspaces/:workspaceId/users/profile` - Aggiorna profilo

## Products

- `GET /api/workspaces/:workspaceId/products` - Lista prodotti
- `GET /api/workspaces/:workspaceId/products/:id` - Dettaglio prodotto
- `POST /api/workspaces/:workspaceId/products` - Crea prodotto
- `PUT /api/workspaces/:workspaceId/products/:id` - Aggiorna prodotto
- `DELETE /api/workspaces/:workspaceId/products/:id` - Elimina prodotto

## Categories

- `GET /api/workspaces/:workspaceId/categories` - Lista categorie
- `GET /api/workspaces/:workspaceId/categories/:id` - Dettaglio categoria
- `GET /api/workspaces/:workspaceId/categories/:id/products` - Prodotti categoria
- `POST /api/workspaces/:workspaceId/categories` - Crea categoria
- `PUT /api/workspaces/:workspaceId/categories/:id` - Aggiorna categoria
- `DELETE /api/workspaces/:workspaceId/categories/:id` - Elimina categoria

## Services

- `GET /api/workspaces/:workspaceId/services` - Lista servizi
- `GET /api/workspaces/:workspaceId/services/:id` - Dettaglio servizio
- `POST /api/workspaces/:workspaceId/services` - Crea servizio
- `PUT /api/workspaces/:workspaceId/services/:id` - Aggiorna servizio
- `DELETE /api/workspaces/:workspaceId/services/:id` - Elimina servizio

## Orders

- `GET /api/workspaces/:workspaceId/orders` - Lista ordini
- `GET /api/workspaces/:workspaceId/orders/:id` - Dettaglio ordine (by ID)
- `GET /api/workspaces/:workspaceId/orders/code/:code` - Dettaglio ordine (by code)
- `GET /api/workspaces/:workspaceId/orders/customer/:customerId` - Ordini di un cliente
- `GET /api/workspaces/:workspaceId/orders/analytics` - Analytics ordini
- `GET /api/workspaces/:workspaceId/orders/date-range` - Ordini per date range
- `POST /api/workspaces/:workspaceId/orders` - Crea ordine
- `PUT /api/workspaces/:workspaceId/orders/:id` - Aggiorna ordine
- `DELETE /api/workspaces/:workspaceId/orders/:id` - Elimina ordine
- `PATCH /api/workspaces/:workspaceId/orders/:id/status` - Aggiorna stato ordine

## Public Orders (con token)

**NOTA**: Questi endpoint NON richiedono workspaceId - è incluso nel token JWT

- `GET /api/internal/orders/:token` - Accesso ordini via token (workspaceId nel token)
- `GET /api/internal/invoices/:token` - Accesso fatture via token (workspaceId nel token)
- `GET /api/internal/shipments/:token` - Accesso spedizioni via token (workspaceId nel token)
- `POST /api/internal/validate-secure-token` - Valida secure token

## Customers

- `GET /api/workspaces/:workspaceId/customers` - Lista clienti
- `GET /api/workspaces/:workspaceId/customers/:id` - Dettaglio cliente
- `POST /api/workspaces/:workspaceId/customers` - Crea cliente
- `PUT /api/workspaces/:workspaceId/customers/:id` - Aggiorna cliente
- `DELETE /api/workspaces/:workspaceId/customers/:id` - Elimina cliente
- `POST /api/workspaces/:workspaceId/customers/block/:id` - Blocca cliente

## Sales

- `GET /api/workspaces/:workspaceId/sales` - Lista vendite
- `GET /api/workspaces/:workspaceId/sales/:id` - Dettaglio vendita
- `GET /api/workspaces/:workspaceId/sales/customer/:customerId` - Vendite cliente
- `POST /api/workspaceId/sales` - Crea vendita
- `PUT /api/workspaces/:workspaceId/sales/:id` - Aggiorna vendita
- `DELETE /api/workspaces/:workspaceId/sales/:id` - Elimina vendita

## FAQs

- `GET /api/workspaces/:workspaceId/faqs` - Lista FAQ
- `GET /api/workspaces/:workspaceId/faqs/:id` - Dettaglio FAQ
- `POST /api/workspaces/:workspaceId/faqs` - Crea FAQ
- `PUT /api/workspaces/:workspaceId/faqs/:id` - Aggiorna FAQ
- `DELETE /api/workspaces/:workspaceId/faqs/:id` - Elimina FAQ

## Agent Configuration

- `GET /api/workspaces/:workspaceId/agent` - Lista agenti
- `GET /api/workspaces/:workspaceId/agent/:id` - Dettaglio agente
- `POST /api/workspaces/:workspaceId/agent` - Crea agente
- `PUT /api/workspaces/:workspaceId/agent/:id` - Aggiorna agente
- `DELETE /api/workspaces/:workspaceId/agent/:id` - Elimina agente

## Chat

- `GET /api/workspaces/:workspaceId/chat/recent` - Chat recenti
- `GET /api/workspaces/:workspaceId/chat/:customerId/history` - Storico chat
- `POST /api/workspaces/:workspaceId/chat/send` - Invia messaggio
- `POST /api/whatsapp/webhook` - Webhook WhatsApp (senza auth - ECCEZIONE: no workspaceId required)

## Cart & Checkout

- `POST /api/workspaces/:workspaceId/cart-tokens` - Genera token carrello
- `GET /api/workspaces/:workspaceId/cart-tokens/:token/validate` - Valida token carrello
- `POST /api/workspaces/:workspaceId/cart/generate-token` - Genera token carrello
- `POST /api/workspaces/:workspaceId/cart/add` - Aggiungi al carrello
- `PUT /api/workspaces/:workspaceId/cart/item` - Aggiorna item carrello
- `DELETE /api/workspaces/:workspaceId/cart/item/:id` - Rimuovi item carrello
- `DELETE /api/workspaces/:workspaceId/cart/clear` - Svuota carrello
- `GET /api/workspaces/:workspaceId/cart/summary` - Riepilogo carrello
- `POST /api/workspaces/:workspaceId/cart/checkout` - Checkout carrello

## Analytics

- `GET /api/analytics/:workspaceId/dashboard` - Dashboard analytics
- `GET /api/analytics/:workspaceId/detailed` - Metriche dettagliate
- `GET /api/analytics/:workspaceId/monthly-top-customers` - Top clienti mensili

## Settings

- `GET /api/workspaces/:workspaceId/settings/gdpr` - Impostazioni GDPR
- `PUT /api/workspaces/:workspaceId/settings/gdpr` - Aggiorna GDPR
- `GET /api/workspaces/:workspaceId/gdpr/default` - Contenuto GDPR default

---

## 🔓 ECCEZIONI - ENDPOINTS SENZA WORKSPACEID OBBLIGATORIO

Gli unici endpoint che NON richiedono workspaceId sono:

## Public Access (No Auth Required)

- `POST /api/registration/register` - Registrazione nuovo utente
- `POST /api/auth/login` - Login utente
- `GET /api/health` - Health check
- `POST /api/whatsapp/webhook` - Webhook WhatsApp

## Workspace Management (Pre-Auth)

- `GET /api/workspaces` - Lista workspace (dopo login)
- `GET /api/workspaces/current` - Workspace corrente
- `GET /api/workspaces/:id` - Dettaglio workspace
- `POST /api/workspaces` - Crea workspace
- `PUT /api/workspaces/:id` - Aggiorna workspace
- `DELETE /api/workspaces/:id` - Elimina workspace

## User Profile (Global Scope)

- `GET /api/auth/me` - Dati utente corrente (cross-workspace)
- `POST /api/users/change-password` - Cambia password (global)

## Utilities

- `GET /api/languages` - Lista lingue disponibili (global)

## Public Token-Based Access

- `GET /api/internal/orders/:token` - Accesso ordini via token (no workspaceId - workspace nel token)
- `GET /api/internal/invoices/:token` - Accesso fatture via token
- `GET /api/internal/shipments/:token` - Accesso spedizioni via token
- `POST /api/internal/validate-secure-token` - Valida secure token

---

**NOTE**:

- Per tutti gli altri endpoint NON listati sopra, `workspaceId` è **OBBLIGATORIO**
- Se manca, il backend DEVE rispondere con `400 Bad Request: "Workspace ID is required"`
- Questa policy garantisce **workspace isolation** e previene data leakage tra tenant
