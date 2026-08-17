# custom-demoam — architettura e garanzie

> **La legge di questo modulo è [`../CONTRACT.md`](../CONTRACT.md)** (regola 33 del contratto;
> la 34 lo rende Andrea-only: nessuno lo edita, mai). Questo documento traccia COME ogni
> regola è garantita — meccanismo, file, test che la blinda, bug che l'ha motivata.
> Da tenere allineato al codice come il gemello `custom-demorobot/docs/flow-runtime.md`
> (CLAUDE.md §16): se il meccanismo cambia e questo file no, il file è un bug.

## Il principio (regola 4: "il principio, non la toppa")

**Ogni frase che contiene un fatto ha una fonte nel sistema** — una FAQ, un nodo di flow,
una domanda del gate, la copy in settings, le parole testuali del cliente. Il modello
**traduce e classifica**; *che cosa* esce lo decide il codice. Il testo libero del modello
esiste solo dove non c'è nulla da inventare (cortesia dichiarata), e ogni violazione vista
live in questi due giorni era una porta in cui questo principio non era ancora applicato.

## Pipeline di un turno

```
host (webhook/widget)
 ├─ isBlacklisted → 410, silenzio totale (regola 25 — PRIMA di ogni salvataggio/LLM)
 ├─ channelActive → wipMessage (regole 26-27) — chatbotFn mai chiamato a canale spento
 └─ chatbotFn (agent.ts)
     ├─ sanitize / rate limit / turni max (messaggi guard da settings, regola 1A)
     ├─ resolveGreeting (state.ts) → new | returning | none      [regole 15/16/32]
     ├─ hop loop (max maxToolHops, tool_choice guidato per stato)
     │    ├─ INVARIANTE INTAKE: fatti su record + campo mancante ⇒ la risposta È
     │    │  la prossima domanda del gate, prosa scartata          [regole 2/3/7]
     │    ├─ OBBLIGO POST-INTAKE: intake completo, nessun flow ⇒ hop forzato
     │    │  con soli start_flow | escalate_to_operator            [regole 5/9]
     │    ├─ verify FAQ (solo turni senza nulla di pendente): 3 esiti dichiarati,
     │    │  ognuno con conseguenza meccanica                      [regole 6/8]
     │    └─ tool: ogni rifiuto detta la mossa successiva (force_tool/dictates_text)
     └─ assemblaggio: withGreeting(body) — saluto tradotto dalla chiamata isolata
```

## Garanzie di codice (regola → meccanismo → blindato da)

