# Frontend Review (FE)

## Scope
Analisi di best practice, codice morto, centralizzazione e flussi (state, localStorage, websocket), con suggerimenti e impatto test.

## High-level: cosa funziona bene
- Struttura con React Router e layout separati (public vs protected) in `apps/frontend/src/App.tsx`.
- React Query gia' presente per dati server-side.
- Contesti dedicati (Workspace/Chat/ChatList/Billing) per lo stato condiviso.

## Miglioramenti prioritari
### 1) Storage sparso e incoerente (localStorage/sessionStorage)
**Problema**
- Token, user, workspace, sessionId, chat selection vengono letti/scritti in molte pagine e componenti con logica duplicata.
- Uso misto di localStorage e sessionStorage per la stessa chiave (sessionId), con commenti incoerenti.
- Hard clear ripetuti in tante pagine, difficile da mantenere.

**Esempi**
- `apps/frontend/src/services/api.ts` (token/sessionId/workspaceId + clear globale su 401)
- `apps/frontend/src/pages/LoginPage.tsx` (molti clear e set)
- `apps/frontend/src/pages/WorkspaceSelectionPage.tsx` (debug e write multipli)
- `apps/frontend/src/contexts/WorkspaceContext.tsx` (write e pulizia chat storage)
- `apps/frontend/src/hooks/useWebSocket.ts` (sessionId da localStorage)
- `apps/frontend/src/contexts/ChatContext.tsx` (sessionStorage per selectedChatId)

**Suggerimento**
- Introdurre `storage.ts` con chiavi tipizzate e helper (get/set/clear).
- Centralizzare login/logout e session refresh in un singolo `AuthContext` o hook (es. `useAuthSession`).
- Decidere una sola sorgente per `sessionId` (preferibile sessionStorage se per-tab).
- Ridurre a 1-2 punti di accesso ai token (es. solo in `api.ts` e `AuthContext`).

### 2) Log sensibili in produzione
**Problema**
- L'interceptor API logga token e payload decodificato.

**Esempio**
- `apps/frontend/src/services/api.ts`

**Suggerimento**
- Rimuovere log di token e payload in produzione.
- Introdurre un flag `VITE_LOG_LEVEL` per evitare log verbosi.

### 3) WebSocket: autenticazione e gestione connessione
**Problema**
- Socket creato senza auth nel handshake; non e' chiaro se il backend valida la sessione.
- `sessionId` preso da localStorage ma commenti parlano di sessionStorage.
- Nessun "single socket manager": rischio di piu' connessioni se montato piu' volte.

**Esempio**
- `apps/frontend/src/hooks/useWebSocket.ts`

**Suggerimento**
- Passare token o sessionId in `auth` del socket (o query param) e validare server-side.
- Unificare la sorgente `sessionId`.
- Estrarre un singleton socket + context per condivisione.

### 4) Routing duplicato e percorsi non usati
**Problema**
- Rotta `/` definita due volte: una con `RootPage` e una con `Navigate`.
- Componenti importati ma non montati in route.

**Esempi**
- Doppio `/` in `apps/frontend/src/App.tsx`
- `ShortUrlRedirect` importato ma non usato: `apps/frontend/src/App.tsx`, `apps/frontend/src/pages/ShortUrlRedirect.tsx`

**Suggerimento**
- Tenere un solo route `/`.
- Rimuovere import non usati o aggiungere la route prevista.

### 5) API layer non centralizzato
**Problema**
- Alcune pagine fanno fetch manuale e leggono token dalla localStorage, bypassando `api.ts`.
- Servizi usano `any` (poca type safety).

**Esempi**
- `apps/frontend/src/pages/OrdersPage.tsx` (fetch con token)
- `apps/frontend/src/services/*.ts` (tipi `any`)

**Suggerimento**
- Usare solo `api.ts` e un set di servizi "typed".
- Definire interfacce/DTO condivise (potenzialmente da `packages/shared`).

### 6) Stato UI molto grande in singole pagine
**Problema**
- Pagine come Login/Chat/Clients gestiscono troppo stato e logica storage.

**Esempi**
- `apps/frontend/src/pages/LoginPage.tsx`
- `apps/frontend/src/pages/ChatPage.tsx`
- `apps/frontend/src/pages/ClientsPage.tsx`

**Suggerimento**
- Estrarre hook dedicati (es. `useChatSelection`, `useSessionStorageState`).
- Ridurre side effects direttamente in pagina.

## Codice morto o duplicato
Da verificare e rimuovere:
- `apps/frontend/src/components/shared/MessageRenderer.tsx.bak` (file .bak non usato)
- `apps/frontend/src/pages/debug/ProductSearchDebug.tsx` (nessuna route)
- `apps/frontend/components/ui/*` (cartella `components/` fuori da `src/`, non referenziata)
- `apps/frontend/src/pages/ShortUrlRedirect.tsx` (importato ma non montato)

## Stato, storage e flussi (raccomandazioni specifiche)
- Creare un set di chiavi storage centralizzato: `token`, `user`, `currentWorkspace`, `sessionId`, `selectedChatId`.
- Standardizzare: `sessionId` in sessionStorage; `token/user/workspace` in localStorage.
- Evitare `localStorage.clear()` in pagine singole; usare `auth.clearSession()`.
- Introdurre un `StorageEvent` custom per aggiornare contesti (gia' esiste per workspace).

## WebSocket (raccomandazioni specifiche)
- Aggiungere `auth: { token }` in `io(...)` o query params.
- Normalizzare `sessionId` source.
- Rendere la connessione singleton e riusata dai componenti.
- Aggiungere backoff o exponential retry se necessario.

## Test (impatti e suggerimenti)
Se si applicano i cambi sopra, i test da aggiornare/aggiungere:
- Login/Session flow:
  - `apps/frontend/__tests__/pages/LoginPage.GoogleOAuth.spec.tsx`
  - `apps/frontend/__tests__/pages/LoginPage.returnUrl.spec.tsx`
  - `apps/frontend/__tests__/pages/AcceptInvitePage.spec.tsx`
- Workspace selection:
  - `apps/frontend/__tests__/pages/WorkspaceSelectionPage.spec.tsx`
  - `apps/frontend/__tests__/hooks/useWorkspaceRole.spec.ts`
- Chat/storage:
  - `apps/frontend/__tests__/hooks/useLoadMoreMessages.spec.ts`
  - Aggiungere test per `useWebSocket` (events -> invalidation) e per `storage.ts` (get/set/clear).

## Next steps consigliati
1) Centralizzare storage + auth.
2) Pulire codice morto.
3) Standardizzare API layer (typed).
4) WebSocket auth + singleton.
