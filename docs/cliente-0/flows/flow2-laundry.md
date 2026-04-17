# Flow 2 — Lavatrice (Deterministico)

Fonte di verita: `achitecture.md`.

## Regole operative

- Questo flow e eseguito dal `FlowEngineService` (0 token LLM).
- Una sola istruzione/domanda per step.
- Se non risolto o caso ambiguo: escalation umana.
- Nessuna compensazione automatica promessa dal bot.

```mermaid
flowchart TD

START --> SR{"Il servizio e partito?"}

SR -->|No| D1{"Cosa vedi sul display?"}
D1 -->|DOOR| DOOR["Chiudi bene la porta"] --> AR1
D1 -->|SEL| SEL["Seleziona il programma"] --> AR1
D1 -->|PUSH PROG| PUSH["Premi il pulsante programma"] --> AR1
D1 -->|Credito/prezzo| CREDIT["Verifica saldo centrale e numero macchina"] --> AR1
D1 -->|AL001| AL001["Errore di sequenza: rifai i passaggi nell'ordine corretto"] --> AR1
D1 -->|ALM| ALM_STOP["Premi STOP una volta"] --> AR_ALM
D1 -->|END + bAL| BAL["Carico sbilanciato: separa il carico in 2 lavatrici"] --> ESC_COMP
D1 -->|Altro| ESC_TECH["Escalare: errore non riconosciuto"]

AR_ALM{"Ha funzionato?"}
AR_ALM -->|Si| OK_ALM["Risolto"]
AR_ALM -->|No| ESC_COMP["Escalare: operatore valuta compensazione"]

AR1{"Ha funzionato?"}
AR1 -->|Si| OK1["Risolto"]
AR1 -->|No| D1

SR -->|Si| F1{"Il ciclo e finito?"}
F1 -->|No| RUN{"Che succede ora?"}
RUN -->|Sta funzionando| WAIT["Attendi la fine ciclo"] --> F1
RUN -->|STOP premuto| STOP_MSG["STOP annulla il lavaggio"] --> ESC_STOP
ESC_STOP["Escalare: decisione operatore su eventuale compensazione"]

F1 -->|Si| P2{"Problema finale?"}
P2 -->|Bagnata/non centrifugata| WET["Carico eccessivo: separa e rilava"] --> AR2
P2 -->|Non scarica acqua| DRAIN["Possibile guasto"] --> ESC_T2
P2 -->|Non carica acqua| WATER["Possibile guasto"] --> ESC_T3
P2 -->|Rumore| NOISE["Possibile guasto"] --> ESC_T4
P2 -->|Porta bloccata| LOCK["Attendi lo sblocco porta"] --> AR2
P2 -->|Rovinata| DAMAGE["Verifica etichetta/uso. Nessuna compensazione automatica"] --> RES_INFO
P2 -->|No sapone/schiuma| SOAP["Detergente industriale: poca schiuma e normale"] --> RES_INFO
P2 -->|Nessun problema| OK2["Risolto"]

AR2{"Ha funzionato?"}
AR2 -->|Si| OK3["Risolto"]
AR2 -->|No| ESC_COMP2["Escalare: operatore"]

RES_INFO["Chiusura informativa. Se cliente contesta: escalation"]
```

## Copertura Playbook

- 5.1 No funciona la rentadora
- 5.4 He pagat i no s'ha activat
- 5.5 Error AL001
- Regole compensazione §7
- Escalation §10
