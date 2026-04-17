# Flow 3 — Asciugatrice/Secadora (Deterministico)

Fonte di verita: `achitecture.md`.

## Regole operative

- Flow deterministico (`FlowEngineService`), no LLM per la transizione nodi.
- Una domanda/azione per step.
- D1 ha retry limit: massimo 3 tentativi, poi escalation.
- Nodo `CREDIT` diviso in step concreti (display minuti, nuovo credito, conferma avvio).
- Se flow riprende da PAUSA, rimandare sempre `currentNode.prompt` prima del nuovo input.
- Nessuna compensazione promessa automaticamente.
- Casi locali critici (Alemanya/Pineda) sempre con escalation umana.

```mermaid
flowchart TD

START --> SR{"Il servizio e partito?"}

SR -->|No| D1{"Cosa dice il display?"}
D1 -->|Porta| DOOR["Chiudi bene la porta"] --> AR1
D1 -->|Filtro| FILTER["Pulisci filtro e sensore porta"] --> AR1
D1 -->|Credito/tempo| CREDIT_1["Controlla minuti/prezzo sul display"] --> CREDIT_2
D1 -->|Alarma| ALM_STOP["Premi STOP una volta"] --> AR_ALM
D1 -->|Altro| ESC1["Escalare: errore non riconosciuto"]

CREDIT_2{"I minuti aumentano dopo pagamento?"}
CREDIT_2 -->|Si| CREDIT_START["Premi START/programma e verifica avvio"] --> AR1
CREDIT_2 -->|No| ESC_LOCAL["Alemanya/Pineda o anomalia credito: escalation revisione umana"]

AR_ALM{"Ha funzionato?"}
AR_ALM -->|Si| OK_ALM["Risolto"]
AR_ALM -->|No| ALM_TYPE{"Tipo allarme?"}

ALM_TYPE -->|Filtro porta| ALM_F["Pulire filtro + sensore e riposizionare"] --> AR_ALM2
ALM_TYPE -->|Rotazione| ALM_R["Possibile sensore rotazione"] --> ESC2
ALM_TYPE -->|Aspirazione| ALM_A["Pulire filtro e tubo aspirazione"] --> AR_ALM2
ALM_TYPE -->|Altro| ESC3["Escalare: guasto/allarme non mappato"]

AR_ALM2{"Ha funzionato?"}
AR_ALM2 -->|Si| OK_ALM2["Risolto"]
AR_ALM2 -->|No| ESC4["Escalare: operatore"]

AR1{"Ha funzionato?"}
AR1 -->|Si| OK1["Risolto"]
AR1 -->|No| D1_RETRY

D1_RETRY{"Tentativi D1 >= 3?"}
D1_RETRY -->|No| D1
D1_RETRY -->|Si| ESC_LOOP["Escalare: 3 tentativi senza esito"]

SR -->|Si| F1{"Il ciclo e finito?"}
F1 -->|No| RUN{"Che succede ora?"}
RUN -->|Sta asciugando| WAIT["Attendi fine ciclo; se cambia qualcosa dimmi subito"] --> F1
RUN -->|STOP premuto| STOP_DRY["STOP interrompe ciclo: caso da revisionare, nessuna compensazione automatica"] --> AR2
F1 -->|Si| P2{"Problema finale?"}

P2 -->|Non asciuga| DRY_CAUSE
P2 -->|Troppo umida dalla lavatrice| HUMID["Carico troppo umido: separa e rilava"] --> AR2
P2 -->|Odore| SMELL["Pulizia cestello/filtro"] --> AR2
P2 -->|Rumore| NOISE["Possibile guasto"] --> ESC5
P2 -->|Porta bloccata| LOCK["Attendi 2-3 min (raffreddamento) e riprova"] --> AR2
P2 -->|Rovinata/bruciata| DAMAGE["Mi dispiace. Verifica etichetta tessuto; non promettiamo compensazione automatica, ma lo revisamos"] --> RES_INFO
P2 -->|Plastico attaccato| PLASTIC["Mi dispiace. Controllo tamburo prima uso; lo revisamos con operatore se serve"] --> RES_INFO
P2 -->|Macchiata| STAIN["Rilava con pretrattamento; eventuale compensazione solo dopo revisione"] --> ESC_COMP
P2 -->|Nessun problema| OK2["Risolto"]

DRY_CAUSE{"Cause probabili"}
DRY_CAUSE -->|Carico troppo pieno/in bolla| DRY_LOAD["Riduci carico e distendi i capi"] --> AR2
DRY_CAUSE -->|Tempo insufficiente| DRY_TIME["Aggiungi 10-15 min e verifica"] --> AR2
DRY_CAUSE -->|Centrifuga lavatrice insufficiente| DRY_SPIN["Rientra nel flusso lavatrice (centrifuga/carico)"] --> AR2

AR2{"Ha funzionato?"}
AR2 -->|Si| OK3["Risolto"]
AR2 -->|No| ESC6["Escalare: operatore"]

ESC_COMP["Escalare: valutazione compensazione umana"]
RES_INFO["Chiusura informativa; se il cliente contesta -> escalation"]
```

## Copertura Playbook

- 5.2 No funciona la secadora
- 5.4 He pagat i no s'ha activat (parte secadora)
- 8. Differenze per locale (Alemanya/Pineda, Goya)
- Regole compensazione §7
- Escalation §10
