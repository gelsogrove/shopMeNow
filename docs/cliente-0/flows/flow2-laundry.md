# Flow 2 — Lavatrice (Deterministico)

Fonte di verita: `achitecture.md`.

## Regole operative

- Questo flow e eseguito dal `FlowEngineService` (0 token LLM).
- Una sola istruzione/domanda per step.
- D1 ha retry limit: massimo 3 tentativi, poi escalation.
- Nodo `CREDIT` diviso in step concreti (credito residuo, pressione tasto, nuovo credito).
- Se flow riprende da PAUSA, rimandare sempre `currentNode.prompt` prima del nuovo input.
- Nessuna compensazione automatica promessa dal bot.

```mermaid
flowchart TD

START --> SR{"Il servizio e partito?"}

SR -->|No| D1{"Cosa vedi sul display?"}
D1 -->|DOOR| DOOR["Chiudi bene la porta"] --> AR1
D1 -->|SEL| SEL["Seleziona il programma"] --> AR1
D1 -->|PUSH PROG| PUSH["Premi il pulsante programma"] --> AR1
D1 -->|Credito/prezzo| CREDIT_1["Controlla se resta credito sulla centrale"] --> CREDIT_2
D1 -->|AL001| AL001["Errore di sequenza: rifai i passaggi nell'ordine corretto"] --> AR1
D1 -->|ALM| ALM_STOP["Premi STOP una volta"] --> AR_ALM
D1 -->|END + bAL| BAL["Carico sbilanciato: separa il carico in 2 lavatrici"] --> ESC_COMP
D1 -->|Altro| ESC_TECH["Escalare: errore non riconosciuto"]

CREDIT_2{"C'e credito residuo?"}
CREDIT_2 -->|Si| CREDIT_PRESS["Ripremi numero macchina / programma corretto"] --> AR1
CREDIT_2 -->|No| CREDIT_ADD["Aggiungi credito richiesto e riprova"] --> AR1

AR_ALM{"Ha funzionato?"}
AR_ALM -->|Si| OK_ALM["Risolto"]
AR_ALM -->|No| ALM_TYPE{"Tipo allarme ALM?"}
ALM_TYPE -->|ALM/A acqua| ALM_A["Controlla ingresso acqua e riprova"] --> AR_ALM2
ALM_TYPE -->|ALM/E desague| ALM_E["Controlla scarico/ostruzioni e riprova"] --> AR_ALM2
ALM_TYPE -->|ALM/door| ALM_D["Controlla chiusura sicurezza porta"] --> AR_ALM2
ALM_TYPE -->|ALM/VAr| ALM_V["Possibile variatore: verifica e riprova"] --> AR_ALM2
ALM_TYPE -->|Altro| ESC_ALM["Escalare: allarme non mappato"]

AR_ALM2{"Ha funzionato?"}
AR_ALM2 -->|Si| OK_ALM2["Risolto"]
AR_ALM2 -->|No| ESC_COMP["Escalare: operatore valuta il caso"]

AR1{"Ha funzionato?"}
AR1 -->|Si| OK1["Risolto"]
AR1 -->|No| D1_RETRY

D1_RETRY{"Tentativi D1 >= 3?"}
D1_RETRY -->|No| D1
D1_RETRY -->|Si| ESC_LOOP["Escalare: 3 tentativi senza esito"]

SR -->|Si| F1{"Il ciclo e finito?"}
F1 -->|No| RUN{"Che succede ora?"}
RUN -->|Sta funzionando| WAIT["Attendi fine ciclo; se cambia qualcosa dimmi subito"] --> F1
RUN -->|STOP premuto| STOP_MSG["STOP annulla il lavaggio: caso da revisionare, nessuna compensazione automatica"] --> ESC_STOP
ESC_STOP["Escalare: decisione operatore"]

F1 -->|Si| P2{"Problema finale?"}
P2 -->|Bagnata/non centrifugata| WET["Carico eccessivo: separa e rilava"] --> AR2
P2 -->|Non scarica acqua| DRAIN["Possibile guasto"] --> ESC_T2
P2 -->|Non carica acqua| WATER["Possibile guasto"] --> ESC_T3
P2 -->|Rumore| NOISE["Possibile guasto"] --> ESC_T4
P2 -->|Porta bloccata| LOCK["Attendi 2-3 min per sblocco (anche di piu se sta drenando)"] --> AR2
P2 -->|Rovinata| DAMAGE["Mi dispiace: verifichiamo etichetta/uso e lo revisamos"] --> RES_INFO
P2 -->|No sapone/schiuma| SOAP["E normale: detergente industriale, poca schiuma. Se vuoi lo revisamos"] --> RES_INFO
P2 -->|Nessun problema| OK2["Risolto"]

AR2{"Ha funzionato?"}
AR2 -->|Si| OK3["Risolto"]
AR2 -->|No| ESC_COMP2["Escalare: operatore"]

RES_INFO["Chiusura informativa; se il cliente contesta -> escalation"]
```

## Copertura Playbook

- 5.1 No funciona la rentadora
- 5.4 He pagat i no s'ha activat
- 5.5 Error AL001
- Regole compensazione §7
- Escalation §10
