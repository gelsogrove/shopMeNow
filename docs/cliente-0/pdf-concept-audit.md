# Cliente-0 PDF Concept Audit

Questo file mappa i concetti emersi dai PDF Cliente-0 verso:
- flow JSON tecnici
- FAQ / policy source
- scenari
- gap ancora aperti

Scopo:
- verificare se i concetti dei PDF sono davvero entrati nel sistema
- distinguere tra `Covered`, `Partial`, e `Gap`
- evidenziare nero su bianco dove il demo non e' ancora allineato alle fonti

PDF unici auditati in questa prima passata:
- `docs/cliente-0/pdf/Ecolaundry Chatbot Playbook.pdf`
- `docs/cliente-0/pdf/Ecolaundry Chatbot Playbook (6).pdf`
- `docs/cliente-0/pdf/PROGRAMES.pdf`
- `docs/cliente-0/pdf/SOLUCIÓ-DE-PROBLEMES-RENTADORES.pdf`
- `docs/cliente-0/pdf/SOLUCIÓN-DE-PROBLEMAS-SECADORAS.pdf`

Nota duplicati:
- `PROGRAMES (1).pdf` e `PROGRAMES.pdf` hanno lo stesso checksum, quindi sono duplicati.

Legenda:
- `Covered` = concetto presente e mappato in modo credibile
- `Partial` = concetto presente ma non ancora completo, o con wording/policy non chiusi bene
- `Gap` = concetto assente o non tracciabile in modo affidabile

---

## 1. Playbook Global Rules

| PDF concept | Expected owner | Current mapping | Status | Notes |
|---|---|---|---|---|
| Ridurre la frustrazione del cliente | Conversation History | `prompt3-history.md`, `demo/prompt_history.txt` | Partial | Regola presente, ma non ancora verificata in tutti i rami multi-turno |
| Istruzioni semplici e una per una | Conversation History + Flow Engine | History prompt + JSON steps | Partial | Alcuni rami restano ancora verbosi o con piu' di una richiesta implicita |
| Escalare se ambiguo, incoerente o con validazione umana | Router + Specialists + Flow Engine | `compliance-checklist.md`, JSON terminal nodes | Partial | Timing migliorato, ma non ancora coperto da test eseguibili completi |
| Non improvvisare compensazioni | Conversation History + policy source | History prompt | Covered | Regola esplicita; il bot oggi tende a non promettere compensazioni |
| Non accusare mai d'estafa | Conversation History | History prompt | Covered | Regola esplicita |
| Frasi corte, una domanda ogni volta, max 3 istruzioni | Conversation History | History prompt | Partial | Regola scritta, ma non ancora dimostrata in ogni branch |
| Prima tranquillizzare, poi diagnosticare, poi risolvere | Conversation History | History prompt | Partial | Tendenza corretta, ma non ancora regressa in modo eseguibile |

---

## 2. Playbook Data Collection Order

| PDF concept | Expected owner | Current mapping | Status | Notes |
|---|---|---|---|---|
| Obertura: chiedere il local all'inizio | Router -> History | runtime + prompt history | Partial | Migliorato, ma non ancora garantito in ogni apertura tecnica |
| Dati minimi: local | Router | runtime fact extraction | Partial | Presente, ma non ancora coperto da test completi |
| Dati minimi: rentadora o secadora | Router | runtime fact extraction | Partial | I typo sono migliorati ma non completamente blindati |
| Dati minimi: numero macchina se noto | Router | runtime fact extraction | Partial | Presente, ma ancora sensibile a contesto/ordine |
| Dati minimi: cosa e' successo | Router | `issueSummary` | Covered | Presente nel routing |
| Dati minimi: servizio completato o no | Router | schema + alcuni branch JSON | Partial | Esiste ma non e' sempre raccolto in modo coerente |
| Ordine obbligatorio: local -> tipo -> numero -> diagnosi | Router -> History | `compliance-checklist.md` + runtime | Partial | Regola definita, ma non ancora dimostrata su tutta la superficie |

---

## 3. Playbook Intents

