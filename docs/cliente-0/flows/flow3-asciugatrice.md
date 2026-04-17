flowchart TD

START --> START_RUN
START_RUN["Il servizio è partito?"]

%% NON PARTE
START_RUN -->|No| NP2
NP2["Cosa dice il display?"]

NP2 -->|Porta| DOOR["Chiudere porta"] --> AR1
NP2 -->|Filtro| FILTER["Pulire filtro e sensore porta"] --> AR1
NP2 -->|Credito| CREDIT["Verificare credito / aggiungere tempo"] --> AR1
NP2 -->|Alarma| ALM_CHECK["Premere STOP (1 volta)"] --> AR_ALM
NP2 -->|Altro| ESC1["Escalare"]

%% ALLARMI SECADORA
AR_ALM["Ha funzionato?"]
AR_ALM -->|Si| OK_ALM["OK - riparte"]
AR_ALM -->|No| ALM_TYPE["Tipo alarma?"]
ALM_TYPE -->|Filtro porta| ALM_FILTER["Pulire filtro + sensore. Riposizionare"] --> AR_ALM2
ALM_TYPE -->|Rotazione| ALM_ROT["Sensore rotazione allentato. Escalare"]
ALM_TYPE -->|Aspirazione| ALM_ASP["Pulire filtro e tubo aspirazione"] --> AR_ALM2
ALM_TYPE -->|Altro| ESC_ALM["Usare altra secadora + compensazione"]

AR_ALM2["Ha funzionato?"]
AR_ALM2 -->|Si| OK_ALM2["OK"]
AR_ALM2 -->|No| ESC_ALM2["Usare altra secadora + compensazione"]

%% PARTE
START_RUN -->|Si| P1
P1["Il ciclo è finito?"]

P1 -->|No| WAIT["Attendere fine ciclo"] --> AR2
P1 -->|Si| P2

P2["Problema?"]

P2 -->|Non asciuga| DRY["Aggiungere tempo. Estendere ropa, non in bolla"] --> AR2
P2 -->|Troppo umida dalla lavatrice| HUMID["Ropa troppo bagnata: rilavare separando carico"] --> HUMID_COMP
HUMID_COMP["Compensazione lavaggio se carico eccessivo"]
P2 -->|Odore| SMELL["Pulire cestello / controllare filtro"]
P2 -->|Rumore| NOISE["Possibile guasto"] --> ESC2
P2 -->|Porta bloccata| LOCK["Attendere sblocco (fase raffreddamento 2 min)"] --> AR2
P2 -->|Rovinata / bruciata| DAMAGE["Verificare etichetta: temperatura inadeguata. NO compensazione"]
P2 -->|Plastico attaccato| PLASTIC["Controllare tamburo prima dell'uso. NO compensazione"]
P2 -->|Macchiata| STAIN["Rilavare con pretrattamento. Compensazione: lavaggio gratuito"]

%% ASK RESOLVED
AR1["Ha funzionato?"]
AR1 -->|Si| OK1["OK"]
AR1 -->|No| NP2

AR2["Ha funzionato?"]
AR2 -->|Si| OK2["OK"]
AR2 -->|No| ESC3["Escalare + compensazione"]
