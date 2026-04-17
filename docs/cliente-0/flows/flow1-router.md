flowchart TD

START --> ID
ID["Numero macchina?"] --> TYPE

TYPE["Tipo macchina?"]

TYPE -->|Lavatrice| WASH_LLM["→ LLM Lavatrice"]
TYPE -->|Asciugatrice| DRY_LLM["→ LLM Asciugatrice"]