| PDF concept | Expected representation | Current mapping | Status | Notes |
|---|---|---|---|---|
| No funciona la rentadora | JSON washer flow | `lavatrice_hs60xx.json` | Covered | Ramo tecnico principale presente |
| No funciona la secadora | JSON dryer flow | `asciugatrice_ed340.json` | Covered | Ramo tecnico principale presente |
| M'ha cobrat dues vegades | Non-JSON policy/FAQ + data collection | FAQ `doubleCharge` + `matrix-non-json.md` | Partial | Concetto presente ma non ancora formalizzato come path conversazionale completo |
| He pagat i no s'ha activat | Router + washer/dryer technical path | FAQ `paidButNotStarting` + JSON troubleshooting | Partial | Presente, ma ancora con edge-case di routing da blindare |
| Error AL001 | Washer path / policy | `lavatrice_hs60xx.json` + FAQ `errorAl001` | Covered | Concetto tracciato |
| Tinc un codi | Non-JSON policy path | FAQ `compensationCode` | Partial | Coperto come FAQ/policy, ma non come path guidato forte |
| Vull una devolucio | Non-JSON refund path | FAQ `refundRequest` | Partial | Dati minimi presenti, ma audit policy incompleto |

---

## 4. PROGRAMES.pdf Concepts

| PDF concept | Expected representation | Current mapping | Status | Notes |
|---|---|---|---|---|
| Washer 60C very hot for white/work/very dirty | FAQ or program reference | Not explicitly present | Gap | Manca risposta esplicita tracciabile |
| Washer 40C for cotton/colors/fibers | FAQ or program reference | Not explicitly present | Gap | Manca risposta esplicita tracciabile |
| Washer 30C temperate for synthetics/mixed cotton/colors | FAQ or program reference | Not explicitly present | Gap | Manca risposta esplicita tracciabile |
| Cold for delicate/wool/silk/curtains/down | FAQ or program reference | Not explicitly present | Gap | Manca risposta esplicita tracciabile |
| Dryer 80C high for towels / weekly laundry | FAQ or program reference | Not explicitly present | Gap | Manca risposta esplicita tracciabile |
| Dryer 65C medium for quilts / blankets | FAQ or program reference | Not explicitly present | Gap | Manca risposta esplicita tracciabile |
| Dryer 50C low for sofa covers / workwear / feather duvets | FAQ or program reference | Not explicitly present | Gap | Manca risposta esplicita tracciabile |
| Generic color-clothes temperature advice | FAQ | `FAQS.colorTemperature` | Partial | Esiste, ma non sostituisce la tabella completa programmi |

Black-and-white note:
- Il PDF `PROGRAMES.pdf` non e' stato ancora tradotto in una knowledge base completa.
- Oggi il demo risponde solo a sottoinsiemi parziali, non all'intera tabella programmi.

---

## 5. Washer PDF Concepts

