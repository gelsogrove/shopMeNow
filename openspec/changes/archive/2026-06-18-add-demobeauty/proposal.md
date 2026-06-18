## Why

The echatbot.ai platform already has two franchise demos (laundry, real-estate) but lacks a beauty/wellness vertical — one of the largest WhatsApp chatbot adoption markets. Adding a beauty-center franchise demo (Demobeauty) completes the franchise trilogy, gives sales a ready-made pitch for that vertical, and validates the multi-specialist calendar architecture.

## What Changes

- **New custom chatbot module** `apps/backend/custom-demobeauty/` — beauty-center franchise bot with multi-sede support, per-sede services/prices/specialists, in-memory cart (services + products), appointment booking (email confirmation + Google Calendar event), push simulation, and operator escalation
- **New frontend landing page** `/beauty` — vertical landing page following the same structure as `/laundries` and `/real-estate`
- **New public demo route** `/demo/demobeauty` — embeds the real ChatWidget branded as Demobeauty, same pattern as `/demo/demowash`
- **New homepage tab #3** — adds Demobeauty as a third showcase tab in `HomeShowcase.tsx` alongside laundries and real-estate
- **New FAQ entries** on the landing page covering multi-calendar management and product/service catalog management

## Capabilities

### New Capabilities

- `demobeauty-chatbot`: Prompt-driven franchise chatbot for beauty centers. Multi-sede (Navigli, Isola, Monza), per-sede service catalog with prices and durations, per-sede product catalog, in-memory cart (services + products cleared on booking), appointment booking with slot availability, email confirmation, Google Calendar event creation, push notification simulation, operator escalation.
- `demobeauty-landing`: Public marketing landing page at `/beauty` with hero, problem/solution, feature grid, live demo CTA, FAQ (including multi-calendar and catalog FAQs). Follows i18n pattern of existing landing pages.
- `demobeauty-demo`: Public demo widget at `/demo/demobeauty` — same `DemoWidgetPage` component branded for Demobeauty.
- `homepage-beauty-tab`: Third showcase tab in `HomeShowcase.tsx` demonstrating the beauty-center franchise conversation flow.

### Modified Capabilities

- `homepage-showcase`: Adding a third tab (Demobeauty) to the existing two-tab showcase on the homepage.

## Impact

- **New**: `apps/backend/custom-demobeauty/` (agent.ts, state.ts, pii.ts, index.ts, settings.json, package.json, tsconfig.json, prompts/)
- **New**: `apps/frontend/src/pages/BeautyPage.tsx` + `apps/frontend/src/pages/beauty/beauty.i18n.ts`
- **Modified**: `apps/frontend/src/App.tsx` — new routes `/beauty` and `/demo/demobeauty`
- **Modified**: `apps/frontend/src/components/HomeShowcase.tsx` — third tab
- **Modified**: `apps/frontend/src/components/layout/SiteHeader.tsx` — nav link to `/beauty`
- **No DB migrations** — chatbot is fully prompt-driven, no new tables
- **No breaking changes** — existing modules untouched
