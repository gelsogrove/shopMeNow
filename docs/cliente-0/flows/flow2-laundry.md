flowchart TD

START --> START_RUN
START_RUN["Il servizio è partito?"]

%% NON PARTE
START_RUN -->|No| NP2
NP2["Cosa dice il display?"]

NP2 -->|Porta / door| DOOR["Chiudere porta"] --> AR1
NP2 -->|Selezione / SEL| SEL["Selezionare programma"] --> AR1
NP2 -->|Start / PUSH PROG| PUSH["Premere pulsante programma"] --> AR1
NP2 -->|Credito / prezzo| CREDIT["Verificare credito"] --> AR1
NP2 -->|ALM + tipo| ALM_CHECK["Premere STOP (1 volta)"] --> AR_ALM
NP2 -->|END + bAL| BAL["Desequilibrio carico: separare ropa in 2 lavatrici"] --> ESC_BAL
NP2 -->|Altro| ESC1["Escalare"]

%% ALLARMI
AR_ALM["Ha funzionato?"]
AR_ALM -->|Si| OK_ALM["OK - riparte"]
AR_ALM -->|No| ESC_ALM["Usare altra lavatrice + compensazione"]

%% DESEQUILIBRIO
ESC_BAL["Escalare + compensazione"]

%% PARTE
START_RUN -->|Si| P1
P1["Il ciclo è finito?"]

P1 -->|No| P1_PROBLEM["Che succede?"]
P1_PROBLEM -->|Sta funzionando| WAIT["Attendere fine ciclo"]
P1_PROBLEM -->|STOP premuto| STOP_INFO["STOP cancella il lavaggio. Pagare di nuovo"] --> STOP_COMP
STOP_COMP["Prima volta?"]
STOP_COMP -->|Si| STOP_FREE["Attivazione gratuita"]
STOP_COMP -->|No| STOP_PAY["Deve ripagare"]

P1 -->|Si| P2

P2["Problema?"]

P2 -->|Bagnata / non centrifugata| WET["Carico eccessivo: separare in 2 lavatrici"] --> AR2
P2 -->|Non scarica acqua| DRAIN["Possibile guasto"] --> ESC2
P2 -->|Non carica acqua| WATER["Possibile guasto"] --> ESC3
P2 -->|Rumore| NOISE["Possibile guasto"] --> ESC4
P2 -->|Porta bloccata| LOCK["Attendere sblocco"] --> AR2
P2 -->|Rovinata| DAMAGE["Verificare uso errato: NO compensazione"]
P2 -->|No sapone / schiuma| SOAP["Detergente industriale: poca schiuma è normale"]

%% ASK RESOLVED
AR1["Ha funzionato?"]
AR1 -->|Si| OK1["OK"]
AR1 -->|No| NP2

AR2["Ha funzionato?"]
AR2 -->|Si| OK2["OK"]
AR2 -->|No| ESC5["Escalare + compensazione"]