| Regola | Meccanismo | Dove | Test | Origine |
|---|---|---|---|---|
| 2/3 — mai inventare | invariante intake: prosa scartata, domanda dettata da settings | `agent.ts` free-text exit + `midIntakePendingQuestion` | `demoam-guarantees.spec` + scenari 06-generic, 07-hs | 16-17/08: "il ronzio viene dalle lame" |
| 2 — nemmeno all'operatore | briefing = parole del cliente **testuali** (`customerVerbatim`), mai il summary del modello | `briefing.ts`, `formatOperatorBriefing` | `demoam-guarantees.spec` (verbatim + grep) | 17/08: guida RUOTE inventata per domanda LAME |
| 5/9 — routing flow/human | obbligo post-intake: hop con soli `start_flow`/`escalate` (`curatedTools`) | `agent.ts` | grep enum + scenari 05-flow/03, 07-hs/01 | 16/08: "Ora mi serve capire da dove viene il ronzio" (stallo) |
| 6 — FAQ dal tool | `answer_from_faq` + giudice di rilevanza (default **SÌ**: contenuto approvato; NO solo se il messaggio non chiede nulla o tema chiaramente diverso) + `composeFaqReply` sostituisce la prosa | `agent.ts` | scenari 03-faq/01..07 | 16/08 FAQ inventate; 17/08 falso negativo "assicurazione" |
| 8 — FAQ non trovata | `question_no_faq` dichiarato ⇒ escalate forzato, mai seriale | verify a 3 esiti, `agent.ts` | grep + scenario 03-faq/02 | 17/08: loop sul seriale |
| 11 — nome sempre | `name` escluso dal cap `maxAsks`; checklist `no_device: [name]` | `gate.ts` `nextPreOperatorAction` | `demoam-guarantees.spec` | 16/08: "Thank you, ." / "Name: —" |
| 11/18 — handoff garantito | `pendingEscalationReason` (state): il `remember` che completa la checklist forza `escalate_to_operator` nello stesso turno | `state.ts` + `agent.ts` remember handler | scenario 07-hs/01 | 17/08: diagnosi inventata al posto dell'handoff |
| 12/13/30 — flow sacro | tool ristretti mid-flow (`tool_choice: required`), FAQ mid-flow ridettata dal grafo, LOOP cap, guard codici errore (fail-open, solo contraddizione dura) | `agent.ts`, `gate.ts`, `flow-machine.ts` | scenari 05-flow/01..09 | vedi commenti datati nei file |
| 14 — seriale 19 char, 3 tentativi | `validateSerialNumber` (pattern da settings), `serialNumberExhausted` | `content-guards.ts` | `demoam-gate.spec` + 04-serial/01-02 | — |
| 15/16/32 — saluti | `resolveGreeting` (2h) + `withGreeting`: saluto tradotto dalla **chiamata isolata** che non vede mai il messaggio del cliente | `state.ts` + `agent.ts` | `demoam-guarantees.spec` + 01-welcome/01..08 | 17/08: scusa inventata dentro "Bentornato Pinotto" |
| 19 / 1A — copy da configurazione | placeholder workspace (`{{chatbotName}}` ecc.) sostituiti da `renderWorkspaceCopy` (host, per turno; `{{customerName}}` resta al modulo) | `src/application/services/workspace-copy.render.ts` | `demoam-guarantees.spec` | 17/08: `{{chatbotName}}` nudo a un cliente |
| 20/21 — lingue | tag `⟦LANG:xx⟧` deciso dal modello (mai detector nel codice, §14), filtrato da `resolveEnabledLanguage`, re-render forzato se fuori lista | `state.ts`, `agent.ts` | 01-welcome/02-03-07, 03-faq/06 | 06/08: cliente danese |
| 23 — stato anti-"sì/ok" | nodo pendente = risposte ammesse dal grafo (`advance` rifiuta), intake ordinato da `INTAKE_ORDER`, escalation solo deliberata | `gate.ts`, `flow-machine.ts` | 03-faq/03 + `demoam-flow-machine.spec` | 16/08: "grazie" → escalation |
| — hop esauriti | il fallback ripropone la domanda pendente (`pendingQuestionText`); **mai** escalation | `agent.ts` | grep in `demoam-guarantees.spec` | 16/08 |

## Zona dichiaratamente probabilistica (sorvegliata, non eliminabile — §14)

- **Classificazione iniziale** (reclamo / guasto / domanda): la fa l'LLM. Sentinelle:
  01-welcome/06, 07-hs/03.
- **Match semantico del flow**: recall dipende da titolo/description/keywords nel flow
  builder — la leva è **dati**, non codice (es. sintomo colloquiale ⇒ arricchire keywords).
- **Giudice di rilevanza FAQ**: LLM isolato sì/no; calibrato default-SÌ. Sentinelle:
  03-faq/03 (il NO che deve restare), 03-faq/06-07 (i SÌ che devono restare).
- **Resa dei nodi flow**: il modello può aggiungere colore ("il problema è critico") —
  papercut noto, non ancora chiuso (comporterebbe comporre i nodi lato codice come le FAQ).

## Costi (lezione del 16/08: €15 in un giorno)

- Cache Anthropic: **minimo 4096 token** per Haiku 4.5 ⇒ un solo breakpoint DOPO i blocchi
  statici (prompt+FAQ+flow); TTL 5m (il write 1h costa più di quanto rende); il set di
  `tools` precede tutto nel prefisso — cambiarlo invalida la cache.
- Un messaggio cliente ≈ 2-4 chiamate (~$0,015). Suite completa ≈ $3.
- **Policy run**: CLAUDE.md §16A — dichiarare costo e aspettare OK, mai suite completa per
  verificare un fix, stop sui 402.

## Come si verifica

```bash
# gratis — 7 suite, 100+ lock strutturali
npm run test:unit -- demoam-

# a pagamento — scenari CLI contro LLM+Supabase reali (OGNI scenario dichiara
# la regola del CONTRACT che verifica nel campo contractRule)
DATABASE_URL="$(heroku config:get DATABASE_URL -a echatbot-app)" \
OPENROUTER_API_KEY="$(heroku config:get OPENROUTER_API_KEY -a echatbot-app)" \
  npx tsx --tsconfig custom-demoam/tsconfig.json custom-demoam/cli/run-scenarios.ts [filtro]
```

I log di produzione tracciano ogni decisione (`[demoam][faq-verify|faq-compose|faq-reject|
intake-dictated|post-intake-obligation|escalation|greeting]`): un transcript anomalo si
diagnostica da `heroku logs`, non a tentativi.