| PDF concept | Expected representation | Current mapping | Status | Notes |
|---|---|---|---|---|
| Money inserted, washer not starting -> ask display | Washer JSON | `lavatrice_hs60xx.json` | Covered | Presente |
| KIT PROFIT PLUS / EXTRA fixed button | Washer JSON | `lavatrice_hs60xx.json` `case_extra_*` | Covered | Presente |
| STOP cancels wash and usually requires repay | Washer JSON | `stop_error` | Covered | Presente |
| First-time STOP reactivation exceptional handling | Washer JSON / operator path | `stop_error.first_time_escalate` | Covered | Presente |
| Wet clothes due to overload / bad balance | Washer JSON | `post_ciclo.wet_*` | Covered | Presente |
| Never put soaking wet clothes in dryers | Washer/Dryer cross-policy | `asciugatrice_ed340.json` `soaking_wet` | Covered | Concetto trasferito nel ramo dryer |
| Alarm signal ALM/* -> identify exact alarm, short STOP retry, else alternate washer + compensation | Washer JSON | `case_alm_*` | Partial | Alarm mapping c'e', ma la parte compensation/alternate washer e' stata resa piu' prudente del PDF |
| Occupied washer from another customer -> customer may move clothes to table | Policy/FAQ | `matrix.md` only | Gap | Concetto tracciato ma non implementato come risposta affidabile |
| Low foam is normal / industrial detergent | FAQ/non-JSON | `post_ciclo.foam` + FAQ reasoning | Covered | Presente |
| If no smell, ask to call again | Policy nuance | Not explicit | Gap | Questa sfumatura non risulta tracciata |
| If nothing works, use another washer and compensation | Washer policy path | Not explicit in runtime | Partial | Runtime tende a manual review, non a istruzione/compensazione esplicita |

---

## 6. Dryer PDF Concepts

| PDF concept | Expected representation | Current mapping | Status | Notes |
|---|---|---|---|---|
| Clothes soaking wet from washer -> rewash split load, repay, possible compensation | Dryer reset path + policy nuance | `soaking_wet` | Partial | Il ramo tecnico esiste, ma la policy precisa di rewash/repay/compensation non e' completa |
| Clothes still damp after cycle -> spread clothes, explain PAUSE, add time | Dryer JSON | `normal_damp` | Covered | Presente |
| Dryer alarm during cycle -> guide customer, note alarm, use another dryer, compensation | Dryer error path | `errore_reset` | Partial | Alarm branches presenti, ma la parte "use another dryer + compensation" non e' completa |
| Burnt clothes -> no automatic refund, possible insurance review | Dryer JSON / policy wording | `damage_burnt` | Partial | Manual review present, insurance nuance assente |
| Plastic stuck -> no automatic refund, customer should inspect drum | Dryer JSON / policy wording | `damage_plastic` | Partial | Manual review present, exact policy nuance incompleta |
| Stained clothes -> pre-treat and rewash, at most free rewash | Dryer JSON / policy wording | `damage_stained` | Partial | Path presente, but compensation nuance incomplete |
| Occupied dryer from another customer -> customer may move clothes to table | Policy/FAQ | `matrix.md` only | Gap | Concetto tracciato ma non implementato come risposta affidabile |
| Default display loop explains load / pay / temperature | Dryer startup guidance | Partially implicit | Partial | Il flow copre il start, ma non espone esplicitamente il significato del default display |
| If >3 EUR inserted and minutes do not increase before start, ask client to add extra once cycle has started, refund later if needed | Dryer startup + location/policy nuance | `minutes_not_added` escalation | Non-compliant | Il runtime/JSON oggi portano a manual review diretta; il PDF macchina descrive una gestione piu' sfumata |
| Door open display image / principal door open | Dryer display handling | `door_issue` | Partial | Concetto coperto in modo piu' generico |
| Strange smell -> operator inspects drum/filter path | Dryer JSON | `odor_case` | Covered | Presente e ora con wording piu' stretto |

Black-and-white note:
- Il caso `money added but minutes did not increase` NON e' ancora perfettamente allineato ai PDF.
- Il playbook dice escalation soprattutto per `Alemanya` e `Pineda`, mentre il PDF macchina descrive anche una gestione operativa locale prima del rimborso.
- L'implementazione attuale e' prudente, ma non equivale ancora a una trasposizione fedele e completa della fonte.

---

## 7. FAQ Dataset Audit Against PDFs

| FAQ / policy concept in demo | Source traceability | Status | Notes |
|---|---|---|---|
| Payment methods | Playbook / local policy | Partial | Presente nel demo, ma non ancora validato contro tutte le fonti PDF |
| Pricing | Playbook / local policy | Partial | Presente, ma da confermare per fonte aggiornata |
| App download | Not from machine PDFs | Partial | Presente, ma fonte non verificata in questo audit |
| Color-temperature advice | `PROGRAMES.pdf` partial overlap | Partial | Copre solo un sottoinsieme |
| Grease/stain advice | Not fully traced in audited PDFs | Partial | Presente ma non ancora tracciato a una fonte PDF chiusa |
| Double charge | Playbook | Partial | Presente come FAQ, ma manca path conversazionale testato |
| Refund request | Playbook | Partial | Presente come FAQ/policy |
| Invoice request | Playbook | Partial | Presente, ma la fonte andrebbe ricontrollata integralmente |
| Loyalty card | Playbook/local policy | Partial | Presente, ma non completamente auditato contro le fonti |
| Location differences | Playbook/local policy | Partial | Presente, ma mescola concetti da piu' fonti e richiede validazione completa |

---

## 8. Black-And-White Findings

Queste affermazioni sono sostenibili oggi, nero su bianco.

1. I flow JSON coprono abbastanza bene il cuore tecnico di rentadora e secadora.
2. Il playbook globale e' stato solo trasferito parzialmente nel comportamento effettivo del demo.
3. `PROGRAMES.pdf` NON e' ancora stato trasferito in una knowledge base completa.
4. Le policy di compensazione/rimborso descritte nei PDF macchina sono state solo trasferite in modo parziale e prudente.
5. Il caso secadora `minuti non aumentano` e' ancora una zona non pienamente allineata alle fonti.
6. I casi `occupied machine by another customer` risultano documentati nei PDF, ma non ancora implementati in modo affidabile nel demo.
7. Non tutte le FAQ oggi presenti nel demo sono gia' tracciate in modo formale ai PDF auditati in questa passata.

---

## 9. Required Next Actions

1. Tradurre `PROGRAMES.pdf` in FAQ o reference table esplicita.
2. Formalizzare i casi policy `occupied machine`, `double charge`, `refund`, `compensation` con path e prova eseguibile.
3. Decidere come rappresentare fedelmente il caso dryer `minutes did not increase`: policy per local, retry operativo, oppure manual review condizionata.
4. Aggiungere test/scripted scenarios che provino i rami ancora `Partial` o `Non-compliant`.