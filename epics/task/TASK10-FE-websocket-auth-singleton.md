# TASK03-FE-websocket-auth-singleton

## Description
Aggiungere auth al handshake Socket.io e trasformare la connessione in singleton condivisa per evitare connessioni multiple e incoerenze di sessionId.

## Example main code
```ts
// apps/frontend/src/hooks/useWebSocket.ts
const socket = io(socketUrl, {
  auth: { token: storage.getToken(), sessionId: storage.getSessionId() },
  transports: ["websocket", "polling"],
})
```

## Related services/models/best practices
- Validare token/sessionId anche lato backend.
- Unificare sessionId source (sessionStorage consigliato).
- Condividere socket via context/singleton.

## Tests involved
- (da aggiungere) test hook `useWebSocket` con invalidation events.

## Tests to modify
- Aggiungere test per handshake auth e event handling.

## Acceptance criteria
- Socket usa auth in handshake.
- Una sola connessione per workspace attivo.
- Eventi invalidano cache senza duplicazioni.

## Verification
- FE build: `cd apps/frontend && npm run build`
- FE tests: `cd apps/frontend && npm run test`
