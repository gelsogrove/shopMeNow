## 1. Backend — custom-demobeauty module scaffold

- [x] 1.1 Adapt `state.ts` — replace machine/display fields with `service` and `cart` (services[], products[], totals); set DEFAULT_LANGUAGE to `it`
- [x] 1.2 Adapt `pii.ts` — replace CIF/NIF/PHONE_ES with CODICE_FISCALE/PHONE_IT; update CANONICAL_VENUES to Navigli/Isola/Monza
- [x] 1.3 Adapt `agent.ts` — update module name, DEFAULT_SETTINGS, email strings; remove orders.ts import; rewrite TOOLS array (remember, book_appointment, escalate_to_operator, schedule_consultation); rewrite executeTool handlers; update buildSystemPrompt assembly; update CLI strings; update chatbotFn agentChain
- [x] 1.4 Write `settings.json` — Demobeauty brand, operatorBriefingLanguage `it`, `audioOutput: true` + per-language audio voices (audio reciprocity), Italian default
- [x] 1.4b Verify escalation contract: `escalate_to_operator` → `chatbotFn` returns `shouldEscalate: true` so host sets `activeChatbot=false` (operator handoff); confirm multilingual behavior preserved from copied state.ts language block
- [x] 1.5 Write `package.json` and verify `tsconfig.json` includes all new files
- [x] 1.6 Run `npm run typecheck` in `custom-demobeauty/` — zero errors

## 2. Backend — prompts (system prompt content)

- [x] 2.1 Write `prompts/common.md` — bot identity (Demobeauty), welcome flow with sede selection, tone (warm, professional, Italian-first), slot-filling order (sede → service → slot → upsell → cart → name/phone/email), escalation template, push simulation rules, cross-sede routing rule, multilingual support
- [x] 2.2 Write `prompts/franchising.md` — franchising consultation flow (same pattern as demowash)
- [x] 2.3 Write `prompts/faqs.md` — FAQ block including: multi-calendar management, product/service catalog, cancellation policy (24h notice), payment methods, appointment duration, laser check-up
- [x] 2.4 Write `prompts/locations/navigli.md` — full catalog: Viso (pulizia 50€/50min, anti-age 70€/60min, peeling 60€/45min), Mani&Piedi (manicure 20€, semipermanente 35€, pedicure 30/40€, gel 65€), Massaggi (rilassante 60€/50min, drenante 55€/45min, scrub 45€/40min), Epilazione (gamba+inguine 35€, sopracciglia 15€, laser su preventivo), Prodotti (detergente 22€, siero 38€, crema vit.C 45€, scrub marino 28€, crema snellente 35€, olio cuticole 12€), Specialiste (Elena-viso, Martina-corpo, Sara-unghie/ciglia), Orari, Indirizzo, Capacità 3, Pagamenti
- [x] 2.5 Write `prompts/locations/isola.md` — same structure, no laser, no criolipolisi, 2 specialiste (Chiara-viso/corpo, Alessia-unghie), prezzi leggermente diversi, capacità 2
- [x] 2.6 Write `prompts/locations/monza.md` — same structure, no laser, no macchinari avanzati, 2 specialiste (Giorgia-viso, Federica-unghie/corpo), prezzi più bassi, capacità 2

## 3. Backend — smoke test

- [x] 3.1 Module + prompts load cleanly at runtime (verified via tsx import). Live REPL/`npm run demo` needs `custom-demobeauty/.env` (Andrea-managed; `.env.example` added)
- [x] 3.2 Batch test PASS: sede → service inquiry → cart → booking → email capture. Found & fixed a bug: book_appointment now refuses with `empty_cart` if the LLM skipped update_cart (event/email were empty); cart now persisted before booking
- [x] 3.3 Batch test PASS: cross-sede routing — laser at Monza → routed to Navigli (~17km) + free check-up + local ceretta alternative
- [x] 3.4 Batch test PASS: escalation — asks name first, then fires reason=payment_request briefing + hands over (shouldEscalate=true → host sets activeChatbot=false)

## 4. Frontend — landing page /beauty

- [x] 4.1 Create `apps/frontend/src/pages/beauty/beauty.i18n.ts` — Italian + English copy: hero title/subtitle, problem/solution section, 6 feature cards (sede selection, per-sede catalog, cart, calendar, push, escalation), FAQ (6 entries including multi-calendar and catalog questions), CTA texts
- [x] 4.2 Create `apps/frontend/src/pages/BeautyPage.tsx` — copy structure from `LaundriesPage.tsx`, wire to beauty.i18n, use beauty-appropriate icons (Sparkles, Calendar, ShoppingBag, Users, Bell, HeartHandshake)
- [x] 4.3 Add `/beauty` route in `App.tsx`
- [x] 4.4 Add "Beauty" link in `SiteFooter.tsx` Solutions list (i18n ×4 langs), next to Laundries and Real Estate (the verticals live in the footer, not the header)

## 5. Frontend — demo widget /demo/demobeauty

- [x] 5.1 Add `/demo/demobeauty/*` route in `App.tsx` using `DemoWidgetPage` with `chatbotId=demobeauty` (same pattern as `/demo/demowash`)

## 6. Frontend — homepage tab #3

- [x] 6.1 Add a third Demobeauty demo card to the homepage (`LoginPage.tsx`) — wordmark, subtitle (`demobeauty.subtitle` i18n ×4 langs), "Try the demo" → `/demo/demobeauty`, mirrored layout (image right) like the DemoWash card. NOTE: the homepage uses per-vertical demo cards, not HomeShowcase tabs (HomeShowcase is a single continuous conversation, left untouched)
- [x] 6.2 Brand the demo widget for the new slug: add `demobeauty` to `DemoWidgetPage.tsx` BRAND_THEMES + DEMO_ITEMS_I18N + PUSH_CASES_I18N (so `/demo/demobeauty` shows Demobeauty branding, suggestions and promo/reminder push, not a DemoWash fallback)

## 7. Final verification

- [x] 7.1 Run `npm run test:unit` — all tests pass
- [x] 7.2 Verify `/beauty` renders correctly in browser
- [x] 7.3 Verify `/demo/demobeauty` loads the chatbot widget
- [x] 7.4 Verify homepage shows the third Demobeauty demo card with working "Try the demo" link
- [ ] 7.5 Run `npm run publish` (Heroku deploy) only after all tests pass
