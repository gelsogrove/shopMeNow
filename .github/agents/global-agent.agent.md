REGOLE FERREE DA RISPETTARE

DESCRIPTION:
REGOLE FERREE DA RISPETTARE

PRINCIPI GENERALI

Mai hardcodare if, includes, regex, ecc.
Gli LLM sono intelligenti e riconoscono l'intenzione

Tutto deve SEMPRE passare dal LLM di traduzione

Sicurezza prima di tutto:

passare sempre i parametri corretti

evitare fughe di dati

Non esporre mai dati sensibili o personali

Se non sei sicuro di qualcosa:

chiedi chiarimenti

NON inventare risposte

Non cambiare i patterns senza approvazione

Se un utente e' bloccato:

ignorare TUTTO

Se il canale e' disabilitato:

inviare messaggio di WIP

Se l'utente ha finito i soldi:

buffer consentito fino a -10 euro

ARCHITETTURA E CODICE

Evitare file troppo lunghi

Dividere in servizi piccoli e modulari

MAI chiamate dirette al database

usare sempre services / repository

Mantenere separazione delle responsabilita' (SRP)

Struttura obbligatoria:

routers

controllers

services

repository

models

QUERY E TOOLING

DATABASE:
Usare esclusivamente:

docker exec -it shop_db psql -U echatbotfy -d echatbotfy -c "SELECT id, ..."

MCP:
Per usare MCP:

cd mcp
npm run mcp-client "Mario Rossi" "Ciao come stai?"

CONVERSAZIONE E UX

CONVERSATION HISTORY:

Limitata nel codice a:
slice(-5)

Usata per umanizzare le risposte degli agenti tecnici

Temperature: 0.7 (OK)

EMOJI

Consentite:

Conferme

Spedizioni

Celebrazioni

NON consentite:

Carrello

Prodotti

Trasporti

Prezzi

SALUTI
ho detto in ASCII!!

Hai ragione 👍
Questa volta SOLO ASCII PURO:

niente accenti

niente emoji

niente simboli speciali

solo lettere inglesi, numeri e segni base

REGOLE FERREE DA RISPETTARE

DESCRIPTION:
REGOLE FERREE DA RISPETTARE

PRINCIPI GENERALI

Mai hardcodare if, includes, regex, ecc
Gli LLM sono intelligenti e riconoscono la intenzione

Tutto deve SEMPRE passare dal LLM di traduzione

Sicurezza prima di tutto:

passare sempre i parametri corretti

evitare fughe di dati

Non esporre mai dati sensibili o personali

Se non sei sicuro di qualcosa:

chiedi chiarimenti

NON inventare risposte

Non cambiare i patterns senza approvazione

Se un utente e bloccato:

ignorare TUTTO

Se il canale e disabilitato:

inviare messaggio di WIP

Se utente ha finito i soldi:

buffer consentito fino a -10 euro

ARCHITETTURA E CODICE

Evitare file troppo lunghi

Dividere in servizi piccoli e modulari

MAI chiamate dirette al database

usare sempre services e repository

Mantenere separazione delle responsabilita (SRP)

Struttura obbligatoria:

routers

controllers

services

repository

models

QUERY E TOOLING

DATABASE:
Usare esclusivamente:

docker exec -it shop_db psql -U echatbotfy -d echatbotfy -c "SELECT id, ..."

MCP:
Per usare MCP:

cd mcp
npm run mcp-client "Mario Rossi" "Ciao come stai?"

CONVERSAZIONE E UX

CONVERSATION HISTORY:

Limitata nel codice a:
slice(-5)

Usata per umanizzare le risposte degli agenti tecnici

Temperature 0.7 OK

EMOJI

Consentite:

Conferme

Spedizioni

Celebrazioni

NON consentite:

Carrello

Prodotti

Trasporti

Prezzi

SALUTI

Sempre al primo messaggio

Successivamente solo se:

sono passate ore

il cliente saluta

Varieta saluti:

Ciao

Eccomi

Bentornato

Si dimmi

VALORI INTOCCABILI

MAI modificare:

numeri

prezzi

nomi

SKU

lingua

COERENZA E DIALOGO

Verificare che la risposta abbia senso con la domanda

Se non ha senso:

chiedere chiarimenti

Se non esiste un menu:

proporre prossimo passo logico

ISOLAMENTO E FILTRI

I messaggi tra canali e utenti NON devono mescolarsi

Verificare sempre i filtri del chatbot

Per variabili di replace:

filtro workspaceId OBBLIGATORIO

Se vuoi, nel prossimo passo posso:

renderlo un file di policy

adattarlo a prompt di sistema

convertirlo in checklist tecnica

ChatGPT can make mistakes. Check important info. See Cookie Preferences.