## Context

The project has two working franchise chatbot demos: `custom-demowash` (laundry) and a real-estate variant. Both follow an identical architectural pattern: a standalone TypeScript module (`agent.ts`, `state.ts`, `pii.ts`) with prompt-driven LLM, cached system prompt assembled from markdown files, in-memory session state, injectable tool handlers, and no database dependency.

The frontend has two vertical landing pages (`/laundries`, `/real-estate`) and two demo widget routes (`/demo/demowash`, `/demo/demorealestate`), plus a two-tab homepage showcase. Demobeauty adds a third vertical following every existing pattern exactly — new module, new landing page, new demo route, new homepage tab.

The beauty-center domain introduces two new concepts not present in the other demos:
1. **In-memory cart** — customer accumulates services + products across turns; clears on booking
2. **Multi-specialist slot logic** — each sede has N specialists with service-category assignments; a slot is available only when the right specialist is free

## Goals / Non-Goals

**Goals:**
- New `custom-demobeauty/` module following demowash architecture exactly (no new patterns)
- Three demo sedes with different service catalogs, prices, specialists, and capacities
- In-memory cart (services + products) cleared on booking confirmation
- Appointment booking: slot selection → email + name + phone + email collection → calendar event creation → email confirmation sent
- Push notification simulation: new products, new services, new sede, appointment reminders
- Operator escalation for payments, complaints, explicit requests
- Welcome flow identical to other chatbots: greeting → sede selection → service
- `/beauty` landing page with FAQ covering multi-calendar and catalog management
- `/demo/demobeauty` public demo widget
- Homepage third tab in `HomeShowcase.tsx`

**Non-Goals:**
- Real Google Calendar integration (demo uses simulated slots; production handler is injectable)
- Real payment processing
- Per-specialist sub-calendars (production concern; demo simulates capacity with fixed slots)
- Database changes of any kind
- Modifying `custom-demowash` or `custom-demorealestate`

## Decisions

### D1: Reuse demowash infrastructure verbatim
Copy `agent.ts`, `state.ts`, `pii.ts`, `index.ts`, `tsconfig.json` from `custom-demowash` and adapt only domain-specific parts. **Why**: the architecture is proven, CLAUDE.md iron rules apply equally, and diverging would create maintenance burden.

Alternative considered: start from scratch. Rejected — the orchestration code (concurrency lock, PII pipeline, LLM call with caching, tool dispatch loop, REPL/batch CLI) is ~1600 lines of battle-tested code with no reason to rewrite.

### D2: SessionState cart — pure in-memory, no persistence
Cart lives in `SessionState.cart` (services array + products array + totals). On `book_appointment` tool success: cart merges into calendar event description and is set to `null`. **Why**: no DB, consistent with existing state model, matches user requirement explicitly.

### D3: Slot availability — simulated in demo, injectable in production
Demo: `getBeautySlots(now, sede)` returns hardcoded available slots per sede (some marked "taken" to demo the "slot non disponibile" flow). Production: host injects `checkAvailability` handler that queries Google Calendar. **Why**: same pattern as `schedule_consultation` in demowash (injectable handler, demo fallback).

### D4: One Google Calendar for the whole franchise (production architecture)
There is a SINGLE franchise calendar. Each appointment is one event tagged `[SEDE][CATEGORIA][SPECIALISTA]` in the title, with client + services + products in the description. Each center filters to its own events (by sede tag); the franchisor sees the whole network. Availability = count events in a time window for that sede tag vs sede capacity. **Why**: Andrea's final acceptance criterion ("un calendario per tutto il franchising"); one calendar is simpler to operate and still gives per-center filtering via tags. Note: services/prices/hours/specialists are per-sede, but the **product catalog is shared network-wide** (same products and prices everywhere).

### D5: PII — Italian patterns replace Spanish
`CODICE_FISCALE_RE` replaces `CIF_RE`/`NIF_RE`. `PHONE_IT_RE` (+39, 3xx numbers) replaces `PHONE_ES_RE`. IBAN and card patterns unchanged. Venue backstop uses `['Navigli', 'Isola', 'Monza']`.

### D6: Language default Italian
`DEFAULT_LANGUAGE = 'it'` in `state.ts`. Operator briefing language in `settings.json` set to `'it'`.

### D7: Tools — 4 tools (remove tintoria/order, add book_appointment)
- `remember({name, location, service})` — merge semantics, no machine/display fields
- `book_appointment({services, products, slotIndex})` — books slot, sends email, creates calendar event, clears cart
- `escalate_to_operator({reason, summary})` — unchanged pattern
- `schedule_consultation({slotIndex})` — kept for franchising demo flow (same as demowash)

### D9: Multilingual, audio reciprocity, and operator handoff come from the host contract
These three behaviors are NOT new code — they are already provided by the demowash architecture and the host pipeline:
- **Multilingual**: the LLM detects language and emits the `⟦LANG:xx⟧` trailer (state.ts), copied verbatim. No fixed language list.
- **Audio reciprocity**: `settings.json` sets `audioOutput: true` + per-language voices; the host mirrors input modality (text→text, audio→audio).
- **Operator handoff**: `escalate_to_operator` makes `chatbotFn` return `shouldEscalate: true`; the host pipeline then sets `activeChatbot = false` for that customer ([whatsapp-inbound.pipeline.ts](apps/backend/src/services/whatsapp/whatsapp-inbound.pipeline.ts) line ~634), routing further messages to the operator.

**Why**: keeping these as host-contract behaviors (not module-local logic) means Demobeauty behaves identically to demowash/demorealestate with zero extra code — only `settings.json` config and the escalation tool are needed.

### D8: Frontend — reuse existing page component pattern
`BeautyPage.tsx` copies `LaundriesPage.tsx` structure with beauty-specific i18n. Route `/beauty` added to `App.tsx`. Demo route `/demo/demobeauty` uses existing `DemoWidgetPage` with `chatbotId=demobeauty`. Homepage tab uses existing tab pattern in `HomeShowcase.tsx`.

## Risks / Trade-offs

- **Cart state lost on server restart** → Acceptable for demo; production would use Redis
- **Simulated slots don't reflect real calendar** → Demo limitation, clearly labeled; injectable handler resolves in production
- **agent.ts duplication** → ~1600 lines copied; kept intentionally separate so each custom can evolve independently without breaking others (existing pattern)
- **Multi-specialist assignment not in bot** → Operator assigns specialist after receiving booking; bot only confirms date/time. Acceptable for v1.

## Migration Plan

1. Deploy `custom-demobeauty/` module (no DB changes, no config changes to existing workspaces)
2. Deploy frontend changes (new routes, new tab — purely additive)
3. Register `demobeauty` workspace in DB (Andrea does manually, same as demowash)
4. No rollback complexity — all changes are additive

## Open Questions

- None. All decisions confirmed with Andrea in explore session.
