# TASK17-LLM-link-replacement-debug-fix

## Description
Correggere il debug step di link replacement nel ChatEngine e aggiungere test per i token e le regex.

## Example main code
```ts
// apps/backend/src/application/chat-engine/chat-engine.service.ts
if (replacementResult.success && replacementResult.response && replacementResult.response !== finalMessage) {
  debugSteps.push({ type: "link-replacement", ... })
}
```

## Tests involved
- `apps/backend/__tests__/unit/calling-functions/calling-functions.service.spec.ts`

## Tests to modify
- Aggiungere unit test per `LinkReplacementService` con varianti token (plain/markdown).
- Aggiungere test per debug step link replacement in ChatEngine.

## Acceptance criteria
- Debug step link replacement compare quando i token vengono sostituiti.
- Regex di sostituzione coperte da test.

## Verification
- BE tests: `cd apps/backend && npm run test:unit`
