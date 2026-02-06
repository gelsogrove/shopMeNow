# 001-waapi-client

## Goal
Implement a WaAPI API client wrapper for instance lifecycle. This should centralize authorization, error handling, and payload validation.

## Endpoints (Docs)
- Create instance
- Retrieve instance
- Update instance
- Delete instance
- QR event webhook payload parsing

## Critical Code Example
```ts
const headers = {
  Authorization: `Bearer ${WAAPI_API_TOKEN}`,
  "Content-Type": "application/json",
};

await fetch(`${WAAPI_BASE}/api/v1/instances`, {
  method: "POST",
  headers,
  body: JSON.stringify(payload),
});
```

## Error Handling Rules
- Retry on transient errors (5xx/timeout).
- Log full context (workspace id, instance id, provider).
- Never leak tokens in logs.

## Acceptance Criteria
1. Client supports create/retrieve/update/delete instance calls.
2. Errors are logged with enough context for debugging.
3. No API tokens are stored in DB.
4. Build and tests pass.
5. Documentation updated.

## Build/Test/Coverage
- Backend build succeeds.
- Unit tests cover client success/failure.
