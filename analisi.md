


### Task 6 — Migliorare qualità dialogo nei prompt
**Problema**: prompt non sempre orientati a:
- follow‑up question
- summarizing user goal
- chiedere chiarimento in caso ambiguo

**Proposta**
- Aggiornare prompt in DB per:
  - chiudere sempre con domanda di intent (“Preferisci X o Y?”)
  - usare FAQ come “primary answer” per info‑only
  - evitare risposte piatte (“I can’t…”) e proporre alternative

**Acceptance criteria**
- Messaggi con ambiguità → domanda di chiarimento.
- FAQ sempre prioritarie in informativo.

**Test**
- Snapshot/semantic tests sui prompt con input ambiguo.

---

### Task 7 — Commenti nelle parti critiche del codice
**Proposta**
Aggiungere commenti sintetici su:
- `ChatEngineService` (pipeline e early return)
- `LLMRouterService` (router + sub‑agent)
- `PromptProcessorService` (ordine replacement)
- `whatsapp-webhook.controller.ts` (formati payload + lock)

**Acceptance criteria**
- Commenti brevi, focalizzati su “perché” e non “cosa”.

---

### Task 8 — Aumento copertura test sulle parti critiche
**Proposta**
Incrementare test su:
- webhook (signature + workspace mismatch)
- prompt variables replacement
- safety translation e allowed links
- routing per workspace informativo

**Test da aggiungere**
- `apps/backend/__tests__/unit/services/router-template-variables.spec.ts` (FAQ + allowed links)
- `apps/backend/__tests__/integration/whatsapp-webhook-*.spec.ts`
- `apps/backend/__tests__/unit/chat-engine/...`

---

### Task 9 — Allineamento documentazione
**Problema**: docs non aggiornate ai cambi recenti.

**Proposta**
- Aggiornare:
  - `docs/architecture/faq-system.md`
  - `docs/architecture/prompt-sources.md`
  - `docs/architecture/template-system.md`

**Acceptance criteria**
- Documentazione riflette i file reali e il flow attuale.

---

## Note sulla qualità del dialogo (priorità alta)
- L’LLM deve sempre fare **domanda di follow‑up** se la richiesta è ambigua.
- In informativo, FAQ deve essere la prima fonte, e la risposta deve **citare la FAQ** in modo naturale.
- Per ecommerce, evitare che l’LLM “inventi” prodotti: se `CATALOGO VUOTO` o no results, risposta breve + domanda.

---

## Checklist di accettazione generale
- [ ] Flusso ecommerce e informativo funzionanti e coerenti.
- [ ] Nessun keyword hardcoded che blocca multilingua.
- [ ] Webhook sicuro (HMAC + workspaceId DB‑derived).
- [ ] External link enforcement runtime.
- [ ] Test coverage aumentata nelle aree critiche.
- [ ] Documentazione allineata.
