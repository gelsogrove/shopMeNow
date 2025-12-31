# TASK11-TEST-security-coverage

## Description
Aggiungere test di sicurezza per route pubbliche sensibili, websocket auth e rate limiting.

## Example main code
```ts
// apps/backend/__tests__/security/public-endpoints.security.test.ts
it("rejects unauthenticated access", async () => {
  const res = await request(app).get("/workspaces/current")
  expect(res.status).toBe(401)
})
```

## Related services/models/best practices
- Testare access control su ogni endpoint critico.
- Verificare handshake websocket con token/session.

## Tests involved
- `apps/backend/__tests__/security/*`

## Tests to modify
- Aggiungere nuove suite per public endpoints, websocket auth, rate limiting.

## Acceptance criteria
- Test falliscono se endpoint critici sono pubblici.
- Copertura minima per websocket handshake.

## Verification
- BE tests: `cd apps/backend && npm run test:security`
