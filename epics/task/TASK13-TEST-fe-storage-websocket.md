# TASK12-TEST-fe-storage-websocket

## Description
Aggiungere test FE per storage/session clearing e per gli eventi websocket che invalidano cache.

## Example main code
```ts
// apps/frontend/__tests__/hooks/useWebSocket.spec.ts
expect(queryClient.invalidateQueries).toHaveBeenCalledWith({
  queryKey: ["chat-messages", sessionId],
})
```

## Related services/models/best practices
- Testare helper storage (get/set/clear).
- Testare effetti di eventi websocket su React Query.

## Tests involved
- `apps/frontend/__tests__/hooks/useLoadMoreMessages.spec.ts`
- `apps/frontend/__tests__/services/api.interceptors.spec.ts`

## Tests to modify
- Aggiungere test per `storage.ts`.
- Aggiungere suite per `useWebSocket`.

## Acceptance criteria
- Test coprono storage helper e invalidazioni websocket.
- Nessuna regressione su login/logout e session handling.

## Verification
- FE tests: `cd apps/frontend && npm run test`
