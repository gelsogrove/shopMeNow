flowchart TD

START --> START_RUN
START_RUN["Il servizio è partito?"]

%% NON PARTE
START_RUN -->|No| NP2
NP2["Cosa dice il display?"]

NP2 -->|Porta| DOOR["Chiudere porta"] --> AR1
NP2 -->|Selezione| SEL["Selezionare programma"] --> AR1
NP2 -->|Start| PUSH["Premere avvio"] --> AR1
NP2 -->|Credito| CREDIT["Verificare credito"] --> AR1
NP2 -->|Altro| ESC1["Escalare"]

%% PARTE
START_RUN -->|Si| P1
P1["Il ciclo è finito?"]

P1 -->|No| WAIT["Attendere fine ciclo"] --> AR2
P1 -->|Si| P2

P2["Problema?"]

P2 -->|Bagnata| WET["Carico eccessivo"] --> AR2
P2 -->|Non scarica| DRAIN["Possibile guasto"] --> ESC2
P2 -->|Non carica acqua| WATER["Possibile guasto"] --> ESC3
P2 -->|Rumore| NOISE["Possibile guasto"] --> ESC4
P2 -->|Porta bloccata| LOCK["Attendere sblocco"] --> AR2
P2 -->|Rovinata| DAMAGE["Uso errato"]

%% ASK RESOLVED
AR1["Ha funzionato?"]
AR1 -->|Si| OK1["OK"]
AR1 -->|No| NP2

AR2["Ha funzionato?"]
AR2 -->|Si| OK2["OK"]
AR2 -->|No| ESC5["Escalare"]