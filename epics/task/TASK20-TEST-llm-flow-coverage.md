# TASK20-TEST-llm-flow-coverage

## Description
Aggiungere test mirati per il flow LLM: auto-delegation, translation wrapper, link replacement e timeline.

## Example main code
```ts
// apps/backend/__tests__/unit/flows/llm-flow.spec.ts
expect(debugInfo.steps.some((s) => s.type === "safety" || s.agent?.includes("Translation"))).toBe(true)
```

## Tests involved
- `apps/backend/__tests__/unit/flows/message-timeline-tracking.spec.ts`

## Tests to modify
- Aggiungere suite per:
  - auto-delegation + link replacement
  - applyTranslation wrapper (ChatEngine)
  - token replacement variations

## Acceptance criteria
- I flussi principali LLM sono coperti da test unit o integration.
- Timeline debug verificata per step essenziali.

## Verification
- BE tests: `cd apps/backend && npm run test:unit`
