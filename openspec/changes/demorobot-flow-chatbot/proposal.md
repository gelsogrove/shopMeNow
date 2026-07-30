## Why

demoRobot (nuovo cliente, supporto tecnico robotica) ha centinaia di casi diagnostici attesi, contro le ~30 di demowash — troppi per stare tutti in un unico prompt sempre cachato (limite pratico ~150 elementi, `architecture.md §15` di demowash). Serve un modo per un utente non tecnico di autorare centinaia di procedure diagnostiche senza scrivere markdown a mano, e un meccanismo runtime che selezioni dinamicamente solo il flow pertinente da iniettare nel prompt, mantenendo intatto il principio "la logica vive nel prompt, non nel codice" già stabilito da `custom-demowash`.

## What Changes

- Nuovo modulo custom chatbot `custom-demorobot`, stesso turn loop/PII redaction/lingua sticky/tool-pattern di `custom-demowash`, channel `widget`.
- Nuovo editor visuale a grafo (React Flow) in `apps/frontend`, sezione settings del workspace: CRUD di `RobotModel` → CRUD di `Flow` per modello → canvas nodi/risposte/allegati, con pannello laterale per l'editing dei contenuti dei nodi.
- Nuovo compilatore grafo→prompt: da nodi/edge produce `compiledPrompt` (markdown per l'esecuzione LLM) e `retrievalDocument` (testo denso per l'embedding), con validazione del grafo, hash deterministico, estrazione allegati referenziati.
- Nuovo layer di retrieval a due passi: lookup deterministico `serialNumber → RobotModel` (formato TBD/pluggable, vedi Non-goals), poi ricerca semantica per embedding (via endpoint OpenRouter `/api/v1/embeddings`) sui `Flow` di quel modello, aggancio del solo miglior candidato sopra soglia a `SessionState.activeFlowId`.
- Nuovo data model: `RobotModel`, `Flow`, `FlowNode`, `FlowEdge`, `Asset`, `FlowNodeAttachment` — tutti workspace-scoped, coerenti con l'isolamento multi-tenant CLAUDE.md §2.
- Ciclo di vita del Flow a stadio singolo: un solo "Salva" esegue compile+validate+(se valido) pubblicazione immediata, nessun draft/publish/preview separato.
- Escalation verso operatore riusando il tool `escalate_to_operator` già esistente in demowash (nodemailer/SMTP), con `reason` distinti (check OK, `unknown_model`, `no_matching_flow`, `emergency`) ed escalation anche a livello di singola risposta (`FlowEdge.triggersEscalation`), non solo sul nodo terminale.
- Allegati (documenti/immagini/video/link) trattati esclusivamente come materiale di consegna al cliente — **mai** knowledge base indicizzata/embeddata per l'LLM.
- Log diagnostici strutturati (`RetrievalEvent`) per ogni esecuzione del retrieval, a copertura del gap di osservabilità esistente (nessun modulo custom oggi popola `ChatbotOutput.meta.debug`).
- Seed di sviluppo (dati fixture, non import dati reali cliente): un `RobotModel` demo con tre `Flow` che coprono i pattern strutturali distinti (escalation finale, self-service puro, escalation su singola risposta intermedia) più il flow generico di fallback.

## Non-goals

- **Lookup `serialNumber → RobotModel` con formato definitivo**: bloccante per l'implementazione reale, richiede dati dal cliente demoRobot non ancora disponibili. Questa proposta tratta il lookup come un'interfaccia pluggable (`lookupRules` su `RobotModel`) con un'implementazione minima placeholder (validazione lunghezza ≥12 caratteri + match esatto/prefisso su dati seed) — non risolve il formato reale, che resta un follow-up.
- **Import/onboarding dei dati tecnici reali del cliente** (manuali, anagrafica seriali venduti): distinto dal seed di sviluppo, fuori scope qui.
- **Retrieval o embedding sul contenuto dei documenti allegati**: esplicitamente escluso per principio (§8 di `analisi.md`), non solo rimandato.
- **Riuso del flow-builder come componente generico multi-cliente**: il design lo rende possibile (compilatore/retrieval parametrizzati per `workspaceId`), ma questa proposta consegna solo l'attivazione per demoRobot, non un catalogo di template cross-cliente.
- **RBAC granulare** (chi modifica flow vs chi gestisce asset vs chi vede analytics): solo la sicurezza a 3 livelli standard della piattaforma; ruoli specifici del dominio flow restano un follow-up.
- **Storico versioni / rollback dei Flow**: solo lo snapshot leggero per-sessione (`activeFlowPromptSnapshot`), nessun `FlowVersion` storico.
- **Provisioning del widget per il nuovo workspace demoRobot**: riusa il meccanismo esistente di demowash, non richiede nuovo lavoro di piattaforma in questa proposta.

## Capabilities

### New Capabilities
- `flow-graph-editor`: editor visuale React Flow in `apps/frontend` — CRUD `RobotModel`/`Flow`, canvas nodi/risposte con creazione automatica nodo figlio, pannello laterale di editing, gestione allegati per nodo.
- `flow-compiler`: compilazione deterministica di un grafo (nodi+edge) in `compiledPrompt` + `retrievalDocument`, con validazione, hash, estrazione allegati, warning non bloccanti.
- `flow-retrieval`: risoluzione runtime del flow da agganciare — lookup deterministico serial→modello, ricerca semantica per embedding scoped al modello, contratto topK/threshold, log diagnostici strutturati.
- `demorobot-chatbot-runtime`: modulo `custom-demorobot` — turn loop, composizione prompt (fisso + session state + flow agganciato), escalation verso operatore, regole emergenza, multilingua.

### Modified Capabilities
_Nessuna — verificato in `openspec/specs/`, nessuna capability esistente (`demobeauty-*`, `homepage-beauty-tab`, `survey-page-presentation`) è pertinente a demoRobot._

## Impact

- **Nuovo codice**: `apps/backend/custom-demorobot/` (modulo chatbot), componenti condivisi di compilatore/retrieval (collocazione da definire in design.md — probabile pacchetto condiviso, non specifico di demoRobot, per riuso futuro), `apps/frontend` nuova sezione settings + rotta canvas a schermo intero.
- **Database**: nuove tabelle Prisma `RobotModel`, `Flow` (con colonna vettoriale `embedding`, es. `pgvector`), `FlowNode`, `FlowEdge`, `Asset`, `FlowNodeAttachment`; nuova migration; nessuna modifica a tabelle esistenti.
- **API esterne**: nessun nuovo provider — usa OpenRouter (già configurato) per chat completion ed embedding (`/api/v1/embeddings`), coerente con CLAUDE.md (mai OpenAI diretto).
- **Dipendenze**: nuova libreria `@xyflow/react` (MIT) nel frontend.
- **Swagger**: nuovi endpoint CRUD per `RobotModel`/`Flow`/nodi/edge/asset da documentare in `backend/src/swagger.yaml`.
- **Nessun impatto** su `custom-demowash` o altri chatbot esistenti — modulo isolato, nessuna modifica a codice condiviso già funzionante salvo l'estrazione di compilatore/retrieval come componenti riusabili (design.md definirà se estratti fin da subito o mantenuti dentro `custom-demorobot` per la prima iterazione).
