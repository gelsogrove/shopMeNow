# Flow 3 — Asciugatrice/Secadora (Deterministico)

Fonte di verita: `achitecture.md`.

## Regole operative

- Flow deterministico (`FlowEngineService`), no LLM per la transizione nodi.
- Una domanda/azione per step.
- Nessuna compensazione promessa automaticamente.
- Casi locali critici (Alemanya/Pineda) sempre con escalation umana.

```mermaid
flowchart TD

START --> SR{"Il servizio e partito?"}

SR -->|No| D1{"Cosa dice il display?"}
D1 -->|Porta| DOOR["Chiudi bene la porta"] --> AR1
D1 -->|Filtro| FILTER["Pulisci filtro e sensore porta"] --> AR1
D1 -->|Credito/tempo| CREDIT["Verifica saldo e aggiunta minuti"] --> MINCHK
D1 -->|Alarma| ALM_STOP["Premi STOP una volta"] --> AR_ALM
D1 -->|Altro| ESC1["Escalare: errore non riconosciuto"]

MINCHK{"I minuti si sono sommati?"}
MINCHK -->|Si| AR1
MINCHK -->|No| ESC_LOCAL["Alemanya/Pineda: escalation revisione umana"]

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
AR1 -->|No| D1

SR -->|Si| F1{"Il ciclo e finito?"}
F1 -->|No| WAIT["Attendi fine ciclo"] --> F1
F1 -->|Si| P2{"Problema finale?"}

P2 -->|Non asciuga| DRY["Aggiungi tempo e stendi il carico"] --> AR2
P2 -->|Troppo umida dalla lavatrice| HUMID["Carico troppo bagnato: separa e rilava"] --> ESC_COMP
P2 -->|Odore| SMELL["Pulizia cestello/filtro"] --> AR2
P2 -->|Rumore| NOISE["Possibile guasto"] --> ESC5
P2 -->|Porta bloccata| LOCK["Attendi sblocco (raffreddamento)"] --> AR2
P2 -->|Rovinata/bruciata| DAMAGE["Verifica etichetta tessuto. No compensazione automatica"] --> RES_INFO
P2 -->|Plastico attaccato| PLASTIC["Controllo tamburo prima uso. No compensazione automatica"] --> RES_INFO
P2 -->|Macchiata| STAIN["Rilavare con pretrattamento; eventuale compensazione solo dopo revisione"] --> ESC_COMP
P2 -->|Nessun problema| OK2["Risolto"]

AR2{"Ha funzionato?"}
AR2 -->|Si| OK3["Risolto"]
AR2 -->|No| ESC6["Escalare: operatore"]

ESC_COMP["Escalare: valutazione compensazione umana"]
RES_INFO["Chiusura informativa. Se contestazione: escalation"]
```

## Copertura Playbook

- 5.2 No funciona la secadora
- 5.4 He pagat i no s'ha activat (parte secadora)
- 8. Differenze per locale (Alemanya/Pineda, Goya)
- Regole compensazione §7
- Escalation §10
